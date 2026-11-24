// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 阶段 0 冻结钉子:本地 agent 引擎必须支持的 SSE 帧子集 + 34 工具白名单。
// 锁三条不变量:① 本地帧集合 ⊆ 中央契约(不私自造帧)② 白名单恒为 34(倒退即红)
// ③ 白名单里不得混入已知云端工具(源码外发/外部检索等)。
import { describe, expect, it } from 'vitest'

import { SSE_EVENTS } from '../src/sse/contract'
import {
  LOCAL_ENGINE_FRAME_KEYS,
  LOCAL_ENGINE_FRAME_NAMES,
  LOCAL_ENGINE_TOOL_WHITELIST,
} from '../src/sse/local-engine-frames'

const ALL_CENTRAL_NAMES = new Set(Object.values(SSE_EVENTS))

describe('本地引擎帧子集(阶段 0 冻结)', () => {
  it('本地帧集合非空且是中央契约的子集(不私自造帧)', () => {
    expect(LOCAL_ENGINE_FRAME_NAMES.length).toBeGreaterThan(0)
    for (const name of LOCAL_ENGINE_FRAME_NAMES) {
      expect(ALL_CENTRAL_NAMES.has(name)).toBe(true)
    }
  })

  it('LOCAL_ENGINE_FRAME_KEYS 每条都是 SSE_EVENTS 的真实 key(派生而非重抄)', () => {
    for (const key of LOCAL_ENGINE_FRAME_KEYS) {
      expect(SSE_EVENTS).toHaveProperty(key)
    }
    // 派生正确性:names 顺序与 keys 一一对应
    expect(LOCAL_ENGINE_FRAME_NAMES).toEqual(LOCAL_ENGINE_FRAME_KEYS.map((k) => SSE_EVENTS[k]))
  })

  it('覆盖第一批验收用例所需的全部核心帧', () => {
    const names = new Set(LOCAL_ENGINE_FRAME_NAMES)
    // 用例 1-4 逐帧对齐所需(见 阶段2_第一批验收用例.md)
    for (const required of [
      'start',
      'chunk',
      'reasoning',
      'thinking',
      'plan-step',
      'tool-call-start',
      'tool-delta',
      'tool-result',
      'terminal_start',
      'terminal_delta',
      'terminal_end',
      'tool-approval',
      'partial_done',
      'done',
      'error',
      'usage',
    ]) {
      expect(names.has(required as never)).toBe(true)
    }
  })

  it('刻意不含云端/业务域帧(子集策略的直接体现)', () => {
    const names = new Set(LOCAL_ENGINE_FRAME_NAMES)
    for (const excluded of ['review-finding', 'form_request', 'goal_updated', 'subagent_spawn', 'subagent_end']) {
      expect(names.has(excluded as never)).toBe(false)
    }
  })
})

describe('本地引擎工具白名单(阶段 0 冻结)', () => {
  it('恒为 34 个(倒退即红,只拦新增不放松)', () => {
    expect(LOCAL_ENGINE_TOOL_WHITELIST.length).toBe(34)
  })

  it('无重复工具名', () => {
    const set = new Set(LOCAL_ENGINE_TOOL_WHITELIST)
    expect(set.size).toBe(LOCAL_ENGINE_TOOL_WHITELIST.length)
  })

  it('不得混入已知云端工具(读 handler 确认过外部依赖)', () => {
    const cloudOnly = new Set([
      'index_codebase', // 源码切片外发外部 embedding
      'generate_test', // 调 llm_gateway
      'vision_analyze', // 调视觉模型
      'review_pr', // httpx 拉 PR
      'search_web',
      'web_search',
      'fetch_url',
      'dispatch_subagent', // 子代理级联
      'db_query', // 服务器 DB
    ])
    for (const tool of LOCAL_ENGINE_TOOL_WHITELIST) {
      expect(cloudOnly.has(tool)).toBe(false)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
