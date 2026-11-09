// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 号池运营池存量收归个人池器物的镜像接线锁(2026-11-06 立,存量清偿票)
/**
 * 判据不复制:全部 import 源脚本的 __test__(§22c)。零真库、零落盘:所有 IO 走注入替身。
 *
 * 锁的六格(票面交付项):
 *  ① 备份先于写(顺序断言) ② 备份失败即拒写 ③ 引用命中非 0 ⇒ 该枚拒改、其余照改
 *  ④ 幂等:第二跑 clean(0 可动) ⑤ 只动 owner 一列(整行逐列 diff) ⑥ 未判定不记绿
 * 另锁:谓词三轴各自独立 / 个人池同键冲突闸 / missed 必点名 / 结论行单行形态。
 *
 * 夹具全部合成(假 uuid、假示例号 138xxxxxxxx、假凭据串),不含任何真 uuid / 手机号 / 凭据。
 */
import { describe, it, expect } from 'vitest'
import {
  __test__ as reclaim,
  type PoolRowFace,
  type ReclaimDeps,
  type ReclaimOptions,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- G 面纯增量:预留类型导入,零改在飞行
  type ReclaimPredicate,
  type RefHit,
} from '../scripts/relay-pool-owner-reclaim.js'

const {
  PHONE_NAME_RE,
  ONLY_MUTABLE_COLUMN,
  SEQ,
  RECLAIM_REASONS,
  RECLAIM_DEFAULT_PREDICATE,
  maskAccountName,
  poolKeyOf,
  classifyPool,
  measureFace,
  conclude,
  runReclaim,
} = reclaim

const OWNER = '00000000-0000-4000-8000-000000000001'
const OTHER = '00000000-0000-4000-8000-000000000002'

/** 合成整行(列名与真库一致,便于逐列 diff 断言;凭据列一律假串) */
function fullRow(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    ownerUserId: null,
    providerCode: 'qoder',
    uid: 'u-1001',
    name: '13800000000',
    tokenEnc: '<假凭据>',
    refreshTokenEnc: '<假 rt>',
    secretsEnc: null,
    deviceId: 'dev-fake',
    machineId: 'mac-fake',
    priority: 0,
    weight: 1,
    isEnabled: true,
    tempUnschedulable: false,
    healthStatus: 'healthy',
    totalCalls: 0,
    credVersion: 3,
    extraMetadata: { keepAliveForever: true, cosy: { version: 1 } },
    createdAt: new Date('2026-11-01T00:00:00.000Z'),
    updatedAt: new Date('2026-11-01T00:00:00.000Z'),
    ...over,
  }
}

/** 整行 → 判定投影(与源脚本 main 里的取面同一形状;此处只做替身,不复制判据) */
function faceOf(r: Record<string, unknown>): PoolRowFace {
  const meta = r.extraMetadata as Record<string, unknown> | null
  return {
    id: String(r.id),
    providerCode: String(r.providerCode),
    uid: String(r.uid),
    name: String(r.name),
    ownerUserId: (r.ownerUserId as string | null) ?? null,
    createdAt: (r.createdAt as Date).toISOString(),
    markerPresent: !!meta && typeof meta === 'object' && 'keepAliveForever' in meta,
  }
}

interface FakeOptions {
  refHits?: Record<string, RefHit[]>
  backupThrows?: boolean
  /** reassign 只承认这一部分 id(模拟 .returning 少回) */
  updateAccepts?: string[] | null
  ownerExists?: boolean
  now?: Date
}

