#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 教育欠费口径单一出口对账(2026-09-29 立,D180 的防回潮尺子)。
 *
 * ## 它拦的是哪一型
 * 学费账目刚重构成"单一真相源"(apps/api/src/services/edu-ledger.ts),而**重构之前的病**是
 * 同一个欠费算式在 8 处各写一遍 —— 其中一处漏了下限 0,于是超缴学员被算成"负欠费",
 * 汇总再把那个负数加进去,整页欠费总额被悄悄冲小;另一处是 edu_enrollment 的 paid_amount
 * 被端点随手 set(录了缴费流水却不回写 ⇒ 已缴的人次日继续被催缴)。
 * 这些改动**全部 typecheck 绿、零测试**,因为没有任何尺子问过"这个算式是谁的"。
 * 本门把两句话钉成判据:
 *   **AR1** 欠费算式只许住在账目出口里;别处再写一遍 totalFee 与 paidAmount 之间的
 *           减法/比较即红。
 *   **AR2** paidAmount / nextDueDate 是派生缓存,除出口文件外谁在 update(eduEnrollment)
 *           的 set 里动它们即红。
 *
 * ## 三条不可漂的设计约束
 * 1. **算式先有一份文本,门才判得动**:出口导出了 arrearsSqlExpr() 与 hasArrearsCond()
 *    两个构造函数,分页列表与定时扫描都引用它们(既保住 SQL 侧性能,又不重写算式)。
 *    所以"放过"是因为有出口可引,不是靠豁免遮 —— 想高效写查询就引用那两个函数。
 * 2. **判据面只遮注释、保留字符串**:drizzle 的列引用住在 SQL 模板字符串的内插里,
 *    连字符串一起抹就等于对本型失明(守门 134/135 同一课:遮噪方向必须跟被判 token
 *    的语法位置一致)。maskComments 保持行数不变,所以按行索引的豁免判据不会错位。
 * 3. **口径同 70/77/83/98/101/103/118**:全量判 HEAD blob、--staged 判索引 blob、
 *    --worktree 仅人工、两面旗同给 exit 2、取不到判"无法判定"且**不回落**、
 *    枚举到 0 个射程文件判死不记绿。
 *
 * ## 定级
 * 默认档锚点 = **该文件在 HEAD 自身的违规数**(棘轮):与本次改动无关的恒红 blocking 门,
 * 唯一结局是逼人 --no-verify、连带整条守门链对该提交作废(AGENTS §12e)。
 * 存量逐条点名报数;要连存量一起问责跑 --strict。
 *
 * 用法:node scripts/check-edu-arrears-single-source.mjs [--staged|--worktree|--json|--strict|--self-test|--files a b]
 * 接线现状:**已注册 guardian id 165**(blocking,`stagedTriggers=apps/api/src/`,
 * 紧急跳过 `HUSKY_SKIP_EDU_ARREARS_SINGLE_SOURCE=1` —— 由 runner 分发,门体自身不读该 env)。
 * 接线的正当性:真仓 HEAD 全量档现读 exit 0(存量站点全部已收进账目出口,
 * 棘轮锚点=该文件 HEAD 自身存量,所以"存量非零"也不会被算成本次的红),
 * 因此挂 blocking 不产生恒红面(AGENTS §12e 那条前置满足才接线)。
 * 编号一律以 `scripts/guardian-runner.mjs` 现值为准,勿照本行派单。
 */
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { catBatch, gitRaw, readWorktreeFile } from './lib/face-reader.mjs'
import { maskComments } from './lib/code-mask.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const GIT_TIMEOUT = 60_000
/** 账目出口本体:AR1/AR2 的定义处,不在射程内(否则门替自己的定义判红) */
const LEDGER_FILE = 'apps/api/src/services/edu-ledger.ts'
const SCAN_ROOT = 'apps/api/src/'
const SCAN_EXT = /\.(ts|tsx|mts)$/
const TEST_NOISE = /(^|\/)(tests?|__tests__|e2e)(\/|$)|\.(test|spec)\.[cm]?tsx?$/
/** 豁免标记必须带原因;裸标记(只写标记不写理由)不放行 */
const EXEMPT_RE = /arrears-single-source-exempt:\s*(\S.*)$/
/** 派生列集合 */
const SET_KEYS = /\b(paidAmount|nextDueDate)\s*:/
/**
 * AR1 的运算符判据。字符类里刻意**不含斜杠** —— 正则字面量内一个裸斜杠会被当除号,
 * 整段词法从此漂走(本门第一次自跑就栽在类似处,报错落在三十行开外的注释上)。
 * 欠费算式只可能是加减乘与比较,所以这个集合已足够。
 */
