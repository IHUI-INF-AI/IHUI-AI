// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/` 下 `.mjs` 工具脚本的 **§22d 入口守卫对账**(2026-10-05 立,台账 G-1058651)。
 *
 * ## 这道门拦什么
 *
 * AGENTS §22d 规定:需要"CLI 直跑 + 被 import"双形态的 `.mjs` 工具脚本,必须在文件末尾有
 * `isDirectRun` 守卫,否则测试一 `import` 该模块就**连带触发 CLI 主流程**(打印几十行、
 * 个别直接 `process.exit` 打死宿主),于是 §22c 的"测试改调生产判据"这条通道对整族
 * **结构性不可达** —— 不是"某道题没写测试",而是"写了测试也跑不起来"。
 *
 * 立因不是假想:台账 G-1058651 立项时现读 HEAD 面,`scripts/check-*.mjs` 里已有 **11** 枚顶层直跑
 * `main()` 且**任何形态**的入口守卫都没有,而**没有任何一道门看守这件事** —— 所以它一直在长:
 * **本门落地当天同一张面复量,`scripts/check-*.mjs` 涨到 15 枚,整个 `scripts/` 射程(不含 `scripts/tests/`)
 * 共 54 枚**,而且新长出来的那些恰好是**同一天为别的缺陷补的门**。没有门看守的规范条目,
 * 在本仓的实测寿命就是"写下来那天起慢慢失效"。
 *
 * ## 射程与已知空档(如实登记,不假装全覆盖)
 *
 *  - 射程:判定面上的 `scripts/` 递归 `.mjs`(含 `scripts/lib/`),**不含 `scripts/tests/`** ——
 *    测试是 §22d 里"import 的那一方",不是 CLI 入口;
 *  - 触发条件只认 §22d 规定的入口名 **`main()`**(`main()` / `main();` / `main().catch(…)` / `await main()`)。
 *    把 CLI 主流程叫 `run()` / `audit()` 再裸调的写法**在本门射程外** —— 这是刻意的收窄而不是漏:
 *    换名字的入口没有规范条文背书,当场判红就是在立新规;要收这一族需要先补 §22d 的措辞,再补判据;
 *  - `.cjs` / `.js` 不参与(§22d 红线:`.cjs` 没有 `import.meta`,走 `require.main === module`)。
 *
 * ## 口径(同 70/77/83/98/101/103/118/150)
 *
 * 全量档判 **HEAD blob**、`--staged` 判**索引 blob**、`--worktree` 只作人工逃生舱;
 * 两面旗同给 = 自相矛盾 ⇒ exit 2;**取不到面不回落另一个面、绝不记绿**;
 * 清单与正文**同面同轮**取(枚举用 `gitRaw`,内容用 `catBatch`,都出自 `./lib/face-reader.mjs`);
 * 不用 `process.cwd()` 定根、不裸 `execSync('git …')` 读 blob、不 `readFileSync(join(ROOT…))` 判被审内容
 * —— 后两条正是守门 118 的判红项(`half-wired` / `loose-fs`)。
 *
 * ## 三形态守卫**并集**(缺一个就漏一类)
 *
 *  1. `isDirectRun` 标识符(§22d 模板形);
 *  2. `import.meta.url === pathToFileURL(process.argv[1]).href`(两侧都认,写法顺序不敏感);
 *  3. `fileURLToPath(import.meta.url) === process.argv[1]` 等值形。
 *
 * 只认其中一种,另外两种写法的门就会被判成"没有守卫"而**存量假红**,而假红比漏报更贵
 * (它逼人 `--no-verify`,一次绕过等于该提交上全部守门作废,§12e)。
 * 判定一律跑在**代码面**上:注释与字符串(含正则字面量的体)先用 `scripts/lib/code-mask.mjs`
 * 里那一份实现抹平 —— **遮罩只有一份**,本门不自带第二台分词器(§3 共享层优先)。
 * 本门取的是那**一台**分词器的**两个投影**(见 `MASK_PROJECTIONS` 注:单投影会把 6 枚现存门读成
 * "配不平 ⇒ 未判定",成因是"正则还是除法"只看上一个有效 token、`lastWord` 跨行不重置)。
 * 少这一步,门就会把"解释这道门的注释"读成守卫(守门 131 第一次自跑就栽在这里),
 * 而后人只能把说明删掉。
 *
 * ## 三态**不并桶**
 *
 *  - **命中**:代码面顶层出现无守卫的 `main()` / `main();` / `main().catch(…)` / `await main()`
 *    (顶层语句切分判"在不在 `if (…)` 守卫块内",所以 `if (isDirectRun) { main() }` 与
 *    `if (x) main()` 都不算违规);
 *  - **放过**:顶层没有裸 `main()` 调用,且带任一形态守卫(或定义了 `main` 却只在守卫位调用);
 *  - **未判定**:括号配平失败 / 顶层语句切不出来 / 文件超大 / **该面取不到内容** ⇒ **逐条点名**,
 *    `--strict` 下只要有未判定就 exit 2 拒绝出合格证。把"没判"写成"判过了"是本仓最高频的失效型。
 *
 * **枚举到 0 个候选 = 判死,不是绿**:射程内一个 `.mjs` 都没枚举到、或枚举到了却一个候选
 * (命中+放过+未判定)都判不出来 ⇒ exit 2。那只有两种解释:尺子失明,或射程算错了 —— 两种都不能记绿。
 *
 * ## 差值棘轮(为什么存量不判红)
 *
 * 锚点 = **该文件在 HEAD 面自身的命中数**(不是静态白名单,也不是恒 0)。于是现读的 **54 枚存量**
 * (其中 `scripts/check-*.mjs` 15 枚)只报数不判红,只有"本次带进来的新违规"才被拦。
 * 理由照 §12e 抄在这里,因为它决定了本门的定级:
 * **与提交者无关的恒红门会逼人 `--no-verify`,而一次绕过等于该提交上全部守门作废。**
 * 拿"存量 54"去拦一个只改 README 的人,得到的不是修复而是绕门;拿"本次新增"去拦,他才修得起。
 * 全量档(HEAD 面)按构造恒为"新增 0" —— 它是**问责/巡检读数**,不是提交链;提交链走 `--staged`。
 *
 * ## 豁免:只走具名台账,行内不做出口
 *
 * 唯一出口是 `scripts/data/direct-run-guard-exemptions.json`,每条三件套 `path + reason + reviewBy`:
 * 缺字段 / 复核日过期 / **登记了而被审面没命中(清单腐烂)** 三种都判红。
 * 刻意**不给行内标记**:守卫缺失不是一行的属性,而是"整个文件 import 就会炸"的属性 ——
 * 行内标记会把一件文件级的事伪装成语句级的事,还会被复制粘贴扩散(与凭据族不同,那一族
 * 的豁免对象就是单个语句)。
 *
 * **本轮台账建为空数组 `[]`,且这是刻意的**:现读 HEAD 的 54 枚存量按上面的棘轮**只报数不判红**,
 * 结构上不存在"不豁免就提交不进去"的站点;此时写任何豁免条目都只有一个作用 ——
 * 把存量合法地钉成"永久免检",而存量的清偿方式是**补守卫**(四行模板),不是豁免。
 * 第一条豁免应当只在"某枚新门确实被拦下、且当场补守卫会撕开别的票"时才出现,并带复核日。
 *
 * ## CLI
 *
 * `node scripts/check-direct-run-guard.mjs [--staged|--worktree|--strict|--json|--self-test] [--root <仓根>]`
 * 退出码:0 = 判定完成且无新增违规;1 = 业务失败(新增命中 / 台账缺字段·过期·腐烂);
 * 2 = 无法判定或用法错(两面旗同给 / 取不到面 / 空枚举 / 台账 JSON 坏 / `--strict` 下有未判定)。
 * 注册进提交链后的问责入口建议 `pnpm check:direct-run-guard`,紧急跳过建议
 * `HUSKY_SKIP_DIRECT_RUN_GUARD=1`(**本枚不注册**,注册由主会话在同一枚提交里做)。
 */

