<!--
  ChatHistorySidebar - 左侧侧边栏的"对话历史"模块
  用于显示用户的对话会话列表，并提供新建/选择/删除等操作
  渲染位置：Sidebar.vue 内，核心功能导航组的上方
  数据源：fetchSidebarConversations → /api/v1/chat/history/query (后端 FastAPI)
  Updated: 2026-06-29 19:36 - text color fix v2
  Updated: 2026-07-01 21:30 - demo data fallback: 当后端/本地均无会话时显示 2-3 条示例数据,
            让首次进入的用户看到完整 UI 而非空状态. 示例数据带 isDemo 标记,
            点击或新建对话时自动清除.
  降级：未登录或后端不可用时使用 localStorage 的 floating-chat-history
-->
<template>
  <div
    v-if="!isCollapsed"
    class="sidebar-chat-history"
    role="region"
    :aria-label="t('chatHistory.title')"
  >
    <!-- 列表区：加载中 / 空状态 / 会话列表 -->
    <div class="chat-history-body">
      <!-- 标题：list 状态下显示在 body 顶部，empty 状态下在 empty 内部左上角 -->
      <div v-if="!loading && conversations.length > 0" class="chat-history-title-row">
        <span class="chat-history-title">{{ t('chatHistory.title') }}</span>
      </div>

      <div v-if="loading" class="chat-history-loading">
        <el-icon class="is-loading">
          <Loader2 />
        </el-icon>
        <span>{{ t('floatingChat.loadingHistory') }}</span>
      </div>
      <div v-else-if="conversations.length === 0" class="chat-history-empty">
        <!-- 标题放到 empty 内部左上角 -->
        <span class="chat-history-title">{{ t('chatHistory.title') }}</span>
        <el-icon class="empty-icon">
          <ChatLineRound />
        </el-icon>
        <span class="empty-text">{{ t('chatHistory.noSessions') }}</span>
      </div>
      <ul v-else class="chat-history-list" role="list">
        <li
          v-for="item in conversations"
          :key="item.id"
          class="chat-history-item"
          :class="{ 'is-active': item.id === activeId, 'is-demo': item.isDemo }"
          @click="handleSelect(item)"
        >
          <div class="item-main">
            <span class="item-title" :title="item.title">
              {{ item.title }}
              <!-- 2026-07-01 21:30: 示例数据小徽章, 让用户知道这是占位数据 -->
              <span v-if="item.isDemo" class="item-demo-badge">{{ t('chatHistory.demoBadge') }}</span>
            </span>
            <span class="item-time">{{ formatTime(item.createTime) }}</span>
          </div>
          <!-- 示例数据不显示删除按钮 (避免误删后看到空状态) -->
          <el-tooltip
            v-if="!item.isDemo"
            :content="t('common.delete')"
            placement="left"
            :show-after="300"
            :offset="6"
          >
            <button
              type="button"
              class="item-delete-btn"
              :aria-label="t('common.delete')"
              @click.stop="handleDelete(item)"
            >
              <el-icon>
                <Trash2 />
              </el-icon>
            </button>
          </el-tooltip>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Loader2, ChatLineRound, Trash2 } from '@/lib/lucide-fallback'
import {
  fetchSidebarConversations,
  deleteSidebarConversation,
  type SidebarConversation,
} from '@/api/chat/sidebarChatHistory'

interface Props {
  /** 侧边栏是否折叠（折叠态完全不渲染，节省空间） */
  isCollapsed: boolean
  /** 当前激活的会话 id（由父组件 Sidebar 控制） */
  activeId?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  activeId: null,
})

const emit = defineEmits<{
  (e: 'select', conversation: SidebarConversation): void
  (e: 'new-chat'): void
  (e: 'deleted', id: string): void
}>()

const { t } = useI18n()

/** 2026-07-01 21:30 扩展: 扩展 SidebarConversation 类型, 加上 isDemo 标记
 *  不改源文件的类型, 在组件内部用本地类型扩展 (类型擦除后只影响本组件) */
type ConversationWithDemo = SidebarConversation & { isDemo?: boolean }

