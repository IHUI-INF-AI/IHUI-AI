// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话恢复腿·逐条可撤测试(2026-10-27 增,⑦第二刀)。fixture 全部注入临时目录,断言:
 * - apply 动前留底存在且 sha 对(只有真覆盖的文件才留底);
 * - ops.jsonl 记账完整(逐文件 restore 条 + restore-run 汇总)且零内容回显;
 * - undo 后覆盖场景逐字节还原、新增场景删到不存在;
 * - undo 对被第三方改过的文件整批拒绝(零写入,宁拒不静默覆盖);
 * - --list-ops 列历史;undo 默认 dry-run 零写入;
 * - gzip 压缩条目(2026-10-28 增):留底/记账/还原全部按原文,undo 腿无需感知压缩。
 */

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { afterAll, describe, expect, it } from 'vitest'
import {
  applyRestore,
  loadManifest,
  main,
  planUndoRestore,
  readRestoreOps,
  type RestorePlan,
} from '../scripts/relay-session-restore.js'
import type { BackupFileEntry } from '../scripts/relay-session-backup.js'

const SECRET_SENTINEL = 'TOPSECRET-CONVERSATION-BODY-7e1c'
const DRIFTED = 'DRIFTED-BEFORE-RESTORE\n'
const shaOf = (buf: Buffer | string): string => createHash('sha256').update(buf).digest('hex')

interface Fixture {
  root: string
  snapDir: string
  srcSessions: string
  srcProjects: string
  /** 快照内三个内容文件的 rel → 内容 */
  contents: Map<string, string>
}

/** 造一份与备份腿产物同形的假快照(manifest + workspace/ 与 projects 镜像树) */
function makeFixture(): Fixture {
  const root = mkdtempSync(join(tmpdir(), 'wb-restore-undo-test-'))
  const snapDir = join(root, 'snap')
  const srcSessions = join(root, 'src', 'sessions')
  const srcProjects = join(root, 'src', 'projects')
  const contents = new Map<string, string>([
    ['workspace/sess-1/state.json', '{"v":1}'],
    ['workspace/sess-1/transcript.jsonl', `${SECRET_SENTINEL}\nline2\n`],
    ['ws-a/conv.jsonl', 'hello\n'],
  ])
  for (const [rel, content] of contents) {
    const abs = relToSnapAbs(rel, snapDir)
    mkdirSync(join(abs, '..'), { recursive: true })
    writeFileSync(abs, content)
  }
  const files: BackupFileEntry[] = [...contents].map(([rel, content]) => {
    const abs = relToSnapAbs(rel, snapDir)
    return {
      rel,
      bytes: Buffer.byteLength(content),
      mtimeMs: statSync(abs).mtimeMs,
      sha256: shaOf(content),
    }
  })
  writeFileSync(
    join(snapDir, 'manifest.json'),
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        source: { sessionsRoot: srcSessions, projectsRoot: srcProjects },
        files,
      },
      null,
      2,
    ),
  )
  return { root, snapDir, srcSessions, srcProjects, contents }
}

function relToSnapAbs(rel: string, snapDir: string): string {
  return join(snapDir, ...rel.split('/'))
}

function planOf(fx: Fixture): RestorePlan {
  return {
    snapshotDir: fx.snapDir,
    destSessions: fx.srcSessions,
    destProjects: fx.srcProjects,
    manifest: loadManifest(fx.snapDir),
  }
}

/** 目录树下全部文件 rel(POSIX 斜杠),用于对账与残留检查 */
function relsUnder(root: string): string[] {
  if (!existsSync(root)) return []
  const out: string[] = []
  const walk = (dir: string, base: string): void => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      const rel = base ? `${base}/${name}` : name
      if (statSync(p).isDirectory()) walk(p, rel)
      else out.push(rel)
    }
  }
  walk(root, '')
  return out
}

const opsRootOf = (fx: Fixture): string => join(fx.snapDir, 'restore-ops')

/** 最近一轮 restore-run 的 opId */
function lastOpId(fx: Fixture): string {
  const runs = readRestoreOps(opsRootOf(fx)).filter((o) => o.type === 'restore-run')
  expect(runs.length).toBeGreaterThan(0)
  return runs[runs.length - 1].op
}

