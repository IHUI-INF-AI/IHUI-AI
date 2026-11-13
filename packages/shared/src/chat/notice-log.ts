// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 对话内「提示留痕」—— **跨端唯一真相源**(2026-11 立)。
 *
 * 立因(用户原话:「那种的难道不应该在 ai 对话框里显示吗 不然怎么留痕 用户咋能记住」):
 * 轻提示(toast)是瞬时的 —— 4s 后消失,既无法回看也无法复盘。用户要求「凡 toast 都要在
 * AI 对话框里留痕」。本模块提供三端共用的**记录模型 + 去重/裁剪规则 + 持久化编解码**,
 * 各端只负责:① 用自己的载体渲染;② 注入自己的存储适配器(RN AsyncStorage / web localStorage)。
 *
 * 分工(为什么这么切):
 * - **纯逻辑留在这里**:`appendNotice` 的去重与上限是行为契约,三端若各写一份必然漂移
 *   (历史教训:同一条提示的时长曾三端各一数,见 `utils/host-toast.ts` 头注)。
 * - **存储适配器由调用方注入**:shared 不能依赖 `@react-native-async-storage/*` 或 `window`,
 *   否则小程序/Node 侧一 import 就炸。故这里只定义 `NoticeLogStorage` 契约。
 *
 * 边界(必须守住):
 * - 记录**不进后端上下文/历史**:它是独立的客户端 state,不混入 `messages`,
 *   故不会被当成对话内容发给模型,也不落库。
 * - **失败不静默**:存储读写失败一律向调用方 reject(或由调用方 catch 后按 AGENTS §5e
 *   至少 dev 告警),绝不假装写成功。
 */

/** 提示类型(与 web sonner 的 richColors 语义、RN FloatBox 的语义色一一对应) */
export type NoticeKind = 'success' | 'error' | 'warning' | 'info'

export interface ChatNotice {
  /** 唯一 id(仅用于 React key / 去重,不参与业务) */
  id: string
  kind: NoticeKind
  text: string
  /** 触发时刻(ms),用于展示 HH:mm 与排序 */
  ts: number
}

/** 记录上限:超出丢最旧(防长会话无限增长;50 条足够覆盖一次会话的关键提示) */
export const NOTICE_LOG_CAP = 50

const KINDS: readonly NoticeKind[] = ['success', 'error', 'warning', 'info']

/** 类型守卫:反序列化时用来丢弃脏数据 */
export function isNoticeKind(v: unknown): v is NoticeKind {
  return typeof v === 'string' && (KINDS as readonly string[]).includes(v)
}

/**
 * 追加一条记录(纯函数,便于单测钉行为)。
 * - 与上一条**同文同类型** ⇒ 只更新时刻,不新增占位(去重「正在重连…」这类刷屏);
 * - 否则追加,并裁剪到 `NOTICE_LOG_CAP` 条。
 */
export function appendNotice(list: readonly ChatNotice[], next: ChatNotice): ChatNotice[] {
  const last = list[list.length - 1]
  if (last && last.text === next.text && last.kind === next.kind) {
    return [...list.slice(0, -1), { ...last, ts: next.ts }]
  }
  const out = [...list, next]
  return out.length > NOTICE_LOG_CAP ? out.slice(out.length - NOTICE_LOG_CAP) : out
}

/**
 * 合并两批记录(用于「异步读回」与「读回期间已产生的新记录」并存)。
 * 按 id 去重 → 按 ts 升序 → 裁到上限。同 ts 时以 `b`(较新来源)为准。
 */
export function mergeNotices(a: readonly ChatNotice[], b: readonly ChatNotice[]): ChatNotice[] {
  const byId = new Map<string, ChatNotice>()
  for (const n of a) byId.set(n.id, n)
  for (const n of b) byId.set(n.id, n)
  const out = [...byId.values()].sort((x, y) => x.ts - y.ts)
  return out.length > NOTICE_LOG_CAP ? out.slice(out.length - NOTICE_LOG_CAP) : out
}

// ── 持久化编解码 ─────────────────────────────────────────────────────────────