import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  Undetermined,
  assertRepoRoot,
  catBatch,
  gitRaw,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'
import {
  maskCommentsAndStrings,
  maskCommentsStringsAndRegex,
} from './lib/code-mask.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export const SELF = 'scripts/check-direct-run-guard.mjs'
export const LEDGER_FILE = 'scripts/data/direct-run-guard-exemptions.json'
/** 射程:`scripts/` 下所有 `.mjs` 工具脚本,但**不含 `scripts/tests/`**(测试是 import 的一方,不是 CLI 入口)。 */
export const SCOPE_DIR = 'scripts'
export const TEST_DIR = 'scripts/tests/'
/** 超过这个体量不切顶层语句 ⇒ 落"未判定"点名(现读射程内最大约 4 万字符,留一个数量级的余量)。 */
export const MAX_FILE_CHARS = 512 * 1024
const GIT_TIMEOUT = 120_000
/** 只报清单/计数时的截断,免得 `--json` 把几百条路径灌进 stdout。 */
const LIST_CAP = 40

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
}

/** 三种入口守卫形态(并集)。名字写给报告读,正则写给判据读。 */
export const GUARD_FORMS = [
  {
    name: 'isDirectRun 标识符',
    re: /(?:^|[^.\w$])isDirectRun\b/,
  },
  {
    name: 'import.meta.url === pathToFileURL(…)',
    re: /import\.meta\.url\s*(?:===?|!==)\s*pathToFileURL\s*\([^)]*\)\s*(?:\.href)?|pathToFileURL\s*\([^)]*\)\s*(?:\.href)?\s*(?:===?|!==)\s*import\.meta\.url/,
  },
  {
    name: 'fileURLToPath(import.meta.url) 等值形',
    re: /fileURLToPath\s*\(\s*import\.meta\.url\s*\)\s*(?:===?|!==)|(?:===?|!==)\s*fileURLToPath\s*\(\s*import\.meta\.url\s*\)/,
  },
]

