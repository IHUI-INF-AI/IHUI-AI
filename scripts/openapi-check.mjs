#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-openapi.mjs(历史名 openapi-check.mjs)— OpenAPI 契约产物真门禁
 *
 * 背景(2026-09-20 O8 立):本脚本此前只做"信息播报"——产物 `apps/api/openapi.json`
 * 不存在就打印一行建议然后 `exit 0`。仓库里从来没有该产物,于是 CI 的
 * `.github/workflows/openapi-check.yml` 恒绿,是一份**假门禁**。
 * 现在契约由 `pnpm openapi:export`(apps/api/scripts/export-openapi.ts,走真实
 * Fastify 启动图)生成为版本库产物,本脚本对它做**可失败**的机械校验。
 *
 * 五项检查:
 *   A 产物存在性  apps/api/openapi.json 必须存在、可解析、结构合法。缺失不再"跳过"。
 *   B 必备契约面  info / servers / tags / components.securitySchemes(ApiKeyAuth、
 *                 BearerAuth、OAuth2)与关键端点(GET /api/health、/v1* 、/v1beta*)
 *                 必须齐全 —— 少一个说明导出链路或路由挂载被改坏。
 *   C 能力清单对齐 packages/types/generated/capabilities.json 由代码
 *                 (packages/types/src/capability-catalog.ts)生成,是 scope→端点 的单一
 *                 事实源。清单里每个 `METHOD /path` 都必须在产物里存在且带 `security`;
 *                 缺失 = 产物陈旧或安全声明丢失 → 失败。
 *   D schema 覆盖率 /v1* 与 /v1beta* 的 operation 中声明了请求体/参数/响应 schema 的
 *                 占比低于阈值 → 失败(阈值见 MIN_COVERAGEPercent,只准涨不准跌)。
 *   E 显式漂移比对 带 `--fresh <path>` 时,把新生成的产物(committed 之外的那份)与
 *                 committed 产物做语义比对,任何差异 → 失败。CI 用它(或
 *                 `export` 后 `git diff --exit-code`)堵死"只校验陈旧产物"。
 *
 * CLI 用法:
 *   node scripts/openapi-check.mjs [选项]
 *     (无参数)/ --check   全量校验 committed 产物(A+B+C+D),CI 与本地通用
 *     --staged            pre-commit 用:仅当本轮暂存涉及 apps/api/src/routes/**、
 *                         apps/api/src/server.ts、导出脚本或产物本身时才判定,否则跳过
 *     --fresh <path>      与指定产物文件做漂移比对(E)
 *     --min-coverage=N    覆盖阈值,默认 MIN_COVERAGE_PERCENT(可用 OPENAPI_MIN_COVERAGE 覆盖)
 *     --json              输出机器可读 JSON(诊断走 stderr)
 *     --quiet             抑制 info 输出
 *     --self-test         内置样例断言(不读业务文件),失败 exit 1
 *     --help              本帮助
 *
 * 环境变量(测试/CI 接缝):
 *   OPENAPI_CHECK_ROOT        覆盖仓库根(单测用临时 fixture 树跑完整 CLI)
 *   OPENAPI_ARTIFACT          覆盖产物路径
 *   OPENAPI_CAPABILITIES      覆盖能力清单路径
 *   OPENAPI_MIN_COVERAGE      覆盖阈值
 *   OPENAPI_CHECK_STAGED_FILES 逗号/换行分隔的仓库根相对路径,替代 git 暂存区清单
 *   HUSKY_SKIP_OPENAPI_GUARD=1 紧急跳过
 *
 * 退出码:0 通过 / 1 检查失败 / 2 脚本自身异常。
 *
 * 关联:AGENTS.md §6 验证命令、§22c/§22d(本文件导出 __test__ 供测试直接 import)。
 */
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(process.env.OPENAPI_CHECK_ROOT || resolve(__dirname, '..'))

const ARTIFACT_REL = 'apps/api/openapi.json'
const CAPABILITIES_REL = 'packages/types/generated/capabilities.json'
const EXPORT_SCRIPT_REL = 'apps/api/scripts/export-openapi.ts'
const ROUTES_DIR_REL = 'apps/api/src/routes'
const V1_PREFIXES = ['/v1', '/v1beta']

/**
 * `/v1*`+`/v1beta*` operation 的 schema 覆盖率下限(百分比,只准涨不准跌)。
 * 2026-09-20 首次生成产物实测基线见 `node scripts/openapi-check.mjs` 输出。
 */
const MIN_COVERAGE_PERCENT = Number(process.env.OPENAPI_MIN_COVERAGE ?? 17)

