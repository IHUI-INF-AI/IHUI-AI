// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池「网页一键重登」注册表契约测试(2026-10-27 立;2026-10-29 O69 扩 workbuddy;
 * 2026-11-12 F-060 拆 workbuddy 链)。
 *
 * 钉四件事:
 * - 四平台登记齐全:有链的(trae)带真实登录页/桥接与非空 providerCode;
 *   没链的(workbuddy/qoder/codearts)必须带「断链缘由 + 当下真出路」话术且 kind=none
 *   (§0.3 不许冒绿;§0.8 不许写跑不通的路;半截实现不许把 none 悄悄改成有链)。
 * - probe 归一(trae):no_window/no_cookie/not_logged_in 都是「还没登完」;ok 才出货,
 *   且展示名缺省回落 uid(不猜昵称)。
 * - 导入 payload 走同一条导入通道形状,**永不含 refreshToken 键** —— 重登只换得到
 *   access,多塞一个假键就给了调用方“以为带了票”的错觉;webCookie 可选投影
 *   cookies[](name/value 成对,不伪造 domain/expires)。
 * - workbuddy 降 none(F-060):probe 回包剥离会话 Cookie 后 token 无源,出路话术
 *   必须点名真跑得通的导入命令(后台导入 JSON / relay-account-pool.mjs)。
 * - 豆包网页加号 payload(2026-11-17):name/phone=用户页内填的全号(上游只回掩码,
 *   一致性由 Rust probe 校验),token 按 sessionid 族回落,uid 绝不在前端造
 *   (服务端 mapDoubaoImport 单源派生),keepAliveForever 显式置真。
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/tauri-bridge', () => ({
  TRAE_WEB_LOGIN_URL: 'https://www.trae.cn/login',
  WB_WEB_LOGIN_URL: 'https://www.workbuddy.cn/login/',
  DOUBAO_WEB_LOGIN_URL: 'https://www.doubao.com/login',
  checkinTraeWebLoginProbe: vi.fn(async () => ({ status: 'no_cookie' })),
  checkinWorkbuddyWebLoginProbe: vi.fn(async () => ({ status: 'no_cookie' })),
  doubaoWebLoginAutofill: vi.fn(async () => true),
  doubaoWebLoginProbe: vi.fn(async () => ({ status: 'no_cookie' })),
}))

import {
  RELAY_WEB_LOGIN,
  RELAY_WEB_LOGIN_PROVIDERS,
  doubaoProbeToImportAccount,
  normalizeTraeProbe,
  relayWebLoginAccountToImport,
  webCookieHeaderToEntries,
} from '@/lib/relay-web-login'

describe('RELAY_WEB_LOGIN 注册表', () => {
  it('四平台登记齐全,键集与平台枚举一致', () => {
    expect(Object.keys(RELAY_WEB_LOGIN).sort()).toEqual([...RELAY_WEB_LOGIN_PROVIDERS].sort())
    expect(RELAY_WEB_LOGIN_PROVIDERS).toEqual(['trae', 'workbuddy', 'qoder', 'codearts'])
  })

  it('trae 有链:带真实登录页与桥接探针,providerCode 取自登记条目', () => {
    const cap = RELAY_WEB_LOGIN.trae
    expect(cap.kind).toBe('ipc-trae')
    if (cap.kind !== 'ipc-trae') return
    expect(cap.providerCode).toBe('trae')
    expect(cap.loginUrl).toBe('https://www.trae.cn/login')
    expect(typeof cap.probe).toBe('function')
    expect(cap.tabTitle.length).toBeGreaterThan(0)
  })

  it('workbuddy 降 none(F-060):cookie 无源断链,出路话术点名真跑得通的导入命令', () => {
    const cap = RELAY_WEB_LOGIN.workbuddy
    expect(cap.kind).toBe('none')
    if (cap.kind !== 'none') return
    expect(cap.reason.length).toBeGreaterThan(40)
    expect(cap.reason).toContain('F-060')
    expect(cap.reason).toContain('--file')
    expect(cap.reason).toContain('--provider workbuddy')
  })

  it('qoder/codearts 仍 kind=none 且出路话术点名可跑通的命令/入口(半截实现不得悄悄升档)', () => {
    for (const p of ['qoder', 'codearts'] as const) {
      const cap = RELAY_WEB_LOGIN[p]
      expect(cap.kind).toBe('none')
      if (cap.kind !== 'none') return
      expect(cap.reason).toContain('未判定')
      expect(cap.reason.length).toBeGreaterThan(40)
    }
    expect(RELAY_WEB_LOGIN.qoder.reason).toContain('--file')
    expect(RELAY_WEB_LOGIN.codearts.reason).toContain('华为云')
  })
})

