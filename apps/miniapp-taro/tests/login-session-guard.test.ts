// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `requireLoginSession` 的判据本体 + 两条微信登录路径的接线锁。
 *
 * 为什么判据本体要单独测:`wechat-login.test.ts` 已经端到端钉住了一条路径,
 * 但 `miniapp-login.ts` 那条要 mock `../platform` 才能跑到,夹具成本高于收益;
 * 而"漏接这一格"的真实形态就是有人在自己新加的登录路径里忘了调它 —— 那用接线锁更准。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { maskComments } from '../../../scripts/lib/code-mask.mjs'
import {
  requireLoginSession,
  WechatNotBoundError,
  LoginNoSessionError,
} from '../src/utils/login-session'

const MSG = { notBound: '该微信尚未绑定账号,请用手机号验证码登录', noSession: '登录失败,请重试' }

const codeFace = (rel: string) =>
  maskComments(readFileSync(resolve(__dirname, '../src', rel), 'utf8'))

describe('requireLoginSession 判据本体', () => {
  it('非空 accessToken + user 对象 ⇒ 放行(正向对照,证明"没抛错"不是判据失明)', () => {
    expect(() =>
      requireLoginSession({ accessToken: 'at-1', user: { id: 'u-1' } }, MSG),
    ).not.toThrow()
  })

  it('needPhone 那一格:抛 WechatNotBoundError 并带出 openId', () => {
    let caught: unknown
    try {
      requireLoginSession({ needPhone: true, openId: 'o-42' }, MSG)
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(WechatNotBoundError)
    expect((caught as WechatNotBoundError).openId).toBe('o-42')
    expect((caught as Error).message).toBe(MSG.notBound)
  })

  it.each([
    ['整个答复为空', undefined],
    ['accessToken 是空串', { accessToken: '', user: { id: 'u-1' } }],
    ['accessToken 缺字段', { user: { id: 'u-1' } }],
    ['有 token 但没有 user', { accessToken: 'at-1' }],
    ['user 不是对象', { accessToken: 'at-1', user: 'u-1' }],
  ])('%s ⇒ 抛 LoginNoSessionError(不是 TypeError)', (_label, reply) => {
    expect(() => requireLoginSession(reply as never, MSG)).toThrow(LoginNoSessionError)
  })

  it('未绑定优先于"答复不对"分桶:needPhone 与坏 token 同时出现时按未绑定报', () => {
    expect(() => requireLoginSession({ needPhone: true, accessToken: '' }, MSG)).toThrow(
      WechatNotBoundError,
    )
  })
})

describe('两条微信登录路径的接线锁', () => {
  const sites = ['utils/wechat-login.ts', 'utils/miniapp-login.ts'] as const

  it.each(sites)('%s 必须调用 requireLoginSession(注释掉的形态不算)', (rel) => {
    expect(codeFace(rel)).toMatch(/requireLoginSession\(/)
  })

  it('判据全仓只住一处,两条路径不得各自再写一份 needPhone 判定', () => {
    const implementers = sites.filter((rel) => /needPhone\s*[:=]/.test(codeFace(rel)))
    expect(implementers).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
