#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console */

/**
 * scripts/e2e-agent-access.mjs —— 「外部 Agent 能否真接通」可重复运行端到端证明(任务 O17)
 *
 * 目的:把「能力开放」从文档声明变成机器可证的事实。两种模式:
 *
 *  1) 离线模式(默认,不依赖任何服务/数据库):读 `packages/types/generated/capabilities.json`
 *     + 扫源码 + 通过 tsx 直接调用 `packages/types/src` 里的**真实**判据函数
 *     (`isM2MAllowed` / `effectiveDataClass` / `DEFAULT_API_KEY_PERMISSIONS`),断言:
 *       - 匿名 MCP 已关闭(`jwt_public_paths` 默认值与 **apps/ai-service/.env 原文**都不含
 *         `jwt_auth._NEVER_PUBLIC_ROOTS` 里的任何特权 router 根 / `_CATCH_ALL_PUBLIC_ENTRIES`
 *         兜底写法;清单从 jwt_auth.py 动态解析,不手抄;路由层凭据门禁存在)
 *       - `/v1` 无未登记端点(复用 scripts/check-capability-catalog.mjs 的判据,零复刻)
 *       - `/api` 能力开放登记表无通配、全部落 `/api/` 下、scope 可对机器凭据开放
 *       - `default permissions` 不含 `chat:write`
 *       - platform / thirdPartyEligible=false 的 scope 不会被 `'*'` 通配穿透
 *       - `scoped-*` 取数走受控出口(`dbScoped` / `dbReadScoped` 调用点 ≥ 5)
 *
 *  2) 在线模式(`--live`,只读探测 + 必要的 DCR 注册写入):真跑三条通道
 *       - OpenAI 兼容形状:GET /v1/models、POST /v1/chat/completions(scope 越界必须 403 SCOPE_REQUIRED)
 *       - MCP JSON-RPC:ai-service `POST /api/mcp` 的 initialize → tools/list → tools/call
 *         + apps/api 网关 `GET /v1/mcp/tools`
 *       - OAuth DCR:`/.well-known/oauth-authorization-server` → `POST /oauth/register` → `client_credentials`
 *       - A2A:`GET /.well-known/agent.json`(发现文档匿名可读)
 *     服务不可达 → 该通道**明确 SKIP 并写原因**(绝不写成 PASS);
 *     缺凭据 → 只 SKIP「需要凭据的成功用例」,**匿名必须 401/403 的用例照常断言**。
 *
 * 用法:
 *   node scripts/e2e-agent-access.mjs                     # 离线证明
 *   node scripts/e2e-agent-access.mjs --live              # 离线 + 在线
 *   node scripts/e2e-agent-access.mjs --live --json       # 机器可读结果
 *   node scripts/e2e-agent-access.mjs --api-url http://127.0.0.1:8802 --ai-url http://127.0.0.1:8803
 *
 * 凭据(可选,只从命令行/环境变量读,脚本永不落盘也永不回显完整值):
 *   IHUI_API_KEY(或 --api-key)  形如 ihui_xxx  —— Bearer 机器凭据
 *   IHUI_API_SECRET(或 --api-secret) 形如 sk_xxx —— X-Api-Secret 第二因子
 *   IHUI_JWT(或 --jwt)             IHUI 人通道 JWT —— ai-service MCP 通道
 *
 * 安全边界:
 *   - 只读探测;唯一写操作是 OAuth DCR 注册一个 loopback 机密客户端(local dev 环境的正常入口)。
 *   - 不连生产库:脚本自身零 DB 依赖;若 apps/api/ai-service 配了生产库,请只在隔离环境跑 --live。
 *   - 不做任何 git 写操作。
 *
 * 退出码:0 = 无 FAIL(SKIP 不算失败,但会显著标注) / 1 = 存在 FAIL(或 --require-live 而 live 全 SKIP) / 2 = 脚本自身异常
 *
 * 配套 npm scripts:根 package.json 的 `check:agent-access`(离线)与 `check:agent-access:live`。
 */

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// ═══════════════════════════════════ CLI ═══════════════════════════════════
const argv = process.argv.slice(2)
function flagOf(name) {
  const eq = argv.find((a) => a.startsWith(`--${name}=`))
  if (eq) return eq.slice(name.length + 3)
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : undefined
}
function envOr(names, fallback = '') {
  for (const n of names) if (process.env[n]) return process.env[n]
  return fallback
}

const OPTS = {
  live: argv.includes('--live'),
  json: argv.includes('--json'),
  quiet: argv.includes('--quiet'),
  help: argv.includes('--help') || argv.includes('-h'),
  requireLive: argv.includes('--require-live') || process.env.E2E_AGENT_ACCESS_REQUIRE_LIVE === '1',
  noTsx: argv.includes('--no-tsx'),
  apiUrl: (
    flagOf('api-url') || envOr(['IHUI_AGENT_API_URL', 'API_URL'], 'http://127.0.0.1:8802')
  ).replace(/\/$/, ''),
  aiUrl: (
    flagOf('ai-url') || envOr(['IHUI_AGENT_AI_URL', 'AI_SERVICE_URL'], 'http://127.0.0.1:8803')
  ).replace(/\/$/, ''),
  /**
   * 公网入口(2026-09-24 O20:web 反代白名单暴露发现文档后的可达性回归)。
   * 默认生产域;本地跑 --live 时公网用例对它做只读 GET,不可达 → SKIP 写原因,不算 FAIL。
   */
  publicUrl: (
    flagOf('public-url') || envOr(['IHUI_AGENT_PUBLIC_URL', 'PUBLIC_URL'], 'https://aizhs.top')
  ).replace(/\/$/, ''),
  timeoutMs: Number(flagOf('timeout') || envOr(['E2E_AGENT_ACCESS_TIMEOUT'], '8000')),
  apiKey: flagOf('api-key') || envOr(['IHUI_API_KEY']),
  apiSecret: flagOf('api-secret') || envOr(['IHUI_API_SECRET']),
  jwt: flagOf('jwt') || envOr(['IHUI_JWT']),
  /** 未登记但真实存在的 /api 路由(机器凭据必须被端点自身判 401)。 */
  unregisteredApiPath: flagOf('unregistered-path') || '/api/notifications/unread-count',
  /** 登记表已逐条放行的 /api 路由(正向对照:机器通道必须能进门)。 */
  registeredApiPath: flagOf('registered-path') || '/api/v1/tools/list',
  /**
   * 被审计的部署态 .env 路径(默认 `apps/ai-service/.env`)。
   * 存在的意义:OFF-02c 的判据必须是 **.env 原文**,而 .env 是 gitignored 的机器态、随时可能被
   * 人手工清理 —— 提供覆盖入口才能用固定夹具复现"当初那条 /api/agents/ 违规",证明本门禁真能报红,
   * 而不是只在"恰好还没清理"的那台机器上绿一次。
   */
  envFile: flagOf('ai-env') || envOr(['AI_SERVICE_ENV_FILE'], 'apps/ai-service/.env'),
}

const HELP = `
e2e-agent-access.mjs —— 外部 Agent 接入能力端到端证明(O17)

  node scripts/e2e-agent-access.mjs [选项]

选项:
  --live               追加在线模式(真跑 OpenAI 兼容 / MCP JSON-RPC / OAuth DCR / A2A 四组)
  --require-live       在线用例全部 SKIP 时按失败退出(CI 强制真接通时使用)
  --api-url <url>      apps/api 基址(默认 http://127.0.0.1:8802)
  --ai-url <url>       ai-service 基址(默认 http://127.0.0.1:8803)
  --api-key <key>      ihui_ 前缀机器凭据(或 env IHUI_API_KEY)
  --api-secret <sk>    X-Api-Secret 第二因子(或 env IHUI_API_SECRET)
  --jwt <token>        人通道 JWT,用于 ai-service MCP(或 env IHUI_JWT)
  --timeout <ms>       单次 HTTP 超时(默认 8000)
  --ai-env <path>      被审计的部署态 .env(默认 apps/ai-service/.env;OFF-02c/02d 判据取该文件原文)
  --no-tsx             禁用 tsx 引擎(不直接调真实函数,改由 capabilities.json 推导)
  --json               输出机器可读 JSON
  --quiet              抑制逐条明细,只给汇总
  --help               本帮助

退出码:0 无 FAIL / 1 有 FAIL(或 --require-live 而 live 全 SKIP)/ 2 脚本异常
`

// ═════════════════════════════════ 结果模型 ═════════════════════════════════
/** @typedef {'PASS'|'FAIL'|'SKIP'} Status */
const results = []
const findings = []

function add(group, id, title, status, detail) {
  results.push({ group, id, title, status, detail })
  return status
}
function finding(severity, title, detail) {
  findings.push({ severity, title, detail })
}
function read(rel) {
  try {
    return readFileSync(join(ROOT, rel), 'utf8')
  } catch {
    return null
  }
}
/** 读任意(相对仓库根或绝对)路径;失败返回 null,由调用方判"未证明"。 */
function readAbs(p) {
  try {
    return readFileSync(resolve(ROOT, p), 'utf8')
  } catch {
    return null
  }
}
const mask = (s) => (s ? `${String(s).slice(0, 6)}***(len=${String(s).length})` : '(未提供)')

// ═══════════════════════════ 真实判据引擎(tsx → packages/types 源码) ═══════════════════════════
const TSX_CLI_CANDIDATES = [
  'apps/api/node_modules/tsx/dist/cli.mjs',
  'node_modules/tsx/dist/cli.mjs',
  'apps/web/node_modules/tsx/dist/cli.mjs',
  'packages/types/node_modules/tsx/dist/cli.mjs',
]

function findTsx() {
  for (const rel of TSX_CLI_CANDIDATES) {
    const abs = resolve(ROOT, rel)
    if (existsSync(abs)) return abs
  }
  return null
}

const TS_PROBE = [
  'const A = SPEC_CAT, B = SPEC_KEY;',
  'Promise.all([import(A), import(B)]).then(([c, k]) => {',
  '  const scopes = c.CAPABILITY_CATALOG.map((e) => ({',
  '    scope: String(e.scope),',
  '    dataClass: String(c.effectiveDataClass(e)),',
  '    thirdPartyEligible: e.thirdPartyEligible === true,',
  '    m2m: c.isM2MAllowed(e.scope),',
  '    unregistered: c.getCapability(e.scope) ? false : true,',
  '  }));',
  '  console.log(JSON.stringify({',
  '    ok: true,',
  '    scopes,',
  '    defaults: Array.from(k.DEFAULT_API_KEY_PERMISSIONS).map(String),',
  "    unknownScopeAllowed: c.isM2MAllowed('nope:read'),",
  '  }));',
  '}).catch((e) => { console.log(JSON.stringify({ ok: false, error: String((e && e.message) || e) })); })',
].join('\n')

/**
 * 直接在源码上跑真实判据函数(而不是复刻一份规则)。
 * @returns {{engine:string, scopes?:Array<{scope:string,dataClass:string,thirdPartyEligible:boolean,m2m:boolean}>, defaults?:string[], unknownScopeAllowed?:boolean, error?:string}}
 */
