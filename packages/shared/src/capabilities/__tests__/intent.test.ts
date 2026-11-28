// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import { AGENT_READY_CAPABILITIES, getCapability } from '../catalog'
import {
  CAPABILITY_INTENT_RULES,
  START_SUGGESTION_CAPABILITY_IDS,
  buildCapabilityLaunchHref,
  listStartSuggestionCapabilities,
  normalizeCapabilityIntentText,
  rankCapabilityIntents,
  resolveCapabilityIntent,
} from '../intent'

describe('normalizeCapabilityIntentText', () => {
  it('把全角标点、连续空白压成单空格并转小写', () => {
    expect(normalizeCapabilityIntentText('  写一篇，公众号！文章？ ')).toBe('写一篇 公众号 文章')
    expect(normalizeCapabilityIntentText('Write A Post')).toBe('write a post')
  })
})

describe('resolveCapabilityIntent 命中', () => {
  const cases: Array<[string, string]> = [
    ['帮我写一篇公众号文章', 'content.generate'],
    ['写个口播稿，口语化一点', 'content.script'],
    ['把这篇发到小红书和公众号', 'publish.dispatch'],
    ['看看上周发布数据', 'publish.analytics'],
    ['发布失败了怎么重试', 'publish.task'],
    ['账号掉线了，帮我保活', 'account.health'],
    ['生成一张封面图', 'media.image'],
    ['把文档解析一下', 'tool.doc.parse'],
    ['做个柱状图', 'tool.chart.generate'],
    ['翻译成英文', 'content.translate'],
    ['排期到明天上午', 'publish.schedule'],
    ['检查一下内容有没有违规', 'content.compliance'],
    ['这个标题起得不好，换个标题', 'content.title'],
    ['支持哪些平台', 'publish.platforms'],
    ['把资料入库', 'knowledge.ingest'],
    ['把这篇同步到三个平台', 'publish.dispatch'],
  ]

  it.each(cases)('%s → %s', (query, expectedId) => {
    const resolution = resolveCapabilityIntent(query)
    expect(resolution.kind).toBe('resolved')
    expect(resolution.best?.capability.id).toBe(expectedId)
  })

  it('“发布数据”不会被“发布”抢走', () => {
    const resolution = resolveCapabilityIntent('看看上周发布数据')
    expect(resolution.best?.capability.id).toBe('publish.analytics')
    expect(resolution.matches.map((item) => item.capability.id)).toContain('publish.dispatch')
  })

  it('“发布失败”落到任务详情而不是重新发布', () => {
    const resolution = resolveCapabilityIntent('发布失败了怎么重试')
    expect(resolution.best?.capability.id).toBe('publish.task')
  })
})

describe('resolveCapabilityIntent 边界', () => {
  it('空输入返回 empty，不抛异常', () => {
    expect(resolveCapabilityIntent('   ')).toEqual({
      kind: 'empty',
      query: '',
      best: null,
      matches: [],
    })
  })

  it('完全无关的句子交给对话兜底', () => {
    expect(resolveCapabilityIntent('今天天气怎么样').kind).toBe('agent')
  })

  it('写代码不会被当成写出稿', () => {
    expect(resolveCapabilityIntent('帮我写代码').kind).toBe('agent')
  })

  it('两个能力打平 → ambiguous，给候选而不是硬跳', () => {
    const resolution = resolveCapabilityIntent('账号数据')
    expect(resolution.kind).toBe('ambiguous')
    expect(resolution.matches.length).toBeGreaterThanOrEqual(2)
    expect(resolution.matches.length).toBeLessThanOrEqual(3)
  })

  it('同一输入多次解析结果稳定', () => {
    const a = resolveCapabilityIntent('把这篇发到小红书和公众号')
    const b = resolveCapabilityIntent('把这篇发到小红书和公众号')
    const c = resolveCapabilityIntent('把这篇发到小红书和公众号')
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    expect(JSON.stringify(b)).toBe(JSON.stringify(c))
  })

  it('候选数量受 limit 约束', () => {
    const ranked = rankCapabilityIntents('发布 数据 账号 视频')
    const resolution = resolveCapabilityIntent('发布 数据 账号 视频', { limit: 2 })
    expect(ranked.length).toBeGreaterThan(2)
    expect(resolution.matches.length).toBeLessThanOrEqual(2)
  })
})

describe('规则表与能力目录对齐', () => {
  it('每条规则的 capabilityId 都真实存在', () => {
    const missing = CAPABILITY_INTENT_RULES.filter((rule) => !getCapability(rule.capabilityId))
    expect(missing).toEqual([])
  })

  it('没有重复登记同一条能力', () => {
    const ids = CAPABILITY_INTENT_RULES.map((rule) => rule.capabilityId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('所有 agent-ready 能力都能被一句话叫出来', () => {
    const covered = new Set(CAPABILITY_INTENT_RULES.map((rule) => rule.capabilityId))
    const uncovered = AGENT_READY_CAPABILITIES.map((capability) => capability.id).filter(
      (id) => !covered.has(id),
    )
    expect(uncovered).toEqual([])
  })

  it('关键词归一化后都不为空', () => {
    for (const rule of CAPABILITY_INTENT_RULES) {
      for (const keyword of rule.keywords) {
        expect(normalizeCapabilityIntentText(keyword).length).toBeGreaterThan(0)
      }
    }
  })
})

describe('落点与默认票', () => {
  it('跳转 URL 带上原话种子并正确编码', () => {
    const match = rankCapabilityIntents('写一篇公众号文章')[0]
    expect(match).toBeDefined()
    if (!match) return
    const href = buildCapabilityLaunchHref(match, '写 文章')
    expect(href).toBe(`/ai-generation?q=${encodeURIComponent('写 文章')}`)
  })

  it('没有页面落点的能力返回 null，让 UI 回落对话', () => {
    const planned = getCapability('knowledge.export')
    expect(planned).toBeDefined()
    if (!planned) return
    const href = buildCapabilityLaunchHref(
      { capability: planned, score: 1, matched: [] },
      '导出资料',
    )
    expect(href).toBeNull()
  })

  it('一句话出稿的落点是出稿页，不是回 /start 打转', () => {
    expect(getCapability('content.pipeline')?.uiHref).toBe('/publish/ai-draft')
  })

  it('默认四张票都能解析到对应能力', () => {
    const list = listStartSuggestionCapabilities()
    expect(list.map((capability) => capability.id)).toEqual([...START_SUGGESTION_CAPABILITY_IDS])
  })
})
