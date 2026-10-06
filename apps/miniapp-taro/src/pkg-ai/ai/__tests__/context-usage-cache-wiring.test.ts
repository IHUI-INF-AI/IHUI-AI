// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-403(2026-10-07):缓存读/写两维在 taro 端的接线用例。
// 端内 vitest 是 `environment:'node'`(无 jsdom,@tarojs/components 渲染级测不到),
// 与 waiting-text.test.ts 同一分层策略,这里只有**源码结构层**:
// 证明 chat.tsx 的 onUsage 确实把 info 的缓存两维接进 state、归因条确实把
// state 传进组件、组件确实把 props 交给共享引擎 —— 缺任一环,"上游回报了缓存
// 却被端内丢弃"这一型回归测不出红。三态口径(数字含 0=真回报;null=没采到)
// 由引擎层(packages/shared/tests/utils/context-attribution.test.ts)与
// api-client 解析面(stream-chat-usage-cache.test.ts U2/U3)钉住,本文件不重复。
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

describe('G-403 taro 接线(源码结构层)', () => {
  const chatPath = path.resolve(__dirname, '../chat.tsx')
  const chat = readFileSync(chatPath, 'utf8')

  it('chat.tsx 的 onUsage 把缓存两维接进 state(变异取证:摘掉赋值即红)', () => {
    const onUsageAt = chat.indexOf('onUsage: (info)')
    expect(onUsageAt).toBeGreaterThanOrEqual(0)
    const block = chat.slice(onUsageAt, onUsageAt + 600)
    expect(block).toContain('setLatestCacheTokens({')
    // 三态收敛判点:?? null 把"缺席(旧帧)"与"显式 null(没采到)"都归 null = 未知;
    // 数字(含 0)原样保留 —— 这两个 `?? null` 必须在场,缺了就会把缺席读成 undefined。
    expect(block).toContain('cacheReadTokens: info.cacheReadTokens ?? null')
    expect(block).toContain('cacheWriteTokens: info.cacheWriteTokens ?? null')
  })

  it('新流开始时重置上一轮缓存读数(旧账不得挂到新消息上)', () => {
    const resetAt = chat.indexOf('setLatestCacheTokens({ cacheReadTokens: null')
    expect(resetAt).toBeGreaterThanOrEqual(0)
    // 重置必须发生在流发起段(setThinking(true) 之后的收尾区),不是任意位置
    const streamStart = chat.indexOf('setThinking(true)')
    expect(streamStart).toBeGreaterThanOrEqual(0)
    expect(resetAt).toBeGreaterThan(streamStart)
  })

  it('归因条调用点把缓存两维传给 ContextUsageStrip', () => {
    const stripAt = chat.indexOf('<ContextUsageStrip')
    expect(stripAt).toBeGreaterThanOrEqual(0)
    const block = chat.slice(stripAt, stripAt + 500)
    expect(block).toContain('cacheReadTokens={latestCacheTokens.cacheReadTokens}')
    expect(block).toContain('cacheWriteTokens={latestCacheTokens.cacheWriteTokens}')
  })

  it('ContextUsageStrip 的 props 交给共享引擎(默认 null = 未知,不造 0)', () => {
    const strip = readFileSync(path.resolve(__dirname, '../context-usage-strip.tsx'), 'utf8')
    expect(strip).toMatch(/cacheReadTokens\?\s*:\s*number \| null/)
    expect(strip).toMatch(/cacheWriteTokens\?\s*:\s*number \| null/)
    // 渲染位折叠:?? null 在场;且不再有"硬编码 null 顶掉上游字段"的旧形态
    expect(strip).toContain('cacheReadTokens: cacheReadTokens ?? null')
    expect(strip).toContain('cacheWriteTokens: cacheWriteTokens ?? null')
    expect(strip).not.toMatch(/^.*cacheReadTokens: null,.*$/m)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
