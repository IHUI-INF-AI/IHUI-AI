// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * P0-8 第十批:重建候选批量清单(2026-11-23)。
 *
 * 钉住四件事:
 * ① `reuse-fresh` 不进清单 —— 清单语义是"待办",不是全量快照;
 * ② 排序固定(配置变更 > 无状态 > 过期,同档按 lastIndexedAt 升序再按 repoId),
 *    让调度层"先修配置漂移、再补缺失、最后刷旧";
 * ③ 上限夹取 [1,200],调用方传 0 / 1e9 都不得变成空清单或无界;
 * ④ 装车:服务方法 + 路由端点真的接线(造好没装车 = 没有)。
 */

import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  judgeRebuildCandidates,
  needsRebuild,
  REBUILD_CANDIDATE_LIMIT_CAP,
  type RebuildCandidateRow,
} from '../codebase-index-service.js'

const REPO_ROOT = path.resolve(__dirname, '../../../../..')
const FP = 'fp-v1'

function read(rel: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8')
}

function row(repoId: string, over: Partial<RebuildCandidateRow> = {}): RebuildCandidateRow {
  return {
    repoId,
    state: { configFingerprint: FP, lastIndexedAtMs: 1000, chunkCount: 3 },
    ...over,
  }
}

describe('P0-8j judgeRebuildCandidates 纯函数', () => {
  const now = 10_000
  const DAY = 86_400_000

  it('空入参 ⇒ 空清单', () => {
    expect(judgeRebuildCandidates([], FP, now, 0)).toEqual([])
  })

  it('reuse-fresh 不进清单', () => {
    expect(judgeRebuildCandidates([row('r1')], FP, now, 0)).toEqual([])
  })

  it('配置变更 / 无状态 / 过期 三档都进清单', () => {
    const out = judgeRebuildCandidates(
      [
        row('changed', {
          state: { configFingerprint: 'fp-old', lastIndexedAtMs: 9000, chunkCount: 1 },
        }),
        row('missing', { state: null }),
        row('stale', {
          state: { configFingerprint: FP, lastIndexedAtMs: now - 2 * DAY, chunkCount: 1 },
        }),
      ],
      FP,
      now,
      DAY,
    )
    expect(out.map((c) => `${c.repoId}:${c.decision}`)).toEqual([
      'changed:rebuild-config-changed',
      'missing:rebuild-no-state',
      'stale:rebuild-stale',
    ])
  })

  it('排序:配置变更 > 无状态 > 过期;过期档按 lastIndexedAt 升序', () => {
    const out = judgeRebuildCandidates(
      [
        row('stale-oldest', {
          state: { configFingerprint: FP, lastIndexedAtMs: now - 3 * DAY, chunkCount: 1 },
        }),
        row('stale-newer', {
          state: { configFingerprint: FP, lastIndexedAtMs: now - 2 * DAY, chunkCount: 1 },
        }),
        row('missing', { state: null }),
        row('changed', {
          state: { configFingerprint: 'fp-x', lastIndexedAtMs: 5000, chunkCount: 1 },
        }),
      ],
      FP,
      now,
      DAY,
    )
    expect(out.map((c) => c.repoId)).toEqual(['changed', 'missing', 'stale-oldest', 'stale-newer'])
  })

  it('同档同年龄按 repoId 稳定序(不靠调用顺序)', () => {
    const out = judgeRebuildCandidates([row('b'), row('a')], 'fp-x', now, 0)
    expect(out.map((c) => c.repoId)).toEqual(['a', 'b'])
  })

  it('maxAgeMs=0 ⇒ 不按时间判过期,只有配置/无状态进清单', () => {
    const out = judgeRebuildCandidates(
      [row('old', { state: { configFingerprint: FP, lastIndexedAtMs: 1, chunkCount: 1 } })],
      FP,
      now,
      0,
    )
    expect(out).toEqual([])
  })

  it('时钟倒挂(上次索引在未来)按过期处理,不冒充新鲜', () => {
    const out = judgeRebuildCandidates(
      [
        row('future', {
          state: { configFingerprint: FP, lastIndexedAtMs: now + 1, chunkCount: 1 },
        }),
      ],
      FP,
      now,
      DAY,
    )
    expect(out.map((c) => c.decision)).toEqual(['rebuild-stale'])
  })

  it('上限夹取:0 ⇒ 1 枚;1e9 ⇒ CAP;缺省 ⇒ 50', () => {
    const rows = Array.from({ length: 220 }, (_, i) => row(`r${i}`, { state: null }))
    expect(judgeRebuildCandidates(rows, FP, now, 0, 0)).toHaveLength(1)
    expect(judgeRebuildCandidates(rows, FP, now, 0, 1e9)).toHaveLength(REBUILD_CANDIDATE_LIMIT_CAP)
    expect(judgeRebuildCandidates(rows, FP, now, 0)).toHaveLength(50)
  })

  it('不改入参:传入行的顺序与内容原样', () => {
    const rows = [row('z'), row('a')]
    const before = rows.map((r) => r.repoId)
    judgeRebuildCandidates(rows, 'fp-z', now, 0)
    expect(rows.map((r) => r.repoId)).toEqual(before)
  })

  it('与 needsRebuild 同判据:四态结论逐条一致', () => {
    const snapshots = [
      null,
      { configFingerprint: 'fp-old', lastIndexedAtMs: 9000, chunkCount: 1 },
      { configFingerprint: FP, lastIndexedAtMs: now - 3 * DAY, chunkCount: 1 },
      { configFingerprint: FP, lastIndexedAtMs: 9999, chunkCount: 1 },
    ]
    for (const state of snapshots) {
      const direct = needsRebuild(state, FP, now, DAY)
      const list = judgeRebuildCandidates([{ repoId: 'r', state }], FP, now, DAY)
      const expected = direct === 'reuse-fresh' ? [] : [direct]
      expect(list.map((c) => c.decision)).toEqual(expected)
    }
  })
})

describe('P0-8j 装车:服务方法与路由端点', () => {
  const SERVICE = read('apps/api/src/services/codebase-index-service.ts')
  const ROUTE = read('apps/api/src/routes/v1-codebase-search.ts')

  it('服务:listRebuildCandidates 真调纯判据,且指纹缺省与写状态同源', () => {
    expect(SERVICE).toMatch(
      /async listRebuildCandidates\(opts: \{[\s\S]{0,600}judgeRebuildCandidates\(rows, fingerprint, nowMs \?\? Date\.now\(\), maxAgeMs, limit\)/,
    )
    expect(SERVICE).toMatch(
      /const fingerprint = currentFingerprint \?\? resolveIndexConfigFingerprint\(\)/,
    )
  })

  it('服务:listIndexStates 归属缺失零 DB(先 return [])', () => {
    expect(SERVICE).toMatch(
      /async listIndexStates\(ownerUuid: string \| null \| undefined\)[\s\S]{0,260}if \(!ownerUuid\) return \[\]/,
    )
  })

  it('路由:端点接线 + 401/400 三条拒绝路径', () => {
    expect(ROUTE).toMatch(/server\.get\('\/rebuild-candidates'/)
    expect(ROUTE).toMatch(
      /['"]\/rebuild-candidates['"][\s\S]{0,900}无法确定调用者身份:索引状态按归属隔离/,
    )
    expect(ROUTE).toMatch(/maxAgeDays 必须是非负整数/)
    expect(ROUTE).toMatch(/limit 必须是正整数/)
    expect(ROUTE).toMatch(
      /codebaseIndexService\.listRebuildCandidates\(\{[\s\S]{0,200}ownerUuid: req\.userId/,
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
