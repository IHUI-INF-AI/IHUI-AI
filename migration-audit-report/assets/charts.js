(function() {
  var style = getComputedStyle(document.documentElement);
  var accent = style.getPropertyValue('--accent').trim();
  var accent2 = style.getPropertyValue('--accent2').trim();
  var ink = style.getPropertyValue('--ink').trim();
  var muted = style.getPropertyValue('--muted').trim();
  var rule = style.getPropertyValue('--rule').trim();
  var bg2 = style.getPropertyValue('--bg2').trim();
  var danger = style.getPropertyValue('--danger').trim();
  var warn = style.getPropertyValue('--warn').trim();
  var info = style.getPropertyValue('--info').trim();
  var success = style.getPropertyValue('--success').trim();

  // --- Chart 1: Overall Coverage ---
  var chart1 = echarts.init(document.getElementById('chart-coverage'), null, { renderer: 'svg' });
  chart1.setOption({
    animation: false,
    tooltip: { trigger: 'axis', appendToBody: true, axisPointer: { type: 'shadow' } },
    grid: { left: '8%', right: '8%', bottom: '10%', top: '15%' },
    xAxis: {
      type: 'category',
      data: ['后端 API', '前端页面', '数据库表', 'AI 服务'],
      axisLine: { lineStyle: { color: rule } },
      axisLabel: { color: ink, fontSize: 12 }
    },
    yAxis: {
      type: 'value', max: 100,
      axisLine: { lineStyle: { color: rule } },
      axisLabel: { color: muted, formatter: '{value}%' },
      splitLine: { lineStyle: { color: rule } }
    },
    series: [{
      type: 'bar', barWidth: '40%',
      data: [
        { value: 93, itemStyle: { color: success } },
        { value: 91, itemStyle: { color: success } },
        { value: 91, itemStyle: { color: warn } },
        { value: 85, itemStyle: { color: accent2 } }
      ],
      label: { show: true, position: 'top', color: ink, fontSize: 14, fontWeight: 700, formatter: '{c}%' }
    }]
  });
  window.addEventListener('resize', function() { chart1.resize(); });

  // --- Chart 2: Module Coverage ---
  var chart2 = echarts.init(document.getElementById('chart-modules'), null, { renderer: 'svg' });
  chart2.setOption({
    animation: false,
    tooltip: { trigger: 'axis', appendToBody: true, axisPointer: { type: 'shadow' } },
    legend: { data: ['覆盖率'], textStyle: { color: muted }, top: 5 },
    grid: { left: '15%', right: '8%', bottom: '5%', top: '15%' },
    xAxis: { type: 'value', max: 100, axisLine: { lineStyle: { color: rule } }, axisLabel: { color: muted, formatter: '{value}%' }, splitLine: { lineStyle: { color: rule } } },
    yAxis: {
      type: 'category',
      data: ['learn-service', 'live-service', 'resource-service', 'usercenter-service', 'setting-service', 'search-service', 'point-service', 'exam-service', 'content-service', 'member-service', 'auth-service'],
      axisLine: { lineStyle: { color: rule } },
      axisLabel: { color: ink, fontSize: 11 }
    },
    series: [{
      type: 'bar', barWidth: '55%',
      data: [
        { value: 72, itemStyle: { color: danger } },
        { value: 76, itemStyle: { color: warn } },
        { value: 76, itemStyle: { color: warn } },
        { value: 100, itemStyle: { color: success } },
        { value: 100, itemStyle: { color: success } },
        { value: 100, itemStyle: { color: success } },
        { value: 100, itemStyle: { color: success } },
        { value: 100, itemStyle: { color: success } },
        { value: 100, itemStyle: { color: success } },
        { value: 100, itemStyle: { color: success } },
        { value: 100, itemStyle: { color: success } }
      ],
      label: { show: true, position: 'right', color: ink, fontSize: 11, formatter: '{c}%' }
    }]
  });
  window.addEventListener('resize', function() { chart2.resize(); });

  // --- Chart 3: Frontend Coverage ---
  var chart3 = echarts.init(document.getElementById('chart-frontend'), null, { renderer: 'svg' });
  chart3.setOption({
    animation: false,
    tooltip: { trigger: 'item', appendToBody: true },
    legend: { bottom: 5, textStyle: { color: muted } },
    series: [{
      type: 'pie', radius: ['40%', '70%'], center: ['50%', '45%'],
      label: { color: ink, fontSize: 12 },
      data: [
        { value: 156, name: '已覆盖页面', itemStyle: { color: success } },
        { value: 16, name: '缺失页面', itemStyle: { color: danger } },
        { value: 160, name: '新增页面', itemStyle: { color: info } }
      ]
    }]
  });
  window.addEventListener('resize', function() { chart3.resize(); });

  // --- Chart 4: Database ---
  var chart4 = echarts.init(document.getElementById('chart-database'), null, { renderer: 'svg' });
  chart4.setOption({
    animation: false,
    tooltip: { trigger: 'item', appendToBody: true },
    legend: { bottom: 5, textStyle: { color: muted } },
    series: [{
      type: 'pie', radius: ['40%', '70%'], center: ['50%', '45%'],
      label: { color: ink, fontSize: 12, formatter: '{b}: {c} ({d}%)' },
      data: [
        { value: 150, name: '已迁移表', itemStyle: { color: success } },
        { value: 15, name: '缺失(基础设施)', itemStyle: { color: muted } },
        { value: 60, name: '新增表', itemStyle: { color: info } }
      ]
    }]
  });
  window.addEventListener('resize', function() { chart4.resize(); });

  // --- Chart 5: AI Service ---
  var chart5 = echarts.init(document.getElementById('chart-ai'), null, { renderer: 'svg' });
  chart5.setOption({
    animation: false,
    tooltip: { trigger: 'item', appendToBody: true },
    legend: { bottom: 5, textStyle: { color: muted } },
    series: [{
      type: 'pie', radius: ['40%', '70%'], center: ['50%', '45%'],
      label: { color: ink, fontSize: 12, formatter: '{b}: {c} ({d}%)' },
      data: [
        { value: 47, name: '已迁移模块', itemStyle: { color: success } },
        { value: 13, name: '缺失模块', itemStyle: { color: danger } },
        { value: 25, name: '新增模块', itemStyle: { color: info } }
      ]
    }]
  });
  window.addEventListener('resize', function() { chart5.resize(); });

  // --- Chart 6: Gaps by Priority ---
  var chart6 = echarts.init(document.getElementById('chart-gaps'), null, { renderer: 'svg' });
  chart6.setOption({
    animation: false,
    tooltip: { trigger: 'axis', appendToBody: true, axisPointer: { type: 'shadow' } },
    legend: { data: ['后端端点', '前端页面', 'AI模块'], textStyle: { color: muted }, top: 5 },
    grid: { left: '8%', right: '8%', bottom: '10%', top: '15%' },
    xAxis: {
      type: 'category', data: ['P0 (必须补齐)', 'P1 (建议补齐)', 'P2 (可选补齐)'],
      axisLine: { lineStyle: { color: rule } },
      axisLabel: { color: ink, fontSize: 12 }
    },
    yAxis: { type: 'value', axisLine: { lineStyle: { color: rule } }, axisLabel: { color: muted }, splitLine: { lineStyle: { color: rule } } },
    series: [
      { name: '后端端点', type: 'bar', data: [20, 5, 10], itemStyle: { color: danger }, label: { show: true, position: 'top', color: ink, fontSize: 11 } },
      { name: '前端页面', type: 'bar', data: [3, 7, 2], itemStyle: { color: accent2 }, label: { show: true, position: 'top', color: ink, fontSize: 11 } },
      { name: 'AI模块', type: 'bar', data: [2, 4, 2], itemStyle: { color: info }, label: { show: true, position: 'top', color: ink, fontSize: 11 } }
    ]
  });
  window.addEventListener('resize', function() { chart6.resize(); });

})();
