// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 按 Unicode 字素簇(grapheme)截断字符串 —— BUG-52 统一出口。
 *
 * 根因:`String.prototype.slice(0, max)` 以 UTF-16 code unit 计数,会把 emoji / 增补汉字的
 * 代理对(surrogate pair)劈成两半,渲染成替换字符 U+FFFD(``)。
 * 本模块优先用 Intl.Segmenter 按字素簇切(组合 emoji / ZWJ 序列也不会被劈开),
 * 环境不支持时回退到 Array.from 按码位(code point)切,至少不劈代理对。
 *
 * `max` 以字素簇/码位计(不再以 code unit 计);返回值不含孤立代理项。
 */
export function truncateByGrapheme(text: string, max: number): string {
  if (!Number.isFinite(max) || max <= 0) return ''
  const chars = splitGraphemes(text)
  if (chars.length <= max) return text
  return chars.slice(0, max).join('')
}

/**
 * 按字素簇切分(唯一真相源出口)。
 *
 * D1c(2026-11-15):`Intl.Segmenter` 实例改为**模块级懒建单例** —— 旧实现每次调用都
 * `new Segmenter()`，流式切批层每提交帧调一次，等于白付构造成本(实测 5.9µs/次 × 417 帧不算致命,
 * 但同一实例可复用没有副作用,没有理由反复构造)。
 */
let segmenterCache: SegmenterInstance | null | undefined

function getSegmenter(): SegmenterInstance | null {
  if (segmenterCache !== undefined) return segmenterCache
  // 不依赖 lib 的 Intl.Segmenter 类型声明,避免 tsconfig lib 版本差异导致 tsc 报错。
  const Segmenter = (Intl as unknown as { Segmenter?: SegmenterCtor }).Segmenter
  segmenterCache =
    typeof Segmenter === 'function' ? new Segmenter(undefined, { granularity: 'grapheme' }) : null
  return segmenterCache
}

/**
 * **惰性**字素簇迭代器 —— 与 `splitGraphemes` 同一套分段真相源,区别只在"不展开整串"。
 *
 * D1c(2026-11-15 立,流式显示卡顿根治):`splitGraphemes` 用 `Array.from` 急切展开全串,
 * 代价随字符串长度线性;而流式打字机只需要"切点所在那一段"。切批层旧写法
 * `for (const seg of splitGraphemes(pending))` 会把**整个积压缓冲**重新分段一遍。
 * 稳定打字时 pending 很短,这一格看不出来;它咬人的形状是缓冲一旦积压变长:
 * ① 页签后台/被遮挡时 rAF 停拍,正文持续到达 ⇒ 缓冲攒整段回答;
 * ② 断点续传/重连接管把已生成前缀一次性回放回来;
 * ③ 产速高出"每帧 120 字"的消化上限。此时 align 随**全长**线性变慢,
 * 与 HEAD 原文同轮实测:pending=50k 单次 3.65ms(8ms 帧预算的近一半) vs 0.064ms,
 * 排空 50k 累计 732ms vs 16.1ms(45x)—— 表现就是"回到页面后那段回答一坨一坨蹦、越到后面越卡"。
 * 本迭代器让 for-of 在拿到目标簇后直接停止,引擎只推进到那儿,代价随**切点**而不是随全串。
 *
 * 分段口径与 `splitGraphemes` 逐字一致(同一实例、同一 granularity、同一兜底档)。
 */
export function* graphemeSegments(text: string): Generator<string> {
  const segmenter = getSegmenter()
  if (segmenter) {
    for (const item of segmenter.segment(text)) yield item.segment
    return
  }
  // 回退:按码位迭代,至少不会把代理对劈成两半(与 splitGraphemes 的回退档同源)
  for (const cp of text) yield cp
}

/** 与 truncateByGrapheme 同口径的长度(供"截断了多少字符"计数使用)。 */
export function graphemeLength(text: string): number {
  return splitGraphemes(text).length
}

/** 按字素簇切分(供切批层复用:流式打字机切点须落字素簇边界,与 BUG-52 同源)。 */
export function splitGraphemes(text: string): string[] {
  return Array.from(graphemeSegments(text))
}

type SegmenterCtor = new (
  locales?: string | string[],
  options?: { granularity?: 'grapheme' | 'word' | 'sentence' },
) => SegmenterInstance

type SegmenterInstance = { segment(input: string): Iterable<{ segment: string }> }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
