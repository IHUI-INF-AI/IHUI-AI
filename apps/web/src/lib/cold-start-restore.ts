// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 冷启动列表快照:写入方 / 消费方同源(2026-11-07 接线,判定契约见 stores/chat.ts 的 planColdStartRestore)。
 * 快照只作提示/预填 —— **永不拦截深链**:任何合法 conversationId 都由既有深链同步照常进入,
 * 快照缺失/不可读/不匹配一律安静跳过,不阻断、不报错。
 * 落盘按 userId 分桶(与端内其它本地缓存同款),避免切换账号后串号显示。
 */
import {
  planColdStartRestore,
  useChatStore,
  type ColdStartItem,
  type ColdStartPlan,
} from '@/stores/chat'
import { useAiPanelStore } from '@/stores/ai-panel'

/** localStorage 键前缀;按 userId 分桶,不同账号互不可见 */
const STORAGE_KEY_PREFIX = 'ihui-cold-start-snapshot-v1:'

/** 会话列表接口里本端真实拥有、且快照愿意保存的字段(其余字段不编造) */
export type ColdStartConversationRow = { id: string; title?: string | null }

/** 侧栏首屏占位页:形状对齐会话列表接口,只填真实有的字段 */
export type ColdStartPlaceholder = {
  pages: Array<{
    conversations: Array<{
      id: string
      title: string
      model: string
      lastMessageAt: string
      messageCount: number
    }>
    total: number
    page: number
    pageSize: number
  }>
  pageParams: number[]
}

function snapshotKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}${userId}`
}

function readStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    return window.localStorage
  } catch {
    // 隐私模式/禁用存储:快照只是提示,读不到等价于没有快照
    return null
  }
}

function toItems(rows: ColdStartConversationRow[]): ColdStartItem[] {
  return rows.map((row) => ({ id: row.id, title: typeof row.title === 'string' ? row.title : '' }))
}

/**
 * 会话列表首屏成功后落盘(调用点:sidebar-chat-history.tsx)。
 * 内容不变时不重写,避免每次 refetch 都刷新 savedAt;写失败静默忽略。
 */
export function writeColdStartSnapshot(
  userId: string | null,
  rows: ColdStartConversationRow[],
): void {
  if (!userId || rows.length === 0) return
  const storage = readStorage()
  if (!storage) return
  const items = toItems(rows)
  try {
    const prev = storage.getItem(snapshotKey(userId))
    if (prev) {
      const parsed = JSON.parse(prev) as { items?: unknown }
      if (JSON.stringify(parsed.items) === JSON.stringify(items)) return
    }
    storage.setItem(snapshotKey(userId), JSON.stringify({ version: 1, savedAt: Date.now(), items }))
  } catch {
    // 配额/隐私模式:不落盘不影响任何主流程
  }
}

/** 读原始快照(未校验);校验一律交给 planColdStartRestore,端内不再写第二份判据 */
export function readColdStartSnapshot(userId: string | null): unknown {
  if (!userId) return null
  const storage = readStorage()
  if (!storage) return null
  try {
    const raw = storage.getItem(snapshotKey(userId))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/** 可用快照项;不可判(unjudged)时返回 null,消费端据此安静跳过 */
export function coldStartSnapshotItems(
  userId: string | null,
  now = Date.now(),
): ColdStartItem[] | null {
  const plan = planColdStartRestore({ now, snapshot: readColdStartSnapshot(userId), route: null })
  return plan.items
}

/**
 * 侧栏首屏预填:把快照项翻成列表首屏占位页;不可用时返回 undefined(维持原骨架屏)。
 * 快照不存时间项(契约只留 id/title),lastMessageAt 给空串走既有回退链,
 * 服务端首屏返回后占位数据即被真实数据替换。
 */
export function buildColdStartPlaceholder(
  userId: string | null,
  now = Date.now(),
): ColdStartPlaceholder | undefined {
  const items = coldStartSnapshotItems(userId, now)
  if (!items || items.length === 0) return undefined
  return {
    pages: [
      {
        conversations: items.map((item) => ({
          id: item.id,
          title: item.title,
          model: '',
          lastMessageAt: '',
          messageCount: 0,
        })),
        total: items.length,
        page: 1,
        pageSize: items.length,
      },
    ],
    pageParams: [1],
  }
}

/**
 * 冷启首跑消费点(调用点:chat/page.tsx 的 ChatConversationSync):
 * `restore` = 命中快照,提前把会话摆正并展开面板;`list-only`/`unjudged` = 什么都不做,
 * 由下方既有深链同步照常进入 —— 本函数不会、也不允许拦住任何合法 conversationId。
 */
export function applyColdStartRestore(input: {
  userId: string | null
  conversationId: string | null
  now?: number
}): ColdStartPlan {
  const now = input.now ?? Date.now()
  const route = input.conversationId
    ? { path: `/chat?conversationId=${input.conversationId}`, savedAt: now }
    : null
  const plan = planColdStartRestore({
    now,
    snapshot: readColdStartSnapshot(input.userId),
    route,
  })
  if (plan.disposition === 'restore' && plan.routeId) {
    useChatStore.getState().setConversationId(plan.routeId)
    useAiPanelStore.getState().openPanel()
  }
  return plan
}
