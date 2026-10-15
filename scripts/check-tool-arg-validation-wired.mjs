// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门「工具入参校验器接线对账」(A31 第①步的尺子,2026-09-26 立)
//
// 只判一条主判据 + 一条结构判据:
//   V1 校验器必须真有**生产调用方** —— 全仓(非测试面)存在 `validateToolArguments(` 的调用形态。
//      立因:`apps/cli/src/tools/argument-validator.ts` 落地起生产面零调用方,即"CLI 工具入参
//      根本不校验",而 typecheck / 单测 / 其余任何门都不会红(它自带的测试是绿的,恰恰证明
//      "没人调用"和"能跑"互不矛盾)。这是本仓最高频的一型:**造好没装车**(见守门 64/70/81)。
//   V2 影子档必须在位,且**默认档不得是 enforce** —— 直接读模式源里"默认值那一行"。
//      enforce 是第②③步的活;若某轮把默认翻了,"昨天能跑今天全被拒"会直接进生产。
//
// 另出**一条读数(不是判红,L9264 明写)**:影子档的**实际覆盖面**。
//   立因:V2 只判"影子档在位 / 默认不是 enforce",**不判影子档到底覆盖了多少个工具调用站点**。
//   于是"装了但覆盖面极低"与"装了且全覆盖"在读数上完全同形 —— 覆盖面被收窄不会让任何一道
//   门变红,正是上游要防的"局部不生效但无人点名"(`apps/cli/src/tools/index.ts` 的
//   `hubEnabled && hubResolver` 分支在拿到 Tool 对象之前就 return,那条路径影子不生效)。
//   量法(全在被审面上现算,不报常量):
//     · 候选站点 = 生产面里 `tool.execute(` 的调用行(掩噪后、去声明行)—— 一次工具调用
//       真正被执行的落点;
//     · 影子档命中 = 该站点所在文件里有影子档入口 `shadowValidateToolArguments(` 的**调用行**,
//       且接线行号 < 站点行号(静态行序,不是可达性分析 —— 已知限制写在 auditShadowCoverage 头注);
//     · 未覆盖 = 其余站点,逐条 `rel:line` 点名;
//     · 早退分支 = 影子档接线点所在函数体内、**位于接线点之前**的 `return` 行 —— 这就是票面要的
//       "本轮应被记录而因早退未记录的调用数",同样逐条点名。
//   三态必须不同形:**量得出**(命中 X / 候选 Y) / **候选站点 0**(读数为空,不得读作"全覆盖") /
//   **未判定**(面里取不到正文、或面上根本没有影子档接线点 ⇒ 不折 0、不折绿,见 auditShadowCoverage)。
//
// 取材口径(同 70/77/83/98/101/103):全量判 **HEAD blob**、`--staged` 判**索引 blob**、
//   `--worktree` 只作人工逃生舱;两旗同给判死;取不到 ⇒ **exit 2 无法判定**;
//   **枚举到 0 个候选文件判死**(扫描面判空 = 判据失效,绝不表现为 exit 0 的绿)。
//
// 用法:
//   node scripts/check-tool-arg-validation-wired.mjs              # 全量(HEAD 面)
//   node scripts/check-tool-arg-validation-wired.mjs --staged     # 索引面
//   node scripts/check-tool-arg-validation-wired.mjs --worktree   # 磁盘(人工排查)
//   node scripts/check-tool-arg-validation-wired.mjs --self-test  # 临时独立仓正反成对自检
//   --root <dir>  显式仓库根(测试通道;生产不带)
// 退出码:0 通过 / 1 判据违规 / 2 无法判定或脚本自身异常
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  assertRepoRoot,
  gitRaw,
  readWorktreeFile,
  selectFace,
  Undetermined,
} from './lib/face-reader.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'
import { requireFlagValue } from './lib/flag-value.mjs'

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** 判据要抓的调用形态(定死的固定串,不做正则 —— 正则会把注释里的说明文字也认成调用)。 */
const CALL_PATTERN = 'validateToolArguments('
/** 影子档入口 —— 覆盖面读数的"接线点"(同为固定串,同口径)。 */
const SHADOW_ENTRY_PATTERN = 'shadowValidateToolArguments('
/** 一次工具调用真正被执行的落点 —— 覆盖面读数的"候选站点"。 */
const EXEC_SITE_PATTERN = 'tool.execute('
/** 校验器定义文件本身不算调用方。 */
const DEFINITION_FILE = 'apps/cli/src/tools/argument-validator.ts'
/** 影子档模式源(守门 V2 读它的"默认值那一行")。 */
const MODE_SOURCE_FILE = 'apps/cli/src/tools/argument-validation-telemetry.ts'
/** 本门与它的镜像测试必然逐字含有 CALL_PATTERN,不参与对账。 */
const SELF_EXEMPT_BASENAMES = ['check-tool-arg-validation-wired.mjs']

export const SKIP_ENV_NAME = 'HUSKY_SKIP_TOOL_ARG_VALIDATION_WIRED'
export const GUARDIAN_ID_EXPECTED = '115'

// ==================== 判据纯函数 ====================

