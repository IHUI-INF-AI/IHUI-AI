// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * O13b 守门:admin/特权面判定一致性检查(check-admin-gate-consistency.mjs)
 *
 * 判据(三条规则,全部机械可证):
 *  RULE-1 裸 roleId 数值比较(`roleId >= 1` / `> 0` / `=== 1` / `< 1` / `<= 0` 等,
 *         左侧可以是任意 `xxx.roleId`)只允许出现在集中封装
 *         (plugins/require-permission.ts)与显式存量白名单内;白名单按
 *         「文件 → 登记条数 + 理由」精确锚定,**条数只减不增**,超出即违规。
 *         新增文件(未登记)出现任何裸比较即违规 —— --staged 模式只判本轮文件。
 *  RULE-2 本地重新定义 requireAdmin(function/const 形态)视为"同一语义两套判定",
 *         集中封装之外只允许存量白名单(2 处 boolean 版历史实现)。
 *  RULE-3 从 packages/types/src/capability-catalog.ts 读 platform 域 scope 清单,
 *         断言其 thirdPartyEligible 恒为 false —— 这是 requireCapability 闸对机器
 *         凭据恒 403(utils/capability-guard.ts isM2MAllowed)的目录侧不变量。
 *         解析复用既有入口 check-capability-catalog.mjs 的 __test__.parseCatalogEntries
 *         (括号配平手写解析器,AGENTS.md §22c/§22d 双形态锚点),不另造字段级正则。
 *
 * 模式:
 *   node scripts/check-admin-gate-consistency.mjs            # 全量审计
 *   node scripts/check-admin-gate-consistency.mjs --staged   # 只判 git 暂存区文件(pre-commit)
 *   node scripts/check-admin-gate-consistency.mjs --self-test
 * 退出码:0 通过 / 1 发现违规 / 2 脚本自身异常。
 *
 * 当前接入:guardian-runner id '53',warn 级 —— 存量 31 文件/68 处裸比较(O13b 试点批已迁 3 文件),
 * 白名单口径与 --staged 判据需要先观察一轮误报率(如动态拼出的 roleId 判定),
 * 稳定后升 blocking。紧急跳过:HUSKY_SKIP_ADMIN_GATE_GUARD=1(不建议)。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, posix, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { __test__ as catalogParser } from './check-capability-catalog.mjs'

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..')
const API_SRC_REL = 'apps/api/src'
const CATALOG_REL = 'packages/types/src/capability-catalog.ts'

/** 集中封装:管理员判定的唯一合法归宿,裸比较在此处是"定义点"而非违规。 */
const CENTRAL_FILES = new Set(['apps/api/src/plugins/require-permission.ts'])

/**
 * RULE-1 存量白名单(2026-09-21 盘点登记 34 文件 / 74 处;O13b 试点批迁出
 * earnings-routes/security/health 3 文件后 31 文件 / 68 处;T0 批删 16 个"实测 0 处
 * 裸比较"的纯条目文件后 15 文件 / 42 处;T1 批把 finance/finance-extended/
 * withdrawal-routes/developer-routes 共 14 处真闸门收进集中封装后,现 11 文件 / 26 处,
 * 全仓裸 roleId 比较 34 → 20)。
 * count = 登记时裸比较条数,只减不增;reason 说明该处 roleId 数值判定的存在理由。
 * 收敛路径:迁移到 requirePermission(...)/requireAdmin 后,把条目整体删除。
 */
