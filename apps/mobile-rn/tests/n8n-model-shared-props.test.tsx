// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * A 方案回归锁:RN N8nModelScreen 必须**真消费**共享屏 n8n-model/N8nModelScreen 的 props。
 *
 * 与小程序薄壳形成可见差异:RN 接口回 calls/paramsIn/paramsOut 三个计数,必须原样映射;
 * onOpen 与 onEdit 同指 handleEdit(列表卡片整块可点 + 编辑按钮同一落点)。
 *  ① items[0] 的 calls/paramsIn/paramsOut 真传,status 取自 active;
 *  ② onOpen/onEdit 同函数且调用不抛错;
 *  ③ onBack 真走 navigation.goBack,onRefresh 为函数;
 *  ④ RN 源码不得回潮第二份列表实现;
 *  ⑤ 共享屏确有 onOpen 承接分支与 hasMeta 计数分支。
 *
 * mock 说明:RN 源文件按 barrel `@ihui/rn-app` 取共享屏,故内联工厂直接替换 barrel
 * (深路径 `@ihui/rn-app/features/n8n-model/N8nModelScreen` 不会被源文件解析,替身拦不到)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createElement } from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const captured = vi.hoisted(() => ({
  props: null as Record<string, unknown> | null,
}))

const apiMocks = vi.hoisted(() => ({
  getN8nWorkflows: vi.fn(),
  toggleN8nWorkflow: vi.fn(),
  createN8nWorkflow: vi.fn(),
  updateN8nWorkflow: vi.fn(),
}))

const navMocks = vi.hoisted(() => ({ navigate: vi.fn(), goBack: vi.fn() }))

vi.mock('@ihui/rn-app', () => ({
  N8nModelScreen: (props: Record<string, unknown>) => {
    captured.props = props
    return createElement('div', { 'data-testid': 'shared-n8n-model' })
  },
  TextField: () => createElement('input', { 'data-testid': 'text-field' }),
}))

vi.mock('@ihui/api-client', () => ({
  getN8nWorkflows: apiMocks.getN8nWorkflows,
  toggleN8nWorkflow: apiMocks.toggleN8nWorkflow,
  createN8nWorkflow: apiMocks.createN8nWorkflow,
  updateN8nWorkflow: apiMocks.updateN8nWorkflow,
}))

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: navMocks.navigate, goBack: navMocks.goBack }),
}))
vi.mock('@react-navigation/native-stack', () => ({}))
vi.mock('../src/context/ThemeContext', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }))
vi.mock('../src/i18n', () => ({
  useI18n: () => ({ locale: 'zh-CN', t: (key: string) => key }),
}))
vi.mock('../src/components/BottomPops', () => ({ appAlert: vi.fn() }))
vi.mock('../src/hooks', () => ({ useRefreshOnFocus: vi.fn() }))
vi.mock('../src/lib/use-ui-text-field', () => ({
  useUiTextField: () => ({ field: {}, onChange: vi.fn() }),
}))

import N8nModelScreen from '../src/screens/N8nModelScreen'

const RN_SOURCE = readFileSync(resolve('src/screens/N8nModelScreen.tsx'), 'utf8')
const SHARED_SOURCE = readFileSync(
  resolve('../../packages/app/src/features/n8n-model/N8nModelScreen.tsx'),
  'utf8',
)

const props = () => captured.props as Record<string, unknown>

const renderScreen = () => render(createElement(N8nModelScreen))

describe('RN N8nModelScreen 真消费共享屏 n8n-model/N8nModelScreen props(A 方案)', () => {
  beforeEach(() => {
    captured.props = null
    apiMocks.getN8nWorkflows.mockResolvedValue({
      success: true,
      data: {
        list: [
          {
            id: 'w1',
            name: 'A',
            description: 'd',
            active: true,
            url: 'https://x',
            calls: 3,
            paramsIn: 2,
            paramsOut: 1,
            updatedAt: '2026-01-01',
          },
        ],
      },
    })
    apiMocks.toggleN8nWorkflow.mockResolvedValue({ success: true })
    apiMocks.createN8nWorkflow.mockResolvedValue({ success: true })
    apiMocks.updateN8nWorkflow.mockResolvedValue({ success: true })
  })

  it('① items[0] 真带 calls/paramsIn/paramsOut 与 running 状态', async () => {
    renderScreen()
    await waitFor(() => expect(captured.props).not.toBeNull())
    await waitFor(() => {
      const items = props().items as Array<Record<string, unknown>>
      expect(items.length).toBe(1)
      expect(items[0]?.calls).toBe(3)
    })
    const item = (props().items as Array<Record<string, unknown>>)[0] as Record<string, unknown>
    expect(item.calls).toBe(3)
    expect(item.paramsIn).toBe(2)
    expect(item.paramsOut).toBe(1)
    expect(item.status).toBe('running')
    expect(props().showStatistics).toBe(true)
  })

  it('② onOpen 与 onEdit 同指 handleEdit,调用不抛错', async () => {
    renderScreen()
    await waitFor(() => expect(captured.props).not.toBeNull())
    const onOpen = props().onOpen as (item: Record<string, unknown>) => void
    const onEdit = props().onEdit as (item: Record<string, unknown>) => void
    expect(typeof onOpen).toBe('function')
    expect(onOpen).toBe(onEdit)
    expect(() =>
      act(() =>
        onOpen((props().items as Array<Record<string, unknown>>)[0] as Record<string, unknown>),
      ),
    ).not.toThrow()
  })

  it('③ onBack 真走 navigation.goBack,onRefresh 为函数', async () => {
    renderScreen()
    await waitFor(() => expect(captured.props).not.toBeNull())
    ;(props().onBack as () => void)()
    expect(navMocks.goBack).toHaveBeenCalled()
    expect(typeof props().onRefresh).toBe('function')
  })

  it('④ RN 源码锁:不回流第二份列表实现', () => {
    expect(RN_SOURCE).toContain('onOpen={handleEdit}')
    expect(RN_SOURCE).not.toContain('<N8nListView')
    expect(RN_SOURCE).not.toContain('<FunctionBlockColumn')
  })

  it('⑤ 共享屏承接分支锁:onOpen 整卡可点 + showStatistics 计数闸(RN 显式 true)', () => {
    expect(SHARED_SOURCE).toContain('onOpen?.(item)')
    expect(SHARED_SOURCE).toContain('showStatistics = true')
    expect(SHARED_SOURCE).not.toContain('hasMeta')
    expect(RN_SOURCE).toContain('showStatistics={true}')
  })
})
