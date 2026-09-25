// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 行为回归:子代理派生点的权限档(现状刻画 + 修复后的不变量)
//
// 为什么这张表存在(2026-09-26,实现票取证):
//   派单书给的锚点是 `apps/cli/src/subagents/spawn-subagent.ts:164-169` 与
//   `subagent-registry.ts:153-158` 的 `permissionMode: 'bypassPermissions'` 默认值。
//   逐条开文件核对的结果:**这两个路径在本仓不存在**(工作树 + 索引 + HEAD 三处都查过),
//   且 `bypassPermissions` 在 `apps/cli/src/**` 里作为**默认值/写死档位**出现 0 处。
//   真实缺陷是反方向的另一格:派生点**整个不传**权限档与权限规则,子代理落到运行期兜底档
//   `default`,而父会话用 `--disallowed-tools` 立的显式 deny 规则**不会**跟着下去。
//
// 所以本文件不写"修好之后才成立"的断言(那会是一台红测试),而是把**当前真值**与
// **修复后必须仍成立**的下界同时钉住:
//   ① 子代理当前不是 bypassPermissions —— 写/危险工具一律落到 `ask`;
//   ② 规则一旦被丢,显式 deny 就查不到(`undefined` 规则面 vs 传下来的规则面,结论必须不同)
//      —— 这一条就是"为什么必须继承 permissions"的可执行理由;
//   ③ 无人可问时 danger gate 必须拒(fail-closed),`--allow-dangerous` 才是唯一的 flag 放行路;
//   ④ 修复不得把默认档抬高:`normalizePermissionMode(undefined)` 与运行期兜底档仍须是 default。
// 守门 `scripts/check-subagent-permission-inherited.mjs` 管静态面(派生点有没有真的下传),
// 本文件管语义面(下传之后判定矩阵算得对不对),两者不重叠。

import { describe, expect, it } from 'vitest'
import {
  checkPermission,
  mapCliModeToBackendMode,
  parsePermissionMode,
  type PermissionMode,
} from '../src/tools/permissions.js'
import { createDangerGate, type DangerGateDecision } from '../src/tools/danger-gate.js'
import type { Tool } from '../src/tools/index.js'

const fakeTool = (name: string): Tool =>
  ({
    name,
    description: `${name} 的测试夹具`,
    parameters: {},
    required: [],
    dangerLevel: 'write',
    execute: async () => ({ success: true, output: '' }),
  }) as unknown as Tool

describe('子代理权限档:当前落点(取证结论的可执行版)', () => {
  it('子代理既不是 bypassPermissions 也不是 plan —— 未传档时写/危险工具一律落到 ask', () => {
    // 派生点(subagent.ts:363 / worker-entry.ts:195)不下传档位,运行期取 `?? 'default'`
    const undef = undefined as unknown as PermissionMode
    expect(checkPermission('read_file', undefined, undef ?? 'default', 'read')).toBe('allow')
    expect(checkPermission('delete_file', undefined, undef ?? 'default', 'write')).toBe('ask')
    expect(checkPermission('run_command', undefined, undef ?? 'default', 'dangerous')).toBe('ask')
    // 反证:指控"默认绕过权限闸"若成立,下面这两条才会是 allow
    expect(checkPermission('delete_file', undefined, 'bypassPermissions', 'write')).toBe('allow')
    expect(checkPermission('delete_file', undefined, 'bypassPermissions', 'write')).not.toBe(
      checkPermission('delete_file', undefined, undef ?? 'default', 'write'),
    )
  })

  it('规则不被下传时,父会话的显式 deny 就查不到(这一格才是要修的洞)', () => {
    const parentRules = { deny: ['delete_file'] }
    // 传下来 ⇒ deny 生效
    expect(checkPermission('delete_file', parentRules, 'default', 'write')).toBe('deny')
    // 派生点当前的做法:`permissions` 整个不下传 ⇒ 同一把禁令问不出同一个答案
    expect(checkPermission('delete_file', undefined, 'default', 'write')).toBe('ask')
    // 两条必须不同形 —— 不同形本身就是"规则丢在派生点"的证据
    expect(checkPermission('delete_file', undefined, 'default', 'write')).not.toBe(
      checkPermission('delete_file', parentRules, 'default', 'write'),
    )
  })

  it('ask 落到 danger gate:无人可问 ⇒ 拒(fail-closed),只有 --allow-dangerous 这一条 flag 路能放', async () => {
    const tool = fakeTool('delete_file')
    const routes: DangerGateDecision[] = []
    const noPrompt = createDangerGate({ silent: true, onDecision: (d) => routes.push(d) })
    expect(await noPrompt(tool, {})).toBe(false)
    expect(routes[0]?.route).toBe('denied')
    expect(routes[0]?.cause).toBe('no-prompt')

    const declined = createDangerGate({ silent: true, prompt: async () => undefined })
    expect(await declined(tool, {})).toBe(false)

    // 子代理把父进程的 allowDangerous 一起带下去了 ⇒ flag 路放行,
    // 这正是"规则没下传时用户禁令被绕过"的那一步(修复票要收的是规则下传,不是这条放行)。
    const flagged = createDangerGate({ allowDangerous: true, silent: true, onDecision: (d) => routes.push(d) })
    expect(await flagged(tool, {})).toBe(true)
    expect(routes.at(-1)?.route).toBe('flag')
  })
})

