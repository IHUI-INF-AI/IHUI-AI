<template>
  <div class="notification-center">
    <div class="notification-header">
      <h3 class="notification-title">
        {{ t('settings.notificationCenter.title') }}
        <el-badge v-if="unreadCount > 0" :value="unreadCount" class="unread-badge" />
      </h3>
      <div class="notification-actions">
        <el-button text size="small" @click="handleMarkAllRead" :disabled="unreadCount === 0">
          {{ t('settings.notificationCenter.markAllRead') }}
        </el-button>
        <el-button text size="small" @click="showSettings = true">
          <el-icon><Setting /></el-icon>
        </el-button>
      </div>
    </div>

    <div class="notification-filters">
      <el-radio-group v-model="filter" size="small">
        <el-radio-button value="all">{{ t('settings.notificationCenter.all') }}</el-radio-button>
        <el-radio-button value="unread">{{ t('settings.notificationCenter.unread') }}</el-radio-button>
        <el-radio-button value="critical">{{ t('settings.notificationCenter.critical') }}</el-radio-button>
      </el-radio-group>
    </div>

    <div class="notification-list" v-loading="loading">
      <div v-if="filteredNotifications.length === 0" class="no-notifications">
        <el-empty :description="t('settings.notificationCenter.noNotifications')" />
      </div>

      <TransitionGroup v-else name="notification-list" tag="div" class="notification-items">
        <div
          v-for="notification in filteredNotifications"
          :key="notification.id"
          class="notification-item"
          :class="{ unread: !notification.read, [notification.priority]: true }"
          @click="handleNotificationClick(notification)"
        >
          <div class="notification-icon" :class="notification.type">
            <el-icon :size="20">
              <CircleCheck v-if="notification.type === 'login'" />
              <Warning v-else-if="notification.type === 'suspicious_login'" />
              <Key v-else-if="notification.type === 'password_change'" />
              <Monitor v-else-if="notification.type === 'device_remove'" />
              <Bell v-else />
            </el-icon>
          </div>

          <div class="notification-content">
            <div class="notification-title-text">{{ notification.title }}</div>
            <div class="notification-message">{{ notification.message }}</div>
            <div class="notification-time">{{ formatTime(notification.timestamp) }}</div>
          </div>

          <div class="notification-status">
            <el-tag v-if="notification.priority === 'critical'" type="danger" size="small">
              {{ t('settings.notificationCenter.critical') }}
            </el-tag>
            <el-tag v-else-if="notification.priority === 'high'" type="warning" size="small">
              {{ t('settings.notificationCenter.high') }}
            </el-tag>
          </div>
        </div>
      </TransitionGroup>
    </div>

    <el-dialog v-model="showSettings" :title="t('settings.notificationCenter.settings')" width="400px">
      <div class="notification-settings">
        <div class="setting-item">
          <span>{{ t('settings.notificationCenter.enableNotifications') }}</span>
          <el-switch v-model="settings.enabled" @change="updateSettings" />
        </div>
        <div class="setting-item">
          <span>{{ t('settings.notificationCenter.desktopNotifications') }}</span>
          <el-switch v-model="settings.desktop" @change="updateSettings" :disabled="!settings.enabled" />
        </div>
        <div class="setting-item">
          <span>{{ t('settings.notificationCenter.soundNotifications') }}</span>
          <el-switch v-model="settings.sound" @change="updateSettings" :disabled="!settings.enabled" />
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Bell, Setting, CircleCheck, Warning, Key, Monitor } from '@element-plus/icons-vue'
import { SecurityNotificationService, type SecurityNotification } from '@/utils/securityNotificationService'

const { t } = useI18n()
const router = useRouter()

const notifications = ref<SecurityNotification[]>([])
const loading = ref(false)
const filter = ref('all')
const showSettings = ref(false)
const settings = ref({
  enabled: true,
  desktop: true,
  sound: false,
})

let unsubscribe: (() => void) | null = null

const unreadCount = computed(() => {
  return notifications.value.filter(n => !n.read).length
})

