#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/check-pwsh-version.mjs
// 守门:所有项目内 .ps1 文件必须以 `#requires -Version 7` 开头
// 强制只用 PowerShell 7 (pwsh.exe),禁止用 Windows PowerShell 5.1 (powershell.exe)
//
// 三面分列,措辞不得互相顶替(2026-09-27 G-225):
//  ① 判定面 —— 非豁免 .ps1 缺 pragma ⇒ 判红(本门自立项起的原有语义)。
//  ② 豁免面 —— deploy/** 的 .ps1 **不判红**,但必须**如实报数并点名**(此前是静默跳过,
//     报告读不出"这一面没判",于是读 AGENTS.md §27 的人以为运维脚本已有版本强制)。
//     不判的原因见下方 DEPLOY_DIR_NAME 注释:`#requires` 在 5.1 上直接拒绝执行,而这些
//     脚本由 nssm 服务/计划任务拉起,补 pragma 可能等于停服务。
//  ③ 调用侧判据 —— 豁免面不能"没人管",所以把强制挪到**调用侧**:代码面凡是调用
//     deploy/**.ps1 的地方必须显式指名 PowerShell 7 引擎(pwsh)或经 *.vbs 包装(§26),
//     裸 `powershell -File deploy/...` 出现在代码面 ⇒ 违规。默认档只报数点名不判红,
//     `--strict` 才判红。**升提交链 blocking 的前置 = 真仓 HEAD 代码面现读为 0**
//     (§12e:一台上线即红的门唯一结局是逼人 --no-verify,连带废掉全部守门)。
//
// 退出码: 0 = 判定面通过(默认档调用侧不计入), 1 = 有违规, 2 = 无法判定(取材面失败 / 两面旗同给)
// 用法: node scripts/check-pwsh-version.mjs [--staged|--worktree] [--strict] [--root <path>]
//   --staged : 判**索引 blob** —— 文件清单取 git diff --cached,内容一次 catBatch 读 `:<rel>`(pre-commit 用此档)
//   --worktree: 判**工作树(磁盘)** —— 只作人工排查与测试夹具逃生舱,与 --staged 同给判死(exit 2)
//   --strict : 把 ③ 调用侧命中计入退出码(人工问责 / CI;提交链不传)
//   缺省     : 全量档,判 **HEAD blob**(清单来自 ls-tree HEAD,内容同轮一次 catBatch 读满;供人工 / CI 全量审计)
//   --root   : 测试夹具通道(镜像测试用临时目录跑端到端;生产调用不带)。该通道下"全量档"被**强制折向
//              worktree 面** —— 临时目录未必是 git 仓,判 HEAD 结构上取不到;--staged 在该通道仍走该
//              夹具仓的**索引**(镜像 T14 就是拿它证"索引与工作树内容不同时,两档结论必不同")。
//              实际取了哪一面由 [FACE] 行如实打印,不静默。
// 三面口径与 70/77/83/98/101/103/118 同形(票 G-814393 迁入):清单与内容**同面同轮**,
//   任何一面取不到 ⇒ exit 2「无法判定」,**绝不回落到另一个面**;此前按磁盘判 ⇒ 守门 118 分类
//   loose-fs ⇒ 谁改这道门谁被 118 判红(该门对 HEAD 那份同样成立,即"结构上没人能合规地改它")。
//
// 2026-09-15 修复(本守门自身的 P0 回归):
//   本脚本自挂载起就**没有实现 --staged** —— 用法注释声明了、pre-commit 也照传了,
//   但实现里只有无条件的 scan(ROOT),于是「staged 模式守住新增/修改」形同虚设。
//   后果:工作区里任何**未跟踪且被 gitignore** 的遗留 .ps1(实测 .android-toolchain/*.ps1、
//   .tmp-wechat-test/watch.ps1,来自本机 Android SDK 目录与临时试验目录)都会让**每一次
//   提交**被阻断;而这些文件在干净 checkout / CI 里根本不存在 —— 守门拦的是本地垃圾,
//   不是项目代码。修法:真正解析 --staged,按 `git diff --cached` 的清单检查。

