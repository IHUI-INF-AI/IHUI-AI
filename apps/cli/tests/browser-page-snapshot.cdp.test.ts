// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 真实浏览器取证：真 Chrome/Edge（headless）+ 真 HTTP 页 + 真 CDP 输入事件。
 *
 * 为什么必须有这个文件：上一份测试用的是合成行数据，只能证明宿主算法，
 * 证明不了"页内抓出来的东西真是这样"。这里跑的是 CLI 的真实工具路径
 * （browser_navigate → browser_page_snapshot → browser_page_click …），
 * 页面由本地 HTTP 服务提供（含同源 iframe 与超长正文），并额外抓一次公网真实页面。
 *
 * 四条判据在此的落点：
 * ① 同一 DOM 两轮快照句柄一致  ② 句柄失效返回错误码而不是崩
 * ③ 正文超预算不吃句柄配额    ④ 字段被截断后语义与句柄仍在
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as http from 'node:http'
import { promises as fs } from 'node:fs'
import * as net from 'node:net'
import type { AddressInfo } from 'node:net'
import { BROWSER_TOOLS } from '../src/tools/browser.js'
import { BROWSER_PAGE_TOOLS } from '../src/tools/browser-page.js'
import type { ToolContext } from '../src/tools/index.js'

const ctx: ToolContext = { workspacePath: process.cwd() }

function tool(name: string) {
  const found = [...BROWSER_TOOLS, ...BROWSER_PAGE_TOOLS].find((t) => t.name === name)
  if (!found) throw new Error(`工具未注册：${name}`)
  return found
}

const FIXTURE_ROWS = 46

function fixtureHtml(_port: number): string {
  const controls = Array.from({ length: FIXTURE_ROWS }, (_, i) => {
    if (i % 5 === 0) return `<button id="b${i}" data-testid="ctl-${i}">操作 ${i}</button>`
    if (i % 5 === 1) return `<input id="i${i}" type="text" placeholder="输入 ${i}" aria-label="字段 ${i}">`
    if (i % 5 === 2) return `<select id="s${i}" aria-label="下拉 ${i}"><option value="a">甲</option><option value="b">乙</option></select>`
    if (i % 5 === 3) return `<input id="c${i}" type="checkbox" aria-label="勾选 ${i}">`
    return `<a href="#link${i}" id="a${i}">链接 ${i}</a>`
  }).join('\n')
  const longParagraph = '这一段文字用来验证正文预算与句柄配额互不占用。'.repeat(40)
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>快照取证页</title></head>
<body>
  <h1>可动作元素在下面</h1>
  <button id="counter" onclick="window.__clicks = (window.__clicks || 0) + 1">点我计数</button>
  <input id="probe" type="text" placeholder="写点东西">
  <form id="demo"><label for="who">姓名</label><input id="who" name="who"><button type="submit">提交</button></form>
  <div>${controls}</div>
  <article><h2>长正文</h2>${Array.from({ length: 30 }, () => `<p>${longParagraph}</p>`).join('')}</article>
  <iframe title="内嵌" srcdoc="<!doctype html><meta charset='utf-8'><button id='inner'>内层按钮</button>"></iframe>
  <div id="removable"><button id="doomed">会被移除</button></div>
  <script>window.__clicks = 0; window.__typed = '';
    document.getElementById('probe').addEventListener('input', (e) => { window.__typed = e.target.value });
  </script>
</body></html>`
}

let server: http.Server | null = null
let baseUrl = ''
let publicUrlReachable = false

async function portReachable(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port, timeout: 4000 })
    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.once('error', () => resolve(false))
    socket.once('timeout', () => {
      socket.destroy()
      resolve(false)
    })
  })
}

beforeAll(async () => {
  server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(fixtureHtml(0))
  })
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve))
  const address = server!.address() as AddressInfo
  baseUrl = `http://127.0.0.1:${address.port}/fixture.html`
  publicUrlReachable = await portReachable('example.com', 443)
  const opened = await tool('browser_navigate').execute({ url: baseUrl }, ctx)
  expect(opened.success, opened.error ?? '').toBe(true)
}, 180_000)

afterAll(async () => {
  await tool('browser_close').execute({}, ctx).catch(() => undefined)
  await new Promise<void>((resolve) => {
    if (!server) return resolve()
    server.close(() => resolve())
  })
  // 自拉起的浏览器 profile 目录留在 TEMP，由 C 盘守门统一巡；这里只确认没有测试残留文件。
  await fs.stat('.ihui-agent/tmp').catch(() => undefined)
})

interface SnapshotData {
  scope: string
  counts: { interactiveFound: number; rowsEmitted: number; bodyCharsFound: number; crossOriginFrames: number }
  handles: string[]
}

async function snapshot(args: Record<string, unknown> = {}): Promise<{ text: string; data: SnapshotData }> {
  const result = await tool('browser_page_snapshot').execute(args, ctx)
  expect(result.success, result.error ?? '').toBe(true)
  return { text: result.output, data: result.data as unknown as SnapshotData }
}

