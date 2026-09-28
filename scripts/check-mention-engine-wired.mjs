// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

// 守门「多维提及引擎接线与单一源对账」(PROJECT_PLAN V3 第 61 票的常驻尺子,2026-09-27 立)
//
// 拦两类事,它们互相遮蔽,所以要同时判:
//   W1 **造好没装车** —— `@` 多维提及的三个件(useSearchMentions / addMention / MentionChips)
//      在 61 票落地时的真实状态是:组件与 hook 都写好了、渲染点也挂着,但**全仓没有生产调用方**,
//      于是 MentionChips 读的那份 mentions 恒是空数组、它的「无提及即 null」早退恒成立。
//      typecheck / lint / 单测全都不会红(它自带的用例是绿的,恰恰证明"没人调用"与"能跑"互不矛盾)。
//      同型先例:守门 64(适配器接线)/ 70(硬编码中文)/ 81(邮件通道)/ 115(入参校验器)。
//   W2/W3 **两套引擎各写一遍** —— 维度清单与触发符解析原先在 message-input.tsx(`@` 侧裸正则)
//      和 use-context-selector.ts(九类目表 + 一份 `#` 正则)各有一份。归一之后必须有人守着
//      "不许再出现第二份",否则一次顺手改动就把它拆回两套,而账面仍然全绿。
//
// 定级(与 §12e 那条最高频反面教训对齐):
//   W1 零容忍、**不吃基线** —— "没有生产调用方"就是本门立项那一型,与"本次改了什么"无关;
//      摘掉一个调用点正是把已交付的功能关掉,不该因为提交者"只是清理了一行"而放过。
//   W2/W3 走**该文件 HEAD 自身存量的棘轮** —— 只拦"这次改动把第二份表/第二处解析加回来了"。
//      仓里天然有同形状的正则(hex 色值、PG 连接串),它们各自计入自己文件的 HEAD 额度;
//      与本次改动无关的恒红门只会逼人 --no-verify,连带废掉全部守门。
//
// 取材口径(同 70/77/83/98/101/103/115):全量判 **HEAD blob**、`--staged` 判**索引 blob**、
//   `--worktree` 只作人工逃生舱;两旗同给判死;取不到 ⇒ **exit 2 无法判定**;
//   **枚举到 0 个候选判死**(扫描面判空 = 判据失效,绝不表现为 exit 0 的绿)。
//   清单与内容同面同轮:先 git grep 出候选,再用 face-reader 的 `catBatch` 一次性读满。
//
// 用法:
//   node scripts/check-mention-engine-wired.mjs              # 全量(HEAD 面)
//   node scripts/check-mention-engine-wired.mjs --staged     # 索引面
//   node scripts/check-mention-engine-wired.mjs --worktree   # 磁盘(人工排查)
//   node scripts/check-mention-engine-wired.mjs --self-test  # 临时独立仓正反成对自检
//   node scripts/check-mention-engine-wired.mjs --json       # 机器可读结论
//   --root <dir>  显式仓库根(测试通道;生产不带)
// 退出码:0 通过 / 1 判据违规 / 2 无法判定或脚本自身异常
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { catBatch, gitRaw, readWorktreeFile, selectFace, Undetermined } from './lib/face-reader.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GIT_TIMEOUT = 120_000

export const SKIP_ENV_NAME = 'HUSKY_SKIP_MENTION_ENGINE_WIRED'

