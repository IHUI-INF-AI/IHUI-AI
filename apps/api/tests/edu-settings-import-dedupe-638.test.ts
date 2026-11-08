// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// F-638(P2) 离线回归:edu_settings 缺 (group,key) 唯一约束 + 批量导入同批重复 key 重复 INSERT
// + 按 group/key 取一条无 ORDER BY 导致随机返回。
// 判据分工:
//  a) 同一批次两条相同 (group,key):INSERT 只允许一次,第二项必须命中 existingMap 走 UPDATE。
//  b) findEduSettingByGroupKey 的 orderBy 片段经 PgDialect 渲染后必须含 updated_at DESC 与 id DESC。
//  c) 迁移文件必须先存量去重、再加唯一索引,并写明回滚(去重不可逆,需备份恢复)。
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const {
  mockSelectRows,
  mockInsertRows,
  mockUpdateRows,
  insertCalls,
  updateCalls,
  capturedOrderByArgs,
} = vi.hoisted(() => ({
  mockSelectRows: vi.fn((): unknown[] => []),
  mockInsertRows: vi.fn((): unknown[] => []),
  mockUpdateRows: vi.fn((): unknown[] => []),
  insertCalls: [] as unknown[],
  updateCalls: [] as unknown[],
  /** 记录 SELECT 链上 .orderBy() 收到的表达式,由用例经 PgDialect 渲染后断言 */
  capturedOrderByArgs: [] as unknown[],
}))

vi.mock('../src/db/index.js', () => {
  const makeChain = (entry: 'select' | 'insert' | 'update' | 'delete', resolver: () => unknown[]) => {
    const step: Record<string, unknown> = {}
    for (const m of [
      'from',
      'where',
      'set',
      'returning',
      'values',
      'orderBy',
      'limit',
      'offset',
      'onConflictDoUpdate',
      'onConflictDoNothing',
      'targetWhere',
      'setWhere',
    ]) {
      step[m] = vi.fn((...args: unknown[]) => {
        if (entry === 'select' && m === 'orderBy') {
          capturedOrderByArgs.push(...args)
        }
        return step
      })
    }
    step.then = (resolveFn: (v: unknown) => void, rejectFn?: (e: unknown) => void) =>
      Promise.resolve(resolver()).then(resolveFn, rejectFn)
    return step
  }
  return {
    db: {
      select: vi.fn(() => makeChain('select', () => mockSelectRows())),
      insert: vi.fn(() => {
        insertCalls.push(1)
        return makeChain('insert', () => mockInsertRows())
      }),
      update: vi.fn(() => {
        updateCalls.push(1)
        return makeChain('update', () => mockUpdateRows())
      }),
      delete: vi.fn(() => makeChain('delete', () => [])),
      execute: vi.fn().mockResolvedValue([]),
      transaction: vi.fn(),
    },
    dbRead: { select: vi.fn(() => makeChain('select', () => mockSelectRows())) },
  }
})

import { importEduSettings, findEduSettingByGroupKey } from '../src/db/setting-queries'

const dialect = new PgDialect()

const render = (expr: unknown): string =>
  dialect
    .sqlToQuery(expr as Parameters<PgDialect['sqlToQuery']>[0])
    .sql.replace(/"/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

const ROW = {
  id: '00000000-0000-4000-8000-000000000001',
  group: 'site',
  key: 'dup_key',
  value: 'v1',
  type: 'string',
  credentials: null,
  description: null,
  isPublic: false,
  sort: 0,
  status: 1,
  updatedBy: null,
  createdAt: new Date('2026-11-08T00:00:00.000Z'),
  updatedAt: new Date('2026-11-08T00:00:00.000Z'),
}

const MIGRATION_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../packages/database/drizzle/20261108120000_edu_settings_group_key_unique.sql',
)

describe('F-638 edu_settings (group,key) 唯一性与批量导入去重', () => {
  beforeEach(() => {
    mockSelectRows.mockReturnValue([])
    mockInsertRows.mockReturnValue([ROW])
    mockUpdateRows.mockReturnValue([ROW])
    insertCalls.length = 0
    updateCalls.length = 0
    capturedOrderByArgs.length = 0
  })

  it('a) 同一批次重复 (group,key):INSERT 只发生一次,第二项走 UPDATE', async () => {
    const result = await importEduSettings(
      [
        { group: 'site', key: 'dup_key', value: 'v1' },
        { group: 'site', key: 'dup_key', value: 'v2' },
      ],
      '00000000-0000-4000-8000-0000000000fe',
    )

    expect(insertCalls).toHaveLength(1)
    expect(updateCalls).toHaveLength(1)
    expect(result).toEqual({ inserted: 1, updated: 1, skipped: 0 })
  })

  it('b) findEduSettingByGroupKey 渲染 SQL 含 updated_at DESC 与 id DESC', async () => {
    await findEduSettingByGroupKey('site', 'dup_key')

    const rendered = capturedOrderByArgs
      .flatMap((arg) => (Array.isArray(arg) ? arg : [arg]))
      .map(render)

    expect(rendered.some((sql) => sql.includes('edu_settings.updated_at desc'))).toBe(true)
    expect(rendered.some((sql) => sql.includes('edu_settings.id desc'))).toBe(true)
  })

  it('c) 迁移文件存在:先去重,再加唯一索引,并含回滚说明', () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true)
    const content = readFileSync(MIGRATION_PATH, 'utf-8')

    const dedupeAt = content.indexOf('DELETE FROM "edu_settings"')
    const uniqueAt = content.indexOf('CREATE UNIQUE INDEX IF NOT EXISTS')
    expect(dedupeAt).toBeGreaterThan(-1)
    expect(uniqueAt).toBeGreaterThan(-1)
    expect(dedupeAt).toBeLessThan(uniqueAt)

    expect(content).toContain('edu_settings_group_key_uidx')
    expect(content.toUpperCase()).toContain('ROLLBACK')
    expect(content).toContain('DROP INDEX IF EXISTS')
    expect(content).toContain('备份')
  })
})
