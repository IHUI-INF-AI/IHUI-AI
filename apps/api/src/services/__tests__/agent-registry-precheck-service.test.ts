// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { describe, expect, it } from 'vitest'
import { AppError } from '../../errors/AppError.js'
import {
  computeImpactHash,
  issuePrecheckToken,
  verifyPrecheckToken,
  type PrecheckReport,
} from '../agent-registry-precheck-service.js'

function makeReport(): PrecheckReport {
  return {
    definitionId: '00000000-0000-4000-8000-000000000001',
    version: 7,
    blocking: [{ domain: 'runs', count: 1, ids: ['run-b'], hint: '先 stop' }],
    warnings: [{ domain: 'team', count: 2, ids: ['team-a', 'team-b'] }],
    unverified: [{ domain: 'a2a', reason: '本仓无卡片表' }],
    impactHash: '',
  }
}

function errorCode(run: () => unknown): string | undefined {
  try {
    run()
    return undefined
  } catch (error) {
    return error instanceof AppError ? error.errorCode : undefined
  }
}

describe('precheck impact hash', () => {
  it('同一份报告多次计算结果一致', () => {
    const report = makeReport()
    expect(computeImpactHash(report)).toBe(computeImpactHash(report))
    expect(computeImpactHash(report)).toMatch(/^sha256:[0-9a-f]{64}$/)
  })

  it('阻断项变化会改变 hash（审批不能跨影响面复用）', () => {
    const report = makeReport()
    const changed = {
      ...report,
      blocking: [...report.blocking, { domain: 'market' as const, count: 1, ids: ['m1'] }],
    }
    expect(computeImpactHash(changed)).not.toBe(computeImpactHash(report))
  })

  it('id 顺序不同但集合相同 → hash 相同', () => {
    const report = makeReport()
    const reordered = {
      ...report,
      warnings: [{ domain: 'team' as const, count: 2, ids: ['team-b', 'team-a'] }],
    }
    expect(computeImpactHash(reordered)).toBe(computeImpactHash(report))
  })
})

describe('precheck token', () => {
  it('合法 token 通过并绑定 actor/definition/hash', () => {
    const report = makeReport()
    report.impactHash = computeImpactHash(report)
    const issued = issuePrecheckToken('user-1', report)
    expect(issued.token.startsWith('pc_')).toBe(true)
    expect(issued.tokenHash).toMatch(/^[0-9a-f]{64}$/)

    const payload = verifyPrecheckToken(issued.token, 'user-1', report)
    expect(payload.definitionId).toBe(report.definitionId)
    expect(payload.impactHash).toBe(report.impactHash)
  })

  it('签名被篡改 → APPROVAL_MISMATCH', () => {
    const report = makeReport()
    report.impactHash = computeImpactHash(report)
    const issued = issuePrecheckToken('user-1', report)
    const tampered = `${issued.token.slice(0, -2)}xx`
    expect(errorCode(() => verifyPrecheckToken(tampered, 'user-1', report))).toBe(
      'APPROVAL_MISMATCH',
    )
  })

  it('跨用户复用 → APPROVAL_MISMATCH', () => {
    const report = makeReport()
    report.impactHash = computeImpactHash(report)
    const issued = issuePrecheckToken('user-1', report)
    expect(errorCode(() => verifyPrecheckToken(issued.token, 'user-2', report))).toBe(
      'APPROVAL_MISMATCH',
    )
  })

  it('过期 → AGENT_PREVIEW_EXPIRED', () => {
    const report = makeReport()
    report.impactHash = computeImpactHash(report)
    const issued = issuePrecheckToken('user-1', report, Date.now() - 11 * 60 * 1000)
    expect(errorCode(() => verifyPrecheckToken(issued.token, 'user-1', report))).toBe(
      'AGENT_PREVIEW_EXPIRED',
    )
  })

  it('预检后影响面变化 → AGENT_DELETE_BLOCKED', () => {
    const report = makeReport()
    report.impactHash = computeImpactHash(report)
    const issued = issuePrecheckToken('user-1', report)
    const changed = { ...report, blocking: [] as PrecheckReport['blocking'] }
    changed.impactHash = computeImpactHash(changed)
    expect(errorCode(() => verifyPrecheckToken(issued.token, 'user-1', changed))).toBe(
      'AGENT_DELETE_BLOCKED',
    )
  })
})
