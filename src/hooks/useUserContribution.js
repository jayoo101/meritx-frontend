'use client';

import { useEffect, useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { FUND_ABI } from '@/lib/abis';

/**
 * Hook: Fetch the connected user's contribution for a given fund.
 * Requires window.ethereum (wallet) and account to be set.
 * @param {string} fundAddress - Fund contract address
 * @param {string} account - Connected wallet address
 * @returns {{ contribution: number, isLoading: boolean, refresh: () => Promise<void> }}
 */
export function useUserContribution(fundAddress, account) {
  const [contribution, setContribution] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // [PERFORMANCE FIX] Wrapped in useCallback to prevent recreation on every render
  const refresh = useCallback(async () => {
    if (!fundAddress || !account || typeof window === 'undefined' || !window.ethereum) {
      setContribution(0);
      return;
    }
    if (!ethers.utils.isAddress(fundAddress) || !ethers.utils.isAddress(account)) {
      setContribution(0);
      return;
    }

    setIsLoading(true);
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contract = new ethers.Contract(fundAddress, FUND_ABI, provider);
      const raw = await contract.contributions(account);
      setContribution(Number(ethers.utils.formatEther(raw)));
    } catch {
      setContribution(0);
    } finally {
      setIsLoading(false);
    }
  }, [fundAddress, account]);

  // [PERFORMANCE FIX] Cancellation flag prevents setState on unmounted component
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!fundAddress || !account) return;
      await refresh();
    })();
    return () => { cancelled = true; };
  }, [refresh]);

  return { contribution, isLoading, refresh };
}
