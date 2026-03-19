import React, { useState, useEffect } from 'react';

// ⭐️ 시스템 설정값
const DEFAULT_GROUP_ID = 'G0IZUDWCL';
const API_BASE_URL = 'https://api.cand.xyz'; 
const SCHEDULER_API_URL = 'https://2fb8b65g8f.execute-api.ap-southeast-2.amazonaws.com/schedule';
const CLIENT_ID = '4582f19ca0325304d27abbd18a36b21b'; 

// ⭐️ [핵심 수정 사항] 백엔드에서 요구한 커머스 전용 권한 3가지를 스코프에 추가했습니다!
const SCOPES = 'email poll option vote addresses member:MOIM:payment:read member:MOIM:product:read member:MOIM:product:write';

// PKCE 난수 생성 로직
const createCodeVerifier = () => btoa(String.fromCharCode(...new Uint8Array(crypto.getRandomValues(new Uint8Array(32)).buffer)));
const createCodeChallenge = async (verifier) => btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest("SHA-256", (new TextEncoder()).encode(verifier))))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState('');
  const [communityId] = useState(DEFAULT_GROUP_ID); 
  const [sellerId, setSellerId] = useState(''); 
  
  const [activeTab, setActiveTab] = useState('productList'); 
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' }); 
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoginProcessing, setIsLoginProcessing] = useState(false);
  const [tasks, setTasks] = useState([]);

  const [scheduleForm, setScheduleForm] = useState({
    productId: '', status: 'onSale', isDisplayed: 'true',
  });
  
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [isProductSelectOpen, setIsProductSelectOpen] = useState(false);
  const [recentProducts, setRecentProducts] = useState([]);

  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [pickerDate, setPickerDate] = useState('');
  const [pickerTime, setPickerTime] = useState('');
  const [confirmedDateTime, setConfirmedDateTime] = useState('');
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  const showToast = (message, type = 'info') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3500);
  };

  const getAuthHeaders = (currentToken) => ({
    'content-type': 'application/json',
    'authorization': `Bearer ${currentToken || token}`,
    'x-can-community-id': communityId,
  });

  // --- OAuth 콜백 처리 ---
  useEffect(() => {
    const handleOAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const stateParam = urlParams.get('state');

      if (code && stateParam) {
        setIsLoginProcessing(true);
        const savedState = sessionStorage.getItem('oauth_state');
        const codeVerifier = sessionStorage.getItem('oauth_verifier');
        const savedSellerId = localStorage.getItem('cand_seller_id');

        try {
          const redirectUri = `${window.location.origin}/canpass/callback`;
          const tokenApiUrl = `${window.location.origin}/api/token`;

          const res = await fetch(tokenApiUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              client_id: CLIENT_ID, code: code, code_verifier: codeVerifier, redirect_uri: redirectUri
            })
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data.error_description || data.error || '토큰 발급 실패');

          const accessToken = data.access_token;
          
          setToken(accessToken);
          setSellerId(savedSellerId || '');
          setIsAuthenticated(true);
          localStorage.setItem('cand_token', accessToken);

          fetchProductsWithArgs(accessToken, savedSellerId);
          fetchScheduledTasks(accessToken);
          showToast('새로운 권한이 적용된 토큰으로 로그인되었습니다.', 'success');

        } catch (err) {
          showToast(err.message, 'error');
        } finally {
          setIsLoginProcessing(false);
          window.history.replaceState({}, document.title, '/');
          sessionStorage.removeItem('oauth_state');
          sessionStorage.removeItem('oauth_verifier');
        }
      } else {
        const savedToken = localStorage.getItem('cand_token');
        const savedSellerId = localStorage.getItem('cand_seller_id');
        if (savedToken && savedSellerId) {
          setToken(savedToken);
          setSellerId(savedSellerId);
          setIsAuthenticated(true);
          fetchProductsWithArgs(savedToken, savedSellerId);
          fetchScheduledTasks(savedToken);
        }
      }
    };
    handleOAuthCallback();
  }, []);

  // --- CANpass 자동 로그인 ---
  const handleOAuthLogin = async () => {
    if (!sellerId.trim()) return showToast('판매자 ID를 먼저 입력해주세요.', 'error');
    localStorage.setItem('cand_seller_id', sellerId.trim());

    const codeVerifier = createCodeVerifier();
    const codeChallenge = await createCodeChallenge(codeVerifier);
    const state = JSON.stringify({ nonce: Math.random().toString(), key: 'cand-admin' });

    sessionStorage.setItem('oauth_verifier', codeVerifier);
    sessionStorage.setItem('oauth_state', state);

    const redirectUri = `${window.location.origin}/canpass/callback`;
    const authUrl = new URL('https://canpass.me/oauth2/authorize');
    
    authUrl.search = new URLSearchParams({
      response_type: 'code', action: 'signin', client_id: CLIENT_ID,
      code_challenge: codeChallenge, code_challenge_method: 'S256',
      redirect_uri: redirectUri, community_id: DEFAULT_GROUP_ID, state,
      scope: SCOPES 
    }).toString();

    window.location.href = authUrl.toString();
  };

  const handleLogout = () => {
    localStorage.removeItem('cand_token');
    setIsAuthenticated(false);
    setToken('');
    showToast('로그아웃 되었습니다. 토큰이 초기화되었습니다.');
  };

  // --- API 데이터 페칭 ---
  const fetchProductsWithArgs = async (currentToken, currentSellerId) => {
    setIsLoading(true);
    try {
      const url = `${window.location.origin}/api/proxy?endpoint=products&limit=100`;
      const res = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders(currentToken)
      });
      
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 403) throw new Error("403 Forbidden: 해당 토큰에 상품 조회 권한이 부족합니다.");
        throw new Error(data.message || '상품 정보를 가져오지 못했습니다.');
      }
      
      const list = data.data || [];
      const filtered = list.filter(p => (p.sellerId || p.userId) === currentSellerId);
      
      setProducts(filtered);
      showToast('해당 판매자의 상품 목록을 성공적으로 불러왔습니다.', 'success');
      
    } catch (err) {
      showToast(err.message, 'error');
      if (err.message.includes('403')) {
        setIsAuthenticated(false);
        localStorage.removeItem('cand_token');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fetchScheduledTasks = async (currentToken) => {
    try {
      const res = await fetch(SCHEDULER_API_URL, {
        method: 'POST',
        headers: getAuthHeaders(currentToken), 
        body: JSON.stringify({ action: 'LIST', token: currentToken, communityId })
      });
      if (!res.ok) return;
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch (err) {
      console.error("스케줄 목록 조회 실패:", err);
    }
  };

  // --- UI 컴포넌트들 (스케줄러 포함) ---
  const handleSelectProduct = (product) => {
    setScheduleForm({ ...scheduleForm, productId: product.id });
    setProductSearchTerm(product.name);
    setIsProductSelectOpen(false);
    setRecentProducts(prev => [product, ...prev.filter(p => p.id !== product.id)].slice(0, 5));
  };

  const handlePreSubmit = (e) => {
    e.preventDefault();
    if (!scheduleForm.productId) return showToast('상품을 선택해주세요.', 'error');
    if (!confirmedDateTime) return showToast('실행 일시를 선택해주세요.', 'error');
    setIsConfirmModalOpen(true);
  };

  const handleConfirmRegister = async () => {
    setIsConfirmModalOpen(false);
    showToast('AWS에 예약을 전송하는 중입니다...', 'info');
    const newTaskId = Math.random().toString(36).substring(2, 9); 
    
    try {
      const res = await fetch(SCHEDULER_API_URL, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify({
          action: 'CREATE', taskId: newTaskId, productId: scheduleForm.productId,
          newStatus: scheduleForm.status, newIsDisplayed: scheduleForm.isDisplayed === 'true',
          executeAt: new Date(confirmedDateTime).toISOString(), token, communityId
        })
      });
      
      if (!res.ok) throw new Error('예약 등록 실패');
      showToast('예약이 성공적으로 등록되었습니다.', 'success');
      fetchScheduledTasks(token);
      setConfirmedDateTime(''); setProductSearchTerm(''); setScheduleForm({ ...scheduleForm, productId: '' });
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteTask = async (task) => {
      if (!window.confirm(`예약을 취소하시겠습니까?`)) return;
      showToast('예약을 취소하는 중입니다...', 'info');
      try {
          const res = await fetch(SCHEDULER_API_URL, {
              method: 'POST', headers: getAuthHeaders(token),
              body: JSON.stringify({ action: 'DELETE', taskId: task.id, token, communityId })
          });
          if (!res.ok) throw new Error('삭제 실패');
          showToast('예약이 취소되었습니다.', 'success');
          fetchScheduledTasks(token);
      } catch (err) {
          showToast(err.message, 'error');
      }
  };

  const openDatePicker = () => {
    const now = new Date();
    setPickerDate(now.toISOString().split('T')[0]);
    setPickerTime(now.toTimeString().slice(0, 5));
    setIsDatePickerOpen(true);
  };

  const handleConfirmDatePicker = () => {
    setConfirmedDateTime(`${pickerDate}T${pickerTime}`);
    setIsDatePickerOpen(false);
  };

  const translateStatus = (s) => ({ scheduled: '판매예정', onSale: '판매중', soldOut: '품절', completed: '판매종료' }[s] || s);

  // --- 로그인 화면 (CANpass 전용) ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        {/* Toast 컴포넌트 인라인 배치 (함수 렌더링 오류 방지) */}
        {toast.visible && (
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100]">
            <div className={toast.type === 'error' ? "px-4 py-3 rounded-lg shadow-lg text-sm font-bold text-white bg-red-600" : "px-4 py-3 rounded-lg shadow-lg text-sm font-bold text-white bg-gray-800"}>
              {toast.message}
            </div>
          </div>
        )}

        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
          <div className="bg-blue-600 p-8 text-center border-b-4 border-blue-700">
            <h1 className="text-2xl font-bold text-white mb-2">VAKE Admin</h1>
            <p className="text-blue-100 text-sm">서비스 관리를 위해 로그인해주세요.</p>
          </div>
          
          <div className="p-8 space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">판매자 ID (Seller ID) <span className="text-red-500">*</span></label>
              <input 
                type="text" value={sellerId} onChange={e => setSellerId(e.target.value)} 
                placeholder="ex) CS:P8XLJRM3" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 outline-none" 
              />
            </div>

            <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
              <p className="text-xs text-blue-600 font-bold mb-2">CANpass 연동 로그인</p>
              {/* 표준 유틸리티 클래스 적용 */}
              <button 
                onClick={handleOAuthLogin} disabled={isLoginProcessing} style='bg-blue-600'
                className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition shadow-sm"
              >
                {isLoginProcessing ? '인증 처리 중...' : 'CANpass로 권한 승인 및 로그인'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- 메인 대시보드 화면 ---
  return (
    <div className="flex h-screen bg-gray-50 text-gray-800 overflow-hidden">
      {/* Toast 컴포넌트 인라인 배치 */}
      {toast.visible && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100]">
          <div className={toast.type === 'error' ? "px-4 py-3 rounded-lg shadow-lg text-sm font-bold text-white bg-red-600" : "px-4 py-3 rounded-lg shadow-lg text-sm font-bold text-white bg-gray-800"}>
            {toast.message}
          </div>
        </div>
      )}
      
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-0 hidden'} bg-white border-r flex flex-col transition-all`}>
        <div className="h-16 border-b flex items-center justify-center font-bold text-xl">
          Admin<span className="text-blue-600">Dash</span>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {/* 정적 클래스명으로 분리 및 표준 색상 사용 */}
          <button 
            onClick={() => setActiveTab('productList')} 
            className={activeTab === 'productList' ? "w-full text-left px-4 py-2 rounded-lg text-sm bg-blue-50 text-blue-600 font-bold" : "w-full text-left px-4 py-2 rounded-lg text-sm hover:bg-gray-50"}
          >
            상품 목록
          </button>
          <button 
            onClick={() => setActiveTab('schedule')} 
            className={activeTab === 'schedule' ? "w-full text-left px-4 py-2 rounded-lg text-sm bg-blue-50 text-blue-600 font-bold" : "w-full text-left px-4 py-2 rounded-lg text-sm hover:bg-gray-50"}
          >
            상태 예약 (서버리스)
          </button>
          <div className="pt-4 mt-4 border-t">
            <button 
              onClick={() => setActiveTab('settings')} 
              className={activeTab === 'settings' ? "w-full text-left px-4 py-2 rounded-lg text-sm bg-gray-100" : "w-full text-left px-4 py-2 rounded-lg text-sm hover:bg-gray-50"}
            >
              시스템 설정
            </button>
          </div>
          <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-500 mt-8 font-bold">로그아웃 및 초기화</button>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-xl font-bold hover:text-blue-600 transition">≡</button>
            <h2 className="font-bold">
              {activeTab === 'productList' && '판매 상품 현황'}
              {activeTab === 'schedule' && '상태 변경 예약'}
              {activeTab === 'settings' && '시스템 연결 정보'}
            </h2>
          </div>
          <div className="flex gap-2">
            <span className="bg-gray-100 text-gray-600 text-xs font-bold px-3 py-1.5 rounded border">Seller: {sellerId}</span>
            <span className="bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1.5 rounded border border-blue-200">PRODUCTION</span>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'productList' && (
            <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-sm border p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-lg">상품 목록</h3>
                <button onClick={() => fetchProductsWithArgs(token, sellerId)} className="text-sm font-bold px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition">새로고침</button>
              </div>
              
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-left text-sm bg-white">
                  <thead className="bg-gray-50 border-b text-gray-600 uppercase text-xs">
                    <tr><th className="p-4 font-bold">상품명 / ID</th><th className="p-4 font-bold">가격</th><th className="p-4 font-bold text-center">판매상태</th><th className="p-4 font-bold text-center">진열여부</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {products.length === 0 ? (
                        <tr><td colSpan="4" className="p-8 text-center text-gray-400">데이터가 없거나 해당 판매자의 상품이 아닙니다.</td></tr>
                    ) : (
                        products.map(product => (
                          <tr key={product.id} className="hover:bg-blue-50 transition">
                            <td className="p-4">
                                <div className="font-bold text-gray-900">{product.name}</div>
                                <div className="text-xs text-gray-400 font-mono mt-0.5">{product.id}</div>
                            </td>
                            <td className="p-4 text-gray-600">{product.price?.toLocaleString()} {product.currency || 'KRW'}</td>
                            <td className="p-4 text-center">
                              {/* 상태 표시에 사용된 클래스명도 정적 문자열로 고정 */}
                              <span className={
                                product.status === 'onSale' ? "inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700" : 
                                product.status === 'soldOut' ? "inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700" : 
                                "inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700"
                              }>
                                {translateStatus(product.status)}
                              </span>
                            </td>
                            <td className="p-4 text-center">
                              {product.isDisplayed ? <span className="text-blue-600 font-bold text-sm">진열중</span> : <span className="text-gray-400 text-sm font-medium">숨김</span>}
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'schedule' && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-t-4 border-t-blue-600 p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-lg">새 예약 등록 (AWS 연동)</h3>
                </div>
                <form onSubmit={handlePreSubmit} className="space-y-5">
                  <div className="relative">
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">1. 대상 상품 검색</label>
                    <input 
                        type="text" value={productSearchTerm} 
                        onChange={e => {
                            setProductSearchTerm(e.target.value); setIsProductSelectOpen(true);
                            if (scheduleForm.productId) setScheduleForm({...scheduleForm, productId: ''});
                        }} 
                        onFocus={() => setIsProductSelectOpen(true)}
                        placeholder="상품명 또는 ID를 입력하세요..." 
                        className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-blue-600 text-sm" 
                    />
                    {isProductSelectOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsProductSelectOpen(false)}></div>
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border rounded-lg shadow-xl z-20 max-h-60 overflow-y-auto">
                          <div className="p-2">
                              {products.filter(p => p.name.includes(productSearchTerm) || p.id.includes(productSearchTerm)).map(p => (
                                <button key={p.id} type="button" onClick={() => handleSelectProduct(p)} className="w-full text-left p-2.5 text-sm hover:bg-blue-50 rounded mb-1">
                                  <div className="font-bold text-gray-900">{p.name}</div> 
                                  <div className="text-xs text-gray-400 mt-0.5">{p.id}</div>
                                </button>
                              ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">2. 변경할 판매상태</label>
                      <select value={scheduleForm.status} onChange={e => setScheduleForm({...scheduleForm, status: e.target.value})} className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-blue-600 text-sm">
                        <option value="onSale">판매중</option><option value="soldOut">품절</option><option value="scheduled">판매예정</option><option value="completed">판매종료</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">3. 진열 여부</label>
                      <select value={scheduleForm.isDisplayed} onChange={e => setScheduleForm({...scheduleForm, isDisplayed: e.target.value})} className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-blue-600 text-sm">
                        <option value="true">진열함 (표시)</option><option value="false">진열안함 (숨김)</option>
                      </select>
                    </div>
                  </div>
                  <div className="relative">
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">4. 실행 일시</label>
                    <div onClick={openDatePicker} className="w-full p-2.5 border rounded-lg cursor-pointer bg-white text-sm">
                        {confirmedDateTime ? <span className="font-bold text-blue-700">{new Date(confirmedDateTime).toLocaleString()}</span> : <span className="text-gray-400">클릭하여 예약 일시 선택...</span>}
                    </div>
                    {isDatePickerOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsDatePickerOpen(false)}></div>
                        <div className="absolute left-0 top-full mt-2 p-5 border rounded-xl bg-white shadow-2xl z-20 w-72">
                          <h4 className="font-bold text-gray-800 mb-4 border-b pb-2">날짜 및 시간 선택</h4>
                          <div className="space-y-4 mb-5">
                              <div><label className="block text-xs font-bold text-gray-600 mb-1">날짜</label><input type="date" value={pickerDate} onChange={e => setPickerDate(e.target.value)} className="w-full p-2 border rounded"/></div>
                              <div><label className="block text-xs font-bold text-gray-600 mb-1">시간</label><input type="time" value={pickerTime} onChange={e => setPickerTime(e.target.value)} className="w-full p-2 border rounded"/></div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setIsDatePickerOpen(false)} className="text-sm font-bold px-4 py-2 bg-gray-100 rounded">취소</button>
                            <button type="button" onClick={handleConfirmDatePicker} className="text-sm font-bold px-4 py-2 bg-blue-600 text-white rounded">설정 확정</button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  <button type="submit" className="w-full py-3.5 mt-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition shadow-md">예약 데이터 AWS 전송하기</button>
                </form>
              </div>

              <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex justify-between items-center mb-5 pb-3 border-b">
                    <h3 className="font-bold text-lg text-gray-900">현재 대기 중인 예약 목록</h3>
                    <button onClick={() => fetchScheduledTasks(token)} className="text-xs font-bold px-3 py-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">목록 새로고침</button>
                </div>
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                  {tasks.length === 0 ? (
                      <div className="text-center py-12 text-gray-400 border-2 border-dashed rounded-xl bg-gray-50">등록된 예약 내역이 없습니다.</div>
                  ) : (
                    tasks.map(t => {
                        const targetProduct = products.find(p => p.id === t.productId);
                        const displayName = targetProduct ? targetProduct.name : (t.productName !== 'Unknown Product' ? t.productName : t.productId);
                        return (
                          <div key={t.id} className="p-4 border rounded-xl bg-blue-50 border-blue-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div>
                              <div className="font-bold text-gray-900 mb-1">{displayName}</div>
                              <div className="text-xs text-gray-600 flex flex-wrap gap-2">
                                  <span className="bg-white px-2 py-0.5 rounded border">상태: <b>{translateStatus(t.newStatus)}</b></span>
                                  <span className="bg-white px-2 py-0.5 rounded border">진열: <b>{t.newIsDisplayed ? '표시' : '숨김'}</b></span>
                                  <span className="bg-white px-2 py-0.5 rounded border text-blue-700">실행일시: <b>{new Date(t.executeAt).toLocaleString()}</b></span>
                              </div>
                            </div>
                            <button onClick={() => handleDeleteTask(t)} className="text-xs font-bold text-red-600 px-4 py-2 bg-white border border-red-200 rounded-lg hover:bg-red-50">예약 취소</button>
                          </div>
                        )
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border p-8 space-y-6">
              <h3 className="font-bold text-lg border-b pb-4">시스템 연결 정보</h3>
              <div className="space-y-5 text-sm font-mono">
                <div><label className="text-gray-500 font-bold block text-xs mb-1.5">API Endpoint</label><div className="p-3 bg-gray-50 rounded border">{API_BASE_URL}</div></div>
                <div><label className="text-gray-500 font-bold block text-xs mb-1.5">OAuth Scopes (New!)</label><div className="p-3 bg-green-50 rounded border border-green-200 text-green-800 text-xs break-all">{SCOPES}</div></div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* 최종 확인 모달 */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-5 border-b pb-3">예약을 등록하시겠습니까?</h3>
            <div className="bg-blue-50 p-5 rounded-xl mb-6 space-y-2 border border-blue-200 text-sm">
              <p className="flex justify-between"><span className="text-gray-500 font-bold">대상 상품</span> <span className="font-bold text-gray-900">{products.find(p => p.id === scheduleForm.productId)?.name || scheduleForm.productId}</span></p>
              <div className="pt-2 mt-2 border-t border-blue-200"><p className="flex justify-between items-center"><span className="text-blue-700 font-bold">실행 일시</span> <span className="font-bold text-blue-700">{new Date(confirmedDateTime).toLocaleString()}</span></p></div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setIsConfirmModalOpen(false)} className="px-5 py-2 bg-gray-100 rounded-lg font-bold">취소</button>
              <button onClick={handleConfirmRegister} className="px-5 py-2 bg-blue-600 text-white rounded-lg font-bold">예약하기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
