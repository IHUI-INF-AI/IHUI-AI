<template>
  <div class="overview-page">
    <div class="stats-cards">
      <div class="stat-card"><div class="stat-icon" style="background:linear-gradient(135deg,#667eea,#764ba2)"><VideoPlay class="h-4 w-4" /></div><div class="stat-content"><div class="stat-title">直播总数</div><div class="stat-value">{{ stats.channelCount || 0 }}</div><div class="stat-footer">今日新增 <span class="highlight">+{{ stats.todayChannelCount || 0 }}</span></div></div></div>
      <div class="stat-card"><div class="stat-icon" style="background:linear-gradient(135deg,#11998e,#38ef7d)"><VideoPause class="h-4 w-4" /></div><div class="stat-content"><div class="stat-title">活跃直播</div><div class="stat-value">{{ stats.activeChannelCount || 0 }}</div><div class="stat-footer">分类 <span class="highlight">{{ stats.categoryCount || 0 }}</span></div></div></div>
      <div class="stat-card"><div class="stat-icon" style="background:linear-gradient(135deg,#f093fb,#f5576c)"><Bell class="h-4 w-4" /></div><div class="stat-content"><div class="stat-title">订阅总数</div><div class="stat-value">{{ stats.subscribeCount || 0 }}</div><div class="stat-footer">今日订阅 <span class="highlight">+{{ stats.todaySubscribeCount || 0 }}</span></div></div></div>
    </div>
    <div class="charts-row">
      <div class="chart-box"><div class="chart-header">订阅趋势（近7天）</div><div class="chart-content" id="live-trend-chart"></div></div>
      <div class="chart-box"><div class="chart-header">热门直播 Top10</div><div class="chart-content" id="hot-live-chart"></div></div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, nextTick } from "vue";
import { VideoPlay, VideoPause, Bell } from '@/lib/lucide-fallback';
import * as echarts from "echarts";
import { statisticsApi } from '@/api/edu/admin-api'
const { getLiveStatistics } = statisticsApi;

export default {
  name: "LiveIndex",
  components: { VideoPlay, VideoPause, Bell },
  setup() {
    const stats = ref({});
    let trendChart = null;
    let hotChart = null;

    const handleResize = () => {
      trendChart?.resize();
      hotChart?.resize();
    };

    const initCharts = () => {
      const trendDom = document.getElementById("live-trend-chart");
      const hotDom = document.getElementById("hot-live-chart");
      if (!trendDom || !hotDom) return;

      // 获取 DOM 上已存在的实例并销毁
      const existingTrendChart = echarts.getInstanceByDom(trendDom);
      if (existingTrendChart) existingTrendChart.dispose();
      const existingHotChart = echarts.getInstanceByDom(hotDom);
      if (existingHotChart) existingHotChart.dispose();

      trendChart = echarts.init(trendDom);
      const trendData = stats.value.subscribeTrend || [];
      trendChart.setOption({ tooltip:{trigger:"axis"}, grid:{top:"10%",left:"10%",right:"5%",bottom:"15%"}, xAxis:{type:"category",data:trendData.map(i=>i.date)}, yAxis:{type:"value",minInterval:1}, series:[{data:trendData.map(i=>i.count),type:"bar",itemStyle:{color:"#67C23A",borderRadius:[4,4,0,0]}}] });

      hotChart = echarts.init(hotDom);
      const hotData = stats.value.hotChannels || [];
      hotChart.setOption({ tooltip:{trigger:"axis"}, grid:{top:"5%",left:"30%",right:"10%",bottom:"5%"}, xAxis:{type:"value"}, yAxis:{type:"category",data:hotData.map(i=>i.channelName).reverse(),axisLabel:{width:100,overflow:"truncate"}}, series:[{data:hotData.map(i=>i.subscribeCount).reverse(),type:"bar",itemStyle:{color:"#409EFF",borderRadius:[0,4,4,0]}}] });
    };

    onMounted(() => {
      getLiveStatistics((res) => { if(res){stats.value=res;nextTick(initCharts);} });
      window.addEventListener("resize", handleResize);
    });

    onUnmounted(() => {
      window.removeEventListener("resize", handleResize);
      if (trendChart && !trendChart.isDisposed()) trendChart.dispose();
      trendChart = null;
      if (hotChart && !hotChart.isDisposed()) hotChart.dispose();
      hotChart = null;
    });

    return { stats };
  }
};
</script>

<style scoped lang="scss">
.overview-page{padding:20px;min-height:calc(100vh - 120px)}.stats-cards{display:flex;gap:20px;margin-bottom:20px}.stat-card{flex:1;background:#fff;border-radius:12px;padding:20px;display:flex;align-items:center;gap:16px;box-shadow:0 2px 12px rgba(0,0,0,0.04)}.stat-icon{width:56px;height:56px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px;color:#fff}.stat-content{flex:1}.stat-title{font-size:14px;color:#909399;margin-bottom:8px}.stat-value{font-size:28px;font-weight:600;color:#303133}.stat-footer{margin-top:8px;font-size:12px;color:#909399}.stat-footer .highlight{color:#67C23A;font-weight:500}.charts-row{display:flex;gap:20px;margin-bottom:20px}.chart-box{flex:1;background:#fff;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.04)}.chart-header{padding:16px 20px;border-bottom:1px solid #f0f0f0;font-size:16px;font-weight:500}.chart-content{height:280px;padding:10px}
</style>
