import React, { useState, useEffect, useRef } from 'react';

const DEFAULT_GROUP_ID = 'G0IZUDWCL';
const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const SCHEDULER_API_URL = 'https://2fb8b65g8f.execute-api.ap-southeast-2.amazonaws.com/schedule';
const CLIENT_ID = '4582f19ca0325304d27abbd18a36b21b'; 
const SCOPES = 'email poll option vote addresses member:MOIM:payment:read member:MOIM:product:read member:MOIM:product:write';

const createCodeVerifier = () => btoa(String.fromCharCode(...new Uint8Array(crypto.getRandomValues(new Uint8Array(32))))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const createCodeChallenge = async (verifier) => btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest("SHA-256", (new TextEncoder()).encode(verifier))))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

// --- ⭐️ 컬러 및 상태 디자인 변수 ---
const colorVariants = {
  blue: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/30',
  red: 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/30',
  green: 'bg-green-600 hover:bg-green-700 text-white shadow-green-500/30',
  purple: 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-500/30',
  edit: 'bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200',
  delete: 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200'
};

// ⭐️ Vite 기본 CSS(너비 제한) 강제 무력화 및 공통 스타일 (분리형 컴포넌트)
const GlobalStyles = () => (
  <style dangerouslySetInnerHTML={{__html: `
    html, body, #root {
      max-width: none !important;
      width: 100vw !important;
      margin: 0 !important;
      padding: 0 !important;
      display: block !important;
      text-align: left !important;
      overflow-x: hidden !important;
    }
    
    .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.3); border-radius: 10px; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(148, 163, 184, 0.5); }
    
    @keyframes fadeInFast {
      0% { opacity: 0; transform: translateY(5px); }
      100% { opacity: 1; transform: translateY(0); }
    }
    .animate-fade-in-fast { animation: fadeInFast 0.2s ease-out forwards; }
  `}} />
);

