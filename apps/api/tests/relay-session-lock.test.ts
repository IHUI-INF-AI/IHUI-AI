// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话搬家互斥锁测试。fixture 全注入临时目录,断言:
 * - 获取→释放→可再获取;同 pid 重入被拒(不自杀锁);
 * - 活持有者 ⇒ 拒绝并点名;死持有者 ⇒ 归档 .stale 后抢占;
 * - 超 TTL ⇒ 即使持有者活也抢占(防僵尸锁永久堵路);
 * - 坏锁文件 ⇒ 视为陈旧抢占;release 只删自己那份(不误删别人的锁)。
 */
import { describe, it, expect, afterAll } from 'vitest'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { acquireSessionLock, defaultIsAlive } from '../scripts/relay-session-lock.js'

const cleanup: string[] = []
afterAll(() => {
  for (const p of cleanup) rmSync(p, { recursive: true, force: true })
})

function makeDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'wb-lock-test-'))
  cleanup.push(dir)
  return dir
}

function writeLock(path: string, info: Record<string, unknown>): void {
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, `${JSON.stringify(info)}\n`)
}

describe('acquireSessionLock', () => {
  it('获取→释放→可再获取;锁文件内容带 pid/host/时刻/cmd', () => {
    const path = join(makeDir(), 'session-move.lock')
    const h = acquireSessionLock(path, 'move')
    expect(existsSync(path)).toBe(true)
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
    expect(raw['pid']).toBe(process.pid)
    expect(raw['cmd']).toBe('move')
    h.release()
    expect(existsSync(path)).toBe(false)
    const again = acquireSessionLock(path, 'restore')
    again.release()
  })

  it('同 pid 重入 ⇒ 拒绝(不把自己刚建的锁当陈旧锁抢占)', () => {
    const path = join(makeDir(), 'session-move.lock')
    const h1 = acquireSessionLock(path, 'move')
    expect(() => acquireSessionLock(path, 'copy')).toThrow(/另一个会话正在操作/)
    h1.release()
  })

  it('活持有者 ⇒ 拒绝并点名 pid/cmd;死持有者 ⇒ 归档 .stale 后抢占', () => {
    const dir = makeDir()
    const path = join(dir, 'session-move.lock')
    writeLock(path, {
      pid: 424242,
      host: 'other-host',
      startedAt: new Date().toISOString(),
      cmd: 'move --apply',
    })
    expect(() => acquireSessionLock(path, 'copy', { isAlive: () => true })).toThrow(
      /pid=424242.*move --apply/,
    )

    const h = acquireSessionLock(path, 'copy', { isAlive: () => false })
    expect(h.info.pid).toBe(process.pid)
    expect(readdirSync(dir).some((n) => n.startsWith('session-move.lock.stale-'))).toBe(true)
    h.release()
  })

  it('超 TTL ⇒ 即使持有者活也抢占(防僵尸锁永久堵路)', () => {
    const dir = makeDir()
    const path = join(dir, 'session-move.lock')
    writeLock(path, {
      pid: 424243,
      host: 'other-host',
      startedAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
      cmd: 'move',
    })
    const h = acquireSessionLock(path, 'copy', { isAlive: () => true, ttlMs: 30 * 60 * 1000 })
    expect(h.info.pid).toBe(process.pid)
    h.release()
  })

  it('坏锁文件 ⇒ 视为陈旧并抢占(不因坏数据永久堵路)', () => {
    const path = join(makeDir(), 'session-move.lock')
    mkdirSync(join(path, '..'), { recursive: true })
    writeFileSync(path, 'not-json-at-all')
    const h = acquireSessionLock(path, 'move', { isAlive: () => false })
    h.release()
    expect(existsSync(path)).toBe(false)
  })

  it('release 只删自己那份:锁内容被换掉时不动别人的锁', () => {
    const path = join(makeDir(), 'session-move.lock')
    const h = acquireSessionLock(path, 'move')
    writeLock(path, {
      pid: 999999,
      host: 'x',
      startedAt: '2026-01-01T00:00:00.000Z',
      cmd: 'other',
    })
    h.release()
    expect(existsSync(path)).toBe(true)
  })

  it('defaultIsAlive:非法 pid 判死;当前进程判活', () => {
    expect(defaultIsAlive(0)).toBe(false)
    expect(defaultIsAlive(Number.NaN)).toBe(false)
    expect(defaultIsAlive(process.pid)).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
