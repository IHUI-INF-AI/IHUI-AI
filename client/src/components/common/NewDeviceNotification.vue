<template>
  <Teleport to="body">
    <Transition name="notification-slide">
      <div v-if="visible" class="new-device-notification" :class="{ 'is-warning': isWarning }">
        <div class="notification-icon">
          <el-icon :size="32">
            <WarningFilled v-if="isWarning" />
            <Monitor v-else />
          </el-icon>
        </div>

        <div class="notification-content">
          <h4 class="notification-title">{{ title }}</h4>
          <p class="notification-message">{{ message }}</p>
          <div v-if="deviceInfo" class="device-info">
            <span v-if="deviceInfo.deviceName">{{ deviceInfo.deviceName }}</span>
            <span v-if="deviceInfo.location">{{ deviceInfo.location }}</span>
            <span v-if="deviceInfo.time">{{ formatTime(deviceInfo.time) }}</span>
          </div>
        </div>

        <div class="notification-actions">
          <el-button size="small" @click="handleDismiss">
            {{ t('common.dismiss') }}
          </el-button>
          <el-button v-if="isWarning" type="danger" size="small" @click="handleSecureAccount">
            {{ t('security.secureAccount') }}
          </el-button>
        </div>

        <button class="notification-close" @click="handleDismiss" aria-label="关闭">
          <el-icon><Close /></el-icon>
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Monitor, WarningFilled, Close } from '@element-plus/icons-vue'

interface DeviceInfo {
  deviceName?: string
  location?: string
  time?: number
  ip?: string
}

const props = defineProps<{
  visible?: boolean
  isWarning?: boolean
  deviceInfo?: DeviceInfo
}>()

const emit = defineEmits<{
  (e: 'dismiss'): void
  (e: 'secure-account'): void
}>()

const { t } = useI18n()
const router = useRouter()

const title = computed(() => {
  return props.isWarning
    ? t('security.suspiciousLogin')
    : t('security.newDeviceLogin')
})

const message = computed(() => {
  return props.isWarning
    ? t('security.suspiciousLoginMessage')
    : t('security.newDeviceLoginMessage')
})

const handleDismiss = () => {
  emit('dismiss')
}

const handleSecureAccount = () => {
  emit('secure-account')
  router.push('/settings/security')
}
</script>

<style scoped lang="scss">
.new-device-notification {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: var(--z-notification);
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 16px 20px;
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  box-shadow: var(--global-box-shadow);
  border: var(--unified-border);
  max-width: 400px;

  &.is-warning {
    border-color: var(--el-color-warning-light-5);
    background: var(--el-color-warning-light-9);

    .notification-icon {
      background: var(--el-color-warning-light-8);
      color: var(--el-color-warning);
    }
  }
}

.notification-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  border-radius: var(--global-border-radius);
  flex-shrink: 0;
}

.notification-content {
  flex: 1;

  .notification-title {
    font-size: 15px;
    font-weight: 600;
    margin: 0 0 4px;
    color: var(--el-text-color-primary);
  }

  .notification-message {
    font-size: 13px;
    color: var(--el-text-color-secondary);
    margin: 0 0 8px;
  }

  .device-info {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    span {
      font-size: 12px;
      padding: 2px 8px;
      background: var(--el-fill-color-light);
      border-radius: var(--global-border-radius);
      color: var(--el-text-color-secondary);
    }
  }
}

.notification-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.notification-close {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--el-text-color-secondary);
  border-radius: var(--global-border-radius-sm, 4px);
  transition: all 0.2s;

  &:hover {
    background: var(--el-fill-color);
    color: var(--el-text-color-primary);
  }
}

.notification-slide-enter-active,
.notification-slide-leave-active {
  transition: all 0.3s ease;
}

.notification-slide-enter-from {
  transform: translateX(100%);
  opacity: 0;
}

.notification-slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>
