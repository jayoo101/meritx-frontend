'use client';

import { useState, useEffect } from 'react';

/**
 * Hook: Get connected wallet account from window.ethereum.
 * @returns {{ account: string, connectWallet: () => Promise<void> }}
 */
export function useWallet() {
  const [account, setAccount] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return;
    window.ethereum
      .request({ method: 'eth_accounts' })
      .then((accounts) => {
        if (accounts?.[0]) setAccount(accounts[0]);
      })
      .catch(() => {});
  }, []);

  const connectWallet = async () => {
    if (typeof window === 'undefined' || !window.ethereum) return;
    try {
      await window.ethereum.request({
        method: 'wallet_requestPermissions',
        params: [{ eth_accounts: {} }],
      });
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts?.[0]) {
        setAccount(accounts[0]);
        localStorage.setItem('isWalletConnected', 'true');
      }
    } catch {
      throw new Error('Wallet connection failed');
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return;
    const handler = (accounts) => setAccount(accounts?.[0] ?? '');
    window.ethereum.on('accountsChanged', handler);
    return () => window.ethereum.removeListener('accountsChanged', handler);
  }, []);

  return { account, connectWallet };
}