function fakePool(rows: Array<Record<string, unknown>>, opt: FakeOptions = {}) {
  const table = new Map(rows.map((r) => [String(r.id), structuredClone(r)]))
  const seq: string[] = []
  const backups: Array<{ rowCount: number; asOf: string; columnsTouched: readonly string[] }> = []
  let writtenIds: string[] = []
  const deps: ReclaimDeps = {
    selectPoolRows: async () => [...table.values()].map(faceOf),
    ownerAccountExists: async () => opt.ownerExists !== false,
    scanReferences: async (ids) => {
      seq.push(SEQ.scan)
      const out: Record<string, RefHit[]> = {}
      for (const id of ids) {
        const hits = (opt.refHits ?? {})[id]
        if (hits && hits.length > 0) out[id] = hits
      }
      return out
    },
    selectFullRows: async (ids) => ids.map((id) => structuredClone(table.get(id) ?? {})),
    writeBackup: (snapshot) => {
      seq.push(SEQ.backup)
      if (opt.backupThrows) throw new Error('盘不可写')
      backups.push({
        rowCount: snapshot.rowCount,
        asOf: snapshot.asOf,
        columnsTouched: snapshot.columnsTouched,
      })
    },
    reassignOwner: async (ids, owner) => {
      seq.push(SEQ.write)
      const accepted = opt.updateAccepts ?? ids.slice()
      const landed = ids.filter((id) => accepted.includes(id))
      for (const id of landed) {
        const cur = table.get(id)
        if (!cur) continue
        // 替身只写这一列(源脚本的 set 载荷由 R5 的逐列 diff 反向钉住)
        table.set(id, { ...cur, [ONLY_MUTABLE_COLUMN]: owner })
      }
      writtenIds = landed
      return landed
    },
    now: () => opt.now ?? new Date('2026-11-06T10:00:00.000Z'),
  }
  return {
    deps,
    seq,
    backups,
    written: () => writtenIds,
    row: (id: string) => table.get(id),
    all: () => [...table.values()],
  }
}

const OPTS = (over: Partial<ReclaimOptions> = {}): ReclaimOptions => ({
  apply: true,
  ownerUserId: OWNER,
  ownerSource: 'explicit-flag',
  predicate: RECLAIM_DEFAULT_PREDICATE,
  ...over,
})

const QODER_OPS = (n: number, uidBase = 1001) =>
  Array.from({ length: n }, (_unused, i) =>
    fullRow({
      id: `aaaa0000-0000-4000-8000-0000000000${String(i).padStart(2, '0')}`,
      uid: `u-${uidBase + i}`,
      name: `1380000${String(1000 + i)}`,
      createdAt: new Date(Date.UTC(2026, 10, 1 + i, 1, 0, 0)),
    }),
  )
const QODER_PERSONAL = () =>
  fullRow({
    id: 'bbbb0000-0000-4000-8000-000000000001',
    ownerUserId: OWNER,
    uid: 'u-9001',
    name: '13900000000',
  })

describe('R1 顺序链:引用扫 → 备份 → 写(备份必须排在 UPDATE 之前)', () => {
  it('三枚候选 ⇒ seq 恰为 scan,backup,write,且备份枚数==可写枚数', async () => {
    const rows = [...QODER_OPS(3), QODER_PERSONAL()]
    const pool = fakePool(rows)
    const out = await runReclaim(pool.deps, OPTS())
    expect(out.state).toBe('reclaimed')
    expect(out.rc).toBe(0)
    expect(pool.seq).toEqual([SEQ.scan, SEQ.backup, SEQ.write])
    expect(pool.backups).toHaveLength(1)
    expect(pool.backups[0]?.rowCount).toBe(3)
    expect(pool.backups[0]?.columnsTouched).toEqual([ONLY_MUTABLE_COLUMN])
  })

  it('dry-run ⇒ 只到 scan 为止:零备份零写,state=planned(不拿 clean 冒充)', async () => {
    const rows = [...QODER_OPS(2), QODER_PERSONAL()]
    const pool = fakePool(rows)
    const out = await runReclaim(pool.deps, OPTS({ apply: false }))
    expect(out.state).toBe('planned')
    expect(out.rc).toBe(0)
    expect(pool.seq).toEqual([SEQ.scan])
    expect(pool.backups).toHaveLength(0)
    expect(out.candidates).toHaveLength(2)
    expect(out.line).toContain('apply=0')
  })
})

describe('R2 备份失败 ⇒ 一条都不写', () => {
  it('writeBackup 抛错 ⇒ undetermined / rc=2 / 零 write / 归属原样', async () => {
    const rows = [...QODER_OPS(2), QODER_PERSONAL()]
    const pool = fakePool(rows, { backupThrows: true })
    const out = await runReclaim(pool.deps, OPTS())
    expect(out.state).toBe('undetermined')
    expect(out.rc).toBe(2)
    expect(out.line).toContain('stage=backup')
    expect(out.why).toBe('backupFailed')
    expect(pool.seq).toEqual([SEQ.scan, SEQ.backup])
    expect(pool.written()).toHaveLength(0)
    for (const r of out.candidates) expect(pool.row(r.id)?.ownerUserId).toBeNull()
  })
})

