import React, { useState, useEffect } from 'react';

// ⭐️ 커뮤니티 아이디 수정됨
const DEFAULT_GROUP_ID = 'G0IZUDWCL';
const API_BASE_URL = 'https://api.cand.xyz'; 
const SCHEDULER_API_URL = 'https://2fb8b65g8f.execute-api.ap-southeast-2.amazonaws.com/schedule';
const CLIENT_ID = '4582f19ca0325304d27abbd18a36b21b'; 

// ⭐️ 스코프 롤백: CANpass 인증 서버는 로그인 단계에서 이 클라이언트 ID에 대해 아래 스코프만 허용하고 있습니다.
// (MOIM 전용 스코프를 섞어 보내면 캔패스 서버가 에러를 뿜어냅니다. 토큰 발급 후 해당 토큰으로 MOIM API를 호출해 보세요!)
const SCOPES = 'email poll option vote addresses';

// 환경 감지
const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// ⭐️ PKCE 난수 생성 로직 수정: CANpass 공식 API 문서의 코드와 완전히 100% 동일하게 맞췄습니다. (400 에러 방지)
const createCodeVerifier = () => btoa(String.fromCharCode(...new Uint8Array(crypto.getRandomValues(new Uint8Array(32)).buffer)));
const createCodeChallenge = async (verifier) => btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest("SHA-256", (new TextEncoder()).encode(verifier))))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

