// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * 86H「agent 审批决策 → 审计链摄入路由」离线回归(2026-09-28)。
 *
 * 走 Fastify app.inject() 跑**真实路由**(含插件内 preHandler 鉴权钩子与
 * recordToolApprovalAuditIngest 的逐条映射),全程 mock db/logger/config/
 * @ihui/database/siem-exporter,不触任何真实库与真实服务端口(§5 测试隔离铁律)。
 * harness 形态逐条对齐姊妹入口 tests/cli-tool-invoke-audit.test.ts —— 同一条
 * 通道的两半,判据形状必须同形,各写一遍必然在鉴权装饰/drizzle 摊平上漂移。
 *
 * 钉票面四判据:
 * 1. **三路各成行且 result 可分辨**:flag/approved/denied ⇒ 链上 result 列依次为
 *    flag / approval / denial。断言**按 VALUES 元组的列位取 result**,不做裸子串:
 *    该 drizzle 组合把值不带引号内联(按 `'denial'` 写会永不成立),而 resource_id
 *    里恰好也含 flag 子串(裸判会替假阳性背书);
 * 2. **body 混入 userId/user_id ⇒ 400 且零写入**(断言事务从未开启,状态码本身不构成证明);
 * 3. **隐私口径**:fact 里塞 args ⇒ strict schema 直接 400 —— 决策行只回答"让不让",
 *    被批准执行的入参原文结构上进不了这一列;
 * 4. **失败必须响**:部分落库失败 ⇒ 207 且 code≠0,accepted 取库侧确认集。
 *
 * 鉴权边界如实登记:authenticate 被 mock 是刻意的 —— 它自身的 JWT 校验由
 * plugins/auth 的既有测试负责;本文件判的是**路由的合同**:authenticate 抛错时必须
 * 先回 401 且不进 handler、request.userId 必须逐字落到链行的 user_id 参数位、
 * body 里的自报身份永远不可能赢。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const { mockLoggerWarn, mockTransaction, mockAuthenticate, USER_ID } = vi.hoisted(() => ({
  mockLoggerWarn: vi.fn(),
  mockTransaction: vi.fn(),
  mockAuthenticate: vi.fn(),
  // 形状必须是真 UUID v4 形态(版本位 4 / variant 位 8):路由入口用 z.uuid()
  // (zod v4,校版本与 variant nibble),比服务层形状正则更严。写 '...-4444-...'
  // 这类假 uuid 会被入口正当拒绝 ⇒ 现象是"正向用例 401",先怀疑夹具再怀疑判据。
  USER_ID: '11111111-2222-4333-8444-555555555555',
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: mockLoggerWarn, error: vi.fn() },
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    AUDIT_LOG_HMAC_SECRET: 'k'.repeat(64),
    NODE_ENV: 'test',
  },
}))

vi.mock('../src/db/index.js', () => ({
  db: { transaction: mockTransaction },
  dbRead: {},
}))

vi.mock('@ihui/database', () => ({
  llmCallLogs: { id: 'llm_call_logs_id' },
}))

// siem-exporter 被 audit-log-service 顶层 import;本测试不碰它的判据,整模块 stub 隔离。
vi.mock('../src/services/siem-exporter.js', () => ({
  streamExport: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
}))

import { cliToolApprovalAuditRoutes } from '../src/routes/cli-tool-approval-audit.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))

// =============================================================================
// 夹具
// =============================================================================

/** 把 drizzle SQL 模板对象摊平成文本(值经 queryChunks 逐段内联,与姊妹测试同一判据形态)。 */
function inspectSql(raw: unknown): { text: string; params: unknown[] } | null {
  const chunks = (raw as { queryChunks?: unknown[] } | null)?.queryChunks
  if (!Array.isArray(chunks)) return null
  const text: string[] = []
  const walk = (list: unknown[]): void => {
    for (const c of list) {
      if (typeof c === 'string') {
        text.push(c)
      } else if (c && typeof c === 'object') {
        const inner = (c as { queryChunks?: unknown[]; value?: unknown }).queryChunks
        if (Array.isArray(inner)) walk(inner)
        else if ('value' in (c as object)) text.push(String((c as { value: unknown }).value))
      }
    }
  }
  walk(chunks)
  const params = (raw as { params?: unknown[] }).params
  return { text: text.join(''), params: Array.isArray(params) ? params : [] }
}

/** 一条审批决策事实:只有 {sessionId, toolName, route, cause?},没有任何入参位。 */
function fact(overrides?: Record<string, unknown>) {
  return {
    sessionId: 'sess-86h-1',
    toolName: 'run_command',
    route: 'approved',
    ...overrides,
  }
}

function ingestBody(facts: Array<Record<string, unknown>> = [fact()]) {
  return { facts }
}

