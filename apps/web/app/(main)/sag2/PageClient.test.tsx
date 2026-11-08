// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

/**
 * SAG2 工作台 UI 层真测试。
 *
 * 关键约定：**绝不 vi.mock('@/lib/api')**。
 * 本文件只旁路「展示层原子组件(@ihui/ui-react)」与「i18n 文案字典(next-intl)」，
 * 二者都不属于被测的解包链路。网络层全程真实：
 *   PageClient → sag2-lexical.ts → @/lib/api(apiOrThrow/fetchApi)
 *   → @ihui/api-client(fetchApi/fetchOnce/validateEnvelopeInbound) → transport → global fetch
 * fetch 由 vi.stubGlobal 注入真实 HTTP 响应字节，因此 {code,message,data} 信封解包、
 * 严格白名单契约校验、code!=0 业务错误、HTTP 5xx、网络重试、畸形 JSON 全部走生产实现。
 */
vi.mock('next-intl', () => {
  const dict: Record<string, string> = {
    title: 'SAG2 词法多跳检索',
    subtitle: '零模型建库 · 查询时关联 · 引用可直达原文',
    ready: '索引就绪',
    empty: '索引为空',
    version: '版本',
    documents: '文档',
    chunks: '块',
    terms: '词项',
    judgeProvider: '判定器',
    docsTitle: '文档登记',
    docsPath: '路径',
    docsContent: '正文',
    pathPlaceholder: 'kb/example.txt',
    contentPlaceholder: '粘贴或输入文档正文…',
    add: '登记 / 更新',
    remove: '移除',
    added: '已登记（建库零模型调用）',
    unchanged: '文件 hash 未变，跳过重建',
    removed: '已移除块数',
    queryTitle: '检索',
    queryPlaceholder: '输入问题，可跨文档多跳关联…',
    quick: '快速搜索',
    deep: '多跳检索',
    fuse: 'RRF 融合',
    emptyResult: '暂无结果，请先登记文档',
    loading: '处理中…',
    error: '请求失败',
    modelCalls: '模型调用 0 次',
    judgeOff: '证据判断未执行（纯词法判定）',
    trace: '检索轨迹',
    tracePool: '候选池',
    traceTerms: '扩展词',
    citations: '引用锚点',
    score: '得分',
    bm25: 'BM25',
    hop: '跳',
  }
  return { useTranslations: () => (key: string) => dict[key] ?? key }
})

vi.mock('@ihui/ui-react', () => ({
  Button: ({ variant: _variant, children, ...rest }: Record<string, unknown>) => (
    <button {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}>{children as React.ReactNode}</button>
  ),
  Input: (props: Record<string, unknown>) => <input {...(props as React.InputHTMLAttributes<HTMLInputElement>)} />,
}))

import PageClient from './PageClient'

/* -------------------------------------------------------------------------- */
/* fetch 端：注入真实 HTTP 响应字节，并记录每一次调用的 URL/method/body         */
/* -------------------------------------------------------------------------- */

type OkReply = { status?: number; body: string }
type ErrReply = { reject: unknown }
type PendingReply = { pending: true }
type Reply = OkReply | ErrReply | PendingReply
type SettledReply = OkReply | ErrReply
type FetchCall = { url: string; init: RequestInit }

function installFetch(replies: Reply[]) {
  const calls: FetchCall[] = []
  const pendingResolvers: Array<(value: SettledReply) => void> = []
  let index = 0
  const fn = vi.fn(async (input: unknown, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : String(input)
    calls.push({ url, init: init ?? {} })
    const picked = replies[Math.min(index, replies.length - 1)]!
    index += 1
    const reply: SettledReply = 'pending' in picked
      ? await new Promise<SettledReply>((resolve) => {
          pendingResolvers.push(resolve)
        })
      : picked
    if ('reject' in reply) throw reply.reject
    const status = reply.status ?? 200
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: { get: () => null },
      text: async () => reply.body,
      json: async () => JSON.parse(reply.body),
    } as unknown as Response
  })
  vi.stubGlobal('fetch', fn)
  return {
    calls,
    fn,
    resolvePending(value: SettledReply) {
      const resolve = pendingResolvers.shift()
      if (!resolve) throw new Error('没有等待中的 fetch')
      resolve(value)
    },
  }
}

const ok = (data: unknown): OkReply => ({
  status: 200,
  body: JSON.stringify({ code: 0, message: 'ok', data }),
})
function expectCall(
  calls: FetchCall[],
  index: number,
  url: string,
  method: string,
  body?: Record<string, unknown>,
): FetchCall {
  const call = calls[index]!
  expect(call.url).toBe(url)
  expect((call.init.method ?? 'GET').toUpperCase()).toBe(method)
  if (body !== undefined) {
    expect(JSON.parse(String(call.init.body)) as unknown).toEqual(body)
  }
  return call
}