/** 提及引擎的唯一取材点(维度表 + 触发解析 + 选择模型都住这里) */
export const ENGINE_FILE = 'packages/shared/src/chat/mention-engine.ts'
/** 三个必须"装车"的件:定义文件本身不算调用方 */
export const WIRED_SYMBOLS = [
  {
    name: 'addMention',
    needle: 'addMention(',
    definitionFiles: ['apps/web/src/stores/context-mention.ts'],
    /** 定义处的声明行(`addMention: (mention) => …`)不算调用方 */
    declRe: /^\s*addMention:\s*\(/,
    why: '@/# 提及没有任何生产者 ⇒ MentionChips 读的那份状态恒空 ⇒ 票面"恒 null"复发',
  },
  {
    name: 'useSearchMentions',
    needle: 'useSearchMentions(',
    definitionFiles: ['apps/web/src/hooks/use-context-mention.ts'],
    declRe: /^\s*export function useSearchMentions\b/,
    why: '多维检索 hook 无人调用 ⇒ `@` 只剩文件一维,票面要的 file/folder/symbol 三维不成立',
  },
  {
    name: 'MentionChips',
    needle: '<MentionChips',
    definitionFiles: ['apps/web/src/components/chat/mention-popover.tsx'],
    declRe: /^\s*export function MentionChips\b/,
    why: 'chip 面没有渲染点 ⇒ 即使有提及也看不见(与 W1 前两条互补,防"只写状态不挂面")',
  },
]

/** 维度表的行指纹:一行 = 一个维度。第二张表 = 第二个真相源。 */
export const DIMENSION_ROW_FINGERPRINT = 'candidateSource:'
/** 触发解析的正则指纹:sigil 紧跟捕获组 + 字符类(`#([` / `@([`) */
export const TRIGGER_REGEX_FINGERPRINT = /[#@]\(\[/
/** 同一条字面量里还必须出现结尾锚 —— 排除邮箱/hex/URL 那类同形状正则(实测收窄 9→4 处) */
export const TRIGGER_END_ANCHOR = '$/'

/** 本门与它的镜像测试必然逐字含有上述指纹,不参与对账。 */
const SELF_EXEMPT_BASENAMES = ['check-mention-engine-wired.mjs']

// ==================== 判据纯函数 ====================

/**
 * 把注释与字符串字面量抹成空格(逐字符状态机,保留行结构与行号)。
 *
 * 为什么必须抹:本仓最高频的失效型就是"把解释自己的散文当成被审的形态"(守门 70/131 各踩过一次)。
 * 本门自己的头注里就写着 `addMention(` 与 `#([` 这类串,不抹就会在**自己的定义文件**上判红。
 */
export function maskNoise(text) {
  const out = []
  let state = 'code'
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
      // 裸引号串里出现换行 = 词法已不可信 ⇒ 退回 code。宁可随后把这一行当代码交人工看,
      // 也不允许"抹多了"把红洗成绿。
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

export function isTestSurface(rel) {
  return (
    /(^|\/)tests?\//.test(rel) ||
    rel.includes('__tests__/') ||
    /(^|\/)e2e\//.test(rel) ||
    /\.(test|spec)\.[cm]?[jt]sx?$/i.test(rel)
  )
}

/** 含 needle 的非声明行(掩噪后)。多行 JSX 属性形态下 `<MentionChips` 与标签同行即可。 */
export function findCallLines(text, needle, declRe) {
  const masked = maskNoise(text)
  const hits = []
  const lines = masked.split(/\r?\n/)
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n]
    if (!line.includes(needle)) continue
    if (declRe && declRe.test(line)) continue
    hits.push({ line: n + 1, text: line.trim().slice(0, 140) })
  }
  return hits
}

/** 掩噪后含"触发正则指纹 + 结尾锚"的行(W3 的命中面) */
export function findTriggerRegexLines(text) {
  const masked = maskNoise(text)
  const hits = []
  const lines = masked.split(/\r?\n/)
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n]
    if (!TRIGGER_REGEX_FINGERPRINT.test(line)) continue
    // 结尾锚必须在指纹之后 —— 否则 `$/` 属于同一行另一条不相干的正则
    const at = line.search(TRIGGER_REGEX_FINGERPRINT)
    if (!line.slice(at).includes(TRIGGER_END_ANCHOR)) continue
    // **刻意排除行首锚定的 `^#(` 与 `^@(`**:那是 markdown 标题 / hex 色值一类的形状巧合
    // (`/^#([0-9a-f]{3}|[0-9a-f]{6})$/`),而提及触发段的定义特征是 sigil 出现在
    // 行中(前面可以是 `^`/空白,但 sigil 本身不紧跟 `^`)。假阳比漏报更贵 ——
    // 它指使人去"修"没坏的东西。实测这一条把 HEAD 上的形状巧合从 9 处收到 4 处。
    if (line[at - 1] === '^') continue
    hits.push({ line: n + 1, text: line.trim().slice(0, 140) })
  }
  return hits
}

/** 掩噪后的维度行数(W2 的命中面) */
export function countDimensionRows(text) {
  const masked = maskNoise(text)
  let n = 0
  for (const line of masked.split(/\r?\n/)) {
    if (line.includes(DIMENSION_ROW_FINGERPRINT)) n += 1
  }
  return n
}

/**
 * 汇总判据(纯函数,取材在它外面)—— self-test 与镜像测试都直接构造它的输入。
 * @param files  [{rel, text}] 本门关心的那批文件(候选 ∪ 引擎 ∪ 各定义文件)
 * @param anchorCounts { rel: {rows:number, trig:number} } 各文件在**锚点面**的存量(棘轮基准,见 analyze)
 * @param anchorUnavailable 锚点面整体取不到 ⇒ W2/W3 记"未判定"而非通过(必须打印,不静默)
 */
