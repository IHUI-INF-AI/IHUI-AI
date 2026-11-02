// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * workspace 子代理发现/委派的两条尾巴回归锁(2026-11-02)。
 *
 * 尾巴一(用户级授权):上一轮 `subagentManager.discover` 只过服务端登记根
 * (`IHUI_WORKSPACE_ROOTS`),没接用户自己的 `workspace_permissions` 行 ⇒ 任何登录用户
 * 只要猜中一个他人已登记的工作区路径,就能读到该工作区 `.claude/agents` 下的全部配置,
 * 并能按 name 委派。本文件钉住:
 *   ① 无 permission 行 / 只有别人的行 / 行落在登记根外 ⇒ 一律 SubagentWorkspaceAccessError(404);
 *   ② 正向对照:本人有行 ⇒ discover 成功、configs 只在本人有权根的分桶里;
 *   ③ `list(undefined)` 只并集本人有权根,不回落「全服已发现」;
 *   ④ `delegate` 只查本次 workspacePath 对应桶,不跨桶兜底(同一用户的两个工作区之间也隔离)。
 *
 * 尾巴二(符号链接端到端):原有子代理发现面**没有** realpath 校验(只有 fsBridge 有),
 * 本轮补齐后按 Windows 实机能力跑:
 *   ① `.md` 文件 symlink 指向工作区外 ⇒ 拒绝(SubagentLinkError:指向工作区外的路径);
 *   ② 指向工作区内合法位置 ⇒ 放行且能解析出配置;
 *   ③ 链接目标不存在 ⇒ 明确错误「符号链接目标不存在」,不是裸 ENOENT 崩溃;
 *   ④ `.claude/agents` 目录本身被 junction/symlink 指向根外 ⇒ 拒绝;指向根内合法目录 ⇒ 放行。
 * 能力探测:能建文件 symlink 就建;不能就退化成目录 junction,并在用例名里显式写 SKIP 原因;
 * 两者都不行才跳过,绝不空壳假装测过。
 *
 * 路由层(HTTP 映射):未授权 GET/POST ⇒ 404 且响应体不泄漏子代理名;链接失效 ⇒ 400 明确文案。
 *
 * 反向例(实测,读数见提交说明):
 *   - 摘掉 `assertSubagentWorkspaceAccess` 的用户根判定 ⇒ 尾巴一 ①②③④ 全部变红;
 *   - 摘掉 `resolveInsideRoot` 的 realpath/isInsideRoot ⇒ 符号链接越界用例变红。
 */
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Fastify, { type FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.IHUI_WORKSPACE_ROOTS = ''
})

// 用户级权限行的唯一读取点:按 userId 返回「本人」的行(与真实 SQL 的 userId 谓词同语义)
const { mockListPermissionsByUser } = vi.hoisted(() => ({
  mockListPermissionsByUser: vi.fn(async (_userId: string) => [] as unknown[]),
}))

vi.mock('../src/db/workspace-permission-queries.js', () => ({
  listPermissionsByUser: mockListPermissionsByUser,
}))

// 路由层鉴权:按请求头切换调用者;保留真实导出,避免 require-permission 等模块缺名导出
vi.mock('../src/plugins/auth.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../src/plugins/auth.js')
  return {
    ...actual,
    authenticate: async (request: { userId?: string; headers: Record<string, unknown> }) => {
      const raw = request.headers['x-probe-user']
      request.userId = typeof raw === 'string' && raw.length > 0 ? raw : 'tenant-a'
    },
  }
})

import {
  subagentManager,
  SubagentLinkError,
  SubagentWorkspaceAccessError,
} from '../src/services/workspace-ai-service.js'
import { workspaceAiRoutes } from '../src/routes/workspace-ai.js'

// =============================================================================
// 符号链接能力探测(收集期一次;本机能力写进用例名,跳过原因不许含糊)
// =============================================================================

interface LinkCapability {
  fileSymlink: { ok: true } | { ok: false; reason: string }
  dirLink: { kind: 'symlink' | 'junction' } | { kind: 'none'; reason: string }
}

