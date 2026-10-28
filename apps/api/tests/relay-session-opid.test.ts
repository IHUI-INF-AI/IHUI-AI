// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话 ops 不可变操作号(opId)判据锁(2026-10-28 立,⑦第五波)。
 * 缺陷原型:undo 号此前 = 「归档 ⊕ 当前」的位置下标。位置要成立,前提是从历史第一条起
 * 一行都不能少、也不能被手工动过 —— 归档件被清理、半行坏数据被跳过、有人裁过老行,
 * 三者任一发生,`undo --op N` 就会指向另一个操作(撤错 = 动错文件)。
 * 修复 = 号在 append 当时写进条目自身(opId),rotate 落盘时固化进留存的每一行,
 * 定位只认 opId;位置补推只作为旧库读取期的兜底,不再是被依赖的前提。
 * 三处消费面必须同批改(本文件逐处钉住):`undo --op` 寻址、`ops` 清单印的号(操作者就是从
 * 这里抄号回头喂 undo)、`stats` 的悬空引用判定(号空间 = 全序 opId 集,不是主日志条数)。
 * Qoder 腿与 WorkBuddy 搬移腿共用 appendOps/readOpsAll ⇒ 同批回归(台账⑦票面前置)。
 * 反事实锁:下面每条都用「位置 ≠ opId」的种子数据来断言,把实现退回按下标取即翻红。
 */
import { afterAll, describe, expect, it, vi } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import {
  appendOps,
  main as moveMain,
  maxOpIdOf,
  planUndo,
  readOps,
  readOpsAll,
  type MoveOp,
  type MovePaths,
} from '../scripts/relay-session-move.js'
import {
  collectStats,
  main as opsMain,
  planRotate,
  type OpsPaths,
} from '../scripts/relay-session-ops.js'
import {
  main as qoderMain,
  planQoderUndo,
  type QoderPaths,
} from '../scripts/relay-session-qoder.js'

const DAY_MS = 86_400_000
const NOW = new Date('2026-10-28T00:00:00.000Z')
const oldTs = (daysAgo: number): string => new Date(NOW.getTime() - daysAgo * DAY_MS).toISOString()

const roots: string[] = []
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
})

function opsFile(name: string): string {
  const root = mkdtempSync(join(tmpdir(), `wb-opid-${name}-`))
  roots.push(root)
  return join(root, 'relay', 'move_ops.jsonl')
}

function entry(conv: string): MoveOp['entries'][number] {
  return { from: `/src/${conv}`, to: `/bucket/${conv}`, bytes: 3, sha256: 'sha' }
}

/** 手写 ops 行(可指定 opId,用于造「位置 ≠ 号」的形态) */
function seedOps(
  file: string,
  rows: { opId?: number; conv: string | null; type?: MoveOp['type'] }[],
) {
  mkdirSync(dirname(file), { recursive: true })
  const lines = rows.map((r) =>
    JSON.stringify({
      ts: oldTs(1),
      type: r.type ?? 'move',
      conversationId: r.conv,
      accountId: 'acct-a',
      ...(r.opId === undefined ? {} : { opId: r.opId }),
      entries: [entry(r.conv)],
    }),
  )
  writeFileSync(file, `${lines.join('\n')}\n`)
}

function captureRotate(argv: string[], paths: OpsPaths): { code: number; out: string } {
  const logs: string[] = []
  const spy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    logs.push(args.map((a) => String(a)).join(' '))
  })
  try {
    return { code: opsMain(argv, { ...paths, now: NOW }), out: logs.join('\n') }
  } finally {
    spy.mockRestore()
  }
}

