/**
 * Content script 工具函数(纯函数,可独立测试)。
 *
 * 职责:
 * - 选区文本提取 + 规范化
 * - 沉浸式翻译片段定位(段落级 text node 切分)
 * - 重点高亮 DOM 包装(用 <mark> 元素 + ihui-hl 类)
 * - 浮动工具栏位置计算
 *
 * 纯函数为主,DOM 操作通过传入 owner document 避免全局副作用,
 * 便于在 vitest(node 环境)直接单测。
 */

/** 选区文本提取 + 长度限制 */
export function extractSelectionText(selection: { toString(): string } | null): string {
  if (!selection) return ''
  return selection.toString().trim()
}

export const MAX_SELECTION_CHARS = 2000

export function isValidSelection(text: string): boolean {
  if (!text) return false
  if (text.length > MAX_SELECTION_CHARS) return false
  // 至少 1 个非空白字符
  return /\S/.test(text)
}

/**
 * 在 element 内按 textNode 切分,把所有匹配 needle 的文本片段包裹为 <mark>。
 * 返回包装的节点数。
 *
 * 限制:
 * - 跳过 <script>/<style>/<textarea>/<input> 子树
 * - 跳过已存在的 <mark> 子树(防递归)
 * - 大文本 (>5000 chars) 跳过以保护性能
 */
export function highlightInElement(
  root: Element,
  needle: string,
  ownerDocument: Document,
): number {
  if (!needle) return 0
  if (root.textContent && root.textContent.length > 5000) return 0
  const skipTags = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'MARK'])
  const walker = ownerDocument.createTreeWalker(root, 4 /* SHOW_TEXT */)
  const targets: Text[] = []
  let n: Node | null = walker.nextNode()
  while (n) {
    const parent = n.parentElement
    if (parent && !skipTags.has(parent.tagName)) {
      const text = n.nodeValue || ''
      if (text.includes(needle)) {
        targets.push(n as Text)
      }
    }
    n = walker.nextNode()
  }
  let wrapped = 0
  for (const t of targets) {
    wrapped += wrapTextWithMark(t, needle, ownerDocument)
  }
  return wrapped
}

function wrapTextWithMark(textNode: Text, needle: string, ownerDocument: Document): number {
  const value = textNode.nodeValue || ''
  const parts: Array<{ kind: 'mark' | 'text'; value: string }> = []
  let cursor = 0
  let found = 0
  while (cursor < value.length) {
    const idx = value.indexOf(needle, cursor)
    if (idx === -1) {
      parts.push({ kind: 'text', value: value.slice(cursor) })
      break
    }
    if (idx > cursor) parts.push({ kind: 'text', value: value.slice(cursor, idx) })
    parts.push({ kind: 'mark', value: needle })
    cursor = idx + needle.length
    found += 1
  }
  if (found === 0) return 0
  const frag = ownerDocument.createDocumentFragment()
  for (const p of parts) {
    if (p.kind === 'text') {
      frag.appendChild(ownerDocument.createTextNode(p.value))
    } else {
      const mark = ownerDocument.createElement('mark')
      mark.className = 'ihui-hl'
      mark.textContent = p.value
      frag.appendChild(mark)
    }
  }
  textNode.parentNode?.replaceChild(frag, textNode)
  return found
}

/**
 * 清除 element 内所有 ihui-hl <mark> 节点,还原为纯文本。
 */
export function clearHighlights(root: Element): number {
  const marks = root.querySelectorAll('mark.ihui-hl')
  const count = marks.length
  marks.forEach((m) => {
    const parent = m.parentNode
    if (!parent) return
    while (m.firstChild) parent.insertBefore(m.firstChild, m)
    parent.removeChild(m)
    parent.normalize()
  })
  return count
}

/**
 * 计算浮动工具栏在 viewport 中的位置(选区上方位移 8px)。
 * 输入:rect(Selection.getRangeAt().getBoundingClientRect())
 * 输出:相对 viewport 的 {top, left, placement: 'top'|'bottom'|'hidden'}
 */
export interface ToolbarPosition {
  top: number
  left: number
  placement: 'top' | 'bottom'
  visible: boolean
}

export function computeToolbarPosition(
  rect: { top: number; left: number; bottom: number; width: number; height: number },
  toolbarWidth: number,
  toolbarHeight: number,
  viewport: { width: number; height: number },
): ToolbarPosition {
  if (rect.width === 0 && rect.height === 0) {
    return { top: 0, left: 0, placement: 'top', visible: false }
  }
  // 优先放上方,空间不足放下方
  const spaceAbove = rect.top
  const spaceBelow = viewport.height - rect.bottom
  const placement: 'top' | 'bottom' =
    spaceAbove >= toolbarHeight + 12 || spaceAbove > spaceBelow ? 'top' : 'bottom'
  const top = placement === 'top' ? rect.top - toolbarHeight - 8 : rect.bottom + 8
  const idealLeft = rect.left + rect.width / 2 - toolbarWidth / 2
  const clampedLeft = Math.max(8, Math.min(idealLeft, viewport.width - toolbarWidth - 8))
  return { top, left: clampedLeft, placement, visible: true }
}

/**
 * 翻译片段 key:从 selection text 提取前 32 字符作稳定 key(用于避免重复请求)。
 */
export function translationKey(text: string): string {
  return text.slice(0, 32)
}

/** 检测文本是否"看起来像英文"或"中文" - 用于决定是否启用沉浸式翻译 UI */
export function detectLanguage(text: string): 'zh' | 'en' | 'other' {
  if (!text) return 'other'
  const zh = (text.match(/[\u4e00-\u9fa5]/g) || []).length
  const en = (text.match(/[a-zA-Z]/g) || []).length
  if (zh > en) return 'zh'
  if (en > 0) return 'en'
  return 'other'
}
