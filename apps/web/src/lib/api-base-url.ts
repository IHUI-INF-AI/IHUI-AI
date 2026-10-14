// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 后端寻址统一判定(2026-09-21 根治"桌面端连不上生产后端")。
 *
 * 问题:桌面端是薄壳模式 —— tauri.conf.json 的 windows[0].url =
 * https://aizhs.top/ 首页(2026-10-13 起启动页,此前 /agents),主窗口直接加载**线上**前端;而线上 web 构建刻意把
 * NEXT_PUBLIC_API_BASE_URL 置空(scripts/build-next-prod.ps1:浏览器走同源 /api/* 反代)。
 * 旧逻辑把它写成:
 *   '__TAURI_INTERNALS__' in window ? NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8802' : ...
 * 即把"Tauri 运行时"等同于"本地三端联调":线上构建的空 env 被 `||` 吞掉,回退到本机 API。
 * 结果桌面端全部 REST/SSE/WS 请求打到 http://127.0.0.1:8802:
 *   - 用户机器没跑本地后端 → ECONNREFUSED,登录页报无法连接后端;
 *   - 用户机器恰好跑着 dev 后端 → 打到本地库,生产账号不存在 → 登录失败。
 * 同时 Rust 侧健康探活是指向 https://aizhs.top/api/health 的(正确),两侧语义分裂。
 *
 * 正确语义:**按窗口实际 origin 判定**,而不是按"是不是 Tauri":
 *   1. NEXT_PUBLIC_API_BASE_URL 显式非空 → 最高优先(桌面端 SaaS 烘焙场景);
 *   2. Tauri + 窗口加载远端站点 → ''(同源 /api/*,与线上浏览器完全一致;cookie 同源
 *      自动附带,顺带恢复 SameSite=Lax 的 refresh 轮转);
 *   3. Tauri + 窗口由本机 Next dev server 承载(localhost:8801 等本地 origin + 端口 8801)
 *      → ''(同源,经 next rewrites 反代到 8802/8803;2026-10-15 改,与浏览器 dev 同形,
 *      cookie 回到第一方,登录态不再依赖与生产壳共享的桌面 vault);
 *   3b. Tauri + 其它本地 origin(tauri.localhost 本地壳 / offline 兜底页)→ 本机 API
 *      (这类窗口没有 dev server 可反代,本地三端联调语义原样保留);
 *   4. 浏览器 dev(localhost:8801)→ ''(同源,Next dev rewrites 代理到 8802);
 *   5. 其它 → ''(生产同源)。
 *
 * 平台特有:依赖 window.location 与 Tauri 运行时标识,不适合下沉 packages/shared。
 */

/** 视为"本地开发 / 本地壳"的 hostname —— 命中才走本机 API */
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]', 'tauri.localhost'])

/** 本机 API(本地三端联调)。用 127.0.0.1 避免系统代理/PAC 影响 */
const LOCAL_API_BASE = 'http://127.0.0.1:8802'

/** 本机 ai-service(本地三端联调)。用 127.0.0.1 避免系统代理/PAC 影响 */
const LOCAL_AI_SERVICE_BASE = 'http://127.0.0.1:8803'

/** 本机 SSE 基址。用 localhost:PAC 常把 127.0.0.1 路由到代理导致 ERR_CONNECTION_REFUSED */
const LOCAL_STREAM_BASE = 'http://localhost:8802'

/** Tauri 运行时标识(Tauri 2 在 withGlobalTauri=false 下只注入 __TAURI_INTERNALS__) */
export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/**
 * 当前窗口是否加载远端站点(生产桌面端的常态)。
 * 非 http(s) 协议(file: / offline: / tauri:)一律视为本地壳。
 */
export function isRemoteWindow(): boolean {
  if (typeof window === 'undefined') return false
  const { protocol, hostname } = window.location
  if (protocol !== 'http:' && protocol !== 'https:') return false
  return !LOCAL_HOSTNAMES.has(hostname)
}

/** 浏览器本地 dev(Next dev server:8801) */
export function isLocalWebDevOrigin(): boolean {
  if (typeof window === 'undefined') return false
  const { hostname, port } = window.location
  return LOCAL_HOSTNAMES.has(hostname) && port === '8801'
}

/**
 * 桌面凭据库是否应当启用(2026-10-15 立,根治「dev 壳与生产壳互相烧 token」)。
 *
 * `com.ihui.desktop/auth.json` 的 `refresh_token` 是**按 App identifier 共享**的一颗键:
 * 生产壳装的是线上库凭据,dev 壳装的是本机库凭据,两边读写同一颗键;而刷新被否(401)时
 * `api.ts` 会 `setDesktopRefreshToken(null)` 清库 —— 于是一侧的失败会静默抹掉另一侧的登录态。
 * dev 壳的窗口由本机 Next dev server 承载,REST 已是同源(见 resolveApiBaseUrl),httpOnly
 * refresh cookie 是第一方凭据,根本不需要桌面 vault 兜底 ⇒ 这一族窗口不读也不写该库。
 */