/** B 项:产物必须出现的关键端点(`METHOD path`,path 用 OpenAPI 花括号写法)。 */
const REQUIRED_ENDPOINTS = [
  'GET /api/health',
  'POST /v1/chat/completions',
  'POST /v1/mcp/tools/call',
  'GET /v1/models',
]
/** B 项:必须存在的 securityScheme 名称。 */
const REQUIRED_SCHEMES = ['ApiKeyAuth', 'BearerAuth', 'OAuth2']

const HTTP_METHODS = ['get', 'put', 'post', 'patch', 'delete', 'head', 'options', 'trace']
/** 判定为"需要鉴权"的公开面阈值:这些前缀下的 operation 必须带 security。 */
const GUARDED_PREFIXES = ['/v1/', '/v1beta']

const COLORS = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}
const C = process.env.NO_COLOR || !process.stdout.isTTY
  ? { red: '', green: '', yellow: '', cyan: '', dim: '', bold: '', reset: '' }
  : COLORS

// ════════════════════════════════ 纯函数层(零副作用,可被测试 import) ════════════════════════════════

function readJson(absPath) {
  return JSON.parse(readFileSync(absPath, 'utf8'))
}

function pathKeys(doc) {
  const paths = doc?.paths
  if (!paths || typeof paths !== 'object') return []
  return Object.keys(paths)
}

function operationsOf(doc) {
  const out = []
  for (const pathKey of pathKeys(doc)) {
    const item = doc.paths[pathKey]
    if (!item || typeof item !== 'object') continue
    for (const method of HTTP_METHODS) {
      const op = item[method]
      if (op && typeof op === 'object') out.push({ path: pathKey, method, op })
    }
  }
  return out
}

/** Fastify 的 `:param` / 尾部 `*` 归一到 OpenAPI 写法,便于跨源比对。 */
function normalizePath(p) {
  const withBraces = String(p).replace(/:([A-Za-z0-9_]+)/g, '{$1}')
  return withBraces.endsWith('/*') ? withBraces.slice(0, -2) : withBraces
}

function nodeHasSchema(node) {
  if (!node || typeof node !== 'object') return false
  const content = node.content
  if (!content || typeof content !== 'object') return false
  return Object.values(content).some(
    (media) => !!media && typeof media === 'object' && media.schema !== undefined,
  )
}

function responseHasSchema(responses) {
  if (!responses || typeof responses !== 'object') return false
  return Object.values(responses).some(nodeHasSchema)
}

/** D 项:一个 operation "有契约" = 声明了请求体 / 非路径参数 / 带 schema 的响应。 */
function operationHasContract(op) {
  if (nodeHasSchema(op?.requestBody)) return true
  const params = Array.isArray(op?.parameters) ? op.parameters : []
  if (params.some((p) => p && typeof p === 'object' && p.schema !== undefined && p.in !== 'path')) {
    return true
  }
  return responseHasSchema(op?.responses)
}

export function computeCoverage(doc) {
  const ops = operationsOf(doc).filter((o) =>
    V1_PREFIXES.some((p) => o.path === p || o.path.startsWith(p)),
  )
  const covered = ops.filter((o) => operationHasContract(o.op)).length
  return {
    operations: ops.length,
    covered,
    percent: ops.length === 0 ? 0 : Math.round((covered / ops.length) * 1000) / 10,
  }
}

/** C 项输入:从能力清单抽出 `METHOD /normalized/path` → scope[] 映射。 */
export function collectCapabilityRoutes(manifest) {
  const map = new Map()
  for (const cap of manifest?.capabilities ?? []) {
    for (const entry of cap?.routes ?? []) {
      const m = /^([A-Za-z]+)\s+(\S+)$/.exec(String(entry).trim())
      if (!m) continue
      const method = m[1].toLowerCase()
      const path = normalizePath(m[2].startsWith('/') ? m[2] : `/${m[2]}`)
      const key = `${method} ${path}`
      if (!map.has(key)) map.set(key, new Set())
      if (cap.scope) map.get(key).add(cap.scope)
    }
  }
  return map
}

function hasSecurity(op) {
  return Array.isArray(op?.security) && op.security.length > 0
}

/**
 * E 项:语义 diff(忽略键序)。返回首批差异描述。
 */
