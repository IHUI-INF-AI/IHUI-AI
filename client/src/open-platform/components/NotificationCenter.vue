<template>
  <el-popover
    v-model:visible="visible"
    placement="bottom-end"
    :width="360"
    trigger="click"
    popper-class="notification-center-popover"
  >
    <template #reference>
      <el-badge :value="unreadCount" :hidden="unreadCount === 0" :max="99">
        <el-button :icon="Bell" circle />
      </el-badge>
    </template>

    <div class="notification-center">
      <div class="notification-header">
        <h3 class="notification-title">{{ t('openPlatform.notifications.title') }}</h3>
        <el-button
          v-if="unreadCount > 0"
          text
          size="small"
          @click="markAllAsRead"
        >
          {{ t('openPlatform.notifications.markAllRead') }}
        </el-button>
      </div>

      <div class="notification-list">
        <el-empty
          v-if="notifications.length === 0"
          :description="t('openPlatform.notifications.noNotifications')"
          :image-size="80"
        />
        <div
          v-else
          v-for="notification in notifications"
          :key="notification.id"
          class="notification-item"
          :class="{ unread: !notification.read }"
          @click="handleNotificationClick(notification)"
        >
          <div class="notification-icon">
            <el-icon>
              <component :is="getNotificationIcon(notification.type)" />
            </el-icon>
          </div>
          <div class="notification-content">
            <div class="notification-title">{{ notification.title }}</div>
            <div class="notification-message">{{ notification.message }}</div>
            <div class="notification-time">{{ formatTime(notification.time) }}</div>
          </div>
        </div>
      </div>

      <div class="notification-footer">
        <el-button text size="small" @click="viewAll">
          {{ t('openPlatform.notifications.viewAll') }}
        </el-button>
      </div>
    </div>
  </el-popover>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Bell, SuccessFilled, WarningFilled, InfoFilled, CircleCloseFilled } from '@element-plus/icons-vue'
import { formatRelativeTime } from '@/utils/time-utils'

const { t } = useI18n()

const visible = ref(false)

interface Notification {
  id: string
  title: string
  message: string
  type: 'success' | 'warning' | 'error' | 'info'
  read: boolean
  time: string | number
}

// 通知数据（示例）
const notifications = ref<Notification[]>([
  // 可以从 API 获取实际通知数据
])

const unreadCount = computed(() => {
  return notifications.value.filter(n => !n.read).length
})

const getNotificationIcon = (type: string) => {
  const iconMap: Record<string, typeof InfoFilled> = {
    success: SuccessFilled,
    warning: WarningFilled,
    error: CircleCloseFilled,
    info: InfoFilled,
  }
  return iconMap[type] || InfoFilled
}

const formatTime = (time: string | number) => {
  const timestamp = typeof time === 'string' ? new Date(time).getTime() / 1000 : time
  return formatRelativeTime(timestamp)
}

const markAllAsRead = () => {
  notifications.value.forEach(n => {
    n.read = true
  })
}

const handleNotificationClick = (notification: { read: boolean }) => {
  notification.read = true
  // 处理通知点击
}

const viewAll = () => {
  // 跳转到通知列表页
  visible.value = false
}
</script>

<style scoped lang="scss">
.notification-center {
  max-height: 500px;
  display: flex;
  flex-direction: column;

  .notification-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    border-bottom: var(--unified-border-bottom);

    .notification-title {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--el-text-color-primary);
    }
  }

  .notification-list {
    flex: 1;
    overflow-y: auto;
    max-height: 400px;

    .notification-item {
      display: flex;
      gap: 12px;
      padding: 12px 16px;
      cursor: pointer;
      transition: background 0.2s;

      &:hover {
        background: var(--el-bg-color-page);
      }

      &.unread {
        background: var(--el-color-primary-light-9);
      }

      .notification-icon {
        flex-shrink: 0;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--global-border-radius);
        background: var(--el-color-primary-light-9);
        color: var(--el-color-primary);
      }

      .notification-content {
        flex: 1;
        min-width: 0;

        .notification-title {
          margin: 0 0 4px;
          font-size: 14px;
          font-weight: 600;
          color: var(--el-text-color-primary);
        }

        .notification-message {
          margin: 0 0 4px;
          font-size: 12px;
          color: var(--el-text-color-regular);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .notification-time {
          font-size: 12px;
          color: var(--el-text-color-secondary);
        }
      }
    }
  }

  .notification-footer {
    padding: 12px 16px;
    border-top: var(--unified-border);
    text-align: center;
  }
}
</style>
