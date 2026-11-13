// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-254:GET /api/context/mentions?type=folder&workspacePath=... 的路径闸 + 扫描上限。
 *
 * 修复前:workspacePath 只是「max(512) 的客户端字符串」——
 *   · 传 `C:\Windows` / `/etc` 就能把服务器任意目录的目录树枚举回来(未与用户
 *     workspace 绑定、也未 realpath 收敛);
 *   · scanFolders 用 `readdirSync/statSync` 递归 2 层,把结果全量收集完再 slice,
 *     同步 IO 会把事件循环整段占住(可放大为 DoS)。
 *
 * 本档钉住:非法语法 400、越界 403(含符号链接逃逸)、合法路径条目字段不变、
 * 大目录/深目录边扫边截断不抛错、以及 scanFolders 不得再出现同步 readdir/stat。
 * 隔离:真实 mkdtemp 目录 + mock 掉 db / workspace_permissions 查询,不连 PG/Redis。
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import Fastify, { type FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const { permissionRows } = vi.hoisted(() => ({
  permissionRows: { rows: [] as Array<{ workspacePath: string }> },
}))

vi.mock('../src/db/index.js', () => ({ db: { execute: vi.fn(async () => []) } }))
vi.mock('../src/db/file-queries.js', () => ({ findRecentFiles: vi.fn(async () => []) }))
// 「用户 ↔ 工作区」唯一登记表的桩:真实实现要连 PG,判据本身由
// spec-service.assertRepoOwner 等既有用例钉,这里只喂「本人登记了 ROOT」这一事实。
vi.mock('../src/db/workspace-permission-queries.js', () => ({
  listPermissionsByUser: vi.fn(async () => permissionRows.rows),
}))
vi.mock('../src/services/embedding-provider.js', () => ({
  getEmbeddingProvider: () => ({ embed: vi.fn(async () => []) }),
}))
vi.mock('../src/utils/ai-service-fetch.js', () => ({
  aiServiceFetch: vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })),
}))
vi.mock('../src/utils/internal-jwt.js', () => ({ mintInternalJwt: vi.fn(async () => 'token') }))
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: { userId?: string }) => {
    request.userId = 'u-f254'
  }),
}))
vi.mock('../src/db/chat-conversation-access.js', () => ({
  getConversationAccess: vi.fn(async () => 'owner'),
}))

import {
  WorkspacePathInvalidError,
  contextEngineService,
  workspacePathViolation,
} from '../src/services/context-engine-service.js'
import { contextMentionRoutes } from '../src/routes/context-mentions.js'

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')
const SERVICE_FILE = join(ROOT_DIR, 'src/services/context-engine-service.ts')
const USER = 'u-f254'

// ---------------------------------------------------------------------------
// 真实目录夹具(不回退到任何固定系统路径)
// ---------------------------------------------------------------------------
const SCRATCH = mkdtempSync(join(tmpdir(), 'ihui-f254-'))
const ROOT = join(SCRATCH, 'ws')
const OUTSIDE = join(SCRATCH, 'outside')
const WS_LINK = join(SCRATCH, 'ws-link')
const INNER_LINK = join(ROOT, 'escape')

mkdirSync(join(ROOT, 'alpha', 'sub'), { recursive: true })
mkdirSync(join(ROOT, 'beta'), { recursive: true })
mkdirSync(join(ROOT, 'nested', 'child'), { recursive: true })
mkdirSync(join(OUTSIDE, 'secret'), { recursive: true })
writeFileSync(join(ROOT, 'readme.txt'), 'not a folder', 'utf-8')
writeFileSync(join(OUTSIDE, 'secret', 's.txt'), 'outside', 'utf-8')

// 大目录:300 个同级目录,用于断言"条数被截断且不抛错"
const BIG_COUNT = 300
mkdirSync(join(ROOT, 'big'))
for (let i = 0; i < BIG_COUNT; i += 1) mkdirSync(join(ROOT, 'big', `d-${i}`))

// 深目录:l1/l2/l3/l4/l5,用于断言扫描深度上限
mkdirSync(join(ROOT, 'deep'))
let deepChain = join(ROOT, 'deep')
for (let i = 1; i <= 5; i += 1) {
  deepChain = join(deepChain, `l${i}`)
  mkdirSync(deepChain)
}

