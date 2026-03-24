# Phase 3: 상품 상세 편집 (옵션/가격/재고) 구현 계획서

## 목적
현재 상품 수정 모달에서 이름/가격/재고/상태/진열만 변경 가능하지만, 상품 옵션(variants)별 가격/재고 편집 기능을 추가한다.

---

## 사전 작업: API 응답 구조 확인 (필수)

### 1. 개별 상품 상세 조회
```bash
curl -X GET "https://api.cand.xyz/products/CP:4IJLUA8N03CHF" \
  -H "Authorization: Bearer {토큰}" \
  -H "x-can-community-id: G0IZUDWCL" \
  -H "Content-Type: application/json"
```
**확인할 것:** `productVariants` 또는 `options` 필드의 구조, 각 옵션의 `id`, `title`, `price`, `stockCount`, `values` 등

### 2. 옵션 수정 API 테스트
```bash
curl -X PUT "https://api.cand.xyz/products/CP:4IJLUA8N03CHF/product_variants" \
  -H "Authorization: Bearer {토큰}" \
  -H "x-can-community-id: G0IZUDWCL" \
  -H "Content-Type: application/json" \
  -d '{ ... 위 GET에서 받은 variants 구조를 수정하여 전송 ... }'
```
**확인할 것:** 요청 body 스키마, 필수/선택 필드, 에러 응답 형태

### 3. 프록시 경유 테스트
```bash
curl -X GET "https://cand-scheduler.vercel.app/api/proxy?endpoint=products/CP:4IJLUA8N03CHF" \
  -H "Authorization: Bearer {토큰}" \
  -H "x-can-community-id: G0IZUDWCL"
```

---

## 구현 내용

### 수정 대상 파일
- `src/App.jsx` — 상품 수정 모달 (현재 라인 1465-1541 부근)

### 1. 상품 상세 데이터 로드
**위치:** `openProductEditModal` 함수 (현재 라인 675)

```javascript
const openProductEditModal = async (p) => {
  // 기존: 목록 데이터로 모달 즉시 오픈
  setProductEditModal({
    isOpen: true, id: p.id, name: p.name || '', price: p.price || 0,
    // ... 기존 필드
    options: [],           // 새로 추가
    isLoadingDetail: true, // 새로 추가
    _detail: null
  });

  // 개별 상품 상세 API 호출 (옵션 포함)
  try {
    const res = await fetch(
      `${BACKEND_API_URL}/api/proxy?endpoint=products/${encodeURIComponent(p.id)}`,
      { method: 'GET', headers: getAuthHeaders(token) }
    );
    if (res.ok) {
      const detail = await res.json();
      setProductEditModal(prev => ({
        ...prev,
        options: detail.productVariants || detail.options || [],
        _detail: detail,
        isLoadingDetail: false
      }));
    }
  } catch (err) {
    console.error('상품 상세 로드 실패:', err);
    setProductEditModal(prev => ({ ...prev, isLoadingDetail: false }));
  }
};
```

### 2. productEditModal 상태 확장
```javascript
const [productEditModal, setProductEditModal] = useState({
  // 기존 필드
  isOpen: false, id: '', name: '', price: '', stockType: 'unlimited',
  stockCount: '', isDisplayed: 'true', status: 'onSale', description: '', _original: null,
  // 새로 추가
  options: [],           // Array<{ id, title, price, stockCount, values }>
  isLoadingDetail: false,
  _detail: null
});
```

### 3. 옵션 편집 UI (모달 내부)
상세 설명 textarea 아래에 추가:

