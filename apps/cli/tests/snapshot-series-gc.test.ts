// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// goal-b49 S3 落地锁:会话快照可寻址版本序列 `<uuid>@vN` + 三约束回收(取证 Q1 §4 #16:对方 244 目录 65 版零清理)。
// 钉住:解析/构造、回退·重号·畸形各自拒绝(带正例)、GC 三约束各自边界、清单腐烂不删并点名、
// 候选枚举到 0 判「未判定」不记绿、判据函数体零 fs 的形状锁、以及两个判据模块确有消费方(门 121)。
import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs' // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28
import { SNAPSHOT_SERIES_MAX_VERSION, allocateNextSnapshotSeriesRef, auditSnapshotSeriesOrdering, formatSnapshotSeriesDirName, parseSnapshotSeriesDirName, seriesUuidFromSeedHex } from '../src/checkpoints/snapshot-series.js'
import { DEFAULT_SNAPSHOT_GC_POLICY, judgeSnapshotGcPolicy, planSnapshotGc, type SnapshotGcCandidate, type SnapshotGcDeps, type SnapshotGcPolicy } from '../src/checkpoints/snapshot-gc.js'
import type { CorruptManifestEntry, ManifestReadResult } from '../src/checkpoints/manifest-integrity.js'
import { CheckpointManager } from '../src/checkpoints/index.js'

const U1 = '11111111-1111-4111-8111-111111111111'
const U2 = '22222222-2222-4222-8222-222222222222'
const DAY = 86_400_000
const NOW = Date.UTC(2026, 10, 5)
const OLD = 90 * DAY
const dir = (uuid: string, version: number) => `${uuid}@v${version}`
const cand = (version: number, bytes: number | null = 40, uuid = U1): SnapshotGcCandidate => ({ dirName: dir(uuid, version), bytes })
const stale3 = [cand(1), cand(2), cand(3)]
const allOld: Record<string, number> = { [dir(U1, 1)]: OLD, [dir(U1, 2)]: OLD, [dir(U1, 3)]: OLD }

interface Meta { id: string; createdAt: string }
type FakeManifest = Record<string, number | 'missing' | 'corrupt' | 'throw'>

function gcDeps(ages: FakeManifest, nowMs = NOW): SnapshotGcDeps<Meta> {
  return {
    nowMs: () => nowMs,
    readManifest: (dirName): ManifestReadResult<Meta> => {
      const age = ages[dirName]
      if (age === 'throw') throw new Error('夹具:清单读取炸了')
      if (age === undefined || age === 'missing') return { status: 'missing' }
      if (age === 'corrupt') {
        const entry: CorruptManifestEntry = { checkpointId: dirName, manifestPath: dirName, quarantinePath: null, reason: 'parse-failed', detail: '夹具:清单不是合法 JSON' }
        return { status: 'corrupt', entry }
      }
      return { status: 'ok', meta: { id: dirName, createdAt: new Date(nowMs - age).toISOString() } }
    },
  }
}
const policy = (over: Partial<SnapshotGcPolicy> = {}): SnapshotGcPolicy => ({ keepVersions: 2, maxAgeMs: 7 * DAY, maxTotalBytes: 100, ...over })
const namesOf = (plan: { deletions: Array<{ dirName: string }> }) => plan.deletions.map((d) => d.dirName)
const reasonsOf = (plan: { undetermined: Array<{ reason: string }> }) => plan.undetermined.map((u) => u.reason)

