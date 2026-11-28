// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 工具执行墙钟预算策略(W4-14 第二轴)。
 *
 * 只回答“这次执行最多活多久”,不建定时器、不 abort、不结算 ——
 * 应用点仍在 `tools/index.ts` 的 `executeWithinExecBudget`。
 * 从 `tools/index.ts` 抽出后,常量和解析规则可以独立被 CLI/嵌入方校验,
 * 不必为了读一个上限去加载整张工具注册表。
 */

/** 默认档 30 分钟。取值依据:本仓工具自身最长的一档限是后台任务等待 600s
 *  与 DAP stopped 事件 300s,默认档必须显著高于所有自限档;30 min = 最长自限 × 3。
 *  需要更长的工具**显式声明** `execBudget`,不得为消红去抬这一档。 */
export const TOOL_EXEC_BUDGET_DEFAULT_MS = 30 * 60_000;

/** 硬封顶 60 分钟:默认档 / 工具声明 / 环境变量覆盖都不得越过。 */
export const TOOL_EXEC_BUDGET_MAX_MS = 60 * 60_000;

/** 结算宽限:到点后先 abort,再给 handler 这么多时间收尾;仍不 settle 就停止等待并代为结算。 */
export const TOOL_EXEC_BUDGET_SETTLE_GRACE_MS = 5_000;

/** 绝对上限倍数:预算按活动重排时,另设从开始计时的总上限,防无限续命。 */
export const TOOL_EXEC_BUDGET_ABSOLUTE_FACTOR = 3;

/** 逃生舱:总开关(仅应急)。设 off/0/false 时整条预算不生效。 */
const EXEC_BUDGET_DISABLE_ENV = 'IHUI_TOOL_EXEC_BUDGET';
/** 观察档:覆盖默认值,用于逐档量“哪些工具会撞上新上限”(仍受 MAX 封顶)。 */
const EXEC_BUDGET_DEFAULT_ENV = 'IHUI_TOOL_EXEC_BUDGET_MS';

/** 显式预算档(毫秒)。 */
export interface ToolExecBudgetMs {
  readonly ms: number;
}

/** 结构性声明:该工具不该被墙钟打断,理由写进数据而不是注释。 */
export interface ToolExecBudgetNotInterruptible {
  readonly notInterruptible: true;
  readonly reason: string;
}

export type ToolExecBudget = ToolExecBudgetMs | ToolExecBudgetNotInterruptible;

/** 只取解析需要的结构,避免策略模块反向依赖整张 Tool 注册表。 */
export interface ToolExecBudgetCarrier {
  readonly name: string;
  readonly execBudget?: ToolExecBudget;
}

function parsePositiveIntMs(raw: string | undefined): number | undefined {
  if (raw === undefined || raw.trim() === '') return undefined;
  const n = Number(raw.trim());
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * 预算解析的唯一出口。优先级:
 *   ① notInterruptible ⇒ undefined(连定时器都不建)
 *   ② 工具显式声明 ms ⇒ 该值
 *   ③ 环境变量覆盖档 ?? 默认档
 * 最后一律过 `Math.min(…, TOOL_EXEC_BUDGET_MAX_MS)` 封顶。
 *
 * 刻意不读模型传的 `args.timeout_ms`:执行多久必须由宿主说了算。
 * `0` 与非法值退回默认档,不把“0 被压成 1ms 立刻超时”放进来。
 */
export function resolveToolExecBudgetMs(
  tool: ToolExecBudgetCarrier,
  env: NodeJS.ProcessEnv = process.env,
): number | undefined {
  const declared = tool.execBudget;
  if (declared && 'notInterruptible' in declared) return undefined;
  if (/^(?:off|0|false)$/i.test((env[EXEC_BUDGET_DISABLE_ENV] ?? '').trim())) return undefined;
  const envDefault = parsePositiveIntMs(env[EXEC_BUDGET_DEFAULT_ENV]);
  const base = declared ? declared.ms : (envDefault ?? TOOL_EXEC_BUDGET_DEFAULT_MS);
  const safe = Number.isFinite(base) && base > 0 ? base : (envDefault ?? TOOL_EXEC_BUDGET_DEFAULT_MS);
  return Math.min(safe, TOOL_EXEC_BUDGET_MAX_MS);
}
