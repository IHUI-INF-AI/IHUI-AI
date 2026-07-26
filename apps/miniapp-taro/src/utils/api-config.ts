/**
 * API 基础配置 — 后端 API 基础地址。
 *
 * 供 @ihui/api-client 初始化(setBaseUrl)与 SSE 流式(chatStream 直连 fetch/Taro.request)使用。
 * 各端点请求统一走 @ihui/api-client 的 fetchApi(经 Taro transport 适配),
 * 仅 SSE 流式与展示场景需直接引用 BASE_URL。
 *
 * 多端差异:
 *  - H5:用相对路径 '/api',经 webpack-dev-server proxy 转发到后端 8802(规避浏览器 IPv6 解析问题)
 *  - 其他端(weapp/alipay/tt/swan):用绝对地址 'http://localhost:8802/api'(Taro.request 走原生网络层无 CORS)
 */
export const BASE_URL = process.env.TARO_ENV === 'h5' ? '/api' : 'http://localhost:8802/api'