/** 顶层裸 main 调用的四种书写形态(§22d 点了前两种,`await`/分号形是本仓现存写法)。 */
export const BARE_MAIN_RE = /^(?:await\s+|void\s+)?main\s*\(/
/** `main` 定义的两种形态(用来分"无 CLI 入口"与"守卫写全了")。 */
export const MAIN_DEFINED_RE =
  /(?:^|[^.\w$])(?:async\s+)?function\s+main\s*\(|(?:^|[^.\w$])(?:const|let|var)\s+main\s*=/
const CONTROL_KW = ['if', 'for', 'while', 'do', 'switch', 'try', 'catch', 'finally', 'else']

export function inScope(rel) {
  return (
    typeof rel === 'string' && rel.startsWith(SCOPE_DIR + '/') && rel.endsWith('.mjs') && !rel.startsWith(TEST_DIR)
  )
}

export function guardFormsOf(masked) {
  if (typeof masked !== 'string') return []
  return GUARD_FORMS.filter((f) => f.re.test(masked)).map((f) => f.name)
}

function lineAt(src, idx) {
  let n = 1
  for (let i = 0; i < idx && i < src.length; i++) if (src[i] === '\n') n += 1
  return n
}

/**
 * 顶层语句切分(跑在**遮罩后的代码面**上)。
 *
 * 为什么不用行正则:实测两种朴素写法都错。
 *  ① `/^\s*main\(\s*\)/m`(逐行判)会把 `if (isDirectRun) {` 块**里面**那一行缩进的
 *     `main().catch(…)` 也读成顶层裸调用 ⇒ 全仓假红一片(第一版就这么错过,现读 468 vs 真值 11);
 *  ② 只按 `;` 切会把跨行的 `if (cond)\n main()` 切成两条独立语句 ⇒ 把合法守卫判成违规。
 * 所以这里按括号深度走,**控制流语句整条吃掉**(含 `else`/`catch`/`finally` 续块与无花括号的
 * 单语句体)—— 守卫块内部永远是深度 ≥1,而"守卫块外的顶层 `main(`"才是本门要的那一型。
 * 配平失败(多余闭括号 / 永不闭合的 `(`/`{`)⇒ `error` 非空,由调用方折成"未判定"点名。
 *
 * @returns {{calls:Array<{line:number,text:string}>,error:string|null}}
 */
export function topLevelMainCalls(src) {
  const out = { calls: [], error: null }
  if (typeof src !== 'string' || src.length === 0) return out
  const n = src.length
  const ws = (c) => c === ' ' || c === '\t' || c === '\r' || c === '\n'
  const skipWs = (p) => {
    let k = p
    while (k < n && ws(src[k])) k += 1
    return k
  }
  const wordAt = (p, w) => src.startsWith(w, p) && !/[\w$]/.test(src[p + w.length] ?? '')
  const controlWord = (p) => CONTROL_KW.find((w) => wordAt(p, w)) ?? null
  const opener = (c) => c === '(' || c === '[' || c === '{'
  const closer = (c) => c === ')' || c === ']' || c === '}'

  /** 从 p 的开括号走到配对闭括号之后(内含任意其它括号);配不平回 -1。 */
  const skipBalanced = (p) => {
    if (!opener(src[p])) return -1
    let d = 0
    for (let k = p; k < n; k++) {
      if (opener(src[k])) d += 1
      else if (closer(src[k])) {
        d -= 1
        if (d === 0) return k + 1
        if (d < 0) return -1
      }
    }
    return -1
  }

  /** 顶层语句的结尾:深度归零处遇到 `;` 或换行(或走到文件尾)。走到文件尾时深度必须为 0。 */
  const statementEnd = (p) => {
    let d = 0
    for (let k = p; k < n; k++) {
      const c = src[k]
      if (opener(c)) d += 1
      else if (closer(c)) {
        d -= 1
        if (d < 0) {
          out.error = `第 ${lineAt(src, k)} 行出现配不上的闭括号 \`${c}\``
          return -1
        }
      } else if ((c === ';' || c === '\n') && d === 0) return k + 1
    }
    if (d > 0) {
      out.error = `第 ${lineAt(src, p)} 行的语句走到文件尾仍未闭合(括号少 ${d} 个配对)`
      return -1
    }
    return n
  }

  /** 控制流语句的**体**:花括号块 / 嵌套控制流 / 无花括号单语句(单语句按"被守卫罩住"跳过)。 */
  const consumeBody = (p) => {
    const q = skipWs(p)
    if (q >= n) return q
    if (src[q] === '{') {
      const e = skipBalanced(q)
      if (e < 0) {
        out.error = `第 ${lineAt(src, q)} 行的 \`{\` 配不平 ⇒ 取不出函数/守卫体`
        return -1
      }
      return e
    }
    if (controlWord(q)) return consumeControl(q)
    return statementEnd(q)
  }

  const consumeControl = (p) => {
    const w = controlWord(p)
    if (!w) return statementEnd(p)
    let q = skipWs(p + w.length)
    if (w === 'do') {
      const body = consumeBody(q)
      if (body < 0) return -1
      const r = skipWs(body)
      if (!wordAt(r, 'while')) return body
      let s = skipWs(r + 5)
      s = s < n && src[s] === '(' ? skipBalanced(s) : -1
      if (s < 0) {
        out.error = `第 ${lineAt(src, r)} 行的 \`do … while (…)\` 配不平`
        return -1
      }
      return src[s] === ';' ? s + 1 : s
    }
    if (q < n && src[q] === '(') {
      const e = skipBalanced(q)
      if (e < 0) {
        out.error = `第 ${lineAt(src, q)} 行的 \`${w} (…)\` 条件配不平`
        return -1
      }
      q = e
    }
    q = consumeBody(q)
    if (q < 0) return -1
    const r = skipWs(q)
    if ((w === 'try' || w === 'catch') && (wordAt(r, 'catch') || wordAt(r, 'finally')))
      return consumeControl(r)
    if (w === 'if' && wordAt(r, 'else')) return consumeControl(r)
    return q
  }

  let i = 0
  while (i < n) {
    const p = skipWs(i)
    if (p >= n) break
    const cw = controlWord(p)
    if (cw) {
      const e = consumeControl(p)
      if (e < 0) return out
      i = e
      continue
    }
    if (BARE_MAIN_RE.test(src.slice(p, p + 40))) {
      const e = statementEnd(p)
      if (e < 0) return out
      out.calls.push({ line: lineAt(src, p), text: src.slice(p, e).trim().replace(/\s+/g, ' ') })
      i = e
      continue
    }
    const e = statementEnd(p)
    if (e < 0) return out
    i = e
  }
  return out
}

/**
 * 单遍分词的**两个投影**(都出自 `scripts/lib/code-mask.mjs` 那一台分词器,本门不自带遮罩):
 *  - 主档 `maskCommentsStringsAndRegex` 连正则体一起清 ⇒ 按括号配平切顶层语句时**这一档才是对的**
 *    (正则里的 `(` 是模式不是调用;守门 156 现读的未判定里 3 处正是反方向造成的);
 *  - 备档 `maskCommentsAndStrings` 关掉正则档 ⇒ 正则体逐字留在面上,字符类里带斜杠的写法
 *    (`/…[^/]*$/`)不会被切成半截正则。
 *
 * 为什么两档都要(现读证据,不是假想):分词器判"这是正则还是除法"只看**上一个有效 token**,而
 * `lastWord` 跨行不重置 ⇒ 上一行以 `return true` 收尾、本行写 `return /re/` 时,那个 `/` 被认成除法,
 * 半截正则把 `]` 与 flags 吞掉,面上就剩下配不平的 `[`。本票立项当天按单档量到 **6** 枚
 * `scripts/*.mjs` 落在这一格(其中 `scripts/check-brand-email-channel.mjs:253`)。
 * 这不是"没有违规",也不是"有违规",而是"这一面我没判出来" ⇒ **两档都切不出顶层语句才落未判定**,
 * 且把两档各自的失败原因都点名。
 *
 * ⚠ 放宽的只有"能不能切",不是"切出来判什么":注释与字符串在**两档里都被抹平**,
 * 所以"守卫只写在注释/字符串里"在任何一档都不可能被读成放过(--self-test ST8/ST9/ST10 钉住)。
 */
export const MASK_PROJECTIONS = [
  { name: '注释+字符串+正则体', mask: maskCommentsStringsAndRegex },
  { name: '注释+字符串(正则档关)', mask: maskCommentsAndStrings },
]

/**
 * 单文件判定(纯函数)。三态**不并桶**,`undetermined` 永远带原因与行号。
 * @returns {{rel:string,state:'hit'|'pass'|'no-entry'|'undetermined',hits:Array,forms:string[],why:string|null,mask?:string}}
 */
export function judgeSource(rel, src) {
  if (typeof src !== 'string')
    return {
      rel,
      state: 'undetermined',
      hits: [],
      forms: [],
      why: `${rel} 该面取不到内容 ⇒ 未判定(不回落另一个面)`,
    }
  if (src.length > MAX_FILE_CHARS)
    return {
      rel,
      state: 'undetermined',
      hits: [],
      forms: [],
      why: `${rel} 体量 ${src.length} 字符 > 判据上限 ${MAX_FILE_CHARS} ⇒ 未判定(不硬切顶层语句)`,
    }
  const errs = []
  for (const p of MASK_PROJECTIONS) {
    const masked = p.mask(src)
    const forms = guardFormsOf(masked)
    const st = topLevelMainCalls(masked)
    if (st.error) {
      errs.push(`${p.name}档「${st.error}」`)
      continue
    }
    if (st.calls.length > 0)
      return {
        rel,
        state: 'hit',
        hits: st.calls.map((h) => ({ ...h, forms: forms.length })),
        forms,
        why: null,
        mask: p.name,
      }
    if (forms.length > 0 || MAIN_DEFINED_RE.test(masked))
      return { rel, state: 'pass', hits: [], forms, why: null, mask: p.name }
    return { rel, state: 'no-entry', hits: [], forms, why: null, mask: p.name }
  }
  return {
    rel,
    state: 'undetermined',
    hits: [],
    forms: [],
    why: `${rel} 两档遮罩都切不出顶层语句 ⇒ 未判定(${errs.join('; ')})`,
  }
}

/** 台账解析(纯函数)。整份坏掉 ⇒ `broken`(exit 2);条目字段不齐 ⇒ 该条判红而不是丢掉。 */
export function readLedger(raw) {
  if (raw === null || raw === undefined) return { entries: [], absent: true, broken: null }
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    return {
      entries: [],
      absent: false,
      broken: `台账 ${LEDGER_FILE} JSON 解析失败:${String(e && e.message ? e.message : e).split('\n')[0]}`,
    }
  }
  if (!Array.isArray(parsed))
    return { entries: [], absent: false, broken: `台账 ${LEDGER_FILE} 必须是数组,实得 ${typeof parsed}` }
  const entries = []
  for (const [i, e] of parsed.entries()) {
    const missing = ['path', 'reason', 'reviewBy'].filter((k) => !String(e?.[k] ?? '').trim())
    if (missing.length) {
      entries.push({ index: i, path: String(e?.path ?? ''), broken: `缺字段 ${missing.join('/')}` })
      continue
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(e.reviewBy))) {
      entries.push({ index: i, path: e.path, broken: `reviewBy 不是 ISO 日期(${e.reviewBy})` })
      continue
    }
    entries.push({ index: i, path: e.path, reason: e.reason, reviewBy: e.reviewBy })
  }
  return { entries, absent: false, broken: null }
}