export function decide(files, anchorCounts = {}, anchorUnavailable = false) {
  const violations = []
  const counts = { prod: 0, test: 0, definition: 0, self: 0 }
  const wired = {}
  for (const sym of WIRED_SYMBOLS) wired[sym.name] = { prod: 0, test: 0, callers: [] }

  const engineRowsInFile = []
  const trigInFile = []

  for (const f of files) {
    const base = f.rel.split('/').pop() ?? f.rel
    const isSelf = SELF_EXEMPT_BASENAMES.includes(base)
    const isTest = isTestSurface(f.rel)
    const text = f.text ?? ''
    if (isSelf) counts.self += 1
    if (isTest) counts.test += 1
    else if (!isSelf) counts.prod += 1

    for (const sym of WIRED_SYMBOLS) {
      if (!text.includes(sym.needle)) continue
      if (sym.definitionFiles.includes(f.rel)) continue
      if (isSelf) continue
      const hits = findCallLines(text, sym.needle, sym.declRe)
      if (hits.length === 0) continue
      if (isTest) {
        wired[sym.name].test += 1
        continue
      }
      wired[sym.name].prod += 1
      wired[sym.name].callers.push(`${f.rel}:${hits[0].line}`)
    }

    // W2:维度表指纹(引擎自己是唯一允许点)
    const rows = countDimensionRows(text)
    if (f.rel !== ENGINE_FILE && rows >= 2 && !isSelf) engineRowsInFile.push({ rel: f.rel, rows })
    if (f.rel !== ENGINE_FILE && rows === 1 && !isSelf) {
      engineRowsInFile.push({ rel: f.rel, rows, lone: true })
    }

    // W3:触发解析指纹(引擎自己是唯一允许点)
    if (f.rel === ENGINE_FILE) {
      trigInFile.push({ rel: f.rel, hits: findTriggerRegexLines(text) })
    } else if (!isSelf) {
      const hits = findTriggerRegexLines(text)
      if (hits.length > 0) trigInFile.push({ rel: f.rel, hits })
    }
  }

  // ── W1:零容忍,不看存量基线(摘掉调用点就是把已交付的功能关掉) ──
  for (const sym of WIRED_SYMBOLS) {
    const w = wired[sym.name]
    if (w.prod === 0) {
      violations.push(
        `W1 \`${sym.name}\` 无生产调用方:全仓 0 处非测试引用(测试面 ${w.test} 处不计装车)` +
          ` ⇒ ${sym.why}`,
      )
    }
  }

  // ── W2:维度清单单一源(≥2 行才算一张表;1 行只报数) ──
  if (!anchorUnavailable) {
    for (const e of engineRowsInFile) {
      if (e.lone) continue
      const allowed = anchorCounts[e.rel]?.rows ?? 0
      if (e.rows > allowed) {
        violations.push(
          `W2 第二份维度清单:${e.rel} 含 ${e.rows} 行 "${DIMENSION_ROW_FINGERPRINT}"` +
            `(该文件锚点面存量 ${allowed})⇒ 维度必须只在 ${ENGINE_FILE} 的一张表里声明`,
        )
      }
    }
  }
  const loneRows = engineRowsInFile.filter((e) => e.lone).map((e) => e.rel)

  // ── W3:触发解析单一源 ──
  const engineTrigs = trigInFile.find((t) => t.rel === ENGINE_FILE)
  if (!engineTrigs || engineTrigs.hits.length === 0) {
    violations.push(
      `W3 引擎里读不到触发正则(${TRIGGER_REGEX_FINGERPRINT.source} + 结尾锚)` +
        ` ⇒ 唯一取材点不见了,判据对它立项那一型重新失明(不记绿)`,
    )
  }
  for (const t of trigInFile) {
    if (t.rel === ENGINE_FILE) continue
    if (anchorUnavailable) continue
    const allowed = anchorCounts[t.rel]?.trig ?? 0
    if (t.hits.length > allowed) {
      violations.push(
        `W3 第二处触发解析:${t.rel} 第 ${t.hits.map((h) => h.line).join(',')} 行含 sigil 触发正则` +
          `(该文件锚点面存量 ${allowed})⇒ 一律改走 ${ENGINE_FILE} 的 parseMentionTrigger()`,
      )
    }
  }

  return {
    violations,
    counts,
    wired,
    notice: {
      // 只报数、不判红的两类:它们要么是形状巧合(hex 色值 / PG 连接串),要么是一张表只掉了一行
      loneDimensionRows: loneRows,
      secondEngineFiles: engineRowsInFile.filter((e) => !e.lone).map((e) => e.rel),
      triggerRegexFiles: trigInFile.filter((t) => t.rel !== ENGINE_FILE).map((t) => t.rel),
      // 锚点面取不到时 W2/W3 是"未判定",不是"通过"—— 必须打印出来,否则判据失明与全绿同形
      anchorUnavailable: anchorUnavailable ? true : false,
    },
  }
}

