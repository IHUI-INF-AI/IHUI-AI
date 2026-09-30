// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * b76-05 票2 配对测试:严格投影(拒绝 + 定位通道)、单一词汇表、canonical 序列化。
 *
 * 立因:描述符是人手写的,`normalizeProviderSchema` 是"尽力归一化",遇到不认识的
 * 构造只会静默吞掉或原样透传 —— 两份真相开始分叉的第一个现场没有任何报警。
 * 本文件钉四件事:
 *   (a) 词汇表外的关键字 ⇒ ToolSchemaProjectionError,路径为 `$.properties.x` 形式;
 *   (b) 发射子集 == 校验子集:投影输出出现词汇表外的键同样抛(含 properties 映射
 *       里的属性名**不得**被误判为关键字 —— 那是映射的键位,不是 schema 关键字);
 *   (c) canonicalJson:键序递归字典序,同一结构逐字节同串(缓存中性);
 *   (d) A/B 不回归:property 名集合与 required 集合按构造相等。
 */
import { describe, expect, it } from 'vitest'

import {
  SCHEMA_PROJECTION_VOCABULARY,
  TOOL_SCHEMA_PROJECTION_FAULT_CODE,
  ToolSchemaProjectionError,
  canonicalJson,
  projectToolInputSchema,
  projectToolInputSchemaCanonical,
  projectToolInputSchemaStrict,
} from '../src/schema-projection'

const goodParameters = {
  url: { type: 'string', description: '要抓取的 URL' },
  retries: { type: 'number', minimum: 0 },
}

describe('严格投影:拒绝 + 定位((a))', () => {
  it('描述符携带 anyOf ⇒ 抛 ToolSchemaProjectionError,路径定位到 $.properties.url', () => {
    const bad = {
      url: { type: 'string', anyOf: [{ type: 'string' }, { type: 'null' }] },
    }
    expect(() => projectToolInputSchemaStrict(bad, [])).toThrow(ToolSchemaProjectionError)
    try {
      projectToolInputSchemaStrict(bad, [])
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(ToolSchemaProjectionError)
      const err = e as ToolSchemaProjectionError
      expect(err.code).toBe(TOOL_SCHEMA_PROJECTION_FAULT_CODE)
      expect(err.path).toBe('$.properties.url')
      expect(err.reason).toContain('anyOf')
    }
  })

  it('依赖 $ref 而无 resolver 的描述符如实报数:抛错并列路径,不再无处可查', () => {
    const bad = { url: { type: 'string', $ref: '#/definitions/x' } }
    try {
      projectToolInputSchemaStrict(bad, [])
      expect.unreachable()
    } catch (e) {
      const err = e as ToolSchemaProjectionError
      expect(err.path).toBe('$.properties.url')
      expect(err.reason).toContain('$ref')
    }
  })

  it('嵌套层违规同样定位:items.properties 深处的词汇表外键带全路径', () => {
    const bad = {
      list: {
        type: 'array',
        items: { type: 'object', properties: { name: { type: 'string', discriminant: 'x' } } },
      },
    }
    try {
      projectToolInputSchemaStrict(bad, [])
      expect.unreachable()
    } catch (e) {
      const err = e as ToolSchemaProjectionError
      expect(err.path).toBe('$.properties.list.items.properties.name')
    }
  })
})

describe('发射子集 == 校验子集((b))', () => {
  it('词汇表是一份封闭清单,且投影输出不携带表外键', () => {
    expect(SCHEMA_PROJECTION_VOCABULARY.length).toBeGreaterThan(5)
    const projected = projectToolInputSchemaStrict(goodParameters, ['url'])
    for (const key of Object.keys(projected)) {
      expect(SCHEMA_PROJECTION_VOCABULARY).toContain(key)
    }
  })

  it('properties 映射里的属性名不得被误判为关键字(与既有输出形态回归对照)', () => {
    // 属性名恰好撞词汇表形状(如 label/line)时,投影与严格投影都必须照常通过
    const params = {
      options: {
        type: 'array',
        items: { type: 'object', properties: { label: { type: 'string' }, line: { type: 'number' } } },
      },
    }
    const plain = projectToolInputSchema(params, [])
    expect(Object.keys(plain.properties.options)).toContain('items')
    const strict = projectToolInputSchemaStrict(params, [])
    expect(Object.keys(strict.properties.options)).toContain('items')
  })
})

describe('canonical 序列化:缓存中性((c))', () => {
  it('canonicalJson 键序递归字典序,同一结构逐字节同串', () => {
    const a = { b: 1, a: { d: 2, c: [3, { z: 1, y: 2 }] } }
    const b = { a: { c: [3, { y: 2, z: 1 }], d: 2 }, b: 1 }
    expect(canonicalJson(a)).toBe(canonicalJson(b))
    const sorted = '{"a":{"c":[3,{"y":2,"z":1}],"d":2},"b":1}'
    expect(canonicalJson(a)).toBe(sorted)
  })

  it('canonical 形态键序 = 排序结果;与生产出口键集合相等(只有键序不同)', () => {
    const canonical = projectToolInputSchemaCanonical(goodParameters, ['url'])
    expect(JSON.stringify(canonical)).toBe(canonicalJson(canonical))
    const plain = projectToolInputSchema(goodParameters, ['url'])
    expect(Object.keys(plain).sort()).toEqual(Object.keys(canonical).sort())
    expect(Object.keys(plain.properties).sort()).toEqual(Object.keys(canonical.properties).sort())
  })

  it('同一描述符连续投影 100 次 ⇒ canonicalJson 输出逐字节相等(防 Object.keys 顺序泄漏)', () => {
    let first: string | null = null
    for (let i = 0; i < 100; i++) {
      const s = canonicalJson(projectToolInputSchemaCanonical(goodParameters, ['url']))
      if (first === null) first = s
      expect(s).toBe(first)
    }
  })
})

describe('A/B 不回归((d))', () => {
  it('投影前后的 property 名集合与 required 集合相等 {added:[],removed:[],requiredChanged:false}', () => {
    const required = ['url']
    const projected = projectToolInputSchemaStrict(goodParameters, required)
    const added = Object.keys(projected.properties).filter((k) => !(k in goodParameters))
    const removed = Object.keys(goodParameters).filter(
      (k) => !(k in projected.properties),
    )
    expect(added).toEqual([])
    expect(removed).toEqual([])
    expect(projected.required.sort()).toEqual([...required].sort())
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
