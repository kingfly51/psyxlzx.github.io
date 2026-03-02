/**
 * 心境 MindCare - 数据分析模块
 * Chart.js 可视化图表
 */

let charts = {};

async function showAnalysis() {
  try {
    const res = await apiGet('/health/analysis');
    if (!res) return;
    
    document.getElementById('analysis-modal').style.display = 'flex';
    
    renderOverview(res.summary);
    renderTrendChart(res.trend);
    renderRadarChart(res.latest);
    renderBarChart(res.activities);
    renderInsights(res.insights);
    
    trackEvent('view_analysis', {});
  } catch (err) {
    showToast('加载数据失败: ' + err.message);
  }
}

function renderOverview(summary) {
  if (!summary) return;
  document.getElementById('ov-sleep').textContent = summary.avg_sleep?.toFixed(1) || '--';
  document.getElementById('ov-wellbeing').textContent = summary.avg_wellbeing?.toFixed(1) || '--';
  document.getElementById('ov-anxiety').textContent = summary.avg_anxiety?.toFixed(1) || '--';
  document.getElementById('ov-depression').textContent = summary.avg_depression?.toFixed(1) || '--';
}

function renderTrendChart(trendData) {
  if (!trendData?.length) return;
  
  const ctx = document.getElementById('trend-chart');
  if (!ctx) return;
  
  if (charts.trend) charts.trend.destroy();
  
  const labels = trendData.map(d => {
    const [, m, dd] = d.date.split('-');
    return `${parseInt(m)}/${parseInt(dd)}`;
  });
  
  charts.trend = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: '睡眠质量',
          data: trendData.map(d => d.sleep_quality),
          borderColor: '#3a7c6e',
          backgroundColor: 'rgba(58,124,110,0.08)',
          tension: 0.4,
          fill: false,
          pointRadius: 3
        },
        {
          label: '幸福感',
          data: trendData.map(d => d.wellbeing),
          borderColor: '#e8956d',
          backgroundColor: 'rgba(232,149,109,0.08)',
          tension: 0.4,
          fill: false,
          pointRadius: 3
        },
        {
          label: '焦虑',
          data: trendData.map(d => d.anxiety),
          borderColor: '#d68b45',
          tension: 0.4,
          fill: false,
          pointRadius: 3
        },
        {
          label: '抑郁',
          data: trendData.map(d => d.depression),
          borderColor: '#c0392b',
          tension: 0.4,
          fill: false,
          pointRadius: 3
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12 } }
      },
      scales: {
        y: { min: 1, max: 10, ticks: { stepSize: 2 } }
      }
    }
  });
}

function renderRadarChart(latest) {
  const ctx = document.getElementById('radar-chart');
  if (!ctx) return;
  
  if (charts.radar) charts.radar.destroy();
  
  const data = latest || { sleep_quality:5, wellbeing:5, anxiety:5, depression:5, overall_health:5 };
  
  charts.radar = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['睡眠质量', '幸福感', '焦虑反转', '抑郁反转', '总体健康'],
      datasets: [{
        label: '当前状态',
        data: [
          data.sleep_quality || 5,
          data.wellbeing || 5,
          11 - (data.anxiety || 5),  // 反转：越低越好
          11 - (data.depression || 5),
          data.overall_health || 5
        ],
        backgroundColor: 'rgba(58,124,110,0.15)',
        borderColor: '#3a7c6e',
        pointBackgroundColor: '#3a7c6e',
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      scales: {
        r: {
          min: 0,
          max: 10,
          ticks: { stepSize: 2, font: { size: 10 } },
          pointLabels: { font: { size: 11 } }
        }
      },
      plugins: { legend: { display: false } }
    }
  });
}

function renderBarChart(activities) {
  const ctx = document.getElementById('bar-chart');
  if (!ctx) return;
  
  if (charts.bar) charts.bar.destroy();
  
  const data = activities || { exercise:0, sugary_drink:0, sedentary:0, high_salt:0 };
  
  charts.bar = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['运动', '含糖饮料', '久坐', '高盐饮食'],
      datasets: [{
        label: '天数',
        data: [data.exercise, data.sugary_drink, data.sedentary, data.high_salt],
        backgroundColor: ['#3a7c6e', '#e8956d', '#d68b45', '#c0392b'],
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
    }
  });
}

function renderInsights(insights) {
  const container = document.getElementById('insights-list');
  if (!container || !insights?.length) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:14px;text-align:center;padding:12px">记录更多数据后将显示个性化建议</p>';
    return;
  }
  
  container.innerHTML = insights.map(ins => `
    <div class="insight-item ${ins.type}">
      <span style="font-size:18px">${ins.icon}</span>
      <span>${ins.text}</span>
    </div>
  `).join('');
}
