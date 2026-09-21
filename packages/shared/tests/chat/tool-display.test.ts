// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import { describeToolCall, toolDisplayKey, toolSubjectBasename } from '../../src/chat/tool-display'

describe('toolDisplayKey', () => {
  it('内置工具映射到本地化功能名键', () => {
    expect(toolDisplayKey('read_file')).toBe('toolReadFile')
    expect(toolDisplayKey('file_edit')).toBe('toolEditFile')
    expect(toolDisplayKey('run_command')).toBe('toolRunCommand')
    expect(toolDisplayKey('web_ui_click')).toBe('toolUiClick')
    expect(toolDisplayKey('edu_send_fee_reminder')).toBe('toolEduSendReminder')
  })

  it('插件/MCP 动态名返回 null(由调用方回落,不得直显英文码名当作功能名)', () => {
    expect(toolDisplayKey('my_plugin_do_thing')).toBeNull()
  })
})

describe('describeToolCall 对象提取', () => {
  it('文件类工具取路径并把反斜杠统一成正斜杠', () => {
    const view = describeToolCall({
      toolName: 'read_file',
      args: { path: 'apps\\web\\src\\app\\page.tsx' },
    })
    expect(view.subjectKind).toBe('path')
    expect(view.subject).toBe('apps/web/src/app/page.tsx')
    expect(toolSubjectBasename(view.subject)).toBe('page.tsx')
  })

  it('检索类工具取检索词,不取无关字段', () => {
    const view = describeToolCall({
      toolName: 'search_codebase',
      args: { query: 'planSteps 持久化', extra: 'x' },
    })
    expect(view.subjectKind).toBe('query')
    expect(view.subject).toBe('planSteps 持久化')
  })

  it('命令类工具取 command 字段', () => {
    const view = describeToolCall({ toolName: 'run_command', args: { command: 'pnpm lint' } })
    expect(view.subjectKind).toBe('command')
    expect(view.subject).toBe('pnpm lint')
  })

  it('未登记工具按 路径→URL→检索词→命令→实体名 试探并猜类型', () => {
    const view = describeToolCall({
      toolName: 'custom_vendor_tool',
      // 完全不在任何探针键表里的字段 → 取不到对象,subject 为空
      args: { some_vendor_specific_field: 'https://aizhs.top/docs' },
    })
    expect(view.nameKey).toBeNull()
    expect(view.subject).toBe('')

    const withUrl = describeToolCall({
      toolName: 'custom_vendor_tool',
      args: { url: 'https://aizhs.top/docs' },
    })
    expect(withUrl.subjectKind).toBe('url')
    expect(withUrl.subject).toBe('https://aizhs.top/docs')
  })

  it('超长对象截断到固定上限,避免撑爆一行', () => {
    const view = describeToolCall({ toolName: 'read_file', args: { path: 'd/'.repeat(200) } })
    expect(view.subject.length).toBeLessThanOrEqual(160)
    expect(view.subject.endsWith('…')).toBe(true)
  })
})

describe('describeToolCall 结果度量', () => {
  it('读取类成功结果给真实行数(空行算一行,末尾换行不算额外一行)', () => {
    const view = describeToolCall({
      toolName: 'read_file',
      args: { path: 'a.ts' },
      status: 'success',
      result: { content: '1\n2\n\n3\n' },
    })
    expect(view.metricKind).toBe('lines')
    expect(view.metricValue).toBe(4)
  })

  it('检索类成功结果给命中数', () => {
    const view = describeToolCall({
      toolName: 'file_search',
      args: { query: 'x' },
      status: 'success',
      result: { results: [{}, {}, {}] },
    })
    expect(view.metricKind).toBe('results')
    expect(view.metricValue).toBe(3)
  })

  it('列表类结果按文件数计', () => {
    const view = describeToolCall({
      toolName: 'list_files',
      args: { dir: 'src' },
      status: 'success',
      result: { files: ['a', 'b'] },
    })
    expect(view.metricKind).toBe('files')
    expect(view.metricValue).toBe(2)
  })

  it('未完成时不给度量(不得把 0 当成"没有结果")', () => {
    const view = describeToolCall({
      toolName: 'read_file',
      args: { path: 'a.ts' },
      status: 'running',
      result: { content: '1\n2\n' },
    })
    expect(view.metricKind).toBe('none')
    expect(view.metricValue).toBeNull()
  })

  it('拿不到任何度量时 kind=none 且 value=null', () => {
    const view = describeToolCall({ toolName: 'generate_chart', args: {}, status: 'success' })
    expect(view.metricKind).toBe('none')
    expect(view.metricValue).toBeNull()
  })
})

describe('describeToolCall 写类文件', () => {
  it('写类工具给真实增删行,并抑制结果度量(行数和"多少行"不同时显示)', () => {
    const view = describeToolCall({
      toolName: 'write_file',
      args: { path: 'b.ts', content: '1\n2\n3\n', oldContent: '1\n' },
      status: 'success',
      result: { content: 'ok' },
    })
    expect(view.writesFile).toBe(true)
    expect(view.added).toBe(3)
    expect(view.removed).toBe(1)
    expect(view.metricKind).toBe('none')
  })

  it('非写类工具 added/removed 为 -1(渲染层不得显示 ±)', () => {
    const view = describeToolCall({ toolName: 'read_file', args: { path: 'b.ts' } })
    expect(view.writesFile).toBe(false)
    expect(view.added).toBe(-1)
    expect(view.removed).toBe(-1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
