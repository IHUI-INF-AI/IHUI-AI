// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * browser.ts 工具集单元测试(真实 CDP 实现,无浏览器依赖的安全路径)。
 *
 * 覆盖:
 * - BROWSER_TOOLS 注册完整性:8 个工具 / 命名唯一 / schema 字段齐全 / dangerLevel
 * - registerBrowserTools → getTool 可查询
 * - 参数校验:缺必填参数时在拉起浏览器前即 fail
 * - browser_close 无会话时的幂等安全行为
 * - findChromeExecutable:IHUI_BROWSER_EXECUTABLE 环境变量优先
 */

import { describe, expect, it, vi } from 'vitest'
import { BROWSER_TOOLS, findChromeExecutable } from '../src/tools/browser.js'
import { clearTools, getTool, listTools, registerBrowserTools, type ToolContext } from '../src/tools/index.js'

const ctx: ToolContext = { workspacePath: process.cwd() }

describe('BROWSER_TOOLS 注册完整性', () => {
  it('包含 8 个工具且命名唯一', () => {
    const names = BROWSER_TOOLS.map((t) => t.name)
    expect(names).toHaveLength(8)
    expect(new Set(names).size).toBe(8)
    expect(names).toEqual([
      'browser_navigate',
      'browser_snapshot',
      'browser_screenshot',
      'browser_click',
      'browser_type',
      'browser_press_key',
      'browser_evaluate',
      'browser_close',
    ])
  })

  it('每个工具 schema 字段齐全(name/description/parameters/execute)', () => {
    for (const t of BROWSER_TOOLS) {
      expect(t.name).toMatch(/^browser_/)
      expect(t.description.length).toBeGreaterThan(10)
      expect(typeof t.parameters).toBe('object')
      expect(typeof t.execute).toBe('function')
    }
  })

  it('操作类工具 dangerLevel 为 write', () => {
    for (const name of ['browser_navigate', 'browser_click', 'browser_type', 'browser_evaluate']) {
      expect(BROWSER_TOOLS.find((t) => t.name === name)?.dangerLevel).toBe('write')
    }
  })

  it('registerBrowserTools 注册后 getTool 可查询', () => {
    clearTools()
    registerBrowserTools()
    const list = listTools()
    expect(list.length).toBeGreaterThanOrEqual(8)
    expect(getTool('browser_navigate')).toBeDefined()
    expect(getTool('browser_evaluate')).toBeDefined()
    expect(getTool('browser_close')).toBeDefined()
    clearTools()
  })
})

describe('参数校验(浏览器未拉起前)', () => {
  it('browser_navigate 缺 url → fail 且不拉起浏览器', async () => {
    const tool = BROWSER_TOOLS.find((t) => t.name === 'browser_navigate')!
    const result = await tool.execute({}, ctx)
    expect(result.success).toBe(false)
    expect(result.error).toContain('缺少必填参数 url')
  })

  it('browser_navigate 空 url → fail', async () => {
    const tool = BROWSER_TOOLS.find((t) => t.name === 'browser_navigate')!
    const result = await tool.execute({ url: '' }, ctx)
    expect(result.success).toBe(false)
  })

  it('browser_evaluate 缺 expression → fail', async () => {
    const tool = BROWSER_TOOLS.find((t) => t.name === 'browser_evaluate')!
    const result = await tool.execute({}, ctx)
    expect(result.success).toBe(false)
    expect(result.error).toContain('缺少必填参数 expression')
  })
})

describe('browser_close 幂等安全行为', () => {
  it('无活动会话时返回成功且不抛错', async () => {
    const tool = BROWSER_TOOLS.find((t) => t.name === 'browser_close')!
    const result = await tool.execute({}, ctx)
    expect(result.success).toBe(true)
    expect(result.output).toContain('已关闭')
  })
})

describe('findChromeExecutable', () => {
  it('IHUI_BROWSER_EXECUTABLE 环境变量优先', () => {
    vi.stubEnv('IHUI_BROWSER_EXECUTABLE', 'C:\\custom\\my-browser.exe')
    try {
      expect(findChromeExecutable()).toBe('C:\\custom\\my-browser.exe')
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
