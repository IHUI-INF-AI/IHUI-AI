// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

// 圆角**角色档一致性**对账 —— 「这一类元素该取哪一档」的第一把尺子。
//
// 立因(为什么必须新起一道门,而不是把守门 77 改严):
//  `packages/design-tokens/src/radius.js` 的 `RADIUS_STEPS` 只把档位**值**收成一份;
//  2026-09-27 新增的 `RADIUS_ROLES` 才第一次写下「card→lg / control→sm / chip→md /
//  panel→xl / hero→2xl / tiny→xs」这张**角色 → 档位**表。但表落地当天只有 AGENTS §4 一句
//  散文约束,没有任何判据问过「一枚卡片是不是取了 card 档」。守门 77 判的是「有没有绕开档位表
//  写死数字」—— 两端各自规矩地引用 token 时它一路报绿(HEAD 面实测 0 违规),所以
//  「同一个元素两端各按直觉选档」这一型**两台尺子互相指认、无人看守**,即用户实拍
//  「App 端、小程序端还有那么多容器圆角没按 token」的成因。本门补的就是这一格。
//
// 判据三条(缺一不可,任一条单独用都会满天假红):
//  C1 **取用形态**:七类写法全部要看见(含 `rounded-t-xl` 方向形态、`rnRadius['2xl']` 括号形态、
//     `borderRadius: '8px'` 字符串形态、CSS `border-radius: 8px 8px 0 0` 四值简写与方向变体)
//     —— 方向形态是既有解析的实测盲区,本门不得复制它。
//  C2 **类别证据**:角色只由证据推出(形态自带 `rnRadiusFor.<role>` / 同条声明的 `RADIUS_ROLES.<role>`
//     / 样式键·CSS 类·JSX 组件·className 的**头词元**命中角色词元表),**不做语义猜**。
//  C3 **档位比**:实际 px 与该角色的应有 px 比(两数都来自被审面上的那张表,门内零抄表)。
//
// 三态与诚实性(本仓最高频失效型就是"把没判写成判过了"):
//  · 判红 = 一条元素有**恰好一个**类别信号、档位表读得出该角色、而实际档 ≠ 应有档;
//  · 未判定 = 同一条上出现**多个**类别信号(冲突)/ 角色或档位名查表落空 / 值不在档位表上
//    —— **逐条报名**,`--strict` 下有未判定即 exit 2(拒绝出具合格证);
//  · 不在射程 = 取用存在但**没有任何**类别信号(匿名块、utility 串里没有角色词元)——
//    它既不是"判过"也不是"判不出",结论行按第四个数字单列,`--all` 可逐条列出。
//    把这一格并进"未判定"会造出一台永远洗不清的恒红门,并进"通过"就是把没判写成判过了。
//
// 存量不得判红(立门即恒红是本仓最高反面教训,唯一结局是逼人绕过钩子、连带全部守门作废):
//  棘轮锚点 = **该文件 HEAD 自身的「文件 × 角色」违规数**,键粒度到角色为止 —— 只到文件层的
//  锚点会让"把一处 card 改成 control 写法"净零逃逸(守门 134 扩布尔档键时同一课)。
//
// 人工出口 `radius-role-exempt: <原因>`:必须带原因(裸标记、以及"裸标记 + 注释闭合符冒充原因"
//  都不放行),且只在命中行或其紧邻上一行生效。30 天存活期由守门 108 管 —— **须由主会话把
//  `radius-role-exempt` 登记进 `FAMILY_LIFETIME_DAYS`,本票不改那个文件**(并行改注册表必互撞)。
//
// ⚠️ 本门**刻意不自行接进提交链**:注册表由主会话单写(门 93/128 记过同型覆盖事故)。
//    接线条目建议值(编号请现读空闲号,勿照抄本文):
//      id: <当次空闲号>, mode: 'blocking', skipEnv: 'HUSKY_SKIP_RADIUS_ROLE_CONFORMANCE',
//      script: 'scripts/check-radius-role-conformance.mjs',
//      stagedTriggers: ['apps/', 'packages/'],   // 圆角取用可发生在任意 UI 路径,收窄会放过整类
//    接线前置:① 首次入锚(--emit-baseline 的产物进 scripts/radius-role-conformance-baseline.json,
//    与门体**同枚**提交 —— 注册指向不存在的脚本/台账是 README 门那晚的事故);② HEAD 面默认档 exit 0。
//    接线后必须复验**落在哪个数组**:runner 的迭代入口是 `pushGate ? pushGateChecks : checks`,
//    实测本门第一次被并进的是 pushGateChecks —— grep 注册表查得到、全量批 180 道门里没有它,
//    这种"装在另一条链上"的形态比没装更难发现(镜像 T1 现在钉的就是这一条)。
//
// 用法:
//   node scripts/check-radius-role-conformance.mjs                # 全量(HEAD blob),存量不判红
//   node scripts/check-radius-role-conformance.mjs --staged       # 索引 blob(提交链用)
//   node scripts/check-radius-role-conformance.mjs --strict       # 有未判定 ⇒ exit 2(拒绝出合格证)
//   node scripts/check-radius-role-conformance.mjs --json         # stdout 只有 JSON
//   node scripts/check-radius-role-conformance.mjs --all          # 连"不在射程"那格也逐条列出
//   node scripts/check-radius-role-conformance.mjs --files <a> <b>  # 按文件自验(仍判被审面)
//   node scripts/check-radius-role-conformance.mjs --emit-baseline  # 重出锚点(只允许下降)
//   node scripts/check-radius-role-conformance.mjs --self-test    # 判据自检(含真仓阳性对照)
//   人工排查:--worktree(会大声打印"正在按磁盘判",不得作为结论)
//
// @ts-check

import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { catBatch, gitRaw, readWorktreeFile, selectFace, Undetermined } from './lib/face-reader.mjs'
import { isRadiusExemptAt, radiusLookup, blockOwnerOf } from './lib/radius-tokens.mjs'
import { maskCommentsAndStrings } from './lib/code-mask.mjs'
import { isExcludedDirName } from './lib/exclude-dirs.mjs'
import {
  CORNER_NAMES,
  ROLE_STEMS,
  classStringsInLine,
  headToken,
  isRoleExemptAt,
  maskFaces,
  radiusFormsInLine,
  roleSpec,
  rolesInTable,
  rolesOfClassList,
  rolesOfName,
  stepNameForPx,
} from './lib/radius-roles.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const RADIUS_TABLE_REL = 'packages/design-tokens/src/radius.js'
const BASELINE_REL = 'scripts/radius-role-conformance-baseline.json'
const FACE_TXT = { head: 'HEAD blob', staged: '索引 blob', worktree: '工作树(磁盘)' }