/**
 * 落槌(纯函数,自检/镜像都对这一张构造面动手):
 *  - **差值棘轮**:`新增 = max(0, 本面命中数 − 该文件 HEAD 面命中数)`;存量只进 `stock` 报数。
 *  - 台账三红:缺字段/坏日期、过期、腐烂(登记了而本面没有该文件的命中)。
 *  - 台账整份缺席 ⇒ `ledgerAbsent`(按零豁免判并大声报,绝不折成"通过")。
 */
export function decide({ judged, anchor, ledger, today, face }) {
  const byPath = new Map()
  for (const e of ledger.entries) if (!e.broken) byPath.set(e.path, e)
  const violations = []
  const brokenLedger = []
  const expired = []
  const stock = []
  const exempted = []
  const matched = new Set()
  for (const j of judged) {
    if (j.state !== 'hit') continue
    const base = anchor.get(j.rel) ?? 0
    const isNew = face === 'head' ? false : j.hits.length > base
    const e = byPath.get(j.rel)
    if (e) {
      if (e.reviewBy < today) expired.push(`${j.rel} 复核日 ${e.reviewBy} 已过 ⇒ 必须重新裁一次或补守卫`)
      else {
        matched.add(j.rel)
        exempted.push(j.rel)
      }
      continue
    }
    if (isNew)
      violations.push({
        rel: j.rel,
        hits: j.hits,
        why: `本次新增 ${j.hits.length - base} 处顶层裸 main()(HEAD 面该文件命中 ${base})`,
      })
    else stock.push({ rel: j.rel, count: j.hits.length, forms: j.forms })
  }
  for (const e of ledger.entries) if (e.broken) brokenLedger.push(`${e.path || `第 ${e.index + 1} 条`}:${e.broken}`)
  const stale = []
  if (!ledger.absent)
    for (const e of ledger.entries)
      if (!e.broken && !matched.has(e.path) && !expired.some((s) => s.startsWith(`${e.path} `)))
        stale.push(e.path)
  return { violations, stock, exempted, expired, stale, brokenLedger }
}

/**
 * 枚举(只用 `gitRaw`,且只做**清单**:不读 blob)。清单与内容同面同轮 ⇒ 见 `readFace`。
 * 索引档用 `ls-files -c`(索引面路径集),HEAD 档用 `ls-tree … HEAD`(HEAD 树路径集)。
 */
export function listInScope(root, face) {
  const args =
    face === 'staged'
      ? ['ls-files', '-c', '--', SCOPE_DIR]
      : ['ls-tree', '-r', '--name-only', 'HEAD', '--', SCOPE_DIR]
  const out = gitRaw(args, root, { timeout: GIT_TIMEOUT })
  return String(out)
    .split(/\r?\n/)
    .map((p) => p.trim())
    .filter((p) => inScope(p))
}

/** 一轮取材:清单与正文同面(`HEAD:<path>` / `:<path>`),worktree 档走层的磁盘入口。 */
export function readFace(root, face, files) {
  if (face === 'worktree')
    return files.map((rel) => ({ rel, src: readWorktreeFile(root, rel), spec: rel }))
  const pre = face === 'staged' ? ':' : 'HEAD:'
  const specs = files.map((p) => `${pre}${p}`)
  const got = catBatch(root, specs, { timeout: GIT_TIMEOUT, maxBuffer: 1 << 28 })
  return files.map((rel) => ({ rel, src: got.get(`${pre}${rel}`) ?? null, spec: `${pre}${rel}` }))
}

function readLedgerFromFace(root, face) {
  if (face === 'worktree') return { raw: readWorktreeFile(root, LEDGER_FILE), present: true }
  const pre = face === 'staged' ? ':' : 'HEAD:'
  const m = catBatch(root, [`${pre}${LEDGER_FILE}`], { timeout: GIT_TIMEOUT })
  return { raw: m.get(`${pre}${LEDGER_FILE}`) ?? null, present: true }
}

