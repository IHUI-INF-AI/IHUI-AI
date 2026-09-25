// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D30① 信源接入单测:ci_failed / gate_failed 两种 kind 的 strict 校验、
// 摘要脱敏+截断、去重纯函数与风暴保护容器。全程 mock DB,零真实连接(§5 测试隔离铁律)。
import { describe, it, expect, vi } from 'vitest'

// 纯函数用例不需要任何 DB / 执行器副作用,mock 掉整条依赖链。
vi.mock('../src/db/index.js', () => ({ db: { update: vi.fn() } }))
vi.mock('../src/services/agent-runtime-stream.js', () => ({
  captureAgentRuntimeStream: vi.fn(),
}))

import {
  isUnattendedIntakeKind,
  parseUnattendedIntake,
  buildIntakeSummary,
  intakeDedupKey,
  shouldAcceptIntake,
  buildIntakePromptCtx,
  IntakeStormGuard,
  INTAKE_DEDUP_WINDOW_MS,
  INTAKE_SUMMARY_MAX_CHARS,
  type UnattendedIntakePayload,
} from '../src/services/agent-event-trigger.js'

const VALID_CI_FAILED: UnattendedIntakePayload = {
  kind: 'ci_failed',
  repo: 'IHUI-INF-AI/IHUI-AI',
  workflow: 'CI (Monorepo)',
  job: 'typecheck',
  commitSha: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0',
  runUrl: 'https://github.com/IHUI-INF-AI/IHUI-AI/actions/runs/12345',
  summary: 'pnpm --filter @ihui/api typecheck exited with code 2',
}

const VALID_GATE_FAILED: UnattendedIntakePayload = {
  kind: 'gate_failed',
  repo: 'IHUI-INF-AI/IHUI-AI',
  workflow: 'unattended-fix-intake',
  job: 'guardian-full',
  commitSha: 'DEADBEEF1234567',
  guardianId: '77',
  runUrl: 'https://github.com/IHUI-INF-AI/IHUI-AI/actions/runs/999',
  summary: 'guardian-runner 全量 1 道门失败:check-radius-single-source',
}

describe('D30① isUnattendedIntakeKind', () => {
  it('只认 ci_failed / gate_failed 两种 kind', () => {
    expect(isUnattendedIntakeKind('ci_failed')).toBe(true)
    expect(isUnattendedIntakeKind('gate_failed')).toBe(true)
    expect(isUnattendedIntakeKind('pull_request')).toBe(false)
    expect(isUnattendedIntakeKind('')).toBe(false)
  })
})

describe('D30① parseUnattendedIntake:strict 校验', () => {
  it('合法 ci_failed → ok,归一化 sha 小写并给出去重键', () => {
    const r = parseUnattendedIntake('ci_failed', VALID_CI_FAILED)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.kind).toBe('ci_failed')
    expect(r.data.commitSha).toBe(VALID_CI_FAILED.commitSha.toLowerCase())
    expect(r.dedupKey).toBe(
      intakeDedupKey('ci_failed', VALID_CI_FAILED.repo, VALID_CI_FAILED.commitSha, 'typecheck'),
    )
  })

  it('合法 gate_failed(带 guardianId)→ ok 且 guardianId 保留', () => {
    const r = parseUnattendedIntake('gate_failed', VALID_GATE_FAILED)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.guardianId).toBe('77')
    expect(r.data.commitSha).toBe('deadbeef1234567')
  })

  it('未知字段一律拒绝(strict)', () => {
    const r = parseUnattendedIntake('ci_failed', { ...VALID_CI_FAILED, evilExtra: 'x' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errors.join(' ')).toContain('evilExtra')
  })

  it('ci_failed 携带 gate_failed 专属字段 guardianId 也按未知字段拒绝', () => {
    const r = parseUnattendedIntake('ci_failed', { ...VALID_CI_FAILED, guardianId: '9' })
    expect(r.ok).toBe(false)
  })

  it('header 与 body kind 不一致 → kind_mismatch 拒绝', () => {
    const r = parseUnattendedIntake('ci_failed', VALID_GATE_FAILED)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errors.join(' ')).toContain('kind_mismatch')
  })

  it('非本票 kind 的事件名 → unsupported_event(不影响既有 GitHub 事件路径)', () => {
    const r = parseUnattendedIntake('push', VALID_CI_FAILED)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errors[0]).toContain('unsupported_event')
  })

  it('commitSha 非十六进制 / 过短 → 拒绝', () => {
    expect(parseUnattendedIntake('ci_failed', { ...VALID_CI_FAILED, commitSha: 'zzz' }).ok).toBe(
      false,
    )
    expect(parseUnattendedIntake('ci_failed', { ...VALID_CI_FAILED, commitSha: 'a1b' }).ok).toBe(
      false,
    )
  })

  it('runUrl 非 URL / repo 非 owner/name → 拒绝', () => {
    expect(parseUnattendedIntake('ci_failed', { ...VALID_CI_FAILED, runUrl: 'not a url' }).ok).toBe(
      false,
    )
    expect(parseUnattendedIntake('ci_failed', { ...VALID_CI_FAILED, repo: 'nope' }).ok).toBe(false)
  })
})

