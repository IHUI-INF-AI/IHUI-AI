// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 中转站上游号池种子脚本(2026-09-13):极速API(x5m5x.com)接入
// - 启用 ai_model_config#31(swiftapi)
// - key 池写 5 条端点条目(api/de-api/us-api/fr-api/hk-api,extraMetadata.baseUrl 覆盖)
// - 写 16 个模型到 ai_model_config_models(is_relay_public=true)
// - 建 least-latency 渠道组 upstream-pool 并挂 swiftapi keys
// 幂等:重复执行先清旧 swiftapi key 条目与组成员、模型按 (config_id, model_id) 去重。
// 用法:node scripts/seed-relay-swiftapi.mjs  (在 apps/api 目录下运行,读同目录 .env)
import { readFileSync } from 'node:fs'
import { createCipheriv, randomBytes } from 'node:crypto'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
// postgres 驱动经 packages/database 的本地 node_modules 解析(pnpm 严格布局)
const { default: postgres } = require(process.env.POSTGRES_JS_PATH ||
  '../../../packages/database/node_modules/postgres/src/index.js')

// ---- env ----
const envText = readFileSync(new URL('../.env', import.meta.url), 'utf8')
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
    }),
)
const KEY = env.CREDENTIALS_ENCRYPTION_KEY
if (!KEY || KEY.length < 32) throw new Error('CREDENTIALS_ENCRYPTION_KEY missing/short')
const DB = env.DATABASE_URL
if (!DB) throw new Error('DATABASE_URL missing')

function encryptJSON(data) {
  const keyBuf = Buffer.from(KEY.slice(0, 32))
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', keyBuf, iv)
  const pt = Buffer.from(JSON.stringify(data), 'utf8')
  const ct = Buffer.concat([cipher.update(pt), cipher.final()])
  return { iv: iv.toString('base64'), ciphertext: ct.toString('base64'), tag: cipher.getAuthTag() }
}

// 密钥不入库(开源仓库):执行时经环境变量注入
// 用法:RELAY_SWIFTAPI_API_KEY=sk-xxx node scripts/seed-relay-swiftapi.mjs
const API_KEY = process.env.RELAY_SWIFTAPI_API_KEY || ''
if (!API_KEY.startsWith('sk-')) throw new Error('RELAY_SWIFTAPI_API_KEY env var required')
const PROVIDER = 'swiftapi'
const ENDPOINTS = [
  { ep: 'api', url: 'https://api.x5m5x.com/v1', weight: 5, priority: 0 },
  { ep: 'de-api', url: 'https://de-api.x5m5x.com/v1', weight: 4, priority: 1 },
  { ep: 'us-api', url: 'https://us-api.x5m5x.com/v1', weight: 3, priority: 2 },
  { ep: 'fr-api', url: 'https://fr-api.x5m5x.com/v1', weight: 2, priority: 3 },
  { ep: 'hk-api', url: 'https://hk-api.x5m5x.com/v1', weight: 1, priority: 4 },
]
// cf-api 有 Cloudflare WAF UA 过滤(服务端 fetch 会 403),不入池;其余 3 把密钥
// (按量/订阅/Auto-Model)由用户在 admin 后台追加为独立 key 条目即可,脚本结构不变。
const MODELS = [
  'Auto-Model',
  'MiniMax-M2.7',
  'MiniMax-M2.7-highspeed',
  'MiniMax-M3',
  'deepseek-v4-flash-0731',
  'deepseek-v4-pro-0813',
  'deepseek-v4.1-flash',
  'glm-5.1',
  'glm-5.2',
  'glm-5.3',
  'glm-5.3-flash',
  'gpt-5.6',
  'grok-4.6',
  'hy4-preview',
  'kimi-k2.6',
  'kimi-k2.7-code',
]
const GROUP_NAME = 'upstream-pool'

const sql = postgres(DB, { max: 1 })