import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isExcludedDirName } from './lib/exclude-dirs.mjs'
// 遮噪只许用这一份实现(§3 共享层优先;镜像测试 T1 反向锁"门里不得再写一份注释剥离")。
// 用 maskCommentsAndStrings 而不是自写正则:仓库的注释与 usage 帮助文本里大量写着
// `powershell -ExecutionPolicy Bypass -File deploy\win\...` 例子,先剥注释**与字符串**再判,
// 否则门会把自己文档里的例子判成违规(本仓"判据失效的表现永远是安静"的反面:判据误伤
// 自己的解释文字,守门 131 同型事故)。
// 脚本系(.ps1/.sh/.bat/.cmd/.vbs)另走同一份 lib 的 `maskScriptComments` 方言档:注释语法是
// `#` / `REM` / `::` / `'`,与 JS 词法不同形;而**字符串不遮**(那正是"引号里的真调用"所在)。
import { maskCommentsAndStrings, maskScriptComments } from './lib/code-mask.mjs'
import { resolveGitBin } from './lib/gitdir.mjs'
// 判定面取材只走这一层(票 G-814393)。⚠️ 半接线形态(import 了层却仍自己 git show / 按磁盘
// readFileSync 读内容)正是守门 118 判红的 half-wired —— "引了层"不构成合规,必须**真调用**
// 层的读取入口(catBatch)取内容;镜像 T13 拿分类器按脚本名反查这道门的分类钉住这一点。
import { catBatch, gitRaw, selectFace, FACE_LABEL, Undetermined } from './lib/face-reader.mjs'

const GIT_BIN = resolveGitBin() || 'git'
/** 取材档的 git 派生上限:枚举(ls-tree/grep)与内容(catBatch)共用同一个数,不各写各的。 */
const GIT_FACE_TIMEOUT = 120_000

const args = process.argv.slice(2)
const STAGED = args.includes('--staged')
const WORKTREE = args.includes('--worktree')
const STRICT = args.includes('--strict')
const rootIdx = args.indexOf('--root')
const ROOT =
  rootIdx >= 0 ? resolve(args[rootIdx + 1]) : resolve(dirname(fileURLToPath(import.meta.url)), '..')

if (!existsSync(ROOT)) {
  console.error(`[FAIL] root path does not exist: ${ROOT}`)
  process.exit(1)
}

// ── 取材面选定(G-814393)──────────────────────────────────────────────────────
// 全量档 = HEAD blob;--staged = 索引 blob;--worktree = 磁盘(人工/夹具逃生舱)。
// 两面旗同给 = 自相矛盾 ⇒ 判死 exit 2(取哪一面都会让另一面成为假绿)。
// --root 夹具通道:默认面强制折向 worktree(临时目录未必是 git 仓);--staged 仍按索引。
const FACE_SEL = selectFace({ staged: STAGED, worktree: WORKTREE })
if (FACE_SEL.error) {
  console.error(`[FAIL] 无法判定: ${FACE_SEL.error}`)
  process.exit(2)
}
let face = FACE_SEL.face
let faceNote = ''
if (rootIdx >= 0) {
  if (face === 'head') {
    face = 'worktree'
    faceNote = ';--root 夹具通道 ⇒ 全量档强制走工作树面(临时目录未必是 git 仓,判 HEAD 结构上取不到)'
  } else if (face === 'staged') {
    faceNote = ';--root 夹具通道下 --staged 仍取该夹具仓的索引 blob(不需要 HEAD)'
  } else {
    faceNote = ';--root 夹具通道'
  }
}
// 如实打印取材档,不得静默 —— 读报告的人必须能看出这一轮判的是哪一份内容。
console.log(`[FACE] 取材面 = ${face} —— ${FACE_LABEL[face]}${faceNote}`)

// 跳过的目录(整棵树,gitignore 等价)
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.venv',
  'venv',
  '__pycache__',
  'dist',
  '.next',
  'build',
  '.turbo',
  'target',
  'bin',
  'obj',
  // 项目内临时目录(.gitignore 第 5 行)
  'tmp',
  // 部署打包产物(.gitignore 第 314 行,不在项目维护范围)
  'deploy',
  // 第三方 IDE 工具目录(.gitignore 第 97 行,非项目代码)
  '.ihui-agent',
])

// 跳过的路径模式(子目录白名单)
const SKIP_PATH_PATTERNS = [
  /[\\/]\.venv[\\/]/,
  /[\\/]venv[\\/]/,
  /[\\/]node_modules[\\/]/,
  /[\\/]\.git[\\/]/,
  /[\\/]\.ihui-agent[\\/]tmp[\\/]/,
  /[\\/]site-packages[\\/]/, // playwright 驱动
  /[\\/]driver[\\/]package[\\/]bin[\\/]/, // playwright
  // 部署打包产物 + 临时目录(防漏网)
  /[\\/]tmp[\\/]/,
  /[\\/]deploy[\\/]prod-bundle[\\/]/,
  /[\\/]\.ihui-agent[\\/]/,
  // 污染治理隔离归档(2026-09-15 补):历史现场原样保存,不追溯新规则
  /[\\/]\.workbuddy[\\/]quarantine[\\/]/,
]