describe('normalizeTraeProbe 归一', () => {
  it('ok → 账号齐全,展示名缺省回落 uid,expiresAt 缺省 null', () => {
    const r = normalizeTraeProbe({ status: 'ok', token: 'jwt-x', uid: 'u-9', nickname: '' })
    expect(r.status).toBe('ok')
    if (r.status !== 'ok') return
    expect(r.account).toEqual({
      providerCode: 'trae',
      uid: 'u-9',
      name: 'u-9',
      token: 'jwt-x',
      expiresAt: null,
    })
  })

  it('ok 带 nickname 与 expires_at → 原样带上', () => {
    const r = normalizeTraeProbe({
      status: 'ok',
      token: 'jwt-x',
      uid: 'u-9',
      nickname: '13800000000',
      expires_at: 1791234567,
    })
    if (r.status !== 'ok') throw new Error('应为 ok')
    expect(r.account.name).toBe('13800000000')
    expect(r.account.expiresAt).toBe(1791234567)
  })

  it('no_window → waiting 带 windowGone;其余未完态 → waiting;error → 带原话的 error', () => {
    expect(normalizeTraeProbe({ status: 'no_window' })).toEqual({
      status: 'waiting',
      windowGone: true,
    })
    expect(normalizeTraeProbe({ status: 'no_cookie' })).toEqual({ status: 'waiting' })
    expect(normalizeTraeProbe({ status: 'not_logged_in', message: 'Cookie 已过期' })).toEqual({
      status: 'waiting',
    })
    expect(normalizeTraeProbe({ status: 'error', message: '网络异常' })).toEqual({
      status: 'error',
      message: '网络异常',
    })
  })
})

describe('webCookieHeaderToEntries Cookie 串投影', () => {
  it('name=value 成对落条目;坏形(缺 =/空值/空名)直接丢弃', () => {
    expect(webCookieHeaderToEntries('a=1; b=2')).toEqual([
      { name: 'a', value: '1' },
      { name: 'b', value: '2' },
    ])
    expect(webCookieHeaderToEntries('=novalue; noeq; ok=1; empty=')).toEqual([
      { name: 'ok', value: '1' },
    ])
  })
})

describe('relayWebLoginAccountToImport 导入 payload', () => {
  it('name/token/uid/enabled 齐,expiresAt 折 ISO;永不含 refreshToken 键', () => {
    const payload = relayWebLoginAccountToImport({
      providerCode: 'trae',
      uid: 'u-9',
      name: '13800000000',
      token: 'jwt-x',
      expiresAt: 1791234567,
    })
    expect(payload['name']).toBe('13800000000')
    expect(payload['token']).toBe('jwt-x')
    expect(payload['uid']).toBe('u-9')
    expect(payload['enabled']).toBe(true)
    expect(payload['expiresAt']).toBe(new Date(1791234567 * 1000).toISOString())
    expect(payload).not.toHaveProperty('refreshToken')
  })

  it('expiresAt 为 null 时不带该键(不伪造到期时刻)', () => {
    const payload = relayWebLoginAccountToImport({
      providerCode: 'trae',
      uid: 'u-9',
      name: 'n',
      token: 'jwt-x',
      expiresAt: null,
    })
    expect(payload).not.toHaveProperty('expiresAt')
    expect(payload).not.toHaveProperty('refreshToken')
    // trae 无网页 Cookie 会话形态 ⇒ 不得凭空多出 cookies 键
    expect(payload).not.toHaveProperty('cookies')
  })

  it('workbuddy 网页会话:token=Cookie 串,cookies[] 同值投影,name/uid/enabled 齐,不含 refreshToken', () => {
    const payload = relayWebLoginAccountToImport({
      providerCode: 'workbuddy',
      uid: 'wb-7',
      name: '13800000000',
      token: 'sessionid=abc; tnt_token=xyz',
      expiresAt: null,
      webCookie: 'sessionid=abc; tnt_token=xyz',
    })
    expect(payload['name']).toBe('13800000000')
    expect(payload['uid']).toBe('wb-7')
    expect(payload['token']).toBe('sessionid=abc; tnt_token=xyz')
    expect(payload['enabled']).toBe(true)
    expect(payload['cookies']).toEqual([
      { name: 'sessionid', value: 'abc' },
      { name: 'tnt_token', value: 'xyz' },
    ])
    expect(payload).not.toHaveProperty('refreshToken')
    // Cookie 形态无到期声明 ⇒ 不伪造 expiresAt
    expect(payload).not.toHaveProperty('expiresAt')
  })
})

