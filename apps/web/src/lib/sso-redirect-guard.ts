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

/**
 * 目标是否为"同源相对路径"跳转(受本站登录守卫约束)。跨源绝对地址与自定义协议深链(ihui://…)不受约束。
 *
 * 第二个字符既不得是 `/` 也不得是 `\`(2026-09-28 票 A3/G-413 补反斜杠这一族):
 * WHATWG URL 解析器在 special-scheme 的 "special authority ignore slashes" 状态里把 `\` 与 `/`
 * **等值处理**,于是 `/\evil.com`、`/\/\evil.com`、`///evil.com` 与 `//evil.com` 落在同一个解析分支。
 * 实测(node 的 WHATWG 实现,与浏览器同一套算法,base = 本站):
 *   new URL('/\\evil.com', 'https://aizhs.top').href === 'https://evil.com'
 * ⇒ 只挡 `//` 的旧判据会把反斜杠形态**放行成跨站跳转**,而这条链的落点带着刚签发的 sso_code /
 * 会话 Cookie —— 所以这不是"跳转偏好"而是 code 泄露。判据仍然只做形状归一,不引入第二份 origin 表。
 */
export function isSameOriginRelative(target: string): boolean {
  if (!target.startsWith('/')) return false
  const second = target.charAt(1)
  return second !== '/' && second !== '\\'
}

/** 可作为导航目标的协议(普通调用点只认这两档)。 */
const SAFE_NAVIGATION_PROTOCOLS = new Set(['http:', 'https:'])

/**
 * "会在本站源里执行代码 / 取回本地字节"的那一族协议。
 * 单独列一份而不是"凡非 http(s) 即拒",是因为 `allowDeepLink` 这一档要放行**未知**自定义 scheme
 * (深链回 App),而这一族无论如何都不能放行 —— 两个集合不分开就会互相顶掉。
 */
const SELF_EXECUTING_PROTOCOLS = new Set([
  'javascript:',
  'data:',
  'blob:',
  'file:',
  'vbscript:',
  'about:',
])

/** `isSafeNavigationTarget` 的判据开关。两者都不传 ⇒ 与 2026-09-28 之前的行为逐字相同。 */
export interface SafeNavigationOptions {
  /**
   * 允许"自定义协议深链"(ihui:// / ihui-miniapp://),但**仍**拒掉 SELF_EXECUTING 那一族。
   * 默认 false ⇒ 与既有调用点(/sso/mobile-auth)的判据逐字相同(见测试里 `ihui://` 那条断言)。
   * 为什么需要开关:/sso/login 与 /sso/register 的回跳落点按设计含深链(generateCodeAndRedirect
   * 的 isCustomScheme 分支 + AGENTS.md §9 的 scheme 契约),对它们只能判"会不会在本站执行",
   * 不能判"是不是 http(s)" —— 后者会砍断 desktop/mobile 的 SSO 闭环。
   * 深链**格式**的权威白名单(env `SSO_ALLOWED_DEEP_LINK_SCHEMES` + 必须有 host)在服务端
   * `apps/api/src/routes/auth-sso.ts`,本开关刻意不复制那张表(登记表必然腐烂),只判协议族 + host。
   */
  allowDeepLink?: boolean
  /**
   * 传入 ⇒ 绝对 http(s) 目标必须**逐字命中**这份 origin 白名单;不传 ⇒ 只判协议(维持原行为)。
   * 用途:/sso/redirect 这一页的策略本来就是"同源相对 ∪ env 白名单"(它带着 sso_code 落地,
   * 必须锁 origin)。把这份策略搬进本文件,是为了让"同源判定"只有一份实现(AGENTS §3)。
   */
  allowedOrigins?: readonly string[]
}

/** 解析 env 白名单(逗号分隔);未配置 ⇒ 空数组(= 所有绝对地址都不放行)。 */
export function parseAllowedOrigins(raw?: string): string[] {
  return (raw ?? '').split(',').map((s) => s.trim()).filter(Boolean)
}