/**
 * 一面的完整判定。取不到面(清单/正文/台账任一派生失败)一律**抛** `Undetermined`,
 * 由 `main` 折成 exit 2 —— 不回落另一个面,也不记绿。
 */
export function analyze({ face = 'head', root = ROOT } = {}) {
  const top = assertRepoRoot(root, 'direct-run-guard 的判定根')
  const files = listInScope(top, face)
  const rows = readFace(top, face, files)
  const judged = rows.map((r) => judgeSource(r.rel, r.src))
  const hitRels = judged.filter((j) => j.state === 'hit').map((j) => j.rel)

  // 锚点档:HEAD 面上"该文件自身的命中数"。head 档判的就是 HEAD ⇒ 锚点即本轮读数(新增按构造为 0)。
  const anchor = new Map()
  if (face === 'head') for (const j of judged) anchor.set(j.rel, j.hits.length)
  else if (hitRels.length) {
    const base = new Map()
    for (const j of judged) base.set(j.rel, j)
    const arows = readFace(top, 'head', hitRels)
    for (const r of arows) anchor.set(r.rel, judgeSource(r.rel, r.src).hits.length)
  }

  const led = readLedgerFromFace(top, face)
  const ledger = readLedger(led.raw)
  const today = new Date().toISOString().slice(0, 10)
  const d = decide({ judged, anchor, ledger, today, face })
  const counts = {
    listed: files.length,
    hit: judged.filter((j) => j.state === 'hit').length,
    pass: judged.filter((j) => j.state === 'pass').length,
    undetermined: judged.filter((j) => j.state === 'undetermined').length,
    noEntry: judged.filter((j) => j.state === 'no-entry').length,
    candidates: judged.filter((j) => j.state !== 'no-entry').length,
  }
  return {
    face,
    root: top,
    judged,
    anchor,
    counts,
    ledgerPresent: !ledger.absent,
    ledgerBroken: ledger.broken,
    today,
    ...d,
  }
}

/**
 * 空枚举/失明判定(纯函数):射程内没枚举到文件、或枚举到了却一个候选都判不出来,
 * 两种都只能读成"尺子没在工作",不能记绿 ⇒ `dead`。
 */
export function enumerationVerdict({ listed, candidates }) {
  if (!Number.isFinite(listed) || listed === 0) return 'dead:射程内枚举到 0 个 .mjs'
  if (!Number.isFinite(candidates) || candidates === 0) return `dead:枚举到 ${listed} 个文件却判出 0 个候选`
  return null
}

/**
 * 接线读数(纯函数,给镜像测试与自检用)。
 * 未注册 ⇒ `{wired:false}`;注册了就必须 **blocking + skipEnv 成套** ——
 * 一条 blocking 门没有自己的紧急出口,等于把"跳门"的成本转嫁给整条钩子链(§12e)。
 * `triggers` 只回答"有没有声明 stagedTriggers"(取不到暂存清单时 `guardian-triggers.mjs` 保守判"触及",
 * 而**空清单在那一层当场抛错** —— 所以这一格只认"在不在",不认内容;内容是前缀语义不是正则)。
 */
export function wiringState(runnerText, script = 'check-direct-run-guard.mjs') {
  if (typeof runnerText !== 'string') return { wired: false, reason: 'runner 取不到' }
  const at = runnerText.indexOf(`script: '${script}'`)
  if (at < 0) return { wired: false, reason: '注册块不在 runner 面 ⇒ 未接线' }
  const win = runnerText.slice(Math.max(0, at - 700), at + 700)
  const mode = /mode:\s*'(blocking|warn)'/.exec(win)?.[1] ?? null
  const skipEnv = /skipEnv:\s*'([^']+)'/.exec(win)?.[1] ?? null
  const triggers = /stagedTriggers:\s*\[[^\]]*\]/.test(win)
  const missing = []
  if (mode !== 'blocking') missing.push(`mode=${mode ?? '未标'}`)
  if (!skipEnv) missing.push('skipEnv 缺失')
  return { wired: true, mode, skipEnv, triggers, missing }
}

// ───────────────────────────── 自检 ─────────────────────────────

