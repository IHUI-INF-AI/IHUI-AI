// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * mobile-rn 凭据持久化存储(实现 @ihui/shared/hooks CredentialStorage 接口)
 *
 * 存储分层(2026-09-28 收口,承票 #27):
 * - `ihui-remember-credentials`(AsyncStorage):**只放账号**。
 * - `ihui-remember-password`(SecureStore / Keychain / Keystore):密码。
 * - `ihui-auto-login`:'1' | '0' —— 布尔事实,不是凭据,留在 AsyncStorage
 *   (理由与登出标记同一条:见 `src/lib/token.ts` 的"为什么落 AsyncStorage 而不是 secure-store")。
 * - `ihui-login-history`:string[](最多 5 个,不含密码)
 *
 * 为什么密码不能再留在 AsyncStorage:那层是应用私有目录里的**明文文件**,root 设备、
 * `adb backup`、云备份恢复都能直接读到 —— "记住密码"于是等于把口令长期抄送一份给设备存储。
 * 而自动登录的凭据源正是这条记录,所以这不是"少加个密"的观感问题,是凭据链最底下一格。
 *
 * 失效方向(刻意):SecureStore 不可用时(测试 / 模拟器 / RN-web)**不降级存明文**,
 * 而是本轮内存可用、跨进程不持久 —— 宁可不记密码,也不把它落到读得到的地方。
 * 旧版留在 AsyncStorage 里的明文记录在 hydrate 时被**迁移并抹掉**,不是"新写入才安全"。
 *
 * 同步缓存策略(未变):CredentialStorage 接口要求同步返回,故模块级内存缓存 + 异步持久化;
 * 模块加载时 fire-and-forget hydrate(LoginScreen 在 ready=true 之后才挂载,时序充足)。
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { CredentialStorage, RememberedCredentials } from '@ihui/shared/hooks'
import { deleteSecureItem, getSecureItem, isSecureBackendEncrypted, setSecureItem } from './auth/secure-store'

const CREDENTIALS_KEY = 'ihui-remember-credentials'
const PASSWORD_KEY = 'ihui-remember-password'
const AUTO_LOGIN_KEY = 'ihui-auto-login'
const HISTORY_KEY = 'ihui-login-history'
const MAX_HISTORY = 5

// 模块级同步缓存(供 loadRemembered/loadAutoLogin/loadLoginHistory 同步读取)
let cachedRemembered: RememberedCredentials | null = null
let cachedAutoLogin = false
let cachedHistory: string[] = []

// 模块加载时 hydrate(LoginScreen 挂载前有时序窗口:JS bundle → initApi → ready=true)
void hydrate()

async function hydrate(): Promise<void> {
  try {
    const [credRaw, autoRaw, historyRaw] = await Promise.all([
      AsyncStorage.getItem(CREDENTIALS_KEY),
      AsyncStorage.getItem(AUTO_LOGIN_KEY),
      AsyncStorage.getItem(HISTORY_KEY),
    ])
    let account: string | null = null
    let legacyPassword: string | null = null
    if (credRaw) {
      const parsed = JSON.parse(credRaw) as Partial<RememberedCredentials>
      if (typeof parsed.account === 'string' && parsed.account) account = parsed.account
      // 旧版(以及任何被回滚的写入)把密码和账号写在同一条明文记录里 ⇒ 读出来只为迁移掉
      if (typeof parsed.password === 'string' && parsed.password) legacyPassword = parsed.password
    }
    const storedPassword = await getSecureItem(PASSWORD_KEY)
    const password = storedPassword ?? legacyPassword
    if (account && password) {
      cachedRemembered = { account, password }
    } else {
      cachedRemembered = null
    }
    // 把盘上那份明文抹掉:账号留 AsyncStorage,密码只留 Keychain(没有就不留)
    if (legacyPassword || !storedPassword) {
      await persistAccount(account)
      if (legacyPassword) {
        if (await isSecureBackendEncrypted()) await setSecureItem(PASSWORD_KEY, legacyPassword)
        else await deleteSecureItem(PASSWORD_KEY)
      }
    }
    cachedAutoLogin = autoRaw === '1'
    if (historyRaw) {
      const parsed = JSON.parse(historyRaw) as unknown
      if (Array.isArray(parsed)) {
        cachedHistory = parsed.filter((a): a is string => typeof a === 'string' && a.length > 0)
      }
    }
  } catch {
    // AsyncStorage 不可用时静默失败,保持默认空值
  }
}

/** 账号记录:只可能含 account,永远不含 password —— 这条是本票的判据对象。 */
async function persistAccount(account: string | null): Promise<void> {
  if (account) await AsyncStorage.setItem(CREDENTIALS_KEY, JSON.stringify({ account }))
  else await AsyncStorage.removeItem(CREDENTIALS_KEY)
}

function persist(key: string, value: string | null): void {
  if (value === null) {
    void AsyncStorage.removeItem(key)
  } else {
    void AsyncStorage.setItem(key, value)
  }
}

export const credentialStorage: CredentialStorage = {
  loadRemembered: () => cachedRemembered,

  saveRemembered: (account, password) => {
    cachedRemembered = { account, password }
    void (async () => {
      await persistAccount(account)
      // 后端不加密 ⇒ 本轮内存里有密码可用,但**不跨进程持久化**(宁可不记,也不写明文)
      if (await isSecureBackendEncrypted()) await setSecureItem(PASSWORD_KEY, password)
    })()
  },

  clearRemembered: () => {
    cachedRemembered = null
    void AsyncStorage.removeItem(CREDENTIALS_KEY)
    void deleteSecureItem(PASSWORD_KEY)
  },

  loadAutoLogin: () => cachedAutoLogin,

  saveAutoLogin: (enabled) => {
    cachedAutoLogin = enabled
    persist(AUTO_LOGIN_KEY, enabled ? '1' : '0')
  },

  clearAutoLogin: () => {
    cachedAutoLogin = false
    persist(AUTO_LOGIN_KEY, null)
  },

  saveLoginHistory: (account) => {
    // 同步更新缓存(下拉立即生效)+ 异步持久化(hook 仅在登录成功后调用一次,无并发风险)
    cachedHistory = [account, ...cachedHistory.filter((a) => a !== account)].slice(0, MAX_HISTORY)
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(HISTORY_KEY)
        const list: string[] = raw ? (JSON.parse(raw) as string[]) : []
        const filtered = list.filter((a) => a !== account)
        filtered.unshift(account)
        await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(filtered.slice(0, MAX_HISTORY)))
      } catch {
        // 静默失败
      }
    })()
  },

  loadLoginHistory: () => cachedHistory,

  removeFromLoginHistory: (account) => {
    // 同步更新缓存(下拉立即生效)+ 异步持久化
    cachedHistory = cachedHistory.filter((a) => a !== account)
    void AsyncStorage.getItem(HISTORY_KEY)
      .then((raw) => {
        const list: string[] = raw ? (JSON.parse(raw) as string[]) : []
        return AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(list.filter((a) => a !== account)))
      })
      .catch(() => {
        // 静默失败
      })
    return cachedHistory
  },

  clearLoginHistory: () => {
    cachedHistory = []
    void AsyncStorage.removeItem(HISTORY_KEY).catch(() => {
      // 静默失败
    })
    return cachedHistory
  },
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
