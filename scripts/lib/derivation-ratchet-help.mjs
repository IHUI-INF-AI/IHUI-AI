// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/lib/derivation-ratchet-help.mjs
 *
 * 判定面取材棘轮(scripts/tests/face-reader.test.mjs 的型 A / B / C)的「判红即教改」文案层。
 *
 * 立因(2026-11-04):棘轮已经能抓住「每文件一次 git 子进程」,但红的时候只报文件名/总数,
 * 下一个写脚本的人要自己猜:哪一行、为什么错、该抄什么。实测代价是同一类坑被反复重写
 * (门 251 逐文件派生 201 次、门 244 逐文件 show >17 分钟,都是收口后才被发现的)。
 *
 * 本层只做三件事:
 *   ① 逐命中给 `file:line`(行号按调用方传入的**判据面文本**计,与判据同面同轮);
 *   ② 给「当前写法 → 应改成什么」,并指名 scripts/lib/face-reader.mjs 的**已实测导出**;
 *   ③ 给可直接抄的骨架 + 一个真正可复用的批取入口 `readFaceBlobs`。
 *
 * 边界:
 *   - 不判红/不判绿,只渲染文案;门槛仍在 face-reader.test.mjs 的 assert 里(不降档)。
 *   - 本文件自身也在 scripts/lib/** 的扫描面内,所以**不得出现调用形态的裸 git 字面量**;
 *     「当前写法」一律从被审文件原文切片,不在此处硬编码。
 *   - 骨架里的 import 路径按调用方位置写:scripts/*.mjs 用 './lib/face-reader.mjs'。
 */

import { BARE_GIT_RE, catBatch, hideComments, listFaceFiles } from './face-reader.mjs'

/** 承载批取的唯一模块(实测:scripts/lib/face-reader.mjs 真实存在且导出下列名字)。 */
export const HELP_MODULE = 'scripts/lib/face-reader.mjs'
/** 从 scripts/*.mjs 里 import 时的写法。 */
export const HELP_IMPORT = './lib/face-reader.mjs'
/** 提示里会点名引用的导出;测试逐条断言它们真是函数,防止改名后文案变成谎话。 */
export const HELP_EXPORTS = [
  'gitRaw',
  'listFaceFiles',
  'catBatch',
  'catBatchOids',
  'gitBinary',
  'probeFaceSpec',
]

const VERBS = [
  'show',
  'cat-file',
  'ls-tree',
  'ls-files',
  'status',
  'diff',
  'diff-index',
  'rev-parse',
  'grep',
  'log',
  'rev-list',
  'merge-tree',
  'hash-object',
  'for-each-ref',
]

const lineOf = (text, idx) => text.slice(0, idx).split('\n').length
const lineText = (text, idx) => {
  const start = text.lastIndexOf('\n', idx - 1) + 1
  const end = text.indexOf('\n', idx)
  return text
    .slice(start, end === -1 ? undefined : end)
    .replace(/\r$/, '')
    .trim()
}

/**
 * 命中行是否在循环体内。只用花括号深度做近似:诊断文案写「疑似」,
 * 不把启发式当成判据的一部分(判据仍是 bareGitCountOf / pathBoundGitCountOf / hasBatchCall)。
 */