function rowHandle(text: string, needle: string): string | undefined {
  const line = text.split('\n').find((l) => l.includes(`name=${needle}`) && l.includes('handle='))
  return line?.match(/handle=(el:[^\s]+)/)?.[1]
}

describe('真实页面（本地 HTTP）上的句柄语义', () => {
  it('① 同一 DOM 两轮快照句柄完全一致（活引用，不靠坐标重解析）', async () => {
    const first = await snapshot({ max_elements: 60, max_body_chars: 300 })
    const second = await snapshot({ max_elements: 60, max_body_chars: 300 })
    expect(first.data.handles.length).toBeGreaterThan(10)
    expect(second.data.handles).toEqual(first.data.handles)
    expect(second.data.scope).toBe(first.data.scope)
  })

  it('② 句柄失效返回结构化错误码，且明确"没派发事件、可安全重试"', async () => {
    const { text } = await snapshot({ max_elements: 300 })
    const handle = rowHandle(text, '会被移除')
    expect(handle, '句柄表里应有"会被移除"这一行').toBeDefined()
    // 让页面自己移除它的容器 —— 这才是"活引用失效"的真实成因（动态列表重排/组件卸载）。
    const removed = await tool('browser_evaluate').execute(
      { expression: `document.getElementById('removable').remove(); 'removed'` },
      ctx,
    )
    expect(removed.success).toBe(true)
    const result = await tool('browser_page_click').execute({ handle: handle! }, ctx)
    expect(result.success).toBe(false)
    expect(result.errorType).toBe('HANDLE_STALE')
    const payload = JSON.parse(result.output) as { sideEffect: string; dispatched: boolean; errorCode: string }
    expect(payload.errorCode).toBe('HANDLE_STALE')
    expect(payload.dispatched).toBe(false)
    expect(payload.sideEffect).toBe('none')
  })

  it('畸形句柄也走错误码通道，不抛异常', async () => {
    const result = await tool('browser_page_click').execute({ handle: 'css:#counter' }, ctx)
    expect(result.success).toBe(false)
    expect(result.errorType).toBe('HANDLE_MALFORMED')
  })

  it('③ 正文远超预算时句柄配额不被挤占（两本账互不挪用）', async () => {
    const tightBody = await snapshot({ max_elements: 40, max_body_chars: 400 })
    const looseBody = await snapshot({ max_elements: 40, max_body_chars: 12000 })
    expect(tightBody.data.handles).toEqual(looseBody.data.handles)
    expect(tightBody.data.handles.length).toBe(40)
    expect(tightBody.data.counts.interactiveFound).toBe(51)
    expect(tightBody.text).toContain('另有 11 个可交互元素未出表')
    const tightBodySection = tightBody.text.slice(tightBody.text.indexOf('## 正文语义'))
    const looseBodySection = looseBody.text.slice(looseBody.text.indexOf('## 正文语义'))
    expect(tightBodySection.length).toBeLessThan(looseBodySection.length)
    expect(tightBody.text).toContain('句柄配额与此互不占用')
  })

  it('④ 单行超预算时先掉定位细节，语义与句柄仍在', async () => {
    const { text } = await snapshot({ max_elements: 20, max_row_chars: 56, max_body_chars: 120 })
    // 只看"可动作元素"那一段：截断说明也以 `- ` 开头，混进来会把提示语当数据行断言。
    const from = text.indexOf('## 可动作元素')
    const toIndex = text.indexOf('## 正文语义')
    const to = toIndex > from ? toIndex : text.length
    const lines = text
      .slice(from, to)
      .split('\n')
      .filter((l) => l.startsWith('- ') && l.includes('handle='))
    expect(lines.length).toBeGreaterThan(0)
    expect(lines.filter((l) => l.includes('rect='))).toHaveLength(0)
    for (const line of lines) {
      expect(line).toMatch(/handle=el:[a-z0-9]{8}:[a-z0-9]+/)
      expect(line).toMatch(/role=[a-z]+/)
    }
    // 提示语如实说出丢了哪几个定位字段，且没把保护位列进去
    expect(text).toContain('超单行预算 56')
    expect(text).not.toMatch(/已丢弃 [^\n]*handle/)
  })

  it('同源 iframe 内的元素带 frame 路径，且句柄可用', async () => {
    const { text, data } = await snapshot({ max_elements: 300 })
    expect(text).toContain('frame=')
    expect(data.counts.crossOriginFrames).toBe(0)
  })

  it('按句柄点击真的改到了页面状态（真实输入事件，非伪造）', async () => {
    const { handles, text } = await (async () => {
      const snap = await snapshot({ max_elements: 300 })
      return { handles: snap.data.handles, text: snap.text }
    })()
    const counterHandle = (() => {
      const line = text.split('\n').find((l) => l.includes('name=点我计数'))
      const matched = line?.match(/handle=(el:[^\s]+)/)
      return matched ? matched[1] : undefined
    })()
    expect(counterHandle, `句柄表里找不到计数按钮，共 ${handles.length} 行`).toBeDefined()
    const clicked = await tool('browser_page_click').execute({ handle: counterHandle }, ctx)
    expect(clicked.success, clicked.error ?? '').toBe(true)
    expect(clicked.output).toContain('sideEffect=uncertain')
    const reads = await tool('browser_evaluate').execute({ expression: 'window.__clicks' }, ctx)
    expect(Number(reads.output)).toBeGreaterThanOrEqual(1)
  })

  it('按句柄输入走真实键盘通道，页面能读到值', async () => {
    const { text } = await snapshot({ max_elements: 300 })
    const line = text.split('\n').find((l) => l.includes('name=写点东西') && l.includes('role=textbox'))
    const matched = line?.match(/handle=(el:[^\s]+)/)
    expect(matched, '没抓到输入框句柄').toBeDefined()
    const typed = await tool('browser_page_type').execute(
      { handle: matched![1], text: '中文与 English', clear: true },
      ctx,
    )
    expect(typed.success, typed.error ?? '').toBe(true)
    const reads = await tool('browser_evaluate').execute(
      { expression: `document.getElementById('probe').value` },
      ctx,
    )
    expect(reads.output).toContain('中文与 English')
  })

  it('坐标反查现场发新句柄（句柄体系失效时的兜底动词）', async () => {
    const { text } = await snapshot({ max_elements: 300 })
    const line = text.split('\n').find((l) => l.includes('name=操作 5') && l.includes('rect='))
    expect(line, '行表里应有一行带 rect').toBeDefined()
    const rect = line!.match(/rect=(-?\d+),(-?\d+),(\d+),(\d+)/)!
    const cx = Number(rect[1]) + Number(rect[3]) / 2
    const cy = Number(rect[2]) + Number(rect[4]) / 2
    const picked = await tool('browser_page_pick_at_point').execute({ x: cx, y: cy }, ctx)
    expect(picked.success, picked.error ?? '').toBe(true)
    expect(String(picked.output)).toMatch(/el:[a-z0-9]{8}:[a-z0-9]+/)
    const offscreen = await tool('browser_page_pick_at_point').execute({ x: -1, y: 10 }, ctx)
    expect(offscreen.success).toBe(false)
    expect(offscreen.errorType).toBe('COORD_OUT_OF_BOUNDS')
  })
})

