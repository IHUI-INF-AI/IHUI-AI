// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。


// D30 无人值守修复闭环回归(2026-09-26 立,计划行 659):
// 全程注入 fake transport / fake ledger 落盘 / audit spy,零真实网络(§5 测试隔离铁律)。
// 覆盖:门控关闭零定时器零网络 / 三源扫描请求 shape / 认领去重 / PR 创建与回帖 /
//       PAT 脱敏 / agent 执行器通道契约。
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  loadAutomationsConfig,
  createFileLedger,
  createGitHubClient,
  createStubExecutor,
  createAgentExecutor,
  createOrchestrator,
  startAutomationsScheduler,
  stopAutomationsScheduler,
  isAutomationsSchedulerRunning,
  redactSecrets,
  type AuditLogger,
  type FetchLike,
  type FixTask,
} from '../src/services/automations/index.js'

// ---------------------------------------------------------------------------
// 测试基建:fake transport(记录调用 + 路由应答)、audit spy、公共夹具
// ---------------------------------------------------------------------------

interface RecordedCall {
  url: string
  method: string
  headers: Record<string, string>
  body?: string
}

interface Handler {
  test: (url: string, method: string) => boolean
  handle: (init?: RequestInit) => Response
}

const PAT = 'pat-d30-test-token'
const REPO = 'ihui-o/ihui-r'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function makeTransport(handlers: Handler[]): { transport: FetchLike; calls: RecordedCall[] } {
  const calls: RecordedCall[] = []
  const transport: FetchLike = async (url, init) => {
    const method = (init?.method ?? 'GET').toUpperCase()
    calls.push({
      url,
      method,
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: typeof init?.body === 'string' ? init.body : undefined,
    })
    for (const h of handlers) {
      if (h.test(url, method)) return h.handle(init)
    }
    return jsonResponse(404, { message: 'no handler in test' })
  }
  return { transport, calls }
}

/** 组装三源扫描 + PR 链路的标准 fake GitHub 应答 */
function baseHandlers(): Handler[] {
  return [
    {
      test: (u, m) => m === 'GET' && u.endsWith(`/repos/${REPO}`),
      handle: () => jsonResponse(200, { default_branch: 'main' }),
    },
    {
      test: (u, m) => m === 'GET' && u.includes('/git/ref/heads/main'),
      handle: () => jsonResponse(200, { object: { sha: 'basesha0000' } }),
    },
    {
      test: (u, m) => m === 'POST' && u.includes('/git/refs'),
      handle: () => jsonResponse(201, { ref: 'refs/heads/automations/fix-issue-1' }),
    },
    {
      test: (u, m) => m === 'POST' && u.endsWith(`/repos/${REPO}/pulls`),
      handle: () => jsonResponse(201, { number: 7, html_url: `https://github.com/${REPO}/pull/7` }),
    },
    {
      test: (u, m) => m === 'POST' && u.includes('/issues/') && u.endsWith('/comments'),
      handle: () => jsonResponse(201, { id: 1 }),
    },
  ]
}

function scanHandlers(): Handler[] {
  return [
    ...baseHandlers(),
    {
      test: (u, m) => m === 'GET' && u.includes(`/repos/${REPO}/issues?`),
      handle: () =>
        jsonResponse(200, [
          {
            number: 1,
            title: 'Fix the login bug',
            body: 'Login throws TypeError on submit',
            html_url: `https://github.com/${REPO}/issues/1`,
          },
          // 混入一条 PR(带 pull_request 键)→ 应被过滤
          { number: 2, title: 'A PR not an issue', pull_request: { url: 'x' } },
        ]),
    },
    {
      test: (u, m) => m === 'GET' && u.includes('/code-scanning/alerts'),
      handle: () =>
        jsonResponse(200, [
          {
            number: 3,
            rule: { id: 'js/xss', description: 'XSS risk in template' },
            most_recent_instance: { message: { text: 'tainted flow at app.js:42' } },
            html_url: `https://github.com/${REPO}/security/code-scanning/3`,
          },
        ]),
    },
    {
      test: (u, m) => m === 'GET' && u.includes('/actions/runs?'),
      handle: () =>
        jsonResponse(200, {
          workflow_runs: [
            {
              id: 99,
              name: 'CI',
              display_title: 'build broke',
              html_url: `https://github.com/${REPO}/actions/runs/99`,
            },
          ],
        }),
    },
  ]
}

