<template>
  <div class="notification-center">
    <header class="page-header">
      <h2>{{ t('notificationCenter.title') }}</h2>
      <div class="header-actions">
        <el-button :disabled="!unreadCount" @click="markAllRead">{{ t('notificationCenter.markAllRead') }}</el-button>
        <el-radio-group v-model="readFilter" size="small">
          <el-radio-button label="all">{{ t('notificationCenter.all') }}</el-radio-button>
          <el-radio-button label="unread">
            <span class="unread-label">
              {{ t('notificationCenter.unread') }} ({{ unreadDisplay }})
              <span
                v-if="unreadCount > 0"
                class="unread-dot"
                :title="`${unreadCount} 条未读`"
              ></span>
            </span>
          </el-radio-button>
        </el-radio-group>
        <el-radio-group v-model="levelFilter" size="small">
          <el-radio-button label="all">{{ t('notificationCenter.allTypes') }}</el-radio-button>
          <el-radio-button label="info">
            <el-icon :size="12"><Bell /></el-icon>
            <span>{{ t('notificationCenter.level.info') }}</span>
          </el-radio-button>
          <el-radio-button label="warn">
            <el-icon :size="12"><Warning /></el-icon>
            <span>{{ t('notificationCenter.level.warn') }}</span>
          </el-radio-button>
          <el-radio-button label="error">
            <el-icon :size="12"><CircleClose /></el-icon>
            <span>{{ t('notificationCenter.level.error') }}</span>
          </el-radio-button>
        </el-radio-group>
      </div>
    </header>

    <el-empty v-if="!loading && items.length === 0" description="暂无通知" />
    <el-empty v-else-if="!loading && filteredItems.length === 0" description="当前过滤条件下无通知" />
    <el-skeleton v-else-if="loading" :rows="6" animated />

    <ul v-else class="notify-list">
      <li
        v-for="n in filteredItems"
        :key="n.id"
        class="notify-item"
        :class="['level-' + n.level, { unread: !n.read, topped: n.top }]"
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
            <!-- 级别标签 (统一从 LEVEL_LABEL 翻译) -->
            <el-tag :type="n.level === 'error' ? 'danger' : n.level === 'warn' ? 'warning' : 'info'" size="small" effect="plain">
              {{ t(LEVEL_LABEL[n.level]) }}
            </el-tag>
            <!-- 置顶徽章 (P1: error 级别自动置顶) -->
            <span v-if="n.top" class="top-badge" :title="'已置顶'">
              <el-icon :size="12"><Top /></el-icon>
              <span>置顶</span>
            </span>
            <!-- 来源 (已读时显示, 顶部一处, meta 不再重复) -->
            <span v-if="n.read" class="source-tag">{{ n.source }}</span>
          </div>
          <div class="notify-text">{{ n.body }}</div>
          <div class="notify-meta">{{ formatTime(n.created_at) }}</div>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
// 2026-06-25 修复 ESLint:
//   - InfoFilled import 未在模板中使用, 删除避免 no-unused-vars
//   - fetchList 中 catch (e) 中 e 未使用, 改为 catch
//   - onUnmounted + clearInterval 改用 useCleanup, 触发 ihui/no-manual-cleanup
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Bell, Warning, CircleClose, Top } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import http from '@/utils/request'
import { useNotifyBadge } from '@/composables/useNotifyBadge'
import { useCleanup } from '@/composables/useCleanup'

const { t } = useI18n()
const cleanup = useCleanup()
interface NotifyItem {
  id: string
  title: string
  body: string
  level: 'info' | 'warn' | 'error'
  source: string
  created_at: string
  read: boolean
  top?: boolean  // 置顶 (P1: error 级别自动置顶)
}

const items = ref<NotifyItem[]>([])
const loading = ref(false)
/** 已读/未读过滤 (单选). */
const readFilter = ref<'all' | 'unread'>('all')
/** 级别过滤 (单选). */
const levelFilter = ref<'all' | 'info' | 'warn' | 'error'>('all')
/** 复用菜单红点的全局未读数 (模块级单例, 与 useNotifyBadge 共享同一 ref). */
const { unreadCount, setUnread } = useNotifyBadge()

/** 顶部 toolbar 显示: 999+ 格式化 (与 Menu.vue 红点保持一致). */
const unreadDisplay = computed(() => (unreadCount.value > 999 ? '999+' : String(unreadCount.value)))

/** level→i18n key 映射, 集中维护. */
const LEVEL_LABEL: Record<NotifyItem['level'], string> = {
  info: 'notificationCenter.level.info',
  warn: 'notificationCenter.level.warn',
  error: 'notificationCenter.level.error',
}

/** 客户端二次过滤: 已读状态 + 级别. */
const filteredItems = computed(() => {
  let arr = items.value
  if (readFilter.value === 'unread') {
    arr = arr.filter((n) => !n.read)
  }
  if (levelFilter.value !== 'all') {
    arr = arr.filter((n) => n.level === levelFilter.value)
  }
  return arr
})

async function fetchList() {
  loading.value = true
  try {
    // 后端只支持 only_unread 一维过滤, levelFilter 由前端 filteredItems 完成
    const resp: any = await http.get('/api/admin/migration/notify', {
      params: { only_unread: readFilter.value === 'unread', limit: 100 },
    })
    items.value = resp?.data?.items ?? []
    // P1: 未读数由 useNotifyBadge 全局轮询, 列表拉取后无需再拉一次
  } catch {
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
    // 乐观更新: 减 1 (夹在 0..∞) + 同步菜单红点
    setUnread(Math.max(0, unreadCount.value - 1))
  } catch {
    // ignore
  }
}

async function markAllRead() {
  try {
    await http.post('/api/admin/migration/notify/read-all')
    items.value.forEach((n) => (n.read = true))
    setUnread(0)  // 立即清零, 同步菜单红点, 不等下次轮询
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
  // 2026-06-25 修复 ESLint ihui/no-manual-cleanup: 改用 useCleanup.addInterval
  // 统一管理定时器清理, 组件卸载时自动 clearInterval
  cleanup.addInterval(fetchList, 30_000)
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

  /* 未读红点 (与 Menu.vue 风格一致, 扁平化, 纯背景色) */
  .unread-label {
    display: inline-flex; align-items: center; gap: 6px;
  }

  .unread-dot {
    display: inline-block;
    width: 8px; height: 8px;
    border-radius: 50%;
    background: var(--el-color-danger);
  }
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

  /* 置顶徽章 (P1: 扁平化, 纯背景色) */
  .top-badge {
    display: inline-flex; align-items: center; gap: 2px;
    padding: 1px 6px;
    font-size: 12px; font-weight: 500;
    border-radius: var(--global-border-radius);
    background: var(--el-color-danger-light-9);
    color: var(--el-color-danger);
    border: 1px solid var(--el-color-danger-light-7);
  }

  /* 来源标签 (已读时显示) */
  .source-tag {
    font-size: 12px;
    padding: 1px 6px;
    border-radius: var(--global-border-radius);
    color: var(--color-white-50);
    background: var(--color-white-8);
    border: 1px solid var(--el-border-color-lighter);
  }

  /* 置顶行视觉强化 (轻微背景色 + 边框粗) */
  .notify-item.topped {
    background: var(--el-color-danger-light-9);
    border-color: var(--el-color-danger-light-5);
  }

  .notify-text {
    color: var(--color-white-70); font-size: 13px; line-height: 1.6;
    word-break: break-all;
  }

  .notify-meta {
    margin-top: 4px; font-size: 12px; color: var(--color-white-40);
  }
}
</style>