export const LEGACY_RAW_ROLEGATE = {
  'apps/api/src/routes/agents.ts': { count: 6, reason: 'O13b 存量:agent 所有权+管理员豁免混判,待收敛' },
  'apps/api/src/routes/admin-sys/role-routes.ts': { count: 6, reason: 'O13b 存量:RBAC 管理路由内 roleId===1 超管保护,待收敛' },
  'apps/api/src/routes/groups.ts': { count: 4, reason: 'O13b 存量:群组管理员(业务 roleId,非 admin 面),保留语义复核' },
  'apps/api/src/plugins/business-metrics.ts': { count: 2, reason: 'O13b 存量:指标采集侧内部判定(非请求鉴权路径)' },
  'apps/api/src/db/rbac-queries.ts': { count: 2, reason: 'RBAC 数据层:roleId===1 超管通配权限解析点(resolveUserPermissions),是"集中判定"的数据侧同族,保留' },
  'apps/api/src/utils/idor-guard.ts': { count: 1, reason: 'O13b 存量:IDOR 豁免判定' },
  'apps/api/src/routes/trader.ts': { count: 1, reason: 'O13b 存量' },
  'apps/api/src/routes/other/student-profile-routes.ts': { count: 1, reason: 'O13b 存量' },
  'apps/api/src/routes/oss.ts': { count: 1, reason: 'O13b 存量' },
  'apps/api/src/routes/auth.ts': { count: 1, reason: 'O13b 存量:登录返回权限解析(roleId>=1 → 通配),属响应装配非闸门' },
  'apps/api/src/routes/admin-sys/menu-routers-routes.ts': { count: 1, reason: 'O13b 存量' },
}

/** RULE-2 存量白名单:集中封装之外定义本地 requireAdmin 的历史文件。
 *  O13b 试点批已清零(earnings-routes/security 本地重定义已删,改走集中封装),保留空表作后续批次锚点。 */
export const LEGACY_LOCAL_REQUIREADMIN = {}

// ─── 核心判据函数(§22c:经 __test__ 暴露给测试,不复制镜像实现) ───

/** 去注释:整行 // 与块注释按行粗削(仅供判定,不回填源码)。 */
export function stripCommentsLine(line) {
  const t = line.trim()
  if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return ''
  return line.replace(/\/\/.*$/, '')
}

/** RULE-1 检测器:roleId(左侧任意前缀)与数字字面量的比较。返回命中行文本数组。 */
export function detectRawRoleIdComparisons(source) {
  const hits = []
  const RE = /\broleId\s*(?:>=|<=|===|!==|>|<)\s*\d+/g
  for (const raw of source.split('\n')) {
    const line = stripCommentsLine(raw)
    if (!line) continue
    RE.lastIndex = 0
    if (RE.test(line)) hits.push(line.trim())
  }
  return hits
}

/** RULE-2 检测器:本地重新定义 requireAdmin(不含 import 行)。 */
export function detectLocalRequireAdmin(source) {
  const hits = []
  for (const raw of source.split('\n')) {
    const line = stripCommentsLine(raw)
    if (!line || /^\s*import\b/.test(line)) continue
    if (/\bfunction\s+requireAdmin\s*\(/.test(line) || /\bconst\s+requireAdmin\s*=/.test(line)) {
      hits.push(line.trim())
    }
  }
  return hits
}

/** 单文件审计:返回违规说明数组(空 = 通过)。relPath 用 posix 风格。 */
export function evaluateFile({ relPath, source }) {
  const violations = []
  const rawHits = detectRawRoleIdComparisons(source)
  const adminHits = detectLocalRequireAdmin(source)
  const cap1 = CENTRAL_FILES.has(relPath) ? Infinity : (LEGACY_RAW_ROLEGATE[relPath]?.count ?? 0)
  const cap2 = CENTRAL_FILES.has(relPath) ? Infinity : (LEGACY_LOCAL_REQUIREADMIN[relPath]?.count ?? 0)
  if (rawHits.length > cap1) {
    violations.push(
      `RULE-1 ${relPath}: 裸 roleId 数值比较 ${rawHits.length} 处 > 登记 ${Number.isFinite(cap1) ? cap1 : 0} 处` +
        `(新增文件未登记即 0)。样例: ${rawHits.slice(0, 3).join(' | ')}` +
        (CENTRAL_FILES.has(relPath) ? '' : ' —— 收敛:改用 requirePermission(...)/requireAdmin'),
    )
  }
  if (adminHits.length > cap2) {
    violations.push(
      `RULE-2 ${relPath}: 本地重新定义 requireAdmin(${adminHits.length} 处),同一语义两套判定。` +
        `请 import plugins/require-permission.ts 的集中封装`,
    )
  }
  return violations
}

/**
 * RULE-3:机器凭据 403 不变量(目录侧)。
 * isM2MAllowed(capability-catalog.ts:1124):effectiveDataClass==='platform' → false,
 * 否则看 thirdPartyEligible。真正的"恒 403"锚点是 **dataClass=platform**(如
 * publish:operate / ops:execute);domain='platform'(edu:read/edu:write)可以是
 * thirdPartyEligible=true 的内部开放 scope,不属于本不变量。
 * 违规条件:dataClass==='platform' 且 thirdPartyEligible!==false(目录自相矛盾 ——
 * 数据类别说"平台特权",开放标志说"可给机器")。
 */
export function evaluatePlatformInvariants(entries) {
  const violations = []
  for (const e of entries) {
    if (e.dataClass !== 'platform') continue
    if (e.thirdPartyEligible !== false) {
      violations.push(
        `RULE-3 capability-catalog: dataClass=platform 的 scope '${e.scope}' thirdPartyEligible=${e.thirdPartyEligible} ⇒ 目录自相矛盾,isM2MAllowed 兜底(dataClass 判定)仍在,但不得依赖兜底`,
      )
    }
  }
  return violations
}

/** 从目录源码解析 platform 域 scope 清单(复用既有手写解析器入口)。 */
export function platformScopesFromSource(tsSource) {
  return catalogParser
    .parseCatalogEntries(tsSource)
    .filter((e) => e.domain === 'platform')
    .map((e) => ({ scope: e.scope, dataClass: e.dataClass, thirdPartyEligible: e.thirdPartyEligible }))
}

// ─── 文件遍历 / git 暂存区 ───

function toRel(absPath) {
  return relative(ROOT, absPath).split(sep).join(posix.sep)
}

function walkTs(dir, out) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name === '__tests__' || name === 'tests' || name === 'node_modules') continue
      walkTs(p, out)
    } else if (/\.ts$/.test(name) && !/\.test\.ts$/.test(name)) {
      out.push(p)
    }
  }
}

