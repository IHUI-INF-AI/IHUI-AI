// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useChatStore } from '@/stores/chat'

/** Agent 工具名列表(2026-07-22 立,AI 浏览器/电脑控制):
 *  传入 streamChat → api /ai/chat/stream → ai-service /api/llm/complete/stream
 *  ai-service 收到后从 mcp_server 加载完整 schema,走 tool loop(complete→tool_calls→execute→astream)
 *  2026-07-27 补齐 12 核心 MCP 工具(read_file/search_codebase/file_search 等),共 34 个 */
export const AGENT_TOOLS = [
  // ===== 核心 MCP 工具(2026-07-27 补齐,对标 AI 工作台 + Codex 工具集)=====
  // 之前只传 browser/computer 工具,LLM 看不到 read_file/search_codebase 等核心工具 schema,
  // 导致用户问"读一下 xxx 文件"时 LLM 无法调用 read_file,只能瞎编。
  // 现在补齐普通用户可用的核心工具(admin only 工具由后端 mcp_server 权限检查兜底)。
  'read_file',
  'search_codebase',
  'file_search',
  'analyze_code',
  'generate_test',
  'web_search',
  'search_web',
  'vision_analyze',
  'knowledge_lookup',
  // 2026-08-02 移除:dispatch_subagent 不应在默认 AGENT_TOOLS 中
  // LLM 对简单问题也会调用 subagent,导致 subagent 执行失败(空输出/超时)→ 前端显示"执行失败"
  // 改为按需启用:仅在用户明确选择"Agent 模式"时通过 mergeAgentTools 动态添加
  'summarize_artifacts',
  'proactive_suggestion',
  // 12 browser tools
  'browser_screenshot',
  'browser_click_element',
  'browser_type_text',
  'browser_scroll',
  'browser_navigate',
  'browser_extract_dom',
  'browser_wait_for_element',
  'browser_get_attribute',
  'browser_hover',
  'browser_select_option',
  'browser_switch_tab',
  'browser_close_tab',
  // 10 computer tools
  'computer_screenshot_screen',
  'computer_mouse_move',
  'computer_mouse_click',
  'computer_keyboard_type',
  'computer_mouse_scroll',
  'computer_keyboard_press',
  'computer_keyboard_hotkey',
  'computer_active_window',
  'computer_clipboard_get',
  'computer_clipboard_set',
] as const

/**
 * 插件市场 pluginId → ai-service MCP 工具名映射(2026-07-22 立)。
 *
 * 用户在插件市场点击"+"添加到对话后,selectedTools 存 pluginId。
 * sendMessage 时通过 mergeAgentTools() 把对应 MCP 工具名合并到 agentTools,
 * 传给后端 ai-service /api/llm/complete/stream。
 *
 * 仅 realIntegrated=true 的插件有真实 MCP 工具映射;'model' 接入类和
 * 仅 prompt 意图类无映射,不参与 mergeAgentTools(避免污染 AGENT_TOOLS)。
 */
