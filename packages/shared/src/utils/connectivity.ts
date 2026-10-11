// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 在线/离线判据的唯一真相源(AGENTS §3 共享层优先)。
 *
 * 立项由头(台账 G-1113920,2026-10-11 真机):设备 ping 通、`dumpsys connectivity` 两条
 * NetworkAgentInfo 均 VALIDATED,而 App 顶部横幅一路亮红写「网络已断开」。旧实现把三件
 * 不同的事压成同一个布尔(`setIsOnline(resp.ok)` / 一次失败即离线 / 探测目标本身不可达),
 * 于是"我们的服务器没答"与"这台设备没网"在 UI 上完全同形 —— 而后者才是横幅在说的话。
 *
 * 三条不可漂的口径:
 * 1. **慢网 ≠ 断网**:收到任何 HTTP 响应(含 4xx/5xx)都证明"路径通",服务器报错不是断网。
 * 2. **未判定不得渲染成已确认离线**:探测目标不可达而设备侧证据(或没有任何反证)不足以
 *    确认无网时,一律落 `unknown`,由端上按 `bannerKindFor` 出中性提示,绝不冒红。
 * 3. **判据只有一份**:各端注入 adapter(怎么探),档位与状态机住在这里(怎么判)。
 */

/** 在线档位。`unknown` 是"判不出",既不是在线也不是离线,不得被折叠成任何一端。 */
export type ConnectivityStatus = 'online' | 'slow' | 'offline' | 'unknown'

/**
 * 设备级网络信号(平台原生能力给出时用平台答案,给不出一律 `unknown`)。
 * 没有 NetInfo 的端(如 mobile-rn,刻意不引原生依赖)必须传 `unknown`,
 * 不得用"探测失败"反推设备无网 —— 那正是本判据要消除的并档。
 */
export type DeviceNetworkSignal = 'online' | 'offline' | 'unknown'

/** 单个探测目标本轮的观测结果(由端上 adapter 产出,纯数据)。 */
export type ProbeSample =
  /** 拿到了 HTTP 响应(任何状态码):L7 应答 ⇒ 传输路径存在 */
  | {
      readonly target: string
      readonly kind: 'response'
      readonly httpStatus: number
      readonly latencyMs: number
    }
  /** 请求发出但在超时内未收到响应:慢网或断网的共同形状,单独不足以判离线 */
  | { readonly target: string; readonly kind: 'timeout'; readonly latencyMs: number }
  /** DNS / TCP / TLS 层直接失败(含拒绝连接、主机不可达) */
  | { readonly target: string; readonly kind: 'unreachable'; readonly detail?: string }
  /** 该目标本轮根本没探(未配置 / 环境不支持)⇒ 未判定,不得计成失败也不得计成成功 */
  | { readonly target: string; readonly kind: 'not-probed'; readonly reason: string }

/** 一轮探测的输入:目标样本 + 设备级信号。 */
export interface ProbeRound {
  readonly deviceSignal: DeviceNetworkSignal
  readonly samples: readonly ProbeSample[]
}

/** 结论的来历;`detail` 之外的第二层"为什么是这个结论",供日志与端上如实措辞。 */
export type ConnectivityReason =
  | 'no-sample'
  | 'probe-unavailable'
  | 'server-answered'
  | 'slow-response'
  | 'probe-target-unreachable'
  | 'pending-confirmation'
  | 'device-offline-signal'
  | 'all-targets-unreachable'

/** 阈值(端上可调,但档位语义只有这一份)。 */
export interface ConnectivityThresholds {
  /** 响应耗时达到该值 ⇒ `slow`(慢网提示,不是断网)。 */
  readonly slowLatencyMs: number
  /** 连续多少轮"所有目标都没答"才允许升级为 `offline`。 */
  readonly offlineConsecutiveRounds: number
}

export const DEFAULT_CONNECTIVITY_THRESHOLDS: ConnectivityThresholds = {
  slowLatencyMs: 1_500,
  // 真机 RTT 408–505ms 时,TLS 握手 + 一次 HTTP 往返本身就要 2–3s;单次抖动不该变成红横幅。
  offlineConsecutiveRounds: 3,
}

