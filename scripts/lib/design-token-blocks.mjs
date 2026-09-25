// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * design-token-blocks.mjs — `packages/design-tokens/src/styles/tokens.css` 的取块/取值**唯一实现**。
 *
 * 为什么要有这个文件(2026-09-25 立,全部由实测逼出):同一个"从 tokens.css 读 --color-* 真值"的动作
 * 原本写了两份,而且**判据不同形** ——
 *   - 守门 `scripts/check-rn-global-css-sync.mjs` 合并**所有** `@theme` + `:root` 块,但**不剥注释**;
 *     小程序那道 `scripts/check-miniapp-tokens-sync.mjs` 剥了(见其 :55-57)。同一判据两处不同形,
 *     正是本仓反复记录的成因(注释被当数据这一族已咬过两次:R6 的 `bg-muted/40` 假用量)。
 *   - 生成器 `scripts/sync-rn-global-css.mjs` 用 `/@theme\s*\{([\s\S]*?)\}/` 只取**首个非贪婪**块,
 *     漏掉 tokens.css 第 326/341/407… 行的后续 `:root` 块 —— 里面正是 `--color-*-rgb` 三元组
 *     (alpha 通道,守门 93 R6 要求每档必备)。实测:接上提交链跑一次,这 3 行被"同步"删除。
 *
 * 所以:读源只能经本文件;生成器与守门共用一份实现。两处各写一遍 = 其中一遍必然腐烂。
 */

/** 平衡括号取出某个选择器的**全部**块(按文档顺序,后者覆盖前者)。 */
export function extractAllBlocks(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(^|\\n)\\s*${escaped}\\s*\\{`, 'g')
  const blocks = []
  let m
  while ((m = re.exec(css)) !== null) {
    const openAt = m.index + m[0].length
    let i = openAt
    let depth = 1
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth++
      else if (css[i] === '}') depth--
      i++
    }
    blocks.push(css.slice(openAt, i - 1))
    re.lastIndex = i
  }
  return blocks
}

/** 删掉块注释。注释里的 `--xxx: 说明文字` 会被变量正则当成真值,必须先处理。 */
export function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '')
}

/**
 * 把块注释**等长替换**成空格(换行保留),得到与原文下标一一对应的遮罩文本。
 *
 * 为什么等长而不是删:原位写回必须按命中下标切原文(值会跨行,例如 `linear-gradient(` 分多行),
 * 删注释会让下标错位。而**行级**正则根本看不见跨行声明 —— 2026-09-25 实测:那 6 个渐变档每次同步
 * 都被判成"本文件尚缺"再补一遍,幂等破功、块越写越长。遮罩 + 按 `;` 边界扫是唯一同时满足
 * "看得见跨行声明 / 不把注释当数据"的取法。
 */
export function maskComments(text) {
  let out = ''
  let inComment = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (!inComment && c === '/' && text[i + 1] === '*') {
      inComment = true
      out += '  '
      i++
      continue
    }
    if (inComment) {
      if (c === '*' && text[i + 1] === '/') {
        inComment = false
        out += '  '
        i++
        continue
      }
      out += c === '\n' ? '\n' : ' '
      continue
    }
    out += c
  }
  return out
}

/** 从块正文抽 `--xxx: value` 声明,返回 `[{ name, value }]`(值内空白归一,按出现顺序)。 */
export function collectDecls(blockText) {
  const out = []
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g
  for (const match of stripComments(blockText).matchAll(re))
    out.push({ name: match[1], value: match[2].replace(/\s+/g, ' ').trim() })
  return out
}

/**
 * 按选择器集合合并出"该档案的最终真值表"(Map,同名后者覆盖前者)。
 * 用法:light = `['@theme', ':root']`,dark = `['.dark']`。
 * 必须**全量合并所有同名块**并保留文档顺序,否则后续 `:root` 块(含 `--color-*-rgb` 三元组、
 * 透明度色板、业务品牌色)会被整段漏掉。
 */
export function collectVars(css, selectors) {
  const map = new Map()
  for (const sel of selectors)
    for (const block of extractAllBlocks(css, sel))
      for (const d of collectDecls(block)) map.set(d.name, d)
  return map
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
