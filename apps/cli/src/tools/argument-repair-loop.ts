// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-711 typed 结果提交的**回喂通道** —— 守门 115(check-tool-arg-validation-wired)三步顺序的第③步:
 *   ① `argument-validator.ts` 的 `validateToolArguments`(判定本体,本模块不设第二份判定);
 *   ② `argument-validation-telemetry.ts` 的影子/enforce 记账(已入库);
 *   ③ 本模块:修复预算回喂 —— 校验不过时把"模型可改的形态"喂回去,而不是只报一句失败。
 *
 * 两条**独立**预算(上游 `dynamic-workflow/src/engine/scheduler-submit.ts:23-92` 同型):
 *   - `REPAIR_ATTEMPTS=3`:每次失败走 `{kind:'reject', violations}` 回喂(带路径级违规清单);
 *   - `NUDGE_ATTEMPTS=1`:repair 预算耗尽后的一次 `{kind:'nudge'}` 提醒(不带违规详情);
 *   - 两条都耗尽 ⇒ `{kind:'exhausted'}` 终态。
 *
 * 时序判据:**两条路径各自先 `cancelAsk` 再落终态** —— 终态帧(reject/nudge/exhausted)
 * 绝不落在一个还挂着用户 ask 的槽位后面(由 deps.cancelAsk 注入,测试按调用序钉死)。
 *
 * `normalizeSubmit` 判序(与票面逐字对齐):
 *   - 只在"**原值不过 ∧ 原值是 string**"时做**一次** `JSON.parse`,失败即止,绝不二次猜测;
 *   - 解析后仍不过 ⇒ 上报**解析后对象**上的路径级违规 —— 模型面前已是解码对象,
 *     报"expected object, got string"只会让它反复加引号或退化 `{}`(票面根因注释)。
 *
 * 装车点(守门 115 的对账面):执行器 enforce 判定处(`tools/index.ts` 的
 * `enforceValidateToolArguments` 调用点)—— 该文件当前被并发会话冻结,接线归该持有人;
 * 本模块的判定全部复用第①步出口,不新增第二份校验实现。
 */

import type { ToolSchema } from './index.js';
import type { ValidationError } from './argument-validator.js';
import { formatValidationErrorsLine, validateToolArguments } from './argument-validator.js';

/** repair 路径预算:失败回喂(reject + 路径级违规)的次数上限。 */
export const REPAIR_ATTEMPTS = 3;
/** nudge 路径预算:repair 耗尽后的一次提醒帧,与 repair **独立**计数。 */
export const NUDGE_ATTEMPTS = 1;

export interface ArgumentRepairDeps {
  /** 判定依据的 schema(守门 115 第①步 `resolveSchemaOrThrow` 的产出)。 */
  schema: ToolSchema;
  /**
   * 取消仍在等用户应答的批准请求。两条预算落终态前都必须先走这一步;
   * 缺省为 no-op(接线面由装车方注入真实现)。
   */
  cancelAsk?: () => void | Promise<void>;
}

/** 一次提交的判定结果:accepted 之外的三种帧都会终结本轮提交(等模型重发)。 */
type RepairOutcome =
  | { kind: 'accepted'; args: unknown }
  | {
      kind: 'reject';
      violations: ValidationError[];
      violationsLine: string;
      repairsRemaining: number;
      nudgesRemaining: number;
    }
  | { kind: 'nudge'; message: string; nudgesRemaining: number }
  | { kind: 'exhausted'; violations: ValidationError[]; violationsLine: string };

export interface NormalizedSubmit {
  /** 判定所依据的候选参数树(被容错解析救回时是**解析后**的对象)。 */
  candidate: unknown;
  valid: boolean;
  /** 路径级违规;解析后仍不过时是**解析后对象**上的路径,不是原串上的。 */
  violations: ValidationError[];
  /** 是否发生过"原值是 string ⇒ 一次 JSON.parse"(遥测/审计面用)。 */
  reparsed: boolean;
}

/**
 * normalizeSubmit 判序:原值过 ⇒ 原样;原值不过 ∧ 原值是 string ⇒ 一次 JSON.parse,
 * 解析后仍不过 ⇒ 上报解析后对象上的路径级违规。除这一处外不做任何改写。
 */
export function normalizeSubmit(raw: unknown, schema: ToolSchema): NormalizedSubmit {
  const first = validateToolArguments(raw, schema);
  if (first.valid) return { candidate: raw, valid: true, violations: [], reparsed: false };
  if (typeof raw === 'string') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = undefined; // 一次 parse,失败即止
    }
    if (parsed !== undefined) {
      const second = validateToolArguments(parsed, schema);
      if (second.valid) return { candidate: parsed, valid: true, violations: [], reparsed: true };
      return { candidate: parsed, valid: false, violations: second.errors, reparsed: true };
    }
  }
  return { candidate: raw, valid: false, violations: first.errors, reparsed: false };
}

export interface ArgumentRepairSession {
  readonly toolName: string;
  readonly repairsRemaining: number;
  readonly nudgesRemaining: number;
  /**
   * 模型每次重发提交都调一次。返回 accepted(参数已合格,含被容错解析救回的)
   * 或一种终态帧;**每**种终态帧落地前都先 await cancelAsk。
   */
  submit(raw: unknown): Promise<RepairOutcome>;
}

/** 建立一次提交会话:两条预算各自独立计数,耗尽即终态。 */
export function createArgumentRepairSession(toolName: string, deps: ArgumentRepairDeps): ArgumentRepairSession {
  let repairsRemaining = REPAIR_ATTEMPTS;
  let nudgesRemaining = NUDGE_ATTEMPTS;

  return {
    toolName,
    get repairsRemaining(): number {
      return repairsRemaining;
    },
    get nudgesRemaining(): number {
      return nudgesRemaining;
    },
    async submit(raw: unknown): Promise<RepairOutcome> {
      const normalized = normalizeSubmit(raw, deps.schema);
      if (normalized.valid) return { kind: 'accepted', args: normalized.candidate };

      if (repairsRemaining > 0) {
        repairsRemaining -= 1;
        await deps.cancelAsk?.(); // 先 cancelAsk 再落终态(reject 帧)
        return {
          kind: 'reject',
          violations: normalized.violations,
          violationsLine: formatValidationErrorsLine(normalized.violations),
          repairsRemaining,
          nudgesRemaining,
        };
      }
      if (nudgesRemaining > 0) {
        nudgesRemaining -= 1;
        await deps.cancelAsk?.(); // 先 cancelAsk 再落终态(nudge 帧)
        return {
          kind: 'nudge',
          message: `工具 ${toolName} 的入参仍不合法:请按工具 schema 重新提交一次(修复预算已用尽)。`,
          nudgesRemaining,
        };
      }
      await deps.cancelAsk?.(); // 终态同样先 cancelAsk
      return {
        kind: 'exhausted',
        violations: normalized.violations,
        violationsLine: formatValidationErrorsLine(normalized.violations),
      };
    },
  };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
