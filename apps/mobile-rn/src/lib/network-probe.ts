// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RN 端的连通性探测 adapter(台账 G-1113920,2026-10-11)。
 *
 * 这一层只回答「探到了什么」(纯数据 `ProbeRound`),**不回答**「所以有没有网」——
 * 档位与结论的唯一实现住在 `@ihui/shared/utils/connectivity`(§3 共享层优先:两处算同一件事
 * 必然漂开)。端内严禁再写 `if (失败) setIsOnline(false)` 那一型。
 *
 * 为什么探两个目标:
 * - `primary` = 本端配置的 API 健康检查。它没答只能说明**我们配置的这台服务器**没答
 *   (开发构建里 `API_BASE_URL` 默认 `http://localhost:8802`,真机上 localhost 就是手机自己
 *   ⇒ 永远拒绝连接。旧实现在这一格直接把横幅点成「网络已断开」,而手机明明有网,这就是
 *   票面那次「ping 通、VALIDATED,横幅却一路亮红」的现场)。
 * - `egress` = 生产域名上的同一端点。它答了 ⇒ 设备出口是通的,primary 没答只可能是配置/
 *   后端问题 ⇒ 判据据此落 `unknown`(中性提示),而不是冒红称用户没网。
 *
 * 设备级信号:本端刻意不引 `@react-native-community/netinfo` / `expo-network`(原生依赖成本),
 * 所以 `deviceSignal` 恒为 `'unknown'` —— 这是如实,不是漏填。将来接原生能力时只需在这里返回
 * 真实的 `'online' | 'offline'`,判据侧一行都不用改。
 */
import type { ProbeRound, ProbeSample } from '@ihui/shared/utils/connectivity'
import { API_BASE_URL, APP_USER_AGENT, EGRESS_PROBE_URL } from './config'

/** 健康检查路径(与 API 端 `GET /api/health` 对齐;该路径在 api 侧被记为免鉴权、免审计噪音)。 */
const PROBE_PATH = '/api/health'

/**
 * 单次探测超时。旧值是 5s,而票面同屏实测的 ICMP RTT 已是 408–505ms:一次 HTTPS 需要
 * TCP 握手 1 个 RTT + TLS 1–2 个 RTT + 请求/响应 1 个 RTT,即 4 个 RTT ≈ 2s 起步,再叠上
 * 运营商 NAT 与拥塞,5s 会**常态化误判超时**。6s 仍短于业务请求的 30s 默认超时。
 */
export const PROBE_TIMEOUT_MS = 6_000

/** 本轮要探的目标清单(primary 在前,便于日志读顺序)。 */
export const PROBE_TARGETS: readonly string[] = [`${API_BASE_URL}${PROBE_PATH}`, EGRESS_PROBE_URL]

function describeFetchError(error: unknown): string {
  const raw = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  // 逐条报名用,不截断成看不懂的码;真机上 RN 的 fetch 由 okhttp 实现,措辞随版本变化,
  // 所以这里只做长度收敛,不做关键字判定(关键字判定属"拿文本决定分支",本仓明令禁止)。
  return raw.length > 160 ? `${raw.slice(0, 160)}…` : raw
}

/**
 * 探一个目标 ⇒ 一个纯观测样本。
 * 收到**任何** HTTP 状态码都是 `response`(含 4xx/5xx:那证明路径通,只是业务失败);
 * 只有超时或连不上才产出失败样本。这条区分是本票的核心修法。
 */
export async function probeTarget(
  url: string,
  timeoutMs: number = PROBE_TIMEOUT_MS,
): Promise<ProbeSample> {
  const startedAt = Date.now()
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  try {
    const resp = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'User-Agent': APP_USER_AGENT },
      cache: 'no-store',
    })
    clearTimeout(timer)
    return {
      target: url,
      kind: 'response',
      httpStatus: resp.status,
      latencyMs: Date.now() - startedAt,
    }
  } catch (error) {
    clearTimeout(timer)
    const latencyMs = Date.now() - startedAt
    if (timedOut) return { target: url, kind: 'timeout', latencyMs }
    return { target: url, kind: 'unreachable', detail: describeFetchError(error) }
  }
}

/** 一轮探测:两个目标并行取样本;全局 fetch 缺失时如实产出 not-probed(未判定),不猜离线。 */
export async function probeConnectivityRound(): Promise<ProbeRound> {
  if (typeof fetch !== 'function') {
    return {
      deviceSignal: 'unknown',
      samples: PROBE_TARGETS.map((target) => ({
        target,
        kind: 'not-probed' as const,
        reason: '运行环境没有可用的全局 fetch',
      })),
    }
  }
  const samples = await Promise.all(PROBE_TARGETS.map((target) => probeTarget(target)))
  return { deviceSignal: 'unknown', samples }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
