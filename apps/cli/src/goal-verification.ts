// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * goal 模式的执行侧独立校验闸门(AGENTS.md §8 第 3 步"禁止模型自评 yes")。
 *
 * 为什么这一层必须存在:契约字段(`GoalHardCriterion` / `GoalVerification`)、ai-service
 * 的判定本体(`completion_verification.py`)与 web 的呈现位都早已入库,唯独**执行侧没有
 * 调用方** —— `stopReason === 'end_turn'` 仍直接等价于"完成了"。没有调用方的判定器等于
 * 没有判定(本仓同一形态已在守门 64/70/81 上反复吃过亏)。
 *
 * 三条不可让(全部有对应用例):
 *   1. **绝不 fail-open**:服务不可达 / 返回体畸形 / 缺 `treat_as_complete` 章 ⇒ 一律
 *      `undetermined`,并且按"未完成"处理。静默放行等于把 §8 又写回文档里。
 *   2. **结论由代码合成,不由模型自述**:`status` 说 achieved 而章没盖 ⇒ 不认。
 *   3. **采集侧只搬运不判断**:命令没跑过就是没跑过,绝不拿"相近命令"冒充证据。
 *
 * 判档名与 ai-service `goal_completion_gate.py` 的 `STOP_VERIFICATION_*` 逐字同值 ——
 * 一族两值,两处必须同形(真源是 Python 侧,这里是对齐而非另立)。
 */

import { fetchAiServiceJson } from '@ihui/api-client';
import type { GoalHardCriterion, GoalVerification } from '@ihui/api-client';
import { GOAL_VERIFICATION_MAX_CONSECUTIVE_FAILURES } from '@ihui/shared';
import { neutralizeBoundaries } from './utils/prompt-boundary.js';
import { resolveCloudRunBase } from './cloud-run.js';

/** 与 `agent_loop_v2` / `goal_completion_gate.py` 同名单值:done 帧覆盖 stopReason 用 */
export const STOP_VERIFICATION_NOT_ACHIEVED = 'verification_not_achieved';
export const STOP_VERIFICATION_UNDETERMINED = 'verification_undetermined';
/**
 * AGENTS.md §8 第 4 步"连续 N 轮 no 无进展 → blocked"的收口档。
 * 与"单次未过"(`STOP_VERIFICATION_*`)是两个档,不得合并 —— 前者还在续跑,
 * 后者已经放弃续跑,把它们并成一档就等于把"还剩几次机会"这条信息丢掉。
 */
export const STOP_GOAL_BLOCKED = 'goal_blocked';

/**
 * 连续未过的上限:**唯一真源在 ai-service `app/core/tunables.py`,TS 侧只从
 * `@ihui/shared` 的跨端镜像取**(守门 `check-killer-parity-ends` 拦的就是端内写死数字)。
 * 原样再导出,是为了让消费方(含测试)引用的是同一个标识符,而不是各自 `import` 两个名字。
 */
export { GOAL_VERIFICATION_MAX_CONSECUTIVE_FAILURES };

/**
 * 解析本轮生效的连续未过上限。
 *
 * 取向与全文件同一条:**缺信息只会更保守,绝不会更宽松**。
 * 缺失 / 非数字 / 非正数 / NaN / Infinity 一律落回镜像常量 —— 拿 Infinity 当"没配上限"
 * 是这台机上最常见的一种 fail-open(它等于"永不收口",而 §8 要的恰恰是有界)。
 */
export function resolveMaxConsecutiveFailures(
  raw: number | null | undefined,
): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return GOAL_VERIFICATION_MAX_CONSECUTIVE_FAILURES;
  const n = Math.floor(raw);
  return n >= 1 ? n : GOAL_VERIFICATION_MAX_CONSECUTIVE_FAILURES;
}

/** ai-service 端点(`app/routers/goal_verification.py` 的 @router.post 路径) */
export const GOAL_VERIFY_PATH = '/api/agent/goal-verify';

