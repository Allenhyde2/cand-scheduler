import React, { useState, useEffect } from 'react';

const DEFAULT_GROUP_ID = 'G0IZUDWCL';
const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const SCHEDULER_API_URL = 'https://2fb8b65g8f.execute-api.ap-southeast-2.amazonaws.com/schedule';
const CLIENT_ID = '4582f19ca0325304d27abbd18a36b21b'; 
const SCOPES = 'email poll option vote addresses member:MOIM:payment:read member:MOIM:product:read member:MOIM:product:write';

const createCodeVerifier = () => btoa(String.fromCharCode(...new Uint8Array(crypto.getRandomValues(new Uint8Array(32))))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const createCodeChallenge = async (verifier) => btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest("SHA-256", (new TextEncoder()).encode(verifier))))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState('');
  const [communityId] = useState(DEFAULT_GROUP_ID); 
  const [sellerId, setSellerId] = useState(''); 
  
  const [loginMode, setLoginMode] = useState('seller');
  const [activeTab, setActiveTab] = useState('productList'); 
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' }); 
  const [confirmDialog, setConfirmDialog] = useState({ visible: false, message: '', onConfirm: null });

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

  const [editModal, setEditModal] = useState({
    isOpen: false, task: null, status: '', isDisplayed: 'true', date: '', time: ''
  });

  const showToast = (message, type = 'info') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3500);
  };

  const closeConfirm = () => setConfirmDialog({ visible: false, message: '', onConfirm: null });

  const getAuthHeaders = (currentToken) => ({
    'content-type': 'application/json',
    'authorization': `Bearer ${currentToken || token}`,
    'x-can-community-id': communityId,
  });

  // --- ⭐️ 핵심: 내 프로필 정보에서 Seller ID를 추출하는 함수 ---
  const fetchMySellerId = async (accessToken) => {
    try {
      const url = `https://cand-scheduler.vercel.app/api/proxy?endpoint=me`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'content-type': 'application/json',
          'authorization': `Bearer ${accessToken}`,
          'x-can-community-id': DEFAULT_GROUP_ID,
        }
      });
      
      if (!res.ok) return null;
      const data = await res.json();
      
      // profiles 배열에서 CS:로 시작하는 ID 찾기
      const sellerProfile = data.profiles?.find(p => p.id && p.id.startsWith('CS:'));
      return sellerProfile ? sellerProfile.id : null;
    } catch (err) {
      console.error("Seller ID 자동 추출 실패:", err);
      return null;
    }
  };

  // --- OAuth 로그인 콜백 처리 ---
  useEffect(() => {
    const handleOAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const stateParam = urlParams.get('state');
      const error = urlParams.get('error');

      if (error) {
        showToast(`로그인 취소/실패: ${urlParams.get('error_description')}`, 'error');
        window.history.replaceState({}, document.title, '/');
        return;
      }

      if (code && stateParam) {
        setIsLoginProcessing(true);
        const savedState = sessionStorage.getItem('oauth_state');
        const codeVerifier = sessionStorage.getItem('oauth_verifier');
        const savedLoginMode = sessionStorage.getItem('cand_login_mode') || 'seller';
        const savedAdminTargetId = localStorage.getItem('cand_admin_target_id');

        if (stateParam !== savedState) {
          showToast('비정상적인 접근입니다.', 'error');
          setIsLoginProcessing(false);
          return;
        }

        try {
          const redirectUri = `${window.location.origin}/canpass/callback`;
          const tokenApiUrl = `${window.location.origin}/api/token`;

          const res = await fetch(tokenApiUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ client_id: CLIENT_ID, code, code_verifier: codeVerifier, redirect_uri: redirectUri })
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data.error_description || '토큰 발급 실패');

          const accessToken = data.access_token;
          let finalSellerId = '';

          // 모드에 따른 셀러 ID 결정
          if (savedLoginMode === 'admin') {
            finalSellerId = savedAdminTargetId || '';
          } else {
            // ⭐️ 판매자 모드: API를 통해 자동으로 셀러 ID 추출
            finalSellerId = await fetchMySellerId(accessToken);
            if (!finalSellerId) {
              showToast("판매자 프로필을 찾을 수 없습니다. 어드민 모드를 이용해 주세요.", "error");
              throw new Error("Seller ID Not Found");
            }
          }

          setLoginMode(savedLoginMode);
          setToken(accessToken);
          setSellerId(finalSellerId);
          setIsAuthenticated(true);
          
          localStorage.setItem('cand_token', accessToken);
          localStorage.setItem('cand_seller_id', finalSellerId);
          localStorage.setItem('cand_login_mode', savedLoginMode);

          fetchProductsWithArgs(accessToken, finalSellerId);
          fetchScheduledTasks(accessToken);
          showToast('로그인이 완료되었습니다.', 'success');

        } catch (err) {
          if(err.message !== "Seller ID Not Found") showToast(`로그인 오류: ${err.message}`, 'error');
        } finally {
          setIsLoginProcessing(false);
          window.history.replaceState({}, document.title, '/');
          sessionStorage.removeItem('oauth_state');
          sessionStorage.removeItem('oauth_verifier');
        }
      } 
      else {
        const savedToken = localStorage.getItem('cand_token');
        const savedSellerId = localStorage.getItem('cand_seller_id');
        const savedMode = localStorage.getItem('cand_login_mode') || 'seller';
        
        if (savedToken && savedSellerId) {
          setToken(savedToken);
          setSellerId(savedSellerId);
          setLoginMode(savedMode);
          setIsAuthenticated(true);
          fetchProductsWithArgs(savedToken, savedSellerId);
          fetchScheduledTasks(savedToken);
        }
      }
    };
    handleOAuthCallback();
  }, []);

  const handleOAuthLogin = async (e) => {
    e.preventDefault();
    
    // 어드민 모드일 때만 입력값 체크
    if (loginMode === 'admin') {
      const cleanId = sellerId.trim();
      if (!cleanId) return showToast('조회할 판매자 ID를 입력해주세요.', 'error');
      localStorage.setItem('cand_admin_target_id', cleanId);
    }

    sessionStorage.setItem('cand_login_mode', loginMode);

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
      redirect_uri: redirectUri, community_id: DEFAULT_GROUP_ID, state, scope: SCOPES 
    }).toString();

    window.location.href = authUrl.toString();
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setToken('');
    setSellerId('');
    localStorage.clear();
    showToast('로그아웃 되었습니다.');
  };

  // --- API 연동 로직 ---
  const fetchProductsWithArgs = async (currentToken, currentSellerId) => {
    if(!currentSellerId) return;
    setIsLoading(true);
    try {
      const url = `https://cand-scheduler.vercel.app/api/proxy?endpoint=products&limit=100`;
      const res = await fetch(url, { method: 'GET', headers: getAuthHeaders(currentToken) });
      const data = await res.json();
      
      let list = data.data || [];
      // 셀러 ID로 필터링
      list = list.filter(p => (p.userId || p.sellerId || p.creatorId) === currentSellerId);

      setProducts(list);
    } catch (err) {
      showToast('상품 로드 실패', 'error');
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
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch (err) {}
  };

  const fetchProducts = () => fetchProductsWithArgs(token, sellerId);

  // ... (기존 UI 핸들러들: handleSelectProduct, handlePreSubmit, handleConfirmRegister, handleDeleteTask 등은 동일하게 유지)
  const handleSelectProduct = (product) => {
    setScheduleForm({ ...scheduleForm, productId: product.id });
    setProductSearchTerm(product.name);
    setIsProductSelectOpen(false);
  };

  const handlePreSubmit = (e) => {
    e.preventDefault();
    if (!scheduleForm.productId) return showToast('상품을 선택해주세요.', 'error');
    if (!confirmedDateTime) return showToast('일시를 선택해주세요.', 'error');
    setIsConfirmModalOpen(true);
  };

  const handleConfirmRegister = async () => {
    setIsConfirmModalOpen(false);
    showToast('예약 전송 중...', 'info');
    const newTaskId = Math.random().toString(36).substr(2, 9);
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
      if (!res.ok) throw new Error();
      showToast('예약 성공!', 'success');
      fetchScheduledTasks(token);
    } catch (err) { showToast('예약 실패', 'error'); }
  };

  const handleDeleteTask = async (task) => {
    if (!window.confirm('취소하시겠습니까?')) return;
    try {
      await fetch(SCHEDULER_API_URL, {
        method: 'POST', headers: getAuthHeaders(token),
        body: JSON.stringify({ action: 'DELETE', taskId: task.id, token, communityId })
      });
      showToast('취소 완료');
      fetchScheduledTasks(token);
    } catch (err) { showToast('실패'); }
  };

  const translateStatus = (s) => ({ scheduled: '판매예정', onSale: '판매중', soldOut: '품절', completed: '판매종료' }[s] || s);

  // --- UI 컴포넌트 ---
  const CustomUI = () => (
    toast.visible && (
      <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100]">
        <div className={`px-4 py-3 rounded-lg shadow-lg text-sm font-bold text-white ${toast.type === 'error' ? 'bg-red-600' : 'bg-gray-800'}`}>
          {toast.message}
        </div>
      </div>
    )
  );

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
        <CustomUI />
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
          <div className="bg-blue-600 p-8 text-center" style={{ backgroundColor: '#2563eb' }}>
            <h1 className="text-2xl font-bold text-white mb-2">VAKE Workspace</h1>
            <p className="text-blue-100 text-sm">서비스 관리를 위해 로그인해주세요.</p>
          </div>

          <div className="flex border-b border-gray-200">
            <button onClick={() => setLoginMode('seller')} className={`flex-1 py-4 text-sm font-bold transition ${loginMode === 'seller' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>판매자 로그인</button>
            <button onClick={() => setLoginMode('admin')} className={`flex-1 py-4 text-sm font-bold transition ${loginMode === 'admin' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>어드민 로그인</button>
          </div>

          <form onSubmit={handleOAuthLogin} className="p-8 space-y-6">
            {loginMode === 'seller' ? (
              <div className="bg-blue-50 border border-blue-100 p-5 rounded-xl text-sm text-blue-800 text-center">
                <p className="font-bold mb-2">👋 어서오세요, 판매자님!</p>
                <p className="text-xs opacity-80 leading-relaxed">로그인 시 본인의 셀러 ID를 자동으로 확인하여<br/>내 상품 목록을 즉시 불러옵니다.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-gray-50 border border-gray-200 p-3 rounded-lg text-xs text-gray-600">조회할 판매자 아이디를 입력한 뒤 로그인하세요.</div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Target Seller ID</label>
                  <input type="text" value={sellerId} onChange={(e) => setSellerId(e.target.value)} placeholder="ex) CS:P8XLJRM3" className="w-full px-4 py-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            )}
            <button type="submit" disabled={isLoginProcessing} className="w-full text-white font-bold py-3.5 rounded-xl shadow-md transition hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: '#2563eb' }}>
              {isLoginProcessing ? '인증 처리 중...' : 'CANpass 계정으로 로그인'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 text-gray-800 font-sans overflow-hidden">
      <CustomUI />
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-0 hidden'} flex-shrink-0 bg-white border-r transition-all duration-300 flex flex-col`}>
        <div className="h-16 border-b flex items-center justify-center px-6 shrink-0"><span className="text-xl font-bold">VAKE<span className="text-blue-600 ml-1">Work</span></span></div>
        <nav className="flex-1 py-4">
          <ul className="space-y-1 px-3">
            <li><button onClick={() => setActiveTab('productList')} className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium ${activeTab === 'productList' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'}`}>판매 상품 현황</button></li>
            <li><button onClick={() => setActiveTab('schedule')} className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium ${activeTab === 'schedule' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'}`}>상태 예약 변경</button></li>
            <li><button onClick={() => setActiveTab('settings')} className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium ${activeTab === 'settings' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}>시스템 정보</button></li>
          </ul>
        </nav>
        <div className="p-4 border-t"><button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-500 font-bold">로그아웃</button></div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b flex items-center justify-between px-6 flex-shrink-0 relative">
          <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: '#2563eb' }}></div>
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-xl font-bold">≡</button>
            <h2 className="text-lg font-bold">{activeTab === 'productList' ? '상품 현황' : activeTab === 'schedule' ? '예약 설정' : '접속 정보'}</h2>
          </div>
          <div className="flex items-center gap-2">
             <span className="bg-gray-100 text-gray-600 border text-xs font-bold px-3 py-1.5 rounded-md">ID: {sellerId}</span>
             <span className={`text-xs font-bold px-3 py-1.5 rounded-md border ${loginMode === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>{loginMode.toUpperCase()}</span>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6 bg-gray-50">
          {activeTab === 'productList' && (
            <div className="max-w-6xl mx-auto space-y-4">
              <div className="bg-white p-6 rounded-xl shadow-sm border">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold">내 판매 상품 목록</h3>
                  <button onClick={fetchProducts} disabled={isLoading} className="px-4 py-2 bg-gray-100 text-sm font-bold rounded-lg">새로고침</button>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-left bg-white text-sm">
                    <thead className="bg-gray-50 border-b text-gray-500">
                      <tr><th className="p-4">상품명</th><th className="p-4">가격</th><th className="p-4 text-center">상태</th><th className="p-4 text-center">진열</th></tr>
                    </thead>
                    <tbody className="divide-y">
                      {products.length === 0 ? (
                        <tr><td colSpan="4" className="p-12 text-center text-gray-400">등록된 상품이 없습니다.</td></tr>
                      ) : (
                        products.map(p => (
                          <tr key={p.id} className="hover:bg-gray-50">
                            <td className="p-4 font-bold">{p.name}<div className="text-xs text-gray-400 font-mono mt-1">{p.id}</div></td>
                            <td className="p-4">{p.price?.toLocaleString()} {p.currency}</td>
                            <td className="p-4 text-center"><span className={`px-2 py-1 rounded-full text-xs font-bold ${p.status === 'onSale' ? 'bg-green-100 text-green-700' : 'bg-gray-100'}`}>{translateStatus(p.status)}</span></td>
                            <td className="p-4 text-center">{p.isDisplayed ? <span className="text-blue-600 font-bold">진열중</span> : '숨김'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          {/* 예약 관련 UI 등은 기존과 동일하므로 논리적 흐름에 따라 렌더링 */}
          {activeTab === 'schedule' && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-t-4 border-t-blue-600">
                <h3 className="font-bold mb-6">새 상태 변경 예약</h3>
                <form onSubmit={handlePreSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold mb-1">대상 상품 검색</label>
                    <input type="text" value={productSearchTerm} onChange={(e) => {setProductSearchTerm(e.target.value); setIsProductSelectOpen(true);}} placeholder="상품명 입력" className="w-full p-2.5 border rounded-lg" />
                    {isProductSelectOpen && (
                      <div className="absolute bg-white border shadow-xl rounded-lg mt-1 w-full max-h-48 overflow-auto z-50">
                        {products.filter(p => p.name.includes(productSearchTerm)).map(p => (
                          <div key={p.id} onClick={() => handleSelectProduct(p)} className="p-3 hover:bg-blue-50 cursor-pointer border-b text-sm"><b>{p.name}</b> <span className="text-xs text-gray-400">({p.id})</span></div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <select value={scheduleForm.status} onChange={e => setScheduleForm({...scheduleForm, status: e.target.value})} className="p-2.5 border rounded-lg"><option value="onSale">판매중</option><option value="soldOut">품절</option><option value="completed">종료</option></select>
                    <select value={scheduleForm.isDisplayed} onChange={e => setScheduleForm({...scheduleForm, isDisplayed: e.target.value})} className="p-2.5 border rounded-lg"><option value="true">진열함</option><option value="false">숨김</option></select>
                  </div>
                  <input type="datetime-local" value={confirmedDateTime} onChange={e => setConfirmedDateTime(e.target.value)} className="w-full p-2.5 border rounded-lg" />
                  <button type="submit" className="w-full py-3 text-white font-bold rounded-lg" style={{ backgroundColor: '#2563eb' }}>AWS 예약 전송</button>
                </form>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border">
                <h3 className="font-bold mb-4 border-b pb-2">예약 대기 목록</h3>
                {tasks.length === 0 ? <div className="text-center py-8 text-gray-400">내역 없음</div> : tasks.map(t => (
                  <div key={t.id} className="p-4 bg-gray-50 border rounded-xl mb-3 flex justify-between items-center">
                    <div><div className="font-bold text-sm">{t.productName}</div><div className="text-xs text-gray-500">{new Date(t.executeAt).toLocaleString()} | {translateStatus(t.newStatus)}</div></div>
                    <button onClick={() => handleDeleteTask(t)} className="text-xs text-red-500 font-bold">취소</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {activeTab === 'settings' && (
            <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl border shadow-sm space-y-4">
              <h3 className="font-bold text-lg">세션 정보</h3>
              <div className="space-y-3 text-sm">
                <div><label className="text-gray-400">Login Mode</label><div className="font-bold text-blue-600">{loginMode}</div></div>
                <div><label className="text-gray-400">Seller ID (Active)</label><div className="font-mono bg-gray-50 p-2 border rounded">{sellerId}</div></div>
                <div><label className="text-gray-400">Community ID</label><div className="font-mono">{communityId}</div></div>
              </div>
            </div>
          )}
        </div>
      </main>

      {isConfirmModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-lg mb-4">예약을 전송할까요?</h3>
            <p className="text-sm text-gray-600 mb-6">설정하신 시간에 클라우드 서버가 작업을 수행합니다.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsConfirmModalOpen(false)} className="px-4 py-2 bg-gray-100 rounded-lg">취소</button>
              <button onClick={handleConfirmRegister} className="px-4 py-2 text-white rounded-lg font-bold" style={{ backgroundColor: '#2563eb' }}>확인</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
