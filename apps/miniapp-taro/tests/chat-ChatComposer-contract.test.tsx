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

// 图标由 vitest.config 的别名统一指到 tests/stubs/lucide-react-native.ts(零依赖桩),
// 本册只判布局与文案,不引平台渲染链。

import {
  ChatComposer,
  type ChatComposerProps,
} from '../../../packages/app/src/features/chat/ChatComposer'

/** 测试用 t:把 key 原样带标记渲染,便于断言文案与顺序 */
const t = (key: string): string => `⟦${key}⟧`

const models = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    context_length: 128000,
    input_price: 0.005,
  },
  {
    id: 'deepseek-chat',
    name: 'DeepSeek Chat',
    provider: 'deepseek',
    context_length: 64000,
    input_price: 0.001,
  },
]

const baseProps: ChatComposerProps = {
  t,
  value: '',
  onChangeText: () => {},
  models,
  modelId: 'gpt-4o',
  onSubmit: () => {},
  onStop: () => {},
}

const render = (props: Partial<ChatComposerProps>): string =>
  ReactDOMServer19.renderToStaticMarkup(
    React19.createElement(ChatComposer, { ...baseProps, ...props }),
  )

/** 取包含指定文案的按钮开标签(用于断言 disabled 置灰) */
const buttonOpenTagAround = (html: string, text: string): string => {
  const index = html.indexOf(text)
  const start = html.lastIndexOf('<button', index)
  return html.slice(start, index)
}

const source = readFileSync(
  new URL('../../../packages/app/src/features/chat/ChatComposer.tsx', import.meta.url),
  'utf8',
)

describe('ChatComposer 契约(块 3 输入区)', () => {
  it('正例:headerSlot 位于输入框上方,功能开关按原序渲染', () => {
    const html = render({
      value: '你好',
      headerSlot: React19.createElement('span', null, '素材卡片'),
      toggles: [
        { key: 'webSearch', label: '联网搜索', active: true },
        { key: 'deepThink', label: '深度思考', active: false },
      ],
    })

    expect(html).toContain('素材卡片')
    expect(html).toContain('联网搜索')
    expect(html).toContain('深度思考')
    expect(html.indexOf('素材卡片')).toBeLessThan(html.indexOf('联网搜索'))
    expect(html.indexOf('联网搜索')).toBeLessThan(html.indexOf('深度思考'))
    expect(html.indexOf('深度思考')).toBeLessThan(html.indexOf('⟦messageInput.placeholder⟧'))
  })

  it('正例:附件按传入顺序渲染,删除按钮仅在注入回调时出现', () => {
    const html = render({
      files: [
        { id: 'f1', url: 'https://cdn/x.pdf', filename: '报告.pdf', type: 'document' },
        { id: 'f2', url: 'https://cdn/y.mp4', filename: '视频.mp4', type: 'video' },
      ],
      onRemoveFile: () => {},
    })

    expect(html.indexOf('报告.pdf')).toBeLessThan(html.indexOf('视频.mp4'))
    expect(html).toContain('⟦chat.imageDelete⟧')
  })

  it('正例:loading 时只显示停止,发送按钮不出现', () => {
    const html = render({ value: '进行中', loading: true })
    expect(html).toContain('⟦chat.stop⟧')
    expect(html).not.toContain('⟦messageInput.send⟧')
  })

  it('正例:空串发送按钮置灰,非空串可发送', () => {
    const empty = render({ value: '   ' })
    expect(buttonOpenTagAround(empty, '⟦messageInput.send⟧')).toContain('disabled')

    const typed = render({ value: '你好' })
    expect(buttonOpenTagAround(typed, '⟦messageInput.send⟧')).not.toContain('disabled')
  })

  it('正例:error 在输入框上方,模型面板打开时才渲染其它模型', () => {
    const closed = render({ value: 'x', error: '网络异常' })
    expect(closed).toContain('网络异常')
    expect(closed.indexOf('网络异常')).toBeLessThan(closed.indexOf('⟦messageInput.placeholder⟧'))
    expect(closed).not.toContain('DeepSeek Chat')

    const open = render({ modelPickerOpen: true })
    expect(open).toContain('GPT-4o')
    expect(open).toContain('DeepSeek Chat')
  })

  it('正例:全屏只切标题与样式,输入值原样保留', () => {
    const html = render({
      value: '未发送的内容',
      isFullscreen: true,
      isFocused: true,
      onFullscreenToggle: () => {},
    })
    expect(html).toContain('⟦messageInput.fullscreenHint⟧')
    expect(html).toContain('value="未发送的内容"')
    expect(html).toContain('⤡')
  })

  it('阴性对照:未触发交互时所有注入回调 0 次', () => {
    const onChangeText = vi.fn()
    const onSubmit = vi.fn()
    const onStop = vi.fn()
    const onToggle = vi.fn()
    const onRemoveFile = vi.fn()
    const onModelChange = vi.fn()
    const onAgentVariableTextChange = vi.fn()

    render({
      value: '有内容',
      onChangeText,
      onSubmit,
      onStop,
      onToggle,
      onRemoveFile,
      onModelChange,
      onAgentVariableTextChange,
      files: [{ id: 'f1', url: 'https://cdn/x.png', type: 'image' }],
      toggles: [{ key: 'agentMode', label: 'Agent', active: true }],
      agentVariables: [{ name: '主题', type: 'text', description: '请输入主题', value: '春游' }],
    })

    expect(onChangeText).toHaveBeenCalledTimes(0)
    expect(onSubmit).toHaveBeenCalledTimes(0)
    expect(onStop).toHaveBeenCalledTimes(0)
    expect(onToggle).toHaveBeenCalledTimes(0)
    expect(onRemoveFile).toHaveBeenCalledTimes(0)
    expect(onModelChange).toHaveBeenCalledTimes(0)
    expect(onAgentVariableTextChange).toHaveBeenCalledTimes(0)
  })

  it('阴性对照:未注入的可选回调对应 UI 不渲染死按钮', () => {
    const html = render({ value: 'x' })
    expect(html).not.toContain('⟦messageInput.fullscreenHint⟧')
    expect(html).not.toContain('⟦common.more⟧')
    expect(html).not.toContain('⟦bab.camera⟧')
    expect(html).not.toContain('⟦messageInput.addFile⟧')
  })

  it('阴性对照:源码不含平台 API 字面', () => {
    expect(source).not.toMatch(/Taro|fetch\(|axios|localStorage|Alert\.|react-navigation/)
    // lucide-react-native 不再算平台 API 违禁项:主线的图标迁移(dc4c471aa2)就是让它进共享屏,
    // 小程序构建侧 config/index.ts 有 `lucide-react-native$ → src/rn-compat/icons-generated.tsx`
    // 别名把它换成端内实现;仍禁的是真正会炸的平台调用来路。
    expect(source).not.toMatch(/wx\.|AsyncStorage|Animated|Dimensions/)
    expect(source).not.toMatch(/\bany\b/)
  })
})
