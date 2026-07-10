<template>
  <div class="overview-page">
    <div class="stats-cards">
      <div class="stat-card">
        <div class="stat-icon lesson-icon"><VideoCamera class="h-4 w-4" /></div>
        <div class="stat-content">
          <div class="stat-title">课程总数</div>
          <div class="stat-value">{{ stats.lessonCount || 0 }}</div>
          <div class="stat-footer">今日新增 <span class="highlight">+{{ stats.todayLessonCount || 0 }}</span></div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon signup-icon"><User class="h-4 w-4" /></div>
        <div class="stat-content">
          <div class="stat-title">报名总数</div>
          <div class="stat-value">{{ stats.signUpCount || 0 }}</div>
          <div class="stat-footer">今日报名 <span class="highlight">+{{ stats.todaySignUpCount || 0 }}</span></div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon complete-icon"><CircleCheck class="h-4 w-4" /></div>
        <div class="stat-content">
          <div class="stat-title">完成学习</div>
          <div class="stat-value">{{ stats.completedCount || 0 }}</div>
          <div class="stat-footer">完成率 <span class="highlight">{{ completionRate }}%</span></div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon time-icon"><Timer class="h-4 w-4" /></div>
        <div class="stat-content">
          <div class="stat-title">总学习时长</div>
          <div class="stat-value">{{ formatTime(stats.totalLearnTime) }}</div>
          <div class="stat-footer">今日 <span class="highlight">{{ formatTime(stats.todayLearnTime) }}</span></div>
        </div>
      </div>
    </div>

    <div class="charts-row">
      <div class="chart-box">
        <div class="chart-header">报名趋势（近7天）</div>
        <div class="chart-content" ref="signupChartRef"></div>
      </div>
      <div class="chart-box">
        <div class="chart-header">学习时长趋势（近7天）</div>
        <div class="chart-content" ref="learntimeChartRef"></div>
      </div>
    </div>

    <div class="charts-row">
      <div class="chart-box">
        <div class="chart-header">热门课程 Top10</div>
        <div class="chart-content" ref="hotChartRef"></div>
      </div>
      <div class="chart-box">
        <div class="chart-header">课程状态分布</div>
        <div class="chart-content" ref="statusChartRef"></div>
      </div>
    </div>

    <div class="extra-stats">
      <div class="extra-item"><span>专题总数</span><strong>{{ stats.topicCount || 0 }}</strong></div>
      <div class="extra-item"><span>分类总数</span><strong>{{ stats.categoryCount || 0 }}</strong></div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, nextTick } from "vue";
import { VideoCamera, User, CircleCheck, Timer } from '@/lib/lucide-fallback';
import * as echarts from "echarts";
import { learnApi } from '@/api/edu/admin-api'
const { getLearnStatistics } = learnApi;

