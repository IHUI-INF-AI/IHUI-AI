// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 旁路落地器共用的「落地后复跑受影响判据」出口(G-113,2026-10-23 立)。
 *
 * 为什么必须由落地器自带(票面成因,台账 L7289):union-converge / object-space-land 走
 * commit-tree + CAS ⇒ **结构上不跑任何钩子**。一次"干净合并"(行级归并无冲突)可以把
 * 两份同名函数族一起送进 HEAD —— 2026-09-29 实测枚 f57e0c9983:两侧从同一个 380 行基底
 * 各自重写 D159 那一族函数(本侧 646 行 / 对侧 716 行),归并不报冲突,合并后同一文件里
 * 躺着两份同名函数,mypy 10 条红是**部署环**先看见的。判据挂在钩子上,对这条通道等于没装;
 * 与守门 71 台账自愈补跑(头注③)同一条纪律:**判据必须在真跑它的那一刻才成立**。
 *
 * 形态(与 rerunLedgerHeal 同族,但退出码语义不同):
 *  - 选择面:按本次落地面路径选受影响门 ——
 *    ① 内置最低三件(票面点名):python 面 mypy、ts 面 tsc、同名函数族重复定义扫描;
 *    ② 注册表映射:现读 scripts/guardian-runner.mjs 的门注册条目,凡声明了 stagedTriggers
 *      且被落地面触及的门,都算"受影响门",复跑其**全量档**(判 HEAD 面 = 落地面;
 *      取材面纪律与守门 70/77/83/98/103/118 同口径)。无 stagedTriggers 的门**不参与**路径映射
 *      (判据设计上不随落地面变化)。〔2026-10-27 补正〕旧文在这句后面接的是「(它们对任何提交
 *      都跑,不是"本次落地面受影响")」—— 那是**钩子通道**的语义,在本通道里不成立:本器不走
 *      钩子,缺省即"不复跑"。故改为只承认"不参与路径映射",不再暗示"它们照样跑过";
 *      这一截由 countUntriggered 量出来逐次点名,绿行末尾缀道数(实证见该函数头注)。
 *  - 失败语义:**大声报数 + exit 非 0**。不回滚(落地是既成事实,替身无权撤销),但拒绝静默:
 *    blocking 门判红 ⇒ verdict=1;门"无法判定"(rc=2)⇒ verdict=2(未判定不等于通过);
 *    warn 门判红只点名、不改 verdict(与 runner 的分级语义逐字同形,§12e 不造恒红门)。
 *  - 应急出口:IHUI_LAND_SKIP_AFFECTED_GATES=1 ⇒ 整档跳过,打一行留痕(与
 *    IHUI_LAND_SKIP_DANGLING_GATE 同族惯例;跳过必须出声)。
 *
 * 测试通道(镜像测试用,生产恒走缺省):
 *  LAND_GATE_RERUN_MYPY / LAND_GATE_RERUN_TSC  指向桩脚本(仿退出码传输,不仿判据本身,
 *                                              与 LAND_DANGLING_GATE 的 G-929 契约同形)
 *  LAND_GATE_RERUN_REGISTRY                    指向替代注册表文本文件(选择面取材)
 *  LAND_GATE_RERUN_ROOT                        被审仓根(缺省 = 本 lib 所在仓根)
 */

import { existsSync, readFileSync } from 'node:fs'
import { cpus } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile, execFileSync } from 'node:child_process'
import { triggersTouch } from './guardian-triggers.mjs'
import { catBatch } from './face-reader.mjs'
import { maskComments, maskCommentsStringsAndRegex } from './code-mask.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')
const WORKER = join(HERE, 'land-gate-rerun-worker.mjs')
/** 注册表臂单臂超时(与串行时代一致;并发不放大单臂预算)。 */
const GATE_TIMEOUT_MS = 300000
/** worker 总超时:按最坏串行排队留足余量,只防"worker 挂死"把落地器拖到天荒地老。 */
const WORKER_TIMEOUT_MS = 30 * 60 * 1000

