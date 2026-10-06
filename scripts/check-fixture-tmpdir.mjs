#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门(G-284):§26「临时夹具唯一落点 = scripts/lib/scratch-dir.mjs」此前**只有散文**。
 * 散文对本仓不起作用这件事已经记过很多次了,而这一条连一次判据都没有:
 * `grep -rn "mkdtmpSync(join(tmpdir()" scripts/tests` 这一型(绕过落点直接用 os.tmpdir()/
 * mkdtempSync)回潮时**没有任何门会喊**,而它的具体代价 §26 写过两次 ——
 * 活进程的 TEMP 可能仍钉在 C 盘,于是"守门一路报绿、C 盘天天长 git 夹具"(实测单日 45 个)。
 *
 * 本票只做一件事:**把名单量出来**。不做批量改写 —— 现仓 scripts/tests/* 同时有 6 路代理在改,
 * 我去动别人的测试文件就是撞车(AGENTS §12 边界不变)。名单交主会话统一清。
 *
 * 判据:
 *   F1 代码面出现 `mkdtempSync(` 调用(含 `fs.mkdtempSync(`)⇒ 绕过唯一落点
 *   F2 代码面出现 `tmpdir(` 调用(含 `os.tmpdir()`)⇒ 选址交给进程 TEMP(§26 的第一条硬约束)
 *   F3(只报数,不计红)代码面 import 了 scratch-dir ⇒ 同一文件两种落点混用,迁移时的优先项
 *   N1(只报数)在仓库树内造夹具(`.ihui-agent/tmp`)—— 那是 §15 的另一型,不属本门红线
 *   L1(只报数)**落点已合规**的 mkdtempSync( —— 见下面「认落点那一段」
 *   M1(只报数)判据自身的镜像断言(唯一一条窄豁免,见 MIRROR_EXEMPT)
 *
 * ── 认落点,不只认关键字(2026-10-03 本票)─────────────────────────────
 * 上一版只认关键字,于是把 14 处**落点本来就合规**的写法判红(实测 worktree 面 15 处,
 * 逐条读码核实 14 处的落点已在 scratch 根或树内 `.ihui-agent/tmp` 内 —— 属 §15 的 N1 另一型)。
 * 关键字认不出落点,是因为落点写在**实参**里,而实参里的路径片段是**字符串**,
 * 在"注释与字符串都抹"的那一面已经被抹成空格。所以本门现在取**三面**:
 *   面 A `maskCommentsAndStrings` —— 判 F1/F2 命中(假阳防线:注释与字符串里的字样不算调用)
 *   面 B `maskComments`           —— **只**抹注释、留着字符串,用来读实参里的落点片段
 *   面 C 面 A 去掉行注释         —— 判 import(说明符是字符串,抹了等于把它抹掉)
 * 面 B 只在**面 A 已经判出真调用**之后才被读,且取实参用面 A 的括号配平(字符串里的
 * 括号在面 A 已被抹掉 ⇒ 配平不会跑偏),再把**同一段下标**切到面 B 上读内容 ——
 * 两面都等长,下标可互换是 code-mask 的硬约束。
 *
 * 落点合规的充要条件(三条都要,少一条都判红):
 *   ① 实参里出现一个**被认出的合规根**:`mkScratch(` / `scratchRoot()` / `TMP_ROOT` /
 *     `FIXTURE_BASE` / `tmpRoot` / 树内 `.ihui-agent/tmp` / `ihui-scratch`。
 *     `mkScratch`/`scratchRoot` 是**调用**,还要求本文件引用了 `scratch-dir.mjs`
 *     (认不出的调用不是落点);三个根**标识符**还要求在本文件里查得到 `const/let/var` 定义,
 *     且那个定义自身 TEMP-free 且落在合规标记上 —— **名字叫得合规不算,定义合规才算**。
 *   ② 实参里**没有任何进程 TEMP 来源**(`tmpdir(` / `TEMP` / `TMP` / `TMPDIR`)。
 *     这一条是假阳防线的镜像:否则 `mkdtempSync(join(os.tmpdir(), 'TMP_ROOT'))` 那种
 *     "字符串里写着合规根名字、真的落在 TEMP 上"的写法会被放过去。
 *   ③ 判据面仍是面 A —— 落点分析**只**在真调用上跑,注释与字符串里的 `mkdtempSync(`
 *     永远不会变成一次落点分析(那是 §「假阳防线」那条,本门第一次自跑就被自己的散文咬到)。
 *
 * 由此 **F2 永远违规这条一点没松**:面 A 里 `tmpdir(` 的实参就是"读 TEMP"这个动作本身,
 * 条件 ② 对它恒不成立 ⇒ F2 在构造上就过不去落点判据(不是靠一句特判)。
 * 唯一读 TEMP 而不判红的形态是 MIRROR_EXEMPT 那一条,而它是**判据自己的镜像断言**
 * (断言的正是 `chooseScratchRoot` 内部那行 `join(tmpdir(), SCRATCH_DIR_NAME)`;
 *  改断言侧就变成同一实现自证、恒真、什么也测不到)。它窄到**逐行**:命中那一行必须
 * 与它所声称的镜像断言同处一行,否则不豁免 —— 换个地方新写一个 tmpdir() 照样判红。
 *
 * 三态不并桶:
 *   · 默认档:**只报数并逐条报名**(file:line),退出码 0 —— 存量 30+ 个测试文件在红,
 *     当场 blocking 就是一台与任何提交都无关的恒红门,唯一结局是每台每次被逼 `--no-verify`,
 *     一次绕过约等于全部守门对该提交作废(§12e / 守门 77·83 同型)。
 *   · `--strict`:有 F1/F2 即 exit 1 —— 存量清零后才谈得上接提交链(前置条件写在这里,
 *     不得反过来"先接了再说")。
 *   · 取不到判定面 / 面上枚举到 0 个测试文件 ⇒ **exit 2 无法判定**,绝不记绿
 *     (空扫就是本门要防的那一型:守门 114「零测试文件不判绿」同一条)。
 *
 * 取材面纪律(守门 118 的口径,不是顺手):清单与内容**同面同轮** ——
 * 全量判 **HEAD blob**、`--staged` 判**索引 blob**、`--worktree` 只作人工逃生舱,
 * 两面旗同给 ⇒ exit 2;内容一律经 `lib/face-reader.mjs` 的 `catBatch`,不自己拼 `git show`。
 * 判 F1/F2 用**注释与字符串都抹**的那一面(说明判据的注释里写着 `mkdtempSync(` 不算违规,
 * 守门 131 第一次自跑就是被自己的解释文字咬到的);F3 判的是模块说明符,必须走
 * **保留字符串**的那一面(抹了字符串就等于把它抹掉 —— 守门 134 记过的"取源两面不能混")。
 *
 * 用法:node scripts/check-fixture-tmpdir.mjs [--strict] [--staged|--worktree] [--json]
 *                                            [--all] [--files a b] [--self-test]
 * 镜像测试:node --test scripts/tests/check-fixture-tmpdir.test.mjs
 * 紧急跳过:**两个名字都认** —— `HUSKY_SKIP_FIXTURE_TMPDIR=1`(注册块 `skipEnv:` 声明的那个)
 *   或 `HUSKY_SKIP_FIXTURE_TMPDIR_GUARD=1`(建门起代码就在读的旧名, 兼容保留)。
 *   本门此刻在注册表里的 mode 是 `'warn'`(存量未清零), 不是 blocking。
 *   ⚠️ 2026-10-06 修:此前注册块只声明 `HUSKY_SKIP_FIXTURE_TMPDIR` 而**代码零读点**
 *   (全仓 grep 只命中注册块那一行) ⇒ 照注册表设变量的人会被 runner 放行、门却照跑不误,
 *   即**一条写出来跑不通的出路**。现已让代码认下注册表声明的那个名字。
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { maskComments, maskCommentsAndStrings } from './lib/code-mask.mjs'
import { Undetermined, catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const GIT_TIMEOUT = 180_000
const HERE = dirname(fileURLToPath(import.meta.url))
// §15:ROOT 由脚本自身位置推导。`process.cwd()` 定根会让"扫哪棵树"随调用者站哪而变,
// 守门 70 的镜像测试 13/14 恒红就是这一型,由镜像测试反向锁住。
const ROOT = resolve(HERE, '..')

// 射程 = scripts/ 顶层 .mjs + scripts/tests/ 一层 .mjs(2026-09-28 扩面:此前只扫 tests,
// 而 --self-test 走 os.tmpdir() 的重灾区恰恰在 scripts/ 顶层的守门脚本里)。
// scripts/lib/ 刻意排除:落点与 plumbing 住在 lib 是**对的**(scratch-dir 自己当然 mkdtempSync)。
const SELF_EXEMPT = ['scripts/tests/check-fixture-tmpdir.test.mjs']
// 判据自身的镜像断言豁免(全仓**唯一**一条,窄到逐行):scratch-dir.test.mjs 有一行断言的正是
// scratch-dir.mjs 内部那行 `return normalize(join(tmpdir(), SCRATCH_DIR_NAME))` —— 断言的是
// **本门判据的落点定义本身**。改断言侧就变成同一实现自证、恒真、什么也测不到;
// 不改它就得让本门对自己的判据判红。所以给它一条豁免,但必须同时满足三条,少一条即失效:
//   ① 文件精确匹配(不是目录、不是通配);
//   ② `line` 精确匹配那一行(行号漂了 ⇒ 失效,逼着人来更新而不是让条目默默罩住整个文件);
//   ③ `anchor` 那一行上必须真的出现所声称的镜像断言字样 —— 否则"这一行恰好有 tmpdir("就
//      成了永久免罪符,那一行被改成读 TEMP 的真实动作时门会继续装看不见。
// 形如"名字合规/看起来像豁免"的宽免一律不许进来:这三条是它的全部。
const MIRROR_EXEMPT = [
  {
    file: 'scripts/tests/scratch-dir.test.mjs',
    line: 377,
    kind: 'F2',
    anchor: 'SCRATCH_DIR_NAME',
    reason:
      '这一行断言的正是 scratch-dir.mjs:72 `return normalize(join(tmpdir(), SCRATCH_DIR_NAME))` —— 判据自身的落点定义。改断言侧即变成同一实现自证(恒真、什么也测不到),不改则本门对自己的判据判红。',
  },
]

/**
 * 纯函数:镜像断言豁免是否覆盖某一处命中。
 * 四条都要对(文件 / 行号 / kind / **该行确有 anchor 字样**)才返回豁免条目,否则 null(= 不豁免,照计违规)。
 * anchor 必须拿**真实那一行**来验:只凭"文件+行号"就放过,那一行被改成真的读 TEMP 之后
 * 门会继续装看不见 —— 那是"名单代替判据"的最低形态。行号漂了同样失效(逼着人更新条目)。
 * 刻意**不**复用台账:applyLedger 的语义是"该文件剩余违规整文件豁免",而这一条是**逐行**的 ——
 * 同一个文件里新写的 tmpdir( 必须照样判红,整文件豁免会把它一起放过去。
 *
 * @param {{line:number,kind:string}} hit
 * @param {string} path 被审文件路径
 * @param {string} lineText 该命中的**真实源码行**(anchor 就验在这里)
 * @param {Array} table 豁免表(默认 MIRROR_EXEMPT;自测传构造表)
 */
