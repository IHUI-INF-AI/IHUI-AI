// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { completeCloudRun, resolveCloudRunBase, startCloudRun } from '../src/cloud-run.js'

// 记录最近一次 fetch 调用(url/method/headers/body),并返回可控 Response
let lastCall: { url: string; init: RequestInit } | null = null
let respondWith: { ok: boolean; status: number } = { ok: true, status: 200 }

function mockFetch(): void {
  vi.stubGlobal('fetch', vi.fn(async (url: string | URL, init?: RequestInit) => {
    lastCall = { url: String(url), init: init ?? {} }
    return new Response('{}', {
      status: respondWith.status,
      statusText: respondWith.ok ? 'OK' : 'Error',
    })
  }))
}

beforeEach(() => {
  lastCall = null
  respondWith = { ok: true, status: 200 }
  delete process.env.AI_SERVICE_URL
  mockFetch()
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.AI_SERVICE_URL
})

describe('resolveCloudRunBase', () => {
  it('默认 ai-service 地址', () => {
    expect(resolveCloudRunBase()).toBe('http://localhost:8803')
  })

  it('环境变量 AI_SERVICE_URL 优先,并剥掉尾部斜杠', () => {
    process.env.AI_SERVICE_URL = 'http://192.168.1.10:9000/'
    expect(resolveCloudRunBase()).toBe('http://192.168.1.10:9000')
  })
})

describe('startCloudRun', () => {
  it('成功:POST /api/cloud-runs/run,携带 Bearer 与完整契约 body,返回 run_id', async () => {
    const runId = await startCloudRun({
      task: '修复登录 bug',
      agentType: 'loop_v2',
      sessionAlias: 'sess-abc',
      apiKey: 'jwt-token-1',
    })
    expect(runId).toBeTruthy()
    expect(lastCall).not.toBeNull()
    expect(lastCall!.url).toBe('http://localhost:8803/api/cloud-runs/run')
    expect(lastCall!.init.method).toBe('POST')
    const headers = lastCall!.init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer jwt-token-1')
    expect(headers['Content-Type']).toBe('application/json')
    const body = JSON.parse(String(lastCall!.init.body)) as Record<string, string>
    expect(body.run_id).toBe(runId)
    expect(body.task).toBe('修复登录 bug')
    expect(body.agent_type).toBe('loop_v2')
    expect(body.session_alias).toBe('sess-abc')
  })

  it('task 超长截断到 2000 字符', async () => {
    const runId = await startCloudRun({ task: 'x'.repeat(3000), apiKey: 'k' })
    expect(runId).toBeTruthy()
    const body = JSON.parse(String(lastCall!.init.body)) as Record<string, string>
    expect(body.task.length).toBe(2000)
  })

  it('无 apiKey 时不携带 Authorization 头', async () => {
    const runId = await startCloudRun({ task: 't' })
    expect(runId).toBeTruthy()
    const headers = lastCall!.init.headers as Record<string, string>
    expect(headers.Authorization).toBeUndefined()
  })

  it('非 2xx 静默降级返回 null', async () => {
    respondWith = { ok: false, status: 401 }
    const runId = await startCloudRun({ task: 't', apiKey: 'bad' })
    expect(runId).toBeNull()
  })

  it('网络异常(抛出)静默降级返回 null,不向上抛', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('ECONNREFUSED')
    }))
    const runId = await startCloudRun({ task: 't', apiKey: 'k' })
    expect(runId).toBeNull()
  })
})

describe('completeCloudRun', () => {
  it('成功:PATCH /api/cloud-runs/run/<id>,done 状态带 output', async () => {
    const ok = await completeCloudRun({
      runId: 'run123',
      status: 'done',
      output: '任务完成',
      apiKey: 'jwt-token-1',
    })
    expect(ok).toBe(true)
    expect(lastCall!.url).toBe('http://localhost:8803/api/cloud-runs/run/run123')
    expect(lastCall!.init.method).toBe('PATCH')
    const body = JSON.parse(String(lastCall!.init.body)) as Record<string, string>
    expect(body.status).toBe('done')
    expect(body.output).toBe('任务完成')
    expect(body.error).toBe('')
  })

  it('error 状态映射与 error 字段透传', async () => {
    const ok = await completeCloudRun({
      runId: 'run123',
      status: 'error',
      error: 'boom',
      apiKey: 'k',
    })
    expect(ok).toBe(true)
    const body = JSON.parse(String(lastCall!.init.body)) as Record<string, string>
    expect(body.status).toBe('error')
    expect(body.error).toBe('boom')
  })

  it('runId 做 URL 编码,防路径注入', async () => {
    await completeCloudRun({ runId: 'a/b?c=1', status: 'done' })
    expect(lastCall!.url).toBe('http://localhost:8803/api/cloud-runs/run/a%2Fb%3Fc%3D1')
  })

  it('非 2xx 静默降级返回 false', async () => {
    respondWith = { ok: false, status: 500 }
    const ok = await completeCloudRun({ runId: 'run123', status: 'done' })
    expect(ok).toBe(false)
  })
})
