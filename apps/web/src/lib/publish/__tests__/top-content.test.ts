// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { describe, expect, it } from 'vitest'

import { rankTopContent, type ContentPerformance } from '../top-content'

function item(overrides: Partial<ContentPerformance>): ContentPerformance {
  return {
    taskId: 't1',
    title: '一篇内容',
    platform: 'wechat',
    views: 100,
    likes: 10,
    comments: 1,
    shares: 0,
    publishedAt: null,
    publishedUrl: null,
    ...overrides,
  }
}

describe('rankTopContent', () => {
  it('按阅读/播放降序,并列看点赞', () => {
    const ranked = rankTopContent([
      item({ taskId: 'a', title: 'A', views: 300, likes: 5 }),
      item({ taskId: 'b', title: 'B', views: 500, likes: 2 }),
      item({ taskId: 'c', title: 'C', views: 300, likes: 8 }),
    ])
    expect(ranked.map((x) => x.taskId)).toEqual(['b', 'c', 'a'])
  })

  it('过滤零阅读、空标题和非法计数', () => {
    const ranked = rankTopContent([
      item({ taskId: 'zero', views: 0 }),
      item({ taskId: 'empty', title: '   ' }),
      item({ taskId: 'nan', views: Number.NaN }),
      item({ taskId: 'ok', views: 20 }),
    ])
    expect(ranked.map((x) => x.taskId)).toEqual(['ok'])
  })

  it('限制条数,默认 5 条', () => {
    const items = Array.from({ length: 8 }, (_, i) => item({ taskId: `t${i}`, views: i + 1 }))
    expect(rankTopContent(items)).toHaveLength(5)
    expect(rankTopContent(items, 2).map((x) => x.taskId)).toEqual(['t7', 't6'])
  })

  it('非法 limit 回退到 5,空数组不报错', () => {
    expect(rankTopContent([], Number.NaN)).toEqual([])
    const items = Array.from({ length: 6 }, (_, i) => item({ taskId: `t${i}`, views: i + 1 }))
    expect(rankTopContent(items, -3)).toHaveLength(5)
  })
})
