export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  const decimals = value >= 10 || exponent === 0 ? 0 : 1;
  const formatted = value.toFixed(decimals).replace(/\.0$/, '');
  return `${formatted} ${units[exponent]}`;
}

export function formatDuration(ms: number): string {
  return `${Math.round(ms)} ms`;
}

export function formatPercent(value: number): string {
  return `${Math.abs(value)}%`;
}
