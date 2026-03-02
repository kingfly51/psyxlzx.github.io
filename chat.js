/**
 * 心境 MindCare - 聊天模块
 * 对话列表、聊天界面、消息发送
 */

let currentConvId = null;
let conversations = [];
let isTyping = false;
let pageEnterTime = Date.now();

// ===== 对话列表 =====

async function loadConversations() {
  try {
    const res = await apiGet('/conversations');
    conversations = res?.conversations || [];
    renderConversationList();
  } catch (err) {
    console.error('加载对话列表失败', err);
  }
}

function renderConversationList() {
  const listEl = document.getElementById('conversation-list');
  if (!listEl) return;
  
  if (conversations.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">💬</div>
        <p>还没有对话记录</p>
        <button class="btn-primary" onclick="startNewConversation()">开始第一次对话</button>
      </div>`;
    return;
  }
  
  // 置顶排序
  const sorted = [...conversations].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return (b.last_message_time || 0) - (a.last_message_time || 0);
  });
  
  listEl.innerHTML = sorted.map(conv => `
    <div class="conv-item ${conv.pinned ? 'pinned' : ''}" onclick="openConversation('${conv.id}')">
      <div class="conv-icon">🤖</div>
      <div class="conv-info">
        <div class="conv-title">${escapeHtml(conv.title || '认知重构对话')}</div>
        <div class="conv-meta">
          <span>${formatTime(conv.last_message_time)}</span>
          <span>${conv.message_count || 0} 条消息</span>
        </div>
      </div>
      ${conv.pinned ? '<div class="conv-pin-badge">置顶</div>' : ''}
    </div>
  `).join('');
}

// ===== 新建对话 =====

async function startNewConversation() {
  try {
    const res = await apiPost('/conversations', {
      title: `对话 ${new Date().toLocaleDateString('zh-CN', {month:'long',day:'numeric'})}`
    });
    if (res?.conversation) {
      conversations.unshift(res.conversation);
      renderConversationList();
      openConversation(res.conversation.id, true);
    }
  } catch (err) {
    showToast('创建对话失败: ' + err.message);
  }
}

// ===== 打开对话 =====

async function openConversation(convId, isNew = false) {
  currentConvId = convId;
  const conv = conversations.find(c => c.id === convId);
  
  document.getElementById('chat-title').textContent = conv?.title || '认知重构对话';
  document.getElementById('chat-messages').innerHTML = '';
  document.getElementById('chat-screen').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  
  pageEnterTime = Date.now();
  trackEvent('chat_open', { conv_id: convId });
  
  if (!isNew) {
    await loadMessages(convId);
  } else {
    // 新对话发送欢迎消息
    await sendWelcomeMessage();
  }
  
  scrollToBottom();
}

async function sendWelcomeMessage() {
  showTypingIndicator();
  try {
    const res = await apiPost(`/conversations/${currentConvId}/messages`, {
      role: 'system_welcome'
    });
    removeTypingIndicator();
    if (res?.message) {
      appendMessage({
        role: 'assistant',
        content: res.message,
        timestamp: Date.now()
      });
    }
  } catch (_) {
    removeTypingIndicator();
    appendMessage({
      role: 'assistant',
      content: '你好！我是你的认知重构助手。在这里，我们将一起探索你的思维模式，帮助你从不同角度看待生活中的困扰。\n\n请告诉我，最近有什么让你感到困扰或难以应对的事情吗？',
      timestamp: Date.now()
    });
  }
}

// ===== 加载消息 =====

async function loadMessages(convId) {
  try {
    const res = await apiGet(`/conversations/${convId}/messages`);
    const messages = res?.messages || [];
    const messagesEl = document.getElementById('chat-messages');
    messagesEl.innerHTML = '';
    messages.forEach(msg => appendMessage(msg));
    scrollToBottom();
  } catch (err) {
    showToast('加载消息失败');
  }
}

// ===== 发送消息 =====

async function sendMessage() {
  if (isTyping) return;
  const input = document.getElementById('chat-input');
  const content = input.value.trim();
  if (!content || !currentConvId) return;
  
  input.value = '';
  input.style.height = 'auto';
  
  const userMsg = {
    role: 'user',
    content,
    timestamp: Date.now()
  };
  appendMessage(userMsg);
  scrollToBottom();
  
  isTyping = true;
  document.getElementById('send-btn').disabled = true;
  showTypingIndicator();
  
  const sendStart = Date.now();
  
  try {
    const res = await apiPost(`/conversations/${currentConvId}/messages`, {
      role: 'user',
      content
    });
    
    removeTypingIndicator();
    isTyping = false;
    document.getElementById('send-btn').disabled = false;
    
    if (res?.message) {
      appendMessage({
        role: 'assistant',
        content: res.message,
        timestamp: Date.now(),
        response_time: Date.now() - sendStart
      });
      
      // 更新列表中的对话信息
      const convIdx = conversations.findIndex(c => c.id === currentConvId);
      if (convIdx >= 0) {
        conversations[convIdx].last_message_time = Date.now();
        conversations[convIdx].message_count = (conversations[convIdx].message_count || 0) + 2;
        renderConversationList();
      }
    }
  } catch (err) {
    removeTypingIndicator();
    isTyping = false;
    document.getElementById('send-btn').disabled = false;
    showToast('发送失败: ' + (err.message || '网络错误'));
  }
  
  scrollToBottom();
}

// ===== 关闭聊天界面 =====

function closeChatScreen() {
  const duration = Date.now() - pageEnterTime;
  trackEvent('chat_close', { conv_id: currentConvId, duration_ms: duration });
  
  document.getElementById('chat-screen').style.display = 'none';
  document.body.style.overflow = '';
  document.getElementById('chat-menu').style.display = 'none';
  currentConvId = null;
  loadConversations(); // 刷新列表
}

// ===== 菜单操作 =====

function toggleChatMenu() {
  const menu = document.getElementById('chat-menu');
  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

async function pinCurrentConversation() {
  if (!currentConvId) return;
  document.getElementById('chat-menu').style.display = 'none';
  try {
    await apiPut(`/conversations/${currentConvId}/pin`, {});
    const conv = conversations.find(c => c.id === currentConvId);
    if (conv) conv.pinned = !conv.pinned;
    showToast(conv?.pinned ? '已置顶对话' : '已取消置顶');
    renderConversationList();
  } catch (err) {
    showToast('操作失败');
  }
}

async function clearCurrentConversation() {
  if (!currentConvId) return;
  document.getElementById('chat-menu').style.display = 'none';
  if (!confirm('确定要清空此对话记录吗？此操作不可撤销。')) return;
  try {
    await apiDelete(`/conversations/${currentConvId}/messages`);
    document.getElementById('chat-messages').innerHTML = '';
    showToast('已清空对话记录');
  } catch (err) {
    showToast('清空失败');
  }
}

// ===== UI 辅助函数 =====

function appendMessage(msg) {
  const messagesEl = document.getElementById('chat-messages');
  const isUser = msg.role === 'user';
  
  const row = document.createElement('div');
  row.className = `msg-row ${isUser ? 'user' : 'ai'}`;
  
  const avatar = msg.role === 'assistant' ? '🌿' : (getCurrentUser()?.avatar || '😊');
  const time = new Date(msg.timestamp).toLocaleTimeString('zh-CN', {hour:'2-digit', minute:'2-digit'});
  
  row.innerHTML = `
    <div class="msg-avatar">${avatar}</div>
    <div>
      <div class="msg-bubble">${escapeHtml(msg.content)}</div>
      <div class="msg-time">${time}</div>
    </div>
  `;
  
  messagesEl.appendChild(row);
}

function showTypingIndicator() {
  const messagesEl = document.getElementById('chat-messages');
  const row = document.createElement('div');
  row.className = 'msg-row ai';
  row.id = 'typing-row';
  row.innerHTML = `
    <div class="msg-avatar">🌿</div>
    <div class="typing-indicator">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
  `;
  messagesEl.appendChild(row);
  scrollToBottom();
}

function removeTypingIndicator() {
  const el = document.getElementById('typing-row');
  if (el) el.remove();
}

function scrollToBottom() {
  const messagesEl = document.getElementById('chat-messages');
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function autoResizeInput(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 100) + 'px';
}

function handleChatKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>');
}

// 点击菜单外部关闭菜单
document.addEventListener('click', (e) => {
  const menu = document.getElementById('chat-menu');
  const wrap = document.querySelector('.chat-menu-wrap');
  if (menu && wrap && !wrap.contains(e.target)) {
    menu.style.display = 'none';
  }
});
