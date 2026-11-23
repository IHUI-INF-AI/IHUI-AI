// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * P0-8 第六批:索引状态读面(2026-11-23)。
 *
 * 钉住三件事:
 * ① `evaluateRebuild` 把「读状态 → 取指纹 → 判档」收成唯一入口,四档封闭;
 * ② 无归属零 DB 调用(不是查一次再判空);
 * ③ `maxAgeMs=0` 确实不按时间判过期 —— 窗口是运维口径,不给默认值冒充。
 */

import fs from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ selectCalls: 0, rows: [] as unknown[] }))

vi.mock('../../db/index.js', () => {
  const selectStub = () => {
    h.selectCalls += 1
    const settled = Promise.resolve(h.rows)
    return {
      from: () => ({
        where: () => Object.assign(settled, { limit: () => Promise.resolve(h.rows) }),
      }),
    }
  }
  return { db: { select: selectStub } }
})

vi.mock('../embedding-provider.js', () => ({ getEmbeddingProvider: () => null }))

import { codebaseIndexService, needsRebuild } from '../codebase-index-service.js'

const REPO_ROOT = path.resolve(__dirname, '../../../../..')
const SERVICE_SRC = fs.readFileSync(
  path.join(REPO_ROOT, 'apps/api/src/services/codebase-index-service.ts'),
  'utf8',
)
const ROUTE_SRC = fs.readFileSync(
  path.join(REPO_ROOT, 'apps/api/src/routes/v1-codebase-search.ts'),
  'utf8',
)

const NOW = 1_700_000_000_000

function stateRow(fingerprint: string, lastIndexedAtMs: number, chunkCount = 3) {
  return {
    configFingerprint: fingerprint,
    lastIndexedAt: new Date(lastIndexedAtMs),
    chunkCount,
  }
}

beforeEach(() => {
  h.selectCalls = 0
  h.rows = []
})

describe('P0-8e evaluateRebuild 四档', () => {
  it('无归属 ⇒ rebuild-no-state,且一次 DB 都不查', async () => {
    const out = await codebaseIndexService.evaluateRebuild({
      repoId: 'r1',
      currentFingerprint: 'v1',
      nowMs: NOW,
    })
    expect(out.decision).toBe('rebuild-no-state')
    expect(out.state).toBeNull()
    expect(h.selectCalls).toBe(0)
  })

  it('有归属但无状态行 ⇒ rebuild-no-state', async () => {
    h.rows = []
    const out = await codebaseIndexService.evaluateRebuild({
      repoId: 'r1',
      ownerUuid: 'u1',
      currentFingerprint: 'v1',
      nowMs: NOW,
    })
    expect(out.decision).toBe('rebuild-no-state')
    expect(out.state).toBeNull()
    expect(h.selectCalls).toBe(1)
  })

  it('指纹不一致 ⇒ rebuild-config-changed(优先于时间判定)', async () => {
    h.rows = [stateRow('v1', NOW - 10)]
    const out = await codebaseIndexService.evaluateRebuild({
      repoId: 'r1',
      ownerUuid: 'u1',
      currentFingerprint: 'v2',
      maxAgeMs: 60_000,
      nowMs: NOW,
    })
    expect(out.decision).toBe('rebuild-config-changed')
    expect(out.currentFingerprint).toBe('v2')
    expect(out.state?.configFingerprint).toBe('v1')
  })

  it('maxAgeMs=0 ⇒ 不按时间判过期(旧索引也算 reuse-fresh)', async () => {
    h.rows = [stateRow('v1', NOW - 365 * 24 * 3600 * 1000)]
    const out = await codebaseIndexService.evaluateRebuild({
      repoId: 'r1',
      ownerUuid: 'u1',
      currentFingerprint: 'v1',
      maxAgeMs: 0,
      nowMs: NOW,
    })
    expect(out.decision).toBe('reuse-fresh')
  })

  it('给了窗口且超窗 ⇒ rebuild-stale', async () => {
    h.rows = [stateRow('v1', NOW - 120_000)]
    const out = await codebaseIndexService.evaluateRebuild({
      repoId: 'r1',
      ownerUuid: 'u1',
      currentFingerprint: 'v1',
      maxAgeMs: 60_000,
      nowMs: NOW,
    })
    expect(out.decision).toBe('rebuild-stale')
  })

  it('时钟倒挂(状态时刻在未来)按 stale,不冒充刚建过', async () => {
    h.rows = [stateRow('v1', NOW + 90_000)]
    const out = await codebaseIndexService.evaluateRebuild({
      repoId: 'r1',
      ownerUuid: 'u1',
      currentFingerprint: 'v1',
      maxAgeMs: 60_000,
      nowMs: NOW,
    })
    expect(out.decision).toBe('rebuild-stale')
  })

  it('窗口边界闭区间:刚好等于窗口 ⇒ reuse-fresh', () => {
    const prev = { configFingerprint: 'v1', lastIndexedAtMs: NOW - 60_000, chunkCount: 1 }
    expect(needsRebuild(prev, 'v1', NOW, 60_000)).toBe('reuse-fresh')
  })
})

describe('P0-8e 源码面:组合入口与路由接线', () => {
  it('evaluateRebuild 里三步各只有一份', () => {
    const body = SERVICE_SRC.split('async evaluateRebuild(')[1] ?? ''
    expect(body.split('this.getIndexState(').length - 1).toBe(1)
    expect(body.split('resolveIndexConfigFingerprint()').length - 1).toBe(1)
    expect(body.split('needsRebuild(state, fingerprint').length - 1).toBe(1)
  })

  it('路由挂了 index-state 端点并校验 maxAgeMs', () => {
    expect(ROUTE_SRC).toContain("server.get('/repo/:repoId/index-state'")
    expect(ROUTE_SRC).toContain('codebaseIndexService.evaluateRebuild({')
    expect(ROUTE_SRC).toContain("'maxAgeMs 必须是非负整数'")
    expect(ROUTE_SRC).toContain(
      'const maxAgeMs = q.maxAgeMs === undefined ? 0 : Number(q.maxAgeMs)',
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
