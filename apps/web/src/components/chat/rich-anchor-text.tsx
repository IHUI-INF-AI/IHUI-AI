// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// D99② 消息串内富文本动作锚点 · web 侧**唯一渲染器**。
//
// 两条路共用同一份"标签 → 组件"表,本文件是该表的唯一产地:
//   ① **词包值**(next-intl):`t.rich('someKey', { code: richAnchorRenderer('code') })`
//      —— 或整体传入 `RICH_ANCHOR_COMPONENTS`;标签集合由该表决定。
//   ② **模型/后端输出串**:`<RichAnchorText text={raw} />` —— 用同一张表渲染
//      `parseRichAnchors` 产出的节点树。
//
// 标签集合本身**不在本文件重抄**:类型 `Record<RichAnchorTag, …>` 让"白名单加了标签而
// 这里漏配组件"在 `tsc` 阶段就编译失败;运行时再用 `MISSING_ANCHOR_RENDERERS` 守一道。
//
// 安全红线(实测口径,勿破):`apps/web` 与 `packages` 对
// `rehype-raw|allowedElements|skipHtml` 全量 grep **0 命中** —— **禁止**引入 `rehype-raw`、
// **禁止** `dangerouslySetInnerHTML`。非白名单标签在解析层(`parseRichAnchors`)已降级为纯文本,
// 文本节点由 React 自动转义,故 `<script>` / `<img onerror>` 永远不可能被执行。

import type { ReactNode } from 'react'

import {
  RICH_ANCHOR_TAGS,
  parseRichAnchors,
  type RichAnchorNode,
  type RichAnchorTag,
} from '@ihui/shared/chat'

/**
 * 标签 → 渲染函数。
 * 签名与 next-intl `t.rich` 的标签回调完全一致(`(chunks) => ReactNode`),
 * 故**同一张表**既能喂 `t.rich`,也能喂 `RichAnchorText` —— 这是"不许各建一套渲染器"的落点。
 */
export type RichAnchorComponents = Record<RichAnchorTag, (chunks: ReactNode) => ReactNode>

const CODE_CLASS = 'rounded-sm bg-muted px-1 py-0.5 font-mono text-[0.85em]'
const LINK_CLASS = 'text-primary underline underline-offset-2'

/** 唯一渲染表(`Record<RichAnchorTag, …>` 保证穷尽:白名单新增标签会在此编译失败) */
export const RICH_ANCHOR_COMPONENTS: RichAnchorComponents = {
  a: (chunks) => <span className={LINK_CLASS}>{chunks}</span>,
  action: (chunks) => <span className="font-medium text-foreground">{chunks}</span>,
  branch: (chunks) => <code className={CODE_CLASS}>{chunks}</code>,
  code: (chunks) => <code className={CODE_CLASS}>{chunks}</code>,
  detail: (chunks) => <span className="text-muted-foreground">{chunks}</span>,
  learnMore: (chunks) => <span className={LINK_CLASS}>{chunks}</span>,
  link: (chunks) => <span className={LINK_CLASS}>{chunks}</span>,
  status: (chunks) => <span className="font-medium">{chunks}</span>,
  strong: (chunks) => <strong className="font-semibold">{chunks}</strong>,
  verb: (chunks) => <span className="font-medium">{chunks}</span>,
}

/** 取单个标签的渲染函数(供 `t.rich` 逐标签取用,避免整体传入时的多余键) */
export function richAnchorRenderer(tag: RichAnchorTag): (chunks: ReactNode) => ReactNode {
  return RICH_ANCHOR_COMPONENTS[tag]
}

/**
 * 运行时守卫:白名单里存在但本表未配渲染函数的标签。
 * 编译期已由 `Record<RichAnchorTag, …>` 兜住,此常量供守门/自检在**不改类型**的场景下也能判红。
 */
export const MISSING_ANCHOR_RENDERERS: readonly RichAnchorTag[] = RICH_ANCHOR_TAGS.filter(
  (tag) => typeof RICH_ANCHOR_COMPONENTS[tag] !== 'function',
)

/** 把解析结果渲染成 React 节点;纯文本段原样返回(由 React 转义),不开任何 HTML 通道 */
export function renderRichAnchorNodes(
  nodes: readonly RichAnchorNode[],
  components: RichAnchorComponents = RICH_ANCHOR_COMPONENTS,
): ReactNode[] {
  return nodes.map((node, index) => {
    if (node.kind === 'text') return node.value
    const render = components[node.tag]
    const children = renderRichAnchorNodes(node.children, components)
    if (typeof render !== 'function') return children
    return <span key={index}>{render(children)}</span>
  })
}

export interface RichAnchorTextProps {
  /** 含锚点标签的原始串(后端/模型输出) */
  text: string | null | undefined
  /** 覆盖默认渲染表(测试与特例用);默认 `RICH_ANCHOR_COMPONENTS` */
  components?: RichAnchorComponents
  className?: string
  'data-testid'?: string
}

/**
 * 渲染携带富文本锚点的**字符串**。
 * - 无锚点(常见路径):直接输出原文本,**零额外 DOM 层级**;
 * - 有锚点:按 `RICH_ANCHOR_COMPONENTS` 渲染,非白名单片段已是纯文本。
 */
export function RichAnchorText({
  text,
  components,
  className,
  'data-testid': testId,
}: RichAnchorTextProps) {
  if (!text) return null
  const nodes = parseRichAnchors(text)
  const onlyText = nodes.length <= 1 && (nodes.length === 0 || nodes[0]?.kind === 'text')
  if (onlyText) {
    return className ? (
      <span className={className} data-testid={testId}>
        {text}
      </span>
    ) : (
      <>{text}</>
    )
  }
  return (
    <span className={className} data-testid={testId}>
      {renderRichAnchorNodes(nodes, components)}
    </span>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
