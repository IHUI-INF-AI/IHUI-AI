/**
 * 中转站免费模型上架完整性验证脚本(P0-5f,2026-07-30 立)
 *
 * 目的:交叉比对 ai-service free_provider_registry 中标记的免费 provider 模型
 *      与 DB ai_model_config_models 表的 is_relay_public=true 记录,
 *      报告"应上架但未上架"的免费模型,确保免费用户在 /v1/models 能看到所有免费模型。
 *
 * 验证逻辑:
 *   1. 定义期望清单(EXPECTED_FREE_MODELS,对齐 seed-free-providers.mjs + free_provider_registry)
 *   2. 从 DB 查 ai_model_config_models WHERE is_relay_public=true
 *   3. 交叉比对:哪些期望的免费模型未上架 / 定价非 0
 *   4. 输出表格 + 缺失清单
 *   5. 退出码:0=全上架且定价 0 / 1=有缺失或定价异常
 *
 * 用法:
 *   node scripts/verify-relay-free-models.mjs            # 验证(查 DB)
 *   node scripts/verify-relay-free-models.mjs --dry-run  # 预览期望清单(不查 DB)
 *
 * 路径推导用 import.meta.url,不硬编码绝对路径(AGENTS.md §15)。
 */
import { createRequire } from 'node:module'
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
// 期望清单:免费 provider 应上架的模型(对齐 seed-free-providers.mjs + free_provider_registry)
// 每个模型应满足:is_relay_public=true + relay_price_multiplier='0.0000' + input/output_price=0
// ============================================================================
const EXPECTED_FREE_MODELS = [
  // ===== 国内 provider(需 key,有免费额度) =====
  { provider_code: 'zhipu', model_id: 'glm-4-flash', display_name: 'GLM-4 Flash (智谱永久免费)' },
  { provider_code: 'zhipu', model_id: 'glm-4-flashx', display_name: 'GLM-4 FlashX (智谱永久免费)' },
  { provider_code: 'moonshot', model_id: 'kimi-k2', display_name: 'Kimi K2 (8B 永久免费)' },
  { provider_code: 'moonshot', model_id: 'moonshot-v1-8k', display_name: 'Moonshot v1 8K (15M tokens/月体验)' },
  { provider_code: 'qwen', model_id: 'qwen-turbo', display_name: 'Qwen Turbo (100M tokens 免费)' },
  { provider_code: 'ernie', model_id: 'ernie-speed-8k', display_name: 'ERNIE Speed 8K (永久免费)' },
  { provider_code: 'ernie', model_id: 'ernie-lite-8k', display_name: 'ERNIE Lite 8K (永久免费)' },
  { provider_code: 'ernie', model_id: 'ernie-tiny-8k', display_name: 'ERNIE Tiny 8K (永久免费)' },
  { provider_code: 'hunyuan', model_id: 'hunyuan-lite', display_name: 'Hunyuan Lite (永久免费)' },
  { provider_code: 'spark', model_id: 'spark-lite', display_name: 'Spark Lite (永久免费)' },
  { provider_code: 'siliconcloud', model_id: 'Qwen/Qwen2.5-7B-Instruct', display_name: 'Qwen2.5 7B (SiliconCloud 永久免费)' },
  { provider_code: 'siliconcloud', model_id: 'deepseek-ai/DeepSeek-V2-Chat', display_name: 'DeepSeek V2 Chat (SiliconCloud 免费)' },
  { provider_code: 'minimax', model_id: 'abab6.5s-chat', display_name: 'ABAB 6.5s Chat (1M tokens 免费)' },
  { provider_code: 'deepseek', model_id: 'deepseek-chat', display_name: 'DeepSeek V3 Chat (1元体验额度)' },
  { provider_code: 'doubao', model_id: 'doubao-pro-32k', display_name: 'Doubao Pro 32K (5M tokens 免费)' },

  // ===== 国际 provider(需 key,有免费额度) =====
  { provider_code: 'groq', model_id: 'llama-3.3-70b-versatile', display_name: 'Llama 3.3 70B (Groq 免费层)' },
  { provider_code: 'groq', model_id: 'llama-3.1-8b-instant', display_name: 'Llama 3.1 8B Instant (Groq 免费)' },
  { provider_code: 'groq', model_id: 'gemma2-9b-it', display_name: 'Gemma 2 9B (Groq 免费)' },
  { provider_code: 'mistral', model_id: 'mistral-large-latest', display_name: 'Mistral Large (500K tokens/周免费)' },
  { provider_code: 'mistral', model_id: 'codestral-latest', display_name: 'Codestral (1M tokens/周免费)' },
  { provider_code: 'cohere', model_id: 'command-r', display_name: 'Command R (1000 calls/月免费)' },
  { provider_code: 'openrouter', model_id: 'meta-llama/llama-3.3-70b-instruct:free', display_name: 'Llama 3.3 70B (OpenRouter :free)' },
  { provider_code: 'openrouter', model_id: 'google/gemini-flash-1.5:free', display_name: 'Gemini Flash 1.5 (OpenRouter :free)' },
  { provider_code: 'huggingface', model_id: 'meta-llama/Llama-3.3-70B-Instruct', display_name: 'Llama 3.3 70B (HF 1000 req/天免费)' },
  { provider_code: 'huggingface', model_id: 'mistralai/Mistral-7B-Instruct-v0.3', display_name: 'Mistral 7B (HF 免费)' },
  { provider_code: 'cloudflare_workers_ai', model_id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', display_name: 'Llama 3.3 70B (CF 10000 neurons/天)' },
  { provider_code: 'cloudflare_workers_ai', model_id: '@cf/qwen/qwq-32b', display_name: 'Qwen QwQ 32B (CF 免费)' },
  { provider_code: 'github_models', model_id: 'gpt-4o', display_name: 'GPT-4o (GitHub Models 150 req/天)' },
  { provider_code: 'github_models', model_id: 'Phi-3.5-mini-instruct', display_name: 'Phi-3.5 Mini (GitHub Models 免费)' },
  { provider_code: 'nvidia_nim', model_id: 'meta/llama-3.3-70b-instruct', display_name: 'Llama 3.3 70B (NIM 1000 credits)' },
  { provider_code: 'nvidia_nim', model_id: 'deepseek-ai/deepseek-r1', display_name: 'DeepSeek R1 (NIM 免费)' },
  { provider_code: 'cerebras', model_id: 'llama3.1-8b', display_name: 'Llama 3.1 8B (Cerebras 2000 RPM 免费)' },
  { provider_code: 'sambanova', model_id: 'Meta-Llama-3.3-70B-Instruct', display_name: 'Llama 3.3 70B (SambaNova 免费)' },
  { provider_code: 'sambanova', model_id: 'DeepSeek-R1', display_name: 'DeepSeek R1 (SambaNova 免费)' },

  // ===== 完全无 key 免费 provider(无需注册,直接可调) =====
  { provider_code: 'pollinations', model_id: 'openai-fast', display_name: 'OpenAI Fast (Pollinations 永久免费)' },
  { provider_code: 'pollinations', model_id: 'gpt-5', display_name: 'GPT-5 (Pollinations 免费)' },
  { provider_code: 'pollinations', model_id: 'claude', display_name: 'Claude (Pollinations 免费)' },
  { provider_code: 'pollinations', model_id: 'deepseek', display_name: 'DeepSeek (Pollinations 免费)' },
  { provider_code: 'llm7', model_id: 'gpt-4o', display_name: 'GPT-4o (LLM7 免费)' },
  { provider_code: 'llm7', model_id: 'gpt-4o-mini', display_name: 'GPT-4o Mini (LLM7 免费)' },
  { provider_code: 'llm7', model_id: 'gpt-4.1', display_name: 'GPT-4.1 (LLM7 免费)' },
  { provider_code: 'llm7', model_id: 'gpt-5.6', display_name: 'GPT-5.6 (LLM7 免费)' },
  { provider_code: 'llm7', model_id: 'claude-3.5-sonnet', display_name: 'Claude 3.5 Sonnet (LLM7 免费)' },
  { provider_code: 'llm7', model_id: 'claude-sonnet-4.5', display_name: 'Claude Sonnet 4.5 (LLM7 免费)' },
  { provider_code: 'llm7', model_id: 'o1-mini', display_name: 'O1 Mini (LLM7 免费)' },
  { provider_code: 'aihorde', model_id: 'auto', display_name: 'Auto (AI Horde 众包模型,免费)' },
  { provider_code: 'opencode_zen', model_id: 'opencode/big-pickle-stealth', display_name: 'Big Pickle Stealth (OpenCode 免费)' },
  { provider_code: 'opencode_zen', model_id: 'opencode/deepseek-v4-flash-free', display_name: 'DeepSeek V4 Flash Free (OpenCode)' },
]

// ============================================================================
// 主流程
// ============================================================================

async function main() {
  console.log(`\n========== 中转站免费模型上架完整性验证 ${dryRun ? '(DRY-RUN)' : ''} ==========`)
  console.log(`期望清单:${EXPECTED_FREE_MODELS.length} 个免费模型,来自 ${new Set(EXPECTED_FREE_MODELS.map((m) => m.provider_code)).size} 个免费 provider`)
  console.log('对齐:ai-service free_provider_registry + seed-free-providers.mjs\n')

  // 1. 打印期望清单(按 provider 分组)
  console.log('--- 期望清单(应上架的免费模型) ---')
  const byProvider = new Map()
  for (const m of EXPECTED_FREE_MODELS) {
    if (!byProvider.has(m.provider_code)) byProvider.set(m.provider_code, [])
    byProvider.get(m.provider_code).push(m)
  }
  for (const [pc, models] of byProvider) {
    console.log(`  ${pc.padEnd(22)} ${models.length} 个模型`)
  }
  console.log(`  合计 ${EXPECTED_FREE_MODELS.length} 个免费模型应上架\n`)

  if (dryRun) {
    console.log('[DRY-RUN] 不查 DB,仅打印期望清单')
    console.log('========== 完成 ==========\n')
    return
  }

  // 2. 读 apps/api/.env 获取 DATABASE_URL
  const envPath = resolve('apps/api/.env')
  const envContent = readFileSync(envPath, 'utf-8')
  const m = envContent.match(/^DATABASE_URL=(.+)$/m)
  if (!m) throw new Error(`缺少 DATABASE_URL(从 ${envPath} 读取失败)`)
  const databaseUrl = m[1].trim()

  const sql = postgres(databaseUrl, { max: 4, prepare: false })

  // 3. 查 DB:所有免费 provider 的模型记录(含 is_relay_public + 定价)
  console.log('--- 查 DB:免费 provider 模型上架状态 ---')
  const providerCodes = [...new Set(EXPECTED_FREE_MODELS.map((m) => m.provider_code))]
  // PostgreSQL 数组字面量 {a,b,c} + ::text[] cast。
  // 用 postgres-js 的 sql.array() 在 prepare:false 模式下序列化不稳定(报"有缺陷的数组常量"),
  // 改用字符串参数 + cast,参数化无注入风险(provider_code 均为内部固定标识符)。
  const arrLiteral = `{${providerCodes.join(',')}}`
  const rows = await sql`
    SELECT c.provider_code, m.model_id, m.display_name,
           m.is_relay_public, m.relay_price_multiplier,
           m.input_price_per_1k, m.output_price_per_1k,
           c.enabled AS config_enabled
    FROM ai_model_config_models m
    INNER JOIN ai_model_config c ON c.id = m.config_id
    WHERE c.provider_code = ANY(${arrLiteral}::text[])
    ORDER BY c.provider_code, m.model_id
  `
  console.log(`DB 查询到 ${rows.length} 条记录(覆盖 ${providerCodes.length} 个免费 provider)\n`)

  // 4. 交叉比对
  const dbMap = new Map()
  for (const r of rows) {
    dbMap.set(`${r.provider_code}::${r.model_id}`, r)
  }

  const missing = [] // 应上架但未上架
  const wrongPrice = [] // 已上架但定价非 0
  const notEnabled = [] // provider enabled=false
  const okList = [] // 完全合规

  for (const expected of EXPECTED_FREE_MODELS) {
    const key = `${expected.provider_code}::${expected.model_id}`
    const actual = dbMap.get(key)
    if (!actual) {
      missing.push(expected)
      continue
    }
    if (!actual.config_enabled) {
      notEnabled.push({ ...expected, actual })
      continue
    }
    if (!actual.is_relay_public) {
      missing.push({ ...expected, reason: 'is_relay_public=false' })
      continue
    }
    const multOk = !actual.relay_price_multiplier || actual.relay_price_multiplier === '0.0000'
    const priceOk = (actual.input_price_per_1k ?? 0) === 0 && (actual.output_price_per_1k ?? 0) === 0
    if (!multOk || !priceOk) {
      wrongPrice.push({ ...expected, actual })
      continue
    }
    okList.push({ ...expected, actual })
  }

  // 5. 输出表格
  console.log('--- 上架状态表 ---')
  console.log('provider_code          | model_id                              | relay | mult  | in/out | 状态')
  console.log('-----------------------+---------------------------------------+-------+-------+--------+------')
  for (const expected of EXPECTED_FREE_MODELS) {
    const key = `${expected.provider_code}::${expected.model_id}`
    const actual = dbMap.get(key)
    const pc = expected.provider_code.padEnd(22)
    const mid = expected.model_id.slice(0, 38).padEnd(38)
    if (!actual) {
      console.log(`${pc} | ${mid} | -     | -     | -/-    | ❌ 缺失`)
      continue
    }
    const rp = actual.is_relay_public ? '✓' : '✗'
    const mult = (actual.relay_price_multiplier || '').slice(0, 6)
    const io = `${actual.input_price_per_1k}/${actual.output_price_per_1k}`
    let status = '✅ OK'
    if (!actual.config_enabled) status = '⚠️  provider disabled'
    else if (!actual.is_relay_public) status = '❌ 未上架'
    else if (mult !== '0.0000' || io !== '0/0') status = '⚠️  定价非 0'
    console.log(`${pc} | ${mid} | ${rp}     | ${mult} | ${io.padEnd(6)} | ${status}`)
  }

  // 6. 汇总报告
  console.log('\n--- 汇总报告 ---')
  console.log(`期望总数:  ${EXPECTED_FREE_MODELS.length}`)
  console.log(`✅ 合规:    ${okList.length}(已上架 + 定价 0 + provider enabled)`)
  console.log(`❌ 缺失:    ${missing.length}(应上架但未上架或 is_relay_public=false)`)
  console.log(`⚠️  定价异常:${wrongPrice.length}(已上架但定价非 0)`)
  console.log(`⚠️  禁用:    ${notEnabled.length}(provider enabled=false)`)

  if (missing.length > 0) {
    console.log('\n--- ❌ 应上架但未上架的免费模型 ---')
    for (const m of missing) {
      const reason = m.reason ? ` (${m.reason})` : ''
      console.log(`  ${m.provider_code} / ${m.model_id} — ${m.display_name}${reason}`)
    }
  }

  if (wrongPrice.length > 0) {
    console.log('\n--- ⚠️  已上架但定价非 0 的免费模型(应改为 0/0) ---')
    for (const m of wrongPrice) {
      console.log(`  ${m.provider_code} / ${m.model_id} — 当前 mult=${m.actual.relay_price_multiplier} in/out=${m.actual.input_price_per_1k}/${m.actual.output_price_per_1k}`)
    }
  }

  if (notEnabled.length > 0) {
    console.log('\n--- ⚠️  provider enabled=false(需 admin 启用) ---')
    for (const m of notEnabled) {
      console.log(`  ${m.provider_code} / ${m.model_id}`)
    }
  }

  // 7. 退出码:0=全合规 / 1=有缺失或异常
  const hasIssue = missing.length > 0 || wrongPrice.length > 0 || notEnabled.length > 0
  console.log(`\n========== 验证结果:${hasIssue ? '❌ 有问题(退出码 1)' : '✅ 全合规(退出码 0)'} ==========`)
  if (hasIssue) {
    console.log('修复建议:')
    console.log('  1. 跑 `node scripts/seed-free-providers.mjs` 重新 seed 缺失/未上架的免费模型')
    console.log('  2. 跑 `node scripts/apply-realistic-pricing.mjs` 修复定价(注意 free 档规则)')
    console.log('  3. admin 后台启用 disabled 的 provider + 填入真实 API Key')
  } else {
    console.log('所有免费模型已上架 /v1/models 且定价 0,免费用户零成本可调用')
  }
  console.log('')

  await sql.end()
  process.exit(hasIssue ? 1 : 0)
}

main().catch((e) => {
  console.error('FATAL:', e?.message || e)
  process.exit(2)
})
