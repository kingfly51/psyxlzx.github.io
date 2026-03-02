/**
 * 心境 MindCare - 认证模块
 */

// 检查是否已登录
(function() {
  if (getToken()) {
    redirectToApp();
  }
})();

// Tab 切换
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`${btn.dataset.tab}-form`).classList.add('active');
  });
});

// 密码显示/隐藏
function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🙈';
  } else {
    input.type = 'password';
    btn.textContent = '👁';
  }
}

// 显示消息
function showMsg(elId, msg, type) {
  const el = document.getElementById(elId);
  el.textContent = msg;
  el.className = `form-msg ${type}`;
}

// 登录
async function doLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  
  if (!username || !password) {
    showMsg('login-msg', '请输入用户名和密码', 'error');
    return;
  }

  const btn = document.querySelector('#login-form .btn-primary');
  btn.disabled = true;
  btn.textContent = '登录中...';
  showMsg('login-msg', '', '');

  try {
    const res = await apiPost('/auth/login', { username, password }, false);
    if (res && res.token) {
      setToken(res.token);
      setCurrentUser(res.user);
      showMsg('login-msg', '登录成功！', 'success');
      setTimeout(redirectToApp, 600);
    }
  } catch (err) {
    showMsg('login-msg', err.message || '登录失败，请重试', 'error');
    btn.disabled = false;
    btn.textContent = '登 录';
  }
}

// 注册
async function doRegister() {
  const username = document.getElementById('reg-username').value.trim();
  const nickname = document.getElementById('reg-nickname').value.trim();
  const password = document.getElementById('reg-password').value;
  const password2 = document.getElementById('reg-password2').value;

  if (!username || !password || !nickname) {
    showMsg('reg-msg', '请填写所有必填项', 'error');
    return;
  }
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    showMsg('reg-msg', '用户名需为3-20位字母、数字或下划线', 'error');
    return;
  }
  if (password.length < 6) {
    showMsg('reg-msg', '密码至少需要6位', 'error');
    return;
  }
  if (password !== password2) {
    showMsg('reg-msg', '两次输入的密码不一致', 'error');
    return;
  }

  const btn = document.querySelector('#register-form .btn-primary');
  btn.disabled = true;
  btn.textContent = '注册中...';
  showMsg('reg-msg', '', '');

  try {
    const res = await apiPost('/auth/register', { username, nickname, password }, false);
    if (res && res.token) {
      setToken(res.token);
      setCurrentUser(res.user);
      showMsg('reg-msg', '注册成功！', 'success');
      setTimeout(redirectToApp, 600);
    }
  } catch (err) {
    showMsg('reg-msg', err.message || '注册失败，请重试', 'error');
    btn.disabled = false;
    btn.textContent = '注 册';
  }
}

// 忘记密码
function showForgotPassword() {
  document.getElementById('forgot-modal').style.display = 'flex';
}

// Enter 键提交
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const activeForm = document.querySelector('.auth-form.active');
    if (activeForm && activeForm.id === 'login-form') doLogin();
    else if (activeForm && activeForm.id === 'register-form') doRegister();
  }
});
