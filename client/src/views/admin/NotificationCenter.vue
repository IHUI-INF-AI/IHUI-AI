<template>
  <div class="notification-center">
    <header class="page-header">
      <h2>{{ t('notificationCenter.title') }}</h2>
      <div class="header-actions">
        <el-button :disabled="!unreadCount" @click="markAllRead">{{ t('notificationCenter.markAllRead') }}</el-button>
        <el-radio-group v-model="filter" size="small">
          <el-radio-button label="all">{{ t('notificationCenter.all') }}</el-radio-button>
          <el-radio-button label="unread">{{ t('notificationCenter.unread') }} ({{ unreadCount }})</el-radio-button>
        </el-radio-group>
      </div>
    </header>

    <el-empty v-if="!loading && items.length === 0" description="暂无通知" />
    <el-skeleton v-else-if="loading" :rows="6" animated />

    <ul v-else class="notify-list">
      <li
        v-for="n in items"
        :key="n.id"
        class="notify-item"
        :class="['level-' + n.level, { unread: !n.read }]"
        @click="onClick(n)"
      >
        <div class="notify-icon">
          <el-icon :size="20">
            <Bell v-if="n.level === 'info'" />
            <Warning v-else-if="n.level === 'warn'" />
            <CircleClose v-else />
          </el-icon>
        </div>
        <div class="notify-body">
          <div class="notify-title">
            <span>{{ n.title }}</span>
            <el-tag v-if="!n.read" size="small" type="danger" effect="dark">{{ t('notificationCenter.unread') }}</el-tag>
            <el-tag v-else size="small" type="info" effect="plain">{{ n.source }}</el-tag>
          </div>
          <div class="notify-text">{{ n.body }}</div>
          <div class="notify-meta">{{ formatTime(n.created_at) }} · {{ n.source }}</div>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Bell, Warning, CircleClose } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import http from '@/utils/request'

const { t } = useI18n()
interface NotifyItem {
  id: string
  title: string
  body: string
  level: 'info' | 'warn' | 'error'
  source: string
  created_at: string
  read: boolean
}

const items = ref<NotifyItem[]>([])
const loading = ref(false)
const filter = ref<'all' | 'unread'>('all')
let pollTimer: number | null = null

const unreadCount = computed(() => items.value.filter((n) => !n.read).length)

async function fetchList() {
  loading.value = true
  try {
    const resp: any = await http.get('/api/admin/migration/notify', {
      params: { only_unread: filter.value === 'unread', limit: 100 },
    })
    items.value = resp?.data?.items ?? []
  } catch (e) {
    ElMessage.error('加载通知失败')
  } finally {
    loading.value = false
  }
}

async function onClick(n: NotifyItem) {
  if (n.read) return
  try {
    await http.post(`/api/admin/migration/notify/${n.id}/read`)
    n.read = true
  } catch {
    // ignore
  }
}

async function markAllRead() {
  try {
    await http.post('/api/admin/migration/notify/read-all')
    items.value.forEach((n) => (n.read = true))
    ElMessage.success('已全部标记为已读')
  } catch {
    ElMessage.error('操作失败')
  }
}

function formatTime(iso: string) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString('zh-CN', { hour12: false })
}

onMounted(() => {
  fetchList()
  pollTimer = window.setInterval(fetchList, 30_000)
})
onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<style scoped lang="scss">
:where(.notification-center) {
  padding: 24px; max-width: 960px; margin: 0 auto;

  .page-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 20px;
    h2 { font-size: 20px; font-weight: 600; margin: 0; }
    .header-actions { display: flex; gap: 12px; align-items: center; }
  }

  .notify-list {
    list-style: none; padding: 0; margin: 0;
    display: flex; flex-direction: column; gap: 8px;
  }

  .notify-item {
    display: flex; gap: 12px; padding: 14px 16px;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: var(--global-border-radius);
    cursor: pointer;
    transition: background 0.15s;
    &:hover { background: var(--el-fill-color-light); }
    &.unread { border-color: var(--el-color-primary); }
    &.level-error { border-left: 3px solid var(--el-color-danger); }
    &.level-warn { border-left: 3px solid var(--el-color-warning); }
    &.level-info { border-left: 3px solid var(--el-color-primary); }
  }

  .notify-icon {
    flex-shrink: 0; width: 32px; height: 32px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 50%;
    background: var(--el-fill-color);
  }
  .level-error .notify-icon { color: var(--el-color-danger); }
  .level-warn .notify-icon { color: var(--el-color-warning); }
  .level-info .notify-icon { color: var(--el-color-primary); }

  .notify-body { flex: 1; min-width: 0; }
  .notify-title {
    display: flex; align-items: center; gap: 8px;
    font-weight: 600; font-size: 14px;
    margin-bottom: 4px;
  }
  .notify-text {
    color: var(--color-white-70); font-size: 13px; line-height: 1.6;
    word-break: break-all;
  }
  .notify-meta {
    margin-top: 4px; font-size: 11px; color: var(--color-white-40);
  }
}
</style>