export function inLoopAt(text, idx) {
  const from = Math.max(0, idx - 1500)
  const win = text.slice(from, idx)
  const re = /(?:for\s*\(|for\s+(?:const|let|var)\s|while\s*\(|\.forEach\s*\(|\.map\s*\()/g
  let last = null
  for (const m of win.matchAll(re)) last = m
  if (!last) return false
  let depth = 0
  for (let i = last.index + last[0].length; i < win.length; i++) {
    if (win[i] === '{') depth++
    else if (win[i] === '}') depth--
  }
  return depth > 0
}

/** 从调用窗口里认出 git 子命令(供文案给出「该用哪一条改法」)。 */
function verbAt(text, idx) {
  const win = text.slice(idx, idx + 240)
  for (const v of VERBS) {
    if (win.includes(`'${v}'`) || win.includes(`"${v}"`) || win.includes(`git ${v}`)) return v
  }
  return null
}

/** 多行调用的「当前写法」:从入口抓到与它配对的闭括号,折成一行,避免只露出 `execFileSync(`。 */
function callTextAt(text, idx) {
  const open = text.indexOf('(', idx)
  if (open === -1) return lineText(text, idx)
  const cap = Math.min(text.length, idx + 600)
  let depth = 0
  let quote = null
  for (let i = open; i < cap; i++) {
    const ch = text[i]
    if (quote) {
      if (ch === '\\') {
        i++
        continue
      }
      if (ch === quote) quote = null
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch
      continue
    }
    if (ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === ')' || ch === ']' || ch === '}') {
      depth--
      if (depth === 0) {
        const raw = text
          .slice(idx, i + 1)
          .replace(/\s+/g, ' ')
          .trim()
        return raw.length > 240 ? `${raw.slice(0, 237)}…` : raw
      }
    }
  }
  return `${lineText(text, idx)} …`
}

/** 型 A:裸 git 派生(入口与形态与 bareGitCountOf 完全同一把尺子,避免两处漂移)。 */
export function detectBareGitSites(raw) {
  const text = hideComments(raw)
  const re = new RegExp(BARE_GIT_RE.source, 'g')
  const out = []
  for (const m of text.matchAll(re)) {
    out.push({
      kind: 'bareGit',
      line: lineOf(text, m.index),
      entry: m[1],
      verb: verbAt(text, m.index),
      inLoop: inLoopAt(text, m.index),
      snippet: callTextAt(text, m.index),
    })
  }
  return out
}

const PATH_BOUND_DECL_RE =
  /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=[^;\n]*['"]git(?:\.exe)?['"]\s*[;,)]?\s*$/gm

/** 型 B:常量绑裸 git,之后当派生首参用(两条同时成立才算债,与原尺子逐字同口径)。 */
export function detectPathBoundGitSites(raw) {
  const text = hideComments(raw)
  const out = []
  for (const m of text.matchAll(new RegExp(PATH_BOUND_DECL_RE.source, 'gm'))) {
    const name = m[1]
    const use = new RegExp(`\\(\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*,\\s*\\[`).exec(
      text,
    )
    const useIndex = use ? use.index : -1
    // 与原尺子同一道第二锚:没被当派生首参用过(如 'git' 只是目录名)⇒ 不算命中。
    if (useIndex < 0) continue
    out.push({
      kind: 'pathBound',
      line: lineOf(text, m.index),
      name,
      decl: lineText(text, m.index),
      useLine: lineOf(text, useIndex),
      useSnippet: lineText(text, useIndex),
      snippet: lineText(text, m.index),
    })
  }
  return out
}

/** 型 B 的计数出口:与原 `pathBoundGitCountOf` 同义,保证判据只有一份实现。 */
export const countPathBoundGit = (raw) => detectPathBoundGitSites(raw).length

/** 型 C:argv 形态的自拼 batch(cat-file 后紧跟 batch 子参数),与门里的 hasBatchCall 同靶。 */
const SELF_BATCH_RE = new RegExp(
  "['\"](cat-file)['\"]\\s*,\\s*['\"]--batch",
  'g',
)
export function detectSelfBatchSites(raw) {
  const text = hideComments(raw)
  const out = []
  for (const m of text.matchAll(SELF_BATCH_RE)) {
    out.push({
      kind: 'selfBatch',
      line: lineOf(text, m.index),
      snippet: lineText(text, m.index),
    })
  }
  return out
}

/** kind ⇒ 检测器(调用方只给 kind,避免把三种正则抄第二遍)。 */
export function detectSites(kind, raw) {
  if (kind === 'bareGit') return detectBareGitSites(raw)
  if (kind === 'pathBound') return detectPathBoundGitSites(raw)
  if (kind === 'selfBatch') return detectSelfBatchSites(raw)
  throw new Error(`未知棘轮类型 ${kind}(只认 bareGit / pathBound / selfBatch)`)
}

/** 骨架:批量读正文。这是本仓处理「每文件一次 git 子进程」的标准形态。 */
export const SKELETON_BATCH = `// ${HELP_IMPORT} 是 scripts/*.mjs 里的写法;模块本体 = ${HELP_MODULE}
import { listFaceFiles, catBatch } from '${HELP_IMPORT}'

// ① 一次枚举(不要逐目录/逐文件起进程;路径清单与判据同面同轮)
const rels = listFaceFiles(root, 'head', { paths: ['scripts'], timeout: 120000 })
// ② 一次 cat-file --batch 取完整批正文(层内已接管 stdio[0]=pipe / maxBuffer / 头解析)
const blobs = catBatch(root, rels.map((rel) => \`HEAD:\${rel}\`), { maxBuffer: 1 << 28 })

for (const rel of rels) {
  const text = blobs.get(\`HEAD:\${rel}\`) // 缺席 = null(不抛;该路径本就不存在)
  if (text === null) {
    // 按你的门自己的「未判定」出口处理(exit 2 / throw Undetermined),不得当成「没有违规」
    throw new Undetermined(\`取不到 HEAD:scripts/\${rel}:未判定,不能记为合规\`)
  }
  // …在这里做判定,循环体内不得再出现任何 git 派生
}`

/** 骨架:整面一次命令(状态/清单类),不要按文件循环调用。 */
export const SKELETON_ONE_SHOT = `import { gitRaw } from '${HELP_IMPORT}'

// 一次取完整面,再按路径查表;不要 for (const rel of rels) { git status -- rel }
const out = gitRaw(['status', '--porcelain', '-z'], root, { timeout: 120000 })
const entries = String(out || '').split('\\u0000').filter(Boolean)
const statusOf = (rel) => entries.find((e) => e.slice(3) === rel) ?? null // null = 干净/不适用
// 取不到 ⇒ gitRaw 抛 Undetermined(带 status / stderr);不得 catch 成 null 再当「没有」`

/** 骨架:单次命令/极少数必须拿二进制名的场景。 */
export const SKELETON_GIT_RAW = `import { gitRaw, gitBinary } from '${HELP_IMPORT}'

const out = gitRaw(['ls-files', '-z'], root, { timeout: 120000 })
// 若确实需要二进制名(极少):const GIT = gitBinary()  // = resolveGitBin() || 'git',绝对路径优先
// 不要写 const GIT = process.env.GIT_BIN || 'git'(兜底值仍是裸 'git',PATH 不通就静默失败)`

/** 骨架:走到层里的 batch 出口(自拼那套 stdio/maxBuffer/头解析全部由层负责)。 */
export const SKELETON_LAYER_BATCH = `import { catBatch, catBatchOids } from '${HELP_IMPORT}'

const specs = ['HEAD:scripts/a.mjs', 'HEAD:scripts/b.mjs']
const blobs = catBatch(root, specs, { maxBuffer: 1 << 28 }) // Map<spec, string|null>
const oids = catBatchOids(root, specs) // 需要 oid 时用它(与 catBatch 同轮同装箱)
// 不要再自己拼 cat-file 的子参数:stdio[0]=pipe / maxBuffer / 头解析三处本仓都真踩过`

function targetText(kind, site) {
  if (kind === 'pathBound') {
    return '删掉这条「裸名兜底」常量,派生处直接 gitRaw(...);若确实必须保留二进制名,改成 gitBinary()(内部走 resolveGitBin(),绝对路径优先)'
  }
  if (kind === 'selfBatch') {
    return '改用层里的 catBatch / catBatchOids(stdio[0]=pipe、maxBuffer floor、头解析、EBUSY 兜底都在层内)'
  }
  if (site.verb === 'show' || site.verb === 'cat-file') {
    return '一次 listFaceFiles 枚举 + 一次 catBatch 取完整批(不要在 for/map 里按文件派生)'
  }
  if (site.verb === 'status' || site.verb === 'diff' || site.verb === 'diff-index' || site.verb === 'ls-files') {
    return '整面一次 gitRaw(...) 后按路径查表,不要 for (const rel of rels) 调一次 status/diff'
  }
  return '改走 gitRaw(...)(绝对路径 git + 显式 stdio + quotepath + timeout + EBUSY 兜底都在层内)'
}

function whyText(kind, site) {
  if (kind === 'pathBound') {
    return '兜底值仍是裸 \'git\':服务账户 / GUI 宿主的 PATH 与交互终端不通(AGENTS §5b),所有派生会静默失败;型 A 的尺子看不见这一型,所以单列一条棘轮'
  }
  if (kind === 'selfBatch') {
    return '自拼 batch 要自己重写 stdio[0]=pipe / maxBuffer / 头解析;stdin 设成 ignore 时每个对象都「取不到」而 git 不报错,环境问题会被伪装成业务结论'
  }
  if (site.inLoop) {
    return '命中行疑似在循环体内:每个迭代起一个 git 子进程。真仓 / 清单一多就是 fork 风暴,EBUSY 病窗下会静默失败(结论假绿);同一类坑实测跑过 201 次 / >17 分钟'
  }
  return '裸 \'git\' 依赖 PATH(服务账户 / GUI 宿主下取不到);若这段被循环调用,还会退化成每文件一次子进程'
}

function skeletonFor(kind, site) {
  if (kind === 'pathBound') return `${SKELETON_GIT_RAW}\n\n// 若必须保留常量:\n// import { gitBinary } from '${HELP_IMPORT}'\n// const GIT = gitBinary()`
  if (kind === 'selfBatch') return SKELETON_LAYER_BATCH
  if (site.verb === 'show' || site.verb === 'cat-file') return SKELETON_BATCH
  if (site.verb === 'status' || site.verb === 'diff' || site.verb === 'diff-index' || site.verb === 'ls-files') {
    return SKELETON_ONE_SHOT
  }
  return SKELETON_GIT_RAW
}

/** 单条命中的完整文案(file:line + 当前写法 + 为什么红 + 应改成 + 骨架)。 */
export function formatSite(kind, file, site) {
  const lines = []
  const loop = kind === 'bareGit' && site.inLoop ? ' · 疑似在循环体内' : ''
  const verb = kind === 'bareGit' && site.verb ? ` · git ${site.verb}` : ''
  lines.push(`  · ${file}:${site.line}${verb}${loop}`)
  lines.push(`      当前写法:${site.snippet}`)
  if (kind === 'pathBound' && site.useLine) {
    lines.push(`      同一标识符被当派生首参:${file}:${site.useLine}  ${site.useSnippet}`)
  }
  lines.push(`      为什么红:${whyText(kind, site)}`)
  lines.push(`      应改成:${targetText(kind, site)}`)
  lines.push('      骨架(可直接抄):')
  for (const l of skeletonFor(kind, site).split('\n')) lines.push(`        ${l}`)
  return lines.join('\n')
}

/**
 * 把一次棘轮判红渲染成「逐文件、逐命中」的改法说明。
 *
 * @param {'bareGit'|'pathBound'|'selfBatch'} kind
 * @param {{file:string,text:string}[]} files 只传**判据面**(HEAD)原文;行号即该面行号
 * @returns {string} 没有命中时返回空串(调用方只在红时追加)
 */
export function explainDerivationRed(kind, files) {
  const groups = []
  for (const f of files) {
    if (typeof f?.text !== 'string') continue
    const sites = detectSites(kind, f.text)
    if (sites.length) groups.push({ file: f.file, sites })
  }
  if (!groups.length) return ''
  const head = [
    '────────────────────────── 判红即教改 ──────────────────────────',
    `统一承载层:${HELP_MODULE}(实测导出:${HELP_EXPORTS.join(' / ')})`,
    '行号口径:按 HEAD blob 计(与棘轮判据同面同轮);工作树改动可能让行号偏移,改前先在 HEAD 版定位。',
  ]
  const blocks = []
  for (const g of groups) {
    blocks.push(`✖ ${g.file}(${g.sites.length} 处)`)
    for (const s of g.sites) blocks.push(formatSite(kind, g.file, s))
  }
  const tail = [
    '骨架不是示意:scripts/lib/face-reader.mjs 的 listFaceFiles + catBatch 就是本仓收口门 251 / 244 时用的同一形态。',
    '不许把这条棘轮改成警告 / skip / 扩债务清单;要么迁层,要么用新证据重写该条债务的 why(§0.7)。',
  ]
  return [...head, ...blocks, ...tail].join('\n')
}

/**
 * 可复用的「一次枚举 + 一次 batch」入口:把「循环里逐文件取正文」压成固定两次派生。
 *
 * 这是给改造者的**运行期辅助函数**,不是文案:下一次写门时直接调它,不要再写
 * `for (const rel of rels) git show HEAD:<rel>`。
 *
 * @param {string} root 仓库根
 * @param {{face?:'head'|'staged', paths?:string[], maxBuffer?:number, timeout?:number}} opts
 * @returns {{face:string, rels:string[], specOf:(rel:string)=>string, blobs:Map<string,string|null>}}
 */
export function readFaceBlobs(root, opts = {}) {
  const face = opts.face ?? 'head'
  if (face !== 'head' && face !== 'staged') {
    throw new Error(`readFaceBlobs 只支持 head / staged 两面(收到 ${String(face)})`)
  }
  const paths = opts.paths ?? ['scripts']
  const rels = listFaceFiles(root, face, { paths, timeout: opts.timeout ?? 120000 })
  const specOf = (rel) => (face === 'head' ? `HEAD:${rel}` : `:0:${rel}`)
  const blobs = catBatch(root, rels.map(specOf), {
    maxBuffer: opts.maxBuffer ?? 1 << 28,
    ...(opts.timeout ? { timeout: opts.timeout } : {}),
  })
  return { face, rels, specOf, blobs }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
