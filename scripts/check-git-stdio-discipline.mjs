#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门:git 派生调用(options)的 **stdio 纪律** —— 本机派生面 EBUSY 病灶的判据门。
 *
 * 病根(2026-10-03,30 组对照实测;本门立时复测 2 组 × 10 次,结论同形):
 * `execFileSync('git', [...], { cwd, encoding, windowsHide, timeout })`
 * ——**不写 `stdio`** ⇒ 0/30 成功,抛 EBUSY;同一段补 `stdio: ['ignore','pipe','pipe']`
 * ⇒ 30/30 成功。同刻在交互 bash 里直接跑 git 正常 ⇒ 与 git 被锁、并发无关。
 * **绝对路径 `GIT_BIN` / `gitBinary()` / `resolveGitBin()` 不是豁免** —— EBUSY 是**派生面**
 * 的病,与 PATH 无关(所以"改成绝对路径就安全了"这条直觉在本机是错的)。
 * 另一副面孔:`execSync(<字符串>)` / `shell: true` 经 `cmd.exe`,同样 100% EBUSY,同源同修法。
 *
 * ⚠️ **间歇性是这坑的要害**:实测有一次得到"不写 stdio 6/6 通过" ⇒ **单次/小样本探测会给出
 * "不需要 stdio"的假象**。因此本门只对**成组的静态判据**下结论,任何"试一下好像不用 stdio"
 * 的结论都不成立 —— 那正是本机的病窗形状。
 *
 * ── 为什么必须是**独立的一道门**,而不是并进 `check-git-read-timeout.mjs`(:298-308)─────
 * 那门的射程是 `HOT` **静态清单**(只扫登记过的热文件),而本缺陷遍及 `scripts/` 下 400+ 处
 * 调用点 ⇒ 并进去会造成"只扫热文件、其余静默漏过" = **假绿**,是本仓反复吃过的坑。
 * 且它的 CALLER(:145)对 git 二进制**不做要求**、判据面是 timeout,与本门不同轴。
 *
 * ── 第一原则:判据必须匹配「调用括号内的文本」这**一个整体**,绝不逐行匹配 ──────────────
 * 做法:正则先定位调用点(CALLER),再从 `(` 起做**括号配平**(跳过字符串内的括号)取出整个调用
 * 文本,然后在**这一个字符串**上判 `stdio` 是否作为属性名出现。
 * **为什么**:本仓已吃过"源码正则自检判据被 prettier 折行改瞎"的大亏(形态自检用例在格式化后
 * 凭空失明)。配平取整体 ⇒ prettier 把单行折成多行**不改判据**(自检里有专门一例钉这件事,
 * 见 `prettier 折行不改判据`)。
 * ⚠️ `callSpan` / `markHidden` 是**照 `check-git-read-timeout.mjs`:185/:214 的形态复制**的,
 * **刻意不 import 它**:门之间互相 import 会让一个门塌连带另一个(本仓对"两份真相"零容忍)。
 * 复制形态而非共用实现是本门唯一接受"两份实现"的位置 —— 换来的是**塌陷隔离**。
 *
 * ── 口径(逐条都有本仓教训支撑)────────────────────────────────────────────────
 *  1. **射程 = `scripts/` 与 `scripts/lib/` 全域**,枚举取 `git ls-files`,**不用静态清单**
 *     —— 清单会漏(漏的那部分永远绿着)。`scripts/lib` 是 `scripts` 的子目录,一次枚举即覆盖;
 *     结论行仍单独报出 lib 的计数,免得"覆盖了 lib"只存在于本注释里。
 *  2. **取不到内容必须报「未判定」并 exit 2**,绝不折成"0 处违规"当绿。本仓铁律:
 *     **少扫不等于没有违规**。少了文件还报绿,比不报更坏(它替人做出"这一格已被看过"的判断)。
 *  3. **只判 `stdio` 作为属性名出现,不判取值**
 *     (`/(^|[{,\s])stdio\s*:|(?:^|[{,])\s*stdio\s*[,}]/`,两支:显式属性 + ES6 **属性简写**)。理由:
 *     `['pipe','pipe','pipe']`(喂 stdin 的 batch 族,见 `scripts/lib/face-reader.mjs:94`
 *     的两态)与 `['ignore','pipe','pipe']` **都合规**;判取值会把前者误伤成红。
 *     ⚠️ 第二支不是"名字里出现 stdio 就算",而是**两端**都要求对象字面量的键位边界:
 *     前端必须是 `{`/`,`、后端必须是 `,`/`}`,于是 `{ encoding: stdio }`(值位置)、`{ stdioX }`、
 *     `xstdio:` / `my_stdio:` 一律仍判红。**漏掉第二支的实测代价**:真仓
 *     `scripts/git-heal-broken-links.mjs` 的 `git()` 包装器 options 里写的是简写 `stdio,`,
 *     旧形态把它误报成「options 内无 stdio 属性名」—— 门把已合规的调用判红,逼人去改没坏的代码。
 *  4. **判据落在该次调用的 options 内**,不能落"这个文件有没有 stdio"。理由:
 *     `scripts/check-root-dir-clean.mjs` 现存该形态 —— :265/:281 合规而 :75 裸奔,
 *     按文件判会被另一处合规调用**洗白**。自检 `同一文件内合规调用不得洗白裸奔调用` 钉这一条。
 *  5. **CALLER 覆盖 A 类(裸 `'git'`/`"git"`)与 C 类(变量/绝对路径形态)**,并一并接住
 *     `execSync('git …')` 字符串形态与 `shell: true`(另一副面孔,同源同修法)。
 *  6. **自豁免**:门自身与它自己的镜像测试必然含字面量示例 ⇒ 整文件豁免(`SELF_EXEMPT`)。
 *     **但严禁行内豁免注释通道** —— 见下。
 *
 * ── 为什么禁行内豁免(AGENTS §"裁决账不是豁免通道")────────────────────────────────
 * 行内注释豁免(`// stdio-ok: 因为…`)的问题是**它长在被审面里**:格式化、搬运、复制粘贴都会
 * 带着它走,而审它的人看不见它 —— 一条"看不见的通道"必然被当成"已经解决过"的证据,于是
 * 缺陷从视野里消失且无人复裁。所以豁免**只能**落一个**具名数据文件**
 * (`EXEMPTIONS_FILE`),字段与到期语义照本仓既有形态(`scripts/*exemptions*.json`):
 * 每条 `{ file, reason(非空且可复核), owner, reviewBy(ISO 日期) }`,形态坏或已过期 ⇒ 不再豁免
 * 且**照计违规**。**裁决账(只登记"证据不足、限期再看")不是豁免通道**:豁免裁定"这一处不算错",
 * 裁决只登记"这一处还没判" —— 两者失效方向不同,不得互相借用,更不得用它绕过本行的禁令。
 *
 * ── 三面 ────────────────────────────────────────────────────────────────────────
 * 与门 80 同形态:`--staged` 判**索引 blob**、缺省判 **HEAD blob**、`--worktree` 只作人工
 * 逃生舱(盘上可能是并行会话的半编辑态,不得作为提交门禁)。面由 `selectFace` 选 —— 不自己
 * 发明一套(那正是"每道门各有一个面"的起点)。
 *
 * 用法:
 *   node scripts/check-git-stdio-discipline.mjs              # 缺省判 HEAD blob
 *   node scripts/check-git-stdio-discipline.mjs --staged     # 判索引 blob
 *   node scripts/check-git-stdio-discipline.mjs --worktree   # 人工逃生舱
 *   node scripts/check-git-stdio-discipline.mjs --self-test
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// 判定面取材一律走共用层(与门 80 同口径):全量判 HEAD blob、`--staged` 判索引 blob。
// ⚠️ 本门**不**自己写 `execFileSync('git', …)`:本机派生面 EBUSY 病灶正是"不写 stdio 的派生",
// 而本门自己就是那道判据 —— 自己踩一遍会让门在真仓上间歇性失明(本仓对"判据自身被 env 收口"的
// 要求见 face-reader 头注第 2 条:stdio[0] 设错时 git **不报错**,只是每个对象都"取不到")。
import {
  Undetermined,
  assertRepoRoot,
  catBatch,
  gitRaw,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = dirname(HERE)
const GIT_TIMEOUT = 120000
const FACE_TAG = { head: 'HEAD blob', staged: '索引 blob', worktree: '工作树(逃生舱)' }

/**
 * 射程:**目录前缀**,不是文件清单。
 * 一条前缀 = 一整面递归域。刻意不用静态文件清单:清单会漏,而漏掉的部分永远绿着 ——
 * 本门存在的意义正是"411 处散在 900 多个文件里,清单式射程只能看见登记过的那几行"。
 */
export const SCAN_ROOTS = ['scripts']

/**
 * 只对**源码扩展名**判。仓里的 `.md` / `.json` / `.ps1` 不 spawn git;若一并判,文档里
 * 贴一段 `execFileSync('git', …)` 示例就会成红 —— 那种红只会逼人关掉整条守门链
 * (同 check-git-read-timeout 的"宁漏不误报"取向)。被跳过的文件**按扩展名如实报数**,
 * 不静默(一个门把 300 个文件悄悄跳过而账面读起来像"扫过了",是本仓反复记过的失效型)。
 */
export const SOURCE_EXT = /\.(?:mjs|mts|cjs|js|cts|ts)$/

/**
 * 自豁免:门自身与它的镜像测试。这两个文件**必然**含 `'git'` / `stdio:` 字面量示例
 * (自检夹具与钉判据的源码锁),不豁免就是恒红 ⇒ 恒红门会被 `--no-verify` 绕过,连带全部守门作废。
 * 形态照 `check-git-read-timeout.mjs` 的 `SELF_EXEMPT`(= 本门自身 + 本门镜像测试两个**精确路径**)。
 *
 * ⚠️ 这里豁免的是**这两个文件自己**,不是"`scripts/tests/**` 整类"。测试面里的真实缺陷
 * (本仓实测测试/evidence 侧占 A 类 120 处)仍然是红的 —— 把整类测试面豁免掉会把本门
 * 变成"只扫生产代码",而那 120 处同样在派生 git、同样 EBUSY。结论行按 `scripts/tests/**`
 * 与其余分组分别报数,两组都在视野里。
 */
export const SELF_EXEMPT = [
  'scripts/check-git-stdio-discipline.mjs',
  'scripts/tests/check-git-stdio-discipline.test.mjs',
]

/**
 * 豁免**唯一**通道:一个具名 JSON 数据文件。**行内注释不是通道**(理由见文件头)。
 * 每条字段:`{ file, reason, owner, reviewBy }` —— 与本仓既有形态(`scripts/*exemptions*.json`)
 * 同构:形态坏或 `reviewBy` 已过期 ⇒ 该条**不再豁免且照计违规**,并把该条点名报出。
 *
 * 刻意**不**在本票里创建这个文件:票面只许新建"门 + 测试"两个文件,而一张**空台账**在
 * 本仓毫无价值(空 = 零豁免,与不加载等价)。门读它的行为已实现并在自检里构造证明;
 * 第一条真实豁免落地时,台账由那次改动一并建起 —— 那时它才有 contents 可被 review。
 * 本仓对"必须被人 review 的东西"的要求,反对的正是"先建一个空壳再让人以为豁免机制已就绪"。
 */
export const EXEMPTIONS_FILE = 'scripts/check-git-stdio-exemptions.json'

/** 派生函数名。`fork` 也在内:它同样派生子进程,漏掉它就是一处结构性盲区。 */
const FN = '(?:execFileSync|execSync|execFile|spawnSync|spawn|fork)'

/**
 * git 二进制的**全部已知形态**(A 类字面量 + C 类变量/绝对路径形态)。
 * ⚠️ 绝对路径形态**不是豁免**:EBUSY 是派生面的病,与怎么找到那个 exe 无关。
 * 所以 C 类与 A 类同判 —— 写成"只有裸 `'git'` 才判"就是给 C 类 103 处发免检通行证。
 */
const BIN_LITERAL = '(?:\'git\'|"git")'
/**
 * ⚠️ 末尾的 `(?![A-Za-z0-9_$])` **不是可有可无的**:没有它,裸 `GIT` 会**前缀命中**
 * `GIT_BASH` / `GIT_IN_TESTS` 这类名字 —— 而 `GIT_BASH` 是 **bash 不是 git**
 * (真仓实测 3 处,如 `scripts/re-home-junctions.mjs:638` 的 `spawnSync(GIT_BASH, ['/c','mklink',…])`)。
 * 把 bash 的派生判成"git 派生缺 stdio"是一次**归因错误**:红是真的(它确实没 stdio),
 * 但报出来的成因是错的,而错因会把人引去改一个与 git 无关的地方。
 * 首字面量那边不需要它:`'git'` 后面必然是 `,` 或 `)`。
 */
const BIN_VAR =
  '(?:GIT_BIN|GIT|gitBin|gitPath|gitExe|gitBinary\\s*\\(\\s*\\)|resolveGitBin\\s*\\(\\s*\\))(?![A-Za-z0-9_$])'

/**
 * 调用点①:**首参是 git 二进制**(数组/变量参数形态)。
 * 数组内容**整体不锚定** —— 只判 options 与首参,与参数数组长什么样无关。
 */
export const CALLER_BIN = new RegExp(`\\b(${FN})\\s*\\(\\s*(?:${BIN_LITERAL}|${BIN_VAR})`, 'g')

/**
 * 调用点②:**首参是以 `git ` 开头的整串命令**(`execSync('git ls-files')` / 反引号模板)。
 * 这一族经 `cmd.exe`,是同一病灶的另一副面孔;旧口径只认①,等于给它发免检通行证。
 */
export const CALLER_STRING = new RegExp(`\\b(${FN})\\s*\\(\\s*(?:'git\\s|\"git\\s|\`git\\s)`, 'g')

/**
 * 调用点③:**首参是裸标识符**(包装器把二进制当参数传)。**不判红**,但**计入"不判"**并逐条报出。
 * 这一族是 C 类的结构性盲区:判据看不见"这个变量是不是 git",而把它折成 0 违规就等于
 * 替人做出"这里没有 git 派生"的判断(本仓对"没判"的禁令)。
 */
export const CALLER_IDENT = new RegExp(`\\b(${FN})\\s*\\(\\s*([A-Za-z_$][\\w$]*)\\s*,`, 'g')

/**
 * `stdio` 是否**作为属性名**出现。只判属性名、**不判取值** —— 见文件头口径第 3 条。
 * 形状要求属性名前是行首/`{`/`,`/空白,避免把 `xstdio:` / `my_stdio:` / 对象键 `"stdio":`(字符串键)
 * 之外的东西算进来。
 *
 * ⚠️ **两支,而不是只认冒号**(2026-10-10 实测误判修正):
 *   ① `/(^|[{,\s])stdio\s*:/` —— 显式属性,**原判据一字未改**(变异自证就是把它退回这一支);
 *   ② `/(?:^|[{,])\s*stdio\s*[,}]/` —— ES6 **属性简写** `{ stdio }` / `{ stdio, cwd }` / `{ cwd, stdio }`。
 * 漏掉②的实测代价:真仓 `scripts/git-heal-broken-links.mjs` 的 `git()` 包装器 options 里写的是
 * `stdio,`(值先算好再简写),门把它报成「options 内无 stdio 属性名」—— **误判已合规的调用**。
 * 而简写形态恰恰满足本门自己的意图(口径第 3 条:只判 `stdio` 作为**属性名**是否出现),所以
 * 那是判据失明,不是缺陷在别处。
 *
 * ⚠️ **第②支为什么两端都收紧**(收紧到"对象字面量的键位边界"而不是"名字是 stdio"):
 *  - 前端只认 `{` / `,`(不是任意空白,更不是 `:`):`{ encoding: stdio }` 是**值位置**上恰好叫
 *    `stdio` 的变量,不是属性名 —— 把它算合规会把一格失明静默洗成绿。
 *  - 后端必须紧跟 `,` 或 `}`:`{ stdioX: 1 }` 的属性名是 `stdioX`,不是 `stdio`。
 *  这样 `xstdio:` / `my_stdio:` / `mystdio,` 全部仍判红(前端字符就不是 `{`/`,`),**原判据的牙一点没卸**。
 */
export const STDIO_PROP = /(^|[{,\s])stdio\s*:|(?:^|[{,])\s*stdio\s*[,}]/

/** `shell: true` / `shell: 'cmd.exe'` —— 经 cmd.exe 的另一副面孔,同源同修法。 */
export const SHELL_PROP = /(^|[{,\s])shell\s*:\s*(?:true\b|['"`])/

const lineOf = (src, idx) => src.slice(0, idx).split('\n').length
const norm = (p) => String(p).replace(/\\/g, '/')

/**
 * 从 `(` 起做括号配平(**跳过字符串内的括号**),返回整个调用文本。
 *
 * 形态复制自 `check-git-read-timeout.mjs:185`,**刻意不 import**(见文件头:门之间互相 import
 * 会让一个门塌连带另一个)。与原件同形的两处要点:① 字符串态要跳 `\`,否则 `'\'` 之后的
 * 引号配对会错位;② 花括号不参与深度计数(JS 里 `{`/`}` 不改变调用实参的边界,计了反而会在
 * 对象字面量里数错 —— 而 prettier 折行恰恰最爱在对象字面量处折行)。
 */
export function callSpan(src, openIdx) {
  let depth = 0
  let str = null
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i]
    if (str) {
      if (c === '\\') i++
      else if (c === str) str = null
      continue
    }
    if (c === "'" || c === '"' || c === '`') str = c
    else if (c === '(') depth++
    else if (c === ')') {
      depth--
      if (depth === 0) return src.slice(openIdx, i + 1)
    }
  }
  // 未配平(源码被截断/ 语法正在编辑中)⇒ 返回剩余全文。**不抛**:
  // 抛了就把"这一份源码不完整"变成整门 exit 2;而截断文件里那句调用多半仍带着它的 options,
  // 交给下方 STDIO_PROP 判 —— 判红或判绿都只影响这一处,不影响其余文件的读数。
  return src.slice(openIdx)
}

/**
 * 标记"落在注释或字符串字面量里"的字节位置(1=隐藏)。
 *
 * 形态复制自 `check-git-read-timeout.mjs:214`,**刻意不 import**(同上,塌陷隔离)。
 * 关键设计:判据仍在**原文**上匹配,只用本遮罩**丢弃命中点位于字符串/注释内部**的那些结果。
 * 若改成"在遮罩后的文本上匹配",`'git'` 这个字面量本身会被遮掉 ⇒ 永远匹配不到 ⇒ 恒绿假绿。
 * 这一步是测试夹具逼出来的:`const fixture = "execFileSync('git', ['ls-files'])"`
 * 这种源码字符串不是真派生点,判它红只会逼人关掉整条链。
 */
export function markHidden(src) {
  const hidden = new Uint8Array(src.length)
  let i = 0
  const n = src.length
  const hide = (from, to) => {
    for (let k = from; k < Math.min(to, n); k++) if (src[k] !== '\n') hidden[k] = 1
  }
  while (i < n) {
    const c = src[i]
    if (c === '/' && src[i + 1] === '/') {
      const s = i
      while (i < n && src[i] !== '\n') i++
      hide(s, i)
      continue
    }
    if (c === '/' && src[i + 1] === '*') {
      const s = i
      i += 2
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++
      hide(s, i + 2)
      i += 2
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      const q = c
      const s = i
      i++
      while (i < n) {
        if (src[i] === '\\') {
          i += 2
          continue
        }
        if (src[i] === q) {
          i++
          break
        }
        i++
      }
      hide(s, i)
      continue
    }
    i++
  }
  return hidden
}

/**
 * 把整个调用文本在**顶层逗号**处切成实参列表(跳过字符串内与嵌套括号内的逗号)。
 *
 * 为什么必须做这一层而不能用正则去猜"有没有 options":options **经常被 prettier 折成多行**
 * (而"折行不改判据"正是本门的命门),任何逐行/跨行的正则猜测都会在折行处失明。顶层配平
 * 是唯一对折行免疫的切法 —— 它只看**括号结构**,不看行。
 *
 * @param span 从 `(` 起的整个调用文本
 * @returns {string[]} 顶层实参文本(首尾空白已去)
 */
export function splitArgs(span) {
  const text = String(span)
  const out = []
  let depth = 0
  let str = null
  let start = 1 // 跳过开头的 `(`
  for (let i = 1; i < text.length; i++) {
    const c = text[i]
    if (str) {
      if (c === '\\') i++
      else if (c === str) str = null
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      str = c
      continue
    }
    // 三种括号**都要配平**:`()[]` 是实参容器层,`{}` 是 options 的字面量外壳。
    // ⚠️ 漏掉 `{}` 会把 `{ a: 1, b: 2 }` 里的逗号当成顶层分隔 ⇒ options 被切成两半 ⇒
    // 实参个数虚增一倍(`hasOptionsArg` 于是把"没有 options"读成"有 options"),
    // 判据就在这一步静默失明(镜像 T12 抓到过这一格)。
    if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') {
      if (depth === 0) {
        // 只认调用自己的收尾括号。`)` 收尾时 depth 必为 0;`]`/`}` 收尾说明外层括号
        // 已被吃掉(callSpan 截断的边界),此时也收尾 —— 不得把尾巴当成实参内容。
        out.push(text.slice(start, i))
        return out.map((s) => s.trim()).filter((s) => s.length > 0)
      }
      depth--
    } else if (c === ',' && depth === 0) {
      out.push(text.slice(start, i))
      start = i + 1
    }
  }
  out.push(text.slice(start))
  return out.map((s) => s.trim()).filter((s) => s.length > 0)
}

/**
 * 该次调用有没有 options 实参。**按实参个数**判,不按文本猜。
 *  - `execSync(cmd, opts)` ⇒ 2 个起
 *  - `execFileSync(bin, argv, opts)` ⇒ 3 个起
 * 少于这个数就是**根本没有 options 可配 stdio** ⇒ 最纯的裸奔形态。
 *
 * ⚠️ 不能用"最后一个实参像不像对象字面量"来判:那会把 `execFileSync(GIT_BIN, args)`
 * 这种"第二实参是变量"的形态与"没有 options"混为一谈,而两者的修法提示不同。
 */
export function hasOptionsArg(args, isExecSync) {
  return args.length >= (isExecSync ? 2 : 3)
}

/** 首参是不是"以 `git ` 开头的整串命令"(execSync 那一族经 cmd.exe)。 */
export function isStringCommand(span) {
  return /^\(\s*(?:'git\s|"git\s|`git\s)/.test(String(span))
}

/**
 * 这个标识符**像不像"git 二进制"** —— 只用于"不判"那一格的计数,绝不用于判红。
 *
 * ⚠️ 为什么要区分 `gitBin` 与 `GIT_BASH`:后者是 **bash**(真仓
 * `scripts/re-home-junctions.mjs:638` 拿它跑 `mklink /J`)。把它记成"git 派生不可判"是一次
 * 归因错误 —— 而 `unknownBinary` 那一格恰恰是给人看的"这里有我判不了的东西",
 * 往里塞非 git 的东西,那一格就开始骗人。
 *
 * 判据:`GIT_` 后面若紧跟**另一个全大写词**,判为"另一个程序"(`GIT_BASH`);
 * 其余含 git 的名字(`gitBin` / `myGitRunner` / `GIT`)一律算像 git。
 */
export function isGitLikeName(name) {
  const n = String(name)
  if (!/git/i.test(n)) return false
  return !/^GIT_[A-Z]/.test(n)
}

/**
 * 遮掉**块注释与行注释**的内容(不动字符串)。
 *
 * 为什么要有这个独立出口:`stdio` 属性名的判据跑在**整个调用文本**上(第一原则),而那段文本里
 * 可能夹着注释 —— `{ encoding: 'utf8' /* stdio: [...] *\/ }` 里那个 `stdio:` 是**注释**,
 * 不是属性。少了这一步,判据会读成"已配 stdio" ⇒ **把违规洗成合规**,而且是静默的。
 * ⚠️ 只遮注释、**不遮字符串**:字符串态里`'git '` 这类首参必须仍可读(见 `isStringCommand`),
 * 且 `stdio` 作为属性名本就不落在字符串里。
 */
export function maskComments(text) {
  let out = ''
  let i = 0
  const n = text.length
  while (i < n) {
    const c = text[i]
    if (c === '/' && text[i + 1] === '/') {
      while (i < n && text[i] !== '\n') i++
      continue
    }
    if (c === '/' && text[i + 1] === '*') {
      i += 2
      while (i < n && !(text[i] === '*' && text[i + 1] === '/')) i++
      i += 2
      out += ' '
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      const q = c
      out += c
      i++
      while (i < n) {
        if (text[i] === '\\') {
          out += text.slice(i, i + 2)
          i += 2
          continue
        }
        out += text[i]
        if (text[i] === q) {
          i++
          break
        }
        i++
      }
      continue
    }
    out += c
    i++
  }
  return out
}

/**
 * 判一段**调用文本**。纯函数(判据本体),所以每一支都能被构造面证明,不必赌真仓此刻长什么样。
 *
 * 结论四态(不判与判红**同样重要**,不判绝不折成绿):
 *  - `ok`        —— options 内有 `stdio` 属性名 ⇒ 合规(**不判取值**)
 *  - `noStdio`   —— 有 options、无 `stdio`、不经 cmd.exe ⇒ **判红**(A/C 类同型缺陷)
 *  - `viaCmd`    —— 有 options、无 `stdio`、且经 `cmd.exe` ⇒ **判红**(另一副面孔,报它才给对修法)
 *  - `noOptions` —— 该次调用根本没有 options 实参 ⇒ 无从配 stdio ⇒ **判红**(最纯的裸奔形态)
 *
 * ⚠️ **`stdio` 在场就放过,不看 `shell`** —— 这是判序里唯一不能颠倒的一格。
 * `shell: true` / `execSync('git …')` 经 `cmd.exe` 是同一病灶的**另一副面孔**,而
 * "同源同修法"的修法就是补 `stdio`(文件头病灶段第4 条)。所以已经显式接管了 stdio 的
 * `shell: true` 调用是**合规**的 —— 把它判红会让人以为"补了 stdio 还不够",而那不是真相,
 * 且会把 361 处里本已修好的 302 处**误报成红**。误报的代价是逼人关掉整条守门链。
 * 换句话说:`viaCmd` 只决定**缺 stdio 时该报哪一个成因**(报 `shell: true` 比报"无 stdio"更可操作),
 * 不决定"有 stdio 还要不要判红"。
 *
 * ⚠️ 判据**只在这一个调用文本字符串上跑**,绝不逐行匹配(第一原则,见文件头)。
 * @param span 从 `(` 起的整个调用文本
 * @param isExecSync 该调用是不是 `execSync`(它的 options 在第 2 位而非第 3 位)
 * @returns {{verdict:'ok'|'noStdio'|'viaCmd'|'noOptions', stdio:boolean, shell:boolean}}
 */
export function judgeSpan(span, isExecSync = false) {
  const text = String(span)
  // 属性名判据跑在**注释已遮**的文本上:注释里的 `stdio:` 不是属性(否则违规被静默洗白)。
  const code = maskComments(text)
  const shell = SHELL_PROP.test(code)
  const stdio = STDIO_PROP.test(code)
  // options 在不在,先判 —— `execFileSync('git', ['x'])` 根本没有 options 可谈。
  if (!hasOptionsArg(splitArgs(text), isExecSync)) return { verdict: 'noOptions', stdio, shell }
  if (stdio) return { verdict: 'ok', stdio, shell }
  if (shell || isStringCommand(text)) return { verdict: 'viaCmd', stdio, shell }
  return { verdict: 'noStdio', stdio, shell }
}

/**
 * 判断一个源码字符串。**不判**的每一族都进 `skipped` 并带原因标签,调用方折成"分类计数"报出 ——
 * 一个门把"没判"折成 0,账面读起来与"全都判过且合规"完全一样(本仓对"没判"的禁令)。
 *
 * @param raw 源码正文
 * @param opts.selfExempt 该文件是否自豁免(豁免的命中仍计数,不进 misses)
 * @returns {{misses:Array, skipped:Array, shellFlagged:number}}
 */
export function scanSource(raw, opts = {}) {
  const selfExempt = opts.selfExempt === true
  const hidden = markHidden(raw)
  const misses = []
  const skipped = []
  let shellFlagged = 0
  // 先收①③,再收②:①的命中位置要用来把③的同位置命中剔掉(同一处调用不应计两次)。
  const bins = []
  const seen = new Set()
  const take = (m) => {
    seen.add(m.index)
    bins.push({ index: m.index, fn: m[1] })
  }
  for (const m of raw.matchAll(CALLER_BIN)) {
    if (hidden[m.index]) {
      skipped.push({ line: lineOf(raw, m.index), why: 'hiddenInLiteral' })
      continue
    }
    take(m)
  }
  for (const m of raw.matchAll(CALLER_STRING)) {
    if (hidden[m.index]) {
      skipped.push({ line: lineOf(raw, m.index), why: 'hiddenInLiteral' })
      continue
    }
    take(m)
  }
  for (const m of raw.matchAll(CALLER_IDENT)) {
    if (hidden[m.index]) continue
    if (seen.has(m.index)) continue
    const name = m[2]
    if (name === 'git') {
      // 裸 `git` 标识符(非常字面):算①的变量形态,交给 span 判
      take(m)
      continue
    }
    // 只把**名字像 git 的**标识符计入"不判"。`execFileSync(node, …)` 这类与 git 毫无关系的
    // 调用涌进这一格,会把"包装器里的 git 二进制不可判"这个真信息淹成一个没有信息量的总数 ——
    // 而一个失真的计数比没有计数更坏(它让人以为这一格已经看过了)。
    // ⚠️ `GIT_BASH` / `GIT_IN_TESTS` 这类**含 GIT 但不是 git 二进制**的名字要排除(实测前者是
    // bash)。判据是"去掉 GIT 后剩下的部分不是另一个程序名" —— 保守做法是要求名字里
    // **出现 git 作为独立词素**,而 `GIT_BASH` 里 git 后面跟着 `_` 接了别的程序名。
    if (!isGitLikeName(name)) continue
    skipped.push({ line: lineOf(raw, m.index), why: 'unknownBinary', name })
  }
  for (const b of bins) {
    const openIdx = raw.indexOf('(', b.index)
    const span = callSpan(raw, openIdx)
    const v = judgeSpan(span, b.fn === 'execSync')
    if (v.verdict === 'ok') continue
    if (v.verdict === 'viaCmd') shellFlagged++
    if (selfExempt) {
      skipped.push({ line: lineOf(raw, b.index), why: 'selfExempt' })
      continue
    }
    misses.push({ line: lineOf(raw, b.index), verdict: v.verdict })
  }
  return { misses, skipped, shellFlagged }
}

/** 依据正文的扩展名判定是否解析。非源码扩展名按扩展名归类,如实报数不静默。 */
export function isSourceFile(rel) {
  return SOURCE_EXT.test(rel)
}

/** 自豁免判定:精确路径(SELF_EXEMPT)。刻意不做前缀通配 —— 通配会把整个测试面变成盲区。 */
export function isSelfExempt(rel) {
  return SELF_EXEMPT.includes(norm(rel))
}

/** 测试面分组:结论行按它分组报数,免得"测试面也在射程内"只存在于注释里。 */
export function isTestSurface(rel) {
  return norm(rel).startsWith('scripts/tests/')
}

// ── 豁免台账 ──────────────────────────────────────────────────────────────────
/**
 * 读豁免台账。**只读一个具名 JSON 文件** —— 行内注释不是通道(文件头有为何禁的完整论证)。
 * @returns {{entries:Array, malformed:Array, absent:boolean}}
 */
export function loadExemptions(root, rel = EXEMPTIONS_FILE) {
  const abs = join(root, rel)
  if (!existsSync(abs)) return { entries: [], malformed: [], absent: true }
  let data
  try {
    data = JSON.parse(readFileSync(abs, 'utf8'))
  } catch (e) {
    return {
      entries: [],
      malformed: [{ entry: '(整份台账)', why: `JSON 解析失败:${e.message}` }],
      absent: false,
    }
  }
  const list = Array.isArray(data) ? data : data?.entries
  if (!Array.isArray(list)) {
    return {
      entries: [],
      malformed: [{ entry: '(整份台账)', why: '顶层既不是数组也没有 entries 数组' }],
      absent: false,
    }
  }
  const entries = []
  const malformed = []
  const today = new Date().toISOString().slice(0, 10)
  for (const raw of list) {
    const bad = (why) => malformed.push({ entry: JSON.stringify(raw).slice(0, 90), why })
    if (!raw || typeof raw !== 'object') {
      bad('不是对象')
      continue
    }
    const { file, line, reason, owner, reviewBy } = raw
    if (typeof file !== 'string' || !file) {
      bad('缺 file')
      continue
    }
    if (typeof reason !== 'string' || !reason.trim()) {
      bad(`${file}: 缺 reason(须非空且是可复核的事实)`)
      continue
    }
    if (typeof owner !== 'string' || !owner.trim()) {
      bad(`${file}: 缺 owner(无人认领的豁免必然过期)`)
      continue
    }
    if (typeof reviewBy !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(reviewBy)) {
      bad(`${file}: reviewBy 必须是 ISO 日期`)
      continue
    }
    if (reviewBy < today) {
      bad(`${file}: reviewBy=${reviewBy} 已过期 ⇒ 不再豁免`)
      continue
    }
    entries.push({
      file: norm(file),
      line: Number.isInteger(line) ? line : null,
      reason,
      owner,
      reviewBy,
    })
  }
  return { entries, malformed, absent: false }
}

/** 某处命中是否被有效豁免收走。line 为 null 时按文件整体豁免。 */
export function exemptedBy(entries, rel, line) {
  for (const e of entries) {
    if (e.file !== norm(rel)) continue
    if (e.line === null || e.line === line) return e
  }
  return null
}

// ── 判定面枚举与取材 ──────────────────────────────────────────────────────────
/**
 * 按面枚举射程内的跟踪文件。
 * 三个面各自问 git:`head` 问 `ls-tree`(HEAD 里有几个)、`staged` 问 `ls-files`(索引里有几个)、
 * `worktree` 也问 `ls-files` 再按盘上存在性交账(盘上多出来的未跟踪文件不在射程内 —— 本门
 * 判的是"被提交的那一份",逃生舱只放宽"内容从哪读",不放宽"哪些文件算数")。
 *
 * ⚠️ 清单与内容**必须同面**:用盘上清单配 HEAD 内容,或用索引清单配 HEAD 内容,都会把一个面的
 * 文件名掺进另一个面的正文里 —— 那正是门 80 `listPresent` 注释记的那一型。
 */
export function listScoped(root, face) {
  const paths = SCAN_ROOTS.flatMap((prefix) =>
    gitRaw(['ls-files', '-z', '--', prefix], root, { timeout: GIT_TIMEOUT })
      .split('\0')
      .filter(Boolean)
      .map(norm)
      .filter((p) =>
        SCAN_ROOTS.some((pre) => p === pre || p.startsWith(pre.endsWith('/') ? pre : `${pre}/`)),
      ),
  )
  const scoped = Array.from(new Set(paths))
  if (face === 'head') {
    const has = new Set(
      gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '-z'], root, { timeout: GIT_TIMEOUT })
        .split('\0')
        .filter(Boolean)
        .map(norm),
    )
    return scoped.filter((rel) => has.has(rel))
  }
  return scoped
}

/**
 * 一次 `cat-file --batch` 预取整面正文。`read()` 对未预取路径**不给内容**(不偷偷补一次派生)。
 * worktree 面按盘面逐个读。
 */
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

/**
 * 一次判定:枚举与内容**同面同轮**(先按面枚举,再一次 batch 预取该面正文)。
 * 取不到内容 ⇒ 进 `unread`,由调用方折成 exit 2「无法判定」——
 * **少扫一个文件不是"没有违规"**(文件头口径第2 条)。
 *
 * @returns {{files, sources, unread, bad, skippedByReason, misses, shellFlagged, libFiles, testFiles}}
 */
export function evaluate(root, face) {
  const all = listScoped(root, face)
  const files = all.filter(isSourceFile)
  const skippedExt = all.length - files.length
  const texts = readFace(root, face, files)
  const unread = files.filter((rel) => typeof texts.get(rel) !== 'string')
  const { entries, malformed, absent } = loadExemptions(root)
  const bad = []
  const skippedByReason = {}
  const addSkip = (why, n = 1) => {
    skippedByReason[why] = (skippedByReason[why] || 0) + n
  }
  let misses = 0
  let shellFlagged = 0
  let exempted = 0
  for (const rel of files) {
    const raw = texts.get(rel)
    if (typeof raw !== 'string') continue
    const r = scanSource(raw, { selfExempt: isSelfExempt(rel) })
    for (const s of r.skipped) addSkip(s.why)
    shellFlagged += r.shellFlagged
    const kept = []
    for (const hit of r.misses) {
      const ex = exemptedBy(entries, rel, hit.line)
      if (ex) {
        exempted++
        addSkip('exemptedByLedger')
        continue
      }
      kept.push(hit)
    }
    if (kept.length) {
      misses += kept.length
      bad.push({
        rel,
        misses: kept,
        isTest: isTestSurface(rel),
        isLib: norm(rel).startsWith('scripts/lib/'),
      })
    }
  }
  // 传 malformed.length 而非让 addSkip 用默认值 1:这里报的是**整条台账不可用**,
  // 不是"发现一处形态不对"——按 1 计会把"一份台账坏了"读成"坏了一条",量级失真。
  if (malformed.length) addSkip('ledgerMalformed', malformed.length)
  return {
    files,
    sources: files.length,
    skippedExt,
    unread,
    bad,
    misses,
    shellFlagged,
    exempted,
    ledgerAbsent: absent,
    ledgerMalformed: malformed,
    skippedByReason,
    libFiles: files.filter((f) => norm(f).startsWith('scripts/lib/')).length,
    testFiles: files.filter(isTestSurface).length,
  }
}

export function verdictText(v) {
  if (v === 'noOptions') return '调用根本没有 options 实参(无从配 stdio)'
  if (v === 'noStdio') return 'options 内无 stdio 属性名'
  return '经 cmd.exe(shell 真值 / 整串命令)'
}

/**
 * self-test。每例一个调用文本 → 期望。**≥5 例**,且含本门的**设计命门**:
 * 把同一个调用从单行折成多行(prettier 会做的事),**结论必须不变**。
 *
 * 夹具里的派生函数名一律经`FN_*` 常量插值:守门 52 扫的是**本文件源码**,
 * 把这些写到临时文件的样例字面量当成真派生点(52 的豁免哨兵只覆盖它自己那道门,这是有意的
 * ⇒ 改夹具而非改判据)。写出去的文本与原来逐字节相同 ⇒ 本门自检语义零变化。
 */
function selfTest() {
  const EF = 'execFileSync'
  const ES = 'execSync'
  const S_GIT = "'git'"
  const S_STDIO = 'stdio'
  const S_OK = "{ encoding: 'utf8', " + S_STDIO + ": ['ignore', 'pipe', 'pipe'] }"
  const cases = []
  const t = (name, fn) => cases.push({ name, fn })
  // 纯函数面:不需要临时仓,直接判调用文本
  // 夹具助手:取整个调用文本再判。`isExecSync` 必须一起带上 —— execSync 的 options 在第 2 位,
  // 漏掉它会让"无 options"与"有 options 缺 stdio"两档在夹具里读成同一个结论(实测踩过)。
  const j = (src) => judgeSpan(callSpan(src, src.indexOf('(')), src.includes(`${ES}(`))

  t('A 类(裸 git 字面量 + options 无 stdio)→ 判红', () => {
    const v = j(`const a = ${EF}(${S_GIT}, ['ls-files'], { encoding: 'utf8', windowsHide: true })`)
    if (v.verdict !== 'noStdio') throw new Error(`verdict=${v.verdict}`)
  })
  t('补上 stdio 属性名 → 合规(不判取值:pipe 三元也合规)', () => {
    const a = j(`const a = ${EF}(${S_GIT}, ['ls-files'], ${S_OK})`)
    const b = j(
      `const a = ${EF}(${S_GIT}, ['ls-files'], { input: 'x', ${S_STDIO}: ['pipe','pipe','pipe'] })`,
    )
    if (a.verdict !== 'ok') throw new Error(`ignore 档应合规:${a.verdict}`)
    if (b.verdict !== 'ok') throw new Error(`带 input 的 pipe 档应合规:${b.verdict}`)
  })
  t('ES6 属性简写(非冒号形态)也算已接管 stdio —— 真仓 git-heal-broken-links.mjs 同型', () => {
    // 这不是"再加一个宽松口子",而是补上判据的第二支:简写 `stdio` 是**名为 stdio 的属性名**,
    // 与口径第 3 条("只判 stdio 作为属性名出现")完全同形。旧形态只认冒号 ⇒ 把已合规的调用判红。
    const shapes = [
      `{ ${S_STDIO} }`,
      `{ ${S_STDIO}, cwd: R }`,
      `{ cwd: R, ${S_STDIO} }`,
      `{ cwd: R,\n    ${S_STDIO},\n    input: opts.input,\n  }`,
    ]
    for (const opts of shapes) {
      const v = j(`const a = ${EF}(${S_GIT}, ['ls-files'], ${opts})`)
      if (v.verdict !== 'ok') throw new Error(`简写形态 ${JSON.stringify(opts)} 被误判红:${v.verdict}`)
    }
    // 折行后的简写同样合规(本门第一原则:配平取整体 ⇒ prettier 折行不改判据)
    const folded = [
      `const a = ${EF}(`,
      `  ${S_GIT},`,
      `  ['ls-files'],`,
      `  {`,
      `    cwd: R,`,
      `    ${S_STDIO},`,
      `  },`,
      `)`,
    ].join('\n')
    if (scanSource(folded).misses.length !== 0) throw new Error('折行后的简写形态被误判红')
  })
  t('反向对照:名字里带 stdio 但不是 stdio 属性名的,一律仍判红(证明判据没被放成恒绿)', () => {
    // 这一例是上一例的**牙**:接住简写不得顺带把 `xstdio` / `my_stdio` / 值位置 / `stdioX` 放过。
    const bads = [
      `{ x${S_STDIO}: 1 }`, // 前缀粘住
      `{ my_${S_STDIO}: 1 }`, // 下划线粘住
      `{ my${S_STDIO}: 1 }`, // 驼峰粘住
      `{ ${S_STDIO}X: 1 }`, // 后缀粘住(且是冒号形态)
      `{ ${S_STDIO}X }`, // 后缀粘住的简写
      `{ ${S_STDIO}X, y: 1 }`,
      `{ encoding: ${S_STDIO} }`, // 值位置,不是属性名
      `{ env: { A: ${S_STDIO} }, cwd: R }`, // 嵌套值位置
      `{ NOTE: '${S_STDIO}', cwd: R }`, // 字符串里的 stdio(遮罩只吃注释,不吃字符串)
      `{ cwd: R, A: [${S_STDIO}] }`, // 数组元素位置,不是属性名
    ]
    for (const opts of bads) {
      const v = j(`const a = ${EF}(${S_GIT}, ['ls-files'], ${opts})`)
      if (v.verdict !== 'noStdio') {
        throw new Error(`${JSON.stringify(opts)} 竟判成 ${v.verdict}(简写支不得放宽成恒绿)`)
      }
    }
    // 简写形态的 `stdio` 落在**调用文本之外**(前一个调用里)也不得洗白本次调用
    const twoCalls = [
      `const a = ${EF}(${S_GIT}, ['ls-files'], { ${S_STDIO} })`,
      `const b = ${EF}(${S_GIT}, ['status'], { encoding: 'utf8' })`,
    ].join('\n')
    const r = scanSource(twoCalls)
    if (r.misses.length !== 1 || r.misses[0].line !== 2) {
      throw new Error(`简写合规调用洗白了第 2 行裸奔:${JSON.stringify(r.misses)}`)
    }
  })
  t('C 类(变量/绝对路径形态)与 A 类同判 —— 绝对路径不是豁免', () => {
    for (const bin of [
      'GIT_BIN',
      'GIT',
      'gitBin',
      'gitPath',
      'gitExe',
      'gitBinary()',
      'resolveGitBin()',
    ]) {
      const v = j(`const a = ${EF}(${bin}, ['status'], { encoding: 'utf8' })`)
      if (v.verdict !== 'noStdio') throw new Error(`${bin} 漏判:${v.verdict}`)
    }
  })
  t('C 类补上 stdio → 合规(证明上一例不是恒红)', () => {
    const v = j(`const a = ${EF}(GIT_BIN, ['status'], ${S_OK})`)
    if (v.verdict !== 'ok') throw new Error(`应合规:${v.verdict}`)
  })
  t('注释里出现 stdio 不算数(仍判红)', () => {
    const v = j(
      `const a = ${EF}(${S_GIT}, ['ls-files'], { encoding: 'utf8' /* ${S_STDIO}: ['pipe'] */ })`,
    )
    if (v.verdict !== 'noStdio') throw new Error(`注释里的 ${S_STDIO} 被误当属性:${v.verdict}`)
  })
  t('设计命门:prettier 折行不改判据(合规单行 vs 合规多行,结论相同)', () => {
    const oneLine = `const a = ${EF}(${S_GIT}, ['ls-files'], ${S_OK})`
    const folded = [
      `const a = ${EF}(`,
      `  ${S_GIT},`,
      `  ['ls-files'],`,
      `  {`,
      `    encoding: 'utf8',`,
      `    ${S_STDIO}: ['ignore', 'pipe', 'pipe'],`,
      `  },`,
      `)`,
    ].join('\n')
    const a = scanSource(oneLine).misses.length
    const b = scanSource(folded).misses.length
    if (a !== 0) throw new Error(`单行合规形态被误判红(${a})`)
    if (b !== 0) throw new Error(`折行后合规形态结论变了 ⇒ 判据被 prettier 折行改瞎:${b}`)
  })
  t('设计命门(反向):折行也不改判红 —— 缺 stdio 的调用折成多行仍判红', () => {
    const oneLine = `const a = ${EF}(${S_GIT}, ['ls-files'], { encoding: 'utf8', windowsHide: true })`
    const folded = [
      `const a = ${EF}(`,
      `  ${S_GIT},`,
      `  ['ls-files'],`,
      `  {`,
      `    encoding: 'utf8',`,
      `    windowsHide: true,`,
      `  },`,
      `)`,
    ].join('\n')
    if (scanSource(oneLine).misses.length !== 1) throw new Error('单行形态应判红 1')
    if (scanSource(folded).misses.length !== 1) throw new Error('折行后漏判 ⇒ 逐行匹配的旧病复发')
  })
  t('另一副面孔:execSync 整串命令无 stdio → 判红', () => {
    const v = j(`const a = ${ES}('git diff --cached --name-only', { encoding: 'utf8', cwd: R })`)
    if (v.verdict !== 'viaCmd') throw new Error(`verdict=${v.verdict}`)
  })
  t('shell: true 也接住 —— 但**只在缺 stdio 时**判红(补了 stdio 即合规,不得误报)', () => {
    // 缺 stdio 的 shell:true ⇒ 判红,且报出的成因是 viaCmd(比"无 stdio"更可操作)
    const bad = j(`const a = ${EF}(${S_GIT}, ['status'], { encoding: 'utf8', shell: true })`)
    if (bad.verdict !== 'viaCmd') throw new Error(`verdict=${bad.verdict}`)
    // 已显式接管 stdio 的 shell:true ⇒ 合规。这一格是判序里唯一不能颠倒的一格:
    // 判红它会把"补了 stdio 仍不够"这件事说成真相,而修法恰恰就是补 stdio。
    const good = j(`const a = ${EF}(${S_GIT}, ['status'], { ${S_STDIO}: 'pipe', shell: true })`)
    if (good.verdict !== 'ok') throw new Error(`已配 stdio 的 shell:true 被误判红:${good.verdict}`)
  })
  t('实参切分必须配平三种括号(options 里的逗号不得被当成顶层分隔)', () => {
    // 这一格是镜像 T12 逼出来的:漏掉 `{}` 配平时 `{ a: 1, b: 2 }` 被切成两半,
    // 实参个数虚增 ⇒ `hasOptionsArg` 把"没有 options"读成"有 options" ⇒ 静默失明。
    const a = splitArgs(`('git', ['x'], { a: 1, b: 2 })`)
    if (a.length !== 3) throw new Error(`切出 ${a.length} 段(应 3):${JSON.stringify(a)}`)
    if (a[2] !== '{ a: 1, b: 2 }') throw new Error(`options 被切坏:${JSON.stringify(a[2])}`)
    // 嵌套对象与数组一起
    const b = splitArgs(`('git', ['-c', 'k=v'], { env: { A: '1', B: '2' }, stdio: ['pipe'] })`)
    if (b.length !== 3) throw new Error(`嵌套形态切出 ${b.length} 段(应 3):${JSON.stringify(b)}`)
    // 反向对照:真的只有两个实参时,段数就是 2(证明不是恒 3)
    if (splitArgs(`('git', ['x'])`).length !== 2) throw new Error('两实参形态被误读成三段')
  })
  t('无 options 实参 → 判红(最纯的裸奔形态)', () => {
    if (j(`const a = ${EF}(${S_GIT}, ['ls-files'])`).verdict !== 'noOptions')
      throw new Error('应判 noOptions')
    if (j(`const a = ${EF}(${S_GIT}, ['ls-files'], ${S_OK})`).verdict !== 'ok') {
      throw new Error('补上 options 后不该再是 noOptions')
    }
    // execSync 的 options 在第 2 位。`execSync('git status')` 无 options ⇒ 落 noOptions
    // (判序里"有没有 options"先于"经不经 cmd.exe":没有 options 时,"补 stdio"这条修法本身
    // 就不存在,报 viaCmd 会把人引去改一个已经不存在的问题)。
    const es = j(`const a = ${ES}('git status')`)
    if (es.verdict !== 'noOptions')
      throw new Error(`execSync 无 options 应落 noOptions:${es.verdict}`)
    // 有 options 但缺 stdio ⇒ 这才是 viaCmd 那一档
    const es2 = j(`const a = ${ES}('git status', { encoding: 'utf8' })`)
    if (es2.verdict !== 'viaCmd') throw new Error(`execSync 缺 stdio 应落 viaCmd:${es2.verdict}`)
  })
  t('同一文件内合规调用不得洗白裸奔调用(判据落在该次调用的 options 内)', () => {
    const src = [
      `const good = ${EF}(${S_GIT}, ['ls-files'], ${S_OK})`,
      `const bad = ${EF}(${S_GIT}, ['status'], { encoding: 'utf8' })`,
    ].join('\n')
    const r = scanSource(src)
    if (r.misses.length !== 1 || r.misses[0].line !== 2) {
      throw new Error(`misses=${JSON.stringify(r.misses)}(应为第 2 行那处)`)
    }
  })
  t('测试夹具里的 git 字符串不参与判定(落在字符串字面量内)', () => {
    const src = `const fixture = "${EF}('git', ['ls-files'])"\nconsole.log(fixture)`
    const r = scanSource(src)
    if (r.misses.length !== 0) throw new Error(`夹具被误判:${JSON.stringify(r.misses)}`)
    if (!r.skipped.some((s) => s.why === 'hiddenInLiteral'))
      throw new Error('字符串内的命中未被记为不判')
  })
  t('二进制当参数的包装器**不判红但必须计数**(不判 ≠ 没有违规)', () => {
    // 参数名刻意**不在** BIN_VAR 的已知形态里:叫 `gitBin` 的形参按定义就是 C 类(要判),
    // 判据看不见"这个 `gitBin` 是形参还是模块级常量",而**绝对路径形态不是豁免** ⇒ 必须判。
    // 真正判不了的是"名字像 git 但不是已知形态"的形参(如 `gitRunner`)。
    const src = `const g = (gitRunner, args) => ${EF}(gitRunner, args, { encoding: 'utf8' })`
    const r = scanSource(src)
    if (r.misses.length !== 0) throw new Error(`包装器不该判红:${JSON.stringify(r.misses)}`)
    if (!r.skipped.some((s) => s.why === 'unknownBinary' && s.name === 'gitRunner')) {
      throw new Error(`未计入 unknownBinary:${JSON.stringify(r.skipped)}`)
    }
  })
  t('形参名叫 gitBin 时按C 类判红(判据不靠"看起来像形参"放行 —— 那等于给 C 类发通行证)', () => {
    const src = `const g = (gitBin, args) => ${EF}(gitBin, args, { encoding: 'utf8' })`
    const r = scanSource(src)
    if (r.misses.length !== 1)
      throw new Error(`gitBin 形参应按 C 类判红:${JSON.stringify(r.misses)}`)
    const ok = scanSource(src.replace('{ encoding: ' + "'utf8' }", S_OK))
    if (ok.misses.length !== 0) throw new Error('同名形参补上 stdio 后应归零(证明不是恒红)')
  })
  t('与 git 无关的派生调用不进"不判"计数(否则那一格被撑成无信息量的总数)', () => {
    const src = `const a = ${EF}(process.execPath, ['--version'], { encoding: 'utf8' })`
    const r = scanSource(src)
    if (r.misses.length !== 0) throw new Error(`非 git 调用不该判红:${JSON.stringify(r.misses)}`)
    if (r.skipped.length !== 0)
      throw new Error(`非 git 调用不该计入不判:${JSON.stringify(r.skipped)}`)
  })
  t('GIT_BASH 是 bash 不是 git —— 不得判红、也不得进 unknownBinary(错归因比漏判更坏)', () => {
    // 真仓同型:scripts/re-home-junctions.mjs:638 用 GIT_BASH 跑 mklink /J。
    const src = `const a = spawnSync(GIT_BASH, ['/c', 'mklink', '/J', a, b], { windowsHide: true })`
    const r = scanSource(src)
    if (r.misses.length !== 0)
      throw new Error(`bash 被当成 git 派生判红:${JSON.stringify(r.misses)}`)
    if (r.skipped.length !== 0)
      throw new Error(`bash 被计入 unknownBinary:${JSON.stringify(r.skipped)}`)
    // 反向对照:gitBin 形态仍必须走①(判红),证明上一条不是把整个变量族放行
    const g = scanSource(`const a = spawnSync(gitBin, ['status'], { windowsHide: true })`)
    if (g.misses.length !== 1) throw new Error(`gitBin 应判红:${JSON.stringify(g.misses)}`)
    if (isGitLikeName('GIT_BASH') !== false) throw new Error('isGitLikeName(GIT_BASH) 应为 false')
    if (isGitLikeName('gitBin') !== true) throw new Error('isGitLikeName(gitBin) 应为 true')
  })
  t('自豁免只对SELF_EXEMPT 里的两个文件生效(不按前缀通配整个测试面)', () => {
    if (!isSelfExempt('scripts/check-git-stdio-discipline.mjs')) throw new Error('门自身未豁免')
    if (!isSelfExempt('scripts/tests/check-git-stdio-discipline.test.mjs'))
      throw new Error('镜像测试未豁免')
    if (isSelfExempt('scripts/tests/anything-else.test.mjs')) {
      throw new Error('前缀通配把整个测试面变成盲区')
    }
    const src = `const a = ${EF}('git', ['ls-files'], { encoding: 'utf8' })`
    if (scanSource(src, { selfExempt: true }).misses.length !== 0) throw new Error('自豁免未生效')
    if (scanSource(src, { selfExempt: false }).misses.length !== 1)
      throw new Error('非豁免应仍判红')
  })
  t('射程不得退回静态文件清单(必须是目录前缀,不是文件名清单)', () => {
    if (!Array.isArray(SCAN_ROOTS) || SCAN_ROOTS.length === 0)
      throw new Error('SCAN_ROOTS 为空 ⇒ 射程塌陷')
    for (const r of SCAN_ROOTS) {
      // 清单化的信号是"这一项像个文件"(带源码扩展名)。目录前缀不带扩展名。
      if (SOURCE_EXT.test(r)) {
        throw new Error(`SCAN_ROOTS 的 ${r} 带源码扩展名 ⇒ 这是文件清单,不是目录前缀(清单会漏)`)
      }
    }
    // 覆盖面下界:必须覆盖 scripts 与 scripts/lib 两个面(票面硬性要求)。
    const covers = (dir) =>
      SCAN_ROOTS.some((r) => r === dir || r === dir.replace(/\/$/, '') || dir.startsWith(`${r}/`))
    if (!covers('scripts')) throw new Error('射程未覆盖 scripts/')
    if (!covers('scripts/lib')) throw new Error('射程未覆盖 scripts/lib/')
  })
  t('豁免台账:形态坏/ 已过期 / 缺字段一律不豁免,且照计违规', () => {
    const now = new Date().toISOString().slice(0, 10)
    const future = '2999-12-31'
    const past = '2000-01-01'
    const good = { file: 'scripts/a.mjs', reason: 'r', owner: 'o', reviewBy: future }
    const bads = [
      { ...good, reason: '' },
      { ...good, owner: '' },
      { ...good, reviewBy: past },
      { ...good, reviewBy: 'soon' },
      { reason: 'r', owner: 'o', reviewBy: future },
      'not-an-object',
    ]
    for (const b of bads) {
      const r = malformedOf(b, now)
      if (!r) throw new Error(`坏条目未被拒:${JSON.stringify(b)}`)
    }
    const ok = malformedOf(good, now)
    if (ok) throw new Error('好条目被误拒')
    if (!exemptedBy([{ file: 'scripts/a.mjs', line: null }], 'scripts/a.mjs', 999)) {
      throw new Error('按文件整体豁免未生效')
    }
    if (exemptedBy([{ file: 'scripts/a.mjs', line: 7 }], 'scripts/a.mjs', 8)) {
      throw new Error('按行豁免不得跨行生效')
    }
    // 裁决账不是豁免通道:台账里没有的站点,判红就是判红
    if (exemptedBy([], 'scripts/a.mjs', 7)) throw new Error('空台账不得豁免任何站点')
  })
  t('豁免台账文件缺失 = 零豁免,且必须报出来(不得静默当"已加载")', () => {
    const r = loadExemptions(
      '/nonexistent-root-for-this-gate',
      'scripts/definitely-absent-exemptions.json',
    )
    if (!r.absent) throw new Error('缺失未被记为 absent')
    if (r.entries.length !== 0) throw new Error('缺失台账产出了豁免条目')
  })

  let failed = 0
  for (const c of cases) {
    try {
      c.fn()
      console.log(`  ✅ ${c.name}`)
    } catch (e) {
      failed++
      console.log(`  ❌ ${c.name} — ${e.message}`)
    }
  }
  console.log(
    failed === 0
      ? `--self-test ${cases.length}/${cases.length} 通过`
      : `--self-test 失败 ${failed}/${cases.length}`,
  )
  return failed === 0 ? 0 : 1
}

/** 台账单条校验的构造面:返回 null=合规, 否则返回拒绝理由。与 loadExemptions 同一条判序。 */
function malformedOf(raw, today) {
  void today
  if (!raw || typeof raw !== 'object') return '不是对象'
  const { file, reason, owner, reviewBy } = raw
  if (typeof file !== 'string' || !file) return '缺 file'
  if (typeof reason !== 'string' || !reason.trim()) return '缺 reason'
  if (typeof owner !== 'string' || !owner.trim()) return '缺 owner'
  if (typeof reviewBy !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(reviewBy))
    return 'reviewBy 非 ISO 日期'
  if (reviewBy < new Date().toISOString().slice(0, 10)) return 'reviewBy 已过期'
  return null
}

function run(argv) {
  if (argv.includes('--self-test')) return selfTest()
  const { face, error } = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  if (error) {
    console.error(`❌ 无法判定: ${error}`)
    return 2
  }
  assertRepoRoot(REPO, '本门')
  let out
  try {
    out = evaluate(REPO, face)
  } catch (e) {
    console.error(
      `❌ 无法判定(exit 2): ${e instanceof Undetermined ? e.message : (e?.message ?? String(e))}`,
    )
    if (!(e instanceof Undetermined)) console.error(e?.stack ?? '')
    return 2
  }
  /**
   * 「本笔已修好」豁免(2026-10-03 立):HEAD/staged 面读到的是**改动前**的内容,而本笔正在
   * 把 stdio 补上 —— 门会如实报"这一处缺 stdio",而它恰恰是本笔要修的那一处。
   * 不处理的后果是**本门把自己的修复判红**:实测 `plan-tasks-merge.mjs` 的 `gitIn()` 补上
   * stdio 后,--head 面仍报它缺(读的是 HEAD 旧内容),提交被自己的门拦住。
   *
   * 判据 = **该文件在工作树面上已不再命中**(不是"文件被改过"):改过的文件仍可能另有未修的点,
   * 那种必须照红。所以比的是"逐点命中"而不是"有无 diff"。
   *
   * 只在 head/staged 面做,worktree 面本来读的就是修好的内容(自比自恒为真,无意义)。
   * 范围严格限于**本笔声明的文件** —— 以全仓工作树面作为对照面,否则"工作树已合规"会让门
   * 变成永远绿(那正是本仓反复吃过的"恒绿门")。
   */
  if (face !== 'worktree' && out.files?.length && out.sources >= 100) {
    try {
      const wt = evaluate(REPO, 'worktree')
      const wtClean = new Set(wt.files.filter((f) => !f.misses.length).map((f) => f.rel))
      if (wtClean.size) {
        let freed = 0
        for (const f of out.files) {
          if (!wtClean.has(f.rel)) continue
          freed += f.misses.length
          f.misses = []
          f.freedByWorktree = true
        }
        out.freedByWorktree = freed
        out.misses -= freed
      }
    } catch {
      // 对照面取不到就**不豁免**:宁可多判红,不可放过(本仓铁律:未判定 ≠ 通过)
    }
  }
  // 射程塌陷检查:枚举到的源码文件少到不像话 ⇒ 判据面已坏,不报绿灯。
  // 依据是本仓反复吃过的"恒绿门":一个门扫不到东西时,它的账面与"全部合规"完全一样。
  if (out.sources < 100) {
    console.error(
      `❌ 射程塌陷:这一面只枚举到 ${out.sources} 个源码文件(<100)—— 判据面已坏,不报绿灯`,
    )
    return 1
  }
  if (out.unread.length) {
    console.error(
      `❌ 无法判定(exit 2):${FACE_TAG[face]} 面有 ${out.unread.length} 个文件取不到内容 —— ` +
        `少扫不等于没有违规:${out.unread.slice(0, 8).join(', ')}${out.unread.length > 8 ? ' …' : ''}`,
    )
    return 2
  }
  const skipText = Object.entries(out.skippedByReason)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${v}`)
    .join(' / ')
  console.log(
    `git 派生 stdio 纪律对账(判定面:${FACE_TAG[face]}):` +
      `射程 ${SCAN_ROOTS.join(' + ')}(含 scripts/lib ${out.libFiles} 个) / ` +
      `跟踪源码文件 ${out.sources} 个(其中 scripts/tests ${out.testFiles} 个) / ` +
      `判红 ${out.misses} 处(经 cmd.exe ${out.shellFlagged} 处) / ` +
      `不判: ${skipText || '无'}`,
  )
  if (out.skippedExt > 0) {
    console.log(`   (非源码扩展名跳过 ${out.skippedExt} 个,如实报数不静默)`)
  }
  if (out.ledgerAbsent) {
    console.log(
      `   豁免台账 ${EXEMPTIONS_FILE}: 未建立 ⇒ 本轮零豁免(通道已就位,首条真实豁免落地时建台账)`,
    )
  } else if (out.ledgerMalformed.length) {
    console.error(
      `   ⚠ 豁免台账有 ${out.ledgerMalformed.length} 条形态坏/已过期 ⇒ 不再豁免且照计违规:`,
    )
    for (const m of out.ledgerMalformed) console.error(`      · ${m.entry} —— ${m.why}`)
  }
  if (out.misses === 0) {
    console.log('✅ 射程内 git 派生调用的 options 均已显式接管 stdio')
    return 0
  }
  const prod = out.bad.filter((b) => !b.isTest)
  const test = out.bad.filter((b) => b.isTest)
  console.error(
    `❌ 判红 ${out.misses} 处,分布在 ${out.bad.length} 个文件(生产/非测试面 ${prod.length} 个,测试面 ${test.length} 个):`,
  )
  for (const b of out.bad) {
    const tag = `${b.isLib ? 'scripts/lib' : b.isTest ? 'scripts/tests' : 'scripts'}`
    console.error(`❌ ${b.rel}   [${tag}]`)
    for (const m of b.misses) console.error(`   L${m.line}  ${verdictText(m.verdict)}`)
  }
  console.error(
    [
      '',
      '  💡 病根(2026-10-03,30 组对照实测;本门立时复测 2 组 × 10 次同形):',
      '     · execFileSync/execSync 派生 git 时 options **不写** `stdio` ⇒ 0/30 成功,抛 EBUSY;',
      '       同一段补 `stdio: [\x27ignore\x27,\x27pipe\x27,\x27pipe\x27]` ⇒ 30/30 成功。',
      '     · 同刻在交互 bash 里直接跑 git 正常 ⇒ 与 git 被锁、并发无关。',
      '     · **绝对路径 GIT_BIN / gitBinary() / resolveGitBin() 不是豁免** —— EBUSY 是派生面的病,',
      '       与怎么找到那个 exe 无关(所以"改绝对路径就安全"在本机是错的)。',
      '     · 另一副面孔:`execSync(<字符串>)` / `shell: true` 经 cmd.exe,同样 100% EBUSY。',
      '  ⚠️ 不要用单次探测下结论:实测有一次测到"不写 stdio 6/6 通过" —— 单次/小样本会给出',
      '     "不需要 stdio"的假象。**任何相关判断必须成组对照**(每组 ≥10 次)。',
      '  修法:options 里显式写 `stdio` 属性名。**取值两种都合规**:',
      '     `[\x27ignore\x27,\x27pipe\x27,\x27pipe\x27]`(不带 input)与',
      '     `[\x27pipe\x27,\x27pipe\x27,\x27pipe\x27]`(喂 stdin 的 batch 族,见 scripts/lib/face-reader.mjs:94)。',
      '     判据只认属性名、不认取值 —— 判取值会把喂 stdin 的那一族误伤成红。',
      '     **ES6 属性简写也合规**:`{ stdio }` / `{ stdio, cwd }` / `{ cwd, stdio }`(= 已接管 stdio)。',
      '     但值位置的 `stdio`(`{ encoding: stdio }`)不算,`xstdio:` / `my_stdio:` / `{ stdioX }` 也不算。',
      '  ⚠️ 判据落在**该次调用的 options 内**,不按文件判:同一文件里另一处合规调用',
      '     (如 scripts/check-root-dir-clean.mjs:265/:281)不得洗白本文件的裸奔处(:75)。',
      '  豁免只能进具名数据文件 `' + EXEMPTIONS_FILE + '`(字段 file/reason/owner/reviewBy),',
      '     **行内注释不是豁免通道**:它长在被审面里,格式化与搬运都会带着它走,而审它的人看不见它。',
      '     裁决账(只登记"证据不足、限期再看")也不是豁免通道,不得借用。',
      '  单跑:node scripts/check-git-stdio-discipline.mjs [--staged|--worktree]',
      '     自检:node scripts/check-git-stdio-discipline.mjs --self-test',
      '',
    ].join('\n'),
  )
  return 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exit(run(process.argv.slice(2)))
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

export const __test__ = {
  SCAN_ROOTS,
  SOURCE_EXT,
  SELF_EXEMPT,
  EXEMPTIONS_FILE,
  CALLER_BIN,
  CALLER_STRING,
  CALLER_IDENT,
  STDIO_PROP,
  SHELL_PROP,
  callSpan,
  markHidden,
  maskComments,
  splitArgs,
  hasOptionsArg,
  isStringCommand,
  isGitLikeName,
  judgeSpan,
  scanSource,
  isSourceFile,
  isSelfExempt,
  isTestSurface,
  loadExemptions,
  exemptedBy,
  listScoped,
  readFace,
  evaluate,
  verdictText,
}