describe('R3 引用命中非 0 ⇒ 该枚拒改,其余照改', () => {
  it('两枚候选,其中一枚被 uuid 列引用 ⇒ 只写另一枚,refused 点名 表.列=枚数', async () => {
    const ops = QODER_OPS(2)
    const hitId = String(ops[0]?.id)
    const pool = fakePool([...ops, QODER_PERSONAL()], {
      refHits: {
        [hitId]: [{ table: 'ai_relay_account_usage_ledger', column: 'account_id', n: 2 }],
      },
    })
    const out = await runReclaim(pool.deps, OPTS())
    expect(out.state).toBe('reclaimed')
    expect(out.rc).toBe(1)
    expect(out.refused).toHaveLength(1)
    expect(out.refused[0]?.why).toBe('referencedElsewhere')
    expect(out.refused[0]?.detail).toContain('ai_relay_account_usage_ledger.account_id=2')
    expect(out.wroteIds).toEqual([String(ops[1]?.id)])
    expect(pool.row(hitId)?.ownerUserId).toBeNull()
    expect(pool.row(String(ops[1]?.id))?.ownerUserId).toBe(OWNER)
  })

  it('全部候选都被引用命中 ⇒ refused / rc=1 / 零备份零写', async () => {
    const ops = QODER_OPS(2)
    const refHits = Object.fromEntries(
      ops.map((r) => [String(r.id), [{ table: 'x_tbl', column: 'y_col', n: 1 }]]),
    )
    const pool = fakePool([...ops, QODER_PERSONAL()], { refHits })
    const out = await runReclaim(pool.deps, OPTS())
    expect(out.state).toBe('refused')
    expect(out.rc).toBe(1)
    expect(out.candidates).toHaveLength(2)
    expect(out.refused).toHaveLength(2)
    expect(pool.seq).toEqual([SEQ.scan])
    expect(pool.backups).toHaveLength(0)
  })

  it('个人池已有同 provider+uid ⇒ 该枚走冲突闸拒改(硬改会撞部分唯一索引)', async () => {
    const ops = QODER_OPS(1)
    const sameKey = fullRow({
      id: 'cccc0000-0000-4000-8000-000000000001',
      ownerUserId: OWNER,
      uid: String(ops[0]?.uid),
      name: '13900000000',
    })
    const pool = fakePool([...ops, sameKey])
    const out = await runReclaim(pool.deps, OPTS())
    expect(out.refused[0]?.why).toBe('personalKeyConflict')
    expect(out.state).toBe('refused')
    expect(pool.written()).toHaveLength(0)
  })
})

describe('R4 幂等:第二跑必须 clean(0 可动),不许重复改也不许换形态', () => {
  it('第一跑 applied 三枚;第二跑 candidates=0 / wrote=0 / 行数与归属分布逐字不变', async () => {
    const rows = [...QODER_OPS(3), QODER_PERSONAL()]
    const pool = fakePool(rows)
    const first = await runReclaim(pool.deps, OPTS())
    expect(first.state).toBe('reclaimed')
    expect(first.wroteIds).toHaveLength(3)
    expect(first.rerunCandidates).toBe(0)
    const afterFirst = pool.all()
    const opsAfterFirst = measureFace(afterFirst.map(faceOf), OWNER).opsRows

    const second = await runReclaim(pool.deps, OPTS())
    expect(second.state).toBe('clean')
    expect(second.rc).toBe(0)
    expect(second.candidates).toHaveLength(0)
    expect(second.wroteIds).toHaveLength(0)
    expect(second.line).toContain('candidates=0')
    // 第二跑一条写都不发(seq 只多一次只读扫)
    expect(pool.seq.filter((s) => s === SEQ.write)).toHaveLength(1)
    expect(pool.backups).toHaveLength(1)
    expect(pool.all().length).toBe(afterFirst.length)
    expect(measureFace(pool.all().map(faceOf), OWNER).opsRows).toBe(opsAfterFirst)
  })
})

