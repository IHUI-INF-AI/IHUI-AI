// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `IHUI_AUTO_MEMORY` env 镜像的合取与极性测试(2026-10-03 数据出域合规整改,第二轮)。
 *
 * 要补的缺陷:部署方设 `IHUI_AUTO_MEMORY=0` 后,隐私页与记忆页仍显示"自动记忆 开启",
 * 而 ai-service **实际不提取** —— 界面与事实相反。该 env 不是 `NEXT_PUBLIC_*`,
 * 不会下发到浏览器,所以前端一直读不到;现在读 `GET /settings/runtime-flags`(只回一个布尔)。
 *
 * 判据(全部是"界面显示什么",不是实现细节):
 *   ① env 关闭 ⇒ 无论用户偏好如何,界面都显示**关闭**(合取生效);
 *   ② env 开启/读不到 ⇒ 界面显示完全由用户偏好决定(= 整改前行为);
 *   ③ 极性:env 是"是否开启"(opt-in),界面也是 opt-in ⇒ 合取是 **AND**,不取反;
 *   ④ 隐私页那一项是 **opt-out** ⇒ 它的合取是 **OR**,与记忆页相反;
 *   ⑤ env 关闭时开关**置灰且写不进去**(否则用户拨开后端也不提取 = 反向假开关)。
 *
 * 为什么既测纯函数又渲染页面:`resolveAutoMemoryEnabled` 是判定链的单独一份,
 * 渲染页面才证明它**真的接在开关上**(极性写反时纯函数对、界面照样错)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import React from 'react'
import { render, screen, cleanup, waitFor, act, fireEvent } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const { fetchApiMock, fetchMemoryMock, deleteMemoryMock } = vi.hoisted(() => ({
  fetchApiMock: vi.fn(),
  fetchMemoryMock: vi.fn(),
  deleteMemoryMock: vi.fn(),
}))

vi.mock('@/lib/api', () => ({ fetchApi: fetchApiMock }))
vi.mock('@/lib/memory-api', () => ({
  fetchMemory: fetchMemoryMock,
  deleteMemory: deleteMemoryMock,
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}))

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}))

vi.mock('lucide-react', () => {
  const base: Record<PropertyKey, unknown> = { __esModule: true }
  return new Proxy(base, {
    get(target, prop) {
      if (prop in target) return target[prop]
      if (typeof prop === 'symbol' || prop === 'then' || prop === 'default') return undefined
      return () => null
    },
    has() {
      return true
    },
  })
})

vi.mock('@ihui/ui-react', () => {
  const Box = ({ children }: { children?: React.ReactNode }) => <>{children}</>
  return {
    Button: ({ children }: { children?: React.ReactNode }) => <button type="button">{children}</button>,
    Card: Box,
    CardHeader: Box,
    CardTitle: Box,
    CardContent: Box,
    // 替身把 checked/disabled 都透出成 aria-* / disabled,让用例断言的是**界面状态**
    Switch: ({
      checked,
      disabled,
      onCheckedChange,
    }: {
      checked?: boolean
      disabled?: boolean
      onCheckedChange?: (v: boolean) => void
    }) => (
      <button
        type="button"
        role="switch"
        aria-checked={checked ? 'true' : 'false'}
        disabled={disabled}
        onClick={() => {
          if (!disabled) onCheckedChange?.(!checked)
        }}
      />
    ),
  }
})

vi.mock('@/components/memory/MemoryCard', () => ({ MemoryCard: () => null }))
vi.mock('@/components/memory/MemoryScopeTabs', () => ({ MemoryScopeTabs: () => null }))
vi.mock('@/components/memory/MemoryTypeFilter', () => ({ MemoryTypeFilter: () => null }))
vi.mock('@/components/common', () => ({ BackButton: () => null }))

const { default: MemoryListPage, resolveAutoMemoryEnabled } = await import(
  '../app/(main)/memory/page'
)

/** 按 URL 分派 mock:隐私页要两个端点(settings + runtime-flags) */
function routeApi(settings: Record<string, string>, globalEnabled?: boolean) {
  fetchApiMock.mockImplementation((url: string) => {
    if (String(url).includes('/settings/runtime-flags')) {
      if (globalEnabled === undefined) return Promise.reject(new Error('no flags endpoint'))
      return Promise.resolve({
        success: true,
        data: { autoMemoryGloballyEnabled: globalEnabled },
      })
    }
    return Promise.resolve({ success: true, data: { settings } })
  })
}

