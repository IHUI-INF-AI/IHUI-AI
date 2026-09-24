// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D83 装车证明:miniapp-taro 工具行主标题(toolRowTitle,ai-cards.tsx 与 task-status-bar.tsx
// 的渲染入口)已接上共享层 MCP server×tool 定制措辞。记录式 t 把"取了哪个键、带什么参数"
// 变成可断言文本,与同目录 tool-line.test.ts 同一取向;回落链各级(定制 → server 通用 →
// activityTool 句式)逐条钉死,任何一级都不允许空串或裸码名直接上界面。
import { describe, it, expect } from 'vitest'
import { toolRowTitle, type TranslateFn } from '@/pkg-ai/ai/cards/tool-line'
import type { ToolCallView } from '@/pkg-ai/ai/cards/types'

const t: TranslateFn = (key, params) => (params ? `${key}::${JSON.stringify(params)}` : key)

const call = (over: Partial<ToolCallView>): ToolCallView => ({
  id: 'c1',
  name: 'read_file',
  status: 'done',
  ...over,
})

describe('toolRowTitle MCP 定制措辞接线(D83)', () => {
  it('mcp × github create_issue running → server×tool 定制键 + 进行时 state', () => {
    expect(
      toolRowTitle(
        call({
          name: 'mcp__github__create_issue',
          serverSource: 'mcp',
          serverName: 'github',
          status: 'running',
        }),
        t,
      ),
    ).toBe('taskStatus.toolMcpGithubCreateIssueActivity::{"state":"running"}')
  })

  it('同工具 done → 同定制键 completed 档(双时态都走定制,不回落通用名)', () => {
    expect(
      toolRowTitle(
        call({
          name: 'github:create_pull_request',
          serverSource: 'mcp',
          serverName: 'github',
          status: 'done',
        }),
        t,
      ),
    ).toBe('taskStatus.toolMcpGithubCreatePullRequestActivity::{"state":"completed"}')
  })

  it('server 已登记而工具未登记 → 回落该 server 的通用条目(第二级)', () => {
    expect(
      toolRowTitle(
        call({
          name: 'mcp__github__brand_new_tool',
          serverSource: 'mcp',
          serverName: 'github',
          status: 'running',
        }),
        t,
      ),
    ).toBe('taskStatus.toolMcpServerGithubActivity::{"state":"running"}')
  })

  it('server 与工具都未登记 → 链尾 activityTool 句式带原始名,标题非空且不裸出键名', () => {
    const out = toolRowTitle(
      call({ name: 'mcp__demo__nope', serverSource: 'mcp', serverName: 'demo', status: 'running' }),
      t,
    )
    expect(out).toBe('taskStatus.activityTool::{"tool":"mcp__demo__nope"}')
    expect(out).not.toBe('')
    expect(out).not.toContain('toolMcp')
  })

  it('error 态不进双时态定制链(对失败调用声称"已 X"是假陈述)', () => {
    const out = toolRowTitle(
      call({
        name: 'mcp__github__create_issue',
        serverSource: 'mcp',
        serverName: 'github',
        status: 'error',
      }),
      t,
    )
    expect(out).not.toContain('toolMcpGithubCreateIssueActivity')
    expect(out).toBe('taskStatus.activityTool::{"tool":"mcp__github__create_issue"}')
  })

  it('内置工具行为不变(回归:read_file 仍出功能名键)', () => {
    expect(toolRowTitle(call({ name: 'read_file', status: 'done' }), t)).toBe(
      'taskStatus.toolReadFile',
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
