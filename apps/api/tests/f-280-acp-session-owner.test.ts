// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-280 回归锁(2026-11-13)。
 *
 * 病灶:POST /api/workspace/acp/sessions 是纯 stub —— 任意 workspaceRoot 都回 201,
 * begin/end 对任意 sessionId 都回 200,且 prompt / 附件正文被 wireReq 原样写进 info 日志。
 *
 * 本文件锁:
 *   ① workspaceRoot 为文件系统根 → 400;
 *   ② 服务端登记根外绝对路径 / 无本人登记 → 403;
 *   ③ 合法登记根下路径 → 201 且返回 sessionId;
 *   ④ 不存在的 sessionId → 404;
 *   ⑤ 他人 sessionId → 404(与不存在同形,不泄露存在性);
 *   ⑥ 合法 begin/end → 200;end 后会话结束,再次 begin → 404;
 *   ⑦ workspaceRoot 与会话登记不一致 → 400;
 *   ⑧ 日志只留 promptLength / attachmentCount / attachmentBytes,不含正文特征串;
 *   ⑨ 源锁:acp 段落不再把 wireReq 原样直传 info 日志。
 *
 * 只 mock authenticate / db / workspace_permission 查询;IHUI_WORKSPACE_ROOTS 指向
 * os.tmpdir() 下临时目录,afterAll 清理;不连 PG / Redis。
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const h = vi.hoisted(() => ({
  userId: 'f280-user-a',
  permissions: [] as Array<{ workspacePath: string }>,
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: async (request: { userId?: string }) => {
    request.userId = h.userId
  },
}))

// 「本人已登记工作区」的唯一来源:workspace_permissions 的 (userId, workspacePath)
vi.mock('../src/db/workspace-permission-queries.js', () => ({
  listPermissionsByUser: async () => h.permissions,
}))

vi.mock('../src/db/index.js', () => {
  const db = {
    insert: () => ({ values: async () => undefined }),
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
  }
  return { db, dbRead: db, dbClient: {} }
})

import { workspaceRoutes } from '../src/routes/workspace.js'

let app: FastifyInstance
let logLines: string[]
let baseDir: string
let rootDir: string
let insideDir: string
let outsideDir: string

const createSession = (workspaceRoot: string) =>
  app.inject({
    method: 'POST',
    url: '/api/workspace/acp/sessions',
    payload: { workspaceRoot },
  })

const beginPrompt = (sessionId: string, payload: Record<string, unknown> = {}) =>
  app.inject({
    method: 'POST',
    url: `/api/workspace/acp/sessions/${sessionId}/begin-prompt`,
    payload: { prompt: 'hello', ...payload },
  })

const endPrompt = (sessionId: string) =>
  app.inject({
    method: 'POST',
    url: `/api/workspace/acp/sessions/${sessionId}/end-prompt`,
    payload: {},
  })

beforeAll(async () => {
  baseDir = mkdtempSync(join(tmpdir(), 'ihui-f280-'))
  rootDir = join(baseDir, 'registered-root')
  insideDir = join(rootDir, 'project')
  outsideDir = join(baseDir, 'outside')
  mkdirSync(insideDir, { recursive: true })
  mkdirSync(outsideDir, { recursive: true })
  process.env.IHUI_WORKSPACE_ROOTS = rootDir

  logLines = []
  app = Fastify({
    logger: {
      level: 'info',
      stream: { write: (line: string) => logLines.push(line) },
    },
  })
  await app.register(workspaceRoutes, { prefix: '/api' })
  await app.ready()
})

afterAll(async () => {
  await app.close()
  delete process.env.IHUI_WORKSPACE_ROOTS
  rmSync(baseDir, { recursive: true, force: true })
})

beforeEach(() => {
  logLines = []
  h.userId = 'f280-user-a'
  h.permissions = [{ workspacePath: rootDir }]
})