/**
 * 把注释与字符串字面量抹成空格(逐字符状态机,不做行级猜测)。
 *
 * 为什么必须抹:本仓的注释里大量出现**被解释的标识符本身**(定义文件的头注就写着
 * `formatValidationErrors()`)。字面量尺子量到自己的解释注释 = 一道自咬的门(仓里踩过三次)。
 * 抹完仍保留行结构与换行,所以下面的"按行数 caller 行"与行号都对得上。
 *
 * 已知限制(如实登记):状态机不认**正则字面量**,所以 `/'/` 这类串里的引号会让它多抹一段代码。
 * 失误方向是"把真调用抹掉 ⇒ V1 假红",而不是"把注释当调用 ⇒ 假绿";候选文件只有个位数,
 * 且真仓现在没有任何候选文件用这种写法(跑 `--self-test` 的 A1/A2 成对项即可复核)。
 */
export function maskNoise(text) {
  const out = []
  let state = 'code' // code | line | block | sq | dq | tpl
  let i = 0
  while (i < text.length) {
    const c = text[i]
    const next = text[i + 1]
    if (state === 'code') {
      if (c === '/' && next === '/') {
        state = 'line'
        out.push(' ', ' ')
        i += 2
        continue
      }
      if (c === '/' && next === '*') {
        state = 'block'
        out.push(' ', ' ')
        i += 2
        continue
      }
      if (c === "'") state = 'sq'
      else if (c === '"') state = 'dq'
      else if (c === '`') state = 'tpl'
      out.push(c)
      i += 1
      continue
    }
    if (state === 'line') {
      if (c === '\n' || c === '\r') {
        state = 'code'
        out.push(c)
      } else out.push(' ')
      i += 1
      continue
    }
    if (state === 'block') {
      if (c === '*' && next === '/') {
        state = 'code'
        out.push(' ', ' ')
        i += 2
        continue
      }
      out.push(c === '\n' || c === '\r' ? c : ' ')
      i += 1
      continue
    }
    // 字符串面:转义符吃掉下一个字符;模板串里的 ${…} 不重新进代码态(本判据不需要那么准,
    // 保守方向是"串内一律不算调用",而 `${}` 插值里真去调校验器在本仓不存在)。
    const quote = state === 'sq' ? "'" : state === 'dq' ? '"' : '`'
    if (c === '\\') {
      out.push(' ', text[i + 1] === '\n' ? '\n' : ' ')
      i += 2
      continue
    }
    if (c === quote) {
      state = 'code'
      out.push(c)
      i += 1
      continue
    }
    if ((state === 'sq' || state === 'dq') && (c === '\n' || c === '\r')) {
      // 单行引号串里出现裸换行 = 该文件的词法已不可信(或本状态机没认出续行)⇒ 退回 code,
      // 宁可随后把这一行当 caller 交人工看,也不允许"抹多了"把红洗成绿。
      state = 'code'
      out.push(c)
      i += 1
      continue
    }
    out.push(' ')
    i += 1
  }
  return out.join('')
}

/**
 * 声明形态(定义本身)不是调用方。
 * @param {string} line 掩噪后的一行
 * @param {string} pattern 形如 `xxx(` 的固定串(覆盖面读数复用本函数判影子档入口的声明行)
 */
export function isDeclarationLine(line, pattern = CALL_PATTERN) {
  const name = pattern.replace(/\($/, '')
  return new RegExp(
    `^\\s*(export\\s+)?(async\\s+)?function\\s+${name.replace(/\$/g, '\\$')}\\b`,
  ).test(line)
}

/** 掩噪后仍含调用形态的行。 */
export function findCallLines(text, pattern = CALL_PATTERN) {
  const masked = maskNoise(text)
  const hits = []
  const lines = masked.split(/\r?\n/)
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n]
    if (!line.includes(pattern)) continue
    if (isDeclarationLine(line, pattern)) continue
    hits.push({ line: n + 1, text: line.trim().slice(0, 120) })
  }
  return hits
}

export function classifyPath(rel) {
  const base = rel.split('/').pop() ?? rel
  if (SELF_EXEMPT_BASENAMES.includes(base)) return 'self'
  if (rel === DEFINITION_FILE) return 'definition'
  if (/\.(md|mdx|txt)$/i.test(rel)) return 'doc'
  if (isTestSurface(rel)) return 'test'
  return 'prod'
}

/**
 * 测试面的口径:测试文件里调用校验器**不能**当作"装车"的证据 —— 立门那一刻的真实状态就是
 * "只有它自己的单测在调用它,而生产链上一个调用方都没有"。这一条不收窄,V1 从上线第一天就是绿的。
 */
export function isTestSurface(rel) {
  return (
    /(^|\/)tests?\//.test(rel) ||
    rel.includes('__tests__/') ||
    /(^|\/)e2e\//.test(rel) ||
    /\.(test|spec)\.[cm]?[jt]sx?$/i.test(rel)
  )
}

/**
 * 求 lineIdx(1-based)所在**最外层**函数体的字符区间(在掩噪后文本上做花括号配对)。
 *
 * 已知限制(如实登记):认的是花括号,不认箭头函数体与对象字面量的区别 —— 若该行处在一个
 * 对象字面量里,`{` 会被当成函数体的开括号。失误方向是"函数体取小 ⇒ 早退分支数偏少",
 * 也就是**把未覆盖洗成已覆盖**那一侧;所以本函数取不到(`null`)时,调用方一律落未判定,
 * 绝不折成 0。
 * @returns {{start:number,end:number}|null}
 */