// --- 커스텀 글래스몰피즘 Select 드랍다운 ---
function GlassSelect({ value, options, onChange, placeholder = "선택해주세요" }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedLabel = options.find(o => o.value === value)?.label || placeholder;

  return (
    <div className="relative w-full" ref={ref}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 bg-white/50 border border-white/60 rounded-2xl cursor-pointer hover:bg-white/70 transition-all text-sm font-bold text-slate-700 shadow-sm flex justify-between items-center group"
      >
        <span>{selectedLabel}</span>
        <svg className={`w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"></path></svg>
      </div>
      
      <div className={`absolute left-0 right-0 top-full mt-2 z-[200] transition-all duration-300 ease-out origin-top ${isOpen ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-0 pointer-events-none'}`}>
        <div className="bg-white/90 backdrop-blur-2xl border border-white/60 rounded-2xl shadow-xl p-1.5 overflow-hidden">
          {options.map((opt) => (
            <div 
              key={opt.value}
              onClick={() => { onChange(opt.value); setIsOpen(false); }}
              className={`px-3 py-2.5 rounded-xl text-sm font-bold cursor-pointer transition-all ${value === opt.value ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'}`}
            >
              {opt.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- 커스텀 Date/Time Picker ---
function GlassDateTimePicker({ date, time, onDateChange, onTimeChange, onConfirm, onCancel }) {
  const today = new Date();
  const initialDate = date ? new Date(date) : today;
  const [currentMonth, setCurrentMonth] = useState(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(date ? initialDate : null);
  const [hour, setHour] = useState(time ? time.split(':')[0] : '12');
  const [minute, setMinute] = useState(time ? time.split(':')[1] : '00');

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const startDay = currentMonth.getDay();
  const days = [];
  for (let i = 0; i < startDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

  const handleConfirm = () => {
    if (!selectedDate) return;
    const y = selectedDate.getFullYear();
    const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const d = String(selectedDate.getDate()).padStart(2, '0');
    const finalDateStr = `${y}-${m}-${d}`;
    const finalTimeStr = `${hour}:${minute}`;
    onDateChange(finalDateStr);
    onTimeChange(finalTimeStr);
    onConfirm(finalDateStr, finalTimeStr);
  };

  return (
    <div className="bg-white/95 backdrop-blur-2xl border border-white/60 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.3)] rounded-3xl p-6 w-[320px] max-w-[90vw] animate-fade-in-fast">
      <div className="flex justify-between items-center mb-5">
        <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-600 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"></path></svg></button>
        <span className="font-extrabold text-slate-800 text-sm">{currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월</span>
        <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-600 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"></path></svg></button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-3 text-center">
        {['일', '월', '화', '수', '목', '금', '토'].map(d => (
          <div key={d} className="text-[10px] font-extrabold text-slate-400">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 mb-6">
        {days.map((d, i) => {
          if (!d) return <div key={i} className="h-8"></div>;
          const thisDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d);
          const isSelected = selectedDate && thisDate.getTime() === selectedDate.getTime();
          const isPast = thisDate.getTime() < new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
          
          return (
            <button 
              key={i} 
              disabled={isPast}
              onClick={() => setSelectedDate(thisDate)}
              className={`h-8 w-8 rounded-full text-xs font-bold mx-auto flex items-center justify-center transition-all ${
                isSelected 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30 scale-110' 
                  : isPast 
                    ? 'text-slate-300 cursor-not-allowed' 
                    : 'text-slate-700 hover:bg-blue-50 hover:text-blue-600'
              }`}
            >
              {d}
            </button>
          );
        })}
      </div>

      <div className="border-t border-slate-200/50 pt-5 mb-6">
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 ml-1">시간 설정</label>
        <div className="flex items-center gap-3">
          <select value={hour} onChange={e => setHour(e.target.value)} className="flex-1 bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2.5 text-center font-mono font-bold text-slate-700 outline-none focus:border-blue-400 shadow-sm cursor-pointer hover:bg-white transition-colors">
            {Array.from({length: 24}, (_, i) => String(i).padStart(2, '0')).map(h => <option key={h} value={h}>{h}시</option>)}
          </select>
          <span className="font-bold text-slate-400">:</span>
          <select value={minute} onChange={e => setMinute(e.target.value)} className="flex-1 bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2.5 text-center font-mono font-bold text-slate-700 outline-none focus:border-blue-400 shadow-sm cursor-pointer hover:bg-white transition-colors">
            {Array.from({length: 60}, (_, i) => String(i).padStart(2, '0')).map(m => <option key={m} value={m}>{m}분</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm">취소</button>
        <button type="button" onClick={handleConfirm} className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all ${colorVariants.blue}`}>적용하기</button>
      </div>
    </div>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState('');
  const [communityId] = useState(DEFAULT_GROUP_ID); 
  const [sellerId, setSellerId] = useState(''); 
  const [loginMode, setLoginMode] = useState('seller'); 
  const [activeTab, setActiveTab] = useState('productList'); 
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' }); 
  const [confirmDialog, setConfirmDialog] = useState({ visible: false, message: '', onConfirm: null });
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoginProcessing, setIsLoginProcessing] = useState(false);
  const [tasks, setTasks] = useState([]);

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState({ name: '', sku: '', tag: '', status: [], display: 'all' });
  const [pagingAfter, setPagingAfter] = useState(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [productEditModal, setProductEditModal] = useState({
    isOpen: false, id: '', name: '', price: '', stockType: 'unlimited', stockCount: '', isDisplayed: 'true', status: 'onSale', description: ''
  });

  const [scheduleForm, setScheduleForm] = useState({ products: [], status: 'onSale', isDisplayed: 'true' });
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

  const [isAdminAdvancedOpen, setIsAdminAdvancedOpen] = useState(false);
  const [infoHeight, setInfoHeight] = useState(104);
  const sellerInfoRef = useRef(null);
  const adminInfoRef = useRef(null);
  const productSelectRef = useRef(null);

  const navRef = useRef(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ top: 0, height: 0, opacity: 0 });

  useEffect(() => {
    const updateIndicator = () => {
      if (navRef.current) {
        const activeElement = navRef.current.querySelector('[data-active="true"]');
        if (activeElement) {
          setIndicatorStyle({
            top: activeElement.offsetTop,
            height: activeElement.offsetHeight,
            opacity: 1
          });
        }
      }
    };
    
    updateIndicator();
    const timer = setTimeout(updateIndicator, 50); // DOM 렌더링 후 재조정
    window.addEventListener('resize', updateIndicator);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateIndicator);
    };
  }, [activeTab, isSidebarOpen]);

  useEffect(() => {
    const handleResize = () => { setIsSidebarOpen(window.innerWidth > 768); };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isAuthenticated) return;
    const updateHeight = () => {
      if (loginMode === 'seller' && sellerInfoRef.current) setInfoHeight(sellerInfoRef.current.offsetHeight);
      else if (loginMode === 'admin' && adminInfoRef.current) setInfoHeight(adminInfoRef.current.offsetHeight);
    };
    requestAnimationFrame(updateHeight);
    const timeoutId = setTimeout(updateHeight, 50);
    window.addEventListener('resize', updateHeight);
    return () => { clearTimeout(timeoutId); window.removeEventListener('resize', updateHeight); };
  }, [loginMode, isAdminAdvancedOpen, isAuthenticated]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (productSelectRef.current && !productSelectRef.current.contains(event.target)) setIsProductSelectOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const showToast = (message, type = 'info') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3500);
  };

  const showConfirm = (message, onConfirm) => {
    setConfirmDialog({ visible: true, message, onConfirm });
  };

  const closeConfirm = () => {
    setConfirmDialog({ visible: false, message: '', onConfirm: null });
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

      let res = await fetch(`/api/proxy?endpoint=users/me`, fetchOptions);
      if (!res.ok) res = await fetch(`/api/proxy?endpoint=me`, fetchOptions);
      if (!res.ok) throw new Error("유저 프로필 정보를 가져오지 못했습니다.");
      
      const data = await res.json();
      let sellerProfileId = data.profiles?.find(p => p.profileId && p.profileId.startsWith('CS:'))?.profileId;
      
      if (!sellerProfileId && data.id) {
        const bulkRes = await fetch(`/api/proxy?endpoint=users/bulk`, {
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
    fetchProductsWithArgs(token, cleanId, loginMode, false);
  };

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
          showToast('비정상적인 로그인 접근입니다.', 'error');
          setIsLoginProcessing(false);
          return;
        }

        try {
          const redirectUri = `${window.location.origin}/canpass/callback`;
          const res = await fetch('/api/token', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ client_id: CLIENT_ID, code: code, code_verifier: codeVerifier, redirect_uri: redirectUri })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error_description || data.error || '토큰 발급 실패');
          const accessToken = data.access_token;
          let finalSellerId = '';
          if (savedLoginMode === 'admin') {
            finalSellerId = savedAdminTargetId || '';
          } else {
            const autoId = await autoFetchSellerId(accessToken);
            if (autoId) { finalSellerId = autoId; } 
            else { showToast('셀러 ID 자동 탐지에 실패했습니다. 직접 입력해주세요.', 'warning'); }
          }
          setToken(accessToken);
          setSellerId(finalSellerId);
          setLoginMode(savedLoginMode);
          setIsAuthenticated(true);
          localStorage.setItem('cand_token', accessToken);
          localStorage.setItem('cand_seller_id', finalSellerId);
          localStorage.setItem('cand_login_mode', savedLoginMode);
          fetchProductsWithArgs(accessToken, finalSellerId, savedLoginMode, false);
          fetchScheduledTasks(accessToken);
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
        const savedToken = localStorage.getItem('cand_token');
        const savedSellerId = localStorage.getItem('cand_seller_id');
        const savedMode = localStorage.getItem('cand_login_mode') || 'seller';
        const savedRecentProducts = localStorage.getItem('cand_recent_products');
        if (savedToken) {
          setToken(savedToken);
          setSellerId(savedSellerId || '');
          setLoginMode(savedMode);
          setIsAuthenticated(true);
          fetchProductsWithArgs(savedToken, savedSellerId, savedMode, false);
          fetchScheduledTasks(savedToken);
        }
        if (savedRecentProducts) {
          try { setRecentProducts(JSON.parse(savedRecentProducts)); } catch(e) {}
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
    setActiveTab('productList');
    setToken('');
    setSellerId('');
    setProducts([]);
    setTasks([]);
    showToast('로그아웃 되었습니다.', 'success');
  };

  const fetchScheduledTasks = async (currentToken) => {
    try {
      const res = await fetch(SCHEDULER_API_URL, {
        method: 'POST', headers: getAuthHeaders(currentToken), 
        body: JSON.stringify({ action: 'LIST', token: currentToken, communityId })
      });
      if (!res.ok) {
        if (res.status === 500) { setTasks([]); return; }
        throw new Error(`서버 응답 오류: ${res.status}`);
      }
      const responseText = await res.text();
      let data;
      try { data = JSON.parse(responseText); } 
      catch (e) { throw new Error("서버가 JSON이 아닌 데이터를 반환했습니다."); }
      const fetchedList = data.tasks || data.data || (Array.isArray(data) ? data : []);
      const formattedTasks = fetchedList.map(task => ({
        ...task, logs: task.logs || [`☁️ 서버에서 저장된 예약 정보를 불러왔습니다. (${new Date().toLocaleTimeString()})`]
      }));
      setTasks(formattedTasks);
    } catch (err) {
      console.error('예약 목록 조회 실패 상세 에러:', err);
    }
  };

  const fetchProductsWithArgs = async (currentToken, currentSellerId, currentMode, isLoadMore = false) => {
    if (currentMode === 'seller' && !currentSellerId) return;
    if (isLoadMore) setIsLoadingMore(true);
    else setIsLoading(true);
    try {
      const activeToken = currentToken || token;
      if (!activeToken) throw new Error("유효한 토큰이 없습니다.");
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
      if (filters.display !== 'all') params.append('isDisplayed', filters.display);
      const url = `/api/proxy?${params.toString()}`;
      const res = await fetch(url, { method: 'GET', headers: getAuthHeaders(activeToken) });
      const responseText = await res.text();
      if (!res.ok) throw new Error(`API 오류: ${res.status}`);
      const data = JSON.parse(responseText);
      const list = data.data || [];
      if (isLoadMore) setProducts(prev => [...prev, ...list]);
      else setProducts(list);
      setPagingAfter(data.paging && data.paging.after ? data.paging.after : null);
    } catch (err) {
      showToast('목록 로드 실패: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const resetFilters = () => setFilters({ name: '', sku: '', tag: '', status: [], display: 'all' });
  const applyFilters = () => { setPagingAfter(null); fetchProductsWithArgs(token, sellerId, loginMode, false); };
  const loadMoreProducts = () => { fetchProductsWithArgs(token, sellerId, loginMode, true); };
  const fetchProducts = () => { fetchProductsWithArgs(token, sellerId, loginMode, false); };

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
    const updateData = { name, price: Number(price), stockCount: finalStockCount, status, description, isDisplayed: isDisplayed === 'true' };
    try {
      showToast('상품 정보를 갱신 중입니다...', 'info');
      const res = await fetch(`/api/proxy?endpoint=products/${id}`, {
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
    setScheduleForm({ ...scheduleForm, products: scheduleForm.products.filter(p => p.id !== productId) });
  };

  const handleProductKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const matched = products.filter(p => p.name.includes(productSearchTerm) || p.id.includes(productSearchTerm));
      if (matched.length > 0) handleSelectProduct(matched[0]);
    }
  };

  const handleConfirmDatePicker = (selectedD, selectedT) => {
    const finalDate = selectedD || pickerDate;
    const finalTime = selectedT || pickerTime;
    if (!finalDate || !finalTime) return showToast('날짜와 시간을 모두 선택해주세요.', 'error');
    setConfirmedDateTime(`${finalDate}T${finalTime}`);
    setIsDatePickerOpen(false);
  };

  const handlePreSubmit = (e) => {
    e.preventDefault();
    if (scheduleForm.products.length === 0) return showToast('최소 1개 이상의 상품을 선택해주세요.', 'error');
    if (!confirmedDateTime) return showToast('실행 일시를 설정해주세요.', 'error');
    const executeTime = new Date(confirmedDateTime).getTime();
    if (executeTime <= Date.now()) return showToast('실행 시간은 현재 시간 이후여야 합니다.', 'error');
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
      setConfirmedDateTime(''); setPickerDate(''); setPickerTime('');
      setScheduleForm({ ...scheduleForm, products: [] });
      showToast(`${scheduleForm.products.length}건의 상품 예약이 전송되었습니다!`, 'success');
    } catch (err) { showToast('예약 전송 중 오류가 발생했습니다.', 'error'); }
  };

  const handleDeleteTask = async (task) => {
    if (!window.confirm(`[${task.productName}] 예약을 정말 삭제하시겠습니까?`)) return;
    try {
      showToast('삭제 중...', 'info');
      const response = await fetch(SCHEDULER_API_URL, {
        method: 'POST', headers: getAuthHeaders(token), 
        body: JSON.stringify({ action: 'DELETE', taskId: task.id, token, communityId })
      });
      if (!response.ok) throw new Error();
      setTasks(prev => prev.filter(t => t.id !== task.id));
      showToast('예약이 취소되었습니다.', 'success');
    } catch (err) { showToast(`삭제 실패`, 'error'); }
  };

  const openEditModal = (task) => {
    const d = new Date(task.executeAt);
    const tzoffset = d.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(d.getTime() - tzoffset)).toISOString().slice(0, 16);
    const [date, time] = localISOTime.split('T');
    setEditModal({ isOpen: true, task, status: task.newStatus, isDisplayed: task.newIsDisplayed ? 'true' : 'false', date, time, isDatePickerOpen: false });
  };

  const handleConfirmEdit = async () => {
    if (!editModal.date || !editModal.time) return showToast('수정할 날짜와 시간을 입력해주세요.', 'error');
    const executeTimeIso = new Date(`${editModal.date}T${editModal.time}`).toISOString();
    try {
      showToast('수정 중...', 'info');
      const response = await fetch(SCHEDULER_API_URL, {
        method: 'POST', headers: getAuthHeaders(token), 
        body: JSON.stringify({ action: 'UPDATE', taskId: editModal.task.id, productId: editModal.task.productId, newStatus: editModal.status, newIsDisplayed: editModal.isDisplayed === 'true', executeAt: executeTimeIso, token, communityId })
      });
      if (!response.ok) throw new Error();
      setTasks(prev => prev.map(t => t.id === editModal.task.id ? { ...t, newStatus: editModal.status, newIsDisplayed: editModal.isDisplayed === 'true', executeAt: new Date(`${editModal.date}T${editModal.time}`).getTime() } : t)); 
      setEditModal({ ...editModal, isOpen: false });
      showToast('예약이 수정되었습니다.', 'success');
    } catch (err) { showToast(`수정 실패`, 'error'); }
  };

  const translateStatus = (status) => ({ scheduled: '판매예정', onSale: '판매중', soldOut: '품절', completed: '판매종료' }[status] || status);
  const displayedTasks = tasks.filter(task => products.some(p => p.id === task.productId));
  const filteredProducts = products.filter(p => p.name.includes(productSearchTerm) || p.id.includes(productSearchTerm));

  const glassPanel = "bg-white/60 backdrop-blur-xl border border-white/50 shadow-sm rounded-3xl";
  const glassInput = "w-full px-4 py-3 bg-white/50 border border-white/60 rounded-2xl focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm text-slate-800 shadow-sm placeholder-slate-400";
  const glassButtonPrimary = `w-full py-3.5 font-bold rounded-2xl shadow-lg transition-all ${colorVariants.blue}`;
  const glassButtonSecondary = "px-4 py-2 bg-white/60 hover:bg-white/90 border border-white/60 rounded-xl text-slate-700 font-bold shadow-sm transition-all text-sm";
  const statusOptions = [{ value: 'scheduled', label: '판매예정' }, { value: 'onSale', label: '판매중' }, { value: 'soldOut', label: '품절' }, { value: 'completed', label: '판매종료' }];
  const displayOptions = [{ value: 'true', label: '진열함 (표시)' }, { value: 'false', label: '진열안함 (숨김)' }];

  const CustomUI = () => (
    <div className="relative z-[2000]">
      {toast.visible && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 animate-fade-in-fast z-[2000]">
          <div className={`px-6 py-3.5 rounded-2xl backdrop-blur-md shadow-xl border border-white/20 text-sm font-bold text-white tracking-wide ${toast.type === 'error' ? 'bg-red-500/90' : toast.type === 'warning' ? 'bg-yellow-500/90' : 'bg-slate-800/90'}`}>
            {typeof toast.message === 'string' ? toast.message : JSON.stringify(toast.message)}
          </div>
        </div>
      )}
      {confirmDialog.visible && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
          <div className="bg-white/90 backdrop-blur-2xl rounded-3xl shadow-2xl p-6 w-full max-w-sm border border-white/50">
            <h3 className="text-lg font-extrabold text-slate-800 mb-2">확인</h3>
            <p className="text-slate-600 mb-6 font-medium">{typeof confirmDialog.message === 'string' ? confirmDialog.message : JSON.stringify(confirmDialog.message)}</p>
            <div className="flex justify-end gap-2">
              <button onClick={closeConfirm} className={glassButtonSecondary}>취소</button>
              <button onClick={confirmDialog.onConfirm} className={`px-5 py-2 rounded-xl font-bold shadow-md transition-all ${colorVariants.blue}`}>확인</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ==========================================
  // 로그인 화면 (Demo Mode 기능 추가)
  // ==========================================
  if (!isAuthenticated) {
    return (
      <>
        <GlobalStyles />
        <div className="min-h-screen w-screen bg-gradient-to-br from-indigo-100 via-slate-50 to-purple-100 flex items-center justify-center p-4 sm:p-6 font-sans text-slate-800 relative overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-[80px] opacity-40 animate-pulse pointer-events-none"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-[80px] opacity-40 animate-pulse pointer-events-none"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-[100px] opacity-30 pointer-events-none"></div>
          <CustomUI />
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
              <form onSubmit={handleOAuthLogin} className="p-6 sm:p-8 pb-8 sm:pb-10 flex flex-col gap-5 sm:gap-6">
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
                  <button type="submit" disabled={isLoginProcessing} className="relative w-full py-3.5 sm:py-4 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 text-white font-extrabold rounded-2xl shadow-lg transition-all disabled:opacity-50">
                    {isLoginProcessing ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5 animate-spin text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        인증 처리 중...
                      </span>
                    ) : '시작하기'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <GlobalStyles />
      <div className="flex h-screen w-screen bg-gradient-to-br from-indigo-50 via-slate-50 to-purple-50 text-slate-800 font-sans overflow-hidden p-2 md:p-4 gap-4 relative">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-300 rounded-full mix-blend-multiply filter blur-[100px] opacity-30 pointer-events-none"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-300 rounded-full mix-blend-multiply filter blur-[100px] opacity-30 pointer-events-none"></div>
        <CustomUI />
        {isSidebarOpen && <div className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm md:hidden" onClick={() => setIsSidebarOpen(false)}></div>}
        <aside className={`${isSidebarOpen ? 'translate-x-0 w-64 opacity-100' : '-translate-x-full w-64 md:translate-x-0 md:w-0 md:opacity-0'} fixed md:relative inset-y-2 md:inset-y-0 left-2 md:left-0 z-50 h-[calc(100vh-1rem)] md:h-full shrink-0 ${glassPanel} flex flex-col transition-all duration-300 overflow-hidden shadow-2xl md:shadow-none`}>
          <div className="h-16 md:h-20 shrink-0 border-b border-white/40 bg-white/30 flex items-center justify-center">
            <span className="text-xl md:text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 tracking-tight">VAKEWork</span>
          </div>
          
          <nav ref={navRef} className="flex-1 overflow-y-auto p-4 space-y-2 relative isolate">
            <div 
              className="absolute left-4 right-4 bg-white shadow-sm rounded-2xl transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] -z-10 border border-white/60"
              style={{ 
                top: `${indicatorStyle.top}px`, 
                height: `${indicatorStyle.height}px`, 
                opacity: indicatorStyle.opacity 
              }}
            />

            <div className="px-2 pt-2 pb-1"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Management</span></div>
            <button 
              data-active={activeTab === 'productList'} 
              onClick={() => {setActiveTab('productList'); if(window.innerWidth < 768) setIsSidebarOpen(false);}} 
              className={`w-full text-left px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 relative z-10 ${activeTab === 'productList' ? 'text-blue-600' : 'text-slate-600 hover:bg-white/50'}`}
            >
              상품 현황 보드
            </button>
            <button 
              data-active={activeTab === 'schedule'} 
              onClick={() => {setActiveTab('schedule'); if(window.innerWidth < 768) setIsSidebarOpen(false);}} 
              className={`w-full text-left px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 relative z-10 ${activeTab === 'schedule' ? 'text-blue-600' : 'text-slate-600 hover:bg-white/50'}`}
            >
              상태 예약 변경
            </button>
            
            <div className="px-2 pt-6 pb-1"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">System</span></div>
            <button 
              data-active={activeTab === 'settings'} 
              onClick={() => {setActiveTab('settings'); if(window.innerWidth < 768) setIsSidebarOpen(false);}} 
              className={`w-full text-left px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 relative z-10 ${activeTab === 'settings' ? 'text-slate-800' : 'text-slate-600 hover:bg-white/50'}`}
            >
              환경 설정
            </button>
          </nav>

          <div className="p-4 border-t border-white/40 bg-white/30">
            <button onClick={handleLogout} className="w-full py-3 text-sm text-red-500 font-extrabold bg-white/80 border border-red-200 hover:bg-red-500 hover:text-white hover:border-red-500 rounded-2xl transition-all duration-300 shadow-sm hover:shadow-lg hover:shadow-red-500/30 active:scale-95 flex items-center justify-center gap-2 group">
              <svg className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
              로그아웃
            </button>
          </div>
        </aside>
        <main className="flex-1 flex flex-col gap-4 overflow-hidden z-10 w-full relative">
          <header className={`${glassPanel} p-3 md:p-4 px-4 md:px-6 flex items-center justify-between shrink-0 min-h-[4rem] md:h-20 relative z-30`}>
            <div className="flex items-center gap-3 md:gap-4 w-full md:w-auto">
              <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="shrink-0 w-9 h-9 md:w-10 md:h-10 flex items-center justify-center bg-white/50 hover:bg-white rounded-xl shadow-sm text-slate-600 transition-all">≡</button>
              <h2 className="text-lg md:text-xl font-extrabold text-slate-800 tracking-tight truncate">{activeTab === 'productList' ? '상품 보드' : activeTab === 'schedule' ? '상태 예약 변경' : '환경 설정'}</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-white/60 border border-white/50 text-[10px] md:text-xs font-bold px-3 md:px-4 py-1.5 md:py-2.5 rounded-xl shadow-sm text-slate-600 truncate max-w-[120px]">ID: {sellerId || '미설정'}</span>
              <span className={`text-[10px] md:text-xs font-bold px-3 md:px-4 py-1.5 md:py-2.5 rounded-xl shadow-sm border ${loginMode === 'admin' ? 'bg-purple-100 border-purple-200 text-purple-700' : 'bg-blue-100 border-blue-200 text-blue-700'}`}>{loginMode.toUpperCase()}</span>
            </div>
          </header>
          <div className="flex-1 overflow-hidden relative">
            {activeTab === 'productList' && (
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
                      {products.map(p => (
                        <tr key={p.id} className="hover:bg-white/40 transition-colors group">
                          <td className="px-6 py-4">
                            <p className="font-extrabold text-slate-800 group-hover:text-blue-600 transition-colors">{p.name || '이름 없음'}</p>
                            <p className="text-[10px] text-slate-400 font-mono mt-1">{p.id}</p>
                          </td>
                          <td className="px-6 py-4 text-right font-mono font-bold text-slate-700">{p.price?.toLocaleString()} {p.currency || 'KRW'}</td>
                          <td className="px-6 py-4 text-center"><span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white shadow-sm border border-white/60">{translateStatus(p.status)}</span></td>
                          <td className="px-6 py-4 text-center"><button onClick={() => openProductEditModal(p)} className="text-xs font-bold text-blue-600 bg-white/50 px-3 py-1.5 rounded-lg border border-white/60 hover:bg-white transition-all">수정</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {pagingAfter && <button onClick={loadMoreProducts} className="w-full py-6 text-slate-400 text-xs font-bold hover:text-blue-600 transition-colors">결과 더 보기</button>}
                  {products.length === 0 && !isLoading && <div className="p-20 text-center text-slate-400 font-bold">표시할 상품이 없습니다.</div>}
                </div>
              </div>
            )}

            {activeTab === 'schedule' && (
              <div className="flex flex-col gap-4 h-full overflow-y-auto custom-scrollbar pb-4 pr-1 relative">
                <div className={`shrink-0 ${glassPanel} p-5 md:p-6 flex flex-col relative z-20`}>
                  <h3 className="font-extrabold text-base md:text-lg text-slate-800 mb-6">예약 생성기</h3>
                  <form onSubmit={handlePreSubmit} className="space-y-4">
                    <div className="relative z-[60]" ref={productSelectRef}>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">1. 대상 상품 검색 (다중)</label>
                      <div className="relative">
                        <input 
                          type="text" 
                          placeholder="상품명 또는 ID 입력" 
                          value={productSearchTerm} 
                          onChange={e => {setProductSearchTerm(e.target.value); setIsProductSelectOpen(true);}} 
                          onFocus={() => setIsProductSelectOpen(true)} 
                          onKeyDown={handleProductKeyDown} 
                          className={glassInput} 
                        />
                        {isProductSelectOpen && (
                          <div className="absolute left-0 right-0 top-full mt-1.5 bg-white/90 backdrop-blur-2xl border border-white/60 shadow-xl rounded-2xl z-[70] max-h-56 overflow-y-auto p-2 animate-fade-in-fast">
                            {filteredProducts.map(p => (
                              <button key={p.id} type="button" onClick={() => handleSelectProduct(p)} className="w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-blue-50 transition-all mb-1 flex justify-between items-center">
                                <span className="font-bold text-slate-700 truncate">{p.name}</span>
                                <span className="text-[9px] text-slate-400 font-mono shrink-0">{p.id}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3 p-2 border border-white/60 rounded-xl bg-white/30 min-h-[40px]">
                        {scheduleForm.products.map(prod => (
                          <div key={prod.id} className="flex items-center bg-white border border-white/80 shadow-sm text-slate-700 px-2.5 py-1.5 rounded-xl text-xs font-bold">
                            <span className="mr-2 truncate max-w-[100px]">{prod.name}</span>
                            <button type="button" onClick={() => handleRemoveProduct(prod.id)} className="text-red-400 hover:text-red-600">×</button>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-[50]">
                      <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">2. 변경 상태</label><GlassSelect value={scheduleForm.status} options={statusOptions} onChange={val => setScheduleForm({...scheduleForm, status: val})} /></div>
                      <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">3. 진열 여부</label><GlassSelect value={scheduleForm.isDisplayed} options={displayOptions} onChange={val => setScheduleForm({...scheduleForm, isDisplayed: val})} /></div>
                    </div>
                    <div className="relative z-[40]">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">4. 실행 일시</label>
                      <div onClick={() => setIsDatePickerOpen(true)} className={glassInput + " cursor-pointer flex justify-between items-center group"}>
                        <span className={confirmedDateTime ? 'text-slate-800 font-extrabold' : 'text-slate-400'}>{confirmedDateTime ? new Date(confirmedDateTime).toLocaleString() : '클릭하여 일시 선택'}</span>
                        <span className="text-slate-400 group-hover:text-blue-500 transition-colors">📅</span>
                      </div>
                    </div>
                    <button type="submit" className={glassButtonPrimary}>예약 정보 클라우드 전송</button>
                  </form>

                  {/* ⭐️ 예약 생성기 캘린더 모듈 (XYZ 포지션 설정부) */}
                  {isDatePickerOpen && (
                    <>
                      <div className="fixed inset-0 z-[900]" onClick={() => setIsDatePickerOpen(false)}></div>
                      <div className="absolute top-16 right-20 z-[1000]">
                        <GlassDateTimePicker 
                          date={pickerDate} 
                          time={pickerTime} 
                          onDateChange={setPickerDate} 
                          onTimeChange={setPickerTime} 
                          onConfirm={handleConfirmDatePicker} 
                          onCancel={() => setIsDatePickerOpen(false)} 
                        />
                      </div>
                    </>
                  )}

                </div>
                <div className={`flex-1 min-h-[400px] shrink-0 ${glassPanel} p-5 md:p-6 flex flex-col overflow-hidden relative z-10`}>
                  <div className="flex justify-between items-center mb-6 border-b border-white/40 pb-4">
                    <h3 className="font-extrabold text-slate-800 text-lg">클라우드 대기열 <span className="text-xs text-blue-500 ml-2 font-bold">(창을 닫아도 무방합니다)</span></h3>
                    <button onClick={() => fetchScheduledTasks(token)} className={glassButtonSecondary}>갱신</button>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
                    {displayedTasks.map(t => (
                      <div key={t.id} className="p-4 bg-white/50 border border-white/60 shadow-sm rounded-2xl flex justify-between items-center hover:bg-white transition-all group">
                        <div>
                          <p className="font-extrabold text-slate-800 group-hover:text-blue-600 transition-colors">{t.productName}</p>
                          <p className="text-[10px] text-slate-500 font-bold mt-1">{new Date(t.executeAt).toLocaleString()} | {translateStatus(t.newStatus)} | {t.newIsDisplayed ? '진열' : '숨김'}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => openEditModal(t)} className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${colorVariants.edit}`}>수정</button>
                          <button onClick={() => handleDeleteTask(t)} className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${colorVariants.delete}`}>삭제</button>
                        </div>
                      </div>
                    ))}
                    {displayedTasks.length === 0 && !isLoading && <div className="py-20 text-center text-slate-300 font-bold">등록된 예약 정보가 없습니다.</div>}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="max-w-2xl mx-auto h-full w-full">
                <div className={`${glassPanel} p-8 flex flex-col gap-6`}>
                  <h3 className="text-xl font-extrabold border-b border-white/50 pb-4 text-slate-800">Connection Settings</h3>
                  <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Login Mode</label><p className="font-bold text-blue-600 bg-white/50 px-4 py-2 rounded-xl border border-white/60 inline-block">{loginMode.toUpperCase()}</p></div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Active Seller ID (추출 정보)</label>
                    <div className="flex gap-2">
                      <input type="text" value={sellerId} onChange={e => setSellerId(e.target.value)} className={`${glassInput} font-mono`} placeholder="CS:P8XL..." />
                      <button onClick={() => handleManualSaveSellerId(sellerId)} className={`${glassButtonPrimary} !w-auto px-6`}>저장</button>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold mt-2 ml-1">* 토큰에서 추출된 셀러 정보입니다. 잘못된 경우 수동 수정 가능합니다.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
        
        {/* 수정 모달 (Product Edit) */}
        {productEditModal.isOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeProductEditModal}></div>
            <div className="bg-white/90 backdrop-blur-2xl rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/50 relative z-10">
              <div className="px-6 py-5 border-b border-white/40 flex justify-between items-center bg-white/30 shrink-0">
                <h3 className="text-lg font-extrabold text-slate-800 font-sans">상품 정보 즉시 수정</h3>
                <button onClick={closeProductEditModal} className="text-slate-400 hover:text-slate-800 transition"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg></button>
              </div>
              <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
                <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1 block">상품명</label><input type="text" value={productEditModal.name} onChange={e => setProductEditModal({...productEditModal, name: e.target.value})} className={glassInput} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1 block">가격 (KRW)</label><input type="number" value={productEditModal.price} onChange={e => setProductEditModal({...productEditModal, price: e.target.value})} className={`${glassInput} font-mono`} /></div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1 block">재고 설정</label>
                    <div className="flex items-center gap-4 bg-white/50 px-4 py-3 rounded-2xl border border-white/60 mb-2 shadow-sm">
                      <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer text-slate-700"><input type="radio" name="stype" checked={productEditModal.stockType === 'unlimited'} onChange={() => setProductEditModal({...productEditModal, stockType: 'unlimited', stockCount: ''})} /> 무제한</label>
                      <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer text-slate-700"><input type="radio" name="stype" checked={productEditModal.stockType === 'limited'} onChange={() => setProductEditModal({...productEditModal, stockType: 'limited'})} /> 수량제한</label>
                    </div>
                    {productEditModal.stockType === 'limited' && <input type="number" value={productEditModal.stockCount} onChange={e => setProductEditModal({...productEditModal, stockCount: e.target.value})} className={glassInput + " font-mono"} placeholder="수량 입력" />}
                  </div>
                </div>
                <div className="bg-white/40 p-5 rounded-2xl border border-white/60 shadow-inner">
                  <h4 className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest mb-3 border-b border-white/50 pb-2 ml-1">표시 및 상태 설정</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block ml-1">진열 여부</label>
                      <div className="relative flex w-full p-1.5 bg-white/50 border border-white/60 rounded-2xl shadow-inner overflow-hidden cursor-pointer group">
                        <div 
                          className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] rounded-xl transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] shadow-md overflow-hidden ${
                            productEditModal.isDisplayed === 'true' 
                              ? 'left-1.5 bg-blue-500 shadow-blue-500/30' 
                              : 'left-[calc(50%+3px)] bg-purple-500 shadow-purple-500/30'
                          }`}
                        >
                          <div className="absolute inset-0 -translate-x-full group-hover:translate-x-[250%] transition-transform duration-1000 ease-in-out bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12"></div>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => setProductEditModal({...productEditModal, isDisplayed: 'true'})}
                          className={`relative z-10 flex-1 py-2.5 text-xs font-extrabold rounded-xl transition-all duration-300 active:scale-95 ${
                            productEditModal.isDisplayed === 'true' ? 'text-white drop-shadow-md' : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          진열 표시
                        </button>
                        <button 
                          type="button" 
                          onClick={() => setProductEditModal({...productEditModal, isDisplayed: 'false'})}
                          className={`relative z-10 flex-1 py-2.5 text-xs font-extrabold rounded-xl transition-all duration-300 active:scale-95 ${
                            productEditModal.isDisplayed === 'false' ? 'text-white drop-shadow-md' : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          숨김 (미진열)
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block ml-1">판매 상태</label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-white/50 px-4 py-3 rounded-xl border border-white/60 shadow-sm">
                        {[ {l:'판매 예정', v:'scheduled'}, {l:'판매 중', v:'onSale'}, {l:'품절', v:'soldOut'}, {l:'종료', v:'completed'} ].map(s => (
                          <label key={s.v} className="flex items-center gap-1.5 text-xs cursor-pointer font-bold text-slate-700 hover:text-blue-600 transition-colors">
                            <input type="radio" name="editStatus" value={s.v} checked={productEditModal.status === s.v} onChange={e => setProductEditModal({...productEditModal, status: e.target.value})} className="accent-blue-600 w-3.5 h-3.5" /> {s.l}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1 block">상세 설명</label><textarea value={productEditModal.description} onChange={e => setProductEditModal({...productEditModal, description: e.target.value})} className={glassInput + " resize-none h-24 custom-scrollbar"} /></div>
              </div>
              <div className="px-6 py-5 border-t border-white/40 flex justify-end gap-2 bg-white/30 shrink-0">
                <button onClick={closeProductEditModal} className={glassButtonSecondary}>취소</button>
                <button onClick={handleUpdateProduct} className={`px-6 py-2.5 text-sm rounded-xl shadow-md font-extrabold transition-all ${colorVariants.blue}`}>변경 저장하기</button>
              </div>
            </div>
          </div>
        )}

        {/* 예약 등록 확인 모달 */}
        {isConfirmModalOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsConfirmModalOpen(false)}></div>
            <div className="bg-white/90 backdrop-blur-2xl rounded-3xl p-8 w-full max-w-md shadow-2xl z-10 border border-white/50 relative animate-fade-in-fast">
              <h3 className="text-xl font-extrabold mb-6 text-slate-800 border-b border-slate-200 pb-3 font-sans">예약을 등록할까요?</h3>
              <div className="space-y-3 bg-white/50 p-5 rounded-2xl border border-white/60 mb-8 shadow-inner overflow-y-auto max-h-48 custom-scrollbar">
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">대상 상품 내역</p>
                <div className="space-y-1">{scheduleForm.products.map(p => <div key={p.id} className="text-sm font-extrabold text-slate-700 flex justify-between"><span>• {p.name}</span><span className="text-[10px] text-slate-400 font-mono">{p.id}</span></div>)}</div>
                <div className="border-t border-slate-200 my-3 pt-3">
                  <p className="text-sm flex justify-between font-bold text-slate-600"><span>변경 상태:</span> <span className="text-blue-600">{translateStatus(scheduleForm.status)}</span></p>
                  <p className="text-sm flex justify-between font-bold text-slate-600"><span>진열 여부:</span> <span className="text-blue-600">{scheduleForm.isDisplayed === 'true' ? '표시' : '숨김'}</span></p>
                  <p className="text-sm flex justify-between font-bold text-blue-700 mt-2 bg-blue-50 p-2 rounded-lg"><span>실행 시각:</span> <span>{new Date(confirmedDateTime).toLocaleString()}</span></p>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setIsConfirmModalOpen(false)} className={glassButtonSecondary}>취소</button>
                <button onClick={handleConfirmRegister} className={`px-6 py-2.5 rounded-xl font-extrabold shadow-lg transition-all ${colorVariants.blue}`}>전송 승인</button>
              </div>
            </div>
          </div>
        )}

        {/* 예약 내역 수정 모달 */}
        {editModal.isOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setEditModal({...editModal, isOpen: false})}></div>
            <div className="bg-white/90 backdrop-blur-2xl rounded-3xl w-full max-w-md p-8 shadow-2xl z-10 border border-white/50 relative animate-fade-in-fast">
              <h3 className="text-xl font-extrabold mb-6 text-slate-800 border-b border-slate-200 pb-3 font-sans">예약 수정</h3>
              <div className="space-y-5 mb-8">
                <div className="bg-white/50 p-4 rounded-xl border border-white/60"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">대상 상품</label><p className="text-sm font-extrabold text-slate-700">{editModal.task.productName}</p></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block">상태 변경</label><GlassSelect value={editModal.status} options={statusOptions} onChange={v => setEditModal({...editModal, status: v})} /></div>
                  <div><label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">진열 여부</label><GlassSelect value={editModal.isDisplayed} options={displayOptions} onChange={v => setEditModal({...editModal, isDisplayed: v})} /></div>
                </div>
                <div className="relative">
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block">시각 변경</label>
                  <div onClick={() => setEditModal({...editModal, isDatePickerOpen: true})} className={glassInput + " cursor-pointer flex justify-between items-center group"}>
                    <span className="font-extrabold text-slate-800">{editModal.date && editModal.time ? new Date(`${editModal.date}T${editModal.time}`).toLocaleString() : '시각 선택'}</span>
                    <span>📅</span>
                  </div>
                  {editModal.isDatePickerOpen && (
                    <>
                      <div className="fixed inset-0 z-[900]" onClick={() => setEditModal({...editModal, isDatePickerOpen: false})}></div>
                      <div className="absolute top-1/2 right-12 -translate-y-1/2 -mt-28 z-[1000]">
                        <GlassDateTimePicker date={editModal.date} time={editModal.time} onDateChange={d => setEditModal(prev => ({...prev, date: d}))} onTimeChange={t => setEditModal(prev => ({...prev, time: t}))} onConfirm={(d, t) => setEditModal(prev => ({...prev, date: d || prev.date, time: t || prev.time, isDatePickerOpen: false}))} onCancel={() => setEditModal(prev => ({...prev, isDatePickerOpen: false}))} />
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
                <button onClick={() => setEditModal({...editModal, isOpen: false})} className={glassButtonSecondary}>취소</button>
                <button onClick={handleConfirmEdit} className={`px-6 py-2.5 rounded-xl font-extrabold shadow-md transition-all ${colorVariants.blue}`}>수정 저장하기</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
