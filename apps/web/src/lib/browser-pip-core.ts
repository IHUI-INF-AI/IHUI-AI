// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 浏览器画中画(监看档)纯逻辑层 —— 2026-11-24 立。
 *
 * 对齐 TRAE「画中画模式」的三条硬约束:
 * 1. 浮窗只读:画面可以看,但点击/滚动不进会话(输入仍旧回主面板);
 * 2. 尺寸有下限:低于 320×200 就读不清报错/验证码,等于假监看;
 * 3. 状态要能"余光扫一眼":运行中 / 等待人工 / 登录闸 / 断流 / 连接中,
 *    不能只给一张静止图让人猜。
 *
 * 本文件只放不碰 DOM、不碰 WebSocket 的纯函数(尺寸/状态/登录闸识别),
 * 由 vitest 直测;窗口生命周期与收帧在 browser-pip.ts。
 */

/** 浮窗最小尺寸:低于此值文字/验证码不可辨,监看失去意义 */
export const PIP_MIN_WIDTH = 320
export const PIP_MIN_HEIGHT = 200
/** 默认尺寸:约主屏 1/3 宽,不遮挡主工作区 */
export const PIP_DEFAULT_WIDTH = 420
export const PIP_DEFAULT_HEIGHT = 280
/** 帧龄超过此值判"画面停了"(后端 ~3fps,15s 已是异常) */
export const PIP_STALL_MS = 15_000
/** 浮窗尺寸记忆键:用户拖过的大小下次沿用 */
export const PIP_SIZE_STORAGE_KEY = 'ihui-browser-pip-size'

export interface PipSize {
  width: number
  height: number
}

/** 允许用户/上次会话给出任意尺寸,但请求开窗前统一夹到最小档 */
export function clampPipSize(size?: Partial<PipSize> | null): PipSize {
  const rawWidth =
    typeof size?.width === 'number' && Number.isFinite(size.width) ? size.width : PIP_DEFAULT_WIDTH
  const rawHeight =
    typeof size?.height === 'number' && Number.isFinite(size.height)
      ? size.height
      : PIP_DEFAULT_HEIGHT
  return {
    width: Math.max(PIP_MIN_WIDTH, Math.round(rawWidth)),
    height: Math.max(PIP_MIN_HEIGHT, Math.round(rawHeight)),
  }
}

type ReadableStorage = Pick<Storage, 'getItem'>
type WritableStorage = Pick<Storage, 'setItem'>

/** 读上次浮窗尺寸;读不到/坏 JSON/越界一律回默认档,不抛错 */
export function readStoredPipSize(storage?: ReadableStorage | null): PipSize {
  if (!storage) return clampPipSize(null)
  try {
    const raw = storage.getItem(PIP_SIZE_STORAGE_KEY)
    if (!raw) return clampPipSize(null)
    return clampPipSize(JSON.parse(raw) as Partial<PipSize>)
  } catch {
    return clampPipSize(null)
  }
}

/** 记住浮窗尺寸;隐私模式/配额满时静默失败(不阻断监看) */
export function storePipSize(size: PipSize, storage?: WritableStorage | null): void {
  if (!storage) return
  try {
    storage.setItem(PIP_SIZE_STORAGE_KEY, JSON.stringify(clampPipSize(size)))
  } catch {
    /* 存不下就算了:下次回默认尺寸,不影响本次监看 */
  }
}

export type BrowserPipPhase = 'running' | 'waiting' | 'gate' | 'error'

export type BrowserPipStatusKind =
  'connecting' | 'running' | 'stalled' | 'waiting' | 'gate' | 'error'

export interface BrowserPipStatusInput {
  /** WebSocket 是否已连上 */
  connected: boolean
  /** 会话层状态:AI 暂停等人工 / 连接报错 */
  phase: BrowserPipPhase
  /** 最近一帧到达时间戳(ms);0 = 还没收到帧 */
  lastFrameAt: number
  /** 当前页面 URL(来自 navigation 事件) */
  url?: string | null
  now: number
}

export interface BrowserPipStatusView {
  kind: BrowserPipStatusKind
  /** 距最近一帧的秒数(0 = 还没收到帧) */
  stalledSeconds: number
}

/**
 * 状态判定的优先级(高 → 低):
 * 会话错误 > 等待人工 > 未连接 > 画面停更 > 登录/验证页 > 运行中。
 * 有帧但停在登录页时给"gate"(提示可能要接管),不是"stalled",
 * 因为画面还在动、问题是人没在场。
 */
export function resolveBrowserPipStatus(input: BrowserPipStatusInput): BrowserPipStatusView {
  const stalledSeconds =
    input.lastFrameAt > 0 ? Math.max(0, Math.floor((input.now - input.lastFrameAt) / 1000)) : 0

  if (input.phase === 'error') return { kind: 'error', stalledSeconds }
  if (input.phase === 'waiting') return { kind: 'waiting', stalledSeconds }
  // 服务端按 URL 自动判出的登录/验证墙:比"连接中/停更"更该让人看到 ——
  // 它说明 AI 现在过不去,不是网络坏了。
  if (input.phase === 'gate') return { kind: 'gate', stalledSeconds }
  if (!input.connected) return { kind: 'connecting', stalledSeconds }
  if (input.lastFrameAt > 0 && input.now - input.lastFrameAt >= PIP_STALL_MS) {
    return { kind: 'stalled', stalledSeconds }
  }
  if (looksLikeHumanGate(input.url)) return { kind: 'gate', stalledSeconds }
  return { kind: 'running', stalledSeconds }
}

/**
 * 登录/验证闸识别:只做"提示"，不做判定。
 * 命中只说明当前 URL 像是登录/验证/风控页,真正要不要接管仍由人看画面决定 ——
 * 误报的代价只是多一行提示,漏报的代价是人在等一个永远不动的 AI。
 *
 * 判据刻意收窄(按路径整段 + 主机头前缀 + 查询参数名),不用子串匹配:
 * `/blog/how-to-login` 这类内容页不能被误判成登录页。
 */
const GATE_PATH_SEGMENTS = new Set([
  'login',
  'log-in',
  'log_in',
  'signin',
  'sign-in',
  'sign_in',
  'verify',
  'verification',
  'captcha',
  'challenge',
  '2fa',
  'two-factor',
  'sso',
  'passport',
  'oauth',
  'authorize',
])

const GATE_QUERY_KEYS = ['verify', 'verification', 'captcha', 'login', 'signin', 'sso']

const GATE_HOSTNAME_PREFIX = /^(?:login|signin|sso|auth|passport)\./i

export function looksLikeHumanGate(url?: string | null): boolean {
  if (!url) return false
  try {
    const parsed = new URL(url)
    if (GATE_HOSTNAME_PREFIX.test(parsed.hostname)) return true
    const segments = parsed.pathname
      .split('/')
      .filter(Boolean)
      .map((segment) => segment.toLowerCase())
    if (segments.some((segment) => GATE_PATH_SEGMENTS.has(segment))) return true
    return GATE_QUERY_KEYS.some((key) => parsed.searchParams.has(key))
  } catch {
    return /(?:^|\/)(?:login|sign[-_]?in|verify|captcha)(?=[\s/?#]|$)/i.test(url)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
