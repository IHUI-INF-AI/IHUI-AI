// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AI 回复文本批注(D87 回复文本批注双向锚点,2026-09-23 立)。
 *
 * 与 D22 的 diff 文件批注(diff-comment-panel)是近亲,但对象不同:
 * D22 锚在「diff 文件的某一行」,本模块锚在「AI 回复消息里的某段选区文本」。
 *
 * 数据模型 { id, messageId, anchorText(选区原文), anchorPrefix/anchorSuffix(前后文指纹,
 * 各 20 字符,用于失效判定与定位兜底), comment, lineCount(选区行数,多行批注展示用), createdAt }。
 *
 * 持久化:按 会话 + 消息 存 localStorage `chat:annotations:{conversationId}`
 * (与既有 `chat:draft:{id}` 同层风格),结构 { [messageId]: Annotation[] }。
 * 不进 zustand persist(避免与并行代理抢 chat.ts 的 partialize),自成独立模块。
 *
 * 定位算法 locateAnnotation:先按 anchorText 精确子串命中 → valid(跨刷新可定位);
 * 文本被编辑/重新生成导致 anchorText 不再出现 → invalid(失效态,不删数据,可手动删除)。
 * 失效但仍能用 anchorPrefix 大致定位时,start 指向原锚点起点,便于 UI 在边栏给出失效提示。
 *
 * 上下文回流 buildAnnotationContext:把某条 AI 回复上的批注格式化为 `<reply_annotation>`
 * 块,供发送钩子在「重试/再发送该消息」时注入 LLM 上下文(接线点在 use-message-send.ts
 * 禁区,本模块只暴露纯函数,接线留给主会话,见交付报告)。
 *
 * 选区捕获 selectionToAnchor / 容器文本读取 readContainerText:把 DOM 选区映射回
 * 容器拼接文本(块级元素间补 \n,对齐浏览器 selection.toString() 行为),保证
 * 「捕获时」与「后续定位时」用同一套文本表示,定位稳定。
 */

/** 前后文指纹长度(各 20 字符)。 */
const ANNOTATION_PREFIX_LEN = 20
const ANNOTATION_SUFFIX_LEN = 20

/** 批注数据模型(与 PROJECT_PLAN.md D87 台账一一对应)。 */
export interface Annotation {
  /** 批注唯一 id(本地生成) */
  id: string
  /** 所属 AI 回复消息 id(与 ChatMessage.id 对齐) */
  messageId: string
  /** 选区原文(锚点主体,定位与失效判定核心) */
  anchorText: string
  /** 锚点前 20 字符(前后文指纹,左侧) */
  anchorPrefix: string
  /** 锚点后 20 字符(前后文指纹,右侧) */
  anchorSuffix: string
  /** 批注正文 */
  comment: string
  /** 选区行数(单行 = 1,多行 > 1,驱动 `所选注释文本,{lineCount} 行` 展示) */
  lineCount: number
  /** 创建时间戳 */
  createdAt: number
}

/** 新建批注时的入参(messageId 已知,id/createdAt 由模块补)。 */
export type AnnotationInput = Omit<Annotation, 'id' | 'createdAt'>

/** 批注锚定状态:valid = 命中可定位;invalid = 文本已变,失效态。 */
export type AnnotationState = 'valid' | 'invalid'

/** 定位结果:state + 锚点在文本中的字符区间(valid 时有值,invalid 时 start 可能为估计值或 null)。 */
export interface LocatedAnchor {
  state: AnnotationState
  /** 锚点起点字符偏移;无法定位时为 null */
  start: number | null
  /** 锚点终点字符偏移;无法定位时为 null */
  end: number | null
}

/** localStorage 键:按会话隔离(与 chat:draft:{id} 同层风格)。 */
function storageKey(conversationId: string): string {
  return `chat:annotations:${conversationId}`
}

/** 持久化结构:{ [messageId]: Annotation[] }。 */
type AnnotationMap = Record<string, Annotation[]>

/** 读取整张会话批注表(容错:解析失败/无会话返回空表)。 */
function readMap(conversationId: string): AnnotationMap {
  if (!conversationId) return {}
  try {
    const raw = localStorage.getItem(storageKey(conversationId))
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as AnnotationMap
    }
    return {}
  } catch {
    return {}
  }
}

