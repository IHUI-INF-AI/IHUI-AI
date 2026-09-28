// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * D153(2026-09-29 立)web 端会话元数据广播消费面。
 *
 * 载体与连接都在共享层(`@ihui/api-client` 的 `subscribeUserBroadcast`,设备级单例 + 引用计数);
 * 本文件只做**平台适配** —— 把帧落到 web 自己的两处真值上:
 *  ① 侧栏会话列表 / 历史页:react-query 缓存,key 前缀 `['chat','conversations']`
 *  ② 当前会话头部:模型徽章读 `useChatStore.currentModel`(所以远端换模型要落进 store)
 *
 * 三条不可漂的写法:
 *  ① **不发 HTTP 请求**:票第 6 栏验收①要的是"B 端不刷新就看到",不是"B 端收到推送后再
 *     GET 一次"。所以这里 `setQueryData` 就地改缓存 —— 缓存不是第二份真相(下一次正常
 *     拉取覆盖它),而"发请求"会让验收①的网络计数直接不成立。
 *     缓存里没有这一行时**不猜、不新增**(它可能是本页不显示的归档行),只报 cacheMiss,
 *     由 `chat.meta.pullOnly` 那一档明示,绝不说"已同步"。
 *  ② **值等价即回声,不弹提示**:`broadcastToUser` 会发给该用户的**全部**连接,包括刚写下
 *     这一行的那台。写下的那台缓存里已是新值 ⇒ 等价 ⇒ 静默对账;不等 ⇒ 另一台赢了这个字段
 *     (同字段两连击)⇒ 按库为准覆盖 + 一次性提示条。
 *     票第 3 栏的字面判据是 `changedBy ≠ 本人`,但 changedBy 就是令牌主体 userId,
 *     **同一账号的两台设备恒相等**,照字面实现的话这一格永远不响。所以判据落到值比较,
 *     而 `changedBy` 仍然必填且缺它整帧被 `parseUserBroadcastFrame` 拒收(票第 6 栏验收③)。
 *  ③ **提示条只一次**:同一 (会话, 字段, at) 只弹一次;重连风暴不得刷屏。
 */
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { subscribeUserBroadcast, type UserBroadcastConfig } from '@ihui/api-client'
import type { QueryClient } from '@tanstack/react-query'
import type { ConversationMetaField, ConversationUpdatedEvent } from '@ihui/types'
import { useChatStore } from '@/stores/chat'
import { useAuthStore } from '@/stores/auth'
import { getQueryClient } from '@/lib/query-client'
import { toast } from '@/components/common'

/** 侧栏/历史页缓存里那一行的最小形状(只声明本文件真的读的字段,不抄端内那份完整 interface) */
interface ConversationRowLike {
  id: string
  title?: string
  model?: string | null
  archivedAt?: string | null
  /**
   * 本端已认到的"库侧时刻"。**只有广播写进来**(见 applyMetaToRow 末尾那一行),
   * 后端序列化的字段名是 `updatedAt` 但那属于会话行本身,这里不复用同名键位是为了
   * 不把"行的更新时间"与"本端已应用到的那次变更时刻"混成一格 —— 后者才做以库为准的判据。
   */
  __appliedAt?: string | null
}

/**
 * 缓存补丁:把一帧广播落到某一行的既有值上。
 *
 * @returns `changed` 为**真正**被改掉的字段(空 ⇒ 这一帧是回声或旧帧);
 * 端内不得复制这份比较逻辑(两处算同一件事必漂移),所以它是导出的。
 */
export function applyMetaToRow(
  row: ConversationRowLike,
  evt: ConversationUpdatedEvent,
): { changed: ConversationMetaField[]; row: ConversationRowLike } {
  const values = evt.data.values
  const changed: ConversationMetaField[] = []
  const next: ConversationRowLike = { ...row }
  for (const field of evt.data.fields) {
    // 没有新值的帧(旧服务端 / 生产面漏传)⇒ 这一格无从应用,不算"已同步"
    if (!values || !(field in values)) continue
    const incoming = values[field]
    if (field === 'title' && typeof incoming === 'string') {
      if (row.title !== incoming) {
        next.title = incoming
        changed.push('title')
      }
    } else if (field === 'model') {
      const incomingModel = typeof incoming === 'string' ? incoming : null
      if ((row.model ?? null) !== incomingModel) {
        next.model = incomingModel
        changed.push('model')
      }
    } else if (field === 'archive') {
      const archivedNow = Boolean(row.archivedAt)
      const incomingArchived = incoming === true
      if (archivedNow !== incomingArchived) {
        next.archivedAt = incomingArchived ? evt.data.at : null
        changed.push('archive')
      }
    }
  }
  if (changed.length > 0) next.__appliedAt = evt.data.at
  return { changed, row: next }
}

