// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SwitchTarget } from '../scripts/relay-account-switch.js'
import { planPrune, pruneMain } from '../scripts/relay-snapshot-prune.js'

/** 构造一份可被 describeAuthFile 解析的快照正文(uid 参数化;无真凭据) */
function snapshotBody(uid?: string): string {
  return JSON.stringify({
    account: {
      nickname: '测试昵称',
      phoneNumber: '13812345678',
      ...(uid ? { uid } : {}),
    },
    auth: {
      accessToken: 'at-test',
      refreshToken: 'rt-test',
      domain: 'workbuddy.cn',
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      tokenType: 'bearer',
    },
  })
}

function fakeTarget(name: string, accountId: string | undefined, sha12: string): SwitchTarget {
  return {
    name,
    path: join('X:', 'fake', name),
    modifiedAt: '',
    sha12,
    ...(accountId ? { accountId } : {}),
    tokenShape: 'jwt',
    isCurrent: false,
    expired: false,
  }
}

describe('planPrune(纯函数判据)', () => {
  it('同 uid 多份只留最新一份,其余进 move(入参新→旧首见即最新)', () => {
    const plans = planPrune([
      fakeTarget('workbuddy-desktop.20261028T000000Z.info', 'uid-a', 'aaa'),
      fakeTarget('workbuddy-desktop.20261027T000000Z.info', 'uid-a', 'bbb'),
      fakeTarget('workbuddy-desktop.20261026T000000Z.info', 'uid-a', 'ccc'),
    ])
    expect(plans).toHaveLength(1)
    expect(plans[0]?.keep.sha12).toBe('aaa')
    expect(plans[0]!.move.map((m) => m.sha12)).toEqual(['bbb', 'ccc'])
  })

  it('无 accountId 的快照不进任何组(宁多留一份,不冒并账号)', () => {
    const plans = planPrune([
      fakeTarget('workbuddy-desktop.20261028T000000Z.info', undefined, 'aaa'),
      fakeTarget('workbuddy-desktop.20261027T000000Z.info', undefined, 'bbb'),
    ])
    expect(plans).toHaveLength(0)
  })

  it('每账号仅一份或全部异号 ⇒ 无可清理', () => {
    const plans = planPrune([
      fakeTarget('workbuddy-desktop.20261028T000000Z.info', 'uid-a', 'aaa'),
      fakeTarget('workbuddy-desktop.20261027T000000Z.info', 'uid-b', 'bbb'),
    ])
    expect(plans).toHaveLength(0)
  })
})

describe('pruneMain(临时 home 注入,绝不碰真实快照库)', () => {
  let home: string
  let backupsDir: string

  const seed = (names: Array<[string, string | undefined]>) => {
    home = mkdtempSync(join(tmpdir(), 'relay-prune-'))
    backupsDir = join(home, '.wb-switch', 'backups')
    mkdirSync(backupsDir, { recursive: true })
    for (const [name, uid] of names) writeFileSync(join(backupsDir, name), snapshotBody(uid))
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const topLevel = (): string[] =>
    readdirSync(backupsDir)
      .filter((n) => /^workbuddy-desktop\..+\.info$/.test(n))
      .sort()

  it('dry-run 不动任何文件', () => {
    seed([
      ['workbuddy-desktop.20261028T000000Z.info', 'uid-a'],
      ['workbuddy-desktop.20261027T000000Z.info', 'uid-a'],
    ])
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(pruneMain([], home)).toBe(0)
    expect(topLevel()).toHaveLength(2)
    expect(existsSync(join(backupsDir, '.pruned'))).toBe(false)
  })

  it('--apply 后顶层只剩每账号一份,旧份在 .pruned/ 可找回;再跑幂等', () => {
    seed([
      ['workbuddy-desktop.20261028T000000Z.info', 'uid-a'],
      ['workbuddy-desktop.20261027T000000Z.info', 'uid-a'],
      ['workbuddy-desktop.20261026T000000Z.info', 'uid-a'],
      ['workbuddy-desktop.20261025T000000Z.info', 'uid-b'],
      ['workbuddy-desktop.20261024T000000Z.info', undefined],
    ])
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(pruneMain(['--apply'], home)).toBe(0)
    expect(topLevel()).toEqual([
      'workbuddy-desktop.20261024T000000Z.info',
      'workbuddy-desktop.20261025T000000Z.info',
      'workbuddy-desktop.20261028T000000Z.info',
    ])
    const pruned = readdirSync(join(backupsDir, '.pruned')).sort()
    expect(pruned).toEqual([
      'workbuddy-desktop.20261026T000000Z.info',
      'workbuddy-desktop.20261027T000000Z.info',
    ])
    // 幂等:已清理后再跑 ⇒ 无重复可清,退出 0
    expect(pruneMain(['--apply'], home)).toBe(0)
  })

  it('快照库不存在 ⇒ exit 2 未判定,不冒绿', () => {
    home = mkdtempSync(join(tmpdir(), 'relay-prune-empty-'))
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(pruneMain([], home)).toBe(2)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