/** 写入整张会话批注表(存储异常向上抛出,由调用方决定失败反馈)。 */
function writeMap(conversationId: string, map: AnnotationMap): void {
  if (!conversationId) return
  localStorage.setItem(storageKey(conversationId), JSON.stringify(map))
}

/** 取某条消息上的全部批注(按 createdAt 升序,保证 注释 {n} 序号稳定)。 */
export function getAnnotations(conversationId: string, messageId: string): Annotation[] {
  const list = readMap(conversationId)[messageId]
  if (!list || list.length === 0) return []
  return [...list].sort((a, b) => a.createdAt - b.createdAt)
}

/** 新增一条批注;存储异常时返回 null(调用方据此提示失败)。 */
export function addAnnotation(
  conversationId: string,
  input: AnnotationInput,
): Annotation | null {
  try {
    const map = readMap(conversationId)
    const entry: Annotation = {
      ...input,
      id: `ann_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
    }
    const list = map[input.messageId] ?? []
    list.push(entry)
    map[input.messageId] = list
    writeMap(conversationId, map)
    return entry
  } catch {
    return null
  }
}

/** 编辑批注正文;成功返回 true,未找到或存储异常返回 false。 */
export function updateAnnotationComment(
  conversationId: string,
  messageId: string,
  id: string,
  comment: string,
): boolean {
  try {
    const map = readMap(conversationId)
    const list = map[messageId]
    if (!list) return false
    const idx = list.findIndex((a) => a.id === id)
    if (idx < 0) return false
    const existing = list[idx]
    if (!existing) return false
    list[idx] = { ...existing, comment }
    map[messageId] = list
    writeMap(conversationId, map)
    return true
  } catch {
    return false
  }
}

/**
 * 删除一条批注。
 * @returns true = 已删除(或本就不存在,视为成功);false = 存储异常(删除失败,需反馈)。
 */
export function removeAnnotation(
  conversationId: string,
  messageId: string,
  id: string,
): boolean {
  try {
    const map = readMap(conversationId)
    const list = map[messageId]
    if (!list) return true
    const next = list.filter((a) => a.id !== id)
    if (next.length === list.length) return true // 未找到,无操作即成功
    if (next.length === 0) delete map[messageId]
    else map[messageId] = next
    writeMap(conversationId, map)
    return true
  } catch {
    return false
  }
}

/**
 * 在消息文本中定位某条批注的锚点。
 * - anchorText 仍作为子串出现 → valid(精确命中,跨刷新可定位)。
 * - anchorText 已消失(文本被编辑/重新生成)→ invalid:
 *   若 anchorPrefix 仍在,start 估计为原锚点起点(便于 UI 在边栏定位失效提示),否则 start/end 为 null。
 */
export function locateAnnotation(text: string, ann: Annotation): LocatedAnchor {
  if (ann.anchorText.length > 0 && text.includes(ann.anchorText)) {
    const start = text.indexOf(ann.anchorText)
    return { state: 'valid', start, end: start + ann.anchorText.length }
  }
  if (ann.anchorPrefix.length > 0 && text.includes(ann.anchorPrefix)) {
    const prefixStart = text.indexOf(ann.anchorPrefix)
    const start = prefixStart + ann.anchorPrefix.length
    return { state: 'invalid', start, end: start }
  }
  return { state: 'invalid', start: null, end: null }
}

/** 上下文回流:把某条 AI 回复上的批注格式化为可注入 LLM 的 `<reply_annotation>` 块。无批注返回空串。 */
export function buildAnnotationContext(conversationId: string, messageId: string): string {
  const anns = getAnnotations(conversationId, messageId)
  if (anns.length === 0) return ''
  const lines: string[] = ['<reply_annotation>', `关于此回复的批注：${anns.length} 条`]
  anns.forEach((a, i) => {
    const snippet = a.anchorText.replace(/\s+/g, ' ').trim()
    lines.push(`${i + 1}. 选区「${snippet}」：${a.comment}`)
  })
  lines.push('</reply_annotation>')
  return lines.join('\n')
}

// ─── DOM 选区 ↔ 容器拼接文本 映射 ─────────────────────────────
// 设计:把容器内的文本节点按文档顺序拼接为单一字符串(块级元素边界补 \n),
// 选区捕获与后续定位都基于这同一字符串,保证「捕获」与「重定位」一致。

/** 视为块级、其边界需在拼接文本中补 \n 的标签。 */
const BLOCK_TAGS = new Set([
  'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DETAILS', 'DIV', 'DL', 'FIELDSET',
  'FIGURE', 'FOOTER', 'FORM', 'HEADER', 'HR', 'LI', 'MAIN', 'NAV', 'OL', 'P',
  'PRE', 'SECTION', 'TABLE', 'UL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
])

/** 文本节点覆盖范围(拼接文本中的 [start, end) 区间)。 */
interface TextNodeSpan {
  node: Text
  start: number
  end: number
}

/** 容器拼接文本 + 各文本节点区间。 */
export interface ContainerText {
  text: string
  spans: TextNodeSpan[]
}

function isBlockElement(el: HTMLElement | null): boolean {
  return el != null && BLOCK_TAGS.has(el.tagName)
}

/** 取节点最近的块级祖先(向上爬到 root 为止)。 */
function nearestBlock(node: Node, root: Node): HTMLElement | null {
  let el = node.parentElement
  while (el && el !== root) {
    if (isBlockElement(el)) return el
    el = el.parentElement
  }
  return el
}

/**
 * 读取容器内拼接文本:遍历文本节点,块级祖先变化处补 \n(对齐浏览器 selection.toString())。
 * 纯函数式读取,不修改 DOM。
 */
export function readContainerText(container: HTMLElement): ContainerText {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  const spans: TextNodeSpan[] = []
  let text = ''
  let prevBlock: HTMLElement | null = null
  let node = walker.nextNode() as Text | null
  while (node) {
    if (node.nodeValue && node.nodeValue.length > 0) {
      const block = nearestBlock(node, container)
      if (prevBlock && block !== prevBlock) text += '\n'
      const start = text.length
      text += node.nodeValue
      spans.push({ node, start, end: text.length })
      prevBlock = block
    }
    node = walker.nextNode() as Text | null
  }
  return { text, spans }
}

/** 子树的纯文本长度(块级边界计 1,用于元素节点偏移近似)。 */
function textLengthOf(node: Node, root: Node): number {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.nodeValue ?? '').length
  }
  let total = 0
  node.childNodes.forEach((child) => {
    total += textLengthOf(child, root)
  })
  if (node !== root && isBlockElement(node as HTMLElement)) total += 1
  return total
}

/** 把选区端点(节点 + 偏移)映射到容器拼接文本的全局偏移。 */
function offsetOf(spans: TextNodeSpan[], node: Node, nodeOffset: number): number | null {
  if (node.nodeType === Node.TEXT_NODE) {
    const span = spans.find((s) => s.node === node)
    if (!span) return null
    return span.start + nodeOffset
  }
  // 元素节点:offset 为子节点下标,累加前 offset 个子树的文本长度
  const el = node as HTMLElement
  let acc = 0
  for (let i = 0; i < nodeOffset && i < el.childNodes.length; i++) {
    acc += textLengthOf(el.childNodes[i] as Node, node)
  }
  // 再叠加该元素起点之前的文本(通过 spans 中属于该元素的第一个文本节点起点近似)
  const firstSpan = spans.find((s) => el.contains(s.node))
  const base = firstSpan ? firstSpan.start : 0
  return base + acc
}

/**
 * 把容器内当前选区转换为批注入参(messageId 由调用方提供)。
 * 选区折叠 / 在容器外 / 空文本 → 返回 null。
 */
export function selectionToAnchor(
  container: HTMLElement,
  selection: Selection,
  messageId: string,
): AnnotationInput | null {
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)
  if (!container.contains(range.commonAncestorContainer)) return null

  const { text, spans } = readContainerText(container)
  const startOff = offsetOf(spans, range.startContainer, range.startOffset)
  const endOff = offsetOf(spans, range.endContainer, range.endOffset)
  if (startOff == null || endOff == null) return null

  const from = Math.min(startOff, endOff)
  const to = Math.max(startOff, endOff)
  const anchorText = text.slice(from, to)
  if (!anchorText.trim()) return null

  const lineCount = anchorText.split('\n').length
  const anchorPrefix = text.slice(Math.max(0, from - ANNOTATION_PREFIX_LEN), from)
  const anchorSuffix = text.slice(to, to + ANNOTATION_SUFFIX_LEN)
  return { messageId, anchorText, anchorPrefix, anchorSuffix, comment: '', lineCount }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
