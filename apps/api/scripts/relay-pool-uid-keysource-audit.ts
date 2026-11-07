// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// Z66 席新建(第 3 件):号池 uid 键源收敛器/校验器(幂等可重跑)
/**
 * 号池 (provider_code, uid) 键源收敛器 + 只读校验器(2026-11-06 立,Y-24 交回第 3 件)。
 *
 * 成因:`c59c7052e5` 那次「25 行 → 23 行」的同批迁库是**一次性手跑**,仓内没有同款可复用
 * 器物(Z47 现读:`MIGRATE-RESULT` 全仓 0 命中;`git show --stat c59c7052e5` 只含 2 文件)。
 * 键源口径还会继续动(minimax recordKey / zcode 声明 / 豆包 uid_tt 各族),每动一次就得把
 * 「已在池里的旧键行」迁到新键 —— 没有器物就只能靠人记,记漏一次就是孤儿行回潮。
 *
 * 档位:
 *  - `--check`(默认)零写只报数:行数 / 去重键数 / 同键多行分组 / 映射可执行性。
 *  - `--apply --uid-map <file.json>` 才落盘,动作只有三种:
 *      rename = 新键无行 ⇒ 把旧键里"最新鲜"那一枚的 uid 改成新键(其余旧键枚进 strip);
 *      strip  = 新键已有行(或同旧键第二枚)⇒ 摘掉旧键枚,**仅当 is_enabled=false**;
 *      noop   = 旧键已无行 ⇒ 幂等,第二次跑一条动作都不产生(这是"可重跑"的定义)。
 *    任一旧键枚仍启用 ⇒ 整批 REFUSED(exit 1):宁可留重复也绝不丢在用号。
 *  - 写之前整池整行备份到 D:/DevEnv/backups/relay-pool/(备份写不进/回读枚数不 ⇒ 一条都不写)。
 *
 * 三态结论(§0.3 取不到不冒绿):`AUDIT-RESULT state=clean|planned|applied|refused|unjudged …`
 * 用法(先进入 apps/api):
 *   pnpm exec tsx scripts/relay-pool-uid-keysource-audit.ts [--check] [--json]
 *   pnpm exec tsx scripts/relay-pool-uid-keysource-audit.ts --apply --uid-map <mappings.json>
 *   映射形如 [{providerCode,ownerUserId,fromUid,toUid}](ownerUserId 省略/null = 运营池)
 * 退出码:0 clean|planned|applied / 1 refused / 2 unjudged(映射文件坏、非 --apply 却要给写、备份失败)。
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export interface PoolRowRef {
  id: string
  providerCode: string
  uid: string
  ownerUserId: string | null
  isEnabled: boolean
  credVersion: number
  lastRefreshAt: string | null
}

export interface UidMapping {
  providerCode: string
  ownerUserId?: string | null
  fromUid: string
  toUid: string
}

export type PlannedAction =
  | { kind: 'rename'; mapping: UidMapping; rowId: string }
  | { kind: 'strip'; mapping: UidMapping; rowId: string }
  | { kind: 'noop'; mapping: UidMapping }

export type AuditState = 'clean' | 'planned' | 'applied' | 'refused' | 'unjudged'

export interface Plan {
  actions: PlannedAction[]
  refused: Array<{ mapping: UidMapping; rowId: string; why: string }>
  rowCount: number
  distinctKeyCount: number
  duplicateKeyGroups: Array<{
    providerCode: string
    ownerUserId: string | null
    uid: string
    ids: string[]
  }>
}

/** 去重键 = (owner 档, provider, uid),与库侧两条部分唯一索引同口径 */
export function keyOf(r: {
  providerCode: string
  ownerUserId: string | null
  uid: string
}): string {
  return `${r.ownerUserId ?? '\u0000ops'}\u0000${r.providerCode}\u0000${r.uid}`
}

