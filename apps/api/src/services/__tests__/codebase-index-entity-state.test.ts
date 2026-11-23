// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * P0-8 第二批:实体/关系边表 + 索引状态幂等标记(2026-11-23)。
 *
 * 钉住四件事:
 * ① `needsRebuild` 四态判序(没状态 > 配置变了 > 过期 > 可复用),时钟倒挂按过期;
 * ② 指纹取值不读会抖动的信息(默认常量 + 显式 env 覆盖,空白回落);
 * ③ `getIndexState` 缺归属**零 DB 调用**;`markIndexed` 缺归属/缺指纹**写前先拒**;
 * ④ 幂等写必须走 `onConflictDoUpdate` 且 target 是唯一键两列;schema/迁移/接线三面逐字。
 */

import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  calls: [] as string[],
  selectResult: [] as Array<Record<string, unknown>>,
  values: null as Record<string, unknown> | null,
  conflict: null as Record<string, unknown> | null,
}))

vi.mock('../../db/index.js', () => ({
  db: {
    select: () => {
      h.calls.push('select')
      const chain = {
        from: () => chain,
        where: () => chain,
        limit: () => Promise.resolve(h.selectResult),
      }
      return chain
    },
    insert: () => {
      h.calls.push('insert')
      return {
        values: (values: Record<string, unknown>) => {
          h.values = values
          return {
            onConflictDoUpdate: (cfg: Record<string, unknown>) => {
              h.conflict = cfg
              return Promise.resolve()
            },
          }
        },
      }
    },
  },
}))

vi.mock('../embedding-provider.js', () => ({ getEmbeddingProvider: () => null }))

import {
  CODE_INDEX_CONFIG_FINGERPRINT_DEFAULT,
  codebaseIndexService,
  needsRebuild,
  resolveIndexConfigFingerprint,
} from '../codebase-index-service.js'

const REPO_ROOT = path.resolve(__dirname, '../../../../..')

describe('P0-8b resolveIndexConfigFingerprint', () => {
  it('未设 ⇒ 默认常量;显式覆盖生效;空白回落默认', () => {
    expect(resolveIndexConfigFingerprint({} as NodeJS.ProcessEnv)).toBe(
      CODE_INDEX_CONFIG_FINGERPRINT_DEFAULT,
    )
    expect(
      resolveIndexConfigFingerprint({
        CODE_INDEX_CONFIG_FINGERPRINT: 'v1536:custom-v2',
      } as NodeJS.ProcessEnv),
    ).toBe('v1536:custom-v2')
    expect(
      resolveIndexConfigFingerprint({
        CODE_INDEX_CONFIG_FINGERPRINT: '   ',
      } as NodeJS.ProcessEnv),
    ).toBe(CODE_INDEX_CONFIG_FINGERPRINT_DEFAULT)
  })
})

describe('P0-8b needsRebuild 判序', () => {
  const base = { configFingerprint: 'f1', lastIndexedAtMs: 1_000, chunkCount: 10 }
  const DAY = 24 * 3600 * 1000

  it('没状态 ⇒ rebuild-no-state(不是"可复用")', () => {
    expect(needsRebuild(null, 'f1', 1_000, DAY)).toBe('rebuild-no-state')
  })

  it('配置变了优先于过期判定', () => {
    expect(needsRebuild({ ...base, lastIndexedAtMs: 1 }, 'f2', 1_000_000_000, DAY)).toBe(
      'rebuild-config-changed',
    )
  })

  it('超过窗口 ⇒ rebuild-stale;恰好在窗口边界 ⇒ 可复用', () => {
    expect(needsRebuild(base, 'f1', 1_000 + DAY + 1, DAY)).toBe('rebuild-stale')
    expect(needsRebuild(base, 'f1', 1_000 + DAY, DAY)).toBe('reuse-fresh')
  })

  it('时钟倒挂(上次时刻在未来)⇒ rebuild-stale,不冒充刚建过', () => {
    expect(needsRebuild(base, 'f1', 500, DAY)).toBe('rebuild-stale')
  })

  it('maxAgeMs<=0 ⇒ 不按时间判过期(只看配置)', () => {
    expect(needsRebuild({ ...base, lastIndexedAtMs: 1 }, 'f1', 10_000_000, 0)).toBe('reuse-fresh')
    expect(needsRebuild({ ...base, lastIndexedAtMs: 1 }, 'f1', 10_000_000, -5)).toBe('reuse-fresh')
  })
})

