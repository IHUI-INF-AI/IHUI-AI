#!/usr/bin/env node
/**
 * check-dev-env-consistency.mjs — IHUI-AI 三端 env 一致性硬门禁(2026-08-07 立)
 *
 * 背景:2026-08-07 连续两次生产事故均源于 env 漂移:
 *  1. apps/api/.env 的 JWT_SECRET 被随机生成,与 apps/web/.env.local 不一致
 *     → 全站受保护 API 401 → "任务列表加载失败"
 *  2. apps/ai-service/.env 缺 JWT_SECRET → 模型端点 401 → "模型连接失败"
 *
 * 本脚本在 start-dev.ps1 启动前强制校验,任何不一致 → exit 1 拒绝启动。
 *
 * 校验项:
 *  - JWT_SECRET:web / api / ai-service 三端必须一致(签发/验签同一密钥)
 *  - CREDENTIALS_ENCRYPTION_KEY:api / ai-service 必须一致(跨服务共享加密密钥)
 *  - 占位符检测:<your-...> / change-me / placeholder 等一律视为未配置
 *
 * 用法:
 *   node scripts/check-dev-env-consistency.mjs         # 校验(0=通过,1=失败)
 *   node scripts/check-dev-env-consistency.mjs --json  # JSON 输出(供脚本消费)
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')

/** 参与一致性的 env 文件清单 */
const ENV_FILES = {
  web: path.join(REPO_ROOT, 'apps/web/.env.local'),
  api: path.join(REPO_ROOT, 'apps/api/.env'),
  'ai-service': path.join(REPO_ROOT, 'apps/ai-service/.env'),
}

/** 需要跨端一致的密钥字段 */
const CONSISTENCY_KEYS = {
  JWT_SECRET: {
    label: 'JWT_SECRET(签发/验签密钥)',
    // 必须参与一致的端;web 是签发方,api/ai-service 是验签方
    endpoints: ['web', 'api', 'ai-service'],
  },
  CREDENTIALS_ENCRYPTION_KEY: {
    label: 'CREDENTIALS_ENCRYPTION_KEY(凭证加密密钥)',
    endpoints: ['api', 'ai-service'],
  },
}

/** 占位符/弱值(命中即视为未配置) */
const PLACEHOLDER_PATTERN =
  /^<(.*)>$|change-me|changeme|your-|placeholder|^secret$|^changeme$|^password$/i

/** 解析 .env 文件为 key→value map(忽略注释、空行;去掉行内注释;去引号) */
function parseEnvFile(filePath) {
  const result = {}
  if (!fs.existsSync(filePath)) return result
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eqIdx = line.indexOf('=')
    if (eqIdx <= 0) continue
    let key = line.slice(0, eqIdx).trim()
    let value = line.slice(eqIdx + 1).trim()
    // 去掉行内注释(仅当 # 前有空格;避免密码含 # 被误删)
    const hashIdx = value.search(/\s+#/)
    if (hashIdx > 0) value = value.slice(0, hashIdx).trim()
    // 去引号
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    result[key] = value
  }
  return result
}

/** 判断值是否有效(非空且非占位符) */
function isValidValue(value) {
  if (!value || value.length === 0) return false
  return !PLACEHOLDER_PATTERN.test(value)
}

function run() {
  const parsed = {}
  for (const [endpoint, filePath] of Object.entries(ENV_FILES)) {
    parsed[endpoint] = parseEnvFile(filePath)
  }

  const issues = []
  const report = {}

  for (const [key, meta] of Object.entries(CONSISTENCY_KEYS)) {
    const endpointValues = meta.endpoints.map((ep) => {
      const v = parsed[ep][key] ?? ''
      return { endpoint: ep, value: v, present: isValidValue(v) }
    })

    const present = endpointValues.filter((e) => e.present)
    const missing = endpointValues.filter((e) => !e.present)

    // 缺失检查
    for (const m of missing) {
      issues.push(`${meta.label} 在 ${m.endpoint} 缺失或为占位符,请配置后重启`)
    }

    // 一致性检查(以第一个有效值为基准)
    const validValues = new Set(present.map((e) => e.value))
    if (validValues.size > 1) {
      const detail = endpointValues.map((e) => `${e.endpoint}=${e.present ? e.value.slice(0, 12) + '...' : '(未配置)'}`).join(' | ')
      issues.push(`${meta.label} 三端不一致:${detail}`)
    }

    report[key] = {
      label: meta.label,
      endpoints: endpointValues.map((e) => ({
        endpoint: e.endpoint,
        present: e.present,
        valuePreview: e.present ? `${e.value.slice(0, 8)}...(${e.value.length}字符)` : '(未配置/占位符)',
      })),
      ok: missing.length === 0 && validValues.size <= 1,
    }
  }

  const ok = issues.length === 0

  if (process.argv.includes('--json')) {
    process.stdout.write(JSON.stringify({ ok, issues, report }, null, 2) + '\n')
  } else {
    console.log('===== IHUI-AI 三端 env 一致性门禁 =====')
    for (const [key, r] of Object.entries(report)) {
      const status = r.ok ? 'PASS' : 'FAIL'
      console.log(`  [${status}] ${r.label}`)
      for (const ep of r.endpoints) {
        console.log(`         ${ep.endpoint.padEnd(12)} ${ep.valuePreview}`)
      }
    }
    if (issues.length > 0) {
      console.log('')
      console.log('  ✗ 发现不一致:')
      for (const msg of issues) console.log(`    - ${msg}`)
      console.log('')
      console.log('  权威值参考:apps/web/.env.local 的 JWT_SECRET(三端必须一致)')
      console.log('  修复后重新运行 start-dev.ps1')
    } else {
      console.log('')
      console.log('  ✓ 全部一致,门禁通过')
    }
  }

  process.exit(ok ? 0 : 1)
}

run()