function switchState() {
  return screen.getByRole('switch').getAttribute('aria-checked')
}

function switchDisabled() {
  return (screen.getByRole('switch') as HTMLButtonElement).disabled
}

async function renderPage() {
  render(<MemoryListPage />)
  await waitFor(() => expect(screen.getByRole('switch')).toBeTruthy())
  await act(async () => {
    await Promise.resolve()
  })
}

beforeEach(() => {
  cleanup()
  fetchApiMock.mockReset()
  fetchMemoryMock.mockReset()
  deleteMemoryMock.mockReset()
  fetchMemoryMock.mockResolvedValue({ entries: [] })
  // 默认:偏好为空 + 全局开启(= 整改前行为)
  routeApi({}, true)
})

describe('resolveAutoMemoryEnabled:全局 env 与用户偏好的合取', () => {
  it('env 开启 + 用户从未表态 ⇒ 开启(默认行为不变)', () => {
    expect(resolveAutoMemoryEnabled({}, true)).toBe(true)
  })

  it('env 关闭 + 用户从未表态 ⇒ **关闭**(补上此前读不到 env 的缝)', () => {
    expect(resolveAutoMemoryEnabled({}, false)).toBe(false)
  })

  it('env 关闭 ⇒ 压过用户"允许记忆"的表态(合取是 AND)', () => {
    // 用户说"允许记忆",但部署方全局关了 ⇒ 实际不提取 ⇒ 界面必须显示关闭
    expect(resolveAutoMemoryEnabled({ autoMemoryOptOut: 'false' }, false)).toBe(false)
    expect(resolveAutoMemoryEnabled({ autoMemory: 'true' }, false)).toBe(false)
  })

  it('env 开启 + 用户关闭 ⇒ 关闭(用户表态仍然生效)', () => {
    expect(resolveAutoMemoryEnabled({ autoMemoryOptOut: 'true' }, true)).toBe(false)
  })

  it('env 缺省(=读不到)⇒ 视为开启,不因接口抖动显示成"已关闭"', () => {
    // 第二参数省略 = 端点不可用。方向选择与后端 auto_memory_optout 同源:
    // 读不到就按现状行为(开)放行,而不是凭空显示成用户被关了记忆。
    expect(resolveAutoMemoryEnabled({})).toBe(true)
    expect(resolveAutoMemoryEnabled({ autoMemoryOptOut: 'true' })).toBe(false)
  })

  it('极性没被取反:env 与界面同为 opt-in,合取不引入翻转', () => {
    // 若实现里写了 `!globalEnabled`,这两条会同时失败
    expect(resolveAutoMemoryEnabled({}, true)).toBe(true)
    expect(resolveAutoMemoryEnabled({}, false)).toBe(false)
  })

  it('旧键(存量保护)那条链也参与合取', () => {
    // 旧键 'false' = 已关闭;env 开启时仍关闭
    expect(resolveAutoMemoryEnabled({ autoMemory: 'false' }, true)).toBe(false)
    // 旧键缺失 + env 关闭 ⇒ 关闭
    expect(resolveAutoMemoryEnabled({ autoMemory: 'true' }, false)).toBe(false)
  })
})

