const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const ApiError = require('./ApiError');

const CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
let keyCache = new Map();
let cacheExpiresAt = 0;

async function getGoogleKey(kid) {
  if (Date.now() >= cacheExpiresAt || !keyCache.size) {
    let response;
    try {
      response = await fetch(CERTS_URL, { signal: AbortSignal.timeout(5000) });
    } catch {
      throw new ApiError(503, 'GOOGLE_UNAVAILABLE', 'Google sign-in could not be verified right now');
    }
    if (!response.ok) throw new ApiError(503, 'GOOGLE_UNAVAILABLE', 'Google sign-in could not be verified right now');

    const { keys = [] } = await response.json();
    keyCache = new Map(keys.filter((key) => key.kid && key.kty === 'RSA').map((key) => [
      key.kid,
      crypto.createPublicKey({ key, format: 'jwk' }),
    ]));
    const maxAge = Number(response.headers.get('cache-control')?.match(/max-age=(\d+)/i)?.[1]) || 3600;
    cacheExpiresAt = Date.now() + Math.min(maxAge, 6 * 60 * 60) * 1000;
  }
  return keyCache.get(kid);
}

async function verifyGoogleCredential(credential, audience) {
  const decoded = jwt.decode(credential, { complete: true });
  const kid = decoded?.header?.kid;
  if (!kid || decoded.header.alg !== 'RS256') {
    throw new ApiError(401, 'INVALID_GOOGLE_CREDENTIAL', 'Google sign-in credential is invalid');
  }

  const key = await getGoogleKey(kid);
  if (!key) throw new ApiError(401, 'INVALID_GOOGLE_CREDENTIAL', 'Google sign-in credential is invalid');

  try {
    const claims = jwt.verify(credential, key, {
      algorithms: ['RS256'],
      audience,
      issuer: ['accounts.google.com', 'https://accounts.google.com'],
    });
    if (!claims.sub || !claims.email || claims.email_verified !== true) {
      throw new Error('Required verified Google account claims are missing');
    }
    return claims;
  } catch {
    throw new ApiError(401, 'INVALID_GOOGLE_CREDENTIAL', 'Google sign-in credential is invalid or expired');
  }
}

module.exports = { verifyGoogleCredential };
