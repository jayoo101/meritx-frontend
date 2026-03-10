'use client';
import { useState, useEffect, useCallback } from 'react';
import { CHAIN_ID, CHAIN_ID_HEX, CHAIN_NAME, RPC_URL, EXPLORER_URL } from './constants';

export function useNetwork() {
  const [chainId, setChainId] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return;
    window.ethereum.request({ method: 'eth_chainId' })
      .then(id => setChainId(Number(id)))
      .catch(() => {});
    const handler = (id) => setChainId(Number(id));
    window.ethereum.on('chainChanged', handler);
    return () => window.ethereum.removeListener('chainChanged', handler);
  }, []);

  const isCorrectChain = chainId === null || chainId === CHAIN_ID;

  const switchToBase = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) return;
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: CHAIN_ID_HEX }],
      });
    } catch (err) {
      if (err?.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: CHAIN_ID_HEX,
              chainName: CHAIN_NAME,
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              rpcUrls: [RPC_URL],
              blockExplorerUrls: [EXPLORER_URL],
            }],
          });
        } catch {}
      }
    }
  }, []);

  return { chainId, isCorrectChain, switchToBase };
}
