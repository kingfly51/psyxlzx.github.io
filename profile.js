/**
 * profile.js - 个人档案页面逻辑
 */

let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  currentUser = requireAuth();
  if (!currentUser) return;

  await loadProfile();
  bindEvents();
  trackEvent('page_view', { page: 'profile' });
});

async function loadProfile() {
  try {
    const res = await apiGet('/api/user/profile');
    if (res.success) {
      const profile = res.profile || {};
      const stats = res.stats || {};

      // 更新 hero
      document.getElementById('hero-username').textContent = profile.nickname || profile.username || currentUser.username;
      document.getElementById('hero-email').textContent = profile.email || '未设置邮箱';

      // 头像
      const avatarEl = document.getElementById('profile-avatar');
      setAvatarElement(avatarEl, profile);

      // 徽章
      document.getElementById('badge-msgs').textContent = `${stats.total_messages || 0} 条对话`;

      // 统计
      document.getElementById('s-convs').textContent = fmtNum(stats.total_conversations || 0);
      document.getElementById('s-msgs').textContent = fmtNum(stats.total_messages || 0);
      document.getElementById('s-days').textContent = stats.days_active || 0;
      const avg = stats.avg_response_time;
      document.getElementById('s-avg').textContent = avg ? avg.toFixed(1) + 's' : '-';

      // 表单填充
      document.getElementById('p-nickname').value = profile.nickname || '';
      document.getElementById('p-age').value = profile.age || '';
      document.getElementById('p-gender').value = profile.gender || '';
      document.getElementById('p-education').value = profile.education || '';
      document.getElementById('p-occupation').value = profile.occupation || '';
      document.getElementById('p-email').value = profile.email || '';
      document.getElementById('p-bio').value = profile.bio || '';
    }
  } catch {
    showToast('加载档案失败', 'error');
  }
}

function bindEvents() {
  // 保存档案
  document.getElementById('profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('p-email').value.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      document.getElementById('p-email').classList.add('error');
      document.getElementById('p-email-err').textContent = '邮箱格式不正确';
      document.getElementById('p-email-err').classList.add('show');
      return;
    }
    document.getElementById('p-email').classList.remove('error');
    document.getElementById('p-email-err').classList.remove('show');

    const btn = document.getElementById('save-profile-btn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> 保存中...';

    try {
      const res = await apiPut('/api/user/profile', {
        nickname: document.getElementById('p-nickname').value.trim(),
        age: parseInt(document.getElementById('p-age').value) || null,
        gender: document.getElementById('p-gender').value,
        education: document.getElementById('p-education').value,
        occupation: document.getElementById('p-occupation').value.trim(),
        email: email,
        bio: document.getElementById('p-bio').value.trim(),
      });
      if (res.success) {
        showToast('档案保存成功', 'success');
        if (res.user) {
          localStorage.setItem('user', JSON.stringify(res.user));
          currentUser = res.user;
          document.getElementById('hero-username').textContent = res.user.nickname || res.user.username;
          setAvatarElement(document.getElementById('profile-avatar'), res.user);
        }
      } else {
        showToast(res.message || '保存失败', 'error');
      }
    } catch {
      showToast('网络错误', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-save"></i> 保存信息';
    }
  });

  // 修改密码
  document.getElementById('new-password')?.addEventListener('input', (e) => {
    const pw = e.target.value;
    const strength = checkPasswordStrength(pw);
    const bar = document.getElementById('pw-strength-bar');
    const text = document.getElementById('pw-strength-text');
    if (bar) { bar.style.width = strength.percent + '%'; bar.style.background = strength.color; }
    if (text) { text.textContent = pw ? `密码强度：${strength.label}` : ''; text.style.color = strength.color; }
  });

  document.getElementById('password-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const oldPw = document.getElementById('old-password').value;
    const newPw = document.getElementById('new-password').value;
    const confirmPw = document.getElementById('confirm-password').value;
    let valid = true;

    if (!oldPw) { showPwError('old-pw-err', '请输入当前密码'); valid = false; }
    else hidePwError('old-pw-err');

    if (!newPw || newPw.length < 8) { showPwError('new-pw-err', '新密码至少8位'); valid = false; }
    else hidePwError('new-pw-err');

    if (newPw !== confirmPw) { showPwError('confirm-pw-err', '两次密码不一致'); valid = false; }
    else hidePwError('confirm-pw-err');

    if (!valid) return;

    const btn = document.getElementById('save-password-btn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> 修改中...';

    try {
      const res = await apiPost('/api/auth/change-password', { old_password: oldPw, new_password: newPw });
      if (res.success) {
        showToast('密码修改成功', 'success');
        document.getElementById('password-form').reset();
        document.getElementById('pw-strength-bar').style.width = '0';
        document.getElementById('pw-strength-text').textContent = '';
      } else {
        showToast(res.message || '密码修改失败', 'error');
      }
    } catch {
      showToast('网络错误', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-lock"></i> 修改密码';
    }
  });

  function showPwError(errId, msg) {
    const el = document.getElementById(errId);
    if (el) { el.textContent = msg; el.classList.add('show'); }
  }
  function hidePwError(errId) {
    const el = document.getElementById(errId);
    if (el) el.classList.remove('show');
  }

  // 头像上传
  document.getElementById('avatar-upload-zone')?.addEventListener('click', () => {
    document.getElementById('avatar-file-input').click();
  });

  document.getElementById('avatar-file-input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast('请选择图片文件', 'warning'); return; }
    if (file.size > 5 * 1024 * 1024) { showToast('图片大小不能超过 5MB', 'warning'); return; }

    // 预览
    const reader = new FileReader();
    reader.onload = (ev) => {
      const el = document.getElementById('profile-avatar');
      el.innerHTML = `<img src="${ev.target.result}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`;
    };
    reader.readAsDataURL(file);

    // 上传
    const formData = new FormData();
    formData.append('avatar', file);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE || ''}/api/user/avatar`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        showToast('头像上传成功', 'success');
        if (data.avatar_url) {
          currentUser.avatar_url = data.avatar_url;
          localStorage.setItem('user', JSON.stringify(currentUser));
        }
      } else {
        showToast(data.message || '上传失败', 'error');
      }
    } catch {
      showToast('上传失败，请重试', 'error');
    }
  });

  // 导出对话
  document.getElementById('export-conversations-btn')?.addEventListener('click', async () => {
    try {
      const res = await apiGet('/api/user/export/conversations');
      if (res.success) {
        downloadFile(JSON.stringify(res.data, null, 2), `对话数据_${new Date().toISOString().slice(0,10)}.json`);
        showToast('导出成功', 'success');
      }
    } catch { showToast('导出失败', 'error'); }
  });

  // 导出统计
  document.getElementById('export-stats-btn')?.addEventListener('click', async () => {
    try {
      const res = await apiGet('/api/user/export/stats');
      if (res.success) {
        const rows = [
          ['指标', '数值'],
          ['总对话数', res.stats.total_conversations],
          ['总消息数', res.stats.total_messages],
          ['参与天数', res.stats.days_active],
          ['平均响应时间(s)', res.stats.avg_response_time],
          ['注册日期', res.stats.created_at],
        ];
        const csv = rows.map(r => r.join(',')).join('\n');
        downloadFile(csv, `使用统计_${new Date().toISOString().slice(0,10)}.csv`, 'text/csv;charset=utf-8');
        showToast('导出成功', 'success');
      }
    } catch { showToast('导出失败', 'error'); }
  });

  // 退出
  document.getElementById('logout-btn2')?.addEventListener('click', logout);
}
