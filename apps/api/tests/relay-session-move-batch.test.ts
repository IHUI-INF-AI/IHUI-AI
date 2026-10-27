// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 按账号批量搬移测试(⑦搬移腿·批量面,2026-10-27 增)。fixture 全注入临时目录,断言:
 * - 只取台账 accountId 精确等于该账号的会话;未归属(null)与他账号一律不碰;
 * - 账号前缀:完整 id / 唯一前缀可用,不唯一或不存在拒绝;
 * - 逐会话独立:已搬走的会话只跳过并点名,不阻断其余;
 * - --conversation 与 --account 互斥;dry-run 零改动;--apply 逐会话各自记账、单条 undo 可回退。
 */
import { describe, it, expect, afterAll, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  main,
  planBatchMove,
  readOps,
  resolveAccountId,
  type MovePaths,
} from '../scripts/relay-session-move.js'
import {
  applyLedger,
  emptyLedger,
  type SessionLinksLedger,
} from '../scripts/relay-session-links.js'

const ACCT = 'acct-aaaa-1111'
const ACCT2 = 'acct-bbbb-2222'
const C1 = 'c1111111-2222-4333-8444-555566667777'
const C2 = 'c2222222-3333-4444-8555-666677778888'
const C3 = 'c3333333-4444-4555-8666-777788889999'
const C4 = 'c4444444-5555-4666-8777-888899990000'

const sha256Of = (buf: Buffer | string): string => createHash('sha256').update(buf).digest('hex')

const cleanup: string[] = []
afterAll(() => {
  for (const p of cleanup) rmSync(p, { recursive: true, force: true })
})

function makeFixture(): { paths: MovePaths; root: string } {
  const root = mkdtempSync(join(tmpdir(), 'wb-move-batch-'))
  cleanup.push(root)
  return {
    root,
    paths: {
      sessionsRoot: join(root, 'sessions'),
      projectsRoot: join(root, 'projects'),
      bucketsRoot: join(root, 'buckets'),
      backupsSessionsDir: join(root, 'backups', 'sessions'),
      opsLogFile: join(root, 'relay', 'move_ops.jsonl'),
      ledgerFile: join(root, 'relay', 'session_links.json'),
    },
  }
}

function seedConversation(paths: MovePaths, conv: string): void {
  mkdirSync(join(paths.sessionsRoot, conv), { recursive: true })
  writeFileSync(join(paths.sessionsRoot, conv, 'state.json'), `{"v":"${conv}"}`)
  const ws = join(paths.projectsRoot, 'ws-a')
  mkdirSync(ws, { recursive: true })
  writeFileSync(join(ws, `${conv}.jsonl`), `{"type":"meta","sessionId":"${conv}"}\n`)
}

function seedSnapshot(paths: MovePaths): void {
  const dir = join(paths.backupsSessionsDir, '20261027T100000Z')
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'manifest.json'),
    JSON.stringify({
      createdAt: new Date().toISOString(),
      source: { sessionsRoot: paths.sessionsRoot, projectsRoot: paths.projectsRoot },
      files: [],
    }),
  )
}

function seedLedger(
  paths: MovePaths,
  links: Record<string, { accountId: string | null; linkedBy: 'manual' | 'auto-since' }>,
): SessionLinksLedger {
  const ledger: SessionLinksLedger = {
    ...emptyLedger(),
    accounts: [
      { accountId: ACCT, label: 'A', since: '2026-10-01T00:00:00.000Z' },
      { accountId: ACCT2, label: 'B', since: '2026-10-02T00:00:00.000Z' },
    ],
    links: Object.fromEntries(
      Object.entries(links).map(([c, l]) => [
        c,
        { accountId: l.accountId, linkedAt: new Date().toISOString(), linkedBy: l.linkedBy },
      ]),
    ),
  }
  applyLedger(paths.ledgerFile, ledger)
  return ledger
}