/** 种一个"漂移的 transcript"(force 覆盖场景的留底对象) */
function seedDrifted(fx: Fixture): void {
  mkdirSync(join(fx.srcSessions, 'sess-1'), { recursive: true })
  writeFileSync(join(fx.srcSessions, 'sess-1', 'transcript.jsonl'), DRIFTED)
}

const cleanup: string[] = []
afterAll(() => {
  for (const p of cleanup) rmSync(p, { recursive: true, force: true })
})

describe('apply 动前留底+记账', () => {
  it('force 覆盖:留底存在且 sha 对,只有被覆盖者留底;missing 者记 before.exists=false', () => {
    const fx = makeFixture()
    cleanup.push(fx.root)
    seedDrifted(fx)
    const stats = applyRestore(planOf(fx), { force: true })
    expect(stats.restored).toBe(3)

    const opsRoot = opsRootOf(fx)
    const ops = readRestoreOps(opsRoot)
    const fileOps = ops.filter((o) => o.type === 'restore')
    const runOps = ops.filter((o) => o.type === 'restore-run')
    expect(fileOps).toHaveLength(3)
    expect(runOps).toHaveLength(1)
    expect(runOps[0]).toMatchObject({ files: 3, restored: 3, failed: 0 })

    // 留底:只有被覆盖的 transcript 有,missing 的两个没有
    const beforeRoot = join(opsRoot, runOps[0].op, 'before')
    expect(relsUnder(beforeRoot)).toEqual(['workspace/sess-1/transcript.jsonl'])
    const beforeAbs = join(beforeRoot, 'workspace', 'sess-1', 'transcript.jsonl')
    expect(readFileSync(beforeAbs, 'utf8')).toBe(DRIFTED)
    expect(shaOf(readFileSync(beforeAbs))).toBe(shaOf(DRIFTED))

    // 逐条 before/afterSha/bytes 对得上
    const tOp = fileOps.find((o) => o.file === 'workspace/sess-1/transcript.jsonl')
    expect(tOp?.before).toEqual({ exists: true, sha256: shaOf(DRIFTED) })
    expect(tOp?.afterSha).toBe(shaOf(fx.contents.get('workspace/sess-1/transcript.jsonl')!))
    expect(tOp?.bytes).toBe(
      Buffer.byteLength(fx.contents.get('workspace/sess-1/transcript.jsonl')!),
    )
    const sOp = fileOps.find((o) => o.file === 'workspace/sess-1/state.json')
    expect(sOp?.before).toEqual({ exists: false, sha256: null })
    const cOp = fileOps.find((o) => o.file === 'ws-a/conv.jsonl')
    expect(cOp?.before).toEqual({ exists: false, sha256: null })
  })

  it('记账零内容回显:ops.jsonl 全文不含正文哨兵与动前内容', () => {
    const fx = makeFixture()
    cleanup.push(fx.root)
    seedDrifted(fx)
    applyRestore(planOf(fx), { force: true })
    const raw = readFileSync(join(opsRootOf(fx), 'ops.jsonl'), 'utf8')
    expect(raw).not.toContain(SECRET_SENTINEL)
    expect(raw).not.toContain('DRIFTED')
  })

  it('未 --force 整批拒绝时零记账(连 ops 目录都不产生)', () => {
    const fx = makeFixture()
    cleanup.push(fx.root)
    seedDrifted(fx)
    expect(() => applyRestore(planOf(fx))).toThrow(/整批拒绝/)
    expect(existsSync(opsRootOf(fx))).toBe(false)
  })
})

