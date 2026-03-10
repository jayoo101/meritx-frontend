/**
 * Format an ETH value to a fixed number of decimal places.
 * Accepts number or string. Returns string like "0.0150".
 */
export function fmtEth(value, decimals = 4) {
  const num = Number(value) || 0;
  return num.toFixed(decimals);
}

/**
 * Truncate an address to 0x1234...ABCD format.
 * @param {string} addr - Full address
 * @param {number} start - Characters to keep from start (default 6, includes 0x)
 * @param {number} end - Characters to keep from end (default 4)
 */
export function truncAddr(addr, start = 6, end = 4) {
  if (!addr || addr.length < start + end + 3) return addr || '';
  return `${addr.slice(0, start)}...${addr.slice(-end)}`;
}
