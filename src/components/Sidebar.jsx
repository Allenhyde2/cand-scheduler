import { glassPanel } from '../constants/styles';

export default function Sidebar({ activeTab, setActiveTab, isSidebarOpen, setIsSidebarOpen, indicatorStyle, navRef, onLogout, fetchHistoryLogs }) {
  const handleTabClick = (tab, extra) => {
    setActiveTab(tab);
    if (extra) extra();
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  return (
    <aside className={`${isSidebarOpen ? 'translate-x-0 w-64 opacity-100' : '-translate-x-full w-64 md:translate-x-0 md:w-0 md:opacity-0'} fixed md:relative inset-y-2 md:inset-y-0 left-2 md:left-0 z-50 h-[calc(100vh-1rem)] md:h-full shrink-0 ${glassPanel} flex flex-col transition-all duration-300 overflow-hidden shadow-2xl md:shadow-none`}>
      <div className="h-16 md:h-20 shrink-0 border-b border-white/40 bg-white/30 flex items-center justify-center">
        <span className="text-xl md:text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 tracking-tight">VAKEWork</span>
      </div>

      <nav ref={navRef} className="flex-1 overflow-y-auto p-4 space-y-2 relative isolate">
        <div
          className="absolute left-4 right-4 bg-white shadow-sm rounded-2xl transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] -z-10 border border-white/60"
          style={{ top: `${indicatorStyle.top}px`, height: `${indicatorStyle.height}px`, opacity: indicatorStyle.opacity }}
        />

        <div className="px-2 pt-2 pb-1"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Management</span></div>
        <button
          data-active={activeTab === 'productList'}
          onClick={() => handleTabClick('productList')}
          className={`w-full text-left px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 relative z-10 ${activeTab === 'productList' ? 'text-blue-600' : 'text-slate-600 hover:bg-white/50'}`}
        >
          상품 현황 보드
        </button>
        <button
          data-active={activeTab === 'schedule'}
          onClick={() => handleTabClick('schedule')}
          className={`w-full text-left px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 relative z-10 ${activeTab === 'schedule' ? 'text-blue-600' : 'text-slate-600 hover:bg-white/50'}`}
        >
          상태 예약 변경
        </button>
        <div className="px-2 pt-6 pb-1"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Logs</span></div>
        <button
          data-active={activeTab === 'history'}
          onClick={() => handleTabClick('history', fetchHistoryLogs)}
          className={`w-full text-left px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 relative z-10 ${activeTab === 'history' ? 'text-blue-600' : 'text-slate-600 hover:bg-white/50'}`}
        >
          실행 결과 로그 (History)
        </button>

        <div className="px-2 pt-6 pb-1"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">System</span></div>
        <button
          data-active={activeTab === 'settings'}
          onClick={() => handleTabClick('settings')}
          className={`w-full text-left px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 relative z-10 ${activeTab === 'settings' ? 'text-slate-800' : 'text-slate-600 hover:bg-white/50'}`}
        >
          환경 설정
        </button>
      </nav>

      <div className="p-4 border-t border-white/40 bg-white/30">
        <button onClick={onLogout} className="w-full py-3 text-sm text-red-500 font-extrabold bg-white/80 border border-red-200 hover:bg-red-500 hover:text-white hover:border-red-500 rounded-2xl transition-all duration-300 shadow-sm hover:shadow-lg hover:shadow-red-500/30 active:scale-95 flex items-center justify-center gap-2 group">
          <svg className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
          로그아웃
        </button>
      </div>
    </aside>
  );
}
