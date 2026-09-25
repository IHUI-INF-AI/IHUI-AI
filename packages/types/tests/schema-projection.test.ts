// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 单点投影(A13 第一阶段)断言:模型可见面由运行时校验器所用描述单向产出,且**不得改变
// provider 今日已接受的形态**。归一化四步各有正反例(否则"窄归一化器"只是句自述)。
import { describe, expect, it } from 'vitest'

import {
  createProjectionAccount,
  normalizeProviderSchema,
  projectShapeDescriptor,
  projectToolInputSchema,
} from '../src/schema-projection'

import type { ToolShapeDescriptor } from '../src/tool-contract'

describe('projectToolInputSchema · 等价性(键集合与必填集合)', () => {
  const parameters: Record<string, ToolShapeDescriptor> = {
    path: { type: 'string', description: '要读取的文件路径' },
    mode: { type: 'string', description: '模式', enum: ['a', 'b'] },
    nested: {
      type: 'object',
      description: '嵌套',
      properties: { deep: { type: 'number', description: '深' } },
      required: ['deep'],
    },
    list: { type: 'array', description: '列表', items: { type: 'string', description: '项' } },
  }
  const required = ['path', 'mode']

  it('属性名集合与 required 集合逐字保持(投影只加结构,不动名字)', () => {
    const out = projectToolInputSchema(parameters, required)
    expect(Object.keys(out.properties)).toEqual(Object.keys(parameters))
    expect(out.required).toEqual(required)
    expect(out.type).toBe('object')
    const nested = out.properties.nested as { properties: Record<string, unknown> }
    expect(Object.keys(nested.properties)).toEqual(['deep'])
  })

  it('每个节点写出的键序与内容 = 今日手搓 toJsonProperty 的映射(type/description/enum/items/properties/required)', () => {
    const out = projectToolInputSchema(parameters, required)
    expect(out.properties.path).toEqual({ type: 'string', description: '要读取的文件路径' })
    expect(out.properties.mode).toEqual({ type: 'string', description: '模式', enum: ['a', 'b'] })
    expect(out.properties.list).toEqual({
      type: 'array',
      description: '列表',
      items: { type: 'string', description: '项' },
    })
  })

  it('线字节层面与今日下发一致(JSON 序列化后 undefined 键本就不出现)', () => {
    const account = createProjectionAccount()
    const projected = projectToolInputSchema(parameters, required, account)
    const legacy = {
      type: 'object',
      properties: Object.fromEntries(
        Object.entries(parameters).map(([k, p]) => [
          k,
          {
            type: p.type,
            description: p.description,
            ...(p.enum ? { enum: [...p.enum] } : {}),
            ...(p.items ? { items: { type: p.items.type, description: p.items.description } } : {}),
            ...(p.properties
              ? {
                  properties: {
                    deep: { type: 'number', description: p.properties.deep?.description },
                  },
                }
              : {}),
            ...(p.required ? { required: [...p.required] } : {}),
          },
        ]),
      ),
      required: [...required],
    }
    expect(JSON.stringify(projected)).toBe(JSON.stringify(legacy))
    // 这份真实形状里不该有任何归一化动作发生(发生了就说明投影在改 provider 已接受的形态)
    expect(account).toEqual(createProjectionAccount())
  })

  it('type: unknown 一档不写出 type 键(写出去会被 provider 拒),并计入账本', () => {
    const account = createProjectionAccount()
    const node = projectShapeDescriptor({ type: 'unknown', description: '任意' }, account)
    expect(node).toEqual({ description: '任意' })
    expect(account.typelessNodes).toBe(1)
  })
})

