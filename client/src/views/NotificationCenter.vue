<template>
  <div class="notification-center-page page-container">
    <div class="page-header">
      <h1 class="page-title">{{ t('notificationCenter.title') }}</h1>
      <p class="page-subtitle">{{ t('notificationCenter.subtitle') }}</p>
    </div>

    <div class="stat-row">
      <div class="stat-card">
        <span class="stat-num">{{ unreadCount }}</span>
        <span class="stat-label">{{ t('notificationCenter.unread') }}</span>
      </div>
      <div class="stat-card">
        <span class="stat-num">{{ notifications.length }}</span>
        <span class="stat-label">{{ t('notificationCenter.total') }}</span>
      </div>
      <button class="mark-all-btn" @click="handleMarkAllRead">{{ t('notificationCenter.markAllRead') }}</button>
    </div>

    <div class="filter-row">
      <select v-model="filterType" class="filter-select">
        <option value="">{{ t('notificationCenter.allTypes') }}</option>
        <option value="order">{{ t('notificationCenter.typeOrder') }}</option>
        <option value="wallet">{{ t('notificationCenter.typeWallet') }}</option>
        <option value="system">{{ t('notificationCenter.typeSystem') }}</option>
        <option value="refund">{{ t('notificationCenter.typeRefund') }}</option>
        <option value="agent">{{ t('notificationCenter.typeAgent') }}</option>
        <option value="marketing">{{ t('notificationCenter.typeMarketing') }}</option>
      </select>
    </div>

    <div v-loading="loading" class="notification-list-wrap">
      <div v-if="loadError" class="error-state">
        <div class="error-icon">⚠</div>
        <p>{{ loadError }}</p>
        <el-button type="primary" size="small" @click="loadNotifications">{{ t('common.retry') }}</el-button>
      </div>

      <div v-else-if="filteredList.length === 0" class="empty-state">
        <div class="empty-icon">🔔</div>
        <p>{{ t('notificationCenter.noNotifications') }}</p>
      </div>

      <ul v-else class="notification-list">
        <li
          v-for="n in filteredList"
          :key="n.id"
          :class="['notification-item', { unread: n.status !== 3 }]"
          @click="handleOpen(n)"
        >
          <span :class="['notif-type', `type-${n.type}`]">{{ getTypeLabel(n.type) }}</span>
          <div class="notif-body">
            <h3 class="notif-title">{{ n.title }}</h3>
            <p class="notif-content">{{ n.content }}</p>
            <span class="notif-time">{{ formatTime(n.send_time) }}</span>
          </div>
          <button class="del-btn" aria-label="删除通知" @click.stop="handleDelete(n)">×</button>
        </li>
      </ul>
    </div>

    <el-dialog v-model="detailVisible" :title="currentNotif?.title || t('notificationCenter.detailTitle')" width="480px">
      <div v-if="currentNotif" class="dialog-body">
        <span :class="['notif-type', `type-${currentNotif.type}`]">{{ getTypeLabel(currentNotif.type) }}</span>
        <p class="dialog-content">{{ currentNotif.content }}</p>
        <span class="dialog-time">{{ formatTime(currentNotif.send_time) }}</span>
      </div>
      <template #footer>
        <el-button @click="detailVisible = false">{{ t('common.close') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import http from '@/utils/request'
import { useToast } from '@/composables/useToast'

interface Notification {
  id: number
  title: string
  content: string
  type: string
  status: number
  send_time: string
}

const toast = useToast()
const loading = ref(false)
const loadError = ref('')
const notifications = ref<Notification[]>([])
const filterType = ref('')
const detailVisible = ref(false)
const currentNotif = ref<Notification | null>(null)

const unreadCount = computed(() => notifications.value.filter((n) => n.status !== 3).length)
const filteredList = computed(() =>
  filterType.value ? notifications.value.filter((n) => n.type === filterType.value) : notifications.value
)

function getTypeLabel(type: string) {
  return {
    order: t('notificationCenter.typeOrder'),
    wallet: t('notificationCenter.typeWallet'),
    system: t('notificationCenter.typeSystem'),
    refund: t('notificationCenter.typeRefund'),
    agent: t('notificationCenter.typeAgent'),
    marketing: t('notificationCenter.typeMarketing'),
    site: t('notificationCenter.typeSite'),
  }[type] || t('notificationCenter.typeOther')
}

function formatTime(timeStr: string) {
  if (!timeStr) return ''
  return timeStr.slice(0, 16).replace('T', ' ')
}

async function loadNotifications() {
  loading.value = true
  loadError.value = ''
  try {
    const res = await http.get('/notification/list', { params: { page: 1, limit: 50 } })
    notifications.value = res?.data?.data || res?.data || []
  } catch {
    loadError.value = t('notificationCenter.loadFailed')
  } finally {
    loading.value = false
  }
}

function handleOpen(n: Notification) {
  currentNotif.value = n
  detailVisible.value = true
  if (n.status !== 3) handleMarkRead(n)
}

async function handleMarkRead(n: Notification) {
  try {
    await http.post(`/notification/${n.id}/read`)
    n.status = 3
  } catch {
    toast.error(t('notificationCenter.operationFailed'))
  }
}

async function handleMarkAllRead() {
  try {
    await http.post('/notification/read-all')
    notifications.value.forEach((n) => (n.status = 3))
    toast.success(t('notificationCenter.allMarkedRead'))
  } catch {
    toast.error(t('notificationCenter.operationFailed'))
  }
}

async function handleDelete(n: Notification) {
  try {
    await http.delete(`/notification/${n.id}`)
    notifications.value = notifications.value.filter((x) => x.id !== n.id)
  } catch {
    toast.error(t('notificationCenter.deleteFailed'))
  }
}

onMounted(loadNotifications)
</script>

<style scoped>
.page-container {
  max-width: 960px;
  margin: 0 auto;
  padding: 24px 16px;
}

.page-header {
  margin-bottom: 16px;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: $text-main;
  margin: 0;
}

.page-subtitle {
  font-size: 14px;
  color: $text-sec;
  margin: 4px 0 0;
}

.stat-row {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  align-items: center;
}

.stat-card {
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  padding: 12px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 90px;
}

.stat-num {
  font-size: 22px;
  font-weight: 600;
  color: $brand-primary;
}

.stat-label {
  font-size: 12px;
  color: $text-sec;
  margin-top: 2px;
}

.mark-all-btn {
  margin-left: auto;
  padding: 6px 14px;
  background: transparent;
  border: var(--unified-border);
  color: $brand-primary;
  border-radius: var(--global-border-radius);
  cursor: pointer;
  font-size: 14px;
}

.filter-row {
  margin-bottom: 12px;
}

.filter-select {
  padding: 6px 12px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  font-size: 14px;
  background: var(--el-bg-color);
  color: $text-main;
}

.notification-list-wrap {
  min-height: 300px;
}

.notification-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.notification-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  margin-bottom: 8px;
  cursor: pointer;
  transition: border-color 0.15s;
}

.notification-item:hover {
  border-color: $brand-primary;
}

.notification-item.unread {
  border-left: 3px solid $brand-primary;
}

.notif-type {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: var(--global-border-radius);
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
  margin-top: 2px;
}

.notif-type.type-order {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.notif-type.type-wallet {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}

.notif-type.type-refund {
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning-dark-2);
}

.notif-type.type-agent {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.notif-body {
  flex: 1;
  min-width: 0;
}

.notif-title {
  font-size: 15px;
  font-weight: 500;
  color: $text-main;
  margin: 0 0 4px;
}

.notif-content {
  font-size: 14px;
  color: $text-sec;
  margin: 0 0 4px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.notif-time {
  font-size: 12px;
  color: $text-sec;
}

.del-btn {
  background: transparent;
  border: none;
  font-size: 20px;
  color: $text-sec;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}

.del-btn:hover {
  color: var(--el-color-danger);
}

.error-state,
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: $text-sec;
}

.error-icon,
.empty-icon {
  font-size: 40px;
  margin-bottom: 12px;
}

.dialog-body {
  padding: 4px 0;
}

.dialog-content {
  font-size: 14px;
  line-height: 1.6;
  color: $text-main;
  margin: 12px 0;
  white-space: pre-wrap;
}

.dialog-time {
  font-size: 12px;
  color: $text-sec;
}
</style>
