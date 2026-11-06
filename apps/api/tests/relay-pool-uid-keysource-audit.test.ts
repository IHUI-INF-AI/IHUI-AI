// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Z66 第 3 件 —— 号池 uid 键源收敛器/校验器的接线锁(2026-11-06 立)。
 *
 * 立它的因:c59c7052e5 那次「25 行 → 23 行」的同批迁库是**一次性手跑**,仓内无同款器物
 * (Z47 现读:MIGRATE-RESULT 全仓 0 命中)。本套件把"幂等可重跑"钉成断言:
 * ① 第二次跑一条动作都不产生、行数与去重键数逐字不变;② 仍启用的旧键枚一律 REFUSED;
 * ③ 备份失败 ⇒ 一条都不写;④ 结论行形态唯一。
 *
 * 判据不复制:全部 import 源脚本的 __test__(§22c)。
 */
import { describe, it, expect } from 'vitest'
import {
  __test__ as audit,
  type PoolRowRef,
  type UidMapping,
  type ApplyDeps,
} from '../scripts/relay-pool-uid-keysource-audit.js'

const { planKeySourceMigration, conclude, applyPlan, duplicateKeyGroups } = audit

function row(
  id: string,
  providerCode: string,
  uid: string,
  over: Partial<PoolRowRef> = {},
): PoolRowRef {
  return {
    id,
    providerCode,
    uid,
    ownerUserId: null,
    isEnabled: true,
    credVersion: 1,
    lastRefreshAt: '2026-11-01T00:00:00.000Z',
    ...over,
  }
}

const M = (fromUid: string, toUid: string, providerCode = 'doubao'): UidMapping => ({
  providerCode,
  ownerUserId: null,
  fromUid,
  toUid,
})

/** 内存假池:行数/键数都可现读,写动作可数 */
function fakePool(rows: PoolRowRef[]) {
  const table = new Map(rows.map((r) => [r.id, r]))
  const writes: string[] = []
  const backups: Array<{ rowCount: number }> = []
  const deps: ApplyDeps = {
    selectAll: async () => [...table.values()],
    selectFullRows: async (ids) => {
      writes.push(`read:${ids.length}`)
      return ids.map((id) => ({ ...(table.get(id) ?? { missing: id }) }))
    },
    renameUid: async (rowId, toUid) => {
      const cur = table.get(rowId)
      if (!cur) throw new Error(`rename 目标不存在 ${rowId}`)
      writes.push(`rename:${rowId}→${toUid}`)
      table.set(rowId, { ...cur, uid: toUid })
    },
    deleteRow: async (rowId) => {
      writes.push(`delete:${rowId}`)
      table.delete(rowId)
    },
    writeBackup: (snapshot) => {
      writes.push(`backup:${snapshot.rowCount}`)
      backups.push({ rowCount: snapshot.rowCount })
    },
    now: () => new Date('2026-11-06T05:00:00.000Z'),
  }
  return { deps, writes, backups, snapshot: () => [...table.values()] }
}

describe('A1 计划三态:rename / strip / noop', () => {
  it('新键无行 ⇒ 旧键最新鲜那一枚 rename;同旧键仍启用的第二枚进 refused,已停用的进 strip', () => {
    const plan = planKeySourceMigration(
      [
        row('r1', 'doubao', 'old', { credVersion: 3 }),
        row('r2', 'doubao', 'old', { credVersion: 9 }),
        row('r3', 'doubao', 'other'),
      ],
      [M('old', 'new')],
    )
    expect(plan.actions.map((a) => a.kind)).toEqual(['rename'])
    expect(plan.actions[0]).toMatchObject({ kind: 'rename', rowId: 'r2' })
    expect(plan.refused[0]).toMatchObject({ rowId: 'r1' })

    const withStripped = planKeySourceMigration(
      [
        row('r1', 'doubao', 'old', { credVersion: 3, isEnabled: false }),
        row('r2', 'doubao', 'old', { credVersion: 9 }),
      ],
      [M('old', 'new')],
    )
    expect(withStripped.actions.map((a) => a.kind)).toEqual(['rename', 'strip'])
    expect(withStripped.refused).toHaveLength(0)
  })

  it('新键已有行 ⇒ 只摘已停用的旧键枚;仍启用即整批 REFUSED(绝不丢在用号)', () => {
    const stripped = planKeySourceMigration(
      [row('r1', 'doubao', 'old', { isEnabled: false }), row('r2', 'doubao', 'new')],
      [M('old', 'new')],
    )
    expect(stripped.actions.map((a) => a.kind)).toEqual(['strip'])
    const refused = planKeySourceMigration(
      [row('r1', 'doubao', 'old'), row('r2', 'doubao', 'new')],
      [M('old', 'new')],
    )
    expect(refused.actions).toHaveLength(0)
    expect(refused.refused[0]?.why).toContain('在用号')
  })

  it('旧键已无行 / from==to ⇒ noop(幂等的定义)', () => {
    const plan = planKeySourceMigration(
      [row('r1', 'doubao', 'new')],
      [M('old', 'new'), M('x', 'x')],
    )
    expect(plan.actions.every((a) => a.kind === 'noop')).toBe(true)
  })

  it('映射缺字段 ⇒ 进 refused 点名,不静默跳过', () => {
    const plan = planKeySourceMigration([row('r1', 'doubao', 'old')], [
      { providerCode: 'doubao', fromUid: '', toUid: 'new' },
    ] as UidMapping[])
    expect(plan.refused[0]?.why).toContain('缺 providerCode/fromUid/toUid')
  })
})

