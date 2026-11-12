// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SDB-42 回归:cc-switch 的两条导入路径都必须走对解析器。
 *
 * 缺陷:`.db` 被扩展名白名单拦(SQLite 路不可用);`config.json` 因路由按
 * `source === 'cc-switch'` 一律当二进制、parser 又回退第一条(SQLite),
 * JSON 路也不可用。本文件锁:
 *   1) `.db` 被路由接受并进入 SQLite 解析器(真 sql.js 库 + 魔数校验);
 *   2) cc-switch JSON 走 JSON 解析器(文件名不带 cc-switch 也按扩展名分流);
 *   3) 不支持的扩展名仍 400,且提示可读;
 *   4) 超限文件 / 改名二进制仍被既有约束拒。
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import multipart from '@fastify/multipart'
import { createRequire } from 'node:module'
import initSqlJs from 'sql.js'

const authState = vi.hoisted(() => ({ userId: 'sdb42-user' }))

// 只测 parse-file,鉴权直通;DB / 配置 / Redis 全部替身,不连真实依赖。
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: async (request: { userId?: string }) => {
    request.userId = authState.userId
  },
}))
vi.mock('../src/config/index.js', () => ({
  config: {
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
    REDIS_URL: 'redis://127.0.0.1:6399',
  },
}))
vi.mock('../src/db/index.js', () => ({ db: {} }))
vi.mock('@ihui/database', () => ({
  aiModelConfig: {},
  aiModelConfigModels: {},
  cliProviderImports: {},
}))
vi.mock('../src/services/cli-import/redis-cache.js', () => ({
  savePreview: vi.fn(async () => {}),
  loadPreview: vi.fn(async () => undefined),
  deletePreview: vi.fn(async () => {}),
}))

import { cliImportRoutes } from '../src/routes/cli-import.js'

const require = createRequire(import.meta.url)
const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm')

interface PreviewResponse {
  code: number
  message: string
  data?: {
    preview?: {
      source?: string
      providers: Array<{ sourceId: string; baseUrl: string; apiKey?: string }>
    }
  }
}

interface ErrorResponse {
  code: number
  message: string
}

/** 造一份真 SQLite 库(cc-switch schema v16),用于验证 `.db` 确实进 SQLite parser。 */
async function makeCcSwitchDb(): Promise<Buffer> {
  const SQL = await initSqlJs({ locateFile: () => wasmPath })
  const db = new SQL.Database()
  try {
    db.run('PRAGMA user_version = 16')
    db.run('CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT)')
    db.run(
      'CREATE TABLE providers (id TEXT PRIMARY KEY, app_type TEXT, name TEXT, ' +
        'settings_config TEXT, is_current INTEGER, category TEXT, website_url TEXT, ' +
        'icon TEXT, icon_color TEXT)',
    )
    db.run(`INSERT INTO settings VALUES ('app_version', '3.8.0')`)
    db.run(
      `INSERT INTO providers VALUES ('sqlite-p1', 'claude', 'SQLite Provider', ` +
        `'{"apiBaseUrl":"https://sqlite.example.com","apiKey":"sk-sqlite",` +
        `"model":"claude-sonnet","apiFormat":"anthropic"}', 1, NULL, NULL, NULL, NULL)`,
    )
    return Buffer.from(db.export())
  } finally {
    db.close()
  }
}

/** cc-switch 旧版导出 JSON(与 SQLite 行同构,camelCase)。 */
const CC_SWITCH_CONFIG_JSON = JSON.stringify({
  schemaVersion: 15,
  providers: [
    {
      id: 'json-p1',
      appType: 'codex',
      name: 'JSON Provider',
      settingsConfig: {
        apiBaseUrl: 'https://json.example.com/v1',
        apiKey: 'sk-json',
        model: 'gpt-5',
        apiFormat: 'openai_chat',
      },
      isCurrent: true,
    },
  ],
})

