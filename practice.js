/**
 * 心境 MindCare - 练习模块
 * 冥想音频、呼吸练习、放松训练、音频播放器
 */

const AUDIO_CONTENT = {
  meditation: [
    { id: 'body-scan', name: '身体扫描冥想', duration: '20分钟', icon: '🧘', url: null },
    { id: 'breath-awareness', name: '呼吸觉察冥想', duration: '15分钟', icon: '🌬️', url: null },
    { id: 'loving-kindness', name: '慈心冥想', duration: '18分钟', icon: '💙', url: null },
    { id: 'walking-meditation', name: '行走冥想', duration: '12分钟', icon: '🚶', url: null },
    { id: 'mindful-eating', name: '正念进食', duration: '10分钟', icon: '🍃', url: null },
    { id: 'sleep-meditation', name: '睡前冥想', duration: '25分钟', icon: '🌙', url: null },
  ],
  breathing: [
    { id: 'breath-478', name: '4-7-8 呼吸法', duration: '8分钟', icon: '🫧', url: null },
    { id: 'belly-breath', name: '腹式呼吸', duration: '10分钟', icon: '🫁', url: null },
    { id: 'box-breath', name: '盒式呼吸', duration: '8分钟', icon: '⬛', url: null },
    { id: 'alternate-nostril', name: '交替鼻孔呼吸', duration: '12分钟', icon: '🌀', url: null },
  ],
  relaxation: [
    { id: 'pmr', name: '全身肌肉放松', duration: '20分钟', icon: '💆', url: null },
    { id: 'quick-relax', name: '快速放松训练', duration: '5分钟', icon: '⚡', url: null },
    { id: 'sleep-relax', name: '睡眠放松引导', duration: '30分钟', icon: '🛌', url: null },
  ]
};

// 当前播放状态
let currentAudio = null;
let audioTracker = {
  id: null,
  name: null,
  startTime: null,
  totalDuration: null,
  playing: false
};

function initPractice() {
  renderAudioList('meditation-list', AUDIO_CONTENT.meditation);
  renderAudioList('breathing-list', AUDIO_CONTENT.breathing);
  renderAudioList('relaxation-list', AUDIO_CONTENT.relaxation);
}

function renderAudioList(containerId, items) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  container.innerHTML = items.map(item => `
    <div class="audio-item" onclick="playAudio('${item.id}', '${escapeAttr(item.name)}', ${JSON.stringify(item.url)})">
      <div class="audio-icon">${item.icon}</div>
      <div class="audio-info">
        <div class="audio-name">${item.name}</div>
        <div class="audio-duration">${item.duration}</div>
      </div>
      <div class="audio-play">▶</div>
    </div>
  `).join('');
}

function escapeAttr(str) {
  return str.replace(/'/g, "&#39;");
}

// ===== 播放控制 =====

function playAudio(id, name, url) {
  const player = document.getElementById('audio-player');
  const audioEl = document.getElementById('audio-element');
  const titleEl = document.getElementById('player-title');
  
  // 记录追踪
  if (audioTracker.playing && audioTracker.id !== id) {
    recordAudioStop();
  }
  
  audioTracker = {
    id,
    name,
    startTime: Date.now(),
    totalDuration: null,
    playing: true
  };
  
  titleEl.textContent = name;
  
  if (url) {
    audioEl.src = url;
    audioEl.load();
    audioEl.play().catch(() => {});
  } else {
    // 无音频文件时显示占位信息
    showToast(`正在播放: ${name}（请配置音频文件路径）`);
  }
  
  player.style.display = 'block';
  
  setupAudioEvents(audioEl);
  
  trackEvent('audio_play', { audio_id: id, audio_name: name });
}

function setupAudioEvents(audioEl) {
  audioEl.ontimeupdate = () => {
    const current = audioEl.currentTime;
    const total = audioEl.duration || 0;
    document.getElementById('player-current').textContent = formatAudioTime(current);
    document.getElementById('player-duration').textContent = formatAudioTime(total);
    if (total > 0) {
      document.getElementById('player-seek').value = (current / total) * 100;
    }
  };
  
  audioEl.onloadedmetadata = () => {
    audioTracker.totalDuration = audioEl.duration;
    document.getElementById('player-duration').textContent = formatAudioTime(audioEl.duration);
    document.getElementById('player-seek').max = 100;
  };
  
  audioEl.onplay = () => {
    document.getElementById('play-pause-btn').textContent = '⏸';
  };
  
  audioEl.onpause = () => {
    document.getElementById('play-pause-btn').textContent = '▶';
  };
  
  audioEl.onended = () => {
    document.getElementById('play-pause-btn').textContent = '▶';
    recordAudioStop(true);
  };
}

function togglePlayPause() {
  const audioEl = document.getElementById('audio-element');
  if (audioEl.paused) {
    audioEl.play().catch(() => showToast('无法播放'));
  } else {
    audioEl.pause();
  }
}

function skipAudio(seconds) {
  const audioEl = document.getElementById('audio-element');
  audioEl.currentTime = Math.max(0, Math.min(audioEl.duration || 0, audioEl.currentTime + seconds));
}

function seekAudio(value) {
  const audioEl = document.getElementById('audio-element');
  if (audioEl.duration) {
    audioEl.currentTime = (value / 100) * audioEl.duration;
  }
}

function closePlayer() {
  recordAudioStop();
  const audioEl = document.getElementById('audio-element');
  audioEl.pause();
  audioEl.src = '';
  document.getElementById('audio-player').style.display = 'none';
}

function recordAudioStop(completed = false) {
  if (!audioTracker.id || !audioTracker.playing) return;
  
  const duration = Math.floor((Date.now() - audioTracker.startTime) / 1000);
  
  trackEvent('audio_stop', {
    audio_id: audioTracker.id,
    audio_name: audioTracker.name,
    listen_duration: duration,
    total_duration: audioTracker.totalDuration,
    completed
  });
  
  audioTracker.playing = false;
}

function formatAudioTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2,'0')}`;
}
