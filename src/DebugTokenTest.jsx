import React, { useState } from 'react';

const BACKEND_API_URL = 'https://cand-scheduler.vercel.app';
const DEFAULT_GROUP_ID = 'G0IZUDWCL';

export default function DebugTokenTest() {
  const [token, setToken] = useState('');
  const [communityId, setCommunityId] = useState(DEFAULT_GROUP_ID);
  const [sellerId, setSellerId] = useState('');
  const [products, setProducts] = useState([]);
  const [log, setLog] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const addLog = (msg, type = 'info') => {
    setLog(prev => [{ msg, type, time: new Date().toLocaleTimeString() }, ...prev]);
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

  const fetchProducts = async () => {
    if (!token.trim()) { addLog('토큰을 입력하세요.', 'error'); return; }
    setIsLoading(true);
    addLog(`GET /products 요청 시작 (community: ${communityId})`);
    try {
      const params = new URLSearchParams({ endpoint: 'products', limit: '10', order: 'DESC' });
      if (sellerId.trim()) params.append('sellerId', sellerId.trim());
      const res = await fetch(`${BACKEND_API_URL}/api/proxy?${params.toString()}`, {
        method: 'GET', headers: getHeaders()
      });
      const data = await res.json();
      if (!res.ok) {
        addLog(`GET 실패: ${res.status} — ${JSON.stringify(data)}`, 'error');
        return;
      }
      const list = data.data || [];
      setProducts(list);
      addLog(`GET 성공: ${list.length}개 상품 조회`, 'success');
    } catch (err) {
      addLog(`GET 에러: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
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

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: 20, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: 8, padding: 16, marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 20, color: '#92400e' }}>수동 토큰 테스트 (디버그)</h1>
        <p style={{ margin: '8px 0 0', fontSize: 13, color: '#a16207' }}>
          모임(Moim) 세션 토큰을 직접 입력하여 PUT 요청을 테스트합니다. 테스트 완료 후 이 페이지는 삭제됩니다.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#6b7280' }}>Bearer Token</label>
          <input type="text" value={token} onChange={e => setToken(e.target.value)}
            placeholder="eyJ... 또는 Bearer eyJ..."
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, fontFamily: 'monospace', boxSizing: 'border-box' }} />
        </div>
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
        <button onClick={fetchProducts} disabled={isLoading}
          style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
          {isLoading ? '조회 중...' : '상품 조회 (GET)'}
        </button>
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
                <th style={{ padding: 8, textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>PUT 테스트</th>
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
                      style={{ padding: '4px 12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      진열 토글 (PUT)
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