const ARITH_RE =
  /eduEnrollment\.totalFee[^\n]{0,60}?[-+*<>]|[-+*<>][^\n]{0,60}?eduEnrollment\.paidAmount/
const BOTH_ON_LINE = /eduEnrollment\.totalFee/

export function isScanTarget(p) {
  if (!SCAN_EXT.test(p)) return false
  if (!p.startsWith(SCAN_ROOT)) return false
  if (TEST_NOISE.test(p)) return false
  if (p === LEDGER_FILE) return false
  return true
}

/** 括号配平取 set 体;配不上返回 null(判不出,不猜成"没有违规") */
function takeBalanced(s) {
  let depth = 0
  let out = ''
  for (const ch of s) {
    if (depth === 0 && (ch === ')' || ch === '}')) break
    if (ch === '{') depth++
    else if (ch === '}') depth--
    else if (ch === '(') depth++
    else if (ch === ')') depth--
    out += ch
  }
  return depth === 0 && out.trim().length > 0 ? out : null
}

/**
 * 豁免只认:本行,或紧邻上一**纯注释**行。
 * 不许按块放行 —— 一个标记救不了整片,否则任何人加一行标记就免检整个文件。
 */
function exemptionReason(rawLines, idx) {
  const onSelf = EXEMPT_RE.exec(rawLines[idx] ?? '')
  if (onSelf) return onSelf[1].trim()
  const prev = (rawLines[idx - 1] ?? '').trim()
  if (/^(\/\/|\/\*|\*)/.test(prev)) {
    const onPrev = EXEMPT_RE.exec(prev)
    if (onPrev) return onPrev[1].trim()
  }
  return null
}

/**
 * 纯函数:判一份源码文本。抽出来的理由与守门 103/135 同 —— 判定行为必须用
 * 输入/输出对证明,"门源码里有没有某个字符串"那种形状锁证明不了任何事。
 * 返回 violations(判红)/ exempted(带原因豁免)/ undetermined(看见形态却判不出)。
 */
