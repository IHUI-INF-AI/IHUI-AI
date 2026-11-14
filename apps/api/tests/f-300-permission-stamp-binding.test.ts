// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-300 回归锁(2026-11-13)。
 *
 * 病灶:权限档徽章的 workspacePath 取自客户端请求体,只在会话 metadata 里记一个
 * 路径,回调时才拿它去查**当前**档位 —— ①档位不是生成时刻事实;②同一会话并发
 * 两条流时先完成的回调会盖到后写入的路径;③路径原样来自客户端,伪造一个"只读档
 * 路径"就能给自己贴上更保守/更宽的徽章。
 *
 * 本文件锁三件事:
 *   ① 绑定时就把服务端解析后的 {messageId, mode, workspacePath} 落到会话记录
 *     (realpath 归一后的路径 + 服务端权限行的档位,不采信客户端原样/自报档);
 *   ② 回调只按 messageId 读这份事实 —— 源锁(callback 不再读会话级 workspacePath、
 *     不再在回调时查权限表)+ 行为锁(伪造回调请求体里的 workspacePath 不影响徽章);
 *   ③ 路径不在服务端登记根内 → 拒绝盖章(不查权限表、不落记录)。
 *
 * 只 mock db 链路与 workspace_permission 查询,不触达真实 PG/Redis。
 */
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const state = vi.hoisted(() => ({
  conversation: null as null | { metadata: Record<string, unknown> | null; owner: string },
  writes: [] as Array<Record<string, unknown>>,
}))

const { getPermission } = vi.hoisted(() => ({ getPermission: vi.fn() }))

vi.mock('../src/db/index.js', () => {
  const select = () => ({
    from: () => ({
      where: () => ({
        limit: async () => (state.conversation ? [state.conversation] : []),
      }),
    }),
  })
  const update = () => ({
    set: (payload: Record<string, unknown>) => ({
      where: async () => {
        state.writes.push(payload)
        return []
      },
    }),
  })
  return { db: { select, update }, dbRead: { select: vi.fn() } }
})

vi.mock('../src/db/workspace-permission-queries.js', () => ({ getPermission }))

vi.mock('../src/config/index.js', () => ({
  config: { AI_CALLBACK_SECRET: 'test-secret', INTERNAL_SECRET_AUTH_MODE: 'dual' },
}))

import { bindMessagePermissionStamp } from '../src/services/message-permission-stamp'
import aiCallbackRoutes from '../src/routes/ai-callback'

const SRC_DIR = fileURLToPath(new URL('../src/', import.meta.url))

function sourceOf(relative: string): string {
  return readFileSync(join(SRC_DIR, relative), 'utf8')
}

let rootDir: string
let savedRootsEnv: string | undefined
let realRoot: string

beforeAll(() => {
  savedRootsEnv = process.env.IHUI_WORKSPACE_ROOTS
  rootDir = mkdtempSync(join(tmpdir(), 'f300-ws-'))
  process.env.IHUI_WORKSPACE_ROOTS = rootDir
  realRoot = realpathSync(rootDir)
})

afterAll(() => {
  if (savedRootsEnv === undefined) delete process.env.IHUI_WORKSPACE_ROOTS
  else process.env.IHUI_WORKSPACE_ROOTS = savedRootsEnv
  rmSync(rootDir, { recursive: true, force: true })
})

beforeEach(() => {
  state.conversation = null
  state.writes.length = 0
  getPermission.mockReset()
  getPermission.mockResolvedValue(undefined)
})

describe('F-300① 绑定时落 path/mode(服务端解析后的事实)', () => {
  it('请求时就把 realpath 归一后的路径与服务端权限档写进该 messageId 的记录', async () => {
    state.conversation = { metadata: { workspacePath: '/ws/legacy' }, owner: 'user-1' }
    const expectedPath = resolve(rootDir, 'proj')
    getPermission.mockImplementation(async (_userId: string, path: string) =>
      path === expectedPath || path === realRoot ? { mode: 'plan' } : undefined,
    )

    // 客户端原样串带 `..` 段:落库值必须是服务端归一后的路径
    const ok = await bindMessagePermissionStamp(
      'conv-1',
      'user-1',
      'msg-1',
      `${rootDir}${'/'}proj${'/'}..${'/'}proj`,
    )

    expect(ok).toBe(true)
    expect(state.writes).toHaveLength(1)
    expect(state.writes[0]!.metadata).toMatchObject({
      // 会话上其他 metadata 键保留
      workspacePath: '/ws/legacy',
      permissionStamps: {
        'msg-1': { mode: 'plan', workspacePath: expectedPath },
      },
    })
    // 档位取自服务端权限行(客户端自报的 bypass-permissions 不参与)
    expect(getPermission).toHaveBeenCalledWith('user-1', expectedPath)
  })

  it('同一 messageId 已有章时不覆盖(首发即事实)', async () => {
    state.conversation = {
      metadata: {
        permissionStamps: { 'msg-1': { mode: 'plan', workspacePath: realRoot } },
      },
      owner: 'user-1',
    }
    getPermission.mockResolvedValue({ mode: 'bypassPermissions' })

    const ok = await bindMessagePermissionStamp('conv-1', 'user-1', 'msg-1', realRoot)

    expect(ok).toBe(false)
    expect(state.writes).toHaveLength(0)
  })

  it('无档位记录 / 会话非本人 → 不落章', async () => {
    state.conversation = { metadata: {}, owner: 'user-1' }
    expect(await bindMessagePermissionStamp('conv-1', 'user-1', 'msg-1', rootDir)).toBe(false)

    state.conversation = { metadata: {}, owner: 'attacker' }
    getPermission.mockResolvedValue({ mode: 'plan' })
    expect(await bindMessagePermissionStamp('conv-1', 'user-1', 'msg-2', rootDir)).toBe(false)

    expect(state.writes).toHaveLength(0)
  })
})

