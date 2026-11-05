// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 共享屏 `PostCreateScreen` 的 AI 操控通道回归(2026-11-06 端内能力下沉配套)。
//
// 为什么要这份测试:小程序手写页 `apps/miniapp-taro/src/pkg-content/community/create/index.tsx`
// 一直自带三枚 `useUiField` 登记(标题/内容/标签),而它镜像的共享屏一个通道都没交出。
// 「转壳」要做的不是把那三行抄进薄壳,而是**屏自己把渲染着的输入框的写通道交出来** ——
// 否则壳在、能力丢(2026-11 那枚 `revert: 回退第三批 4 页伪薄壳` 就是这一型的实物)。
// 注释里写"已承接"不算承接,所以这里把行为钉死:
//   ① 挂载即进表,三枚字段的 label/kind/group 与端内登记面逐条同形;
//   ② fill 走的是组件真正绑定的 setter(不是 no-op —— 注册表回 ok 而界面没动是本仓定性的假成功);
//   ③ 卸载即摘除(不留僵尸可操作面);
//   ④ 提交(发布到社区)与「发布」按钮都不交给 AI —— 与端内同一条裁决,且注册表的
//      DESTRUCTIVE 词表演只是兜底,不依赖它;
//   ⑤ 跨端不漂移:端内页与共享屏取的是**同一批 i18n 键**(转壳后可见项清单一字不变)。
//
// `t` 桩必须返回**真实文案**而不是键名:注册表的破坏性判据按 label 文本命中,
// 而 `DESTRUCTIVE_TEXT_RE` 含裸词 `post` —— 拿键名当 label 会让三枚字段被安全层吞掉,
// 那条断言就变成在测桩件。生产里宿主 t() 取到的是词包值,这里同形。
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { act, render } from '@testing-library/react'
import { createElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  resetUiFieldRegistryForTest,
  setFieldValue,
  snapshotUiFields,
} from '@ihui/shared/ui-control/field-registry'

vi.mock('lucide-react-native', () => ({
  ChevronLeft: (p: Record<string, unknown>) => createElement('i', p),
}))

vi.mock('react-native', () => {
  const flatten = (style: unknown): Record<string, unknown> => {
    if (style === null || style === undefined) return {}
    if (Array.isArray(style))
      return style.reduce<Record<string, unknown>>((acc, s) => Object.assign(acc, flatten(s)), {})
    if (typeof style === 'object') return style as Record<string, unknown>
    return {}
  }
  const passThrough = (tag: string) => (p: Record<string, unknown>) =>
    createElement(tag, { children: p.children as never })
  return {
    View: passThrough('div'),
    Text: passThrough('span'),
    ScrollView: passThrough('div'),
    TextInput: (props: Record<string, unknown>) =>
      createElement('input', {
        'data-testid': 'rn-textinput',
        value: (props.value as string | undefined) ?? '',
        onChange: (e: { target: { value: string } }) =>
          (props.onChangeText as ((v: string) => void) | undefined)?.(e.target.value),
      }),
    TouchableOpacity: (p: Record<string, unknown>) =>
      createElement('div', { onClick: p.onPress as never }, p.children as never),
    Pressable: (p: Record<string, unknown>) => {
      const children =
        typeof p.children === 'function'
          ? (p.children as (s: { pressed: boolean }) => never)(
              p.pressed ? { pressed: true } : { pressed: false },
            )
          : (p.children as never)
      return createElement('div', { onClick: p.onPress as never }, children)
    },
    StyleSheet: { flatten, create: (s: unknown) => s, hairlineWidth: 1 },
    Platform: { OS: 'web' },
    PixelRatio: { getFontScale: () => 1 },
  }
})

import { PostCreateScreen } from '../src/features/post-create/PostCreateScreen'

const HERE = dirname(fileURLToPath(import.meta.url))
const MINIAPP_PAGE = join(
  HERE,
  '../../../apps/miniapp-taro/src/pkg-content/community/create/index.tsx',
)

/** 与小程序词包 zh-CN 同值的桩(转壳前后取词面就是这一批键) */
const TEXT: Record<string, string> = {
  'postCreate.title': '发布帖子',
  'postCreate.titleLabel': '标题',
  'postCreate.titlePlaceholder': '给帖子起个标题',
  'postCreate.contentLabel': '内容',
  'postCreate.contentPlaceholder': '分享你的想法...',
  'postCreate.tagsLabel': '标签',
  'postCreate.tagsPlaceholder': '多个标签用逗号分隔',
  'postCreate.submit': '发布',
  'common.back': '返回',
  'common.loading': '加载中...',
}
const t = (key: string): string => TEXT[key] ?? key

interface Props {
  title: string
  content: string
  tags: string
  onTitleChange: ReturnType<typeof vi.fn>
  onContentChange: ReturnType<typeof vi.fn>
  onTagsChange: ReturnType<typeof vi.fn>
  onSubmit: ReturnType<typeof vi.fn>
}

