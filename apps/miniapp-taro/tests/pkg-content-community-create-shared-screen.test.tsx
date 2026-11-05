// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 页面级回归:`pkg-content/community/create` 转承载后,渲染真的落在共享屏上,且每个 prop 都到齐。
//
// 为什么不是"文件里有 import 字符串":伪薄壳(revert: 回退第三批 4 页伪薄壳)正是
// "import 了共享屏、页里仍自渲染"——字符串断言对它是绿的。这里把共享屏模块换成
// 记录 props 的哨兵组件,只有**真的被渲染**才拿得到 props(组件名 + testid 双判据)。
//
// 三条判据:
//   ① 渲染的是共享屏(哨兵 testid 出现在输出里);
//   ② 页里现在传的 12 个 prop 逐个到达,名字集合精确相等、值语义逐条对齐
//      (title/content/tags 为空串、saving=false、error=''、colorScheme 走主题、
//       t 取真实文案、五个回调都是函数且 onBack 真调 Taro.navigateBack);
//   ③ 阴性对照:少一个键 / 某键为 undefined 时同一断言必须红
//      (证明"共享屏改字段名后这页静默坏"能被这条测试抓到)。
import { describe, it, expect, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const h = vi.hoisted(() => ({
  navigateBack: vi.fn(),
  navigateTo: vi.fn(),
  redirectTo: vi.fn(),
  screen: { props: null as Record<string, unknown> | null, renders: 0 },
}))

vi.mock('@tarojs/components', () => {
  const make = (tag: string) => {
    const Stub = (props: { children?: ReactNode }) => createElement(tag, null, props.children)
    Stub.displayName = `Taro${tag}`
    return Stub
  }
  return { View: make('div'), Text: make('span'), ScrollView: make('div') }
})

vi.mock('@tarojs/taro', () => ({
  default: {
    getCurrentInstance: () => ({ router: { params: {} } }),
    navigateBack: h.navigateBack,
    navigateTo: h.navigateTo,
    redirectTo: h.redirectTo,
  },
}))

// 共享屏替身:只做两件事 —— 记录收到的 props、吐一枚可断言的 testid。
vi.mock('@ihui/rn-app/features/post-create/PostCreateScreen', () => ({
  PostCreateScreen: (props: Record<string, unknown>) => {
    h.screen.props = props
    h.screen.renders += 1
    return createElement('div', { 'data-testid': 'shared-post-create-screen' })
  },
}))

vi.mock('@ihui/api-client', () => ({
  fetchApi: vi.fn(async () => ({ success: false, error: 'x' })),
}))

vi.mock('@/i18n', () => {
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
  }
  const t = (key: string, fallback?: string): string => TEXT[key] ?? fallback ?? key
  return { useI18n: () => ({ t }), useTt: () => t, t }
})

vi.mock('@/lib/ui-field-registry', () => ({ useUiField: () => undefined }))
vi.mock('@/rn-compat/theme', () => ({ useTheme: () => ({ resolvedTheme: 'dark' }) }))
vi.mock('@/components/ThemeRoot', () => ({
  default: (props: { children?: ReactNode }) => createElement('div', null, props.children),
}))

import CommunityCreate from '../src/pkg-content/community/create/index'

/** 页里现在传的全部 prop(名字集合必须精确相等,多一个/少一个都红) */
const EXPECTED_KEYS = [
  't',
  'title',
  'content',
  'tags',
  'saving',
  'error',
  'onTitleChange',
  'onContentChange',
  'onTagsChange',
  'onSubmit',
  'onBack',
  'colorScheme',
]

function assertSharedScreenProps(props: Record<string, unknown>): void {
  expect(Object.keys(props).sort()).toEqual([...EXPECTED_KEYS].sort())
  // 值语义:五个状态位是页的真实初值,不是随便塞的常量
  expect(props.title).toBe('')
  expect(props.content).toBe('')
  expect(props.tags).toBe('')
  expect(props.saving).toBe(false)
  expect(props.error).toBe('')
  // colorScheme 必须来自主题(mock 的 useTheme 给 dark),证明不是写死 light
  expect(props.colorScheme).toBe('dark')
  // t 必须是页的取词函数:同一枚键取到真实文案
  expect(typeof props.t).toBe('function')
  expect((props.t as (key: string) => string)('postCreate.title')).toBe('发布帖子')
  // 五个回调必须都是函数;onBack 真的落 Taro.navigateBack(不是空壳)
  for (const key of ['onTitleChange', 'onContentChange', 'onTagsChange', 'onSubmit', 'onBack']) {
    expect(typeof props[key]).toBe('function')
  }
  ;(props.onBack as () => void)()
  expect(h.navigateBack).toHaveBeenCalledTimes(1)
}

describe('pkg-content/community/create 真渲染共享屏', () => {
  it('渲染的是共享屏(按组件 testid,而非 import 字符串)', () => {
    const html = renderToStaticMarkup(createElement(CommunityCreate as never))
    expect(html).toContain('data-testid="shared-post-create-screen"')
    expect(h.screen.renders).toBe(1)
    expect(h.screen.props).not.toBeNull()
  })

  it('12 个 prop 逐个到达,值语义与页内事实一致', () => {
    h.navigateBack.mockClear()
    renderToStaticMarkup(createElement(CommunityCreate as never))
    assertSharedScreenProps(h.screen.props as Record<string, unknown>)
  })

  it('阴性对照:删掉一个传参 / 某 prop 为 undefined,断言必须红', () => {
    renderToStaticMarkup(createElement(CommunityCreate as never))
    const good = { ...(h.screen.props as Record<string, unknown>) }
    const missingColorScheme = { ...good }
    delete missingColorScheme.colorScheme
    expect(() => assertSharedScreenProps(missingColorScheme)).toThrow()
    expect(() => assertSharedScreenProps({ ...good, colorScheme: undefined })).toThrow()
    expect(() => assertSharedScreenProps({ ...good, title: undefined })).toThrow()
  })
})
