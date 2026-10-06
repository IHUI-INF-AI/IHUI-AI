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
 * 校验规则(7 条):JSON 解析 / 顶层对象 / provider 白名单(条数以 PROVIDER_WHITELIST 现值为准) /
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
import { pathToFileURL } from 'node:url'

const C = {
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  cyan: '\x1b[36m', dim: '\x1b[2m', bold: '\x1b[1m', reset: '\x1b[0m',
}

// provider name 白名单 —— 条数现读 `PROVIDER_WHITELIST.size`,勿在注释里写死。
//
// 下文 §A/§B 各条注释里的 `llm_gateway.py:N` 一律指 **apps/ai-service/app/core/llm_gateway.py**
// (core 层,不是 services/ —— 写全路径是为了不让下一个人按 services/ 去找而扑空)。
//
// 名单为什么长这样(2026-10-06 逐条落实「凭什么算数」):
//   本名单**不是**"审核过的合法 provider 全集",而是"`.env` 里出现过的 provider name 的并集"。
//   判据形态是「名单外判黄」(见下方 validateJsonField),名单内条目从不判红——所以名单里的
//   §B 条目不制造任何红,裁剪属产品口径(见 §B),不是本门该动的。
//
//   可投影的机器源**确实存在**(旧注释断言"没有"是错的,已更正):
//     apps/ai-service/app/services/free_provider_registry.py 的 `provider_code=` 条目(92 个 uniq),
//     经 apps/ai-service/app/services/model_availability.py:328 `_to_llm_providers_name()`
//     (映射表 :313,含 cloudflare_workers_ai→cloudflare 等 5 条)投影到 .env 的 LLM_PROVIDERS name,
//     再由 :421-422 / :955-956 `settings.get_provider_config(cfg_name)` 真正读 api_key。
//     实测:registry 92 个 provider_code 里有 14 个能在 .env 命中已配 api_key 的 name。
//   故新增 provider 的正解是同步 free_provider_registry + .env;本名单是**兜底副本**,不是唯一真源。
//   收口方向(另计一票):由 registry 投影出本名单,或让 ai-service 暴露名单出口
//   (routers/llm.py:2636 GET /llm/providers/availability 已返回 providers[],是现成出口);
//   在此之前新增 provider 必须同步这里,不得为消红删判据。
const PROVIDER_WHITELIST = new Set([
  // ── §A 有生产代码在用(.env 实配 15 个;§B 的 24 条另有代码调用点但未配 key)──
  // 依据:.env LLM_PROVIDERS 实配 + 下列生产代码位置。删掉任一条 ⇒ 对应模型重新 502。
  //
  // 「真 provider」vs「模型名前缀/别称」—— 7 条**全是真 provider**(每个都有 get_provider_config
  // 读取点,即真的 key 载体),但其中 4 条**同时兼任裸模型名前缀规则**,这一身二职必须如实标注:
  //   A1 纯 provider 身份,只经带斜杠的 vendor 路径可达(不靠"猜裸名"):
  'ihui_relay',   // llm_gateway.py:1823 get_provider_config + :277 "ihui/"→ihui_relay;api_base 由 :109
                  //   _detect_ihui_relay_base() 国内/海外竞速自动检测;free_provider_registry.py:266。
                  //   解的是:中转模型列表可选、一调用即 502。
                  //   注意 model_availability.py:108 的 ("ihui/", "ihui_relay") 是前缀→code,不是 name 映射。
  'hf_qwen',      // 真 provider,但**只经 vendor 路径**可达: llm_gateway.py:311 "hf-qwen/"→hf_qwen,
                  //   且 :1262 _FREE_PROVIDER_ENDPOINT_RESOLVERS["hf-qwen/"] 自带免 key 公网端点
                  //   (HF Victor,端点生命周期短)。key 由 :1856-1858 循环 `get_provider_config(code)` 读,
                  //   是**间接**消费(不像 ihui_relay 那样字面出现在调用里)。
                  //   ⚠ 7 条里**唯一**不在 free_provider_registry 的 provider —— 因为它是免 key 端点。
  'siliconflow',  // 真 provider,消费路径**经 availability 而非网关内联**: llm_gateway.py:377-378
                  //   "siliconcloud/"与"siliconflow/"两个前缀都→siliconflow;
                  //   key 由 model_availability.py:421-422 经 _to_llm_providers_name('siliconflow')
                  //   → get_provider_config('siliconflow') 读;free_provider_registry.py:1093 有条目。
                  //   ⚠ 全仓无字面 get_provider_config("siliconflow") —— 别按"网关内联"判它不存在。
  // ── A2 provider key **兼任**裸模型名前缀(名字可无斜杠出现,故必须与 A1 区分)──
  // 这 4 条的生产修复同源: 模型选择器发的是裸 id(/llm/models 的 m.id),不带 vendor 前缀,
  // 落到末尾 openai 默认分支 → LiteLLM "LLM Provider NOT provided" 502。
  'deepseek',     // llm_gateway.py:1871 字面 get_provider_config + :295 "deepseek-" 裸前缀兜底;
                  //   model_pricing.py:115 有计价条目;registry 有条目。裸 deepseek-chat/reasoner 靠这条。
  'zhipu',        // llm_gateway.py:1876 字面 get_provider_config + :291 "glm-" 裸前缀(智谱 id 无斜杠);
                  //   model_pricing.py:116 计价;registry :135。裸 glm-4-plus/glm-5 靠这条。
  'qwen',         // llm_gateway.py:1884 字面 get_provider_config + :278 "qwen" / :279 "qwen-" 裸前缀;
                  //   registry 有条目(与 bailian 同端点,见 registry notes)。
                  //   ⚠ 名字双重含义:既是 provider key,也是阿里 dashscope 的裸模型名前缀。
  'mimo',         // llm_gateway.py:1892 字面 get_provider_config + :283 "mimo" / :284 "mimo-" 裸前缀;
                  //   小米公网端点 https://api.xiaomimimo.com/v1 写死在代码里(.env 只配了 api_key)。
                  //   ⚠ 归属有例外: llm_gateway.py:529-530 记载 mimo-v2.5-free 在库里只挂在
                  //   provider_code='opencode_zen' 名下,故 mimo 归属以 DB 实证优先(见 :536 三级判定)。

  // ── §B 有生产调用点、但 `.env` 未配 api_key 的条目(24 条)────────────────
  // ⚠ **措辞更正(2026-10-06)**:本节此前写作"当前无生产调用点的闲置条目",**那是错的**。
  //   逐条机读核验(`app/core/llm_gateway.py`)结果:
  //   24 条**全部有代码调用点,零调用点为 0**,分两类 ——
  //     A 类 16 条:字面 `get_provider_config('<name>')` 读取点;
  //     B 类  8 条:走 _FREE_PROVIDER_ENDPOINT_RESOLVERS 查表
  //                 (:1249 建表,:1856 循环消费)—— github/vercel/opencode/modal/
  //                 inference_net/nlp_cloud/scaleway/alibaba_intl。
  //   它们与 `.env` 实配的 15 个**零交集** ⇒ 裁掉不判红,但那是**没配 key**,不是不可达:
  //   配了 key 就能用。判它"闲置"会把"待配 key"误报成"死代码",后者才是不可达的终态。
  //   本轮**不裁**(机主 2026-10-06 拍板):裁剪属产品口径,且名单内条目从不判红,留着无害。
  //   它们仍会让名单虚高、掩盖"名单外=真未知"的信号;将来要裁,判据是"是否仍无 key"。
  'anthropic', 'github', 'vercel', 'opencode', 'modal', 'inference_net', 'nlp_cloud', 'scaleway',
  'alibaba_intl', 'cerebras', 'mistral', 'cohere', 'huggingface', 'zai', 'kilo', 'pollinations',
  'llm7', 'ovh', 'aihorde', 'reka', 'routeway', 'bazaarlink', 'ainative', 'token6688',

  // ── §C .env 实配且有生产代码在用的既有条目(本轮未动,补注释以保持名单可读)──
  'openai', 'groq', 'gemini', 'openrouter', 'agnes', 'stepfun',
  'cloudflare', 'nvidia',
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
  3. provider name 不在白名单(条数见 PROVIDER_WHITELIST) → warning(--strict 升级为 error)
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
    if (!PROVIDER_WHITELIST.has(name)) {
      issues.push({ level: isStrict ? 'error' : 'warning', provider: name, field: '(root)',
        message: `未知 provider name: "${name}"(不在 ${PROVIDER_WHITELIST.size} 个白名单内)`, source: fieldName })
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
  const seenProviderNames = new Set()
  const allIssues = []
  allIssues.push(...validateJsonField(
    envVars.LLM_PROVIDERS_JSON?.value ?? '', 'LLM_PROVIDERS_JSON', args.strict, seenProviderNames))
  allIssues.push(...validateJsonField(
    envVars.LLM_PROVIDERS?.value ?? '', 'LLM_PROVIDERS', args.strict, seenProviderNames))

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
  PROVIDER_WHITELIST,
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
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
