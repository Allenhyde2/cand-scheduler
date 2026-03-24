import GlassSelect from '../components/GlassSelect';
import GlassDateTimePicker from '../components/GlassDateTimePicker';
import { glassInput, glassButtonSecondary, colorVariants, statusOptions, displayOptions } from '../constants/styles';

export default function TaskEditModal({ editModal, setEditModal, onConfirm, onClose }) {
  if (!editModal.isOpen) return null;
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white/90 backdrop-blur-2xl rounded-3xl w-full max-w-md p-8 shadow-2xl z-10 border border-white/50 relative animate-fade-in-fast">
        <h3 className="text-xl font-extrabold mb-6 text-slate-800 border-b border-slate-200 pb-3 font-sans">예약 수정</h3>
        <div className="space-y-5 mb-8">
          <div className="bg-white/50 p-4 rounded-xl border border-white/60"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">대상 상품</label><p className="text-sm font-extrabold text-slate-700">{editModal.task.productName}</p></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block">상태 변경</label><GlassSelect value={editModal.status} options={statusOptions} onChange={v => setEditModal({...editModal, status: v})} /></div>
            <div><label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">진열 여부</label><GlassSelect value={editModal.isDisplayed} options={displayOptions} onChange={v => setEditModal({...editModal, isDisplayed: v})} /></div>
          </div>
          <div className="relative">
            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block">시각 변경</label>
            <div onClick={() => setEditModal({...editModal, isDatePickerOpen: true})} className={glassInput + " cursor-pointer flex justify-between items-center group"}>
              <span className="font-extrabold text-slate-800">{editModal.date && editModal.time ? new Date(`${editModal.date}T${editModal.time}`).toLocaleString() : '시각 선택'}</span>
              <span>📅</span>
            </div>
            {editModal.isDatePickerOpen && (
              <>
                <div className="fixed inset-0 z-[900]" onClick={() => setEditModal({...editModal, isDatePickerOpen: false})}></div>
                <div className="absolute top-1/2 right-12 -translate-y-1/2 -mt-28 z-[1000]">
                  <GlassDateTimePicker date={editModal.date} time={editModal.time} onDateChange={d => setEditModal(prev => ({...prev, date: d}))} onTimeChange={t => setEditModal(prev => ({...prev, time: t}))} onConfirm={(d, t) => setEditModal(prev => ({...prev, date: d || prev.date, time: t || prev.time, isDatePickerOpen: false}))} onCancel={() => setEditModal(prev => ({...prev, isDatePickerOpen: false}))} />
                </div>
              </>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
          <button onClick={onClose} className={glassButtonSecondary}>취소</button>
          <button onClick={onConfirm} className={`px-6 py-2.5 rounded-xl font-extrabold shadow-md transition-all ${colorVariants.blue}`}>수정 저장하기</button>
        </div>
      </div>
    </div>
  );
}
