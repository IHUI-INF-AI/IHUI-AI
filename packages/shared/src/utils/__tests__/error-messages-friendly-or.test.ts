// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import { GENERIC_FAILURE_TEXT, toFriendlyOr, toUserFriendlyMessage } from '../error-messages'

/**
 * `toFriendlyOr` 的判据:既要**拦住英文术语直出**,又不能把每屏专属兜底抹成通用文案。
 * 这两件事在旧写法 `e instanceof Error ? e.message : t('x')` 里只做到了后一半的对。
 */
describe('toFriendlyOr:原始异常 → 文案,识别不出回落调用方文案', () => {
  it('英文传输术语 ⇒ 中文网络文案(不直出英文)', () => {
    expect(toFriendlyOr(new TypeError('fetch failed'), '加载失败')).toBe(
      '网络连接异常,请检查网络后重试',
    )
  })

  it('英文业务文案 ⇒ 走关键词表(登录过期不再被引导去查网络)', () => {
    expect(toFriendlyOr(new Error('Invalid or expired token'), '加载失败')).toBe(
      '登录已过期,请重新登录',
    )
    expect(toFriendlyOr(new Error('Too many requests'), '加载失败')).toBe(
      '操作过于频繁,请稍后再试',
    )
  })

  it('中文业务文案 ⇒ 原样保留', () => {
    expect(toFriendlyOr(new Error('积分不足'), '保存失败')).toBe('积分不足')
    expect(toFriendlyOr('请先绑定手机号', '保存失败')).toBe('请先绑定手机号')
  })

  it('errorCode / status 优先于 message(身份比措辞重要)', () => {
    expect(toFriendlyOr({ errorCode: 'RATE_LIMITED', message: 'whatever' }, '失败')).toBe(
      '操作过于频繁,请稍后再试',
    )
    expect(toFriendlyOr({ status: 401, message: 'whatever' }, '失败')).toBe(
      '登录已过期,请重新登录',
    )
  })

  it('没有任何可用信息 ⇒ 回落调用方那句更具体的文案(不降级成通用兜底)', () => {
    expect(toFriendlyOr(new Error(''), '课程加载失败')).toBe('课程加载失败')
    expect(toFriendlyOr(new Error('   '), '课程加载失败')).toBe('课程加载失败')
    expect(toFriendlyOr(undefined, '课程加载失败')).toBe('课程加载失败')
    expect(toFriendlyOr(null, '课程加载失败')).toBe('课程加载失败')
    expect(toFriendlyOr({}, '课程加载失败')).toBe('课程加载失败')
    expect(toFriendlyOr(42, '课程加载失败')).toBe('课程加载失败')
  })

  it('兜底文案常量与 toUserFriendlyMessage 的末档同源(改一处不会静默判错)', () => {
    expect(toUserFriendlyMessage(new Error('Zzzzqqq not a known pattern'))).toBe(
      GENERIC_FAILURE_TEXT,
    )
    expect(toFriendlyOr({ message: 'Zzzzqqq not a known pattern' }, '本页文案')).toBe(
      GENERIC_FAILURE_TEXT,
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
