// Vercel Serverless Function: CORS 에러를 우회하기 위한 프록시 서버입니다.
import { setCors } from './_cors.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  const { endpoint, baseUrl, ...queryParams } = req.query;

  if (!endpoint) {
    return res.status(400).json({ error: 'Endpoint parameter is required' });
  }

  // 실제 요청을 보낼 목적지 URL 조립 (기본: https://api.cand.xyz, baseUrl 지정 시 해당 URL 사용)
  const allowedBaseUrls = ['https://api.cand.xyz', 'https://payment.moim.co'];
  const resolvedBase = baseUrl && allowedBaseUrls.includes(baseUrl) ? baseUrl : 'https://api.cand.xyz';
  const targetUrl = new URL(`${resolvedBase}/${endpoint}`);

  Object.keys(queryParams).forEach(key => {
    targetUrl.searchParams.append(key, queryParams[key]);
  });

  try {
    const headers = {
      'Content-Type': 'application/json',
    };
    
    // 프론트엔드에서 보낸 인증 헤더들을 그대로 본섭으로 전달
    if (req.headers.authorization) headers['Authorization'] = req.headers.authorization;
    if (req.headers['x-can-community-id']) headers['x-can-community-id'] = req.headers['x-can-community-id'];
    
    // ⭐️ [중요] 403 에러 방지: 프로필(셀러) 식별을 위한 권한 헤더 추가 전달
    if (req.headers['x-can-profile-id']) headers['x-can-profile-id'] = req.headers['x-can-profile-id'];

    console.log(`프록시 요청 전송 [${req.method}]: ${targetUrl.toString()}`);

    const fetchOptions = {
      method: req.method,
      headers: headers,
    };

    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    // 서버 대 서버로 실제 API를 호출합니다
    const response = await fetch(targetUrl.toString(), fetchOptions);
    const data = await response.json();

    if (!response.ok) {
      console.error('프록시 본섭 응답 에러:', data);
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);

  } catch (error) {
    console.error('프록시 서버 내부 에러:', error);
    return res.status(500).json({ error: '프록시 서버 통신 에러', details: error.message });
  }
}
