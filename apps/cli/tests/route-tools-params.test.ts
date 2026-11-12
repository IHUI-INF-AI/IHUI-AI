// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 路由 → AI 工具 的参数映射(route-tools)。
 *
 * 钉的是"spec 里声明的约束,必须逐层出现在产出工具的 schema 里"。
 * 每一条都对应一个曾经真实发生的缺陷:
 *
 *  ① `type: 'array'` 曾被 `RouteParamSpec` 的类型排除在外 ⇒ 生成产物 `hr.ts` 的
 *     `approverIds` 让 `tsc --noEmit` 在 HEAD 上就红(TS2322);
 *  ② `toToolParam` 曾只搬 `enum`,`items` 被**静默丢弃** ⇒ 数组元素无任何 schema 约束
 *     (等价 `any[]`),模型传 `[{foo:1}]` 也照样通过校验;
 *  ③ `properties` 同理 —— 对象字段的嵌套约束一并丢失;
 *  ④ 嵌套层的 `required` 若不带过去,必填字段会被当成可选。
 *
 * 失效方向:漏搬 ⇒ 校验放水。所以这里断言的是"必须在",而不是"没报错"。
 */
import { describe, expect, it } from 'vitest'

import { createRouteTools, unwrapEnvelope, type RouteToolSpec } from '../src/tools/route-tools.js'

const specOf = (params: RouteToolSpec['params']): RouteToolSpec => ({
  name: 'probe_tool',
  description: '探测用',
  method: 'POST',
  path: '/api/probe',
  params,
})

const paramsOf = (params: RouteToolSpec['params']) => createRouteTools([specOf(params)])[0].parameters

describe('route-tools 参数映射', () => {
  it('array 参数带 items:类型与元素 schema 都要到', () => {
    const p = paramsOf([
      {
        name: 'approverIds',
        type: 'array',
        description: '有序审批链',
        required: true,
        items: { name: 'item', type: 'string', description: '审批人 id' },
      },
    ])

    expect(p.approverIds.type).toBe('array')
    // 关键断言:items 不得被丢弃 —— 丢了就等于 any[]
    expect(p.approverIds.items).toEqual({ type: 'string', description: '审批人 id' })
  })

  it('array 无 items 时不做无谓约束(与 JSON Schema 一致)', () => {
    const p = paramsOf([{ name: 'tags', type: 'array', description: '标签' }])

    expect(p.tags.type).toBe('array')
    expect(p.tags.items).toBeUndefined()
  })

  it('object 参数带 properties:嵌套字段逐层搬到 schema', () => {
    const p = paramsOf([
      {
        name: 'filter',
        type: 'object',
        description: '过滤条件',
        properties: {
          status: { name: 'status', type: 'string', description: '状态', required: true },
          limit: { name: 'limit', type: 'number', description: '条数' },
        },
      },
    ])

    expect(p.filter.type).toBe('object')
    expect(p.filter.properties?.status).toEqual({ type: 'string', description: '状态' })
    expect(p.filter.properties?.limit).toEqual({ type: 'number', description: '条数' })
    // 嵌套 required 必须带过去,否则必填字段被当成可选
    expect(p.filter.required).toEqual(['status'])
  })

  it('嵌套 required 为空时不产出空数组字段', () => {
    const p = paramsOf([
      {
        name: 'opt',
        type: 'object',
        description: 'd',
        properties: { a: { name: 'a', type: 'string', description: 'a' } },
      },
    ])

    expect(p.opt.required).toBeUndefined()
  })

  it('数组元素本身是对象:items 递归带 properties', () => {
    const p = paramsOf([
      {
        name: 'rows',
        type: 'array',
        description: '批量行',
        items: {
          name: 'row',
          type: 'object',
          description: '一行',
          properties: { id: { name: 'id', type: 'string', description: 'ID', required: true } },
        },
      },
    ])

    expect(p.rows.items?.type).toBe('object')
    expect(p.rows.items?.properties?.id).toEqual({ type: 'string', description: 'ID' })
    expect(p.rows.items?.required).toEqual(['id'])
  })

  it('enum 与 required 在顶层照旧生效(未因本次扩展回归)', () => {
    const p = paramsOf([
      { name: 'status', type: 'string', description: '状态', required: true, enum: ['active', 'disabled'] },
    ])

    expect(p.status.enum).toEqual(['active', 'disabled'])
  })

  it('pathParams 恒为必填(与 params 的 required 分开)', () => {
    const tools = createRouteTools([
      {
        name: 'probe_tool',
        description: 'd',
        method: 'GET',
        path: '/api/x/:id',
        pathParams: [{ name: 'id', type: 'string', description: 'ID' }],
      },
    ])

    expect(tools[0].required).toContain('id')
  })
})

describe('unwrapEnvelope 的边界', () => {
  it('只拆顶层真有 data 键的对象', () => {
    expect(unwrapEnvelope({ code: 0, data: { a: 1 } })).toEqual({ a: 1 })
  })

  it('业务字段恰叫 data 但顶层是数组时不拆', () => {
    expect(unwrapEnvelope([{ data: 1 }])).toEqual([{ data: 1 }])
  })

  it('data 为 null 时照样拆出 null(不当作"没有信封")', () => {
    expect(unwrapEnvelope({ code: 0, data: null })).toBeNull()
  })

  it('裸对象原样返回', () => {
    expect(unwrapEnvelope({ a: 1 })).toEqual({ a: 1 })
  })
})
