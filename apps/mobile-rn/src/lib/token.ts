// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

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
import { fetchApi, setBaseUrl, setDeviceFingerprintProvider, setUserAgent } from '@ihui/api-client'
import {
  API_BASE_URL,
  APP_USER_AGENT,
  TOKEN_STORAGE_KEY,
  REFRESH_TOKEN_STORAGE_KEY,
} from './config'
import { mobileRnDeviceFingerprintCollector } from './device-fingerprint'
import { deleteSecureItem, getSecureItem, setSecureItem } from './auth/secure-store'
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
 * 会话代次 + 凭据写入串行化:让"这轮本地会话已结束"成为唯一凭据存储自身的事实。
 *
 * 真机 VC52 实测:401 自动续期在途时,会话失效出口完成了登出;续期响应晚于 clearAll
 * 落地,把新 token 原样写回唯一存储 —— 每一步 await 都成功,logcat 全程无错,症状却是
 * "登出后凭据仍然存活、冷重启直接落回已登录分支"。在途请求与登出的相对顺序不受调用方
 * 控制,所以拒绝权必须握在存储这一侧:
 * ① 代次 —— 显式登录写入与 clearToken 都推进 sessionEpoch;续期发起时记下代次,
 *    落笔前(串行锁内)比对,晚到的响应属于已结束的那一轮,一律拒绝写入。
 * ② 串行 —— 续期写入与登出清除排同一条链,否则"锁外检查通过后、存储写完成前"被
 *    登出插队,删除仍会被后到的写入盖掉。
 * 刻意不把修法做成"logout 里再多清一遍其他位点"——那只把同一个竞态推迟到下一次写入。
 */
let sessionEpoch = 0
let writeChain: Promise<unknown> = Promise.resolve()

function serializeCredentialWrite<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(fn, fn)
  writeChain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

/**
 * 401 自动续期(2026-09-22 立,对齐 web 端 apps/web/src/lib/api.ts 同名回调):
 * access token 仅 15min 有效,此前 RN 未注入本回调 → 登录 15 分钟后全部鉴权接口失效,
 * agent-control 能力上报每 60s 刷 "Invalid or expired token" 警告。
 * 走 fetchApi 自身(/auth/refresh 属 auth 端点,401 拦截器豁免,不递归续期)。
 * 成功:轮转写入新 token + refreshToken(SecureStore 持久化),返回新 access token;
 * 失败:refreshToken 也已失效 → 返回 null,由 api-client 失败冷却兜底,调用方按登录过期处理。
 * 响应落地时若本地会话已结束(代次已推进),同样返回 null,由调用方按登录过期处理。
 */
async function refreshAccessToken(): Promise<string | null> {
  const epochAtStart = sessionEpoch
  const storedRefresh = memoryStore.getRefreshToken()
  const res = await fetchApi<{ accessToken: string; refreshToken?: string | null }>(
    '/auth/refresh',
    {
      method: 'POST',
      body: JSON.stringify(storedRefresh ? { refreshToken: storedRefresh } : {}),
    },
  )
  if (!res.success || !res.data?.accessToken) return null
  const accessToken = res.data.accessToken
  const rotatedRefresh = res.data.refreshToken
  return serializeCredentialWrite(async () => {
    if (sessionEpoch !== epochAtStart) return null
    await memoryStore.setToken(accessToken)
    if (rotatedRefresh) await memoryStore.setRefreshToken(rotatedRefresh)
    return accessToken
  })
}

/**
 * 会话彻底失效的出口注册在 **`RootNavigator.tsx`**,不在本文件(2026-09-27 真机定案)。
 *
 * 两条理由,都值得留在这里,因为下一个接手者第一反应就是"注册口在 initApi 里,出口也该在这":
 * 1. `Login` 屏**只在未登录分支注册**(RootNavigator 的 `token ? … : …`)。带着 token 时
 *    `navigate('Login')` 结构上是空操作 —— 出路只能是**结束本地会话**让导航树自己翻过去。
 *    (实测:VC50 出口被调用、logcat 点名了来源请求,画面纹丝不动,就是这个原因。)
 * 2. `stores/auth-store.ts` 反向 import 本模块的 `tokenStore`,在这里 import 它就是模块环
 *    (auth-store 的 `createAuthStore(...)` 在模块求值期读 tokenStore,环一旦成立就是 TDZ)。
 *
 * 本文件只负责把处理器接进 api-client 所需的凭据面;`setUnauthorizedHandler` 的调用点
 * 由守门 148(check-auth-handler-registration-parity)按**代码面**判,注释不算。
 */

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
  setDeviceFingerprintProvider(mobileRnDeviceFingerprintCollector)
}

export function getToken(): string | null {
  return memoryStore.getToken()
}

export function getRefreshToken(): string | null {
  return memoryStore.getRefreshToken()
}

/**
 * 显式写入凭据 = 新一轮会话开始:推进代次,让上一轮在途的续期响应作废,
 * 再串行落盘(与 refreshAccessToken 的写入同一条链,不与登出清除交叉)。
 */
export async function setToken(token: string | null): Promise<void> {
  sessionEpoch += 1
  await serializeCredentialWrite(async () => {
    await memoryStore.setToken(token)
  })
}

export async function setRefreshToken(token: string | null): Promise<void> {
  sessionEpoch += 1
  await serializeCredentialWrite(async () => {
    await memoryStore.setRefreshToken(token)
  })
}

/**
 * 结束本地会话:代次**同步**推进(此刻起任何在途续期都不再有权写回),
 * 再串行清除存储 —— 排队在它之前的写入先完成,删除始终落在最后。
 */
export async function clearToken(): Promise<void> {
  sessionEpoch += 1
  await serializeCredentialWrite(async () => {
    await memoryStore.clearAll()
  })
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
