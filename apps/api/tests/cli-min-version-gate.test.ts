// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

// 服务端可下发的 CLI 最低版本闸门 — api 侧离线回归（2026-09-27，G-243）。
//
// 不连库：db 走链式 mock（照抄 tests/admin-batch-missed-ids.test.ts 那份出口），
// 三条验收判据都问「响应面」而不是问数据库。
//
// 覆盖三格：
//   ① platform 枚举必须含 cli 档 —— 否则闸门对 CLI 结构上不可达（就是今天"分支永不触发"的成因）
//   ② 未配置时既有 /latest 与 /check-update 的响应体**逐字**不变（不得让现有 web/desktop 消费方红）
//   ③ 取真值优先级 env > 配置文件 > 无配置，且已配置/未配置返回**同一个键集**（消费方不得按形状分支）
import { afterEach, beforeAll, afterAll, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const { mockSelectRows } = vi.hoisted(() => ({
  mockSelectRows: vi.fn((): unknown[] => []),
}))

vi.mock('../src/db/index.js', () => {
  const makeChain = (resolver: () => unknown[]) => {
    const step: Record<string, unknown> = {}
    for (const m of ['from', 'where', 'returning', 'values', 'orderBy', 'limit', 'set', 'insert']) {
      step[m] = vi.fn(() => step)
    }
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(resolver()).then(resolve, reject)
    return step
  }
  const db = {
    select: vi.fn(() => makeChain(mockSelectRows)),
    update: vi.fn(() => makeChain(mockSelectRows)),
    insert: vi.fn(() => makeChain(mockSelectRows)),
    delete: vi.fn(() => makeChain(mockSelectRows)),
    execute: vi.fn().mockResolvedValue([]),
  }
  return { db, dbRead: db }
})

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: vi.fn().mockResolvedValue(undefined),
}))

import appVersionRoutes, {
  decideCliMinVersion,
  resolveCliMinVersion,
  type CliMinVersionInputs,
} from '../src/routes/app-version.js'

// 配置文件档的真实 IO 只在这一格被测；落点必须留在项目内（AGENTS §15/§15b），
// 用 .ihui-agent/tmp/（已 gitignore）而不是 os.tmpdir()（活进程 TEMP 可能仍钉在 C 盘）。
const TMP_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '.ihui-agent',
  'tmp',
  'api-cli-min-version-gate',
)
const TMP_FILE = join(TMP_DIR, 'cli-min-version.json')
/** 永远不存在的配置文件路径 —— 用来把"未配置"钉成可复现的前置，而不是依赖别人的仓库状态。 */
const MISSING_FILE = join(TMP_DIR, 'definitely-absent.json')

const ENV_KEYS = ['IHUI_CLI_MIN_VERSION', 'IHUI_CLI_MIN_VERSION_FILE'] as const
let envSnapshot: Record<string, string | undefined> = {}

function clearEnv(): void {
  for (const k of ENV_KEYS) delete process.env[k]
}

function writeTmpFile(text: string): void {
  mkdirSync(TMP_DIR, { recursive: true })
  writeFileSync(TMP_FILE, text, 'utf-8')
}

const server: FastifyInstance = Fastify({ logger: false })

beforeAll(async () => {
  envSnapshot = {}
  for (const k of ENV_KEYS) envSnapshot[k] = process.env[k]
  await server.register(appVersionRoutes, { prefix: '/api/app-version' })
  await server.ready()
})

afterAll(async () => {
  await server.close()
  for (const k of ENV_KEYS) {
    if (envSnapshot[k] === undefined) delete process.env[k]
    else process.env[k] = envSnapshot[k]
  }
  if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true, force: true })
})

afterEach(() => {
  clearEnv()
  if (existsSync(TMP_FILE)) rmSync(TMP_FILE, { force: true })
  mockSelectRows.mockReturnValue([])
})

// -----------------------------------------------------------------------------
// ① platform 枚举必须含 cli 档
// -----------------------------------------------------------------------------

