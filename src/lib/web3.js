// [AUDIT FIX] H3: Mark as client module — accesses window.ethereum
'use client';

import { ethers } from 'ethers';
import toast from 'react-hot-toast';

/**
 * Returns true if a browser wallet is available, false with a toast otherwise.
 */
export function requireWallet() {
  if (typeof window === 'undefined' || !window.ethereum) {
    toast.error('Please connect a wallet first.');
    return false;
  }
  return true;
}

/**
 * Creates a Web3Provider → signer → Contract in one call.
 * @param {string} address - Contract address
 * @param {string[]} abi    - Human-readable ABI array
 * @returns {{ provider, signer, contract }}
 */
export function getSignerContract(address, abi) {
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const signer = provider.getSigner();
  const contract = new ethers.Contract(address, abi, signer);
  return { provider, signer, contract };
}

/**
 * Creates a read-only Contract backed by the user's provider (no signer).
 */
export function getReadContract(address, abi) {
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  return new ethers.Contract(address, abi, provider);
}

/**
 * Standardized transaction error handler.
 * Returns a user-friendly error string. Optionally shows a toast.
 */
export function handleTxError(err, { showToast = true } = {}) {
  if (err?.code === 'ACTION_REJECTED' || err?.code === 4001) {
    const msg = 'Transaction cancelled by user.';
    if (showToast) toast.error(msg);
    return msg;
  }

  if (err?.message?.includes('insufficient')) {
    const msg = 'Insufficient ETH balance for this transaction.';
    if (showToast) toast.error(msg);
    return msg;
  }

  const reason =
    err?.reason ||
    err?.error?.reason ||
    err?.data?.message ||
    err?.message ||
    'Unknown error';

  const msg = `Transaction failed: ${reason}`;
  if (showToast) toast.error(reason);
  return msg;
}
