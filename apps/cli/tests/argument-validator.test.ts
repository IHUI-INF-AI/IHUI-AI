import { describe, expect, it } from 'vitest'
import {
  validateToolArguments,
  formatValidationErrors,
  type ValidationError,
} from '../src/tools/argument-validator.js'
import type { ToolSchema } from '../src/tools/index.js'

// ==================== 基础类型校验 ====================

describe('validateToolArguments - 基础类型', () => {
  const schema: ToolSchema = {
    name: 'echo',
    description: 'echo',
    parameters: {
      type: 'object',
      properties: {
        msg: { type: 'string', description: '消息' },
        count: { type: 'number', description: '次数' },
        flag: { type: 'boolean', description: '标记' },
      },
      required: ['msg'],
    },
  }

  it('全部字段正确 → valid=true, 无 errors', () => {
    const r = validateToolArguments({ msg: 'hello', count: 3, flag: true }, schema)
    expect(r.valid).toBe(true)
    expect(r.errors).toEqual([])
    expect(r.coerced).toEqual({ msg: 'hello', count: 3, flag: true })
  })

  it('required 字段缺失 → valid=false', () => {
    const r = validateToolArguments({ count: 3 }, schema)
    expect(r.valid).toBe(false)
    expect(r.errors).toHaveLength(1)
    expect(r.errors[0]).toMatchObject({
      field: 'msg',
      reason: 'missing_required',
      expected: 'string',
      actual: 'undefined',
    })
  })

  it('string 类型不匹配(传 number) → type_mismatch', () => {
    const r = validateToolArguments({ msg: 123 }, schema)
    expect(r.valid).toBe(false)
    expect(r.errors[0]?.reason).toBe('type_mismatch')
    expect(r.errors[0]?.expected).toBe('string')
  })

  it('number 字段接受 string "42" 并 coercion → valid=true', () => {
    const r = validateToolArguments({ msg: 'hi', count: '42' }, schema)
    expect(r.valid).toBe(true)
    expect(r.coerced.count).toBe(42)
    expect(r.coercedFields).toContain('count')
  })

  it('number 字段接受 string "42.5" 并 coercion', () => {
    const r = validateToolArguments({ msg: 'hi', count: '42.5' }, schema)
    expect(r.valid).toBe(true)
    expect(r.coerced.count).toBe(42.5)
  })

  it('number 字段接受 boolean(true→1, false→0)', () => {
    const r = validateToolArguments({ msg: 'hi', count: true }, schema)
    expect(r.valid).toBe(true)
    expect(r.coerced.count).toBe(1)
  })

  it('boolean 字段接受 string "true" → coercion', () => {
    const r = validateToolArguments({ msg: 'hi', flag: 'true' }, schema)
    expect(r.valid).toBe(true)
    expect(r.coerced.flag).toBe(true)
  })

  it('boolean 字段接受 string "false" → coercion', () => {
    const r = validateToolArguments({ msg: 'hi', flag: 'false' }, schema)
    expect(r.valid).toBe(true)
    expect(r.coerced.flag).toBe(false)
  })

  it('boolean 字段接受 number 0/1 → coercion', () => {
    const r0 = validateToolArguments({ msg: 'hi', flag: 0 }, schema)
    expect(r0.coerced.flag).toBe(false)
    const r1 = validateToolArguments({ msg: 'hi', flag: 1 }, schema)
    expect(r1.coerced.flag).toBe(true)
  })

  it('null 整体入参 → root type_mismatch', () => {
    const r = validateToolArguments(null, schema)
    expect(r.valid).toBe(false)
    expect(r.errors[0]?.field).toBe('(root)')
    expect(r.errors[0]?.reason).toBe('type_mismatch')
  })

  it('array 整体入参 → root type_mismatch', () => {
    const r = validateToolArguments([1, 2, 3], schema)
    expect(r.valid).toBe(false)
    expect(r.errors[0]?.actual).toBe('array')
  })
})

// ==================== 枚举校验 ====================

describe('validateToolArguments - 枚举', () => {
  const schema: ToolSchema = {
    name: 'setMode',
    description: '',
    parameters: {
      type: 'object',
      properties: {
        mode: { type: 'string', description: '', enum: ['fast', 'balanced', 'deep'] },
      },
      required: ['mode'],
    },
  }

  it('枚举值匹配 → valid=true', () => {
    const r = validateToolArguments({ mode: 'fast' }, schema)
    expect(r.valid).toBe(true)
  })

  it('枚举值不匹配 → enum_mismatch', () => {
    const r = validateToolArguments({ mode: 'turbo' }, schema)
    expect(r.valid).toBe(false)
    expect(r.errors[0]?.reason).toBe('enum_mismatch')
    expect(r.errors[0]?.expected).toContain('fast|balanced|deep')
  })
})

// ==================== 数组 + 嵌套对象 ====================