/** 同名函数族扫描的扩展面(票面:"简单判据"—— 只扫顶层(def/class/function/export const),不建 AST)。 */
const DUPDEF_EXTS = ['.py', '.pyi', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']
const PY_EXTS = ['.py', '.pyi']
const TS_EXTS = ['.ts', '.tsx']

// ===========================================================================
// 纯判据(§22c:导出给镜像测试,测试里不得再抄一份)
// ===========================================================================

/**
 * 从 guardian-runner 全文提取 `const checks = [ ... ]` 的条目(字符串/注释感知的花括号扫描)。
 * 只认**顶层数组元素为对象字面量**的条目;取 id/script/mode/skipEnv/args/stagedTriggers,
 * 单双引号两种形态都认(gate-registry-insert 头注②的教训:按单引号解析的判据对双引号形态隐身)。
 * 解析不出来的条目(非对象元素)跳过不猜。
 */
export function parseGateRegistry(text) {
  const src = String(text ?? '')
  const start = src.indexOf('const checks = [')
  if (start < 0) return { entries: [], error: 'registry-array-missing' }
  let i = src.indexOf('[', start)
  const entries = []
  let depth = 0
  let objStart = -1
  let inStr = null // 当前字符串引号
  let esc = false
  let inLineComment = false
  let inBlockComment = false
  for (; i < src.length; i++) {
    const ch = src[i]
    const next = src[i + 1]
    if (inLineComment) {
      if (ch === '\n') inLineComment = false
      continue
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false
        i++
      }
      continue
    }
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === inStr) inStr = null
      continue
    }
    if (ch === '/' && next === '/') {
      inLineComment = true
      i++
      continue
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true
      i++
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      inStr = ch
      continue
    }
    if (ch === '[' || ch === '{' || ch === '(') {
      depth++
      if (ch === '{' && depth === 2) objStart = i
      continue
    }
    if (ch === ']' || ch === '}' || ch === ')') {
      if (ch === '}' && depth === 2 && objStart >= 0) {
        entries.push(extractEntryFields(src.slice(objStart, i + 1)))
        objStart = -1
      }
      depth--
      if (depth === 0 && ch === ']') break
      continue
    }
  }
  return { entries, error: null }
}

/** 从单个条目文本抽字段(两种引号形态;抽不到就缺省,不猜)。
 *  取材面必须先遮注释(2026-10-24 实测):注册表注释里就有一句
 *  `… | grep -oE "id: '[0-9]+" | sort -u -V | tail -1` —— 不遮时 `\bid:` 会先命中这句散文,
 *  把 id='94' 的条目读成 id='[0-9]+" | sort -u …'(跨行,吞掉下一行 `id: `);同一型若发生在
 *  `script:`/`stagedTriggers:` 上,后果是选错门或"门体取不到 ⇒ 未判定"叫停落地器。
 *  `maskComments` 只遮注释、保留字符串字面量(字段值本身就是字符串),正好是这一格要的层。 */
