<template>
  <div class="device-manager">
    <div class="device-manager-header">
      <h3 class="device-manager-title">{{ t('settings.deviceManagement.title') }}</h3>
      <p class="device-manager-desc">{{ t('settings.deviceManagement.description') }}</p>
    </div>

    <div class="device-list" v-loading="loading">
      <div v-if="devices.length === 0" class="no-devices">
        <el-empty :description="t('settings.deviceManagement.noDevices')" />
      </div>

      <div v-else class="device-cards">
        <div
          v-for="device in devices"
          :key="device.deviceId"
          class="device-card"
          :class="{ 'is-current': device.deviceId === currentDeviceId }"
        >
          <div class="device-icon">
            <el-icon :size="32">
              <Monitor v-if="device.deviceName.includes('Windows') || device.deviceName.includes('Mac')" />
              <Iphone v-else-if="device.deviceName.includes('iPhone') || device.deviceName.includes('Android')" />
              <Platform v-else />
            </el-icon>
          </div>

          <div class="device-info">
            <div class="device-name">
              {{ device.deviceName }}
              <el-tag v-if="device.deviceId === currentDeviceId" type="success" size="small">
                {{ t('settings.deviceManagement.currentDevice') }}
              </el-tag>
            </div>
            <div class="device-meta">
              <span class="device-time">
                {{ t('settings.deviceManagement.loginTime') }}: {{ formatTime(device.loginTime) }}
              </span>
              <span class="device-last-active">
                {{ t('settings.deviceManagement.lastActive') }}: {{ formatTime(device.lastActiveTime) }}
              </span>
            </div>
          </div>

          <div class="device-actions">
            <el-button
              v-if="device.deviceId !== currentDeviceId"
              type="danger"
              text
              @click="handleRemoveDevice(device)"
            >
              {{ t('settings.deviceManagement.removeDevice') }}
            </el-button>
            <span v-else class="current-label">{{ t('settings.deviceManagement.currentDevice') }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="device-footer">
      <el-button type="danger" plain @click="handleRemoveAllDevices" :disabled="devices.length <= 1">
        {{ t('settings.deviceManagement.removeAllDevices') }}
      </el-button>
      <span class="device-count">
        {{ t('settings.deviceManagement.deviceCount', { count: devices.length, max: maxDevices }) }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Monitor, Iphone, Platform } from '@element-plus/icons-vue'
import { MultiDeviceService } from '@/utils/multiDeviceService'
import { DeviceService } from '@/utils/deviceService'
import { formatDateTime as formatTime } from '@/utils/format'

const { t } = useI18n()

interface LoginDevice {
  deviceId: string
  deviceName: string
  loginTime: number
  lastActiveTime: number
  ipAddress?: string
}

const devices = ref<LoginDevice[]>([])
const loading = ref(false)
const currentDeviceId = ref<string | null>(null)
const maxDevices = 5

const loadDevices = async () => {
  loading.value = true
  try {
    devices.value = MultiDeviceService.getLoginDevices()
    currentDeviceId.value = DeviceService.getDeviceId()
  } finally {
    loading.value = false
  }
}

const handleRemoveDevice = async (device: LoginDevice) => {
  try {
    await ElMessageBox.confirm(
      t('settings.deviceManagement.removeConfirm', { deviceName: device.deviceName }),
      t('settings.deviceManagement.removeTitle'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
      }
    )

    MultiDeviceService.removeDevice(device.deviceId)
    await loadDevices()
    ElMessage.success(t('settings.deviceManagement.removeSuccess'))
  } catch {
    // 用户取消
  }
}

const handleRemoveAllDevices = async () => {
  try {
    await ElMessageBox.confirm(
      t('settings.deviceManagement.removeAllConfirm'),
      t('settings.deviceManagement.removeAllTitle'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
      }
    )

    MultiDeviceService.clearAllDevices()
    await MultiDeviceService.registerCurrentDevice()
    await loadDevices()
    ElMessage.success(t('settings.deviceManagement.removeAllSuccess'))
  } catch {
    // 用户取消
  }
}

onMounted(() => {
  loadDevices()
})
</script>

<style scoped lang="scss">
.device-manager {
  padding: 20px;
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
}

.device-manager-header {
  margin-bottom: 20px;

  .device-manager-title {
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 8px;
    color: var(--el-text-color-primary);
  }

  .device-manager-desc {
    font-size: 14px;
    color: var(--el-text-color-secondary);
    margin: 0;
  }
}

.device-list {
  min-height: 200px;
}

.no-devices {
  padding: 40px 0;
}

.device-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.device-card {
  display: flex;
  align-items: center;
  padding: 16px;
  background: var(--el-fill-color-light);
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
  transition: all 0.3s;

  &:hover {
    border-color: var(--el-color-primary-light-5);
    box-shadow: var(--global-box-shadow);
  }

  &.is-current {
    border-color: var(--el-color-success-light-5);
    background: var(--el-color-success-light-9);
  }
}

.device-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-fill-color);
  border-radius: var(--global-border-radius);
  margin-right: 16px;
  color: var(--el-color-primary);
}

.device-info {
  flex: 1;

  .device-name {
    font-size: 15px;
    font-weight: 500;
    color: var(--el-text-color-primary);
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .device-meta {
    font-size: 13px;
    color: var(--el-text-color-secondary);
    display: flex;
    gap: 16px;
  }
}

.device-actions {
  .current-label {
    font-size: 13px;
    color: var(--el-color-success);
  }
}

.device-footer {
  margin-top: 20px;
  padding-top: 16px;
  border-top: var(--unified-border);
  display: flex;
  justify-content: space-between;
  align-items: center;

  .device-count {
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }
}
</style>
