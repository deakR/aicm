const TOKEN_KEY = 'token';
const POST_LOGIN_PATH_KEY = 'aicm:post-login-path';
const WIDGET_RESUME_KEY = 'aicm:resume-widget';

function decodeBase64Url(segment) {
  if (!segment) {
    return null;
  }

  try {
    const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(window.atob(padded));
  } catch {
    return null;
  }
}

export function decodeAuthToken(token) {
  if (!token) {
    return null;
  }

  const [, payload] = token.split('.');
  return decodeBase64Url(payload);
}

export function persistToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function setPostLoginPath(path) {
  if (!path || typeof path !== 'string') {
    return;
  }
  localStorage.setItem(POST_LOGIN_PATH_KEY, path);
}

export function consumePostLoginPath() {
  const path = localStorage.getItem(POST_LOGIN_PATH_KEY) || '';
  localStorage.removeItem(POST_LOGIN_PATH_KEY);
  return path;
}

export function markWidgetResumeRequested() {
  localStorage.setItem(WIDGET_RESUME_KEY, '1');
}

export function consumeWidgetResumeRequested() {
  const value = localStorage.getItem(WIDGET_RESUME_KEY) === '1';
  localStorage.removeItem(WIDGET_RESUME_KEY);
  return value;
}

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function getCurrentSession() {
  const token = getStoredToken();
  const claims = decodeAuthToken(token);

  if (!token || !claims?.role) {
    return {
      isAuthenticated: false,
      role: 'guest',
      token: '',
      userId: '',
    };
  }

  return {
    isAuthenticated: true,
    role: claims.role,
    token,
    userId: claims.user_id || '',
  };
}

export function getDefaultRouteForRole(role) {
  switch (role) {
    case 'admin':
      return '/dashboard';
    case 'agent':
      return '/inbox';
    case 'customer':
      return '/customer';
    default:
      return '/login';
  }
}
