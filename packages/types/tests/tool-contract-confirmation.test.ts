// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 工具契约「确认凭据档」(TC5 的类型源,2026-09-29 立,上游 zcode 参数层确认取证票)。
//
// 钉四件事,每件都成对(只有反例的判据等于没有判据,正向缺一条就是"恒真断言"的另一半):
//  ① 封闭三档词表逐字定值 —— 守门 111 的门侧投影必须与此同值(镜像 T24 对账);
//  ② 校验器 `validateToolConfirmationPolicy` 各档的接受/拒绝面(缺 flag / 空 reason / 未知 mode
//     一律 null,**不回退**任何一档 —— 静默降级就是放行,与 normalizeToolEffectScope 同一条禁令);
//  ③ `none` 档必须带非空 reason —— "没有确认"是显式决定,不是字段缺席;
//  ④ **类型层字段可选**:不带 confirmation 的既有契约字面量必须原样编译通过
//     (本票护栏:不得把 104 枚工具的编译面砸掉;"必填"由守门 TC5 判据执行)。
import { describe, expect, it } from 'vitest'

import {
  TOOL_CONFIRMATION_MODES,
  TOOL_RISK_LEVELS,
  normalizeToolConfirmationMode,
  validateToolConfirmationPolicy,
} from '../src/tool-contract'

import type {
  ToolConfirmationPolicy,
  ToolContract,
  ToolContractMount,
} from '../src/tool-contract'

describe('确认档词表(封闭联合)', () => {
  it('三档逐字定值;风险档 read/write/dangerous 与门侧投影的对账在镜像测试 T24', () => {
    expect([...TOOL_CONFIRMATION_MODES]).toEqual(['explicit-flag', 'interactive', 'none'])
    expect([...TOOL_RISK_LEVELS]).toEqual(['read', 'write', 'dangerous'])
  })

  it('归一化只认字面量:认不出返回 null,不静默落到任何一档', () => {
    expect(normalizeToolConfirmationMode('explicit-flag')).toBe('explicit-flag')
    expect(normalizeToolConfirmationMode('interactive')).toBe('interactive')
    expect(normalizeToolConfirmationMode('none')).toBe('none')
    for (const bad of ['None', 'always-ask', '', 'force', undefined, null, 42, { mode: 'none' }]) {
      expect(normalizeToolConfirmationMode(bad), String(bad)).toBeNull()
    }
  })
})

describe('validateToolConfirmationPolicy(唯一运行时校验出口)', () => {
  it('explicit-flag:带非空 flag 才成立;缺 flag / 空串 / 全空白 一律拒绝', () => {
    expect(validateToolConfirmationPolicy({ mode: 'explicit-flag', flag: 'force' })).toEqual({
      mode: 'explicit-flag',
      flag: 'force',
    })
    expect(validateToolConfirmationPolicy({ mode: 'explicit-flag' })).toBeNull()
    expect(validateToolConfirmationPolicy({ mode: 'explicit-flag', flag: '   ' })).toBeNull()
    expect(validateToolConfirmationPolicy({ mode: 'explicit-flag', flag: 7 })).toBeNull()
  })

  it('interactive:无附加字段即成立', () => {
    expect(validateToolConfirmationPolicy({ mode: 'interactive' })).toEqual({ mode: 'interactive' })
  })

  it('none:必须带非空 reason —— "没有确认"是显式决定,缺席不算决定', () => {
    expect(
      validateToolConfirmationPolicy({ mode: 'none', reason: '批准由上游 danger-gate 统一发起' }),
    ).toEqual({ mode: 'none', reason: '批准由上游 danger-gate 统一发起' })
    expect(validateToolConfirmationPolicy({ mode: 'none' })).toBeNull()
    expect(validateToolConfirmationPolicy({ mode: 'none', reason: '  ' })).toBeNull()
  })

  it('未知 mode / 非对象输入 ⇒ null(不得就近吸附到看起来最安全的一档)', () => {
    expect(validateToolConfirmationPolicy({ mode: 'ask-me' })).toBeNull()
    expect(validateToolConfirmationPolicy('interactive')).toBeNull()
    expect(validateToolConfirmationPolicy(null)).toBeNull()
    expect(validateToolConfirmationPolicy(undefined)).toBeNull()
  })
})

describe('消费面兼容性(本票护栏:只加描述,不改 104 枚工具)', () => {
  it('不带 confirmation 的完整契约仍通过类型构造(字段可选;判据强度住在守门 TC5)', () => {
    // 这份字面量逐字形状等于 schema-projection / argument-validator 今天能构造的东西
    const legacyMount: ToolContractMount = {
      contract: {
        shape: { visibleToProvider: true, input: { type: 'object' } },
        permission: {
          permissionKey: 'legacy',
          reason: '既有形状',
          riskLevel: 'write',
          effectScope: 'workspace',
          requiresApproval: true,
        },
        resultBudget: {
          inlineLimitBytes: 1024,
          providerVisibleLimitBytes: 1024,
          policy: 'inline',
          preview: { bytes: 1024, lines: 20, from: 'head' },
        },
      },
    }
    expect(legacyMount.contract?.permission.confirmation).toBeUndefined()
  })

  it('判别联合在 switch 下各档字段可达(explicit-flag 才有 flag,none 才有 reason)', () => {
    const summarize = (policy: ToolConfirmationPolicy): string => {
      switch (policy.mode) {
        case 'explicit-flag':
          return `flag:${policy.flag}`
        case 'interactive':
          return 'ask'
        case 'none':
          return `none:${policy.reason}`
      }
    }
    expect(summarize({ mode: 'explicit-flag', flag: 'force' })).toBe('flag:force')
    expect(summarize({ mode: 'interactive' })).toBe('ask')
    expect(summarize({ mode: 'none', reason: 'r' })).toBe('none:r')
  })

  it('新式契约(带 confirmation)与旧式并存:同一 ToolContract 类型两条都能构造', () => {
    const base: ToolContract = {
      shape: { visibleToProvider: true, input: { type: 'object' } },
      permission: {
        permissionKey: 'fresh',
        reason: '写档补确认',
        riskLevel: 'dangerous',
        effectScope: 'system',
        requiresApproval: true,
        confirmation: { mode: 'explicit-flag', flag: 'force' },
      },
      resultBudget: {
        inlineLimitBytes: 1,
        providerVisibleLimitBytes: 1,
        policy: 'inline',
        preview: { bytes: 1, lines: 1, from: 'head' },
      },
    }
    expect(base.permission.confirmation).toEqual({ mode: 'explicit-flag', flag: 'force' })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
