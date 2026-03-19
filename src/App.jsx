import React, { useState, useEffect, useRef } from 'react';

const DEFAULT_GROUP_ID = 'G0IZUDWCL';
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
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoginProcessing, setIsLoginProcessing] = useState(false);
  const [tasks, setTasks] = useState([]);

  // ⭐️ productId 단일 선택에서 products 배열 다중 선택으로 업그레이드
  const [scheduleForm, setScheduleForm] = useState({
    products: [],
    status: 'onSale',
    isDisplayed: 'true',
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
    isOpen: false, task: null, status: '', isDisplayed: 'true', date: '', time: '', isDatePickerOpen: false
  });

  // ⭐️ 외부 클릭 감지를 위한 Refs
  const productSelectRef = useRef(null);
  const datePickerRef = useRef(null);
  const editDatePickerRef = useRef(null);

  // ⭐️ 외부 영역 클릭 시 드랍다운/모달을 닫아주는 범용 이벤트 리스너
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (productSelectRef.current && !productSelectRef.current.contains(event.target)) {
        setIsProductSelectOpen(false);
      }
      if (datePickerRef.current && !datePickerRef.current.contains(event.target)) {
        setIsDatePickerOpen(false);
      }
      if (editDatePickerRef.current && !editDatePickerRef.current.contains(event.target)) {
        setEditModal(prev => ({ ...prev, isDatePickerOpen: false }));
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const showToast = (message, type = 'info') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3500);
  };

  const getAuthHeaders = (currentToken) => ({
    'content-type': 'application/json',
    'authorization': `Bearer ${currentToken || token}`,
    'x-can-community-id': communityId,
  });

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

      let res = await fetch(`https://cand-scheduler.vercel.app/api/proxy?endpoint=users/me`, fetchOptions);
      if (!res.ok) res = await fetch(`https://cand-scheduler.vercel.app/api/proxy?endpoint=me`, fetchOptions);
      if (!res.ok) throw new Error("유저 프로필 정보를 가져오지 못했습니다.");
      
      const data = await res.json();
      let sellerProfileId = data.profiles?.find(p => p.profileId && p.profileId.startsWith('CS:'))?.profileId;
      
      if (!sellerProfileId && data.id) {
        const bulkRes = await fetch(`https://cand-scheduler.vercel.app/api/proxy?endpoint=users/bulk`, {
          method: 'POST', headers: fetchOptions.headers, body: JSON.stringify({ ids: [data.id] })
        });
        if (bulkRes.ok) {
          const bulkData = await bulkRes.json();
          const userData = Array.isArray(bulkData) ? bulkData[0] : bulkData;
          sellerProfileId = userData?.profiles?.find(p => p.profileId && p.profileId.startsWith('CS:'))?.profileId;
        }
      }
      return sellerProfileId || null; 
    } catch (err) {
      return null;
    }
  };

  const handleManualSaveSellerId = (inputId) => {
    const cleanId = (inputId || '').trim();
    if (!cleanId) return showToast('판매자 아이디를 정확히 입력해주세요.', 'error');
    setSellerId(cleanId);
    localStorage.setItem('cand_seller_id', cleanId);
    showToast(`셀러 ID(${cleanId})가 세팅되었습니다. 목록을 불러옵니다.`, 'success');
  };

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
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ client_id: CLIENT_ID, code: code, code_verifier: codeVerifier, redirect_uri: redirectUri })
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data.error_description || '토큰 발급 실패');

          const accessToken = data.access_token;
          let finalSellerId = '';

          if (savedLoginMode === 'admin') {
            finalSellerId = savedAdminTargetId || '';
          } else {
            const autoId = await autoFetchSellerId(accessToken);
            if (autoId) { finalSellerId = autoId; } 
            else { showToast('보안 정책으로 셀러 ID 자동 탐지에 실패했습니다. 대시보드에서 수동으로 입력해주세요.', 'info'); }
          }

          setToken(accessToken);
          setSellerId(finalSellerId);
          setLoginMode(savedLoginMode);
          setIsAuthenticated(true);
          
          localStorage.setItem('cand_token', accessToken);
          localStorage.setItem('cand_seller_id', finalSellerId);
          localStorage.setItem('cand_login_mode', savedLoginMode);
          
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
        if (savedToken) {
          setToken(savedToken);
          setSellerId(savedSellerId || '');
          setLoginMode(savedMode);
          setIsAuthenticated(true);
        }
      }
    };
    handleOAuthCallback();
  }, []);

  const handleOAuthLogin = async (e) => {
    e.preventDefault();
    if (loginMode === 'admin') {
      localStorage.setItem('cand_admin_target_id', sellerId.trim());
    } else {
      localStorage.setItem('cand_admin_target_id', '');
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
    localStorage.removeItem('cand_token');
    localStorage.removeItem('cand_seller_id');
    localStorage.removeItem('cand_login_mode');
    setIsAuthenticated(false);
    setToken('');
    setSellerId('');
    setProducts([]); 
    setTasks([]);
    showToast('로그아웃 되었습니다.');
  };

  const fetchProductsWithArgs = async (currentToken, currentSellerId, currentMode) => {
    if (currentMode === 'seller' && !currentSellerId) return;
    setIsLoading(true);
    try {
      const url = `https://cand-scheduler.vercel.app/api/proxy?endpoint=products&limit=100`;
      const res = await fetch(url, { method: 'GET', headers: getAuthHeaders(currentToken) });
      const data = await res.json();
      const list = data.data || [];
      let filtered = list;
      if (currentSellerId) {
        filtered = list.filter(p => (p.sellerId || p.userId || p.creatorId) === currentSellerId);
      }
      setProducts(filtered);
    } catch (err) {
      showToast('상품 목록 로드에 실패했습니다.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchScheduledTasks = async (currentToken) => {
    try {
      const res = await fetch(SCHEDULER_API_URL, {
        method: 'POST', headers: getAuthHeaders(currentToken), 
        body: JSON.stringify({ action: 'LIST', token: currentToken, communityId })
      });
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch (err) {}
  };

  useEffect(() => {
    if (isAuthenticated && token) {
      if (loginMode === 'admin' || sellerId) {
        fetchProductsWithArgs(token, sellerId, loginMode);
      }
      fetchScheduledTasks(token);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, token, sellerId, loginMode]);

  const fetchProducts = () => fetchProductsWithArgs(token, sellerId, loginMode);

  // ⭐️ 상품 선택 시 카드 목록에 추가하고 인풋을 리셋하는 로직
  const handleSelectProduct = (product) => {
    if (!scheduleForm.products.find(p => p.id === product.id)) {
      setScheduleForm({ ...scheduleForm, products: [...scheduleForm.products, product] });
    }
    setProductSearchTerm('');
    setIsProductSelectOpen(false);

    const newRecents = [product, ...recentProducts.filter(p => p.id !== product.id)].slice(0, 5);
    setRecentProducts(newRecents);
    localStorage.setItem('cand_recent_products', JSON.stringify(newRecents));
  };

  // ⭐️ 선택된 상품 카드 삭제 로직
  const handleRemoveProduct = (productId) => {
    setScheduleForm({
      ...scheduleForm,
      products: scheduleForm.products.filter(p => p.id !== productId)
    });
  };

  // ⭐️ 인풋박스 내 Enter 키 동작 (제일 상단 항목 자동 선택)
  const handleProductKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const matched = products.filter(p => p.name.includes(productSearchTerm) || p.id.includes(productSearchTerm));
      if (matched.length > 0) {
        handleSelectProduct(matched[0]);
      }
    }
  };

  // ⭐️ 날짜 선택기 열기 (현재 시간 기준 세팅)
  const openDatePicker = () => {
    const initialDateObj = confirmedDateTime ? new Date(confirmedDateTime) : new Date();
    const tzoffset = initialDateObj.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(initialDateObj.getTime() - tzoffset)).toISOString().slice(0, 16);
    const [d, t] = localISOTime.split('T');
    
    setPickerDate(d);
    setPickerTime(t);
    setIsDatePickerOpen(true);
  };

  const handlePreSubmit = (e) => {
    e.preventDefault();
    if (scheduleForm.products.length === 0) return showToast('최소 1개 이상의 상품을 선택해주세요.', 'error');
    if (!confirmedDateTime) return showToast('실행 일시를 설정해주세요.', 'error');
    if (new Date(confirmedDateTime).getTime() <= Date.now()) return showToast('실행 시간은 현재 시간 이후여야 합니다.', 'error');
    setIsConfirmModalOpen(true);
  };

  const handleConfirmRegister = async () => {
    setIsConfirmModalOpen(false);
    showToast('예약 전송 중...', 'info');
    try {
      const newTasks = [];
      // ⭐️ 선택된 여러 상품들에 대해 병렬로 API 전송
      await Promise.all(scheduleForm.products.map(async (prod) => {
        const newTaskId = Math.random().toString(36).substr(2, 9);
        const res = await fetch(SCHEDULER_API_URL, {
          method: 'POST',
          headers: getAuthHeaders(token),
          body: JSON.stringify({
            action: 'CREATE', taskId: newTaskId, productId: prod.id,
            newStatus: scheduleForm.status, newIsDisplayed: scheduleForm.isDisplayed === 'true',
            executeAt: new Date(confirmedDateTime).toISOString(), token, communityId
          })
        });
        if (!res.ok) throw new Error();
        newTasks.push({
          id: newTaskId, productId: prod.id, productName: prod.name,
          newStatus: scheduleForm.status, newIsDisplayed: scheduleForm.isDisplayed === 'true',
          executeAt: new Date(confirmedDateTime).getTime(), status: 'cloud_scheduled', 
          logs: ['✅ AWS EventBridge에 성공적으로 등록되었습니다.']
        });
      }));

      setTasks(prev => [...newTasks, ...prev]);
      setConfirmedDateTime('');
      setScheduleForm({ ...scheduleForm, products: [] });
      showToast(`${scheduleForm.products.length}건의 상품 예약이 전송되었습니다!`, 'success');
    } catch (err) { 
      showToast('예약 전송 중 오류가 발생했습니다.', 'error'); 
    }
  };

  const handleDeleteTask = async (task) => {
    if (!window.confirm('예약을 취소하시겠습니까?')) return;
    try {
      await fetch(SCHEDULER_API_URL, {
        method: 'POST', headers: getAuthHeaders(token),
        body: JSON.stringify({ action: 'DELETE', taskId: task.id, token, communityId })
      });
      showToast('예약이 취소되었습니다.');
      setTasks(prev => prev.filter(t => t.id !== task.id));
    } catch (err) { showToast('실패'); }
  };

  const openEditModal = (task) => {
    const d = new Date(task.executeAt);
    const tzoffset = d.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(d.getTime() - tzoffset)).toISOString().slice(0, 16);
    const [date, time] = localISOTime.split('T');

    setEditModal({
      isOpen: true, task, status: task.newStatus,
      isDisplayed: task.newIsDisplayed ? 'true' : 'false', date, time, isDatePickerOpen: false
    });
  };

  const handleConfirmEdit = async () => {
    if (!editModal.date || !editModal.time) return showToast('수정할 날짜와 시간을 확인해주세요.', 'error');
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
          logs: [`✅ ${new Date().toLocaleTimeString()} - 예약 정보가 수정되었습니다.`, ...t.logs]
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
        <div className={`px-5 py-3.5 rounded-lg shadow-2xl text-sm font-bold text-white tracking-wide ${toast.type === 'error' ? 'bg-red-600' : toast.type === 'warning' ? 'bg-yellow-600' : 'bg-gray-800'}`}>
          {toast.message}
        </div>
      </div>
    )
  );

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen w-full bg-gray-50 flex items-center justify-center p-4 font-sans text-gray-800">
        <CustomUI />
        <div className="max-w-md w-full mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
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
                <p className="text-blue-800 font-bold mb-2">👋 판매자 계정으로 접속합니다.</p>
                <p className="text-blue-600 text-xs leading-relaxed">VAKE 상거래 시스템에 연동된 판매자 계정으로 로그인하여 상품 및 예약 상태를 간편하게 관리할 수 있습니다.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl text-xs text-gray-600 leading-relaxed">
                  어드민 권한으로 VAKE 시스템의 상품을 조회합니다.<br />
                  <span className="text-blue-600 font-bold mt-1 inline-block">* 판매자 ID를 비워두면 <b>전체 커뮤니티 상품</b>이 조회됩니다.</span>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Target Seller ID (선택)</label>
                  <input 
                    type="text" value={sellerId} onChange={e => setSellerId(e.target.value)}
                    placeholder="특정 판매자 조회 시 입력 (ex: CS:P8XLJRM3)" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" 
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
    <div className="flex h-screen w-full bg-gray-50 text-gray-800 font-sans overflow-hidden">
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
        <div className="p-4 border-t"><button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-500 font-bold hover:bg-red-50 rounded-lg transition">로그아웃</button></div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b flex items-center justify-between px-6 flex-shrink-0 relative">
          <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: '#2563eb' }}></div>
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-xl font-bold">≡</button>
            <h2 className="text-lg font-bold">{activeTab === 'productList' ? '상품 현황' : activeTab === 'schedule' ? '예약 설정' : '접속 정보'}</h2>
          </div>
          <div className="flex items-center gap-2">
             <span className="bg-gray-100 text-gray-600 border text-xs font-bold px-3 py-1.5 rounded-md">ID: {sellerId ? sellerId : (loginMode === 'admin' ? '전체 조회' : '미설정')}</span>
             <span className={`text-xs font-bold px-3 py-1.5 rounded-md border ${loginMode === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>{loginMode.toUpperCase()}</span>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6 bg-gray-50">
          {activeTab === 'productList' && (
            <div className="max-w-6xl mx-auto space-y-4">
              <div className="bg-white p-6 rounded-xl shadow-sm border">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-lg">{loginMode === 'admin' && !sellerId ? '전체 상품 목록' : '내 판매 상품 목록'}</h3>
                  {(loginMode === 'admin' || sellerId) && <button onClick={fetchProducts} disabled={isLoading} className="px-4 py-2 bg-gray-100 text-sm font-bold rounded-lg hover:bg-gray-200 transition">새로고침</button>}
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-left bg-white text-sm">
                    <thead className="bg-gray-50 border-b text-gray-500">
                      <tr><th className="p-4">상품명</th><th className="p-4">가격</th><th className="p-4 text-center">상태</th><th className="p-4 text-center">진열</th></tr>
                    </thead>
                    <tbody className="divide-y">
                      {(loginMode === 'seller' && !sellerId) ? (
                        <tr><td colSpan="4" className="p-12 text-center text-gray-500 bg-gray-50">
                          <p className="mb-2 font-bold text-gray-700 text-base">⚠️ 셀러 ID 자동 탐지에 실패했습니다.</p>
                          <p className="text-sm mb-6 text-gray-500">백엔드 API 권한 문제로 아이디를 가져오지 못했습니다. 아래에 직접 입력해주세요.</p>
                          <div className="flex justify-center max-w-sm mx-auto shadow-sm rounded-lg overflow-hidden">
                            <input type="text" id="manualInputFallback" placeholder="ex) CS:P8XLJRM3" className="w-full px-4 py-2.5 border border-gray-300 outline-none" />
                            <button onClick={() => handleManualSaveSellerId(document.getElementById('manualInputFallback').value)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 transition shrink-0">저장 및 조회</button>
                          </div>
                        </td></tr>
                      ) : isLoading ? (
                        <tr><td colSpan="4" className="p-16 text-center bg-gray-50/50">
                          <div className="flex flex-col items-center justify-center space-y-4">
                            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                            <p className="font-bold text-blue-600 animate-pulse">상품 데이터를 안전하게 불러오는 중입니다...</p>
                          </div>
                        </td></tr>
                      ) : products.length === 0 ? (
                        <tr><td colSpan="4" className="p-12 text-center text-gray-400">등록된 상품이 없습니다.</td></tr>
                      ) : (
                        products.map(p => (
                          <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                            <td className="p-4 font-bold">{p.name}<div className="text-xs text-gray-400 font-mono mt-1">{p.id}</div></td>
                            <td className="p-4">{p.price?.toLocaleString()} {p.currency}</td>
                            <td className="p-4 text-center"><span className={`px-2 py-1 rounded-full text-xs font-bold ${p.status === 'onSale' ? 'bg-green-100 text-green-700' : 'bg-gray-100'}`}>{translateStatus(p.status)}</span></td>
                            <td className="p-4 text-center">{p.isDisplayed ? <span className="text-blue-600 font-bold">진열중</span> : <span className="text-gray-400">숨김</span>}</td>
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
                    
                    {/* ⭐️ 개선된 상품 선택 로직 (다중 선택 및 외부 클릭 감지 적용) */}
                    <div className="relative" ref={productSelectRef}>
                      <label className="block text-sm font-bold text-gray-700 mb-2">1. 대상 상품 선택 (다중 선택 가능)</label>
                      <input 
                        type="text" value={productSearchTerm} 
                        onChange={e => { setProductSearchTerm(e.target.value); setIsProductSelectOpen(true); }}
                        onFocus={() => setIsProductSelectOpen(true)}
                        onKeyDown={handleProductKeyDown}
                        placeholder="텍스트 입력 후 엔터(Enter) 또는 목록 클릭" 
                        className="w-full px-4 py-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                      />
                      
                      {isProductSelectOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border shadow-xl rounded-lg z-40 max-h-56 overflow-y-auto divide-y">
                          {productSearchTerm === '' && recentProducts.length > 0 && (
                            <div className="p-2 border-b bg-gray-50 text-xs font-bold text-gray-500">최근 선택 항목</div>
                          )}
                          {products.filter(p => p.name.includes(productSearchTerm) || p.id.includes(productSearchTerm)).map(p => (
                            <div key={p.id} onClick={() => handleSelectProduct(p)} className="p-3 hover:bg-blue-50 cursor-pointer text-sm">
                              <b>{p.name}</b> <span className="text-xs text-gray-400 ml-2">({p.id})</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* ⭐️ 선택된 상품 카드 출력 (삭제 버튼 포함) */}
                      {scheduleForm.products.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3 p-3 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                          {scheduleForm.products.map(prod => (
                            <div key={prod.id} className="flex items-center bg-white border border-blue-200 shadow-sm text-blue-800 px-3 py-1.5 rounded-lg text-sm">
                              <span className="font-bold mr-3">{prod.name}</span>
                              <button type="button" onClick={() => handleRemoveProduct(prod.id)} className="text-gray-400 hover:text-red-500 font-bold transition flex items-center justify-center">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                              </button>
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
                    
                    {/* ⭐️ 개선된 예약 일시 팝오버 애드온 UI */}
                    <div className="relative" ref={datePickerRef}>
                      <label className="block text-sm font-bold text-gray-700 mb-2">4. 예약 실행 일시</label>
                      <div 
                        onClick={openDatePicker} 
                        className="w-full px-4 py-2.5 border rounded-lg bg-white cursor-pointer hover:border-blue-400 transition flex justify-between items-center group"
                      >
                        <span className={confirmedDateTime ? 'text-gray-900 font-bold' : 'text-gray-400'}>
                          {confirmedDateTime ? new Date(confirmedDateTime).toLocaleString() : '클릭하여 예약 시간을 설정하세요'}
                        </span>
                        <span className="text-gray-400 group-hover:text-blue-500">📅</span>
                      </div>

                      {isDatePickerOpen && (
                        <div className="absolute left-0 mt-2 bg-white border border-gray-200 shadow-2xl rounded-2xl p-5 w-72 z-50">
                          <h4 className="text-sm font-bold text-gray-800 mb-4 border-b pb-2">실행 일시 세팅</h4>
                          <div className="space-y-4 mb-6">
                            <div>
                              <label className="block text-xs font-bold text-gray-500 mb-1.5">선택된 날짜</label>
                              <input type="date" value={pickerDate} onChange={e => setPickerDate(e.target.value)} className="w-full border border-gray-300 px-3 py-2 text-sm rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-500 mb-1.5">선택된 시간</label>
                              <input type="time" value={pickerTime} onChange={e => setPickerTime(e.target.value)} className="w-full border border-gray-300 px-3 py-2 text-sm rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                          </div>
                          <button 
                            type="button" 
                            onClick={() => {
                              if(!pickerDate || !pickerTime) return showToast('날짜와 시간을 지정해주세요.', 'warning');
                              setConfirmedDateTime(`${pickerDate}T${pickerTime}`);
                              setIsDatePickerOpen(false);
                            }} 
                            className="w-full py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition shadow-sm flex items-center justify-center gap-2"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>
                            ✅ 이 시간으로 결정
                          </button>
                        </div>
                      )}
                    </div>

                    <button type="submit" className="w-full py-4 text-white font-bold rounded-xl shadow-lg mt-4 transition hover:opacity-90 text-lg" style={{ backgroundColor: '#2563eb' }}>
                      AWS 클라우드 예약 일괄 전송
                    </button>
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
                          <button onClick={() => openEditModal(t)} className="text-xs font-bold text-blue-600 px-3 py-1.5 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition">수정</button>
                          <button onClick={() => handleDeleteTask(t)} className="text-xs font-bold text-red-600 px-3 py-1.5 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition">취소</button>
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
                
                <div className="pt-4 border-t border-gray-100">
                  <label className="text-gray-500 font-bold block mb-2">현재 활성화된 판매자 ID</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" value={sellerId} onChange={e => setSellerId(e.target.value)} 
                      className="flex-1 bg-gray-50 border border-gray-200 p-2.5 rounded font-mono text-gray-700 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none" 
                    />
                    <button onClick={() => handleManualSaveSellerId(sellerId)} className="px-5 py-2.5 bg-gray-800 text-white font-bold rounded hover:bg-gray-900 transition">저장</button>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100"><label className="text-gray-400 font-bold block mb-1">Community ID</label><div className="font-mono bg-gray-50 p-2 rounded border">{communityId}</div></div>
                <div className="pt-4 border-t border-gray-100"><label className="text-gray-400 font-bold block mb-1">Scopes</label><div className="text-xs break-all opacity-70">{SCOPES}</div></div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* 예약 다중 전송 확인 모달 */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4 border-b pb-3">예약을 등록할까요?</h3>
            <div className="space-y-3 text-sm bg-gray-50 p-4 rounded-xl border mb-6 max-h-48 overflow-y-auto">
              <p><b>대상 상품:</b> {scheduleForm.products.map(p => p.name).join(', ')} <span className="text-blue-600 font-bold">(총 {scheduleForm.products.length}건)</span></p>
              <p><b>변경 상태:</b> {translateStatus(scheduleForm.status)}</p>
              <p><b>진열 상태:</b> {scheduleForm.isDisplayed === 'true' ? '표시' : '숨김'}</p>
              <p className="text-blue-600 border-t pt-2 mt-2 font-bold"><b>실행 시간:</b> {new Date(confirmedDateTime).toLocaleString()}</p>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsConfirmModalOpen(false)} className="px-4 py-2 bg-gray-100 rounded-lg font-bold hover:bg-gray-200 transition">취소</button>
              <button onClick={handleConfirmRegister} className="px-4 py-2 text-white rounded-lg font-bold transition hover:opacity-90" style={{ backgroundColor: '#2563eb' }}>예약 전송 승인</button>
            </div>
          </div>
        </div>
      )}

      {/* 예약 수정 모달 */}
      {editModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-lg font-bold mb-4 border-b pb-2 text-blue-700">예약 전송 수정</h3>
            <div className="space-y-5 mb-6">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">대상 상품</label>
                <div className="w-full bg-gray-50 p-2.5 text-sm rounded-lg text-gray-700 font-bold border">{editModal.task.productName}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">상태 변경</label>
                  <select value={editModal.status} onChange={e => setEditModal({...editModal, status: e.target.value})} className="w-full border p-2.5 text-sm rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="scheduled">판매예정</option><option value="onSale">판매중</option><option value="soldOut">품절</option><option value="completed">판매종료</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">진열 변경</label>
                  <select value={editModal.isDisplayed} onChange={e => setEditModal({...editModal, isDisplayed: e.target.value})} className="w-full border p-2.5 text-sm rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="true">진열함 (표시)</option><option value="false">진열안함 (숨김)</option>
                  </select>
                </div>
              </div>
              
              {/* ⭐️ 수정 모달 내부의 통일된 날짜 선택 UI 애드온 */}
              <div className="relative" ref={editDatePickerRef}>
                <label className="block text-xs font-bold text-gray-500 mb-1">일시 변경</label>
                <div 
                  onClick={() => setEditModal({...editModal, isDatePickerOpen: !editModal.isDatePickerOpen})} 
                  className="w-full border p-2.5 text-sm rounded-lg bg-white cursor-pointer flex justify-between items-center hover:border-blue-400 transition"
                >
                  <span className="font-bold">{editModal.date && editModal.time ? new Date(`${editModal.date}T${editModal.time}`).toLocaleString() : '시간 설정'}</span>
                  <span className="text-gray-400">📅</span>
                </div>

                {editModal.isDatePickerOpen && (
                  <div className="absolute left-0 mt-2 bg-white border border-gray-200 shadow-2xl rounded-2xl p-5 w-72 z-50">
                    <div className="space-y-4 mb-5">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">날짜 선택</label>
                        <input type="date" value={editModal.date} onChange={e => setEditModal({...editModal, date: e.target.value})} className="w-full border px-3 py-2 text-sm rounded-lg outline-none focus:ring-2 focus:ring-blue-500"/>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">시간 선택</label>
                        <input type="time" value={editModal.time} onChange={e => setEditModal({...editModal, time: e.target.value})} className="w-full border px-3 py-2 text-sm rounded-lg outline-none focus:ring-2 focus:ring-blue-500"/>
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setEditModal({...editModal, isDatePickerOpen: false})} 
                      className="w-full py-2 bg-blue-600 text-white font-bold rounded-lg shadow-sm hover:bg-blue-700 transition"
                    >
                      ✅ 이 시간으로 결정
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t pt-4">
              <button onClick={() => setEditModal({...editModal, isOpen: false})} className="px-5 py-2.5 bg-gray-100 rounded-lg font-bold text-sm hover:bg-gray-200 transition">취소</button>
              <button onClick={handleConfirmEdit} className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-bold text-sm shadow-md hover:bg-blue-700 transition">수정 저장하기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
