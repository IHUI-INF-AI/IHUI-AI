// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * 「被拒」的可诊断化回归(本票判据 ①–⑤;86E 追加 ⑥ 防回潮锁)。
 *
 * 全部用例驱动生产入口 `executeToolCall`,钉的是:
 *  ① fail-closed 回归锁 —— 无确认出口时**仍然必须拒**(本票只改"怎么说",不改"是否放");
 *  ② 三态在返回体可区分 —— `denial.gate` × `denial.decider`,且漂移支报"旧批准失效"而非"从未批准";
 *  ③ 无头拒绝确有审计落盘(vi.mock 截 `auditLog`,不另立通道),含闸种类与工具名;
 *  ④ 错误串与结构化字段**不含**被批准内容明文与凭据(假 token 阳性对照)+ 指纹独立复算;
 *  ⑤ 出路提示摘掉即红 —— guidance 逐闸点名真实出口(--permission-lease / confirmDangerous / --tools)。
 */
// 86E:此处 createHash 只做两件事 —— ④ 的"独立复算"对照(拿 node:crypto 验共享层纯 JS
// SHA-256 的字节等值)与 ⑥ 的旧形态正反对照;被审的 src 面已不再自算(见 ⑥ 源码锁)。
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/audit.js', () => ({
  auditLog: vi.fn(),
  queryAuditLog: vi.fn(() => ({ entries: [], total: 0, filtered: 0 })),
}))

import { auditLog } from '../src/audit.js'
import { clearTools, executeToolCall, registerTools, resetRateLimiter, type Tool } from '../src/tools/index.js'
import { grantPermissionLease, resetPermissionLeaseForTests } from '../src/tools/permission-lease.js'
import { TOOL_DENIAL_AUDIT_EVENT, digestToolArgs } from '../src/utils/tool-denial.js'

const WS = 'G:/IHUI-AI/apps/cli'
const APPROVED = { path: 'src/a.ts', text: 'approved-content' }
const DRIFTED = { path: 'src/a.ts', text: 'changed-after-approval' }

function makeTool(name: string, dangerLevel?: 'read' | 'write' | 'dangerous'): Tool {
  return {
    name,
    description: 'test tool',
    parameters: { type: 'object', properties: {} },
    required: [],
    dangerLevel,
    execute: vi.fn(async () => ({ success: true, output: 'ok' })),
  } as unknown as Tool
}

function denialAuditEntries(): Array<Record<string, unknown>> {
  return vi
    .mocked(auditLog)
    .mock.calls.map((c) => c[0] as unknown as Record<string, unknown>)
    .filter((e) => e.tool === TOOL_DENIAL_AUDIT_EVENT)
}

beforeEach(() => {
  clearTools()
  resetRateLimiter()
  resetPermissionLeaseForTests()
  vi.mocked(auditLog).mockClear()
})

afterEach(() => {
  resetPermissionLeaseForTests()
})

function grantDigestLease() {
  grantPermissionLease({
    scope: 'goal:denial-diagnostics',
    capabilities: ['write_file'],
    grantor: 'goal-mode',
    ttlMs: 10 * 60_000,
    maxCalls: 20,
    workspaceId: WS,
    digestDeclarations: { write_file: [JSON.stringify(APPROVED)] },
  })
}

