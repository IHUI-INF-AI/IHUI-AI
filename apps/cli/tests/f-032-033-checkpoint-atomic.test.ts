// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// F-032/F-033 落地锁(缺陷普查 CLI):
//  · F-032 回滚写工作区非原子 + `added` 档无类型复核即递归删 ⇒ 钉住「同目录 tmp + rename」
//    「写失败时原文件逐字节不变且不留临时件」「只有普通文件才删,目录一律不动」;
//  · F-033 版本号分配 TOCTOU ⇒ 钉住「mkdirSync(recursive:false) 独占创建」「EEXIST 重新分配、
//    既有快照不被覆盖」「撞满上限明确报错」。
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs' // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边
import { CheckpointManager } from '../src/checkpoints/index.js'
import { restoreSnapshotFiles } from '../src/checkpoints/snapshot-store-host.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SRC = (f: string): string => fs.readFileSync(path.join(HERE, '..', 'src', f), 'utf-8')
const sessionRoot = (sid: string): string => path.join(os.homedir(), '.ihui', 'checkpoints', sid)
const sessions: string[] = []
let seq = 0
const newSession = (tag: string): string => {
  seq += 1
  const sid = `f032033-${tag}-${process.pid}-${seq}`
  sessions.push(sid)
  return sid
}

let scratch = ''
const wsOf = (name: string): string => {
  const ws = path.join(scratch, name)
  fs.mkdirSync(ws, { recursive: true })
  return ws
}

beforeAll(() => {
  scratch = mkScratch('f032-033-checkpoint-')
})

afterAll(() => {
  for (const sid of sessions) fs.rmSync(sessionRoot(sid), { recursive: true, force: true })
  rmScratch(scratch)
})

describe('F-032 ① 恢复写盘:同目录 tmp + rename', () => {
  it('写入先落同目录临时件再 rename 到目标,内容完整替换', () => {
    const ws = wsOf('rename')
    const cpDir = path.join(scratch, 'rename-snap')
    fs.mkdirSync(cpDir, { recursive: true })
    const rel = 'a.txt'
    fs.writeFileSync(path.join(cpDir, rel), 'snapshot-content\n', 'utf-8')
    const dest = path.join(ws, rel)
    fs.writeFileSync(dest, 'old-content\n', 'utf-8')

    const seen: Array<{ from: string; to: string; tmpExisted: boolean; destDuring: string }> = []
    const result = restoreSnapshotFiles(ws, cpDir, { [rel]: 'snap' }, {
      renameSync: (from, to) => {
        seen.push({
          from,
          to,
          tmpExisted: fs.existsSync(from),
          destDuring: fs.readFileSync(to, 'utf-8'),
        })
        fs.renameSync(from, to)
      },
    })

    expect(result).toEqual({ restored: [rel], removed: [], notRestored: [] })
    expect(seen).toHaveLength(1)
    // tmp 与目标同目录(跨卷 rename 会 EXDEV),且 rename 发生时目标仍是旧内容
    expect(path.dirname(seen[0]!.from)).toBe(path.dirname(dest))
    expect(path.basename(seen[0]!.from)).toContain('.restore-tmp')
    expect(seen[0]!.tmpExisted).toBe(true)
    expect(seen[0]!.destDuring).toBe('old-content\n')
    expect(fs.readFileSync(dest, 'utf-8')).toBe('snapshot-content\n')
    expect(fs.readdirSync(ws).filter((n) => n.includes('.restore-tmp'))).toEqual([])
  })

  it('rename 失败(注入 EIO)⇒ 抛错,原文件逐字节不变且不留临时件', () => {
    const ws = wsOf('rename-fail')
    const cpDir = path.join(scratch, 'rename-fail-snap')
    fs.mkdirSync(cpDir, { recursive: true })
    const rel = 'b.txt'
    fs.writeFileSync(path.join(cpDir, rel), 'new-and-longer-content\n', 'utf-8')
    const dest = path.join(ws, rel)
    fs.writeFileSync(dest, 'keep-me\n', 'utf-8')

    const failure = Object.assign(new Error('boom'), { code: 'EIO' })
    expect(() =>
      restoreSnapshotFiles(ws, cpDir, { [rel]: 'snap' }, {
        renameSync: () => {
          throw failure
        },
      }),
    ).toThrow(/boom/)
    expect(fs.readFileSync(dest, 'utf-8')).toBe('keep-me\n')
    expect(fs.readdirSync(ws).filter((n) => n.includes('.restore-tmp'))).toEqual([])
  })

  it('hunks 的行回写也走原子写出口(静态接线锁,不再裸 writeFileSync)', () => {
    const hunks = SRC('checkpoints/hunks.ts')
    const writeLines = hunks.slice(hunks.indexOf('private writeLines'))
    expect(writeLines).toContain('writeFileAtomicSync(')
    expect(writeLines).not.toContain('fs.writeFileSync(')
  })
})

