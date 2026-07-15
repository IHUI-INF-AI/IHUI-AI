import { describe, it, expect } from 'vitest'
import { segmentChineseQuery } from '../src/db/search-queries.js'

/**
 * 中文分词纯函数单测
 * 验证 P1-1 修复:历史 Lucene HMMChineseTokenizer 的 2-gram 简化替代方案
 */
describe('segmentChineseQuery - 中文 2-gram 分词', () => {
  it('空字符串返回空数组', () => {
    expect(segmentChineseQuery('')).toEqual([])
    expect(segmentChineseQuery('   ')).toEqual([])
    expect(segmentChineseQuery('\t\n')).toEqual([])
  })

  it('纯英文/数字返回空数组(走原 tsvector 路径)', () => {
    expect(segmentChineseQuery('hello')).toEqual([])
    expect(segmentChineseQuery('test123')).toEqual([])
    expect(segmentChineseQuery('user@example.com')).toEqual([])
    expect(segmentChineseQuery('React Native')).toEqual([])
  })

  it('中文 query 返回完整 query + 2-gram + 单字', () => {
    const tokens = segmentChineseQuery('人工智能教育')
    expect(tokens).toContain('人工智能教育')
    expect(tokens).toContain('人工')
    expect(tokens).toContain('工智')
    expect(tokens).toContain('智能')
    expect(tokens).toContain('能教')
    expect(tokens).toContain('教育')
    expect(tokens).toContain('人')
    expect(tokens).toContain('工')
    expect(tokens).toContain('智')
    expect(tokens).toContain('能')
    expect(tokens).toContain('教')
    expect(tokens).toContain('育')
    expect(tokens).toHaveLength(12)
  })

  it('单字中文 query 返回单字', () => {
    const tokens = segmentChineseQuery('教')
    expect(tokens).toEqual(['教'])
  })

  it('两字中文 query 返回完整 + 2-gram + 2 个单字', () => {
    const tokens = segmentChineseQuery('教育')
    expect(tokens).toContain('教育')
    expect(tokens).toContain('教')
    expect(tokens).toContain('育')
    expect(tokens).toHaveLength(3)
  })

  it('混合中英文 query 也分词(完整 query 含中文触发分词)', () => {
    const tokens = segmentChineseQuery('AI 教育平台')
    expect(tokens).toContain('AI 教育平台')
    expect(tokens).toContain('教育')
    expect(tokens).toContain('育平')
    expect(tokens).toContain('平台')
    expect(tokens).toContain('教')
    expect(tokens).toContain('育')
    expect(tokens).toContain('平')
    expect(tokens).toContain('台')
  })

  it('验证目标:写入"人工智能教育"后按"教育"能搜到记录', () => {
    const tokens = segmentChineseQuery('人工智能教育')
    expect(tokens).toContain('教育')
  })

  it('验证目标:写入"人工智能教育"后按"智能"能搜到记录', () => {
    const tokens = segmentChineseQuery('人工智能教育')
    expect(tokens).toContain('智能')
  })

  it('验证目标:写入"人工智能教育"后按"人工"能搜到记录', () => {
    const tokens = segmentChineseQuery('人工智能教育')
    expect(tokens).toContain('人工')
  })

  it('长中文 query 不超过合理 token 数量', () => {
    const longQuery = '这是一个用于测试中文分词功能是否正常工作的较长查询字符串'
    const tokens = segmentChineseQuery(longQuery)
    expect(tokens.length).toBeLessThan(longQuery.length * 2)
    expect(tokens.length).toBeGreaterThan(longQuery.length)
  })

  it('特殊字符不导致分词异常', () => {
    const tokens = segmentChineseQuery('教育!@#$%')
    expect(tokens).toContain('教育')
    expect(tokens).toContain('教')
    expect(tokens).toContain('育')
  })
})
