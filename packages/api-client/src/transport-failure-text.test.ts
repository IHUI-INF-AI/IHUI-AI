// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it, vi, afterEach } from 'vitest'

import { fetchApi, isAbortError, transportFailureText, unwrapAbortCause } from './client'
import { setTransport, type Transport } from './transport'

/**
 * 真机取证(2026-11-14,登录页横幅):界面出现过
 * `fetch failed: The operation was aborted.` —— 英文原文直出给用户。
 *
 * 根因是**两个**:
 *  ① 浏览器/RN 的 fetch 被 abort 时抛的是 `TypeError('fetch failed')`,真 AbortError 在 `cause` 里
 *     ⇒ `isAbortError` 判不出,"超时/取消"被当成未知异常;
 *  ② 归一化把 `err.message` 原样塞进 `ApiResult.error`,而各屏写的是
 *     `setError(res.error || t('x'))` ⇒ 拦住 239 处调用点的是唯一出口,不是逐屏改文案。
 *
 * 这两条锁的就是上面两件事;配色/间距那种"目视"项不在此列。
 */

/** 造一个与真实运行时同形的"abort 被包成 TypeError"的错误。 */
function wrappedAbort(): Error {
  const inner = new DOMException('The operation was aborted.', 'AbortError')
  return Object.assign(new TypeError('fetch failed: The operation was aborted.'), { cause: inner })
}

describe('AbortError 藏在 cause 链里', () => {
  it('裸 AbortError 仍然认得(不回归)', () => {
    expect(isAbortError(new DOMException('aborted', 'AbortError'))).toBe(true)
  })

  it('裸 TypeError 不认(阴性对照:不能把所有 TypeError 都当取消)', () => {
    expect(isAbortError(new TypeError('fetch failed'))).toBe(false)
  })

  it('fetch failed + cause=AbortError ⇒ 要认成取消(真机就是这一形)', () => {
    expect(isAbortError(unwrapAbortCause(wrappedAbort()))).toBe(true)
  })

  it('cause 链有环时不卡死:回落到原错误', () => {
    const loop: Error & { cause?: unknown } = new Error('fetch failed')
    loop.cause = loop
    expect(unwrapAbortCause(loop)).toBe(loop)
  })

  it('普通错误无 cause:原样返回', () => {
    const plain = new Error('boom')
    expect(unwrapAbortCause(plain)).toBe(plain)
  })
})

describe('无 status 的异常 → 用户可读文案', () => {
  it('网络类英文 ⇒ 网络文案(不直出英文)', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(transportFailureText(new TypeError('fetch failed'))).toBe(
      '网络连接异常,请检查网络后重试',
    )
    expect(transportFailureText(new Error('Network request failed'))).toBe(
      '网络连接异常,请检查网络后重试',
    )
    expect(transportFailureText(wrappedAbort())).toBe('网络连接异常,请检查网络后重试')
  })

  it('中文业务文案 ⇒ 原样保留(不得被抹成通用兜底)', () => {
    expect(transportFailureText(new Error('请先绑定手机号!'))).toBe('请先绑定手机号!')
    expect(transportFailureText(new Error('积分不足'))).toBe('积分不足')
  })

  it('非网络类英文 ⇒ 原样透传,交给共享层正则分类(不在这里抢职责)', () => {
    // 关键边界:`Invalid or expired token` 由 @ihui/shared 的 toUserFriendlyMessage
    // 映射成「登录已过期,请重新登录」。若在此吞成"网络异常",用户会被引导去查网络。
    expect(transportFailureText(new Error('Invalid or expired token'))).toBe(
      'Invalid or expired token',
    )
    expect(transportFailureText(new TypeError('Cannot read properties of undefined'))).toBe(
      'Cannot read properties of undefined',
    )
  })

  it('空 message 与非 Error 值 ⇒ 通用兜底', () => {
    expect(transportFailureText(new Error('   '))).toBe('网络异常')
    expect(transportFailureText(undefined)).toBe('网络异常')
    expect(transportFailureText({})).toBe('网络异常')
  })

  it('原文进日志,诊断不丢(仅网络类打一条,非网络类不刷屏)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // 前面的用例共用同一个 console.warn spy ⇒ 先清计数,断言才是"这一次调用"
    warn.mockClear()
    transportFailureText(new TypeError('fetch failed'))
    transportFailureText(new TypeError('Cannot read properties of undefined'))
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[1])).toContain('fetch failed')
  })
})

/**
 * 端到端:异常从 transport 抛出,到调用方拿到 `ApiResult` 的那一眼。
 * 单测上面那几个纯函数只能证明"文案函数对",证明不了"fetchApi 真的走到它"。
 */
describe('fetchApi 端到端:传输层异常的用户可见文案', () => {
  afterEach(() => {
    setTransport(undefined as unknown as Transport)
    vi.restoreAllMocks()
  })

  const alwaysThrow =
    (err: unknown): Transport =>
    () =>
      Promise.reject(err)

  it('fetch failed(undici/RN 形态)⇒ 网络文案,不再是英文原文', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    setTransport(
      alwaysThrow(Object.assign(new TypeError('fetch failed: The operation was aborted.'), {})),
    )
    const res = await fetchApi('/api/things')
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toBe('网络连接异常,请检查网络后重试')
  })

  it('fetch failed 且 cause 是真 AbortError ⇒ 认成"请求已取消"(超时不再被当未知异常)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    setTransport(alwaysThrow(wrappedAbort()))
    const res = await fetchApi('/api/things')
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toBe('请求已取消')
  })

  it('英文业务文案原样到达调用方(基线不被这一层改写)', async () => {
    setTransport(alwaysThrow(new Error('boom')))
    const res = await fetchApi('/api/things')
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toBe('boom')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
