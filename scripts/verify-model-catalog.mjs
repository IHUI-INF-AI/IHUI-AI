#!/usr/bin/env node
/**
 * 模型分类物理审计(2026-08-29 立)
 *
 * 为什么需要它:模型分类是**长期维护项**——厂商每发一个新代次,`model_catalog.py`
 * 的精选白名单和代次规则就要跟着走。单测只能守住已写死的规则,守不住"线上真实
 * 数据长什么样"。这个脚本真调 8802 `/api/llm/models`,验证:
 *   1. category / model_tier 字段是否 100% 覆盖(漏字段 = 前端整段降级)
 *   2. 默认列表(latest + 对话类)规模是否合理(空 = 用户看不到模型;过大 = 折叠没生效)
 *   3. 已知的老代次模型是否泄漏进默认列表(gpt-4o / claude-3 / deepseek-v3 / glm-4 / llama-3)
 *   4. 非对话专用模型(嵌入/语音/图像)是否被正确下沉
 *
 * 用法(需先启动 api + ai-service:`pwsh -File scripts/start-dev.ps1`):
 *     node scripts/verify-model-catalog.mjs
 *
 * 环境变量:
 *     JWT_SECRET  必填,或从 apps/web/.env.local 解析(不硬编码,避免密钥入库)
 *
 * 退出码:0 = 全部通过;1 = 存在 FAIL(可接入 CI 或 pre-push)
 */

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const API_BASE = process.env.API_BASE || 'http://127.0.0.1:8802'
const ISSUER = 'ihui-ai'
const AUDIENCE = 'ihui-ai-users'

/** 已知的老代次 / 不应出现在"最新最强"里的模型(正则) */
const LEGACY_PATTERNS = [
  /gpt-4o/,
  /gpt-4-turbo/,
  /gpt-3\.5/,
  /claude-3/,
  /claude-opus-4-[1-7]/,
  /deepseek-v3/,
  /deepseek-v2/,
  /glm-4/,
  /kimi-k2/,
  /llama-3(\.|$|-)/,
  /qwen2\.5/,
  /gemma-2/,
]

/** 非对话用途(聊天场景调不通,必须下沉) */
const CONVERSATIONAL = new Set(['chat', 'vision'])

function loadJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET
  try {
    const env = readFileSync(resolve(ROOT, 'apps/web/.env.local'), 'utf8')
    const m = env.match(/^JWT_SECRET=(.+)$/m)
    if (m) return m[1].trim()
  } catch {
    /* 文件不存在时落到下面的报错 */
  }
  throw new Error(
    '未找到 JWT_SECRET。请设置环境变量,或确保 apps/web/.env.local 中存在 JWT_SECRET=...',
  )
}

async function main() {
  const secret = loadJwtSecret()
  // jose 是 workspace 依赖,从仓库根的 pnpm store 解析
  const { SignJWT } = await import(
    `file://${resolve(ROOT, 'node_modules/.pnpm/jose@6.2.9/node_modules/jose/dist/webapi/index.js').replace(/\\/g, '/')}`
  )

  // 取一个真实用户 id(受限模型过滤会查 users 表;拿不到也能跑,只是分类结果略不同)
  let userId = 'verify-model-catalog'
  try {
    const { default: postgres } = await import(
      `file://${resolve(ROOT, 'apps/api/node_modules/postgres/src/index.js').replace(/\\/g, '/')}`
    )
    const sql = postgres(
      process.env.DATABASE_URL || 'postgresql://ihui:ihui_dev_d6412937d5e397bc@127.0.0.1:5432/ihui',
      { max: 1 },
    )
    try {
      const rows = await sql`SELECT id FROM users LIMIT 1`
      if (rows[0]?.id) userId = rows[0].id
    } finally {
      await sql.end()
    }
  } catch {
    console.log('ℹ️  未能连接数据库,使用占位 user id(不影响分类字段校验)')
  }

  const token = await new SignJWT({ phone: '', familyId: '', roleId: 0, type: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(userId))
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(new TextEncoder().encode(secret))

  const res = await fetch(`${API_BASE}/api/llm/models`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    console.error(`❌ 接口返回 HTTP ${res.status}。确认 api(8802)与 ai-service(8803)已启动`)
    process.exit(1)
  }

  const body = await res.json()
  const models = body?.data?.models ?? []
  console.log(`模型总数: ${models.length}`)

  if (models.length === 0) {
    console.error('❌ 接口返回空列表,无法审计')
    process.exit(1)
  }

  const withCat = models.filter((m) => typeof m.category === 'string').length
  const withTier = models.filter((m) => typeof m.model_tier === 'string').length

  const tierCount = {}
  const catCount = {}
  const primary = []
  for (const m of models) {
    const tier = m.model_tier ?? '<none>'
    const cat = m.category ?? '<none>'
    tierCount[tier] = (tierCount[tier] ?? 0) + 1
    catCount[cat] = (catCount[cat] ?? 0) + 1
    if (tier === 'latest' && CONVERSATIONAL.has(cat)) primary.push(m)
  }

  console.log(`\nmodel_tier 分布: ${JSON.stringify(tierCount)}`)
  console.log(`category  分布: ${JSON.stringify(catCount)}`)
  console.log(`\n默认展示(latest + 对话类): ${primary.length} 个`)
  for (const m of primary.slice(0, 15)) {
    console.log(`  [${m.category}] ${String(m.provider).padEnd(24)} ${m.id}`)
  }
  if (primary.length > 15) console.log(`  ... 还有 ${primary.length - 15} 个`)

  // ---------- 断言 ----------
  const fails = []
  const warns = []

  if (withCat !== models.length) {
    fails.push(`category 未全覆盖: ${withCat}/${models.length}`)
  }
  if (withTier !== models.length) {
    fails.push(`model_tier 未全覆盖: ${withTier}/${models.length}`)
  }
  if (primary.length === 0) {
    fails.push('默认列表为空 —— 用户会看到空模型选择器')
  }
  if (primary.length > 150) {
    fails.push(`默认列表过大(${primary.length}),折叠未生效`)
  }

  const leaked = primary.filter((m) => LEGACY_PATTERNS.some((re) => re.test(m.id)))
  if (leaked.length > 0) {
    fails.push(`老代次模型泄漏进默认列表: ${leaked.map((m) => m.id).join(', ')}`)
  }

  const misplaced = models.filter(
    (m) => m.model_tier === 'latest' && !CONVERSATIONAL.has(m.category),
  )
  if (misplaced.length > 0) {
    fails.push(`非对话模型被判为 latest: ${misplaced.map((m) => m.id).join(', ')}`)
  }

  if (primary.length > 0 && primary.length < 3) {
    warns.push(`默认列表仅 ${primary.length} 个,确认 provider 健康状态是否正常`)
  }

  console.log('\n===== 审计结论 =====')
  if (fails.length === 0 && warns.length === 0) {
    console.log('✅ 全部通过')
    return
  }
  for (const w of warns) console.log(`⚠️  ${w}`)
  for (const f of fails) console.log(`❌ ${f}`)
  if (fails.length > 0) process.exitCode = 1
}

main().catch((err) => {
  console.error('❌ 审计脚本异常:', err.message)
  process.exit(1)
})
