// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { stripInlineMarkdown } from './strip-inline-markdown'

/**
 * 会话默认标题 —— 与 `chat_conversations.title` 的 DB 默认值同值(`新对话`)。
 * 2026-11-23 上移到共享层:api 的「是否仍为默认标题(可自动覆盖)」判定与三端侧栏/面板的
 * 兜底显示都取这一份,避免出现「新对话」/「新会话」两套字面值各说各话。
 */
export const DEFAULT_CONVERSATION_TITLE = '新对话'

/**
 * 会话标题的「纯文本安全化」—— 全项目唯一一份(2026-11-23 立)。
 *
 * 存在理由(实测,不是假想):
 * 1. 让模型"只输出标题正文"不等于模型照做。GLM/DeepSeek 一类 reasoning 模型的开口是
 *    `1. **分析用户的请求:**`,有的还会把 `<think>…</think>` 一起吐出来;
 * 2. 会话列表是**纯文本渲染**(不是 Markdown 渲染,渲染了行高会被粗体/列表撑破),
 *    于是 `**`、行首编号、`(think)` 原样出现在用户眼前的标题里 —— 可感知的显示缺陷;
 * 3. 同一条规则要同时服务三个面:服务端落库前(api 的 sanitizeGeneratedTitle)、
 *    端内显示兜底(历史脏数据)、以及"拿首条消息截断当标题"的客户端。
 *    三处各写一份必然漂移(§3 共享层优先),判定与剥离只留这一份。
 *
 * 边界(刻意保守):
 * - 只做「能安全退化成纯文本」的处理,不做块级 Markdown 语法解析;
 * - 不碰正文里的合法符号:`C#`、`2*3` 这类内容不是标记,不能被剥成 `C` / `23`;
 * - 纯函数、零 IO、零副作用,失败方向是"留得更干净",绝不返回更脏的串。
 */