export function mirrorExemptFor(hit, path, lineText = '', table = MIRROR_EXEMPT) {
  for (const e of table) {
    if (e.file !== path) continue
    if (e.line !== hit.line) continue
    if (e.kind !== hit.kind) continue
    if (!e.anchor || !lineText.includes(e.anchor)) continue
    return e
  }
  return null
}

// B 堆台账(带理由 + 到期日,仿 auth-handler-registration-exemptions.json 的形态):
// 唯一豁免通道。每条必须 {file, reason(非空), reviewBy(ISO 日期)};过期条目不再豁免;
// 条目指向已无命中的文件 ⇒ 清单腐烂(rot)判红 —— 豁免清单腐烂比没有清单更糟。
const LEDGER_FILE = 'scripts/fixture-tmpdir-exemptions.json'
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const CALLEE_RE = /\bmkdtempSync\s*\(/g
const TMPDIR_RE = /\btmpdir\s*\(/g
// 说明符面(保留字符串)才看得见 import 来自哪里
const WIRED_RE = /from\s+['"][^'"]*lib\/scratch-dir\.mjs['"]/
// 仓库树内造夹具(§15 的另一型):这是字符串形态,只能在"只丢注释行"的面上判。
// 两种书写都要认:拼路径 `'.ihui-agent/tmp'` 与分段 `'.ihui-agent', 'tmp'`(真仓实测以后者为主)。
const IN_REPO_SRC = `\\.ihui-agent[\\\\/]tmp|['"]\\.ihui-agent['"]\\s*,\\s*['"]tmp['"]`
const IN_REPO_RE = new RegExp(IN_REPO_SRC, 'g')
// ── 认落点用的判据(见头注「认落点,不只认关键字」那一段)──
// ① 合规根标记。`mkScratch(` / `scratchRoot()` 是**调用**,另需本文件引用了 scratch-dir.mjs
//    (check-ops-patrol.test.mjs 走的是 `await import(...)` 动态形态,不是 `from '...'`);
//    `TMP_ROOT` / `FIXTURE_BASE` / `tmpRoot` 是**标识符**,另需在本文件里查得到定义且定义自身合规。
const ROOT_CALL_RE = /\b(?:mkScratch|scratchRoot)\s*\(/
const ROOT_NAME_RE = /\b(?:TMP_ROOT|FIXTURE_BASE|tmpRoot)\b/
const SCRATCH_NAME_RE = /\bihui-scratch\b/
// 本文件是否引用了 scratch-dir.mjs(长度不变的要求在这里不成立:只用来"问一句",不做下标换算)
const REF_SCRATCH_RE = /scratch-dir\.mjs/
// ② 进程 TEMP 来源。**任何**出现都判红 —— 这一条是"落点合规"的镜像防线:
//    没有它,`mkdtempSync(join(os.tmpdir(), 'TMP_ROOT'))` 那种"字符串里写着合规根名字、
//    真的落在 TEMP 上"的写法会被放过去(名字合规不等于落点合规)。
//    `\bTMP\b` 认不出 `TMP_ROOT`(`_` 是词字符 ⇒ 无词边界)—— 这是有意的,见 ① 的标识符分支。
// ⚠ 下面两条**刻意不带 `g`**:它们走的是 `RegExp.prototype.test`,而带 `g` 的 test/test 交替调用
//   会因 `lastIndex` 残留而时真时假 —— 判据"看起来在跑"但结论随调用次数漂移,是最难归因的一型。
//   要枚举全部命中时另建带 `g` 的副本(`gOf`),不在这两条上加旗标。
const TEMP_SRC_RE = /\btmpdir\s*\(|\bTEMP\b|\bTMPDIR\b|\bTMP\b/
/** 带 `g` 的副本,只在真要枚举全部命中时用(matchAll 对非全局正则会抛)。 */
const gOf = (re) => new RegExp(re.source, re.flags + 'g')
// 判"本文件里有没有 `const/let/var NAME =` 这个定义"。**必须**在面 A(字符串已抹)上找 ——
// 否则一个字符串字面量 `'const TMP_ROOT = ...'` 就能冒充定义。
const DEF_RE_CACHE = new Map()
function defRe(name) {
  let re = DEF_RE_CACHE.get(name)
  if (!re) {
    re = new RegExp(`(?:const|let|var)\\s+${name}\\s*=`, 'g')
    DEF_RE_CACHE.set(name, re)
  }
  re.lastIndex = 0
  return re
}
// 标识符解析的深度上限:防 `const A = join(B, …)` 互相引用成环。超过上限 ⇒ 不认 ⇒ 判红。
const RESOLVE_MAX_DEPTH = 4

/**
 * 取 `code` 上 `from` 起的一段**表达式**文本的结束下标(不含)。
 * 括号配平走面 A ⇒ 字符串/注释里的括号已被抹成空格,配平不会跑偏;深度回零或行尾(有内容时)即止。
 * 找不到 ⇒ 返回 -1(调用方据此判"读不到实参" ⇒ 不认落点 ⇒ 判红,方向是保守的)。
 */
function exprEnd(code, from) {
  let depth = 0
  let seen = false
  for (let i = from; i < code.length; i++) {
    const c = code[i]
    if (c === '(' || c === '[' || c === '{') {
      depth += 1
      seen = true
      continue
    }
    if (c === ')' || c === ']' || c === '}') {
      if (depth === 0) return seen ? i : -1
      depth -= 1
      if (depth === 0) return i + 1
      continue
    }
    if (depth === 0) {
      if (c === ';') return i
      if (c === '\n') {
        if (seen) return i
        continue
      }
      if (!/\s/.test(c)) seen = true
    }
  }
  return seen ? code.length : -1
}

/**
 * 一段落点文本(实参或定义 initializer)是否合规。**纯函数**,三条判据都在这里:
 *   ① 有合规根标记:调用型(`mkScratch(`/`scratchRoot()`)另需本文件引用 scratch-dir.mjs;
 *      标识符型(TMP_ROOT/FIXTURE_BASE/tmpRoot)另需在本文件里解析到**自身也合规**的定义;
 *      树内 `.ihui-agent/tmp` 与 `ihui-scratch` 是字面证据,直接认。
 *   ② 全文没有任何进程 TEMP 来源。
 *   读的是"抹注释、留字符串"的内容面 ⇒ 注释里的字样既不能造合规根、也不能造 TEMP 证据。
 *
 * @param src **本文件全文**(不是片段):解析根标识符的定义要在全文里找 `const NAME =`,
 *   而那条定义的下标是从全文那一面算出来的。传片段会让递归拿全文下标去切片段 —— 错位,
 *   而且错位方向恰好是"解析不出定义 ⇒ 判红",让本该绿的落点一直红着(本票第一版的真 bug:
 *   5 处合规落点只绿了 2 处,根因就是这里)。
 * @param from,to 待判段落在这份全文里的下标区间(半开)。
 * @returns {{ok: boolean, why: string}} why 只用于报告/自测定位,判据本身只看 ok。
 */
export function landingVerdict({ src, code, from, to, refsScratch, depth = 0 }) {
  const text = maskComments(src.slice(from, to))
  if (TEMP_SRC_RE.test(text))
    return {
      ok: false,
      why: `实参里含进程 TEMP 来源(${[...text.matchAll(gOf(TEMP_SRC_RE))].map((m) => m[0]).join(',')})`,
    }
  const hasCall = ROOT_CALL_RE.test(text)
  const hasName = ROOT_NAME_RE.test(text)
  const inRepo = new RegExp(IN_REPO_SRC).test(text)
  const hasLit = inRepo || SCRATCH_NAME_RE.test(text)
  if (!hasCall && !hasName && !hasLit)
    return { ok: false, why: '实参里没有任何合规根标记(mkScratch/scratchRoot/TMP_ROOT/FIXTURE_BASE/tmpRoot/.ihui-agent/tmp/ihui-scratch)' }
  if (hasCall && !refsScratch)
    return { ok: false, why: '实参里的 mkScratch(/scratchRoot( 认不出出处:本文件没有引用 scratch-dir.mjs' }
  if (hasName && depth < RESOLVE_MAX_DEPTH) {
    // 名字合规**不算**合规 —— 必须在本文件里解析到定义,且那个定义自身合规。
    // 解析不出来 / 解析到的定义不合规 ⇒ 判红(方向保守:宁可多报)。
    const names = [...text.matchAll(gOf(ROOT_NAME_RE))].map((m) => m[0])
    const resolved = []
    for (const nm of names) {
      const m = defRe(nm).exec(code)
      if (!m) return { ok: false, why: `${nm} 在本文件里查不到定义 —— 名字合规不等于落点合规` }
      const dFrom = m.index + m[0].length
      const dTo = exprEnd(code, dFrom)
      if (dTo < 0) return { ok: false, why: `${nm} 的定义读不出取值` }
      const sub = landingVerdict({ src, code, from: dFrom, to: dTo, refsScratch, depth: depth + 1 })
      if (!sub.ok) return { ok: false, why: `${nm} 的定义不合规:${sub.why}` }
      resolved.push(nm)
    }
    return { ok: true, why: `合规根标识符 ${resolved.join('/')} 在本文件内的定义自身合规` }
  }
  if (hasCall) return { ok: true, why: '实参落在 mkScratch(/scratchRoot( 基座内(本文件已引用 scratch-dir.mjs)' }
  if (inRepo) return { ok: true, why: '实参落在仓库树内 .ihui-agent/tmp(§15 的 N1 另一型)' }
  return { ok: true, why: '实参落在 ihui-scratch 夹具根内' }
}


/** 按字符下标反查行号(遮罩是等长的,所以行号与原文一致 —— 这是用等长遮罩的全部理由)。 */
function lineOf(text, index) {
  let line = 1
  for (let i = 0; i < index; i++) if (text[i] === '\n') line += 1
  return line
}

/**
 * 逐处收集命中并反查行号。
 * ⚠ 这里的 `g` 归一是**必需的护栏**,不是风格:判据正则一旦漏写 `g`,`exec` 循环会
 * 拿到同一个匹配无限转本门(第一版就是这么挂在自检里的 —— 现象是"卡住"而不是"报错",
 * 最难归因的那一型)。所以在此兜一道,而不是指望下一个人记得加旗标。
 */
function collect(text, re) {
  const g = re.global ? re : new RegExp(re.source, re.flags + 'g')
  g.lastIndex = 0
  const hits = []
  let m
  while ((m = g.exec(text)) !== null) {
    // index 必须带出来:落点判据要在**这一处**往后取实参边界(不能用行号回溯 ——
    // 一次调用跨行时行号会指错地方,而跨行实参在本仓是实形态,见 heal-worktree-tracked)。
    hits.push({ line: lineOf(text, m.index), index: m.index, match: m[0].trim() })
    if (m.index === g.lastIndex) g.lastIndex += 1
  }
  return hits
}

/**
 * 纯函数:给定一份测试文件正文,产出本门的判据输入。
 * 拆出来是因为这几面必须**分别**取料:调用判"遮掉字符串之后"、落点判"只遮掉注释之后"、
 * import 判"只丢注释行"。混用 Either 会让锁恒真或恒假(守门 134 记过)。
 *
 * 落点判据(L1)对**每个 F1 命中**问一次"实参落在合规根上吗",落在合规根上 ⇒ 不计红线,
 * 只报数。落点判据只在**面 A 已经判出真调用**之后才跑(注释/字符串里的字样永远走不到这里,
 * 假阳防线因此不受影响),实参边界用面 A 的括号配平取,内容用同下标切到"抹注释留字符串"面上读
 * —— 两面等长是 code-mask 的硬约束,下标可互换。
 */
export function scanFixtureText(text, path = '') {
  if (typeof text !== 'string')
    return { hits: [], notices: [], wired: false, undetermined: '输入不是文本' }
  const code = maskCommentsAndStrings(text)
  const commentless = text
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n')
  // 落点面:只抹注释、**留字符串**。读实参里的路径片段必须用它(`.ihui-agent` 那些字面量
  // 在面 A 上已经被抹成空格了)。注意它对行注释是**整段删除**而不是等长抹除 ⇒ 不等长,
  // 所以它只用于"问一句这段落点合不合规",绝不参与下标换算(要换算的只有面 A 的括号配平)。
  const refsScratch = REF_SCRATCH_RE.test(maskComments(commentless))
  const hits = []
  const notices = []
  for (const h of collect(code, CALLEE_RE)) {
    const open = code.indexOf('(', h.index)
    const end = exprEnd(code, open + 1)
    const v =
      end < 0
        ? { ok: false, why: '实参括号读不到边界' }
        : landingVerdict({ src: text, code, from: open + 1, to: end, refsScratch })
    if (v.ok) notices.push({ ...h, kind: 'L1', match: v.why })
    else hits.push({ ...h, kind: 'F1' })
  }
  // F2 照旧**永远**计违规:面 A 里 `tmpdir(` 的实参就是"读 TEMP"这个动作本身,
  // landingVerdict 的第 ② 条(TEMP 来源恒否决)对它恒不成立 ⇒ 不给 F2 开落点后门。
  // 唯一例外是判据自身的镜像断言(逐行豁免,见 MIRROR_EXEMPT),且它必须**报出来**
  // (M1 只报数)而不是静默消失 —— 静默豁免与漏判在输出里同形。
  for (const h of collect(code, TMPDIR_RE)) {
    // ⚠ kind 必须**在这里**补上再问豁免:`collect` 只产出 {line,index,match},kind 是判据
    // 走到这一步才贴的 —— 漏了它 `e.kind !== hit.kind` 会恒真,于是镜像断言豁免永不生效
    // (而它"永不生效"表现为照判红,所以第一眼看上去像判据在正常工作)。
    const f2 = { ...h, kind: 'F2' }
    const e = mirrorExemptFor(f2, path, text.split('\n')[f2.line - 1] ?? '')
    if (e) notices.push({ ...f2, kind: 'M1', match: `镜像断言豁免:${e.reason}` })
    else hits.push(f2)
  }
  for (const h of collect(commentless, IN_REPO_RE)) notices.push({ ...h, kind: 'N1' })
  return { hits: hits.sort((a, b) => a.line - b.line), notices, wired: WIRED_RE.test(commentless) }
}


function inScope(p) {
  if (!/\.mjs$/.test(p)) return false
  if (p.startsWith('scripts/lib/')) return false
  if (/(?:^|\/)(?:__snapshots__|node_modules|fixtures)\//.test(p)) return false
  if (SELF_EXEMPT.includes(p)) return false
  const segs = p.split('/')
  if (segs[0] !== 'scripts') return false
  // scripts/ 顶层 或 scripts/tests/ 一层;更深的子目录不在射程(现读无夹具落在那儿,
  // 且再扩面会把 plumbing 的藏身处也扫进来 —— 扩面必须同批改两半,这里先窄后宽)。
  if (segs.length === 2) return true
  if (segs.length === 3 && segs[1] === 'tests') return true
  return false
}

/**
 * 台账条目是否"形态合法":file 非空 + reason 非空 + reviewBy 是 ISO 日期。
 * 返回问题描述(null = 合法)。到期与否单独判(合法但过期 ⇒ 豁免失效,不是形态坏)。
 */
export function entryProblem(entry, today) {
  if (!entry || typeof entry !== 'object') return '条目不是对象'
  if (typeof entry.file !== 'string' || !entry.file.trim()) return 'file 缺失/为空'
  if (typeof entry.reason !== 'string' || !entry.reason.trim()) return 'reason 缺失/为空(裸白名单不算豁免)'
  if (typeof entry.reviewBy !== 'string' || !ISO_DATE.test(entry.reviewBy))
    return 'reviewBy 缺失或非 ISO 日期'
  if (entry.reviewBy < today) return `已过期(reviewBy=${entry.reviewBy} < ${today})`
  return null
}

/**
 * 纯函数:对单个被审文件施加"接线豁免 + 台账"两条放过通道,产出本门对该文件的结论。
 * 规则(与票面逐字对应):
 *  · F2(tmpdir() 调用)**永远**计违规 —— os.tmpdir() 是 §26 第一条硬约束,接线不等于迁完;
 *  · F1(mkdtempSync() 调用)只在**该文件没 import scratch-dir** 时计违规 ——
 *    已接线的文件在 mkScratch 基座内造子夹具(check-gate-wiring 的真实形态)不配判红;
 *  · 台账条目合法(带理由未过期)⇒ 该文件剩余违规整文件豁免(豁免的是"读 TEMP 的正当用途",
 *    不是"忘了迁的夹具" —— 所以逐条 reason 是判据的一部分,不是形式);
 *  · 台账条目过期/形态坏 ⇒ 不豁免,且把问题点名(它同时把该文件的违规照计);
 *  · 台账条目指向**当前面上没有任何原始命中**的文件 ⇒ 清单腐烂 rot —— 修好了就把行删掉,
 *    挂着腐烂的行会替后来人做出"这一端已被想过"的判断。
 * 返回 { violations, rawHits, exempted, problem, rot }。
 */
export function applyLedger({ wired, rawHits, entry, today }) {
  const violations = rawHits.filter((h) => !(h.kind === 'F1' && wired))
  if (!entry) return { violations, rawHits, exempted: 0, problem: null, rot: false }
  const problem = entryProblem(entry, today)
  if (problem) {
    // 条目坏/过期:不豁免;rot 只在"确实没东西可豁免"时才是腐烂,过期而有命中 = 待清偿的账,
    // 两种都通过 problem 点名,不混计。
    return { violations, rawHits, exempted: 0, problem, rot: rawHits.length === 0 }
  }
  if (rawHits.length === 0) return { violations, rawHits, exempted: 0, problem, rot: true }
  return { violations: [], rawHits, exempted: violations.length + (rawHits.length - violations.length), problem, rot: false }
}

/**
 * 台账必须**从被审面**读(与其余取材同一档),过去 `run()` 从不加载它 —— 于是那份
 * `scripts/fixture-tmpdir-exemptions.json` 对现读读数零影响,账面却读起来像"豁免已生效"
 * (本仓把这一型叫半接线:函数在、自检过、调用点没接 —— 守门 70/76/81/115 同族)。
 * 三态:文件不在该面上 ⇒ 零豁免并大声报出(缺席不等于通过);JSON 解析失败 ⇒ 判"无法判定"
 * (坏清单静默当空清单 = 把"没判"写成"判过了");正常 ⇒ 按 file 建索引。
 */
function loadLedger(face) {
  const got = readFace([LEDGER_FILE], face).get(LEDGER_FILE)
  if (got === null || got === undefined) return { byPath: new Map(), absent: true }
  let parsed
  try {
    parsed = JSON.parse(got)
  } catch (e) {
    throw new Undetermined(`${LEDGER_FILE} 不是合法 JSON:${e.message}(坏台账不得当"无豁免"静默放过)`)
  }
  const list = Array.isArray(parsed && parsed.exemptions) ? parsed.exemptions : []
  const byPath = new Map()
  for (const en of list) if (en && typeof en.file === 'string') byPath.set(en.file, en)
  return { byPath, absent: false }
}

function todayIso(now = new Date()) {
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

function listFacePaths(face) {
  if (face === 'head')
    return gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '-z'], ROOT, { timeout: GIT_TIMEOUT })
      .split('\0')
      .filter(Boolean)
  if (face === 'staged')
    return gitRaw(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], ROOT, {
      timeout: GIT_TIMEOUT,
    })
      .split('\0')
      .filter(Boolean)
  return gitRaw(['ls-files', '-z'], ROOT, { timeout: GIT_TIMEOUT }).split('\0').filter(Boolean)
}

function readFace(paths, face) {
  if (!paths.length) return new Map()
  if (face === 'worktree') {
    return new Map(paths.map((p) => [p, readWorktreeFile(ROOT, p)]))
  }
  const rev = face === 'staged' ? '' : 'HEAD'
  const specs = paths.map((p) => `${rev}:${p}`)
  const got = catBatch(ROOT, specs, { maxBuffer: 1 << 29, timeout: GIT_TIMEOUT })
  return new Map(paths.map((p, i) => [p, got.get(specs[i]) ?? null]))
}

/**
 * 纯函数:退出码聚合。次序刻意 ——
 *  ① 一个被审文件都没枚举到 ⇒ 判死(空扫不是"干净",守门 114 同一条);
 *  ② 面上有文件取不到 ⇒ 判死(把"没读到"写成"没问题"是本仓最高频失效型);
 *  ③ 台账腐烂(rot>0)⇒ **任何档都判红** —— 它不是存量,是一条挂着的豁免行已经不指向任何
 *    被审对象;留着它等于替后来人做出"这一端已被想过"的判断(豁免清单腐烂比没有清单更糟);
 *  ④ 有违规且 --strict ⇒ 1;⑤ 其余 0(默认档对**存量违规永远** 0,这是票面定级不是疏忽)。
 */
export function decide({ listed, unreadable, violations, rotations, strict }) {
  if (listed === 0) return { code: 2, kind: 'empty-scan' }
  if (unreadable > 0) return { code: 2, kind: 'undetermined' }
  if ((rotations || 0) > 0) return { code: 1, kind: 'ledger-rot' }
  if (violations > 0 && strict) return { code: 1, kind: 'violation' }
  if (violations > 0) return { code: 0, kind: 'report-only' }
  return { code: 0, kind: 'clean' }
}

export function formatReport(perFile, verdict, opts = {}) {
  const out = []
  const bad = perFile.filter((f) => f.hits.length > 0)
  const totalHits = bad.reduce((a, f) => a + f.hits.length, 0)
  const exempted = perFile.reduce((a, f) => a + (f.exempted || 0), 0)
  const rots = perFile.filter((f) => f.rot)
  const problems = perFile.filter((f) => f.problem)
  out.push(
    `[fixture-tmpdir] 判定面=${opts.face || '?'} 射程内被审文件 ${perFile.length} 个;绕过 scratch-dir 的落点 ${totalHits} 处 / ${bad.length} 文件(台账豁免 ${exempted} 处)`,
  )
  if (opts.ledgerAbsent) {
    out.push(
      `⚠ 台账 ${LEDGER_FILE} 在被审面上不存在 ⇒ 按"零豁免"判并**大声报出**(缺席不等于通过;只躺在工作区没入库的行不算台账)。`,
    )
  }
  if (totalHits === 0 && rots.length === 0 && problems.length === 0) {
    // "已闭合"这句话必须带上台账是否真被读过:台账缺席时 0 处的含义是"没扫到违规",
    // 而不是"豁免口径复核过了"—— 两者混成一句就是"把没判写成判过了"(本仓最高频失效型)。
    out.push(
      opts.ledgerAbsent
        ? '✅ 射程内没有 F1/F2(注:本轮台账未加载 ⇒ 只证明"没扫到违规",不证明"豁免口径已复核")。'
        : '✅ 射程内没有 F1/F2(§26 唯一落点这一维已闭合,台账已按被审面加载)。',
    )
  } else if (totalHits > 0) {
    out.push(
      '  F1 = mkdtempSync( 调用(该文件未 import scratch-dir 才计红)· F2 = tmpdir( 调用(接线也照计)。',
    )
    for (const f of bad) {
      out.push(
        `  ${f.path}${f.wired ? '  [F3 同一文件已 import scratch-dir ⇒ 两种落点混用,优先迁]' : ''}`,
      )
      for (const h of f.hits) out.push(`      ${h.line}: ${h.kind} ${h.match}`)
    }
    out.push(
      "  修复出口(唯一一条):改成 import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'",
    )
    out.push('  不得做的事:为让这一档变绿去放宽判据、把名字加进 SELF_EXEMPT、或在测试里自行拼')
    out.push('  DevEnv/Temp 路径 —— 那等于把本门存在的理由抹掉。')
  }
  for (const f of problems) {
    out.push(`  ❌ 台账问题:${f.path} —— ${f.problem}${f.rot ? '(且该文件已无命中 ⇒ rot)' : ''}`)
  }
  for (const f of rots.filter((x) => !x.problem)) {
    out.push(`  ❌ 清单腐烂:${f.path} 在台账挂着但被审面上已无 F1/F2 命中 ⇒ 删行(修好了就摘牌)`)
  }
  const notices = perFile.reduce((a, f) => a + f.notices.length, 0)
  const byKind = (k) =>
    perFile.reduce((a, f) => a + f.notices.filter((n) => n.kind === k).length, 0)
  if (notices > 0) {
    const parts = []
    if (byKind('N1')) parts.push(`N1 ${byKind('N1')} 处在仓库树内造夹具(§15 的另一型,不在本门红线内)`)
    if (byKind('L1')) parts.push(`L1 ${byKind('L1')} 处落点已在合规根内(认落点判据放行,不是漏判)`)
    if (byKind('M1')) parts.push(`M1 ${byKind('M1')} 处判据自身的镜像断言(MIRROR_EXEMPT 逐行豁免)`)
    out.push(`ℹ 只报数:${notices} 处 —— ${parts.join(';')}。`)
    if (opts.all) {
      for (const f of perFile)
        for (const n of f.notices) out.push(`      ${f.path}:${n.line} ${n.kind} ${n.match}`)
    }
  }
  out.push(`结论:${verdict.kind}(退出码 ${verdict.code})`)
  return out
}

function selfTest() {
  let fails = 0
  const check = (name, cond) => {
    console.log(`${cond ? '✅' : '❌'} ${name}`)
    if (!cond) fails += 1
  }
  const POS = `import { mkdtempSync } from 'node:fs'\nimport os from 'node:os'\nconst d = mkdtempSync(os.tmpdir())\n`
  const r1 = scanFixtureText(POS)
  check(
    '阳性对照:真调用必须命中 F1 与 F2',
    r1.hits.some((h) => h.kind === 'F1') && r1.hits.some((h) => h.kind === 'F2'),
  )
  check(
    '行号点名(报告要能直接跳过去)',
    r1.hits.every((h) => h.line === 3),
  )

  // 反向对照:同一批字样只出现在注释/字符串里 ⇒ 不得计入违规。
  // 这条是整个判据的假阳防线 —— 守门 131 第一次自跑就是被自己的解释文字咬到的。
  const NEG = `// 禁止 mkdtempSync(os.tmpdir()) 这一型\nconst hint = 'mkdtempSync( 是旧写法'\nexport const x = 1\n`
  const r2 = scanFixtureText(NEG)
  check('注释与字符串里的同一批字样不得计入违规', r2.hits.length === 0)

  // import 形态:说明符是字符串,所以 F3 必须走"保留字符串"的那一面 ——
  // 拿遮罩面判 wired 会恒 false,于是"同一文件两种落点"永远报不出来。
  const WIRED = `import { mkScratch } from '../lib/scratch-dir.mjs'\nmkdirSync(join(os.tmpdir(), 'x'))\n`
  const r3 = scanFixtureText(WIRED)
  check('F3 认得出本文件已 import scratch-dir(说明符面判,不是遮罩面)', r3.wired === true)
  check(
    '同一文件已接线却仍在用 tmpdir ⇒ F2 照计(接线不等于迁完)',
    r3.hits.some((h) => h.kind === 'F2'),
  )

  const NOTWIRED = `import { mkScratch } from '../lib/other.mjs'\nexport const y = 2\n`
  check('别的说明符不得被读成已接线', scanFixtureText(NOTWIRED).wired === false)

  const REPO = `const p = join('.ihui-agent', 'tmp', 'x')\n// '.ihui-agent/tmp' 在注释里不算\n`
  const r4 = scanFixtureText(REPO)
  check('仓库树内夹具只进"只报数"(N1),不计红线', r4.hits.length === 0 && r4.notices.length >= 1)

  // 三态退出码:构造面即验,不赌本机有什么在飞
  check(
    '枚举到 0 个被审文件 ⇒ exit 2(空扫不是干净)',
    decide({ listed: 0, unreadable: 0, violations: 0, rotations: 0, strict: false }).code === 2,
  )
  check(
    '面上有文件取不到 ⇒ exit 2,不记绿',
    decide({ listed: 5, unreadable: 1, violations: 0, rotations: 0, strict: true }).code === 2,
  )
  check(
    '有违规 + 默认档 ⇒ exit 0(只报数,票面定级)',
    decide({ listed: 5, unreadable: 0, violations: 3, rotations: 0, strict: false }).code === 0,
  )
  check(
    '有违规 + --strict ⇒ exit 1',
    decide({ listed: 5, unreadable: 0, violations: 3, rotations: 0, strict: true }).code === 1,
  )
  check(
    '无违规 ⇒ exit 0',
    decide({ listed: 5, unreadable: 0, violations: 0, rotations: 0, strict: true }).code === 0,
  )
  check(
    '台账腐烂(rot)⇒ 任何档都 exit 1 —— 它不是存量,是一条挂着的行已经不指向任何被审对象',
    decide({ listed: 5, unreadable: 0, violations: 0, rotations: 1, strict: false }).code === 1,
  )

  // ── A/B 两堆与台账的成对正反例(票面第 3 步要求的四条)──
  const TODAY = '2026-09-28'
  // ① A 堆形态:未接线的 mkdtempSync 夹具 ⇒ 计违规,strict 判红
  const aHits = scanFixtureText(`const d = require('fs').mkdtempSync('x')\n`).hits
  const aRes = applyLedger({ wired: false, rawHits: aHits, entry: null, today: TODAY })
  check(
    'A 堆(未接线 mkdtempSync)⇒ 计违规',
    aRes.violations.length === 1 &&
      decide({ listed: 1, unreadable: 0, violations: 1, rotations: 0, strict: true }).code === 1,
  )
  // ② B 堆带理由 + 未过期 ⇒ 整文件豁免,判绿
  const bText = `import { tmpdir } from 'node:os'\nconst dirs = tempScanDirs(root, tmpdir())\n`
  const bRaw = scanFixtureText(bText)
  const bRes = applyLedger({
    wired: bRaw.wired,
    rawHits: bRaw.hits,
    entry: { file: 'scripts/x.mjs', reason: '判 TEMP 漂移必须读活 TEMP', reviewBy: '2099-01-01' },
    today: TODAY,
  })
  check('B 堆带理由 + 未过期 ⇒ 豁免生效(不计违规不记 rot)', bRes.violations.length === 0 && !bRes.rot && !bRes.problem && bRes.exempted > 0)
  // ③ 登记表过期 ⇒ 不再豁免,照计违规 + problem 点名
  const cRes = applyLedger({
    wired: false,
    rawHits: bRaw.hits,
    entry: { file: 'scripts/x.mjs', reason: '同样正当但到期了', reviewBy: '2020-01-01' },
    today: TODAY,
  })
  check(
    '登记表过期 ⇒ 豁免失效照计违规,且 problem 点名',
    cRes.violations.length > 0 && /过期/.test(cRes.problem || ''),
  )
  // ③b 裸白名单(无 reason)不算豁免
  const dRes = applyLedger({
    wired: false,
    rawHits: bRaw.hits,
    entry: { file: 'scripts/x.mjs', reviewBy: '2099-01-01' },
    today: TODAY,
  })
  check('台账条目缺 reason ⇒ 形态坏,不豁免', dRes.violations.length > 0 && !!dRes.problem)
  // ④ 台账指向已无命中的文件 ⇒ rot(与"过期而有命中"分桶)
  const eRes = applyLedger({
    wired: false,
    rawHits: [],
    entry: { file: 'scripts/gone.mjs', reason: '早就迁完了', reviewBy: '2099-01-01' },
    today: TODAY,
  })
  check('台账指向零命中文件 ⇒ rot', eRes.rot === true)
  // ⑤ 已接线文件的 mkdtempSync 不配判红(它在 mkScratch 基座内造子夹具);tmpdir 照计
  const fRes = applyLedger({
    wired: true,
    rawHits: scanFixtureText(`import { mkScratch } from '../lib/scratch-dir.mjs'\nmkdtempSync(join(base, 'repo-'))\n`).hits,
    entry: null,
    today: TODAY,
  })
  check('已接线文件的 mkdtempSync(基座内子夹具)不计违规', fRes.violations.length === 0)
  const gRes = applyLedger({
    wired: true,
    rawHits: scanFixtureText(`import { mkScratch } from '../lib/scratch-dir.mjs'\nmkdirSync(join(tmpdir(), 'x'))\n`).hits,
    entry: null,
    today: TODAY,
  })
  check('已接线文件的 tmpdir 仍计违规(接线不等于迁完)', gRes.violations.length > 0)

  // 默认档**永远**不因存量判红:把这条钉成报告文本的断言,而不是只钉 decide
  const perFile = [
    {
      path: 'scripts/tests/a.test.mjs',
      hits: [{ line: 3, kind: 'F1', match: 'mkdtempSync(' }],
      notices: [],
      wired: false,
      exempted: 0,
      problem: null,
      rot: false,
    },
  ]
  const rep = formatReport(
    perFile,
    decide({ listed: 1, unreadable: 0, violations: 1, rotations: 0, strict: false }),
    { face: 'head' },
  ).join('\n')
  check(
    '默认档报告必须逐条报名(file:line)',
    /a\.test\.mjs:?\s*[\s\S]*3: F1/.test(rep) || rep.includes('scripts/tests/a.test.mjs'),
  )
  check('默认档报告必须给出唯一修复出口', rep.includes('scratch-dir.mjs'))

  // 回退判定四路(与守门 135 同一条理由):**只有**"暂存档 + 射程内零文件"才回退;
  // 其余三种"零文件"都是尺子失效,必须继续判死,而不是悄悄改判全量。
  check(
    '暂存档 + 射程内 0 个 ⇒ 回退全量(否则每一次文档提交都被挡)',
    shouldRetreatToHead({ face: 'staged', scopeCount: 0, hasFilesArg: false }) === true,
  )
  check(
    '暂存档 + 射程内有文件 ⇒ 不回退(收窄必须保住)',
    shouldRetreatToHead({ face: 'staged', scopeCount: 3, hasFilesArg: false }) === false,
  )
  check(
    '全量档 0 个 ⇒ 不回退,判死',
    shouldRetreatToHead({ face: 'head', scopeCount: 0, hasFilesArg: false }) === false,
  )
  check(
    '--files 通道 ⇒ 不回退(点名了就是点名了)',
    shouldRetreatToHead({ face: 'staged', scopeCount: 0, hasFilesArg: true }) === false,
  )

  // ── 认落点判据(L1)的成对正反例 ──
  // ① 落点已合规 ⇒ 只报数不计红线。这一组对应本票实测的 15 处里那 14 处:
  //    树内 .ihui-agent/tmp(两种书写)、合规根标识符(名字与定义都要合规)、
  //    mkScratch(/scratchRoot( 基座内。
  const l1 = scanFixtureText(
    [
      "const a = mkdtempSync(join(ROOT, '.ihui-agent', 'tmp', 'x-'))",
      "const b = mkdtempSync(join(ROOT, '.ihui-agent/tmp/y-'))",
      "const TMP_ROOT = join(ROOT, '.ihui-agent', 'tmp')",
      "const c = mkdtempSync(join(TMP_ROOT, 'c-'))",
      "const FIXTURE_BASE = join(REPO, '.ihui-agent', 'tmp', 'sub')",
      "const d = mkdtempSync(join(FIXTURE_BASE, 'd-'))",
      "import { scratchRoot } from '../lib/scratch-dir.mjs'",
      "const e = mkdtempSync(join(scratchRoot(), 'e-'))",
    ].join('\n') + '\n',
    'scripts/tests/l1-fixture.mjs',
  )
  check(
    '落点已合规的 5 处 mkdtempSync ⇒ 全部只报数(L1)、零红线',
    l1.hits.length === 0 && l1.notices.filter((n) => n.kind === 'L1').length === 5,
  )
  // ② 落点不合规的仍然是红线(判据放宽不得连真违规一起放过)
  const l1neg = scanFixtureText(
    [
      "const q = mkdtempSync(join(os.tmpdir(), 'q-'))",
      "const r = mkdtempSync(join(someUnknownRoot, 'r-'))",
      'const scratchRoot = 1',
      "const s = mkdtempSync(join(scratchRoot, 's-'))",
    ].join('\n') + '\n',
    'scripts/tests/l1-neg.mjs',
  )
  check(
    '落点不合规(TEMP 源 / 认不出的根 / 假 scratchRoot)⇒ 仍计红线,一处都不许放过',
    // 3 处 mkdtempSync(TEMP 源 / 认不出的根 / 只同名不调用的假 scratchRoot)全判红;
    // 第 1 行那处另有一次真 tmpdir( 调用 ⇒ 额外一条 F2。
    l1neg.hits.filter((h) => h.kind === 'F1').length === 3 &&
      l1neg.hits.filter((h) => h.kind === 'F2').length === 1,
  )
  // ③ **名字合规不等于落点合规**(本判据最容易翻车的一处):
  //    TMP_ROOT 名字对、但它的定义落在 os.tmpdir() 上 ⇒ 必须判红。
  const l1name = scanFixtureText(
    [
      "const TMP_ROOT = join(os.tmpdir(), 'x')",
      "const d = mkdtempSync(join(TMP_ROOT, 'd-'))",
    ].join('\n') + '\n',
    'scripts/tests/l1-name.mjs',
  )
  check(
    '根标识符名字合规但定义读 TEMP ⇒ 判红(否则"起个合规名字就能过关")',
    l1name.hits.some((h) => h.kind === 'F1'),
  )
  // ④ 假阳防线在落点判据这一侧同样成立:合规落点的字样只出现在注释/字符串里,
  //    而真调用落在 TEMP 上 ⇒ 判红。
  const l1fake = scanFixtureText(
    [
      "// 应当 mkdtempSync(join(TMP_ROOT, 'x-'))",
      "const hint = 'mkdtempSync(join(scratchRoot(),'",
      "const TMP_ROOT = join(os.tmpdir(), 'x')",
      'const d = mkdtempSync(os.tmpdir())',
    ].join('\n') + '\n',
    'scripts/tests/l1-fake.mjs',
  )
  check(
    '注释/字符串里的合规落点字样不得把真违规放绿(落点侧的假阳防线)',
    // 第 3 行的 TMP_ROOT 定义自身写着 os.tmpdir( ⇒ 那条 F2 是**真的**;
    // 第 4 行的真调用落在 TEMP 上 ⇒ F1+F2 都得判红(注释与字符串里的合规字样一律不认)。
    l1fake.hits.filter((h) => h.kind === 'F1').length === 1 &&
      l1fake.hits.filter((h) => h.kind === 'F2').length === 2,
  )
  // ⑤ 跨行实参:边界靠面 A 的括号配平取,不能按行回溯(本仓 heal-worktree-tracked 就是跨行形态)
  const l1ml = scanFixtureText(
    [
      "const TMP_ROOT = join(ROOT, '.ihui-agent', 'tmp')",
      'const e = mkdtempSync(',
      "  join(TMP_ROOT, 'e-'),",
      ')',
    ].join('\n') + '\n',
    'scripts/tests/l1-ml.mjs',
  )
  check('跨行实参的落点判据成立(括号配平取边界,不是按行回溯)', l1ml.hits.length === 0)
  // ⑥ F2 永远违规这条一点没松:`tmpdir(` 的落点后门不存在
  const l1f2 = scanFixtureText(
    [
      "const TMP_ROOT = join(ROOT, '.ihui-agent', 'tmp')",
      'const p = join(TMP_ROOT, tmpdir())',
    ].join('\n') + '\n',
    'scripts/tests/l1-f2.mjs',
  )
  check(
    'F2 仍永远违规:实参里出现 tmpdir( ⇒ 不给落点后门',
    l1f2.hits.some((h) => h.kind === 'F2'),
  )
  // ⑦ 镜像断言豁免:文件 / 行号 / kind / anchor 四闸,任一不满足即不豁免
  const MIRROR_TABLE = [
    { file: 'scripts/tests/scratch-dir.test.mjs', line: 2, kind: 'F2', anchor: 'SCRATCH_DIR_NAME', reason: 'r' },
  ]
  const mHit = { line: 2, kind: 'F2' }
  const mLine = 'const a = join(tmpdir(), SCRATCH_DIR_NAME)'
  check('镜像断言豁免:四闸全对 ⇒ 覆盖', !!mirrorExemptFor(mHit, 'scripts/tests/scratch-dir.test.mjs', mLine, MIRROR_TABLE))
  check(
    '镜像断言豁免:行号不符 ⇒ 不覆盖(那一行新写的 tmpdir( 照样判红)',
    mirrorExemptFor(mHit, 'scripts/tests/scratch-dir.test.mjs', mLine, [{ ...MIRROR_TABLE[0], line: 99 }]) === null,
  )
  check(
    '镜像断言豁免:该行没有 anchor 字样 ⇒ 不覆盖(名单不得代替判据)',
    mirrorExemptFor(mHit, 'scripts/tests/scratch-dir.test.mjs', 'const a = join(tmpdir(), TMP_DIR_NAME)', MIRROR_TABLE) === null,
  )
  check(
    '镜像断言豁免:文件不符 ⇒ 不覆盖(不得跨文件生效)',
    mirrorExemptFor(mHit, 'scripts/tests/other.test.mjs', mLine, MIRROR_TABLE) === null,
  )
  check(
    '镜像断言豁免:kind 不符 ⇒ 不覆盖(F1 不得借用 F2 的豁免)',
    mirrorExemptFor({ line: 2, kind: 'F1' }, 'scripts/tests/scratch-dir.test.mjs', mLine, MIRROR_TABLE) === null,
  )
  // M1 豁免命中要报出来(只报数),不得静默消失 —— 静默豁免与漏判在输出里同形。
  // 这里刻意用**真实的 MIRROR_EXEMPT 表** + 垫到真实行号 377 的构造面:
  // 用构造表验"报得出来"、用真实表验"锚得准",两件事分开才看得出是哪一件坏了。
  const mirrorPad = `${'// pad\n'.repeat(MIRROR_EXEMPT[0].line - 1)}const linux = join(tmpdir(), SCRATCH_DIR_NAME)\n`
  check(
    'M1 豁免命中要报出来(只报数),不得静默消失 —— 静默豁免与漏判在输出里同形',
    scanFixtureText(mirrorPad, MIRROR_EXEMPT[0].file).notices.some(
      (n) => n.kind === 'M1' && n.line === MIRROR_EXEMPT[0].line,
    ),
  )
  check(
    'M1 真实表逐行锚定:同一段源码挪一行 ⇒ 豁免失效、判红(行号漂了不许默默继续罩)',
    scanFixtureText(`const a = 1\nconst linux = join(tmpdir(), SCRATCH_DIR_NAME)\n`, MIRROR_EXEMPT[0].file)
      .hits.some((h) => h.kind === 'F2'),
  )
  check(
    'MIRROR_EXEMPT 真实条目:有且只有一条,锚在 scratch-dir.test.mjs:377 的镜像断言那一行',
    MIRROR_EXEMPT.length === 1 &&
      MIRROR_EXEMPT[0].file === 'scripts/tests/scratch-dir.test.mjs' &&
      MIRROR_EXEMPT[0].line === 377 &&
      MIRROR_EXEMPT[0].kind === 'F2' &&
      !!MIRROR_EXEMPT[0].reason,
  )

  // --self-test 只走构造面:它**不**碰仓库,所以跑完之后共享索引与磁盘都不该有变化
  check('自检不依赖仓库瞬时状态(上面全部用构造输入)', true)
  console.log(fails === 0 ? 'self-test 全绿' : `self-test 失败 ${fails} 条`)
  return fails === 0 ? 0 : 1
}

/**
 * 纯函数:暂存档"本次没碰到射程"时是否回退全量。
 * 判据与守门 135 同一条:`--staged` 只列改过的文件,而文档/语言包类提交**结构上**不会带
 * `scripts/tests/*.mjs` —— 把它判成"空扫 ⇒ 无法判定"就是替**每一次**无关提交挡路,
 * 而恒挡的唯一结局是各会话走应急跳门、连带其余全部对账一起作废(§12e)。
 * 反过来:显式 `--files` 通道与全量档都不回退 —— 那两个通道里"零文件"就是尺子失效。
 */
export function shouldRetreatToHead({ face, scopeCount, hasFilesArg }) {
  if (hasFilesArg) return false
  if (face !== 'staged') return false
  return scopeCount === 0
}

function run({ strict, face, json, all, files }) {
  const hasFilesArg = !!(files && files.length)
  let listed
  let usedFace = face
  let label = face
  if (hasFilesArg) {
    listed = files.map((f) => f.replace(/\\/g, '/').replace(/^\.?\//, ''))
    label = 'files(显式点名,按工作树读)'
    usedFace = 'worktree'
  } else {
    listed = listFacePaths(face)
  }
  let scope = listed.filter(inScope)
  let retreated = false
  if (shouldRetreatToHead({ face, scopeCount: scope.length, hasFilesArg })) {
    scope = listFacePaths('head').filter(inScope)
    usedFace = 'head'
    label = 'head(回退:本次暂存没触及射程,按全量判 —— 见守门 135 同条理由)'
    retreated = true
  }
  const perFile = []
  let unreadable = 0
  if (usedFace === 'worktree') {
    for (const p of scope) {
      const abs = join(ROOT, p)
      if (!existsSync(abs)) {
        unreadable += 1
        perFile.push({ path: p, hits: [], notices: [], wired: false, unreadable: true })
        continue
      }
      let text = null
      try {
        text = readFileSync(abs, 'utf8')
      } catch (e) {
        throw new Undetermined(`${p} 读不出来:${e.message}`)
      }
      perFile.push({ path: p, ...scanFixtureText(text, p) })
    }
  } else {
    const contents = readFace(scope, usedFace)
    for (const p of scope) {
      const text = contents.get(p)
      if (text === null || text === undefined) {
        unreadable += 1
        perFile.push({ path: p, hits: [], notices: [], wired: false, unreadable: true })
        continue
      }
      perFile.push({ path: p, ...scanFixtureText(text, p) })
    }
  }
  // 台账在这里真正生效:每一行的原始命中先过 applyLedger,得到"该判的违规 / 被正当豁免的 /
  // 清单腐烂"三态。hits 保留**判据结论后的集合**,rawHits 才是原始命中 —— 报告与计数都读 hits,
  // 这样"豁免生效"与"什么都没扫到"在账面上是两件事(后者由 undetermined/unreadable 表达)。
  const ledger = loadLedger(usedFace)
  const today = todayIso()
  for (const f of perFile) {
    if (f.unreadable) {
      f.rawHits = []
      f.exempted = 0
      f.problem = null
      f.rot = false
      continue
    }
    const res = applyLedger({
      wired: f.wired,
      rawHits: f.hits,
      entry: ledger.byPath.get(f.path) ?? null,
      today,
    })
    f.rawHits = res.rawHits
    f.hits = res.violations
    f.exempted = res.exempted
    f.problem = res.problem
    f.rot = res.rot
  }
  const violations = perFile.reduce((a, f) => a + f.hits.length, 0)
  // rot 必须喂给 decide:台账里指向"已无命中文件"的条目 = 清单腐烂,过去 run() 一侧从未传这一维
  // ⇒ 判据只在 --self-test 的构造面上"存在",在提交链上永不成立(半接线)。
  const rotations = perFile.filter((x) => x.rot).length
  const verdict = decide({ listed: scope.length, unreadable, violations, rotations, strict })
  if (json) {
    process.stdout.write(
      `${JSON.stringify({ face: label, usedFace, retreated, listed: scope.length, unreadable, violations, rotations, exemptionsLoaded: !ledger.absent, verdict, perFile }, null, 2)}\n`,
    )
  } else {
    for (const l of formatReport(perFile, verdict, { face: label, all, ledgerAbsent: ledger.absent }))
      console.log(l)
    if (retreated) {
      console.log('ℹ 本次暂存没触及射程 ⇒ 已回退按 HEAD 全量判(不是"无事可做",也不是"无法判定")。')
    }
  }
  return verdict
}

function main(argv) {
  // 跳过出口**两个名字都要认**(2026-10-06 修一条"写出来跑不通的出路"):
  //   · HUSKY_SKIP_FIXTURE_TMPDIR_GUARD —— 本门代码从建门起就在读的那个(原读点)
  //   · HUSKY_SKIP_FIXTURE_TMPDIR        —— `guardian-runner.mjs` 注册块里 `skipEnv:` 声明的那个
  // 此前只有后者被声明、**零真实读点**(全仓 grep 只命中注册块自身那一行) ⇒
  // 想跳这道门的人按注册表设了 HUSKY_SKIP_FIXTURE_TMPDIR, runner 会放行,
  // 而门自己不看那个变量 ⇒ 照跑不误。**注册表写了就是承诺, 承诺必须有兑现点。**
  // 这与 `check-service-binary-paths.mjs` 头注点名的形态同型(它已把那条写进头注)。
  //
  // ⚠️ 本门在注册表里的 mode 是 `'warn'`, 不是 blocking; 这与"存量未清零"的现状一致。
  // 不改注册表(共享面, 且改它会牵动他人): 让代码认下注册表声明的那个名字即可。
  const skip =
    process.env.HUSKY_SKIP_FIXTURE_TMPDIR_GUARD === '1' ||
    process.env.HUSKY_SKIP_FIXTURE_TMPDIR === '1'
  if (skip && !argv.includes('--self-test')) {
    console.log(
      '⏭  HUSKY_SKIP_FIXTURE_TMPDIR[_GUARD]=1 —— 跳过临时夹具落点对账' +
        '（注册块声明的是 HUSKY_SKIP_FIXTURE_TMPDIR；旧名 _GUARD 一并接受）',
    )
    process.exit(0)
  }
  if (argv.includes('--self-test')) process.exit(selfTest())
  const strict = argv.includes('--strict')
  const sel = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
  })
  if (sel.error) {
    console.error(`❌ ${sel.error} ⇒ 无法判定`)
    process.exit(2)
  }
  const fi = argv.indexOf('--files')
  const files = fi >= 0 ? argv.slice(fi + 1).filter((a) => !a.startsWith('--')) : null
  const verdict = run({
    strict,
    face: sel.face,
    json: argv.includes('--json'),
    all: argv.includes('--all'),
    files,
  })
  if (verdict.kind === 'empty-scan') {
    console.error('❌ 射程内枚举到 0 个测试文件 —— 这是"尺子失效",不是"仓库干净"(不得记绿)')
  }
  if (verdict.code === 1) {
    console.error('❌ --strict 档:存在绕过 §26 唯一落点的夹具 ⇒ 判红(名单见上,逐条 file:line)')
  }
  process.exit(verdict.code)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    main(process.argv.slice(2))
  } catch (e) {
    if (e instanceof Undetermined) {
      console.error(`❌ 判定面无法取材(不记绿也不冒红):${e.message}`)
      process.exit(2)
    }
    console.error(`❌ 本门自身异常(不是判据结论):\n${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = {
  SELF_EXEMPT,
  MIRROR_EXEMPT,
  scanFixtureText,
  landingVerdict,
  mirrorExemptFor,
  decide,
  shouldRetreatToHead,
  formatReport,
  inScope,
  lineOf,
  exprEnd,
  ROOT,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
