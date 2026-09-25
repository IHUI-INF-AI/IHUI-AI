// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * P2-14 深链薄壳回归(2026-09-25 立)。
 *
 * 两件要钉死的事:
 *  1. 路由表里必须真有 `/skills-market/:id` 且 `param: true` —— 这是本票的判据本身,
 *     "生成了页面但生成物没装车"正是这类能力反复失踪的方式。
 *  2. `[id]/PageClient` 只做"取 slug → 解码 → 交给列表页那一份组件",
 *     不得悄悄长出第二套详情 UI。
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

const { seen, useParamsMock } = vi.hoisted(() => ({
  seen: [] as Array<{ deepLinkName?: string }>,
  useParamsMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({ useParams: useParamsMock }))
vi.mock('../PageClient', () => ({
  default: (props: { deepLinkName?: string }) => {
    seen.push(props)
    return null
  },
}))

import SkillMarketDetailRoute from '../[id]/PageClient'
import { UI_ROUTES } from '@/lib/ui-routes.generated'

function renderWith(id: unknown) {
  seen.length = 0
  useParamsMock.mockReturnValue({ id })
  render(<SkillMarketDetailRoute />)
  return seen[0]?.deepLinkName
}

describe('深链条目必须出现在生成的路由表里', () => {
  it('/skills-market/:id 存在且 param 为 true', () => {
    const hit = UI_ROUTES.find((r) => r.path === '/skills-market/:id')
    expect(hit).toBeDefined()
    expect(hit?.param).toBe(true)
    expect(hit?.group).toBe('skills-market')
  })
})

describe('[id]/PageClient 只做参数转接', () => {
  it('普通 slug 原样透传', () => {
    expect(renderWith('content_engine')).toBe('content_engine')
  })

  it('百分号编码的中文名先解码再透传', () => {
    expect(renderWith(encodeURIComponent('代码审查'))).toBe('代码审查')
  })

  it('畸形百分号编码不得抛错(坏 URL 不该崩整页),退回原值', () => {
    expect(() => renderWith('100%zz')).not.toThrow()
    expect(renderWith('100%zz')).toBe('100%zz')
  })

  it('数组形态的动态段取第一个;空串视作没有 slug', () => {
    expect(renderWith(['first', 'second'])).toBe('first')
    expect(renderWith('')).toBeUndefined()
    expect(renderWith(undefined)).toBeUndefined()
  })

  it('只渲染一次列表页组件,不引入第二套详情实现', () => {
    renderWith('content_engine')
    expect(seen).toHaveLength(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
