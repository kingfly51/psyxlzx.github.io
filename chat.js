/**
 * chat.js - 对话页面核心逻辑
 * 认知重构心理健康平台
 */

// ============ 状态 ============
let currentUser = null;
let conversations = [];
let currentConvId = null;
let messages = [];
let isSending = false;
let userStats = { total_conversations: 0, total_messages: 0, avg_response_time: 0 };

// ============ 初始化 ============
document.addEventListener('DOMContentLoaded', async () => {
  currentUser = requireAuth();
  if (!currentUser) return;

  initNav();
  await loadUserData();
  await loadConversations();
  bindEvents();
  autoResizeTextarea();
  trackEvent('page_view', { page: 'chat' });
});

function initNav() {
  const navAvatar = document.getElementById('nav-avatar');
  const navUsername = document.getElementById('nav-username');
  const panelAvatar = document.getElementById('panel-avatar');
  const panelUsername = document.getElementById('panel-username');

  if (navAvatar) setAvatarElement(navAvatar, currentUser);
  if (navUsername) navUsername.textContent = currentUser.nickname || currentUser.username || '用户';
  if (panelAvatar) setAvatarElement(panelAvatar, currentUser);
  if (panelUsername) panelUsername.textContent = currentUser.nickname || currentUser.username || '用户';
}

async function loadUserData() {
  try {
    const res = await apiGet('/api/user/stats');
    if (res.success) {
      userStats = res.stats || userStats;
      document.getElementById('stat-convs').textContent = fmtNum(userStats.total_conversations || 0);
      document.getElementById('stat-msgs').textContent = fmtNum(userStats.total_messages || 0);
    }
  } catch {}
}

// ============ 对话列表 ============
async function loadConversations() {
  try {
    const res = await apiGet('/api/conversations');
    if (res.success) {
      conversations = res.conversations || [];
      renderConversationList();
      // 自动打开最近的或默认对话
      if (conversations.length > 0) {
        const pinned = conversations.filter(c => c.pinned);
        const sorted = [...pinned, ...conversations.filter(c => !c.pinned)];
        await openConversation(sorted[0].id);
      }
    }
  } catch (e) {
    showToast('加载对话列表失败', 'error');
  }
}