function seedAll(paths: MovePaths): void {
  for (const c of [C1, C2, C3, C4]) seedConversation(paths, c)
  seedSnapshot(paths)
  seedLedger(paths, {
    [C1]: { accountId: ACCT, linkedBy: 'manual' },
    [C2]: { accountId: ACCT, linkedBy: 'auto-since' },
    [C3]: { accountId: ACCT2, linkedBy: 'auto-since' },
    [C4]: { accountId: null, linkedBy: 'auto-since' },
  })
}

describe('resolveAccountId:完整 id 或唯一前缀', () => {
  it('完整 id 命中;唯一前缀命中;不唯一/不存在拒绝', () => {
    const fx = makeFixture()
    const ledger = seedLedger(fx.paths, {})
    expect(resolveAccountId(ledger, ACCT)).toBe(ACCT)
    expect(resolveAccountId(ledger, 'acct-aaaa')).toBe(ACCT)
    expect(() => resolveAccountId(ledger, 'acct-')).toThrow(/前缀不唯一/)
    expect(() => resolveAccountId(ledger, 'nope')).toThrow(/账号不在台账/)
  })
})

describe('planBatchMove:只取该账号的会话', () => {
  it('未归属(null)与他账号一律不碰;dry-run 计划不动任何文件', () => {
    const fx = makeFixture()
    seedAll(fx.paths)
    const batch = planBatchMove(ACCT, fx.paths, new Date())
    expect(batch.accountId).toBe(ACCT)
    expect(batch.plans.map((p) => p.conversationId).sort()).toEqual([C1, C2].sort())
    expect(batch.skipped).toEqual([])
    expect(batch.totalFiles).toBeGreaterThan(0)
    // 源侧原位未动
    expect(existsSync(join(fx.paths.sessionsRoot, C1, 'state.json'))).toBe(true)
    expect(existsSync(join(fx.paths.sessionsRoot, C3, 'state.json'))).toBe(true)
    expect(existsSync(join(fx.paths.sessionsRoot, C4, 'state.json'))).toBe(true)
  })

  it('已搬走的会话只跳过并点名,不阻断其余会话', () => {
    const fx = makeFixture()
    seedAll(fx.paths)
    rmSync(join(fx.paths.sessionsRoot, C1), { recursive: true, force: true })
    rmSync(join(fx.paths.projectsRoot, 'ws-a', `${C1}.jsonl`), { force: true })

    const batch = planBatchMove(ACCT, fx.paths, new Date())
    expect(batch.plans.map((p) => p.conversationId)).toEqual([C2])
    expect(batch.skipped.length).toBe(1)
    expect(batch.skipped[0]!.conversationId).toBe(C1)
    expect(batch.skipped[0]!.reason).toContain('会话不存在')
  })

  it('该账号一个会话都没有 ⇒ 空批次(不抛错)', () => {
    const fx = makeFixture()
    for (const c of [C3, C4]) seedConversation(fx.paths, c)
    seedSnapshot(fx.paths)
    seedLedger(fx.paths, {
      [C3]: { accountId: ACCT2, linkedBy: 'auto-since' },
      [C4]: { accountId: null, linkedBy: 'auto-since' },
    })
    const batch = planBatchMove(ACCT, fx.paths, new Date())
    expect(batch.plans).toEqual([])
    expect(batch.totalFiles).toBe(0)
  })

  it('台账缺失/当日快照缺失 ⇒ 拒绝(不猜不做)', () => {
    const fx = makeFixture()
    seedConversation(fx.paths, C1)
    expect(() => planBatchMove(ACCT, fx.paths, new Date())).toThrow(/台账不存在/)

    seedLedger(fx.paths, { [C1]: { accountId: ACCT, linkedBy: 'manual' } })
    expect(() => planBatchMove(ACCT, fx.paths, new Date())).toThrow(/当日会话库快照缺失/)
  })
})

