import { useState, useRef, useEffect } from 'react';
import GlobalStyles from '../components/GlobalStyles';
import Toast from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';
import { glassInput } from '../constants/styles';

export default function LoginPage({ loginMode, setLoginMode, sellerId, setSellerId, onLogin, isLoginProcessing, toast, confirmDialog, closeConfirm }) {
  const [isAdminAdvancedOpen, setIsAdminAdvancedOpen] = useState(false);
  const [infoHeight, setInfoHeight] = useState(104);
  const sellerInfoRef = useRef(null);
  const adminInfoRef = useRef(null);

  useEffect(() => {
    const updateHeight = () => {
      if (loginMode === 'seller' && sellerInfoRef.current) setInfoHeight(sellerInfoRef.current.offsetHeight);
      else if (loginMode === 'admin' && adminInfoRef.current) setInfoHeight(adminInfoRef.current.offsetHeight);
    };
    requestAnimationFrame(updateHeight);
    const timeoutId = setTimeout(updateHeight, 50);
    window.addEventListener('resize', updateHeight);
    return () => { clearTimeout(timeoutId); window.removeEventListener('resize', updateHeight); };
  }, [loginMode, isAdminAdvancedOpen]);

  return (
    <>
      <GlobalStyles />
      <div className="min-h-screen w-screen bg-gradient-to-br from-indigo-100 via-slate-50 to-purple-100 flex items-center justify-center p-4 sm:p-6 font-sans text-slate-800 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-[80px] opacity-40 animate-pulse pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-[80px] opacity-40 animate-pulse pointer-events-none"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-[100px] opacity-30 pointer-events-none"></div>
        <div className="relative z-[2000]">
          <Toast toast={toast} />
          <ConfirmDialog confirmDialog={confirmDialog} onClose={closeConfirm} />
        </div>
        <div className="w-full max-w-md relative z-10 transition-all duration-300 mx-auto">
          <div className="bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[2.5rem] shadow-[0_8px_32px_0_rgba(31,38,135,0.1)] overflow-hidden">
            <div className="pt-10 sm:pt-12 pb-4 text-center flex flex-col items-center">
              <img src="https://ca.group-edge.net/i/G0IZUDWCL-logo-r1xy6d/logo" alt="VAKE Logo" className="h-14 sm:h-16 mb-3 object-contain drop-shadow-md" />
              <p className="text-slate-500 text-[10px] sm:text-xs font-extrabold tracking-widest uppercase">Commerce Workspace</p>
            </div>
            <div className="relative flex mx-6 sm:mx-8 mt-2 sm:mt-4 bg-white/20 rounded-2xl border border-white/30 shadow-inner backdrop-blur-md overflow-hidden group cursor-pointer">
              <div className={`absolute inset-y-0 w-1/2 rounded-2xl shadow-md transition-all duration-500 ease-out overflow-hidden flex items-center justify-center ${loginMode === 'seller' ? 'translate-x-0 bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-600 border border-blue-400/50 shadow-blue-500/30' : 'translate-x-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-purple-600 border border-purple-400/50 shadow-purple-500/30'}`}></div>
              <button type="button" onClick={() => setLoginMode('seller')} className={`relative z-10 flex-1 py-3 text-xs sm:text-sm font-extrabold rounded-2xl transition-all duration-300 active:scale-95 ${loginMode === 'seller' ? 'text-white' : 'text-slate-500/80 hover:text-slate-800'}`}>판매자 로그인</button>
              <button type="button" onClick={() => setLoginMode('admin')} className={`relative z-10 flex-1 py-3 text-xs sm:text-sm font-extrabold rounded-2xl transition-all duration-300 active:scale-95 ${loginMode === 'admin' ? 'text-white' : 'text-slate-500/80 hover:text-slate-800'}`}>어드민 로그인</button>
            </div>
            <form onSubmit={onLogin} className="p-6 sm:p-8 pb-8 sm:pb-10 flex flex-col gap-5 sm:gap-6">
              <div className="relative w-full overflow-hidden transition-[height] duration-400 ease-out" style={{ height: `${infoHeight}px` }}>
                <div ref={sellerInfoRef} className={`absolute top-0 left-0 w-full pb-2 transition-all duration-500 ease-out flex flex-col justify-start ${loginMode === 'seller' ? 'opacity-100 translate-x-0 z-10 pointer-events-auto' : 'opacity-0 -translate-x-10 pointer-events-none z-0'}`}>
                  <div className="bg-white/40 border border-white/50 p-4 sm:p-5 rounded-2xl text-center shadow-sm">
                    <p className="text-blue-800 font-extrabold mb-1.5 sm:mb-2 text-sm sm:text-base">👋 판매자 계정으로 접속합니다.</p>
                    <p className="text-slate-600 text-xs font-medium leading-relaxed">판매자 본인의 계정으로 로그인하여 등록된 상품 현황 및 예약 상태를 관리하세요.</p>
                  </div>
                </div>
                <div ref={adminInfoRef} className={`absolute top-0 left-0 w-full pb-2 transition-all duration-500 ease-out flex flex-col justify-start ${loginMode === 'admin' ? 'opacity-100 translate-x-0 z-10 pointer-events-auto' : 'opacity-0 translate-x-10 pointer-events-none z-0'}`}>
                  <div className="space-y-3 sm:space-y-4">
                    <div className="bg-white/40 border border-white/50 p-4 sm:p-5 rounded-2xl text-center shadow-sm">
                      <p className="text-purple-800 font-extrabold mb-1.5 sm:mb-2 text-sm sm:text-base">🛡️ 어드민 권한으로 접속합니다.</p>
                      <p className="text-slate-600 text-xs font-medium leading-relaxed">관리자 권한으로 커뮤니티의 <b className="text-purple-600 font-extrabold">전체 상품 현황</b>을 통합적으로 조회하고 제어합니다.</p>
                    </div>
                    <div className="border border-white/50 bg-white/20 rounded-2xl overflow-hidden shadow-sm transition-all duration-300">
                      <button type="button" onClick={() => setIsAdminAdvancedOpen(!isAdminAdvancedOpen)} className="w-full p-3 sm:p-4 flex items-center justify-between text-slate-700 hover:bg-white/40 transition-colors">
                        <span className="font-extrabold text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2">🔍 특정 판매자 지정 조회 (선택)</span>
                        <svg className={`w-4 h-4 sm:w-5 sm:h-5 text-slate-400 transition-transform duration-300 ${isAdminAdvancedOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                      </button>
                      <div className={`transition-opacity duration-300 ease-in-out ${isAdminAdvancedOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>
                        {isAdminAdvancedOpen && (
                          <div className="p-3 sm:p-4 pt-0 animate-fade-in-fast">
                            <input type="text" value={sellerId} onChange={e => setSellerId(e.target.value)} placeholder="판매자 ID (ex: CS:P8XL...)" className={glassInput} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <button type="submit" disabled={isLoginProcessing} className="relative w-full py-3.5 sm:py-4 mt-1 sm:mt-2 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 bg-[length:200%_auto] hover:bg-right text-white font-extrabold rounded-2xl shadow-[0_8px_20px_-6px_rgba(99,102,241,0.6)] hover:shadow-[0_12px_25px_-6px_rgba(99,102,241,0.8)] transition-all duration-500 active:scale-[0.98] flex items-center justify-center gap-2 overflow-hidden group disabled:opacity-50 disabled:pointer-events-none">
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-[250%] transition-transform duration-1000 ease-in-out bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12"></div>
                  {isLoginProcessing ? (
                    <span className="flex items-center justify-center gap-2 relative z-10">
                      <svg className="w-5 h-5 animate-spin text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      인증 처리 중...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2 relative z-10">
                      시작하기
                      <svg className="w-5 h-5 group-hover:translate-x-1.5 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg>
                    </span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
