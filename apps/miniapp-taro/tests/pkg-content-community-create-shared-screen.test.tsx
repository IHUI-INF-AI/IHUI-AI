// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 页面级回归:`pkg-content/community/create` 转承载后,页面必须真的把渲染交给壳承载屏。
//
// 2026-11 生成器改为「壳承载形制」:镜像页只 import `@rn-shells/PostCreateScreen`
// (RN 本体),12 个 prop 的拼装随之沉进 RN 壳的 `SharedPostCreateScreen` 调用点。
// 旧断言在镜像页上量 12 个 prop —— 那一层已经没有 prop 了,故改为两段:
//   ① 页面渲染的是壳承载屏(哨兵组件,testid + 次数双判据;不是 import 字符串);
//   ② 12 个 prop 逐个钉在壳的调用点(名字集合精确相等、值映射逐条对齐);
//      只认壳源码里的真实调用,生成器回退成页内自渲染或壳漏传都会红。
import { describe, it, expect, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import path from 'node:path'

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

// 壳承载屏替身:只做两件事 —— 记录渲染次数、吐一枚可断言的 testid。
vi.mock('@rn-shells/PostCreateScreen', () => ({
  PostCreateScreen: () => {
    h.screen.renders += 1
    return createElement('div', { 'data-testid': 'rn-shell-post-create-screen' })
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

/** 壳调用点必须交出的全部 prop(名字集合精确相等,多一个/少一个都红) */
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

const SHELL_SRC = readFileSync(
  path.resolve(__dirname, '../../mobile-rn/src/screens/PostCreateScreen.tsx'),
  'utf8',
)

function shellCallBlock(): string {
  const m = SHELL_SRC.match(/<SharedPostCreateScreen\b[\s\S]*?\/>/)
  if (!m) throw new Error('RN 壳没有渲染 SharedPostCreateScreen')
  return m[0]
}

function assertShellProps(block: string): void {
  const keys = [...block.matchAll(/[\w$]+=\{/g)].map((m) => m[0].slice(0, -2)).sort()
  expect(keys).toEqual([...EXPECTED_KEYS].sort())
  // 值映射:状态位接组件 state,回调接同源 setter / 提交 / 返回,主题接 resolvedTheme。
  const VALUE_MAP: Record<string, string> = {
    t: 't',
    title: 'title',
    content: 'content',
    tags: 'tags',
    saving: 'saving',
    error: 'error',
    onTitleChange: 'setTitle',
    onContentChange: 'setContent',
    onTagsChange: 'setTags',
    onSubmit: 'onSubmit',
    onBack: '() => navigation.goBack()',
    colorScheme: 'resolvedTheme',
  }
  for (const [key, expr] of Object.entries(VALUE_MAP)) {
    expect(block, `${key} 必须接 ${expr}`).toContain(`${key}={${expr}}`)
  }
}

describe('pkg-content/community/create 壳承载渲染', () => {
  it('页面真的渲染壳承载屏(按组件 testid,而非 import 字符串)', () => {
    h.screen.renders = 0
    const html = renderToStaticMarkup(createElement(CommunityCreate as never))
    expect(html).toContain('data-testid="rn-shell-post-create-screen"')
    expect(h.screen.renders).toBe(1)
  })

  it('壳的调用点交出 12 个 prop,名字集合与值映射逐条对齐', () => {
    assertShellProps(shellCallBlock())
  })

  it('阴性对照:少一个 prop / 值换成 undefined,同一断言必须红', () => {
    const good = shellCallBlock()
    expect(() => assertShellProps(good.replace('colorScheme={resolvedTheme}', ''))).toThrow()
    expect(() => assertShellProps(good.replace('title={title}', 'title={undefined}'))).toThrow()
    expect(() => assertShellProps(good.replace('onSubmit={onSubmit}', 'onSubmit={() => undefined}'))).toThrow()
  })
})
