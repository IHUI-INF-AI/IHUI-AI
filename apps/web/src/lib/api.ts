// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import {
  setTokenProvider,
  setBaseUrl,
  setStreamBaseUrl,
  setDeviceFingerprintProvider,
  setUnauthorizedHandler,
  fetchApi as fetchApiShared,
} from '@ihui/api-client'
import type { ApiResult } from '@ihui/types'
import { useAuthStore } from '@/stores/auth'
import { openLoginDialogOnce } from '@/lib/login-dialog-trigger'
import { getAuthCookie } from '@/lib/cookie-utils'
import { getDesktopRefreshToken, setDesktopRefreshToken } from '@/lib/desktop-token-vault'
import { resolveApiBaseUrl, resolveStreamApiBaseUrl } from '@/lib/api-base-url'
import { webDeviceFingerprintCollector } from '@/hooks/use-device-fingerprint'

// 2026-07-25 修复 CSRF:内存 token 为 null 时从 auth_token cookie 兜底读取。
// P2-18 修复(2026-08-06):auth_token 已 httpOnly,getAuthCookie() 恒返回 null,
// 该兜底自然失效——请求凭内存 token 发 Bearer;内存无 token 时由浏览器自动附带
// httpOnly cookie(api-client transport 默认 credentials: 'include')兜底认证。
setTokenProvider({
  getToken: () => useAuthStore.getState().token ?? getAuthCookie(),
  // 2026-08-06 401 自动续期:access token 过期(15min)时,api-client 收到 401 会调用
  // 此回调,用 httpOnly refresh_token cookie(30 天)静默换取新 access token。
  // 走 fetchApi 自身(经 isAuthEndpoint 判断 /auth/refresh 不递归续期)。
  // 刷新失败(401,refresh token 也失效)→ 返回 null → 调用方按登录过期处理。
  // 2026-09-02 桌面端 SaaS 化:跨站(tauri.localhost → aizhs.top)请求不带 SameSite=Lax
  // cookie,改从 Tauri store(auth.json)读 refreshToken 走 body 模式(后端 /auth/refresh
  // bodyToken 优先于 cookieToken);轮转写入由 stores/auth.ts setToken 统一落 vault。
  refreshAccessToken: async () => {
    const storedRefresh = await getDesktopRefreshToken() // 浏览器返回 null → cookie 模式不变
    const res = await fetchApiShared<{
      accessToken: string
      refreshToken?: string | null
    }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify(storedRefresh ? { refreshToken: storedRefresh } : {}),
    })
    if (res.success && res.data?.accessToken) {
      // 更新内存 token;新 refreshToken 由 setToken 写回 vault(桌面)或仅内存(浏览器 cookie 轮转)
      useAuthStore.getState().setToken(res.data.accessToken, res.data.refreshToken ?? null)
      return res.data.accessToken
    }
    // 刷新失败 = refreshToken 已失效:清空桌面 vault,避免每次启动重复失败空转
    if (storedRefresh) await setDesktopRefreshToken(null)
    return null
  },
})

// A 套壳:rewrites 失效后(output: 'export'),前端直连 apps/api。
// 寻址判定已收口到 lib/api-base-url.ts(2026-09-21 根治"桌面端连不上生产后端"),
// 要点:**按窗口实际 origin 判定,而不是按"是不是 Tauri 运行时"** —— 桌面端是薄壳,
// 主窗口加载线上 https://aizhs.top/agents,必须走同源 /api/*;只有本地 dev(8801)/
// 本地壳(tauri.localhost / offline 兜底页)才回退本机 8802。
// 历史教训:旧逻辑 `'__TAURI_INTERNALS__' in window ? env || 'http://127.0.0.1:8802'`
// 把 Tauri 等同于"本地三端联调",线上构建的空 env(scripts/build-next-prod.ps1 刻意为空)
// 被 `||` 吞掉 → 桌面端全部请求打到用户本机 8802:无本地后端=连接被拒,有 dev 后端=
// 打到本地库,生产账号登录必失败。
// 只在客户端执行(build/SSR 时跳过,避免循环依赖导致模块导出未初始化)
function detectApiBaseUrl(): string {
  return resolveApiBaseUrl()
}

// SSE 流被 Next.js dev proxy 中断(超时/缓冲 → net::ERR_ABORTED),故 dev 直连本机绕过;
// 生产与桌面端(窗口加载远端站点)一律同源复用 baseUrl。判定收口同 lib/api-base-url.ts。
function detectStreamBaseUrl(): string {
  return resolveStreamApiBaseUrl()
}

