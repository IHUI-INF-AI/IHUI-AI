<template>
  <div class="demo-navigation">
    <h3>{{ t('hardcoded.demo.navigation.组件演示导航') }}</h3>
    <div class="demo-links">
      <router-link to="/" class="demo-link" active-class="active">
        <el-icon><HomeFilled /></el-icon>
        <span>{{ t('hardcoded.demo.navigation.返回首页') }}</span>
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

import { HomeFilled } from '@element-plus/icons-vue'
</script>

<style scoped lang="scss">
.demo-navigation {
  background: var(--el-bg-color-page);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  padding: 16px;
  margin-bottom: 24px;

  h3 {
    margin: 0 0 16px;
    color: var(--el-text-color-primary);
    font-size: 16px;
    font-weight: 600;
  }
}

.demo-links {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.demo-link {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  color: var(--el-text-color-regular);
  text-decoration: none;
  transition: background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease;
  font-size: 14px;

  &:hover {
    background: var(--el-color-primary-light-9);
    border-color: var(--el-color-primary-light-7);
    color: var(--el-color-primary);
  }

  &.active {
    background: var(--el-color-primary);
    border: var(--el-border-width-primary) solid var(--el-color-primary);
    color: var(--el-bg-color-page);
  }

  .el-icon {
    font-size: 16px;
  }
}
</style>