describe('D30① buildIntakeSummary:脱敏 + 截断', () => {
  it('超长摘要截断到上限并以省略号收尾,空白折叠为单空格', () => {
    const raw = `line1\n${'x'.repeat(2000)}\n  line3\tend`
    const out = buildIntakeSummary(raw)
    expect(out.length).toBeLessThanOrEqual(INTAKE_SUMMARY_MAX_CHARS)
    expect(out.endsWith('…')).toBe(true)
    expect(out).not.toContain('\n')
    expect(out).not.toContain('\t')
  })

  it('sk- 前缀 API Key 原文不得进入事件', () => {
    const raw = 'fail: provider rejected key sk-abcdefghijklmnopqrstuvwx123456'
    const out = buildIntakeSummary(raw)
    expect(out).not.toContain('sk-abcdefghijklmnopqrstuvwx123456')
    expect(out).toContain('***')
  })

  it('Bearer JWT 整段遮蔽', () => {
    const raw = 'auth error: Authorization: Bearer aaa.bbb.ccc was rejected'
    const out = buildIntakeSummary(raw)
    expect(out).not.toContain('Bearer aaa.bbb.ccc')
  })

  it('手机号脱敏(138****5678 形态),原号不出现', () => {
    const out = buildIntakeSummary('contact 13812345678 for followup')
    expect(out).not.toContain('13812345678')
    expect(out).toMatch(/138\*+5678/)
  })
})

describe('D30① 去重纯函数与风暴保护', () => {
  const key = intakeDedupKey('ci_failed', 'o/r', 'abc1234', 'build')

  it('intakeDedupKey:sha 大小写归一,job 不同则键不同', () => {
    expect(intakeDedupKey('ci_failed', 'o/r', 'ABC1234', 'build')).toBe(key)
    expect(intakeDedupKey('ci_failed', 'o/r', 'abc1234', 'lint')).not.toBe(key)
    expect(intakeDedupKey('gate_failed', 'o/r', 'abc1234', 'build')).not.toBe(key)
  })

  it('shouldAcceptIntake:首次放行;窗口内同键拒绝;恰满窗口放行;异键互不影响', () => {
    const seen = new Map<string, number>([[key, 1000]])
    expect(shouldAcceptIntake(seen, key, 1000 + INTAKE_DEDUP_WINDOW_MS - 1)).toBe(false)
    expect(shouldAcceptIntake(seen, key, 1000 + INTAKE_DEDUP_WINDOW_MS)).toBe(true)
    expect(shouldAcceptIntake(seen, `${key}|other`, 1001)).toBe(true)
  })

  it('IntakeStormGuard.accept:记录后窗口内重复被拦,过窗再放行', () => {
    const guard = new IntakeStormGuard()
    const k = intakeDedupKey('ci_failed', 'o/r', 'deadbee', 'typecheck')
    expect(guard.accept(k, 0)).toBe(true)
    expect(guard.accept(k, 60_000)).toBe(false)
    expect(guard.accept(k, INTAKE_DEDUP_WINDOW_MS)).toBe(true)
  })

  it('buildIntakePromptCtx:gate_failed 才带 guardianId 占位符', () => {
    const gate = parseUnattendedIntake('gate_failed', VALID_GATE_FAILED)
    const ci = parseUnattendedIntake('ci_failed', VALID_CI_FAILED)
    expect(gate.ok && ci.ok).toBe(true)
    if (!gate.ok || !ci.ok) return
    expect(buildIntakePromptCtx(gate.data).guardianId).toBe('77')
    expect('guardianId' in buildIntakePromptCtx(ci.data)).toBe(false)
    expect(buildIntakePromptCtx(ci.data).summary).toBe(VALID_CI_FAILED.summary)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
