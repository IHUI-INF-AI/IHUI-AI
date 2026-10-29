// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话台账 --auto(账号时间线自动推导)测试。fixture 注入临时目录,断言:
 * - 快照序列 → 段边界(第 i 份快照的账号活跃于 [上一份快照时刻, 本份快照时刻));
 * - 各段会话归属正确;段外/无时刻证据/账号不可判段 ⇒ 显式 null(绝不猜);
 * - 坏快照占段标未归属,绝不借邻居账号;相邻同账号段合并;
 * - CLI:--auto 与 --since 互斥、空快照库/登录态不可判拒绝(退出码 2),dry-run 不写;
 * - 输出零泄漏(快照里的 token 埋雷与转写正文均不出现)。
 */
import { describe, it, expect, afterAll, vi } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import {
  deriveAccountTimeline,
  emptyLedger,
  formatTimeline,
  loadLedger,
  main,
  parseSnapshotStamp,
  planRebuildFromTimeline,
  readAccountMeta,
  scanSnapshotAccounts,
  segmentForTime,
  type SessionLinksPaths,
  type SnapshotAccountEntry,
} from '../scripts/relay-session-links.js'

const SECRET_TOKEN = 'SEKRET-ACCESS-TOKEN-auto-9f3c'
const SECRET_BODY = 'TOPSECRET-CONVERSATION-BODY-auto-77e1'

const cleanup: string[] = []
afterAll(() => {
  for (const root of cleanup) rmSync(root, { recursive: true, force: true })
})

interface Fixture {
  root: string
  paths: SessionLinksPaths
  backupsDir: string
  authFile: string
}

function makeFixture(): Fixture {
  const root = mkdtempSync(join(tmpdir(), 'wb-links-auto-'))
  cleanup.push(root)
  const backupsDir = join(root, 'backups')
  mkdirSync(backupsDir, { recursive: true })
  return {
    root,
    backupsDir,
    authFile: join(root, 'auth', 'current.info'),
    paths: {
      ledgerFile: join(root, 'relay', 'session_links.json'),
      sessionsRoot: join(root, 'sessions'),
      projectsRoot: join(root, 'projects'),
    },
  }
}

/** auth/快照文件同形:{ account: {...}, auth: { accessToken } };token 埋雷验零泄漏 */
function writeAuthInfo(path: string, account: Record<string, unknown>): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(
    path,
    JSON.stringify({
      version: 1,
      account,
      auth: { accessToken: SECRET_TOKEN, expiresAt: 1900000000000 },
    }),
  )
}

function writeSnapshot(fx: Fixture, stamp: string, account: Record<string, unknown>): void {
  writeAuthInfo(join(fx.backupsDir, `workbuddy-desktop.${stamp}.info`), account)
}

function writeTranscript(fx: Fixture, conv: string, firstTs: string): void {
  const ws = join(fx.paths.projectsRoot, 'ws-a')
  mkdirSync(ws, { recursive: true })
  writeFileSync(
    join(ws, `${conv}.jsonl`),
    `{"type":"meta","sessionId":"${conv}","timestamp":"${firstTs}"}\n${SECRET_BODY}\n`,
  )
}

const ACCT_A = { uid: 'uid-aaaa-1111', nickname: '主号' }
const ACCT_B = { uid: 'uid-bbbb-2222', nickname: '小号' }
const ACCT_C = { uid: 'uid-cccc-3333', nickname: '当前号' }

describe('parseSnapshotStamp:快照文件名 → 时刻', () => {
  it('规范命名解析为 ISO;非规范一律 null(由扫描层回落 mtime 并告警)', () => {
    expect(parseSnapshotStamp('workbuddy-desktop.2026-10-26T11-48-04Z.info')).toBe(
      '2026-10-26T11:48:04Z',
    )
    expect(parseSnapshotStamp('workbuddy-desktop.bad.info')).toBeNull()
    expect(parseSnapshotStamp('other.2026-10-26T11-48-04Z.info')).toBeNull()
  })
})