describe('undo --op <opId>(--apply 才动)', () => {
  it('覆盖+新增混合:undo 后覆盖文件逐字节还原,新增文件删到不存在;undo 自身记账', () => {
    const fx = makeFixture()
    cleanup.push(fx.root)
    seedDrifted(fx)
    applyRestore(planOf(fx), { force: true })
    const opId = lastOpId(fx)

    const code = main(
      ['--snapshot', fx.snapDir, '--undo', opId, '--apply'],
      {
        snapshotDir: fx.snapDir,
      },
      fx.root,
    )
    expect(code).toBe(0)

    // 覆盖文件逐字节还原到动前内容
    expect(readFileSync(join(fx.srcSessions, 'sess-1', 'transcript.jsonl'), 'utf8')).toBe(DRIFTED)
    // 新增文件删到不存在
    expect(existsSync(join(fx.srcSessions, 'sess-1', 'state.json'))).toBe(false)
    expect(existsSync(join(fx.srcProjects, 'ws-a', 'conv.jsonl'))).toBe(false)

    // undo 自身追加记账(type:'undo', refOp 指向被回退 op)
    const undoOps = readRestoreOps(opsRootOf(fx)).filter((o) => o.type === 'undo')
    expect(undoOps).toHaveLength(1)
    expect(undoOps[0].refOp).toBe(opId)
    expect(undoOps[0].entries.map((e) => e.action).sort()).toEqual([
      'delete',
      'delete',
      'restore-before',
    ])

    // 无 .undoing- 临时残留
    const leftovers = [...relsUnder(fx.srcSessions), ...relsUnder(fx.srcProjects)].filter((n) =>
      n.includes('.undoing-'),
    )
    expect(leftovers).toEqual([])
  })

  it('纯新增场景:undo 后目标根回到空(快照外文件本就不存在,删到不存在)', () => {
    const fx = makeFixture()
    cleanup.push(fx.root)
    applyRestore(planOf(fx))
    const opId = lastOpId(fx)
    const code = main(
      ['--snapshot', fx.snapDir, '--undo', opId, '--apply'],
      {
        snapshotDir: fx.snapDir,
      },
      fx.root,
    )
    expect(code).toBe(0)
    expect(relsUnder(fx.srcSessions)).toEqual([])
    expect(relsUnder(fx.srcProjects)).toEqual([])
  })

  it('被第三方改过的文件 → 整批拒绝,零写入、零记账', () => {
    const fx = makeFixture()
    cleanup.push(fx.root)
    seedDrifted(fx)
    applyRestore(planOf(fx), { force: true })
    const opId = lastOpId(fx)
    // 第三方在 undo 前改动了 apply 刚写入的 transcript
    writeFileSync(join(fx.srcSessions, 'sess-1', 'transcript.jsonl'), 'TAMPERED-BY-THIRD-PARTY\n')

    expect(() => planUndoRestore(opId, opsRootOf(fx), fx.srcSessions, fx.srcProjects)).toThrow(
      /拒绝/,
    )

    // CLI 路径同样拒绝(dry-run 与 --apply 都进计划,计划即抛错)
    const errors: string[] = []
    const origErr = console.error
    console.error = (s: string) => errors.push(s)
    const code = main(
      ['--snapshot', fx.snapDir, '--undo', opId, '--apply'],
      {
        snapshotDir: fx.snapDir,
      },
      fx.root,
    )
    console.error = origErr
    expect(code).not.toBe(0)
    expect(errors.join('\n')).toContain('第三方改动')

    // 现场原样:transcript 仍是第三方内容,其余 apply 落地文件未被动过
    expect(readFileSync(join(fx.srcSessions, 'sess-1', 'transcript.jsonl'), 'utf8')).toBe(
      'TAMPERED-BY-THIRD-PARTY\n',
    )
    expect(readFileSync(join(fx.srcSessions, 'sess-1', 'state.json'), 'utf8')).toBe(
      fx.contents.get('workspace/sess-1/state.json'),
    )
    // 拒绝未追加任何 undo 记账
    expect(readRestoreOps(opsRootOf(fx)).filter((o) => o.type === 'undo')).toHaveLength(0)
  })

  it('重复 undo → 拒绝(日志中已有 refOp 记录)', () => {
    const fx = makeFixture()
    cleanup.push(fx.root)
    applyRestore(planOf(fx))
    const opId = lastOpId(fx)
    const first = main(
      ['--snapshot', fx.snapDir, '--undo', opId, '--apply'],
      {
        snapshotDir: fx.snapDir,
      },
      fx.root,
    )
    expect(first).toBe(0)
    const errors: string[] = []
    const origErr = console.error
    console.error = (s: string) => errors.push(s)
    const second = main(
      ['--snapshot', fx.snapDir, '--undo', opId, '--apply'],
      {
        snapshotDir: fx.snapDir,
      },
      fx.root,
    )
    console.error = origErr
    expect(second).not.toBe(0)
    expect(errors.join('\n')).toContain('重复回退')
  })

  it('undo 不存在的 opId → 报错退出', () => {
    const fx = makeFixture()
    cleanup.push(fx.root)
    const errors: string[] = []
    const origErr = console.error
    console.error = (s: string) => errors.push(s)
    const code = main(
      ['--snapshot', fx.snapDir, '--undo', '20991231T000000000Z'],
      {
        snapshotDir: fx.snapDir,
      },
      fx.root,
    )
    console.error = origErr
    expect(code).not.toBe(0)
    expect(errors.join('\n')).toContain('无 op=')
  })
})

