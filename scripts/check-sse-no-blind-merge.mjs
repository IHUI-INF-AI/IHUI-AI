#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/check-sse-no-blind-merge.mjs — 票 G-816006 的守门**草案**。
 *
 * 【尚未接线】本门**不在提交链上**:未注册进 `scripts/guardian-runner.mjs`,也不在
 * `scripts/lib/pre-commit-hook.js` 里 —— 因此**没有紧急跳过变量**(它不在钩子链上,
 * 跳过旗无处生效)。头注如实写这一格,是因为本仓记过多次"自称已接线的门":守门 89 的 R2
 * 会按这句声称去查五处权威点,查不到即对每一次提交判红,而恒红门的唯一结局是各会话
 * `--no-verify`、连带链上全部守门对该提交作废(AGENTS §12e/§12f 同型)。
 * 接进提交链的前置(写在这里,不由本草案顺手做):
 *   ① 现读真仓存量;② 套「该文件 HEAD 自身命中数」棘轮(存量只报数,新增才红);
 *   ③ 与 `projection-watermark.ts` 的接线同批(没有生产消费点之前,这道门判的是纯形状)。
 *
 * 判的是这一型失真:SSE 的**全量帧分支**(`snapshot` / `initial`)里出现"把本地旧状态铺开"的
 * 合并 —— 全量帧的语义是"这就是完整状态",一旦写成 `{ ...prev, ... }`,initial 丢失后
 * 新代次的第一帧就会拼在一份旧投影上,产出一段**自洽但根本不存在的对话**,而日志零痕迹。
 * 唯一正解是让全量帧整体替换投影,并把"能不能拼"交给 `packages/shared/src/chat/projection-watermark.ts`
 * (基线代次 + 序号单调 + 断档只重订阅),不是在这里就地补偿。
 *
 * 三态绝不并桶(本仓最高频失效型是把"没判"写成"判过了"):
 *   命中   —— 全量帧分支内铺开本地旧状态 → 判红
 *   放过   —— 分支内整体替换(铺开的是帧载荷,不是本地状态)
 *   未判定 —— 分支区域配不平 / 铺开的表达式读不出归属 → 逐条点名,`--strict` 下 exit 2
 * 空枚举判死:候选文件枚举到 0 个 ⇒ exit 2(空扫不得读成"全仓干净")。
 *
 * 取材口径同 70/77/83/98/101/103/118:全量判 **HEAD blob**、`--staged` 判**索引 blob**、
 * `--worktree` 仅人工逃生舱、两面旗同给 exit 2、任一面取不到判"无法判定"**不回落**另一个面;
 * 清单与内容**同面同轮**。派生一律走 `scripts/lib/face-reader.mjs`(绝对 git 二进制 + 显式 stdio)。
 *
 * 遮噪两遍方向不同且都只引 `scripts/lib/code-mask.mjs` 那一份实现(§22c 禁第二份):
 *   锚点(分支标签 `'snapshot'`)**住在字符串字面量里** ⇒ 必须用"连字符串也保留"的原文面,
 *   并按 span 类型把它落在注释里的出现剔掉(否则门会把自己解释文字判成站点);
 *   铺开表达式(`...prev`)是代码 ⇒ 用"注释与字符串一起抹"的等长面,行号与原文逐字对齐。
 */

import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
import { maskCommentsStringsAndRegex, scanSpans } from './lib/code-mask.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/**
 * 本地旧状态的常见名字。**名字判据,不是类型判据**:读不出归属的一律落未判定,绝不猜。
 * `state` / `base` 这类宽名可能命中"铺开的其实是帧字段"的情形 —— 那属误报,交人工复核;
 * 草案刻意宁报不误藏,因为这一族漏判的代价是"上线一版自洽但不存在的对话"。
 */
