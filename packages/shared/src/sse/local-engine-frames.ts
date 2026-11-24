// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * 本地 agent 引擎 — 必须支持的 SSE 帧子集(阶段 0 冻结产物)。
 *
 * 定位:本地引擎跑在用户机(桌面 Tauri / 本地推理服务),产出与云端**同一套** SSE 契约的
 * 一个**子集**。这里把"第一批本地引擎必须实现的帧"从中央契约 `SSE_EVENTS` 派生钉死,
 * 作为实现方的单一真相源;测试看护它是子集、不放大、不私自造帧。
 *
 * 为什么是子集不是全量:
 *  - 中央契约 39 帧(单一真相源 packages/shared/src/sse/contract.ts);
 *  - 本地引擎第一批只跑 34 个纯本地工具的代码/文件/终端/git 任务,
 *    用不到 review-finding / form_request / goal_updated / workspace_lock_* /
 *    subagent_* 等云端/业务域帧;
 *  - 子集策略让本地引擎**天然满足** check-agent-event-parity(门只要求生产 ⊆ 契约 ∧ 前端可消费),
 *    不需要改门。
 *
 * 派生而非重抄:帧名一律从 `SSE_EVENTS` 取值,禁止手写字面量 —— 防两处漂移(§0.6 单一真相源)。
 */

import { SSE_EVENTS } from './contract'

/**
 * 本地引擎第一批必须产出的帧。
 * 每一条都是 `SSE_EVENTS` 的某个 key —— 类型层强制"必须是中央契约已登记的帧"。
 */
export const LOCAL_ENGINE_FRAME_KEYS = [
  'START', // 流开始
  'CHUNK', // 增量文本
  'REASONING', // 思维链增量
  'THINKING', // 思考增量
  'PLAN_STEP', // 多步计划(ReAct)
  'TOOL_CALL_START', // 工具调用开始(name ∈ 34 白名单)
  'TOOL_DELTA', // 写类工具 diff 预览
  'TOOL_RESULT', // 工具结果
  'TERMINAL_START', // 终端任务开始
  'TERMINAL_DELTA', // 终端逐行增量
  'TERMINAL_END', // 终端任务结束
  'TOOL_APPROVAL', // 写/执行类工具审批
  'USAGE', // 用量
  'PARTIAL_DONE', // 流中断标记(不静默变短)
  'DONE', // 流结束
  'ERROR', // 回答失败
] as const satisfies readonly (keyof typeof SSE_EVENTS)[]

/** 本地引擎第一批帧名(wire 上的判别名)。从 key 经中央契约映射,不自写字面量。 */
export type LocalEngineFrameKey = (typeof LOCAL_ENGINE_FRAME_KEYS)[number]
export type LocalEngineFrameName = (typeof SSE_EVENTS)[LocalEngineFrameKey]

export const LOCAL_ENGINE_FRAME_NAMES: readonly LocalEngineFrameName[] = LOCAL_ENGINE_FRAME_KEYS.map(
  (k) => SSE_EVENTS[k],
)

/**
 * 首批 34 个纯本地工具(与 阶段2_本地工具白名单盘点.md 一致)。
 * 本地引擎 `tool-call-start.name` 必须落在此集合内。
 */
export const LOCAL_ENGINE_TOOL_WHITELIST = [
  // 代码与检索(本地)
  'search_codebase',
  'analyze_code',
  'investigate_codebase',
  'get_tool_schema',
  'get_diagnostics',
  'file_search',
  'list_files',
  'render_repo_tree',
  // 文件读写
  'read_file',
  'read_image',
  'read_tool_output',
  'write_file',
  'file_edit',
  'resolve_conflict',
  // 终端与 git
  'terminal',
  'run_command',
  'sandbox_session',
  'git_operations',
  // 文档/表格(本地解析)
  'parse_document',
  'document_tables',
  'extract_document_assets',
  'sheet_formula_eval',
  'sheet_formula_validate',
  'workbook_open',
  'workbook_read_range',
  'workbook_write_cells',
  'workbook_close',
  // 辅助(本地产物)
  'generate_chart',
  'generate_report',
  'notebook_edit',
  'init_agents_md',
  'skill',
  'todo_write',
  'todo_read',
] as const

export type LocalEngineToolName = (typeof LOCAL_ENGINE_TOOL_WHITELIST)[number]
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
