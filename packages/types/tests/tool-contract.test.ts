// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 工具契约声明面(A13 第一阶段)断言:两个派生谓词必须"缺省即不可信"。
//
// 每个谓词各两条方向:①字段/契约缺席 ⇒ 判不可信(这是本票存在的理由);②显式声明到对应档 ⇒ 判可信。
// 只写①的话,恒真的判据也能过 —— 所以两条都是必须的。
import { describe, expect, it } from 'vitest'

import {
  TOOL_EFFECT_SCOPES,
  TOOL_MUTATING_EFFECT_SCOPES,
  TOOL_PROTOCOL_EFFECT_SCOPES,
  TOOL_RISK_LEVELS,
  declaredEffectScope,
  mayWriteWorkspace,
  normalizeToolEffectScope,
  touchesExternalWorld,
} from '../src/tool-contract'

import type { ToolContract, ToolContractMount, ToolEffectScope } from '../src/tool-contract'

function mountWithScope(scope: ToolEffectScope): ToolContractMount {
  return {
    contract: {
      shape: { visibleToProvider: true, input: { type: 'object' } },
      permission: {
        permissionKey: 'demo',
        reason: '演示',
        riskLevel: 'read',
        effectScope: scope,
        requiresApproval: false,
      },
      resultBudget: {
        inlineLimitBytes: 1024,
        providerVisibleLimitBytes: 1024,
        policy: 'inline',
        preview: { bytes: 1024, lines: 20, from: 'head' },
      },
    },
  }
}

/** 造一个"字段在但值不合法"的挂载位(测缺省即不可信时绕不开类型断言,不用 any)。 */
function mountWithRawScope(raw: unknown): ToolContractMount {
  return {
    contract: { permission: { effectScope: raw } } as unknown as ToolContract,
  }
}

describe('词表本身(七档 = 外部五档 + 协议两档,互不重叠)', () => {
  it('档位总数 7,改写档 3、协议档 2 且两者不相交', () => {
    expect(TOOL_EFFECT_SCOPES).toHaveLength(7)
    expect(TOOL_MUTATING_EFFECT_SCOPES).toHaveLength(3)
    expect(TOOL_PROTOCOL_EFFECT_SCOPES).toHaveLength(2)
    for (const s of TOOL_MUTATING_EFFECT_SCOPES) {
      expect(TOOL_PROTOCOL_EFFECT_SCOPES).not.toContain(s)
    }
    for (const s of TOOL_EFFECT_SCOPES) expect(typeof s).toBe('string')
  })

  it('riskLevel 三档与本仓既有 dangerLevel 逐字同值(不新立档)', () => {
    expect([...TOOL_RISK_LEVELS].sort()).toEqual(['dangerous', 'read', 'write'])
  })

  it('归一化认不出的输入返回 null,绝不回退 none(回退 = 静默放行)', () => {
    expect(normalizeToolEffectScope('worksapce')).toBeNull()
    expect(normalizeToolEffectScope('')).toBeNull()
    expect(normalizeToolEffectScope(undefined)).toBeNull()
    expect(normalizeToolEffectScope(null)).toBeNull()
    expect(normalizeToolEffectScope(42)).toBeNull()
    expect(normalizeToolEffectScope('none')).toBe('none')
  })
})

describe('谓词一 mayWriteWorkspace', () => {
  it('方向 A · 契约缺席 / permission 缺席 / 值不合法 ⇒ 判"会改写"(未声明即不可信)', () => {
    expect(mayWriteWorkspace({})).toBe(true)
    expect(mayWriteWorkspace({ contract: undefined })).toBe(true)
    expect(mayWriteWorkspace(null)).toBe(true)
    expect(mayWriteWorkspace(undefined)).toBe(true)
    expect(mayWriteWorkspace({ contract: {} } as unknown as ToolContractMount)).toBe(true)
    expect(mayWriteWorkspace(mountWithRawScope('worksapce'))).toBe(true)
    expect(mayWriteWorkspace(mountWithRawScope(undefined))).toBe(true)
    expect(declaredEffectScope({})).toBeNull()
  })

  it('方向 B · 显式声明到改写三档 ⇒ 判"会";声明到其余四档 ⇒ 判"不会"', () => {
    for (const scope of TOOL_MUTATING_EFFECT_SCOPES) {
      expect(mayWriteWorkspace(mountWithScope(scope))).toBe(true)
    }
    for (const scope of ['none', 'network', 'delegate-to-caller', 'ask-user'] as const) {
      expect(mayWriteWorkspace(mountWithScope(scope))).toBe(false)
    }
  })
})

describe('谓词二 touchesExternalWorld(排除法:只排两档协议语义)', () => {
  it('方向 A · 契约缺席 / 值不合法 ⇒ 判"碰了外部世界"', () => {
    expect(touchesExternalWorld({})).toBe(true)
    expect(touchesExternalWorld(null)).toBe(true)
    expect(touchesExternalWorld(mountWithRawScope('nope'))).toBe(true)
  })

  it('方向 B · 只有两档协议语义判"没碰";声明 none 的读仍判"碰"(结果取决于外部状态)', () => {
    for (const scope of TOOL_PROTOCOL_EFFECT_SCOPES) {
      expect(touchesExternalWorld(mountWithScope(scope))).toBe(false)
    }
    expect(touchesExternalWorld(mountWithScope('none'))).toBe(true)
    expect(touchesExternalWorld(mountWithScope('network'))).toBe(true)
    expect(touchesExternalWorld(mountWithScope('workspace'))).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