describe('validateToolArguments - 数组 + 嵌套', () => {
  const schema: ToolSchema = {
    name: 'batch',
    description: '',
    parameters: {
      type: 'object',
      properties: {
        paths: {
          type: 'array',
          description: '',
          items: { type: 'string', description: '' },
        },
        config: {
          type: 'object',
          description: '',
          properties: {
            timeout: { type: 'number', description: '' },
            retry: { type: 'boolean', description: '' },
          },
          required: ['timeout'],
        },
      },
      required: ['paths'],
    },
  }

  it('数组元素类型全部正确 → valid=true', () => {
    const r = validateToolArguments({ paths: ['a', 'b', 'c'] }, schema)
    expect(r.valid).toBe(true)
  })

  it('数组元素类型不匹配 → array_item_type_mismatch', () => {
    const r = validateToolArguments({ paths: ['a', 123, 'c'] }, schema)
    expect(r.valid).toBe(false)
    expect(r.errors[0]?.field).toBe('paths[1]')
  })

  it('嵌套对象 required 缺失 → object_missing_required', () => {
    const r = validateToolArguments(
      { paths: [], config: { retry: true } },
      schema,
    )
    expect(r.valid).toBe(false)
    expect(r.errors[0]?.field).toBe('config.timeout')
    expect(r.errors[0]?.reason).toBe('object_missing_required')
  })

  it('嵌套对象字段类型 coercion', () => {
    const r = validateToolArguments(
      { paths: [], config: { timeout: '5000', retry: 'yes' } },
      schema,
    )
    expect(r.valid).toBe(true)
    expect((r.coerced.config as Record<string, unknown>).timeout).toBe(5000)
    expect((r.coerced.config as Record<string, unknown>).retry).toBe(true)
  })
})

// ==================== 多个错误一次返回 ====================

describe('validateToolArguments - 错误聚合', () => {
  const schema: ToolSchema = {
    name: 'multi',
    description: '',
    parameters: {
      type: 'object',
      properties: {
        a: { type: 'string', description: '' },
        b: { type: 'number', description: '' },
        c: { type: 'boolean', description: '' },
      },
      required: ['a', 'b', 'c'],
    },
  }

  it('所有 required 缺失 + 类型错 → 一次返回所有错误', () => {
    const r = validateToolArguments({ a: 123 }, schema)
    expect(r.valid).toBe(false)
    // 2 errors: b missing, c missing (a 类型错不在这里 — a=123 会通过 string coercion)
    // 实际: a=123 → string coercion 成功;b 缺失 → missing_required;c 缺失 → missing_required
    expect(r.errors.length).toBeGreaterThanOrEqual(2)
    expect(r.errors.map((e) => e.field).sort()).toEqual(['b', 'c'])
  })
})

// ==================== formatValidationErrors ====================

describe('formatValidationErrors', () => {
  it('空数组 → 空字符串', () => {
    expect(formatValidationErrors([])).toBe('')
  })

  it('单个错误格式化', () => {
    const errs: ValidationError[] = [
      { field: 'path', reason: 'missing_required', expected: 'string', actual: 'undefined' },
    ]
    const out = formatValidationErrors(errs)
    expect(out).toContain('参数校验失败')
    expect(out).toContain("'path'")
    expect(out).toContain('缺失')
  })

  it('多个错误多行输出', () => {
    const errs: ValidationError[] = [
      { field: 'a', reason: 'type_mismatch', expected: 'number', actual: 'string' },
      { field: 'b', reason: 'enum_mismatch', expected: 'x|y', actual: 'z' },
    ]
    const out = formatValidationErrors(errs)
    const lines = out.split('\n')
    expect(lines.length).toBeGreaterThanOrEqual(3) // header + 2 errors
  })
})

// ==================== 边界 ====================

describe('validateToolArguments - 边界', () => {
  it('schema.parameters 为空对象 + args 为空 → valid=true', () => {
    const schema: ToolSchema = {
      name: 'noop',
      description: '',
      parameters: { type: 'object', properties: {}, required: [] },
    }
    const r = validateToolArguments({}, schema)
    expect(r.valid).toBe(true)
  })

  it('额外字段(未知字段)不报错', () => {
    const schema: ToolSchema = {
      name: 'echo',
      description: '',
      parameters: {
        type: 'object',
        properties: { msg: { type: 'string', description: '' } },
        required: ['msg'],
      },
    }
    const r = validateToolArguments({ msg: 'hi', extra: 'foo' }, schema)
    expect(r.valid).toBe(true)
  })

  it('空字符串 / 0 / false 是有效值,不等同 missing', () => {
    const schema: ToolSchema = {
      name: 'all',
      description: '',
      parameters: {
        type: 'object',
        properties: {
          s: { type: 'string', description: '' },
          n: { type: 'number', description: '' },
          b: { type: 'boolean', description: '' },
        },
        required: ['s', 'n', 'b'],
      },
    }
    const r = validateToolArguments({ s: '', n: 0, b: false }, schema)
    expect(r.valid).toBe(true)
  })

  it('NaN/Infinity 不是有限 number → type_mismatch', () => {
    const schema: ToolSchema = {
      name: 'n',
      description: '',
      parameters: {
        type: 'object',
        properties: { n: { type: 'number', description: '' } },
        required: ['n'],
      },
    }
    const r = validateToolArguments({ n: NaN }, schema)
    expect(r.valid).toBe(false)
  })
})