/**
 * 能产出"退出码 / 测试通过数"这类机器结论的工具族。名单与 Python 侧
 * `COMMAND_TOOL_NAMES` 同值 —— 少一个名字,那一型调用就结构上采不到证据。
 */
export const COMMAND_TOOL_NAMES: readonly string[] = ['run_command', 'shell', 'bash'];

/** 证据摘录上限(字符)。与 Python `MAX_EXCERPT_CHARS` 同值,超限必须显式标 truncated。 */
const MAX_EXCERPT_CHARS = 1200;

/** 一次工具调用的采集侧记录(循环在真跑工具的那一处喂进来) */
export interface GoalToolCallRecord {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  ok: boolean;
  exitCode?: number;
  output?: string;
}

/** 送给校验轮的请求体(逐字对齐 `VerifyIn`) */
export interface GoalVerifyRequest {
  goal: string;
  criteria: Array<{
    id: string;
    statement: string;
    evidence_kind?: string;
    required?: boolean;
  }>;
  evidence: Array<{
    id: string;
    criterion_id: string;
    source: string;
    outcome?: 'met' | 'unmet' | 'absent' | null;
    excerpt?: string;
    unavailable_reason?: string | null;
    truncated?: boolean;
    captured_at?: number;
  }>;
  executor_claim: string;
  executor_model?: string | null;
}

/** 调用方只需要这三项就能决定"能不能宣布完成" */
export interface GoalVerdictLike {
  status: string;
  treat_as_complete: boolean;
  goal_status: string;
}

export interface BuildGoalEvidenceInput {
  criteria: GoalHardCriterion[];
  calls: GoalToolCallRecord[];
}

export interface BuildGoalEvidenceResult {
  evidence: GoalVerifyRequest['evidence'];
  /** 声明了 probe_command 但本轮根本没跑过 —— 只点名,不冒充 */
  unprobed: Array<{ criterion_id: string; reason: string }>;
}

/** 命令参数取第一个非空字符串形态(不同工具对同一意图有两个键名,漏一个就采不到) */
function commandOf(args: Record<string, unknown>): string | null {
  for (const key of ['command', 'cmd']) {
    const v = args[key];
    if (typeof v === 'string' && v.trim() !== '') return v.trim();
  }
  return null;
}

function clip(text: string): { excerpt: string; truncated: boolean } {
  if (text.length <= MAX_EXCERPT_CHARS) return { excerpt: text, truncated: false };
  return { excerpt: text.slice(0, MAX_EXCERPT_CHARS), truncated: true };
}

/**
 * 把"本轮真跑过什么"对齐成证据。
 *
 * 只有 `probe_command` 逐字命中的命令族调用才算数(取最后一次 —— 修到第 N 次才通过是
 * 常态,拿第一次的失败冒充整体失败同样是失真)。
 */
export function buildGoalEvidence(input: BuildGoalEvidenceInput): BuildGoalEvidenceResult {
  const evidence: GoalVerifyRequest['evidence'] = [];
  const unprobed: Array<{ criterion_id: string; reason: string }> = [];

  for (const c of input.criteria) {
    const probe = typeof c.probe_command === 'string' ? c.probe_command.trim() : '';
    if (!probe) continue; // 无机器探针 ⇒ 交语义判定,不得拿别的命令凑
    const matched = input.calls.filter(
      (call) => COMMAND_TOOL_NAMES.includes(call.toolName) && commandOf(call.args) === probe,
    );
    const last = matched[matched.length - 1];
    if (!last) {
      unprobed.push({
        criterion_id: c.id,
        reason: `本轮没有真跑过探针命令: ${probe}`,
      });
      continue;
    }
    const want = typeof last.exitCode === 'number' ? last.exitCode : last.ok ? 0 : 1;
    const expect = typeof c.expected_exit_code === 'number' ? c.expected_exit_code : 0;
    const { excerpt, truncated } = clip(`${last.toolName} ${probe} -> exit=${want}\n${last.output ?? ''}`);
    evidence.push({
      id: last.id,
      criterion_id: c.id,
      source: `${last.toolName}:${last.id}`,
      outcome: want === expect ? 'met' : 'unmet',
      excerpt,
      truncated,
    });
  }

  return { evidence, unprobed };
}