export function diffDocuments(a, b, limit = 12) {
  const diffs = []
  const walk = (x, y, at) => {
    if (diffs.length >= limit) return
    const tx = x === null ? 'null' : Array.isArray(x) ? 'array' : typeof x
    const ty = y === null ? 'null' : Array.isArray(y) ? 'array' : typeof y
    if (tx !== ty) {
      diffs.push(`${at}: ${tx} → ${ty}`)
      return
    }
    if (tx === 'object') {
      const keys = new Set([...Object.keys(x ?? {}), ...Object.keys(y ?? {})])
      for (const k of [...keys].sort()) {
        if (!(k in (x ?? {}))) {
          diffs.push(`${at}.${k}: 仅新产物存在`)
          continue
        }
        if (!(k in (y ?? {}))) {
          diffs.push(`${at}.${k}: 仅 committed 产物存在`)
          continue
        }
        walk(x[k], y[k], `${at}.${k}`)
        if (diffs.length >= limit) return
      }
      return
    }
    if (tx === 'array') {
      if (x.length !== y.length) {
        diffs.push(`${at}: 数组长度 ${x.length} → ${y.length}`)
        return
      }
      for (let i = 0; i < x.length; i += 1) walk(x[i], y[i], `${at}[${i}]`)
      return
    }
    if (x !== y) diffs.push(`${at}: ${JSON.stringify(x)} → ${JSON.stringify(y)}`)
  }
  walk(a, b, '$')
  return diffs
}

// ════════════════════════════════ 评估(汇总 A~E) ════════════════════════════════

