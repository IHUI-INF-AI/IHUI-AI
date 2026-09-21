// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 端内只负责注入本端族名:判断逻辑与关键词表在 @ihui/shared/utils/app-control-intent
import {
  createAppControlToolSelector,
  lastUserContent,
} from '@ihui/shared/utils/app-control-intent'

/**
 * 小程序端的 UI 操控工具族(2026-09-21 立)。
 *
 * 七个动作与 web / RN 同名同义:describe / navigate / read / invoke / click / fill / submit。
 * 真机是 WXML、没有同源 DOM 可枚举,所以 click/fill/submit 打在 ui-field-registry 登记的控件上
 * (组件挂载时交出 setValue / onPress / submit 才会在表里),没通道就如实失败。
 * (与 ai-service `ui_action_bridge._FAMILIES['taro']` 的注册面严格一致,漂移由双端测试互校)
 */
export const TARO_UI_CONTROL_TOOLS = [
  'taro_ui_describe',
  'taro_ui_read',
  'taro_ui_navigate',
  'taro_ui_invoke',
  'taro_ui_click',
  'taro_ui_fill',
  'taro_ui_submit',
] as const

/** 后端能力入口工具(服务端执行,与端无关,故与 web 端同名) */
export const API_CONTROL_TOOLS = ['api_endpoints_search', 'api_endpoint_call'] as const

/**
 * 「操控本站」意图 → 本次请求要带的工具名。
 *
 * 为什么必须由客户端决定:`apps/ai-service/app/routers/llm.py` 的 tool loop 入口是
 * `if req.agent_tools and chat_mode != "ask"` —— 不带 agentTools 就**根本不进工具链**,
 * 端侧桥接得再完整也是死代码。
 *
 * 只产出本端族名:把 `web_ui_*` 发给小程序只会换来 `TARGET_NOT_CONNECTED`,还白烧一轮上下文。
 */
export const uiControlToolsFor = createAppControlToolSelector({
  ui: TARO_UI_CONTROL_TOOLS,
  api: API_CONTROL_TOOLS,
})

/**
 * 请求体里 agentTools 的最终取值(2026-09-21)。
 *
 * 单独抽出来是因为它值得被断言:命中不了时必须返回 **undefined** 而不是 []。
 * `options.agentTools` 显式传入一律优先(调用方可能带自己的工具集,不得被预筛覆盖)。
 */
export function resolveAgentTools(
  explicit: readonly string[] | undefined,
  messages: ReadonlyArray<{ role: string; content: unknown }>,
): string[] | undefined {
  if (explicit) return [...explicit]
  const auto = uiControlToolsFor(lastUserContent(messages))
  return auto.length > 0 ? auto : undefined
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
