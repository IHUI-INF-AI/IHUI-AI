/**
 * mobile-rn 凭据持久化存储(实现 @ihui/shared/hooks CredentialStorage 接口)
 *
 * 存储格式:JSON → AsyncStorage
 * - ihui-remember-credentials: { account, password }
 * - ihui-auto-login: '1' | '0'
 * - ihui-login-history: string[](最多 5 个,不含密码)
 *
 * 同步缓存策略:
 * AsyncStorage 是异步 API,但 CredentialStorage 接口要求同步返回(loadRemembered/loadAutoLogin)。
 * 因此用模块级内存缓存 + 异步持久化:
 * - 模块加载时 fire-and-forget hydrate 缓存(LoginScreen 在 ready=true 后才挂载,时序充足)
 * - load 方法同步读缓存
 * - save/clear 方法同步更新缓存 + 异步写 AsyncStorage(fire-and-forget)
 *
 * 与 web 端 remember-credentials.ts 对齐(同 key 同格式),便于跨端一致性。
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { CredentialStorage, RememberedCredentials } from '@ihui/shared/hooks'

const CREDENTIALS_KEY = 'ihui-remember-credentials'
const AUTO_LOGIN_KEY = 'ihui-auto-login'
const HISTORY_KEY = 'ihui-login-history'
const MAX_HISTORY = 5

// 模块级同步缓存(供 loadRemembered/loadAutoLogin 同步读取)
let cachedRemembered: RememberedCredentials | null = null
let cachedAutoLogin = false

// 模块加载时 hydrate(LoginScreen 挂载前有时序窗口:JS bundle → initApi → ready=true)
void hydrate()

async function hydrate(): Promise<void> {
  try {
    const [credRaw, autoRaw] = await Promise.all([
      AsyncStorage.getItem(CREDENTIALS_KEY),
      AsyncStorage.getItem(AUTO_LOGIN_KEY),
    ])
    if (credRaw) {
      const parsed = JSON.parse(credRaw) as Partial<RememberedCredentials>
      if (parsed.account && parsed.password) {
        cachedRemembered = { account: parsed.account, password: parsed.password }
      }
    }
    cachedAutoLogin = autoRaw === '1'
  } catch {
    // AsyncStorage 不可用时静默失败,保持默认空值
  }
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
    persist(CREDENTIALS_KEY, JSON.stringify({ account, password }))
  },

  clearRemembered: () => {
    cachedRemembered = null
    persist(CREDENTIALS_KEY, null)
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
    // AsyncStorage 异步读-改-写(hook 仅在登录成功后调用一次,无并发风险)
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
}
