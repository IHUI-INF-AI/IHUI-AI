// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * n8n 模型页薄壳形制锁(apps/miniapp-taro/src/pkg-ai/dev-enter/n8n-model/index.tsx)。
 *
 * 判的是「端内壳有没有把共享屏接上并用显式 props 注入」,不是壳内部实现:
 *  ① 共享屏真被渲染、主题根在壳外层;
 *  ② 列表态端内零布局(创建表单已抽到宿主模块 create-view.tsx);
 *  ③ props 真到共享屏且 onOpen/onEdit/onBack 真接线;
 *  ④ 页源码不得回潮第二份实现(列表卡片/参数行/头部都搬走了);
 *  ⑤ 页内 JSX 只剩壳的两个节点(ThemeRoot + 共享屏,AST 计数);
 *  ⑥ 宿主模块承接创建表单、共享屏与 RN 消费点各自成锁。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  createSourceFile,
  forEachChild,
  isJsxElement,
  isJsxFragment,
  isJsxSelfClosingElement,
  isJsxText,
  ScriptKind,
  ScriptTarget,
  type Node,
} from 'typescript'

const captured = vi.hoisted(() => ({
  props: null as Record<string, unknown> | null,
}))

const taroMocks = vi.hoisted(() => ({
  navigateTo: vi.fn(),
  navigateBack: vi.fn(),
  chooseMessageFile: vi.fn(),
}))

vi.mock('@ihui/rn-app/features/n8n-model/N8nModelScreen', () => ({
  N8nModelScreen: (props: Record<string, unknown>) => {
    captured.props = props
    return createElement('div', { 'data-testid': 'shared-n8n-model' })
  },
}))

vi.mock('@tarojs/taro', () => {
  const Taro = {
    navigateTo: taroMocks.navigateTo,
    navigateBack: taroMocks.navigateBack,
    chooseMessageFile: taroMocks.chooseMessageFile,
    getFileSystemManager: () => ({ readFile: vi.fn() }),
    showLoading: vi.fn(),
    hideLoading: vi.fn(),
    showToast: vi.fn(),
  }
  return { default: Taro, useDidShow: vi.fn(), ...Taro }
})

vi.mock('@/i18n', () => ({
  useI18n: () => ({ locale: 'zh-CN', t: (key: string) => key }),
  useTt: () => (key: string, fallback?: string) => fallback ?? key,
}))

vi.mock('@/api', () => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/utils/upload-image', () => ({ chooseImages: vi.fn(), uploadImage: vi.fn() }))
vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))
vi.mock('@/rn-compat/theme', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }))

vi.mock('@/components/ThemeRoot', () => {
  const Stub = (props: { children?: ReactNode; className?: string }) =>
    createElement(
      'div',
      { 'data-testid': 'theme-root', className: props.className },
      props.children,
    )
  Stub.displayName = 'ThemeRootStub'
  return { default: Stub }
})

vi.mock('@/lib/ui-field-registry', () => ({ useUiField: () => undefined }))
vi.mock('@/host/on-toast', () => ({ onToast: vi.fn() }))

// 宿主模块 create-view.tsx 引 @tarojs/components(真包 dist 求值期 import hammerjs,
// node 环境无 window ⇒ 收集期整体失败)。本册只判壳,不渲染创建表单,故给纯 DOM 替身。
vi.mock('@tarojs/components', () => {
  const stub = (tag: string) => {
    const C = (props: Record<string, unknown>) =>
      createElement(tag, props, props.children as ReactNode)
    C.displayName = `TaroStub(${tag})`
    return C
  }
  return {
    View: stub('div'),
    Text: stub('span'),
    ScrollView: stub('div'),
    Image: stub('img'),
    Input: stub('input'),
    Textarea: stub('textarea'),
  }
})

import N8nModel from '../src/pkg-ai/dev-enter/n8n-model/index'

const PAGE_SOURCE = readFileSync(resolve('src/pkg-ai/dev-enter/n8n-model/index.tsx'), 'utf8')
const HOST_SOURCE = readFileSync(resolve('src/pkg-ai/dev-enter/n8n-model/create-view.tsx'), 'utf8')
const SHARED_SOURCE = readFileSync(
  resolve('../../packages/app/src/features/n8n-model/N8nModelScreen.tsx'),
  'utf8',
)
const RN_SOURCE = readFileSync(
  resolve('../../apps/mobile-rn/src/screens/N8nModelScreen.tsx'),
  'utf8',
)

const renderPage = () => {
  captured.props = null
  const html = renderToStaticMarkup(createElement(N8nModel))
  return { html, props: () => captured.props as Record<string, unknown> }
}