/** 成对思考块:整段是推理过程,不是标题 */
const THINK_BLOCK = /<(?:think|thinking|reasoning)[^>]*>[\s\S]*?<\/(?:think|thinking|reasoning)>/gi
/** 落单/被上游截断的思考标签 */
const THINK_TAG = /<\/?(?:think|thinking|reasoning)[^>]*>/gi
/** 内联思考标记 `(think)` / `[thinking]:`:必须是独立片段,不吃正文里的普通括号 */
const THINK_MARK = /(?:^|\s)(?:\(|\[)(?:think|thinking|reasoning)(?:\)|\])\s*[:：]?/gi
/** HTML 标签:标签名后必须跟空白/`>`/`/`,避免把 `<https://…>` 当标签吃掉 */
const HTML_TAG = /<\/?[a-z][a-z0-9-]{0,20}(?:\s[^>]*)?>/gi
/** 零宽字符、方向标记与软连字符(复制粘贴与模型输出里都会夹带) */
const INVISIBLE = /[\u200b-\u200f\u2060\ufeff\u00ad]/g
/** 控制字符(保留 \t 与 \n 交给单行化处理) */
const CONTROLS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g
/** Markdown 图片/链接:标题里只需要可读文字 */
const IMAGE = /!\[([^\]]*)\]\([^)]*\)/g
const LINK = /\[([^\]]+)\]\([^)]*\)/g
/** 行首块级标记:Markdown 标题 / 引用 / 无序列表 / 有序编号(中文顿号与句点都算) */
const LEADING_BLOCK = /^(?:#{1,6}\s+|>\s+|[-*+•·]\s+|\d{1,3}[.)、．]\s*)/
/** 首尾残留的孤立标记字符:只剥首尾,正文中间的 `2*3` 必须保留。
 * 刻意不含 `_`:单个下划线更可能是内容(工具名 `task_`、代码标识符),成对 `_斜体_`
 * 已由 stripInlineMarkdown 处理,这里再剥会把正文吃掉一截。 */
const LEADING_MARKS = /^[\s*~`]+/
const TRAILING_MARKS = /[\s*~`]+$/

/**
 * 「一句话就是模型把思考过程当答案」的开口 —— 前缀型命中即判废,不看长度
 * (英文套话本身就长,`Let me analyze the request` 25 个字符,按长度卡会漏)。
 * 判废的理由:这类句子写进标题栏等于给用户看"1. **分析用户的请求:**"洗掉符号后的残渣,
 * 既不是话题也不可检索 —— 宁可保持默认标题,也不写一条假标题入库。
 */
const COT_PREFIXES: readonly RegExp[] = [
  /^(let me|i'?ll|i will)\s+(analyze|analysis|think|consider)/i,
  /^we need to\b/i,
  /^(here'?s|here is)\s+(a|my)\s+(thinking|thought)/i,
  /^the user (is|wants|asked|said)/i,
]
/** 整串型套话(中文):短句才判,长句多半是真正的话题标题,不能一句"思考"就误杀 */
const COT_SHORT: readonly RegExp[] = [
  /^分析(一下)?(用户)?的?请求[。:：]?$/,
  /^分析(一下)?用户(的)?需求[。:：]?$/,
  /^理解(一下)?用户(的)?(请求|需求|意图)[。:：]?$/,
  /^用户(的)?(请求|需求|意图)(分析)?[。:：]?$/,
  /^(thinking|reasoning|thought process)$/i,
  /^思考(过程)?$|^分析过程$/,
  /^让我(先)?(分析|想|思考)/,
]
/** 套话判废的长度上限(仅用于 COT_SHORT) */
const COT_MAX_CHARS = 18

/**
 * 按**码位**截断标题。
 * 为什么不是 `slice(0, n)`:字符串长度是 UTF-16 码元数,emoji(代理对)占两位 ——
 * 在它中间切一刀会留下半个码元,标题栏渲染成一个"口"方块。标题全链路(生成侧 +
 * 显示侧 + 存量脚本)都必须走这一份,否则三处各切各的。
 */
export function clipTitleChars(text: string, maxChars: number): string {
  if (maxChars <= 0 || !text) return text
  const chars = Array.from(text)
  return chars.length <= maxChars ? text : chars.slice(0, maxChars).join('')
}

/**
 * 把任意来源的标题文本压成「可显示的纯文本」。
 *
 * @param raw 原始标题(模型输出 / 首条消息 / 历史脏值)
 * @param maxChars 截断上限;<=0 表示不截断(默认 0,由调用方决定自己的字数档)
 * @returns 干净的标题;整条都是噪音(思考块、套话、空白)时返回 null
 */
export function plainTitleText(raw: string, maxChars = 0): string | null {
  if (typeof raw !== 'string' || !raw) return null

  let text = raw
    .replace(THINK_BLOCK, ' ')
    .replace(THINK_TAG, ' ')
    .replace(THINK_MARK, ' ')
    .replace(HTML_TAG, ' ')

  // 单行化:取第一个非空行(思考块被整段剥掉之后,首行很可能已经是空的)
  const firstLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line !== '')
  if (!firstLine) return null

  text = firstLine.replace(IMAGE, '$1').replace(LINK, '$1')
  // 加粗标记无论成对还是落单都不属于标题:先整体剥掉,再把剩下的强调/行内代码交给共享实现
  // (共享实现会保护 URL 与行内代码里的 `_` / `*`,这里不重复它的规则)
  text = stripInlineMarkdown(text.replace(/\*\*/g, ''))

  // 行首块级标记可能叠了多层(`> - # 标题`):剥到不再命中为止
  let prev = ''
  while (prev !== text) {
    prev = text
    text = text.replace(LEADING_BLOCK, '').trim()
  }

  text = text
    .replace(/~~/g, '')
    .replace(/`/g, '')
    .replace(INVISIBLE, '')
    .replace(CONTROLS, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(LEADING_MARKS, '')
    .replace(TRAILING_MARKS, '')
    .trim()

  if (!text) return null
  if (COT_PREFIXES.some((re) => re.test(text))) return null
  if (text.length <= COT_MAX_CHARS && COT_SHORT.some((re) => re.test(text))) return null
  if (maxChars > 0) text = clipTitleChars(text, maxChars)
  return text
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
