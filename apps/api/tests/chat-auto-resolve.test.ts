// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 聊天 auto 号池决策腿测试(2026-11-22 立)。
 *
 * 只测纯判据:候选合法化(classifyCandidate 的隔离口径)与决策规则(pickAutoPoolModel)。
 * IO 壳(查库/内部票/fetch)有 fail-open 兜底,不属于本文件的钉住面 —— 那层的失效
 * 方向是「回平台腿」,由 resolveAutoChatRoute 的 try/catch 结构保证,不在此复制。
 */

import { describe, expect, it } from 'vitest'

import { classifyCandidate, pickAutoPoolModel } from '../src/services/chat-auto-resolve.js'

describe('classifyCandidate(候选合法化:隔离口径)', () => {
  const own = new Set(['cursor', 'doubao'])
  const ops = new Map([
    ['kimi-k2.7-code', 'agnes'],
    ['cursor/composer-2.5', 'workbuddy'],
  ])

  it('命中本人号池平台前缀 ⇒ own', () => {
    expect(classifyCandidate('cursor/composer-2.5', own, new Map())).toBe('own')
    expect(classifyCandidate('doubao/doubao-seed-2.1', own, new Map())).toBe('own')
  })

  it('命中运营池公开登记行(原样 id)⇒ ops', () => {
    expect(classifyCandidate('kimi-k2.7-code', new Set(), ops)).toBe('ops')
  })

  it('运营池登记行优先于平台前缀判定', () => {
    // cursor 平台在 own 平台集里,但该 id 也是运营池登记行 ⇒ ops(公开目录是对账真源)
    expect(classifyCandidate('cursor/composer-2.5', own, ops)).toBe('ops')
  })

  it('别人的平台前缀 ⇒ null(用户之间隔离)', () => {
    expect(classifyCandidate('qoder/qmodel_38max', own, new Map())).toBeNull()
  })

  it('裸名未登记 ⇒ null(没有前缀也没有登记行命中)', () => {
    expect(classifyCandidate('some-unknown-model', own, ops)).toBeNull()
  })

  it('非法前缀(非中继平台)不因前缀误判 own', () => {
    // 'glm/xxx' 的 glm 不是 RELAY_PROVIDERS 成员 ⇒ providerFromModelPrefix 返回 null
    expect(classifyCandidate('glm/glm-5', own, new Map())).toBeNull()
  })
})

describe('pickAutoPoolModel(决策规则)', () => {
  const legal = [
    { id: 'cursor/composer-2.5', source: 'own' as const },
    { id: 'doubao/doubao-seed-2.1', source: 'own' as const },
    { id: 'kimi-k2.7-code', source: 'ops' as const },
  ]

  it('普通任务:本人号池第一个优先(自家号 0 平台积分成本)', () => {
    expect(pickAutoPoolModel(legal, 'simple', new Map())).toEqual({
      channel: 'pool',
      model: 'cursor/composer-2.5',
      source: 'own',
    })
  })

  it('普通任务:无本人号池时落运营池公开第一个', () => {
    const opsOnly = legal.filter((c) => c.source === 'ops')
    expect(pickAutoPoolModel(opsOnly, 'trivial', new Map())).toEqual({
      channel: 'pool',
      model: 'kimi-k2.7-code',
      source: 'ops',
    })
  })

  it('复杂任务:号池有 latest 档 ⇒ 用之(本人号池优先)', () => {
    const tiers = new Map([
      ['cursor/composer-2.5', 'latest'],
      ['kimi-k2.7-code', 'latest'],
    ])
    expect(pickAutoPoolModel(legal, 'expert', tiers)).toEqual({
      channel: 'pool',
      model: 'cursor/composer-2.5',
      source: 'own',
    })
  })

  it('复杂任务:号池无 latest ⇒ platform(宁可平台 premium,不用普通档凑合)', () => {
    const tiers = new Map([
      ['cursor/composer-2.5', 'standard'],
      ['kimi-k2.7-code', 'legacy'],
    ])
    expect(pickAutoPoolModel(legal, 'complex', tiers)).toEqual({
      channel: 'platform',
      model: null,
      source: null,
    })
  })

  it('复杂任务:代次判不了(空表)⇒ platform("不知道多新"与"知道它旧"等价)', () => {
    expect(pickAutoPoolModel(legal, 'expert', new Map())).toEqual({
      channel: 'platform',
      model: null,
      source: null,
    })
  })

  it('候选为空 ⇒ platform', () => {
    expect(pickAutoPoolModel([], 'simple', new Map())).toEqual({
      channel: 'platform',
      model: null,
      source: null,
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
