// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SearchOverlay 顶栏搜索弹层测试(2026-10-15 用户定:三入口统一弹窗、弹窗内直接出结果)
 *
 * 覆盖:
 * - 无输入三段:历史段(预置 AsyncStorage 'searchHistory')+ 清空按钮 + 段间留白 + 热门段(POPULAR_SEARCHES)
 * - 有输入切联想段:quickSuggestions 过滤(忽略大小写/includes)
 * - 提交:写历史(AsyncStorage 'searchHistory',与 web 同 key)+ fetchApi('/api/search?keyword=') + 结果卡
 * - 结果卡点击 → 按类型映射进详情页 + 关弹窗(routeForResult)
 * - 遮罩点击 → 关闭(backdrop 全屏可点关闭)
 * - 无分割线回归锁(2026-10-23 跨端同批撤线,AGENTS §4 禁分割线):组件源码不得再出现
 *   divider 样式键 / 单边描边 / hairlineWidth 取宽
 *
 * 说明:历史写入是 fire-and-forget(addHistory 内 void push),故对持久化断言用 waitFor。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { render, waitFor, fireEvent, act } from '@testing-library/react'
import AsyncStorage from '@react-native-async-storage/async-storage'

const { apiMocks, onCloseMock, navigateMock } = vi.hoisted(() => ({
  apiMocks: { fetchApi: vi.fn() },
  onCloseMock: vi.fn(),
  navigateMock: vi.fn(),
}))

vi.mock('@ihui/api-client', () => ({
  fetchApi: apiMocks.fetchApi,
}))

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: navigateMock,
    goBack: vi.fn(),
    getParent: () => ({ navigate: navigateMock }),
  }),
}))

// 主题单例换成确定值(真实 ThemeContext 走 zustand persist,与本票无关)
vi.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({ resolvedTheme: 'light', themeMode: 'light', setThemeMode: vi.fn() }),
}))

// i18n:只替 useI18n 出口(免挂 Provider,locale 固定 zh-CN),
// messages / getValueByPath 走**真实合并表** —— SearchOverlay 的联想段取
// search.quickSuggestions 数组词条,替了它就测不到真实词条;
// t() 也按真表解析(key 原样返回会让「热门搜索」等可见文案断言变成断 key 名)。
vi.mock('../src/i18n', async (importOriginal) => {
  const mod = await importOriginal<typeof I18nModule>()
  const t = (key: string): string => {
    const v = mod.getValueByPath(mod.messages['zh-CN'], key)
    return typeof v === 'string' ? v : key
  }
  return {
    ...mod,
    useI18n: () => ({ locale: 'zh-CN' as const, setLocale: async () => {}, t }),
  }
})

// react-native 走共享替身 tests/__mocks__/react-native.ts —— 它已覆盖本组件全部 API 面:
// Pressable children 渲染函数、onChangeText/onSubmitEditing(Enter) 受控接线、
// accessibilityLabel → aria-label(遮罩/清空/词条行靠它检索)。
// 不在此另建替身(各建一份即各测一份)。

import { SearchOverlay } from '../src/components/SearchOverlay'
import type { SearchScreenItem } from '@ihui/rn-app'
import type * as I18nModule from '../src/i18n'
import { POPULAR_SEARCHES } from '@ihui/shared/utils/search-suggestions'

function renderOverlay(extra: { onPressItem?: (item: SearchScreenItem) => void } = {}) {
  return render(
    <SearchOverlay visible onClose={onCloseMock} {...(extra.onPressItem ? { onPressItem: extra.onPressItem } : {})} />,
  )
}

/** 预置历史(AsyncStorage 'searchHistory' 与 web localStorage 同 key) */
function seedHistory(items: string[]): void {
  ;(AsyncStorage as unknown as { __store: Map<string, string> }).__store.set(
    'searchHistory',
    JSON.stringify(items),
  )
}

