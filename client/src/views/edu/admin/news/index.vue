<template>
  <div class="overview-page">
    <div class="stats-cards">
      <div class="stat-card"><div class="stat-icon" style="background:linear-gradient(135deg,#667eea,#764ba2)"><Notebook class="h-4 w-4" /></div><div class="stat-content"><div class="stat-title">新闻总数</div><div class="stat-value">{{ stats.newsCount || 0 }}</div><div class="stat-footer">今日新增 <span class="highlight">+{{ stats.todayNewsCount || 0 }}</span></div></div></div>
      <div class="stat-card"><div class="stat-icon" style="background:linear-gradient(135deg,#11998e,#38ef7d)"><View class="h-4 w-4" /></div><div class="stat-content"><div class="stat-title">总浏览量</div><div class="stat-value">{{ stats.newsViewCount || 0 }}</div><div class="stat-footer">点赞 <span class="highlight">{{ stats.newsLikeCount || 0 }}</span></div></div></div>
    </div>
    <div class="charts-row">
      <div class="chart-box"><div class="chart-header">新闻发布趋势（近7天）</div><div class="chart-content" id="news-trend-chart"></div></div>
      <div class="chart-box"><div class="chart-header">热门新闻 Top10</div><div class="chart-content" id="hot-news-chart"></div></div>
    </div>
  </div>
</template>

<script>
// @ts-nocheck
import { ref, onMounted, onUnmounted, nextTick } from "vue";
import { Notebook, View } from '@/lib/lucide-fallback';
import * as echarts from "echarts";
import { statisticsApi } from '@/api/edu/admin-api'
const { getContentStatistics } = statisticsApi;

export default {
  name: "NewsIndex",
  components: { Notebook, View },
  setup() {
    const stats = ref({});
    let trendChart = null;
    let hotChart = null;

    const handleResize = () => {
      trendChart?.resize();
      hotChart?.resize();
    };

    const initCharts = () => {
      const trendDom = document.getElementById("news-trend-chart");
      const hotDom = document.getElementById("hot-news-chart");
      if (!trendDom || !hotDom) return;

      // 获取 DOM 上已存在的实例并销毁
      const existingTrendChart = echarts.getInstanceByDom(trendDom);
      if (existingTrendChart) existingTrendChart.dispose();
      const existingHotChart = echarts.getInstanceByDom(hotDom);
      if (existingHotChart) existingHotChart.dispose();

      trendChart = echarts.init(trendDom);
      const trendData = stats.value.newsTrend || [];
      trendChart.setOption({ tooltip:{trigger:"axis"}, grid:{top:"10%",left:"10%",right:"5%",bottom:"15%"}, xAxis:{type:"category",data:trendData.map(i=>i.date)}, yAxis:{type:"value",minInterval:1}, series:[{data:trendData.map(i=>i.count),type:"bar",itemStyle:{color:"#67C23A",borderRadius:[4,4,0,0]}}] });

      hotChart = echarts.init(hotDom);
      const hotData = stats.value.hotNews || [];
      hotChart.setOption({ tooltip:{trigger:"axis"}, grid:{top:"5%",left:"30%",right:"10%",bottom:"5%"}, xAxis:{type:"value"}, yAxis:{type:"category",data:hotData.map(i=>i.title).reverse(),axisLabel:{width:100,overflow:"truncate"}}, series:[{data:hotData.map(i=>i.viewNum).reverse(),type:"bar",itemStyle:{color:"#409EFF",borderRadius:[0,4,4,0]}}] });
    };

    onMounted(() => {
      getContentStatistics((res) => { if(res){stats.value=res;nextTick(initCharts);} });
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
