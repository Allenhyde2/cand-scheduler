// api/token.js
// Vercel Serverless Function: 캔패스 토큰 발급 프록시

export default async function handler(req, res) {
  // CORS 처리 (만약을 대비해 추가)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. POST 요청만 허용됩니다.' });
  }

  try {
    const { code, code_verifier, redirect_uri, client_id } = req.body;
    const CLIENT_SECRET = process.env.CAND_CLIENT_SECRET;

    if (!CLIENT_SECRET) {
      console.error('환경 변수 CAND_CLIENT_SECRET 누락');
      return res.status(500).json({ error: '서버 설정 오류: 시크릿 키가 설정되지 않았습니다.' });
    }

    if (!code || !client_id || !redirect_uri) {
      return res.status(400).json({ error: '필수 파라미터(code, client_id, redirect_uri)가 누락되었습니다.' });
    }

    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('client_id', client_id);
    params.append('client_secret', CLIENT_SECRET);
    params.append('code', code);
    params.append('redirect_uri', redirect_uri);
    
    if (code_verifier) {
      params.append('code_verifier', code_verifier);
    }

    console.log('캔패스 서버로 토큰 요청 전송 중...');

    const response = await fetch('https://canpass.me/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('캔패스 토큰 발급 에러 응답:', data);
      return res.status(response.status).json(data);
    }

    console.log('토큰 발급 성공');
    return res.status(200).json(data);

  } catch (error) {
    console.error('토큰 프록시 내부 에러:', error);
    return res.status(500).json({ error: '서버 통신 에러', message: error.message });
  }
}
