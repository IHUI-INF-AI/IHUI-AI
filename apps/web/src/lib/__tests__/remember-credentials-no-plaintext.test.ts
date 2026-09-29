// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票 #27 第三端(web)的常驻锁:记住的凭据**永远不得**把口令落进 localStorage。
 *
 * 病灶(实测,不是假想):`packages/ui-react/src/lib/remember-credentials.ts` 旧版把
 * `{account, password}` 经 `btoa(unescape(encodeURIComponent(JSON)))` 写 localStorage ——
 * base64 是编码不是加密,一步可还原;而"记住密码"正是自动登录旧径路(表单 mount 后
 * 用记住的账密 requestSubmit)的凭据源。web 侧的收口 = 本地不再留口令、自动登录改由
 * `use-auth-bootstrap` 的 httpOnly refresh 静默续期承担(该路早已存在,本票不新造)。
 *
 * 四条必须同时成立,缺任一条就是"把明文挪了个地方"而非"不再落明文":
 *  ① 新写入:那条记录**只有 account 字段**,读回的 password 恒为空串;
 *  ② 旧数据(JSON 形态 / base64 传输形态两代):读取时**就地抹掉口令**并保留账号,
 *     "记住账号"(历史下拉/账号回填)不得被顺手删掉 —— 删了是功能倒退;
 *  ③ 传输层解不出的垃圾记录:删除这一档(键归本库所有,旧形态可能含口令);
 *  ④ 单一真相:端内不得再抄 key 名,编解码必须走 `@ihui/shared/auth/remembered-account`
 *     (摘掉那行 import = 有人把规则抄回端内,本文件末条源码锁必红)。
 *
 * 有牙证明:阳性对照先证明判据**看得见旧缺陷** —— 旧实现写出的那条 base64 记录里
 * 口令逐字可见、旧 loader 会把它交回调用方;喂**同一判据**(①②)在旧形态上必红。
 * 反向对照:正常登录回填/历史下拉的数据源(loadLoginHistory/autoLogin 标志)不得被改坏。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import {
  saveRememberedCredentials,
  loadRememberedCredentials,
  clearRememberedCredentials,
  saveAutoLogin,
  loadAutoLogin,
  clearAutoLogin,
  saveLoginHistory,
  loadLoginHistory,
  removeFromLoginHistory,
  clearLoginHistory,
} from '@/lib/remember-credentials'
// key 名唯一真相也在 @ihui/shared —— 本测试用它断言"web 落盘用的就是那一把 key"
import {
  AUTO_LOGIN_STORAGE_KEY,
  LOGIN_HISTORY_STORAGE_KEY,
  REMEMBERED_ACCOUNT_STORAGE_KEY,
} from '@ihui/shared/constants'

// __tests__ → lib → src → web → apps → 仓根:五跳(与 auto-submit-gate-wiring 同法)
const ROOT = path.resolve(import.meta.dirname, '../../../../..')
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf-8')

// 键名对账:端内(含测试自己)都不得再抄字面量
const CRED_KEY = REMEMBERED_ACCOUNT_STORAGE_KEY
const AUTO_KEY = AUTO_LOGIN_STORAGE_KEY
const HISTORY_KEY = LOGIN_HISTORY_STORAGE_KEY

const SECRET = 'S3cret!pw'

/**
 * 逐字复刻 HEAD 旧版 `encode()` 的产物形态:`btoa(unescape(encodeURIComponent(json)))`。
 * 这里不调 deprecated 的 `unescape` 全局 —— encodeURIComponent 的输出里转义只可能是
 * `%XX` 三字节组,而 unescape 对其它字符逐字透传,故"按 %XX 还原成字节字符"与之等值。
 * (阳性对照的输入必须与旧实现字节级同形,否则"看得见旧缺陷"这句话就是空的。)
 */
function legacyTransportEncode(value: unknown): string {
  const encoded = encodeURIComponent(JSON.stringify(value))
  const bytes = encoded.replace(/%([0-9A-F]{2})/gi, (_m, hex: string) =>
    String.fromCharCode(parseInt(hex, 16)),
  )
  return btoa(bytes)
}

beforeEach(() => {
  localStorage.clear()
})

describe('key 名与跨端唯一真相一致(端内不得另起字面量)', () => {
  it('web 三把 key 与 @ihui/shared/constants 同值,且沿用历史名以读到存量记录', () => {
    expect(CRED_KEY).toBe('ihui-remember-credentials')
    expect(AUTO_KEY).toBe('ihui-auto-login')
    expect(HISTORY_KEY).toBe('ihui-login-history')
  })
})