export function isDesktopAuthVaultEnabled(): boolean {
  return isTauriRuntime() && !isLocalWebDevOrigin()
}

/**
 * REST 基址。
 * @returns 空字符串 = 同源(window.location.origin 的 /api/*)
 */
export function resolveApiBaseUrl(): string {
  const env = process.env.NEXT_PUBLIC_API_BASE_URL
  if (env) return env
  if (typeof window === 'undefined') return ''
  if (isTauriRuntime()) {
    if (isRemoteWindow()) return ''
    // 2026-10-15 根治:窗口由本机 Next dev server 承载(dev 壳)⇒ 走同源 /api/* 反代。
    // 直连 127.0.0.1:8802 时,窗口 origin(localhost:8801)与 API(127.0.0.1:8802)是**跨 host**,
    // httpOnly refresh cookie 永不附带,登录态只剩与生产壳共享的那颗桌面 vault 键(见
    // isDesktopAuthVaultEnabled);同源反代后 cookie 回到第一方,与浏览器 dev 完全同形。
    if (isLocalWebDevOrigin()) return ''
    return LOCAL_API_BASE
  }
  return ''
}

/**
 * ai-service(/api/checkin/*、/api/mcp/*、/api/agents/* 等)基址判定
 * (2026-10-12 立,根治「桌面端 dev 签到页报 Route GET:/api/checkin/accounts not found」)。
 *
 * 为什么单独一条:REST 共享基址在"Tauri + 本地 origin"下是本机 API 8802,而签到等
 * ai-service 路由只存在于 ai-service(8803) —— fetchAiServiceJson 复用共享基址会把
 * /api/checkin/* 直接打到 8802 → Fastify 404(信封 Route GET:… not found)。
 * 浏览器 dev 不受影响:共享基址是 ''(同源),经 next rewrites 转发到 8803。
 *
 * 判定口径与 resolveApiBaseUrl 同族(按窗口 origin,不按"是不是 Tauri"):
 *   1. NEXT_PUBLIC_AI_SERVICE_URL 显式非空 → 最高优先(与 api-client 的
 *      aiServiceBaseUrl() 同一 env 名,不抄第二份真值);
 *   2. Tauri + 窗口由本机 Next dev server 承载(端口 8801)→ '' 同源,经 next rewrites
 *      (`/api/checkin/:path*` → 8803)转发 —— 与浏览器 dev 完全同形,cookie 保持第一方;
 *      2b. Tauri + tauri.localhost 本地壳 / offline 兜底页 → 本机 8803(无 dev server 可反代)。
 *      放行前提(2026-10-14 逐条实测,非推断):
 *        · **origin 回显**:ai-service `.env` CORS_ORIGIN=http://localhost:8801;带
 *          `Origin: http://localhost:8801` 实打 8803,401 响应确实回带
 *          `access-control-allow-origin: http://localhost:8801` +
 *          `access-control-allow-credentials: true`(通配符被 config.py 禁用,故必须逐值)。
 *        · **请求头清单**:预检实收 allow-headers 是显式清单
 *          (Authorization, Content-Type, X-Internal-Secret, traceparent, X-Trace-Id,
 *          X-Requested-With, x-device-fingerprint),api-client 每请求都注入的头全在册,
 *          故带 traceparent/Authorization 的预检返 200 而非 400。
 *        · **中间件顺序**:CORS 在 main.py **最后** add_middleware ⇒ Starlette LIFO 下位于
 *          链最外层,所以鉴权失败的 401 短路响应仍能补上 CORS 头(实测即此路径);
 *          若把 CORS 挪到 JWTAuth/RateLimit 内侧,桌面端直连会退化成 "TypeError: Failed to fetch"。
 *        · **CSP**:apps/web/next.config.ts 的 connect-src 仅**开发模式**放行
 *          `http://localhost:*` 与 `http://127.0.0.1:*`;生产档不含本机地址。
 *          tauri.conf.json `csp: null`(不额外收口)。
 *        · **跨站 cookie 不可用**:窗口 origin 是 `localhost:8801` 而目标是 `127.0.0.1:8803`
 *          —— 两个不同 registrable host = **跨站**,真 Chromium 实测 SameSite=Lax 的
 *          auth_token 不随该请求发出(服务器实收 `Cookie=(NONE)`)。所以这条路的身份**只靠
 *          Authorization: Bearer**,ai-service jwt_auth.py 的 cookie 兜底分支在此不可达。
 *      ⚠️ **为什么必须是 127.0.0.1、不得"顺手改成 localhost"**:本机 `localhost` 按 OS
 *      解析顺序**优先返回 `::1`**(dns.lookup all/verbatim 实测 = [::1, 127.0.0.1]),而
 *      8802/8803 **只监听 IPv4**(netstat 仅 `0.0.0.0:8802/8803`,无 `[::]`/`[::1]` 条目;
 *      uvicorn 绑 0.0.0.0 即 IPv4-only;对照 8801 是 `0.0.0.0` + `[::]` 双栈)。
 *      `::1:8802` / `::1:8803` 直连实测 **ECONNREFUSED**,`curl -6 localhost:8802|8803`
 *      实测 http_code=000。当前只有"客户端自带 Happy-Eyeballs 回退 IPv4"时才侥幸连通,
 *      代价是每次连接先吃一发被拒的 IPv6 往返(真 Chromium 暖连 5 次:localhost 腿
 *      med 42ms/尾 929ms,127.0.0.1 腿 med 17ms/尾 19ms)。把常量改成 localhost = 把桌面端
 *      的连通性押在回退行为上(macOS/Linux 壳是 WKWebView/WebKitGTK,本 Win 机无法验证),
 *      为拿回一条 cookie 兜底去赔整条链路,不划算 —— 要恢复 cookie 请改**服务端**
 *      (Bearer 之外另给显式 token 通道),别动这两个常量。
 *      附:代理不是本头的理由 —— 本机 ProxyEnable=1(127.0.0.1:7897)但旁路清单同时含
 *      `localhost` 与 `127.*`,两种写法都绕开代理;上方 LOCAL_API_BASE/LOCAL_STREAM_BASE
 *      两处对 PAC 的说法互相矛盾,以本次实测为准。
 *   3. 其余(浏览器 dev / 生产 / Tauri 远端窗口)→ '' 同源:浏览器 dev 走
 *      next rewrites → 8803,生产走 nginx 同源反代,行为零变化。
 */