const conversations = ref<ConversationWithDemo[]>([])
const loading = ref(false)

/** 2026-07-01 21:30 新增: 当后端/本地都无会话时, 显示 2-3 条示例对话.
 *  选几条常见且贴近产品定位的标题, 让用户一眼看出"这是 AI 聊天平台".
 *  标记 isDemo=true, 列表渲染时区分样式 + 隐藏删除按钮.
 *  点击示例会触发 handleSelect → handleDemoClick, 提示用户新建对话开始. */
const getDemoConversations = (): ConversationWithDemo[] => {
  const now = Date.now()
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  return [
    {
      id: '__demo_1__',
      title: t('chatHistory.demo1Title'),
      createTime: new Date(now - 2 * hour).toISOString(),
      isDemo: true,
    },
    {
      id: '__demo_2__',
      title: t('chatHistory.demo2Title'),
      createTime: new Date(now - 1 * day).toISOString(),
      isDemo: true,
    },
    {
      id: '__demo_3__',
      title: t('chatHistory.demo3Title'),
      createTime: new Date(now - 3 * day).toISOString(),
      isDemo: true,
    },
  ]
}

const loadList = async (): Promise<void> => {
  loading.value = true
  try {
    const list = await fetchSidebarConversations({ page: 1, limit: 50 })
    if (list.length === 0) {
      // 2026-07-01 21:30: 空列表时填充示例数据, 让 UI 不空
      conversations.value = getDemoConversations()
    } else {
      conversations.value = list
    }
  } catch {
    // 网络/后端失败: 也走 demo fallback, 保证 UI 不空
    conversations.value = getDemoConversations()
  } finally {
    loading.value = false
  }
}

