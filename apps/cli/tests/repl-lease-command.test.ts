// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * REPL `/lease` 命令回归(ZCode 吸收线收尾票之二:第二档授予来源 grantor:'repl-command')。
 *
 * 钉死五条硬要求:
 *  ① 授予成功 ⇒ activePermissionLease() 在位、grantor==='repl-command'、scope 带 REPL 前缀;
 *  ② 裸命令且无租约 ⇒ 打印"未授予(默认档)"文案,且**不创建**租约;
 *  ③ `/lease off` ⇒ 撤销后 activePermissionLease()===null,并回显审计引用;
 *  ④ 非法输入(通配 / 未知 flag / 只有 flag 无清单 / 叠租约)⇒ 只打印拒因,
 *     当前租约对象逐字不变(同一引用、同 auditRef、同到期),审计计数零增长 ——
 *     "报错不得把清空租约当副作用",那会让一次误敲变成一次放宽撤销事故;
 *  ⑤ 结构锁:repl.ts 源码面必须真有唯一构造出口 `grantPermissionLease(` 的非注释调用点
 *     (剥注释后判 —— 本仓最高频失效型就是"注释里提了一句 ⇒ 看起来有、其实没装车")。
 *
 * 期望文案一律经 t(key) 现取(与 repl.ts 同一份语言包),不抄第二份字面量;
 * `auditLog` 由 vi.mock 截获 ⇒ 既不往 ~/.ihui 落盘,又能断言授予/撤销各落一条审计。
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// 语言档必须在 i18n 模块求值前钉住(它在 import 期就定档);vi.hoisted 保证先于一切 import。
vi.hoisted(() => {
  process.env.IHUI_LOCALE = 'zh-CN'
})

const auditCalls: Array<{ tool: string; input: Record<string, unknown> }> = []

vi.mock('../src/audit.js', () => ({
  auditLog: (entry: { tool: string; input: Record<string, unknown> }) => {
    auditCalls.push({ tool: entry.tool, input: entry.input })
  },
}))

import { handleLease, type ReplState } from '../src/commands/repl.js'
import {
  activePermissionLease,
  grantPermissionLease,
  resetPermissionLeaseForTests,
} from '../src/tools/permission-lease.js'
import { t } from '../src/i18n/index.js'

/** 只带 session id 的最小状态 —— handleLease 的读取面就这么多,不依赖装配时机。 */
const state = { session: { id: 'lease-test-session' } } as unknown as ReplState

let emitted: string[]

