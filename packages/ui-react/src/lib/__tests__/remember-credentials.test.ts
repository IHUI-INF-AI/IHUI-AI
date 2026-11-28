// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 记住账号 / 加密口令 / 账号历史 / 自动登录的落盘行为锁。
 *
 * 契约:
 *  ① "记住账号"那把 key 结构上永远不含口令;
 *  ② 历史 base64 形态(可能带口令)读到后必须就地改写成只含账号的 JSON;
 *  ③ 口令只进 AES-GCM 保险箱(localStorage 仅有 iv/data 密文),换号不回吐;
 *  ④ 历史明文 `ihui-remember-password` 首次读取时迁移到保险箱并删除。
 *
 * 测试用内存 IndexedDB 承载非导出 CryptoKey,真实走 WebCrypto 加解密。
 */
import { LOGIN_HISTORY_MAX } from '@ihui/shared/constants/storage-keys'
import { webcrypto } from 'node:crypto'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  clearAutoLogin,
  clearLoginHistory,
  clearRememberedCredentials,
  getRememberedPasswordForAccount,
  hasRememberedPasswordForAccount,
  loadAutoLogin,
  loadLoginHistory,
  loadRememberedCredentials,
  loadRememberedCredentialsWithPassword,
  removeFromLoginHistory,
  saveAutoLogin,
  saveLoginHistory,
  saveRememberedCredentials,
  saveRememberedCredentialsWithPassword,
} from '../remember-credentials'

const ACCOUNT_KEY = 'ihui-remember-credentials'
const LEGACY_PASSWORD_KEY = 'ihui-remember-password'
const PASSWORD_V2_KEY = 'ihui-remember-password-v2'
const AUTO_LOGIN_KEY = 'ihui-auto-login'
const HISTORY_KEY = 'ihui-login-history'

/** 历史传输形态:`btoa(unescape(encodeURIComponent(text)))` 的等价实现。 */
function legacyTransport(text: string): string {
  const binary = String.fromCharCode(...new TextEncoder().encode(text))
  return btoa(binary)
}

/**
 * 最小内存 IndexedDB 适配器,只覆盖 remembered-password-vault 用到的 API:
 * open / onupgradeneeded / transaction / objectStore.get/put / oncomplete。
 */
function createMemoryIndexedDb() {
  const stores = new Map<string, Map<string, unknown>>()

  const request = (work: () => unknown): any => {
    const req: any = { result: undefined, error: null, onsuccess: null, onerror: null }
    queueMicrotask(() => {
      try {
        req.result = work()
        req.onsuccess?.()
      } catch (error) {
        req.error = error
        req.onerror?.()
      }
    })
    return req
  }

  const makeDb = (): any => ({
    objectStoreNames: {
      contains: (name: string) => stores.has(name),
    },
    createObjectStore: (name: string) => {
      stores.set(name, new Map())
    },
    close: () => undefined,
    transaction: (name: string) => {
      const map = stores.get(name)
      if (!map) throw new Error(`missing object store: ${name}`)
      const tx: any = { oncomplete: null, onerror: null, error: null }
      tx.objectStore = () => ({
        get: (key: string) => request(() => map.get(key)),
        put: (value: unknown, key: string) => {
          const req = request(() => {
            map.set(key, value)
          })
          queueMicrotask(() => tx.oncomplete?.())
          return req
        },
      })
      return tx
    },
  })

  return {
    reset: () => stores.clear(),
    open: () => {
      const req: any = {
        result: undefined,
        error: null,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      }
      queueMicrotask(() => {
        req.result = makeDb()
        req.onupgradeneeded?.()
        req.onsuccess?.()
      })
      return req
    },
  }
}

const memoryIndexedDb = createMemoryIndexedDb()
Object.defineProperty(globalThis, 'indexedDB', {
  value: memoryIndexedDb,
  configurable: true,
})
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
  })
}

beforeEach(() => {
  localStorage.clear()
  memoryIndexedDb.reset()
})

