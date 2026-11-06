// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment happy-dom
//
// 路由级回落锁(2026-11-06):同目录那份 `download-platform-not-launched.test.tsx` 钉的是
// **组件内**的守卫(未上线态长什么样),而 `/download/[platform]` 的 page 层守卫
// (`isDownloadPlatform(rawPlatform)` ⇒ 直接返回 `PlatformNotLaunched`)此前一条断言都没有 ——
// 摘掉它,`/download/harmony` 会重新走回 desktop 详情,账面仍全绿(§0.9 判据在、没人判=没有)。
//
// 本档只判"路由把请求交给了哪个组件、有没有去打上游",刻意不渲染组件本体:
//  ① 未上线平台 ⇒ 拿到的是 PlatformNotLaunched,且运行期解析腿一次都没被调用(副作用没发生);
//  ② 清单内 8 端 ⇒ 一律拿到 DownloadDetailContent(新守卫不得把已上线端一起误伤);
//  ③ 平台名原样透传(不折成 desktop)。
import { describe, expect, it, vi } from 'vitest'

import type { DownloadPlatform } from '@/config/downloads.config'
import type { LivePlatformInfo } from '@/config/downloads-live-meta'

// 未上线态的组件文本取用面:本档不渲染组件,只需 next-intl 能被 import。
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

// 运行期解析腿 = "被当成已上线端"才会发生的副作用(GitHub / 注册表)。
// 未上线平台必须一次都不触达它,否则"回落成 desktop"就是既成事实(还额外打了一次上游)。
vi.mock('@/config/downloads-live', () => ({
  resolveLiveDownload: vi.fn(
    async (platform: DownloadPlatform): Promise<LivePlatformInfo> => ({
      platform,
      source: 'snapshot',
      resolvedAt: '2026-11-06T00:00:00.000Z',
    }),
  ),
}))

import DownloadPage from '../../app/(main)/download/[platform]/page'
import { DownloadDetailContent } from '../../app/(main)/download/[platform]/DownloadDetailContent'
import { PlatformNotLaunched } from '../../app/(main)/download/[platform]/PlatformNotLaunched'
import { resolveLiveDownload } from '@/config/downloads-live'
import { DOWNLOAD_PLATFORMS } from '@/config/downloads.config'

// 上面的 vi.mock 已把这份模块整体换掉,这里拿到的就是可断言调用次数的 spy。
const resolveLive = vi.mocked(resolveLiveDownload)

function renderRoute(platform: string) {
  return DownloadPage({ params: Promise.resolve({ platform }) })
}

describe('下载详情页路由层:清单外的平台段不得交给任何已上线端的组件', () => {
  it('harmony(在 API 版本枚举里、不在下载中心清单里)⇒ 路由交的是 PlatformNotLaunched', async () => {
    const el = await renderRoute('harmony')

    expect(el.type).toBe(PlatformNotLaunched)
    // 平台段原样透传:折叠成 desktop 的那一型回归就体现在这里
    expect((el.props as { platformParam?: string }).platformParam).toBe('harmony')
  })

  it('未上线平台一次都不触达运行期解析腿(回落成 desktop ⇒ 这条必红)', async () => {
    resolveLive.mockClear()
    await renderRoute('harmony')

    expect(resolveLive).not.toHaveBeenCalled()
  })

  it('清单内 8 端仍各自交回详情页组件,且平台名不被改写', async () => {
    for (const platform of DOWNLOAD_PLATFORMS) {
      const el = await renderRoute(platform)

      expect(el.type, `${platform} 不该被当成未上线`).toBe(DownloadDetailContent)
      expect((el.props as { platform?: string }).platform).toBe(platform)
    }
  })

  it('任意清单外名字都走显式未上线态(未来新增端 / 手打的 URL 同一条路)', async () => {
    for (const raw of ['watchos', 'harmonyos', 'pad', '', 'Desktop']) {
      const el = await renderRoute(raw)

      expect(el.type, `${raw} 不该回落`).toBe(PlatformNotLaunched)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