export default {
  name: "LearnIndex",
  components: { VideoCamera, User, CircleCheck, Timer },
  setup() {
    const stats = ref({});
    let signupChart = null;
    let learnChart = null;
    let hotChart = null;
    let statusChart = null;
    let isUnmounted = false;
    let initRetryTimer = null;

    // 使用 ref 获取 DOM 元素
    const signupChartRef = ref(null);
    const learntimeChartRef = ref(null);
    const hotChartRef = ref(null);
    const statusChartRef = ref(null);

    const completionRate = computed(() => {
      if (!stats.value.signUpCount || stats.value.signUpCount === 0) return 0;
      return ((stats.value.completedCount || 0) / stats.value.signUpCount * 100).toFixed(1);
    });

    const formatTime = (seconds) => {
      if (!seconds) return "0小时";
      const hours = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      if (hours > 0) return `${hours}小时${mins}分`;
      return `${mins}分钟`;
    };

    const handleResize = () => {
      signupChart?.resize();
      learnChart?.resize();
      hotChart?.resize();
      statusChart?.resize();
    };

    const initCharts = (retryCount = 0) => {
      // 如果组件已卸载，不再初始化
      if (isUnmounted) return;
      
      // 使用 ref 获取 DOM 元素
      const signupDom = signupChartRef.value;
      const learntimeDom = learntimeChartRef.value;
      const hotDom = hotChartRef.value;
      const statusDom = statusChartRef.value;
      
      // 检查所有 DOM 元素是否存在
      if (!signupDom || !learntimeDom || !hotDom || !statusDom) {
        // 最多重试 5 次，每次间隔 100ms
        if (retryCount < 5) {
          initRetryTimer = setTimeout(() => {
            initCharts(retryCount + 1);
          }, 100);
        }
        return;
      }

      // 获取 DOM 上已存在的实例并销毁
      const existingSignupChart = echarts.getInstanceByDom(signupDom);
      if (existingSignupChart) existingSignupChart.dispose();
      const existingLearnChart = echarts.getInstanceByDom(learntimeDom);
      if (existingLearnChart) existingLearnChart.dispose();
      const existingHotChart = echarts.getInstanceByDom(hotDom);
      if (existingHotChart) existingHotChart.dispose();
      const existingStatusChart = echarts.getInstanceByDom(statusDom);
      if (existingStatusChart) existingStatusChart.dispose();
      
      signupChart = echarts.init(signupDom);
      const signupData = stats.value.signUpTrend || [];
      signupChart.setOption({
        tooltip: { trigger: "axis" },
        grid: { top: "10%", left: "10%", right: "5%", bottom: "15%" },
        xAxis: { type: "category", data: signupData.map(i => i.date) },
        yAxis: { type: "value", minInterval: 1 },
        series: [{ data: signupData.map(i => i.count), type: "line", smooth: true, areaStyle: { opacity: 0.3 }, lineStyle: { color: "#409EFF" }, itemStyle: { color: "#409EFF" } }]
      });

      // 学习时长趋势
      learnChart = echarts.init(learntimeDom);
      const learnData = stats.value.learnTimeTrend || [];
      learnChart.setOption({
        tooltip: { trigger: "axis", formatter: (p) => `${p[0].name}<br/>学习时长: ${Math.floor(p[0].value / 60)}分钟` },
        grid: { top: "10%", left: "10%", right: "5%", bottom: "15%" },
        xAxis: { type: "category", data: learnData.map(i => i.date) },
        yAxis: { type: "value" },
        series: [{ data: learnData.map(i => i.count), type: "bar", itemStyle: { color: "#67C23A", borderRadius: [4, 4, 0, 0] } }]
      });

      // 热门课程
      hotChart = echarts.init(hotDom);
      const hotData = stats.value.hotLessons || [];
      hotChart.setOption({
        tooltip: { trigger: "axis" },
        grid: { top: "5%", left: "30%", right: "10%", bottom: "5%" },
        xAxis: { type: "value" },
        yAxis: { type: "category", data: hotData.map(i => i.lessonName).reverse(), axisLabel: { width: 100, overflow: "truncate" } },
        series: [{ data: hotData.map(i => i.signUpCount).reverse(), type: "bar", itemStyle: { color: "#E6A23C", borderRadius: [0, 4, 4, 0] } }]
      });

      // 状态分布
      statusChart = echarts.init(statusDom);
      const statusData = stats.value.statusDistribution || [];
      statusChart.setOption({
        tooltip: { trigger: "item" },
        legend: { orient: "vertical", right: "10%", top: "center" },
        series: [{ type: "pie", radius: ["40%", "70%"], center: ["40%", "50%"], data: statusData.map(i => ({ name: i.statusName, value: i.count })), itemStyle: { borderRadius: 4 } }]
      });

    };

    onMounted(() => {
      isUnmounted = false;
      getLearnStatistics((res) => {
        if (res && !isUnmounted) {
          stats.value = res;
          nextTick(() => initCharts(0));
        }
      });
      window.addEventListener("resize", handleResize);
    });

    onUnmounted(() => {
      isUnmounted = true;
      if (initRetryTimer) {
        clearTimeout(initRetryTimer);
        initRetryTimer = null;
      }
      window.removeEventListener("resize", handleResize);
      if (signupChart && !signupChart.isDisposed()) signupChart.dispose();
      signupChart = null;
      if (learnChart && !learnChart.isDisposed()) learnChart.dispose();
      learnChart = null;
      if (hotChart && !hotChart.isDisposed()) hotChart.dispose();
      hotChart = null;
      if (statusChart && !statusChart.isDisposed()) statusChart.dispose();
      statusChart = null;
    });

    return { 
      stats, 
      completionRate, 
      formatTime,
      signupChartRef,
      learntimeChartRef,
      hotChartRef,
      statusChartRef
    };
  }
};
</script>

<style scoped lang="scss">
.overview-page { padding: 20px; min-height: calc(100vh - 120px); }
.stats-cards { display: flex; gap: 20px; margin-bottom: 20px; }
.stat-card { flex: 1; background: #fff; border-radius: 12px; padding: 20px; display: flex; align-items: center; gap: 16px; box-shadow: 0 2px 12px rgba(0,0,0,0.04); }
.stat-icon { width: 56px; height: 56px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; color: #fff; }
.lesson-icon { background: linear-gradient(135deg, #667eea, #764ba2); }
.signup-icon { background: linear-gradient(135deg, #11998e, #38ef7d); }
.complete-icon { background: linear-gradient(135deg, #f093fb, #f5576c); }
.time-icon { background: linear-gradient(135deg, #fa709a, #fee140); }
.stat-content { flex: 1; }
.stat-title { font-size: 14px; color: #909399; margin-bottom: 8px; }
.stat-value { font-size: 28px; font-weight: 600; color: #303133; }
.stat-footer { margin-top: 8px; font-size: 12px; color: #909399; }
.stat-footer .highlight { color: #67C23A; font-weight: 500; }
.charts-row { display: flex; gap: 20px; margin-bottom: 20px; }
.chart-box { flex: 1; background: #fff; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.04); }
.chart-header { padding: 16px 20px; border-bottom: 1px solid #f0f0f0; font-size: 16px; font-weight: 500; }
.chart-content { height: 280px; padding: 10px; }
.extra-stats { display: flex; gap: 20px; }
.extra-item { background: #fff; border-radius: 12px; padding: 16px 24px; display: flex; align-items: center; gap: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.04); }
.extra-item span { color: #909399; }
.extra-item strong { font-size: 20px; color: #303133; }
</style>
