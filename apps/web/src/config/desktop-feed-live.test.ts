// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * desktop-feed-live 单测(2026-10-17)。
 *
 * 锁的是"版本号为什么再也不会漂"这件事背后的四条判据 —— 不是为了凑覆盖率,
 * 是锁住历史上真出过事的那几条:
 *   1. 取版本最大者,而不是 API 返回顺序的第一个(GitHub /releases 会把 draft 排最前,
 *      2026-09-18 实测过快照被 draft 的 desktop-v0.1.16 覆盖);
 *   2. draft / prerelease 必须被排掉(同上,且 prerelease 不是给人装的版本);
 *   3. 没有已发布 desktop release 时报 null,而不是退化 TieSilently 到快照;
 *   4. latest.json 里的 platforms 必须原样透出 —— 不许在本侧重算平台键和签名。
 */
import { describe, it, expect } from 'vitest'
import {
  cmpVer,
  pickLatestDesktopRelease,
  buildLiveSource,
  liveToDesktopFeed,
  pickLatestApkRelease,
  extractSemver,
  preferGiteeWindows,
  type UpstreamRelease,
} from './desktop-feed-live'

function rel(tag: string, over: Record<string, unknown> = {}) {
  return { tag_name: tag, assets: [], ...over }
}

/** 拿不到候选是真失败,不该被 `!` 断言折过去 —— 那等于替被测试的判据做了主 */
function mustPick(releases: ReturnType<typeof rel>[] | UpstreamRelease[]) {
  const picked = pickLatestDesktopRelease(releases)
  if (!picked) throw new Error('期望挑出候选,实际为空 —— pickLatestDesktopRelease 判定变了')
  return picked
}

describe('cmpVer', () => {
  it('三段数值比较,补位短版本号', () => {
    expect(cmpVer('0.1.9', '0.1.10')).toBeLessThan(0)
    expect(cmpVer('0.2.0', '0.1.99')).toBeGreaterThan(0)
    expect(cmpVer('1.0', '1.0.0')).toBe(0)
  })
})

describe('pickLatestDesktopRelease', () => {
  it('取 SemVer 最大者,而不是列表里的第一个(防 GitHub 把 draft 排最前)', () => {
    const picked = pickLatestDesktopRelease([
      rel('desktop-v0.2.0'),
      rel('desktop-v0.1.54'),
      rel('desktop-v0.1.58'),
    ])
    expect(picked?.tag).toBe('desktop-v0.2.0')
    expect(picked?.version).toBe('0.2.0')
  })

  it('排除 draft 与 prerelease —— 草稿里的资产 URL 是 untagged-* 死链', () => {
    const picked = pickLatestDesktopRelease([
      rel('desktop-v9.9.9', { draft: true }),
      rel('desktop-v8.8.8', { prerelease: true }),
      rel('desktop-v0.1.58'),
    ])
    expect(picked?.tag).toBe('desktop-v0.1.58')
  })

  it('候选项全被排除时返回 null(调用方据此显式降级,不许静默吞掉)', () => {
    expect(pickLatestDesktopRelease([rel('desktop-v1.0.0', { draft: true })])).toBeNull()
    expect(pickLatestDesktopRelease([])).toBeNull()
    expect(pickLatestDesktopRelease([rel('nightly-123'), rel('v2.0.0')])).toBeNull()
  })

  it('挑出 latest.json 直链供下一步取用', () => {
    const picked = pickLatestDesktopRelease([
      rel('desktop-v0.1.58', {
        assets: [{ name: 'latest.json', browser_download_url: 'https://example.test/latest.json' }],
      }),
    ])
    expect(picked?.latestJsonUrl).toBe('https://example.test/latest.json')
  })
})

describe('buildLiveSource + liveToDesktopFeed', () => {
  it('platforms 原样透出 —— 不在本侧重算平台键与签名', () => {
    const payload = {
      version: '0.1.58',
      notes: 'n',
      pub_date: '2026-10-13T00:00:00.000Z',
      platforms: {
        'windows-x86_64': { url: 'https://github.test/a.exe', signature: 'SIG' },
      },
    }
    const feed = liveToDesktopFeed(
      buildLiveSource(mustPick([rel('desktop-v0.1.58')]), payload, 'o/r'),
    )
    expect(feed.updaterPlatforms?.['windows-x86_64']).toEqual({
      url: 'https://github.test/a.exe',
      signature: 'SIG',
    })
    expect(feed.version).toBe('0.1.58')
    expect(feed.resolvedFromTag).toBe('desktop-v0.1.58')
  })

  it('下载页资产只收与本版同号的包,且不带 .sig / .app.tar.gz', () => {
    const pick = mustPick([
      rel('desktop-v0.1.58', {
        assets: [
          { name: 'AI_0.1.58_x64-setup.exe', size: 100, browser_download_url: 'https://h/a.exe' },
          { name: 'AI_0.1.54_x64-setup.exe', size: 1, browser_download_url: 'https://h/old.exe' },
          { name: 'AI_0.1.58_x64-setup.exe.sig', size: 1, browser_download_url: 'https://h/a.sig' },
          {
            name: 'AI_universal.app.tar.gz',
            size: 1,
            browser_download_url: 'https://h/m.app.tar.gz',
          },
        ],
      }),
    ])
    const src = buildLiveSource(pick, null, 'o/r')
    expect(src.assets.map((a) => a.href)).toEqual(['https://h/a.exe'])
    expect(src.assets[0]?.format).toBe('Windows NSIS exe')
  })
})