/** 兜底成一份"可读、且绝不因为缺信息而变绿"的结论 */
function undetermined(reason: string, warnings: string[] = []): GoalVerification {
  return {
    status: 'undetermined',
    goal_status: 'undetermined',
    treat_as_complete: false,
    criteria: [],
    independent_request_made: false,
    judge_model: null,
    unavailable_reason: reason,
    independence_warnings: warnings,
    consecutive_failures: 0,
    max_consecutive_failures: 0,
  };
}

/**
 * 归一化服务端返回体。
 *
 * `treat_as_complete` 是**唯一**能被当成完成的信号,且必须由代码核过:
 * 缺章 / 章与 status 矛盾 / 未知档位 ⇒ 全部落 undetermined。
 * 这不是防御性冗余 —— 校验端与执行端是两次发版,漂移的表现永远是"安静地放行"。
 */
export function normalizeGoalVerdict(raw: unknown): GoalVerification {
  if (raw === null || typeof raw !== 'object') {
    return undetermined('校验返回体不是对象,按未判定处理');
  }
  const v = raw as Partial<GoalVerification>;
  const stamp = v.treat_as_complete;
  if (typeof stamp !== 'boolean') {
    return undetermined('校验结论缺少 treat_as_complete 章,不采信 status 字面');
  }
  const status = typeof v.status === 'string' ? v.status : 'undetermined';
  const warnings = Array.isArray(v.independence_warnings) ? v.independence_warnings : [];
  if (stamp && status !== 'achieved') {
    return undetermined(
      `treat_as_complete=true 与 status=${status} 矛盾,按未判定处理`,
      [...warnings, 'treat_as_complete 与 status 不一致'],
    );
  }
  if (!stamp && status === 'achieved') {
    return {
      ...v,
      status,
      goal_status: 'undetermined',
      treat_as_complete: false,
      criteria: Array.isArray(v.criteria) ? v.criteria : [],
      independent_request_made: v.independent_request_made === true,
      judge_model: v.judge_model ?? null,
      unavailable_reason: v.unavailable_reason ?? '服务端盖章未通过,不视为完成',
      independence_warnings: [...warnings, 'treat_as_complete=false 覆盖 status=achieved'],
      consecutive_failures: v.consecutive_failures ?? 0,
      max_consecutive_failures: v.max_consecutive_failures ?? 0,
    };
  }
  return {
    ...v,
    status,
    goal_status: stamp ? 'achieved' : status === 'not_achieved' ? 'not_achieved' : 'undetermined',
    treat_as_complete: stamp,
    criteria: Array.isArray(v.criteria) ? v.criteria : [],
    independent_request_made: v.independent_request_made === true,
    judge_model: v.judge_model ?? null,
    unavailable_reason: stamp ? (v.unavailable_reason ?? null) : (v.unavailable_reason ?? '独立校验未通过'),
    independence_warnings: warnings,
    consecutive_failures: v.consecutive_failures ?? 0,
    max_consecutive_failures: v.max_consecutive_failures ?? 0,
  };
}

export interface RunGoalVerificationInput {
  goal: string;
  criteria: GoalHardCriterion[];
  calls: GoalToolCallRecord[];
  executorClaim: string;
  executorModel?: string | null;
  /** 注入点:测试与"校验端不在本机"的部署都走这里;缺省走 api-client 的 ai-service 出口 */
  requestVerification?: (req: GoalVerifyRequest) => Promise<unknown>;
}

/**
 * 跑一次独立校验。返回结论;调用方只认 `treat_as_complete`。
 *
 * 没声明指标 ⇒ 返回 null(非 goal 模式,行为与接线前逐零差异)。
 */
