#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * face-spec-scan.mjs —— 「面规格拼写」静态识别的唯一实现(2026-11-07)
 *
 * 病根:本仓一日之内出现了 6+ 次同一型事故 —— **取不到输入被当成没有输入**。
 * 其中三条的直接成因是门脚本自己手拼 rev/spec:
 *   · `scripts/check-guarded-write-affected.mjs:360` `staged: ':'` + `${rev}:${file}` ⇒ `::path`
 *   · `scripts/check-generator-resource-release.mjs:702` `${face === 'staged' ? '' : 'HEAD:'}${p}`
 *   · `scripts/check-readout-no-break.mjs:288` `readAt(':!0', p)` ⇒ `:!0:<path>`
 *
 * 统一出口是 `scripts/lib/face-reader.mjs` + `scripts/lib/gate-face.mjs`:
 * 索引面 spec 是 `:<path>`,HEAD 面是 `HEAD:<path>`,worktree 面读磁盘。
 * 本文件只做**识别**(不读 git、不改代码),给 `check-face-spec-hardcode.mjs` 与镜像测试共用,
 * 避免"判据在门里再抄一份"(§22c)。
 *
 * 判据刻意保守:只认**可直接定位**的拼接/插值形态;命中即报,提示改用统一面规格 helper。
 * 注释里的示例不算命中(经 `maskCommentsKeepLayout` 遮噪;等长空白替换,行号不漂)。
 */

import { scanSpans } from './code-mask.mjs'

/**
 * 只遮注释、**保持字节位置与换行**的遮噪层。
 * 为什么不用 `code-mask.mjs` 的 `maskComments`:它把行注释整段删除(连同行尾换行),
 * 令牌会跨行粘连、行号会漂 —— 本层的用途恰恰是"报出准确行号",不能接受漂移。
 * 这里把注释内非换行字符逐位换成空格,原文件长度与行号 1:1 对齐。
 */
export function maskCommentsKeepLayout(src) {
  if (typeof src !== 'string') return ''
  let out = ''
  let pos = 0
  for (const s of scanSpans(src)) {
    if (s.kind !== 'line' && s.kind !== 'block') continue
    out += src.slice(pos, s.start)
    out += src.slice(s.start, s.end).replace(/[^\n]/g, ' ')
    pos = s.end
  }
  return out + src.slice(pos)
}

/**
 * 每条都给一个可执行的整改方向;门报红时原样打印,避免"只说错不说怎么改"。
 * `re` 一律带 `g` 标志(本层按 occurrence 逐条取位置)。
 */
