import { glassPanel, glassInput, glassButtonSecondary, colorVariants } from '../constants/styles';
import { translateStatus } from '../utils/status';

export default function ProductListPage({ products, isLoading, sellerId, loginMode, filters, setFilters, isFilterOpen, setIsFilterOpen, applyFilters, resetFilters, pagingAfter, loadMoreProducts, isLoadingMore, openProductEditModal }) {
  return (
    <div className={`${glassPanel} flex flex-col h-full overflow-hidden`}>
      <div className="p-4 md:p-6 border-b border-white/40 flex justify-between items-center shrink-0">
        <h3 className="font-extrabold text-base md:text-lg text-slate-700">판매 상품 현황</h3>
        <div className="flex gap-2">
          <button onClick={() => setIsFilterOpen(!isFilterOpen)} className={glassButtonSecondary}>상세 필터</button>
          <button onClick={applyFilters} disabled={isLoading} className={glassButtonSecondary}>새로고침</button>
        </div>
      </div>
      {isFilterOpen && (
        <div className="bg-white/40 backdrop-blur-md border-b border-white/50 p-4 sm:p-6 shadow-inner shrink-0 z-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="block text-[10px] font-bold text-slate-400 mb-1">상품 이름</label><input type="text" value={filters.name} onChange={e => setFilters({...filters, name: e.target.value})} className={glassInput} /></div>
            <div><label className="block text-[10px] font-bold text-slate-400 mb-1">SKU 번호</label><input type="text" value={filters.sku} onChange={e => setFilters({...filters, sku: e.target.value})} className={glassInput} /></div>
            <div><label className="block text-[10px] font-bold text-slate-400 mb-1">태그</label><input type="text" value={filters.tag} onChange={e => setFilters({...filters, tag: e.target.value})} className={glassInput} /></div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={resetFilters} className="text-xs font-bold text-slate-500 hover:text-slate-700 transition">초기화</button>
            <button onClick={applyFilters} className={`px-4 py-2 rounded-xl text-xs font-bold shadow-md transition-all ${colorVariants.blue}`}>필터 적용</button>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-white/40 backdrop-blur-md border-b border-white/40 text-slate-500 sticky top-0 z-10">
            <tr><th className="px-6 py-4">상품 정보</th><th className="px-6 py-4 text-right">가격</th><th className="px-6 py-4 text-center">상태</th><th className="px-6 py-4 text-center">관리</th></tr>
          </thead>
          <tbody className="divide-y divide-white/40">
            {(loginMode === 'seller' && !sellerId) ? (
              <tr><td colSpan="6" className="p-10 md:p-20 text-center text-slate-500">
                <div className="bg-white/60 p-6 rounded-2xl border border-white/60 shadow-sm max-w-sm mx-auto">
                  <p className="mb-2 font-extrabold text-red-500 text-sm">⚠️ 셀러 ID 추출 실패</p>
                  <p className="text-[11px] text-slate-500 font-bold leading-relaxed">보안 정책 및 접근 권한 제한으로 인해 판매자 아이디를 찾지 못했습니다.<br/>다시 로그인하거나 관리자에게 문의해주세요.</p>
                </div>
              </td></tr>
            ) : isLoading && products.length === 0 ? (
              <tr><td colSpan="6" className="p-20 text-center">
                <div className="flex flex-col items-center justify-center space-y-4">
                  <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin shadow-md"></div>
                  <p className="font-extrabold text-blue-600 text-sm animate-pulse tracking-widest uppercase">Loading...</p>
                </div>
              </td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan="6" className="p-16 text-center text-slate-400 font-extrabold text-sm">조회된 상품이 없습니다.</td></tr>
            ) : (
              products.map(p => (
                <tr key={p.id} className="hover:bg-white/40 transition-colors group">
                  <td className="px-6 py-4">
                    <p className="font-extrabold text-slate-800 group-hover:text-blue-600 transition-colors">{p.name || '이름 없음'}</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-1">{p.id}</p>
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-bold text-slate-700">{p.price?.toLocaleString()} {p.currency || 'KRW'}</td>
                  <td className="px-6 py-4 text-center"><span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white shadow-sm border border-white/60">{translateStatus(p.status)}</span></td>
                  <td className="px-6 py-4 text-center"><button onClick={() => openProductEditModal(p)} className="text-xs font-bold text-blue-600 bg-white/50 px-3 py-1.5 rounded-lg border border-white/60 hover:bg-white transition-all">수정</button></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {pagingAfter && <button onClick={loadMoreProducts} className="w-full py-6 text-slate-400 text-xs font-bold hover:text-blue-600 transition-colors">결과 더 보기</button>}
      </div>
    </div>
  );
}