/**
 * 协议级安全判定 —— 与本文件的**归属/守卫**判定是两件事,不得互相代替:
 *  - `isSameOriginRelative` 问"这一跳会不会被登录守卫 307 打回"(站内路径才会);
 *  - 本函数问"这一跳会不会在**我们自己的源**里执行代码或取回本地字节"。
 *
 * 为什么必须有它:`/sso/mobile-auth` 的 `redirect` 语义是"WebView 接下来要打开的那个页面",
 * 外部页是**设计意图**(`WebViewScreen` 传任意 http(s) 目标、`ChatToolsScreen` 传站内绝对地址),
 * 对它套 origin 白名单会直接砍断 App→Web 回跳;但 `javascript:` / `data:` / `blob:` 这类伪 URL
 * 经 `window.location.replace` 会在本站源里执行,而本页刚 Set-Cookie 了 auth_token —— 那是
 * 同源 XSS/会话窃取,不是"跳到哪儿"的偏好问题。`//host` 形式按站内规则不算相对路径,
 * 由 `new URL` 归到 http(s) 后再判,故仍可用(它只是导航,不执行本站代码)。
 *
 * 三类绕过都必须落在这里(票 A3/G-413 的判据清单),因为**四处回跳落点共用这一把尺子**,
 * 任何一处再各写一份就回到"两处实现必漂移":
 *  1. 协议相对 `//evil.com` —— `new URL` 无 base 解析不出 ⇒ 拒;
 *  2. 反斜杠 `/\evil.com`(浏览器按 `//evil.com` 解析)⇒ 由 `isSameOriginRelative` 的第二字符判据拒;
 *  3. 自执行协议 `javascript:` / `data:` / `blob:` / `file:` / `vbscript:` / `about:` ⇒ 拒,
 *     哪怕 `allowDeepLink` 打开也不放行(那条开关只放开"回 App 的深链",不放开"在本站执行")。
 *
 * @param options `allowDeepLink: true` ⇒ 自定义协议深链(ihui://…)视为合法落点;默认 false,
 *        即 2026-09-28 之前的判据逐字不变(深链也拒)。只有回跳契约里本就含深链的调用点可传。
 */
export function isSafeNavigationTarget(target: string, options?: SafeNavigationOptions): boolean {
  if (!target) return false
  if (isSameOriginRelative(target)) return true
  let parsed: URL
  try {
    parsed = new URL(target)
  } catch {
    return false // 裸串不是 URL ⇒ 由调用方回落,不猜"应该没问题"
  }
  if (SELF_EXECUTING_PROTOCOLS.has(parsed.protocol)) return false
  if (SAFE_NAVIGATION_PROTOCOLS.has(parsed.protocol)) {
    // 传了白名单就逐字比 origin(那是 /sso/redirect 那类"带着 sso_code 落地"的页面唯一的收口点);
    // 没传则维持"协议判定"原语义 —— mobile-auth 的外站回跳是设计意图,不得按 origin 拒。
    const origins = options?.allowedOrigins
    return origins === undefined || origins.includes(parsed.origin)
  }
  // 深链必须有 host(ihui:// 裸 scheme 打不开任何 App),与 auth-sso.ts 的深链校验同一条形状判据
  return options?.allowDeepLink === true && Boolean(parsed.host)
}

/**
 * 回跳落点的**唯一决策出口**:把客户端给的 `redirect` 参数换成"这一跳真正该用的目标"。
 *
 * 为什么要有它而不是让每个页面各写 `if (!isSafe…) push('/')`:四处回跳落点(sso/login、
 * sso/register、sso/redirect、sso/mobile-auth)判的是同一件事(都走 `isSafeNavigationTarget`),
 * 判据有牙与否取决于**四站同形** —— 各写一遍就回到"两处实现必漂移"(AGENTS §3),
 * 而漂移的表现形式永远是安静的那一侧。mobile-auth 保留它自己那处显式判定(判据同一个、
 * 落法是 `window.location.replace('/')`,已由 `6730b1c138` 的用例钉住),不改它以免与并发交付对撞。
 *
 * 拒绝时不静默:留一行 console.warn 点名原值(与 /sso/mobile-auth 已有的处置同形;
 * 这类输入只在攻击/畸形链接场景出现,故刻意不新增 5 语言文案,产品要显式提示时另计一票)。
 *
 * @returns 合法 ⇒ 原样返回;不安全 ⇒ 返回 `fallback`(默认站内首页 `/`)。
 */
export function resolveSafeRedirectTarget(
  target: string,
  options?: SafeNavigationOptions & { fallback?: string },
): string {
  if (isSafeNavigationTarget(target, options)) return target
  const fallback = options?.fallback ?? '/'
  console.warn('[sso-redirect-guard] redirect 参数不是安全的站内回跳目标,已回落:', target)
  return fallback
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