describe('--list-ops 与 undo dry-run', () => {
  it('--list-ops 列 id/时刻/文件数;undo 无 --apply 时 dry-run 零写入', () => {
    const fx = makeFixture()
    cleanup.push(fx.root)
    seedDrifted(fx)
    applyRestore(planOf(fx), { force: true })
    const opId = lastOpId(fx)

    const lines: string[] = []
    const origLog = console.log
    console.log = (s: string) => lines.push(s)
    const codeList = main(
      ['--snapshot', fx.snapDir, '--list-ops'],
      { snapshotDir: fx.snapDir },
      fx.root,
    )
    expect(codeList).toBe(0)
    const listText = lines.join('\n')
    expect(listText).toContain(opId)
    expect(listText).toContain('restore')
    expect(listText).toContain('files=3')
    expect(listText).not.toContain(SECRET_SENTINEL)

    // undo dry-run:列计划,零写入
    lines.length = 0
    const codeDry = main(
      ['--snapshot', fx.snapDir, '--undo', opId],
      { snapshotDir: fx.snapDir },
      fx.root,
    )
    console.log = origLog
    expect(codeDry).toBe(0)
    expect(lines.join('\n')).toContain('dry-run')
    expect(lines.join('\n')).toContain(opId)
    expect(lines.join('\n')).not.toContain(SECRET_SENTINEL)
    // 零写入:apply 落地文件原样、无 undo 记账、无临时残留
    expect(readFileSync(join(fx.srcSessions, 'sess-1', 'transcript.jsonl'), 'utf8')).toBe(
      fx.contents.get('workspace/sess-1/transcript.jsonl'),
    )
    expect(existsSync(join(fx.srcSessions, 'sess-1', 'state.json'))).toBe(true)
    expect(readRestoreOps(opsRootOf(fx)).filter((o) => o.type === 'undo')).toHaveLength(0)
    expect(
      [...relsUnder(fx.srcSessions), ...relsUnder(fx.srcProjects)].filter((n) =>
        n.includes('.undoing-'),
      ),
    ).toEqual([])
  })
})

/**
 * gzip 压缩快照夹具(全条目压缩):磁盘 `<rel>.gz`,manifest 条目带 encoding:'gzip',
 * bytes/sha256 仍为解压后原文基准 —— 与备份腿 --gzip 产物同形。
 */
function makeGzipFixture(): Fixture {
  const root = mkdtempSync(join(tmpdir(), 'wb-restore-undo-gz-test-'))
  const snapDir = join(root, 'snap')
  const srcSessions = join(root, 'src', 'sessions')
  const srcProjects = join(root, 'src', 'projects')
  const contents = new Map<string, string>([
    ['workspace/sess-1/state.json', '{"v":1}'],
    ['workspace/sess-1/transcript.jsonl', `${SECRET_SENTINEL}\nline2\n`],
    ['ws-a/conv.jsonl', 'hello\n'],
  ])
  const files: BackupFileEntry[] = []
  for (const [rel, content] of contents) {
    const abs = relToSnapAbs(rel, snapDir)
    mkdirSync(join(abs, '..'), { recursive: true })
    writeFileSync(`${abs}.gz`, gzipSync(Buffer.from(content)))
    files.push({
      rel,
      bytes: Buffer.byteLength(content),
      mtimeMs: statSync(`${abs}.gz`).mtimeMs,
      sha256: shaOf(content),
      encoding: 'gzip',
    })
  }
  writeFileSync(
    join(snapDir, 'manifest.json'),
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        source: { sessionsRoot: srcSessions, projectsRoot: srcProjects },
        files,
      },
      null,
      2,
    ),
  )
  return { root, snapDir, srcSessions, srcProjects, contents }
}

