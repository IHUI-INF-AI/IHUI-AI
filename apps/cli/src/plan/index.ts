/**
 * Plan Mode 状态机入口 — re-export types + machine + 结构化计划,参考行业 Agent 框架的强制阻断式 Plan Mode。
 */

export { PlanMachine } from './machine.js';
export type { PlanContext, PlanEvent, PlanState } from './types.js';
export {
  StructuredPlanStore,
  planFilePath,
  parseStructuredPlan,
} from './structured.js';
export type {
  PlanStep,
  PlanStepAction,
  PlanStepStatus,
  StructuredPlan,
  StructuredPlanInput,
} from './structured.js';
