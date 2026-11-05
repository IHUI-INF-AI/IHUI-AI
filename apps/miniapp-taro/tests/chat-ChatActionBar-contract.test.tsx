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
  ChatActionBar,
  type ChatActionBarProps,
} from '../../../packages/app/src/features/chat/ChatActionBar'

const t = (key: string): string => `⟦${key}⟧`

const baseProps: ChatActionBarProps = {
  t,
}

const render = (props: Partial<ChatActionBarProps>): string =>
  ReactDOMServer19.renderToStaticMarkup(
    React19.createElement(ChatActionBar, { ...baseProps, ...props }),
  )

const countOccurrences = (html: string, token: string): number => html.split(token).length - 1

const source = readFileSync(
  new URL('../../../packages/app/src/features/chat/ChatActionBar.tsx', import.meta.url),
  'utf8',
)

describe('ChatActionBar 契约(块 4 底部动作栏)', () => {
  it('正例:actions 与 toggles 按传入顺序,visible=false 不占位', () => {
    const html = render({
      actions: [
        { key: 'a1', label: '动作一', glyph: '①', onPress: () => {} },
        { key: 'a2', label: '隐藏动作', visible: false, onPress: () => {} },
        { key: 'a3', label: '动作三', onPress: () => {} },
      ],
      toggles: [
        { key: 't1', label: '开关一', active: true },
        { key: 't2', label: '开关二', active: false },
      ],
    })

    expect(html).toContain('动作一')
    expect(html).toContain('动作三')
    expect(html).not.toContain('隐藏动作')
    expect(html.indexOf('动作一')).toBeLessThan(html.indexOf('动作三'))
    expect(html.indexOf('动作三')).toBeLessThan(html.indexOf('开关一'))
    expect(html.indexOf('开关一')).toBeLessThan(html.indexOf('开关二'))
  })

  it('正例:images 在模型条下方横排,并按 index 回传移除', () => {
    const html = render({
      modelLabel: '引擎A',
      images: [
        { id: 'i1', uri: 'https://cdn/1.png' },
        { id: 'i2', uri: 'https://cdn/2.png' },
      ],
      onImageRemove: () => {},
    })

    // react19 SSR 会把图片 preload 提到文档头部,这里只比 body 内 <img> 的先后
    const firstImage = html.indexOf('src="https://cdn/1.png"')
    const secondImage = html.indexOf('src="https://cdn/2.png"')
    expect(html.indexOf('引擎A')).toBeLessThan(firstImage)
    expect(firstImage).toBeLessThan(secondImage)
    expect(countOccurrences(html, '<img')).toBe(2)
    expect(countOccurrences(html, '⟦chat.imageDelete⟧')).toBe(2)
  })

  it('正例:compacting 时显示压缩入口且不重复普通动作', () => {
    const html = render({
      compacting: true,
      onCompactContext: () => {},
      actions: [{ key: 'a1', label: '动作一', onPress: () => {} }],
      toggles: [{ key: 't1', label: '开关一', active: true }],
    })

    expect(html).toContain('⟦messageInput.compactButton⟧')
    expect(html).not.toContain('动作一')
    expect(html).not.toContain('开关一')
  })

  it('正例:图标组按 camera/album/file/wxfile 固定顺序渲染', () => {
    const html = render({ onIconClick: () => {} })
    expect(html.indexOf('⟦bab.camera⟧')).toBeLessThan(html.indexOf('⟦bab.album⟧'))
    expect(html.indexOf('⟦bab.album⟧')).toBeLessThan(html.indexOf('⟦bab.localFile⟧'))
    expect(html.indexOf('⟦bab.localFile⟧')).toBeLessThan(html.indexOf('⟦bab.wxFile⟧'))
  })

  it('阴性对照:未触发交互时所有注入回调 0 次', () => {
    const onToggle = vi.fn()
    const onImageRemove = vi.fn()
    const onIconClick = vi.fn()
    const onCompactContext = vi.fn()
    const onShowModelList = vi.fn()
    const onShowModelConfig = vi.fn()
    const onModelConfigChange = vi.fn()

    const actionPress = vi.fn()
    render({
      modelLabel: '引擎A',
      images: [{ id: 'i1', uri: 'https://cdn/1.png' }],
      actions: [{ key: 'a1', label: '动作一', onPress: actionPress }],
      toggles: [{ key: 't1', label: '开关一', active: false }],
      onToggle,
      onImageRemove,
      onIconClick,
      onCompactContext,
      onShowModelList,
      onShowModelConfig,
      onModelConfigChange,
    })

    expect(onToggle).toHaveBeenCalledTimes(0)
    expect(onImageRemove).toHaveBeenCalledTimes(0)
    expect(onIconClick).toHaveBeenCalledTimes(0)
    expect(onCompactContext).toHaveBeenCalledTimes(0)
    expect(onShowModelList).toHaveBeenCalledTimes(0)
    expect(onShowModelConfig).toHaveBeenCalledTimes(0)
    expect(onModelConfigChange).toHaveBeenCalledTimes(0)
    expect(actionPress).toHaveBeenCalledTimes(0)
  })

  it('阴性对照:未注入回调时对应控件不渲染', () => {
    const html = render({})
    expect(html).not.toContain('引擎A')
    expect(html).not.toContain('⟦bab.camera⟧')
    expect(html).not.toContain('⟦chat.fnTitle⟧')
    expect(html).not.toContain('⟦common.more⟧')
    expect(html).not.toContain('⟦bab.enlarge⟧')
    expect(html).not.toContain('⟦common.myCreation⟧')
    expect(html).not.toContain('⟦messageInput.compactButton⟧')
    expect(html).not.toContain('⟦bab.modelConfig⟧')
  })

  it('阴性对照:源码不含平台 API 字面', () => {
    expect(source).not.toMatch(/Taro|fetch\(|axios|localStorage|Alert\.|react-navigation/)
    expect(source).not.toMatch(/wx\.|AsyncStorage|Animated|Dimensions|lucide-react-native/)
    expect(source).not.toMatch(/\bany\b/)
  })
})
