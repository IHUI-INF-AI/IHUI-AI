<template>
  <div class="login-history">
    <div class="history-header">
      <h3 class="history-title">{{ t('settings.loginHistory.title') }}</h3>
      <p class="history-desc">{{ t('settings.loginHistory.description') }}</p>
    </div>

    <div class="history-filter">
      <el-select v-model="filterType" size="small" style="width: 150px">
        <el-option :label="t('settings.loginHistory.allTypes')" value="all" />
        <el-option :label="t('settings.loginHistory.login')" value="login" />
        <el-option :label="t('settings.loginHistory.logout')" value="logout" />
        <el-option :label="t('settings.loginHistory.suspicious')" value="suspicious" />
      </el-select>
    </div>

    <div class="history-list" v-loading="loading">
      <div v-if="filteredHistory.length === 0" class="no-history">
        <el-empty :description="t('settings.loginHistory.noHistory')" />
      </div>

      <div v-else class="history-timeline">
        <div
          v-for="record in filteredHistory"
          :key="record.id"
          class="history-item"
          :class="{
            'is-suspicious': record.isSuspicious,
            'is-failed': !record.success
          }"
        >
          <div class="history-marker">
            <div class="marker-dot" :class="getMarkerClass(record)"></div>
          </div>

          <div class="history-content">
            <div class="history-main">
              <span class="history-type">{{ getTypeLabel(record.type) }}</span>
              <span class="history-time">{{ formatTime(record.timestamp) }}</span>
            </div>

            <div class="history-details">
              <span v-if="record.deviceName" class="detail-item">
                <el-icon><Monitor /></el-icon>
                {{ record.deviceName }}
              </span>
              <span v-if="record.ip" class="detail-item">
                <el-icon><Location /></el-icon>
                {{ record.ip }}
              </span>
              <span v-if="record.location" class="detail-item">
                <el-icon><MapLocation /></el-icon>
                {{ record.location }}
              </span>
            </div>

            <div v-if="record.isSuspicious" class="suspicious-warning">
              <el-icon><WarningFilled /></el-icon>
              {{ t('settings.loginHistory.suspiciousWarning') }}
            </div>
          </div>

          <div class="history-status">
            <el-tag v-if="record.success" type="success" size="small">
              {{ t('common.success') }}
            </el-tag>
            <el-tag v-else type="danger" size="small">
              {{ t('common.failed') }}
            </el-tag>
          </div>
        </div>
      </div>
    </div>

    <div class="history-footer">
      <el-button text @click="handleClearHistory" :disabled="history.length === 0">
        {{ t('settings.loginHistory.clearHistory') }}
      </el-button>
      <span class="history-count">{{ t('settings.loginHistory.recordCount', { count: history.length }) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Monitor, Location, MapLocation, WarningFilled } from '@element-plus/icons-vue'
import { SecurityLogService, type SecurityLogEntry, type SecurityEventType } from '@/utils/securityLogService'
import { LocationService } from '@/utils/locationService'
import { formatDateTime as formatTime } from '@/utils/format'

interface LoginHistoryRecord extends SecurityLogEntry {
  location?: string
  ip?: string
  isSuspicious?: boolean
}

const { t } = useI18n()

const history = ref<LoginHistoryRecord[]>([])
const loading = ref(false)
const filterType = ref<string>('all')

const filteredHistory = computed(() => {
  if (filterType.value === 'all') {
    return history.value
  }
  if (filterType.value === 'suspicious') {
    return history.value.filter(r => r.isSuspicious)
  }
  return history.value.filter(r => r.type === filterType.value)
})

const getTypeLabel = (type: SecurityEventType): string => {
  const labels: Record<SecurityEventType, string> = {
    login: t('settings.loginHistory.login'),
    logout: t('settings.loginHistory.logout'),
    password_change: t('settings.loginHistory.passwordChange'),
    device_remove: t('settings.loginHistory.deviceRemove'),
    suspicious_login: t('settings.loginHistory.suspiciousLogin'),
    token_refresh: 'Token 刷新',
    account_update: '账户更新',
  }
  return labels[type] || type
}

const getMarkerClass = (record: LoginHistoryRecord): string => {
  if (record.isSuspicious) return 'marker-warning'
  if (!record.success) return 'marker-danger'
  if (record.type === 'login') return 'marker-success'
  return 'marker-default'
}

const loadHistory = () => {
  loading.value = true
  try {
    const logs = SecurityLogService.getLogs()
    const locations = LocationService.getLoginLocations()

    const combined: LoginHistoryRecord[] = logs.map(log => {
      const locationInfo = locations.find(l => l.loginTime === log.timestamp)
      return {
        ...log,
        location: locationInfo?.city || locationInfo?.region,
        ip: locationInfo?.ip || log.ipAddress,
        isSuspicious: log.type === 'suspicious_login',
      }
    })

    history.value = combined
  } finally {
    loading.value = false
  }
}

const handleClearHistory = async () => {
  try {
    await ElMessageBox.confirm(
      t('settings.loginHistory.clearConfirm'),
      t('settings.loginHistory.clearTitle'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
      }
    )

    SecurityLogService.clearLogs()
    LocationService.clearLocations()
    loadHistory()
    ElMessage.success(t('settings.loginHistory.clearSuccess'))
  } catch {
    // 用户取消
  }
}

onMounted(() => {
  loadHistory()
})
</script>

<style scoped lang="scss">
.login-history {
  padding: 20px;
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
}

.history-header {
  margin-bottom: 16px;

  .history-title {
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 8px;
    color: var(--el-text-color-primary);
  }

  .history-desc {
    font-size: 14px;
    color: var(--el-text-color-secondary);
    margin: 0;
  }
}

.history-filter {
  margin-bottom: 16px;
}

.history-list {
  min-height: 200px;
}

.no-history {
  padding: 40px 0;
}

.history-timeline {
  position: relative;
  padding-left: 24px;

  &::before {
    content: '';
    position: absolute;
    left: 6px;
    top: 0;
    bottom: 0;
    width: 2px;
    background: var(--el-border-color-light);
  }
}

.history-item {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 12px 0;
  border-bottom: var(--unified-border-bottom);

  &:last-child {
    border-bottom: none;
  }

  &.is-suspicious {
    background: var(--el-color-warning-light-9);
    margin: 0 -20px;
    padding: 12px 20px;
    border-radius: var(--global-border-radius);
  }

  &.is-failed {
    opacity: 0.8;
  }
}

.history-marker {
  position: absolute;
  left: -24px;
  top: 16px;

  .marker-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid var(--el-bg-color);
    box-shadow: 0 0 0 2px var(--el-border-color-light);

    &.marker-success {
      background: var(--el-color-success);
      box-shadow: 0 0 0 2px var(--el-color-success-light-5);
    }

    &.marker-danger {
      background: var(--el-color-danger);
      box-shadow: 0 0 0 2px var(--el-color-danger-light-5);
    }

    &.marker-warning {
      background: var(--el-color-warning);
      box-shadow: 0 0 0 2px var(--el-color-warning-light-5);
    }

    &.marker-default {
      background: var(--el-color-primary);
      box-shadow: 0 0 0 2px var(--el-color-primary-light-5);
    }
  }
}

.history-content {
  flex: 1;

  .history-main {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  }

  .history-type {
    font-weight: 500;
    color: var(--el-text-color-primary);
  }

  .history-time {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .history-details {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 4px;

    .detail-item {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }

  .suspicious-warning {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 8px;
    padding: 6px 10px;
    background: var(--el-color-warning-light-9);
    border-radius: var(--global-border-radius);
    font-size: 12px;
    color: var(--el-color-warning-dark-2);
  }
}

.history-status {
  flex-shrink: 0;
}

.history-footer {
  margin-top: 16px;
  padding-top: 16px;
  border-top: var(--unified-border);
  display: flex;
  justify-content: space-between;
  align-items: center;

  .history-count {
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }
}
</style>