describe('① 版本序列解析与构造', () => {
  it('规范名解析成功、序列身份规范化为小写;构造 ⇄ 解析互逆,半档入参直接抛错', () => {
    const parsed = parseSnapshotSeriesDirName(dir(U1.toUpperCase(), 7))
    if (!parsed.ok) throw new Error('规范名竟被判畸形')
    expect(parsed.ref).toEqual({ uuid: U1, version: 7 })
    expect(formatSnapshotSeriesDirName({ uuid: U1, version: 1 })).toBe(dir(U1, 1))
    expect(() => formatSnapshotSeriesDirName({ uuid: 'nope', version: 1 })).toThrow(RangeError)
    expect(() => formatSnapshotSeriesDirName({ uuid: U1, version: 0 })).toThrow(RangeError)
    expect(() => formatSnapshotSeriesDirName({ uuid: U1, version: 1.5 })).toThrow(RangeError)
  })
  it('序列身份由种子摘要推导:恒定可寻址,长度不对即拒;下一版分配空序列从 v1 起', () => {
    expect(seriesUuidFromSeedHex('f'.repeat(32))).toEqual({ ok: true, uuid: 'ffffffff-ffff-ffff-ffff-ffffffffffff' })
    expect(seriesUuidFromSeedHex('f'.repeat(31)).ok).toBe(false)
    expect(allocateNextSnapshotSeriesRef([], U1)).toMatchObject({ ok: true, ref: { version: 1 } })
  })
  it('下一版分配:已有取最大 +1;外来命名与其他序列不参与定序;到上界不再分配', () => {
    const mixed = allocateNextSnapshotSeriesRef([dir(U1, 3), 'cp_1700000000000_abc', 'hunk_x', dir(U2, 99)], U1)
    expect(mixed.ok ? mixed.ref.version : null).toBe(4)
    expect(allocateNextSnapshotSeriesRef([dir(U1, SNAPSHOT_SERIES_MAX_VERSION)], U1).ok).toBe(false)
    expect(allocateNextSnapshotSeriesRef(['x'], 'not-a-uuid').ok).toBe(false)
  })
})

describe('② 回退 / 重号 / 畸形名各自拒绝(带正例对照)', () => {
  const violations = (ordered: string[]) => auditSnapshotSeriesOrdering(ordered).violations.map((v) => v.reason)
  it('正例:同序列严格递增与跨序列各自递增都判过;反例各有独立原因码', () => {
    expect(auditSnapshotSeriesOrdering([dir(U1, 1), dir(U1, 2), dir(U1, 3)]).ok).toBe(true)
    expect(violations([dir(U1, 1), dir(U2, 5), dir(U1, 2)])).toEqual([])
    expect(violations([dir(U1, 5), dir(U1, 3)])).toEqual(['version-regression'])
    expect(violations([dir(U1, 2), dir(U1, 2)])).toEqual(['duplicate-version'])
    expect(violations([dir(U1, 2), dir(U1, 3)])).toEqual([])
  })
  it('畸形名:缺标记/多标记/uuid 不合法/版本号 0·前导零·非数字/路径段不安全/空名', () => {
    const cases: Array<[string, string]> = [
      ['plain-name', 'missing-separator'], [`${U1}@v1@v2`, 'multiple-separators'], ['not-a-uuid@v1', 'malformed-uuid'],
      [dir(U1, 0), 'malformed-version'], [`${U1}@v007`, 'malformed-version'], [`${U1}@vx`, 'malformed-version'],
      [`${U1}@v-2`, 'malformed-version'], ['../..', 'unsafe-path-segment'], [`${U1}@v1/`, 'unsafe-path-segment'],
      [' ', 'unsafe-path-segment'], ['', 'empty-name'],
    ]
    for (const [name, reason] of cases) {
      const parsed = parseSnapshotSeriesDirName(name)
      expect(parsed.ok).toBe(false)
      if (!parsed.ok) expect(parsed.reason).toBe(reason)
    }
  })
})

