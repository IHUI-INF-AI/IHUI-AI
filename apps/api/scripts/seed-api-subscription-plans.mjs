// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * API 订阅套餐种子(2026-10-09,开卖定向)。
 *
 * 三档定价的唯一目标:任何用户在套餐白名单内任意烧完配额,平台毛利仍 > 0。
 * 毛利护栏 = 最差情形成本(配额全部打成白名单内"输出单价最高的模型")×(1+溢价) < 售价。
 * 售价 = 上游成本 × 1.2(与 ai_model_config_models.relayPriceMultiplier 一致)。
 * 白名单同时写入 Key.allowedModels(激活时),鉴权层强制,不是目录装饰。
 *
 * 幂等:按 name upsert(重复执行更新价格/白名单,不产生重复行)。
 * 用法:node scripts/seed-api-subscription-plans.mjs(在 apps/api 目录下运行,读同目录 .env)
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { default: postgres } = require(
  process.env.POSTGRES_JS_PATH || '../../../packages/database/node_modules/postgres/src/index.js',
)

const envText = readFileSync(new URL('../.env', import.meta.url), 'utf8')
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)
if (!env.DATABASE_URL) throw new Error('DATABASE_URL missing')
const sql = postgres(env.DATABASE_URL, { max: 1 })

// 白名单分层(成本口径,分/千 token;售价 = ×1.2)
const POOL_VALUE = [
  'glm-5.3', 'glm-5.2', 'glm-5.1', 'glm-5.3-flash', 'glm-5.3-flashx',
  'deepseek-v4.1-flash', 'deepseek-v4-flash-0731', 'deepseek-v4-pro-0813',
  'mimo-v2.5', 'mimo-v2.6-flash', 'hy3', 'hy4', 'hy4-preview',
  'MiniMax-M3', 'kimi-k2.7-code',
] // 最差输出:glm-5.3/5.2/5.1 = 0.14 分/千(售价 0.168,1.68 元/M)
const POOL_MID = [
  ...POOL_VALUE,
  'qwen3.7-max', 'qwen3.8-max', // 最差输出 3.75×1.2 = 4.5 元/M
] // 不含 qwen3.8-flash / deepseek-v3.2(9 元/M)与 kimi-k3(6 元/M)
const POOL_MAX = [
  ...POOL_MID,
  'kimi-k3', // 6 元/M
  'deepseek-v3.2', 'qwen3.8-flash', // 9 元/M
  'gpt-6-astra', 'gpt-6-luna', 'gpt-6-sol', 'gpt-6.1-sol', // 最差输出 36 元/M
] // 不含 gpt-5.6 族(108 元/M)、gemini-3.x(72-90 元/M)、grok(22.5 元/M)、gpt-image

const PLANS = [
  {
    name: 'API Starter',
    price: 990, // ¥9.9
    originalPrice: 1990,
    quota: 2_000_000, // 2M tokens
    daily: 500_000,
    whitelist: POOL_VALUE,
    // 最差 2M × 1.68 = 3.36 元 vs ¥9.9 → 毛利 66%(全打最贵模型)/ 混合 ≥90%
    features: [
      '2000000 tokens/month',
      '每日 500K tokens 高峰保护',
      'GLM-5.3 / DeepSeek-V4.1 / MiMo / MiniMax 等 15 个普惠模型',
      '[OI] 兼容接口,sk_ 密钥即开即用',
    ],
    description: '入门档:自研普惠模型池,适合个人开发与轻量调用',
    sortOrder: 10,
  },
  {
    name: 'API Pro',
    price: 9900, // ¥99
    originalPrice: 19900,
    quota: 15_000_000, // 15M
    daily: 1_500_000,
    whitelist: POOL_MID,
    // 最差 15M × 4.5 = 67.5 元 vs ¥99 → 毛利 32% / 混合 ≥85%
    features: [
      '15000000 tokens/month',
      '每日 1.5M tokens 高峰保护',
      '普惠池 + Qwen3.8-Max / Qwen3.7-Max(20 个模型)',
      '优先渠道路由与失败自动切换',
    ],
    description: '进阶段:加强 Qwen 旗舰,适合高频 agent / 批量任务',
    sortOrder: 20,
  },
  {
    name: 'API Max',
    price: 29900, // ¥299
    originalPrice: 59900,
    quota: 6_000_000, // 6M
    daily: 600_000,
    whitelist: POOL_MAX,
    // 最差 6M × 36 = 216 元 vs ¥299 → 毛利 28% / 混合 ≥55%
    features: [
      '6000000 tokens/month',
      '每日 600K tokens 高峰保护',
      '全部 24 个模型,含 GPT-6 全系 / Qwen3.8-Flash / Kimi-K3',
      '优先渠道路由 + 失败自动切换 + 专属限流档',
    ],
    description: '旗舰档:GPT-6 全系开放,适合生产环境与重度用户',
    sortOrder: 30,
  },
]

try {
  for (const p of PLANS) {
    const r = await sql`
      INSERT INTO plans (name, description, price, interval, features, is_active, sort_order,
        billing_period, trial_days, is_recurring, daily_token_limit, weekly_token_limit,
        monthly_token_limit, validity_days, original_price, model_whitelist, is_for_sale)
      VALUES (${p.name}, ${p.description}, ${p.price}, 'month', ${sql.json(p.features)}, true,
        ${p.sortOrder}, 'month', 0, false, ${p.daily}, 0, ${p.quota}, 30, ${p.originalPrice},
        ${sql.json(p.whitelist)}, true)
      ON CONFLICT (name) DO UPDATE SET
        description = EXCLUDED.description,
        price = EXCLUDED.price,
        features = EXCLUDED.features,
        is_active = true,
        sort_order = EXCLUDED.sort_order,
        billing_period = 'month',
        daily_token_limit = EXCLUDED.daily_token_limit,
        weekly_token_limit = 0,
        monthly_token_limit = EXCLUDED.monthly_token_limit,
        validity_days = 30,
        original_price = EXCLUDED.original_price,
        model_whitelist = EXCLUDED.model_whitelist,
        is_for_sale = true,
        updated_at = now()
      RETURNING id, name, price`
    console.log(`seeded: ${r[0].name} price=${r[0].price}分 whitelist=${p.whitelist.length}个`)
  }
  console.log('SEED_OK')
} catch (err) {
  console.error('SEED_FAILED:', err.message)
  process.exitCode = 1
} finally {
  await sql.end()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
