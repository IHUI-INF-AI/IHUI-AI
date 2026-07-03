<template>
  <div class="message-center">
    <!-- ① 页面头 -->
    <header class="page-header">
      <div class="header-text">
        <h1 class="page-title">{{ t('edu.message.title') }}</h1>
        <p class="page-subtitle">{{ t('edu.message.subtitle') }}</p>
      </div>
      <div class="header-actions">
        <el-tag
          v-if="unreadCount > 0"
          type="danger"
          effect="light"
          class="unread-tag"
        >
          {{ t('edu.message.unreadCount', { n: unreadCount }) }}
        </el-tag>
        <el-button :icon="Refresh" :loading="loading" @click="loadAll">
          {{ t('edu.common.retry') }}
        </el-button>
      </div>
    </header>

    <el-alert
      v-if="error"
      type="error"
      :title="t('edu.common.loadFailed')"
      show-icon
      :closable="false"
      class="error-alert"
    />

    <!-- ② 筛选 -->
    <div class="filter-bar">
      <el-radio-group v-model="filterRead" @change="handleFilterChange">
        <el-radio-button value="">{{ t('edu.message.filterAll') }}</el-radio-button>
        <el-radio-button value="unread">{{ t('edu.message.filterUnread') }}</el-radio-button>
        <el-radio-button value="read">{{ t('edu.message.filterRead') }}</el-radio-button>
      </el-radio-group>
    </div>

    <!-- ③ 消息列表 -->
    <div v-loading="loading" class="messages-body">
      <el-table
        v-if="messages.length"
        :data="messages"
        stripe
        class="message-table"
      >
        <el-table-column :label="t('edu.message.sender')" min-width="120">
          <template #default="{ row }">
            <span>{{ row.sender_name || row.sender_nickname || `#${row.sender_id ?? '-'}` }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('edu.message.msgType')" width="120">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ row.msg_type || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column
          :label="t('edu.message.messageTitle')"
          min-width="160"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <span class="msg-title" :class="{ unread: !row.is_read }">{{ row.title || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column
          :label="t('edu.message.content')"
          min-width="240"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <span class="msg-content">{{ row.content || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('edu.message.sendTime')" width="170">
          <template #default="{ row }">
            <span class="msg-time">{{ formatTime(row.created_at || row.send_time) }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('edu.message.markRead')" width="120" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.is_read" type="info" size="small" effect="plain">
              {{ t('edu.message.filterRead') }}
            </el-tag>
            <el-button
              v-else
              type="primary"
              size="small"
              link
              :loading="markingId === row.id"
              @click="handleMarkRead(row)"
            >
              {{ t('edu.message.markRead') }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 空状态 -->
      <el-empty
        v-else-if="!loading"
        :description="t('edu.message.empty')"
        class="empty-state"
      />
    </div>

    <!-- ④ 分页 -->
    <div v-if="total > 0" class="pagination-wrap">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="size"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next, jumper"
        background
        @current-change="loadMessages"
        @size-change="handleSizeChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { messageApi } from '@/api/edu'

interface MessageItem {
  id?: number
  sender_id?: number
  sender_name?: string
  sender_nickname?: string
  msg_type?: string
  title?: string
  content?: string
  is_read?: boolean
  created_at?: string
  send_time?: string
  [key: string]: unknown
}

const { t } = useI18n()

const loading = ref(false)
const error = ref(false)
const messages = ref<MessageItem[]>([])
const total = ref(0)
const page = ref(1)
const size = ref(10)
const filterRead = ref<'' | 'unread' | 'read'>('')
const unreadCount = ref(0)
const markingId = ref<number | null>(null)

async function loadUnreadCount() {
  try {
    const res = await messageApi.unreadCount()
    const data = res.data?.data
    unreadCount.value = data?.unread_count ?? 0
  } catch {
    // 未读数加载失败不影响主流程
  }
}

async function loadMessages() {
  loading.value = true
  error.value = false
  try {
    const params: { page: number; size: number; is_read?: boolean } = {
      page: page.value,
      size: size.value,
    }
    if (filterRead.value === 'unread') params.is_read = false
    else if (filterRead.value === 'read') params.is_read = true

    const res = await messageApi.inbox(params)
    const data = res.data?.data
    if (data) {
      messages.value = data.items as MessageItem[]
      total.value = data.total
    } else {
      messages.value = []
      total.value = 0
    }
  } catch (_e) {
    error.value = true
    messages.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

async function loadAll() {
  await Promise.all([loadMessages(), loadUnreadCount()])
}

function handleFilterChange() {
  page.value = 1
  loadMessages()
}

function handleSizeChange() {
  page.value = 1
  loadMessages()
}

async function handleMarkRead(row: MessageItem) {
  if (!row.id || markingId.value !== null) return
  markingId.value = row.id
  try {
    await messageApi.markRead(row.id)
    row.is_read = true
    unreadCount.value = Math.max(0, unreadCount.value - 1)
    ElMessage.success(t('edu.message.markReadSuccess'))
  } catch {
    // 标记失败由全局错误处理提示
  } finally {
    markingId.value = null
  }
}

function formatTime(value?: string): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

onMounted(loadAll)
</script>

<style scoped lang="scss">
.message-center {
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
  align-items: center;
  gap: 12px;
}

.unread-tag {
  border-radius: 8px;
}

.error-alert {
  margin: 0;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
}

.messages-body {
  min-height: 200px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
}

.message-table {
  border-radius: 8px;
}

.msg-title.unread {
  font-weight: 600;
  color: var(--el-color-primary);
}

.msg-content {
  color: var(--el-text-color-regular);
}

.msg-time {
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
:deep(.el-radio-button__inner) {
  transition: border-color 0.2s ease, color 0.2s ease, background-color 0.2s ease;
  box-shadow: none !important;
  border-radius: 0;
}

:deep(.el-radio-button:first-child .el-radio-button__inner) {
  border-top-left-radius: 8px;
  border-bottom-left-radius: 8px;
}

:deep(.el-radio-button:last-child .el-radio-button__inner) {
  border-top-right-radius: 8px;
  border-bottom-right-radius: 8px;
}

:deep(.el-radio-button__original-radio:focus-visible + .el-radio-button__inner) {
  box-shadow: none !important;
}

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