// Windows 上创建 symlink 需要开发者模式/管理员;junction 通常可用,失败则跳过该用例。
const symlinkReady = (() => {
  try {
    const type = process.platform === 'win32' ? 'junction' : 'dir'
    symlinkSync(OUTSIDE, WS_LINK, type)
    symlinkSync(OUTSIDE, INNER_LINK, type)
    return true
  } catch {
    return false
  }
})()

let savedRootsEnv: string | undefined

beforeAll(() => {
  savedRootsEnv = process.env.IHUI_WORKSPACE_ROOTS
  // 服务端登记根白名单:只登记 ROOT;OUTSIDE 是它的同级目录,天然在根外。
  process.env.IHUI_WORKSPACE_ROOTS = ROOT
  permissionRows.rows = [{ workspacePath: ROOT }]
})

afterAll(() => {
  if (savedRootsEnv === undefined) delete process.env.IHUI_WORKSPACE_ROOTS
  else process.env.IHUI_WORKSPACE_ROOTS = savedRootsEnv
  rmSync(SCRATCH, { recursive: true, force: true })
})

function folderSearch(workspacePath: string, limit = 20, query = '') {
  return contextEngineService.search({
    query,
    type: 'folder',
    userId: USER,
    workspacePath,
    limit,
  })
}

