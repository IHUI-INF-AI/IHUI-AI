// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * UserFansScreen 的行为级自证(§17:UI 改动不能只凭代码审查)。
 * 钉死四格:①RN 壳经 @ihui/rn-app 替身拿到的就是共享层
 * `packages/app/src/features/user-fans/UserFansScreen.tsx` 那一份(身份对照);
 * ②粉丝行逐元素上屏(昵称/关注时间/回关 CTA 与已关注态)且取的是词包真文案;
 * ③回关真的发 POST 并弹提示;④空态/失败态/裸键三查。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement } from 'react'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { messages, getValueByPath, type Locale } from '../src/i18n'
import type * as ApiClient from '@ihui/api-client'

const nav = vi.hoisted(() => ({ navigate: vi.fn(), goBack: vi.fn() }))
const appAlert = vi.hoisted(() => vi.fn())
const fetchApi = vi.hoisted(() => vi.fn())

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: nav.navigate, goBack: nav.goBack }),
}))

// 图标素材不是本页判据;名单必须覆盖共享屏 + 薄壳两处 import,漏一个是运行时 export 缺失。
vi.mock('lucide-react-native', () => {
  const icon = (name: string) => {
    const MockIcon = () => createElement('i', { 'data-icon': name })
    MockIcon.displayName = `MockIcon(${name})`
    return MockIcon
  }
  return Object.fromEntries(
    ['UserCheck', 'UserPlus', 'Users', 'ChevronLeft'].map((n) => [n, icon(n.toLowerCase())]),
  )
})

// 取数腿:fetchApi 给可控假数据;其余成员走真实现(类型用静态 import type,行内 import() 被 lint 禁)。
vi.mock('@ihui/api-client', async (importOriginal) => {
  const real = await importOriginal<typeof ApiClient>()
  return { ...real, fetchApi }
})

vi.mock('../src/components/BottomPops', () => ({ appAlert }))

import { UserFansScreen } from '../src/screens/UserFansScreen'
import { I18nProvider } from '../src/i18n'
import { UserFansScreen as SharedUserFansScreen } from '../../../packages/app/src/features/user-fans/UserFansScreen'
import * as rnAppStub from './__mocks__/ihui-rn-app'

const renderScreen = () => render(createElement(I18nProvider, null, createElement(UserFansScreen)))

const zh = messages['zh-CN'] as Record<string, unknown>
const val = (k: string) => getValueByPath(zh, k) as string

const FANS = [
  {
    id: 'f1',
    userId: 'u1',
    nickname: '甲粉一号',
    avatar: null,
    createdAt: '2026-01-02T00:00:00.000Z',
  },
  {
    id: 'f2',
    userId: 'u2',
    nickname: '乙粉二号',
    avatar: 'https://img.example.com/u2.png',
    createdAt: '2026-02-03T00:00:00.000Z',
  },
]

const fansOk = () =>
  fetchApi.mockImplementation((url: string) => {
    if (url.startsWith('/api/follows/following')) {
      return Promise.resolve({ success: true, data: { list: [{ userId: 'u2' }] } })
    }
    if (url.startsWith('/api/follows/followers')) {
      return Promise.resolve({ success: true, data: { list: FANS, total: 3 } })
    }
    return Promise.resolve({ success: true, data: { followed: true, isMutual: false } })
  })

