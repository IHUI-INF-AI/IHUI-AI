/**
 * Desktop(Tauri)refresh token 保险库 —— SaaS 模式下跨域认证的核心存储。
 *
 * 背景(2026-09-02 桌面端 SaaS 化):
 * 桌面端生产包 origin = http://tauri.localhost,访问 https://aizhs.top 属跨站请求,
 * 后端 httpOnly refresh_token cookie(SameSite=Lax)不会随跨站 fetch 发送,
 * 因此 /auth/refresh 无法靠 cookie 静默续期(每 15 分钟强制登出)。
 * 方案:登录/刷新时把 refreshToken 显式落 Tauri store(auth.json),
 * 刷新请求改走 body 模式(后端 /auth/refresh 已支持 bodyToken || cookieToken,body 优先)。
 *
 * 浏览器模式:isDesktopEnv() 为 false,全部方法为空操作,行为零变化(cookie 链路不动)。
 * 平台特有:依赖 Tauri plugin-store(window.__TAURI_INTERNALS__),不适合放共享层。
 */

/** Tauri v2 运行时探测(与 lib/api.ts detectApiBaseUrl 同一标识) */
export function isDesktopEnv(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/** store 文件名(落在系统应用数据目录,非 webview localStorage,可被 Rust 侧同读) */
const STORE_FILE = 'auth.json'
const REFRESH_TOKEN_KEY = 'refresh_token'

/** 懒加载 plugin-store(动态 import 避免浏览器 bundle 引入 Tauri 依赖) */
async function openStore(): Promise<{
  get: <T>(k: string) => Promise<T | undefined>
  set: (k: string, v: unknown) => Promise<void>
  delete: (k: string) => Promise<boolean>
  save: () => Promise<void>
} | null> {
  if (!isDesktopEnv()) return null
  try {
    const { load } = await import('@tauri-apps/plugin-store')
    // autoSave:false —— 显式 save(),避免并发轮转时中间态落盘
    // Store 类结构匹配上方接口(get/set/delete/save),直接返回
    return await load(STORE_FILE, { autoSave: false })
  } catch {
    return null
  }
}

/** 读取持久化 refreshToken;非 Tauri 或读失败返回 null(不抛错,不阻塞登录) */
export async function getDesktopRefreshToken(): Promise<string | null> {
  const store = await openStore()
  if (!store) return null
  try {
    const value = await store.get<string>(REFRESH_TOKEN_KEY)
    return typeof value === 'string' && value ? value : null
  } catch {
    return null
  }
}

/** 写入(null = 删除)refreshToken;非 Tauri 为空操作 */
export async function setDesktopRefreshToken(token: string | null): Promise<void> {
  const store = await openStore()
  if (!store) return
  try {
    if (token) {
      await store.set(REFRESH_TOKEN_KEY, token)
    } else {
      await store.delete(REFRESH_TOKEN_KEY)
    }
    await store.save()
  } catch {
    // 落盘失败不阻塞登录/登出主流程;下次轮转会再写
  }
}