export function enclosingFunctionBody(text, lineIdx) {
  const lines = text.split(/\r?\n/)
  let pos = 0
  for (let i = 0; i < lineIdx - 1 && i < lines.length; i++) pos += lines[i].length + 1
  let start = -1
  let depth = 0
  for (let i = Math.min(pos, text.length - 1); i >= 0; i--) {
    const c = text[i]
    if (c === '{') {
      if (depth === 0) {
        start = i
        break
      }
      depth -= 1
    } else if (c === '}') depth += 1
  }
  if (start < 0) return null
  let end = -1
  depth = 0
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (c === '{') depth += 1
    else if (c === '}') {
      depth -= 1
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  return end < 0 ? null : { start, end }
}

/**
 * 影子档接线点所在函数体内、**位于接线点之前**的 `return` 行 —— 即"应被记录而因早退未记录"的出口。
 *
 * 已知限制:嵌套函数自己的 return 也会被算进来(只按行号区间取,不做函数级过滤)。
 * 失误方向是**早退数偏大 ⇒ 覆盖面读数偏悲观**,不会把早退洗成已覆盖。
 */
export function findEarlyReturnLines(text, lineIdx) {
  const range = enclosingFunctionBody(text, lineIdx)
  if (!range) return []
  const lines = text.split(/\r?\n/)
  const offsets = [0]
  for (let n = 0; n < lines.length; n++) offsets.push(offsets[n] + lines[n].length + 1)
  let startLine = 1
  for (let n = 0; n < lines.length; n++) {
    if (offsets[n] <= range.start) startLine = n + 1
    else break
  }
  const hits = []
  for (let n = startLine; n < lineIdx && n <= lines.length; n++) {
    const raw = lines[n - 1]
    if (/\breturn\b/.test(raw)) hits.push({ line: n, text: raw.trim().slice(0, 120) })
  }
  return hits
}

/**
 * 影子档**覆盖面读数**(纯函数,取材在它外面 —— 与 decide 同款,self-test/镜像测试都构造面直喂)。
 *
 * @param {Array<{rel:string,text:string|null}>} files 同面读到的正文(规则内自行判 prod 面)
 * @returns {{state:string,total:number,coveredCount:number,shadowSites:Array,execSites:Array,
 *            covered:Array,uncovered:Array,earlyReturns:Array,undetermined:Array}}
 *
 * state 三态(输出必须不同形):
 *   'measured'     量出来了:命中 X / 候选 Y + 未覆盖清单 + 早退分支清单
 *   'no-sites'     影子档有接线,但面上一个候选站点都没有 ⇒ 读数为空(读作"无站点可覆盖",
 *                  **不得**读作"全覆盖")
 *   'undetermined' 取不到正文 / 面上根本没有影子档接线点 ⇒ 不可考,**不折 0、不折绿**
 */
export function auditShadowCoverage(files) {
  const shadowSites = []
  const execSites = []
  const undetermined = []
  const prodFiles = []
  for (const it of files) {
    if (classifyPath(it.rel) !== 'prod') continue
    prodFiles.push(it)
    if (it.text === null) {
      undetermined.push({
        rel: it.rel,
        reason: '该面取不到正文 ⇒ 这一份的覆盖面不可考(不折 0、不折绿)',
      })
      continue
    }
    for (const h of findCallLines(it.text, SHADOW_ENTRY_PATTERN))
      shadowSites.push({ rel: it.rel, ...h })
    for (const h of findCallLines(it.text, EXEC_SITE_PATTERN)) execSites.push({ rel: it.rel, ...h })
  }
  const covered = []
  const uncovered = []
  for (const site of execSites) {
    const wired = shadowSites.some((s) => s.rel === site.rel && s.line < site.line)
    if (wired) covered.push(site)
    else uncovered.push(site)
  }
  const earlyReturns = []
  const seen = new Set()
  for (const s of shadowSites) {
    const key = `${s.rel}@${s.line}`
    if (seen.has(key)) continue
    seen.add(key)
    for (const r of findEarlyReturnLines(files.find((f) => f.rel === s.rel)?.text ?? '', s.line))
      earlyReturns.push({ rel: s.rel, ...r })
  }
  let state = 'measured'
  if (shadowSites.length === 0)
    undetermined.push({
      rel: '(全生产面)',
      reason: `面上找不到 ${SHADOW_ENTRY_PATTERN} 的调用行 ⇒ 影子档没接线,覆盖面不可考(不折 0)`,
    })
  if (undetermined.length > 0) state = 'undetermined'
  else if (execSites.length === 0) state = 'no-sites'
  return {
    state,
    total: execSites.length,
    coveredCount: covered.length,
    shadowSites,
    execSites,
    covered,
    uncovered,
    earlyReturns,
    undetermined,
  }
}

/**
 * V2:读模式源里的"默认值那一行"与档位清单。
 * @returns {{issues:string[], defaultMode:string|null, modes:string[]}}
 */
export function auditModeSource(text) {
  const issues = []
  const modesMatch = /TOOL_ARG_VALIDATION_MODES\s*=\s*\[([^\]]*)\]/.exec(text)
  const modes = modesMatch ? [...modesMatch[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]) : []
  if (!modesMatch) issues.push('读不到 TOOL_ARG_VALIDATION_MODES 档位清单(影子档必须被显式列出)')
  else {
    if (!modes.includes('shadow'))
      issues.push(`档位清单缺 shadow(实得 ${modes.join('/') || '(空)'})`)
    if (!modes.includes('off')) issues.push(`档位清单缺 off(实得 ${modes.join('/')})`)
  }
  const defMatch = /DEFAULT_TOOL_ARG_VALIDATION_MODE[^=\n]*=\s*['"]([^'"]+)['"]/.exec(text)
  if (!defMatch) issues.push(`读不到 ${MODE_SOURCE_FILE} 里的默认档那一行(默认值不可考 ⇒ 不记绿)`)
  else if (defMatch[1] === 'enforce')
    issues.push(`默认档是 enforce —— enforce 是第②③步的活,默认翻它等于把未实现的拒绝语义接进生产链`)
  return { issues, defaultMode: defMatch ? defMatch[1] : null, modes }
}