/** 三路各一枚;toolName 刻意互异,便于在捕获序列里定位"第几行是哪一路"。 */
const THREE_ROUTES = [
  fact({ toolName: 'tool_flag', route: 'flag' }),
  fact({ toolName: 'tool_approved', route: 'approved' }),
  fact({ toolName: 'tool_denied', route: 'denied', cause: 'no-prompt' }),
]

const INGEST_PATH = '/api/cli/audit/tool-approvals'

/** 与 routes/index.ts 的注册形态一致:挂 /api/cli 前缀,插件声明 /audit/tool-approvals。 */
async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  // 复刻被 mock 掉的真实 auth 插件对实例的装饰(plugins/auth.ts 顶层
  // `server.decorateRequest('userId', undefined)`):Fastify v5 下未装饰的
  // request.userId 赋值在下游 handler 里读不到 —— 不补这一句,测的是"mock 没接到
  // 真插件的装饰合同",而不是路由的鉴权合同(姊妹测试第一版即栽在此)。
  app.decorateRequest('userId', undefined)
  await app.register(cliToolApprovalAuditRoutes, { prefix: '/api/cli' })
  await app.ready()
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuthenticate.mockImplementation(
    async (request: { headers: Record<string, unknown>; userId?: string }) => {
      const marker = request.headers['x-test-auth']
      if (marker === 'user') {
        request.userId = USER_ID
        return { userId: USER_ID }
      }
      if (marker === 'nonuuid') {
        request.userId = 'client-self-reported-1'
        return { userId: 'client-self-reported-1' }
      }
      const err = new Error('Unauthorized') as Error & { statusCode?: number }
      err.statusCode = 401
      throw err
    },
  )
})

/**
 * 装 db.transaction 的逐条 execute 序列(advisory lock → 链尾查询 → INSERT RETURNING id)。
 * failToolNames 命中的 INSERT 抛错,模拟 recordAuditLog 事务降级 → 计 failed。
 */
function armDbCaptures(failToolNames: readonly string[] = []): string[] {
  const insertTexts: string[] = []
  mockTransaction.mockImplementation(
    (cb: (tx: { execute: (q: unknown) => Promise<unknown> }) => Promise<unknown>) =>
      cb({
        execute: async (query: unknown) => {
          const sqlInfo = inspectSql(query)
          if (!sqlInfo) throw new Error('inspectSql 摊平失败:测试判定器失效,不得记通过')
          const text = sqlInfo.text
          if (text.includes('pg_advisory_xact_lock')) return []
          if (text.includes('SELECT current_hash')) return []
          if (text.includes('INSERT INTO audit_logs_chain')) {
            insertTexts.push(text)
            if (failToolNames.some((name) => text.includes(name))) {
              throw new Error(`injected write failure for ${failToolNames.join(',')}`)
            }
            return [{ id: `row-${insertTexts.length}` }]
          }
          throw new Error(`unexpected execute: ${text.slice(0, 60)}`)
        },
      }),
  )
  return insertTexts
}

async function inject(payload: unknown, auth = 'user') {
  const app = await buildApp()
  return app.inject({
    method: 'POST',
    url: INGEST_PATH,
    headers: auth === null ? {} : { 'x-test-auth': auth },
    payload,
  })
}

/**
 * 从摊平后的 INSERT 文本里按**列位**取 result(第 8 列,紧邻 metadata JSON)。
 *
 * 为什么不是 `toContain('flag')`:① 该 drizzle/postgres-js 组合把值**不带引号**内联
 * (`... lightMyRequest, denial, {"sessionId":...}`),按 `'denial'` 带引号写的断言
 * 在真实产物上永不成立(本文件第一版即栽在此,现象是"正向用例红");② 裸子串 `flag`
 * 会同时命中 resource_id='tool_flag'。取列位是唯一能证明"这一列确实是 result"的读法。
 * 取不到 ⇒ 直接抛:判定器失效不得被记成通过。
 */
