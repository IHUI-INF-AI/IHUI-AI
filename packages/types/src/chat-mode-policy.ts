// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// ChatMode × 工具可用性策略唯一真源(V3 #53,2026-09-26 立)。
//
// 立因:主聊天流(apps/ai-service/app/routers/llm.py)的 ChatMode 5 态此前只有
// 提示词软注入("只制定计划不调用工具"),发给 LLM 的 tools 数组并未按模式收窄——
// 用户选了 plan/review,模型照样能拿到并调用写类工具,属"权限承诺与实际不符"的
// 信任型缺陷(E1 实测)。本文件把「每个 ChatMode 允许用哪类工具」升格为跨端契约。
//
// 跨语言对齐方式(V3 #53 定案):TS 侧(本文件)是**文档/契约快照**;Python 侧的
// 运行时真源在 apps/ai-service/app/routers/llm.py 的 _CHAT_MODE_TOOL_POLICY 常量
// (+ app/services/plan_mode.py 的 READONLY_TOOLS 只读白名单)。Python 不 import TS,
// 而是以等价常量 + 注释互指的方式对齐,一致性由
// apps/ai-service/tests/test_chat_mode_tool_gate.py 的跨语言快照测试对账:
// 该测试逐字解析本文件的 policy 矩阵与只读清单,与 Python 常量做集合相等断言,
// 任一侧漂移即测试红。

import type { ChatMode } from './spec.js'

/**
 * 单个 ChatMode 的工具可用策略。
 * - 'all':      全工具开放(正常 tool loop)
 * - 'readonly': 仅 READONLY_TOOLS 白名单内工具(收窄发给 LLM 的 tools 数组;
 *               白名单外工具被幻觉调用时返回 errorCode=CHAT_MODE_TOOL_BLOCKED)
 * - 'none':     禁用全部工具(纯问答,不进 tool loop)
 */
export type ChatModeToolPolicy = 'all' | 'readonly' | 'none'

export interface ChatModeToolPolicyEntry {
  allow: ChatModeToolPolicy
  /** 中文语义说明(跨端文案/审计共用口径) */
  description: string
}

/**
 * ChatMode → 工具策略矩阵(5 态全覆盖,新增 ChatMode 必须在此显式定档)。
 *
 * 语义依据(与 stores/mode.ts、llm.py _CHAT_MODE_PROMPTS 既有口径一致):
 * - ask:    纯问答禁工具(llm.py 已在入口跳过 tool loop,'none' 为契约兜底)
 * - build:  默认执行,全工具开放
 * - plan:   只制定计划,仅只读工具(对齐 AgentLoopV2 plan 档的 tools ∩ READONLY_TOOLS)
 * - review: 只读审查,仅只读工具
 * - spec:   规格生成,产出文档型产物,全工具开放(既有语义未收窄)
 */
export const CHAT_MODE_TOOL_POLICY: Record<ChatMode, ChatModeToolPolicyEntry> = {
  ask: { allow: 'none', description: '纯问答:禁用全部工具,不进工具循环' },
  build: { allow: 'all', description: '构建执行:全工具开放' },
  plan: { allow: 'readonly', description: '计划模式:仅只读工具,写/执行类拦截' },
  review: { allow: 'readonly', description: '只读审查:仅只读工具,写/执行类拦截' },
  spec: { allow: 'all', description: '规格生成:全工具开放' },
}

/**
 * 只读工具白名单快照(逐字镜像 apps/ai-service/app/services/plan_mode.py 的
 * READONLY_TOOLS,由 test_chat_mode_tool_gate.py 跨语言快照测试对账)。
 * 语义:仅读取/查询/分析/观察,不改写仓库、系统状态或产生副作用。
 */
export const CHAT_MODE_READONLY_TOOLS: readonly string[] = [
  // 内置元工具:查询上下文剩余 token,纯只读
  'get_context_remaining',
  // 文件读
  'read_file',
  'list_files',
  'file_search',
  // 代码分析
  'search_codebase',
  'analyze_code',
  // 网络检索
  'search_web',
  'web_search',
  'fetch_url',
  // Firecrawl 网络抓取只读
  'fetch_readable',
  'map_site',
  'crawl_site',
  'extract_web',
  // 知识/记忆
  'knowledge_lookup',
  'current_memory',
  'available_skills',
  // 压缩回捞(只读)
  'context_recall',
  // 文档/产物
  'parse_document',
  'generate_chart',
  'summarize_artifacts',
  // 视觉/截图
  'screenshot_url',
  'vision_analyze',
  // 浏览器观察类(只读)
  'browser_screenshot',
  'browser_scroll',
  'browser_extract_dom',
  'browser_navigate',
  'browser_wait_for_element',
  'browser_get_attribute',
  'browser_hover',
  'browser_select_option',
  'browser_switch_tab',
  'browser_close_tab',
]

const READONLY_TOOL_SET: ReadonlySet<string> = new Set(CHAT_MODE_READONLY_TOOLS)

/** 未知 mode(如历史入参脏值)按 build 全开放处理,与 llm.py _resolve_chat_mode 返回 None 的兜底一致。 */
export function chatModeToolPolicy(mode: string | null | undefined): ChatModeToolPolicy {
  if (!mode) return 'all'
  return CHAT_MODE_TOOL_POLICY[mode as ChatMode]?.allow ?? 'all'
}

/**
 * 按 ChatMode 过滤工具名列表(前端 UI 可用性判定 / 契约展示用)。
 * 与 Python 侧 llm.py 的 tools 数组收窄同语义:'none' 返回空,'readonly' 保留白名单内。
 */
export function filterToolsForChatMode(
  mode: string | null | undefined,
  tools: readonly string[],
): string[] {
  const policy = chatModeToolPolicy(mode)
  if (policy === 'none') return []
  if (policy === 'all') return [...tools]
  return tools.filter((name) => READONLY_TOOL_SET.has(name))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
