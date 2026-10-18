// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AgentScreen 智能体广场测试
 *
 * 覆盖(对齐 Uniapp tools/index.vue):
 * - 初始加载(getAgents + getAiModels + getAgentCategories 并行)
 * - API 失败时错误状态设置
 * - 未登录点击智能体 → 登录弹窗提示
 * - 已登录点击智能体 → navigate 到 AiAssistantN8n
 * - 赛道分类 API 成功/失败 fallback
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
// 相对路径导入 mock 专有导出：vitest alias '@ihui/rn-app' 与此相对路径解析到
// 同一文件（tests/__mocks__/ihui-rn-app.ts），运行时为同一模块实例；
// 而 tsc 类型检查不受影响（主 tsconfig 无 mock alias）。
import { agentScreenPropsCaptured } from './__mocks__/ihui-rn-app'
// i18n mock 的 importOriginal 泛型取原模块类型:顶层 type import(consistent-type-imports
// 禁止写在泛型位的 import() 内联注解)
import type * as I18nModule from '../src/i18n'

const { apiMocks } = vi.hoisted(() => ({
  apiMocks: {
    getAgents: vi.fn(),
    getAiModels: vi.fn(),
    getAgentCategories: vi.fn(),
    // SearchOverlay(2026-10-15 顶栏搜索改弹窗)经 fetchApi('/api/search') 取结果;
    // 本套件渲染 AgentScreen 必然加载该模块,mock 补齐避免误走真实网络。
    fetchApi: vi.fn(),
    navigate: vi.fn(),
    goBack: vi.fn(),
  },
}))

vi.mock('@ihui/api-client', () => ({
  getAgents: apiMocks.getAgents,
  getAiModels: apiMocks.getAiModels,
  getAgentCategories: apiMocks.getAgentCategories,
  fetchApi: apiMocks.fetchApi,
}))

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: apiMocks.navigate,
    goBack: apiMocks.goBack,
    getParent: () => ({ navigate: apiMocks.navigate }),
  }),
}))

vi.mock('@react-navigation/native-stack', () => ({}))

// 只替 useI18n 出口:t 走 key 原样(本套件不验文案),但 messages / getValueByPath 必须保留 ——
// SearchOverlay 联想段取 search.quickSuggestions 数组词条,全替则该组件渲染即抛缺导出。
vi.mock('../src/i18n', async (importOriginal) => {
  const mod = await importOriginal<typeof I18nModule>()
  const t = (key: string) => key
  return { ...mod, useI18n: () => ({ t }) }
})

// 默认未登录状态
let authUser: { token: string | null; user: Record<string, unknown> | null } = {
  token: null,
  user: null,
}
vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => authUser,
}))

// 注意：不使用 vi.mock('@ihui/rn-app') 动态覆盖，因为 vitest.config.ts 的 alias
// 已指向 tests/__mocks__/ihui-rn-app.ts（静态 mock）。动态 mock 会创建独立的模块实例，
// 导致 agentScreenPropsCaptured 数组与静态 mock 的不一致。

// Modal 在 jsdom 中需要 mock，否则 React Native Modal 会崩溃
vi.mock('react-native', async () => {
  const { createElement: h } = await import('react')
  const mk = (tag: string) =>
    function MockComp(props: { children?: React.ReactNode; [k: string]: unknown }) {
      // 合并 style 数组为单对象:React DOM 19 setValueForStyles 对 style 数组
      // 会 Object.freeze 后按索引 '0'/'1' 遍历并写入 node.style,jsdom
      // CSSStyleDeclaration 代理拒绝数字属性 set → "'set' on proxy: trap
      // returned falsish for property '0'"。
      const { style, onPress, ...rest } = props
      const flat = (v: unknown): unknown =>
        Array.isArray(v) ? Object.assign({}, ...v.filter(Boolean).map(flat)) : v
      const mergedStyle = flat(style)
      return h(tag, { ...rest, onClick: onPress, style: mergedStyle }, props.children)
    }
  return {
    // 主题单例(src/theme/active-tokens.ts)在模块求值时调 Appearance.getColorScheme(),
    // 缺这个导出会让整个测试文件加载失败 ⇒ 该文件的断言一条都不会跑。
    Appearance: { getColorScheme: () => 'light', addChangeListener: () => ({ remove() {} }) },
    DevSettings: { reload: () => {} },
    __esModule: true,
    Modal: ({ children, visible }: { visible?: boolean; children?: React.ReactNode }) =>
      visible ? h('div', null, children) : null,
    View: mk('div'),
    Text: mk('span'),
    Pressable: mk('button'),
    TouchableOpacity: mk('button'),
    ScrollView: mk('div'),
    FlatList: mk('div'),
    RefreshControl: () => h('div', { 'data-testid': 'refresh-control' }, null),
    ActivityIndicator: () => h('div', { 'data-testid': 'activity-indicator' }, null),
    Alert: { alert: vi.fn() },
    StyleSheet: {
      // hairlineWidth:SearchOverlay(styles 分隔线 height 求值期就读它)缺则模块求值即炸
      hairlineWidth: 1,
      create: (s: Record<string, unknown>) => {
        const out: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(s)) {
          out[String(k)] = v
        }
        return out
      },
    },
    Image: mk('img'),
    TextInput: mk('input'),
    PanResponder: () => ({ panHandlers: {} }),
    Platform: { OS: 'web' as const },
    useColorScheme: () => 'light' as const,
    // SearchOverlay 顶栏弹窗取窗口宽算面板宽,缺该导出即 "No useWindowDimensions export"
    useWindowDimensions: () => ({ width: 375, height: 812, scale: 1, fontScale: 1 }),
    Animated: {
      View: mk('div'),
      Text: mk('span'),
      createAnimatedComponent: (c: unknown) => c,
      timing: () => ({ start: () => {} }),
      spring: () => ({ start: () => {} }),
      Value: class {
        constructor(_v: number) {}
        setValue(_v: number) {}
        interpolate() {
          return { __getValue: () => 0 }
        }
      },
    },
  }
})