function makeAuditSpy(): AuditLogger & { lines: string[] } {
  const lines: string[] = []
  const push = (level: string, msg: string, meta?: object) => {
    lines.push(`${level}|${msg}${meta ? `|${JSON.stringify(meta)}` : ''}`)
  }
  return {
    lines,
    info: (msg, meta) => push('info', msg, meta),
    warn: (msg, meta) => push('warn', msg, meta),
    error: (msg, meta) => push('error', msg, meta),
  }
}

function makeConfig(overrides: Record<string, string> = {}) {
  return loadAutomationsConfig({
    IHUI_AUTOMATIONS_ENABLED: 'true',
    IHUI_GITHUB_PAT: PAT,
    IHUI_AUTOMATIONS_REPO: REPO,
    ...overrides,
  })
}

afterEach(() => {
  stopAutomationsScheduler()
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// 1. 门控:关闭 = 零定时器、零网络
// ---------------------------------------------------------------------------

describe('D30 门控', () => {
  it('IHUI_AUTOMATIONS_ENABLED 未开启:startAutomationsScheduler 返回 false 且零网络零定时器', () => {
    const saved = process.env.IHUI_AUTOMATIONS_ENABLED
    delete process.env.IHUI_AUTOMATIONS_ENABLED
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    try {
      expect(startAutomationsScheduler()).toBe(false)
      expect(isAutomationsSchedulerRunning()).toBe(false)
      expect(fetchSpy).not.toHaveBeenCalled()
    } finally {
      if (saved !== undefined) process.env.IHUI_AUTOMATIONS_ENABLED = saved
    }
  })

  it('默认配置:enabled=false / executor=stub / label 默认 automations:fix', () => {
    const cfg = loadAutomationsConfig({})
    expect(cfg.enabled).toBe(false)
    expect(cfg.executor).toBe('stub')
    expect(cfg.label).toBe('automations:fix')
    expect(cfg.claimComment).toBe(true)
  })

  it('开启但缺 PAT / repo 非法:拒启且零网络', () => {
    const saved = process.env.IHUI_AUTOMATIONS_ENABLED
    process.env.IHUI_AUTOMATIONS_ENABLED = 'true'
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    try {
      expect(startAutomationsScheduler()).toBe(false)
      expect(fetchSpy).not.toHaveBeenCalled()
    } finally {
      if (saved !== undefined) process.env.IHUI_AUTOMATIONS_ENABLED = saved
      else delete process.env.IHUI_AUTOMATIONS_ENABLED
    }
  })
})

// ---------------------------------------------------------------------------
// 2. 三源扫描请求 shape
// ---------------------------------------------------------------------------

describe('D30 三源扫描', () => {
  it('三个 GET 的路径/参数/Bearer 头 shape 正确;PR 混入被过滤', async () => {
    const { transport, calls } = makeTransport(scanHandlers())
    const audit = makeAuditSpy()
    const github = createGitHubClient({ pat: PAT, repo: REPO, transport, audit })
    const ledger = createFileLedger(join(mkdtempSync(join(tmpdir(), 'd30-')), 'ledger.json'), audit)
    const sink: FixTask[] = []
    const orch = createOrchestrator({
      config: makeConfig(),
      github,
      ledger,
      executor: createStubExecutor(sink),
      audit,
    })

    const report = await orch.runOnce()

    // 三个扫描源的请求 shape
    const issueCall = calls.find((c) => c.url.includes(`/repos/${REPO}/issues?`))
    expect(issueCall).toBeDefined()
    expect(issueCall!.url).toContain('state=open')
    expect(issueCall!.url).toContain(`labels=${encodeURIComponent('automations:fix')}`)
    const alertCall = calls.find((c) => c.url.includes('/code-scanning/alerts?'))
    expect(alertCall).toBeDefined()
    expect(alertCall!.url).toContain('state=open')
    const runCall = calls.find((c) => c.url.includes('/actions/runs?'))
    expect(runCall).toBeDefined()
    expect(runCall!.url).toContain('status=failure')
    expect(runCall!.url).toContain('per_page=10')

    // Bearer PAT 注入
    for (const c of calls) {
      expect(c.headers['Authorization']).toBe(`Bearer ${PAT}`)
    }

    // issue 源:PR 条目被过滤;三源共 1+1+1=3 条,全部新认领并执行
    expect(report.scanned).toBe(3)
    expect(report.claimed).toBe(3)
    expect(report.fixed).toBe(3)
    expect(sink.map((t) => t.key).sort()).toEqual([
      'code-scanning:3',
      'issue:1',
      'workflow-run:99',
    ])
  })
})

// ---------------------------------------------------------------------------
// 3. 认领去重(内存 + 文件)
// ---------------------------------------------------------------------------

describe('D30 认领去重', () => {
  it('同一轮扫描跑两遍:第二次不重复认领、不重复执行、不重复回帖', async () => {
    const { transport, calls } = makeTransport(scanHandlers())
    const audit = makeAuditSpy()
    const ledgerPath = join(mkdtempSync(join(tmpdir(), 'd30-')), 'ledger.json')
    const ledger = createFileLedger(ledgerPath, audit)
    const sink: FixTask[] = []
    const orch = createOrchestrator({
      config: makeConfig(),
      github: createGitHubClient({ pat: PAT, repo: REPO, transport, audit }),
      ledger,
      executor: createStubExecutor(sink),
      audit,
    })

    const first = await orch.runOnce()
    expect(first.claimed).toBe(3)
    expect(sink).toHaveLength(3)

    const second = await orch.runOnce()
    expect(second.scanned).toBe(3)
    expect(second.claimed).toBe(0)
    expect(sink).toHaveLength(3) // 执行器不再被调

    // issue:1 的回帖数恒定(认领回帖 + 结果回帖 = 2)
    const commentCalls = calls.filter(
      (c) => c.method === 'POST' && c.url.includes('/issues/1/comments'),
    )
    expect(commentCalls).toHaveLength(2)

    // 文件账本真实落盘且重启(新账本实例指向同一文件)后仍认得
    const persisted = JSON.parse(readFileSync(ledgerPath, 'utf8')) as { entries: Record<string, unknown> }
    expect(Object.keys(persisted.entries).sort()).toEqual([
      'code-scanning:3',
      'issue:1',
      'workflow-run:99',
    ])
    const reborn = createFileLedger(ledgerPath)
    expect(reborn.has('issue:1')).toBe(true)
    expect(reborn.claim('issue:1')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 4. PR 创建 + 结果回帖(stub 模式也走完整链路)
// ---------------------------------------------------------------------------

describe('D30 PR 回帖', () => {
  it('建分支 + 建 PR + 原 issue 回帖结果(含 PR 链接)', async () => {
    const { transport, calls } = makeTransport(scanHandlers())
    const audit = makeAuditSpy()
    const orch = createOrchestrator({
      config: makeConfig(),
      github: createGitHubClient({ pat: PAT, repo: REPO, transport, audit }),
      ledger: createFileLedger(join(mkdtempSync(join(tmpdir(), 'd30-')), 'ledger.json')),
      executor: createStubExecutor(),
      audit,
    })

    await orch.runOnce()

    // 建分支:POST /git/refs,body 带 refs/heads/automations/fix-* 与默认分支 sha
    const refCall = calls.find((c) => c.method === 'POST' && c.url.includes('/git/refs'))
    expect(refCall).toBeDefined()
    const refBody = JSON.parse(refCall!.body!) as { ref: string; sha: string }
    expect(refBody.ref).toMatch(/^refs\/heads\/automations\/fix-issue-1-\d{14}$/)
    expect(refBody.sha).toBe('basesha0000')

    // 建 PR:标题 [automations] fix: <摘要>,base=默认分支,body 含来源与执行器说明
    const prCall = calls.find((c) => c.method === 'POST' && c.url.endsWith(`/repos/${REPO}/pulls`))
    expect(prCall).toBeDefined()
    const prBody = JSON.parse(prCall!.body!) as { title: string; head: string; base: string; body: string }
    expect(prBody.title).toBe('[automations] fix: Fix the login bug')
    expect(prBody.head).toBe(refBody.ref.replace('refs/heads/', ''))
    expect(prBody.base).toBe('main')
    expect(prBody.body).toContain('Automated fix attempt for `issue:1`')
    expect(prBody.body).toContain('Executor: stub')

    // 结果回帖:含 PR 链接与 stub 摘要
    const comments = calls.filter(
      (c) => c.method === 'POST' && c.url.includes('/issues/1/comments'),
    )
    expect(comments).toHaveLength(2)
    const bodies = comments.map((c) => (JSON.parse(c.body!) as { body: string }).body)
    expect(bodies[0]).toContain('已认领')
    expect(bodies[1]).toContain(`https://github.com/${REPO}/pull/7`)
    expect(bodies[1]).toContain('stub 模式:任务已登记')
  })
})

// ---------------------------------------------------------------------------
// 5. PAT 脱敏
// ---------------------------------------------------------------------------

describe('D30 审计脱敏', () => {
  it('日志出口(redact 层)与兜底 scrub 均不得泄漏 PAT', async () => {
    // 扫描阶段直接抛含 PAT 的错误 → 断言审计行已脱敏
    const { transport } = makeTransport([
      {
        test: (u, m) => m === 'GET' && u.includes(`/repos/${REPO}/issues?`),
        handle: () => {
          throw new Error(`upstream boom Authorization: Bearer ${PAT}`)
        },
      },
      {
        test: (u, m) => m === 'GET' && u.includes('/code-scanning/alerts'),
        handle: () => jsonResponse(200, []),
      },
      {
        test: (u, m) => m === 'GET' && u.includes('/actions/runs?'),
        handle: () => jsonResponse(200, { workflow_runs: [] }),
      },
    ])
    const audit = makeAuditSpy()
    const orch = createOrchestrator({
      config: makeConfig(),
      github: createGitHubClient({ pat: PAT, repo: REPO, transport, audit }),
      ledger: createFileLedger(join(mkdtempSync(join(tmpdir(), 'd30-')), 'ledger.json')),
      executor: createStubExecutor(),
      audit,
    })
    const report = await orch.runOnce()
    expect(report.scanned).toBe(0)

    // 所有审计行都不含原始 PAT
    const all = audit.lines.join('\n')
    expect(all).not.toContain(PAT)
    expect(all).toContain('***REDACTED***')
  })

  it('redactSecrets 纯函数:多 secret 顺序无关、空 secret 忽略', () => {
    expect(redactSecrets(`a ${PAT} b`, [PAT, '', 'x'])).toBe('a ***REDACTED*** b')
    expect(redactSecrets('no secrets here', ['missing'])).toBe('no secrets here')
  })
})

// ---------------------------------------------------------------------------
// 6. agent 执行器通道契约
// ---------------------------------------------------------------------------

describe('D30 agent 执行器', () => {
  it('executor=agent:POST /api/agents/execute,body 含 goal/agent_id/session_id', async () => {
    const calls: RecordedCall[] = []
    const aiFetch = async (path: string, init: RequestInit): Promise<Response> => {
      calls.push({
        url: path,
        method: (init.method ?? 'GET').toUpperCase(),
        headers: {},
        body: typeof init.body === 'string' ? init.body : undefined,
      })
      return jsonResponse(200, { task_id: 'agt-1' })
    }
    const executor = createAgentExecutor({ agentId: 'fixer-bot', aiFetch })
    const result = await executor.execute({
      key: 'issue:1',
      source: 'issue',
      repo: REPO,
      title: 'Fix the login bug',
      goal: '【D30】修复 login bug',
      url: null,
      issueNumber: 1,
    })

    expect(result.ok).toBe(true)
    expect(result.summary).toContain('agt-1')
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('/api/agents/execute')
    expect(calls[0].method).toBe('POST')
    const body = JSON.parse(calls[0].body!) as Record<string, unknown>
    expect(body['goal']).toBe('【D30】修复 login bug')
    expect(body['input']).toBe('【D30】修复 login bug')
    expect(body['agent_id']).toBe('fixer-bot')
    expect(body['session_id']).toBe('automations_d30_issue:1')

    // 非 2xx → ok:false 带状态
    const bad = await createAgentExecutor({
      agentId: 'fixer-bot',
      aiFetch: async () => jsonResponse(500, { message: 'boom' }),
    }).execute({
      key: 'issue:2',
      source: 'issue',
      repo: REPO,
      title: 't',
      goal: 'g',
      url: null,
      issueNumber: null,
    })
    expect(bad.ok).toBe(false)
    expect(bad.error).toContain('500')
  })
})