/** 同键多行分组(池面真重复;个人池与运营池同 uid 不算重复) */
export function duplicateKeyGroups(rows: readonly PoolRowRef[]): Plan['duplicateKeyGroups'] {
  const byKey = new Map<string, PoolRowRef[]>()
  for (const r of rows) byKey.set(keyOf(r), [...(byKey.get(keyOf(r)) ?? []), r])
  const groups: Plan['duplicateKeyGroups'] = []
  for (const g of byKey.values()) {
    const head = g[0]
    if (!head || g.length < 2) continue
    groups.push({
      providerCode: head.providerCode,
      ownerUserId: head.ownerUserId,
      uid: head.uid,
      ids: g.map((x) => x.id).sort(),
    })
  }
  return groups.sort((a, b) =>
    `${a.providerCode}/${a.uid}`.localeCompare(`${b.providerCode}/${b.uid}`),
  )
}

/** 最新鲜 keeper 判据:credVersion 高者 → lastRefreshAt 新者 → id 字典序(必须确定可测) */
function freshest(cands: readonly PoolRowRef[]): PoolRowRef | undefined {
  return [...cands].sort(
    (a, b) =>
      b.credVersion - a.credVersion ||
      String(b.lastRefreshAt ?? '').localeCompare(String(a.lastRefreshAt ?? '')) ||
      a.id.localeCompare(b.id),
  )[0]
}

/**
 * 出计划(纯函数、零 IO)。幂等性由此保证:rename 落库后旧键无行 ⇒ 第二次整批 noop。
 */
export function planKeySourceMigration(
  rows: readonly PoolRowRef[],
  mappings: readonly UidMapping[],
): Plan {
  const actions: PlannedAction[] = []
  const refused: Plan['refused'] = []
  const byKey = new Map<string, PoolRowRef[]>()
  for (const r of rows) byKey.set(keyOf(r), [...(byKey.get(keyOf(r)) ?? []), r])

  for (const m of mappings) {
    if (!m.providerCode || !m.fromUid || !m.toUid) {
      refused.push({ mapping: m, rowId: '-', why: '映射缺 providerCode/fromUid/toUid 之一' })
      continue
    }
    const owner = m.ownerUserId ?? null
    const fromRows =
      byKey.get(keyOf({ providerCode: m.providerCode, ownerUserId: owner, uid: m.fromUid })) ?? []
    if (m.fromUid === m.toUid || fromRows.length === 0) {
      actions.push({ kind: 'noop', mapping: m })
      continue
    }
    const toRows =
      byKey.get(keyOf({ providerCode: m.providerCode, ownerUserId: owner, uid: m.toUid })) ?? []
    if (toRows.length > 0) {
      for (const r of fromRows) {
        if (r.isEnabled)
          refused.push({
            mapping: m,
            rowId: r.id,
            why: `新键 ${m.toUid} 已有行,而旧键枚仍启用 ⇒ 宁可留重复也绝不丢在用号`,
          })
        else actions.push({ kind: 'strip', mapping: m, rowId: r.id })
      }
      continue
    }
    const keeper = freshest(fromRows)
    if (!keeper) {
      refused.push({
        mapping: m,
        rowId: '-',
        why: '旧键集内挑不出 keeper(枚举到行却排不出)⇒ 未判定,不猜该动哪一枚',
      })
      continue
    }
    actions.push({ kind: 'rename', mapping: m, rowId: keeper.id })
    for (const r of fromRows) {
      if (r.id === keeper.id) continue
      if (r.isEnabled)
        refused.push({
          mapping: m,
          rowId: r.id,
          why: '同旧键的第二枚仍启用,拒绝自动摘除(需人工裁决归属)',
        })
      else actions.push({ kind: 'strip', mapping: m, rowId: r.id })
    }
  }
  return {
    actions,
    refused,
    rowCount: rows.length,
    distinctKeyCount: new Set(rows.map(keyOf)).size,
    duplicateKeyGroups: duplicateKeyGroups(rows),
  }
}

/** 结论行(唯一形态;`rerunActions` 是幂等自证:第二次跑的非常规动作枚数) */
export function conclude(
  state: AuditState,
  plan: Plan,
  extra: Record<string, string | number> = {},
): string {
  const mutable = plan.actions.filter((a) => a.kind !== 'noop').length
  return [
    `AUDIT-RESULT state=${state}`,
    `rowCount=${plan.rowCount}`,
    `distinctKeys=${plan.distinctKeyCount}`,
    `dupGroups=${plan.duplicateKeyGroups.length}`,
    `actions=${mutable}`,
    `noop=${plan.actions.length - mutable}`,
    `refused=${plan.refused.length}`,
    ...Object.entries(extra).map(([k, v]) => `${k}=${v}`),
  ].join(' ')
}

