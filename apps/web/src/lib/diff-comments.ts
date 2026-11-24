// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Diff 评审意见 → agent 上下文注入文本(P3 #30 diff 评论驱动返工,2026-09-16 立)。
 *
 * 链路:用户在 InlineDiffCard 上评论 → chat store `pendingDiffComments` 暂存
 * → 下一轮 sendMessage 时本模块把队列格式化为 `<diff_review>` 块拼到 llmText 尾部
 * → agent 收到带定位信息(文件 + 行号 + 原行内容)的返工指令 → 注入后清空队列。
 *
 * 设计取舍:
 *  - **用 XML 标签包裹**:与仓库既有的 `<workspace_memory>` / `<repo_wiki>` /
 *    `_inject_*` 注入约定一致,LLM 对该形态的语义边界识别稳定,不会与用户正文混淆。
 *  - **按文件分组**:同一文件的多条意见聚在一起,agent 可按文件批量返工,减少往返。
 *  - **行号升序**:便于 agent 由上至下顺序修改(逆序修改会使行号漂移)。
 *  - **块内不掺 UI 文案**:正文用简短中文标签,避免 i18n 文案(如"待确认")污染指令语义。
 */

import type { DiffComment } from '@/stores/chat'

/** 单条被评论行内容的截断长度(够 agent 定位,又不至于撑爆上下文)。 */
export const DIFF_COMMENT_LINE_TEXT_MAX = 200

/** 注入块总长度上限(超出时按文件顺序截断,保证不挤占用户正文的上下文预算)。 */
export const DIFF_REVIEW_BLOCK_MAX = 8000

/** 单个文件的意见条数上限(极端场景兜底,正常交互远达不到)。 */
export const DIFF_REVIEW_MAX_PER_FILE = 20

/** XML 标签名(与 _inject_* 系列注入块命名风格一致)。 */
export const DIFF_REVIEW_TAG = 'diff_review'

/** 截断单行代码文本,去除首尾空白并折叠内部连续空白(多行缩进代码在注入里占位过多)。 */
function truncateLineText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, DIFF_COMMENT_LINE_TEXT_MAX)
}

/** 文件分组结构(保持首次出现顺序,组内按行号升序)。 */
interface FileGroup {
  filePath: string
  /** 文件级评论(无行号) */
  fileLevel: DiffComment[]
  /** 行级评论,按 line 升序 */
  lineLevel: DiffComment[]
}

function groupByFile(comments: DiffComment[]): FileGroup[] {
  const order: string[] = []
  const map = new Map<string, FileGroup>()
  for (const c of comments) {
    const text = c.comment.trim()
    if (!text) continue
    let group = map.get(c.filePath)
    if (!group) {
      group = { filePath: c.filePath, fileLevel: [], lineLevel: [] }
      map.set(c.filePath, group)
      order.push(c.filePath)
    }
    if (typeof c.line === 'number') group.lineLevel.push(c)
    else group.fileLevel.push(c)
  }
  for (const g of order.map((p) => map.get(p)!)) {
    g.lineLevel.sort((a, b) => (a.line ?? 0) - (b.line ?? 0))
  }
  return order.map((p) => map.get(p)!)
}

/**
 * 把待发送的 diff 评审意见格式化为可注入 LLM 的文本块。
 *
 * @returns 无有效评论时返回空串(调用方据此跳过注入,零副作用)。
 */
export function formatDiffCommentsForLLM(comments: DiffComment[]): string {
  if (!comments?.length) return ''

  const groups = groupByFile(comments)
  if (groups.length === 0) return ''

  const lines: string[] = [
    `<${DIFF_REVIEW_TAG}>`,
    '用户对上一轮代码改动提出了以下评审意见,请针对性地修改(未提意见的部分保持原样):',
    '',
  ]

  for (const g of groups) {
    lines.push(`### ${g.filePath}`)
    // 文件级评论在前(整体性意见应优先被理解),行级在后
    for (const c of g.fileLevel) {
      lines.push(`- (整个文件)${c.comment.trim()}`)
    }
    for (const c of g.lineLevel.slice(0, DIFF_REVIEW_MAX_PER_FILE)) {
      const text = truncateLineText(c.lineText ?? '')
      const loc = text ? `第 ${c.line} 行(\`${text}\`)` : `第 ${c.line} 行`
      lines.push(`- ${loc}:${c.comment.trim()}`)
    }
    lines.push('')
  }

  lines.push(`</${DIFF_REVIEW_TAG}>`)
  const block = lines.join('\n')
  return block.length > DIFF_REVIEW_BLOCK_MAX
    ? `${block.slice(0, DIFF_REVIEW_BLOCK_MAX)}\n... (评审意见过长已截断)`
    : block
}

/**
 * 把评审意见块拼接到用户消息文本尾部(供 send-message 调用)。
 *
 * @returns 拼接后的文本;无评论时原样返回 text(保证零改动路径)。
 */
export function appendDiffComments(text: string, comments: DiffComment[]): string {
  const block = formatDiffCommentsForLLM(comments)
  if (!block) return text
  return `${text}\n\n${block}`
}
