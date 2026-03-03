import React, { useState, useEffect } from 'react';

const DEFAULT_GROUP_ID = 'G00O7NKV9M';
const API_BASE_URL = 'https://api.cand.xyz';
// 방금 생성하신 AWS API Gateway(Serverless Scheduler) 주소입니다.
const SCHEDULER_API_URL = 'https://2fb8b65g8f.execute-api.ap-southeast-2.amazonaws.com/schedule';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState('');
  const [communityId, setCommunityId] = useState(DEFAULT_GROUP_ID);

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
    const savedCommunityId = localStorage.getItem('cand_community_id');
    const savedRecentProducts = localStorage.getItem('cand_recent_products');

    if (savedToken) setToken(savedToken);
    if (savedCommunityId) setCommunityId(savedCommunityId);
    if (savedRecentProducts) {
      try {
        setRecentProducts(JSON.parse(savedRecentProducts));
      } catch (e) { }
    }
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    const cleanToken = token.replace(/[^\x20-\x7E]/g, '').trim();
    const cleanCommunityId = communityId.replace(/[^\x20-\x7E]/g, '').trim();

    if (!cleanToken || !cleanCommunityId) {
      showToast('유효한 토큰과 Group ID를 입력해주세요.', 'error');
      return;
    }

    setToken(cleanToken);
    setCommunityId(cleanCommunityId);
    localStorage.setItem('cand_token', cleanToken);
    localStorage.setItem('cand_community_id', cleanCommunityId);

    setIsAuthenticated(true);
    fetchProductsWithArgs(cleanToken, cleanCommunityId);
    fetchScheduledTasks(cleanToken, cleanCommunityId); // 로그인 성공 시 예약 목록 호출
    showToast('시스템에 접속했습니다.', 'success');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setActiveTab('productList');
  };

  // 공통 헤더 생성 함수 (중복 코드 제거)
  const getAuthHeaders = (currentToken, currentCommunityId) => ({
    'content-type': 'application/json',
    'authorization': `Bearer ${currentToken || token}`,
    'x-can-community-id': currentCommunityId || communityId,
  });

  // [리뷰 완료]: CORS 우회를 위해 GET 대신 POST 사용 (action: 'LIST')
  // API Gateway Allow Headers 설정에 맞추어 헤더도 함께 전송합니다.
  const fetchScheduledTasks = async (currentToken, currentCommunityId) => {
    try {
      const res = await fetch(SCHEDULER_API_URL, {
        method: 'POST',
        headers: getAuthHeaders(currentToken, currentCommunityId), // 명시적 헤더 추가
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

      const data = await res.json();
      const fetchedList = data.tasks || data.data || (Array.isArray(data) ? data : []);

      const formattedTasks = fetchedList.map(task => ({
        ...task,
        logs: task.logs || [`☁️ 서버에서 저장된 예약 정보를 불러왔습니다. (${new Date().toLocaleTimeString()})`]
      }));

      setTasks(formattedTasks);
    } catch (err) {
      console.error('예약 목록 조회 실패:', err.message);
      if (err.message.includes('Failed to fetch')) {
        showToast('CORS 오류: API 연동 실패 (네트워크를 확인하세요).', 'error');
      } else {
        showToast(`목록 갱신 실패: ${err.message}`, 'error');
      }
    }
  };

  const fetchProductsWithArgs = async (currentToken, currentCommunityId) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/products?limit=100`, {
        headers: getAuthHeaders(currentToken, currentCommunityId)
      });
      if (!res.ok) throw new Error(`API 오류: ${res.status}`);
      const data = await res.json();
      setProducts(data.data || []);
      showToast('상품 목록을 불러왔습니다.', 'success');
    } catch (err) {
      showToast('목록 로드 실패: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProducts = () => {
    fetchProductsWithArgs(token, communityId);
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
        headers: getAuthHeaders(token, communityId), // 헤더 적용
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
        headers: getAuthHeaders(token, communityId), // 헤더 적용
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
        headers: getAuthHeaders(token, communityId), // 헤더 적용
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

  const CustomUI = () => (
    <div>
      {toast.visible && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100]">
          <div className="px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm font-bold text-white bg-gray-800">
            {toast.message}
          </div>
        </div>
      )}
      {confirmDialog.visible && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-2">확인</h3>
            <p className="text-gray-600 mb-6">{confirmDialog.message}</p>
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
          <form onSubmit={handleLogin} className="p-8 space-y-6">
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg text-xs text-blue-800">
              <p>현재 <b>PRODUCTION</b> 환경입니다. 데이터가 실제 서비스에 반영됩니다.</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Group ID (Community ID)</label>
              <input
                type="text"
                value={communityId}
                onChange={(e) => setCommunityId(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-50 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Bearer Token</label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="CANpass Access Token"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>
            <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700">
              접속하기
            </button>
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
          <div>
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
                        <tr><td colSpan="4" className="p-8 text-center text-gray-500">데이터가 없습니다.</td></tr>
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
                        placeholder="상품명 또는 상품 ID를 입력하세요"
                        value={productSearchTerm}
                        onChange={(e) => {
                          setProductSearchTerm(e.target.value);
                          if (!isProductSelectOpen) setIsProductSelectOpen(true);
                          if (scheduleForm.productId) setScheduleForm({ ...scheduleForm, productId: '' });
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
                        onChange={e => setScheduleForm({ ...scheduleForm, status: e.target.value })}
                      >
                        <option value="scheduled">판매예정</option><option value="onSale">판매중</option><option value="soldOut">품절</option><option value="completed">판매종료</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">3. 진열 여부</label>
                      <select
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none"
                        value={scheduleForm.isDisplayed}
                        onChange={e => setScheduleForm({ ...scheduleForm, isDisplayed: e.target.value })}
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
                            <div><label className="block text-xs font-semibold mb-1">날짜 선택</label><input type="date" value={pickerDate} onChange={e => setPickerDate(e.target.value)} className="w-full border p-2 text-sm rounded" /></div>
                            <div><label className="block text-xs font-semibold mb-1">시간 선택</label><input type="time" value={pickerTime} onChange={e => setPickerTime(e.target.value)} className="w-full border p-2 text-sm rounded" /></div>
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
                  {tasks.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 border-2 border-dashed rounded-xl">이번 세션에서 클라우드에 전송된 예약이 없습니다.</div>
                  ) : (
                    tasks.map(task => (
                      <div key={task.id} className="p-4 border rounded-xl bg-blue-50/30 border-blue-100">
                        <div className="flex justify-between mb-2">
                          <span className="font-bold text-gray-900">{task.productName}</span>
                          <span className="text-xs font-bold px-2 py-1 rounded bg-blue-100 text-blue-700">
                            ☁️ 클라우드 대기중
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 mb-2">
                          상태: <b>{translateStatus(task.newStatus)}</b> | 진열: <b>{task.newIsDisplayed ? '표시' : '숨김'}</b> | 일시: <b>{new Date(task.executeAt).toLocaleString()}</b>
                        </div>
                        {task.logs && task.logs.length > 0 && (
                          <div className="mt-2 p-2 bg-white border border-blue-100 text-xs text-blue-800 rounded max-h-24 overflow-y-auto">
                            {task.logs.map((log, i) => <div key={i} className="mb-0.5">{log}</div>)}
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
                  <label className="block text-gray-500 font-bold mb-1">현재 적용된 Group ID</label>
                  <input type="text" readOnly value={communityId} className="w-full bg-gray-50 border border-gray-200 p-2.5 rounded font-mono text-gray-600" />
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
                  <select value={editModal.status} onChange={e => setEditModal({ ...editModal, status: e.target.value })} className="w-full border p-2.5 text-sm rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="scheduled">판매예정</option><option value="onSale">판매중</option><option value="soldOut">품절</option><option value="completed">판매종료</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">진열 여부</label>
                  <select value={editModal.isDisplayed} onChange={e => setEditModal({ ...editModal, isDisplayed: e.target.value })} className="w-full border p-2.5 text-sm rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="true">진열함 (표시)</option><option value="false">진열안함 (숨김)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">날짜 변경</label>
                  <input type="date" value={editModal.date} onChange={e => setEditModal({ ...editModal, date: e.target.value })} className="w-full border p-2.5 text-sm rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">시간 변경</label>
                  <input type="time" value={editModal.time} onChange={e => setEditModal({ ...editModal, time: e.target.value })} className="w-full border p-2.5 text-sm rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditModal({ ...editModal, isOpen: false })} className="px-4 py-2 bg-gray-200 rounded font-medium text-sm">취소</button>
              <button onClick={handleConfirmEdit} className="px-4 py-2 bg-blue-600 text-white rounded font-bold text-sm shadow-sm hover:bg-blue-700">수정 저장하기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}