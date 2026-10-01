#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
// 语言表结构对账(V3 #83,2026-09-27 立)—— 把「表里每项都要能被判据审到」变成机器事实。
//
// 判五类红:
//   T1 结构齐备 —— 每项必须有 language/displayName/fileExtensions/languageIds/candidates;
//      每个候选必须有 binary / args / versionArgs / installHint / capabilities,
//      且 capabilities ⊆ LSP_REQUEST_KINDS(拼一个不存在的请求名 = 预检永不命中 = 该能力隐形)。
//   T2 一个扩展名只能属一门语言 —— 两处都登记 ⇒ `findLspConfigForFile` 只返回先到的那个,
//      而后一个人以为自己在改另一门。
//   T3 fileExtensions 与 languageIds 必须同形(两边集合相等)—— 少一侧的后果分别是
//      "表说支持、握手时 languageId 落空"与"凭空多一个没人能命中的 languageId"。
//   T4 二进制名不得在表外再出现 —— 表是唯一出处。改前 `lsp.ts` 里 `case 'ts': return 'typescript'`
//      那种"第二份语言映射"就是这一型的祖先(它现在还活着的话会被本条点名)。
//   T5 LSP_REQUEST_KINDS 的每一员都要在 `buildClientCapabilities` 里被投影过 ——
//      新增一种请求却忘了写进 initialize,症状是"服务器不做这件事而客户端一直等"。
//
// 三态与遮罩:
//   · 判定面取不到(路径不存在/不是 blob/仓库无提交)⇒ **exit 2「无法判定」**,不冒红也不记绿。
//   · 枚举到 0 项语言 ⇒ 判死(exit 2),空扫不是"通过"(本仓最高频失效型)。
//   · T4 **刻意不用** scripts/lib/code-mask.mjs 的 maskCommentsAndStrings:那个出口连字符串
//     一起抹,而本判据要找的恰好就是字符串字面量 —— 用它等于自盲。这里只按整行注释形态放行
//     (行首 `//` / `*` / `/*`),该边界如实写在这里而不是藏起来。
//
// 取材口径(同 70/77/83/98/101/103/118):全量判 **HEAD blob**、`--staged` 判**索引 blob**、
//   `--worktree` 仅人工逃生舱、两面旗同给判死、取不到 ⇒ exit 2 且不回落另一个面。
//   清单与内容**同面同轮**,内容一律经 scripts/lib/face-reader.mjs 的 catBatch(守门 118 的
//   "半接线"那一型:引了层却自己 `git show` / 读磁盘 = 没有收口)。
//
// ⚠️ 本门**由主会话统一注册进 scripts/guardian-runner.mjs**,实现票不得自我注册(并行改注册表
//    必然互相覆盖注册块,门 93 记过同型事故)。
//
// 用法:
//   node scripts/check-lsp-language-table.mjs                 # 全量(HEAD)
//   node scripts/check-lsp-language-table.mjs --staged        # 索引面(提交链)
//   node scripts/check-lsp-language-table.mjs --worktree      # 人工排查,不作结论
//   node scripts/check-lsp-language-table.mjs --self-test     # 构造面取证(零副作用)
//   node scripts/check-lsp-language-table.mjs --json

