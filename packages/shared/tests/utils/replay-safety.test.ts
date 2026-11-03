// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 重放安全性分类测试(G-998106 验收项)。
 *
 * 钉三件事:
 * 1. 已知码 ⇒ 按表分类 —— 15 类全覆盖,且测试侧期望表**独立书写**(第二把尺,不是实现转述);
 * 2. 未知错误码 ⇒ 副作用取保守值 `uncertain` ⇒ 上层不得自动重试(本文件的核心断言);
 * 3. 枚举封闭 —— 全集恰好 none | uncertain 两档,`canAutoRetry` 是上层唯一重试决策点。
 */
import { describe, it, expect } from 'vitest'
import {
  REPLAY_SAFETIES,
  REPLAY_UNCERTAIN,
  classifyReplaySafety,
  canAutoRetry,
} from '../../src/utils/replay-safety'
import { VIEW_FAILURE_ENTRIES } from '../../src/utils/view-failure-taxonomy'
import type { ViewFailureKind } from '../../src/utils/view-failure-taxonomy'

describe('G-998106 枚举面(副作用/可重放枚举)', () => {
  it('封闭枚举恰好两档:none(可安全重放)/ uncertain(不得自动重试)', () => {
    expect(REPLAY_SAFETIES).toEqual(['none', 'uncertain'])
    expect(REPLAY_UNCERTAIN).toBe('uncertain')
  })
})

describe('G-998106 已知码 ⇒ 按表分类', () => {
  // 期望表独立于实现书写:实现侧用 Record<ViewFailureKind,…> 保证新增类编译红,
  // 测试侧再对一遍账 —— 两把尺对不上就是有人改了语义没改判据。
  const EXPECTED: Record<ViewFailureKind, 'none' | 'uncertain'> = {
    // 失败点在副作用之前(请求没进处理器)⇒ none
    resourceNotFound: 'none',
    entrypointNotRegistered: 'none',
    entrypointInvalid: 'none',
    dependencyModuleMissing: 'none',
    environmentInitFailed: 'none',
    disabled: 'none',
    capabilityNotOffered: 'none',
    protocolMismatch: 'none',
    authForbidden: 'none',
    // 处理器已开始执行后才失败 / 结果无法确认 ⇒ uncertain
    runtimeException: 'uncertain',
    resourceLimitExceeded: 'uncertain',
    backendTimeout: 'uncertain',
    backendExited: 'uncertain',
    backendCrashed: 'uncertain',
    invalidResponse: 'uncertain',
  }

  it('D92 的 15 类逐一按表分类(前置拒绝 ⇒ none;执行后失败 ⇒ uncertain)', () => {
    expect(VIEW_FAILURE_ENTRIES).toHaveLength(15)
    for (const entry of VIEW_FAILURE_ENTRIES) {
      expect(classifyReplaySafety(entry.code)).toBe(EXPECTED[entry.kind])
    }
  })

  it('码形归一复用 D92:kebab / SCREAMING / MCP_ 前缀 / camel 同判', () => {
    expect(classifyReplaySafety('backend-timeout')).toBe('uncertain')
    expect(classifyReplaySafety('BACKEND_TIMEOUT')).toBe('uncertain')
    expect(classifyReplaySafety('MCP_BACKEND_TIMEOUT')).toBe('uncertain')
    expect(classifyReplaySafety('auth-forbidden')).toBe('none')
    expect(classifyReplaySafety('AUTH_FORBIDDEN')).toBe('none')
    expect(classifyReplaySafety('resourceNotFound')).toBe('none')
  })
})

describe('G-998106 未知码 ⇒ 保守 uncertain ⇒ 上层不得自动重试', () => {
  it('未知错误码 ⇒ 副作用取保守值 uncertain(uncertain ⇒ 上层不得自动重试,先查状态)', () => {
    expect(classifyReplaySafety('TOTALLY_UNKNOWN_BUSINESS_CODE_XYZ')).toBe('uncertain')
    // 真实业务码但不在 D92 分类表内 ⇒ 同样按未知码处理,落保守档
    expect(classifyReplaySafety('QUOTE_EXHAUSTED_x9')).toBe('uncertain')
  })

  it('空串与字面 UNKNOWN 也不得判 none(兜底态一律保守)', () => {
    expect(classifyReplaySafety('')).toBe('uncertain')
    expect(classifyReplaySafety('UNKNOWN')).toBe('uncertain')
  })

  it('canAutoRetry:uncertain ⇒ 上层不得自动重试;none ⇒ 可重放', () => {
    expect(canAutoRetry('uncertain'), 'uncertain ⇒ 上层不得自动重试,只能先查状态').toBe(false)
    expect(canAutoRetry('none')).toBe(true)
    expect(
      canAutoRetry(classifyReplaySafety('TOTALLY_UNKNOWN_BUSINESS_CODE_XYZ')),
      '未知码 ⇒ uncertain ⇒ 上层不得自动重试',
    ).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