describe('readAccountMeta:只取 uid 与脱敏标签', () => {
  it('昵称字符串原样作标签;昵称为对象时回退打码手机号;全缺回退 uid 前 8 位', () => {
    const fx = makeFixture()
    const p1 = join(fx.root, 'a.info')
    writeAuthInfo(p1, { uid: 'uid-1111-2222', nickname: '主号' })
    expect(readAccountMeta(p1)).toEqual({ accountId: 'uid-1111-2222', label: '主号' })

    const p2 = join(fx.root, 'b.info')
    writeAuthInfo(p2, { uid: 'uid-3333-4444', nickname: { x: 1 }, phoneNumber: '13800138000' })
    expect(readAccountMeta(p2)).toEqual({ accountId: 'uid-3333-4444', label: '138****8000' })

    const p3 = join(fx.root, 'c.info')
    writeAuthInfo(p3, { uid: 'uid-5555-6666' })
    expect(readAccountMeta(p3)).toEqual({ accountId: 'uid-5555-6666', label: 'uid-5555' })

    const p4 = join(fx.root, 'broken.info')
    writeFileSync(p4, '{oops')
    expect(readAccountMeta(p4)).toEqual({ accountId: null, label: '' })
  })
})

describe('scanSnapshotAccounts:坏快照占位不静默跳过', () => {
  it('按时刻升序;坏文件保留条目(accountId=null)并告警;非快照文件忽略', () => {
    const fx = makeFixture()
    writeSnapshot(fx, '2026-10-22T10-00-00Z', ACCT_B)
    writeSnapshot(fx, '2026-10-20T10-00-00Z', ACCT_A)
    writeFileSync(join(fx.backupsDir, 'workbuddy-desktop.broken.info'), '{oops')
    writeFileSync(join(fx.backupsDir, 'notes.txt'), 'ignored')

    const { entries, warnings } = scanSnapshotAccounts(fx.backupsDir)
    expect(entries.map((e) => e.accountId)).toEqual(['uid-aaaa-1111', 'uid-bbbb-2222', null])
    expect(entries.map((e) => e.ts)).toEqual([
      '2026-10-20T10:00:00Z',
      '2026-10-22T10:00:00Z',
      expect.any(String), // broken:回落 mtime
    ])
    expect(warnings.some((w) => w.includes('账号不可判'))).toBe(true)
  })

  it('快照库不存在 ⇒ 抛错(给出先产生快照的出路)', () => {
    expect(() => scanSnapshotAccounts(join(tmpdir(), 'wb-links-auto-absent-dir'))).toThrow(
      /快照库不存在/,
    )
  })
})

describe('deriveAccountTimeline / segmentForTime', () => {
  const entry = (ts: string, accountId: string | null, label = ''): SnapshotAccountEntry => ({
    fileName: `workbuddy-desktop.${ts}.info`,
    ts,
    accountId,
    label,
  })

  it('第 i 份快照账号活跃于 [上一份时刻, 本份时刻);当前账号活跃于 [最后时刻, now)', () => {
    const segs = deriveAccountTimeline(
      [entry('2026-10-20T10:00:00Z', 'A', '主号'), entry('2026-10-22T10:00:00Z', 'B', '小号')],
      { accountId: 'C', label: '当前号' },
      { trustEarliest: true },
    )
    expect(segs).toEqual([
      { accountId: 'A', label: '主号', start: null, end: '2026-10-20T10:00:00Z' },
      { accountId: 'B', label: '小号', start: '2026-10-20T10:00:00Z', end: '2026-10-22T10:00:00Z' },
      { accountId: 'C', label: '当前号', start: '2026-10-22T10:00:00Z', end: null },
    ])
  })

  it('默认 strict:最早快照之前无下界证据 ⇒ 首段显式未归属(方案 A 不猜)', () => {
    const strict = deriveAccountTimeline(
      [entry('2026-10-20T10:00:00Z', 'A', '主号'), entry('2026-10-22T10:00:00Z', 'B')],
      { accountId: 'C', label: '' },
    )
    expect(strict.map((s) => s.accountId)).toEqual([null, 'B', 'C'])
    expect(strict[0]).toMatchObject({ start: null, end: '2026-10-20T10:00:00Z' })
  })

  it('相邻同账号段合并为一段;null 段不合并(保留边界如实展示)', () => {
    const merged = deriveAccountTimeline(
      [entry('2026-10-20T10:00:00Z', 'A'), entry('2026-10-22T10:00:00Z', 'A')],
      { accountId: 'A', label: '主号' },
      { trustEarliest: true },
    )
    expect(merged).toEqual([{ accountId: 'A', label: '主号', start: null, end: null }])

    const withGap = deriveAccountTimeline(
      [entry('2026-10-20T10:00:00Z', 'A'), entry('2026-10-22T10:00:00Z', null)],
      { accountId: 'C', label: '当前号' },
      { trustEarliest: true },
    )
    expect(withGap.map((s) => s.accountId)).toEqual(['A', null, 'C'])
  })

  it('边界左闭右开:等于段起点归本段,等于段终点归下一段;段外 null', () => {
    const segs = deriveAccountTimeline(
      [entry('2026-10-20T10:00:00Z', 'A'), entry('2026-10-22T10:00:00Z', 'B')],
      { accountId: 'C', label: '' },
      { trustEarliest: true },
    )
    expect(segmentForTime(segs, '2026-10-19T00:00:00Z')?.accountId).toBe('A')
    expect(segmentForTime(segs, '2026-10-20T10:00:00Z')?.accountId).toBe('B')
    expect(segmentForTime(segs, '2026-10-22T10:00:00Z')?.accountId).toBe('C')
    expect(segmentForTime(segs, 'not-a-time')).toBeNull()
  })

  it('空快照序列 ⇒ 空时间线(由上层拒绝,不静默产出) ', () => {
    expect(deriveAccountTimeline([], { accountId: 'C', label: '' })).toEqual([])
  })
})