describe('③ 回收三约束:缺一档都不删', () => {
  it('保留最近 N 版 —— 第 N+1 版才进射程(正例:keepVersions=3 一枚不删)', () => {
    const plan = planSnapshotGc(stale3, policy({ maxTotalBytes: 1 }), gcDeps(allOld))
    expect(plan.state).toBe('planned')
    expect(plan.deletions.map((d) => d.version)).toEqual([1])
    expect(plan.retained.map((r) => r.reason)).toContain('within-keep-versions')
    expect(namesOf(planSnapshotGc(stale3, policy({ keepVersions: 3, maxTotalBytes: 1 }), gcDeps(allOld)))).toEqual([])
  })
  it('年龄窗内不删 —— 即便已越出最近 N 版', () => {
    const ages: FakeManifest = { [dir(U1, 1)]: DAY, [dir(U1, 2)]: DAY, [dir(U1, 3)]: DAY }
    const plan = planSnapshotGc(stale3, policy({ maxTotalBytes: 1 }), gcDeps(ages))
    expect(plan.deletions).toEqual([])
    expect(plan.state).toBe('clean')
    expect(plan.retained.filter((r) => r.reason === 'within-age-window')).toHaveLength(1)
  })
  it('总量上限 —— 未超上限一枚不删;超了才从最旧的越界版本开始删', () => {
    const four = [cand(1), cand(2), cand(3), cand(4)]
    const ages: FakeManifest = { [dir(U1, 1)]: OLD, [dir(U1, 2)]: OLD, [dir(U1, 3)]: OLD, [dir(U1, 4)]: OLD }
    expect(planSnapshotGc(four, policy({ maxTotalBytes: 200 }), gcDeps(ages)).deletions).toEqual([])
    const plan = planSnapshotGc(four, policy({ maxTotalBytes: 80 }), gcDeps(ages))
    expect(namesOf(plan)).toEqual([dir(U1, 1)])
    expect(plan.retained.some((r) => r.reason === 'within-size-cap')).toBe(true)
  })
  it('两序列互不牵连:U1 的最近版不因 U2 越界而被牵连删除', () => {
    const ages: FakeManifest = { [dir(U2, 1)]: OLD, [dir(U2, 2)]: OLD, [dir(U1, 1)]: OLD }
    const plan = planSnapshotGc([cand(1, 40, U2), cand(2, 40, U2), cand(1, 40, U1)], policy({ keepVersions: 1, maxTotalBytes: 10 }), gcDeps(ages))
    expect(plan.totals.series).toBe(2)
    expect(namesOf(plan)).toEqual([dir(U2, 1)])
  })
  it('策略本身不合法 ⇒ 未判定并点名,一枚不删(默认策略为正例)', () => {
    expect(judgeSnapshotGcPolicy(DEFAULT_SNAPSHOT_GC_POLICY)).toEqual([])
    const plan = planSnapshotGc([cand(1), cand(2)], policy({ keepVersions: 0 }), gcDeps({}))
    expect(plan.state).toBe('undetermined')
    expect(plan.deletions).toEqual([])
    expect(reasonsOf(plan)).toEqual(['invalid-policy', 'invalid-policy'])
  })
})

