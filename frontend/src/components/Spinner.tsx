export default function Spinner({ fullPage = false }: { fullPage?: boolean }) {
  return (
    <div className={`flex items-center justify-center text-slate-500 ${fullPage ? 'min-h-screen' : 'py-10'}`}>
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-sky-600" />
      <span className="ml-3 text-sm">Loading…</span>
    </div>
  );
}