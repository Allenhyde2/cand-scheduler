import React, { useState, useEffect } from 'react';

// ⭐️ 시스템 설정값
const DEFAULT_GROUP_ID = 'G0IZUDWCL';
const CLIENT_ID = '4582f19ca0325304d27abbd18a36b21b'; 
const SCHEDULER_API_URL = 'https://2fb8b65g8f.execute-api.ap-southeast-2.amazonaws.com/schedule';

// PKCE 난수 생성 로직
const createCodeVerifier = () => btoa(String.fromCharCode(...new Uint8Array(crypto.getRandomValues(new Uint8Array(32)).buffer)));
const createCodeChallenge = async (verifier) => btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest("SHA-256", (new TextEncoder()).encode(verifier))))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

export default function App() {
  // --- 하이브리드 인증 상태 ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [manualToken, setManualToken] = useState(''); // 수동 입력 or 자동 추출된 토큰이 들어갈 자리
  const [sellerId, setSellerId] = useState(''); 
  const [isLoginProcessing, setIsLoginProcessing] = useState(false);
  
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });

  const showToast = (message, type = 'info') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3500);
  };

  // --- 1. OAuth 콜백 처리 (토큰 자동 추출기) ---
  useEffect(() => {
    const handleOAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const stateParam = urlParams.get('state');

      if (code && stateParam) {
        setIsLoginProcessing(true);
        const savedState = sessionStorage.getItem('oauth_state');
        const codeVerifier = sessionStorage.getItem('oauth_verifier');

        try {
          const redirectUri = `${window.location.origin}/canpass/callback`;
          const tokenApiUrl = `${window.location.origin}/api/token`;

          const res = await fetch(tokenApiUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              client_id: CLIENT_ID,
              code, code_verifier: codeVerifier, redirect_uri: redirectUri
            })
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data.error || '토큰 추출 실패');

          // ✅ 핵심: 발급받은 토큰을 수동 입력창 state에 자동으로 꽂아줍니다!
          setManualToken(data.access_token);
          showToast('토큰이 성공적으로 추출되었습니다. (권한에 따라 403이 뜰 수 있습니다)', 'success');

        } catch (err) {
          showToast(err.message, 'error');
        } finally {
          setIsLoginProcessing(false);
          window.history.replaceState({}, document.title, '/'); // URL 깔끔하게 정리
        }
      }
    };
    handleOAuthCallback();
  }, []);

  // --- 2. CANpass 로그인 페이지로 보내기 ---
  const handleCANpassLogin = async () => {
    const codeVerifier = createCodeVerifier();
    const codeChallenge = await createCodeChallenge(codeVerifier);
    const state = JSON.stringify({ nonce: Math.random().toString(), key: 'cand-admin' });

    sessionStorage.setItem('oauth_verifier', codeVerifier);
    sessionStorage.setItem('oauth_state', state);

    const redirectUri = `${window.location.origin}/canpass/callback`;
    const authUrl = new URL('https://canpass.me/oauth2/authorize');
    
    // 💡 백엔드 확인 전이므로 기존 스코프 그대로 유지
    authUrl.search = new URLSearchParams({
      response_type: 'code', action: 'signin', client_id: CLIENT_ID,
      code_challenge: codeChallenge, code_challenge_method: 'S256',
      redirect_uri: redirectUri, community_id: DEFAULT_GROUP_ID, state,
      scope: 'email poll option vote addresses' 
    }).toString();

    window.location.href = authUrl.toString();
  };

  // --- 3. 토큰을 가지고 시스템 진입 (수동/자동 통합) ---
  const handleEnterSystem = (e) => {
    e.preventDefault();
    if (!manualToken.trim()) return showToast('Bearer 토큰 값을 입력해주세요.', 'error');
    if (!sellerId.trim()) return showToast('Seller ID를 입력해주세요.', 'error');
    
    // 이 시점에서 입력된 토큰을 인증 토큰으로 확정
    setIsAuthenticated(true);
    fetchProducts(manualToken.trim(), sellerId.trim());
  };

  // --- 4. 상품 목록 불러오기 (초기 버전 로직 + 프록시 우회) ---
  const fetchProducts = async (tokenToUse, targetSellerId) => {
    setIsLoading(true);
    try {
      // CORS 우회를 위해 프록시 사용 (필수)
      const url = `${window.location.origin}/api/proxy?endpoint=products&limit=100`;
      
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'content-type': 'application/json',
          'authorization': `Bearer ${tokenToUse}`,
          'x-can-community-id': DEFAULT_GROUP_ID
        }
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        if (res.status === 403) throw new Error("403 Forbidden: 해당 토큰에 상품 조회 권한이 없습니다.");
        throw new Error(data.message || `API 호출 실패 (${res.status})`);
      }
      
      const list = data.data || [];
      // 전체 목록을 받아온 뒤, 프론트엔드에서 입력한 Seller ID로 필터링
      const filtered = list.filter(p => (p.sellerId || p.userId) === targetSellerId);
      
      setProducts(filtered);
      showToast('상품 목록을 성공적으로 불러왔습니다!', 'success');
      
    } catch (err) {
      showToast(err.message, 'error');
      // 에러가 나면 다시 로그인(토큰 입력) 화면으로 튕겨냄
      setIsAuthenticated(false); 
    } finally {
      setIsLoading(false);
    }
  };

  // --- UI 컴포넌트 ---
  const CustomUI = () => (
    toast.visible && (
      <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100]">
        <div className={`px-4 py-3 rounded-lg shadow-lg text-sm font-bold text-white ${toast.type === 'error' ? 'bg-red-600' : 'bg-gray-800'}`}>
          {toast.message}
        </div>
      </div>
    )
  );

  // --- [화면 A] 로그인 & 토큰 입력 화면 ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <CustomUI />
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
          <div className="bg-gray-800 p-8 text-center border-b-4 border-gray-900">
            <h1 className="text-2xl font-bold text-white mb-2">Developer / Admin</h1>
            <p className="text-gray-300 text-sm">시스템 진입을 위해 토큰을 입력하세요.</p>
          </div>
          
          <div className="p-8 space-y-6">
            {/* 1. 자동 토큰 추출 버튼 */}
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
              <p className="text-xs text-blue-700 font-bold mb-2">옵션 1: CANpass 연동 (자동 추출)</p>
              <button 
                onClick={handleCANpassLogin} disabled={isLoginProcessing}
                className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700 transition text-sm"
              >
                {isLoginProcessing ? '토큰 추출 중...' : 'CANpass 로그인으로 토큰 받아오기'}
              </button>
            </div>

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-gray-200"></div>
              <span className="flex-shrink-0 mx-4 text-gray-400 text-xs font-bold">OR</span>
              <div className="flex-grow border-t border-gray-200"></div>
            </div>

            {/* 2. 수동 입력 폼 */}
            <form onSubmit={handleEnterSystem} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">옵션 2: Bearer 토큰 수동 입력</label>
                <textarea 
                  value={manualToken} 
                  onChange={e => setManualToken(e.target.value)} 
                  placeholder="eyJhbGciOiJIUzI1NiIs..." 
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-gray-800 outline-none text-xs font-mono h-24" 
                  required 
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">판매자 ID (필터링 용도)</label>
                <input 
                  type="text" value={sellerId} onChange={e => setSellerId(e.target.value)} 
                  placeholder="CS:P8XLJRM3" className="w-full px-4 py-2 border rounded-lg outline-none" required 
                />
              </div>
              <button type="submit" className="w-full bg-gray-800 text-white font-bold py-3 rounded-lg hover:bg-gray-900 transition">
                시스템 진입 (목록 불러오기)
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // --- [화면 B] 시스템 진입 완료 (상품 목록 화면) ---
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <CustomUI />
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-sm border p-6">
        <div className="flex justify-between items-center mb-6 pb-4 border-b">
          <div>
            <h2 className="text-xl font-bold">상품 목록 (필터링 완료)</h2>
            <p className="text-sm text-gray-500 mt-1">현재 조회된 Seller ID: <span className="font-bold text-blue-600">{sellerId}</span></p>
          </div>
          <button onClick={() => setIsAuthenticated(false)} className="px-4 py-2 bg-gray-100 text-gray-600 text-sm font-bold rounded-lg hover:bg-gray-200">
            토큰 재입력 / 로그아웃
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-10 text-gray-500 font-bold">데이터를 불러오는 중입니다...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b text-gray-600">
                <tr><th className="p-4">상품명</th><th className="p-4">가격</th><th className="p-4">상태</th><th className="p-4">진열여부</th></tr>
              </thead>
              <tbody className="divide-y">
                {products.length === 0 ? (
                  <tr><td colSpan="4" className="p-8 text-center text-gray-400">조회된 상품이 없습니다.</td></tr>
                ) : (
                  products.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="p-4 font-bold">{p.name} <span className="block text-xs font-mono text-gray-400 font-normal">{p.id}</span></td>
                      <td className="p-4">{p.price?.toLocaleString()}</td>
                      <td className="p-4">{p.status}</td>
                      <td className="p-4">{p.isDisplayed ? '표시' : '숨김'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
