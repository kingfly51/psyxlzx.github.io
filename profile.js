/**
 * 心境 MindCare - 个人中心模块
 */

async function loadProfile() {
  try {
    const res = await apiGet('/users/profile');
    if (!res?.user) return;
    
    const user = res.user;
    setCurrentUser(user);
    
    document.getElementById('user-avatar').textContent = user.avatar || '😊';
    document.getElementById('profile-name').textContent = user.nickname || user.username;
    
    // 填充表单
    document.getElementById('pf-nickname').value = user.nickname || '';
    document.getElementById('pf-age').value = user.age || '';
    document.getElementById('pf-gender').value = user.gender || '';
    document.getElementById('pf-occupation').value = user.occupation || '';
    document.getElementById('pf-education').value = user.education || '';
    
    // 统计数据
    document.getElementById('stat-conversations').textContent = user.stats?.total_conversations || 0;
    document.getElementById('stat-messages').textContent = user.stats?.total_messages || 0;
    document.getElementById('stat-days').textContent = user.stats?.record_days || 0;
    
  } catch (err) {
    console.error('加载个人信息失败', err);
  }
}

async function saveProfile() {
  const data = {
    nickname: document.getElementById('pf-nickname').value.trim(),
    age: parseInt(document.getElementById('pf-age').value) || null,
    gender: document.getElementById('pf-gender').value,
    occupation: document.getElementById('pf-occupation').value.trim(),
    education: document.getElementById('pf-education').value,
  };
  
  if (!data.nickname) {
    showToast('请填写昵称');
    return;
  }
  
  try {
    const res = await apiPut('/users/profile', data);
    if (res?.user) {
      setCurrentUser(res.user);
      document.getElementById('profile-name').textContent = res.user.nickname;
      showToast('个人信息已保存 ✓');
      trackEvent('profile_update', {});
    }
  } catch (err) {
    showToast('保存失败: ' + err.message);
  }
}

// ===== 头像 =====

function changeAvatar() {
  document.getElementById('avatar-modal').style.display = 'flex';
}

async function selectAvatar(emoji) {
  document.getElementById('avatar-modal').style.display = 'none';
  document.getElementById('user-avatar').textContent = emoji;
  
  try {
    await apiPut('/users/profile', { avatar: emoji });
    const user = getCurrentUser();
    if (user) { user.avatar = emoji; setCurrentUser(user); }
    showToast('头像已更新 ✓');
  } catch (err) {
    showToast('更新失败');
  }
}
