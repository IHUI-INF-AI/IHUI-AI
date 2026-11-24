// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ACP 端点权限档入参面(G-164 存值迁移第①步同形态)—— 零真实 DB。
 *
 * 钉住两件事:
 * 1. **入参收 kebab∪camel**:此前 `z.enum(PERMISSION_MODE_WIRE_VALUES)` 只收 kebab,
 *    camel 客户端一律 400;现两种拼写都收,且归一后才进 wire(日志/转发的 wireReq
 *    只允许 kebab,camel 不得原样泄给下游);
 * 2. **manual 仍拒**:`manual` 有规范档语义但无 wire 映射(无落库/会话语义),
 *    不得因"接受 camel"被漏放行;未知拼写同样 400。
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// F-280:ACP 的 workspaceRoot 必须是「服务端登记根 × 本人登记工作区」内的真实路径,
// 因此夹具改用临时目录,并按新契约 mock 登记表(不再拿任意字符串当工作区)。
const ACP_ROOT = mkdtempSync(join(tmpdir(), 'ihui-acp-mode-'))

afterAll(() => {
  rmSync(ACP_ROOT, { recursive: true, force: true })
})

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: async (request: FastifyRequest) => {
    request.userId = 'user-1'
  },
}))

vi.mock('../src/db/workspace-permission-queries.js', () => ({
  listPermissionsByUser: vi.fn(async () => [
    { workspacePath: process.env.IHUI_WORKSPACE_ROOTS ?? '' },
  ]),
}))

vi.mock('../src/db/workspace-queries.js', () => {
  const noop = () => vi.fn(async () => undefined)
  return {
    listProjectsByUserWithFileCount: noop(),
    findProjectById: noop(),
    createProject: noop(),
    updateProject: noop(),
    deleteProject: noop(),
    listFilesByProject: noop(),
    findFileById: noop(),
    findFileByIdIncludeTrashed: noop(),
    createFile: noop(),
    softDeleteFile: noop(),
    restoreFile: noop(),
    hardDeleteFile: noop(),
    findTrashedFiles: noop(),
    batchSoftDelete: noop(),
    batchRestore: noop(),
    findFileVersions: noop(),
  }
})

// F-432(744822836d):ACP 会话必须真落库才回 201,begin/end 先核会话归属。
// 本文件仍是零真实 DB —— 用只认 agent_runtime_sessions 的进程内假库:
// insert 收下即成功;select 的 where 经 PgDialect 编译取参($1=会话 id、$2=userId),
// 只有已播种的 sess-1 属 user-1 才算命中 → begin-prompt 走 200 分支,
// 其余 id 仍 404(与生产 ownsAcpSession 同判据)。
vi.mock('../src/db/index.js', async () => {
  const { PgDialect } = await import('drizzle-orm/pg-core')
  const dialect = new PgDialect()
  const seeded = new Set<string>(['sess-1'])
  const db = {
    insert: () => ({
      values: async (row: Record<string, unknown>) => {
        if (typeof row.id === 'string') seeded.add(row.id)
        return []
      },
    }),
    select: () => ({
      from: () => ({
        where: (expr: unknown) => {
          const query = dialect.sqlToQuery(expr as never)
          const [sessionId, userId] = query.params as [string, string]
          const rows = seeded.has(sessionId) && userId === 'user-1' ? [{ id: sessionId }] : []
          // 生产 ownsAcpSession 走 .where(...).limit(1) —— 夹具必须同形,
          // 少这一环就是「夹具比真库更弱」,而不是被测代码错。
          return { limit: async () => rows }
        },
      }),
    }),
  }
  return { db, dbRead: db, dbClient: {} }
})

import { workspaceRoutes } from '../src/routes/workspace.js'

/** 捕获 request.log 输出,验证 wireReq 里的 mode 已被归一成 kebab(而非入参原样)。 */
let logLines: string[]
let app: FastifyInstance

beforeEach(async () => {
  logLines = []
  process.env.IHUI_WORKSPACE_ROOTS = ACP_ROOT
  app = Fastify({
    logger: {
      level: 'info',
      stream: {
        write: (line: string) => {
          logLines.push(line)
        },
      },
    },
  })
  await app.register(workspaceRoutes, { prefix: '/api/workspace' })
  await app.ready()
})

function createSession(mode?: string) {
  return app.inject({
    method: 'POST',
    url: '/api/workspace/workspace/acp/sessions',
    payload: { workspaceRoot: ACP_ROOT, ...(mode === undefined ? {} : { mode }) },
  })
}

/** F-280:begin/end 只认进程内登记 ⇒ 先建会话再拿 id,不再用固定 sess-1。 */
async function newSession(mode?: string): Promise<string> {
  const res = await createSession(mode)
  expect(res.statusCode).toBe(201)
  return (res.json() as { data: { data: { sessionId: string } } }).data.data.sessionId
}

function beginPrompt(sessionId: string, mode?: string) {
  return app.inject({
    method: 'POST',
    url: `/api/workspace/workspace/acp/sessions/${sessionId}/begin-prompt`,
    payload: { prompt: 'hi', ...(mode === undefined ? {} : { mode }) },
  })
}

describe('ACP 端点 mode 入参:kebab∪camel 双拼写都收', () => {
  it.each([
    'accept-edits',
    'acceptEdits',
    'bypass-permissions',
    'bypassPermissions',
    'plan',
    'default',
  ])('create-session mode=%s → 201', async (mode) => {
    const res = await createSession(mode)
    expect(res.statusCode).toBe(201)
  })

  it('begin-prompt 两种拼写都 200,且日志面只出现 kebab 拼写', async () => {
    const id = await newSession()
    expect((await beginPrompt(id, 'accept-edits')).statusCode).toBe(200)
    expect((await beginPrompt(id, 'acceptEdits')).statusCode).toBe(200)
    const wireReqLines = logLines
      .map((l) => JSON.parse(l) as { msg?: string; acp?: { mode?: string } })
      .filter((j) => j.msg === 'ACP begin_prompt')
    expect(wireReqLines).toHaveLength(2)
    // camel 入参必须被归一成 wire(kebab)后才进日志/转发面
    expect(wireReqLines.map((j) => j.acp?.mode)).toEqual(['accept-edits', 'accept-edits'])
  })
})

describe('manual 与未知拼写仍拒(不因接受 camel 而漏放行)', () => {
  it('create-session mode=manual → 400(无 wire 映射,不落库不转发)', async () => {
    const res = await createSession('manual')
    expect(res.statusCode).toBe(400)
    expect(String(res.json().message)).toContain('manual')
  })

  it.each(['yolo-mode', 'auto', 'ACCEPT-EDITS'])('begin-prompt 未知拼写 %s → 400', async (mode) => {
    const id = await newSession()
    const res = await beginPrompt(id, mode)
    expect(res.statusCode).toBe(400)
  })

  it('不传 mode 仍合法(optional 契约不变)', async () => {
    const id = await newSession()
    expect((await beginPrompt(id)).statusCode).toBe(200)
  })
})
