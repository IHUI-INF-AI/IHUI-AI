#!/usr/bin/env node
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-llm-provider-schema.mjs — LLM provider 字典化阶段 3 前置守门
 *
 * 校验 apps/ai-service/.env 的 LLM_PROVIDERS / LLM_PROVIDERS_JSON 是否符合
 * ProviderConfig schema(apps/ai-service/app/core/provider_config.py),
 * 提前发现 JSON 格式错 / 字段类型错 / 未知 provider,避免运行时 ValidationError。
 *
 * 校验规则(7 条):JSON 解析 / 顶层对象 / 31 个 provider 白名单 /
 *   字段类型(api_key=str / api_base=str|null / enabled=bool / models=str[] /
 *   default_model=str|null) / 未知字段透传 / 空值检查 / 重复 provider 检测。
 *
 * 退出码:0 无 error / 1 有 error / 2 参数错误或 .env 不存在
 * 集成位置:.husky/pre-commit 第 N+1 项(阶段 3 升级 blocking)
 *
 * 用法:
 *   node scripts/check-llm-provider-schema.mjs [--env-file <path>] [--strict] [--json] [-h|--help]
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, relative } from 'node:path'

const C = {
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  cyan: '\x1b[36m', dim: '\x1b[2m', bold: '\x1b[1m', reset: '\x1b[0m',
}

// 31 个 provider name 白名单(config.py L49-113 + _PROVIDER_KEY_ALIASES)
const PROVIDER_WHITELIST = new Set([
  'openai', 'anthropic', 'groq', 'gemini', 'openrouter', 'agnes', 'stepfun',
  'cloudflare', 'nvidia', 'github', 'vercel', 'opencode', 'modal', 'inference_net',
  'nlp_cloud', 'scaleway', 'alibaba_intl', 'cerebras', 'mistral', 'cohere',
  'huggingface', 'zai', 'kilo', 'pollinations', 'llm7', 'ovh', 'aihorde', 'reka',
  'routeway', 'bazaarlink', 'ainative',
])
const KNOWN_FIELDS = new Set(['api_key', 'api_base', 'enabled', 'models', 'default_model'])
const DEFAULT_ENV_FILE = 'apps/ai-service/.env'

// ── 参数解析 ────────────────────────────────────────────────────────────────
// 注意:Node 20.6+ 内置 `--env-file` 参数会与脚本 CLI 冲突。当 .env 文件不存在时,
// Node 直接报错 exit 9(脚本拿不到控制权)。解决:在脚本名后加 `--` 分隔符,如
// `node script.mjs -- --env-file <path>`,可让脚本接管参数解析。
function parseArgs(argv) {
  const args = { envFile: DEFAULT_ENV_FILE, strict: false, json: false, help: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--') continue // 标准 Unix 分隔符,跳过(Node 内置 flag 隔离用)
    if (a === '--help' || a === '-h') args.help = true
    else if (a === '--strict') args.strict = true
    else if (a === '--json') args.json = true
    else if (a === '--env-file') {
      const next = argv[i + 1]
      if (!next || next.startsWith('--')) {
        throw new Error(`--env-file 需要一个参数(收到: ${next ?? '无'})`)
      }
      args.envFile = next
      i++
    } else throw new Error(`未知参数: ${a}(用 --help 查看可用参数)`)
  }
  return args
}

function printHelp() {
  console.log(`LLM Provider Schema 守门 — 校验 .env 的 LLM_PROVIDERS / LLM_PROVIDERS_JSON

用法:
  node scripts/check-llm-provider-schema.mjs [选项]

选项:
  --env-file <path>   指定 .env 文件路径(默认: ${DEFAULT_ENV_FILE})
  --strict            严格模式(未知 provider name 报 error,默认 warn-only)
  --json              输出 JSON 格式(供 CI 解析,默认人类可读格式)
  -h, --help          显示此帮助

注意:Node 20.6+ 内置 --env-file 会与脚本参数冲突。.env 文件不存在时
      Node 直接 exit 9。用 "--" 分隔符让脚本接管:
      node scripts/check-llm-provider-schema.mjs -- --env-file <path>

退出码:0 无 error / 1 有 error / 2 参数错误或 .env 不存在

校验规则(7 条):
  1. JSON 解析必须合法  2. 顶层必须是对象
  3. provider name 不在 31 个白名单 → warning(--strict 升级为 error)
  4. 字段类型:api_key=str / api_base=str|null / enabled=bool /
              models=str[] / default_model=str|null
  5. 未知字段:允许(透传到 extra),info 提示
  6. api_key="" 且无 api_base → info 提示"可能未配置"
  7. 重复 provider(LLM_PROVIDERS + LLM_PROVIDERS_JSON 冲突)→ error

集成位置:.husky/pre-commit 第 N+1 项(阶段 3 升级 blocking)
`)
}

