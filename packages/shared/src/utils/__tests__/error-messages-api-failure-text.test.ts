// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

import { describe, expect, it } from 'vitest'

import { apiFailureToError, apiFailureToText, toUserFriendlyMessage } from '../error-messages'

// 真机实测到的那一格:生产 API 对过期会话回 {"code":401,"message":"操作失败,请稍后重试"}。
// api-client 把 message 取成 res.error、status 另挂 —— 直接显示 res.error 就是这句通用文案,
// 而同一台机上走带 status 的那条腿会显示「登录已过期,请重新登录」。
const EXPIRED_SESSION = { error: '操作失败,请稍后重试', status: 401 }

describe('apiFailureToText —— ApiResult 失败分支的可显示出口', () => {
  it('① 身份优先于服务端通用文案:401 必须说"登录已过期"', () => {
    expect(apiFailureToText(EXPIRED_SESSION, '加载失败')).toBe('登录已过期,请重新登录')
  })

  it('② errorCode 比 status 更早一档(与 apiFailureToError 同一判序)', () => {
    expect(apiFailureToText({ error: 'x', status: 500, errorCode: 'RATE_LIMITED' }, '兜底')).toBe(
      '操作过于频繁,请稍后再试',
    )
  })

  it('③ 空文案时保住调用方兜底,而不是退成通用「操作失败,请稍后重试」', () => {
    expect(apiFailureToText({ error: '' }, '该屏专属兜底')).toBe('该屏专属兜底')
    // 这一条是本出口存在的理由:少了它,迁移会把每屏专属文案换成通用文案。
    expect(toUserFriendlyMessage({ error: '' })).toBe('操作失败,请稍后重试')
  })

  it("④ '' 配 ?? 的那一型不再产出可见长度为 0 的文案", () => {
    expect(apiFailureToText({ error: '' }, undefined)).toBe('操作失败,请稍后重试')
  })

  it('⑤ 无身份且是中文业务文案 → 原样保留(不顺手改写服务端话术)', () => {
    expect(apiFailureToText({ error: '库存不足,无法下单' }, '兜底')).toBe('库存不足,无法下单')
  })

  it('⑥ 与 apiFailureToError 严格同答(两出口不得各算一遍)', () => {
    const cases = [
      EXPIRED_SESSION,
      { error: '', status: 404 },
      { error: 'x', errorCode: 'FORBIDDEN' },
      { error: '余额不足' },
      { error: '' },
    ]
    for (const c of cases) {
      expect(apiFailureToText(c, 'FB')).toBe(toUserFriendlyMessage(apiFailureToError(c, 'FB')))
    }
  })

  it('⑦ 未收窄的 else 分支(error 为 string | undefined)必须能直接喂进来', () => {
    // 复现真实调用点形态:`if (res.success && res.data) {…} else { setError(res.error || F) }`
    // 那个 else 不被 TS 收窄到失败分支(它还覆盖 success 为真而 data 为假),res.error 是可选的。
    const res: { success: boolean; data?: unknown; error?: string; status?: number } = {
      success: true,
      data: undefined,
      error: undefined,
      status: 401,
    }
    // 类型层面能过(编译期判据),值层面 status 仍然赢:这一格正是"身份比文案有用"
    expect(apiFailureToText(res, '加载失败')).toBe('登录已过期,请重新登录')
    expect(apiFailureToText({ error: undefined }, '加载失败')).toBe('加载失败')
  })
})
