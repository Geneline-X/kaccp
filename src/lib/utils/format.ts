export function formatDuration(sec: number): string {
  if (sec < 60) return `${Math.round(sec)}s`;
  const totalMin = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  if (totalMin < 60) return s > 0 ? `${totalMin}m ${s}s` : `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
