// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// F-029 落地锁(缺陷普查 CLI):checkpoint manifest 非原子 + 一枚崩溃孤儿目录让整轮 GC 永久停摆。
// 钉住:① 两处 manifest 写点都接 writeFileAtomicSync(静态接线锁);② 写入失败时旧清单逐字节不变、
// 盘上不出现半截 JSON;③ 无清单且超龄的孤儿目录下一轮 GC 被删且报告点名;④ 无清单但未超龄仍判
// 未判定、一枚不删(其它 undetermined 语义不变);⑤ 清单完整的正常快照仍按三约束回收(不误入孤儿档)。
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs' // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边
import { CheckpointManager } from '../src/checkpoints/index.js'
import { writeSnapshotManifest } from '../src/checkpoints/snapshot-store-host.js'
import { __test__ as atomic } from '../src/util/atomic-write.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SRC = (f: string) => fs.readFileSync(path.join(HERE, '..', 'src', f), 'utf-8')
const DAY = 86_400_000
const sessionRoot = (sid: string) => path.join(os.homedir(), '.ihui', 'checkpoints', sid)
const sessions: string[] = []
const newSession = (tag: string): string => {
  const sid = `f029-${tag}-${process.pid}`
  sessions.push(sid)
  return sid
}
/** 裸写 manifest 的形状(两种写法都拦):`writeFileSync(` 紧接 manifest 路径 */
const BARE_MANIFEST_WRITE = /writeFileSync\(\s*(?:path\.join\()?cpDir/

let scratch = ''
const wsOf = (name: string): string => {
  const ws = path.join(scratch, name)
  fs.mkdirSync(ws, { recursive: true })
  return ws
}

describe('F-029 ① manifest 写点接线(原子写出口)', () => {
  it('snapshot-store-host 的清单写点走 writeFileAtomicSync,不再裸写', () => {
    const src = SRC('checkpoints/snapshot-store-host.ts')
    expect(src).toContain('writeFileAtomicSync(')
    expect(src).not.toMatch(BARE_MANIFEST_WRITE)
  })
  it('hunks 的清单写点走 writeFileAtomicSync,不再裸写', () => {
    const src = SRC('checkpoints/hunks.ts')
    expect(src).toContain('writeFileAtomicSync(')
    expect(src).not.toMatch(/writeFileSync\(\n?\s*path\.join\(cpDir, 'manifest\.json'\)/)
  })
})

describe('F-029 ② 写入失败不留半截 JSON', () => {
  it('注入失败(下一个 tmp 名被占成目录)⇒ 抛错,旧清单逐字节不变且仍可解析,不留临时件', () => {
    const ws = wsOf('atomic')
    const sid = newSession('atomic')
    const file = path.join(ws, 'a.txt')
    fs.writeFileSync(file, 'v1', 'utf-8')
    const meta = new CheckpointManager({ sessionId: sid, workspacePath: ws }).snapshotSync([file], 'r0')
    const cpDir = path.join(sessionRoot(sid), meta.id)
    const manifestPath = path.join(cpDir, 'manifest.json')
    const before = fs.readFileSync(manifestPath, 'utf-8')

    // 原子写先在同目录建 tmp 再 rename:把「下一次要用的 tmp 名」占成目录 ⇒ 独占创建拿 EEXIST。
    const nextTmp = atomic.tmpPathFor(manifestPath).replace(/-(\d+)$/, (_, n: string) => `-${Number(n) + 1}`)
    fs.mkdirSync(nextTmp)
    try {
      expect(() => writeSnapshotManifest(cpDir, { ...meta, reason: 'crash-mid-write' })).toThrow()
    } finally {
      fs.rmSync(nextTmp, { recursive: true, force: true })
    }

    const after = fs.readFileSync(manifestPath, 'utf-8')
    expect(after).toBe(before)
    expect(() => JSON.parse(after)).not.toThrow()
    expect(fs.readdirSync(cpDir).filter((n) => n.includes('.tmp-'))).toEqual([])
  })
})

describe('F-029 ③④ 孤儿目录分档:超龄可删并点名,未超龄仍是未判定', () => {
  const seedThree = (tag: string) => {
    const ws = wsOf(tag)
    const sid = newSession(tag)
    const file = path.join(ws, 'a.txt')
    fs.writeFileSync(file, 'v0', 'utf-8')
    const mgr = new CheckpointManager({
      sessionId: sid,
      workspacePath: ws,
      maxCheckpoints: 2,
      snapshotGcPolicy: { maxAgeMs: DAY, maxTotalBytes: 1 },
    })
    const ids: string[] = []
    for (let i = 0; i < 3; i++) {
      fs.writeFileSync(file, `s${i}`, 'utf-8')
      ids.push(mgr.snapshotSync([file], `r${i}`).id)
    }
    return { ws, sid, file, mgr, ids, v1: path.join(sessionRoot(sid), ids[0]!) }
  }

  it('删掉清单 + 目录 mtime 回拨到 90 天前 ⇒ 下一轮 GC 删掉该枚并点名', () => {
    const { sid, file, mgr, ids, v1 } = seedThree('orphan-old')
    fs.rmSync(path.join(v1, 'manifest.json'))
    const stale = new Date(Date.now() - 90 * DAY)
    fs.utimesSync(v1, stale, stale)

    fs.writeFileSync(file, 's3', 'utf-8')
    mgr.snapshotSync([file], 'r3')

    const plan = mgr.getLastGcOutcome()!.plan
    expect(plan.state).toBe('planned')
    expect(plan.undetermined).toEqual([])
    expect(plan.deletions.map((d) => d.dirName)).toEqual([ids[0]!])
    expect(plan.deletions[0]!.detail).toContain('无清单超龄孤儿目录')
    const notes = mgr.getLastGcNotes().join('|')
    expect(notes).toContain(ids[0]!)
    expect(notes).toContain('孤儿')
    expect(fs.existsSync(v1)).toBe(false)
    expect(fs.existsSync(path.join(sessionRoot(sid), ids[1]!))).toBe(true)
  })

  it('删掉清单但目录刚写(未超龄)⇒ 仍是 manifest-missing 未判定,一枚不删', () => {
    const { file, mgr, ids, v1 } = seedThree('orphan-young')
    fs.rmSync(path.join(v1, 'manifest.json'))

    fs.writeFileSync(file, 's3', 'utf-8')
    mgr.snapshotSync([file], 'r3')

    const plan = mgr.getLastGcOutcome()!.plan
    expect(plan.state).toBe('undetermined')
    expect(plan.undetermined.map((u) => u.reason)).toEqual(['manifest-missing'])
    expect(plan.deletions).toEqual([])
    expect(plan.notes.join('|')).toContain(ids[0]!)
    expect(fs.existsSync(v1)).toBe(true)
  })
})

describe('F-029 ⑤ 正常快照回收行为不变', () => {
  it('清单完整 + createdAt 超龄 ⇒ 照旧三约束删除,不进孤儿档', () => {
    const ws = wsOf('gc-normal')
    const sid = newSession('gc-normal')
    const file = path.join(ws, 'a.txt')
    fs.writeFileSync(file, 'v0', 'utf-8')
    const mgr = new CheckpointManager({
      sessionId: sid,
      workspacePath: ws,
      maxCheckpoints: 2,
      snapshotGcPolicy: { maxAgeMs: DAY, maxTotalBytes: 1 },
    })
    const ids: string[] = []
    for (let i = 0; i < 3; i++) {
      fs.writeFileSync(file, `s${i}`, 'utf-8')
      ids.push(mgr.snapshotSync([file], `r${i}`).id)
    }
    const root = sessionRoot(sid)
    const first = path.join(root, ids[0]!)
    const manifestPath = path.join(first, 'manifest.json')
    const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as { createdAt: string }
    fs.writeFileSync(manifestPath, JSON.stringify({ ...raw, createdAt: new Date(Date.now() - 90 * DAY).toISOString() }, null, 2), 'utf-8')

    fs.writeFileSync(file, 's3', 'utf-8')
    mgr.snapshotSync([file], 'r3')

    const plan = mgr.getLastGcOutcome()!.plan
    expect(plan.state).toBe('planned')
    expect(plan.deletions.map((d) => d.dirName)).toEqual([ids[0]!])
    expect(plan.deletions[0]!.detail).not.toContain('孤儿')
    expect(mgr.getLastGcNotes().join('|')).not.toContain('孤儿')
    expect(fs.existsSync(first)).toBe(false)
    expect(fs.existsSync(path.join(root, ids[1]!))).toBe(true)
  })
})

/** 会话目录名在本用例里由 seedThree 一并给出(不在断言里反查盘面) */

beforeAll(() => {
  scratch = mkScratch('f029-checkpoint-')
})

afterAll(() => {
  for (const sid of sessions) fs.rmSync(sessionRoot(sid), { recursive: true, force: true })
  rmScratch(scratch)
})
