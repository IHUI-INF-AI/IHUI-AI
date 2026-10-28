// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话恢复腿测试(⑦第二刀)。fixture 全部注入临时目录,断言:
 * - 默认 dry-run 只列差异,--apply 才回填,逐文件 sha256 对账;
 * - 漂移目标未 --force 整批拒绝(零写入),--force 才覆盖;
 * - 旧格式 manifest(缺 sha256)直接报错退出;
 * - 中途失败不留 .restoring- 残留;
 * - 输出零内容回显(消息正文埋雷不出现)。
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
import { afterAll, describe, expect, it } from 'vitest'
import {
  applyRestore,
  computeRestoreDiff,
  formatDiff,
  loadManifest,
  main,
  type RestorePlan,
} from '../scripts/relay-session-restore.js'
import type { BackupFileEntry } from '../scripts/relay-session-backup.js'

const SECRET_SENTINEL = 'TOPSECRET-CONVERSATION-BODY-7e1c'

interface Fixture {
  root: string
  snapDir: string
  srcSessions: string
  srcProjects: string
  /** 快照内两个内容文件的 rel → 内容 */
  contents: Map<string, string>
}

const shaOf = (buf: Buffer | string): string => createHash('sha256').update(buf).digest('hex')

/** 造一份与备份腿产物同形的假快照(manifest + workspace/ 与 projects 镜像树) */
function makeFixture(): Fixture {
  const root = mkdtempSync(join(tmpdir(), 'wb-restore-test-'))
  const snapDir = join(root, 'snap')
  const srcSessions = join(root, 'src', 'sessions')
  const srcProjects = join(root, 'src', 'projects')
  const contents = new Map<string, string>([
    ['workspace/sess-1/state.json', '{"v":1}'],
    ['workspace/sess-1/transcript.jsonl', `${SECRET_SENTINEL}\nline2\n`],
    ['ws-a/conv.jsonl', 'hello\n'],
  ])
  for (const [rel, content] of contents) {
    const abs = rel.startsWith('workspace/')
      ? join(snapDir, 'workspace', ...rel.slice('workspace/'.length).split('/'))
      : join(snapDir, ...rel.split('/'))
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

function planOf(fx: Fixture, destSessions?: string, destProjects?: string): RestorePlan {
  return {
    snapshotDir: fx.snapDir,
    destSessions: destSessions ?? fx.srcSessions,
    destProjects: destProjects ?? fx.srcProjects,
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

const cleanup: string[] = []
afterAll(() => {
  for (const p of cleanup) rmSync(p, { recursive: true, force: true })
})

describe('loadManifest(旧格式不认)', () => {
  it('缺 manifest.json / 缺 sha256 字段 / 坏 sha 格式 → 全部拒绝', () => {
    const fx = makeFixture()
    cleanup.push(fx.root)
    expect(loadManifest(fx.snapDir).files).toHaveLength(3)

    const noManifest = join(fx.root, 'snap-nomanifest')
    mkdirSync(noManifest, { recursive: true })
    expect(() => loadManifest(noManifest)).toThrow(/manifest\.json/)

    const oldFormat = join(fx.root, 'snap-old')
    mkdirSync(oldFormat, { recursive: true })
    writeFileSync(
      join(oldFormat, 'manifest.json'),
      JSON.stringify({
        createdAt: new Date().toISOString(),
        source: { sessionsRoot: fx.srcSessions, projectsRoot: fx.srcProjects },
        files: [{ rel: 'workspace/sess-1/state.json', bytes: 7, mtimeMs: 0 }],
      }),
    )
    expect(() => loadManifest(oldFormat)).toThrow(/sha256/)

    const badSha = join(fx.root, 'snap-badsha')
    mkdirSync(badSha, { recursive: true })
    writeFileSync(
      join(badSha, 'manifest.json'),
      JSON.stringify({
        createdAt: new Date().toISOString(),
        source: { sessionsRoot: fx.srcSessions, projectsRoot: fx.srcProjects },
        files: [{ rel: 'a', bytes: 1, mtimeMs: 0, sha256: 'nothex' }],
      }),
    )
    expect(() => loadManifest(badSha)).toThrow(/sha256/)
  })
})

describe('dry-run 差异比对(零写入)', () => {
  it('空目标:全部判缺失,多余文件只计数不动', () => {
    const fx = makeFixture()
    cleanup.push(fx.root)
    const destSessions = join(fx.root, 'dest-sessions')
    const destProjects = join(fx.root, 'dest-projects')
    mkdirSync(join(destSessions, 'sess-x'), { recursive: true })
    writeFileSync(join(destSessions, 'sess-x', 'extra.json'), 'extra') // 快照外多余文件
    const plan = planOf(fx, destSessions, destProjects)
    const diff = computeRestoreDiff(plan)
    expect(diff.missing.map((e) => e.entry.rel).sort()).toEqual([
      'workspace/sess-1/state.json',
      'workspace/sess-1/transcript.jsonl',
      'ws-a/conv.jsonl',
    ])
    expect(diff.mismatch).toHaveLength(0)
    expect(diff.match).toHaveLength(0)
    expect(diff.extraCount).toBe(1)
    const text = formatDiff(plan, diff, true)
    expect(text).toContain('dry-run')
    expect(text).toContain('transcript.jsonl')
    expect(text).toContain('多出 1 个')
    expect(text).not.toContain(SECRET_SENTINEL) // 零内容回显
    // dry-run 全程零写入
    expect(relsUnder(destSessions)).toEqual(['sess-x/extra.json'])
    expect(existsSync(destProjects)).toBe(false)
  })

  it('一致判 match,内容漂移判 mismatch 并带目标侧 sha', () => {
    const fx = makeFixture()
    cleanup.push(fx.root)
    mkdirSync(join(fx.srcSessions, 'sess-1'), { recursive: true })
    writeFileSync(
      join(fx.srcSessions, 'sess-1', 'state.json'),
      fx.contents.get('workspace/sess-1/state.json')!,
    )
    writeFileSync(join(fx.srcSessions, 'sess-1', 'transcript.jsonl'), 'DRIFTED\n') // 漂移
    const plan = planOf(fx)
    const diff = computeRestoreDiff(plan)
    expect(diff.match.map((e) => e.entry.rel)).toEqual(['workspace/sess-1/state.json'])
    expect(diff.mismatch.map((e) => e.entry.rel)).toEqual(['workspace/sess-1/transcript.jsonl'])
    expect(diff.mismatch[0].destSha).toBe(shaOf('DRIFTED\n'))
  })
})

describe('applyRestore(--apply 原子回填)', () => {
  it('空目录恢复:逐文件 sha 一致,无 .restoring- 残留,输出零泄漏', () => {
    const fx = makeFixture()
    cleanup.push(fx.root)
    const plan = planOf(fx)
    const stats = applyRestore(plan)
    const totalBytes = [...fx.contents.values()].reduce((s, c) => s + Buffer.byteLength(c), 0)
    expect(stats).toEqual({ restored: 3, skipped: 0, failed: 0, totalBytes })
    for (const [rel, content] of fx.contents) {
      const abs = rel.startsWith('workspace/')
        ? join(fx.srcSessions, ...rel.slice('workspace/'.length).split('/'))
        : join(fx.srcProjects, ...rel.split('/'))
      expect(readFileSync(abs, 'utf8')).toBe(content)
      expect(shaOf(readFileSync(abs))).toBe(shaOf(content))
    }
    const leftovers = [...relsUnder(fx.srcSessions), ...relsUnder(fx.srcProjects)].filter((n) =>
      n.includes('.restoring-'),
    )
    expect(leftovers).toEqual([])
  })

  it('内容漂移拒绝:未 --force 整批拒绝且零写入;--force 覆盖且校验过', () => {
    const fx = makeFixture()
    cleanup.push(fx.root)
    mkdirSync(join(fx.srcSessions, 'sess-1'), { recursive: true })
    const driftedAbs = join(fx.srcSessions, 'sess-1', 'transcript.jsonl')
    writeFileSync(driftedAbs, 'DRIFTED\n')
    const plan = planOf(fx)

    // 未 --force:整批拒绝,任何文件都不写(包括缺失的兄弟文件)
    expect(() => applyRestore(plan)).toThrow(/整批拒绝/)
    expect(readFileSync(driftedAbs, 'utf8')).toBe('DRIFTED\n')
    expect(existsSync(join(fx.srcSessions, 'sess-1', 'state.json'))).toBe(false)
    expect(relsUnder(fx.srcProjects)).toEqual([])

    // --force:覆盖漂移文件,内容与快照逐字节一致
    const stats = applyRestore(plan, { force: true })
    expect(stats.restored).toBe(3)
    expect(readFileSync(driftedAbs, 'utf8')).toBe(
      fx.contents.get('workspace/sess-1/transcript.jsonl'),
    )
  })

  it('中途失败(快照源缺失 + 目标被目录占位)→ 报错且无 .restoring- 残留', () => {
    const fx = makeFixture()
    cleanup.push(fx.root)
    // 注入缝 1:快照侧删掉一个条目对应的内容文件 → 读源失败
    rmSync(join(fx.snapDir, 'workspace', 'sess-1', 'state.json'))
    // 注入缝 2:目标路径被目录占位 → 临时文件写成功但 rename 失败
    mkdirSync(join(fx.srcProjects, 'ws-a', 'conv.jsonl'), { recursive: true })
    const plan = planOf(fx)
    expect(() => applyRestore(plan, { force: true })).toThrow(/恢复未完成/)
    // 两个目标根树下都不留临时残留
    for (const root of [fx.srcSessions, fx.srcProjects]) {
      expect(relsUnder(root).filter((n) => n.includes('.restoring-'))).toEqual([])
    }
    // 被目录占位的目标未被破坏(还是目录)
    expect(statSync(join(fx.srcProjects, 'ws-a', 'conv.jsonl')).isDirectory()).toBe(true)
  })

  it('重复 apply 幂等:第二轮全跳过', () => {
    const fx = makeFixture()
    cleanup.push(fx.root)
    const plan = planOf(fx)
    applyRestore(plan)
    const diff = computeRestoreDiff(plan)
    expect(diff.match).toHaveLength(3)
    expect(diff.missing).toHaveLength(0)
    const stats = applyRestore(plan)
    expect(stats).toEqual({ restored: 0, skipped: 3, failed: 0, totalBytes: 0 })
  })
})

describe('main CLI(注入缝)', () => {
  it('dry-run → --apply → --dest 搬家形态:落到另一对目录,原源根零写入', () => {
    const fx = makeFixture()
    cleanup.push(fx.root)
    const destSessions = join(fx.root, 'new-home', 'sessions')
    const destProjects = join(fx.root, 'new-home', 'projects')
    const paths = { snapshotDir: fx.snapDir }

    const lines: string[] = []
    const origLog = console.log
    console.log = (s: string) => lines.push(s)
    // dry-run(默认目标 = manifest 记录的原源根)
    const codeDry = main(['--snapshot', fx.snapDir], paths)
    console.log = origLog
    expect(codeDry).toBe(0)
    expect(lines.join('\n')).toContain('dry-run')
    expect(lines.join('\n')).not.toContain(SECRET_SENTINEL)
    expect(existsSync(fx.srcSessions)).toBe(false) // dry-run 零写入

    // --apply --dest-*:搬家到另一对目录
    lines.length = 0
    console.log = (s: string) => lines.push(s)
    const code = main(
      [
        '--snapshot',
        fx.snapDir,
        '--apply',
        '--dest-sessions',
        destSessions,
        '--dest-projects',
        destProjects,
      ],
      paths,
      fx.root,
    )
    console.log = origLog
    expect(code).toBe(0)
    for (const [rel, content] of fx.contents) {
      const abs = rel.startsWith('workspace/')
        ? join(destSessions, ...rel.slice('workspace/'.length).split('/'))
        : join(destProjects, ...rel.split('/'))
      expect(readFileSync(abs, 'utf8')).toBe(content)
    }
    // 原源根全程零写入
    expect(existsSync(fx.srcSessions)).toBe(false)
    expect(existsSync(fx.srcProjects)).toBe(false)
  })

  it('旧格式 manifest → 退出码非 0,且目标侧零写入', () => {
    const fx = makeFixture()
    cleanup.push(fx.root)
    const oldFormat = join(fx.root, 'snap-old')
    mkdirSync(oldFormat, { recursive: true })
    writeFileSync(
      join(oldFormat, 'manifest.json'),
      JSON.stringify({
        createdAt: new Date().toISOString(),
        source: { sessionsRoot: fx.srcSessions, projectsRoot: fx.srcProjects },
        files: [{ rel: 'workspace/sess-1/state.json', bytes: 7, mtimeMs: 0 }],
      }),
    )
    const errors: string[] = []
    const origErr = console.error
    console.error = (s: string) => errors.push(s)
    const code = main(['--snapshot', oldFormat, '--apply'], undefined, fx.root)
    console.error = origErr
    expect(code).not.toBe(0)
    expect(errors.join('\n')).toContain('sha256')
    expect(existsSync(fx.srcSessions)).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
