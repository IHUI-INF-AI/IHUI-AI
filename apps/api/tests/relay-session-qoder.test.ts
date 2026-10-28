// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// Qoder 会话搬家腿测试(与 relay-session-qoder.ts 同族镜像)。
// fixture 全注入临时目录(mkdtempSync),afterAll 自清,绝不碰真实 ~/.qoder-cn 写面。
// 断言覆盖:
// - 盘点计数(工作区/转写/会话目录/三面一致);
// - backup 默认 dry-run 零写;--apply 后 manifest 逐文件 sha256 守恒;
// - links rebuild 方案 A 分桶(创建时刻>since 归账号)+ 存量显式 null;
// - move→undo 闭环(桶内镜像落点、ops 记账、回退后 sha 逐字节还原);
// - copy 源保留、copy 不支持 undo;
// - 零内容回显埋雷(正文/token 不出现在任何输出面);
// - 源只读(inventory/backup dry-run 与 --apply 前后,活库全部文件 sha 不变);
// - 拒绝场景(未归属/台账缺失/快照缺失)不写任何路径。
import { describe, it, expect, afterAll, vi } from 'vitest'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, sep } from 'node:path'

import {
  computeQoderBackupPlan,
  computeQoderInventory,
  findQoderConversationFiles,
  findTodayQoderSnapshot,
  main,
  planQoderCopy,
  type QoderBackupManifest,
  type QoderPaths,
} from '../scripts/relay-session-qoder.js'
import { readOpsAll } from '../scripts/relay-session-move.js'
import {
  applyLedger,
  emptyLedger,
  planAssign,
  type SessionLinksLedger,
} from '../scripts/relay-session-links.js'

const CONV = 'a1111111-2222-4333-8444-555566667777'
const CONV2 = 'b1111111-2222-4333-8444-555566667777'
const ACCT = 'qacct-a'
const SECRET_BODY = 'TOPSECRET-QODER-CONVERSATION-BODY-9f21'
const SECRET_TOKEN = 'QODER-TOKEN-BLOB-44ac-not-printed'

const sha256Of = (buf: Buffer | string): string => createHash('sha256').update(buf).digest('hex')

const cleanup: string[] = []
// 测试显式声明「客户端未运行」:本机可能就跑在 Qoder 里,不注入会被存续闸按真实环境打成假红
const NO_CLIENT: string[] = []

afterAll(() => {
  for (const p of cleanup) rmSync(p, { recursive: true, force: true })
})

function makeFixture(): { paths: QoderPaths; root: string } {
  const root = mkdtempSync(join(tmpdir(), 'qoder-move-test-'))
  const paths: QoderPaths = {
    projectsRoot: join(root, 'qoder-cn', 'projects'),
    bucketsRoot: join(root, 'wb-switch', 'buckets-qoder'),
    backupsQoderDir: join(root, 'wb-switch', 'backups', 'qoder-sessions'),
    opsLogFile: join(root, 'wb-switch', 'relay', 'qoder_move_ops.jsonl'),
    ledgerFile: join(root, 'wb-switch', 'relay', 'qoder_session_links.json'),
  }
  cleanup.push(root)
  return { paths, root }
}

/** 造一份 Qoder 形会话:<ws>/<conv>.jsonl + 同名目录(转写与目录同父) */
function seedQoderConversation(paths: QoderPaths, conv: string, ws: string): void {
  const wsDir = join(paths.projectsRoot, ws)
  mkdirSync(join(wsDir, conv, 'compression-v2'), { recursive: true })
  mkdirSync(join(wsDir, conv, 'subagents'), { recursive: true })
  writeFileSync(
    join(wsDir, `${conv}.jsonl`),
    `{"type":"session","sessionId":"${conv}","directories":["x"]}\n${SECRET_BODY}\n`,
  )
  writeFileSync(join(wsDir, conv, 'state.json'), `{"note":"${SECRET_TOKEN}"}`)
  writeFileSync(join(wsDir, conv, 'compression-v2', 'state.json'), '{"v":1}')
  writeFileSync(join(wsDir, conv, 'subagents', 'agent-x.jsonl'), `sub ${SECRET_BODY}\n`)
}

