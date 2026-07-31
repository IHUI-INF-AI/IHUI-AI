/**
 * 历史遗留的极简 ChatMessage(2026-07-31 标注)。
 * 与 packages/shared/src/hooks/use-chat.ts 的 ChatMessage 同名但定义不一致。
 * 新代码应优先使用 shared 版本(含 toolCalls / reasoning / meta 等字段);
 * 本接口仅保留向后兼容,勿再扩展。
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export interface AgentTask {
  id: string;
  goal: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
}

// ==================== AI 对话可视化深度接入(2026-07-31 立) ====================
// 为 AI 对话可视化深度接入提供跨端类型契约:
// - ToolCallSource:工具调用来源(builtin/plugin/mcp)
// - ToolCallSummary:工具调用汇总(SSE 流末尾由后端聚合发出)
// - BaseToolCall:基础工具调用接口(各端继承后扩展端独占字段)

/** 工具调用来源(2026-07-31 立,AI 对话可视化深度接入) */
export type ToolCallSource = 'builtin' | 'plugin' | 'mcp'

/**
 * 工具调用汇总(2026-07-31 立,在 SSE 流末尾由后端聚合发出)。
 * - 未收到 tool-summary SSE 事件时,前端可降级从 message.toolCalls 数组本地聚合
 * - 收到时直接使用,无需重复计算
 */
export interface ToolCallSummary {
  /** 搜索文件次数(read_file/search_codebase/file_search 工具调用次数) */
  filesSearched: number
  /** 搜索网页次数(web_search/search_web 工具调用次数) */
  webSearched: number
  /** 修改的文件数(edit_file/write_file 工具调用去重后的文件路径数) */
  filesModified: number
  /** 新增行数(edit_file/write_file 工具 diff 中 + 行数) */
  linesAdded: number
  /** 删除行数(edit_file/write_file 工具 diff 中 - 行数) */
  linesDeleted: number
  /** 按工具分类统计(如 { read_file: 3, edit_file: 2, web_search: 1 }) */
  toolsByCategory: Record<string, number>
  /** 总工具调用次数(等于 Object.values(toolsByCategory).reduce((a,b)=>a+b,0)) */
  totalCalls: number
  /** 总耗时(ms,从第一个 tool-call-start 到最后一个 tool-result) */
  totalDurationMs?: number
}

/**
 * 基础工具调用接口(2026-07-31 立,扩展版,跨端共享)。
 * - web 端在 stores/chat.ts 中继承此接口扩展 InlineDiff/ApplyStatus 等本地字段
 * - ai-service 后端在 SSE 事件中按此结构返回字段
 */
export interface BaseToolCall {
  /** 工具调用 ID(SSE tool-call-start 事件的 toolCallId) */
  id: string
  /** 工具名(如 read_file / edit_file / browser_navigate) */
  toolName: string
  /** 工具调用参数(JSON object) */
  args?: Record<string, unknown>
  /** 工具调用结果(tool-result 事件的 result 字段) */
  result?: unknown
  /** 工具调用状态:running=执行中 / success=成功 / error=失败 */
  status: 'running' | 'success' | 'error'
  /** 是否为错误结果(tool-result 事件的 isError 字段) */
  isError?: boolean
  /** 工具调用迭代轮次(LangGraph tool loop 的 iteration) */
  iteration?: number
  /** 后端 repeated: true 标记(同 tool_name + 同 args 已执行过,跳过实际调用) */
  repeated?: boolean
  /** 工具调用耗时(ms,tool-result 到达时计算) */
  durationMs?: number
  /**
   * MCP server 来源标识(2026-07-31 新增,用于 ToolCallCard 区分原生/MCP 工具)。
   * - builtin: AGENT_TOOLS 内置工具(read_file/edit_file 等)
   * - plugin: 用户从插件市场添加的 PLUGIN_ID_TO_TOOLS 工具
   * - mcp: 通过 MCP server 注册的外部工具(serverId/serverName 必填)
   */
  serverSource?: ToolCallSource
  /** MCP server ID(serverSource='mcp' 时必填,如 'context7' / 'filesystem' / 'github' 等) */
  serverId?: string
  /** MCP server 显示名(serverSource='mcp' 时必填,如 'Context7 MCP' / 'Filesystem MCP' 等) */
  serverName?: string
}
