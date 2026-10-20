// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 持久「登出标记」的唯一读写口(web 端)。
 *
 * 判据本身住在跨端共享层 `@ihui/shared/auth/auto-login-policy`(登出标记优先);
 * 这里只负责把它落到 web 这一端的存储(localStorage)并处理 SSR。
 * key 名与 RN / 小程序同值 —— 由共享层导出,端内不得再抄一份字面量。
 *
 * 为什么标记必须**活得比凭据久**:web 的登出清的是内存 token 与 httpOnly cookie
 * (`stores/auth.ts` logout → `setAuthCookie(null)` 是空操作,真正清 cookie 靠后端),
 * 而 30 天 refresh cookie 只在后端拿到 refreshToken 才会被吊销 ——
 * `refreshToken` 不落 localStorage(2026-07-21 安全审计结论),页面刷新后内存里就是空的,
 * 此时按 `refreshToken ?? vaultToken` 取到的 rt 为 null ⇒ **不调 `/auth/logout`** ⇒
 * 服务端那份 httpOnly refresh cookie 仍然有效。下一次冷启动 `useAuthBootstrap` 无参调
 * `/auth/refresh` 就会成功,把刚点过「退出登录」的用户静默登回去。
 * 客户端结构上删不掉 httpOnly cookie,所以用这条持久标记把"这一轮会话已被用户结束"
 * 这件事记住,直到下一次真正的登录写入凭据为止。
 *
 * 失效方向(刻意与 RN 同形):
 * - 写标记排在清凭据**之前**(见 `stores/auth.ts` logout),两步之间页面被关的后果是
 *   "标记在、凭据可能还在"⇒ 静默刷新被抑制(保守,符合"登出后不得自动登回")。
 * - 读失败时**不**抑制并喊出来:抑制自动登录是改变用户可见行为的动作,
 *   不能由一次存储抖动触发(本仓"不得静默降级"禁令)。
 * - localStorage 里只落一个布尔事实(值为会话结束时间戳,只为可诊断),不含任何凭据 ——
 *   与"token/refreshToken 一律不落 localStorage"的审计结论不冲突。
 */

import { SESSION_LOGGED_OUT_STORAGE_KEY } from '@ihui/shared/auth/auto-login-policy'

/**
 * 进程内镜像:写盘失败(隐私模式 / 配额)时,本标签页内的判定仍以内存为准。
 * `null` = 本进程还没判过,下一次读去问 localStorage。
 */
let loggedOutMirror: boolean | null = null

function hasStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

/**
 * 会话被**用户显式结束**(点「退出登录」/ 账号注销)。
 *
 * 会话被动失效(refresh 被服务端拒绝)一律**不得**调用本函数 —— 那条路走
 * `stores/auth.ts` 的 `expireSession()`:只清凭据、保留"记住密码 + 自动登录",
 * 让下一次冷启动能用账密把会话重新建立起来(2026-10-20)。
 */
export function markSessionLoggedOut(): void {
  loggedOutMirror = true
  if (!hasStorage()) return
  try {
    window.localStorage.setItem(SESSION_LOGGED_OUT_STORAGE_KEY, String(Date.now()))
  } catch (e) {
    // 只在本标签页内抑制住了,冷启动重启后标记可能没了 ⇒ 必须喊出来,不得静默
    console.warn(
      `[web-auth] failed to persist logout marker (in-memory bit is set, so auto-login stays ` +
        `suppressed for this tab; a cold restart may lose it): ` +
        `${e instanceof Error ? e.message : 'unknown error'}`,
    )
  }
}

/** 一次真正的登录写入凭据 ⇒ 标记作废(否则用户下次正常登录又被判成"刚登出")。 */
export function clearSessionLoggedOutMarker(): void {
  loggedOutMirror = false
  if (!hasStorage()) return
  try {
    window.localStorage.removeItem(SESSION_LOGGED_OUT_STORAGE_KEY)
  } catch (e) {
    console.warn(
      `[web-auth] failed to clear logout marker (new session is active in memory, but a cold ` +
        `restart may still suppress auto-login): ${e instanceof Error ? e.message : 'unknown error'}`,
    )
  }
}