const violations = []
/** 已判(非豁免面)的 .ps1 计数 —— 结论行必须说清"判了多少",不得笼统声称全仓合规 */
let judgedPsiCount = 0
/**
 * "在途消失"计数:被审判面枚举到、内容却是 null,且磁盘上也没有该文件(别人恰好 unstage 并删了盘
 * 上一份)—— 属机器态而非提交态,计"未判定"并如实报数,**不判红也不冒充已判**。
 * 与它相对的一支(面上取不到而盘上仍在 ⇒ unmerged/取材故障)由 contentMissing 抛 Undetermined 判死。
 */
let goneCount = 0

// ── ② 豁免面:deploy/**(可见、不判红)──────────────────────────────────────────
// 为什么不能摘掉豁免去判红:`#requires` 在 Windows PowerShell 5.1 上是**直接拒绝执行**,
// 而 deploy/** 脚本由 nssm 服务与计划任务拉起 —— 别机/服务身份若仍是 5.1,给这些脚本补
// pragma 等于让部署/备份/监控服务**拒绝启动**(把样式建议换成可用性事故)。
// 但"不判"过去表现为**静默跳过**:报告里读不出这一面没判,于是照 AGENTS.md §27 行文的人
// 以为运维脚本已有版本强制(§5e"把没判写成判过了"同型禁令)。现在如实报数、点名、给理由。
const DEPLOY_DIR_NAME = 'deploy'
/** exemptPsi 条目:{ rel, missing(缺 pragma), readable(能否读到内容) } */
const exemptPsi = []

/** 两个面都不得进入的垃圾目录(依赖/构建产物/运行态);deploy 本身**不在**此列——豁免面与调用侧都要看见它。 */
const NEVER_ENTER_DIRS = new Set([
  'node_modules',
  '.git',
  '.venv',
  'venv',
  '__pycache__',
  'dist',
  'build',
  '.next',
  '.turbo',
  'target',
  'tmp',
  '.ihui-agent',
  '.workbuddy',
])

function hasRequires7(content) {
  // 只检查前 5 行(与历史判据逐字同形)
  const lines = content.split(/\r?\n/).slice(0, 5)
  return lines.some((l) => /^\s*#requires\s+-Version\s+7\b/.test(l))
}

/** 判定面内容的统一入口 —— 磁盘路径与 git 面路径共用这**一份**判据,只有取材来源不同。 */
function judgePsiContent(rel, content) {
  judgedPsiCount += 1
  if (!hasRequires7(content)) violations.push(rel)
}

/** 豁免面内容的统一入口(与磁盘语义同形:内容读不到 ⇒ readable=false,计"未判定"不计缺 pragma)。 */
function pushExemptContent(rel, content) {
  if (content === null) exemptPsi.push({ rel, missing: false, readable: false })
  else exemptPsi.push({ rel, missing: !hasRequires7(content), readable: true })
}

function checkFile(filePath) {
  let content
  try {
    content = readFileSync(filePath, 'utf8')
  } catch {
    return // 读不到的跳过(磁盘面既有语义)
  }
  judgePsiContent(relative(ROOT, filePath), content)
}

/** 递归收集一个 deploy 目录之下的全部 .ps1,归入豁免面(不判红,但缺 pragma 要点名)。 */
function collectExemptPsi(dir) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      if (NEVER_ENTER_DIRS.has(e.name) || isExcludedDirName(e.name)) continue
      collectExemptPsi(full)
    } else if (e.name.toLowerCase().endsWith('.ps1')) {
      pushExempt(relative(ROOT, full).replace(/\\/g, '/'), full)
    }
  }
}

/** 磁盘面的豁免入口:读盘失败与"面上取不到内容"折成同一份 null,交 pushExemptContent 判语义。 */
function pushExempt(rel, absPath) {
  let content = null
  try {
    content = readFileSync(absPath, 'utf8')
  } catch {
    content = null
  }
  pushExemptContent(rel, content)
}

