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
import { fetchApi, setBaseUrl, setDeviceFingerprintProvider, setUserAgent } from '@ihui/api-client'
import AsyncStorage from '@react-native-async-storage/async-storage'
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
 * 显式登出 / 会话失效的**持久**标记(2026-09-27 立,冷启动静默重登那一格的前置条件)。
 *
 * 实测到的链(不是假想):
 * - 登出清的是「凭据」:`logoutAuth()` / `AuthContext.logout()` → 共享工厂 `logout()` →
 *   `tokenStore.clearAll()` → 本文件 `clearToken()` → SecureStore 两个 key 删除
 *   (`src/lib/auth/secure-store.ts:103`)。这条链已由 `auth-single-credential-source.test.ts`
 *   第 3 例钉住(登出 → 冷启动 hydrate → token 为空)。
 * - 但冷启动落回登录页之后,`src/screens/LoginScreen.tsx:413-420` 的挂载 effect 会读
 *   `credentialStorage.loadAutoLogin()` 与 `loadRemembered()`(`src/lib/credential-storage.ts:25-27`,
 *   AsyncStorage 里的 `ihui-auto-login` + `ihui-remember-credentials` = 账号+密码明文),
 *   两者都在就 `form.login()` **静默重新登录** → 写回新 token → 回到已登录分支。
 *   全仓没有任何登出路径清这两个 key(`packages/shared/src/hooks/use-login-form.ts:226-240`
 *   只在"取消记住密码"时清),所以"显式登出"对自动登录**没有任何效力**。
 * - 上面那条链的**判据**住在 `LoginScreen`,本票的受影响文件清单不含该屏(见交付报告),
 *   所以本文件只交付"标记 + 生命周期 + 唯一判据出口"这一半;消费点接上之前,
 *   `tests/auth-cold-start-after-logout.test.ts` 末例会如实点名"标记尚未被咨询"。
 *
 * 为什么必须是**持久**标记而不是内存位:要防的正是"进程重启后"的行为,内存状态在冷启动时
 * 一定是空的(与 `sessionEpoch` 同一条局限 —— 代次只在同一进程内能否决在途写入)。
 *
 * 为什么落 AsyncStorage 而不是 secure-store(凭据那一层):
 * 1. 它不是凭据,是个布尔事实,进 Keychain 会把"凭据"语义混进非敏感状态;
 * 2. 它必须**活得比凭据久** —— 若与凭据同层同删除路径,`clearAll` 会把标记一起删掉,
 *    等于自己否决自己;
 * 3. 它要管的东西(自动登录开关 + 记住的账密)本来就在 AsyncStorage(`credential-storage.ts`),
 *    同一持久层才有同寿命,不会因为 Keychain 单独被清(换机/备份恢复)而静默失效。
 *
 * 失效方向(刻意的):写入标记排在删除凭据**之前**(同一串行链内)。两步之间进程被杀的后果是
 * "标记在、凭据可能还在"⇒ 自动登录被抑制(保守);反过来先删凭据再落标记则可能留下
 * "凭据没了、下次冷启动仍静默重登"的原缺陷。读取失败时**不**抑制(见 `readLogoutMarker`),
 * 因为那会把"存储抖动"变成"用户的自动登录悄悄没了"—— 与本仓"不得静默降级"的禁令相反。
 */
const SESSION_LOGGED_OUT_KEY = 'ihui-session-logged-out'

/** 进程内镜像:`clearToken()` 同步置位,不等 AsyncStorage;冷启动由 `initApi()` 从盘回填。 */
let sessionLoggedOut = false

/**
 * 落盘标记(值 = 结束会话时那一轮的代次,只为可诊断,判据只看存在性)。
 * 日志文案走 ASCII:本端 `src/**` 的硬编码中文按文件对基线棘轮(守门 70),
 * 注释不计、字符串计 —— 诊断行写成英文既不丢信息,也不会让本文件凭空多 6 处新增红。
 */
