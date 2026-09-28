// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * Plan Mode 状态机入口 — re-export types + machine,参考行业 Agent 框架的强制阻断式 Plan Mode。
 */

export { PlanMachine } from './machine.js';
export type { PlanContext, PlanEvent, PlanState } from './types.js';
