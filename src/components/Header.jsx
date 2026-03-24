import { glassPanel } from '../constants/styles';

export default function Header({ activeTab, sellerId, loginMode, isSidebarOpen, onToggleSidebar }) {
  const titles = {
    productList: '상품 보드',
    schedule: '상태 예약 변경',
    history: '작업 처리 내역',
    settings: '환경 설정'
  };

  return (
    <header className={`${glassPanel} p-3 md:p-4 px-4 md:px-6 flex items-center justify-between shrink-0 min-h-[4rem] md:h-20 relative z-30`}>
      <div className="flex items-center gap-3 md:gap-4 w-full md:w-auto">
        <button onClick={onToggleSidebar} className="shrink-0 w-9 h-9 md:w-10 md:h-10 flex items-center justify-center bg-white/50 hover:bg-white rounded-xl shadow-sm text-slate-600 transition-all">≡</button>
        <h2 className="text-lg md:text-xl font-extrabold text-slate-800 tracking-tight truncate">{titles[activeTab] || ''}</h2>
      </div>
      <div className="flex items-center gap-2">
        <span className="bg-white/60 border border-white/50 text-[10px] md:text-xs font-bold px-3 md:px-4 py-1.5 md:py-2.5 rounded-xl shadow-sm text-slate-600 truncate max-w-[120px]">ID: {sellerId || '미설정'}</span>
        <span className={`text-[10px] md:text-xs font-bold px-3 md:px-4 py-1.5 md:py-2.5 rounded-xl shadow-sm border ${loginMode === 'admin' ? 'bg-purple-100 border-purple-200 text-purple-700' : 'bg-blue-100 border-blue-200 text-blue-700'}`}>{loginMode.toUpperCase()}</span>
      </div>
    </header>
  );
}
