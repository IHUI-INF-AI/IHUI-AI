<template>
  <div class="overview-page">
    <div class="stats-cards">
      <div class="stat-card"><div class="stat-icon" style="background:linear-gradient(135deg,#667eea,#764ba2)"><Bell class="h-4 w-4" /></div><div class="stat-content"><div class="stat-title">通知总数</div><div class="stat-value">{{ stats.noticeCount || 0 }}</div><div class="stat-footer">今日新增 <span class="highlight">+{{ stats.todayNoticeCount || 0 }}</span></div></div></div>
      <div class="stat-card"><div class="stat-icon" style="background:linear-gradient(135deg,#11998e,#38ef7d)"><Notification class="h-4 w-4" /></div><div class="stat-content"><div class="stat-title">公告总数</div><div class="stat-value">{{ stats.announcementCount || 0 }}</div><div class="stat-footer">今日新增 <span class="highlight">+{{ stats.todayAnnouncementCount || 0 }}</span></div></div></div>
      <div class="stat-card"><div class="stat-icon" style="background:linear-gradient(135deg,#f093fb,#f5576c)"><ChatLineSquare class="h-4 w-4" /></div><div class="stat-content"><div class="stat-title">私信总数</div><div class="stat-value">{{ stats.privateLetterCount || 0 }}</div><div class="stat-footer">模板 <span class="highlight">{{ stats.templateCount || 0 }}</span></div></div></div>
    </div>
    <div class="charts-row">
      <div class="chart-box full-width"><div class="chart-header">通知趋势（近7天）</div><div class="chart-content" id="message-trend-chart"></div></div>
    </div>
  </div>
</template>

<script>
// @ts-nocheck
import { ref, onMounted, onUnmounted, nextTick } from "vue";
import { Bell, Notification, ChatLineSquare } from '@/lib/lucide-fallback';
import * as echarts from "echarts";
import { statisticsApi } from '@/api/edu/admin-api'
const { getMessageStatistics } = statisticsApi;

export default {
  name: "MessageIndex",
  components: { Bell, Notification, ChatLineSquare },
  setup() {
    const stats = ref({});
    let trendChart = null;

    const handleResize = () => {
      trendChart?.resize();
    };

    const initCharts = () => {
      const trendDom = document.getElementById("message-trend-chart");
      if (!trendDom) return;

      // 获取 DOM 上已存在的实例并销毁
      const existingTrendChart = echarts.getInstanceByDom(trendDom);
      if (existingTrendChart) existingTrendChart.dispose();

      trendChart = echarts.init(trendDom);
      const trendData = stats.value.noticeTrend || [];
      trendChart.setOption({ tooltip:{trigger:"axis"}, grid:{top:"10%",left:"5%",right:"5%",bottom:"15%"}, xAxis:{type:"category",data:trendData.map(i=>i.date)}, yAxis:{type:"value",minInterval:1}, series:[{data:trendData.map(i=>i.count),type:"bar",itemStyle:{color:"#409EFF",borderRadius:[4,4,0,0]}}] });
    };

    onMounted(() => {
      getMessageStatistics((res) => { if(res){stats.value=res;nextTick(initCharts);} });
      window.addEventListener("resize", handleResize);
    });

    onUnmounted(() => {
      window.removeEventListener("resize", handleResize);
      if (trendChart && !trendChart.isDisposed()) trendChart.dispose();
      trendChart = null;
    });

    return { stats };
  }
};
</script>

<style scoped lang="scss">
.overview-page{padding:20px;min-height:calc(100vh - 120px)}.stats-cards{display:flex;gap:20px;margin-bottom:20px}.stat-card{flex:1;background:#fff;border-radius:12px;padding:20px;display:flex;align-items:center;gap:16px;box-shadow:0 2px 12px rgba(0,0,0,0.04)}.stat-icon{width:56px;height:56px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px;color:#fff}.stat-content{flex:1}.stat-title{font-size:14px;color:#909399;margin-bottom:8px}.stat-value{font-size:28px;font-weight:600;color:#303133}.stat-footer{margin-top:8px;font-size:12px;color:#909399}.stat-footer .highlight{color:#67C23A;font-weight:500}.charts-row{display:flex;gap:20px;margin-bottom:20px}.chart-box{flex:1;background:#fff;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.04)}.chart-box.full-width{flex:1}.chart-header{padding:16px 20px;border-bottom:1px solid #f0f0f0;font-size:16px;font-weight:500}.chart-content{height:280px;padding:10px}
</style>
