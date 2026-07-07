<template>
  <div class="overview-page">
    <div class="stats-cards">
      <div class="stat-card"><div class="stat-icon" style="background:linear-gradient(135deg,#667eea,#764ba2)"><el-icon><Coin /></el-icon></div><div class="stat-content"><div class="stat-title">积分项目</div><div class="stat-value">{{ stats.pointCount || 0 }}</div><div class="stat-footer">渠道 <span class="highlight">{{ stats.channelCount || 0 }}</span></div></div></div>
      <div class="stat-card"><div class="stat-icon" style="background:linear-gradient(135deg,#11998e,#38ef7d)"><el-icon><Top /></el-icon></div><div class="stat-content"><div class="stat-title">总发放积分</div><div class="stat-value">{{ stats.totalIncrease || 0 }}</div><div class="stat-footer">今日发放 <span class="highlight">+{{ stats.todayIncrease || 0 }}</span></div></div></div>
      <div class="stat-card"><div class="stat-icon" style="background:linear-gradient(135deg,#f093fb,#f5576c)"><el-icon><Bottom /></el-icon></div><div class="stat-content"><div class="stat-title">总消耗积分</div><div class="stat-value">{{ stats.totalDecrease || 0 }}</div><div class="stat-footer">今日消耗 <span class="highlight">{{ stats.todayDecrease || 0 }}</span></div></div></div>
    </div>
    <div class="charts-row">
      <div class="chart-box"><div class="chart-header">积分发放趋势（近7天）</div><div class="chart-content" id="point-increase-chart"></div></div>
      <div class="chart-box"><div class="chart-header">渠道积分统计</div><div class="chart-content" id="point-channel-chart"></div></div>
    </div>
  </div>
</template>

<script>
// @ts-nocheck
import { ref, onMounted, onUnmounted, nextTick } from "vue";
import { Coin, Top, Bottom } from '@/lib/lucide-fallback';
import * as echarts from "echarts";
import { statisticsApi } from '@/api/edu/admin-api'
const { getPointStatistics } = statisticsApi;

export default {
  name: "PointIndex",
  components: { Coin, Top, Bottom },
  setup() {
    const stats = ref({});
    let trendChart = null;
    let channelChart = null;

    const handleResize = () => {
      trendChart?.resize();
      channelChart?.resize();
    };

    const initCharts = () => {
      const trendDom = document.getElementById("point-increase-chart");
      const channelDom = document.getElementById("point-channel-chart");
      if (!trendDom || !channelDom) return;

      // 获取 DOM 上已存在的实例并销毁
      const existingTrendChart = echarts.getInstanceByDom(trendDom);
      if (existingTrendChart) existingTrendChart.dispose();
      const existingChannelChart = echarts.getInstanceByDom(channelDom);
      if (existingChannelChart) existingChannelChart.dispose();

      trendChart = echarts.init(trendDom);
      const trendData = stats.value.increaseTrend || [];
      trendChart.setOption({ tooltip:{trigger:"axis"}, grid:{top:"10%",left:"10%",right:"5%",bottom:"15%"}, xAxis:{type:"category",data:trendData.map(i=>i.date)}, yAxis:{type:"value"}, series:[{data:trendData.map(i=>i.count),type:"line",smooth:true,areaStyle:{opacity:0.3},itemStyle:{color:"#67C23A"}}] });

      channelChart = echarts.init(channelDom);
      const channelData = stats.value.channelStats || [];
      channelChart.setOption({ tooltip:{trigger:"axis"}, grid:{top:"5%",left:"30%",right:"10%",bottom:"5%"}, xAxis:{type:"value"}, yAxis:{type:"category",data:channelData.map(i=>i.channelName).reverse(),axisLabel:{width:100,overflow:"truncate"}}, series:[{data:channelData.map(i=>i.totalPoints).reverse(),type:"bar",itemStyle:{color:"#E6A23C",borderRadius:[0,4,4,0]}}] });
    };

    onMounted(() => {
      getPointStatistics((res) => { if(res){stats.value=res;nextTick(initCharts);} });
      window.addEventListener("resize", handleResize);
    });

    onUnmounted(() => {
      window.removeEventListener("resize", handleResize);
      if (trendChart && !trendChart.isDisposed()) trendChart.dispose();
      trendChart = null;
      if (channelChart && !channelChart.isDisposed()) channelChart.dispose();
      channelChart = null;
    });

    return { stats };
  }
};
</script>

<style scoped lang="scss">
.overview-page{padding:20px;min-height:calc(100vh - 120px)}.stats-cards{display:flex;gap:20px;margin-bottom:20px}.stat-card{flex:1;background:#fff;border-radius:12px;padding:20px;display:flex;align-items:center;gap:16px;box-shadow:0 2px 12px rgba(0,0,0,0.04)}.stat-icon{width:56px;height:56px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px;color:#fff}.stat-content{flex:1}.stat-title{font-size:14px;color:#909399;margin-bottom:8px}.stat-value{font-size:28px;font-weight:600;color:#303133}.stat-footer{margin-top:8px;font-size:12px;color:#909399}.stat-footer .highlight{color:#67C23A;font-weight:500}.charts-row{display:flex;gap:20px;margin-bottom:20px}.chart-box{flex:1;background:#fff;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.04)}.chart-header{padding:16px 20px;border-bottom:1px solid #f0f0f0;font-size:16px;font-weight:500}.chart-content{height:280px;padding:10px}
</style>