function resultColumn(text: string): string {
  const m = /,\s*([^,\n]+?)\s*,\s*\{"sessionId"/.exec(text)
  if (!m) throw new Error(`result 列定位失败(VALUES 元组形状变了,判据需随动):${text.slice(0, 200)}`)
  return m[1]!
}

/** 取 metadata JSON 那段(判 cause/隐私口径都在这一列,不看整条 SQL 以免误命中列名)。 */
function metadataJson(text: string): string {
  const m = /\{"sessionId".*?\}(?=::jsonb)/.exec(text)
  if (!m)
    throw new Error(`metadata 列定位失败(VALUES 元组形状变了,判据需随动):${text.slice(0, 200)}`)
  return m[0]
}

// =============================================================================
// 判据 1:三路判定各成一行,且 result 可分辨
// =============================================================================

describe('86H 正向:flag/approved/denied 三路各成一行', () => {
  it('三条 facts ⇒ 逐条进链写入口,result 列三档互异可分辨', async () => {
    const captured = armDbCaptures()
    const res = await inject(ingestBody(THREE_ROUTES))
    expect(res.statusCode).toBe(200)
    const json = res.json() as {
      code: number
      message: string
      data: { requested: number; accepted: number; failed: number }
    }
    expect(json.code).toBe(0)
    expect(json.message).toBe('success')
    expect(json.data).toEqual({ requested: 3, accepted: 3, failed: 0 })

    expect(mockTransaction).toHaveBeenCalledTimes(3)
    expect(captured).toHaveLength(3)
    // 公共列逐条正确:action / 资源档 / 主体(主体是令牌主体,不是任何 body 值)
    captured.forEach((text) => {
      expect(text).toContain('tool.approval')
      expect(text).toContain('agent_tool_call')
      expect(text).toContain(USER_ID)
      expect(text).toContain('sess-86h-1')
    })
    // "可分辨"按列位取 result:三档各归各,且两两互异(不是"存在某档"的弱断言)
    const results = captured.map((text) => resultColumn(text))
    expect(results).toEqual(['flag', 'approval', 'denial'])
    expect(new Set(results).size).toBe(3)
  })

  it('cause 只在 denied 行落进 metadata(fail-closed 成因可追溯,放行行不带 cause)', async () => {
    const captured = armDbCaptures()
    await inject(ingestBody(THREE_ROUTES))
    const metas = captured.map((text) => metadataJson(text))
    expect(metas[2]).toContain('"cause":"no-prompt"')
    expect(metas[2]).toContain('"route":"denied"')
    expect(metas[0]).not.toContain('cause')
    expect(metas[1]).not.toContain('cause')
    // 隐私口径按**键集**判,比"整条 SQL 里搜 args"结实:metadata 列的键是封闭集,
    // 多一个键(哪怕叫 args/command)当场红 —— 而不是等它恰好带出原文才看得见。
    expect(Object.keys(JSON.parse(metas[2]) as Record<string, unknown>).sort()).toEqual([
      'cause',
      'route',
      'sessionId',
    ])
    expect(Object.keys(JSON.parse(metas[0]) as Record<string, unknown>).sort()).toEqual([
      'route',
      'sessionId',
    ])
  })
})

// =============================================================================
// 判据 2:body 混入自报身份 ⇒ 400 且零写入
// =============================================================================

describe('86H 反向 1:body 混入 userId/user_id 必拒且零写入', () => {
  it.each([
    ['userId', '22222222-3333-4444-8555-666666666666'],
    ['user_id', '22222222-3333-4444-8555-666666666666'],
  ] as const)('混入 %s ⇒ 400,事务一次都没开', async (key, value) => {
    const captured = armDbCaptures()
    const body = ingestBody(THREE_ROUTES) as Record<string, unknown>
    body[key] = value
    const res = await inject(body)
    expect(res.statusCode).toBe(400)
    expect((res.json() as { code: number }).code).toBe(400)
    // "零写入"只能由写入口计数证明,状态码本身不构成证明
    expect(mockTransaction).not.toHaveBeenCalled()
    expect(captured).toHaveLength(0)
  })
})

// =============================================================================
// 判据 3:隐私口径 —— 入参原文结构上进不了决策行
// =============================================================================

describe('86H 反向 2:strict schema 的字段级把关', () => {
  it('facts[0] 带 args ⇒ 400 零写入(被批准执行的命令行不属于决策行)', async () => {
    const captured = armDbCaptures()
    const res = await inject(ingestBody([fact({ args: { command: 'rm -rf /var' } })]))
    expect(res.statusCode).toBe(400)
    expect(mockTransaction).not.toHaveBeenCalled()
    expect(captured).toHaveLength(0)
    // 且不因"被拒"而在任何一列留下入参原文
    expect(captured.join('')).not.toContain('rm -rf')
  })

  it('route 不在三路集内 ⇒ 400 零写入', async () => {
    const captured = armDbCaptures()
    const res = await inject(ingestBody([fact({ route: 'auto' })]))
    expect(res.statusCode).toBe(400)
    expect(mockTransaction).not.toHaveBeenCalled()
    expect(captured).toHaveLength(0)
  })

  it('cause 不在 fail-closed 集内 ⇒ 400 零写入(成因是封闭集,不是自由文本)', async () => {
    const captured = armDbCaptures()
    const res = await inject(ingestBody([fact({ route: 'denied', cause: 'because-i-said-so' })]))
    expect(res.statusCode).toBe(400)
    expect(mockTransaction).not.toHaveBeenCalled()
    expect(captured).toHaveLength(0)
  })

  it('正向对照:denied 缺 cause 照样收(cause 刻意可选,不得顺手收紧)', async () => {
    const captured = armDbCaptures()
    const res = await inject(ingestBody([fact({ route: 'denied' })]))
    expect(res.statusCode).toBe(200)
    expect(captured).toHaveLength(1)
    expect(resultColumn(captured[0]!)).toBe('denial')
    expect(metadataJson(captured[0]!)).not.toContain('cause')
  })

  it('facts 为空数组 ⇒ 400 零写入(空批次不等于"已经记过了")', async () => {
    const captured = armDbCaptures()
    const res = await inject(ingestBody([]))
    expect(res.statusCode).toBe(400)
    expect(mockTransaction).not.toHaveBeenCalled()
    expect(captured).toHaveLength(0)
  })
})

// =============================================================================
// 判据 4:失败必须响 —— 部分落库失败不得回 success
// =============================================================================

describe('86H 反向 3:部分落库失败', () => {
  it('3 条中第 2 条写失败 ⇒ 207 且 code≠0,data 如实回 {requested:3, accepted:2, failed:1}', async () => {
    const captured = armDbCaptures(['tool_approved'])
    const res = await inject(ingestBody(THREE_ROUTES))
    expect(res.statusCode).toBe(207)
    const json = res.json() as {
      code: number
      data: { requested: number; accepted: number; failed: number }
    }
    // code=0 会被 CLI 侧 fetchApi 判成 success,这条断言就是"不得为 success"
    expect(json.code).not.toBe(0)
    expect(json.data).toEqual({ requested: 3, accepted: 2, failed: 1 })
    expect(captured).toHaveLength(3) // 确实逐条尝试过,不是提前放弃
  })
})

// =============================================================================
// 鉴权面:匿名与非 UUID 主体
// =============================================================================

describe('86H 反向 4:未挂载鉴权不得被绕过', () => {
  it('匿名(无令牌头)⇒ 401/403 且零写入', async () => {
    const captured = armDbCaptures()
    const res = await inject(ingestBody(THREE_ROUTES), null)
    expect([401, 403]).toContain(res.statusCode)
    expect(mockTransaction).not.toHaveBeenCalled()
    expect(captured).toHaveLength(0)
  })

  it('主体非 UUID ⇒ 入口即拒 401,不外溢成 ::uuid cast 假 DB 故障', async () => {
    const captured = armDbCaptures()
    const res = await inject(ingestBody(THREE_ROUTES), 'nonuuid')
    expect(res.statusCode).toBe(401)
    expect((res.json() as { message: string }).message).toContain('UUID')
    expect(mockTransaction).not.toHaveBeenCalled()
    expect(captured).toHaveLength(0)
  })
})

// =============================================================================
// 装车证明:注册面在位 + 两侧路径逐字等值
// =============================================================================

describe('86H 装车:路由必须真被注册,且 CLI 侧常量与之等值', () => {
  it('routes/index.ts 必须 register(cliToolApprovalAuditRoutes, {prefix:"/api/cli"})', () => {
    const indexSrc = readFileSync(path.resolve(HERE, '../src/routes/index.ts'), 'utf8')
    expect(indexSrc).toMatch(
      /server\.register\(cliToolApprovalAuditRoutes,\s*\{\s*prefix:\s*'\/api\/cli'\s*\}\)/,
    )
  })

  it('CLI 的 TOOL_APPROVAL_AUDIT_INGEST_PATH 必须逐字等于本测试打的路径', () => {
    // 读 tools/danger-gate-audit.ts —— 它是五个 CLI 站点共用的落链出口,常量住在那里;
    // 判"路径等值"要钉常量本体,钉某个 import 行的形状会在下一次文件搬家时无辜变红。
    const cliSrc = readFileSync(
      path.resolve(HERE, '../../cli/src/tools/danger-gate-audit.ts'),
      'utf8',
    )
    const m = /TOOL_APPROVAL_AUDIT_INGEST_PATH = '([^']+)'/.exec(cliSrc)
    expect(m?.[1]).toBe(INGEST_PATH)
  })

  it('CLI 侧不得存在第二份上报实现(两处算同一件事必漂移)', () => {
    // 路径必须从本文件的 HERE 现推 —— vitest 的 cwd 随调用方式变(repo root 或 apps/api),
    // 写 ../../apps/cli/src 会在其中一种 cwd 下直接 git 报错,把"判据跑不动"伪装成"判据通过"。
    const cliSrcRoot = path.resolve(HERE, '../../cli/src')
    const out = execFileSync(
      'git',
      [
        '-c',
        'safe.directory=*',
        'grep',
        '-l',
        '--no-index',
        'function reportToolApprovalDecisionToAudit',
        '--',
        cliSrcRoot,
      ],
      { encoding: 'utf8', windowsHide: true },
    )
    const files = out.split('\n').filter(Boolean)
    expect(
      files.length,
      `工作树面有 ${files.length} 份实现: ${files.join(', ')}`,
    ).toBeLessThanOrEqual(1)
  })
})