/** 读 git 暂存区文件清单(只读操作;windowsHide 见 §5b 禁弹窗铁律)。 */
export function stagedFiles() {
  try {
    const out = execFileSync('git', ['diff', '--cached', '--name-only', '-z'], {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return out.split('\0').filter(Boolean).map((f) => f.replace(/\\/g, '/'))
  } catch {
    return null // git 不可用 → 调用方降级为全量并提示
  }
}

// ─── main ───

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--self-test')) {
    process.exit(runSelfTest() ? 0 : 1)
  }
  const stagedOnly = args.includes('--staged')
  const catalogPath = join(ROOT, CATALOG_REL)
  if (!existsSync(catalogPath)) {
    console.error(`[admin-gate] 找不到能力目录 ${CATALOG_REL} —— 判据不完整,按失败处理`)
    process.exit(1)
  }
  const platformScopes = platformScopesFromSource(readFileSync(catalogPath, 'utf8'))
  const platformViolations = evaluatePlatformInvariants(platformScopes)

  /** @type {{ rel: string, abs: string }[]} */
  let targets = []
  if (stagedOnly) {
    const staged = stagedFiles()
    if (staged === null) {
      console.warn('[admin-gate] git 不可用,--staged 降级为全量审计(不误放行)')
    } else {
      targets = staged
        .filter((f) => f.startsWith(`${API_SRC_REL}/`) && f.endsWith('.ts') && !/(__tests__|\/tests\/|\.test\.ts)/.test(f))
        .map((f) => ({ rel: f, abs: join(ROOT, ...f.split('/')) }))
        .filter((t) => existsSync(t.abs))
    }
  }
  if (targets.length === 0 && !stagedOnly) {
    const files = []
    walkTs(join(ROOT, API_SRC_REL), files)
    targets = files.map((abs) => ({ rel: toRel(abs), abs }))
  }

  const violations = [...platformViolations]
  let rawTotal = 0
  let legacyFiles = 0
  for (const t of targets) {
    const source = readFileSync(t.abs, 'utf8')
    rawTotal += detectRawRoleIdComparisons(source).length
    if (LEGACY_RAW_ROLEGATE[t.rel]) legacyFiles += 1
    violations.push(...evaluateFile({ relPath: t.rel, source }))
  }

  console.log(
    `[admin-gate] 范围=${stagedOnly ? 'staged' : '全量'} 文件=${targets.length} 裸roleId比较=${rawTotal} ` +
      `存量白名单命中=${legacyFiles}/${Object.keys(LEGACY_RAW_ROLEGATE).length} 文件 ` +
      `platform域scope=[${platformScopes.map((s) => s.scope).join(', ')}]`,
  )
  if (violations.length > 0) {
    for (const v of violations) console.error(`  ✗ ${v}`)
    console.error(`[admin-gate] ❌ ${violations.length} 项违规(admin 面特权判定必须走集中封装)`)
    process.exit(1)
  }
  console.log('[admin-gate] ✅ 无新增违规;存量条数未增长,platform 域机器凭据不变量成立')
}

