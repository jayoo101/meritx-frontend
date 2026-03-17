// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/// @title ProofOfGasNFT — 7-Day "Proof of Gas" Dynamic Identity NFT
/// @notice Self-contained ERC721 + ECDSA implementation (no OZ dependency)
contract ProofOfGasNFT {

    // ───────────────── ERC721 CORE ─────────────────

    string public constant name   = "Proof of Gas Identity";
    string public constant symbol = "PoGID";

    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    function balanceOf(address owner_) public view returns (uint256) {
        require(owner_ != address(0), "ERC721: zero address");
        return _balances[owner_];
    }

    function ownerOf(uint256 tokenId) public view returns (address) {
        address o = _owners[tokenId];
        require(o != address(0), "ERC721: nonexistent token");
        return o;
    }

    function approve(address to, uint256 tokenId) external {
        address o = ownerOf(tokenId);
        require(msg.sender == o || _operatorApprovals[o][msg.sender], "ERC721: !auth");
        require(to != o, "ERC721: approval to owner");

        _tokenApprovals[tokenId] = to;
        emit Approval(o, to, tokenId);
    }

    function getApproved(uint256 tokenId) public view returns (address) {
        require(_owners[tokenId] != address(0), "ERC721: nonexistent");
        return _tokenApprovals[tokenId];
    }

    function setApprovalForAll(address operator, bool approved_) external {
        _operatorApprovals[msg.sender][operator] = approved_;
        emit ApprovalForAll(msg.sender, operator, approved_);
    }

    function isApprovedForAll(address owner_, address operator) public view returns (bool) {
        return _operatorApprovals[owner_][operator];
    }

    function transferFrom(address from, address to, uint256 tokenId) public {
        require(_isApprovedOrOwner(msg.sender, tokenId), "ERC721: !auth");
        _transfer(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        require(to.code.length == 0, "PoG: no contract receiver");
        transferFrom(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata) external {
        require(to.code.length == 0, "PoG: no contract receiver");
        transferFrom(from, to, tokenId);
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x80ac58cd || interfaceId == 0x01ffc9a7 || interfaceId == 0x5b5e139f;
    }

    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
        address o = ownerOf(tokenId);
        return spender == o || _tokenApprovals[tokenId] == spender || _operatorApprovals[o][spender];
    }

    function _transfer(address from, address to, uint256 tokenId) internal {
        require(ownerOf(tokenId) == from, "ERC721: !owner");
        require(to != address(0), "ERC721: zero");

        delete _tokenApprovals[tokenId];

        _balances[from] -= 1;
        _balances[to]   += 1;

        _owners[tokenId] = to;

        emit Transfer(from, to, tokenId);
    }

    function _mint(address to, uint256 tokenId) internal {
        require(to != address(0), "ERC721: zero");
        require(_owners[tokenId] == address(0), "ERC721: exists");

        _balances[to] += 1;
        _owners[tokenId] = to;

        emit Transfer(address(0), to, tokenId);
    }

    // ───────────────── CAMPAIGN CONSTANTS ─────────────────

    uint256 public constant MINT_FEE        = 0.0005 ether;
    uint256 public constant CAMPAIGN_LENGTH = 7 days;

    // ───────────────── STATE ─────────────────

    address public owner;
    address public signerAddress;
    string  public baseMetadataURI;

    uint256 public startTime;
    uint256 public endTime;
    uint256 private _nextTokenId;

    mapping(address => bool)    public hasMinted;
    mapping(address => uint256) public baseScores;
    mapping(address => uint256) public referralBonuses;
    mapping(address => uint256) public tokenOfOwner;
    mapping(address => uint256) public inviteCount;

    // ───────────────── EVENTS ─────────────────

    event CampaignStarted(uint256 startTime, uint256 endTime);
    event IdentityMinted(address indexed minter, uint256 tokenId, uint256 baseScore, address inviter);
    event ReferralBonusAdded(address indexed inviter, uint256 bonus, address indexed referree);

    modifier onlyOwner() {
        require(msg.sender == owner, "PoG: !owner");
        _;
    }

    constructor(address _signer, string memory _baseURI, address _owner) {
        signerAddress   = _signer;
        baseMetadataURI = _baseURI;
        owner           = _owner;
        _nextTokenId    = 1;
    }

    // ───────────────── CAMPAIGN LIFECYCLE ─────────────────

    function startCampaign() external onlyOwner {
        require(startTime == 0, "PoG: campaign already started");

        startTime = block.timestamp;
        endTime   = block.timestamp + CAMPAIGN_LENGTH;

        emit CampaignStarted(startTime, endTime);
    }

    function campaignActive() external view returns (bool) {
        return startTime > 0 && block.timestamp >= startTime && block.timestamp <= endTime;
    }

    function campaignEnded() external view returns (bool) {
        return startTime > 0 && block.timestamp > endTime;
    }

    function totalMinted() external view returns (uint256) {
        return _nextTokenId - 1;
    }

    // ───────────────── MINT ─────────────────

    function mint(
        uint256 baseScore,
        address inviter,
        bytes calldata signature
    ) external payable {

        require(startTime > 0 && block.timestamp >= startTime, "PoG: campaign not started");
        require(block.timestamp <= endTime, "PoG: campaign ended");
        require(msg.value == MINT_FEE, "PoG: wrong mint fee");
        require(!hasMinted[msg.sender], "PoG: already minted");
        require(baseScore <= 10_000, "PoG: baseScore out of range");

        bytes32 h = keccak256(
            abi.encodePacked(
                block.chainid,
                address(this),
                msg.sender,
                baseScore,
                inviter
            )
        );

        require(_recover(h, signature) == signerAddress, "PoG: invalid signature");

        hasMinted[msg.sender]  = true;
        baseScores[msg.sender] = baseScore;

        uint256 tokenId = _nextTokenId++;
        tokenOfOwner[msg.sender] = tokenId;

        _mint(msg.sender, tokenId);

        if (inviter != address(0) && hasMinted[inviter] && inviter != msg.sender) {
            uint256 bonus = (baseScore * 8) / 100;

            referralBonuses[inviter] += bonus;
            inviteCount[inviter]     += 1;

            emit ReferralBonusAdded(inviter, bonus, msg.sender);
        }

        emit IdentityMinted(msg.sender, tokenId, baseScore, inviter);
    }

    // ───────────────── VIEWS ─────────────────

    function finalScore(address user) external view returns (uint256) {
        return baseScores[user] + referralBonuses[user];
    }

    function tokenURI(uint256 tokenId) public view returns (string memory) {
        require(_owners[tokenId] != address(0), "ERC721: nonexistent");

        return string(
            abi.encodePacked(
                baseMetadataURI,
                _toString(tokenId),
                ".json"
            )
        );
    }

    // ───────────────── ADMIN ─────────────────

    function withdrawFees() external onlyOwner {
        uint256 bal = address(this).balance;

        require(bal > 0, "PoG: nothing to withdraw");

        (bool ok, ) = payable(owner).call{value: bal}("");
        require(ok, "PoG: withdraw failed");
    }

    function setSignerAddress(address _signer) external onlyOwner {
        signerAddress = _signer;
    }

    function setBaseMetadataURI(string memory _uri) external onlyOwner {
        baseMetadataURI = _uri;
    }

    // ───────────────── ECDSA ─────────────────

    function _recover(bytes32 _h, bytes memory _s) internal pure returns (address) {

        bytes32 eh = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                _h
            )
        );

        require(_s.length == 65, "PoG: !siglen");

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := mload(add(_s, 32))
            s := mload(add(_s, 64))
            v := byte(0, mload(add(_s, 96)))
        }

        if (v < 27) v += 27;

        require(v == 27 || v == 28, "PoG: !v");

        address a = ecrecover(eh, v, r, s);

        require(a != address(0), "PoG: !rec");

        return a;
    }

    // ───────────────── UTILS ─────────────────

    function _toString(uint256 value) internal pure returns (string memory) {

        if (value == 0) return "0";

        uint256 temp = value;
        uint256 digits;

        while (temp != 0) {
            digits++;
            temp /= 10;
        }

        bytes memory buffer = new bytes(digits);

        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + value % 10));
            value /= 10;
        }

        return string(buffer);
    }
}