describe('planRebuildFromTimeline:段判定归属', () => {
  const segs = deriveAccountTimeline(
    [
      {
        fileName: 'a',
        ts: '2026-10-20T10:00:00Z',
        accountId: 'A',
        label: '主号',
      },
      {
        fileName: 'b',
        ts: '2026-10-22T10:00:00Z',
        accountId: 'B',
        label: '小号',
      },
    ],
    { accountId: 'C', label: '当前号' },
    { trustEarliest: true },
  )

  it('三段各归其主;段外与无时刻证据显式 null;manual 不被覆盖', () => {
    const ledger = emptyLedger()
    ledger.links['conv-manual'] = {
      accountId: 'A',
      linkedAt: '2026-10-01T00:00:00Z',
      linkedBy: 'manual',
    }
    const plan = planRebuildFromTimeline(
      ledger,
      segs,
      ['conv-early', 'conv-mid', 'conv-late', 'conv-unknown', 'conv-manual'],
      {
        'conv-early': '2026-10-19T00:00:00Z',
        'conv-mid': '2026-10-21T00:00:00Z',
        'conv-late': '2026-10-23T00:00:00Z',
        'conv-unknown': null,
        'conv-manual': '2026-10-23T00:00:00Z',
      },
    )
    expect(plan.next.links['conv-early']).toMatchObject({ accountId: 'A', linkedBy: 'auto-since' })
    expect(plan.next.links['conv-mid']).toMatchObject({ accountId: 'B', linkedBy: 'auto-since' })
    expect(plan.next.links['conv-late']).toMatchObject({ accountId: 'C', linkedBy: 'auto-since' })
    expect(plan.next.links['conv-unknown']).toMatchObject({ accountId: null })
    // manual 原样保留(哪怕时刻落在别的段)
    expect(plan.next.links['conv-manual']).toMatchObject({ accountId: 'A', linkedBy: 'manual' })
    expect(plan.next.accounts.map((a) => a.accountId).sort()).toEqual(['A', 'B', 'C'])
    expect(plan.changes.some((c) => c.includes('无证据'))).toBe(true)
  })

  it('账号不可判段整段标未归属,绝不借邻居账号', () => {
    const withGap = deriveAccountTimeline(
      [
        { fileName: 'a', ts: '2026-10-20T10:00:00Z', accountId: 'A', label: '' },
        { fileName: 'b', ts: '2026-10-22T10:00:00Z', accountId: null, label: '' },
      ],
      { accountId: 'C', label: '' },
    )
    const plan = planRebuildFromTimeline(emptyLedger(), withGap, ['conv-gap'], {
      'conv-gap': '2026-10-21T00:00:00Z',
    })
    expect(plan.next.links['conv-gap']).toMatchObject({ accountId: null })
    expect(plan.warnings.some((w) => w.includes('账号不可判段'))).toBe(true)
  })

  it('空时间线拒绝(不产出半残台账)', () => {
    expect(() => planRebuildFromTimeline(emptyLedger(), [], ['c'], { c: null })).toThrow(
      /时间线为空/,
    )
  })
})