describe('① fail-closed 回归锁:无确认出口必须拒(本票不得改成"绕")', () => {
  it('dangerous 工具 + 无 confirmDangerous ⇒ 拒,handler 一次都没被调用', async () => {
    const tool = makeTool('nuke_cache', 'dangerous')
    registerTools([tool])
    const r = await executeToolCall(
      { name: 'nuke_cache', arguments: { scope: 'all' } },
      { workspacePath: WS },
    )
    expect(r.success).toBe(false)
    expect(tool.execute).not.toHaveBeenCalled()
    expect(r.errorType).toBe('permission_denied')
    expect(r.denial?.gate).toBe('dangerous-gate')
    expect(r.denial?.decider).toBe('no-confirmation-channel')
    // 原中文短句逐字保留(只追加,不改写)
    expect(String(r.error)).toContain('危险操作被拒绝(需用户确认): nuke_cache')
  })

  it('披露位 ctx.allowDangerous=true 而无回调 ⇒ 仍拒(影子字段不参与判定)', async () => {
    const tool = makeTool('nuke_cache', 'dangerous')
    registerTools([tool])
    const r = await executeToolCall(
      { name: 'nuke_cache', arguments: { scope: 'all' } },
      { workspacePath: WS, allowDangerous: true },
    )
    expect(r.success).toBe(false)
    expect(tool.execute).not.toHaveBeenCalled()
  })

  it('权限规则黑名单 ⇒ 拒且带 gate=permission-rule / decider=rule-deny', async () => {
    const tool = makeTool('nuke_cache', 'write')
    registerTools([tool])
    const r = await executeToolCall(
      { name: 'nuke_cache', arguments: { scope: 'all' } },
      { workspacePath: WS, permissions: { deny: ['nuke_cache'] } },
    )
    expect(r.success).toBe(false)
    expect(tool.execute).not.toHaveBeenCalled()
    expect(r.errorType).toBe('permission_denied')
    expect(r.denial?.gate).toBe('permission-rule')
    expect(r.denial?.decider).toBe('rule-deny')
  })
})

describe('② 三态可区分 + 漂移支的措辞边界', () => {
  it('摘要漂移且无确认出口 ⇒ 报"旧批准失效",不得出现"从未批准"', async () => {
    grantDigestLease()
    const tool = makeTool('write_file', 'write')
    registerTools([tool])
    const r = await executeToolCall(
      { name: 'write_file', arguments: DRIFTED },
      { workspacePath: WS, permissions: { ask: ['write_file'] } },
    )
    expect(r.success).toBe(false)
    expect(tool.execute).not.toHaveBeenCalled()
    expect(String(r.error)).toContain('旧批准失效')
    expect(String(r.error)).not.toContain('从未批准')
    expect(r.denial?.gate).toBe('lease-digest-drift')
    expect(r.denial?.decider).toBe('no-confirmation-channel')
    expect(r.denial?.guidance).toMatch(/old approval is void/i)
    expect(r.denial?.guidance).toMatch(/NOT "never approved"/)
  })

  it('漂移 + 有回调但被拒 ⇒ decider=user-declined(与"无出口"可区分)', async () => {
    grantDigestLease()
    const tool = makeTool('write_file', 'write')
    registerTools([tool])
    const confirm = vi.fn(async () => false)
    const r = await executeToolCall(
      { name: 'write_file', arguments: DRIFTED },
      { workspacePath: WS, permissions: { ask: ['write_file'] }, confirmDangerous: confirm },
    )
    expect(r.success).toBe(false)
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(r.denial?.gate).toBe('lease-digest-drift')
    expect(r.denial?.decider).toBe('user-declined')
  })
})

describe('③ 审计:无头拒绝确有落盘,人拒绝与放行不产该记录', () => {
  it('无头 dangerous 拒绝 ⇒ 一条 tool_call_denied,含闸种类/工具名/指纹', async () => {
    const tool = makeTool('nuke_cache', 'dangerous')
    registerTools([tool])
    await executeToolCall({ name: 'nuke_cache', arguments: { scope: 'all' } }, { workspacePath: WS })
    const entries = denialAuditEntries()
    expect(entries).toHaveLength(1)
    const input = entries[0]!.input as Record<string, unknown>
    expect(input.toolName).toBe('nuke_cache')
    expect(input.gate).toBe('dangerous-gate')
    expect(input.decider).toBe('no-confirmation-channel')
    expect(String(input.argsFingerprint)).toMatch(/^args-sha256-v1-[0-9a-f]{64}$/)
  })

  it('规则拒绝也落一条;user-declined 与放行路径都不落', async () => {
    registerTools([makeTool('nuke_cache', 'dangerous')])
    await executeToolCall(
      { name: 'nuke_cache', arguments: {} },
      { workspacePath: WS, permissions: { deny: ['nuke_cache'] } },
    )
    expect(denialAuditEntries()).toHaveLength(1)

    const confirmDecline = vi.fn(async () => false)
    await executeToolCall(
      { name: 'nuke_cache', arguments: {} },
      { workspacePath: WS, confirmDangerous: confirmDecline },
    )
    expect(denialAuditEntries()).toHaveLength(1)

    const confirmApprove = vi.fn(async () => true)
    const ok = await executeToolCall(
      { name: 'nuke_cache', arguments: {} },
      { workspacePath: WS, confirmDangerous: confirmApprove },
    )
    expect(ok.success).toBe(true)
    expect(denialAuditEntries()).toHaveLength(1)
  })
})

