#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 承诺面 / 兑现面双面对账 —— 文档写出的 `HUSKY_SKIP_*` 出路必须有人读
 *
 * 拦的是本仓最高频的失效型:**文档写了一个跑不通的出路**。
 * 后果不是"文档不准",而是人在真正需要应急的那一刻去设那个变量,它**静默无效**
 * (`判据失效的表现永远是安静`),于是唯一出路退化成 `--no-verify` —— 一次绕过等于
 * 该提交的**全部**守门作废(§12e/§12f 同型)。所以这一条必须常驻对账,不能靠人肉记住。
 *
 * 立项取证(2026-09-30 本会话现读,不是假想):AGENTS.md 声明 139 个去重名、runner 注册项
 * 一千余处 `skipEnv`,而按**读点语法**核过去仍有假承诺(名被文档承诺、代码里一次都没读)。
 * 票面给的 130/116/17 只是量纲,**本门不照抄任何数字** —— 每次运行现读现算。
 *
 * ── 判据(两面对账)────────────────────────────────────────────────
 *  承诺面:AGENTS.md 与 README.md 被审面上出现的 `HUSKY_SKIP_[A-Z0-9_]*`。
 *  兑现面:候选代码文件里**真存在的读点**。wired 的定义只有一条 —— **该名字在兑现面上
 *  至少有一个读点**。
 *
 *  读点语法(全部要求名字**逐字相邻**,不接受"提到过"):
 *   1) `process.env.NAME` / `process.env['NAME']` / `process.env["NAME"]`
 *   2) `env.NAME` / `env['NAME']` / `env["NAME"]`(包装层写法)
 *   3) `$NAME` / `${NAME}` —— 仅限 shell 方言文件
 *   4) `$env:NAME`(以及 `Test-Path Env:NAME` 那一族)—— 仅限 PowerShell 方言文件
 *   5) runner 注册块 `skipEnv: 'NAME'` —— **合法读点**。依据是分发循环的原文(2026-09-30
 *     现读 `scripts/guardian-runner.mjs` L4589,票面写的 L4547 已漂):
 *         `if (check.skipEnv && process.env[check.skipEnv] === '1') {`
 *     该枚登记后每次提交都会走到这一行 ⇒ 注册项就是兑现。注意这是**通用**机制,
 *     真正 per-name 的凭证只有注册块里那一行 `skipEnv: 'NAME'`。
 *
 *  遮罩(硬性):JS 读点必须先在**注释剥净**的代码面上找。原因不是洁癖:各门自己的头注里
 *  就写着它本人的 `HUSKY_SKIP_*=1`,不剥注释 = 门在给假通道发合格证(本票立项要防的那一型)。
 *  遮罩**只引用唯一实现** `scripts/lib/code-mask.mjs`(`maskComments` 遮注释保留字符串 ——
 *  `skipEnv: 'NAME'` 本身就是字符串,连字符串一起抹会直接失明);shell/PowerShell 走同一层的
 *  `maskScriptComments(src, 'sh'|'ps')`,它比"整行以 # 开头"更准(也覆盖行尾 `cmd # 说明 $NAME`)。
 *  本门内**不得**再写第二份剥注释正则,遮罩调用点在 `findReads` 里只有一行(镜像按调用点计数钉死)。
 *
 *  消费者范围:`scripts/` `.husky/` `deploy/` `monitoring/` `packages/` `apps/`,取
 *  `.mjs .js .cjs .ts .tsx .sh .ps1 .psm1`;**显式排除** tests 目录、__tests__ 目录、
 *  `*.test.*` 与 `*.spec.*` 后缀、`.ihui-agent/archive/` 归档面。(排除式的字面 glob
 *  刻意不写进本注释:glob 里的星斜杠序列会把这块头注当场闭合,本文件首跑即
 *  ReferenceError —— 判据一字未变,只换了写法;字面排除式以代码里的 EXCLUDE_RE 为准。)
 *  两条按实测扩进来的形状(方向都是"多认真读点",不是放宽判据):
 *   ① `.husky/` 根目录下**无扩展名**的钩子文件按 shell 方言计入 —— 现读 `.husky/post-commit`
 *     里是 `process.env.HUSKY_SKIP_ARCHIVE` 那一族的**唯一**兑现点,只按扩展名白名单过滤会把
 *     `ARCHIVE / HYGIENE / LEDGER_STRIP / PLAN_HEAL / TAG_SYNC` 等**真通道**判成假承诺。
 *     误报的代价高于漏报(它指使人去"修"没坏的东西,还把口径说歪),故计入并在此留证。
 *   ② `HUSKY_` 预筛必须是读点语法的**超集**(每条语法都要求名字逐字出现,而每个名字都以
 *     `HUSKY_` 开头)⇒ 预筛不可能漏掉一个读点;该不变量由自检 F-PRE 钉住,不是"大概包含"。
 *  **代价如实写明**:读点若写在被排除的夹具面里,本门**看不见** ⇒ 该名会落进 `fake`。
 *  这是刻意的"宁漏不误报"反过来用的一面:夹具面兑现不算生产链兑现(线上跑的是 HEAD 提交链,
 *  不是测试夹具)。这一档**不得**改成判红之外的任何"更严"处置,也不得为它打开夹具面。
 *
 * ── 承诺与禁令两档不得并桶 ────────────────────────────────────────
 *  同一段话里"这是出路"与"这不是出路"是**两个相反的结论**,合成一桶就两头都判错。
 *  窗口不是整行:真仓的行动辄上千字(README 是一行一格的表),禁令和承诺写在同一行是常态。
 *  切分点:`。．.` `！!` `？?` `；;` `，,` 以及 `|`(README 表格单元)。
 *  两条刻意**不**切:
 *   - `：:` —— `紧急跳过：HUSKY_SKIP_X=1` 是承诺,在冒号处切会把"紧急跳过"留在窗口外;
 *   - `、` —— `紧急跳过 X、Y、Z` 里 Y/Z 与 X 共用同一个出路词,切开就成了假"未判定"。
 *  角色判据(`roleOfClause`):
 *   - promise:窗口内出现出路式措辞(`紧急跳过 / 应急 / 跳过 / 绕过 / 可用 / 临时 / skip / bypass`)
 *   - denied :窗口内出现否定措辞(`禁止 / 不得 / 不要 / 无需 / 均不读 / 不读 / 尚未接线 / 不在提交链 /
 *              never / do not` …)—— 它**不需要**读点,但必须逐条列出、计入总数
 *   - 同窗两者都有 ⇒ 记 denied 并标 ambiguous(只报不判红:那是文档措辞问题,不是提交者的错)
 *   - 两者都没有 ⇒ undetermined(该名字在句中的角色判不出来)
 *
 * ── 三态不并桶 + 退出码 ───────────────────────────────────────────
 *  wired / fake(承诺了却零读点)/ undetermined 三桶各自计数,永不互相顶账。
 *  默认档(提交链档)= **差值棘轮**:本次判定面的 fake 集合减去 **HEAD 面**的 fake 集合,
 *  只有新增的假承诺判红;存量减少不拦。立门当天 HEAD 面就有存量,把存量直接判红就是一台
 *  与任何提交都无关的**恒红门** —— 唯一结局是每个会话 `--no-verify`,连带废掉全部守门。
 *  所以存量只在报告里**点名**,不判红。
 *   - `--strict`(问责档,供人工定期跑):存量假承诺逐条点名并 **exit 1**(拒绝出具合格证)
 *   - `--strict` 下有 undetermined ⇒ **exit 2**
 *   - 承诺面枚举到 0 个 `HUSKY_SKIP_*` ⇒ **exit 2 判死**(枚举不到东西永远不是"通过",绿了
 *     只知道判据坏了;绝不记绿)
 *   - 判定面取不到(文档 blob 读不出、候选枚举失败)⇒ **exit 2 无法判定**,且不退回另一面
 *  基线**逐条点名写在本门文里**而不是写死数字:没有基线文件,也没有"上次跑出来的数"。
 *
 * ── 行内出口 ─────────────────────────────────────────────────────
 *  `skip-env-promise-exempt: <原因>` —— **原因必写**,裸标记不算通过;只救标记所在的那一行,
 *  不救整篇、不救同名其它行。豁免项单独计 `exempt` 桶并逐条点名(静默豁免 = 没有豁免)。
 *  没有基线文件可以消红。
 *
 * ── 取材面纪律 ───────────────────────────────────────────────────
 *  默认全量 = HEAD blob;`--staged` = 索引 blob;`--worktree` 仅人工逃生舱;两面旗同给 = exit 2。
 *  任何一面取不到 ⇒ 该档判 undetermined,**不许退回另一面**(退回 = 把"没判"写成"判了")。
 *  同一轮里清单与正文必须出自**同一面**(守门 118 刚把这一条落账:索引清单 + HEAD 内容 ⇒
 *  别人一次 `git add` 就整面"无法判定")。差值棘轮的基线是**另一轮完整的 HEAD 面快照**
 *  (自己的清单 + 自己的正文),不是把两轮的面拼起来。
 *  一切 git 派生与正文读取只经 `scripts/lib/face-reader.mjs`(`catBatch` / `readWorktreeFile` /
 *  `gitRaw` / `selectFace` / `Undetermined`);本门不 `execSync` 拼字符串、不 `readFileSync` 读被审
 *  内容、不用 `process.cwd()` 定根(ROOT 由脚本自身位置推导)。候选枚举用 `git grep -l`(只出清单
 *  不出正文,属守门 118 认的"枚举"档),正文一律走层的读取入口。
 *
 * **已接线(2026-09-30)**:守门 172,注册块在 `scripts/guardian-runner.mjs`
 *  (`skipEnv: 'HUSKY_SKIP_SKIP_ENV_PROMISE'` —— 这一行同时是本门自身出路的合法读点,
 *  skipEnv 语法,见 READ_GRAMMARS)。提交链档由 runner 传 `--staged`(差值棘轮,只拦新增假承诺)。
 *  本门自身**不承诺**任何其他 `HUSKY_SKIP_*` 出路 —— 那正是本门判的东西。
 *
 * 用法:
 *   node scripts/check-skip-env-promise.mjs                 # 默认:HEAD 面 + 差值棘轮(存量只点名)
 *   node scripts/check-skip-env-promise.mjs --staged        # 索引面(提交链档:runner 追加的就是这一面)
 *   node scripts/check-skip-env-promise.mjs --worktree      # 仅人工:按磁盘判
 *   node scripts/check-skip-env-promise.mjs --strict        # 问责档:存量假承诺即 exit 1
 *   node scripts/check-skip-env-promise.mjs --json          # 机器可读结论(整段可 JSON.parse)
 *   node scripts/check-skip-env-promise.mjs --self-test     # 构造面成对正反例
 * 退出码:0 = 无新增假承诺;1 = 判红;2 = **无法判定**(含"枚举到 0 个承诺")。
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { Undetermined, assertRepoRoot, catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
import { maskComments, maskScriptComments } from './lib/code-mask.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GIT_TIMEOUT = 120000
const GIT_MAX_BUFFER = 256 * 1048576

/** 被审文档面(只有这两份是"给人读的出路")。 */
export const DOC_FILES = ['AGENTS.md', 'README.md']
/** 兑现面候选目录。 */
export const CONSUMER_DIRS = ['scripts', '.husky', 'deploy', 'monitoring', 'packages', 'apps']
const HOOK_DIR = '.husky/'
/** 扩展名 → 方言。 */
const EXT_DIALECT = new Map([
  ['mjs', 'js'],
  ['js', 'js'],
  ['cjs', 'js'],
  ['ts', 'js'],
  ['tsx', 'js'],
  ['sh', 'sh'],
  ['ps1', 'ps'],
  ['psm1', 'ps'],
])
/** 显式排除(夹具面与归档面的读点都不算生产链兑现)。 */
const EXCLUDE_RE = /(^|\/)tests\/|\/__tests__\/|\.test\.|\.spec\.|^\.ihui-agent\/archive\//
/**
 * 预筛 token:必须是**全部读点语法的超集**(见自检 F-PRE)—— 每条语法都要求名字逐字出现,
 * 而每个名字都以它开头 ⇒ 少扫一个文件这件事在结构上不可能发生。
 */
export const PREFILTER = 'HUSKY_'
export const NAME_RE = /HUSKY_SKIP_[A-Z0-9_]+/g

/** 句读切分点(见头注"两条刻意不切")。 */
const CLAUSE_SEP_RE = /[。．.！!？?；;，,|]/
/** 行内豁免标记:冒号后必须有实际原因,且原因不得由注释闭合符冒充。 */
export const EXEMPT_RE = /skip-env-promise-exempt:[ \t]*([^\r\n]*)/

/** 出路式措辞(承诺)。 */
const PROMISE_RE = /紧急跳过|应急跳过|紧急放行|应急放行|应急开关|临时跳过|跳过|绕过|应急|可用|临时|\bskip(?:s|ped|ping)?\b|\bbypass(?:es|ed)?\b|\bemergency\b|\bworkaround\b/i
/** 否定措辞(禁令)。 */
const DENIED_RE = /禁止|不得|不可|不要|无需|不必|不需要|从未|没有|无真实|无应急|均不读|不读|尚未接线|未接线|未接|不在提交链|形同虚设|不存在|失效|\bnever\b|\bdo not\b|\bnot wired\b|\bno real\b/i

/**
 * 读点语法表。`src` 里的 `%NAME%` 由**逐字转义后的名字**替换 —— 所以每条语法都必然要求
 * 名字原文出现,预筛 `HUSKY_` 因此是超集(不变量由 `READ_GRAMMARS.every(...)` 自检钉住)。
 * `d` 是生效方言:shell 的 `$NAME` 在 JS 里不算读点(JS 字符串里的 `$HUSKY_SKIP_X` 是给子进程
 * **设置**变量,不是**读**),`$env:` 反之。
 */
export const READ_GRAMMARS = [
  { via: 'process.env.NAME', d: 'js', src: 'process\\.env\\.%NAME%' },
  { via: 'process.env["NAME"]', d: 'js', src: 'process\\.env\\s*\\[\\s*[\'"]%NAME%[\'"]' },
  { via: "skipEnv: 'NAME'", d: 'js', src: '\\bskipEnv\\s*:\\s*[\'"]%NAME%[\'"]' },
  { via: 'env.NAME', d: 'js', src: '\\benv\\.%NAME%' },
  { via: 'env["NAME"]', d: 'js', src: '\\benv\\s*\\[\\s*[\'"]%NAME%[\'"]' },
  { via: '$env:NAME', d: 'ps', src: '\\benv:%NAME%', flags: 'i' },
  { via: '$NAME', d: 'sh', src: '\\$\\{?%NAME%\\}?' },
]

/** 具体在前的顺序很重要:`process.env.X` 同时会命中通用的 `env\\.X`。 */
export function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
export function grammarRe(g, name) {
  const src = g.src.replace('%NAME%', escapeRe(name))
  return new RegExp(src, g.flags ? `g${g.flags}` : 'g')
}

/**
 * 句子窗口(纯函数,导出给镜像测试)。
 * 返回包含 `index` 的那个**子句**(不以整行为单位 —— 真仓一行上千字、禁令与承诺同属常态),
 * 以及它在原行内的起止。越界的 index 会被夹到合法区间(不接受抛错:抛错的门会把"取不到列"
 * 变成"整门不判")。
 * @returns {{text:string,start:number,end:number}}
 */
export function sentenceWindow(line, index) {
  const s = String(line ?? '')
  const i = Number.isFinite(index) ? Math.max(0, Math.min(Math.trunc(index), Math.max(0, s.length - 1))) : 0
  let start = 0
  for (let k = i - 1; k >= 0; k--) {
    if (CLAUSE_SEP_RE.test(s[k])) {
      start = k + 1
      break
    }
  }
  let end = s.length
  for (let k = i; k < s.length; k++) {
    if (CLAUSE_SEP_RE.test(s[k])) {
      end = k
      break
    }
  }
  return { text: s.slice(start, end).trim(), start, end }
}

/** 子句角色:promise / denied / ambiguous(两者都有)/ none(判不出)。denied 优先于 promise。 */
export function roleOfClause(clause) {
  const c = String(clause ?? '')
  const p = PROMISE_RE.test(c)
  const n = DENIED_RE.test(c)
  if (p && n) return 'ambiguous'
  if (n) return 'denied'
  if (p) return 'promise'
  return 'none'
}

/** 行内豁免:必须带原因,且原因不得只是注释闭合符/标点(裸标记不算通过)。 */
export function hasExemption(line) {
  const m = EXEMPT_RE.exec(String(line ?? ''))
  if (!m) return { exempt: false, reason: '' }
  const reason = m[1].replace(/[\s*`/;\\).。】\]]+/g, '')
  return { exempt: reason.length >= 2, reason: m[1].trim() }
}

/**
 * 抽取承诺面出现点。逐行、逐出现点各带一个句子窗口与角色;行号从 1 起(给人定位用)。
 * @returns {Array<{name:string,file:string,line:number,col:number,clause:string,role:string,exempt:boolean,reason:string}>}
 */
export function extractOccurrences(text, file) {
  const out = []
  if (typeof text !== 'string') return out
  const lines = text.split(/\r?\n/)
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]
    if (!line.includes(PREFILTER)) continue
    NAME_RE.lastIndex = 0
    let m
    while ((m = NAME_RE.exec(line)) !== null) {
      const w = sentenceWindow(line, m.index)
      const ex = hasExemption(line)
      out.push({ name: m[0], file, line: li + 1, col: m.index, clause: w.text, role: roleOfClause(w.text), exempt: ex.exempt, reason: ex.reason })
      if (m[0].length === 0) NAME_RE.lastIndex++
    }
  }
  return out
}

/**
 * 名字级定性(纯函数,导出给镜像):出现点先剔除豁免,再按角色聚合。
 * 优先级 promise > ambiguous > denied > undetermined —— 文档里**任何一处**把它当出路承诺,
 * 那个承诺就必须被兑现;"别处有一句否定"不能替承诺背书(它只是措辞两可)。
 */
export function classifyName(name, occs) {
  const kept = (occs || []).filter((o) => o.name === name && !o.exempt)
  const exempted = (occs || []).filter((o) => o.name === name && o.exempt)
  if (kept.length === 0) {
    return exempted.length ? { role: 'exempt', ambiguous: false, occs: exempted } : { role: 'undetermined', ambiguous: false, occs: [] }
  }
  const roles = new Set(kept.map((o) => o.role))
  let role = 'undetermined'
  if (roles.has('promise')) role = 'promise'
  else if (roles.has('ambiguous')) role = 'ambiguous'
  else if (roles.has('denied')) role = 'denied'
  return { role, ambiguous: roles.has('ambiguous'), occs: kept }
}

/** 某路径属于兑现面?含"无扩展名的钩子文件"那一格(依据见头注①)。 */
export function isConsumerFile(rel) {
  const p = String(rel || '')
  if (!p || EXCLUDE_RE.test(p)) return false
  if (!CONSUMER_DIRS.some((d) => p === d || p.startsWith(`${d}/`))) return false
  const base = p.slice(p.lastIndexOf('/') + 1)
  const dot = base.lastIndexOf('.')
  const ext = dot > 0 ? base.slice(dot + 1).toLowerCase() : ''
  if (EXT_DIALECT.has(ext)) return true
  // `.husky/` **根目录**下的无扩展名钩子文件
  return p.startsWith(HOOK_DIR) && p.slice(HOOK_DIR.length).includes('/') === false && dot < 0
}

/** 路径 → 方言(与 isConsumerFile 同源,不接受第三值)。 */
export function dialectOf(rel) {
  const p = String(rel || '')
  const base = p.slice(p.lastIndexOf('/') + 1)
  const dot = base.lastIndexOf('.')
  if (dot < 0) return p.startsWith(HOOK_DIR) && !p.slice(HOOK_DIR.length).includes('/') ? 'sh' : null
  return EXT_DIALECT.get(base.slice(dot + 1).toLowerCase()) || null
}

/**
 * 内容嗅探后的生效方言(2026-09-30 v2 立,普查实证的漏认形态②)。
 * `.husky/` 根目录的无扩展名钩子按路径默认 sh —— 但本仓的钩子自 2026-09-23 起是
 * `#!/usr/bin/env node` 的 **Node 钩子**(`.husky/post-commit` 头注自证),里面是
 * `process.env.HUSKY_SKIP_X` 的 **JS 读法**;按 sh 判 = 守门对四个真通道(HYGIENE /
 * LEDGER_STRIP / PLAN_HEAL / TAG_SYNC)集体漏认、给假承诺发红。嗅探规则:文本有
 * node shebang 或 `process.env.` ⇒ js;否则维持路径方言。**只可能把"漏认"扳成
 * "认到",不新增任何承诺维度**;sh 钩子(真 shell 语法)不受影响(无 node 痕迹)。
 */
export function sniffDialect(rel, text) {
  const base = dialectOf(rel)
  const t = String(text ?? '')
  if (base === 'sh' && (/^\s*#!.*\bnode\b/m.test(t) || /process\.env\./.test(t))) return 'js'
  return base
}

/**
 * 遮一个面。**只有这一处**按语言选遮罩器(镜像按调用点计数钉死,防第二份剥注释实现)。
 * `maskComments` 遮注释**保留字符串**(runner 的 `skipEnv: 'NAME'` 本身就是字符串);
 * 脚本方言走同层的 `maskScriptComments`,它认行尾注释,比"整行以 # 开头"更准。
 * 未知方言原样返回:兑现面只收三种方言,别的文件根本进不来(见 isConsumerFile)。
 * `d` 可由调用方传入嗅探后的生效方言(见 sniffDialect);缺省按路径判。
 */
export function maskFace(rel, text, d = dialectOf(rel)) {
  if (d === 'js') return maskComments(text)
  if (d === 'sh') return maskScriptComments(text, 'sh')
  if (d === 'ps') return maskScriptComments(text, 'ps')
  return String(text ?? '')
}

/**
 * 兑现面搜索:该名字在这些文件里有没有**读点**。
 * ⚠️ 遮罩只在本函数内发生一次(`maskFace` 那一行)—— 变异自证改的就是那一行,
 *    把它换成原文面 ⇒ 注释里的 `process.env.HUSKY_SKIP_X` 会被算成读点 ⇒ 自检必红。
 * 同一行被多条语法命中只记一条(具体语法在前 ⇒ 归因给最具体的那一条,不虚增计数)。
 * @returns {Array<{rel:string,line:number,via:string}>}
 */
export function findReads(name, faces) {
  const hits = []
  const n = String(name || '')
  if (!n) return hits
  for (const f of faces || []) {
    // 范围在**这里**再过一遍(不在这里判 = 只要调用方漏筛,夹具面的读点就会被算成兑现):
    // 夹具面 / 归档面对本门不可见,是刻意的"宁漏不误报",见头注。
    const d = sniffDialect(f.rel, f.text)
    if (!d || !dialectOf(f.rel) || !isConsumerFile(f.rel)) continue
    const code = maskFace(f.rel, f.text, d) // ← 遮罩唯一调用点
    const taken = []
    /** 每条语法命中去重后登记(via 标注最具体的那条,不虚增计数)。 */
    const record = (via, from, to) => {
      const line = code.slice(0, from).split('\n').length
      if (taken.some((t) => t.line === line && from < t.to && to > t.from)) return
      taken.push({ line, from, to })
      hits.push({ rel: f.rel, line, via })
    }
    for (const g of READ_GRAMMARS) {
      if (g.d !== d) continue
      const re = grammarRe(g, n)
      let m
      while ((m = re.exec(code)) !== null) {
        const from = m.index
        const to = m.index + m[0].length
        if (m[0].length === 0) {
          re.lastIndex++
          continue
        }
        record(g.via, from, to)
      }
    }
    // 间接常量读(2026-09-30 v2,普查实证的漏认形态①):`const SKIP_ENV = 'HUSKY_SKIP_X'`
    // 之后 `process.env[SKIP_ENV]` 是 HUSKY_SKIP_X 的**真读取点** —— 名字在字面量赋值行、
    // 读取在别的行,直读语法表对不上 ⇒ 三个真通道被误判 fake。同文件内"绑定 + 下标读"
    // 两者齐备才算(缺一不可:只有绑定没有读,仍是 fake);仅 js 方言(sh 无此形态)。
    if (d === 'js') {
      const bindings = []
      const bindRe = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(['"])HUSKY_SKIP_[A-Z0-9_]+\2/g
      let bm
      while ((bm = bindRe.exec(code)) !== null) {
        const lit = /(['"])(HUSKY_SKIP_[A-Z0-9_]+)\2/.exec(bm[0])
        if (lit && lit[2] === n) bindings.push(bm[1])
      }
      const seenIdents = new Set()
      // 常量下标读的专用语法(无引号组 —— `process.env[SKIP_ENV]` 与字面量形态的区别所在)
      const indirectGrammars = [
        { via: 'process.env[CONST]', src: 'process\\.env\\s*\\[\\s*%IDENT%\\s*\\]' },
        { via: 'env[CONST]', src: '\\benv\\s*\\[\\s*%IDENT%\\s*\\]' },
      ]
      for (const ident of bindings) {
        if (seenIdents.has(ident)) continue
        seenIdents.add(ident)
        for (const g of indirectGrammars) {
          const re = new RegExp(g.src.replace('%IDENT%', escapeRe(ident)), 'g')
          let m
          while ((m = re.exec(code)) !== null) {
            if (m[0].length === 0) {
              re.lastIndex++
              continue
            }
            record(`${g.via}(间接:${ident})`, m.index, m.index + m[0].length)
          }
        }
      }
    }
  }
  return hits
}

/**
 * 纯判据:给定文档面 + 兑现面,算出三态与退出码。main 与 --self-test 共用这一支
 * (自检不许另写一份判据,否则测的是"自检里的那份")。
 * @param {{docs:Array<{rel:string,text:string|null}>,faces:Array<{rel:string,text:string}>,
 *          face:string,strict:boolean,baselineFake?:Set<string>|null,
 *          enumeration?:string,enumError?:string}} o
 */
export function evaluate(o) {
  const docs = o.docs || []
  const faces = o.faces || []
  const strict = Boolean(o.strict)
  const face = o.face
  const baseline = o.baselineFake instanceof Set ? o.baselineFake : null

  const occs = []
  const docErrors = []
  for (const d of docs) {
    if (typeof d.text !== 'string') docErrors.push(`${d.rel}:该文档在 ${face} 面取不到正文`)
    else occs.push(...extractOccurrences(d.text, d.rel))
  }
  const names = [...new Set(occs.map((x) => x.name))].sort()
  const enumFailed = o.enumeration === 'failed'

  const wired = []
  const fake = []
  const denied = []
  const ambiguous = []
  const undetermined = []
  const exempt = []
  let promiseNames = 0

  // 读点面不完整(某个候选文件的正文取不到)⇒ "零读点"这件事就**没被判过**:
  // 那种名字落 undetermined,不落 fake —— 少扫不是"没有",是"没看完"。
  const readFaceBroken = (o.unresolved || []).length > 0 || enumFailed || docErrors.length > 0

  for (const name of names) {
    const cls = classifyName(name, occs)
    const where = cls.occs.map((x) => ({ file: x.file, line: x.line, clause: x.clause }))
    if (cls.role === 'exempt') {
      exempt.push({ name, where: occs.filter((x) => x.name === name).map((x) => ({ file: x.file, line: x.line, reason: x.reason })) })
      continue
    }
    if (cls.role === 'denied') {
      denied.push({ name, where })
      continue
    }
    if (cls.role === 'ambiguous') {
      // 按 denied 处理(不需要读点、不判红),但必须点名:同一子句里"这是出路"和"这不是出路"
      // 写在了一起,那是文档措辞问题,不是提交者的错。
      denied.push({ name, where })
      ambiguous.push({ name, why: '同一子句既是出路又是禁令(按 denied 处理)', where })
      continue
    }
    if (cls.role === 'undetermined') {
      // 角色判不出 ≠ 无出路可核(2026-09-30 v2,普查实证的漏认形态③):文档措辞两可时,
      // 兑现面若有**真读点**,该名有没有出路已经 moot —— 它真实可跳,按 wired 论;
      // 零读点才落 undetermined(此时"是不是出路"确实没判出来,不冒 fake 也不冒 wired)。
      const reads = findReads(name, faces)
      if (reads.length > 0) {
        promiseNames++
        wired.push({ name, reads })
        continue
      }
      undetermined.push({ name, why: '该名字在句中的角色判不出来', where })
      continue
    }
    promiseNames++
    if (cls.ambiguous) ambiguous.push({ name, why: '另有子句把承诺与禁令写在一起(承诺仍以兑现论)', where })
    const reads = findReads(name, faces)
    if (reads.length > 0) {
      wired.push({ name, reads })
      continue
    }
    if (readFaceBroken) {
      undetermined.push({ name, why: enumFailed ? '候选枚举失败,读点面未知' : '读点面不完整,不能把"没看见"当"没有"', where })
      continue
    }
    fake.push({ name, where })
  }

  const fakeSet = new Set(fake.map((f) => f.name))
  const newlyFake = baseline ? fake.filter((f) => !baseline.has(f.name)) : fake.filter(() => false)

  let exit
  let fatal = null
  if (names.length === 0) {
    // 承诺面一个名字都没枚举到 ⇒ 判死。绝不记绿:那要么是取材坏了,要么是判据瞎了,
    // 两种都不是"通过"(而账面上一律长得像通过)。
    exit = 2
    fatal = `承诺面枚举到 0 个 HUSKY_SKIP_*(${face} 面的 ${docs.map((d) => d.rel).join(' + ')}),本门未做出任何结论`
  } else if (promiseNames === 0) {
    // 有出现点但没有任何一句把它写成出路 ⇒ 没有承诺可核,同样不得出合格证(判死,不记绿)。
    exit = 2
    fatal = `承诺面枚举到 ${names.length} 个名字、其中 0 个是出路式承诺(禁令 ${denied.length})⇒ 无可核对象,本门不出合格证`
  } else if (enumFailed) {
    exit = 2
    fatal = `兑现面候选枚举失败:${o.enumError || '(git grep 未跑成)'}`
  } else if (docErrors.length > 0) {
    exit = 2
    fatal = `被审文档面取不到 ⇒ 无法判定:${docErrors.join(' / ')}`
  } else if (strict) {
    if (undetermined.length > 0) exit = 2
    else if (fake.length > 0) exit = 1
    else exit = 0
  } else {
    exit = newlyFake.length > 0 ? 1 : 0
  }

  return {
    face,
    strict,
    docFiles: docs.map((d) => ({ rel: d.rel, readable: typeof d.text === 'string' })),
    candidateFiles: faces.length,
    occurrences: occs.length,
    names: names.length,
    promises: promiseNames,
    wired,
    fake,
    denied,
    ambiguous,
    undetermined,
    exempt,
    newlyFake,
    baselineUsed: Boolean(baseline),
    baselineSize: baseline ? baseline.size : null,
    docErrors,
    unresolved: o.unresolved || [],
    enumeration: enumFailed ? 'failed' : 'ok',
    enumError: o.enumError || null,
    fatal,
    exit,
    counts: {
      wired: wired.length,
      fake: fake.length,
      denied: denied.length,
      ambiguous: ambiguous.length,
      undetermined: undetermined.length,
      exempt: exempt.length,
      newlyFake: newlyFake.length,
      names: names.length,
      promises: promiseNames,
      occurrences: occs.length,
    },
  }
}

/** 从 argv 选面(交给层的 selectFace,三面口径三门共用)。 */
export function faceFromArgv(argv) {
  return selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree'), def: 'head' })
}

/** 某面下的候选清单(只出路径,**不出正文** —— 正文一律走 catBatch / readWorktreeFile)。 */
export function listCandidates(face, root = ROOT) {
  // ⚠️ 选项必须排在模式**之前**:`--cached` 落在模式后面会被当成 revision,git 直接
  //    `fatal: unable to resolve revision: --cached`(AGENTS 记过一次,那一错让整道门恒红)。
  //    rev 反之必须在模式之后 —— `git grep <pattern> <rev> -- <path>` 才是合法语序。
  const args = ['grep', '-l']
  if (face === 'staged') args.push('--cached')
  args.push('-F', PREFILTER)
  if (face === 'head') args.push('HEAD')
  args.push('--', ...CONSUMER_DIRS)
  let raw
  try {
    raw = gitRaw(args, root, { timeout: GIT_TIMEOUT, maxBuffer: GIT_MAX_BUFFER })
  } catch (e) {
    // rc=1 是 git 正常结论"零命中"(候选集为空);其余 rc 是"没跑成" ⇒ 未判定,绝不冒"没有读点"。
    if (e instanceof Undetermined && e.status === 1) return { files: [], enumeration: 'ok', error: null }
    return { files: [], enumeration: 'failed', error: e && e.message }
  }
  const files = String(raw || '')
    .split(/\r?\n/)
    .map((l) => (face === 'head' && l.startsWith('HEAD:') ? l.slice(5) : l))
    .filter((l) => l && isConsumerFile(l))
    .sort()
  return { files, enumeration: 'ok', error: null }
}

/** 某面的正文(清单与正文同面同轮)。null = 该文件在这一面取不到 ⇒ 由 evaluate 落未判定。 */
export function readFaces(face, files, root = ROOT) {
  const faces = []
  const unresolved = []
  if (face === 'worktree') {
    for (const rel of files) {
      const text = readWorktreeFile(root, rel)
      if (typeof text === 'string') faces.push({ rel, text })
      else unresolved.push(rel)
    }
    return { faces, unresolved }
  }
  const specs = files.map((rel) => `${face === 'head' ? 'HEAD:' : ':'}${rel}`)
  const map = catBatch(root, specs, { timeout: GIT_TIMEOUT, maxBuffer: GIT_MAX_BUFFER })
  for (const rel of files) {
    const text = map.get(`${face === 'head' ? 'HEAD:' : ':'}${rel}`)
    if (typeof text === 'string') faces.push({ rel, text })
    else unresolved.push(rel)
  }
  return { faces, unresolved }
}

/** 一轮完整快照:同一面的清单 + 同一面的正文 + 同一面的文档。 */
export function snapshot(face, root = ROOT) {
  const cand = listCandidates(face, root)
  const { faces, unresolved } = cand.enumeration === 'ok' ? readFaces(face, cand.files, root) : { faces: [], unresolved: [] }
  const specs = DOC_FILES.map((f) => `${face === 'head' ? 'HEAD:' : ':'}${f}`)
  const docs = []
  if (face === 'worktree') {
    for (const rel of DOC_FILES) docs.push({ rel, text: readWorktreeFile(root, rel) })
  } else {
    const map = catBatch(root, specs, { timeout: GIT_TIMEOUT, maxBuffer: GIT_MAX_BUFFER })
    for (const rel of DOC_FILES) docs.push({ rel, text: map.get(`${face === 'head' ? 'HEAD:' : ':'}${rel}`) })
  }
  return { docs, faces, unresolved, enumeration: cand.enumeration, enumError: cand.error, candidateCount: cand.files.length }
}

/**
 * 自检登记出口 —— **唯一**允许写"这条算不算过"的地方。`cond` 必须是已求值的布尔:
 * 传函数一律记红(§22c 实录:`t(name, () => …)` 里 `!!fn` 恒真 ⇒ 断言从写下起从未求值,
 * 账面"N/N 通过"量到的只是"这个函数对象存在")。
 */
export function makeAssert(sink = console.log) {
  const state = { pass: 0, fails: [] }
  const ok = (name, cond, note = '') => {
    if (typeof cond === 'function') {
      state.fails.push(name)
      sink(`❌ ${name} —— cond 是函数 ⇒ 断言从未求值(§22c:应写成 (() => {...})())`)
      return
    }
    if (cond === true) {
      state.pass++
      sink(`✅ ${name}`)
      return
    }
    state.fails.push(name)
    sink(`❌ ${name}${note ? ` —— ${note}` : ` —— 实得 ${JSON.stringify(cond)}`}`)
  }
  return { ok, state }
}

const js = (rel, text) => ({ rel, text })
const DOC = (body) => [{ rel: 'AGENTS.md', text: body }]
function runCase({ doc, faces = [], strict = false, face = 'head', baseline = null, enumeration = 'ok', enumError = null, unresolved = [] }) {
  return evaluate({ docs: DOC(doc), faces, strict, face, baselineFake: baseline, enumeration, enumError, unresolved })
}

function selfTest() {
  const { ok, state } = makeAssert()

  // ── 窗口与角色 ──────────────────────────────────────────────
  const long = '前文一大段——**禁止**把嵌套 ref 寄托在松散文件上;**禁止**用 HUSKY_SKIP_A=1 绕过 30a —— 先跑 healing。'
  const w = sentenceWindow(long, long.indexOf('HUSKY_SKIP_A'))
  ok('W1 窗口不是整行(长行里的子句必须被切出来)', w.text.length < long.length && w.text.includes('HUSKY_SKIP_A') && !w.text.startsWith('前文'), JSON.stringify(w.text))
  ok('W2 逗号/分号/顿号之外都算界:README 表格单元必须切开', sentenceWindow('| 甲 | 紧急跳过 HUSKY_SKIP_B=1 | 乙 |', 20).text === '紧急跳过 HUSKY_SKIP_B=1')
  ok('W3 冒号刻意不切:「紧急跳过：X=1」仍是承诺', roleOfClause(sentenceWindow('紧急跳过：HUSKY_SKIP_C=1', 6).text) === 'promise')
  ok('W4 顿号刻意不切:「紧急跳过 X、Y」共用出路词', sentenceWindow('紧急跳过 HUSKY_SKIP_D、HUSKY_SKIP_E', 5).text.includes('HUSKY_SKIP_E'))
  ok('W5 index 越界不抛错(抛错的门会把取不到列变成整门不判)', sentenceWindow('abc', 999).text === 'abc' && sentenceWindow('abc', -3).text === 'abc' && sentenceWindow('', 0).text === '')
  ok('W6 promise 措辞族', ['紧急跳过 HUSKY_SKIP_X=1', '跳过 HUSKY_SKIP_X=1 git commit', '可用 HUSKY_SKIP_X=1 应急', 'skip the gate with HUSKY_SKIP_X=1'].every((s) => roleOfClause(s) === 'promise'), '')
  ok('W7 denied 措辞族(纯否定,不含出路词)', ['禁止设置 HUSKY_SKIP_X=1', '不得再提 HUSKY_SKIP_X=1', '均不读 HUSKY_SKIP_X', 'no code reads it, do not set HUSKY_SKIP_X'].every((s) => roleOfClause(s) === 'denied'), '')
  ok('W7b 出路词与否定词同时出现 ⇒ 不得静默算承诺', roleOfClause('禁止用 HUSKY_SKIP_X=1 绕过') === 'ambiguous')

  ok('W8 同窗两反 ⇒ ambiguous(不得并桶,也不判红)', roleOfClause('禁止用 HUSKY_SKIP_X=1 绕过,它不是出路') === 'ambiguous' && roleOfClause('无真实跳门通道 HUSKY_SKIP_X,也不要设') === 'denied')
  ok('W9 两者都没有 ⇒ none(名字角色判不出)', roleOfClause('HUSKY_SKIP_X 关的是整块') === 'none')

  // ── 读点语法 ────────────────────────────────────────────────
  ok('R1 process.env.NAME 是读点', findReads('HUSKY_SKIP_X', [js('scripts/a.mjs', 'if (process.env.HUSKY_SKIP_X === "1") x()')]).length === 1)
  ok('R2 process.env["NAME"] / [\'NAME\'] 都是读点', findReads('HUSKY_SKIP_X', [js('scripts/a.mjs', "a=process.env['HUSKY_SKIP_X'];b=process.env[\"HUSKY_SKIP_X\"];")]).length === 2)
  ok('R3 env.NAME 与 env["NAME"] 包装层写法是读点', findReads('HUSKY_SKIP_X', [js('scripts/a.mjs', 'const v = env.HUSKY_SKIP_X')]).length === 1 && findReads('HUSKY_SKIP_X', [js('scripts/a.mjs', 'const v = env["HUSKY_SKIP_X"]')]).length === 1)
  ok('R4 shell $NAME / ${NAME} 是读点(.sh 与 .husky 钩子同方言)', findReads('HUSKY_SKIP_X', [{ rel: 'deploy/a.sh', text: 'if [ "${HUSKY_SKIP_X}" = "1" ]; then true; fi' }]).length === 1 && findReads('HUSKY_SKIP_X', [{ rel: '.husky/post-commit', text: 'test -n "$HUSKY_SKIP_X"' }]).length === 1)
  ok('R5 PowerShell $env:NAME 是读点(大小写都算)', findReads('HUSKY_SKIP_X', [{ rel: 'deploy/a.ps1', text: 'if ($Env:HUSKY_SKIP_X -eq "1") { exit 0 }' }]).length === 1)
  ok("R6 runner 注册块 skipEnv: 'NAME' 是读点(依据=分发循环原文,见头注)", findReads('HUSKY_SKIP_X', [js('scripts/guardian-runner.mjs', "  skipEnv: 'HUSKY_SKIP_X',")]).length === 1 && findReads('HUSKY_SKIP_X', [js('scripts/guardian-runner.mjs', 'if (check.skipEnv && process.env[check.skipEnv] === "1") y()')]).length === 0, '通用分发那行不含 per-name 名字 ⇒ 单靠它不算')
  ok('R7 同一行多条语法只记一条(具体在前,不虚增)', findReads('HUSKY_SKIP_X', [js('scripts/a.mjs', 'process.env.HUSKY_SKIP_X')]).length === 1)
  ok('R8 shell 的 $NAME 在 JS 面不算读点(那是给子进程**设置**,不是读)', findReads('HUSKY_SKIP_X', [js('scripts/a.mjs', 'const cmd = "HUSKY_SKIP_X=$HUSKY_SKIP_X git commit"')]).length === 0)
  ok('R9 遮罩反向锁 A:JS 注释里的裸名字提到不是读点', findReads('HUSKY_SKIP_X', [js('scripts/a.mjs', '// 紧急跳过 HUSKY_SKIP_X=1 即可')]).length === 0)
  ok('R10 遮罩反向锁 B:注释里**照抄读点语法**也不算读点(变异自证打的就是这一条)', findReads('HUSKY_SKIP_X', [js('scripts/a.mjs', '// 只要写 process.env.HUSKY_SKIP_X 就能跳过\nblock();\n/* skipEnv: "HUSKY_SKIP_X" 从未注册 */')]).length === 0)
  ok('R11 遮罩反向锁 C:剥注释后**同行代码**照样看得见(遮罩不是把整行抹掉)', findReads('HUSKY_SKIP_X', [js('scripts/a.mjs', 'process.env.HUSKY_SKIP_X // 因为要跳过')]).length === 1)
  ok('R12 脚本方言的行尾注释不是读点(.sh)', findReads('HUSKY_SKIP_X', [{ rel: 'deploy/a.sh', text: 'echo hi # 例如 $HUSKY_SKIP_X 可以跳过' }]).length === 0)
  ok('R13 注释里写 $env: 同样不算(.ps1)', findReads('HUSKY_SKIP_X', [{ rel: 'deploy/a.ps1', text: '# 用 $env:HUSKY_SKIP_X=1 跳过\nWrite-Host 1' }]).length === 0)
  ok('R14 行号按原文对齐(遮罩等长,行号不漂)', findReads('HUSKY_SKIP_X', [js('scripts/a.mjs', '/* 说明\n   多行\n */\nprocess.env.HUSKY_SKIP_X')])[0].line === 4)
  // ── v2 漏认形态三钉(2026-09-30 全仓普查实证,见落地枚正文)──────────────
  ok('R15 间接常量读:const SKIP_ENV=NAME + process.env[SKIP_ENV] ⇒ wired', findReads('HUSKY_SKIP_X', [js('scripts/a.mjs', "const SKIP_ENV = 'HUSKY_SKIP_X'\nif (process.env[SKIP_ENV] === '1') x()")]).length === 1)
  ok('R15b 只有常量绑定、没有下标读 ⇒ 仍算零读点(两者缺一不可)', findReads('HUSKY_SKIP_X', [js('scripts/a.mjs', "const SKIP_ENV = 'HUSKY_SKIP_X'")]).length === 0)
  ok('R16 Node 钩子(#!node + process.env 读法)按内容嗅探判 js ⇒ wired', findReads('HUSKY_SKIP_X', [{ rel: '.husky/post-commit', text: '#!/usr/bin/env node\nif (process.env.HUSKY_SKIP_X !== "1") x()' }]).length === 1)
  ok('R16b 真 sh 钩子($NAME 读法)不受嗅探影响', findReads('HUSKY_SKIP_X', [{ rel: '.husky/pre-commit', text: '#!/bin/sh\ntest -n "$HUSKY_SKIP_X"' }]).length === 1)
  ok('E5d undetermined + 兑现面有真读点 ⇒ wired(出路问题 moot,不再落未判定)', (() => {
    const r = runCase({ doc: '- `HUSKY_SKIP_U=1` 关的是整块', faces: [js('scripts/u.mjs', 'process.env.HUSKY_SKIP_U')] })
    return r.counts.wired === 1 && r.counts.undetermined === 0 && r.exit === 0
  })())

  // ── 预筛超集 + 消费者范围 ───────────────────────────────────
  ok('F-PRE 每条读点语法都要求名字逐字出现 ⇒ HUSKY_ 预筛是超集(少扫一个文件在结构上不可能)', READ_GRAMMARS.every((g) => g.src.includes('%NAME%')) && READ_GRAMMARS.every((g) => grammarRe(g, 'HUSKY_SKIP_X').source.includes('HUSKY_SKIP_X')))
  ok('F1 tests/ 面排除', isConsumerFile('scripts/tests/x.mjs') === false)
  ok('F2 *.test.* / *.spec.* 排除', isConsumerFile('packages/ui-react/a.test.tsx') === false && isConsumerFile('apps/web/a.spec.ts') === false)
  ok('F3 __tests__/ 与归档面排除', isConsumerFile('apps/web/__tests__/a.js') === false && isConsumerFile('.ihui-agent/archive/a.mjs') === false)
  ok('F4 非代码扩展名排除(.md/.json 的散文不算兑现)', isConsumerFile('scripts/README.md') === false && isConsumerFile('scripts/data/a.json') === false)
  ok('F5 六目录之外排除', isConsumerFile('docs/a.ts') === false && isConsumerFile('deploy/win/a.ps1') === true && isConsumerFile('monitoring/a.sh') === true)
  ok('F6 .husky/ 根下无扩展名钩子计入(真仓里它是若干名字的唯一兑现点)', isConsumerFile('.husky/post-commit') === true && dialectOf('.husky/post-commit') === 'sh')
  ok('F7 但 .husky 的子目录里仍按扩展名判,.husky/README.md 不算', isConsumerFile('.husky/README.md') === false)

  // ── 三态 + 退出码(端到端构造面)────────────────────────────
  const e1 = runCase({ doc: '- 紧急跳过 `HUSKY_SKIP_W=1` 即可', faces: [js('scripts/w.mjs', 'if (process.env.HUSKY_SKIP_W === "1") skip()')] })
  ok('E1 承诺 + JS 读点 ⇒ wired,exit 0', e1.counts.wired === 1 && e1.counts.fake === 0 && e1.exit === 0, JSON.stringify(e1.counts))
  const e2 = runCase({ doc: '- 紧急跳过 `HUSKY_SKIP_F=1` 即可' })
  ok('E2 承诺、零读点 ⇒ fake', e2.counts.fake === 1 && e2.counts.wired === 0)
  const e2s = runCase({ doc: '- 紧急跳过 `HUSKY_SKIP_F=1` 即可', strict: true })
  ok('E2b --strict 下存量假承诺逐条点名并 exit 1', e2s.exit === 1 && e2s.fake[0].name === 'HUSKY_SKIP_F' && e2s.fake[0].where[0].line === 1)
  const e3 = runCase({ doc: '- 紧急跳过 `HUSKY_SKIP_W=1`\n- **禁止**设置 `HUSKY_SKIP_N=1`', faces: [js('scripts/w.mjs', 'process.env.HUSKY_SKIP_W')] })
  ok('E3 禁令句 ⇒ denied,不需要读点,与承诺同篇时 --strict 也不判红', e3.counts.denied === 1 && e3.counts.fake === 0 && e3.exit === 0, JSON.stringify(e3.counts))
  ok('E3c 纯禁令文档 0 个出路式承诺 ⇒ 判死 exit 2(spec 拍板:绝不记绿)', runCase({ doc: '- **禁止**设置 `HUSKY_SKIP_N=1`' }).exit === 2)
  const e4 = runCase({ doc: '- 紧急跳过 `HUSKY_SKIP_W=1`\n- **禁止**用 `HUSKY_SKIP_B=1` 绕过它', faces: [js('scripts/w.mjs', 'process.env.HUSKY_SKIP_W')] })
  ok('E4 同窗出路+禁令 ⇒ ambiguous 只报不判红(文档措辞问题不是提交者的错)', e4.counts.ambiguous === 1 && e4.counts.denied === 1 && e4.counts.fake === 0 && e4.exit === 0, JSON.stringify(e4.counts))
  const e5 = runCase({ doc: '- `HUSKY_SKIP_U=1` 关的是整块', strict: true })
  ok('E5 角色判不出 ⇒ undetermined(不并 fake 也不并 wired)', e5.counts.undetermined === 1 && e5.counts.fake === 0 && e5.counts.wired === 0)
  ok('E5b undetermined 默认档不拦(与真承诺同篇时 exit 0)、--strict 判死 exit 2', runCase({ doc: '- 紧急跳过 `HUSKY_SKIP_W=1`\n- `HUSKY_SKIP_U=1` 关的是整块', faces: [js('scripts/w.mjs', 'process.env.HUSKY_SKIP_W')] }).exit === 0 && e5.exit === 2)
  ok('E5c wired/denied/undetermined 三桶不得互相顶账', e1.counts.wired + e3.counts.denied + e5.counts.undetermined === 3 && [e1, e3, e5].every((r) => r.counts.fake === 0))
  const e6 = runCase({ doc: '# 本文件不写任何跳门变量' })
  ok('E6 枚举到 0 个承诺 ⇒ 判死 exit 2(绝不记绿)', e6.counts.promises === 0 && e6.exit === 2 && /枚举到 0/.test(String(e6.fatal)))
  ok('E6b 0 承诺时 --strict 也是 2(不是 1,不是 0)', runCase({ doc: '# 没有承诺', strict: true }).exit === 2)
  const e7 = runCase({ doc: '- 紧急跳过 `HUSKY_SKIP_K=1`', unresolved: ['scripts/boom.mjs'] })
  ok('E7 读点面不完整 ⇒ "零读点"落 undetermined,不落 fake(少扫不是"没有")', e7.counts.fake === 0 && e7.counts.undetermined === 1)
  ok('E7b 读点面不完整时带读点的名字仍算 wired(正面证据不受影响)', runCase({ doc: '- 紧急跳过 `HUSKY_SKIP_K=1`', faces: [js('scripts/k.mjs', 'process.env.HUSKY_SKIP_K')], unresolved: ['scripts/boom.mjs'] }).counts.wired === 1)
  const e8 = runCase({ doc: '- 紧急跳过 `HUSKY_SKIP_W=1`\n- 紧急跳过 `HUSKY_SKIP_E=1` skip-env-promise-exempt: 该出路已由 187 号 runner 注册项兑现', faces: [js('scripts/w.mjs', 'process.env.HUSKY_SKIP_W')] })
  ok('E8 带原因的行内豁免 ⇒ 只救那一行,计入 exempt 并点名(与真承诺同篇时 exit 0)', e8.counts.exempt === 1 && e8.counts.fake === 0 && e8.exit === 0 && e8.exempt[0].where[0].reason.includes('runner'), JSON.stringify(e8.counts))
  const e9 = runCase({ doc: '- 紧急跳过 `HUSKY_SKIP_E=1` skip-env-promise-exempt:', strict: true, faces: [] })
  ok('E9 裸标记(无原因)不算通过 ⇒ 仍判 fake(严格档 exit 1)', e9.counts.exempt === 0 && e9.counts.fake === 1 && e9.exit === 1)
  ok('E10 豁免只救本行:同行另一处仍判 fake', runCase({ doc: '紧急跳过 HUSKY_SKIP_T=1\n紧急跳过 HUSKY_SKIP_T=1 skip-env-promise-exempt: 逐条读过注册表', strict: true }).counts.ambiguous === 0 && runCase({ doc: '紧急跳过 HUSKY_SKIP_T=1\n紧急跳过 HUSKY_SKIP_T=1 skip-env-promise-exempt: 逐条读过注册表', strict: true, faces: [] }).counts.fake === 1)
  const e11 = runCase({ doc: '- 紧急跳过 `HUSKY_SKIP_R=1`', baseline: new Set(['HUSKY_SKIP_OLD']) })
  const e12 = runCase({ doc: '- 紧急跳过 `HUSKY_SKIP_R=1`', baseline: new Set(['HUSKY_SKIP_R']) })
  ok('E11 差值棘轮:基线里没有的假承诺 ⇒ 判红 exit 1', e11.newlyFake.length === 1 && e11.exit === 1)
  ok('E12 基线(HEAD 面)已有的存量 ⇒ 只点名不判红 exit 0(否则就是恒红门)', e12.newlyFake.length === 0 && e12.counts.fake === 1 && e12.exit === 0)
  ok('E12b 存量减少不拦(承诺撤回改禁令 ⇒ 新承诺可核且 exit 0)', runCase({ doc: '- 紧急跳过 `HUSKY_SKIP_W=1`\n- **禁止**提 `HUSKY_SKIP_R`', faces: [js('scripts/w.mjs', 'process.env.HUSKY_SKIP_W')], baseline: new Set(['HUSKY_SKIP_R']) }).exit === 0)
  ok('E13 strict 优先级:有 undetermined 时 exit 2(不冒 1)', runCase({ doc: '紧急跳过 HUSKY_SKIP_Z=1\n`HUSKY_SKIP_Q=1` 关的是整块', strict: true, faces: [js('scripts/z.mjs', 'process.env.HUSKY_SKIP_Z')] }).exit === 2)
  ok('E14 枚举失败 ⇒ 任何档 exit 2,绝不冒"没有读点"', runCase({ doc: '紧急跳过 HUSKY_SKIP_Y=1', enumeration: 'failed', enumError: 'git grep died' }).exit === 2 && runCase({ doc: '紧急跳过 HUSKY_SKIP_Y=1', enumeration: 'failed', enumError: 'x', strict: true }).exit === 2)
  const e15 = evaluate({ docs: [{ rel: 'AGENTS.md', text: '紧急跳过 HUSKY_SKIP_G=1' }, { rel: 'README.md', text: null }], faces: [], face: 'staged', strict: false, enumeration: 'ok' })
  ok('E15 被审文档面取不到 ⇒ exit 2,且不退回另一面(退回=把"没判"写成"判了")', e15.exit === 2 && e15.docErrors.length === 1 && e15.counts.fake === 0)
  const e16 = runCase({ doc: '紧急跳过 HUSKY_SKIP_DUP=1', faces: [{ rel: 'scripts/tests/fixture.mjs', text: 'process.env.HUSKY_SKIP_DUP' }] })
  ok('E16 夹具面的读点对本门不可见 ⇒ 判 fake(宁漏不误报,此档不得改成判红之外的处置)', e16.counts.fake === 1)
  const e17 = runCase({ doc: '紧急跳过 HUSKY_SKIP_A=1', faces: [{ rel: '.husky/post-commit', text: 'if [ -n "$HUSKY_SKIP_A" ]; then :; fi' }] })
  ok('E17 钩子文件(无扩展名)里的 $NAME 是真读点 ⇒ wired', e17.counts.wired === 1 && e17.exit === 0)
  ok('E18 一名多处:任一处是承诺就必须兑现(别处的否定不替承诺背书)', runCase({ doc: '紧急跳过 HUSKY_SKIP_M=1\n禁止用 HUSKY_SKIP_M=1', faces: [], strict: true }).counts.fake === 1)
  ok('E19 --json 的 exit 必须与实际退出码同形(evaluate 直接给 exit)', e12.exit === (e12.counts.newlyFake.length > 0 ? 1 : 0))
  ok('E20 文档名去重后一名一条(wired/fake 计数不随出现次数虚增)', runCase({ doc: '紧急跳过 HUSKY_SKIP_P=1 与 紧急跳过 HUSKY_SKIP_P=1', faces: [js('scripts/p.mjs', 'process.env.HUSKY_SKIP_P')] }).counts.wired === 1)
  ok('E21 名字面:非 HUSKY_SKIP_ 前缀不进承诺面', extractOccurrences('HUSKY_ARCHIVE=1 和 HUSKY_SKIP_= 和 HUSKY_SKIP_1A', 'AGENTS.md').map((x) => x.name).join(',') === 'HUSKY_SKIP_1A')

  // ── 面选择 ─────────────────────────────────────────────────
  ok('S1 两面旗同给 ⇒ 判死(不得挑一面的绿)', faceFromArgv(['--staged', '--worktree']).face === null && Boolean(faceFromArgv(['--staged', '--worktree']).error))
  ok('S2 单面旗如实取档,无旗仍默认 head', faceFromArgv(['--staged']).face === 'staged' && faceFromArgv(['--worktree']).face === 'worktree' && faceFromArgv([]).face === 'head')
  ok('S3 遮罩调用点纪律:findReads 内只经 maskFace 一处,maskFace 自身只引 code-mask 一层(maskComments ×1 + maskScriptComments ×2)', (String(maskFace('x.mjs', 'a\n')).length > 0) && String(findReads).split('maskFace(').length - 1 === 1 && ['maskComments(', 'maskScriptComments('].reduce((n, t) => n + String(maskFace).split(t).length - 1, 0) === 3)
  ok('S4 自检 harness:传函数必须记红(§22c 恒绿断言)', (() => {
    const probe = makeAssert(() => {})
    probe.ok('一条恒真式', () => true)
    return probe.state.fails.length === 1 && probe.state.pass === 0
  })())
  ok('S5 断言只认 cond === true(false 与非布尔都记红)', (() => {
    const p = makeAssert(() => {})
    p.ok('a', 'yes')
    p.ok('b', 0)
    p.ok('c', true)
    return p.state.pass === 1 && p.state.fails.length === 2
  })())

  console.log(state.fails.length ? `\n❌ ${state.fails.length} 例失败(通过 ${state.pass})` : `\nskip-env-promise 自检通过:${state.pass} 例`)
  process.exit(state.fails.length ? 1 : 0)
}

function report(r) {
  const head =
    `[skip-env-promise] 判定面=${r.face} 承诺名=${r.counts.promises}(出现点 ${r.counts.occurrences}) 兑现=${r.counts.wired} ` +
    `假承诺=${r.counts.fake} 禁令=${r.counts.denied} 两可=${r.counts.ambiguous} 未判定=${r.counts.undetermined} 豁免=${r.counts.exempt} ` +
    `新增判红=${r.counts.newlyFake}${r.baselineUsed ? `(基线面=head,基线假承诺 ${r.baselineSize})` : '(未取基线)'} ` +
    `候选文件=${r.candidateFiles} 枚举=${r.enumeration}`
  const lines = [head]
  for (const f of r.newlyFake) lines.push(`  ❌ 新增假承诺 ${f.name} —— 文档承诺了出路而兑现面零读点:${f.where.map((w) => `${w.file}:${w.line}`).join(' / ')}`)
  for (const f of r.fake) if (!r.newlyFake.includes(f)) lines.push(`  ⚠️ 存量假承诺 ${f.name}(HEAD 面已有 ⇒ 只点名不判红):${f.where.map((w) => `${w.file}:${w.line}`).join(' / ')}`)
  for (const u of r.undetermined) lines.push(`  ❔ 未判定 ${u.name}:${u.why}${u.where && u.where.length ? `(${u.where.map((w) => `${w.file}:${w.line}`).join(' / ')})` : ''}`)
  for (const a of r.ambiguous) lines.push(`  ❓ 措辞两可 ${a.name}:${a.why}(按 denied 处理,不判红)`)
  for (const x of r.exempt) lines.push(`  ⚪ 已豁免 ${x.name}:${x.where.map((w) => `${w.file}:${w.line}「${w.reason}」`).join(' / ')}`)
  if (r.docErrors.length) for (const d of r.docErrors) lines.push(`  ❌ 被审面取不到:${d}`)
  if (r.enumeration === 'failed') lines.push(`  ❌ 兑现面候选枚举失败:${r.enumError || ''} —— 这不是"没有读点"`)
  if (r.fatal) lines.push(`  ⚠️ ${r.fatal}`)
  if (r.counts.denied) lines.push(`  ℹ️ 禁令档 ${r.counts.denied} 个名字逐条点名:${r.denied.map((d) => d.name).join(', ')}`)
  if (r.counts.undetermined) lines.push('  ℹ️ 未判定与 wired/fake **不并桶**:本门没有对它们做出结论,--strict 会判死')
  if (r.counts.fake && !r.newlyFake.length && !r.strict) lines.push('  ℹ️ 存量假承诺在默认(提交链)档只点名 —— 判红存量就是一台与任何提交都无关的恒红门,唯一结局是各会话 --no-verify 连带废掉全部守门(§12e/§12f);问责出口:--strict')
  return lines.join('\n')
}

function main(argv) {
  const { face, error } = faceFromArgv(argv)
  if (error) {
    console.error(`❌ 无法判定: ${error}`)
    return 2
  }
  if (argv.includes('--help')) {
    console.log(
      [
        '用法: node scripts/check-skip-env-promise.mjs [--staged|--worktree|--strict|--json|--self-test]',
        '  默认判 HEAD 面(提交链档 = 与 HEAD 面的假承诺集合做差,只判新增);--strict 为人工问责档。',
        '  本门已接线:守门 172(guardian-runner 注册块 skipEnv 一行),提交链档跑 --staged;自身不承诺任何跳门变量。',
        '  退出码 0=无新增假承诺 / 1=判红 / 2=无法判定(含枚举到 0 个承诺)。',
      ].join('\n'),
    )
    return 0
  }
  assertRepoRoot(ROOT, '本门')
  const strict = argv.includes('--strict')
  const json = argv.includes('--json')
  let snap
  let base = null
  try {
    snap = snapshot(face, ROOT)
    if (face !== 'head') base = new Set(snapshot('head', ROOT).fake ? [] : [])
  } catch (e) {
    const msg = e instanceof Undetermined ? e.message : (e?.message ?? e)
    console.error(`❌ 无法判定(exit 2): ${msg}`)
    if (!(e instanceof Undetermined)) console.error(e?.stack ?? '')
    return 2
  }
  // 基线 = **完整的一轮 HEAD 面快照**(自己的清单 + 自己的正文),不是把两轮的面拼起来。
  let baselineSet = null
  if (face !== 'head') {
    try {
      const bSnap = snapshot('head', ROOT)
      const bRes = evaluate({ docs: bSnap.docs, faces: bSnap.faces, face: 'head', strict: false, unresolved: bSnap.unresolved, enumeration: bSnap.enumeration, enumError: bSnap.enumError })
      baselineSet = new Set(bRes.fake.map((f) => f.name))
    } catch (e) {
      const msg = e instanceof Undetermined ? e.message : (e?.message ?? e)
      console.error(`❌ 无法判定(exit 2): 基线面(head)取不到 ⇒ 差值棘轮无法成立,不得退回"全判红"或"全放过":${msg}`)
      return 2
    }
  }
  const res = evaluate({
    docs: snap.docs,
    faces: snap.faces,
    face,
    strict,
    baselineFake: baselineSet,
    unresolved: snap.unresolved,
    enumeration: snap.enumeration,
    enumError: snap.enumError,
  })
  if (json) {
    console.log(JSON.stringify({ ...res, enumError: res.enumError || null }, null, 2))
    return res.exit
  }
  console.log(report(res))
  return res.exit
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  if (process.argv.includes('--self-test')) selfTest()
  else process.exit(main(process.argv.slice(2)))
}

export const __test__ = {
  sentenceWindow,
  roleOfClause,
  hasExemption,
  extractOccurrences,
  classifyName,
  findReads,
  maskFace,
  dialectOf,
  isConsumerFile,
  evaluate,
  faceFromArgv,
  grammarRe,
  makeAssert,
  READ_GRAMMARS,
  PREFILTER,
  DOC_FILES,
  CONSUMER_DIRS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
