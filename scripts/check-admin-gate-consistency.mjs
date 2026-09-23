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
 * 存量白名单(2026-09-21 盘点登记 34 文件 / 74 处;O13b 各批迁出后,2026-09-24 按
 * 「来源排除」新判据重算 → 8 文件 / 23 处 → 5 文件 / 12 处)。
 * **额度取"实判红"而非"文本命中数"** —— 入参校验形态(如 `parseNum(q.roleId)` → 400)
 * 已被 classifyRawRoleIdHits 按来源排除,不再占用额度;role-routes / rbac-queries / auth
 * 三条因此归零并删除(留 count=0 会被本文件 self-test 的表卫生断言拦下)。
 * 盘点流水(自 34 文件起):O13b 试点批迁出
 * earnings-routes/security/health 3 文件后 31 文件 / 68 处;T0 批删 16 个"实测 0 处
 * 裸比较"的纯条目文件后 15 文件 / 42 处;T1 批把 finance/finance-extended/
 * withdrawal-routes/developer-routes 共 14 处真闸门收进集中封装后 15→11 文件;
 * T2 批把 trader/oss/student-profile-routes 3 处"属主‖管理员"混合闸的特权读数
 * 收进集中谓词 isSystemAdmin(属主分支留调用处)后一度为 8 文件 / 23 处,裸 roleId 比较 34→17;
 * 2026-09-24 再按来源排除重算 → 5 文件 / 12 处:17 处文本命中里 5 处是入参校验,
 * 按新判据不再占用额度,故 role-routes / rbac-queries / auth 三条归零删除)。
 * count = 登记时裸比较条数,只减不增;reason 说明该处 roleId 数值判定的存在理由。
 * 收敛路径:迁移到 requirePermission(...)/requireAdmin 后,把条目整体删除。
 */