describe('④ 隐私:摘要只落指纹与键名,值与凭据绝不进错误串/字段/审计', () => {
  const SECRET_ARGS = {
    command: 'run-secret-verb && export API_KEY=IHUIFAKETOKEN-9f3a secret-value-42',
    note: 'note-secret-chinese-应永远不会出现',
  }

  it('假 token 阳性对照:结果整体不含明文,含指纹;指纹独立复算等值且随内容变', async () => {
    registerTools([makeTool('nuke_cache', 'dangerous')])
    const r = await executeToolCall({ name: 'nuke_cache', arguments: SECRET_ARGS }, { workspacePath: WS })
    const serialized = JSON.stringify(r)
    expect(r.success).toBe(false)
    expect(serialized).not.toContain('IHUIFAKETOKEN-9f3a')
    expect(serialized).not.toContain('secret-value-42')
    expect(serialized).not.toContain('run-secret-verb')
    expect(serialized).not.toContain('note-secret-chinese')
    // 键名允许(结构信息),值绝不允许
    expect(r.denial?.args.keys).toEqual(['command', 'note'])
    // 独立实现复算(不是"和实现自己比"的恒真式):本测试自带"键排序后序列化 + node:crypto"。
    // 共享层纯 JS SHA-256 与 node:crypto 的逐字节等值由 packages/shared 侧专测钉住;
    // SECRET_ARGS 的扁平对象在此形态下与共享层 canonical 预像逐字节同形。
    const canonical = JSON.stringify(
      Object.fromEntries(Object.entries(SECRET_ARGS).sort(([a], [b]) => (a < b ? -1 : 1))),
    )
    const expected = `args-sha256-v1-${createHash('sha256').update(canonical, 'utf8').digest('hex')}`
    expect(r.denial?.args.fingerprint).toBe(expected)
    expect(digestToolArgs({ command: 'different' } as Record<string, unknown>).fingerprint).not.toBe(
      r.denial?.args.fingerprint,
    )
    // 审计行同样只有指纹+键名
    const auditRow = denialAuditEntries()[0]!.input as Record<string, unknown>
    expect(JSON.stringify(auditRow)).not.toContain('IHUIFAKETOKEN-9f3a')
  })
})

describe('⑤ 出路提示是有牙的锁:摘掉 guidance(置空)即红;逐闸必须点名真实出口', () => {
  it('dangerous 无出口 ⇒ 点名交互终端 / ctx.confirmDangerous,并明写无 env 旁路', async () => {
    registerTools([makeTool('nuke_cache', 'dangerous')])
    const r = await executeToolCall({ name: 'nuke_cache', arguments: {} }, { workspacePath: WS })
    expect(r.denial?.guidance.length ?? 0).toBeGreaterThan(0)
    expect(r.denial?.guidance).toMatch(/interactive/)
    expect(r.denial?.guidance).toMatch(/confirmDangerous/)
    expect(r.denial?.guidance).toMatch(/NO environment-variable bypass/)
    expect(String(r.error)).toContain('[ihui-denial')
  })

  it('lease 漂移 ⇒ 点名 --permission-lease / REPL /lease 再授权出口', async () => {
    grantDigestLease()
    registerTools([makeTool('write_file', 'write')])
    const r = await executeToolCall(
      { name: 'write_file', arguments: DRIFTED },
      { workspacePath: WS, permissions: { ask: ['write_file'] } },
    )
    expect(r.denial?.guidance).toMatch(/--permission-lease/)
    expect(r.denial?.guidance).toMatch(/\/lease/)
  })

  it('权限规则拒 ⇒ 点名 --tools / --disallowed-tools,并明写租约救不了这一闸', async () => {
    registerTools([makeTool('nuke_cache', 'write')])
    const r = await executeToolCall(
      { name: 'nuke_cache', arguments: {} },
      { workspacePath: WS, permissions: { deny: ['nuke_cache'] } },
    )
    expect(r.denial?.guidance).toMatch(/--tools/)
    expect(r.denial?.guidance).toMatch(/--disallowed-tools/)
    expect(r.denial?.guidance).toMatch(/never relaxes this gate/)
  })
})

