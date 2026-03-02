/**
 * 心境 MindCare - 应用主模块
 * 页面导航、认证检查、全局初始化
 */

// 认证检查
(function() {
  if (!getToken()) {
    window.location.href = 'index.html';
  }
})();

// 当前页面状态
let currentPage = 'chat';

// 页面切换
function switchPage(page, navEl) {
  // 隐藏所有页面
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  
  // 激活目标页面
  document.getElementById(`page-${page}`).classList.add('active');
  if (navEl) navEl.classList.add('active');
  
  currentPage = page;
  
  // 追踪页面浏览
  trackEvent('page_view', { page });
  
  // 页面特定初始化
  if (page === 'calendar') initCalendar();
  if (page === 'profile') loadProfile();
  if (page === 'practice') initPractice();
}

// 退出登录
function doLogout() {
  if (!confirm('确定要退出登录吗？')) return;
  trackEvent('logout', {});
  clearToken();
  window.location.href = 'index.html';
}

// 全局初始化
async function initApp() {
  // 验证token有效性
  try {
    const res = await apiGet('/auth/me');
    if (res && res.user) {
      setCurrentUser(res.user);
    }
  } catch (_) {
    clearToken();
    window.location.href = 'index.html';
    return;
  }
  
  // 追踪登录事件
  trackEvent('app_open', {});
  
  // 初始化聊天列表
  await loadConversations();
  
  // 初始化练习页
  initPractice();
}

// 调用初始化
initApp();
