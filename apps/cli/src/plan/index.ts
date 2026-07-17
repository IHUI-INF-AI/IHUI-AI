/**
 * Plan Mode 状态机入口 — re-export types + machine,对齐 grok-build 强制阻断式 Plan Mode。
 */

export { PlanMachine } from './machine.js';
export type { PlanContext, PlanEvent, PlanState } from './types.js';
