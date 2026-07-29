#!/usr/bin/env node
/**
 * 上游 provider 模型扫描注册机(P0-5,2026-07-30)
 *
 * 用途:从 DB ai_model_config 表查所有启用 provider,解密 api_key,
 *      调用上游 /v1/models 拉取最新模型清单,与 DB 现有模型比对,
 *      新模型自动写入 ai_relay_discovery + ai_model_config_models 并上架。
 *
 * 用法:
 *   node scripts/scan-upstream-models.mjs               # 扫描所有启用 provider
 *   node scripts/scan-upstream-models.mjs --provider stepfun   # 只扫描指定 provider
 *   node scripts/scan-upstream-models.mjs --dry-run     # 预览不写入
 *
 * 环境变量:
 *   DATABASE_URL                数据库连接(默认 postgres://postgres:postgres@localhost:5432/ihui)
 *   CREDENTIALS_ENCRYPTION_KEY  API key 加密密钥(从 .env 读取)
 */
import { createRequire } from 'node:module'
import { createDecipheriv } from 'node:crypto'
import { readFileSync } from 'node:fs'

const require = createRequire(import.meta.url)
const postgres = require('postgres')

// ===== CLI 参数解析 =====
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const providerFilter = (() => {
  const i = args.indexOf('--provider')
  return i >= 0 ? args[i + 1] : null
})()

// ===== 加载加密密钥(优先 env,其次 .env 文件) =====
function loadEncryptionKey() {
  if (process.env.CREDENTIALS_ENCRYPTION_KEY) {
    return process.env.CREDENTIALS_ENCRYPTION_KEY.slice(0, 32)
  }
  for (const envPath of ['G:/IHUI-AI/.env', '.env']) {
    try {
      const envContent = readFileSync(envPath, 'utf8')
      const m = envContent.match(/^CREDENTIALS_ENCRYPTION_KEY=(.+)$/m)
      if (m) return m[1].trim().slice(0, 32)
    } catch {
      // 继续尝试下一个路径
    }
  }
  throw new Error('CREDENTIALS_ENCRYPTION_KEY not found in env or .env')
}
const ENC_KEY = loadEncryptionKey()

// ===== AES-256-GCM 解密(兼容 crypto.ts encryptJSON + 直接加密字符串两种方式) =====
function decryptJSON(payload) {
  const key = Buffer.from(ENC_KEY)
  const iv = Buffer.from(payload.iv, 'base64')
  const ciphertext = Buffer.from(payload.ciphertext, 'base64')
  const tag = Buffer.from(payload.tag, 'base64')
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
  // 先尝试 JSON.parse(标准 encryptJSON 路径),失败则返回裸字符串(直接加密路径)
  try {
    return JSON.parse(plaintext)
  } catch {
    return plaintext
  }
}

// ===== 解析 api_key_enc(兼容明文/JSON 字符串/对象三种格式) =====
function resolveApiKey(raw) {
  if (typeof raw === 'string') {
    const s = raw.trim()
    if (s.startsWith('{')) {
      return decryptJSON(JSON.parse(s))
    }
    if (s.startsWith('"') && s.endsWith('"')) {
      return JSON.parse(s)
    }
    return s
  }
  if (typeof raw === 'object' && raw && raw.iv && raw.ciphertext && raw.tag) {
    return decryptJSON(raw)
  }
  throw new Error(`api_key_enc 类型不支持: ${typeof raw}`)
}

const dbUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/ihui'
const sql = postgres(dbUrl, { max: 4, prepare: false })

function log(step, msg, data = null) {
  const line = `[${step}] ${msg}`
  console.log(line)
  if (data !== null) {
    console.log('  →', typeof data === 'string' ? data : JSON.stringify(data).slice(0, 400))
  }
}