/** 当日快照 fixture(createdAt=当前真实时刻,main 的真实时钟能命中"当日") */
function seedQoderSnapshot(paths: QoderPaths): string {
  const dir = join(paths.backupsQoderDir, '20261028T100000Z')
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'manifest.json'),
    JSON.stringify({
      createdAt: new Date().toISOString(),
      source: { tool: 'qoder-cn', projectsRoot: paths.projectsRoot },
      files: [],
    }),
  )
  return dir
}

function seedQoderLedger(paths: QoderPaths, accountId: string | null): void {
  let ledger = {
    ...emptyLedger(),
    accounts: [{ accountId: ACCT, label: 'A', since: '2026-10-01T00:00:00.000Z' }],
  }
  if (accountId !== null) {
    ledger = planAssign(ledger, CONV, accountId).next
  } else {
    ledger = {
      ...ledger,
      links: {
        [CONV]: { accountId: null, linkedAt: new Date().toISOString(), linkedBy: 'auto-since' },
      },
    }
  }
  applyLedger(paths.ledgerFile, ledger)
}

/** 活库全量 rel→sha(源只读前后对照) */
function hashLiveTree(paths: QoderPaths): Map<string, string> {
  const m = new Map<string, string>()
  const walk = (dir: string): void => {
    if (!existsSync(dir)) return
    for (const n of readdirSync(dir)) {
      const p = join(dir, n)
      if (statSync(p).isDirectory()) walk(p)
      else m.set(relative(paths.projectsRoot, p).split(sep).join('/'), sha256Of(readFileSync(p)))
    }
  }
  walk(paths.projectsRoot)
  return m
}

/** 捕获 console.log/error(零内容回显判据用) */
function captureOutput(fn: () => number): { rc: number; out: string } {
  const lines: string[] = []
  const logSpy = vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => {
    lines.push(a.map(String).join(' '))
  })
  const errSpy = vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => {
    lines.push(a.map(String).join(' '))
  })
  try {
    return { rc: fn(), out: lines.join('\n') }
  } finally {
    logSpy.mockRestore()
    errSpy.mockRestore()
  }
}

describe('findQoderConversationFiles + 盘点计数', () => {
  it('转写与会话目录同父结构全部命中;inventory 计数与三面判定正确', () => {
    const { paths } = makeFixture()
    seedQoderConversation(paths, CONV, 'ws-a')
    seedQoderConversation(paths, CONV2, 'ws-b')
    mkdirSync(join(paths.projectsRoot, 'ws-a', 'memory'), { recursive: true })
    writeFileSync(join(paths.projectsRoot, 'ws-a', 'memory', 'MEMORY.md'), '# note')

    const cf = findQoderConversationFiles(CONV, paths.projectsRoot)
    expect(cf.transcripts).toEqual([join(paths.projectsRoot, 'ws-a', `${CONV}.jsonl`)])
    expect(cf.sessionDirs).toEqual([join(paths.projectsRoot, 'ws-a', CONV)])
    expect(cf.sessionDirFiles).toHaveLength(3)
    expect(cf.sessionSubDirs.length).toBe(2)

    const inv = computeQoderInventory(paths)
    expect(inv.workspaces).toBe(2)
    expect(inv.transcripts).toBe(2)
    expect(inv.sessionDirs).toBe(2)
    expect(inv.unpairedDirs).toBe(1) // memory/ 无同名转写,不算会话
    expect(inv.diskConversations).toBe(2)
    expect(inv.ledgerPresent).toBe(false)
    expect(inv.consistent).toBe(false) // 台账缺失 ⇒ 不一致,不冒绿

    seedQoderLedger(paths, ACCT)
    const inv2 = computeQoderInventory(paths)
    expect(inv2.ledgerPresent).toBe(true)
    expect(inv2.ledgerRecords).toBe(1)
    expect(inv2.diskWithoutLedger).toBe(1) // CONV2 未进台账
    expect(inv2.consistent).toBe(false)
  })

  it('findTodayQoderSnapshot:当日+tool+source 根匹配才算在位', () => {
    const { paths } = makeFixture()
    expect(findTodayQoderSnapshot(paths.backupsQoderDir, paths.projectsRoot, new Date())).toBeNull()
    seedQoderSnapshot(paths)
    expect(
      findTodayQoderSnapshot(paths.backupsQoderDir, paths.projectsRoot, new Date()),
    ).not.toBeNull()
    // 隔日必不算
    expect(
      findTodayQoderSnapshot(
        paths.backupsQoderDir,
        paths.projectsRoot,
        new Date(Date.now() + 48 * 3_600_000),
      ),
    ).toBeNull()
    // 根不符不算
    expect(
      findTodayQoderSnapshot(paths.backupsQoderDir, join(paths.projectsRoot, 'other'), new Date()),
    ).toBeNull()
  })
})