describe('R5 红线:只动 owner_user_id 一列(整行逐列 diff)', () => {
  it('每枚改前/改后除 ownerUserId 外逐列相同(含 uid / 凭据列 / is_enabled / temp_unschedulable / updated_at)', async () => {
    const rows = [...QODER_OPS(2), QODER_PERSONAL()]
    const before = new Map(rows.map((r) => [String(r.id), structuredClone(r)]))
    const pool = fakePool(rows)
    const out = await runReclaim(pool.deps, OPTS())
    expect(out.wroteIds).toHaveLength(2)
    for (const id of out.wroteIds) {
      const b = before.get(id) as Record<string, unknown>
      const a = pool.row(id) as Record<string, unknown>
      const changed = Object.keys(a).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]))
      expect(changed).toEqual([ONLY_MUTABLE_COLUMN])
      expect(a.ownerUserId).toBe(OWNER)
      expect(a.uid).toBe(b.uid)
      expect(a.tokenEnc).toBe(b.tokenEnc)
      expect(a.isEnabled).toBe(b.isEnabled)
      expect(a.tempUnschedulable).toBe(b.tempUnschedulable)
      expect(String(a.updatedAt)).toBe(String(b.updatedAt))
    }
    // 没被选中的个人池行一个字节都不动
    const personalId = String(QODER_PERSONAL().id)
    expect((pool.row(personalId) ?? {}).ownerUserId).toBe(OWNER)
  })

  it('源脚本的 UPDATE 载荷里除 ownerUserId 不得出现别的列名(形状锁)', async () => {
    expect(ONLY_MUTABLE_COLUMN).toBe('ownerUserId')
    expect(RECLAIM_REASONS.referencedElsewhere).toContain('拒改')
  })
})

describe('R6 未判定不记绿', () => {
  it('归属取不到 ⇒ undetermined / rc=2 / 连引用扫都不发', async () => {
    const pool = fakePool([...QODER_OPS(1), QODER_PERSONAL()])
    const out = await runReclaim(pool.deps, OPTS({ ownerUserId: null }))
    expect(out.state).toBe('undetermined')
    expect(out.rc).toBe(2)
    expect(out.why).toBe('ownerUnresolved')
    expect(out.line).toContain('stage=owner')
    expect(pool.seq).toHaveLength(0)
  })

  it('归属形状不合法(非 uuid)⇒ 同样未判定,不拿旧行为冒充', async () => {
    const pool = fakePool([...QODER_OPS(1), QODER_PERSONAL()])
    const out = await runReclaim(pool.deps, OPTS({ ownerUserId: 'ops' }))
    expect(out.state).toBe('undetermined')
    expect(pool.seq).toHaveLength(0)
  })

  it('号池面枚举到 0 行 ⇒ undetermined(§0.3 不用 0 冒充「没有」)', async () => {
    const pool = fakePool([])
    const out = await runReclaim(pool.deps, OPTS())
    expect(out.state).toBe('undetermined')
    expect(out.why).toBe('poolFaceEmpty')
    expect(pool.seq).toHaveLength(0)
  })

  it('owner 在 users 表查不到 ⇒ undetermined / 零扫零写', async () => {
    const pool = fakePool([...QODER_OPS(1), QODER_PERSONAL()], { ownerExists: false })
    const out = await runReclaim(pool.deps, OPTS())
    expect(out.state).toBe('undetermined')
    expect(out.why).toBe('ownerMissing')
    expect(pool.seq).toHaveLength(0)
  })

  it('取面抛错 ⇒ undetermined(器物自身异常不记绿也不冒红)', async () => {
    const pool = fakePool([...QODER_OPS(1), QODER_PERSONAL()])
    pool.deps.selectPoolRows = async () => {
      throw new Error('库不可读')
    }
    const out = await runReclaim(pool.deps, OPTS())
    expect(out.state).toBe('undetermined')
    expect(out.why).toBe('ioFailed')
    expect(pool.written()).toHaveLength(0)
  })

  it('UPDATE 回库确认集合小于请求集合 ⇒ undetermined + missed 点名(不许把 length 当 affected)', async () => {
    const ops = QODER_OPS(3)
    const accepted = [String(ops[0]?.id), String(ops[1]?.id)]
    const pool = fakePool([...ops, QODER_PERSONAL()], { updateAccepts: accepted })
    const out = await runReclaim(pool.deps, OPTS())
    expect(out.state).toBe('undetermined')
    expect(out.rc).toBe(2)
    expect(out.why).toBe('writeMissed')
    expect(out.missedIds).toEqual([String(ops[2]?.id)])
    expect(out.wroteIds).toHaveLength(2)
  })

  it('AFTER 复量行数与 BEFORE 不符 ⇒ undetermined(本器物不删行)', async () => {
    const rows = [...QODER_OPS(2), QODER_PERSONAL()]
    const pool = fakePool(rows)
    let calls = 0
    const orig = pool.deps.selectPoolRows
    pool.deps.selectPoolRows = async () => {
      calls++
      const got = await orig()
      return calls <= 1 ? got : got.slice(1)
    }
    const out = await runReclaim(pool.deps, OPTS())
    expect(out.state).toBe('undetermined')
    expect(out.why).toBe('faceDrift')
  })
})