/* -------------------------------------------------------------------------- */
/* 真实响应体载荷                                                              */
/* -------------------------------------------------------------------------- */

const STATUS = {
  version: 3,
  documents: 2,
  chunks: 9,
  terms: 128,
  avg_chunk_length: 120.5,
  ready: true,
  backend: 'bm25',
  judge_provider: 'none',
}

const CITATION = {
  path: 'kb/a.txt',
  title: '组织手册',
  heading: '管理层',
  doc_hash: 'sha256:abcdef123456',
  byte_range: [0, 128],
  start_line: 1,
  end_line: 6,
  passage: 'CTO 是张三',
  score: 0.91,
  bm25: 4.2,
  hop: 1,
}

const SEARCH_RESULT = {
  query: '谁收购了B公司？',
  mode: 'bm25',
  model_calls: 0,
  total_files: 1,
  page: 1,
  per_page: 20,
  items: [
    {
      path: 'kb/a.txt',
      title: '组织手册',
      snippet: 'A公司收购了B公司，CTO 是张三。',
      bm25: 4.2,
      citation: CITATION,
    },
  ],
  duration_ms: 3,
}

const DEEP_ROW = {
  key: 'kb/a.txt#L1',
  path: 'kb/a.txt',
  content: 'CTO 是张三',
  score: 0.91,
  bm25: 4.2,
  hop: 1,
}

const DEEP_RESULT = {
  query: '谁是CTO',
  status: 'degraded',
  degraded: true,
  version: 12,
  duration_ms: 37.5,
  results: [DEEP_ROW],
  source_count: 1,
  citations: [CITATION],
  trace: [
    {
      hop: 1,
      candidates: ['kb/a.txt'],
      terms: [{ term: 'CTO', score: 1.5, kind: 'seed' }],
      evidence: ['kb/a.txt#L1'],
      pool_size: 8,
      judge_mode: 'lexical-only',
      judge_executed: false,
      judge_reason: 'skipped',
    },
  ],
  judge: { mode: 'lexical-only', executed: false, reason: 'skipped' },
  paths: { 'kb/a.txt': { chunks: 5 } },
}

const ADD_OUTCOME = {
  changed: true,
  reason: 'created',
  doc_hash: 'sha256:9f2c',
  chunk_count: 5,
  version: 13,
  model_calls: 0,
}

const REMOVE_OUTCOME = { removed: 3, version: 14 }

const FUSE_RESULT = {
  results: [{ path: 'kb/a.txt', key: 'a', rrf_score: 0.032, fused_from: 'sag2+rag' }],
  channels: ['sag2', 'rag'],
  rrf_k: 60,
}

const QUERY_PLACEHOLDER = '输入问题，可跨文档多跳关联…'
const PATH_PLACEHOLDER = 'kb/example.txt'
const CONTENT_PLACEHOLDER = '粘贴或输入文档正文…'

