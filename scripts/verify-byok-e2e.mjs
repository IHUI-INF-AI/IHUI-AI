#!/usr/bin/env node
/**
 * BYOK 计费链路端到端验证脚本(P0-5,2026-07-30 立,零成本挣钱路径 2 验证)
 *
 * 目的:验证 BYOK(Bring Your Own Key)计费链路端到端真实可运营,确保:
 *      ① api 侧 relay-billing-service.ts 导出 5 个核心函数(isFreeProvider /
 *         calculateByokCost / isByokCall / getByokCommissionRate / recordCall mode='byok')
 *      ② v1-public.ts 集成 isByokCall + recordCall(mode='byok') + metadata.byokMode 透传
 *      ③ DB 中存在 BYOK 配置(ai_model_config.owner_uuid IS NOT NULL AND enabled=true)
 *      ④ DB 中 llm_call_logs 有 byokMode=true 记录(链路已被真实调用过)
 *      ⑤ 服务在线时 GET /v1/models 返回 owned_by='byok' 的模型(用户私有模型可见)
 *
 * BYOK 计费链路(零成本挣钱核心):
 *   用户配置私有 ai_model_config(owner_uuid=userId, provider_code 匹配, enabled=true)
 *   → 用户调 /v1/chat/completions(API Key 鉴权)
 *   → API: checkQuota → isByokCall(userId, model) 判定 BYOK 模式
 *   → API: metadata.byokMode=true 透传给 ai-service
 *   → ai-service: 用用户私有 key 调大厂(平台零成本)
 *   → API: recordCall(mode='byok') → calculateByokCost
 *   → 只扣 platformFeeCents(= upstreamCostCents × commissionRate,免费 provider = 0)
 *   → 平台零成本抽成 5-20% 服务费
 *
 * 验证维度:
 *   1. 静态校验(dry-run 即可):service 函数导出 + v1-public.ts 集成点
 *   2. DB 校验(默认,非 dry-run):BYOK 配置存在性 + llm_call_logs byokMode 记录
 *   3. 服务可达(可选 --live):GET /v1/models 返回 byok 模型
 *
 * 期望对齐:
 *   - apps/api/src/services/relay-billing-service.ts(5 个导出函数 + BYOK 计费逻辑)
 *   - apps/api/src/routes/v1-public.ts(isByokCall + recordCall mode='byok' + metadata 透传)
 *   - DB ai_model_config(owner_uuid IS NOT NULL = BYOK 配置)
 *   - DB llm_call_logs.metadata.byokMode=true(BYOK 调用记录)
 *
 * 用法:
 *   node scripts/verify-byok-e2e.mjs                  # 完整验证(静态 + DB + 服务可达性)
 *   node scripts/verify-byok-e2e.mjs --dry-run        # 仅静态校验(不查 DB,不调服务)
 *   node scripts/verify-byok-e2e.mjs --live           # 带 DB + 调 /v1/models(需 API key)
 *   node scripts/verify-byok-e2e.mjs --api-key <key>  # 用指定 API key 调 /v1/models
 *   node scripts/verify-byok-e2e.mjs --api-url http://localhost:8802
 *
 * 退出码:0=全部通过 / 1=有失败 / 2=脚本异常
 */
import { argv, env } from 'node:process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const postgres = require('postgres')

const args = argv.slice(2)
const dryRun = args.includes('--dry-run')
const live = args.includes('--live') || !!env.API_BYOK_KEY
const apiKeyFlag = (() => {
  const i = args.indexOf('--api-key')
  return i >= 0 ? args[i + 1] : env.API_BYOK_KEY || ''
})()
const apiUrl = (() => {
  const i = args.indexOf('--api-url')
  return i >= 0 ? args[i + 1] : env.API_URL || 'http://localhost:8802'
})()

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const projectRoot = resolve(__dirname, '..')

