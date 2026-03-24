import { glassPanel, glassButtonSecondary } from '../constants/styles';

export default function HistoryPage({ historyLogs, isLoadingHistory, fetchHistoryLogs }) {
  return (
    <div className={`${glassPanel} flex flex-col h-full overflow-hidden`}>
      <div className="p-4 md:p-6 border-b border-white/40 flex justify-between items-center shrink-0">
        <h3 className="font-extrabold text-base md:text-lg text-slate-700">스케줄러 실행 결과 로그</h3>
        <button onClick={fetchHistoryLogs} disabled={isLoadingHistory} className={glassButtonSecondary}>
          {isLoadingHistory ? '불러오는 중...' : '새로고침'}
        </button>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar p-4 md:p-6 space-y-3">
        {isLoadingHistory ? (
          <div className="py-20 text-center text-slate-400 font-bold">AWS 서버에서 로그를 불러오는 중입니다...</div>
        ) : historyLogs.length === 0 ? (
          <div className="py-20 text-center text-slate-400 font-bold">기록된 작업 실행 내역이 없습니다.</div>
        ) : (
          historyLogs.map((log, idx) => (
            <div key={idx} className="p-4 bg-white/50 border border-white/60 shadow-sm rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-white/80 transition-all">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold text-white shadow-sm ${log.success ? 'bg-green-500' : 'bg-red-500'}`}>
                    {log.success ? '성공' : '에러'}
                  </span>
                  <span className="font-extrabold text-sm md:text-base text-slate-800">{log.productName || '알 수 없는 상품'}</span>
                </div>
                <p className="text-[10px] text-slate-500 font-mono">
                  {log.executedAt ? new Date(log.executedAt).toLocaleString() : '시간 기록 없음'}
                </p>
              </div>
              <div className="text-xs text-slate-600 bg-white/60 px-3 py-2 rounded-xl border border-white/50 shadow-inner max-w-md w-full md:w-auto break-words">
                {log.message || (log.success ? '예약된 상태 변경이 정상적으로 완료되었습니다.' : '알 수 없는 AWS 측 오류가 발생했습니다.')}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
