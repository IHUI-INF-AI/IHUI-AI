/**
 * 免费 LLM provider(Pollinations + LLM7,无需 API Key)种子脚本。
 *
 * 功能:
 *   1. 添加免费 provider 到 ai_model_config(upsert)
 *   2. 添加免费 Key 到 ai_relay_key_pool(upsert,加密存储)
 *   3. 添加免费模型到 ai_model_config_models(upsert,is_relay_public=true)
 *   4. 清理重复测试 Key(删除 name 以 -default 结尾且同 provider 已有其他 Key 的记录)
 *   5. 重置所有 degraded Key 为 unknown(等待下次健康巡检)
 *   6. 打印最终号池状态
 *
 * 加密兼容:用 Node.js 内置 crypto 实现 AES-256-GCM,格式与
 *   apps/api/src/utils/crypto.ts 的 encryptJSON 完全兼容
 *   (存储格式 = JSON.stringify({iv, ciphertext, tag}) ),
 *   relay-health-check-service.ts 的 decryptApiKey 可正确解密。
 *
 * 用法:
 *   node scripts/seed-free-key-pool.mjs             # 全量执行(种子 + 清理 + 重置)
 *   node scripts/seed-free-key-pool.mjs --dry-run    # 预览模式,不写 DB
 *   node scripts/seed-free-key-pool.mjs --clean-only # 只清理重复 Key + 重置 degraded
 *   node scripts/seed-free-key-pool.mjs --seed-only  # 只添加免费 provider
 *
 * 幂等可重复执行。
 */
import { createRequire } from 'node:module'
import { createCipheriv, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const postgres = require('postgres')

// ============================================================================
// CLI 参数
// ============================================================================
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const cleanOnly = args.includes('--clean-only')
const seedOnly = args.includes('--seed-only')

if (cleanOnly && seedOnly) {
  console.error('❌ --clean-only 与 --seed-only 互斥,请二选一')
  process.exit(2)
}

// ============================================================================
// 读取 apps/api/.env(DATABASE_URL + CREDENTIALS_ENCRYPTION_KEY)
// ============================================================================
const envPath = resolve('apps/api/.env')
const envContent = readFileSync(envPath, 'utf-8')

function readEnv(key) {
  const m = envContent.match(new RegExp(`^${key}=(.+)$`, 'm'))
  if (!m) throw new Error(`缺少环境变量 ${key}(从 ${envPath} 读取失败)`)
  return m[1].trim()
}

const databaseUrl = readEnv('DATABASE_URL')
const credentialsKey = readEnv('CREDENTIALS_ENCRYPTION_KEY')

const sql = postgres(databaseUrl, { max: 4, prepare: false })

// ============================================================================
// 加密(AES-256-GCM,与 apps/api/src/utils/crypto.ts 的 encryptJSON 兼容)
// ============================================================================
const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32

function getEncKey() {
  if (credentialsKey.length < KEY_LENGTH) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY 必须至少 32 字符')
  }
  return Buffer.from(credentialsKey.slice(0, KEY_LENGTH))
}

/**
 * 加密任意值,返回 { iv, ciphertext, tag }(全 base64)。
 * 与 crypto.ts 的 encryptJSON 行为一致:plaintext = JSON.stringify(data)。
 */
function encryptJSON(data) {
  const key = getEncKey()
  const iv = randomBytes(12) // GCM 推荐 12 字节 IV
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const plaintext = Buffer.from(JSON.stringify(data), 'utf8')
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    tag: tag.toString('base64'),
  }
}

/**
 * 加密明文 apiKey,返回存储格式 JSON 字符串。
 * 存储格式 = JSON.stringify({iv, ciphertext, tag}),
 * decryptApiKey 解密流程:JSON.parse → decryptJSON → JSON.parse('"xxx"') → "xxx"。
 */
function encryptApiKey(plainKey) {
  return JSON.stringify(encryptJSON(plainKey))
}

/** 生成 key_prefix(与 admin/relay-key-pool.ts 的 makeKeyPrefix 一致) */
function makeKeyPrefix(key) {
  if (key.length <= 8) return '***'
  return `${key.slice(0, 4)}***${key.slice(-4)}`
}

// ============================================================================
// 免费 provider 清单(无需 API Key)
// ============================================================================
const FREE_PROVIDERS = [
  {
    provider_code: 'pollinations',
    display_name: 'Pollinations(无 key 免费)',
    base_url: 'https://text.pollinations.ai/openai',
    api_key: 'no-key-required',
    sort_order: 50,
    models: [
      {
        model_id: 'openai-fast',
        display_name: 'OpenAI Fast (Pollinations 免费)',
        context_window: 16384,
        is_relay_public: true,
      },
    ],
  },
  {
    provider_code: 'llm7',
    display_name: 'LLM7(免费镜像)',
    base_url: 'https://api.llm7.io/v1',
    api_key: 'free',
    sort_order: 51,
    models: [
      {
        model_id: 'gpt-4o',
        display_name: 'GPT-4o (LLM7 免费)',
        context_window: 16384,
        is_relay_public: true,
      },
      {
        model_id: 'gpt-4o-mini',
        display_name: 'GPT-4o Mini (LLM7 免费)',
        context_window: 16384,
        is_relay_public: true,
      },
      {
        model_id: 'claude-3.5-sonnet',
        display_name: 'Claude 3.5 Sonnet (LLM7 免费)',
        context_window: 200000,
        is_relay_public: true,
      },
      {
        model_id: 'o1-mini',
        display_name: 'O1 Mini (LLM7 免费)',
        context_window: 128000,
        is_relay_public: true,
      },
    ],
  },
]

