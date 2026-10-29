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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