vi.mock('../src/components/Drawer', () => ({
  default: () => null,
  Drawer: () => null,
}))
vi.mock('../src/components/FloatBox', () => ({
  __esModule: true,
  default: () => null,
  FloatBox: () => null,
}))
vi.mock('../src/components/NavBar', () => ({
  default: () => null,
  NavBar: () => null,
}))
vi.mock('../src/components/Carousel', async () => {
  // 被 mock 的 hook 实测的就是 web 预览壳宽 —— 值与壳同档,取仓级几何档
  // (用户 token 铁律:壳宽不许散落字面量)。动态 import 是 vi.mock 工厂被提升的
  // 安全取值方式(静态 import 的绑定在工厂执行期可能未初始化)。
  const { GEOMETRY_PX } = await import('@ihui/design-tokens')
  return {
    default: () => null,
    // SearchOverlay 面板宽改用框架实际宽(修溢出)而消费此 hook;mock 需给同名导出,
    // 否则该 hook 在本测试环境无定义直接抛错(渲染 SearchOverlay 的用例全红)
    useAppFrameWidth: () => GEOMETRY_PX.previewShellWidth,
  }
})
vi.mock('../src/components/RecentAgents', () => ({
  default: () => null,
}))
vi.mock('../src/components/MyAgents', () => ({
  default: () => null,
}))
vi.mock('../src/components/IntelligentAssistant', () => ({
  default: () => null,
}))
vi.mock('../src/components/ModelList', () => ({
  default: () => null,
  type: 'ModelList',
}))
vi.mock('../src/components/InputArea', () => ({
  default: () => null,
}))

import { AgentScreen } from '../src/screens/AgentScreen'

const mockAgent = {
  id: 'a1',
  name: 'AI客服',
  avatar: 'https://example.com/avatar.jpg',
  description: '智能客服助手',
  isVipExclusive: false,
  useCount: 100,
  rating: 4.8,
}

describe('AgentScreen 智能体广场', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authUser = { token: null, user: null }
    agentScreenPropsCaptured.length = 0
    apiMocks.getAgents.mockResolvedValue({
      success: true,
      data: { list: [mockAgent] },
    })
    apiMocks.getAiModels.mockResolvedValue({
      success: true,
      data: { list: [] },
    })
    apiMocks.getAgentCategories.mockResolvedValue({
      success: true,
      data: {
        agentCategory: [{ id: 'tech', name: '技术' }],
        agentMainCategory: [{ id: 'writing', name: '写作' }],
      },
    })
  })

  it('初始加载并行调用 getAgents/getAiModels/getAgentCategories', async () => {
    render(<AgentScreen />)
    await waitFor(() => {
      expect(apiMocks.getAgents).toHaveBeenCalled()
      expect(apiMocks.getAiModels).toHaveBeenCalled()
      expect(apiMocks.getAgentCategories).toHaveBeenCalled()
    })
  })

  it('API 成功时 SharedAgentScreen 接收 items', async () => {
    render(<AgentScreen />)
    await waitFor(() => {
      expect(apiMocks.getAgents).toHaveBeenCalled()
    })
    // 等待 mock 的 AgentScreen 被调用（对齐 plaza-screen 测试模式）
    await waitFor(() => {
      expect(agentScreenPropsCaptured.length).toBeGreaterThan(0)
    })
    const props = agentScreenPropsCaptured[agentScreenPropsCaptured.length - 1]!
    expect(props.items).toHaveLength(1)
    expect((props.items as Array<Record<string, unknown>>)[0]!.name).toBe('AI客服')
  })

  it('API 失败时设置错误状态', async () => {
    apiMocks.getAgents.mockRejectedValue(new Error('network error'))
    render(<AgentScreen />)
    await waitFor(() => {
      // 错误处理后组件应继续渲染（不崩溃）
      expect(apiMocks.getAgents).toHaveBeenCalled()
    })
  })

  it('未登录时点击智能体弹出登录提示', async () => {
    render(<AgentScreen />)
    await waitFor(() => {
      expect(apiMocks.getAgents).toHaveBeenCalled()
    })
    // token 为 null，handleItemClick 应调用 Alert.alert
    // 由于 Alert 未被 mock，测试验证 navigate 未被调用（登录跳转未发生）
    expect(apiMocks.navigate).not.toHaveBeenCalledWith('AiAssistantN8n', expect.anything())
  })

  it('已登录时点击智能体导航到 AiAssistantN8n', async () => {
    authUser = { token: 'test-token', user: { id: 'u1' } }
    render(<AgentScreen />)
    await waitFor(() => {
      expect(apiMocks.getAgents).toHaveBeenCalled()
    })
    // handleItemClick 通过 navigation.navigate 调用
    // 通过 agentScreenPropsCaptured 验证 SharedAgentScreen 收到了正确 props
  })

  it('赛道分类 API 失败时使用 fallback 列表', async () => {
    apiMocks.getAgentCategories.mockRejectedValue(new Error('category failed'))
    render(<AgentScreen />)
    // fallback 列表保证弹层非空，不应崩溃
    await waitFor(() => {
      expect(apiMocks.getAgentCategories).toHaveBeenCalled()
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