// ==================== 取材 ====================

/** 需要读的文件:候选(任一 needle / 任一指纹命中)∪ 引擎 ∪ 各定义文件 */
export function listCandidates(root, face) {
  const needles = [
    ...WIRED_SYMBOLS.map((s) => s.needle),
    DIMENSION_ROW_FINGERPRINT,
    '#([',
    '@([',
  ]
  const found = new Set()
  for (const needle of needles) {
    const args =
      face === 'head'
        ? ['grep', '-I', '-F', '-l', needle, 'HEAD', '--']
        : face === 'staged'
          ? ['grep', '-I', '-F', '-l', '--cached', needle]
          : ['grep', '-I', '-F', '-l', needle]
    let out
    try {
      out = gitRaw(args, root, { timeout: GIT_TIMEOUT })
    } catch (e) {
      // `git grep` 无命中回 exit 1 —— 那是 **git 说"没有"**,与"git 没跑成"必须分开:
      // 前者跳过这一支 needle,后者由 Undetermined 冒到 main 判"无法判定"。
      if (e instanceof Undetermined && e.status === 1) continue
      throw e
    }
    for (const line of out.split(/\r?\n/)) {
      const rel = line.replace(/^HEAD:/, '').trim()
      if (rel) found.add(rel)
    }
  }
  // 这些是"按名字点名要读"的(定义面,可以不存在),与 grep 出来的"该面按定义存在"不同 ——
  // 混成一类会让"引擎被删"表现为"取不到内容 ⇒ 无法判定",而不是"W3 唯一取材点不见了 ⇒ 红"。
  const byNameOnly = new Set([ENGINE_FILE])
  for (const sym of WIRED_SYMBOLS) for (const d of sym.definitionFiles) byNameOnly.add(d)
  return { rels: [...new Set([...found, ...byNameOnly])].sort(), byNameOnly: [...byNameOnly], grepped: found.size }
}

/** 按 `<rev>:<path>` 批量读一整面(rev='' 即索引面);单条读不到 ⇒ 该键值为 null,不抛 */
function readRevBatch(root, rev, rels) {
  const spec = (rel) => `${rev}:${rel}`
  const bySpec = catBatch(root, rels.map(spec), { maxBuffer: 1 << 29, timeout: GIT_TIMEOUT })
  const byRel = new Map()
  for (const rel of rels) byRel.set(rel, bySpec.get(spec(rel)) ?? null)
  return byRel
}

function readFace(root, face, rels) {
  if (face === 'worktree') {
    return new Map(rels.map((rel) => [rel, readWorktreeFile(root, rel)]))
  }
  return readRevBatch(root, face === 'head' ? 'HEAD' : '', rels)
}

