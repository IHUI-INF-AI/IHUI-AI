<script setup lang="ts">
import { ref, onErrorCaptured, type ComponentPublicInstance } from 'vue'
import { useI18n } from 'vue-i18n'
import { AlertTriangle, RefreshCw, Home, ChevronDown } from '@/lib/lucide-fallback'

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

const showDetails = ref(false)

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
  showDetails.value = false
}

const handleGoHome = () => {
  window.location.href = '/'
}

const handleReload = () => {
  window.location.reload()
}

const toggleDetails = () => {
  showDetails.value = !showDetails.value
}
</script>

<template>
  <slot v-if="!hasError" />
  <div v-else class="error-boundary">
    <div class="error-card">
      <div class="error-icon-wrap">
        <div class="error-icon-bg">
          <AlertTriangle :size="32" class="error-icon" />
        </div>
      </div>

      <h2 class="error-title">{{ t('cmpErrorBoundary.pageError') }}</h2>

      <p class="error-message">
        {{ errorInfo?.message || t('errorBoundary.unknownError') }}
      </p>

      <div class="error-actions">
        <button
          type="button"
          class="btn btn-primary"
          :aria-label="t('errorBoundary.retry')"
          @click="handleRetry"
        >
          <RefreshCw :size="16" class="btn-icon" aria-hidden="true" />
          <span class="btn-text">{{ t('errorBoundary.retry') }}</span>
        </button>

        <button
          type="button"
          class="btn btn-secondary"
          :aria-label="t('errorBoundary.reload')"
          @click="handleReload"
        >
          <span class="btn-text">{{ t('errorBoundary.reload') }}</span>
        </button>

        <button
          type="button"
          class="btn btn-ghost"
          :aria-label="t('errorBoundary.goHome')"
          @click="handleGoHome"
        >
          <Home :size="16" class="btn-icon" aria-hidden="true" />
          <span class="btn-text">{{ t('errorBoundary.goHome') }}</span>
        </button>
      </div>

      <div v-if="errorInfo?.stack" class="error-details">
        <button
          type="button"
          class="details-toggle"
          :aria-expanded="showDetails"
          :aria-label="t('errorBoundary.errorDetails')"
          @click="toggleDetails"
        >
          <ChevronDown
            :size="14"
            class="chevron"
            :class="{ rotated: showDetails }"
            aria-hidden="true"
          />
          <span>{{ t('errorBoundary.errorDetails') }}</span>
        </button>
        <pre v-if="showDetails" class="error-stack">{{ errorInfo.stack }}</pre>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.error-boundary {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 200px);
  padding: 32px 16px;
  width: 100%;
  box-sizing: border-box;
}

.error-card {
  width: 100%;
  max-width: 480px;
  padding: 32px 28px;
  background-color: var(--color-white-90);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.error-icon-wrap {
  margin-bottom: 20px;
}

.error-icon-bg {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background-color: var(--el-color-danger-light-9, #fef0f0);
  color: var(--el-color-danger);
}

.error-icon {
  display: block;
}

.error-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 0 0 8px;
  line-height: 1.4;
}

.error-message {
  font-size: 14px;
  color: var(--el-text-color-regular);
  margin: 0 0 24px;
  line-height: 1.6;
  max-width: 360px;
  word-break: break-word;
}

.error-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  margin-bottom: 16px;
  width: 100%;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 88px;
  height: 36px;
  padding: 0 16px;
  font-size: 14px;
  font-weight: 500;
  line-height: 1;
  border-radius: var(--global-border-radius);
  border: 1px solid transparent;
  cursor: pointer;
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
  outline: none;
  white-space: nowrap;
  user-select: none;
  box-sizing: border-box;
}

.btn:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}

.btn-primary {
  background-color: var(--el-color-primary);
  color: #fff;
  border-color: var(--el-color-primary);
}

.btn-primary:hover {
  background-color: var(--el-color-primary-light-3, #66b1ff);
  border-color: var(--el-color-primary-light-3, #66b1ff);
}

.btn-primary:active {
  background-color: var(--el-color-primary-dark-2, #337ecc);
  border-color: var(--el-color-primary-dark-2, #337ecc);
}

.btn-secondary {
  background-color: var(--el-fill-color-blank, #fff);
  color: var(--el-text-color-regular);
  border-color: var(--el-border-color, #dcdfe6);
}

.btn-secondary:hover {
  color: var(--el-color-primary);
  border-color: var(--el-color-primary-light-5, #c0d8ff);
  background-color: var(--el-color-primary-light-9, #ecf5ff);
}

.btn-secondary:active {
  color: var(--el-color-primary-dark-2, #337ecc);
  border-color: var(--el-color-primary-dark-2, #337ecc);
}

.btn-ghost {
  background-color: transparent;
  color: var(--el-text-color-regular);
  border-color: transparent;
}

.btn-ghost:hover {
  background-color: var(--el-fill-color-light, #f5f7fa);
  color: var(--el-text-color-primary);
}

.btn-icon {
  flex-shrink: 0;
  display: block;
}

.btn-text {
  display: inline-block;
  line-height: 1;
}

.error-details {
  width: 100%;
  text-align: left;
  border-top: var(--unified-border);
  padding-top: 16px;
  margin-top: 8px;
}

.details-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  background: transparent;
  border: none;
  cursor: pointer;
  outline: none;
  transition: color 0.2s ease;
}

.details-toggle:hover {
  color: var(--el-color-primary);
}

.details-toggle:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
  border-radius: 2px;
}

.chevron {
  transition: transform 0.2s ease;
}

.chevron.rotated {
  transform: rotate(180deg);
}

.error-stack {
  font-size: 12px;
  color: var(--el-text-color-regular);
  background-color: var(--el-fill-color-light, #f5f7fa);
  padding: 12px;
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 8px 0 0;
  max-height: 200px;
  line-height: 1.5;
}

:where(html.dark) .error-card {
  background-color: var(--color-white-10);
  border: var(--unified-border);
}

:where(html.dark) .error-icon-bg {
  background-color: rgba(245, 108, 108, 0.15);
}

:where(html.dark) .btn-secondary {
  background-color: var(--el-fill-color-blank, transparent);
}

:where(html.dark) .btn-ghost:hover {
  background-color: var(--el-fill-color-light, #2a2a2a);
}

:where(html.dark) .error-stack {
  background-color: var(--el-fill-color-light, #2a2a2a);
}

@media (width <= 480px) {
  .error-boundary {
    padding: 16px 12px;
  }

  .error-card {
    padding: 24px 20px;
  }

  .error-actions {
    flex-direction: column;
    width: 100%;
  }

  .btn {
    width: 100%;
  }
}
</style>
