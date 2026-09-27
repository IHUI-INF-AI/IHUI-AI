// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * mobile-rn token 管理(接入 SecureStore,带 AsyncStorage fallback)
 *
 * 历史背景:之前 token 用 AsyncStorage 明文持久化,iOS 越狱/Android root 后可读。
 * 2026-07-20 升级:token 改用 SecureStore(iOS Keychain / Android Keystore 系统级加密),
 * 不可用时透明降级到 AsyncStorage(开发/测试环境,无 Keychain 风险低)。
 * 2026-07-27 重构:改用 @ihui/shared/auth 的 createInMemoryTokenStore 工厂统一管理内存缓存,
 * SecureStore 持久化逻辑下放到 onSetToken/onSetRefreshToken/onClearAll 回调,
 * 消除手写 cachedToken/cachedRefreshToken 模块级状态。
 *
 * 调用方:`setToken` / `setRefreshToken` / `clearToken` / `getToken` / `getRefreshToken`。
 * `getToken` / `getRefreshToken` 返回同步缓存值(避免每次 HTTP 都 await SecureStore)。
 */
import {
  fetchApi,
  setBaseUrl,
  setDeviceFingerprintProvider,
  setUnauthorizedHandler,
  setUserAgent,
  type UnauthorizedContext,
} from '@ihui/api-client'
import {
  API_BASE_URL,
  APP_USER_AGENT,
  TOKEN_STORAGE_KEY,
  REFRESH_TOKEN_STORAGE_KEY,
} from './config'
import { mobileRnDeviceFingerprintCollector } from './device-fingerprint'
import { deleteSecureItem, getSecureItem, setSecureItem } from './auth/secure-store'
import { navigationRef, navigateTo } from '../navigation/navigation-ref'
import {
  bindTokenStoreToApiClient,
  createInMemoryTokenStore,
  type TokenStore,
} from '@ihui/shared/auth'

/**
 * 内存缓存 TokenStore(工厂创建)
 *
 * 缓存由工厂统一管理,持久化通过回调下放到 SecureStore:
 * - onSetToken/onSetRefreshToken:token 非空写 SecureStore,为空删除
 * - onClearAll:并行删除两个 key
 * SecureStore 内部带 AsyncStorage fallback(见 ./auth/secure-store),存储层级保留。
 */
const memoryStore = createInMemoryTokenStore({
  onSetToken: async (token) => {
    if (token) {
      await setSecureItem(TOKEN_STORAGE_KEY, token)
    } else {
      await deleteSecureItem(TOKEN_STORAGE_KEY)
    }
  },
  onSetRefreshToken: async (token) => {
    if (token) {
      await setSecureItem(REFRESH_TOKEN_STORAGE_KEY, token)
    } else {
      await deleteSecureItem(REFRESH_TOKEN_STORAGE_KEY)
    }
  },
  onClearAll: async () => {
    await Promise.all([
      deleteSecureItem(TOKEN_STORAGE_KEY),
      deleteSecureItem(REFRESH_TOKEN_STORAGE_KEY),
    ])
  },
})

/**
 * 401 自动续期(2026-09-22 立,对齐 web 端 apps/web/src/lib/api.ts 同名回调):
 * access token 仅 15min 有效,此前 RN 未注入本回调 → 登录 15 分钟后全部鉴权接口失效,
 * agent-control 能力上报每 60s 刷 "Invalid or expired token" 警告。
 * 走 fetchApi 自身(/auth/refresh 属 auth 端点,401 拦截器豁免,不递归续期)。
 * 成功:轮转写入新 token + refreshToken(SecureStore 持久化),返回新 access token;
 * 失败:refreshToken 也已失效 → 返回 null,由 api-client 失败冷却兜底,调用方按登录过期处理。
 */
async function refreshAccessToken(): Promise<string | null> {
  const storedRefresh = memoryStore.getRefreshToken()
  const res = await fetchApi<{ accessToken: string; refreshToken?: string | null }>(
    '/auth/refresh',
    {
      method: 'POST',
      body: JSON.stringify(storedRefresh ? { refreshToken: storedRefresh } : {}),
    },
  )
  if (res.success && res.data?.accessToken) {
    await memoryStore.setToken(res.data.accessToken)
    if (res.data.refreshToken) await memoryStore.setRefreshToken(res.data.refreshToken)
    return res.data.accessToken
  }
  return null
}

