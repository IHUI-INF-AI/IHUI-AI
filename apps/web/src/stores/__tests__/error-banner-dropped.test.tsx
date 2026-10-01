// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-641(2026-09-30):error-banner 落点 —— 上限 5 条溢出丢最旧必须可见。
 *
 * 钉住:① 溢出后 store.dropped > 0;② GlobalErrorBanner 渲染面出现 "…(dropped N)"
 * 计数行;③ 未溢出时不渲染计数行。
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }))

import { useErrorBannerStore } from '@/stores/error-banner'
import GlobalErrorBanner from '@/components/common/GlobalErrorBanner'

describe('error-banner dropped 可见性(G-641)', () => {
  afterEach(() => {
    cleanup()
    useErrorBannerStore.setState({ errors: [], dropped: 0 })
  })

  it('溢出后 dropped>0', () => {
    const s = useErrorBannerStore.getState()
    for (let i = 0; i < 7; i++) s.pushError(`err-${i}`)
    const st = useErrorBannerStore.getState()
    expect(st.errors).toHaveLength(5)
    expect(st.dropped).toBe(2)
    expect(st.dropped).toBeGreaterThan(0)
  })

  it('dropped>0 时渲染面出现计数行', () => {
    const s = useErrorBannerStore.getState()
    for (let i = 0; i < 7; i++) s.pushError(`err-${i}`)
    render(<GlobalErrorBanner />)
    const line = screen.getByTestId('error-banner-dropped')
    expect(line.textContent).toBe('…(dropped 2)')
  })

  it('未溢出时不渲染计数行', () => {
    const s = useErrorBannerStore.getState()
    s.pushError('only-one')
    render(<GlobalErrorBanner />)
    expect(screen.queryByTestId('error-banner-dropped')).toBeNull()
  })
})
