// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * IpWhitelistPanel 的三条腿自证。
 *
 * 这个组件最容易出的两种事故都被钉住:
 *  ① "点了没反应"——请求根本没发出 / 发了但不回填;
 *  ② "失败了也当成功"——400 被吞掉、列表原地不动而界面没有任何交代。
 * 取词走真的 I18nProvider:断言的是词包里的文案,不是替身返回的键名。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement } from 'react'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
// @typescript-eslint/consistent-type-imports 禁止内联 import() 类型注解 ⇒ 用顶层 type 别名
import type * as I18nModule from '../src/i18n'

const api = vi.hoisted(() => ({ fetchApi: vi.fn() }))

vi.mock('@ihui/api-client', () => ({ fetchApi: api.fetchApi }))
vi.mock('lucide-react-native', () => ({ ShieldCheck: () => createElement('i', null) }))
// 输入框是共享组件(单源),这里只替成受控 DOM input —— 判据在请求链,不在它身上
vi.mock('@ihui/rn-app', () => ({
  TextField: ({ value, onChangeText }: { value: string; onChangeText: (t: string) => void }) =>
    createElement('input', {
      value,
      onChange: (e: { target: { value: string } }) => onChangeText(e.target.value),
    }),
}))

// 真词包取词,但 useI18n 必须返回**稳定引用**:面板里 load=useCallback([t]),
// 每次渲染发新对象会让 useEffect 反复重取,把 mockResolvedValueOnce 全吃光(实测就是这样假失败的)。
vi.mock('../src/i18n', async (importOriginal) => {
  const mod = await importOriginal<typeof I18nModule>()
  const t = (key: string) => {
    const v = mod.getValueByPath(mod.messages['zh-CN'], key)
    return typeof v === 'string' ? v : key
  }
  const value = { locale: 'zh-CN' as const, setLocale: async () => {}, t }
  return { ...mod, useI18n: () => value }
})

import { IpWhitelistPanel } from '../src/components/IpWhitelistPanel'
import { messages, getValueByPath } from '../src/i18n'

const ok = (data: unknown) => ({ success: true as const, data })
const fail = (error: string, status?: number) => ({ success: false as const, error, status })
const zhKey = (path: string) => {
  const v = getValueByPath(messages['zh-CN'] as Record<string, unknown>, path)
  expect(typeof v, `词包缺 ${path}`).toBe('string')
  return v as string
}