describe('④ 清单自证 / ⑤ 判不出来就不删', () => {
  it('删除前逐枚自证:清单损坏 ⇒ 不删并点名该目录;缺失 / 读取抛错 / 体积量不出同样不删', () => {
    const corrupted = planSnapshotGc(stale3, policy({ maxTotalBytes: 1 }), gcDeps({ ...allOld, [dir(U1, 1)]: 'corrupt' }))
    expect(corrupted.state).toBe('undetermined')
    expect(corrupted.deletions).toEqual([])
    expect(corrupted.undetermined.map((u) => u.dirName)).toEqual([dir(U1, 1)])
    expect(corrupted.notes.join('|')).toContain(dir(U1, 1))
    for (const age of ['missing', 'throw'] as const) {
      expect(namesOf(planSnapshotGc(stale3, policy({ maxTotalBytes: 1 }), gcDeps({ ...allOld, [dir(U1, 1)]: age })))).toEqual([])
    }
    const unmeasured = planSnapshotGc([cand(1, null), cand(2), cand(3)], policy({ maxTotalBytes: 1 }), gcDeps(allOld))
    expect(reasonsOf(unmeasured)).toEqual(['size-unmeasurable'])
    expect(unmeasured.deletions).toEqual([])
  })
  it('重号 ⇒ 整组无法定序:点名且不删', () => {
    const plan = planSnapshotGc([cand(1), cand(1), cand(2)], policy({ maxTotalBytes: 1 }), gcDeps({ ...allOld, [dir(U1, 2)]: OLD }))
    expect(plan.state).toBe('undetermined')
    expect(plan.deletions).toEqual([])
    expect(reasonsOf(plan)).toContain('duplicate-version')
  })
  it('版本序与 createdAt 矛盾 ⇒ series-regression 点名不删(同序为正例可删)', () => {
    const plan = planSnapshotGc(stale3, policy({ keepVersions: 1, maxTotalBytes: 1 }), gcDeps({ [dir(U1, 1)]: DAY, [dir(U1, 2)]: OLD, [dir(U1, 3)]: OLD }))
    expect(plan.state).toBe('undetermined')
    expect(plan.deletions).toEqual([])
    expect(reasonsOf(plan)).toContain('series-regression')
    expect(namesOf(planSnapshotGc(stale3, policy({ maxTotalBytes: 1 }), gcDeps(allOld)))).toEqual([dir(U1, 1)])
  })
  it('枚举到 0 个候选判「未判定」,不用 0 冒充「没有可删」;畸形名同样进不了删除集', () => {
    const none = planSnapshotGc([], policy(), gcDeps({}))
    expect(none.state).toBe('undetermined')
    expect(reasonsOf(none)).toEqual(['no-candidates'])
    const malformed = planSnapshotGc([{ dirName: 'cp_1700000000000_abc', bytes: 40 }, cand(2), cand(3)], policy({ keepVersions: 1, maxTotalBytes: 1 }), gcDeps({ [dir(U1, 2)]: OLD, [dir(U1, 3)]: OLD }))
    expect(reasonsOf(malformed)).toEqual(['malformed-dir-name'])
    expect(malformed.deletions).toEqual([])
    const ok = planSnapshotGc([cand(2), cand(3)], policy({ keepVersions: 1, maxTotalBytes: 1 }), gcDeps({ [dir(U1, 2)]: OLD, [dir(U1, 3)]: OLD }))
    expect(namesOf(ok)).toEqual([dir(U1, 2)])
  })
})

describe('⑥ 形状锁:判据层零 fs + 声明确有消费者', () => {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const sourceOf = (file: string) => fs.readFileSync(path.join(here, '..', 'src', 'checkpoints', file), 'utf8')
  const FS_TOKENS = ['node:fs', 'readFileSync', 'readdirSync', 'writeFileSync', 'mkdirSync', 'rmSync', 'unlinkSync', 'statSync', 'existsSync', 'renameSync']
  it('snapshot-gc.ts / snapshot-series.ts 内一个 fs 动作都不许出现', () => {
    expect(FS_TOKENS.filter((t) => sourceOf('snapshot-gc.ts').includes(t))).toEqual([])
    expect(FS_TOKENS.filter((t) => sourceOf('snapshot-series.ts').includes(t))).toEqual([])
  })
  it('清单完整性判据只有一份出口:GC 只吃 manifest-integrity 的结果档', () => {
    const gc = sourceOf('snapshot-gc.ts')
    expect(gc).toMatch(/import type \{ ManifestReadResult \} from '\.\/manifest-integrity\.js'/)
    expect(gc).not.toContain('readManifestChecked(')
    expect(gc).not.toMatch(/JSON\.parse/)
  })
  it('两个判据模块都被 CheckpointManager 真走到(命名分配 + 回收派发)', () => {
    const index = sourceOf('index.ts')
    const missing = ['planSnapshotGc(', 'allocateNextSnapshotSeriesRef(', 'formatSnapshotSeriesDirName(', 'seriesUuidFromSeedHex(', 'parseSnapshotSeriesDirName('].filter((call) => !index.includes(call))
    expect(missing).toEqual([])
  })
})