describe('backup:预览先行 + 校验后收工 + 源只读', () => {
  it('dry-run 零写;--apply manifest 逐文件 sha256 守恒;两轮活库 sha 不变', () => {
    const { paths } = makeFixture()
    seedQoderConversation(paths, CONV, 'ws-a')
    const before = hashLiveTree(paths)
    expect(before.size).toBe(4)

    const dry = captureOutput(() => main(['backup'], paths, NO_CLIENT))
    expect(dry.rc).toBe(0)
    expect(existsSync(paths.backupsQoderDir)).toBe(false) // 未建目的地(目的地在其下)
    expect(hashLiveTree(paths)).toEqual(before)

    const run = captureOutput(() => main(['backup', '--apply'], paths, NO_CLIENT))
    expect(run.rc).toBe(0)
    const dirs = readdirSync(paths.backupsQoderDir).filter((n) =>
      statSync(join(paths.backupsQoderDir, n)).isDirectory(),
    )
    expect(dirs).toHaveLength(1)
    const snapDir = join(paths.backupsQoderDir, dirs[0]!)
    const manifest = JSON.parse(
      readFileSync(join(snapDir, 'manifest.json'), 'utf8'),
    ) as QoderBackupManifest
    expect(manifest.source).toEqual({ tool: 'qoder-cn', projectsRoot: paths.projectsRoot })
    expect(manifest.files).toHaveLength(4)
    let manifestBytes = 0
    for (const f of manifest.files) {
      const placed = join(snapDir, ...f.rel.split('/'))
      expect(existsSync(placed), f.rel).toBe(true)
      expect(sha256Of(readFileSync(placed))).toBe(f.sha256)
      expect(readFileSync(placed)).toEqual(
        readFileSync(join(paths.projectsRoot, ...f.rel.split('/'))),
      )
      manifestBytes += f.bytes
    }
    expect(manifestBytes).toBe(
      computeQoderBackupPlan(paths.projectsRoot, paths.backupsQoderDir, new Date()).totalBytes,
    )
    // 临时名不留残迹
    expect(
      readdirSync(snapDir, { recursive: true, encoding: 'utf8' }).some((n) =>
        String(n).includes('.copying-'),
      ),
    ).toBe(false)
    // 源只读:活库逐字节不变
    expect(hashLiveTree(paths)).toEqual(before)
    // 锁已释放
    expect(existsSync(join(dirname(paths.opsLogFile), 'session-store.lock'))).toBe(false)
  })
})