describe('app-version platform 枚举 — cli 档可达', () => {
  it('GET /latest?platform=cli 不再被 400 拒（同轮负向对照：windows 仍 400）', async () => {
    const cli = await server.inject({ method: 'GET', url: '/api/app-version/latest?platform=cli' })
    expect(cli.statusCode).toBe(200)

    const windows = await server.inject({
      method: 'GET',
      url: '/api/app-version/latest?platform=windows',
    })
    expect(windows.statusCode).toBe(400)
  })

  it('GET /check-update?platform=cli 通过校验（负向对照：缺 platform 仍 400）', async () => {
    const ok = await server.inject({
      method: 'GET',
      url: '/api/app-version/check-update?platform=cli&version=1.0.0',
    })
    expect(ok.statusCode).toBe(200)

    const missing = await server.inject({
      method: 'GET',
      url: '/api/app-version/check-update?version=1.0.0',
    })
    expect(missing.statusCode).toBe(400)
  })

  it('POST / 接受 platform=cli 建档（201 而非 400；负向对照 windows 400）', async () => {
    const created = await server.inject({
      method: 'POST',
      url: '/api/app-version/',
      payload: { version: '1.0.0', platform: 'cli', buildNumber: 1 },
    })
    expect(created.statusCode).toBe(201)

    const rejected = await server.inject({
      method: 'POST',
      url: '/api/app-version/',
      payload: { version: '1.0.0', platform: 'windows', buildNumber: 1 },
    })
    expect(rejected.statusCode).toBe(400)
  })
})

// -----------------------------------------------------------------------------
// ② 未配置时既有端点逐字兼容
// -----------------------------------------------------------------------------

describe('app-version 既有端点 — 响应体逐字不变（等价回归）', () => {
  it('GET /latest 空结果：payload 字符串与补 cli 档之前逐字同形', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/app-version/latest' })
    expect(res.payload).toBe('{"code":0,"message":"success","data":{}}')
  })

  it('GET /latest?platform=web：键集仍只有 latest', async () => {
    mockSelectRows.mockReturnValue([
      { id: 'x', version: '2.0.0', platform: 'web', buildNumber: 7, status: 'latest' },
    ])
    const res = await server.inject({ method: 'GET', url: '/api/app-version/latest?platform=web' })
    expect(res.statusCode).toBe(200)
    expect(Object.keys(res.json().data)).toEqual(['latest'])
  })

  it('GET /check-update 无 latest 版本：payload 逐字（cli 与 web 两个平台同形）', async () => {
    const web = await server.inject({
      method: 'GET',
      url: '/api/app-version/check-update?platform=web&version=1.0.0',
    })
    expect(web.payload).toBe(
      '{"code":0,"message":"success","data":{"hasUpdate":false,"latestVersion":"1.0.0","forceUpdate":false,"downloadUrl":null}}',
    )
    const cli = await server.inject({
      method: 'GET',
      url: '/api/app-version/check-update?platform=cli&version=1.0.0',
    })
    expect(cli.payload).toBe(web.payload)
  })

  it('闸门开关不改动既有端点：设了 env 后 /latest 仍逐字同形', async () => {
    const before = await server.inject({ method: 'GET', url: '/api/app-version/latest' })
    process.env.IHUI_CLI_MIN_VERSION = '9.9.9'
    const after = await server.inject({ method: 'GET', url: '/api/app-version/latest' })
    expect(after.payload).toBe(before.payload)
  })
})

// -----------------------------------------------------------------------------
// ③ 取值优先级（纯判据 + IO 层各钉一遍）
// -----------------------------------------------------------------------------

const BASE_INPUTS: CliMinVersionInputs = {
  envValue: undefined,
  fileText: null,
  fileError: null,
  configPath: 'config/cli-min-version.json',
}

