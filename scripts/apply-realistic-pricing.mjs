/**
 * 批量为 is_relay_public=true 模型配置真实市场定价 + 中转站加价倍率
 * (P0-5n,2026-07-30 立)
 *
 * 修复问题:calculateCost() 始终返回 0,导致 cost_balance_cents 永不扣减
 *
 * 定价策略(分/千 token,1元=100分):
 *   - premium:  input 5分  / output 15分 (GPT-4o+, Claude Sonnet/Opus, Gemini Pro, o3)
 *   - standard: input 2分  / output 6分  (GPT-4.1, Claude Haiku, 中端模型)
 *   - cheap:    input 1分  / output 2分  (Flash/Mini/Small, DeepSeek, Qwen, Step)
 *   - free:     input 0分  / output 0分  (开源 Lite 版,如 glm-4-flash)
 *
 * 中转站倍率:1.2(原价加价 20% 作为平台利润)
 *
 * 数据写入:
 *   1. ai_model_config_models.input_price_per_1k / output_price_per_1k
 *   2. ai_model_config_models.relay_price_multiplier = '1.2000'
 *   3. ai_pricing 表 upsert(全局定价,calculateCost 优先读此表)
 *
 * 用法:
 *   node scripts/apply-realistic-pricing.mjs            # 执行
 *   node scripts/apply-realistic-pricing.mjs --dry-run  # 预览
 */
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const postgres = require('postgres')

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')

const sql = postgres(process.env.DATABASE_URL || 'postgresql://ihui:ihui_dev_d6412937d5e397bc@127.0.0.1:5432/ihui', { max: 4, prepare: false })

// ============================================================================
// 模型定价分级(基于模型名 pattern 匹配,大小写不敏感)
// 单位:分/千 token(1元 = 100分)
// ============================================================================

const PRICING_RULES = [
  // ===== Premium 档(5/15)=====
  {
    tier: 'premium',
    input: 5,
    output: 15,
    patterns: [
      /^gpt-5/,                  // GPT-5 全系
      /^gpt-4o(?!-mini)/,        // GPT-4o(不含 mini)
      /^gpt-4-turbo/,
      /^gpt-4\.1(?!-)/,          // GPT-4.1(不含 mini/nano)
      /^o[34]-/,                 // o3/o4 reasoning
      /^o[34]-mini/,             // o3-mini 也算 premium
      /^claude-fable/,           // Claude Fable 旗舰
      /^claude-opus/,            // Claude Opus 全系
      /^claude-sonnet/,          // Claude Sonnet 全系(含 latest/5/4/3.7/3.5)
      /^claude-3-7-sonnet/,      // Claude 3.7 Sonnet(兼容旧格式)
      /^claude-3-?5-sonnet/,     // Claude 3.5 Sonnet(兼容旧格式)
      /^gemini-2.*-pro/,
      /^gemini-1\.5-pro/,
      /^gemini-ultra/,
      /^grok-4/,
      /^grok-3/,
      /-large-\d/,
      /-405b/,
      /-671b/,
    ],
  },
  // ===== Standard 档(2/6)=====
  {
    tier: 'standard',
    input: 2,
    output: 6,
    patterns: [
      /^gpt-4o-mini/,
      /^gpt-4\.1-mini/,
      /^gpt-4\.1-nano/,
      /^gpt-4(?!o|\.1|-turbo)/,  // GPT-4(非 4o/4.1/turbo)
      /^gpt-3\.5-turbo/,
      /^claude-sonnet-4-(?!20)/,  // Claude Sonnet 4.x 非首发
      /^claude-3-?5-haiku/,
      /^claude-3-haiku/,
      /^gemini-2.*-flash(?!-lite)/,  // Gemini Flash(非 lite)
      /^gemini-1\.5-flash(?!-lite)/,
      /^gemini-pro(?!-vision)/,
      /^command-r-plus/,
      /^mistral-large/,
      /^mixtral-8x22b/,
      /-70b/,
      /-preview$/,
    ],
  },
  // ===== Cheap 档(1/2)=====
  {
    tier: 'cheap',
    input: 1,
    output: 2,
    patterns: [
      /^gpt-oss/,                // GPT 开源
      /^o1-mini/,
      /^o1-preview/,
      /^claude-3-opus/,          // 老款 opus 降档
      /^claude-instant/,
      /^gemini-.*flash-lite/,
      /^gemini-.*-lite/,
      /^deepseek-/,              // DeepSeek 全系(国产便宜)
      /^qwen-?/,                 // Qwen 全系
      /^qwen[12-]/,
      /^moonshot-/,
      /^kimi-/,
      /^step-/,                  // StepFun 全系
      /^stepfun\//,              // LiteLLM 前缀
      /^glm-4(?!-flash)/,        // GLM-4(非 flash)
      /^glm-3/,
      /^chatglm/,
      /^ernie-/,
      /^spark-/,
      /^hunyuan-/,
      /^yi-/,
      /^baichuan/,
      /^command-r(?!-plus)/,
      /^command-light/,
      /^mistral-(?!large)/,
      /^ministral/,
      /^codestral/,
      /^mixtral-8x7b/,
      /-7b/,
      /-8b/,
      /-13b/,
      /-14b/,
      /-20b/,
      /-34b/,
      /-mini$/,
      /-small$/,
      /-tiny$/,
    ],
  },
  // ===== Free 档(0/0)=====
  {
    tier: 'free',
    input: 0,
    output: 0,
    patterns: [
      /^glm-4-flash/,            // 智谱免费
      /^qwen-.*-free$/,
      /-free$/,
      /:free$/,                  // OpenRouter 免费后缀
      /^ernie-.*lite/,
      /^spark-.*lite/,
      /^hunyuan-.*lite/,
      /^gemma-/,
      /^llama-/,
      /^phi-/,
      /-open/,
    ],
  },
]

