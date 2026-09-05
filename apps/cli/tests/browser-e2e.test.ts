// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * browser.ts 工具集端到端测试(真实 Chrome headless + 本地 HTTP 页面)。
 *
 * 默认跳过;满足以下两个条件时运行:
 *   1. 环境变量 IHUI_BROWSER_E2E=1
 *   2. 本机可发现 Chrome/Edge 可执行文件
 * 运行方式: cd apps/cli && IHUI_BROWSER_E2E=1 npx vitest run tests/browser-e2e.test.ts
 *
 * 覆盖真实链路(非 mock):
 * - 自动拉起 headless Chrome → CDP WebSocket 会话建立
 * - browser_navigate → 真实页面加载 + 标题/文本返回
 * - browser_type → 真实 Input.insertText 键盘输入 + clear 清空
 * - browser_click → 真实 Input.dispatchMouseEvent 点击触发页面 JS(计数器 +1)
 * - browser_press_key → 真实 Enter 键事件触发页面 keydown 监听
 * - browser_evaluate → 页面主世界执行 JS 并读取状态
 * - browser_snapshot → 交互元素大纲提取
 * - browser_screenshot → PNG 文件落盘且魔数正确
 * - browser_close → 会话关闭 + 自拉起浏览器进程终止
 */

import * as http from 'node:http'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BROWSER_TOOLS, findChromeExecutable } from '../src/tools/browser.js'
import type { ToolContext } from '../src/tools/index.js'

const E2E_ENABLED = process.env.IHUI_BROWSER_E2E === '1'
const CHROME_FOUND = findChromeExecutable() !== undefined

/** 测试页面:输入框 + 计数按钮 + Enter 监听,供真实输入事件验证。 */
const PAGE_HTML = `<!DOCTYPE html>
<html><head><title>IHUI E2E 测试页</title></head>
<body>
  <h1>浏览器工具 E2E</h1>
  <input id="name-input" name="username" placeholder="请输入姓名" />
  <button id="inc-btn" onclick="window.__clicks=(window.__clicks||0)+1;document.getElementById('click-count').textContent=String(window.__clicks)">点我加一</button>
  <span id="click-count">0</span>
  <div id="enter-log"></div>
  <script>
    document.getElementById('name-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('enter-log').textContent = 'enter-received';
    });
  </script>
</body></html>`

function tool(name: string) {
  const t = BROWSER_TOOLS.find((x) => x.name === name)
  if (!t) throw new Error(`工具未注册: ${name}`)
  return t
}

describe.skipIf(!E2E_ENABLED || !CHROME_FOUND)('browser 工具真实 CDP 端到端(需 IHUI_BROWSER_E2E=1 + 本机 Chrome)', () => {
  let server: http.Server
  let baseUrl: string
  let workspace: string
  let ctx: ToolContext

  beforeAll(async () => {
    server = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(PAGE_HTML)
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const addr = server.address()
    const port = typeof addr === 'object' && addr ? addr.port : 0
    baseUrl = `http://127.0.0.1:${port}/`
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-browser-e2e-'))
    ctx = { workspacePath: workspace }
  }, 30_000)

  afterAll(async () => {
    await tool('browser_close').execute({}, ctx)
    server.close()
    fs.rmSync(workspace, { recursive: true, force: true })
  }, 30_000)

  it('browser_navigate: 自动拉起 headless Chrome 并加载页面', async () => {
    const result = await tool('browser_navigate').execute({ url: baseUrl }, ctx)
    expect(result.success).toBe(true)
    expect(result.output).toContain('IHUI E2E 测试页')
    expect(result.output).toContain('浏览器工具 E2E')
  }, 90_000)

  it('browser_type: 真实键盘输入且 clear 生效', async () => {
    const fill = await tool('browser_type').execute(
      { selector: '#name-input', text: 'IHUI-AI' },
      ctx,
    )
    expect(fill.success).toBe(true)
    expect(fill.output).toContain('IHUI-AI')
    const cleared = await tool('browser_type').execute(
      { selector: '#name-input', text: '李春川', clear: true },
      ctx,
    )
    expect(cleared.success).toBe(true)
    expect(cleared.output).toContain('李春川')
    expect(cleared.output).not.toContain('IHUI-AI')
  }, 30_000)

  it('browser_click: 真实鼠标事件触发页面计数器', async () => {
    const result = await tool('browser_click').execute({ selector: '#inc-btn' }, ctx)
    expect(result.success).toBe(true)
    const read = await tool('browser_evaluate').execute(
      { expression: 'window.__clicks' },
      ctx,
    )
    expect(read.success).toBe(true)
    expect(read.output).toBe('1')
  }, 30_000)

  it('browser_press_key: 真实 Enter 键触发页面 keydown 监听', async () => {
    const result = await tool('browser_press_key').execute(
      { key: 'Enter', selector: '#name-input' },
      ctx,
    )
    expect(result.success).toBe(true)
    const read = await tool('browser_evaluate').execute(
      { expression: "document.getElementById('enter-log').textContent" },
      ctx,
    )
    expect(read.success).toBe(true)
    expect(read.output).toBe('enter-received')
  }, 30_000)

  it('browser_snapshot: 返回标题、URL 与交互元素大纲', async () => {
    const result = await tool('browser_snapshot').execute({}, ctx)
    expect(result.success).toBe(true)
    expect(result.output).toContain('IHUI E2E 测试页')
    expect(result.output).toContain('#name-input')
    expect(result.output).toContain('#inc-btn')
  }, 30_000)

  it('browser_screenshot: PNG 落盘且魔数正确', async () => {
    const savePath = path.join('e2e-shot.png')
    const result = await tool('browser_screenshot').execute({ save_path: savePath }, ctx)
    expect(result.success).toBe(true)
    const abs = path.resolve(workspace, savePath)
    const buf = fs.readFileSync(abs)
    expect(buf.length).toBeGreaterThan(1000)
    expect(buf.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  }, 30_000)

  it('browser_evaluate: 支持表达式求值与 Promise await', async () => {
    const result = await tool('browser_evaluate').execute(
      { expression: 'Promise.resolve(21 * 2)' },
      ctx,
    )
    expect(result.success).toBe(true)
    expect(result.output).toBe('42')
  }, 30_000)

  it('browser_click: 不存在的选择器返回 not_found 且不抛错', async () => {
    const result = await tool('browser_click').execute({ selector: '#nonexistent' }, ctx)
    expect(result.success).toBe(false)
    expect(result.error).toContain('元素不存在')
  }, 30_000)

  it('browser_close: 关闭会话并终止自拉起浏览器', async () => {
    const result = await tool('browser_close').execute({}, ctx)
    expect(result.success).toBe(true)
    expect(result.output).toContain('进程已终止')
  }, 30_000)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