export const PLUGIN_ID_TO_TOOLS: Record<string, readonly string[]> = {
  // 12 browser tools(所有浏览器类插件共用同一组 browser_* 工具)
  'playwright-mcp': [
    'browser_screenshot',
    'browser_click_element',
    'browser_type_text',
    'browser_scroll',
    'browser_navigate',
    'browser_extract_dom',
    'browser_wait_for_element',
    'browser_get_attribute',
    'browser_hover',
    'browser_select_option',
    'browser_switch_tab',
    'browser_close_tab',
  ],
  puppeteer: [
    'browser_screenshot',
    'browser_click_element',
    'browser_type_text',
    'browser_scroll',
    'browser_navigate',
    'browser_extract_dom',
    'browser_wait_for_element',
    'browser_get_attribute',
    'browser_hover',
    'browser_select_option',
    'browser_switch_tab',
    'browser_close_tab',
  ],
  'browser-use': [
    'browser_screenshot',
    'browser_click_element',
    'browser_type_text',
    'browser_scroll',
    'browser_navigate',
    'browser_extract_dom',
    'browser_wait_for_element',
    'browser_get_attribute',
    'browser_hover',
    'browser_select_option',
    'browser_switch_tab',
    'browser_close_tab',
  ],
  stagehand: [
    'browser_screenshot',
    'browser_click_element',
    'browser_type_text',
    'browser_scroll',
    'browser_navigate',
    'browser_extract_dom',
    'browser_wait_for_element',
    'browser_get_attribute',
    'browser_hover',
    'browser_select_option',
    'browser_switch_tab',
    'browser_close_tab',
  ],
  skyvern: [
    'browser_screenshot',
    'browser_click_element',
    'browser_type_text',
    'browser_scroll',
    'browser_navigate',
    'browser_extract_dom',
    'browser_wait_for_element',
    'browser_get_attribute',
    'browser_hover',
    'browser_select_option',
    'browser_switch_tab',
    'browser_close_tab',
  ],
  selenium: [
    'browser_screenshot',
    'browser_click_element',
    'browser_type_text',
    'browser_scroll',
    'browser_navigate',
    'browser_extract_dom',
    'browser_wait_for_element',
    'browser_get_attribute',
    'browser_hover',
    'browser_select_option',
    'browser_switch_tab',
    'browser_close_tab',
  ],
  playwright: [
    'browser_screenshot',
    'browser_click_element',
    'browser_type_text',
    'browser_scroll',
    'browser_navigate',
    'browser_extract_dom',
    'browser_wait_for_element',
    'browser_get_attribute',
    'browser_hover',
    'browser_select_option',
    'browser_switch_tab',
    'browser_close_tab',
  ],
  multion: [
    'browser_screenshot',
    'browser_click_element',
    'browser_type_text',
    'browser_scroll',
    'browser_navigate',
    'browser_extract_dom',
    'browser_wait_for_element',
    'browser_get_attribute',
    'browser_hover',
    'browser_select_option',
    'browser_switch_tab',
    'browser_close_tab',
  ],
  axiom: [
    'browser_screenshot',
    'browser_click_element',
    'browser_type_text',
    'browser_scroll',
    'browser_navigate',
    'browser_extract_dom',
    'browser_wait_for_element',
    'browser_get_attribute',
    'browser_hover',
    'browser_select_option',
    'browser_switch_tab',
    'browser_close_tab',
  ],
  brightdata: [
    'browser_screenshot',
    'browser_click_element',
    'browser_type_text',
    'browser_scroll',
    'browser_navigate',
    'browser_extract_dom',
    'browser_wait_for_element',
    'browser_get_attribute',
    'browser_hover',
    'browser_select_option',
    'browser_switch_tab',
    'browser_close_tab',
  ],
  browserbase: [
    'browser_screenshot',
    'browser_click_element',
    'browser_type_text',
    'browser_scroll',
    'browser_navigate',
    'browser_extract_dom',
    'browser_wait_for_element',
    'browser_get_attribute',
    'browser_hover',
    'browser_select_option',
    'browser_switch_tab',
    'browser_close_tab',
  ],
  browserless: [
    'browser_screenshot',
    'browser_click_element',
    'browser_type_text',
    'browser_scroll',
    'browser_navigate',
    'browser_extract_dom',
    'browser_wait_for_element',
    'browser_get_attribute',
    'browser_hover',
    'browser_select_option',
    'browser_switch_tab',
    'browser_close_tab',
  ],
  // 10 computer tools(所有电脑控制类插件共用同一组 computer_* 工具)
  'anthropic-computer-use': [
    'computer_screenshot_screen',
    'computer_mouse_move',
    'computer_mouse_click',
    'computer_keyboard_type',
    'computer_mouse_scroll',
    'computer_keyboard_press',
    'computer_keyboard_hotkey',
    'computer_active_window',
    'computer_clipboard_get',
    'computer_clipboard_set',
  ],
  'open-interpreter': [
    'computer_screenshot_screen',
    'computer_mouse_move',
    'computer_mouse_click',
    'computer_keyboard_type',
    'computer_mouse_scroll',
    'computer_keyboard_press',
    'computer_keyboard_hotkey',
    'computer_active_window',
    'computer_clipboard_get',
    'computer_clipboard_set',
  ],
  'auto-gpt': [
    'computer_screenshot_screen',
    'computer_mouse_move',
    'computer_mouse_click',
    'computer_keyboard_type',
    'computer_mouse_scroll',
    'computer_keyboard_press',
    'computer_keyboard_hotkey',
    'computer_active_window',
    'computer_clipboard_get',
    'computer_clipboard_set',
  ],
  babyagi: [
    'computer_screenshot_screen',
    'computer_mouse_move',
    'computer_mouse_click',
    'computer_keyboard_type',
    'computer_mouse_scroll',
    'computer_keyboard_press',
    'computer_keyboard_hotkey',
    'computer_active_window',
    'computer_clipboard_get',
    'computer_clipboard_set',
  ],
  'self-operating-computer': [
    'computer_screenshot_screen',
    'computer_mouse_move',
    'computer_mouse_click',
    'computer_keyboard_type',
    'computer_mouse_scroll',
    'computer_keyboard_press',
    'computer_keyboard_hotkey',
    'computer_active_window',
    'computer_clipboard_get',
    'computer_clipboard_set',
  ],
  'claude-desktop': [
    'computer_screenshot_screen',
    'computer_mouse_move',
    'computer_mouse_click',
    'computer_keyboard_type',
    'computer_mouse_scroll',
    'computer_keyboard_press',
    'computer_keyboard_hotkey',
    'computer_active_window',
    'computer_clipboard_get',
    'computer_clipboard_set',
  ],
  // 其他真集成插件:filesystem / postgres / search / code-exec / github / langgraph
  'filesystem-mcp': ['read_file', 'write_file'],
  'postgres-mcp': ['db_query'],
  duckduckgo: ['search_web'],
  'code-interpreter-mcp': ['run_command'],
  e2b: ['run_command'],
  'github-mcp': ['run_command'],
  langgraph: ['run_command'],
} as const

