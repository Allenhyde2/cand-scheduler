const ALLOWED_ORIGINS = [
  'https://cand-scheduler.vercel.app',
  'http://localhost:5173',
];
const ALLOWED_PATTERNS = [/\.vercel\.app$/];

export function setCors(req, res) {
  const origin = req.headers.origin || '';
  const isAllowed =
    ALLOWED_ORIGINS.includes(origin) ||
    ALLOWED_PATTERNS.some(p => p.test(origin));

  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-can-community-id, x-can-profile-id');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}