export function evaluate({ artifactText, artifactError, artifact, capabilities, capabilitiesError, freshArtifact, freshPath, minCoverage }) {
  const failures = []
  const warnings = []
  const stats = {
    paths: 0,
    operations: 0,
    v1Operations: 0,
    coveredOperations: 0,
    coveragePercent: 0,
    capabilityRoutes: 0,
    capabilityMissingInArtifact: 0,
    capabilityUnsecured: 0,
    publicOpsWithoutSecurity: 0,
    securitySchemes: [],
  }

  // ── A 产物存在性 ──
  if (artifactError) {
    failures.push({
      check: 'A',
      code: artifactText === null ? 'ARTIFACT_MISSING' : 'ARTIFACT_UNPARSEABLE',
      message:
        artifactText === null
          ? `契约产物缺失:${ARTIFACT_REL} 不存在。生成:pnpm openapi:export`
          : `契约产物无法解析:${ARTIFACT_REL} → ${artifactError}`,
    })
    return { failures, warnings, stats }
  }
  if (!artifact || typeof artifact !== 'object') {
    failures.push({ check: 'A', code: 'ARTIFACT_SHAPE', message: '产物根节点不是对象' })
    return { failures, warnings, stats }
  }
  if (typeof artifact.openapi !== 'string' || !artifact.openapi.startsWith('3')) {
    failures.push({
      check: 'A',
      code: 'ARTIFACT_VERSION',
      message: `openapi 版本字段异常:${JSON.stringify(artifact.openapi)}(应为 3.x)`,
    })
  }
  if (!artifact.paths || typeof artifact.paths !== 'object') {
    failures.push({ check: 'A', code: 'ARTIFACT_NO_PATHS', message: '产物缺少 paths 对象' })
    return { failures, warnings, stats }
  }
  if (Object.keys(artifact.paths).length === 0) {
    failures.push({ check: 'A', code: 'ARTIFACT_EMPTY_PATHS', message: '产物 paths 为空' })
    return { failures, warnings, stats }
  }

  const ops = operationsOf(artifact)
  stats.paths = pathKeys(artifact).length
  stats.operations = ops.length

  // ── B 必备契约面 ──
  const schemes = (artifact.components && artifact.components.securitySchemes) || {}
  stats.securitySchemes = Object.keys(schemes).sort()
  for (const name of REQUIRED_SCHEMES) {
    if (!schemes[name]) {
      failures.push({
        check: 'B',
        code: 'SECURITY_SCHEME_MISSING',
        message: `components.securitySchemes.${name} 缺失(导出脚本负责注入,见 apps/api/scripts/export-openapi.ts)`,
      })
    }
  }
  for (const req of REQUIRED_ENDPOINTS) {
    const [method, path] = req.split(' ')
    const item = artifact.paths[path]
    if (!item || item[method] === undefined) {
      failures.push({ check: 'B', code: 'REQUIRED_ENDPOINT_MISSING', message: `关键端点缺失:${req}` })
    }
  }
  for (const prefix of ['/api/health', '/v1', '/v1beta']) {
    const hit =
      prefix === '/api/health'
        ? artifact.paths['/api/health'] !== undefined
        : pathKeys(artifact).some((p) => p.startsWith(prefix))
    if (!hit) {
      failures.push({
        check: 'B',
        code: 'REQUIRED_SURFACE_MISSING',
        message: `契约面缺失:没有任何 ${prefix}* 路径`,
      })
    }
  }
  if (!Array.isArray(artifact.tags) || artifact.tags.length === 0) {
    warnings.push({ check: 'B', message: '产物缺少 tags 分组(文档可读性)' })
  }

  // ── C 能力清单对齐 ──
  if (capabilitiesError) {
    failures.push({
      check: 'C',
      code: 'CAPABILITIES_UNPARSEABLE',
      message: `能力清单无法解析:${CAPABILITIES_REL} → ${capabilitiesError}`,
    })
  } else if (!capabilities) {
    failures.push({
      check: 'C',
      code: 'CAPABILITIES_MISSING',
      message: `能力清单缺失:${CAPABILITIES_REL}(生成:pnpm capabilities:export)`,
    })
  } else {
    const routeMap = collectCapabilityRoutes(capabilities)
    stats.capabilityRoutes = routeMap.size
    for (const [key, scopes] of routeMap) {
      const [method, path] = key.split(' ')
      const item = artifact.paths[path]
      let op = item ? item[method] : undefined
      // 能力清单用 `WS` 登记实时端点,Fastify 以单一 GET 暴露
      if (op === undefined && method === 'ws' && item) {
        const present = HTTP_METHODS.filter((m) => item[m] !== undefined)
        if (present.length === 1) op = item[present[0]]
      }
      if (!op || typeof op !== 'object') {
        stats.capabilityMissingInArtifact += 1
        failures.push({
          check: 'C',
          code: 'CAPABILITY_ROUTE_NOT_IN_SPEC',
          message: `能力清单端点未出现在契约里:${key}(scope ${[...scopes].sort().join(', ') || '—'})`,
        })
        continue
      }
      if (!hasSecurity(op)) {
        stats.capabilityUnsecured += 1
        failures.push({
          check: 'C',
          code: 'CAPABILITY_ROUTE_UNSECURED',
          message: `契约端点缺少 security 声明:${key} —— 产物与代码漂移或导出脚本注入被绕过`,
        })
      }
    }
  }

  // 公开面里既不在能力清单、又没有 security 的 /v1* operation:提示补登记(不阻塞)
  for (const { path, method, op } of ops) {
    const guarded = GUARDED_PREFIXES.some((p) => path === p || path.startsWith(p) || path.startsWith(`${p}/`))
    if (!guarded) continue
    if (hasSecurity(op)) continue
    stats.publicOpsWithoutSecurity += 1
  }
  if (stats.publicOpsWithoutSecurity > 0) {
    warnings.push({
      check: 'C',
      message: `公开面 /v1* 有 ${stats.publicOpsWithoutSecurity} 个 operation 未声明 security(未登记进能力目录,建议补 capability-catalog.ts)`,
    })
  }

  // ── D schema 覆盖率 ──
  const cov = computeCoverage(artifact)
  stats.v1Operations = cov.operations
  stats.coveredOperations = cov.covered
  stats.coveragePercent = cov.percent
  if (cov.operations > 0 && cov.percent < minCoverage) {
    failures.push({
      check: 'D',
      code: 'COVERAGE_BELOW_THRESHOLD',
      message: `/v1*+\\v1beta* schema 覆盖率 ${cov.covered}/${cov.operations} = ${cov.percent}% 低于阈值 ${minCoverage}%。修复:给路由的 buildSchema() 传 body/querystring/params/response,再 pnpm openapi:export`,
    })
  }

  // ── E 显式漂移比对 ──
  if (freshArtifact) {
    const diffs = diffDocuments(artifact, freshArtifact)
    if (diffs.length > 0) {
      failures.push({
        check: 'E',
        code: 'ARTIFACT_DRIFT',
        message: `committed 产物与新生成产物(${freshPath})不一致(${diffs.length}${diffs.length >= 12 ? '+' : ''} 处差异)。修复:pnpm openapi:export 后提交`,
        detail: diffs,
      })
    }
  }

  return { failures, warnings, stats }
}

// ════════════════════════════════ CLI ════════════════════════════════

const argv = process.argv.slice(2)
const OPTS = {
  staged: argv.includes('--staged'),
  json: argv.includes('--json'),
  selfTest: argv.includes('--self-test'),
  quiet: argv.includes('--quiet'),
  help: argv.includes('--help') || argv.includes('-h'),
  freshIdx: argv.indexOf('--fresh'),
}
const MIN_COVERAGE = (() => {
  const flag = argv.find((a) => a.startsWith('--min-coverage='))
  if (flag) return Number(flag.split('=')[1])
  const bare = argv.indexOf('--min-coverage')
  if (bare >= 0 && argv[bare + 1]) return Number(argv[bare + 1])
  return MIN_COVERAGE_PERCENT
})()

