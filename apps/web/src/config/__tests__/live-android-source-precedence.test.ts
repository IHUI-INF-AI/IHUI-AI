// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveLiveAndroid } from '../desktop-feed-live'

/**
 * 2026-10-29 线上实测立的优先级闸:自有分发地址在位时,GitHub release 资产不得当下载按钮。
 * 现场按钮指向 `…/releases/download/nightly-40425910619/ihui-ai-latest.apk`(github 是国内最慢的
 * 一条腿,且 nightly tag 会把页面版本/日期换成与实际发出的包不是同一枚)。
 */
const GH_URL =
  'https://github.com/IHUI-INF-AI/IHUI-AI/releases/download/nightly-40425910619/ihui-ai-latest.apk'
const OWN_URL = 'https://www.aizhs.top/remote-images/download/ihui-ai-latest.apk'

function releasesFixture() {
  return [
    {
      tag_name: 'nightly-40425910619',
      name: 'nightly',
      draft: false,
      prerelease: false,
      published_at: '2026-10-28T18:00:00Z',
      html_url: 'https://github.com/IHUI-INF-AI/IHUI-AI/releases/tag/nightly-40425910619',
      assets: [{ name: 'ihui-ai-latest.apk', browser_download_url: GH_URL, size: 84915649 }],
    },
  ]
}

const SAVED_ENV = { ...process.env }

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => releasesFixture() })),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  process.env = { ...SAVED_ENV }
})

describe('resolveLiveAndroid 的源优先级', () => {
  it('自有地址在位 ⇒ 判 unavailable,并且一次上游请求都不发', async () => {
    const out = await resolveLiveAndroid({ ownApkUrl: OWN_URL })
    expect(out.source).toBe('unavailable')
    if (out.source === 'unavailable') expect(out.reason).toContain('自有分发地址在位')
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  })

  it('正向对照:没有自有地址时才走 GitHub 资产(闸不得把按钮整体打死)', async () => {
    const out = await resolveLiveAndroid({ ownApkUrl: null })
    expect(out.source).toBe('live')
    if (out.source === 'live') expect(out.data.apkUrl).toBe(GH_URL)
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)
  })

  it('缺省参数取的是与下载按钮同一个出口(getApkUrl 读的那枚环境变量)', async () => {
    process.env.NEXT_PUBLIC_DOWNLOAD_APK_URL = OWN_URL
    const out = await resolveLiveAndroid()
    expect(out.source).toBe('unavailable')
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  })

  it('反向锁:空白串按"没配"处理,不许借一个空值把上游源静音', async () => {
    process.env.NEXT_PUBLIC_DOWNLOAD_APK_URL = '   '
    const out = await resolveLiveAndroid()
    expect(out.source).toBe('live')
    expect(vi.mocked(fetch)).toHaveBeenCalled()
  })

  it('上游取不到时仍是 unavailable(旧降级路径不被新闸改变)', async () => {
    vi.mocked(fetch).mockImplementationOnce(
      async () => ({ ok: false, json: async () => [] }) as never,
    )
    const out = await resolveLiveAndroid({ ownApkUrl: null })
    expect(out.source).toBe('unavailable')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
