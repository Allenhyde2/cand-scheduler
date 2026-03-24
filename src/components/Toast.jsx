export default function Toast({ toast }) {
  if (!toast.visible) return null;
  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 animate-fade-in-fast z-[2000]">
      <div className={`px-6 py-3.5 rounded-2xl backdrop-blur-md shadow-xl border border-white/20 text-sm font-bold text-white tracking-wide ${toast.type === 'error' ? 'bg-red-500/90' : toast.type === 'warning' ? 'bg-yellow-500/90' : 'bg-slate-800/90'}`}>
        {typeof toast.message === 'string' ? toast.message : JSON.stringify(toast.message)}
      </div>
    </div>
  );
}