const HELP_TEXT = `
openapi-check.mjs — OpenAPI 契约产物真门禁(A 存在性 / B 必备面 / C 能力清单对齐 / D 覆盖率 / E 漂移)

用法:
  node scripts/openapi-check.mjs [选项]

选项:
  (无参数) | --check     全量校验 ${ARTIFACT_REL}
  --staged               仅当本轮暂存触及 api 路由/产物时才判定(pre-commit 用)
  --fresh <path>         与新生成的产物比对,任何差异判为漂移(CI 用)
  --min-coverage=N       schema 覆盖率阈值(默认 ${MIN_COVERAGE_PERCENT})
  --json                 机器可读输出
  --quiet                抑制 info
  --self-test            内置断言
  --help                 本帮助

退出码:0 通过 / 1 检查失败 / 2 脚本异常
紧急跳过: HUSKY_SKIP_OPENAPI_GUARD=1 git commit ...
`

function readText(rel) {
  const abs = join(ROOT, rel)
  try {
    return readFileSync(abs, 'utf8')
  } catch {
    return null
  }
}

function loadArtifact(absPath) {
  if (!existsSync(absPath)) return { text: null, doc: null, error: null }
  let text = null
  try {
    text = readFileSync(absPath, 'utf8')
  } catch (e) {
    return { text: null, doc: null, error: String(e?.message ?? e) }
  }
  try {
    return { text, doc: JSON.parse(text), error: null }
  } catch (e) {
    return { text, doc: null, error: String(e?.message ?? e) }
  }
}

function getStagedFiles() {
  if (process.env.OPENAPI_CHECK_STAGED_FILES) {
    return process.env.OPENAPI_CHECK_STAGED_FILES.split(/[\n,]/).map((s) => s.trim()).filter(Boolean)
  }
  try {
    const out = execFileSync('git', ['-c', 'safe.directory=*', 'diff', '--cached', '--name-only'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    })
    return out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
  } catch {
    return null
  }
}

/** --staged 判定:本轮改动是否与 OpenAPI 契约相关。 */
export function isContractRelevant(files) {
  return files.some(
    (f) =>
      f === ARTIFACT_REL ||
      f === CAPABILITIES_REL ||
      f === EXPORT_SCRIPT_REL ||
      f === 'scripts/openapi-check.mjs' ||
      f.startsWith(ROUTES_DIR_REL + '/') ||
      f === 'apps/api/src/server.ts' ||
      f === 'apps/api/src/utils/swagger.ts' ||
      f === 'apps/api/src/utils/openapi-helpers.ts',
  )
}

function collectInputs() {
  const artifactPath = resolve(process.env.OPENAPI_ARTIFACT || join(ROOT, ARTIFACT_REL))
  const capabilitiesPath = resolve(process.env.OPENAPI_CAPABILITIES || join(ROOT, CAPABILITIES_REL))
  const a = loadArtifact(artifactPath)
  const cap = loadArtifact(capabilitiesPath)
  let fresh = null
  let freshPath = null
  if (OPTS.freshIdx >= 0) {
    const arg = argv[OPTS.freshIdx + 1]
    if (!arg) {
      console.error(`${C.red}❌ --fresh 需要一个文件路径参数${C.reset}`)
      return { abort: 2 }
    }
    freshPath = resolve(arg)
    fresh = loadArtifact(freshPath)
    if (fresh.text === null) {
      console.error(`${C.red}❌ --fresh 指向的文件读不到:${freshPath}${C.reset}`)
      return { abort: 1 }
    }
    if (fresh.error) {
      console.error(`${C.red}❌ --fresh 产物无法解析:${fresh.error}${C.reset}`)
      return { abort: 1 }
    }
  }
  return {
    artifactPath,
    artifact: a.doc,
    artifactText: a.text,
    artifactError: a.text === null ? 'missing' : a.error,
    capabilities: cap.doc,
    capabilitiesError: cap.text === null ? null : cap.error,
    capabilitiesMissing: cap.text === null,
    freshArtifact: fresh ? fresh.doc : null,
    freshPath,
  }
}

