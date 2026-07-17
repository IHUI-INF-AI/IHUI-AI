/**
 * Plan Mode 状态机类型定义 — 对齐 grok-build 强制阻断式 Plan Mode。
 *
 * 做减法:
 *   - 4 态主链 + cancelled 终态:initialized → gathering → executing → done
 *   - PlanContext 字段全可选,供 transition 钩子按需传入,最小耦合
 */

export type PlanState =
  | 'initialized'
  | 'gathering'
  | 'executing'
  | 'done'
  | 'cancelled';

export type PlanEvent =
  | 'start'
  | 'gather_complete'
  | 'execute_complete'
  | 'cancel'
  | 'reset';

export interface PlanContext {
  currentState?: PlanState;
  messages?: unknown[];
  planSteps?: string[];
  currentStepIndex?: number;
}