describe('F-254 workspacePath 语法闸(400)', () => {
  it('② 含 `..` 段 ⇒ 400,不靠 realpath 事后兜', async () => {
    const escape = `${ROOT}${sep}..${sep}${sep}outside`
    expect(workspacePathViolation(escape)).toBeTruthy()
    await expect(folderSearch(escape)).rejects.toBeInstanceOf(WorkspacePathInvalidError)
    await expect(folderSearch(`..${sep}etc`)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('②b 含 NUL ⇒ 400', async () => {
    expect(workspacePathViolation(`${ROOT}\0x`)).toBeTruthy()
    await expect(folderSearch(`${ROOT}\0x`)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('②c 文件系统根(盘符根 / UNC 根 / POSIX 根)⇒ 400', async () => {
    for (const raw of ['/', '\\', 'C:\\', 'C:/', '\\\\srv\\share']) {
      expect(workspacePathViolation(raw), raw).toBeTruthy()
      await expect(folderSearch(raw), raw).rejects.toMatchObject({ statusCode: 400 })
    }
    // 正向对照:合法工作区路径不是"根",语法闸不得误杀
    expect(workspacePathViolation(ROOT)).toBeNull()
  })
})

describe('F-254 workspacePath 归属闸(403)', () => {
  it('① 绝对路径指向本人工作区外(如 C:\\Windows、/etc 形态)⇒ 403', async () => {
    const absolutes =
      process.platform === 'win32'
        ? [OUTSIDE, 'C:\\Windows', 'C:\\Windows\\System32']
        : [OUTSIDE, '/etc']
    for (const absolute of absolutes) {
      await expect(folderSearch(absolute), absolute).rejects.toMatchObject({ statusCode: 403 })
    }
  })

  it('① b 本人未登记任何工作区 ⇒ fail-closed 403(不是空列表 200)', async () => {
    permissionRows.rows = []
    await expect(folderSearch(ROOT)).rejects.toMatchObject({ statusCode: 403 })
    permissionRows.rows = [{ workspacePath: ROOT }]
  })

  it('③ 指向工作区外的符号链接 ⇒ 403(创建失败时跳过)', async () => {
    if (!symlinkReady) return
    await expect(folderSearch(WS_LINK)).rejects.toMatchObject({ statusCode: 403 })
  })

  it.skipIf(!symlinkReady)(
    '③ b 工作区内指向根外的符号链接目录不得入列(realpath 收敛)',
    async () => {
      const mentions = await folderSearch(ROOT, 50)
      expect(mentions.some((m) => m.label === 'escape')).toBe(false)
      expect(mentions.some((m) => m.meta?.path === INNER_LINK)).toBe(false)
    },
  )
})

describe('F-254 合法路径不变形', () => {
  it('④ 绝对工作区路径 ⇒ 正常返回,条目字段与修复前一致', async () => {
    const mentions = await folderSearch(ROOT, 20)
    const alpha = mentions.find((m) => m.label === 'alpha')
    expect(alpha).toEqual({
      id: `folder:${join(ROOT, 'alpha')}`,
      type: 'folder',
      label: 'alpha',
      detail: 'alpha',
      insertText: '@alpha/',
      meta: { path: join(ROOT, 'alpha') },
    })
    // 只返回目录:普通文件不得混进结果
    expect(mentions.some((m) => m.label === 'readme.txt')).toBe(false)
    // 深度仍限 2 层:alpha/sub 在列,alpha/sub 之下不再展开
    expect(mentions.some((m) => m.detail === 'alpha/sub')).toBe(true)
  })

  it('④ b 相对 workspacePath ⇒ 按本人最近工作区解析', async () => {
    const mentions = await folderSearch('nested', 20)
    expect(mentions).toEqual([
      {
        id: `folder:${join(ROOT, 'nested', 'child')}`,
        type: 'folder',
        label: 'child',
        detail: 'child',
        insertText: '@child/',
        meta: { path: join(ROOT, 'nested', 'child') },
      },
    ])
  })

  it('④ c q 过滤:父目录不命中也能搜到子目录(遍历不被 q 剪枝)', async () => {
    const mentions = await folderSearch(ROOT, 20, 'sub')
    expect(mentions.some((m) => m.detail === 'alpha/sub')).toBe(true)
  })
})

describe('F-254 扫描上限', () => {
  it('⑤ 大目录 ⇒ 返回条数按 limit 截断且不抛错', async () => {
    const started = Date.now()
    const fifty = await folderSearch('big', 50)
    const twoHundred = await folderSearch('big', 200)
    const elapsed = Date.now() - started
    expect(fifty).toHaveLength(50)
    expect(twoHundred).toHaveLength(200)
    expect(twoHundred.length).toBeLessThan(BIG_COUNT)
    // 每个条目都是 big 的直接子目录(detail 不含层级分隔符)
    expect(twoHundred.every((m) => !m.detail.includes('/'))).toBe(true)
    // 边扫边截断:不该把 300 条全收集完再切
    expect(elapsed).toBeLessThan(5000)
  })

  it('⑤ b 深目录 ⇒ 深度上限 2 层生效且不抛错', async () => {
    const mentions = await folderSearch('deep', 20)
    expect(mentions.length).toBeGreaterThan(0)
    expect(mentions.some((m) => m.detail === 'l1')).toBe(true)
    expect(mentions.some((m) => m.detail === 'l1/l2/l3')).toBe(true)
    // 第 4 层及以下不得返回
    expect(mentions.every((m) => m.detail.split('/').length <= 3)).toBe(true)
    expect(mentions.some((m) => m.detail.startsWith('l1/l2/l3/l4'))).toBe(false)
  })
})

describe('F-254 源锁', () => {
  it('⑥ scanFolders 不得再出现 readdirSync / statSync,必须走 opendir', () => {
    const code = readFileSync(SERVICE_FILE, 'utf8')
    // 只钉 scanFolders 方法体(注释里可以提到旧实现的名字,方法体里不行)
    const start = code.indexOf('private async scanFolders')
    const end = code.indexOf('两层集成入口', start)
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    const body = code.slice(start, end)
    expect(body).not.toMatch(/readdirSync|statSync/)
    expect(body).toMatch(/opendir\(/)
  })
})

describe('F-254 路由错误语义', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify()
    await app.register(contextMentionRoutes, { prefix: '/api/context' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('非法 workspacePath ⇒ 400(不是 500)', async () => {
    const escape = `${ROOT}${sep}..${sep}outside`
    const res = await app.inject({
      method: 'GET',
      url: `/api/context/mentions?type=folder&workspacePath=${encodeURIComponent(escape)}`,
    })
    expect(res.statusCode).toBe(400)
    expect(res.json()).toMatchObject({ code: 400 })
  })

  it('越界 workspacePath ⇒ 403(不是 500,也不是 200 空列表)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/context/mentions?type=folder&workspacePath=${encodeURIComponent(OUTSIDE)}`,
    })
    expect(res.statusCode).toBe(403)
    expect(res.json()).toMatchObject({ code: 403 })
  })

  it('合法 workspacePath ⇒ 200 且响应结构不变', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/context/mentions?type=folder&limit=5&workspacePath=${encodeURIComponent(ROOT)}`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      code: number
      message: string
      data: { mentions: Array<Record<string, unknown>>; total: number }
    }
    expect(body.code).toBe(0)
    expect(body.message).toBe('success')
    expect(body.data.mentions.length).toBeGreaterThan(0)
    expect(body.data.total).toBe(body.data.mentions.length)
    expect(Object.keys(body.data.mentions[0] ?? {}).sort()).toEqual([
      'detail',
      'id',
      'insertText',
      'label',
      'meta',
      'type',
    ])
  })
})
