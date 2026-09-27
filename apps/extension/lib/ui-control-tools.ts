// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 端内只负责注入本端族名:判断逻辑与关键词表在 @ihui/shared/utils/app-control-intent
import {
  createAppControlToolSelector,
  lastUserContent,
} from '@ihui/shared/utils/app-control-intent'
// 文件族策略(`@ihui/shared/chat/file-tool-intent`)本端**刻意不消费**,理由见 toolsForChatRequest 头注
// (那里逐条记了三条实测;这条 import 一旦被"顺手补回来",就是给对话链塞进去两个必然执行失败的工具)。

/**
 * 扩展自有界面的 UI 操控工具族(2026-09-21 立,第五族 `ext_ui`)。
 *
 * 为什么要有第五族:`browser` category 已被"通过 content script 操控外部网页"占用,且 api 侧
 * `CATEGORY_ENDPOINT` 是 **1:1 择端** —— 扩展面板(chrome-extension:// 页面,content script 进不去)
 * 若也挂在 `browser` 上,同一 category 就出现两类执行面,指令会被随机一侧吃掉。故单开
 * `category='ext_ui'`(endpoint 仍是 `extension`),一个扩展注册一次、两族动作各走各的。
 *
 * 七个动作与 web 同形:sidepanel/popup 是**真实同源 DOM**,不需要像 RN / 小程序那样靠控件注册表
 * 交出写通道 —— 元素定位靠 `document` 查询,这也是它与另两端的根本差别。
 * (与 ai-service `ui_action_bridge._FAMILIES['extension']` 的注册面严格一致,漂移由
 *  `tests/test_ui_action_bridge.py::test_client_tool_lists_match_registered_surface` 双向钉住)
 */
export const EXT_UI_CONTROL_TOOLS = [
  'ext_ui_describe',
  'ext_ui_read',
  'ext_ui_navigate',
  'ext_ui_invoke',
  'ext_ui_click',
  'ext_ui_fill',
  'ext_ui_submit',
] as const

/** 后端能力入口工具(服务端执行,与端无关,故与 web / RN / 小程序端同名) */
export const API_CONTROL_TOOLS = ['api_endpoints_search', 'api_endpoint_call'] as const

/**
 * 「操控本站」意图 → 本次请求要带的工具名。
 *
 * 必须带:`apps/ai-service/app/routers/llm.py` 的 tool loop 入口是
 * `if req.agent_tools and chat_mode != "ask"` —— 不带就根本不进工具链,端侧桥写得再完整也是死代码。
 * 只产出本端族名:把 `web_ui_*` 发给扩展等于让模型去操控另一台设备。
 */
export const uiControlToolsFor = createAppControlToolSelector({
  ui: EXT_UI_CONTROL_TOOLS,
  api: API_CONTROL_TOOLS,
})

/**
 * 聊天请求组装处调用:命中"操控本站"意图才带工具(普通问答保持流式首字延迟)。
 *
 * **本端只带 UI 操控族,不带文件族** —— 这一格是 2026-09-27 逐条实测出来的,不是偏好:
 *  1. 扩展请求既不送 `workspacePath` 也不送 `workspaceContext`(本端 `StreamChatOptions`
 *     里两个字段都不存在),而 `apps/ai-service/app/routers/llm.py` 的委托分支条件是
 *     `if req.workspace_context and tool_name in _FS_DEPENDENT_TOOLS` —— 条件不成立,写类工具
 *     就不会像 web 那样交回浏览器执行,而是落到服务端 `_mcp.call_tool`。
 *  2. 服务端执行面里 `write_file` / `file_edit` 属 `mcp_server.py` 的 `_ADMIN_ONLY_TOOLS`,
 *     而对话链传下去的 `__user_role` 恒为 0(现读 `grep -n "__user_role" app/routers/llm.py`
 *     零命中;`mcp_server.py` 里那条注释原文即「对话链 user_role=0,入名单即断链」)
 *     ⇒ 带过去就是**每次必失败**,而失败之前用户已经看到一条流中 diff —— 界面在承诺一件不会发生的事。
 *  3. `edit_file` 在服务端注册表里根本不存在(注册名是 `file_edit`),它只在 web 的委托面里成立。
 *  4. 只读族也不能带:`read_file` 不在 admin 名单里,于是它会**在服务端工作区**上执行
 *     (`MCP_WORKSPACE_ROOTS`,缺省 `os.getcwd()`),等于把"每个扩展用户可读服务器文件"打开 ——
 *     这是越权面变更,不是能力补齐(AGENTS §5「已登录不等于可以动这条数据」)。
 *
 * 所以扩展要真有 D113 的流中预览,前置是**委托面**(`onToolDelegate` + 工作区句柄 +
 * `POST /llm/complete/stream/{session_id}/tool-result`)与审批位(`onToolApproval`)—— 那属新功能,
 * 须用户批准;两条此刻都记在 `scripts/data/sse-dispatch-coverage.json` 的 missing 里。
 * 端内的 `tool-delta` 客户端管线(归并层 `lib/tool-call-frames.ts` + 渲染位 + `onToolDelta` 注册)
 * **保留**:委托面一到位即生效,而"帧到本端却没人接"才是本仓最贵的那一型。
 */
export function toolsForChatRequest(content: string): string[] {
  // 2026-09-21 修复:typecheck 阻塞 —— lastUserContent 的入参是消息数组(见 miniapp-taro 同名文件),
  // 此处误传字符串;包装为单条 user 消息,语义不变(只看当前这一句)
  return uiControlToolsFor(lastUserContent([{ role: 'user', content }]))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
