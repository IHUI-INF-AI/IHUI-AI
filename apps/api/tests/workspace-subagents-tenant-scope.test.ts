// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * GET /api/workspace/subagents 的租户边界与路径闸(2026-11-02 越权收口)。
 *
 * 修前两处越权,本文件对每一处都给了「退回即翻红」的构造:
 *  ① `configs` 是进程级单桶:任一用户 discover 后,别人的 list() 也能读到对方的
 *     name / systemPrompt / filePath(跨租户泄露)。故用例断言的是「B 的响应原文里
 *     不出现 A 的三个值」——只断言「B 的列表为空」会被"过滤写成了但没生效"蒙过去。
 *  ② `workspacePath` 是客户端自报串,直接 join('.claude/agents') 后 readdir ⇒ 传根外路径
 *     就能枚举服务器目录。故用例要求 404(不是 500、不是 200),且越界路径**不存在**时
 *     也必须 404 —— 若闸被调到 fs 之后,不存在的越界路径会静默返回 200 空列表,用例翻红。
 *
 * 隔离:真实 mkdtemp 目录 + IHUI_WORKSPACE_ROOTS(与 workspace-sandbox-containment 同形态),
 * 不连 PG/Redis、零网络;auth 插件整体桩掉,userId 由本文件自控。
 */
