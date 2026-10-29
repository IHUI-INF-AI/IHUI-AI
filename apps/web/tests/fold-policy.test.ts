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
  resolveCategoryInitialOpen,
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

/**
 * D58 ⇄ D21 联动出口(2026-10-29 补 mode 入参)。
 *
 * 立因:此前 `resolveCategoryInitialOpen` 只吃类目自身档位,**完全不吃用户折叠模式** ——
 * 用户在 FoldPolicyButton 里选"强制展开/强制折叠"对 15 个 'auto' 档类目卡永远无效。
 * 本组用例钉住优先级:**用户模式 > 类目档位 > 自适应**。
 */
describe('D21 折叠策略 · resolveCategoryInitialOpen(类目卡初值,含用户模式优先级)', () => {
  const light = { contentChars: 0, toolCallCount: 1, durationMs: 0 }
  const heavy = { contentChars: 0, toolCallCount: 99, durationMs: 0 }

  it("不传 mode(旧口径):只按类目档位 —— 'expand' 真 / 'collapse' 假 / 'auto' 走自适应", () => {
    expect(resolveCategoryInitialOpen('expand', heavy)).toBe(true)
    expect(resolveCategoryInitialOpen('collapse', light)).toBe(false)
    expect(resolveCategoryInitialOpen('auto', light)).toBe(true)
    expect(resolveCategoryInitialOpen('auto', heavy)).toBe(false)
  })

  it("用户模式 'expanded' 压过类目档位:即使 'auto'+重任务、'collapse',也一律展开", () => {
    expect(resolveCategoryInitialOpen('auto', heavy, 'expanded')).toBe(true)
    expect(resolveCategoryInitialOpen('collapse', heavy, 'expanded')).toBe(true)
  })

  it("用户模式 'collapsed' 压过类目档位:即使 'expand'、'auto'+轻任务,也一律收起", () => {
    expect(resolveCategoryInitialOpen('expand', light, 'collapsed')).toBe(false)
    expect(resolveCategoryInitialOpen('auto', light, 'collapsed')).toBe(false)
  })

  it("用户模式 'auto' 时不越权:回落到类目档位判据(与不传 mode 同结果)", () => {
    expect(resolveCategoryInitialOpen('expand', heavy, 'auto')).toBe(true)
    expect(resolveCategoryInitialOpen('collapse', light, 'auto')).toBe(false)
    expect(resolveCategoryInitialOpen('auto', light, 'auto')).toBe(true)
    expect(resolveCategoryInitialOpen('auto', heavy, 'auto')).toBe(false)
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
