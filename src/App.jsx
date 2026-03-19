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
  
  // 로그인 모드 상태 (seller | admin)
  const [loginMode, setLoginMode] = useState('seller');

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

  const [editModal, setEditModal] = useState({
    isOpen: false, task: null, status: '', isDisplayed: 'true', date: '', time: ''
  });

  const showToast = (message, type = 'info') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3500);
  };

  const getAuthHeaders = (currentToken) => ({
    'content-type': 'application/json',
    'authorization': `Bearer ${currentToken || token}`,
    'x-can-community-id': communityId,
  });

  // --- ⭐️ 핵심: 내 프로필에서 CS: 아이디를 자동으로 찾아오는 함수 ---
  const autoFetchSellerId = async (accessToken) => {
    try {
      const fetchOptions = {
        method: 'GET',
        headers: {
          'content-type': 'application/json',
          'authorization': `Bearer ${accessToken}`,
          'x-can-community-id': communityId
        }
      };

      // 1. 표준 유저 정보 API (/users/me) 찔러보기
      let res = await fetch(`https://cand-scheduler.vercel.app/api/proxy?endpoint=users/me`, fetchOptions);
      
      // 2. 만약 404 에러가 나면 백엔드가 말한 그대로 (/me) 찔러보기 (Fallback)
      if (!res.ok) {
        res = await fetch(`https://cand-scheduler.vercel.app/api/proxy?endpoint=me`, fetchOptions);
      }
      
      if (!res.ok) throw new Error("유저 프로필 정보를 가져오지 못했습니다.");
      const data = await res.json();
      
      console.log("🕵️‍♂️ 1차 불러온 내 프로필 정보:", data);

      // profiles 리스트에서 CS:로 시작하는 ID 찾기
      let sellerProfileId = data.profiles?.find(p => p.id && p.id.startsWith('CS:'))?.id;
      
      // 3. ⭐️ 만약 1차에서 profiles가 없거나 비어있다면, /users/bulk 로 상세 프로필 재조회
      if (!sellerProfileId && data.id) {
        console.log(`🕵️‍♂️ 1차에서 프로필이 비어있어, POST /users/bulk 로 상세 조회를 시도합니다. (Target ID: ${data.id})`);
        
        const bulkRes = await fetch(`https://cand-scheduler.vercel.app/api/proxy?endpoint=users/bulk`, {
          method: 'POST',
          headers: fetchOptions.headers,
          body: JSON.stringify({ ids: [data.id] })
        });

        if (bulkRes.ok) {
          const bulkData = await bulkRes.json();
          console.log("🕵️‍♂️ 2차 /users/bulk 상세 조회 결과:", bulkData);
          
          const userData = Array.isArray(bulkData) ? bulkData[0] : bulkData;
          sellerProfileId = userData?.profiles?.find(p => p.id && p.id.startsWith('CS:'))?.id;
        }
      }

      if (!sellerProfileId) {
        throw new Error("판매자(CS:) 권한 프로필이 존재하지 않는 계정입니다.");
      }
      
      return sellerProfileId;
    } catch (err) {
      showToast(err.message, 'error');
      return null;
    }
  };

  // --- OAuth 로그인 콜백 처리 ---
  useEffect(() => {
    const handleOAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const stateParam = urlParams.get('state');

      if (code && stateParam) {
        setIsLoginProcessing(true);
        const savedState = sessionStorage.getItem('oauth_state');
        const codeVerifier = sessionStorage.getItem('oauth_verifier');
        const savedLoginMode = sessionStorage.getItem('cand_login_mode') || 'seller';
        const savedAdminTargetId = localStorage.getItem('cand_admin_target_id');

        if (stateParam !== savedState) {
          showToast('비정상적인 로그인 접근입니다.', 'error');
          setIsLoginProcessing(false);
          return;
        }

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
          if (!res.ok) throw new Error(data.error_description || '토큰 발급 실패');

          const accessToken = data.access_token;
          let finalSellerId = '';

          // ⭐️ 모드에 따른 분기 처리
          if (savedLoginMode === 'admin') {
            finalSellerId = savedAdminTargetId || '';
          } else {
            // 판매자 모드: 로그인 직후 프로필 API에서 자동 추출
            finalSellerId = await autoFetchSellerId(accessToken);
            if (!finalSellerId) {
              setIsLoginProcessing(false);
              return; // 셀러 아이디를 못 찾으면 진행 중단
            }
          }

          setToken(accessToken);
          setSellerId(finalSellerId);
          setLoginMode(savedLoginMode);
          setIsAuthenticated(true);
          
          localStorage.setItem('cand_token', accessToken);
          localStorage.setItem('cand_seller_id', finalSellerId);
          localStorage.setItem('cand_login_mode', savedLoginMode);

          fetchProductsWithArgs(accessToken, finalSellerId);
          fetchScheduledTasks(accessToken);
          showToast(`${savedLoginMode === 'admin' ? '어드민' : '판매자'} 로그인이 완료되었습니다.`, 'success');

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
    
    // 어드민 모드일 때만 입력값 검사
    if (loginMode === 'admin') {
      const cleanId = sellerId.trim();
      if (!cleanId) return showToast('조회할 판매자 ID를 먼저 입력해주세요.', 'error');
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
      redirect_uri: redirectUri, community_id: DEFAULT_GROUP_ID, state,
      scope: SCOPES 
    }).toString();

    window.location.href = authUrl.toString();
  };

  const handleLogout = () => {
    localStorage.removeItem('cand_token');
    localStorage.removeItem('cand_seller_id');
    localStorage.removeItem('cand_login_mode');
    setIsAuthenticated(false);
    setToken('');
    setSellerId('');
    showToast('로그아웃 되었습니다.');
  };

  // --- API 데이터 페칭 ---
  const fetchProductsWithArgs = async (currentToken, currentSellerId) => {
    if (!currentSellerId) return;
    setIsLoading(true);
    try {
      const url = `https://cand-scheduler.vercel.app/api/proxy?endpoint=products&limit=100`;
      const res = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders(currentToken)
      });
      const data = await res.json();
      const list = data.data || [];
      const filtered = list.filter(p => (p.sellerId || p.userId || p.creatorId) === currentSellerId);
      setProducts(filtered);
    } catch (err) {
      showToast('목록 로드 실패', 'error');
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

  const handleSelectProduct = (product) => {
    setScheduleForm({ ...scheduleForm, productId: product.id });
    setProductSearchTerm(product.name);
    setIsProductSelectOpen(false);
    const newRecents = [product, ...recentProducts.filter(p => p.id !== product.id)].slice(0, 5);
    setRecentProducts(newRecents);
    localStorage.setItem('cand_recent_products', JSON.stringify(newRecents));
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

  const openEditModal = (task) => {
    const d = new Date(task.executeAt);
    const tzoffset = d.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(d.getTime() - tzoffset)).toISOString().slice(0, 16);
    const [date, time] = localISOTime.split('T');

    setEditModal({
      isOpen: true, task, status: task.newStatus,
      isDisplayed: task.newIsDisplayed ? 'true' : 'false', date, time
    });
  };

  const handleConfirmEdit = async () => {
    if (!editModal.date || !editModal.time) return showToast('수정할 날짜와 시간을 입력해주세요.', 'error');
    const executeTimeIso = new Date(`${editModal.date}T${editModal.time}`).toISOString();
    
    try {
      showToast('AWS 클라우드 예약을 수정하는 중...', 'info');
      const response = await fetch(SCHEDULER_API_URL, {
        method: 'POST',  headers: getAuthHeaders(token), 
        body: JSON.stringify({
          action: 'UPDATE', taskId: editModal.task.id, productId: editModal.task.productId,
          newStatus: editModal.status, newIsDisplayed: editModal.isDisplayed === 'true',
          executeAt: executeTimeIso, token, communityId
        })
      });
      if (!response.ok) throw new Error();

      setTasks(prev => prev.map(t => t.id === editModal.task.id ? {
          ...t, newStatus: editModal.status, newIsDisplayed: editModal.isDisplayed === 'true',
          executeAt: new Date(`${editModal.date}T${editModal.time}`).getTime(),
          logs: [`✅ ${new Date().toLocaleTimeString()} - 예약 수정됨.`, ...t.logs]
      } : t)); 
      
      setEditModal({ ...editModal, isOpen: false });
      showToast('예약이 수정되었습니다.', 'success');
    } catch (err) {
      showToast('수정 실패', 'error');
    }
  };

  const translateStatus = (s) => ({ scheduled: '판매예정', onSale: '판매중', soldOut: '품절', completed: '판매종료' }[s] || s);

  const displayedTasks = tasks.filter(task => products.some(p => p.id === task.productId));

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans text-gray-800">
        <CustomUI />
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
          <div className="bg-blue-600 p-8 text-center" style={{ backgroundColor: '#2563eb' }}>
            <h1 className="text-2xl font-bold text-white mb-2">VAKE Workspace</h1>
            <p className="text-blue-100 text-sm">서비스 관리를 위해 로그인해주세요.</p>
          </div>

          <div className="flex border-b border-gray-200">
            <button 
              onClick={() => setLoginMode('seller')}
              className={`flex-1 py-4 text-sm font-bold transition ${loginMode === 'seller' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              판매자 로그인 (Seller)
            </button>
            <button 
              onClick={() => setLoginMode('admin')}
              className={`flex-1 py-4 text-sm font-bold transition ${loginMode === 'admin' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              어드민 로그인 (Admin)
            </button>
          </div>
          
          <form onSubmit={handleOAuthLogin} className="p-8 space-y-6">
            {loginMode === 'seller' ? (
              <div className="bg-blue-50 border border-blue-100 p-6 rounded-xl text-center">
                <p className="text-blue-800 font-bold mb-2">👋 본인의 계정으로 접속합니다.</p>
                <p className="text-blue-600 text-xs leading-relaxed">로그인 완료 시, 프로필에서 판매자 ID(CS:...)를<br/>자동으로 추출하여 상품 목록을 불러옵니다.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-gray-50 border border-gray-200 p-3 rounded-lg text-xs text-gray-600">어드민 권한으로 특정 판매자의 상품 목록을 조회합니다.</div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Target Seller ID</label>
                  <input 
                    type="text" value={sellerId} onChange={e => setSellerId(e.target.value)}
                    placeholder="ex) CS:P8XLJRM3" className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                  />
                </div>
              </div>
            )}

            <button 
              type="submit" disabled={isLoginProcessing}
              className="w-full text-white font-bold py-4 rounded-xl shadow-md transition hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#2563eb' }}
            >
              {isLoginProcessing ? '인증 진행 중...' : 'CANpass로 로그인하기'}
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
             <span className="bg-gray-100 text-gray-600 border text-xs font-bold px-3 py-1.5 rounded-md">ID: {sellerId || '로딩중...'}</span>
             <span className={`text-xs font-bold px-3 py-1.5 rounded-md border ${loginMode === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>{loginMode.toUpperCase()}</span>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6 bg-gray-50">
          {activeTab === 'productList' && (
            <div className="max-w-6xl mx-auto space-y-4">
              <div className="bg-white p-6 rounded-xl shadow-sm border">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-lg">내 판매 상품 목록</h3>
                  <button onClick={fetchProducts} disabled={isLoading} className="px-4 py-2 bg-gray-100 text-sm font-bold rounded-lg hover:bg-gray-200">새로고침</button>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-left bg-white text-sm">
                    <thead className="bg-gray-50 border-b text-gray-500">
                      <tr><th className="p-4">상품명</th><th className="p-4">가격</th><th className="p-4 text-center">상태</th><th className="p-4 text-center">진열</th></tr>
                    </thead>
                    <tbody className="divide-y">
                      {products.length === 0 ? (
                        <tr><td colSpan="4" className="p-12 text-center text-gray-400">등록된 상품이 없거나 불러오는 중입니다.</td></tr>
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

          {activeTab === 'schedule' && (
             <div className="max-w-4xl mx-auto space-y-6">
                <div className="bg-white p-8 rounded-xl shadow-sm border border-t-4 border-t-blue-600">
                  <h3 className="font-bold text-lg mb-6">새 상태 변경 예약 등록</h3>
                  <form onSubmit={handlePreSubmit} className="space-y-5">
                    <div className="relative">
                      <label className="block text-sm font-bold text-gray-700 mb-2">1. 대상 상품 선택</label>
                      <input 
                        type="text" value={productSearchTerm} 
                        onChange={e => { setProductSearchTerm(e.target.value); setIsProductSelectOpen(true); }}
                        placeholder="상품명 또는 ID 검색..." 
                        className="w-full px-4 py-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                      />
                      {isProductSelectOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border shadow-xl rounded-lg z-50 max-h-56 overflow-y-auto divide-y">
                          {products.filter(p => p.name.includes(productSearchTerm) || p.id.includes(productSearchTerm)).map(p => (
                            <div key={p.id} onClick={() => handleSelectProduct(p)} className="p-3 hover:bg-blue-50 cursor-pointer text-sm">
                              <b>{p.name}</b> <span className="text-xs text-gray-400 ml-2">({p.id})</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">2. 변경할 상태</label>
                        <select value={scheduleForm.status} onChange={e => setScheduleForm({...scheduleForm, status: e.target.value})} className="w-full px-4 py-2.5 border rounded-lg"><option value="onSale">판매중</option><option value="soldOut">품절</option><option value="completed">판매종료</option></select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">3. 진열 여부</label>
                        <select value={scheduleForm.isDisplayed} onChange={e => setScheduleForm({...scheduleForm, isDisplayed: e.target.value})} className="w-full px-4 py-2.5 border rounded-lg"><option value="true">진열함</option><option value="false">진열안함</option></select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">4. 예약 실행 일시</label>
                      <input type="datetime-local" value={confirmedDateTime} onChange={e => setConfirmedDateTime(e.target.value)} className="w-full px-4 py-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-blue-600" />
                    </div>
                    <button type="submit" className="w-full py-3.5 text-white font-bold rounded-xl shadow-lg mt-4" style={{ backgroundColor: '#2563eb' }}>AWS 클라우드 예약 전송</button>
                  </form>
                </div>
                <div className="bg-white p-6 rounded-xl border">
                   <h3 className="font-bold border-b pb-3 mb-4">현재 대기 중인 예약 내역</h3>
                   {tasks.length === 0 ? <div className="text-center py-10 text-gray-400">예약된 작업이 없습니다.</div> : tasks.map(t => (
                     <div key={t.id} className="p-4 bg-blue-50 border border-blue-100 rounded-xl mb-3 flex justify-between items-center">
                        <div>
                          <div className="font-bold text-sm text-gray-900">{t.productName}</div>
                          <div className="text-xs text-gray-500 mt-1">{new Date(t.executeAt).toLocaleString()} | {translateStatus(t.newStatus)} | {t.newIsDisplayed ? '진열' : '숨김'}</div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => openEditModal(t)} className="text-xs font-bold text-blue-600 px-3 py-1.5 bg-white border border-blue-200 rounded-lg hover:bg-blue-50">수정</button>
                          <button onClick={() => handleDeleteTask(t)} className="text-xs font-bold text-red-600 px-3 py-1.5 bg-white border border-red-200 rounded-lg hover:bg-red-50">취소</button>
                        </div>
                     </div>
                   ))}
                </div>
             </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow-sm border space-y-6">
              <h3 className="text-lg font-bold border-b pb-4">시스템 정보 및 세션 현황</h3>
              <div className="space-y-4 text-sm">
                <div><label className="text-gray-400 font-bold block mb-1">Login Mode</label><div className="font-bold text-blue-600">{loginMode.toUpperCase()}</div></div>
                <div><label className="text-gray-400 font-bold block mb-1">Active Seller ID</label><div className="p-2 bg-gray-50 rounded border font-mono">{sellerId}</div></div>
                <div><label className="text-gray-400 font-bold block mb-1">Community ID</label><div className="font-mono">{communityId}</div></div>
                <div><label className="text-gray-400 font-bold block mb-1">Scopes</label><div className="text-xs break-all opacity-70">{SCOPES}</div></div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* 예약 등록 모달 */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-xl font-bold mb-4">예약을 등록할까요?</h3>
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsConfirmModalOpen(false)} className="px-4 py-2 bg-gray-100 rounded-lg font-bold">취소</button>
              <button onClick={handleConfirmRegister} className="px-4 py-2 text-white rounded-lg font-bold" style={{ backgroundColor: '#2563eb' }}>예약 전송</button>
            </div>
          </div>
        </div>
      )}

      {/* 예약 수정 모달 */}
      {editModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-lg font-bold mb-4 border-b pb-2 text-blue-700">예약 전송 수정</h3>
            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">날짜 변경</label>
                  <input type="date" value={editModal.date} onChange={e => setEditModal({...editModal, date: e.target.value})} className="w-full border p-2.5 text-sm rounded-lg outline-none focus:ring-2 focus:ring-blue-500"/>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">시간 변경</label>
                  <input type="time" value={editModal.time} onChange={e => setEditModal({...editModal, time: e.target.value})} className="w-full border p-2.5 text-sm rounded-lg outline-none focus:ring-2 focus:ring-blue-500"/>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditModal({...editModal, isOpen: false})} className="px-4 py-2 bg-gray-200 rounded font-medium text-sm">취소</button>
              <button onClick={handleConfirmEdit} className="px-4 py-2 bg-blue-600 text-white rounded font-bold text-sm shadow-sm hover:bg-blue-700">수정 저장하기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
