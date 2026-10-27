// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 并发锁的接线锁(装车证明):lib 单测只证明"锁本身能用",这里证明
 * **main 的 --apply 真的走了取锁路径**——预先持锁再跑 --apply,必须整批被拒
 * (exit 1 且文件零改动);释放后同一命令必须成功。
 * 判据来自 lib 的同一实现(acquireSessionLock),零第二份锁逻辑。
 */
import { describe, it, expect, afterAll, vi } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { main as moveMain, type MovePaths } from '../scripts/relay-session-move.js'
import { main as linksMain } from '../scripts/relay-session-links.js'
import { acquireSessionLock } from '../scripts/relay-session-lock.js'

const ACCT = 'acct-aaaa-1111'
const CONV = 'c1111111-2222-4333-8444-555566667777'

const cleanup: string[] = []
afterAll(() => {
  for (const p of cleanup) rmSync(p, { recursive: true, force: true })
})

function makeFixture(): { paths: MovePaths; root: string } {
  const root = mkdtempSync(join(tmpdir(), 'wb-lock-wiring-'))
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

function seed(paths: MovePaths): void {
  mkdirSync(join(paths.sessionsRoot, CONV), { recursive: true })
  writeFileSync(join(paths.sessionsRoot, CONV, 'state.json'), '{"v":1}')
  const ws = join(paths.projectsRoot, 'ws-a')
  mkdirSync(ws, { recursive: true })
  writeFileSync(join(ws, `${CONV}.jsonl`), '{"type":"meta"}\n')
  const snap = join(paths.backupsSessionsDir, '20261027T100000Z')
  mkdirSync(snap, { recursive: true })
  writeFileSync(
    join(snap, 'manifest.json'),
    JSON.stringify({
      createdAt: new Date().toISOString(),
      source: { sessionsRoot: paths.sessionsRoot, projectsRoot: paths.projectsRoot },
      files: [],
    }),
  )
  mkdirSync(dirname(paths.ledgerFile), { recursive: true })
  writeFileSync(
    paths.ledgerFile,
    JSON.stringify({
      version: 1,
      accounts: [{ accountId: ACCT, label: 'A', since: '2026-10-01T00:00:00.000Z' }],
      links: {
        [CONV]: {
          accountId: ACCT,
          linkedAt: '2026-10-01T00:00:00.000Z',
          linkedBy: 'manual',
        },
      },
    }),
  )
}

describe('main 的 --apply 必须真的持锁(装车证明)', () => {
  it('move --apply:外部持锁 ⇒ exit 1 且零改动;释放后同一命令成功', () => {
    const fx = makeFixture()
    seed(fx.paths)
    const lockPath = join(dirname(fx.paths.opsLogFile), 'session-move.lock')
    const hold = acquireSessionLock(lockPath, 'other-session')
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(moveMain(['move', '--conversation', CONV, '--apply'], fx.paths, [])).toBe(1)
    } finally {
      spy.mockRestore()
    }
    expect(existsSync(fx.paths.opsLogFile)).toBe(false)
    expect(existsSync(join(fx.paths.sessionsRoot, CONV, 'state.json'))).toBe(true)

    hold.release()
    const spyOut = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      expect(moveMain(['move', '--conversation', CONV, '--apply'], fx.paths, [])).toBe(0)
    } finally {
      spyOut.mockRestore()
    }
    expect(existsSync(join(fx.paths.sessionsRoot, CONV, 'state.json'))).toBe(false)
  })

  it('links rebuild --apply:外部持锁 ⇒ exit 1 且台账未写;dry-run 不取锁可正常预览', () => {
    const fx = makeFixture()
    seed(fx.paths)
    const lockPath = join(dirname(fx.paths.ledgerFile), 'session-links.lock')
    const hold = acquireSessionLock(lockPath, 'other-session')
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(
        linksMain(
          ['rebuild', '--since', '2026-01-01T00:00:00.000Z', '--account', ACCT, '--apply'],
          {
            ledgerFile: fx.paths.ledgerFile,
            sessionsRoot: fx.paths.sessionsRoot,
            projectsRoot: fx.paths.projectsRoot,
          },
        ),
      ).toBe(1)
    } finally {
      spy.mockRestore()
    }
    // dry-run 不取锁,即使有活锁也能预览
    const spyOut = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      expect(
        linksMain(['rebuild', '--since', '2026-01-01T00:00:00.000Z', '--account', ACCT], {
          ledgerFile: fx.paths.ledgerFile,
          sessionsRoot: fx.paths.sessionsRoot,
          projectsRoot: fx.paths.projectsRoot,
        }),
      ).toBe(0)
    } finally {
      spyOut.mockRestore()
    }
    hold.release()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
