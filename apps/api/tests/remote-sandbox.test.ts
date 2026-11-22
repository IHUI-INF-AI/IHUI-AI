// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 远程沙箱后端单测（2026-11-20）。
 *
 * 钉住五件事：
 * ① 默认关闭、缺 url / apiKey / 非法 URL 一律关闭并给 reason（fail-closed，不半开）；
 * ② 只有 `IHUI_SANDBOX_BACKEND=remote` + url + apiKey 齐备才启用，超时/输出上限有硬顶；
 * ③ 成功路径带 Bearer 与后端头，回 stdout/exitCode/backend=remote；
 * ④ 非 2xx / 非 JSON / 超时 / 不可达都落结构化 exitCode（126/127），不抛到调用方；
 * ⑤ 输出预算取头 60% + 尾 40%，尾部结论不丢。
 */
import { createServer, type Server } from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { truncateBothEnds } from '../src/services/output-budget.js'
import {
  executeRemoteSandbox,
  resolveRemoteSandbox,
  REMOTE_SANDBOX_MAX_TIMEOUT_MS,
} from '../src/services/remote-sandbox.js'

let server: Server
let baseUrl = ''
let lastBody: Record<string, unknown> | null = null
let lastAuth = ''
let mode: 'ok' | 'http500' | 'badjson' | 'slow' | 'echo' = 'ok'

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += String(chunk)
    })
    req.on('end', () => {
      lastAuth = String(req.headers.authorization ?? '')
      try {
        lastBody = JSON.parse(raw) as Record<string, unknown>
      } catch {
        lastBody = null
      }
      if (mode === 'http500') {
        res.statusCode = 500
        res.end('boom')
        return
      }
      if (mode === 'badjson') {
        res.setHeader('content-type', 'text/plain')
        res.end('not json')
        return
      }
      if (mode === 'slow') {
        setTimeout(() => {
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ stdout: 'late', stderr: '', exitCode: 0 }))
        }, 1500)
        return
      }
      res.setHeader('content-type', 'application/json')
      if (mode === 'echo') {
        res.end(
          JSON.stringify({
            stdout: raw,
            stderr: '',
            exitCode: 0,
          }),
        )
        return
      }
      res.end(
        JSON.stringify({
          stdout: 'hello\n',
          stderr: 'warn\n',
          exitCode: 0,
        }),
      )
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
  const addr = server.address()
  baseUrl = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`
})

afterAll(() => {
  server.close()
})

const CFG = () => ({
  url: baseUrl,
  apiKey: 'test-key',
  timeoutMs: 5_000,
  maxOutputChars: 4_000,
})

describe('远程沙箱后端', () => {
  it('R1 默认关闭（未设置 backend）', () => {
    const r = resolveRemoteSandbox({})
    expect(r.enabled).toBe(false)
    expect(r.reason).toContain('remote')
  })

  it('R2 缺 url / apiKey 各自点名关闭原因', () => {
    expect(resolveRemoteSandbox({ IHUI_SANDBOX_BACKEND: 'remote' }).reason).toContain(
      'IHUI_SANDBOX_URL',
    )
    expect(
      resolveRemoteSandbox({ IHUI_SANDBOX_BACKEND: 'remote', IHUI_SANDBOX_URL: 'https://x.test' })
        .reason,
    ).toContain('IHUI_SANDBOX_API_KEY')
  })

  it('R3 非法协议关闭；合法配置启用且超时有硬顶', () => {
    expect(
      resolveRemoteSandbox({
        IHUI_SANDBOX_BACKEND: 'remote',
        IHUI_SANDBOX_URL: 'ftp://x.test',
        IHUI_SANDBOX_API_KEY: 'k',
      }).reason,
    ).toContain('协议')
    const ok = resolveRemoteSandbox({
      IHUI_SANDBOX_BACKEND: 'remote',
      IHUI_SANDBOX_URL: 'https://x.test/',
      IHUI_SANDBOX_API_KEY: 'k',
      IHUI_SANDBOX_TIMEOUT_MS: '9999999',
    })
    expect(ok.enabled).toBe(true)
    expect(ok.config?.url).toBe('https://x.test')
    expect(ok.config?.timeoutMs).toBe(REMOTE_SANDBOX_MAX_TIMEOUT_MS)
  })

  it('R4 成功路径：Bearer 头 + 请求体字段齐全 + 回 backend=remote', async () => {
    mode = 'ok'
    const r = await executeRemoteSandbox(CFG(), {
      command: 'echo hi',
      workspacePath: '/ws',
      mode: 'workspace-write',
    })
    expect(lastAuth).toBe('Bearer test-key')
    expect(lastBody?.['command']).toBe('echo hi')
    expect(lastBody?.['mode']).toBe('workspace-write')
    expect(r.exitCode).toBe(0)
    expect(r.stdout).toBe('hello\n')
    expect(r.backend).toBe('remote')
    expect(r.truncated).toBe(false)
  })

  it('R5 非 2xx → exitCode 126', async () => {
    mode = 'http500'
    const r = await executeRemoteSandbox(CFG(), {
      command: 'ls',
      workspacePath: '/ws',
      mode: 'workspace-write',
    })
    expect(r.exitCode).toBe(126)
    expect(r.stderr).toContain('500')
  })

  it('R6 非 JSON → exitCode 127', async () => {
    mode = 'badjson'
    const r = await executeRemoteSandbox(CFG(), {
      command: 'ls',
      workspacePath: '/ws',
      mode: 'workspace-write',
    })
    expect(r.exitCode).toBe(127)
    expect(r.stderr).toContain('JSON')
  })

  it('R7 超时 → exitCode 127 且点名超时', async () => {
    mode = 'slow'
    const r = await executeRemoteSandbox(
      { ...CFG(), timeoutMs: 1_000 },
      { command: 'sleep', workspacePath: '/ws', mode: 'workspace-write', timeoutMs: 1_000 },
    )
    expect(r.exitCode).toBe(127)
    expect(r.stderr).toContain('超时')
  })

  it('R8 不可达 → exitCode 127', async () => {
    const r = await executeRemoteSandbox(
      { ...CFG(), url: 'http://127.0.0.1:1' },
      { command: 'ls', workspacePath: '/ws', mode: 'workspace-write' },
    )
    expect(r.exitCode).toBe(127)
    expect(r.stderr).toContain('不可达')
  })

  it('R9 超大输出按 maxOutputChars 截断且保留尾部', async () => {
    mode = 'echo'
    const huge = `${'A'.repeat(9_000)}TAIL_MARK`
    const r = await executeRemoteSandbox(
      { ...CFG(), maxOutputChars: 2_000 },
      { command: huge, workspacePath: '/ws', mode: 'workspace-write' },
    )
    expect(r.truncated).toBe(true)
    expect(r.stdout.length).toBeLessThan(2_100)
    expect(r.stdout).toContain('输出截断')
    expect(r.stdout).toContain('TAIL_MARK')
  })

  it('R10 输出预算：短文本不动，长文本头尾都在', () => {
    const shortText = truncateBothEnds('abc', 10)
    expect(shortText.truncated).toBe(false)
    expect(shortText.text).toBe('abc')
    const longText = truncateBothEnds(`${'H'.repeat(1_000)}MIDDLE${'T'.repeat(1_000)}`, 200)
    expect(longText.truncated).toBe(true)
    expect(longText.text.startsWith('H')).toBe(true)
    expect(longText.text.endsWith('T')).toBe(true)
    expect(longText.text).not.toContain('MIDDLE')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