// ── ③ 调用侧判据:代码面调用 deploy/**.ps1 必须指名 PS7 引擎或经 vbs 包装 ────────
// 判的是**调用方**而不是被调脚本头部 —— 豁免面"头部不判"是可用性决定,不等于"这一族没尺子"。
// 规则(全部同行成立才算命中,方向刻意是宁漏不误报):
//   a) 遮噪后的**代码面**上出现 `powershell[.exe] -<参数>` 调用形态(必须紧跟 `-参数`,
//      避免把 `powershellPath` 这类标识符读成调用);遮噪按语言分档,见下方"覆盖面";
//   b) 同一行引用 `deploy/<…>.ps1` 路径(两种分隔符都认);
//   c) 该行不含 `pwsh`(显式 PS7 ⇒ 合规),也不含 `.vbs`(§26 计划任务一律经纯 ASCII wscript
//      包装 ⇒ 合规,裸 powershell 不在这条调用里)。
// 覆盖面(2026-09-28 G-391② 把这一族从盲区收进判据):
//   ① JS/TS 系(.mjs/.cjs/.js/.jsx/.ts/.tsx)—— 沿用 lib/code-mask 的 JS 档,注释**与字符串**都遮。
//   ② 脚本系(.ps1/.sh/.bash/.bat/.cmd/.vbs)—— 走同一份 lib 的**脚本方言**档
//      (`maskScriptComments`),它按各语言自己的词法遮注释:PowerShell `#` 与 `<# #>`、
//      shell `#`(仅词首)、batch `REM`/`::`(仅命令起始位)、VBScript `'`(串外)。
//      这一档**不遮字符串**,因为脚本语言的真调用恰恰写在引号里
//      (`objShell.Run "powershell -File deploy\win\x.ps1"` 是 §26 计划任务的包装形态)——
//      抹引号等于没收这把尺子;而 JS 档抹字符串是对的,那里 usage 文本就在字符串里。
//      把 JS 语义套到脚本文件上,两个方向都错:不遮 `#`/`'`/`REM` ⇒ 门把 deploy/win/*.ps1 头部
//      逐字写着的用法示例判成违规(守门 70/131 同型);抹字符串 ⇒ 对立项那一型全盲却一路报绿。
const CALLER_JS_EXTS = new Set(['.mjs', '.cjs', '.js', '.jsx', '.ts', '.tsx'])
/** 扩展名 → lib/code-mask 的脚本方言(封闭映射;漏一条 = 该扩展名整型隐身,由镜像 T9 钉住)。 */
const CALLER_SCRIPT_DIALECT = new Map([
  ['.ps1', 'ps'],
  ['.sh', 'sh'],
  ['.bash', 'sh'],
  ['.bat', 'bat'],
  ['.cmd', 'bat'],
  ['.vbs', 'vbs'],
])
/** 该扩展名是否在调用侧射程内;返回遮噪方言名(JS 档用 'js'),不在射程返回 null。 */
function callerDialectForExt(ext) {
  if (CALLER_JS_EXTS.has(ext)) return 'js'
  return CALLER_SCRIPT_DIALECT.get(ext) ?? null
}
/** 自豁免:本门与镜像测试必然逐字写出被禁形态来解释/验证判据,判它们等于门判自己的散文(守门 79 同型)。 */
const CALLER_SELF_EXEMPT = new Set([
  'scripts/check-pwsh-version.mjs',
  'scripts/tests/check-pwsh-version.test.mjs',
])
const BARE_POWERSHELL_CALL = /\bpowershell(?:\.exe)?\s+-[A-Za-z]/
const DEPLOY_PS1_REF = /deploy[\\/][^\s]*\.ps1(?![A-Za-z0-9_])/i
const COMPLIANT_ENGINE = /\bpwsh(?:\.exe)?\b/i
const COMPLIANT_VBS_WRAPPER = /\.vbs\b/i
/**
 * 调用侧的**唯一**预筛字面量。两个用途共享这一个定义:
 *  ① scanCallerContent 的内容预筛(遮噪前 text.includes(它));
 *  ② HEAD 面的枚举预筛(`git grep -l -z -I -e <它> HEAD`)。
 * 枚举必须是判据字面量的超集(此处是恒等),漏一个字符门就在该形态上失明却一路报绿
 * (守门 102 左向箭头那一课);写成两处字面量则必漂(§"两处算同一件事必漂移")。
 */
const CALLER_PRESCREEN = 'powershell'

const callerHits = []