/** 状态机的对外结论。 */
export interface ConnectivitySnapshot {
  readonly status: ConnectivityStatus
  readonly reason: ConnectivityReason
  /** 本轮最快一次应答的耗时;没有任何应答时为 null(未判定,不是 0)。 */
  readonly latencyMs: number | null
  /** 连续"全目标未答"轮数(升级到 offline 的分母);收到应答即归零。 */
  readonly consecutiveFailedRounds: number
  /** 逐条点名"哪一格没判到 / 判的是哪个目标",供端上如实展示与日志取证。 */
  readonly detail: string[]
}

const FAILED_KINDS = new Set<ProbeSample['kind']>(['timeout', 'unreachable'])

/**
 * 纯函数:一轮观测 + 此前的连续失败轮数 ⇒ 结论。
 * 不持有状态(状态由 `createConnectivityTracker` 包一层),因此可被任何端复用、可被构造面测试。
 */
export function classifyRound(
  round: ProbeRound,
  previousFailedRounds: number,
  thresholds: ConnectivityThresholds = DEFAULT_CONNECTIVITY_THRESHOLDS,
): ConnectivitySnapshot {
  const answered = round.samples.filter((s) => s.kind === 'response')
  const failed = round.samples.filter((s) => FAILED_KINDS.has(s.kind))
  const notProbed = round.samples.filter((s) => s.kind === 'not-probed')
  const detail: string[] = []

  // ① 只要有任何一个目标答了,设备就**不可能**是"无网"——服务器侧的 4xx/5xx 属业务故障,
  //    与连通性无关(旧实现在这里栽的跟头:`setIsOnline(resp.ok)` 把 500 读成断网)。
  if (answered.length > 0) {
    const latencies = answered
      .map((s) => (s.kind === 'response' ? s.latencyMs : Number.NaN))
      .filter((n): n is number => Number.isFinite(n) && n >= 0)
    const latency = latencies.length > 0 ? Math.min(...latencies) : null
    // 应答缺失耗时(取不到 ⇒ 不猜):当作"已连接但未判定快慢",状态按 online、reason 记录来历。
    const status: ConnectivityStatus =
      latency !== null && latency >= thresholds.slowLatencyMs ? 'slow' : 'online'
    if (round.deviceSignal === 'offline') {
      detail.push(`设备信号报无网,但 ${answered.length} 个目标收到应答 ⇒ 按应答为准,不判离线`)
    }
    for (const s of failed) detail.push(`目标 ${s.target} 本轮未答(${s.kind})`)
    for (const s of notProbed) detail.push(`目标 ${s.target} 未探:${s.reason}`)
    return {
      status,
      reason: status === 'slow' ? 'slow-response' : 'server-answered',
      latencyMs: latency,
      consecutiveFailedRounds: 0,
      detail,
    }
  }

  // ② 没有任何应答时,设备级信号优先于"我们的服务器有没有答"。
  if (round.deviceSignal === 'offline') {
    return {
      status: 'offline',
      reason: 'device-offline-signal',
      latencyMs: null,
      consecutiveFailedRounds: failed.length > 0 ? previousFailedRounds + 1 : previousFailedRounds,
      detail: [...(failed.length > 0 ? [] : ['设备信号报无网,本轮无失败样本(仅作佐证)'])],
    }
  }

  // ③ 全目标未答:先数轮数,再看有没有反证 —— 反证在 ⇒ 只能说"目标不可达",不能说"设备没网"。
  if (failed.length > 0) {
    const next = previousFailedRounds + 1
    for (const s of failed) detail.push(`目标 ${s.target} 未答(${s.kind})`)
    for (const s of notProbed) detail.push(`目标 ${s.target} 未探:${s.reason}`)
    if (round.deviceSignal === 'online') {
      // 票面要的正是这一格:探测目标不可达但设备在线 ⇒ unknown,绝不落 offline。
      return {
        status: 'unknown',
        reason: 'probe-target-unreachable',
        latencyMs: null,
        consecutiveFailedRounds: next,
        detail: ['设备信号显示已连网,判据无法确认无网 ⇒ 只报"无法连接服务器"', ...detail],
      }
    }
    if (notProbed.length > 0) {
      // 有目标压根没探 ⇒ 覆盖面不完整,不得据此下"离线"结论。
      return {
        status: 'unknown',
        reason: 'probe-unavailable',
        latencyMs: null,
        consecutiveFailedRounds: next,
        detail: ['存在未探目标 ⇒ 覆盖面不闭合,不判离线', ...detail],
      }
    }
    if (next >= thresholds.offlineConsecutiveRounds) {
      return {
        status: 'offline',
        reason: 'all-targets-unreachable',
        latencyMs: null,
        consecutiveFailedRounds: next,
        detail,
      }
    }
    return {
      status: 'unknown',
      reason: 'pending-confirmation',
      latencyMs: null,
      consecutiveFailedRounds: next,
      detail: [`连续未答 ${next} 轮,尚未达到离线确认阈值 ${thresholds.offlineConsecutiveRounds}`],
    }
  }

  // ④ 一个有效样本都没有(全是 not-probed,或清单为空)⇒ 尺子没跑到,不是"没网"。
  for (const s of notProbed) detail.push(`目标 ${s.target} 未探:${s.reason}`)
  if (round.samples.length === 0) detail.push('本轮没有任何探测样本')
  return {
    status: 'unknown',
    reason: round.samples.length === 0 ? 'no-sample' : 'probe-unavailable',
    latencyMs: null,
    consecutiveFailedRounds: previousFailedRounds,
    detail,
  }
}

