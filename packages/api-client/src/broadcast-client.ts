// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D153(2026-09-29 立)per-user 广播订阅出口 —— 共享层唯一实现(§3 共享层优先)。
 *
 * 载体 = `apps/api/src/plugins/ws-broadcast.ts` 装饰出的 `server.broadcastToUser(userId, event, data)`,
 * 线上端点 `GET /ws/broadcast?token=<ws_ticket>`,帧形态 `{ event, data }`(判别联合在
 * `@ihui/types` 的 `user-broadcast.ts`,本模块只解析、不另定义第二份形态)。
 *
 * ── 关于「禁止开出第二条 per-user 常连」的实测与落地口径 ──
 * 现读(HEAD 面,`packages/api-client/src/ws-client.ts:304` `buildNotificationWsUrl`):
 * 各端已有的那条 per-user 常连是 **`/ws/notifications`**,它推的是
 * `{type:'notification', data:{type:<子类型>, …}}` 信封,与广播帧 `{event,data}` **不同形**;
 * 而 web 侧那条信封的消费者之一(`apps/web/src/stores/notification.ts` →
 * `@ihui/shared` 的 `transformWsNotification`)对**任何** `data.type` 都会建一条铃铛条目
 * —— 把广播帧塞进 notification 信封的代价是"每次改名都在铃铛里多一条『新通知』"。
 * 所以本模块的口径是:**不复制、也不寄生在**那条通知连接上,而是
 *  ① 复用同一个框架无关底座(`WebSocketClient`:心跳 / 指数退避 / 代际计数 / `/ws/ticket` 换票),
 *  ② **一台设备只有一条广播常连**(模块级引用计数单例,见 `getChannel`),多组件各自
 *     `subscribeUserBroadcast()` 只会往同一条连接上挂监听 —— 票面禁止的形态正是
 *     "每个 hook 各建一条",web 现有 notification 底座就是这个形态(≥3 处 `useWebSocket()`
 *     各一条),本模块不得重演;
 *  ③ 传输形态可选 `'injected'`:宿主自己已有那条连接并把帧转进来时(`feedUserBroadcastFrame`)
 *     本模块**一条都不建**。小程序端走的就是这一档(生命周期受限,见 `chat.meta.pullOnly`)。
 *
 * 三态纪律:**"没判到"不得写成"判过了"**。解不出已知事件的帧计数并回调 `onUndetermined`,
 * 不静默丢弃 —— 静默丢弃与静默分叉在用户侧是同一个症状。
 */
import {
  parseUserBroadcastFrame,
  type UserBroadcastEvent,
  type UserBroadcastEventName,
} from '@ihui/types'
import {
  WebSocketClient,
  fetchWsTicket,
  type WebSocketClientHandlers,
  type WebSocketLike,
} from './ws-client.js'

/** 本模块自己建的连接 vs 宿主把已有连接的帧转进来 */
export type UserBroadcastTransport = 'shared-socket' | 'injected'

export type UserBroadcastConnectionState = 'idle' | 'connecting' | 'open' | 'closed'

export interface UserBroadcastConfig {
  /** REST 基址(与 notification 底座同取值姿势:web 用 `window.location.origin`) */
  baseUrl: string
  /** 取当前 access token;返回 null 时**不**建连(未登录不得挂着连接) */
  tokenProvider: () => string | null
  /** 默认 `'shared-socket'`;`'injected'` ⇒ 本模块一条连接都不建,只收注入帧 */
  transport?: UserBroadcastTransport
  /**
   * WebSocket 工厂(依赖注入点,与 notification 底座同形态)。
   * RN / Taro 等没有标准全局 `WebSocket` 或需要绕开 `new URL` 的宿主注入自己的适配器。
   */
  webSocketFactory?: (url: string) => WebSocketLike
  /**
   * 覆盖 URL 构造。微信真机 JSCore 不保证 WHATWG `URL` 构造器在位
   * (apps/miniapp-taro/src/app.tsx:244-248 记过一次:默认 builder 因此静默建连失败),
   * 需要时由端注入不依赖 `URL` 的实现。
   */
  urlBuilder?: (token: string) => string
  /** 覆盖换票实现(默认 `fetchWsTicket`);注入以便在无全局 fetch 的宿主里显式降级 */
  ticketProvider?: (accessToken: string) => Promise<string | null | undefined>
}

/**
 * 事件名 → 处理函数。
 * 刻意按事件名分桶而不是"一个通用回调":消费端只该收到自己声明过的事件,
 * 收到不认识的事件却照样跑回调就是替未来的事件形态埋雷(D154 追加 `mcp:status` 时,
 * 本文件的 `'conversation:updated'` 常量表也会跟着点名"有个事件没人接")。
 */