/** 调用侧判据的统一入口(磁盘面与 git 面共用这一份;遮噪只走 lib/code-mask)。 */
function scanCallerContent(text, relForReport, dialect) {
  // 预筛:必须是判据字面量的**超集**(调用形态按小写 powershell 判,这里同词直取)。
  // 预筛漏一个形态,门就在该形态上失明 —— 与判据不同形的预筛等于没有(守门 102 同课)。
  if (!text.includes(CALLER_PRESCREEN)) return
  // 遮噪只许走 lib/code-mask 那一份实现:JS 档遮注释+字符串,脚本档按各语言词法只遮注释。
  // 方言由调用方按扩展名传入(callerDialectForExt);lib 收到未知方言**抛错**而不是返回原文,
  // 所以"漏映射"当场炸而不是静默把整棵子树判成代码面(§"把没判写成判过了"同型禁令)。
  const masked = dialect === 'js' ? maskCommentsAndStrings(text) : maskScriptComments(text, dialect)
  const lines = masked.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (!BARE_POWERSHELL_CALL.test(l)) continue
    if (!DEPLOY_PS1_REF.test(l)) continue
    if (COMPLIANT_ENGINE.test(l) || COMPLIANT_VBS_WRAPPER.test(l)) continue
    callerHits.push({ rel: relForReport, line: i + 1, text: l.trim().slice(0, 160), dialect })
  }
}

function scanCallerFile(absPath, relForReport, dialect) {
  let text
  try {
    text = readFileSync(absPath, 'utf8')
  } catch {
    return
  }
  scanCallerContent(text, relForReport, dialect)
}

/** 全量档的第二个遍历:豁免面收集 + 调用侧候选(deploy 目录不跳过,它两边都要看)。 */
function walkExemptAndCallers(dir) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      if (NEVER_ENTER_DIRS.has(e.name) || isExcludedDirName(e.name)) continue
      if (e.name === DEPLOY_DIR_NAME) collectExemptPsi(full)
      walkExemptAndCallers(full)
    } else {
      const dot = e.name.lastIndexOf('.')
      const ext = dot >= 0 ? e.name.slice(dot).toLowerCase() : ''
      const dialect = callerDialectForExt(ext)
      if (!dialect) continue
      const rel = relative(ROOT, full).replace(/\\/g, '/')
      if (CALLER_SELF_EXEMPT.has(rel)) continue
      scanCallerFile(full, rel, dialect)
    }
  }
}

function scan(dir) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name) || isExcludedDirName(e.name)) continue
      scan(full)
    } else if (e.name.endsWith('.ps1')) {
      if (SKIP_PATH_PATTERNS.some((p) => p.test(full))) continue
      checkFile(full)
    }
  }
}

/**
 * 取 git index 中已暂存的路径清单(仅新增/修改/改名,不含删除)。
 * 返回 null 表示非 git 环境 / git 不可达 —— 调用方退化为全树扫描,避免静默放过。
 * 2026-09-27(G-225):改 execFileSync + 绝对路径 git + `-c safe.directory=*` + timeout
 * (§5b"git 调用不得依赖环境"与守门 80"热路径 git 调用必须带 timeout");并去掉 .ps1 过滤
 * —— 调用侧判据需要看见暂存的全部代码文件。
 * 2026-09-27(G-814393):加 `-c core.quotepath=false` —— 本清单此后**直接充当 catBatch 的索引
 * 规格素材**(`:<rel>`),非 ASCII 名若被转义成 `"...\346..."`,一次转写就把"清单来自索引、
 * 内容取不到"变成常态(转写名在盘上必然不存在 ⇒ 被记成"在途消失"而静默少扫)。清单与内容
 * 必须解同一份名字,这是同面同轮的另一半。
 */
