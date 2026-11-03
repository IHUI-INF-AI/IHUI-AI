// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 工具活动行取词层行为契约:功能名 + 对象 + 结果度量 + 写类 ± 行数(未知不显示 0)
import { describe, it, expect } from 'vitest'
import {
  formatToolMetric,
  toolActivityText,
  toolDelta,
  toolDisplayName,
  localizeToolText,
  viewToolCall,
  type TranslateFn,
} from '@/pkg-ai/ai/cards/tool-line'
import type { ToolCallView } from '@/pkg-ai/ai/cards/types'

/** 记录式 t:把"取了哪个键、带什么参数"变成可断言文本(键缺失时 app 侧会回退,这里只验键名) */
const t: TranslateFn = (key, params) => (params ? `${key}::${JSON.stringify(params)}` : key)

const call = (over: Partial<ToolCallView>): ToolCallView => ({
  id: 'c1',
  name: 'read_file',
  status: 'done',
  ...over,
})

describe('toolDisplayName / localizeToolText', () => {
  it('内置工具码名 → taskStatus 功能名键', () => {
    expect(toolDisplayName('read_file', t)).toBe('taskStatus.toolReadFile')
    expect(toolDisplayName('browser_navigate', t)).toBe('taskStatus.toolBrowserNavigate')
  })
  it('计划步骤文本里的英文码名被替换,不残留 read_file', () => {
    const out = localizeToolText('read_file: src/a.ts', t)
    expect(out).toContain('taskStatus.toolReadFile')
    expect(out).not.toContain('read_file')
  })
})

describe('describeToolCall 接入(对象 + 度量)', () => {
  it('read_file 成功:对象取 path,度量按真实行数(末尾换行不算多一行)', () => {
    const view = viewToolCall(
      call({ args: { path: 'apps/web/src/a.ts' }, result: { content: 'a\nb\nc\nd' } }),
    )
    expect(view.subject).toBe('apps/web/src/a.ts')
    expect(view.subjectKind).toBe('path')
    expect(view.metricKind).toBe('lines')
    expect(view.metricValue).toBe(4)
    expect(formatToolMetric(view.metricKind, view.metricValue, t)).toBe(
      'taskStatus.unitLines::{"n":4}',
    )
  })
  it('running 态不出结果度量', () => {
    const view = viewToolCall(call({ status: 'running', args: { path: 'x.ts' } }))
    expect(view.metricKind).toBe('none')
    expect(formatToolMetric(view.metricKind, view.metricValue, t)).toBe('')
  })
  it('检索类工具度量为结果条数', () => {
    const view = viewToolCall(
      call({ name: 'search_codebase', args: { query: 'tool line' }, result: { results: [1, 2] } }),
    )
    expect(view.metricKind).toBe('results')
    expect(formatToolMetric(view.metricKind, view.metricValue, t)).toBe(
      'taskStatus.unitResults::{"n":2}',
    )
  })
})

describe('写类工具 ± 行数', () => {
  it('edit_file 带新旧内容:分别出 +n / -n 文案', () => {
    const view = viewToolCall(
      call({ name: 'edit_file', args: { path: 'a.ts', newText: '1\n2\n3', oldText: 'x' } }),
    )
    expect(view.writesFile).toBe(true)
    expect(toolDelta(view, t)).toEqual({
      added: 'taskStatus.addedCount::{"n":3}',
      removed: 'taskStatus.removedCount::{"n":1}',
    })
  })
  it('行数为 -1(未知)时两项都是 null —— 不得渲染 0 占位', () => {
    const view = viewToolCall(call({ name: 'write_file', args: { path: 'a.ts' }, result: 'ok' }))
    expect(view.added).toBe(-1)
    expect(toolDelta(view, t)).toEqual({ added: null, removed: null })
  })
})

describe('toolActivityText(流式活动行成品)', () => {
  it('功能名 · 对象 · 度量', () => {
    const text = toolActivityText(
      call({ args: { path: 'src/a.ts' }, result: { content: 'a\nb\n' } }),
      t,
      { withMetric: true },
    )
    expect(text).toBe('taskStatus.toolReadFile · src/a.ts · taskStatus.unitLines::{"n":2}')
  })
  it('未登记动态名回落"调用 {tool}",不裸显英文码名以外的东西', () => {
    const text = toolActivityText(call({ name: 'context7_search', status: 'running' }), t)
    expect(text).toBe('taskStatus.activityTool::{"tool":"context7_search"}')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