/** 本机是否处于"已显式登出"状态(只由用户主动登出写入)。判据只看存在性,不解析值。 */
export function isSessionLoggedOut(): boolean {
  if (loggedOutMirror !== null) return loggedOutMirror
  if (!hasStorage()) return false
  try {
    loggedOutMirror = window.localStorage.getItem(SESSION_LOGGED_OUT_STORAGE_KEY) !== null
  } catch (e) {
    console.warn(
      `[web-auth] failed to read logout marker, treating session as NOT logged out ` +
        `(auto-login stays enabled): ${e instanceof Error ? e.message : 'unknown error'}`,
    )
    loggedOutMirror = false
  }
  return loggedOutMirror
}

/**
 * 测试专用:把进程内镜像清回"未判过",让每个用例都从盘上重新取证。
 * 生产代码一律不调它(镜像是刻意的跨调用状态,不是缓存脏值)。
 */
export function __resetSessionLoggedOutMirrorForTest(): void {
  loggedOutMirror = null
}

/**
 * 「这台浏览器曾建立过会话」的持久事实(2026-10-20)。
 *
 * 为什么必须有它:web 的 `auth_token` / `refresh_token` 都是 **httpOnly**,
 * `document.cookie` 里根本看不见;而 `ihui-auth` 只持久化 `isAuthenticated`,
 * 一次被动失效(`expireSession`)就会把它落成 false。于是冷启动时
 * 「带着 cookie 但 JS 看不到」与「什么都没带」在客户端**同形** —— 原先
 * `use-auth-bootstrap` 的闸门把有 cookie 的老用户也判成匿名,连 `/auth/refresh`
 * 都不发,用户每次冷启动都得手点登录(这正是"记住账号/自动登录"失效的最后一环)。
 *
 * 语义刻意与登出标记分开:
 * - 只在**拿到过有效 token** 时写(登录成功 / 刷新成功);
 * - 显式登出**不清**(登出由 `canSilentlyReLogin` 的标记先拦,不清才能让
 *   "登出后又正常登录"这条线不受影响);
 * - 被动失效确认是 401/403 后由 `expireSession()` 清掉,避免死 cookie
 *   在每次冷启动空转一次 `/auth/refresh`。
 */
export const SESSION_ESTABLISHED_STORAGE_KEY = 'ihui-session-established'

let establishedMirror: boolean | null = null

/** 拿到有效 token ⇒ 这台浏览器确实有过会话。写失败不改变本标签页判定(内存镜像)。 */
export function markSessionEstablished(): void {
  establishedMirror = true
  if (!hasStorage()) return
  try {
    window.localStorage.setItem(SESSION_ESTABLISHED_STORAGE_KEY, '1')
  } catch (e) {
    console.warn(
      `[web-auth] failed to persist session-established marker (kept in memory for this tab): ` +
        `${e instanceof Error ? e.message : 'unknown error'}`,
    )
  }
}

/** 被动失效且服务端明确否定凭据 ⇒ 不再假装这台浏览器还有会话可续。 */
export function clearSessionEstablished(): void {
  establishedMirror = false
  if (!hasStorage()) return
  try {
    window.localStorage.removeItem(SESSION_ESTABLISHED_STORAGE_KEY)
  } catch (e) {
    console.warn(
      `[web-auth] failed to clear session-established marker: ` +
        `${e instanceof Error ? e.message : 'unknown error'}`,
    )
  }
}

/** 这台浏览器是否曾经建立过会话(冷启动要不要试 `/auth/refresh` 的判据之一)。 */
export function hasSessionEstablished(): boolean {
  if (establishedMirror !== null) return establishedMirror
  if (!hasStorage()) return false
  try {
    establishedMirror = window.localStorage.getItem(SESSION_ESTABLISHED_STORAGE_KEY) !== null
  } catch (e) {
    // 读不到时按"没有"处理是本函数唯一的保守方向:多发一次 refresh 只是噪声,
    // 而谎报"有"会让匿名首访也发请求 —— 两种情况都不改变用户可见行为,故不喊红。
    console.warn(
      `[web-auth] failed to read session-established marker, treating as no prior session: ` +
        `${e instanceof Error ? e.message : 'unknown error'}`,
    )
    establishedMirror = false
  }
  return establishedMirror
}

/** 测试专用:同 `__resetSessionLoggedOutMirrorForTest`。 */
export function __resetSessionEstablishedMirrorForTest(): void {
  establishedMirror = null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