function listStagedFiles() {
  let out
  try {
    out = execFileSync(
      GIT_BIN,
      [
        '-c',
        'safe.directory=*',
        '-c',
        'core.quotepath=false',
        'diff',
        '--cached',
        '--name-only',
        '--diff-filter=ACMR',
      ],
      {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        windowsHide: true,
        timeout: 60_000,
        maxBuffer: 32 << 20,
      },
    )
  } catch {
    return null
  }
  return out
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** 路径是否落在目录级白名单内(与全量扫描口径保持一致)。 */
function isSkippedPath(rel) {
  const full = join(ROOT, rel)
  if (SKIP_PATH_PATTERNS.some((p) => p.test(full))) return true
  return rel.split(/[\\/]/).some((seg) => SKIP_DIRS.has(seg) || isExcludedDirName(seg))
}

function runFull() {
  scan(ROOT)
  walkExemptAndCallers(ROOT)
}

// ── 取材面执行层(G-814393):清单与内容同面同轮,一次 catBatch 读满 ─────────────
// 本节只改"内容从哪个面取",不改判据。三种形态各自的"同面"是:
//   head   —— 清单 ls-tree(-z) HEAD + 调用侧枚举 git grep HEAD(同一面),内容一次 catBatch 读 `HEAD:<rel>`;
//   staged —— 清单 git diff --cached(索引),内容一次 catBatch 读 `:<rel>`;
//   worktree—— 磁盘 walk 出清单,磁盘读出内容(人工/夹具逃生舱,即 runFull 的既有形态)。
// 旧"混面"写法(清单来自索引、内容来自磁盘)会产出自洽却错位的尺子 —— 已消灭。

/** 路径扩展名(小写含点;无扩展名返回空串)。与磁盘面 lastIndexOf('.') 的取法同形。 */
function extOf(rel) {
  const dot = rel.lastIndexOf('.')
  return dot >= 0 ? rel.slice(dot).toLowerCase() : ''
}

/** 磁盘两个遍历都不得进入的目录(SEGMENT 级,与 collectExemptPsi / walkExemptAndCallers 同形)。 */
function segsBlocked(segs) {
  return segs.some((s) => NEVER_ENTER_DIRS.has(s) || isExcludedDirName(s))
}

/**
 * HEAD 面的调用侧枚举:`git grep -l -z` 找含 CALLER_PRESCREEN 的文件。
 * 预筛模式串与 scanCallerContent 的内容预筛共用 CALLER_PRESCREEN 这一个定义(超集=恒等)。
 * 已知边界(如实登记,不静默):`-I` 会跳过二进制文件,而磁盘面把二进制也读进内容预筛;
 * 仓内无二进制同扩展名文件实测,若出现则属"看不见"而非"已确认没有"。
 */
function grepPowershellHits(rev) {
  let raw
  try {
    raw = gitRaw(['grep', '-l', '-z', '-I', '-e', CALLER_PRESCREEN, rev], ROOT, {
      timeout: GIT_FACE_TIMEOUT,
    })
  } catch (e) {
    // git grep rc=1 是"零命中"的正常结论,不是取数失败;其余(rc>1 / 派生故障)一律判死,
    // 把"没枚举成"折进空集 = 调用侧整面隐身而账面全绿(守门 70/76/81 同型禁令)。
    if (e && e.status === 1) return new Set()
    throw new Undetermined(`${rev} 面枚举含 "${CALLER_PRESCREEN}" 的文件失败: ${e.message ?? e}`)
  }
  const set = new Set()
  const prefix = `${rev}:`
  for (const tok of String(raw).split('\0')) {
    if (!tok) continue
    // 实测输出形态:每条 `<rev>:<path>` 以 NUL 结尾。前缀对不上 ⇒ 形态漂了 ⇒ 判死,不猜。
    if (!tok.startsWith(prefix)) {
      throw new Undetermined(
        `git grep -z 输出解不开(第 ${set.size + 1} 条缺 "${prefix}" 前缀):${tok.slice(0, 60)}`,
      )
    }
    set.add(tok.slice(prefix.length))
  }
  return set
}

/** 面上一次读满;catBatch 内部按字节装箱,但对调用方仍是**同一轮**。失败 ⇒ Undetermined。 */
function batchRead(specs) {
  try {
    return catBatch(ROOT, specs, { maxBuffer: 1 << 29, timeout: GIT_FACE_TIMEOUT })
  } catch (e) {
    throw new Undetermined(
      `${face} 面一次 catBatch 读内容失败(${specs.length} 个规格): ${e.message ?? e}`,
    )
  }
}

/**
 * 面上枚举到的路径取不到内容(got 里为 null/undefined)的两分支:
 *  - 盘上仍 ⇒ unmerged 索引 / git 取数故障 —— 这是**取材失败**,不是"没有违规" ⇒ 判死 exit 2;
 *  - 盘上也不在 ⇒ 条目在取证瞬间被人撤下(机器态,不是提交态)⇒ 计"未判定"(goneCount),报数不判红。
 * 两支都必须点名到这里,绝不静默 continue —— 静默少扫就是一道假绿。
 */
function contentMissing(rel, role) {
  if (existsSync(join(ROOT, rel))) {
    throw new Undetermined(
      `${role}在审判面取不到内容而盘上仍在(${rel})—— 未合并索引或取材故障,判"无法判定"`,
    )
  }
  goneCount += 1
}

/** 三面共用的落地器:roles = [{rel, judge, exempt, caller|null}],内容按 specOf 从**同一面**取。 */
function applyRoles(roles, specOf) {
  if (roles.length === 0) return
  const specs = roles.map(specOf)
  const got = batchRead(specs)
  for (let i = 0; i < roles.length; i++) {
    const r = roles[i]
    const raw = got.get(specs[i])
    const content = raw === undefined ? null : raw
    if (content === null) {
      if (r.exempt) pushExemptContent(r.rel, null) // 豁免面旧语义:读不到 ⇒ "未判定",进报告不判红
      else if (r.judge) contentMissing(r.rel, '判定面 .ps1 ')
      else contentMissing(r.rel, '调用侧文件 ')
      continue
    }
    if (r.exempt) pushExemptContent(r.rel, content)
    else if (r.judge) judgePsiContent(r.rel, content)
    if (r.caller) scanCallerContent(content, r.rel, r.caller)
  }
}

/** 全量档 = HEAD blob。枚举与内容同面同轮;任何一步取不到 ⇒ exit 2,不回落到磁盘。 */
function runHead() {
  let tracked
  try {
    tracked = gitRaw(['ls-tree', '-r', '--name-only', '-z', 'HEAD'], ROOT, {
      timeout: GIT_FACE_TIMEOUT,
    })
      .split('\0')
      .filter(Boolean)
  } catch (e) {
    throw new Undetermined(`HEAD 面枚举文件清单失败: ${e.message ?? e}`)
  }
  if (tracked.length === 0)
    throw new Undetermined('HEAD 面枚举到 0 个文件 ⇒ 判据失效,不记通过(空扫不是"都合规")')
  const grepSet = grepPowershellHits('HEAD')
  const roles = []
  for (const rel of tracked) {
    const segs = rel.split('/')
    if (segsBlocked(segs)) continue
    const ext = extOf(rel)
    const dialect = callerDialectForExt(ext)
    if (ext === '.ps1') {
      const exempt = segs.includes(DEPLOY_DIR_NAME)
      // 与磁盘两面同形:.ps1 同时进判定/豁免面,且(在扩展名射程内)也进调用侧。
      roles.push({
        rel,
        judge: !exempt && !isSkippedPath(rel),
        exempt,
        caller: dialect && !CALLER_SELF_EXEMPT.has(rel) ? dialect : null,
      })
    } else if (dialect && !CALLER_SELF_EXEMPT.has(rel) && grepSet.has(rel)) {
      roles.push({ rel, judge: false, exempt: false, caller: dialect })
    }
  }
  applyRoles(roles, (r) => `HEAD:${r.rel}`)
}

/** 提交档 = 索引 blob:清单来自 git diff --cached,内容一次 catBatch 读 `:<rel>`。 */
function runStaged(stagedList) {
  const roles = []
  for (const relRaw of stagedList) {
    const rel = relRaw.replace(/\\/g, '/')
    const segs = rel.split('/')
    const ext = extOf(rel)
    const dialect = callerDialectForExt(ext)
    const callerOk = dialect && !CALLER_SELF_EXEMPT.has(rel) && !segsBlocked(segs)
    const isPsi = ext === '.ps1'
    if (isPsi && segs.includes(DEPLOY_DIR_NAME)) {
      roles.push({ rel, judge: false, exempt: true, caller: callerOk ? dialect : null })
      continue
    }
    if (isPsi) {
      roles.push({ rel, judge: !isSkippedPath(rel), exempt: false, caller: callerOk ? dialect : null })
      continue
    }
    if (!callerOk) continue
    roles.push({ rel, judge: false, exempt: false, caller: dialect })
  }
  applyRoles(roles, (r) => `:${r.rel}`)
}

try {
  if (face === 'staged') {
    const staged = listStagedFiles()
    if (staged === null) {
      // 机器态(非 git 环境 / git 不可达)的**显式**退化 —— 与"取不到就回落另一个面"是两件事:
      // 这里回落的是判据本来的旧全树形态,且喊出来(T6 钉住"退化必须可见")。
      console.warn('[WARN] 非 git 环境,--staged 退化为全树扫描')
      runFull()
    } else {
      runStaged(staged)
    }
  } else if (face === 'head') {
    runHead()
  } else {
    runFull()
  }
} catch (e) {
  if (e instanceof Undetermined) {
    // 取不到 ⇒ exit 2 显式"无法判定"。不得冒红(把没判写成有问题),也不得记绿(写成没问题),
    // 更**不得回落到另一个面**(那会把"这一面没读到"洗成自洽的假结论)。
    console.error(`[FAIL] 无法判定(审判面取材失败,不回落其他面): ${e.message ?? e}`)
    process.exit(2)
  }
  throw e
}

// ── 结论输出:三面分列,措辞不得互相顶替 ──────────────────────────────────────
const exemptMissing = exemptPsi.filter((e) => e.missing)
const exemptUnreadable = exemptPsi.filter((e) => !e.readable)
console.log(
  `[EXEMPT] deploy/** 豁免面(本门**不判**，仅如实报数): ${exemptPsi.length} 个 .ps1，` +
    `其中 ${exemptMissing.length} 个缺 \`#requires -Version 7\``,
)
for (const e of exemptMissing) console.log(`  - ${e.rel}`)
if (exemptUnreadable.length > 0) {
  console.log(`  (${exemptUnreadable.length} 个读不到内容，计"未判定"，不计入缺 pragma 数)`)
}
if (goneCount > 0) {
  console.log(
    `  (${goneCount} 个文件在审判面枚举到、内容却取不到且盘上也不存在 —— 条目在取证瞬间被移除(机器态)，` +
      `计"未判定"，不判红也不冒充已判)`,
  )
}
if (exemptPsi.length > 0) {
  console.log(
    '  理由: `#requires` 在 Windows PowerShell 5.1 上**直接拒绝执行**；这些脚本由 nssm 服务与\n' +
      '        计划任务拉起，别机/服务身份若仍是 5.1，补 pragma 等于让部署/备份/监控服务停摆。\n' +
      '        所以这一面是「没判」，不是「判过且合规」——不得据此或据 AGENTS.md §27 声称的\n' +
      '        "所有项目内 .ps1"推断运维脚本已受 pragma 版本强制；其版本约束由下面的调用侧判据兜。',
  )
}
console.log(
  `[CALLER] 代码面裸 powershell 调用 deploy/**.ps1 的站点: ${callerHits.length} 个` +
    '(判据：遮掉注释后，同一行含 `powershell[.exe] -<参数>` + deploy 路径，且无 pwsh、无 .vbs)',
)
for (const h of callerHits) console.log(`  - ${h.rel}:${h.line}: [${h.dialect}] ${h.text}`)
console.log(
  '  覆盖面：JS/TS 系(.mjs/.cjs/.js/.jsx/.ts/.tsx，遮注释+字符串)与脚本系(.ps1/.sh/.bash/.bat/.cmd/\n' +
    "        .vbs，按各语言词法只遮注释：PS `#`/`<# #>`、shell `#`(词首)、batch `REM`/`::`、VBS `'`)。\n" +
    '        脚本系自 2026-09-28(G-391②)起在判；其**字符串刻意不遮** —— 那里引号内就是真调用\n' +
    '        (`objShell.Run "powershell -File deploy\\…"` 是 §26 的 wscript 包装形态)。\n' +
    '        仍未遮的一格如实登记：脚本文件里的**变量拼接**(`& $exe -File "deploy\\x.ps1"` 之类)判不\n' +
    '        出来，属"看不见"而不是"已确认没有"。',
)
console.log(
  STRICT
    ? '  --strict:命中计入退出码(问责档)。'
    : '  默认档只报数点名、不判红;问责跑 --strict。升提交链 blocking 的前置 = 真仓 HEAD 现读为 0。',
)

const callerFailed = STRICT && callerHits.length > 0
if (violations.length === 0 && !callerFailed) {
  console.log(
    `[OK] 已判面全部合规：${judgedPsiCount} 个非豁免 .ps1 均已声明 \`#requires -Version 7\`` +
      `(deploy/** 豁免面 ${exemptPsi.length} 个未判，见上方 [EXEMPT] 行；调用侧见 [CALLER] 行)`,
  )
  process.exit(0)
}

if (violations.length > 0) {
  console.error(`[FAIL] ${violations.length} .ps1 file(s) missing \`#requires -Version 7\`:`)
  for (const v of violations) {
    console.error(`  - ${v}`)
  }
  console.error('')
  console.error('Fix: add the following as the FIRST line of each file:')
  console.error('  #requires -Version 7')
  console.error('')
  console.error('Reason: PowerShell 5.1 (powershell.exe) is EOL and has known')
  console.error('encoding/parsing bugs. Use PowerShell 7+ (pwsh.exe) only.')
}
if (callerFailed) {
  console.error(
    `[FAIL] --strict: ${callerHits.length} 处代码面裸 powershell 调用 deploy/**.ps1(见上方 [CALLER] 行)。`,
  )
  console.error('       修复:改用 pwsh/pwsh.exe 显式指名 PS7，或经 *.vbs 包装(§26)。')
}
process.exit(1)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
