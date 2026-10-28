// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D153b / D154(2026-09-30 立)per-user 广播的**跨端消费层** —— 小程序端与 App(RN)端共用一份实现。
//
// 为什么住在这里而不是端内(AGENTS §3 共享层优先):同一条广播帧有两个端的消费面,
// 「哪一列变了 / 以库为准 / 这台连得上吗」这三件事各写一遍必然漂移,而漂移的表现是
// "手机上改了 web 没改"这一型 —— 本仓记过多次。端内只留平台 adapter:
// 取 token / 建 WS 工厂 / 提示出口(toast)。
//
// 三条不可漂的写法(与 web 侧 `apps/web/src/hooks/use-conversation-broadcast-sync.ts` 同源):
//  ① **不发 HTTP 请求**:票 V4 §11.3 D153 第 6 栏验收①要的是"另一端不刷新就看到",
//     不是"收到推送后再 GET 一次"。所以这里只改本端已知的值,缓存里没有这一行时
//     **不猜、不新增**(它可能是本页没加载的归档行),`known:false` 由调用方按
//     `chat.meta.pullOnly` 明示,绝不说"已同步"。
//  ② **同字段两连击以库为准**:`isNewerThan` 是 @ihui/types 里那一份判据,本文件不重写。
//  ③ **`connected` 不是要提示的事**:MCP 连上 ⇒ 该行从表里**移除**,
//     异常态(failed / reconnecting / connecting)才占界面高度 —— 与 D131 同一档判断。
//     判不出(`tools` 缺席)时按"看得见"处理:判不出不得写成"用不到",
//     否则正是要提示的那一型被静默吞掉。
//
// 刻意**不抄事件名清单**:本文件只吃 @ihui/types 的判别联合(`ConversationUpdatedEvent` /
// `McpStatusEvent`),不声明任何名字数组;状态档名一律现读 `isMcpConnectionState` 的判据。

import {
  isMcpConnectionState,
  isNewerThan,
  type ConversationMetaField,
  type ConversationUpdatedEvent,
  type McpConnectionState,
  type McpStatusEvent,
} from '@ihui/types'

// ===================== 会话元数据账本 =====================

/** 一条会话在服务端主副本里的可变元数据(本端已应用到的那一份) */
export interface ConversationMetaSnapshot {
  readonly title?: string
  readonly model?: string | null
  readonly archived?: boolean
  /** 库侧时刻(广播帧的 `at`),同字段新旧判定用它 */
  readonly at: string
  /** 本帧真正带值并落进账本的字段 */
  readonly fields: readonly ConversationMetaField[]
}

export interface ConversationMetaApplyResult {
  /** 本端已知的行是否被这帧改掉(空数组 ⇒ 回声 / 旧帧 / 该行不在本端) */
  readonly changed: readonly ConversationMetaField[]
  /** 这一条会话是否在本端已知的行里;false ⇒ 调用方须按 pullOnly 明示,不得读成"无需同步" */
  readonly known: boolean
}

export interface ConversationMetaLedger {
  /** 页面加载后把当前可见的会话 id 交进来 ⇒ 账本才知道"哪些行归本端显示" */
  remember(ids: Iterable<string>): void
  apply(evt: ConversationUpdatedEvent): ConversationMetaApplyResult
  get(id: string): ConversationMetaSnapshot | undefined
  /** 取值并回落:账本没有该会话/该字段时交回调用方手里的现值(不猜) */
  titleFor(id: string, fallback: string): string
  modelFor(id: string, fallback: string | null): string | null
  archivedFor(id: string, fallback: boolean): boolean
  subscribe(listener: () => void): () => void
  /** 每次真实变更递增;端内用它做"是否重渲染"的比较基准 */
  version(): number
  /** 登出/切账号:别人的行必须清掉(账本是设备级的,身份不是) */
  clear(): void
  knownSize(): number
}

/**
 * 工厂形态而不是裸模块单例:端内适配器按平台注入(§3 工厂 + DI),
 * 而单测需要一个隔离的账本 —— 全局单例会让用例之间互相顶。
 * 每端仍只有**一个**实例(`conversationMetaLedger`),不是每条连接一个。
 */
