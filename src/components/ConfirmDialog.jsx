import { colorVariants, glassButtonSecondary } from '../constants/styles';

export default function ConfirmDialog({ confirmDialog, onClose }) {
  if (!confirmDialog.visible) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
      <div className="bg-white/90 backdrop-blur-2xl rounded-3xl shadow-2xl p-6 w-full max-w-sm border border-white/50">
        <h3 className="text-lg font-extrabold text-slate-800 mb-2">확인</h3>
        <p className="text-slate-600 mb-6 font-medium">{typeof confirmDialog.message === 'string' ? confirmDialog.message : JSON.stringify(confirmDialog.message)}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className={glassButtonSecondary}>취소</button>
          <button onClick={confirmDialog.onConfirm} className={`px-5 py-2 rounded-xl font-bold shadow-md transition-all ${colorVariants.blue}`}>확인</button>
        </div>
      </div>
    </div>
  );
}