// ── .env 解析 ────────────────────────────────────────────────────────────────
/**
 * 解析 .env 文件为 { KEY: { value, lineNo } } 对象。
 * 支持 # 注释行、空行、export 前缀;VALUE 支持单/双引号或无引号。
 */
function parseEnvFile(filePath) {
  const content = readFileSync(filePath, 'utf8')
  const result = {}
  content.split(/\r?\n/).forEach((raw, idx) => {
    let line = raw.trim()
    if (line === '' || line.startsWith('#')) return
    if (/^export\s+/.test(line)) line = line.replace(/^export\s+/, '')
    const eqIdx = line.indexOf('=')
    if (eqIdx === -1) return
    const key = line.slice(0, eqIdx).trim()
    if (!key) return
    let value = line.slice(eqIdx + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    } else {
      const hashIdx = value.indexOf(' #')
      if (hashIdx !== -1) value = value.slice(0, hashIdx).trim()
    }
    result[key] = { value, lineNo: idx + 1 }
  })
  return result
}

// ── 类型辅助 ──────────────────────────────────────────────────────────────
function typeOf(v) {
  if (v === null) return 'null'
  if (Array.isArray(v)) return 'array'
  return typeof v
}
function fmtValue(v) {
  if (typeof v === 'string') return `"${v.length > 30 ? v.slice(0, 30) + '…' : v}"`
  if (v === null) return 'null'
  return JSON.stringify(v)
}

// ── 字段类型校验表(声明式,避免重复代码) ────────────────────────────────
// 每条:[fieldName, acceptPredicate, expectedDesc]
const FIELD_CHECKS = [
  ['api_key', (v) => typeof v === 'string', '字符串'],
  ['api_base', (v) => v === null || typeof v === 'string', '字符串或 null'],
  ['enabled', (v) => typeof v === 'boolean', '布尔值(禁止 "true" 字符串 / 0 / 1)'],
  ['models', (v) => Array.isArray(v) && v.every((m) => typeof m === 'string'), '字符串数组'],
  ['default_model', (v) => v === null || typeof v === 'string', '字符串或 null'],
]

// ── 核心校验 ──────────────────────────────────────────────────────────────
function validateProviderConfig(name, cfg, source, issues) {
  if (cfg === null || typeof cfg !== 'object' || Array.isArray(cfg)) {
    issues.push({ level: 'error', provider: name, field: '(root)',
      message: `provider config 必须是对象,实际 ${typeOf(cfg)} (${fmtValue(cfg)})`, source })
    return
  }
  for (const [field, accept, desc] of FIELD_CHECKS) {
    if (!(field in cfg)) continue
    const v = cfg[field]
    if (field === 'models' && Array.isArray(v) && !v.every((m) => typeof m === 'string')) {
      v.forEach((m, i) => {
        if (typeof m !== 'string') {
          issues.push({ level: 'error', provider: name, field: `models[${i}]`,
            message: `期望字符串,实际 ${typeOf(m)} (${fmtValue(m)})`, source })
        }
      })
    } else if (!accept(v)) {
      issues.push({ level: 'error', provider: name, field,
        message: `期望${desc},实际 ${typeOf(v)} (${fmtValue(v)})`, source })
    }
  }
  // 未知字段 → info
  for (const k of Object.keys(cfg)) {
    if (!KNOWN_FIELDS.has(k)) {
      issues.push({ level: 'info', provider: name, field: k,
        message: `未知字段(将透传到 extra)`, source })
    }
  }
  // 空值检查
  const apiKey = cfg.api_key
  const apiBase = cfg.api_base
  if (apiKey === '' && (apiBase === undefined || apiBase === null || apiBase === '')) {
    issues.push({ level: 'info', provider: name, field: '(root)',
      message: `provider "${name}" 未配置 api_key 且无 api_base(可能未启用)`, source })
  }
}

function validateJsonField(rawValue, fieldName, isStrict, seenProviderNames) {
  const issues = []
  if (rawValue === '' || rawValue == null) return issues
  let parsed
  try {
    parsed = JSON.parse(rawValue)
  } catch (e) {
    issues.push({ level: 'error', provider: '(root)', field: fieldName,
      message: `JSON 解析失败: ${e.message}`, source: fieldName })
    return issues
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    issues.push({ level: 'error', provider: '(root)', field: fieldName,
      message: `顶层必须是对象(dict),实际 ${typeOf(parsed)}`, source: fieldName })
    return issues
  }
  for (const [name, cfg] of Object.entries(parsed)) {
    if (seenProviderNames.has(name)) {
      issues.push({ level: 'error', provider: name, field: '(root)',
        message: `provider name "${name}" 在多个字段中重复配置(最后覆盖,请合并)`, source: fieldName })
    } else {
      seenProviderNames.add(name)
    }
    if (!PROVIDER_WHITELIST.has(name)) {
      issues.push({ level: isStrict ? 'error' : 'warning', provider: name, field: '(root)',
        message: `未知 provider name: "${name}"(不在 ${PROVIDER_WHITELIST.size} 个白名单内)`, source: fieldName })
    }
    validateProviderConfig(name, cfg, fieldName, issues)
  }
  return issues
}

