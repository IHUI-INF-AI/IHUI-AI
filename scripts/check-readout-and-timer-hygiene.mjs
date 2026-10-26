#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * 守门:定时器句柄不得被覆盖 + 读数分母不得为零(2026-10-25 立)。
 *
 * 接线状态(如实,守门 89 会读这段):**已接 pre-commit** —— 注册条目在
 * scripts/guardian-runner.mjs(id 以 runner 现值为准,blocking,
 * skipEnv = HUSKY_SKIP_READOUT_AND_TIMER_HYGIENE,stagedTriggers = apps/web/ 与 packages/)。
 *
 * —— 立因(两处都是本枚实测修掉的,不是推演)——
 * · apps/web/app/(main)/payment/checkout/PageClient.tsx 两个组件各有一处
 *   `pollRef.current = setInterval(...)`,**起新之前没停旧**:覆盖即丢掉上一个句柄,
 *   此后 stopPoll()/卸载清理都碰不到它 ⇒ 旧轮询带着**旧订单号**继续跑,别人付成功时
 *   它会再弹一次 toast 并 `router.push('/vip')`(用户早已离开该页);两个组件的
 *   `useEffect(…, [qrCodeUrl])` 还没有清理 ⇒ 重新生成一次二维码就多一只僵尸轮询。
 * · apps/web/app/(main)/admin/i18n-dashboard/page.tsx:`sum / d.languages.length`,
 *   而 EMPTY 的 languages 是 [] ⇒ 0/0 = NaN,且这两处读数都渲染在 `isLoading` 分支**之前**
 *   ⇒ 首屏与接口失败时页面明写「平均完成度 NaN%」。同仓其它看板(crew / learn progress /
 *   relay channels / skill-stats)都写了 `length > 0 ? … : null` 的守卫 —— 本处是同仓口径异类。
 *
 * —— 两条判据 ——
 * D1 句柄被覆盖:`<expr>.current = setInterval(` 而同一函数体内在此之前没有对该 ref 的
 *    `clearInterval(…current)` ⇒ 红。为什么要求"同一函数体内":先停再起是本仓 stopPoll 的写法;
 *    只在卸载 effect 里清不算数(那时句柄已被覆盖,清的是新的那只)。
 * D2 零分母读数:`A / B.length`(含 `.size`)且**同一表达式内**没有 B 的零守卫
 *    (`B.length > 0` / `B.length ?` / `if (!B.length)` / `Math.max(1, B.length)`)⇒ 红。
 *    守卫必须与被除数是同一个变量名,否则等于没守(实测有人 guard 了 rows 却除 data.length)。
 *
 * 档位(两档同齿,理由如实):
 *  · **D1 绝对零容忍** —— 判据精确(句柄被覆盖 + 同一函数体内既无字面 clearInterval、也无
 *    "一跳可验"的具名停止函数),实测本枚把 6 处全数收口;
 *  · **D2 差值棘轮**(锚点 = 该文件在锚点面的自身命中数,只拦新增)—— 因为本判据**判不了可达性**:
 *    合法形态有两类会命中它 —— ① 除法写在 `base.forEach/base.map` 回调里(空数组根本不执行,
 *    如 knowledge-graph 的 `i / entities.length`);② 基数是字面量非空数组常量(如雷达图的 5 个轴标签)。
 *    前者已由"循环边界守卫"机器认下,后者由"同块/模块层字面量数组绑定"豁免认下(都带成对反向锁);
 *    拿不准的仍会进存量,判红就是"为消红补数字",违反 §12e 的初衷。
 *    2026-10-25 立档现读:**存量 0 处**(原判出的 4 处真除法已当场改掉 —— BarChart 空数据会让
 *    SVG 几何拿到 Infinity;两个 edu 成绩页除 items.length 那两处顺带暴露出 totalScore 为 0
 *    时百分比是 Infinity,一并守了)。棘轮在存量 0 时与零容忍等效,但保留棘轮是为了
 *    新出现的合法形态不至于逼人绕门。
 * 取材面纪律(§0.4):全量档判 HEAD blob、`--staged` 判索引 blob、`--worktree` 仅人工逃生舱;
 * 两面旗同给 ⇒ exit 2;取不到 ⇒ 未判定;枚举 0 个候选 ⇒ 判死。
 *
 * 用法:node scripts/check-readout-and-timer-hygiene.mjs [--staged|--worktree] [--self-test]
 * 退出码:0 无判红 / 1 判红 / 2 未判定
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import { maskCommentsAndStrings } from './lib/code-mask.mjs'
// 括号配平复用全仓唯一那台分词器(§22c:分词只许一台,自造一份必然漂移)
import { closeBrace } from './lib/batch-write-lexer.mjs'
// 被审面取材复用面读取层(§0.4/§5b:绝对路径 git + 显式 stdio + quotepath + 数字 timeout)
import { gitRaw, gitErrText } from './lib/face-reader.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SCOPES = ['apps/web/app', 'apps/web/src', 'packages/ui-react/src', 'packages/app/src']

