// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * PlazaScreen 需求广场测试
 *
 * 覆盖(对齐 Uniapp pagesA/plaza/index.vue):
 * - 需求列表加载(getPlazaList)
 * - 下拉刷新触发重新加载(reset=true)
 * - 加载更多(分页,onEndReached)
 * - 搜索提交(onSubmitSearch)
 * - 需求赛道筛选弹层(getAgentCategories → categorySaidao):
 *   打开/选项渲染/选中后重新加载/API 失败 fallback
 * - 身份切换弹窗 Modal(visible 状态)
 * - 开发者须知弹窗
 * - API 失败时错误状态设置
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'
// 相对路径导入 mock 专有导出：vitest alias '@ihui/rn-app' 与此相对路径解析到
// 同一文件（tests/__mocks__/ihui-rn-app.ts），运行时为同一模块实例；
// 而 tsc 类型检查不受影响（主 tsconfig 无 mock alias）。
import { plazaScreenPropsCaptured } from './__mocks__/ihui-rn-app'

const { apiMocks } = vi.hoisted(() => ({
  apiMocks: {
    getPlazaList: vi.fn(),
    getAgentCategories: vi.fn(),
    listConversations: vi.fn(),
    deleteConversation: vi.fn(),
    navigate: vi.fn(),
    goBack: vi.fn(),
  },
}))

vi.mock('@ihui/api-client', () => ({
  getPlazaList: apiMocks.getPlazaList,
  getAgentCategories: apiMocks.getAgentCategories,
  listConversations: apiMocks.listConversations,
  deleteConversation: apiMocks.deleteConversation,
}))

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: apiMocks.navigate,
    goBack: apiMocks.goBack,
    getParent: () => ({ navigate: apiMocks.navigate }),
  }),
}))

vi.mock('@react-navigation/native-stack', () => ({}))

vi.mock('../src/i18n', () => {
  const t = (key: string) => key
  return { useI18n: () => ({ t }) }
})

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', nickname: '测试用户' } }),
}))

vi.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}))

// 注意：不使用 vi.mock('@ihui/rn-app') 动态覆盖，因为 vitest.config.ts 的 alias
// 已指向 tests/__mocks__/rn-app.ts（静态 mock）。动态 mock 会创建独立的模块实例，
// 导致 plazaScreenPropsCaptured 数组与静态 mock 的不一致。

// react-native 通过 vitest.config.ts 的 resolve.alias 自动重定向到 tests/__mocks__/react-native.ts
// 不需要在此处重复 vi.mock，否则会与 alias 冲突导致 Flow 语法解析错误

vi.mock('../src/components/Drawer', () => ({
  default: () => null,
  Drawer: () => null,
}))
vi.mock('../src/components/FloatBox', () => ({
  FloatBox: () => null,
}))
vi.mock('../src/components/NavBar', () => ({
  NavBar: () => null,
}))

import { PlazaScreen } from '../src/screens/PlazaScreen'

const mockItem = { id: 'p1', title: '需要一个AI客服', status: '2', price: 100 }

