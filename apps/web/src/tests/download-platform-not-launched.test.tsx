// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment happy-dom
//
// 缺陷回归锁(2026-11-03):`/download/[platform]` 把认不出的平台段**静默折成 desktop**,
// 于是访问 `/download/harmony`(harmony 已在 apps/api 的 app-version 枚举里,下载中心未上)
// 渲染出来的是桌面版详情页 —— 用户以为那就是鸿蒙版。同类问题对任何未来新增端都会复发。
//
// 本档钉三件事:
//  ① 未上线平台 ⇒ 显式「尚未上线」态,且 desktop 的内容(资源列表/安装指南/系统要求)一条都不出现;
//  ② 显式态内给出「已上线平台」入口,绝不把未知平台自己列进去;
//  ③ 平台清单只剩一个来源:DOWNLOAD_PLATFORMS ⇄ PLATFORM_META ⇄ DOWNLOADS 三张表不许各走各路。
import * as React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// vitest 未开 globals ⇒ 必须显式 cleanup,否则上一例的 DOM 会漏进下一例的 getByText。
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// 翻译层打桩:key(带 vars 时附 [platform])原样回显 —— 断言认的是"取了哪个键、传了什么值",
// 而不是五种语言的措辞;措辞由 i18n 五语言同批的门负责。
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    const platform = values && typeof values.platform === 'string' ? values.platform : ''
    return platform ? `${key}[${platform}]` : key
  },
}))

// 详情页的返回键走 router.back()(该页存量实现,守门 46 的棘轮锚在该文件);测试里不给真路由。
vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))

// next/link 在无 AppRouter 上下文时依赖运行时兜底;钉成普通 <a>,让 href 断言只反映组件自己。
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

// 下载量上报只挂在下载按钮上;未上线态结构上不该有任何可点下载,更不该发请求。
vi.mock('@ihui/shared/hooks', () => ({ useDownloadTrack: () => vi.fn() }))

import { DownloadDetailContent } from '../../app/(main)/download/[platform]/DownloadDetailContent'
import { DOWNLOAD_ENTRY_BY_PLATFORM } from '../../app/(main)/download/[platform]/platformEntries'
import {
  DOWNLOAD_PLATFORMS,
  getLaunchedPlatforms,
  getPlatformMetaMap,
  isDownloadPlatform,
} from '@/config/downloads.config'

/** 已上线端的 href(详情页只该有 /download/<端> 这一类内部入口) */
function platformHrefs(): string[] {
  return screen
    .getAllByRole('link')
    .map((el) => el.getAttribute('href') ?? '')
    .filter((href) => href.startsWith('/download/'))
}

