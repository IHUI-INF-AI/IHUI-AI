// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D21 中间步骤折叠策略测试(2026-09-19 立)。
 * 覆盖:自适应三维判定(字数/工具数/耗时)与边界值、三档配置综合解析、
 * localStorage 持久化 + 事件广播(复用 voice-toolbar 模板的链路)。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  AUTO_COLLAPSE_CHARS,
  AUTO_COLLAPSE_TOOL_CALLS,
  AUTO_COLLAPSE_DURATION_MS,
  FOLD_POLICY_KEY,
  FOLD_POLICY_EVENT,
  shouldCollapseSteps,
  resolveInitialStepsOpen,
  readFoldPolicyMode,
  writeFoldPolicyMode,
} from '@/components/chat/message-list/fold-policy'

const light = { contentChars: 50, toolCallCount: 1, durationMs: 2_000 }

describe('D21 折叠策略 · shouldCollapseSteps(自适应纯函数)', () => {
  it('三维全轻(字数少+工具少+快)→ 不折叠(轻查询默认展开)', () => {
    expect(shouldCollapseSteps(light)).toBe(false)
  })

  it('字数达到阈值 → 折叠', () => {
    expect(shouldCollapseSteps({ ...light, contentChars: AUTO_COLLAPSE_CHARS })).toBe(true)
    expect(shouldCollapseSteps({ ...light, contentChars: AUTO_COLLAPSE_CHARS - 1 })).toBe(false)
  })

  it('工具数超过阈值 → 折叠(恰好等于阈值仍算轻任务)', () => {
    expect(shouldCollapseSteps({ ...light, toolCallCount: AUTO_COLLAPSE_TOOL_CALLS })).toBe(false)
    expect(shouldCollapseSteps({ ...light, toolCallCount: AUTO_COLLAPSE_TOOL_CALLS + 1 })).toBe(
      true,
    )
  })

  it('耗时达到阈值 → 折叠', () => {
    expect(shouldCollapseSteps({ ...light, durationMs: AUTO_COLLAPSE_DURATION_MS })).toBe(true)
    expect(shouldCollapseSteps({ ...light, durationMs: AUTO_COLLAPSE_DURATION_MS - 1 })).toBe(false)
  })
})

describe('D21 折叠策略 · resolveInitialStepsOpen(配置综合解析,返回「展开」布尔)', () => {
  it('auto:跟随自适应判定(轻→展开,重→折叠)', () => {
    expect(resolveInitialStepsOpen('auto', light)).toBe(true)
    expect(resolveInitialStepsOpen('auto', { ...light, contentChars: 9999 })).toBe(false)
  })

  it('collapsed:恒折叠(即使三维全轻)', () => {
    expect(resolveInitialStepsOpen('collapsed', light)).toBe(false)
  })

  it('expanded:恒展开(即使三维全重,Qoder 0.2.1 口径)', () => {
    const heavy = { contentChars: 999_999, toolCallCount: 99, durationMs: 999_999 }
    expect(resolveInitialStepsOpen('expanded', heavy)).toBe(true)
  })
})

describe('D21 折叠策略 · 配置持久化(localStorage + 事件广播)', () => {
  beforeEach(() => {
    window.localStorage.removeItem(FOLD_POLICY_KEY)
  })

  it('未设置时默认 auto', () => {
    expect(readFoldPolicyMode()).toBe('auto')
  })

  it('write 后 read 回写一致,并派发 FOLD_POLICY_EVENT 广播', () => {
    let fired = 0
    const listener = () => {
      fired += 1
    }
    window.addEventListener(FOLD_POLICY_EVENT, listener)
    try {
      writeFoldPolicyMode('expanded')
      expect(readFoldPolicyMode()).toBe('expanded')
      writeFoldPolicyMode('collapsed')
      expect(readFoldPolicyMode()).toBe('collapsed')
      expect(fired).toBe(2)
    } finally {
      window.removeEventListener(FOLD_POLICY_EVENT, listener)
    }
  })

  it('localStorage 非法值回退 auto(不抛错)', () => {
    window.localStorage.setItem(FOLD_POLICY_KEY, 'bogus')
    expect(readFoldPolicyMode()).toBe('auto')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
