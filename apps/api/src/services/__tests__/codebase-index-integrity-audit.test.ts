// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 索引完整性审计专项测试(2026-11-23 P0-8 立)。
 *
 * 语义来源:TRAE CKG 的 sqlite_vec 完整性统计(missing_vector_entity_count /
 * total_embedding_entities 等),在这里搬到 PostgreSQL + pgvector。
 *
 * 被测对象:`codebase-index-service` 的 `getStats`(读数面)与 `auditIntegrity`(判定面)。
 * 钉住的期望值:
 *   - 缺向量切片**必须与向量化切片分开报数**,覆盖率 0 切片时是 0 而不是 1;
 *   - 四态互斥且空库不得记 ok(unjudged 也不得靠"查到 0 行"冒充 empty);
 *   - 审计只读,一次写操作都不许发生。
 *
 * 测法沿用本仓既有形态:mock `db` + `toQuery` 渲染 SQL 文本。谓词/列名写错时
 * SQL 文本会直接变,不需要连库。
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

const captured: Array<{ op: string; q: unknown }> = []
let executeResult: unknown = []

vi.mock('../../db/index.js', () => ({
  db: {
    execute: (q: unknown) => {
      captured.push({ op: 'execute', q })
      return Promise.resolve(executeResult)
    },
    // 审计是纯只读面:任何写调用直接炸,用例才可能发现"顺手改了库"。
    insert: () => {
      throw new Error('integrity audit must not write: insert')
    },
    delete: () => {
      throw new Error('integrity audit must not write: delete')
    },
    update: () => {
      throw new Error('integrity audit must not write: update')
    },
  },
}))

vi.mock('../embedding-provider.js', () => ({
  getEmbeddingProvider: () => null,
}))

import { codebaseIndexService } from '../codebase-index-service.js'

/**
 * 渲染 drizzle SQL 片段(与 codebase-index-tenant-isolation.test.ts 同源做法)。
 *
 * 注意:这里比旧形态多给了一个 `getColumnCasing`。drizzle 0.38 的 `toQuery` 在
 * 遇到 Column 对象时会调 `casing.getColumnCasing`,旧形态 `{cache,convert}` 会抛
 * `casing.getColumnCasing is not a function`,被 catch 吞成 `String(frag)`
 * ("[object Object]") —— 于是 `not.toContain(...)` 这类断言会**假绿**。
 * 本文件把这一个补上,SQL 断言才是真的在断言 SQL。
 */
function renderSql(frag: unknown): string {
  if (frag === null || frag === undefined) return ''
  const anyFrag = frag as { toQuery?: (cfg: unknown) => { sql: string; params: unknown[] } }
  if (typeof anyFrag.toQuery !== 'function') return String(frag)
  try {
    const q = anyFrag.toQuery({
      escapeName: (n: string) => `"${n}"`,
      escapeParam: (i: number) => `$${i + 1}`,
      casing: {
        cache: () => undefined,
        convert: (c: string) => c,
        getColumnCasing: (col: { name?: string; key?: string }) => col?.name ?? col?.key ?? '',
      },
    })
    let out = q.sql
    q.params.forEach((p, i) => {
      out = out.replace(`$${i + 1}`, typeof p === 'string' ? `'${p}'` : String(p))
    })
    return out
  } catch {
    return String(frag)
  }
}

function lastSql(): string {
  const last = captured.filter((c) => c.op === 'execute').at(-1)
  return renderSql(last?.q)
}

beforeEach(() => {
  captured.length = 0
  executeResult = []
})

afterEach(() => {
  vi.clearAllMocks()
})

// ===========================================================================
// 1. getStats:读数面
// ===========================================================================

describe('getStats 读数面', () => {
  it('缺向量切片单独报数,覆盖率按行数算(不是拍脑袋的阈值)', async () => {
    executeResult = [{ total: '10', files: '3', vectorized: '7', missing: '3' }]
    const stats = await codebaseIndexService.getStats('repo-x', 'user-a')
    expect(stats.totalChunks).toBe(10)
    expect(stats.totalFiles).toBe(3)
    expect(stats.vectorizedChunks).toBe(7)
    expect(stats.missingVectorChunks).toBe(3)
    // 7/10;补数 7+3 必须等于总数,否则统计本身就不自洽
    expect(stats.vectorCoverage).toBe(0.7)
    expect(stats.vectorizedChunks + stats.missingVectorChunks).toBe(stats.totalChunks)
  })

  it('0 切片时覆盖率是 0 而不是 1(空库不是"完整")', async () => {
    executeResult = [{ total: '0', files: '0', vectorized: '0', missing: '0' }]
    const stats = await codebaseIndexService.getStats('repo-empty', 'user-a')
    expect(stats.vectorCoverage).toBe(0)
    expect(Number.isNaN(stats.vectorCoverage)).toBe(false)
  })

  it('缺向量判据落在 SQL 层(FILTER + IS NULL),不是取回全表后在 JS 里筛', async () => {
    executeResult = [{ total: '1', files: '1', vectorized: '1', missing: '0' }]
    await codebaseIndexService.getStats('repo-x', 'user-a')
    const text = lastSql()
    expect(text).toContain('IS NULL')
    expect(text.toUpperCase()).toContain('FILTER')
    // 不能为了加列把旧列拆掉
    expect(text).toContain('COUNT(DISTINCT')
  })

  it('归属谓词仍在(带 owner 时不得退化成 1 = 0)', async () => {
    executeResult = [{ total: '1', files: '1', vectorized: '1', missing: '0' }]
    await codebaseIndexService.getStats('repo-x', 'user-a')
    const text = lastSql()
    expect(text).toContain('owner_uuid')
    expect(text).not.toContain('1 = 0')
  })

  it('repoId 参与过滤(无 repoId 时不出现 repo_id 条件)', async () => {
    executeResult = [{ total: '2', files: '1', vectorized: '2', missing: '0' }]
    await codebaseIndexService.getStats(undefined, 'user-a')
    expect(lastSql()).not.toContain('repo_id')
    await codebaseIndexService.getStats('repo-x', 'user-a')
    expect(lastSql()).toContain('repo_id')
  })
})

