// Vercel Serverless Function: CORS 에러를 우회하기 위한 프록시 서버입니다.

export default async function handler(req, res) {
  // 클라이언트에서 넘겨준 endpoint 파라미터 (예: 'products')
  const { endpoint, ...queryParams } = req.query;

  if (!endpoint) {
    return res.status(400).json({ error: 'Endpoint parameter is required' });
  }

  // 실제 요청을 보낼 목적지 URL 조립 (https://api.cand.xyz/products)
  const targetUrl = new URL(`https://api.cand.xyz/${endpoint}`);

  // 넘어온 나머지 쿼리 파라미터(예: limit=100)를 목적지 URL에 붙여줍니다.
  Object.keys(queryParams).forEach(key => {
    targetUrl.searchParams.append(key, queryParams[key]);
  });

  try {
    // 프론트엔드에서 보낸 인증 헤더(토큰, 커뮤니티 ID)를 그대로 본섭으로 전달합니다.
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (req.headers.authorization) headers['Authorization'] = req.headers.authorization;
    if (req.headers['x-can-community-id']) headers['x-can-community-id'] = req.headers['x-can-community-id'];

    console.log(`프록시 요청 전송: ${targetUrl.toString()}`);

    // 서버 대 서버로 실제 API를 호출합니다 (CORS 무시)
    const response = await fetch(targetUrl.toString(), {
      method: req.method,
      headers: headers,
    });

    const data = await response.json();

    // 캔패스 본섭에서 에러를 뱉었을 경우
    if (!response.ok) {
      console.error('프록시 본섭 응답 에러:', data);
      return res.status(response.status).json(data);
    }

    // 성공적으로 데이터를 받아오면 프론트엔드(App.jsx)로 돌려줍니다.
    return res.status(200).json(data);

  } catch (error) {
    console.error('프록시 서버 내부 에러:', error);
    return res.status(500).json({ error: '프록시 서버 통신 에러', details: error.message });
  }
}
