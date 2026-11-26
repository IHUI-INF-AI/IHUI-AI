// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * L15 监听面组合策略(2026-11-26)。
 *
 * 为什么要单独一条策略,而不是继续散落在 index.ts 的注释里:
 * 单独看每一项都不致命 —— 绑 0.0.0.0 是"为了方便跨机访问"、明文 Basic 是"内网够用"、
 * 没有 TLS 是"反正有反代"。但这三项组合起来就是:任何能连到该端口的人,拿到一份
 * 明文口令即可长期持有全部接口权限,且链路上没有一层能看见。对标的做法是把这件事
 * 编成**组合判据**在启动期判,而不是留给评审清单靠人记。
 *
 * 判据(按 host 分两类):
 *  - 回环(127.0.0.1 / ::1 / localhost):放行。本机进程可达即可,不构成网络暴露面。
 *  - 非回环:必须同时满足三条,缺一条即拒:
 *      1. 显式 opt-in `IHUI_ALLOW_NON_LOOPBACK=1|true`(不写就是拒,不靠"部署习惯"默认);
 *      2. 有 TLS 材料(`IHUI_TLS_CERT_PATH` + `IHUI_TLS_KEY_PATH`),或显式声明走域套接字
 *         `IHUI_LISTEN_SOCKET=1`(套接字本身不经网卡,不需要 TLS);
 *      3. 不得同时启用明文 Basic(`IHUI_BASIC_AUTH=1|true`)—— 明文口令 + 全网卡是禁组合,
 *         opt-in 与 TLS 都不能豁免它。
 *
 * 档位:production 下违规 = 抛错拒启(fail-closed);development/test 只告警不拦
 * (本地调试常绑 0.0.0.0 连手机/模拟器,这与线上暴露不是一回事)。判据本身只有一份,
 * 区别只在调用方拿到 detail 后怎么处置。
 */

export const LOOPBACK_HOSTS = ['127.0.0.1', '::1', 'localhost', '[::1]'] as const

export type ListenSurfaceViolationCode =
  | 'non-loopback-requires-opt-in'
  | 'non-loopback-requires-tls-or-socket'
  | 'plaintext-basic-auth-on-public-bind'

export interface ListenSurfaceDecision {
  /** true = 可以按当前 host 起监听。 */
  ok: boolean
  /** 实际生效的 host(未配置时取回环默认)。 */
  host: string
  /** 违规码;ok=true 时为 null。 */
  code: ListenSurfaceViolationCode | null
  /** 人读理由(进日志;不含任何 env 取值)。 */
  reason: string | null
  /** 是否走了非回环 opt-in(仅用于审计行)。 */
  optInNonLoopback: boolean
}

const truthy = (v: string | undefined): boolean => v === '1' || v?.toLowerCase() === 'true'

export function isLoopbackHost(host: string): boolean {
  return (LOOPBACK_HOSTS as readonly string[]).includes(host.trim().toLowerCase())
}

export function assessListenSurface(
  env: Record<string, string | undefined>,
): ListenSurfaceDecision {
  const host = env.HOST?.trim() || '127.0.0.1'
  const loopback = isLoopbackHost(host)
  const optInNonLoopback = truthy(env.IHUI_ALLOW_NON_LOOPBACK)
  const hasTls = Boolean(env.IHUI_TLS_CERT_PATH?.trim()) && Boolean(env.IHUI_TLS_KEY_PATH?.trim())
  const unixSocket = truthy(env.IHUI_LISTEN_SOCKET)
  const plaintextBasicAuth = truthy(env.IHUI_BASIC_AUTH)

  if (loopback) {
    return { ok: true, host, code: null, reason: null, optInNonLoopback }
  }
  if (!optInNonLoopback) {
    return {
      ok: false,
      host,
      code: 'non-loopback-requires-opt-in',
      reason: '非回环监听需显式 IHUI_ALLOW_NON_LOOPBACK=1(默认只绑 127.0.0.1)',
      optInNonLoopback,
    }
  }
  if (plaintextBasicAuth) {
    return {
      ok: false,
      host,
      code: 'plaintext-basic-auth-on-public-bind',
      reason: '明文 Basic 与全网卡监听是禁组合(opt-in/TLS 均不豁免)',
      optInNonLoopback,
    }
  }
  if (!hasTls && !unixSocket) {
    return {
      ok: false,
      host,
      code: 'non-loopback-requires-tls-or-socket',
      reason: '非回环监听需 TLS 证书对或域套接字(本机明文 HTTP 只允许回环)',
      optInNonLoopback,
    }
  }
  return { ok: true, host, code: null, reason: null, optInNonLoopback }
}

/** 违规时抛出的错误;`code` 供启动日志/测试断言用,消息本身不带 env 取值。 */
export class ListenSurfaceViolation extends Error {
  readonly code: ListenSurfaceViolationCode
  constructor(decision: ListenSurfaceDecision) {
    super(`监听面策略拒绝:${decision.code} —— ${decision.reason ?? ''}`)
    this.name = 'ListenSurfaceViolation'
    this.code = decision.code as ListenSurfaceViolationCode
  }
}

/**
 * 启动期入口。production 违规抛错(fail-closed);其余档位返回决策交调用方告警。
 * 返回 null 表示"放行且无需告警"。
 */
export function assertListenSurface(
  env: Record<string, string | undefined>,
  options: { isProduction: boolean },
): ListenSurfaceDecision | null {
  const decision = assessListenSurface(env)
  if (decision.ok) return null
  if (options.isProduction) throw new ListenSurfaceViolation(decision)
  return decision
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
