// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

// 真机取证过的两件事,在这里钉成回归:
//  ① toUserFriendlyMessage 的判序必须是 errorCode → HTTP status → 文案正则。
//     顺序一旦反过来,401 的 "Invalid or expired token" 会先撞上参数类正则
//     /invalid|missing|required/,用户看到「提交的信息有误,请检查后重试」——
//     这不是措辞问题:它把"去登录"引导成"改表单",照着做永远修不好。
//  ② apiFailureToError 必须把 ApiResult 失败分支的 status/errorCode/retryAfter 带上,
//     且**只带真的有值的**(挂 status: undefined 会让"字段不存在"与"字段为 0/空"混成一类)。
// 起因:2026-09-26 真机 vc44 进「广场」tab 一进入即弹该框,全仓同型 throw 实测 213 处。
import { describe, expect, it } from 'vitest'

import { apiFailureToError, toUserFriendlyMessage } from '../src/utils/error-messages'

describe('apiFailureToError', () => {
  it('带上 status 后,401 走状态码档而不是文案正则(阳性对照)', () => {
    const e = apiFailureToError({ error: 'Invalid or expired token', status: 401 })
    expect(toUserFriendlyMessage(e)).toBe('登录已过期,请重新登录')
  })

  it('缺陷对照:同样的服务端文案,只抛 message 就会被降级成"提交的信息有误"', () => {
    // 这条断言的是**旧写法的后果**,不是期望行为 —— 它证明上面那条阳性对照有牙:
    // 若判序或出口哪天被改回去,这条会跟着变,而人能从红语里看出是哪一侧漂了。
    expect(toUserFriendlyMessage(new Error('Invalid or expired token'))).toBe(
      '提交的信息有误,请检查后重试',
    )
  })

  it('errorCode 优先于 status(两档都在时按 errorCode 判)', () => {
    const e = apiFailureToError({
      error: 'boom',
      status: 400,
      errorCode: 'RATE_LIMITED',
    })
    expect((e as Error & { errorCode?: string }).errorCode).toBe('RATE_LIMITED')
    expect((e as Error & { status?: number }).status).toBe(400)
  })

  it('不挂 undefined 字段:没给的键必须"不存在",而不是存在且为 undefined', () => {
    const e = apiFailureToError({ error: 'boom' }) as Error & Record<string, unknown>
    expect('status' in e).toBe(false)
    expect('errorCode' in e).toBe(false)
    expect('retryAfter' in e).toBe(false)
    // retryAfter 给了数就得留住(429 的"稍后再试"要靠它)
    const e2 = apiFailureToError({ error: 'slow down', status: 429, retryAfter: 30 }) as Error &
      Record<string, unknown>
    expect(e2.retryAfter).toBe(30)
  })

  it('兜底文案参数:迁移点原本写 `|| 端内文案` 时,那句文案不得被顺手丢掉', () => {
    const e = apiFailureToError({ error: '', status: 500 }, '导入失败')
    expect(e.message).toBe('导入失败')
    // 身份仍要留住 —— 兜底只补文案,不降级判序(401 那条阳性对照的前提不能被兜底路径破坏)
    const e401 = apiFailureToError({ error: '', status: 401 }, '导入失败')
    expect(toUserFriendlyMessage(e401)).toBe('登录已过期,请重新登录')
    expect((e401 as Error & { status?: number }).status).toBe(401)
  })

  it('有真文案时兜底不得覆盖它;两端都给值也不吞', () => {
    expect(apiFailureToError({ error: '额度不足' }, '导入失败').message).toBe('额度不足')
  })

  it('不给兜底又拿到空 error ⇒ 消息为空,这正是端内 `||` 想避免的形态,单列一条钉住现状', () => {
    // 刻意断言"空就是空":api-client 的出口已保证不返空文案,这里守的是 shared 这一层
    // 不做二次兜底(两层都兜就会互相掩盖,哪一层坏了都查不出来)。
    expect(apiFailureToError({ error: '' }).message).toBe('')
  })
})