import { randomUUID } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Fastify, { type FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const authState = vi.hoisted(() => ({ userId: 'user-anonymous-placeholder' }))
// 2026-11-02 夹具跟契约:61e07b30fc / 47c254e167 起 discover/list 改为「登记根闸 +
// 用户级 workspace_permissions 子树闸」两关,授权范围来自调用者的 permission 行。
// 本文件靶面是租户边界与路径闸,不是权限表本身,故把权限表桩成"按 userId 发根"的内存态:
// 用例显式授予 A 自己的根,B 不授予 —— 闸门保持原样(仍只认本人 permission 行),
// 不为了绿回落到旧的"只看登记根"口径。
const permissionState = vi.hoisted(() => ({
  rootsByUser: new Map<string, string[]>(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: async (request: { userId?: string }) => {
    request.userId = authState.userId
  },
}))

vi.mock('../src/db/workspace-permission-queries.js', () => ({
  listPermissionsByUser: async (userId: string) =>
    (permissionState.rootsByUser.get(userId) ?? []).map((workspacePath) => ({
      workspacePath,
      mode: 'default',
    })),
}))

/** 把某个工作区根授予当前用例里的用户(等价于库里已有一行 permission) */
function grantRoot(userId: string, root: string): void {
  permissionState.rootsByUser.set(userId, [root])
}

import { workspaceAiRoutes } from '../src/routes/workspace-ai.js'
import { WORKSPACE_ROOTS_ENV } from '../src/utils/workspace-roots.js'

const LIST_URL = '/api/workspace/subagents'

interface SeededAgent {
  name: string
  prompt: string
  filePath: string
}

/** 响应里的子代理条目(只列断言用到的三个字段) */
interface SubagentEntry {
  name: string
  systemPrompt: string
  filePath: string
}

/** 在登记根下铺一个 .claude/agents/<随机名>.md,返回可逐字断言的三个值 */
function seedAgent(root: string): SeededAgent {
  const name = `tenant-agent-${randomUUID()}`
  const prompt = `owner-only-prompt-${randomUUID()}`
  const dir = join(root, '.claude', 'agents')
  mkdirSync(dir, { recursive: true })
  const filePath = join(dir, `${name}.md`)
  writeFileSync(
    filePath,
    `---\nname: ${name}\ndescription: 子代理租户隔离夹具\n---\n${prompt}\n`,
    'utf-8',
  )
  return { name, prompt, filePath }
}

let app: FastifyInstance
let scratchRoot: string
let savedRootsEnv: string | undefined

beforeEach(async () => {
  scratchRoot = mkdtempSync(join(tmpdir(), 'ihui-subagents-'))
  savedRootsEnv = process.env[WORKSPACE_ROOTS_ENV]
  process.env[WORKSPACE_ROOTS_ENV] = scratchRoot
  permissionState.rootsByUser.clear()

  app = Fastify()
  await app.register(workspaceAiRoutes, { prefix: '/api/workspace' })
  await app.ready()
})

afterEach(async () => {
  await app.close()
  if (savedRootsEnv === undefined) delete process.env[WORKSPACE_ROOTS_ENV]
  else process.env[WORKSPACE_ROOTS_ENV] = savedRootsEnv
  rmSync(scratchRoot, { recursive: true, force: true })
})

function list(workspacePath?: string) {
  return app.inject({
    method: 'GET',
    url: LIST_URL,
    ...(workspacePath === undefined ? {} : { query: { workspacePath } }),
  })
}

describe('GET /api/workspace/subagents 租户隔离', () => {
  it('本人正例:A discover 后 list 能看到自己的配置(收紧未误伤)', async () => {
    const agent = seedAgent(scratchRoot)
    authState.userId = `user-a-${randomUUID()}`
    grantRoot(authState.userId, scratchRoot)

    const res = await list(scratchRoot)
    expect(res.statusCode).toBe(200)

    const subagents = res.json().data.subagents as SubagentEntry[]
    const mine = subagents.find((s) => s.name === agent.name)
    expect(mine).toBeDefined()
    expect(mine!.systemPrompt).toContain(agent.prompt)
    expect(mine!.filePath.endsWith(`${agent.name}.md`)).toBe(true)
  })

  it('跨租户:A discover 后 B list 看不到 A 的 name / systemPrompt / filePath', async () => {
    const agent = seedAgent(scratchRoot)

    authState.userId = `user-a-${randomUUID()}`
    grantRoot(authState.userId, scratchRoot)
    const aRes = await list(scratchRoot)
    expect(aRes.statusCode).toBe(200)
    expect(aRes.body).toContain(agent.name)

    authState.userId = `user-b-${randomUUID()}`
    const bRes = await list()
    expect(bRes.statusCode).toBe(200)

    const bBody = bRes.body
    expect(bBody).not.toContain(agent.name)
    expect(bBody).not.toContain(agent.prompt)
    expect(bBody).not.toContain(`${agent.name}.md`)
    expect((bRes.json().data.subagents as SubagentEntry[]).some((s) => s.name === agent.name)).toBe(
      false,
    )
  })

  it('越界 workspacePath(`..` 回跳 / 绝对路径指向工作区外)⇒ 404,且拒绝了才谈 fs', async () => {
    const outsideExisting = join(scratchRoot, '..')
    const outsideMissing = join(tmpdir(), `ihui-subagents-nope-${randomUUID()}`)

    authState.userId = `user-a-${randomUUID()}`
    grantRoot(authState.userId, scratchRoot)
    for (const bad of [outsideExisting, outsideMissing, join(scratchRoot, '..', '..')]) {
      const res = await list(bad)
      expect(res.statusCode).toBe(404)
      // 防枚举:不复述服务端路径,也不把 ENOENT 变成 500
      expect(res.body).not.toMatch(/ENOENT|no such file|ENOTDIR/i)
    }

    // 对照:根内路径仍可正常 discover(证明是"越界被拒"而不是"一律拒")
    const ok = await list(scratchRoot)
    expect(ok.statusCode).toBe(200)
  })

  it('未登记任何工作区根 ⇒ fail-closed 404(不静默回落到全局桶)', async () => {
    delete process.env[WORKSPACE_ROOTS_ENV]
    authState.userId = `user-a-${randomUUID()}`
    // 用户仍有该根的 permission 行,但服务端登记根已撤销 ⇒ 必须 404(历史行不得成为绕过口)
    grantRoot(authState.userId, scratchRoot)

    const res = await list(scratchRoot)
    expect(res.statusCode).toBe(404)
    const bare = await list()
    expect(bare.statusCode).toBe(200)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
