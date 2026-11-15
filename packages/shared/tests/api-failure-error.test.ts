// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 真机取证过的两件事,在这里钉成回归:
//  ① toUserFriendlyMessage 的判序必须是 errorCode → HTTP status → 文案正则。
//     顺序一旦反过来,带 /invalid|missing|required/ 文案的 429 会先说「提交的信息
//     有误」而不是「操作过于频繁」,把"稍后再试"引导成"改表单"。
//     (2026-11-14 起认证正则已双向覆盖 `Invalid or expired token` 的词序,该句即便
//     没有 status 也归登录档;判序本身仍由下面 429 那条守着。)
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

  it('无 status 的裸 Error 也能归到登录档(2026-11-14 词序双向匹配后不再降级)', () => {
    // 旧写法:文案正则只认 `token (expired|invalid)` 词序,裸 Error 的
    // `Invalid or expired token` 会落到参数类 /invalid|…/,用户被引导去改表单。
    // 2026-11-14 起认证正则双向覆盖"形容词在前"的词序,这条不再是缺陷 ——
    // 同日后端真机仍下发该句(见 error-messages-friendly-or.test.ts 的 toFriendlyOr 用例)。
    expect(toUserFriendlyMessage(new Error('Invalid or expired token'))).toBe(
      '登录已过期,请重新登录',
    )
  })

  it('判序仍是 status 在文案正则之前:同样带 /invalid/,429 必须说"太频繁"', () => {
    // 守住①的原意:若哪天把文案正则提到 status 前面,这条会变红,
    // 用户会看到「提交的信息有误」而不是「操作过于频繁」。
    expect(toUserFriendlyMessage({ status: 429, message: 'invalid parameter' })).toBe(
      '操作过于频繁,请稍后再试',
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