export function extractEntryFields(entryText) {
  const text = maskComments(String(entryText ?? ''))
  const q = (field) => {
    const m = new RegExp(`\\b${field}:\\s*(['"])((?:\\\\.|(?!\\1)[^\\\\])*)\\1`, 's').exec(text)
    return m ? m[2] : null
  }
  const arr = (field) => {
    const m = new RegExp(`\\b${field}:\\s*\\[([\\s\\S]*?)\\]`).exec(text)
    if (!m) return []
    const out = []
    const re = /(['"])((?:\\.|(?!\1)[^\\])*)\1/g
    let x
    while ((x = re.exec(m[1])) !== null) out.push(x[2])
    return out
  }
  return {
    id: q('id'),
    script: q('script'),
    mode: q('mode'),
    skipEnv: q('skipEnv'),
    label: q('label'),
    args: arr('args'),
    stagedTriggers: arr('stagedTriggers'),
  }
}

/**
 * 路径→门映射:落地面触及某门声明的 stagedTriggers ⇒ 该门"受影响"。
 * 无 stagedTriggers 的恒跑门不入列(见头注);info 门不入列(它永不失败,复跑只是噪声)。
 * normalizeTriggers 对空清单**当场抛错**(立因见 guardian-triggers 头注),这里让错误上抛 ——
 * 注册表里坏一条 stagedTriggers,旁路落地通道也必须看见,不得静默少跑一道门。
 */
export function selectAffectedGates(paths, entries) {
  const list = (paths ?? []).map((p) => String(p).replace(/\\/g, '/'))
  return entries.filter((e) => {
    if (!e || !e.script) return false
    if (e.mode === 'info') return false
    if (!e.stagedTriggers || e.stagedTriggers.length === 0) return false
    return triggersTouch(list, e.stagedTriggers)
  })
}

/**
 * 与 selectAffectedGates **互补**的那一半:本通道结构上永不复跑的登记门(2026-10-27 立)。
 *
 * 立因(实证,不是假想):同一份声明在两条通道上被读成**反义** ——
 *   · 提交通道(guardian-runner):`stagedTriggers` 缺省 = **任何提交都跑**(AGENTS §15d 明写
 *     「无 stagedTriggers=任何提交都跑」,并以此为 213 号门的合规凭据);
 *   · 落地通道(本文件 selectAffectedGates):同一份缺省 = `return false` ⇒ **永不复跑**。
 * 后果是"落地后 N 臂全绿"这句话可以**盲绿**:2026-10-27 实测,门 193
 * (check-git-stdio-discipline)因注册条目没有 stagedTriggers 而被本节排除,于是一笔落地报
 * 「19 臂全绿」,而那一笔恰好往 scripts/check-ps1-bom.mjs 里写了两处裸派生 git —— 唯一能咬住
 * 它的那一臂**压根没跑**,直到 `git push` 的 pre-push 才被拦下(AGENTS §12e 的反面:绿行是真的,
 * 但它覆盖的面比读它的人以为的小)。
 *
 * 本函数不改判定(不改红绿、不改选门),只把"没覆盖到的那一截"量出来交给报告面 ——
 * 让绿行自己说清它覆盖了多少、漏了多少。射程缺省的登记门由门 `check-gate-triggers.mjs`
 * 记在入口(新门无射程 ⇒ 红;要"任何提交都跑"必须显式写出全匹配射程,写法见函数体内的行注),
 * 两道合起来才闭环:这一半让**当下**的落地不盲绿,那一半让**以后**不再长出新的缺省。
 */
export function countUntriggered(entries) {
  // 要"任何提交都跑"就该把它写下来,而不是留空让两条通道各自猜:
  //   stagedTriggers: ['**', '/*'].join('')   ← 等价的全匹配通配(此处用 join 只是为了让本行
  //   不出现注释终止符;注册表里直接写通配字面量即可,guardian-triggers 认它,实测根文件与
  //   深层文件都命中)
  const judges = (entries ?? []).filter((e) => e && e.script && e.mode !== 'info')
  const missing = judges.filter((e) => !e.stagedTriggers || e.stagedTriggers.length === 0)
  return {
    judges: judges.length,
    missing: missing.length,
    blocking: missing.filter((e) => e.mode === 'blocking').length,
    ids: missing.map((e) => String(e.id)),
  }
}

/**
 * 同名函数族重复定义扫描(简单判据,票面允许):同一文件**顶层**同名 def/class/function/
 * export const **带 body 的声明**出现 ≥2 次 ⇒ 命中。这正是 f57e0c9983 那一型:行级归并把
 * 两侧各自重写的同名函数族一起留下,归并不报冲突、tsc/mypy 未必当轮跑,而重复定义扫描一条就咬住。
 * 只认第 0 列起的声明行(嵌套定义不算重复);注释行(// # /* * 起头)跳过 —— 判据刻意做窄
 * (误报一次就没人信简单判据),漏报的那部分由 mypy/tsc 两臂兜底。
 *
 * 为什么只数"带 body"的(2026-10-25 实测):TS 的**函数重载**是"多个无 body 签名 + 单个实现",
 * `apps/web/src/lib/tauri-bridge.ts` 的 withTimeout 就是 2 签名 + 1 实现(L1359/L1360/L1365)。
 * 早期版本只数同名声明行数 ⇒ 把合法重载判成"重复族",落地复跑假红。签名以 `;` 收尾(或无 body
 * 直接接下一声明),实现在括号平衡后以 `{` 起 body —— 据此分档,仍不建 AST。
 */
export function scanDuplicateDefinitions(text, ext) {
  const src = String(text ?? '')
  // 先把注释/字符串/模板串/正则体遮成等长空白:**字符串里出现的 `export function X` 不是定义**。
  // 2026-10-25 实测:check-z-index-guard.test.mjs 的 CN_DIALOG_TSX 夹具(模板串)被本臂判成
  // "同名第二份" ⇒ 落地复跑假红(判据做窄是对的,但"看不见引号"不是窄,是瞎)。
  // 等长遮罩 ⇒ 行号/缩进不变,"只认第 0 列"的规则逐字照旧。
  const lines = maskCommentsStringsAndRegex(src).split(/\r?\n/)
  const patterns = PY_EXTS.includes(ext)
    ? [
        /^def\s+([A-Za-z_]\w*)\s*\(/,
        /^async\s+def\s+([A-Za-z_]\w*)\s*\(/,
        /^class\s+([A-Za-z_]\w*)/,
      ]
    : [
        /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*[(<]/,
        /^(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/,
        /^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/,
      ]
  const seen = new Map()
  const isPy = PY_EXTS.includes(ext)
  lines.forEach((l, idx) => {
    const t = l.trimStart()
    if (
      t === '' ||
      t.startsWith('//') ||
      t.startsWith('#') ||
      t.startsWith('*') ||
      t.startsWith('/*')
    )
      return
    if (l !== t) return // 只认第 0 列(有缩进即非顶层)
    for (const re of patterns) {
      const m = re.exec(l)
      if (m) {
        // function 声明要分"签名 / 实现":其余形态(class / const 赋值)一律当带 body。
        const isFunctionDecl = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s/.test(l)
        const hasBody = isPy || !isFunctionDecl ? true : functionDeclHasBody(lines, idx)
        if (!seen.has(m[1])) seen.set(m[1], [])
        seen.get(m[1]).push({ line: idx + 1, hasBody })
        break
      }
    }
  })
  const dups = []
  for (const [name, entries] of seen) {
    const bodyLines = entries.filter((e) => e.hasBody).map((e) => e.line)
    if (bodyLines.length >= 2) dups.push({ name, lines: bodyLines })
  }
  dups.sort((a, b) => a.lines[0] - b.lines[0])
  return dups
}

/**
 * 从顶层 `function` 声明行起,判断该声明是"重载签名"(无 body)还是"实现"(带 body)。
 * 只数圆括号深度(尖括号在泛型与 `=>` 里都会捣乱,不参与),括号平衡后看声明段落收尾:
 *   · 以 `{` 收尾 ⇒ 实现
 *   · 含 `{` 且以 `}` 收尾(单行写法的实现)⇒ 实现
 *   · 其余(以 `;` / 返回类型 / 换行接下一声明收尾)⇒ 签名
 * 返回对象类型的签名(`): { ok: true };`)会被判成"实现" —— 该形态在本仓现读 0 处,且多算一枚
 * body 才会造成误红,故不为此加复杂度。
 */
function functionDeclHasBody(lines, idx) {
  let depth = 0
  let seg = ''
  for (let i = idx; i < lines.length && i < idx + 60; i += 1) {
    const s = lines[i]
    seg += `\n${s}`
    for (const c of s) {
      if (c === '(') depth += 1
      else if (c === ')' && depth > 0) depth -= 1
    }
    if (depth === 0 && i > idx) break
    if (depth === 0 && i === idx && !s.trimEnd().endsWith(',')) break
  }
  const tail = seg.trim()
  return tail.endsWith('{') || (tail.includes('{') && tail.endsWith('}'))
}

// ===========================================================================
// 编排(落地器在 CAS 成功、提交面回读通过、主索引对齐之后调用)
// ===========================================================================

function spawnGate(script, args, root, timeoutMs, env) {
  try {
    const out = execFileSync(process.execPath, [script, ...args], {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
      timeout: timeoutMs,
      maxBuffer: 64 << 20,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: env ? { ...process.env, ...env } : process.env,
    })
    return { rc: 0, out: String(out ?? '') }
  } catch (e) {
    const rc = typeof e.status === 'number' ? e.status : 9
    const out = String((e.stdout ?? '') + (e.stderr ?? ''))
    if (rc === 9 && (e.code === 'ETIMEDOUT' || e.signal)) return { rc: 'killed', out }
    return { rc, out }
  }
}

/**
 * 并发度(2026-10-28 立):默认 min(8, 核数-2),下限 2。
 * 依据是实测而非拍的:26 臂串行耗时分钟级,而单臂 0.3s(check-api-key-leak)~34s
 * (check-rounded-full)差两个数量级 ⇒ 串行的墙钟时间几乎全花在等最慢那几臂。
 * `IHUI_LAND_GATE_CONCURRENCY` 可覆盖(测试与低配机应急);给 1 = 退回逐臂串行,语义与改前同形。
 */
export function gateConcurrency(env = process.env) {
  const raw = Number(env?.IHUI_LAND_GATE_CONCURRENCY)
  if (Number.isFinite(raw) && raw >= 1) return Math.min(32, Math.floor(raw))
  const n = (cpus?.() ?? []).length || 4
  return Math.max(2, Math.min(8, n - 2))
}

/**
 * 异步版 spawnGate:逐条对齐同步版语义(超时 / 被杀 / stdout+stderr 合并 / env 叠加),
 * 只服务本文件配套的并发 worker,不进生产判据路径。
 */
export function spawnGateAsync(script, args, root, timeoutMs, env) {
  return new Promise((settle) => {
    execFile(
      process.execPath,
      [script, ...args],
      {
        cwd: root,
        encoding: 'utf8',
        windowsHide: true,
        timeout: timeoutMs,
        maxBuffer: 64 << 20,
        env: env ? { ...process.env, ...env } : process.env,
      },
      (err, stdout, stderr) => {
        const out = String((stdout ?? '') + (stderr ?? ''))
        if (!err) return settle({ rc: 0, out })
        const rc = typeof err.code === 'number' ? err.code : 9
        // 与 spawnGate 同一档:超时/被杀落 'killed' ⇒ 调用方归 undetermined,不读成判红
        if (rc === 9 && (err.killed || err.signal)) return settle({ rc: 'killed', out })
        settle({ rc, out })
      },
    )
  })
}

/**
 * 同步批量执行入口:单任务或并发度 1 ⇒ 就地串行(不付 worker 启动开销);
 * 多任务 ⇒ 交给 worker 并发跑,**结果按输入下标回填**,调用方据此按原顺序归类。
 *
 * 失败方向:worker 起不来 / 返回条目数不符 / 输出解析不了 ⇒ 每一臂都落 `rc=9 + 原因`,
 * 由调用方归入 undetermined(§0.3:取不到判定面既不记绿也不冒红)。**不回落串行重跑** ——
 * 那会把一次 worker 故障变成"再花一遍分钟级",并掩盖故障本身。
 */
export function runGateBatch(tasks, { root = REPO_ROOT, concurrency, env = process.env } = {}) {
  const list = Array.isArray(tasks) ? tasks : []
  if (list.length === 0) return []
  const limit =
    Number.isFinite(concurrency) && concurrency > 0 ? Math.floor(concurrency) : gateConcurrency(env)
  if (list.length === 1 || limit <= 1)
    return list.map((t) =>
      spawnGate(t.script, t.args ?? [], root, t.timeoutMs ?? GATE_TIMEOUT_MS, env),
    )
  const failAll = (why) => list.map(() => ({ rc: 9, out: why }))
  try {
    const out = execFileSync(process.execPath, [WORKER], {
      input: JSON.stringify({ tasks: list, root, concurrency: limit }),
      encoding: 'utf8',
      windowsHide: true,
      timeout: WORKER_TIMEOUT_MS,
      maxBuffer: 1 << 29,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...(env ?? {}) },
    })
    const parsed = JSON.parse(String(out ?? ''))
    if (!Array.isArray(parsed) || parsed.length !== list.length)
      return failAll(
        `并发 worker 返回条目数 ${Array.isArray(parsed) ? parsed.length : '非数组'} ≠ 任务数 ${list.length} ⇒ 未判定`,
      )
    return parsed
  } catch (e) {
    return failAll(`并发 worker 不可用(${String(e?.message ?? e).slice(0, 160)})⇒ 未判定`)
  }
}

/**
 * 落地后复跑受影响判据。返回
 * { verdict, ran, failed, undetermined, warnFailures, dupFindings, notes, untriggered }
 *  - verdict 0 = 全绿;1 = 有 blocking 臂判红(含重复定义命中);2 = 有臂"无法判定"(未判定≠通过)
 *  - untriggered = 注册表里**本通道结构上不复跑**的那一截的计数(见 countUntriggered);
 *    它的存在意味着"全绿"这句话的覆盖面小于字面,报告面必须把它一起说出来。
 *  - 本函数**只报数不改调用方退出码**;调用方(落地器)按 verdict 大声 exit 非 0 ——
 *    不回滚(落地是既成事实),但拒绝静默(票面纪律)。
 */
export function rerunAffectedGates({ root = REPO_ROOT, paths = [], env = process.env } = {}) {
  const res = {
    verdict: 0,
    ran: [],
    failed: [],
    undetermined: [],
    warnFailures: [],
    dupFindings: [],
    notes: [],
    untriggered: null,
  }
  const declared = [...new Set(paths.map((p) => String(p).replace(/\\/g, '/')))]
  if (declared.length === 0) return res
  if (env.IHUI_LAND_SKIP_AFFECTED_GATES === '1') {
    console.log(
      '⚠️ IHUI_LAND_SKIP_AFFECTED_GATES=1 ⇒ 本次跳过落地后受影响判据复跑(该行输出即留痕;仅应急)',
    )
    res.skipped = true
    return res
  }
  // 换仓通道(LAND_ROOT 指向别的仓,镜像测试的 mkScratch 现场)下,内置门体若按自身位置推导会
  // 跑到**本器所在仓**的面上去(G-929 同型教训:涉事判据必须把被审仓根透传给门体)。
  // 判据:根不是本仓 ⇒ 内置臂只有桩通道可跑;没给桩就逐臂点名"未跑",绝不静默当成"跑过且绿"。
  // 大小写不敏感比较:Windows 盘符大小写(G:/g:)漂不得把生产档误读成换仓通道(误读=整档静默旁路)。
  const inHomeRepo = resolve(root).toLowerCase() === REPO_ROOT.toLowerCase()

  // —— 臂 1:同名函数族重复定义扫描(判 HEAD 面 = 落地面;取不到的路径点名后跳过该文件) ——
  const codePaths = declared.filter((p) => DUPDEF_EXTS.some((e) => p.toLowerCase().endsWith(e)))
  if (codePaths.length > 0) {
    let face = null
    try {
      face = catBatch(
        root,
        codePaths.map((p) => `HEAD:${p}`),
        { timeout: 120000, maxBuffer: 1 << 29 },
      )
    } catch (e) {
      res.undetermined.push({
        kind: 'dupdef',
        why: `落地面取材失败,重复定义扫描未判定:${e?.message ?? e}`,
      })
    }
    if (face) {
      for (const p of codePaths) {
        const text = face.get(`HEAD:${p}`)
        if (typeof text !== 'string') {
          res.notes.push(`重复定义扫描:${p} 在 HEAD 面取不到(删除档或取材漂)⇒ 该文件跳过,已点名`)
          continue
        }
        const ext = '.' + p.split('.').pop().toLowerCase()
        for (const d of scanDuplicateDefinitions(text, ext)) {
          res.dupFindings.push({ path: p, name: d.name, lines: d.lines })
        }
      }
      if (res.dupFindings.length > 0) {
        res.failed.push({
          kind: 'dupdef',
          why: `同名函数族重复定义 ${res.dupFindings.length} 处(旁路"干净合并"把两侧各自重写的同名族一起送进了 HEAD)`,
        })
      } else {
        res.ran.push({ kind: 'dupdef', files: codePaths.length })
      }
    }
  }

  // —— 臂 2:python 面 mypy(复用门 35 门体,全量档 = HEAD 面,物化后判定) ——
  const pyFiles = declared.filter((p) => PY_EXTS.some((e) => p.toLowerCase().endsWith(e)))
  if (pyFiles.length > 0) {
    const stub = String(env.LAND_GATE_RERUN_MYPY ?? '').trim()
    const gate = stub || join(REPO_ROOT, 'scripts', 'check-mypy.mjs')
    if (!stub && !inHomeRepo) {
      res.notes.push(
        `mypy 臂:被审根不是本器所在仓且未给桩(LAND_GATE_RERUN_MYPY)⇒ 本轮未跑,已点名(不是"跑过且绿")`,
      )
    } else if (!existsSync(gate)) {
      res.undetermined.push({ kind: 'mypy', why: `门体取不到:${gate}(未判定不等于通过)` })
    } else {
      const r = spawnGate(gate, [], root, 960000, env)
      if (r.rc === 0) res.ran.push({ kind: 'mypy', files: pyFiles.length })
      else if (r.rc === 1) res.failed.push({ kind: 'mypy', out: r.out, files: pyFiles.length })
      else res.undetermined.push({ kind: 'mypy', rc: r.rc, out: r.out, files: pyFiles.length })
    }
  }

  // —— 臂 3:ts 面 tsc(复用门 16/16b 门体的 --files 档,不读共享索引) ——
  const tsFiles = declared.filter((p) => TS_EXTS.some((e) => p.toLowerCase().endsWith(e)))
  if (tsFiles.length > 0) {
    const stub = String(env.LAND_GATE_RERUN_TSC ?? '').trim()
    const gate = stub || join(REPO_ROOT, 'scripts', 'check-staged-typecheck.mjs')
    if (!stub && !inHomeRepo) {
      res.notes.push(
        `tsc 臂:被审根不是本器所在仓且未给桩(LAND_GATE_RERUN_TSC)⇒ 本轮未跑,已点名(不是"跑过且绿")`,
      )
    } else if (!existsSync(gate)) {
      res.undetermined.push({ kind: 'tsc', why: `门体取不到:${gate}(未判定不等于通过)` })
    } else {
      const present = tsFiles.filter((p) => existsSync(join(root, p)))
      for (const p of tsFiles)
        if (!present.includes(p))
          res.notes.push(`tsc:${p} 盘上没有(删除档)⇒ 不进 --files 清单,已点名`)
      if (present.length === 0) {
        res.ran.push({
          kind: 'tsc',
          files: 0,
          note: '落地 ts 面全是删除档,tsc 无对象可审;删除面的红由注册表臂/提交链兜',
        })
      } else {
        const r = spawnGate(gate, ['--files', ...present], root, 600000, env)
        if (r.rc === 0) res.ran.push({ kind: 'tsc', files: present.length })
        else if (r.rc === 1) res.failed.push({ kind: 'tsc', out: r.out, files: present.length })
        else res.undetermined.push({ kind: 'tsc', rc: r.rc, out: r.out, files: present.length })
      }
    }
  }

  // —— 臂 4:注册表映射(路径→门;复跑受影响门的全量档,分级语义与 runner 同形) ——
  const regStub = String(env.LAND_GATE_RERUN_REGISTRY ?? '').trim()
  let regText = null
  if (!regStub && !inHomeRepo) {
    res.notes.push(
      '注册表臂:被审根不是本器所在仓且未给替代注册表(LAND_GATE_RERUN_REGISTRY)⇒ 路径→门映射本轮未跑,已点名(不是"没有受影响门")',
    )
  } else if (regStub) {
    try {
      regText = readFileSync(regStub, 'utf8')
    } catch {
      regText = null
    }
    if (regText === null) {
      res.undetermined.push({ kind: 'registry', why: `替代注册表取不到:${regStub}(映射未判定)` })
    }
  } else {
    // 生产档判 **HEAD 面**(§0.4:工作树副本常年滞后,按盘上那份选门会把刚落地的新门看漏)
    try {
      const m = catBatch(root, ['HEAD:scripts/guardian-runner.mjs'], {
        timeout: 60000,
        maxBuffer: 1 << 28,
      })
      regText = m.get('HEAD:scripts/guardian-runner.mjs') ?? null
    } catch {
      regText = null
    }
    if (regText === null) {
      res.undetermined.push({
        kind: 'registry',
        why: 'HEAD 面取不到 scripts/guardian-runner.mjs(路径→门映射未判定,不得读成"没有受影响门")',
      })
    }
  }
  if (regText !== null) {
    const parsed = parseGateRegistry(regText)
    if (parsed.error) {
      res.undetermined.push({ kind: 'registry', why: `注册表结构漂(${parsed.error})⇒ 映射未判定` })
    } else {
      let affected = []
      try {
        affected = selectAffectedGates(declared, parsed.entries)
      } catch (e) {
        res.undetermined.push({
          kind: 'registry',
          why: `stagedTriggers 归一抛错:${e?.message ?? e}`,
        })
      }
      // 内置臂已覆盖的门体不重跑(mypy/tsc 各只跑一次);注册表条目若声明了 --staged,
      // 这里剥掉 —— 落地后"本次改动"在 HEAD 面,全量档判 HEAD blob 才是落地面;
      // 共享索引里可能挂着他人暂存文件,--staged 档会把别人的面算进本轮结论。
      const BUILTIN_SCRIPTS = new Set(['check-mypy.mjs', 'check-staged-typecheck.mjs'])
      const REGISTRY_CAP = 30
      const toRun = affected.filter((g) => !BUILTIN_SCRIPTS.has(g.script))
      const deferred = toRun.slice(REGISTRY_CAP)
      for (const g of deferred) {
        console.log(
          `⚠️ 注册表受影响门 [${g.id}] ${g.script} 超出复跑预算(${REGISTRY_CAP} 道)⇒ 本轮未跑,请人工复现:node scripts/${g.script}`,
        )
      }
      // 执行:先按原顺序筛出**真要跑**的臂(缺门体/应急跳过都不进批次),再整体交给并发池。
      // 并发只改"等谁":argv、cwd、timeout、env 与逐臂串行时逐字相同;结果按输入下标回填,
      // 下面的归类循环保持原顺序 ⇒ ran/failed/warnFailures/undetermined 的内容与分级一字不变。
      // 依据(2026-10-28 实测):单臂 0.3s~34s 差两个数量级,串行的墙钟时间几乎全花在等最慢那几臂。
      const batchPlan = []
      for (const g of toRun.slice(0, REGISTRY_CAP)) {
        const scriptPath = join(root, 'scripts', g.script)
        if (!existsSync(scriptPath)) {
          res.undetermined.push({
            kind: 'registry',
            id: g.id,
            why: `门体取不到:scripts/${g.script}`,
          })
          continue
        }
        if (g.skipEnv && env[g.skipEnv] === '1') {
          res.notes.push(`注册表门 [${g.id}] 跳过(${g.skipEnv}=1,应急放行留痕)`)
          continue
        }
        batchPlan.push({ g, scriptPath, args: g.args.filter((a) => a !== '--staged') })
      }
      const outcomes = runGateBatch(
        batchPlan.map((b) => ({ script: b.scriptPath, args: b.args, timeoutMs: GATE_TIMEOUT_MS })),
        { root, env },
      )
      for (let i = 0; i < batchPlan.length; i++) {
        const g = batchPlan[i].g
        const r = outcomes[i] ?? { rc: 9, out: '并发批量未回填该臂 ⇒ 未判定' }
        const rec = { kind: 'registry', id: g.id, script: g.script, mode: g.mode }
        if (r.rc === 0) res.ran.push({ ...rec })
        else if (r.rc === 1) {
          if (g.mode === 'warn') res.warnFailures.push({ ...rec, out: r.out })
          else res.failed.push({ ...rec, out: r.out })
        } else res.undetermined.push({ ...rec, rc: r.rc, out: r.out })
      }
      res.registryAffected = affected.map((g) => `${g.id}:${g.script}`)
      // 覆盖面边界(2026-10-27 立):把"本通道结构上永不复跑"的那一截量出来并点名。
      // 只量不判 —— 不改红绿,但绝不允许绿行把这一截省掉(见 countUntriggered 头注)。
      const untrig = countUntriggered(parsed.entries)
      res.untriggered = untrig
      if (untrig.missing > 0) {
        res.notes.push(
          `注册表臂覆盖面:登记判据门 ${untrig.judges} 道,其中 ${untrig.missing} 道(blocking ${untrig.blocking})` +
            `未声明 stagedTriggers ⇒ 本通道**结构上不复跑**(提交通道把同一份缺省读成"任何提交都跑",两通道在此反义);` +
            `本次"全绿"不覆盖这 ${untrig.missing} 道,要覆盖请在注册条目里显式声明射程(要"任何提交都跑"就写 ['**/*'])`,
        )
      }
    }
  }

  if (res.dupFindings.length > 0) {
    for (const d of res.dupFindings.slice(0, 20)) {
      console.error(
        `❌ 重复定义:${d.path} 顶层同名 "${d.name}" 出现 ${d.lines.length} 次(行 ${d.lines.join(', ')})`,
      )
    }
  }
  for (const f of res.failed) {
    console.error(
      `❌ 落地后复跑判红:${f.kind}${f.id ? ` [门 ${f.id}]` : ''} ${f.why ?? '见门体输出'}`,
    )
    if (f.out)
      console.error(
        String(f.out)
          .split(/\r?\n/)
          .slice(-12)
          .map((l) => `   | ${l}`)
          .join('\n'),
      )
  }
  for (const w of res.warnFailures) {
    console.log(`⚠️ 落地后复跑 warn 门判红(不阻塞,与 runner 分级同形):[门 ${w.id}] ${w.script}`)
  }
  for (const u of res.undetermined) {
    console.error(
      `❌ 落地后复跑**无法判定**:${u.kind}${u.id ? ` [门 ${u.id}]` : ''}(rc=${u.rc ?? 'n/a'})—— 未判定不等于通过`,
    )
    if (u.why) console.error(`   ${u.why}`)
  }
  // 点名必须**真的打印出来**(2026-10-27 修):此前 notes 只被 push、从未有人 print,而绿行却写
  // 「点名 N 条(见上)」—— 那是一句自证"已经点过名"的谎(§0.3「把没判说成判过」同族)。
  // 落地时"被审根不是本器所在仓""tsc 有文件盘上没有""注册表门按 skipEnv 放行"这些格子
  // 全都只走这条路,不打印就等于静默少跑。措辞不叫"警告"叫"点名",因为它不改红绿、只交代覆盖面。
  for (const n of res.notes) console.log(`ℹ️ 落地后复跑点名:${n}`)
  if (res.failed.length > 0) res.verdict = 1
  else if (res.undetermined.length > 0) res.verdict = 2
  else {
    // 覆盖面边界写进绿行本身(2026-10-27):`N 臂全绿` 是**跑过的那些臂**全绿,不是"全部判据全绿"。
    // 未声明 stagedTriggers 的登记门在本通道结构上不复跑,这里必须把道数缀在绿行末尾 ——
    // 否则读绿行的人会把它当成全域通过(2026-10-27 门 193 盲绿就是这么发生的)。
    const untrig = res.untriggered
    console.log(
      `✅ 落地后受影响判据复跑:${res.ran.length} 臂全绿` +
        (res.registryAffected
          ? `(注册表受影响门 ${res.registryAffected.length} 道${res.registryAffected.length ? `:${res.registryAffected.join(' / ')}` : ''})`
          : '(注册表臂本轮未跑,见点名)') +
        (untrig && untrig.missing > 0
          ? `;未声明射程未复跑 ${untrig.missing} 道(blocking ${untrig.blocking})—— 本行"全绿"只覆盖跑过的臂,不是全域通过`
          : '') +
        (res.notes.length ? `;点名 ${res.notes.length} 条(见上)` : ''),
    )
  }
  return res
}

export const __test__ = {
  parseGateRegistry,
  extractEntryFields,
  selectAffectedGates,
  countUntriggered,
  scanDuplicateDefinitions,
  DUPDEF_EXTS,
  PY_EXTS,
  TS_EXTS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