/** 根据模型 id 返回定价档位 */
function classifyModel(modelId) {
  const name = modelId.toLowerCase()
  // 去 LiteLLM 自定义前缀 + OpenRouter 路由前缀(~厂商/)+ 厂商前缀
  // 例:
  //   stepfun/step-3.7-flash         → step-3.7-flash
  //   openrouter/deepseek/deepseek-v4 → deepseek/deepseek-v4 → deepseek-v4
  //   ~anthropic/claude-fable-latest  → claude-fable-latest
  //   agnes/gpt-4o                    → gpt-4o
  const stripped = name
    .replace(/^(stepfun|agnes|openrouter|groq|openai|anthropic|mistral|cohere|togetherai|fireworksai|huggingface)\//, '')
    .replace(/^~[^/]+\//, '')        // OpenRouter ~vendor/ 前缀
    .replace(/^[^/]+\//, '')          // 兜底:去剩余 vendor/ 前缀(deepseek/deepseek-v4 → deepseek-v4)
  for (const rule of PRICING_RULES) {
    for (const p of rule.patterns) {
      if (p.test(stripped) || p.test(name)) {
        return rule
      }
    }
  }
  // 默认 cheap 档(未知模型按便宜算,避免误伤)
  return { tier: 'cheap', input: 1, output: 2 }
}

async function main() {
  console.log('========== 模型定价修复脚本 ==========')
  console.log(`模式: ${dryRun ? 'DRY-RUN(预览)' : 'EXECUTE(执行)'}`)
  console.log()

  // 1. 查询所有 is_relay_public=true 的模型
  const models = await sql`
    SELECT m.id, m.config_id, m.model_id, m.display_name,
           m.input_price_per_1k, m.output_price_per_1k,
           m.relay_price_multiplier, m.is_relay_public,
           c.provider_code, c.name AS config_name
    FROM ai_model_config_models m
    INNER JOIN ai_model_config c ON c.id = m.config_id
    WHERE m.is_relay_public = true
    ORDER BY c.provider_code, m.model_id
  `
  console.log(`DB 现有 ${models.length} 个 is_relay_public=true 模型`)

  // 2. 分类 + 统计
  const tierStats = { premium: 0, standard: 0, cheap: 0, free: 0 }
  const updates = []
  for (const m of models) {
    const rule = classifyModel(m.model_id)
    tierStats[rule.tier]++
    updates.push({
      id: m.id,
      modelId: m.model_id,
      provider: m.provider_code,
      tier: rule.tier,
      oldInput: m.input_price_per_1k,
      oldOutput: m.output_price_per_1k,
      newInput: rule.input,
      newOutput: rule.output,
    })
  }

  console.log('\n定价档位分布:')
  console.log(`  Premium  (5/15): ${tierStats.premium} 个`)
  console.log(`  Standard (2/6):  ${tierStats.standard} 个`)
  console.log(`  Cheap    (1/2):  ${tierStats.cheap} 个`)
  console.log(`  Free     (0/0):  ${tierStats.free} 个`)

  // 3. 预览前 10 个变更
  console.log('\n前 10 个变更预览:')
  console.log('  provider | model_id | old(input/output) -> new | tier')
  for (const u of updates.slice(0, 10)) {
    console.log(`  ${u.provider} | ${u.modelId.slice(0, 40).padEnd(40)} | ${u.oldInput}/${u.oldOutput} -> ${u.newInput}/${u.newOutput} | ${u.tier}`)
  }
  if (updates.length > 10) console.log(`  ... +${updates.length - 10} more`)

  if (dryRun) {
    console.log('\n[DRY-RUN] 不写入 DB')
    await sql.end()
    return
  }

  // 4. 批量更新 ai_model_config_models.input_price_per_1k / output_price_per_1k / relay_price_multiplier
  console.log('\n写入 ai_model_config_models.input_price_per_1k / output_price_per_1k / relay_price_multiplier=1.2 ...')
  let updated = 0
  for (const u of updates) {
    await sql`
      UPDATE ai_model_config_models
      SET input_price_per_1k = ${u.newInput},
          output_price_per_1k = ${u.newOutput},
          relay_price_multiplier = '1.2000',
          updated_at = now()
      WHERE id = ${u.id}
    `
    updated++
  }
  console.log(`  → 已更新 ${updated} 行`)

  // 5. upsert ai_pricing 表(calculateCost 优先读此表)
  console.log('\n写入 ai_pricing 表(upsert)...')
  let pricingInserted = 0
  for (const u of updates) {
    // 先查是否已有定价记录
    const existing = await sql`
      SELECT id FROM ai_pricing
      WHERE model_id = ${u.modelId}
        AND (expires_at IS NULL OR expires_at > now())
      ORDER BY effective_at DESC
      LIMIT 1
    `
    if (existing.length > 0) {
      // 更新现有记录
      await sql`
        UPDATE ai_pricing
        SET input_token_price = ${u.newInput},
            output_token_price = ${u.newOutput},
            updated_at = now()
        WHERE id = ${existing[0].id}
      `
    } else {
      // 插入新记录
      await sql`
        INSERT INTO ai_pricing (model_id, input_token_price, output_token_price, currency, effective_at, created_at, updated_at)
        VALUES (${u.modelId}, ${u.newInput}, ${u.newOutput}, 'CNY', now(), now(), now())
      `
    }
    pricingInserted++
  }
  console.log(`  → 已 upsert ${pricingInserted} 行`)

  // 6. 验证:重新查询确认
  const verify = await sql`
    SELECT COUNT(*) AS total,
           COUNT(*) FILTER (WHERE input_price_per_1k > 0 OR output_price_per_1k > 0) AS has_price,
           COUNT(*) FILTER (WHERE input_price_per_1k = 0 AND output_price_per_1k = 0) AS zero_price
    FROM ai_model_config_models
    WHERE is_relay_public = true
  `
  console.log('\n========== 验证 ==========')
  console.log(`总模型数: ${verify[0].total}`)
  console.log(`有定价(>0): ${verify[0].has_price}`)
  console.log(`零定价(0): ${verify[0].zero_price} (开源/免费模型)`)

  console.log('\n========== 完成 ==========')
  console.log('calculateCost 现在会返回非零 cost,totalCostCents 将扣减 costBalanceCents')
  console.log('中转站倍率 1.2:用户付 1.2× 原价,平台利润 20%')

  await sql.end()
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('FATAL:', e?.message || e)
    process.exit(2)
  })
