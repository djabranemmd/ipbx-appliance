import type { SummaryExtension } from '../lib/types';

function describe({ enabled, live }: SummaryExtension): { label: string; style: string } {
  if (!enabled) return { label: 'Disabled', style: 'bg-slate-200 text-slate-600' };
  if (!live.registered) return { label: 'Offline', style: 'bg-slate-100 text-slate-500' };

  switch (live.state) {
    case 'idle':
      return { label: 'Online', style: 'bg-emerald-100 text-emerald-700' };
    case 'ringing':
      return { label: 'Ringing', style: 'bg-amber-100 text-amber-700' };
    case 'busy':
      return { label: 'In call', style: 'bg-sky-100 text-sky-700' };
    case 'unavailable':
      // registered, but the phone does not answer asterisk's keep-alive probes
      return { label: 'Unreachable', style: 'bg-rose-100 text-rose-700' };
    default:
      return { label: 'Unknown', style: 'bg-slate-100 text-slate-500' };
  }
}

export default function StatusBadge({ extension }: { extension: SummaryExtension }) {
  const { label, style } = describe(extension);
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>{label}</span>;
}