async function main() {
  if (OPTS.help) {
    console.log(HELP_TEXT)
    return 0
  }
  if (OPTS.selfTest) return runSelfTest()
  if (process.env.HUSKY_SKIP_OPENAPI_GUARD === '1') {
    console.log(`${C.yellow}⏭  OpenAPI 守门跳过(HUSKY_SKIP_OPENAPI_GUARD=1)${C.reset}`)
    return 0
  }

  if (OPTS.staged) {
    const staged = getStagedFiles()
    if (staged === null) {
      console.log(`${C.dim}[openapi-check] 暂存区不可读,本轮按全量模式判定${C.reset}`)
    } else if (!isContractRelevant(staged)) {
      console.log(`${C.dim}[openapi-check] 暂存改动与 OpenAPI 契约无关,跳过${C.reset}`)
      return 0
    }
  }

  const inputs = collectInputs()
  if (inputs.abort) return inputs.abort
  const report = evaluate({
    artifactText: inputs.artifactText,
    artifactError: inputs.artifactError ?? (inputs.artifactText === null ? 'missing' : null),
    artifact: inputs.artifact,
    capabilities: inputs.capabilities,
    capabilitiesError: inputs.capabilitiesMissing ? 'missing' : inputs.capabilitiesError,
    freshArtifact: inputs.freshArtifact,
    freshPath: inputs.freshPath,
    minCoverage: MIN_COVERAGE,
  })
  const failed = report.failures.length > 0

  if (OPTS.json) {
    console.log(
      JSON.stringify(
        {
          artifact: inputs.artifactPath,
          fresh: inputs.freshPath,
          minCoveragePercent: MIN_COVERAGE,
          stats: report.stats,
          failures: report.failures,
          warnings: report.warnings,
        },
        null,
        2,
      ),
    )
    return failed ? 1 : 0
  }

  const log = (...a) => {
    if (!OPTS.quiet) console.log(...a)
  }
  const s = report.stats
  log(
    `${C.cyan}${C.bold}📄 OpenAPI 契约守门 openapi-check${C.reset} ${C.dim}(${inputs.artifactPath})${C.reset}`,
  )
  log(
    `  [A] 产物:${s.paths ? `${C.green}存在${C.reset}` : `${C.red}缺失/不可用${C.reset}`} · path ${s.paths} 个 / operation ${s.operations} 个`,
  )
  log(
    `  [B] 必备面:securitySchemes [${s.securitySchemes.join(', ') || '—'}] · 关键端点 ${REQUIRED_ENDPOINTS.length} 项 · 公开面 /v1 /v1beta /api/health`,
  )
  log(
    `  [C] 能力清单对齐:${s.capabilityRoutes} 条登记端点 → 契约缺失 ${C.red}${s.capabilityMissingInArtifact}${C.reset} / 缺 security ${C.red}${s.capabilityUnsecured}${C.reset}`,
  )
  log(
    `  [D] schema 覆盖率(/v1* + /v1beta*):${s.coveredOperations}/${s.v1Operations} = ${s.coveragePercent}% 阈值 ${MIN_COVERAGE}%${
      failed && report.failures.some((f) => f.code === 'COVERAGE_BELOW_THRESHOLD')
        ? ` ${C.red}未达标${C.reset}`
        : ` ${C.green}达标${C.reset}`
    }`,
  )
  log(
    inputs.freshPath
      ? `  [E] 漂移比对:${C.dim}${inputs.freshPath}${C.reset}`
      : `  [E] 漂移比对:${C.dim}未启用(CI 用 --fresh 或 export 后 git diff --exit-code)${C.reset}`,
  )

  for (const f of report.failures) {
    console.error(`${C.red}❌ [${f.check}] ${f.code}: ${f.message}${C.reset}`)
    for (const d of f.detail ?? []) console.error(`${C.dim}      ${d}${C.reset}`)
  }
  for (const w of report.warnings) console.warn(`${C.yellow}⚠️ [${w.check}] ${w.message}${C.reset}`)

  if (!failed) log(`${C.green}${C.bold}✅ OpenAPI 契约与代码一致${C.reset}`)
  else {
    console.error(
      `${C.red}${C.bold}❌ OpenAPI 守门未通过(${report.failures.length} 项)${C.reset}`,
    )
    console.error(`${C.dim}  重新生成:pnpm openapi:export;紧急跳过:HUSKY_SKIP_OPENAPI_GUARD=1 git commit ...${C.reset}`)
  }
  return failed ? 1 : 0
}

// ═════════════════════════ --self-test(内置样例断言) ═════════════════════════

const SAMPLE_DOC = {
  openapi: '3.0.3',
  info: { title: 'IHUI AI API', version: '0.0.0' },
  tags: [{ name: 'Chat' }],
  security: [{ BearerAuth: [] }],
  paths: {
    '/api/health': { get: { responses: { 200: { content: { 'application/json': { schema: { type: 'object' } } } } } }, security: [] },
    '/v1/chat/completions': {
      post: {
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { model: { type: 'string' } } } } } },
        responses: { 200: { content: { 'application/json': { schema: { type: 'object' } } } } },
        security: [{ BearerAuth: [] }, { OAuth2: ['chat:write'] }],
      },
    },
    '/v1/models': { get: { responses: {}, security: [{ BearerAuth: [] }] } },
    '/v1/mcp/tools/call': { post: { responses: {}, security: [{ BearerAuth: [] }] } },
    '/v1beta/models': { get: { responses: {} } },
  },
  components: {
    securitySchemes: {
      ApiKeyAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'ihui_' },
      BearerAuth: { type: 'http', scheme: 'bearer' },
      OAuth2: { type: 'oauth2', flows: { authorizationCode: { authorizationUrl: 'x', tokenUrl: 'y', scopes: {} } } },
    },
  },
}

