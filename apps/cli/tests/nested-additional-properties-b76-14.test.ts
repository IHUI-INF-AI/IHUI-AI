// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * b76-14 票1(G-998176)验收草案:工具入参的闭合声明与校验必须递归到每一层。
 *
 * 立因:argument-validator 顶层闭集(G-937978)自述"这不是递归档:嵌套对象的未知键
 * 仍按原有规则放行" —— 同输入 `validateToolArguments({inner:{a:'x',zz:1}}, S1)` 判
 * valid 的假绿。本文件钉五件事:
 *   ① 嵌套对象层声明 `additionalProperties:false` ⇒ 未声明键判 unknown_field
 *      (field 用既有 `${field}.${k}` 约定);
 *   ② 数组臂:items 为闭合对象 ⇒ `list[0].zz`,沿用 `${field}[${i}]` 约定;
 *   ③ 反向对照:闭合层内合法键 / 默认档多传键 / 子 schema 形按值类型判,三例必须仍 valid;
 *   ④ 隐私锁:errors[].actual 只装 describeType 形态类别,序列化不含原值;
 *   ⑤ 收集式:嵌套 unknown 与既有 missing/type 错收集齐再一次返回(不遇首错即停)。
 */
import { describe, expect, it } from 'vitest'

import { validateToolArguments } from '../src/tools/argument-validator.js'
import type { ToolSchema } from '../src/tools/index.js'

const S1: ToolSchema = {
  name: 't',
  description: '',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      inner: {
        type: 'object',
        additionalProperties: false,
        properties: { a: { type: 'string', description: '' } },
      },
    },
    required: [],
  },
}

describe('嵌套对象层闭集(①)', () => {
  it('{inner:{a:"x",zz:1}} ⇒ valid=false 且 errors 含 {field:"inner.zz", reason:"unknown_field"}', () => {
    const r = validateToolArguments({ inner: { a: 'x', zz: 1 } }, S1)
    expect(r.valid).toBe(false)
    const unknown = r.errors.find((e) => e.reason === 'unknown_field')
    expect(unknown).toBeDefined()
    expect(unknown!.field).toBe('inner.zz')
    expect(unknown!.expected).toBe('(not declared)')
  })

  it('多层嵌套同样递归:第二层、第三层的未声明键都点名', () => {
    const deep: ToolSchema = {
      name: 'deep',
      description: '',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          lvl1: {
            type: 'object',
            additionalProperties: false,
            properties: {
              lvl2: {
                type: 'object',
                additionalProperties: false,
                properties: { ok: { type: 'string', description: '' } },
              },
            },
          },
        },
        required: [],
      },
    }
    const r = validateToolArguments({ lvl1: { lvl2: { ok: 'x', stray: 1 } } }, deep)
    expect(r.valid).toBe(false)
    expect(r.errors.find((e) => e.reason === 'unknown_field')!.field).toBe('lvl1.lvl2.stray')
  })
})

describe('数组臂(②)', () => {
  it('items 为闭合对象 ⇒ {list:[{a:"x",zz:1}]} 判 list[0].zz(沿用既有键路径约定)', () => {
    const schema: ToolSchema = {
      name: 't2',
      description: '',
      parameters: {
        type: 'object',
        properties: {
          list: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: { a: { type: 'string', description: '' } },
            },
          },
        },
        required: [],
      },
    }
    const r = validateToolArguments({ list: [{ a: 'x', zz: 1 }] }, schema)
    expect(r.valid).toBe(false)
    const unknown = r.errors.find((e) => e.reason === 'unknown_field')
    expect(unknown!.field).toBe('list[0].zz')
  })
})

describe('反向对照三例必须仍 valid(③)', () => {
  it('闭合层内只传声明键 ⇒ valid', () => {
    const r = validateToolArguments({ inner: { a: 'x' } }, S1)
    expect(r.valid).toBe(true)
    expect(r.errors).toEqual([])
  })

  it('嵌套层未声明 false 时多传键照旧放行(默认档不翻,与既有用例同律)', () => {
    const openSchema: ToolSchema = {
      name: 'open',
      description: '',
      parameters: {
        type: 'object',
        properties: {
          inner: {
            type: 'object',
            properties: { a: { type: 'string', description: '' } },
          },
        },
        required: [],
      },
    }
    const r = validateToolArguments({ inner: { a: 'x', extra: 1 } }, openSchema)
    expect(r.valid).toBe(true)
    expect(r.errors).toEqual([])
  })

  it('additionalProperties 子 schema 形 ⇒ 按值类型判而不是按未知键判', () => {
    const subSchemaForm: ToolSchema = {
      name: 't3',
      description: '',
      parameters: {
        type: 'object',
        properties: {
          inner: {
            type: 'object',
            // 值为 string 的开映射:未声明键按值类型判,不再算 unknown_field
            additionalProperties: { type: 'string', description: '' },
            properties: { a: { type: 'string', description: '' } },
          },
        },
        required: [],
      },
    }
    const ok = validateToolArguments({ inner: { a: 'x', anything: 'free-form' } }, subSchemaForm)
    expect(ok.valid).toBe(true)
    expect(ok.errors).toEqual([])
    // 值类型不合 ⇒ type_mismatch(按值判),不是 unknown_field。
    // 注意:标量 42 对 string 子 schema 走的是既有 coercion 自动转(checkString:42→'42'
    // 合法放行),所以要选一个连 coercion 都救不回的值(数组)才真正命中 type_mismatch。
    const bad = validateToolArguments({ inner: { a: 'x', anything: [1] } }, subSchemaForm)
    expect(bad.valid).toBe(false)
    expect(bad.errors[0]!.reason).toBe('type_mismatch')
    expect(bad.errors[0]!.field).toBe('inner.anything')
  })
})

describe('隐私锁(④)+ 收集式(⑤)', () => {
  it('嵌套档 actual 只装 describeType,JSON.stringify(errors) 不含原值', () => {
    const r = validateToolArguments({ inner: { a: 'x', secret: 'hunter2' } }, S1)
    const u = r.errors.find((e) => e.reason === 'unknown_field')
    expect(u?.actual).toBe('string')
    expect(JSON.stringify(r.errors)).not.toContain('hunter2')
  })

  it('missing/type/嵌套 unknown 收集齐再一次返回(不遇首错即停)', () => {
    const schema: ToolSchema = {
      name: 't4',
      description: '',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          need: { type: 'number', description: '' },
          inner: {
            type: 'object',
            additionalProperties: false,
            properties: { a: { type: 'string', description: '' } },
          },
        },
        required: ['need'],
      },
    }
    const r = validateToolArguments({ inner: { a: 'x', zz: 1 }, stray: true }, schema)
    expect(r.valid).toBe(false)
    const reasons = r.errors.map((e) => e.reason).sort()
    // 同一次返回里同时有:顶层 missing、顶层 unknown、嵌套 unknown —— 一批报齐
    expect(reasons).toEqual(['missing_required', 'unknown_field', 'unknown_field'])
    expect(r.errors.find((e) => e.field === 'stray')).toBeDefined()
    expect(r.errors.find((e) => e.field === 'inner.zz')).toBeDefined()
    expect(r.errors.find((e) => e.field === 'need')).toBeDefined()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