export function scanSource(text) {
  const out = { violations: [], exempted: [], undetermined: 0 }
  if (typeof text !== 'string') return { ...out, unreadable: true }
  const rawLines = text.split('\n')
  const codeLines = maskComments(text).split('\n')
  const masked = codeLines.join('\n')
  const seen = new Set()

  // 逐行:AR1(同行重写算式)与 AR2 的紧凑写法(set 与 update 同一行)
  for (let i = 0; i < codeLines.length; i++) {
    const line = codeLines[i]
    if (!line) continue
    let hit = null
    if (BOTH_ON_LINE.test(line) && ARITH_RE.test(line)) hit = 'AR1'
    else if (
      line.includes('eduEnrollment') &&
      /\.\s*set\s*\(/.test(line) &&
      SET_KEYS.test(line)
    ) {
      hit = 'AR2'
    }
    if (!hit) continue
    const reason = exemptionReason(rawLines, i)
    if (reason) {
      out.exempted.push({ line: i + 1, reason })
      continue
    }
    seen.add(i + 1)
    out.violations.push({ line: i + 1, kind: hit, text: line.trim().slice(0, 120) })
  }

  // 多行写法:update(eduEnrollment) → 向后找下一个 .set( 再配平取体判键名。
  // 用"下一个 .set("而不是固定行数窗口,因为 prettier 会把 set 体拆成多行(本仓实测)。
  const reUpdate = /update\(\s*eduEnrollment\s*\)/g
  let m
  while ((m = reUpdate.exec(masked))) {
    const after = masked.slice(m.index)
    const setAt = after.indexOf('.set(')
    const lineNo = masked.slice(0, m.index + (setAt < 0 ? 0 : setAt)).split('\n').length
    if (setAt < 0) {
      out.undetermined += 1
      continue
    }
    const body = takeBalanced(after.slice(setAt + 5))
    if (body === null) {
      out.undetermined += 1
      continue
    }
    if (!SET_KEYS.test(body)) continue
    if (seen.has(lineNo)) continue
    const reason = exemptionReason(rawLines, lineNo - 1)
    if (reason) {
      out.exempted.push({ line: lineNo, reason })
      continue
    }
    out.violations.push({
      line: lineNo,
      kind: 'AR2',
      text: 'update(eduEnrollment) 的 set 体内动了派生列',
    })
  }
  return out
}

function git(args) {
  // gitRaw 返回**字符串**(不是 {stdout,err});按对象形状取会得到 undefined,
  // 表现为枚举到 0 个文件,而"0 个"读起来像"都没违规"—— 那正是判据失效最安静的形态
  try {
    return { text: gitRaw(args, ROOT, { timeout: GIT_TIMEOUT }) }
  } catch (e) {
    return { err: String(e?.message ?? e) }
  }
}

function listFacePaths(face) {
  const args = face === 'staged' ? ['ls-files', '--cached'] : ['ls-tree', '-r', '--name-only', 'HEAD']
  const got = git(args)
  if (got.err) return { err: got.err }
  return { paths: String(got.text).split('\n').filter(Boolean) }
}

function readFace(paths, face) {
  const map = new Map()
  if (!paths.length) return map
  if (face === 'worktree') {
    for (const p of paths) map.set(p, readWorktreeFile(ROOT, p))
    return map
  }
  const rev = face === 'staged' ? '' : 'HEAD'
  const specs = paths.map((p) => `${rev}:${p}`)
  const got = catBatch(ROOT, specs, { maxBuffer: 1 << 29, timeout: GIT_TIMEOUT })
  for (let i = 0; i < paths.length; i++) map.set(paths[i], got.get(specs[i]) ?? null)
  return map
}

/**
 * 暂存档在"本次没有射程内文件"时回退 HEAD 全量,而不是判"无法判定":
 * 一次只改文档/语言包的提交,其暂存集里结构上不会有 .ts —— 把这当空扫判死,
 * 本门就替每一次无关提交挡路,而恒挡的唯一结局是各会话走应急跳门(AGENTS §12e)。
 */
export function shouldRetreatToHead({ face, hasExplicitFiles, stagedInScopeCount }) {
  return face === 'staged' && !hasExplicitFiles && stagedInScopeCount === 0
}

export function runCheck({ face, onlyFiles = null }) {
  const listed = onlyFiles ? { paths: onlyFiles } : listFacePaths(face)
  if (listed.err) return { status: 'undetermined', reason: `清单取不到:${listed.err}` }
  const candidates = listed.paths.filter(isScanTarget)
  let effFace = face
  let retreated = null
  if (shouldRetreatToHead({ face, hasExplicitFiles: !!onlyFiles, stagedInScopeCount: candidates.length })) {
    effFace = 'head'
    retreated = '暂存集里没有射程内文件 ⇒ 回退 HEAD 全量(不判"无法判定")'
    const again = listFacePaths('head')
    if (again.err) return { status: 'undetermined', reason: `回退面清单取不到:${again.err}` }
    candidates.length = 0
    candidates.push(...again.paths.filter(isScanTarget))
  }
  if (candidates.length === 0) {
    return {
      status: 'undetermined',
      reason: `射程内枚举到 0 个文件(face=${face},SCAN_ROOT=${SCAN_ROOT})—— 空扫不是通过`,
    }
  }
  const faceMap = readFace(candidates, effFace)
  const headMap = effFace === 'head' ? faceMap : readFace(candidates, 'head')

  const perFile = []
  let unreadable = 0
  let undetermined = 0
  for (const p of candidates) {
    const content = faceMap.get(p)
    if (typeof content !== 'string') {
      unreadable += 1
      continue
    }
    const res = scanSource(content)
    undetermined += res.undetermined
    const headContent = headMap.get(p)
    const cap = typeof headContent === 'string' ? scanSource(headContent).violations.length : 0
    const red = res.violations.length > cap ? res.violations : []
    perFile.push({
      path: p,
      found: res.violations.length,
      cap,
      exempted: res.exempted.length,
      undetermined: res.undetermined,
      violations: res.violations,
      red,
    })
  }
  return { status: 'ok', perFile, unreadable, undetermined, scanned: candidates.length, effFace, retreated }
}

/**
 * 自检:全部跑在构造面上,不依赖仓库此刻有什么(否则"今天恰好没有违规"会被当成判据有牙)。
 * 每型一条正例(必须红)配一条反例(必须绿)。断言一律**立即求值后再传给登记函数** ——
 * 把箭头函数当条件传进去会因 truthy 而恒绿(本仓门 150 量到 8 条这种假断言)。
 */
export function selfTest() {
  const cases = []
  const t = (name, ok, got) => cases.push({ name, ok: ok === true, got: String(got) })
  const A = scanSource

  const a1 = A('const x = sql`' + '${eduEnrollment.totalFee} - ${eduEnrollment.paidAmount}' + '`')
  t('AR1 正例:同行减法重写欠费必红', a1.violations.length === 1 && a1.violations[0].kind === 'AR1', JSON.stringify(a1.violations))

  const a2 = A('if (eduEnrollment.totalFee > eduEnrollment.paidAmount) q.push(x)')
  t('AR1 正例:同行比较也算重写必红', a2.violations.length === 1, a2.violations.length)

  const a3 = A('db.select({ a: eduEnrollment.totalFee, b: otherCol })')
  t('AR1 反例:只取列不相运算符不得红', a3.violations.length === 0, JSON.stringify(a3.violations))

  const a4 = A('db.select({\n totalFee: eduEnrollment.totalFee,\n paidAmount: eduEnrollment.paidAmount,\n})')
  t('AR1 反例:两列分行各自取用不得红', a4.violations.length === 0, a4.violations.length)

  const a5 = A('// 旧写法 totalFee 减 paidAmount 已废弃\nconst ok = 1')
  t('AR1 反例:注释里的同类描述不得红', a5.violations.length === 0, a5.violations.length)

  const b1 = A('await db.update( eduEnrollment ).set({ paidAmount: 3 })')
  t('AR2 正例:set 内含派生列必红', b1.violations.some((v) => v.kind === 'AR2'), JSON.stringify(b1.violations))

  const b2 = A('await db.update( eduEnrollment ).set({ nextDueDate: null })')
  t('AR2 正例:nextDueDate 同为派生列(不能只钉 paidAmount)', b2.violations.some((v) => v.kind === 'AR2'), b2.violations.length)

  const b3 = A('await db.update( eduEnrollment ).set({ status: "enrolled" })')
  t('AR2 反例:set 只动其它列不得红', b3.violations.length === 0, JSON.stringify(b3.violations))

  const b4 = A('const r = await db.update( eduEnrollment )\n  .set({\n    paidAmount: ledger.paidAmount,\n    updatedAt: new Date(),\n  })\n  .where(x)')
  t('AR2 正例:多行 set 形态也必须被看见', b4.violations.some((v) => v.kind === 'AR2'), JSON.stringify(b4.violations))

  const b5 = A('await db.update( eduPaymentRecord ).set({ paidAmount: 3 })')
  t('AR2 反例:其它表的同名列不在本门射程(不误伤)', b5.violations.length === 0, b5.violations.length)

  const c1 = A('const x = sql`' + '${eduEnrollment.totalFee} - ${eduEnrollment.paidAmount}' + '` // arrears-single-source-exempt: 预筛粗条件,金额走出口')
  t('豁免正例:带原因的同行标记生效', c1.violations.length === 0 && c1.exempted.length === 1, JSON.stringify(c1))

  const c2 = A('const x = sql`' + '${eduEnrollment.totalFee} - ${eduEnrollment.paidAmount}' + '` // arrears-single-source-exempt:')
  t('豁免反例:裸标记(无原因)不得放行', c2.violations.length === 1, c2.violations.length)

  const c3 = A('const arrears = 1\nconst x = sql`' + '${eduEnrollment.totalFee} - ${eduEnrollment.paidAmount}' + '`')
  t('豁免反例:非纯注释行不得当标记生效', c3.violations.length === 1, c3.violations.length)

  const d1 = scanSource(null)
  t('取不到内容必须显式未判定,不得静默 0 违规', d1.unreadable === true && d1.violations.length === 0, JSON.stringify(d1))

  const d2 = A('await db.update( eduEnrollment )')
  t('找不到 set 时计未判定,不得当成"没有违规"', d2.undetermined >= 1, d2.undetermined)

  t('射程:出口文件本身不在射程(否则门替自己的定义判红)', !isScanTarget(LEDGER_FILE) && isScanTarget('apps/api/src/routes/x.ts'), 'ledger 排除? ' + isScanTarget(LEDGER_FILE))
  t('射程:测试面不得进射程(门不得被自己的夹具判红)', !isScanTarget('apps/api/tests/edu-ledger.test.ts') && !isScanTarget('apps/api/src/x.spec.ts'), 'test 排除?')
  t('回退判定只认"无射程内文件"这一种', shouldRetreatToHead({ face: 'staged', hasExplicitFiles: false, stagedInScopeCount: 0 }) === true && shouldRetreatToHead({ face: 'staged', hasExplicitFiles: false, stagedInScopeCount: 1 }) === false && shouldRetreatToHead({ face: 'staged', hasExplicitFiles: true, stagedInScopeCount: 0 }) === false && shouldRetreatToHead({ face: 'head', hasExplicitFiles: false, stagedInScopeCount: 0 }) === false, '四路')

  let fail = 0
  for (const c of cases) {
    if (!c.ok) fail += 1
    console.log(`${c.ok ? '✅' : '❌'} ${c.name}${c.ok ? '' : ` (实得:${c.got})`}`)
  }
  console.log(`自检 ${cases.length - fail}/${cases.length} 通过`)
  return fail === 0
}

function main(argv) {
  if (argv.includes('--self-test')) process.exit(selfTest() ? 0 : 1)
  const wantStaged = argv.includes('--staged')
  const wantWorktree = argv.includes('--worktree')
  if (wantStaged && wantWorktree) {
    console.log('❌ 无法判定:--staged 与 --worktree 同时给出(两个面不得混判)')
    process.exit(2)
  }
  const face = wantStaged ? 'staged' : wantWorktree ? 'worktree' : 'head'
  const fi = argv.indexOf('--files')
  const onlyFiles = fi >= 0 ? argv.slice(fi + 1).filter((a) => !a.startsWith('--')) : null
  const strict = argv.includes('--strict')

  const r = runCheck({ face, onlyFiles })
  if (r.status === 'undetermined') {
    console.log(`❌ 无法判定:${r.reason}`)
    process.exit(2)
  }
  const red = r.perFile.filter((f) => f.red.length > 0)
  const total = r.perFile.reduce((s, f) => s + f.found, 0)
  const exemptTotal = r.perFile.reduce((s, f) => s + f.exempted, 0)

  /** 存量(未超本次锚点)也必须逐条点名 —— 只给"共 N 处"的话,下一个人既找不到站点,
 *  也无法证明这一格真被看过(本仓把"报数不报名"记过多次:射程边界必须跟读数一起说) */
for (const f of r.perFile) {
  if (f.found === 0 || f.red.length > 0) continue
  console.log(`ℹ 存量 ${f.path}: ${f.found} 处(锚点 ${f.cap},未超)`)
  for (const v of f.violations || []) console.log(`    L${v.line} ${v.kind}: ${v.text}`)
}

if (argv.includes('--json')) {
    console.log(
      JSON.stringify(
        {
          face: r.effFace,
          retreated: r.retreated,
          scanned: r.scanned,
          unreadable: r.unreadable,
          undetermined: r.undetermined,
          exempted: exemptTotal,
          totalFound: total,
          redFiles: red.map((f) => ({ path: f.path, found: f.found, cap: f.cap, red: f.red })),
        },
        null,
        2,
      ),
    )
  } else {
    if (r.retreated) console.log(`ℹ ${r.retreated}`)
    for (const f of red) {
      console.log(`❌ ${f.path}:本次带进 ${f.red.length} 处(该文件 HEAD 自身存量 ${f.cap})`)
      for (const v of f.red) console.log(`    L${v.line} ${v.kind}: ${v.text}`)
    }
    if (!red.length) {
      console.log(
        `✅ 无新增违规。射程 ${r.scanned} 文件(face=${r.effFace})现读欠费算式/派生列裸写站点共 ${total} 处,带原因豁免 ${exemptTotal} 处,判不出 ${r.undetermined} 处,取不到内容 ${r.unreadable} 个`,
      )
    }
    console.log(
      `修复出口:引用 ${LEDGER_FILE} 的 arrearsSqlExpr()/hasArrearsCond(),或把写操作并入账目出口。存量与判不出进度一律看这一行现读值,别引用文档旧数。`,
    )
  }
  // 判不出与取不到不得被读成通过:--strict 下拒绝出合格证
  if (strict && (red.length > 0 || r.undetermined > 0 || r.unreadable > 0)) {
    process.exit(red.length > 0 ? 1 : 2)
  }
  process.exit(red.length > 0 ? 1 : 0)
}

// §22d 双形态入口守卫:被 import(镜像测试/历史阳性对照)时**绝不**跑 CLI。
// 没有这一层时,"import 判据函数"会连带执行全仓扫描并打印结论,
// 于是取证者拿到的是门的输出而不是自己的断言(本仓第一次自跑就撞上了)。
import { pathToFileURL } from 'node:url'
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) main(process.argv.slice(2))
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
