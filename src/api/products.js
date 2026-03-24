import { BACKEND_API_URL } from '../constants/config';

const getAuthHeaders = (token, communityId) => ({
  'content-type': 'application/json',
  'authorization': `Bearer ${token}`,
  'x-can-community-id': communityId,
});

export const fetchProducts = async (token, communityId, { sellerId, loginMode, filters, pagingAfter }) => {
  const params = new URLSearchParams();
  params.append('endpoint', 'products');
  params.append('limit', '50');
  params.append('order', 'DESC');
  if (pagingAfter) params.append('after', pagingAfter);
  if (filters.name) params.append('query', filters.name);
  if (filters.sku) params.append('sku', filters.sku);
  if (filters.tag) params.append('tag', filters.tag);
  const searchSellerId = loginMode === 'seller' ? sellerId : (sellerId || filters.sellerId);
  if (searchSellerId) params.append('sellerId', searchSellerId);
  if (filters.status.length > 0) {
    filters.status.forEach(s => params.append('status', s));
  }
  if (filters.display !== 'all') params.append('isDisplayed', filters.display);

  const url = `${BACKEND_API_URL}/api/proxy?${params.toString()}`;
  const res = await fetch(url, { method: 'GET', headers: getAuthHeaders(token, communityId) });
  const responseText = await res.text();
  if (!res.ok) throw new Error(`API 오류: ${res.status}`);
  const data = JSON.parse(responseText);
  return { list: data.data || [], pagingAfter: data.paging?.after || null };
};

export const updateProduct = async (token, communityId, sellerId, productId, payload) => {
  const endpointPath = `products/${encodeURIComponent(productId)}`;
  const url = `${BACKEND_API_URL}/api/proxy?endpoint=${endpointPath}`;
  const headers = getAuthHeaders(token, communityId);
  if (sellerId) headers['x-can-profile-id'] = sellerId;

  const res = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    let errMessage = `오류 코드: ${res.status}`;
    try {
      const errData = await res.json();
      errMessage = errData.message || errData.error || errData.code || JSON.stringify(errData);
    } catch (e) { }
    throw new Error(errMessage);
  }
  return res.json();
};