async function main() {
  console.log(`\n========== 模型池扫描注册机 ${dryRun ? '(DRY-RUN)' : ''} ==========`)
  if (providerFilter) console.log(`筛选 provider: ${providerFilter}`)
  const report = { startedAt: new Date().toISOString(), providers: [] }

  // 1. 查 ai_model_config 表的所有 provider 配置
  log('1', '查 ai_model_config 表 provider 配置...')
  const configs = await sql`
    SELECT id, provider_code, name, base_url, api_key_enc, enabled
    FROM ai_model_config
    WHERE enabled = true
    ${providerFilter ? sql`AND provider_code = ${providerFilter}` : sql``}
    ORDER BY id
  `
  log('1', `✓ 找到 ${configs.length} 个启用的 provider 配置`, configs.map((c) => `${c.provider_code}(${c.id})`))

  // 2. 逐个 provider 拉取上游 /v1/models
  for (const cfg of configs) {
    const providerReport = {
      providerCode: cfg.provider_code,
      configId: cfg.id,
      baseUrl: cfg.base_url,
      scanned: 0,
      newModels: 0,
      approved: 0,
      failed: 0,
      models: [],
    }
    log('2', `\n---------- 处理 provider: ${cfg.provider_code} (configId=${cfg.id}) ----------`)
    log('2', `base_url: ${cfg.base_url}`)

    if (!cfg.base_url || !cfg.api_key_enc) {
      log('2', `⚠ provider ${cfg.provider_code} 无 base_url 或 api_key_enc,跳过`)
      providerReport.failed = 1
      report.providers.push(providerReport)
      continue
    }

    // 解密 api_key
    let apiKey = ''
    try {
      apiKey = resolveApiKey(cfg.api_key_enc)
      log('2', `✓ api_key 解析成功(len=${apiKey.length}, prefix=${apiKey.slice(0, 6)}...)`)
    } catch (e) {
      log('2', `✗ api_key 解析失败: ${e?.message || e}`)
      providerReport.failed = 1
      report.providers.push(providerReport)
      continue
    }

    // 调用上游 /v1/models
    let upstreamModels = []
    try {
      const modelsUrl = cfg.base_url.replace(/\/$/, '') + '/models'
      log('2', `GET ${modelsUrl}...`)
      const resp = await fetch(modelsUrl, {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      if (!resp.ok) {
        log('2', `✗ 上游返回 ${resp.status}`, (await resp.text().catch(() => '')).slice(0, 200))
        providerReport.failed = 1
        report.providers.push(providerReport)
        continue
      }
      const data = await resp.json()
      upstreamModels = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []
      log('2', `✓ 上游返回 ${upstreamModels.length} 个模型`)
      providerReport.scanned = upstreamModels.length
    } catch (e) {
      log('2', `✗ 拉取失败: ${e?.message || e}`)
      providerReport.failed = 1
      report.providers.push(providerReport)
      continue
    }

    // 3. 与 DB 现有模型比对,找新模型
    log('3', `比对 DB ai_model_config_models (configId=${cfg.id})...`)
    const existing = await sql`
      SELECT model_id, is_relay_public FROM ai_model_config_models WHERE config_id = ${cfg.id}
    `
    const existingIds = new Set(existing.map((r) => r.model_id))
    log('3', `DB 现有 ${existing.length} 个模型,${existing.filter((r) => r.is_relay_public).length} 个已上架`)

    const newModels = upstreamModels.filter((m) => m.id && !existingIds.has(m.id))
    log('3', `✓ 新模型 ${newModels.length} 个`, newModels.slice(0, 15).map((m) => m.id))
    providerReport.newModels = newModels.length

    // 4. 写入 ai_relay_discovery + ai_model_config_models(自动上架)
    if (dryRun) {
      log('4', `[DRY-RUN] 跳过写入,将注册 ${newModels.length} 个新模型`)
      providerReport.approved = 0
      providerReport.models = newModels.map((m) => m.id)
    } else {
      let approvedCount = 0
      for (const m of newModels) {
        const modelId = m.id
        const modelName = m.id || modelId
        try {
          // 4a. 写 ai_relay_discovery(ON CONFLICT 不重复)
          await sql`
            INSERT INTO ai_relay_discovery (provider_code, model_id, model_name, status, discovered_at, raw_metadata)
            VALUES (${cfg.provider_code}, ${modelId}, ${modelName}, 'approved', now(), ${JSON.stringify(m)}::jsonb)
            ON CONFLICT (provider_code, model_id) DO NOTHING
          `
          // 4b. 写 ai_model_config_models(自动上架,免费模型定价 0)
          await sql`
            INSERT INTO ai_model_config_models
              (config_id, model_id, display_name, context_length, input_price_per_1k, output_price_per_1k, enabled, is_relay_public, relay_price_multiplier, created_at, updated_at)
            VALUES
              (${cfg.id}, ${modelId}, ${modelName}, 32000, 0, 0, true, true, '1.0000', now(), now())
            ON CONFLICT (config_id, model_id) DO UPDATE
              SET is_relay_public = true, enabled = true, updated_at = now()
          `
          approvedCount++
          providerReport.models.push(modelId)
        } catch (e) {
          log('4', `✗ 写入 ${modelId} 失败: ${e?.message || e}`)
        }
      }
      providerReport.approved = approvedCount
      log('4', `✓ provider ${cfg.provider_code} 新注册并上架 ${approvedCount} 个模型`)

      // 5. 对已存在但未上架的模型,自动上架
      const unlisted = existing.filter((r) => !r.is_relay_public)
      if (unlisted.length > 0) {
        log('5', `对 ${unlisted.length} 个已存在但未上架的模型自动上架...`)
        for (const r of unlisted) {
          await sql`
            UPDATE ai_model_config_models
            SET is_relay_public = true, updated_at = now()
            WHERE config_id = ${cfg.id} AND model_id = ${r.model_id}
          `
        }
        log('5', `✓ 已自动上架 ${unlisted.length} 个模型`)
      }
    }

    report.providers.push(providerReport)
  }

  // Summary
  report.finishedAt = new Date().toISOString()
  const totalScanned = report.providers.reduce((s, p) => s + (p.scanned || 0), 0)
  const totalNew = report.providers.reduce((s, p) => s + (p.newModels || 0), 0)
  const totalApproved = report.providers.reduce((s, p) => s + (p.approved || 0), 0)
  console.log('\n========== 模型池扫描注册机报告 ==========')
  console.log(`扫描 provider 数: ${report.providers.length}`)
  console.log(`上游模型总数: ${totalScanned}`)
  console.log(`新发现模型: ${totalNew}`)
  console.log(`自动注册上架: ${totalApproved}`)
  for (const p of report.providers) {
    console.log(`  - ${p.providerCode}: scanned=${p.scanned} new=${p.newModels} approved=${p.approved} failed=${p.failed}`)
    if (p.models.length > 0) {
      console.log(`    新模型: ${p.models.slice(0, 20).join(', ')}${p.models.length > 20 ? ` ... (+${p.models.length - 20})` : ''}`)
    }
  }
  console.log('==========================================')

  await sql.end()
  return report
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('FATAL:', e?.message || e)
    process.exit(2)
  })
