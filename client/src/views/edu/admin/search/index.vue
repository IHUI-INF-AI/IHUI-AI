<template>
  <div class="overview-page">
    <div class="info-section">
      <div class="info-card">
        <div class="info-header"><el-icon><Search /></el-icon> 搜索管理概览</div>
        <div class="info-content">
          <div class="info-item"><span class="label">热词管理</span><span class="value">配置搜索热词</span></div>
          <div class="info-item"><span class="label">搜索内容</span><span class="value">管理可搜索的内容</span></div>
        </div>
      </div>
      <div class="info-card">
        <div class="info-header"><el-icon><TrendCharts /></el-icon> 快捷入口</div>
        <div class="info-content">
          <el-button type="primary" @click="$router.push('/admin/edu/search/hot-word')">热词管理</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
// @ts-nocheck
import { Search, TrendCharts } from '@/lib/lucide-fallback';

export default {
  name: "SearchIndex",
  components: { Search, TrendCharts }
};
</script>

<style scoped lang="scss">
.overview-page{padding:20px;min-height:calc(100vh - 120px)}.info-section{display:flex;gap:20px}.info-card{flex:1;background:#fff;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.04);overflow:hidden}.info-header{padding:16px 20px;border-bottom:1px solid #f0f0f0;font-size:16px;font-weight:500;display:flex;align-items:center;gap:8px}.info-content{padding:20px}.info-item{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #f5f5f5}.info-item:last-child{border-bottom:none}.info-item .label{color:#909399}.info-item .value{color:#303133;font-weight:500}
</style>
