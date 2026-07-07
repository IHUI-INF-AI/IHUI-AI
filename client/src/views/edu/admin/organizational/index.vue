<template>
  <div class="overview-page">
    <div class="stats-cards">
      <div class="stat-card"><div class="stat-icon" style="background:linear-gradient(135deg,#667eea,#764ba2)"><el-icon><User /></el-icon></div><div class="stat-content"><div class="stat-title">用户总数</div><div class="stat-value">{{ stats.userCount || 0 }}</div><div class="stat-footer">今日新增 <span class="highlight">+{{ stats.todayUserCount || 0 }}</span></div></div></div>
      <div class="stat-card"><div class="stat-icon" style="background:linear-gradient(135deg,#11998e,#38ef7d)"><el-icon><OfficeBuilding /></el-icon></div><div class="stat-content"><div class="stat-title">企业总数</div><div class="stat-value">{{ stats.companyCount || 0 }}</div></div></div>
      <div class="stat-card"><div class="stat-icon" style="background:linear-gradient(135deg,#f093fb,#f5576c)"><el-icon><Grid /></el-icon></div><div class="stat-content"><div class="stat-title">部门总数</div><div class="stat-value">{{ stats.departmentCount || 0 }}</div></div></div>
    </div>
    <div class="charts-row">
      <div class="chart-box"><div class="chart-header">用户状态分布</div><div class="chart-content" id="user-status-chart"></div></div>
      <div class="chart-box"><div class="chart-header">企业用户分布 Top10</div><div class="chart-content" id="org-company-chart"></div></div>
    </div>
  </div>
</template>

<script>
// @ts-nocheck
import { ref, onMounted, onUnmounted, nextTick } from "vue";
import { User, OfficeBuilding, Grid } from '@/lib/lucide-fallback';
import * as echarts from "echarts";
import { statisticsApi } from '@/api/edu/admin-api'
const { getUserCenterStatistics } = statisticsApi;

export default {
  name: "OrganizationalIndex",
  components: { User, OfficeBuilding, Grid },
  setup() {
    const stats = ref({});
    let statusChart = null;
    let companyChart = null;

    const handleResize = () => {
      statusChart?.resize();
      companyChart?.resize();
    };

    const initCharts = () => {
      const statusDom = document.getElementById("user-status-chart");
      const companyDom = document.getElementById("org-company-chart");
      if (!statusDom || !companyDom) return;

      // 获取 DOM 上已存在的实例并销毁
      const existingStatusChart = echarts.getInstanceByDom(statusDom);
      if (existingStatusChart) existingStatusChart.dispose();
      const existingCompanyChart = echarts.getInstanceByDom(companyDom);
      if (existingCompanyChart) existingCompanyChart.dispose();

      statusChart = echarts.init(statusDom);
      const statusData = stats.value.userStatusDistribution || [];
      statusChart.setOption({ tooltip:{trigger:"item"}, legend:{orient:"vertical",right:"10%",top:"center"}, series:[{type:"pie",radius:["40%","70%"],center:["40%","50%"],data:statusData.map(i=>({name:i.statusName,value:i.count})),itemStyle:{borderRadius:4}}] });

      companyChart = echarts.init(companyDom);
      const companyData = stats.value.topCompanies || [];
      companyChart.setOption({ tooltip:{trigger:"axis"}, grid:{top:"5%",left:"30%",right:"10%",bottom:"5%"}, xAxis:{type:"value"}, yAxis:{type:"category",data:companyData.map(i=>i.companyName).reverse(),axisLabel:{width:100,overflow:"truncate"}}, series:[{data:companyData.map(i=>i.userCount).reverse(),type:"bar",itemStyle:{color:"#409EFF",borderRadius:[0,4,4,0]}}] });
    };

    onMounted(() => {
      getUserCenterStatistics((res) => { if(res){stats.value=res;nextTick(initCharts);} });
      window.addEventListener("resize", handleResize);
    });

    onUnmounted(() => {
      window.removeEventListener("resize", handleResize);
      if (statusChart && !statusChart.isDisposed()) statusChart.dispose();
      statusChart = null;
      if (companyChart && !companyChart.isDisposed()) companyChart.dispose();
      companyChart = null;
    });

    return { stats };
  }
};
</script>

<style scoped lang="scss">
.overview-page{padding:20px;min-height:calc(100vh - 120px)}.stats-cards{display:flex;gap:20px;margin-bottom:20px}.stat-card{flex:1;background:#fff;border-radius:12px;padding:20px;display:flex;align-items:center;gap:16px;box-shadow:0 2px 12px rgba(0,0,0,0.04)}.stat-icon{width:56px;height:56px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px;color:#fff}.stat-content{flex:1}.stat-title{font-size:14px;color:#909399;margin-bottom:8px}.stat-value{font-size:28px;font-weight:600;color:#303133}.stat-footer{margin-top:8px;font-size:12px;color:#909399}.stat-footer .highlight{color:#67C23A;font-weight:500}.charts-row{display:flex;gap:20px;margin-bottom:20px}.chart-box{flex:1;background:#fff;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.04)}.chart-header{padding:16px 20px;border-bottom:1px solid #f0f0f0;font-size:16px;font-weight:500}.chart-content{height:280px;padding:10px}
</style>
