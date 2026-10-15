// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * Desktop deep-link → SSO 闭环桥接(2026-08-01 立,AGENTS.md §9 多端同步)
 *
 * 流程:
 * 1. Desktop 启动 → 用户在外部浏览器完成 SSO 登录
 * 2. 浏览器通过 `ihui://sso?sso_code=xxx` deep-link 回调 desktop
 * 3. Rust 端 on_deeplink 捕获 → emit "desktop-deep-link" 事件给 webview
 * 4. 本模块 handleDesktopDeepLink(url) 解析 sso_code,调 /sso/exchange 换 token
 * 5. 写入 useAuthStore,完成 desktop SSO 登录
 *
 * 共享逻辑:复用 @ihui/shared auth/sso-core.ts 的 exchangeSsoCode + extractSsoCode
 * 平台特有:仅 desktop(Tauri webview)调用,浏览器端 useDesktopDeepLink hook 不注册
 */

import { exchangeSsoCode, extractSsoCode, SSO_CLIENT_IDS } from '@ihui/shared'
import { useAuthStore } from '@/stores/auth'
import { resolveApiBaseUrl } from '@/lib/api-base-url'
import { closeEmbeddedBrowser } from '@/lib/tauri-bridge'
import type { AuthUser } from '@ihui/api-client'

const DESKTOP_CLIENT_ID = SSO_CLIENT_IDS.DESKTOP

/**
 * 模块级去重缓存:记录最近一次处理的 sso_code,防止 OS 重复派发 deep-link
 * 导致重复 exchange 请求(2026-08-01 P1-1 inbound 防护加固)。
 */
let lastProcessedCode: string | null = null

/**
 * 本次"在浏览器中登录"打开的是不是**项目内嵌浏览器窗**(布尔即可,不再需要 CDP 端口)。
 *
 * 2026-10-13 立:桌面端按钮改走外部浏览器后,登录闭环的最后一环是把那个窗关掉
 * (用户要求"已登录直接获取并关闭浏览器")。会话由 LoginDialog 在打开窗口时记住,
 * 本模块在换 token 成功后消费它 —— 放在换 token 侧而不是打开侧,是因为**只有换成功**
 * 才该关窗:失败时窗留着,用户可以就地重试。
 * 2026-10-16 改:窗口形态统一为项目内嵌浏览器(embedded_browser),关窗只认"有没有
 * 开过内嵌窗"这一件事,不需要端口与前缀;走系统默认浏览器登录的路径不置位 ⇒ 无从关起,
 * 静默跳过。
 */
let pendingSsoChrome = false

/** 记住刚开的 SSO 内嵌浏览器窗,供登录成功后关闭(2026-10-16 改内嵌形态)。 */
export function rememberSsoEmbeddedWindow(): void {
  pendingSsoChrome = true
}

/** 关掉记住的 SSO 内嵌浏览器窗;失败(窗口已经被用户关掉)只记一行 warn,不冒泡。 */
async function closeRememberedSsoChrome(): Promise<void> {
  if (!pendingSsoChrome) return
  // 先清账再关:重复派发的 deep-link 走到这里不该再开第二次关窗请求。
  pendingSsoChrome = false
  try {
    await closeEmbeddedBrowser()
  } catch (e) {
    console.warn('[embedded-browser] 关闭 SSO 登录窗失败:', e)
  }
}

/**
 * 处理 desktop deep-link URL,完成 SSO 闭环。
 *
 * @param url deep-link URL,格式 `ihui://sso?sso_code=xxx` 或 `ihui://callback?sso_code=xxx`
 * @returns 成功返回 true;失败返回 false(无 sso_code / exchange 失败)
 */
export async function handleDesktopDeepLink(url: string): Promise<boolean> {
  const code = extractSsoCode(url)
  if (!code) return false

  // 去重:OS 可能重复派发同一 deep-link,跳过已处理的 sso_code(2026-08-01 P1-1)。
  // 但重复派发同样意味着"浏览器那一侧已经交付过了"——照样把窗收掉(会话已清账,幂等)。
  if (code === lastProcessedCode) {
    await closeRememberedSsoChrome()
    return true
  }

  const apiBase = resolveApiBaseUrl()
  const tokenData = await exchangeSsoCode(apiBase, code, DESKTOP_CLIENT_ID)
  if (!tokenData) return false

  const { setToken, setUser } = useAuthStore.getState()
  setToken(tokenData.accessToken, tokenData.refreshToken)
  const user: AuthUser = {
    id: tokenData.user.id,
    nickname: tokenData.user.nickname,
    avatar: tokenData.user.avatar,
  }
  setUser(user)
  lastProcessedCode = code
  // 登录态已落地,收尾:关掉 Chrome --app 的 SSO 登录窗(失败只 warn,不影响登录结果)。
  await closeRememberedSsoChrome()
  return true
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
