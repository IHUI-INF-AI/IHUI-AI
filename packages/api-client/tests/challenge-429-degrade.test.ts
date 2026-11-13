// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 429 人机验证挑战降级(2026-11-13 立)。
 *
 * 病灶:anti-automation 越过挑战阈值后回 `429 + 需完成人机验证`,但首方客户端
 * 没有 CAPTCHA 实现 ⇒ 用户只见文案、无控件可完成 ⇒ 登录死锁。
 * 修法:deriveFailureFromBody(三端唯一派生出口)见 challenge 信号即改写为友好退避。
 *
 * 覆盖:机器信号(errorCode)/ 文案兜底(后端未全量带 errorCode)/ 普通限流不误伤。
 */
import { describe, it, expect } from 'vitest'

import { deriveFailureFromBody } from '../src/client.js'

describe('429 人机验证挑战降级', () => {
  it('机器信号优先:429 + errorCode:challenge_required ⇒ 改写为友好退避', () => {
    const r = deriveFailureFromBody(
      JSON.stringify({
        code: 429,
        message: '请求频率过高,需完成人机验证',
        errorCode: 'challenge_required',
      }),
      429,
    )
    expect(r.errorCode).toBe('challenge_required')
    expect(r.message).toBe('请求过于频繁,请稍后再试')
    // 不得再把做不了的指令原样上屏
    expect(r.message).not.toContain('人机验证')
  })

  it('文案兜底:429 无 errorCode 但 message 是那条原话 ⇒ 仍降级(后端未全量带 errorCode 的窗口期)', () => {
    const r = deriveFailureFromBody(
      JSON.stringify({ code: 429, message: '请求频率过高,需完成人机验证' }),
      429,
    )
    expect(r.errorCode).toBe('challenge_required')
    expect(r.message).toBe('请求过于频繁,请稍后再试')
  })

  it('发码闸文案(先完成人机验证)同样降级 —— 它也是做不了的验证', () => {
    const r = deriveFailureFromBody(
      JSON.stringify({ code: 429, message: '验证码请求过于频繁,请先完成人机验证' }),
      429,
    )
    expect(r.errorCode).toBe('challenge_required')
    expect(r.message).toBe('请求过于频繁,请稍后再试')
  })

  it('发码闸机器信号路径:429 + errorCode:challenge_required(后端已补)⇒ 降级', () => {
    const r = deriveFailureFromBody(
      JSON.stringify({
        code: 429,
        message: '验证码请求过于频繁,请先完成人机验证',
        errorCode: 'challenge_required',
      }),
      429,
    )
    expect(r.message).toBe('请求过于频繁,请稍后再试')
  })

  it('普通 429 限流(无 challenge 语义)完全不受影响', () => {
    const r = deriveFailureFromBody(
      JSON.stringify({ code: 429, message: '验证码已发送,请 60 秒后重试' }),
      429,
    )
    expect(r.message).toBe('验证码已发送,请 60 秒后重试')
    expect(r.errorCode).toBeUndefined()
  })

  it('errorCode 只在 429 时触发降级:其他状态码即使带 challenge_required 也不改写', () => {
    const r = deriveFailureFromBody(
      JSON.stringify({ message: '需完成人机验证', errorCode: 'challenge_required' }),
      403,
    )
    expect(r.message).toBe('需完成人机验证')
  })

  it('message 优先级不被降级逻辑破坏:message 优先于 detail', () => {
    const r = deriveFailureFromBody(
      JSON.stringify({ message: '普通额度不足', detail: 'quota', errorCode: 'QUOTA' }),
      400,
    )
    expect(r.message).toBe('普通额度不足')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