/** 这一行已经应用过**更新**的一帧 ⇒ 本帧是迟到的旧帧,不得回退(同字段两连击以库为准) */
function isStaleAgainstRow(row: ConversationRowLike, at: string): boolean {
  if (!row.__appliedAt) return false
  const known = Date.parse(row.__appliedAt)
  const incoming = Date.parse(at)
  if (Number.isNaN(known) || Number.isNaN(incoming)) return false
  return known > incoming
}

type PatchResult = { data: unknown; changed: number } | null

/** 认三种既有缓存形态:infinite(pages[]) / {conversations:[]} / 裸数组 */
function patchCacheShape(data: unknown, evt: ConversationUpdatedEvent): PatchResult {
  const applyToList = (
    list: ConversationRowLike[],
  ): { rows: ConversationRowLike[]; changed: number } => {
    let changed = 0
    const rows = list.map((row) => {
      if (row.id !== evt.data.conversationId) return row
      if (isStaleAgainstRow(row, evt.data.at)) return row
      const res = applyMetaToRow(row, evt)
      // applyMetaToRow 交回的是**字段名数组**(哪些列真的被这帧改掉),这里累加的是行数额度
      // ⇒ 必须取 .length;写成 `changed += res.changed` 是 number += array,值变成字符串拼接,
      // rowsTouched 因此恒 >0 ⇒ 缓存里根本没有这一行时也照弹"其他设备已更新"(假提示)
      changed += res.changed.length
      return res.row
    })
    return { rows, changed }
  }

  if (Array.isArray(data)) {
    const res = applyToList(data as ConversationRowLike[])
    return { data: res.rows, changed: res.changed }
  }
  if (typeof data !== 'object' || data === null) return null
  const d = data as Record<string, unknown>
  if (Array.isArray(d.pages)) {
    let changed = 0
    const pages = (d.pages as Array<Record<string, unknown>>).map((page) => {
      const list = page?.conversations
      if (!Array.isArray(list)) return page
      const res = applyToList(list as ConversationRowLike[])
      changed += res.changed
      return { ...page, conversations: res.rows }
    })
    return { data: { ...d, pages }, changed }
  }
  if (Array.isArray(d.conversations)) {
    const res = applyToList(d.conversations as ConversationRowLike[])
    return { data: { ...d, conversations: res.rows }, changed: res.changed }
  }
  return null
}

/**
 * 对所有 key 前缀 `['chat','conversations']` 的查询就地打补丁(侧栏 infinite / 历史页 / 收藏页
 * 同前缀,一次广播对齐同一账号的全部会话视图)。
 *
 * @returns `cacheMiss = true` ⇒ 被广播的那条会话**不在**任何已加载缓存里;
 * 这不是"同步成功",调用方须按 pullOnly 口径处理,不得读成"无需同步"。
 */
export function patchConversationCaches(
  qc: QueryClient,
  evt: ConversationUpdatedEvent,
): { rowsTouched: number; cacheMiss: boolean } {
  let rowsTouched = 0
  let cacheMiss = true
  for (const query of qc.getQueryCache().getAll()) {
    const key = query.queryKey
    if (!Array.isArray(key) || key[0] !== 'chat' || key[1] !== 'conversations') continue
    const data = query.state.data as unknown
    if (!data || typeof data !== 'object') continue
    const patched = patchCacheShape(data, evt)
    if (!patched) continue
    cacheMiss = false
    rowsTouched += patched.changed
    if (patched.changed > 0) qc.setQueryData<unknown>(key, patched.data)
  }
  return { rowsTouched, cacheMiss }
}

// ===================== 提示条(React 树外的 toast) =====================

/** 已弹过提示的帧指纹(会话|字段|时刻);封顶保留,不做无界增长 */
const NOTICE_SEEN_LIMIT = 200
const noticeSeen = new Set<string>()

/**
 * 翻译器由 hook 在挂载时交进来:提示条走 `toast`(挂在 React 树外),
 * 自己 `useTranslations` 拿不到 locale,所以这里只保留**一个**模块级出口。
 * 卸载置 null ⇒ 宁可这条提示不出,也不用上一次的 locale 冒充当前语言。
 */
type Translator = (key: string, values?: Record<string, string>) => string
let noticeTranslator: Translator | null = null

