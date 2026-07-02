<template>
  <div class="error-boundary">
    <slot v-if="!hasError" />
    <div v-else class="error-fallback">
      <div class="error-content">
        <div class="error-icon"><AlertTriangle /></div>
        <h2 class="error-title">{{ t('cmpErrorBoundary.pageError') }}</h2>
        <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
        <div class="error-details" v-if="errorDetails">
          <details>
            <summary>{{ t('errorBoundary.showDetails') }}</summary>
            <pre>{{ errorDetails }}</pre>
          </details>
        </div>
        <div class="actions">
          <button @click="handleReload" class="btn-primary">
            <RefreshCw /> {{ t('errorBoundary.reload') }}
          </button>
          <button @click="handleGoHome" class="btn-secondary">
            <Home /> {{ t('errorBoundary.goHome') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue'
import { useI18n } from 'vue-i18n'
import { logger } from '@/utils/logger'
import { AlertTriangle, RefreshCw, Home } from '@/lib/lucide-fallback'

const { t } = useI18n()

const hasError = ref(false)
const errorMessage = ref('')
const errorDetails = ref('')

// 捕获子组件错误,显示兜底 UI
onErrorCaptured((err: Error) => {
  const error = err instanceof Error ? err : new Error(String(err))
  logger.error('[ErrorBoundary] Error caught', {
    message: error.message,
    stack: error.stack,
  })
  hasError.value = true
  errorMessage.value = error.message || t('errorBoundary.unknownError')
  errorDetails.value = error.stack || ''
  return false
})

const handleReload = () => {
  window.location.reload()
}

const handleGoHome = () => {
  window.location.href = '/'
}

const resetError = () => {
  hasError.value = false
  errorMessage.value = ''
  errorDetails.value = ''
}

defineExpose({
  resetError,
})
</script>

<style scoped>
.error-boundary {
  width: 100%;
  min-height: calc(100vh - 60px);
}

.error-fallback {
  width: 100%;
  min-height: calc(100vh - 60px);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-bg-color);
  padding: 40px;
}

.error-content {
  text-align: center;
  max-width: 100%;
  background: var(--el-bg-color);
  padding: 40px;
  border-radius: var(--global-border-radius);
}

.error-icon {
  font-size: 64px;
  margin-bottom: 20px;
}

h2 {
  margin: 0 0 12px;
  font-size: 24px;
  color: var(--el-text-color-primary);
}

p {
  margin: 0 0 24px;
  color: var(--el-text-color-regular);
  font-size: 14px;
}

.error-details {
  margin-bottom: 24px;
  text-align: left;
}

.error-details details {
  background: var(--el-fill-color-light);
  padding: 12px;
  border-radius: var(--global-border-radius);
  cursor: pointer;
}

.error-details summary {
  font-size: 14px;
  color: var(--el-text-color-regular);
  user-select: none;
}

.error-details pre {
  margin-top: 12px;
  padding: 12px;
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  font-size: 12px;
  color: var(--el-text-color-regular);
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

button {
  padding: 10px 20px;
  border: none;
  border-radius: var(--global-border-radius);
  cursor: pointer;
  font-size: 14px;
  transition: opacity 0.2s;
}

button:hover {
  opacity: 0.8;
}

.btn-primary {
  background: var(--el-color-primary);
  color: var(--el-color-white);
}

.btn-secondary {
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
}
</style>