function errnoOf(e: unknown): string {
  return (e as NodeJS.ErrnoException)?.code ?? '未知错误'
}

function probeLinkCapability(): LinkCapability {
  const base = mkdtempSync(join(tmpdir(), 'ihui-sublink-probe-'))
  const capability: LinkCapability = {
    fileSymlink: { ok: false, reason: '未探测' },
    dirLink: { kind: 'none', reason: '未探测' },
  }
  try {
    mkdirSync(join(base, 'target-dir'))
    writeFileSync(join(base, 'target-file.md'), 'probe', 'utf-8')

    try {
      symlinkSync(join(base, 'target-file.md'), join(base, 'link-file'))
      capability.fileSymlink = { ok: true }
    } catch (e) {
      capability.fileSymlink = { ok: false, reason: errnoOf(e) }
    }

    try {
      symlinkSync(join(base, 'target-dir'), join(base, 'link-dir'))
      capability.dirLink = { kind: 'symlink' }
    } catch (e) {
      try {
        symlinkSync(join(base, 'target-dir'), join(base, 'link-dir-junction'), 'junction')
        capability.dirLink = { kind: 'junction' }
      } catch (e2) {
        capability.dirLink = { kind: 'none', reason: `${errnoOf(e)} / ${errnoOf(e2)}` }
      }
    }
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
  return capability
}

const linkCapability = probeLinkCapability()

const FILE_LINK_SKIP_NOTE = linkCapability.fileSymlink.ok
  ? ''
  : ` [SKIP: 本机无法创建文件符号链接(rc=${linkCapability.fileSymlink.reason});junction 只能替代目录链接]`

const DIR_LINK_SKIP_NOTE =
  linkCapability.dirLink.kind === 'none'
    ? ` [SKIP: 本机既不能建目录符号链接也不能建 junction(rc=${linkCapability.dirLink.reason})]`
    : ''

function makeFileLink(target: string, linkPath: string): void {
  symlinkSync(target, linkPath)
}

function makeDirLink(target: string, linkPath: string): void {
  if (process.platform === 'win32') {
    symlinkSync(target, linkPath, linkCapability.dirLink.kind === 'junction' ? 'junction' : 'dir')
  } else {
    symlinkSync(target, linkPath)
  }
}

// =============================================================================
// 夹具
// =============================================================================

const grantedPaths = new Map<string, string[]>()

let scratchRoot: string
let workspaceA: string
let workspaceB: string
let outsideRoot: string
let savedRootsEnv: string | undefined

function agentsDirOf(workspacePath: string): string {
  return join(workspacePath, '.claude', 'agents')
}

/** 写一份带 frontmatter 的子代理配置;返回真实文件路径 */
function writeAgent(workspacePath: string, fileName: string, name: string): string {
  const dir = agentsDirOf(workspacePath)
  mkdirSync(dir, { recursive: true })
  const file = join(dir, fileName)
  writeFileSync(
    file,
    `---\nname: ${name}\ndescription: ${name}-测试描述\n---\n你是 ${name},一个测试用子代理。\n`,
    'utf-8',
  )
  return file
}

function grant(userId: string, ...workspacePaths: string[]): void {
  grantedPaths.set(userId, [...(grantedPaths.get(userId) ?? []), ...workspacePaths])
}

function clearSubagentBuckets(): void {
  ;(subagentManager as unknown as { buckets: Map<string, unknown> }).buckets.clear()
}

/** 读取 reject 的 Error(避免 toMatchObject 对 Error 非枚举属性的依赖) */
async function rejectionOf(promise: Promise<unknown>): Promise<Error & { statusCode?: number }> {
  let caught: unknown
  try {
    await promise
  } catch (e) {
    caught = e
  }
  expect(caught, '应当 reject,而不是正常返回').toBeInstanceOf(Error)
  return caught as Error & { statusCode?: number }
}

/** 断言 404 语义的授权拒绝(不区分「未登记」与「不是你的」) */
async function expectAccessDenied(promise: Promise<unknown>): Promise<void> {
  const err = await rejectionOf(promise)
  expect(err.name).toBe('SubagentWorkspaceAccessError')
  expect(err.statusCode).toBe(404)
  expect(err.message).not.toMatch(/ENOENT|EACCES|EPERM/)
}

beforeEach(() => {
  scratchRoot = mkdtempSync(join(tmpdir(), 'ihui-wsai-subagents-'))
  workspaceA = join(scratchRoot, 'ws-a')
  workspaceB = join(scratchRoot, 'ws-b')
  outsideRoot = join(scratchRoot, 'outside')
  mkdirSync(workspaceA, { recursive: true })
  mkdirSync(workspaceB, { recursive: true })
  mkdirSync(outsideRoot, { recursive: true })

  savedRootsEnv = process.env.IHUI_WORKSPACE_ROOTS
  // 登记根取 realpath 形态,与 assertWithinRegisteredRoots 的归一结果同源
  process.env.IHUI_WORKSPACE_ROOTS = [realpathSync(workspaceA), realpathSync(workspaceB)].join(',')

  grantedPaths.clear()
  mockListPermissionsByUser.mockImplementation(async (userId: string) =>
    (grantedPaths.get(userId) ?? []).map((workspacePath) => ({
      id: `perm-${userId}-${workspacePath}`,
      userId,
      workspacePath,
      name: 'test',
      mode: 'default',
    })),
  )

  clearSubagentBuckets()
})

afterEach(() => {
  if (savedRootsEnv === undefined) delete process.env.IHUI_WORKSPACE_ROOTS
  else process.env.IHUI_WORKSPACE_ROOTS = savedRootsEnv
  rmSync(scratchRoot, { recursive: true, force: true })
  clearSubagentBuckets()
  mockListPermissionsByUser.mockReset()
})

// =============================================================================
// 尾巴一:用户级 workspace_permissions 授权
// =============================================================================

describe('尾巴一 · 用户级授权', () => {
  it('无 workspace_permissions 行 ⇒ discover 被 404 语义拒绝(不是返回空)', async () => {
    writeAgent(workspaceA, 'alpha.md', 'alpha')

    const err = await rejectionOf(subagentManager.discover(workspaceA, 'user-a'))
    expect(err.name).toBe('SubagentWorkspaceAccessError')
    expect(err.statusCode).toBe(404)
    // 措辞刻意不含服务器路径(防枚举)
    expect(err.message).not.toContain(workspaceA)
  })

  it('只有别人的 permission 行 ⇒ 本人仍被拒绝', async () => {
    writeAgent(workspaceA, 'alpha.md', 'alpha')
    grant('user-b', workspaceA)

    await expectAccessDenied(subagentManager.discover(workspaceA, 'user-a'))
  })

  it('permission 行落在登记根外 ⇒ 该行不计入授权(历史行不能成为绕过口)', async () => {
    writeAgent(workspaceA, 'alpha.md', 'alpha')
    // user-a 的权限行指向一个未登记的目录
    grant('user-a', outsideRoot)

    await expectAccessDenied(subagentManager.discover(workspaceA, 'user-a'))
  })

  it('未登记路径即便有 permission 行 ⇒ 仍被登记根闸拒绝', async () => {
    grant('user-a', outsideRoot)

    await expectAccessDenied(subagentManager.discover(outsideRoot, 'user-a'))
  })

  it('本人有本工作区的 permission 行 ⇒ discover 放行并解析出配置(正向对照)', async () => {
    writeAgent(workspaceA, 'alpha.md', 'alpha')
    writeAgent(workspaceA, 'beta.md', 'beta')
    grant('user-a', workspaceA)

    const configs = await subagentManager.discover(workspaceA, 'user-a')
    expect(configs.map((c) => c.name).sort()).toEqual(['alpha', 'beta'])
    expect(configs[0]?.systemPrompt.length).toBeGreaterThan(0)
  })

  it('list(不带 workspacePath)只并集本人有权根:B 看不到 A 已发现的配置', async () => {
    writeAgent(workspaceA, 'alpha.md', 'alpha')
    grant('user-a', workspaceA)
    grant('user-b', workspaceB)
    await subagentManager.discover(workspaceA, 'user-a')

    expect(await subagentManager.list(undefined, 'user-a')).toHaveLength(1)
    expect((await subagentManager.list(undefined, 'user-b')).map((c) => c.name)).toEqual([])
  })
})

// =============================================================================
// 尾巴一:configs 分桶与 delegate 不跨桶
// =============================================================================

describe('尾巴一 · configs 分桶', () => {
  it('A 在 workspaceA 发现的 alpha,B 拿自己的 workspaceB 委派 ⇒ 404(不跨桶兜底)', async () => {
    writeAgent(workspaceA, 'alpha.md', 'alpha')
    grant('user-a', workspaceA)
    grant('user-b', workspaceB)
    await subagentManager.discover(workspaceA, 'user-a')

    await expectAccessDenied(
      subagentManager.delegate({
        name: 'alpha',
        prompt: '尝试借用他人配置',
        workspacePath: workspaceB,
        userId: 'user-b',
      }),
    )
  })

  it('同一用户的两个有权工作区之间也不跨桶:alpha 只在 workspaceA,委派到 workspaceB ⇒ 404', async () => {
    writeAgent(workspaceA, 'alpha.md', 'alpha')
    grant('user-a', workspaceA, workspaceB)
    await subagentManager.discover(workspaceA, 'user-a')

    await expectAccessDenied(
      subagentManager.delegate({
        name: 'alpha',
        prompt: '跨工作区借用',
        workspacePath: workspaceB,
        userId: 'user-a',
      }),
    )
  })

  it('本桶内的委派成功(正向对照,证明上两条不是「怎么都 404」)', async () => {
    writeAgent(workspaceA, 'alpha.md', 'alpha')
    grant('user-a', workspaceA)
    await subagentManager.discover(workspaceA, 'user-a')

    const result = await subagentManager.delegate({
      name: 'alpha',
      prompt: '正常委派',
      workspacePath: workspaceA,
      userId: 'user-a',
    })
    expect(result.agentName).toBe('alpha')
    expect(result.result).toContain('正常委派')
  })

  it('重新 discover 会整桶替换:删掉的配置不能再被委派命中', async () => {
    const file = writeAgent(workspaceA, 'alpha.md', 'alpha')
    grant('user-a', workspaceA)
    await subagentManager.discover(workspaceA, 'user-a')
    rmSync(file)

    await subagentManager.discover(workspaceA, 'user-a')
    await expectAccessDenied(
      subagentManager.delegate({
        name: 'alpha',
        prompt: '删除后仍想委派',
        workspacePath: workspaceA,
        userId: 'user-a',
      }),
    )
  })
})

// =============================================================================
// 尾巴二:符号链接端到端
// =============================================================================

describe('尾巴二 · 符号链接', () => {
  const itFileLink = linkCapability.fileSymlink.ok ? it : it.skip
  const itDirLink = linkCapability.dirLink.kind === 'none' ? it.skip : it

  itFileLink(
    `文件 symlink 指向工作区外 ⇒ 拒绝(越界)${
      linkCapability.fileSymlink.ok ? '' : FILE_LINK_SKIP_NOTE
    }`,
    async () => {
      mkdirSync(agentsDirOf(workspaceA), { recursive: true })
      const escapedTarget = join(outsideRoot, 'escaped-agent.md')
      writeFileSync(escapedTarget, '---\nname: escaped\n---\n这是登记根外的配置。\n', 'utf-8')
      makeFileLink(escapedTarget, join(agentsDirOf(workspaceA), 'escaped.md'))
      grant('user-a', workspaceA)

      const err = await rejectionOf(subagentManager.discover(workspaceA, 'user-a'))
      expect(err).toBeInstanceOf(SubagentLinkError)
      expect(err.statusCode).toBe(400)
      expect(err.message).toContain('指向工作区外的路径')
    },
  )

  itFileLink(
    `文件 symlink 指向工作区内合法位置 ⇒ 放行且解析成功${
      linkCapability.fileSymlink.ok ? '' : FILE_LINK_SKIP_NOTE
    }`,
    async () => {
      const realDir = join(workspaceA, 'shared')
      mkdirSync(realDir, { recursive: true })
      const realTarget = join(realDir, 'real-agent.md')
      writeFileSync(
        realTarget,
        '---\nname: shared-agent\ndescription: 合法链接\n---\n工作区内的真实配置。\n',
        'utf-8',
      )
      mkdirSync(agentsDirOf(workspaceA), { recursive: true })
      makeFileLink(realTarget, join(agentsDirOf(workspaceA), 'linked.md'))
      grant('user-a', workspaceA)

      const configs = await subagentManager.discover(workspaceA, 'user-a')
      expect(configs.map((c) => c.name)).toEqual(['shared-agent'])
      expect(configs[0]?.filePath).toBe(realpathSync(realTarget))
    },
  )

  itFileLink(
    `文件 symlink 目标不存在 ⇒ 明确错误「符号链接目标不存在」而不是裸 ENOENT 崩溃${
      linkCapability.fileSymlink.ok ? '' : FILE_LINK_SKIP_NOTE
    }`,
    async () => {
      mkdirSync(join(workspaceA, 'shared'), { recursive: true })
      mkdirSync(agentsDirOf(workspaceA), { recursive: true })
      makeFileLink(
        join(workspaceA, 'shared', 'never-created.md'),
        join(agentsDirOf(workspaceA), 'dangling.md'),
      )
      grant('user-a', workspaceA)

      const err = await rejectionOf(subagentManager.discover(workspaceA, 'user-a'))
      expect(err).toBeInstanceOf(SubagentLinkError)
      expect(err.statusCode).toBe(400)
      expect(err.message).toContain('符号链接目标不存在')
      expect(err.message).not.toMatch(/ENOENT/)
      expect(err).not.toBeInstanceOf(SubagentWorkspaceAccessError)
    },
  )

  itDirLink(
    `.claude/agents 目录本身被指向登记根外 ⇒ 拒绝(目录级 junction/symlink)${
      linkCapability.dirLink.kind === 'none' ? DIR_LINK_SKIP_NOTE : ''
    }`,
    async () => {
      const outsideAgents = join(outsideRoot, 'agents-escape')
      mkdirSync(outsideAgents, { recursive: true })
      writeFileSync(
        join(outsideAgents, 'escaped.md'),
        '---\nname: escaped-dir\n---\n目录链接逃逸。\n',
        'utf-8',
      )
      mkdirSync(join(workspaceA, '.claude'), { recursive: true })
      makeDirLink(outsideAgents, agentsDirOf(workspaceA))
      grant('user-a', workspaceA)

      const err = await rejectionOf(subagentManager.discover(workspaceA, 'user-a'))
      expect(err).toBeInstanceOf(SubagentLinkError)
      expect(err.statusCode).toBe(400)
      expect(err.message).toContain('指向工作区外的路径')
    },
  )

  itDirLink(
    `.claude/agents 目录本身被指向登记根内合法目录 ⇒ 放行${
      linkCapability.dirLink.kind === 'none' ? DIR_LINK_SKIP_NOTE : ''
    }`,
    async () => {
      const insideAgents = join(workspaceA, 'shared', 'agents-inside')
      mkdirSync(insideAgents, { recursive: true })
      writeFileSync(
        join(insideAgents, 'inside.md'),
        '---\nname: inside-dir\n---\n目录链接合法。\n',
        'utf-8',
      )
      mkdirSync(join(workspaceA, '.claude'), { recursive: true })
      makeDirLink(insideAgents, agentsDirOf(workspaceA))
      grant('user-a', workspaceA)

      const configs = await subagentManager.discover(workspaceA, 'user-a')
      expect(configs.map((c) => c.name)).toEqual(['inside-dir'])
    },
  )
})

// =============================================================================
// 路由层:404 / 400 映射与防枚举
// =============================================================================

describe('路由层 · /api/workspace/subagents 映射', () => {
  const itFileLink = linkCapability.fileSymlink.ok ? it : it.skip
  let app: FastifyInstance

  beforeEach(async () => {
    app = Fastify()
    await app.register(workspaceAiRoutes, { prefix: '/api/workspace' })
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
  })

  it('未授权 GET(带 workspacePath)⇒ 404,响应体不泄漏子代理名/描述', async () => {
    writeAgent(workspaceA, 'alpha.md', 'alpha')

    const res = await app.inject({
      method: 'GET',
      url: '/api/workspace/subagents',
      query: { workspacePath: workspaceA },
      headers: { 'x-probe-user': 'user-a' },
    })

    expect(res.statusCode).toBe(404)
    expect(res.body).not.toContain('alpha')
    expect(res.body).not.toContain('测试描述')
    expect(res.body).not.toContain(workspaceA)
  })

  it('已授权 GET ⇒ 200 且返回本人工作区的配置(正向对照)', async () => {
    writeAgent(workspaceA, 'alpha.md', 'alpha')
    grant('user-a', workspaceA)

    const res = await app.inject({
      method: 'GET',
      url: '/api/workspace/subagents',
      query: { workspacePath: workspaceA },
      headers: { 'x-probe-user': 'user-a' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().data.subagents.map((s: { name: string }) => s.name)).toEqual(['alpha'])
  })

  it('未授权 POST delegate ⇒ 404(即便该桶已被有权的他人发现过)', async () => {
    writeAgent(workspaceA, 'alpha.md', 'alpha')
    // 先让有权的 user-b 真实发现一次 ⇒ 桶里有 alpha;这样 404 只能来自授权闸,
    // 而不是「桶恰好是空的」这种假绿(反向例摘掉授权闸后本用例必须变红)
    grant('user-b', workspaceA)
    const seeded = await app.inject({
      method: 'GET',
      url: '/api/workspace/subagents',
      query: { workspacePath: workspaceA },
      headers: { 'x-probe-user': 'user-b' },
    })
    expect(seeded.statusCode).toBe(200)

    const res = await app.inject({
      method: 'POST',
      url: '/api/workspace/subagents/delegate',
      headers: { 'x-probe-user': 'user-a' },
      payload: { name: 'alpha', prompt: '越权委派', workspacePath: workspaceA },
    })

    expect(res.statusCode).toBe(404)
    expect(res.body).not.toContain('alpha')
  })

  it('已授权 discover 后 POST delegate ⇒ 200(证明上一条不是「怎么都 404」)', async () => {
    writeAgent(workspaceA, 'alpha.md', 'alpha')
    grant('user-a', workspaceA)

    const discover = await app.inject({
      method: 'GET',
      url: '/api/workspace/subagents',
      query: { workspacePath: workspaceA },
      headers: { 'x-probe-user': 'user-a' },
    })
    expect(discover.statusCode).toBe(200)

    const res = await app.inject({
      method: 'POST',
      url: '/api/workspace/subagents/delegate',
      headers: { 'x-probe-user': 'user-a' },
      payload: { name: 'alpha', prompt: '正常委派', workspacePath: workspaceA },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().data.agentName).toBe('alpha')
  })

  itFileLink(
    `路由层:悬空符号链接 ⇒ 400 明确文案(不是 404 掩盖、也不是 500)${
      linkCapability.fileSymlink.ok ? '' : FILE_LINK_SKIP_NOTE
    }`,
    async () => {
      mkdirSync(agentsDirOf(workspaceA), { recursive: true })
      makeFileLink(
        join(workspaceA, 'never-created.md'),
        join(agentsDirOf(workspaceA), 'dangling.md'),
      )
      grant('user-a', workspaceA)

      const res = await app.inject({
        method: 'GET',
        url: '/api/workspace/subagents',
        query: { workspacePath: workspaceA },
        headers: { 'x-probe-user': 'user-a' },
      })

      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('符号链接目标不存在')
      expect(res.body).not.toMatch(/ENOENT/)
    },
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
