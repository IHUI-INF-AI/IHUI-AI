<template>
  <div class="user-developer">
    <h3 class="section-title">{{ t('userComponents.developer.title') }}</h3>
    <div class="developer-content">
      <div class="api-info">
        <h4>API {{ t('commonText.view') }}</h4>
        <div class="api-key-display">
          <el-input
            v-model="maskedApiKey"
            readonly
            type="password"
            show-password
          />
          <el-button type="primary" @click="handleCopyKey">{{ t('userComponents.developer.copy') }}</el-button>
          <el-button @click="handleRegenerate">{{ t('userComponents.developer.regenerate') }}</el-button>
        </div>
      </div>
      
      <div class="api-stats">
        <h4>API {{ t('userComponents.statistics.title') }}</h4>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-value">{{ stats.totalCalls || 0 }}</span>
            <span class="stat-label">{{ t('userComponents.developer.totalCalls') }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ stats.remainingQuota || 0 }}</span>
            <span class="stat-label">{{ t('userComponents.developer.remainingQuota') }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ stats.successRate || 0 }}%</span>
            <span class="stat-label">{{ t('userComponents.developer.successRate') }}</span>
          </div>
        </div>
      </div>
      
      <div class="api-docs">
        <h4>API {{ t('documentCenter.title') }}</h4>
        <el-button type="primary" @click="handleViewDocs">{{ t('userComponents.developer.viewDocs') }}</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface DeveloperStats {
  totalCalls?: number
  remainingQuota?: number
  successRate?: number
}

const props = defineProps<{
  apiKey?: string
  stats?: DeveloperStats
}>()

const emit = defineEmits<{
  (e: 'copy-key'): void
  (e: 'regenerate'): void
  (e: 'view-docs'): void
}>()

const maskedApiKey = computed(() => {
  if (!props.apiKey) return ''
  return props.apiKey.substring(0, 8) + '...' + props.apiKey.substring(props.apiKey.length - 4)
})

const handleCopyKey = () => {
  if (!props.apiKey) {
    ElMessage.warning(t('commonText.noData'))
    return
  }
  navigator.clipboard.writeText(props.apiKey).then(() => {
    ElMessage.success(t('commonText.success'))
  }).catch(() => {
    ElMessage.error(t('commonText.failed'))
  })
  emit('copy-key')
}

const handleRegenerate = () => {
  emit('regenerate')
}

const handleViewDocs = () => {
  emit('view-docs')
}
</script>

<style scoped>
.user-developer {
  background: var(--bg-card);
  border-radius: var(--global-border-radius);
  padding: 24px;
  }

.section-title {
  margin: 0 0 20px;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.developer-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.api-info h4,
.api-stats h4,
.api-docs h4 {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.api-key-display {
  display: flex;
  gap: 12px;
  align-items: center;
}

.api-key-display .el-input {
  flex: 1;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.stat-item {
  text-align: center;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: var(--global-border-radius);
}

.stat-value {
  display: block;
  font-size: 24px;
  font-weight: 700;
  color: var(--primary-color);
  margin-bottom: 4px;
}

.stat-label {
  font-size: 14px;
  color: var(--text-secondary);
}

.api-docs {
  padding-top: 16px;
  border-top: var(--unified-border);
}
</style>