function evalRealJudges() {
  if (OPTS.noTsx) return { engine: 'artifact-fallback(--no-tsx)' }
  const cli = findTsx()
  if (!cli) return { engine: 'artifact-fallback(未找到 tsx)' }
  const code = TS_PROBE.replace(
    'SPEC_CAT',
    JSON.stringify(pathToFileURL(resolve(ROOT, 'packages/types/src/capability-catalog.ts')).href),
  ).replace(
    'SPEC_KEY',
    JSON.stringify(pathToFileURL(resolve(ROOT, 'packages/types/src/api-key.ts')).href),
  )
  const r = spawnSync(process.execPath, [cli, '-e', code], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 16 << 20,
    timeout: 60_000,
  })
  const line = (r.stdout || '').trim().split('\n').filter(Boolean).pop()
  if (r.status !== 0 || !line) {
    return {
      engine: 'artifact-fallback(tsx 调用失败)',
      error: (r.stderr || '').split('\n')[0] || `exit=${r.status}`,
    }
  }
  try {
    const parsed = JSON.parse(line)
    if (!parsed.ok) return { engine: 'artifact-fallback(模块加载失败)', error: parsed.error }
    return { engine: 'tsx:packages/types/src', ...parsed }
  } catch (e) {
    return { engine: 'artifact-fallback(输出不可解析)', error: String(e?.message ?? e) }
  }
}

const REAL = evalRealJudges()

// ═══════════════════════════════ 离线判据实现 ═══════════════════════════════

/** 解析 apps/ai-service/app/core/config.py 里 jwt_public_paths 的**默认值**(不含 .env 覆盖)。 */
function parseJwtPublicPaths(configPySource) {
  const m = /jwt_public_paths:\s*str\s*=\s*\(([\s\S]*?)\n\s*\)/.exec(configPySource || '')
  if (!m) return null
  const parts = [...m[1].matchAll(/"([^"]*)"|'([^']*)'/g)].map((x) => x[1] ?? x[2] ?? '')
  return parts
    .join('')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** 解析 .env 风格的 JWT_PUBLIC_PATHS 覆盖值(部署态权威值,与默认值背离时必须告警)。 */
function parseEnvList(envSource, key) {
  const m = new RegExp(`^${key}=(.*)$`, 'm').exec(envSource || '')
  if (!m) return null
  return m[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * 从 Python 源码里动态解析一个**元组字面量常量**(如 `_NEVER_PUBLIC_ROOTS = ("a", "b")`)。
 * 绝不手抄常量:AGENTS.md §4 记录过"文档手抄 button 档位表 → 文档与代码漂移 → 按文档写反而违规"
 * 的同类事故,守门判据必须与被守门机制同源。
 * @returns {string[]|null} 解析不到(常量改名/结构变化/空清单)一律 null,由调用方判 FAIL。
 */
function parsePyTupleLiteral(source, constName) {
  if (!source) return null
  const m = new RegExp(`^${constName}\\s*(?::[^=\\n]+)?=\\s*\\(([^)]*)\\)`, 'm').exec(source)
  if (!m) return null
  const parts = [...m[1].matchAll(/"([^"]*)"|'([^']*)'/g)].map((x) => x[1] ?? x[2]).filter(Boolean)
  return parts.length > 0 ? parts : null
}

/**
 * 解析 `apps/ai-service/app/core/jwt_auth.py` 的两条安全边界清单。
 * @returns {{neverPublicRoots:string[], catchAllEntries:string[]}|null}
 */
function parseSecurityBoundaryTuples(jwtAuthSource) {
  const neverPublicRoots = parsePyTupleLiteral(jwtAuthSource, '_NEVER_PUBLIC_ROOTS')
  const catchAllEntries = parsePyTupleLiteral(jwtAuthSource, '_CATCH_ALL_PUBLIC_ENTRIES')
  if (!neverPublicRoots || !catchAllEntries) return null
  return { neverPublicRoots, catchAllEntries }
}

/** 与 jwt_auth._is_never_public **同口径**的判定(清单由入参注入,不写死任何路径)。 */
function isNeverPublicEntry(entry, tuples) {
  const normalized = String(entry).trim()
  if (tuples.catchAllEntries.includes(normalized)) return true
  return tuples.neverPublicRoots.some(
    (root) => normalized === root || normalized.startsWith(`${root}/`),
  )
}

/**
 * 逐条给出违规归因(属于哪个 router 根 / 为什么不得匿名放行)。
 * 注意:本函数**不接收**任何"代码侧是否已有 fail-safe"的入参 —— 运行时净化不能消除配置债,
 * 否则 jwt_auth 一加固,守门就永远报不出来(真机 .env 的 /api/agents/ 正是这种"运行时已无害、
 * 配置里仍然错"的条目)。判据源只能是 .env 原文。
 * @param {string[]} entries
 * @param {{neverPublicRoots:string[], catchAllEntries:string[]}} tuples
 */
function detectPrivilegedPublicEntries(entries, tuples) {
  const violations = []
  for (const entry of entries) {
    const normalized = String(entry).trim()
    const root = tuples.neverPublicRoots.find(
      (r) => normalized === r || normalized.startsWith(`${r}/`),
    )
    if (root) {
      violations.push({
        entry: normalized,
        kind: 'privileged-router-root',
        routerRoot: root,
        reason:
          `/api 前缀 = 一个 FastAPI router 根;该 router 自身无端点级鉴权(无 Depends、无属主校验),` +
          `安全性全押在 JWTAuthMiddleware 上 ⇒ 一条目录前缀会静默放行该 router 现在与将来的每一个端点。` +
          `确需公开单个端点:在 router 内显式实现凭据门禁并走 code review,不得靠 .env 静默重开。`,
      })
      continue
    }
    if (tuples.catchAllEntries.includes(normalized)) {
      violations.push({
        entry: normalized,
        kind: 'catch-all',
        routerRoot: normalized,
        reason:
          `兜底放行写法:命中该条目后全部路由匿名可达(等同于关掉整条鉴权链),` +
          `属于配置层面的鉴权失效,不得出现在 JWT_PUBLIC_PATHS 的任何一侧。`,
      })
    }
  }
  return violations
}

/** 消费方检索时需要跳过的产物/副本目录(命中它们等于命中构建输出,不是真的调用方)。 */
const CONSUMER_SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'out',
  'coverage',
  '.turbo',
  '.output',
  'android',
  'ios',
  'www',
  'intermediates',
  'generated',
  '.next-static-r2',
])
const CONSUMER_EXT_RE = /\.(ts|tsx|js|mjs)$/

/**
 * 全仓 ts/tsx/js/mjs 检索某条白名单路径的字面量消费方(排除构建产物与副本目录)。
 * 一次遍历同时匹配多条,避免 .env 漂移条目多时反复扫盘。
 * @param {string[]} entries
 * @returns {Map<string, string[]>} entry → 相对路径命中清单(最多 4 条)
 */
function scanJsConsumers(entries) {
  const hits = new Map(entries.map((e) => [e, []]))
  const needles = entries.map((e) => ({ entry: e, needle: `"${e}"`, alt: `'${e}'` }))
  const walk = (dir) => {
    let names = []
    try {
      names = readdirSync(dir)
    } catch {
      return
    }
    for (const name of names) {
      const full = join(dir, name)
      let st = null
      try {
        st = statSync(full)
      } catch {
        continue
      }
      if (st.isDirectory()) {
        if (CONSUMER_SKIP_DIRS.has(name) || name.startsWith('.next')) continue
        walk(full)
        continue
      }
      if (!CONSUMER_EXT_RE.test(name)) continue
      let text = null
      try {
        text = readFileSync(full, 'utf8')
      } catch {
        continue
      }
      if (!text.includes('/api/')) continue
      const rel = full.slice(ROOT.length + 1).replace(/\\/g, '/')
      for (const { entry, needle, alt } of needles) {
        const bucket = hits.get(entry)
        if (bucket.length >= 4) continue
        if (text.includes(needle) || text.includes(alt)) bucket.push(rel)
      }
    }
  }
  for (const sub of ['apps', 'packages', 'scripts']) {
    const abs = resolve(ROOT, sub)
    if (existsSync(abs)) walk(abs)
  }
  return hits
}

/**
 * 解析 config/open-capability-registry.ts 的 DECLARATIONS 字面量。
 * 只做结构解析(键 / methods / paths / scope),通配判定与真实运行时同口径。
 */
function parseOpenRegistry(source) {
  if (!source) return null
  const start = source.indexOf('const DECLARATIONS = {')
  if (start < 0) return null
  const bodyStart = source.indexOf('{', start)
  let depth = 0
  let end = -1
  for (let i = bodyStart; i < source.length; i += 1) {
    const ch = source[i]
    if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  if (end < 0) return null
  const body = source.slice(bodyStart + 1, end)
  const entries = []
  const keyRe = /'([a-z0-9][a-z0-9-]*)':\s*\{/g
  let km
  const marks = []
  while ((km = keyRe.exec(body))) marks.push({ key: km[1], at: km.index })
  for (let i = 0; i < marks.length; i += 1) {
    const seg = body.slice(marks[i].at, i + 1 < marks.length ? marks[i + 1].at : body.length)
    const paths = [...seg.matchAll(/paths:\s*\[([\s\S]*?)\]/g)].flatMap((m) =>
      [...m[1].matchAll(/'([^']*)'|"([^"]*)"/g)].map((s) => s[1] ?? s[2] ?? ''),
    )
    const methods = [...seg.matchAll(/methods:\s*\[([\s\S]*?)\]/g)].flatMap((m) =>
      [...m[1].matchAll(/'([^']*)'|"([^"]*)"/g)].map((s) => s[1] ?? s[2] ?? ''),
    )
    const scope = /scope:\s*'([^']+)'/.exec(seg)?.[1]
    if (paths.length === 0 || !scope) continue
    entries.push({ key: marks[i].key, paths, methods, scope })
  }
  return entries
}

/** 剥注释(块注释 + 行注释),与 apps/api/tests/o4-route-wiring.test.ts 同口径。 */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('//'))
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n')
}

function listFiles(dir, filter, out = []) {
  let names = []
  try {
    names = readdirSync(dir)
  } catch {
    return out
  }
  for (const name of names) {
    const full = join(dir, name)
    let st = null
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) listFiles(full, filter, out)
    else if (filter(name)) out.push(full)
  }
  return out
}