const SAMPLE_CAPABILITIES = {
  capabilities: [
    { scope: 'chat:write', description: '对话补全', routes: ['POST /v1/chat/completions'] },
    { scope: 'models:read', description: '模型列表', routes: ['GET /v1/models'] },
    { scope: 'tools:call', description: '工具调用', routes: ['POST /v1/mcp/tools/call'] },
  ],
}

function runSelfTest() {
  let failedCount = 0
  const ok = (cond, msg) => {
    if (cond) console.log(`[self-test]   ✅ ${msg}`)
    else {
      failedCount += 1
      console.error(`[self-test]   ❌ ${msg}`)
    }
  }

  // 1. 正常样例:只剩覆盖率一项可判(样本 5/5 有请求侧或响应侧契约的是 4 个 → 80%)
  const good = evaluate({
    artifactText: JSON.stringify(SAMPLE_DOC),
    artifactError: null,
    artifact: SAMPLE_DOC,
    capabilities: SAMPLE_CAPABILITIES,
    capabilitiesError: null,
    minCoverage: 50,
  })
  ok(good.failures.length === 0, `健康样例 0 失败(实际 ${good.failures.map((f) => f.code).join(',') || '无'})`)
  ok(good.stats.capabilityRoutes === 3, '能力清单端点数解析为 3')
  ok(good.stats.coveredOperations === 3 && good.stats.v1Operations === 4, `覆盖率统计正确(${good.stats.coveredOperations}/${good.stats.v1Operations})`)

  // 2. 产物缺失 → ARTIFACT_MISSING,且只有这一项
  const missing = evaluate({ artifactText: null, artifactError: 'missing', artifact: null, capabilities: SAMPLE_CAPABILITIES, capabilitiesError: null, minCoverage: 50 })
  ok(missing.failures.length === 1 && missing.failures[0].code === 'ARTIFACT_MISSING', '产物缺失 → 恰好 1 项 ARTIFACT_MISSING(不静默跳过)')

  // 3. 覆盖率不达标 → COVERAGE_BELOW_THRESHOLD
  const lowCov = evaluate({ artifactText: JSON.stringify(SAMPLE_DOC), artifactError: null, artifact: SAMPLE_DOC, capabilities: SAMPLE_CAPABILITIES, capabilitiesError: null, minCoverage: 95 })
  ok(lowCov.failures.some((f) => f.code === 'COVERAGE_BELOW_THRESHOLD'), '覆盖率低于阈值 → COVERAGE_BELOW_THRESHOLD')

  // 4. 能力清单端点不在产物里 → CAPABILITY_ROUTE_NOT_IN_SPEC
  const drifted = {
    capabilities: [
      ...SAMPLE_CAPABILITIES.capabilities,
      { scope: 'memory:write', description: '记忆写入', routes: ['POST /v1/memory'] },
    ],
  }
  const drift = evaluate({ artifactText: JSON.stringify(SAMPLE_DOC), artifactError: null, artifact: SAMPLE_DOC, capabilities: drifted, capabilitiesError: null, minCoverage: 50 })
  ok(drift.failures.some((f) => f.code === 'CAPABILITY_ROUTE_NOT_IN_SPEC'), '能力清单有、产物无 → CAPABILITY_ROUTE_NOT_IN_SPEC')

  // 5. security 丢失 → CAPABILITY_ROUTE_UNSECURED
  const noSec = JSON.parse(JSON.stringify(SAMPLE_DOC))
  delete noSec.paths['/v1/models'].get.security
  const secReport = evaluate({ artifactText: JSON.stringify(noSec), artifactError: null, artifact: noSec, capabilities: SAMPLE_CAPABILITIES, capabilitiesError: null, minCoverage: 0 })
  ok(secReport.failures.some((f) => f.code === 'CAPABILITY_ROUTE_UNSECURED'), '契约端点缺 security → CAPABILITY_ROUTE_UNSECURED')

  // 6. securitySchemes 缺失 → SECURITY_SCHEME_MISSING
  const noSchemes = JSON.parse(JSON.stringify(SAMPLE_DOC))
  delete noSchemes.components.securitySchemes.OAuth2
  const schemeReport = evaluate({ artifactText: JSON.stringify(noSchemes), artifactError: null, artifact: noSchemes, capabilities: SAMPLE_CAPABILITIES, capabilitiesError: null, minCoverage: 0 })
  ok(schemeReport.failures.some((f) => f.code === 'SECURITY_SCHEME_MISSING'), 'securitySchemes.OAuth2 缺失 → SECURITY_SCHEME_MISSING')

  // 7. --fresh 漂移
  const changed = JSON.parse(JSON.stringify(SAMPLE_DOC))
  changed.paths['/v1/chat/completions'].post.summary = '新增摘要'
  const freshReport = evaluate({
    artifactText: JSON.stringify(SAMPLE_DOC),
    artifactError: null,
    artifact: SAMPLE_DOC,
    capabilities: SAMPLE_CAPABILITIES,
    capabilitiesError: null,
    freshArtifact: changed,
    freshPath: 'fixture',
    minCoverage: 50,
  })
  ok(freshReport.failures.some((f) => f.code === 'ARTIFACT_DRIFT'), '--fresh 与 committed 不一致 → ARTIFACT_DRIFT')
  ok(diffDocuments(SAMPLE_DOC, JSON.parse(JSON.stringify(SAMPLE_DOC))).length === 0, 'diffDocuments:同一文档 0 差异(键序无关)')

  // 8. 路径归一 + staged 相关性判定
  ok(normalizePath('/v1/agents/:id/call') === '/v1/agents/{id}/call', 'normalizePath:Fastify :param → OpenAPI {param}')
  ok(isContractRelevant([ROUTES_DIR_REL + '/v1-public.ts']), '--staged:路由文件改动 = 契约相关')
  ok(!isContractRelevant(['apps/web/src/app/page.tsx']), '--staged:前端改动 = 与契约无关')

  // 9. 产物 JSON 非法 → ARTIFACT_UNPARSEABLE(走完整 CLI)
  {
    const { writeFixtureTree, withFixture } = fixtureHelpers()
    const root = writeFixtureTree({ [ARTIFACT_REL]: '{ not json' })
    const res = withFixture(root)
    ok(res.status === 1, `产物 JSON 损坏 → CLI exit 1(实际 ${res.status})`)
  }

  if (failedCount > 0) {
    console.error(`${C.red}[self-test] ❌ ${failedCount} 个断言失败${C.reset}`)
    return 1
  }
  console.log(`${C.green}[self-test] ✅ 全部断言通过(存在性/必备面/能力对齐/覆盖率/漂移/暂存判定正常)${C.reset}`)
  return 0
}