function makeProps(over: Partial<Props> = {}): Props {
  return {
    title: '',
    content: '',
    tags: '',
    onTitleChange: vi.fn(),
    onContentChange: vi.fn(),
    onTagsChange: vi.fn(),
    onSubmit: vi.fn(),
    ...over,
  }
}

const screenElement = (p: Partial<Props> & { saving?: boolean; error?: string }) =>
  createElement(PostCreateScreen, {
    t,
    saving: false,
    error: '',
    onBack: () => {},
    colorScheme: 'light',
    ...p,
  } as never)

const renderScreen = (p: Props) => render(screenElement(p))

beforeEach(() => {
  resetUiFieldRegistryForTest()
})

describe('共享屏交出 AI 操控通道:与端内登记面同形', () => {
  it('挂载即进表:三枚字段、kind 与 label 逐条对齐端内页', () => {
    renderScreen(makeProps())
    const { elements, forms } = snapshotUiFields()
    expect(
      elements.map((e) => ({ kind: e.kind, label: e.label, group: e.group, writable: e.writable })),
    ).toEqual([
      { kind: 'input', label: '标题', group: 'page', writable: true },
      { kind: 'textarea', label: '内容', group: 'page', writable: true },
      { kind: 'input', label: '标签', group: 'page', writable: true },
    ])
    // 没有任何表单把 submit 交给 AI(注册表只把「真能提交」的表单放进可执行面)
    expect(forms).toEqual([])
  })

  it('fill 落到组件真正绑定的 setter,回读与入参一致(拒绝 no-op 假成功)', () => {
    const p = makeProps({ title: '旧值' })
    const { rerender } = renderScreen(p)
    const titleField = snapshotUiFields().elements[0]
    if (!titleField) throw new Error('共享屏没有登记标题字段')

    const res = setFieldValue(titleField.id, '新标题')
    expect(res.ok, res.error).toBe(true)
    expect(p.onTitleChange).toHaveBeenCalledWith('新标题')

    // 受控写回:props 更新后快照回读到的才是真值(fill 的 applied 判据走的就是这条)
    rerender(screenElement({ ...p, title: '新标题' }))
    const after = snapshotUiFields().elements.find((e) => e.label === '标题')
    expect(after?.value).toBe('新标题')
  })

  it('卸载即摘除:不留僵尸可操作面', () => {
    const { unmount } = renderScreen(makeProps())
    expect(snapshotUiFields().elements).toHaveLength(3)
    act(() => unmount())
    expect(snapshotUiFields().elements).toEqual([])
  })

  it('发布按钮与提交通道都不交给 AI(端内同一条裁决,不靠词表兜底)', () => {
    const p = makeProps()
    renderScreen(p)
    const { elements } = snapshotUiFields()
    expect(elements.some((e) => e.label === '发布' || e.pressable === true)).toBe(false)
    // 屏渲染出来的那颗按钮仍在界面上(只是不进可执行面),由用户自己点
    p.onSubmit()
    expect(p.onSubmit).toHaveBeenCalledTimes(1)
  })

  it('saving 早返回不改变登记面(端内页同为「登记在分支之前」)', () => {
    const p = makeProps()
    const { rerender } = renderScreen(p)
    const idsBefore = snapshotUiFields().elements.map((e) => e.id)
    rerender(screenElement({ ...p, saving: true }))
    const after = snapshotUiFields().elements
    expect(after.map((e) => e.label)).toEqual(['标题', '内容', '标签'])
    // 同一控件重渲染不换 id(抖出新的可操作面 = 旧快照指错控件)
    expect(after.map((e) => e.id)).toEqual(idsBefore)
  })
})

describe('跨端不漂移:端内页与共享屏取同一批 i18n 键', () => {
  const keysOf = (src: string): string[] => {
    const out: string[] = []
    for (const m of src.matchAll(
      /useUiField\s*\(\s*\{[\s\S]{0,400}?\blabel:\s*tt?\(\s*'([^']+)'/g,
    )) {
      const key = m[1]
      if (key) out.push(key)
    }
    return out
  }

  it('端内页三个登记点的 label 键 = 屏消费的三个键(转壳后可见项清单一字不变)', () => {
    const pageSrc = readFileSync(MINIAPP_PAGE, 'utf8')
    const screenSrc = readFileSync(
      join(HERE, '../src/features/post-create/PostCreateScreen.tsx'),
      'utf8',
    )
    const pageKeys = keysOf(pageSrc)
    expect(pageKeys).toEqual([
      'postCreate.titleLabel',
      'postCreate.contentLabel',
      'postCreate.tagsLabel',
    ])
    expect(keysOf(screenSrc)).toEqual(pageKeys)
  })

  it('端内页不再经端内别名取注册表(取源直指共享核 ⇒ 与端内桥接层同一模块实例)', () => {
    const pageSrc = readFileSync(MINIAPP_PAGE, 'utf8')
    expect(pageSrc).toContain("from '@ihui/shared/ui-control/field-registry'")
    expect(pageSrc).not.toContain("from '@/lib/ui-field-registry'")
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
