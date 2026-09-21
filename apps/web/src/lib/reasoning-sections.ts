// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Reasoning 分节解析(P3 #33 思考分节标题化,2026-09-16 立,对标 Codex reasoning sections)。
 *
 * LLM 的 reasoning 是纯文本流,无结构化分节信号。本模块从文本形态推断分节:
 *  - **按空行切段**:reasoning 天然以空行分隔推理步骤(段落)
 *  - **显式标题优先**:段落首行若为 markdown 标题(## / ###),直接作为小节标题
 *  - **隐式标题**:无显式标题时取段落首行(剥掉列表符号/序号前缀)截断为标题
 *  - **降噪降级**:整体内容过短或仅一段时返回无标题单节,渲染层保持现状不添加噪音
 *
 * 纯前端零后端改动:reasoning 仍是一根字符串流,分段在渲染层即时计算
 * (段落数量级 ~10,每次 content 变化重算成本可忽略)。
 */

export interface ReasoningSection {
  /** 小节标题;空串 = 无标题(渲染层隐藏标题行) */
  title: string
  /** 小节正文(不含标题行;保留原始换行) */
  body: string
}

/** 段落长度超过该值才值得给标题(短段落加标题是纯噪音)。 */
export const REASONING_SECTION_MIN_BODY = 80

/** 隐式标题的最大字符数(超出截断)。 */
export const REASONING_TITLE_MAX = 24

/** 段落总数超过该值时只给前 N 段标题?——不限制:reasoning 段落天然有限,不做截断。 */

/** 剥掉首行的列表符号/序号前缀("1. " "- " "· " 等),让隐式标题干净。 */
function stripListPrefix(line: string): string {
  return line.replace(/^\s*(?:[-*·•]|\d+[.、)])\s*/, '')
}

/** 从段落提取标题与正文。 */
function buildSection(para: string): ReasoningSection {
  const lines = para.split('\n')
  const first = (lines[0] ?? '').trim()

  // 显式 markdown 标题(## / ###):标题行从正文剔除
  const mdMatch = first.match(/^#{1,4}\s+(.*)$/)
  if (mdMatch) {
    return {
      title: (mdMatch[1] ?? '').trim().slice(0, REASONING_TITLE_MAX),
      body: lines.slice(1).join('\n').trim(),
    }
  }

  const body = para.trim()
  // 短段落不值得加标题(渲染层对空标题隐藏标题行)
  if (body.length <= REASONING_SECTION_MIN_BODY) {
    return { title: '', body }
  }
  // 隐式标题:首行剥列表前缀后截断;若首行本身极长(如一整段无换行长文本),
  // 标题取截断,正文仍是完整段落
  const candidate = stripListPrefix(first)
  const title = (candidate.length > 0 ? candidate : body).slice(0, REASONING_TITLE_MAX).trim()
  return { title, body }
}

/**
 * 把 reasoning 累积文本切分为小节序列。
 *
 * @returns 始终至少返回 1 节;content 为空时返回空数组(渲染层零渲染)。
 *          标题是否显示由 title 是否为空决定,单段且不满足长度阈值时 title 为空。
 */
export function splitReasoningSections(content: string): ReasoningSection[] {
  if (!content || !content.trim()) return []
  // 按空行切段(容错 \r\n);段内保留原始换行
  const paras = content
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\r/g, ''))
    .filter((p) => p.trim().length > 0)
  if (paras.length === 0) return []
  return paras.map(buildSection)
}