import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import {
  Undetermined,
  catBatch,
  gitRaw,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

export const TABLE_REL = 'apps/cli/src/lsp/language-table.ts'
export const CLIENT_REL = 'apps/cli/src/tools/lsp.ts'
/** T4 的扫描面:表外任何一处把某个 servers 的名字再写一遍都算第二份真相。 */
export const SCAN_PREFIXES = ['apps/cli/src/']

export function faceFromArgv(argv) {
  return selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
}
// ==================== 解析(静态、可被构造面喂) ====================

/** 从 openIdx 起做花括号/方括号配平,返回配对结束位置(找不到返回 -1)。 */
function matchBrackets(text, openIdx, open, close) {
  let depth = 0
  for (let i = openIdx; i < text.length; i++) {
    if (text[i] === open) depth += 1
    else if (text[i] === close) {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return -1
}

/** 取出 `export const NAME ... = [ ... ]` 的字面量正文(不含外层方括号)。 */
export function extractArrayLiteral(text, name) {
  const decl = new RegExp(`export const ${name}\\b[^=]*=`)
  const m = decl.exec(text)
  if (!m) return null
  const open = text.indexOf('[', m.index + m[0].length)
  if (open === -1) return null
  const close = matchBrackets(text, open, '[', ']')
  if (close === -1) return null
  return text.slice(open + 1, close)
}

/** 按顶层花括号深度切分对象字面量(嵌套对象/数组不产生切点)。 */
function splitTopLevelObjects(literal) {
  const out = []
  let depth = 0
  let start = -1
  let inString = null
  for (let i = 0; i < literal.length; i++) {
    const c = literal[i]
    if (inString) {
      if (c === '\\') i += 1
      else if (c === inString) inString = null
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      inString = c
      continue
    }
    if (c === '{') {
      if (depth === 0) start = i
      depth += 1
    } else if (c === '}') {
      depth -= 1
      if (depth === 0 && start !== -1) {
        out.push(literal.slice(start, i + 1))
        start = -1
      }
    }
  }
  return out
}

/** 取出某个字符串数组字段的内容(如 fileExtensions / capabilities / args)。
 *  认 `[...CONST_NAME]` 形态并回同文件里那条常量解析 —— 表内 `capabilities: [...TS_CAPABILITIES]`
 *  是刻意 DRY 的写法,解析器不认它就会把"7 项能力"读成"0 项",而 0 项在判据里是红。
 *  解析不到的名字 ⇒ 返回 null(计入"判不了",不得当成"空数组通过")。 */
function stringArrayField(objText, field, constResolver = null) {
  const re = new RegExp(`${field}:\\s*\\[([^\\]]*)\\]`)
  const m = re.exec(objText)
  if (!m) return null
  const inner = m[1]
  const spread = /\.\.\.([A-Za-z_$][\w$]*)/.exec(inner)
  if (spread) return constResolver ? constResolver(spread[1]) : null
  return [...inner.matchAll(/['"]([^'"]*)['"]/g)].map((x) => x[1])
}

/** 在同一文件里按名字找一条字符串常量数组(支持 `as const` 与 readonly 注解)。 */
function resolveConstArray(text, name) {
  const literal = extractArrayLiteral(text, name) ?? inlineArrayLiteral(text, name)
  if (literal === null) return null
  const items = [...literal.matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1])
  return items.length > 0 ? items : null
}

/** `const NAME = ['a','b']`(非 export)形态。 */
function inlineArrayLiteral(text, name) {
  const re = new RegExp(`\\bconst ${name}\\b[^=]*=`)
  const m = re.exec(text)
  if (!m) return null
  const open = text.indexOf('[', m.index + m[0].length)
  if (open === -1) return null
  const close = matchBrackets(text, open, '[', ']')
  return close === -1 ? null : text.slice(open + 1, close)
}

/** 取出对象里 `key: 'value'` 形态的字符串字段。 */
function stringField(objText, field) {
  const re = new RegExp(`${field}:\\s*['"]([^'"]*)['"]`)
  const m = re.exec(objText)
  return m ? m[1] : null
}

/** 解析 `languageIds: { '.ts': 'typescript', '.tsx': 'typescriptreact' }` 的键集。
 *  键取自"引号 + 紧跟冒号"这一形态,因此单行与多行两种书写都必须认 —— 只认行首的那个写法
 *  会把单行书写读成"只有 1 个键",后果是 T3 对着一张好表判红(本门第一版就栽在这里)。 */
function objectKeys(objText, field) {
  const at = objText.indexOf(`${field}:`)
  if (at === -1) return null
  const open = objText.indexOf('{', at)
  if (open === -1) return null
  const close = matchBrackets(objText, open, '{', '}')
  if (close === -1) return null
  const body = objText.slice(open + 1, close)
  return [...body.matchAll(/['"]([^'"]+)['"]\s*:/g)].map((m) => m[1])
}

/**
 * 把语言表源码解析成结构化项。解析不出 ⇒ 返回 errors 并让调用方判"无法判定",
 * 绝不返回一个空数组冒充"表里没有语言"。
 */
export function parseLanguageTable(text) {
  const errors = []
  const kinds = stringArrayFieldInConst(text, 'LSP_REQUEST_KINDS')
  if (!kinds || kinds.length === 0) {
    errors.push('LSP_REQUEST_KINDS 解析不到成员(判据失明,不是"没有请求种类")')
  }
  const literal = extractArrayLiteral(text, 'LSP_SERVERS')
  if (literal === null) {
    errors.push('找不到 `export const LSP_SERVERS = [...]` 锚点(表文件结构变了?')
    return { entries: [], kinds: kinds ?? [], errors }
  }
  const entries = []
  for (const obj of splitTopLevelObjects(literal)) {
    const language = stringField(obj, 'language')
    const displayName = stringField(obj, 'displayName')
    const fileExtensions = stringArrayField(obj, 'fileExtensions')
    const languageIds = objectKeys(obj, 'languageIds')
    const candidatesAt = obj.indexOf('candidates:')
    const candidatesOpen = candidatesAt === -1 ? -1 : obj.indexOf('[', candidatesAt)
    const candidatesClose = candidatesOpen === -1 ? -1 : matchBrackets(obj, candidatesOpen, '[', ']')
    const candidateTexts =
      candidatesOpen === -1 || candidatesClose === -1 ? [] : splitTopLevelObjects(obj.slice(candidatesOpen, candidatesClose + 1))
    const candidates = candidateTexts.map((c) => {
      const resolve = (name) => resolveConstArray(text, name)
      const capPresent = /\bcapabilities:/.test(c)
      const capResolved = stringArrayField(c, 'capabilities', resolve)
      return {
        binary: stringField(c, 'binary'),
        args: stringArrayField(c, 'args'),
        versionArgs: stringArrayField(c, 'versionArgs'),
        installHint: stringField(c, 'installHint'),
        // null = 字段写了但值解析不出(spread 指向一个读不到的常量)⇒ 判不了,不是"空能力表"
        capabilities: capPresent ? capResolved : undefined,
        capabilitiesResolved: !capPresent || capResolved !== null,
        hasMinVersion: /\bminVersion:/.test(c),
      }
    })
    entries.push({
      language,
      displayName,
      fileExtensions,
      languageIds,
      candidates,
      declaresWorkspaceMarkers: /\bworkspaceMarkers:/.test(obj),
      raw: obj,
    })
    if (!language || !displayName || !fileExtensions || !languageIds || candidates.length === 0) {
      errors.push(`某一项结构不完整(language=${language ?? '(缺)'})`)
    }
  }
  return { entries, kinds: kinds ?? [], errors }
}

/** `export const NAME = [...] as const` 这种字符串常量数组的取成员(与 extractArrayLiteral 同源)。 */
function stringArrayFieldInConst(text, name) {
  const literal = extractArrayLiteral(text, name)
  if (literal === null) return null
  return [...literal.matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1])
}

// ==================== 判据 ====================

export function judgeTable({ tableText, clientText, otherFiles }) {
  const red = []
  /** 未判定:印出来、进计数,但不改退出码(把"看不见"洗成"确信没有"是本仓最贵的失效方式)。 */
  const amber = []
  const parsed = parseLanguageTable(tableText)
  if (parsed.entries.length === 0) {
    return { red, amber, fatal: `语言表枚举到 0 项:${parsed.errors.join(' / ') || '锚点在但数组为空'}`, counts: {} }
  }
  const kinds = new Set(parsed.kinds)
  if (kinds.size === 0) {
    return { red, amber, fatal: 'LSP_REQUEST_KINDS 为空 ⇒ 能力预检与 initialize 投影都无判据可对', counts: {} }
  }

  // T1 —— 候选结构齐备
  let _capUndetermined = 0
  for (const entry of parsed.entries) {
    for (const c of entry.candidates) {
      const where = `${entry.language}/${c.binary ?? '(无 binary)'}`
      if (!c.binary) red.push(`T1 ${entry.language}: 有候选没写 binary`)
      if (!c.installHint) red.push(`T1 ${where}: 没写 installHint —— 诊断文本里没有出路等于让人心算`)
      if (!c.args) red.push(`T1 ${where}: 没写 args(启动参数不得靠"空数组默认"混过去)`)
      if (!c.versionArgs) red.push(`T1 ${where}: 没声明 versionArgs(允许为空数组,但必须显式声明)`)
      if (c.capabilities === null) {
        // 字段写了但值读不出来(spread 指向解析不到的常量)⇒ **判不了**。
        // 算成"空能力表"会给一张好表发红牌;算成"通过"则是把没判写成判过了。
        // 所以走 amber:印出来、计数,但不改退出码(与守门 127/103 的未判定同一取向)。
        _capUndetermined += 1
        amber.push(`${where}: capabilities 的值解析不出 ⇒ 本门对这一项没有结论`)
        continue
      }
      if (c.capabilities.length === 0) {
        red.push(`T1 ${where}: capabilities 为空 ⇒ 该候选的所有请求都会被预检拒掉`)
        continue
      }
      for (const cap of c.capabilities) {
        if (!kinds.has(cap)) red.push(`T1 ${where}: capabilities 里的 '${cap}' 不在 LSP_REQUEST_KINDS(拼错即隐形)`)
      }
    }
    // T2 —— 扩展名唯一归属(跨语言)
  }
  const owner = new Map()
  for (const entry of parsed.entries) {
    for (const ext of entry.fileExtensions ?? []) {
      if (owner.has(ext)) red.push(`T2 扩展名 ${ext} 同时属 ${owner.get(ext)} 与 ${entry.language}`)
      else owner.set(ext, entry.language)
    }
    // T3 —— fileExtensions ↔ languageIds 同形
    const ids = new Set(entry.languageIds ?? [])
    for (const ext of entry.fileExtensions ?? []) {
      if (!ids.has(ext)) red.push(`T3 ${entry.language}: fileExtensions 有 ${ext} 而 languageIds 没有该键`)
    }
    for (const key of entry.languageIds ?? []) {
      if (!(entry.fileExtensions ?? []).includes(key)) {
        red.push(`T3 ${entry.language}: languageIds 有 ${key} 而 fileExtensions 没有(永不命中的第二份清单)`)
      }
    }
  }

  // T4 —— 二进制名不得在表外再出现
  const binaries = new Set()
  for (const entry of parsed.entries) {
    for (const c of entry.candidates) if (c.binary) binaries.add(c.binary)
  }
  if (binaries.size === 0) {
    return { red, amber, fatal: '表里一个 binary 都没解析到 ⇒ T4 无法执行(不是"通过")', counts: {} }
  }
  for (const [rel, text] of Object.entries(otherFiles ?? {})) {
    if (rel === TABLE_REL) continue
    const lines = text.split(/\r?\n/)
    for (const bin of binaries) {
      // **整词匹配,不是子串**:第一版按 `line.includes(bin)` 判,于是
      // `command-policy/syntax-table.ts` 里 awk 的 `opt('copyright')` 被读成"又写了一遍 pyright"
      // —— 同词不同义型假阳(守门 digest-name 的 hashtags≠has+tags 是同一条教训)。
      const re = new RegExp(`(?<![\\w-])${bin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`)
      const hits = []
      lines.forEach((line, i) => {
        if (!re.test(line)) return
        const trimmed = line.trim()
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return
        hits.push(`${rel}:${i + 1}`)
      })
      for (const hit of hits) {
        red.push(`T4 ${hit}: 表外又写了一遍 '${bin}' —— 服务器名的唯一出处是 ${TABLE_REL}`)
      }
    }
  }

  // T5 —— 每种请求种类都要被 initialize 能力投影覆盖
  if (!clientText) {
    return { red, amber, fatal: `取不到 ${CLIENT_REL} ⇒ T5 无法执行`, counts: {} }
  }
  if (!/function buildClientCapabilities\b/.test(clientText)) {
    red.push(`T5 ${CLIENT_REL} 里找不到 buildClientCapabilities —— 能力投影这一格无人看守`)
  } else {
    for (const kind of kinds) {
      const projected = new RegExp(`has\\(['"]${kind}['"]\\)`).test(clientText)
      const usedAsRequest = new RegExp(`requireCapability\\(['"]${kind}['"]\\)`).test(clientText)
      if (!projected && !usedAsRequest) {
        red.push(`T5 请求种类 '${kind}' 既没被 buildClientCapabilities 投影、也没被 requireCapability 预检 —— 表里写了却无人消费`)
      }
    }
  }

  const counts = {
    entries: parsed.entries.length,
    candidates: parsed.entries.reduce((n, e) => n + (e.candidates?.length ?? 0), 0),
    kinds: kinds.size,
    extensions: owner.size,
    scannedFiles: Object.keys(otherFiles ?? {}).length,
    undetermined: amber.length,
  }
  return { red, amber, fatal: null, counts }
}

// ==================== 取材 ====================

/** 同一面下列出待扫源文件(排除测试与 .d.ts)。 */
function listSourceFiles(repoRoot, face) {
  const args =
    face === 'staged'
      ? ['ls-files', '--cached', '--', ...SCAN_PREFIXES]
      : ['ls-tree', '-r', '--name-only', 'HEAD', '--', ...SCAN_PREFIXES]
  const out = gitRaw(args, repoRoot, { timeout: 120_000 })
  if (!out) return []
  return out
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /\.ts$/.test(l) && !l.endsWith('.d.ts') && !/\.test\.ts$/.test(l))
}

