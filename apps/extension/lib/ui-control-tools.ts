// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 端内只负责注入本端族名:判断逻辑与关键词表在 @ihui/shared/utils/app-control-intent
import {
  createAppControlToolSelector,
  lastUserContent,
} from '@ihui/shared/utils/app-control-intent'
// 文件族工具的意图判据与关键词表同样只在共享层有一份(见该文件头注的安全面理由)
import { fileToolsFor } from '@ihui/shared/chat/file-tool-intent'

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
 * 聊天请求组装处调用:命中意图才带工具(普通问答保持流式首字延迟)。
 *
 * 两族并集,判据各在共享层有一份:
 *  - UI 操控族(`ext_ui_*` / `api_*`):本端注入族名,因为执行面在扩展自己的 DOM 上;
 *  - 文件族(`read_file` / `edit_file` …):服务端执行,**与端无关**,所以口径必须与 web 逐字同值
 *    —— 这张表决定"哪些话术会让模型拿到写类工具",分叉不会报错,只会表现成
 *    "同一句话在扩展里能改文件、在 web 里不能"(判据见 @ihui/shared/chat/file-tool-intent 头注)。
 * 此前扩展**完全不带**文件族,即"在扩展里让模型改文件"这条能力整条缺失(D113 的流中预览
 * 因此也无从触发 —— 发帧面 `_FILE_EDIT_PREVIEW_TOOLS` 只在工具真被调用时才产出帧)。
 */
export function toolsForChatRequest(content: string): string[] {
  // 2026-09-21 修复:typecheck 阻塞 —— lastUserContent 的入参是消息数组(见 miniapp-taro 同名文件),
  // 此处误传字符串;包装为单条 user 消息,语义不变(只看当前这一句)
  const ui = uiControlToolsFor(lastUserContent([{ role: 'user', content }]))
  const files = fileToolsFor(content)
  if (files.length === 0) return ui
  return [...new Set([...ui, ...files])]
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
