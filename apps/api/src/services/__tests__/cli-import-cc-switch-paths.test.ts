// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SDB-42:cc-switch 导入两条路径都必须可用。
 *
 * 旧实现:(a) 路由扩展名白名单不含 `.db` ⇒ 官方 SQLite 库 400 被拒;
 * (b) `pickParserBySource` 只取同 source 第一条(SQLite)⇒ `config.json` 从 HTTP
 * 入口永远进不了 JSON parser。本文件锁:白名单放行 `.db`,且按文件名正确分流 parser。
 */
import { describe, it, expect, vi } from 'vitest'
import { createRequire } from 'node:module'
import initSqlJs from 'sql.js'

// preview 落 Redis 不是本用例关注面:内存 stub,绝不连真实 Redis。
vi.mock('../cli-import/redis-cache.js', () => ({
  savePreview: vi.fn(async () => {}),
  loadPreview: vi.fn(),
  deletePreview: vi.fn(),
}))

import { parseBySource, isAllowedConfigUpload } from '../cli-import/index.js'

const require = createRequire(import.meta.url)
const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm')

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
      `INSERT INTO providers VALUES ('p1', 'claude', 'Claude 官方', ` +
        `'{"apiBaseUrl":"https://api.anthropic.com","apiKey":"sk-test",` +
        `"model":"claude-sonnet","apiFormat":"anthropic"}', 1, NULL, NULL, NULL, NULL)`,
    )
    return Buffer.from(db.export())
  } finally {
    db.close()
  }
}

const CC_SWITCH_CONFIG_JSON = JSON.stringify({
  schemaVersion: 15,
  providers: [
    {
      id: 'p1',
      appType: 'claude',
      name: 'Claude 官方',
      settingsConfig: {
        apiBaseUrl: 'https://api.anthropic.com',
        apiKey: 'sk-test',
        model: 'claude-sonnet',
        apiFormat: 'anthropic',
      },
      isCurrent: true,
    },
  ],
})

describe('SDB-42 cc-switch 导入路径', () => {
  it('扩展名白名单放行官方 .db(不再 400)', () => {
    expect(isAllowedConfigUpload('cc-switch.db')).toBe(true)
    expect(isAllowedConfigUpload('config.json')).toBe(true)
    expect(isAllowedConfigUpload('payload.exe')).toBe(false)
  })

  it('.db 走 SQLite parser:按二进制 buffer 解析出 provider', async () => {
    const preview = await parseBySource('cc-switch', {
      sourcePath: 'cc-switch.db',
      buffer: await makeCcSwitchDb(),
    })
    expect(preview.providers).toHaveLength(1)
    expect(preview.providers[0]?.sourceId).toBe('p1')
  })

  it('.json 走 JSON parser(路由按 cc-switch 传 buffer,parser 侧自行转文本)', async () => {
    const preview = await parseBySource('cc-switch', {
      sourcePath: 'config.json',
      buffer: Buffer.from(CC_SWITCH_CONFIG_JSON, 'utf8'),
    })
    expect(preview.providers).toHaveLength(1)
    expect(preview.providers[0]?.sourceId).toBe('p1')
    expect(preview.providers[0]?.baseUrl).toBe('https://api.anthropic.com')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