describe('appendOps:自动盖号', () => {
  it('空日志起 1,逐条递增;调用点不写号也不漏', () => {
    const file = opsFile('append')
    appendOps(file, {
      ts: oldTs(1),
      type: 'move',
      conversationId: 'c-1',
      accountId: 'a',
      entries: [entry('c-1')],
    })
    appendOps(file, {
      ts: oldTs(1),
      type: 'move',
      conversationId: 'c-2',
      accountId: 'a',
      entries: [entry('c-2')],
    })
    expect(readOps(file).map((o) => o.opId)).toEqual([1, 2])
  })

  it('主日志已被 rotate 前移 ⇒ 新号按全序末位 +1,不回落到位置号撞车', () => {
    const file = opsFile('append-after-rotate')
    // rotate 后遗留形态:主日志只剩三条,真实号是 5/8/9(6、7 的归档件已被清理)
    seedOps(file, [
      { opId: 5, conv: 'c-5' },
      { opId: 8, conv: 'c-8' },
      { opId: 9, conv: 'c-9' },
    ])
    expect(maxOpIdOf(file)).toBe(9)
    appendOps(file, {
      ts: oldTs(0),
      type: 'move',
      conversationId: 'c-new',
      accountId: 'a',
      entries: [entry('c-new')],
    })
    const last = readOps(file)[readOps(file).length - 1]
    expect(last?.opId).toBe(10)
    // 位置法会把新条目读成 #4 ⇒ 与已有 undo 引用撞号
    expect(readOps(file).map((o) => o.opId)).toEqual([5, 8, 9, 10])
  })

  it('调用点显式给的号被尊重(undo 记录沿用 refOp 语义不重号)', () => {
    const file = opsFile('append-explicit')
    seedOps(file, [{ opId: 3, conv: 'c-3' }])
    appendOps(file, {
      ts: oldTs(0),
      type: 'undo',
      conversationId: null,
      accountId: null,
      refOp: 3,
      opId: 7,
      entries: [entry('c-3')],
    })
    const ops = readOps(file)
    expect(ops.map((o) => o.opId)).toEqual([3, 7])
    expect(ops[1]?.refOp).toBe(3)
  })
})

