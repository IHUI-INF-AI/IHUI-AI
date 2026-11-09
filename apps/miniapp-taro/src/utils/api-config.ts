// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * API 基础配置 — 后端 API 基础地址。
 *
 * 部署流程(Taro 4 环境变量):
 *  - 本地 H5 开发:走 devServer proxy 相对路径 /api,无需额外操作。
 *  - 真机预览 / 生产发布:必须在 `apps/miniapp-taro/.env.local`(或 `.env.production`)
 *    中配置 `TARO_APP_API_BASE_URL`,否则小程序真机无法连接本地/内网服务。
 *    示例:`TARO_APP_API_BASE_URL=https://api.example.com/api`(见同目录 .env.example)。
 *  - BUG-41①:小程序生产缺该键 ⇒ 启动链 assertApiBaseConfigured() 直接失败并上报,
 *    绝不静默回落 http://localhost:8802/api(详见下方与 .env.example 的 BUG-68 说明)。
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

/**
 * BUG-41① / BUG-68:配置键与缺省行为。
 * - 跨端统一逻辑键 = API_BASE_URL;本端因 Taro 约定须带 TARO_APP_ 前缀 ⇒
 *   `TARO_APP_API_BASE_URL`(web 侧为 NEXT_PUBLIC_API_BASE_URL,见 apps/web/.env.example)。
 * - H5:走 devServer proxy 的相对路径 /api(同源转发到后端 8802),无需额外配置。
 * - 小程序(weapp/alipay):**生产必须显式配置 TARO_APP_API_BASE_URL**。
 *   缺配置时 BASE_URL 取空串(绝不静默回落 http://localhost:8802/api —— 手机上没有
 *   这个 localhost,旧行为就是构建零告警、运行时全接口失败、只表现白屏),
 *   并由 assertApiBaseConfigured() 在启动链里硬失败 + 上报白屏根因。
 * - 注意:process.env.TARO_ENV 由 Taro DefinePlugin 编译期替换为 'h5' 字面量,
 *   TARO_APP_* 仅在有 .env 文件时被内联,缺失时仍是运行时引用(小程序无 process 全局);
 *   故 env 读取统一走下方 try/catch 兜底。
 */
const IS_H5 = process.env.TARO_ENV === 'h5'

/**
 * BUG-68:漏配时的**兜底生产域名**(含 /api 后缀,与 BASE_URL 约定一致)。
 * 仅作最后一搏的默认值,绝非常态路径 —— 部署脚本按 TARO_APP_API_BASE_URL 校验其存在,
 * 正常生产构建该键必被显式配置。此处兜底用于:非启动链的代码路径(或未来重构绕过
 * assertApiBaseConfigured 时)不至于落到空串 base(空串会让整族请求打到相对路径而全失败)。
 * 注意:这不是 localhost,不会触发 BUG-41① 担忧的"手机上 localhost 不存在"白屏;
 * 启动链仍由 assertApiBaseConfigured() 硬失败 + 上报(见下),本兜底只是防御纵深。
 */
const PROD_API_BASE_URL = 'https://api.aizhs.top/api'

/** 读取 TARO_APP_API_BASE_URL(编译期内联为字面量;缺失时运行期访问,try/catch 兜底无 process 场景)。 */
function getEnvApiBase(): string | undefined {
  try {
    return process.env.TARO_APP_API_BASE_URL?.trim() || undefined
  } catch {
    return undefined
  }
}

const configuredApiBase = getEnvApiBase()

/**
 * 后端 API 基础地址(含 /api 后缀)。
 * H5 保持相对 /api;小程序生产未配置 ⇒ 兜底生产域名 PROD_API_BASE_URL(绝不为空串,
 * 也绝不静默回落 http://localhost:8802/api —— 手机上没有这个 localhost)。启动链仍由
 * assertApiBaseConfigured() 硬失败 + 上报白屏根因,本兜底只在绕过启动链的非启动路径上兜底。
 */
export const BASE_URL = configuredApiBase ?? (IS_H5 ? '/api' : PROD_API_BASE_URL)

/**
 * 启动链调用(BUG-41①):小程序生产缺配置直接抛错,绝不静默回落 localhost。
 * 由 app.tsx 在崩溃上报初始化之后调用,错误会被捕获并上报(/api/crash-reports)。
 * H5 走 devServer proxy / 同源,不需显式配置。
 */
export function assertApiBaseConfigured(): void {
  if (IS_H5) return
  if (configuredApiBase === undefined) {
    throw new Error(
      '[BUG-41] 生产构建缺少 TARO_APP_API_BASE_URL:小程序真机必须在 .env.production 配置线上 HTTPS 地址,' +
        '禁止静默回落 http://localhost:8802/api',
    )
  }
  if (getEnvAiServiceBase() === undefined) {
    throw new Error(
      '[BUG-41] 生产构建缺少 TARO_APP_AI_SERVICE_BASE:禁止静默回落 http://localhost:8803',
    )
  }
}

/**
 * ai-service 基础地址(语音转写 STT、AI 能力等)。
 *
 * 与 BASE_URL 同一套机制:真机预览 / 生产发布必须在 `apps/miniapp-taro/.env.local`
 * (或 .env.production)配置 `TARO_APP_AI_SERVICE_BASE`,否则小程序真机连不上
 * 本机 8803 —— **手机上没有 localhost:8803,语音输入必然转写失败**。
 * BUG-41①:小程序缺配置不再回落 http://localhost:8803,改由 assertApiBaseConfigured() 硬失败;
 * H5 本地开发沿用本机 8803(devServer 直连)。
 *
 * 示例:
 *   真机调试(手机与电脑同一局域网):TARO_APP_AI_SERVICE_BASE=http://192.168.1.8:8803
 *   生产发布(需公网端点已在 ai-service-edge 白名单登记):TARO_APP_AI_SERVICE_BASE=https://aizhs.top/ai-service
 */
function getEnvAiServiceBase(): string | undefined {
  try {
    return process.env.TARO_APP_AI_SERVICE_BASE?.trim() || undefined
  } catch {
    return undefined
  }
}

export const AI_SERVICE_BASE_URL = getEnvAiServiceBase() ?? (IS_H5 ? 'http://localhost:8803' : '')
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
