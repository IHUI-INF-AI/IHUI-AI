// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话操作日志运维腿单测(relay-session-ops,2026-10-27 立,⑦第三刀·运维卫生)。
 * fixture 全注入临时目录,绝不碰真实会话库,断言:
 * - stats:混合 type 与非 JSON 坏行统计正确(坏行单独计数不崩),快照 restore-ops 的
 *   op 数/before 文件数与字节数正确,输出零内容(留底正文埋雷不出现);
 * - rotate dry-run 零改动;--apply 后归档与剩余条数守恒、内容逐条可解析;
 * - undo 引用保护(核心判据):被 undo 引用的超期条目不归档(正例),同批超期未被引用
 *   的照常归档(反例);undo 记录本身也不归档(引用载体),连续两轮都护得住;
 * - prune-snapshots 只读:--apply 后快照目录一个不少,只列可人工清理清单;
 * - 坏输入(--keep-days 非数字/负数/缺值、未知子命令)→ exit 2;
 * - 非对象行导致 op 号与 undo 行号对不齐 ⇒ 未判定 exit 2,原日志不动。
 */
import { afterAll, describe, expect, it, vi } from 'vitest'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { main, scanOpsLog, type OpsPaths } from '../scripts/relay-session-ops.js'
import { readOps, type MoveOp } from '../scripts/relay-session-move.js'

const NOW = new Date('2026-10-27T00:00:00.000Z')
const DAY_MS = 86_400_000
const SECRET_BODY = 'TOPSECRET-SESSION-BODY-ops-9f3a'

const oldTs = (daysAgo: number): string => new Date(NOW.getTime() - daysAgo * DAY_MS).toISOString()

interface Fixture {
  root: string
  paths: OpsPaths
}

const roots: string[] = []

function makeFixture(): Fixture {
  const root = mkdtempSync(join(tmpdir(), 'wb-session-ops-'))
  roots.push(root)
  return {
    root,
    paths: {
      opsLogFile: join(root, 'relay', 'move_ops.jsonl'),
      backupsSessionsDir: join(root, 'backups', 'sessions'),
    },
  }
}

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
})

function moveOp(ts: string, type: MoveOp['type'] = 'move', extra: Partial<MoveOp> = {}): MoveOp {
  return {
    ts,
    type,
    conversationId: 'c-default',
    accountId: 'acct-a',
    entries: [{ from: '/src/a', to: '/dst/a', bytes: 3, sha256: 'sha-a' }],
    ...extra,
  }
}

/** 写日志:MoveOp 序列化成 JSON 行;字符串原样写入(用于坏行/非对象行) */
function writeOps(file: string, lines: (MoveOp | string)[]): void {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(
    file,
    `${lines.map((l) => (typeof l === 'string' ? l : JSON.stringify(l))).join('\n')}\n`,
  )
}

function readNonEmptyLines(file: string): string[] {
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim() !== '')
}

/** 捕获 main 的人话输出(console.log)与错误(stderr),不打印到测试终端 */
function capture(
  argv: string[],
  paths: OpsPaths,
  now = NOW,
): { code: number; out: string; err: string } {
  const logs: string[] = []
  const errs: string[] = []
  const logSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    logs.push(args.map((a) => String(a)).join(' '))
  })
  const errSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    errs.push(args.map((a) => String(a)).join(' '))
  })
  try {
    const code = main(argv, { ...paths, now })
    return { code, out: logs.join('\n'), err: errs.join('\n') }
  } finally {
    logSpy.mockRestore()
    errSpy.mockRestore()
  }
}

function seedSnapshotRestoreOps(backupsSessionsDir: string): void {
  const snapDir = join(backupsSessionsDir, '20261027T100000Z')
  const opsRoot = join(snapDir, 'restore-ops')
  mkdirSync(opsRoot, { recursive: true })
  const at = '2026-10-27T10:00:00.000Z'
  const beforeA = join(opsRoot, 'OP-A', 'before', 'workspace', 'sess-1', 'state.json')
  const beforeB = join(opsRoot, 'OP-A', 'before', 'projects', 'ws-a', 'conv.jsonl')
  mkdirSync(dirname(beforeA), { recursive: true })
  mkdirSync(dirname(beforeB), { recursive: true })
  writeFileSync(beforeA, SECRET_BODY)
  writeFileSync(beforeB, 'plain\n')
  const lines = [
    {
      op: 'OP-A',
      type: 'restore',
      file: 'workspace/sess-1/state.json',
      before: { exists: true, sha256: 'before-sha' },
      afterSha: 'after-sha',
      bytes: Buffer.byteLength(SECRET_BODY),
      at,
    },
    {
      op: 'OP-A',
      type: 'restore-run',
      files: 1,
      restored: 1,
      failed: 0,
      at,
    },
    {
      op: 'OP-B',
      type: 'undo',
      refOp: 'OP-A',
      entries: [
        { file: 'workspace/sess-1/state.json', action: 'restore-before', bytes: 3, sha256: null },
      ],
      at,
    },
  ]
  writeFileSync(
    join(opsRoot, 'ops.jsonl'),
    `${lines.map((l) => JSON.stringify(l)).join('\n')}\n{broken-restore-line\n`,
  )
}

