// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 语义快照句柄(browser.ts 那套 CDP 工具)的取证。
 *
 * 四条判据:
 * ① 同一文档连续两次快照,同一元素 ref 稳定不变;
 * ② ref 与 selector 二选一(同时给 / 都不给 = 参数错误,不静默取其一);
 * ③ 导航换文档后旧 ref 显式失效,且**没派发任何事件**(不许静默点错元素);
 * ④ 既有 selector 路径逐字不变(输出契约回归)。
 *
 * 页面由本地 HTTP 服务提供,浏览器走 browser_navigate 自带的 headless 拉起;
 * 机器上既没有 Chrome/Edge 也没配 IHUI_BROWSER_CDP_URL 时,整组真浏览器用例 skip 并打印原因
 * (显式 skip,不假绿)。
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as http from 'node:http'
import type { AddressInfo } from 'node:net'
import { BROWSER_TOOLS, findChromeExecutable } from '../src/tools/browser.js'
import type { Tool, ToolContext } from '../src/tools/index.js'

const ctx: ToolContext = { workspacePath: process.cwd() }

function tool(name: string): Tool {
  const found = BROWSER_TOOLS.find((t) => t.name === name)
  if (!found) throw new Error(`工具未注册:${name}`)
  return found
}

interface RefRow {
  ref: string
  body: string
}

/** 从快照文本里抠出 `- [e3] button#submit: 提交` 这族行(只认 `交互元素:` 段落之后)。 */
function parseRows(text: string): RefRow[] {
  const start = text.indexOf('交互元素:')
  if (start < 0) return []
  const rows: RefRow[] = []
  for (const line of text.slice(start).split('\n')) {
    const matched = /^- \[(e\d+)\] (.+)$/.exec(line)
    if (matched) rows.push({ ref: matched[1]!, body: matched[2]! })
  }
  return rows
}

async function snapshotRows(): Promise<RefRow[]> {
  const result = await tool('browser_snapshot').execute({ text_limit: 800 }, ctx)
  expect(result.success, result.error ?? '').toBe(true)
  return parseRows(result.output)
}

const externalCdpUrl = process.env.IHUI_BROWSER_CDP_URL
const browserAvailable = Boolean(findChromeExecutable()) || Boolean(externalCdpUrl)
if (!browserAvailable) {
  console.warn(
    '[browser-element-handle] 跳过真浏览器用例:未找到 Chrome/Edge 可执行文件(IHUI_BROWSER_EXECUTABLE / 常见安装位),也未设置 IHUI_BROWSER_CDP_URL。',
  )
}

/**
 * 自拉起的浏览器独占端口。共享工作区里 9222 上常常已经挂着别人会话的实例,而
 * browser_close 会真的把浏览器关掉 —— 抢过来用等于打断别人的取证。
 * 外部已显式配置 IHUI_BROWSER_CDP_URL 时按用户指定,不覆盖。
 */
const ISOLATED_CDP_PORT = 9321

describe('定位参数二选一(不依赖浏览器)', () => {
  it('同时给 ref 与 selector ⇒ 参数错误', async () => {
    const click = await tool('browser_click').execute({ selector: '#counter', ref: 'e1' }, ctx)
    expect(click.success).toBe(false)
    expect(click.errorType).toBe('param_invalid')
    expect(click.error).toContain('二选一')

    const type = await tool('browser_type').execute({ selector: '#probe', ref: 'e1', text: 'x' }, ctx)
    expect(type.success).toBe(false)
    expect(type.errorType).toBe('param_invalid')
    expect(type.error).toContain('二选一')
  })

  it('两者都不给 ⇒ 参数错误', async () => {
    const click = await tool('browser_click').execute({}, ctx)
    expect(click.success).toBe(false)
    expect(click.errorType).toBe('param_invalid')
    expect(click.error).toContain('必须提供 ref 或 selector')

    const type = await tool('browser_type').execute({ text: 'x' }, ctx)
    expect(type.success).toBe(false)
    expect(type.errorType).toBe('param_invalid')
    expect(type.error).toContain('必须提供 ref 或 selector')
  })

  it('text 仍是 browser_type 的必填参数(selector 已给出时口径不变)', async () => {
    const result = await tool('browser_type').execute({ selector: '#probe' }, ctx)
    expect(result.success).toBe(false)
    expect(result.error).toBe('缺少必填参数 text(string)')
  })

  it('从未发出过的 ref ⇒ 显式失败并提示先快照(不回退空选择器)', async () => {
    const result = await tool('browser_click').execute({ ref: 'e987654' }, ctx)
    expect(result.success).toBe(false)
    expect(result.errorType).toBe('stale_ref')
    expect(result.error).toContain('未知元素句柄 e987654')
    expect(result.error).toContain('browser_snapshot')
  })
})