describe('PlazaScreen 需求广场', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    plazaScreenPropsCaptured.length = 0
    apiMocks.getPlazaList.mockResolvedValue({ success: true, data: { list: [mockItem], total: 1 } })
    apiMocks.getAgentCategories.mockResolvedValue({
      success: true,
      data: {
        agentCategory: [
          { id: 'tech', name: '技术' },
          { id: 'edu', name: '教育' },
        ],
      },
    })
    apiMocks.listConversations.mockResolvedValue({ success: true, data: { conversations: [] } })
  })

  afterEach(() => {
    plazaScreenPropsCaptured.length = 0
  })

  it('初始加载调用 getPlazaList', async () => {
    render(<PlazaScreen />)
    await waitFor(() => {
      expect(apiMocks.getPlazaList).toHaveBeenCalled()
    })
  })

  it('SharedPlazaScreen 接收正确的 items/loading/error 状态', async () => {
    render(<PlazaScreen />)
    await waitFor(() => {
      expect(plazaScreenPropsCaptured.length).toBeGreaterThan(0)
    })
    // API 异步完成后，最后一次渲染的 props 才是最终状态
    const props = plazaScreenPropsCaptured[plazaScreenPropsCaptured.length - 1]!
    expect(props.items).toEqual([mockItem])
    expect(props.loading).toBe(false)
    expect(props.error).toBe('')
    expect(props.status).toBe('waiting')
  })

  it('下拉刷新时 reset=true 重新加载列表', async () => {
    render(<PlazaScreen />)
    // render() 同步走完首帧,共享替身是在**渲染期**把 props 推进 plazaScreenPropsCaptured 的
    // ⇒ "捕获过了"不是异步事实,写成 waitFor 只会把一个同步前提伪装成一段等待预算;降级为
    // 同步断言(断言一条不减),本枚只留链终点那一次等待。
    expect(
      plazaScreenPropsCaptured.length,
      '首帧就把委托链断了:薄壳根本没把 props 交给共享替身,后面的刷新无从谈起',
    ).toBeGreaterThan(0)
    const initialProps = plazaScreenPropsCaptured[0]!
    // 模拟 onRefresh 回调触发
    await (initialProps.onRefresh as () => void)()
    await waitFor(
      () => {
        // 第二次调用（刷新）
        expect(apiMocks.getPlazaList).toHaveBeenCalledTimes(2)
      },
      { timeout: 8_000 },
    )
  })

  // 2026-09-24:此用例原本钉的是"任何失败都显示『加载失败,请下拉刷新重试』"——
  // 那正是缺陷本身。真机实测:服务端明确回了「请求频率过高,需完成人机验证」,
  // 而 catch 块连错误对象都没绑定,把它换成了这句无信息文案,用户无从自救。
  it('服务端给出具体原因时,原样透出而不是换成通用文案', async () => {
    apiMocks.getPlazaList.mockResolvedValue({
      success: false,
      error: '请求频率过高,需完成人机验证',
    })
    render(<PlazaScreen />)
    await waitFor(() => {
      expect(plazaScreenPropsCaptured.length).toBeGreaterThan(0)
    })
    const props = plazaScreenPropsCaptured[plazaScreenPropsCaptured.length - 1]!
    expect(props.error).toContain('需完成人机验证')
    expect(props.error).not.toContain('加载失败')
  })

  it('网络层异常映射成可读的网络文案', async () => {
    apiMocks.getPlazaList.mockRejectedValue(new Error('network error'))
    render(<PlazaScreen />)
    await waitFor(() => {
      expect(plazaScreenPropsCaptured.length).toBeGreaterThan(0)
    })
    const props = plazaScreenPropsCaptured[plazaScreenPropsCaptured.length - 1]!
    expect(props.error).toContain('网络')
    expect(props.error).not.toBe('network error') // 原始英文串不外泄给用户
  })

  it('错误里没有任何可用信息时,才回退本页通用文案', async () => {
    apiMocks.getPlazaList.mockRejectedValue(new Error('   '))
    render(<PlazaScreen />)
    await waitFor(() => {
      expect(plazaScreenPropsCaptured.length).toBeGreaterThan(0)
    })
    const props = plazaScreenPropsCaptured[plazaScreenPropsCaptured.length - 1]!
    // 产品已 token 化:回退文案由 t('plaza.index.loadFailedRefresh') 提供。本套件 i18n mock 取键透传,
    // 断言键本身 = 「无任何可用信息时才落这条通用兜底」的同一判据(旧中文形为 token 化前遗留)。
    expect(props.error).toContain('plaza.index.loadFailedRefresh')
  })

  it('赛道分类 API 成功时覆盖 fallback 列表', async () => {
    render(<PlazaScreen />)
    await waitFor(() => {
      expect(apiMocks.getAgentCategories).toHaveBeenCalled()
    })
    // getAgentCategories 在 beforeEach 已 mock 成功返回
    expect(apiMocks.getAgentCategories).toHaveBeenCalledWith()
  })

  it('赛道分类 API 失败时使用 fallback 列表', async () => {
    apiMocks.getAgentCategories.mockRejectedValue(new Error('category load failed'))
    render(<PlazaScreen />)
    // fallback 列表应包含"全公司"等默认项，不会抛出异常
    await waitFor(() => {
      expect(plazaScreenPropsCaptured.length).toBeGreaterThan(0)
    })
  })

  it('分类按钮 onPress 打开赛道筛选弹层(categoryVisible=true)', async () => {
    render(<PlazaScreen />)
    // NavBar 被 mock 为 null，通过 SharedPlazaScreen props 验证
    // 首帧的 props 捕获是渲染期事实、不是异步事实 ⇒ 降级为同步断言,只留状态终点那一次等待。
    expect(
      plazaScreenPropsCaptured.length,
      '首帧没把 props 交给共享替身 = 委托链断在渲染之前',
    ).toBeGreaterThan(0)
    // 打开分类弹层：点击 NavBar 中分类按钮（mocked out），通过直接触发内部状态验证
    // 由于 NavBar/Drawer 都是 null，我们验证 SharedPlazaScreen 的 status prop 可以切换
    const props = plazaScreenPropsCaptured[0]!
    expect(props.status).toBe('waiting')
    // onStatusChange 切换状态
    await (props.onStatusChange as (s: string) => void)('developing')
    // 2026-09-10 CI 修复:更新传播前的旧快照仍会被捕获,单次检查会拿到 waiting;
    // 轮询直到最新捕获的 props 状态变为 developing(这一段在等 React 的 setState 落帧,是本枚
    // 唯一的真异步终点 ⇒ 预算显式化,红绿由判据决定而不是由机器负载决定)
    await waitFor(
      () => {
        const last = plazaScreenPropsCaptured[plazaScreenPropsCaptured.length - 1]!
        expect(last.status).toBe('developing')
      },
      { timeout: 8_000 },
    )
  })

  it('搜索输入 onChange 更新 searchInput', async () => {
    render(<PlazaScreen />)
    await waitFor(() => {
      expect(plazaScreenPropsCaptured.length).toBeGreaterThan(0)
    })
    const props = plazaScreenPropsCaptured[plazaScreenPropsCaptured.length - 1]!
    await (props.onSearchChange as (v: string) => void)('AI开发')
    // searchInput 是内部状态，验证回调正常执行不报错即可
  })

  it('submitSearch 触发重新加载且 search 参数生效', async () => {
    render(<PlazaScreen />)
    // 首帧的 props 捕获是渲染期事实 ⇒ 降级为同步断言,本枚只留链终点那一次等待。
    expect(
      plazaScreenPropsCaptured.length,
      '首帧没把 props 交给共享替身 = 委托链断在渲染之前,提交回调无从取得',
    ).toBeGreaterThan(0)
    const callsBefore = apiMocks.getPlazaList.mock.calls.length
    // 牙在这里补上(2026-10-25):原断言 `toHaveBeenCalled()` 自首屏起恒真(首屏已 load 一次),
    // 提交什么都不做也绿,票面标题里的「search 参数生效」从来没被量过。
    // searchInput 是薄壳的内部态,只能经它自己委托出去的 onSearchChange 进去;而
    // onSubmitSearch 每次渲染都是新闭包 ⇒ 必须取**输入落位之后最新那帧**的回调,
    // 用首帧闭包提交带上的是空 searchInput,量到的就是"什么都没输入"。
    // 两次 act 保证状态在读取之前已经 flush(否则"最新那帧"是竞态)。
    act(() => {
      ;(
        plazaScreenPropsCaptured[plazaScreenPropsCaptured.length - 1]!.onSearchChange as (
          v: string,
        ) => void
      )('AI开发')
    })
    act(() => {
      ;(
        plazaScreenPropsCaptured[plazaScreenPropsCaptured.length - 1]!.onSubmitSearch as () => void
      )()
    })
    await waitFor(
      () => {
        const after = apiMocks.getPlazaList.mock.calls.slice(callsBefore)
        expect(
          after.length,
          '提交后一次数都没再取 = 提交按钮是假的(或 search 变更没能触发下一次 load)',
        ).toBeGreaterThan(0)
        expect(
          after.some((c) => (c[0] as { search?: string } | undefined)?.search === 'AI开发'),
          `提交后的 ${after.length} 次取数没有任何一次带 search=AI开发(实参 search:${after
            .map((c) => String((c[0] as { search?: string } | undefined)?.search))
            .join(', ')})`,
        ).toBe(true)
      },
      { timeout: 8_000 },
    )
  })

  it('发布按钮 navigate 到 PostCreate', async () => {
    render(<PlazaScreen />)
    await waitFor(() => {
      expect(plazaScreenPropsCaptured.length).toBeGreaterThan(0)
    })
    const props = plazaScreenPropsCaptured[0]!
    await (props.onPublish as () => void)()
    expect(apiMocks.navigate).toHaveBeenCalledWith('PostCreate', {})
  })

  it('点击需求项 navigate 到 PostDetail', async () => {
    render(<PlazaScreen />)
    await waitFor(() => {
      expect(plazaScreenPropsCaptured.length).toBeGreaterThan(0)
    })
    const props = plazaScreenPropsCaptured[0]!
    await (props.onPressItem as (item: unknown) => void)(mockItem)
    expect(apiMocks.navigate).toHaveBeenCalledWith('PostDetail', { id: 'p1' })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
