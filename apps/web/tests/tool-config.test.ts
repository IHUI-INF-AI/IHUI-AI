// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'
// mergeAgentTools 是纯函数,只从 useChatStore.getState() 读 selectedTools/webSearchEnabled。
// 这里 mock 掉 chat store(真实 store 依赖 localStorage 时序与重依赖链),可控注入状态。
const storeState = vi.hoisted(() => {
  return {
    state: { selectedTools: [] as string[], webSearchEnabled: false },
  }
})
vi.mock('@/stores/chat', () => ({
  useChatStore: {
    getState: () => storeState.state,
  },
}))
import { AGENT_TOOLS, mergeAgentTools } from '../src/hooks/use-chat/tool-config'
describe('mergeAgentTools — D22 网页搜索开关消费(2026-09-19 立)', () => {
  beforeEach(() => {
    storeState.state.selectedTools = []
    storeState.state.webSearchEnabled = false
  })
  it('普通问答(无插件工具 + 开关关):返回空数组,保住打字机流式(2026-08-29 回归)', () => {
    expect(mergeAgentTools()).toEqual([])
  })
  it('开关开 + 无插件工具:仅返回 web_search 最小工具集(不携带全套 AGENT_TOOLS)', () => {
    storeState.state.webSearchEnabled = true
    expect(mergeAgentTools()).toEqual(['web_search'])
  })
  it('开关开 + 已选插件工具:走完整 AGENT_TOOLS 合并路径,开关不额外附加', () => {
    storeState.state.webSearchEnabled = true
    storeState.state.selectedTools = ['filesystem-mcp']
    const tools = mergeAgentTools()
    // AGENT_TOOLS 已含 web_search,开关不应产生重复;插件增量 write_file 必须出现
    expect(tools.filter((t) => t === 'web_search')).toHaveLength(1)
    expect(tools).toContain('write_file')
    expect(tools.length).toBe(new Set(tools).size)
    expect(new Set(tools)).toEqual(new Set([...AGENT_TOOLS, 'write_file']))
  })
  it('插件工具合并去重(未知 pluginId 忽略,AGENT_TOOLS 顺序保留)', () => {
    storeState.state.selectedTools = ['playwright-mcp', 'unknown-plugin']
    const tools = mergeAgentTools()
    // 12 browser_* 工具全部在 AGENT_TOOLS 内 → 去重后等于 AGENT_TOOLS
    expect(tools.length).toBe(AGENT_TOOLS.length)
    expect(tools).toEqual([...AGENT_TOOLS])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
