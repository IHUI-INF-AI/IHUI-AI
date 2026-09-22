// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 权限模式唯一真源(G-161)断言:拼写可以多样,存储值只能有一种。
import { describe, expect, it } from 'vitest'

import {
  PERMISSION_MODES,
  isReadonlyPermissionMode,
  normalizePermissionMode,
  permissionModeKey,
  permissionModePolicy,
  skipsApprovalPermissionMode,
} from '../src/permission-mode'

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
