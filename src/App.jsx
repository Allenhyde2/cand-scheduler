import React, { useState, useEffect } from 'react';

const DEFAULT_GROUP_ID = 'G00O7NKV9M';

// 로컬 환경인지 Vercel 배포 환경인지 감지합니다.
const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// AWS API Gateway(Serverless Scheduler) 주소
const SCHEDULER_API_URL = 'https://2fb8b65g8f.execute-api.ap-southeast-2.amazonaws.com/schedule';

// 캔패스 Client ID
const CLIENT_ID = '4582f19ca0325304d27abbd18a36b21b'; 

// ⭐️ 업데이트됨: 기존 캔패스 스코프 + 새롭게 추가된 MOIM 메시지/DM 관련 스코프 통합
const SCOPES = 'email poll option vote addresses member:MOIM:conversation.read member:MOIM:conversation.write member:MOIM:message.read member:MOIM:message.write';

// PKCE 인증용 난수 생성기
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
      state: state,
      scope: SCOPES 
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

      if (!res.ok) {
        if (res.status === 500) {
          showToast('⚠️ 서버(Lambda)에 목록 조회(LIST) 기능이 없어 빈 목록을 표시합니다.', 'error');
          setTasks([]);
          return;
        }
        throw new Error(`서버 응답 오류: ${res.status}`);
      }

      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await res.json();
        const fetchedList = data.tasks || data.data || (Array.isArray(data) ? data : []);

        const formattedTasks = fetchedList.map(task => ({
          ...task,
          logs: task.logs || [`☁️ 서버에서 저장된 예약 정보를 불러왔습니다. (${new Date().toLocaleTimeString()})`]
        }));

        setTasks(formattedTasks);
      } else {
        const text = await res.text();
        console.error("스케줄러 응답 에러 (JSON 아님):", text);
        throw new Error("서버가 JSON이 아닌 데이터를 반환했습니다.");
      }
    } catch (err) {
      console.error('예약 목록 조회 실패 상세 에러:', err);
      if (err.message.includes('Failed to fetch')) {
        showToast('CORS 오류: 스케줄러 서버 연동 실패. AWS API Gateway 설정을 확인하세요.', 'error');
      } else {
        showToast(`목록 갱신 실패: ${err.message}`, 'error');
      }
    }
  };

  const fetchProductsWithArgs = async (currentToken, currentCommunityId, currentSellerId) => {
    setIsLoading(true);
    try {
      const activeToken = currentToken || token;
      const activeCommunityId = currentCommunityId || communityId;
      const activeSellerId = currentSellerId || sellerId;

      if (!activeToken) throw new Error("유효한 토큰이 없습니다. 다시 로그인해주세요.");

      const url = isLocalhost 
        ? '/cand-api/products?limit=100' 
        : '/api/proxy?endpoint=products&limit=100';

      const res = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders(activeToken, activeCommunityId)
      });
      
      const responseText = await res.text();

      if (!res.ok) {
        console.error("API 호출 실패 응답:", responseText);
        throw new Error(`API 오류: ${res.status}`);
      }
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error("응답 파싱 에러. 받은 내용:", responseText.substring(0, 100) + '...');
        throw new Error("API 응답을 해석할 수 없습니다. 서버 통신에 실패했습니다.");
      }

      let fetchedList = data.data || [];

      if (activeSellerId) {
        fetchedList = fetchedList.filter(p => {
          const idField = p.userId || p.sellerId || p.creatorId; 
          return idField ? idField === activeSellerId : true;
        });
      }

      setProducts(fetchedList);
      showToast('해당 판매자의 상품 목록을 불러왔습니다.', 'success');
    } catch (err) {
      console.error('목록 로드 실패 상세 에러:', err);
      if (err.message.includes('Failed to fetch')) {
        showToast('CORS 오류: 브라우저가 API 요청을 차단했습니다.', 'error');
      } else {
        showToast('목록 로드 실패: ' + err.message, 'error');
      }
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
    if (!scheduleForm.productId) return showToast('대상 상품을 검색하여 선택해주세요.', 'error');
    if (!confirmedDateTime) return showToast('실행 일시를 선택해주세요.', 'error');
    
    const executeTime = new Date(confirmedDateTime).getTime();
    if (executeTime <= Date.now()) return showToast('실행 시간은 현재 시간 이후여야 합니다.', 'error');

    setIsConfirmModalOpen(true);
  };

  const handleConfirmRegister = async () => {
    const targetProduct = products.find(p => p.id === scheduleForm.productId);
    const executeTimeIso = new Date(confirmedDateTime).toISOString();
    const newTaskId = Math.random().toString(36).substr(2, 9); 

    try {
      showToast('AWS 클라우드에 예약을 전송 중입니다...', 'info');

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

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`AWS API 에러: ${errText}`);
      }

      const newTask = {
        id: newTaskId,
        productId: scheduleForm.productId,
        productName: targetProduct ? targetProduct.name : scheduleForm.productId,
        newStatus: scheduleForm.status,
        newIsDisplayed: scheduleForm.isDisplayed === 'true',
        executeAt: new Date(confirmedDateTime).getTime(),
        status: 'cloud_scheduled', 
        logs: ['✅ AWS EventBridge에 성공적으로 등록되었습니다.', '💡 이제 브라우저를 종료하셔도 예약된 시간에 서버가 알아서 작업을 수행합니다.'],
      };

      setTasks(prev => [newTask, ...prev]);
      setIsConfirmModalOpen(false);
      setConfirmedDateTime('');
      setProductSearchTerm('');
      setScheduleForm({ ...scheduleForm, productId: '' });
      showToast('백엔드 스케줄러에 예약이 등록되었습니다!', 'success');

    } catch (err) {
      showToast(`예약 실패: ${err.message}`, 'error');
      setIsConfirmModalOpen(false);
    }
  };

  const handleDeleteTask = async (task) => {
    if (!window.confirm(`[${task.productName}] 예약을 정말 삭제하시겠습니까?`)) return;
    try {
      showToast('클라우드에서 예약을 삭제하는 중입니다...', 'info');
      
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
      if (!response.ok) throw new Error(await response.text());
      
      setTasks(prev => prev.filter(t => t.id !== task.id));
      showToast('예약이 성공적으로 취소되었습니다.', 'success');
    } catch (err) {
      showToast(`삭제 실패: ${err.message}`, 'error');
    }
  };

  const openEditModal = (task) => {
    const d = new Date(task.executeAt);
    const tzoffset = d.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(d.getTime() - tzoffset)).toISOString().slice(0, 16);
    const [date, time] = localISOTime.split('T');

    setEditModal({
      isOpen: true,
      task,
      status: task.newStatus,
      isDisplayed: task.newIsDisplayed ? 'true' : 'false',
      date,
      time
    });
  };

  const handleConfirmEdit = async () => {
    if (!editModal.date || !editModal.time) return showToast('수정할 날짜와 시간을 입력해주세요.', 'error');
    const executeTimeIso = new Date(`${editModal.date}T${editModal.time}`).toISOString();
    
    try {
      showToast('AWS 클라우드 예약을 수정하는 중입니다...', 'info');
      
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
      if (!response.ok) throw new Error(await response.text());

      setTasks(prev => prev.map(t => {
        if (t.id === editModal.task.id) {
          return {
            ...t,
            newStatus: editModal.status,
            newIsDisplayed: editModal.isDisplayed === 'true',
            executeAt: new Date(`${editModal.date}T${editModal.time}`).getTime(),
            logs: [`✅ ${new Date().toLocaleTimeString()} - 예약이 성공적으로 수정되었습니다.`, ...t.logs]
          };
        }
        return t;
      })); 
      
      setEditModal({ ...editModal, isOpen: false });
      showToast('예약이 수정되었습니다.', 'success');
    } catch (err) {
      showToast(`수정 실패: ${err.message}`, 'error');
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
            <p className="text-gray-600 mb-6">
              {typeof confirmDialog.message === 'object' ? JSON.stringify(confirmDialog.message) : String(confirmDialog.message)}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={closeConfirm} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg">취소</button>
              <button onClick={confirmDialog.onConfirm} className="px-4 py-2 bg-blue-600 text-white rounded-lg">확인</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
        <CustomUI />
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
          <div className="bg-blue-600 p-8 text-center border-b-4 border-blue-700">
            <h1 className="text-2xl font-bold text-white mb-2">canD Admin</h1>
            <p className="text-blue-100 text-sm font-medium">서비스 관리를 위해 로그인해주세요.</p>
          </div>
          <form onSubmit={handleOAuthLogin} className="p-8 space-y-6">
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg text-xs text-blue-800">
              <p>현재 <b>PRODUCTION</b> 환경입니다. 데이터가 실제 서비스에 반영됩니다.</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Group ID (Community ID)</label>
              <input 
                type="text" 
                value={communityId}
                readOnly
                title="Group ID는 시스템에 고정되어 있어 수정할 수 없습니다."
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-200 text-gray-500 cursor-not-allowed outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">판매자 ID (Seller/User ID)</label>
              <input 
                type="text" 
                value={sellerId}
                onChange={(e) => setSellerId(e.target.value)}
                placeholder="ex) user123"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-50 outline-none"
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
        <div className="h-16 border-b border-gray-100 flex items-center justify-center gap-2 px-6 shrink-0">
          <span className="text-xl font-bold text-gray-900 tracking-tight">Admin<span className="text-blue-600">Dash</span></span>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-4">
          <div className="px-4 mb-2"><span className="text-xs font-bold text-gray-400 uppercase">상품 관리</span></div>
          <ul className="space-y-1 px-3 mb-6">
            <li>
              <button onClick={() => setActiveTab('productList')} className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium ${activeTab === 'productList' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}>
                판매 상품 목록
              </button>
            </li>
            <li>
              <button onClick={() => setActiveTab('schedule')} className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium ${activeTab === 'schedule' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}>
                상태 예약 변경 (서버리스)
              </button>
            </li>
          </ul>

          <div className="px-4 mb-2"><span className="text-xs font-bold text-gray-400 uppercase">시스템</span></div>
          <ul className="space-y-1 px-3">
            <li>
              <button onClick={() => setActiveTab('settings')} className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium ${activeTab === 'settings' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}>
                API 설정
              </button>
            </li>
          </ul>
        </nav>
        
        <div className="p-4 border-t border-gray-100">
          <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-gray-500 hover:text-red-500">
            로그아웃
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0 relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-blue-600"></div>
          
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-gray-500 hover:text-gray-700 font-bold text-xl">
              ≡
            </button>
            <h2 className="text-lg font-bold text-gray-800">
              {activeTab === 'productList' && '판매 상품 목록'}
              {activeTab === 'schedule' && '상태 예약 변경 (서버리스)'}
              {activeTab === 'settings' && 'API 설정'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
             <span className="bg-gray-100 text-gray-600 border border-gray-200 text-xs font-bold px-3 py-1.5 rounded-md">
                Seller: {sellerId}
             </span>
             <span className="bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold px-3 py-1.5 rounded-md">
                PRODUCTION ENV
             </span>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6 bg-gray-50">
          
          {activeTab === 'productList' && (
            <div className="max-w-6xl mx-auto space-y-4">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">판매 상품 현황 조회</h3>
                  </div>
                  <button onClick={fetchProducts} disabled={isLoading} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">
                    새로고침
                  </button>
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
                      {products.length === 0 ? (
                        <tr><td colSpan="4" className="p-8 text-center text-gray-500">데이터가 없거나 해당 판매자의 상품이 아닙니다.</td></tr>
                      ) : (
                        products.map(product => (
                          <tr key={product.id} className="hover:bg-gray-50">
                            <td className="p-4">
                              <p className="font-medium text-gray-900">{product.name}</p>
                              <p className="text-xs text-gray-400 font-mono mt-1">{product.id}</p>
                            </td>
                            <td className="p-4 text-sm text-gray-600">{product.price.toLocaleString()} {product.currency || 'KRW'}</td>
                            <td className="p-4 text-center">
                              <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium 
                                ${product.status === 'onSale' ? 'bg-green-100 text-green-800' : 
                                  product.status === 'soldOut' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                                {translateStatus(product.status)}
                              </span>
                            </td>
                            <td className="p-4 text-center">
                              {product.isDisplayed ? 
                                <span className="text-blue-600 font-medium text-sm">진열중</span> : 
                                <span className="text-gray-400 text-sm">숨김</span>}
                            </td>
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
              
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 border-t-4 border-t-blue-600 relative">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">새 예약 등록 (클라우드 전송)</h3>
                  <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded font-bold">AWS 서버리스 연동됨</span>
                </div>
                
                <form onSubmit={handlePreSubmit} className="space-y-5">
                  <div className="relative">
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">1. 대상 상품 검색</label>
                    <div className="relative flex items-center bg-white border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
                      <input 
                        type="text"
                        placeholder="나의 상품명 또는 상품 ID를 입력하세요"
                        value={productSearchTerm}
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
                              <div className="text-xs font-semibold text-gray-500 mb-2 px-2">최근 선택한 상품</div>
                              {recentProducts.map(p => (
                                <button key={`recent-${p.id}`} type="button" onClick={() => handleSelectProduct(p)} className="w-full text-left px-3 py-2 rounded text-sm hover:bg-gray-200">
                                  <span className="block font-medium">{p.name}</span>
                                  <span className="block text-xs text-gray-400">{p.id}</span>
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
                                  <span className="block font-medium">{p.name}</span>
                                  <span className="block text-xs text-gray-400">{p.id}</span>
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
                      <select 
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none"
                        value={scheduleForm.status}
                        onChange={e => setScheduleForm({...scheduleForm, status: e.target.value})}
                      >
                        <option value="scheduled">판매예정</option><option value="onSale">판매중</option><option value="soldOut">품절</option><option value="completed">판매종료</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">3. 진열 여부</label>
                      <select 
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none"
                        value={scheduleForm.isDisplayed}
                        onChange={e => setScheduleForm({...scheduleForm, isDisplayed: e.target.value})}
                      >
                        <option value="true">진열함 (표시)</option><option value="false">진열안함 (숨김)</option>
                      </select>
                    </div>
                  </div>

                  <div className="relative">
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">4. 실행 일시</label>
                    <div onClick={openDatePicker} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm bg-white cursor-pointer flex justify-between">
                      <span className={confirmedDateTime ? 'text-gray-900 font-bold' : 'text-gray-400'}>
                        {confirmedDateTime ? new Date(confirmedDateTime).toLocaleString() : '클릭하여 일시 선택'}
                      </span>
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
                            <button type="button" onClick={handleConfirmDatePicker} className="px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded">확인</button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <button type="submit" className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg mt-2 shadow-md hover:bg-blue-700 transition">
                    AWS 클라우드에 예약 전송하기
                  </button>
                </form>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col">
                <div className="flex justify-between items-center mb-4 pb-2 border-b">
                  <h3 className="text-lg font-bold text-gray-900">최근 예약 전송 기록 <span className="text-sm font-bold text-green-600 ml-2">(이제 브라우저를 꺼도 무방합니다!)</span></h3>
                  <button 
                    onClick={() => fetchScheduledTasks(token, communityId)} 
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded transition"
                  >
                    목록 새로고침
                  </button>
                </div>
                <p className="text-xs text-gray-500 mb-4">* 클라우드에 등록된 작업이므로 이 창에서 목록을 지워도 서버에서는 예정대로 실행됩니다. (수정/취소는 AWS 콘솔에서 가능합니다)</p>

                <div className="space-y-4 max-h-[500px] overflow-y-auto">
                  {displayedTasks.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 border-2 border-dashed rounded-xl">현재 판매자의 예약 내역이 없습니다.</div>
                  ) : (
                    displayedTasks.map(task => (
                      <div key={task.id} className="p-4 border rounded-xl bg-blue-50/30 border-blue-100">
                        <div className="flex justify-between mb-2">
                          <span className="font-bold text-gray-900">{task.productName}</span>
                          <span className="text-xs font-bold px-2 py-1 rounded bg-blue-100 text-blue-700">
                            ☁️ 클라우드 대기중
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 mb-2">
                          상태: <b>{translateStatus(task.newStatus)}</b> | 진열: <b>{task.newIsDisplayed?'표시':'숨김'}</b> | 일시: <b>{new Date(task.executeAt).toLocaleString()}</b>
                        </div>
                        {task.logs && task.logs.length > 0 && (
                          <div className="mt-2 p-2 bg-white border border-blue-100 text-xs text-blue-800 rounded max-h-24 overflow-y-auto">
                            {task.logs.map((log, i) => (
                              <div key={i} className="mb-0.5">
                                {typeof log === 'object' ? JSON.stringify(log) : String(log)}
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-blue-100/50">
                          <button onClick={() => openEditModal(task)} className="px-3 py-1.5 bg-white text-blue-600 border border-blue-200 text-xs font-bold rounded hover:bg-blue-50 transition">수정</button>
                          <button onClick={() => handleDeleteTask(task)} className="px-3 py-1.5 bg-white text-red-600 border border-red-200 text-xs font-bold rounded hover:bg-red-50 transition">삭제</button>
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
                   <input type="text" readOnly value={API_BASE_URL} className="w-full bg-gray-50 border border-gray-200 p-2.5 rounded font-mono" />
                 </div>
                 <div>
                   <label className="block text-gray-500 font-bold mb-1">AWS 스케줄러(Lambda) API 주소</label>
                   <input type="text" readOnly value={SCHEDULER_API_URL} className="w-full bg-blue-50 border border-blue-200 p-2.5 rounded text-blue-900 font-mono font-bold" />
                 </div>
                 <div className="pt-4 border-t border-gray-100">
                   <label className="block text-gray-500 font-bold mb-1">현재 접속 그룹 ID</label>
                   <input type="text" readOnly value={communityId} className="w-full bg-gray-50 border border-gray-200 p-2.5 rounded font-mono text-gray-600" />
                 </div>
                 <div className="pt-4 border-t border-gray-100">
                   <label className="block text-gray-500 font-bold mb-1">현재 접속 판매자 ID</label>
                   <input type="text" readOnly value={sellerId} className="w-full bg-gray-50 border border-gray-200 p-2.5 rounded font-mono text-gray-600" />
                 </div>
                 <div className="pt-4 border-t border-gray-100">
                   <label className="block text-gray-500 font-bold mb-1">CANpass Client ID</label>
                   <input type="text" readOnly value={CLIENT_ID} className="w-full bg-gray-50 border border-gray-200 p-2.5 rounded font-mono text-gray-600" />
                 </div>
               </div>
             </div>
          )}
        </div>
      </main>

      {isConfirmModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4 border-b pb-2 text-blue-700">AWS 클라우드에 예약 전송</h3>
            <div className="space-y-2 text-sm bg-gray-50 p-4 rounded border mb-6">
              <p><b>상품명:</b> {products.find(p => p.id === scheduleForm.productId)?.name || scheduleForm.productId}</p>
              <p><b>변경할 상태:</b> {translateStatus(scheduleForm.status)}</p>
              <p><b>진열 상태:</b> {scheduleForm.isDisplayed === 'true' ? '진열 표시' : '진열 숨김'}</p>
              <p className="text-blue-600 mt-2 border-t pt-2"><b>실행 시간:</b> {new Date(confirmedDateTime).toLocaleString()}</p>
            </div>
            <p className="text-xs text-gray-500 mb-4 text-center">확인을 누르시면 이 데이터가 안전하게 AWS로 전송됩니다.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsConfirmModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded font-medium">취소</button>
              <button onClick={handleConfirmRegister} className="px-4 py-2 bg-blue-600 text-white rounded font-bold">확정 후 전송</button>
            </div>
          </div>
        </div>
      )}

      {editModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-lg font-bold mb-4 border-b pb-2 text-blue-700">예약 전송 수정</h3>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">대상 상품</label>
                <input type="text" readOnly value={editModal.task.productName} className="w-full border bg-gray-50 p-2.5 text-sm rounded-lg outline-none text-gray-500 font-medium" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">변경할 판매상태</label>
                  <select value={editModal.status} onChange={e => setEditModal({...editModal, status: e.target.value})} className="w-full border p-2.5 text-sm rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="scheduled">판매예정</option><option value="onSale">판매중</option><option value="soldOut">품절</option><option value="completed">판매종료</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">진열 여부</label>
                  <select value={editModal.isDisplayed} onChange={e => setEditModal({...editModal, isDisplayed: e.target.value})} className="w-full border p-2.5 text-sm rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="true">진열함 (표시)</option><option value="false">진열안함 (숨김)</option>
                  </select>
                </div>
              </div>
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