/**
 * 汇总判据(纯函数,取材在它外面)—— self-test 与镜像测试都直接构造它的输入,
 * 这样"取材面"与"判据"两件事不会互相遮掩(仓里教训:证明取材面只能用纯函数+构造面)。
 */
export function decide(items, modeSource) {
  const violations = []
  const counts = { prod: 0, definition: 0, test: 0, self: 0, doc: 0, commentOnly: 0 }
  let callerFound = false
  for (const it of items) {
    const kind = classifyPath(it.rel)
    counts[kind] += 1
    if (kind === 'definition' || kind === 'self' || kind === 'doc') continue
    const calls = it.text === null ? [] : findCallLines(it.text)
    if (kind === 'prod') {
      if (calls.length > 0) callerFound = true
      else counts.commentOnly += 1
    }
    if (kind === 'test' && calls.length > 0) counts.testCallers = (counts.testCallers ?? 0) + 1
  }
  if (!callerFound) {
    violations.push(
      `V1 校验器无生产调用方:全仓 ${items.length} 个含 "${CALL_PATTERN}" 的文件里,` +
        `生产面 0 处真调用(定义 ${counts.definition} / 测试面 ${counts.test} / 注释面 ${counts.commentOnly})` +
        ` ⇒ "影子校验"那段代码要么没落地,要么被摘线`,
    )
  }
  if (modeSource === null) {
    violations.push(`V2 模式源文件 ${MODE_SOURCE_FILE} 不在该判定面里 ⇒ 影子档缺席,无从判默认值`)
  } else {
    for (const issue of auditModeSource(modeSource).issues) violations.push(`V2 ${issue}`)
  }
  return { violations, counts, callerFound }
}

// ==================== 取材 ====================

/**
 * 列出含 CALL_PATTERN 的文件(三态都用 git grep 的对应面)。
 * `git grep` 无命中回 exit 1,那是**git 说"没有"**,与"git 没跑成"必须分开:前者返回空清单,
 * 后者由 gitRaw 抛 Undetermined。混起来的话,"仓里没有校验器"会伪装成"没有违规"。
 */
export function listCandidates(root, face, pattern = CALL_PATTERN) {
  const args =
    face === 'head'
      ? ['grep', '-F', '-l', pattern, 'HEAD', '--']
      : face === 'staged'
        ? ['grep', '-F', '-l', '--cached', pattern]
        : ['grep', '-F', '-l', pattern]
  let out
  try {
    out = gitRaw(args, root)
  } catch (e) {
    if (e instanceof Undetermined && e.status === 1) return []
    throw e
  }
  return out
    .split(/\r?\n/)
    .map((l) => l.replace(/^HEAD:/, '').trim())
    .filter(Boolean)
    .sort()
}

/**
 * 覆盖面读数的候选站点枚举 —— **同一面、同一轮、同一个 gitRaw**,只是换一个 grep 串。
 * 不另起一份判定面:读正文仍走下面的 readOnFace,与 V1 共用同一批 blob。
 */
export function listExecSites(root, face) {
  return listCandidates(root, face, EXEC_SITE_PATTERN)
}

function readOnFace(root, face, rel) {
  if (face === 'worktree') return readWorktreeFile(root, rel)
  try {
    return gitRaw(['show', face === 'head' ? `HEAD:${rel}` : `:${rel}`], root)
  } catch (e) {
    // 候选是从同一个面 grep 出来的 ⇒ 它按定义在该面存在;取不到只有可能是仓在动。
    throw new Undetermined(`${rel} 在 ${face} 面 grep 到了却取不到内容:${e.message}(不猜、不记绿)`)
  }
}

/** 完整一轮:枚举 + 同面读内容 + 判据。返回结构化结论(不改退出码,便于 self-test 复用)。 */
export function analyze(root, face) {
  assertRepoRoot(root, '工具入参校验器接线对账')
  const rels = listCandidates(root, face)
  const items = rels.map((rel) => ({ rel, text: readOnFace(root, face, rel) }))
  let modeSource = null
  try {
    modeSource = readOnFace(root, face, MODE_SOURCE_FILE)
  } catch (e) {
    if (!(e instanceof Undetermined)) throw e
    modeSource = null
  }
  const verdict = decide(items, modeSource)
  // 覆盖面读数:候选站点可能在**不含** CALL_PATTERN 的文件里(hub adapter 那一类旁路正是这样
  // 隐身的),所以枚举用同一面再 grep 一次 EXEC_SITE_PATTERN,正文仍走 readOnFace —— 同面同轮。
  const execRels = listExecSites(root, face)
  const unionRels = [...new Set([...rels, ...execRels])].sort()
  const byRel = new Map(items.map((i) => [i.rel, i]))
  const coverageFiles = unionRels.map(
    (rel) => byRel.get(rel) ?? { rel, text: readOnFace(root, face, rel) },
  )
  return {
    face,
    scanned: rels.length,
    candidateRels: rels,
    modeSourceAvailable: modeSource !== null,
    coverage: auditShadowCoverage(coverageFiles),
    ...verdict,
  }
}

