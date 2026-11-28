// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工具名解析 —— 钉三件事：
 *   ① 只差格式(`GitMerge` / `git-merge` / 尾随空格)时按注册名执行，不再白烧一轮；
 *   ② 归一化后多枚撞车 ⇒ 判歧义、拒绝执行(猜一个比报错更坏)；
 *   ③ 真的没找到时，错误里必须带**可执行的近名建议**，而不是一句"未知工具"了事。
 *
 * 口径边界:这里测的是"名字层"的鲁棒性，不测模型为什么会写错名字。
 */
import { describe, expect, it } from 'vitest'
import {
  executeToolCall,
  getTool,
  registerTools,
  clearTools,
  type Tool,
} from '../src/tools/index.js'
import { normalizeToolName, resolveToolName, suggestToolNames } from '../src/tools/tool-name-resolve.js'

const WS = process.cwd()

function fakeTool(name: string, marker: string): Tool {
  return {
    name,
    description: `fake ${marker}`,
    parameters: { path: { type: 'string', description: '路径' } },
    required: ['path'],
    dangerLevel: 'read',
    async execute() {
      return { success: true, output: marker }
    },
  } as Tool
}

describe('工具名归一化(纯函数)', () => {
  it('大小写与分隔符差异归一化到同一个键', () => {
    expect(normalizeToolName('Git_Merge')).toBe('gitmerge')
    expect(normalizeToolName('git-merge')).toBe('gitmerge')
    expect(normalizeToolName(' git merge ')).toBe('gitmerge')
  })

  it('精确名优先，格式差异唯一命中才解析', () => {
    const names = ['read_file', 'write_file', 'grep']
    expect(resolveToolName('read_file', names)).toBe('read_file')
    expect(resolveToolName('ReadFile', names)).toBe('read_file')
    expect(resolveToolName('READ-FILE', names)).toBe('read_file')
    expect(resolveToolName('read', names)).toBeUndefined()
  })

  it('归一化后撞车判歧义，不替模型挑一个', () => {
    const names = ['foo_bar', 'foobar']
    expect(resolveToolName('Foo-Bar', names)).toBeUndefined()
  })

  it('近名建议按相似度给，最多三个', () => {
    const names = ['read_file', 'write_file', 'grep', 'read_pdf']
    const got = suggestToolNames('read', names, 3)
    expect(got).toContain('read_file')
    expect(got).toContain('read_pdf')
    expect(got.length).toBeLessThanOrEqual(3)
  })
})

describe('工具名解析(执行面)', () => {
  it('格式差异的名字会被真正执行，且改写成注册名', async () => {
    clearTools()
    registerTools([fakeTool('marker_read', 'ran')])
    const call = { name: 'Marker-Read', arguments: { path: 'x' } }
    const r = await executeToolCall(call, { workspacePath: WS, permissions: {} })
    expect(r.success).toBe(true)
    expect(r.output).toBe('ran')
    // 后续权限/审计/钩子看到的名字必须是被执行的注册名
    expect(call.name).toBe('marker_read')
    expect(getTool('marker_read')).toBeDefined()
  })

  it('传输包装(functions. / mcp__server__ / _tool)也会被真正执行并改写', async () => {
    for (const raw of ['functions.marker_read', 'mcp__ihui__marker_read', 'marker_read_tool']) {
      clearTools()
      registerTools([fakeTool('marker_read', 'ran')])
      const call = { name: raw, arguments: { path: 'x' } }
      const r = await executeToolCall(call, { workspacePath: WS, permissions: {} })
      expect(r.success, raw).toBe(true)
      expect(call.name).toBe('marker_read')
    }
  })

  it('未知工具要给近名建议，模型能在同一轮改对', async () => {    clearTools()
    registerTools([fakeTool('marker_read', 'ran')])
    const r = await executeToolCall({ name: 'read', arguments: { path: 'x' } }, { workspacePath: WS, permissions: {} })
    expect(r.success).toBe(false)
    expect(r.errorType).toBe('not_found')
    expect(String(r.error)).toContain('marker_read')
    expect(String(r.error)).toContain('closest matches')
  })

  it('歧义名一律不执行(两个候选只差分隔符时)', async () => {
    clearTools()
    const a = fakeTool('ambig_one', 'a')
    const b = fakeTool('ambigone', 'b')
    registerTools([a, b])
    const r = await executeToolCall({ name: 'ambig-one', arguments: { path: 'x' } }, { workspacePath: WS, permissions: {} })
    expect(r.success).toBe(false)
    expect(r.errorType).toBe('not_found')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