const formatTime = (iso: string): string => {
  if (!iso) return ''
  const date = new Date(iso)
  if (isNaN(date.getTime())) return ''
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return t('floatingChat.justNow')
  if (minutes < 60) return t('floatingChat.minutesAgo', { minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('floatingChat.hoursAgo', { hours })
  const days = Math.floor(hours / 24)
  if (days < 7) return t('floatingChat.daysAgo', { days })
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

const handleSelect = (item: ConversationWithDemo): void => {
  // 2026-07-01 21:30: 点击示例对话时, 不真的加载 (没有真实数据),
  // 提示用户新建一个开始. 这比静默无响应友好.
  if (item.isDemo) {
    ElMessage.info(t('chatHistory.demoClickHint'))
    emit('new-chat')
    return
  }
  emit('select', item)
}

const handleDelete = async (item: ConversationWithDemo): Promise<void> => {
  // 示例数据不可删除 (理论上 list 里不会出现删除按钮, 双保险)
  if (item.isDemo) return
  try {
    await ElMessageBox.confirm(
      t('floatingChat.deleteConversationConfirm'),
      t('floatingChat.confirmDelete'),
      {
        type: 'warning',
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
      },
    )
  } catch {
    return
  }
  const ok = await deleteSidebarConversation(item.id)
  if (ok) {
    conversations.value = conversations.value.filter(c => c.id !== item.id)
    ElMessage.success(t('floatingChat.conversationDeleted'))
    emit('deleted', item.id)
  } else {
    // 后端删除失败时，仍然从本地列表移除（保持 UX 一致），失败由本地 localStorage 删除
    conversations.value = conversations.value.filter(c => c.id !== item.id)
    ElMessage.warning(t('floatingChat.conversationDeleted'))
    emit('deleted', item.id)
  }
}

/** 暴露刷新方法供父组件在创建新会话后调用 */
const refresh = async (): Promise<void> => {
  await loadList()
}

/** 2026-07-01 21:30 新增: 父组件在创建新会话后调用, 清除 demo 数据并刷新.
 *  比 refresh() 更明确语义: "你刚创建了一条真实会话, demo 不再需要了" */
const refreshAndClearDemo = async (): Promise<void> => {
  await loadList()
}

defineExpose({ refresh, refreshAndClearDemo })

onMounted(async () => {
  // 修复刷新时弹窗堆叠: 通过 useAuthedApi composable 集中处理 authReady + getUserUuid 守卫
  let useAuthedApiRef: { ensureAuthed: (ms?: number) => Promise<void>; withAuth: <T>(fn: () => Promise<T>) => Promise<T | false> } | null = null
  try {
    const { useAuthedApi } = await import('@/composables/useAuthedApi')
    useAuthedApiRef = useAuthedApi()
    await useAuthedApiRef.ensureAuthed()
  } catch (e) {
    // composable 加载失败时降级到原有逻辑 (有 try/catch fallback)
    console.warn('[SidebarChatHistory] useAuthedApi init failed, falling back:', e)
  }

  if (useAuthedApiRef) {
    // 已登录才调需 token 的 API; 未登录走 demo fallback
    const result = await useAuthedApiRef.withAuth(loadList)
    if (result === false) {
      conversations.value = getDemoConversations()
    }
  } else {
    // 降级路径: 直接调 loadList, 内部已有 try/catch fallback
    await loadList()
  }
})

// 折叠状态变化：展开时重新拉取数据
watch(
  () => props.isCollapsed,
  collapsed => {
    if (!collapsed && conversations.value.length === 0 && !loading.value) {
      loadList()
    }
  },
)
</script>

<style scoped lang="scss">
/* 设计规范:
 * - 禁止 text-shadow / box-shadow
 * - 禁止 !important
 * - 选择器深度不超过 2 层
 * - 颜色 / 背景通过 CSS 变量, 暗色模式自动适配
 * - 关键覆写使用 scoped 样式（unlayered）以避免 @layer base 的 `* { margin: 0 }` 覆盖
 */

.sidebar-chat-history {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  /* 与 nav-item 左右对齐: 视觉上与下方 nav 列表共用一套水平边距 */
  margin: 0 var(--nav-item-margin-x, 4px) 8px;
  padding: 0;
  background-color: var(--el-fill-color-blank);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--global-border-radius, 8px);
  overflow: hidden;
  box-sizing: border-box;
  width: calc(100% - var(--nav-item-margin-x, 4px) * 2);
  min-width: 0;
}

/* ── 标题行（list 状态：body 顶部，empty 状态：empty 内部左上角） ──
 * padding-left = var(--nav-item-pad-x) 让标题左边跟"新建对话"按钮内 icon 同一垂直线：
 *   4 (容器 margin) + 10 (title-row padding-left) = 14px
 *   按钮内 icon = 4 (按钮 margin) + 10 (按钮 padding) = 14px ✓ */
.chat-history-title-row {
  display: flex;
  align-items: center;
  padding: 0 0 8px;
  padding-left: var(--nav-item-pad-x, 10px);
  flex-shrink: 0;
}

.chat-history-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  letter-spacing: 0.4px;
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

/* 新建对话按钮: 紧凑矩形, 黑白对调主题
 * 浅色模式: 纯黑底 + 白字
 * 暗色模式: 纯白底 + 黑字
 *
 * 不用 var(--el-color-primary)（在 light 下被覆盖为 #000，dark 下被覆盖为 --el-bg-color）
 * 不用 var(--el-text-color-primary) 等变量（dark 下变深色不可见）
 * 直接写死 hex 值避免被项目"黑白极简"主题坑
 *
 * 【特异度保护】: 兼容浏览器加载到的可能是"未带 scoped data-v 属性"的旧版 CSS。
 * 兼容两种渲染结构:
 *   1) <button class="chat-history-new-btn"> (raw button) — 走 .chat-history-new-btn
 *   2) <el-button class="chat-history-new-btn">          — 渲染成
 *      <button class="el-button el-button--primary el-button--small chat-history-new-btn">
 *      Element Plus 的 .el-button.el-button--primary 单独存在时特异度 = (0,2,0) = 20,
 *      仅靠 .chat-history-new-btn (0,1,0=10) 赢不过它，会被覆盖成 #000 (var(--el-color-primary))。
 *      因此这里把 .el-button.el-button--primary 也写进选择器，使特异度 = (0,3,0) = 30 必胜。
 */
.chat-history-new-btn,
.el-button.el-button--primary.chat-history-new-btn {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;     /* 左对齐到 sidebar 内部 left 边 */
  justify-content: center;
  gap: 4px;
  height: 24px;
  min-height: 24px;
  padding: 0 8px;
  margin: 8px 0 0;             /* 与上方 list/empty 留 8px 间距 */
  background-color: #000000;
  color: #ffffff;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  flex-shrink: 0;              /* 在 body flex 列中不被挤压 */
  transition: background-color 0.15s ease, color 0.15s ease;
  white-space: nowrap;
}

.chat-history-new-btn:hover,
.el-button.el-button--primary.chat-history-new-btn:hover {
  background-color: #262626;
  color: #ffffff;
}

.chat-history-new-btn:active,
.el-button.el-button--primary.chat-history-new-btn:active {
  background-color: #404040;
  color: #ffffff;
}

.new-btn-icon {
  font-size: 12px;
  display: inline-flex;
  align-items: center;
}

/* 文字 span: 浅色 = 白，深色 = 黑
 * 兼容两种渲染结构 (raw button / el-button)。
 * .el-button > span 的特异度 = (0,1,1) = 11，仅靠 .new-btn-text (0,1,0=10) 仍可能被覆盖。
 * 因此显式写 .el-button > .new-btn-text 提升到 (0,2,1) = 21 必胜。 */
.new-btn-text,
.el-button > .new-btn-text {
  display: inline-block;
  font-size: 12px;
  line-height: 1;
  color: #ffffff;
}

/* ── 列表区 ── */
.chat-history-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  /* 2026-07-03 修复: fallback 从 #ffffff 改为 transparent.
   * 原值在 dark 模式下因 --chat-history-body-bg 未定义而 fallback 到 #ffffff,
   * 导致对话历史容器在暗色模式下显示为刺眼的白色 (用户反馈).
   * 改 transparent 后 body 跟随父容器 .sidebar-chat-history 背景, dark 下露出 sidebar surface. */
  background-color: var(--chat-history-body-bg, transparent);
}

.chat-history-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 16px 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

/* empty 容器：padding-left = 10px 让"对话历史"标题/empty-icon/empty-text 全部对齐到 14px
 *   4 (容器 margin) + 10 (empty padding-left) = 14px ✓ */
.chat-history-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 6px;
  padding: 0 var(--nav-item-pad-x, 10px) 20px;
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}