/** 成对构造面:每条判据都同时给"必须命中"与"必须放过"两侧,放宽判据会当场红在一侧。 */
export function selfTest() {
  const cases = []
  const t = (name, cond, extra = '') => {
    cases.push({ name, ok: cond === true, extra: cond === true ? '' : String(extra ?? '') })
  }
  const J = (rel, src) => judgeSource(rel, src)

  const BARE = `import { x } from 'y'\nfunction main(){ doThings() }\nmain().catch((e)=>{ console.error(e); process.exit(2) })\n`
  const BARE_SEMI = `async function main(){}\nmain();\n`
  const BARE_AWAIT = `async function main(){}\nawait main()\n`
  const GUARD_ID = `const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href\nif (isDirectRun) {\n  main().catch((e)=>process.exit(2))\n}\nexport const __test__ = { main }\n`
  const GUARD_URL = `if (import.meta.url === pathToFileURL(process.argv[1]).href) {\n  main()\n}\n`
  const GUARD_F2P = `if (fileURLToPath(import.meta.url) === process.argv[1]) {\n  main()\n}\n`
  const GUARD_IN_LINE_COMMENT = `async function main(){}\nmain().catch(()=>{})\n// const isDirectRun = true; if (isDirectRun) { main() }\n`
  const GUARD_IN_BLOCK_COMMENT = `async function main(){}\nmain()\n/* if (import.meta.url === pathToFileURL(process.argv[1]).href) main() */\n`
  const GUARD_IN_STRING = `async function main(){}\nmain()\nconst doc = "if (isDirectRun) { main() }"\n`
  const MAIN_IN_IF_BLOCK = `async function main(){}\nif (someCondition) {\n  main()\n}\n`
  const MAIN_IN_IF_NO_BRACE = `async function main(){}\nif (isDirectRun) main()\n`
  const MAIN_IN_ELSE_NEWLINE = `async function main(){}\nif (a) {\n  x()\n}\nelse main()\n`
  const MAIN_IN_FUNCTION_BODY = `async function main(){}\nfunction wrapper(){ main() }\n`
  const MAIN_IN_ARROW_INITIALIZER = `const run = () => main()\nasync function main(){}\nrun()\n`
  const UNBALANCED = `async function main(){}\nmain(\n`
  const EXTRA_CLOSE = `const a = 1\n}\nmain()\n`

  const s = (src) => J('a.mjs', src)
  t('ST1 顶层裸 main() 无守卫 ⇒ 命中', s(BARE).state === 'hit', JSON.stringify(s(BARE)))
  t('ST2 裸 main(); 形态 ⇒ 命中', s(BARE_SEMI).state === 'hit', JSON.stringify(s(BARE_SEMI)))
  t('ST3 裸 await main() ⇒ 命中', s(BARE_AWAIT).state === 'hit', JSON.stringify(s(BARE_AWAIT)))
  t('ST4 守卫形态① isDirectRun ⇒ 放过', s(GUARD_ID).state === 'pass', JSON.stringify(s(GUARD_ID)))
  t('ST5 守卫形态② import.meta.url===pathToFileURL ⇒ 放过', s(GUARD_URL).state === 'pass', JSON.stringify(s(GUARD_URL)))
  t('ST6 守卫形态③ fileURLToPath(import.meta.url) 等值 ⇒ 放过', s(GUARD_F2P).state === 'pass', JSON.stringify(s(GUARD_F2P)))
  t('ST7 三形态并集去重后各算一次', (() => {
    const all = J('a.mjs', GUARD_ID + GUARD_URL + GUARD_F2P + 'async function main(){}\n')
    return all.forms.length === 3 && all.state === 'pass'
  })(), 'forms 并集未覆盖三形态或把守卫调用读成裸调用')
  t('ST8 守卫写在**行注释**里不得放过', s(GUARD_IN_LINE_COMMENT).state === 'hit', JSON.stringify(s(GUARD_IN_LINE_COMMENT)))
  t('ST9 守卫写在**块注释**里不得放过', s(GUARD_IN_BLOCK_COMMENT).state === 'hit', JSON.stringify(s(GUARD_IN_BLOCK_COMMENT)))
  t('ST10 守卫写在**字符串**里不得放过', s(GUARD_IN_STRING).state === 'hit', JSON.stringify(s(GUARD_IN_STRING)))
  t('ST11 顶层 main() 在 if 块内不算违规', s(MAIN_IN_IF_BLOCK).state === 'pass' && s(MAIN_IN_IF_BLOCK).hits.length === 0, JSON.stringify(s(MAIN_IN_IF_BLOCK)))
  t('ST12 无花括号 `if (isDirectRun) main()` 不算违规', s(MAIN_IN_IF_NO_BRACE).state === 'pass', JSON.stringify(s(MAIN_IN_IF_NO_BRACE)))
  t('ST13 跨行 `else main()` 属守卫块的另一支 ⇒ 不算违规', s(MAIN_IN_ELSE_NEWLINE).hits.length === 0, JSON.stringify(s(MAIN_IN_ELSE_NEWLINE)))
  t('ST14 函数体内的 main() 不是顶层裸调用', s(MAIN_IN_FUNCTION_BODY).hits.length === 0, JSON.stringify(s(MAIN_IN_FUNCTION_BODY)))
  t('ST15 `const run = () => main()`  initializer 不算顶层裸调用', s(MAIN_IN_ARROW_INITIALIZER).hits.length === 0, JSON.stringify(s(MAIN_IN_ARROW_INITIALIZER)))
  t('ST16 括号配平失败 ⇒ 未判定并点名', s(UNBALANCED).state === 'undetermined' && /未判定/.test(s(UNBALANCED).why), JSON.stringify(s(UNBALANCED)))
  t('ST16b 两档都切不出时,未判定必须**同时点名两档**的原因(不得只报一半)', /注释\+字符串\+正则体.*注释\+字符串\(正则档关\)/.test(s(UNBALANCED).why || ''), s(UNBALANCED).why)
  t('ST17 多余闭括号 ⇒ 未判定', s(EXTRA_CLOSE).state === 'undetermined', JSON.stringify(s(EXTRA_CLOSE)))
  // ST17b/ST17c:现读量到的那一型(check-brand-email-channel.mjs:253)—— 上一行 `return true` 让
  // 分词器把本行的 `/` 认成除法 ⇒ 主档吞掉半截正则、面上留下配不平的 `[`;两档并跑才判得出来。
  const REGEX_CLASS_SLASH = `function isA(base) {\n  if (base.length) return true\n  return /^alertmanager[^/]*$/i.test(base)\n}\nmain()\n`
  const j17 = s(REGEX_CLASS_SLASH)
  t('ST17b 字符类里带斜杠的正则不得把判定打成未判定(两档并跑)', j17.state === 'hit' && j17.hits.length === 1, JSON.stringify(j17))
  t('ST17c 该型走的是备档 ⇒ 如实登记用的是哪一档(读数可归因)', j17.mask === MASK_PROJECTIONS[1].name, JSON.stringify(j17.mask))
  const GUARD_IN_COMMENT_WITH_REGEX = `function isA(base) {\n  if (base.length) return true\n  return /^alertmanager[^/]*$/i.test(base)\n}\nmain()\n// const isDirectRun = true\n/* if (isDirectRun) { main() } */\n`
  t('ST17d 换到备档判时,"守卫只写在注释里"仍然不得放过(两档都抹注释)', s(GUARD_IN_COMMENT_WITH_REGEX).state === 'hit', JSON.stringify(s(GUARD_IN_COMMENT_WITH_REGEX)))
  t('ST18 内容取不到 ⇒ 未判定(不回落另一个面)', J('a.mjs', null).state === 'undetermined')
  t('ST19 超大文件 ⇒ 未判定而不是硬切', J('big.mjs', 'a'.repeat(MAX_FILE_CHARS + 1)).state === 'undetermined')
  t('ST20 空枚举判死(listed=0)', enumerationVerdict({ listed: 0, candidates: 0 }) !== null)
  t('ST21 有清单零候选同样判死', enumerationVerdict({ listed: 12, candidates: 0 }) !== null)
  t('ST22 正常枚举放行', enumerationVerdict({ listed: 12, candidates: 3 }) === null)
  t('ST23 遮罩后行号不漂(报告点名的前提)', maskCommentsStringsAndRegex('a\n// x\nmain()').split('\n').length === 3)

  // 棘轮与台账
  const hitJ = (rel, n) => ({
    rel,
    state: 'hit',
    hits: Array.from({ length: n }, (_, k) => ({ line: k + 1, text: 'main()', forms: 0 })),
    forms: 0,
  })
  const cleanJ = (rel) => ({ rel, state: 'pass', hits: [], forms: ['isDirectRun 标识符'] })
  const today = '2026-12-31'
  t(
    'ST24 棘轮:HEAD 已命中 1 而本面仍 1 ⇒ 存量只报数不判红',
    decide({
      judged: [hitJ('scripts/check-old.mjs', 1)],
      anchor: new Map([['scripts/check-old.mjs', 1]]),
      ledger: readLedger('[]'),
      today,
      face: 'staged',
    }).violations.length === 0,
  )
  t(
    'ST25 棘轮:HEAD 0 而本面 1 ⇒ 新增判红',
    decide({
      judged: [hitJ('scripts/check-new.mjs', 1)],
      anchor: new Map(),
      ledger: readLedger('[]'),
      today,
      face: 'staged',
    }).violations.length === 1,
  )
  t(
    'ST26 全量档(HEAD 面)存量不落到 violations',
    decide({
      judged: [hitJ('scripts/check-old.mjs', 1)],
      anchor: new Map([['scripts/check-old.mjs', 1]]),
      ledger: readLedger('[]'),
      today,
      face: 'head',
    }).violations.length === 0,
  )
  t(
    'ST27 台账有效豁免 ⇒ 不判红且不腐烂',
    (() => {
      const r = decide({
        judged: [hitJ('scripts/check-a.mjs', 1)],
        anchor: new Map(),
        ledger: readLedger(
          JSON.stringify([{ path: 'scripts/check-a.mjs', reason: '夹具脚本,测试不 import', reviewBy: '2027-01-31' }]),
        ),
        today,
        face: 'staged',
      })
      return r.violations.length === 0 && r.stale.length === 0 && r.exempted.length === 1
    })(),
  )
  t(
    'ST28 台账缺字段 ⇒ 判红(不成豁免,而该站点也照旧判红 —— 半坏的豁免条不等于没有豁免)',
    (() => {
      const r = decide({
        judged: [hitJ('scripts/check-a.mjs', 1)],
        anchor: new Map(),
        ledger: readLedger(JSON.stringify([{ path: 'scripts/check-a.mjs', reason: '', reviewBy: '' }])),
        today,
        face: 'staged',
      })
      return r.brokenLedger.length === 1 && r.violations.length === 1 && r.exempted.length === 0
    })(),
  )
  t(
    'ST29 台账过期 ⇒ 判红',
    decide({
      judged: [hitJ('scripts/check-a.mjs', 1)],
      anchor: new Map(),
      ledger: readLedger(
        JSON.stringify([{ path: 'scripts/check-a.mjs', reason: 'x', reviewBy: '2020-01-01' }]),
      ),
      today,
      face: 'staged',
    }).expired.length === 1,
  )
  t(
    'ST30 台账腐烂(登记了而本面没命中)⇒ 判红',
    decide({
      judged: [cleanJ('scripts/check-a.mjs')],
      anchor: new Map(),
      ledger: readLedger(
        JSON.stringify([{ path: 'scripts/check-a.mjs', reason: 'x', reviewBy: '2027-01-31' }]),
      ),
      today,
      face: 'staged',
    }).stale.length === 1,
  )
  t('ST31 坏 JSON 台账 ⇒ broken(exit 2 档,既不记绿也不判红)', readLedger('{ 坏').broken !== null)
  t('ST32 非数组台账 ⇒ broken', readLedger('{"path":"a"}').broken !== null)
  t(
    'ST33 台账整份缺席 ⇒ 按零豁免判并大声报(缺席不等于通过)',
    (() => {
      const l = readLedger(null)
      const r = decide({ judged: [hitJ('scripts/check-a.mjs', 1)], anchor: new Map(), ledger: l, today, face: 'staged' })
      return l.absent === true && r.violations.length === 1
    })(),
  )

  // 接线读数
  const RUNNER_WITH = `  {\n    id: '194',\n    label: 'x',\n    script: 'check-direct-run-guard.mjs',\n    args: [],\n    mode: 'blocking',\n    skipEnv: 'HUSKY_SKIP_DIRECT_RUN_GUARD',\n    stagedTriggers: ['scripts/'],\n  },`
  const RUNNER_NOENV = RUNNER_WITH.replace(",\n    skipEnv: 'HUSKY_SKIP_DIRECT_RUN_GUARD'", '')
  t('ST34 未注册 ⇒ 判"未接线"(不是判过)', wiringState('const CHECKS = []', 'check-direct-run-guard.mjs').wired === false)
  t('ST35 注册成套 ⇒ blocking + skipEnv 都在', (() => {
    const w = wiringState(RUNNER_WITH)
    return w.wired && w.missing.length === 0 && w.triggers === true
  })(), JSON.stringify(wiringState(RUNNER_WITH)))
  t('ST36 注册了而缺 skipEnv ⇒ 不完整(blocking 门没有自己的出口就是逼 --no-verify)', wiringState(RUNNER_NOENV).missing.length === 1, JSON.stringify(wiringState(RUNNER_NOENV)))
  t('ST37 runner 取不到 ⇒ 未接线而不是"已接线"', wiringState(null).wired === false)

  // 真仓面:判据对整族必须看得见(存量读数 > 0),否则就是尺子失明。
  let real = null
  try {
    real = analyze({ face: 'head', root: ROOT })
  } catch (e) {
    real = { error: e && e.message ? e.message : String(e) }
  }
  t(
    'ST38 真仓 HEAD 面:射程内枚举 > 100 且候选 > 0(扫描面在位)',
    real && real.error === undefined && real.counts.listed > 100 && real.counts.candidates > 0,
    real && real.error ? real.error : JSON.stringify(real && real.counts),
  )
  t(
    'ST39 真仓 HEAD 面:取不到面的根必须抛 Undetermined(不回落、不记绿)',
    (() => {
      try {
        analyze({ face: 'head', root: resolve(ROOT, '..', 'ihui-does-not-exist-' + process.pid) })
        return false
      } catch (e) {
        return e instanceof Undetermined
      }
    })(),
  )
  t(
    'ST40 两旗同给 ⇒ 用法错(selectFace 拦下)',
    selectFace({ staged: true, worktree: true }).error !== null,
  )

  const failed = cases.filter((c) => !c.ok)
  return {
    cases,
    failed,
    pass: cases.length - failed.length,
    fail: failed.length,
    total: cases.length,
  }
}