describe('gzip 压缩条目 × 逐条可撤', () => {
  it('压缩快照 force 覆盖 + undo:留底/落地/还原全部按原文逐字节,undo 腿无需感知压缩', () => {
    const fx = makeGzipFixture()
    cleanup.push(fx.root)
    seedDrifted(fx)
    const stats = applyRestore(planOf(fx), { force: true })
    expect(stats.restored).toBe(3)
    // 落地为原始名/原始字节(目标侧永远未压缩)
    expect(readFileSync(join(fx.srcSessions, 'sess-1', 'transcript.jsonl'), 'utf8')).toBe(
      fx.contents.get('workspace/sess-1/transcript.jsonl'),
    )
    expect(relsUnder(fx.srcSessions).some((n) => n.endsWith('.gz'))).toBe(false)

    // 记账与留底按原文 sha(压缩只是磁盘存储形态,校验基准不变)
    const opsRoot = opsRootOf(fx)
    const fileOps = readRestoreOps(opsRoot).filter((o) => o.type === 'restore')
    const tOp = fileOps.find((o) => o.file === 'workspace/sess-1/transcript.jsonl')
    expect(tOp?.before).toEqual({ exists: true, sha256: shaOf(DRIFTED) })
    expect(tOp?.afterSha).toBe(shaOf(fx.contents.get('workspace/sess-1/transcript.jsonl')!))
    const beforeAbs = join(
      opsRoot,
      lastOpId(fx),
      'before',
      'workspace',
      'sess-1',
      'transcript.jsonl',
    )
    expect(readFileSync(beforeAbs, 'utf8')).toBe(DRIFTED)

    // undo --apply:覆盖文件逐字节还原动前,新增文件删到不存在
    const code = main(
      ['--snapshot', fx.snapDir, '--undo', lastOpId(fx), '--apply'],
      { snapshotDir: fx.snapDir },
      fx.root,
    )
    expect(code).toBe(0)
    expect(readFileSync(join(fx.srcSessions, 'sess-1', 'transcript.jsonl'), 'utf8')).toBe(DRIFTED)
    expect(existsSync(join(fx.srcSessions, 'sess-1', 'state.json'))).toBe(false)
    expect(existsSync(join(fx.srcProjects, 'ws-a', 'conv.jsonl'))).toBe(false)
    const leftovers = [...relsUnder(fx.srcSessions), ...relsUnder(fx.srcProjects)].filter((n) =>
      n.includes('.undoing-'),
    )
    expect(leftovers).toEqual([])
  })

  it('压缩快照 undo dry-run 零写入(计划阶段不解盘内容,只比 sha)', () => {
    const fx = makeGzipFixture()
    cleanup.push(fx.root)
    applyRestore(planOf(fx))
    const opId = lastOpId(fx)
    const lines: string[] = []
    const origLog = console.log
    console.log = (s: string) => lines.push(s)
    const code = main(
      ['--snapshot', fx.snapDir, '--undo', opId],
      { snapshotDir: fx.snapDir },
      fx.root,
    )
    console.log = origLog
    expect(code).toBe(0)
    expect(lines.join('\n')).toContain('dry-run')
    expect(lines.join('\n')).not.toContain(SECRET_SENTINEL)
    // apply 落地文件原样、无 undo 记账
    expect(readFileSync(join(fx.srcSessions, 'sess-1', 'transcript.jsonl'), 'utf8')).toBe(
      fx.contents.get('workspace/sess-1/transcript.jsonl'),
    )
    expect(readRestoreOps(opsRootOf(fx)).filter((o) => o.type === 'undo')).toHaveLength(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