export function createConversationMetaLedger(): ConversationMetaLedger {
  const metas = new Map<string, ConversationMetaSnapshot>()
  const known = new Set<string>()
  const listeners = new Set<() => void>()
  let version = 0

  const publish = (): void => {
    version += 1
    for (const listener of Array.from(listeners)) listener()
  }

  return {
    remember(ids) {
      // 只增不清:页面翻页/续页是并集,清掉会把已知的行读成"不在本端"
      for (const id of ids) known.add(id)
    },
    apply(evt) {
      const { conversationId, fields, at, values } = evt.data
      const prev = metas.get(conversationId)
      if (!known.has(conversationId)) {
        // 不猜、不新增(票第 6 栏验收①的反面:凭空造一行就是"看起来同步了")
        return { changed: [], known: false }
      }
      // 同字段两连击以库为准:已有更新的认知 ⇒ 本帧是迟到帧,不回退
      if (prev && !isNewerThan(at, prev.at)) return { changed: [], known: true }

      const changed: ConversationMetaField[] = []
      // 落表前用可写草稿(快照类型是 readonly ⇒ 不能就地赋值,TS2500 会红);
      // fields 只在草稿收尾时一次性冻结,避免"半更新"这一格在中间态被读到
      const draft: {
        title?: string
        model?: string | null
        archived?: boolean
        fields: ConversationMetaField[]
        at: string
      } = { at, fields: [] }
      const mergedFields = new Set<ConversationMetaField>(prev?.fields ?? [])
      for (const field of fields) {
        // 帧没带这一列的新值 ⇒ 这一格无从应用,保留既有认知(不算变更也不算同步)
        if (!values || !(field in values)) continue
        const incoming = values[field]
        if (field === 'title' && typeof incoming === 'string') {
          if (prev?.title !== undefined ? prev.title !== incoming : true) {
            draft.title = incoming
            changed.push('title')
          }
        } else if (field === 'model') {
          const incomingModel = typeof incoming === 'string' ? incoming : null
          if (prev?.model !== undefined ? prev.model !== incomingModel : true) {
            draft.model = incomingModel
            changed.push('model')
          }
        } else if (field === 'archive') {
          const incomingArchived = incoming === true
          if (prev?.archived !== undefined ? prev.archived !== incomingArchived : true) {
            draft.archived = incomingArchived
            changed.push('archive')
          }
        }
        mergedFields.add(field)
      }
      // 只带认知、没有实际变更 ⇒ 不换引用也不发通知(回声帧不该打断界面)
      if (changed.length === 0) return { changed: [], known: true }
      draft.fields = Array.from(mergedFields)
      metas.set(conversationId, draft)
      publish()
      return { changed, known: true }
    },
    get(id) {
      return metas.get(id)
    },
    titleFor(id, fallback) {
      const meta = metas.get(id)
      return meta?.title ?? fallback
    },
    modelFor(id, fallback) {
      const meta = metas.get(id)
      // `model` 可为 null(库里未绑定),不能用 ?? 把 null 读成"没值所以回落"
      return meta && 'model' in meta ? (meta.model ?? null) : fallback
    },
    archivedFor(id, fallback) {
      const meta = metas.get(id)
      return meta?.archived ?? fallback
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    version() {
      return version
    },
    clear() {
      if (metas.size === 0 && known.size === 0) return
      metas.clear()
      known.clear()
      publish()
    },
    knownSize() {
      return known.size
    },
  }
}

/** 设备级单例:每个端进程一份(小程序 / RN 各自打包,不共享内存) */
export const conversationMetaLedger = createConversationMetaLedger()

// ===================== MCP 连接状态账本(D154)=====================

export interface McpStatusRow {
  readonly server: string
  readonly state: McpConnectionState
  /** 技术性原因:诊断用,不是界面文案(界面句子一律由 state × 五语言词表产出) */
  readonly reason?: string
  readonly attempt?: number
  readonly maxAttempts?: number
  /** 该 server 当前对外提供的工具名;缺席 = 生产面判不出,消费端按"看得见"处理 */
  readonly tools?: readonly string[]
  readonly at: string
}

export interface McpStatusLedger {
  /** @returns 该帧是否改变了表(重复帧 / 被移除的 connected 帧 ⇒ false,不触发重渲染) */
  apply(evt: McpStatusEvent): boolean
  snapshot(): readonly McpStatusRow[]
  subscribe(listener: () => void): () => void
  clear(): void
}

/** 稳定顺序:异常态优先(failed 比 connecting 更该被看到),同档按 server 名字典序 */
const STATE_RANK: Record<McpConnectionState, number> = {
  failed: 0,
  reconnecting: 1,
  connecting: 2,
  connected: 3,
}

export function createMcpStatusLedger(): McpStatusLedger {
  const rows = new Map<string, McpStatusRow>()
  const listeners = new Set<() => void>()
  // 空表快照必须是同一个引用:每次新建会让 useSyncExternalStore 判"快照不稳定"
  const EMPTY: readonly McpStatusRow[] = Object.freeze([] as McpStatusRow[])
  let snapshot: readonly McpStatusRow[] = EMPTY

  const publish = (): void => {
    snapshot =
      rows.size === 0
        ? EMPTY
        : Object.freeze(
            [...rows.values()].sort(
              (a, b) => STATE_RANK[a.state] - STATE_RANK[b.state] || a.server.localeCompare(b.server),
            ),
          )
    for (const listener of Array.from(listeners)) listener()
  }

  return {
    apply(evt) {
      const { server, state } = evt.data
      if (state === 'connected') {
        // 连上了 ⇒ 这一行没有存在的理由(不提示才是正确界面),整条摘掉而不是留个 connected 徽章
        if (!rows.delete(server)) return false
        publish()
        return true
      }
      // 载荷里没有时刻成员(@ihui/types 的 McpStatusData 只有 server/state/reason/attempt/
      // maxAttempts/tools)⇒ 落表时刻由本端盖,不得"从帧里猜一个":猜出来的 at 会把
      // "两帧同状态"读成"两个时刻"从而每次都重渲染。所以去重按**内容**判(state + attempt)。
      const next: McpStatusRow = {
        server,
        state,
        at: new Date().toISOString(),
        ...(evt.data.reason !== undefined ? { reason: evt.data.reason } : {}),
        ...(evt.data.attempt !== undefined ? { attempt: evt.data.attempt } : {}),
        ...(evt.data.maxAttempts !== undefined ? { maxAttempts: evt.data.maxAttempts } : {}),
        ...(evt.data.tools !== undefined ? { tools: evt.data.tools } : {}),
      }
      const prev = rows.get(server)
      if (prev && prev.state === state && prev.attempt === next.attempt) return false
      rows.set(server, next)
      publish()
      return true
    },
    snapshot() {
      return snapshot
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    clear() {
      if (rows.size === 0) return
      rows.clear()
      publish()
    },
  }
}

/** 设备级单例(同上) */
export const mcpStatusLedger = createMcpStatusLedger()

// ===================== 状态行取词(D154 第 5 栏)=====================

/**
 * 状态档 → 词表键,写成**逐档静态字面量**,不得拼前缀。
 *
 * 理由不是审美:`scripts/scan-dead-i18n-keys.mjs` 挂在 pre-commit 上,它认不出
 * `chat.mcp.state.${state}` 这一族的消费者 ⇒ 三枚键被判成死键,而红落在
 * **下一个碰语言包的无关提交**上(§12e 同型:与本次改动无关的恒红门只会逼人绕钩子)。
 * 对象字面量映射是扫描器已支持的一种引用形态(PaymentScreen / TaskDispatchPage 同型),
 * 所以"键与消费者同笔"在这里是真的成立,而不是靠豁免清单遮。
 *
 * `connected` **刻意不在表里**:连上不是要提示的事(第 3 条不可漂写法),
 * 少一枚键 = 少一句界面废话,而不是漏登记。
 */
const MCP_STATUS_MESSAGE_KEYS: Record<Exclude<McpConnectionState, 'connected'>, string> = {
  connecting: 'chat.mcp.state.connecting',
  failed: 'chat.mcp.state.failed',
  reconnecting: 'chat.mcp.state.reconnecting',
}

/** 降级端「去桌面/网页管理」提示的键(两端都用同一个,措辞在语包里按端覆盖) */
export const MCP_MOBILE_SETTINGS_HINT_KEY = 'chat.mcp.mobileSettingsHint'

export interface McpStatusMessage {
  readonly key: string
  readonly params: Readonly<Record<string, string | number>>
}

/**
 * 状态帧 → 一句可操作的话。
 *
 * `connected` ⇒ null(连上不是要提示的事);未知档 ⇒ null 并由调用方计「未判定」,
 * **绝不**"当作 connecting" —— 把没认出来写成看见了是本仓最高频的失效型。
 */
export function mcpStatusMessage(evt: McpStatusEvent): McpStatusMessage | null {
  const state = evt.data.state
  if (!isMcpConnectionState(state)) return null
  // connected 不在键表里(见 MCP_STATUS_MESSAGE_KEYS 上方说明)⇒ 取不到键就是"没有要说的话",
  // 与"认不出这一档"是两回事:后者由调用方的 onUndetermined / 未判定计数点名。
  const key = state === 'connected' ? undefined : MCP_STATUS_MESSAGE_KEYS[state]
  if (!key) return null
  const params: Record<string, string | number> = { server: evt.data.server }
  // 重连文案要分子也要分母:@ihui/types 的判据已保证带 attempt 必带 maxAttempts,
  // 这里只做投影,不补默认值(补了就是把"生产面漏了"洗成"看起来完整")
  if (evt.data.attempt !== undefined) params.attempt = evt.data.attempt
  if (evt.data.maxAttempts !== undefined) params.maxAttempts = evt.data.maxAttempts
  return { key, params }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