describe('stats:量算仪', () => {
  it('混合 type + 非 JSON 坏行:坏行单独计数不崩,引用与时刻取对', () => {
    const { paths } = makeFixture()
    writeOps(paths.opsLogFile, [
      moveOp('2020-01-01T00:00:00.000Z', 'move'),
      moveOp('2026-10-01T00:00:00.000Z', 'restore'),
      moveOp('2026-10-02T00:00:00.000Z', 'undo', { refOp: 1 }),
      moveOp('2026-10-03T00:00:00.000Z', 'copy'),
      '{broken-json',
      'null',
      moveOp('not-a-date', 'move'),
    ])
    const scan = scanOpsLog(paths.opsLogFile)
    expect(scan.entries).toHaveLength(5)
    expect(scan.badLines).toBe(2)
    // readOps 只看解析成功(含 JSON 非对象 null),scan 只收对象 ⇒ 两类坏行都要单独报
    expect(readOps(paths.opsLogFile)).toHaveLength(6)

    const { code, out } = capture(['stats', '--json'], paths)
    expect(code).toBe(0)
    const stats = JSON.parse(out) as {
      total: number
      badLines: number
      byType: Record<string, number>
      earliestTs: string | null
      latestTs: string | null
      unparsableTs: number
      undoRecords: number
      undoRefOpNums: number[]
      danglingRefOpNums: number[]
      snapshots: unknown[]
    }
    expect(stats.total).toBe(5)
    expect(stats.badLines).toBe(2)
    expect(stats.byType).toEqual({ move: 2, restore: 1, undo: 1, copy: 1 })
    expect(stats.earliestTs).toBe('2020-01-01T00:00:00.000Z')
    expect(stats.latestTs).toBe('2026-10-03T00:00:00.000Z')
    expect(stats.unparsableTs).toBe(1)
    expect(stats.undoRecords).toBe(1)
    expect(stats.undoRefOpNums).toEqual([1])
    expect(stats.danglingRefOpNums).toEqual([])
    expect(stats.snapshots).toEqual([])
  })

  it('scanOpsLog 与 readOps 同系(合法日志逐条对等,复数口径不漂)', () => {
    const { paths } = makeFixture()
    writeOps(paths.opsLogFile, [
      moveOp(oldTs(10), 'move'),
      moveOp(oldTs(5), 'restore'),
      moveOp(oldTs(1), 'undo', { refOp: 2 }),
    ])
    expect(scanOpsLog(paths.opsLogFile).entries.map((e) => e.op)).toEqual(readOps(paths.opsLogFile))
  })

  it('快照 restore-ops:op 数/before 文件数与字节数正确,输出零内容', () => {
    const { paths } = makeFixture()
    seedSnapshotRestoreOps(paths.backupsSessionsDir)
    const { code, out } = capture(['stats'], paths)
    expect(code).toBe(0)
    expect(out).toContain('20261027T100000Z')
    expect(out).toContain('op=2')
    expect(out).toContain('restore条=1')
    expect(out).toContain('run=1')
    expect(out).toContain('undo条=1')
    expect(out).toContain('before文件=2')
    expect(out).toContain(
      `before字节=${Buffer.byteLength(SECRET_BODY) + Buffer.byteLength('plain\n')}`,
    )
    expect(out).toContain('坏行=1')
    // 零内容纪律:留底正文(会话内容)一个字都不许出现在输出里
    expect(out).not.toContain(SECRET_BODY)
  })

  it('日志与快照根都不存在:0 条/0 份,exit 0(不是未判定)', () => {
    const { paths } = makeFixture()
    const { code, out } = capture(['stats'], paths)
    expect(code).toBe(0)
    expect(out).toContain('不存在(0 条')
    expect(out).toContain('不存在(0 份快照)')
  })
})