/**
 * 会话彻底失效的统一出口(2026-09-27 立,真机实测逼出)
 *
 * `setUnauthorizedHandler` 此前**只有 web 注册**(全仓唯一调用点 `apps/web/src/lib/api.ts:110`)。
 * RN 的后果不是"少一个弹窗",而是**用户没有任何出路**:access token 与 refresh token 双双过期后,
 * 每一屏各自显示一句从错误体里取来的通用文案,而"去登录"这件事既没有入口也没有跳转 ——
 * 实测 logcat 反复打「上报移动端能力失败:Invalid or expired token」,屏幕上什么都没有。
 *
 * 三条边界,对应 api-client 侧 notifyUnauthorized 的三条不变量:
 * 1. **不再以"内存里有没有 token"作准入条件**(2026-09-27 真机实测推翻旧写法)。
 *    旧守卫写的是 `if (!memoryStore.getToken()) return`,理由是"游客的 401 是该接口要登录,
 *    不是会话死了"。真机上它恰好把**最需要出路**的那一态判成了游客:App 自认已登录
 *    (桥接在跑、页面按登录态渲染)而 SecureStore 那份缓存里没有凭据 ⇒ 请求不带 Authorization
 *    → 401 → 续期也拿不到 token → 通知进来 → 被这条守卫挡回去,用户永远停在原地。
 *    能走到本函数的前提已经是"本应用主动发了一次需要身份的请求且它 401 了",
 *    游客浏览公开内容时不会走到这里。
 * 2. **不重复跳** —— 已经在 Login 上就什么都不做。刻意**不引入模块级布尔量**做去重:
 *    布尔量需要一个"何时复位"的第二真相(登录成功后谁负责清?),而"当前路由是不是 Login"
 *    本身就是同一个事实的直接读法,不会与之漂移。
 * 3. **不清 token** —— 清 token 会让所有在飞的 UI 立刻翻成未登录态(头像/昵称/余额闪空),
 *    那是比"停在原页"更差的观感;登录成功后 `setToken` 自然覆盖,失效凭据不参与任何判据。
 *
 * 与 web 的"非 GET 才弹"口径**刻意不同**:这次挂在屏上的恰恰是 GET(列表/统计),
 * 若照抄该规则,RN 依旧没有任何出路。web 那一条服务于"不打断填表",RN 没有表单弹窗可打断。
 *
 * **拒绝接管必须出声**:本函数唯一的静默出口是"已经在 Login 上"(那是成功状态的幂等,
 * 不是失败)。navigator 未就绪是一真失败,喊一次即可 —— 与 §5e"失败必须响"、
 * 守门 70/76/81"判据失效的表现永远是安静"同一条禁令。
 */
let unreadyWarned = false
function onUnrecoverableUnauthorized(ctx: UnauthorizedContext): void {
  if (!navigationRef.isReady()) {
    if (!unreadyWarned) {
      unreadyWarned = true
      console.warn(
        `[rn-auth] 会话失效但跳不了:navigator 尚未就绪(${ctx.method} ${ctx.url}) —— 本进程只喊这一次`,
      )
    }
    return
  }
  if (navigationRef.getCurrentRoute()?.name === 'Login') return
  console.warn(`[rn-auth] 会话失效 → 跳转登录页(来源 ${ctx.method} ${ctx.url})`)
  navigateTo('Login')
}

export async function initApi(): Promise<void> {
  setBaseUrl(API_BASE_URL)
  setUserAgent(APP_USER_AGENT)
  const [stored, storedRefresh] = await Promise.all([
    getSecureItem(TOKEN_STORAGE_KEY),
    getSecureItem(REFRESH_TOKEN_STORAGE_KEY),
  ])
  // Hydrate 缓存:从 SecureStore 读取后只更新内存,不回写存储(避免循环触发)
  memoryStore.setCachedWithoutPersist({
    token: typeof stored === 'string' ? stored : null,
    refreshToken: typeof storedRefresh === 'string' ? storedRefresh : null,
  })
  bindTokenStoreToApiClient(tokenStore, { refreshAccessToken })
  setUnauthorizedHandler(onUnrecoverableUnauthorized)
  setDeviceFingerprintProvider(mobileRnDeviceFingerprintCollector)
}

export function getToken(): string | null {
  return memoryStore.getToken()
}

export function getRefreshToken(): string | null {
  return memoryStore.getRefreshToken()
}

export async function setToken(token: string | null): Promise<void> {
  await memoryStore.setToken(token)
}

export async function setRefreshToken(token: string | null): Promise<void> {
  await memoryStore.setRefreshToken(token)
}

export async function clearToken(): Promise<void> {
  await memoryStore.clearAll()
}

/**
 * TokenStore 契约接入(类型层验证,零运行时改动)
 *
 * 编译时验证本端 token 管理实现符合 @ihui/shared/auth TokenStore 接口,
 * 为后续跨端统一调用提供类型安全网。各调用方仍可直接用具体函数,
 * 此对象供后续重构或新代码通过 TokenStore 接口调用使用。
 *
 * 注意:clearToken 同时清除 token + refreshToken,映射到 TokenStore.clearAll。
 */
export const tokenStore: TokenStore = {
  getToken,
  getRefreshToken,
  setToken,
  setRefreshToken,
  clearAll: clearToken,
}

// Re-export 给 mobile-rn 端使用(从 lib/token-store.ts 迁移,避免维护两个文件)
export { bindTokenStoreToApiClient } from '@ihui/shared/auth'
export type { TokenStore, TokenStoreWithUserInfo } from '@ihui/shared/auth'
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
