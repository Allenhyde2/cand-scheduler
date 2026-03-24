export const createCodeVerifier = () =>
  btoa(String.fromCharCode(...new Uint8Array(crypto.getRandomValues(new Uint8Array(32)))))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

export const createCodeChallenge = async (verifier) =>
  btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest("SHA-256", (new TextEncoder()).encode(verifier)))))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
