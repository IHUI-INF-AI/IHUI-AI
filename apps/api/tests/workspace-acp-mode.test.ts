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
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify'

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: async (request: FastifyRequest) => {
    request.userId = 'user-1'
  },
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

import { workspaceRoutes } from '../src/routes/workspace.js'

/** 捕获 request.log 输出,验证 wireReq 里的 mode 已被归一成 kebab(而非入参原样)。 */
let logLines: string[]
let app: FastifyInstance

beforeEach(async () => {
  logLines = []
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
    payload: { workspaceRoot: 'D:/demo', ...(mode === undefined ? {} : { mode }) },
  })
}

function beginPrompt(mode?: string) {
  return app.inject({
    method: 'POST',
    url: '/api/workspace/workspace/acp/sessions/sess-1/begin-prompt',
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

  it('begin-prompt 两种拼写都 200,且转发面(wireReq)只出现 kebab 拼写', async () => {
    expect((await beginPrompt('accept-edits')).statusCode).toBe(200)
    expect((await beginPrompt('acceptEdits')).statusCode).toBe(200)
    const wireReqLines = logLines
      .map((l) => JSON.parse(l) as { msg?: string; wireReq?: { data?: { mode?: string } } })
      .filter((j) => j.msg === 'ACP begin_prompt')
    expect(wireReqLines).toHaveLength(2)
    // camel 入参必须被归一成 wire(kebab)后才进转发/日志面
    expect(wireReqLines.map((j) => j.wireReq?.data?.mode)).toEqual(['accept-edits', 'accept-edits'])
  })
})

describe('manual 与未知拼写仍拒(不因接受 camel 而漏放行)', () => {
  it('create-session mode=manual → 400(无 wire 映射,不落库不转发)', async () => {
    const res = await createSession('manual')
    expect(res.statusCode).toBe(400)
    expect(String(res.json().message)).toContain('manual')
  })

  it.each(['yolo-mode', 'auto', 'ACCEPT-EDITS'])('begin-prompt 未知拼写 %s → 400', async (mode) => {
    const res = await beginPrompt(mode)
    expect(res.statusCode).toBe(400)
  })

  it('不传 mode 仍合法(optional 契约不变)', async () => {
    expect((await createSession()).statusCode).toBe(201)
    expect((await beginPrompt()).statusCode).toBe(200)
  })
})
