// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * generated-input-pin.mjs —— 生成物「自述钉」的唯一实现(G-680)
 *
 * 为什么要有它(本仓实录过两次的那一型):
 *   ① i18n 离线包长期「产物存在但内容是旧的」,只有 release 才发现(守门 105 头注);
 *   ② 改 src 后产物只动时间戳 —— 生成器读的是 dist 而不是 src,
 *      判「真的按这份输入重新生成过」的唯一办法,是产物里带着由输入算出来的钉。
 * 「文件存在」不等于「内容是新的」;「内容是新的」必须由产物自己说清楚,而不是靠 mtime 猜。
 *
 * 钉的形态(全部是注释行,零宽字符不参与 —— 水印链只认自己的横幅锚点,互不打扰):
 *   // IHUI-GEN-PIN-BEGIN
 *   // generator: <被审面上的生成器路径>
 *   // sourceCommit: <生成时 HEAD 的 sha,取不到写 unknown>
 *   // inputsSha256: <整张输入清单的聚合哈希>   ← 陈旧判据**只看这一维**
 *   // input: <rel> <sha256>                     ← 逐条点名「读的是哪些输入文件」
 *   // generatedAt: <ISO 时刻>                   ← 唯一非确定性行,既不参与判据也不参与幂等比对
 *   // IHUI-GEN-PIN-END
 *
 * 幂等性(AGENTS §5c「注入是幂等的、往返零漂移」在本票的对应物):
 *   时刻行**必须**被排除在逐字节比对之外 —— 否则「重跑两次产物相同」这条断言永远不可能成立,
 *   而它正是本票的生命线。取的不是「把时间戳去掉」而是「把它留在钉里但隔离」:
 *   人会问「这产物什么时候生成的」,判据回答的是「这产物是不是按当前输入生成的」,两问不同形。
 *   比对出口 = maskGeneratedAt():只把时刻的值折成占位符,其余字节一字不动。
 *
 * 面一致性(守门 118/101 那一族):钉里的哈希与被审内容必须由**同一个面**算出。
 *   本模块只算哈希、不读文件 —— 读谁、从哪个面读由调用方(generator=磁盘 / 门=HEAD 或索引)决定。
 *   因此两侧必须做同一层字节归一(剥 BOM + CRLF→LF):同一份内容在「Windows 检出带 CRLF 的磁盘」
 *   与「git blob(LF)」上归一后同哈希,否则门会在自己没坏的世界上恒红。
 */

import { createHash } from 'node:crypto'

export const PIN_BEGIN = 'IHUI-GEN-PIN-BEGIN'
export const PIN_END = 'IHUI-GEN-PIN-END'
export const DIGEST_FIELD = 'inputsSha256'
export const GENERATED_AT_FIELD = 'generatedAt'
/** 时刻行的占位符:比对幂等时把真实时刻折成它 */
export const GENERATED_AT_MASK = '<masked>'

/** 字节归一:剥 UTF-8 BOM、CRLF/CR → LF。这是钉的唯一归一实现,两侧都经它。 */
export function normalizeInputBytes(text) {
  return String(text).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

export function sha256Hex(text) {
  return createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex')
}

/**
 * 输入清单 → 逐条哈希 + 聚合哈希。
 * @param {Array<{rel:string, text:string|null}>} inputs text=null 表示该输入在面上不存在
 * @returns {{perInput: Array<{rel:string, sha:string|'ABSENT'}>, digest: string}}
 */
export function digestInputs(inputs) {
  const perInput = inputs
    .map((i) => ({ rel: i.rel, sha: i.text === null ? 'ABSENT' : sha256Hex(normalizeInputBytes(i.text)) }))
    .sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0))
  const manifest = perInput.map((i) => `${i.rel}\u0000${i.sha}\u0000`).join('')
  return { perInput, digest: sha256Hex(manifest) }
}

/**
 * 渲染钉块(返回不含行尾符的行数组,调用方自己拼)。
 * @param {{generator:string, sourceCommit?:string, inputs:Array<{rel:string,text:string|null}>, generatedAt:string, extraLines?:string[]}} opts
 *   extraLines(G-816040):非判据的自述行(skipped 计数等),逐条渲染成 `// <内容>`。
 *   parsePin 按字段名取值,多出的行不参与判据;放钉块内 = 「哪些没搬进来」与输入清单同块自述。
 */
export function renderPin({ generator, sourceCommit, inputs, generatedAt, extraLines = [] }) {
  const { perInput, digest } = digestInputs(inputs)
  const lines = [
    `// ${PIN_BEGIN}`,
    `// generator: ${generator}`,
    `// sourceCommit: ${sourceCommit || 'unknown'}`,
    `// ${DIGEST_FIELD}: ${digest}`,
  ]
  for (const i of perInput) lines.push(`// input: ${i.rel} ${i.sha}`)
  for (const extra of extraLines) lines.push(`// ${extra}`)
  lines.push(`// ${GENERATED_AT_FIELD}: ${generatedAt}`)
  lines.push(`// ${PIN_END}`)
  return lines
}