// ── 输出格式化 ────────────────────────────────────────────────────────────
function outputHuman(envFile, envVars, allIssues) {
  const relPath = relative(resolve(process.cwd()), resolve(envFile))
  console.log(`${C.cyan}${C.bold}🔍 LLM Provider Schema 守门 — ${relPath}${C.reset}`)
  for (const f of ['LLM_PROVIDERS_JSON', 'LLM_PROVIDERS']) {
    const v = envVars[f]?.value ?? ''
    const display = v === '' ? `${C.dim}<empty>${C.reset}`
      : `${C.dim}${v.length > 80 ? v.slice(0, 80) + '…' : v}${C.reset}`
    console.log(`📋 ${f}: ${display}`)
  }
  console.log()
  const errors = allIssues.filter((i) => i.level === 'error')
  const warnings = allIssues.filter((i) => i.level === 'warning')
  const infos = allIssues.filter((i) => i.level === 'info')
  if (errors.length === 0) {
    console.log(`${C.green}✅ 通过:${C.reset}${errors.length} error, ${warnings.length} warning, ${infos.length} info`)
  } else {
    console.log(`${C.red}❌ 失败:${C.reset}${errors.length} error, ${warnings.length} warning, ${infos.length} info`)
  }
  const printSection = (label, color, items) => {
    if (items.length === 0) return
    console.log(`\n${color}${label}:${C.reset}`)
    for (const it of items) {
      const loc = it.provider === '(root)' ? it.field
        : `${it.provider}${it.field === '(root)' ? '' : '.' + it.field}`
      const src = it.source ? ` ${C.dim}[${it.source}]${C.reset}` : ''
      console.log(`  ${color}-${C.reset} ${C.bold}${loc}${C.reset}${src}`)
      console.log(`    ${C.dim}${it.message}${C.reset}`)
    }
  }
  printSection('Errors', C.red, errors)
  printSection('Warnings', C.yellow, warnings)
  printSection('Info', C.cyan, infos)
}

function outputJson(allIssues) {
  const errors = allIssues.filter((i) => i.level === 'error').length
  const warnings = allIssues.filter((i) => i.level === 'warning').length
  const infos = allIssues.filter((i) => i.level === 'info').length
  console.log(JSON.stringify({
    passed: errors === 0,
    errors, warnings, infos,
    details: allIssues.map((it) => ({
      level: it.level, provider: it.provider, field: it.field,
      message: it.message, source: it.source ?? null,
    })),
  }, null, 2))
}

function emitFatal(message, args) {
  if (args.json) {
    console.log(JSON.stringify({
      passed: false, errors: 1, warnings: 0, infos: 0,
      details: [{ level: 'error', provider: '(root)', field: '(file)', message, source: null }],
    }, null, 2))
  } else {
    console.error(`${C.red}❌ ${message}${C.reset}`)
  }
}

// ── 主流程 ────────────────────────────────────────────────────────────────
function main() {
  let args
  try {
    args = parseArgs(process.argv.slice(2))
  } catch (e) {
    console.error(`${C.red}参数错误: ${e.message}${C.reset}`)
    console.error(`用 --help 查看可用参数`)
    process.exit(2)
  }
  if (args.help) {
    printHelp()
    process.exit(0)
  }

  const envFile = resolve(process.cwd(), args.envFile)
  if (!existsSync(envFile)) {
    emitFatal(`.env 文件不存在: ${args.envFile}`, args)
    process.exit(2)
  }

  let envVars
  try {
    envVars = parseEnvFile(envFile)
  } catch (e) {
    emitFatal(`.env 解析失败: ${e.message}`, args)
    process.exit(2)
  }

  // 收集两个字段(LLM_PROVIDERS_JSON 优先,但都校验)
  const seenProviderNames = new Set()
  const allIssues = []
  allIssues.push(...validateJsonField(
    envVars.LLM_PROVIDERS_JSON?.value ?? '', 'LLM_PROVIDERS_JSON', args.strict, seenProviderNames))
  allIssues.push(...validateJsonField(
    envVars.LLM_PROVIDERS?.value ?? '', 'LLM_PROVIDERS', args.strict, seenProviderNames))

  if (args.json) outputJson(allIssues)
  else outputHuman(envFile, envVars, allIssues)

  process.exit(allIssues.some((i) => i.level === 'error') ? 1 : 0)
}

main().catch((e) => {
  console.error(`${C.red}❌ 脚本执行异常:${C.reset}`, e?.message ?? e)
  console.error(e?.stack ?? '(no stack)')
  process.exit(2)
})