/**
 * 合并默认 AGENT_TOOLS + 用户已选插件对应的 MCP 工具(2026-07-22 立)。
 *
 * 调用时机:sendMessage / sendAnswer 构造 streamChat 参数前。
 * 去重保证工具名唯一,ai-service 收到后从 mcp_server 加载完整 schema。
 *
 * 阶段 2(2026-08-02 立):恢复 fs 类工具(read_file/search_codebase/file_edit 等)。
 * 阶段 1 在 web 非 Tauri 环境下移除这些工具(因 ai-service 在远程服务器无法访问本地文件);
 * 阶段 2 实现"前端工具执行代理"后,LLM 调用 fs 工具时 ai-service 通过 SSE tool-delegate
 * 事件委托前端用 FileSystemDirectoryHandle 执行,通过 POST API 回传结果,恢复 tool loop。
 *
 * 2026-08-29 修复(前端"一次性全显"根因):此前无条件返回 34 个 AGENT_TOOLS,
 * 导致普通问答请求也携带 agentTools → 后端命中 `if req.agent_tools:` 走 tool loop 分支,
 * 第一轮用非流式 complete() 等完整回复,LLM 无工具调用时把整个 content 一次性 yield,
 * 前端收到单个超大 chunk,内容"一下全出"。
 * 现在仅当用户显式启用插件工具(selectedTools 非空)才返回工具列表;普通问答返回空数组,
 * 调用方不携带 agentTools 字段 → 后端直接走流式 astream()(逐 token)输出,恢复打字机效果。
 * 带工具场景仍携带 AGENT_TOOLS + 插件工具,后端 tool loop 已兜底流式,不影响打字机。
 */
export function mergeAgentTools(): string[] {
  const selected = useChatStore.getState().selectedTools
  // 2026-08-29:未显式启用任何插件工具(普通问答)时不携带工具,返回空数组
  if (selected.length === 0) return []
  const extra = selected.flatMap((id) => PLUGIN_ID_TO_TOOLS[id] ?? [])
  return [...new Set([...AGENT_TOOLS, ...extra])]
}