describe('F-280 ACP 会话:workspaceRoot 归属与 owner 校验', () => {
  it.each(['C:\\', '/', 'C:/'])('workspaceRoot 为文件系统根 %s → 400', async (root) => {
    const res = await createSession(root)
    expect(res.statusCode).toBe(400)
  })

  it('相对路径 → 400', async () => {
    const res = await createSession('relative/path')
    expect(res.statusCode).toBe(400)
  })

  it('服务端登记根外的绝对路径 → 403', async () => {
    const res = await createSession(outsideDir)
    expect(res.statusCode).toBe(403)
  })

  it('调用者未登记该工作区 → 403(本人登记 × 服务端登记根)', async () => {
    h.permissions = []
    const res = await createSession(insideDir)
    expect(res.statusCode).toBe(403)
  })

  it('合法登记根下路径 → 201 且返回 sessionId', async () => {
    const res = await createSession(insideDir)
    expect(res.statusCode).toBe(201)
    const body = res.json() as {
      data: { type: string; data: { sessionId: string; workspaceRoot: string } }
    }
    expect(body.data.type).toBe('session_created')
    expect(body.data.data.sessionId).toMatch(/^[0-9a-f-]{36}$/)
    expect(body.data.data.workspaceRoot).toBe(insideDir)
  })

  it('begin-prompt 用不存在的 sessionId → 404', async () => {
    const res = await beginPrompt(randomUUID())
    expect(res.statusCode).toBe(404)
    expect(res.json().data).toBeUndefined()
  })

  it('他人 sessionId → 404(与不存在同形,不泄露存在性)', async () => {
    const created = await createSession(insideDir)
    const sessionId = (created.json() as { data: { data: { sessionId: string } } }).data.data
      .sessionId

    h.userId = 'f280-user-b'
    const begin = await beginPrompt(sessionId)
    const end = await endPrompt(sessionId)
    expect(begin.statusCode).toBe(404)
    expect(end.statusCode).toBe(404)
    expect(begin.json().data).toBeUndefined()
    expect(end.json().data).toBeUndefined()
  })

  it('合法 begin/end → 200;end 后再次 begin → 404', async () => {
    const created = await createSession(insideDir)
    const sessionId = (created.json() as { data: { data: { sessionId: string } } }).data.data
      .sessionId

    const begin = await beginPrompt(sessionId)
    expect(begin.statusCode).toBe(200)
    expect(begin.json().data.type).toBe('prompt_started')

    const end = await endPrompt(sessionId)
    expect(end.statusCode).toBe(200)
    expect(end.json().data.type).toBe('prompt_completed')

    const again = await beginPrompt(sessionId)
    expect(again.statusCode).toBe(404)
  })

  it('workspaceRoot 与会话登记不一致 → 400', async () => {
    const created = await createSession(insideDir)
    const sessionId = (created.json() as { data: { data: { sessionId: string } } }).data.data
      .sessionId

    const res = await beginPrompt(sessionId, { workspaceRoot: outsideDir })
    expect(res.statusCode).toBe(400)
  })

  it('日志只留长度/数量,不含 prompt 或附件正文', async () => {
    const prompt = 'F280-SECRET-PROMPT-CONTENT'
    const attachment = 'F280-SECRET-ATTACHMENT-CONTENT'
    const created = await createSession(insideDir)
    const sessionId = (created.json() as { data: { data: { sessionId: string } } }).data.data
      .sessionId

    const res = await beginPrompt(sessionId, {
      prompt,
      attachments: [{ kind: 'text', content: attachment }],
    })
    expect(res.statusCode).toBe(200)

    const joined = logLines.join('\n')
    expect(joined).not.toContain(prompt)
    expect(joined).not.toContain(attachment)

    const acpLine = logLines
      .map((line) => JSON.parse(line) as { msg?: string; acp?: Record<string, unknown> })
      .find((json) => json.msg === 'ACP begin_prompt')
    expect(acpLine?.acp).toMatchObject({
      type: 'begin_prompt',
      promptLength: prompt.length,
      attachmentCount: 1,
      attachmentBytes: Buffer.byteLength(attachment),
    })
  })

  it('源锁:acp 段落不再把 wireReq 原样直传 info 日志', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../src/routes/workspace.ts', import.meta.url)),
      'utf8',
    )
    expect(source).not.toMatch(/wireReq\s*,/)
    expect(source).not.toMatch(/log\.info\(\s*\{\s*wireReq/)
    expect(source).toContain('promptLength')
  })
})
