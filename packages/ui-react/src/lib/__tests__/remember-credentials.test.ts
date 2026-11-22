// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 记住账号 / 记住口令 / 账号历史 / 自动登录的落盘行为锁(`lib/remember-credentials.ts`)。
 *
 * 这一族此前零覆盖,而它是**安全面**:旧实现把 `{account,password}` 做 base64 写进
 * localStorage,一次可还原。今天的契约有三条硬边:
 *  ① "记住账号"那把 key 结构上永远不含口令;
 *  ② 读到历史 base64 形态(可能带口令)必须**就地改写成**只含账号的 JSON;
 *  ③ 口令另存独立 key,且**换号不回吐旧口令**。
 * 断言逐条盯盘上原文,不盯"函数返回了什么"—— 泄漏发生在盘上,不发生在返回值里。
 */
import { LOGIN_HISTORY_MAX } from '@ihui/shared/constants/storage-keys'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  clearAutoLogin,
  clearLoginHistory,
  clearRememberedCredentials,
  loadAutoLogin,
  loadLoginHistory,
  loadRememberedCredentials,
  removeFromLoginHistory,
  saveAutoLogin,
  saveLoginHistory,
  saveRememberedCredentials,
  saveRememberedCredentialsWithPassword,
} from '../remember-credentials'

const ACCOUNT_KEY = 'ihui-remember-credentials'
const PASSWORD_KEY = 'ihui-remember-password'
const AUTO_LOGIN_KEY = 'ihui-auto-login'
const HISTORY_KEY = 'ihui-login-history'

/** 历史传输形态:`btoa(unescape(encodeURIComponent(text)))` 的等价实现。 */
function legacyTransport(text: string): string {
  const binary = String.fromCharCode(...new TextEncoder().encode(text))
  return btoa(binary)
}

beforeEach(() => {
  localStorage.clear()
})

describe('记住账号:盘上永不含口令', () => {
  it('saveRememberedCredentials 只写账号,传进来的口令被丢弃', () => {
    saveRememberedCredentials('alice@example.com', 'hunter2')
    const raw = localStorage.getItem(ACCOUNT_KEY)
    expect(raw).toBe(JSON.stringify({ account: 'alice@example.com' }))
    expect(raw).not.toContain('hunter2')
    expect(localStorage.getItem(PASSWORD_KEY)).toBeNull()
  })

  it('登录成功但"未勾选记住密码"会清掉上一账号残留的口令 key', () => {
    saveRememberedCredentialsWithPassword('alice@example.com', 'hunter2')
    expect(localStorage.getItem(PASSWORD_KEY)).not.toBeNull()
    saveRememberedCredentials('alice@example.com', 'hunter2')
    expect(localStorage.getItem(PASSWORD_KEY)).toBeNull()
  })

  it('默认读回口令恒为空串 —— "这一端默认不提供口令",自动提交据此短路', () => {
    saveRememberedCredentialsWithPassword('alice@example.com', 'hunter2')
    expect(loadRememberedCredentials()).toEqual({ account: 'alice@example.com', password: '' })
  })

  it('显式勾选过"记住密码"后才在 keepPassword 档回吐,且只回吐本账号的', () => {
    saveRememberedCredentialsWithPassword('alice@example.com', 'hunter2')
    expect(loadRememberedCredentials({ keepPassword: true })).toEqual({
      account: 'alice@example.com',
      password: 'hunter2',
    })
  })

  it('换号后不回吐上一个账号的口令(口令记录里的 account 不匹配即空)', () => {
    saveRememberedCredentialsWithPassword('alice@example.com', 'hunter2')
    // 模拟只有账号 key 被换掉、口令 key 还留着旧记录的最坏情形
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ account: 'bob@example.com' }))
    expect(loadRememberedCredentials({ keepPassword: true })).toEqual({
      account: 'bob@example.com',
      password: '',
    })
  })

  it('口令记录损坏时返回空串而不是抛出', () => {
    saveRememberedCredentialsWithPassword('alice@example.com', 'hunter2')
    localStorage.setItem(PASSWORD_KEY, '{not json')
    expect(loadRememberedCredentials({ keepPassword: true })).toEqual({
      account: 'alice@example.com',
      password: '',
    })
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
    // 迁移不复活口令:旧记录里的口令不会被转存到新口令 key
    expect(localStorage.getItem(PASSWORD_KEY)).toBeNull()
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

  it('clearRememberedCredentials 只清账号 key,不碰账号历史', () => {
    saveRememberedCredentials('alice@example.com', 'x')
    saveLoginHistory('alice@example.com')
    clearRememberedCredentials()
    expect(localStorage.getItem(ACCOUNT_KEY)).toBeNull()
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
