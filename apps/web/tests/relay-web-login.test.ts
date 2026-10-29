// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池「网页一键重登」注册表契约测试(2026-10-27 立;2026-10-29 O69 扩 workbuddy)。
 *
 * 钉四件事:
 * - 四平台登记齐全:有链的(trae/workbuddy)带真实登录页/桥接与非空 providerCode;
 *   没链的(qoder/codearts)必须带「未判定 + 当下真出路」话术且 kind=none
 *   (§0.3 不许冒绿;§0.8 不许写跑不通的出路;半截实现不许把 none 悄悄改成有链)。
 * - probe 归一:no_window/no_cookie/not_logged_in 都是「还没登完」;ok 才出货,
 *   且展示名缺省回落 uid(不猜昵称);workbuddy ok 但 accounts 为空同样不算出货。
 * - 导入 payload 走同一条导入通道形状,**永不含 refreshToken 键** —— 重登只换得到
 *   access,多塞一个假键就给了调用方"以为带了票"的错觉;workbuddy 额外投影
 *   cookies[](name/value 成对,不伪造 domain/expires)。
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/tauri-bridge', () => ({
  TRAE_WEB_LOGIN_URL: 'https://www.trae.cn/login',
  WB_WEB_LOGIN_URL: 'https://www.workbuddy.cn/login/?platform=website&state=2&product=workbuddy',
  checkinTraeWebLoginProbe: vi.fn(async () => ({ status: 'no_cookie' })),
  checkinWorkbuddyWebLoginProbe: vi.fn(async () => ({ status: 'no_cookie' })),
}))

import {
  RELAY_WEB_LOGIN,
  RELAY_WEB_LOGIN_PROVIDERS,
  normalizeTraeProbe,
  normalizeWorkbuddyProbe,
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

  it('workbuddy 有链(O69):kind 落定、登录页真实、探针非空、providerCode 正确', async () => {
    const cap = RELAY_WEB_LOGIN.workbuddy
    expect(cap.kind).toBe('ipc-workbuddy')
    if (cap.kind !== 'ipc-workbuddy') return
    expect(cap.providerCode).toBe('workbuddy')
    expect(cap.loginUrl).toContain('https://www.workbuddy.cn/login/')
    expect(typeof cap.probe).toBe('function')
    expect(cap.tabTitle.length).toBeGreaterThan(0)
    // 探针在注册表内已归一:桥接回 no_cookie ⇒ 号池页吃到的必须是 waiting(不是原始态)
    expect(await cap.probe()).toEqual({ status: 'waiting' })
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

describe('normalizeWorkbuddyProbe 归一', () => {
  it('ok 带账号 → token=Cookie 串、webCookie 同值、展示名回落 uid、expiresAt 不伪造', () => {
    const r = normalizeWorkbuddyProbe({
      status: 'ok',
      cookie: 'sessionid=abc; tnt_token=xyz',
      accounts: [{ uid: 'wb-7', nickname: '' }],
    })
    expect(r.status).toBe('ok')
    if (r.status !== 'ok') return
    expect(r.account).toEqual({
      providerCode: 'workbuddy',
      uid: 'wb-7',
      name: 'wb-7',
      token: 'sessionid=abc; tnt_token=xyz',
      expiresAt: null,
      webCookie: 'sessionid=abc; tnt_token=xyz',
    })
  })

  it('ok 但 accounts 为空 → 仍算「还没登完」(waiting,不冒出货)', () => {
    expect(
      normalizeWorkbuddyProbe({
        status: 'ok',
        cookie: 'a=b',
        accounts: [],
        cookie_checkin_ok: true,
      }),
    ).toEqual({ status: 'waiting' })
  })

  it('no_window → waiting 带 windowGone;no_cookie/not_logged_in → waiting;error → 带原话', () => {
    expect(normalizeWorkbuddyProbe({ status: 'no_window' })).toEqual({
      status: 'waiting',
      windowGone: true,
    })
    expect(normalizeWorkbuddyProbe({ status: 'no_cookie' })).toEqual({ status: 'waiting' })
    expect(normalizeWorkbuddyProbe({ status: 'not_logged_in', message: 'Cookie 已过期' })).toEqual({
      status: 'waiting',
    })
    expect(normalizeWorkbuddyProbe({ status: 'error', message: '网络异常' })).toEqual({
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
