// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ACP 发布产物 **真子进程** 端到端验证。
 *
 * 与另两个测试的分工(三层递进,缺一层就有盲区):
 *   ① `acp-session-replay.test.ts`       —— 类方法级:验业务语义
 *   ② `acp-session-lifecycle-e2e.test.ts` —— 进程内真 method registry:验"注册了没有"
 *   ③ 本文件                              —— 发布形态真子进程:验"装出去能不能用"
 *
 * ③ 解决盲区:①② 都跑在 vitest 的 bundler 解析下,而用户拿到的是
 * `npm-dist/dist/index.js`(esbuild 单文件)。历史上 `tsc` 直出的 `dist/`
 * 在原生 ESM 下会因为 `@ihui/shared` 导出 `.ts` 源码 + 无扩展名相对导入而
 * `ERR_MODULE_NOT_FOUND` —— 那条链路是坏的,①② 都发现不了。
 *
 * 若 `npm-dist` 不存在则跳过(CI 未构建时不误红),并在跳过时说明原因。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const cliRoot = path.resolve(import.meta.dirname, '..')
const bin = path.join(cliRoot, 'npm-dist', 'dist', 'index.js')
const hasBuild = fs.existsSync(bin)

let proc: ChildProcessWithoutNullStreams | null = null
let sessionsDir = ''
let buf = ''
let bootErr = ''
const pending = new Map<number, (m: Record<string, unknown>) => void>()
let nextId = 1

function request(method: string, params: unknown, timeoutMs = 25000) {
  const id = nextId++
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const t = setTimeout(() => {
      pending.delete(id)
      reject(new Error(`${method} 超时 ${timeoutMs}ms`))
    }, timeoutMs)
    pending.set(id, (m) => {
      clearTimeout(t)
      resolve(m)
    })
    proc!.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
  })
}

function seed(history: { role: string; content: string }[]) {
  const id = `sess_sub_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
  const now = new Date().toISOString()
  fs.writeFileSync(
    path.join(sessionsDir, `${id}.json`),
    JSON.stringify(
      { id, createdAt: now, updatedAt: now, workspacePath: process.cwd(), modelId: 'm', history },
      null,
      2,
    ),
    { mode: 0o600 },
  )
  return id
}

beforeAll(async () => {
  if (!hasBuild) return
  sessionsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-acp-sub-'))
  proc = spawn('node', [bin, 'acp'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
    env: { ...process.env, IHUI_CLI_SESSIONS_DIR: sessionsDir, IHUI_LOCALE: 'zh-CN' },
  }) as ChildProcessWithoutNullStreams
  proc.stderr.on('data', (d) => {
    bootErr += d.toString()
  })
  proc.stdout.on('data', (d) => {
    buf += d.toString()
    let i: number
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim()
      buf = buf.slice(i + 1)
      if (!line) continue
      let m: Record<string, unknown>
      try {
        m = JSON.parse(line)
      } catch {
        continue
      }
      const id = m.id as number | undefined
      if (id !== undefined && pending.has(id)) {
        pending.get(id)!(m)
        pending.delete(id)
      }
    }
  })
  // 单文件产物启动很快,给 15s 足够
  const t0 = Date.now()
  while (Date.now() - t0 < 15000) {
    await new Promise((r) => setTimeout(r, 400))
    try {
      const r = await request('initialize', {
        protocolVersion: 1,
        clientCapabilities: {},
        clientInfo: { name: 'sub', version: '1' },
      }, 4000)
      if (r.result) return
    } catch {
      /* 还没起 */
    }
  }
  throw new Error(`发布产物未就绪:${bootErr.slice(0, 400)}`)
}, 40_000)

afterAll(() => {
  try {
    proc?.kill()
  } catch {
    /* ignore */
  }
  if (sessionsDir) fs.rmSync(sessionsDir, { recursive: true, force: true })
})

describe.skipIf(!hasBuild)('ACP 发布产物真子进程(esbuild 单文件)', () => {
  it('initialize 可达', async () => {
    const r = await request('initialize', {
      protocolVersion: 1,
      clientCapabilities: {},
      clientInfo: { name: 'sub', version: '1' },
    })
    expect(r.error).toBeUndefined()
  })

  it('session/list 可达且看得到落盘会话', async () => {
    const id = seed([{ role: 'user', content: '子进程问题' }])
    const r = await request('session/list', { cwd: process.cwd() })
    expect(r.error).toBeUndefined()
    const list = (r.result as { sessions: { sessionId: string; title?: string | null }[] }).sessions
    const hit = list.find((s) => s.sessionId === id)
    expect(hit, '发布产物必须能列出会话').toBeDefined()
    expect(hit!.title).toBe('子进程问题')
  })

  it('session/resume 可达且回 window', async () => {
    const id = seed([
      { role: 'user', content: 'q' },
      { role: 'assistant', content: 'a' },
    ])
    const r = await request('session/resume', {
      sessionId: id,
      replayFrom: { type: 'ihui.replay/turn', last: 10 },
    })
    expect(r.error).toBeUndefined()
    expect((r.result as { _meta: { planKind: string } })._meta.planKind).toBe('window')
  })

  it('session/fork + session/delete 可达且落盘/清除', async () => {
    const id = seed([{ role: 'user', content: 'q' }])
    const f = await request('session/fork', { sessionId: id })
    expect(f.error).toBeUndefined()
    const fid = (f.result as { sessionId: string }).sessionId
    expect(fs.existsSync(path.join(sessionsDir, `${fid}.json`))).toBe(true)
    const d = await request('session/delete', { sessionId: fid })
    expect(d.error).toBeUndefined()
    expect(fs.existsSync(path.join(sessionsDir, `${fid}.json`))).toBe(false)
  })

  it('x.ai/checkpoint/list 可达(私有命名空间在发布形态同样在册)', async () => {
    const id = seed([{ role: 'user', content: 'q' }])
    const r = await request('x.ai/checkpoint/list', { sessionId: id })
    expect(r.error).toBeUndefined()
    expect(Array.isArray((r.result as { checkpoints: unknown[] }).checkpoints)).toBe(true)
  })

  it('未知方法回 -32601(反证:上面几个不是"什么都不回"的假绿)', async () => {
    const r = await request('session/definitelyNotAMethod', {})
    expect((r.error as { code: number }).code).toBe(-32601)
  })
})
