// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'

import { useNotificationStore } from '@/stores/notification'
import { useAuthStore } from '@/stores/auth'
import { useWebSocket } from '@/hooks/use-websocket'
import { getNotifications, getUnreadCount, queryNotificationStates } from '@ihui/api-client'
import type { NotificationItem } from '@ihui/types'

/** 通知断线补拉的复合水位;与 REST sinceCreatedAt/sinceId 成对参数同形 */
export interface NotificationWatermark {
  createdAt: string
  id: string
}

/** 单次重连最多回填多少页(100 条/页),超出即停并诚实记为未对齐,不无限请求 */
const MAX_RECONNECT_PAGES = 10
const RECONNECT_PAGE_SIZE = 100

/**
 * 从 WS 通知帧提取服务端水位。只认真实落库通知载荷里的 (id,createdAt) —— 适配器
 * 在缺字段时会造 `ws-<ts>-<random>` / 本地此刻,那种值不得当水位(会把后续通知整批跳过)。
 */
export function extractNotificationWatermark(message: unknown): NotificationWatermark | null {
  if (!message || typeof message !== 'object') return null
  const frame = message as { type?: unknown; data?: unknown }
  if (frame.type !== 'notification' || !frame.data || typeof frame.data !== 'object') return null
  const data = frame.data as { id?: unknown; createdAt?: unknown }
  if (typeof data.id !== 'string' || !data.id || data.id.startsWith('ws-')) return null
  if (typeof data.createdAt !== 'string' || Number.isNaN(Date.parse(data.createdAt))) return null
  return { createdAt: data.createdAt, id: data.id }
}

/** 复合水位比较:先 createdAt,同刻用 uuid 字典序决胜;>0 表示 a 更新 */
export function compareNotificationWatermark(
  a: NotificationWatermark,
  b: NotificationWatermark,
): number {
  const ta = Date.parse(a.createdAt)
  const tb = Date.parse(b.createdAt)
  if (ta !== tb) return ta > tb ? 1 : -1
  if (a.id === b.id) return 0
  return a.id > b.id ? 1 : -1
}

export interface UseGlobalNotificationReturn {
  unreadCount: number
  unreadMessageCount: number
  visible: boolean
  setVisible: (v: boolean) => void
  markAllRead: () => void
  clearAll: () => void
}

/**
 * 按 (createdAt,id) 水位复合 keyset 回填断线增量,突破「最新 100 条」上限。
 * 每批以本页最大水位滚动续拉;返回 capped=true 表示已到页数上限、仍有未拉的行 ——
 * 调用方不把它洗成「已对齐」,下次重连继续从当前水位往前走。
 */
async function hydrateSinceWatermark(
  start: NotificationWatermark,
  hydrate: (rows: NotificationItem[]) => void,
  isCancelled: () => boolean,
): Promise<{ watermark: NotificationWatermark; capped: boolean } | null> {
  let cursor = start
  for (let page = 0; page < MAX_RECONNECT_PAGES; page += 1) {
    const res = await getNotifications({
      pageSize: RECONNECT_PAGE_SIZE,
      partition: 'active',
      sinceCreatedAt: cursor.createdAt,
      sinceId: cursor.id,
    })
    if (isCancelled() || !res.success || !res.data) return null
    const list = res.data.list ?? []
    const first = list[0]
    if (!first) return { watermark: cursor, capped: false }
    hydrate(list)
    let newest: NotificationItem = first
    for (const row of list) {
      if (compareNotificationWatermark(row, newest) > 0) newest = row
    }
    cursor = { createdAt: newest.createdAt, id: newest.id }
    if (list.length < RECONNECT_PAGE_SIZE) return { watermark: cursor, capped: false }
  }
  return { watermark: cursor, capped: true }
}

/**
 * 重连权威状态对账:WS 帧不重放,断线期别的设备对**已有**通知的已读/归档翻转,
 * createdAt 水位补增量拿不到。拿本地已知的 ids 问服务端此刻真相,按确切 ids 应用翻转。
 * 单次上限 500(与后端 stateQuerySchema 同限),超出只查前 500 并诚实截断,不冒充全量对齐。
 */
const STATE_QUERY_LIMIT = 500

async function reconcileStateOnReconnect(
  getIds: () => string[],
  apply: (res: { readIds: string[]; archivedIds: string[] }) => void,
  isCancelled: () => boolean,
): Promise<void> {
  const ids = getIds().slice(0, STATE_QUERY_LIMIT)
  if (ids.length === 0 || isCancelled()) return
  try {
    const res = await queryNotificationStates(ids)
    if (isCancelled() || !res.success || !res.data) return
    apply(res.data)
  } catch {
    // 静默失败:快照对账失败不影响补增量,下次重连再试,不把失败冒充已对齐
  }
}

/**
 * 全局通知 Hook
 *
 * 在应用层订阅 WebSocket 推送，将通知写入 notification store，
 * 并提供未读计数与通知面板开关。
 *
 * 登录后挂载时调用 getUnreadCount() 初始化未读角标,避免 WS 推送前角标始终为 0。
 */