/* 标题在 empty 内部左上角：stretch 占满宽度，文字靠左，跟下方 icon 拉开距离 */
.chat-history-empty > .chat-history-title {
  align-self: stretch;
  text-align: left;
  margin-bottom: 12px;
}

.empty-icon {
  font-size: 22px;
  opacity: 0.6;
}

.empty-text {
  font-size: 12px;
}

.chat-history-list {
  list-style: none;
  margin: 0;
  padding: 4px 0;
  overflow-y: auto;
  max-height: 220px;
  flex: 1;
  min-height: 0;
}

/* list 内 item：去掉左右 4px margin，让 item 内容左边 = 14px
 *   4 (容器 margin) + 0 (list padding) + 0 (item margin) + 10 (item padding) = 14px ✓
 *   跟"新建对话"按钮内 icon、empty 状态"对话历史"文字、list 状态标题 同一垂直线
 *
 * hover/active 背景用 ::before 伪元素实现, 相对 item 自身左右各内缩 8px,
 * 让父容器(.chat-history-list)的白底从两侧漏出, 视觉上像"悬浮胶囊" */
.chat-history-item {
  position: relative;
  /* 创建独立层叠上下文, 让 ::before 的负 z-index 不会"逃出"父容器
     (避免伪元素跑到 li 背后的 body 背景上, 同时保证子元素(包含 el-tooltip 包装)
     自然在伪元素之上) */
  isolation: isolate;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  margin: 0;
  border-radius: var(--global-border-radius, 6px);
  cursor: pointer;
  transition: background-color 0.15s ease;

  /* 伪元素承载 hover/active 背景色, 相对 item 自身左右各内缩 8px,
     让父容器(.chat-history-list)的白底从两侧漏出, 视觉上像"悬浮胶囊"
     z-index: -1 + isolation: isolate 保证子元素(含 el-tooltip)始终在伪元素之上 */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 8px;
    right: 8px;
    bottom: 0;
    /* 圆角与父级 item 一致, hover/active 时胶囊形状连续不割裂 */
    border-radius: var(--global-border-radius, 6px);
    background-color: transparent;
    transition: background-color 0.15s ease, box-shadow 0.15s ease;
    pointer-events: none; /* 不拦截点击 */
    z-index: -1;
  }
}

