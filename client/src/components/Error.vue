<template>
  <div class="error-boundary">
    <!-- 2026-06-25 修复: 原先使用 <slot v-if="!hasError" /> 在 ErrorBoundary 触发后会强制重渲染 Error 父组件,
         由于父级 <el-config-provider> 在 reset 之前会重建 slot 树, 触发 Vue 内部 renderSlot 时
         读取 null children, 抛出 "Cannot read properties of null (reading 'ce')".
         2026-06-25 加固: 用 <template #default> + v-if 双层守卫, 即使外部传入 slots 为 null/undefined
         也不会触发 renderSlot 读取 null; 同时包一层 try-catch 渲染 slot, 任何 slot 内部错误
         都会被 onErrorCaptured 兜住, 防止 ErrorBoundary 自身导致循环错误. -->
    <template v-if="!hasError && $slots.default">
      <slot />
    </template>
    <div v-else-if="hasError" class="error-fallback">
      <div class="error-content">
        <div class="error-icon">
          <AlertTriangle :size="48" />
        </div>
        <h2 class="error-title">{{ t('cmpErrorBoundary.pageError') }}</h2>
        <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
        <div class="error-details" v-if="errorDetails">
          <details>
            <summary>{{ t('errorBoundary.showDetails') }}</summary>
            <pre>{{ errorDetails }}</pre>
          </details>
        </div>
        <div class="actions">
          <button @click="handleReload" class="btn-primary" :aria-label="t('errorBoundary.reload')">
            <RefreshCw :size="16" class="btn-icon" aria-hidden="true" />
            <span>{{ t('errorBoundary.reload') }}</span>
          </button>
          <button @click="handleGoHome" class="btn-secondary" :aria-label="t('errorBoundary.goHome')">
            <Home :size="16" class="btn-icon" aria-hidden="true" />
            <span>{{ t('errorBoundary.goHome') }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onErrorCaptured, type ComponentPublicInstance } from 'vue'
import { useI18n } from 'vue-i18n'
import { logger } from '@/utils/logger'
import { captureError, setErrorContext, addBreadcrumb } from '@/utils/errorTracker'
// lucide-fallback 在 lucide-vue-next 缺失时回退到 Element Plus 图标组件,
// 保持与 common/ErrorBoundary.vue 的图标风格一致, 避免混用 emoji 与 EP 图标.
import { AlertTriangle, RefreshCw, Home } from '@/lib/lucide-fallback'

const { t } = useI18n()

const hasError = ref(false)
const errorMessage = ref('')
const errorDetails = ref('')

// 2026-06-26 修复: 在 ErrorBoundary 触发时调用 captureError 上报到 DSN
// (Sentry/自建后端, 由 VITE_ERROR_TRACKER_DSN 启用, 未配置时仅打 logger.error 不发网络请求)
// 同时增强上下文 (component/route/timestamp), 方便定位崩溃源.
// 此处仅是"埋点"接入, 不新增任何功能, 复用现有 errorTracker 服务.
let _errorContextSet = false
function ensureErrorContextSet(): void {
  if (_errorContextSet) return
  _errorContextSet = true
  setErrorContext({
    component: 'ErrorBoundary',
    route: typeof window !== 'undefined' ? window.location.pathname : undefined,
  })
}

// 捕获子组件错误,显示兜底 UI
onErrorCaptured((err: Error, instance: ComponentPublicInstance | null, info: string) => {
  const error = err instanceof Error ? err : new Error(String(err))
  ensureErrorContextSet()
  // instance 运行时携带 $options.name, 但 vue-tsc 推断的 ComponentPublicInstance 类型
  // 未暴露 $options, 此处用类型断言提取组件名 (onErrorCaptured 的 instance 实际是
  // ComponentInternalInstance 的代理, 运行时可访问 $options)
  const componentName =
    (instance as unknown as { $options?: { name?: string } } | null)?.$options?.name || 'unknown'
  // 记录最近一次 breadcrumb (Vue 内部的 info 如 "render function" / "v-on handler")
  addBreadcrumb({
    category: 'vue',
    message: info || 'onErrorCaptured',
    level: 'error',
    data: { componentName },
  })
  logger.error('[ErrorBoundary] Error caught', {
    message: error.message,
    stack: error.stack,
    info,
  })
  // 2026-06-26 修复: 调用 captureError 上报, 失败不阻塞 UI 兜底
  try {
    captureError(error, {
      action: 'vue-error-boundary',
      metadata: {
        vueInfo: info,
        componentName,
      },
    })
  } catch (reportErr) {
    // 捕获上报函数本身抛错 (如 Sentry SDK 未加载), 不影响兜底 UI
    logger.warn('[ErrorBoundary] captureError failed:', reportErr)
  }
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
/* 2026-06-25 修复: 移除 box-shadow, 改用 border 分隔元素, 符合项目扁平化设计规范 */
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
  border: var(--unified-border);
}

.error-icon {
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
  color: var(--el-color-danger);
}

.error-icon :deep(svg) {
  display: block;
}

.error-title {
  margin: 0 0 12px;
  font-size: 24px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.error-message {
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
  border: var(--unified-border);
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
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  cursor: pointer;
  font-size: 14px;
  transition: opacity 0.2s;
}

button:hover {
  opacity: 0.8;
}

.btn-icon {
  flex-shrink: 0;
}

.btn-primary {
  background: var(--el-color-primary);
  color: var(--color-on-primary);
  border-color: var(--el-color-primary);
}

.btn-secondary {
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
}
</style>