try {
  await sql.begin(async (tx) => {
    // 1. 启用 config 31
    const cfg = await tx`
      UPDATE ai_model_config SET enabled=true, model_id_for_test='glm-5.3-flash', updated_at=now()
      WHERE provider_code=${PROVIDER} RETURNING id, name`
    if (cfg.length === 0) throw new Error('swiftapi config row not found (expected id=31)')
    const configId = cfg[0].id
    console.log(`[1] config enabled: id=${configId} name=${cfg[0].name}`)

    // 2. 清旧 swiftapi key 条目(及组成员,靠应用层先删)
    const oldIds = await tx`
      DELETE FROM ai_relay_key_pool WHERE provider_code=${PROVIDER} RETURNING id`
    if (oldIds.length > 0) {
      await tx`DELETE FROM ai_relay_channel_group_members WHERE key_pool_id IN ${tx(oldIds.map((r) => r.id))}`
    }
    console.log(`[2] removed old swiftapi key rows: ${oldIds.length}`)

    // 3. 插入 5 条端点 key 条目
    const enc = JSON.stringify(encryptJSON(API_KEY))
    const keyIds = []
    for (const e of ENDPOINTS) {
      const r = await tx`
        INSERT INTO ai_relay_key_pool (provider_code, name, api_key_enc, key_prefix, priority, weight, is_enabled, extra_metadata, remark)
        VALUES (${PROVIDER}, ${`SwiftAPI ${e.ep}`}, ${enc}, ${`${API_KEY.slice(0, 6)}***${API_KEY.slice(-4)}`},
                ${e.priority}, ${e.weight}, true, ${tx.json({ baseUrl: e.url })},
                ${`极速API 端点 ${e.ep}(测速报告 2026-09-12 v3:均零失败;cf-api 因 WAF 未入池)`})
        RETURNING id`
      keyIds.push(r[0].id)
    }
    console.log(`[3] inserted ${keyIds.length} endpoint keys`)

    // 4. 渠道组(least-latency 自动择优)+ 成员
    const g = await tx`
      INSERT INTO ai_relay_channel_groups (name, description, load_balance_strategy, enabled, priority)
      VALUES (${GROUP_NAME}, ${'上游供应号池(swiftapi 多端点 + 未来并入 token6688 keys):least-latency 自动择优'},
              'least-latency', true, 100)
      ON CONFLICT (name) DO UPDATE SET load_balance_strategy='least-latency', enabled=true, priority=100, updated_at=now()
      RETURNING id`
    const groupId = g[0].id
    await tx`DELETE FROM ai_relay_channel_group_members WHERE group_id=${groupId}`
    for (const kid of keyIds) {
      await tx`INSERT INTO ai_relay_channel_group_members (group_id, key_pool_id, weight) VALUES (${groupId}, ${kid}, 1)`
    }
    console.log(`[4] group ${GROUP_NAME}(${groupId}) members=${keyIds.length}`)

    // 5. 模型上架(is_relay_public=true;同 (config_id, model_id) 幂等)
    let upserted = 0
    for (let i = 0; i < MODELS.length; i++) {
      const m = MODELS[i]
      const r = await tx`SELECT id FROM ai_model_config_models WHERE config_id=${configId} AND model_id=${m}`
      if (r.length > 0) {
        await tx`
          UPDATE ai_model_config_models
          SET enabled=true, is_relay_public=true, relay_price_multiplier=1, relay_sort_order=${200 + i}, updated_at=now()
          WHERE id=${r[0].id}`
      } else {
        await tx`
          INSERT INTO ai_model_config_models (config_id, model_id, display_name, enabled, is_relay_public, relay_price_multiplier, relay_sort_order, supports_streaming)
          VALUES (${configId}, ${m}, ${m}, true, true, 1, ${200 + i}, true)`
      }
      upserted++
    }
    console.log(`[5] models upserted: ${upserted}`)
  })
  console.log('SEED_OK')
} catch (err) {
  console.error('SEED_FAILED:', err.message)
  process.exit(1)
} finally {
  await sql.end()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