describe('main move --account:互斥 / apply / 逐条 undo', () => {
  it('--conversation 与 --account 互斥、两者都缺 ⇒ 退出码 2', () => {
    const fx = makeFixture()
    seedAll(fx.paths)
    expect(main(['move', '--conversation', C1, '--account', ACCT], fx.paths)).toBe(2)
    expect(main(['move'], fx.paths)).toBe(2)
  })

  it('客户端存续前置:检测到 WorkBuddy 进程在跑 ⇒ --apply 退出码 2 且零改动;dry-run 不受影响', () => {
    const fx = makeFixture()
    seedAll(fx.paths)
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(
        main(['move', '--account', ACCT, '--apply'], fx.paths, ['"WorkBuddy.exe","1234"']),
      ).toBe(2)
    } finally {
      spy.mockRestore()
    }
    expect(existsSync(join(fx.paths.sessionsRoot, C1, 'state.json'))).toBe(true)
    expect(existsSync(fx.paths.opsLogFile)).toBe(false)
    expect(main(['move', '--account', ACCT], fx.paths, ['"WorkBuddy.exe","1234"'])).toBe(0)
  })

  it('定向理由(≥10字)可放行客户端在跑;短理由/缺理由仍拦', () => {
    const fx = makeFixture()
    seedAll(fx.paths)
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(
        main(['move', '--account', ACCT, '--apply', '--force-running-reason', '太短'], fx.paths, [
          '"WorkBuddy.exe","1234"',
        ]),
      ).toBe(2)
      expect(
        main(
          [
            'move',
            '--account',
            ACCT,
            '--apply',
            '--force-running-reason',
            '已确认目标会话当前未被客户端写入',
          ],
          fx.paths,
          ['"WorkBuddy.exe","1234"'],
        ),
      ).toBe(0)
    } finally {
      spy.mockRestore()
    }
    expect(existsSync(join(fx.paths.sessionsRoot, C1))).toBe(false)
    expect(readOps(fx.paths.opsLogFile).length).toBe(2)
  })

  it('dry-run 不动库;--apply 后两会话各自落地并各记一条 op;单条 undo 只回退那一条', () => {
    const fx = makeFixture()
    seedAll(fx.paths)
    const before = new Map(
      [C1, C2].map((c) => [
        c,
        sha256Of(readFileSync(join(fx.paths.sessionsRoot, c, 'state.json'))),
      ]),
    )

    expect(main(['move', '--account', ACCT], fx.paths)).toBe(0)
    expect(existsSync(join(fx.paths.sessionsRoot, C1, 'state.json'))).toBe(true)
    expect(existsSync(fx.paths.opsLogFile)).toBe(false)

    expect(main(['move', '--account', 'acct-aaaa', '--apply'], fx.paths, [])).toBe(0)
    // 两个会话都进桶,源侧消失
    for (const c of [C1, C2]) {
      expect(existsSync(join(fx.paths.sessionsRoot, c))).toBe(false)
      expect(
        existsSync(join(fx.paths.bucketsRoot, ACCT, 'workspace', 'sessions', c, 'state.json')),
      ).toBe(true)
    }
    // 他账号与未归属原封不动
    expect(existsSync(join(fx.paths.sessionsRoot, C3, 'state.json'))).toBe(true)
    expect(existsSync(join(fx.paths.sessionsRoot, C4, 'state.json'))).toBe(true)

    const ops = readOps(fx.paths.opsLogFile)
    expect(ops.length).toBe(2)
    expect(ops.every((o) => o.type === 'move' && o.accountId === ACCT)).toBe(true)

    // 单条回退 #1(排序后第一个会话)
    const firstConv = [C1, C2].sort()[0]!
    expect(main(['undo', '--op', '1', '--apply'], fx.paths, [])).toBe(0)
    expect(existsSync(join(fx.paths.sessionsRoot, firstConv, 'state.json'))).toBe(true)
    expect(sha256Of(readFileSync(join(fx.paths.sessionsRoot, firstConv, 'state.json')))).toBe(
      before.get(firstConv),
    )
    const other = firstConv === C1 ? C2 : C1
    // 另一条仍在桶里(undo 只回退指定单条)
    expect(existsSync(join(fx.paths.sessionsRoot, other))).toBe(false)
    expect(readOps(fx.paths.opsLogFile).length).toBe(3) // undo 自身也记账
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