describe('n8n 模型页薄壳(直载 n8n-model/N8nModelScreen)', () => {
  beforeEach(() => {
    taroMocks.navigateTo.mockClear()
    taroMocks.navigateBack.mockClear()
    taroMocks.chooseMessageFile.mockClear()
  })

  it('① 共享屏真被渲染,主题根在壳外层', () => {
    const { html } = renderPage()
    expect(PAGE_SOURCE).toContain("from '@ihui/rn-app/features/n8n-model/N8nModelScreen'")
    expect(html).toContain('data-testid="shared-n8n-model"')
    expect(html).toContain('data-testid="theme-root"')
    expect(html.indexOf('data-testid="theme-root"')).toBeGreaterThanOrEqual(0)
    expect(html.indexOf('data-testid="shared-n8n-model"')).toBeGreaterThan(
      html.indexOf('data-testid="theme-root"'),
    )
  })

  it('② props 真到共享屏:列表态初值 + 9 个回调均为函数', () => {
    const { props } = renderPage()
    const p = props()
    expect(p.tab).toBe('all')
    expect(p.keyword).toBe('')
    expect(p.loading).toBe(false)
    expect(p.refreshing).toBe(false)
    expect(p.error).toBe('')
    expect(p.colorScheme).toBe('light')
    expect(p.showStatistics).toBe(false)
    expect(Array.isArray(p.items)).toBe(true)
    for (const key of [
      'onSelectTab',
      'onKeywordChange',
      'onRefresh',
      'onRetry',
      'onToggle',
      'onEdit',
      'onCreate',
      'onBack',
      'onOpen',
    ]) {
      expect(typeof p[key]).toBe('function')
    }
  })

  it('③ onOpen / onEdit 真走详情页,onBack 真回退', () => {
    const { props } = renderPage()
    const p = props()
    ;(p.onOpen as (item: { id: string }) => void)({ id: 'w1' })
    expect(taroMocks.navigateTo).toHaveBeenCalledWith({
      url: '/pkg-ai/ai-assistant-n8n/index?id=w1',
    })
    ;(p.onEdit as (item: { id: string }) => void)({ id: 'w2' })
    expect(taroMocks.navigateTo).toHaveBeenCalledWith({
      url: '/pkg-ai/ai-assistant-n8n/index?id=w2',
    })
    ;(p.onBack as () => void)()
    expect(taroMocks.navigateBack).toHaveBeenCalled()
  })

  it('④ 页源码锁:列表实现与参数行已出壳,只留创建表单入口与共享屏', () => {
    expect(PAGE_SOURCE).not.toContain('<N8nListView')
    expect(PAGE_SOURCE).not.toContain('WorkflowCard')
    expect(PAGE_SOURCE).not.toContain('FocusInput')
    expect(PAGE_SOURCE).not.toContain('FocusTextarea')
    expect(PAGE_SOURCE).not.toContain('<ScrollView')
    expect(PAGE_SOURCE).not.toContain('renderParamList')
    expect(PAGE_SOURCE).not.toContain('className="nm-header"')

    expect(PAGE_SOURCE).toContain('renderCreateView(')
    expect(PAGE_SOURCE).toContain('onOpen={')
    expect(PAGE_SOURCE).toContain('@ihui/rn-app/features/n8n-model/N8nModelScreen')
    expect(PAGE_SOURCE).toContain("get('/workflows/n8n')")
    expect(PAGE_SOURCE).toContain('useUiField')
  })

  it('⑤ AST 锁:页内 JSX 仅 ThemeRoot 元素 + 共享屏自闭合,无片段/无文本', () => {
    const sourceFile = createSourceFile(
      'index.tsx',
      PAGE_SOURCE,
      ScriptTarget.Latest,
      true,
      ScriptKind.TSX,
    )
    let jsxElement = 0
    let jsxSelfClosing = 0
    let jsxFragment = 0
    let jsxText = 0
    const visit = (node: Node) => {
      if (isJsxElement(node)) jsxElement += 1
      else if (isJsxSelfClosingElement(node)) jsxSelfClosing += 1
      else if (isJsxFragment(node)) jsxFragment += 1
      else if (isJsxText(node) && node.text.trim().length > 0) jsxText += 1
      forEachChild(node, visit)
    }
    visit(sourceFile)

    expect(jsxElement).toBe(1)
    expect(jsxSelfClosing).toBe(1)
    expect(jsxFragment).toBe(0)
    expect(jsxText).toBe(0)
    expect(jsxElement + jsxSelfClosing + jsxFragment).toBeLessThanOrEqual(2)
  })

  it('⑥ 宿主模块锁:创建富表单留在端内,不引 RN 原语', () => {
    expect(HOST_SOURCE).toContain('FocusInput')
    expect(HOST_SOURCE).toContain('renderParamList')
    expect(HOST_SOURCE).toContain('nm-param')
    expect(HOST_SOURCE).toContain('nm-file-btn')
    expect(HOST_SOURCE).not.toContain('@ihui/rn-app')
    expect(HOST_SOURCE).not.toContain('react-native')
  })

  it('⑦ 共享屏源码锁:onOpen 承接 + showStatistics 闸(缺省 true / 端内显式 false)', () => {
    expect(SHARED_SOURCE).toContain('onOpen')
    expect(SHARED_SOURCE).toContain('disabled={!onOpen}')
    expect(SHARED_SOURCE).toContain('showStatistics = true')
    expect(SHARED_SOURCE).not.toContain('hasMeta')
    expect(SHARED_SOURCE).toMatch(/showStatistics \? \(/)
    expect(SHARED_SOURCE).toContain('typeof item.calls')
    expect(SHARED_SOURCE).not.toContain('Taro')
    expect(SHARED_SOURCE).not.toContain('wx.')
    expect(SHARED_SOURCE).not.toContain('navigateTo')
    expect(PAGE_SOURCE).toContain('showStatistics={false}')
    expect(PAGE_SOURCE).toContain('calls: 0')
    expect(PAGE_SOURCE).toContain('paramsIn: 0')
    expect(PAGE_SOURCE).toContain('paramsOut: 0')
  })

  it('⑧ RN 消费点锁:onOpen 与 onEdit 同指 handleEdit', () => {
    expect(RN_SOURCE).toContain('onOpen={handleEdit}')
  })
})
