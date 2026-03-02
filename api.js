/**
 * 心境 MindCare - API 工具
 * 统一处理后端请求、Token管理、错误处理
 */

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:5000'
  : '';  // 生产环境使用相对路径

const TOKEN_KEY = 'mindcare_token';
const USER_KEY  = 'mindcare_user';

// ===== Token 管理 =====
function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function getCurrentUser() {
  const u = localStorage.getItem(USER_KEY);
  return u ? JSON.parse(u) : null;
}

function setCurrentUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

// ===== 核心请求函数 =====
async function apiRequest(method, path, data = null, requireAuth = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (requireAuth) {
    const token = getToken();
    if (!token) {
      redirectToLogin();
      return null;
    }
    headers['Authorization'] = `Bearer ${token}`;
  }

  const opts = { method, headers };
  if (data) opts.body = JSON.stringify(data);

  try {
    const res = await fetch(`${API_BASE}/api${path}`, opts);
    if (res.status === 401) {
      clearToken();
      redirectToLogin();
      return null;
    }
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || json.message || `HTTP ${res.status}`);
    }
    return json;
  } catch (err) {
    if (err.message !== 'redirect') throw err;
    return null;
  }
}

function apiGet(path, requireAuth = true) {
  return apiRequest('GET', path, null, requireAuth);
}

function apiPost(path, data, requireAuth = true) {
  return apiRequest('POST', path, data, requireAuth);
}

function apiPut(path, data, requireAuth = true) {
  return apiRequest('PUT', path, data, requireAuth);
}

function apiDelete(path, requireAuth = true) {
  return apiRequest('DELETE', path, null, requireAuth);
}

// ===== 导航辅助 =====
function redirectToLogin() {
  if (!window.location.pathname.endsWith('index.html') && window.location.pathname !== '/') {
    window.location.href = 'index.html';
  }
}

function redirectToApp() {
  window.location.href = 'app.html';
}

// ===== 时间辅助 =====
function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin}分钟前`;
  if (diffHour < 24) return `${diffHour}小时前`;
  if (diffDay < 7) return `${diffDay}天前`;
  return `${d.getMonth()+1}/${d.getDate()}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${y}年${parseInt(m)}月${parseInt(d)}日`;
}

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
}

// ===== 事件追踪 =====
async function trackEvent(eventType, data = {}) {
  try {
    await apiPost('/track', { event_type: eventType, data, timestamp: Date.now() });
  } catch (_) {} // 静默失败，不影响用户体验
}

// ===== Toast 通知 =====
function showToast(msg, duration = 2500) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.style.display = 'block';
  toast.style.animation = 'none';
  // 强制重排
  toast.offsetHeight;
  toast.style.animation = `fadeInOut ${duration/1000}s ease forwards`;
  setTimeout(() => { toast.style.display = 'none'; }, duration);
}
