// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import {
  APPROVAL_POLICIES,
  APPROVAL_POLICY_ALIASES,
  APPROVAL_POLICY_DEFAULT,
  APPROVAL_PRESETS,
  APPROVAL_PRESET_IDS,
  GRANULAR_APPROVAL_KEYS,
  PERMISSION_MODE_TO_AXIS,
  SANDBOX_MODES,
  SANDBOX_MODE_ALIASES,
  SANDBOX_MODE_DEFAULT,
  normalizeApprovalPolicy,
  normalizeSandboxMode,
} from '../src/permission-axis.js'
import { PERMISSION_MODES } from '../src/permission-mode.js'

describe('permission-axis(79 号双轴注册表)', () => {
  it('两轴成员集与默认值与取证一致', () => {
    expect([...SANDBOX_MODES]).toEqual(['read-only', 'workspace-write', 'danger-full-access'])
    expect([...APPROVAL_POLICIES]).toEqual(['untrusted', 'on-failure', 'on-request', 'never'])
    expect(SANDBOX_MODE_DEFAULT).toBe('read-only')
    expect(APPROVAL_POLICY_DEFAULT).toBe('on-request')
  })

  it('别名闭合:每个别名指向成员,每个成员可经自身键解回', () => {
    for (const target of Object.values(SANDBOX_MODE_ALIASES)) {
      expect(SANDBOX_MODES).toContain(target)
    }
    for (const target of Object.values(APPROVAL_POLICY_ALIASES)) {
      expect(APPROVAL_POLICIES).toContain(target)
    }
    for (const m of SANDBOX_MODES) expect(SANDBOX_MODE_ALIASES[m]).toBe(m)
    for (const m of APPROVAL_POLICIES) expect(APPROVAL_POLICY_ALIASES[m]).toBe(m)
  })

  it('归一化:trim+lower 生效,认不出返回 null(fail-closed 不回退默认)', () => {
    expect(normalizeSandboxMode(' READ-ONLY ')).toBe('read-only')
    expect(normalizeSandboxMode('readonly')).toBe('read-only')
    expect(normalizeSandboxMode('unrestricted')).toBeNull()
    expect(normalizeSandboxMode(42)).toBeNull()
    expect(normalizeSandboxMode('')).toBeNull()
    expect(normalizeApprovalPolicy('unless-trusted')).toBe('untrusted')
    expect(normalizeApprovalPolicy('NEVER')).toBe('never')
    expect(normalizeApprovalPolicy('always')).toBeNull()
  })

  it('Codex 三档预设与 2026-10-01 取证逐字一致', () => {
    expect([...APPROVAL_PRESET_IDS]).toEqual(['readOnly', 'auto', 'fullAccess'])
    expect(APPROVAL_PRESETS.readOnly).toEqual({ sandboxMode: 'read-only', approvalPolicy: 'on-request' })
    expect(APPROVAL_PRESETS.auto).toEqual({ sandboxMode: 'workspace-write', approvalPolicy: 'on-request' })
    expect(APPROVAL_PRESETS.fullAccess).toEqual({ sandboxMode: 'danger-full-access', approvalPolicy: 'never' })
  })

  it('Legacy 单轴→双轴映射:三档精确等价,两档 fail-closed 置 null', () => {
    expect(Object.keys(PERMISSION_MODE_TO_AXIS).sort()).toEqual([...PERMISSION_MODES].sort())
    expect(PERMISSION_MODE_TO_AXIS.plan).toEqual({ sandboxMode: 'read-only', approvalPolicy: 'on-request' })
    expect(PERMISSION_MODE_TO_AXIS.default).toEqual({ sandboxMode: 'workspace-write', approvalPolicy: 'on-request' })
    expect(PERMISSION_MODE_TO_AXIS.bypassPermissions).toEqual({ sandboxMode: 'danger-full-access', approvalPolicy: 'never' })
    // 伪造等价的防线:这两档的双轴表达不存在,必须保持 null
    expect(PERMISSION_MODE_TO_AXIS.acceptEdits).toBeNull()
    expect(PERMISSION_MODE_TO_AXIS.manual).toBeNull()
  })

  it('granular 5 键名单与取证一致且不混入成员集', () => {
    expect([...GRANULAR_APPROVAL_KEYS]).toEqual([
      'sandbox_approval',
      'rules',
      'skill_approval',
      'request_permissions',
      'mcp_elicitations',
    ])
    for (const k of GRANULAR_APPROVAL_KEYS) expect(APPROVAL_POLICIES).not.toContain(k)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
