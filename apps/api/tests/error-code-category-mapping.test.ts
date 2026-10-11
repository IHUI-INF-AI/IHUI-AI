// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import {
  ErrorCode,
  ERROR_CODE_CATEGORY,
  categoryOf,
  type ErrorCodeKey,
} from '../src/errors/codes.js'
import { ERROR_CATEGORIES } from '@ihui/types'

/**
 * b76-01 票3:ErrorCode → ErrorCategory 全量映射接线。
 * 全量封顶由 `Record<ErrorCodeKey, ErrorCategory>` 在编译期保证(缺格即编译红);
 * 本测试是运行时第二道闸 —— 表键数=码数、每值都是合法封闭类别、代表码归类正确。
 */
describe('ErrorCode → ErrorCategory 全量映射(b76-01 票3)', () => {
  it('完整性:映射键数 = ErrorCode 成员数,且键集与码集一致', () => {
    const codeKeys = Object.keys(ErrorCode) as ErrorCodeKey[]
    const mapKeys = Object.keys(ERROR_CODE_CATEGORY)
    expect(mapKeys.length).toBe(codeKeys.length)
    expect(new Set(mapKeys)).toEqual(new Set(codeKeys))
  })

  it('合法性:每个映射值都是封闭 ErrorCategory 联合的成员(无一格越界)', () => {
    const categories = new Set<string>(ERROR_CATEGORIES)
    for (const category of Object.values(ERROR_CODE_CATEGORY)) {
      expect(categories.has(category), `非法类别值: ${String(category)}`).toBe(true)
    }
  })

  it('代表码归类:鉴权/权限/限流/上游/内部各归其位', () => {
    expect(categoryOf('UNAUTHORIZED')).toBe('auth')
    expect(categoryOf('FORBIDDEN')).toBe('forbidden')
    expect(categoryOf('NOT_FOUND')).toBe('not_found')
    expect(categoryOf('RATE_LIMITED')).toBe('rate_limited')
    expect(categoryOf('UPSTREAM_FAILURE')).toBe('upstream')
    expect(categoryOf('CAPABILITY_UNAVAILABLE')).toBe('upstream')
    expect(categoryOf('INTERNAL_ERROR')).toBe('internal')
  })

  it('代表码归类:载荷非法归 validation,状态/并发竞争归 conflict', () => {
    expect(categoryOf('VALIDATION_FAILED')).toBe('validation')
    expect(categoryOf('INVALID_MONEY')).toBe('validation')
    expect(categoryOf('INVALID_TIMEZONE')).toBe('validation')
    // 501 能力结构上不存在:客户端侧不可挽回错误,与参数非法同族。
    expect(categoryOf('CAPABILITY_UNSUPPORTED')).toBe('validation')
    expect(categoryOf('CONFLICT')).toBe('conflict')
    expect(categoryOf('MEMBER_EXISTS')).toBe('conflict')
    expect(categoryOf('OPTIMISTIC_LOCK')).toBe('conflict')
    expect(categoryOf('LOCKED')).toBe('conflict')
    expect(categoryOf('DUPLICATE_REQUEST')).toBe('conflict')
  })

  it('helper 与直查表一致:categoryOf 对每个码都返回表内值', () => {
    for (const key of Object.keys(ErrorCode) as ErrorCodeKey[]) {
      expect(categoryOf(key)).toBe(ERROR_CODE_CATEGORY[key])
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