describe('rotate:dry-run 与 --apply', () => {
  it('dry-run 零改动:文件逐字节不变、不产生归档文件', () => {
    const { root, paths } = makeFixture()
    writeOps(paths.opsLogFile, [
      moveOp(oldTs(40), 'move'),
      moveOp(oldTs(40), 'move'),
      moveOp(oldTs(1), 'move'),
    ])
    const before = readFileSync(paths.opsLogFile, 'utf8')
    const { code, out } = capture(['rotate', '--keep-days', '30'], paths)
    expect(code).toBe(0)
    expect(out).toContain('将归档: 2 条')
    expect(out).toContain('dry-run')
    expect(readFileSync(paths.opsLogFile, 'utf8')).toBe(before)
    expect(readdirSync(join(root, 'relay')).filter((n) => n.includes('.archive-'))).toEqual([])
  })

  it('--apply:条数守恒、归档与剩余内容逐条可解析、归档日期取 UTC 日', () => {
    const { root, paths } = makeFixture()
    writeOps(paths.opsLogFile, [
      moveOp(oldTs(50), 'move'),
      moveOp(oldTs(45), 'restore'),
      moveOp(oldTs(40), 'copy'),
      moveOp(oldTs(1), 'move'),
    ])
    const originalCount = readNonEmptyLines(paths.opsLogFile).length
    const { code, out } = capture(['rotate', '--keep-days', '30', '--apply'], paths)
    expect(code).toBe(0)
    expect(out).toContain('归档 3 条')
    expect(out).toContain('条数守恒校验通过')
    const archiveFiles = readdirSync(join(root, 'relay')).filter((n) => n.includes('.archive-'))
    expect(archiveFiles).toEqual(['move_ops.archive-2026-10-27.jsonl'])
    const archiveFile = join(root, 'relay', archiveFiles[0] as string)
    const archiveLines = readNonEmptyLines(archiveFile)
    const keepLines = readNonEmptyLines(paths.opsLogFile)
    expect(archiveLines).toHaveLength(3)
    expect(keepLines).toHaveLength(1)
    // 条数守恒:归档 + 剩余 == 原条数
    expect(archiveLines.length + keepLines.length).toBe(originalCount)
    // 两侧内容逐条可解析,归档的确实是超期三型
    expect(archiveLines.map((l) => (JSON.parse(l) as MoveOp).type)).toEqual([
      'move',
      'restore',
      'copy',
    ])
    expect((JSON.parse(keepLines[0] as string) as MoveOp).ts).toBe(oldTs(1))
  })

  it('归档文件已存在(同日第二轮):追加而不覆盖,总行数按两轮累加', () => {
    const { root, paths } = makeFixture()
    const archiveFile = join(root, 'relay', 'move_ops.archive-2026-10-27.jsonl')
    mkdirSync(dirname(archiveFile), { recursive: true })
    writeFileSync(archiveFile, `${JSON.stringify(moveOp(oldTs(90), 'move'))}\n`)
    writeOps(paths.opsLogFile, [moveOp(oldTs(60), 'move'), moveOp(oldTs(1), 'move')])
    const { code, out } = capture(['rotate', '--keep-days', '30', '--apply'], paths)
    expect(code).toBe(0)
    expect(readNonEmptyLines(archiveFile)).toHaveLength(2)
    expect(out).toContain('归档文件现 2 行')
  })
})

describe('rotate:undo 引用保护(核心判据)', () => {
  function seedProtectedFixture(paths: OpsPaths): void {
    writeOps(paths.opsLogFile, [
      // #1 超期 + 被 undo 引用 ⇒ 永不归档
      moveOp(oldTs(50), 'move', { conversationId: 'c-old-1' }),
      // #2 超期 + 未被引用 ⇒ 归档(反例)
      moveOp(oldTs(45), 'restore', { conversationId: 'c-old-2' }),
      // #3 undo 记录本身是引用载体 ⇒ 也不归档
      moveOp(oldTs(44), 'undo', { refOp: 1, conversationId: null }),
      // #4 超期 + 未被引用 ⇒ 归档(反例)
      moveOp(oldTs(43), 'copy', { conversationId: 'c-old-4' }),
      // #5 未超期 ⇒ 保留
      moveOp(oldTs(2), 'move', { conversationId: 'c-new-5' }),
      // 坏行(不占 op 号)⇒ 原样保留
      '{broken-line',
      // #6 ts 不可判定 ⇒ 保留(未判定不删)
      moveOp('not-a-date', 'move', { conversationId: 'c-unjudged-6' }),
    ])
  }

  it('被 undo 引用的超期条目保留,未被引用的超期条目照常归档', () => {
    const { paths } = makeFixture()
    seedProtectedFixture(paths)
    const totalLines = readNonEmptyLines(paths.opsLogFile).length
    const { code, out } = capture(['rotate', '--keep-days', '30', '--apply'], paths)
    expect(code).toBe(0)
    expect(out).toContain('受 undo 引用而保留: #1(1 个)')
    expect(out).toContain('undo 记录(引用载体,永不归档): #3(1 个)')
    expect(out).toContain('ts 不可判定而保留: #6(1 个)')

    const relDir = dirname(paths.opsLogFile)
    const archiveFile = join(relDir, 'move_ops.archive-2026-10-27.jsonl')
    const archived = readNonEmptyLines(archiveFile).map((l) => JSON.parse(l) as MoveOp)
    expect(archived.map((op) => op.conversationId)).toEqual(['c-old-2', 'c-old-4'])

    const kept = readOps(paths.opsLogFile)
    expect(kept.map((op) => op.conversationId)).toEqual([
      'c-old-1',
      null,
      'c-new-5',
      'c-unjudged-6',
    ])
    // 保护项的行号不变:refOp=1 仍指向 c-old-1(归档全发生在它之后)
    expect(kept[0]?.conversationId).toBe('c-old-1')
    expect(kept[1]?.refOp).toBe(1)
    // 守恒:归档 2 + 剩余物理行 5 == 原 7
    expect(archived.length + readNonEmptyLines(paths.opsLogFile).length).toBe(totalLines)
  })

  it('保护是持久的:连续两轮 rotate 都不会把被引用条目带走', () => {
    const { paths } = makeFixture()
    seedProtectedFixture(paths)
    expect(capture(['rotate', '--keep-days', '30', '--apply'], paths).code).toBe(0)
    const afterFirst = readFileSync(paths.opsLogFile, 'utf8')
    const second = capture(['rotate', '--keep-days', '30', '--apply'], paths)
    expect(second.code).toBe(0)
    expect(second.out).toContain('将归档: 0 条')
    expect(readFileSync(paths.opsLogFile, 'utf8')).toBe(afterFirst)
    expect(readOps(paths.opsLogFile)[0]?.conversationId).toBe('c-old-1')
  })

  it('非对象行导致 op 号与 undo 行号对不齐:未判定 exit 2,原日志不动', () => {
    const { paths } = makeFixture()
    writeOps(paths.opsLogFile, [moveOp(oldTs(40), 'move'), 'null'])
    const before = readFileSync(paths.opsLogFile, 'utf8')
    const { code, err } = capture(['rotate', '--keep-days', '1', '--apply'], paths)
    expect(code).toBe(2)
    expect(err).toContain('未判定')
    expect(readFileSync(paths.opsLogFile, 'utf8')).toBe(before)
  })
})

