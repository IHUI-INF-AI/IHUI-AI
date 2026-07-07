<template>
  <Transition name="banner-fade">
    <div
      v-if="testState !== 'idle'"
      class="test-banner"
      :class="`test-banner--${testState}`"
    >
      <div class="test-banner__icon">
        <component
          :is="iconComponent"
          v-if="!isTesting"
          class="status-icon"
        />
        <Loader2 v-else class="status-icon status-icon--spin" />
      </div>
      <div class="test-banner__content">
        <div class="test-banner__title">{{ titleText }}</div>
        <div v-if="subtitleText" class="test-banner__subtitle">{{ subtitleText }}</div>
        <div
          v-if="showDetailToggle"
          class="test-banner__detail-toggle"
          @click="showDetail = !showDetail"
        >
          {{ showDetail ? t('models.hideDetail') : t('models.viewDetail') }}
          <component :is="showDetail ? ArrowUpIcon : ArrowDown" class="detail-arrow" />
        </div>
        <div v-if="showDetail && detailText" class="test-banner__detail">
          <pre>{{ detailText }}</pre>
        </div>
      </div>
      <div class="test-banner__close" @click="$emit('close')">
        <XIcon class="close-icon" />
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { CheckCircle, XCircle, AlertTriangle, Loader2, X as XIcon, ArrowDown, ArrowUpIcon } from '@/lib/lucide-fallback'
import type { ModelTestResult } from '@/api/models'
import type { TestState } from '@/composables/useModelTest'

const props = defineProps<{
  testState: TestState
  testResult: ModelTestResult | null
  successMessage?: string
  errorMessage?: string
}>()

defineEmits<{
  close: []
}>()

const { t } = useI18n()
const showDetail = ref(false)

const isTesting = computed(() => props.testState === 'loading')

const iconComponent = computed(() => {
  if (isTesting.value) return Loader2
  if (props.testState === 'success') return CheckCircle
  if (props.testState === 'degraded') return AlertTriangle
  return XCircle
})

const titleText = computed(() => {
  if (isTesting.value) return t('models.testing')
  if (props.testState === 'success') return props.successMessage || t('models.connectionSuccess', { ms: 0 })
  if (props.testState === 'degraded') return props.successMessage || t('models.connectionDegraded', { ms: 0 })
  return props.errorMessage || t('models.connectionFailed')
})

const subtitleText = computed(() => {
  if (isTesting.value) return ''
  if (props.testState === 'error' && props.testResult?.errorType) {
    const typeMap: Record<string, string> = {
      auth: t('models.errorAuth'),
      endpoint: t('models.errorEndpoint'),
      network: t('models.errorNetwork'),
      format: t('models.errorFormat'),
      unknown: t('models.errorUnknown'),
    }
    return typeMap[props.testResult.errorType] || ''
  }
  return ''
})

const showDetailToggle = computed(() => {
  return !isTesting.value && props.testResult?.detail
})

const detailText = computed(() => {
  return props.testResult?.detail || ''
})
</script>

<style scoped lang="scss">
.test-banner {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--global-border-radius);
  border-width: 1px;
  border-style: solid;
  transition: all 0.3s ease;

  &--loading {
    border-color: var(--el-color-info);
    background-color: var(--el-color-info-light-9);
  }

  &--success {
    border-color: var(--el-color-success);
    background-color: var(--el-color-success-light-9);
  }

  &--degraded {
    border-color: var(--el-color-warning);
    background-color: var(--el-color-warning-light-9);
  }

  &--error {
    border-color: var(--el-color-danger);
    background-color: var(--el-color-danger-light-9);
  }

  &__icon {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    padding-top: 2px;

    .status-icon {
      width: 20px;
      height: 20px;

      &--spin {
        animation: spin 1s linear infinite;
      }
    }
  }

  &--success .status-icon {
    color: var(--el-color-success);
  }

  &--degraded .status-icon {
    color: var(--el-color-warning);
  }

  &--error .status-icon {
    color: var(--el-color-danger);
  }

  &--loading .status-icon {
    color: var(--el-color-info);
  }

  &__content {
    flex: 1;
    min-width: 0;
  }

  &__title {
    font-size: 14px;
    font-weight: 600;
    color: var(--app-text-primary);
    line-height: 1.5;
  }

  &__subtitle {
    margin-top: 4px;
    font-size: 13px;
    color: var(--app-text-secondary);
    line-height: 1.4;
  }

  &__detail-toggle {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-top: 6px;
    font-size: 12px;
    color: var(--el-color-primary);
    cursor: pointer;
    user-select: none;

    .detail-arrow {
      width: 12px;
      height: 12px;
    }
  }

  &__detail {
    margin-top: 8px;
    padding: var(--spacing-sm);
    border-radius: var(--global-border-radius);
    background-color: var(--el-fill-color-light);
    overflow-x: auto;

    pre {
      margin: 0;
      font-size: 12px;
      font-family: 'Courier New', monospace;
      color: var(--app-text-secondary);
      white-space: pre-wrap;
      word-break: break-all;
      line-height: 1.5;
    }
  }

  &__close {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    cursor: pointer;
    color: var(--app-text-muted);

    .close-icon {
      width: 16px;
      height: 16px;
    }

    &:hover {
      color: var(--app-text-primary);
    }
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.banner-fade-enter-active,
.banner-fade-leave-active {
  transition: all 0.3s ease;
}

.banner-fade-enter-from,
.banner-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