// ==================== CLI ====================

function printVerdict(res, root) {
  console.log(
    `工具入参校验器接线对账 · 判定面:${res.face} · 候选 ${res.scanned} 个文件 · ROOT ${root}`,
  )
  console.log(
    `  生产面调用:${res.callerFound ? '✅ 有' : '❌ 无'} | 定义 ${res.counts.definition} / 生产 ${res.counts.prod} / 测试面 ${res.counts.test} / 自豁免 ${res.counts.self} / 文档 ${res.counts.doc}`,
  )
  for (const v of res.violations) console.log(`  ❌ ${v}`)
  console.log(formatCoverage(res.coverage))
  if (res.violations.length === 0)
    console.log(
      res.coverage && res.coverage.state === 'undetermined'
        ? '  ✅ 校验器有生产调用方,且影子档在位、默认档不是 enforce · ⚠️ 但覆盖面读数未判定(见上一行,不折 0、不折绿)'
        : '  ✅ 校验器有生产调用方,且影子档在位、默认档不是 enforce',
    )
}

/** 站点清单最多点名 6 条,其余折成"…等 N 个"(台账要的是点名,不是刷屏)。 */
function siteList(sites) {
  const names = sites.map((s) => `${s.rel}:${s.line}`)
  if (names.length <= 6) return names.join(', ')
  return `${names.slice(0, 6).join(', ')} …等 ${names.length} 个`
}

/** 覆盖面读数行(三态不同形:量得出 / 候选 0 / 未判定)。 */
export function formatCoverage(cov) {
  if (!cov) return '  ❓ 影子档覆盖面:未判定 —— 本轮没产覆盖面读数(不折 0、不折绿)'
  if (cov.state === 'undetermined') {
    const why = cov.undetermined.map((u) => `${u.rel} → ${u.reason}`).join('; ')
    return `  ❓ 影子档覆盖面:未判定 —— ${why}(读数缺失,不折 0、不折绿)`
  }
  if (cov.state === 'no-sites')
    return '  ❓ 影子档覆盖面:候选站点 0 个 ⇒ 读数为空(读作"无站点可覆盖",不得读作"全覆盖")'
  const pct = cov.total === 0 ? '0.0' : ((cov.coveredCount / cov.total) * 100).toFixed(1)
  const un =
    cov.uncovered.length === 0 ? '无' : `${cov.uncovered.length} [${siteList(cov.uncovered)}]`
  const early =
    cov.earlyReturns.length === 0
      ? '0'
      : `${cov.earlyReturns.length} [${siteList(cov.earlyReturns)}]`
  return (
    `  📏 影子档覆盖面(读数,不判红):命中 ${cov.coveredCount} / 候选 ${cov.total} (${pct}%) · ` +
    `未覆盖 ${un} · 早退分支 ${early}`
  )
}