```jsx
{/* 옵션 관리 섹션 */}
{productEditModal.options.length > 0 && (
  <div className="bg-white/40 p-5 rounded-2xl border border-white/60 shadow-inner">
    <h4 className="text-[10px] font-extrabold text-purple-600 uppercase tracking-widest mb-3 border-b border-white/50 pb-2 ml-1">
      옵션 관리 ({productEditModal.options.length}개)
    </h4>
    <div className="space-y-3">
      {productEditModal.options.map((opt, idx) => (
        <div key={opt.id || idx} className="bg-white/50 p-4 rounded-xl border border-white/60 shadow-sm">
          <p className="font-extrabold text-sm text-slate-700 mb-3">{opt.title || `옵션 ${idx + 1}`}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-400 mb-1 block">가격</label>
              <input type="number" value={opt.price || ''}
                onChange={e => {
                  const updated = [...productEditModal.options];
                  updated[idx] = { ...updated[idx], price: Number(e.target.value) };
                  setProductEditModal(prev => ({ ...prev, options: updated }));
                }}
                className={glassInput + " font-mono"} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 mb-1 block">재고</label>
              <input type="number" value={opt.stockCount ?? ''}
                onChange={e => {
                  const updated = [...productEditModal.options];
                  updated[idx] = { ...updated[idx], stockCount: e.target.value === '' ? null : Number(e.target.value) };
                  setProductEditModal(prev => ({ ...prev, options: updated }));
                }}
                className={glassInput + " font-mono"} placeholder="무제한" />
            </div>
          </div>
          {/* 옵션 값 태그 표시 */}
          {opt.values && opt.values.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {opt.values.map((v, vi) => (
                <span key={vi} className="px-2.5 py-1 bg-white/60 border border-white/50 rounded-lg text-[10px] font-bold text-slate-500">
                  {typeof v === 'string' ? v : v.title || v.name || JSON.stringify(v)}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  </div>
)}

{/* 로딩 상태 */}
{productEditModal.isLoadingDetail && (
  <div className="text-center py-4">
    <span className="text-xs text-slate-400 font-bold">옵션 정보를 불러오는 중...</span>
  </div>
)}
```

### 4. 저장 로직 확장
**위치:** `handleUpdateProduct` 함수

```javascript
const handleUpdateProduct = async () => {
  // ... 기존 메인 상품 PUT 로직 유지 ...

  // 옵션이 수정된 경우 추가 PUT 호출
  if (productEditModal.options.length > 0 && productEditModal._detail) {
    try {
      const variantEndpoint = `products/${encodeURIComponent(id)}/product_variants`;
      const variantUrl = `${BACKEND_API_URL}/api/proxy?endpoint=${variantEndpoint}`;
      const variantRes = await fetch(variantUrl, {
        method: 'PUT',
        headers: requestHeaders,
        body: JSON.stringify({
          // ⚠️ 실제 API 스키마에 맞게 조정 필요
          variants: productEditModal.options
        })
      });
      if (!variantRes.ok) {
        const errData = await variantRes.json().catch(() => ({}));
        showToast(`상품은 수정되었으나 옵션 수정 실패: ${errData.message || variantRes.status}`, 'warning');
        return; // 부분 성공
      }
    } catch (err) {
      showToast(`옵션 수정 중 오류: ${err.message}`, 'warning');
      return;
    }
  }

  // 전체 성공
  closeProductEditModal();
  showToast('상품이 성공적으로 수정되었습니다.', 'success');
};
```

---

## ⚠️ API 테스트 후 확인/수정 필요 사항

1. **옵션 필드명**: `productVariants` vs `options` vs `variants` — GET 응답에서 확인
2. **옵션 내부 구조**: `{ id, title, price, stockCount, values }` 가정 — 실제 구조에 맞게 수정
3. **PUT 요청 body**: `product_variants` 엔드포인트의 요청 스키마 확인
4. **권한**: 어드민/셀러 토큰별 옵션 수정 권한 차이 확인
5. **이미지**: 옵션별 이미지가 있는 경우 추가 처리 필요

---

## 테스트 체크리스트

- [ ] 상품 수정 모달 열 때 옵션 데이터 로드 확인
- [ ] 옵션별 가격/재고 수정 후 저장 성공 확인
- [ ] 메인 상품 수정 성공 + 옵션 수정 실패 시 부분 성공 토스트 확인
- [ ] 옵션이 없는 상품에서 옵션 섹션이 표시되지 않음 확인
- [ ] 어드민/셀러 양쪽 모드에서 동작 확인