function renderConversationList() {
  const listEl = document.getElementById('chat-list');
  if (!listEl) return;

  const pinned = conversations.filter(c => c.pinned);
  const unpinned = conversations.filter(c => !c.pinned);
  const sorted = [...pinned, ...unpinned];

  if (sorted.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state" style="padding:40px 20px">
        <i class="fas fa-comments"></i>
        <p>暂无对话，点击 + 新建</p>
      </div>`;
    return;
  }

  listEl.innerHTML = sorted.map(c => `
    <div class="chat-item ${c.id === currentConvId ? 'active' : ''} ${c.pinned ? 'pinned' : ''}"
         data-id="${c.id}" onclick="openConversation('${c.id}')">
      <div class="chat-item-title">
        ${escapeHtml(c.title || '新对话')}
      </div>
      <div class="chat-item-meta">
        <span>${c.message_count || 0} 条消息</span>
        <span>${formatTime(c.updated_at)}</span>
      </div>
      <div class="chat-item-actions">
        <button class="pin-btn ${c.pinned ? 'pinned' : ''}" onclick="event.stopPropagation();togglePin('${c.id}')" title="${c.pinned ? '取消置顶' : '置顶'}">
          <i class="fas fa-thumbtack"></i>
        </button>
        <button onclick="event.stopPropagation();confirmDeleteConversation('${c.id}')" title="删除">
          <i class="fas fa-trash-alt"></i>
        </button>
      </div>
    </div>
  `).join('');
}

async function openConversation(convId) {
  currentConvId = convId;
  messages = [];

  // 更新侧边栏选中状态
  document.querySelectorAll('.chat-item').forEach(el => {
    el.classList.toggle('active', el.dataset.id === convId);
  });

  const conv = conversations.find(c => c.id === convId);
  if (conv) {
    document.getElementById('chat-title').textContent = conv.title || '新对话';
    document.getElementById('chat-meta').textContent = `${conv.message_count || 0} 条消息`;
  }

  document.getElementById('chat-header').style.display = '';
  document.getElementById('welcome-screen').style.display = 'none';

  // 加载消息
  try {
    const res = await apiGet(`/api/conversations/${convId}/messages`);
    if (res.success) {
      messages = res.messages || [];
      renderMessages();
      scrollToBottom(true);
    }
  } catch {
    showToast('加载消息失败', 'error');
  }

  trackEvent('open_conversation', { conversation_id: convId });

  // 关闭移动端侧边栏
  closeSidebar();
}

function renderMessages() {
  const listEl = document.getElementById('messages-list');
  if (!listEl) return;

  if (messages.length === 0) {
    listEl.innerHTML = '';
    return;
  }

  listEl.innerHTML = messages.map(m => renderMessage(m)).join('');
}

function renderMessage(msg) {
  const isUser = msg.role === 'user';
  const user = currentUser;
  const time = formatDateTime(msg.created_at || msg.timestamp);
  const chars = msg.content ? msg.content.length : 0;

  const avatarHtml = isUser
    ? `<div class="message-avatar">
         ${user?.avatar_url
           ? `<img src="${user.avatar_url}" alt="">`
           : `<div class="avatar-placeholder" style="width:32px;height:32px;font-size:0.75rem;background:linear-gradient(135deg,var(--primary-light),var(--accent));color:#fff;display:flex;align-items:center;justify-content:center;border-radius:50%;font-weight:600">${getInitials(user?.nickname || user?.username)}</div>`
         }
       </div>`
    : `<div class="message-avatar">
         <div style="width:32px;height:32px;background:linear-gradient(135deg,#3B82B8,#4CAF8A);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.7rem;">🧠</div>
       </div>`;

  return `
    <div class="message ${isUser ? 'user' : 'ai'}">
      ${!isUser ? avatarHtml : ''}
      <div class="message-content">
        <div class="bubble">${escapeHtml(msg.content || '')}</div>
        <div class="message-meta">
          <span>${time}</span>
          ${chars > 0 ? `<span>${chars} 字</span>` : ''}
          ${msg.response_time ? `<span>${msg.response_time.toFixed(1)}s</span>` : ''}
        </div>
      </div>
      ${isUser ? avatarHtml : ''}
    </div>`;
}

function appendMessage(msg) {
  const listEl = document.getElementById('messages-list');
  if (!listEl) return;
  document.getElementById('welcome-screen').style.display = 'none';
  const div = document.createElement('div');
  div.innerHTML = renderMessage(msg);
  listEl.appendChild(div.firstElementChild);
  scrollToBottom();
}

function scrollToBottom(instant = false) {
  const area = document.getElementById('messages-area');
  if (!area) return;
  if (instant) {
    area.scrollTop = area.scrollHeight;
  } else {
    area.scrollTo({ top: area.scrollHeight, behavior: 'smooth' });
  }
}

// ============ 发送消息 ============
async function sendMessage() {
  if (isSending) return;
  const input = document.getElementById('message-input');
  const content = input.value.trim();
  if (!content) return;

  // 如果没有当前对话，先创建
  if (!currentConvId) {
    await createNewConversation();
    if (!currentConvId) return;
  }

  isSending = true;
  input.value = '';
  input.style.height = 'auto';
  document.getElementById('send-btn').disabled = true;

  // 显示用户消息
  const userMsg = { role: 'user', content, created_at: new Date().toISOString() };
  messages.push(userMsg);
  appendMessage(userMsg);

  // 显示 typing 指示
  const typingId = showTypingIndicator();
  const startTime = Date.now();

  try {
    const res = await apiPost(`/api/conversations/${currentConvId}/messages`, { content });

    removeTypingIndicator(typingId);

    if (res.success && res.message) {
      const aiMsg = {
        role: 'assistant',
        content: res.message.content,
        created_at: new Date().toISOString(),
        response_time: (Date.now() - startTime) / 1000
      };
      messages.push(aiMsg);
      appendMessage(aiMsg);

      // 更新对话标题（如果是首条消息）
      if (messages.length <= 2 && res.conversation_title) {
        updateConversationTitle(currentConvId, res.conversation_title);
      }

      updateChatMeta();
      updateCbtProgress(res.cbt_step);
    } else {
      showToast(res.message || 'AI 响应失败，请重试', 'error');
    }
  } catch (err) {
    removeTypingIndicator(typingId);
    showToast('发送失败，请检查网络连接', 'error');
  } finally {
    isSending = false;
    document.getElementById('send-btn').disabled = false;
    input.focus();
  }
}

function showTypingIndicator() {
  const listEl = document.getElementById('messages-list');
  const id = 'typing-' + Date.now();
  const div = document.createElement('div');
  div.id = id;
  div.className = 'message ai typing-message';
  div.innerHTML = `
    <div class="message-avatar">
      <div style="width:32px;height:32px;background:linear-gradient(135deg,#3B82B8,#4CAF8A);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.7rem;">🧠</div>
    </div>
    <div class="message-content">
      <div class="bubble">
        <div class="typing-dots"><span></span><span></span><span></span></div>
      </div>
    </div>`;
  listEl.appendChild(div);
  scrollToBottom();
  return id;
}

function removeTypingIndicator(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function updateChatMeta() {
  const conv = conversations.find(c => c.id === currentConvId);
  if (conv) {
    conv.message_count = (conv.message_count || 0) + 2;
    conv.updated_at = new Date().toISOString();
    document.getElementById('chat-meta').textContent = `${conv.message_count} 条消息`;
    renderConversationList();
  }
}

function updateCbtProgress(step) {
  if (!step) return;
  const el = document.getElementById('cbt-progress');
  if (!el) return;
  const steps = ['情境识别', '情绪认知', '想法觉察', '证据检验', '认知重构'];
  const idx = Math.min(step - 1, 4);
  el.innerHTML = `
    <div style="margin-bottom:8px;font-weight:600;color:var(--primary)">当前步骤：${steps[idx]}</div>
    ${steps.map((s, i) => `
      <div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:0.82rem;color:${i <= idx ? 'var(--text-primary)' : 'var(--text-muted)'}">
        <i class="fas ${i < idx ? 'fa-check-circle' : i === idx ? 'fa-dot-circle' : 'fa-circle'}" style="color:${i < idx ? 'var(--accent)' : i === idx ? 'var(--primary)' : 'var(--border)'}"></i>
        ${s}
      </div>`).join('')}`;
}

function updateConversationTitle(convId, title) {
  const conv = conversations.find(c => c.id === convId);
  if (conv) {
    conv.title = title;
    document.getElementById('chat-title').textContent = title;
    renderConversationList();
  }
}

// ============ 新建对话 ============
async function createNewConversation() {
  try {
    const res = await apiPost('/api/conversations', { title: '新对话' });
    if (res.success && res.conversation) {
      conversations.unshift(res.conversation);
      currentConvId = res.conversation.id;
      messages = [];
      renderConversationList();
      document.getElementById('chat-header').style.display = '';
      document.getElementById('messages-list').innerHTML = '';
      document.getElementById('welcome-screen').style.display = 'none';
      document.getElementById('chat-title').textContent = res.conversation.title || '新对话';
      document.getElementById('chat-meta').textContent = '0 条消息';
      document.getElementById('cbt-progress').textContent = '开始对话后，这里将显示认知重构进程。';
      trackEvent('create_conversation');
    }
  } catch {
    showToast('创建对话失败', 'error');
  }
}

// ============ 置顶 ============
async function togglePin(convId) {
  const conv = conversations.find(c => c.id === convId);
  if (!conv) return;
  try {
    const res = await apiPut(`/api/conversations/${convId}`, { pinned: !conv.pinned });
    if (res.success) {
      conv.pinned = !conv.pinned;
      renderConversationList();
      showToast(conv.pinned ? '已置顶' : '已取消置顶', 'success');
    }
  } catch { showToast('操作失败', 'error'); }
}

// ============ 删除对话 ============
function confirmDeleteConversation(convId) {
  if (!confirm('确定要删除此对话吗？')) return;
  deleteConversation(convId);
}

async function deleteConversation(convId) {
  try {
    const res = await apiDelete(`/api/conversations/${convId}`);
    if (res.success) {
      conversations = conversations.filter(c => c.id !== convId);
      if (currentConvId === convId) {
        currentConvId = null;
        messages = [];
        document.getElementById('messages-list').innerHTML = '';
        document.getElementById('chat-header').style.display = 'none';
        document.getElementById('welcome-screen').style.display = '';
      }
      renderConversationList();
      showToast('对话已删除', 'success');
    }
  } catch { showToast('删除失败', 'error'); }
}

// ============ 清空对话 ============
async function clearCurrentConversation() {
  if (!currentConvId) return;
  try {
    const res = await apiPost(`/api/conversations/${currentConvId}/clear`, {});
    if (res.success) {
      messages = [];
      document.getElementById('messages-list').innerHTML = '';
      const conv = conversations.find(c => c.id === currentConvId);
      if (conv) { conv.message_count = 0; renderConversationList(); }
      document.getElementById('chat-meta').textContent = '0 条消息';
      closeClearModal();
      showToast('对话已清空', 'success');
    }
  } catch { showToast('清空失败', 'error'); }
}

// ============ 导出对话 ============
async function exportCurrentConversation() {
  if (!currentConvId) return;
  try {
    const res = await apiGet(`/api/conversations/${currentConvId}/export`);
    if (res.success) {
      const conv = conversations.find(c => c.id === currentConvId);
      const filename = `对话_${(conv?.title || '导出').replace(/[/\\]/g, '_')}_${new Date().toISOString().slice(0,10)}.json`;
      downloadFile(JSON.stringify(res.data, null, 2), filename);
      showToast('导出成功', 'success');
      trackEvent('export_conversation', { conversation_id: currentConvId });
    }
  } catch { showToast('导出失败', 'error'); }
}

// ============ 重命名 ============
function openRenameModal() {
  const conv = conversations.find(c => c.id === currentConvId);
  if (!conv) return;
  document.getElementById('rename-input').value = conv.title || '';
  document.getElementById('rename-modal').classList.add('show');
  document.getElementById('rename-overlay').classList.add('show');
  document.getElementById('rename-input').focus();
}

function closeRenameModal() {
  document.getElementById('rename-modal').classList.remove('show');
  document.getElementById('rename-overlay').classList.remove('show');
}

async function confirmRename() {
  const newTitle = document.getElementById('rename-input').value.trim();
  if (!newTitle) { showToast('标题不能为空', 'warning'); return; }
  if (!currentConvId) return;
  try {
    const res = await apiPut(`/api/conversations/${currentConvId}`, { title: newTitle });
    if (res.success) {
      updateConversationTitle(currentConvId, newTitle);
      closeRenameModal();
      showToast('重命名成功', 'success');
    }
  } catch { showToast('重命名失败', 'error'); }
}

// ============ 清空 Modal ============
function openClearModal() {
  document.getElementById('clear-modal').classList.add('show');
  document.getElementById('clear-overlay').classList.add('show');
}
function closeClearModal() {
  document.getElementById('clear-modal').classList.remove('show');
  document.getElementById('clear-overlay').classList.remove('show');
}

// ============ 侧边栏 ============
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
}
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  sidebar.classList.toggle('open');
  overlay.classList.toggle('show');
}

// ============ 自动调整 Textarea ============
function autoResizeTextarea() {
  const textarea = document.getElementById('message-input');
  if (!textarea) return;
  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 160) + 'px';
  });
}

// ============ 绑定事件 ============
function bindEvents() {
  // 发送
  document.getElementById('send-btn')?.addEventListener('click', sendMessage);
  document.getElementById('message-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // 新建对话
  document.getElementById('new-chat-btn')?.addEventListener('click', createNewConversation);
  document.getElementById('new-chat-panel-btn')?.addEventListener('click', createNewConversation);

  // 导出
  document.getElementById('export-btn')?.addEventListener('click', exportCurrentConversation);

  // 更多操作 dropdown
  document.getElementById('chat-more-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('chat-dropdown').classList.toggle('show');
  });
  document.getElementById('pin-chat-btn')?.addEventListener('click', () => {
    document.getElementById('chat-dropdown').classList.remove('show');
    if (currentConvId) togglePin(currentConvId);
  });
  document.getElementById('rename-chat-btn')?.addEventListener('click', () => {
    document.getElementById('chat-dropdown').classList.remove('show');
    openRenameModal();
  });
  document.getElementById('clear-chat-btn')?.addEventListener('click', () => {
    document.getElementById('chat-dropdown').classList.remove('show');
    openClearModal();
  });

  // 清空 Modal
  document.getElementById('clear-confirm')?.addEventListener('click', clearCurrentConversation);
  document.getElementById('clear-cancel')?.addEventListener('click', closeClearModal);
  document.getElementById('clear-close')?.addEventListener('click', closeClearModal);
  document.getElementById('clear-overlay')?.addEventListener('click', closeClearModal);

  // 重命名 Modal
  document.getElementById('rename-confirm')?.addEventListener('click', confirmRename);
  document.getElementById('rename-cancel')?.addEventListener('click', closeRenameModal);
  document.getElementById('rename-close')?.addEventListener('click', closeRenameModal);
  document.getElementById('rename-overlay')?.addEventListener('click', closeRenameModal);
  document.getElementById('rename-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirmRename();
    if (e.key === 'Escape') closeRenameModal();
  });

  // 退出
  document.getElementById('logout-btn')?.addEventListener('click', logout);
  document.getElementById('logout-panel-btn')?.addEventListener('click', logout);

  // 用户下拉
  document.getElementById('nav-user-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('user-dropdown').classList.toggle('show');
  });

  // 侧边栏切换（移动端）
  document.getElementById('sidebar-toggle')?.addEventListener('click', toggleSidebar);
  document.getElementById('overlay')?.addEventListener('click', closeSidebar);
}
