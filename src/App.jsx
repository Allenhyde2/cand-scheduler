import React, { useState, useEffect, useRef } from 'react';

const DEFAULT_GROUP_ID = 'G00O7NKV9M';
const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const SCHEDULER_API_URL = 'https://2fb8b65g8f.execute-api.ap-southeast-2.amazonaws.com/schedule';
const CLIENT_ID = '4582f19ca0325304d27abbd18a36b21b'; 
const SCOPES = 'email poll option vote addresses';

const createCodeVerifier = () => btoa(String.fromCharCode(...new Uint8Array(crypto.getRandomValues(new Uint8Array(32))))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const createCodeChallenge = async (verifier) => btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest("SHA-256", (new TextEncoder()).encode(verifier))))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

// --- ⭐️ 커스텀 글래스몰피즘 Select 드랍다운 ---
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

// --- ⭐️ 커스텀 Date/Time Picker ---
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
        <button type="button" onClick={handleConfirm} className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl shadow-[0_4px_12px_rgba(37,99,235,0.3)] hover:bg-blue-700 transition-all">적용하기</button>
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

  const [isAdminAdvancedOpen, setIsAdminAdvancedOpen] = useState(false);
  const [infoHeight, setInfoHeight] = useState(104);
  const sellerInfoRef = useRef(null);
  const adminInfoRef = useRef(null);

  const productSelectRef = useRef(null);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isAuthenticated) return;
    
    const updateHeight = () => {
      if (loginMode === 'seller' && sellerInfoRef.current) {
        setInfoHeight(sellerInfoRef.current.offsetHeight);
      } else if (loginMode === 'admin' && adminInfoRef.current) {
        setInfoHeight(adminInfoRef.current.offsetHeight);
      }
    };
    
    requestAnimationFrame(updateHeight);
    const timeoutId = setTimeout(updateHeight, 50);
    window.addEventListener('resize', updateHeight);
    
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', updateHeight);
    };
  }, [loginMode, isAdminAdvancedOpen, isAuthenticated]);

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
        const savedToken = localStorage.getItem('cand_token');
        const savedSellerId = localStorage.getItem('cand_seller_id');
        const savedMode = localStorage.getItem('cand_login_mode') || 'seller';
        const savedRecentProducts = localStorage.getItem('cand_recent_products');
        
        if (savedToken) {
          setToken(savedToken);
          setSellerId(savedSellerId || '');
          setLoginMode(savedMode);
          setIsAuthenticated(true);
          fetchProductsWithArgs(savedToken, DEFAULT_GROUP_ID, savedSellerId);
          fetchScheduledTasks(savedToken, DEFAULT_GROUP_ID);
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
    setSellerId('');
    setProducts([]);
    setTasks([]);
    localStorage.removeItem('cand_token');
    localStorage.removeItem('cand_seller_id');
    localStorage.removeItem('cand_login_mode');
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

      if (!activeToken && !isLocalhost) throw new Error("유효한 토큰이 없습니다. 다시 로그인해주세요.");

      const url = `https://cand-scheduler.vercel.app/api/proxy?endpoint=products&limit=100`;

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
        console.error("🔥 프록시 에러 (JSON이 아님):", responseText);
        throw new Error("상품 목록을 불러오는 프록시 서버 설정에 문제가 있습니다.");
      }

      let fetchedList = data.data || [];

      if (activeSellerId) {
        fetchedList = fetchedList.filter(p => {
          const idField = p.userId || p.sellerId || p.creatorId; 
          return idField ? idField === activeSellerId : true;
        });
      }

      setProducts(fetchedList);
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

  const openDatePicker = () => {
    const initialDateObj = confirmedDateTime ? new Date(confirmedDateTime) : new Date();
    const tzoffset = initialDateObj.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(initialDateObj.getTime() - tzoffset)).toISOString().slice(0, 16);
    const [d, t] = localISOTime.split('T');
    
    setPickerDate(d);
    setPickerTime(t);
    setIsDatePickerOpen(true);
  };

  const handleConfirmDatePicker = (selectedD, selectedT) => {
    const finalDate = selectedD || pickerDate;
    const finalTime = selectedT || pickerTime;

    if (!finalDate || !finalTime) {
      showToast('날짜와 시간을 모두 선택해주세요.', 'error');
      return;
    }
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
          headers: getAuthHeaders(token, communityId),
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
          logs: ['✅ AWS EventBridge에 성공적으로 등록되었습니다.', '💡 이제 브라우저를 종료하셔도 예약된 시간에 서버가 알아서 작업을 수행합니다.']
        });
      }));

      setTasks(prev => [...newTasks, ...prev]);
      setConfirmedDateTime(''); setPickerDate(''); setPickerTime('');
      setScheduleForm({ ...scheduleForm, products: [] });
      showToast(`${scheduleForm.products.length}건의 상품 예약이 전송되었습니다!`, 'success');
    } catch (err) { 
      showToast('예약 전송 중 오류가 발생했습니다.', 'error'); 
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
      time,
      isDatePickerOpen: false
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

  // --- 글래스몰피즘 공통 클래스 ---
  const glassPanel = "bg-white/60 backdrop-blur-xl border border-white/50 shadow-sm rounded-3xl";
  const glassInput = "w-full px-4 py-3 bg-white/50 border border-white/60 rounded-2xl focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm text-slate-800 shadow-sm placeholder-slate-400";
  const glassButtonPrimary = "w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-500/30 transition-all";
  const glassButtonSecondary = "px-4 py-2 bg-white/60 hover:bg-white/90 border border-white/60 rounded-xl text-slate-700 font-bold shadow-sm transition-all text-sm";

  const statusOptions = [
    { value: 'scheduled', label: '판매예정' }, { value: 'onSale', label: '판매중' },
    { value: 'soldOut', label: '품절' }, { value: 'completed', label: '판매종료' }
  ];
  const displayOptions = [
    { value: 'true', label: '진열함 (표시)' }, { value: 'false', label: '진열안함 (숨김)' }
  ];

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
            <p className="text-slate-600 mb-6 font-medium">
              {typeof confirmDialog.message === 'string' ? confirmDialog.message : JSON.stringify(confirmDialog.message)}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={closeConfirm} className={glassButtonSecondary}>취소</button>
              <button onClick={confirmDialog.onConfirm} className="px-5 py-2 bg-blue-600 text-white rounded-xl font-bold shadow-md transition-all">확인</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ==========================================
  // 로그인 화면 (글래스몰피즘 유지)
  // ==========================================
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-indigo-100 via-slate-50 to-purple-100 flex items-center justify-center p-4 font-sans text-slate-800 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-[80px] opacity-40 animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-[80px] opacity-40 animate-pulse"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-[100px] opacity-30"></div>
        
        <CustomUI />

        <div className="w-full max-w-md relative z-10 transition-all duration-300">
          <div className="bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[2.5rem] shadow-[0_8px_32px_0_rgba(31,38,135,0.1)] overflow-hidden">
            <div className="pt-12 pb-4 text-center flex flex-col items-center">
              <img src="https://ca.group-edge.net/i/G0IZUDWCL-logo-r1xy6d/logo" alt="VAKE Logo" className="h-16 mb-3 object-contain drop-shadow-md" />
              <p className="text-slate-500 text-xs font-extrabold tracking-widest uppercase">Commerce Workspace</p>
            </div>

            <div className="relative flex mx-8 mt-4 bg-white/20 rounded-2xl border border-white/30 shadow-inner backdrop-blur-md overflow-hidden group cursor-pointer">
              <div className={`absolute inset-y-0 w-1/2 rounded-2xl shadow-md transition-all duration-500 ease-out overflow-hidden flex items-center justify-center ${loginMode === 'seller' ? 'translate-x-0 bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-600 border border-blue-400/50 shadow-blue-500/30' : 'translate-x-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-purple-600 border border-purple-400/50 shadow-purple-500/30'}`}>
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-[250%] transition-transform duration-1000 ease-in-out bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12"></div>
              </div>
              <button type="button" onClick={() => setLoginMode('seller')} className={`relative z-10 flex-1 py-3 text-sm font-extrabold rounded-2xl transition-all duration-300 active:scale-95 ${loginMode === 'seller' ? 'text-white drop-shadow-md' : 'text-slate-500/80 hover:text-slate-800'}`}>판매자 로그인</button>
              <button type="button" onClick={() => setLoginMode('admin')} className={`relative z-10 flex-1 py-3 text-sm font-extrabold rounded-2xl transition-all duration-300 active:scale-95 ${loginMode === 'admin' ? 'text-white drop-shadow-md' : 'text-slate-500/80 hover:text-slate-800'}`}>어드민 로그인</button>
            </div>
            
            <form onSubmit={handleOAuthLogin} className="p-8 pb-10 flex flex-col gap-6">
              <div className="relative w-full overflow-hidden transition-[height] duration-400 ease-out" style={{ height: `${infoHeight}px` }}>
                
                <div ref={sellerInfoRef} className={`absolute top-0 left-0 w-full pb-2 transition-all duration-500 ease-out flex flex-col justify-start ${loginMode === 'seller' ? 'opacity-100 translate-x-0 z-10 pointer-events-auto' : 'opacity-0 -translate-x-10 pointer-events-none z-0'}`}>
                  <div className="bg-white/40 border border-white/50 p-5 rounded-2xl text-center shadow-sm">
                    <p className="text-blue-800 font-extrabold mb-2">👋 판매자 계정으로 접속합니다.</p>
                    <p className="text-slate-600 text-xs font-medium leading-relaxed">판매자 본인의 계정으로 로그인하여 등록된 상품의 판매 현황을 조회하고, 상태 변경 예약을 간편하게 관리하세요.</p>
                  </div>
                </div>

                <div ref={adminInfoRef} className={`absolute top-0 left-0 w-full pb-2 transition-all duration-500 ease-out flex flex-col justify-start ${loginMode === 'admin' ? 'opacity-100 translate-x-0 z-10 pointer-events-auto' : 'opacity-0 translate-x-10 pointer-events-none z-0'}`}>
                  <div className="space-y-4">
                    <div className="bg-white/40 border border-white/50 p-5 rounded-2xl text-center shadow-sm">
                      <p className="text-purple-800 font-extrabold mb-2">🛡️ 어드민 권한으로 접속합니다.</p>
                      <p className="text-slate-600 text-xs font-medium leading-relaxed">관리자 권한으로 커뮤니티의 <b className="text-purple-600 font-extrabold">전체 상품 현황</b>을 한눈에 파악하고 통합적으로 관리하세요.</p>
                    </div>
                    
                    <div className="border border-white/50 bg-white/20 rounded-2xl overflow-hidden shadow-sm transition-all duration-300">
                      <button type="button" onClick={() => setIsAdminAdvancedOpen(!isAdminAdvancedOpen)} className="w-full p-4 flex items-center justify-between text-slate-700 hover:bg-white/40 transition-colors">
                        <span className="font-extrabold text-sm flex items-center gap-2"><svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg> 특정 판매자 지정 조회 (선택)</span>
                        <svg className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${isAdminAdvancedOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                      </button>
                      <div className={`transition-opacity duration-300 ease-in-out ${isAdminAdvancedOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>
                        {isAdminAdvancedOpen && (
                          <div className="p-4 pt-0 animate-fade-in-fast">
                            <input type="text" value={sellerId} onChange={e => setSellerId(e.target.value)} placeholder="판매자 ID 입력 (ex: CS:P8XL...)" className={glassInput} />
                            <p className="text-[10px] text-slate-500 mt-2 ml-1 text-center font-bold">* 입력하지 않을 시 전체 상품을 불러옵니다.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <button type="submit" disabled={isLoginProcessing} className="relative w-full py-4 mt-2 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 bg-[length:200%_auto] hover:bg-right text-white font-extrabold rounded-2xl shadow-[0_8px_20px_-6px_rgba(99,102,241,0.6)] hover:shadow-[0_12px_25px_-6px_rgba(99,102,241,0.8)] transition-all duration-500 active:scale-[0.98] flex items-center justify-center gap-2 overflow-hidden group disabled:opacity-50 disabled:pointer-events-none">
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-[250%] transition-transform duration-1000 ease-in-out bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12"></div>
                {isLoginProcessing ? (
                  <><svg className="w-5 h-5 animate-spin text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>연동 중...</span></>
                ) : (
                  <><span>시작하기</span><svg className="w-5 h-5 group-hover:translate-x-1.5 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg></>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // 메인 대시보드 화면 (Glassmorphism & Bento & 반응형 유지)
  // ==========================================
  return (
    <div className="flex h-screen w-full bg-gradient-to-br from-indigo-50 via-slate-50 to-purple-50 text-slate-800 font-sans overflow-hidden p-2 md:p-4 gap-4 relative">
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-300 rounded-full mix-blend-multiply filter blur-[100px] opacity-30 pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-300 rounded-full mix-blend-multiply filter blur-[100px] opacity-30 pointer-events-none"></div>

      <CustomUI />
      
      {isSidebarOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm md:hidden" onClick={() => setIsSidebarOpen(false)}></div>
      )}

      <aside className={`
        ${isSidebarOpen ? 'translate-x-0 w-64 opacity-100' : '-translate-x-full w-64 md:translate-x-0 md:w-0 md:opacity-0'}
        fixed md:relative inset-y-2 md:inset-y-0 left-2 md:left-0 z-50 h-[calc(100vh-1rem)] md:h-full 
        shrink-0 ${glassPanel} flex flex-col transition-all duration-300 overflow-hidden shadow-2xl md:shadow-none
      `}>
        <div className="h-16 md:h-20 shrink-0 border-b border-white/40 bg-white/30 flex items-center justify-center">
          <span className="text-xl md:text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 tracking-tight drop-shadow-sm">VAKE<span className="text-slate-800">Work</span></span>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          <div className="px-2 pt-2 pb-1"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Management</span></div>
          <button onClick={() => {setActiveTab('productList'); if(window.innerWidth < 768) setIsSidebarOpen(false);}} className={`w-full text-left px-4 py-3 rounded-2xl text-sm font-bold transition-all ${activeTab === 'productList' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-600 hover:bg-white/50'}`}>상품 현황 보드</button>
          <button onClick={() => {setActiveTab('schedule'); if(window.innerWidth < 768) setIsSidebarOpen(false);}} className={`w-full text-left px-4 py-3 rounded-2xl text-sm font-bold transition-all ${activeTab === 'schedule' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-600 hover:bg-white/50'}`}>상태 예약 (서버리스)</button>
          <div className="px-2 pt-6 pb-1"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">System</span></div>
          <button onClick={() => {setActiveTab('settings'); if(window.innerWidth < 768) setIsSidebarOpen(false);}} className={`w-full text-left px-4 py-3 rounded-2xl text-sm font-bold transition-all ${activeTab === 'settings' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-600 hover:bg-white/50'}`}>환경 설정</button>
        </nav>
        <div className="p-4 border-t border-white/40 bg-white/30">
          <button onClick={handleLogout} className="w-full py-3 text-sm text-red-500 font-bold bg-white/50 hover:bg-white rounded-2xl transition-all shadow-sm flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg> 로그아웃
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col gap-4 overflow-hidden z-10 w-full relative">
        <header className={`${glassPanel} p-3 md:p-4 px-4 md:px-6 flex items-center justify-between shrink-0 min-h-[4rem] md:h-20 relative z-30`}>
          <div className="flex items-center gap-3 md:gap-4 w-full md:w-auto">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="shrink-0 w-9 h-9 md:w-10 md:h-10 flex items-center justify-center bg-white/50 hover:bg-white rounded-xl shadow-sm text-slate-600 transition-all"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg></button>
            <h2 className="text-lg md:text-xl font-extrabold text-slate-800 tracking-tight truncate max-w-[120px] md:max-w-none">{activeTab === 'productList' ? '상품 보드' : activeTab === 'schedule' ? '상태 예약 변경' : '환경 설정'}</h2>
          </div>
          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1.5 md:gap-3 shrink-0">
             <div className="bg-white/60 border border-white/50 text-[10px] md:text-xs font-bold px-3 md:px-4 py-1.5 md:py-2.5 rounded-xl shadow-sm flex items-center gap-1.5 text-slate-600"><span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.8)] shrink-0"></span><span className="truncate max-w-[80px] md:max-w-none">{sellerId ? sellerId : (loginMode === 'admin' ? '전체' : '미설정')}</span></div>
             <span className={`text-[10px] md:text-xs font-bold px-3 md:px-4 py-1.5 md:py-2.5 rounded-xl shadow-sm border ${loginMode === 'admin' ? 'bg-purple-100/80 border-purple-200 text-purple-700' : 'bg-blue-100/80 border-blue-200 text-blue-700'}`}>{loginMode.toUpperCase()}</span>
          </div>
        </header>

        <div className="flex-1 overflow-hidden relative">
          
          {activeTab === 'productList' && (
            <div className={`${glassPanel} flex flex-col h-full overflow-hidden`}>
              <div className="p-4 md:p-6 border-b border-white/40 flex justify-between items-center shrink-0">
                <h3 className="font-extrabold text-base md:text-lg text-slate-700">{loginMode === 'admin' && !sellerId ? '전체 상품' : '내 상품'}</h3>
                <button onClick={fetchProducts} disabled={isLoading} className={glassButtonSecondary} title="새로고침">
                  <span className="flex items-center gap-1 md:gap-2"><svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg> <span className="hidden sm:inline">최신화</span></span>
                </button>
              </div>

              <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-white/40 backdrop-blur-md border-b border-white/40 text-slate-500 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 md:px-6 py-3 md:py-4 font-extrabold uppercase text-[10px] md:text-xs w-12 md:w-16">Img</th>
                      <th className="px-4 md:px-6 py-3 md:py-4 font-extrabold uppercase text-[10px] md:text-xs">상품 정보</th>
                      <th className="px-4 md:px-6 py-3 md:py-4 font-extrabold uppercase text-[10px] md:text-xs text-right">가격</th>
                      <th className="px-4 md:px-6 py-3 md:py-4 font-extrabold uppercase text-[10px] md:text-xs text-center hidden sm:table-cell">상태</th>
                      <th className="px-4 md:px-6 py-3 md:py-4 font-extrabold uppercase text-[10px] md:text-xs text-center">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/40">
                    {products.length === 0 ? (
                      <tr><td colSpan="5" className="p-10 md:p-20 text-center text-slate-400 font-bold text-sm">조회된 상품이 없습니다.</td></tr>
                    ) : (
                      products.map(product => {
                        const imgUrl = product.images?.mobile?.[0] || product.images?.web?.[0] || '';
                        return (
                          <tr key={product.id} className="hover:bg-white/40 transition-colors group">
                            <td className="px-4 md:px-6 py-2 md:py-3">
                              {imgUrl ? <img src={imgUrl} className="w-9 h-9 md:w-11 md:h-11 rounded-lg md:rounded-xl object-cover shadow-sm" alt="상품" /> : <div className="w-9 h-9 md:w-11 md:h-11 bg-slate-100/50 rounded-lg md:rounded-xl flex items-center justify-center text-slate-300 border border-slate-200/50"><svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg></div>}
                            </td>
                            <td className="px-4 md:px-6 py-3 md:py-4">
                              <p className="font-extrabold text-slate-800 text-xs md:text-sm group-hover:text-blue-600 transition-colors max-w-[120px] sm:max-w-[200px] lg:max-w-xs truncate">{product.name}</p>
                              <p className="text-[9px] md:text-[11px] text-slate-400 font-mono mt-1 bg-white/50 inline-block px-1.5 rounded">{product.id}</p>
                            </td>
                            <td className="px-4 md:px-6 py-3 md:py-4 text-xs md:text-sm text-right font-mono font-bold text-slate-600">{product.price.toLocaleString()} <span className="text-[9px] md:text-[11px] font-sans text-slate-400">{product.currency || 'KRW'}</span></td>
                            <td className="px-4 md:px-6 py-3 md:py-4 text-center hidden sm:table-cell">
                              <div className="flex flex-col items-center gap-1.5">
                                <span className={`inline-block px-2.5 py-1 rounded-lg text-[10px] md:text-[11px] font-extrabold shadow-sm ${product.status === 'onSale' ? 'bg-green-500 text-white' : product.status === 'soldOut' ? 'bg-red-500 text-white' : 'bg-slate-200 text-slate-600'}`}>{translateStatus(product.status)}</span>
                                {!product.isDisplayed && <div className="text-[9px] md:text-[10px] text-slate-400 font-bold flex items-center gap-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path></svg> 숨김</div>}
                              </div>
                            </td>
                            <td className="px-4 md:px-6 py-2 md:py-3 text-center">
                              <button onClick={() => openProductEditModal(product)} className="text-slate-400 hover:text-blue-600 bg-white/40 hover:bg-white px-3 py-1.5 md:px-4 md:py-2 rounded-xl border border-white/60 shadow-sm transition-all text-[10px] md:text-xs font-bold flex items-center justify-center mx-auto gap-1 md:gap-1.5"><svg className="w-3.5 h-3.5 hidden md:block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg> 수정</button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'schedule' && (
             <div className="flex flex-col gap-4 h-full overflow-y-auto custom-scrollbar pb-4 pr-1 relative">
                
                <div className={`shrink-0 ${glassPanel} p-5 md:p-6 flex flex-col relative z-20`}>
                  <div className="flex justify-between items-center mb-5 md:mb-6">
                    <h3 className="font-extrabold text-base md:text-lg text-slate-800">예약 생성기</h3>
                    <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 md:px-2.5 py-1 rounded-md font-bold shadow-sm border border-emerald-200 flex items-center gap-1.5"><svg className="w-3 h-3 hidden md:block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg> Serverless</span>
                  </div>
                  
                  <form onSubmit={handlePreSubmit} className="space-y-4 md:space-y-5">
                    <div className="relative z-[60]" ref={productSelectRef}>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">1. 대상 상품 (검색)</label>
                      <input 
                        type="text"
                        placeholder="이름이나 ID 입력 후 클릭"
                        value={productSearchTerm}
                        onChange={(e) => {
                          setProductSearchTerm(e.target.value);
                          if (!isProductSelectOpen) setIsProductSelectOpen(true);
                          if (scheduleForm.productId) setScheduleForm({...scheduleForm, productId: ''});
                        }}
                        onFocus={() => setIsProductSelectOpen(true)}
                        className={glassInput}
                      />

                      {isProductSelectOpen && (
                        <div className="absolute left-0 right-0 top-full mt-2 bg-white/90 backdrop-blur-2xl border border-white/60 shadow-xl rounded-2xl z-[70] max-h-56 overflow-y-auto p-2 animate-fade-in-fast">
                          {productSearchTerm === '' && recentProducts.length > 0 && (
                            <div className="p-2 border-b border-white/50 bg-white/50 rounded-xl mb-2">
                              <div className="text-[10px] font-extrabold text-slate-400 mb-2 px-1 uppercase tracking-wider">최근 선택</div>
                              {recentProducts.map(p => (
                                <button key={`recent-${p.id}`} type="button" onClick={() => handleSelectProduct(p)} className="w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-white shadow-sm transition-all mb-1 flex justify-between items-center">
                                  <span className="font-bold text-slate-700 truncate mr-2">{p.name}</span>
                                  <span className="text-[9px] text-slate-400 font-mono shrink-0">{p.id}</span>
                                </button>
                              ))}
                            </div>
                          )}
                          <div className="px-1">
                            {filteredProducts.length === 0 ? (
                              <div className="px-3 py-4 text-center text-sm text-slate-400 font-bold">검색 결과가 없습니다.</div>
                            ) : (
                              filteredProducts.map(p => (
                                <button key={p.id} type="button" onClick={() => handleSelectProduct(p)} className="w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-blue-50 transition-all mb-1 flex justify-between items-center">
                                  <span className="font-bold text-slate-700 truncate mr-2">{p.name}</span>
                                  <span className="text-[9px] text-slate-400 font-mono shrink-0">{p.id}</span>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                      {scheduleForm.products && scheduleForm.products.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3 p-2.5 md:p-3 bg-white/40 rounded-2xl border border-white/60 shadow-inner max-h-32 overflow-y-auto custom-scrollbar">
                          {scheduleForm.products.map(prod => (
                            <div key={prod.id} className="flex items-center bg-white border border-white/80 shadow-sm text-slate-700 px-2.5 py-1 md:py-1.5 rounded-xl text-xs font-bold">
                              <span className="mr-1.5 md:mr-2 truncate max-w-[100px] md:max-w-[150px]">{prod.name}</span>
                              <button type="button" onClick={() => handleRemoveProduct(prod.id)} className="text-slate-400 hover:text-red-500 transition"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-[50]">
                      <div className="relative z-[50]">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">2. 변경 상태</label>
                        <GlassSelect value={scheduleForm.status} options={statusOptions} onChange={val => setScheduleForm({...scheduleForm, status: val})} />
                      </div>
                      <div className="relative z-[40]">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">3. 진열 여부</label>
                        <GlassSelect value={scheduleForm.isDisplayed} options={displayOptions} onChange={val => setScheduleForm({...scheduleForm, isDisplayed: val})} />
                      </div>
                    </div>
                    
                    <div className="relative z-[40]">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">4. 실행 일시</label>
                      <div onClick={() => setIsDatePickerOpen(true)} className="w-full px-4 py-3 bg-white/50 border border-white/60 rounded-2xl text-xs md:text-sm cursor-pointer flex justify-between items-center hover:bg-white/70 transition-all shadow-sm group relative z-[45]">
                        <span className={confirmedDateTime ? 'text-slate-800 font-extrabold' : 'text-slate-400 font-bold'}>
                          {confirmedDateTime ? new Date(confirmedDateTime).toLocaleString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '클릭하여 시간 설정'}
                        </span>
                        <span className="text-slate-400 group-hover:text-blue-500 transition-colors">📅</span>
                      </div>
                    </div>

                    <button type="submit" className={`mt-2 ${glassButtonPrimary} relative z-10`}>예약 정보 클라우드 전송</button>
                  </form>

                  {/* ⭐️ 달력 모듈: 바디 최상단 렌더링. Y축은 모달 최상단에서 살짝 아래(top-10), X축은 아이콘 좌측 정렬(right-20) */}
                  {isDatePickerOpen && (
                    <>
                      <div className="fixed inset-0 z-[900]" onClick={() => setIsDatePickerOpen(false)}></div>
                      <div className="absolute top-10 right-20 z-[1000]">
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
                   <div className="flex justify-between items-center mb-5 md:mb-6 shrink-0 border-b border-white/40 pb-3 md:pb-4">
                     <h3 className="font-extrabold text-base md:text-lg text-slate-800">클라우드 대기열 <span className="text-[10px] md:text-[11px] font-bold text-blue-600 bg-white/60 px-2 py-1 rounded-lg ml-2 border border-white/50 shadow-sm hidden sm:inline-block">창을 닫아도 알아서 동작합니다.</span></h3>
                     <button onClick={() => fetchScheduledTasks(token, communityId)} className={glassButtonSecondary}>새로고침</button>
                   </div>
                   
                   <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
                     {tasks.length === 0 ? (
                       <div className="h-full flex flex-col items-center justify-center text-slate-400">
                         <svg className="w-10 h-10 md:w-12 md:h-12 mb-3 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                         <p className="font-bold text-sm md:text-base">현재 대기 중인 예약 내역이 없습니다.</p>
                       </div>
                     ) : displayedTasks.map(t => (
                       <div key={t.id} className="p-4 md:p-5 bg-white/50 border border-white/60 shadow-sm rounded-2xl flex flex-col sm:flex-row justify-between gap-4 group hover:bg-white/80 transition-all">
                          <div className="flex-1">
                            <div className="font-extrabold text-sm md:text-base text-slate-800 mb-2 truncate max-w-full" title={t.productName}>{t.productName}</div>
                            <div className="flex flex-wrap gap-1.5 md:gap-2 text-[10px] md:text-[11px] font-bold text-slate-500">
                              <span className="bg-white/60 px-2 py-1 rounded-lg border border-white/50 shadow-sm flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>{translateStatus(t.newStatus)}</span>
                              <span className="bg-white/60 px-2 py-1 rounded-lg border border-white/50 shadow-sm">{t.newIsDisplayed ? '진열 표시' : '진열 숨김'}</span>
                              <span className="bg-white/60 px-2 py-1 rounded-lg border border-white/50 shadow-sm text-blue-700">{new Date(t.executeAt).toLocaleString()}</span>
                            </div>
                          </div>
                          <div className="flex gap-2 items-center shrink-0">
                            <button onClick={() => openEditModal(t)} className="px-3 py-1.5 md:px-3.5 md:py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded-xl text-xs font-bold transition-all shadow-sm">수정</button>
                            <button onClick={() => handleDeleteTask(t)} className="px-3 py-1.5 md:px-3.5 md:py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-xs font-bold transition-all shadow-sm">삭제</button>
                          </div>
                       </div>
                     ))}
                   </div>
                </div>
             </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-2xl mx-auto h-full w-full">
              <div className={`${glassPanel} p-6 md:p-8 flex flex-col gap-5 md:gap-6`}>
                <h3 className="text-lg md:text-xl font-extrabold border-b border-white/50 pb-3 md:pb-4 text-slate-800">Connection</h3>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Login Mode</label>
                  <div className="font-extrabold text-blue-600 text-sm bg-white/50 px-4 py-3 rounded-2xl border border-white/60 shadow-sm">{loginMode.toUpperCase()}</div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Community</label>
                  <div className="font-extrabold text-sm bg-white/50 px-4 py-3 rounded-2xl border border-white/60 text-slate-700 shadow-sm">VAKE</div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Active Seller ID</label>
                  <div className="font-mono text-sm bg-white/50 px-4 py-3 rounded-2xl border border-white/60 text-slate-700 shadow-sm truncate">{sellerId || 'N/A'}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* --- 모달들 (예약 확인, 수정) --- */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsConfirmModalOpen(false)}></div>
          <div className="bg-white/90 backdrop-blur-2xl rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl z-10 border border-white/50">
            <h3 className="text-lg md:text-xl font-extrabold mb-4 md:mb-5 border-b border-slate-200/50 pb-2 md:pb-3 text-slate-800">예약을 등록할까요?</h3>
            <div className="space-y-3 md:space-y-4 text-xs md:text-sm bg-white/50 p-4 md:p-5 rounded-2xl border border-white/60 mb-6 md:mb-8 shadow-inner">
              <p className="font-medium text-slate-600 flex justify-between"><b className="text-slate-800 shrink-0">상품명</b> <span className="text-right truncate ml-4 font-bold max-w-[200px]">{products.find(p => p.id === scheduleForm.productId)?.name || scheduleForm.productId}</span></p>
              <p className="font-medium text-slate-600 flex justify-between"><b className="text-slate-800 shrink-0">변경 상태</b> <span className="font-bold">{translateStatus(scheduleForm.status)}</span></p>
              <p className="font-medium text-slate-600 flex justify-between"><b className="text-slate-800 shrink-0">진열 여부</b> <span className="font-bold">{scheduleForm.isDisplayed === 'true' ? '표시' : '숨김'}</span></p>
              <div className="h-px bg-slate-200/50 my-1 md:my-2"></div>
              <p className="text-blue-600 font-extrabold text-sm md:text-base flex flex-col md:flex-row justify-between md:items-center gap-1">
                <span>실행 일시</span>
                <span className="text-right">{new Date(confirmedDateTime).toLocaleString()}</span>
              </p>
            </div>
            <div className="flex justify-end gap-2 md:gap-3">
              <button onClick={() => setIsConfirmModalOpen(false)} className={glassButtonSecondary}>취소</button>
              <button onClick={handleConfirmRegister} className="px-5 py-2 md:px-6 md:py-2.5 text-white bg-blue-600 hover:bg-blue-700 rounded-xl font-bold shadow-md transition-all text-sm md:text-base">전송 승인</button>
            </div>
          </div>
        </div>
      )}

      {editModal.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setEditModal({...editModal, isOpen: false})}></div>
          <div className="bg-white/90 backdrop-blur-2xl rounded-3xl w-full max-w-sm md:max-w-md p-6 md:p-8 shadow-2xl z-10 border border-white/50 relative">
            <h3 className="text-lg md:text-xl font-extrabold mb-4 md:mb-5 border-b border-slate-200/50 pb-2 md:pb-3 text-slate-800">예약 수정</h3>
            
            <div className="space-y-4 md:space-y-5 mb-6 md:mb-8 relative z-20">
              <div className="bg-white/50 p-4 rounded-2xl border border-white/60 shadow-inner relative z-20">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">대상 상품</div>
                <div className="text-sm font-extrabold text-slate-700 truncate">{editModal.task.productName}</div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 relative z-[50]">
                <div className="relative z-[50]">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">상태 변경</label>
                  <GlassSelect value={editModal.status} options={statusOptions} onChange={v => setEditModal({...editModal, status: v})} />
                </div>
                <div className="relative z-[40]">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">진열 변경</label>
                  <GlassSelect value={editModal.isDisplayed} options={displayOptions} onChange={v => setEditModal({...editModal, isDisplayed: v})} />
                </div>
              </div>
              
              <div className="relative z-[40]">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">일시 변경</label>
                <div onClick={() => setEditModal({...editModal, isDatePickerOpen: true})} className="w-full px-4 py-3 bg-white/50 border border-white/60 rounded-2xl text-xs md:text-sm cursor-pointer flex justify-between items-center hover:bg-white/70 transition-all shadow-sm group relative z-[45]">
                  <span className="font-extrabold text-slate-800">{editModal.date && editModal.time ? new Date(`${editModal.date}T${editModal.time}`).toLocaleString('ko-KR') : '시간 설정'}</span>
                  <span className="text-slate-400 group-hover:text-blue-500">📅</span>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 md:gap-3 border-t border-slate-200/50 pt-4 md:pt-5 relative z-10">
              <button onClick={() => setEditModal({...editModal, isOpen: false})} className={glassButtonSecondary}>취소</button>
              <button onClick={handleConfirmEdit} className="px-5 py-2 md:px-6 md:py-2.5 text-white bg-blue-600 hover:bg-blue-700 rounded-xl font-bold shadow-md transition-all text-sm md:text-base">수정 저장</button>
            </div>

            {/* ⭐️ 달력 모듈: 수정 모달에서도 동일하게 Y축은 모달 기준 약간 위쪽(top-12), X축은 우측 여백(right-12) 할당 */}
            {editModal.isDatePickerOpen && (
              <>
                <div className="fixed inset-0 z-[900]" onClick={() => setEditModal({...editModal, isDatePickerOpen: false})}></div>
                <div className="absolute top-12 right-12 z-[1000]">
                  <GlassDateTimePicker 
                    date={editModal.date} 
                    time={editModal.time} 
                    onDateChange={d => setEditModal(prev => ({...prev, date: d}))} 
                    onTimeChange={t => setEditModal(prev => ({...prev, time: t}))} 
                    onConfirm={(d, t) => {
                        const finalDate = d || editModal.date;
                        const finalTime = t || editModal.time;
                        if (!finalDate || !finalTime) return showToast('날짜와 시간을 모두 선택해주세요.', 'error');
                        setEditModal(prev => ({...prev, date: finalDate, time: finalTime, isDatePickerOpen: false}));
                    }}
                    onCancel={() => setEditModal(prev => ({...prev, isDatePickerOpen: false}))} 
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}
      
      {/* 부드러운 페이드 인 효과 추가 */}
      <style dangerouslySetInnerHTML={{__html: `
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
    </div>
  );
}