export function useGlobalNotification(): UseGlobalNotificationReturn {
  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const unreadMessageCount = useNotificationStore((s) => s.unreadMessageCount)
  const handleWsMessage = useNotificationStore((s) => s.handleWsMessage)
  const markAllRead = useNotificationStore((s) => s.markAllAsRead)
  const clearAll = useNotificationStore((s) => s.clearAll)
  const setUnreadCounts = useNotificationStore((s) => s.setUnreadCounts)
  const hydrateNotifications = useNotificationStore((s) => s.hydrateNotifications)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [visible, setVisible] = React.useState(false)

  const { lastMessage, connected } = useWebSocket()
  // 首连不补:角标由下方 unread-count 初始化、列表由通知面板自己的加载负责。
  // 只有"曾经连上、断开后再次连上"才补断线窗口的通知(跨 WS 重建保持)。
  const everConnected = React.useRef(false)
  // 服务端水位:从真实落库的 WS 通知载荷提取,或从补拉列表的最新一条建立。
  // 只前进不回退,重连时用它做复合 keyset 增量,而不是反复拉"最新 100 条"。
  const watermarkRef = React.useRef<NotificationWatermark | null>(null)

  React.useEffect(() => {
    const wm = extractNotificationWatermark(lastMessage)
    if (wm) {
      const current = watermarkRef.current
      if (!current || compareNotificationWatermark(wm, current) > 0) watermarkRef.current = wm
    }
    handleWsMessage(lastMessage)
  }, [lastMessage, handleWsMessage])

  // 登录后从 API 初始化未读计数(仅一次,避免角标在 WS 推送前为 0)
  React.useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    getUnreadCount()
      .then((res) => {
        if (cancelled || !res.success || !res.data) return
        setUnreadCounts({
          notifications: res.data.notification ?? 0,
          messages: res.data.message ?? 0,
        })
      })
      .catch(() => {
        // 静默失败:接口不可用时不影响 UI
      })
    return () => {
      cancelled = true
    }
  }, [isAuthenticated, setUnreadCounts])

  // 断线窗口内服务端推的通知不会重放 —— 重连时按服务端水位做复合 keyset 补回,
  // 没有水位才退回最新页(幂等合并)。去重由 store 的 hydrateNotifications 按 id
  // 承担,本层不复制判据;角标一律取服务端 unread-count 真相,不用本地条目数重算。
  React.useEffect(() => {
    if (!connected) return
    const reconnect = everConnected.current
    everConnected.current = true
    if (!reconnect || !isAuthenticated) return
    let cancelled = false
    void (async () => {
      try {
        const countPromise = getUnreadCount()
        const start = watermarkRef.current
        let next: NotificationWatermark | null = null
        if (start) {
          // 精确水位:复合 keyset 拿「水位之后新增」的全部通知,不再受最新 100 条上限。
          const result = await hydrateSinceWatermark(start, hydrateNotifications, () => cancelled)
          if (cancelled) return
          if (result) next = result.watermark
          // capped=true 只把水位推到已拉到的位置,不冒充"已对齐";下次重连继续。
        } else {
          // 无水位(老服务端 / 首连未收到真实通知帧):退回最新页幂等合并,并从
          // 本页最新一条建立水位,供下一次重连升级到 keyset 增量。
          const listRes = await getNotifications({
            page: 1,
            pageSize: 100,
            partition: 'active',
          })
          if (cancelled) return
          if (listRes.success && listRes.data) {
            const list = listRes.data.list ?? []
            hydrateNotifications(list)
            for (const row of list) {
              if (!next || compareNotificationWatermark(row, next) > 0) {
                next = { createdAt: row.createdAt, id: row.id }
              }
            }
          }
        }
        if (next) watermarkRef.current = next
        // 权威状态对账:补增量只覆盖「新增行」,断线期对已有通知的已读/归档翻转靠这步。
        // 拿本地此刻已知的 ids(含刚补回的)问服务端真相,按确切 ids 应用;失败静默。
        await reconcileStateOnReconnect(
          () => useNotificationStore.getState().notifications.map((n) => n.id),
          (state) => {
            const store = useNotificationStore.getState()
            if (state.readIds.length > 0) store.markAsReadByIds(state.readIds)
            if (state.archivedIds.length > 0) store.archiveByIds(state.archivedIds)
          },
          () => cancelled,
        )
        if (cancelled) return
        const countRes = await countPromise
        if (cancelled) return
        if (countRes.success && countRes.data) {
          setUnreadCounts({
            notifications: countRes.data.notification ?? 0,
            messages: countRes.data.message ?? 0,
          })
        }
      } catch {
        // 静默失败:补拉失败不影响 UI,下次重连再试,不把失败冒充已对齐
      }
    })()
    return () => {
      cancelled = true
    }
  }, [connected, isAuthenticated, hydrateNotifications, setUnreadCounts])

  return { unreadCount, unreadMessageCount, visible, setVisible, markAllRead, clearAll }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