describe('记忆页界面:合取真的接在开关上', () => {
  it('env 关闭 ⇒ 界面显示关闭(即便用户偏好是"允许")', async () => {
    routeApi({ autoMemoryOptOut: 'false' }, false)
    await renderPage()
    expect(switchState()).toBe('false')
  })

  it('env 关闭 + 用户从未表态 ⇒ 界面显示关闭', async () => {
    routeApi({}, false)
    await renderPage()
    expect(switchState()).toBe('false')
  })

  it('env 开启 + 用户关闭 ⇒ 界面显示关闭(用户表态未被 env 覆盖)', async () => {
    routeApi({ autoMemoryOptOut: 'true' }, true)
    await renderPage()
    expect(switchState()).toBe('false')
  })

  it('env 开启 + 用户允许 ⇒ 界面显示开启(默认行为不变)', async () => {
    routeApi({ autoMemoryOptOut: 'false' }, true)
    await renderPage()
    expect(switchState()).toBe('true')
  })

  it('env 端点不可用 ⇒ 退回"按用户偏好",不阻塞记忆页', async () => {
    // routeApi 不传 globalEnabled ⇒ runtime-flags 请求 reject
    routeApi({ autoMemoryOptOut: 'true' })
    await renderPage()
    expect(switchState()).toBe('false')
  })

  it('env 关闭时开关置灰(不让用户拨开后端却不提取)', async () => {
    routeApi({}, false)
    await renderPage()
    expect(switchDisabled()).toBe(true)
  })

  it('env 开启时开关可点(置灰不能误伤正常用户)', async () => {
    routeApi({}, true)
    await renderPage()
    expect(switchDisabled()).toBe(false)
  })

  it('env 关闭时点击不产生 PUT(写了也是白写:后端仍不提取)', async () => {
    routeApi({}, false)
    await renderPage()
    const before = fetchApiMock.mock.calls.length
    await act(async () => {
      fireEvent.click(screen.getByRole('switch'))
      await Promise.resolve()
    })
    const puts = fetchApiMock.mock.calls.filter(
      (c) => (c[1] as RequestInit | undefined)?.method === 'PUT',
    )
    expect(puts).toHaveLength(0)
    expect(fetchApiMock.mock.calls.length).toBe(before)
    // 界面仍显示关闭(没有"拨亮了但后端不提取"的反向假开关)
    expect(switchState()).toBe('false')
  })

  it('env 开启时点击照常写 PUT(极性取反仍正确)', async () => {
    routeApi({}, true)
    await renderPage()
    await act(async () => {
      fireEvent.click(screen.getByRole('switch'))
      await Promise.resolve()
    })
    const put = fetchApiMock.mock.calls.find(
      (c) => (c[1] as RequestInit | undefined)?.method === 'PUT',
    )
    expect(put).toBeTruthy()
    const body = JSON.parse((put![1] as RequestInit).body as string)
    // 界面点"关" ⇒ 落库 opt-out 'true'
    expect(body).toEqual({ autoMemoryOptOut: 'true' })
  })

  it('确实请求了 runtime-flags 端点(没这一步就还是读不到 env)', async () => {
    routeApi({}, true)
    await renderPage()
    const urls = fetchApiMock.mock.calls.map((c) => String(c[0]))
    expect(urls.some((u) => u.includes('/settings/runtime-flags'))).toBe(true)
  })
})

describe('隐私页那一项:opt-out 极性 ⇒ 合取是 OR', () => {
  const PRIVACY_SRC = readFileSync(
    resolve(__dirname, '../app/(main)/settings/privacy/page.tsx'),
    'utf8',
  )

  it("源码层面:那一项的合取写成 OR(用户关了 || 部署方全局关了)", () => {
    // 这一项是 opt-out(true = 已关闭),全局闸是"是否开启" ⇒ "记忆是关的"
    // = 用户关了 **或** 部署方全局关了。写成 AND 会得到
    // "部署方关了 ⇒ 显示未关闭",与事实相反。
    expect(PRIVACY_SRC).toMatch(
      /autoMemoryOptOut:\s*s\.autoMemoryOptOut === 'true'\s*\|\|\s*!globalEnabled/,
    )
  })

  it('源码层面:没有把这一项写成 AND(那是极性反了)', () => {
    expect(PRIVACY_SRC).not.toMatch(
      /autoMemoryOptOut:\s*s\.autoMemoryOptOut === 'true'\s*&&/,
    )
  })

  it('源码层面:确实读了 runtime-flags 端点', () => {
    expect(PRIVACY_SRC).toContain('/settings/runtime-flags')
  })

  it('源码层面:env 关闭时那一项被置灰', () => {
    expect(PRIVACY_SRC).toMatch(/disabled:\s*!prefs\.autoMemoryGloballyEnabled/)
  })

  it('源码层面:runtime-flags 端点不泄露其它 env(只解构那一个布尔)', () => {
    // 端点返回体只被读 autoMemoryGloballyEnabled 一个字段
    const hits = PRIVACY_SRC.match(/autoMemoryGloballyEnabled/g) ?? []
    expect(hits.length).toBeGreaterThan(0)
    // 不得出现把整个 env / config 摊给前端的写法
    expect(PRIVACY_SRC).not.toMatch(/process\.env/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