export interface UserBroadcastHandlers {
  'conversation:updated'?: (evt: Extract<UserBroadcastEvent, { event: 'conversation:updated' }>) => void
  /** 收到对象形态但解不出已知事件的帧 ⇒ 「未判定」,必须计数/点名,不得静默丢弃 */
  onUndetermined?: (raw: unknown) => void
  /** 连接状态变化(`'injected'` 档恒为 `idle`,因为它不拥有连接) */
  onState?: (state: UserBroadcastConnectionState) => void
}

export interface UserBroadcastSubscription {
  close(): void
  readonly closed: boolean
}

// ===================== URL 构造 =====================

/**
 * 广播端点 URL —— 与 `buildNotificationWsUrl` 同形(按协议选 ws/wss),只有路径不同。
 * 不复用那个函数:两个端点帧形态与消息守卫都不同,把路径做成参数会让两套守卫在同一
 * 函数里互相顶(本仓"两处算同一件事必漂移"记过多次)。
 */
export function buildBroadcastWsUrl(baseUrl: string, token: string): string {
  const url = new URL(baseUrl)
  const proto = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${url.host}/ws/broadcast?token=${encodeURIComponent(token)}`
}

// ===================== 入站帧分类 =====================

/** 解不出已知事件时的载体:让"未判定"这一格在类型上可表达,而不是被守卫吞掉 */
interface UndeterminedInbound {
  readonly __undetermined: true
  readonly raw: unknown
}

type InboundMessage = UserBroadcastEvent | UndeterminedInbound

function classifyInbound(raw: unknown): InboundMessage | null {
  const evt = parseUserBroadcastFrame(raw)
  if (evt) return evt
  // 不是对象(纯文本 'pong' 之类)⇒ 与广播通道无关,交给底座的 pong 过滤,不计未判定;
  // 是对象 ⇒ 它确实是"这一帧我们没认下来",必须计。
  if (typeof raw !== 'object' || raw === null) return null
  return { __undetermined: true, raw }
}

function isInboundMessage(data: unknown): data is InboundMessage {
  return classifyInbound(data) !== null
}

// ===================== 设备级 hub =====================

interface ChannelListener {
  handlers: UserBroadcastHandlers
}

/**
 * 一条设备级广播通道:引用计数 + 监听表 + (可选)一条自建连接。
 * 模块级单例 ⇒ 第二个订阅者复用同一条连接,而不是各建一条。
 */
class UserBroadcastChannel {
  readonly listeners = new Set<ChannelListener>()
  client: WebSocketClient<InboundMessage> | null = null
  state: UserBroadcastConnectionState = 'idle'
  undetermined = 0
  /** 建连时绑定的配置:同一通道只服务同一 baseUrl,后来者只挂监听 */
  boundConfig: UserBroadcastConfig | null = null
  boundTransport: UserBroadcastTransport | null = null

  constructor(readonly key: string) {}

  get subscriberCount(): number {
    return this.listeners.size
  }

  private emitState(next: UserBroadcastConnectionState): void {
    if (this.state === next) return
    this.state = next
    for (const l of Array.from(this.listeners)) l.handlers.onState?.(next)
  }

  ingest(raw: unknown): UserBroadcastEvent | null {
    const evt = parseUserBroadcastFrame(raw)
    if (!evt) {
      // 非对象(心跳回显等)不算"未判定",否则一条 pong 就把计数打满
      if (typeof raw !== 'object' || raw === null) return null
      this.undetermined += 1
      for (const l of Array.from(this.listeners)) l.handlers.onUndetermined?.(raw)
      return null
    }
    for (const l of Array.from(this.listeners)) {
      const fn = l.handlers[evt.event] as ((e: UserBroadcastEvent) => void) | undefined
      fn?.(evt)
    }
    return evt
  }

  private buildClient(config: UserBroadcastConfig): WebSocketClient<InboundMessage> {
    const urlBuilder =
      config.urlBuilder ?? ((token: string) => buildBroadcastWsUrl(config.baseUrl, token))
    const channel = this
    return new WebSocketClient<InboundMessage>(
      {
        urlBuilder,
        tokenProvider: config.tokenProvider,
        messageGuard: isInboundMessage,
        ticketProvider:
          config.ticketProvider ?? ((accessToken: string) => fetchWsTicket(config.baseUrl, accessToken)),
        ...(config.webSocketFactory ? { webSocketFactory: config.webSocketFactory } : {}),
      },
      {
        onOpen: () => channel.emitState('open'),
        onClose: () => channel.emitState('closed'),
        onError: () => channel.emitState('closed'),
        onMessage: (msg: InboundMessage) => {
          if ('__undetermined' in msg) {
            channel.ingest(msg.raw)
            return
          }
          channel.ingest(msg)
        },
      } as WebSocketClientHandlers<InboundMessage>,
    )
  }

  attach(config: UserBroadcastConfig, listener: ChannelListener): void {
    this.listeners.add(listener)
    const transport = config.transport ?? 'shared-socket'

    if (transport === 'injected') {
      // 注入档:宿主自己那条连接把帧转进来,本通道一条都不建。
      // 已经有自建连接时**不**动它(别人在建的连不属于这次注入)。
      if (this.boundTransport === null) {
        this.boundTransport = 'injected'
        this.boundConfig = config
        this.emitState('idle')
      }
      return
    }

    if (this.client) {
      // 已有连接:同 baseUrl 就直接复用(这正是"设备级只有一条"的落点)。
      // 不同 baseUrl ⇒ 不猜、不静默改指向:保持原绑定,如实把差异留在 hubStats。
      this.emitState(this.state)
      return
    }
    if (this.boundTransport === 'injected' && this.boundConfig) {
      // 之前只有注入者 ⇒ 现在来了一个要自建连的订阅者,补建这一条(注入者不受影响)
    }
    this.boundTransport = 'shared-socket'
    this.boundConfig = config
    this.client = this.buildClient(config)
    this.emitState('connecting')
    this.client.connect()
  }

  detach(listener: ChannelListener): void {
    this.listeners.delete(listener)
    if (this.listeners.size === 0 && this.client) {
      this.client.disconnect()
      this.client = null
      this.boundConfig = null
      this.boundTransport = null
      this.emitState('idle')
    }
  }

  /** token 变化(登录/登出/刷新)时重连自建的那一条 */
  updateToken(): void {
    this.client?.updateToken()
  }
}

/**
 * 通道表按 `baseUrl|transport` 取键:
 * 同一部署里就一条广播常连;`'injected'` 档单独一格,保证小程序的注入不会去建连。
 */
const channels = new Map<string, UserBroadcastChannel>()

/**
 * 键只用得到 `baseUrl` 与 `transport` 两段 —— 形参刻意窄到这个程度:
 * `feedUserBroadcastFrame` 只有那两个信息(注入方不需要 token,它不建连),
 * 若这里收整份 `UserBroadcastConfig`,注入出口就被迫伪造一个 tokenProvider 才能编译,
 * 而"伪造一个不存在的凭据"正是把没判写成判过了的另一种形态。
 */
function channelKey(config: { baseUrl: string; transport?: UserBroadcastTransport }): string {
  const transport = config.transport ?? 'shared-socket'
  return `${config.baseUrl.replace(/\/$/, '')}|${transport}`
}

function getChannel(key: string): UserBroadcastChannel {
  const existing = channels.get(key)
  if (existing) return existing
  const created = new UserBroadcastChannel(key)
  channels.set(key, created)
  return created
}

/**
 * 订阅 per-user 广播(共享层唯一出口;端内**不得**自己 `new WebSocket` 再解析一遍)。
 *
 * 返回值必须 `close()`:它减一次引用,归零才断连。React 侧写法
 * ```ts
 * useEffect(() => subscribeUserBroadcast(config, { 'conversation:updated': onEvt }), [deps])
 * ```
 */
export function subscribeUserBroadcast(
  config: UserBroadcastConfig,
  handlers: UserBroadcastHandlers,
): UserBroadcastSubscription {
  const channel = getChannel(channelKey(config))
  const listener: ChannelListener = { handlers }
  channel.attach(config, listener)
  let closed = false
  return {
    get closed(): boolean {
      return closed
    },
    close(): void {
      if (closed) return
      closed = true
      channel.detach(listener)
      if (channel.subscriberCount === 0) channels.delete(channel.key)
    },
  }
}

/**
 * 注入出口:宿主已经有一条 per-user 连接(小程序由 use-ui-control-bridge 统一持有)时,
 * 把收到的原始消息转进来 —— 零新建连接,判据与自建那条路**同一个** `channel.ingest`。
 * 找不到通道 ⇒ 返回 null 并如实报"无人订阅"(不冒判"已处理")。
 */
export function feedUserBroadcastFrame(
  raw: unknown,
  opts: { baseUrl: string } = { baseUrl: '' },
): UserBroadcastEvent | null {
  const key = channelKey({ baseUrl: opts.baseUrl, transport: 'injected' })
  const channel = channels.get(key) ?? channels.get(`${opts.baseUrl.replace(/\/$/, '')}|shared-socket`)
  if (!channel) return null
  return channel.ingest(raw)
}

/** token 变化后重连(与 notification 底座的 updateToken 同语义);无自建连接时是 no-op */
export function refreshUserBroadcastConnection(baseUrl: string): void {
  const key = `${baseUrl.replace(/\/$/, '')}|shared-socket`
  channels.get(key)?.updateToken()
}

/**
 * 观测出口:当前有几条广播连接、几个订阅、多少"未判定"帧。
 * 诊断"能力在线但一条都没收到"用 —— 那一格的三种原因(没人订阅 / 没建连 / 帧没认出来)
 * 在这里是可区分的,不需要靠加日志重新发现。
 */
export function getUserBroadcastHubStats(): Array<{
  key: string
  subscribers: number
  connected: boolean
  state: UserBroadcastConnectionState
  undetermined: number
  transport: UserBroadcastTransport | null
}> {
  return Array.from(channels.values()).map((c) => ({
    key: c.key,
    subscribers: c.subscriberCount,
    connected: c.client !== null,
    state: c.state,
    undetermined: c.undetermined,
    transport: c.boundTransport,
  }))
}

/** 仅供测试与显式运维复位:常规路径靠引用归零自动断连,不该被业务调用 */
export function resetUserBroadcastHub(): void {
  for (const c of Array.from(channels.values())) {
    c.client?.disconnect()
    c.client = null
    for (const l of Array.from(c.listeners)) c.listeners.delete(l)
  }
  channels.clear()
}

/** 已知事件名清单的投影(端内若自己写字符串 ⇒ 与这里对不上就是第二份真相) */
export const USER_BROADCAST_SUBSCRIBABLE_EVENTS: readonly UserBroadcastEventName[] = [
  'conversation:updated',
]

// ===================== 宿主绑定工厂(端内适配器的唯一入口) =====================

/**
 * `createUserBroadcastClient()` 的返回形态:把一份 `UserBroadcastConfig` 绑成
 * "这台宿主的那一条广播通道"的四个动作。
 *
 * 为什么要有这层(而不是让端各自 `subscribeUserBroadcast(cfg, …)` 每次重传 cfg):
 * AGENTS §3 要求各端只做「re-export + 平台 adapter」—— 适配器需要的正是**一个绑好
 * baseUrl/tokenProvider 的句柄**,而不是把通道配置在四个调用点各抄一份(抄第四份的
 * 表现是某一处 baseUrl 漂了,那一处就静默连到别的端口而账面全绿)。
 */
export interface UserBroadcastConnection {
  /** 绑定的配置(只读投影;要改配置请重建连接,不要原地改) */
  readonly config: UserBroadcastConfig
  /** 挂一个监听;引用计数在通道里,多个监听共用同一条连接 */
  subscribe(handlers: UserBroadcastHandlers): UserBroadcastSubscription
  /** 注入档出口:宿主已有那条连接时把原始帧转进来(不新建任何连接) */
  feed(raw: unknown): UserBroadcastEvent | null
  /** token 变化后重连(注入档是 no-op) */
  refresh(): void
  /** 本宿主这条 baseUrl 上的通道实况(诊断"能力在线却一条都没收到"的三种原因) */
  stats(): UserBroadcastHubStatsEntry[]
}

export interface UserBroadcastHubStatsEntry {
  key: string
  subscribers: number
  connected: boolean
  state: UserBroadcastConnectionState
  undetermined: number
  transport: UserBroadcastTransport | null
}

/**
 * 绑定的广播客户端(共享层唯一工厂;端内不得 `new WebSocket` 自己解析帧)。
 * 幂等:同一 baseUrl 重复调用只会多一个句柄对象,不会多一条连接(连接在 hub 里计数)。
 */
export function createUserBroadcastClient(config: UserBroadcastConfig): UserBroadcastConnection {
  const baseUrl = config.baseUrl.replace(/\/$/, '')
  return {
    config,
    subscribe: (handlers) => subscribeUserBroadcast(config, handlers),
    feed: (raw) => feedUserBroadcastFrame(raw, { baseUrl }),
    refresh: () => refreshUserBroadcastConnection(baseUrl),
    stats: () => getUserBroadcastHubStats().filter((entry) => entry.key.startsWith(`${baseUrl}|`)),
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