describe('links rebuild:方案 A 分桶 + 存量显式 null', () => {
  it('创建时刻>since 归账号;时刻证据≤since 标 null;dry-run 不写台账', () => {
    const { paths } = makeFixture()
    seedQoderConversation(paths, CONV, 'ws-a') // 新建 ⇒ birthtime≈now > since
    seedQoderConversation(paths, CONV2, 'ws-b')
    // CONV2 的时刻证据:转写首行 timestamp=2020(scanConversationIds 取证据最小值 ⇒ 判存量)
    writeFileSync(
      join(paths.projectsRoot, 'ws-b', `${CONV2}.jsonl`),
      `{"type":"session","sessionId":"${CONV2}","timestamp":"2020-05-05T00:00:00.000Z"}\n${SECRET_BODY}\n`,
    )
    const since = '2026-01-01T00:00:00.000Z'

    const dry = captureOutput(() =>
      main(['links', 'rebuild', '--since', since, '--account', ACCT], paths, NO_CLIENT),
    )
    expect(dry.rc).toBe(0)
    expect(existsSync(paths.ledgerFile)).toBe(false)

    const run = captureOutput(() =>
      main(['links', 'rebuild', '--since', since, '--account', ACCT, '--apply'], paths, NO_CLIENT),
    )
    expect(run.rc).toBe(0)
    expect(run.out).not.toContain(SECRET_BODY)
    expect(run.out).not.toContain(SECRET_TOKEN)
    const ledger = JSON.parse(readFileSync(paths.ledgerFile, 'utf8')) as SessionLinksLedger
    expect(ledger.accounts.some((a) => a.accountId === ACCT)).toBe(true)
    expect(ledger.links[CONV]?.accountId).toBe(ACCT) // 创建>since ⇒ 归账号
    expect(ledger.links[CONV]?.linkedBy).toBe('auto-since')
    expect(ledger.links[CONV2]?.accountId).toBeNull() // 存量显式 null,不猜
  })

  it('缺 --since/--account ⇒ rc 2,不写台账', () => {
    const { paths } = makeFixture()
    const r = captureOutput(() => main(['links', 'rebuild', '--account', ACCT], paths, NO_CLIENT))
    expect(r.rc).toBe(2)
    expect(existsSync(paths.ledgerFile)).toBe(false)
  })
})

describe('move → undo 闭环', () => {
  it('dry-run 零改动;--apply 镜像进桶+ops 记账;undo 回位逐字节还原', () => {
    const { paths } = makeFixture()
    seedQoderConversation(paths, CONV, 'ws-a')
    seedQoderSnapshot(paths)
    seedQoderLedger(paths, ACCT)
    const before = hashLiveTree(paths)

    const dry = captureOutput(() => main(['move', '--conversation', CONV], paths, NO_CLIENT))
    expect(dry.rc).toBe(0)
    expect(dry.out).not.toContain(SECRET_BODY)
    expect(dry.out).not.toContain(SECRET_TOKEN)
    expect(hashLiveTree(paths)).toEqual(before)
    expect(existsSync(paths.bucketsRoot)).toBe(false)

    const run = captureOutput(() =>
      main(['move', '--conversation', CONV, '--apply'], paths, NO_CLIENT),
    )
    expect(run.rc).toBe(0)
    // 源侧消失
    expect(existsSync(join(paths.projectsRoot, 'ws-a', `${CONV}.jsonl`))).toBe(false)
    expect(existsSync(join(paths.projectsRoot, 'ws-a', CONV))).toBe(false)
    // 桶内镜像同父结构落点,sha 逐一核对
    const bucketConvDir = join(paths.bucketsRoot, ACCT, 'ws-a', CONV)
    expect(existsSync(join(paths.bucketsRoot, ACCT, 'ws-a', `${CONV}.jsonl`))).toBe(true)
    expect(existsSync(join(bucketConvDir, 'state.json'))).toBe(true)
    expect(existsSync(join(bucketConvDir, 'subagents', 'agent-x.jsonl'))).toBe(true)
    expect(sha256Of(readFileSync(join(bucketConvDir, 'state.json')))).toBe(
      sha256Of(`{"note":"${SECRET_TOKEN}"}`),
    )
    // ops 记账:1 条 move,4 个文件,零内容
    const { ops } = readOpsAll(paths.opsLogFile)
    expect(ops).toHaveLength(1)
    expect(ops[0]!.type).toBe('move')
    expect(ops[0]!.conversationId).toBe(CONV)
    expect(ops[0]!.accountId).toBe(ACCT)
    expect(ops[0]!.entries).toHaveLength(4)

    const undo = captureOutput(() => main(['undo', '--op', '1', '--apply'], paths, NO_CLIENT))
    expect(undo.rc).toBe(0)
    const after = hashLiveTree(paths)
    expect([...after.entries()].sort()).toEqual([...before.entries()].sort())
    expect(existsSync(bucketConvDir)).toBe(false)
    const ops2 = readOpsAll(paths.opsLogFile).ops
    expect(ops2).toHaveLength(2)
    expect(ops2[1]!.type).toBe('undo')
    expect(ops2[1]!.refOp).toBe(1)
  })

  it('拒绝场景不写任何路径:快照缺失/台账缺失/未归属/会话不存在', () => {
    const { paths } = makeFixture()
    seedQoderConversation(paths, CONV, 'ws-a')
    const before = hashLiveTree(paths)

    // 快照缺失
    let r = captureOutput(() => main(['move', '--conversation', CONV, '--apply'], paths, NO_CLIENT))
    expect(r.rc).toBe(1)
    expect(r.out).toContain('当日 Qoder 会话库快照缺失')

    seedQoderSnapshot(paths)
    // 台账缺失
    r = captureOutput(() => main(['move', '--conversation', CONV, '--apply'], paths, NO_CLIENT))
    expect(r.rc).toBe(1)
    expect(r.out).toContain('台账不存在')

    // 未归属
    seedQoderLedger(paths, null)
    r = captureOutput(() => main(['move', '--conversation', CONV, '--apply'], paths, NO_CLIENT))
    expect(r.rc).toBe(1)
    expect(r.out).toContain('未归属')

    // 会话不存在
    seedQoderLedger(paths, ACCT)
    r = captureOutput(() =>
      main(['move', '--conversation', 'no-such-conv-0000', '--apply'], paths, NO_CLIENT),
    )
    expect(r.rc).toBe(1)
    expect(r.out).toContain('会话不存在')

    expect(hashLiveTree(paths)).toEqual(before)
    expect(existsSync(paths.bucketsRoot)).toBe(false)
    expect(existsSync(paths.opsLogFile)).toBe(false)
  })
})

