<template>
  <transition name="fade">
    <div
      class="error-notification"
      :class="error.type"
      v-if="error"
      :role="error.type === 'info' ? 'status' : 'alert'"
      :aria-live="error.type === 'info' ? 'polite' : 'assertive'"
      aria-atomic="true"
    >
      <div class="notification-content">
        <div class="notification-icon">
          <el-icon v-if="error.type === 'error'" class="el-icon-error"></el-icon>
          <AlertTriangle v-else-if="error.type === 'warning'" />
          <Info v-else />
        </div>
        <div class="notification-text">
          <div class="notification-message">{{ error.message }}</div>
          <div v-if="error.code" class="notification-code">
            {{ t('errorNotification.errorCode', { code: error.code }) }}
          </div>
          <div v-if="hasDetails" class="notification-details-toggle">
            <button
              class="details-toggle-btn"
              @click="showDetails = !showDetails"
              :aria-expanded="showDetails"
              :aria-label="
                showDetails
                  ? t('errorNotification.hideDetails')
                  : t('errorNotification.showDetails')
              "
            >
              <el-icon>
                <ChevronDown v-if="!showDetails" />
                <ChevronUp v-else />
              </el-icon>
              <span>
                {{
                  showDetails
                    ? t('errorNotification.hideDetails')
                    : t('errorNotification.showDetails')
                }}
              </span>
            </button>
          </div>
          <transition name="slide-down">
            <div v-if="showDetails && hasDetails" class="notification-details">
              <div v-if="error.details" class="details-content">
                <strong>{{ t('errorNotification.details') }}:</strong>
                <pre>{{ error.details }}</pre>
              </div>
              <div v-if="error.recovery" class="recovery-suggestion">
                <strong>{{ t('errorNotification.recovery') }}:</strong>
                <p>{{ error.recovery }}</p>
              </div>
            </div>
          </transition>
        </div>
        <button
          class="notification-close"
          @click="handleX"
          :aria-label="t('errorNotification.closeAria')"
        >
          <X />
        </button>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { logger } from '../utils/logger'
import { useI18n } from 'vue-i18n'
import { AlertTriangle, Info, X, ChevronDown, ChevronUp } from '@/lib/lucide-fallback'

const { t } = useI18n()

export interface ErrorInfo {
  message: string
  type: 'error' | 'warning' | 'info'
  details?: string
  recovery?: string
  code?: string | number
  showDetails?: boolean
}

const props = defineProps<{
  error: ErrorInfo
}>()

const emit = defineEmits<{
  close: []
}>()

const showDetails = ref(false)
const hasDetails = computed(
  () => !!(props.error.details || props.error.recovery || props.error.code)
)

const handleX = () => {
  emit('close')
}

// 点击外部关闭通知
const handleClickOutside = (event: MouseEvent) => {
  try {
    const target = event.target
    // 确保 target 是 Element 类型
    if (!target || !(target instanceof Element)) {
      return
    }
    const notification = document.querySelector('.error-notification')
    if (notification && !notification.contains(target)) {
      handleX()
    }
  } catch (error) {
    // 静默处理错误，避免影响其他功能
    logger.warn('handleClickOutside error:', error)
  }
}

const cleanup = useCleanup()

onMounted(() => {
  cleanup.addEventListener(document, 'click', handleClickOutside)
})
</script>

<style lang="scss" scoped>
.error-notification {
  position: fixed;
  top: 80px;
  right: 20px;
  z-index: var(--z-notification);
  padding: 12px 16px;
  border-radius: var(--global-border-radius);
  box-shadow: none;
  min-width: 300px;
  max-width: 500px;
  animation: slideIn 0.3s ease-out;

  &.error {
    background-color: var(--el-fill-color-light);
    border: none;
  }

  &.warning {
    background-color: var(--el-fill-color-light);
    border: none;
  }

  &.info {
    background-color: var(--el-bg-color-page);
    border: none;
  }

  .notification-content {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .notification-icon {
    flex-shrink: 0;
    font-size: 18px;

    .error-notification.error & {
      color: var(--el-text-color-secondary);
    }

    .error-notification.warning & {
      color: var(--el-text-color-secondary);
    }

    .error-notification.info & {
      color: var(--el-text-color-secondary);
    }
  }

  .notification-text {
    flex: 1;
    font-size: 14px;
    line-height: 1.5;
    word-wrap: break-word;
    color: var(--el-text-color-primary);

    .notification-message {
      margin-bottom: 4px;
    }

    .notification-code {
      font-size: 12px;
      color: var(--el-text-color-secondary);
      margin-top: 4px;
    }

    .notification-details-toggle {
      margin-top: 8px;

      .details-toggle-btn {
        display: flex;
        align-items: center;
        gap: 4px;
        background: none;
        border: none;
        color: var(--el-color-primary);
        font-size: 12px;
        cursor: pointer;
        padding: 4px 0;
        transition: color 0.2s;

        &:hover {
          color: var(--el-color-primary-dark-2);
        }

        .el-icon {
          font-size: 14px;
        }
      }
    }

    .notification-details {
      margin-top: 12px;
      padding-top: 12px;
      border-top: var(--unified-border);

      .details-content {
        margin-bottom: 12px;

        strong {
          display: block;
          margin-bottom: 4px;
          font-size: 13px;
          color: var(--el-text-color-regular);
        }

        pre {
          margin: 0;
          padding: 8px;
          background-color: var(--el-fill-color-light);
          border-radius: var(--global-border-radius);
          font-size: 12px;
          line-height: 1.4;
          overflow-x: auto;
          white-space: pre-wrap;
          word-break: break-word;
        }
      }

      .recovery-suggestion {
        strong {
          display: block;
          margin-bottom: 4px;
          font-size: 13px;
          color: var(--el-text-color-regular);
        }

        p {
          margin: 0;
          padding: 8px;
          background-color: var(--el-color-info-light-9);
          border-radius: var(--global-border-radius);
          font-size: 12px;
          line-height: 1.4;
        }
      }
    }
  }

  .notification-close {
    flex-shrink: 0;
    background: none;
    border: none;
    font-size: 16px;
    cursor: pointer;
    padding: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--global-border-radius);
    transition: background-color 0.2s;

    &:hover {
      background-color: var(--el-bg-color-hover);
    }

    svg {
      color: var(--el-text-color-secondary);
      width: 14px;
      height: 14px;
    }
  }
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }

  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: max-height 0.3s ease, opacity 0.3s ease, padding-top 0.3s ease, margin-top 0.3s ease;
  max-height: 500px;
  overflow: hidden;
}

.slide-down-enter-from,
.slide-down-leave-to {
  max-height: 0;
  opacity: 0;
  padding-top: 0;
  margin-top: 0;
}
</style>
