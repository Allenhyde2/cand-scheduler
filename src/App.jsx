import React, { useState, useEffect } from 'react';

const DEFAULT_GROUP_ID = 'G0IZUDWCL';
const API_BASE_URL = 'https://api.cand.xyz'; 
const SCHEDULER_API_URL = 'https://2fb8b65g8f.execute-api.ap-southeast-2.amazonaws.com/schedule';
const CLIENT_ID = '4582f19ca0325304d27abbd18a36b21b'; // 발급받으신 캔패스 Client ID

// --- PKCE 인증을 위한 난수 생성 함수 (캔패스 공식 문서 기반) ---
const createCodeVerifier = () => btoa(String.fromCharCode(...new Uint8Array(crypto.getRandomValues(new Uint8Array(32))))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const createCodeChallenge = async (verifier) => btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest("SHA-256", (new TextEncoder()).encode(verifier))))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState('');
  const [communityId] = useState(DEFAULT_GROUP_ID); 
  const [sellerId, setSellerId] = useState(''); 
  
  const [activeTab, setActiveTab] = useState('productList'); 
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' }); 
  const [confirmDialog, setConfirmDialog] = useState({ visible: false, message: '', onConfirm: null });

  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoginProcessing, setIsLoginProcessing] = useState(false);
  
  const [tasks, setTasks] = useState([]);

  const [scheduleForm, setScheduleForm] = useState({
    productId: '',
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
    isOpen: false,
    task: null,
    status: '',
    isDisplayed: 'true',
    date: '',
    time: ''
  });

  const showToast = (message, type = 'info') => {
    setToast({ visible: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 3500);
  };

  const showConfirm = (message, onConfirm) => {
    setConfirmDialog({ visible: true, message, onConfirm });
  };

  const closeConfirm = () => {
    setConfirmDialog({ visible: false, message: '', onConfirm: null });
  };

  // --- OAuth 로그인 콜백 처리 및 기존 세션 복구 ---
  useEffect(() => {
    const handleOAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const stateParam = urlParams.get('state');
      const error = urlParams.get('error');

      if (error) {
        showToast(`로그인 취소/실패: ${urlParams.get('error_description')}`, 'error');
        // 에러 시 주소창을 깨끗하게 정리합니다 (기본 경로로 이동)
        window.history.replaceState({}, document.title, '/');
        return;
      }

      if (code && stateParam) {
        setIsLoginProcessing(true);
        const savedState = sessionStorage.getItem('oauth_state');
        const codeVerifier = sessionStorage.getItem('oauth_verifier');
        const savedSellerId = localStorage.getItem('cand_seller_id');

        if (stateParam !== savedState) {
          showToast('비정상적인 로그인 접근입니다.', 'error');
          setIsLoginProcessing(false);
          return;
        }

        try {
          const res = await fetch('https://canpass.me/oauth2/token', {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              grant_type: 'authorization_code',
              client_id: CLIENT_ID,
              code: code,
              code_verifier: codeVerifier
            })
          });

          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error_description || '토큰 발급 실패');
          }

          const data = await res.json();
          const accessToken = data.access_token;
          
          const loggedInSellerId = savedSellerId || '';

          setToken(accessToken);
          setSellerId(loggedInSellerId);
          setIsAuthenticated(true);
          localStorage.setItem('cand_token', accessToken);
          localStorage.setItem('cand_seller_id', loggedInSellerId);

          fetchProductsWithArgs(accessToken, DEFAULT_GROUP_ID, loggedInSellerId);
          fetchScheduledTasks(accessToken, DEFAULT_GROUP_ID);
          showToast('캔패스 로그인이 완료되었습니다.', 'success');

        } catch (err) {
          showToast(`로그인 처리 중 오류 발생: ${err.message}`, 'error');
        } finally {
          setIsLoginProcessing(false);
          // 성공 후 주소창을 깔끔하게 '/' 로 돌려놓습니다 (/canpass/callback 경로를 지움)
          window.history.replaceState({}, document.title, '/');
          sessionStorage.removeItem('oauth_state');
          sessionStorage.removeItem('oauth_verifier');
        }
      } 
      else {
        const savedSellerId = localStorage.getItem('cand_seller_id');
        const savedRecentProducts = localStorage.getItem('cand_recent_products');
        
        if (savedSellerId) setSellerId(savedSellerId);
        if (savedRecentProducts) {
          try { setRecentProducts(JSON.parse(savedRecentProducts)); } catch(e) {}
        }
      }
    };

    handleOAuthCallback();
  }, []);

  // --- 캔패스 로그인 버튼 클릭 시 실행 ---
  const handleOAuthLogin = async (e) => {
    e.preventDefault();
    const cleanSellerId = sellerId.trim();

    if (!cleanSellerId) {
      showToast('판매자 ID를 먼저 입력해주세요.', 'error');
      return;
    }

    localStorage.setItem('cand_seller_id', cleanSellerId);

    const codeVerifier = createCodeVerifier();
    const codeChallenge = await createCodeChallenge(codeVerifier);
    const state = JSON.stringify({ nonce: Math.random().toString(), key: 'cand-admin' });

    sessionStorage.setItem('oauth_verifier', codeVerifier);
    sessionStorage.setItem('oauth_state', state);

    // ⭐️ 핵심 수정 부분: 백엔드에 등록된 URI 규칙과 정확히 동일하게 /canpass/callback 을 붙여서 보냅니다.
    const redirectUri = `${window.location.origin}/canpass/callback`;

    const authUrl = new URL('https://canpass.me/oauth2/authorize');
    authUrl.search = new URLSearchParams({
      response_type: 'code',
      action: 'signin',
      client_id: CLIENT_ID,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      redirect_uri: redirectUri,
      community_id: DEFAULT_GROUP_ID,
      state: state
    }).toString();

    window.location.href = authUrl.toString();
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setActiveTab('productList');
    setToken('');
    localStorage.removeItem('cand_token');
  };

  const getAuthHeaders = (currentToken, currentCommunityId) => ({
    'content-type': 'application/json',
    'authorization': `Bearer ${currentToken || token}`,
    'x-can-community-id': currentCommunityId || communityId,
  });

  const fetchScheduledTasks = async (currentToken, currentCommunityId) => {
    try {
      const res = await fetch(SCHEDULER_API_URL, {
        method: 'POST',
        headers: getAuthHeaders(currentToken, currentCommunityId), 
        body: JSON.stringify({
          action: 'LIST', 
          token: currentToken,
          communityId: currentCommunityId
        })
      });
      
      if (!res.ok) throw new Error(`스케줄러 응답 오류: ${res.status}`);
      
      const data = await res.json();
      const fetchedList = data.tasks || [];
      
      setTasks(fetchedList.map(task => ({
        ...task,
        logs: task.logs || [`☁️ 서버에서 로드된 예약 건입니다.`]
      })));
    } catch (err) {
      console.error('예약 목록 조회 실패:', err);
      showToast('예약 목록을 가져오지 못했습니다.', 'error');
    }
  };

  const fetchProductsWithArgs = async (currentToken, currentCommunityId, currentSellerId) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/products?limit=100`, {
        headers: getAuthHeaders(currentToken, currentCommunityId)
      });
      if (!res.ok) throw new Error(`API 오류: ${res.status}`);
      const data = await res.json();
      
      const allProducts = Array.isArray(data) ? data : 
                          (Array.isArray(data?.data) ? data.data : 
                          (Array.isArray(data?.items) ? data.items : []));
      
      const targetSellerId = String(currentSellerId || sellerId).trim();

      const myProducts = allProducts.filter(p => {
        const pSellerId = String(p.sellerId || p.userId || '').trim(); 
        return pSellerId === targetSellerId;
      });

      setProducts(myProducts);
      showToast('해당 판매자의 상품 목록을 불러왔습니다.', 'success');
    } catch (err) {
      console.error('목록 로드 실패 상세 에러:', err);
      showToast('목록 로드 실패: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProducts = () => {
    fetchProductsWithArgs(token, communityId, sellerId);
  };

  const handleSelectProduct = (product) => {
    setScheduleForm({ ...scheduleForm, productId: product.id });
    setProductSearchTerm(product.name);
    setIsProductSelectOpen(false);

    const newRecents = [product, ...recentProducts.filter(p => p.id !== product.id)].slice(0, 5);
    setRecentProducts(newRecents);
    localStorage.setItem('cand_recent_products', JSON.stringify(newRecents));
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(productSearchTerm.toLowerCase()) || 
    p.id.toLowerCase().includes(productSearchTerm.toLowerCase())
  );

  const openDatePicker = () => {
    const initialDateObj = confirmedDateTime ? new Date(confirmedDateTime) : new Date();
    const tzoffset = initialDateObj.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(initialDateObj.getTime() - tzoffset)).toISOString().slice(0, 16);
    const [d, t] = localISOTime.split('T');
    
    setPickerDate(d);
    setPickerTime(t);
    setIsDatePickerOpen(true);
  };

  const handleConfirmDatePicker = () => {
    if (!pickerDate || !pickerTime) {
      showToast('날짜와 시간을 모두 입력해주세요.', 'error');
      return;
    }
    setConfirmedDateTime(`${pickerDate}T${pickerTime}`);
    setIsDatePickerOpen(false);
  };

  const handlePreSubmit = (e) => {
    e.preventDefault();
    if (!scheduleForm.productId) return showToast('상품을 선택해주세요.', 'error');
    if (!confirmedDateTime) return showToast('시간을 선택해주세요.', 'error');
    setIsConfirmModalOpen(true);
  };

  const handleConfirmRegister = async () => {
    const targetProduct = products.find(p => p.id === scheduleForm.productId);
    const executeTimeIso = new Date(confirmedDateTime).toISOString();
    const newTaskId = Math.random().toString(36).substr(2, 9); 

    try {
      showToast('예약을 등록 중입니다...', 'info');
      const response = await fetch(SCHEDULER_API_URL, {
        method: 'POST',
        headers: getAuthHeaders(token, communityId),
        body: JSON.stringify({
          action: 'CREATE', 
          taskId: newTaskId,
          productId: scheduleForm.productId,
          newStatus: scheduleForm.status,
          newIsDisplayed: scheduleForm.isDisplayed === 'true',
          executeAt: executeTimeIso,
          token: token,
          communityId: communityId
        })
      });

      if (!response.ok) throw new Error("서버 응답 오류");

      setTasks(prev => [{
        id: newTaskId,
        productId: scheduleForm.productId,
        productName: targetProduct ? targetProduct.name : scheduleForm.productId,
        newStatus: scheduleForm.status,
        newIsDisplayed: scheduleForm.isDisplayed === 'true',
        executeAt: new Date(confirmedDateTime).getTime(),
        status: 'cloud_scheduled', 
        logs: ['✅ 예약이 성공적으로 등록되었습니다.'],
      }, ...prev]);

      setIsConfirmModalOpen(false);
      setConfirmedDateTime('');
      setProductSearchTerm('');
      setScheduleForm({ ...scheduleForm, productId: '' });
      showToast('예약이 등록되었습니다.', 'success');
    } catch (err) {
      showToast(`예약 실패: ${err.message}`, 'error');
    }
  };

  const handleDeleteTask = async (task) => {
    if (!window.confirm(`예약을 삭제하시겠습니까?`)) return;
    try {
      const response = await fetch(SCHEDULER_API_URL, {
        method: 'POST', 
        headers: getAuthHeaders(token, communityId),
        body: JSON.stringify({
          action: 'DELETE', 
          taskId: task.id,
          token: token,
          communityId: communityId
        })
      });
      if (!response.ok) throw new Error("삭제 실패");
      setTasks(prev => prev.filter(t => t.id !== task.id));
      showToast('예약이 삭제되었습니다.', 'success');
    } catch (err) {
      showToast(`에러: ${err.message}`, 'error');
    }
  };

  const openEditModal = (task) => {
    const d = new Date(task.executeAt);
    const tzoffset = d.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(d.getTime() - tzoffset)).toISOString().slice(0, 16);
    const [date, time] = localISOTime.split('T');
    setEditModal({ isOpen: true, task, status: task.newStatus, isDisplayed: task.newIsDisplayed ? 'true' : 'false', date, time });
  };

  const handleConfirmEdit = async () => {
    const executeTimeIso = new Date(`${editModal.date}T${editModal.time}`).toISOString();
    try {
      const response = await fetch(SCHEDULER_API_URL, {
        method: 'POST', 
        headers: getAuthHeaders(token, communityId),
        body: JSON.stringify({
          action: 'UPDATE',
          taskId: editModal.task.id,
          productId: editModal.task.productId,
          newStatus: editModal.status,
          newIsDisplayed: editModal.isDisplayed === 'true',
          executeAt: executeTimeIso,
          token: token,
          communityId: communityId
        })
      });
      if (!response.ok) throw new Error("수정 실패");
      setTasks(prev => prev.map(t => t.id === editModal.task.id ? {
        ...t,
        newStatus: editModal.status,
        newIsDisplayed: editModal.isDisplayed === 'true',
        executeAt: new Date(`${editModal.date}T${editModal.time}`).getTime(),
      } : t)); 
      setEditModal({ ...editModal, isOpen: false });
      showToast('수정이 완료되었습니다.', 'success');
    } catch (err) {
      showToast(`에러: ${err.message}`, 'error');
    }
  };

  const translateStatus = (s) => {
    const m = { scheduled: '판매예정', onSale: '판매중', soldOut: '품절', completed: '판매종료' };
    return m[s] || s;
  };

  const displayedTasks = tasks.filter(task => products.some(p => String(p.id) === String(task.productId)));

  const CustomUI = () => (
    <div>
      {toast.visible && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100]">
          <div className="px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm font-bold text-white" style={{ backgroundColor: '#1f2937' }}>{toast.message}</div>
        </div>
      )}
    </div>
  );

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <CustomUI />
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
          <div className="p-8 text-center border-b-4 border-blue-700" style={{ backgroundColor: '#2563eb' }}>
            <h1 className="text-2xl font-bold text-white mb-2">canD Admin</h1>
            <p className="text-blue-100 text-sm">서비스 관리를 위해 로그인해주세요.</p>
          </div>
          <form onSubmit={handleOAuthLogin} className="p-8 space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Group ID (고정)</label>
              <input 
                type="text" 
                value={communityId} 
                readOnly 
                className="w-full px-4 py-2 border rounded-lg bg-gray-200 text-gray-500 cursor-not-allowed outline-none" 
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">판매자 ID (Seller ID)</label>
              <input 
                type="text" 
                value={sellerId} 
                onChange={e => setSellerId(e.target.value)} 
                placeholder="ex) CS:P8XLJRM3" 
                className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" 
                required 
              />
            </div>
            <button 
              type="submit" 
              disabled={isLoginProcessing}
              className="w-full text-white font-bold py-3 rounded-lg hover:opacity-90 transition-opacity flex justify-center items-center gap-2 disabled:opacity-50"
              style={{ backgroundColor: '#2563eb' }}
            >
              {isLoginProcessing ? '인증 처리 중...' : 'CANpass로 로그인'}
            </button>
            <p className="text-xs text-center text-gray-400 mt-2">
              버튼을 누르면 토큰 발급을 위해 CANpass 인증 페이지로 이동합니다.
            </p>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 text-gray-800 font-sans overflow-hidden">
      <CustomUI />
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-0 hidden'} flex-shrink-0 bg-white border-r border-gray-200 transition-all duration-300 flex flex-col`}>
        <div className="h-16 border-b border-gray-100 flex items-center justify-center shrink-0">
          <span className="text-xl font-bold">Admin<span style={{ color: '#2563eb' }}>Dash</span></span>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-1">
          <button onClick={() => setActiveTab('productList')} className={`w-full text-left px-4 py-2.5 rounded-lg text-sm ${activeTab === 'productList' ? 'font-bold' : 'text-gray-600 hover:bg-gray-50'}`} style={activeTab === 'productList' ? { backgroundColor: '#eff6ff', color: '#2563eb' } : {}}>상품 목록</button>
          <button onClick={() => setActiveTab('schedule')} className={`w-full text-left px-4 py-2.5 rounded-lg text-sm ${activeTab === 'schedule' ? 'font-bold' : 'text-gray-600 hover:bg-gray-50'}`} style={activeTab === 'schedule' ? { backgroundColor: '#eff6ff', color: '#2563eb' } : {}}>상태 예약</button>
          
          <div className="mt-8 border-t pt-4">
             <button onClick={() => setActiveTab('settings')} className={`w-full text-left px-4 py-2.5 rounded-lg text-sm ${activeTab === 'settings' ? 'text-gray-900 font-bold' : 'text-gray-600 hover:bg-gray-50'}`} style={activeTab === 'settings' ? { backgroundColor: '#f3f4f6' } : {}}>설정 정보</button>
          </div>

          <button onClick={handleLogout} className="w-full text-left px-4 py-2.5 text-sm text-gray-400 hover:text-red-500 mt-10">로그아웃</button>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-xl">≡</button>
            <h2 className="text-lg font-bold">
              {activeTab === 'productList' && '판매 상품 목록'}
              {activeTab === 'schedule' && '상태 예약 변경'}
              {activeTab === 'settings' && '시스템 설정 정보'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-gray-100 text-gray-600 text-xs font-bold px-3 py-1 rounded-md border">Seller: {sellerId}</span>
            <span className="text-xs font-bold px-3 py-1 rounded-md border border-blue-200" style={{ backgroundColor: '#eff6ff', color: '#1d4ed8' }}>PRODUCTION</span>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'productList' && (
            <div className="max-w-6xl mx-auto bg-white p-6 rounded-xl shadow-sm border">
              <div className="flex justify-between mb-6">
                <h3 className="text-lg font-semibold">나의 상품 현황</h3>
                <button onClick={fetchProducts} disabled={isLoading} className="px-4 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200 transition-colors">새로고침</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500 border-b">
                    <tr><th className="p-4">상품 정보</th><th className="p-4 text-center">상태</th><th className="p-4 text-center">진열</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {products.length === 0 ? (
                      <tr><td colSpan="3" className="p-8 text-center text-gray-400">데이터가 없거나 해당 판매자의 상품이 아닙니다.</td></tr>
                    ) : (
                      products.map(p => (
                        <tr key={p.id} className="hover:bg-gray-50 text-sm">
                          <td className="p-4"><div><b>{p.name}</b></div><div className="text-xs text-gray-400 font-mono">{p.id}</div></td>
                          <td className="p-4 text-center">
                            <span className="px-2 py-1 rounded-full text-xs font-bold" style={p.status === 'onSale' ? { backgroundColor: '#dcfce7', color: '#15803d' } : { backgroundColor: '#f3f4f6', color: '#374151' }}>
                              {translateStatus(p.status)}
                            </span>
                          </td>
                          <td className="p-4 text-center">{p.isDisplayed ? '진열중' : '숨김'}</td>
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
              <div className="bg-white p-6 rounded-xl shadow-sm border border-t-4 border-t-blue-600">
                <h3 className="text-lg font-semibold mb-6">새 예약 등록</h3>
                <form onSubmit={handlePreSubmit} className="space-y-4">
                  <div className="relative">
                    <label className="block text-sm font-semibold mb-1">1. 나의 상품 검색</label>
                    <input type="text" placeholder="상품명 입력..." value={productSearchTerm} onChange={e => {setProductSearchTerm(e.target.value); setIsProductSelectOpen(true);}} onFocus={() => setIsProductSelectOpen(true)} className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                    {isProductSelectOpen && filteredProducts.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border rounded-lg shadow-xl z-20 max-h-48 overflow-y-auto">
                        {filteredProducts.map(p => (
                          <button key={p.id} type="button" onClick={() => handleSelectProduct(p)} className="w-full text-left p-3 text-sm border-b last:border-0 hover:bg-gray-50" style={scheduleForm.productId === p.id ? { backgroundColor: '#eff6ff' } : {}}>
                            <b>{p.name}</b> <span className="text-xs text-gray-400 ml-2">{p.id}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold mb-1">2. 변경 상태</label>
                      <select className="w-full p-2 border rounded-lg outline-none" value={scheduleForm.status} onChange={e => setScheduleForm({...scheduleForm, status: e.target.value})}>
                        <option value="scheduled">판매예정</option><option value="onSale">판매중</option><option value="soldOut">품절</option><option value="completed">판매종료</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">3. 진열 여부</label>
                      <select className="w-full p-2 border rounded-lg outline-none" value={scheduleForm.isDisplayed} onChange={e => setScheduleForm({...scheduleForm, isDisplayed: e.target.value})}>
                        <option value="true">진열함</option><option value="false">숨김</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">4. 실행 일시</label>
                    <div onClick={openDatePicker} className="w-full p-2 border rounded-lg cursor-pointer bg-gray-50">{confirmedDateTime ? new Date(confirmedDateTime).toLocaleString() : '일시 선택...'}</div>
                    {isDatePickerOpen && (
                      <div className="p-4 border rounded-lg mt-2 bg-white shadow-inner space-y-3">
                        <div className="flex gap-2"><input type="date" value={pickerDate} onChange={e => setPickerDate(e.target.value)} className="flex-1 p-2 border rounded outline-none"/><input type="time" value={pickerTime} onChange={e => setPickerTime(e.target.value)} className="flex-1 p-2 border rounded outline-none"/></div>
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => setIsDatePickerOpen(false)} className="text-sm px-3 py-1 bg-gray-100 rounded">취소</button>
                          <button type="button" onClick={handleConfirmDatePicker} className="text-sm px-3 py-1 text-white rounded font-bold hover:opacity-90" style={{ backgroundColor: '#2563eb' }}>확정</button>
                        </div>
                      </div>
                    )}
                  </div>
                  <button type="submit" className="w-full py-3 text-white font-bold rounded-lg hover:opacity-90 transition-opacity" style={{ backgroundColor: '#2563eb' }}>예약 전송하기</button>
                </form>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border">
                <div className="flex justify-between mb-4">
                  <h3 className="text-lg font-bold">나의 진행 중인 예약</h3>
                  <button onClick={() => fetchScheduledTasks(token, communityId)} className="text-xs font-bold hover:opacity-80" style={{ color: '#2563eb' }}>목록 갱신</button>
                </div>
                <div className="space-y-4">
                  {displayedTasks.length === 0 ? <div className="text-center py-10 text-gray-400 border-2 border-dashed rounded-xl text-sm">대기 중인 나의 예약이 없습니다.</div> : (
                    displayedTasks.map(t => (
                      <div key={t.id} className="p-4 border rounded-xl border-blue-100 flex justify-between items-start" style={{ backgroundColor: '#eff6ff' }}>
                        <div>
                          <div className="font-bold mb-1">{t.productName || t.productId}</div>
                          <div className="text-xs text-gray-500">
                            {translateStatus(t.newStatus)} | {t.newIsDisplayed?'진열':'숨김'} | <b>{new Date(t.executeAt).toLocaleString()}</b>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => openEditModal(t)} className="px-2 py-1 bg-white border text-xs font-bold rounded shadow-sm hover:bg-gray-50">수정</button>
                          <button onClick={() => handleDeleteTask(t)} className="px-2 py-1 bg-white border border-red-100 text-xs font-bold rounded shadow-sm hover:bg-red-50" style={{ color: '#ef4444' }}>삭제</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
             <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow-sm border border-gray-200">
               <h3 className="text-lg font-bold mb-6">시스템 API 설정 현황</h3>
               <div className="space-y-5 text-sm">
                 <div>
                   <label className="block text-gray-500 font-bold mb-1">canD API ENDPOINT</label>
                   <input type="text" readOnly value={API_BASE_URL} className="w-full bg-gray-50 border border-gray-200 p-2.5 rounded font-mono outline-none" />
                 </div>
                 <div>
                   <label className="block text-gray-500 font-bold mb-1">AWS 스케줄러(Lambda) API 주소</label>
                   <input type="text" readOnly value={SCHEDULER_API_URL} className="w-full border border-blue-200 p-2.5 rounded font-mono font-bold outline-none" style={{ backgroundColor: '#eff6ff', color: '#1e3a8a' }} />
                 </div>
                 <div className="pt-4 border-t border-gray-100">
                   <label className="block text-gray-500 font-bold mb-1">현재 접속 그룹 ID</label>
                   <input type="text" readOnly value={communityId} className="w-full bg-gray-50 border border-gray-200 p-2.5 rounded font-mono text-gray-600 outline-none" />
                 </div>
                 <div className="pt-4 border-t border-gray-100">
                   <label className="block text-gray-500 font-bold mb-1">현재 접속 판매자 ID</label>
                   <input type="text" readOnly value={sellerId} className="w-full bg-gray-50 border border-gray-200 p-2.5 rounded font-mono text-gray-600 outline-none" />
                 </div>
                 <div className="pt-4 border-t border-gray-100">
                   <label className="block text-gray-500 font-bold mb-1">CANpass Client ID</label>
                   <input type="text" readOnly value={CLIENT_ID} className="w-full bg-gray-50 border border-gray-200 p-2.5 rounded font-mono text-gray-600 outline-none" />
                 </div>
               </div>
             </div>
          )}
        </div>
      </main>

      {isConfirmModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="font-bold text-lg mb-4">예약을 등록할까요?</h3>
            <div className="text-sm bg-gray-50 p-4 rounded-lg mb-6">
              <p><b>상품:</b> {products.find(p => p.id === scheduleForm.productId)?.name}</p>
              <p><b>실행:</b> {new Date(confirmedDateTime).toLocaleString()}</p>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsConfirmModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded-lg">취소</button>
              <button onClick={handleConfirmRegister} className="px-4 py-2 text-white font-bold rounded-lg hover:opacity-90" style={{ backgroundColor: '#2563eb' }}>등록 확정</button>
            </div>
          </div>
        </div>
      )}

      {editModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="font-bold text-lg mb-4">예약 수정</h3>
            <div className="space-y-4 mb-6">
              <div className="flex gap-2">
                <select value={editModal.status} onChange={e => setEditModal({...editModal, status: e.target.value})} className="flex-1 p-2 border rounded outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="scheduled">판매예정</option>
                  <option value="onSale">판매중</option>
                  <option value="soldOut">품절</option>
                  <option value="completed">판매종료</option>
                </select>
                <select value={editModal.isDisplayed} onChange={e => setEditModal({...editModal, isDisplayed: e.target.value})} className="flex-1 p-2 border rounded outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="true">진열함 (표시)</option>
                  <option value="false">진열안함 (숨김)</option>
                </select>
              </div>
              <div className="flex gap-2">
                <input type="date" value={editModal.date} onChange={e => setEditModal({...editModal, date: e.target.value})} className="flex-1 p-2 border rounded outline-none focus:ring-2 focus:ring-blue-500"/>
                <input type="time" value={editModal.time} onChange={e => setEditModal({...editModal, time: e.target.value})} className="flex-1 p-2 border rounded outline-none focus:ring-2 focus:ring-blue-500"/>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditModal({...editModal, isOpen: false})} className="px-4 py-2 bg-gray-200 rounded-lg">취소</button>
              <button onClick={handleConfirmEdit} className="px-4 py-2 text-white font-bold rounded-lg hover:opacity-90" style={{ backgroundColor: '#2563eb' }}>수정 저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