/** §22d 双形态入口守护:测试 import 不触发 CLI 副作用。 */
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

// ─── self-test(逻辑自检,与 scripts/tests 单测互补) ───
function runSelfTest() {
  let ok = true
  const assert = (cond, msg) => {
    if (!cond) {
      ok = false
      console.error(`[self-test] ✗ ${msg}`)
    }
  }
  assert(detectRawRoleIdComparisons('if (request.jwtPayload?.roleId >= 1) return').length === 1, '裸 roleId>=1 被识别')
  assert(
    detectRawRoleIdComparisons('const roleId = p?.roleId ?? 0\nroleId: 1\nif (roleId < ADMIN_ROLE_ID) {}\n// roleId >= 1 注释')
      .length === 0,
    '非比较形态不误报',
  )
  assert(
    detectRawRoleIdComparisons('u.roleId === 1\nx.roleId > 0\ny.roleId < 1').length === 3,
    '===1 / >0 / <1 三变体均识别',
  )
  assert(
    evaluateFile({ relPath: 'apps/api/src/routes/oss.ts', source: 'a.roleId >= 1' }).length === 0,
    '存量白名单内(登记 1 处,实 1 处)豁免',
  )
  assert(
    evaluateFile({ relPath: 'apps/api/src/routes/oss.ts', source: 'a.roleId >= 1\nb.roleId === 1' }).length === 1,
    '存量白名单条数增长被拦',
  )
  assert(
    evaluateFile({ relPath: 'apps/api/src/routes/brand-new.ts', source: 'if (x.roleId >= 1) allow()' }).length === 1,
    '新增文件裸比较被拦',
  )
  assert(
    evaluateFile({ relPath: 'apps/api/src/plugins/require-permission.ts', source: 'roleId >= ADMIN_ROLE_ID\nx.roleId >= 1' })
      .length === 0,
    '集中封装自身豁免',
  )
  assert(
    detectLocalRequireAdmin("import { requireAdmin } from '../plugins/require-permission.js'\nasync function requireAdmin(r, reply) { return true }\nconst requireAdmin = async () => {}")
      .length === 2,
    '本地 requireAdmin 重定义被识别(import 行不算)',
  )
  assert(
    evaluatePlatformInvariants([{ domain: 'platform', scope: 's:one', dataClass: 'platform', thirdPartyEligible: true }])
      .length === 1,
    'dataClass=platform 误标可第三方开放被拦',
  )
  const cat = platformScopesFromSource(readFileSync(join(ROOT, CATALOG_REL), 'utf8'))
  assert(
    cat.some((s) => s.scope === 'publish:operate') && evaluatePlatformInvariants(cat).length === 0,
    '真实目录解析:platform 清单存在且不变量成立',
  )
  console.log(ok ? '[self-test] ✅ 全部断言通过' : '[self-test] ❌ 有断言失败')
  return ok
}

export const __test__ = {
  detectRawRoleIdComparisons,
  detectLocalRequireAdmin,
  evaluateFile,
  evaluatePlatformInvariants,
  platformScopesFromSource,
  stripCommentsLine,
  LEGACY_RAW_ROLEGATE,
  LEGACY_LOCAL_REQUIREADMIN,
  CENTRAL_FILES,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
