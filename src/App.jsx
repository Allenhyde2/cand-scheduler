import React, { useState, useEffect } from 'react';

const DEFAULT_GROUP_ID = 'G0IZUDWCL';
const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const SCHEDULER_API_URL = 'https://2fb8b65g8f.execute-api.ap-southeast-2.amazonaws.com/schedule';
const CLIENT_ID = '4582f19ca0325304d27abbd18a36b21b'; 
const SCOPES = 'email poll option vote addresses member:MOIM:payment:read member:MOIM:product:read member:MOIM:product:write';

const createCodeVerifier = () => btoa(String.fromCharCode(...new Uint8Array(crypto.getRandomValues(new Uint8Array(32))))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const createCodeChallenge = async (verifier) => btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest("SHA-256", (new TextEncoder()).encode(verifier))))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

// JWT 파싱 함수
const parseJwt = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};

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

  // ⭐️ 탐지기 전용 상태
  const [discoveryLogs, setDiscoveryLogs] = useState("");
  const [isDiscovering, setIsDiscovering] = useState(false);

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
        const savedSellerId = localStorage.getItem('cand_seller_id');
        const savedLoginMode = sessionStorage.getItem('cand_login_mode') || 'seller';

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
          if (!res.ok) throw new Error(data.error_description || data.error || '토큰 발급 실패');

          const accessToken = data.access_token;
          const initialSellerId = savedSellerId || ''; 

          setLoginMode(savedLoginMode);
          setToken(accessToken);
          setSellerId(initialSellerId); 
          setIsAuthenticated(true);
          
          localStorage.setItem('cand_token', accessToken);
          localStorage.setItem('cand_seller_id', initialSellerId);
          localStorage.setItem('cand_login_mode', savedLoginMode);

          // 로그인 성공 후 셀러 ID가 없으면 탐지기 탭으로 자동 이동
          if (savedLoginMode === 'seller' && !initialSellerId) {
            setActiveTab('discovery');
            showToast('셀러 ID가 없습니다. 탐지기를 이용해 ID를 찾아주세요.', 'info');
          } else {
            fetchProductsWithArgs(accessToken, DEFAULT_GROUP_ID, initialSellerId, savedLoginMode);
            fetchScheduledTasks(accessToken, DEFAULT_GROUP_ID);
          }
          
        } catch (err) {
          showToast(`로그인 오류: ${err.message}`, 'error');
        } finally {
          setIsLoginProcessing(false);
          window.history.replaceState({}, document.title, '/');
          sessionStorage.removeItem('oauth_state');
          sessionStorage.removeItem('oauth_verifier');
          sessionStorage.removeItem('cand_login_mode');
        }
      } 
      else {
        // 기존 로그인 세션 복구
        const savedToken = localStorage.getItem('cand_token');
        const savedSellerId = localStorage.getItem('cand_seller_id');
        const savedMode = localStorage.getItem('cand_login_mode') || 'seller';
        
        if (savedToken) {
          setToken(savedToken);
          setSellerId(savedSellerId || '');
          setLoginMode(savedMode);
          setIsAuthenticated(true);

          if (savedMode === 'seller' && !savedSellerId) {
             setActiveTab('discovery');
          } else {
             fetchProductsWithArgs(savedToken, DEFAULT_GROUP_ID, savedSellerId || '', savedMode);
             fetchScheduledTasks(savedToken, DEFAULT_GROUP_ID);
          }
        }
      }
    };
    handleOAuthCallback();
  }, []);

  const handleOAuthLogin = async (e) => {
    e.preventDefault();
    
    // ⭐️ 핵심: 판매자 모드일 경우 셀러 ID 입력을 '선택(Optional)'으로 변경합니다.
    const cleanSellerId = sellerId.trim();
    if (loginMode === 'admin' && !cleanSellerId) {
      return showToast('조회할 판매자 ID를 먼저 입력해주세요.', 'error');
    }
    
    localStorage.setItem('cand_seller_id', cleanSellerId);
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
      redirect_uri: redirectUri, community_id: DEFAULT_GROUP_ID, state: state, scope: SCOPES 
    }).toString();

    window.location.href = authUrl.toString();
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setActiveTab('productList');
    setToken('');
    setSellerId('');
    localStorage.removeItem('cand_token');
    localStorage.removeItem('cand_seller_id');
    localStorage.removeItem('cand_login_mode');
  };

  const getAuthHeaders = (currentToken, currentCommunityId) => ({
    'content-type': 'application/json',
    'authorization': `Bearer ${currentToken || token}`,
    'x-can-community-id': currentCommunityId || communityId,
  });

  // ⭐️ 셀러 ID 자동 탐지 로직 ⭐️
  const runSellerIdDiscovery = async () => {
    setIsDiscovering(true);
    setDiscoveryLogs("🕵️‍♂️ VAKE 시스템 스캔을 시작합니다...\n======================================\n");
    
    const appendLog = (text) => setDiscoveryLogs(prev => prev + text + "\n");
    const decodedPayload = parseJwt(token);
    const canpassUserId = decodedPayload ? (decodedPayload.userId || decodedPayload.canAccount) : '알수없음';
    
    appendLog(`[1단계] 토큰 해독 완료\n- JWT 내 User ID: ${canpassUserId}\n`);

    // 찔러볼 잠재적 API 주소들
    const endpointsToTry = [
      { name: "내 커머스 상점 조회 (sellers/me)", url: `https://cand-scheduler.vercel.app/api/proxy?endpoint=sellers/me` },
      { name: "전체 셀러 목록 스캔 (admin/sellers)", url: `https://cand-scheduler.vercel.app/api/proxy?endpoint=admin/sellers&limit=50` },
      { name: "어드민 권한 셀러 스캔 (sellers)", url: `https://cand-scheduler.vercel.app/api/proxy?endpoint=sellers&limit=50` },
      // 슬랙에서 태우님이 언급한 API (직접 호출)
      { name: "모임 유저 프로필 직접 호출", url: `https://moim.co/api/admin/users/${canpassUserId}`, direct: true } 
    ];

    let foundIds = new Set();

    for (const ep of endpointsToTry) {
      appendLog(`\n📡 [스캔 중] ${ep.name} ...`);
      try {
        const fetchOptions = {
          method: 'GET',
          headers: ep.direct ? { 'Authorization': `Bearer ${token}` } : getAuthHeaders(token, communityId)
        };

        const res = await fetch(ep.url, fetchOptions);
        const text = await res.text();
        appendLog(`응답 상태 코드: ${res.status}`);

        // 정규식으로 CS: 로 시작하는 모든 패턴 스캔
        const csMatches = text.match(/CS:[A-Z0-9]+/g);
        
        if (csMatches && csMatches.length > 0) {
          appendLog(`  => 응답 데이터에서 'CS:' 패턴 발견!`);
          csMatches.forEach(id => foundIds.add(id));
        } else {
          appendLog(`  => 데이터 내 셀러 ID 없음.`);
        }
      } catch (err) {
        appendLog(`  => 통신 오류: ${err.message}`);
      }
    }

    appendLog("\n======================================");
    if (foundIds.size > 0) {
      appendLog(`🎉 탐색 완료! 다음 셀러 ID들을 발견했습니다:`);
      [...foundIds].forEach(id => appendLog(`👉 ${id}`));
      appendLog(`\n이 중 본인의 상점 ID를 복사하여 아래 입력창에 저장하세요!`);
    } else {
      appendLog(`😥 탐색 실패. 데이터 내에서 'CS:' 패턴을 찾지 못했습니다.`);
      appendLog(`백엔드 개발자에게 "로그인 한 유저의 셀러 ID(CS:...)를 조회하는 API 주소"를 문의해야 합니다.`);
    }

    setIsDiscovering(false);
  };

  const handleManualSaveSellerId = () => {
    const cleanId = sellerId.trim();
    if(!cleanId) return showToast('아이디를 입력해주세요.', 'error');
    localStorage.setItem('cand_seller_id', cleanId);
    showToast(`셀러 ID(${cleanId})가 저장되었습니다. 상품 목록을 불러옵니다.`, 'success');
    setActiveTab('productList');
    fetchProductsWithArgs(token, communityId, cleanId, loginMode);
  };

  const fetchScheduledTasks = async (currentToken, currentCommunityId) => {
    try {
      const res = await fetch(SCHEDULER_API_URL, {
        method: 'POST',
        headers: getAuthHeaders(currentToken, currentCommunityId), 
        body: JSON.stringify({ action: 'LIST', token: currentToken, communityId: currentCommunityId })
      });
      if (!res.ok) return setTasks([]);
      const data = await res.json();
      const fetchedList = data.tasks || data.data || (Array.isArray(data) ? data : []);
      const formattedTasks = fetchedList.map(task => ({
        ...task, logs: task.logs || [`☁️ 서버에서 저장된 예약 정보를 불러왔습니다. (${new Date().toLocaleTimeString()})`]
      }));
      setTasks(formattedTasks);
    } catch (err) {}
  };

  const fetchProductsWithArgs = async (currentToken, currentCommunityId, currentSellerId, currentMode) => {
    if(!currentSellerId) return; // 셀러 아이디가 없으면 조회하지 않음
    setIsLoading(true);
    try {
      const activeToken = currentToken || token;
      const activeCommunityId = currentCommunityId || communityId;

      const url = `https://cand-scheduler.vercel.app/api/proxy?endpoint=products&limit=100`;
      const res = await fetch(url, { method: 'GET', headers: getAuthHeaders(activeToken, activeCommunityId) });
      const responseText = await res.text();
      if (!res.ok) throw new Error(`API 오류: ${res.status}`);
      
      const data = JSON.parse(responseText);
      let fetchedList = data.data || [];

      // 항상 입력/저장된 셀러 ID로 강제 필터링
      fetchedList = fetchedList.filter(p => {
        const idField = p.userId || p.sellerId || p.creatorId; 
        return idField ? idField === currentSellerId : true;
      });

      setProducts(fetchedList);
      showToast('상품 목록 조회 완료', 'success');
    } catch (err) {
      showToast('목록 로드 실패: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProducts = () => fetchProductsWithArgs(token, communityId, sellerId, loginMode);

  // ... 하위 함수 생략 (기존과 완벽히 동일) ...
  const handleSelectProduct = (product) => {
    setScheduleForm({ ...scheduleForm, productId: product.id });
    setProductSearchTerm(product.name);
    setIsProductSelectOpen(false);
    const newRecents = [product, ...recentProducts.filter(p => p.id !== product.id)].slice(0, 5);
    setRecentProducts(newRecents);
    localStorage.setItem('cand_recent_products', JSON.stringify(newRecents));
  };

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(productSearchTerm.toLowerCase()) || p.id.toLowerCase().includes(productSearchTerm.toLowerCase()));

  const openDatePicker = () => {
    const initialDateObj = confirmedDateTime ? new Date(confirmedDateTime) : new Date();
    const tzoffset = initialDateObj.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(initialDateObj.getTime() - tzoffset)).toISOString().slice(0, 16);
    const [d, t] = localISOTime.split('T');
    setPickerDate(d); setPickerTime(t); setIsDatePickerOpen(true);
  };

  const handleConfirmDatePicker = () => {
    if (!pickerDate || !pickerTime) return showToast('날짜와 시간을 모두 입력해주세요.', 'error');
    setConfirmedDateTime(`${pickerDate}T${pickerTime}`);
    setIsDatePickerOpen(false);
  };

  const handlePreSubmit = (e) => {
    e.preventDefault();
    if (!scheduleForm.productId) return showToast('대상 상품을 검색하여 선택해주세요.', 'error');
    if (!confirmedDateTime) return showToast('실행 일시를 선택해주세요.', 'error');
    if (new Date(confirmedDateTime).getTime() <= Date.now()) return showToast('실행 시간은 현재 시간 이후여야 합니다.', 'error');
    setIsConfirmModalOpen(true);
  };

  const handleConfirmRegister = async () => {
    const targetProduct = products.find(p => p.id === scheduleForm.productId);
    const executeTimeIso = new Date(confirmedDateTime).toISOString();
    const newTaskId = Math.random().toString(36).substr(2, 9); 

    try {
      showToast('AWS 클라우드에 예약을 전송 중입니다...', 'info');
      const response = await fetch(SCHEDULER_API_URL, {
        method: 'POST', headers: getAuthHeaders(token, communityId), 
        body: JSON.stringify({
          action: 'CREATE', taskId: newTaskId, productId: scheduleForm.productId,
          newStatus: scheduleForm.status, newIsDisplayed: scheduleForm.isDisplayed === 'true',
          executeAt: executeTimeIso, token: token, communityId: communityId
        })
      });
      if (!response.ok) throw new Error(`AWS API 에러: ${await response.text()}`);

      const newTask = {
        id: newTaskId, productId: scheduleForm.productId,
        productName: targetProduct ? targetProduct.name : scheduleForm.productId,
        newStatus: scheduleForm.status, newIsDisplayed: scheduleForm.isDisplayed === 'true',
        executeAt: new Date(confirmedDateTime).getTime(), status: 'cloud_scheduled', 
        logs: ['✅ AWS EventBridge에 등록되었습니다.'],
      };

      setTasks(prev => [newTask, ...prev]);
      setIsConfirmModalOpen(false);
      setConfirmedDateTime(''); setProductSearchTerm(''); setScheduleForm({ ...scheduleForm, productId: '' });
      showToast('스케줄러에 예약이 등록되었습니다!', 'success');
    } catch (err) {
      showToast(`예약 실패: ${err.message}`, 'error');
      setIsConfirmModalOpen(false);
    }
  };

  const handleDeleteTask = async (task) => {
    if (!window.confirm(`[${task.productName}] 예약을 취소하시겠습니까?`)) return;
    try {
      showToast('예약을 삭제하는 중입니다...', 'info');
      const response = await fetch(SCHEDULER_API_URL, {
        method: 'POST', headers: getAuthHeaders(token, communityId), 
        body: JSON.stringify({ action: 'DELETE', taskId: task.id, token: token, communityId: communityId })
      });
      if (!response.ok) throw new Error(await response.text());
      
      setTasks(prev => prev.filter(t => t.id !== task.id));
      showToast('예약이 성공적으로 취소되었습니다.', 'success');
    } catch (err) {
      showToast(`삭제 실패: ${err.message}`, 'error');
    }
  };

  const translateStatus = (status) => {
    const map = { scheduled: '판매예정', onSale: '판매중', soldOut: '품절', completed: '판매종료' };
    return map[status] || status;
  };

  const displayedTasks = tasks.filter(task => products.some(p => p.id === task.productId));

  const CustomUI = () => (
    <div>
      {toast.visible && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100]">
          <div className="px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm font-bold text-white bg-gray-800">
            {typeof toast.message === 'object' ? JSON.stringify(toast.message) : String(toast.message)}
          </div>
        </div>
      )}
      {confirmDialog.visible && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-2">확인</h3>
            <p className="text-gray-600 mb-6">{typeof confirmDialog.message === 'object' ? JSON.stringify(confirmDialog.message) : String(confirmDialog.message)}</p>
            <div className="flex justify-end gap-2">
              <button onClick={closeConfirm} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg">취소</button>
              <button onClick={confirmDialog.onConfirm} className="px-4 py-2 text-white rounded-lg" style={{ backgroundColor: '#2563eb' }}>확인</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // --- 로그인 화면 ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
        <CustomUI />
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
          
          <div className="bg-blue-600 pt-8 pb-6 px-8 text-center" style={{ backgroundColor: '#2563eb' }}>
            <h1 className="text-2xl font-bold text-white mb-2">VAKE Workspace</h1>
            <p className="text-blue-100 text-sm font-medium">서비스 관리를 위해 로그인해주세요.</p>
          </div>

          <div className="flex border-b border-gray-200">
            <button onClick={() => setLoginMode('seller')} className={`flex-1 py-3 text-sm font-bold transition ${loginMode === 'seller' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>판매자용 (Seller)</button>
            <button onClick={() => setLoginMode('admin')} className={`flex-1 py-3 text-sm font-bold transition ${loginMode === 'admin' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>어드민용 (Admin)</button>
          </div>

          <form onSubmit={handleOAuthLogin} className="p-8 space-y-6">
            <div className="space-y-4">
              <div className="bg-gray-50 border border-gray-200 p-3 rounded-lg text-xs text-gray-600">
                {loginMode === 'seller' 
                  ? <p><b>판매자 모드:</b> 본인의 셀러 ID를 모르셔도 그냥 로그인 버튼을 누르시면 <b>자동 탐지기</b>가 실행됩니다.</p>
                  : <p><b>어드민 모드:</b> 전체 상품 데이터에 접근 가능합니다.</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {loginMode === 'seller' ? '나의 판매자 ID (선택)' : '조회할 판매자 ID (필수)'}
                </label>
                <input 
                  type="text" 
                  value={sellerId}
                  onChange={(e) => setSellerId(e.target.value)}
                  placeholder={loginMode === 'seller' ? '모르면 비워두세요!' : 'ex) CS:P8XLJRM3'}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                />
              </div>
            </div>
            <button type="submit" disabled={isLoginProcessing} className="w-full text-white font-bold py-3.5 rounded-xl hover:opacity-90 transition-opacity shadow-md disabled:opacity-50" style={{ backgroundColor: '#2563eb' }}>
              {isLoginProcessing ? '인증 처리 중...' : 'CANpass 계정으로 로그인'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- 메인 대시보드 화면 ---
  return (
    <div className="flex h-screen bg-gray-50 text-gray-800 font-sans overflow-hidden">
      <CustomUI />
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-0 hidden'} flex-shrink-0 bg-white border-r border-gray-200 transition-all duration-300 flex flex-col`}>
        <div className="h-16 border-b border-gray-100 flex items-center justify-center px-6 shrink-0">
          <span className="text-xl font-bold text-gray-900 tracking-tight">VAKE<span className="text-blue-600 ml-1">Work</span></span>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-4">
          <div className="px-4 mb-2"><span className="text-xs font-bold text-gray-400 uppercase">상품 관리</span></div>
          <ul className="space-y-1 px-3 mb-6">
            <li><button onClick={() => setActiveTab('productList')} className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium ${activeTab === 'productList' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}>판매 상품 목록</button></li>
            <li><button onClick={() => setActiveTab('schedule')} className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium ${activeTab === 'schedule' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}>상태 예약 변경</button></li>
          </ul>

          <div className="px-4 mb-2"><span className="text-xs font-bold text-gray-400 uppercase">도구 및 설정</span></div>
          <ul className="space-y-1 px-3">
            <li><button onClick={() => setActiveTab('discovery')} className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-bold flex items-center justify-between ${activeTab === 'discovery' ? 'bg-purple-50 text-purple-700' : 'text-purple-600 hover:bg-purple-50'}`}><span>셀러 ID 탐지기</span><span className="text-[10px] bg-purple-200 px-1.5 py-0.5 rounded">Beta</span></button></li>
            <li><button onClick={() => setActiveTab('settings')} className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium ${activeTab === 'settings' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}>접속 정보 확인</button></li>
          </ul>
        </nav>
        
        <div className="p-4 border-t border-gray-100">
          <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-gray-500 hover:text-red-500 font-bold">로그아웃</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0 relative">
          <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: '#2563eb' }}></div>
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-gray-500 hover:text-gray-700 font-bold text-xl">≡</button>
            <h2 className="text-lg font-bold text-gray-800">
              {activeTab === 'productList' && '판매 상품 목록'}
              {activeTab === 'schedule' && '상태 예약 설정'}
              {activeTab === 'discovery' && '셀러 ID 자동 탐지 도구'}
              {activeTab === 'settings' && '접속자 정보 및 API 세팅'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
             <span className="bg-gray-100 text-gray-600 border border-gray-200 text-xs font-bold px-3 py-1.5 rounded-md">ID: {sellerId || '세팅 안됨'}</span>
             <span className={`text-xs font-bold px-3 py-1.5 rounded-md border ${loginMode === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>{loginMode === 'admin' ? 'ADMIN' : 'SELLER'}</span>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6 bg-gray-50">
          
          {/* ⭐️ 셀러 ID 탐지기 탭 화면 ⭐️ */}
          {activeTab === 'discovery' && (
             <div className="max-w-4xl mx-auto space-y-4">
                <div className="bg-white p-8 rounded-xl shadow-sm border border-purple-200 border-t-4 border-t-purple-600">
                  <h3 className="text-lg font-bold text-purple-900 mb-2">🕵️‍♂️ 캔패스 연동 셀러 ID 탐지기</h3>
                  <p className="text-sm text-gray-600 mb-6">내 아이디를 몰라도 당황하지 마세요. 현재 발급받은 권한(토큰)으로 VAKE 시스템의 여러 API를 동시에 찔러 숨겨진 <b>CS: 형태의 셀러 아이디</b>를 찾아냅니다.</p>
                  
                  <div className="flex gap-3 mb-6">
                    <button onClick={runSellerIdDiscovery} disabled={isDiscovering} className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow-md transition disabled:opacity-50">
                      {isDiscovering ? '시스템 스캔 중...' : '자동 스캔 시작하기'}
                    </button>
                  </div>

                  <div className="bg-gray-900 rounded-xl p-4 font-mono text-sm text-green-400 min-h-[250px] max-h-[400px] overflow-y-auto shadow-inner">
                    {discoveryLogs ? (
                      <pre className="whitespace-pre-wrap">{discoveryLogs}</pre>
                    ) : (
                      <div className="text-gray-600 flex h-full items-center justify-center">스캔 대기 중... 버튼을 눌러주세요.</div>
                    )}
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-end gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-bold text-gray-700 mb-2">위에서 찾은 나의 판매자 ID (CS:...) 수동 입력</label>
                    <input type="text" value={sellerId} onChange={(e) => setSellerId(e.target.value)} placeholder="CS:P8XLJRM3" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <button onClick={handleManualSaveSellerId} className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition">이 아이디로 화면 세팅하기</button>
                </div>
             </div>
          )}

          {activeTab === 'productList' && (
            <div className="max-w-6xl mx-auto space-y-4">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">판매 상품 현황 조회</h3>
                  <button onClick={fetchProducts} disabled={isLoading} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">새로고침</button>
                </div>

                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left bg-white">
                    <thead className="bg-gray-50 text-gray-600 text-xs uppercase border-b border-gray-200">
                      <tr>
                        <th className="p-4 font-medium">상품명 / ID</th>
                        <th className="p-4 font-medium">가격</th>
                        <th className="p-4 font-medium text-center">판매상태</th>
                        <th className="p-4 font-medium text-center">진열여부</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {!sellerId ? (
                        <tr><td colSpan="4" className="p-12 text-center text-gray-500"><p className="mb-2 font-bold">판매자 ID가 세팅되지 않았습니다.</p><p className="text-sm">좌측 [셀러 ID 탐지기] 메뉴에서 아이디를 찾아서 입력해주세요.</p></td></tr>
                      ) : products.length === 0 ? (
                        <tr><td colSpan="4" className="p-8 text-center text-gray-500">조회된 상품이 없습니다.</td></tr>
                      ) : (
                        products.map(product => (
                          <tr key={product.id} className="hover:bg-gray-50">
                            <td className="p-4"><p className="font-medium text-gray-900">{product.name}</p><p className="text-xs text-gray-400 font-mono mt-1">{product.id}</p></td>
                            <td className="p-4 text-sm text-gray-600">{product.price.toLocaleString()} {product.currency || 'KRW'}</td>
                            <td className="p-4 text-center"><span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${product.status === 'onSale' ? 'bg-green-100 text-green-800' : product.status === 'soldOut' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>{translateStatus(product.status)}</span></td>
                            <td className="p-4 text-center">{product.isDisplayed ? <span className="text-blue-600 font-medium text-sm">진열중</span> : <span className="text-gray-400 text-sm">숨김</span>}</td>
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
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: '#2563eb' }}></div>
                <div className="flex justify-between items-center mb-6 pt-2">
                  <h3 className="text-lg font-semibold text-gray-900">새 예약 등록</h3>
                  <span className="bg-blue-50 border border-blue-100 text-blue-700 text-xs px-2 py-1 rounded font-bold">AWS 서버리스 연동</span>
                </div>
                
                <form onSubmit={handlePreSubmit} className="space-y-5">
                  <div className="relative">
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">1. 대상 상품 검색</label>
                    <div className="relative flex items-center bg-white border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
                      <input 
                        type="text" placeholder="상품명 또는 상품 ID 입력" value={productSearchTerm}
                        onChange={(e) => {
                          setProductSearchTerm(e.target.value);
                          if (!isProductSelectOpen) setIsProductSelectOpen(true);
                          if (scheduleForm.productId) setScheduleForm({...scheduleForm, productId: ''});
                        }}
                        onFocus={() => setIsProductSelectOpen(true)}
                        className="w-full px-4 py-2.5 text-sm outline-none"
                      />
                    </div>

                    {isProductSelectOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsProductSelectOpen(false)}></div>
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-20 max-h-72 overflow-y-auto">
                          {productSearchTerm === '' && recentProducts.length > 0 && (
                            <div className="p-2 border-b border-gray-100 bg-gray-50">
                              <div className="text-xs font-semibold text-gray-500 mb-2 px-2">최근 선택</div>
                              {recentProducts.map(p => (
                                <button key={`recent-${p.id}`} type="button" onClick={() => handleSelectProduct(p)} className="w-full text-left px-3 py-2 rounded text-sm hover:bg-gray-200">
                                  <span className="block font-medium">{p.name}</span><span className="block text-xs text-gray-400">{p.id}</span>
                                </button>
                              ))}
                            </div>
                          )}
                          <div className="p-2">
                            {filteredProducts.length === 0 ? (
                              <div className="px-3 py-4 text-center text-sm text-gray-500">검색 결과가 없습니다.</div>
                            ) : (
                              filteredProducts.map(p => (
                                <button key={p.id} type="button" onClick={() => handleSelectProduct(p)} className="w-full text-left px-3 py-2 rounded text-sm hover:bg-blue-50">
                                  <span className="block font-medium">{p.name}</span><span className="block text-xs text-gray-400">{p.id}</span>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">2. 변경할 판매상태</label>
                      <select value={scheduleForm.status} onChange={e => setScheduleForm({...scheduleForm, status: e.target.value})} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none">
                        <option value="scheduled">판매예정</option><option value="onSale">판매중</option><option value="soldOut">품절</option><option value="completed">판매종료</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">3. 진열 여부</label>
                      <select value={scheduleForm.isDisplayed} onChange={e => setScheduleForm({...scheduleForm, isDisplayed: e.target.value})} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none">
                        <option value="true">진열함 (표시)</option><option value="false">진열안함 (숨김)</option>
                      </select>
                    </div>
                  </div>

                  <div className="relative">
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">4. 실행 일시</label>
                    <div onClick={openDatePicker} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm bg-white cursor-pointer flex justify-between">
                      <span className={confirmedDateTime ? 'text-gray-900 font-bold' : 'text-gray-400'}>{confirmedDateTime ? new Date(confirmedDateTime).toLocaleString() : '클릭하여 일시 선택'}</span>
                    </div>

                    {isDatePickerOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsDatePickerOpen(false)}></div>
                        <div className="absolute left-0 bottom-full mb-2 bg-white border border-gray-200 shadow-xl rounded-xl p-5 w-80 z-20">
                          <h4 className="text-sm font-bold text-gray-800 mb-4 border-b pb-2">실행 일시 설정</h4>
                          <div className="space-y-4 mb-5">
                            <div><label className="block text-xs font-semibold mb-1">날짜 선택</label><input type="date" value={pickerDate} onChange={e => setPickerDate(e.target.value)} className="w-full border p-2 text-sm rounded"/></div>
                            <div><label className="block text-xs font-semibold mb-1">시간 선택</label><input type="time" value={pickerTime} onChange={e => setPickerTime(e.target.value)} className="w-full border p-2 text-sm rounded"/></div>
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button type="button" onClick={() => setIsDatePickerOpen(false)} className="px-4 py-2 text-sm font-medium bg-gray-100 rounded">취소</button>
                            <button type="button" onClick={handleConfirmDatePicker} className="px-4 py-2 text-sm font-bold text-white rounded" style={{ backgroundColor: '#2563eb' }}>확인</button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <button type="submit" className="w-full py-3 text-white font-bold rounded-lg mt-2 shadow-md hover:opacity-90 transition" style={{ backgroundColor: '#2563eb' }}>
                    클라우드 예약 전송하기
                  </button>
                </form>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900">현재 등록된 예약 대기열</h3>
                  <button onClick={() => fetchScheduledTasks(token, communityId)} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded">새로고침</button>
                </div>
                <div className="space-y-4 max-h-[500px] overflow-y-auto">
                  {displayedTasks.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 border-2 border-dashed rounded-xl">대기 중인 예약 내역이 없습니다.</div>
                  ) : (
                    displayedTasks.map(task => (
                      <div key={task.id} className="p-4 border rounded-xl bg-blue-50/50 border-blue-100">
                        <div className="flex justify-between mb-2">
                          <span className="font-bold text-gray-900">{task.productName}</span>
                          <span className="text-xs font-bold px-2 py-1 rounded bg-blue-100 text-blue-700">예약 대기중</span>
                        </div>
                        <div className="text-sm text-gray-600 mb-2">
                          상태: <b>{translateStatus(task.newStatus)}</b> | 진열: <b>{task.newIsDisplayed?'표시':'숨김'}</b> | 일시: <b>{new Date(task.executeAt).toLocaleString()}</b>
                        </div>
                        <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-blue-100">
                          <button onClick={() => handleDeleteTask(task)} className="px-3 py-1.5 bg-white text-red-600 border border-red-200 text-xs font-bold rounded hover:bg-red-50">삭제</button>
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
               <h3 className="text-lg font-bold mb-6">시스템 API 및 세션 정보</h3>
               <div className="space-y-5 text-sm">
                 <div>
                   <label className="block text-gray-500 font-bold mb-1">로그인 모드</label>
                   <input type="text" readOnly value={loginMode === 'admin' ? '어드민 (Admin)' : '판매자 (Seller)'} className="w-full bg-blue-50 border border-blue-100 text-blue-800 font-bold p-2.5 rounded" />
                 </div>
                 <div className="pt-4 border-t border-gray-100">
                   <label className="block text-gray-500 font-bold mb-1">현재 활성화된 판매자 ID</label>
                   <input type="text" readOnly value={sellerId || '세팅 안됨'} className="w-full bg-gray-50 border border-gray-200 p-2.5 rounded font-mono text-gray-600" />
                 </div>
               </div>
             </div>
          )}
        </div>
      </main>

      {isConfirmModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4 border-b pb-2 text-blue-700">예약 확인</h3>
            <div className="space-y-2 text-sm bg-gray-50 p-4 rounded border mb-6">
              <p><b>상품명:</b> {products.find(p => p.id === scheduleForm.productId)?.name || scheduleForm.productId}</p>
              <p><b>변경할 상태:</b> {translateStatus(scheduleForm.status)}</p>
              <p><b>진열 상태:</b> {scheduleForm.isDisplayed === 'true' ? '표시' : '숨김'}</p>
              <p className="text-blue-600 mt-2 border-t pt-2"><b>실행 시간:</b> {new Date(confirmedDateTime).toLocaleString()}</p>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsConfirmModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded font-medium">취소</button>
              <button onClick={handleConfirmRegister} className="px-4 py-2 text-white rounded font-bold" style={{ backgroundColor: '#2563eb' }}>확정 전송</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
