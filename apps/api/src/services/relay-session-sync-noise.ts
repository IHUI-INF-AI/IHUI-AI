// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 客户端会话回灌腿「未判定」日志降噪判据(2026-10-31 立)。
 *
 * 立因:worker 的 qoder/workbuddy 回灌腿在**服务身份**(LocalSystem)下结构上读不到交互用户
 * 的 APPDATA/DPAPI 数据,每 10 分钟一条 warn、原因一字不变(实测 qoder 腿每轮
 * 「未找到 Qoder 数据目录」)。本机已有用户态计划任务承担同一条腿(`IHUI-Qoder-Session-Sync`),
 * 这条 warn 只剩噪音;但直接删掉又会把"真换成另一种失败(如 tsx 缺失/库连不上)"也一起吞掉。
 *
 * 判据:同一 job 的"同因未判定"只在 ①原因变化 或 ②距上次 warn 超过窗口(默认 6h)时记 warn;
 * 其间只记 debug 并累计被压下的轮数(随下次 warn 一并报出)。失败形态变化仍第一时间可见。
 */

/** 同因未判定的 warn 间隔(默认 6 小时);env 可覆盖,便于演练与不同部署形态 */
export const DEFAULT_UNJUDGED_WARN_WINDOW_MS = 6 * 60 * 60 * 1000

export interface UnjudgedNoiseState {
  /** 上一次 warn 的原因(用于识别"原因变化") */
  reason: string
  /** 上一次真正记 warn 的时刻(epoch ms) */
  lastWarnAt: number
  /** 自上次 warn 以来被压下的轮数 */
  suppressed: number
}

export interface UnjudgedLogDecision {
  warn: boolean
  /** 本次 warn 正文要一并报出的"被压下轮数"(非 warn 轮为已累计值) */
  suppressed: number
  state: UnjudgedNoiseState
}

/** 纯函数(镜像测试直接 import,禁止在测试里复制判据)。 */
export function decideUnjudgedLog(
  prev: UnjudgedNoiseState | undefined,
  reason: string,
  now: number,
  windowMs: number = DEFAULT_UNJUDGED_WARN_WINDOW_MS,
): UnjudgedLogDecision {
  if (prev && prev.reason === reason && now - prev.lastWarnAt < windowMs) {
    const suppressed = prev.suppressed + 1
    return { warn: false, suppressed, state: { ...prev, suppressed } }
  }
  return {
    warn: true,
    suppressed: prev && prev.reason === reason ? prev.suppressed : 0,
    state: { reason, lastWarnAt: now, suppressed: 0 },
  }
}

/** 失败原因归一:取首行、限长;取不到给稳定占位(避免空串把不同失败折叠成同一身份)。 */
export function unjudgedReasonOf(stderr: string | undefined): string {
  const first = String(stderr ?? '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .find((s) => s.length > 0)
  return (first || '未判定(无 stderr)').slice(0, 200)
}

export const __test__ = { decideUnjudgedLog, unjudgedReasonOf }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
