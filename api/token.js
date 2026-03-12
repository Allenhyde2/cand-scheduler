// Vercel 환경에서 동작하는 Serverless Function 입니다.
// 브라우저의 직접 호출을 막기 위해 여기서 client_secret을 합쳐서 캔패스 서버에 요청합니다.

export default async function handler(req, res) {
  // 오직 POST 요청만 허용합니다.
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 프론트엔드(App.jsx)에서 넘겨준 파라미터들을 받습니다.
    const { code, code_verifier, redirect_uri, client_id } = req.body;

    // Vercel 환경 변수(Environment Variables)에서 시크릿 키를 불러옵니다.
    // (로컬에서 테스트할 때는 .env 파일에 저장해두고 사용하시면 됩니다.)
    const CLIENT_SECRET = process.env.CAND_CLIENT_SECRET;

    if (!CLIENT_SECRET) {
      console.error('환경 변수 CAND_CLIENT_SECRET이 설정되지 않았습니다.');
      return res.status(500).json({ error: '서버 설정 오류: 시크릿 키 누락' });
    }

    // 캔패스 토큰 발급 주소로 보낼 데이터를 URL 인코딩 형태로 조립합니다.
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('client_id', client_id);
    params.append('client_secret', CLIENT_SECRET); // ⭐️ 중간 서버의 핵심! 시크릿 키 추가
    params.append('code', code);
    params.append('redirect_uri', redirect_uri);
    
    // PKCE를 함께 사용하는지 여부에 따라 분기 (문서상 시크릿을 쓰면 보통 verifier는 선택이거나 안 씁니다만, 
    // 기존에 프론트에서 보냈던 걸 그대로 전달합니다)
    if (code_verifier) {
      params.append('code_verifier', code_verifier);
    }

    // 캔패스(본섭)에 토큰 발급을 요청합니다.
    const response = await fetch('https://canpass.me/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await response.json();

    // 에러 발생 시 프론트엔드로 에러를 전달합니다.
    if (!response.ok) {
      console.error('CANpass 토큰 발급 실패:', data);
      return res.status(response.status).json(data);
    }

    // 성공 시 발급받은 토큰(access_token)을 프론트엔드로 고스란히 돌려줍니다!
    return res.status(200).json(data);

  } catch (error) {
    console.error('토큰 프록시 서버 에러:', error);
    return res.status(500).json({ error: '서버 내부 통신 에러', details: error.message });
  }
}
