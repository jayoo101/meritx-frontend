// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {UD60x18, ud} from "@prb/math/src/UD60x18.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

// ---------- External Interfaces ----------

interface IUniswapV3Pool {
    function observe(uint32[] calldata)
        external view returns (int56[] memory, uint160[] memory);
    function slot0()
        external view returns (uint160, int24, uint16, uint16, uint16, uint8, bool);
    function increaseObservationCardinalityNext(uint16) external;
}

interface IWETH {
    function deposit() external payable;
    function approve(address, uint256) external returns (bool);
}

interface INonfungiblePositionManager {
    struct MintParams {
        address token0; address token1; uint24 fee;
        int24 tickLower; int24 tickUpper;
        uint256 amount0Desired; uint256 amount1Desired;
        uint256 amount0Min; uint256 amount1Min;
        address recipient; uint256 deadline;
    }
    struct CollectParams {
        uint256 tokenId; address recipient;
        uint128 amount0Max; uint128 amount1Max;
    }
    function createAndInitializePoolIfNecessary(
        address, address, uint24, uint160
    ) external payable returns (address);
    function mint(MintParams calldata)
        external payable returns (uint256, uint128, uint256, uint256);
    function collect(CollectParams calldata)
        external payable returns (uint256, uint256);
}

// ---------- MeritX Token -- ERC20 + immutable minter ----------
// Replaces OZ AccessControl with a single immutable minter address
// to stay under the 24 KB EIP-170 bytecode limit in the factory pattern.
contract MeritXToken {
    address public immutable minter;

    string  public name;
    string  public symbol;
    uint8   public constant decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory _name, string memory _symbol, uint256 _supply, address _minter) {
        name = _name;
        symbol = _symbol;
        totalSupply = _supply;
        minter = _minter;
        balanceOf[_minter] = _supply;
        emit Transfer(address(0), _minter, _supply);
    }

    function mint(address to, uint256 amount) external {
        require(msg.sender == minter, "!minter");
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "!bal");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "!bal");
        require(allowance[from][msg.sender] >= amount, "!allow");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}

