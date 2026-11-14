// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

/**
 * 渲染口径说明:共享屏位于 packages/app,其 JSX 由该包自带的 react@19 编译,
 * miniapp 测试侧的 react-dom@18 不认 react19 元素(Objects are not valid)。
 * 因此本测试用 packages/app 自己的 react-dom@19 做 SSR,并把 react-native
 * 别名桩替换为同源 react@19 的宿主元素桩——只在测试侧收口,不改 vitest.config、
 * 不改任何既有文件。
 */
const appRequire = createRequire(import.meta.url)
const React19 = appRequire('../../../packages/app/node_modules/react/index.js')
const ReactDOMServer19 = appRequire('../../../packages/app/node_modules/react-dom/server.js')

vi.mock('react-native', () => {
  const React = createRequire(import.meta.url)('../../../packages/app/node_modules/react/index.js')
  // style 可能是数组(RN 条件样式),SSR 前拍平成一个对象
  const flattenStyle = (style: unknown): unknown => {
    if (Array.isArray(style)) {
      return Object.assign({}, ...style.map(flattenStyle))
    }
    return style
  }
  const make = (tag: string) => {
    const Host = (props: Record<string, unknown>) =>
      React.createElement(tag, { ...props, style: flattenStyle(props.style) })
    return Host
  }
  return {
    View: make('div'),
    Text: make('span'),
    Image: (props: Record<string, unknown>) =>
      React.createElement('img', {
        ...props,
        src: (props.source as { uri?: string } | undefined)?.uri,
        style: flattenStyle(props.style),
      }),
    TextInput: make('input'),
    ScrollView: make('div'),
    Modal: make('div'),
    Pressable: make('button'),
    TouchableOpacity: make('button'),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
      flatten: (styles: unknown) => styles,
      hairlineWidth: 1,
    },
  }
})

import {
  ChatPanels,
  type ChatPanelsProps,
} from '../../../packages/app/src/features/chat/ChatPanels'

const t = (key: string): string => `⟦${key}⟧`

const baseProps: ChatPanelsProps = {
  t,
  mode: 'none',
  onClose: () => {},
}

const render = (props: Partial<ChatPanelsProps>): string =>
  ReactDOMServer19.renderToStaticMarkup(
    React19.createElement(ChatPanels, { ...baseProps, ...props }),
  )

const source = readFileSync(
  new URL('../../../packages/app/src/features/chat/ChatPanels.tsx', import.meta.url),
  'utf8',
)

describe('ChatPanels 契约(块 4 功能/来源面板)', () => {
  it('正例:mode=none 整块不渲染', () => {
    expect(render({ mode: 'none' })).toBe('')
  })

  it('正例:打开时渲染标题与 items,顺序不变且三列定宽', () => {
    const html = render({
      mode: 'functions',
      title: '功能面板',
      items: [
        { key: 'a', label: '第一项', glyph: '①', onPress: () => {} },
        { key: 'b', label: '第二项', glyph: '②', active: true, onPress: () => {} },
        { key: 'c', label: '第三项', onPress: () => {} },
        { key: 'd', label: '第四项', onPress: () => {} },
      ],
    })

    expect(html).toContain('功能面板')
    expect(html.indexOf('第一项')).toBeLessThan(html.indexOf('第二项'))
    expect(html.indexOf('第二项')).toBeLessThan(html.indexOf('第三项'))
    expect(html.indexOf('第三项')).toBeLessThan(html.indexOf('第四项'))
    // 三列网格:单元格等宽 1/3
    expect(html).toMatch(/width:33\.33/)
  })

  it('正例:disabled 项置灰,不渲染死响应', () => {
    const html = render({
      mode: 'source',
      items: [{ key: 'a', label: '不可用项', disabled: true, onPress: () => {} }],
    })
    const index = html.indexOf('不可用项')
    const start = html.lastIndexOf('<button', index)
    expect(html.slice(start, index)).toContain('disabled')
  })

  it('正例:bottomInset 只作用于面板底部内边距', () => {
    const html = render({
      mode: 'functions',
      items: [{ key: 'a', label: '项', onPress: () => {} }],
      bottomInset: 34,
    })
    expect(html).toContain('padding-bottom:34px')
  })

  it('阴性对照:未触发交互时 onClose 与各 item 回调 0 次', () => {
    const onClose = vi.fn()
    const itemPress = vi.fn()

    render({
      mode: 'functions',
      items: [{ key: 'a', label: '项', onPress: itemPress }],
      onClose,
    })

    expect(onClose).toHaveBeenCalledTimes(0)
    expect(itemPress).toHaveBeenCalledTimes(0)
  })

  it('阴性对照:源码不含平台 API 字面', () => {
    expect(source).not.toMatch(/Taro|fetch\(|axios|localStorage|Alert\.|react-navigation/)
    expect(source).not.toMatch(/wx\.|AsyncStorage|Animated|Dimensions|lucide-react-native/)
    expect(source).not.toMatch(/\bany\b/)
  })
})
