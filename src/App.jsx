import React, { useState, useEffect } from 'react';

const DEFAULT_GROUP_ID = 'G0IZUDWCL';
const API_BASE_URL = 'https://api.cand.xyz'; 
const SCHEDULER_API_URL = 'https://2fb8b65g8f.execute-api.ap-southeast-2.amazonaws.com/schedule';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState('');
  const [communityId] = useState(DEFAULT_GROUP_ID); // 그룹 ID는 상수로 고정
  const [sellerId, setSellerId] = useState(''); // 판매자 ID 상태 추가
  
  const [activeTab, setActiveTab] = useState('productList'); 
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' }); 
  const [confirmDialog, setConfirmDialog] = useState({ visible: false, message: '', onConfirm: null });

  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
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

  useEffect(() => {
    const savedToken = localStorage.getItem('cand_token');
    const savedSellerId = localStorage.getItem('cand_seller_id');
    const savedRecentProducts = localStorage.getItem('cand_recent_products');
    
    if (savedToken) setToken(savedToken);
    if (savedSellerId) setSellerId(savedSellerId);
    if (savedRecentProducts) {
      try {
        setRecentProducts(JSON.parse(savedRecentProducts));
      } catch(e) {}
    }
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    const cleanToken = token.trim();
    const cleanSellerId = sellerId.trim();

    if (!cleanToken || !cleanSellerId) {
      showToast('토큰과 판매자 ID를 모두 입력해주세요.', 'error');
      return;
    }
    
    setToken(cleanToken);
    setSellerId(cleanSellerId);
    localStorage.setItem('cand_token', cleanToken);
    localStorage.setItem('cand_seller_id', cleanSellerId);
    
    setIsAuthenticated(true);
    // 로그인 시 현재의 ID 정보를 명시적으로 넘겨줍니다.
    fetchProductsWithArgs(cleanToken, communityId, cleanSellerId);
    fetchScheduledTasks(cleanToken, communityId); 
    showToast('시스템에 접속했습니다.', 'success');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setActiveTab('productList');
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

  // API 호출 방식은 기존과 100% 동일하게 유지하고 프론트엔드 단에서만 필터링합니다.
  const fetchProductsWithArgs = async (currentToken, currentCommunityId, currentSellerId) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/products?limit=100`, {
        headers: getAuthHeaders(currentToken, currentCommunityId)
      });
      if (!res.ok) throw new Error(`API 오류: ${res.status}`);
      const data = await res.json();
      
      // 1. 데이터 구조 안전장치 (data.data, data.items 등 다양한 API 응답 형태 지원)
      const allProducts = Array.isArray(data) ? data : 
                          (Array.isArray(data?.data) ? data.data : 
                          (Array.isArray(data?.items) ? data.items : []));
      
      // ⭐️ 디버깅을 위해 콘솔에 실제 서버에서 받은 원본 데이터를 출력합니다.
      console.log("📦 서버에서 받은 전체 상품 목록:", allProducts);

      // ID는 대소문자를 구분할 수 있으므로, toLowerCase() 없이 공백만 제거하여 엄격하게 비교합니다.
      const targetSellerId = String(currentSellerId || sellerId).trim();

      // 2. [프론트엔드 필터링] 받아온 전체 데이터 중 해당 판매자의 상품만 걸러냅니다.
      const myProducts = allProducts.filter(p => {
        // 제공해주신 API 문서 구조에 맞게 sellerId를 우선적으로 매칭합니다.
        const pSellerId = String(p.sellerId || p.userId || '').trim(); 
        return pSellerId === targetSellerId;
      });

      // 만약 전체 상품은 있는데 내 상품으로 걸러진 게 0개라면 경고를 띄웁니다.
      if (allProducts.length > 0 && myProducts.length === 0) {
        console.warn(`⚠️ 필터링 결과 0건입니다. 입력한 아이디: "${targetSellerId}"`);
        console.warn(`참고용 첫번째 상품의 sellerId: "${allProducts[0]?.sellerId}"`);
      }

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

  // [프론트엔드 필터링] 예약 목록 중에서, 현재 내 상품 목록(products)에 매칭되는 것들만 화면에 노출합니다. (문자열 강제 변환으로 에러 방지)
  const displayedTasks = tasks.filter(task => products.some(p => String(p.id) === String(task.productId)));

  const CustomUI = () => (
    <div>
      {toast.visible && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100]">
          <div className="px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm font-bold text-white bg-gray-800">{toast.message}</div>
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
          <form onSubmit={handleLogin} className="p-8 space-y-6">
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
                placeholder="ex) user123" 
                className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" 
                required 
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Bearer Token</label>
              <input 
                type="password" 
                value={token} 
                onChange={e => setToken(e.target.value)} 
                placeholder="Access Token" 
                className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" 
                required 
              />
            </div>
            <button type="submit" className="w-full backgroundColor:'#2563eb' bg-blue-600 text-blue font-bold py-3 rounded-lg hover:bg-blue-700">접속하기</button>
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
          <span className="text-xl font-bold">Admin<span className="text-blue-600">Dash</span></span>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-1">
          <button onClick={() => setActiveTab('productList')} className={`w-full text-left px-4 py-2.5 rounded-lg text-sm ${activeTab === 'productList' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}>상품 목록</button>
          <button onClick={() => setActiveTab('schedule')} className={`w-full text-left px-4 py-2.5 rounded-lg text-sm ${activeTab === 'schedule' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}>상태 예약</button>
          
          <div className="mt-8 border-t pt-4">
             <button onClick={() => setActiveTab('settings')} className={`w-full text-left px-4 py-2.5 rounded-lg text-sm ${activeTab === 'settings' ? 'bg-gray-100 text-gray-900 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}>설정 정보</button>
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
            <span className="bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1 rounded-md border border-blue-200">PRODUCTION</span>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'productList' && (
            <div className="max-w-6xl mx-auto bg-white p-6 rounded-xl shadow-sm border">
              <div className="flex justify-between mb-6">
                <h3 className="text-lg font-semibold">나의 상품 현황</h3>
                <button onClick={fetchProducts} disabled={isLoading} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">새로고침</button>
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
                          <td className="p-4 text-center"><span className={`px-2 py-1 rounded-full text-xs font-bold ${p.status === 'onSale' ? 'bg-green-100 text-green-700' : 'bg-gray-100'}`}>{translateStatus(p.status)}</span></td>
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
                          <button key={p.id} type="button" onClick={() => handleSelectProduct(p)} className="w-full text-left p-3 hover:bg-blue-50 text-sm border-b last:border-0">
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
                        <div className="flex justify-end gap-2"><button type="button" onClick={() => setIsDatePickerOpen(false)} className="text-sm px-3 py-1 bg-gray-100 rounded">취소</button><button type="button" onClick={handleConfirmDatePicker} className="text-sm px-3 py-1 bg-blue-600 text-blue rounded font-bold">확정</button></div>
                      </div>
                    )}
                  </div>
                  <button type="submit" className="w-full py-3 bg-blue-600 text-blue font-bold rounded-lg hover:bg-blue-700">예약 전송하기</button>
                </form>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border">
                <div className="flex justify-between mb-4"><h3 className="text-lg font-bold">나의 진행 중인 예약</h3><button onClick={() => fetchScheduledTasks(token, communityId)} className="text-xs text-blue-600 font-bold">목록 갱신</button></div>
                <div className="space-y-4">
                  {/* 프론트엔드에서 필터링된 배열(displayedTasks)을 사용합니다. */}
                  {displayedTasks.length === 0 ? <div className="text-center py-10 text-gray-400 border-2 border-dashed rounded-xl text-sm">대기 중인 나의 예약이 없습니다.</div> : (
                    displayedTasks.map(t => (
                      <div key={t.id} className="p-4 border rounded-xl bg-blue-50/20 border-blue-100 flex justify-between items-start">
                        <div>
                          <div className="font-bold mb-1">{t.productName || t.productId}</div>
                          <div className="text-xs text-gray-500">
                            {translateStatus(t.newStatus)} | {t.newIsDisplayed?'진열':'숨김'} | <b>{new Date(t.executeAt).toLocaleString()}</b>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => openEditModal(t)} className="px-2 py-1 bg-white border text-xs font-bold rounded shadow-sm">수정</button>
                          <button onClick={() => handleDeleteTask(t)} className="px-2 py-1 bg-white border border-red-100 text-red-500 text-xs font-bold rounded shadow-sm">삭제</button>
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
                   <input type="text" readOnly value={SCHEDULER_API_URL} className="w-full bg-blue-50 border border-blue-200 p-2.5 rounded text-blue-900 font-mono font-bold outline-none" />
                 </div>
                 <div className="pt-4 border-t border-gray-100">
                   <label className="block text-gray-500 font-bold mb-1">현재 접속 그룹 ID</label>
                   <input type="text" readOnly value={communityId} className="w-full bg-gray-50 border border-gray-200 p-2.5 rounded font-mono text-gray-600 outline-none" />
                 </div>
                 <div className="pt-4 border-t border-gray-100">
                   <label className="block text-gray-500 font-bold mb-1">현재 접속 판매자 ID</label>
                   <input type="text" readOnly value={sellerId} className="w-full bg-gray-50 border border-gray-200 p-2.5 rounded font-mono text-gray-600 outline-none" />
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
            <div className="flex justify-end gap-2"><button onClick={() => setIsConfirmModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded-lg">취소</button><button onClick={handleConfirmRegister} className="px-4 py-2 bg-blue-600 text-blue font-bold rounded-lg">등록 확정</button></div>
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
              <div className="flex gap-2"><input type="date" value={editModal.date} onChange={e => setEditModal({...editModal, date: e.target.value})} className="flex-1 p-2 border rounded outline-none focus:ring-2 focus:ring-blue-500"/><input type="time" value={editModal.time} onChange={e => setEditModal({...editModal, time: e.target.value})} className="flex-1 p-2 border rounded outline-none focus:ring-2 focus:ring-blue-500"/></div>
            </div>
            <div className="flex justify-end gap-2"><button onClick={() => setEditModal({...editModal, isOpen: false})} className="px-4 py-2 bg-gray-200 rounded-lg">취소</button><button onClick={handleConfirmEdit} className="px-4 py-2 bg-blue-600 text-blue font-bold rounded-lg">수정 저장</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