export function setConversationBroadcastTranslator(t: Translator | null): void {
  noticeTranslator = t
}

export function resetConversationBroadcastNotices(): void {
  noticeSeen.clear()
}

/** 字段名 → 文案(`chat.meta.field.*`);无翻译器时返回 null,调用方按"文案不可用"降级 */
function fieldLabel(tc: Translator, field: ConversationMetaField): string {
  return tc(`meta.field.${field}`)
}

function describeIncomingValue(
  evt: ConversationUpdatedEvent,
  fields: ConversationMetaField[],
  tc: Translator,
): string {
  const values = evt.data.values
  if (!values) return ''
  return fields
    .map((f) => {
      const v = values[f]
      if (v === undefined || v === null) return ''
      if (typeof v === 'boolean') return v ? tc('meta.field.archive') : tc('meta.field.archive')
      return v
    })
    .filter((s) => s.length > 0)
    .join(' / ')
}

/** 一次性提示条:同 (会话,字段,时刻) 只弹一次 */
function fireOnceNotice(evt: ConversationUpdatedEvent, fields: ConversationMetaField[]): void {
  const tc = noticeTranslator
  if (!tc) return
  const key = `${evt.data.conversationId}|${evt.data.fields.join(',')}|${evt.data.at}`
  if (noticeSeen.has(key)) return
  noticeSeen.add(key)
  if (noticeSeen.size > NOTICE_SEEN_LIMIT) {
    // Set 保序:删最早插入的若干条,不留无界内存
    for (const old of Array.from(noticeSeen).slice(0, noticeSeen.size - NOTICE_SEEN_LIMIT)) {
      noticeSeen.delete(old)
    }
  }
  const label = fields.map((f) => fieldLabel(tc, f)).join('、')
  const value = describeIncomingValue(evt, fields, tc)
  toast.info(tc('meta.changedElsewhere', { field: label, value }))
}

/**
 * 挂载点:`apps/web/src/hooks/use-websocket.ts` 的 `useWebSocket()` 里调一次即可 ——
 * 那个入口已被全局通知/任务接收/侧栏等消费者挂载,而引用计数在 api-client 那一侧,
 * 所以"多个消费者"仍然只对应**一条**设备级广播连接(票面禁止的正是每人一条)。
 */
export function useConversationBroadcastSync(): {
  connected: boolean
  undetermined: number
} {
  const t = useTranslations('chat')
  const token = useAuthStore((s) => s.token)
  const [undetermined, setUndetermined] = React.useState(0)
  const [connected, setConnected] = React.useState(false)

  const translate = React.useCallback(
    (key: string, values?: Record<string, string>): string =>
      // next-intl 的键类型在本仓不做生成式收窄(端内 tc(`动态串`) 已在用),
      // 但签名仍是字面量联合 ⇒ 这里按端内既有姿势窄化一次,不放宽判据
      values ? t(key as never, values as never) : t(key as never),
    [t],
  )

  React.useEffect(() => {
    setConversationBroadcastTranslator(translate)
    return () => setConversationBroadcastTranslator(null)
  }, [translate])

  React.useEffect(() => {
    if (!token) return
    if (typeof window === 'undefined') return
    const config: UserBroadcastConfig = {
      baseUrl: window.location.origin,
      tokenProvider: () => useAuthStore.getState().token,
    }
    const sub = subscribeUserBroadcast(config, {
      'conversation:updated': (evt) => {
        const e = evt as ConversationUpdatedEvent
        // getQueryClient() 在浏览器侧返回的就是 QueryProvider 挂的那一份单例,
        // 因此这里拿到的缓存与侧栏 useInfiniteQuery 读的是同一个对象。
        const { rowsTouched, cacheMiss } = patchConversationCaches(getQueryClient(), e)

        // 当前打开的那条会话:模型徽章跟着走(头部取数读 store)
        const store = useChatStore.getState()
        if (store.conversationId === e.data.conversationId) {
          const incoming = e.data.values?.model
          if (typeof incoming === 'string' && store.currentModel !== incoming) {
            store.setModel(incoming)
            fireOnceNotice(e, ['model'])
          }
        }

        const listed = e.data.fields.filter((f) => f !== 'model' || cacheMiss)
        if (rowsTouched > 0 && listed.length > 0) fireOnceNotice(e, listed)
      },
      onUndetermined: () => setUndetermined((n) => n + 1),
      onState: (s) => setConnected(s === 'open'),
    })
    return () => sub.close()
  }, [token])

  return { connected, undetermined }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