const PRIOR_STATE_NAMES = Object.freeze([
  'prev',
  'prevstate',
  'prevdata',
  'previous',
  'previousstate',
  'old',
  'oldstate',
  'acc',
  'accm',
  'accumulator',
  'state',
  'cur',
  'current',
  'currentstate',
  'existing',
  'carry',
  'carryover',
  'base',
  'projection',
])
/** 全量帧标签:新增别名必须同批改这里与预筛,否则整型隐身(门 102 左向箭头那一课)。 */
const BASELINE_LABELS = Object.freeze(['snapshot', 'initial'])
/**
 * 内容预筛表由上面两张表**派生**,不手抄第二份(手抄的名单必然随扩表腐烂 —— AGENTS 对
 * `RN_ONLY_BRAND_KEYS` 记过同型)。预筛漏一项 = 门对该形态全盲。
 */
const PREFILTER_TOKENS = Object.freeze([...new Set([...BASELINE_LABELS, ...PRIOR_STATE_NAMES])])
const REGION_LINE_CAP = 40

/** 归一后用于比对的名字(小写去下划线)。 */
function normName(raw) {
  return String(raw)
    .toLowerCase()
    .replace(/[^a-z0-9_$]/g, '')
}

function isPriorName(raw) {
  return PRIOR_STATE_NAMES.includes(normName(raw))
}

/** 偏移落在哪一类区间(line/block 注释、string、regex);不在任何区间 ⇒ null。分词只有一台。 */
function spanKindAt(spans, offset) {
  for (const s of spans) {
    if (offset < s.start) break
    if (offset >= s.start && offset < s.end) return s.kind
  }
  return null
}

/**
 * 找全量帧分支锚点。四种书写都认:`case 'snapshot':`、`x === 'snapshot'`、`'initial' === x`、
 * 三元里的 `'snapshot' ? … : …` —— 只认一种就是对本仓实际写法半盲。
 * 落在注释里的提及不建锚(散文不是站点);`scanSpans` 每个文件只跑一遍(逐锚点重扫会在
 * 大文件上把一次分词付上千遍)。
 */
function findAnchors(src) {
  const spans = scanSpans(src)
  const out = []
  const re = new RegExp(`(['"\`])(${BASELINE_LABELS.join('|')})\\1`, 'g')
  let m
  while ((m = re.exec(src)) !== null) {
    const kind = spanKindAt(spans, m.index)
    // 注释里提及全量帧不是分支;真命中必须在代码位上带比较符或 case 关键字
    if (kind === 'line' || kind === 'block') continue
    const before = src.slice(Math.max(0, m.index - 24), m.index)
    const after = src.slice(m.index + m[0].length, m.index + m[0].length + 24)
    const looksBranch =
      /\bcase\s*$/.test(before) ||
      /(===|==|!==|!=)\s*$/.test(before) ||
      /^\s*(===|==)/.test(after) ||
      /^\s*(\?|:)/.test(after)
    if (!looksBranch) continue
    out.push({ offset: m.index, line: lineOf(src, m.index), label: m[2] })
  }
  return out
}

function lineOf(src, offset) {
  let n = 1
  for (let i = 0; i < offset && i < src.length; i++) if (src[i] === '\n') n++
  return n
}

function bracesIn(line) {
  let open = 0
  let close = 0
  for (const ch of line) {
    if (ch === '{') open += 1
    else if (ch === '}') close += 1
  }
  return { open, close }
}

/**
 * 锚点所在分支的区域:从锚点行起按**花括号深度**收口。
 * 收不住(超窗口 / 深度永不为正 / 配不平)⇒ `delimited:false`,调用方落**未判定**而不是猜。
 */