/* ------------------------------------------------------------------ *
 * ⑥ 86E 源码级防回潮锁 —— 入参摘要只许走共享唯一出口
 * ------------------------------------------------------------------ */

/**
 * 遮噪状态机:`stripComments(text, false)` 剥注释、保留字符串(认 import 说明符要用这面);
 * `stripComments(text, true)` 连字符串一起抹(认"有没有真调用/自算形态"要用这面 ——
 * 注释与字符串里的提及不算装车,也反过来不给自己发合格证)。
 * 已知上限:模板串整段抹除,`${}` 内的标识符同遮;对本锁的两维(说明符 / createHash)不构成误伤。
 */
function stripComments(text: string, alsoStripStrings: boolean): string {
  let out = ''
  let i = 0
  while (i < text.length) {
    const c = text[i]!
    const n = text[i + 1]
    if (c === '/' && n === '/') {
      while (i < text.length && text[i] !== '\n') i++
      continue
    }
    if (c === '/' && n === '*') {
      i += 2
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++
      i += 2
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      const start = i
      const quote = c
      i++
      while (i < text.length && text[i] !== quote) {
        if (text[i] === '\\') i++
        i++
      }
      i++
      // 保留模式必须原样带走字符串内容(否则 import 说明符被抹成空引号,本锁自己先失明);
      // 遮罩模式才收成空引号。两向各由上面的装车/反向用例钉住。
      out += alsoStripStrings ? '""' : text.slice(start, i)
      continue
    }
    out += c
    i++
  }
  return out
}

describe('⑥ 86E 防回潮锁:入参摘要只能走共享唯一出口,端内不得再自算', () => {
  const raw = readFileSync(new URL('../src/utils/tool-denial.ts', import.meta.url), 'utf8')

  it('装车证明:说明符指到唯一出口,且代码面真的调用 digestToolArgsStructure', () => {
    const codeKeepStrings = stripComments(raw, false)
    expect(codeKeepStrings).toMatch(/from ['"]@ihui\/shared\/utils\/tool-args-digest['"]/)
    const codeMasked = stripComments(raw, true)
    expect(codeMasked).toMatch(/\bdigestToolArgsStructure\s*\(/)
  })

  it('反向锁:createHash / node:crypto 以任何形态回来都判红(旧缺陷正是端内自算摘要)', () => {
    const codeMasked = stripComments(raw, true)
    expect(codeMasked).not.toMatch(/\bcreateHash\b/)
    expect(codeMasked).not.toMatch(/node:crypto/)
  })

  it('缺陷正反例:键序打乱 ⇒ 旧自算形态换指纹、新出口不变;取值变化 ⇒ 新出口必换指纹', () => {
    const one = { command: 'ls', cwd: '/tmp' }
    const shuffled = { cwd: '/tmp', command: 'ls' }
    // 旧端内形态的逐字复刻(JSON.stringify 不归一键序 + 截 12 位),只作为**对照**存在,
    // 它不是第二份实现 —— 被测面已经接进共享出口,这里量的是"缺陷确实被消除"。
    const legacy = (v: Record<string, unknown>): string =>
      `sha256:${createHash('sha256').update(JSON.stringify(v ?? null), 'utf8').digest('hex').slice(0, 12)}`
    expect(legacy(one)).not.toBe(legacy(shuffled)) // 旧形态在这对输入上指纹分裂(本票立论)
    expect(digestToolArgs(one).fingerprint).toBe(digestToolArgs(shuffled).fingerprint) // 新形态归一
    // 键序归一≠取值归一:改任一取值必须换指纹,否则"同一件事"判据被打穿
    expect(digestToolArgs({ command: 'rm -rf /', cwd: '/tmp' }).fingerprint).not.toBe(
      digestToolArgs(one).fingerprint,
    )
  })
})