describe('下载中心 /download/[platform] 的未上线平台必须走显式态', () => {
  it('harmony(清单外的端)⇒ 渲染「尚未上线」标题并回显所请求的平台段', () => {
    render(<DownloadDetailContent platform="harmony" />)

    expect(screen.getByText('downloadNotLaunchedTitle[harmony]')).toBeTruthy()
    expect(screen.getByText('downloadNotLaunchedHint[harmony]')).toBeTruthy()
  })

  it('清单外的端不得被静默折成 desktop:desktop 详情内容一条都不出现', () => {
    render(<DownloadDetailContent platform="harmony" />)

    // 旧实现在这里渲染的就是 desktop 页:资源列表标题 + 安装包链接 + 安装指南 + 系统要求
    expect(screen.queryByText('downloadAssets')).toBeNull()
    expect(screen.queryByText('downloadInstallGuide')).toBeNull()
    expect(screen.queryByText('downloadSystemRequirements')).toBeNull()
    expect(screen.queryByText('downloadCodeSigningNotice')).toBeNull()
    const installerLinks = screen
      .getAllByRole('link')
      .filter((el) =>
        /\.exe|\/releases\/download|\/downloads\//.test(el.getAttribute('href') ?? ''),
      )
    expect(installerLinks).toHaveLength(0)
  })

  it('显式态给出「已上线平台」入口,且绝不把未知平台自己列进去', () => {
    render(<DownloadDetailContent platform="harmony" />)

    expect(screen.getByText('downloadAvailablePlatforms')).toBeTruthy()
    const hrefs = platformHrefs()
    expect(hrefs).toContain('/download/desktop')
    expect(hrefs).toContain('/download/cli')
    expect(hrefs).not.toContain('/download/harmony')
    // 列出来的每一端都必须是清单内登记的端(不许凭空造出一个下载页)
    const listed = hrefs.map((href) => href.replace('/download/', ''))
    expect(listed.every((p) => (DOWNLOAD_PLATFORMS as readonly string[]).includes(p))).toBe(true)
  })

  it('已登记的端仍按自己的详情页渲染,不被新早退分支误伤', () => {
    render(<DownloadDetailContent platform="desktop" />)

    expect(screen.getByText('downloadAssets')).toBeTruthy()
    expect(screen.queryByText(/^downloadNotLaunchedTitle/)).toBeNull()
    expect(screen.queryByText('downloadAvailablePlatforms')).toBeNull()
  })

  it('已登记但尚未配置资源的端(ios)保持既有「即将上线」形态,且把平台名传进占位符', () => {
    render(<DownloadDetailContent platform="ios" />)

    // downloadComingSoonTitle 的取值带 {platform} 占位;旧调用漏传 vars ⇒ 端上拿到的是裸键
    expect(screen.getByText(/^downloadComingSoonTitle\[/)).toBeTruthy()
    expect(screen.queryByText('downloadComingSoonTitle')).toBeNull()
  })

  it('用户可控的平台段只回显安全字符(越界字符与超长串不进页面)', () => {
    render(<DownloadDetailContent platform={'<img src=x>:' + 'a'.repeat(80)} />)

    const title = screen.getByText(/^downloadNotLaunchedTitle\[/).textContent ?? ''
    const token = title.slice('downloadNotLaunchedTitle['.length, -1)
    expect(token).toBe(`imgsrcx${'a'.repeat(17)}`)
    expect(document.querySelector('img')).toBeNull()
  })

  // 2026-11-03 把 InstallGuideContent / DownloadAssetCard / DownloadDetailHeader 拆成同目录
  // 组件以满足"每页面 < 250 行",拆完必须有断言钉住"装回去还在原位",否则只是搬文件。
  it('cli 详情仍渲染安装指南与 npm 命令(拆出的 InstallGuideContent 接线未断)', () => {
    render(<DownloadDetailContent platform="cli" />)

    expect(screen.getByText('downloadInstallGuide')).toBeTruthy()
    expect(screen.getByText('npm install -g ihui-cli')).toBeTruthy()
    expect(screen.getByText('downloadCopy')).toBeTruthy()
  })

  it('desktop 详情仍渲染头部徽章与资源卡片(拆出的 Header/AssetCard 接线未断)', () => {
    render(<DownloadDetailContent platform="desktop" />)

    expect(screen.getByText('downloadAvailable')).toBeTruthy()
    expect(screen.getByText('downloadDesktop')).toBeTruthy()
    expect(screen.getAllByText('downloadNow').length).toBeGreaterThan(0)
  })
})

describe('平台清单单一真相源(收口:此前清单有两份,第二份负责静默回落)', () => {
  it('isDownloadPlatform 只认清单内的端;API 侧存在的 harmony 不在下载中心清单内', () => {
    for (const platform of DOWNLOAD_PLATFORMS) {
      expect(isDownloadPlatform(platform)).toBe(true)
    }
    expect(isDownloadPlatform('harmony')).toBe(false)
    expect(isDownloadPlatform('')).toBe(false)
    expect(isDownloadPlatform(undefined)).toBe(false)
  })

  it('DOWNLOAD_PLATFORMS 与 PLATFORM_META 键集逐字相等', () => {
    expect([...DOWNLOAD_PLATFORMS].sort()).toEqual(Object.keys(getPlatformMetaMap()).sort())
  })

  it('每一端在 DOWNLOADS 里有 icon + labelKey(详情页与未上线态共用同一张表)', () => {
    for (const platform of DOWNLOAD_PLATFORMS) {
      const entry = DOWNLOAD_ENTRY_BY_PLATFORM[platform]
      expect(entry?.labelKey).toBeTruthy()
      expect(entry?.icon).toBeTruthy()
    }
  })

  it('已上线清单是清单的子集,且 web/desktop 必在其中', () => {
    const launched = getLaunchedPlatforms()
    expect(launched.every((p) => (DOWNLOAD_PLATFORMS as readonly string[]).includes(p))).toBe(true)
    expect(launched as string[]).not.toContain('harmony')
    expect(launched).toContain('web')
    expect(launched).toContain('desktop')
    // 判据同源:详情页「已发布」徽章与这里的清单是同一个 isPlatformLaunched
    const meta = getPlatformMetaMap()
    expect(launched.every((p) => meta[p].assets.length > 0 || Boolean(meta[p].version))).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