/**
 * 锚点所在分支的区域。三条收口路径,收不住就 `delimited:false` ⇒ 调用方落**未判定**而不是猜:
 *  ① 锚点行自带一整块**平衡**的花括号(`case 'initial': return { ...state }`)⇒ 区域 = 该行;
 *  ② 锚点行开启一个未闭合的块 ⇒ 向后收到深度归零;
 *  ③ 锚点行没有花括号 ⇒ 逐行带到第一个成句边界(空行 / `;` / `}` / 下一个块)。
 * 旧实现在这条上是错的:它对"整行写完的单行分支"一路扫到文件尾,把 `region-unbounded`
 * 判给本可干净收口的站点 —— 判据过窄的代价不是少报,而是把能判的格写成判不出。
 */
function regionOf(faceLines, anchorLine) {
  const start = anchorLine - 1
  const cap = Math.min(faceLines.length - 1, start + REGION_LINE_CAP)
  const closeBlockFrom = (from, depth0) => {
    let depth = depth0
    for (let i = from; i <= cap; i++) {
      const b = bracesIn(faceLines[i])
      depth += b.open - b.close
      if (depth < 0) return { start, end: i, delimited: false, why: 'region-unbalanced' }
      if (depth <= 0) return { start, end: i, delimited: true }
    }
    return { start, end: cap, delimited: false, why: 'region-unbounded' }
  }
  const first = bracesIn(faceLines[start] ?? '')
  if (first.open > 0) {
    if (first.open === first.close) return { start, end: start, delimited: true }
    return closeBlockFrom(start + 1, first.open - first.close)
  }
  for (let i = start + 1; i <= cap; i++) {
    const b = bracesIn(faceLines[i])
    if (b.open > 0) {
      if (b.open === b.close) return { start, end: i, delimited: true }
      return closeBlockFrom(i + 1, b.open - b.close)
    }
    const t = faceLines[i].trim()
    if (t === '') return { start, end: Math.max(start, i - 1), delimited: true }
    if (t.endsWith(';') || t.endsWith('}')) return { start, end: i, delimited: true }
  }
  return { start, end: cap, delimited: false, why: 'region-unbounded' }
}

