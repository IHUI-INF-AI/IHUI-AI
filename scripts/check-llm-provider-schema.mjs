#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-llm-provider-schema.mjs — LLM provider 字典化阶段 3 前置守门
 *
 * 校验 apps/ai-service/.env 的 LLM_PROVIDERS / LLM_PROVIDERS_JSON 是否符合
 * ProviderConfig schema(apps/ai-service/app/core/provider_config.py),
 * 提前发现 JSON 格式错 / 字段类型错 / 未知 provider,避免运行时 ValidationError。
 *
 * 校验规则(7 条):JSON 解析 / 顶层对象 / provider 白名单(名单由服务端能力清单单向投影,
 *   条数以投影现值为准,手抄名单已消灭) /
 *   字段类型(api_key=str / api_base=str|null / enabled=bool / models=str[] /
 *   default_model=str|null) / 未知字段透传 / 空值检查 / 重复 provider 检测。
 *
 * 退出码:0 无 error / 1 有 error / 2 参数错误或 .env 不存在
 * 集成位置:.husky/pre-commit 第 N+1 项(阶段 3 升级 blocking)
 *
 * 用法:
 *   node scripts/check-llm-provider-schema.mjs [--env-file <path>] [--strict] [--json] [-h|--help]
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { dirname, join, resolve, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const C = {
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  cyan: '\x1b[36m', dim: '\x1b[2m', bold: '\x1b[1m', reset: '\x1b[0m',
}

// provider name 白名单 —— **机器源单向投影**(G-354族/G-393/G-762 拍板②,2026-10-07 落地)。
//
// 拍板前本名单是手抄副本("`.env` 里出现过的 provider name 的并集",39 条),与 config.py
// "新增 provider 零代码改动、自动识别"的设计语义相反:每来一个新 provider 都要人肉同步这里,
// 漏同步就把合法 provider 判成"未知"(票面现读:7 个 `.env` 实配 provider 被判未知)。
// 拍板后:名单 = **服务端能力清单的单向投影**,本文件不再手抄任何 provider 名。三个机器源:
//   ① apps/ai-service/app/services/free_provider_registry.py 的 `provider_code=` 条目(现读 92 个)
//   ② apps/ai-service/app/services/model_availability.py 的 `_PROVIDER_CODE_TO_LLM_PROVIDERS_NAME`
//      映射表(provider_code → LLM_PROVIDERS name,现读 5 条,如 cloudflare_workers_ai→cloudflare)
//   ③ apps/ai-service/app/core/llm_gateway.py 的 `_FREE_PROVIDER_ENDPOINT_RESOLVERS` 值元组首元素
//      (prefix→provider_code,现读 12 键)∪ 全 app 树字面 `get_provider_config('<name>')` 读取点
// 三源并集经 ② 投影成 name 集合。**判定语义不变**:名单内条目从不判红,名单外判黄(--strict 升
// error)。新增 provider 的正解 = 进 registry(或 resolver 表/字面读取点),本门零改动自动识别;
// 消灭的正是"第二份手抄名单"这一格,不是规则 3 本身 —— **不得**为让 warning 归零去删判据。
//
// 失效方向(必须响):任一机器源读不到/解析为空 ⇒ 打 warning 点名该源,名单照常投影(绝不静默
// 变成空名单把所有 provider 判未知,也绝不退回手抄兜底 —— 那是本拍板要消灭的东西)。
const PROJECTION_SOURCES = {
  registry: 'apps/ai-service/app/services/free_provider_registry.py',
  availability: 'apps/ai-service/app/services/model_availability.py',
  gateway: 'apps/ai-service/app/core/llm_gateway.py',
}
const GATE_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT_FROM_GATE = resolve(GATE_DIR, '..')

/** 从 free_provider_registry.py 源码抽 `provider_code="X"` 条目(单引号/双引号都认)。 */
export function parseRegistryProviderCodes(src) {
  const out = new Set()
  for (const m of String(src ?? '').matchAll(/provider_code\s*[:=]\s*["']([a-z0-9_]+)["']/g))
    out.add(m[1])
  return out
}

/** 从 model_availability.py 抽 `_PROVIDER_CODE_TO_LLM_PROVIDERS_NAME` 映射块。 */
export function parseCodeToNameMapping(src) {
  const out = {}
  const block = String(src ?? '').match(
    /_PROVIDER_CODE_TO_LLM_PROVIDERS_NAME[^=]*=\s*\{([\s\S]*?)\}/,
  )
  if (!block) return out
  for (const m of block[1].matchAll(/["']([a-z0-9_]+)["']\s*:\s*["']([a-z0-9_]+)["']/g))
    out[m[1]] = m[2]
  return out
}

/** 从 llm_gateway.py 抽 `_FREE_PROVIDER_ENDPOINT_RESOLVERS` 每行值元组的 provider_code。 */
export function parseResolverCodes(src) {
  const out = new Set()
  for (const line of String(src ?? '').split(/\r?\n/)) {
    const m = /^\s*"[^"]+"\s*:\s*\(\s*["']([a-z0-9_]+)["']/.exec(line)
    if (m) out.add(m[1])
  }
  return out
}

/** 从 Python 源码抽字面 `get_provider_config('<name>')` 读取点(只收单实参字符串字面量)。 */
export function parseLiteralReadNames(src) {
  const out = new Set()
  for (const m of String(src ?? '').matchAll(/get_provider_config\(\s*["']([a-z0-9_]+)["']/g))
    out.add(m[1])
  return out
}

/** 递归收集目录下全部 .py 路径(跳 __pycache__;字面读取点扫描用)。 */
function collectPyFiles(dir, out = []) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    const p = join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === '__pycache__') continue
      collectPyFiles(p, out)
    } else if (e.name.endsWith('.py')) out.push(p)
  }
  return out
}

/**
 * 三源并集投影。入参全部可注入(镜像测试喂构造源,CLI 运行时读真文件)。
 * 返回 { set, notes:[{source, kind, detail}] }:kind ∈ 'ok'|'missing'|'empty'。
 */
export function projectProviderWhitelist({
  registrySrc = '',
  availabilitySrc = '',
  gatewaySrc = '',
  literalSrcs = [],
} = {}) {
  const notes = []
  const codes = parseRegistryProviderCodes(registrySrc)
  notes.push({
    source: 'free_provider_registry.provider_code',
    kind: codes.size > 0 ? 'ok' : 'empty',
    count: codes.size,
  })
  const mapping = parseCodeToNameMapping(availabilitySrc)
  notes.push({
    source: '_PROVIDER_CODE_TO_LLM_PROVIDERS_NAME',
    kind: Object.keys(mapping).length > 0 ? 'ok' : 'empty',
    count: Object.keys(mapping).length,
  })
  const resolverCodes = parseResolverCodes(gatewaySrc)
  notes.push({
    source: '_FREE_PROVIDER_ENDPOINT_RESOLVERS',
    kind: resolverCodes.size > 0 ? 'ok' : 'empty',
    count: resolverCodes.size,
  })
  const literals = new Set()
  for (const s of literalSrcs) for (const n of parseLiteralReadNames(s)) literals.add(n)
  notes.push({
    source: 'get_provider_config 字面读取点',
    kind: literals.size > 0 ? 'ok' : 'empty',
    count: literals.size,
  })
  const applyMap = (c) => mapping[c] ?? c
  const set = new Set()
  for (const c of codes) set.add(applyMap(c))
  for (const c of resolverCodes) set.add(applyMap(c))
  for (const c of literals) set.add(c)
  return { set, notes }
}

let whitelistCache = null
/** CLI 运行时入口:读真机器源投影,缓存一次。 */
export function getProviderWhitelist() {
  if (whitelistCache) return whitelistCache
  const readSrc = (rel) => {
    try {
      return readFileSync(resolve(REPO_ROOT_FROM_GATE, rel), 'utf8')
    } catch {
      return null
    }
  }
  const registrySrc = readSrc(PROJECTION_SOURCES.registry)
  const availabilitySrc = readSrc(PROJECTION_SOURCES.availability)
  const gatewaySrc = readSrc(PROJECTION_SOURCES.gateway)
  const literalSrcs = collectPyFiles(resolve(REPO_ROOT_FROM_GATE, 'apps/ai-service/app')).map(
    (p) => {
      try {
        return readFileSync(p, 'utf8')
      } catch {
        return ''
      }
    },
  )
  const projected = projectProviderWhitelist({ registrySrc, availabilitySrc, gatewaySrc, literalSrcs })
  const notes = projected.notes.map((n) => ({
    ...n,
    kind:
      (n.source === 'free_provider_registry.provider_code' && registrySrc === null) ||
      (n.source === '_PROVIDER_CODE_TO_LLM_PROVIDERS_NAME' && availabilitySrc === null) ||
      (n.source === '_FREE_PROVIDER_ENDPOINT_RESOLVERS' && gatewaySrc === null)
        ? 'missing'
        : n.kind,
  }))
  whitelistCache = { set: projected.set, notes }
  return whitelistCache
}

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
    else if (a === '--staged') {
      // 忽略:guardian-runner 全局追加 --staged(pre-commit 模式),本脚本检查 .env 与 staged 无关
    } else if (a === '--json') args.json = true
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
  3. provider name 不在白名单(由服务端能力清单单向投影) → warning(--strict 升级为 error)
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

function validateJsonField(rawValue, fieldName, isStrict, seenProviderNames, whitelist) {
  const issues = []
  if (rawValue === '' || rawValue === null || rawValue === undefined) return issues
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
    if (!whitelist.has(name)) {
      issues.push({ level: isStrict ? 'error' : 'warning', provider: name, field: '(root)',
        message: `未知 provider name: "${name}"(不在 ${whitelist.size} 个白名单内)`, source: fieldName })
    }
    validateProviderConfig(name, cfg, fieldName, issues)
  }
  return issues
}

// ── 输出格式化 ────────────────────────────────────────────────────────────
/**
 * 从 LLM_PROVIDERS / LLM_PROVIDERS_JSON 值中提取 provider 名称列表(仅名称)。
 * 安全约束:诊断输出严禁回显 .env 原值或任何值片段——值内含 api_key 明文,
 * 且密钥格式不可枚举(正则脱敏必有漏网),因此只输出结构摘要,不输出值。
 */
function providerNames(v) {
  try {
    const parsed = JSON.parse(v)
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return Object.keys(parsed).slice(0, 12)
    }
  } catch { /* 非 JSON:不输出任何内容片段,解析错误由 issues 区报告 */ }
  return []
}

function outputHuman(envFile, envVars, allIssues) {
  const relPath = relative(resolve(process.cwd()), resolve(envFile))
  console.log(`${C.cyan}${C.bold}🔍 LLM Provider Schema 守门 — ${relPath}${C.reset}`)
  for (const f of ['LLM_PROVIDERS_JSON', 'LLM_PROVIDERS']) {
    const v = envVars[f]?.value ?? ''
    const display = v === ''
      ? `${C.dim}<empty>${C.reset}`
      : `${C.dim}非空(${v.length} 字符,providers: ${providerNames(v).join(', ') || '解析失败'})${C.reset}`
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
// 退出码一律走 main() 返回值,由文件末尾的 §22d 入口守卫统一 process.exit。
// (2026-10-06 之前这里散布 5 处 process.exit + 顶层裸 main().catch(),
//  镜像测试一旦 import 本门即触发 CLI 全流程 —— 见 G-1058651)
async function main() {
  let args
  try {
    args = parseArgs(process.argv.slice(2))
  } catch (e) {
    console.error(`${C.red}参数错误: ${e.message}${C.reset}`)
    console.error(`用 --help 查看可用参数`)
    return 2
  }
  if (args.help) {
    printHelp()
    return 0
  }

  const envFile = resolve(process.cwd(), args.envFile)
  if (!existsSync(envFile)) {
    emitFatal(`.env 文件不存在: ${args.envFile}`, args)
    return 2
  }

  let envVars
  try {
    envVars = parseEnvFile(envFile)
  } catch (e) {
    emitFatal(`.env 解析失败: ${e.message}`, args)
    return 2
  }

  // 收集两个字段(LLM_PROVIDERS_JSON 优先,但都校验)
  // 名单 = 服务端能力清单单向投影;投影源缺/空 ⇒ warning 点名该源(名单照常投影,
  // 绝不静默变空名单,也绝不回退手抄 —— G-354族/G-393/G-762 拍板②)。
  const wl = getProviderWhitelist()
  const seenProviderNames = new Set()
  const allIssues = []
  for (const note of wl.notes) {
    if (note.kind === 'ok') continue
    allIssues.push({
      level: 'warning', provider: '(root)', field: '(whitelist)',
      message: `provider 名单投影源不可用(kind=${note.kind}): ${note.source}(${note.detail ?? `实读条数 ${note.count ?? 0}`});名单仍按其余源投影,不回退手抄`,
      source: 'provider-whitelist-projection',
    })
  }
  allIssues.push(...validateJsonField(
    envVars.LLM_PROVIDERS_JSON?.value ?? '', 'LLM_PROVIDERS_JSON', args.strict, seenProviderNames, wl.set))
  allIssues.push(...validateJsonField(
    envVars.LLM_PROVIDERS?.value ?? '', 'LLM_PROVIDERS', args.strict, seenProviderNames, wl.set))

  if (args.json) outputJson(allIssues)
  else outputHuman(envFile, envVars, allIssues)

  return allIssues.some((i) => i.level === 'error') ? 1 : 0
}

// ── §22d 入口守卫:被 import 时零副作用,CLI 直跑才执行 main() ───────────────
// 用 pathToFileURL 归一(本机 Windows argv[1] 是反斜杠盘符路径,手写 'file:///'+ 永不匹配)
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main()
    .then((code) => {
      if (code !== 0) process.exit(code)
    })
    .catch((e) => {
      console.error(`${C.red}❌ 脚本执行异常:${C.reset}`, e?.message ?? e)
      console.error(e?.stack ?? '(no stack)')
      process.exit(2)
    })
}

// 判据单元出口(§22c 唯一真源):镜像测试 import 这份,不得再自抄实现/名单
export const __test__ = {
  KNOWN_FIELDS,
  FIELD_CHECKS,
  DEFAULT_ENV_FILE,
  parseArgs,
  parseEnvFile,
  typeOf,
  fmtValue,
  validateProviderConfig,
  validateJsonField,
  providerNames,
  // G-354族/G-393/G-762:名单投影族出口(手抄 PROVIDER_WHITELIST 已消灭,勿再引旧名)
  PROJECTION_SOURCES,
  parseRegistryProviderCodes,
  parseCodeToNameMapping,
  parseResolverCodes,
  parseLiteralReadNames,
  projectProviderWhitelist,
  getProviderWhitelist,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