export interface ConnectivityTracker {
  /** 喂入一轮观测,返回最新结论(状态机自持"连续失败轮数")。 */
  observe(round: ProbeRound): ConnectivitySnapshot
  peek(): ConnectivitySnapshot
  reset(): void
}

/** 跨轮持有失败计数的薄壳;判据本体在 `classifyRound`。 */
export function createConnectivityTracker(
  thresholds: ConnectivityThresholds = DEFAULT_CONNECTIVITY_THRESHOLDS,
): ConnectivityTracker {
  let failedRounds = 0
  let last: ConnectivitySnapshot = {
    status: 'unknown',
    reason: 'no-sample',
    latencyMs: null,
    consecutiveFailedRounds: 0,
    detail: ['尚未收到任何探测结果'],
  }
  return {
    observe(round) {
      last = classifyRound(round, failedRounds, thresholds)
      failedRounds = last.consecutiveFailedRounds
      return last
    },
    peek() {
      return last
    },
    reset() {
      failedRounds = 0
      last = {
        ...last,
        status: 'unknown',
        reason: 'no-sample',
        latencyMs: null,
        consecutiveFailedRounds: 0,
        detail: ['尚未收到任何探测结果'],
      }
    },
  }
}

/** 端上该出哪一档提示;`none` = 不打扰用户。 */
export type ConnectivityBannerKind = 'none' | 'offline' | 'slow' | 'unconfirmed'

/**
 * 结论 → 横幅的唯一映射(各端只许按这张表出文案,不得自己再判一次)。
 * 刻意不让 `unknown` 出红色:"未判定"与"已确认离线"必须是两种可见形态。
 */
export function bannerKindFor(snapshot: ConnectivitySnapshot): ConnectivityBannerKind {
  switch (snapshot.status) {
    case 'online':
      return 'none'
    case 'slow':
      return 'slow'
    case 'offline':
      return 'offline'
    case 'unknown':
      // 冷启动(还没跑过)与"抖动等下一轮"不值得打扰用户;只有"目标持续不可达 / 尺子跑不动"
      // 才出中性提示,并且措辞必须说清是没连上服务器,不是用户没网。
      return snapshot.reason === 'probe-target-unreachable' ||
        snapshot.reason === 'probe-unavailable'
        ? 'unconfirmed'
        : 'none'
    default: {
      const exhaustive: never = snapshot.status
      return exhaustive
    }
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
