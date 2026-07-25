/**
 * API 基础配置 — 后端 API 基础地址。
 *
 * 供 @ihui/api-client 初始化(setBaseUrl)与 SSE 流式(chatStream 直连 fetch/Taro.request)使用。
 * 各端点请求统一走 @ihui/api-client 的 fetchApi(经 Taro transport 适配),
 * 仅 SSE 流式与展示场景需直接引用 BASE_URL。
 */
export const BASE_URL = 'http://localhost:8801/api'