/**
 * 稳定钉:在 renderPin 之上加一条「输入未变则沿用旧钉」的收敛规则。
 *
 * 立因(2026-11-11 实测,量化):`generatedAt` 取 `new Date()`、`sourceCommit` 取当前 HEAD,
 * 两者**每跑一次都变** ⇒ 即使输入一字未改,产物字节也必变 ⇒ 新 blobOid ⇒ 落点账本判可收编
 * ⇒ `auto-commit-quiet` 落一枚"派生产物按 HEAD 面重生成并落地"的提交,而 HEAD 一变
 * `sourceCommit` 又变 ⇒ 下一轮再来。全史已积 209 枚同形提交(其中 2026-11-11 01:06/01:12 两枚
 * 间隔 6 分钟),是「重生成 → 收编」自激链的发动机。
 *
 * 口径依据:本文件头注已写明这两个字段「既不参与判据也不参与幂等比对」,而当时只做了
 * 比对侧(maskGeneratedAt),**写入侧没跟上**。本函数把同一口径补到写入侧:
 * 当现有产物里的 `inputsSha256` 与本次现算一致(generator 同名、钉完好)时,
 * 沿用它记录的 sourceCommit / generatedAt ⇒ 输入未变则产物**逐字节不变** ⇒ 不产生新 blobOid。
 *
 * 语义仍是准确的:generatedAt 从此表示「这份内容最后一次真正变化的时刻」,比"每次重跑的时刻"更有信息量。
 * 输入一变(哈希不同)则照常渲染新钉,行为与 renderPin 完全一致。
 *
 * @param {{generator:string, sourceCommit?:string, inputs:Array<{rel:string,text:string|null}>, generatedAt:string, extraLines?:string[], existingText?:string|null}} opts
 *   existingText:目标产物当前磁盘内容(不存在传 null);其余字段同 renderPin。
 */
export function renderStablePin({ existingText = null, ...opts }) {
  if (existingText) {
    const prev = parsePin(existingText)
    if (prev.present && !prev.malformed && prev.generator === opts.generator) {
      const { digest } = digestInputs(opts.inputs)
      if (prev.digest === digest) {
        return renderPin({ ...opts, sourceCommit: prev.sourceCommit, generatedAt: prev.generatedAt })
      }
    }
  }
  return renderPin(opts)
}

/**
 * 从产物文本里取钉。
 * @returns {{present:boolean, malformed:boolean, reason?:string, digest:?string, perInput:Array<{rel:string,sha:string}>, generator:?string, sourceCommit:?string, generatedAt:?string}}
 *   present=false ⇒ 面上没有钉(判「未判定」,不是通过也不是红);
 *   malformed=true ⇒ 钉在但读不出聚合哈希(同样判「未判定」—— 判不出不是「不陈旧」)。
 */
export function parsePin(text) {
  const empty = { present: false, malformed: false, digest: null, perInput: [], generator: null, sourceCommit: null, generatedAt: null }
  if (typeof text !== 'string' || text.length === 0) return empty
  const b = text.indexOf(PIN_BEGIN)
  const e = text.indexOf(PIN_END)
  if (b === -1 && e === -1) return empty
  if (b === -1 || e === -1 || e < b) {
    return { ...empty, present: true, malformed: true, reason: '钉的 BEGIN/END 不成对或被截断' }
  }
  const block = text.slice(b, e)
  const field = (key) => {
    const m = new RegExp(`^[ \\t]*\\/\\/?[ \\t]*${key}:[ \\t]*(\\S[^\\r\\n]*)[ \\t]*$`, 'm').exec(block)
    return m ? m[1].trim() : null
  }
  const digest = field(DIGEST_FIELD)
  const generatedAt = field(GENERATED_AT_FIELD)
  const perInput = []
  const inputRe = /^[ \t]*\/\/?[ \t]*input:[ \t]*(\S+)[ \t]+(\S+)[ \t]*$/gm
  let m
  while ((m = inputRe.exec(block)) !== null) perInput.push({ rel: m[1], sha: m[2] })
  if (!/^[0-9a-f]{64}$/.test(digest || '')) {
    return {
      present: true,
      malformed: true,
      reason: `钉里的 ${DIGEST_FIELD} 不是 64 位十六进制(实得 ${String(digest).slice(0, 24)})`,
      digest: null,
      perInput,
      generator: field('generator'),
      sourceCommit: field('sourceCommit'),
      generatedAt,
    }
  }
  return {
    present: true,
    malformed: false,
    digest,
    perInput,
    generator: field('generator'),
    sourceCommit: field('sourceCommit'),
    generatedAt,
  }
}

/** 逐条输入哈希里与现算不一致的那些(给红点报名用;钉未列逐条时返回空数组) */
export function differingInputs(parsed, computedPerInput) {
  if (!Array.isArray(parsed.perInput) || parsed.perInput.length === 0) return []
  const byRel = new Map(computedPerInput.map((i) => [i.rel, i.sha]))
  const out = []
  for (const p of parsed.perInput) {
    const now = byRel.get(p.rel)
    if (now === undefined || now !== p.sha) out.push({ rel: p.rel, pinned: p.sha, actual: now ?? 'ABSENT' })
  }
  for (const c of computedPerInput) {
    if (!parsed.perInput.some((p) => p.rel === c.rel)) out.push({ rel: c.rel, pinned: '(钉里没列)', actual: c.sha })
  }
  return out
}

/**
 * 幂等比对出口:把时刻行的值折成占位符,其余字节一字不动。
 * 只折「generatedAt:」这一处;BEGIN/END、哈希、清单行都是确定性内容,归一化不得碰它们。
 */
export function maskGeneratedAt(text) {
  return String(text).replace(
    /(^|\n)([ \t]*\/\/?[ \t]*generatedAt:[ \t]*)[^\r\n]*/g,
    (_all, lead, key) => `${lead}${key}${GENERATED_AT_MASK}`,
  )
}

export const __test__ = { normalizeInputBytes, sha256Hex, digestInputs, renderPin, parsePin, differingInputs, maskGeneratedAt }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
