// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 水印"行级结构"的唯一识别实现。
 *
 * 为什么要有这个文件:同一件事(哪一行属于水印结构)此前只有 scripts/watermark.mjs 内部知道,
 * 而它必须被第二类调用方复用 —— 归档生成器把 PROJECT_PLAN.md 的条目正文整块搬进归档件时,
 * 若切片落点含住了计划文档自己的水印结构行,那些行就随正文一起被搬走(实测 HEAD 面上
 * 一份 34,580 行的归档件里躺着 4 行这样的孤隐写标记,且该文件通篇没有可见横幅)。
 * 在生成器里再抄一份正则 = 两处实现必漂移(本仓记过最多次的失效型),所以识别逻辑搬到这里,
 * 注入/清洗器与生成器共用同一份。
 *
 * 口径与 watermark.mjs 逐字同形(该文件已改为 import 本模块,不再自己写):
 *   - 横幅内容行:剥掉行首注释前缀后按**行首锚定**匹配三种形态(版权行 / 溯源声明行 / 载荷行)。
 *     锚定行首而不是全行搜索,是为了不误删源码里出现的同名常量与正则定义。
 *   - 隐写行:剥掉注释包裹后只剩零宽字符(U+200B / U+200C / U+200D / U+2060)。
 *     这是文件末尾那行不可见标记的形态,也是它被文本工具改坏之后的形态。
 */

// 版权行必须带品牌段,否则说明性文字里的一句 `// © 2026 IHUI AI · 某自检` 会被整行删掉
// (2026-09-22 实测 apps/api/scripts/verify-carrier.ts 即此型误删)。
export const BANNER_TEXT_RE =
  /^(?:©\s*\d{4}\s+IHUI\s+AI\s*\(智汇AI\)|Provenance-watermarked(?:\.|\s)|\[IHUI-AI-PROVENANCE\]\s*:)/

/** 行首注释前缀(斜杠斜杠 / 井号 / 双横线) */
const COMMENT_PREFIX_RE = /^\s*(\/\/|#|--)\s*/

/** 零宽字符族:ZWSP / ZWNJ / ZWJ / WORD JOINER */
const ZW_FAMILY = String.fromCodePoint(0x2060, 0x200b, 0x200c, 0x200d) // 哨兵 + ZWSP/ZWNJ/ZWJ
export const ZW_ONLY_RE = new RegExp('^[' + ZW_FAMILY + ']+$')

export function isBannerLine(line) {
  return BANNER_TEXT_RE.test(
    String(line ?? '')
      .trim()
      .replace(COMMENT_PREFIX_RE, ''),
  )
}

/**
 * 剥掉注释的**包裹**(行首前缀与行尾闭合符),露出这一行真正的内容。
 * 闭合符必须一起去剥,否则 `<!-- <零宽> -->` 这种尾部水印形态会被判成"还有内容"。
 */
export function unwrapComment(line) {
  return String(line ?? '')
    .trim()
    .replace(/^(?:\/\/|#|--|\/\*|\*|<!--)\s*/, '')
    .replace(/\s*(?:\*\/|-->)$/, '')
    .trim()
}

/** 这一行是不是"只有零宽字符"(即隐写载荷行本体) */
export function isInvisibleMarkLine(line) {
  return ZW_ONLY_RE.test(unwrapComment(line))
}

/**
 * 可见横幅(L1)的**规范文案**,逐字两份。
 *
 * 为什么搬到这一层:横幅文字此前只住在 `watermark.mjs` 里,而"这份文件到底有没有可见署名"
 * 这句话有两个消费者(注入器判幂等、旁路落地器判"横幅是不是被我抹的")。文字抄两份,
 * 改一处忘一处就会出现"注入器认为有、落地器认为没有"这类互相顶牛的结论(本仓同族教训)。
 */
export const CANONICAL_BANNER_LINES = [
  '© 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top',
  'Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。',
]

// 版权主张行:两种形态(版权行 / 溯源声明行)。刻意**不含**载荷标记那一行 ——
// 那行是 L2,它单独存在恰恰是"署名被抹掉而隐写还在"的指纹,不能算"有可见横幅"。
const COPYRIGHT_LINE_RE = /^(?:©\s*\d{4}\s+IHUI\s+AI\s*\(智汇AI\)|Provenance-watermarked(?:\.|\s))/

/** 这一行是不是**给人看的**版权主张行(剥掉注释前缀后按行首锚定) */
export function isCopyrightLine(line) {
  return COPYRIGHT_LINE_RE.test(
    String(line ?? '')
      .trim()
      .replace(COMMENT_PREFIX_RE, ''),
  )
}

/**
 * 文本里有没有一条**结构成立**的版权行(容忍标点/字形漂移)。
 *
 * 为什么不能按"规范文案逐字 in 文本"判:实测 `apps/ai-service/**` 的 Python 横幅写的是
 * `... NOTICE).`(ASCII 句点),而 JS 侧写 `... NOTICE)。`(ideo graphic 句点)—— 逐字比会把
 * 5 份**署名完好**的文件报成"无可见横幅",那是把人赶去改本来正常的横幅(假阳比漏报更贵)。
 */
export function hasVisibleCopyright(text) {
  return String(text ?? '')
    .split('\n')
    .some(isCopyrightLine)
}

/** 两份规范文案是否**逐字**在位(用于区分"本来就对"与"这次把它修对了") */
export function hasExactCanonicalBanner(text) {
  const t = String(text ?? '')
  return CANONICAL_BANNER_LINES.every((l) => t.includes(l))
}

/**
 * 文本里有没有**任何**水印痕迹(版权行 / 溯源声明行 / 载荷标记行,三者之一)。
 *
 * 为什么也要在这一层:旁路落地器要判"基线到底有没有过横幅",而它一度自己写了一份正则。
 * 两份判据一旦漂移,就会出现"注入器说有、落地器说没有"这类互相顶牛的放行与拦截 ——
 * 而这类分叉的账面表现永远是安静。
 */
export function hasAnyWatermarkTrace(text) {
  return /Provenance-watermarked|IHUI AI \(智汇AI\)|\[IHUI-AI-PROVENANCE\]:/.test(
    String(text ?? ''),
  )
}

/**
 * 这一行是不是水印结构行(横幅文案行 或 隐写载荷行)。
 * 生成器搬运正文时用这一条把水印结构剔除;它**不**判断载荷是否可解码(那是注入器的事)。
 */
export function isWatermarkStructureLine(line) {
  return isBannerLine(line) || isInvisibleMarkLine(line)
}

/**
 * 从一段正文里剔掉所有水印结构行。
 * @returns {{text:string, removed:number}} removed 必须由调用方如实报出 ——
 *   "搬走的东西比原文少了几行"这件事不得静默(§5e"失败必须响"同一条禁令)。
 */
export function stripWatermarkStructure(bodyText) {
  const lines = String(bodyText ?? '').split('\n')
  const keep = []
  let removed = 0
  for (const line of lines) {
    if (isWatermarkStructureLine(line)) {
      removed++
      continue
    }
    keep.push(line)
  }
  return { text: keep.join('\n'), removed }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