describe('main rebuild --auto:写盘纪律与拒绝面', () => {
  function seed(fx: Fixture): void {
    writeSnapshot(fx, '2026-10-20T10-00-00Z', ACCT_A)
    writeSnapshot(fx, '2026-10-22T10-00-00Z', ACCT_B)
    writeAuthInfo(fx.authFile, ACCT_C)
    writeTranscript(fx, 'conv-early', '2026-10-19T00:00:00.000Z')
    writeTranscript(fx, 'conv-mid', '2026-10-21T00:00:00.000Z')
    writeTranscript(fx, 'conv-late', '2026-10-23T00:00:00.000Z')
  }

  const autoArgs = (fx: Fixture): string[] => [
    'rebuild',
    '--auto',
    '--snapshot-dir',
    fx.backupsDir,
    '--auth-file',
    fx.authFile,
  ]

  it('dry-run 不写台账;--apply 写入且三段归属正确;输出零 token/正文泄漏', () => {
    const fx = makeFixture()
    seed(fx)
    const lines: string[] = []
    const spy = vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => {
      lines.push(a.map(String).join(' '))
    })
    try {
      expect(main(autoArgs(fx), fx.paths)).toBe(0)
      expect(existsSync(fx.paths.ledgerFile)).toBe(false)

      expect(main([...autoArgs(fx), '--apply'], fx.paths)).toBe(0)
      const ledger = loadLedger(fx.paths.ledgerFile)!
      // 默认 strict:早于最早快照的存量显式未归属(方案 A 不猜)
      expect(ledger.links['conv-early']?.accountId).toBeNull()
      expect(ledger.links['conv-mid']?.accountId).toBe('uid-bbbb-2222')
      expect(ledger.links['conv-late']?.accountId).toBe('uid-cccc-3333')
      expect(ledger.accounts.map((a) => a.accountId).sort()).toEqual([
        'uid-bbbb-2222',
        'uid-cccc-3333',
      ])
    } finally {
      spy.mockRestore()
    }
    const out = lines.join('\n')
    expect(out).toContain('账号时间线')
    expect(out).toContain('--trust-earliest')
    expect(out).not.toContain(SECRET_TOKEN)
    expect(out).not.toContain(SECRET_BODY)
  })

  it('--trust-earliest:确认最早账号后,首段存量归它(放宽须显式给旗)', () => {
    const fx = makeFixture()
    seed(fx)
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      expect(main([...autoArgs(fx), '--trust-earliest', '--apply'], fx.paths)).toBe(0)
    } finally {
      spy.mockRestore()
    }
    const ledger = loadLedger(fx.paths.ledgerFile)!
    expect(ledger.links['conv-early']?.accountId).toBe('uid-aaaa-1111')
    expect(ledger.accounts.map((a) => a.accountId).sort()).toEqual([
      'uid-aaaa-1111',
      'uid-bbbb-2222',
      'uid-cccc-3333',
    ])
  })

  it('--auto 与 --since/--account 互斥 ⇒ 退出码 2,不写台账', () => {
    const fx = makeFixture()
    seed(fx)
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(main([...autoArgs(fx), '--since', '2026-10-01T00:00:00Z'], fx.paths)).toBe(2)
      expect(main([...autoArgs(fx), '--account', 'x'], fx.paths)).toBe(2)
    } finally {
      spy.mockRestore()
    }
    expect(existsSync(fx.paths.ledgerFile)).toBe(false)
  })

  it('空快照库 / 当前登录态不可判 ⇒ 退出码 2(不产出半残台账)', () => {
    const empty = makeFixture() // 无任何快照
    writeAuthInfo(empty.authFile, ACCT_C)
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(main(autoArgs(empty), empty.paths)).toBe(2)

      const noAuth = makeFixture()
      writeSnapshot(noAuth, '2026-10-20T10-00-00Z', ACCT_A)
      expect(main(autoArgs(noAuth), noAuth.paths)).toBe(2)
    } finally {
      spy.mockRestore()
    }
  })

  it('formatTimeline 段清单只含时刻/账号前 8 位/标签,不含 token', () => {
    const segs = deriveAccountTimeline(
      [
        { fileName: 'a', ts: '2026-10-20T10:00:00Z', accountId: 'uid-aaaa-1111', label: '主号' },
        { fileName: 'b', ts: '2026-10-22T10:00:00Z', accountId: null, label: '' },
      ],
      { accountId: 'uid-cccc-3333', label: '当前号' },
    )
    const text = formatTimeline(segs).join('\n')
    // 默认 strict:首段标"早于最早快照的存量";显式不可判段标"账号不可判"
    expect(text).toContain('(未归属:早于最早快照的存量)')
    expect(text).toContain('(未归属:账号不可判)')
    expect(text).not.toContain('uid-aaaa…')
    expect(text).not.toContain(SECRET_TOKEN)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