describe('记住账号:盘上永不含口令', () => {
  it('saveRememberedCredentials 只写账号,传进来的口令被丢弃', () => {
    saveRememberedCredentials('alice@example.com', 'hunter2')
    const raw = localStorage.getItem(ACCOUNT_KEY)
    expect(raw).toBe(JSON.stringify({ account: 'alice@example.com' }))
    expect(raw).not.toContain('hunter2')
    expect(localStorage.getItem(LEGACY_PASSWORD_KEY)).toBeNull()
    expect(localStorage.getItem(PASSWORD_V2_KEY)).toBeNull()
  })

  it('登录成功但"未勾选记住密码"会清掉上一账号残留的加密口令', async () => {
    await saveRememberedCredentialsWithPassword('alice@example.com', 'hunter2')
    expect(localStorage.getItem(PASSWORD_V2_KEY)).not.toBeNull()
    saveRememberedCredentials('alice@example.com', 'hunter2')
    expect(localStorage.getItem(PASSWORD_V2_KEY)).toBeNull()
    await expect(getRememberedPasswordForAccount('alice@example.com')).resolves.toBe('')
  })

  it('同步读账号永远不带口令,口令走异步保险箱', async () => {
    await saveRememberedCredentialsWithPassword('alice@example.com', 'hunter2')
    expect(loadRememberedCredentials({ keepPassword: true })).toEqual({
      account: 'alice@example.com',
      password: '',
    })
    await expect(loadRememberedCredentialsWithPassword()).resolves.toEqual({
      account: 'alice@example.com',
      password: 'hunter2',
    })
  })

  it('换号后不回吐上一个账号的口令(密文 account 不匹配即空)', async () => {
    await saveRememberedCredentialsWithPassword('alice@example.com', 'hunter2')
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ account: 'bob@example.com' }))
    await expect(loadRememberedCredentialsWithPassword()).resolves.toEqual({
      account: 'bob@example.com',
      password: '',
    })
  })

  it('按账号即时取口令:账号匹配才回吐,前后空格不影响,换号即空', async () => {
    await saveRememberedCredentialsWithPassword('alice@example.com', 'hunter2')
    await expect(getRememberedPasswordForAccount('alice@example.com')).resolves.toBe('hunter2')
    await expect(getRememberedPasswordForAccount(' alice@example.com ')).resolves.toBe('hunter2')
    await expect(getRememberedPasswordForAccount('bob@example.com')).resolves.toBe('')
    expect(hasRememberedPasswordForAccount('alice@example.com')).toBe(true)
    expect(hasRememberedPasswordForAccount('bob@example.com')).toBe(false)
  })

  it('密文损坏时返回空串而不是抛出,并清掉坏记录', async () => {
    await saveRememberedCredentialsWithPassword('alice@example.com', 'hunter2')
    localStorage.setItem(PASSWORD_V2_KEY, '{not json')
    await expect(getRememberedPasswordForAccount('alice@example.com')).resolves.toBe('')
    expect(localStorage.getItem(PASSWORD_V2_KEY)).toBeNull()
  })

  it('密文只含 iv/data,不含明文口令', async () => {
    await saveRememberedCredentialsWithPassword('alice@example.com', 'hunter2')
    const raw = localStorage.getItem(PASSWORD_V2_KEY) ?? ''
    expect(raw).not.toContain('hunter2')
    const parsed = JSON.parse(raw)
    expect(parsed).toMatchObject({ v: 2, account: 'alice@example.com' })
    expect(typeof parsed.iv).toBe('string')
    expect(typeof parsed.data).toBe('string')
  })
})

describe('历史明文口令迁移(读到即加密并删除明文)', () => {
  it('旧 ihui-remember-password 首次读取后:明文消失,密文出现,口令仍可回填', async () => {
    localStorage.setItem(
      LEGACY_PASSWORD_KEY,
      JSON.stringify({ account: 'alice@example.com', password: 'hunter2' }),
    )
    await expect(getRememberedPasswordForAccount('alice@example.com')).resolves.toBe('hunter2')
    expect(localStorage.getItem(LEGACY_PASSWORD_KEY)).toBeNull()
    expect(localStorage.getItem(PASSWORD_V2_KEY)).not.toBeNull()
    await expect(getRememberedPasswordForAccount('alice@example.com')).resolves.toBe('hunter2')
  })

  it('旧明文属于别的账号时删除且不回吐', async () => {
    localStorage.setItem(
      LEGACY_PASSWORD_KEY,
      JSON.stringify({ account: 'bob@example.com', password: 'other' }),
    )
    await expect(getRememberedPasswordForAccount('alice@example.com')).resolves.toBe('')
    expect(localStorage.getItem(LEGACY_PASSWORD_KEY)).toBeNull()
  })
})

