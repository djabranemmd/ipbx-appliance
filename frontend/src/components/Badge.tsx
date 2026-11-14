type Tone = 'green' | 'slate' | 'amber' | 'rose' | 'sky';

const TONES: Record<Tone, string> = {
  green: 'bg-emerald-100 text-emerald-700',
  slate: 'bg-slate-100 text-slate-600',
  amber: 'bg-amber-100 text-amber-700',
  rose: 'bg-rose-100 text-rose-700',
  sky: 'bg-sky-100 text-sky-700',
};

export default function Badge({ tone, children }: { tone: Tone; children: string }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}>{children}</span>;
}