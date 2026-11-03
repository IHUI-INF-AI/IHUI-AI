// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import React from 'react'
import { render, cleanup, fireEvent } from '@testing-library/react'

/**
 * 自定义栏「添加面板」回归(2026-10-17 立)
 *
 * 这个组件此前零测试 —— 两轮实测反馈(①弹窗全平铺没分组 ②没有确定键)都是靠
 * 李总肉眼在现网上发现的。这里把那个形状钉死,后续谁再改回平铺 / 删掉收口键,
 * 测试先红。
 *
 * 钉五件事:
 *  ① 浏览态是**三级**:顶级分组头(热门/AI/…)→ 父项 → 缩进子项。
 *     只留父子两级而丢分组头,整页又变成一条长列表,那正是被判"平铺"的形状。
 *  ② 子项缩进(pl-7)且挂在父项下 —— 缩进是层级唯一可见证据。
 *  ③ 同 href 多分组出现(如 /models 同时在「热门」与「AI 分组」)只渲染一行,
 *     后出现的带 children 版本把 children 补挂给已有候选,不产生重复行/重复 key。
 *  ④ 勾选语义正确:未添加 → onAdd;已添加 → onRemove(同一个按钮双向切换)。
 *  ⑤ 收口键存在且真关窗(此前弹窗没有任何 footer 按钮,只能摸右上角 X)。
 *  ⑥ 搜索态:拍平 + 分组桶头;空结果走独立文案 customNoResults(不与侧边栏空态混用)。
 *
 * 假环境边界(如实声明):Modal 被换成裸壳(mock),因为 radix dialog 在 jsdom 下
 * 依赖一堆布局/指针语义;本测试钉的是**面板内容与交互**,不是 radix 的开关行为。
 * next-intl 的 t 被换成 `ns.key` 直译,断言按"翻译键"判,不依赖任何文案措辞。
 */

vi.mock('next-intl', () => ({
  __esModule: true,
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}))

vi.mock('@/components/feedback/Modal', () => ({
  __esModule: true,
  Modal: ({
    title,
    children,
    footer,
  }: {
    title?: React.ReactNode
    children?: React.ReactNode
    footer?: React.ReactNode
  }) => (
    <div>
      {title ? <div data-testid="modal-title">{title}</div> : null}
      <div>{children}</div>
      {footer ? <div data-testid="modal-footer">{footer}</div> : null}
    </div>
  ),
}))

import { CustomNavDialog } from '../CustomNavDialog'
import type { NavItem } from '../types'

const DummyIcon = () => <svg data-testid="icon" />

const childA: NavItem = { href: '/models/keys', labelKey: 'modelsKeys', icon: DummyIcon }
const childB: NavItem = { href: '/models/logs', labelKey: 'modelsLogs', icon: DummyIcon }
const modelsParent: NavItem = {
  href: '/models',
  labelKey: 'models',
  icon: DummyIcon,
  children: [childA, childB],
}

// /models 在「热门」里是平铺版(无 children),在「AI 分组」里是带 children 的父项
const groups: { label: string; items: NavItem[] }[] = [
  {
    label: 'aiGroupLabel',
    items: [
      modelsParent,
      { href: '/agents', labelKey: 'agents', icon: DummyIcon },
    ],
  },
  {
    label: 'hotGroupLabel',
    items: [
      { href: '/models', labelKey: 'models', icon: DummyIcon },
      { href: '/publish/history', labelKey: 'publishPlatform', icon: DummyIcon },
    ],
  },
]

function renderDialog(overrides: Partial<Parameters<typeof CustomNavDialog>[0]> = {}) {
  const onAdd = vi.fn()
  const onRemove = vi.fn()
  const onClose = vi.fn()
  const utils = render(
    <CustomNavDialog
      open
      onClose={onClose}
      groups={groups}
      customHrefs={[]}
      onAdd={onAdd}
      onRemove={onRemove}
      {...overrides}
    />,
  )
  return { ...utils, onAdd, onRemove, onClose }
}

/** 面板里除收口键外的所有行按钮 */
function rows() {
  return Array.from(document.querySelectorAll('button')).filter(
    (b) => b.getAttribute('data-testid') !== 'nav-custom-done',
  )
}

function rowByLabel(label: string) {
  const found = rows().filter((b) => b.textContent?.includes(label))
  if (found.length !== 1) {
    throw new Error(`期望恰好 1 行命中 ${label},实得 ${found.length}`)
  }
  return found[0] as HTMLElement
}

afterEach(cleanup)

describe('CustomNavDialog', () => {
  it('浏览态渲染三级结构:顶级分组头 → 父项 → 缩进子项', () => {
    renderDialog()
    // ① 分组头在(丢掉它就退回一条长列表)
    expect(document.querySelector('[data-testid="nav-custom-group-nav.aiGroupLabel"]')).toBeTruthy()
    expect(document.querySelector('[data-testid="nav-custom-group-nav.hotGroupLabel"]')).toBeTruthy()
    // ② 子项缩进挂载在父项下
    expect(document.querySelectorAll('.pl-7').length).toBe(2)
    expect(rowByLabel('nav.modelsKeys')).toBeTruthy()
    expect(rowByLabel('nav.modelsLogs')).toBeTruthy()
  })

  it('同一 href 跨分组只渲染一行,children 补挂不产生重复行', () => {
    renderDialog()
    // /models 出现在两个分组里,但行只能有一行(否则重复 key + 视觉上一模一样的两个按钮)
    // 只按标签 span 判等:用 includes('nav.models') 会把 nav.modelsKeys/logs 两个子项也数进来
    const modelsRows = rows().filter(
      (b) => b.querySelector('span')?.textContent === 'nav.models',
    )
    expect(modelsRows.length).toBe(1)
    // 平铺版在前、父项版在后时,children 必须被补挂上(子项不丢)
    expect(document.querySelectorAll('.pl-7').length).toBe(2)
  })

  it('未添加项点出 onAdd,已添加项点出 onRemove', () => {
    const { onAdd, onRemove } = renderDialog({ customHrefs: ['/models/keys'] })
    fireEvent.click(rowByLabel('nav.agents'))
    expect(onAdd).toHaveBeenCalledWith('/agents')
    expect(onRemove).not.toHaveBeenCalled()

    fireEvent.click(rowByLabel('nav.modelsKeys'))
    expect(onRemove).toHaveBeenCalledWith('/models/keys')
  })

  it('收口键存在且点击关窗', () => {
    const { onClose } = renderDialog()
    const done = document.querySelector('[data-testid="nav-custom-done"]') as HTMLElement | null
    expect(done).toBeTruthy()
    // 文案走 common.ok 现成键,不新造
    expect(done?.textContent).toBe('common.ok')
    fireEvent.click(done as HTMLElement)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('搜索拍平并保留分组桶头;无结果走 customNoResults', () => {
    const { container } = renderDialog()
    const input = container.querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'modelslogs' } })
    // 命中子项:拍平展示(不再缩进),且仍带分组桶头
    expect(document.querySelector('[data-testid="nav-custom-group-nav.aiGroupLabel"]')).toBeTruthy()
    expect(rowByLabel('nav.modelsLogs')).toBeTruthy()
    expect(document.querySelectorAll('.pl-7').length).toBe(0)
    expect(rows().length).toBe(1)

    fireEvent.change(input, { target: { value: 'zzz-not-exist' } })
    expect(rows().length).toBe(0)
    expect(document.body.textContent).toContain('nav.customNoResults')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