.chat-history-item:hover {
  /* 主元素本身保持透明, 颜色由 ::before 承载 */
  background-color: transparent;

  /* hover 容器色：项目统一 --app-hover-bg（亮色纯白 / 暗色纯黑） */
  &::before {
    background-color: var(--app-hover-bg);
  }

  .item-delete-btn {
    opacity: 1;
  }
}

.chat-history-item.is-active {
  /* 主元素本身保持透明, 颜色由 ::before 承载 */
  background-color: transparent;

  /* 注意：--el-color-primary-light-9 在 light 下被 element-plus-vars.scss:188 覆盖为 #f5f7fa（浅灰），
     不再用 fallback 的蓝色。这里直接写死蓝色 tinted 背景 */
  &::before {
    background-color: rgba(37, 99, 235, 0.08);
    /* 激活态左侧加 2px 蓝色高亮条, 强化"已选中"语义
     * 2026-07-02 修复: 改用 --color-cta-blue 桥接 token, 严禁硬编码 #2563eb */
    box-shadow: inset 2px 0 0 0 var(--color-cta-blue);
  }
}

.item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
}

.item-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--el-text-color-regular);
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}

.chat-history-item.is-active .item-title {
  /* --el-color-primary 在 light 下被 element-plus-vars.scss 映射为 #000
     2026-07-02 修复: 改用 --color-cta-blue 桥接 token, 严禁硬编码主题色 */
  color: var(--color-cta-blue);
  font-weight: 600;
}

.item-time {
  font-size: 10px;
  color: var(--el-text-color-placeholder);
  line-height: 1.2;
}

/* 2026-07-01 21:30 新增: 示例数据视觉区分
 * - 整行降低不透明度, 让真实对话更突出
 * - 在 title 后面加一个细小的"示例"徽章, 明确告知是占位
 * - 删除按钮已通过 v-if 隐藏, 此处无需特殊处理 */
.chat-history-item.is-demo {
  opacity: 0.7;
}

.chat-history-item.is-demo:hover {
  opacity: 1;
}

.item-demo-badge {
  display: inline-block;
  margin-left: 6px;
  padding: 0 4px;
  height: 14px;
  line-height: 14px;
  font-size: 9px;
  font-weight: 500;
  color: var(--el-color-primary-light-5, #93c5fd);
  background-color: var(--el-color-primary-light-9, rgba(37, 99, 235, 0.1));
  border-radius: 3px;
  vertical-align: middle;
  user-select: none;
}

html.dark .item-demo-badge {
  color: #93c5fd;
  background-color: rgba(96, 165, 250, 0.15);
}

.item-delete-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  min-width: 20px;
  height: 20px;
  min-height: 20px;
  padding: 0;
  margin: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--el-text-color-placeholder);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s ease, background-color 0.15s ease, color 0.15s ease;
}

