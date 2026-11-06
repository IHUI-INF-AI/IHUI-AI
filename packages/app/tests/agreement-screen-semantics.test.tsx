// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 协议屏文档语义渲染锁(packages/app/src/features/agreement/AgreementScreen.tsx)。
// 解析层(htmlToBlocks)已有单测;这里钉「结构真的上屏」:
//   · 页头 + 正文 h1 + 正文 h2 ⇒ 3 个 header 节点,aria-level 分布 1×2 / 2×1
//   · ul ⇒ 三条 listItem,各自带 • 符号,正文取值仍 14/22(未因语义恢复而改 RN 既有取值)
import { createElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('lucide-react-native', () => {
  const icon = (name: string) => () => createElement('i', { 'data-icon': name })
  return { Calendar: icon('Calendar'), Tag: icon('Tag'), ChevronLeft: icon('ChevronLeft') }
})

vi.mock('../src/components/BackChevron', () => ({
  BackChevron: (p: { label: string }) => createElement('button', { 'data-back': p.label }),
}))

import {
  AgreementScreen,
  type AgreementCurrentScreenProps,
} from '../src/features/agreement/AgreementScreen'

const t = ((key: string) => key) as unknown as AgreementCurrentScreenProps['t']

const CONTENT =
  '<h1>一、我们收集的信息</h1><p>为提供 AI 对话服务,我们会收集账号标识。</p>' +
  '<h2>二、信息的使用</h2><ul><li>账号标识</li><li>会话标题</li><li>设备类型</li></ul>'

function renderScreen() {
  return render(
    createElement(AgreementScreen, {
      t,
      onBack: () => {},
      colorScheme: 'light',
      agreement: { title: '隐私政策', content: CONTENT, version: 'v2.1', effectiveDate: null },
    }),
  )
}

describe('AgreementScreen · 文档语义上屏', () => {
  it('页头 + 正文 h1 + 正文 h2 ⇒ 3 个 header 节点,层级 1×2 / 2×1', () => {
    const { container } = renderScreen()
    const headers = Array.from(container.querySelectorAll('[accessibilityrole="header"]'))
    expect(headers).toHaveLength(3)
    expect(headers.map((h) => h.getAttribute('aria-level'))).toEqual(['1', '1', '2'])
    expect(headers.map((h) => (h.textContent ?? '').trim())).toEqual([
      '隐私政策',
      '一、我们收集的信息',
      '二、信息的使用',
    ])
  })

  it('标题按 token 档位放大加粗: h1 20/700、h2 15/500', () => {
    const { container } = renderScreen()
    const headers = Array.from(
      container.querySelectorAll('[accessibilityrole="header"]'),
    ) as HTMLElement[]
    const h1 = headers[1]
    const h2 = headers[2]
    expect(h1.style.fontSize).toBe('20px')
    expect(h1.style.lineHeight).toBe('28')
    expect(h1.style.fontWeight).toBe('700')
    expect(h2.style.fontSize).toBe('15px')
    expect(h2.style.lineHeight).toBe('22')
    expect(h2.style.fontWeight).toBe('500')
  })

  it('列表项逐条带项目符号,正文仍 14/22(未改 RN 既有取值)', () => {
    const { container } = renderScreen()
    const markers = Array.from(container.querySelectorAll('span')).filter(
      (el) => (el.textContent ?? '').trim() === '•',
    )
    expect(markers).toHaveLength(3)
    const para = Array.from(container.querySelectorAll('span')).find(
      (el) => (el.textContent ?? '').trim() === '为提供 AI 对话服务,我们会收集账号标识。',
    ) as HTMLElement | undefined
    expect(para?.style.fontSize).toBe('14px')
    expect(para?.style.lineHeight).toBe('22')
    expect(para?.style.fontWeight).toBe('')
  })
})
