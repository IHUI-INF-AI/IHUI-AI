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
import { resolveCloudRunBase } from './cloud-run.js';

/** 与 `agent_loop_v2` / `goal_completion_gate.py` 同名单值:done 帧覆盖 stopReason 用 */
export const STOP_VERIFICATION_NOT_ACHIEVED = 'verification_not_achieved';
export const STOP_VERIFICATION_UNDETERMINED = 'verification_undetermined';

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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
