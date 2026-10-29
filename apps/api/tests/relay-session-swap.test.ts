// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 切账号联动换桶(swap)测试。fixture 全注入临时目录,断言:
 * - 换出只动「当前登录账号名下、还在活库」的会话;换入只动「目标账号桶里」的会话;
 * - 未归属(null)与第三个账号一律不碰;
 * - 当前登录态不可判 ⇒ 只换入、不搬出(不把别人的会话挪走);
 * - 目标与当前同账号 ⇒ 拒绝;台账缺失/当日快照缺失 ⇒ 拒绝;
 * - dry-run 零改动;--apply 后逐会话各自记账;桶内回位遇同名不同内容 ⇒ 该会话跳过并点名。
 */
import { describe, it, expect, afterAll, vi } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { main, planSwap, readOps, type MovePaths } from '../scripts/relay-session-move.js'
import { applyLedger, emptyLedger } from '../scripts/relay-session-links.js'

const A = 'acct-aaaa-1111'
const B = 'acct-bbbb-2222'
const C1 = 'c1111111-2222-4333-8444-555566667777'
const C2 = 'c2222222-3333-4444-8555-666677778888'
const C3 = 'c3333333-4444-4555-8666-777788889999'
const C4 = 'c4444444-5555-4666-8777-888899990000'

const cleanup: string[] = []
afterAll(() => {
  for (const p of cleanup) rmSync(p, { recursive: true, force: true })
})

