<script setup lang="ts">
import { ref, onErrorCaptured, type ComponentPublicInstance } from 'vue'
import { useI18n } from 'vue-i18n'
import { AlertTriangle, RefreshCw, Home } from '@/lib/lucide-fallback'

interface Props {
  fallback?: boolean
  onError?: (error: Error, instance: ComponentPublicInstance | null, info: string) => void
}

const { t } = useI18n()

const props = withDefaults(defineProps<Props>(), {
  fallback: true,
})

const emit = defineEmits<{
  error: [error: Error, instance: ComponentPublicInstance | null, info: string]
}>()

const hasError = ref(false)
const errorInfo = ref<{
  message: string
  stack?: string
  componentStack?: string
} | null>(null)

onErrorCaptured((error: Error, instance: ComponentPublicInstance | null, info: string) => {
  hasError.value = true
  errorInfo.value = {
    message: error.message,
    stack: error.stack,
    componentStack: info,
  }

  props.onError?.(error, instance, info)
  emit('error', error, instance, info)

  return props.fallback
})

const handleRetry = () => {
  hasError.value = false
  errorInfo.value = null
}

const handleGoHome = () => {
  window.location.href = '/'
}

const handleReload = () => {
  window.location.reload()
}
</script>

<template>
  <slot v-if="!hasError" />
  <div v-else class="error-boundary">
    <div class="error-content">
      <div class="error-icon">
        <AlertTriangle :size="48" />
      </div>
      <h2 class="error-title">{{ t('cmpErrorBoundary.pageError') }}</h2>
      <p class="error-message">{{ errorInfo?.message || t('errorBoundary.unknownError') }}</p>
      <div class="error-actions">
        <el-button type="primary" @click="handleRetry">
          <el-icon><RefreshCw :size="16" /></el-icon>
          {{ t('errorBoundary.retry') }}
        </el-button>
        <el-button @click="handleReload">
          {{ t('errorBoundary.reload') }}
        </el-button>
        <el-button @click="handleGoHome">
          <el-icon><Home :size="16" /></el-icon>
          {{ t('errorBoundary.goHome') }}
        </el-button>
      </div>
      <el-collapse v-if="errorInfo?.stack" class="error-details">
        <el-collapse-item :title="t('errorBoundary.errorDetails')" name="stack">
          <pre class="error-stack">{{ errorInfo.stack }}</pre>
        </el-collapse-item>
      </el-collapse>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.error-boundary {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  padding: 24px;
}

.error-content {
  max-width: 500px;
  text-align: center;
}

.error-icon {
  color: var(--el-color-danger);
  margin-bottom: 16px;
}

.error-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 0 0 8px;
}

.error-message {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin: 0 0 24px;
}

.error-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-bottom: 24px;
}

.error-details {
  text-align: left;

  :deep(.el-collapse-item__header) {
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }
}

.error-stack {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  padding: 12px;
  border-radius: var(--global-border-radius);
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
  max-height: 200px;
}
</style>
