// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// 门 285 B 组:UserInfoCard.userInfo 由「仅 RN 声明」收口为两端真实现。
// 容器结构在小程序侧真的被读取:昵称/智汇值由 userInfo 兜底,扁平显式值仍优先。
import { describe, it, expect, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@tarojs/components', () => {
  const make = (tag: string) => {
    const Stub = (props: { children?: ReactNode }) => createElement(tag, null, props.children)
    Stub.displayName = `Taro${tag}`
    return Stub
  }
  return { View: make('div'), Text: make('span'), Image: make('img'), Button: make('button') }
})
vi.mock('@tarojs/taro', () => ({
  default: { navigateTo: vi.fn(), showToast: vi.fn(), login: vi.fn() },
  navigateTo: vi.fn(),
  showToast: vi.fn(),
  login: vi.fn(),
}))
vi.mock('@/i18n', () => ({
  useTt: () => (_k: string, fb: string) => fb,
  t: (_k: string) => '',
}))
vi.mock('@/components/LineIcon', () => ({
  default: () => createElement('span', { 'data-icon': 'line' }),
}))

import UserInfoCard from '../src/components/UserInfoCard'

const render = (props: Record<string, unknown>) =>
  renderToStaticMarkup(createElement(UserInfoCard as never, props as never))

const userInfo = {
  uuid: 'u-1',
  username: '容器昵称',
  avatarUrl: 'https://cdn/a.png',
  tokenQuantity: 1200,
  isVip: 0,
} as never

describe('UserInfoCard userInfo 真消费', () => {
  it('未传扁平字段时,昵称与智汇值取自 userInfo 容器', () => {
    const html = render({ userInfo })
    expect(html).toContain('容器昵称')
    expect(html).toContain('1.2k')
  })

  it('扁平显式值覆盖容器同字段', () => {
    const html = render({ userInfo, nickname: '扁平昵称', tokenValue: 300 })
    expect(html).toContain('扁平昵称')
    expect(html).toContain('300')
    expect(html).not.toContain('容器昵称')
  })

  it('正例对照:容器带 uuid 时按已登录渲染,不再出「一键登录」条', () => {
    const html = render({ userInfo, onLogin: () => {} })
    expect(html).not.toContain('一键登录')
  })
})