function makeFixture(): { paths: MovePaths; authFile: string } {
  const root = mkdtempSync(join(tmpdir(), 'wb-swap-test-'))
  cleanup.push(root)
  return {
    authFile: join(root, 'auth', 'current.info'),
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

function seedAuth(authFile: string, uid: string): void {
  mkdirSync(join(authFile, '..'), { recursive: true })
  writeFileSync(authFile, JSON.stringify({ version: 1, account: { uid }, auth: {} }))
}

function seedConversation(paths: MovePaths, conv: string): void {
  mkdirSync(join(paths.sessionsRoot, conv), { recursive: true })
  writeFileSync(join(paths.sessionsRoot, conv, 'state.json'), `{"v":"${conv}"}`)
  const ws = join(paths.projectsRoot, 'ws-a')
  mkdirSync(ws, { recursive: true })
  writeFileSync(join(ws, `${conv}.jsonl`), `{"type":"meta","sessionId":"${conv}"}\n`)
}

function seedBucketConversation(paths: MovePaths, accountId: string, conv: string): void {
  mkdirSync(join(paths.bucketsRoot, accountId, 'workspace', 'sessions', conv), { recursive: true })
  writeFileSync(
    join(paths.bucketsRoot, accountId, 'workspace', 'sessions', conv, 'state.json'),
    `{"v":"${conv}"}`,
  )
  const ws = join(paths.bucketsRoot, accountId, 'projects', 'ws-a')
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

function seedLedger(paths: MovePaths): void {
  applyLedger(paths.ledgerFile, {
    ...emptyLedger(),
    accounts: [
      { accountId: A, label: 'A', since: '2026-10-01T00:00:00.000Z' },
      { accountId: B, label: 'B', since: '2026-10-02T00:00:00.000Z' },
    ],
    links: {
      [C1]: { accountId: A, linkedAt: '2026-10-01T00:00:00.000Z', linkedBy: 'manual' },
      [C2]: { accountId: A, linkedAt: '2026-10-01T00:00:00.000Z', linkedBy: 'auto-since' },
      [C3]: { accountId: B, linkedAt: '2026-10-02T00:00:00.000Z', linkedBy: 'auto-since' },
      [C4]: { accountId: null, linkedAt: '2026-10-03T00:00:00.000Z', linkedBy: 'auto-since' },
    },
  })
}

function seedAll(): { paths: MovePaths; authFile: string } {
  const fx = makeFixture()
  seedAuth(fx.authFile, A)
  for (const c of [C1, C2, C4]) seedConversation(fx.paths, c)
  seedBucketConversation(fx.paths, B, C3)
  seedSnapshot(fx.paths)
  seedLedger(fx.paths)
  return fx
}

describe('planSwap:换出/换入边界', () => {
  it('只换出当前账号名下的会话、只换入目标桶里的会话;未归属与他账号不碰', () => {
    const fx = seedAll()
    const p = planSwap(B, fx.paths, new Date(), fx.authFile)
    expect(p.currentAccountId).toBe(A)
    expect(p.targetAccountId).toBe(B)
    expect(p.outbound.map((m) => m.conversationId).sort()).toEqual([C1, C2].sort())
    expect(p.inbound.map((m) => m.conversationId)).toEqual([C3])
    expect(p.skipped).toEqual([])
    // dry-run 天然:计划阶段不写盘,活库原样
    expect(existsSync(join(fx.paths.sessionsRoot, C1, 'state.json'))).toBe(true)
    expect(existsSync(join(fx.paths.sessionsRoot, C4, 'state.json'))).toBe(true)
  })

  it('目标与当前同账号 ⇒ 拒绝;台账缺失/快照缺失 ⇒ 拒绝', () => {
    const fx = seedAll()
    expect(() => planSwap(A, fx.paths, new Date(), fx.authFile)).toThrow(/无需换桶/)

    const noLedger = makeFixture()
    seedAuth(noLedger.authFile, A)
    expect(() => planSwap(B, noLedger.paths, new Date(), noLedger.authFile)).toThrow(/台账不存在/)

    const noSnap = makeFixture()
    seedAuth(noSnap.authFile, A)
    seedLedger(noSnap.paths)
    expect(() => planSwap(B, noSnap.paths, new Date(), noSnap.authFile)).toThrow(
      /当日会话库快照缺失/,
    )
  })

  it('当前登录态不可判 ⇒ 只换入不搬出,并点名告警', () => {
    const fx = seedAll()
    const p = planSwap(B, fx.paths, new Date(), join(fx.paths.sessionsRoot, 'absent.info'))
    expect(p.currentAccountId).toBeNull()
    expect(p.outbound).toEqual([])
    expect(p.inbound.map((m) => m.conversationId)).toEqual([C3])
    expect(p.warnings.some((w) => w.includes('只做换入'))).toBe(true)
  })

  it('桶内会话回位遇活库同名不同内容 ⇒ 该会话跳过并点名,不阻断其余', () => {
    const fx = seedAll()
    // 活库里放一个同 id 但内容不同的 C3
    mkdirSync(join(fx.paths.sessionsRoot, C3), { recursive: true })
    writeFileSync(join(fx.paths.sessionsRoot, C3, 'state.json'), '{"v":"conflict"}')
    mkdirSync(join(fx.paths.projectsRoot, 'ws-a'), { recursive: true })
    writeFileSync(join(fx.paths.projectsRoot, 'ws-a', `${C3}.jsonl`), '{"conflict":true}\n')

    const p = planSwap(B, fx.paths, new Date(), fx.authFile)
    expect(p.inbound).toEqual([])
    expect(p.skipped.length).toBe(1)
    expect(p.skipped[0]!.conversationId).toBe(C3)
    expect(p.skipped[0]!.direction).toBe('inbound')
    expect(p.skipped[0]!.reason).toMatch(/宁可拒做/)
  })
})

describe('main swap:dry-run 与 --apply', () => {
  it('dry-run 零改动;--apply 后会话各归其位、未归属原地不动、逐会话记账', () => {
    const fx = seedAll()
    const args = ['swap', '--to', B, '--auth-file', fx.authFile]
    expect(main(args, fx.paths, [])).toBe(0)
    expect(existsSync(fx.paths.opsLogFile)).toBe(false)

    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      expect(main([...args, '--apply'], fx.paths, [])).toBe(0)
    } finally {
      spy.mockRestore()
    }
    // A 名下会话进 A 桶,活库消失
    for (const c of [C1, C2]) {
      expect(existsSync(join(fx.paths.sessionsRoot, c, 'state.json'))).toBe(false)
      expect(
        existsSync(join(fx.paths.bucketsRoot, A, 'workspace', 'sessions', c, 'state.json')),
      ).toBe(true)
    }
    // B 的桶内会话回到活库,桶内消失
    expect(existsSync(join(fx.paths.sessionsRoot, C3, 'state.json'))).toBe(true)
    expect(existsSync(join(fx.paths.bucketsRoot, B, 'workspace', 'sessions', C3))).toBe(false)
    // 未归属原样留在活库
    expect(existsSync(join(fx.paths.sessionsRoot, C4, 'state.json'))).toBe(true)

    const ops = readOps(fx.paths.opsLogFile)
    expect(ops.length).toBe(3)
    expect(ops.filter((o) => o.type === 'move').length).toBe(2)
    expect(ops.filter((o) => o.type === 'restore').length).toBe(1)
  })

  it('客户端在跑且无定向理由 ⇒ --apply 退出码 2 且零改动;dry-run 不受影响', () => {
    const fx = seedAll()
    const args = ['swap', '--to', B, '--auth-file', fx.authFile, '--apply']
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(main(args, fx.paths, ['"WorkBuddy.exe","1"'])).toBe(2)
    } finally {
      spy.mockRestore()
    }
    expect(existsSync(fx.paths.opsLogFile)).toBe(false)
    expect(existsSync(join(fx.paths.sessionsRoot, C1, 'state.json'))).toBe(true)
    expect(
      main(['swap', '--to', B, '--auth-file', fx.authFile], fx.paths, ['"WorkBuddy.exe","1"']),
    ).toBe(0)
  })

  it('缺 --to ⇒ 退出码 2', () => {
    const fx = seedAll()
    expect(main(['swap'], fx.paths, [])).toBe(2)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