// ============================================================================
// 执行(db = sql 或事务 tx;isDryRun = true 时只读不写)
// ============================================================================

async function seedFreeProviders(db, isDryRun) {
  console.log('\n--- 步骤 1-3:添加免费 provider + Key + 模型 ---')
  let addedProviders = 0
  let updatedProviders = 0
  let addedKeys = 0
  let updatedKeys = 0
  let addedModels = 0

  for (const p of FREE_PROVIDERS) {
    // --- 步骤 1:ai_model_config upsert(按 provider_code)---
    // 加密 api_key(与 ai_relay_key_pool 共用同一加密 key,保证 _resolve_from_db 能解密)
    const encKey = encryptApiKey(p.api_key)
    const existing = await db`SELECT id FROM ai_model_config WHERE provider_code = ${p.provider_code}`
    let configId = existing[0]?.id

    if (configId) {
      console.log(`✏️  [更新] provider ${p.provider_code} (${p.display_name})`)
      if (!isDryRun) {
        await db`
          UPDATE ai_model_config
          SET name = ${p.display_name},
              base_url = ${p.base_url},
              api_key_enc = ${encKey},
              enabled = true,
              updated_at = now()
          WHERE provider_code = ${p.provider_code}
        `
      }
      updatedProviders++
    } else {
      console.log(`➕ [新增] provider ${p.provider_code} (${p.display_name}) → ${p.base_url}`)
      if (!isDryRun) {
        const inserted = await db`
          INSERT INTO ai_model_config
            (provider_code, name, base_url, api_key_enc, enabled, sort_order, created_at, updated_at)
          VALUES
            (${p.provider_code}, ${p.display_name}, ${p.base_url}, ${encKey}, true, ${p.sort_order}, now(), now())
          RETURNING id
        `
        configId = inserted[0].id
      }
      addedProviders++
    }

    // --- 步骤 2:ai_relay_key_pool upsert(按 provider_code + name)---
    const keyName = `${p.provider_code}-free`
    const keyPrefix = makeKeyPrefix(p.api_key)
    const extraMeta = JSON.stringify({ free: true, note: 'no api key required' })

    const existingKey =
      await db`SELECT id FROM ai_relay_key_pool WHERE provider_code = ${p.provider_code} AND name = ${keyName}`

    if (existingKey.length > 0) {
      console.log(`✏️  [更新] key pool ${keyName}`)
      if (!isDryRun) {
        await db`
          UPDATE ai_relay_key_pool
          SET api_key_enc = ${encKey},
              key_prefix = ${keyPrefix},
              is_enabled = true,
              health_status = 'unknown',
              last_error_message = ${null},
              extra_metadata = ${extraMeta}::jsonb,
              updated_at = now()
          WHERE provider_code = ${p.provider_code} AND name = ${keyName}
        `
      }
      updatedKeys++
    } else {
      console.log(`➕ [新增] key pool ${keyName} (key_prefix=${keyPrefix})`)
      if (!isDryRun) {
        await db`
          INSERT INTO ai_relay_key_pool
            (provider_code, name, api_key_enc, key_prefix, priority, weight, is_enabled,
             health_status, remark, extra_metadata, created_at, updated_at)
          VALUES
            (${p.provider_code}, ${keyName}, ${encKey}, ${keyPrefix}, 0, 1, true,
             'unknown', ${'免费 provider,无需 API Key'},
             ${extraMeta}::jsonb, now(), now())
        `
      }
      addedKeys++
    }

    // --- 步骤 3:ai_model_config_models upsert(按 config_id + model_id,有 unique 约束)---
    if (!isDryRun && configId) {
      for (const m of p.models) {
        const result = await db`
          INSERT INTO ai_model_config_models
            (config_id, model_id, display_name, context_length, enabled,
             is_relay_public, relay_price_multiplier, relay_sort_order, created_at, updated_at)
          VALUES
            (${configId}, ${m.model_id}, ${m.display_name}, ${m.context_window}, true,
             ${m.is_relay_public}, '1.0000', 0, now(), now())
          ON CONFLICT (config_id, model_id) DO UPDATE
            SET display_name = EXCLUDED.display_name,
                context_length = EXCLUDED.context_length,
                is_relay_public = EXCLUDED.is_relay_public,
                enabled = true,
                updated_at = now()
          RETURNING (xmax = 0) AS inserted
        `
        if (result[0]?.inserted) addedModels++
      }
    } else if (isDryRun) {
      addedModels += p.models.length
    }
    console.log(`  → ${p.models.length} 个模型(${p.models.map((m) => m.model_id).join(', ')})`)
  }

  console.log(
    `\n汇总:provider 新增 ${addedProviders}/更新 ${updatedProviders} | ` +
      `key 新增 ${addedKeys}/更新 ${updatedKeys} | 模型 upsert ${addedModels}`,
  )
}

