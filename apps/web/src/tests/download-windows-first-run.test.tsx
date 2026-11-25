// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment happy-dom
//
// Windows 首次运行引导(2026-11-25)回归锁。
//
// 背景:桌面安装包没有 Authenticode 签名,SmartScreen 必弹「未知发布者」;该弹窗在应用
// 代码运行前由 Windows 弹出,程序层无法隐藏。产品决定不买证书,改为在下载页提前教学。
//
// 本档钉四件事:
//  ① desktop 详情页必须出现完整引导(标题 / 弹窗关键词 / 三步 / 安全底线);
//  ② 下载资源区上方必须有跳转锚点,用户下载前就能看到预告;
//  ③ 非 Windows 端(cli/ios)不得出现这段引导,避免误导;
//  ④ 旧文案「由 SignPath 签名」不得复活 —— 安装包当前就是 NotSigned。
import * as React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    const platform = values && typeof values.platform === 'string' ? values.platform : ''
    return platform ? `${key}[${platform}]` : key
  },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))

vi.mock('next/link', () => ({
  default: ({
    href,
    className,
    children,
  }: {
    href: string
    className?: string
    children: React.ReactNode
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

vi.mock('@ihui/shared/hooks', () => ({ useDownloadTrack: () => vi.fn() }))

import { DownloadDetailContent } from '../../app/(main)/download/[platform]/DownloadDetailContent'

describe('Windows 首次运行引导', () => {
  it('desktop 详情页给出完整三步 + 弹窗关键词', () => {
    render(<DownloadDetailContent platform="desktop" />)

    expect(screen.getByText('downloadWinGuideTitle')).toBeTruthy()
    expect(screen.getByText('downloadWinDialogTitle')).toBeTruthy()
    expect(screen.getByText('downloadWinDialogMore')).toBeTruthy()
    expect(screen.getByText('downloadWinDialogRun')).toBeTruthy()
    expect(screen.getByText('downloadWinStep2Title')).toBeTruthy()
    expect(screen.getByText('downloadWinSafety')).toBeTruthy()
  })

  it('下载资源区上方有跳转到引导的锚点', () => {
    render(<DownloadDetailContent platform="desktop" />)

    const anchors = screen
      .getAllByRole('link')
      .map((el) => el.getAttribute('href'))
      .filter((href) => href === '#windows-first-run')
    expect(anchors.length).toBeGreaterThan(0)
    expect(document.querySelector('#windows-first-run')).toBeTruthy()
  })

  it('cli / ios 详情页不出现 Windows 引导', () => {
    render(<DownloadDetailContent platform="cli" />)
    expect(screen.queryByText('downloadWinGuideTitle')).toBeNull()
    cleanup()

    render(<DownloadDetailContent platform="ios" />)
    expect(screen.queryByText('downloadWinGuideTitle')).toBeNull()
  })

  it('旧的 SignPath 签名声明不再出现', () => {
    render(<DownloadDetailContent platform="desktop" />)

    expect(screen.queryByText('downloadCodeSigningNotice')).toBeNull()
    expect(screen.queryByText(/SignPath/i)).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
