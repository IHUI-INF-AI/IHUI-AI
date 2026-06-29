<template>
  <div class="message-center-page page-container">
    <div class="page-header">
      <h1 class="page-title">{{ t('messageCenter.title') }}</h1>
      <p class="page-subtitle">{{ t('messageCenter.subtitle') }}</p>
    </div>

    <div class="message-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        :class="['tab-btn', { active: activeTab === tab.key }]"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
        <span v-if="tab.count > 0" class="tab-badge">{{ tab.count }}</span>
      </button>
      <button class="mark-all-btn" @click="handleMarkAllRead">{{ t('messageCenter.markAllRead') }}</button>
    </div>

    <div v-loading="loading" class="message-list-wrap">
      <div v-if="loadError" class="error-state">
        <div class="error-icon">⚠</div>
        <p>{{ loadError }}</p>
        <el-button type="primary" size="small" @click="loadMessages">{{ t('common.retry') }}</el-button>
      </div>

      <div v-else-if="messages.length === 0" class="empty-state">
        <div class="empty-icon">📭</div>
        <p>{{ t('messageCenter.empty') }}</p>
      </div>

      <ul v-else class="message-list">
        <li
          v-for="m in messages"
          :key="m.id"
          :class="['message-item', { unread: !m.is_read, top: m.is_top }]"
          @click="handleOpen(m)"
        >
          <div class="message-head">
            <span :class="['message-type', `type-${m.type}`]">{{ getTypeLabel(m.type) }}</span>
            <span v-if="m.is_top" class="top-flag">{{ t('messageCenter.topFlag') }}</span>
            <span class="message-time">{{ formatTime(m.create_time) }}</span>
          </div>
          <h3 class="message-title">{{ m.title }}</h3>
          <p class="message-content">{{ m.content }}</p>
          <div class="message-actions">
            <button v-if="!m.is_read" class="action-btn" @click.stop="handleMarkRead(m)">{{ t('messageCenter.markRead') }}</button>
            <button class="action-btn danger" @click.stop="handleDelete(m)">{{ t('common.delete') }}</button>
          </div>
        </li>
      </ul>
    </div>

    <el-dialog v-model="detailVisible" :title="currentMessage?.title || t('messageCenter.detailTitle')" width="520px">
      <div v-if="currentMessage" class="dialog-body">
        <div class="dialog-meta">
          <span :class="['message-type', `type-${currentMessage.type}`]">{{ getTypeLabel(currentMessage.type) }}</span>
          <span class="dialog-time">{{ formatTime(currentMessage.create_time) }}</span>
        </div>
        <p class="dialog-content">{{ currentMessage.content }}</p>
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

interface Message {
  id: number
  user_id: string
  type: string
  title: string
  content: string
  is_read: boolean
  is_top: boolean
  create_time: string
}

const toast = useToast()
const loading = ref(false)
const loadError = ref('')
const messages = ref<Message[]>([])
const activeTab = ref('all')
const detailVisible = ref(false)
const currentMessage = ref<Message | null>(null)

const tabs = computed(() => [
  { key: 'all', label: t('messageCenter.tabAll'), count: messages.value.length },
  { key: 'system', label: t('messageCenter.tabSystem'), count: messages.value.filter((m) => m.type === 'system').length },
  { key: 'private', label: t('messageCenter.tabPrivate'), count: messages.value.filter((m) => m.type === 'private').length },
])

const _filteredMessages = computed(() => {
  if (activeTab.value === 'all') return messages.value
  return messages.value.filter((m) => m.type === activeTab.value)
})

function getTypeLabel(type: string) {
  return { system: t('messageCenter.typeSystem'), private: t('messageCenter.typePrivate'), notice: t('messageCenter.typeNotice') }[type] || t('messageCenter.typeOther')
}

function formatTime(time: string) {
  if (!time) return ''
  return time.slice(0, 16).replace('T', ' ')
}

async function loadMessages() {
  loading.value = true
  loadError.value = ''
  try {
    const res = await http.get('/message/list', { params: { page: 1, limit: 50 } })
    messages.value = res?.data?.data || res?.data || []
  } catch (_e) {
    loadError.value = t('messageCenter.loadFailed')
  } finally {
    loading.value = false
  }
}

async function _loadUnreadCount() {
  try {
    const res = await http.get('/message/unread-count')
    return res?.data?.count || 0
  } catch {
    return 0
  }
}

function handleOpen(m: Message) {
  currentMessage.value = m
  detailVisible.value = true
  if (!m.is_read) handleMarkRead(m)
}

async function handleMarkRead(m: Message) {
  try {
    await http.post(`/message/${m.id}/read`)
    m.is_read = true
  } catch {
    toast.error(t('messageCenter.operateFailed'))
  }
}

async function handleMarkAllRead() {
  try {
    await http.post('/message/read-all')
    messages.value.forEach((m) => (m.is_read = true))
    toast.success(t('messageCenter.allMarkedRead'))
  } catch {
    toast.error(t('messageCenter.operateFailed'))
  }
}

async function handleDelete(m: Message) {
  try {
    await http.delete(`/message/${m.id}`)
    messages.value = messages.value.filter((x) => x.id !== m.id)
    toast.success(t('messageCenter.deleted'))
  } catch {
    toast.error(t('messageCenter.deleteFailed'))
  }
}

onMounted(loadMessages)
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

.message-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.tab-btn {
  padding: 6px 14px;
  border: var(--unified-border);
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  cursor: pointer;
  font-size: 14px;
  color: $text-main;
  display: flex;
  align-items: center;
  gap: 6px;
}

.tab-btn.active {
  border-color: $brand-primary;
  color: $brand-primary;
}

.tab-badge {
  background: $brand-primary;
  color: var(--el-bg-color);
  font-size: 12px;
  padding: 0 6px;
  border-radius: var(--global-border-radius);
  min-width: 18px;
  text-align: center;
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

.message-list-wrap {
  min-height: 300px;
}

.message-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.message-item {
  padding: 14px 16px;
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  margin-bottom: 8px;
  cursor: pointer;
  transition: border-color 0.15s;
}

.message-item:hover {
  border-color: $brand-primary;
}

.message-item.unread {
  background: var(--el-fill-color-lighter);
  border-left: 3px solid $brand-primary;
}

.message-item.top {
  border-top: 2px solid var(--color-rank-gold);
}

.message-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.message-type {
  font-size: 12px;
  padding: 1px 6px;
  border-radius: var(--global-border-radius);
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
}

.message-type.type-system {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.message-type.type-private {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

.top-flag {
  font-size: 12px;
  color: var(--color-rank-gold);
}

.message-time {
  margin-left: auto;
  font-size: 12px;
  color: $text-sec;
}

.message-title {
  font-size: 15px;
  font-weight: 500;
  color: $text-main;
  margin: 0 0 4px;
}

.message-content {
  font-size: 14px;
  color: $text-sec;
  margin: 0;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.message-actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.action-btn {
  background: transparent;
  border: none;
  color: $text-sec;
  font-size: 13px;
  cursor: pointer;
  padding: 0;
}

.action-btn:hover {
  color: $brand-primary;
}

.action-btn.danger:hover {
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

.dialog-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: var(--unified-border-bottom);
}

.dialog-time {
  margin-left: auto;
  font-size: 12px;
  color: $text-sec;
}

.dialog-content {
  font-size: 14px;
  line-height: 1.6;
  color: $text-main;
  margin: 0;
  white-space: pre-wrap;
}
</style>
