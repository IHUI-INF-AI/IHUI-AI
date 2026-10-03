#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门:自检用例登记侧的"求值配对"对账(登记不求值 ∧ 用例传函数 ⇒ 才判红)
//
// 在修什么(2026-09-28 立):
//   本仓约 200 道守门各带 `--self-test`,而**登记一条用例的写法有 29 种**(53 个登记点、11 个不同函数名)。
//   其中"潜伏洞"一族是把实参**存起来却不求值**:
//
//       const t = (name, ok) => cases.push({ name, ok })              // 裸存
//       const ck = (name, cond) => results.push({ name, ok: !!cond })  // 布尔强制
//
//   这类登记函数收到 `t('名字', () => {...})` 时求的是"函数对象是否为真值" —— **恒真**。于是自检
//   打印 "13/13 通过",而一条都没判过。已发生的实例是 `check-single-branch.mjs`(13 条全传箭头函数、
//   登记侧写 `!!ok`),在那个掩护下同一文件一处单位错误(秒差 ÷ 3,600,000,把 48h 豁免窗算成 ~5.5 年,
//   "超窗仍判"的反向对照永不触发)长期隐形。该门已修,不在本门射程内,但它是本门存在的理由。
//
// 为什么必须"配对"才判红(这是本门的全部价值,也是它不成为恒红门的原因):
//   票面普查口径:潜伏形态 **41 道**,它们今天**一条真缺陷都没掩盖** —— 因为现有用例传的都是即算即得的
//   布尔表达式或自调用。所以只满足"登记侧不求值"(R-REG)时**只报数**;当场把它们全判红就是一台与任何
//   提交都无关的恒红门,唯一结局是各会话 `--no-verify` 连带废掉链上全部守门(AGENTS §12f/§12e 同型)。
//   本门自己的现读数(潜伏 36 / 未判定 4)一律以命令末行为准 —— 与票面 41 的差来自口径(本门把登记点
//   限定在自检宿主内,并把值比较族/装箱族另档计),**两个数不得互相顶账**。
//   ⚠️ 上面那对数字是**换遮罩档之前**的读数,保留只为让"为什么改"可追溯;现值一律跑末行。
//   2026-09-28 起本门判定用 `maskCommentsStringsAndRegex`(认正则字面量的那一档,同一台分词器):
//   旧那档 `maskCommentsAndStrings` 把正则里的 `(` / `'` 当代码,于是本门按括号配平取实参时会把
//   **真调用读成"配不平"** ⇒ 落未判定。换档后实测 未判定 4 → 1、潜伏 36 → 38、自检宿主 141 → 149
//   (浮出来的都是以前被遮噪吞掉的可见代码,不是新增缺陷)。剩下那一处
//   `check-miniapp-css-landing.mjs` 的 `eq` 不是遮罩问题:它把形参 `got` 喂进
//   `JSON.stringify(got)`,本门结构上看不见那一层是不是求值 ⇒ **照旧未判定,不得改成通过**。
//   问责档 `--strict` 因此仍 rc=2,直到那一处被逐条读明白或本门扩出第二判据。
//   判红必须再要第二条同时成立:**同一文件内**确实有用例把函数当结论传进来(R-CASE)—— 那才是"这一型
//   正在咬人"。它今天掩盖的不是旧账,而是**下一个用 `() =>` 写用例的人**。
//
//   而被抄得最多的那一族恰好是坏的那一族(不求值的 `{name, ok}` 裸存 7 份 vs 正确的 `{name, fn}` 5 份)
//   ⇒ 这是"没有共用出口、靠抄邻居"的结构问题。所以修复出口是**改登记侧求值**(体内调用该形参,或改用
//   `push({ name, fn })` + 消费循环 `c.fn()` 的 thunk 族),**不是**把用例改成布尔去过门。
//
// 三态与判据(绝不并桶):
//   R-REG  登记函数不求值:裸存 / 布尔强制 / 真值化(三元取字符串)这类"函数对象为真值"的形态。
//          求值证据两种都认 —— ① 函数体内直接调用该形参(`ok()` / `await ok()` / `ok?.()`);
//          ② 存进对象的键在**全文**被当函数调(`c.fn()` / `c.fn?.()` / `c.fn.call()`)。thunk 族靠 ②
//          被认作合规,这是判据**必须**覆盖的自己产出的形态(否则新判据对正确写法产假阳)。
//   R-CASE 同文件内有以该登记函数为名的调用,其**第二实参是裸箭头函数或裸 function**。
//          自调用 `(() => {…})()`、`await …` 现算、`a === b` 比较式、单个标识符一律**不算**。
//   两条件同时成立 ⇒ 判红并逐条点名(登记行号 + 门名 + 函数形态用例的行号)。
//
//   两型**不计潜伏**(它们不是"静默绿"):
//     · `x === true` / `x === want` 这类值比较族:传函数会得到 false ⇒ 当场翻红,归 `strict-compare`。
//     · 形参被喂进别的调用(`{ ok: runCase(fn) }`、`JSON.stringify(got) === JSON.stringify(want)`)
//       ⇒ 本门承认看不见那一层是不是求值 ⇒ `未判定`,报名不猜。
//   调用括号配不平、实参形态解不出 ⇒ 同样计**未判定**并逐条报名 + 打原因;`--strict` 下有未判定即
//   **rc=2**(拒绝出具合格证,既不冒红也不记绿)。
//
//   R-EXIST(G-1038420 第一阶段新增,**只报数、不参与 exit 判定**):
//     宿主内的用例登记函数**一律**是"本地自造",出路只有 `scripts/lib/selftest-registrant.mjs`
//     一条。它与 R-REG/R-CASE 正交:R-REG 答"这一型登记侧求不求值",R-EXIST 答"该登记器该不该
//     还在本地自造" —— **一个判对了的本地登记器同样该搬**,所以它不按 latent/evaluates 分档。
//     起步挂 warn 是算术结论而非"先松后紧":现读数十位,判红即恒红门(§12f 那型)。清零后才谈升档。
//     ⚠️ 出口模块住在 `scripts/lib/**`,而本门射程是根一级 `scripts/*.mjs`(见下"射程边界"①)
//     ⇒ 出口自己不会被自己的门扫到。这是刻意的:R-EXIST 要的是"出口之外每处自造都被点名",
//     出口自己被扫到只会在文件里读出自己的函数名。出口的合规性由**消费方**证明 ——
//     `scripts/check-baseline-freshness.mjs` 是第一处样板,它的读数(潜伏 1 → 0)是本判据的实证。
//
// 定级:**warn 起步**,不是"先松后紧"的托辞 —— 现读潜伏 36 处 + 未判定 4 处会在接线瞬间把
//   每台每次提交钉红(§12f 那型)。问责出口 = 直接跑本脚本的 `--strict` 档
//   (`node scripts/check-selftest-registrant-evaluates.mjs --strict`);**刻意不写 `pnpm check:*`
//   别名** —— 那要在根 package.json 加脚本项,而该文件此刻由并行会话持有,写了就是一个跑不通的出路。
//   接线经 `scripts/gate-registry-insert.mjs` 落地,现值(id / mode)一律以 `scripts/guardian-runner.mjs`
//   为准,不得照本注释派单。应急跳过 `HUSKY_SKIP_SELFTEST_REGISTRANT=1` —— 该变量由 guardian-runner 的
//   分发循环统一 honors(注册块里的 skipEnv 字段),**本脚本自身不读它**;不写跑不通的出路。
//
// 射程边界(如实登记,不是已完成):
//   ① 只看仓库根 `scripts/*.mjs`(守门与工具脚本)。`scripts/lib/**`、`scripts/tests/**` 不在面内 ——
//      后者用 node:test 的 `test('名字', async () => …)`,那**本来就该**传函数,纳进来就是满天假红。
//   ② 登记函数必须声明在**自检宿主**(函数名含 selfTest / selfCheck,现读实际只有 `selfTest`、
//      `runSelfTest`、`selfTestRun` 三种)体内。少了这一层限定,`scanSource` / `walk` /
//      `findViolations` / `route` 那一族两参数收集器(接线当天现读 30 处)会全被算成潜伏登记,
//      而 `route(method, handler)` 这类"合法登记回调"只要有人传一次箭头函数就是假红。
//      代价如实登记为**已知漏报**:宿主另取它名(如 `auditSelf`)的文件不进射程。
//   ③ 只认"push 一个对象字面量、且对象里出现第二形参"的登记形态;`cases.push([name, verdict])`
//      (先算再存,如已修好的 check-single-branch)结构上不成候选 —— 那一型按定义已求值。
//   ④ 遮罩只引 `scripts/lib/code-mask.mjs` 那一份实现(两处实现必漂移是本仓记过最多次的失败型)。
//      它的已知边界是**不认正则字面量**:某行正则里含未配对引号时,该行之后到行尾被吞 ⇒ 本门对那个
//      文件可能"看不见登记函数"。失效方向是**少判不误判**,由镜像测试的覆盖面自证("真仓上一处登记
//      函数都没看见"不算通过)兜住整片失配。
//
// 手动:
//   node scripts/check-selftest-registrant-evaluates.mjs                 # 全量档(判 HEAD blob)
//   node scripts/check-selftest-registrant-evaluates.mjs --staged        # 提交链(判索引 blob)
//   node scripts/check-selftest-registrant-evaluates.mjs --strict        # 问责:有未判定即 rc=2
//   node scripts/check-selftest-registrant-evaluates.mjs --json          # 机器可读
//   node scripts/check-selftest-registrant-evaluates.mjs --files <a> <b> # 只判指定路径(自验)
//   node scripts/check-selftest-registrant-evaluates.mjs --self-test     # 纯判据构造面,零副作用
//   node scripts/check-selftest-registrant-evaluates.mjs --root <目录>    # 镜像/人工取证通道
// 行内出口:`selftest-registrant-exempt: <原因>`(必须带原因,只救**本行** —— 写在登记行是声明
//   "这个登记函数我知道它不求值",写在用例行是声明"这一条我知道它不会被判"。原因里请写清它属于
//   "我故意传函数、登记侧另有求值路径"还是别的;不许用注释闭合符冒充原因。)
// 到期档:该族已登记进守门 108 的 `FAMILY_LIFETIME_DAYS`,取 **30 天**(待偿债,不是结构性定性)——
//   出路是把登记侧改成求值或直接传结果。写 `... until YYYY-MM-DD` 才入账,正向锁由本门镜像测试
//   T10 钉住(表住在 108,此处不得复制天数表);"被真用上而未登记"那一格自 2026-09-28 起是 108 的
//   判据 E4(提交链档、HEAD 锚点棘轮,存量只报数)。