describe('copy:源保留 + 不支持 undo', () => {
  it('copy --apply 后源侧仍在、桶内有副本;undo 该条目被拒绝且不动库', () => {
    const { paths } = makeFixture()
    seedQoderConversation(paths, CONV, 'ws-a')
    seedQoderSnapshot(paths)
    seedQoderLedger(paths, ACCT)
    const before = hashLiveTree(paths)

    const plan = planQoderCopy(CONV, paths, new Date())
    expect(plan.mode).toBe('copy')
    expect(JSON.stringify(plan)).not.toContain(SECRET_BODY)

    const run = captureOutput(() =>
      main(['copy', '--conversation', CONV, '--to', ACCT, '--apply'], paths, NO_CLIENT),
    )
    expect(run.rc).toBe(0)
    expect(hashLiveTree(paths)).toEqual(before) // 源保留
    expect(existsSync(join(paths.bucketsRoot, ACCT, 'ws-a', `${CONV}.jsonl`))).toBe(true)
    const { ops } = readOpsAll(paths.opsLogFile)
    expect(ops).toHaveLength(1)
    expect(ops[0]!.type).toBe('copy')

    const deny = captureOutput(() => main(['undo', '--op', '1', '--apply'], paths, NO_CLIENT))
    expect(deny.rc).toBe(1)
    expect(deny.out).toContain('绝不删除')
    expect(hashLiveTree(paths)).toEqual(before)
    expect(existsSync(join(paths.bucketsRoot, ACCT, 'ws-a', `${CONV}.jsonl`))).toBe(true)
  })
})

describe('restore:桶 → 活库', () => {
  it('move 后 restore 回位;多来源冲突宁可拒做', () => {
    const { paths } = makeFixture()
    seedQoderConversation(paths, CONV, 'ws-a')
    seedQoderSnapshot(paths)
    seedQoderLedger(paths, ACCT)
    const before = hashLiveTree(paths)
    expect(main(['move', '--conversation', CONV, '--apply'], paths, NO_CLIENT)).toBe(0)
    const r = captureOutput(() =>
      main(['restore', '--conversation', CONV, '--apply'], paths, NO_CLIENT),
    )
    expect(r.rc).toBe(0)
    expect(r.out).not.toContain(SECRET_BODY)
    expect([...hashLiveTree(paths).entries()].sort()).toEqual([...before.entries()].sort())
    expect(existsSync(join(paths.bucketsRoot, ACCT, 'ws-a', `${CONV}.jsonl`))).toBe(false)
  })
})