export function readFaceInputs(repoRoot, face) {
  const wanted = new Set([TABLE_REL, CLIENT_REL])
  const listed = listSourceFiles(repoRoot, face)
  if (listed.length === 0) throw new Undetermined(`${face} 面在 ${SCAN_PREFIXES.join(',')} 下列出 0 个源文件 ⇒ 无法判定`)
  for (const rel of listed) wanted.add(rel)
  const rels = [...wanted]
  if (face === 'worktree') {
    const files = {}
    for (const rel of rels) {
      const t = readWorktreeFile(repoRoot, rel)
      if (t === null || t === undefined) throw new Undetermined(`工作树(逃生舱)取不到 ${rel}`)
      files[rel] = t
    }
    return files
  }
  const prefix = face === 'staged' ? ':' : 'HEAD:'
  const specs = rels.map((rel) => prefix + rel)
  const got = catBatch(repoRoot, specs, { maxBuffer: 1 << 28 })
  const files = {}
  for (let i = 0; i < rels.length; i++) {
    const t = got.get(specs[i])
    // 表与客户端这两个"必需输入"取不到 ⇒ 判死;其余源文件取不到按缺失跳过(它们可能刚被删)
    if (t === null || t === undefined) {
      if (rels[i] === TABLE_REL || rels[i] === CLIENT_REL) {
        throw new Undetermined(`${face === 'staged' ? '索引' : 'HEAD'} 取不到 ${rels[i]}`)
      }
      continue
    }
    files[rels[i]] = t
  }
  return files
}

