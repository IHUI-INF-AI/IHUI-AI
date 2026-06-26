<template>
  <div class="session-manager">
    <div class="session-header">
      <h3 class="session-title">{{ t('settings.sessionManagement.title') }}</h3>
      <p class="session-desc">{{ t('settings.sessionManagement.description') }}</p>
    </div>

    <div class="session-list" v-loading="loading">
      <div v-if="sessions.length === 0" class="no-sessions">
        <el-empty :description="t('settings.sessionManagement.noSessions')" />
      </div>

      <div v-else class="session-cards">
        <div
          v-for="session in sessions"
          :key="session.id"
          class="session-card"
          :class="{ 'is-current': session.isCurrent, 'is-expired': isExpired(session) }"
        >
          <div class="session-icon">
            <el-icon :size="24">
              <Monitor v-if="session.deviceName.includes('Windows') || session.deviceName.includes('Mac')" />
              <Iphone v-else-if="session.deviceName.includes('iPhone') || session.deviceName.includes('Android')" />
              <Platform v-else />
            </el-icon>
          </div>

          <div class="session-info">
            <div class="session-name">
              {{ session.deviceName }}
              <el-tag v-if="session.isCurrent" type="success" size="small">
                {{ t('settings.sessionManagement.currentSession') }}
              </el-tag>
              <el-tag v-if="isExpired(session)" type="info" size="small">
                {{ t('settings.sessionManagement.expired') }}
              </el-tag>
            </div>
            <div class="session-meta">
              <span class="session-time">
                {{ t('settings.sessionManagement.startTime') }}: {{ formatTime(session.startTime) }}
              </span>
              <span class="session-duration">
                {{ t('settings.sessionManagement.duration') }}: {{ formatDuration(session.startTime) }}
              </span>
            </div>
            <div v-if="session.ipAddress || session.location" class="session-location">
              <span v-if="session.ipAddress">{{ session.ipAddress }}</span>
              <span v-if="session.location">{{ session.location }}</span>
            </div>
          </div>

          <div class="session-actions">
            <el-button
              v-if="!session.isCurrent"
              type="danger"
              text
              @click="handleEndSession(session)"
            >
              {{ t('settings.sessionManagement.endSession') }}
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <div class="session-footer">
      <el-button type="danger" plain @click="handleEndAllOtherSessions" :disabled="sessions.length <= 1">
        {{ t('settings.sessionManagement.endAllOtherSessions') }}
      </el-button>
      <span class="session-count">
        {{ t('settings.sessionManagement.sessionCount', { count: sessions.length }) }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Monitor, Iphone, Platform } from '@element-plus/icons-vue'
import { SessionService, type Session } from '@/utils/sessionService'
import { useCleanup } from '@/composables/useCleanup'
import { formatDateTime as formatTime } from '@/utils/format'

const { t } = useI18n()

const sessions = ref<Session[]>([])
const loading = ref(false)

const cleanup = useCleanup()

const formatDuration = (startTime: number): string => {
  return SessionService.formatSessionDuration(startTime)
}

const isExpired = (session: Session): boolean => {
  return SessionService.isSessionExpired(session)
}

const loadSessions = () => {
  loading.value = true
  try {
    sessions.value = SessionService.getSessions()
  } finally {
    loading.value = false
  }
}

const handleEndSession = async (session: Session) => {
  try {
    await ElMessageBox.confirm(
      t('settings.sessionManagement.endConfirm', { deviceName: session.deviceName }),
      t('settings.sessionManagement.endTitle'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
      }
    )

    const success = SessionService.endSession(session.id)
    if (success) {
      loadSessions()
      ElMessage.success(t('settings.sessionManagement.endSuccess'))
    } else {
      ElMessage.warning(t('settings.sessionManagement.cannotEndCurrent'))
    }
  } catch {
    // 用户取消
  }
}

const handleEndAllOtherSessions = async () => {
  try {
    await ElMessageBox.confirm(
      t('settings.sessionManagement.endAllConfirm'),
      t('settings.sessionManagement.endAllTitle'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
      }
    )

    const count = SessionService.endAllOtherSessions()
    loadSessions()
    ElMessage.success(t('settings.sessionManagement.endAllSuccess', { count }))
  } catch {
    // 用户取消
  }
}

const updateActivity = () => {
  SessionService.updateActivity()
}

onMounted(() => {
  loadSessions()

  cleanup.addInterval(updateActivity, 60000)
})
</script>

<style scoped lang="scss">
.session-manager {
  padding: 20px;
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
}

.session-header {
  margin-bottom: 20px;

  .session-title {
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 8px;
    color: var(--el-text-color-primary);
  }

  .session-desc {
    font-size: 14px;
    color: var(--el-text-color-secondary);
    margin: 0;
  }
}

.session-list {
  min-height: 200px;
}

.no-sessions {
  padding: 40px 0;
}

.session-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.session-card {
  display: flex;
  align-items: center;
  padding: 16px;
  background: var(--el-fill-color-light);
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
  transition: border-color 0.3s, background-color 0.3s, opacity 0.3s;

  &:hover {
    border-color: var(--el-color-primary-light-5);
    }

  &.is-current {
    border-color: var(--el-color-success-light-5);
    background: var(--el-color-success-light-9);
  }

  &.is-expired {
    opacity: 0.6;
  }
}

.session-icon {
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

.session-info {
  flex: 1;

  .session-name {
    font-size: 15px;
    font-weight: 500;
    color: var(--el-text-color-primary);
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .session-meta {
    font-size: 13px;
    color: var(--el-text-color-secondary);
    display: flex;
    gap: 16px;
  }

  .session-location {
    font-size: 12px;
    color: var(--el-text-color-placeholder);
    margin-top: 4px;
    display: flex;
    gap: 8px;
  }
}

.session-footer {
  margin-top: 20px;
  padding-top: 16px;
  border-top: var(--unified-border);
  display: flex;
  justify-content: space-between;
  align-items: center;

  .session-count {
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }
}
</style>