function runSelfTest() {
  const results = []
  const ok = (name, cond, detail = '') => results.push({ name, pass: !!cond, detail })

  const DEFINITION = `export function validateToolArguments(args: unknown, schema: unknown) { return { valid: true, coerced: args as Record<string, unknown>, errors: [], coercedFields: [] } }\n`
  const MODES_OK = `export const TOOL_ARG_VALIDATION_MODES = ['off', 'shadow', 'enforce'] as const\nexport const DEFAULT_TOOL_ARG_VALIDATION_MODE = 'off'\n`
  const CALLER = `import { validateToolArguments } from './argument-validator.js'\nexport function run(a, s) { return validateToolArguments(a, s) }\n`
  const COMMENT_ONLY = `/* ${CALL_PATTERN} 只是解释,不是调用 */\n// ${CALL_PATTERN} 同上\nexport const x = 1\n`
  const IN_STRING_ONLY = `export const hint = "${CALL_PATTERN}args)"\n`
  const TEST_CALLER = CALLER

  const makeRepo = (tag, files) => {
    const dir = mkScratch(`tool-arg-wired-${tag}-`)
    for (const [rel, content] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, rel)), { recursive: true })
      writeFileSync(join(dir, rel), content)
    }
    gitRaw(['init', '-q'], dir)
    // 夹具自带提交身份:临时仓在共享仓之外,读不到本仓的 local 身份,而 global 未设时 git 会
    // 拿 `user@host` 兜底 —— 主机名含中文的机器上这一步直接 fatal,自检因此与判据无关地红。
    gitRaw(['config', 'user.email', 'gate-fixture@invalid'], dir)
    gitRaw(['config', 'user.name', 'gate-fixture'], dir)
    gitRaw(['add', '-A'], dir)
    gitRaw(['commit', '-q', '-m', 'fixture'], dir)
    return dir
  }
  const dirs = []
  const mk = (tag, files) => {
    const d = makeRepo(tag, files)
    dirs.push(d)
    return d
  }
  const withProd = () => ({
    'apps/cli/src/tools/argument-validator.ts': DEFINITION,
    'apps/cli/src/tools/argument-validation-telemetry.ts': MODES_OK,
    'apps/cli/src/tools/index.ts': CALLER,
  })

  try {
    // ①②成对:有生产调用 ⇒ 绿 / 摘掉调用方 ⇒ 红(这条是本门的存在理由,必须有牙)
    const green = analyze(mk('g', withProd()), 'head')
    ok('A1 有生产调用方 ⇒ 无违规', green.violations.length === 0, JSON.stringify(green.violations))
    const red = analyze(
      mk('r', {
        'apps/cli/src/tools/argument-validator.ts': DEFINITION,
        'apps/cli/src/tools/argument-validation-telemetry.ts': MODES_OK,
      }),
      'head',
    )
    ok(
      'A2 摘掉调用方 ⇒ V1 判红',
      red.violations.some((v) => v.startsWith('V1')),
      JSON.stringify(red.violations),
    )

    // ③反向对照:判据失效不得表现为"扫 0 记绿" ⇒ 空面必须被上层判成无法判定
    const empty = analyze(mk('e', { 'README.md': 'nothing here\n' }), 'head')
    ok(
      'A3 枚举到 0 个候选(扫描面判空)',
      empty.scanned === 0 && empty.violations.length > 0,
      `scanned=${empty.scanned}`,
    )

    // ④注释里的提及不算调用(否则定义文件自己的头注就能骗绿)
    const comment = analyze(
      mk('c', {
        'apps/cli/src/tools/argument-validator.ts': DEFINITION,
        'apps/cli/src/tools/argument-validation-telemetry.ts': MODES_OK,
        'src/a.ts': COMMENT_ONLY,
        'src/b.ts': IN_STRING_ONLY,
      }),
      'head',
    )
    ok(
      'A4 仅注释/字符串里提及 ⇒ V1 仍判红',
      comment.violations.some((v) => v.startsWith('V1')),
      JSON.stringify(comment.violations),
    )
    ok(
      'A4b maskNoise 把注释与串都抹掉',
      findCallLines(COMMENT_ONLY).length === 0 && findCallLines(IN_STRING_ONLY).length === 0,
    )
    ok('A4c maskNoise 不抹真调用(判别力证明)', findCallLines(CALLER).length === 1)

    // ⑤测试面调用不构成"装车"
    const testOnly = analyze(
      mk('t', {
        'apps/cli/src/tools/argument-validator.ts': DEFINITION,
        'apps/cli/src/tools/argument-validation-telemetry.ts': MODES_OK,
        'apps/cli/tests/argument-validator.test.ts': TEST_CALLER,
      }),
      'head',
    )
    ok(
      'A5 只有测试面调用 ⇒ V1 判红',
      testOnly.violations.some((v) => v.startsWith('V1')),
      JSON.stringify(testOnly.violations),
    )

    // ⑥⑦⑧ V2 三态:默认 enforce / 缺 shadow / 模式源不在面
    const badDefault = analyze(
      mk('d', {
        'apps/cli/src/tools/argument-validator.ts': DEFINITION,
        'apps/cli/src/tools/argument-validation-telemetry.ts': `export const TOOL_ARG_VALIDATION_MODES = ['off', 'shadow', 'enforce'] as const\nexport const DEFAULT_TOOL_ARG_VALIDATION_MODE = 'enforce'\n`,
        'apps/cli/src/tools/index.ts': CALLER,
      }),
      'head',
    )
    ok(
      'A6 默认档 = enforce ⇒ V2 判红',
      badDefault.violations.some((v) => v.startsWith('V2')),
      JSON.stringify(badDefault.violations),
    )
    const noShadow = analyze(
      mk('ns', {
        'apps/cli/src/tools/argument-validator.ts': DEFINITION,
        'apps/cli/src/tools/argument-validation-telemetry.ts': `export const TOOL_ARG_VALIDATION_MODES = ['off', 'enforce'] as const\nexport const DEFAULT_TOOL_ARG_VALIDATION_MODE = 'off'\n`,
        'apps/cli/src/tools/index.ts': CALLER,
      }),
      'head',
    )
    ok(
      'A7 档位清单缺 shadow ⇒ V2 判红',
      noShadow.violations.some((v) => v.includes('shadow')),
      JSON.stringify(noShadow.violations),
    )
    const noModeSrc = analyze(
      mk('nm', {
        'apps/cli/src/tools/argument-validator.ts': DEFINITION,
        'apps/cli/src/tools/index.ts': CALLER,
      }),
      'head',
    )
    ok(
      'A8 模式源不在该面 ⇒ V2 判红',
      noModeSrc.violations.some((v) => v.includes('影子档缺席')),
      JSON.stringify(noModeSrc.violations),
    )

    // ⑨自豁免:本门自己的判据串不得把自己算成调用方
    const selfOnly = analyze(
      mk('s', {
        'apps/cli/src/tools/argument-validator.ts': DEFINITION,
        'apps/cli/src/tools/argument-validation-telemetry.ts': MODES_OK,
        'scripts/check-tool-arg-validation-wired.mjs': CALLER,
      }),
      'head',
    )
    ok(
      'A9 门自身含判据串 ⇒ 不计生产调用方',
      selfOnly.violations.some((v) => v.startsWith('V1')),
      JSON.stringify(selfOnly.violations),
    )

    // ⑩口径:索引面与 HEAD 面各读各的(索引里摘掉调用方 ⇒ staged 判红而 head 判绿)
    const split = mk('sp', withProd())
    writeFileSync(join(split, 'apps/cli/src/tools/index.ts'), 'export const x = 1\n')
    gitRaw(['add', '-A'], split)
    const staged = analyze(split, 'staged')
    const head = analyze(split, 'head')
    ok(
      'A10 索引面摘掉调用方 ⇒ staged 判红',
      staged.violations.some((v) => v.startsWith('V1')),
      JSON.stringify(staged.violations),
    )
    ok(
      'A10b 同仓 HEAD 面仍判绿(两facet不互相洗白)',
      head.violations.length === 0,
      JSON.stringify(head.violations),
    )

    // ⑪声明行本身不算调用
    ok('A11 定义行不计 caller', findCallLines(DEFINITION).length === 0)

    // ⑫⑬⑭⑮ 影子档覆盖面读数(L9264):读数必须**等于实测值**,且三态不同形
    const SHADOW_DECL = `export function ${SHADOW_ENTRY_PATTERN}tool, args) {\n  return 0\n}\n`
    const EXECUTOR = [
      `import { shadowValidateToolArguments } from './argument-validation-telemetry.js'`,
      `export async function executeToolCall(call, ctx) {`,
      `  if (ctx.hubEnabled) {`,
      `    return { success: false, output: '', error: 'hub' }`,
      `  }`,
      `  const tool = getTool(call.name)`,
      `  ${SHADOW_ENTRY_PATTERN}tool, call.arguments)`,
      `  return ${EXEC_SITE_PATTERN}call.arguments, ctx)`,
      `}`,
      ``,
    ].join('\n')
    const HUB_ADAPTER = [
      `export function adapt(tool, args, ctx) {`,
      `  return ${EXEC_SITE_PATTERN}args, ctx)`,
      `}`,
      ``,
    ].join('\n')
    const EARLY_EXEC = [
      `export function fast(tool, args, ctx) {`,
      `  return ${EXEC_SITE_PATTERN}args, ctx)`,
      `}`,
      `export function slow(tool, args, ctx) {`,
      `  if (!args) return null`,
      `  ${SHADOW_ENTRY_PATTERN}tool, args)`,
      `  return ${EXEC_SITE_PATTERN}args, ctx)`,
      `}`,
      ``,
    ].join('\n')
    const cov = auditShadowCoverage([
      { rel: 'apps/cli/src/tools/argument-validation-telemetry.ts', text: SHADOW_DECL },
      { rel: 'apps/cli/src/tools/index.ts', text: EXECUTOR },
      { rel: 'apps/cli/src/tools/hub/adapter.ts', text: HUB_ADAPTER },
      { rel: 'apps/cli/src/tools/hub/resolver.ts', text: EARLY_EXEC },
    ])
    ok(
      'C1 覆盖面读数 = 实测值(候选 4 / 命中 2)',
      cov.state === 'measured' && cov.total === 4 && cov.coveredCount === 2,
      `state=${cov.state} ${cov.coveredCount}/${cov.total} uncovered=${JSON.stringify(cov.uncovered)}`,
    )
    ok(
      'C1b 未覆盖站点逐条点名(行序:接线点之前的执行点 + 无接线文件)',
      cov.uncovered.length === 2 &&
        cov.uncovered.some((s) => s.rel === 'apps/cli/src/tools/hub/adapter.ts' && s.line === 2) &&
        cov.uncovered.some((s) => s.rel === 'apps/cli/src/tools/hub/resolver.ts' && s.line === 2),
      JSON.stringify(cov.uncovered),
    )
    ok(
      'C2 早退分支读数 >0 且点名分支所在行',
      cov.earlyReturns.length === 2 &&
        cov.earlyReturns.some((r) => r.rel === 'apps/cli/src/tools/index.ts' && r.line === 4) &&
        cov.earlyReturns.some(
          (r) => r.rel === 'apps/cli/src/tools/hub/resolver.ts' && r.line === 5,
        ),
      JSON.stringify(cov.earlyReturns),
    )
    const noEarly = auditShadowCoverage([
      {
        rel: 'apps/cli/src/tools/index.ts',
        text: EXECUTOR.replace(/  if \(ctx\.hubEnabled\) \{\n    return \{[^}]*\}\n  \}\n/, ''),
      },
    ])
    ok(
      'C2b 摘掉早退分支 ⇒ 早退读数归 0(判别力证明)',
      noEarly.state === 'measured' && noEarly.earlyReturns.length === 0 && noEarly.total === 1,
      `state=${noEarly.state} early=${JSON.stringify(noEarly.earlyReturns)} total=${noEarly.total}`,
    )
    const noWire = auditShadowCoverage([
      { rel: 'apps/cli/src/tools/hub/adapter.ts', text: HUB_ADAPTER },
    ])
    ok(
      'C3 摘掉影子档接线 ⇒ 未判定(绝不能折成 0 覆盖)',
      noWire.state === 'undetermined' && noWire.undetermined.length > 0,
      `state=${noWire.state} undetermined=${JSON.stringify(noWire.undetermined)}`,
    )
    const unreadable = auditShadowCoverage([
      { rel: 'apps/cli/src/tools/index.ts', text: EXECUTOR },
      { rel: 'apps/cli/src/tools/hub/adapter.ts', text: null },
    ])
    ok(
      'C4 取不到正文 ⇒ 未判定并点名(不折 0、不折绿)',
      unreadable.state === 'undetermined' &&
        unreadable.undetermined.some((u) => u.rel === 'apps/cli/src/tools/hub/adapter.ts'),
      `state=${unreadable.state} undetermined=${JSON.stringify(unreadable.undetermined)}`,
    )
    const noSites = auditShadowCoverage([
      { rel: 'apps/cli/src/tools/index.ts', text: EXECUTOR.replace(EXEC_SITE_PATTERN, 'runTool(') },
    ])
    ok(
      'C5 影子档有接线但面上 0 个候选站点 ⇒ no-sites(不得读作全覆盖)',
      noSites.state === 'no-sites' && noSites.total === 0,
      `state=${noSites.state} total=${noSites.total}`,
    )
    // ⑯端到端:读数必须真从**被审面**量出来(走 listExecSites + readOnFace,不是构造面)
    const e2e = analyze(
      mk('cov', {
        'apps/cli/src/tools/argument-validator.ts': DEFINITION,
        'apps/cli/src/tools/argument-validation-telemetry.ts': MODES_OK,
        'apps/cli/src/tools/index.ts': EXECUTOR,
        'apps/cli/src/tools/hub/adapter.ts': HUB_ADAPTER,
      }),
      'head',
    )
    ok(
      'C6 经真取材面量出覆盖面(命中 1 / 候选 2)',
      e2e.coverage.state === 'measured' &&
        e2e.coverage.total === 2 &&
        e2e.coverage.coveredCount === 1,
      `state=${e2e.coverage.state} ${e2e.coverage.coveredCount}/${e2e.coverage.total} uncovered=${JSON.stringify(e2e.coverage.uncovered)}`,
    )
  } finally {
    for (const d of dirs) {
      try {
        rmScratch(d)
      } catch {
        /* 夹具清理失败不影响结论 */
      }
    }
  }

  let failed = 0
  for (const r of results) {
    if (!r.pass) failed += 1
    console.log(`${r.pass ? '✅' : '❌'} ${r.name}${r.pass ? '' : ` → ${r.detail}`}`)
  }
  console.log(`--self-test:${results.length - failed}/${results.length} 条断言通过`)
  return failed === 0 ? 0 : 1
}