describe('扩展端页内 act() 通道（同一浏览器引擎、同一份页内实现）', () => {
  it('DOM 级派发确实改到页面状态，并标 uncertain', async () => {
    // 扩展 content script 没有 CDP，它走的是同一份页内实现的 act()；这里在真引擎里把它跑通，
    // 免得两端只有一端有取证、另一端的结论靠推断。
    const { text } = await snapshot({ max_elements: 300 })
    const select = rowHandle(text, '下拉 1')
    const probe = rowHandle(text, '写点东西')
    expect([select, probe].every(Boolean)).toBe(true)
    const callAct = (action: string, handle: string, params: Record<string, unknown>) =>
      tool('browser_evaluate').execute({
        expression: [
          '(function(){',
          'var h = this.__ihuiPageApiV1;',
          'var budget = { maxRows: 1, maxRowChars: 200, bodyChars: 1, maxBodyBlocks: 1, attrsChars: 90, labelChars: 40 };',
          `return h.api.act(${JSON.stringify(action)}, ${JSON.stringify(handle)}, ${JSON.stringify(params)}, budget);`,
          '})()',
        ].join(''),
      }, ctx)
    const typed = await callAct('page_type', probe!, { text: '页内派发', clear: true })
    expect(String(typed.output)).toContain('"dispatched": true')
    const readBack = await tool('browser_evaluate').execute({ expression: `document.getElementById('probe').value` }, ctx)
    expect(readBack.output).toContain('页内派发')
    const selected = await callAct('page_select', select!, { value: '乙' })
    expect(String(selected.output)).toContain('"dispatched": true')
    const unknown = await callAct('page_hover', 'el:deadbeef:999', {})
    expect(String(unknown.output)).toContain('HANDLE_SCOPE_MISMATCH')
  })
})

describe('公网真实页面（非合成夹具）', () => {
  it('example.com 上句柄表可产出且可解析', async (context) => {
    if (!publicUrlReachable) {
      context.skip()
      return
    }
    const opened = await tool('browser_navigate').execute({ url: 'https://example.com/' }, ctx)
    expect(opened.success, opened.error ?? '').toBe(true)
    const { text, data } = await snapshot({ max_elements: 20, max_body_chars: 800 })
    expect(data.scope).toMatch(/^[a-z0-9]{8}$/)
    expect(data.handles.length).toBeGreaterThan(0)
    for (const handle of data.handles) {
      expect(handle).toMatch(/^el:[a-z0-9]{8}:[a-z0-9]+$/)
    }
    // 导航换了文档 ⇒ 旧句柄整批作废，必须是 SCOPE_MISMATCH 而不是"没找到"
    const stale = await tool('browser_page_click').execute(
      { handle: 'el:zzzzzzzz:1' },
      ctx,
    )
    expect(stale.success).toBe(false)
    expect(stale.errorType).toBe('HANDLE_SCOPE_MISMATCH')
    expect(text).toContain('可动作元素')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