/** 完整一轮:枚举 + 同面一次 catBatch 读满 + 判据(返回结构化结论,不改退出码) */
export function analyze(root, face) {
  const { rels, byNameOnly, grepped } = listCandidates(root, face)
  const got = readFace(root, face, rels)
  const files = rels.map((rel) => {
    const text = got.get(rel)
    if (text === null && !byNameOnly.includes(rel) && !isTestSurface(rel)) {
      // grep 到的候选按定义在该面存在 ⇒ 读不到只有可能是仓在动。不许猜、不许记绿。
      throw new Undetermined(`${rel} 在 ${face} 面 grep 到了却取不到内容`)
    }
    return { rel, text: text ?? '' }
  })
  if (grepped === 0) {
    throw new Undetermined(`${face} 面 grep 到 0 个候选(只剩按名字点名的定义面)⇒ 扫描面判空,不记绿`)
  }
  if (face === 'worktree' && files.every((f) => f.text === '')) {
    throw new Undetermined(`${face} 面一个候选都没读到内容 ⇒ 扫描面判空,不记绿`)
  }
  // 棘轮锚点**永远取"被审状态的前一态"**,不得与被审面同源:
  //   --staged(索引) → HEAD ; 全量(HEAD) → HEAD~1 ; worktree → HEAD。
  // 若锚点就是被审面自己,任何一次加重都会被同步抬高的额度洗白 ⇒ W2/W3 结构上永远判不红
  // (这一条是自检 A4/A7 第一次跑就抓出来的:第一版把锚点写成"该文件 HEAD 自身",
  //  而全量档的"该文件 HEAD"就是被审内容本身)。
  const anchorRev = face === 'head' ? 'HEAD~1' : 'HEAD'
  let anchorByRel = new Map()
  let anchorUnavailable = false
  try {
    anchorByRel = readRevBatch(root, anchorRev, rels)
  } catch (e) {
    // 锚点取不到(浅克隆 / 根提交 / 仓在动)⇒ W2/W3 只能记"未判定",绝不记"通过"
    anchorUnavailable = true
  }
  const anchorCounts = {}
  for (const rel of rels) {
    const text = anchorByRel.get(rel) ?? ''
    anchorCounts[rel] = {
      rows: countDimensionRows(text),
      trig: findTriggerRegexLines(text).length,
    }
  }
  const verdict = decide(files, anchorCounts, anchorUnavailable)
  return {
    face,
    scanned: rels.length,
    grepped,
    anchorRev: anchorUnavailable ? null : anchorRev,
    candidateRels: rels,
    ...verdict,
  }
}

// ==================== CLI ====================

function printVerdict(res, root) {
  console.log(`多维提及引擎接线与单一源对账 · 判定面:${res.face} · 候选 ${res.scanned} 个文件 · ROOT ${root}`)
  for (const sym of WIRED_SYMBOLS) {
    const w = res.wired[sym.name]
    console.log(
      `  ${w.prod > 0 ? '✅' : '❌'} ${sym.name}: 生产调用方 ${w.prod} 处 / 测试面 ${w.test} 处${w.callers.length ? ` (首个 ${w.callers[0]})` : ''}`,
    )
  }
  const n = res.notice
  console.log(
    `  只报数:第二表候选 ${n.secondEngineFiles.length} / 触发正则候选 ${n.triggerRegexFiles.length} / 单行表 ${n.loneDimensionRows.length}(形状巧合一律走锚点棘轮,不判红)`,
  )
  console.log(
    `  棘轮锚点面:${res.anchorRev ? res.anchorRev : '未判定'}${n.anchorUnavailable ? ' ⇒ 锚点取不到,W2/W3 本轮未判定(不是通过)' : ''}`,
  )
  for (const v of res.violations) console.log(`  ❌ ${v}`)
  if (res.violations.length === 0) console.log('  ✅ 三个件都有生产调用方,且维度表与触发解析各只有一处')
}