describe('IpWhitelistPanel', () => {
  beforeEach(() => {
    cleanup()
    api.fetchApi.mockReset()
  })

  it('挂载即拉列表,列表渲染的是真 IP 与真标题文案', async () => {
    api.fetchApi.mockResolvedValue(ok(['203.0.113.9', '2001:db8::1']))
    render(createElement(IpWhitelistPanel))
    await waitFor(() => expect(screen.getByText('203.0.113.9')).toBeTruthy())
    expect(api.fetchApi).toHaveBeenCalledWith('/api/user/ip-whitelist')
    expect(screen.getByText(zhKey('securityCenter.ipTitle'))).toBeTruthy()
    expect(screen.getByText(zhKey('securityCenter.ipHint'))).toBeTruthy()
    // 空态文案不得在有条目时出现
    expect(screen.queryByText(zhKey('securityCenter.ipEmpty'))).toBeNull()
  })

  it('零条目时显示空态文案(而不是空白卡)', async () => {
    api.fetchApi.mockResolvedValue(ok([]))
    render(createElement(IpWhitelistPanel))
    await waitFor(() => expect(screen.getByText(zhKey('securityCenter.ipEmpty'))).toBeTruthy())
  })

  it('添加:POST 带 {ip},成功后列表按服务端响应回填并清空输入', async () => {
    api.fetchApi.mockResolvedValueOnce(ok([]))
    render(createElement(IpWhitelistPanel))
    await waitFor(() => expect(screen.getByText(zhKey('securityCenter.ipEmpty'))).toBeTruthy())
    fireEvent.change(document.querySelector('input')!, { target: { value: '198.51.100.7' } })
    api.fetchApi.mockResolvedValueOnce(ok(['198.51.100.7']))
    fireEvent.click(screen.getByText(zhKey('securityCenter.ipAdd')))
    await waitFor(() => expect(screen.getByText('198.51.100.7')).toBeTruthy())
    const call = api.fetchApi.mock.calls.find(
      (c) => (c[1] as { method?: string })?.method === 'POST',
    )
    expect(call, '没发出 POST').toBeDefined()
    expect(call![0]).toBe('/api/user/ip-whitelist')
    expect(JSON.parse((call![1] as { body: string }).body)).toEqual({ ip: '198.51.100.7' })
  })

  it('被服务端拒(400)时:显示本地化提示,列表原地不动 ⇒ 不假装成功', async () => {
    api.fetchApi.mockResolvedValueOnce(ok(['203.0.113.9']))
    render(createElement(IpWhitelistPanel))
    await waitFor(() => expect(screen.getByText('203.0.113.9')).toBeTruthy())
    fireEvent.change(document.querySelector('input')!, { target: { value: '10.0.0.0/8' } })
    api.fetchApi.mockResolvedValueOnce(fail('请输入合法的 IP 地址（不支持 CIDR 段）', 400))
    fireEvent.click(screen.getByText(zhKey('securityCenter.ipAdd')))
    await waitFor(() => expect(screen.getByText(zhKey('securityCenter.ipInvalid'))).toBeTruthy())
    // 原条目仍在,且新值没被本地追加进去
    expect(screen.getByText('203.0.113.9')).toBeTruthy()
    expect(screen.queryByText('10.0.0.0/8')).toBeNull()
    // 阳性对照:同一位置若返回成功,列表必须变(证明上一条断言不是恒真)
    api.fetchApi.mockResolvedValueOnce(ok(['203.0.113.9', '198.51.100.7']))
    fireEvent.click(screen.getByText(zhKey('securityCenter.ipAdd')))
    await waitFor(() => expect(screen.getByText('198.51.100.7')).toBeTruthy())
  })

  it('删除:DELETE 带编码后的 ip,列表按响应更新', async () => {
    api.fetchApi.mockResolvedValueOnce(ok(['203.0.113.9', '198.51.100.7']))
    render(createElement(IpWhitelistPanel))
    await waitFor(() => expect(screen.getByText('203.0.113.9')).toBeTruthy())
    api.fetchApi.mockResolvedValueOnce(ok(['198.51.100.7']))
    const removeButtons = screen.getAllByText(zhKey('common.delete'))
    const firstRemove = removeButtons[0]
    if (!firstRemove) throw new Error('两条条目却没渲染出删除按钮 ⇒ 尺子失效')
    fireEvent.click(firstRemove)
    await waitFor(() => expect(screen.queryByText('203.0.113.9')).toBeNull())
    const del = api.fetchApi.mock.calls.find(
      (c) => (c[1] as { method?: string })?.method === 'DELETE',
    )
    expect(del, '没发出 DELETE').toBeDefined()
    expect(del![0]).toBe('/api/user/ip-whitelist?ip=203.0.113.9')
  })

  it('首屏拉取失败:显示错误态,点它可以重试', async () => {
    api.fetchApi.mockResolvedValueOnce(fail('请先登录', 401))
    render(createElement(IpWhitelistPanel))
    await waitFor(() => expect(screen.getByText('请先登录')).toBeTruthy())
    api.fetchApi.mockResolvedValueOnce(ok(['203.0.113.9']))
    fireEvent.click(screen.getByText('请先登录'))
    await waitFor(() => expect(screen.getByText('203.0.113.9')).toBeTruthy())
    expect(api.fetchApi).toHaveBeenCalledTimes(2)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
