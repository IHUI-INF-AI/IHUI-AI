<template>
  <div class="my-notifications">
    <!-- ① 页面头 -->
    <header class="page-header">
      <div class="header-text">
        <h1 class="page-title">{{ t('edu.notification.title') }}</h1>
        <p class="page-subtitle">{{ t('edu.notification.subtitle') }}</p>
      </div>
      <div class="header-actions">
        <el-button :icon="Refresh" :loading="loading" @click="loadNotifications">
          {{ t('edu.profile.retry') }}
        </el-button>
      </div>
    </header>

    <el-alert
      v-if="error"
      type="error"
      :title="t('edu.profile.loadFailed')"
      show-icon
      :closable="false"
      class="error-alert"
    />

    <!-- ② 通知列表 -->
    <div v-loading="loading" class="notifications-body">
      <el-table
        v-if="notifications.length"
        :data="notifications"
        stripe
        class="notification-table"
      >
        <el-table-column
          :label="t('edu.notification.notificationTitle')"
          min-width="180"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <span class="notif-title">{{ row.title || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column
          :label="t('edu.notification.notificationContent')"
          min-width="280"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <span class="notif-content">{{ row.content || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('edu.notification.templateCode')" width="160">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ row.template_code || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('edu.notification.channel')" width="120">
          <template #default="{ row }">
            <el-tag size="small" type="info" effect="plain">{{ row.channel || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('edu.notification.sendTime')" width="170">
          <template #default="{ row }">
            <span class="notif-time">{{ formatTime(row.sent_at || row.created_at) }}</span>
          </template>
        </el-table-column>
      </el-table>

      <!-- 空状态 -->
      <el-empty
        v-else-if="!loading"
        :description="t('edu.notification.noNotifications')"
        class="empty-state"
      />
    </div>

    <!-- ③ 分页 -->
    <div v-if="total > 0" class="pagination-wrap">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="size"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next, jumper"
        background
        @current-change="loadNotifications"
        @size-change="handleSizeChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Refresh } from '@element-plus/icons-vue'
import { notificationApi } from '@/api/edu'

interface NotificationItem {
  id?: number
  title?: string
  content?: string
  template_code?: string
  channel?: string
  sent_at?: string
  created_at?: string
  is_sent?: boolean
  [key: string]: unknown
}

const { t } = useI18n()

const loading = ref(false)
const error = ref(false)
const notifications = ref<NotificationItem[]>([])
const total = ref(0)
const page = ref(1)
const size = ref(10)

async function loadNotifications() {
  loading.value = true
  error.value = false
  try {
    const res = await notificationApi.myNotifications({
      page: page.value,
      size: size.value,
    })
    const data = res.data?.data
    if (data) {
      notifications.value = data.items as NotificationItem[]
      total.value = data.total
    } else {
      notifications.value = []
      total.value = 0
    }
  } catch (e) {
    error.value = true
    notifications.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function handleSizeChange() {
  page.value = 1
  loadNotifications()
}

function formatTime(value?: string): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

onMounted(loadNotifications)
</script>

<style scoped lang="scss">
.my-notifications {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.header-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.page-title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.page-subtitle {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.header-actions {
  display: flex;
  gap: 8px;
}

.error-alert {
  margin: 0;
}

.notifications-body {
  min-height: 200px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
}

.notification-table {
  border-radius: 8px;
}

.notif-title {
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.notif-content {
  color: var(--el-text-color-regular);
}

.notif-time {
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
  font-size: 13px;
}

.empty-state {
  padding: 40px 0;
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  padding: 8px 0;
}

/* 禁止蓝光边框：focus 时仅 border-color 过渡 */
:deep(.el-button:focus-visible) {
  outline: none;
  box-shadow: none;
}

:deep(.el-input__wrapper:focus-within) {
  box-shadow: none !important;
}

:deep(.el-table) {
  --el-table-border-color: var(--el-border-color-light);
  --el-table-header-bg-color: var(--el-fill-color-light);
}
</style>
