// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 中文全角括号/标点的 autolink 收尾修正(2026-10-29 立)。
 *
 * ## 病灶(实测,不是推断)
 * GFM 的 literal autolink 只把 **ASCII** 标点当 URL 边界。中文正文里 URL 常被全角括号
 * 包住(`（见 https://example.com/a）`),parser 不认全角右括号 ⇒ 它被吞进 href:
 *
 * ```
 * "（见 https://example.com/a）"
 *   ⇒ <a href="https://example.com/a%EF%BC%89">https://example.com/a）</a>
 * ```
 * 点开即 404。六种全角括号族(`（）` `【】` `「」` `『』` `《》` `〈〉`)全部同型。
 *
 * ## 为什么选 **remark**(mdast 层)而不是 rehype(hast 层)
 * 决定性差异在"拿到的字符串形态":
 *   · mdast 的 `link.url` 是**原始字符**(`https://example.com/a）`),尾部判定直接看字符;
 *     链接文本 `children[0].value` 与它是同一份原文,两处同源可一起截短。
 *   · hast 的 `properties.href` 已被 `mdast-util-to-hast` 的 normalizeUri **百分号编码**
 *     (`https://example.com/a%EF%BC%89`)。在那一层剥尾必须先 decode 再判字符,
 *     而 decode/双重编码的任何偏差都会让判据"看起来对、实际切错" —— 失效方向不可控。
 * 另外本插件在 `remark-gfm` 之后、`remark-rehype` 之前运行,天然拿到 autolink 已产出的
 * `link` 节点,不需要自己再识别 URL 形态。
 *
 * ## 边界判据:成对判定(核心)
 * URL 内部**合法**含全角括号的情形必须保住,典型是维基百科的消歧义后缀:
 * `https://zh.wikipedia.org/wiki/中文（消歧义）` —— 尾部那个 `）` 是 URL 的一部分。
 *
 * 判据:准备剥掉末尾闭括号 `X`(配对开括号 `Y`)时,看**剥掉之后剩下那段**里
 * `count(Y) > count(X)` 是否成立 —— 成立说明剩下那段里还有未闭合的 `Y` 在等这个 `X`,
 * 即两者是配对的 ⇒ **不剥**;不成立说明这个 `X` 没有配对 ⇒ 它是正文标点 ⇒ 剥。
 *
 * ```
 * https://x.com/a（b）     剥前剩「https://x.com/a（b」:（=1 > ）=0 ⇒ 配对 ⇒ 不剥
 * https://example.com/a）   剥前剩「https://example.com/a」:（=0 = ）=0 ⇒ 无配对 ⇒ 剥
 * https://x.com/a（b））    末个 ）:剩「…a（b）」中（=1 = ）=1 ⇒ 无配对 ⇒ 剥;
 *                          再判前一个 ）:剩「…a（b」中（=1 > ）=0 ⇒ 配对 ⇒ 停
 * ```
 *
 * ## 失效方向
 * 一律向"不剥"倾斜:判不准的形态(空串、剥完短于最小 URL 长度)整体回退原值。
 * 宁可让 URL 尾巴多留一个全角括号,也绝不把 URL 本身切坏 —— 后者是 404,
 * 前者只是难看。
 */

/** 全角闭括号 → 其配对的开括号 */
export const CJK_TRAILING_CLOSERS: Readonly<Record<string, string>> = {
  '）': '（',
  '】': '【',
  '」': '「',
  '』': '『',
  '》': '《',
  '〉': '〈',
}

/**
 * 无配对概念的尾部全角标点。
 *
 * 刻意**不含** `～`/`·`/`—`:它们可能是 URL 内容的一部分(路径里合法),剥了就是切坏 URL。
 * `…` 也不收:与省略号相邻的 URL 极少见,收益不足以承担误剥风险。
 */
export const CJK_TRAILING_PUNCT: readonly string[] = ['。', '，', '、', '；', '：', '！', '？']

/** 剥完剩下的串短于此长度 ⇒ 认为判据不可信,整体不剥(失效方向:保留原样) */
const MIN_HREF_LENGTH = 9

/** 剥尾结果 */
export interface CjkTrimResult {
  /** 应当写回链接的 href(未发生剥离时与原值逐字节相同) */
  href: string
  /** 从 href 尾部剥下、应当还原成可见文本的部分(未剥离时为空串) */
  rest: string
}

function countOf(text: string, ch: string): number {
  let n = 0
  for (const c of text) if (c === ch) n += 1
  return n
}

const PUNCT_SET: ReadonlySet<string> = new Set(CJK_TRAILING_PUNCT)

/**
 * 把一个 href 尾部的"中文正文标点/全角闭括号"剥下来。
 *
 * 纯函数:不读时钟、不碰存储、不依赖 unified —— 判据可被单测直接钉住。
 */