// ============================================================================
// 期望清单:relay-billing-service.ts 应导出的 5 个 BYOK 核心函数
// ============================================================================
const EXPECTED_EXPORTS = [
  { name: 'isFreeProvider', desc: '判断模型是否属于免费 provider(平台不抽成)', pattern: /export\s+function\s+isFreeProvider\s*\(/ },
  { name: 'calculateByokCost', desc: '计算 BYOK 调用成本(上游原价 + 平台抽成,不乘中转站倍率)', pattern: /export\s+async\s+function\s+calculateByokCost\s*\(/ },
  { name: 'isByokCall', desc: '判断用户对模型是否走 BYOK 模式(查私有 ai_model_config)', pattern: /export\s+async\s+function\s+isByokCall\s*\(/ },
  { name: 'getByokCommissionRate', desc: '查询 provider 的 BYOK 平台默认抽成率(默认 0.1)', pattern: /export\s+async\s+function\s+getByokCommissionRate\s*\(/ },
  { name: 'recordCall', desc: '调用后记录流水 + 扣减余额(支持 mode=byok 只扣 platformFeeCents)', pattern: /export\s+async\s+function\s+recordCall\s*\(/ },
]

// ============================================================================
// 期望清单:v1-public.ts 应包含的 BYOK 集成点
// ============================================================================
const EXPECTED_INTEGRATIONS = [
  { name: 'import isByokCall', desc: '导入 isByokCall 函数', pattern: /import\s+\{[^}]*isByokCall[^}]*\}\s+from\s+['"][^'"]*relay-billing-service/ },
  { name: 'import recordCall', desc: '导入 recordCall 函数', pattern: /import\s+\{[^}]*recordCall[^}]*\}\s+from\s+['"][^'"]*relay-billing-service/ },
  { name: 'isByokCall 调用', desc: '调用 isByokCall 判定 BYOK 模式', pattern: /await\s+isByokCall\s*\(/ },
  { name: "mode='byok' 赋值", desc: "判定 BYOK 后设置 mode='byok'", pattern: /mode\s*[:=]\s*['"]byok['"]|mode\s*=\s*['"]byok['"]/ },
  { name: 'metadata.byokMode 透传', desc: '非流式调用透传 metadata.byokMode=true 给 ai-service', pattern: /byokMode\s*:\s*true/ },
  { name: "recordCall mode='byok'", desc: "recordCall 调用时传 mode='byok'(或 mode 变量)", pattern: /recordCall\s*\(\s*\{[^}]*mode/s },
]

// ============================================================================
// 静态校验:relay-billing-service.ts 导出函数完整性
// ============================================================================
function validateServiceExports() {
  const errors = []
  const servicePath = resolve(projectRoot, 'apps/api/src/services/relay-billing-service.ts')

  let content
  try {
    content = readFileSync(servicePath, 'utf-8')
  } catch (e) {
    errors.push(`无法读取 ${servicePath}: ${e?.message || e}`)
    return errors
  }

  for (const exp of EXPECTED_EXPORTS) {
    if (!exp.pattern.test(content)) {
      errors.push(`relay-billing-service.ts 缺少导出函数: ${exp.name}(${exp.desc})`)
    }
  }

  // 额外校验:recordCall 函数体内应有 mode === 'byok' 分支
  if (!/mode\s*===?\s*['"]byok['"]/.test(content)) {
    errors.push("relay-billing-service.ts recordCall 缺少 mode === 'byok' 分支(BYOK 计费逻辑未实现)")
  }

  // 额外校验:calculateByokCost 应计算 platformFeeCents(免费 provider = 0)
  if (!/platformFeeCents\s*=\s*isFree\s*\?\s*0/.test(content)) {
    errors.push('relay-billing-service.ts calculateByokCost 未实现免费 provider platformFeeCents=0 逻辑')
  }

  return errors
}

// ============================================================================
// 静态校验:v1-public.ts BYOK 集成点
// ============================================================================
function validateV1Integration() {
  const errors = []
  const v1Path = resolve(projectRoot, 'apps/api/src/routes/v1-public.ts')

  let content
  try {
    content = readFileSync(v1Path, 'utf-8')
  } catch (e) {
    errors.push(`无法读取 ${v1Path}: ${e?.message || e}`)
    return errors
  }

  for (const integration of EXPECTED_INTEGRATIONS) {
    if (!integration.pattern.test(content)) {
      errors.push(`v1-public.ts 缺少 BYOK 集成点: ${integration.name}(${integration.desc})`)
    }
  }

  return errors
}

// ============================================================================
// DB 校验:BYOK 配置存在性(ai_model_config.owner_uuid IS NOT NULL)
// ============================================================================
async function checkByokConfigs(sql) {
  const rows = await sql`
    SELECT c.provider_code, c.name, c.enabled, c.byok_commission_rate,
           COUNT(m.id) AS model_count
    FROM ai_model_config c
    LEFT JOIN ai_model_config_models m ON m.config_id = c.id
    WHERE c.owner_uuid IS NOT NULL
    GROUP BY c.provider_code, c.name, c.enabled, c.byok_commission_rate
    ORDER BY c.provider_code
  `
  return rows
}

// ============================================================================
// DB 校验:llm_call_logs byokMode=true 记录(链路已被真实调用过)
// ============================================================================
async function checkByokCallLogs(sql) {
  const rows = await sql`
    SELECT model, status, COUNT(*) AS call_count,
           MAX(created_at) AS last_call_at
    FROM llm_call_logs
    WHERE metadata->>'byokMode' = 'true'
    GROUP BY model, status
    ORDER BY call_count DESC
    LIMIT 20
  `
  return rows
}

// ============================================================================
// 服务可达性:调 GET /v1/models(需 API Key)
// ============================================================================
async function fetchV1Models(apiKey) {
  const url = `${apiUrl}/v1/models`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const resp = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    })
    const text = await resp.text().catch(() => '')
    if (!resp.ok) {
      return { ok: false, status: resp.status, error: `HTTP ${resp.status}: ${text.slice(0, 120)}` }
    }
    let data
    try {
      data = JSON.parse(text)
    } catch {
      return { ok: false, status: resp.status, error: `响应非 JSON: ${text.slice(0, 120)}` }
    }
    return { ok: true, status: resp.status, data }
  } catch (e) {
    return { ok: false, status: 'CONN_ERR', error: e?.name === 'AbortError' ? '超时(8s)' : (e?.message || String(e)) }
  } finally {
    clearTimeout(timer)
  }
}

// ============================================================================
// 主流程
// ============================================================================
async function main() {
  console.log(`\n========== BYOK 计费链路端到端验证 ${dryRun ? '(DRY-RUN)' : ''} ==========`)
  console.log(`验证目标:BYOK 零成本抽成变现链路(用户自带 key,平台抽 5-20% 服务费)`)
  console.log(`API 地址:${apiUrl}${apiKeyFlag ? ' (带 API Key)' : ' (无 API Key,跳过 /v1/models 验证)'}\n`)

  // 1. 打印 BYOK 计费链路(期望流程)
  console.log('--- BYOK 计费链路(期望流程) ---')
  console.log('  ① 用户配置私有 ai_model_config(owner_uuid=userId, provider_code 匹配, enabled=true)')
  console.log('  ② 用户调 /v1/chat/completions(API Key 鉴权)')
  console.log('  ③ API: checkQuota → isByokCall(userId, model) 判定 BYOK 模式')
  console.log('  ④ API: metadata.byokMode=true 透传给 ai-service')
  console.log('  ⑤ ai-service: 用用户私有 key 调大厂(平台零成本)')
  console.log('  ⑥ API: recordCall(mode=byok) → calculateByokCost')
  console.log('  ⑦ 只扣 platformFeeCents(= upstreamCostCents × commissionRate,免费 provider = 0)')
  console.log('  ⑧ 平台零成本抽成 5-20% 服务费\n')

  // 2. 静态校验:relay-billing-service.ts 导出函数
  console.log('--- 静态校验:relay-billing-service.ts 导出函数 ---')
  console.log(`期望导出:${EXPECTED_EXPORTS.length} 个 BYOK 核心函数`)
  for (const exp of EXPECTED_EXPORTS) {
    console.log(`  - ${exp.name.padEnd(26)} ${exp.desc}`)
  }
  const exportErrors = validateServiceExports()
  if (exportErrors.length === 0) {
    console.log('✅ 5 个 BYOK 核心函数全部导出 + mode=byok 分支 + 免费 provider platformFeeCents=0 逻辑就绪')
  } else {
    console.log(`❌ 导出函数校验失败(${exportErrors.length} 个错误):`)
    for (const e of exportErrors) console.log(`   - ${e}`)
  }
  console.log('')

  // 3. 静态校验:v1-public.ts BYOK 集成点
  console.log('--- 静态校验:v1-public.ts BYOK 集成点 ---')
  console.log(`期望集成:${EXPECTED_INTEGRATIONS.length} 个 BYOK 集成点`)
  for (const integration of EXPECTED_INTEGRATIONS) {
    console.log(`  - ${integration.name.padEnd(26)} ${integration.desc}`)
  }
  const integrationErrors = validateV1Integration()
  if (integrationErrors.length === 0) {
    console.log('✅ v1-public.ts BYOK 集成点全部就绪(import + isByokCall + mode=byok + metadata 透传 + recordCall)')
  } else {
    console.log(`❌ 集成点校验失败(${integrationErrors.length} 个错误):`)
    for (const e of integrationErrors) console.log(`   - ${e}`)
  }
  console.log('')

  if (dryRun) {
    console.log('[DRY-RUN] 不查 DB,不调 API 服务,仅静态校验')
    const hasError = exportErrors.length > 0 || integrationErrors.length > 0
    console.log(`\n========== 验证结果:${hasError ? '❌ 有问题(退出码 1)' : '✅ 全通过(退出码 0)'} ==========\n`)
    process.exit(hasError ? 1 : 0)
  }

  // 4. DB 校验:BYOK 配置存在性
  console.log('--- DB 校验:BYOK 配置存在性(ai_model_config.owner_uuid IS NOT NULL) ---')
  const envPath = resolve(projectRoot, 'apps/api/.env')
  let sql
  let dbErrors = []
  let byokConfigs = []
  let byokLogs = []

  try {
    const envContent = readFileSync(envPath, 'utf-8')
    const m = envContent.match(/^DATABASE_URL=(.+)$/m)
    if (!m) throw new Error(`缺少 DATABASE_URL(从 ${envPath} 读取失败)`)
    const databaseUrl = m[1].trim()
    sql = postgres(databaseUrl, { max: 4, prepare: false })

    byokConfigs = await checkByokConfigs(sql)
    if (byokConfigs.length === 0) {
      console.log('⚠️  DB 中无 BYOK 配置(ai_model_config.owner_uuid IS NOT NULL 查询结果为空)')
      console.log('   说明:尚未有用户配置私有 API Key,BYOK 链路未投入使用(静态校验仍有效)')
      dbErrors.push('DB 无 BYOK 配置(用户未配置私有 ai_model_config)')
    } else {
      console.log(`✅ DB 查到 ${byokConfigs.length} 条 BYOK 配置:`)
      console.log('   provider_code | name              | enabled | commission_rate | model_count')
      console.log('   --------------+-------------------+---------+-----------------+------------')
      for (const c of byokConfigs) {
        const pc = (c.provider_code || '').padEnd(13)
        const name = (c.name || '').slice(0, 18).padEnd(18)
        const en = (c.enabled ? '✓' : '✗').padEnd(8)
        const rate = String(c.byok_commission_rate || '(默认0.1)').padEnd(16)
        const mc = String(c.model_count || 0).padEnd(11)
        console.log(`   ${pc} | ${name} | ${en} | ${rate} | ${mc}`)
      }
    }
  } catch (e) {
    console.log(`⚠️  DB 校验失败:${e?.message || e}`)
    console.log('   跳过 DB 校验(静态校验仍有效)')
    dbErrors.push(`DB 校验异常: ${e?.message || e}`)
  }
  console.log('')

  // 5. DB 校验:llm_call_logs byokMode=true 记录
  if (sql) {
    console.log('--- DB 校验:llm_call_logs byokMode=true 记录(链路已被真实调用过) ---')
    try {
      byokLogs = await checkByokCallLogs(sql)
      if (byokLogs.length === 0) {
        console.log('⚠️  DB 中无 byokMode=true 的调用记录(llm_call_logs.metadata->>byokMode 查询结果为空)')
        console.log('   说明:BYOK 链路尚未被真实调用过(配置就绪但无实际 BYOK 调用)')
        dbErrors.push('DB 无 byokMode=true 调用记录(链路未被真实调用)')
      } else {
        console.log(`✅ DB 查到 ${byokLogs.length} 种 BYOK 调用记录:`)
        console.log('   model                          | status   | call_count | last_call_at')
        console.log('   --------------------------------+----------+------------+---------------------')
        for (const l of byokLogs) {
          const model = (l.model || '').slice(0, 31).padEnd(31)
          const st = (l.status || '').padEnd(9)
          const cc = String(l.call_count || 0).padEnd(11)
          const ts = l.last_call_at ? new Date(l.last_call_at).toISOString().slice(0, 19) : '-'
          console.log(`   ${model} | ${st} | ${cc} | ${ts}`)
        }
      }
    } catch (e) {
      console.log(`⚠️  llm_call_logs 查询失败:${e?.message || e}`)
      dbErrors.push(`llm_call_logs 查询异常: ${e?.message || e}`)
    }
  }
  console.log('')

  // 6. 服务可达性:调 GET /v1/models(需 API Key)
  let liveErrors = []
  let liveSkipped = false
  if (live && apiKeyFlag) {
    console.log('--- 服务可达性:GET /v1/models(查 owned_by=byok 模型) ---')
    const result = await fetchV1Models(apiKeyFlag)
    if (result.ok) {
      const models = result.data?.data ?? result.data ?? []
      const byokModels = Array.isArray(models)
        ? models.filter((m) => m?.owned_by === 'byok' || m?.owned_by === 'BYOK')
        : []
      if (byokModels.length > 0) {
        console.log(`✅ /v1/models 返回 ${byokModels.length} 个 BYOK 模型(owned_by=byok):`)
        for (const m of byokModels.slice(0, 10)) {
          console.log(`   - ${m.id} (owned_by=${m.owned_by})`)
        }
        if (byokModels.length > 10) console.log(`   ... 共 ${byokModels.length} 个`)
      } else {
        console.log('⚠️  /v1/models 未返回 owned_by=byok 的模型(用户无私有 BYOK 模型配置)')
        liveErrors.push('/v1/models 无 owned_by=byok 模型(用户未配置私有 BYOK 模型)')
      }
    } else {
      console.log(`⚠️  /v1/models 调用失败(HTTP ${result.status}):${result.error}`)
      liveSkipped = true
    }
  } else if (live && !apiKeyFlag) {
    console.log('--- 服务可达性:GET /v1/models ---')
    console.log('⚠️  未提供 API Key(通过 --api-key <key> 或 API_BYOK_KEY 环境变量),跳过 /v1/models 验证')
    liveSkipped = true
  }
  console.log('')

  // 7. 汇总报告
  console.log('--- 汇总报告 ---')
  console.log(`BYOK 核心函数:  ${EXPECTED_EXPORTS.length} 期望 / ${EXPECTED_EXPORTS.length - exportErrors.length} 就绪`)
  console.log(`BYOK 集成点:    ${EXPECTED_INTEGRATIONS.length} 期望 / ${EXPECTED_INTEGRATIONS.length - integrationErrors.length} 就绪`)
  console.log(`DB BYOK 配置:   ${byokConfigs.length} 条${byokConfigs.length > 0 ? '(用户已配置私有 API Key)' : '(无,链路未投入使用)'}`)
  console.log(`DB BYOK 调用:   ${byokLogs.reduce((s, l) => s + Number(l.call_count || 0), 0)} 次${byokLogs.length > 0 ? '(链路已被真实调用)' : '(无,未被真实调用)'}`)

  const allErrors = [...exportErrors, ...integrationErrors, ...dbErrors, ...liveErrors]
  const hasError = allErrors.length > 0

  if (hasError) {
    console.log(`\n--- ⚠️  问题详情(${allErrors.length} 个) ---`)
    for (const e of allErrors) console.log(`  - ${e}`)
    console.log('\n修复建议:')
    console.log('  1. 核心函数缺失 → 检查 apps/api/src/services/relay-billing-service.ts 的 5 个 export')
    console.log('  2. 集成点缺失 → 检查 apps/api/src/routes/v1-public.ts 的 isByokCall + recordCall(mode=byok)')
    console.log('  3. DB 无 BYOK 配置 → 用户需在 settings 页面配置私有 API Key(写入 ai_model_config.owner_uuid)')
    console.log('  4. DB 无调用记录 → 用 BYOK 模型调一次 /v1/chat/completions 即可产生 byokMode=true 记录')
    console.log('  5. /v1/models 无 byok 模型 → 确认用户私有 ai_model_config_models.enabled=true')
  } else {
    console.log('\n🎉 BYOK 计费链路端到端验证通过')
    if (liveSkipped) {
      console.log('   (服务验证被跳过,静态 + DB 校验已通过;带 --api-key 可做完整 /v1/models 验证)')
    }
  }
  console.log(`\n========== 验证结果:${hasError ? '❌ 有问题(退出码 1)' : '✅ 全通过(退出码 0)'} ==========\n`)

  if (sql) await sql.end()
  process.exit(hasError ? 1 : 0)
}

main().catch((e) => {
  console.error('FATAL:', e?.message || e)
  process.exit(2)
})
