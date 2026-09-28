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
// 退出码: 0 = 判定面通过(默认档调用侧不计入), 1 = 有违规
// 用法: node scripts/check-pwsh-version.mjs [--staged] [--strict] [--root <path>]
//   --staged : 仅检查 git index 中已暂存的文件(pre-commit 钩子用此模式)
//   --strict : 把 ③ 调用侧命中计入退出码(人工问责 / CI;提交链不传)
//   缺省     : 全树扫描(供人工 / CI 全量审计)
//   --root   : 测试夹具通道(镜像测试用临时仓跑端到端;生产调用不带)
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

const GIT_BIN = resolveGitBin() || 'git'

const args = process.argv.slice(2)
const STAGED = args.includes('--staged')
const STRICT = args.includes('--strict')
const rootIdx = args.indexOf('--root')
const ROOT =
  rootIdx >= 0 ? resolve(args[rootIdx + 1]) : resolve(dirname(fileURLToPath(import.meta.url)), '..')

if (!existsSync(ROOT)) {
  console.error(`[FAIL] root path does not exist: ${ROOT}`)
  process.exit(1)
}

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

function checkFile(filePath) {
  let content
  try {
    content = readFileSync(filePath, 'utf8')
  } catch {
    return // 读不到的跳过
  }
  judgedPsiCount += 1
  if (!hasRequires7(content)) {
    violations.push(relative(ROOT, filePath))
  }
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

function pushExempt(rel, absPath) {
  let missing = false
  let readable = true
  try {
    missing = !hasRequires7(readFileSync(absPath, 'utf8'))
  } catch {
    readable = false
  }
  exemptPsi.push({ rel, missing, readable })
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

const callerHits = []

function scanCallerFile(absPath, relForReport, dialect) {
  let text
  try {
    text = readFileSync(absPath, 'utf8')
  } catch {
    return
  }
  // 预筛:必须是判据字面量的**超集**(调用形态按小写 powershell 判,这里同词直取)。
  // 预筛漏一个形态,门就在该形态上失明 —— 与判据不同形的预筛等于没有(守门 102 同课)。
  if (!text.includes('powershell')) return
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
 */
function listStagedFiles() {
  let out
  try {
    out = execFileSync(
      GIT_BIN,
      ['-c', 'safe.directory=*', 'diff', '--cached', '--name-only', '--diff-filter=ACMR'],
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

if (STAGED) {
  const staged = listStagedFiles()
  if (staged === null) {
    console.warn('[WARN] 非 git 环境,--staged 退化为全树扫描')
    runFull()
  } else {
    for (const relRaw of staged) {
      const rel = relRaw.replace(/\\/g, '/')
      const segs = rel.split('/')
      const dot = rel.lastIndexOf('.')
      const ext = dot >= 0 ? rel.slice(dot).toLowerCase() : ''
      const dialect = callerDialectForExt(ext)
      // 调用侧:与全量档 `walkExemptAndCallers` **同形** —— 那一遍对每个在射程内的文件都跑
      // (deploy/**.ps1 既进豁免面也进调用侧),暂存档若对 .ps1 只跑 pragma 面就跑掉了这一半。
      // .ps1 现在是调用面扩展名之一,这一格从"理论不一致"变成"实测会分叉"(镜像 T8 钉住)。
      const callerOk =
        dialect &&
        !CALLER_SELF_EXEMPT.has(rel) &&
        !segs.some((s) => NEVER_ENTER_DIRS.has(s) || isExcludedDirName(s))
      const isPsi = ext === '.ps1'
      if (isPsi && segs.includes(DEPLOY_DIR_NAME)) {
        pushExempt(rel, join(ROOT, relRaw)) // 豁免面:进报告、不判红
        if (callerOk) scanCallerFile(join(ROOT, relRaw), rel, dialect)
        continue
      }
      if (isPsi) {
        if (!isSkippedPath(relRaw)) checkFile(join(ROOT, relRaw)) // 已删除的文件 readFileSync 失败即跳过
        if (callerOk) scanCallerFile(join(ROOT, relRaw), rel, dialect)
        continue
      }
      if (!callerOk) continue
      scanCallerFile(join(ROOT, relRaw), rel, dialect)
    }
  }
} else {
  runFull()
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