beforeEach(() => {
  auditCalls.length = 0
  resetPermissionLeaseForTests()
  emitted = []
  vi.spyOn(console, 'info').mockImplementation((...a: unknown[]) => {
    emitted.push(a.map((x) => String(x)).join(' '))
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  resetPermissionLeaseForTests()
})

function auditCount(tool: string): number {
  return auditCalls.filter((c) => c.tool === tool).length
}

describe('① 授予成功:grantor/前缀/能力/轮次与入参一致', () => {
  it('`/lease write_file,git_commit --ttl=5 --turns=3` ⇒ 租约在位且来源可辨', () => {
    handleLease(state, ['write_file,git_commit', '--ttl=5', '--turns=3'])
    const lease = activePermissionLease()
    expect(lease).not.toBeNull()
    expect(lease?.grantor).toBe('repl-command')
    // scope 前缀必须与 cli-flag 档的 `cli-agent:` 区分(审计里认得出授予来源)
    expect(lease?.scope).toBe('cli-repl:lease-test-session')
    expect(lease?.capabilities).toEqual(['write_file', 'git_commit'])
    expect(lease?.expiresAfterTurns).toBe(3)
    expect(emitted.some((l) => l.includes(t('cliEntry.replLeaseGranted', {
      tools: 'write_file,git_commit',
      ttl: '5',
      turns: '3',
      expiresAt: lease?.expiresAt ?? '',
      auditRef: lease?.auditRef ?? '',
    })))).toBe(true)
    expect(auditCount('permission_lease_granted')).toBe(1)
    expect(auditCalls.find((c) => c.tool === 'permission_lease_granted')?.input.grantor).toBe('repl-command')
  })
})

describe('② 裸命令:无租约 ⇒ 明写"未授予(默认档)",且不创建租约', () => {
  it('打印未授予文案;activePermissionLease() 仍为 null、审计零增长', () => {
    // 文案必须真解析得出(键丢失时 t() 回显键名 —— 那等于"未授予"这句话根本没打印)
    expect(t('cliEntry.replLeaseNone')).not.toBe('cliEntry.replLeaseNone')
    handleLease(state, [])
    expect(emitted.some((l) => l.includes(t('cliEntry.replLeaseNone')))).toBe(true)
    expect(activePermissionLease()).toBeNull()
    expect(auditCount('permission_lease_granted')).toBe(0)
  })

  it('有生效租约时裸命令打印 scope/剩余/轮次/auditRef(不把租约重授一遍)', () => {
    handleLease(state, ['grep', '--ttl=2', '--turns=2'])
    const lease = activePermissionLease()
    expect(lease).not.toBeNull()
    emitted = []
    handleLease(state, [])
    const line = emitted.find((l) => l.includes('cli-repl:lease-test-session'))
    expect(line).toBeDefined()
    expect(line).toContain(lease?.auditRef ?? '<<none>>')
    expect(activePermissionLease()).toBe(lease)
    expect(auditCount('permission_lease_granted')).toBe(1)
  })

  it('在位但已过期的租约 ⇒ 裸命令明写"已失效"并带 auditRef(不静默读成"未授予")', () => {
    // 经唯一构造出口直接造一份"已过期但仍在位"的租约(nowMs 在过去):
    // 这是 activePermissionLease() 非 null 而活性判据为 false 的合法形态,
    // 查看态必须把它与"从未授予"分开 —— 否则审计引用就凭空消失了。
    const past = Date.now() - 120_000
    const expired = grantPermissionLease({
      scope: 'cli-repl:lease-test-session',
      capabilities: ['grep'],
      grantor: 'repl-command',
      ttlMs: 60_000,
      expiresAfterTurns: 5,
      nowMs: past,
    })
    expect(activePermissionLease()).toBe(expired)
    emitted = []
    handleLease(state, [])
    expect(
      emitted.some((l) => l.includes(t('cliEntry.replLeaseExpired', { auditRef: expired.auditRef }))),
    ).toBe(true)
    expect(emitted.some((l) => l.includes(t('cliEntry.replLeaseNone')))).toBe(false)
  })
})

describe('③ `/lease off`:立即撤销并回显审计引用', () => {
  it('撤销后 activePermissionLease()===null,输出带原 auditRef,落一条 revoked 审计', () => {
    handleLease(state, ['write_file'])
    const lease = activePermissionLease()
    expect(lease).not.toBeNull()
    emitted = []
    handleLease(state, ['off'])
    expect(activePermissionLease()).toBeNull()
    expect(emitted.some((l) => l.includes(t('cliEntry.replLeaseRevoked', { auditRef: lease?.auditRef ?? '' })))).toBe(true)
    expect(auditCount('permission_lease_revoked')).toBe(1)
  })

  it('无租约时 off ⇒ 明写"没有可撤销的",不抛错也不造审计', () => {
    handleLease(state, ['off'])
    expect(emitted.some((l) => l.includes(t('cliEntry.replLeaseNothingToRevoke')))).toBe(true)
    expect(auditCount('permission_lease_revoked')).toBe(0)
  })
})

describe('④ 非法输入:打印拒因,当前租约状态逐字不变', () => {
  it.each([
    ['通配 *', ['*']],
    ['未知 flag', ['--dangerous=1']],
    ['只有 flag 无工具清单', ['--ttl=5']],
    ['叠租约(已有一份在生效)', ['grep', '--ttl=30']],
  ])('%s ⇒ 拒因一行 + 原租约同一对象原字段', (_label, args) => {
    handleLease(state, ['write_file,git_commit', '--ttl=10', '--turns=2'])
    const before = activePermissionLease()
    expect(before).not.toBeNull()
    const snapshot = {
      scope: before?.scope,
      auditRef: before?.auditRef,
      expiresAt: before?.expiresAt,
      capabilities: [...(before?.capabilities ?? [])],
      expiresAfterTurns: before?.expiresAfterTurns,
    }
    const grantsBefore = auditCount('permission_lease_granted')
    const revokesBefore = auditCount('permission_lease_revoked')
    emitted = []
    handleLease(state, args)
    const after = activePermissionLease()
    expect(after).toBe(before) // 同一引用:没有被清空、也没有被替换
    expect(after?.scope).toBe(snapshot.scope)
    expect(after?.auditRef).toBe(snapshot.auditRef)
    expect(after?.expiresAt).toBe(snapshot.expiresAt)
    expect(after?.capabilities).toEqual(snapshot.capabilities)
    expect(after?.expiresAfterTurns).toBe(snapshot.expiresAfterTurns)
    expect(auditCount('permission_lease_granted')).toBe(grantsBefore)
    expect(auditCount('permission_lease_revoked')).toBe(revokesBefore)
    expect(emitted.length).toBeGreaterThan(0)
    const invalidText = t('cliEntry.replLeaseInvalid', { reason: '' })
    expect(emitted.some((l) => l.includes(invalidText))).toBe(true)
  })

  it('`/lease off` 带多余参数 ⇒ 同样只打印拒因,不撤销', () => {
    handleLease(state, ['write_file'])
    const before = activePermissionLease()
    emitted = []
    handleLease(state, ['off', 'extra'])
    expect(activePermissionLease()).toBe(before)
    expect(auditCount('permission_lease_revoked')).toBe(0)
  })
})

describe('⑤ 结构锁:repl.ts 源码面必须真有唯一构造出口的调用点', () => {
  function stripComments(text: string): string {
    return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
  }

  it('grantPermissionLease( 与 revokePermissionLease( 的调用(非 import 行、非注释)在位', () => {
    const src = stripComments(
      readFileSync(fileURLToPath(new URL('../src/commands/repl.ts', import.meta.url)), 'utf8'),
    )
    // import 面列的是不带括号的标识符;带 `(` 的只能是调用
    expect(src).toContain('grantPermissionLease(')
    expect(src).toContain('revokePermissionLease(')
    expect(src).toContain("grantor: 'repl-command'")
    // 前缀与 cli-flag 档(`cli-agent:`)必须不同名,否则审计里两档授予无法区分
    expect(src).toContain('cli-repl:')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