describe('SearchOverlay 三段面板', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    onCloseMock.mockClear()
    navigateMock.mockClear()
  })

  it('无输入:历史段(预置)+ 清空按钮 + 热门段(POPULAR_SEARCHES 全量)', async () => {
    seedHistory(['旧搜索词'])
    renderOverlay()
    // 历史水合是异步(读 AsyncStorage → setList)
    await waitFor(() => expect(document.body.textContent).toContain('旧搜索词'))
    expect(document.body.textContent).toContain('搜索历史')
    expect(document.body.textContent).toContain('热门搜索')
    // 清空按钮(aria-label)
    expect(document.querySelector('[aria-label="清空历史"]')).toBeTruthy()
    // 热门段词条全量渲染(与 web 同一个 POPULAR_SEARCHES 池)
    for (const word of POPULAR_SEARCHES) {
      expect(document.body.textContent).toContain(word)
    }
    // 联想段此刻不渲染(无输入 = 静默段,联想词行不存在)
    expect(document.querySelector('[aria-label="对话历史"]')).toBeNull()
  })

  it('无历史:只渲染热门段,不渲染历史段标题', async () => {
    renderOverlay()
    await waitFor(() => expect(document.body.textContent).toContain('热门搜索'))
    expect(document.body.textContent).not.toContain('搜索历史')
  })

  it('有输入:切联想段(quickSuggestions 过滤,历史/热门段下线)', async () => {
    renderOverlay()
    const input = document.querySelector('input')
    expect(input).toBeTruthy()
    // 静默段本有热门段
    await waitFor(() => expect(document.body.textContent).toContain('热门搜索'))
    // 「设置」在 zh-CN quickSuggestions 里;输入后联想段出现该词行,且历史/热门段整体下线
    fireEvent.change(input!, { target: { value: '设置' } })
    await waitFor(() => {
      expect(document.querySelector('[aria-label="设置"]')).toBeTruthy()
      expect(document.body.textContent).not.toContain('热门搜索')
    })
    // 输入不匹配任何联想词 → 联想段空(段内无词条行)
    fireEvent.change(input!, { target: { value: 'zzz-不存在的词' } })
    await waitFor(() => {
      expect(document.querySelector('[aria-label="设置"]')).toBeNull()
    })
  })
})