const filteredNotifications = computed(() => {
  let result = [...notifications.value]

  if (filter.value === 'unread') {
    result = result.filter(n => !n.read)
  } else if (filter.value === 'critical') {
    result = result.filter(n => n.priority === 'critical' || n.priority === 'high')
  }

  return result
})

const formatTime = (timestamp: number): string => {
  const now = Date.now()
  const diff = now - timestamp

  if (diff < 60000) return t('settings.notificationCenter.justNow')
  if (diff < 3600000) return t('settings.notificationCenter.minutesAgo', { count: Math.floor(diff / 60000) })
  if (diff < 86400000) return t('settings.notificationCenter.hoursAgo', { count: Math.floor(diff / 3600000) })
  return new Date(timestamp).toLocaleDateString()
}

const loadNotifications = () => {
  loading.value = true
  try {
    notifications.value = SecurityNotificationService.getNotifications()
  } finally {
    loading.value = false
  }
}

const loadSettings = () => {
  settings.value = SecurityNotificationService.getConfig()
}

const updateSettings = () => {
  SecurityNotificationService.updateConfig(settings.value)
}

const handleNotificationClick = (notification: SecurityNotification) => {
  if (!notification.read) {
    SecurityNotificationService.markAsRead(notification.id)
    loadNotifications()
  }

  if (notification.type === 'suspicious_login' || notification.type === 'password_change') {
    router.push('/settings/security')
  }
}

const handleMarkAllRead = () => {
  SecurityNotificationService.markAllAsRead()
  loadNotifications()
}

const handleNewNotification = (notification: SecurityNotification) => {
  notifications.value.unshift(notification)
}

onMounted(() => {
  loadNotifications()
  loadSettings()
  unsubscribe = SecurityNotificationService.subscribe(handleNewNotification)
})

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe()
  }
})
</script>

<style scoped lang="scss">
.notification-center {
  padding: 20px;
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
}

.notification-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;

  .notification-title {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
    color: var(--el-text-color-primary);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .notification-actions {
    display: flex;
    gap: 8px;
  }
}

.notification-filters {
  margin-bottom: 16px;
}

.notification-list {
  min-height: 200px;
  max-height: 400px;
  overflow-y: auto;
}

.no-notifications {
  padding: 40px 0;
}

.notification-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.notification-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background: var(--el-fill-color-light);
  border-radius: var(--global-border-radius);
  cursor: pointer;
  transition: background-color 0.2s, border-left-color 0.2s;
  border-left: 3px solid transparent;

  &:hover {
    background: var(--el-fill-color);
  }

  &.unread {
    background: var(--el-color-primary-light-9);
    border-left-color: var(--el-color-primary);
  }

  &.critical {
    border-left-color: var(--el-color-danger);
  }

  &.high {
    border-left-color: var(--el-color-warning);
  }
}

.notification-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  flex-shrink: 0;

  &.login {
    background: var(--el-color-success-light-8);
    color: var(--el-color-success);
  }

  &.suspicious_login {
    background: var(--el-color-danger-light-8);
    color: var(--el-color-danger);
  }

  &.password_change {
    background: var(--el-color-warning-light-8);
    color: var(--el-color-warning);
  }

  &.device_remove {
    background: var(--el-color-info-light-8);
    color: var(--el-color-info);
  }
}

.notification-content {
  flex: 1;
  min-width: 0;

  .notification-title-text {
    font-size: 14px;
    font-weight: 500;
    color: var(--el-text-color-primary);
    margin-bottom: 4px;
  }

  .notification-message {
    font-size: 13px;
    color: var(--el-text-color-secondary);
    margin-bottom: 4px;
    line-height: 1.4;
  }

  .notification-time {
    font-size: 12px;
    color: var(--el-text-color-placeholder);
  }
}

.notification-status {
  flex-shrink: 0;
}

.notification-settings {
  .setting-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 0;
    border-bottom: var(--unified-border-bottom);

    &:last-child {
      border-bottom: none;
    }

    span {
      font-size: 14px;
      color: var(--el-text-color-primary);
    }
  }
}

.notification-list-enter-active,
.notification-list-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.notification-list-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}

.notification-list-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>
