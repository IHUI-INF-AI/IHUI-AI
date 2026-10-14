// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// 输入井(WRAP 形态)聚焦通道判据锁 —— G-1113923 迁移评估结论的测试化。
//
// 这个文件存在的理由:共享层两处自拼聚焦描边(SearchInput / MessageInput)经评估判
// **不可迁移**到 TextField —— 它们的聚焦描边画在外层容器上、内层输入件零描边,与
// TextField"描边在输入件自身"的契约结构性不同;硬迁要么在内层多出一条描边
// (double border)、要么须 borderWidth:0 抑制 TextField 的描边,二者都改变可见行为
// (任务前提:不得改变任何可见行为)。MessageInput 的 isFocused 还是外部 prop,同时驱动
// 右侧按钮"聚焦即展开",TextField 自有内部聚焦态,结构上接不上。
// "不可迁移"是一次评估结论,不是永久事实 —— 但结论要么被测试钉住,要么会被下一个人
// 静默改掉(把容器描边挪进 TextField、或把 TextField 改成容器描边来实现"统一")。
// 本文件钉五组不变量:
//   1. 聚焦描边在**外层容器**(换色不换宽,聚焦取墨档 brand.DEFAULT);
//   2. 内层 TextInput **零描边**(一个 border* 样式键都不得有);
//   3. 聚焦回调透传/直通父层(内部记账不得吃掉宿主回调);
//   4. MessageInput 的聚焦态只认外部 prop —— DOM 上聚焦不改描边,描边随 prop 变;
//   5. 跨端同源:web/小程序基准同样是"输入井描边 + 内层无描边",三端同一形态。
// 断言取 fake TextInput/View 落进 DOM 的 data-style(flatten 后样式对象),颜色逐字比
// (jsdom 会把 '#000000' 归一成 'rgb(0, 0, 0)',拿它当判据就得先归一化两边,而那层
// 归一化本身会成为新的失明点)—— 与 text-field.test.tsx 同一套手法。

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'

import { SearchInput } from '../src/components/SearchInput'
import { MessageInput } from '../src/features/chat/MessageInput'

// lucide 图标渲染成可辨识的 <i data-icon="Name">:右侧按钮"聚焦即展开"判据要能区分
// Maximize / Paperclip / Plus,真图标库在此环境不该被渲染。
vi.mock('lucide-react-native', () => {
  const icon = (name: string) => (p: Record<string, unknown>) =>
    createElement('i', { 'data-icon': name, color: p.color as string | undefined })
  return {
    ChevronLeft: icon('ChevronLeft'),
    FileText: icon('FileText'),
    Keyboard: icon('Keyboard'),
    Maximize: icon('Maximize'),
    Mic: icon('Mic'),
    Minimize: icon('Minimize'),
    Paperclip: icon('Paperclip'),
    Play: icon('Play'),
    Plus: icon('Plus'),
    Search: icon('Search'),
    X: icon('X'),
  }
})