if (typeof window !== 'undefined') {
  setBaseUrl(detectApiBaseUrl())
  setStreamBaseUrl(detectStreamBaseUrl())
  // 设备维度风控:注入 web 采集器,api-client 自动把指纹塞进 x-device-fingerprint header
  setDeviceFingerprintProvider(webDeviceFingerprintCollector)
}

/**
 * 401 → 弹登录框的**唯一**决策函数(2026-09-25 将原包装层内联逻辑原样提出)。
 *
 * 提出来的原因:这个判断此前只存在于本文件的 `fetchApi` 包装层里。端内一旦改走
 * `@ihui/api-client` 的端点函数(它们直接调共享 fetchApi,不经过本包装),就静默失去
 * 反馈 —— 对那些没有 onError 分支的 mutation 来说,是"点了没反应"。共享包补了
 * `setUnauthorizedHandler` 注册口后,把同一个函数喂给它即可,不需要复制第二份判断。
 *
 * 懒触发策略(2026-07-23 用户要求"刚进页面不弹出,只有需要登录的功能点击后才弹出"):
 * - GET 请求(页面初始加载 / 查询)的 401 不弹窗,避免一进页面就被弹窗打断
 * - 非 GET 请求(POST/PUT/DELETE/PATCH,即用户主动操作如安装/评分/发消息)的 401 才弹窗
 * - 统一走 openLoginDialogOnce(2026-07-24 深度根治):自带全局去重 guard + 公开路径白名单
 */
function requestLoginDialogForUnauthorized(method: string): void {
  if (typeof window === 'undefined') return
  // 仅用户主动操作(非 GET)的 401 才弹窗
  if (method === 'GET') return
  // 2026-08-14 修复:页面刷新后 isAuthenticated=true 但 token=null(刷新中)时,
  // 不触发弹窗。避免 bootstrap 静默刷新期间被其他并发请求的 401 打断。
  // refresh 成功 → token 恢复 → 后续请求正常;refresh 失败 → logout() 降级 isAuthenticated=false,
  // 再遇到 401 才弹窗(用户确实需要登录)。
  const { isAuthenticated, token } = useAuthStore.getState()
  if (isAuthenticated && !token) return
  const currentPath = window.location.pathname + window.location.search
  openLoginDialogOnce(currentPath)
}

// 2026-09-25 接线:让"经端点函数发出"的请求也拿到与经本包装层完全相同的 401 反馈。
// 与 setTokenProvider 同档,无条件注册(SSR 下 requestLoginDialogForUnauthorized 自行早返回)。
setUnauthorizedHandler((ctx) => requestLoginDialogForUnauthorized(ctx.method))

/**
 * Web 端 fetchApi 包装:401 未授权时自动打开登录弹窗。
 *
 * 2026-09-25 起该判断收口到 `requestLoginDialogForUnauthorized`,本包装层与共享包的
 * 401 处理器**共用同一份实现**,不产生第二套弹窗逻辑。
 * 直调路径不会"弹两次":openLoginDialogOnce 自带模块级 openGuard(跨所有触发点共享,
 * 弹窗未关闭前第二次调用直接返回 false),这正是它名字里 Once 的职责;两条路径在同一个
 * 宏任务内先后命中,后到的一次被 guard 吃掉。
 */
// 2026-09-07:options 放宽支持 timeoutMs(透传 @ihui/api-client FetchApiOptions,
// 供 /bestof 等同步阻塞、耗时可达分钟级的端点放大超时,默认 30s)。
export async function fetchApi<T>(
  url: string,
  options: RequestInit & { timeoutMs?: number } = {},
): Promise<ApiResult<T>> {
  const result = await fetchApiShared<T>(url, options)
  if (!result.success && result.status === 401) {
    requestLoginDialogForUnauthorized((options.method ?? 'GET').toUpperCase())
  }
  return result
}

export function getStreamBaseUrl(): string {
  return detectStreamBaseUrl()
}

// 2026-09-09 0-5 直接 fetch 清单化迁移:补齐共享层能力 re-export。
// - fetchAiServiceJson:ai-service 非标准响应(无 {code,data} 包装,整体 body 作 data),
//   自动带 Bearer/X-Requested-With/设备指纹 + 30s 超时(timeoutMs 可覆盖),替代各页面
//   手拼 AI_SERVICE_URL + Bearer 的本地 helper。
// - fetchRaw:二进制 Blob 下载(自动带鉴权头),替代各页面手拼 fetch 的 blob 消费。
export {
  setTokenProvider,
  setBaseUrl,
  setStreamBaseUrl,
  streamChat,
  getToken,
  isAbortError,
  fetchAiServiceJson,
  fetchRaw,
} from '@ihui/api-client'
export type { ApiResult, ApiResponse } from '@ihui/types'