// ==================== 取证(构造面,零副作用) ====================

export function selfTest() {
  const lines = []
  const ok = (n, cond) => lines.push(`${cond ? '✅' : '❌'} ${n}`)

  const GOOD = `
export const LSP_REQUEST_KINDS = ['definition', 'hover'] as const
export const LSP_SERVERS: LspServerConfig[] = [
  {
    language: 'typescript',
    displayName: 'TypeScript',
    fileExtensions: ['.ts'],
    languageIds: { '.ts': 'typescript' },
    candidates: [
      { binary: 'typescript-language-server', args: ['--stdio'], versionArgs: ['--version'], installHint: 'pnpm add -g it', capabilities: ['definition', 'hover'] },
    ],
  },
]
`
  const CLIENT = `function buildClientCapabilities(kinds) { const has = (k) => kinds.includes(k); if (has('definition')) {} if (has('hover')) {} }`

  const parsed = parseLanguageTable(GOOD)
  ok('1 好表能解析出 1 项', parsed.entries.length === 1)
  ok('2 好表解析无 errors', parsed.errors.length === 0)
  const good = judgeTable({ tableText: GOOD, clientText: CLIENT, otherFiles: { [TABLE_REL]: GOOD, 'apps/cli/src/a.ts': 'export const x = 1' } })
  ok('3 好表 + 完整投影 ⇒ 零红', good.red.length === 0 && good.fatal === null, )

  // T1:缺 installHint
  const noHint = GOOD.replace("installHint: 'pnpm add -g it', ", '')
  ok('4 T1 缺 installHint 必红', judgeTable({ tableText: noHint, clientText: CLIENT, otherFiles: {} }).red.some((r) => r.startsWith('T1')))
  // T2:同一扩展名两门语言
  const dupExt = GOOD.replace(
    "    candidates: [\n      { binary: 'typescript-language-server', args: ['--stdio'], versionArgs: ['--version'], installHint: 'pnpm add -g it', capabilities: ['definition', 'hover'] },\n    ],\n  },\n]",
    "    candidates: [\n      { binary: 'other-server', args: [], versionArgs: [], installHint: 'x', capabilities: ['hover'] },\n    ],\n  },\n  {\n    language: 'tsx',\n    displayName: 'TSX',\n    fileExtensions: ['.ts'],\n    languageIds: { '.ts': 'tsx' },\n    candidates: [\n      { binary: 'third-server', args: [], versionArgs: [], installHint: 'x', capabilities: ['hover'] },\n    ],\n  },\n]",
  )
  const dup = judgeTable({ tableText: dupExt, clientText: CLIENT, otherFiles: {} })
  ok('5 T2 扩展名两属必红', dup.red.some((r) => r.startsWith('T2')))
  // T3:languageIds 少一侧
  const badIds = GOOD.replace("languageIds: { '.ts': 'typescript' },", "languageIds: { '.dts': 'typescript' },")
  const t3 = judgeTable({ tableText: badIds, clientText: CLIENT, otherFiles: {} })
  ok('6 T3 两个清单不同形必双向点名', t3.red.some((r) => r.startsWith('T3') && r.includes('fileExtensions 有')) && t3.red.some((r) => r.startsWith('T3') && r.includes('languageIds 有')))
  // T4:表外又写一遍服务器名
  const t4 = judgeTable({ tableText: GOOD, clientText: CLIENT + "\nconst bin = 'typescript-language-server'", otherFiles: { 'apps/cli/src/tools/lsp.ts': CLIENT + "\nconst bin = 'typescript-language-server'" } })
  ok('7 T4 表外字面量必红', t4.red.some((r) => r.startsWith('T4')))
  // T4 反向对照:注释里提到服务器名不算第二份真相
  const commentOnly = CLIENT + "\n// 这里解释为什么不用 typescript-language-server 的名字\nconst y = 2"
  ok('8 T4 注释形态不得判红(门不得判自己的散文)', !judgeTable({ tableText: GOOD, clientText: commentOnly, otherFiles: { 'apps/cli/src/tools/lsp.ts': commentOnly } }).red.some((r) => r.startsWith('T4')))
  // T5:新增种类忘了投影
  const kindMissing = GOOD.replace("export const LSP_REQUEST_KINDS = ['definition', 'hover'] as const", "export const LSP_REQUEST_KINDS = ['definition', 'hover', 'rename'] as const")
  ok('9 T5 未投影的种类必红', judgeTable({ tableText: kindMissing, clientText: CLIENT, otherFiles: {} }).red.some((r) => r.startsWith('T5')))
  // T1:capabilities 拼错一个种类
  const typoCap = GOOD.replace("capabilities: ['definition', 'hover'] }", "capabilities: ['definition', 'hoverr'] }")
  ok('10 T1 拼不认识的 capability 必红', judgeTable({ tableText: typoCap, clientText: CLIENT, otherFiles: {} }).red.some((r) => r.includes("不在 LSP_REQUEST_KINDS")))
  // 判死:空表 / 无锚点
  ok('11 空枚举判死而非记绿', judgeTable({ tableText: 'export const LSP_SERVERS = []', clientText: CLIENT, otherFiles: {} }).fatal !== null)
  ok('12 锚点丢失判死', judgeTable({ tableText: 'const unrelated = 1', clientText: CLIENT, otherFiles: {} }).fatal !== null)
  // 面判据:两面旗同给 ⇒ selectFace 报 error(main 折成 exit 2,既不冒红也不记绿)
  ok('13 两个面旗同给必须判死', faceFromArgv(['--staged', '--worktree']).error !== null)
  // 默认档必须是 HEAD(不是磁盘)—— 磁盘档只作人工逃生舱
  ok(
    '14 默认档必须是 HEAD、--staged 必须是索引',
    faceFromArgv([]).face === 'head' && faceFromArgv(['--staged']).face === 'staged',
  )

  const failed = lines.filter((l) => l.startsWith('❌'))
  for (const l of lines) console.log(l)
  console.log(`--self-test: ${lines.length - failed.length}/${lines.length} 通过`)
  return failed.length === 0 ? 0 : 1
}