function main(argv) {
  const flags = new Set(argv)
  if (flags.has('--self-test')) return runSelfTest()
  // G-322:给了 --root 却没收到合法值 ⇒ 点名拒绝;旧写法无值抛 ERR_INVALID_ARG_TYPE 裸栈。
  const rootArg = requireFlagValue(argv, '--root', { noun: '目录参数', fallback: null })
  if (rootArg.error) {
    console.error(`❌ 无法判定:${rootArg.error}`)
    return 2
  }
  const root = rootArg.value !== null ? resolve(rootArg.value) : DEFAULT_ROOT
  const { face, error } = selectFace({
    staged: flags.has('--staged'),
    worktree: flags.has('--worktree'),
  })
  if (error) {
    console.error(`❌ ${error}`)
    return 2
  }
  if (flags.has('--help') || flags.has('-h')) {
    console.log(
      `用法: node scripts/check-tool-arg-validation-wired.mjs [--staged|--worktree|--self-test|--root <dir>]\n判定面: 全量=HEAD blob / --staged=索引 blob / --worktree=磁盘(仅人工)\n紧急跳过(由 guardian-runner 读取): ${SKIP_ENV_NAME}=1\n预期 guardian id: ${GUARDIAN_ID_EXPECTED}`,
    )
    return 0
  }
  try {
    const res = analyze(root, face)
    if (res.scanned === 0) {
      console.error(
        `❌ 无法判定:${face} 面里连校验器定义文件都没枚举到(候选 0 个)⇒ 这是扫描面判空,不是"没有违规";判据失效不得记绿`,
      )
      return 2
    }
    printVerdict(res, root)
    return res.violations.length > 0 ? 1 : 0
  } catch (e) {
    if (e instanceof Undetermined) {
      console.error(`❌ 无法判定:${e.message}`)
      return 2
    }
    console.error(`❌ 脚本自身异常:${e?.stack ?? e}`)
    return 2
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)))
}

export const __test__ = {
  CALL_PATTERN,
  SHADOW_ENTRY_PATTERN,
  EXEC_SITE_PATTERN,
  DEFINITION_FILE,
  MODE_SOURCE_FILE,
  SKIP_ENV_NAME,
  GUARDIAN_ID_EXPECTED,
  maskNoise,
  findCallLines,
  isDeclarationLine,
  enclosingFunctionBody,
  findEarlyReturnLines,
  auditShadowCoverage,
  formatCoverage,
  classifyPath,
  isTestSurface,
  auditModeSource,
  decide,
  analyze,
  listCandidates,
  listExecSites,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
