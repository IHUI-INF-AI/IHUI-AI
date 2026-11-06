// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 预算硬停止原因码 → 一句中文（批次 3，2026-11-06 立）。
 *
 * 为什么放 shared:web / RN / 小程序 三端都要展示"因预算停止",若各写一份映射,
 * 新增原因码时必然漏端(漏端 = 某端静默显示通用句,线上表现为"原因说不清")。
 * 这里按 `BUDGET_STOP_REASON_CODES` 封闭集逐码穷举,`Record<BudgetStopReason, string>`
 * 让缺项在编译期就报错;未知码**不猜**具体原因,统一回落通用句。
 */
import {
  BUDGET_STOP_REASON_CODES,
  isBudgetStopReason,
  type BudgetStopReason,
} from '../sse/contract'

/** 六种停止原因各一句；键必须与封闭集逐项对齐（缺项编译期即报错）。 */
const BUDGET_STOP_REASON_TEXT: Record<BudgetStopReason, string> = {
  daily_token_limit: '今日 token 额度已用尽，本轮生成已停止。',
  daily_cost_limit: '今日费用额度已用尽，本轮生成已停止。',
  hourly_token_limit: '本小时 token 额度已用尽，本轮生成已停止。',
  pillar_token_limit: '当前能力支柱的 token 额度已用尽，本轮生成已停止。',
  request_token_limit: '单次请求 token 额度已用尽，本轮生成已停止。',
  provider_budget_exhausted: '上游模型账户额度已耗尽，本轮生成已停止。',
}

/** 未知/缺失原因码的唯一回落文案（不渲染任何猜测性的具体原因）。 */
export const BUDGET_STOP_FALLBACK_TEXT = '预算已停止本轮生成'

/**
 * 原因码 → 展示文案。入参放宽到 unknown，是因为停止帧的 reasonCode 在线上
 * 可能是旧版或未来新增值：未知码必须落到通用句，而不是整条不显示。
 */
export function budgetStopReasonText(reasonCode: unknown): string {
  if (!isBudgetStopReason(reasonCode)) return BUDGET_STOP_FALLBACK_TEXT
  return BUDGET_STOP_REASON_TEXT[reasonCode]
}

/** 供测试与守卫对账：封闭集里的每个码都必须有独立文案，且不得回落到通用句。 */
export function budgetStopReasonTexts(): readonly string[] {
  return BUDGET_STOP_REASON_CODES.map((code) => BUDGET_STOP_REASON_TEXT[code])
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