describe('记住的口令不得落明文', () => {
  it('① 新写入:记录只有 account 字段;读回的 password 恒为空串', () => {
    saveRememberedCredentials('tester@example.com', SECRET)

    const raw = localStorage.getItem(CRED_KEY)
    expect(raw, '账号记录应仍在 localStorage').toBeTruthy()
    expect(raw).not.toContain(SECRET)
    expect(Object.keys(JSON.parse(raw as string) as Record<string, unknown>)).toEqual(['account'])
    // password 恒 '' —— PasswordLoginForm 的自动提交分支据此短路(自动登录改走 token 续期)
    expect(loadRememberedCredentials()).toEqual({ account: 'tester@example.com', password: '' })
    // clearRemembered 两处都删得净(不留孤本)
    clearRememberedCredentials()
    expect(localStorage.getItem(CRED_KEY)).toBeNull()
    expect(loadRememberedCredentials()).toBeNull()
  })

  it('② 旧 JSON 明文记录:读取时就地抹掉口令,账号保留', () => {
    localStorage.setItem(CRED_KEY, JSON.stringify({ account: 'legacy@example.com', password: SECRET }))

    const loaded = loadRememberedCredentials()
    expect(loaded).toEqual({ account: 'legacy@example.com', password: '' })

    const raw = localStorage.getItem(CRED_KEY)
    expect(raw, '记录不得被删空(记住账号是功能面)').toBeTruthy()
    expect(raw).not.toContain(SECRET)
    expect(JSON.parse(raw as string)).toEqual({ account: 'legacy@example.com' })
  })

  it('③ 旧 base64 传输形态(含中文账号):认出 → 就地改写为账号-only JSON,口令消失', () => {
    const legacyRaw = legacyTransportEncode({ account: '张三@example.com', password: SECRET })
    localStorage.setItem(CRED_KEY, legacyRaw)
    // 阳性对照的前提:这条种子本身就是旧缺陷的产物 —— 口令在盘上"可还原可见"
    expect(atob(legacyRaw)).toContain(SECRET)

    expect(loadRememberedCredentials()).toEqual({ account: '张三@example.com', password: '' })

    const raw = localStorage.getItem(CRED_KEY)
    expect(raw).not.toContain(SECRET)
    expect(raw).not.toBe(legacyRaw)
    expect(JSON.parse(raw as string)).toEqual({ account: '张三@example.com' })
  })

  it('④ 解不出的垃圾记录:整档删除(键归本库所有,旧形态可能含口令)', () => {
    localStorage.setItem(CRED_KEY, '{{not-json-not-base64}}')
    expect(loadRememberedCredentials()).toBeNull()
    expect(localStorage.getItem(CRED_KEY), '垃圾记录不得留在盘上').toBeNull()
  })

  it('反向对照:自动登录标志与账号历史不被收口改坏(记住账号功能面完整)', () => {
    saveAutoLogin(true)
    expect(loadAutoLogin()).toBe(true)
    saveRememberedCredentials('user-a', 'anything-is-dropped')
    expect(loadRememberedCredentials()?.account).toBe('user-a')
    clearAutoLogin()
    expect(loadAutoLogin()).toBe(false)

    saveLoginHistory('user-a')
    saveLoginHistory('user-b')
    saveLoginHistory('user-a') // 去重置顶
    expect(loadLoginHistory()).toEqual(['user-a', 'user-b'])
    for (const a of ['u1', 'u2', 'u3', 'u4']) saveLoginHistory(a)
    // 上限 5 由共享规则 pushLoginHistory 给出:此刻应是 ['u4','u3','u2','u1','user-a']
    expect(loadLoginHistory()).toEqual(['u4', 'u3', 'u2', 'u1', 'user-a'])

    expect(removeFromLoginHistory('u4')).toEqual(['u3', 'u2', 'u1', 'user-a'])
    expect(loadLoginHistory()).toEqual(['u3', 'u2', 'u1', 'user-a'])
    expect(clearLoginHistory()).toEqual([])
    expect(loadLoginHistory()).toEqual([])
  })

  it('反向对照:历史 base64 存量记录仍读得出(下拉数据源不被新传输截断)', () => {
    localStorage.setItem(HISTORY_KEY, legacyTransportEncode(['user1@example.com', 'user2', 'admin']))
    expect(loadLoginHistory()).toEqual(['user1@example.com', 'user2', 'admin'])
  })
})

describe('有牙证明 + 单一真相源码锁', () => {
  it('阳性对照:旧写入形态(同条记录带 password)与新写入形态可区分 —— ①②③ 的断言不是恒真', () => {
    // 旧缺陷面:同一条 localStorage 值里 account 与 password 并存且一步可还原。
    // 解法与被测实现同形(atob → 字节 → TextDecoder),不依赖 deprecated 的 escape。
    const legacy = legacyTransportEncode({ account: 'a@b.c', password: SECRET })
    const legacyJson = new TextDecoder().decode(
      Uint8Array.from(atob(legacy), (c) => c.charCodeAt(0)),
    )
    expect(JSON.parse(legacyJson as string)).toEqual({ account: 'a@b.c', password: SECRET })
    // 旧 loader 的取回形状(account && password 同时返回)—— 新实现必须给 password=''
    expect(loadRememberedCredentials()).toBeNull() // 盘上还空
    localStorage.setItem(CRED_KEY, legacy)
    expect(loadRememberedCredentials()?.password).toBe('')
    // 新实现写出的那条只有 account —— 两形态可区分,①②③ 才不是自我表扬
    saveRememberedCredentials('a@b.c', SECRET)
    expect(Object.keys(JSON.parse(localStorage.getItem(CRED_KEY) as string) as Record<string, unknown>)).toEqual(['account'])
  })

  it('④ 单一真相:web 传输层必须 import 共享编解码,摘掉即有人把规则抄回端内', () => {
    const libSrc = read('packages/ui-react/src/lib/remember-credentials.ts')
    expect(libSrc).toMatch(/from '@ihui\/shared\/auth\/remembered-account'/)
    expect(libSrc).toMatch(/from '@ihui\/shared\/constants\/storage-keys'/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
