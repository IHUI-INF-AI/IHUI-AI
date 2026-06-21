<template>
  <div class="security-log">
    <div class="security-log-header">
      <h3 class="security-log-title">{{ t('settings.securityLog.title') }}</h3>
      <p class="security-log-desc">{{ t('settings.securityLog.description') }}</p>
    </div>

    <div class="log-list" v-loading="loading">
      <div v-if="logs.length === 0" class="no-logs">
        <el-empty :description="t('settings.securityLog.noLogs')" />
      </div>

      <div v-else class="log-timeline">
        <div v-for="log in logs" :key="log.id" class="log-item" :class="{ 'is-failed': !log.success }">
          <div class="log-icon">
            <el-icon :size="20" :class="getLogIconClass(log.type, log.success)">
              <CircleCheck v-if="log.success && log.type === 'login'" />
              <CircleClose v-else-if="!log.success" />
              <SwitchButton v-else-if="log.type === 'logout'" />
              <Key v-else-if="log.type === 'password_change'" />
              <Delete v-else-if="log.type === 'device_remove'" />
              <Warning v-else-if="log.type === 'suspicious_login'" />
              <Refresh v-else-if="log.type === 'token_refresh'" />
              <Document v-else />
            </el-icon>
          </div>

          <div class="log-content">
            <div class="log-title">
              <span class="log-type">{{ getLogTypeLabel(log.type) }}</span>
              <el-tag v-if="!log.success" type="danger" size="small">{{ t('common.failed') }}</el-tag>
            </div>
            <div class="log-meta">
              <span class="log-time">{{ formatTime(log.timestamp) }}</span>
              <span v-if="log.deviceName" class="log-device">{{ log.deviceName }}</span>
              <span v-if="log.ipAddress" class="log-ip">{{ log.ipAddress }}</span>
            </div>
            <div v-if="log.details" class="log-details">{{ log.details }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="security-log-footer">
      <el-button text @click="handleClearLogs" :disabled="logs.length === 0">
        {{ t('settings.data.clearCache') }}
      </el-button>
      <span class="log-count">{{ t('common.total') }}: {{ logs.length }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  CircleCheck,
  CircleClose,
  SwitchButton,
  Key,
  Warning,
  Refresh,
  Document,
  Delete,
} from '@element-plus/icons-vue'
import { SecurityLogService, type SecurityLogEntry, type SecurityEventType } from '@/utils/securityLogService'

const { t } = useI18n()

const logs = ref<SecurityLogEntry[]>([])
const loading = ref(false)

const getLogTypeLabel = (type: SecurityEventType): string => {
  const labels: Record<SecurityEventType, string> = {
    login: t('settings.securityLog.login'),
    logout: t('settings.securityLog.logout'),
    password_change: t('settings.securityLog.passwordChange'),
    device_remove: t('settings.securityLog.deviceRemove'),
    suspicious_login: t('settings.securityLog.suspiciousLogin'),
    token_refresh: t('settings.securityLog.tokenRefresh'),
    account_update: t('settings.securityLog.accountUpdate'),
  }
  return labels[type] || type
}

const getLogIconClass = (type: SecurityEventType, success: boolean): string => {
  if (!success) return 'icon-danger'
  if (type === 'suspicious_login') return 'icon-warning'
  return 'icon-success'
}

const loadLogs = () => {
  loading.value = true
  try {
    logs.value = SecurityLogService.getLogs()
  } finally {
    loading.value = false
  }
}

const handleClearLogs = async () => {
  try {
    await ElMessageBox.confirm(
      t('settings.data.clearCache') + '?',
      t('common.confirm'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
      }
    )

    SecurityLogService.clearLogs()
    loadLogs()
    ElMessage.success(t('settings.dataClearSuccess'))
  } catch {
    // 用户取消
  }
}

onMounted(() => {
  loadLogs()
})
</script>

<style scoped lang="scss">
.security-log {
  padding: 20px;
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
}

.security-log-header {
  margin-bottom: 20px;

  .security-log-title {
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 8px;
    color: var(--el-text-color-primary);
  }

  .security-log-desc {
    font-size: 14px;
    color: var(--el-text-color-secondary);
    margin: 0;
  }
}

.log-list {
  min-height: 200px;
}

.no-logs {
  padding: 40px 0;
}

.log-timeline {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.log-item {
  display: flex;
  padding: 12px;
  background: var(--el-fill-color-light);
  border-radius: var(--global-border-radius);
  border-left: 3px solid var(--el-color-success);

  &.is-failed {
    border-left-color: var(--el-color-danger);
  }
}

.log-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--el-fill-color);
  margin-right: 12px;

  .icon-success {
    color: var(--el-color-success);
  }

  .icon-danger {
    color: var(--el-color-danger);
  }

  .icon-warning {
    color: var(--el-color-warning);
  }
}

.log-content {
  flex: 1;

  .log-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;

    .log-type {
      font-weight: 500;
      color: var(--el-text-color-primary);
    }
  }

  .log-meta {
    font-size: 13px;
    color: var(--el-text-color-secondary);
    display: flex;
    gap: 12px;
  }

  .log-details {
    font-size: 13px;
    color: var(--el-text-color-secondary);
    margin-top: 4px;
    padding: 8px;
    background: var(--el-fill-color);
    border-radius: var(--global-border-radius);
  }
}

.security-log-footer {
  margin-top: 20px;
  padding-top: 16px;
  border-top: var(--unified-border);
  display: flex;
  justify-content: space-between;
  align-items: center;

  .log-count {
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }
}
</style>