const FIXTURE_A = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>句柄取证页 A</title></head>
<body>
  <h1>句柄取证页 A</h1>
  <button id="counter" type="button">点我计数</button>
  <input id="probe" name="probe" type="text" placeholder="写点东西">
  <button id="submit" type="button">提交</button>
  <a id="jump" href="#anchor">锚点链接</a>
  <script>
    window.__clicks = 0;
    window.__typed = '';
    document.getElementById('counter').addEventListener('click', function () { window.__clicks += 1 });
    document.getElementById('probe').addEventListener('input', function (e) { window.__typed = e.target.value });
  </script>
</body></html>`

const FIXTURE_B = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>句柄取证页 B</title></head>
<body>
  <h1>句柄取证页 B</h1>
  <button id="other" type="button">另一页按钮</button>
  <script>
    window.__otherClicks = 0;
    document.getElementById('other').addEventListener('click', function () { window.__otherClicks += 1 });
  </script>
</body></html>`

describe.skipIf(!browserAvailable)('语义快照句柄(真浏览器)', () => {
  let server: http.Server | null = null
  let pageA = ''
  let pageB = ''

  beforeAll(async () => {
    // 没有外部指定端点时,让自拉起的浏览器落在独占端口(见 ISOLATED_CDP_PORT 注释)。
    if (!externalCdpUrl) {
      process.env.IHUI_BROWSER_CDP_URL = `http://127.0.0.1:${ISOLATED_CDP_PORT}`
    }
    server = http.createServer((req, res) => {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      res.end(req.url === '/b.html' ? FIXTURE_B : FIXTURE_A)
    })
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve))
    const address = server.address() as AddressInfo
    pageA = `http://127.0.0.1:${address.port}/a.html`
    pageB = `http://127.0.0.1:${address.port}/b.html`
    const opened = await tool('browser_navigate').execute({ url: pageA }, ctx)
    expect(opened.success, opened.error ?? '').toBe(true)
  }, 180_000)

  afterAll(async () => {
    await tool('browser_close').execute({}, ctx).catch(() => undefined)
    if (!externalCdpUrl) delete process.env.IHUI_BROWSER_CDP_URL
    await new Promise<void>((resolve) => {
      if (!server) return resolve()
      server.close(() => resolve())
    })
  })

  it('① 同一页面连续两次快照,同一元素 ref 稳定不变', async () => {
    const first = await snapshotRows()
    const second = await snapshotRows()
    expect(first.length).toBeGreaterThanOrEqual(4)
    // 逐行等值 = 同一元素同 ref、同一顺序、同一正文
    expect(second).toEqual(first)
    // 号段唯一且形如 eN
    expect(new Set(first.map((row) => row.ref)).size).toBe(first.length)
    for (const row of first) {
      expect(row.ref).toMatch(/^e\d+$/)
    }
    // 按正文再对齐一次:即使顺序变了,同一元素也必须还是同一 ref
    const refByBody = new Map(first.map((row) => [row.body, row.ref]))
    for (const row of second) {
      expect(refByBody.get(row.body)).toBe(row.ref)
    }
  }, 60_000)

  it('② ref 点击走真实鼠标事件,页面状态真的变了', async () => {
    const rows = await snapshotRows()
    const counter = rows.find((row) => row.body.includes('点我计数'))
    expect(counter, '句柄表里应有计数按钮').toBeDefined()
    const clicked = await tool('browser_click').execute({ ref: counter!.ref }, ctx)
    expect(clicked.success, clicked.error ?? '').toBe(true)
    expect(clicked.output).toContain(`已点击 ref ${counter!.ref}`)
    const reads = await tool('browser_evaluate').execute({ expression: 'window.__clicks' }, ctx)
    expect(Number(reads.output)).toBeGreaterThanOrEqual(1)
  }, 60_000)

  it('③ ref 输入走真实键盘通道,页面能读到值', async () => {
    const rows = await snapshotRows()
    const probe = rows.find((row) => row.body.includes('name=probe'))
    expect(probe, '句柄表里应有输入框').toBeDefined()
    const typed = await tool('browser_type').execute(
      { ref: probe!.ref, text: '中文与 English', clear: true },
      ctx,
    )
    expect(typed.success, typed.error ?? '').toBe(true)
    const readBack = await tool('browser_evaluate').execute(
      { expression: `document.getElementById('probe').value` },
      ctx,
    )
    expect(readBack.output).toContain('中文与 English')
  }, 60_000)

  it('④ 导航后旧 ref 显式失效,且没有派发任何事件', async () => {
    const rows = await snapshotRows()
    const submit = rows.find((row) => row.body.includes('#submit'))
    expect(submit, '句柄表里应有提交按钮').toBeDefined()
    const staleRef = submit!.ref

    const opened = await tool('browser_navigate').execute({ url: pageB }, ctx)
    expect(opened.success, opened.error ?? '').toBe(true)

    const stale = await tool('browser_click').execute({ ref: staleRef }, ctx)
    expect(stale.success).toBe(false)
    expect(stale.errorType).toBe('stale_ref')
    expect(stale.error).toMatch(/失效/)
    expect(stale.error).toContain('browser_snapshot')

    // 没点错元素:新页面自己的计数器仍是 0(新文档里也有可交互元素,但旧号不得自动生效)
    const before = await tool('browser_evaluate').execute({ expression: 'window.__otherClicks' }, ctx)
    expect(Number(before.output)).toBe(0)

    // 重新快照之后,新文档的 ref 立刻可用 —— 失效不是死路,出路就是重拍一张
    const fresh = await snapshotRows()
    expect(fresh.length).toBeGreaterThan(0)
    const retried = await tool('browser_click').execute({ ref: fresh[0]!.ref }, ctx)
    expect(retried.success, retried.error ?? '').toBe(true)
    const after = await tool('browser_evaluate').execute({ expression: 'window.__otherClicks' }, ctx)
    expect(Number(after.output)).toBe(1)
  }, 90_000)

  it('⑤ 既有 selector 路径逐字不变(点击 / 输入 / 找不到)', async () => {
    const opened = await tool('browser_navigate').execute({ url: pageA }, ctx)
    expect(opened.success, opened.error ?? '').toBe(true)

    const clicked = await tool('browser_click').execute({ selector: '#counter' }, ctx)
    expect(clicked.success, clicked.error ?? '').toBe(true)
    expect(clicked.output).toMatch(/^已点击 #counter\(中心坐标 \d+,\d+\)\n当前页面: /)

    const typed = await tool('browser_type').execute({ selector: '#probe', text: 'selector 路径', clear: true }, ctx)
    expect(typed.success, typed.error ?? '').toBe(true)
    expect(typed.output).toMatch(/^已向 #probe 输入 \d+ 字符\n当前值: selector 路径/)
    const readBack = await tool('browser_evaluate').execute(
      { expression: `document.getElementById('probe').value` },
      ctx,
    )
    expect(readBack.output).toContain('selector 路径')

    const missing = await tool('browser_click').execute({ selector: '#nope' }, ctx)
    expect(missing.success).toBe(false)
    expect(missing.errorType).toBe('not_found')
    expect(missing.error).toBe('元素不存在: #nope')
  }, 90_000)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
