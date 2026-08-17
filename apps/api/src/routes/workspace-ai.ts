/**
 * Workspace AI 路由 — 重建旧架构 AI Workspace 的 15 个核心子模块端点。
 *
 * 迁移自 Python FastAPI (commit 3ee96cf0: server/app/api/v1/workspace/routes.py)。
 * 路由前缀：/api/workspace（在 server.ts 注册）。
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import {
  swarmManager,
  subagentManager,
  agentLoop,
  sandboxExecutor,
  computerUse,
  codebaseIndexer,
  incrementalIndexer,
  vectorIndexer,
  checkpointManager,
  backgroundAgentManager,
  permissionManager,
  personaRegistry,
  routineManager,
  githubClient,
  fsBridge,
} from '../services/workspace-ai-service.js'

export const workspaceAiRoutes: FastifyPluginAsync = async (server) => {
  // 鉴权：复用 workspace.ts 的模式
  const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      const message = (e as Error).message || 'Authentication required'
      return reply.status(statusCode).send(error(statusCode, message))
    }
  }

  // 初始化权限推送函数（复用 ws-notifications 的 pushNotification 装饰器）
  const pushFn =
    typeof server.pushNotification === 'function'
      ? (userId: string, payload: unknown) => server.pushNotification(userId, payload)
      : null
  if (pushFn) permissionManager.setPushFn(pushFn)

  // workspace_permissions 系统运行时拦截 helper
  // 返回 null → 放行;返回 Error → 拒绝(已写 403 响应)
  const assertWorkspacePermission = async (
    request: FastifyRequest,
    reply: FastifyReply,
    ctx: { workspacePath: string; tool: string; args: Record<string, unknown> },
  ): Promise<Error | null> => {
    if (!request.userId) return new Error('未登录')
    const decision = await permissionManager.checkWorkspace({
      userId: request.userId,
      workspacePath: ctx.workspacePath,
      tool: ctx.tool,
      args: ctx.args,
    })
    if (decision.allowed) return null
    // mode=unset → 401 引导用户先调 /fs/open 完成 setup;其他 → 403
    const statusCode = decision.mode === 'unset' ? 401 : 403
    reply.status(statusCode).send(error(statusCode, decision.reason))
    return new Error(decision.reason)
  }

  const idParam = z.object({ id: z.string() })
  const swarmIdParam = z.object({ swarmId: z.string() })
  const taskIdParam = z.object({ taskId: z.string() })
  const agentIdParam = z.object({ agentId: z.string() })
  const requestIdParam = z.object({ requestId: z.string() })
  const prNumberParam = z.object({ number: z.coerce.number() })
  const workspacePathBody = z.object({ workspacePath: z.string() })
  const workspacePathQuery = z.object({ workspacePath: z.string() })

  // ===========================================================================
  // 1. FS Bridge — 文件系统桥接 (browse/read/write/edit/grep/glob/run)
  // ===========================================================================

  server.post('/fs/browse', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    // 2026-07-28 加固:z.parse 抛 ZodError 时 errorHandler 可能误判为 500,
    // 把整个 handler 用 try/catch 包裹,任何错误统一返回 400 + 中文消息
    try {
      const body = z.object({ path: z.string().optional() }).parse(request.body ?? {})
      const entries = fsBridge.browse(body.path)
      return reply.send(success({ entries }))
    } catch (e) {
      const msg = e instanceof Error ? e.message : '请求处理失败'
      return reply.status(400).send(error(400, msg))
    }
  })

  server.post('/fs/open', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const body = z.object({ path: z.string(), name: z.string().optional() }).parse(request.body)
    if (!body.path) return reply.status(400).send(error(400, 'path 不能为空'))
    try {
      const name = body.name ?? body.path.split(/[\\/]/).pop() ?? 'workspace'
      const techStack = fsBridge.detectTechStack(body.path)
      fsBridge.addRecent({ path: body.path, name, techStack })
      // 同步查询当前用户的权限配置,前端据此决定是否弹窗
      const { getPermission, touchLastAccessed } =
        await import('../db/workspace-permission-queries.js')
      const perm = await getPermission(request.userId, body.path)
      if (perm) await touchLastAccessed(request.userId, body.path)
      return reply.send(
        success({
          path: body.path,
          name,
          techStack,
          permission: perm,
          needsPermissionSetup: perm === null,
        }),
      )
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message))
    }
  })

  server.get('/fs/recent', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    return reply.send(success({ workspaces: fsBridge.loadRecent() }))
  })

  server.post('/fs/read', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const body = z
      .object({
        path: z.string(),
        workspacePath: z.string(),
        startLine: z.number().optional(),
        endLine: z.number().optional(),
      })
      .parse(request.body)
    if (!body.path || !body.workspacePath)
      return reply.status(400).send(error(400, 'path 和 workspacePath 不能为空'))
    if (
      (await assertWorkspacePermission(request, reply, {
        workspacePath: body.workspacePath,
        tool: 'fs.read',
        args: { path: body.path, startLine: body.startLine, endLine: body.endLine },
      })) !== null
    )
      return
    try {
      const result = fsBridge.read(body)
      return reply.send(success(result))
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message))
    }
  })

  server.post('/fs/write', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const body = z
      .object({
        path: z.string(),
        workspacePath: z.string(),
        content: z.string(),
        createDirs: z.boolean().optional(),
      })
      .parse(request.body)
    if (!body.path || !body.workspacePath)
      return reply.status(400).send(error(400, 'path 和 workspacePath 不能为空'))
    if (
      (await assertWorkspacePermission(request, reply, {
        workspacePath: body.workspacePath,
        tool: 'fs.write',
        args: { path: body.path, createDirs: body.createDirs },
      })) !== null
    )
      return
    try {
      const result = fsBridge.write(body)
      return reply.send(success(result))
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message))
    }
  })

  server.post('/fs/edit', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const body = z
      .object({
        path: z.string(),
        workspacePath: z.string(),
        oldText: z.string(),
        newText: z.string(),
      })
      .parse(request.body)
    if (!body.path || !body.workspacePath)
      return reply.status(400).send(error(400, 'path 和 workspacePath 不能为空'))
    if (
      (await assertWorkspacePermission(request, reply, {
        workspacePath: body.workspacePath,
        tool: 'fs.edit',
        args: { path: body.path },
      })) !== null
    )
      return
    try {
      const result = fsBridge.edit(body)
      return reply.send(success(result))
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message))
    }
  })

  server.post('/fs/delete', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const body = z
      .object({ path: z.string(), workspacePath: z.string(), recursive: z.boolean().optional() })
      .parse(request.body)
    if (!body.path || !body.workspacePath)
      return reply.status(400).send(error(400, 'path 和 workspacePath 不能为空'))
    if (
      (await assertWorkspacePermission(request, reply, {
        workspacePath: body.workspacePath,
        tool: 'fs.delete',
        args: { path: body.path, recursive: body.recursive },
      })) !== null
    )
      return
    try {
      const result = fsBridge.delete(body)
      return reply.send(success(result))
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message))
    }
  })

  server.post('/fs/grep', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const body = z
      .object({
        path: z.string(),
        workspacePath: z.string(),
        pattern: z.string(),
        glob: z.string().optional(),
        outputMode: z.string().optional(),
      })
      .parse(request.body)
    if (!body.path || !body.workspacePath || !body.pattern)
      return reply.status(400).send(error(400, 'path/workspacePath/pattern 不能为空'))
    if (
      (await assertWorkspacePermission(request, reply, {
        workspacePath: body.workspacePath,
        tool: 'fs.grep',
        args: { path: body.path, pattern: body.pattern, glob: body.glob },
      })) !== null
    )
      return
    try {
      const result = fsBridge.grep({
        ...body,
        outputMode: body.outputMode as 'content' | 'files_with_matches' | 'count' | undefined,
      })
      return reply.send(success(result))
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message))
    }
  })

  server.post('/fs/glob', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const body = z
      .object({ path: z.string(), workspacePath: z.string(), pattern: z.string() })
      .parse(request.body)
    if (!body.path || !body.workspacePath || !body.pattern)
      return reply.status(400).send(error(400, 'path/workspacePath/pattern 不能为空'))
    if (
      (await assertWorkspacePermission(request, reply, {
        workspacePath: body.workspacePath,
        tool: 'fs.glob',
        args: { path: body.path, pattern: body.pattern },
      })) !== null
    )
      return
    try {
      const result = fsBridge.glob(body)
      return reply.send(success(result))
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message))
    }
  })

  server.post('/fs/run', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const body = z
      .object({
        command: z.string(),
        workspacePath: z.string(),
        cwd: z.string().optional(),
        timeoutMs: z.number().optional(),
      })
      .parse(request.body)
    if (!body.command || !body.workspacePath)
      return reply.status(400).send(error(400, 'command 和 workspacePath 不能为空'))
    if (
      (await assertWorkspacePermission(request, reply, {
        workspacePath: body.workspacePath,
        tool: 'fs.run',
        args: { command: body.command, cwd: body.cwd, timeoutMs: body.timeoutMs },
      })) !== null
    )
      return
    try {
      const result = await fsBridge.run(body)
      return reply.send(success(result))
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message))
    }
  })

  // ===========================================================================
  // 1.1 Git Status + GitHub 集成 — 环境信息弹窗专用(2026-08-17 立,对标 Cursor env card)
  // ===========================================================================

  type GitStatusSnapshot = {
    isRepo: boolean
    branch: string | null
    hasRemote: boolean
    ahead: number
    behind: number
    counts: {
      added: number
      modified: number
      deleted: number
      untracked: number
      conflicted: number
      renamed: number
    }
    pullRequest: {
      state: 'open' | 'merged' | 'closed' | 'draft' | null
      number: number | null
      title: string | null
      url: string | null
    } | null
    lastCommit: {
      hash: string
      message: string
      author: string
      date: string
    } | null
    localPath: string | null
    remotes: Array<{ name: string; url: string; type: 'fetch' | 'push' | null }>
    fetchedAt: string
  }

  const EMPTY_SNAPSHOT: GitStatusSnapshot = {
    isRepo: false,
    branch: null,
    hasRemote: false,
    ahead: 0,
    behind: 0,
    counts: {
      added: 0,
      modified: 0,
      deleted: 0,
      untracked: 0,
      conflicted: 0,
      renamed: 0,
    },
    pullRequest: null,
    lastCommit: null,
    localPath: null,
    remotes: [],
    fetchedAt: new Date().toISOString(),
  }

  function buildGitCmd(args: string[]): string {
    const allowed = new Set([
      'rev-parse',
      'status',
      'branch',
      'remote',
      'rev-list',
      'log',
      'diff',
      'show',
      'ls-files',
      'symbolic-ref',
    ])
    const firstSub = args.find((a) => !a.startsWith('-'))
    if (!firstSub || !allowed.has(firstSub)) {
      throw new Error(`git 子命令未授权: ${args.join(' ')}`)
    }
    for (const a of args) {
      if (a.includes('..') || a.includes('~') || a.startsWith('/')) {
        throw new Error(`git 参数包含不安全片段: ${a}`)
      }
    }
    return `git ${args.map((a) => (a.includes(' ') ? `"${a.replace(/"/g, '\\"')}"` : a)).join(' ')}`
  }

  server.post('/git/status', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const body = z.object({ workspacePath: z.string().min(1) }).parse(request.body ?? {})
    const runGit = async (args: string[], timeoutMs = 8000): Promise<string> => {
      const result = await fsBridge.run({
        command: buildGitCmd(args),
        workspacePath: body.workspacePath,
        mode: 'read-only',
        timeoutMs,
      })
      return result.stdout ?? ''
    }
    try {
      const isRepo = (await runGit(['rev-parse', '--is-inside-work-tree'])).trim() === 'true'
      if (!isRepo) return reply.send(success(EMPTY_SNAPSHOT))
      const branchRaw = await runGit(['rev-parse', '--abbrev-ref', 'HEAD'])
      const branch = branchRaw.trim() === 'HEAD' ? null : branchRaw.trim() || null
      const hasRemote = (await runGit(['remote'])).trim().length > 0
      const statusRaw = await runGit(['status', '--porcelain=v1', '--branch'])
      const lines = statusRaw.split('\n')
      const header = lines[0] ?? ''
      let ahead = 0
      let behind = 0
      const aheadMatch = /\[ahead (\d+)/.exec(header)
      const behindMatch = /\[behind (\d+)/.exec(header)
      if (aheadMatch) ahead = Math.max(0, Number.parseInt(aheadMatch[1]!, 10) || 0)
      if (behindMatch) behind = Math.max(0, Number.parseInt(behindMatch[1]!, 10) || 0)
      const counts = {
        added: 0, modified: 0, deleted: 0, untracked: 0, conflicted: 0, renamed: 0,
      }
      for (const line of lines.slice(1)) {
        if (!line || line.length < 2) continue
        const x = line[0]
        const y = line[1]
        const rest = line.slice(2)
        if (x === 'R' || y === 'R') { counts.renamed++; continue }
        if (x === '?' && y === '?') { counts.untracked++; continue }
        if (x === 'U' || y === 'U' || (x === 'A' && y === 'A') || (x === 'D' && y === 'D')) { counts.conflicted++; continue }
        if (x === 'A' || y === 'A') { counts.added++; continue }
        if (x === 'D' || y === 'D') { counts.deleted++; continue }
        if (x !== ' ' || y !== ' ') { counts.modified++ }
        void rest
      }
      let lastCommit: GitStatusSnapshot['lastCommit'] = null
      try {
        const logRaw = await runGit(['log', '-1', '--format=%h%n%s%n%an%n%cI'])
        const [hash = '', message = '', author = '', date = ''] = logRaw.trim().split('\n')
        if (hash) lastCommit = { hash, message, author, date }
      } catch {
        lastCommit = null
      }
      let localPath: GitStatusSnapshot['localPath'] = null
      try {
        localPath = (await runGit(['rev-parse', '--show-toplevel'])).trim() || null
      } catch {
        localPath = null
      }
      let remotes: GitStatusSnapshot['remotes'] = []
      try {
        const remoteVRaw = await runGit(['remote', '-v'])
        const seen = new Set<string>()
        for (const line of remoteVRaw.split('\n')) {
          const m = /^(\S+)\s+(\S+)\s+\((\w+)\)\s*$/.exec(line.trim())
          if (!m) continue
          const key = `${m[1]}|${m[2]}`
          if (seen.has(key)) continue
          seen.add(key)
          remotes.push({ name: m[1]!, url: m[2]!, type: m[3] === 'push' ? 'push' : 'fetch' })
        }
      } catch {
        remotes = []
      }
      let pullRequest: GitStatusSnapshot['pullRequest'] = null
      if (hasRemote && branch && githubClient.loadToken()) {
        try {
          const remote = await githubClient.detectRemote(body.workspacePath)
          if (remote) {
            const prsRaw = await githubClient.listPRs({ owner: remote.owner, repo: remote.repo, state: 'open' })
            const prs = Array.isArray(prsRaw) ? (prsRaw as Array<Record<string, unknown>>) : []
            const matched = prs.find((pr) => {
              const head = pr.head as Record<string, unknown> | undefined
              return head?.ref === branch
            })
            if (matched) {
              const head = matched.head as Record<string, unknown> | undefined
              pullRequest = {
                state:
                  matched.state === 'open' ? 'open'
                    : matched.state === 'closed' ? 'closed'
                      : matched.merged ? 'merged'
                        : matched.draft ? 'draft' : null,
                number: typeof matched.number === 'number' ? matched.number : null,
                title: typeof matched.title === 'string' ? matched.title : null,
                url: typeof matched.html_url === 'string' ? matched.html_url : null,
              }
              void head
            }
          }
        } catch {
          pullRequest = null
        }
      }
      return reply.send(
        success({
          isRepo: true, branch, hasRemote, ahead, behind, counts,
          pullRequest, lastCommit, localPath, remotes,
          fetchedAt: new Date().toISOString(),
        }),
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'git status 失败'
      server.log.warn({ workspacePath: body.workspacePath, err: msg }, 'git/status 失败')
      return reply.send(success(EMPTY_SNAPSHOT))
    }
  })

  server.post('/github/status', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    try {
      const body = z.object({ workspacePath: z.string().min(1) }).parse(request.body ?? {})
      const remote = await githubClient.detectRemote(body.workspacePath)
      const branchRaw = await fsBridge.run({
        command: buildGitCmd(['rev-parse', '--abbrev-ref', 'HEAD']),
        workspacePath: body.workspacePath, mode: 'read-only', timeoutMs: 8000,
      })
      const currentBranch =
        branchRaw.stdout.trim() && branchRaw.stdout.trim() !== 'HEAD' ? branchRaw.stdout.trim() : null
      let defaultBranch: string | null = null
      try {
        const defRaw = await fsBridge.run({
          command: buildGitCmd(['symbolic-ref', 'refs/remotes/origin/HEAD']),
          workspacePath: body.workspacePath, mode: 'read-only', timeoutMs: 8000,
        })
        const m = /^refs\/remotes\/origin\/(.+)$/.exec((defRaw.stdout ?? '').trim())
        if (m) defaultBranch = m[1] ?? null
      } catch {
        defaultBranch = null
      }
      if (!defaultBranch) {
        try {
          const showRaw = await fsBridge.run({
            command: buildGitCmd(['remote', 'show', 'origin']),
            workspacePath: body.workspacePath, mode: 'read-only', timeoutMs: 8000,
          })
          const hm = /HEAD branch:\s*(\S+)/.exec(showRaw.stdout ?? '')
          if (hm) defaultBranch = hm[1] ?? null
        } catch {
          defaultBranch = null
        }
      }
      return reply.send(
        success({
          isGithubRepo: !!remote,
          owner: remote?.owner ?? null,
          repo: remote?.repo ?? null,
          ghConfigured: !!githubClient.loadToken(),
          currentBranch,
          defaultBranch,
        }),
      )
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message))
    }
  })

  server.post('/github/token', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    try {
      const body = z
        .object({ workspacePath: z.string().min(1), token: z.string().min(1) })
        .parse(request.body ?? {})
      const check = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${body.token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        signal: AbortSignal.timeout(8000),
      })
      if (!check.ok) {
        return reply.status(400).send(error(400, `GitHub Token 无效(HTTP ${check.status})`))
      }
      const { homedir } = await import('node:os')
      const { mkdirSync, writeFileSync } = await import('node:fs')
      const { join } = await import('node:path')
      const dir = join(homedir(), '.ihui')
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, 'github_token'), body.token.trim(), 'utf-8')
      return reply.send(success({ ok: true }))
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message))
    }
  })

  server.delete('/github/token', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    try {
      const { homedir } = await import('node:os')
      const { join } = await import('node:path')
      const { rmSync, existsSync } = await import('node:fs')
      const file = join(homedir(), '.ihui', 'github_token')
      if (existsSync(file)) rmSync(file, { force: true })
      return reply.send(success({ ok: true }))
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message))
    }
  })

  server.post('/github/device-code', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const body = z.object({ workspacePath: z.string().min(1) }).parse(request.body ?? {})
    const clientId = process.env.GITHUB_OAUTH_CLIENT_ID ?? ''
    if (!clientId) {
      return reply.status(400).send(error(400, '未配置 GitHub OAuth App(GITHUB_OAUTH_CLIENT_ID)'))
    }
    try {
      const res = await fetch('https://github.com/login/device/code', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: clientId, scope: 'repo read:org' }),
        signal: AbortSignal.timeout(10000),
      })
      const json = (await res.json()) as Record<string, unknown>
      if (!json.device_code || !json.user_code) {
        return reply.status(400).send(error(400, `GitHub 设备码获取失败: ${JSON.stringify(json).slice(0, 200)}`))
      }
      return reply.send(
        success({
          deviceCode: String(json.device_code),
          userCode: String(json.user_code),
          verificationUri: String(json.verification_uri ?? 'https://github.com/login/device'),
          expiresIn: typeof json.expires_in === 'number' ? json.expires_in : 900,
          interval: typeof json.interval === 'number' ? json.interval : 5,
        }),
      )
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message))
    }
  })

  server.post('/github/device-token', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const body = z.object({ deviceCode: z.string().min(1) }).parse(request.body ?? {})
    const clientId = process.env.GITHUB_OAUTH_CLIENT_ID ?? ''
    const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET ?? ''
    if (!clientId || !clientSecret) {
      return reply.status(400).send(error(400, '未配置 GitHub OAuth App'))
    }
    try {
      const res = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          device_code: body.deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        }),
        signal: AbortSignal.timeout(10000),
      })
      const json = (await res.json()) as Record<string, unknown>
      if (json.access_token) {
        const { homedir } = await import('node:os')
        const { mkdirSync, writeFileSync } = await import('node:fs')
        const { join } = await import('node:path')
        const dir = join(homedir(), '.ihui')
        mkdirSync(dir, { recursive: true })
        writeFileSync(join(dir, 'github_token'), String(json.access_token), 'utf-8')
        return reply.send(success({ status: 'ok' }))
      }
      const err = String(json.error ?? '')
      if (err === 'authorization_pending') return reply.send(success({ status: 'pending' }))
      if (err === 'slow_down') return reply.send(success({ status: 'slow_down' }))
      return reply.send(success({ status: 'expired', message: err || 'access_denied' }))
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message))
    }
  })

  // ===========================================================================
  // 2. Swarm — 群体智能多 Agent 编排
  // ===========================================================================

  const createSwarmSchema = z.object({
    task: z.string().min(1),
    workspacePath: z.string().min(1),
    modelId: z.string().optional(),
    agents: z
      .array(
        z.object({
          role: z.enum(['coordinator', 'worker', 'reviewer']),
          name: z.string().min(1),
          description: z.string().optional(),
          systemPrompt: z.string().optional(),
          tools: z.array(z.string()).max(100).optional(),
          model: z.string().optional(),
          dependencies: z.array(z.string()).max(100).optional(),
        }),
      )
      .min(1),
  })

  server.post('/swarms', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const parsed = createSwarmSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const plan = swarmManager.create(parsed.data)
    return reply.status(201).send(success(plan))
  })

  server.get('/swarms', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    return reply.send(success({ swarms: swarmManager.list() }))
  })

  server.get('/swarms/:swarmId', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const { swarmId } = swarmIdParam.parse(request.params)
    const plan = swarmManager.get(swarmId)
    if (!plan) return reply.status(404).send(error(404, 'Swarm 不存在'))
    return reply.send(success(plan))
  })

  server.post('/swarms/:swarmId/execute', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const { swarmId } = swarmIdParam.parse(request.params)
    try {
      const plan = await swarmManager.execute(swarmId)
      return reply.send(success(plan))
    } catch (e) {
      return reply.status(404).send(error(404, (e as Error).message))
    }
  })

  server.delete('/swarms/:swarmId', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const { swarmId } = swarmIdParam.parse(request.params)
    const canceled = swarmManager.cancel(swarmId)
    if (!canceled) return reply.status(404).send(error(404, 'Swarm 不存在'))
    return reply.send(success({ canceled: true }))
  })

  // ===========================================================================
  // 3. Subagents — 子代理委派
  // ===========================================================================

  server.get('/subagents', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const query = z.object({ workspacePath: z.string().optional() }).parse(request.query)
    if (query.workspacePath) subagentManager.discover(query.workspacePath)
    return reply.send(success({ subagents: subagentManager.list() }))
  })

  server.post('/subagents/delegate', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const body = z
      .object({
        name: z.string(),
        prompt: z.string(),
        workspacePath: z.string(),
        model: z.string().optional(),
      })
      .parse(request.body)
    if (!body.name || !body.prompt)
      return reply.status(400).send(error(400, 'name 和 prompt 不能为空'))
    try {
      const result = await subagentManager.delegate(body)
      return reply.send(success(result))
    } catch (e) {
      return reply.status(404).send(error(404, (e as Error).message))
    }
  })

  // ===========================================================================
  // 4. AgentLoop — Agent Runtime (工具调用循环 + 状态管理)
  // ===========================================================================

  const agentRunSchema = z.object({
    goal: z.string().min(1),
    sessionId: z.string().optional(),
    model: z.string().optional(),
    maxIterations: z.number().int().min(1).max(100).optional(),
    tools: z.array(z.string()).max(100).optional(),
    workspacePath: z.string().optional(),
  })

  server.post('/agent/run', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const parsed = agentRunSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const task = await agentLoop.run(parsed.data)
    return reply.send(success(task))
  })

  server.get('/agent/tasks', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    return reply.send(success({ tasks: agentLoop.listRunning() }))
  })

  server.get('/agent/tasks/:taskId', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const { taskId } = taskIdParam.parse(request.params)
    const task = agentLoop.status(taskId)
    if (!task) return reply.status(404).send(error(404, '任务不存在'))
    return reply.send(success(task))
  })

  server.post('/agent/tasks/:taskId/cancel', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const { taskId } = taskIdParam.parse(request.params)
    const canceled = agentLoop.cancel(taskId)
    if (!canceled) return reply.status(400).send(error(400, '任务不存在或不可取消'))
    return reply.send(success({ canceled: true }))
  })

  server.get('/agent/tools', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    return reply.send(success({ tools: agentLoop.listTools() }))
  })

  // ===========================================================================
  // 5. Sandbox — 沙箱执行环境
  // ===========================================================================

  server.post('/sandbox/execute', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const body = z
      .object({
        command: z.string(),
        workspacePath: z.string(),
        cwd: z.string().optional(),
        timeoutMs: z.number().optional(),
        mode: z.string().optional(),
      })
      .parse(request.body)
    if (!body.command || !body.workspacePath)
      return reply.status(400).send(error(400, 'command 和 workspacePath 不能为空'))
    try {
      const mode = body.mode ? sandboxExecutor.resolveMode(body.mode) : undefined
      const result = await sandboxExecutor.execute({
        command: body.command,
        workspacePath: body.workspacePath,
        cwd: body.cwd,
        timeoutMs: body.timeoutMs,
        mode,
      })
      return reply.send(success(result))
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message))
    }
  })

  // ===========================================================================
  // 6. ComputerUse — 计算机操作
  // ===========================================================================

  server.get('/computer-use/status', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    return reply.send(success({ enabled: computerUse.isEnabled() }))
  })

  server.post('/computer-use/screenshot', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    try {
      const result = await computerUse.takeScreenshot()
      return reply.send(success(result))
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message))
    }
  })

  server.post('/computer-use/mouse/click', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const body = z
      .object({ x: z.number(), y: z.number(), button: z.string().optional() })
      .parse(request.body)
    if (typeof body.x !== 'number' || typeof body.y !== 'number')
      return reply.status(400).send(error(400, 'x 和 y 必须为数字'))
    try {
      await computerUse.mouseClick({
        x: body.x,
        y: body.y,
        button: body.button as 'left' | 'right' | 'double' | undefined,
      })
      return reply.send(success({ clicked: true }))
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message))
    }
  })

  server.post('/computer-use/keyboard/type', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const body = z.object({ text: z.string() }).parse(request.body)
    if (!body.text) return reply.status(400).send(error(400, 'text 不能为空'))
    try {
      await computerUse.keyboardType({ text: body.text })
      return reply.send(success({ typed: true }))
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message))
    }
  })

  server.post('/computer-use/keyboard/key', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const body = z.object({ key: z.string() }).parse(request.body)
    if (!body.key) return reply.status(400).send(error(400, 'key 不能为空'))
    try {
      await computerUse.keyboardKey({ key: body.key })
      return reply.send(success({ pressed: true }))
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message))
    }
  })

  server.get('/computer-use/screen-size', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    try {
      const size = await computerUse.getScreenSize()
      return reply.send(success(size))
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message))
    }
  })

  // ===========================================================================
  // 7. CodebaseIndex — 代码库索引
  // ===========================================================================

  server.post('/codebase/index', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const body = workspacePathBody.parse(request.body)
    if (!body.workspacePath) return reply.status(400).send(error(400, 'workspacePath 不能为空'))
    try {
      const index = codebaseIndexer.index(body.workspacePath)
      return reply.send(success(index))
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message))
    }
  })

  server.get('/codebase/search', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const query = z
      .object({ workspacePath: z.string(), q: z.string(), topK: z.coerce.number().optional() })
      .parse(request.query)
    if (!query.workspacePath || !query.q)
      return reply.status(400).send(error(400, 'workspacePath 和 q 不能为空'))
    const results = codebaseIndexer.search(query.workspacePath, query.q, query.topK ?? 20)
    return reply.send(success({ results }))
  })

  server.post('/codebase/incremental', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const body = workspacePathBody.parse(request.body)
    if (!body.workspacePath) return reply.status(400).send(error(400, 'workspacePath 不能为空'))
    try {
      const result = incrementalIndexer.incrementalUpdate(body.workspacePath)
      return reply.send(success(result))
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message))
    }
  })

  server.get('/codebase/status', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const query = workspacePathQuery.parse(request.query)
    if (!query.workspacePath) return reply.status(400).send(error(400, 'workspacePath 不能为空'))
    return reply.send(success(incrementalIndexer.status(query.workspacePath)))
  })

  // ===========================================================================
  // 8. VectorIndex — 向量索引管理
  // ===========================================================================

  server.post('/vector/index', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const body = workspacePathBody.parse(request.body)
    if (!body.workspacePath) return reply.status(400).send(error(400, 'workspacePath 不能为空'))
    try {
      const result = await vectorIndexer.indexWorkspace(body.workspacePath)
      return reply.send(success(result))
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message))
    }
  })

  server.post('/vector/search', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const body = z
      .object({ workspacePath: z.string(), query: z.string(), topK: z.number().optional() })
      .parse(request.body)
    if (!body.workspacePath || !body.query)
      return reply.status(400).send(error(400, 'workspacePath 和 query 不能为空'))
    try {
      const results = await vectorIndexer.search(body)
      return reply.send(success({ results }))
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message))
    }
  })

  // ===========================================================================
  // 9. Checkpoint — 检查点状态恢复
  // ===========================================================================

  server.get('/checkpoints', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const query = workspacePathQuery.parse(request.query)
    if (!query.workspacePath) return reply.status(400).send(error(400, 'workspacePath 不能为空'))
    return reply.send(success({ checkpoints: checkpointManager.list(query.workspacePath) }))
  })

  server.post('/checkpoints/:id/rollback', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const { id } = idParam.parse(request.params)
    const body = workspacePathBody.parse(request.body)
    if (!body.workspacePath) return reply.status(400).send(error(400, 'workspacePath 不能为空'))
    const cp = checkpointManager.rollback(body.workspacePath, id)
    if (!cp) return reply.status(404).send(error(404, '检查点不存在'))
    return reply.send(success(cp))
  })

  server.post('/checkpoints/undo', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const body = workspacePathBody.parse(request.body)
    if (!body.workspacePath) return reply.status(400).send(error(400, 'workspacePath 不能为空'))
    const cp = checkpointManager.undoLast(body.workspacePath)
    if (!cp) return reply.status(404).send(error(404, '无检查点可撤销'))
    return reply.send(success(cp))
  })

  // ===========================================================================
  // 10. BackgroundAgents — 后台长时运行 Agent
  // ===========================================================================

  const startBgAgentSchema = z.object({
    prompt: z.string().min(1),
    workspacePath: z.string().min(1),
    modelId: z.string().optional(),
    userUuid: z.string().optional(),
    maxIterations: z.number().int().min(1).max(100).optional(),
    systemPrompt: z.string().optional(),
  })

  server.post('/background-agents', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const parsed = startBgAgentSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const agentId = backgroundAgentManager.start({
      ...parsed.data,
      userUuid: parsed.data.userUuid ?? request.userId,
    })
    return reply.status(201).send(success({ agentId }))
  })

  server.get('/background-agents', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    return reply.send(success({ agents: backgroundAgentManager.list() }))
  })

  server.get('/background-agents/:agentId', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const { agentId } = agentIdParam.parse(request.params)
    const agent = backgroundAgentManager.get(agentId)
    if (!agent) return reply.status(404).send(error(404, '后台 Agent 不存在'))
    return reply.send(success(agent))
  })

  server.post('/background-agents/:agentId/cancel', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const { agentId } = agentIdParam.parse(request.params)
    const canceled = backgroundAgentManager.cancel(agentId)
    if (!canceled) return reply.status(400).send(error(400, 'Agent 不存在或不可取消'))
    return reply.send(success({ canceled: true }))
  })

  // ===========================================================================
  // 11. Permissions — Agent 权限确认
  // ===========================================================================

  const permissionCheckSchema = z.object({
    workspacePath: z.string().min(1),
    mode: z.enum(['default', 'acceptEdits', 'plan', 'bypassPermissions']),
    tool: z.string().min(1),
    args: z.record(z.string(), z.unknown()).default({}),
  })

  server.post('/permissions/check', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const parsed = permissionCheckSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const result = await permissionManager.check({
      userId: request.userId,
      ...parsed.data,
    })
    return reply.send(success(result))
  })

  server.post('/permissions/:requestId/resolve', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const { requestId } = requestIdParam.parse(request.params)
    const body = z.object({ approved: z.boolean() }).parse(request.body)
    const resolved = permissionManager.resolve(requestId, body.approved)
    if (!resolved) return reply.status(400).send(error(400, '请求不存在或已处理'))
    return reply.send(success({ resolved: true }))
  })

  server.get('/permissions/requests', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    return reply.send(success({ requests: permissionManager.listPending(request.userId) }))
  })

  // ===========================================================================
  // 12. PersonaRegistry — 人格注册
  // ===========================================================================

  server.get('/personas', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const query = z.object({ category: z.string().optional() }).parse(request.query)
    return reply.send(success({ personas: personaRegistry.list(query.category) }))
  })

  server.get('/personas/:id', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const { id } = idParam.parse(request.params)
    const persona = personaRegistry.get(id)
    if (!persona) return reply.status(404).send(error(404, 'Persona 不存在'))
    return reply.send(success(persona))
  })

  const createPersonaSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    category: z.string().min(1),
    description: z.string().min(1),
    systemPrompt: z.string().min(1),
    tools: z.array(z.string()).max(100).optional(),
    examples: z.array(z.string()).max(100).optional(),
    tags: z.array(z.string()).max(100).optional(),
  })

  server.post('/personas', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const parsed = createPersonaSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    try {
      const persona = personaRegistry.create(parsed.data)
      return reply.status(201).send(success(persona))
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message))
    }
  })

  server.patch('/personas/:id', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const { id } = idParam.parse(request.params)
    const body = request.body as Record<string, unknown>
    const updated = personaRegistry.update(id, body)
    if (!updated) return reply.status(404).send(error(404, 'Persona 不存在'))
    return reply.send(success(updated))
  })

  server.delete('/personas/:id', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const { id } = idParam.parse(request.params)
    const deleted = personaRegistry.delete(id)
    if (!deleted) return reply.status(400).send(error(400, 'Persona 不存在或为内置'))
    return reply.send(success({ deleted: true }))
  })

  // ===========================================================================
  // 13. Routines — 例行程序
  // ===========================================================================

  const createRoutineSchema = z.object({
    name: z.string().min(1),
    prompt: z.string().min(1),
    cronExpression: z.string().min(1),
    workspacePath: z.string().min(1),
    modelId: z.string().optional(),
  })

  server.get('/routines', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    return reply.send(success({ routines: routineManager.list() }))
  })

  server.post('/routines', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const parsed = createRoutineSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const routine = routineManager.create(parsed.data)
    return reply.status(201).send(success(routine))
  })

  server.get('/routines/:id', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const { id } = idParam.parse(request.params)
    const routine = routineManager.get(id)
    if (!routine) return reply.status(404).send(error(404, '例行程序不存在'))
    return reply.send(success(routine))
  })

  server.patch('/routines/:id', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const { id } = idParam.parse(request.params)
    const body = request.body as Record<string, unknown>
    const updated = routineManager.update(id, body)
    if (!updated) return reply.status(404).send(error(404, '例行程序不存在'))
    return reply.send(success(updated))
  })

  server.delete('/routines/:id', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const { id } = idParam.parse(request.params)
    const deleted = routineManager.delete(id)
    if (!deleted) return reply.status(404).send(error(404, '例行程序不存在'))
    return reply.send(success({ deleted: true }))
  })

  server.post('/routines/:id/trigger', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const { id } = idParam.parse(request.params)
    const agentId = routineManager.trigger(id)
    if (!agentId) return reply.status(400).send(error(400, '例行程序不存在或未启用'))
    return reply.send(success({ agentId }))
  })

  // ===========================================================================
  // 14. GitHubIntegration — GitHub 集成
  // ===========================================================================

  server.post('/github/detect', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const body = workspacePathBody.parse(request.body)
    if (!body.workspacePath) return reply.status(400).send(error(400, 'workspacePath 不能为空'))
    const repo = await githubClient.detectRemote(body.workspacePath)
    return reply.send(success({ repo }))
  })

  const createPRSchema = z.object({
    owner: z.string().min(1),
    repo: z.string().min(1),
    title: z.string().min(1),
    head: z.string().min(1),
    base: z.string().min(1),
    body: z.string().optional(),
  })

  server.post('/github/prs', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const parsed = createPRSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    try {
      const pr = await githubClient.createPR(parsed.data)
      return reply.status(201).send(success(pr))
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message))
    }
  })

  server.get('/github/prs', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const query = z
      .object({ owner: z.string(), repo: z.string(), state: z.string().optional() })
      .parse(request.query)
    if (!query.owner || !query.repo)
      return reply.status(400).send(error(400, 'owner 和 repo 不能为空'))
    try {
      const prs = await githubClient.listPRs(query)
      return reply.send(success(prs))
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message))
    }
  })

  server.get('/github/prs/:number', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const { number } = prNumberParam.parse(request.params)
    const query = z.object({ owner: z.string(), repo: z.string() }).parse(request.query)
    if (!query.owner || !query.repo)
      return reply.status(400).send(error(400, 'owner 和 repo 不能为空'))
    try {
      const pr = await githubClient.getPR({ owner: query.owner, repo: query.repo, number })
      return reply.send(success(pr))
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message))
    }
  })

  server.post('/github/prs/:number/comments', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const { number } = prNumberParam.parse(request.params)
    const body = z
      .object({ owner: z.string(), repo: z.string(), body: z.string() })
      .parse(request.body)
    if (!body.owner || !body.repo || !body.body)
      return reply.status(400).send(error(400, 'owner/repo/body 不能为空'))
    try {
      const result = await githubClient.addPRComment({
        owner: body.owner,
        repo: body.repo,
        number,
        body: body.body,
      })
      return reply.send(success(result))
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message))
    }
  })

  server.post('/github/prs/:number/reviewers', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const { number } = prNumberParam.parse(request.params)
    const body = z
      .object({ owner: z.string(), repo: z.string(), reviewers: z.array(z.string()).max(100) })
      .parse(request.body)
    if (!body.owner || !body.repo || !body.reviewers)
      return reply.status(400).send(error(400, 'owner/repo/reviewers 不能为空'))
    try {
      const result = await githubClient.requestReview({
        owner: body.owner,
        repo: body.repo,
        number,
        reviewers: body.reviewers,
      })
      return reply.send(success(result))
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message))
    }
  })

  server.put('/github/prs/:number/merge', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const { number } = prNumberParam.parse(request.params)
    const body = z
      .object({
        owner: z.string(),
        repo: z.string(),
        commitTitle: z.string().optional(),
        mergeMethod: z.string().optional(),
      })
      .parse(request.body)
    if (!body.owner || !body.repo)
      return reply.status(400).send(error(400, 'owner 和 repo 不能为空'))
    try {
      const result = await githubClient.mergePR({
        owner: body.owner,
        repo: body.repo,
        number,
        commitTitle: body.commitTitle,
        mergeMethod: body.mergeMethod as 'merge' | 'squash' | 'rebase' | undefined,
      })
      return reply.send(success(result))
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message))
    }
  })

  server.get('/github/issues', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const query = z
      .object({ owner: z.string(), repo: z.string(), state: z.string().optional() })
      .parse(request.query)
    if (!query.owner || !query.repo)
      return reply.status(400).send(error(400, 'owner 和 repo 不能为空'))
    try {
      const issues = await githubClient.listIssues(query)
      return reply.send(success(issues))
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message))
    }
  })
}
