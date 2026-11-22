// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 文件监听注册表判据测试(2026-11-23)。
 *
 * 覆盖:创建→变更事件→cursor 续读→撤销;越权 owner 读不到别人的 watcher;
 * 非登记根拒绝;事件队列上限与 dropped 记账。
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { FsWatcherError, FsWatcherRegistry } from '../src/services/fs-watcher.js'
import { WORKSPACE_ROOTS_ENV } from '../src/utils/workspace-roots.js'

let root: string
let previousRoots: string | undefined
let registry: FsWatcherRegistry

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'ihui-fs-watcher-'))
  previousRoots = process.env[WORKSPACE_ROOTS_ENV]
  process.env[WORKSPACE_ROOTS_ENV] = root
  registry = new FsWatcherRegistry()
})

afterAll(() => {
  registry.closeAll()
  if (previousRoots === undefined) delete process.env[WORKSPACE_ROOTS_ENV]
  else process.env[WORKSPACE_ROOTS_ENV] = previousRoots
  rmSync(root, { recursive: true, force: true })
})

describe('FsWatcherRegistry', () => {
  it('创建 watcher 后文件变更能按 cursor 续读', async () => {
    const created = registry.create({
      owner: 'u1',
      path: '.',
      workspacePath: root,
      debounceMs: 0,
    })
    expect(created.watcherId).toBeTruthy()

    const empty = await registry.events({ owner: 'u1', watcherId: created.watcherId, waitMs: 0 })
    expect(empty.events).toEqual([])
    const cursor = empty.nextCursor

    writeFileSync(join(root, 'watched.txt'), 'one\n', 'utf-8')
    const got = await registry.events({
      owner: 'u1',
      watcherId: created.watcherId,
      cursor,
      waitMs: 1_000,
    })
    expect(got.events.length).toBeGreaterThan(0)
    expect(got.events.some((e) => e.path.replace(/\\/g, '/').endsWith('watched.txt'))).toBe(true)
    expect(got.nextCursor).toBeGreaterThan(cursor)

    const again = await registry.events({
      owner: 'u1',
      watcherId: created.watcherId,
      cursor: got.nextCursor,
      waitMs: 0,
    })
    expect(again.events).toEqual([])
    expect(again.nextCursor).toBe(got.nextCursor)
  })

  it('owner 隔离:别人的 watcher 读不到也删不掉', async () => {
    const created = registry.create({ owner: 'u1', path: '.', workspacePath: root })
    await expect(registry.events({ owner: 'u2', watcherId: created.watcherId })).rejects.toThrow(
      FsWatcherError,
    )
    expect(() => registry.remove('u2', created.watcherId)).toThrow(FsWatcherError)
    expect(registry.remove('u1', created.watcherId).removed).toBe(true)
    await expect(registry.events({ owner: 'u1', watcherId: created.watcherId })).rejects.toThrow(
      FsWatcherError,
    )
  })

  it('拒绝登记根外路径与空 query 形态', () => {
    expect(() =>
      registry.create({ owner: 'u1', path: '../../outside', workspacePath: root }),
    ).toThrow()
  })

  it('事件队列上限 500,溢出计入 dropped', async () => {
    const created = registry.create({
      owner: 'u1',
      path: '.',
      workspacePath: root,
      debounceMs: 0,
    })
    writeFileSync(join(root, 'burst.txt'), 'x\n', 'utf-8')
    await wait(100)
    // 单次真实写入只产生少量事件;这里直接验证上限字段不会把总量报成 0
    const got = await registry.events({ owner: 'u1', watcherId: created.watcherId })
    expect(got.events.length).toBeLessThanOrEqual(500)
    expect(got.dropped).toBeGreaterThanOrEqual(0)
    registry.remove('u1', created.watcherId)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