describe('A2 同键多行分组按 owner 分桶(个人池≠运营池重复)', () => {
  it('同 provider+uid 不同 owner ⇒ 0 组;同 owner ⇒ 1 组', () => {
    const rows = [row('r1', 'qoder', 'u1'), row('r2', 'qoder', 'u1', { ownerUserId: 'u-9' })]
    expect(duplicateKeyGroups(rows)).toHaveLength(0)
    expect(duplicateKeyGroups([...rows, row('r3', 'qoder', 'u1')])).toHaveLength(1)
    expect(duplicateKeyGroups([...rows, row('r3', 'qoder', 'u1')])[0]?.ids).toEqual(['r1', 'r3'])
  })
})

describe('A3 跑两次行数不变(幂等可重跑的实质交付)', () => {
  it('第一次落 1 rename;第二次零动作,rowCount 与 distinctKeys 逐字相同', async () => {
    const pool = fakePool([
      row('r1', 'doubao', 'old'),
      row('r2', 'trae', 'keep'),
      row('r3', 'qoder', 'keep2'),
    ])
    const first = await applyPlan(pool.deps, [M('old', 'new')])
    expect(first.state).toBe('applied')
    expect(first.rc).toBe(0)
    const afterFirst = pool.snapshot()
    expect(first.line).toContain('rowCount=3')
    expect(first.line).toContain('rerunActions=0')
    expect(afterFirst.find((r) => r.id === 'r1')?.uid).toBe('new')

    const second = await applyPlan(pool.deps, [M('old', 'new')])
    expect(second.state).toBe('clean')
    expect(second.line).toContain('actions=0')
    expect(second.rc).toBe(0)
    const afterSecond = pool.snapshot()
    expect(afterSecond.length).toBe(afterFirst.length)
    expect(planKeySourceMigration(afterSecond, []).distinctKeyCount).toBe(
      planKeySourceMigration(afterFirst, []).distinctKeyCount,
    )
    expect(pool.writes.filter((w) => w.startsWith('rename:') || w.startsWith('delete:'))).toEqual([
      'rename:r1→new',
    ])
  })

  it('strip 分支同样可重跑:摘完后第二次一条不写,行数差 1 只在第一次发生', async () => {
    const pool = fakePool([
      row('r1', 'doubao', 'old', { isEnabled: false }),
      row('r2', 'doubao', 'new'),
    ])
    const first = await applyPlan(pool.deps, [M('old', 'new')])
    expect(first.state).toBe('applied')
    expect(pool.snapshot()).toHaveLength(1)
    const second = await applyPlan(pool.deps, [M('old', 'new')])
    expect(second.state).toBe('clean')
    expect(pool.snapshot()).toHaveLength(1)
  })
})

describe('A4 备份先于写、备份坏 ⇒ 一条都不写', () => {
  it('writeBackup 抛错 ⇒ state=unjudged rc=2 且零 rename 零 delete', async () => {
    const pool = fakePool([row('r1', 'doubao', 'old')])
    pool.deps.writeBackup = () => {
      throw new Error('盘不可写')
    }
    const out = await applyPlan(pool.deps, [M('old', 'new')])
    expect(out.state).toBe('unjudged')
    expect(out.rc).toBe(2)
    expect(out.line).toContain('stage=backup')
    expect(pool.writes.some((w) => w.startsWith('rename:'))).toBe(false)
    expect(pool.snapshot()[0]?.uid).toBe('old')
  })

  it('整行回读枚数对不上 ⇒ unjudged,不写', async () => {
    const pool = fakePool([row('r1', 'doubao', 'old')])
    pool.deps.selectFullRows = async () => []
    const out = await applyPlan(pool.deps, [M('old', 'new')])
    expect(out.state).toBe('unjudged')
    expect(out.line).toContain('stage=backup-readback')
    expect(pool.writes.some((w) => w.startsWith('rename:'))).toBe(false)
  })

  it('仍启用的旧键枚 ⇒ refused 且不碰备份', async () => {
    const pool = fakePool([row('r1', 'doubao', 'old'), row('r2', 'doubao', 'new')])
    const out = await applyPlan(pool.deps, [M('old', 'new')])
    expect(out.state).toBe('refused')
    expect(out.rc).toBe(1)
    expect(pool.writes).toHaveLength(0)
  })
})

describe('A5 结论行形态唯一(读数不得折行、字段齐备)', () => {
  it('conclude 恒定带 state/rowCount/distinctKeys/dupGroups/actions/noop/refused', () => {
    const plan = planKeySourceMigration([row('r1', 'doubao', 'old')], [M('old', 'new')])
    const line = conclude('planned', plan, { mode: 'check' })
    expect(line).toBe(
      'AUDIT-RESULT state=planned rowCount=1 distinctKeys=1 dupGroups=0 actions=1 noop=0 refused=0 mode=check',
    )
    expect(line.includes('\n')).toBe(false)
  })

  it('枚举到 0 个映射 ⇒ actions=0 但 distinctKeys 仍如实报数(不冒充"已迁")', () => {
    const plan = planKeySourceMigration([row('r1', 'doubao', 'old'), row('r2', 'trae', 'x')], [])
    expect(plan.actions).toHaveLength(0)
    expect(plan.distinctKeyCount).toBe(2)
    expect(plan.rowCount).toBe(2)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
