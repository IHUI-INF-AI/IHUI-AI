/**
 * API 基础配置 — 后端 API 基础地址。
 *
 * 部署流程(Taro 4 环境变量):
 *  - 本地开发:未配置时回退默认值 `http://localhost:8802/api`,无需任何操作。
 *  - 真机预览 / 生产发布:必须在 `apps/miniapp-taro/.env.local`(或 `.env.production`)
 *    中配置 `TARO_APP_API_BASE`,否则小程序真机无法连接本地/内网服务。
 *    示例:`TARO_APP_API_BASE=https://api.example.com/api`(见同目录 .env.example)。
 *  - Taro CLI 自动加载 `.env` / `.env.local` / `.env.${mode}` 文件,并将 `TARO_APP_`
 *    前缀变量通过 DefinePlugin / Vite define 编译期内联(与 sso.ts 中
 *    `TARO_APP_WEB_URL` 同机制),无需在 config/index.ts 的 defineConstants 中额外配置。
 *  - 修改 env 后必须重新执行 `taro build` / `taro dev`,变量才会生效。
 *  - 微信/支付宝平台需把线上域名加入 request 合法域名(且必须为 https)。
 *
 * 供 @ihui/api-client 初始化(setBaseUrl)与 SSE 流式(chatStream 直连 fetch/Taro.request)使用。
 * 各端点请求统一走 @ihui/api-client 的 fetchApi(经 Taro transport 适配),
 * 仅 SSE 流式与展示场景需直接引用 BASE_URL。
 */

/** 本地开发默认 API 地址(未配置 TARO_APP_API_BASE 时回退) */
const DEFAULT_BASE_URL = 'http://localhost:8802/api'

/**
 * 读取 TARO_APP_API_BASE。
 * - 配置时编译期被内联为字面量,直接返回;
 * - 未配置时保留运行期访问。用 try/catch 兜底小程序运行时无 `process`
 *   全局对象的场景(避免 app.tsx 启动即崩溃,保证回退默认值)。
 */
function getEnvApiBase(): string | undefined {
  try {
    return process.env.TARO_APP_API_BASE?.trim() || undefined
  } catch {
    return undefined
  }
}

/**
 * 后端 API 基础地址(含 /api 后缀)。
 * 部署时通过 `TARO_APP_API_BASE` 环境变量覆盖(真机必须指向线上 HTTPS 地址);
 * 未配置时回退本地开发默认值。
 */
export const BASE_URL = getEnvApiBase() || DEFAULT_BASE_URL