describe('planUndo:只认 opId,不认位置', () => {
  it('归档件缺失时仍按写定的号定位(位置法在此必然指错)', () => {
    const file = opsFile('locate')
    seedOps(file, [
      { opId: 5, conv: 'c-5' },
      { opId: 8, conv: 'c-8' },
      { opId: 9, conv: 'c-9' },
    ])
    expect(planUndo(file, 8).op.conversationId).toBe('c-8')
    expect(planUndo(file, 5).op.conversationId).toBe('c-5')
    expect(planUndo(file, 9).op.conversationId).toBe('c-9')
  })

  it('号不存在 ⇒ 点名 opId 并给出归档计数,不回落位置', () => {
    const file = opsFile('missing')
    seedOps(file, [
      { opId: 5, conv: 'c-5' },
      { opId: 8, conv: 'c-8' },
    ])
    expect(() => planUndo(file, 6)).toThrow(/无 opId #6/)
    expect(() => planUndo(file, 6)).toThrow(/现存 2 条/)
  })

  it('旧库(无 opId)按位置补推仍能解析:全序视图即真实号', () => {
    const file = opsFile('legacy')
    seedOps(file, [{ conv: 'c-1' }, { conv: 'c-2' }, { conv: 'c-3' }])
    const all = readOpsAll(file)
    expect(all.ops.map((o) => o.opId)).toEqual([1, 2, 3])
    expect(planUndo(file, 2).op.conversationId).toBe('c-2')
  })
})

describe('rotate:落盘固化 opId(旧库一次 rotate 即升级)', () => {
  function pathsFor(file: string): OpsPaths {
    return {
      opsLogFile: file,
      backupsSessionsDir: join(dirname(file), '..', 'backups', 'sessions'),
    }
  }

  it('归档与留存两侧每一行都带整数 opId,且等于 rotate 前的全序号', () => {
    const file = opsFile('solidify')
    // 六条全无号:#1/#2 超期未被引用 ⇒ 归档;#3 被 undo 引用 ⇒ 保留;#4 是 undo 记录 ⇒ 保留;#5/#6 未超期
    seedOps(file, [
      { conv: 'c-1', type: 'move' },
      { conv: 'c-2', type: 'move' },
      { conv: 'c-3', type: 'move' },
      { conv: null, type: 'undo' },
      { conv: 'c-5', type: 'move' },
      { conv: 'c-6', type: 'move' },
    ])
    // 把 undo 记录的 refOp 补成 3(引用 #3),并让 #1/#2/#3/#4 超期
    const raw = readFileSync(file, 'utf8')
      .split('\n')
      .filter((l) => l.trim() !== '')
    const rows = raw.map((l) => JSON.parse(l) as MoveOp)
    if (rows[3]) rows[3].refOp = 3
    for (const [i, row] of rows.entries()) if (i <= 3) row.ts = oldTs(50 - i)
    writeFileSync(file, `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`)

    const beforeUndoTarget = planUndo(file, 3).op.conversationId
    const { code, out } = captureRotate(['rotate', '--keep-days', '30', '--apply'], pathsFor(file))
    expect(code).toBe(0)
    expect(out).toContain('归档 2 条')

    const kept = readOps(file)
    expect(kept.map((o) => o.conversationId)).toEqual(['c-3', null, 'c-5', 'c-6'])
    // 关键:留存行的号是 3/4/5/6,不是被归档两行挤下来的 1/2/3/4
    expect(kept.map((o) => o.opId)).toEqual([3, 4, 5, 6])
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (line.trim() === '') continue
      const op = JSON.parse(line) as MoveOp
      expect(Number.isInteger(op.opId)).toBe(true)
    }
    // 归档件同样固化
    const archive = readOps(join(dirname(file), 'move_ops.archive-2026-10-28.jsonl'))
    expect(archive.map((o) => o.opId)).toEqual([1, 2])
    // rotate 前后同一个号指向同一个操作(用户手里的旧号不作废)
    expect(planUndo(file, 3).op.conversationId).toBe(beforeUndoTarget)
    expect(planUndo(file, 1).op.conversationId).toBe('c-1')
  })

  it('固化后再 rotate:号仍不动(第二轮不会二次前移)', () => {
    const file = opsFile('solidify-2nd')
    // 四条已带号(模拟上一轮固化过的库):#3 超期无引用 ⇒ 归档;#4 被 #5(undo)引用 ⇒ 保留;
    // #5 是引用载体 ⇒ 保留;#6 未超期 ⇒ 保留
    seedOps(file, [
      { opId: 3, conv: 'c-3', type: 'move' },
      { opId: 4, conv: 'c-4', type: 'move' },
      { opId: 5, conv: null, type: 'undo' },
      { opId: 6, conv: 'c-6', type: 'move' },
    ])
    const rows = readFileSync(file, 'utf8')
      .split('\n')
      .filter((l) => l.trim() !== '')
      .map((l) => JSON.parse(l) as MoveOp)
    rows[2]!.refOp = 4
    rows[0]!.ts = oldTs(50)
    rows[1]!.ts = oldTs(49)
    rows[2]!.ts = oldTs(48)
    rows[3]!.ts = oldTs(1)
    writeFileSync(file, `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`)

    expect(captureRotate(['rotate', '--keep-days', '30', '--apply'], pathsFor(file)).code).toBe(0)
    const idsAfterFirst = readOps(file).map((o) => o.opId)
    expect(idsAfterFirst).toEqual([4, 5, 6])
    expect(captureRotate(['rotate', '--keep-days', '30', '--apply'], pathsFor(file)).code).toBe(0)
    expect(readOps(file).map((o) => o.opId)).toEqual(idsAfterFirst)
    expect(planUndo(file, 4).op.conversationId).toBe('c-4')
  })
})

/** 捕获 console.log(用于跑 main 的只读子命令并解析它印出的号) */
function captureLog<T>(run: () => T): { result: T; out: string } {
  const logs: string[] = []
  const spy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    logs.push(args.map((a) => String(a)).join(' '))
  })
  try {
    return { result: run(), out: logs.join('\n') }
  } finally {
    spy.mockRestore()
  }
}

/** 由 ops 日志路径推出该日志所在隔离根下的其余落点(只读子命令不碰这些路径) */
function rootOf(file: string): string {
  return dirname(dirname(file))
}

