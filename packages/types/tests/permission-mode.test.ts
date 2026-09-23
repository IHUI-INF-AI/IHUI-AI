// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 权限模式唯一真源(G-161)断言:拼写可以多样,存储值只能有一种。
import { describe, expect, it } from 'vitest'

import {
  PERMISSION_MODES,
  PERMISSION_MODE_PERSISTABLE_IDS,
  PERMISSION_MODE_WIRE,
  PERMISSION_MODE_WIRE_VALUES,
  isReadonlyPermissionMode,
  normalizePermissionMode,
  permissionModeDisplayKey,
  permissionModeId,
  permissionModeKey,
  permissionModePolicy,
  permissionModeWire,
  skipsApprovalPermissionMode,
} from '../src/permission-mode'

describe('PERMISSION_MODE_PERSISTABLE_IDS / permissionModeId(派生清单,消 Object.values(Partial) 的 undefined)', () => {
  it('派生集合恰为 4 档(漏一档 = 该档落库语义静默掉出清单)', () => {
    expect(PERMISSION_MODE_PERSISTABLE_IDS).toHaveLength(4)
  })

  it('与 wire 值域同射:每个派生档都有 wire 映射,映射像与 PERMISSION_MODE_WIRE_VALUES 互为子集(双射)', () => {
    const wires = PERMISSION_MODE_PERSISTABLE_IDS.map((id) => PERMISSION_MODE_WIRE[id])
    for (const wire of wires) expect(wire).toBeDefined()
    const wireSet = new Set(wires)
    expect(wireSet.size).toBe(4) // 不同档的 wire 互不相同(同射)
    for (const wire of PERMISSION_MODE_WIRE_VALUES) expect(wireSet.has(wire)).toBe(true)
    for (const wire of wireSet)
      expect(PERMISSION_MODE_WIRE_VALUES as readonly string[]).toContain(wire)
  })

  it('manual 无落库语义 → 不在派生清单内', () => {
    expect(PERMISSION_MODE_PERSISTABLE_IDS).not.toContain('manual')
    expect(PERMISSION_MODE_PERSISTABLE_IDS).toEqual(
      PERMISSION_MODES.filter((id) => PERMISSION_MODE_WIRE[id] !== undefined),
    )
  })

  it('permissionModeId 是 normalizePermissionMode 的具名别名,行为逐输入一致', () => {
    expect(permissionModeId).toBe(normalizePermissionMode)
    for (const raw of ['accept-edits', 'acceptEdits', 'auto', 'manual', 'yolo', 42, null]) {
      expect(permissionModeId(raw)).toBe(normalizePermissionMode(raw))
    }
    expect(permissionModeId('accept-edits')).toBe('acceptEdits')
    expect(permissionModeId('manual')).toBe('manual') // 有规范档语义,只是不可落库
  })
})

describe('permissionModeWire(G-164:跨界只走 wire,判定只走规范档)', () => {
  it('任意拼写都落到 workspace 的 kebab 拼写', () => {
    expect(permissionModeWire('acceptEdits')).toBe('accept-edits')
    expect(permissionModeWire('accept-edits')).toBe('accept-edits')
    expect(permissionModeWire('auto')).toBe('accept-edits')
    expect(permissionModeWire('bypassPermissions')).toBe('bypass-permissions')
    expect(permissionModeWire('accept-all')).toBe('bypass-permissions')
    expect(permissionModeWire('read-only')).toBe('plan')
    expect(permissionModeWire('plan')).toBe('plan')
  })

  it('manual 没有落库语义 → wire 为 null(调用方必须显式处理,不能静默落库)', () => {
    expect(permissionModeWire('manual')).toBeNull()
    expect(permissionModeWire('yolo')).toBeNull()
  })

  it('wire 值域 ⊆ 历史 kebab 集合(不会把 camel 写进 DB 打破既有行)', () => {
    const wires = Object.values(PERMISSION_MODE_WIRE)
    for (const w of wires) {
      expect(['default', 'plan', 'accept-edits', 'bypass-permissions']).toContain(w)
    }
  })
})

