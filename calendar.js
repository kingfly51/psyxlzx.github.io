/**
 * 心境 MindCare - 日历模块
 * 月历视图、每日健康记录、快速记录
 */

let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth(); // 0-indexed
let healthRecords = {}; // { 'YYYY-MM-DD': {...} }
let todayQuickState = {};

// ===== 初始化日历 =====

async function initCalendar() {
  await loadHealthRecords();
  renderCalendar();
  loadTodayQuick();
}

async function loadHealthRecords() {
  try {
    const res = await apiGet('/health/records');
    healthRecords = {};
    (res?.records || []).forEach(r => {
      healthRecords[r.date] = r;
    });
  } catch (err) {
    console.error('加载健康记录失败', err);
  }
}

function renderCalendar() {
  const label = document.getElementById('cal-month-label');
  label.textContent = `${calYear}年${calMonth + 1}月`;
  
  const grid = document.getElementById('cal-grid');
  const today = todayStr();
  
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  
  let html = '';
  
  // 补全开头空格
  for (let i = 0; i < firstDay; i++) {
    html += '<div class="cal-day empty"></div>';
  }
  
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = dateStr === today;
    const hasRecord = !!healthRecords[dateStr];
    const classes = ['cal-day', isToday ? 'today' : '', hasRecord ? 'has-record' : ''].filter(Boolean).join(' ');
    
    html += `<div class="${classes}" onclick="handleDayClick('${dateStr}')">${d}</div>`;
  }
  
  grid.innerHTML = html;
}

function changeMonth(delta) {
  calMonth += delta;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  if (calMonth < 0) { calMonth = 11; calYear--; }
  renderCalendar();
}

// ===== 点击日期 =====

function handleDayClick(dateStr) {
  const today = todayStr();
  if (dateStr === today) {
    showQuestionnaire(dateStr);
  } else if (healthRecords[dateStr]) {
    showDayDetail(dateStr);
  } else if (dateStr < today) {
    // 补填过去记录
    showQuestionnaire(dateStr);
  }
}

// ===== 每日问卷 =====

function showQuestionnaire(dateStr) {
  const existing = healthRecords[dateStr];
  
  document.getElementById('q-date-label').textContent = formatDate(dateStr);
  document.getElementById('questionnaire-modal').style.display = 'flex';
  
  // 设置已有数据
  if (existing) {
    setSlider('q-sleep', 'sleep-val', existing.sleep_quality || 5);
    setSlider('q-anxiety', 'anxiety-val', existing.anxiety || 5);
    setSlider('q-depression', 'depression-val', existing.depression || 5);
    setSlider('q-wellbeing', 'wellbeing-val', existing.wellbeing || 5);
    setSlider('q-health', 'health-val', existing.overall_health || 5);
  } else {
    setSlider('q-sleep', 'sleep-val', 5);
    setSlider('q-anxiety', 'anxiety-val', 5);
    setSlider('q-depression', 'depression-val', 5);
    setSlider('q-wellbeing', 'wellbeing-val', 5);
    setSlider('q-health', 'health-val', 5);
  }
  
  // 存储当前操作日期
  document.getElementById('questionnaire-modal').dataset.date = dateStr;
}

function setSlider(sliderId, valId, value) {
  document.getElementById(sliderId).value = value;
  document.getElementById(valId).textContent = value;
}

function updateScore(valId, value) {
  document.getElementById(valId).textContent = value;
}

async function submitQuestionnaire() {
  const modal = document.getElementById('questionnaire-modal');
  const dateStr = modal.dataset.date;
  
  const data = {
    date: dateStr,
    sleep_quality: parseInt(document.getElementById('q-sleep').value),
    anxiety: parseInt(document.getElementById('q-anxiety').value),
    depression: parseInt(document.getElementById('q-depression').value),
    wellbeing: parseInt(document.getElementById('q-wellbeing').value),
    overall_health: parseInt(document.getElementById('q-health').value),
    ...todayQuickState
  };
  
  try {
    const res = await apiPost('/health/records', data);
    if (res?.record) {
      healthRecords[dateStr] = res.record;
      renderCalendar();
      showToast('记录已保存 ✓');
      closeQuestionnaire();
      trackEvent('health_record_saved', { date: dateStr });
    }
  } catch (err) {
    showToast('保存失败: ' + err.message);
  }
}

function closeQuestionnaire() {
  document.getElementById('questionnaire-modal').style.display = 'none';
}

// ===== 日期详情 =====

function showDayDetail(dateStr) {
  const rec = healthRecords[dateStr];
  if (!rec) return;
  
  document.getElementById('day-detail-title').textContent = formatDate(dateStr);
  
  const scoreLabels = { sleep_quality:'睡眠质量', anxiety:'焦虑程度', depression:'抑郁程度', wellbeing:'幸福感', overall_health:'总体健康' };
  const activityLabels = { exercise:'运动', sugary_drink:'含糖饮料', sedentary:'久坐', high_salt:'高盐饮食' };
  
  let html = '';
  Object.entries(scoreLabels).forEach(([key, label]) => {
    if (rec[key] != null) {
      html += `<div class="detail-row">
        <span class="detail-label">${label}</span>
        <span class="detail-value">${rec[key]} / 10</span>
      </div>`;
    }
  });
  
  const badges = [];
  Object.entries(activityLabels).forEach(([key, label]) => {
    if (rec[key]) badges.push(label);
  });
  
  if (badges.length > 0) {
    html += `<div style="padding: 8px 0 4px; font-size: 13px; color: var(--text-muted)">今日记录</div>
      <div class="detail-badges">${badges.map(b => `<span class="detail-badge">${b}</span>`).join('')}</div>`;
  }
  
  document.getElementById('day-detail-content').innerHTML = html;
  document.getElementById('day-detail-modal').style.display = 'flex';
}

// ===== 快速记录 =====

function loadTodayQuick() {
  const today = todayStr();
  const rec = healthRecords[today];
  todayQuickState = {};
  
  document.querySelectorAll('.quick-btn').forEach(btn => {
    const key = btn.dataset.key;
    const active = rec && rec[key];
    btn.classList.toggle('active', !!active);
    if (active) todayQuickState[key] = true;
  });
}

async function toggleQuick(btn) {
  const key = btn.dataset.key;
  const isActive = btn.classList.toggle('active');
  todayQuickState[key] = isActive;
  
  // 自动保存快速记录
  try {
    await apiPost('/health/quick', {
      date: todayStr(),
      key,
      value: isActive
    });
    showToast(isActive ? `已记录: ${btn.textContent.trim()}` : `已取消: ${btn.textContent.trim()}`);
  } catch (err) {
    console.error('快速记录保存失败', err);
  }
}
