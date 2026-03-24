import { glassPanel } from '../constants/styles';

export default function SettingsPage({ sellerId, loginMode }) {
  return (
    <div className="max-w-2xl mx-auto h-full w-full">
      <div className={`${glassPanel} p-8 flex flex-col gap-6`}>
        <h3 className="text-xl font-extrabold border-b border-white/50 pb-4 text-slate-800">Connection Settings</h3>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Login Mode</label>
          <p className="font-bold text-blue-600 bg-white/50 px-4 py-2 rounded-xl border border-white/60 inline-block">{loginMode.toUpperCase()}</p>
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Active Seller ID (추출 정보)</label>
          <div className="font-extrabold text-slate-700 text-sm bg-white/50 px-4 py-3 rounded-2xl border border-white/60 shadow-sm font-mono">
            {sellerId || '미설정'}
          </div>
        </div>
      </div>
    </div>
  );
}