function movePathsFor(file: string): MovePaths {
  const root = rootOf(file)
  return {
    sessionsRoot: join(root, 'workspace', 'sessions'),
    projectsRoot: join(root, 'projects'),
    bucketsRoot: join(root, 'buckets'),
    backupsSessionsDir: join(root, 'backups', 'sessions'),
    opsLogFile: file,
    ledgerFile: join(root, 'relay', 'session_links.json'),
  }
}

function qoderPathsFor(file: string): QoderPaths {
  const root = rootOf(file)
  return {
    projectsRoot: join(root, 'qoder-projects'),
    bucketsRoot: join(root, 'buckets-qoder'),
    backupsQoderDir: join(root, 'backups', 'qoder-sessions'),
    opsLogFile: file,
    ledgerFile: join(root, 'relay', 'qoder_session_links.json'),
  }
}

/**
 * 清单号与寻址键同源锁(2026-10-28):操作者是从 `ops` 清单上抄 #号回头喂给 `undo --op`,
 * 所以"印出的号"与"undo 认的号"结构上必须是同一把尺。任一侧重落位置 ⇒ 本组翻红。
 */
describe('ops 清单印的号 ⇔ undo --op 认的号:同源', () => {
  it('WorkBuddy 搬移腿:清单逐条印 opId,且每个印出的号都能被 planUndo 解回同一条', () => {
    const file = opsFile('listing')
    seedOps(file, [
      { opId: 5, conv: 'c-5' },
      { opId: 8, conv: 'c-8' },
      { opId: 9, conv: 'c-9' },
    ])
    const { result, out } = captureLog(() => moveMain(['ops'], movePathsFor(file), []))
    expect(result).toBe(0)
    const printed = [...out.matchAll(/#(\d+)/g)].map((m) => Number(m[1]))
    expect(printed).toEqual([5, 8, 9])
    for (const no of printed) {
      expect(planUndo(file, no).op.conversationId).toBe(`c-${no}`)
    }
  })

  it('Qoder 腿:同一份非连续号,清单印的也是 opId(位置法在此印 1/2/3)', () => {
    const file = opsFile('qoder-listing')
    seedOps(file, [
      { opId: 5, conv: 'q-5' },
      { opId: 8, conv: 'q-8' },
      { opId: 9, conv: 'q-9' },
    ])
    const { result, out } = captureLog(() => qoderMain(['ops'], qoderPathsFor(file), []))
    expect(result).toBe(0)
    const printed = [...out.matchAll(/#(\d+)/g)].map((m) => Number(m[1]))
    expect(printed).toEqual([5, 8, 9])
    for (const no of printed) {
      expect(planQoderUndo(file, no, qoderPathsFor(file)).op.conversationId).toBe(`q-${no}`)
    }
  })
})

describe('Qoder 腿 undo 寻址:与搬移腿同尺(按 opId,不按下标)', () => {
  it('非连续 opId 定位到写定的那一条', () => {
    const file = opsFile('qoder-locate')
    seedOps(file, [
      { opId: 5, conv: 'q-5' },
      { opId: 8, conv: 'q-8' },
      { opId: 9, conv: 'q-9' },
    ])
    expect(planQoderUndo(file, 8, qoderPathsFor(file)).op.conversationId).toBe('q-8')
    // 反向对照:位置法会把 #2 解成日志第 2 行(即 opId 8 那条),这里必须报"无此号"
    expect(() => planQoderUndo(file, 2, qoderPathsFor(file))).toThrow(/无 opId #2/)
  })

  it('undo 记录回退的 reverse 计划指向搬移前的源侧(号解对了,去向才对)', () => {
    const file = opsFile('qoder-reverse')
    seedOps(file, [{ opId: 7, conv: 'q-7' }])
    const { plan } = planQoderUndo(file, 7, qoderPathsFor(file))
    expect(plan.files).toEqual([
      { from: '/bucket/q-7', to: '/src/q-7', bytes: 3, sha256: 'sha', backupRel: '' },
    ])
  })
})

describe('stats 悬空引用:按全序 opId 集判,不拿主日志条数当上界', () => {
  function opsPathsFor(file: string): OpsPaths {
    return {
      opsLogFile: file,
      backupsSessionsDir: join(rootOf(file), 'backups', 'sessions'),
    }
  }

  it('引用落在归档件里的条目不算悬空(条数当上界会把它念成悬空)', () => {
    const file = opsFile('dangling-archived')
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(
      join(dirname(file), 'move_ops.archive-2026-10-01.jsonl'),
      [1, 2]
        .map((n) =>
          JSON.stringify({
            ts: oldTs(60),
            type: 'move',
            conversationId: `c-${n}`,
            accountId: 'acct-a',
            opId: n,
            entries: [entry(`c-${n}`)],
          }),
        )
        .join('\n') + '\n',
    )
    // 主日志只剩 1 条(undo #3 引用归档里的 #2)⇒ 旧尺 total=1 < 2 会误报悬空
    writeFileSync(
      file,
      `${JSON.stringify({
        ts: oldTs(1),
        type: 'undo',
        conversationId: null,
        accountId: null,
        opId: 3,
        refOp: 2,
        entries: [entry('c-2')],
      })}\n`,
    )
    const stats = collectStats(opsPathsFor(file))
    expect(stats.total).toBe(1)
    expect(stats.undoRefOpNums).toEqual([2])
    expect(stats.danglingRefOpNums).toEqual([])
  })

  it('号在全序里真不存在才点名', () => {
    const file = opsFile('dangling-missing')
    seedOps(file, [{ opId: 3, conv: null, type: 'undo' }])
    const rows = readFileSync(file, 'utf8')
      .split('\n')
      .filter((l) => l.trim() !== '')
      .map((l) => JSON.parse(l) as MoveOp)
    rows[0]!.refOp = 7
    writeFileSync(file, `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`)
    const stats = collectStats(opsPathsFor(file))
    expect(stats.undoRefOpNums).toEqual([7])
    expect(stats.danglingRefOpNums).toEqual([7])
  })
})

/**
 * 坏行不得把寻址腿打成崩溃(2026-10-28 实测到的真雷):`readOps` 认裸 `null` 为解析成功,
 * 补号循环与 `ops.find(o => o.opId === n)` 一旦碰上它就抛 TypeError —— 而这三条腿
 * (ops 清单 / undo 寻址 / stats)都是要搬用户文件的工具,崩溃比报数更糟。
 */
describe('JSON 非对象行:不占号位、不崩三条腿', () => {
  function mixedFile(name: string): string {
    const file = opsFile(name)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(
      file,
      [
        JSON.stringify({
          ts: oldTs(2),
          type: 'move',
          conversationId: 'c-1',
          accountId: 'acct-a',
          opId: 1,
          entries: [entry('c-1')],
        }),
        'null',
        '{broken-json',
        JSON.stringify({
          ts: oldTs(1),
          type: 'move',
          conversationId: 'c-2',
          accountId: 'acct-a',
          opId: 2,
          entries: [entry('c-2')],
        }),
      ].join('\n') + '\n',
    )
    return file
  }

  it('全序视图只含真条目,第二个真条目仍是 #2(坏行不占号)', () => {
    const file = mixedFile('mixed-all')
    const all = readOpsAll(file)
    expect(all.ops.map((o) => o.conversationId)).toEqual(['c-1', 'c-2'])
    expect(all.archivedCount).toBe(0)
    expect(maxOpIdOf(file)).toBe(2)
  })

  it('undo 寻址 / ops 清单 / stats 三处都不抛', () => {
    const file = mixedFile('mixed-legs')
    expect(planUndo(file, 2).op.conversationId).toBe('c-2')
    const { result, out } = captureLog(() => moveMain(['ops'], movePathsFor(file), []))
    expect(result).toBe(0)
    expect(out).toContain('#2')
    expect(() =>
      collectStats({
        opsLogFile: file,
        backupsSessionsDir: join(rootOf(file), 'backups', 'sessions'),
      }),
    ).not.toThrow()
  })

  it('rotate 面照旧按「读取面不一致 ⇒ 未判定」拒动(坏行还在时不猜号)', () => {
    const file = mixedFile('mixed-rotate')
    expect(() => planRotate(file, { keepDays: 365, now: NOW })).toThrow(/未判定/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
