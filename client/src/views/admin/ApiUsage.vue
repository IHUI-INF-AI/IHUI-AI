<template>
  <div class="api-platform-usage-page" v-loading="loading">
    <h2 class="page-title">{{ t('apiMgmt.usage.title', 'API 使用统计 (接入 UsageTopStats)') }}</h2>
    <p class="page-subtitle">{{ t('apiMgmt.usage.subtitle', '查看 API 调用量、TOP 分组/延迟/应用统计') }}</p>

    <div class="toolbar">
      <el-button @click="reload">
        {{ t('common.refresh', '刷新') }}
      </el-button>
    </div>

    <UsageTopStats />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import UsageTopStats from '@/components/api/UsageTopStats.vue'

defineOptions({ name: 'AdminApiUsage' })

const { t } = useI18n()
const loading = ref(false)

const reload = () => {
  loading.value = true
  setTimeout(() => {
    loading.value = false
    window.location.reload()
  }, 300)
}
</script>

<style scoped lang="scss">
.api-platform-usage-page {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  margin: 0 0 8px;
  color: var(--el-text-color-primary);
}

.page-subtitle {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin: 0 0 24px;
}

.toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
}
</style>