describe('prune-snapshots:刻意只读', () => {
  function seedSnapshots(backupsSessionsDir: string): string[] {
    const names = ['20261001T000000Z', '20261002T000000Z', '20261003T000000Z']
    names.forEach((name, index) => {
      const dir = join(backupsSessionsDir, name)
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, 'manifest.json'), '{"createdAt":"x"}\n')
      const sec = NOW.getTime() / 1000 - (names.length - index) * 3600
      utimesSync(dir, sec, sec)
    })
    return names
  }

  it('--apply 后快照目录一个不少,只列可人工清理清单', () => {
    const { paths } = makeFixture()
    const names = seedSnapshots(paths.backupsSessionsDir)
    const { code, out } = capture(['prune-snapshots', '--keep', '2', '--apply'], paths)
    expect(code).toBe(0)
    expect(out).toContain('共 3 份;保留最近 2 份')
    expect(out).toContain('可人工清理的目录(1 份,只报数)')
    expect(out).toContain(names[0] as string)
    expect(out).toContain('本器刻意只读')
    for (const name of names) {
      expect(existsSync(join(paths.backupsSessionsDir, name))).toBe(true)
    }
  })

  it('快照根不存在:0 份,exit 0', () => {
    const { paths } = makeFixture()
    const { code, out } = capture(['prune-snapshots', '--keep', '1'], paths)
    expect(code).toBe(0)
    expect(out).toContain('不存在(0 份快照)')
  })
})

describe('坏输入:参数错一律 exit 2', () => {
  it('--keep-days 非数字/负数/缺值/零 ⇒ 2', () => {
    const { paths } = makeFixture()
    for (const argv of [
      ['rotate', '--keep-days', 'abc'],
      ['rotate', '--keep-days', '-5'],
      ['rotate', '--keep-days'],
      ['rotate', '--keep-days', '0'],
      ['rotate'],
    ]) {
      expect(capture(argv, paths).code).toBe(2)
    }
  })

  it('--keep 非数字/负数/缺值 ⇒ 2;未知子命令/未知旗标 ⇒ 2', () => {
    const { paths } = makeFixture()
    expect(capture(['prune-snapshots', '--keep', 'x'], paths).code).toBe(2)
    expect(capture(['prune-snapshots', '--keep', '-1'], paths).code).toBe(2)
    expect(capture(['prune-snapshots'], paths).code).toBe(2)
    expect(capture(['nope'], paths).code).toBe(2)
    expect(capture(['stats', '--nope'], paths).code).toBe(2)
  })

  it('help 与无参数:打印用法并 exit 0', () => {
    const { paths } = makeFixture()
    expect(capture([], paths).code).toBe(0)
    const help = capture(['help'], paths)
    expect(help.code).toBe(0)
    expect(help.out).toContain('relay:session-ops rotate --keep-days <N>')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