export interface ApplyDeps {
  selectAll: () => Promise<PoolRowRef[]>
  selectFullRows: (ids: readonly string[]) => Promise<Array<Record<string, unknown>>>
  renameUid: (rowId: string, toUid: string) => Promise<void>
  deleteRow: (rowId: string) => Promise<void>
  /**
   * 备份出口由调用方注入(测试零落盘、CLI 落 D:/DevEnv/backups/relay-pool)。
   * 抛错 = 备份失败 ⇒ 一条都不写。
   */
  writeBackup: (snapshot: {
    asOf: string
    rowCount: number
    rows: Array<Record<string, unknown>>
  }) => void
  now: () => Date
}

/**
 * 落盘腿(零 SQL 书写:全部经调用方注入,测试用 fake db、CLI 用真 db)。
 * 顺序固定:出计划 → 无动作即返回 → 备份整行并回读验枚数 → 逐条写 → 重跑自证幂等。
 */
export async function applyPlan(
  deps: ApplyDeps,
  mappings: readonly UidMapping[],
): Promise<{ state: AuditState; line: string; rc: number }> {
  const rows = await deps.selectAll()
  const plan = planKeySourceMigration(rows, mappings)
  if (plan.refused.length > 0)
    return {
      state: 'refused',
      line: conclude('refused', plan, { stage: 'preplan' }),
      rc: 1,
    }
  const mutable = plan.actions.filter((a) => a.kind !== 'noop')
  if (mutable.length === 0)
    return { state: 'clean', line: conclude('clean', plan, { stage: 'nothing-to-do' }), rc: 0 }

  const ids = mutable.map((a) => (a as { rowId: string }).rowId)
  const full = await deps.selectFullRows(ids)
  if (full.length !== ids.length)
    return {
      state: 'unjudged',
      line: conclude('unjudged', plan, {
        stage: 'backup-readback',
        want: ids.length,
        got: full.length,
      }),
      rc: 2,
    }
  try {
    deps.writeBackup({ asOf: deps.now().toISOString(), rowCount: full.length, rows: full })
  } catch (err) {
    return {
      state: 'unjudged',
      line: conclude('unjudged', plan, {
        stage: 'backup',
        why: err instanceof Error ? err.message : String(err),
      }),
      rc: 2,
    }
  }

  for (const a of mutable) {
    if (a.kind === 'rename') await deps.renameUid(a.rowId, a.mapping.toUid)
    else if (a.kind === 'strip') await deps.deleteRow(a.rowId)
  }

  const after = planKeySourceMigration(await deps.selectAll(), mappings)
  const rerun = after.actions.filter((a) => a.kind !== 'noop').length
  return {
    state: 'applied',
    line: conclude('applied', plan, { wrote: mutable.length, rerunActions: rerun }),
    rc: rerun === 0 ? 0 : 1,
  }
}

export const __test__ = { keyOf, duplicateKeyGroups, planKeySourceMigration, conclude, applyPlan }