describe('normalizeProviderSchema · 四步各一条正反例', () => {
  it('第 1 步 剥引用类关键字:$schema/$defs 删掉,约束键留下', () => {
    const account = createProjectionAccount()
    const out = normalizeProviderSchema(
      {
        $schema: 'http://json-schema.org/draft-07#',
        $defs: { A: {} },
        type: 'string',
        minLength: 2,
      },
      account,
    )
    expect(out).toEqual({ type: 'string', minLength: 2 })
    expect(account.bookkeepingRefs).toBe(2)
  })

  it('第 1 步 $ref:有 resolver 才解析;没有则放宽并**如实计数**(不得静默成"没问题")', () => {
    const noResolver = createProjectionAccount()
    expect(normalizeProviderSchema({ $ref: '#/$defs/A' }, noResolver)).toEqual({})
    expect(noResolver.unresolvedRefs).toBe(1)

    const withResolver = createProjectionAccount()
    const out = normalizeProviderSchema({ $ref: '#/$defs/A' }, withResolver, () => ({
      type: 'string',
      enum: ['x'],
    }))
    expect(out).toEqual({ type: 'string', enum: ['x'] })
    expect(withResolver.unresolvedRefs).toBe(0)
  })

  it('第 2 步 任一选一:Zod 式可空折成单一形态;成员同 type 时 enum 取并集', () => {
    const account = createProjectionAccount()
    expect(
      normalizeProviderSchema({ anyOf: [{ type: 'string' }, { type: 'null' }] }, account),
    ).toEqual({ type: 'string' })
    expect(
      normalizeProviderSchema(
        {
          anyOf: [
            { type: 'string', enum: ['a'] },
            { type: 'string', enum: ['b'] },
          ],
        },
        account,
      ),
    ).toEqual({ type: 'string', enum: ['a', 'b'] })
    expect(account.foldedCombinators).toBe(2)
  })

  it('第 2 步 反例:成员类型不一致的组合器**原样保留**并计 unfoldedCombinators(不猜一个成员)', () => {
    const account = createProjectionAccount()
    const out = normalizeProviderSchema(
      { anyOf: [{ type: 'string' }, { type: 'number' }] },
      account,
    )
    expect(out.anyOf).toEqual([{ type: 'string' }, { type: 'number' }])
    expect(account.unfoldedCombinators).toBe(1)
    expect(account.foldedCombinators).toBe(0)
  })

  it('第 3 步 按约束反推缺失 type:object/array/string/number 四条 + 全体同型 enum 一条', () => {
    const account = createProjectionAccount()
    expect(normalizeProviderSchema({ properties: { a: { type: 'string' } } }, account).type).toBe(
      'object',
    )
    expect(normalizeProviderSchema({ items: { type: 'string' } }, account).type).toBe('array')
    expect(normalizeProviderSchema({ pattern: '^a' }, account).type).toBe('string')
    expect(normalizeProviderSchema({ minimum: 1 }, account).type).toBe('number')
    expect(normalizeProviderSchema({ enum: ['x', 'y'] }, account).type).toBe('string')
    expect(account.inferredTypes).toBe(5)
  })

  it('第 3 步 反例:已经写了 type 就不动它(投影不得反向覆盖声明)', () => {
    const account = createProjectionAccount()
    expect(normalizeProviderSchema({ type: 'string', minLength: 3 }, account)).toEqual({
      type: 'string',
      minLength: 3,
    })
    expect(account.inferredTypes).toBe(0)
  })

  it('第 4 步 任意键值的对象补键类型:additionalProperties 缺 type ⇒ 补 string', () => {
    const account = createProjectionAccount()
    expect(
      normalizeProviderSchema(
        { type: 'object', additionalProperties: { description: '任意值' } },
        account,
      ),
    ).toEqual({ type: 'object', additionalProperties: { description: '任意值', type: 'string' } })
    expect(account.keyTypesAdded).toBe(1)
  })

  it('第 4 步 反例:type:object 而没有 additionalProperties ⇒ 什么都不加(今日 provider 已接受该形态)', () => {
    const account = createProjectionAccount()
    expect(normalizeProviderSchema({ type: 'object' }, account)).toEqual({ type: 'object' })
    expect(account.keyTypesAdded).toBe(0)
  })

  it('幂等:归一化跑第二次不再改变任何东西(除已折形态被再读一次)', () => {
    const first = normalizeProviderSchema({
      $schema: 'x',
      anyOf: [{ type: 'string' }, { type: 'null' }],
      additionalProperties: { description: 'v' },
      type: 'object',
    })
    const second = normalizeProviderSchema(structuredClone(first))
    expect(JSON.stringify(second)).toBe(JSON.stringify(first))
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
