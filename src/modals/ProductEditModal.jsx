import { glassInput, glassButtonSecondary, colorVariants } from '../constants/styles';

export default function ProductEditModal({ productEditModal, setProductEditModal, onClose, onSave }) {
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white/90 backdrop-blur-2xl rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/50 relative z-10">
        <div className="px-6 py-5 border-b border-white/40 flex justify-between items-center bg-white/30 shrink-0">
          <h3 className="text-lg font-extrabold text-slate-800 font-sans">상품 정보 즉시 수정</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-800 transition"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg></button>
        </div>
        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
          <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1 block">상품명</label><input type="text" value={productEditModal.name} onChange={e => setProductEditModal({...productEditModal, name: e.target.value})} className={glassInput} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1 block">가격 (KRW)</label><input type="number" value={productEditModal.price} onChange={e => setProductEditModal({...productEditModal, price: e.target.value})} className={`${glassInput} font-mono`} /></div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1 block">재고 설정</label>
              <div className="flex items-center gap-4 bg-white/50 px-4 py-3 rounded-2xl border border-white/60 mb-2 shadow-sm">
                <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer text-slate-700"><input type="radio" name="stype" checked={productEditModal.stockType === 'unlimited'} onChange={() => setProductEditModal({...productEditModal, stockType: 'unlimited', stockCount: ''})} /> 무제한</label>
                <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer text-slate-700"><input type="radio" name="stype" checked={productEditModal.stockType === 'limited'} onChange={() => setProductEditModal({...productEditModal, stockType: 'limited'})} /> 수량제한</label>
              </div>
              {productEditModal.stockType === 'limited' && <input type="number" value={productEditModal.stockCount} onChange={e => setProductEditModal({...productEditModal, stockCount: e.target.value})} className={glassInput + " font-mono"} placeholder="수량 입력" />}
            </div>
          </div>
          <div className="bg-white/40 p-5 rounded-2xl border border-white/60 shadow-inner">
            <h4 className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest mb-3 border-b border-white/50 pb-2 ml-1">표시 및 상태 설정</h4>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block ml-1">진열 여부</label>
                <div className="relative flex w-full p-1.5 bg-white/50 border border-white/60 rounded-2xl shadow-inner overflow-hidden cursor-pointer group">
                  <div
                    className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] rounded-xl transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] shadow-md overflow-hidden ${
                      productEditModal.isDisplayed === 'true'
                        ? 'left-1.5 bg-blue-500 shadow-blue-500/30'
                        : 'left-[calc(50%+3px)] bg-purple-500 shadow-purple-500/30'
                    }`}
                  >
                    <div className="absolute inset-0 -translate-x-full group-hover:translate-x-[250%] transition-transform duration-1000 ease-in-out bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12"></div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProductEditModal({...productEditModal, isDisplayed: 'true'})}
                    className={`relative z-10 flex-1 py-2.5 text-xs font-extrabold rounded-xl transition-all duration-300 active:scale-95 ${
                      productEditModal.isDisplayed === 'true' ? 'text-white drop-shadow-md' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    진열 표시
                  </button>
                  <button
                    type="button"
                    onClick={() => setProductEditModal({...productEditModal, isDisplayed: 'false'})}
                    className={`relative z-10 flex-1 py-2.5 text-xs font-extrabold rounded-xl transition-all duration-300 active:scale-95 ${
                      productEditModal.isDisplayed === 'false' ? 'text-white drop-shadow-md' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    숨김 (미진열)
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block ml-1">판매 상태</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-white/50 px-4 py-3 rounded-xl border border-white/60 shadow-sm">
                  {[ {l:'판매 예정', v:'scheduled'}, {l:'판매 중', v:'onSale'}, {l:'품절', v:'soldOut'}, {l:'종료', v:'completed'} ].map(s => (
                    <label key={s.v} className="flex items-center gap-1.5 text-xs cursor-pointer font-bold text-slate-700 hover:text-blue-600 transition-colors">
                      <input type="radio" name="editStatus" value={s.v} checked={productEditModal.status === s.v} onChange={e => setProductEditModal({...productEditModal, status: e.target.value})} className="accent-blue-600 w-3.5 h-3.5" /> {s.l}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1 block">상세 설명</label><textarea value={productEditModal.description} onChange={e => setProductEditModal({...productEditModal, description: e.target.value})} className={glassInput + " resize-none h-24 custom-scrollbar"} /></div>
        </div>
        <div className="px-6 py-5 border-t border-white/40 flex justify-end gap-2 bg-white/30 shrink-0">
          <button onClick={onClose} className={glassButtonSecondary}>취소</button>
          <button onClick={onSave} className={`px-6 py-2.5 text-sm rounded-xl shadow-md font-extrabold transition-all ${colorVariants.blue}`}>변경 저장하기</button>
        </div>
      </div>
    </div>
  );
}
