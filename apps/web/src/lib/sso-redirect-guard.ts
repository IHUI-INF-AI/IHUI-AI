// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SSO 回跳守卫探测(2026-09-22 立)。
 *
 * 背景:/sso/login、/sso/register 的「授权并跳转」与右上 X 都跳向同一个 redirect
 * 目标。当该目标是受登录守卫保护的同源路径(/admin/*、/edu/edu-management/*)时,
 * 守卫(web 端 proxy.ts verifyAccessTokenEdge / 生产 nginx $cookie_auth_token)
 * 会把请求 307 打回 /sso/login?redirect=… —— 界面看起来"原地不动",用户感知即
 * "授权并跳转 / 关闭按钮都不好使"(桌面端 WebView2 历史记录实测该 URL 递归 4 层)。
 *
 * 根因:cookie 中的 auth_token 是 access JWT(15 分钟过期),cookie 自身 30 天;
 * 桌面端薄壳窗口(直接加载 https://aizhs.top)的登录态靠持久化 token + Bearer 维持,
 * API 全通,但 cookie 内 JWT 早已过期 → 守卫不放行。
 *
 * 对策:跳转前探测守卫是否放行;被拦则静默续期一次(后端 /api/auth/refresh 会
 * setAuthCookies 续种 cookie)后复测。探测失败一律按放行处理,绝不误拦正常跳转。
 *
 * 平台属性:依赖浏览器 fetch 与同源重定向语义,不下沉 packages/shared。
 */
import { refreshAccessTokenOnce } from '@ihui/api-client'

/** 目标是否为"同源相对路径"跳转(受本站登录守卫约束)。跨源绝对地址与自定义协议深链(ihui://…)不受约束。 */
export function isSameOriginRelative(target: string): boolean {
  return target.startsWith('/') && !target.startsWith('//')
}

/**
 * 静默续期一次,让后端 setAuthCookies 重新下发 httpOnly auth_token cookie。
 * 桌面端 refreshToken 取自 Tauri store(auth.json)走 body 模式,浏览器端靠
 * httpOnly refresh_token cookie 自动附带 —— 两条链路都已在 lib/api.ts 收口。
 * 失败静默:是否放行由调用方复测决定,避免误判。
 */
export async function syncAuthCookie(): Promise<void> {
  try {
    await refreshAccessTokenOnce()
  } catch {
    /* 续期失败静默:目标可能本就无需守卫放行 */
  }
}

/**
 * 探测同源受保护目标是否会被登录守卫 307 打回 /sso/login。
 *
 * 用 `redirect: 'manual'` —— 同源重定向在浏览器中返回 type === 'opaqueredirect'
 * (status 0),可据此在不跟随跳转的前提下判定守卫是否放行。
 * 任何异常一律按"放行"处理:探测本身绝不能误拦正常跳转。
 */
export async function isBlockedByAuthGuard(target: string): Promise<boolean> {
  try {
    const res = await fetch(target, {
      method: 'HEAD',
      redirect: 'manual',
      credentials: 'include',
    })
    return res.type === 'opaqueredirect'
  } catch {
    return false
  }
}

/**
 * 跳转前确保目标能被守卫放行:先探测,被拦则续种 cookie 后复测。
 * @returns true 可跳转;false 仍被拦(调用方据此给出明确结果,不再静默回到本页)
 */
export async function ensureSsoRedirectAllowed(target: string): Promise<boolean> {
  if (!isSameOriginRelative(target)) return true
  if (!(await isBlockedByAuthGuard(target))) return true
  await syncAuthCookie()
  return !(await isBlockedByAuthGuard(target))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
