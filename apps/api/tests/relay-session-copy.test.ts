// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话复制腿(copy)测试。fixture 全注入临时目录,断言:
 * - 复制只写桶、源侧逐字节保留(与 move 的差别就在这);
 * - 目标账号 = --to 显式 > 台账归属;两者都取不到拒做(不猜);未归属 + 显式 --to 允许并告警;
 * - 桶内已有且 sha 一致 ⇒ 跳过;sha 不同 ⇒ 拒做(不覆盖);
 * - ops 记 type=copy;copy 不支持 undo(撤销=删副本,违"绝不删除"红线);
 * - dry-run 零改动;客户端存续前置沿用同一道闸。
 */
import { describe, it, expect, afterAll, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { main, planCopy, planUndo, readOps, type MovePaths } from '../scripts/relay-session-move.js'
import { applyLedger, emptyLedger } from '../scripts/relay-session-links.js'

const A = 'acct-aaaa-1111'
const B = 'acct-bbbb-2222'
const CONV = 'c1111111-2222-4333-8444-555566667777'
const OTHER = 'c2222222-3333-4444-8555-666677778888'

const sha256Of = (buf: Buffer | string): string => createHash('sha256').update(buf).digest('hex')

const cleanup: string[] = []
afterAll(() => {
  for (const p of cleanup) rmSync(p, { recursive: true, force: true })
})

function makeFixture(): { paths: MovePaths; root: string } {
  const root = mkdtempSync(join(tmpdir(), 'wb-copy-test-'))
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
): void {
  applyLedger(paths.ledgerFile, {
    ...emptyLedger(),
    accounts: [
      { accountId: A, label: 'A', since: '2026-10-01T00:00:00.000Z' },
      { accountId: B, label: 'B', since: '2026-10-02T00:00:00.000Z' },
    ],
    links: Object.fromEntries(
      Object.entries(links).map(([c, l]) => [
        c,
        { accountId: l.accountId, linkedAt: new Date().toISOString(), linkedBy: l.linkedBy },
      ]),
    ),
  })
}

function seedAll(): MovePaths {
  const fx = makeFixture()
  seedConversation(fx.paths, CONV)
  seedConversation(fx.paths, OTHER)
  seedSnapshot(fx.paths)
  seedLedger(fx.paths, {
    [CONV]: { accountId: A, linkedBy: 'manual' },
    [OTHER]: { accountId: null, linkedBy: 'auto-since' },
  })
  return fx.paths
}

describe('planCopy:目标解析与只读计划', () => {
  it('缺省取台账归属;显式 --to 覆盖并告警;未归属且无 --to 拒绝', () => {
    const paths = seedAll()
    const byLedger = planCopy(CONV, paths, new Date())
    expect(byLedger.mode).toBe('copy')
    expect(byLedger.accountId).toBe(A)
    expect(byLedger.warnings).toEqual([])

    const byFlag = planCopy(CONV, paths, new Date(), B)
    expect(byFlag.accountId).toBe(B)
    expect(byFlag.warnings.some((w) => w.includes('按 --to 复制到'))).toBe(true)

    expect(() => planCopy(OTHER, paths, new Date())).toThrow(/目标账号不可判/)
    const explicit = planCopy(OTHER, paths, new Date(), 'acct-bbbb')
    expect(explicit.accountId).toBe(B)
  })

  it('快照缺失/台账缺失/会话不存在/账号不在台账 ⇒ 拒绝', () => {
    const fx = makeFixture()
    seedConversation(fx.paths, CONV)
    seedLedger(fx.paths, { [CONV]: { accountId: A, linkedBy: 'manual' } })
    expect(() => planCopy(CONV, fx.paths, new Date())).toThrow(/当日会话库快照缺失/)

    seedSnapshot(fx.paths)
    expect(() => planCopy(CONV, fx.paths, new Date(), 'nope')).toThrow(/账号不在台账/)
    expect(() => planCopy('c-not-exist', fx.paths, new Date())).toThrow(/会话不存在/)
  })
})

describe('main copy:源保留与逐条判据', () => {
  it('dry-run 零改动;--apply 后桶内有副本、源侧 sha 不变、ops 记 type=copy', () => {
    const paths = seedAll()
    const srcState = join(paths.sessionsRoot, CONV, 'state.json')
    const before = sha256Of(readFileSync(srcState))

    expect(main(['copy', '--conversation', CONV], paths, [])).toBe(0)
    expect(existsSync(paths.opsLogFile)).toBe(false)
    expect(
      existsSync(join(paths.bucketsRoot, A, 'workspace', 'sessions', CONV, 'state.json')),
    ).toBe(false)

    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      expect(main(['copy', '--conversation', CONV, '--apply'], paths, [])).toBe(0)
    } finally {
      spy.mockRestore()
    }
    // 源侧逐字节保留
    expect(sha256Of(readFileSync(srcState))).toBe(before)
    expect(existsSync(join(paths.projectsRoot, 'ws-a', `${CONV}.jsonl`))).toBe(true)
    // 桶内有副本且内容一致
    const dst = join(paths.bucketsRoot, A, 'workspace', 'sessions', CONV, 'state.json')
    expect(sha256Of(readFileSync(dst))).toBe(before)
    const ops = readOps(paths.opsLogFile)
    expect(ops.length).toBe(1)
    expect(ops[0]!.type).toBe('copy')
  })

  it('重复复制:桶内已在且 sha 一致 ⇒ 跳过不重写;sha 不同 ⇒ 拒做退出码 1', () => {
    const paths = seedAll()
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const spyErr = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(main(['copy', '--conversation', CONV, '--apply'], paths, [])).toBe(0)
      expect(main(['copy', '--conversation', CONV, '--apply'], paths, [])).toBe(0)

      // 篡改桶内副本,制造 sha 不一致
      writeFileSync(
        join(paths.bucketsRoot, A, 'workspace', 'sessions', CONV, 'state.json'),
        '{"tampered":true}',
      )
      expect(main(['copy', '--conversation', CONV, '--apply'], paths, [])).toBe(1)
    } finally {
      spy.mockRestore()
      spyErr.mockRestore()
    }
    // 拒做时桶内仍是篡改后的内容(不静默覆盖)
    expect(
      readFileSync(join(paths.bucketsRoot, A, 'workspace', 'sessions', CONV, 'state.json'), 'utf8'),
    ).toContain('tampered')
  })

  it('copy 的 op 不支持 undo(撤销=删副本,违绝不删除红线)', () => {
    const paths = seedAll()
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      expect(main(['copy', '--conversation', CONV, '--apply'], paths, [])).toBe(0)
    } finally {
      spy.mockRestore()
    }
    expect(() => planUndo(paths.opsLogFile, 1)).toThrow(/不支持|不删文件|撤销等于删除/)
  })

  it('客户端在跑且无理由 ⇒ --apply 退出码 2;缺 --conversation ⇒ 2', () => {
    const paths = seedAll()
    const spyErr = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(
        main(['copy', '--conversation', CONV, '--apply'], paths, ['"WorkBuddy.exe","1"']),
      ).toBe(2)
      expect(main(['copy'], paths, [])).toBe(2)
    } finally {
      spyErr.mockRestore()
    }
    expect(existsSync(paths.opsLogFile)).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