/** 存储键前缀。带版本号:将来若要改结构,换 v2 即可,旧键自然废弃。 */
export const NOTICE_LOG_STORAGE_PREFIX = 'ihui.notice-log.v1'

/**
 * 尚未关联后端会话时的落点键。
 *
 * 为什么需要:三端「新开会话」在用户发出第一条消息前**都没有 conversationId**
 * (RN 实测:整场新会话 `conversationId` 恒为 null,只有进历史会话才被赋值)。
 * 若按 id 分键,新会话的留痕将永远写不进存储 —— 恰好是最需要「关掉再打开还能看到」的场景。
 * 故未绑定时统一落 draft 键,「新建对话」时显式清掉它,避免串味。
 */
export const NOTICE_LOG_DRAFT_KEY = '__draft__'

/** 会话 → 存储键(未绑定会话时落 draft 键) */
export function noticeLogStorageKey(conversationId: string | null | undefined): string {
  const id = typeof conversationId === 'string' ? conversationId.trim() : ''
  return `${NOTICE_LOG_STORAGE_PREFIX}:${id || NOTICE_LOG_DRAFT_KEY}`
}

/** 序列化(带版本信封,便于将来迁移;空列表也照常序列化,即"显式清空") */
export function serializeNoticeLog(list: readonly ChatNotice[]): string {
  return JSON.stringify({ v: 1, items: list.slice(-NOTICE_LOG_CAP) })
}

/**
 * 反序列化 —— **永不抛错**,坏数据一律降级为空列表。
 *
 * 立因:存储是外部输入(可能被旧版本写过、被手工改过、被截断)。留痕是辅助能力,
 * 不能因为一条脏数据把聊天页打挂。逐条校验字段,单条不合格只丢那条。
 */
export function parseNoticeLog(raw: string | null | undefined): ChatNotice[] {
  if (typeof raw !== 'string' || raw.trim() === '') return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  const envelope = parsed as { v?: unknown; items?: unknown }
  if (!envelope || typeof envelope !== 'object' || !Array.isArray(envelope.items)) return []
  const out: ChatNotice[] = []
  for (const item of envelope.items) {
    if (!item || typeof item !== 'object') continue
    const it = item as Record<string, unknown>
    const { id, kind, text, ts } = it
    if (typeof id !== 'string' || id === '') continue
    if (!isNoticeKind(kind)) continue
    if (typeof text !== 'string' || text === '') continue
    if (typeof ts !== 'number' || !Number.isFinite(ts)) continue
    out.push({ id, kind, text, ts })
  }
  // 同一 id 重复(理论上不该有)时保后者,并裁到上限
  return mergeNotices([], out)
}

// ── 存储适配器契约 + 三个薄封装 ─────────────────────────────────────────────

/**
 * 各端注入的存储适配器。
 *
 * 只要求 get/set 两个异步方法 —— RN AsyncStorage 与 web localStorage 都能一秒包出来;
 * `removeItem` 可选(清空走「写空列表」也能达成,但显式删除更干净)。
 */
export interface NoticeLogStorage {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem?(key: string): Promise<void>
}

/** 读回某会话的留痕(坏数据降级为空;存储层异常照常向上抛,由调用方决定告警策略) */
export async function loadNoticeLog(
  store: NoticeLogStorage,
  conversationId: string | null | undefined,
): Promise<ChatNotice[]> {
  const raw = await store.getItem(noticeLogStorageKey(conversationId))
  return parseNoticeLog(raw)
}

/** 写入某会话的留痕(空列表 = 显式清空) */
export async function saveNoticeLog(
  store: NoticeLogStorage,
  conversationId: string | null | undefined,
  list: readonly ChatNotice[],
): Promise<void> {
  await store.setItem(noticeLogStorageKey(conversationId), serializeNoticeLog(list))
}

/** 删除某会话的留痕键(适配器没提供 removeItem 时退化为写空列表) */
export async function clearNoticeLog(
  store: NoticeLogStorage,
  conversationId: string | null | undefined,
): Promise<void> {
  const key = noticeLogStorageKey(conversationId)
  if (store.removeItem) {
    await store.removeItem(key)
    return
  }
  await store.setItem(key, serializeNoticeLog([]))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
