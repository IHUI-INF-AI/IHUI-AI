// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// b76-08a 票2:连接级能力位由宿主注入 —— 行为钉子。
// 断言打在唯一名单/注入口(packages/types/src/agent-runtime.ts)与两个真实转发面
// (client.ts::fetchApi / fetchAiServiceJson)的生产源码上,不是平行导出。
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import {
  CONNECTION_CAPABILITY_FIELDS,
  stripClientCapabilityFields,
} from '../src/agent-runtime'

const REPO = resolve(__dirname, '../../..')

import { resolve } from 'node:path'

describe('b76-08a 连接级能力位名单与注入口', () => {
  it('名单封闭:五个连接级能力位,一个不多一个不少', () => {
    expect([...CONNECTION_CAPABILITY_FIELDS]).toEqual([
      'connectionId',
      'clientMode',
      'deliveryProfile',
      'subscriberScope',
      'workflowRunDeltas',
    ])
  })

  it('注入口摘除全部名单键,客户端自报一个都出不去', () => {
    const raw = {
      sessionId: 's1',
      connectionId: 'forged-conn',
      clientMode: 'bypass-all',
      deliveryProfile: 'admin',
      subscriberScope: 'global',
      workflowRunDeltas: true,
      keepMe: 'x',
    }
    const out = stripClientCapabilityFields(raw)
    for (const field of CONNECTION_CAPABILITY_FIELDS) {
      expect(field in out).toBe(false)
    }
    expect(out.sessionId).toBe('s1')
    expect(out.keepMe).toBe('x')
  })

  it('摘除不留 undefined 残影:"字段不存在"与"字段为空"必须可分', () => {
    const out = stripClientCapabilityFields({ clientMode: '', ok: 1 })
    expect('clientMode' in out).toBe(false)
    expect(out.ok).toBe(1)
  })

  it('不改建入参对象(调用方可能还持着原对象)', () => {
    const raw = { clientMode: 'forged' }
    stripClientCapabilityFields(raw)
    expect(raw.clientMode).toBe('forged')
  })

  it('接线钉子:client.ts 两个转发面(fetchApi/fetchAiServiceJson)都调注入口', () => {
    const src = readFileSync(resolve(REPO, 'packages/api-client/src/client.ts'), 'utf8')
    const callSites = src.match(/stripClientCapabilityFields\(rawParams\)/g) ?? []
    expect(callSites.length).toBeGreaterThanOrEqual(2)
  })

  it('跨端对账:engine.py 注入口摘同一份名单(逐字同形)', () => {
    const py = readFileSync(
      resolve(REPO, 'apps/ai-service/app/routers/engine.py'),
      'utf8',
    )
    for (const field of CONNECTION_CAPABILITY_FIELDS) {
      expect(py).toContain(`"${field}"`)
    }
    // 摘除必须发生在 _bind_principal 内(pop 语义,先删后写)
    expect(py).toMatch(/for _cap_field in _CONNECTION_CAPABILITY_FIELDS:\s*\n\s+params\.pop\(_cap_field, None\)/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