describe('permissionModeDisplayKey(D111 展示档键,三端共用)', () => {
  it('未配置(null/undefined)如实显示为 default(未配置的生效行为就是默认档)', () => {
    expect(permissionModeDisplayKey(null)).toBe('default')
    expect(permissionModeDisplayKey(undefined)).toBe('default')
  })

  it('历史/跨端拼写归一到 wire 键(与 workspace.permission.mode.* 词表键一致)', () => {
    expect(permissionModeDisplayKey('default')).toBe('default')
    expect(permissionModeDisplayKey('plan')).toBe('plan')
    expect(permissionModeDisplayKey('acceptEdits')).toBe('accept-edits')
    expect(permissionModeDisplayKey('accept-edits')).toBe('accept-edits')
    expect(permissionModeDisplayKey('bypass-permissions')).toBe('bypass-permissions')
  })

  it('认不出的值 → unknown,绝不静默显示成 default(高危档被显示成默认=授权误导)', () => {
    expect(permissionModeDisplayKey('yolo')).toBe('unknown')
    expect(permissionModeDisplayKey('')).toBe('unknown')
    expect(permissionModeDisplayKey('accept-all-x')).toBe('unknown')
  })
})

describe('normalizePermissionMode', () => {
  it('规范成员恒等归一', () => {
    for (const mode of PERMISSION_MODES) {
      expect(normalizePermissionMode(mode)).toBe(mode)
    }
  })

  it('kebab 与 camel 拼写落到同一档(web 发 kebab、cli 发 camel,过去各说各话)', () => {
    expect(normalizePermissionMode('accept-edits')).toBe('acceptEdits')
    expect(normalizePermissionMode('acceptEdits')).toBe('acceptEdits')
    expect(normalizePermissionMode('bypass-permissions')).toBe('bypassPermissions')
    expect(normalizePermissionMode('bypassPermissions')).toBe('bypassPermissions')
  })

  it('历史/文档拼写有明确去处,不再 500 也不再被静默丢弃', () => {
    expect(normalizePermissionMode('auto')).toBe('acceptEdits')
    expect(normalizePermissionMode('read-only')).toBe('plan')
    expect(normalizePermissionMode('plan-only')).toBe('plan')
    expect(normalizePermissionMode('accept-all')).toBe('bypassPermissions')
  })

  it('认不出返回 null,不回退 default(回退=让用户以为高档生效)', () => {
    expect(normalizePermissionMode('yolo-mode')).toBeNull()
    expect(normalizePermissionMode('')).toBeNull()
    expect(normalizePermissionMode('   ')).toBeNull()
    expect(normalizePermissionMode(undefined)).toBeNull()
    expect(normalizePermissionMode(null)).toBeNull()
    expect(normalizePermissionMode(42)).toBeNull()
  })

  it('归一化只做精确查表,不做模糊匹配(少一个字母就是非法值)', () => {
    expect(normalizePermissionMode('bypass-permission')).toBeNull()
    expect(normalizePermissionMode('accept-edit')).toBeNull()
  })

  it('大小写不敏感,但只在同一语义集内(与 HTTP 枚举惯例一致)', () => {
    expect(normalizePermissionMode('PLAN')).toBe('plan')
    expect(normalizePermissionMode('BypassPermissions')).toBe('bypassPermissions')
    expect(normalizePermissionMode('ACCEPT-EDITS')).toBe('acceptEdits')
  })
})

describe('权限档语义(供审批门与表现层共用同一口径)', () => {
  it('只有 plan 档是只读约束', () => {
    for (const mode of PERMISSION_MODES) {
      expect(isReadonlyPermissionMode(mode)).toBe(mode === 'plan')
    }
  })

  it('免审批只覆盖 acceptEdits / bypassPermissions 两档', () => {
    expect(PERMISSION_MODES.filter((m) => skipsApprovalPermissionMode(m))).toEqual([
      'acceptEdits',
      'bypassPermissions',
    ])
  })

  it('档位策略表逐项锁定(default/manual 询问,两档免批,plan 只读)', () => {
    expect(permissionModePolicy('default')).toBe('ask')
    expect(permissionModePolicy('manual')).toBe('ask')
    expect(permissionModePolicy('acceptEdits')).toBe('auto-approve-safe')
    expect(permissionModePolicy('bypassPermissions')).toBe('auto-approve-all')
    expect(permissionModePolicy('plan')).toBe('readonly')
  })
})

describe('permissionModeKey', () => {
  it('camelCase 拆成 kebab 并小写', () => {
    expect(permissionModeKey('acceptEdits')).toBe('accept-edits')
    expect(permissionModeKey('BypassPermissions')).toBe('bypass-permissions')
    expect(permissionModeKey('  Plan  ')).toBe('plan')
  })

  it('每个成员都能经自身归一化键解回(守门 R2 的同源判据)', () => {
    for (const mode of PERMISSION_MODES) {
      expect(normalizePermissionMode(permissionModeKey(mode))).toBe(mode)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