describe('历史传输形态迁移(读到即改写)', () => {
  it('旧 base64 记录读到后:账号保留,盘上被就地改写成 JSON 且口令消失', () => {
    localStorage.setItem(
      ACCOUNT_KEY,
      legacyTransport(JSON.stringify({ account: 'alice@example.com', password: 'hunter2' })),
    )
    expect(loadRememberedCredentials({ keepPassword: true })).toEqual({
      account: 'alice@example.com',
      password: '',
    })
    const migrated = localStorage.getItem(ACCOUNT_KEY)
    expect(migrated).toBe(JSON.stringify({ account: 'alice@example.com' }))
    expect(migrated).not.toContain('hunter2')
    expect(localStorage.getItem(LEGACY_PASSWORD_KEY)).toBeNull()
    expect(localStorage.getItem(PASSWORD_V2_KEY)).toBeNull()
  })

  it('新传输里若残留 password 字段,同样被就地抹成"只含账号"', () => {
    localStorage.setItem(
      ACCOUNT_KEY,
      JSON.stringify({ account: 'alice@example.com', password: 'hunter2' }),
    )
    expect(loadRememberedCredentials()?.account).toBe('alice@example.com')
    expect(localStorage.getItem(ACCOUNT_KEY)).toBe(JSON.stringify({ account: 'alice@example.com' }))
  })

  it('解不出的垃圾记录:删除该 key 并返回 null(可能含口令 ⇒ 删除是唯一安全方向)', () => {
    localStorage.setItem(ACCOUNT_KEY, '%%%not-base64%%%')
    expect(loadRememberedCredentials()).toBeNull()
    expect(localStorage.getItem(ACCOUNT_KEY)).toBeNull()
  })

  it('从未记住过时返回 null 且不写任何 key', () => {
    expect(loadRememberedCredentials()).toBeNull()
    expect(localStorage.getItem(ACCOUNT_KEY)).toBeNull()
  })

  it('clearRememberedCredentials 清账号与口令,不碰账号历史', async () => {
    await saveRememberedCredentialsWithPassword('alice@example.com', 'x')
    saveLoginHistory('alice@example.com')
    clearRememberedCredentials()
    expect(localStorage.getItem(ACCOUNT_KEY)).toBeNull()
    expect(localStorage.getItem(PASSWORD_V2_KEY)).toBeNull()
    expect(loadLoginHistory()).toEqual(['alice@example.com'])
  })
})

describe('自动登录开关', () => {
  it('只有落盘值为 1 才算开;缺省/其它值一律读成关', () => {
    expect(loadAutoLogin()).toBe(false)
    saveAutoLogin(true)
    expect(localStorage.getItem(AUTO_LOGIN_KEY)).toBe('1')
    expect(loadAutoLogin()).toBe(true)
    saveAutoLogin(false)
    expect(localStorage.getItem(AUTO_LOGIN_KEY)).toBe('0')
    expect(loadAutoLogin()).toBe(false)
    localStorage.setItem(AUTO_LOGIN_KEY, 'yes')
    expect(loadAutoLogin()).toBe(false)
  })

  it('clearAutoLogin 清掉开关', () => {
    saveAutoLogin(true)
    clearAutoLogin()
    expect(localStorage.getItem(AUTO_LOGIN_KEY)).toBeNull()
    expect(loadAutoLogin()).toBe(false)
  })
})

describe('账号历史:去重 → 置顶 → 截断', () => {
  it('新账号置顶,重复账号不产生第二条', () => {
    saveLoginHistory('a@example.com')
    saveLoginHistory('b@example.com')
    saveLoginHistory('a@example.com')
    expect(loadLoginHistory()).toEqual(['a@example.com', 'b@example.com'])
  })

  it('上限取共享常量,超出后最老的被挤出(不写第二份字面量)', () => {
    for (let i = 0; i < LOGIN_HISTORY_MAX + 3; i += 1) saveLoginHistory(`u${i}@example.com`)
    const list = loadLoginHistory()
    expect(list).toHaveLength(LOGIN_HISTORY_MAX)
    expect(list[0]).toBe(`u${LOGIN_HISTORY_MAX + 2}@example.com`)
    expect(list).not.toContain('u0@example.com')
  })

  it('历史 base64 传输仍可读(旧版本写的是 base64 的数组)', () => {
    localStorage.setItem(
      HISTORY_KEY,
      legacyTransport(JSON.stringify(['a@example.com', 'b@example.com'])),
    )
    expect(loadLoginHistory()).toEqual(['a@example.com', 'b@example.com'])
  })

  it('损坏的历史读成空数组而不是抛', () => {
    localStorage.setItem(HISTORY_KEY, '{broken')
    expect(loadLoginHistory()).toEqual([])
  })

  it('removeFromLoginHistory 删除单个账号并回写', () => {
    saveLoginHistory('a@example.com')
    saveLoginHistory('b@example.com')
    expect(removeFromLoginHistory('a@example.com')).toEqual(['b@example.com'])
    expect(loadLoginHistory()).toEqual(['b@example.com'])
  })

  it('clearLoginHistory 清空并返回空数组', () => {
    saveLoginHistory('a@example.com')
    expect(clearLoginHistory()).toEqual([])
    expect(loadLoginHistory()).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