export async function runGoalVerification(
  input: RunGoalVerificationInput,
): Promise<GoalVerification | null> {
  const criteria = input.criteria ?? [];
  if (criteria.length === 0) return null;

  const { evidence, unprobed } = buildGoalEvidence({ criteria, calls: input.calls ?? [] });
  const req: GoalVerifyRequest = {
    goal: input.goal,
    criteria: criteria.map((c) => ({
      id: c.id,
      statement: c.statement,
      evidence_kind: c.evidence_kind ?? 'manual',
      required: c.required !== false,
    })),
    // 缺证据也要如实送上去(outcome=absent):静默少送会让校验端把"没采到"读成"没有这条"
    evidence: [
      ...evidence,
      ...unprobed.map((u) => ({
        id: `absent:${u.criterion_id}`,
        criterion_id: u.criterion_id,
        source: 'cli-collector',
        outcome: 'absent' as const,
        unavailable_reason: u.reason,
      })),
    ],
    executor_claim: input.executorClaim,
    executor_model: input.executorModel ?? null,
  };

  const request =
    input.requestVerification ??
    (async (r: GoalVerifyRequest): Promise<unknown> => {
      // 绝对地址:该端点住在 ai-service(`/api/agent/*` 不在 apps/api 的路由面上),
      // 基址复用 cloud-run 的单一出口(AI_SERVICE_URL 优先,默认 8803),不另立第二份解析。
      const res = await fetchAiServiceJson<unknown>(`${resolveCloudRunBase()}${GOAL_VERIFY_PATH}`, {
        method: 'POST',
        body: JSON.stringify(r),
      });
      if (!res.success) throw new Error(res.error ?? 'goal-verify 请求失败');
      return res.data;
    });

  try {
    return normalizeGoalVerdict(await request(req));
  } catch (err) {
    return undetermined(`独立校验不可达: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * 把校验结论落回循环的停止档。
 *
 * 只有 `end_turn`(循环自宣完成)才有"完成"这件事可校验;轮次耗尽 / 预算耗尽 / 错误 /
 * 取消根本不跑校验 —— 更绝不允许把"没跑成"写成"达成了"。
 */
export function applyGoalVerificationToStopReason<R extends string>(
  stopReason: R,
  verification: GoalVerdictLike | null,
): R | typeof STOP_VERIFICATION_NOT_ACHIEVED | typeof STOP_VERIFICATION_UNDETERMINED {
  if (stopReason !== 'end_turn' || !verification) return stopReason;
  if (verification.treat_as_complete) return stopReason;
  return verification.status === 'not_achieved'
    ? STOP_VERIFICATION_NOT_ACHIEVED
    : STOP_VERIFICATION_UNDETERMINED;
}

/**
 * 续跑判定的四种落点。**四个档彼此不可合并**:
 * - `pass`：盖章通过，按 `end_turn` 交账；
 * - `continue`：未过但还有迭代预算 → 把未达标项回灌给循环，让它继续干活（§8 第 4 步的 "no → 续跑"）；
 * - `blocked`：连续未过到达上限 → 生命周期收口（§8 第 4 步的 "连续 N 轮 no → blocked"）；
 * - `deliver_unverified`：未过且**没有**预算了 → 既不判达成也不判 blocked，
 *   按未达标交账。把它写成 `pass` 就是 fail-open；把它并入 `blocked` 就是谎报生命周期档位
 *   （"没预算"与"干不动了"是两件事，恢复端要分得出来）。
 */
export type GoalContinuationAction = 'pass' | 'continue' | 'blocked' | 'deliver_unverified';

export interface GoalContinuationInput {
  /** 本轮独立校验结论（`runGoalVerification` 的返回值） */
  verification: GoalVerification;
  /** 进入本轮之前已累计的连续未过次数 */
  consecutiveFailures: number;
  /** 循环还能不能再跑一轮（`maxIterations - iterations`）；<=0 即无预算 */
  iterationsRemaining: number;
  /** 上限覆盖：缺省取服务端上报的 `max_consecutive_failures`，再缺省取跨端镜像常量 */
  maxConsecutiveFailures?: number | null;
}

export interface GoalContinuationDecision {
  action: GoalContinuationAction;
  /** 本轮之后累计的连续未过次数（通过即归零） */
  consecutiveFailures: number;
  /**
   * 交账用的结论。**只在落 blocked 时**才是副本（`goal_status: 'blocked'`）；
   * 其余情形是原对象引用 —— 绝不原地改写调用方手里的那份。
   */
  verification: GoalVerification;
  /** 回灌给循环的反馈正文（仅 `continue` 档非空） */
  feedback?: string;
  /** 本轮生效的上限（供通知/日志如实报出，不让人猜"这次是第几次"） */
  maxConsecutiveFailures: number;
}

/**
 * 组装回灌正文。**刻意全 ASCII**：
 * ① 它是喂给模型的提示，不是给人看的 UI 文案（人看的版本由命令层经 i18n 出口打印，§19）；
 * ② 在 `apps/cli/src` 写中文字面量会顶到守门 70 的每文件棘轮。
 * 服务端来的 reason / unavailable_reason 属"非宿主内容"，进提示前必须过边界中和
 * （唯一出口 `neutralizeBoundaries`）—— 否则第三方文本里出现 `[GOAL_VERIFICATION_*]`
 * 这类前缀就能冒充宿主在说话。
 */
export function buildGoalFeedbackMessage(
  verification: GoalVerification,
  attempt: number,
  maxAttempts: number,
): string {
  const unmet = verification.criteria.filter((c) => c.verdict !== 'met');
  const lines = [
    `[GOAL_VERIFICATION_FAILED] attempt ${attempt} of ${maxAttempts}: the independent verification ` +
      `round did not pass. Do NOT report completion; keep working until every required criterion ` +
      `is satisfied by real evidence.`,
  ];
  if (unmet.length > 0) {
    lines.push('Unmet criteria:');
    for (const c of unmet) {
      lines.push(
        `- criterion_id=${c.criterion_id} verdict=${c.verdict} basis=${c.basis}` +
          ` reason=${neutralizeBoundaries(String(c.reason ?? ''))}`,
      );
    }
  } else {
    lines.push(
      'No per-criterion breakdown was returned, so treat every declared criterion as unverified.',
    );
  }
  if (verification.unavailable_reason) {
    lines.push(
      `unavailable_reason=${neutralizeBoundaries(verification.unavailable_reason)}`,
    );
  }
  if (attempt < maxAttempts) {
    lines.push(`This goal is marked blocked after ${maxAttempts} consecutive failed checks.`);
  }
  return lines.join('\n');
}

/**
 * §8 第 4 步的判定：**未过 ≠ 交账**。
 *
 * 判序（顺序即语义，两处都已由用例钉死）：
 *   盖章通过 → pass；否则先数次数 —— 到达上限 → blocked（优先于"没预算"，
 *   因为收口比"这次恰好跑不动"更具体）；还有预算 → continue；没预算 → deliver_unverified。
 */
export function decideGoalContinuation(input: GoalContinuationInput): GoalContinuationDecision {
  const { verification } = input;
  const maxAttempts = resolveMaxConsecutiveFailures(
    input.maxConsecutiveFailures ?? verification.max_consecutive_failures,
  );
  if (verification.treat_as_complete) {
    return {
      action: 'pass',
      consecutiveFailures: 0,
      verification,
      maxConsecutiveFailures: maxAttempts,
    };
  }
  // 未过：not_achieved 与 undetermined 同等计一次（拿"没判成"当免费续跑就是 fail-open）
  const next = input.consecutiveFailures + 1;
  if (next >= maxAttempts) {
    return {
      action: 'blocked',
      consecutiveFailures: next,
      // 收口档写进副本：goal_status 是生命周期字段，而 status 保留服务端原判
      verification: { ...verification, goal_status: 'blocked' },
      maxConsecutiveFailures: maxAttempts,
    };
  }
  if (input.iterationsRemaining > 0) {
    return {
      action: 'continue',
      consecutiveFailures: next,
      verification,
      feedback: buildGoalFeedbackMessage(verification, next, maxAttempts),
      maxConsecutiveFailures: maxAttempts,
    };
  }
  return {
    action: 'deliver_unverified',
    consecutiveFailures: next,
    verification,
    maxConsecutiveFailures: maxAttempts,
  };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