describe('ops 与 help:零内容回显埋雷', () => {
  it('inventory/backup dry/move dry/ops/help 所有输出面都不出现正文与 token', () => {
    const { paths } = makeFixture()
    seedQoderConversation(paths, CONV, 'ws-a')
    seedQoderSnapshot(paths)
    seedQoderLedger(paths, ACCT)
    const outs: string[] = []
    outs.push(captureOutput(() => main(['inventory'], paths, NO_CLIENT)).out)
    outs.push(captureOutput(() => main(['backup'], paths, NO_CLIENT)).out)
    outs.push(captureOutput(() => main(['move', '--conversation', CONV], paths, NO_CLIENT)).out)
    outs.push(captureOutput(() => main(['links', 'list'], paths, NO_CLIENT)).out)
    outs.push(captureOutput(() => main([], paths, NO_CLIENT)).out) // help
    expect(main(['move', '--conversation', CONV, '--apply'], paths, NO_CLIENT)).toBe(0)
    outs.push(captureOutput(() => main(['ops'], paths, NO_CLIENT)).out)
    const all = outs.join('\n')
    expect(all).not.toContain(SECRET_BODY)
    expect(all).not.toContain(SECRET_TOKEN)
    // ops 原文(落盘 JSON)也零内容:只有路径/字节/sha
    expect(readFileSync(paths.opsLogFile, 'utf8')).not.toContain(SECRET_BODY)
    expect(readFileSync(paths.opsLogFile, 'utf8')).not.toContain(SECRET_TOKEN)
    // 但路径/计数面确实在(防空输出假绿)
    expect(all).toContain('工作区')
    expect(all).toContain(CONV)
    expect(all).toContain(`${CONV}.jsonl`)
  })
})

describe('存续闸:Qoder 客户端在跑时的写面(与 WorkBuddy 腿同语义)', () => {
  const RUNNING = ['"Qoder CN.exe","4242"']

  function seeded(): QoderPaths {
    const { paths } = makeFixture()
    seedQoderConversation(paths, CONV, 'ws-a')
    seedQoderSnapshot(paths)
    seedQoderLedger(paths, ACCT)
    return paths
  }

  it('无理由或理由不足 10 字 ⇒ exit 2 且零记账;dry-run 不受闸影响', () => {
    const paths = seeded()
    const spyErr = vi.spyOn(console, 'error').mockImplementation(() => {})
    const spyOut = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      expect(main(['move', '--conversation', CONV, '--apply'], paths, RUNNING)).toBe(2)
      expect(
        main(
          ['move', '--conversation', CONV, '--apply', '--force-running-reason', '太短'],
          paths,
          RUNNING,
        ),
      ).toBe(2)
      // 只读面与 dry-run 放行
      expect(main(['move', '--conversation', CONV], paths, RUNNING)).toBe(0)
      expect(main(['inventory'], paths, RUNNING)).toBe(0)
    } finally {
      spyErr.mockRestore()
      spyOut.mockRestore()
    }
    expect(existsSync(paths.opsLogFile)).toBe(false)
  })

  it('≥10 字定向理由 ⇒ 放行并落一条 ops(仅本次调用生效)', () => {
    const paths = seeded()
    const spyErr = vi.spyOn(console, 'error').mockImplementation(() => {})
    const spyOut = vi.spyOn(console, 'log').mockImplementation(() => {})
    let code = -1
    try {
      code = main(
        [
          'move',
          '--conversation',
          CONV,
          '--apply',
          '--force-running-reason',
          '已确认该会话当前未被客户端写入',
        ],
        paths,
        RUNNING,
      )
    } finally {
      spyErr.mockRestore()
      spyOut.mockRestore()
    }
    expect(code).toBe(0)
    const all = readOpsAll(paths.opsLogFile)
    expect(all.ops.length).toBe(1)
    expect(all.ops[0]?.type).toBe('move')
    // 放行留痕带原话(reason 文案进 stderr,可追责)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
