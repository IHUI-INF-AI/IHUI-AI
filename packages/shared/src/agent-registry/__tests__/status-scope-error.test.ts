// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 任务 2（P0-04）封闭枚举测试：运行 8 / 定义 3 / 审批 6 / 作用域 3 / 错误码 40。
 * 这些断言是「封闭集」的行为面证据；改枚举必须走 ADR，并同步本文件。
 */

import { describe, expect, it } from 'vitest'
import {
  ACTIVE_RUN_STATUSES,
  APPROVAL_STATUSES,
  DEFINITION_STATUSES,
  ERROR_CODES,
  ERROR_HTTP_STATUS,
  RETRYABLE_ERROR_CODES,
  RUN_STATUSES,
  SCOPES,
  TERMINAL_RUN_STATUSES,
  httpStatusForErrorCode,
  isApprovalStatus,
  isDefinitionStatus,
  isErrorCode,
  isRetryableErrorCode,
  isRunStatus,
  isScope,
  isTerminalRunStatus,
} from '../contracts'

describe('RunStatus', () => {
  it('8 个封闭状态，拼写为 canceled', () => {
    expect(RUN_STATUSES).toEqual([
      'queued',
      'running',
      'paused',
      'succeeded',
      'failed',
      'canceled',
      'timeout',
      'blocked',
    ])
    expect(new Set(RUN_STATUSES).size).toBe(8)
    expect(RUN_STATUSES).toContain('canceled')
    expect(RUN_STATUSES).not.toContain('cancelled')
  })

  it('终态与活跃态互斥且覆盖 8 值', () => {
    expect(TERMINAL_RUN_STATUSES).toEqual(['succeeded', 'failed', 'canceled', 'timeout'])
    expect(ACTIVE_RUN_STATUSES).toEqual(['queued', 'running', 'paused', 'blocked'])
    for (const status of TERMINAL_RUN_STATUSES) {
      expect(ACTIVE_RUN_STATUSES).not.toContain(status)
      expect(isTerminalRunStatus(status)).toBe(true)
    }
    expect([...TERMINAL_RUN_STATUSES, ...ACTIVE_RUN_STATUSES]).toHaveLength(8)
  })

  it('守卫只认封闭集', () => {
    expect(isRunStatus('running')).toBe(true)
    expect(isRunStatus('cancelled')).toBe(false)
    expect(isRunStatus('completed')).toBe(false)
  })
})

describe('DefinitionStatus / ApprovalStatus / Scope', () => {
  it('定义状态 3 值', () => {
    expect(DEFINITION_STATUSES).toEqual(['active', 'disabled', 'deleted'])
    expect(isDefinitionStatus('active')).toBe(true)
    expect(isDefinitionStatus('purged')).toBe(false)
  })

  it('审批状态 6 值', () => {
    expect(APPROVAL_STATUSES).toEqual([
      'pending',
      'approved',
      'rejected',
      'expired',
      'consumed',
      'failed',
    ])
    expect(isApprovalStatus('consumed')).toBe(true)
    expect(isApprovalStatus('always')).toBe(false)
  })

  it('作用域 3 值', () => {
    expect(SCOPES).toEqual(['system', 'personal', 'team'])
    expect(isScope('team')).toBe(true)
    expect(isScope('org')).toBe(false)
  })
})

describe('ErrorCode', () => {
  it('40 个错误码，唯一', () => {
    expect(ERROR_CODES).toHaveLength(40)
    expect(new Set(ERROR_CODES).size).toBe(40)
  })

  it('HTTP 映射覆盖全部错误码且状态码合法', () => {
    expect(Object.keys(ERROR_HTTP_STATUS)).toHaveLength(40)
    for (const code of ERROR_CODES) {
      const status = httpStatusForErrorCode(code)
      expect(status).toBeGreaterThanOrEqual(400)
      expect(status).toBeLessThanOrEqual(599)
    }
  })

  it('关键映射与 01 §4.4 一致', () => {
    expect(httpStatusForErrorCode('APPROVAL_REQUIRED')).toBe(428)
    expect(httpStatusForErrorCode('AGENT_NOT_FOUND')).toBe(404)
    expect(httpStatusForErrorCode('AGENT_NAME_RESERVED')).toBe(400)
    expect(httpStatusForErrorCode('MODEL_UNAVAILABLE')).toBe(503)
  })

  it('可重试码是错误码子集', () => {
    for (const code of RETRYABLE_ERROR_CODES) {
      expect(isErrorCode(code)).toBe(true)
      expect(isRetryableErrorCode(code)).toBe(true)
    }
    expect(isRetryableErrorCode('AGENT_FORBIDDEN')).toBe(false)
  })

  it('守卫拒绝未知码', () => {
    expect(isErrorCode('APPROVAL_EXPIRED')).toBe(true)
    expect(isErrorCode('WHATEVER')).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
