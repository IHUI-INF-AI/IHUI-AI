// @vitest-need
/**
 * G-937954 回归:gh 命令限流提示(命令形状 + 输出匹配 + 60s per-context 冷却)。
 *
 * 票面三判据各配正反对照:
 *  ① 输出匹配:"API rate limit exceeded"(含 already/secondary/GraphQL RATE_LIMITED 变体)⇒ 附加提示;
 *  ② 命令形状:gh 子命令命中,`gh auth status` 等本地档同串**不**附加;gh 不在命令位也不附加;
 *  ③ 冷却:同一 ctx 60s 内二发不附加 —— 且**换个 ctx 立即可用**(per-context 是票面明钉,
 *     模块级可变全局会让多会话互相压制冷却,正是票面否证 [A5] 的形态)。
 * 另钉接线面:前台结算出口 `settleForegroundCommand` 与 G-937951 终态映射叠加不互踩。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getGhRateLimitHint, settleForegroundCommand } from '../src/tools/builtins.js'
import type { ToolContext } from '../src/tools/index.js'

function mkCtx(): ToolContext {
  return { workspacePath: '/w' } as unknown as ToolContext
}

function sandboxResult(over: Partial<Parameters<typeof settleForegroundCommand>[0]> = {}) {
  return {
    stdout: '',
    stderr: '',
    exitCode: 0,
    timedOut: false,
    truncated: false,
    blocked: false,
    ...over,
  } as Parameters<typeof settleForegroundCommand>[0]
}

const RATE_LIMIT_TEXT = 'API rate limit exceeded for user'

describe('getGhRateLimitHint 输出匹配(判据①)', () => {
  it.each([
    ['API rate limit exceeded for user'],
    ['API rate limit already exceeded'],
    ['exceeded a secondary rate limit'],
    ['GraphQL: RATE_LIMITED'],
    ['api rate limit exceeded'],
  ])('命中文案 ⇒ 附加 system-reminder 提示:%s', (output) => {
    const hint = getGhRateLimitHint('gh pr list', output, mkCtx())
    expect(hint).toBeDefined()
    expect(hint).toContain('<system-reminder>')
    expect(hint.toLowerCase()).toContain('rate limit')
  })

  it('非限流输出 ⇒ 不附加', () => {
    expect(getGhRateLimitHint('gh pr list', 'Showing 3 of 3 pull requests', mkCtx())).toBeUndefined()
  })
})

describe('getGhRateLimitHint 命令形状(判据②)', () => {
  const AUTH_STATUS_OUTPUT = 'API rate limit exceeded (but this is gh auth status)'

  it('gh 子命令命中:起始位 / 分隔符后', () => {
    expect(getGhRateLimitHint('gh pr list', RATE_LIMIT_TEXT, mkCtx())).toBeDefined()
    expect(getGhRateLimitHint('ls && gh pr list', RATE_LIMIT_TEXT, mkCtx())).toBeDefined()
    expect(getGhRateLimitHint('gh api /user', RATE_LIMIT_TEXT, mkCtx())).toBeDefined()
  })

  it('本地档排除:auth/help/version/alias/completion/config 同串不附加', () => {
    expect(getGhRateLimitHint('gh auth status', AUTH_STATUS_OUTPUT, mkCtx())).toBeUndefined()
    expect(getGhRateLimitHint('gh help', RATE_LIMIT_TEXT, mkCtx())).toBeUndefined()
    expect(getGhRateLimitHint('gh version', RATE_LIMIT_TEXT, mkCtx())).toBeUndefined()
    expect(getGhRateLimitHint('gh alias list', RATE_LIMIT_TEXT, mkCtx())).toBeUndefined()
    expect(getGhRateLimitHint('gh completion -s bash', RATE_LIMIT_TEXT, mkCtx())).toBeUndefined()
    expect(getGhRateLimitHint('gh config get editor', RATE_LIMIT_TEXT, mkCtx())).toBeUndefined()
  })

  it('gh 不在命令位 ⇒ 不附加(echo/man 的正文不算 gh 调用)', () => {
    expect(getGhRateLimitHint('echo gh pr list', RATE_LIMIT_TEXT, mkCtx())).toBeUndefined()
    expect(getGhRateLimitHint('man gh', RATE_LIMIT_TEXT, mkCtx())).toBeUndefined()
  })
})

describe('getGhRateLimitHint 60s per-context 冷却(判据③)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-29T12:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('同一 ctx:首员附加,60s 内二发不附加;**换个 ctx 立即可用**(per-context,不是全局)', () => {
    const ctxA = mkCtx()
    const ctxB = mkCtx()
    expect(getGhRateLimitHint('gh pr list', RATE_LIMIT_TEXT, ctxA)).toBeDefined()
    expect(getGhRateLimitHint('gh pr list', RATE_LIMIT_TEXT, ctxA)).toBeUndefined()
    // 核心反例:同刻另一个 ctx 首发必须照常拿到提示 —— 若冷却被抄成模块级标量,这里会挂
    expect(getGhRateLimitHint('gh pr list', RATE_LIMIT_TEXT, ctxB)).toBeDefined()
  })

  it('同一 ctx 冷却窗走完 ⇒ 恢复附加(59_999ms 仍压制,60_000ms 起解封)', () => {
    const ctx = mkCtx()
    expect(getGhRateLimitHint('gh pr list', RATE_LIMIT_TEXT, ctx)).toBeDefined()
    vi.setSystemTime(new Date('2026-09-29T12:00:00Z').getTime() + 59_999)
    expect(getGhRateLimitHint('gh pr list', RATE_LIMIT_TEXT, ctx)).toBeUndefined()
    vi.setSystemTime(new Date('2026-09-29T12:00:00Z').getTime() + 60_000)
    expect(getGhRateLimitHint('gh pr list', RATE_LIMIT_TEXT, ctx)).toBeDefined()
  })
})

describe('settleForegroundCommand 前台结算接线(与 G-937951 终态映射叠加)', () => {
  it('命中限流 ⇒ 提示附加在输出尾部;未命中 ⇒ 输出无 system-reminder', () => {
    const hit = settleForegroundCommand(
      sandboxResult({ stdout: `${RATE_LIMIT_TEXT}\n`, exitCode: 1 }),
      'gh pr list',
      mkCtx(),
    )
    expect(hit.output).toContain('<system-reminder>')
    expect(hit.output.trimEnd().endsWith('</system-reminder>')).toBe(true)
    expect(hit.success).toBe(false)

    const miss = settleForegroundCommand(
      sandboxResult({ stdout: 'ok', exitCode: 0 }),
      'gh pr list',
      mkCtx(),
    )
    expect(miss.output).not.toContain('<system-reminder>')
    expect(miss.output).toBe('ok')
  })

  it('超时结果叠加:terminalState/interrupted 归档不受提示影响,两者同屏', () => {
    const out = settleForegroundCommand(
      sandboxResult({ stdout: RATE_LIMIT_TEXT, timedOut: true, exitCode: null }),
      'gh pr list',
      mkCtx(),
    )
    expect(out.terminalState).toBe('timed_out')
    expect(out.interrupted).toBe(true)
    expect(out.output).toContain('aborted before completion')
    expect(out.output).toContain('<system-reminder>')
  })

  it('冷却账本沿 ctx 生效:同一 ctx 二发不再附加提示', () => {
    const ctx = mkCtx()
    const first = settleForegroundCommand(sandboxResult({ stdout: RATE_LIMIT_TEXT, exitCode: 1 }), 'gh pr list', ctx)
    const second = settleForegroundCommand(sandboxResult({ stdout: RATE_LIMIT_TEXT, exitCode: 1 }), 'gh pr list', ctx)
    expect(first.output).toContain('<system-reminder>')
    expect(second.output).not.toContain('<system-reminder>')
  })
})
