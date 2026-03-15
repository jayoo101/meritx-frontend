'use client';

import { useCallback } from 'react';
import useSWR from 'swr';
import { ethers } from 'ethers';
import { RPC_URL } from '@/lib/constants';
import { FUND_ABI, TOKEN_ABI } from '@/lib/abis';
import { ipfsToHttp, fetchIPFSMetadata } from '@/lib/ipfs';

/**
 * Fetches all MeritX Fund contract state (read-only, no wallet required).
 * Uses JsonRpcProvider for public reads.
 */
async function fetchFundData(address) {
  if (!address || !ethers.utils.isAddress(address)) {
    throw new Error('Invalid fund address');
  }

  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const fund = new ethers.Contract(address, FUND_ABI, provider);

  const [
    tokenAddr,
    totalRaised,
    softCap,
    raiseEndTime,
    state,
    projectOwner,
    launchWindow,
    announceTime,
    noticeDur,
    expirationDur,
    ipfsURI,
  ] = await Promise.all([
    fund.projectToken(),
    fund.totalRaised(),
    fund.SOFT_CAP(),
    fund.raiseEndTime(),
    fund.currentState(),
    fund.projectOwner().catch(() => ethers.constants.AddressZero),
    fund.LAUNCH_WINDOW().catch(() => ethers.BigNumber.from(30 * 86400)),
    fund.launchAnnouncementTime().catch(() => ethers.BigNumber.from(0)),
    fund.PRE_LAUNCH_NOTICE().catch(() => ethers.BigNumber.from(21600)),
    fund.LAUNCH_EXPIRATION().catch(() => ethers.BigNumber.from(86400)),
    fund.ipfsURI().catch(() => ''),
  ]);

  const token = new ethers.Contract(tokenAddr, TOKEN_ABI, provider);
  const [name, symbol] = await Promise.all([token.name(), token.symbol()]);

  let avatarUrl = null;
  let description = '';
  let socials = {};
  let skillEndpoint = '';
  if (ipfsURI) {
    const meta = await fetchIPFSMetadata(ipfsURI);
    if (meta) {
      avatarUrl = meta.image ? ipfsToHttp(meta.image) : null;
      description = meta.description || '';
      socials = meta.socials || {};
      skillEndpoint = meta.skillEndpoint || '';
    }
  }

  const endSec = Number(raiseEndTime);
  const launchDeadlineMs = (endSec + Number(launchWindow)) * 1000;
  const announceSec = Number(announceTime);
  const noticeSec = Number(noticeDur);
  const expirationSec = Number(expirationDur);
  const noticeEndMs = announceSec > 0 ? (announceSec + noticeSec) * 1000 : 0;
  const launchExpirationMs = announceSec > 0 ? (announceSec + noticeSec + expirationSec) * 1000 : 0;

  return {
    address,
    name,
    symbol,
    tokenAddress: tokenAddr,
    state: Number(state),
    raised: ethers.utils.formatEther(totalRaised),
    softCap: ethers.utils.formatEther(softCap),
    totalRaised,
    rawSoftCap: softCap,
    endTime: endSec * 1000,
    raiseEndTime: endSec,
    launchDeadline: launchDeadlineMs,
    projectOwner,
    announcementTime: announceSec,
    noticeEndMs,
    launchExpirationMs,
    ipfsURI,
    avatarUrl,
    description,
    socials,
    skillEndpoint,
  };
}

/**
 * Hook: Fetch MeritX Fund contract data with SWR (caching, revalidation).
 * @param {string} address - Fund contract address
 * @returns {{ data, error, isLoading, mutate }}
 */
export function useFundData(address) {
  const key = address && ethers.utils.isAddress(address) ? ['meritx-fund', address] : null;

  const { data, error, isLoading, mutate } = useSWR(
    key,
    () => fetchFundData(address),
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      refreshInterval: 15_000,
      dedupingInterval: 5_000,
      errorRetryCount: 3,
    }
  );

  const refresh = useCallback(() => mutate(), [mutate]);

  return {
    project: data,
    loadError: error,
    isLoading: isLoading && !data,
    refresh,
    mutate,
  };
}