/**
 * 扫描面 = 会**渲染界面**的源码。
 *  - 只走 `git ls-tree`/`ls-files`,不按磁盘枚举(共享工作树常年滞后 HEAD,且并行会话的
 *    半编辑态会把别人的在飞现场算成本仓债务 —— 守门 70/77/83 同取向);
 *  - 排除目录经 `isExcludedDirName` 与下方 TEST_RE 两轨;
 *  - OUT_OF_SCOPE 是**报名式**排除:每条带 why。没有这一格,"我没扫到"和"我声明不扫"
 *    就长得分不开,新增一个端等于静默绕开整道门(守门 77 的判据 C 同一条理由)。
 */
const UI_EXT = /\.(tsx|jsx|ts|js|css|scss|less)$/
const TEST_RE = /(^|\/)(?:tests?|__tests__|e2e|test)\//
const SPEC_RE = /\.(test|spec)\.[cm]?[jt]sx?$/
const GEN_RE = /(\.gen\.|\.generated\.|(^|\/)generated\/)/

export const OUT_OF_SCOPE = [
  {
    re: /^packages\/design-tokens\//,
    why: '档位表与派生副本自身(radius.js / tokens.css / rn-tokens.ts),真值一致性归守门 77 的 A 判据',
  },
  { re: /^packages\/i18n\//, why: '语言包与其构建产物,不渲染界面' },
  { re: /^packages\/database\//, why: 'schema 与迁移,不含 UI' },
  { re: /^packages\/types\//, why: '跨端类型声明(.d 语义),取值形态不是界面取用' },
  { re: /^apps\/api\//, why: '后端;swagger 主题等生成式 CSS 已由守门 77 的 B3 覆盖,本门判的是元素类别,后端无此概念' },
  { re: /^apps\/ai-service\//, why: 'Python 服务与发布内容渲染,不属"这个界面元素该取哪档"的射程' },
  { re: /(^|\/)(static|assets|public)\/.*\.(svg|png|jpg|jpeg|gif|webp)$/, why: '静态美术资产,rx/ry 是图形轮廓不是容器圆角' },
]

/** 角色词元表 ↔ 档位表 的对账(名单类判据必须能被自己发现腐烂)。 */
export function roleTableProblems(table) {
  const inTable = new Set(rolesInTable(table))
  const stemRoles = Object.keys(ROLE_STEMS)
  const problems = []
  for (const r of stemRoles) if (!inTable.has(r)) problems.push(r)
  return problems
}

/**
 * 单文件 → 三态结果(纯函数,夹具与被真仓 blob 都能喂,自检因此可端到端)。
 *
 * @param {string} rel 仓库相对路径(只用于点名)
 * @param {string} src 该文件在**被审面**上的正文
 * @param {Record<string, number>} table radiusLookup 的产物
 */
export function auditFileText(rel, src, table) {
  const out = {
    violations: [],
    undetermined: [],
    unclassified: [],
    weakFindings: [],
    compliant: 0,
    exempted: 0,
    usages: 0,
  }
  const rawLines = src.split('\n')
  // 注释与字符串的抹法只有一份实现(lib/code-mask.mjs);本门要的两面都由它派生(见 radius-roles)。
  const { code, kept } = maskFaces(src)
  const codeLines = code.split('\n')
  const keptLines = kept.split('\n')
  /** @type {{names: string[], indent: number}[]} */
  const stack = []
  let pending = ''
  for (let i = 0; i < keptLines.length; i++) {
    const line = keptLines[i]
    const t = line.trim()
    if (!t) continue
    const indent = line.length - line.trimStart().length
    const closer = /^[})\]]/.test(t)
    if (closer) while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop()
    let names = stack.length ? stack[stack.length - 1].names : []
    const opens = (line.match(/\{/g) || []).length
    const closes = (line.match(/[}\]]/g) || []).length
    if (opens > 0) {
      /**
       * 一行里可能有**多个** `{`(`const s = { card: { borderRadius: rnRadius.xl } }`),
       * 归属必须逐次重算并让**最后一个** `{` 的拥有者生效 —— 只取第一个会把整行的取用
       * 记到外层 `s` 头上,而 `s` 不是角色名 ⇒ 该族静默落"无类别证据"。
       * 实测这条就是第一版自检里 5 个"卡片判红"用例全绿的原因(判据看不见嵌套层)。
       */
      let prelude = pending
      pending = ''
      let from = 0
      let k
      while ((k = line.indexOf('{', from)) >= 0) {
        const seg = (prelude + ' ' + line.slice(from, k)).trim()
        const owner = blockOwnerOf(seg)
        if (owner.names.length) names = owner.names
        prelude = ''
        from = k + 1
      }
      if (closes < opens) stack.push({ names, indent })
    } else if (!closer && /^\.{1,2}[A-Za-z_]/.test(t)) {
      pending = (pending + ' ' + t).slice(-400)
      continue
    } else if (!closer) {
      pending = ''
    }
    const forms = radiusFormsInLine(line, table)
    if (!forms.length) continue
    out.usages += forms.length
    if (isRoleExemptAt(rawLines, i) || isRadiusExemptAt(rawLines, i)) {
      out.exempted += forms.length
      continue
    }
    /**
     * 证据分强弱,强弱不可混判(实测理由,不是偏好):
     *  - **强**:样式键 / CSS 类选择器 / JSX 组件标签 / 形态自带的 `rnRadiusFor.<role>` ——
     *    都是**作者给这个元素起的名字**,他说得出这是什么。
     *  - **弱**:`className` 串里的颜色实用类(`bg-card`、`text-panel` …)。它写的是**色档**,
     *    不是容器身份 —— 实测 `<button className="bg-card … rounded-md">`(退出登录按钮)
     *    被按"卡片应为 lg"判红,就是拿一个颜色名去要求改按钮圆角。**假阳比漏报更贵**:
     *    它指使人去改一个本来对的东西(门 118 记过同一课)。
     * 所以:有强证据时只用强证据;只有弱证据时**照判但只点名不判红**(单列一栏交人裁)。
     * 这样 DrawerComponent 的 `rounded-t-xl` 仍被点名(阳性对照成立),而颜色类名不再造红。
     */
    /** @type {Set<string>} */
    const strong = new Set()
    /** @type {Set<string>} */
    const weak = new Set()
    for (const n of names) for (const r of rolesOfName(n)) strong.add(r)
    const codeLine = codeLines[i] || ''
    for (const m of codeLine.matchAll(/<([A-Za-z][\w.]*[-\w.]*)/g)) {
      for (const r of rolesOfName(m[1].split(/[./]/).pop() || '')) strong.add(r)
    }
    const classText = classStringsInLine(codeLine, rawLines[i] || '').join(' ')
    if (classText) for (const r of rolesOfClassList(classText)) weak.add(r)

    for (const f of forms) {
      const rec = { file: rel, line: i + 1, form: f.form, kind: f.kind }
      if (f.dir || typeof f.slot === 'number') {
        const corner = f.dir || CORNER_NAMES[f.slot] || ''
        if (corner) rec.corner = corner
      }
      // 形态自带角色时它是唯一权威(写 `rnRadiusFor.panel` 的人已经把类别说清楚了)
      const roles = f.role ? new Set([f.role]) : strong.size ? strong : weak
      if (roles !== strong && roles !== weak) rec.declared = true
      else if (!strong.size && roles.size) rec.evidence = 'weak'
      if (f.px === null || !Number.isFinite(f.px)) {
        rec.reason = f.kind === 'role' ? 'role-not-in-table' : 'unknown-step'
        rec.detail = f.role || f.form
        out.undetermined.push(rec)
        continue
      }
      if (f.offScale) {
        rec.reason = 'off-scale'
        rec.detail = `${f.px}px 不在档位表上(绕档归守门 77)`
        out.undetermined.push(rec)
        continue
      }
      if (roles.size === 0) {
        rec.detail = `${f.px}px(${stepNameForPx(table, f.px)})无类别证据`
        out.unclassified.push(rec)
        continue
      }
      if (roles.size > 1) {
        rec.reason = 'role-conflict'
        rec.detail = [...roles].join('/')
        out.undetermined.push(rec)
        continue
      }
      const role = [...roles][0]
      const want = roleSpec(table, role)
      if (!want) {
        rec.reason = 'role-not-in-table'
        rec.detail = role
        out.undetermined.push(rec)
        continue
      }
      rec.role = role
      rec.actualPx = f.px
      rec.actualStep = stepNameForPx(table, f.px)
      rec.expectedStep = want.step
      rec.expectedPx = want.px
      if (f.px === want.px) out.compliant += 1
      else if (rec.evidence === 'weak') out.weakFindings.push(rec)
      else out.violations.push(rec)
    }
  }
  return out
}

/**
 * 锚点键 = `文件|角色`。文件级锚点会被"换个角色写法"净零逃逸绕过(门 134 的 BK1 同一课)。
 */
export function anchorKey(v) {
  return `${v.file}|${v.role}`
}

export function countByKey(violations) {
  const m = {}
  for (const v of violations) {
    const k = anchorKey(v)
    m[k] = (m[k] || 0) + 1
  }
  return m
}

/**
 * 棘轮:`本次计数 > 该键锚点` 才算红。锚点取**被审面的 HEAD/索引台账**,所以
 *  · 存量红不会变成人人跳门(默认档台账里都有锚);
 *  · 别人欠的债不算在本次提交头上(锚点是该文件自身的计数)。
 * 台账缺某个键 ⇒ 视作 0(新增即拦,不留"清单外免判"的空档)。
 */
export function applyRatchet(counts, anchors) {
  const red = []
  for (const [key, n] of Object.entries(counts)) {
    const cap = Number(anchors?.[key] ?? 0)
    if (n > cap) red.push({ key, count: n, cap })
  }
  return red.sort((a, b) => b.count - b.cap - (a.count - a.cap) || a.key.localeCompare(b.key))
}

/**
 * 台账只允许下降或持平;第一次入锚(空台账)除外。
 *
 * **新键带违规同样拒绝**:`--emit-baseline` 是一条命令就能跑的东西,若允许它往已建立的
 * 台账里塞新键,那每一次判红都可以被同一道命令洗成豁免 —— 棘轮就只剩"拦得住没人想起来
 * 重跑台账"的力度了。要把新发现的存量纳进台账,必须人工改 JSON(改动进 diff、可被 review)。
 */
export function anchorRegression(prev, next) {
  const had = Object.keys(prev || {}).length > 0
  if (!had) return []
  const bad = []
  for (const [k, cap] of Object.entries(prev || {})) {
    const n = Number(next?.[k])
    if (!Number.isFinite(n)) bad.push(`${k}:锚点消失(旧 ${cap})`)
    else if (n > cap) bad.push(`${k}:锚点上升 ${cap} → ${n}`)
  }
  for (const [k, n] of Object.entries(next || {})) {
    if (k in prev) continue
    if (Number(n) > 0) bad.push(`${k}:新键带账(${n})—— 台账一经建立只许下调,存量要纳管请人工改并写明理由`)
  }
  return bad
}

export function parseBaseline(text, label) {
  if (text === null || text === undefined) return null
  try {
    const j = JSON.parse(text)
    if (!j || typeof j !== 'object' || !j.anchors || typeof j.anchors !== 'object')
      throw new Error('缺 anchors 字段')
    return j
  } catch (e) {
    throw new Undetermined(`${label}解析失败:${e.message} —— 坏台账不得静默当空锚点用`)
  }
}

/** 清单按面取:`ls-tree` 不认 `--cached`,索引面只能走 `ls-files`;内容与清单**同面同轮**。 */
function listTracked(repoRoot, face) {
  const args = face === 'staged' ? ['ls-files'] : ['ls-tree', '-r', '--name-only', 'HEAD']
  const out = gitRaw(args, repoRoot, {})
  if (out === null || out === undefined) throw new Undetermined(`${FACE_TXT[face]}取不到文件清单`)
  return out
    .split('\n')
    .map((s) => s.trim().replaceAll('\\', '/'))
    .filter(Boolean)
}

export function isInScope(rel) {
  if (!UI_EXT.test(rel)) return false
  if (TEST_RE.test(rel) || SPEC_RE.test(rel) || GEN_RE.test(rel)) return false
  // 排除目录只认共享清单(构建产物 / 依赖 / 副本族)—— 各门自己抄一份 EXCLUDED 是本仓腐烂源头
  const segs = rel.split('/')
  if (segs.some((s) => isExcludedDirName(s))) return false
  // 点开头目录(`.github` 例外:workflow 里也会写样式)已由 isExcludedDirName 覆盖 .cache/.next 族,
  // 这里补的是"任何隐藏目录里的源码不参与 UI 对账"
  if (segs.some((s, i) => i < segs.length - 1 && s.startsWith('.') && s !== '.github')) return false
  return !OUT_OF_SCOPE.some((o) => o.re.test(rel))
}

/**
 * 全量/暂存档的取数与判定:一次 `cat-file --batch` 把**内容 + 档位表 + 台账**同面同轮读满。
 * 任一份取不到 ⇒ 抛 Undetermined(不冒红也不记绿);档位表解析成空 ⇒ 判失明。
 */
export function runAudit(repoRoot, face, { only } = {}) {
  let files = listTracked(repoRoot, face).filter(isInScope)
  if (only && only.length) {
    const want = new Set(only.map((p) => p.replaceAll('\\', '/').replace(/^\.?\//, '')))
    files = files.filter((f) => want.has(f))
    if (!files.length) throw new Undetermined(`--files 指定的路径一个都不在被审面里:${[...want].join(' ')}`)
  }
  if (!files.length) throw new Undetermined(`${FACE_TXT[face]}上枚举到 0 个在射程文件 —— 空扫不记绿`)
  const specs = [...files, RADIUS_TABLE_REL, BASELINE_REL].map((p) =>
    face === 'staged' ? `:${p}` : `HEAD:${p}`,
  )
  const got = catBatch(repoRoot, specs, { maxBuffer: 1 << 29, timeout: 180000 })
  const tableSrc = got.get(face === 'staged' ? `:${RADIUS_TABLE_REL}` : `HEAD:${RADIUS_TABLE_REL}`)
  if (tableSrc === null || tableSrc === undefined)
    throw new Undetermined(`${FACE_TXT[face]}取不到档位表 ${RADIUS_TABLE_REL} ⇒ 本门判据失明`)
  const table = radiusLookup(tableSrc)
  if (!table)
    throw new Undetermined(`${RADIUS_TABLE_REL} 在 ${FACE_TXT[face]} 上解析不出档位表(空表不等于零违规)`)
  const baseSpec = face === 'staged' ? `:${BASELINE_REL}` : `HEAD:${BASELINE_REL}`
  const baselineSrc = got.get(baseSpec)
  const baseline =
    baselineSrc === null || baselineSrc === undefined
      ? { anchors: {}, $note: '台账不在被审面上 —— 本次按"零锚点"判,任何存量都会判红(接线前须先入锚)' }
      : parseBaseline(baselineSrc, BASELINE_REL)
  const violations = []
  const undetermined = []
  const unclassified = []
  const weakFindings = []
  let usages = 0
  let exempted = 0
  let compliant = 0
  for (const rel of files) {
    const src = got.get(face === 'staged' ? `:${rel}` : `HEAD:${rel}`)
    if (src === null || src === undefined)
      throw new Undetermined(`${FACE_TXT[face]}取不到 ${rel}(清单与内容必须同面同轮)`)
    const r = auditFileText(rel, src, table)
    usages += r.usages
    exempted += r.exempted
    compliant += r.compliant
    violations.push(...r.violations)
    undetermined.push(...r.undetermined)
    unclassified.push(...r.unclassified)
    weakFindings.push(...r.weakFindings)
  }
  return {
    face,
    files,
    table,
    baseline,
    violations,
    undetermined,
    unclassified,
    weakFindings,
    usages,
    exempted,
    compliant,
    red: applyRatchet(countByKey(violations), baseline.anchors || {}),
    roleTableProblems: roleTableProblems(table),
  }
}

export function faceFromArgv(argv) {
  const { face, error } = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  if (error) throw new Undetermined(error)
  return face
}

/** 工作树档:只供人工排查,大声喊,不作为结论(两面旗同给已在 selectFace 里判死)。 */
function runAuditWorktree(repoRoot, only) {
  let files = listTracked(repoRoot, 'head').filter(isInScope)
  if (only && only.length) {
    const want = new Set(only.map((p) => p.replaceAll('\\', '/').replace(/^\.?\//, '')))
    files = files.filter((f) => want.has(f))
  }
  if (!files.length) throw new Undetermined('工作树档枚举到 0 个在射程文件 —— 空扫不记绿')
  const tableSrc = readWorktreeFile(repoRoot, RADIUS_TABLE_REL)
  if (tableSrc === null) throw new Undetermined(`磁盘上取不到 ${RADIUS_TABLE_REL}`)
  const table = radiusLookup(tableSrc)
  if (!table) throw new Undetermined('档位表解析不出内容(空表不判绿)')
  const baseSrc = readWorktreeFile(repoRoot, BASELINE_REL)
  const baseline = baseSrc ? parseBaseline(baseSrc, BASELINE_REL) : { anchors: {} }
  const violations = []
  const undetermined = []
  const unclassified = []
  const weakFindings = []
  let usages = 0
  let exempted = 0
  let compliant = 0
  for (const rel of files) {
    const src = readWorktreeFile(repoRoot, rel)
    if (src === null) continue
    const r = auditFileText(rel, src, table)
    usages += r.usages
    exempted += r.exempted
    compliant += r.compliant
    violations.push(...r.violations)
    undetermined.push(...r.undetermined)
    unclassified.push(...r.unclassified)
    weakFindings.push(...r.weakFindings)
  }
  return {
    face: 'worktree',
    files,
    table,
    baseline,
    violations,
    undetermined,
    unclassified,
    weakFindings,
    usages,
    exempted,
    compliant,
    red: applyRatchet(countByKey(violations), baseline.anchors || {}),
    roleTableProblems: roleTableProblems(table),
  }
}

export function emitBaseline(violations, baseline) {
  const anchors = { ...(baseline?.anchors || {}) }
  const counts = countByKey(violations)
  for (const [k, n] of Object.entries(counts)) anchors[k] = n
  /**
   * 本次读数为 0 的既有族**降到 0 而不是删键**:键消失与"台账被并发旧基线整文件回写"
   * 在账面上长得一模一样,而后者是本仓记过最多次的故障型(守门 83 的 R3 一天被回退三次)。
   * 留 0 同样严格(下次出现 1 处即 1 > 0 判红),但多了一处可核对的痕迹。
   */
  for (const k of Object.keys(anchors)) if (!(k in counts)) anchors[k] = 0
  return {
    $note:
      '圆角角色档一致性锚点(键 = 文件|角色,值 = 该文件该角色在被审面上的存量违规数)。' +
      '只拦"这次改动把该族的绕档加回来了",存量另计批清偿;键消失即视为台账被回写,拒绝落盘。',
    anchors,
  }
}

export function lineOf(v) {
  const corner = v.corner ? `[${v.corner}]` : ''
  return `  ${v.file}:${v.line}${corner} 角色 ${v.role} 取 ${v.actualStep}(${v.actualPx}px),应为 ${v.expectedStep}(${v.expectedPx}px) —— ${v.form}`
}

export async function main(argv = process.argv.slice(2), repoRoot = ROOT) {
  if (argv.includes('--self-test')) return await selfTest(repoRoot)
  const strict = argv.includes('--strict')
  const idx = argv.indexOf('--files')
  const only = idx >= 0 ? argv.slice(idx + 1).filter((a) => !a.startsWith('--')) : []
  let res
  try {
    const face = faceFromArgv(argv)
    res = face === 'worktree' ? runAuditWorktree(repoRoot, only) : runAudit(repoRoot, face, { only })
  } catch (e) {
    if (e instanceof Undetermined) {
      console.log(`⚠️ 无法判定:${e.message}`)
      return 2
    }
    throw e
  }
  if (argv.includes('--emit-baseline')) {
    const next = emitBaseline(res.violations, res.baseline)
    const regress = anchorRegression(res.baseline?.anchors || {}, next.anchors)
    if (regress.length) {
      console.error(`× 拒绝出台账:${regress.length} 条锚点上升/消失/新键带账(只允许下降或持平)`)
      for (const r of regress.slice(0, 20)) console.error(`  - ${r}`)
      return 1
    }
    console.log(JSON.stringify(next, null, 2))
    console.error(`台账按 ${FACE_TXT[res.face]} 面生成;逐条核过再放进 ${BASELINE_REL}`)
    return 0
  }
  const undetFileCount = new Set(res.undetermined.map((u) => u.file)).size
  if (argv.includes('--json')) {
    // stdout 只准出现 JSON:任何尾随说明行都会砸碎镜像测试的 JSON.parse
    console.log(
      JSON.stringify({
        face: res.face,
        scannedFiles: res.files.length,
        usages: res.usages,
        exempted: res.exempted,
        compliant: res.compliant,
        violationCount: res.violations.length,
        violations: res.violations,
        red: res.red,
        undetermined: res.undetermined,
        undeterminedCount: res.undetermined.length,
        unclassifiedCount: res.unclassified.length,
        unclassified: argv.includes('--all') ? res.unclassified : undefined,
        weakFindings: res.weakFindings,
        roleTableProblems: res.roleTableProblems,
        baselineAnchors: Object.keys(res.baseline?.anchors || {}).length,
        undetFileCount,
      }),
    )
  } else {
    if (res.face === 'worktree')
      console.log('⚠️⚠️ 正在按**磁盘**判(工作树档):共享工作树常年滞后 HEAD,本档只供人工排查,不得作为结论 ⚠️⚠️')
    console.log(
      `判定面 ${FACE_TXT[res.face]}:扫 ${res.files.length} 个在射程文件、读到 ${res.usages} 处圆角取用` +
        `(豁免 ${res.exempted} 处;台账锚点 ${Object.keys(res.baseline?.anchors || {}).length} 条)`,
    )
    if (res.roleTableProblems.length) {
      console.log(
        `  ✗ 档位表里读不到这些角色的档位:${res.roleTableProblems.join('/')} —— ` +
          '本门对该族**零判据**(证据表有词元、表里没档位)。成因在共享解析 `radiusLookup` 而不是本门,' +
          '修它之前不得把这一族读成"已收口"。',
      )
    }
    if (res.red.length) {
      console.log(`❌ 判红(${res.red.length} 个「文件×角色」族超出自身锚点):`)
      for (const r of res.red.slice(0, 40)) {
        const vs = res.violations.filter((v) => anchorKey(v) === r.key)
        console.log(`  ${r.key}:本次 ${r.count} 处 / 锚点 ${r.cap}`)
        for (const v of vs.slice(0, 5)) console.log(lineOf(v))
      }
      if (res.red.length > 40) console.log(`  …其余 ${res.red.length - 40} 族见 --json`)
    } else if (res.violations.length) {
      console.log(
        `◦ 读到 ${res.violations.length} 处角色档不一致,全部不超过各自文件的 HEAD 锚点 ⇒ 存量,不判红` +
          '(清一处就 `--emit-baseline` 下调,不得为过门调高)',
      )
    } else {
      console.log('✅ 未发现"类别与档位不同源"的取用(在射程内)')
    }
    if (res.undetermined.length) {
      console.log(
        `⚠ 未判定 ${res.undetermined.length} 处(分布在 ${undetFileCount} 个文件)—— 判不出不等于通过,逐条报名:`,
      )
      const byReason = {}
      for (const u of res.undetermined) byReason[u.reason] = (byReason[u.reason] || 0) + 1
      console.log('   成因分布:' + Object.entries(byReason).map(([k, v]) => `${k} ${v}`).join(' / '))
      for (const u of res.undetermined.slice(0, 30))
        console.log(`  ${u.file}:${u.line} [${u.reason}] ${u.detail ?? ''} —— ${u.form}`)
      if (res.undetermined.length > 30)
        console.log(`  …其余 ${res.undetermined.length - 30} 条:--json 全量 / --strict 会判死`)
    }
    if (res.weakFindings.length) {
      console.log(
        `◦ 弱证据档不一致 ${res.weakFindings.length} 处(类别只由 className 里的**颜色实用类**认出)` +
          ` ⇒ 只点名、不判红,逐条交人裁:`,
      )
      for (const v of res.weakFindings.slice(0, 15)) console.log(lineOf(v).replace(/^ {2}/, '   '))
      if (res.weakFindings.length > 15)
        console.log(`   …其余 ${res.weakFindings.length - 15} 条见 --json 的 weakFindings`)
    }
    console.log(
      `结论(五个体各算各的,谁也不替谁背书):判红 ${res.red.length} 族 / ` +
        `已判合规 ${res.compliant} 处(角色档一致)/ ` +
        `角色档不一致 ${res.violations.length} 处(其中超出自身锚点的就是上面 ${res.red.length} 族)/ ` +
        `弱证据待裁 ${res.weakFindings.length} 处(不判红)/ ` +
        `未判定 ${res.undetermined.length} 处(逐条报名,不是通过)/ ` +
        `不在射程 = 无类别证据的取用 ${res.unclassified.length} 处` +
        `${argv.includes('--all') ? '(--all 已逐条列出)' : '(--all 逐条列出)'}`,
    )
  }
  if (res.red.length) return 1
  if (strict && (res.undetermined.length || res.roleTableProblems.length)) return 2
  return 0
}

/** 自检:构造面 + 真仓 HEAD 阳性对照(两条同时成立才叫"遮罩关掉的是误报、不是判据")。 */
export async function selfTest(repoRoot = ROOT) {
  const results = []
  const t = (name, cond, extra = '') => results.push({ name, ok: !!cond, extra })
  const got = catBatch(repoRoot, [`HEAD:${RADIUS_TABLE_REL}`], { maxBuffer: 1 << 26 })
  const tableSrc = got.get(`HEAD:${RADIUS_TABLE_REL}`)
  const table = tableSrc ? radiusLookup(tableSrc) : null
  t('00 档位表从被审面解析得到(自检不得靠手抄数字跑)', !!table && table.lg === 8 && table.xl === 12)
  if (!table) {
    for (const r of results) console.log(`${r.ok ? '✅' : '❌'} ${r.name}${r.extra ? ` —— ${r.extra}` : ''}`)
    console.log('--self-test: 1 条,失败 1 条')
    return 1
  }
  const F = (line) => radiusFormsInLine(line, table)
  // 遮罩类用例必须走 `kept` 面 —— 直接把注释文本喂给 F 判的是"正则能不能匹配注释",
  // 而本门的实际取用面是 mask 之后的那一面(第一版自检就在 26/27/28 上判错了对象)。
  const FM = (line) => radiusFormsInLine(maskFaces(line).kept, table)
  const one = (line) => F(line)[0]
  // —— C1 取用形态:一条形态一个正反例,方向形态是既有解析的盲区,必须单独钉
  t('01 Tailwind 档名 rounded-lg → 8', one('x="rounded-lg"')?.px === 8)
  t('02 方向形态 rounded-t-xl → 12 且带角标(盲区不得复制)', one('x="rounded-t-xl"')?.px === 12 && one('x="rounded-t-xl"')?.dir === 't')
  t('03 角方向 rounded-tl-lg → 8', one('x="rounded-tl-lg"')?.dir === 'tl')
  t('04 裸 rounded → DEFAULT 档 8', one('x="flex rounded bg-card"')?.px === 8)
  t('05 任意值 rounded-[24rpx] → 12(rpx 折半)', one('x="rounded-[24rpx]"')?.px === 12)
  t('06 任意值 rounded-[16px] → 16', one('className="rounded-[16px]"')?.px === 16)
  t('07 任意值 rounded-[10px] 不在档位表上 → offScale(不猜一档)', one('x="rounded-[10px]"')?.offScale === true)
  t('08 CSS 变量 var(--radius-md) → 6', one('border-radius: var(--radius-md);')?.px === 6)
  t('09 裸 var(--radius) → 8', one('border-radius: var(--radius);')?.px === 8)
  t('10 rnRadius.xl 点号形态 → 12', one('r: rnRadius.xl')?.px === 12)
  t('11 rnRadius[\'2xl\'] 括号形态 → 16(§77 B6 同一课)', one(`r: rnRadius['2xl']`)?.px === 16)
  t('12 rnRadius.foo 查表落空 → px null(不得静默消失)', one('r: rnRadius.foo')?.px === null)
  t('13 rnRadius[step] 动态下标 → px null 并报名', one('r: rnRadius[step]')?.px === null)
  t('14 rnRadiusFor.panel → 自带角色 panel', one('r: rnRadiusFor.panel')?.role === 'panel')
  t('15 radiusFor[\'chip\'] 括号形态 → 角色 chip', one(`r: radiusFor['chip']`)?.role === 'chip')
  t('16 RADIUS_ROLES.card 同条声明 → 角色 card', one('x: RADIUS_ROLES.card')?.role === 'card')
  /**
   * 17 的原文是「`rnRadiusFor.hero` 表里无此档 → null」—— 它把**解析器丢项**当成了规格写进断言。
   * 角色表的值支以数字开头(`hero: '2xl'`)不被识别,role:hero 因此不存在,于是这条断言恒真,
   * 而真正该判的东西(hero 这一档)永不可判。修好解析器时它当场翻红,正是这条红把缺陷指出来的:
   * 断言不能只对"当前行为"负责,要对它**声称的那件事**负责。
   * 现拆成一对:表里真没有的角色必须 null(判据的原意),表里有的 hero 必须解出 16(不得再退回 null)。
   */
  t(
    '17 表里没有的角色 → null;表里有的 hero → 必须解出 16(成对,禁止把解析丢项当规格)',
    one('r: rnRadiusFor.notARoleAtAll')?.px === null && one('r: rnRadiusFor.hero')?.px === 16,
  )
  t('18 RN 数值属性 borderRadius: 12', one('borderRadius: 12,')?.px === 12)
  t('19 RN 方向属性 borderTopLeftRadius: 8', one('borderTopLeftRadius: 8,')?.px === 8 && one('borderTopLeftRadius: 8,')?.dir === 'TopLeft')
  t('20 **字符串形态** borderRadius: \'8px\'', one(`borderRadius: '8px',`)?.px === 8)
  t('21 字符串四值形态 "6px 6px 0 0" → 只收非零角', (() => {
    const fs = F(`borderRadius: "6px 6px 0 0",`)
    return fs.length === 2 && fs.every((x) => x.px === 6)
  })())
  t('22 CSS 声明 16rpx → 8', one('.a{border-radius:16rpx;}')?.px === 8)
  t('23 CSS 方向声明 border-top-left-radius 带 TopLeft', one('.a{border-top-left-radius:12px;}')?.dir === 'TopLeft')
  t('24 四值简写按位序分角(左上/右上/右下/左下)', (() => {
    const fs = F('.a{border-radius:2px 4px 6px 8px;}')
    return fs.length === 4 && fs.map((x) => x.slot).join() === '0,1,2,3'
  })())
  t('25 rounded-full / rounded-none / 50% 一律不收(正圆不是档位问题)', F('x="rounded-full"; border-radius: 50%; y="rounded-none"').length === 0)
  // —— 遮罩:注释不得冒充取用(走 kept 面,与生产路径同源)
  t('26 行注释里的 rounded-xl 不得计入', FM('// 这里写 rounded-xl 只是说明').length === 0)
  t('27 块注释里的 border-radius 不得计入', FM('/* border-radius: 24rpx */').length === 0)
  t('28 JSX 注释 {/* */} 里的形态不得计入', FM('{/* x="rounded-xl" */}').length === 0)
  t('29 真代码里的形态仍要计入(遮罩只关误报)', FM('const a = 1 // 说明').length === 0 && FM('a="rounded-xl"').length === 1)
  t('30 模板字符串里的假 className 不造类别证据(锚点判据面)', (() => {
    const s = 'const doc = `<Card className="rounded-xl">`'
    const { code, kept } = maskFaces(s)
    return radiusFormsInLine(kept, table).length === 1 && classStringsInLine(code, s).length === 0
  })())
  // —— C2/C3 端到端:元素类别 + 档位比
  const A = (src) => auditFileText('x/T.tsx', src, table)
  t('31 卡片取 xl ⇒ 判红(card/应为 lg)', A('const s = { card: { borderRadius: rnRadius.xl } }').violations[0]?.role === 'card')
  t('32 卡片取 lg ⇒ 合规', A('const s = { card: { borderRadius: rnRadius.lg } }').compliant === 1)
  t('33 报告说得出实际档与应有档', (() => {
    const v = A('const s = { card: { borderRadius: rnRadius.xl } }').violations[0]
    return v?.actualStep === 'xl' && v?.expectedStep === 'lg' && v?.expectedPx === 8
  })())
  t('34 颜色类名单独出现 ⇒ 弱证据:只点名、不判红', (() => {
    const r = A('<View className="bg-card rounded-t-xl" />')
    return r.violations.length === 0 && r.weakFindings[0]?.role === 'card' && r.weakFindings[0]?.evidence === 'weak'
  })())
  t('34b 组件标签是强证据,压过颜色类名', A('const s = <Button className="bg-card rounded-xl" />').violations[0]?.role === 'control')
  t('34c 同行两个 { 必须认到嵌套样式键(只认第一个 = 整族静默失证据)', A('const s = { card: { borderRadius: rnRadius.xl } }').violations[0]?.role === 'card')
  t('35 控件取 md ⇒ 判红(control 应为 sm)', A('const s = { primaryButton: { borderRadius: rnRadius.md } }').violations[0]?.role === 'control')
  t('36 头词元规则:cardHeader 不算卡片(子部件不判)', A('const s = { cardHeader: { borderRadius: rnRadius.xl } }').unclassified.length === 1)
  t('37 词元而非子串:stage 不得被读成 tag', A('const s = { stage: { borderRadius: rnRadius.xl } }').unclassified.length === 1)
  t('38 两个类别信号 ⇒ 未判定 role-conflict,不猜一边', (() => {
    // 组件标签 Card 与 Button 同现 ⇒ 两条强证据互斥,门不许替人挑一个(挑错就是改错设计)
    const r = A('const s = <Card><Button className="rounded-xl" /></Card>')
    return r.violations.length === 0 && r.undetermined[0]?.reason === 'role-conflict'
  })())
  t('39 无类别证据 ⇒ 不在射程(既不判红也不记通过)', A('const s = { shell: { borderRadius: rnRadius.xl } }').unclassified.length === 1)
  t('40 CSS 选择器 .card 取 xl ⇒ 判红', A('.card { border-radius: 24rpx; }').violations[0]?.role === 'card')
  t('41 后代选择器只算最后一个类(祖先不得漏档给子元素)', A('.card .notice { border-radius: 24rpx; }').unclassified.length === 1)
  t('42 自带角色的取用压过名字证据:rnRadiusFor.panel ⇒ 合规', A('const s = { card: { borderRadius: rnRadiusFor.panel } }').compliant === 1)
  // —— 豁免
  t('43 带原因的 radius-role-exempt 放行本行', A('const s = { card: { borderRadius: rnRadius.xl } } // radius-role-exempt: 主视觉卡').violations.length === 0)
  t('44 标记写在紧邻上一行也放行', A('const s = {\n  // radius-role-exempt: 与广告位同档\n  card: { borderRadius: rnRadius.xl },\n}').violations.length === 0)
  t('45 裸标记(无原因)不放行', A('const s = { card: { borderRadius: rnRadius.xl } } // radius-role-exempt:').violations.length === 1)
  t('46 注释闭合符不得冒充原因', A('const s = { card: { borderRadius: rnRadius.xl } } /* radius-role-exempt: */').violations.length === 1)
  t('47 标记救不了整棵子树(只放行命中行)', A('const s = { // radius-role-exempt: 只该管一行\n  card: { borderRadius: rnRadius.xl },\n  chip: { borderRadius: rnRadius.lg },\n}').violations.length === 1)
  t('48 radius-exempt(守门 77 那一族)在本门同样生效', A('const s = { card: { borderRadius: rnRadius.xl } } // radius-exempt: 真圆').violations.length === 0)
  // —— 棘轮与台账
  const counts = { 'a.tsx|card': 2, 'b.tsx|chip': 1 }
  t(
    '49 锚点相等 ⇒ 该族不判红(存量不拦);无锚的那族仍判红(新增即拦)',
    applyRatchet(counts, { 'a.tsx|card': 2 }).every((r) => r.key !== 'a.tsx|card') &&
      applyRatchet(counts, { 'a.tsx|card': 2 }).length === 1,
  )
  t('50 超出锚点 ⇒ 判红并点名键', applyRatchet(counts, { 'a.tsx|card': 1 })[0]?.key === 'a.tsx|card')
  t('51 台账缺键 ⇒ 视作 0(新增即拦,不留清单外空档)', applyRatchet(counts, {})[0]?.count === 2)
  t('52 锚点粒度到「文件×角色」:换角色写法不能净零逃逸', (() => {
    const before = applyRatchet({ 'a.tsx|card': 1 }, { 'a.tsx|card': 1 })
    const after = applyRatchet({ 'a.tsx|control': 1 }, { 'a.tsx|card': 1 })
    return before.length === 0 && after.length === 1
  })())
  t('53 重锚只允许下降:上升必拒', anchorRegression({ 'a|card': 1 }, { 'a|card': 2 }).length === 1)
  t('54 重锚只允许下降:锚点消失也必拒', anchorRegression({ 'a|card': 1 }, {}).length === 1)
  t('55 第一次入锚(空台账)不受"只降"限制', anchorRegression({}, { 'a|card': 3 }).length === 0)
  t(
    '55b 台账一经建立,新键带违规必拒 —— 否则每次判红都能被同一条 --emit-baseline 洗成豁免',
      anchorRegression({ 'a|card': 1 }, { 'a|card': 1, 'b|chip': 2 }).length === 1 &&
        anchorRegression({ 'a|card': 1 }, { 'a|card': 0, 'b|chip': 0 }).length === 0,
  )
  t(
    '55c 一行里多族并列时归属不可判 ⇒ 落未判定,不得挑一个族判红(假阳比漏报更贵)',
      (() => {
        const r = A('const s = { card: { borderRadius: rnRadius.xl }, chip: { borderRadius: rnRadius.lg } }')
        return r.violations.length === 0 && r.compliant === 0 && r.unclassified.length === 2
      })(),
  )
  t('56 emitBaseline 幂等(重跑不产生第二份真相)', (() => {
    const vs = A('const s = { card: { borderRadius: rnRadius.xl } }').violations
    const once = emitBaseline(vs, { anchors: {} }).anchors
    const twice = emitBaseline(vs, { anchors: once }).anchors
    return JSON.stringify(once) === JSON.stringify(twice) && once['x/T.tsx|card'] === 1
  })())
  t('57 清偿完的族降到 0 而不是删键(键消失 = 台账被旧基线回写的指纹)', (() => {
    const next = emitBaseline([], { anchors: counts }).anchors
    return Object.keys(next).length === 2 && Object.values(next).every((v) => v === 0)
  })())
  let threw = false
  try {
    parseBaseline('{"nope":1}', 'x')
  } catch (e) {
    threw = e instanceof Undetermined
  }
  t('58 坏台账 ⇒ 无法判定,不得当空锚点用', threw)
  // —— 射程与面
  t('59 在射程:apps/web 的 tsx', isInScope('apps/web/src/a.tsx'))
  t('60 不在射程:apps/api(生成式 CSS 归 77)', !isInScope('apps/api/src/x.ts'))
  t('61 不在射程:design-tokens 档位表自身', !isInScope('packages/design-tokens/src/radius.js'))
  t('62 不在射程:测试与夹具', !isInScope('apps/web/src/a.test.tsx') && !isInScope('apps/web/tests/a.tsx'))
  t('63 不在射程:构建产物/依赖族经共享排除清单', !isInScope('apps/web/node_modules/a.tsx') && !isInScope('apps/web/.next-static/a.tsx'))
  t('64 语言包不参与', !isInScope('packages/i18n/messages/web/zh-CN.ts'))
  t('65 两面旗同给 ⇒ 判死', (() => {
    try {
      faceFromArgv(['--staged', '--worktree'])
      return false
    } catch (e) {
      return e instanceof Undetermined
    }
  })())
  t('66 缺省档 = HEAD(不是磁盘)', faceFromArgv([]) === 'head' && faceFromArgv(['--staged']) === 'staged')
  t('67 OUT_OF_SCOPE 每条都必须带 why(报名式排除)', OUT_OF_SCOPE.every((o) => o.why && o.why.length > 8))
  t('68 角色词元表只覆盖档位表里有的角色(对账,不猜)', (() => {
    const stemRoles = Object.keys(ROLE_STEMS)
    const withRole = stemRoles.filter((r) => table[`role:${r}`] !== undefined)
    return withRole.length > 0 && roleTableProblems(table).every((r) => stemRoles.includes(r))
  })())
  // —— 真仓阳性对照(关键):同一条违规,写在代码里必命中、只写进注释必不命中
  const PROBE = 'apps/miniapp-taro/src/components/DrawerComponent.tsx'
  const probeSrc = catBatch(repoRoot, [`HEAD:${PROBE}`], { maxBuffer: 1 << 26 }).get(`HEAD:${PROBE}`)
  let hit = null
  let blind = false
  if (probeSrc) {
    const pr = A(probeSrc)
    hit = [...pr.violations, ...pr.weakFindings].find((v) => v.form.includes('rounded-t-xl')) || null
    const rewritten = probeSrc
      .split('\n')
      .map((l) => (l.includes('rounded-t-xl') ? `// ${l.trim()}` : l))
      .join('\n')
    const again = A(rewritten)
    blind = ![...again.violations, ...again.weakFindings].some((v) => v.form.includes('rounded-t-xl'))
  }
  t(`69 真仓 HEAD 阳性对照:${PROBE} 的 rounded-t-xl 必须被点名`, !!hit, hit ? `角色 ${hit.role} / 实际 ${hit.actualStep} / 应为 ${hit.expectedStep}` : '未命中 = 判据失明')
  t('70 同一形态只写进注释 ⇒ 必不命中(否则遮罩关掉的是判据)', !!probeSrc && blind)
  /**
   * 71–73:角色表**值支**必须认得数字开头的档名(`hero: '2xl'`)。
   * 立因:解析器原先只认"字母开头标识符"或"纯数字"两种值 ⇒ `hero:'2xl'` 整行不匹配,
   * 表里没有 role:hero,于是三个 hero 站点被报成 role-not-in-table(读起来像代码写错,
   * 其实是尺子丢项),而 hero 这一档从此**永不可判**。这是同一条"漏读一侧不表现为少几个数"
   * 的缺陷第三次出现(前两次:档位键 '2xl'、Tailwind 方向形态)。
   */
  t(
    '71 角色表值支认数字开头档名 ⇒ role:hero 必须解出 16',
    (() => {
      const tbl = table
      if (!tbl) return false
      const hero = roleSpec(tbl, 'hero')
      return !!hero && hero.px === 16 && hero.step === '2xl' && rolesInTable(tbl).includes('hero')
    })(),
  )
  t(
    '72 名字不得替元素认领纯尺寸档(hero/banner),但普通类别仍由名字判(成对)',
    (() => {
      const banner = rolesOfName('compactionBanner')
      const heroName = rolesOfName('heroSection')
      const card = rolesOfName('userCard')
      return (
        !banner.includes('hero') &&
        !heroName.includes('hero') &&
        ROLE_STEMS.hero?.nameCannotClaim === true &&
        card.includes('card')
      )
    })(),
  )
  t(
    '73 显式取用仍是唯一可判 hero 的路(收窄推理不等于放宽判据)',
    (() => {
      const tbl = table
      if (!tbl) return false
      const spec = roleSpec(tbl, 'hero')
      // 显式声明走 f.role 直取,不经 rolesOfName ⇒ 一定拿得到档;拿不到就是两处路径都断了
      return !!spec && spec.px === tbl['2xl'] && tbl['2xl'] === 16
    })(),
  )
  const bad = results.filter((r) => !r.ok)
  for (const r of results) console.log(`${r.ok ? '✅' : '❌'} ${r.name}${r.extra ? ` —— ${r.extra}` : ''}`)
  console.log(`--self-test: ${results.length} 条,失败 ${bad.length} 条`)
  return bad.length ? 1 : 0
}

// §22d:双形态入口守护 —— 镜像测试 import 判据时不得触发 CLI(它会派生 git)。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
    .then((code) => {
      process.exitCode = code
    })
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}

export const __test__ = {
  ROOT,
  RADIUS_TABLE_REL,
  BASELINE_REL,
  OUT_OF_SCOPE,
  isInScope,
  auditFileText,
  anchorKey,
  countByKey,
  applyRatchet,
  anchorRegression,
  emitBaseline,
  parseBaseline,
  faceFromArgv,
  runAudit,
  roleTableProblems,
  selfTest,
  headToken,
  maskCommentsAndStrings,
}