/**
 * 找一个赋值/表达式点所属的**块**。
 * 关键:值位置的 `{` 是对象字面量而不是块 —— 实测把它当块的直接后果是
 * `return { progressPct: completed / planSteps.length }` 的"函数体"退化成那个对象字面量,
 * 于是同一层里 `if (planSteps.length === 0) return …` 的守卫看不见 ⇒ 假红。
 * 判据:`return`/运算符/`,`/`:`/`(` 之后紧跟的 `{` 是值(跳过继续外扩);
 *      `)`/`=>`/`else`/`try`/`do`/`{` 之后的是块。
 */
const VALUE_POSITION_BEFORE =
  /(?:\breturn|[=,:([?&|!+\-*/%<>^~]|=>|\bcase\b|\bin\b|\bof\b|\bawait\b|\byield\b)\s*$/
function enclosingBlockRange(code, idx) {
  let depth = 0
  for (let i = idx; i >= 0; i--) {
    const c = code[i]
    if (c === '}') depth++
    else if (c === '{') {
      if (depth === 0) {
        const before = code.slice(0, i)
        if (VALUE_POSITION_BEFORE.test(before)) continue // 对象字面量,继续向外找
        const end = closeBrace(code, i)
        return { start: i, end: end > 0 ? end : idx + 400 }
      }
      depth--
    }
  }
  return { start: 0, end: idx + 400 }
}

function enclosingBlock(code, idx) {
  const r = enclosingBlockRange(code, idx)
  return code.slice(r.start, r.end)
}

/**
 * 本文件里"清这个句柄"的具名停止函数(一跳可验):
 * `const stopX = (…) => { … clearInterval(ref.current) … }`。
 * 只认**函数体里确实清了同一个句柄**的具名函数 —— 不接受"看着像 stop 的调用",
 * 否则等于把豁免交给命名约定(§0.7:豁免必须验过才免)。
 */
function findStoppersFor(code, holder) {
  const names = new Set()
  const esc = holder.replace(/\./g, '\\.')
  const body = new RegExp(String.raw`\bclearInterval\s*\(\s*${esc}\.current\s*\)`)
  // 三种本仓真实写法都要认(少认一种就是逼人绕门):
  //  · `const stop = () => { … }`
  //  · `const stop = React.useCallback(() => { … }, [])`  ← 包一层回调工厂
  //  · `function stop() { … }`
  // 参数表必须紧跟 `=> {`(不能跨语句去够下一个 `{`
  // —— 实测松写法的后果:把 `const pollRef = useRef(null)` 当成函数头,函数体一路吃到
  //    后面 stopPoll 的花括号,于是真正的 stopPoll 反而被前一个匹配吃掉、认不出来)。
  // 认三种本仓真实写法(少认一种就是假红,会逼人绕门):
  //  · `const stop = () => { … }`
  //  · `const stop = React.useCallback(() => { … }, [])`  ← 箭头被工厂调用包了一层
  //  · `function stop() { … }`
  // 做法:直接从**带块的箭头**出发(不从等号出发,否则工厂式找不到),
  // 体内确实清了该句柄者,再回溯它所在声明语句的 `const NAME =` 取名字。
  // 误绑的名字(内联回调没有名字)永远不会被当作调用点匹配 ⇒ 不会反向放宽判据。
  const headRe = /\)\s*=>\s*\{|=>\s*\{/g
  for (const m of code.matchAll(headRe)) {
    const open = m.index + m[0].length - 1
    const end = closeBrace(code, open)
    if (end < 0) continue
    if (!body.test(code.slice(open, end))) continue
    let last = null
    const declRe = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g
    for (let g; (g = declRe.exec(code.slice(0, open))); ) last = g[1]
    if (last) names.add(last)
  }
  for (const m of code.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\([^()]*\)\s*\{/g)) {
    const open = m.index + m[0].length - 1
    const end = closeBrace(code, open)
    if (end < 0) continue
    if (body.test(code.slice(open, end))) names.add(m[1])
  }
  return names
}

/** D1:句柄被覆盖而没有先停旧的赋值。 */
export function findOverwrittenIntervalHandles(code) {
  const out = []
  const re = /([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\.current\s*=\s*setInterval\s*\(/g
  for (const m of code.matchAll(re)) {
    const holder = m[1]
    const body = enclosingBlock(code, m.index)
    const cut = body.indexOf(m[0])
    const before = body.slice(0, cut >= 0 ? cut : body.length)
    const esc = holder.replace(/\./g, '\\.')
    const stoppedInline = new RegExp(String.raw`clearInterval\s*\(\s*${esc}\.current`).test(before)
    let stoppedViaHelper = false
    if (!stoppedInline) {
      for (const name of findStoppersFor(code, holder)) {
        if (new RegExp(String.raw`\b${name}\s*\(\s*\)`).test(before)) {
          stoppedViaHelper = true
          break
        }
      }
    }
    if (!stoppedInline && !stoppedViaHelper) out.push({ at: m.index, holder })
  }
  return out
}

/**
 * 精确豁免:除数基数是"字面量非空数组"的常量声明 ⇒ 它的 length 恒 ≥ 1,不可能为零。
 * 只认两种位置的声明:①除法所在块内、且在除法之前;②模块顶层(花括号深度 0)。
 * 取的是**离除法最近的那条同名 `const/let/var` 绑定**,所以内层用别的东西(接口返回、
 * 空数组)重新绑过同名变量时,外层那份字面量数组不能替它担保 —— 否则豁免就成了按名字
 * 发通行证(§0.7:豁免必须验过才免)。
 */
const BINDING_RE = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*[^=]*=\s*/g
const NON_EMPTY_LITERAL_START_RE = /^\[\s*[^\]]/

function collectBindings(code) {
  const out = []
  for (const m of code.matchAll(BINDING_RE))
    out.push({ name: m[1], at: m.index, literal: NON_EMPTY_LITERAL_START_RE.test(code.slice(m.index + m[0].length)) })
  return out
}

/** 逐字符花括号深度(前缀量):深度 0 处的声明才是模块顶层。 */
function braceDepths(code) {
  const d = new Int32Array(code.length + 1)
  let cur = 0
  for (let i = 0; i < code.length; i++) {
    const c = code[i]
    if (c === '{') cur++
    else if (c === '}') cur--
    d[i + 1] = cur
  }
  return d
}

/**
 * 循环边界守卫:除法式直接住在 `for (… i < base.length …)` / `while (base.length)` 的体内
 * ⇒ 基数为零时循环体一次都不执行,这条除法根本跑不到。只看紧贴该块的循环头。
 */
function loopHeaderBounds(code, blockStart, esc) {
  const head = code.slice(Math.max(0, blockStart - 300), blockStart)
  return (
    new RegExp(String.raw`\b(?:for|while)\s*\([^)]*(?:<|!==)\s*${esc}\.length`).test(head) ||
    new RegExp(String.raw`\bwhile\s*\(\s*${esc}\.length`).test(head)
  )
}

/** D2:除数是一个没有零守卫的 `.length`/`.size`。 */
export function findUnguardedLengthDivisors(code) {
  const out = []
  const bindings = collectBindings(code)
  const depth = bindings.length ? braceDepths(code) : null
  const re = /\/\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\.length\b/g
  for (const m of code.matchAll(re)) {
    const base = m[1]
    const range = enclosingBlockRange(code, m.index)
    const nearest = bindings.filter((b) => b.name === base && b.at < m.index).at(-1)
    if (nearest && nearest.literal && (nearest.at >= range.start || depth[nearest.at] === 0)) continue
    const body = code.slice(range.start, range.end)
    const esc = base.replace(/\./g, '\\.')
    if (loopHeaderBounds(code, range.start, esc)) continue
    // 同一函数体内出现以下任一形态即认为有守卫(必须点名同一个变量):
    const guards = [
      new RegExp(String.raw`${esc}\.length\s*>\s*0`),
      new RegExp(String.raw`${esc}\.length\s*[?!]`),
      new RegExp(String.raw`!\s*${esc}\.length`),
      new RegExp(String.raw`Math\.max\(\s*1\s*,\s*${esc}\.length`),
      new RegExp(String.raw`${esc}\.length\s*\|\|`),
      new RegExp(String.raw`${esc}\.length\s*===?\s*0`),
      new RegExp(String.raw`${esc}\.length\s*<\s*\d`),
    ]
    if (guards.some((g) => g.test(body))) continue
    out.push({ at: m.index, base })
  }
  return out
}

/**
 * 薄壳:本门既有的 `{status, stdout, stderr}` 形状接到面读取层上(§0.4 取材面纪律 +
 * §5b 绝对路径 git + §12g 显式 stdio)。层抛 Undetermined ⇒ 折回非零 status 交调用方落未判定,
 * 绝不在此回落另一个面。
 */
function git(args) {
  try {
    const stdout = gitRaw(args, ROOT)
    return { status: 0, stdout, stderr: '' }
  } catch (e) {
    return { status: typeof e.status === 'number' ? e.status : 1, stdout: '', stderr: gitErrText(e) }
  }
}

function faceFiles(face) {
  const args =
    face === 'head'
      ? ['ls-tree', '-r', '--name-only', 'HEAD', '--', ...SCOPES]
      : face === 'staged'
        ? ['ls-files', '-s', '--', ...SCOPES]
        : ['ls-files', '--', ...SCOPES]
  const r = git(args)
  // 层内 gitErrText 已自带 `git <子命令> 失败:` 前缀,这里不再叠第二层(只折文本,不改判定)
  if (r.status !== 0) return { err: r.stderr.trim() }
  return {
    files: r.stdout
      .split('\n')
      .filter(Boolean)
      .map((l) => (face === 'staged' ? l.split('\t').slice(1).join('\t') : l))
      .filter((f) => /\.(ts|tsx)$/.test(f)),
  }
}

function readRev(rev, file) {
  if (rev === null) {
    const p = path.join(ROOT, file)
    return existsSync(p) ? readFileSync(p, 'utf8') : null
  }
  const r = git(['show', `${rev}:${file}`])
  return r.status === 0 ? r.stdout : null
}
const FACE_REV = { head: 'HEAD', staged: ':', worktree: null }

function lineOf(src, idx) {
  return src.slice(0, idx).split('\n').length
}

export function selfTest() {
  const cases = []
  const ok = (name, cond) => cases.push({ name, pass: Boolean(cond) })
  const bad = `  const startPolling = () => {
    setPolling(true)
    pollRef.current = setInterval(async () => {}, 2000)
  }`
  const good = `  const startPolling = () => {
    stopPoll()
    setPolling(true)
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {}, 2000)
  }`
  ok('D1 抓到"覆盖句柄而未先停旧"', findOverwrittenIntervalHandles(bad).length === 1)
  ok('D1 放过"先 clearInterval 再起新"', findOverwrittenIntervalHandles(good).length === 0)
  // 一跳可验的具名停止函数:被调体里确实清了同一个句柄才算;清了别的句柄不算
  const viaHelper = `  const stopPoll = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }
  const startPolling = () => { stopPoll(); pollRef.current = setInterval(() => {}, 2000) }`
  const wrongHelper = `  const stopOther = () => { clearInterval(otherRef.current) }
  const startPolling = () => { stopOther(); pollRef.current = setInterval(() => {}, 2000) }`
  ok('D1 认可一跳可验的具名停止函数', findOverwrittenIntervalHandles(viaHelper).length === 0)
  ok('D1 不认"清了别的句柄"的停止函数', findOverwrittenIntervalHandles(wrongHelper).length === 1)
  // 本仓真实写法:停止函数被 React.useCallback 包一层也必须被认出来(少认一种=假红=逼人绕门)
  const viaCallback = `  const clearTimers = React.useCallback(() => { if (tRef.current) clearInterval(tRef.current) }, [])
  const start = () => { clearTimers(); tRef.current = setInterval(() => {}, 1000) }`
  ok('D1 认 React.useCallback 包的停止函数', findOverwrittenIntervalHandles(viaCallback).length === 0)
  const viaFnDecl = `  function stopAll() { clearInterval(tRef.current) }
  const start = () => { stopAll(); tRef.current = setInterval(() => {}, 1000) }`
  ok('D1 认 function 声明式停止函数', findOverwrittenIntervalHandles(viaFnDecl).length === 0)
  const divBad = `  const avg = Math.round(rows.reduce((s, r) => s + r.v, 0) / rows.length)`
  const divGood = `  const avg = rows.length ? Math.round(rows.reduce((s, r) => s + r.v, 0) / rows.length) : null`
  const divGuardedOtherVar = `  const avg = data.length > 0 ? sum / data.length : null`
  ok('D2 抓到无守卫的 .length 分母', findUnguardedLengthDivisors(divBad).length === 1)
  ok('D2 放过三元守卫', findUnguardedLengthDivisors(divGood).length === 0)
  ok('D2 放过 >0 守卫', findUnguardedLengthDivisors(divGuardedOtherVar).length === 0)
  // 反向锁:守卫必须点名同一个变量,否则等于没守
  const divMismatch = `  const avg = rows.length > 0 ? sum / columns.length : null`
  ok('D2 不被"守了另一个变量"骗过', findUnguardedLengthDivisors(divMismatch).length === 1)
  // 块 vs 对象字面量的成对锁(实测踩过):`return { … }` 里的除法式,守卫在外一层;
  // 若把对象字面量当块,同一层那个 `length === 0` 早退守卫就看不见 ⇒ 假红。
  const objLiteral = [
    '  const memo = React.useMemo(() => {',
    '    if (steps.length === 0) return { pct: 0 }',
    '    const done = steps.filter((s) => s.ok).length',
    '    return { pct: (done / steps.length) * 100 }',
    '  }, [steps])',
  ].join('\n')
  ok('D2 认得出对象字面量外一层的早退守卫', findUnguardedLengthDivisors(objLiteral).length === 0)
  const objLiteralUnguarded = objLiteral.replace('if (steps.length === 0) return { pct: 0 }', 'const zero = 0')
  ok('D2 去掉那层守卫后确实翻红(锁住的是可达性,不是巧合)', findUnguardedLengthDivisors(objLiteralUnguarded).length === 1)
  // 常量数组豁免的三条成对锁:带类型标注的顶格非空字面量恒 ≥1(实测两处假阳即此型);
  // 空字面量、函数内的局部同名数组都不得享受豁免,否则豁免会变成白名单。
  const typedConstArray = [
    'const RADAR_LABELS: Array<{ key: string; label: string }> = [{ key: "a", label: "A" }]',
    'function Radar() {',
    '  const angleStep = (Math.PI * 2) / RADAR_LABELS.length',
    '  return angleStep',
    '}',
  ].join('\n')
  ok('D2 放过顶格带类型标注的非空常量数组', findUnguardedLengthDivisors(typedConstArray).length === 0)
  const emptyConstArray = typedConstArray.replace('= [{ key: "a", label: "A" }]', '= []')
  ok('D2 不放过空字面量常量数组(摘掉元素即翻红)', findUnguardedLengthDivisors(emptyConstArray).length === 1)
  const localArray = [
    'function Chart() {',
    '  const data = [1, 2]',
    '  const barW = chartW / data.length',
    '  return barW',
    '}',
  ].join('\n')
  ok('D2 放过同块内的字面量非空数组', findUnguardedLengthDivisors(localArray).length === 0)
  // 反向锁:同名重新绑过 ⇒ 外层那份字面量数组不许替它担保(取离除法最近的绑定)
  const shadowedLocal = [
    'const SERIES: number[] = [1, 2]',
    'function Chart({ points }: { points: number[] }) {',
    '  const SERIES = points',
    '  return chartW / SERIES.length',
    '}',
  ].join('\n')
  ok('D2 内层同名重绑会作废外层豁免', findUnguardedLengthDivisors(shadowedLocal).length === 1)
  // 循环边界:基数为零时循环体一次都不跑,除法不可达
  const loopBound = [
    '  for (let i = 0; i < nodes.length; i++) {',
    '    const angle = (i / nodes.length) * Math.PI * 2',
    '  }',
  ].join('\n')
  ok('D2 认得出循环边界守卫', findUnguardedLengthDivisors(loopBound).length === 0)
  const loopUnbound = loopBound.replace('i < nodes.length', 'i < 10')
  ok('D2 循环头不再量同一个 length 即翻红', findUnguardedLengthDivisors(loopUnbound).length === 1)
  // 参数里的同名数组没有 const 绑定 ⇒ 不许被任何豁免带走
  const paramArray = [
    'export const Bar = ({ data }: { data: number[] }) => {',
    '  const barW = chartW / data.length',
    '  return barW',
    '}',
  ].join('\n')
  ok('D2 抓得到 props/参数带来的空数组除法', findUnguardedLengthDivisors(paramArray).length === 1)
  // 遮罩反向锁:与生产同口径(main 里判据吃的就是遮罩后的文本),注释里写 clearInterval 不算先停旧
  const commentOnly = `  const start = () => {
    // clearInterval(pollRef.current) 曾在这里
    pollRef.current = setInterval(() => {}, 1000)
  }`
  ok(
    'D1 注释里的 clearInterval 不算数(按生产同口径先遮罩)',
    findOverwrittenIntervalHandles(maskCommentsAndStrings(commentOnly)).length === 1,
  )
  let rc = 0
  for (const c of cases) {
    console.log(`${c.pass ? '✅' : '❌'} ${c.name}`)
    if (!c.pass) rc = 1
  }
  console.log(`self-test ${cases.filter((c) => c.pass).length}/${cases.length}`)
  return rc
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest()
  const faceFlags = ['--staged', '--worktree'].filter((f) => argv.includes(f))
  if (faceFlags.length > 1) {
    console.error('❌ 两面旗同给(§0.4)⇒ 未判定')
    return 2
  }
  const face = faceFlags[0] === '--staged' ? 'staged' : faceFlags[0] === '--worktree' ? 'worktree' : 'head'
  const listed = faceFiles(face)
  if (listed.err) {
    console.error(`❌ 被审面(${face})清单取不到:${listed.err} ⇒ 未判定`)
    return 2
  }
  if (listed.files.length === 0) {
    console.error(`❌ 被审面(${face})在 ${SCOPES.join(',')} 枚举到 0 个候选 ⇒ 判死,不记绿`)
    return 2
  }
  const findings = []
  const stock = []
  let unreadable = 0
  const aRev = argv.includes('--staged') || argv.includes('--worktree') ? 'HEAD' : 'HEAD^'
  for (const file of listed.files) {
    const src = readRev(FACE_REV[face], file)
    if (src === null) {
      unreadable++
      continue
    }
    const code = maskCommentsAndStrings(src)
    for (const h of findOverwrittenIntervalHandles(code))
      findings.push({ dim: 'D1', file, line: lineOf(src, h.at), what: `${h.holder}.current 被覆盖,同一函数体内未见先停旧` })
    // 测试面不判 D2:断言里出现 sum / edges.length 是在算期望值,不是给用户看的读数
    if (/__tests__/.test(file) || /\.test\.tsx?$/.test(file)) continue
    const curD2 = findUnguardedLengthDivisors(code)
    if (!curD2.length) continue
    const describe = (h) => ({
      dim: 'D2',
      file,
      line: lineOf(src, h.at),
      what: `除以 ${h.base}.length 无零守卫(NaN/Infinity 可能直接上屏)`,
    })
    const aSrc = readRev(aRev, file)
    if (aSrc === null) {
      // 锚点面无此文件 = 本枚新建 ⇒ 存量按 0 计,当前命中全算新增
      for (const h of curD2) findings.push(describe(h))
      continue
    }
    // D2 差值棘轮:锚点 = 该文件在锚点面自身的命中数(§0.5/§12e 只拦新增)
    const anchorCount = findUnguardedLengthDivisors(maskCommentsAndStrings(aSrc)).length
    if (curD2.length > anchorCount) for (const h of curD2) findings.push(describe(h))
    else for (const h of curD2) stock.push({ ...describe(h), anchor: anchorCount })
  }
  const label = { head: 'HEAD blob', staged: '索引 blob', worktree: '工作树(人工逃生舱)' }[face]
  console.log(`[readout-timer] 面=${label} 候选 ${listed.files.length} / 取材失败 ${unreadable}`)
  for (const f of findings) console.log(`  ❌ ${f.dim} ${f.file}:${f.line}  ${f.what}`)
  if (stock.length) {
    console.log(`  ⚠ D2 存量(可达性未逐条判定 ⇒ 只报数,§12e 不逼跳门)${stock.length} 处:`)
    for (const s of stock) console.log(`     ${s.dim} ${s.file}:${s.line}  ${s.what}`)
  }
  if (argv.includes('--json')) console.log(JSON.stringify({ face, findings, stock, unreadable }))
  if (unreadable > 0) {
    console.error(`❌ ${unreadable} 个文件在被审面取不到 ⇒ 未判定,不出具合格证`)
    return 2
  }
  if (findings.length) {
    console.error(
      `❌ 判红 ${findings.length} 处。出口:D1 起新之前先 clearInterval 同一句柄(或把它交给统一的 stop/start);` +
        `D2 分母为零时如实给 null/'—',不要用 0 冒充读数,也别只加 Math.max(1,…) 把 NaN 换成假数。`,
    )
    return 1
  }
  console.log(`✅ 无判红(D1 句柄覆盖 0 处;D2 无新增,存量 ${stock.length} 处待按可达性逐条清偿)`)
  return 0
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  process.exit(main())
}

export const __test__ = { findOverwrittenIntervalHandles, findUnguardedLengthDivisors, SCOPES }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