export const SPEC_PATTERNS = Object.freeze([
  {
    id: 'head-prefix-concat',
    label: "HEAD: 前缀与变量拼接",
    re: /['"]HEAD:['"]\s*\+/g,
    hint: '改用 unified face helper(`lib/gate-face.mjs` 的 readFaceOne/readFaceBatch,或 `lib/face-reader.mjs` 的 catBatch + `HEAD:<path>` 单点拼装)。',
  },
  {
    id: 'head-prefix-template',
    label: '模板串里把面名塞进 HEAD: 前缀',
    re: /\$\{[^}\n]*'HEAD:'[^}\n]*\}\s*\$\{/g,
    hint: '面规格应在 helper 内按 face 一次性生成;门里不得用三元/条件表达式拼 rev 前缀。',
  },
  {
    id: 'staged-bang-rev',
    label: '索引面非法 rev `:!0`',
    re: /['"]:!0['"]/g,
    hint: '索引面合法 spec 是 `:<path>`(stage 0);`:!0` 不是合法 rev,git 会 fatal,取不到会被当成"没有"。',
  },
  {
    id: 'staged-colon-map',
    label: '把 staged 面映射成裸冒号 `:` 再拼 `${rev}:`',
    re: /\bstaged\s*:\s*['"]:['"]\s*[,\n}]?/g,
    /**
     * 同对象里其它面的 rev 值**自带尾冒号**(如 `head: 'HEAD:'`)时,该写法按"值含冒号"约定拼接
     * (`${FACE_REV[face]}${path}`),不会再产生 `::path`。实测 2026-11-07 已有门改成这一形态
     * (`check-readout-no-break.mjs`),它是**正确**的;不设这条会把它误报成新增违规。
     */
    skip: (masked, index) => {
      const obj = enclosingBraces(masked, index)
      const vals = [...obj.matchAll(/:\s*['"]([^'"]*)['"]/g)].map((x) => x[1])
      return vals.length > 0 && vals.every((v) => v.endsWith(':'))
    },
    hint: '映射值 `:` 与 `${rev}:${file}` 相连会得到 `::<path>`;索引面请直接拼 `:<path>`,不要经过 rev 变量。',
  },
  {
    id: 'double-colon-concat',
    label: '`::` 双冒号拼接',
    re: /['"]::['"]\s*\+/g,
    hint: '索引面 spec 只有一个冒号;`::<path>` 不是合法 spec,取不到会被当成"没有"。',
  },
  {
    id: 'bare-path-ternary',
    label: 'staged 面退化成裸路径(空字符串前缀)',
    re: /\?\s*['"]\s*['"]\s*:\s*['"]HEAD:['"]/g,
    hint: '裸路径交给 `cat-file --batch` 会被当成对象名而不是索引条目;索引面必须显式 `:<path>`。',
  },
])

/** 取 `index` 所在的最近一对花括号之间的原文(用于判断 rev 映射的写法约定)。 */
function enclosingBraces(text, index) {
  const open = text.lastIndexOf('{', index)
  if (open === -1) return ''
  const close = text.indexOf('}', index)
  if (close === -1) return text.slice(open)
  return text.slice(open, close + 1)
}

/** 按行号取一行原文;越界返回空串。 */
function lineAt(text, index) {
  let line = 1
  for (let i = 0; i < index && i < text.length; i++) if (text[i] === '\n') line++
  const start = text.lastIndexOf('\n', index - 1) + 1
  const end = text.indexOf('\n', index)
  return { line, snippet: text.slice(start, end === -1 ? text.length : end).trim() }
}

/**
 * 扫一段源码,返回命中清单。
 * @param {string} text
 * @param {{file?:string}} [opts]
 * @returns {Array<{file:string, patternId:string, label:string, line:number, snippet:string, hint:string}>}
 */
export function scanFaceSpecText(text, { file = '' } = {}) {
  if (typeof text !== 'string' || text.length === 0) return []
  const masked = maskCommentsKeepLayout(text)
  const hits = []
  for (const p of SPEC_PATTERNS) {
    p.re.lastIndex = 0
    let m
    while ((m = p.re.exec(masked)) !== null) {
      if (p.skip && p.skip(masked, m.index)) continue
      const at = lineAt(text, m.index)
      hits.push({ file, patternId: p.id, label: p.label, line: at.line, snippet: at.snippet, hint: p.hint })
      if (m[0].length === 0) p.re.lastIndex++
    }
  }
  return hits.sort((a, b) => (a.line === b.line ? a.patternId.localeCompare(b.patternId) : a.line - b.line))
}

/**
 * 给命中打稳定指纹:同文件同 pattern 的 occurrence 序号。
 * 不按行号钉 —— 代码移位会把存量误报成新增;序号在"只增不删"的仓里更稳。
 * @param {Array<{file:string,patternId:string}>} hits
 * @returns {Array<object & {key:string, ordinal:number}>}
 */
export function fingerprintHits(hits) {
  const counters = new Map()
  return (hits || []).map((h) => {
    const base = `${h.file}|${h.patternId}`
    const ordinal = (counters.get(base) || 0) + 1
    counters.set(base, ordinal)
    return { ...h, ordinal, key: `${base}|${ordinal}` }
  })
}

/**
 * 与基线对账:基线内 = 存量(只报数),基线外 = 新增(判红)。
 * @param {Array<{key:string}>} fingerprinted
 * @param {Set<string>|string[]} baselineKeys
 */
export function splitByBaseline(fingerprinted, baselineKeys) {
  const base = baselineKeys instanceof Set ? baselineKeys : new Set(baselineKeys || [])
  const stock = []
  const fresh = []
  for (const h of fingerprinted || []) (base.has(h.key) ? stock : fresh).push(h)
  return { stock, fresh }
}

/** 基线文件条目的规范形态(门与测试共用,避免两边各判一套形状)。 */
export function baselineKeysFrom(entries) {
  if (!Array.isArray(entries)) return new Set()
  return new Set(entries.map((e) => (typeof e === 'string' ? e : e?.key)).filter(Boolean))
}

export const __test__ = { scanFaceSpecText, fingerprintHits, splitByBaseline, baselineKeysFrom, lineAt }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
