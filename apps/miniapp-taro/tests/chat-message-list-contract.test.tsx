// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 块 2 ChatMessageList 契约测试（对应 A3 spec §2.2 六条冻结语义）。
 *
 * ① key/index：源码锚 `keyExtractor={(item) => item.id}`，渲染顺序 = 传入顺序
 * ② 流式末条 thinking 占位：仅当末条 assistant 且正文为空
 * ③ 长按 500ms：源码锚 `delayLongPress={500}`
 * ④ 图片全屏：markdown 图片点击进入内置 Modal（源码锚 Modal + previewUri）
 * ⑤ 代码块展开/复制：复制只走 onCopyText
 * ⑥ reasoning 折叠：默认收起
 * 阴性对照：不传 onCopyText → 复制钮不渲染；正文已有内容 → 无 thinking 占位。
 */
import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// @ts-expect-error 深度路径无类型声明:仅测试用,固定 React 19 单实例
vi.mock('react', async () => import('../../../packages/app/node_modules/react'))

import { createElement } from 'react'
// @ts-expect-error 深度路径无类型声明:必须与上方 mock 的 React 19 单实例同源
import { renderToStaticMarkup } from '../../../packages/app/node_modules/react-dom/server'

import {
  ChatMessageList,
  ChatMessageBubble,
} from '../../../packages/app/src/features/chat/ChatMessageList'
import type { ChatScreenMessage } from '../../../packages/app/src/types'

const ZH: Record<string, string> = {
  'chat.thinking': '思考中',
  'ai.chatMessageItem.collapse': '收起',
  'ai.chatMessageItem.thinkingProcess': '思考过程',
  'ai.chatMessageItem.copy': '复制',
  'ai.tishi.view': '查看',
}

const t = (key: string, options?: Record<string, string | number>): string => {
  const text = ZH[key] ?? key
  return options ? `${text} ${JSON.stringify(options)}` : text
}

const SOURCE = resolve(__dirname, '../../../packages/app/src/features/chat/ChatMessageList.tsx')
const src = readFileSync(SOURCE, 'utf8')

const msg = (
  id: string,
  role: 'user' | 'assistant',
  content: string,
  extra: Record<string, unknown> = {},
) => ({ id, role, content, ...extra }) as ChatScreenMessage

describe('ChatMessageList 契约', () => {
  it('渲染顺序严格等于传入顺序（不排序）', () => {
    const html = renderToStaticMarkup(
      createElement(ChatMessageList, {
        t,
        data: [msg('b', 'assistant', '回复内容'), msg('a', 'user', '你好')],
      }),
    )
    expect(html.indexOf('回复内容')).toBeLessThan(html.indexOf('你好'))
  })

  it('流式末条 assistant 且正文为空 → thinking 占位', () => {
    const html = renderToStaticMarkup(
      createElement(ChatMessageList, {
        t,
        isStreaming: true,
        data: [msg('u1', 'user', '问题'), msg('a1', 'assistant', '')],
      }),
    )
    expect(html).toContain('思考中')
  })

  it('阴性对照：末条已有正文 → 无 thinking 占位', () => {
    const html = renderToStaticMarkup(
      createElement(ChatMessageList, {
        t,
        isStreaming: true,
        data: [msg('u1', 'user', '问题'), msg('a1', 'assistant', '已有回答')],
      }),
    )
    expect(html).not.toContain('思考中')
  })

  it('代码块：收起态只露头部，复制只走 onCopyText', () => {
    const withCopy = renderToStaticMarkup(
      createElement(ChatMessageBubble, {
        t,
        item: msg('a1', 'assistant', '```js\nconst a = 1\n```', { reasoning: undefined }),
        onCopyText: () => {},
      }),
    )
    // 代码块默认收起：头部有语言与动作，正文仍不渲染（展开态由源码锚断言，见下一条）
    expect(withCopy).toContain('js')
    expect(withCopy).toContain('复制')
    expect(withCopy).toContain('查看')
    expect(withCopy).not.toContain('const a = 1')

    const withoutCopy = renderToStaticMarkup(
      createElement(ChatMessageBubble, {
        t,
        item: msg('a2', 'assistant', '```js\nconst a = 1\n```'),
      }),
    )
    // 阴性对照：不传 onCopyText，复制动作不渲染（代码块头部仍在）
    expect(withoutCopy).toContain('js')
    expect(withoutCopy).not.toContain('复制')
  })

  it('reasoning 默认收起，标签可见、正文不可见', () => {
    const html = renderToStaticMarkup(
      createElement(ChatMessageBubble, {
        t,
        item: msg('a1', 'assistant', '答案', { reasoning: '推理原文A' }),
      }),
    )
    expect(html).toContain('思考过程')
    expect(html).not.toContain('推理原文A')
  })

  it('源码锚：keyExtractor=item.id / delayLongPress=500 / 图片全屏 Modal', () => {
    expect(src).toContain('keyExtractor={(item) => item.id}')
    expect(src).toContain('delayLongPress={500}')
    expect(src).toMatch(/previewUri/u)
    expect(src).toMatch(/Modal/u)
    // 代码展开态：只有 expanded=true 才渲染正文
    expect(src).toMatch(/expanded \? <Text style=\{styles\.codeBody\}>/u)
  })

  it('声明式挂槽：headerNode / tailNodes 按 item.id 锚定 / orphanTailNode 落尾', () => {
    const html = renderToStaticMarkup(
      createElement(ChatMessageList, {
        t,
        data: [msg('b', 'assistant', '回复内容'), msg('a', 'user', '你好')],
        headerNode: createElement('i', null, '头部节点'),
        tailNodes: new Map([['b', createElement('i', null, '锚定尾注')]]),
        orphanTailNode: createElement('i', null, '孤儿尾注'),
      }),
    )
    expect(html).toContain('头部节点')
    // 锚定尾注只落在 b 行之后、a 行之前;孤儿尾注在全部行之后
    expect(html.indexOf('锚定尾注')).toBeGreaterThan(html.indexOf('回复内容'))
    expect(html.indexOf('锚定尾注')).toBeLessThan(html.indexOf('你好'))
    expect(html.indexOf('孤儿尾注')).toBeGreaterThan(html.indexOf('你好'))
  })

  it('源码硬约束：零平台 API / 零 lucide / 零手势原语', () => {
    expect(src).not.toMatch(/\bTaro\b|wx\.|localStorage|sessionStorage|fetch\(/u)
    expect(src).not.toMatch(/lucide-react-native/u)
    expect(src).not.toMatch(/\bAnimated\b|PanResponder/u)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
