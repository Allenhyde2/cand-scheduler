import { useState, useEffect } from 'react';
import { CLIENT_ID, DEFAULT_GROUP_ID, SCOPES } from '../constants/config';
import { createCodeVerifier, createCodeChallenge } from '../utils/auth';
import { exchangeToken, fetchSellerProfile } from '../api/auth';

export default function useAuth(communityId, showToast, onLoginSuccess) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState('');
  const [sellerId, setSellerId] = useState('');
  const [loginMode, setLoginMode] = useState('seller');
  const [isLoginProcessing, setIsLoginProcessing] = useState(false);

  useEffect(() => {
    const handleOAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const stateParam = urlParams.get('state');
      const error = urlParams.get('error');

      if (error) {
        showToast(`로그인 취소/실패: ${urlParams.get('error_description')}`, 'error');
        window.history.replaceState({}, document.title, '/');
        return;
      }

      if (code && stateParam) {
        setIsLoginProcessing(true);
        const savedState = sessionStorage.getItem('oauth_state');
        const codeVerifier = sessionStorage.getItem('oauth_verifier');
        const savedLoginMode = sessionStorage.getItem('cand_login_mode') || 'seller';
        const savedAdminTargetId = localStorage.getItem('cand_admin_target_id');

        if (stateParam !== savedState) {
          showToast('비정상적인 로그인 접근입니다.', 'error');
          setIsLoginProcessing(false);
          return;
        }

        try {
          const redirectUri = `${window.location.origin}/canpass/callback`;
          const accessToken = await exchangeToken(CLIENT_ID, code, codeVerifier, redirectUri);

          let finalSellerId = '';
          if (savedLoginMode === 'admin') {
            finalSellerId = savedAdminTargetId || '';
          } else {
            const autoId = await fetchSellerProfile(accessToken, communityId);
            if (autoId) { finalSellerId = autoId; }
            else { showToast('셀러 ID 자동 탐지에 실패했습니다. 시스템 관리자에게 문의하세요.', 'warning'); }
          }

          setToken(accessToken);
          setSellerId(finalSellerId);
          setLoginMode(savedLoginMode);
          setIsAuthenticated(true);
          localStorage.setItem('cand_token', accessToken);
          localStorage.setItem('cand_seller_id', finalSellerId);
          localStorage.setItem('cand_login_mode', savedLoginMode);

          onLoginSuccess(accessToken, finalSellerId, savedLoginMode);
          showToast('캔패스 로그인이 완료되었습니다.', 'success');
        } catch (err) {
          showToast(`로그인 처리 중 오류 발생: ${err.message}`, 'error');
        } finally {
          setIsLoginProcessing(false);
          window.history.replaceState({}, document.title, '/');
          sessionStorage.removeItem('oauth_state');
          sessionStorage.removeItem('oauth_verifier');
        }
      }
      else {
        const savedToken = localStorage.getItem('cand_token');
        const savedSellerId = localStorage.getItem('cand_seller_id');
        const savedMode = localStorage.getItem('cand_login_mode') || 'seller';
        const savedRecentProducts = localStorage.getItem('cand_recent_products');

        if (savedToken) {
          setToken(savedToken);
          setSellerId(savedSellerId || '');
          setLoginMode(savedMode);
          setIsAuthenticated(true);
          onLoginSuccess(savedToken, savedSellerId, savedMode, savedRecentProducts);
        }
      }
    };
    handleOAuthCallback();
  }, []);

  const handleOAuthLogin = async (e) => {
    e.preventDefault();
    if (loginMode === 'admin') {
      localStorage.setItem('cand_admin_target_id', sellerId.trim());
    } else {
      localStorage.setItem('cand_admin_target_id', '');
    }
    sessionStorage.setItem('cand_login_mode', loginMode);
    const codeVerifier = createCodeVerifier();
    const codeChallenge = await createCodeChallenge(codeVerifier);
    const state = JSON.stringify({ nonce: Math.random().toString(), key: 'cand-admin' });
    sessionStorage.setItem('oauth_verifier', codeVerifier);
    sessionStorage.setItem('oauth_state', state);
    const redirectUri = `${window.location.origin}/canpass/callback`;
    const authUrl = new URL('https://canpass.me/oauth2/authorize');
    authUrl.search = new URLSearchParams({
      response_type: 'code', action: 'signin', client_id: CLIENT_ID,
      code_challenge: codeChallenge, code_challenge_method: 'S256',
      redirect_uri: redirectUri, community_id: DEFAULT_GROUP_ID, state, scope: SCOPES
    }).toString();
    window.location.href = authUrl.toString();
  };

  const handleLogout = (resetCallbacks) => {
    localStorage.removeItem('cand_token');
    localStorage.removeItem('cand_seller_id');
    localStorage.removeItem('cand_login_mode');
    setIsAuthenticated(false);
    setToken('');
    setSellerId('');
    if (resetCallbacks) resetCallbacks();
    showToast('로그아웃 되었습니다.', 'success');
  };

  return {
    isAuthenticated, token, sellerId, setSellerId, loginMode, setLoginMode, isLoginProcessing,
    handleOAuthLogin, handleLogout
  };
}