describe('P0-8b getIndexState / markIndexed 的拒绝面', () => {
  it('缺归属 ⇒ null 且零 DB 调用', async () => {
    h.calls.length = 0
    expect(await codebaseIndexService.getIndexState(null, 'repo-1')).toBeNull()
    expect(await codebaseIndexService.getIndexState('', 'repo-1')).toBeNull()
    expect(h.calls).toEqual([])
  })

  it('有归属 ⇒ 读一次并映射为毫秒快照;空结果 ⇒ null', async () => {
    h.calls.length = 0
    h.selectResult = []
    expect(await codebaseIndexService.getIndexState('owner-1', 'repo-1')).toBeNull()
    expect(h.calls).toEqual(['select'])

    const at = new Date(1_700_000_000_000)
    h.selectResult = [{ configFingerprint: 'f1', lastIndexedAt: at, chunkCount: 42 }]
    expect(await codebaseIndexService.getIndexState('owner-1', 'repo-1')).toEqual({
      configFingerprint: 'f1',
      lastIndexedAtMs: at.getTime(),
      chunkCount: 42,
    })
  })

  it('markIndexed 缺归属/缺指纹 ⇒ 写前先拒,零 DB 调用', async () => {
    h.calls.length = 0
    await expect(
      codebaseIndexService.markIndexed({
        ownerUuid: '',
        repoId: 'repo-1',
        configFingerprint: 'f1',
        chunkCount: 1,
      }),
    ).rejects.toThrow('ownerUuid')
    await expect(
      codebaseIndexService.markIndexed({
        ownerUuid: 'owner-1',
        repoId: 'repo-1',
        configFingerprint: '',
        chunkCount: 1,
      }),
    ).rejects.toThrow('configFingerprint')
    expect(h.calls).toEqual([])
  })

  it('正常写:幂等键两列 target + fingerprint/chunkCount 进 set', async () => {
    h.calls.length = 0
    h.values = null
    h.conflict = null
    await codebaseIndexService.markIndexed({
      ownerUuid: 'owner-1',
      repoId: 'repo-1',
      configFingerprint: 'f1',
      chunkCount: 7,
      runId: 'run-1',
      nowMs: 1_700_000_000_000,
    })
    expect(h.calls).toEqual(['insert'])
    expect(h.values).toMatchObject({
      ownerUuid: 'owner-1',
      repoId: 'repo-1',
      configFingerprint: 'f1',
    })
    const cfg = (h.conflict ?? {}) as { target?: unknown; set?: Record<string, unknown> }
    const target = cfg.target as unknown[]
    expect(target).toHaveLength(2)
    expect(cfg.set).toMatchObject({ configFingerprint: 'f1', chunkCount: 7, lastRunId: 'run-1' })
  })
})

describe('P0-8b schema / 迁移 / 接线三面', () => {
  function read(rel: string): string {
    return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8')
  }

  it('schema 三表与唯一索引逐字存在', () => {
    const schema = read('packages/database/src/schema/codebase-index.ts')
    for (const name of ['codebase_entities', 'codebase_edges', 'codebase_index_states']) {
      expect(schema).toContain(`'${name}'`)
    }
    expect(schema).toContain("uniqueIndex('ux_codebase_index_states_owner_repo')")
    expect(schema).toContain("index('ix_codebase_edges_repo_to')")
    expect(schema).toContain("index('ix_codebase_entities_repo_name')")
  })

  it('迁移 SQL 三表 + 唯一索引可重放(IF NOT EXISTS)', () => {
    const sql = read('packages/database/drizzle/20261123151500_codebase_entity_edge_state.sql')
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "codebase_entities"')
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "codebase_edges"')
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "codebase_index_states"')
    expect(sql).toContain('"ux_codebase_index_states_owner_repo"')
    const journal = JSON.parse(read('packages/database/drizzle/meta/_journal.json')) as {
      entries: Array<{ tag: string }>
    }
    expect(journal.entries.at(-1)?.tag).toBe('20261123151500_codebase_entity_edge_state')
  })

  it('接线回潮闸:indexChunks 末尾 best-effort 标记 + 幂等 upsert', () => {
    const service = read('apps/api/src/services/codebase-index-service.ts')
    expect(service).toContain('await this.markIndexed({')
    expect(service).toContain('.catch((err: unknown)')
    expect(service).toContain('.onConflictDoUpdate({')
    expect(service).toContain('target: [codebaseIndexStates.ownerUuid, codebaseIndexStates.repoId]')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