describe('decideCliMinVersion — 优先级 env > 配置文件 > 无配置', () => {
  it('环境变量有效 ⇒ source=env，且 reason 点名是哪个 env', () => {
    const d = decideCliMinVersion({ ...BASE_INPUTS, envValue: '1.4.2' })
    expect(d).toMatchObject({ minimumVersion: '1.4.2', source: 'env' })
    expect(d.reason).toContain('IHUI_CLI_MIN_VERSION')
  })

  it('env 与文件同时有效 ⇒ env 赢（优先级可测）', () => {
    const d = decideCliMinVersion({
      ...BASE_INPUTS,
      envValue: '1.4.2',
      fileText: '{"minimumVersion":"9.9.9"}',
    })
    expect(d.minimumVersion).toBe('1.4.2')
    expect(d.source).toBe('env')
  })

  it('env 未设而文件有效 ⇒ source=file', () => {
    const d = decideCliMinVersion({ ...BASE_INPUTS, fileText: '{"minimumVersion":"2.0.0"}' })
    expect(d).toMatchObject({ minimumVersion: '2.0.0', source: 'file' })
    expect(d.reason).toContain('config/cli-min-version.json')
  })

  it('两者都没有 ⇒ 不拦，且 reason 说明它查过哪两处（放行也留痕）', () => {
    const d = decideCliMinVersion(BASE_INPUTS)
    expect(d).toMatchObject({ minimumVersion: null, source: 'none' })
    expect(d.reason).toContain('IHUI_CLI_MIN_VERSION')
    expect(d.reason).toContain('config/cli-min-version.json')
  })

  it.each([
    ['env 值不是 X.Y.Z', { envValue: 'v1.4' }],
    ['文件不是合法 JSON', { fileText: 'not json' }],
    ['文件缺 minimumVersion', { fileText: '{}' }],
    ['文件的值不是字符串', { fileText: '{"minimumVersion":123}' }],
    ['文件的值不是 X.Y.Z', { fileText: '{"minimumVersion":"1.10"}' }],
    ['文件是数组不是对象', { fileText: '["1.2.3"]' }],
    ['读文件本身失败', { fileText: null, fileError: 'EACCES' }],
  ] satisfies Array<[string, Partial<CliMinVersionInputs>]>)(
    '%s ⇒ 降级为不拦并写明原因',
    (_name, patch) => {
      const d = decideCliMinVersion({ ...BASE_INPUTS, ...patch })
      expect(d.minimumVersion).toBe(null)
      expect(d.source).toBe('none')
      expect(d.reason.length).toBeGreaterThan(0)
    },
  )

  it('已配置与未配置的键集逐字相同（消费方不得按形状分支）', () => {
    const configured = decideCliMinVersion({ ...BASE_INPUTS, envValue: '1.4.2' })
    const unconfigured = decideCliMinVersion(BASE_INPUTS)
    expect(Object.keys(configured).sort()).toEqual(Object.keys(unconfigured).sort())
  })
})

describe('GET /api/app-version/min-cli-version — 真值来源随响应回传', () => {
  it('未配置 ⇒ minimumVersion=null / source=none（默认档不拦任何人）', async () => {
    process.env.IHUI_CLI_MIN_VERSION_FILE = MISSING_FILE
    const res = await server.inject({ method: 'GET', url: '/api/app-version/min-cli-version' })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { code: number; message: string; data: Record<string, unknown> }
    expect(body.code).toBe(0)
    expect(body.data).toMatchObject({ platform: 'cli', minimumVersion: null, source: 'none' })
    expect(typeof body.data.reason).toBe('string')
  })

  it('env 档 ⇒ source=env，值原样下发', async () => {
    process.env.IHUI_CLI_MIN_VERSION = '9.9.9'
    const res = await server.inject({ method: 'GET', url: '/api/app-version/min-cli-version' })
    expect(res.json().data).toMatchObject({ minimumVersion: '9.9.9', source: 'env' })
  })

  it('配置文件档 ⇒ source=file 并点名文件路径', async () => {
    writeTmpFile('{"minimumVersion":"3.1.0"}')
    process.env.IHUI_CLI_MIN_VERSION_FILE = TMP_FILE
    const res = await server.inject({ method: 'GET', url: '/api/app-version/min-cli-version' })
    const data = res.json().data as Record<string, unknown>
    expect(data).toMatchObject({ minimumVersion: '3.1.0', source: 'file' })
    expect(String(data.reason)).toContain('cli-min-version.json')
  })

  it('IO 层的优先级：env 与文件同时存在时 env 赢', async () => {
    writeTmpFile('{"minimumVersion":"3.1.0"}')
    process.env.IHUI_CLI_MIN_VERSION_FILE = TMP_FILE
    process.env.IHUI_CLI_MIN_VERSION = '4.0.0'
    const d = resolveCliMinVersion()
    expect(d).toMatchObject({ minimumVersion: '4.0.0', source: 'env' })
  })

  it('配置文件写坏 ⇒ 不拦（不是因为服务端 500）', async () => {
    writeTmpFile('{"minimumVersion":"banana"}')
    process.env.IHUI_CLI_MIN_VERSION_FILE = TMP_FILE
    const res = await server.inject({ method: 'GET', url: '/api/app-version/min-cli-version' })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toMatchObject({ minimumVersion: null, source: 'none' })
  })

  it('该端点公开可达（不带任何凭据），因为旧 CLI 可能尚未登录', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/app-version/min-cli-version' })
    expect([200, 401, 403]).not.toContain(0)
    expect(res.statusCode).toBe(200)
  })
})