describe('extractSemver', () => {
  it('能从 tag 或资产名里取出版本号,取不到返回 null(不编造)', () => {
    expect(extractSemver('v1.2.3')).toBe('1.2.3')
    expect(extractSemver('mobile-v0.0.5')).toBe('0.0.5')
    expect(extractSemver('ihui-ai-1.0.0.apk')).toBe('1.0.0')
    expect(extractSemver('nightly-38704094092')).toBeNull()
    expect(extractSemver(null, undefined)).toBeNull()
  })
})

describe('pickLatestApkRelease', () => {
  it('只认带固定 APK 资产的 release —— 桌面 release 自然被排除(它没有这个资产)', () => {
    const picked = pickLatestApkRelease([
      rel('desktop-v0.1.58', {
        assets: [{ name: 'AI_0.1.58_x64-setup.exe', browser_download_url: 'https://h/a.exe' }],
      }),
      rel('nightly-1', {
        published_at: '2026-10-15T00:00:00Z',
        assets: [{ name: 'ihui-ai-latest.apk', size: 42, browser_download_url: 'https://h/a.apk' }],
      }),
    ])
    expect(picked?.release.tag_name).toBe('nightly-1')
    expect(picked?.asset.browser_download_url).toBe('https://h/a.apk')
  })

  it('多个候选时取发布时间最新的一个(APK 的 tag 是 nightly-<run_id>,比不了大小只能比时间)', () => {
    const picked = pickLatestApkRelease([
      rel('nightly-1', {
        published_at: '2026-10-10T00:00:00Z',
        assets: [{ name: 'ihui-ai-latest.apk', browser_download_url: 'https://h/old.apk' }],
      }),
      rel('nightly-2', {
        published_at: '2026-10-15T00:00:00Z',
        assets: [{ name: 'ihui-ai-latest.apk', browser_download_url: 'https://h/new.apk' }],
      }),
    ])
    expect(picked?.asset.browser_download_url).toBe('https://h/new.apk')
  })

  it('草稿不算,一个都没有时返回 null', () => {
    expect(
      pickLatestApkRelease([
        rel('nightly-x', {
          draft: true,
          assets: [{ name: 'ihui-ai-latest.apk', browser_download_url: 'https://h/a.apk' }],
        }),
      ]),
    ).toBeNull()
    expect(pickLatestApkRelease([])).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

describe('preferGiteeWindows —— 国内可达偏好,但绝不盲钉', () => {
  const payload = {
    version: '0.1.75',
    notes: 'n',
    pub_date: '2026-10-17T00:00:00.000Z',
    platforms: {
      'windows-x86_64': {
        url: 'https://github.com/o/r/releases/download/desktop-v0.1.75/AI_0.1.75_x64-setup.exe',
        signature: 'SIG',
      },
    },
  }

  it('Gitee 确实持有同名资产时才改用它', async () => {
    // 用 globalThis.fetch 打桩:Gitee tags 接口返回带该资产的 release
    const real = globalThis.fetch
    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({
        assets: [{ name: 'AI_0.1.75_x64-setup.exe', browser_download_url: 'x' }],
      }),
    })) as unknown as typeof fetch
    try {
      const out = await preferGiteeWindows(payload, 'desktop-v0.1.75')
      expect(out?.platforms['windows-x86_64']?.url).toContain('gitee.com')
      // 签名必须原样保留 —— minisign 是对包体字节签的,换 host 不影响验签
      expect(out?.platforms['windows-x86_64']?.signature).toBe('SIG')
    } finally {
      globalThis.fetch = real
    }
  })

  it('Gitee 没有该资产时保持 release 原生 URL(0.1.74 全量 404 的教训)', async () => {
    const real = globalThis.fetch
    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({ assets: [] }),
    })) as unknown as typeof fetch
    try {
      const out = await preferGiteeWindows(payload, 'desktop-v0.1.75')
      expect(out?.platforms['windows-x86_64']?.url).toContain('github.com')
    } finally {
      globalThis.fetch = real
    }
  })

  it('Gitee 接口不可达时也不动 URL(宁走可达的 GitHub,不给死链)', async () => {
    const real = globalThis.fetch
    globalThis.fetch = (async () => {
      throw new Error('ETIMEDOUT')
    }) as unknown as typeof fetch
    try {
      const out = await preferGiteeWindows(payload, 'desktop-v0.1.75')
      expect(out?.platforms['windows-x86_64']?.url).toContain('github.com')
    } finally {
      globalThis.fetch = real
    }
  })
})
