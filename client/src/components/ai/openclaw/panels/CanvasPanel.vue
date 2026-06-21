<template>
  <div class="openclaw-panel-content">
    <div class="openclaw-placeholder-card">
      <p class="openclaw-desc">{{ t('floatingChat.openclaw.canvasDesc') }}</p>
      <el-button type="primary" size="small" disabled>{{ t('floatingChat.openclaw.openCanvas') }}</el-button>
      <p class="openclaw-hint">{{ t('floatingChat.openclaw.canvasHint') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
</script>

<style lang="scss" scoped>
/* 共用样式见 styles/_openclaw-panels.scss */
</style>