describe('F-032 ② added 档:删除前必须复核仍是普通文件', () => {
  it('普通文件 ⇒ 删除;被改成目录 ⇒ 不删、不动其中内容并记入 notRestored', () => {
    const ws = wsOf('added-type')
    const cpDir = path.join(scratch, 'added-snap')
    fs.mkdirSync(cpDir, { recursive: true })

    const fileRel = 'fresh.txt'
    fs.writeFileSync(path.join(ws, fileRel), 'x', 'utf-8')
    const dirRel = 'nested'
    fs.mkdirSync(path.join(ws, dirRel))
    fs.writeFileSync(path.join(ws, dirRel, 'keep.txt'), 'unrelated-new-file', 'utf-8')

    const result = restoreSnapshotFiles(ws, cpDir, { [fileRel]: 'added', [dirRel]: 'added' })

    expect(result.removed).toEqual([fileRel])
    expect(result.notRestored).toEqual([dirRel])
    expect(fs.existsSync(path.join(ws, fileRel))).toBe(false)
    expect(fs.readFileSync(path.join(ws, dirRel, 'keep.txt'), 'utf-8')).toBe('unrelated-new-file')
  })

  it('lstat 读不到(注入 EACCES)⇒ 一律不删', () => {
    const ws = wsOf('added-lstat-denied')
    const cpDir = path.join(scratch, 'added-lstat-snap')
    fs.mkdirSync(cpDir, { recursive: true })
    const rel = 'denied.txt'
    fs.writeFileSync(path.join(ws, rel), 'keep', 'utf-8')
    const denied = Object.assign(new Error('denied'), { code: 'EACCES' })

    const result = restoreSnapshotFiles(ws, cpDir, { [rel]: 'added' }, {
      lstatSync: () => {
        throw denied
      },
    })

    expect(result).toEqual({ restored: [], removed: [], notRestored: [rel] })
    expect(fs.readFileSync(path.join(ws, rel), 'utf-8')).toBe('keep')
  })
})

describe('F-033 ① 落盘前必须独占创建目录', () => {
  it('静态接线锁:落盘用 mkdirSync(recursive:false) 占位,不再 ensureHostDir(cpDir)', () => {
    const manager = SRC('checkpoints/manager.ts')
    const body = manager.slice(manager.indexOf('private createExclusiveCheckpointDir'))
    expect(body).toContain('mkdirSync(cpDir, { recursive: false })')
    expect(body).not.toContain('ensureHostDir(cpDir)')
  })
})

describe('F-033 ② EEXIST ⇒ 重新分配版本,绝不覆盖既有快照', () => {
  it('抢占者先建好 v2 ⇒ 本次落到 v3,v2 的清单与内容逐字节不变', () => {
    const ws = wsOf('toctou')
    const sid = newSession('toctou')
    const file = path.join(ws, 'a.txt')
    fs.writeFileSync(file, 'v1', 'utf-8')
    const mgr = new CheckpointManager({ sessionId: sid, workspacePath: ws })
    const first = mgr.snapshotSync([file], 'r1')

    const competingId = first.id.replace(/@v\d+$/, '@v2')
    const competingDir = path.join(sessionRoot(sid), competingId)
    const competingMeta = {
      id: competingId,
      sessionId: sid,
      createdAt: new Date().toISOString(),
      reason: 'competing-writer',
      files: {},
    }
    const competingManifest = JSON.stringify(competingMeta, null, 2)
    fs.writeFileSync(path.join(ws, 'marker.txt'), 'competing-marker', 'utf-8')

    let injected = false
    const mkdirSync = ((p: fs.PathLike, opts?: fs.MakeDirectoryOptions) => {
      if (!injected) {
        injected = true
        // 模拟并发写者:在「取 max+1」之后、「独占创建」之前抢走了 v2
        fs.mkdirSync(p, opts)
        fs.writeFileSync(path.join(String(p), 'manifest.json'), competingManifest, 'utf-8')
        fs.writeFileSync(path.join(String(p), 'marker.txt'), 'competing-marker', 'utf-8')
        const eexist = new Error('EEXIST: file already exists') as NodeJS.ErrnoException
        eexist.code = 'EEXIST'
        throw eexist
      }
      fs.mkdirSync(p, opts)
    }) as typeof fs.mkdirSync

    fs.writeFileSync(file, 'v3', 'utf-8')
    const third = mgr.snapshotSync([file, path.join(ws, 'marker.txt')], 'r3', { mkdirSync })

    expect(injected).toBe(true)
    expect(third.id).toBe(first.id.replace(/@v\d+$/, '@v3'))
    expect(fs.readFileSync(path.join(competingDir, 'manifest.json'), 'utf-8')).toBe(competingManifest)
    expect(fs.readFileSync(path.join(competingDir, 'marker.txt'), 'utf-8')).toBe('competing-marker')
    // 新快照自身的镜像没有被并发写者的内容污染
    expect(fs.readFileSync(path.join(sessionRoot(sid), third.id, 'a.txt'), 'utf-8')).toBe('v3')
  })

  it('连续撞满上限 ⇒ 明确报错,不静默覆盖、不落半成品目录', () => {
    const ws = wsOf('toctou-exhausted')
    const sid = newSession('toctou-exhausted')
    const file = path.join(ws, 'a.txt')
    fs.writeFileSync(file, 'x', 'utf-8')
    const mgr = new CheckpointManager({ sessionId: sid, workspacePath: ws })

    let attempts = 0
    const mkdirSync = (() => {
      attempts += 1
      const eexist = new Error('EEXIST: file already exists') as NodeJS.ErrnoException
      eexist.code = 'EEXIST'
      throw eexist
    }) as typeof fs.mkdirSync

    expect(() => mgr.snapshotSync([file], 'r', { mkdirSync })).toThrow(/拒绝覆盖既有快照/)
    expect(attempts).toBeGreaterThan(1)
    const root = sessionRoot(sid)
    const dirs = fs.existsSync(root)
      ? fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory())
      : []
    expect(dirs).toEqual([])
  })
})