describe('SearchOverlay 提交与结果', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    onCloseMock.mockClear()
    navigateMock.mockClear()
  })

  it('提交:写历史(同 web key)+ fetchApi /api/search + 弹窗内出结果卡', async () => {
    apiMocks.fetchApi.mockResolvedValue({
      success: true,
      data: [{ id: 'c1', type: 'course', title: 'React 入门课', summary: '从零学 React' }],
    })
    renderOverlay()
    const input = document.querySelector('input')!
    fireEvent.change(input, { target: { value: 'React 入门' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(apiMocks.fetchApi).toHaveBeenCalledWith(
        '/api/search?keyword=' + encodeURIComponent('React 入门'),
      )
    })
    // 弹窗内直接出结果(不跳全屏搜索页 → 未调用导航)
    expect(navigateMock).not.toHaveBeenCalled()
    await waitFor(() => expect(document.body.textContent).toContain('React 入门课'))
    expect(document.body.textContent).toContain('从零学 React')
    // 历史持久化(异步 fire-and-forget):同 web 的 'searchHistory' key,含 trim 后关键词
    await waitFor(() => {
      const written = (AsyncStorage as unknown as { __store: Map<string, string> }).__store.get(
        'searchHistory',
      )
      expect(written ?? '').toContain('React 入门')
    })
  })

  it('点结果卡(course)→ navigate CourseDetail + 关弹窗', async () => {
    apiMocks.fetchApi.mockResolvedValue({
      success: true,
      data: [{ id: 'c9', type: 'course', title: '课名', summary: '摘要' }],
    })
    renderOverlay()
    const input = document.querySelector('input')!
    fireEvent.change(input, { target: { value: '课名' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(document.body.textContent).toContain('课名'))
    // 结果卡 = 带 aria-role 的 button(标题文本在卡内)
    const card = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('课名'),
    )
    expect(card, '结果卡未渲染').toBeTruthy()
    fireEvent.click(card!)
    expect(navigateMock).toHaveBeenCalledWith('CourseDetail', { id: 'c9' })
    expect(onCloseMock).toHaveBeenCalled()
  })

  it('onPressItem 覆盖口:调用方接管点击,不再走默认路由', async () => {
    apiMocks.fetchApi.mockResolvedValue({
      success: true,
      data: [{ id: 'a1', type: 'agent', title: '助手', summary: 'AI 助手' }],
    })
    const custom = vi.fn()
    renderOverlay({ onPressItem: custom })
    const input = document.querySelector('input')!
    fireEvent.change(input, { target: { value: '助手' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(document.body.textContent).toContain('助手'))
    const card = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('助手'),
    )!
    fireEvent.click(card)
    expect(custom).toHaveBeenCalledTimes(1)
    expect(navigateMock).not.toHaveBeenCalled()
    expect(onCloseMock).toHaveBeenCalled()
  })

  it('搜索失败:弹窗内出错误态(不跳页)', async () => {
    apiMocks.fetchApi.mockResolvedValue({ success: false, error: '网络异常' })
    renderOverlay()
    const input = document.querySelector('input')!
    fireEvent.change(input, { target: { value: '任意词' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(document.body.textContent).toContain('网络异常'))
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('搜索空结果:弹窗内出 search.empty 文案', async () => {
    apiMocks.fetchApi.mockResolvedValue({ success: true, data: [] })
    renderOverlay()
    const input = document.querySelector('input')!
    fireEvent.change(input, { target: { value: '绝无此词' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(document.body.textContent).toContain('未找到相关内容'))
  })
})

describe('SearchOverlay 关闭', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    onCloseMock.mockClear()
    navigateMock.mockClear()
  })

  it('点遮罩(backdrop)→ onClose', async () => {
    renderOverlay()
    const backdrop = document.querySelector('[aria-label="关闭"]')
    expect(backdrop, '遮罩未渲染(aria-label=common.close 缺失)').toBeTruthy()
    fireEvent.click(backdrop!)
    expect(onCloseMock).toHaveBeenCalledTimes(1)
  })

  it('关闭后重开是干净态:输入与结果被清空(handleClose 清 state)', async () => {
    apiMocks.fetchApi.mockResolvedValue({
      success: true,
      data: [{ id: 'c1', type: 'course', title: '残留标题', summary: 'x' }],
    })
    const { rerender } = renderOverlay()
    const input = document.querySelector('input')!
    fireEvent.change(input, { target: { value: '残留词' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(document.body.textContent).toContain('残留标题'))
    // 关遮罩 → handleClear 清空 → visible 变 false 卸载;重开(visible true)应无残留
    fireEvent.click(document.querySelector('[aria-label="关闭"]')!)
    expect(onCloseMock).toHaveBeenCalled()
    await act(async () => {
      rerender(<SearchOverlay visible={false} onClose={onCloseMock} />)
    })
    await act(async () => {
      rerender(<SearchOverlay visible onClose={onCloseMock} />)
    })
    expect(document.body.textContent).not.toContain('残留标题')
    const reopened = document.querySelector('input') as HTMLInputElement
    expect(reopened.value).toBe('')
  })
})

/**
 * 撤线回归锁(2026-10-23,与 web 侧 search-suggestions-no-divider.test.tsx 对位):
 * 段间节奏已改为纯留白(sectionGap 8px,web `SectionDivider` 的 `h-2` 档)。若有人把线写回来,
 * 形态必落三型之一 —— ① divider 样式键(守门 check-no-divider 的 RN 样式对象判据面)、
 * ② 单边 border 宽度键(分割线的 RN 书写形态)、③ StyleSheet.hairlineWidth 取宽(本组件原线宽来源);
 * 三者任一命中即红,回退无法安静通过。分组可辨性由两段可见标题承担(上方「无输入三段」用例已钉)。
 */
describe('SearchOverlay 段间无分割线(撤线回归锁)', () => {
  it('组件源码不得再出现 divider 样式键 / 单边描边 / hairlineWidth 取宽', () => {
    // 路径解析照 tests/api-client-alias-fidelity.test.ts 既有样板(fileURLToPath,非裸 new URL →
    // jsdom 环境下 readFileSync(URL) 报「The URL must be of scheme file」)
    const src = readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/components/SearchOverlay.tsx'),
      'utf8',
    )
    expect(src).not.toMatch(/\bdivider\b/)
    expect(src).not.toMatch(/border(Top|Bottom|Left|Right)Width/)
    expect(src).not.toMatch(/hairlineWidth/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
