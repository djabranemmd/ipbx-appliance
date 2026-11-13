const pad = (n: number) => String(n).padStart(2, '0');

// 75 -> "1:15", 3700 -> "1:01:40"
export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

// 93784 -> "1d 2h 3m"
export function formatUptime(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return minutes > 0 ? `${minutes}m` : `${totalSeconds}s`;
}

// "101/sip:101@192.168.2.5:5060" -> "192.168.2.5:5060"
export function contactAddress(contact: string | undefined): string {
  if (!contact) return '';
  return /@([^;>]+)/.exec(contact)?.[1] ?? contact;
}