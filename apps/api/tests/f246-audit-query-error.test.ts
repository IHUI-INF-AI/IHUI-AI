// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-246:审计链查询异常被吞成空结果 —— 审计员无法区分"无记录"与"查询失败",
 * SIEM 导出把空页当末页静默截断。缺表可降级,其它失败必须抛错。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
})

const dbMock = vi.hoisted(() => ({ execute: vi.fn() }))

vi.mock('../src/db/index.js', () => ({
  dbRead: { execute: dbMock.execute },
  db: { execute: dbMock.execute },
}))

import {
  AuditQueryError,
  selectAuditLogs,
  selectAuditLogChain,
  selectAuditLogsRange,
  countAuditLogs,
  getLastAuditLogHash,
  groupByAction,
  groupByUser,
} from '../src/db/audit-queries.js'

const MISSING_TABLE = Object.assign(new Error('relation "audit_logs_chain" does not exist'), {
  code: '42P01',
})

beforeEach(() => {
  dbMock.execute.mockReset()
})

describe('F-246 缺表可降级', () => {
  it('42P01 ⇒ 各查询返回空兜底,不抛错', async () => {
    dbMock.execute.mockRejectedValue(MISSING_TABLE)
    await expect(selectAuditLogs({}, 1, 20)).resolves.toEqual({ list: [], total: 0 })
    await expect(selectAuditLogChain('user-1')).resolves.toEqual([])
    await expect(selectAuditLogsRange()).resolves.toEqual([])
    await expect(countAuditLogs({})).resolves.toBe(0)
    await expect(getLastAuditLogHash()).resolves.toBe('0'.repeat(64))
    await expect(groupByAction({})).resolves.toEqual([])
    await expect(groupByUser({})).resolves.toEqual([])
  })

  it('缺表错误包在 cause 链里也能识别', async () => {
    dbMock.execute.mockRejectedValue({
      message: 'query failed',
      cause: { code: '42P01' },
    })
    await expect(selectAuditLogs({}, 1, 20)).resolves.toEqual({ list: [], total: 0 })
  })
})

describe('F-246 其它失败必须冒出来', () => {
  it('连接失败 ⇒ selectAuditLogs 抛 AuditQueryError(不能当空页)', async () => {
    dbMock.execute.mockRejectedValue(new Error('connection terminated unexpectedly'))
    await expect(selectAuditLogs({}, 1, 20)).rejects.toBeInstanceOf(AuditQueryError)
  })

  it('连接失败 ⇒ getLastAuditLogHash 抛错(不能伪装成创世哈希)', async () => {
    dbMock.execute.mockRejectedValue(new Error('read replica timeout'))
    await expect(getLastAuditLogHash()).rejects.toBeInstanceOf(AuditQueryError)
  })

  it('AuditQueryError 带 operation 与原始错误,供日志定位', async () => {
    const original = new Error('permission denied for table audit_logs_chain')
    dbMock.execute.mockRejectedValue(original)
    try {
      await groupByUser({})
      throw new Error('应当抛错')
    } catch (e) {
      expect(e).toBeInstanceOf(AuditQueryError)
      const err = e as AuditQueryError
      expect(err.code).toBe('AUDIT_QUERY_FAILED')
      expect(err.operation).toBe('groupByUser')
      expect(err.originalError).toBe(original)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
