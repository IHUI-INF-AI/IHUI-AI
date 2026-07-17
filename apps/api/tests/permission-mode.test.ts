import { describe, it, expect } from 'vitest'
import {
  parsePermissionMode,
  checkPermissionMode,
  type PermissionMode,
  type PermissionDecision,
  type DangerLevel,
} from '../src/services/clawdbot/permission-guard.js'

describe('parsePermissionMode — 合法值', () => {
  it('default', () => {
    expect(parsePermissionMode('default')).toBe('default')
  })
  it('acceptEdits', () => {
    expect(parsePermissionMode('acceptEdits')).toBe('acceptEdits')
  })
  it('bypassPermissions', () => {
    expect(parsePermissionMode('bypassPermissions')).toBe('bypassPermissions')
  })
  it('plan', () => {
    expect(parsePermissionMode('plan')).toBe('plan')
  })
  it('manual', () => {
    expect(parsePermissionMode('manual')).toBe('manual')
  })
})

describe('parsePermissionMode — 非法/边界值', () => {
  it('空字符串返回 undefined', () => {
    expect(parsePermissionMode('')).toBeUndefined()
  })
  it('未知字符串返回 undefined', () => {
    expect(parsePermissionMode('invalid')).toBeUndefined()
  })
  it('undefined 返回 undefined', () => {
    expect(parsePermissionMode(undefined)).toBeUndefined()
  })
  it('null 返回 undefined', () => {
    expect(parsePermissionMode(null)).toBeUndefined()
  })
  it('大小写敏感:Default 返回 undefined(对齐 CLI 语义)', () => {
    expect(parsePermissionMode('Default')).toBeUndefined()
  })
  it('大小写敏感:DEFAULT 返回 undefined(对齐 CLI 语义)', () => {
    expect(parsePermissionMode('DEFAULT')).toBeUndefined()
  })
  it('大小写敏感:PLAN 返回 undefined(对齐 CLI 语义)', () => {
    expect(parsePermissionMode('PLAN')).toBeUndefined()
  })
  it('前后空白会被 trim:"  default  " 返回 default', () => {
    expect(parsePermissionMode('  default  ')).toBe('default')
  })
  it('中间空白不算 trim:"def ault" 返回 undefined', () => {
    expect(parsePermissionMode('def ault')).toBeUndefined()
  })
  it('数字字符串返回 undefined', () => {
    expect(parsePermissionMode('123')).toBeUndefined()
  })
})

describe('checkPermissionMode — 5 mode × 3 dangerLevel 矩阵', () => {
  const modes: PermissionMode[] = [
    'default',
    'acceptEdits',
    'bypassPermissions',
    'plan',
    'manual',
  ]
  const levels: DangerLevel[] = ['read', 'write', 'dangerous']

  const expected: Record<PermissionMode, Record<DangerLevel, PermissionDecision>> = {
    default: { read: 'allow', write: 'ask', dangerous: 'ask' },
    acceptEdits: { read: 'allow', write: 'allow', dangerous: 'ask' },
    bypassPermissions: { read: 'allow', write: 'allow', dangerous: 'allow' },
    plan: { read: 'allow', write: 'deny', dangerous: 'deny' },
    manual: { read: 'ask', write: 'ask', dangerous: 'ask' },
  }

  for (const mode of modes) {
    for (const level of levels) {
      it(`${mode} × ${level} = ${expected[mode][level]}`, () => {
        expect(checkPermissionMode('test_tool', mode, level)).toBe(expected[mode][level])
      })
    }
  }
})

describe('checkPermissionMode — 边界:空 mode 默认 default', () => {
  it('mode=undefined × read=allow(回落 default)', () => {
    expect(checkPermissionMode('tool', undefined, 'read')).toBe('allow')
  })
  it('mode=undefined × write=ask(回落 default)', () => {
    expect(checkPermissionMode('tool', undefined, 'write')).toBe('ask')
  })
  it('mode=undefined × dangerous=ask(回落 default)', () => {
    expect(checkPermissionMode('tool', undefined, 'dangerous')).toBe('ask')
  })
  it('parsePermissionMode 空字符串 → undefined → checkPermissionMode 回落 default', () => {
    const mode = parsePermissionMode('') ?? undefined
    expect(checkPermissionMode('tool', mode, 'read')).toBe('allow')
    expect(checkPermissionMode('tool', mode, 'write')).toBe('ask')
  })
})

describe('checkPermissionMode — toolName 不影响决策', () => {
  it('不同 toolName 同 mode/level 返回相同结果', () => {
    expect(checkPermissionMode('read_file', 'default', 'read')).toBe('allow')
    expect(checkPermissionMode('delete_file', 'default', 'read')).toBe('allow')
    expect(checkPermissionMode('any_tool', 'plan', 'write')).toBe('deny')
  })
})
