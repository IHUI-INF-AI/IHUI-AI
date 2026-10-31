// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  buildPoolSnapshot,
  poolSnapshotName,
  resolvePoolOwner,
  syncMain,
  syncPoolSnapshots,
  type PoolAccountInput,
  type SyncDeps,
} from '../scripts/relay-pool-snapshot-sync.js'

// 测试隔离铁律:绝不连生产库 —— 一律 deps.accounts 注入,fetchPoolWorkbuddyAccounts 不触发
const NOW = new Date('2026-10-31T04:00:00.000Z')

function acc(over: Partial<PoolAccountInput> = {}): PoolAccountInput {
  return {
    uid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeffff0069',
    name: '19269350269',
    token: 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ0In0.sig-test',
    refreshToken: 'rt-test-value',
    tokenExpiresAt: new Date(NOW.getTime() + 86_400_000),
    refreshExpiresAt: new Date(NOW.getTime() + 7 * 86_400_000),
    domain: null,
    ...over,
  }
}

function depsFor(dir: string, accounts: PoolAccountInput[]): SyncDeps {
  return { accounts, backupsDir: dir, now: NOW }
}

describe('poolSnapshotName', () => {
  it('固定名含 uid;非法文件名字符替换为 _(同名覆盖 ⇒ 派生件不堆积)', () => {
    expect(poolSnapshotName('abc-def')).toBe('workbuddy-desktop.pool-abc-def.info')
    expect(poolSnapshotName('a/b\\c:d')).toBe('workbuddy-desktop.pool-a_b_c_d.info')
  })
})

describe('resolvePoolOwner(本机归属射程,2026-10-31 机主令)', () => {
  it('pool-owner 文件存在 ⇒ 取首行 trim;不存在/空 ⇒ null(全局池旧行为)', () => {
    const home = mkdtempSync(join(tmpdir(), 'pool-owner-'))
    expect(resolvePoolOwner(home)).toBeNull() // 未配置 ⇒ 全局池
    mkdirSync(join(home, '.wb-switch'), { recursive: true })
    writeFileSync(join(home, '.wb-switch', 'pool-owner'), '30763d9f-a4c4-4f0c-84c3-16d6b8a67c35\n')
    expect(resolvePoolOwner(home)).toBe('30763d9f-a4c4-4f0c-84c3-16d6b8a67c35')
    writeFileSync(join(home, '.wb-switch', 'pool-owner'), '   \n')
    expect(resolvePoolOwner(home)).toBeNull()
  })
})

describe('buildPoolSnapshot(形状对齐实机 jwt 明文快照)', () => {
  it('auth/account 键集与值投影正确;输出绝不外泄 token 之外还须含 token 本体(文件面)', () => {
    const root = JSON.parse(buildPoolSnapshot(acc(), NOW)) as {
      auth: Record<string, unknown>
      account: Record<string, unknown>
      accounts: unknown[]
      allAccounts: unknown[]
    }
    expect(root.auth['accessToken']).toBe('eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ0In0.sig-test')
    expect(root.auth['refreshToken']).toBe('rt-test-value')
    expect(root.auth['domain']).toBe('copilot.tencent.com') // 缺失 → resolveRealm('')='cn' ⇒ CN chat base
    expect(root.auth['expiresAt']).toBe(NOW.getTime() + 86_400_000)
    expect(root.auth['tokenType']).toBe('Bearer')
    expect(root.account['uid']).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeffff0069')
    expect(root.account['nickname']).toBe('19269350269')
    expect(root.account['lastLogin']).toBe(true)
    expect(root.accounts).toHaveLength(1)
    expect(root.allAccounts).toHaveLength(1)
  })

  it('domain=workbuddy.ai ⇒ global 基址;refreshToken 缺失 ⇒ 空串不缺键', () => {
    const root = JSON.parse(
      buildPoolSnapshot(acc({ domain: 'workbuddy.ai', refreshToken: null }), NOW),
    ) as { auth: Record<string, unknown> }
    expect(root.auth['domain']).toBe('www.workbuddy.ai')
    expect(root.auth['refreshToken']).toBe('')
  })
})

describe('syncPoolSnapshots / syncMain(临时目录注入)', () => {
  it('缺省 dry-run 只算不写;--apply 写 pool 快照;重跑内容相同 ⇒ unchanged(幂等,零写盘)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pool-sync-'))
    const d = depsFor(dir, [acc()])
    const dry = await syncPoolSnapshots({ ...d })
    expect(dry.synced).toBe(1)
    expect(existsSync(join(dir, poolSnapshotName(acc().uid)))).toBe(false) // dry-run 不动实盘
    const first = await syncPoolSnapshots({ ...d, apply: true })
    expect(first.synced).toBe(1)
    const dest = join(dir, poolSnapshotName(acc().uid))
    expect(existsSync(dest)).toBe(true)
    expect(readFileSync(dest, 'utf8')).toContain('eyJhbGciOiJSUzI1NiJ9')
    expect(readdirSync(dir).some((n) => n.endsWith('.tmp'))).toBe(false) // 原子写无残留
    const second = await syncPoolSnapshots({ ...d, apply: true })
    expect(second.synced).toBe(0)
    expect(second.unchanged).toBe(1)
  })

  it('号池票未变、同步时刻不同 ⇒ unchanged(相对派生量不参与指纹)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pool-sync-fp-'))
    const d = depsFor(dir, [acc()])
    await syncPoolSnapshots({ ...d, apply: true })
    const later = await syncPoolSnapshots({
      ...d,
      apply: true,
      now: new Date(NOW.getTime() + 10_000),
    })
    expect(later.synced).toBe(0)
    expect(later.unchanged).toBe(1)
  })

  it('syncMain dry-run 不写盘;--apply 才写;退出码 0', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const dir = mkdtempSync(join(tmpdir(), 'pool-sync-main-'))
    const d = depsFor(dir, [acc()])
    expect(await syncMain([], d)).toBe(0)
    expect(existsSync(join(dir, poolSnapshotName(acc().uid)))).toBe(false)
    expect(await syncMain(['--apply'], d)).toBe(0)
    expect(existsSync(join(dir, poolSnapshotName(acc().uid)))).toBe(true)
    vi.restoreAllMocks()
  })

  it('快照库目录不存在 ⇒ 写盘时自动创建(apply 档)', async () => {
    const home = mkdtempSync(join(tmpdir(), 'pool-sync-mk-'))
    const dir = join(home, '.wb-switch', 'backups')
    await syncPoolSnapshots({ ...depsFor(dir, [acc()]), apply: true })
    expect(existsSync(join(dir, poolSnapshotName(acc().uid)))).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