describe('UserFansScreen 渲染委托与内容', () => {
  beforeEach(() => {
    cleanup()
    nav.goBack.mockClear()
    appAlert.mockClear()
    fetchApi.mockReset()
  })
  afterEach(() => cleanup())

  it('身份锁:RN 薄壳经 @ihui/rn-app 替身拿到的就是共享层那一份组件', () => {
    expect(rnAppStub.UserFansScreen).toBe(SharedUserFansScreen)
  })

  it('粉丝行逐元素上屏:昵称/关注时间前缀/回关 CTA 与已关注态按 followedIds 分流', async () => {
    fansOk()
    renderScreen()
    await waitFor(() => expect(screen.queryByText('甲粉一号')).not.toBeNull())
    expect(screen.getByText('乙粉二号')).toBeDefined()
    expect(screen.getByText(val('userFans.title'))).toBeDefined()
    // u2 在 following 名单 ⇒ 已关注态一枚;u1 未回关 ⇒ 回关 CTA 一枚
    expect(screen.getAllByText(val('userFans.followed'))).toHaveLength(1)
    expect(screen.getByText(val('userFans.follow'))).toBeDefined()
    // 关注时间行取 userFans.followedAt 词头
    expect(
      screen.getAllByText(new RegExp(val('userFans.followedAt'))).length,
    ).toBeGreaterThanOrEqual(2)
    // 载体计数:回关按钮(CTA 载体)= 1,加载更多按钮 = 1(2<3)
    expect(
      document.querySelectorAll(`button[accessibilitylabel="${val('userFans.follow')}"]`),
    ).toHaveLength(1)
    expect(
      document.querySelectorAll('button[accessibilityrole="button"]').length,
    ).toBeGreaterThanOrEqual(3)
  })

  it('回关:点击真的 POST /api/follows/u1 并弹成功提示,该行转为已关注态', async () => {
    fansOk()
    renderScreen()
    // 链 A = 粉丝列表取数:回关按钮长在行上,行没上屏时后面的查询根本拿不到载体
    // ⇒ 这一段是"点击前必须成立"的前提,不能被链 B 的终点回溯证明。
    await waitFor(() => expect(screen.queryByText('甲粉一号')).not.toBeNull(), { timeout: 4_000 })
    const btn = document.querySelector(`button[accessibilitylabel="${val('userFans.follow')}"]`)
    expect(btn).not.toBeNull()
    fireEvent.click(btn as Element)
    // 链 B = 回关:终点是"该行转为已关注态"(全部 userFans.followed 文案 1 枚 → 2 枚)。
    // 容器侧 onFollowBack 里 `await fetchApi(...)` 且 `res.success` 之后才 setFollowedIds
    // —— 非乐观更新 ⇒ "POST /api/follows/u1 打出去了"被终点蕴含,降级为同步断言(断言不减)。
    // 预算 4s+5s=9s < testTimeout 10s,保证真断链时红由断言消息定性、不被墙上时钟掐掉。
    await waitFor(() => expect(screen.getAllByText(val('userFans.followed'))).toHaveLength(2), {
      timeout: 5_000,
    })
    expect(
      fetchApi,
      '两行都成了已关注态却没打过 /api/follows/u1(POST)⇒ 这枚翻转不是回关链带来的',
    ).toHaveBeenCalledWith('/api/follows/u1', { method: 'POST' })
    expect(appAlert).toHaveBeenCalledWith(val('common.hint'), val('userFans.followSuccess'))
  })

  it('空态三分支:loading 指示 → 空文案;接口失败 → 加载失败 + 重试', async () => {
    fetchApi.mockImplementation(() => new Promise(() => {})) // 挂起,首帧仍在加载
    const { unmount } = renderScreen()
    // loading 态已演进为共享层 ScreenSkeleton 骨架屏(ScreenStates.tsx;spinner 是旧形态断言):
    // 骨架无文案 ⇒ 断言空态文案与错误文案都不出现,且列表区无内容
    const listText = document.querySelector('[data-role="flatlist"]')?.textContent ?? ''
    expect(listText).not.toMatch(/[一-龥]/)
    unmount()

    cleanup()
    fetchApi.mockImplementation((url: string) =>
      url.startsWith('/api/follows/followers')
        ? Promise.resolve({ success: true, data: { list: [], total: 0 } })
        : Promise.resolve({ success: true, data: { list: [] } }),
    )
    renderScreen()
    await waitFor(() => expect(screen.queryByText(val('userFans.empty'))).not.toBeNull())

    cleanup()
    fetchApi.mockImplementation((url: string) =>
      url.startsWith('/api/follows/followers')
        ? Promise.resolve({ success: false, error: 'boom' })
        : Promise.resolve({ success: true, data: { list: [] } }),
    )
    renderScreen()
    await waitFor(() => expect(screen.queryByText(val('userFans.loadFailed'))).not.toBeNull())
    expect(screen.getByText(val('common.retry'))).toBeDefined()
  })

  it('没有任何裸 i18n 键上屏', async () => {
    fansOk()
    const { container } = renderScreen()
    await waitFor(() => expect(screen.queryByText('甲粉一号')).not.toBeNull())
    const text = container.textContent ?? ''
    expect(text).not.toMatch(/\b(?:userFans|common)\.[A-Za-z][\w.]*/)
    // 阳性对照:同一把尺子喂一个真键名必须判红
    const probe = createElement('span', null, 'userFans.loadMore')
    const r2 = render(probe, { container: document.createElement('div') })
    expect(r2.container.textContent).toMatch(/\b(?:userFans|common)\.[A-Za-z][\w.]*/)
  })
})

describe('userFans.* 五语言齐备(共享屏取词面)', () => {
  const FANS_KEYS = [
    'title',
    'anonymous',
    'empty',
    'follow',
    'followed',
    'followedAt',
    'followSuccess',
    'actionFailed',
    'loadFailed',
  ]
  const COMMON_KEYS = ['back', 'retry', 'loading', 'hint', 'error']

  it.each(['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as Locale[])(
    '%s:userFans/common 取词键全部取到非空字符串且不等于键名',
    (locale) => {
      const pack = messages[locale] as Record<string, unknown>
      for (const k of FANS_KEYS) {
        const v = getValueByPath(pack, `userFans.${k}`)
        expect(typeof v, `${locale}.userFans.${k} 缺失`).toBe('string')
        expect((v as string).trim(), `${locale}.userFans.${k} 空值`).not.toBe('')
        expect(v, `${locale}.userFans.${k} 落成了键名`).not.toBe(`userFans.${k}`)
      }
      for (const k of COMMON_KEYS) {
        const v = getValueByPath(pack, `common.${k}`)
        expect(typeof v, `${locale}.common.${k} 缺失`).toBe('string')
      }
    },
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
