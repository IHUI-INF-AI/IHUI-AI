// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

import { IcpRecordScreen } from '../IcpRecordScreen'

afterEach(cleanup)

/**
 * ICP 备案屏新增的两个**可选**展示位：
 * 缺省必须完全不占位（阴性对照），注入后才渲染对应行。
 */
const t = (key: string): string => key

function renderScreen(props: Partial<Parameters<typeof IcpRecordScreen>[0]> = {}) {
  return render(<IcpRecordScreen t={t} onBack={vi.fn()} {...props} />)
}

describe('IcpRecordScreen 可选展示位', () => {
  it('不传 scope / recordUrl 时两行都不渲染', () => {
    renderScreen()
    expect(screen.queryByText('icpRecord.scope')).toBeNull()
    expect(screen.queryByText('icpRecord.url')).toBeNull()
  })

  it('只传 scope 时渲染范围行，链接行仍不占位', () => {
    renderScreen({ scope: '互联网信息服务' })
    expect(screen.getByText('icpRecord.scope')).toBeTruthy()
    expect(screen.getByText('互联网信息服务')).toBeTruthy()
    expect(screen.queryByText('icpRecord.url')).toBeNull()
  })

  it('只传 recordUrl 时渲染链接行，范围行仍不占位', () => {
    renderScreen({ recordUrl: 'https://beian.miit.gov.cn' })
    expect(screen.getByText('icpRecord.url')).toBeTruthy()
    expect(screen.getByText('https://beian.miit.gov.cn')).toBeTruthy()
    expect(screen.queryByText('icpRecord.scope')).toBeNull()
  })

  it('recordUrl 配 onOpenRecordUrl 时该行可点击并回传链接', () => {
    const onOpenRecordUrl = vi.fn()
    renderScreen({ recordUrl: 'https://beian.miit.gov.cn', onOpenRecordUrl })
    fireEvent.click(screen.getByText('https://beian.miit.gov.cn'))
    expect(onOpenRecordUrl).toHaveBeenCalledWith('https://beian.miit.gov.cn')
  })
})