function fixtureHelpers() {
  return {
    writeFixtureTree(files) {
      const root = mkdtempSync(join(tmpdir(), 'openapi-check-'))
      for (const [rel, content] of Object.entries(files)) {
        const abs = join(root, rel)
        mkdirSync(dirname(abs), { recursive: true })
        writeFileSync(abs, typeof content === 'string' ? content : JSON.stringify(content, null, 2), 'utf8')
      }
      return root
    },
    /** 用临时 fixture 树跑一次真实 CLI,返回 { status, stdout, stderr }。 */
    withFixture(root, args = [], extraEnv = {}) {
      const scriptPath = join(__dirname, 'openapi-check.mjs')
      try {
        const stdout = execFileSync(process.execPath, [scriptPath, ...args], {
          cwd: ROOT,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
          env: { ...process.env, OPENAPI_CHECK_ROOT: root, NO_COLOR: '1', ...extraEnv },
        })
        return { status: 0, stdout, stderr: '' }
      } catch (e) {
        return { status: e?.status ?? 2, stdout: e?.stdout ?? '', stderr: e?.stderr ?? '' }
      } finally {
        try {
          rmSync(root, { recursive: true, force: true })
        } catch {
          /* Windows 偶发句柄占用,忽略 */
        }
      }
    },
  }
}

export const __test__ = {
  evaluate,
  computeCoverage,
  collectCapabilityRoutes,
  diffDocuments,
  normalizePath,
  isContractRelevant,
  operationHasContract,
  REQUIRED_ENDPOINTS,
  REQUIRED_SCHEMES,
  MIN_COVERAGE_PERCENT,
  SAMPLE_DOC,
  SAMPLE_CAPABILITIES,
  fixtureHelpers,
}

// ─── 入口守护(AGENTS.md §22d):import 时绝不触发 main 副作用 ───
const isDirectRun = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
    .then((code) => {
      process.exit(code)
    })
    .catch((e) => {
      console.error(`${C.red}❌ openapi-check 脚本执行异常: ${e?.message ?? e}${C.reset}`)
      console.error(e?.stack ?? '(no stack)')
      process.exit(2)
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