describe('F-300③ 路径不在登记根内 → 拒绝盖章', () => {
  it('登记根外的路径不查权限表、不落记录', async () => {
    state.conversation = { metadata: {}, owner: 'user-1' }
    getPermission.mockResolvedValue({ mode: 'bypassPermissions' })

    const ok = await bindMessagePermissionStamp(
      'conv-1',
      'user-1',
      'msg-1',
      join(tmpdir(), 'f300-not-registered'),
    )

    expect(ok).toBe(false)
    expect(getPermission).not.toHaveBeenCalled()
    expect(state.writes).toHaveLength(0)
  })

  it('登记根未配置时 fail-closed(不盖章)', async () => {
    delete process.env.IHUI_WORKSPACE_ROOTS
    try {
      state.conversation = { metadata: {}, owner: 'user-1' }
      getPermission.mockResolvedValue({ mode: 'bypassPermissions' })
      expect(await bindMessagePermissionStamp('conv-1', 'user-1', 'msg-1', rootDir)).toBe(false)
      expect(state.writes).toHaveLength(0)
    } finally {
      process.env.IHUI_WORKSPACE_ROOTS = rootDir
    }
  })
})

describe('F-300② 回调按 messageId 读、不读请求体 workspacePath', () => {
  async function buildCallbackServer() {
    const server: FastifyInstance = Fastify({ logger: false })
    const add = vi.fn(async (_name: string, _data: unknown) => ({ id: 'job-1' }))
    Object.assign(server, { aiCallbackQueue: { add } })
    await server.register(aiCallbackRoutes)
    await server.ready()
    return { server, add }
  }

  it('行为锁:伪造请求体里的 workspacePath/permissionMode 不影响最终徽章', async () => {
    state.conversation = {
      metadata: {
        // 绑定时落下的真相:只读档 plan
        permissionStamps: { 'msg-1': { mode: 'plan', workspacePath: realRoot } },
      },
      owner: 'user-1',
    }
    const { server, add } = await buildCallbackServer()

    const res = await server.inject({
      method: 'POST',
      url: '/api/ai/callback',
      headers: { 'x-internal-secret': 'test-secret' },
      payload: {
        content: 'AI 回复',
        // 伪造:以为换个路径就能拿到更宽的档(回调侧早已不查权限表)
        workspacePath: join(rootDir, 'fake-wide'),
        metadata: {
          conversationId: 'conv-1',
          userId: 'user-1',
          messageId: 'msg-1',
          workspacePath: join(rootDir, 'fake-wide'),
          permissionMode: 'bypass-permissions',
        },
      },
    })
    expect(res.statusCode).toBe(202)

    const call = add.mock.calls.at(-1)
    if (!call) throw new Error('aiCallbackQueue.add 未被调用')
    const job = call[1] as { metadata: Record<string, unknown> }
    expect(job.metadata).toMatchObject({ permissionMode: 'plan' })
    expect(getPermission).not.toHaveBeenCalled()

    await server.close()
  })

  it('源锁:回调不再读会话级 workspacePath、也不在回调时刻查权限表', () => {
    const src = sourceOf('routes/ai-callback.ts')
    expect(src).toMatch(/readMessagePermissionStamp\(/)
    expect(src).not.toMatch(/workspacePathOfConversationMeta/)
    expect(src).not.toMatch(/metadata\.workspacePath/)
    expect(src).not.toMatch(/from '\.\.\/db\/workspace-permission-queries\.js'/)
  })

  it('源锁:流式入口按 metadata.messageId 在请求处理时落章', () => {
    const src = sourceOf('routes/ai-chat-stream.ts')
    expect(src).not.toMatch(/bindConversationWorkspace/)
    expect(src).toMatch(/bindMessagePermissionStamp\(/)
    expect(src).toMatch(
      /workspacePath && metadata\?\.conversationId && metadata\?\.messageId && request\.userId/,
    )
  })
})
