// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票 #27 第二端(miniapp-taro)的常驻锁:记住的凭据**永远不得**把口令落进 Taro storage。
 *
 * 病灶(旧版,见 `src/lib/credential-storage.ts` 头注自述):`{account, password}` 被
 * `JSON.stringify` 直写 Taro storage —— 微信/支付宝给小程序的 storage 是应用沙箱里的
 * 明文文件(备份/ROOT 场景可直接读出),本端又没有 Keychain 级安全存储原语,
 * "给它加密"这个选项结构上不存在(密钥同样要落在这块存储里)。
 * 收口 = 不再持久化口令:自动登录由 refreshToken 续期承担
 * (`src/utils/auth.ts` 的 `refreshAccessToken()`,经 `app.tsx` 的
 * `bindTokenStoreToApiClient(tokenStore, { refreshAccessToken })` 挂在 401 拦截器上)。
 *
 * 三条必须同时成立,缺任一条就是"把明文挪了个地方"而非"不再落明文":
 *  ① 新写入:那条记录**只有 account 字段**,读回的 password 恒为空串;
 *  ② 旧数据:带口令的明文记录在读取时被**就地抹掉**并保留账号
 *     ("记住账号"支撑登录页历史下拉,删了是功能倒退;删掉的只有口令那一半);
 *  ③ 单一真相:记录形态走 `@ihui/shared/auth/remembered-account`、key 名走
 *     `@ihui/shared/constants`,端内不得再抄规则或字面量。
 * 有牙证明:阳性对照先把旧形态(记录含 password)喂**同一判据** ⇒ 必须被认出并抹掉。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { taroStorage } = vi.hoisted(() => ({ taroStorage: new Map<string, unknown>() }))

vi.mock('@tarojs/taro', () => ({
  default: {},
  getStorageSync: (key: string) => taroStorage.get(key) ?? '',
  setStorageSync: (key: string, value: unknown) => {
    taroStorage.set(key, value)
  },
  removeStorageSync: (key: string) => {
    taroStorage.delete(key)
  },
}))

import { credentialStorage } from '@/lib/credential-storage'
import {
  AUTO_LOGIN_STORAGE_KEY,
  LOGIN_HISTORY_STORAGE_KEY,
  REMEMBERED_ACCOUNT_STORAGE_KEY,
} from '@ihui/shared/constants'

const SECRET = 'S3cret!pw'

/** 全量盘面文本 —— "任何一次写入都不得带上口令"用它判,而不是只看目标那一档。 */
function allStoredText(): string {
  return [...taroStorage.entries()].map(([k, v]) => `${k}=${String(v)}`).join('\n')
}

beforeEach(() => {
  taroStorage.clear()
})

describe('key 名与跨端唯一真相一致(端内不得另起字面量)', () => {
  it('小程序三把 key 与 @ihui/shared/constants 同值,沿用历史名以读到存量记录', () => {
    expect(REMEMBERED_ACCOUNT_STORAGE_KEY).toBe('ihui-remember-credentials')
    expect(AUTO_LOGIN_STORAGE_KEY).toBe('ihui-auto-login')
    expect(LOGIN_HISTORY_STORAGE_KEY).toBe('ihui-login-history')
  })
})

describe('记住的口令不得落明文', () => {
  it('① 新写入:记录只有 account 字段;读回的 password 恒为空串;清除删得净', () => {
    credentialStorage.saveRemembered('tester@example.com', SECRET)

    const raw = taroStorage.get(REMEMBERED_ACCOUNT_STORAGE_KEY)
    expect(raw, '账号记录应仍在 storage').toBeTruthy()
    expect(Object.keys(JSON.parse(String(raw)) as Record<string, unknown>)).toEqual(['account'])
    expect(allStoredText()).not.toContain(SECRET)
    expect(credentialStorage.loadRemembered()).toEqual({ account: 'tester@example.com', password: '' })

    credentialStorage.clearRemembered()
    expect(taroStorage.has(REMEMBERED_ACCOUNT_STORAGE_KEY)).toBe(false)
    expect(credentialStorage.loadRemembered()).toBeNull()
  })

  it('② 旧明文记录(带 password 的 JSON):读取时就地抹掉口令,账号保留', () => {
    taroStorage.set(
      REMEMBERED_ACCOUNT_STORAGE_KEY,
      JSON.stringify({ account: 'legacy@example.com', password: SECRET }),
    )

    expect(credentialStorage.loadRemembered()).toEqual({ account: 'legacy@example.com', password: '' })

    const raw = String(taroStorage.get(REMEMBERED_ACCOUNT_STORAGE_KEY))
    expect(raw, '记录不得被删空(记住账号是功能面)').toBeTruthy()
    expect(raw).not.toContain(SECRET)
    expect(JSON.parse(raw)).toEqual({ account: 'legacy@example.com' })
  })

  it('③ 反向对照:自动登录标志与账号历史下拉的数据源不得被收口改坏', () => {
    credentialStorage.saveAutoLogin(true)
    expect(credentialStorage.loadAutoLogin()).toBe(true)

    credentialStorage.saveLoginHistory('user-a')
    credentialStorage.saveLoginHistory('user-b')
    credentialStorage.saveLoginHistory('user-a') // 去重置顶(共享 pushLoginHistory 规则)
    expect(credentialStorage.loadLoginHistory()).toEqual(['user-a', 'user-b'])
    expect(credentialStorage.removeFromLoginHistory?.('user-b')).toEqual(['user-a'])
    expect(credentialStorage.clearLoginHistory?.()).toEqual([])

    credentialStorage.clearAutoLogin()
    expect(credentialStorage.loadAutoLogin()).toBe(false)
  })
})

describe('有牙证明', () => {
  it('阳性对照:旧形态(记录含 password)被同一判据认出并抹掉;新写入结构上带不上口令', () => {
    const legacy = JSON.stringify({ account: 'a@b.c', password: SECRET })
    // 旧缺陷逐字可见 —— 判据若对它无感,② 就是恒绿的自我表扬
    expect(legacy).toContain(SECRET)
    taroStorage.set(REMEMBERED_ACCOUNT_STORAGE_KEY, legacy)
    // 旧 loader 会把 password 原样交回(旧版要求 account && password 同时存在);
    // 新判据必须回空串,且把盘上那份改写干净。
    expect(credentialStorage.loadRemembered()?.password).toBe('')
    expect(String(taroStorage.get(REMEMBERED_ACCOUNT_STORAGE_KEY))).not.toContain(SECRET)
    // 新写入面:saveRemembered 收了口令入参也只落账号
    credentialStorage.saveRemembered('c@d.e', SECRET)
    expect(allStoredText()).not.toContain(SECRET)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
