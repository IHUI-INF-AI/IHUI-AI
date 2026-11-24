// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * CORS / WebSocket Origin 放行决策(单一真源,fail-closed)。
 *
 * 该决策被 `server.ts` 的 CORS `origin` 回调与 WebSocket `verifyClient` 共用,
 * 抽出为纯函数是为了:① 两处行为一致、不漂移;② 可被单测钉死 fail-closed 契约,
 * 防止未来有人把 chrome-extension 误放行为改回 `extAllowed = true` 导致静默回退。
 *
 * 安全契约:
 * - 缺失 Origin(非浏览器 / curl / 服务端客户端)一律放行:这些场景无凭据跨站风险,
 *   真正的安全靠 JWT 鉴权兜底,而非 Origin 校验。
 * - 显式白名单(config.CORS_ORIGIN + 固定 desktop / mobile-cap origin)命中即放行。
 * - chrome-extension:// **默认整体拒绝**(fail-closed):任何已安装扩展都能产生该 Origin,
 *   前缀放行等于给全部扩展发「全站带凭据通行证」。已配置 IHUI_EXTENSION_IDS 时
 *   按精确 ID 放行;未配置时一律拒绝,并标记 `unconfiguredExtension` 供调用方记 warn
 *   (便于运维区分「扩展端突然调不通 = 配置缺失」而非代码 bug)。
 */
export interface OriginAllowanceInput {
  /** 请求 Origin 头;非浏览器客户端可能为 undefined / 空 */
  origin: string | undefined
  /** 已 lowercased 并过滤空串的 config.CORS_ORIGIN 条目 */
  allowedOrigins: string[]
  /** 固定放行的桌面端 origin(DESKTOP_ORIGINS) */
  desktopOrigins: string[]
  /** 固定放行的移动壳 origin(MOBILE_CAP_ORIGINS) */
  mobileCapOrigins: string[]
  /** 已 lowercased 并过滤空串的 config.EXTENSION_IDS 条目(约定为完整 `chrome-extension://<id>` origin) */
  extensionIds: string[]
}

export interface OriginAllowanceResult {
  /** 是否放行该 Origin */
  allow: boolean
  /** 是否为「未配置 IHUI_EXTENSION_IDS 而被拒绝的 chrome-extension」(供调用方记 warn) */
  unconfiguredExtension: boolean
}

export function evaluateOriginAllowance(input: OriginAllowanceInput): OriginAllowanceResult {
  const { origin, allowedOrigins, desktopOrigins, mobileCapOrigins, extensionIds } = input

  // 非浏览器客户端(服务端 / curl / 部分 WS 客户端)无 Origin:放行,凭据靠 JWT 鉴权。
  if (!origin) return { allow: true, unconfiguredExtension: false }

  const o = origin.toLowerCase()

  // 显式白名单(desktop / mobile-cap 固定 origin 一并归入)命中即放行。
  if (allowedOrigins.includes(o) || desktopOrigins.includes(o) || mobileCapOrigins.includes(o)) {
    return { allow: true, unconfiguredExtension: false }
  }

  // chrome-extension:// 走精确白名单;未配置 IHUI_EXTENSION_IDS 时 fail-closed 拒绝。
  if (o.startsWith('chrome-extension://')) {
    if (extensionIds.length > 0) {
      return { allow: extensionIds.includes(o), unconfiguredExtension: false }
    }
    return { allow: false, unconfiguredExtension: true }
  }

  // 其余未知 Origin 一律拒绝。
  return { allow: false, unconfiguredExtension: false }
}

/**
 * 固定放行的桌面端 / 移动壳 origin(单一真源,与下方 evaluateOriginAllowance 同文件,
 * 供 server.ts 的 CORS 回调 / WS verifyClient / SSE 回显三处共用,不漂移)。
 * 只有对应客户端自身 webview 页面能产生这些 Origin,恶意网页无法伪造。
 */
export const DESKTOP_ORIGINS = ['http://tauri.localhost', 'tauri://localhost']
export const MOBILE_CAP_ORIGINS = ['https://localhost', 'capacitor://localhost']

/**
 * 从 config 原始串派生 evaluateOriginAllowance 的输入(单一真源,避免 cors 回调 /
 * WS verifyClient / SSE 回显三处各自 split 漂移,§0.6)。
 */
export function deriveCorsAllowanceInputs(
  corsOrigin: string,
  extensionIds: string,
): { allowedOrigins: string[]; extensionIds: string[] } {
  return {
    allowedOrigins: corsOrigin
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
    extensionIds: extensionIds
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  }
}

/**
 * 构造 SSE 响应需要的 CORS 头(fail-closed:过 evaluateOriginAllowance 才回显)。
 *
 * 为什么需要它:ai-chat-stream / chat-resume 在 reply.hijack() 后绕过 @fastify/cors 插件,
 * 必须手动回显 Origin + Allow-Credentials 才能让浏览器跨域读取 SSE 流。旧实现把请求里的
 * origin 原样回显,等于对任何站点发全站带凭据通行证(CORS 凭证绕过,CWE-346 / 对应 R10 收口)。
 * 现与 cors 插件 / WS verifyClient 共用同一判据:未命中白名单的 origin 一律不回显头,
 * 浏览器自然阻止跨域读取。缺失 origin(非浏览器客户端)返回空对象(无需 CORS 头)。
 */
export function buildSseCorsHeaders(
  origin: string | undefined,
  corsOrigin: string,
  extensionIds: string,
): Record<string, string> {
  if (!origin) return {}
  const { allowedOrigins, extensionIds: ext } = deriveCorsAllowanceInputs(corsOrigin, extensionIds)
  const r = evaluateOriginAllowance({
    origin,
    allowedOrigins,
    desktopOrigins: DESKTOP_ORIGINS,
    mobileCapOrigins: MOBILE_CAP_ORIGINS,
    extensionIds: ext,
  })
  if (!r.allow) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