vi.mock('react-native', () => {
  const flatten = (style: unknown): Record<string, unknown> => {
    if (style === null || style === undefined) return {}
    if (Array.isArray(style))
      return style.reduce<Record<string, unknown>>((acc, s) => Object.assign(acc, flatten(s)), {})
    if (typeof style === 'object') return style as Record<string, unknown>
    return {}
  }
  // 所有元素桩都把 style 扁平进 data-style 并撤掉原 style:RN 的 style 形态是数组,
  // 原样递给 DOM 元素会被 React 19 当非法 style 抛出('set' on proxy … property '0')。
  // 输入井判据的主角是**容器**的描边,拿不到容器/文本样式就无从断言。
  const stub = (tag: string, p: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
    createElement(tag, {
      ...p,
      ...extra,
      style: undefined,
      'data-style': JSON.stringify(flatten(p.style)),
    })
  const TextInput = (props: Record<string, unknown>) =>
    stub('input', props, { 'data-testid': 'rn-textinput' })
  const View = (p: Record<string, unknown>) => stub('div', p, { 'data-testid': 'rn-view' })
  const Text = (p: Record<string, unknown>) => stub('span', p)
  const Pressable = (p: Record<string, unknown>) =>
    createElement(
      'div',
      {
        onClick: p.onPress as never,
        'data-testid': 'rn-pressable',
        'data-label': p.accessibilityLabel as string | undefined,
      },
      p.children as never,
    )
  const TouchableOpacity = Pressable
  const ActivityIndicator = (p: Record<string, unknown>) => stub('div', p)
  const Image = (p: Record<string, unknown>) => stub('div', p)
  const ScrollView = (p: Record<string, unknown>) =>
    createElement('div', { 'data-testid': 'rn-scrollview' }, p.children as never)
  const StyleSheet = { flatten, create: (s: unknown) => s }
  return {
    TextInput,
    View,
    Text,
    Pressable,
    TouchableOpacity,
    ActivityIndicator,
    Image,
    ScrollView,
    StyleSheet,
    Platform: { OS: 'web' },
    PixelRatio: { getFontScale: () => 1 },
  }
})

const styleOf = (el: HTMLElement) =>
  JSON.parse(el.getAttribute('data-style') || '{}') as Record<string, string>
const borderKeys = (s: Record<string, string>) =>
  Object.keys(s).filter((k) => k.startsWith('border'))

// 取容器内节点而不是全局 testId:该包的 vitest 配置未开 globals,RTL 的自动 cleanup
// 不会在每个用例后拆 DOM,同名 testId 会在后续用例上撞成"multiple elements"。
const inputOf = (c: { container: HTMLElement }) =>
  c.container.querySelector('[data-testid="rn-textinput"]') as HTMLElement
/** 输入井 = 内层 TextInput 最近的 View 祖先(两个组件的聚焦描边都画在它身上)。 */
const wellOf = (c: { container: HTMLElement }) =>
  inputOf(c).closest('[data-testid="rn-view"]') as HTMLElement
const repoFile = (rel: string) =>
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../..', rel), 'utf8')

describe('SearchInput 输入井聚焦通道(WRAP 形态,G-1113923 评估判不可迁 TextField)', () => {
  const renderSearch = (props: Record<string, unknown> = {}) =>
    render(
      createElement(SearchInput, {
        value: '',
        onChangeText: () => {},
        colorScheme: 'light',
        ...props,
      } as never),
    )

  it('常态:描边在容器上(1px + border.light),内层 TextInput 零描边', () => {
    const r = renderSearch()
    expect(styleOf(wellOf(r))).toMatchObject({ borderWidth: 1, borderColor: '#E5E5E5' })
    expect(borderKeys(styleOf(inputOf(r)))).toEqual([])
  })

  it('聚焦:容器换墨档 #000000 不换宽度,内层样式逐字不变(不得多出内描边)', () => {
    const r = renderSearch()
    const before = styleOf(inputOf(r))
    fireEvent.focus(inputOf(r))
    expect(styleOf(wellOf(r))).toMatchObject({ borderWidth: 1, borderColor: '#000000' })
    expect(styleOf(inputOf(r))).toEqual(before)
    expect(borderKeys(styleOf(inputOf(r)))).toEqual([])
  })

  it('深色:聚焦 #FFFFFF(墨档随主题反转,不是写死的黑)', () => {
    const r = renderSearch({ colorScheme: 'dark' })
    fireEvent.focus(inputOf(r))
    expect(styleOf(wellOf(r)).borderColor).toBe('#FFFFFF')
  })

  it('失焦回 border.light(聚焦态不得粘住)', () => {
    const r = renderSearch()
    fireEvent.focus(inputOf(r))
    fireEvent.blur(inputOf(r))
    expect(styleOf(wellOf(r)).borderColor).toBe('#E5E5E5')
  })

  it('onFocus/onBlur 透传给调用方(内部记账不得吃掉宿主回调)', () => {
    let focusCalls = 0
    let blurCalls = 0
    const r = renderSearch({ onFocus: () => focusCalls++, onBlur: () => blurCalls++ })
    fireEvent.focus(inputOf(r))
    fireEvent.blur(inputOf(r))
    expect(focusCalls).toBe(1)
    expect(blurCalls).toBe(1)
  })

  it('语音态:输入槽位不是 TextInput(换成按住说话长按区)', () => {
    const r = renderSearch()
    fireEvent.click(r.container.querySelector('[data-label="切换语音输入"]') as HTMLElement)
    expect(r.container.querySelector('[data-testid="rn-textinput"]')).toBeNull()
    expect(r.container.textContent).toContain('按住说话')
  })
})

describe('MessageInput 输入井聚焦通道(WRAP 形态,G-1113923 评估判不可迁 TextField)', () => {
  const messageProps = (over: Record<string, unknown> = {}) => ({
    t: (k: string) => k,
    text: '',
    isStreaming: false,
    isSending: false,
    disabled: false,
    files: [],
    showAddFileBtn: true,
    isFocused: false,
    isFullscreen: false,
    isVoiceMode: false,
    isRecording: false,
    error: '',
    onTextChange: () => {},
    onSend: () => {},
    onStop: () => {},
    onFocus: () => {},
    onBlur: () => {},
    onFullscreenToggle: () => {},
    onVoiceToggle: () => {},
    onAddImage: () => {},
    onAddFile: () => {},
    onRemoveFile: () => {},
    onClear: () => {},
    onVoiceStart: () => {},
    onVoiceEnd: () => {},
    colorScheme: 'light',
    ...over,
  })
  const renderMessage = (over: Record<string, unknown> = {}) =>
    render(createElement(MessageInput, messageProps(over) as never))

  it('常态:描边在 inputRow(1px + border.light),内层 TextInput 零描边', () => {
    const r = renderMessage()
    expect(styleOf(wellOf(r))).toMatchObject({ borderWidth: 1, borderColor: '#E5E5E5' })
    expect(borderKeys(styleOf(inputOf(r)))).toEqual([])
  })

  it('isFocused=true:inputRow 换墨档 #000000,内层仍零描边', () => {
    const r = renderMessage({ isFocused: true })
    expect(styleOf(wellOf(r))).toMatchObject({ borderWidth: 1, borderColor: '#000000' })
    expect(borderKeys(styleOf(inputOf(r)))).toEqual([])
  })

  it('聚焦即展开:全屏钮与 Paperclip 只在聚焦态出现(Plus→Paperclip)—— isFocused 外部 prop 的第二职责', () => {
    const rest = renderMessage()
    expect(rest.container.querySelector('[data-icon="Maximize"]')).toBeNull()
    expect(rest.container.querySelector('[data-icon="Plus"]')).not.toBeNull()
    expect(rest.container.querySelector('[data-icon="Paperclip"]')).toBeNull()
    const focused = renderMessage({ isFocused: true })
    expect(focused.container.querySelector('[data-icon="Maximize"]')).not.toBeNull()
    expect(focused.container.querySelector('[data-icon="Paperclip"]')).not.toBeNull()
    expect(focused.container.querySelector('[data-icon="Plus"]')).toBeNull()
  })

  it('onFocus/onBlur 直通父层;DOM 聚焦不改描边 —— 描边只认外部 prop', () => {
    let focusCalls = 0
    let blurCalls = 0
    const r = renderMessage({ onFocus: () => focusCalls++, onBlur: () => blurCalls++ })
    fireEvent.focus(inputOf(r))
    fireEvent.blur(inputOf(r))
    expect(focusCalls).toBe(1)
    expect(blurCalls).toBe(1)
    // 无内部 focused state 的结构性证据:DOM 事件直通父层,容器描边不随 DOM 聚焦变化
    expect(styleOf(wellOf(r)).borderColor).toBe('#E5E5E5')
  })

  it('语音态:输入槽位是 Pressable 语音条而非 TextInput', () => {
    const r = renderMessage({ isVoiceMode: true })
    expect(r.container.querySelector('[data-testid="rn-textinput"]')).toBeNull()
    expect(r.container.textContent).toContain('messageInput.voiceHint')
  })
})

describe('跨端同源:输入井描边三端同一形态(不是 RN 端自成一档)', () => {
  it('web 基准:聚焦描边在输入井(focus-within:border-primary),内层 input border-0', () => {
    const src = repoFile('packages/ui-react/src/components/search-input.tsx')
    expect(src).toMatch(/focus-within:border-primary/)
    expect(src).toMatch(/border-0/)
  })

  it('小程序基准:focusStyle 铺容器、spread 铺 Input(useFieldFocus 用法②)', () => {
    const bar = repoFile('apps/miniapp-taro/src/components/SearchBar.tsx')
    expect(bar).toMatch(/style=\{ff\.focusStyle\}/)
    expect(bar).toMatch(/\{\.\.\.ff\.spread\}/)
    const hook = repoFile('apps/miniapp-taro/src/hooks/use-field-focus.ts')
    expect(hook).toMatch(/描边在外层容器/)
  })
})

describe('迁移结论头注防回潮(G-1113923 评估结论必须留在源码脸上)', () => {
  it('SearchInput 头注写明输入井 WRAP 形态与不可迁结论', () => {
    const src = repoFile('packages/app/src/components/SearchInput.tsx')
    expect(src).toMatch(/输入井 WRAP/)
    expect(src).toMatch(/不可迁 TextField/)
  })

  it('MessageInput 头注写明输入井 WRAP 形态、外部 prop 与不可迁结论', () => {
    const src = repoFile('packages/app/src/features/chat/MessageInput.tsx')
    expect(src).toMatch(/输入井 WRAP/)
    expect(src).toMatch(/外部 prop/)
    expect(src).toMatch(/不可迁 TextField/)
  })
})

describe('TextField 唯一实现契约未被动过(描边仍在输入件自身)', () => {
  it('RESTING_BORDER 透明占位 + focused 三元取墨档 —— 不得为了"统一"改成容器描边', () => {
    const src = repoFile('packages/app/src/components/TextField.tsx')
    expect(src).toMatch(/RESTING_BORDER/)
    expect(src).toMatch(/borderColor: 'transparent'/)
    expect(src).toMatch(/focused \? \{ borderColor: tk\.brand\.DEFAULT \} : null/)
  })
})
