import { glassButtonSecondary, colorVariants } from '../constants/styles';
import { translateStatus } from '../utils/status';

export default function ScheduleConfirmModal({ isOpen, scheduleForm, confirmedDateTime, onClose, onConfirm }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white/90 backdrop-blur-2xl rounded-3xl p-8 w-full max-w-md shadow-2xl z-10 border border-white/50 relative animate-fade-in-fast">
        <h3 className="text-xl font-extrabold mb-6 text-slate-800 border-b border-slate-200 pb-3 font-sans">예약을 등록할까요?</h3>
        <div className="space-y-3 bg-white/50 p-5 rounded-2xl border border-white/60 mb-8 shadow-inner overflow-y-auto max-h-48 custom-scrollbar">
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">대상 상품 내역</p>
          <div className="space-y-1">{scheduleForm.products.map(p => <div key={p.id} className="text-sm font-extrabold text-slate-700 flex justify-between"><span>• {p.name}</span><span className="text-[10px] text-slate-400 font-mono">{p.id}</span></div>)}</div>
          <div className="border-t border-slate-200 my-3 pt-3">
            <p className="text-sm flex justify-between font-bold text-slate-600"><span>변경 상태:</span> <span className="text-blue-600">{translateStatus(scheduleForm.status)}</span></p>
            <p className="text-sm flex justify-between font-bold text-slate-600"><span>진열 여부:</span> <span className="text-blue-600">{scheduleForm.isDisplayed === 'true' ? '표시' : '숨김'}</span></p>
            <p className="text-sm flex justify-between font-bold text-blue-700 mt-2 bg-blue-50 p-2 rounded-lg"><span>실행 시각:</span> <span>{new Date(confirmedDateTime).toLocaleString()}</span></p>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className={glassButtonSecondary}>취소</button>
          <button onClick={onConfirm} className={`px-6 py-2.5 rounded-xl font-extrabold shadow-lg transition-all ${colorVariants.blue}`}>전송 승인</button>
        </div>
      </div>
    </div>
  );
}