export function resolveAiServiceBaseUrl(): string {
  const env = process.env.NEXT_PUBLIC_AI_SERVICE_URL
  if (env) return env
  if (typeof window === 'undefined') return ''
  if (isTauriRuntime()) {
    if (isRemoteWindow()) return ''
    // 与 resolveApiBaseUrl 同判据:dev 壳同源经 next rewrites(/api/checkin → 8803),
    // 不再跨 host 直连;只有 tauri.localhost / offline 本地壳才直连本机 8803。
    if (isLocalWebDevOrigin()) return ''
    return LOCAL_AI_SERVICE_BASE
  }
  return ''
}

/**
 * SSE / 流式 REST 基址。
 *
 * 浏览器 dev 走本机直连是为了绕过 Next dev proxy 对 SSE 的缓冲/超时;
 * 生产构建同源(`NODE_ENV==='development'` 门控,防止 CI e2e 的 next build 跑在
 * localhost:8801 被误判成 dev → 跨源直连被 CSP connect-src 'self' 拦截)。
 *
 * @returns 空字符串 = 同源
 */
export function resolveStreamApiBaseUrl(): string {
  const env = process.env.NEXT_PUBLIC_STREAM_API_BASE_URL
  if (env) return env
  if (typeof window === 'undefined') return ''
  if (isTauriRuntime()) {
    if (isRemoteWindow()) return ''
    // 本地壳:若已烘焙线上 API 基址(scripts/desktop-build-saas.mjs),
    // SSE 必须复用同一线上地址,否则会误连本机 dev 后端
    return process.env.NEXT_PUBLIC_API_BASE_URL || LOCAL_STREAM_BASE
  }
  if (process.env.NODE_ENV === 'development' && isLocalWebDevOrigin()) return LOCAL_STREAM_BASE
  return ''
}

/**
 * WebSocket 基址(通知 / agent 控制 / UI 控制桥)。
 *
 * 与 REST 的差异:**必须是绝对地址** —— packages/api-client 的 buildNotificationWsUrl
 * 内部走 `new URL(baseUrl)`,传空串会抛 TypeError,所以不能用 resolveApiBaseUrl() 的
 * "" 同源约定,需显式回退到 window.location.origin。
 *
 * 优先级:NEXT_PUBLIC_WS_BASE_URL(生产 WS 独立子域,见 lib/ws-url.ts 的 101/000 实测)
 * → REST 基址(桌面端本地壳/浏览器 dev)→ 当前 origin(同源)。
 */
export function resolveWsApiBaseUrl(): string {
  const wsEnv = process.env.NEXT_PUBLIC_WS_BASE_URL
  if (wsEnv) return wsEnv.replace(/\/+$/, '')
  // WebSocket 不经 next dev 反代(rewrites 不代理 WS 升级),所以**桌面本地壳必须直连本机 8802**,
  // 即便 REST 已改走同源(见 resolveApiBaseUrl)。浏览器 dev 维持原样(按 origin 推导)。
  if (isTauriRuntime() && !isRemoteWindow()) return LOCAL_API_BASE
  const rest = resolveApiBaseUrl()
  if (rest) return rest
  return typeof window !== 'undefined' ? window.location.origin : ''
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