describe('doubaoProbeToImportAccount 豆包网页加号 payload(2026-11-17)', () => {
  const cookies = [
    { name: 'sessionid', value: 'sid-1', domain: '.doubao.com' },
    { name: 'uid_tt', value: 'uid-9', domain: '.doubao.com' },
    { name: 'ttwid', value: 'tw-1', domain: '.bytedance.com' },
    { name: 'msToken', value: 'ms-1', domain: '.bytedance.com' },
  ]

  it('name/phone=用户填的全号(只填这一次),token 取 sessionid 族第一枚非空', () => {
    const p = doubaoProbeToImportAccount('15754320340', cookies)
    expect(p['name']).toBe('15754320340')
    expect(p['phone']).toBe('15754320340')
    expect(p['token']).toBe('sid-1')
    expect(p['enabled']).toBe(true)
  })

  it('keepAliveForever=true 显式带上(豆包不可续期,永久保活=只告警不摘除)', () => {
    expect(doubaoProbeToImportAccount('13800000000', cookies)['keepAliveForever']).toBe(true)
  })

  it('cookies 整包投影 {source,key,name,host,value}(uid 由服务端从 uid_tt 派生,前端不造第二份判据)', () => {
    const p = doubaoProbeToImportAccount('15754320340', cookies)
    expect(p).not.toHaveProperty('uid')
    expect(p['cookies']).toEqual([
      { source: 'cookies', key: 'sessionid', name: 'sessionid', host: '.doubao.com', value: 'sid-1' },
      { source: 'cookies', key: 'uid_tt', name: 'uid_tt', host: '.doubao.com', value: 'uid-9' },
      { source: 'cookies', key: 'ttwid', name: 'ttwid', host: '.bytedance.com', value: 'tw-1' },
      { source: 'cookies', key: 'msToken', name: 'msToken', host: '.bytedance.com', value: 'ms-1' },
    ])
  })

  it('sessionid 族缺一枚时按 sessionid→sessionid_ss→sid_tt 回落;全缺 ⇒ token 空串(由服务端校验拒,不编造)', () => {
    const p = doubaoProbeToImportAccount('15754320340', [
      { name: 'sessionid_ss', value: 'ss-2', domain: '.doubao.com' },
      { name: 'uid_tt', value: 'u', domain: '.doubao.com' },
    ])
    expect(p['token']).toBe('ss-2')
    expect(doubaoProbeToImportAccount('15754320340', [])['token']).toBe('')
  })

  it('domain 缺失落空串(不伪造域);不含 refreshToken/expiresAt(会话 Cookie 形态无此声明)', () => {
    const p = doubaoProbeToImportAccount('15754320340', [{ name: 'sessionid', value: 's' }])
    expect((p['cookies'] as Array<Record<string, unknown>>)[0]['host']).toBe('')
    expect(p).not.toHaveProperty('refreshToken')
    expect(p).not.toHaveProperty('expiresAt')
  })
})
