import React, { useState, useEffect } from 'react';

const BACKEND_API_URL = 'https://cand-scheduler.vercel.app';
const DEFAULT_GROUP_ID = 'G0IZUDWCL';

// JWT payload 디코딩 (서명 검증 없이 payload만 읽기)
const decodeJwtPayload = (token) => {
  try {
    const cleaned = token.trim().replace(/^Bearer\s+/i, '');
    const parts = cleaned.split('.');
    if (parts.length !== 3) return { error: 'JWT 형식이 아닙니다 (3파트 아님)', raw: cleaned.substring(0, 50) + '...' };
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch (e) {
    return { error: `디코딩 실패: ${e.message}` };
  }
};

export default function DebugTokenTest() {
  const [token, setToken] = useState('');
  const [communityId, setCommunityId] = useState(DEFAULT_GROUP_ID);
  const [sellerId, setSellerId] = useState('');
  const [products, setProducts] = useState([]);
  const [log, setLog] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [decodedToken, setDecodedToken] = useState(null);
  const [canpassToken, setCanpassToken] = useState(null);
  const [fullTokenResponse, setFullTokenResponse] = useState(null);

  // 로컬스토리지에서 CANpass 토큰 및 전체 응답 자동 로드
  useEffect(() => {
    const saved = localStorage.getItem('cand_token');
    if (saved) {
      const decoded = decodeJwtPayload(saved);
      setCanpassToken({ raw: saved, decoded });
    }
    const fullResp = localStorage.getItem('cand_token_full_response');
    if (fullResp) {
      try { setFullTokenResponse(JSON.parse(fullResp)); } catch(e) {}
    }
  }, []);

  const addLog = (msg, type = 'info') => {
    setLog(prev => [{ msg, type, time: new Date().toLocaleTimeString() }, ...prev]);
  };

  const handleTokenChange = (val) => {
    setToken(val);
    if (val.trim()) {
      setDecodedToken(decodeJwtPayload(val));
    } else {
      setDecodedToken(null);
    }
  };

  const getHeaders = () => {
    const h = {
      'content-type': 'application/json',
      'authorization': `Bearer ${token.trim().replace(/^Bearer\s+/i, '')}`,
      'x-can-community-id': communityId.trim(),
    };
    if (sellerId.trim()) h['x-can-profile-id'] = sellerId.trim();
    return h;
  };

  const doFetchProducts = async (useToken, label) => {
    setIsLoading(true);
    const params = new URLSearchParams({ endpoint: 'products', limit: '100', order: 'DESC' });
    if (sellerId.trim()) params.append('sellerId', sellerId.trim());
    const url = `${BACKEND_API_URL}/api/proxy?${params.toString()}`;
    addLog(`[${label}] GET /products 요청 (community: ${communityId})`);
    addLog(`요청 URL: ${url}`);
    try {
      const headers = {
        'content-type': 'application/json',
        'authorization': `Bearer ${useToken.trim().replace(/^Bearer\s+/i, '')}`,
        'x-can-community-id': communityId.trim(),
      };
      if (sellerId.trim()) headers['x-can-profile-id'] = sellerId.trim();
      const res = await fetch(url, { method: 'GET', headers });
      const data = await res.json();
      if (!res.ok) {
        addLog(`[${label}] GET 실패: ${res.status} — ${JSON.stringify(data)}`, 'error');
        return;
      }
      const list = data.data || [];
      setProducts(list);
      addLog(`[${label}] GET 성공: ${list.length}개 상품 조회`, 'success');
    } catch (err) {
      addLog(`[${label}] GET 에러: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProducts = async () => {
    if (!token.trim()) { addLog('토큰을 입력하세요.', 'error'); return; }
    await doFetchProducts(token, '수동 토큰');
  };

  const fetchProductsWithCanpass = async () => {
    if (!canpassToken?.raw) { addLog('CANpass 토큰이 없습니다. 먼저 CANpass로 로그인하세요.', 'error'); return; }
    await doFetchProducts(canpassToken.raw, 'CANpass');
  };

  const testPut = async (product) => {
    const newDisplayed = !product.isDisplayed;
    addLog(`PUT /products/${product.id} 요청 시작 (isDisplayed: ${product.isDisplayed} → ${newDisplayed})`);
    try {
      const endpointPath = `products/${encodeURIComponent(product.id)}`;
      const res = await fetch(`${BACKEND_API_URL}/api/proxy?endpoint=${endpointPath}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ isDisplayed: newDisplayed })
      });
      const data = await res.json();
      if (!res.ok) {
        addLog(`PUT 실패: ${res.status} — ${JSON.stringify(data)}`, 'error');
      } else {
        addLog(`PUT 성공: ${product.name} → isDisplayed=${newDisplayed}`, 'success');
        setProducts(prev => prev.map(p => p.id === product.id ? { ...p, isDisplayed: newDisplayed } : p));
      }
    } catch (err) {
      addLog(`PUT 에러: ${err.message}`, 'error');
    }
  };

  // CANpass 토큰으로 PUT 테스트
  const testPutWithCanpass = async (product) => {
    if (!canpassToken?.raw) { addLog('CANpass 토큰이 없습니다. 먼저 CANpass로 로그인하세요.', 'error'); return; }
    const newDisplayed = !product.isDisplayed;
    addLog(`[CANpass 토큰] PUT /products/${product.id} 시작 (isDisplayed: ${product.isDisplayed} → ${newDisplayed})`);
    try {
      const endpointPath = `products/${encodeURIComponent(product.id)}`;
      const canpassHeaders = {
        'content-type': 'application/json',
        'authorization': `Bearer ${canpassToken.raw.trim().replace(/^Bearer\s+/i, '')}`,
        'x-can-community-id': communityId.trim(),
      };
      if (sellerId.trim()) canpassHeaders['x-can-profile-id'] = sellerId.trim();

      const res = await fetch(`${BACKEND_API_URL}/api/proxy?endpoint=${endpointPath}`, {
        method: 'PUT',
        headers: canpassHeaders,
        body: JSON.stringify({ isDisplayed: newDisplayed })
      });
      const data = await res.json();
      if (!res.ok) {
        addLog(`[CANpass] PUT 실패: ${res.status} — ${JSON.stringify(data)}`, 'error');
      } else {
        addLog(`[CANpass] PUT 성공: ${product.name} → isDisplayed=${newDisplayed}`, 'success');
        setProducts(prev => prev.map(p => p.id === product.id ? { ...p, isDisplayed: newDisplayed } : p));
      }
    } catch (err) {
      addLog(`[CANpass] PUT 에러: ${err.message}`, 'error');
    }
  };

  const renderDecoded = (decoded, label) => {
    if (!decoded) return null;
    const communityFields = ['communityId', 'community_id', 'cid', 'aud', 'group', 'groupId', 'group_id'];
    const foundCommunity = communityFields.find(f => decoded[f]);
    return (
      <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#166534' }}>{label}</h4>
        {foundCommunity && (
          <div style={{ background: '#dcfce7', padding: 8, borderRadius: 6, marginBottom: 8, fontSize: 12 }}>
            <b>Community 필드 발견:</b> <code>{foundCommunity}</code> = <code style={{ color: '#dc2626' }}>{JSON.stringify(decoded[foundCommunity])}</code>
          </div>
        )}
        {!foundCommunity && !decoded.error && (
          <div style={{ background: '#fef9c3', padding: 8, borderRadius: 6, marginBottom: 8, fontSize: 12, color: '#854d0e' }}>
            community 관련 필드를 찾지 못했습니다. 전체 payload를 확인하세요.
          </div>
        )}
        <pre style={{ background: '#1e293b', color: '#e2e8f0', padding: 12, borderRadius: 6, fontSize: 11, overflow: 'auto', maxHeight: 200, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {JSON.stringify(decoded, null, 2)}
        </pre>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 900, margin: '40px auto', padding: 20, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: 8, padding: 16, marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 20, color: '#92400e' }}>Token Debug & Compare</h1>
        <p style={{ margin: '8px 0 0', fontSize: 13, color: '#a16207' }}>
          수동 토큰과 CANpass 토큰의 JWT payload를 비교하고 PUT 요청을 테스트합니다.
        </p>
      </div>

      {/* CANpass 토큰 자동 감지 */}
      <div style={{ background: canpassToken ? '#eff6ff' : '#fef2f2', border: `1px solid ${canpassToken ? '#93c5fd' : '#fca5a5'}`, borderRadius: 8, padding: 16, marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 14, color: canpassToken ? '#1e40af' : '#991b1b' }}>
          {canpassToken ? '저장된 CANpass 토큰 감지됨' : 'CANpass 토큰 없음 (로그인 필요)'}
        </h3>
        {canpassToken && (
          <>
            <div style={{ fontSize: 11, color: '#6b7280', fontFamily: 'monospace', wordBreak: 'break-all', marginBottom: 12 }}>
              {canpassToken.raw.substring(0, 60)}...
            </div>
            {renderDecoded(canpassToken.decoded, 'CANpass OAuth 토큰 Payload')}
          </>
        )}
        {fullTokenResponse && (
          <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 8, padding: 12, marginTop: 12 }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#854d0e' }}>CANpass /oauth2/token 전체 응답 (모든 키)</h4>
            <div style={{ fontSize: 12, marginBottom: 8 }}>
              <b>응답 키:</b> <code style={{ color: '#dc2626' }}>{Object.keys(fullTokenResponse).join(', ')}</code>
            </div>
            <pre style={{ background: '#1e293b', color: '#e2e8f0', padding: 12, borderRadius: 6, fontSize: 11, overflow: 'auto', maxHeight: 250, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {JSON.stringify(fullTokenResponse, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* 수동 토큰 입력 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#6b7280' }}>수동 Bearer Token (브라우저에서 복사)</label>
          <input type="text" value={token} onChange={e => handleTokenChange(e.target.value)}
            placeholder="eyJ... 또는 Bearer eyJ..."
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, fontFamily: 'monospace', boxSizing: 'border-box' }} />
        </div>
        {renderDecoded(decodedToken, '수동 입력 토큰 Payload')}

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#6b7280' }}>Community ID</label>
            <input type="text" value={communityId} onChange={e => setCommunityId(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, fontFamily: 'monospace', boxSizing: 'border-box' }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#6b7280' }}>Seller ID (선택)</label>
            <input type="text" value={sellerId} onChange={e => setSellerId(e.target.value)}
              placeholder="비워두면 전체 조회"
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, fontFamily: 'monospace', boxSizing: 'border-box' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={fetchProducts} disabled={isLoading}
            style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 14, flex: 1 }}>
            {isLoading ? '조회 중...' : '상품 조회 (GET) — 수동 토큰'}
          </button>
          <button onClick={fetchProductsWithCanpass} disabled={isLoading || !canpassToken}
            style={{ padding: '10px 20px', background: canpassToken ? '#7c3aed' : '#9ca3af', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: canpassToken ? 'pointer' : 'not-allowed', fontSize: 14, flex: 1 }}>
            {isLoading ? '조회 중...' : 'CANpass 토큰으로 조회'}
          </button>
        </div>
      </div>

      {products.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, marginBottom: 8 }}>상품 목록 ({products.length}개)</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f3f4f6' }}>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>상품명</th>
                <th style={{ padding: 8, textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>상태</th>
                <th style={{ padding: 8, textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>진열</th>
                <th style={{ padding: 8, textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>수동 토큰 PUT</th>
                <th style={{ padding: 8, textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>CANpass PUT</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: 8 }}>
                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: 10, color: '#9ca3af', fontFamily: 'monospace' }}>{p.id}</div>
                  </td>
                  <td style={{ padding: 8, textAlign: 'center' }}>{p.status}</td>
                  <td style={{ padding: 8, textAlign: 'center' }}>{p.isDisplayed ? '진열중' : '숨김'}</td>
                  <td style={{ padding: 8, textAlign: 'center' }}>
                    <button onClick={() => testPut(p)}
                      style={{ padding: '4px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      수동 PUT
                    </button>
                  </td>
                  <td style={{ padding: 8, textAlign: 'center' }}>
                    <button onClick={() => testPutWithCanpass(p)} disabled={!canpassToken}
                      style={{ padding: '4px 12px', background: canpassToken ? '#7c3aed' : '#9ca3af', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: canpassToken ? 'pointer' : 'not-allowed' }}>
                      CANpass PUT
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div>
        <h3 style={{ fontSize: 14, marginBottom: 8 }}>요청 로그</h3>
        <div style={{ background: '#1e293b', color: '#e2e8f0', borderRadius: 8, padding: 12, maxHeight: 300, overflowY: 'auto', fontSize: 12, fontFamily: 'monospace' }}>
          {log.length === 0 ? (
            <div style={{ color: '#64748b' }}>아직 요청이 없습니다.</div>
          ) : (
            log.map((l, i) => (
              <div key={i} style={{ padding: '4px 0', borderBottom: '1px solid #334155', color: l.type === 'error' ? '#f87171' : l.type === 'success' ? '#4ade80' : '#93c5fd' }}>
                <span style={{ color: '#64748b' }}>[{l.time}]</span> {l.msg}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