// ---------- MeritX Fund -- Raise + PoHG + LP Creation/Lock + PoP ----------
contract MeritXFund {
    enum State { Funding, Failed, Success_Isolated, Ready_For_DEX }

    MeritXToken public projectToken;
    address public immutable projectOwner;
    address public immutable platformTreasury;
    address public immutable backendSigner;
    address public immutable positionManager;
    address public immutable weth;

    // -- LP constants --
    uint24  constant FEE_TIER  = 3000;    // 0.3 %
    int24   constant TICK_LOW  = -887220; // full-range (divisible by tickSpacing 60)
    int24   constant TICK_HIGH = 887220;

    // -- Raise parameters (testnet parameters) --
    uint256 public constant SOFT_CAP           = 0.001 ether;
    // Hard cap set to 0.2 ETH — covers the Admin dashboard's max PoHG allocation of 0.15 ETH
    uint256 public constant MAX_ALLOCATION     = 0.2 ether; 
    uint256 public constant RAISE_DURATION     = 5 minutes;
    uint256 public constant PLATFORM_FEE_PCT   = 5;
    uint256 public constant LAUNCH_WINDOW      = 30 days;
    uint256 public constant PRE_LAUNCH_NOTICE  = 6 hours;
    uint256 public constant LAUNCH_EXPIRATION  = 24 hours;
    uint256 public constant RETAIL_POOL        = 21_000_000e18;
    uint256 public constant INITIAL_SUPPLY     = 40_950_000e18;
    uint256 public constant LP_POOL            = INITIAL_SUPPLY - RETAIL_POOL;

    // -- PoP inflation constants --
    uint256 internal constant LN_1_0001    = 99_995_000_333_300;
    uint256 internal constant EXPONENT_015 = 150_000_000_000_000_000;
    uint256 public constant MINT_COOLDOWN      = 1 hours;
    uint256 public constant CALLER_REWARD_BPS  = 10;   // 0.1 %
    uint32  public constant TWAP_INTERVAL      = 1800; // 30 min

    // -- Raise state --
    uint256 public totalRaised;
    uint256 public raiseEndTime;
    bool    public isFinalized;
    mapping(address => uint256) public contributions;

    // -- Anti-stealth launch --
    uint256 public launchAnnouncementTime;

    // -- IPFS metadata --
    string public ipfsURI;

    // -- Post-finalization state (LP + inflation) --
    uint256 public lpTokenId;
    address public uniswapPool;
    int24   public initialTick;
    uint256 public lastMintTime;

    constructor(
        address _owner,
        string memory _name,
        string memory _symbol,
        address _treasury,
        address _backendSigner,
        address _positionManager,
        address _weth,
        string memory _ipfsURI
    ) {
        projectOwner     = _owner;
        platformTreasury = _treasury;
        backendSigner    = _backendSigner;
        positionManager  = _positionManager;
        weth             = _weth;
        raiseEndTime     = block.timestamp + RAISE_DURATION;
        ipfsURI          = _ipfsURI;
        projectToken     = new MeritXToken(_name, _symbol, INITIAL_SUPPLY, address(this));
    }

    receive() external payable {}

    /// @dev Accept LP NFT from the Position Manager during finalization.
    function onERC721Received(address, address, uint256, bytes calldata)
        external pure returns (bytes4)
    {
        return this.onERC721Received.selector;
    }

    // ---- Contribute (PoHG-gated) ----

    function contribute(uint256 _maxAlloc, bytes calldata _sig) external payable {
        require(block.timestamp <= raiseEndTime, "!time");
        require(msg.value > 0, "!val");
        require(_maxAlloc <= MAX_ALLOCATION, "!ceil");
        bytes32 h = keccak256(abi.encodePacked(msg.sender, _maxAlloc, address(this), block.chainid));
        require(_recover(h, _sig) == backendSigner, "!sig");
        require(contributions[msg.sender] + msg.value <= _maxAlloc, "!alloc");
        contributions[msg.sender] += msg.value;
        totalRaised += msg.value;
    }

    function _recover(bytes32 _h, bytes memory _s) internal pure returns (address) {
        bytes32 eh = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", _h)
        );
        require(_s.length == 65, "!siglen");
        bytes32 r; bytes32 s; uint8 v;
        assembly {
            r := mload(add(_s, 32))
            s := mload(add(_s, 64))
            v := byte(0, mload(add(_s, 96)))
        }
        if (v < 27) v += 27;
        require(v == 27 || v == 28, "!v");
        address a = ecrecover(eh, v, r, s);
        require(a != address(0), "!rec");
        return a;
    }

    // ---- State Machine ----

    function currentState() public view returns (State) {
        if (block.timestamp <= raiseEndTime) return State.Funding;
        if (totalRaised < SOFT_CAP) return State.Failed;
        if (!isFinalized) return State.Success_Isolated;
        return State.Ready_For_DEX;
    }

    // ---- Claims ----

    function claimTokens() external {
        require(currentState() == State.Ready_For_DEX, "!ready");
        uint256 a = contributions[msg.sender];
        require(a > 0, "!contrib");
        contributions[msg.sender] = 0;
        projectToken.transfer(msg.sender, (a * RETAIL_POOL) / totalRaised);
    }

    /// @notice Refund ETH to contributors.  Available when: (a) soft cap was never
    ///  met (Failed), OR (b) soft cap was met but the owner did not finalize
    ///  within the 30-day LAUNCH_WINDOW, OR (c) the owner announced but failed
    ///  to finalize within the 24h LAUNCH_EXPIRATION after the 6h notice period.
    function claimRefund() external {
        State s = currentState();
        require(
            s == State.Failed ||
            (s == State.Success_Isolated &&
             block.timestamp > raiseEndTime + LAUNCH_WINDOW) ||
            (s == State.Success_Isolated &&
             launchAnnouncementTime > 0 &&
             block.timestamp > launchAnnouncementTime + PRE_LAUNCH_NOTICE + LAUNCH_EXPIRATION),
            "Refund not available"
        );
        uint256 a = contributions[msg.sender];
        require(a > 0, "!funds");
        contributions[msg.sender] = 0;
        (bool ok, ) = payable(msg.sender).call{value: a}("");
        require(ok, "!refund");
    }

    // ---- Anti-Stealth Launch: 6-hour public notice ----

    function announceLaunch() external {
        require(msg.sender == projectOwner, "!owner");
        require(block.timestamp > raiseEndTime || totalRaised >= SOFT_CAP, "Raise not finished");
        require(totalRaised >= SOFT_CAP, "!cap");
        require(!isFinalized, "!done");
        require(launchAnnouncementTime == 0, "Already announced");
        launchAnnouncementTime = block.timestamp;
    }

    // ---- Finalization: Pool Creation + LP Lock + Fee Settlement ----

    function finalizeFunding() external {
        require(msg.sender == projectOwner, "!owner");
        require(
            launchAnnouncementTime > 0 &&
            block.timestamp >= launchAnnouncementTime + PRE_LAUNCH_NOTICE,
            "6h notice required"
        );
        require(
            block.timestamp <= launchAnnouncementTime + PRE_LAUNCH_NOTICE + LAUNCH_EXPIRATION,
            "Launch expired after notice"
        );
        require(block.timestamp <= raiseEndTime + LAUNCH_WINDOW, "Launch window expired");
        require(totalRaised >= SOFT_CAP, "!cap");
        require(!isFinalized, "!done");
        isFinalized = true;

        // Cache storage read — saves ~2100 gas per avoided SLOAD
        uint256 raised = totalRaised;

        uint256 fee;
        uint256 ethForPool;
        unchecked {
            fee        = (raised * PLATFORM_FEE_PCT) / 100;
            ethForPool = raised - fee;
        }
        uint256 tokensForPool = LP_POOL;

        // 1. Wrap ETH -> WETH, approve Position Manager
        IWETH(weth).deposit{value: ethForPool}();
        IWETH(weth).approve(positionManager, ethForPool);
        projectToken.approve(positionManager, tokensForPool);

        // 2. Sort tokens (Uniswap requires token0 < token1 by address)
        bool tkn0 = address(projectToken) < weth;
        address t0 = tkn0 ? address(projectToken) : weth;
        address t1 = tkn0 ? weth : address(projectToken);
        uint256 a0 = tkn0 ? tokensForPool : ethForPool;
        uint256 a1 = tkn0 ? ethForPool    : tokensForPool;

        // 3. sqrtPriceX96 = sqrt(amount1 / amount0) * 2^96
        uint160 sqrtPrice = uint160(
            (Math.sqrt(a1) << 96) / Math.sqrt(a0)
        );

        // 4. Create & initialize the pool
        INonfungiblePositionManager pm =
            INonfungiblePositionManager(positionManager);
        address pool = pm.createAndInitializePoolIfNecessary(
            t0, t1, FEE_TIER, sqrtPrice
        );

        IUniswapV3Pool(pool).increaseObservationCardinalityNext(100);

        // 5. Mint full-range LP; NFT stays in THIS contract (Protocol Owned Liquidity)
        (uint256 tokenId,,,) = pm.mint(
            INonfungiblePositionManager.MintParams({
                token0: t0,
                token1: t1,
                fee: FEE_TIER,
                tickLower: TICK_LOW,
                tickUpper: TICK_HIGH,
                amount0Desired: a0,
                amount1Desired: a1,
                amount0Min: 0,
                amount1Min: 0,
                recipient: address(this),
                deadline: block.timestamp
            })
        );

        // 6. Store LP NFT id & record pool for the inflation engine
        lpTokenId   = tokenId;
        uniswapPool = pool;
        (, int24 tick,,,,,) = IUniswapV3Pool(pool).slot0();
        initialTick = tick;

        // 7. LAST — send 5% platform fee AFTER pool is fully settled
        (bool f1, ) = payable(platformTreasury).call{value: fee}("");
        require(f1, "!fee");
    }

    // ---- Fee Collection (treasury only, principal locked forever) ----

    function collectTradingFees() external {
        require(msg.sender == platformTreasury, "!treasury");
        require(lpTokenId != 0, "!lp");
        INonfungiblePositionManager(positionManager).collect(
            INonfungiblePositionManager.CollectParams({
                tokenId:    lpTokenId,
                recipient:  platformTreasury,
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            })
        );
    }

    // ---- PoP Continuous Inflation Engine ----

    function getTWAP() public view returns (int24) {
        require(uniswapPool != address(0), "!pool");
        uint32[] memory secs = new uint32[](2);
        secs[0] = TWAP_INTERVAL;
        secs[1] = 0;
        (int56[] memory tc, ) = IUniswapV3Pool(uniswapPool).observe(secs);
        return int24((tc[1] - tc[0]) / int56(int32(TWAP_INTERVAL)));
    }

    /// @dev S(P) = S0 * (P/P0)^0.15 = S0 * exp(0.15 * dTick * ln(1.0001))
    function calculateTargetSupply(int24 tick) public view returns (uint256) {
        int256 d = int256(tick) - int256(initialTick);
        if (d <= 0) return INITIAL_SUPPLY;
        uint256 e = (EXPONENT_015 * uint256(d) * LN_1_0001) / 1e18;
        return ud(INITIAL_SUPPLY).mul(ud(e).exp()).unwrap();
    }

    function mintInflation() external {
        require(isFinalized, "!fin");
        require(uniswapPool != address(0), "!pool");
        require(block.timestamp >= lastMintTime + MINT_COOLDOWN, "!cd");
        int24 t = getTWAP();
        uint256 target  = calculateTargetSupply(t);
        uint256 current = projectToken.totalSupply();
        require(target > current, "!inf");
        uint256 m  = target - current;
        lastMintTime = block.timestamp;
        uint256 cr = (m * CALLER_REWARD_BPS) / 10_000;
        projectToken.mint(projectOwner, m - cr);
        if (cr > 0) projectToken.mint(msg.sender, cr);
    }
}