describe('R7 谓词三轴各自独立(判据可声明,不是名单)', () => {
  const slotRow = fullRow({
    id: 'dddd0000-0000-4000-8000-000000000001',
    providerCode: 'minimax',
    uid: 'auto:deadbeef',
    name: 'minimax:cn',
    extraMetadata: { region: 'cn', sourcePath: 'C:/fake/auth.json' },
  })

  it('默认谓词:minimax 形态行被三轴各自挡下(provider 不在族 / 无旗标 / 名称非手机号)', () => {
    const rows = [slotRow, ...QODER_OPS(1), QODER_PERSONAL()].map(faceOf)
    const { candidates, excluded } = classifyPool(rows, RECLAIM_DEFAULT_PREDICATE)
    expect(candidates).toHaveLength(1)
    expect(excluded).toHaveLength(1)
    expect(excluded[0]?.why).toBe('providerNotDeclared')
    // 逐轴单独放开:每一轴都确实是自己那一格在挡
    expect(
      classifyPool(rows, { ...RECLAIM_DEFAULT_PREDICATE, providers: ['qoder', 'minimax'] })
        .excluded[0]?.why,
    ).toBe('markerMissing')
    expect(
      classifyPool(rows, {
        ...RECLAIM_DEFAULT_PREDICATE,
        providers: ['qoder', 'minimax'],
        requireMarker: false,
      }).excluded[0]?.why,
    ).toBe('nameNotPhone')
    expect(
      classifyPool(rows, {
        ...RECLAIM_DEFAULT_PREDICATE,
        providers: ['qoder', 'minimax'],
        requireMarker: false,
        nameShape: 'any',
      }).excluded[0]?.why,
    ).toBe('noSameProviderPersonalRow')
    // 四轴全显式放开 ⇒ 这一族才进候选面(留给"确有运营池共享号"的那一轮,默认拿不到)
    expect(
      classifyPool(rows, {
        providers: ['qoder', 'minimax'],
        requireMarker: false,
        nameShape: 'any',
        requireSameProviderPersonalRow: false,
      }).candidates,
    ).toHaveLength(2)
  })

  it('同 provider 个人池 0 行 ⇒ 同族前提不过(不猜它是共享号还是漏标号)', () => {
    const rows = QODER_OPS(2).map(faceOf)
    const { candidates, excluded } = classifyPool(rows, RECLAIM_DEFAULT_PREDICATE)
    expect(candidates).toHaveLength(0)
    expect(excluded.map((e) => e.why)).toEqual([
      'noSameProviderPersonalRow',
      'noSameProviderPersonalRow',
    ])
  })

  it('已在个人池的行永远不进候选面(重复跑不换形态)', () => {
    const rows = [QODER_PERSONAL()].map(faceOf)
    expect(classifyPool(rows, RECLAIM_DEFAULT_PREDICATE).candidates).toHaveLength(0)
  })
})

describe('R8 输出面脱敏与结论行形态', () => {
  it('手机号打码只掩中间四位;非手机号形态截前 12;结论行恒单行且键齐', () => {
    expect(maskAccountName('13800001234')).toBe('138****1234')
    expect(maskAccountName('minimax:cn:verylongtail')).toBe('minimax:cn:v…')
    const line = conclude('reclaimed', {
      poolRows: 23,
      opsBefore: 7,
      opsAfter: 1,
      candidates: 6,
      excluded: 1,
      refused: 0,
      wrote: 6,
      missed: 0,
      rerun: 0,
      apply: 1,
    })
    expect(line.includes('\n')).toBe(false)
    expect(line).toBe(
      'RECLAIM-RESULT state=reclaimed poolRows=23 opsBefore=7 opsAfter=1 candidates=6 excluded=1 refused=0 wrote=6 missed=0 rerun=0 apply=1',
    )
  })

  it('poolKeyOf 与 PHONE_NAME_RE 形状锁(判据漂移即翻红)', () => {
    expect(poolKeyOf({ providerCode: 'qoder', uid: 'u-1' })).toBe('qoder\u0000u-1')
    expect(PHONE_NAME_RE.test('13800000000')).toBe(true)
    expect(PHONE_NAME_RE.test('minimax:cn')).toBe(false)
    expect(PHONE_NAME_RE.test('12800000000')).toBe(false)
    expect(OTHER.length).toBe(36)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