function buildMultipart(
  parts: Array<{ name: string; filename?: string; content: Buffer | string }>,
): { body: Buffer; boundary: string } {
  const boundary = '----VitestSdb42Boundary'
  const chunks: Buffer[] = []
  for (const p of parts) {
    if (p.filename) {
      chunks.push(
        Buffer.from(
          `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="${p.name}"; filename="${p.filename}"\r\n` +
            'Content-Type: application/octet-stream\r\n\r\n',
        ),
      )
    } else {
      chunks.push(
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${p.name}"\r\n\r\n`),
      )
    }
    chunks.push(Buffer.isBuffer(p.content) ? p.content : Buffer.from(p.content, 'utf8'))
    chunks.push(Buffer.from('\r\n'))
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`))
  return { body: Buffer.concat(chunks), boundary }
}

describe('SDB-42 cc-switch 上传:来源 + 扩展名决定解析器', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(multipart, { limits: { fileSize: 100 * 1024 * 1024 } })
    await app.register(cliImportRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  async function postFile(
    parts: Array<{ name: string; filename?: string; content: Buffer | string }>,
  ) {
    const { body, boundary } = buildMultipart(parts)
    return app.inject({
      method: 'POST',
      url: '/api/cli-import/parse-file',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
        'content-length': String(body.length),
      },
      payload: body,
    })
  }

  it('① 官方 cc-switch.db 被路由接受并进 SQLite 解析器', async () => {
    const res = await postFile([
      { name: 'source', content: 'cc-switch' },
      { name: 'file', filename: 'cc-switch.db', content: await makeCcSwitchDb() },
    ])
    expect(res.statusCode).toBe(200)
    const json = res.json() as PreviewResponse
    expect(json.data?.preview?.providers).toHaveLength(1)
    expect(json.data?.preview?.providers[0]?.sourceId).toBe('sqlite-p1')
    expect(json.data?.preview?.providers[0]?.baseUrl).toBe('https://sqlite.example.com')
  })

  it('② cc-switch JSON 走 JSON 解析器(文件名不含 cc-switch 也按 .json 分流)', async () => {
    // source 故意放在文件之后:路由必须在读完全部 part 后判定,不能边读边猜。
    const res = await postFile([
      { name: 'file', filename: 'backup.json', content: CC_SWITCH_CONFIG_JSON },
      { name: 'source', content: 'cc-switch' },
    ])
    expect(res.statusCode).toBe(200)
    const json = res.json() as PreviewResponse
    expect(json.data?.preview?.providers).toHaveLength(1)
    expect(json.data?.preview?.providers[0]?.sourceId).toBe('json-p1')
    expect(json.data?.preview?.providers[0]?.baseUrl).toBe('https://json.example.com/v1')
  })

  it('③ 不支持的扩展名仍被拒,且提示可读', async () => {
    const exeRes = await postFile([
      { name: 'source', content: 'cc-switch' },
      { name: 'file', filename: 'payload.exe', content: Buffer.from('MZ...') },
    ])
    expect(exeRes.statusCode).toBe(400)
    expect((exeRes.json() as ErrorResponse).message).toContain('仅支持配置文件格式')

    // .yaml 是通用白名单成员,但对 cc-switch 无对应解析器:必须显式说明支持哪些形态
    const yamlRes = await postFile([
      { name: 'source', content: 'cc-switch' },
      { name: 'file', filename: 'cc-switch.yaml', content: 'providers: []' },
    ])
    expect(yamlRes.statusCode).toBe(400)
    const yamlMsg = (yamlRes.json() as ErrorResponse).message
    expect(yamlMsg).toContain('.db')
    expect(yamlMsg).toContain('.json')
  })

  it('④ 超限文件与改名二进制仍按既有约束拒绝', async () => {
    const oversize = await postFile([
      { name: 'source', content: 'cc-switch' },
      { name: 'file', filename: 'cc-switch.db', content: Buffer.alloc(5 * 1024 * 1024 + 1) },
    ])
    expect(oversize.statusCode).toBe(400)
    expect((oversize.json() as ErrorResponse).message).toContain('5MB')

    // 扩展名对但内容不是 SQLite ⇒ 在解析器之前被魔数闸挡下
    const fakeDb = await postFile([
      { name: 'source', content: 'cc-switch' },
      { name: 'file', filename: 'cc-switch.db', content: Buffer.from('not a sqlite file') },
    ])
    expect(fakeDb.statusCode).toBe(400)
    expect((fakeDb.json() as ErrorResponse).message).toContain('SQLite')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