function argValue(argv, flag) {
  const i = argv.indexOf(flag)
  if (i < 0) return null
  return argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined
}

export async function main(argv = process.argv.slice(2)) {
  if (argv.includes('--self-test')) {
    const r = selfTest()
    for (const c of r.failed)
      console.log(`${C.red}❌ 自检 ${c.name}${c.extra ? ` —— ${c.extra}` : ''}${C.reset}`)
    console.log(`\n[direct-run-guard] 自检 例数 ${r.total} 通过 ${r.pass} 失败 ${r.fail}`)
    return r.fail > 0 ? 1 : 0
  }

  const sel = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  if (sel.error) {
    console.error(`${C.red}❌ ${sel.error}${C.reset}`)
    return 2
  }
  const rootArg = argValue(argv, '--root')
  if (rootArg === undefined) {
    console.error(`${C.red}❌ --root 需要一个目录实参${C.reset}`)
    return 2
  }
  const root = rootArg === null ? ROOT : resolve(rootArg)

  let a
  try {
    a = analyze({ face: sel.face, root })
  } catch (e) {
    console.error(`${C.red}❌ 无法判定(不冒红也不记绿,不回落另一个面):${e && e.message ? e.message : e}${C.reset}`)
    return 2
  }
  if (a.ledgerBroken) {
    console.error(`${C.red}❌ 无法判定:${a.ledgerBroken}${C.reset}`)
    return 2
  }
  const strict = argv.includes('--strict')
  const dead = enumerationVerdict({ listed: a.counts.listed, candidates: a.counts.candidates })

  const bad = a.violations.length + a.stale.length + a.expired.length + a.brokenLedger.length
  const faceLabel = a.face === 'worktree' ? '工作树(仅人工)' : a.face
  const summary = `[direct-run-guard] 判定面=${faceLabel}:命中 ${a.counts.hit}(本次新增 ${a.violations.length},存量 ${a.stock.length})/ 放过 ${a.counts.pass} / 未判定 ${a.counts.undetermined} / 不在射程 ${a.counts.noEntry} / 射程内枚举 ${a.counts.listed} / 台账豁免 ${a.exempted.length}`

  if (argv.includes('--json')) {
    // 机读档**只打这一份 JSON**(末行读数一并进 JSON.summary);掺一行散文就会把 JSON.parse 打断。
    console.log(
      JSON.stringify(
        {
          face: a.face,
          root: a.root,
          counts: a.counts,
          dead,
          rc: bad > 0 ? 1 : dead ? 2 : strict && a.counts.undetermined > 0 ? 2 : 0,
          summary,
          violations: a.violations,
          stock: a.stock,
          exempted: a.exempted,
          expired: a.expired,
          stale: a.stale,
          brokenLedger: a.brokenLedger,
          ledgerPresent: a.ledgerPresent,
          undetermined: a.judged.filter((j) => j.state === 'undetermined').map((j) => j.why),
        },
        null,
        2,
      ),
    )
  } else {
    const label = a.face === 'worktree' ? '工作树(仅人工,不得作为提交门禁)' : a.face
    console.log(`${C.cyan}[direct-run-guard] 判定面=${label} 根=${a.root}${C.reset}`)
    for (const v of a.violations)
      console.log(
        `  ${C.red}❌ ${v.rel}:${v.hits.map((h) => h.line).join(',')} ${v.why} —— §22d 补守卫(四行模板在文件末尾)${C.reset}`,
      )
    for (const s of a.brokenLedger) console.log(`  ${C.red}❌ 台账 ${LEDGER_FILE}:${s}${C.reset}`)
    for (const s of a.expired) console.log(`  ${C.red}❌ 豁免过期:${s}${C.reset}`)
    for (const s of a.stale) console.log(`  ${C.red}❌ 清单腐烂:台账登记了 ${s} 而被审面没有它的命中${C.reset}`)
    const und = a.judged.filter((j) => j.state === 'undetermined')
    for (const u of und.slice(0, LIST_CAP)) console.log(`  ${C.yellow}ℹ 未判定:${u.why}${C.reset}`)
    if (und.length > LIST_CAP) console.log(`  ${C.yellow}ℹ 另有 ${und.length - LIST_CAP} 条未判定(逐条点名被截断)${C.reset}`)
    for (const s of a.stock.slice(0, LIST_CAP))
      console.log(
        `  ${C.yellow}· 存量(只报数不判红):${s.rel} 命中 ${s.count}${s.forms.length ? `(守卫形态 ${s.forms.length} 种在别处,裸调用不在其块内)` : ''}${C.reset}`,
      )
    if (a.stock.length > LIST_CAP)
      console.log(`  ${C.yellow}· 存量另有 ${a.stock.length - LIST_CAP} 枚未逐条列出(--json 拿全量)${C.reset}`)
    if (!a.ledgerPresent)
      console.log(
        `${C.yellow}⚠ 台账 ${LEDGER_FILE} 不在被审面上 ⇒ 按"零豁免"判并大声报出(缺席不等于通过)。${C.reset}`,
      )
    if (dead) console.log(`${C.red}❌ ${dead} ⇒ 判死,不记绿${C.reset}`)
  }

  if (bad > 0 || dead) {
    if (!argv.includes('--json')) console.log(`${C.red}${summary}${C.reset}`)
  } else if (!argv.includes('--json')) console.log(`${C.green}${summary}${C.reset}`)
  if (bad > 0) return 1
  if (dead) return 2
  if (strict && a.counts.undetermined > 0) return 2
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}

export const __test__ = {
  judgeSource,
  topLevelMainCalls,
  guardFormsOf,
  mask: maskCommentsStringsAndRegex,
  maskLegacy: maskCommentsAndStrings,
  MASK_PROJECTIONS,
  readLedger,
  decide,
  analyze,
  listInScope,
  readFace,
  enumerationVerdict,
  wiringState,
  selfTest,
  main,
  inScope,
  GUARD_FORMS,
  BARE_MAIN_RE,
  MAIN_DEFINED_RE,
  MAX_FILE_CHARS,
  LEDGER_FILE,
  SCOPE_DIR,
  TEST_DIR,
  SELF,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