function runSelfTest() {
  const results = []
  const ok = (name, cond, detail = '') => results.push({ name, pass: !!cond, detail })

  const ENGINE = `export const MENTION_DIMENSIONS = [
  { id: 'at-file', sigil: '@', candidateSource: 'workspace-files' },
  { id: 'at-symbol', sigil: '@', candidateSource: 'context-search' },
  { id: 'hash-rule', sigil: '#', candidateSource: 'static-category' },
] as const
const HASH_TRIGGER_RE = /(?:^|\\s)#([^\\s#]*)$/
const AT_TRIGGER_RE = /@([\\w./-]*)$/
export function parseMentionTrigger(v: string) { return HASH_TRIGGER_RE.exec(v) ?? AT_TRIGGER_RE.exec(v) }
`
  const STORE = `export const useContextMentionStore = { addMention: (mention: unknown) => {} }
`
  const HOOK = `export function useSearchMentions(q: string, type: string) { return { data: null, query: q, type } }
`
  const CHIPS = `export function MentionChips() { return null }
`
  const CONSUMER = `import { useContextMentionStore } from '../stores/context-mention'
import { useSearchMentions } from '../hooks/use-context-mention'
import { MentionChips } from './mention-popover'
export function Panel() {
  useContextMentionStore.getState().addMention({ id: 'x' })
  useSearchMentions('a', 'file')
  return <MentionChips />
}
`
  /** 61 票之前的真实状态:三个件全在,一个调用方都没有 */
  const BASE_FILES = {
    [ENGINE_FILE]: ENGINE,
    'apps/web/src/stores/context-mention.ts': STORE,
    'apps/web/src/hooks/use-context-mention.ts': HOOK,
    'apps/web/src/components/chat/mention-popover.tsx': CHIPS,
    'apps/web/src/components/chat/panel.tsx': CONSUMER,
  }
  /** 只有定义、没有消费面的那一组(= 立项时的存量形状) */
  const UNWIRED = { ...BASE_FILES }
  delete UNWIRED['apps/web/src/components/chat/panel.tsx']
  const COMMENTED_OUT = `// 把三处调用点注释掉 —— 这正是"看起来有、其实没装车"那一型
// useContextMentionStore.getState().addMention(sel)
// useSearchMentions(q, 'file')
// <MentionChips />
export const noop = 1
`
  const SECOND_TABLE = `const LOCAL_DIMENSIONS = [
  { id: 'a', candidateSource: 'static-category' },
  { id: 'b', candidateSource: 'context-search' },
]
export const x = LOCAL_DIMENSIONS
`
  const SECOND_PARSER = `export function ownTrigger(value: string) {
  return value.match(/(?:^|\\s)#([^\\s#]*)$/)
}
`
  const LOOKALIKE_NOISE = `const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
const EMAIL_RE = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/
export const check = (s: string) => HEX_COLOR_RE.test(s) || EMAIL_RE.test(s)
`

  const dirs = []
  const mk = (tag, files) => {
    const dir = mkScratch(`mention-wired-${tag}-`)
    for (const [rel, content] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, rel)), { recursive: true })
      writeFileSync(join(dir, rel), content)
    }
    gitRaw(['init', '-q'], dir, { timeout: GIT_TIMEOUT })
    gitRaw(['add', '-A'], dir, { timeout: GIT_TIMEOUT })
    gitRaw(['commit', '-q', '-m', 'fixture'], dir, { timeout: GIT_TIMEOUT })
    dirs.push(dir)
    return dir
  }

  try {
    // ①②成对(本门的存在理由,必须有牙):装车 ⇒ 绿 / 把调用点注释掉 ⇒ 红
    const green = analyze(mk('g', BASE_FILES), 'head')
    ok('A1 三个件都有生产调用方 ⇒ 无违规', green.violations.length === 0, JSON.stringify(green.violations))
    const commented = mk('c', { ...BASE_FILES, 'apps/web/src/components/chat/panel.tsx': COMMENTED_OUT })
    const red = analyze(commented, 'head')
    const missing = red.violations.filter((v) => v.startsWith('W1')).map((v) => /`(\w+)`/.exec(v)?.[1])
    ok(
      'A2 调用点被注释掉 ⇒ W1 三个件全判红(注释不算装车)',
      ['addMention', 'useSearchMentions', 'MentionChips'].every((n) => missing.includes(n)),
      JSON.stringify(red.violations),
    )

    // ③只有测试面引用不构成装车
    const testOnly = analyze(
      mk('t', {
        ...UNWIRED,
        'apps/web/tests/mention.test.tsx': CONSUMER,
      }),
      'head',
    )
    ok(
      'A3 只有测试面调用 ⇒ W1 判红',
      testOnly.violations.filter((v) => v.startsWith('W1')).length === 3,
      JSON.stringify(testOnly.violations),
    )

    // ④⑤⑦第二份表 / 第二处解析:必须走 **索引面** —— 全量档的锚点就是 HEAD~1,
    //   而夹具是一次提交的临时仓,没有父提交可退,所以"提交这步动作"只能由 staged 面证明。
    const mkStaged = (tag, extra) => {
      const dir = mk(tag, BASE_FILES)
      for (const [rel, content] of Object.entries(extra)) {
        mkdirSync(dirname(join(dir, rel)), { recursive: true })
        writeFileSync(join(dir, rel), content)
      }
      gitRaw(['add', '-A'], dir, { timeout: GIT_TIMEOUT })
      return dir
    }
    const secondTable = analyze(mkStaged('tb', { 'apps/web/src/components/chat/local-dimensions.ts': SECOND_TABLE }), 'staged')
    ok(
      'A4 第二份维度清单被暂存 ⇒ W2 判红',
      secondTable.violations.some((v) => v.startsWith('W2')),
      JSON.stringify(secondTable.violations),
    )
    const loneRow = analyze(
      mk('lr', {
        ...BASE_FILES,
        'apps/web/src/components/chat/one-off.ts': `export const meta = { candidateSource: 'static-category' }\n`,
      }),
      'head',
    )
    ok(
      'A5 只有一行表指纹 ⇒ 只报数不判红',
      loneRow.violations.length === 0 && loneRow.notice.loneDimensionRows.length === 1,
      JSON.stringify(loneRow.notice),
    )

    // ⑥形状巧合:hex 色值 / 邮箱那类同形状正则不得算触发解析(反假阳端到端)
    const lookalike = analyze(
      mk('lk', { ...BASE_FILES, 'apps/web/src/lib/format.ts': LOOKALIKE_NOISE }),
      'head',
    )
    ok(
      'A6 hex/邮箱那类同形状正则 ⇒ 不计触发解析(W3 需带结尾锚且非行首锚定)',
      lookalike.violations.filter((v) => v.startsWith('W3')).length === 0,
      JSON.stringify(lookalike.violations),
    )
    const secondParser = analyze(
      mkStaged('sp', {
        'apps/web/src/components/chat/local-dimensions.ts': SECOND_TABLE,
        'apps/web/src/hooks/own-trigger.ts': SECOND_PARSER,
      }),
      'staged',
    )
    ok(
      'A7 第二处触发解析被暂存 ⇒ W3 判红',
      secondParser.violations.some((v) => v.startsWith('W3')),
      JSON.stringify(secondParser.violations.filter((v) => v.startsWith('W3'))),
    )
    // A7b:棘轮的"锚点必须与被审内容不同源"由纯函数 decide 直接证 —— 同一份被审内容,
    // 锚点给 0 就红、锚点给到同值就绿。用构造面而不是临时仓,是因为一次提交的临时仓
    // 根本没有 HEAD~1,拿它证棘轮只会证到"取不到锚点"这一件事(第一版就踩在这里)。
    ok(
      'A7b 同一份被审内容:锚点 0 ⇒ W2/W3 红;锚点给到同值 ⇒ 绿(棘轮真的有锚)',
      (() => {
        const files = [
          { rel: ENGINE_FILE, text: ENGINE },
          ...Object.entries(BASE_FILES)
            .filter(([rel]) => rel !== ENGINE_FILE)
            .map(([rel, text]) => ({ rel, text })),
          { rel: 'apps/web/src/hooks/own-trigger.ts', text: SECOND_PARSER },
          { rel: 'apps/web/src/components/chat/local-dimensions.ts', text: SECOND_TABLE },
        ]
        const noAnchor = decide(files, {}, false)
        const withAnchor = decide(
          files,
          {
            'apps/web/src/hooks/own-trigger.ts': { rows: 0, trig: 1 },
            'apps/web/src/components/chat/local-dimensions.ts': { rows: 2, trig: 0 },
          },
          false,
        )
        const degraded = decide(files, {}, true)
        return (
          noAnchor.violations.filter((v) => v.startsWith('W2') || v.startsWith('W3')).length === 2 &&
          withAnchor.violations.filter((v) => v.startsWith('W2') || v.startsWith('W3')).length === 0 &&
          degraded.violations.filter((v) => v.startsWith('W2') || v.startsWith('W3')).length === 0 &&
          degraded.notice.anchorUnavailable === true
        )
      })(),
    )

    // ⑧引擎自己把解析弄丢 = 判据失明,不许记绿
    const engineBlind = analyze(
      mk('eb', { ...BASE_FILES, [ENGINE_FILE]: `export const MENTION_DIMENSIONS = [] as const\n` }),
      'head',
    )
    ok(
      'A8 引擎内读不到触发正则 ⇒ 判红而非静默绿',
      engineBlind.violations.some((v) => v.includes('唯一取材点')),
      JSON.stringify(engineBlind.violations),
    )

    // ⑨口径:索引面摘掉调用方 ⇒ staged 判红而同仓 HEAD 面判绿(两面不互相洗白)
    const split = mk('it', BASE_FILES)
    writeFileSync(join(split, 'apps/web/src/components/chat/panel.tsx'), COMMENTED_OUT)
    gitRaw(['add', '-A'], split, { timeout: GIT_TIMEOUT })
    const staged = analyze(split, 'staged')
    const head = analyze(split, 'head')
    ok(
      'A9 索引面摘掉调用方 ⇒ staged 判 W1 红',
      staged.violations.some((v) => v.startsWith('W1')),
      JSON.stringify(staged.violations),
    )
    ok(
      'A10 同仓 HEAD 面仍判绿(两面不互相洗白)',
      head.violations.length === 0,
      JSON.stringify(head.violations),
    )

    // ⑪空扫描面不得当"没有违规":grep 到 0 个候选 ⇒ 显式判"无法判定"
    let emptyVerdict = null
    let emptyThrew = null
    try {
      emptyVerdict = analyze(mk('e', { 'README.md': 'nothing here\n' }), 'head')
    } catch (e) {
      emptyThrew = e
    }
    ok(
      'A11 扫描面判空(grep 0 命中)⇒ 抛"无法判定",不记绿',
      emptyThrew instanceof Undetermined && emptyVerdict === null,
      emptyThrew ? String(emptyThrew.message) : `grepped=${emptyVerdict?.grepped}`,
    )

    // ⑫掩噪的判别力:同一形态写在注释里必不计、写在代码里必计(否则遮罩关掉的是判据本身)
    ok(
      'A12 maskNoise 关掉注释形态而不关掉真代码',
      findCallLines(COMMENTED_OUT, 'addMention(', /^\s*addMention:\s*\(/).length === 0 &&
        findCallLines(CONSUMER, 'addMention(', /^\s*addMention:\s*\(/).length === 1,
    )
    ok(
      'A13 触发指纹能命中引擎那两条(判别力证明)',
      findTriggerRegexLines(ENGINE).length === 2,
      JSON.stringify(findTriggerRegexLines(ENGINE)),
    )
    ok(
      'A14 行首锚定的 hex 色值正则不得被算成触发解析(反假阳证明)',
      findTriggerRegexLines(LOOKALIKE_NOISE).length === 0,
      JSON.stringify(findTriggerRegexLines(LOOKALIKE_NOISE)),
    )
    // ⑭真仓阳性对照走 **worktree 面**:本票实现落地前 HEAD 里当然还没有它(判 HEAD 是提交链的口径,
    //    而"我这轮写的东西被自己的判据认作已装车"只能在磁盘面上证)。落地后两面同绿。
    let realVerdict = null
    let realError = null
    try {
      realVerdict = analyze(DEFAULT_ROOT, 'worktree')
    } catch (e) {
      realError = e
    }
    const realSummary = realVerdict
      ? `scanned=${realVerdict.scanned} wired=${WIRED_SYMBOLS.map((s) => `${s.name}:${realVerdict.wired[s.name].prod}`).join(',')} violations=${realVerdict.violations.length}`
      : `抛出:${realError?.message ?? realError}`
    ok(
      'A15 真仓工作树的三个件都被判为已装车(阳性对照:判据对着本票实际产出跑一遍)',
      !!realVerdict && WIRED_SYMBOLS.every((s) => realVerdict.wired[s.name].prod > 0),
      realSummary,
    )
    ok(
      'A16 真仓工作树面上 W2/W3 无违规(存量恰为零 ⇒ 本门不出生即红)',
      !!realVerdict &&
        realVerdict.violations.filter((v) => v.startsWith('W2') || v.startsWith('W3')).length === 0,
      realSummary,
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
  const rootIdx = argv.indexOf('--root')
  const root = rootIdx >= 0 ? resolve(argv[rootIdx + 1]) : DEFAULT_ROOT
  const { face, error } = selectFace({ staged: flags.has('--staged'), worktree: flags.has('--worktree') })
  if (error) {
    console.error(`❌ ${error}`)
    return 2
  }
  if (flags.has('--help') || flags.has('-h')) {
    console.log(
      `用法: node scripts/check-mention-engine-wired.mjs [--staged|--worktree|--self-test|--json|--root <dir>]\n判定面: 全量=HEAD blob / --staged=索引 blob / --worktree=磁盘(仅人工)\nW1 零容忍(三个件必须有生产调用方);W2/W3 走该文件 HEAD 自身存量棘轮\n紧急跳过(由 guardian-runner 读取): ${SKIP_ENV_NAME}=1`,
    )
    return 0
  }
  try {
    const res = analyze(root, face)
    if (res.scanned <= 1) {
      console.error(
        `❌ 无法判定:${face} 面里除了引擎文件什么都没枚举到(候选 ${res.scanned} 个)⇒ 这是扫描面判空,不是"没有违规";判据失效不得记绿`,
      )
      return 2
    }
    if (flags.has('--json')) {
      console.log(JSON.stringify({ face: res.face, scanned: res.scanned, counts: res.counts, wired: res.wired, notice: res.notice, violations: res.violations }))
    } else {
      printVerdict(res, root)
    }
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
  ENGINE_FILE,
  WIRED_SYMBOLS,
  DIMENSION_ROW_FINGERPRINT,
  TRIGGER_REGEX_FINGERPRINT,
  TRIGGER_END_ANCHOR,
  SKIP_ENV_NAME,
  maskNoise,
  isTestSurface,
  findCallLines,
  findTriggerRegexLines,
  countDimensionRows,
  decide,
  analyze,
  listCandidates,
}
