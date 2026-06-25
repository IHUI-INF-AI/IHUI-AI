<template>
  <div class="error-boundary">
    <!-- 2026-06-24 修复: 原先使用 <slot v-if="!hasError" /> 在 ErrorBoundary 触发后会强制重渲染 Error 父组件,
         由于父级 <el-config-provider> 在 reset 之前会重建 slot 树, 触发 Vue 内部 renderSlot 时
         读取 null children, 抛出 "Cannot read properties of null (reading 'ce')".
         改为外层 v-if 包裹更稳健: 整个子节点在 hasError=true 时不渲染, 避免空 slot 调用. -->
    <slot v-if="!hasError" />
    <div v-else class="error-fallback">
      <div class="error-content">
        <div class="error-icon">⚠️</div>
        <h2>{{ t('app.errorTitle') || '出错了' }}</h2>
        <p v-if="errorMessage">{{ errorMessage }}</p>
        <div class="error-details" v-if="errorDetails">
          <details>
            <summary>{{ t('app.showErrorDetails') || '显示错误详情' }}</summary>
            <pre>{{ errorDetails }}</pre>
          </details>
        </div>
        <div class="actions">
          <button @click="handleReload" class="btn-primary">
            {{ t('app.reload') || '重新加载' }}
          </button>
          <button @click="handleGoHome" class="btn-secondary">
            {{ t('app.goHome') || '返回首页' }}
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
  errorMessage.value = error.message || t('app.unknownError') || '未知错误'
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
  box-shadow: var(--global-box-shadow);
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
  color: var(--color-on-primary);
}

.btn-secondary {
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
}
</style>