// ==================== CLI ====================

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--self-test')) process.exit(selfTest())
  const sel = faceFromArgv(args)
  if (sel.error) {
    console.error(`❌ 无法判定:${sel.error}`)
    process.exit(2)
  }
  const face = sel.face
  let files
  try {
    files = readFaceInputs(ROOT, face)
  } catch (e) {
    if (e instanceof Undetermined) {
      console.error(`⚠️ 无法判定:${e.message}`)
      process.exit(2)
    }
    throw e
  }
  const tableText = files[TABLE_REL]
  if (!tableText) {
    console.error(`⚠️ 无法判定:${TABLE_REL} 在该面上不存在`)
    process.exit(2)
  }
  const otherFiles = {}
  for (const [rel, text] of Object.entries(files)) if (rel !== TABLE_REL) otherFiles[rel] = text
  const { red, amber, fatal, counts } = judgeTable({
    tableText,
    clientText: files[CLIENT_REL] ?? '',
    otherFiles,
  })
  const faceTxt = { head: 'HEAD blob(全量审计)', staged: '索引 blob(本次提交会带走的那一份)', worktree: '工作树(人工逃生舱,提交链不走这档)' }[face]
  if (fatal) {
    console.error(`❌ 无法判定(判据失明不是通过):${fatal}`)
    process.exit(2)
  }
  if (args.includes('--json')) {
    process.stdout.write(`${JSON.stringify({ face, counts, red, amber }, null, 2)}\n`)
  } else {
    console.log(`语言表结构对账 · 判定面:${faceTxt}`)
    console.log(
      `  项 ${counts.entries} · 候选 ${counts.candidates} · 请求种类 ${counts.kinds} · 扩展名 ${counts.extensions} · 扫表外文件 ${counts.scannedFiles} 个 · 未判定 ${counts.undetermined} 项`,
    )
    if (red.length === 0) console.log('✅ T1–T5 全通过')
    else {
      console.log(`❌ ${red.length} 处结构违规:`)
      for (const r of red) console.log(`  - ${r}`)
    }
    if (amber.length > 0) {
      console.log(`⚠️ 未判定 ${amber.length} 项(不改退出码,但不得读成"已核"):`)
      for (const a of amber) console.log(`  - ${a}`)
    }
  }
  process.exit(red.length > 0 ? 1 : 0)
}

export const __test__ = { parseLanguageTable, judgeTable, extractArrayLiteral, splitTopLevelObjects, faceFromArgv }

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