// ===========================================================================
// 2. auditIntegrity:判定面(四态互斥)
// ===========================================================================

describe('auditIntegrity 四态', () => {
  it('无归属 ⇒ unjudged/owner_required,且一次查询都不发(0 行不得冒充空库)', async () => {
    const audit = await codebaseIndexService.auditIntegrity('repo-x', null)
    expect(audit.status).toBe('unjudged')
    expect(audit.reason).toBe('owner_required')
    expect(audit.stats.totalChunks).toBe(0)
    expect(captured.filter((c) => c.op === 'execute')).toHaveLength(0)
  })

  it('归属域内 0 切片 ⇒ empty/no_chunks(不记 ok)', async () => {
    executeResult = [{ total: '0', files: '0', vectorized: '0', missing: '0' }]
    const audit = await codebaseIndexService.auditIntegrity('repo-x', 'user-a')
    expect(audit.status).toBe('empty')
    expect(audit.reason).toBe('no_chunks')
    expect(audit.repoId).toBe('repo-x')
  })

  it('有缺向量 ⇒ degraded/missing_vectors', async () => {
    executeResult = [{ total: '5', files: '2', vectorized: '4', missing: '1' }]
    const audit = await codebaseIndexService.auditIntegrity('repo-x', 'user-a')
    expect(audit.status).toBe('degraded')
    expect(audit.reason).toBe('missing_vectors')
    expect(audit.stats.missingVectorChunks).toBe(1)
  })

  it('全覆盖 ⇒ ok/complete', async () => {
    executeResult = [{ total: '5', files: '2', vectorized: '5', missing: '0' }]
    const audit = await codebaseIndexService.auditIntegrity('repo-x', 'user-a')
    expect(audit.status).toBe('ok')
    expect(audit.reason).toBe('complete')
    expect(audit.stats.vectorCoverage).toBe(1)
  })

  it('覆盖率 99% 仍是 degraded:判据是缺行计数,不是"看起来够高"', async () => {
    executeResult = [{ total: '1000', files: '50', vectorized: '990', missing: '10' }]
    const audit = await codebaseIndexService.auditIntegrity('repo-x', 'user-a')
    expect(audit.status).toBe('degraded')
    expect(audit.stats.vectorCoverage).toBe(0.99)
  })

  it('PG 返回字符串数字时逐项 Number 化(不把 "3" 当 3 的假等值)', async () => {
    executeResult = [{ total: '12', files: '4', vectorized: '9', missing: '3' }]
    const audit = await codebaseIndexService.auditIntegrity(undefined, 'user-a')
    expect(audit.stats.totalChunks).toBe(12)
    expect(audit.stats.missingVectorChunks).toBe(3)
    expect(audit.stats.vectorCoverage).toBe(0.75)
    expect(audit.repoId).toBeNull()
  })

  it('审计只读:insert/delete/update 一次都不得触发', async () => {
    executeResult = [{ total: '5', files: '2', vectorized: '4', missing: '1' }]
    await codebaseIndexService.auditIntegrity('repo-x', 'user-a')
    const ops = captured.map((c) => c.op)
    expect(ops.every((op) => op === 'execute')).toBe(true)
  })

  it('四态互斥且任一态都在 stats 里留原数(结论不吞读数)', async () => {
    executeResult = [{ total: '3', files: '1', vectorized: '0', missing: '3' }]
    const audit = await codebaseIndexService.auditIntegrity('repo-x', 'user-a')
    expect(audit.status).toBe('degraded')
    expect(audit.stats.totalChunks).toBe(3)
    expect(audit.stats.vectorizedChunks).toBe(0)
    expect(audit.stats.vectorCoverage).toBe(0)
  })

  it('repoId 透传:SQL 过滤与结论字段同源', async () => {
    executeResult = [{ total: '1', files: '1', vectorized: '1', missing: '0' }]
    const audit = await codebaseIndexService.auditIntegrity('repo-y', 'user-b')
    expect(audit.repoId).toBe('repo-y')
    const text = lastSql()
    expect(text).toContain('repo_id')
    expect(text).toContain('user-b')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
