<template>
  <div class="icp-record-page">
    <SettingsPageLayout title="ICP备案">
      <div class="icp-record__card">
        <div class="icp-record__label">ICP备案/许可证号</div>
        <div class="icp-record__value">吉ICP备2025027274号-7A</div>
      </div>
    </SettingsPageLayout>
  </div>
</template>

<script setup lang="ts">
import SettingsPageLayout from './SettingsPageLayout.vue'
</script>

<style lang="scss" scoped>
@use '@/styles/_breakpoints.scss' as bp;

.icp-record-page {
  min-height: 100vh;
}

.icp-record__card {
  background-color: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  padding: 16px 12px;

  @include bp.min-width('tablet') {
    padding: 20px 16px;
  }
}

.icp-record__label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
}

.icp-record__value {
  font-size: 16px;
  color: var(--el-text-color-primary);
  font-weight: 500;

  @include bp.min-width('tablet') {
    font-size: 17px;
  }
}
</style>