describe('消费方落地:落盘序列命名与三约束回收', () => {
  const sessions = [`s3-series-${process.pid}-a`, `s3-series-${process.pid}-b`]
  const sessionRoot = (sid: string) => path.join(os.homedir(), '.ihui', 'checkpoints', sid)
  let scratch = ''

  beforeAll(() => {
    scratch = mkScratch('s3-snapshot-series-')
    sessions.forEach((s) => fs.rmSync(sessionRoot(s), { recursive: true, force: true }))
  })
  afterAll(() => {
    sessions.forEach((s) => fs.rmSync(sessionRoot(s), { recursive: true, force: true }))
    rmScratch(scratch)
  })
  it('快照目录名 = <seriesUuid>@vN;新实例接着同一序列往上走(可寻址、跨实例单调)', () => {
    const ws = path.join(scratch, 'ws-a')
    fs.mkdirSync(ws, { recursive: true })
    const file = path.join(ws, 'a.txt')
    fs.writeFileSync(file, 'v0', 'utf8')
    const first = new CheckpointManager({ sessionId: sessions[0]!, workspacePath: ws }).snapshotSync([file], 'r0').id
    fs.writeFileSync(file, 'v1', 'utf8')
    const second = new CheckpointManager({ sessionId: sessions[0]!, workspacePath: ws }).snapshotSync([file], 'r1').id
    expect(first.split('@')[1]).toBe('v1')
    expect(second.split('@')[1]).toBe('v2')
    expect(second.split('@')[0]).toBe(first.split('@')[0])
    expect(auditSnapshotSeriesOrdering([first, second]).ok).toBe(true)
    expect(fs.existsSync(path.join(sessionRoot(sessions[0]!), second, 'manifest.json'))).toBe(true)
  })
  it('回收真被走到:越界 ∧ 超龄 ∧ 超量的旧版被删,最近 N 版与窗内版本留下', () => {
    const ws = path.join(scratch, 'ws-b')
    fs.mkdirSync(ws, { recursive: true })
    const file = path.join(ws, 'a.txt')
    const mgr = new CheckpointManager({ sessionId: sessions[1]!, workspacePath: ws, maxCheckpoints: 2 })
    const ids: string[] = []
    for (let i = 0; i < 4; i++) {
      fs.writeFileSync(file, `s${i}`, 'utf8')
      ids.push(mgr.snapshotSync([file], `r${i}`).id)
    }
    expect(mgr.list().map((m) => m.id).sort()).toEqual([...ids].sort()) // 默认 30 天窗 ⇒ 一枚没被删
    const root = sessionRoot(sessions[1]!)
    const uuid = ids[0]!.split('@')[0]!
    for (const id of ids.slice(0, 3)) {
      const manifestPath = path.join(root, id, 'manifest.json')
      const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Meta
      fs.writeFileSync(manifestPath, JSON.stringify({ ...raw, createdAt: '2020-01-01T00:00:00.000Z' }, null, 2), 'utf8')
    }
    const trigger = new CheckpointManager({ sessionId: sessions[1]!, workspacePath: ws, maxCheckpoints: 2, snapshotGcPolicy: { maxAgeMs: DAY, maxTotalBytes: 1 } })
    fs.writeFileSync(file, 'fifth', 'utf8')
    expect(trigger.snapshotSync([file], 'trigger').id).toBe(dir(uuid, 5))
    expect(mgr.list().map((m) => m.id)).toEqual([dir(uuid, 5), dir(uuid, 4)])
    expect(fs.existsSync(path.join(root, ids[0]!))).toBe(false)
    expect(fs.existsSync(path.join(root, ids[2]!))).toBe(false)
    expect(trigger.getLastGcNotes().join('|')).toContain('本轮删除')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
