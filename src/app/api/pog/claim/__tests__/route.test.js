import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ethers } from 'ethers';

// ── Deterministic test wallet ──
const TEST_PRIVATE_KEY = '0x' + 'ab'.repeat(32);
const TEST_WALLET = new ethers.Wallet(TEST_PRIVATE_KEY);
const TEST_SIGNER_ADDRESS = TEST_WALLET.address;
const TEST_POG_CONTRACT = '0x8853a37522c7f3f02e3d1875d023913f41f41b3d';
const TEST_USER = '0x6769dddbad30b5fe28cbaa9d693c22df0c233600';

// ── Helpers ──

function makeRequest(body) {
  return new Request('http://localhost:3000/api/pog/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function parseResponse(res) {
  return { status: res.status, body: await res.json() };
}

/**
 * Build a mock fetch that intercepts JSON-RPC eth_getTransactionCount
 * and returns a configurable txCount hex string.
 */
function createRpcMock(txCountHex = '0x0') {
  return async (url, opts) => {
    if (typeof url === 'string' && opts?.method === 'POST') {
      const parsed = JSON.parse(opts.body);
      if (parsed.method === 'eth_getTransactionCount') {
        return new Response(
          JSON.stringify({ jsonrpc: '2.0', id: 1, result: txCountHex }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
    return new Response('Not Found', { status: 404 });
  };
}

/**
 * Set the env and fetch mock, then dynamically import the route.
 * vi.resetModules() ensures CHAIN_RPCS re-evaluates from fresh process.env.
 */
async function loadRoute(envOverrides = {}, txCountHex = '0x0') {
  vi.resetModules();

  // Wipe all POG_RPC_* so only the overrides take effect
  delete process.env.POG_RPC_ETHEREUM;
  delete process.env.POG_RPC_BASE;
  delete process.env.POG_RPC_ARBITRUM;
  delete process.env.POG_RPC_OPTIMISM;
  delete process.env.POG_RPC_POLYGON;
  delete process.env.BACKEND_PRIVATE_KEY_FOR_POG;
  delete process.env.NEXT_PUBLIC_POG_NFT_ADDRESS;
  delete process.env.NEXT_PUBLIC_POG_CHAIN_ID;

  Object.assign(process.env, envOverrides);

  vi.stubGlobal('fetch', vi.fn(createRpcMock(txCountHex)));

  const mod = await import('../route.js');
  return mod.POST;
}

// ────────────────────────────────────────────────────────────

describe('/api/pog/claim', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── 503: No RPCs ──
  describe('503 — no RPC endpoints', () => {
    it('returns 503 when all RPC env vars are empty', async () => {
      const POST = await loadRoute({
        BACKEND_PRIVATE_KEY_FOR_POG: TEST_PRIVATE_KEY,
        NEXT_PUBLIC_POG_NFT_ADDRESS: TEST_POG_CONTRACT,
      });

      const { status, body } = await parseResponse(await POST(makeRequest({ userAddress: TEST_USER })));

      expect(status).toBe(503);
      expect(body.success).toBe(false);
      expect(body.error).toMatch(/not configured/i);
    });
  });

  // ── 500: Missing signer key ──
  describe('500 — missing signer key', () => {
    it('returns 500 when BACKEND_PRIVATE_KEY_FOR_POG is missing', async () => {
      const POST = await loadRoute({
        POG_RPC_ETHEREUM: 'https://rpc.test',
        NEXT_PUBLIC_POG_NFT_ADDRESS: TEST_POG_CONTRACT,
      });

      const { status, body } = await parseResponse(await POST(makeRequest({ userAddress: TEST_USER })));

      expect(status).toBe(500);
      expect(body.error).toMatch(/signer key/i);
    });
  });

  // ── 400: Bad input ──
  describe('400 — invalid input', () => {
    it('returns 400 for missing userAddress', async () => {
      const POST = await loadRoute({
        POG_RPC_ETHEREUM: 'https://rpc.test',
        BACKEND_PRIVATE_KEY_FOR_POG: TEST_PRIVATE_KEY,
        NEXT_PUBLIC_POG_NFT_ADDRESS: TEST_POG_CONTRACT,
      });

      const { status, body } = await parseResponse(await POST(makeRequest({})));

      expect(status).toBe(400);
      expect(body.success).toBe(false);
    });

    it('returns 400 for a non-address string', async () => {
      const POST = await loadRoute({
        POG_RPC_ETHEREUM: 'https://rpc.test',
        BACKEND_PRIVATE_KEY_FOR_POG: TEST_PRIVATE_KEY,
        NEXT_PUBLIC_POG_NFT_ADDRESS: TEST_POG_CONTRACT,
      });

      const { status, body } = await parseResponse(
        await POST(makeRequest({ userAddress: 'not-an-address' }))
      );

      expect(status).toBe(400);
      expect(body.error).toMatch(/invalid/i);
    });
  });

  // ── 403: Zero-gas wallet ──
  describe('403 — zero-gas wallet', () => {
    it('returns 403 when user has 0 transactions', async () => {
      const POST = await loadRoute(
        {
          POG_RPC_ETHEREUM: 'https://rpc.test',
          POG_RPC_BASE: 'https://rpc.test',
          BACKEND_PRIVATE_KEY_FOR_POG: TEST_PRIVATE_KEY,
          NEXT_PUBLIC_POG_NFT_ADDRESS: TEST_POG_CONTRACT,
        },
        '0x0'
      );

      const { status, body } = await parseResponse(await POST(makeRequest({ userAddress: TEST_USER })));

      expect(status).toBe(403);
      expect(body.success).toBe(false);
      expect(body.error).toMatch(/insufficient/i);
      expect(body.gasData.totalGas).toBe(0);
      expect(body.gasData.totalTxCount).toBe(0);
    });

    it('returns 403 when total gas is below 0.001 threshold', async () => {
      // 1 tx × 0.00042 = 0.00042 ETH — below 0.001
      const POST = await loadRoute(
        {
          POG_RPC_ETHEREUM: 'https://rpc.test',
          BACKEND_PRIVATE_KEY_FOR_POG: TEST_PRIVATE_KEY,
          NEXT_PUBLIC_POG_NFT_ADDRESS: TEST_POG_CONTRACT,
        },
        '0x1'
      );

      const { status, body } = await parseResponse(await POST(makeRequest({ userAddress: TEST_USER })));

      expect(status).toBe(403);
      expect(body.success).toBe(false);
      expect(body.gasData.totalGas).toBeLessThan(0.001);
    });
  });

  // ── 200: Valid signature ──
  describe('200 — valid signature', () => {
    const baseEnv = {
      POG_RPC_ETHEREUM: 'https://rpc.test',
      POG_RPC_BASE: 'https://rpc.test',
      BACKEND_PRIVATE_KEY_FOR_POG: TEST_PRIVATE_KEY,
      NEXT_PUBLIC_POG_NFT_ADDRESS: TEST_POG_CONTRACT,
      NEXT_PUBLIC_POG_CHAIN_ID: '84532',
    };

    it('returns a valid ECDSA signature for a user with sufficient gas', async () => {
      // 500 txs × 0.00042 = 0.21 ETH gas
      const POST = await loadRoute(baseEnv, '0x1f4');

      const { status, body } = await parseResponse(await POST(makeRequest({ userAddress: TEST_USER })));

      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.signature).toMatch(/^0x[0-9a-fA-F]{130}$/);
      expect(body.signerAddress).toBe(TEST_SIGNER_ADDRESS);
      expect(body.gasData.totalGas).toBeGreaterThan(0.001);
      expect(body.baseScoreInt).toBeGreaterThan(0);
      expect(body.tierResolved).toBeDefined();
      expect(body.meritAllocation).toBeGreaterThan(0);
    });

    it('resolves CARBON ORACLE tier for high-activity wallets', async () => {
      // 10000 txs × 0.00042 = 4.2 ETH → sqrt capped to 1.0 → 10000 score ≥ 9000
      const POST = await loadRoute(baseEnv, '0x2710');

      const { status, body } = await parseResponse(await POST(makeRequest({ userAddress: TEST_USER })));

      expect(status).toBe(200);
      expect(body.tierResolved).toBe('CARBON ORACLE');
      expect(body.meritAllocation).toBe(100_000);
    });

    it('uses AddressZero when no inviter is provided', async () => {
      const POST = await loadRoute(baseEnv, '0x1f4');

      const { status, body } = await parseResponse(await POST(makeRequest({ userAddress: TEST_USER })));

      expect(status).toBe(200);
      expect(body.inviter).toBe(ethers.constants.AddressZero);
    });

    it('accepts a valid inviter address', async () => {
      const inviter = '0x1111111111111111111111111111111111111111';
      const POST = await loadRoute(baseEnv, '0x1f4');

      const { status, body } = await parseResponse(
        await POST(makeRequest({ userAddress: TEST_USER, inviterAddress: inviter }))
      );

      expect(status).toBe(200);
      expect(body.inviter).toBe(ethers.utils.getAddress(inviter));
    });

    it('produces a signature that recovers to the correct signer', async () => {
      const POST = await loadRoute(baseEnv, '0x1f4');

      const { status, body } = await parseResponse(await POST(makeRequest({ userAddress: TEST_USER })));
      expect(status).toBe(200);

      const msgHash = ethers.utils.solidityKeccak256(
        ['uint256', 'address', 'address', 'uint256', 'address'],
        [
          84532,
          ethers.utils.getAddress(TEST_POG_CONTRACT),
          ethers.utils.getAddress(TEST_USER),
          body.baseScoreInt,
          body.inviter,
        ]
      );
      const recovered = ethers.utils.verifyMessage(ethers.utils.arrayify(msgHash), body.signature);

      expect(recovered).toBe(TEST_SIGNER_ADDRESS);
    });
  });
});