async function cleanupDuplicateKeys(db, isDryRun) {
  console.log('\n--- 步骤 4:清理重复测试 Key(name 以 -default 结尾) ---')

  // 先查将要删除的记录(供日志)
  const toDelete = await db`
    SELECT id, provider_code, name
    FROM ai_relay_key_pool
    WHERE name LIKE '%-default'
      AND provider_code IN (
        SELECT provider_code
        FROM ai_relay_key_pool
        WHERE name NOT LIKE '%-default'
        GROUP BY provider_code
      )
    ORDER BY provider_code, name
  `

  if (toDelete.length === 0) {
    console.log('✅ 无重复测试 Key 需要清理')
    return
  }

  for (const row of toDelete) {
    console.log(`⚠️  [删除] ${row.provider_code} / ${row.name} (id=${row.id})`)
  }

  if (!isDryRun) {
    const result = await db`
      DELETE FROM ai_relay_key_pool
      WHERE name LIKE '%-default'
        AND provider_code IN (
          SELECT provider_code
          FROM ai_relay_key_pool
          WHERE name NOT LIKE '%-default'
          GROUP BY provider_code
        )
    `
    console.log(`✅ 已删除 ${result.count} 条重复测试 Key`)
  } else {
    console.log(`(dry-run) 将删除 ${toDelete.length} 条`)
  }
}

async function resetDegradedKeys(db, isDryRun) {
  console.log('\n--- 步骤 5:重置所有 degraded/down Key 为 unknown ---')

  const degraded = await db`
    SELECT id, provider_code, name
    FROM ai_relay_key_pool
    WHERE health_status IN ('degraded', 'down')
    ORDER BY provider_code, name
  `

  if (degraded.length === 0) {
    console.log('✅ 无 degraded/down Key 需要重置')
    return
  }

  for (const row of degraded) {
    console.log(`⚠️  [重置] ${row.provider_code} / ${row.name} (id=${row.id}) → unknown`)
  }

  if (!isDryRun) {
    const result = await db`
      UPDATE ai_relay_key_pool
      SET health_status = 'unknown',
          last_error_message = NULL,
          is_enabled = true,
          extra_metadata = jsonb_set(
            COALESCE(extra_metadata, '{}'::jsonb),
            '{consecutiveFailures}',
            '0'::jsonb
          ),
          updated_at = now()
      WHERE health_status IN ('degraded', 'down')
    `
    console.log(`✅ 已重置 ${result.count} 条 degraded/down Key`)
  } else {
    console.log(`(dry-run) 将重置 ${degraded.length} 条`)
  }
}

async function printFinalState() {
  console.log('\n--- 步骤 6:最终号池状态 ---')
  const rows = await sql`
    SELECT provider_code, name, is_enabled, health_status
    FROM ai_relay_key_pool
    ORDER BY provider_code, name
  `
  if (rows.length === 0) {
    console.log('(号池为空)')
    return
  }
  console.log('provider_code        | name                          | enabled | health')
  console.log('---------------------+-------------------------------+---------+--------')
  for (const r of rows) {
    const pc = r.provider_code.padEnd(20)
    const nm = (r.name || '').padEnd(30)
    const en = r.is_enabled ? 'true ' : 'false'
    const hs = r.health_status || ''
    console.log(`${pc} | ${nm} | ${en}    | ${hs}`)
  }
  console.log(`\n共 ${rows.length} 条 Key`)
}

async function main() {
  console.log(`\n========== 免费 provider 种子脚本 ${dryRun ? '(DRY-RUN)' : ''} ==========`)
  if (cleanOnly) console.log('模式:--clean-only(只清理 + 重置)')
  else if (seedOnly) console.log('模式:--seed-only(只添加免费 provider)')
  else console.log('模式:全量(种子 + 清理 + 重置)')

  if (dryRun) {
    // dry-run:只读查询,不写
    if (!cleanOnly) await seedFreeProviders(sql, true)
    if (!seedOnly) {
      await cleanupDuplicateKeys(sql, true)
      await resetDegradedKeys(sql, true)
    }
  } else {
    // 实际执行:所有写操作包在一个事务里
    await sql.begin(async (tx) => {
      if (!cleanOnly) await seedFreeProviders(tx, false)
      if (!seedOnly) {
        await cleanupDuplicateKeys(tx, false)
        await resetDegradedKeys(tx, false)
      }
    })
  }

  await printFinalState()
  console.log('\n========== 完成 ==========\n')
  await sql.end()
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('FATAL:', e?.message || e)
    process.exit(2)
  })
