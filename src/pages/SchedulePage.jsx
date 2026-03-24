import GlassSelect from '../components/GlassSelect';
import GlassDateTimePicker from '../components/GlassDateTimePicker';
import { glassPanel, glassInput, glassButtonPrimary, glassButtonSecondary, colorVariants, statusOptions, displayOptions } from '../constants/styles';
import { translateStatus } from '../utils/status';

export default function SchedulePage({
  products, scheduleForm, setScheduleForm, productSearchTerm, setProductSearchTerm,
  isProductSelectOpen, setIsProductSelectOpen, productSelectRef, filteredProducts,
  handleSelectProduct, handleRemoveProduct, handleProductKeyDown, handlePreSubmit,
  isDatePickerOpen, setIsDatePickerOpen, pickerDate, pickerTime, setPickerDate, setPickerTime,
  handleConfirmDatePicker, confirmedDateTime, displayedTasks, fetchScheduledTasks,
  openEditModal, handleDeleteTask, isLoading
}) {
  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto custom-scrollbar pb-4 pr-1 relative">
      <div className={`shrink-0 ${glassPanel} p-5 md:p-6 flex flex-col relative z-20`}>
        <h3 className="font-extrabold text-base md:text-lg text-slate-800 mb-6">예약 생성기</h3>
        <form onSubmit={handlePreSubmit} className="space-y-4">
          <div className="relative z-[60]" ref={productSelectRef}>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">1. 대상 상품 검색 (다중)</label>
            <div className="relative">
              <input
                type="text"
                placeholder="상품명 또는 ID 입력"
                value={productSearchTerm}
                onChange={e => {setProductSearchTerm(e.target.value); setIsProductSelectOpen(true);}}
                onFocus={() => setIsProductSelectOpen(true)}
                onKeyDown={handleProductKeyDown}
                className={glassInput}
              />
              {isProductSelectOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white/90 backdrop-blur-2xl border border-white/60 shadow-xl rounded-2xl z-[70] max-h-56 overflow-y-auto p-2 animate-fade-in-fast">
                  {filteredProducts.map(p => (
                    <button key={p.id} type="button" onClick={() => handleSelectProduct(p)} className="w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-blue-50 transition-all mb-1 flex justify-between items-center">
                      <span className="font-bold text-slate-700 truncate">{p.name}</span>
                      <span className="text-[9px] text-slate-400 font-mono shrink-0">{p.id}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {scheduleForm.products.length > 0 && (
              <div className="mt-3 border border-white/50 rounded-2xl bg-white/30 backdrop-blur-md overflow-hidden shadow-inner relative group">
                <div className="max-h-[220px] overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-white/40 backdrop-blur-md border-b border-white/50 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">대상 상품</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">상태</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">진열</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center w-12">관리</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/30">
                      {scheduleForm.products.map(prod => (
                        <tr key={prod.id} className="hover:bg-white/40 transition-colors">
                          <td className="px-4 py-3 max-w-[140px] sm:max-w-[200px] truncate">
                            <p className="font-extrabold text-slate-700 truncate" title={prod.name}>{prod.name}</p>
                            <p className="text-[9px] text-slate-400 font-mono mt-0.5">{prod.id}</p>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white/50 shadow-sm border border-white/60 text-slate-600 inline-block">
                              {translateStatus(prod.status)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white/50 shadow-sm border border-white/60 text-slate-600 inline-block">
                              {prod.isDisplayed !== false ? '표시' : '숨김'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveProduct(prod.id)}
                              className="w-7 h-7 mx-auto flex items-center justify-center rounded-xl bg-white/50 border border-white/60 text-slate-400 hover:text-red-500 hover:bg-red-50 hover:border-red-200 transition-all shadow-sm active:scale-95"
                              title="목록에서 제거"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-[50]">
            <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">2. 변경 상태</label><GlassSelect value={scheduleForm.status} options={statusOptions} onChange={val => setScheduleForm({...scheduleForm, status: val})} /></div>
            <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">3. 진열 여부</label><GlassSelect value={scheduleForm.isDisplayed} options={displayOptions} onChange={val => setScheduleForm({...scheduleForm, isDisplayed: val})} /></div>
          </div>
          <div className="relative z-[40]">
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">4. 실행 일시</label>
            <div onClick={() => setIsDatePickerOpen(true)} className={glassInput + " cursor-pointer flex justify-between items-center group"}>
              <span className={confirmedDateTime ? 'text-slate-800 font-extrabold' : 'text-slate-400'}>{confirmedDateTime ? new Date(confirmedDateTime).toLocaleString() : '클릭하여 일시 선택'}</span>
              <span className="text-slate-400 group-hover:text-blue-500 transition-colors">📅</span>
            </div>
          </div>
          <button type="submit" className={glassButtonPrimary}>예약 정보 클라우드 전송</button>
        </form>

        {isDatePickerOpen && (
          <>
            <div className="fixed inset-0 z-[900]" onClick={() => setIsDatePickerOpen(false)}></div>
            <div className="absolute top-16 right-8 md:right-20 z-[1000]">
              <GlassDateTimePicker
                date={pickerDate}
                time={pickerTime}
                onDateChange={setPickerDate}
                onTimeChange={setPickerTime}
                onConfirm={handleConfirmDatePicker}
                onCancel={() => setIsDatePickerOpen(false)}
              />
            </div>
          </>
        )}
      </div>
      <div className={`flex-1 min-h-[400px] shrink-0 ${glassPanel} p-5 md:p-6 flex flex-col overflow-hidden relative z-10`}>
        <div className="flex justify-between items-center mb-6 border-b border-white/40 pb-4">
          <h3 className="font-extrabold text-slate-800 text-lg">클라우드 대기열 <span className="text-xs text-blue-500 ml-2 font-bold">(창을 닫아도 무방합니다)</span></h3>
          <button onClick={fetchScheduledTasks} className={glassButtonSecondary}>갱신</button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
          {displayedTasks.map(t => (
            <div key={t.id} className="p-4 bg-white/50 border border-white/60 shadow-sm rounded-2xl flex justify-between items-center hover:bg-white transition-all group">
              <div>
                <p className="font-extrabold text-slate-800 group-hover:text-blue-600 transition-colors">{t.productName}</p>
                <p className="text-[10px] text-slate-500 font-bold mt-1">{new Date(t.executeAt).toLocaleString()} | {translateStatus(t.newStatus)} | {t.newIsDisplayed ? '진열' : '숨김'}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEditModal(t)} className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${colorVariants.edit}`}>수정</button>
                <button onClick={() => handleDeleteTask(t)} className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${colorVariants.delete}`}>삭제</button>
              </div>
            </div>
          ))}
          {displayedTasks.length === 0 && !isLoading && <div className="py-20 text-center text-slate-300 font-bold">등록된 예약 정보가 없습니다.</div>}
        </div>
      </div>
    </div>
  );
}
