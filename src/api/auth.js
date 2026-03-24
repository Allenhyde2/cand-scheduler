import { BACKEND_API_URL } from '../constants/config';

export const exchangeToken = async (clientId, code, codeVerifier, redirectUri) => {
  const res = await fetch(`${BACKEND_API_URL}/api/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, code, code_verifier: codeVerifier, redirect_uri: redirectUri })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || '토큰 발급 실패');
  return data.access_token;
};

export const fetchSellerProfile = async (token, communityId) => {
  const headers = {
    'content-type': 'application/json',
    'authorization': `Bearer ${token}`,
    'x-can-community-id': communityId
  };

  const res = await fetch(`${BACKEND_API_URL}/api/proxy?endpoint=me`, { method: 'GET', headers });
  if (!res.ok) throw new Error("유저 프로필 정보를 가져오지 못했습니다.");

  const data = await res.json();
  let sellerProfileId = data.profiles?.find(p => p.profileId?.startsWith('CS:'))?.profileId;

  if (!sellerProfileId && data.id) {
    const bulkRes = await fetch(`${BACKEND_API_URL}/api/proxy?endpoint=users/bulk`, {
      method: 'POST', headers, body: JSON.stringify({ ids: [data.id] })
    });
    if (bulkRes.ok) {
      const bulkData = await bulkRes.json();
      const userData = Array.isArray(bulkData) ? bulkData[0] : bulkData;
      sellerProfileId = userData?.profiles?.find(p => p.profileId?.startsWith('CS:'))?.profileId;
    }
  }
  return sellerProfileId || null;
};