import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { maskCommentsStringsAndRegex } from './lib/code-mask.mjs'
import {
  Undetermined,
  assertRepoRoot,
  catBatch,
  gitRaw,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
/** ROOT 由脚本自身位置推导(§15,不得写死盘符)。 */
const ROOT = resolve(HERE, '..')

export const SELF_SKIP = 'HUSKY_SKIP_SELFTEST_REGISTRANT'
export const EXEMPT_MARK = 'selftest-registrant-exempt'
/**
 * R-EXIST 的**唯一出路**:自检用例登记器的共用出口模块。
 * 逐字给出是为了让本门与它的镜像测试都指着同一个字符串(§22c:两处实现必漂移是本仓记过最多次的失败型)。
 */
export const SELF_ROUTE = 'scripts/lib/selftest-registrant.mjs'
/** 射程:仓库根一级 `scripts/*.mjs`。见头注"射程边界"①。 */
export const SCOPE_RE = /^scripts\/[^/]+\.mjs$/
const GIT_TIMEOUT = 120000

const DELIMS = { '(': ')', '[': ']', '{': '}' }

function escIdent(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 从 `text[i]`(必须是开括号)走到配对闭括号,返回其**后一位**;配不平返回 -1。 */
export function matchDelim(text, i) {
  const open = text[i]
  const close = DELIMS[open]
  if (!close) return -1
  let d = 0
  for (let k = i; k < text.length; k++) {
    const c = text[k]
    if (c === open) d += 1
    else if (c === close) {
      d -= 1
      if (d === 0) return k + 1
    }
  }
  return -1
}

/** 深度 0 遇 `;` 或换行即止;深度 >0 允许跨行(所以多行 `push({...})` 是一个整体)。 */
function takeExpr(text, from) {
  let depth = 0
  for (let i = from; i < text.length; i++) {
    const c = text[i]
    if (c === '(' || c === '[' || c === '{') depth += 1
    else if (c === ')' || c === ']' || c === '}') {
      if (depth === 0) return text.slice(from, i)
      depth -= 1
    } else if (depth === 0 && (c === '\n' || c === ';')) return text.slice(from, i)
  }
  return text.slice(from)
}

/** 顶层切分(尊重 ()[]{} 深度):形参表与实参表共用这一份。 */
export function splitTop(text, sep = ',') {
  const out = []
  let d = 0
  let cur = ''
  for (const c of text) {
    if (c === '(' || c === '[' || c === '{') d += 1
    else if (c === ')' || c === ']' || c === '}') d -= 1
    if (c === sep && d === 0) {
      out.push(cur)
      cur = ''
      continue
    }
    cur += c
  }
  out.push(cur)
  return out
}

/** 某个标识符在文本里的整词出现位置(前后都不是标识符字符;前也不允许是 `.`)。 */
export function occurrences(text, word) {
  const out = []
  let from = 0
  for (;;) {
    const k = text.indexOf(word, from)
    if (k < 0) break
    const before = k === 0 ? '' : text[k - 1]
    const after = text[k + word.length] || ''
    if (!/[\w$.]/.test(before) && !/[\w$]/.test(after)) out.push(k)
    from = k + 1
  }
  return out
}

function hasWord(text, word) {
  return occurrences(text, word).length > 0
}

/** 偏移 → 1 起算行号(遮罩等长 ⇒ 同一套行号对原文同样成立)。 */
export function lineOf(text, offset) {
  let line = 1
  for (let i = 0; i < offset && i < text.length; i++) if (text[i] === '\n') line += 1
  return line
}

/** 对象字面量文本 → 顶层条目 [{key, expr}];含 `...` 展开 ⇒ null(键名看不见)。 */
export function objectEntries(objText) {
  const inner = objText.slice(1, -1)
  const entries = []
  for (const raw of splitTop(inner)) {
    const e = raw.trim()
    if (e === '') continue
    if (e.startsWith('...')) return null
    const m = /^([A-Za-z_$][\w$]*)\s*:\s*([\s\S]*)$/.exec(e)
    if (m) entries.push({ key: m[1], expr: m[2].trim() })
    else if (/^[A-Za-z_$][\w$]*$/.test(e)) entries.push({ key: e, expr: e })
    else entries.push({ key: null, expr: e })
  }
  return entries
}

/**
 * 形参是否出现在**别的调用的实参位**里。刻意是近似判据(只看"某个 callee 的括号内含该词"),
 * 因为这一型本门结构上判不出"那层是不是求值" —— 判不出就走未判定,不猜成求值也不猜成潜伏。
 */
export function paramInCallArgs(expr, word) {
  // callee 的 `(` 本身就算"形参前面的那个非标识符字符",所以这里用后顾而不是再吃一个字符:
  // 写成 `[^)]*(?:[\s(,]|^)word` 时,`runCase(fn)` 里那个 `(` 已被 `\(` 消耗,整条永不命中。
  const re = new RegExp(`[A-Za-z_$][\\w$.]*\\s*\\([^)]*(?<![\\w$.])${escIdent(word)}(?![\\w$])`)
  return re.test(expr)
}

/** 顶层"裸值比较":两侧都只是标识符或 true/false 字面量(不含任何调用 ⇒ 传函数必得 false)。 */
function bareComparisonOfParams(expr, valueParam, allParams) {
  const m = /^([\s\S]*?)\s*(?:===?|!==?)\s*([\s\S]*)$/.exec(expr)
  if (!m) return false
  const sideIsBare = (s) =>
    /^(true|false|[A-Za-z_$][\w$]*)$/.test(s.trim()) || /^!{1,2}[A-Za-z_$][\w$]*$/.test(s.trim())
  if (!sideIsBare(m[1]) || !sideIsBare(m[2])) return false
  const words = [
    m[1].replace(/^!+/, '').trim(),
    m[2].replace(/^!+/, '').trim(),
  ]
  if (!words.includes(valueParam)) return false
  // 另一侧必须是**另一个形参**或 true/false —— 这才是"两个值比一比"的 eq 族
  const other = words.find((w) => w !== valueParam)
  return other === 'true' || other === 'false' || allParams.includes(other)
}

/**
 * 单个登记函数的定性。kind:
 *   `evaluates`      形参被求值(体内直接调用,或存进去的键在全文被当函数调)
 *   `latent`         实参被裸存 / 布尔强制 / 真值化,且全文无求值证据 ⇒ R-REG 命中
 *   `strict-compare` 值比较族:传函数得 false ⇒ 当场翻红 ⇒ **不计潜伏也不判红**
 *   `undetermined`   形参被喂进别的调用等判不出的形态 ⇒ 报名,不猜
 *   null             不是候选(没 push 对象 / 对象里没有第二形参)
 */
export function classifyRegistrar({ name, valueParam, allParams, body, whole }) {
  const callRe = new RegExp(`(?:^|[^.\\w$])${escIdent(valueParam)}\\s*(?:\\?\\.)?\\(`)
  if (callRe.test(body)) return { kind: 'evaluates', why: '函数体内直接调用该形参' }
  const pushes = []
  for (const m of body.matchAll(/([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\.push\s*\(/g)) {
    const openAt = body.indexOf('(', m.index + m[1].length)
    if (openAt < 0) continue
    const end = matchDelim(body, openAt)
    if (end < 0) return { kind: 'undetermined', why: `${name}:push(...) 括号配不平,读不到被登记的对象` }
    const args = splitTop(body.slice(openAt + 1, end - 1))
    const first = (args[0] || '').trim()
    if (!first.startsWith('{')) continue // 存数组/其它 ⇒ 不是本族(先算再存的那些按定义已求值)
    const entries = objectEntries(first)
    if (entries === null)
      return { kind: 'undetermined', why: `${name}:push({...展开}) 看不见键名,判不出存的是不是结论` }
    pushes.push({ target: m[1], entries })
  }
  if (pushes.length === 0) return null
  const hits = []
  for (const p of pushes)
    for (const e of p.entries)
      if (hasWord(e.expr, valueParam))
        hits.push({ key: e.key ?? valueParam, expr: e.expr, shorthand: e.key === e.expr })
  if (hits.length === 0) return null // 第二形参没进被存的对象 ⇒ 那是别的两参数 helper,不是用例登记函数

  if (hits.some((h) => bareComparisonOfParams(h.expr, valueParam, allParams)))
    return {
      kind: 'strict-compare',
      why: `${name} 存的是 ${valueParam} 与另一个值的比较:传函数得 false ⇒ 当场翻红,不属潜伏`,
    }
  const raw = hits.find((h) => h.shorthand || h.expr === valueParam)
  if (raw) {
    const viaKey = new RegExp(
      `\\.\\s*${escIdent(raw.key)}\\s*(?:\\?\\.)?\\(|\\.\\s*${escIdent(raw.key)}\\s*\\.\\s*(?:call|apply|bind)\\s*\\(`,
    )
    if (viaKey.test(whole))
      return { kind: 'evaluates', why: `裸存,但全文有 .${raw.key}() 形态的求值点(thunk 族)` }
    return { kind: 'latent', why: `${name} 把 ${valueParam} 裸存进 { ${raw.key} } 而全文无人调用 .${raw.key}()` }
  }
  const bang = hits.find((h) => new RegExp(`^!{1,}${escIdent(valueParam)}$`).test(h.expr))
  if (bang) return { kind: 'latent', why: `${name} 存的是 !${valueParam}(布尔强制,函数恒为真)` }
  const boxed = hits.find(
    (h) =>
      new RegExp(`^Boolean\\s*\\(\\s*${escIdent(valueParam)}\\s*\\)$`).test(h.expr) ||
      new RegExp(`^String\\s*\\(\\s*${escIdent(valueParam)}\\s*\\)$`).test(h.expr),
  )
  if (boxed) return { kind: 'latent', why: `${name} 存的是对 ${valueParam} 的装箱/强制,未调用它` }
  if (hits.some((h) => paramInCallArgs(h.expr, valueParam)) || paramInCallArgs(body, valueParam))
    return {
      kind: 'undetermined',
      why: `${name}: ${valueParam} 被喂进别的调用,本门判不出那一层是不是求值`,
    }
  return { kind: 'latent', why: `${name} 存的是对 ${valueParam} 的非求值表达式(真值化/属性读取等)` }
}

/**
 * 自检宿主的命名约定:登记的声明必须落在这些函数体**之内**。
 * 现读的宿主名只有 `selfTest` / `runSelfTest` / `selfTestRun` 三类(另有箭头 helper 嵌在其体内),
 * 而"声明在模块作用域或数据收集器里"的两参数 push 函数**不是**用例登记函数 ——
 * 不加这一层限定的话,`scanSource` / `walk` / `findViolations` / `route` 那一族(现读 30 处)会全部
 * 被算成潜伏登记,其中 `route(method, handler)` 这类"合法登记回调"只要有人传箭头函数就是假红。
 * 代价如实登记(已知漏报):宿主另取它名(如 `auditSelf` / `verifyInternals`)的文件不进射程。
 */
export const HOST_NAME_RE = /self[-_ ]?(?:test|check)/i
const HOST_DECL_RES = [
  new RegExp(
    `(?:^|[^.\\w$])(?:async\\s+)?function\\s+([A-Za-z_$][\\w$]*)\\s*\\((?:[^()]|\\([^()]*\\))*\\)`,
    'gd',
  ),
  new RegExp(
    `(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*(?:async\\s+)?(?:function\\s*[A-Za-z_$][\\w$]*\\s*)?\\((?:[^()]|\\([^()]*\\))*\\)\\s*=>`,
    'gd',
  ),
]

/** 找出全部自检宿主函数的体区间 [start, end)。 */
export function findSelfTestHosts(code) {
  const out = []
  for (const re of HOST_DECL_RES) {
    for (const m of code.matchAll(re)) {
      if (!HOST_NAME_RE.test(m[1])) continue
      let p = m.index + m[0].length
      while (p < code.length && /\s/.test(code[p])) p += 1
      if (code[p] !== '{') continue // 体是表达式而非块 ⇒ 没有"之内"可言
      const end = matchDelim(code, p)
      if (end < 0) continue
      const at = m.indices && m.indices[1] ? m.indices[1][0] : m.index
      out.push({ name: m[1], start: p, end, declLine: lineOf(code, at) })
    }
  }
  return out
}

function hostFor(hosts, offset) {
  return hosts.find((h) => offset >= h.start && offset < h.end) || null
}

/** 全文找登记函数的候选声明(箭头 / function 声明 / 具名函数表达式三种)。 */
export function findRegistrars(code) {
  const out = []
  const PARAMS = '((?:[^()]|\\([^()]*\\))*)'
  const RES = [
    {
      kind: 'arrow',
      re: new RegExp(
        `(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*(?:async\\s+)?\\(${PARAMS}\\)\\s*=>`,
        'gd',
      ),
    },
    {
      kind: 'function',
      re: new RegExp(`(?:^|[^.\\w$])function\\s+([A-Za-z_$][\\w$]*)\\s*\\(${PARAMS}\\)`, 'gd'),
    },
    {
      kind: 'function',
      re: new RegExp(
        `(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*(?:async\\s+)?function\\s*[A-Za-z_$][\\w$]*\\s*\\(${PARAMS}\\)`,
        'gd',
      ),
    },
  ]
  const seen = new Set()
  for (const { kind, re } of RES) {
    for (const m of code.matchAll(re)) {
      const name = m[1]
      // 'd' 旗标给的分组绝对偏移:`function` 形态的正则含一个前导非词字符,
      // 用 m.index 会把声明行算到**上一行**去(豁免判据读的就是这一行)。
      const at = m.indices && m.indices[1] ? m.indices[1][0] : m.index
      const params = splitTop(m[2] || '')
        .map((s) => s.trim())
        .filter((s) => s !== '')
      if (params.length < 2) continue
      const second = params[1].split('=')[0].trim()
      if (!/^[A-Za-z_$][\w$]*$/.test(second)) continue // 解构/复杂形参 ⇒ 不猜
      let bodyStart = m.index + m[0].length
      while (bodyStart < code.length && /\s/.test(code[bodyStart])) bodyStart += 1
      if (bodyStart >= code.length) continue
      let body
      if (code[bodyStart] === '{') {
        const end = matchDelim(code, bodyStart)
        if (end < 0) continue
        body = code.slice(bodyStart, end)
      } else {
        if (kind === 'function') continue
        body = takeExpr(code, bodyStart)
      }
      const key = `${name}@${at}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({
        name,
        valueParam: second,
        allParams: params.map((p) => p.split('=')[0].trim()),
        body,
        declIndex: at,
        declLine: lineOf(code, at),
      })
    }
  }
  return out
}

/**
 * 第二实参的形态。只把**裸箭头函数 / 裸 function** 算作"函数形态用例"。
 * 先判"括号整体随后被调用"(IIFE / 派生),否则 `(() => {…})()` 会被裸箭头的形状误接。
 */
export function secondArgForm(rawArg) {
  const s = String(rawArg ?? '').trim()
  if (s === '') return { form: 'empty', why: '实参为空(尾逗号)' }
  if (/^await\b/.test(s)) return { form: 'expr', why: 'await 现算 ⇒ 即算即得' }
  if (s[0] === '(') {
    const close = matchDelim(s, 0)
    if (close < 0) return { form: 'undetermined', why: '实参自身括号配不平' }
    const nxt = s.slice(close).trimStart()
    if (nxt.startsWith('(') || nxt.startsWith('.'))
      return { form: 'self-invoking', why: '括号整体随后被调用(自调用/派生)⇒ 不是裸函数' }
  }
  if (/^(?:async\s+)?function\b/.test(s)) return { form: 'fn-literal', why: '裸 function 表达式' }
  if (/^(?:async\s+)?(?:[A-Za-z_$][\w$]*|\([\s\S]*\))\s*=>/.test(s))
    return { form: 'fn-literal', why: '裸箭头函数' }
  if (/^[A-Za-z_$][\w$]*$/.test(s)) return { form: 'identifier', why: '单个标识符(不是函数面字面量)' }
  return { form: 'expr', why: '表达式/现算结果' }
}

/** 行内豁免:必须带原因,只救本行;原因不得由注释闭合符冒充。 */
export function exemptOnLine(line) {
  const m = new RegExp(`\\b${EXEMPT_MARK}\\s*:\\s*([\\s\\S]*)$`).exec(line)
  if (!m) {
    const bare = new RegExp(`\\b${EXEMPT_MARK}\\b`).test(line)
    return { exempt: false, why: bare ? '标记后没有 `: 原因` ⇒ 不计豁免' : '' }
  }
  let reason = m[1]
  for (;;) {
    const t = reason.replace(/\s+$/, '')
    if (t.endsWith('*/')) {
      reason = t.slice(0, -2)
      continue
    }
    reason = t
    break
  }
  if (reason.trim().length < 2) return { exempt: false, why: '冒号后为空或只有闭合符 ⇒ 不计豁免' }
  return { exempt: true, why: reason.trim() }
}

/** 找某个登记函数的调用点及其第二实参形态(遮罩后的代码面上判,豁免看原文行)。 */
export function findCaseCalls(code, name, rawLines, from = 0, to = code.length) {
  const out = []
  const re = new RegExp(`(?:^|[^.\\w$])${escIdent(name)}\\s*\\(`, 'g')
  for (const m of code.matchAll(re)) {
    // 只在**同一个自检宿主内**配对:同名登记函数在别处出现(或别的文件复用了 `t` 这个名字)
    // 不构成"这一族的用例传了函数"。
    if (m.index < from || m.index >= to) continue
    const openAt = m.index + m[0].length - 1
    const end = matchDelim(code, openAt)
    const at = lineOf(code, m.index)
    const exempt = exemptOnLine(rawLines[at - 1] || '')
    if (end < 0) {
      out.push({ line: at, form: 'undetermined', why: '调用括号配不平(跨行未闭合或被遮罩切断)', exempt })
      continue
    }
    const args = splitTop(code.slice(openAt + 1, end - 1))
    if (args.length < 2) continue // 没传结论实参 ⇒ 不参与配对
    const f = secondArgForm(args[1])
    out.push({ line: at, form: f.form, why: f.why, exempt })
  }
  return out
}

/**
 * 单文件定性(纯函数,零副作用)。
 * { file, decls, hosts, registrars, latent[], evaluates, strictCompare[], undetermined[], exempted[], red[], selfMade[], unreadable }
 *   decls      = 全文两参数函数声明候选数(含宿主之外的数据收集器,只当覆盖面看)
 *   registrars = 落在自检宿主内、且被成功定性的**用例登记函数**数
 *   selfMade   = 上述登记函数逐条点名(R-EXIST:出路归属,不是覆盖面)
 */
export function analyzeSource({ rel, raw }) {
  const res = {
    file: rel,
    decls: 0,
    hosts: 0,
    registrars: 0,
    latent: [],
    evaluates: 0,
    strictCompare: [],
    undetermined: [],
    exempted: [],
    red: [],
    selfMade: [],
    unreadable: typeof raw === 'string' ? null : `${rel}: 内容取不到`,
  }
  if (typeof raw !== 'string') return res
  const code = maskCommentsStringsAndRegex(raw)
  const rawLines = raw.split(/\r?\n/)
  const hosts = findSelfTestHosts(code)
  res.hosts = hosts.length
  const regs = findRegistrars(code)
  res.decls = regs.length
  for (const r of regs) {
    const host = hostFor(hosts, r.declIndex)
    if (!host) continue // 不在自检宿主体内 ⇒ 那是数据收集器,不是用例登记函数(见 HOST_NAME_RE 头注)
    const c = classifyRegistrar({
      name: r.name,
      valueParam: r.valueParam,
      allParams: r.allParams,
      body: r.body,
      whole: code,
    })
    if (c === null) continue
    res.registrars += 1
    // R-EXIST(只报数,见 decide):宿主内的用例登记函数**一律**是"本地自造",出路只有
    // `scripts/lib/selftest-registrant.mjs` 一条。它与 `registrars` 数值同源但答的不是
    // 同一个问题:`registrars` 答"本门尺子有没有覆盖面",`selfMade` 答"这些登记器该不该
    // 还在本地自造" —— 后者才是"没有共用出口、靠抄邻居"那 41 处投影的债口。
    // 判据不设豁免:真要声明"我故意自己造一个",该做的是把它挪进 lib 里的共用出口。
    res.selfMade.push({
      name: r.name,
      line: r.declLine,
      param: r.valueParam,
      kind: c.kind,
      host: host.name,
      why: `${r.name}(name, ${r.valueParam}) 在自检宿主 ${host.name} 内本地自造;出口只有 ${SELF_ROUTE}`,
    })
    if (c.kind === 'evaluates') res.evaluates += 1
    else if (c.kind === 'strict-compare') res.strictCompare.push({ name: r.name, line: r.declLine, why: c.why })
    else if (c.kind === 'undetermined') res.undetermined.push({ name: r.name, line: r.declLine, why: c.why })
    else {
      const ex = exemptOnLine(rawLines[r.declLine - 1] || '')
      if (ex.exempt) {
        res.exempted.push({ name: r.name, line: r.declLine, reason: ex.why })
        continue
      }
      res.latent.push({
        name: r.name,
        declLine: r.declLine,
        param: r.valueParam,
        host: host.start,
        hostEnd: host.end,
        why: c.why,
      })
    }
  }
  for (const lat of res.latent) {
    const calls = findCaseCalls(code, lat.name, rawLines, lat.host, lat.hostEnd)
    const fnCases = []
    for (const c of calls) {
      if (c.exempt.exempt) {
        res.exempted.push({ name: lat.name, line: c.line, reason: c.exempt.why })
        continue
      }
      if (c.form === 'undetermined')
        res.undetermined.push({ name: lat.name, line: c.line, why: `用例实参判不出:${c.why}` })
      else if (c.form === 'fn-literal') fnCases.push(c.line)
    }
    if (fnCases.length)
      res.red.push({
        file: rel,
        registrar: lat.name,
        param: lat.param,
        declLine: lat.declLine,
        why: lat.why,
        caseLines: [...new Set(fnCases)].sort((a, b) => a - b),
      })
  }
  return res
}

/**
 * 聚合。**空枚举不记绿**;`--strict` 另在两格拒绝出合格证(有未判定 / 整仓一处登记函数都没看见)。
 * 优先级:取不到 > 空枚举 > 配对红 > strict 下的"没看清"。
 */
export function decide({ verdicts, enumerated, strict = false }) {
  const red = []
  const undetermined = []
  const latent = []
  const selfMade = []
  const counts = {
    files: enumerated,
    hosts: 0,
    decls: 0,
    registrars: 0,
    latent: 0,
    evaluates: 0,
    strictCompare: 0,
    exempted: 0,
    unreadable: 0,
    selfMade: 0,
  }
  for (const v of verdicts) {
    counts.hosts += v.hosts || 0
    counts.decls += v.decls || 0
    counts.registrars += v.registrars
    counts.evaluates += v.evaluates
    counts.latent += v.latent.length
    counts.strictCompare += v.strictCompare.length
    counts.exempted += v.exempted.length
    if (v.unreadable) counts.unreadable += 1
    for (const u of v.undetermined) undetermined.push({ file: v.file, ...u })
    for (const l of v.latent) latent.push({ file: v.file, name: l.name, line: l.declLine, why: l.why })
    for (const r of v.red) red.push(r)
    for (const s of v.selfMade || []) selfMade.push({ file: v.file, ...s })
  }
  counts.selfMade = selfMade.length
  let exit = 0
  let why = ''
  if (counts.unreadable > 0) {
    exit = 2
    why = '有在射程文件内容取不到 ⇒ 无法判定(不记绿也不冒红)'
  } else if (enumerated === 0) {
    exit = 2
    why = '被审面上枚举到 0 个在射程文件 ⇒ 判据失效,不计通过'
  } else if (red.length > 0) {
    exit = 1
    why = `${red.length} 处「登记不求值 ∧ 用例传函数」配对红`
  } else if (strict && undetermined.length > 0) {
    exit = 2
    why = `--strict:${undetermined.length} 处形态判不出 ⇒ 拒绝出具合格证`
  } else if (strict && counts.registrars === 0) {
    exit = 2
    why = '--strict:整仓一处登记函数都没看见 ⇒ 尺子可能失明,拒绝出具合格证'
  }
  return { exit, why, red, undetermined, latent, selfMade, counts }
}

/** 在射程文件清单:全量走 HEAD 树,`--staged`/`--worktree` 走索引。 */
export function listScopeFiles(root, face) {
  const args = face === 'head' ? ['ls-tree', '-r', '--name-only', 'HEAD', '-z'] : ['ls-files', '-z']
  const out = gitRaw(args, root, { timeout: GIT_TIMEOUT })
  return out.split('\0').filter(Boolean).filter((p) => SCOPE_RE.test(p))
}

/** 取材:全量判 HEAD blob、`--staged` 判索引 blob、`--worktree` 仅人工(经 face-reader,不散写 git)。 */
export function readFace(root, face, paths) {
  const map = new Map()
  if (!paths.length) return map
  if (face === 'worktree') {
    for (const p of paths) map.set(p, readWorktreeFile(root, p))
    return map
  }
  const rev = face === 'staged' ? '' : 'HEAD'
  const specs = paths.map((p) => `${rev}:${p}`)
  const got = catBatch(root, specs, { maxBuffer: 1 << 29, timeout: GIT_TIMEOUT })
  for (let i = 0; i < paths.length; i++) map.set(paths[i], got.get(specs[i]) ?? null)
  return map
}

export function analyze(root, face) {
  const files = listScopeFiles(root, face)
  const texts = readFace(root, face, files)
  const verdicts = files.map((p) => analyzeSource({ rel: p, raw: texts.get(p) }))
  return { face, verdicts, enumerated: files.length }
}

/** 带值旗标的取值(口径照抄本仓既有门:紧邻 token 必须存在、非空且不以 `-` 开头)。 */
export function flagValue(list, flag) {
  if (!Array.isArray(list) || !list.includes(flag))
    return { present: false, valid: false, value: null, token: null }
  const raw = list[list.indexOf(flag) + 1]
  const token = typeof raw === 'string' ? raw : null
  const valid = token !== null && token !== '' && !token.startsWith('-')
  return { present: true, valid, value: valid ? token : null, token }
}

export function resolveRootArg(argv) {
  const f = flagValue(argv, '--root')
  if (f.present && !f.valid) {
    const got = f.token === null ? '(其后没有任何参数)' : JSON.stringify(f.token)
    return { root: null, error: `--root 没有收到有效目录 —— 紧邻的 token 实得:${got}` }
  }
  const root = f.present ? resolve(f.value) : ROOT
  try {
    assertRepoRoot(root, '本门')
  } catch (e) {
    return { root: null, error: e instanceof Undetermined ? e.message : String(e?.message ?? e) }
  }
  return { root, error: null }
}

function main(argv) {
  const { root, error: rootErr } = resolveRootArg(argv)
  if (rootErr) {
    console.error(`❌ 无法判定(exit 2): ${rootErr}`)
    return 2
  }
  const { face, error } = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  if (error) {
    console.error(`❌ 无法判定: ${error}`)
    return 2
  }
  const strict = argv.includes('--strict')
  const filesFlag = flagValue(argv, '--files')
  let out
  try {
    if (filesFlag.present && filesFlag.valid) {
      const files = argv.slice(argv.indexOf('--files') + 1).filter((a) => !a.startsWith('--'))
      const texts = readFace(root, face, files)
      const verdicts = files.map((p) => analyzeSource({ rel: p, raw: texts.get(p) }))
      out = { face, ...decide({ verdicts, enumerated: files.length, strict }) }
    } else {
      const a = analyze(root, face)
      out = { face, ...decide({ verdicts: a.verdicts, enumerated: a.enumerated, strict }) }
    }
  } catch (e) {
    const msg = e instanceof Undetermined ? e.message : (e?.message ?? String(e))
    console.error(`❌ 无法判定(exit 2): ${msg}`)
    if (!(e instanceof Undetermined)) console.error(e?.stack ?? '')
    return 2
  }
  if (argv.includes('--json')) {
    console.log(JSON.stringify(out, null, 2))
    return out.exit
  }
  const c = out.counts
  console.log(
    `判定面:${face === 'staged' ? '索引 blob' : face === 'worktree' ? '工作树(仅人工)' : 'HEAD blob'}`,
  )
  if (out.red.length) {
    console.error(
      `❌ 检出 ${out.red.length} 处「登记侧不求值 ∧ 用例传函数」—— 下面这些 self-test 条目**从未被判过**:`,
    )
    for (const r of out.red)
      console.error(
        `   ${r.file}:${r.declLine}  const ${r.name}(name, ${r.param}) —— ${r.why}` +
          `  ← 函数形态用例 @ 行 ${r.caseLines.join(', ')}`,
      )
    console.error(
      '   出路只有一条:把**登记侧**改成求值形态 —— 体内调用该形参,或改用 thunk 族 ' +
        '`push({ name, fn })` + 消费循环 `c.fn()`。',
    )
    console.error(
      '         禁止"把用例改成布尔"去过门 —— 那只是让同一个不求值的登记函数换一种写法继续隐身。',
    )
    console.error(
      `         确属有意(另有求值路径)时:在登记行或用例行写 \`${EXEMPT_MARK}: <原因>\`(只救本行)。`,
    )
  }
  console.log(
    `在射程文件 ${c.files} / 自检宿主 ${c.hosts} / 宿主内登记函数 ${c.registrars}(全文两参数候选 ${c.decls})/ ` +
      `已求值 ${c.evaluates} / 潜伏 ${c.latent} / 值比较族(不计潜伏)${c.strictCompare} / 已豁免 ${c.exempted} / ` +
      `未判定 ${out.undetermined.length} / 配对红 ${out.red.length} / 取不到 ${c.unreadable}`,
  )
  // R-EXIST(只报数档,**刻意不参与 exit 判定**):现读数十位,接线成 blocking 就是一台与任何
  // 提交都无关的恒红门(§12f 同型)。它是债口不是判决 —— 降级是设计内口径,不是缺陷。
  console.log(
    `本地自造登记器 ${c.selfMade} 处(R-EXIST,只报数):出路只有 ${SELF_ROUTE} —— ` +
      '宿主内的用例登记器一律点名,与"已求值/潜伏"那一格无关(一个判对了的本地登记器同样该搬)。',
  )
  if (c.latent > 0)
    console.log(
      `ℹ️ 潜伏 ${c.latent} 处按设计**只报数**:它们现有用例都传即算即得的形态,今天没有掩盖任何缺陷;` +
        '当场判红就是一台与任何提交都无关的恒红门(§12f)。它们掩盖的是下一个用 `() =>` 写用例的人。',
    )
  for (const u of out.undetermined)
    console.log(`ℹ️ 未判定 ${u.file}:${u.line} ${u.name} —— ${u.why}(不猜也不记绿;--strict 拒绝出合格证)`)
  if (out.exit === 2) console.log(`❌ 无法判定:${out.why}`)
  else if (out.exit === 1) console.log(`❌ ${out.why}`)
  else console.log('✅ 配对红 0 处(潜伏档只报数,见上一行)')
  return out.exit
}

/**
 * 判据自检:纯函数 + 构造面,零副作用(不读仓库、不起 git)。
 * 登记形态刻意用**本门认定的合规写法**(thunk 族 `push({name, fn})` + 消费循环 `c.fn()`)——
 * 一道守"不求值配对"的门,自己的自检若用被禁的写法,就是本仓记过最多次的"判据对自己产出的形态失明"。
 */
function selfTest() {
  const cases = []
  const t = (name, fn) => cases.push({ name, fn })

  /**
   * 夹具投递口:除"宿主之外不成候选"那一例外,所有夹具都要落在**自检宿主体内** ——
   * 本门的射程就是"自检宿主里的登记函数"(见 HOST_NAME_RE 头注)。夹具本身已写了宿主的
   * (a / c 两条)不再套第二层,免得行号漂移把豁免用例的对行断言弄歪。
   */
  const probeSelf = (rel, src) => {
    const hostM = /function\s+([A-Za-z_$][\w$]*)\s*\(/.exec(src)
    const alreadyHosted = !!hostM && HOST_NAME_RE.test(hostM[1])
    const raw = alreadyHosted
      ? src
      : ['function selfTest() {', ...src.split('\n'), '  return 0', '}'].join('\n')
    return analyzeSource({ rel, raw })
  }

  t('a) 潜伏裸存 + 裸箭头用例 ⇒ 判红并点名门名与用例行', () => {
    const src = [
      'function selfTest() {',
      '  const cases = []',
      '  const t = (name, ok) => cases.push({ name, ok })',
      '  t(PROPER, () => true)',
      '  return cases',
      '}',
    ].join('\n')
    const r = probeSelf('scripts/check-a.mjs', src)
    if (r.red.length !== 1) return `red=${JSON.stringify(r.red)}`
    if (r.red[0].registrar !== 't') return `registrar=${r.red[0].registrar}`
    if (r.red[0].caseLines.length !== 1) return `caseLines=${r.red[0].caseLines}`
    return true
  })

  t('b) 潜伏裸存 + 布尔表达式用例 ⇒ 不判红,只计潜伏(今天 41 道的处境;判红=恒红门)', () => {
    const src = [
      'const t = (name, ok) => cases.push({ name, ok })',
      't(PROPER, a === b)',
    ].join('\n')
    const r = probeSelf('scripts/check-b.mjs', src)
    if (r.red.length) return `不该判红:${JSON.stringify(r.red)}`
    if (r.latent.length !== 1) return `潜伏应计 1,实得 ${r.latent.length}`
    return true
  })

  t('c) thunk 族 push({name,fn}) + 循环里 c.fn() + 函数用例 ⇒ 判绿(最易做成假阳的一档)', () => {
    const src = [
      'function selfTest() {',
      '  const cases = []',
      '  const t = (name, fn) => cases.push({ name, fn })',
      '  t(PROPER, () => {',
      '    return a === b',
      '  })',
      '  let failed = 0',
      '  for (const c of cases) {',
      '    try { c.fn() } catch (e) { failed++ }',
      '  }',
      '  return failed',
      '}',
    ].join('\n')
    const r = probeSelf('scripts/check-c.mjs', src)
    if (r.red.length) return `thunk 族被判红:${JSON.stringify(r.red)}`
    if (r.evaluates !== 1) return `evaluates 应为 1,实得 ${r.evaluates}`
    if (r.latent.length) return `thunk 族被误计潜伏:${r.latent.map((x) => x.name).join()}`
    return true
  })

  t("c') 求值证据在另一个函数里(消费循环离声明很远)仍算已求值", () => {
    const src = [
      'const t = (name, fn) => cases.push({ name, fn })',
      'function later() {',
      '  for (const c of cases) void c.fn()',
      '}',
    ].join('\n')
    const r = probeSelf('scripts/check-c2.mjs', src)
    if (r.evaluates !== 1) return `evaluates=${r.evaluates}`
    if (r.red.length) return '被判红'
    return true
  })

  t('d) 自调用 (() => {…})() ⇒ 不算函数形态用例(即算即得)', () => {
    const src = [
      'const t = (name, ok) => cases.push({ name, ok })',
      't(PROPER, (() => {',
      '  return a === b',
      '})())',
      't(PROPER2, (() => x)())',
    ].join('\n')
    const r = probeSelf('scripts/check-d.mjs', src)
    if (r.red.length) return `自调用被判成函数用例:${JSON.stringify(r.red)}`
    if (r.latent.length !== 1) return `潜伏应计 1,实得 ${r.latent.length}`
    return true
  })

  t('e) 判据自身的注释/字符串里出现这些形状 ⇒ 不得自咬', () => {
    const src = [
      '// 历史上这里是 const t = (name, ok) => cases.push({ name, ok })',
      '/* 多行注释里写 t(PROPER, () => true) 也不是代码 */',
      "const doc2 = 't(PROPER, () => 2)'",
      'const doc = "示例:t(name, ok) => cases.push({ name, ok }) 与 t(PROPER, () => 1)"',
      'export const n = 1',
    ].join('\n')
    const r = probeSelf('scripts/check-e.mjs', src)
    if (r.registrars !== 0) return `注释/字符串被当候选:${r.registrars}`
    if (r.red.length) return '自咬'
    return true
  })

  t('e2) 遮罩方向反向锁:同一形状写在真代码里必须命中(证明 e 不是恒绿)', () => {
    const src = [
      'const t = (name, ok) => cases.push({ name, ok })',
      't(PROPER, () => true)',
    ].join('\n')
    const r = probeSelf('scripts/check-e2.mjs', src)
    if (r.red.length !== 1) return `真代码未命中:red=${r.red.length}`
    return true
  })

  t('f) 布尔强制 !!cond + 函数用例 ⇒ 判红(潜伏的另一形态)', () => {
    const src = [
      'const ck = (name, cond) => results.push({ name, ok: !!cond })',
      'ck(PROPER, () => true)',
    ].join('\n')
    const r = probeSelf('scripts/check-f.mjs', src)
    if (r.red.length !== 1) return `red=${r.red.length}`
    return true
  })

  t('g) 体内先求值再存(!!fn())⇒ 合规(求值证据优先于形态)', () => {
    const src = [
      'const t = (name, fn) => cases.push({ name, pass: !!fn() })',
      't(PROPER, () => true)',
    ].join('\n')
    const r = probeSelf('scripts/check-g.mjs', src)
    if (r.red.length) return '被判红'
    if (r.evaluates !== 1) return `evaluates=${r.evaluates}`
    return true
  })

  t('h) 值比较族 cond === true 不计潜伏(传函数会当场翻红,不是静默绿)', () => {
    const src = [
      'const t = (name, cond) => results.push({ name, pass: cond === true })',
      't(PROPER, () => true)',
    ].join('\n')
    const r = probeSelf('scripts/check-h.mjs', src)
    if (r.red.length) return '被判红'
    if (r.latent.length) return '被计潜伏'
    if (r.strictCompare.length !== 1) return `strictCompare=${r.strictCompare.length}`
    return true
  })

  t('i) 形参被喂进别的调用 ⇒ 未判定(既不冒红也不记绿)', () => {
    const src = [
      'const step = (name, fn) => cases.push({ name, got: runCase(fn) })',
      'step(PROPER, () => true)',
    ].join('\n')
    const r = probeSelf('scripts/check-i.mjs', src)
    if (r.red.length) return '被判红'
    if (r.undetermined.length !== 1) return `undetermined=${r.undetermined.length}`
    return true
  })

  t('j) async 登记函数里 await fn() ⇒ 合规', () => {
    const src = [
      'async function build(name, fn) {',
      '  const v = await fn()',
      '  cases.push({ name, v })',
      '}',
      'build(PROPER, async () => true)',
    ].join('\n')
    const r = probeSelf('scripts/check-j.mjs', src)
    if (r.red.length) return '被判红'
    if (r.evaluates !== 1) return `evaluates=${r.evaluates}`
    return true
  })

  t('k) push 的对象里没有第二形参的两参数 helper ⇒ 声明被看见但不成登记函数', () => {
    const src = ['const mk = (a, b) => list.push({ x: a })', 'mk(1, () => true)'].join('\n')
    const r = probeSelf('scripts/check-k.mjs', src)
    if (r.red.length) return '被判红'
    if (r.latent.length) return '被计潜伏'
    if (r.decls !== 1) return `声明候选应 1,实得 ${r.decls}`
    if (r.registrars !== 0) return `不该成登记函数,实得 ${r.registrars}`
    return true
  })

  t('l) eq 族(label, got, want)收函数实参 ⇒ 值比较族,不得冒红', () => {
    const src = [
      'const eq = (label, got, want) => results.push({ label, ok: got === want, got, want })',
      'eq(PROPER, () => 1, 1)',
    ].join('\n')
    const r = probeSelf('scripts/check-l.mjs', src)
    if (r.red.length) return `值比较族被判红:${JSON.stringify(r.red)}`
    if (r.latent.length) return '值比较族被计潜伏'
    return true
  })

  t('m) 豁免:带原因在登记行⇒放行;只有闭合符冒充原因⇒仍判红(成对)', () => {
    const srcA = [
      `const t = (name, ok) => cases.push({ name, ok }) // ${EXEMPT_MARK}: 本门用例一律由外部 runner 求值`,
      't(PROPER, () => true)',
    ].join('\n')
    const srcB = [
      `const t = (name, ok) => cases.push({ name, ok }) // ${EXEMPT_MARK}: */`,
      't(PROPER, () => true)',
    ].join('\n')
    const a = probeSelf('scripts/check-m1.mjs', srcA)
    const b = probeSelf('scripts/check-m2.mjs', srcB)
    if (a.red.length) return '带原因的豁免未生效'
    if (a.exempted.length !== 1) return `exempted=${a.exempted.length}`
    if (b.red.length !== 1) return '闭合符冒充原因竟被放行'
    return true
  })

  t('n) 豁免写在**用例**行 ⇒ 只救该条,同门其余用例照判', () => {
    const src = [
      'const t = (name, ok) => cases.push({ name, ok })',
      `t(PROPER_A, () => true) // ${EXEMPT_MARK}: 由 --strict 人工复核`,
      't(PROPER_B, () => false)',
    ].join('\n')
    const r = probeSelf('scripts/check-n.mjs', src)
    if (r.red.length !== 1) return `red=${r.red.length}`
    if (r.red[0].caseLines.length !== 1) return `caseLines=${r.red[0].caseLines}`
    return true
  })

  t('o) 调用括号配不平 ⇒ 未判定(不静默丢弃)', () => {
    // 刻意让**宿主**的括号是平的、只有那一处调用的圆括号没闭合:否则宿主区间自己配不平,
    // 整个宿主都看不见,这条判据分支就没有被测到(那是"漏判伪装成通过"的那一型)。
    const src = [
      'function selfTest() {',
      '  const t = (name, ok) => cases.push({ name, ok })',
      '  t(PROPER, () => {',
      '    return 1',
      '  }',
      '}',
    ].join('\n')
    const r = analyzeSource({ rel: 'scripts/check-o.mjs', raw: src })
    if (r.undetermined.length !== 1) return `undetermined=${r.undetermined.length}`
    if (r.red.length) return '配不平却判红'
    return true
  })

  t('p) decide:空枚举/取不到/未判定/配对红各归其位(0/1/2 不并桶)', () => {
    const base = {
      file: 'x',
      registrars: 2,
      latent: [{ name: 't' }],
      evaluates: 1,
      strictCompare: [],
      undetermined: [],
      exempted: [],
      red: [],
      unreadable: null,
    }
    const pairs = [
      [decide({ verdicts: [base], enumerated: 0 }).exit, 2],
      [decide({ verdicts: [base], enumerated: 10 }).exit, 0],
      [
        decide({
          verdicts: [{ ...base, red: [{ file: 'x', registrar: 't', caseLines: [3] }] }],
          enumerated: 10,
        }).exit,
        1,
      ],
      [
        decide({
          verdicts: [{ ...base, undetermined: [{ name: 't', line: 2, why: 'y' }] }],
          enumerated: 10,
          strict: true,
        }).exit,
        2,
      ],
      [
        decide({
          verdicts: [{ ...base, undetermined: [{ name: 't', line: 2, why: 'y' }] }],
          enumerated: 10,
        }).exit,
        0,
      ],
      [decide({ verdicts: [{ ...base, unreadable: 'x: 取不到' }], enumerated: 10 }).exit, 2],
    ]
    for (const [got, want] of pairs) if (got !== want) return `exit ${got} != ${want}`
    return true
  })

  t('q) 覆盖面对账:一处登记函数都没看见 ≠ 通过(--strict 拒绝出合格证)', () => {
    const empty = {
      file: 'x',
      registrars: 0,
      latent: [],
      evaluates: 0,
      strictCompare: [],
      undetermined: [],
      exempted: [],
      red: [],
      unreadable: null,
    }
    const r = decide({ verdicts: [empty], enumerated: 5, strict: true })
    if (r.exit !== 2) return `exit=${r.exit}`
    return true
  })

  t('r) 单个标识符实参 / await 现算 ⇒ 不算函数形态用例', () => {
    const src = [
      'const t = (name, ok) => cases.push({ name, ok })',
      't(PROPER_A, sharedCheck)',
      't(PROPER_B, await runIt())',
    ].join('\n')
    const r = probeSelf('scripts/check-r.mjs', src)
    if (r.red.length) return `被判红:${JSON.stringify(r.red)}`
    return true
  })

  t('s) 同名登记函数的多条函数形态用例并到一条红记录(不重复计债)', () => {
    const src = [
      'const t = (name, ok) => cases.push({ name, ok })',
      't(PROPER_A, () => 1)',
      't(PROPER_B, function () { return 2 })',
    ].join('\n')
    const r = probeSelf('scripts/check-s.mjs', src)
    if (r.red.length !== 1) return `red=${r.red.length}`
    if (r.red[0].caseLines.length !== 2) return `caseLines=${r.red[0].caseLines}`
    return true
  })

  t('t) 遮罩只有一份实现(本门不得自带第二份遮噪 —— 镜像 T1 钉源码形状)', () => {
    if (typeof maskCommentsStringsAndRegex !== 'function') return '没引 lib/code-mask 那一份'
    const one = maskCommentsStringsAndRegex('const a = 1 // 注释里的 cases.push({ name, ok })')
    if (one.includes('cases.push')) return '注释没被遮 ⇒ 判据会自咬'
    // 本门用**认正则**的那一档:正则字面量里的 `(` / `'` 是模式不是代码,不遮就会把
    // 真调用的括号算成配不平(现读 4 处未判定里 3 处正是这一型)。成对对照:正则体必须
    // 被遮掉,而真代码必须逐字留着 —— 只判一边就允许"把遮罩整体关掉"蒙过这一条。
    const rx = maskCommentsStringsAndRegex('const re = /\\(\\s*add\\(/g\nreadCases(x, () => 1)\n')
    if (rx.includes('add')) return '正则体没被遮 ⇒ 本门仍在用盲掉的那一档'
    if (!rx.includes('readCases')) return '真代码被吞 ⇒ 遮罩关掉了判据本身'
    return true
  })

  // ─── 射程限定:登记函数必须在**自检宿主**体内(HOST_NAME_RE) ───────────────────
  // 这三条是"配对判据不至于满天假红"的承重墙。没有 u),`route(method, handler)` 这类
  // 数据收集器只要被人用箭头函数调一次,就会被判成本门的红 —— 那是假红,而假红的代价是
  // 指使人去"修"没坏的东西(§12e 同族的"判据失效表现为安静,误判表现为吵"取向:宁可漏)。
  t('u) 宿主之外的两参数 push(数据收集器)不成候选,即便用例传函数', () => {
    const src = [
      'const routes = []',
      'function registerApp() {',
      '  const route = (method, handler) => routes.push({ method, handler })',
      "  route('GET', () => ok)",
      '}',
    ].join('\n')
    const r = analyzeSource({ rel: 'scripts/check-u.mjs', raw: src })
    if (r.red.length) return `数据收集器被判红:${JSON.stringify(r.red)}`
    if (r.latent.length) return '数据收集器被计潜伏'
    if (r.decls !== 1) return `声明候选应被看见,实得 ${r.decls}`
    if (r.registrars !== 0) return '宿主之外的声明不得成登记函数'
    return true
  })

  t('v) 宿主命名变体 runSelfTest / selfTestRun 都在射程内(不得只认一个名字)', () => {
    for (const hostName of ['selfTest', 'runSelfTest', 'selfTestRun', 'selfCheck']) {
      const src = [
        `function ${hostName}() {`,
        '  const cases = []',
        '  const t = (name, ok) => cases.push({ name, ok })',
        '  t(PROPER, () => true)',
        '  return 0',
        '}',
      ].join('\n')
      const r = analyzeSource({ rel: `scripts/check-v-${hostName}.mjs`, raw: src })
      if (r.red.length !== 1) return `宿主 ${hostName} 没进射程:red=${r.red.length}`
    }
    return true
  })

  t('w) 跨宿主同名不配对:两处各有一个 t,只有传函数的那处判红', () => {
    const src = [
      'function selfTest() {',
      '  const t = (name, ok) => cases.push({ name, ok })',
      '  t(PROPER_A, x === y)',
      '  return 0',
      '}',
      'function runSelfTest() {',
      '  const t = (name, ok) => cases.push({ name, ok })',
      '  t(PROPER_B, () => true)',
      '  return 0',
      '}',
    ].join('\n')
    const r = analyzeSource({ rel: 'scripts/check-w.mjs', raw: src })
    if (r.red.length !== 1) return `red=${JSON.stringify(r.red)}`
    if (r.red[0].declLine !== 7) return `登记行应 7,实得 ${r.red[0].declLine}`
    if (r.red[0].caseLines.join() !== '8') return `用例行应 8,实得 ${r.red[0].caseLines}`
    return true
  })


  // R-EXIST 的构造面自测(成对):本地自造 ⇒ 点名;共用出口的用法 ⇒ 不点名(证明它不是恒报)。
  t('R-EXIST) 本地自造登记器 ⇒ 逐条点名且给出唯一出路(判绿的那一档同样要点名)', () => {
    const src = [
      'function selfTest() {',
      '  const cases = []',
      '  const t = (name, cond) => cases.push({ name, cond })',
      '  t(PROPER, x === y)',
      '  for (const c of cases) if (c.cond === true) pass++',
      '  return 0',
      '}',
    ].join('\n')
    const r = analyzeSource({ rel: 'scripts/check-rex-a.mjs', raw: src })
    if (r.selfMade.length !== 1) return `selfMade=${r.selfMade.length}(应 1)`
    if (r.selfMade[0].name !== 't') return `name=${r.selfMade[0].name}`
    if (!r.selfMade[0].why.includes(SELF_ROUTE)) return `未给出唯一出路:${r.selfMade[0].why}`
    return true
  })

  t('R-EXIST) 反向对照:走共用出口(登记器不在宿主内声明)⇒ 不得点名', () => {
    const src = [
      "import { makeRegistrar } from './lib/selftest-registrant.mjs'",
      'function selfTest() {',
      '  const { t, report } = makeRegistrar()',
      "  t('PROPER', () => x === y)",
      '  return report().fail',
      '}',
    ].join('\n')
    const r = analyzeSource({ rel: 'scripts/check-rex-b.mjs', raw: src })
    if (r.selfMade.length) return `共用出口被误点名:${JSON.stringify(r.selfMade)}`
    return true
  })

  t('R-EXIST) 遮罩反向锁:同形状写在注释里不得被点名(证明它不是恒绿)', () => {
    const src = [
      'function selfTest() {',
      '  // 早先这里写 const t = (name, cond) => cases.push({ name, cond })',
      '  return 0',
      '}',
    ].join('\n')
    const r = analyzeSource({ rel: 'scripts/check-rex-c.mjs', raw: src })
    if (r.selfMade.length) return `注释里的形状被点名:${JSON.stringify(r.selfMade)}`
    return true
  })

  t('R-EXIST) 只报数:自造处再多也不改 exit(红/未判定各归其位,0/1/2 不因本判据并桶)', () => {
    const base = {
      file: 'x',
      registrars: 2,
      latent: [{ name: 't' }],
      evaluates: 1,
      strictCompare: [],
      undetermined: [],
      exempted: [],
      red: [],
      selfMade: [{ name: 't', line: 3, why: 'w' }],
      unreadable: null,
    }
    const got = decide({ verdicts: [base], enumerated: 10 })
    if (got.exit !== 0) return `自造 1 处却改了 exit:${got.exit}`
    if (got.counts.selfMade !== 1) return `selfMade=${got.counts.selfMade}`
    const red = decide({
      verdicts: [{ ...base, selfMade: [], red: [{ file: 'x', registrar: 't', caseLines: [3] }] }],
      enumerated: 10,
    })
    if (red.exit !== 1) return `配对红档 exit=${red.exit}`
    const und = decide({
      verdicts: [{ ...base, selfMade: [], undetermined: [{ name: 't', line: 2, why: 'y' }] }],
      enumerated: 10,
      strict: true,
    })
    if (und.exit !== 2) return `未判定档 exit=${und.exit}`
    return true
  })

  let failed = 0
  for (const c of cases) {
    try {
      const r = c.fn()
      if (r === true) console.log(`  ✅ ${c.name}`)
      else {
        failed++
        console.log(`  ❌ ${c.name} —— ${String(r)}`)
      }
    } catch (e) {
      failed++
      console.log(`  ❌ ${c.name} —— 用例抛错 ${e && e.message ? e.message : e}`)
    }
  }
  console.log(
    failed
      ? `\n❌ --self-test:${failed}/${cases.length} 例失败`
      : `\n✅ --self-test:${cases.length - failed}/${cases.length} 通过`,
  )
  return failed ? 1 : 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  const argv = process.argv.slice(2)
  if (argv[0] === '--self-test') process.exit(selfTest())
  process.exit(main(argv))
}

export const __test__ = {
  analyzeSource,
  decide,
  findRegistrars,
  findSelfTestHosts,
  classifyRegistrar,
  secondArgForm,
  findCaseCalls,
  exemptOnLine,
  matchDelim,
  splitTop,
  occurrences,
  lineOf,
  objectEntries,
  paramInCallArgs,
  listScopeFiles,
  readFace,
  analyze,
  resolveRootArg,
  selfTest,
  SCOPE_RE,
  HOST_NAME_RE,
  EXEMPT_MARK,
  SELF_SKIP,
  SELF_ROUTE,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