/** `dbScoped` / `dbReadScoped` 真实调用点计数(排除 import 行、注释行、闸实现文件)。 */
function countScopedCallSites(srcRoot, gateImplFiles) {
  const files = listFiles(srcRoot, (n) => n.endsWith('.ts'))
  const hits = []
  for (const abs of files) {
    const rel = abs.slice(srcRoot.length + 1).replace(/\\/g, '/')
    if (gateImplFiles.has(rel)) continue
    const code = stripComments(readFileSync(abs, 'utf8'))
    for (const line of code.split('\n')) {
      if (/^\s*import\b/.test(line) || /\bfrom\s+'/.test(line)) continue
      if (/\bdbScoped\b|\bdbReadScoped\b/.test(line)) hits.push(`${rel}`)
    }
  }
  return hits
}

/** 产物 capabilities.json → scope 元信息(引擎不可用时的推导依据)。 */
function loadManifest() {
  const text = read('packages/types/generated/capabilities.json')
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
const MANIFEST = loadManifest()
const manifestIndex = new Map((MANIFEST?.capabilities ?? []).map((c) => [c.scope, c]))

function m2mAllowedOf(scope) {
  if (REAL.scopes) return REAL.scopes.find((s) => s.scope === scope)?.m2m === true
  const c = manifestIndex.get(scope)
  return !!c && c.dataClass !== 'platform' && c.thirdPartyEligible === true
}
function platformishScopes() {
  if (REAL.scopes)
    return REAL.scopes.filter((s) => s.dataClass === 'platform' || s.thirdPartyEligible === false)
  return [...manifestIndex.values()]
    .filter((c) => c.dataClass === 'platform' || c.thirdPartyEligible === false)
    .map((c) => ({
      scope: c.scope,
      dataClass: c.dataClass,
      thirdPartyEligible: c.thirdPartyEligible === true,
    }))
}

async function runOfflineChecks() {
  const G = 'offline'

  // ── OFF-01 能力目录产物可读且非空 ──
  if (!MANIFEST || !Array.isArray(MANIFEST.capabilities) || MANIFEST.capabilities.length === 0) {
    add(
      G,
      'OFF-01',
      '能力目录产物可读',
      'FAIL',
      'packages/types/generated/capabilities.json 缺失或不可解析 —— 运行 pnpm capabilities:export',
    )
    return
  }
  add(
    G,
    'OFF-01',
    '能力目录产物可读(scope 总数)',
    'PASS',
    `${MANIFEST.capabilities.length} 个 scope / M2M 可用 ${MANIFEST.capabilities.filter((c) => m2mAllowedOf(c.scope)).length} 个 / 判据引擎=${REAL.engine}${REAL.error ? `(${REAL.error})` : ''}`,
  )

  // ── OFF-02 JWT 白名单不得放行特权 router 根 / 兜底条目 ──
  // 清单**从 apps/ai-service/app/core/jwt_auth.py 动态解析**(不手抄,见 parseSecurityBoundaryTuples 注释):
  // jwt_auth 侧新增/删改一个 router 根,本守门的判据自动跟随,不存在"文档抄漏"窗口。
  const cfgSrc = read('apps/ai-service/app/core/config.py')
  const publicPaths = parseJwtPublicPaths(cfgSrc)
  const jwtAuth = read('apps/ai-service/app/core/jwt_auth.py') ?? ''
  const tuples = parseSecurityBoundaryTuples(jwtAuth)
  const codeEnforcesNeverPublic = /_is_never_public|_NEVER_PUBLIC/.test(jwtAuth)
  const codeEnforcesAlwaysPublic = /_ALWAYS_PUBLIC/.test(jwtAuth)

  add(
    G,
    'OFF-02a',
    '安全边界清单与 jwt_auth.py 同源可解析(判据不得手抄)',
    tuples ? 'PASS' : 'FAIL',
    tuples
      ? `_NEVER_PUBLIC_ROOTS=[${tuples.neverPublicRoots.join(', ')}] / _CATCH_ALL_PUBLIC_ENTRIES=[${tuples.catchAllEntries.map((s) => `'${s}'`).join(', ')}] —— 逐次从源码元组字面量读取`
      : '解析不到 jwt_auth.py 的 _NEVER_PUBLIC_ROOTS / _CATCH_ALL_PUBLIC_ENTRIES 元组字面量(改名/结构变化)→ 判据失源,特权条目断言按**未证明**处理并 exit 1,禁止静默跳过',
  )

  if (!publicPaths) {
    add(
      G,
      'OFF-02',
      '特权 router 根不在 JWT 白名单(jwt_public_paths 默认值)',
      'FAIL',
      '读不到 apps/ai-service/app/core/config.py 的 jwt_public_paths 默认值,判据失效即视为未证明',
    )
  } else if (!tuples) {
    add(
      G,
      'OFF-02',
      '特权 router 根不在 JWT 白名单(jwt_public_paths 默认值)',
      'FAIL',
      '边界清单解析失败(OFF-02a),本用例未执行 —— 按未证明处理,不得留绿',
    )
  } else {
    const defaultViolations = detectPrivilegedPublicEntries(publicPaths, tuples)
    add(
      G,
      'OFF-02',
      `特权 router 根不在 JWT 白名单(默认值,清单 ${tuples.neverPublicRoots.length} 个根)`,
      defaultViolations.length === 0 ? 'PASS' : 'FAIL',
      defaultViolations.length === 0
        ? `默认白名单 ${publicPaths.length} 项,无 ${tuples.neverPublicRoots.join(' / ')} 形态、无兜底放行:${publicPaths.join(', ')}`
        : `默认白名单含特权条目:${defaultViolations.map((v) => `${v.entry}(属 ${v.routerRoot})`).join(', ')} —— 源码层就已经放开`,
    )
    // 运行时权威值是 apps/ai-service/.env 的覆盖值(config.py 注释自己就警告过):
    // 双向比对 —— .env 多加的(后门)/ .env 漏掉的(把默认已放行的公开端点又锁死)。
    // 代码侧是否已经把这两类边界钉死(2026-09-21 O17/O19 收口:jwt_auth._resolve_public_paths
    // 强制剔除特权根、强制补齐 /.well-known/agent*)。断言必须跟**机制**同源,
    // 不能停在"配置写错就判红"——机制变了还按旧判据,守门就会一直报一个已被修掉的洞。
    //
    // **"运行时无害"不等于"静态可免"**:jwt_auth 的 fail-safe 让 .env 里的后门条目在运行时失效,
    // 但那条 .env 换机/重装/重新 clone 就会消失,而代码默认值一旦被同样改错就没有第二道闸。
    // 故 OFF-02c 的输入是 **.env 原文**(`read()` + `parseEnvList`),既不是运行时 PUBLIC_PATHS 也不做
    // HTTP 探测;`detectPrivilegedPublicEntries` 结构上不接受"代码侧是否已加固"这一入参,
    // 因此加固本身永远无法把本条判绿(见 scripts/tests/e2e-agent-access-never-public.test.mjs)。
    const envRaw = readAbs(OPTS.envFile)
    const envPaths = parseEnvList(envRaw, 'JWT_PUBLIC_PATHS')
    if (!envPaths) {
      add(
        G,
        'OFF-02c',
        '部署态 .env 的 JWT_PUBLIC_PATHS 不含特权条目(判据 = .env 原文)',
        envRaw === null ? 'FAIL' : 'SKIP',
        envRaw === null
          ? `读不到 ${OPTS.envFile}(可用 --ai-env / env AI_SERVICE_ENV_FILE 指定)→ 特权条目断言无法执行,按未证明处理(禁止静默跳过)`
          : `${OPTS.envFile} 无 JWT_PUBLIC_PATHS 覆盖 → 运行时即用 config.py 默认值,漂移侧无需清理(默认值由 OFF-02 判定)`,
      )
    } else {
      const extra = envPaths.filter((p) => !publicPaths.includes(p))
      const dropped = publicPaths.filter((p) => !envPaths.includes(p))
      const envViolations = detectPrivilegedPublicEntries(envPaths, tuples)
      add(
        G,
        'OFF-02c',
        '部署态 .env 的 JWT_PUBLIC_PATHS 不含特权条目(判据 = .env 原文)',
        envViolations.length === 0 ? 'PASS' : 'FAIL',
        envViolations.length === 0
          ? `${OPTS.envFile} 覆盖值 ${envPaths.length} 项,逐条比对 ${tuples.neverPublicRoots.length} 个特权根 + ${tuples.catchAllEntries.length} 个兜底写法,均不命中`
          : [
              `${OPTS.envFile} 的 JWT_PUBLIC_PATHS 原文含 ${envViolations.length} 条特权条目:`,
              ...envViolations.map(
                (v) =>
                  `  · ${v.entry} → (${v.kind === 'catch-all' ? '兜底放行写法' : `router 根 ${v.routerRoot}`}) —— ${v.reason}`,
              ),
              codeEnforcesNeverPublic
                ? `  注:jwt_auth 侧 fail-safe 已在运行时剔除这些条目(${envViolations.map((v) => v.entry).join(', ')} 不在运行时 PUBLIC_PATHS 内),` +
                  '但**配置债不随加固消失** —— .env 是 gitignored 的机器态(根 .gitignore `**/.env`),换机/重新 clone 后这条后门就没了记录,' +
                  '而下一次 jwt_auth 判据被改动(或有人把剔除逻辑当成"反正会兜住"而删掉)就是既成越权。必须从 .env 删除,或显式认领并走 code review。'
                : '  且 jwt_auth 侧未见强制剔除逻辑 ⇒ 这些条目在运行时**真实匿名可达**,属部署态未收口,须立即处理。',
            ].join('\n'),
      )
      for (const v of envViolations) {
        const attribution =
          v.kind === 'catch-all'
            ? `兜底放行写法 ${v.entry} 命中 _CATCH_ALL_PUBLIC_ENTRIES`
            : `条目 ${v.entry} 命中特权 router 根 ${v.routerRoot}`
        finding(
          'high',
          `JWT_PUBLIC_PATHS(.env 原文)放行特权条目:${v.entry}`,
          `${attribution} —— ${v.reason} ` +
            '实测越权证据(O19):匿名方可 ① GET /api/agents/sessions 列出全站会话 ② POST /api/agents/approval-response 抵达人工审批决策写入点 ' +
            '③ 订阅 /api/agents/tasks/stream 收到他人会话实时工具事件。',
        )
      }
      // 漂移条目逐条认领:.env 多出而代码默认值没有的条目 = 只存在于某台机器的授权决定。
      const privilegedSet = new Set(envViolations.map((v) => v.entry))
      const strayEntries = extra.filter((p) => !privilegedSet.has(String(p).trim()))
      const consumerHits = strayEntries.length > 0 ? scanJsConsumers(strayEntries) : new Map()
      const deadEntries = strayEntries.filter((p) => (consumerHits.get(p) ?? []).length === 0)
      if (strayEntries.length > 0) {
        const lines = strayEntries.map((p) => {
          const hits = consumerHits.get(p) ?? []
          return `  · ${p} → 消费方 ${hits.length === 0 ? '0 个(全仓 ts/tsx/js/mjs 无字面量引用)' : `${hits.length}${hits.length >= 4 ? '+' : ''} 个:${hits.join(', ')}`}`
        })
        add(
          G,
          'OFF-02d',
          '.env 独有的白名单条目须逐条人工认领(全仓无消费方即视为死条目)',
          deadEntries.length === 0 ? 'PASS' : 'FAIL',
          [
            `${OPTS.envFile} 比 config.py 默认值多出 ${strayEntries.length} 条(特权条目已在 OFF-02c 单独判定):`,
            ...lines,
            deadEntries.length > 0
              ? `  ❌ 死条目 ${deadEntries.length} 个:${deadEntries.join(', ')} —— 匿名放行却零调用方,只可能是历史试验残留或后门;"没人用的公开端点"没有任何保留理由。` +
                '请二选一并留痕:① 从 .env 删除;② 若确有消费方(如 Python 内部回调/外部平台 webhook),把它写进 config.py 默认值并在注释注明鉴权方式与理由,让决定进入 git 而不是某台机器。'
              : `  其余条目均有源码消费方,请确认每条在 config.py 默认值一侧有对应登记(${strayEntries.length} 条待双写)。`,
          ].join('\n'),
        )
      }
      const lostDiscovery = dropped.filter((p) => p.startsWith('/.well-known/'))
      if (lostDiscovery.length > 0 && !codeEnforcesAlwaysPublic) {
        add(
          G,
          'OFF-02b',
          'A2A/OAuth 发现文档在运行时 .env 覆盖后仍匿名可读',
          'FAIL',
          `默认白名单里的 ${lostDiscovery.join(', ')} 被 ${OPTS.envFile} 覆盖值丢掉 → 匿名抓取实测 401(LIVE-D01);外部 A2A 客户端在拿到凭据前无法发现本 agent 能力,标准合规失败。覆盖值多出:${extra.join(', ') || '(无)'}`,
        )
      } else {
        add(
          G,
          'OFF-02b',
          'A2A/OAuth 发现文档在运行时 .env 覆盖后仍匿名可读',
          'PASS',
          lostDiscovery.length > 0
            ? `${lostDiscovery.join(', ')} 虽被 .env 覆盖值丢掉,但 jwt_auth._ALWAYS_PUBLIC 恒补齐 ⇒ 运行时仍匿名可读(不再依赖部署 .env 卫生)`
            : `默认 ${publicPaths.filter((p) => p.startsWith('/.well-known/')).join(', ')} 均保留在 .env 覆盖值中`,
        )
      }
      finding(
        dropped.length || extra.length ? 'medium' : 'low',
        `${OPTS.envFile} 的 JWT_PUBLIC_PATHS 与 config.py 默认值已分叉(+${extra.length} / -${dropped.length})`,
        `多出的:${extra.join(', ') || '(无)'};丢掉的:${dropped.join(', ') || '(无)'}` +
          `${deadEntries.length ? `;其中零消费方的死条目:${deadEntries.join(', ')}(见 OFF-02d,必须显式认领)` : ''} ` +
          '—— 白名单是整串替换而非增量,任何一侧的改动都必须双写,否则出现"默认收了权、部署又放开"或"默认放开了、部署又锁死"。',
      )
    }
  }

  // ── OFF-03 MCP 路由层凭据门禁(匿名在生产一律 401)+ 开发回退告警 ──
  const official = read('apps/ai-service/app/routers/mcp_official.py')
  const gate = read('apps/ai-service/app/services/capability_gate.py')
  const hasRouteGate =
    !!official &&
    /@router\.post\("\/mcp"/.test(official) &&
    /resolve_principal_from_headers\(dict\(request\.headers\)\)/.test(official) &&
    /except PrincipalAuthError as e/.test(official)
  add(
    G,
    'OFF-03',
    'MCP JSON-RPC 入口有路由层凭据门禁(POST /api/mcp)',
    hasRouteGate ? 'PASS' : 'FAIL',
    hasRouteGate
      ? 'mcp_official.py:@router.post("/mcp") 调 resolve_principal_from_headers,PrincipalAuthError → JSON-RPC error + 401'
      : '未断言到 POST /api/mcp 的凭据门禁结构(路由改造/判据漂移,需人工确认)',
  )
  if (gate && /return _dev_fallback_principal\(\)/.test(gate) && /role=0/.test(gate)) {
    finding(
      'medium',
      'ai-service MCP 在非生产环境有匿名回退主体(role=0 + ALL_SCOPES)',
      'capability_gate.resolve_principal_from_headers 在 node_env≠production 且无任何凭据时返回 dev 回退主体;开发机匿名 MCP 仍可达(靠权限矩阵兜底),生产必须配 node_env=production —— 在线模式 LIVE-B01 会实测这一点。',
    )
  }

  // ── OFF-04 /v1 无未登记端点(复用守门自身判据,零复刻) ──
  const guard = spawnSync(
    process.execPath,
    [resolve(ROOT, 'scripts/check-capability-catalog.mjs'), '--json'],
    { cwd: ROOT, encoding: 'utf8', windowsHide: true, maxBuffer: 32 << 20, timeout: 300_000 },
  )
  let guardReport = null
  try {
    guardReport = JSON.parse((guard.stdout || '').trim())
  } catch {
    guardReport = null
  }
  if (!guardReport) {
    add(
      G,
      'OFF-04',
      '/v1 无未登记端点',
      'FAIL',
      `check-capability-catalog --json 未能给出结论(exit=${guard.status}):${(guard.stderr || '').split('\n')[0] ?? ''}`,
    )
  } else {
    const blocking = guardReport.failures.filter((f) => f.code !== 'REGENERATE_HINT')
    add(
      G,
      'OFF-04',
      '/v1 无未登记端点(每个 handler 都接能力闸)',
      blocking.length === 0 && guardReport.stats.uncovered === 0 ? 'PASS' : 'FAIL',
      `扫 ${guardReport.stats.filesScanned} 个 v1 路由文件 / ${guardReport.stats.handlers} handler → 已覆盖 ${guardReport.stats.covered},未覆盖 ${guardReport.stats.uncovered};未知 scope ${guardReport.stats.unknownScopes} / platform 泄漏 ${guardReport.stats.platformLeaks};产物一致 ${guardReport.stats.catalogScopes}↔${guardReport.stats.artifactScopes}`,
    )
    if (blocking.length > 0) {
      for (const f of blocking.slice(0, 6))
        finding('high', `能力目录守门失败 [${f.code}]`, f.message)
    }
    const warnCodes = new Map()
    for (const w of guardReport.warnings ?? [])
      warnCodes.set(w.code, (warnCodes.get(w.code) ?? 0) + 1)
    if (warnCodes.size > 0) {
      finding(
        'low',
        '能力目录守门告警(非阻塞,但代表文档/登记腐化)',
        [...warnCodes.entries()].map(([c, n]) => `${c}×${n}`).join(' / ') +
          ' —— DECLARED_ROUTE_NOT_FOUND = 目录声明了代码里不存在的路由(下线/改名未回收)。',
      )
    }
  }

  // ── OFF-05 判据引擎自证:守门 self-test ──
  const selfTest = spawnSync(
    process.execPath,
    [resolve(ROOT, 'scripts/check-capability-catalog.mjs'), '--self-test'],
    { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120_000 },
  )
  add(
    G,
    'OFF-05',
    '能力闸判据引擎自证(check-capability-catalog --self-test)',
    selfTest.status === 0 ? 'PASS' : 'FAIL',
    selfTest.status === 0
      ? '覆盖判定/产物比对/platform 泄漏检测逻辑正常'
      : `self-test exit=${selfTest.status}:${(selfTest.stdout || '').split('\n').filter((l) => l.includes('❌'))[0] ?? (selfTest.stderr || '').split('\n')[0]}`,
  )

  // ── OFF-06 MCP 网关(v1-mcp-gateway.ts)接闸 + scope 可对机器开放 ──
  // §22c:直接 import 守门导出的核心判据,不复刻解析逻辑。
  let mcpFileVerdict = {
    status: 'FAIL',
    detail: '无法加载 check-capability-catalog 的 __test__ 导出',
  }
  try {
    const modPath = resolve(ROOT, 'scripts/check-capability-catalog.mjs')
    const { __test__ } = await import(pathToFileURL(modPath).href)
    const rel = 'apps/api/src/routes/v1-mcp-gateway.ts'
    const src = read(rel)
    if (!src) throw new Error(`读不到 ${rel}`)
    const analysis = __test__.analyzeRouteFile({ relPath: rel, source: src, prefixes: [''] })
    const scopes = [...new Set(analysis.guardScopes.map((g) => g.scope))]
    const allM2M = scopes.length > 0 && scopes.every((s) => m2mAllowedOf(s))
    mcpFileVerdict = {
      status: analysis.uncovered.length === 0 && allM2M ? 'PASS' : 'FAIL',
      detail: `${rel}: ${analysis.handlers.length} handler / 未覆盖 ${analysis.uncovered.length};规则表 scope ${scopes.join(', ') || '(空)'} —— ${allM2M ? '全部 isM2MAllowed' : '存在不可对机器凭据开放的 scope'}`,
    }
  } catch (e) {
    mcpFileVerdict = { status: 'FAIL', detail: `断言异常:${String(e?.message ?? e)}` }
  }
  add(
    G,
    'OFF-06',
    '/v1/mcp/* 网关全量接能力闸且 scope 可对机器开放',
    mcpFileVerdict.status,
    mcpFileVerdict.detail,
  )

  // ── OFF-07 /api 登记表:无通配 + 全在 /api 下 + 参数段合法 + (方法,路径) 唯一 ──
  const registrySrc = read('apps/api/src/config/open-capability-registry.ts')
  const entries = parseOpenRegistry(registrySrc)
  if (!entries || entries.length === 0) {
    add(
      G,
      'OFF-07',
      '/api 能力开放登记表结构(无通配)',
      'FAIL',
      '解析不到 config/open-capability-registry.ts 的 DECLARATIONS(结构变了,判据需同步)',
    )
  } else {
    const problems = []
    const seen = new Map()
    let routeCount = 0
    for (const e of entries) {
      for (const p of e.paths) {
        routeCount += 1
        if (!p.startsWith('/api/')) problems.push(`${e.key}: ${p} 不在 /api/ 下`)
        if (p.includes('*')) problems.push(`${e.key}: ${p} 含通配 "*"`)
        for (const seg of p.split('/')) {
          if (seg.includes(':') && !/^:[A-Za-z_][A-Za-z0-9_]*$/.test(seg))
            problems.push(`${e.key}: ${p} 参数段 ${seg} 非法`)
        }
        for (const m of e.methods.length ? e.methods : ['*']) {
          const id = `${m} ${p}`
          if (seen.has(id)) problems.push(`${id} 被 ${seen.get(id)} 与 ${e.key} 重复登记`)
          else seen.set(id, e.key)
        }
      }
    }
    add(
      G,
      'OFF-07',
      '/api 登记表逐条精确路径、无通配(默认拒绝不允许前缀继承)',
      problems.length === 0 ? 'PASS' : 'FAIL',
      problems.length === 0
        ? `${entries.length} 条目 / ${routeCount} 条 (方法,路径),全部 /api/ 前缀 + 精确或 :param 单段,无 "*"`
        : problems.slice(0, 8).join(' | '),
    )

    // ── OFF-08 登记表 scope 必须可对机器凭据开放 ──
    const bad = entries.filter((e) => !m2mAllowedOf(e.scope))
    add(
      G,
      'OFF-08',
      '登记表引用的 scope 均 isM2MAllowed(platform / 不可申请一律不得进表)',
      bad.length === 0 ? 'PASS' : 'FAIL',
      bad.length === 0
        ? `${[...new Set(entries.map((e) => e.scope))].join(', ')} 全部通过(引擎=${REAL.engine})`
        : `违规条目:${bad.map((e) => `${e.key}→${e.scope}`).join(', ')}(与 assertScopeOpenable 的启动期抛错同口径)`,
    )
  }

  // ── OFF-09 新建 key 默认权限不含 chat:write ──
  const srcDefaults = /DEFAULT_API_KEY_PERMISSIONS\s*=\s*\[([^\]]*)\]/.exec(
    read('packages/types/src/api-key.ts') ?? '',
  )
  const parsedDefaults = srcDefaults
    ? [...srcDefaults[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
    : null
  const defaults = REAL.defaults ?? parsedDefaults ?? null
  if (!defaults) {
    add(
      G,
      'OFF-09',
      '新建 API Key 默认权限不含 chat:write',
      'FAIL',
      '既调不到真实常量也解析不到源码字面量',
    )
  } else {
    add(
      G,
      'OFF-09',
      '新建 API Key 默认权限不含 chat:write(写能力必须显式授予)',
      defaults.includes('chat:write') ? 'FAIL' : 'PASS',
      `DEFAULT_API_KEY_PERMISSIONS = [${defaults.join(', ')}]${REAL.defaults ? '(真实常量)' : '(源码字面量推导)'};逐项 isM2MAllowed:${defaults.map((d) => `${d}=${m2mAllowedOf(d)}`).join(', ')}`,
    )
    const distKey = read('packages/types/dist/api-key.js')
    if (distKey && /DEFAULT_API_KEY_PERMISSIONS\s*=\s*\[[^\]]*chat:write/.test(distKey)) {
      finding(
        'high',
        '本机 packages/types/dist 陈旧:编译产物仍把 chat:write 发给新 key',
        '源码已收紧为 models:read,但 dist/api-key.js 仍是 [chat:write, models:read](dist 不入库,属本机构建缓存陈旧)。运行期以 `@ihui/types` → dist 解析的进程(含 apps/api dev)会按旧默认值发权限;需重跑 pnpm --filter @ihui/types build。',
      )
    }
  }

  // ── OFF-10 platform / 不可申请 scope 不被 '*' 穿透 ──
  const forbidden = platformishScopes()
  const leaked = forbidden.filter((e) => m2mAllowedOf(e.scope))
  const guardSrc = read('apps/api/src/utils/capability-guard.ts') ?? ''
  const authSrc = read('apps/api/src/plugins/api-key-auth.ts') ?? ''
  const m2mBeforeWildcard =
    guardSrc.indexOf('if (!isM2MAllowed(scope))') >= 0 &&
    guardSrc.indexOf("granted.includes('*')") > guardSrc.indexOf('if (!isM2MAllowed(scope))')
  const wildcardNarrowed =
    /coveredByWildcard\s*=\s*permList\.includes\('\*'\)\s*&&\s*isScopeThirdPartyEligible\(perm\)/.test(
      authSrc,
    )
  add(
    G,
    'OFF-10',
    "platform / thirdPartyEligible=false 的 scope 不会被 '*' 通配穿透",
    leaked.length === 0 && m2mBeforeWildcard && wildcardNarrowed ? 'PASS' : 'FAIL',
    `目录内 platform/不可申请共 ${forbidden.length} 个(${forbidden
      .slice(0, 6)
      .map((e) => e.scope)
      .join(
        ', ',
      )}…)全部 isM2MAllowed=false;闸内 M2M 判定先于 '*' 放行=${m2mBeforeWildcard};requireApiKeyPermission 的 '*' 已收窄为「目录内且 thirdPartyEligible」=${wildcardNarrowed}`,
  )
  if (REAL.scopes && REAL.unknownScopeAllowed) {
    add(
      G,
      'OFF-10b',
      '未登记 scope 一律拒(真实 isM2MAllowed("nope:read"))',
      'FAIL',
      '未登记 scope 被判为可对机器开放 = 默认放行漏洞',
    )
  } else if (REAL.scopes) {
    add(
      G,
      'OFF-10b',
      '未登记 scope 一律拒(真实 isM2MAllowed("nope:read")=false)',
      'PASS',
      '默认拒绝,未登记不进 M2M 白名单',
    )
  }

  // ── OFF-11 scoped-* 走受控出口 ──
  const hits = countScopedCallSites(
    resolve(ROOT, 'apps/api/src'),
    new Set(['db/index.ts', 'utils/scoped-guard.ts']),
  )
  add(
    G,
    'OFF-11',
    '数据闸受控出口 dbScoped/dbReadScoped 真实调用点 ≥ 5',
    hits.length >= 5 ? 'PASS' : 'FAIL',
    `调用点 ${hits.length} 处(${[...new Set(hits)].join(', ')})—— 判定口径同 apps/api/tests/o4-route-wiring.test.ts(剥注释、排 import、排闸实现文件)`,
  )
  const scopedDataClasses = MANIFEST.capabilities.filter(
    (c) => c.dataClass === 'scoped-read' || c.dataClass === 'scoped-write',
  )
  add(
    G,
    'OFF-11b',
    'scoped-* 能力存在且带 owner 过滤语义(登记数)',
    scopedDataClasses.length > 0 ? 'PASS' : 'FAIL',
    `scoped-read/scoped-write 共 ${scopedDataClasses.length} 个 scope;compute 类 ${MANIFEST.capabilities.filter((c) => c.dataClass === 'compute').length} 个(只出算力、DB 模式 self-metadata)`,
  )

  // ── OFF-12 「数据不开放」静态可证部分 ──
  const chatEntry = manifestIndex.get('chat:write')
  const scopeRequiredBranch = /errorCode:\s*'SCOPE_REQUIRED'/.test(guardSrc)
  add(
    G,
    'OFF-12',
    'chat:write 端点必须显式授予(默认 key 打不到 → 403 SCOPE_REQUIRED 的代码路径存在)',
    chatEntry && Array.isArray(defaults) && !defaults.includes('chat:write') && scopeRequiredBranch
      ? 'PASS'
      : 'FAIL',
    `chat:write dataClass=${chatEntry?.dataClass ?? '(未登记)'},thirdPartyEligible=${chatEntry?.thirdPartyEligible};默认权限集 [${(defaults ?? []).join(', ')}] 不含它;闸内缺 scope 即 403 SCOPE_REQUIRED 分支=${scopeRequiredBranch}`,
  )

  // ── OFF-13 /api 面默认拒绝(未登记路径不注入机器授权) ──
  const gateSrc = read('apps/api/src/utils/open-capability-gate.ts') ?? ''
  const denyBranch =
    /findOpenCapability\(request\.method,\s*urlPath\(request\.url\)\)/.test(gateSrc) &&
    /if \(!entry\)\s*return/.test(gateSrc)
  add(
    G,
    'OFF-13',
    '未登记 /api 路径带机器凭据 = 默认拒绝(不注入 openCapability,端点自身 401)',
    denyBranch ? 'PASS' : 'FAIL',
    denyBranch
      ? `utils/open-capability-gate.ts:根级 preHandler 未命中登记表即 return(不放行);人 JWT 通道行为不变;在线用例 LIVE-A06 实测`
      : 'open-capability-gate 的默认拒绝分支结构变了,判据需人工复核',
  )

  // ── OFF-14 OAuth 根路径是否在 CSRF 公开白名单内(决定外部 Agent 能否真建客户端) ──
  const csrfSrc = read('apps/api/src/plugins/csrf.ts') ?? ''
  const publicBlock = /const PUBLIC_PREFIXES\s*=\s*\[([\s\S]*?)\n\]/.exec(csrfSrc)
  const prefixes = publicBlock ? [...publicBlock[1].matchAll(/'([^']+)'/g)].map((m) => m[1]) : []
  const dcrPath = /server\.post\(\s*'\/oauth\/register'/.test(
    read('apps/api/src/routes/oauth-register.ts') ?? '',
  )
  const tokenPath = /server\.post\(\s*'\/oauth\/token'/.test(
    read('apps/api/src/routes/oauth-tokens.ts') ?? '',
  )
  const covered = prefixes.some(
    (p) => '/oauth/register'.startsWith(p) || '/oauth/token'.startsWith(p),
  )
  add(
    G,
    'OFF-14',
    'OAuth DCR/token 根路径在 CSRF 公开白名单内(非浏览器客户端可达)',
    dcrPath && tokenPath && covered ? 'PASS' : 'FAIL',
    `路由注册于 /oauth/register + /oauth/token(非 /api/ 前缀);CSRF PUBLIC_PREFIXES 共 ${prefixes.length} 项,其中 OAuth 相关 = ${prefixes.filter((p) => /oauth/i.test(p)).join(', ') || '(无)'} → 未覆盖根路径;CSRF 只对 GET/HEAD/OPTIONS、Bearer、auth_token cookie、内部服务头豁免,纯机器客户端默认拿不到 token`,
  )
  if (!covered) {
    finding(
      'high',
      'OAuth 通道被 CSRF 闸挡死:白名单写的是 /api/oauth/,而端点注册在 /oauth/*',
      '实测(在线模式)LIVE-C02/LIVE-C03:POST /oauth/register 与 /oauth/token 一律 403「CSRF 令牌缺失或无效」;而 /api/oauth/token 根本不存在(404)。副作用:带任意 `Authorization: Bearer <乱值>` 反而能过 CSRF 并成功注册客户端 —— 豁免条件形同可被绕过,既挡了正当客户端又给了绕道口子。修法(未改生产代码,仅记录):把 /oauth/register、/oauth/token 加进 CSRF 公开白名单(或按「无 auth_token cookie 且无 Bearer 即视为非浏览器请求」判定)。',
    )
  }
}

// ═════════════════════════════════ 在线模式 ═════════════════════════════════
/** @returns {Promise<{status:number|null,json:any,text:string,ms:number,error:string|null}>} */
async function http(method, url, { headers = {}, body, form } = {}) {
  const t0 = Date.now()
  const h = { Accept: 'application/json', Connection: 'close', ...headers }
  let payload
  if (form) {
    h['Content-Type'] = 'application/x-www-form-urlencoded'
    payload = new URLSearchParams(form).toString()
  } else if (body !== undefined) {
    h['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  try {
    const resp = await fetch(url, {
      method,
      headers: h,
      body: payload,
      signal: AbortSignal.timeout(OPTS.timeoutMs),
    })
    const text = await resp.text()
    let json = null
    try {
      json = JSON.parse(text)
    } catch {
      json = null
    }
    return { status: resp.status, json, text, ms: Date.now() - t0, error: null }
  } catch (e) {
    return {
      status: null,
      json: null,
      text: '',
      ms: Date.now() - t0,
      error: `${e?.name ?? 'Error'}:${e?.cause?.code ?? e?.message ?? ''}`,
    }
  }
}

/** 依次试多个健康路径(Fastify 用 /health,ai-service 同样挂在根 /health,/api/health 是 404)。 */
async function probeAny(base, paths) {
  let last = null
  for (const p of paths) {
    const r = await http('GET', base + p)
    if (r.status !== null && r.status < 500)
      return { online: true, detail: `GET ${p} → HTTP ${r.status} in ${r.ms}ms` }
    last = r.error ? `${p}: ${r.error}` : `${p}: HTTP ${r.status}`
  }
  return { online: false, detail: `探测失败(${paths.length} 个路径全不可用)—— 最后一次:${last}` }
}

function keyHeaders(extra = {}) {
  const h = { Authorization: `Bearer ${OPTS.apiKey}`, ...extra }
  if (OPTS.apiSecret) h['X-Api-Secret'] = OPTS.apiSecret
  return h
}

/** 机器凭据被拒时,响应体不得泄漏内部 SQL / 提交的凭据(O17 实测重点)。 */
function leakCheck(label, r) {
  const text = r.text ?? ''
  const sql = /\bFailed query\b|select\s+"[a-z_]+"[^"]*from\s+"[a-z_]+"/i.test(text)
  const cred = OPTS.apiKey ? text.includes(OPTS.apiKey) : false
  if (sql || cred) {
    return `${label}: 响应体泄漏${sql ? ' 内部 SQL/表结构' : ''}${cred ? ' + 提交的凭据' : ''} —— ${text.slice(0, 160).replace(/\s+/g, ' ')}`
  }
  return null
}

const rpc = (id, method, params) => ({ jsonrpc: '2.0', id, method, params })

async function runLiveChecks(api, ai) {
  const hasKey = !!OPTS.apiKey
  const hasSecret = !!OPTS.apiSecret
  const hasJwt = !!OPTS.jwt

  // ── A 组:OpenAI 兼容面 ──
  const A = (id, title) => ({ group: 'live:openai', id, title, service: api })
  const aCases = []

  aCases.push({
    ...A('LIVE-A01', '匿名 GET /v1/models 必须被拒(401)'),
    needsCred: 'none',
    run: async () => {
      const r = await http('GET', `${OPTS.apiUrl}/v1/models`)
      if (r.status === null) return ['SKIP', `请求失败:${r.error}`]
      const leak = leakCheck('匿名 /v1/models', r)
      if (r.status !== 401 && r.status !== 403)
        return ['FAIL', `实际 HTTP ${r.status}(期望 401/403):${r.text.slice(0, 160)}`]
      if (leak) return ['FAIL', `401 正确但${leak}`]
      return [
        'PASS',
        `HTTP ${r.status} ${JSON.stringify(r.json?.message ?? r.json?.error ?? '').slice(0, 80)}(${r.ms}ms)`,
      ]
    },
  })

  aCases.push({
    ...A('LIVE-A02', '无效 ihui_ key 不得泄漏内部 SQL/凭据(401 且错误体脱敏)'),
    needsCred: 'none',
    run: async () => {
      const bogus = 'ihui_'.padEnd(37, '0')
      const r = await http('GET', `${OPTS.apiUrl}/v1/models`, {
        headers: { Authorization: `Bearer ${bogus}` },
      })
      if (r.status === null) return ['SKIP', `请求失败:${r.error}`]
      const body = r.text ?? ''
      const leaks = /\bFailed query\b|select\s+"[a-z_]+"/i.test(body) || body.includes(bogus)
      if (r.status !== 401) return ['FAIL', `无效 key 未被拒(HTTP ${r.status})`]
      if (leaks) {
        return [
          'FAIL',
          `HTTP 401 正确,但响应体把内部 SQL 语句与提交的凭据原样回显:${body.slice(0, 140).replace(/\s+/g, ' ')}…`,
        ]
      }
      return ['PASS', 'HTTP 401 且错误体未含 SQL/凭据']
    },
  })

  aCases.push({
    ...A('LIVE-A03', '带 ihui_ key 但缺 X-Api-Secret → 401 SECRET_REQUIRED(双因子默认必开)'),
    needsCred: 'key',
    run: async () => {
      const r = await http('GET', `${OPTS.apiUrl}/v1/models`, {
        headers: { Authorization: `Bearer ${OPTS.apiKey}` },
      })
      const hit = r.status === 401 && /SECRET_REQUIRED|X-Api-Secret/i.test(r.text)
      return hit
        ? [
            'PASS',
            `HTTP 401 + ${r.json?.errorCode ?? r.json?.code ?? ''} ${(r.json?.message ?? '').slice(0, 60)}`,
          ]
        : ['FAIL', `期望 401 SECRET_REQUIRED,实际 HTTP ${r.status}:${r.text.slice(0, 140)}`]
    },
  })

  aCases.push({
    ...A('LIVE-A04', '合法 key(含 models:read)GET /v1/models → 200 且是 OpenAI 形状'),
    needsCred: 'key+secret',
    run: async () => {
      const r = await http('GET', `${OPTS.apiUrl}/v1/models`, { headers: keyHeaders() })
      if (r.status === null) return ['SKIP', `请求失败:${r.error}`]
      if (r.status !== 200) {
        const why = /\bFailed query\b/i.test(r.text)
          ? ' —— 服务端 DB 不可用(dev 环境连不上/表缺失),属环境故障非鉴权结论'
          : ''
        return ['FAIL', `HTTP ${r.status}:${r.text.slice(0, 140)}${why}`]
      }
      const data = Array.isArray(r.json?.data) ? r.json.data : []
      const shape =
        r.json?.object === 'list' &&
        data.every((m) => m && typeof m.id === 'string' && (m.object ?? 'model') === 'model')
      return shape
        ? [
            'PASS',
            `object=list / ${data.length} 个模型,字段 {id,object,created,owned_by} 兼容 openai SDK;client=raw-openai-wire`,
          ]
        : ['FAIL', `HTTP 200 但形状不是 OpenAI 兼容:${JSON.stringify(r.json).slice(0, 160)}`]
    },
  })

  aCases.push({
    ...A(
      'LIVE-A05',
      '仅 models:read 的 key 打 POST /v1/chat/completions → 403 SCOPE_REQUIRED(数据/计费不越权)',
    ),
    needsCred: 'key+secret',
    run: async () => {
      const r = await http('POST', `${OPTS.apiUrl}/v1/chat/completions`, {
        headers: keyHeaders(),
        body: {
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
        },
      })
      if (r.status === null) return ['SKIP', `请求失败:${r.error}`]
      if (
        r.status === 403 &&
        (r.json?.errorCode === 'SCOPE_REQUIRED' || r.json?.requiredScope === 'chat:write')
      ) {
        return [
          'PASS',
          `HTTP 403 errorCode=${r.json.errorCode} requiredScope=${r.json.requiredScope}`,
        ]
      }
      if (r.status === 200) {
        return [
          'FAIL',
          'HTTP 200 —— 所给 key 实际持有 chat:write(不是 models:read-only key),断言前提不成立;请换一把只授 models:read 的 key 复跑',
        ]
      }
      return ['FAIL', `期望 403 SCOPE_REQUIRED,实际 HTTP ${r.status}:${r.text.slice(0, 140)}`]
    },
  })

  aCases.push({
    ...A('LIVE-A06', `未登记 /api 路径带合法 key(${OPTS.unregisteredApiPath})→ 401(默认拒绝)`),
    needsCred: 'key+secret',
    run: async () => {
      const r = await http('GET', `${OPTS.apiUrl}${OPTS.unregisteredApiPath}`, {
        headers: keyHeaders(),
      })
      if (r.status === null) return ['SKIP', `请求失败:${r.error}`]
      if (r.status === 404)
        return [
          'FAIL',
          `HTTP 404 —— 该路径当前不存在,无法证明默认拒绝;用 --unregistered-path 指定一条真实存在的 /api 路由`,
        ]
      return r.status === 401
        ? [
            'PASS',
            `HTTP 401 ${(r.json?.message ?? '').slice(0, 60)}(机器凭据未获登记表放行,端点自身按人通道鉴权拒绝)`,
          ]
        : ['FAIL', `期望 401,实际 HTTP ${r.status}:${r.text.slice(0, 140)}`]
    },
  })

  aCases.push({
    ...A(
      'LIVE-A07',
      `正向对照:登记表已放行的 ${OPTS.registeredApiPath} 带 key 不得 401(只能 200 或 403 scope)`,
    ),
    needsCred: 'key+secret',
    run: async () => {
      const r = await http('GET', `${OPTS.apiUrl}${OPTS.registeredApiPath}`, {
        headers: keyHeaders(),
      })
      if (r.status === null) return ['SKIP', `请求失败:${r.error}`]
      if (r.status === 401) {
        const db = /\bFailed query\b/i.test(r.text)
        return [
          'FAIL',
          `HTTP 401 —— 登记过的机器通道未放行${db ? '(服务端 DB 查询失败,见响应体;属环境故障)' : ''}:${r.text.slice(0, 120)}`,
        ]
      }
      if (r.status === 200 || r.status === 403) {
        return [
          'PASS',
          `HTTP ${r.status} ${r.status === 403 ? `(缺 scope:${r.json?.errorCode ?? ''} ${r.json?.requiredScope ?? ''})` : '(已进入业务面)'} —— 证明"登记=可进,未登记=拒"`,
        ]
      }
      return ['FAIL', `期望 200/403,实际 HTTP ${r.status}:${r.text.slice(0, 140)}`]
    },
  })

  aCases.push({
    ...A('LIVE-A08', 'MCP 网关 GET /v1/mcp/tools 匿名必须 401'),
    needsCred: 'none',
    run: async () => {
      const r = await http('GET', `${OPTS.apiUrl}/v1/mcp/tools`)
      if (r.status === null) return ['SKIP', `请求失败:${r.error}`]
      return r.status === 401 || r.status === 403
        ? ['PASS', `HTTP ${r.status} ${(r.json?.message ?? '').slice(0, 60)}`]
        : ['FAIL', `期望 401/403,实际 HTTP ${r.status}:${r.text.slice(0, 140)}`]
    },
  })

  aCases.push({
    ...A('LIVE-A09', 'MCP 网关带 key GET /v1/mcp/tools → 200 或 403(缺 tools:read),不得 401'),
    needsCred: 'key+secret',
    run: async () => {
      const r = await http('GET', `${OPTS.apiUrl}/v1/mcp/tools`, { headers: keyHeaders() })
      if (r.status === null) return ['SKIP', `请求失败:${r.error}`]
      if (r.status === 200) {
        const n = Array.isArray(r.json?.data?.tools) ? r.json.data.tools.length : null
        return ['PASS', `HTTP 200${n === null ? '' : ` / ${n} 个工具`}(tools:read 通道打通)`]
      }
      if (r.status === 403)
        return [
          'PASS',
          `HTTP 403 ${r.json?.errorCode ?? ''} —— 已进闸但 scope/白名单不足,机器通道本身可达`,
        ]
      return ['FAIL', `期望 200/403,实际 HTTP ${r.status}:${r.text.slice(0, 140)}`]
    },
  })

  // ── B 组:ai-service 官方 MCP JSON-RPC ──
  const B = (id, title) => ({ group: 'live:mcp-jsonrpc', id, title, service: ai })
  const bCases = []

  bCases.push({
    ...B('LIVE-B01', '匿名 POST /api/mcp initialize 必须被拒(401/403)—— O1 收权回归点'),
    needsCred: 'none',
    run: async () => {
      const r = await http('POST', `${OPTS.aiUrl}/api/mcp`, {
        body: rpc(1, 'initialize', {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'o17-probe', version: '1' },
        }),
      })
      if (r.status === null) return ['SKIP', `请求失败:${r.error}`]
      if (r.status === 401 || r.status === 403) {
        return [
          'PASS',
          `HTTP ${r.status} JSON-RPC error:${(r.json?.error?.message ?? '').slice(0, 90)}`,
        ]
      }
      return [
        'FAIL',
        `HTTP ${r.status} —— 匿名 MCP 仍可握手(${r.json?.result?.serverInfo?.name ?? '无 serverInfo'});非生产环境的 dev 回退主体在放行,生产必须 node_env=production`,
      ]
    },
  })

  bCases.push({
    ...B(
      'LIVE-B02',
      '机器凭据(ihui_ key)直连 ai-service /api/mcp 必须 401(机器通道只走 apps/api 网关)',
    ),
    needsCred: 'key',
    run: async () => {
      const r = await http('POST', `${OPTS.aiUrl}/api/mcp`, {
        headers: { Authorization: `Bearer ${OPTS.apiKey}` },
        body: rpc(1, 'initialize', {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'o17-probe', version: '1' },
        }),
      })
      if (r.status === null) return ['SKIP', `请求失败:${r.error}`]
      return r.status === 401 || r.status === 403
        ? ['PASS', `HTTP ${r.status}:${(r.json?.error?.message ?? '').slice(0, 90)}`]
        : ['FAIL', `期望 401/403,实际 HTTP ${r.status}:${r.text.slice(0, 140)}`]
    },
  })

  bCases.push({
    ...B('LIVE-B03', '人通道 JWT:initialize → tools/list → tools/call 全链路 200'),
    needsCred: 'jwt',
    run: async () => {
      const headers = { Authorization: `Bearer ${OPTS.jwt}` }
      const init = await http('POST', `${OPTS.aiUrl}/api/mcp`, {
        headers,
        body: rpc(1, 'initialize', {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'o17-probe', version: '1' },
        }),
      })
      if (init.status !== 200)
        return ['FAIL', `initialize HTTP ${init.status}:${init.text.slice(0, 140)}`]
      const proto = init.json?.result?.protocolVersion
      const list = await http('POST', `${OPTS.aiUrl}/api/mcp`, {
        headers,
        body: rpc(2, 'tools/list', {}),
      })
      const tools = Array.isArray(list.json?.result?.tools) ? list.json.result.tools : null
      if (list.status !== 200 || !tools)
        return ['FAIL', `tools/list HTTP ${list.status}:${list.text.slice(0, 140)}`]
      const pick = tools.find((t) => t?.name === 'list_skills') ?? tools[0]
      const call = await http('POST', `${OPTS.aiUrl}/api/mcp`, {
        headers,
        body: rpc(3, 'tools/call', { name: pick.name, arguments: {} }),
      })
      const called =
        call.status === 200 && (call.json?.result ?? null) !== null && call.json?.error == null
      const detail = `initialize→${proto} / tools=${tools.length} / tools/call(${pick.name}) HTTP ${call.status}${call.json?.error ? ` error=${JSON.stringify(call.json.error).slice(0, 90)}` : ''}`
      if (called) return ['PASS', detail]
      return ['FAIL', `三步未全通:${detail}`]
    },
  })

  // ── C 组:OAuth DCR ──
  const C = (id, title) => ({ group: 'live:oauth-dcr', id, title, service: api })
  const cCases = []
  let dcr = { clientId: null, clientSecret: null }

  cCases.push({
    ...C('LIVE-C01', 'GET /.well-known/oauth-authorization-server 元数据完整(RFC 8414)'),
    needsCred: 'none',
    run: async () => {
      const r = await http('GET', `${OPTS.apiUrl}/.well-known/oauth-authorization-server`)
      if (r.status === null) return ['SKIP', `请求失败:${r.error}`]
      const need = [
        'issuer',
        'token_endpoint',
        'registration_endpoint',
        'response_types_supported',
        'grant_types_supported',
      ]
      const missing = r.status === 200 ? need.filter((k) => r.json?.[k] === undefined) : need
      if (missing.length)
        return ['FAIL', `HTTP ${r.status},缺字段 ${missing.join(', ') || r.text.slice(0, 120)}`]
      return [
        'PASS',
        `issuer=${r.json.issuer} token=${r.json.token_endpoint} register=${r.json.registration_endpoint}`,
      ]
    },
  })

  cCases.push({
    ...C(
      'LIVE-C02',
      'POST /oauth/register 建机密客户端(loopback redirect + client_credentials)→ 201 + client_id/secret',
    ),
    needsCred: 'none',
    run: async () => {
      const stamp = new Date()
        .toISOString()
        .replace(/[-:.TZ]/g, '')
        .slice(0, 17)
      const meta = (name) => ({
        client_name: name,
        redirect_uris: ['http://127.0.0.1:4319/callback'],
        grant_types: ['authorization_code', 'client_credentials'],
        response_types: ['code'],
        token_endpoint_auth_method: 'client_secret_post',
        scope: 'read:profile',
      })
      const plain = await http('POST', `${OPTS.apiUrl}/oauth/register`, {
        body: meta(`o17-agent-access-${stamp}`),
      })
      if (plain.status === null) return ['SKIP', `请求失败:${plain.error}`]
      if (plain.status === 429)
        return ['SKIP', 'DCR 限流 10 次/小时/IP 已耗尽(本脚本每次探测都吃配额),等窗口过后复跑']
      const csrfBlocked = plain.status === 403 && /CSRF/.test(plain.text)
      if (csrfBlocked) {
        const bypass = await http('POST', `${OPTS.apiUrl}/oauth/register`, {
          headers: { Authorization: 'Bearer not-a-real-token' },
          body: meta(`o17-agent-access-bypass-${stamp}`),
        })
        dcr =
          bypass.status === 201 || bypass.status === 200
            ? {
                clientId: bypass.json?.client_id ?? null,
                clientSecret: bypass.json?.client_secret ?? null,
              }
            : { clientId: null, clientSecret: null }
        return [
          'FAIL',
          `HTTP 403「CSRF 令牌缺失或无效」—— 标准 RFC 7591 客户端不带任何 Authorization 头,被 CSRF 闸挡死(CSRF 白名单只有 /api/oauth/,端点却注册在 /oauth/*)。同请求带一个假 Bearer 头反而 HTTP ${bypass.status}${dcr.clientId ? ` 并建成 client_id=${dcr.clientId.slice(0, 12)}…` : ''} —— 豁免条件可被任意 Bearer 值绕过,既挡正当客户端又留绕道口。`,
        ]
      }
      if (plain.status !== 201 && plain.status !== 200)
        return ['FAIL', `HTTP ${plain.status}:${plain.text.slice(0, 160)}`]
      if (!plain.json?.client_id || !plain.json?.client_secret) {
        return [
          'FAIL',
          `HTTP ${plain.status} 但缺 client_id/client_secret:${JSON.stringify(plain.json).slice(0, 160)}`,
        ]
      }
      dcr = { clientId: plain.json.client_id, clientSecret: plain.json.client_secret }
      return [
        'PASS',
        `HTTP ${plain.status} client_id=${plain.json.client_id.slice(0, 12)}… client_secret=${mask(plain.json.client_secret)} auth_method=${plain.json.token_endpoint_auth_method}`,
      ]
    },
  })

  cCases.push({
    ...C('LIVE-C03', '用 DCR 拿到的 client 凭 client_credentials 换 access_token(RFC 6749 §4.4)'),
    needsCred: 'dcr',
    run: async () => {
      const body = {
        grant_type: 'client_credentials',
        scope: 'read:profile',
        client_id: dcr.clientId,
        client_secret: dcr.clientSecret,
      }
      const post = await http('POST', `${OPTS.apiUrl}/oauth/token`, {
        headers: { Authorization: 'Bearer csrf-exempt-placeholder' },
        body,
      })
      if (post.status === null) return ['SKIP', `请求失败:${post.error}`]
      if (
        post.status === 200 &&
        typeof post.json?.access_token === 'string' &&
        post.json?.token_type
      ) {
        return [
          'PASS',
          `HTTP 200 token_type=${post.json.token_type} expires_in=${post.json.expires_in} jwt_parts=${post.json.access_token.split('.').length} scope=${post.json.scope ?? '-'}(注:带占位 Bearer 头才过 CSRF)`,
        ]
      }
      const basic = Buffer.from(
        `${encodeURIComponent(dcr.clientId)}:${encodeURIComponent(dcr.clientSecret)}`,
      ).toString('base64')
      const viaBasic = await http('POST', `${OPTS.apiUrl}/oauth/token`, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basic}`,
        },
        form: { grant_type: 'client_credentials', scope: 'read:profile' },
      })
      return [
        'FAIL',
        `client_credentials 换令牌失败 —— client_secret_post HTTP ${post.status}:${(post.json?.error_description ?? post.text ?? '').slice(0, 90)};client_secret_basic HTTP ${viaBasic.status}:${(viaBasic.json?.error_description ?? viaBasic.json?.message ?? viaBasic.text ?? '').slice(0, 90)}。新注册客户端被判 invalid_client 说明 DCR 写入的 secret 摘要与校验链不同代次(或 CSRF 先挡),外部 Agent 无法只靠 DCR 拿到令牌`,
      ]
    },
  })

  cCases.push({
    ...C('LIVE-C04', '公开客户端不得用 client_credentials(RFC 7591 收窄,防自签机器身份)'),
    needsCred: 'none',
    run: async () => {
      const body = {
        client_name: `o17-public-negative-${Date.now()}`,
        token_endpoint_auth_method: 'none',
        grant_types: ['client_credentials'],
      }
      let r = await http('POST', `${OPTS.apiUrl}/oauth/register`, { body })
      if (r.status === null) return ['SKIP', `请求失败:${r.error}`]
      if (r.status === 429) return ['SKIP', 'DCR 限流 10 次/小时/IP 已耗尽,等窗口过后复跑']
      if (r.status === 403 && /CSRF/.test(r.text)) {
        r = await http('POST', `${OPTS.apiUrl}/oauth/register`, {
          headers: { Authorization: 'Bearer csrf-exempt-placeholder' },
          body,
        })
        if (r.status === null) return ['SKIP', `重试请求失败:${r.error}`]
      }
      if (r.json?.error) {
        return r.status >= 400 && r.status < 500
          ? [
              'PASS',
              `HTTP ${r.status} error=${r.json.error} desc=${(r.json.error_description ?? '').slice(0, 70)}`,
            ]
          : ['FAIL', `RFC 判定返回了 2xx/5xx:HTTP ${r.status}:${r.text.slice(0, 140)}`]
      }
      if (r.status === 201 || r.status === 200) {
        return [
          'FAIL',
          `公开客户端 + client_credentials 竟被接受:HTTP ${r.status}:${r.text.slice(0, 140)}`,
        ]
      }
      return ['FAIL', `未触达 RFC 判定,被中间件截胡:HTTP ${r.status}:${r.text.slice(0, 140)}`]
    },
  })

  // ── D 组:A2A 发现文档 ──
  const dCases = [
    {
      group: 'live:a2a',
      id: 'LIVE-D01',
      title: 'GET /.well-known/agent.json 匿名可读(A2A 发现,不得要凭据)',
      service: ai,
      needsCred: 'none',
      run: async () => {
        const r = await http('GET', `${OPTS.aiUrl}/.well-known/agent.json`)
        if (r.status === null) return ['SKIP', `请求失败:${r.error}`]
        if (r.status !== 200)
          return [
            'FAIL',
            `HTTP ${r.status}:${r.text.slice(0, 140)} —— 发现文档必须匿名可抓取,否则严格 A2A 客户端拿不到能力`,
          ]
        return [
          'PASS',
          `HTTP 200 name=${JSON.stringify(r.json?.name ?? '')} url=${r.json?.url ?? '-'} skills=${(r.json?.skills ?? []).length}`,
        ]
      },
    },
    {
      group: 'live:a2a',
      id: 'LIVE-D02',
      title: `GET ${OPTS.publicUrl}/.well-known/agent.json 公网可达且卡片 url 是公网域(O20 反代白名单回归)`,
      service: ai,
      needsCred: 'none',
      run: async () => {
        const r = await http('GET', `${OPTS.publicUrl}/.well-known/agent.json`)
        if (r.status === null)
          return ['SKIP', `公网请求失败:${r.error} —— 公网链路不可达时不阻断内网结论`]
        if (r.status !== 200)
          return [
            'FAIL',
            `公网 HTTP ${r.status}:${r.text.slice(0, 140)} —— 发现文档经 web 反代必须匿名可抓取(白名单:/.well-known/agent.json|agent-card.json)`,
          ]
        const cardUrl = String(r.json?.url ?? '')
        const cardHost = new URL(cardUrl).host
        const pubHost = new URL(OPTS.publicUrl).host
        if (!cardHost.endsWith(pubHost.split('.').slice(-2).join('.'))) {
          return [
            'FAIL',
            `卡片 url=${cardUrl} 不是公网域(${pubHost} 家族)—— resolve_public_base_url 推导失败,第三方会拿到内网地址`,
          ]
        }
        return ['PASS', `公网 HTTP 200 url=${cardUrl} skills=${(r.json?.skills ?? []).length}`]
      },
    },
  ]

  const all = [...aCases, ...bCases, ...cCases, ...dCases]
  for (const c of all) {
    if (!c.service.online) {
      add(
        c.group,
        c.id,
        c.title,
        'SKIP',
        `服务不可达(${c.service.base} 探测失败:${c.service.detail})—— 本用例未验证,禁止当作 PASS`,
      )
      continue
    }
    if (c.needsCred === 'key' && !hasKey) {
      add(
        c.group,
        c.id,
        c.title,
        'SKIP',
        '缺 ihui_ 机器凭据(设 IHUI_API_KEY 或 --api-key)—— 匿名侧结论由 LIVE-A01/A02/B01 承担',
      )
      continue
    }
    if (c.needsCred === 'key+secret' && !(hasKey && hasSecret)) {
      add(
        c.group,
        c.id,
        c.title,
        'SKIP',
        `缺凭据组合(需要 key${hasKey ? '' : ' + secret'};IHUI_API_KEY=${mask(OPTS.apiKey)} / IHUI_API_SECRET=${OPTS.apiSecret ? 'set' : 'unset'})`,
      )
      continue
    }
    if (c.needsCred === 'jwt' && !hasJwt) {
      add(
        c.group,
        c.id,
        c.title,
        'SKIP',
        '缺人通道 JWT(IHUI_JWT / --jwt)—— ai-service MCP 只认 JWT 或内网 X-IHUI-Principal',
      )
      continue
    }
    if (c.needsCred === 'dcr' && !dcr.clientId) {
      add(c.group, c.id, c.title, 'SKIP', 'LIVE-C02 未成功建客户端,无凭据可用')
      continue
    }
    let verdict
    try {
      verdict = await c.run()
    } catch (e) {
      verdict = ['FAIL', `用例抛错:${String(e?.message ?? e)}`]
    }
    add(c.group, c.id, c.title, verdict[0], verdict[1])
  }
}

// ═════════════════════════════════ 输出 ═════════════════════════════════
function counts() {
  const c = { PASS: 0, FAIL: 0, SKIP: 0 }
  for (const r of results) c[r.status] += 1
  return c
}

function render() {
  const lines = []
  let group = null
  for (const r of results) {
    if (r.group !== group) {
      group = r.group
      lines.push(`\n▌ ${group}`)
    }
    const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⏭️ '
    lines.push(`  ${icon} ${r.id} ${r.title}`)
    lines.push(`      ${r.detail}`)
  }
  if (findings.length) {
    lines.push('\n▌ 真实风险与告警(不计入 PASS/FAIL,但必须看)')
    for (const f of findings) {
      const icon = f.severity === 'high' ? '🔴' : f.severity === 'medium' ? '🟠' : '🟡'
      lines.push(`  ${icon} [${f.severity}] ${f.title}`)
      lines.push(`      ${f.detail}`)
    }
  }
  return lines.join('\n')
}

async function main() {
  if (OPTS.help) {
    console.log(HELP)
    return 0
  }
  await runOfflineChecks()
  let api = { online: false, detail: '未进入在线模式', base: OPTS.apiUrl }
  let ai = { online: false, detail: '未进入在线模式', base: OPTS.aiUrl }
  if (OPTS.live) {
    const pApi = await probeAny(OPTS.apiUrl, ['/health', '/api/health'])
    const pAi = await probeAny(OPTS.aiUrl, ['/health', '/api/health'])
    api = { ...pApi, base: OPTS.apiUrl }
    ai = { ...pAi, base: OPTS.aiUrl }
    if (!api.online)
      finding(
        'medium',
        `apps/api(${OPTS.apiUrl}) 不可达,OpenAI/MCP 网关/OAuth 三组在线用例全部 SKIP`,
        pApi.detail,
      )
    if (!ai.online)
      finding(
        'medium',
        `ai-service(${OPTS.aiUrl}) 不可达,MCP JSON-RPC 与 A2A 在线用例全部 SKIP`,
        pAi.detail,
      )
    await runLiveChecks(api, ai)
  } else {
    add(
      'live',
      'LIVE-00',
      '在线三通道(OpenAI 兼容 / MCP JSON-RPC / OAuth DCR / A2A)',
      'SKIP',
      '未加 --live:离线模式不假设任何服务在跑;加 --live 才会真发请求',
    )
  }

  const c = counts()
  const liveResults = results.filter((r) => r.group.startsWith('live'))
  const liveSkippedAll = liveResults.length > 0 && liveResults.every((r) => r.status === 'SKIP')
  let exitCode = c.FAIL > 0 ? 1 : 0
  if (OPTS.live && OPTS.requireLive && liveSkippedAll) exitCode = 1

  if (OPTS.json) {
    console.log(
      JSON.stringify(
        {
          ok: exitCode === 0,
          mode: OPTS.live ? 'offline+live' : 'offline',
          counts: c,
          engines: { judge: REAL.engine, ...(REAL.error ? { judgeError: REAL.error } : {}) },
          endpoints: {
            api: OPTS.apiUrl,
            ai: OPTS.aiUrl,
            apiOnline: api.online,
            aiOnline: ai.online,
          },
          credentials: {
            apiKey: OPTS.apiKey ? 'set' : 'unset',
            apiSecret: OPTS.apiSecret ? 'set' : 'unset',
            jwt: OPTS.jwt ? 'set' : 'unset',
          },
          results,
          findings,
          requireLive: OPTS.requireLive,
          liveSkippedAll,
        },
        null,
        2,
      ),
    )
  } else {
    console.log(`\n${'═'.repeat(78)}`)
    console.log(
      `外部 Agent 接入能力端到端证明(O17)  mode=${OPTS.live ? 'offline+live' : 'offline'}  判据引擎=${REAL.engine}`,
    )
    console.log(`${'═'.repeat(78)}`)
    if (!OPTS.quiet) console.log(render())
    else {
      for (const r of results.filter((x) => x.status !== 'PASS'))
        console.log(`  ${r.status === 'FAIL' ? '❌' : '⏭️ '} ${r.id} ${r.title}\n      ${r.detail}`)
      for (const f of findings) console.log(`  ⚠️ [${f.severity}] ${f.title}\n      ${f.detail}`)
    }
    console.log(
      `\n汇总:PASS ${c.PASS} / FAIL ${c.FAIL} / SKIP ${c.SKIP}${OPTS.live && liveSkippedAll ? ' —— ⚠️ 在线用例全部 SKIP,未验证真接通' : ''}`,
    )
    console.log(
      `凭据:api-key=${mask(OPTS.apiKey)} api-secret=${OPTS.apiSecret ? 'set' : 'unset'} jwt=${OPTS.jwt ? 'set' : 'unset'}`,
    )
    console.log(
      `退出码:${exitCode}${exitCode === 1 && c.FAIL === 0 ? '(--require-live 且在线全 SKIP)' : ''}`,
    )
  }
  return exitCode
}

// ═════════════════════════ 单元测试导出锚点(AGENTS.md §22c) ═════════════════════════
export const __test__ = {
  parseJwtPublicPaths,
  parseEnvList,
  parsePyTupleLiteral,
  parseSecurityBoundaryTuples,
  isNeverPublicEntry,
  detectPrivilegedPublicEntries,
  parseOpenRegistry,
  stripComments,
  countScopedCallSites,
  mask,
  counts,
  results,
}

// ═════════════════════════ 入口守护(AGENTS.md §22d) ═════════════════════════
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
    .then((code) => {
      // 不直接 process.exit:在线模式下 undici 仍有关闭中的 socket 句柄,
      // Windows 上 process.exit 会撞 libuv `UV_HANDLE_CLOSING` 断言(实测 exit=127)。
      // 先置 exitCode 让事件循环自然排空;仅在句柄滞留时由不 ref 的看门狗兜底退出。
      process.exitCode = code
      const watchdog = setTimeout(() => process.exit(code), 5000)
      watchdog.unref()
    })
    .catch((e) => {
      console.error(`❌ e2e-agent-access 脚本异常: ${e?.message ?? e}`)
      console.error(e?.stack ?? '(no stack)')
      process.exitCode = 2
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
