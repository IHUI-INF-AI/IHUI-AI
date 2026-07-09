<template>
  <div class="overview-page">
    <div class="info-section">
      <div class="info-card">
        <div class="info-header"><Setting class="h-4 w-4" /> 系统设置概览</div>
        <div class="info-content">
          <div class="info-item"><span class="label">协议管理</span><span class="value">用户协议、隐私政策等</span></div>
          <div class="info-item"><span class="label">轮播图管理</span><span class="value">首页轮播图配置</span></div>
        </div>
      </div>
      <div class="info-card">
        <div class="info-header"><InfoFilled class="h-4 w-4" /> 快捷入口</div>
        <div class="info-content">
          <Button variant="default" @click="$router.push('/admin/edu/setting/agreement')">协议管理</Button>
          <Button variant="outline" @click="$router.push('/admin/edu/setting/carousel')">轮播图管理</Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
// @ts-nocheck
import { Setting, InfoFilled } from '@/lib/lucide-fallback';
import Button from '@/components/ui/Button.vue';

export default {
  name: "SettingIndex",
  components: { Setting, InfoFilled, Button }
};
</script>

<style scoped lang="scss">
.overview-page{padding:20px;min-height:calc(100vh - 120px)}.info-section{display:flex;gap:20px}.info-card{flex:1;background:#fff;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.04);overflow:hidden}.info-header{padding:16px 20px;border-bottom:1px solid #f0f0f0;font-size:16px;font-weight:500;display:flex;align-items:center;gap:8px}.info-content{padding:20px}.info-item{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #f5f5f5}.info-item:last-child{border-bottom:none}.info-item .label{color:#909399}.info-item .value{color:#303133;font-weight:500}
</style>
