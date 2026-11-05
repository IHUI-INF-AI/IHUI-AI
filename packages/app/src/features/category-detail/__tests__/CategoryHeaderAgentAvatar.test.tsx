// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 分类详情页两段(web 原先 inline)抽为共享段后的渲染回归:
// ① CategoryHeader 字段逐个渲染;② AgentAvatar 有/无 avatar 两态;
// ③ 阴性对照:摘 name 后按名称查找必红、摘 avatar 后 img 断言必红。
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CategoryHeader } from '../CategoryHeader'
import { AgentAvatar } from '../AgentAvatar'
import type { CategoryHeaderProps } from '@ihui/types'

const base: CategoryHeaderProps = {
  name: '内容运营',
  icon: '🎯',
  description: '分类描述',
  statusLabel: '已启用',
  statusEnabled: true,
  paidLabel: '付费分类',
  isPaid: true,
  createdAtLabel: '2026-10-01',
  colorScheme: 'light',
}

afterEach(cleanup)

// 守门 theme-prop-wiring：主题驱动组件的渲染点必须显式接线（字面量与漏传同红）。
const testColorScheme: 'light' | 'dark' = 'light'

describe('CategoryHeader 共享段', () => {
  it('名称/状态/付费/时间/描述全部渲染', () => {
    render(<CategoryHeader {...base} colorScheme={testColorScheme} />)
    expect(screen.getByText('内容运营')).toBeTruthy()
    expect(screen.getByText('🎯')).toBeTruthy()
    expect(screen.getByText('已启用')).toBeTruthy()
    expect(screen.getByText('付费分类')).toBeTruthy()
    expect(screen.getByText('2026-10-01')).toBeTruthy()
    expect(screen.getByText('分类描述')).toBeTruthy()
  })

  it('阴性对照:摘掉 name 后按名称查找必须红', () => {
    const { name: _omit, ...rest } = base
    render(<CategoryHeader {...(rest as CategoryHeaderProps)} colorScheme={testColorScheme} />)
    expect(screen.queryByText('内容运营')).toBeNull()
    expect(() => screen.getByText('内容运营')).toThrow()
  })
})

describe('AgentAvatar 共享段', () => {
  it('有 avatar 渲染图片节点', () => {
    const { container } = render(
      <AgentAvatar avatar="https://x/a.png" name="画师" colorScheme={testColorScheme} />,
    )
    expect(container.querySelector('img')).not.toBeNull()
  })

  it('阴性对照:摘掉 avatar 后 img 断言必须红(走占位)', () => {
    const { container } = render(<AgentAvatar name="画师" colorScheme={testColorScheme} />)
    expect(container.querySelector('img')).toBeNull()
    expect(() => expect(container.querySelector('img')).not.toBeNull()).toThrow()
  })
})