describe('子代理权限档:继承修复不得改动的语义下界', () => {
  it('未识别/空档位一律解析成 undefined,由调用方兜到 default(继承实现不得偷偷升档)', () => {
    expect(parsePermissionMode(undefined)).toBeUndefined()
    expect(parsePermissionMode('')).toBeUndefined()
    expect(parsePermissionMode('not-a-mode')).toBeUndefined()
    expect(parsePermissionMode('bypass-permissions')).toBe('bypassPermissions')
    expect(parsePermissionMode('accept-all')).toBe('bypassPermissions')
    expect(mapCliModeToBackendMode('bypassPermissions')).toBe('bypassPermissions')
  })

  it('五档矩阵逐格钉死:继承之后只允许"父是什么档就是什么档",不得出现新的免批面', () => {
    const table: Array<[PermissionMode, 'allow' | 'ask' | 'deny', 'allow' | 'ask' | 'deny', 'allow' | 'ask' | 'deny']> = [
      ['default', 'allow', 'ask', 'ask'],
      ['acceptEdits', 'allow', 'allow', 'ask'],
      ['bypassPermissions', 'allow', 'allow', 'allow'],
      ['plan', 'allow', 'deny', 'deny'],
      ['manual', 'ask', 'ask', 'ask'],
    ]
    for (const [mode, read, write, dangerous] of table) {
      expect(checkPermission('x', undefined, mode, 'read')).toBe(read)
      expect(checkPermission('x', undefined, mode, 'write')).toBe(write)
      expect(checkPermission('x', undefined, mode, 'dangerous')).toBe(dangerous)
    }
    // plan 档的存在就是"父档可能比兜底档更严"的证据 ⇒ 不继承 = 静默升档
    expect(checkPermission('x', undefined, 'plan', 'write')).toBe('deny')
    expect(checkPermission('x', undefined, 'default', 'write')).toBe('ask')
  })

  it('规则优先级高于档位(继承两层时不得互相顶替)', () => {
    const rules = { allow: ['read_file'], deny: ['run_command'], ask: ['edit_file'] }
    expect(checkPermission('run_command', rules, 'bypassPermissions', 'dangerous')).toBe('deny')
    expect(checkPermission('edit_file', rules, 'bypassPermissions', 'write')).toBe('ask')
    expect(checkPermission('other_tool', rules, 'bypassPermissions', 'read')).toBe('deny')
    expect(checkPermission('read_file', rules, 'manual', 'read')).toBe('allow')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