export const LEGACY_RAW_ROLEGATE = {
  'apps/api/src/routes/agents.ts': { count: 5, reason: 'O13b 存量:agent 所有权+管理员豁免混判,待收敛' },
  'apps/api/src/routes/groups.ts': { count: 4, reason: 'O13b 存量:群组管理员(业务 roleId,非 admin 面),保留语义复核' },
  'apps/api/src/plugins/business-metrics.ts': { count: 1, reason: 'O13b 存量:指标采集侧内部判定(非请求鉴权路径)' },
  'apps/api/src/utils/idor-guard.ts': { count: 1, reason: 'O13b 存量:IDOR 豁免判定' },
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

/** RULE-1 的来源排除(O13b④ 升 blocking 的前置,2026-09-23 立) ──────────────
 * 问题:`if (roleId < 1)` 这一种文本形态同时承载两件完全不同的事 ——
 *   ① 特权判定(应收敛到集中封装):`const roleId = request.jwtPayload?.roleId ?? 0` → 403
 *      (真例 apps/api/src/plugins/business-metrics.ts:518)
 *   ② 入参合法性校验(与特权毫无关系,不该被拦):`const roleId = parseNum(q.roleId) ?? 0`
 *      → 400 'roleId 无效'(真例 apps/api/src/routes/admin-sys/role-routes.ts:102)
 * 两者**逐字符几乎一样**,只有 roleId 的来源能区分。warn 级时不致命,升 blocking 后
 * 就是"任何新写的 roleId 入参校验一律被拦",把一个正确写法永久锁成红点。
 *
 * 判据只认**来源回溯**,且三条护栏全部偏保守(宁可漏放排除,绝不误放真鉴权):
 *   · 命中行左侧必须是裸标识符 —— `user.roleId >= 1` 这类属性访问直接判红,不进排除通道。
 *   · AUTH 证据优先于 PARAM 证据:同一 RHS 两者都命中时按鉴权处理。
 *   · 回溯两跳仍解析不到声明 ⇒ unknown ⇒ 判红(窗口 12 行,越界即放弃,不猜)。
 */
const PROVENANCE_LOOKBACK = 12
// 明确来自已鉴权主体 ⇒ 特权判定,永不排除
const AUTH_PROVENANCE_RE =
  /\b(?:jwtPayload|jwt|claims|principal|authState|session|currentUser|loginName|user|userInfo)\b|\b(?:request|req)\s*\.\s*user\b/
// 明确来自请求载荷 ⇒ 入参校验
const PARAM_PROVENANCE_RE = /\b(?:request|req)\s*\.\s*(?:params|query|body|searchParams|headers)\b/

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * 找 `<name>` 的初始化表达式 RHS。三种形态都要认:
 *   ① `const roleId = <rhs>`                                  —— 单行
 *   ② `const { roleId, userId } = <rhs>`                      —— zod 解构(role-routes.ts:145 真例)
 *   ③ `const parsed = z.object({…}).safeParse(request.body)` —— 声明跨多行,须括号配平后累加
 * 只认紧邻声明,不回溯二次赋值。窗口上下各 PROVENANCE_LOOKBACK 行,越界返回 null(不猜)。
 */
function findDeclaration(name, lines, fromIdx) {
  const plain = new RegExp(`\\b(?:const|let|var)\\s+${escRe(name)}\\s*(?::[^=;]*)?=\\s*(.+)`)
  const destruct = new RegExp(`\\b(?:const|let|var)\\s*\{([^}]*)\}\\s*(?::[^=;]*)?=\\s*(.+)`)
  for (let j = fromIdx; j >= 0 && fromIdx - j <= PROVENANCE_LOOKBACK; j--) {
    const l = stripCommentsLine(lines[j])
    if (!l) continue
    const dm = l.match(destruct)
    if (dm) {
      const keys = dm[1].split(',').map((k) => k.split(':').pop().trim().split(/\s+/)[0])
      if (keys.includes(name)) return { rhs: collectInitializer(dm[2], lines, j), idx: j }
    }
    const m = l.match(plain)
    if (m) return { rhs: collectInitializer(m[1], lines, j), idx: j }
  }
  return null
}

/**
 * 从片段起向下累加,直到"括号配平 **且** 下一行不是链式续行"。
 * 只判配平会漏掉本仓真实写法 `const parsed = roleUserSchema` ↵ `.object({…})` ↵
 * `.safeParse(request.body)` —— 第一行括号就是平衡的,不认链式就永远取不到 request.body,
 * 于是这处入参校验被留在判红侧(role-routes.ts:145 实测踩过)。
 */
function collectInitializer(first, lines, idx) {
  const balance = (s) => {
    let d = 0
    for (const ch of s) {
      if (ch === '(' || ch === '{' || ch === '[') d++
      else if (ch === ')' || ch === '}' || ch === ']') d--
    }
    return d
  }
  let acc = first
  let depth = balance(first)
  let j = idx + 1
  while (j < lines.length && j - idx <= PROVENANCE_LOOKBACK) {
    const raw = lines[j]
    const more = stripCommentsLine(raw)
    if (!more) {
      j++
      continue
    }
    const isContinuation = /^\s*\./.test(raw) // 以 `.` 起头 = 链式续行
    if (depth <= 0 && !isContinuation) break
    acc += '\n' + more
    depth += balance(more)
    j++
  }
  return acc
}

/**
 * 一个 RHS 的 provenance:'param' | 'auth' | 'unknown'。
 * 支持 `<ident>.<prop>` 与 `fn(<ident>.<prop>)` 两种间接形态,各再回溯一跳(depth≤2)。
 */
function provenanceOf(rhs, lines, idx, depth = 0) {
  if (AUTH_PROVENANCE_RE.test(rhs)) return 'auth' // 安全兜底:先判鉴权
  if (PARAM_PROVENANCE_RE.test(rhs)) return 'param'
  if (depth >= 2) return 'unknown'
  // 取 RHS 里第一个 `<宿主>.<属性>` 的宿主名(如 q.roleId / parsed.data / body.roleId)
  const m = rhs.match(/\b([A-Za-z_$][\w$]*)\s*\.\s*[A-Za-z_$][\w$]*\b/)
  if (!m) return 'unknown'
  const host = m[1]
  if (AUTH_PROVENANCE_RE.test(host)) return 'auth'
  const decl = findDeclaration(host, lines, idx - 1)
  if (!decl) return 'unknown'
  return provenanceOf(decl.rhs, lines, decl.idx, depth + 1)
}

/**
 * 把 RULE-1 命中分成 { violations, excluded }。
 * ⚠️ 命中判据必须与 detectRawRoleIdComparisons **逐字同一条正则** —— 首版在这里
 * 把左侧放宽成"任意标识符",于是 `pending.length === 0` / `urls.length > 0` 全被算成
 * roleId 违规,全量从 17 处暴涨到 550 处。故本函数**只决定排除,绝不扩大命中集合**:
 * 命中集合由旧 RE 定义,排除只是它的一个子集。
 * excluded 必须如实报数,否则日后有人拿它当"这道门看不见 roleId 了"的旁路。
 */
export function classifyRawRoleIdHits(source) {
  const lines = source.split('\n')
  const violations = []
  const excluded = []
  // 与 RULE-1 检测器同一条:必须有 roleId 这个词在前
  const RE = /\broleId\s*(?:>=|<=|===|!==|>|<)\s*\d+/g
  lines.forEach((raw, i) => {
    const line = stripCommentsLine(raw)
    if (!line) return
    RE.lastIndex = 0
    if (!RE.test(line)) return
    // `x.roleId >= 1` 这类属性访问(含 `user.roleId` / `payload.roleId`)一律留在判红侧:
    // 它读的就是"某对象上的角色",无从证明它是入参,不排除。
    if (/[A-Za-z_$][\w$]*\s*\.\s*roleId\s*(?:>=|<=|===|!==|>|<)\s*\d/.test(line)) {
      violations.push(line.trim())
      return
    }
    const decl = findDeclaration('roleId', lines, i - 1)
    const prov = decl ? provenanceOf(decl.rhs, lines, decl.idx) : 'unknown'
    if (prov === 'param') excluded.push({ line: line.trim(), at: i + 1 })
    else violations.push(line.trim())
  })
  return { violations, excluded }
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
  const { violations: rawHits, excluded } = classifyRawRoleIdHits(source)
  const adminHits = detectLocalRequireAdmin(source)
  const cap1 = CENTRAL_FILES.has(relPath) ? Infinity : (LEGACY_RAW_ROLEGATE[relPath]?.count ?? 0)
  const cap2 = CENTRAL_FILES.has(relPath) ? Infinity : (LEGACY_LOCAL_REQUIREADMIN[relPath]?.count ?? 0)
  if (rawHits.length > cap1) {
    violations.push(
      `RULE-1 ${relPath}: 裸 roleId 数值比较 ${rawHits.length} 处 > 登记 ${Number.isFinite(cap1) ? cap1 : 0} 处` +
        `(新增文件未登记即 0)。样例: ${rawHits.slice(0, 3).join(' | ')}` +
        (excluded.length ? ` [另有 ${excluded.length} 处已按来源判为入参校验而排除]` : '') +
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
  let excludedTotal = 0
  let legacyFiles = 0
  for (const t of targets) {
    const source = readFileSync(t.abs, 'utf8')
    // ⚠️ 统计口径必须与判绿口径同源:此前 rawTotal 走 detectRawRoleIdComparisons(未排除),
    // 而判绿走 evaluateFile(已排除),于是加了来源排除后结论行仍报旧数,读报告的人会以为
    // "排除没生效"。两者必须一致,且 excluded 要如实打印 —— 排除不可见就等于旁路。
    const cls = classifyRawRoleIdHits(source)
    rawTotal += cls.violations.length
    excludedTotal += cls.excluded.length
    if (LEGACY_RAW_ROLEGATE[t.rel]) legacyFiles += 1
    violations.push(...evaluateFile({ relPath: t.rel, source }))
  }

  console.log(
    `[admin-gate] 范围=${stagedOnly ? 'staged' : '全量'} 文件=${targets.length} 裸roleId比较=${rawTotal} ` +
      `已按来源排除的入参校验=${excludedTotal} ` +
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
  // ── 来源排除(升 blocking 的前置)。夹具全部内联,不写死真实路径 ──
  assert(
    classifyRawRoleIdHits('if (pending.length === 0) return 0\nif (urls.length > 0) {').violations.length === 0,
    '非 roleId 的比较行一律不得计入(首版把命中正则放宽到任意标识符,全量从 17 暴涨到 550)',
  )
  assert(
    classifyRawRoleIdHits('const roleId = request.jwtPayload?.roleId ?? 0\nif (roleId < 1) {\n  return reply.status(403).send()\n}').violations.length === 1,
    'jwtPayload 来源 = 真特权判定,必须判红(安全兜底:误放等于让裸鉴权隐形)',
  )
  assert(
    classifyRawRoleIdHits('const q = request.query as Record<string, string>\nconst roleId = parseNum(q.roleId) ?? 0\nif (roleId < 1) {\n  return reply.status(400).send(error(400, "roleId 无效"))\n}').excluded.length === 1,
    'query → parseNum 一跳可回溯到 request.query 的,判为入参校验并排除',
  )
  {
    const zodSrc = [
      'const parsed = roleUserSchema',
      '  .object({',
      '    userId: z.number().int(),',
      '  })',
      '  .safeParse(request.body)',
      'const { roleId, userId } = parsed.data',
      'if (roleId < 1) {',
      '  return reply.status(400).send()',
      '}',
    ].join('\n')
    const r = classifyRawRoleIdHits(zodSrc)
    assert(
      r.excluded.length === 1 && r.violations.length === 0,
      `zod 解构 + 链式换行(.safeParse(request.body) 独占行)必须能回溯并排除,实得 排除=${r.excluded.length} 判红=${r.violations.length}`,
    )
  }
  assert(
    classifyRawRoleIdHits('if (user.roleId >= 1) return next()').violations.length === 1,
    '属性访问形态(user.roleId)不得进排除通道 —— 它读的就是主体上的角色',
  )
  assert(
    classifyRawRoleIdHits('if (roleId < 1) return 400').violations.length === 1,
    '回溯不到声明 ⇒ unknown ⇒ 判红(宁不误放)',
  )
  assert(
    classifyRawRoleIdHits(
      Array(30).fill('const unrelated = 1').concat(['if (roleId < 1) return 400']).join('\n'),
    ).violations.length === 1,
    '声明超出回溯窗口 ⇒ 不猜 ⇒ 判红',
  )
  assert(
    classifyRawRoleIdHits('const roleId = request.jwtPayload?.roleId ?? request.query.roleId\nif (roleId < 1) return 403').violations.length === 1,
    'RHS 同时含鉴权与参数证据 ⇒ 按鉴权处理(冲突时偏保守)',
  )
  // 夹具不得写死路径:白名单条目会随 O13b 收敛被删,写死会让 self-test 在收敛成功当天变红
  // (T2 批删掉 oss.ts 条目即触发过一次)。改为从表里取一条 count===1 的条目当探针。
  const probe = Object.entries(LEGACY_RAW_ROLEGATE).find(([, v]) => v.count === 1)?.[0]
  assert(
    !!probe,
    '自测前置:白名单需至少一条 count===1 的条目(若已全清,本两条夹具应随判据一起删除)',
  )
  assert(
    evaluateFile({ relPath: probe ?? '(无探针)', source: 'a.roleId >= 1' }).length === 0,
    `存量白名单内(${probe} 登记 1 处,实 1 处)豁免`,
  )
  assert(
    evaluateFile({ relPath: probe ?? '(无探针)', source: 'a.roleId >= 1\nb.roleId === 1' }).length === 1,
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
