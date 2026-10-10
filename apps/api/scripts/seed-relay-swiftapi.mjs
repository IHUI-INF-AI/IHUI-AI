// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 中转站上游号池种子脚本(2026-09-13):极速API(x5m5x.com)接入
// - 启用 ai_model_config#31(swiftapi)
// - key 池写 2 条端点条目(new/us-new,extraMetadata.baseUrl 覆盖)
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
  { ep: 'new', url: 'https://new.x5m5x.com/v1', weight: 5, priority: 0 },
  { ep: 'us-new', url: 'https://us-new.x5m5x.com/v1', weight: 4, priority: 1 },
]
// cf-api 有 Cloudflare WAF UA 过滤(服务端 fetch 会 403),不入池;其余 3 把密钥
// (按量/订阅/Auto-Model)由用户在 admin 后台追加为独立 key 条目即可,脚本结构不变。
const MODELS = [
  'deepseek-v4-flash-0731',
  'deepseek-v4-pro-0813',
  'deepseek-v4.1-flash',
  'deepseek-v4-flash-0731:free',
  'deepseek-v3.2',
  'glm-5.1',
  'glm-5.2',
  'glm-5.3',
  'glm-5.3-flash',
  'glm-5.3-flashx',
  'hy4-preview',
  'hy3',
  'hy4',
  'kimi-k3',
  'kimi-k2.7-code',
  'mimo-v2.5',
  'mimo-v2.6-flash',
  'minimax-m3',
  'qwen3.7-max',
  'qwen3.8-max',
  'qwen3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
  'gpt-5.6-luna',
  'gpt-5.6-sol',
  'gpt-5.6-terra',
  'gpt-6-astra',
  'gpt-6-luna',
  'gpt-6-sol',
  'gpt-6.1-sol',
  'gpt-image-2',
  'gpt-image-2.5',
  'grok-4.6',
  'grok-4.7',
]
const GROUP_NAME = 'upstream-pool'

const sql = postgres(DB, { max: 1 })

try {
  await sql.begin(async (tx) => {
    // 1. 启用 swiftapi config(带 /v1 的行是模型上架主体;根路径行仅刷新 base_url)
    const cfg = await tx`
      UPDATE ai_model_config SET enabled=true, model_id_for_test='glm-5.3-flash', updated_at=now(),
        base_url = CASE WHEN base_url LIKE '%/v1' THEN 'https://new.x5m5x.com/v1' ELSE 'https://new.x5m5x.com' END
      WHERE provider_code=${PROVIDER} RETURNING id, name, base_url`
    if (cfg.length === 0) throw new Error('swiftapi config row not found (expected id=31)')
    const cfgRow = cfg.find((c) => c.base_url.endsWith('/v1')) ?? cfg[0]
    const configId = cfgRow.id
    console.log(`[1] config enabled: id=${configId} name=${cfgRow.name} base_url=${cfgRow.base_url}`)

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
                ${`极速API 端点 ${e.ep}(2026-10-08 更换 new api:new/us-new 双端点)`})
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
      const r = await tx`SELECT id FROM ai_model_config_models WHERE config_id=${configId} AND lower(model_id)=lower(${m})`
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

    // 6. 下架不在当前上游列表的遗留模型(避免中转站展示已不存在的模型)
    const currentLower = MODELS.map((m) => m.toLowerCase())
    const retired = await tx`
      UPDATE ai_model_config_models
      SET enabled=false, is_relay_public=false, updated_at=now()
      WHERE config_id=${configId} AND is_relay_public=true
        AND lower(model_id) <> ALL(${currentLower})
      RETURNING model_id`
    if (retired.length > 0) console.log(`[6] retired stale models: ${retired.map((r) => r.model_id).join(', ')}`)

    // 7. 下架根路径 config(订阅/Auto-Model 场景)的全部 relay-public 旧模型:
    //    new api 无 Auto-Model,这批行会以重复 modelId 污染公开目录(2026-10-09)
    const rootIds = await tx`
      SELECT id FROM ai_model_config WHERE provider_code=${PROVIDER} AND base_url NOT LIKE '%/v1'`
    let rootRetired = 0
    for (const rc of rootIds) {
      const r = await tx`
        UPDATE ai_model_config_models
        SET enabled=false, is_relay_public=false, updated_at=now()
        WHERE config_id=${rc.id} AND is_relay_public=true`
      rootRetired += r.count
    }
    if (rootRetired > 0) console.log(`[7] retired root-config relay models: ${rootRetired}`)
  })
  console.log('SEED_OK')
} catch (err) {
  console.error('SEED_FAILED:', err.message)
  process.exit(1)
} finally {
  await sql.end()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