export function trimCjkTrailingHref(href: string): CjkTrimResult {
  const unchanged: CjkTrimResult = { href, rest: '' }
  if (href === '') return unchanged

  let body = href
  let cut = 0

  // 阶段一:全角收尾(闭括号走成对判定,标点直接剥)
  while (body !== '') {
    const last = body.slice(-1)
    if (PUNCT_SET.has(last)) {
      body = body.slice(0, -1)
      cut += 1
      continue
    }
    const pairOpen = CJK_TRAILING_CLOSERS[last]
    if (pairOpen === undefined) break
    // 成对判定:剥掉之后那段里若还有未闭合的开括号在等它 ⇒ 它属于 URL 本身
    const withoutLast = body.slice(0, -1)
    if (countOf(withoutLast, pairOpen) > countOf(withoutLast, last)) break
    body = withoutLast
    cut += 1
  }

  // 阶段二:混排残尾(`「链接 (https://x.com/h)」`)
  //
  // 实测 GFM 对该形态给出 `https://x.com/h)」` —— 全角右括号被吞的同时,里面的**半角**
  // 右括号也被吞了。剥掉 `」` 后若不管,`href` 仍以落单的 `)` 结尾,点开照样 404。
  // 判据与全角同一条(剥后剩段里 `(` 多于 `)` ⇒ 那个 `)` 在等它,属 URL ⇒ 不剥),
  // 但**只在阶段一确实剥过东西时才执行** —— 纯 ASCII 文本的收尾行为因此一个字符都不变
  // (用户单独写 `https://x.com/a)` 不会因为我们而被改写)。
  if (cut > 0) {
    while (body.endsWith(')')) {
      const withoutLast = body.slice(0, -1)
      if (countOf(withoutLast, '(') > countOf(withoutLast, ')')) break
      body = withoutLast
      cut += 1
    }
  }

  if (cut === 0) return unchanged
  // 判据不可信档:剥完剩下的不足以构成一个 URL ⇒ 整体回退(失效方向:保留)
  if (body.length < MIN_HREF_LENGTH) return unchanged
  return { href: body, rest: href.slice(body.length) }
}

/** mdast 节点最小结构(本仓未直接依赖 @types/mdast,不为一处判据引入新依赖) */
interface MdastLikeNode {
  type: string
  value?: string
  url?: string
  children?: MdastLikeNode[]
}

function isTextNode(node: MdastLikeNode): boolean {
  return node.type === 'text' && typeof node.value === 'string'
}

/**
 * 就地把一个 link 节点的尾部标点剥掉,并同步截短"与 URL 等值的链接文本"。
 *
 * @returns 剥下来的字符;未发生剥离返回空串
 */
function trimLinkNode(link: MdastLikeNode): string {
  if (typeof link.url !== 'string') return ''
  const original = link.url
  const trimmed = trimCjkTrailingHref(original)
  if (trimmed.rest === '') return ''
  link.url = trimmed.href

  // autolink 的 children 就是"URL 原文"这一个 text 节点(实测 remark-gfm 形态);
  // 同步截短它,否则 href 干净了但屏幕上仍然把全角括号画在链接里(蓝色下划线还在)。
  // 判据用"以被剥部分结尾"而不是"等值":显式链接 `[文档](url）)` 的文本是「文档」,
  // 不含 URL 后缀 ⇒ 天然不动,不需要区分两种来源。
  const kids = link.children
  if (kids !== undefined && kids.length > 0) {
    const last = kids[kids.length - 1]
    if (last !== undefined && isTextNode(last) && last.value !== undefined) {
      if (last.value.endsWith(trimmed.rest)) {
        last.value = last.value.slice(0, last.value.length - trimmed.rest.length)
      }
    }
  }
  return trimmed.rest
}

/** 遍历 + 就地改写:先收集(深度优先),再按 parent 从后往前插,避免下标漂移 */
function collectLinks(
  node: MdastLikeNode,
  out: Array<{ parent: MdastLikeNode; index: number; node: MdastLikeNode }>,
): void {
  const kids = node.children
  if (kids === undefined) return
  for (let i = 0; i < kids.length; i += 1) {
    const child = kids[i]
    if (child === undefined) continue
    if (child.type === 'link') out.push({ parent: node, index: i, node: child })
    collectLinks(child, out)
  }
}

/**
 * remark 插件:把中文正文里被 GFM 吞进 href 的全角闭括号/标点剥回正文。
 *
 * 注册方式(本仓 `markdown-stream.tsx` 三处 remarkPlugins 同批):
 * `remarkPlugins={[[remarkGfm, { singleTilde: false }], remarkMath, remarkTrimCjkAutolink]}`
 */
export function remarkTrimCjkAutolink() {
  return (tree: MdastLikeNode): void => {
    const found: Array<{ parent: MdastLikeNode; index: number; node: MdastLikeNode }> = []
    collectLinks(tree, found)
    if (found.length === 0) return

    // 倒序处理:同一 parent 内插入兄弟节点不会让尚未处理的更早下标失效
    for (let i = found.length - 1; i >= 0; i -= 1) {
      const hit = found[i]
      if (hit === undefined) continue
      const rest = trimLinkNode(hit.node)
      if (rest === '') continue
      const kids = hit.parent.children
      if (kids === undefined) continue
      // 剥下来的部分还原成普通文本,紧跟在链接之后(不进链接内部,否则仍算链接文本)
      kids.splice(hit.index + 1, 0, { type: 'text', value: rest })
    }
  }
}

export const __test__ = {
  countOf,
  trimLinkNode,
  collectLinks,
  MIN_HREF_LENGTH,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