async function writeLogoutMarker(epoch: number): Promise<void> {
  try {
    await AsyncStorage.setItem(SESSION_LOGGED_OUT_KEY, String(epoch))
  } catch (e) {
    console.warn(
      `[rn-auth] failed to persist logout marker (in-memory bit is already set, so auto-login ` +
        `stays suppressed for this process; a cold restart may lose it): ${
          e instanceof Error ? e.message : 'unknown error'
        }`,
    )
  }
}

async function eraseLogoutMarker(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SESSION_LOGGED_OUT_KEY)
  } catch (e) {
    console.warn(
      `[rn-auth] failed to clear logout marker (new session is active in memory, but a cold ` +
        `restart may still suppress auto-login): ${e instanceof Error ? e.message : 'unknown error'}`,
    )
  }
}

/**
 * 冷启动读标记。读不到就判"未登出"并喊出来:
 * 抑制自动登录是**改变用户可见行为**的动作,不能由一次存储抖动触发;
 * 而存储抖动同样意味着上一步的凭据删除未必成功,那属于另一格问题,不在这里顺手解决。
 */
async function readLogoutMarker(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(SESSION_LOGGED_OUT_KEY)) !== null
  } catch (e) {
    console.warn(
      `[rn-auth] failed to read logout marker, treating session as NOT logged out ` +
        `(auto-login stays enabled): ${e instanceof Error ? e.message : 'unknown error'}`,
    )
    return false
  }
}

/**
 * 会话是否被显式结束(登出 / 会话失效)且此后没有新的凭据写入。
 *
 * 唯一判据出口。消费点:`LoginScreen` 挂载时的自动登录 effect ——
 * 加在 `credentialStorage.loadAutoLogin() && credentialStorage.loadRemembered()` 之前即可,
 * 本文件不代替那一屏决定"要不要静默重登"(它还得看勾选项与记住的账密)。
 */
export function isSessionLoggedOut(): boolean {
  return sessionLoggedOut
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
  // 登出标记必须先于 ready 就位:RootNavigator 要等 initApi() 落定才渲染分支,
  // 而 LoginScreen 的自动登录 effect 就在这一帧里 —— 顺序错了就等于每次都按内存默认值判。
  sessionLoggedOut = await readLogoutMarker()
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
 *
 * 登出标记与代次同点翻转:写入非空 access token ⇒ 会话重新开始 ⇒ 标记清除
 * (手动登录 / SSO 回跳 / 运营商一键登录全部经这条路,所以"记住登录"不被误伤);
 * 写入 null 等价于结束会话 ⇒ 与 `clearToken()` 同处置。
 * 注意 `refreshAccessToken()` 走 `memoryStore.setToken`,不经本函数 —— 续期不是"新会话",
 * 而登出之后的续期在代次守卫上就已经写不进来,不需要在这里再翻一次标记。
 */
export async function setToken(token: string | null): Promise<void> {
  sessionEpoch += 1
  sessionLoggedOut = token === null
  await serializeCredentialWrite(async () => {
    if (token === null) await writeLogoutMarker(sessionEpoch)
    else await eraseLogoutMarker()
    await memoryStore.setToken(token)
  })
}

export async function setRefreshToken(token: string | null): Promise<void> {
  sessionEpoch += 1
  // 只在新凭据到达时清标记;置 null 不在此列 —— 共享工厂的 setAuth 会先写 access token
  // 再写 refreshToken(可为 null),把"refreshToken 为空"读成"会话结束"会误清登录态。
  if (token) sessionLoggedOut = false
  await serializeCredentialWrite(async () => {
    if (token) await eraseLogoutMarker()
    await memoryStore.setRefreshToken(token)
  })
}

/**
 * 结束本地会话:代次**同步**推进(此刻起任何在途续期都不再有权写回),
 * 登出标记同样**同步**置位(内存先生效),再串行落盘 —— 排队在它之前的写入先完成,
 * 删除始终落在最后。
 */
export async function clearToken(): Promise<void> {
  sessionEpoch += 1
  sessionLoggedOut = true
  await serializeCredentialWrite(async () => {
    // 标记先于凭据删除落盘(失效方向见 SESSION_LOGGED_OUT_KEY 上方注释)
    await writeLogoutMarker(sessionEpoch)
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