function typeQuery(value: string) {
  fireEvent.change(screen.getByPlaceholderText(QUERY_PLACEHOLDER), { target: { value } })
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

/* -------------------------------------------------------------------------- */
/* 用例                                                                        */
/* -------------------------------------------------------------------------- */

describe('SAG2 PageClient · 首次加载与真实信封解包', () => {
  it('请求在途为占位/不崩溃 → 真实 {code:0,data} 信封解包 → status 与文档区正确渲染', async () => {
    const { calls, fn, resolvePending } = installFetch([{ pending: true }])
    render(<PageClient />)

    await waitFor(() => expect(fn).toHaveBeenCalledTimes(1))
    expectCall(calls, 0, '/api/v1/ai/sag2/status', 'GET')
    // 数据未到：头部是占位，不崩溃、不静默伪装成已加载
    expect(screen.getByText(/版本 —/)).toBeTruthy()
    expect(screen.getByText(/文档 —/)).toBeTruthy()

    resolvePending(ok(STATUS))
    await waitFor(() => expect(screen.getByText('索引就绪')).toBeTruthy())
    expect(screen.getByText(/版本 3/)).toBeTruthy()
    expect(screen.getByText(/文档 2/)).toBeTruthy()
    expect(screen.getByText(/块 9/)).toBeTruthy()
    expect(screen.getByText(/词项 128/)).toBeTruthy()
    expect(screen.getByText(/判定器 none/)).toBeTruthy()
    expect(screen.getByText(/文档: 2 · 块: 9/)).toBeTruthy()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('信封含白名单外字段：真实 @ihui/api-client 严格契约校验抛错，UI 显示错误态而非静默吞掉', async () => {
    const body = JSON.stringify({ code: 0, message: 'ok', data: STATUS, unexpected: 1 })
    const { calls, fn } = installFetch([{ status: 200, body }])
    render(<PageClient />)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('请求失败')
    expect(alert.textContent).toContain('响应契约校验失败')
    // 契约异常无 status → 生产 fetchApi 走「网络异常」重试 1 次，共 2 次真实 fetch
    expect(fn).toHaveBeenCalledTimes(2)
    expectCall(calls, 0, '/api/v1/ai/sag2/status', 'GET')
    expectCall(calls, 1, '/api/v1/ai/sag2/status', 'GET')
  })
})

describe('SAG2 PageClient · 四类失败态（真实解包链路）', () => {
  it('业务错误信封 code!=0：HTTP 200 但 code=50001，UI 显示 message 而非静默', async () => {
    const body = JSON.stringify({ code: 50001, message: '索引损坏', data: null })
    const { calls, fn } = installFetch([{ status: 200, body }])
    render(<PageClient />)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('请求失败')
    expect(alert.textContent).toContain('索引损坏')
    expect(fn).toHaveBeenCalledTimes(1)
    expectCall(calls, 0, '/api/v1/ai/sag2/status', 'GET')
  })

  it('HTTP 500：5xx 不重试，UI 显示服务端 message', async () => {
    const body = JSON.stringify({ code: 500, message: '服务端熔断', data: null })
    const { calls, fn } = installFetch([{ status: 500, body }])
    render(<PageClient />)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('请求失败')
    expect(alert.textContent).toContain('服务端熔断')
    expect(fn).toHaveBeenCalledTimes(1)
    expectCall(calls, 0, '/api/v1/ai/sag2/status', 'GET')
  })

  it('网络 reject：TypeError 原样冒泡，生产重试 1 次后 UI 显示明确错误态', async () => {
    const { calls, fn } = installFetch([{ reject: new TypeError('Failed to fetch') }])
    render(<PageClient />)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('请求失败')
    expect(alert.textContent).toContain('Failed to fetch')
    expect(fn).toHaveBeenCalledTimes(2)
    expectCall(calls, 0, '/api/v1/ai/sag2/status', 'GET')
    expectCall(calls, 1, '/api/v1/ai/sag2/status', 'GET')
  })

  it('畸形 JSON：2xx 但响应体非合法 JSON，UI 显示「响应体不是合法 JSON」', async () => {
    const { calls, fn } = installFetch([{ status: 200, body: '<<not-json>>' }])
    render(<PageClient />)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('请求失败')
    expect(alert.textContent).toContain('响应体不是合法 JSON')
    expect(fn).toHaveBeenCalledTimes(1)
    expectCall(calls, 0, '/api/v1/ai/sag2/status', 'GET')
  })
})

describe('SAG2 PageClient · 空结果态', () => {
  it('ready=false 的空索引 + search 空 items：显示「索引为空」与「暂无结果，请先登记文档」', async () => {
    const { calls, fn } = installFetch([
      ok({ ...STATUS, ready: false, documents: 0, chunks: 0 }),
      ok({ ...SEARCH_RESULT, items: [], total_files: 0 }),
    ])
    render(<PageClient />)
    await waitFor(() => expect(screen.getByText('索引为空')).toBeTruthy())

    typeQuery('无人命中')
    fireEvent.click(screen.getByRole('button', { name: '快速搜索' }))
    await waitFor(() => expect(screen.getByText('处理中…')).toBeTruthy())
    await waitFor(() => expect(screen.getByText('暂无结果，请先登记文档')).toBeTruthy())
    expect(fn).toHaveBeenCalledTimes(2)
    expectCall(calls, 0, '/api/v1/ai/sag2/status', 'GET')
    expectCall(calls, 1, '/api/v1/ai/sag2/search', 'POST', {
      query: '无人命中',
      page: 1,
      per_page: 20,
    })
  })
})

describe('SAG2 PageClient · 六端点交互（fetch 端计数证明）', () => {
  it('search：点击快速搜索 → 真实 POST + CJK 中文完整进 body → 文档列表渲染', async () => {
    const query = '谁收购了B公司？中文查询'
    const { calls, fn } = installFetch([ok(STATUS), ok({ ...SEARCH_RESULT, query })])
    render(<PageClient />)
    await waitFor(() => expect(screen.getByText('索引就绪')).toBeTruthy())

    typeQuery(query)
    fireEvent.click(screen.getByRole('button', { name: '快速搜索' }))
    await waitFor(() => expect(screen.getByText('kb/a.txt')).toBeTruthy())
    expect(screen.getByText('A公司收购了B公司，CTO 是张三。')).toBeTruthy()
    expect(screen.getByText(/BM25 4.2/)).toBeTruthy()

    expect(fn).toHaveBeenCalledTimes(2)
    const searchCall = expectCall(calls, 1, '/api/v1/ai/sag2/search', 'POST', {
      query,
      page: 1,
      per_page: 20,
    })
    // fetch 原始 body 字节里中文字符完整，未被错误编码
    expect(String(searchCall.init.body)).toContain(query)
    expect(String(searchCall.init.body)).toContain('谁收购了B公司？中文查询')
  })

  it('busy 态：请求在途显示「处理中…」且按钮 disabled 防重复提交；结果到达后消失', async () => {
    const { calls, fn, resolvePending } = installFetch([ok(STATUS), { pending: true }])
    render(<PageClient />)
    await waitFor(() => expect(screen.getByText('索引就绪')).toBeTruthy())

    typeQuery('收购')
    const quickButton = screen.getByRole('button', { name: '快速搜索' })
    fireEvent.click(quickButton)
    await waitFor(() => expect(screen.getByText('处理中…')).toBeTruthy())
    expect((screen.getByRole('button', { name: '快速搜索' }) as HTMLButtonElement).disabled).toBe(true)
    expect(fn).toHaveBeenCalledTimes(2)
    expectCall(calls, 1, '/api/v1/ai/sag2/search', 'POST', { query: '收购', page: 1, per_page: 20 })

    resolvePending(ok(SEARCH_RESULT))
    await waitFor(() => expect(screen.queryByText('处理中…')).toBeNull())
    expect(screen.getByText('kb/a.txt')).toBeTruthy()
  })

  it('retrieve + 降级标识：judge_mode=lexical-only / judge_executed=false 在 UI 上诚实可见', async () => {
    const query = '谁是CTO？中文多跳'
    const { calls, fn } = installFetch([ok(STATUS), ok({ ...DEEP_RESULT, query })])
    render(<PageClient />)
    await waitFor(() => expect(screen.getByText('索引就绪')).toBeTruthy())

    typeQuery(query)
    fireEvent.click(screen.getByRole('button', { name: '多跳检索' }))
    await waitFor(() => expect(screen.getByText('CTO 是张三')).toBeTruthy())

    // 降级条：通用文案 + 机器判据 mode + reason 三者齐备，绝不把 BM25 分数伪装成模型证据
    const banner = screen.getByText(/lexical-only/)
    expect(banner.textContent).toContain('证据判断未执行（纯词法判定）')
    expect(banner.textContent).toContain('lexical-only')
    expect(banner.textContent).toContain('skipped')
    // trace 每跳未执行判定时也显示降级文案，而非伪造 judge_mode
    expect(screen.getByText(/检索轨迹 · degraded · 37.5ms/)).toBeTruthy()
    expect(screen.getByText(/候选池 8/)).toBeTruthy()
    expect(screen.getByText(/kb\/a\.txt \[0-128\]/)).toBeTruthy()

    expect(fn).toHaveBeenCalledTimes(2)
    const retrieveCall = expectCall(calls, 1, '/api/v1/ai/sag2/retrieve', 'POST', { query })
    expect(String(retrieveCall.init.body)).toContain(query)
  })

  it('judge.executed=true 时降级条消失（不把已执行判定冒充为未执行）', async () => {
    const executed = {
      ...DEEP_RESULT,
      judge: { mode: 'model', executed: true, reason: 'ok' },
      trace: [{ ...DEEP_RESULT.trace[0]!, judge_mode: 'model', judge_executed: true, judge_reason: 'ok' }],
    }
    const { calls, fn } = installFetch([ok(STATUS), ok(executed)])
    render(<PageClient />)
    await waitFor(() => expect(screen.getByText('索引就绪')).toBeTruthy())

    typeQuery('谁是CTO')
    fireEvent.click(screen.getByRole('button', { name: '多跳检索' }))
    await waitFor(() => expect(screen.getByText('CTO 是张三')).toBeTruthy())
    expect(screen.queryByText(/证据判断未执行（纯词法判定） ·/)).toBeNull()
    expect(screen.getByText(/候选池 8/).textContent).toContain('model')

    expect(fn).toHaveBeenCalledTimes(2)
    expectCall(calls, 1, '/api/v1/ai/sag2/retrieve', 'POST', { query: '谁是CTO' })
  })

  it('fuse：基于 deep results 点 RRF 融合 → 真实 POST /fuse → 融合摘要渲染', async () => {
    const { calls, fn } = installFetch([ok(STATUS), ok(DEEP_RESULT), ok(FUSE_RESULT)])
    render(<PageClient />)
    await waitFor(() => expect(screen.getByText('索引就绪')).toBeTruthy())

    typeQuery('谁是CTO')
    fireEvent.click(screen.getByRole('button', { name: '多跳检索' }))
    await waitFor(() => expect(screen.getByText('CTO 是张三')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'RRF 融合' }))
    await waitFor(() => expect(screen.getByText(/sag2 \+ rag · 1 · k=60/)).toBeTruthy())

    expect(fn).toHaveBeenCalledTimes(3)
    expectCall(calls, 0, '/api/v1/ai/sag2/status', 'GET')
    expectCall(calls, 1, '/api/v1/ai/sag2/retrieve', 'POST', { query: '谁是CTO' })
    expectCall(calls, 2, '/api/v1/ai/sag2/fuse', 'POST', {
      sag2_results: [DEEP_ROW],
      rag_sources: [],
      k: 60,
    })
  })

  it('addDocument：登记含中文的正文 → 真实 POST /documents → notice + 再次 GET /status', async () => {
    const content = 'A公司收购了B公司，CTO 是张三。'
    const { calls, fn } = installFetch([ok(STATUS), ok(ADD_OUTCOME), ok({ ...STATUS, documents: 3 })])
    render(<PageClient />)
    await waitFor(() => expect(screen.getByText('索引就绪')).toBeTruthy())

    fireEvent.change(screen.getByPlaceholderText(PATH_PLACEHOLDER), { target: { value: 'kb/a.txt' } })
    fireEvent.change(screen.getByPlaceholderText(CONTENT_PLACEHOLDER), { target: { value: content } })
    fireEvent.click(screen.getByRole('button', { name: '登记 / 更新' }))
    await waitFor(() => expect(screen.getByText(/已登记（建库零模型调用）/)).toBeTruthy())

    expect(fn).toHaveBeenCalledTimes(3)
    expectCall(calls, 0, '/api/v1/ai/sag2/status', 'GET')
    const addCall = expectCall(calls, 1, '/api/v1/ai/sag2/documents', 'POST', {
      path: 'kb/a.txt',
      content,
    })
    expect(String(addCall.init.body)).toContain(content)
    expectCall(calls, 2, '/api/v1/ai/sag2/status', 'GET')
  })

  it('removeDocument：移除 → 真实 DELETE /documents（path 进 body）→ notice + 再次 GET /status', async () => {
    const { calls, fn } = installFetch([ok(STATUS), ok(REMOVE_OUTCOME), ok({ ...STATUS, documents: 1 })])
    render(<PageClient />)
    await waitFor(() => expect(screen.getByText('索引就绪')).toBeTruthy())

    fireEvent.change(screen.getByPlaceholderText(PATH_PLACEHOLDER), { target: { value: 'kb/a.txt' } })
    fireEvent.click(screen.getByRole('button', { name: '移除' }))
    await waitFor(() => expect(screen.getByText(/已移除块数 3/)).toBeTruthy())

    expect(fn).toHaveBeenCalledTimes(3)
    expectCall(calls, 0, '/api/v1/ai/sag2/status', 'GET')
    expectCall(calls, 1, '/api/v1/ai/sag2/documents', 'DELETE', { path: 'kb/a.txt' })
    expectCall(calls, 2, '/api/v1/ai/sag2/status', 'GET')
  })
})

describe('SAG2 PageClient · 交互态错误不静默', () => {
  it('search 返回业务错误信封：错误态上屏且不被空结果态吞掉', async () => {
    const body = JSON.stringify({ code: 40001, message: '查询被拒绝', data: null })
    const { calls, fn } = installFetch([ok(STATUS), { status: 200, body }])
    render(<PageClient />)
    await waitFor(() => expect(screen.getByText('索引就绪')).toBeTruthy())

    typeQuery('敏感词')
    fireEvent.click(screen.getByRole('button', { name: '快速搜索' }))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('查询被拒绝')

    expect(fn).toHaveBeenCalledTimes(2)
    expectCall(calls, 1, '/api/v1/ai/sag2/search', 'POST', { query: '敏感词', page: 1, per_page: 20 })
  })
})
