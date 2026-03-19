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

  // --- 상품 목록 필터 및 페이지네이션 상태 ---
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState({
    name: '',
    sku: '',
    tag: '',
    status: [],
    display: 'all'
  });
  const [pagingAfter, setPagingAfter] = useState(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // --- 상품 정보 수정 모달 상태 ---
  const [productEditModal, setProductEditModal] = useState({
    isOpen: false,
    id: '',
    name: '',
    price: '',
    stockType: 'unlimited',
    stockCount: '',
    isDisplayed: 'true',
    status: 'onSale',
    description: ''
  });

  // --- 스케줄러 폼 상태 ---
  const [scheduleForm, setScheduleForm] = useState({
    products: [],
    status: 'onSale',
    isDisplayed: 'true',
  });
  
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [isProductSelectOpen, setIsProductSelectOpen] = useState(false);
  const [recentProducts, setRecentProducts] = useState([]);

  // ⭐️ 날짜/시간 인라인 관리를 위한 State
  const [pickerDate, setPickerDate] = useState('');
  const [pickerTime, setPickerTime] = useState('');
  const [confirmedDateTime, setConfirmedDateTime] = useState('');

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  // --- 스케줄러 수정 모달 상태 ---
  const [editModal, setEditModal] = useState({
    isOpen: false, task: null, status: '', isDisplayed: 'true', date: '', time: ''
  });

  const productSelectRef = useRef(null);

  // 외부 영역 클릭 감지 (상품 드랍다운 닫기 용도)
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (productSelectRef.current && !productSelectRef.current.contains(event.target)) {
        setIsProductSelectOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
            else { showToast('보안 정책으로 셀러 ID 자동 탐지에 실패했습니다. 수동으로 입력해주세요.', 'info'); }
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

  const fetchProductsWithArgs = async (currentToken, currentSellerId, currentMode, isLoadMore = false) => {
    if (currentMode === 'seller' && !currentSellerId) return;
    
    if (isLoadMore) setIsLoadingMore(true);
    else setIsLoading(true);

    try {
      const params = new URLSearchParams();
      params.append('endpoint', 'products');
      params.append('limit', '50'); 
      params.append('order', 'DESC');
      
      if (isLoadMore && pagingAfter) params.append('after', pagingAfter);

      if (filters.name) params.append('query', filters.name);
      if (filters.sku) params.append('sku', filters.sku);
      if (filters.tag) params.append('tag', filters.tag);
      
      const searchSellerId = currentMode === 'seller' ? currentSellerId : (currentSellerId || filters.sellerId);
      if (searchSellerId) params.append('sellerId', searchSellerId);

      if (filters.status.length > 0) {
        filters.status.forEach(s => params.append('status', s));
      }
      if (filters.display !== 'all') {
        params.append('isDisplayed', filters.display);
      }

      const url = `https://cand-scheduler.vercel.app/api/proxy?${params.toString()}`;
      const res = await fetch(url, { method: 'GET', headers: getAuthHeaders(currentToken) });
      
      if (!res.ok) throw new Error('목록 로드 실패');
      
      const data = await res.json();
      const list = data.data || [];
      
      if (isLoadMore) {
        setProducts(prev => [...prev, ...list]);
      } else {
        setProducts(list);
      }

      setPagingAfter(data.paging && data.paging.after ? data.paging.after : null);

    } catch (err) {
      showToast('상품 목록을 불러오는 데 실패했습니다.', 'error');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
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
        fetchProductsWithArgs(token, sellerId, loginMode, false);
      }
      fetchScheduledTasks(token);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, token, sellerId, loginMode]);

  const resetFilters = () => setFilters({ name: '', sku: '', tag: '', status: [], display: 'all' });

  const applyFilters = () => {
    setPagingAfter(null);
    fetchProductsWithArgs(token, sellerId, loginMode, false);
  };

  const loadMoreProducts = () => fetchProductsWithArgs(token, sellerId, loginMode, true);
  const fetchProducts = () => fetchProductsWithArgs(token, sellerId, loginMode, false);

  const openProductEditModal = (p) => {
    setProductEditModal({
      isOpen: true, id: p.id, name: p.name || '', price: p.price || 0,
      stockType: p.stockCount === null || p.stockCount === undefined ? 'unlimited' : 'limited',
      stockCount: p.stockCount || '', isDisplayed: p.isDisplayed !== false ? 'true' : 'false',
      status: p.status || 'onSale', description: p.description || ''
    });
  };

  const closeProductEditModal = () => setProductEditModal(prev => ({ ...prev, isOpen: false }));

  const handleUpdateProduct = async () => {
    const { id, name, price, stockType, stockCount, isDisplayed, status, description } = productEditModal;
    const finalStockCount = stockType === 'unlimited' ? null : Number(stockCount);

    const updateData = {
      name: name, price: Number(price), stockCount: finalStockCount, status: status,
      description: description, isDisplayed: isDisplayed === 'true'
    };

    try {
      showToast('상품 정보를 갱신 중입니다...', 'info');
      const res = await fetch(`https://cand-scheduler.vercel.app/api/proxy?endpoint=products/${id}`, {
        method: 'PUT', headers: getAuthHeaders(token), body: JSON.stringify(updateData)
      });
      
      if (!res.ok) throw new Error();
      
      setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updateData } : p));
      closeProductEditModal();
      showToast('상품이 성공적으로 수정되었습니다.', 'success');
    } catch (err) {
      showToast('상품 수정에 실패했습니다.', 'error');
    }
  };

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

  const handleRemoveProduct = (productId) => {
    setScheduleForm({
      ...scheduleForm,
      products: scheduleForm.products.filter(p => p.id !== productId)
    });
  };

  const handleProductKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const matched = products.filter(p => p.name.includes(productSearchTerm) || p.id.includes(productSearchTerm));
      if (matched.length > 0) {
        handleSelectProduct(matched[0]);
      }
    }
  };

  // ⭐️ 예약 전송 1단계 검증 로직
  const handlePreSubmit = (e) => {
    e.preventDefault();
    if (scheduleForm.products.length === 0) return showToast('최소 1개 이상의 상품을 선택해주세요.', 'error');
    if (!pickerDate || !pickerTime) return showToast('실행 날짜와 시간을 모두 설정해주세요.', 'error');
    
    const combinedDateTime = `${pickerDate}T${pickerTime}`;
    if (new Date(combinedDateTime).getTime() <= Date.now()) return showToast('실행 시간은 현재 시간 이후여야 합니다.', 'error');
    
    setConfirmedDateTime(combinedDateTime);
    setIsConfirmModalOpen(true);
  };

  const handleConfirmRegister = async () => {
    setIsConfirmModalOpen(false);
    showToast('예약 전송 중...', 'info');
    try {
      const newTasks = [];
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
      
      // 입력값 초기화
      setConfirmedDateTime('');
      setPickerDate('');
      setPickerTime('');
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
      isDisplayed: task.newIsDisplayed ? 'true' : 'false', date, time
    });
  };

  const handleConfirmEdit = async () => {
    if (!editModal.date || !editModal.time) return showToast('수정할 날짜와 시간을 모두 입력해주세요.', 'error');
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
        <header className="h-16 bg-white border-b flex items-center justify-between px-6 flex-shrink-0 relative z-30">
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
              
              <div className="flex justify-between items-end mb-2">
                <h3 className="font-bold text-lg">{loginMode === 'admin' && !sellerId ? '전체 상품 목록' : '내 판매 상품 목록'}</h3>
                <div className="flex gap-2">
                  <button onClick={() => setIsFilterOpen(!isFilterOpen)} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-50 transition">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path></svg>
                    검색 필터
                  </button>
                  <button onClick={applyFilters} disabled={isLoading} className="p-2 border border-gray-300 bg-white text-gray-500 hover:text-blue-600 hover:border-blue-300 rounded-lg transition" title="새로고침">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                  </button>
                </div>
              </div>

              {/* 필터 패널 */}
              {isFilterOpen && (
                <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm mb-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="lg:col-span-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1.5">상품 이름</label>
                        <input type="text" value={filters.name} onChange={e => setFilters({...filters, name: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none" placeholder="상품명 검색"/>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1.5">SKU 번호</label>
                        <input type="text" value={filters.sku} onChange={e => setFilters({...filters, sku: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none font-mono" placeholder="SKU 입력"/>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1.5">태그</label>
                        <input type="text" value={filters.tag} onChange={e => setFilters({...filters, tag: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none" placeholder="태그 입력"/>
                      </div>
                    </div>

                    <div className="col-span-full h-px bg-gray-100 my-1"></div>

                    <div className="lg:col-span-2">
                      <label className="block text-xs font-bold text-gray-500 mb-2">판매 상태</label>
                      <div className="flex flex-wrap gap-2">
                        {['scheduled', 'onSale', 'soldOut', 'completed'].map(val => (
                          <label key={val} className={`cursor-pointer border rounded px-3 py-1.5 text-xs font-medium transition ${filters.status.includes(val) ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-50'}`}>
                            <input type="checkbox" className="hidden" checked={filters.status.includes(val)} onChange={(e) => {
                              const checked = e.target.checked;
                              setFilters(prev => ({...prev, status: checked ? [...prev.status, val] : prev.status.filter(s => s !== val)}));
                            }}/> {translateStatus(val)}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="lg:col-span-2">
                      <label className="block text-xs font-bold text-gray-500 mb-2">진열 상태</label>
                      <div className="flex gap-4">
                        {[ {label: '전체', val: 'all'}, {label: '진열 중', val: 'true'}, {label: '숨김', val: 'false'} ].map(opt => (
                          <label key={opt.val} className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700">
                            <input type="radio" name="displayFilter" value={opt.val} checked={filters.display === opt.val} onChange={e => setFilters({...filters, display: e.target.value})} className="accent-blue-600"/> {opt.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end gap-2">
                    <button onClick={resetFilters} className="px-6 py-2 bg-white border border-gray-300 text-gray-600 font-bold rounded-lg hover:bg-gray-50 transition text-sm">조건 초기화</button>
                    <button onClick={applyFilters} className="px-8 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-sm transition text-sm">필터 적용하여 검색</button>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[300px] flex flex-col">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-500">
                    <tr>
                      <th className="px-6 py-4 font-bold uppercase w-16">Img</th>
                      <th className="px-6 py-4 font-bold uppercase">상품 정보 (이름/SKU)</th>
                      <th className="px-6 py-4 font-bold uppercase text-right">가격</th>
                      <th className="px-6 py-4 font-bold uppercase text-center">재고</th>
                      <th className="px-6 py-4 font-bold uppercase text-center">상태</th>
                      <th className="px-6 py-4 font-bold uppercase text-center">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(loginMode === 'seller' && !sellerId) ? (
                      <tr><td colSpan="6" className="p-12 text-center text-gray-500 bg-gray-50">
                        <p className="mb-2 font-bold text-gray-700 text-base">⚠️ 셀러 ID 자동 탐지에 실패했습니다.</p>
                        <p className="text-sm mb-6 text-gray-500">백엔드 API 권한 문제로 아이디를 가져오지 못했습니다. 아래에 직접 입력해주세요.</p>
                        <div className="flex justify-center max-w-sm mx-auto shadow-sm rounded-lg overflow-hidden">
                          <input type="text" id="manualInputFallback" placeholder="ex) CS:P8XLJRM3" className="w-full px-4 py-2.5 border border-gray-300 outline-none" />
                          <button onClick={() => handleManualSaveSellerId(document.getElementById('manualInputFallback').value)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 transition shrink-0">저장 및 조회</button>
                        </div>
                      </td></tr>
                    ) : isLoading && products.length === 0 ? (
                      <tr><td colSpan="6" className="p-20 text-center bg-gray-50/50">
                        <div className="flex flex-col items-center justify-center space-y-4">
                          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                          <p className="font-bold text-blue-600 animate-pulse">데이터를 불러오는 중입니다...</p>
                        </div>
                      </td></tr>
                    ) : products.length === 0 ? (
                      <tr><td colSpan="6" className="p-16 text-center text-gray-400 font-medium">조회된 상품이 없습니다.</td></tr>
                    ) : (
                      products.map(p => {
                        const imgUrl = p.images?.mobile?.[0] || p.images?.web?.[0] || '';
                        return (
                        <tr key={p.id} className="hover:bg-blue-50/20 transition-colors group">
                          <td className="px-6 py-3">
                            {imgUrl ? <img src={imgUrl} className="w-10 h-10 rounded object-cover border border-gray-200" alt="상품" /> : <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center text-gray-400 border border-gray-200"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg></div>}
                          </td>
                          <td className="px-6 py-3">
                            <div className="text-sm font-bold text-gray-800 group-hover:text-blue-600 transition truncate max-w-xs">{p.name || '이름 없음'}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 rounded border border-slate-200 font-mono">{p.id}</span>
                              {p.sku && <span className="text-[10px] text-gray-400 font-mono">SKU: {p.sku}</span>}
                            </div>
                          </td>
                          <td className="px-6 py-3 text-right text-sm font-mono font-medium text-gray-600">{p.price?.toLocaleString()} {p.currency || 'KRW'}</td>
                          <td className="px-6 py-3 text-center text-sm font-mono text-gray-600">
                            {p.stockCount !== null && p.stockCount !== undefined ? p.stockCount.toLocaleString() : <span className="text-xs text-gray-400 font-medium">무제한</span>}
                          </td>
                          <td className="px-6 py-3 text-center">
                            <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold ${p.status === 'onSale' ? 'bg-green-100 text-green-700' : p.status === 'soldOut' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{translateStatus(p.status)}</span>
                            {!p.isDisplayed && <div className="text-[10px] text-gray-400 mt-1 font-bold flex justify-center items-center gap-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path></svg> 숨김</div>}
                          </td>
                          <td className="px-6 py-3 text-center">
                            <button onClick={() => openProductEditModal(p)} className="text-gray-400 hover:text-blue-600 border border-transparent hover:border-blue-200 hover:bg-white px-3 py-1.5 rounded transition text-xs font-bold flex items-center justify-center mx-auto gap-1">
                               <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg> 수정
                            </button>
                          </td>
                        </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
                {pagingAfter && (
                  <div className="p-4 border-t border-gray-100 text-center bg-gray-50">
                    <button onClick={loadMoreProducts} disabled={isLoadingMore} className="px-6 py-2 bg-white border border-gray-300 rounded-full text-sm font-bold text-gray-600 hover:bg-gray-100 hover:border-gray-400 transition shadow-sm disabled:opacity-50">
                      {isLoadingMore ? <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div> 로딩 중...</span> : '더 보기 (Load More)'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'schedule' && (
             <div className="max-w-4xl mx-auto space-y-6">
                <div className="bg-white p-8 rounded-xl shadow-sm border border-t-4 border-t-blue-600">
                  <h3 className="font-bold text-lg mb-6">새 상태 변경 예약 등록</h3>
                  <form onSubmit={handlePreSubmit} className="space-y-5">
                    
                    <div className="relative" ref={productSelectRef}>
                      <label className="block text-sm font-bold text-gray-700 mb-2">1. 대상 상품 선택 (다중 선택 가능)</label>
                      <input 
                        type="text" value={productSearchTerm} 
                        onChange={e => { setProductSearchTerm(e.target.value); setIsProductSelectOpen(true); }}
                        onFocus={() => setIsProductSelectOpen(true)}
                        onKeyDown={handleProductKeyDown}
                        placeholder="텍스트 입력 후 엔터(Enter) 또는 목록 클릭" 
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                      />
                      
                      {isProductSelectOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 shadow-xl rounded-lg z-40 max-h-56 overflow-y-auto divide-y">
                          {productSearchTerm === '' && recentProducts.length > 0 && (
                            <div className="p-2 border-b bg-gray-50 text-xs font-bold text-gray-500">최근 선택 항목</div>
                          )}
                          {products.filter(p => p.name.includes(productSearchTerm) || p.id.includes(productSearchTerm)).map(p => (
                            <div key={p.id} onClick={() => handleSelectProduct(p)} className="p-3 hover:bg-blue-50 cursor-pointer text-sm">
                              <b>{p.name}</b> <span className="text-xs text-gray-400 ml-2 font-mono">({p.id})</span>
                            </div>
                          ))}
                        </div>
                      )}

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
                        <select value={scheduleForm.status} onChange={e => setScheduleForm({...scheduleForm, status: e.target.value})} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"><option value="onSale">판매중</option><option value="soldOut">품절</option><option value="completed">판매종료</option></select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">3. 진열 여부</label>
                        <select value={scheduleForm.isDisplayed} onChange={e => setScheduleForm({...scheduleForm, isDisplayed: e.target.value})} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"><option value="true">진열함</option><option value="false">진열안함</option></select>
                      </div>
                    </div>
                    
                    {/* ⭐️ 혁신적인 날짜/시간 인라인 UI 도입 */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">4. 예약 날짜</label>
                        <input 
                          type="date" 
                          value={pickerDate} 
                          onChange={e => setPickerDate(e.target.value)} 
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600" 
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">5. 예약 시간</label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="time" 
                            value={pickerTime} 
                            onChange={e => setPickerTime(e.target.value)} 
                            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                          />
                          <button 
                            type="button" 
                            onClick={(e) => {
                              // 네이티브 시간 팝업을 닫기 위해 포커스 강제 해제
                              const timeInput = e.currentTarget.previousElementSibling;
                              if (timeInput) timeInput.blur();
                            }}
                            className="px-4 py-2.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition shadow-sm font-bold whitespace-nowrap"
                          >
                            ✅ 확인
                          </button>
                        </div>
                      </div>
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

      {/* 상품 수정 (Product Edit) 모달 */}
      {productEditModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-blue-50">
              <h3 className="text-lg font-bold text-blue-900">상품 정보 수정</h3>
              <button onClick={closeProductEditModal} className="text-gray-400 hover:text-gray-800 transition"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
            </div>
            <div className="p-6 space-y-5 overflow-y-auto bg-white flex-1">
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">상품명</label>
                <input type="text" value={productEditModal.name} onChange={e => setProductEditModal({...productEditModal, name: e.target.value})} className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1.5 block">가격</label>
                  <input type="number" value={productEditModal.price} onChange={e => setProductEditModal({...productEditModal, price: e.target.value})} className="w-full border border-gray-300 rounded-lg p-2.5 text-sm font-mono outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1.5 block">재고 설정</label>
                  <div className="flex items-center gap-3 mt-2 mb-2">
                    <label className="flex items-center gap-1.5 text-sm cursor-pointer text-gray-700 font-medium">
                      <input type="radio" name="stockType" value="unlimited" checked={productEditModal.stockType === 'unlimited'} onChange={e => setProductEditModal({...productEditModal, stockType: e.target.value, stockCount: ''})} className="accent-blue-600" /> 무제한
                    </label>
                    <label className="flex items-center gap-1.5 text-sm cursor-pointer text-gray-700 font-medium">
                      <input type="radio" name="stockType" value="limited" checked={productEditModal.stockType === 'limited'} onChange={e => setProductEditModal({...productEditModal, stockType: e.target.value})} className="accent-blue-600" /> 수량지정
                    </label>
                  </div>
                  {productEditModal.stockType === 'limited' && (
                    <input type="number" value={productEditModal.stockCount} onChange={e => setProductEditModal({...productEditModal, stockCount: e.target.value})} className="w-full border border-gray-300 rounded-lg p-2.5 text-sm font-mono outline-none focus:border-blue-500 bg-gray-50" placeholder="수량 입력" />
                  )}
                </div>
              </div>
              
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                <h4 className="text-sm font-bold text-gray-700 mb-3 border-b border-gray-200 pb-2">표시 및 상태 설정</h4>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-2 block">진열 여부</label>
                    <div className="flex items-center gap-4 bg-white p-2.5 rounded-lg border border-gray-200">
                      <label className="flex items-center gap-2 text-sm cursor-pointer font-medium text-gray-700">
                        <input type="radio" name="editIsDisplayed" value="true" checked={productEditModal.isDisplayed === 'true'} onChange={e => setProductEditModal({...productEditModal, isDisplayed: e.target.value})} className="accent-blue-600" /> 진열하기
                      </label>
                      <label className="flex items-center gap-2 text-sm cursor-pointer font-medium text-gray-700">
                        <input type="radio" name="editIsDisplayed" value="false" checked={productEditModal.isDisplayed === 'false'} onChange={e => setProductEditModal({...productEditModal, isDisplayed: e.target.value})} className="accent-blue-600" /> 숨김
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-2 block">판매 상태</label>
                    <div className="grid grid-cols-2 gap-2 bg-white p-2.5 rounded-lg border border-gray-200">
                      {[ {l:'판매 예정', v:'scheduled'}, {l:'판매 중', v:'onSale'}, {l:'품절', v:'soldOut'}, {l:'판매 종료', v:'completed'} ].map(s => (
                        <label key={s.v} className="flex items-center gap-2 text-sm cursor-pointer font-medium text-gray-700 hover:bg-gray-50 p-1 rounded">
                          <input type="radio" name="editStatus" value={s.v} checked={productEditModal.status === s.v} onChange={e => setProductEditModal({...productEditModal, status: e.target.value})} className="accent-blue-600" /> {s.l}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">상세 설명</label>
                <textarea value={productEditModal.description} onChange={e => setProductEditModal({...productEditModal, description: e.target.value})} className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:border-blue-500 resize-none" rows="3"></textarea>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2 bg-gray-50 shrink-0">
              <button onClick={closeProductEditModal} className="px-5 py-2.5 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition font-bold">취소</button>
              <button onClick={handleUpdateProduct} className="px-6 py-2.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md transition font-bold">변경사항 즉시 저장</button>
            </div>
          </div>
        </div>
      )}

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

      {/* 스케줄러 예약 수정 모달 */}
      {editModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-lg font-bold mb-4 border-b pb-2 text-blue-700">예약 전송 수정</h3>
            <div className="space-y-5 mb-6">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">대상 상품</label>
                <div className="w-full bg-gray-50 p-2.5 text-sm rounded-lg text-gray-700 font-bold border border-gray-200">{editModal.task.productName}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">상태 변경</label>
                  <select value={editModal.status} onChange={e => setEditModal({...editModal, status: e.target.value})} className="w-full border border-gray-300 p-2.5 text-sm rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="scheduled">판매예정</option><option value="onSale">판매중</option><option value="soldOut">품절</option><option value="completed">판매종료</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">진열 변경</label>
                  <select value={editModal.isDisplayed} onChange={e => setEditModal({...editModal, isDisplayed: e.target.value})} className="w-full border border-gray-300 p-2.5 text-sm rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="true">진열함 (표시)</option><option value="false">진열안함 (숨김)</option>
                  </select>
                </div>
              </div>
              
              {/* ⭐️ 수정 모달에도 인라인 날짜/시간 선택기 적용 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">날짜 변경</label>
                  <input 
                    type="date" 
                    value={editModal.date} 
                    onChange={e => setEditModal({...editModal, date: e.target.value})} 
                    className="w-full border border-gray-300 px-3 py-2.5 text-sm rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">시간 변경</label>
                  <div className="flex items-center gap-1.5">
                    <input 
                      type="time" 
                      value={editModal.time} 
                      onChange={e => setEditModal({...editModal, time: e.target.value})} 
                      className="flex-1 border border-gray-300 px-3 py-2.5 text-sm rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button 
                      type="button"
                      onClick={(e) => {
                        const timeInput = e.currentTarget.previousElementSibling;
                        if (timeInput) timeInput.blur();
                      }} 
                      className="px-3 py-2.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg shadow-sm hover:bg-blue-100 transition font-bold text-xs whitespace-nowrap"
                    >
                      ✅ 확인
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
              <button onClick={() => setEditModal({...editModal, isOpen: false})} className="px-5 py-2.5 bg-gray-100 rounded-lg font-bold text-sm hover:bg-gray-200 transition border border-gray-200">취소</button>
              <button onClick={handleConfirmEdit} className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-bold text-sm shadow-md hover:bg-blue-700 transition">수정 저장하기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