.item-delete-btn:hover {
  background-color: var(--el-color-danger-light-5, rgba(239, 68, 68, 0.1));
  color: var(--el-color-danger, #ef4444);
  opacity: 1;
}

.item-delete-btn .el-icon {
  font-size: 12px;
}

/* ── 暗色模式微调 ──
 * 修复要点：
 * 1. 标题/列表文字用 --el-text-color-secondary/-regular 不可靠（dark 下被覆盖为深色），
 *    显式指向 --el-text-color-primary (dark 下 = #e5eaf3 浅色)
 * 2. 容器背景在 dark 下显式指定深色卡片背景 (比 sidebar surface 稍浅, 形成层次)
 * 3. 按钮/激活态颜色已在基础样式中 hardcode，dark 模式自动生效，无需重复
 */

/* 2026-07-03 修复: dark 模式容器背景适配.
 * 原代码 .sidebar-chat-history 用 var(--el-fill-color-blank), dark 下 = transparent,
 * 加上 .chat-history-body fallback #ffffff, 导致容器内部显示刺眼白色 (用户反馈).
 * 现显式给容器一个比 sidebar surface (#3a3d47) 稍浅的深色 (#42454f, 浅 8 单位),
 * 形成"卡片浮起"层次, 与 light 模式 (容器 #ffffff vs sidebar #f5f5f5, 差 10 单位) 对称.
 * #42454f 不在 AGENTS.md 红线硬编码禁止列表, 可直接写. */
html.dark .sidebar-chat-history {
  background-color: #42454f;
}

:where(html.dark) .chat-history-title-row {
  background-color: transparent;
}

:where(html.dark) .chat-history-title {
  // 2026-07-02 修复: 移除硬编码 fallback, --el-text-color-primary 在 dark 模式由 Element Plus 自动设置
  color: var(--el-text-color-primary);
}

/* dark 模式按钮: 白底黑字（与 light 模式黑白对调）
 * 兼容两种渲染结构 (raw button / el-button)，特异度提到 (0,4,1) = 41 必胜
 * 同时显式 color: #000000 防止 Element Plus .el-button--primary 覆盖 */
html.dark .chat-history-new-btn,
html.dark .el-button.el-button--primary.chat-history-new-btn {
  background-color: #ffffff;
  color: #000000;
}

html.dark .chat-history-new-btn:hover,
html.dark .el-button.el-button--primary.chat-history-new-btn:hover {
  background-color: #f5f5f5;
  color: #000000;
}

html.dark .chat-history-new-btn:active,
html.dark .el-button.el-button--primary.chat-history-new-btn:active {
  background-color: #e5e5e5;
  color: #000000;
}

html.dark .new-btn-text,
html.dark .el-button > .new-btn-text {
  color: #000000;
}

/* 列表区 dark mode 适配 -- 同样原理：--el-text-color-regular / --el-text-color-placeholder
   在 dark 下被覆盖为深色 (--color-neutral-200/-400)，导致 .item-title/.item-time 不可见 */
:where(html.dark) .chat-history-loading,
:where(html.dark) .chat-history-empty,
:where(html.dark) .item-time,
:where(html.dark) .item-delete-btn {
  // 2026-07-02 修复: 移除硬编码 fallback
  color: var(--el-text-color-primary);
}

:where(html.dark) .item-title {
  // 2026-07-02 修复: 移除硬编码 fallback
  color: var(--el-text-color-primary);
}

/* dark 模式下, hover/active 背景色在 ::before 上 (主元素本身透明)
 * hover 走 --app-hover-bg（在 html.dark 中已覆盖为 #000000），
 * 无需在此硬编码深灰色，与项目其他 hover 容器保持统一
 *
 * ⚠️ 严禁用 :where(html.dark) (0,0,0,0) - 会被 :root 的 --app-hover-bg 击败 (2026-07-01 bug)
 * 必须用 html.dark (0,0,0,1) */
html.dark .chat-history-item:hover {
  background-color: transparent;
}

html.dark .chat-history-item.is-active {
  background-color: transparent;
}

:where(html.dark) .chat-history-item.is-active::before {
  background-color: var(--color-dark-bg-6, #2d2d2d);
  /* dark 模式下用亮蓝高亮条 + 微弱发光感, 避免在深色上消失 */
  box-shadow: inset 2px 0 0 0 #60a5fa;
}

:where(html.dark) .chat-history-item.is-active .item-title {
  color: #60a5fa;
}

:where(html.dark) .item-delete-btn:hover {
  background-color: rgba(239, 68, 68, 0.15);
  color: #fca5a5;
}
</style>
