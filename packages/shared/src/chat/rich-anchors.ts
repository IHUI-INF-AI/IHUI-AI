// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D99 消息串内富文本动作锚点(G-136):跨端唯一解析器 + 标签白名单。
//
// 背景(D99 取证结论):i18n 串内富文本链路**已通**,但全仓只有一处先例
// (`packages/i18n/messages/web/zh-CN.json` 的 `note5` 含 `<code>` →
//  `apps/web/app/(main)/self-media/automation/page.tsx` 的 `t.rich('note5', …)`);
// 与此同时**模型输出内嵌标签不受支持** —— `apps/web` 与 `packages` 全量 grep
// `rehype-raw|allowedElements|skipHtml` 实测 0 命中,故**严禁打开裸 HTML**(XSS 敞口)。
//
// 本模块是该机制的**唯一规格**,不是第二套渲染体系:
//   ① 标签白名单 —— 非白名单标签一律按**纯文本**处理(不解释、不丢弃),故 `<script>` /
//      `<img onerror=…>` 永远不可能产出锚点节点;
//   ② 解析为**可序列化**节点树 —— 各端渲染器共用同一节点语义,渲染时由各端做
//      白名单标签 → 组件映射(web 走 `t.rich` 同族机制),不在此处产任何 HTML 字符串;
//   ③ 动词与参数各自成单元(`<action>正在读取</action><detail>{target}</detail>`),
//      故同一键在 ja/ko 里可自由调序,不必拆成"动词键 + 宾语键"两套 —— 这是
//      D81/D83 双时态词表在 5 语言下不爆炸的前提。
//
// 与 D83 / D54 / D58 / D81 **共用同一份词表与同一渲染器**,不得各建一套(台账 B4o 纪律)。

/**
 * 锚点标签白名单(取自 Codex zh 包实测的值内嵌标签族,收敛为我方对话流所需子集)。
 * 白名单**只允许显式增删**,禁止运行时动态扩充。
 */
export const RICH_ANCHOR_TAGS = [
  'a',
  'action',
  'branch',
  'code',
  'detail',
  'learnMore',
  'link',
  'status',
  'strong',
  'verb',
] as const

/** 白名单标签字面量类型 */
export type RichAnchorTag = (typeof RICH_ANCHOR_TAGS)[number]

/** 解析结果节点:纯文本段 或 锚点段(children 允许嵌套) */
export type RichAnchorNode =
  | { readonly kind: 'text'; readonly value: string }
  | {
      readonly kind: 'anchor'
      readonly tag: RichAnchorTag
      readonly children: readonly RichAnchorNode[]
    }

interface Frame {
  readonly tag: RichAnchorTag
  readonly children: RichAnchorNode[]
}

const TAG_SET: ReadonlySet<string> = new Set<string>(RICH_ANCHOR_TAGS)

/** 是否为白名单锚点标签(供各端组件映射表做同源校验) */
export function isRichAnchorTag(tag: string): tag is RichAnchorTag {
  return TAG_SET.has(tag)
}

/** 严格形态:仅标签名本身 —— 带属性 / 自闭合 / 含空白的形态**不**在白名单内,按文本处理(不丢字) */
const STRICT_TAG_NAME = /^[a-zA-Z]+$/

/**
 * 把携带锚点标签的字符串解析成节点树。
 *
 * 语义(逐条可测):
 * - 只认 `<tag>` 与 `</tag>`(无属性、无自闭合、无空白);其余尖括号片段原样进文本节点;
 * - 未闭合的开标签:其 children 延展到串尾(自动闭合),不丢内容;
 * - 多余闭标签(无对应开标签):按文本原样保留;
 * - 相邻文本段自动合并,输出有确定性(便于快照断言);
 * - **不产出任何 HTML 字符串**,也绝不解释非白名单标签 —— 安全边界即白名单本身。
 */
export function parseRichAnchors(input: string): readonly RichAnchorNode[] {
  const root: RichAnchorNode[] = []
  const stack: Frame[] = []

  const bucket = (): RichAnchorNode[] => {
    const top = stack[stack.length - 1]
    return top ? top.children : root
  }

  const pushText = (value: string): void => {
    if (!value) return
    const target = bucket()
    const last = target[target.length - 1]
    if (last && last.kind === 'text') {
      target[target.length - 1] = { kind: 'text', value: last.value + value }
      return
    }
    target.push({ kind: 'text', value })
  }

  let cursor = 0
  let buffer = ''
  while (cursor < input.length) {
    const lt = input.indexOf('<', cursor)
    if (lt === -1) {
      buffer += input.slice(cursor)
      break
    }
    buffer += input.slice(cursor, lt)
    const gt = input.indexOf('>', lt)
    if (gt === -1) {
      buffer += input.slice(lt)
      break
    }
    const raw = input.slice(lt + 1, gt)
    const closing = raw.startsWith('/')
    const name = (closing ? raw.slice(1) : raw).trim()
    if (!STRICT_TAG_NAME.test(name) || !isRichAnchorTag(name)) {
      // 非白名单 / 非严格形态 —— 原样当文本
      buffer += input.slice(lt, gt + 1)
      cursor = gt + 1
      continue
    }
    if (!closing) {
      pushText(buffer)
      buffer = ''
      stack.push({ tag: name, children: [] })
    } else {
      let matchIndex = -1
      for (let i = stack.length - 1; i >= 0; i -= 1) {
        if (stack[i]?.tag === name) {
          matchIndex = i
          break
        }
      }
      if (matchIndex === -1) {
        buffer += input.slice(lt, gt + 1)
      } else {
        pushText(buffer)
        buffer = ''
        while (stack.length > matchIndex) {
          const frame = stack.pop()
          if (!frame) break
          const target = bucket()
          target.push({ kind: 'anchor', tag: frame.tag, children: frame.children })
        }
      }
    }
    cursor = gt + 1
  }

  pushText(buffer)
  while (stack.length > 0) {
    const frame = stack.pop()
    if (!frame) break
    const target = bucket()
    target.push({ kind: 'anchor', tag: frame.tag, children: frame.children })
  }
  return root
}

/**
 * 降级:节点树 → 纯文本(供不具备富文本渲染能力的端使用)。
 * 语义是"只去标记、不丢字"——安全反例串(如 `<script>…</script>`)在这里会原样出现在
 * 文本里,因此调用方**必须以文本节点渲染**(各端框架默认转义),禁止把结果拼进 HTML 字符串。
 */
export function richAnchorsToPlainText(nodes: readonly RichAnchorNode[]): string {
  let out = ''
  for (const node of nodes) {
    out += node.kind === 'text' ? node.value : richAnchorsToPlainText(node.children)
  }
  return out
}

/** 统计锚点节点数(可按标签过滤);供埋点与"渲染或显式声明不渲染"类守门使用 */
export function countRichAnchors(nodes: readonly RichAnchorNode[], tag?: RichAnchorTag): number {
  let total = 0
  for (const node of nodes) {
    if (node.kind === 'anchor') {
      if (!tag || node.tag === tag) total += 1
      total += countRichAnchors(node.children, tag)
    }
  }
  return total
}

/** 展平为标签序列(便于断言"五语言语序变体"这类顺序判据) */
export function richAnchorTagSequence(nodes: readonly RichAnchorNode[]): readonly RichAnchorTag[] {
  const seq: RichAnchorTag[] = []
  const walk = (list: readonly RichAnchorNode[]): void => {
    for (const node of list) {
      if (node.kind === 'anchor') {
        seq.push(node.tag)
        walk(node.children)
      }
    }
  }
  walk(nodes)
  return seq
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
