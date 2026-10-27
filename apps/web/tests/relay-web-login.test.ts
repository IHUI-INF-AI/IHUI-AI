// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池「网页一键重登」注册表契约测试(2026-10-27 立)。
 *
 * 钉三件事:
 * - 四平台登记齐全:有链的带真实登录页/桥接;没链的必须带「未判定 + 当下真出路」
 *   话术(§0.3 不许冒绿;§0.8 不许写跑不通的出路)。
 * - probe 归一:no_window/no_cookie/not_logged_in 都是「还没登完」;ok 才出货,
 *   且展示名缺省回落 uid(不猜昵称)。
 * - 导入 payload 走同一条导入通道形状,**永不含 refreshToken 键** —— 重登只换得到
 *   access,多塞一个假键就给了调用方"以为带了票"的错觉。
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/tauri-bridge', () => ({
  TRAE_WEB_LOGIN_URL: 'https://www.trae.cn/login',
  checkinTraeWebLoginProbe: vi.fn(async () => ({ status: 'no_cookie' })),
}))

import {
  RELAY_WEB_LOGIN,
  RELAY_WEB_LOGIN_PROVIDERS,
  normalizeTraeProbe,
  relayWebLoginAccountToImport,
} from '@/lib/relay-web-login'

describe('RELAY_WEB_LOGIN 注册表', () => {
  it('四平台登记齐全,键集与平台枚举一致', () => {
    expect(Object.keys(RELAY_WEB_LOGIN).sort()).toEqual([...RELAY_WEB_LOGIN_PROVIDERS].sort())
    expect(RELAY_WEB_LOGIN_PROVIDERS).toEqual(['trae', 'workbuddy', 'qoder', 'codearts'])
  })

  it('trae 有链:带真实登录页与桥接探针', () => {
    const cap = RELAY_WEB_LOGIN.trae
    expect(cap.kind).toBe('ipc-trae')
    if (cap.kind !== 'ipc-trae') return
    expect(cap.loginUrl).toBe('https://www.trae.cn/login')
    expect(typeof cap.probe).toBe('function')
    expect(cap.tabTitle.length).toBeGreaterThan(0)
  })

  it('其余三平台 kind=none 且出路话术点名可跑通的命令/入口', () => {
    for (const p of ['workbuddy', 'qoder', 'codearts'] as const) {
      const cap = RELAY_WEB_LOGIN[p]
      expect(cap.kind).toBe('none')
      if (cap.kind !== 'none') return
      expect(cap.reason).toContain('未判定')
      expect(cap.reason.length).toBeGreaterThan(40)
    }
    expect(RELAY_WEB_LOGIN.workbuddy.reason).toContain('--from workbuddy')
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
  })
})