/**
 * 按消息内容检测教育管理意图,返回需要条件携带的 edu 工具名(2026-09-19 立)。
 *
 * 与 ai-service 侧 conversation._EDU_INTENT_PATTERNS 预路由同源(双保险):
 * 前端在用户消息含教育业务关键词(催费/欠费/学费/缴费/退费/账单等)时,
 * 把对应 edu_* 工具名合并进 agentTools;普通问答返回空数组不携带,
 * 保住"无工具 → 打字机逐 token"的流式效果(2026-08-29 先例)。
 *
 * 策略:读操作关键词即触发;写操作要求出现明确动作词(登记/催费/批准等),
 * 且顺带携带关联读工具(如催费前常需先查欠费名单拿 enrollmentId)。
 * LLM 侧另有 _EDU_RENDER_PROMPT 强制写操作二次确认,api 侧 RBAC 兜底权限。
 */
export function eduToolsFor(content: string): string[] {
  if (!content) return []
  const text = content.toLowerCase()
  const has = (...kws: string[]) => kws.some((kw) => text.includes(kw))
  const out = new Set<string>()
  // ---- 读操作 ----
  if (has('学员', '学生名单', '学生列表', '花名册', '在读学生', 'students'))
    out.add('edu_list_students')
  if (has('欠费', '欠款', '未缴费', '欠缴', '催缴名单', 'arrears'))
    out.add('edu_list_arrears')
  if (has('催费记录', '催缴记录', '提醒记录', '催费历史'))
    out.add('edu_list_fee_reminders')
  if (has('缴费记录', '收款记录', '支付记录', 'payment record'))
    out.add('edu_list_payment_records')
  if (has('缴费汇总', '收款汇总', '缴费统计', '学费统计', '收入统计', '营收'))
    out.add('edu_payment_summary')
  if (has('学费', '收费标准', 'tuition')) out.add('edu_list_tuition_fees')
  if (has('我的账单', '我的缴费', 'my bills')) out.add('edu_my_bills')
  // ---- 退费类:读记录 + 写动词区分 ----
  if (has('退费', '退款', 'refund')) {
    out.add('edu_list_refunds')
    out.add('edu_create_refund')
  }
  if (has('批准退费', '同意退费', '通过退费', '审批退费')) out.add('edu_approve_refund')
  if (has('驳回退费', '拒绝退费', '否决退费')) out.add('edu_reject_refund')
  // ---- 催费类:写动词触发,顺带带欠费名单(查 enrollmentId 用)----
  if (has('催费', '催缴', '提醒缴费', '发提醒')) {
    out.add('edu_send_fee_reminder')
    out.add('edu_list_arrears')
  }
  if (has('批量催费', '批量催缴', '一键催费', '全部催费', '批量提醒'))
    out.add('edu_send_fee_reminder_batch')
  // ---- 缴费登记 ----
  if (has('登记缴费', '缴费登记', '登记收款', '录入缴费', '记一笔缴费'))
    out.add('edu_create_payment_record')
  return [...out]
}

/** 浏览器类工具:命中即自动在右侧 WorkPanel 打开 URL(2026-07-22 立,P2 联动) */
export const BROWSER_TOOL_NAMES = new Set([
  'browser_navigate',
  'browser_click',
  'browser_extract',
  'browser_screenshot',
  'web_search',
  'fetch-url',
  'fetch_url',
  'web_fetch',
])

/** 从 tool args/result 提取 URL(与 tool-call-card.tsx extractUrl 逻辑一致) */
export function extractToolUrl(args?: Record<string, unknown>, result?: unknown): string | null {
  if (args) {
    const fromArgs =
      (args.url as string) ||
      (args.href as string) ||
      (args.link as string) ||
      (args.target as string)
    if (typeof fromArgs === 'string' && /^https?:\/\//i.test(fromArgs)) return fromArgs
  }
  if (typeof result === 'string') {
    const match = result.match(/https?:\/\/[^\s"'<>]+/i)
    if (match) return match[0]
  } else if (result && typeof result === 'object') {
    const obj = result as Record<string, unknown>
    const fromResult = (obj.url as string) || (obj.href as string) || (obj.link as string)
    if (typeof fromResult === 'string' && /^https?:\/\//i.test(fromResult)) return fromResult
  }
  if (Array.isArray(result)) {
    const first = result.find((r) => {
      if (typeof r === 'object' && r !== null) {
        const u = (r as Record<string, unknown>).url
        return typeof u === 'string' && /^https?:\/\//i.test(u)
      }
      return false
    })
    if (first) return (first as Record<string, unknown>).url as string
  }
  return null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
