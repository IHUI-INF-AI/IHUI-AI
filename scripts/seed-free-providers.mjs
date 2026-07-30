/**
 * 免费 provider 专用 seed 脚本(P0-5f,2026-07-30 立)
 *
 * 目的:确保免费 provider 的模型在中转站上架(is_relay_public=true)+ 定价 0
 *      (relay_price_multiplier='0.0000' + input/output_price=0),免费用户可在
 *      /v1/models 看到并调用真实免费模型(零成本引流核心)。
 *
 * 与现有脚本协同:
 *   - seed-all-providers.mjs:批量 seed 28 个主流厂商(enabled=false + is_relay_public=false)
 *   - seed-free-key-pool.mjs:仅 seed 完全无 key 的 pollinations/llm7,含 ai_relay_key_pool 号池
 *   - 本脚本:seed 所有免费 provider(对齐 ai-service free_provider_registry),
 *             把免费模型 is_relay_public=true + relay_price_multiplier='0.0000',
 *             并把 byok_commission_rate='0.0000'(BYOK 用户零成本,平台不抽成)
 *
 * 加密:AES-256-GCM,与 apps/api/src/utils/crypto.ts 的 encryptJSON 完全兼容
 *      (存储格式 = JSON.stringify({iv, ciphertext, tag})),decryptApiKey 可正确解密
 *
 * 用法:
 *   node scripts/seed-free-providers.mjs            # 执行
 *   node scripts/seed-free-providers.mjs --dry-run  # 预览不写 DB
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

// ============================================================================
// 读取 apps/api/.env(DATABASE_URL + CREDENTIALS_ENCRYPTION_KEY)
// 路径推导用 import.meta.url,不硬编码绝对路径(AGENTS.md §15)
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
  const iv = randomBytes(12)
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

// ============================================================================
// 免费 provider 清单(对齐 apps/ai-service/app/services/free_provider_registry.py)
// 占位符 key:无 key provider 用 'no-key-required',需 key provider 用 'sk-placeholder-need-real-key'
// byok_commission_rate='0.0000':BYOK 模式平台零抽成(用户零成本)
// sort_order:50-79 段(免费 provider 专属,与 seed-all-providers.mjs 的 10-46 段区分)
// ============================================================================
const FREE_PROVIDERS = [
  // ===== 国内 provider(需 key,有免费额度) =====
  {
    provider_code: 'zhipu',
    display_name: '智谱 GLM(免费)',
    base_url: 'https://open.bigmodel.cn/api/paas/v4',
    api_key: 'sk-placeholder-need-real-key',
    sort_order: 50,
    models: [
      { model_id: 'glm-4-flash', display_name: 'GLM-4 Flash (智谱永久免费)', context_window: 128000 },
      { model_id: 'glm-4-flashx', display_name: 'GLM-4 FlashX (智谱永久免费)', context_window: 128000 },
    ],
  },
  {
    provider_code: 'moonshot',
    display_name: 'Moonshot Kimi(免费额度)',
    base_url: 'https://api.moonshot.cn/v1',
    api_key: 'sk-placeholder-need-real-key',
    sort_order: 51,
    models: [
      { model_id: 'kimi-k2', display_name: 'Kimi K2 (8B 永久免费)', context_window: 131072 },
      { model_id: 'moonshot-v1-8k', display_name: 'Moonshot v1 8K (15M tokens/月体验)', context_window: 8192 },
    ],
  },
  {
    provider_code: 'qwen',
    display_name: '阿里通义千问(免费额度)',
    base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    api_key: 'sk-placeholder-need-real-key',
    sort_order: 52,
    models: [
      { model_id: 'qwen-turbo', display_name: 'Qwen Turbo (100M tokens 免费)', context_window: 1000000 },
    ],
  },
  {
    provider_code: 'ernie',
    display_name: '百度文心一言(免费层)',
    base_url: 'https://qianfan.baidubce.com/v2',
    api_key: 'sk-placeholder-need-real-key',
    sort_order: 53,
    models: [
      { model_id: 'ernie-speed-8k', display_name: 'ERNIE Speed 8K (永久免费)', context_window: 8192 },
      { model_id: 'ernie-lite-8k', display_name: 'ERNIE Lite 8K (永久免费)', context_window: 8192 },
      { model_id: 'ernie-tiny-8k', display_name: 'ERNIE Tiny 8K (永久免费)', context_window: 8192 },
    ],
  },
  {
    provider_code: 'hunyuan',
    display_name: '腾讯混元(免费层)',
    base_url: 'https://api.hunyuan.cloud.tencent.com/v1',
    api_key: 'sk-placeholder-need-real-key',
    sort_order: 54,
    models: [
      { model_id: 'hunyuan-lite', display_name: 'Hunyuan Lite (永久免费)', context_window: 32768 },
    ],
  },
  {
    provider_code: 'spark',
    display_name: '讯飞星火(免费层)',
    base_url: 'https://spark-api-open.xf-yun.com/v1',
    api_key: 'sk-placeholder-need-real-key',
    sort_order: 55,
    models: [
      { model_id: 'spark-lite', display_name: 'Spark Lite (永久免费)', context_window: 8192 },
    ],
  },
  {
    provider_code: 'siliconcloud',
    display_name: 'SiliconCloud 硅基流动(免费额度)',
    base_url: 'https://api.siliconflow.cn/v1',
    api_key: 'sk-placeholder-need-real-key',
    sort_order: 56,
    models: [
      { model_id: 'Qwen/Qwen2.5-7B-Instruct', display_name: 'Qwen2.5 7B (SiliconCloud 永久免费)', context_window: 32768 },
      { model_id: 'deepseek-ai/DeepSeek-V2-Chat', display_name: 'DeepSeek V2 Chat (SiliconCloud 免费)', context_window: 32768 },
    ],
  },
  {
    provider_code: 'minimax',
    display_name: 'MiniMax(免费额度)',
    base_url: 'https://api.minimax.chat/v1',
    api_key: 'sk-placeholder-need-real-key',
    sort_order: 57,
    models: [
      { model_id: 'abab6.5s-chat', display_name: 'ABAB 6.5s Chat (1M tokens 免费)', context_window: 245760 },
    ],
  },
  {
    provider_code: 'deepseek',
    display_name: 'DeepSeek(体验额度)',
    base_url: 'https://api.deepseek.com/v1',
    api_key: 'sk-placeholder-need-real-key',
    sort_order: 58,
    models: [
      { model_id: 'deepseek-chat', display_name: 'DeepSeek V3 Chat (1元体验额度)', context_window: 65536 },
    ],
  },
  {
    provider_code: 'doubao',
    display_name: '字节豆包(免费体验)',
    base_url: 'https://ark.cn-beijing.volces.com/api/v3',
    api_key: 'sk-placeholder-need-real-key',
    sort_order: 59,
    models: [
      { model_id: 'doubao-pro-32k', display_name: 'Doubao Pro 32K (5M tokens 免费)', context_window: 32000 },
    ],
  },

  // ===== 国际 provider(需 key,有免费额度) =====
  {
    provider_code: 'groq',
    display_name: 'Groq(免费层,极速)',
    base_url: 'https://api.groq.com/openai/v1',
    api_key: 'sk-placeholder-need-real-key',
    sort_order: 60,
    models: [
      { model_id: 'llama-3.3-70b-versatile', display_name: 'Llama 3.3 70B (Groq 免费层)', context_window: 128000 },
      { model_id: 'llama-3.1-8b-instant', display_name: 'Llama 3.1 8B Instant (Groq 免费)', context_window: 128000 },
      { model_id: 'gemma2-9b-it', display_name: 'Gemma 2 9B (Groq 免费)', context_window: 8192 },
    ],
  },
  {
    provider_code: 'mistral',
    display_name: 'Mistral AI(免费层)',
    base_url: 'https://api.mistral.ai/v1',
    api_key: 'sk-placeholder-need-real-key',
    sort_order: 61,
    models: [
      { model_id: 'mistral-large-latest', display_name: 'Mistral Large (500K tokens/周免费)', context_window: 128000 },
      { model_id: 'codestral-latest', display_name: 'Codestral (1M tokens/周免费)', context_window: 256000 },
    ],
  },
  {
    provider_code: 'cohere',
    display_name: 'Cohere(开发者层)',
    base_url: 'https://api.cohere.ai/v1',
    api_key: 'sk-placeholder-need-real-key',
    sort_order: 62,
    models: [
      { model_id: 'command-r', display_name: 'Command R (1000 calls/月免费)', context_window: 128000 },
    ],
  },
  {
    provider_code: 'openrouter',
    display_name: 'OpenRouter(:free 模型)',
    base_url: 'https://openrouter.ai/api/v1',
    api_key: 'sk-placeholder-need-real-key',
    sort_order: 63,
    models: [
      { model_id: 'meta-llama/llama-3.3-70b-instruct:free', display_name: 'Llama 3.3 70B (OpenRouter :free)', context_window: 131072 },
      { model_id: 'google/gemini-flash-1.5:free', display_name: 'Gemini Flash 1.5 (OpenRouter :free)', context_window: 1048576 },
    ],
  },
  {
    provider_code: 'huggingface',
    display_name: 'Hugging Face Inference(免费层)',
    base_url: 'https://api-inference.huggingface.co',
    api_key: 'sk-placeholder-need-real-key',
    sort_order: 64,
    models: [
      { model_id: 'meta-llama/Llama-3.3-70B-Instruct', display_name: 'Llama 3.3 70B (HF 1000 req/天免费)', context_window: 131072 },
      { model_id: 'mistralai/Mistral-7B-Instruct-v0.3', display_name: 'Mistral 7B (HF 免费)', context_window: 32768 },
    ],
  },
  {
    provider_code: 'cloudflare_workers_ai',
    display_name: 'Cloudflare Workers AI(免费层)',
    base_url: 'https://api.cloudflare.com/client/v4/accounts',
    api_key: 'sk-placeholder-need-real-key',
    sort_order: 65,
    models: [
      { model_id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', display_name: 'Llama 3.3 70B (CF 10000 neurons/天)', context_window: 32768 },
      { model_id: '@cf/qwen/qwq-32b', display_name: 'Qwen QwQ 32B (CF 免费)', context_window: 32768 },
    ],
  },
  {
    provider_code: 'github_models',
    display_name: 'GitHub Models(免费层)',
    base_url: 'https://models.inference.ai.azure.com',
    api_key: 'sk-placeholder-need-real-key',
    sort_order: 66,
    models: [
      { model_id: 'gpt-4o', display_name: 'GPT-4o (GitHub Models 150 req/天)', context_window: 128000 },
      { model_id: 'Phi-3.5-mini-instruct', display_name: 'Phi-3.5 Mini (GitHub Models 免费)', context_window: 131072 },
    ],
  },
  {
    provider_code: 'nvidia_nim',
    display_name: 'NVIDIA NIM(免费层)',
    base_url: 'https://integrate.api.nvidia.com/v1',
    api_key: 'sk-placeholder-need-real-key',
    sort_order: 67,
    models: [
      { model_id: 'meta/llama-3.3-70b-instruct', display_name: 'Llama 3.3 70B (NIM 1000 credits)', context_window: 131072 },
      { model_id: 'deepseek-ai/deepseek-r1', display_name: 'DeepSeek R1 (NIM 免费)', context_window: 65536 },
    ],
  },
  {
    provider_code: 'cerebras',
    display_name: 'Cerebras(免费层,最快 RPM)',
    base_url: 'https://api.cerebras.ai/v1',
    api_key: 'sk-placeholder-need-real-key',
    sort_order: 68,
    models: [
      { model_id: 'llama3.1-8b', display_name: 'Llama 3.1 8B (Cerebras 2000 RPM 免费)', context_window: 131072 },
    ],
  },
  {
    provider_code: 'sambanova',
    display_name: 'SambaNova(免费层)',
    base_url: 'https://api.sambanova.ai/v1',
    api_key: 'sk-placeholder-need-real-key',
    sort_order: 69,
    models: [
      { model_id: 'Meta-Llama-3.3-70B-Instruct', display_name: 'Llama 3.3 70B (SambaNova 免费)', context_window: 131072 },
      { model_id: 'DeepSeek-R1', display_name: 'DeepSeek R1 (SambaNova 免费)', context_window: 65536 },
    ],
  },

  // ===== 完全无 key 免费 provider(无需注册,直接可调) =====
  {
    provider_code: 'pollinations',
    display_name: 'Pollinations(无 key 免费)',
    base_url: 'https://text.pollinations.ai/openai',
    api_key: 'no-key-required',
    sort_order: 70,
    models: [
      { model_id: 'openai-fast', display_name: 'OpenAI Fast (Pollinations 永久免费)', context_window: 16384 },
      { model_id: 'gpt-5', display_name: 'GPT-5 (Pollinations 免费)', context_window: 16384 },
      { model_id: 'claude', display_name: 'Claude (Pollinations 免费)', context_window: 16384 },
      { model_id: 'deepseek', display_name: 'DeepSeek (Pollinations 免费)', context_window: 16384 },
    ],
  },
  {
    provider_code: 'llm7',
    display_name: 'LLM7(免费镜像,5M tokens/天)',
    base_url: 'https://api.llm7.io/v1',
    api_key: 'free',
    sort_order: 71,
    models: [
      { model_id: 'gpt-4o', display_name: 'GPT-4o (LLM7 免费)', context_window: 16384 },
      { model_id: 'gpt-4o-mini', display_name: 'GPT-4o Mini (LLM7 免费)', context_window: 16384 },
      { model_id: 'gpt-4.1', display_name: 'GPT-4.1 (LLM7 免费)', context_window: 16384 },
      { model_id: 'gpt-5.6', display_name: 'GPT-5.6 (LLM7 免费)', context_window: 16384 },
      { model_id: 'claude-3.5-sonnet', display_name: 'Claude 3.5 Sonnet (LLM7 免费)', context_window: 200000 },
      { model_id: 'claude-sonnet-4.5', display_name: 'Claude Sonnet 4.5 (LLM7 免费)', context_window: 200000 },
      { model_id: 'o1-mini', display_name: 'O1 Mini (LLM7 免费)', context_window: 128000 },
    ],
  },
  {
    provider_code: 'aihorde',
    display_name: 'AI Horde(众包 GPU,完全免费)',
    base_url: 'https://aihorde.net/api/v2',
    api_key: 'no-key-required',
    sort_order: 72,
    models: [
      { model_id: 'auto', display_name: 'Auto (AI Horde 众包模型,免费)', context_window: 8192 },
    ],
  },
  {
    provider_code: 'opencode_zen',
    display_name: 'OpenCode Zen(无 key 免费编码)',
    base_url: 'https://api.opencode.ai/v1',
    api_key: 'no-key-required',
    sort_order: 73,
    models: [
      { model_id: 'opencode/big-pickle-stealth', display_name: 'Big Pickle Stealth (OpenCode 免费)', context_window: 32768 },
      { model_id: 'opencode/deepseek-v4-flash-free', display_name: 'DeepSeek V4 Flash Free (OpenCode)', context_window: 32768 },
    ],
  },
]

// ============================================================================
// 主流程:对每个免费 provider 做 ai_model_config + ai_model_config_models upsert
// ============================================================================

async function seedFreeProviders(db, isDryRun) {
  console.log(`\n--- seed 免费 provider:${FREE_PROVIDERS.length} 个 ---\n`)
  let addedProviders = 0
  let updatedProviders = 0
  let addedModels = 0
  let updatedModels = 0

  for (const p of FREE_PROVIDERS) {
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
              byok_commission_rate = '0.0000',
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
            (provider_code, name, base_url, api_key_enc, enabled, sort_order,
             byok_commission_rate, created_at, updated_at)
          VALUES
            (${p.provider_code}, ${p.display_name}, ${p.base_url}, ${encKey}, true, ${p.sort_order},
             '0.0000', now(), now())
          RETURNING id
        `
        configId = inserted[0].id
      }
      addedProviders++
    }

    // ai_model_config_models upsert(is_relay_public=true + relay_price_multiplier='0.0000' + 定价 0)
    for (const m of p.models) {
      if (!isDryRun && configId) {
        const result = await db`
          INSERT INTO ai_model_config_models
            (config_id, model_id, display_name, context_length,
             input_price_per_1k, output_price_per_1k, enabled,
             is_relay_public, relay_price_multiplier, relay_sort_order,
             created_at, updated_at)
          VALUES
            (${configId}, ${m.model_id}, ${m.display_name}, ${m.context_window},
             0, 0, true,
             true, '0.0000', 0,
             now(), now())
          ON CONFLICT (config_id, model_id) DO UPDATE
            SET display_name = EXCLUDED.display_name,
                context_length = EXCLUDED.context_length,
                input_price_per_1k = 0,
                output_price_per_1k = 0,
                is_relay_public = true,
                relay_price_multiplier = '0.0000',
                enabled = true,
                updated_at = now()
          RETURNING (xmax = 0) AS inserted
        `
        if (result[0]?.inserted) addedModels++
        else updatedModels++
      } else if (isDryRun) {
        addedModels++
      }
    }
    console.log(`  → ${p.models.length} 个免费模型(is_relay_public=true, 定价 0)`)
  }

  console.log(
    `\n汇总:provider 新增 ${addedProviders}/更新 ${updatedProviders} | ` +
      `模型 新增 ${addedModels}/更新 ${updatedModels}`,
  )
}

async function verifyRelayVisibility() {
  console.log('\n--- 验证:免费模型中转站上架状态 ---')
  const rows = await sql`
    SELECT c.provider_code, m.model_id, m.display_name,
           m.is_relay_public, m.relay_price_multiplier,
           m.input_price_per_1k, m.output_price_per_1k
    FROM ai_model_config_models m
    INNER JOIN ai_model_config c ON c.id = m.config_id
    WHERE c.provider_code = ANY(${sql.array(
      FREE_PROVIDERS.map((p) => p.provider_code),
    )})
    ORDER BY c.provider_code, m.model_id
  `
  if (rows.length === 0) {
    console.log('(无免费模型记录,dry-run 模式下不写 DB)')
    return
  }
  console.log('provider_code          | model_id                              | relay | mult  | in/out')
  console.log('-----------------------+---------------------------------------+-------+-------+-------')
  let listedCount = 0
  let zeroPriceCount = 0
  for (const r of rows) {
    const pc = (r.provider_code || '').padEnd(22)
    const mid = (r.model_id || '').slice(0, 38).padEnd(38)
    const rp = r.is_relay_public ? '✓' : '✗'
    const mult = (r.relay_price_multiplier || '').slice(0, 6)
    const io = `${r.input_price_per_1k}/${r.output_price_per_1k}`
    if (r.is_relay_public) listedCount++
    if (r.input_price_per_1k === 0 && r.output_price_per_1k === 0) zeroPriceCount++
    console.log(`${pc} | ${mid} | ${rp}     | ${mult} | ${io}`)
  }
  console.log(`\n共 ${rows.length} 个免费模型,${listedCount} 个已上架,${zeroPriceCount} 个定价 0`)
}

async function main() {
  console.log(`\n========== 免费 provider 专用 seed 脚本 ${dryRun ? '(DRY-RUN)' : ''} ==========`)
  console.log(`对齐 ai-service free_provider_registry,共 ${FREE_PROVIDERS.length} 个免费 provider`)
  console.log('策略:enabled=true + is_relay_public=true + relay_price_multiplier=0.0000 + byok_commission_rate=0.0000')
  console.log('  (免费模型上架 /v1/models,BYOK 用户零成本,平台零抽成)')

  if (dryRun) {
    await seedFreeProviders(sql, true)
  } else {
    await sql.begin(async (tx) => {
      await seedFreeProviders(tx, false)
    })
  }

  await verifyRelayVisibility()
  console.log('\n========== 完成 ==========')
  console.log('免费用户可在 /v1/models 看到并调用这些免费模型(零成本引流核心)')
  console.log('注意:需 key 的免费 provider,admin 需在后台填入真实 API Key 后才能真正调用')
  console.log('      完全无 key provider(pollinations/llm7/aihorde/opencode_zen)可直接调用\n')
  await sql.end()
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('FATAL:', e?.message || e)
    process.exit(2)
  })
