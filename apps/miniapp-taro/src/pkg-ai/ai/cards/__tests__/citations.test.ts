// #11 引用溯源跨端(第 49 轮):citations 帧在 miniapp 只有 dispatch case,端内没人承接,
// 界面上就"没有来源列表"。这里锁住累积层的两条性质:追加不被覆盖、(source,label) 去重。
import { describe, expect, it } from 'vitest'

import { appendCitations, type CitationView } from '../types'

const a: CitationView = { source: 'repo-docs', label: 'AGENTS.md 第 4 节' }

describe('appendCitations(#11 承接)', () => {
  it('undefined 起点 → 单条', () => {
    expect(appendCitations(undefined, [a])).toEqual([a])
  })

  it('两批追加不互相覆盖', () => {
    const once = appendCitations(undefined, [a])
    const twice = appendCitations(once, [{ source: 'web', label: '某条文' }])
    expect(twice.map((x) => x.label)).toEqual(['AGENTS.md 第 4 节', '某条文'])
  })

  it('同 (source,label) 重复帧不产生第二行(重连补发幂等)', () => {
    const once = appendCitations(undefined, [a])
    expect(appendCitations(once, [a, { ...a }])).toHaveLength(1)
  })

  it('同 label 不同 source 仍算两条(不同知识库同名段落)', () => {
    const once = appendCitations(undefined, [a])
    expect(appendCitations(once, [{ ...a, source: 'faq' }])).toHaveLength(2)
  })
})
