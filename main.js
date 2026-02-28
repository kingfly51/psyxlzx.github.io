/**
 * main.js - 公共工具函数
 * 认知重构心理健康平台
 */

// ============ 配置 ============
const API_BASE = window.API_BASE || '';

// ============ Toast 通知 ============
function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const icons = { success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-circle', info: 'fa-info-circle' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ============ API 请求 ============
async function apiRequest(method, path, data = null) {
  const token = localStorage.getItem('token');
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (data && method !== 'GET') opts.body = JSON.stringify(data);

  const url = `${API_BASE}${path}`;
  const res = await fetch(url, opts);

  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
    throw new Error('Unauthorized');
  }

  const json = await res.json().catch(() => ({ success: false, message: '响应解析失败' }));
  return json;
}

function apiGet(path) { return apiRequest('GET', path); }
function apiPost(path, data) { return apiRequest('POST', path, data); }
function apiPut(path, data) { return apiRequest('PUT', path, data); }
function apiDelete(path) { return apiRequest('DELETE', path); }

// ============ 鉴权检查 ============
function requireAuth() {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = 'index.html';
    return null;
  }
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch { return {}; }
}

function getUser() {
  try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
}

function logout() {
  const doLogout = async () => {
    try { await apiPost('/api/auth/logout', {}); } catch {}
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
  };
  doLogout();
}

// ============ HTML 转义 ============
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ============ 日期格式化 ============
function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff/60)}分钟前`;
  if (diff < 86400) return `${Math.floor(diff/3600)}小时前`;
  if (diff < 604800) return `${Math.floor(diff/86400)}天前`;
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function formatDateTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// ============ 头像生成 ============
function getInitials(name) {
  if (!name) return 'U';
  const trimmed = name.trim();
  if (/[\u4e00-\u9fa5]/.test(trimmed)) return trimmed.slice(-2);
  return trimmed.slice(0, 2).toUpperCase();
}

function setAvatarElement(el, user) {
  if (!el) return;
  const src = user?.avatar_url;
  if (src) {
    el.innerHTML = `<img src="${src}" class="avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`;
    el.style.background = '';
  } else {
    const initials = getInitials(user?.nickname || user?.username || 'U');
    el.textContent = initials;
    el.style.background = 'linear-gradient(135deg, var(--primary-light), var(--accent))';
    el.style.color = '#fff';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.fontWeight = '600';
  }
}

// ============ 防抖 ============
function debounce(fn, delay) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

// ============ 数字格式化 ============
function fmtNum(n) {
  if (n >= 10000) return (n/10000).toFixed(1) + 'w';
  if (n >= 1000) return (n/1000).toFixed(1) + 'k';
  return String(n);
}

// ============ 下载文件 ============
function downloadFile(content, filename, mimeType = 'application/json') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ============ 事件追踪 ============
async function trackEvent(eventType, data = {}) {
  try {
    await apiPost('/api/analytics/event', { event_type: eventType, data, timestamp: Date.now() });
  } catch {}
}

// ============ Dropdown 全局点击关闭 ============
document.addEventListener('click', (e) => {
  if (!e.target.closest('.dropdown') && !e.target.closest('[data-dropdown]')) {
    document.querySelectorAll('.dropdown-menu.show').forEach(m => m.classList.remove('show'));
  }
});

// ============ 密码强度 ============
function checkPasswordStrength(password) {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const labels = ['非常弱', '弱', '一般', '强', '非常强'];
  const colors = ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#16A34A'];
  return { score, label: labels[Math.min(score, 4)], color: colors[Math.min(score, 4)], percent: (score / 5) * 100 };
}

// ============ Eye Toggle (password fields) ============
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.eye-toggle');
  if (!btn) return;
  const targetId = btn.dataset.target;
  if (!targetId) return;
  const input = document.getElementById(targetId);
  if (!input) return;
  const icon = btn.querySelector('i');
  if (input.type === 'password') {
    input.type = 'text';
    if (icon) { icon.className = 'fas fa-eye'; }
  } else {
    input.type = 'password';
    if (icon) { icon.className = 'fas fa-eye-slash'; }
  }
});