async function main(): Promise<number> {
  const argv = process.argv.slice(2)
  const apply = argv.includes('--apply')
  const json = argv.includes('--json')
  const mapIdx = argv.indexOf('--uid-map')
  const mapPath = mapIdx >= 0 ? argv[mapIdx + 1] : undefined
  if (mapIdx >= 0 && (!mapPath || mapPath.startsWith('-'))) {
    process.stderr.write('❌ 未判定:--uid-map 需要一个映射文件路径\n')
    return 2
  }
  const { config } = await import('dotenv')
  config({ path: resolve(process.cwd(), '.env') })
  const { and, eq, inArray } = await import('drizzle-orm')
  const { aiRelayAccountPool } = await import('@ihui/database')
  const { db, dbRead } = await import('../src/db/index.js')

  const readRows = async (): Promise<PoolRowRef[]> => {
    const got = await dbRead
      .select({
        id: aiRelayAccountPool.id,
        providerCode: aiRelayAccountPool.providerCode,
        uid: aiRelayAccountPool.uid,
        ownerUserId: aiRelayAccountPool.ownerUserId,
        isEnabled: aiRelayAccountPool.isEnabled,
        credVersion: aiRelayAccountPool.credVersion,
        lastRefreshAt: aiRelayAccountPool.lastRefreshAt,
      })
      .from(aiRelayAccountPool)
    return got.map((r) => ({
      ...r,
      credVersion: Number(r.credVersion),
      lastRefreshAt: r.lastRefreshAt ? new Date(r.lastRefreshAt).toISOString() : null,
    }))
  }

  let mappings: UidMapping[] = []
  if (mapPath) {
    try {
      mappings = JSON.parse(readFileSync(resolve(mapPath), 'utf8')) as UidMapping[]
    } catch (err) {
      process.stderr.write(
        `❌ 未判定:映射文件读不到/解析失败 ${mapPath}\n   ${err instanceof Error ? err.message : String(err)}\n`,
      )
      return 2
    }
  }

  const deps: ApplyDeps = {
    selectAll: readRows,
    selectFullRows: (ids) =>
      dbRead.select().from(aiRelayAccountPool).where(inArray(aiRelayAccountPool.id, ids)),
    renameUid: async (rowId, toUid) => {
      await db
        .update(aiRelayAccountPool)
        .set({ uid: toUid, updatedAt: new Date() })
        .where(and(eq(aiRelayAccountPool.id, rowId)))
    },
    deleteRow: async (rowId) => {
      await db.delete(aiRelayAccountPool).where(eq(aiRelayAccountPool.id, rowId))
    },
    writeBackup: (snapshot) => {
      const dir = 'D:/DevEnv/backups/relay-pool'
      mkdirSync(dir, { recursive: true })
      const file = resolve(dir, `uid-keysource-audit-${snapshot.asOf.replace(/[:.]/g, '-')}.json`)
      writeFileSync(file, JSON.stringify(snapshot, null, 2), 'utf8')
      const back = JSON.parse(readFileSync(file, 'utf8')) as { rowCount?: number }
      if (back.rowCount !== snapshot.rowCount)
        throw new Error(`备份回读枚数不符 ${String(back.rowCount)}≠${snapshot.rowCount}`)
    },
    now: () => new Date(),
  }

  if (!apply) {
    const plan = planKeySourceMigration(await readRows(), mappings)
    const state: AuditState = plan.refused.length
      ? 'refused'
      : plan.actions.some((a) => a.kind !== 'noop')
        ? 'planned'
        : 'clean'
    const line = conclude(state, plan, { mappings: mappings.length, mode: 'check' })
    process.stdout.write(json ? `${JSON.stringify({ state, line, plan }, null, 2)}\n` : `${line}\n`)
    for (const g of plan.duplicateKeyGroups)
      process.stdout.write(
        `  同键多行 ${g.providerCode}/${g.uid} owner=${g.ownerUserId ?? '运营池'} × ${g.ids.length}\n`,
      )
    for (const r of plan.refused)
      process.stdout.write(
        `  REFUSED ${r.mapping.fromUid}→${r.mapping.toUid} row=${r.rowId} ${r.why}\n`,
      )
    if (mappings.length === 0) process.stdout.write('  (未给 --uid-map:只报池面现状,不猜映射)\n')
    else process.stdout.write('  (只演不写:加 --apply 才落)\n')
    return state === 'refused' ? 1 : 0
  }

  const out = await applyPlan(deps, mappings)
  process.stdout.write(json ? `${JSON.stringify(out, null, 2)}\n` : `${out.line}\n`)
  return out.rc
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // db 模块一载入就起池与探测定时器 ⇒ 报完结论必须显式退进程(与 relay-account-import.ts 同法);
  // 只设 process.exitCode 会让本器物打印 AUDIT-RESULT 后挂住不退出(实测超时)。
  main().then(
    (rc) => process.exit(rc),
    (err) => {
      process.stderr.write(
        `❌ 未判定(器物自身异常): ${err instanceof Error ? err.message : String(err)}\n`,
      )
      process.exit(2)
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