// ---------- MeritX Factory -- Permissionless Genesis ----------
contract MeritXFactory {
    address[] public allDeployedProjects;
    address public immutable platformTreasury;
    address public immutable backendSigner;
    address public immutable positionManager;
    address public immutable weth;

    // Listing fee aligned to 0.01 ETH
    uint256 public constant LISTING_FEE = 0.01 ether;

    // Constructor accepts an explicit Protocol Treasury address (decoupled from deployer)
    constructor(address _signer, address _pm, address _weth, address _treasury) {
        platformTreasury = _treasury;
        backendSigner    = _signer;
        positionManager  = _pm;
        weth             = _weth;
    }

    function launchNewProject(
        string memory _name,
        string memory _symbol,
        string memory _ipfsURI
    ) external payable returns (address) {
        require(msg.value == LISTING_FEE, "!fee");
        if (msg.value > 0) {
            (bool ok, ) = payable(platformTreasury).call{value: msg.value}("");
            require(ok, "!xfer");
        }
        MeritXFund f = new MeritXFund(
            msg.sender, _name, _symbol,
            platformTreasury, backendSigner, positionManager, weth,
            _ipfsURI
        );
        allDeployedProjects.push(address(f));
        return address(f);
    }

    function getAllProjects() external view returns (address[] memory) {
        return allDeployedProjects;
    }
}