/** 抽出 `...` 后面的表达式头,给出归类。 */
function classifySpread(expr) {
  const trimmed = expr.trim()
  if (/^[A-Za-z_$][\w$]*\s*\(/.test(trimmed)) return { cls: 'undetermined', why: 'spread-of-call' }
  if (/^[A-Za-z_$][\w$]*\.[A-Za-z_$][\w$]*$/.test(trimmed)) {
    const [head, key] = trimmed.split('.')
    if (isPriorName(head) || isPriorName(key)) return { cls: 'undetermined', why: 'spread-of-member-on-prior-name' }
    return { cls: 'pass' }
  }
  const head = /^([A-Za-z_$][\w$]*)/.exec(trimmed)
  if (!head) return { cls: 'undetermined', why: 'spread-expression-unparsable' }
  return isPriorName(head[1]) ? { cls: 'hit', name: head[1] } : { cls: 'pass' }
}

/**
 * 判一个文件(纯函数,不碰 git、不碰盘)—— 自检与生产档共用**这同一个入口**,
 * 因为"函数会答"与"有人问它"是两件事(AGENTS 门 150 ㊵ 那一课)。
 */
export function analyzeSource(rel, src) {
  const findings = { file: rel, hits: [], passed: [], undetermined: [] }
  if (typeof src !== 'string' || src.length === 0) {
    findings.undetermined.push({ line: 0, label: null, why: 'content-unreadable' })
    return findings
  }
  const anchors = findAnchors(src)
  if (anchors.length === 0) return findings
  const face = maskCommentsStringsAndRegex(src)
  const faceLines = face.split('\n')
  for (const a of anchors) {
    const region = regionOf(faceLines, a.line)
    if (!region.delimited) {
      findings.undetermined.push({ line: a.line, label: a.label, why: region.why })
      continue
    }
    const localHits = []
    const localUndet = []
    let spreads = 0
    for (let i = region.start; i <= region.end; i++) {
      const re = /\.\.\.\s*([^\n]*)/g
      let m
      while ((m = re.exec(faceLines[i])) !== null) {
        spreads += 1
        const cls = classifySpread(m[1])
        if (cls.cls === 'hit') localHits.push({ line: i + 1, label: a.label, name: cls.name })
        else if (cls.cls === 'undetermined') localUndet.push({ line: i + 1, label: a.label, why: cls.why })
      }
    }
    // 一条锚点分支只给一个结论,优先级:命中 > 未判定 > 放过。
    // 命中压过未判定 —— 否则"旁边有一条读不出"会把真红洗成灰,而灰读起来像已处理。
    if (localHits.length > 0) findings.hits.push(...localHits)
    else if (localUndet.length > 0) findings.undetermined.push(...localUndet)
    else findings.passed.push({ line: a.line, label: a.label, spreads })
  }
  return findings
}

/** 候选枚举:清单与内容必须同面(全量取 HEAD 树,`--staged` 取索引)。 */
function listCandidates(face) {
  const nul = '\u0000'
  const raw =
    face === 'head'
      ? gitRaw(['ls-tree', '-r', '--name-only', '-z', 'HEAD'], ROOT, {})
      : gitRaw(['ls-files', '-z'], ROOT, {})
  const all = String(raw ?? '').split(nul).filter(Boolean)
  return all.filter((p) => {
    if (!/\.tsx?$/.test(p)) return false
    if (!/^(apps|packages)\//.test(p)) return false
    if (/\/(node_modules|dist|\.next|build)\//.test(p)) return false
    if (/(^|\/)(__tests__|tests|test|e2e|cypress|__mocks__)(\/|$)/.test(p)) return false
    if (/\.(test|spec)\.tsx?$/.test(p)) return false
    return true // 内容面不收窄路径:预筛在下面按判据字面量做,漏一项就会对该型全盲
  })
}

/** 内容预筛:必须覆盖判据的每一个字面量,少一项即对该型全盲(门 102 预筛超集同课)。 */
function contentMightMatch(text) {
  if (typeof text !== 'string') return false
  if (!BASELINE_LABELS.some((t) => text.includes(t))) return false
  return PRIOR_STATE_NAMES.some((t) => text.includes(t))
}

function readFace(face, rels) {
  if (rels.length === 0) return {}
  if (face === 'worktree') {
    const out = {}
    for (const rel of rels) {
      const text = readWorktreeFile(ROOT, rel)
      if (text === null || text === undefined) throw new Error(`worktree 取不到 ${rel}`)
      out[rel] = text
    }
    return out
  }
  const prefix = face === 'staged' ? ':' : 'HEAD:'
  const specs = rels.map((rel) => prefix + rel)
  const got = catBatch(ROOT, specs, { maxBuffer: 1 << 28 })
  const out = {}
  const missing = []
  for (let i = 0; i < rels.length; i++) {
    const text = got.get(specs[i])
    if (text === null || text === undefined) missing.push(rels[i])
    else out[rels[i]] = text
  }
  if (missing.length > 0) throw new Error(`${face} 面取不到 ${missing.length} 个:${missing.slice(0, 5).join(' / ')}`)
  return out
}

/** 退出码决策(纯函数,自检直接判它,不依赖仓库瞬时状态)。 */
export function decideExit({ enumerated, hits, undetermined, strict }) {
  if (enumerated === 0) return 2 // 空枚举判死:不得读成"全仓干净"
  if (hits > 0) return 1
  if (strict && undetermined > 0) return 2 // 拒绝出具合格证
  return 0
}

export function run({ staged = false, worktree = false, strict = false, json = false } = {}) {
  // 两面旗同给 = 自相矛盾:取哪一面都会让另一面成为假绿 ⇒ 判死,不回落(层把这一格统一成 error)
  const picked = selectFace({ staged, worktree })
  if (picked.error) return { rc: 2, error: picked.error }
  const face = picked.face
  let rels
  let texts
  try {
    rels = listCandidates(face)
    if (rels.length === 0) {
      return { rc: 2, face, enumerated: 0, findings: [], error: '候选枚举到 0 个文件 ⇒ 判死,不记绿' }
    }
    texts = readFace(face, rels)
  } catch (e) {
    return { rc: 2, face, error: `取不到,无法判定:${e && e.message}` }
  }
  const findings = []
  let scanned = 0
  let prefiltered = 0
  for (const rel of rels) {
    const text = texts[rel]
    if (!contentMightMatch(text)) {
      prefiltered += 1
      continue
    }
    scanned += 1
    const f = analyzeSource(rel, text)
    if (f.hits.length + f.undetermined.length + f.passed.length > 0) findings.push(f)
  }
  const hits = findings.reduce((n, f) => n + f.hits.length, 0)
  const undetermined = findings.reduce((n, f) => n + f.undetermined.length, 0)
  const passed = findings.reduce((n, f) => n + f.passed.length, 0)
  const rc = decideExit({ enumerated: rels.length, hits, undetermined, strict })
  const report = { rc, face, enumerated: rels.length, scanned, prefiltered, hits, passed, undetermined, findings }
  if (json) console.info(JSON.stringify(report, null, 2))
  else {
    for (const f of findings) {
      for (const h of f.hits) console.info(`❌ ${f.file}:${h.line} 全量帧(${h.label})分支里铺开本地旧状态 \`...${h.name}\``)
      for (const u of f.undetermined) console.info(`⚠️ 未判定 ${f.file}:${u.line} ${u.why}`)
    }
    console.info(
      `判定面=${report.face} · 候选 ${report.enumerated} · 实判 ${report.scanned}(预筛剔除 ${report.prefiltered})· 命中 ${hits} · 放过 ${passed} · 未判定 ${undetermined}`,
    )
    if (rc === 2 && report.enumerated === 0) console.info('空枚举 ⇒ 无法判定(不得读成"没有违规")')
    if (rc === 0 && undetermined > 0) console.info('注:默认档有未判定不判红;问责跑 --strict,它会拒绝出具合格证。')
  }
  return report
}

// ─── 自检(构造面成对正反例;不碰仓库、不派生 git)───────────────────────────
export function selfTest() {
  const cases = []
  const t = (name, cond) => cases.push({ name, ok: cond === true })

  // 命中:多行块里的 ...prev
  t(
    'H1 全量帧分支内 ...prev ⇒ 命中',
    (() => {
      const f = analyzeSource(
        'a.ts',
        `function h(event) {
  if (event === 'snapshot') {
    setState((prev) => ({
      ...prev,
      messages: event.messages,
    }))
  }
}
`,
      )
      return f.hits.length === 1 && f.hits[0].name === 'prev'
    })(),
  )
  // 命中:case 标签形态 + 单行
  t(
    'H2 case "initial" 单行 ⇒ 命中',
    (() => {
      const f = analyzeSource('b.ts', `case 'initial': return { ...state, hydrated: true }\n`)
      return f.hits.length === 1
    })(),
  )
  // 放过:整体替换(铺开的是帧载荷)
  t(
    'P1 全量帧整体替换 ⇒ 放过,不得判红',
    (() => {
      const f = analyzeSource(
        'c.ts',
        `if (kind === 'snapshot') {
  return { ...frame.payload }
}
`,
      )
      return f.hits.length === 0 && f.passed.length === 1
    })(),
  )
  // 放过:锚点在注释里(门不得把自己的解释文字判成站点)
  t(
    'P2 注释里提及 ...prev ⇒ 一条 finding 都不建',
    (() => {
      const f = analyzeSource('d.ts', `// 以前这里写成 if (x === 'snapshot') { ...prev }\nexport const n = 1\n`)
      return f.hits.length === 0 && f.undetermined.length === 0 && f.passed.length === 0
    })(),
  )
  // 未判定:区域配不平
  t(
    'U1 花括号配不平 ⇒ 未判定,不猜、不记绿',
    (() => {
      const f = analyzeSource('e.ts', `if (x === 'snapshot') {\n  const bad = { ...prev\n}\n`)
      return f.hits.length === 0 && f.undetermined.length > 0
    })(),
  )
  // 未判定:铺开的表达式读不出归属
  t(
    'U2 ...merge(prev) ⇒ 未判定(不得直接判红,也不得静默放过)',
    (() => {
      const f = analyzeSource('f.ts', `case 'initial': set({ ...merge(prev) })\n`)
      return f.hits.length === 0 && f.undetermined.some((u) => u.why === 'spread-of-call')
    })(),
  )
  t(
    'U3 内容取不到 ⇒ 未判定',
    (() => analyzeSource('g.ts', '').undetermined.length === 1)(),
  )
  // 退出码三态
  t('X1 空枚举 ⇒ rc 2', decideExit({ enumerated: 0, hits: 0, undetermined: 0, strict: false }) === 2)
  t('X2 有命中 ⇒ rc 1', decideExit({ enumerated: 10, hits: 1, undetermined: 0, strict: false }) === 1)
  t('X3 默认档有未判定 ⇒ rc 0 并报名', decideExit({ enumerated: 10, hits: 0, undetermined: 3, strict: false }) === 0)
  t('X4 --strict 有未判定 ⇒ rc 2 拒绝出合格证', decideExit({ enumerated: 10, hits: 0, undetermined: 3, strict: true }) === 2)
  // 预筛必须是判据字面量的超集
  t(
    'S1 预筛覆盖 BASELINE_LABELS 与 PRIOR_STATE_NAMES',
    (() => {
      const tokens = PREFILTER_TOKENS.map((x) => String(x).toLowerCase())
      return (
        BASELINE_LABELS.every((x) => tokens.includes(x)) && PRIOR_STATE_NAMES.every((x) => tokens.includes(x))
      )
    })(),
  )
  t('S2 反向对照:同一 ...prev 只写进注释必须落 0 命中', (() => analyzeSource('h.ts', `/* ...prev */\n`).hits.length === 0)())
  // 取材面互斥:两面旗同给必须判死,且**不得**因此回落成另一个面的结论(假绿比红难查)
  t(
    'F1 --staged 与 --worktree 同给 ⇒ rc 2 且没有产出任何面结论',
    (() => {
      const r = run({ staged: true, worktree: true })
      return r.rc === 2 && r.face === undefined && Array.isArray(r.findings) !== true
    })(),
  )
  t(
    'F2 锚点写法反向对照:比较符在标签之后(`"snapshot" === x`)也必须建锚',
    (() => analyzeSource('i.ts', `if ("snapshot" === kind) { ...prev }\n`).hits.length === 1)(),
  )

  let pass = 0
  let fail = 0
  for (const c of cases) {
    if (c.ok) {
      pass += 1
      console.info(`✔ ${c.name}`)
    } else {
      fail += 1
      console.info(`✘ ${c.name}`)
    }
  }
  console.info(`自检 pass ${pass} / fail ${fail}`)
  return fail === 0 ? 0 : 1
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest()
  const r = run({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    strict: argv.includes('--strict'),
    json: argv.includes('--json'),
  })
  return r.rc
}

// §22d 双形态入口守卫:被 import(测试 / 别的门复用判据)时**不得**触发 CLI 副作用。
// pathToFileURL 必须在顶部静态 import —— 手写 `file://` 拼接对 Windows 反斜杠永远不匹配,
// 结果是 CLI 永不触发 main(),一道守门静默失控(§22d 红线第三条)。
const isDirectRun = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  process.exitCode = main()
}

export const __test__ = {
  analyzeSource,
  decideExit,
  classifySpread,
  findAnchors,
  regionOf,
  run,
  selfTest,
  BASELINE_LABELS,
  PRIOR_STATE_NAMES,
  PREFILTER_TOKENS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