export default function App() {
  // --- 상태 관리 ---
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

  // --- 공통 유틸리티 ---
  const showToast = (message, type = 'info') => {
    setToast({ visible: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 3500);
  };

  const closeConfirm = () => {
    setConfirmDialog({ visible: false, message: '', onConfirm: null });
  };

  const getAuthHeaders = (currentToken, currentCommunityId) => ({
    'content-type': 'application/json',
    'authorization': `Bearer ${currentToken || token}`,
    'x-can-community-id': currentCommunityId || communityId,
  });

  // --- OAuth 및 데이터 페칭 로직 ---

  useEffect(() => {
    const handleOAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const stateParam = urlParams.get('state');
      const error = urlParams.get('error');

      if (error) {
        showToast(`로그인 실패: ${urlParams.get('error_description')}`, 'error');
        window.history.replaceState({}, document.title, '/');
        return;
      }

      if (code && stateParam) {
        setIsLoginProcessing(true);
        const savedState = sessionStorage.getItem('oauth_state');
        const codeVerifier = sessionStorage.getItem('oauth_verifier');
        const savedSellerId = localStorage.getItem('cand_seller_id');

        if (stateParam !== savedState) {
          showToast('비정상적인 접근입니다.', 'error');
          setIsLoginProcessing(false);
          return;
        }

        try {
          const redirectUri = `${window.location.origin}/canpass/callback`;

          // ⭐️ 수정됨: OAuth2 표준에 따라 redirect_uri 파라미터도 함께 전송하여 400 Bad Request를 방지합니다.
          const res = await fetch('https://canpass.me/oauth2/token', {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              grant_type: 'authorization_code',
              client_id: CLIENT_ID,
              code: code,
              code_verifier: codeVerifier,
              redirect_uri: redirectUri
            })
          });

          if (!res.ok) {
             const errData = await res.json();
             throw new Error(errData.error_description || '토큰 발급에 실패했습니다.');
          }

          const data = await res.json();
          const accessToken = data.access_token;
          
          setToken(accessToken);
          setSellerId(savedSellerId || '');
          setIsAuthenticated(true);
          localStorage.setItem('cand_token', accessToken);

          fetchProductsWithArgs(accessToken, DEFAULT_GROUP_ID, savedSellerId);
          fetchScheduledTasks(accessToken, DEFAULT_GROUP_ID);
          showToast('성공적으로 로그인되었습니다.', 'success');

        } catch (err) {
          showToast(err.message, 'error');
        } finally {
          setIsLoginProcessing(false);
          window.history.replaceState({}, document.title, '/');
          sessionStorage.removeItem('oauth_state');
          sessionStorage.removeItem('oauth_verifier');
        }
      } else {
        // 기존 세션 체크
        const savedToken = localStorage.getItem('cand_token');
        const savedSellerId = localStorage.getItem('cand_seller_id');
        if (savedToken && savedSellerId) {
          setToken(savedToken);
          setSellerId(savedSellerId);
          setIsAuthenticated(true);
          fetchProductsWithArgs(savedToken, DEFAULT_GROUP_ID, savedSellerId);
          fetchScheduledTasks(savedToken, DEFAULT_GROUP_ID);
        }
      }
    };

    handleOAuthCallback();
  }, []);

  const handleOAuthLogin = async (e) => {
    e.preventDefault();
    if (!sellerId.trim()) return showToast('판매자 ID를 입력해주세요.', 'error');

    localStorage.setItem('cand_seller_id', sellerId.trim());

    const codeVerifier = createCodeVerifier();
    const codeChallenge = await createCodeChallenge(codeVerifier);
    
    // btoa 방식 대신 간단하고 안전한 난수로 state 생성
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
    localStorage.removeItem('cand_token');
    setIsAuthenticated(false);
    setToken('');
    showToast('로그아웃 되었습니다.');
  };

  // --- API 호출 함수 (상품/태스크) ---

  const fetchProductsWithArgs = async (currentToken, currentCommunityId, currentSellerId) => {
    setIsLoading(true);
    try {
      // Vercel 프록시 또는 직접 호출
      const url = isLocalhost ? '/cand-api/products?limit=100' : `/api/proxy?endpoint=products&limit=100`;
      const res = await fetch(url, {
        headers: getAuthHeaders(currentToken, currentCommunityId)
      });
      if (!res.ok) throw new Error('상품 정보를 가져오지 못했습니다.');
      const result = await res.json();
      const list = result.data || [];
      
      const filtered = list.filter(p => (p.sellerId || p.userId) === currentSellerId);
      setProducts(filtered);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchScheduledTasks = async (currentToken, currentCommunityId) => {
    try {
      const res = await fetch(SCHEDULER_API_URL, {
        method: 'POST',
        headers: getAuthHeaders(currentToken, currentCommunityId), 
        body: JSON.stringify({ action: 'LIST', token: currentToken, communityId: currentCommunityId })
      });
      if (!res.ok) return;
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch (err) {
      console.error(err);
    }
  };

  // --- 비즈니스 로직 ---

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
    showToast('예약을 등록 중입니다...', 'info');
    try {
      const res = await fetch(SCHEDULER_API_URL, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          action: 'CREATE',
          productId: scheduleForm.productId,
          newStatus: scheduleForm.status,
          newIsDisplayed: scheduleForm.isDisplayed === 'true',
          executeAt: new Date(confirmedDateTime).toISOString(),
          token, communityId
        })
      });
      if (!res.ok) throw new Error('등록 실패');
      showToast('예약이 등록되었습니다.', 'success');
      fetchScheduledTasks(token, communityId);
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

  const translateStatus = (s) => {
    const map = { scheduled: '판매예정', onSale: '판매중', soldOut: '품절', completed: '판매종료' };
    return map[s] || s;
  };

  // --- UI 컴포넌트 ---

  const CustomUI = () => (
    <div>
      {toast.visible && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100]">
          <div className="px-4 py-3 rounded-lg shadow-lg text-sm font-bold text-white bg-gray-800">
            {typeof toast.message === 'object' ? JSON.stringify(toast.message) : String(toast.message)}
          </div>
        </div>
      )}
    </div>
  );

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <CustomUI />
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
          <div className="bg-blue-600 p-8 text-center border-b-4 border-blue-700">
            <h1 className="text-2xl font-bold text-white mb-2">canD Admin</h1>
            <p className="text-blue-100 text-sm">서비스 관리를 위해 로그인해주세요.</p>
          </div>
          <form onSubmit={handleOAuthLogin} className="p-8 space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Community ID</label>
              <input type="text" value={communityId} readOnly className="w-full px-4 py-2 border rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed outline-none" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">판매자 ID (Seller ID)</label>
              <input 
                type="text" 
                value={sellerId} 
                onChange={e => setSellerId(e.target.value)} 
                placeholder="ex) CS:P8XLJRM3" 
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                required 
              />
            </div>
            <button 
              type="submit" 
              disabled={isLoginProcessing}
              className="w-full text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              style={{ backgroundColor: '#2563eb' }}
            >
              {isLoginProcessing ? '인증 처리 중...' : 'CANpass로 로그인'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 text-gray-800 overflow-hidden">
      <CustomUI />
      
      {/* 사이드바 */}
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-0 hidden'} bg-white border-r flex flex-col transition-all`}>
        <div className="h-16 border-b flex items-center justify-center font-bold text-xl">
          Admin<span className="text-blue-600">Dash</span>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button onClick={() => setActiveTab('productList')} className={`w-full text-left px-4 py-2 rounded-lg text-sm ${activeTab === 'productList' ? 'bg-blue-50 text-blue-600 font-bold' : 'hover:bg-gray-50'}`}>상품 목록</button>
          <button onClick={() => setActiveTab('schedule')} className={`w-full text-left px-4 py-2 rounded-lg text-sm ${activeTab === 'schedule' ? 'bg-blue-50 text-blue-600 font-bold' : 'hover:bg-gray-50'}`}>상태 예약</button>
          <div className="pt-4 mt-4 border-t">
            <button onClick={() => setActiveTab('settings')} className={`w-full text-left px-4 py-2 rounded-lg text-sm ${activeTab === 'settings' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}>시스템 설정</button>
          </div>
          <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-500 mt-8">로그아웃</button>
        </nav>
      </aside>

      {/* 메인 콘텐츠 */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-xl">≡</button>
            <h2 className="font-bold">
              {activeTab === 'productList' && '판매 상품 현황'}
              {activeTab === 'schedule' && '상태 변경 예약'}
              {activeTab === 'settings' && '시스템 설정'}
            </h2>
          </div>
          <div className="flex gap-2">
            <span className="bg-gray-100 text-gray-600 text-xs font-bold px-3 py-1 rounded border">Seller: {sellerId}</span>
            <span className="bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1 rounded border border-blue-100">PRODUCTION</span>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'productList' && (
            <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-sm border p-6">
              <div className="flex justify-between mb-6">
                <h3 className="font-semibold">상품 목록</h3>
                <button onClick={() => fetchProductsWithArgs(token, communityId, sellerId)} className="text-sm px-4 py-1.5 bg-gray-100 rounded-lg hover:bg-gray-200">새로고침</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 border-b text-gray-500 uppercase text-xs">
                    <tr><th className="p-4">상품명</th><th className="p-4">상태</th><th className="p-4">진열</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {products.length === 0 ? <tr><td colSpan="3" className="p-8 text-center text-gray-400">조회된 상품이 없습니다.</td></tr> : 
                      products.map(p => (
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="p-4"><b>{p.name}</b><div className="text-xs text-gray-400 font-mono">{p.id}</div></td>
                          <td className="p-4"><span className={`px-2 py-1 rounded-full text-xs font-bold ${p.status === 'onSale' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{translateStatus(p.status)}</span></td>
                          <td className="p-4">{p.isDisplayed ? '진열중' : '숨김'}</td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'schedule' && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-t-4 border-t-blue-600 p-6">
                <h3 className="font-semibold mb-6">새 예약 등록</h3>
                <form onSubmit={handlePreSubmit} className="space-y-4">
                  <div className="relative">
                    <label className="block text-sm font-semibold mb-1">1. 상품 검색</label>
                    <input type="text" value={productSearchTerm} onChange={e => {setProductSearchTerm(e.target.value); setIsProductSelectOpen(true);}} placeholder="상품명 입력..." className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                    {isProductSelectOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border rounded-lg shadow-xl z-20 max-h-48 overflow-y-auto">
                        {products.filter(p => p.name.includes(productSearchTerm)).map(p => (
                          <button key={p.id} type="button" onClick={() => handleSelectProduct(p)} className="w-full text-left p-3 text-sm hover:bg-blue-50 border-b last:border-0">
                            <b>{p.name}</b> <span className="text-xs text-gray-400 ml-2">{p.id}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold mb-1">2. 변경 상태</label>
                      <select value={scheduleForm.status} onChange={e => setScheduleForm({...scheduleForm, status: e.target.value})} className="w-full p-2 border rounded-lg outline-none">
                        <option value="onSale">판매중</option><option value="soldOut">품절</option><option value="scheduled">판매예정</option><option value="completed">판매종료</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">3. 진열 여부</label>
                      <select value={scheduleForm.isDisplayed} onChange={e => setScheduleForm({...scheduleForm, isDisplayed: e.target.value})} className="w-full p-2 border rounded-lg outline-none">
                        <option value="true">진열함</option><option value="false">숨김</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">4. 실행 일시</label>
                    <div onClick={openDatePicker} className="w-full p-2 border rounded-lg cursor-pointer bg-gray-50">{confirmedDateTime ? new Date(confirmedDateTime).toLocaleString() : '클릭하여 선택...'}</div>
                    {isDatePickerOpen && (
                      <div className="mt-2 p-4 border rounded-lg bg-white shadow-inner flex flex-col gap-3">
                        <div className="flex gap-2">
                          <input type="date" value={pickerDate} onChange={e => setPickerDate(e.target.value)} className="flex-1 p-2 border rounded"/>
                          <input type="time" value={pickerTime} onChange={e => setPickerTime(e.target.value)} className="flex-1 p-2 border rounded"/>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => setIsDatePickerOpen(false)} className="text-sm px-3 py-1 bg-gray-100 rounded">취소</button>
                          <button type="button" onClick={handleConfirmDatePicker} className="text-sm px-3 py-1 bg-blue-600 text-white rounded font-bold">확정</button>
                        </div>
                      </div>
                    )}
                  </div>
                  <button type="submit" className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition">예약 전송하기</button>
                </form>
              </div>

              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="font-bold mb-4">현재 대기 중인 예약</h3>
                <div className="space-y-3">
                  {tasks.length === 0 ? <div className="text-center py-10 text-gray-400 border-2 border-dashed rounded-xl">예약된 내역이 없습니다.</div> : 
                    tasks.map(t => (
                      <div key={t.id} className="p-4 border rounded-xl bg-blue-50 border-blue-100 flex justify-between items-center">
                        <div>
                          <div className="font-bold">{t.productName || t.productId}</div>
                          <div className="text-xs text-gray-500">{translateStatus(t.newStatus)} | {t.newIsDisplayed?'진열':'숨김'} | <b>{new Date(t.executeAt).toLocaleString()}</b></div>
                        </div>
                        <button className="text-xs font-bold text-red-500 px-3 py-1 bg-white border border-red-100 rounded shadow-sm">취소</button>
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border p-8 space-y-6">
              <h3 className="font-bold text-lg">시스템 설정</h3>
              <div className="space-y-4 text-sm font-mono">
                <div><label className="text-gray-400 block text-xs mb-1">API ENDPOINT</label><div className="p-2 bg-gray-50 rounded border">{API_BASE_URL}</div></div>
                <div><label className="text-gray-400 block text-xs mb-1">SCHEDULER ENDPOINT</label><div className="p-2 bg-blue-50 rounded border border-blue-100 text-blue-700">{SCHEDULER_API_URL}</div></div>
                <div><label className="text-gray-400 block text-xs mb-1">CLIENT ID</label><div className="p-2 bg-gray-50 rounded border">{CLIENT_ID}</div></div>
                <div><label className="text-gray-400 block text-xs mb-1">SCOPES</label><div className="p-2 bg-gray-50 rounded border text-xs">{SCOPES}</div></div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* 컨펌 모달 */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4 text-blue-600">예약을 등록할까요?</h3>
            <div className="bg-gray-50 p-4 rounded-lg mb-6 text-sm space-y-1">
              <p><b>상품:</b> {products.find(p => p.id === scheduleForm.productId)?.name}</p>
              <p><b>시간:</b> {new Date(confirmedDateTime).toLocaleString()}</p>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsConfirmModalOpen(false)} className="px-4 py-2 bg-gray-100 rounded-lg font-medium">취소</button>
              <button onClick={handleConfirmRegister} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold">등록 확정</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
