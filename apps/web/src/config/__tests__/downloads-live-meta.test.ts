// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * downloads-live-meta 的镜像测试(AGENTS §22c:判据 import 源文件,本文件零复算)。
 *
 * 覆盖的是"三态不许并桶"这条最容易静默失效的边:
 *   live(取到真值)/ snapshot(拿不到输入)/ unavailable(拿到了输入且判据不命中)
 * 每一档都有成对夹具 —— 少一档判据分支,对应那条用例就该翻红。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { __test__ as liveMeta } from '../downloads-live-meta'
import { __test__ as liveIo } from '../downloads-live'

const {
  judgeAppVersionRow,
  judgeNpmRegistryDoc,
  judgeIosReleaseDoc,
  judgeExtensionArtifact,
  pickNewestArtifact,
  parseVersionFromArtifactName,
  extensionAssetHref,
  isoDateOf,
  mergeLiveMeta,
  liveEntryView,
  toDesktopLiveInfo,
} = liveMeta

const NOW = '2026-11-02T10:00:00.000Z'

const androidInput = {
  registryPlatform: 'android',
  displayPlatform: 'android-apk' as const,
  assetFormat: 'Android APK',
  nowIso: NOW,
}

const staticMeta = {
  platform: 'desktop' as const,
  version: '0.1.76',
  releaseDate: '2026-10-18',
  assets: [{ href: '/old.exe', sizeBytes: 1, format: 'Windows NSIS exe' }],
}

describe('judgeAppVersionRow —— 注册表三态', () => {
  it('行在且自洽 ⇒ live,版本/日期/落点都来自行本身', () => {
    const out = judgeAppVersionRow(
      {
        code: 0,
        data: {
          latest: {
            version: '0.0.9',
            platform: 'android',
            status: 'latest',
            downloadUrl: 'https://www.aizhs.top/remote-images/download/ihui-ai-latest.apk',
            updatedAt: '2026-10-31T07:00:00Z',
          },
        },
      },
      androidInput,
    )
    expect(out.source).toBe('live')
    expect(out.version).toBe('0.0.9')
    expect(out.releaseDate).toBe('2026-10-31')
    expect(out.assets?.[0]?.href).toContain('ihui-ai-latest.apk')
    // displayPlatform 必须落回下载端枚举,注册表键不得泄漏成 UI 的 platform
    expect(out.platform).toBe('android-apk')
  })

  it('响应读不到 ⇒ snapshot(不猜),而不是"该端没货"', () => {
    expect(judgeAppVersionRow(null, androidInput)).toMatchObject({
      source: 'snapshot',
      reason: 'registry-unreachable',
    })
  })

  it('端点通但没有 latest 行 ⇒ unavailable 并点名(有输入、判据不命中)', () => {
    expect(judgeAppVersionRow({ code: 0, data: {} }, androidInput)).toMatchObject({
      source: 'unavailable',
      reason: 'registry-row-missing:android',
    })
  })

  it('行里 status 或 platform 不自洽 ⇒ unavailable,不硬用', () => {
    const wrongStatus = {
      code: 0,
      data: {
        latest: {
          version: '1',
          platform: 'android',
          status: 'history',
          downloadUrl: 'https://x/a.apk',
        },
      },
    }
    expect(judgeAppVersionRow(wrongStatus, androidInput).source).toBe('unavailable')
    const wrongPlatform = {
      code: 0,
      data: {
        latest: { version: '1', platform: 'ios', status: 'latest', downloadUrl: 'https://x/a.apk' },
      },
    }
    expect(judgeAppVersionRow(wrongPlatform, androidInput).reason).toContain(
      'registry-row-inconsistent:ios/latest',
    )
  })

  it('非 0 code ⇒ snapshot;有行但没 downloadUrl ⇒ unavailable', () => {
    expect(judgeAppVersionRow({ code: 500, data: null }, androidInput).source).toBe('snapshot')
    const noUrl = {
      code: 0,
      data: { latest: { version: '1', platform: 'android', status: 'latest', downloadUrl: '' } },
    }
    expect(judgeAppVersionRow(noUrl, androidInput).reason).toBe('registry-row-has-no-download-url')
  })
})

describe('judgeNpmRegistryDoc —— CLI 端 npm 真值', () => {
  const input = { packageName: 'ihui-cli', nowIso: NOW }
  it('dist-tags.latest 命中 versions ⇒ live,日期取 time[version]', () => {
    const out = judgeNpmRegistryDoc(
      {
        'dist-tags': { latest: '2.3.1' },
        time: { '2.3.1': '2026-10-30T01:00:00.000Z' },
        versions: { '2.3.1': {} },
      },
      input,
    )
    expect(out).toMatchObject({
      source: 'live',
      version: '2.3.1',
      releaseDate: '2026-10-30',
      platform: 'cli',
    })
    expect(out.assets).toEqual([])
  })
  it('dist-tag 指向不存在的版本 ⇒ unavailable,不报绿', () => {
    const out = judgeNpmRegistryDoc({ 'dist-tags': { latest: '9.9.9' }, versions: {} }, input)
    expect(out).toMatchObject({
      source: 'unavailable',
      reason: 'npm-dist-tag-versions-desync:9.9.9',
    })
  })
  it('无 latest 标签 ⇒ unavailable;文档读不到 ⇒ snapshot(两态不并桶)', () => {
    expect(judgeNpmRegistryDoc({ 'dist-tags': {}, versions: {} }, input).source).toBe('unavailable')
    expect(judgeNpmRegistryDoc(null, input).source).toBe('snapshot')
  })
})

describe('judgeIosReleaseDoc —— iOS 固定 tag,不拿 latest 别名', () => {
  const input = { assetName: 'ihui-ai-latest.ipa', nowIso: NOW }
  it('资产在 ⇒ live,体积用 API 给的字节数', () => {
    const out = judgeIosReleaseDoc(
      {
        tag_name: 'ios-nightly',
        published_at: '2026-09-10T12:53:19Z',
        assets: [
          {
            name: 'ihui-ai-latest.ipa',
            size: 42825432,
            browser_download_url: 'https://github.com/x/ios-nightly/ihui-ai-latest.ipa',
          },
        ],
      },
      input,
    )
    expect(out).toMatchObject({ source: 'live', releaseDate: '2026-09-10' })
    expect(out.assets?.[0]?.sizeBytes).toBe(42825432)
    // 版本号不在这条腿上:tag 不含 semver ⇒ 绝不编一个出来
    expect(out.version).toBeUndefined()
  })
  it('tag 存在但没有该资产 ⇒ unavailable;文档形状不对 ⇒ snapshot', () => {
    expect(judgeIosReleaseDoc({ tag_name: 'ios-nightly', assets: [] }, input).source).toBe(
      'unavailable',
    )
    expect(judgeIosReleaseDoc({ unexpected: true }, input).source).toBe('snapshot')
  })
  it('资产有名字但没有直链 ⇒ unavailable(有行≠可用)', () => {
    const out = judgeIosReleaseDoc(
      { tag_name: 'ios-nightly', assets: [{ name: 'ihui-ai-latest.ipa', size: 1 }] },
      input,
    )
    expect(out.reason).toBe('ios-asset-has-no-download-url')
  })
})

describe('judgeExtensionArtifact —— 实物字节压过派生标签', () => {
  const artifact = {
    name: 'IHUI-AI-Extension-chrome-v1.0.1.zip',
    sizeBytes: 1897977,
    mtimeMs: 2000,
  }
  it('体积以实物为准,manifest 不一致只点名不改结论', () => {
    const out = judgeExtensionArtifact(artifact, { version: '1.0.1', sizeBytes: 6498757 }, NOW)
    expect(out.source).toBe('live')
    expect(out.assets?.[0]?.sizeBytes).toBe(1897977)
    expect(out.reason).toContain('extension-manifest-size-drift:6498757!=1897977')
  })
  it('manifest 与实物一致 ⇒ 不产生噪声 reason', () => {
    const out = judgeExtensionArtifact(artifact, { version: '1.0.1', sizeBytes: 1897977 }, NOW)
    expect(out.reason).toBeUndefined()
  })
  it('版本名对不上时不编:文件名没有 semver ⇒ version 缺失但仍可下载', () => {
    const out = judgeExtensionArtifact({ ...artifact, name: 'extension.zip' }, null, NOW)
    expect(out.version).toBeUndefined()
    expect(out.source).toBe('live')
  })
  it('枚举到 0 枚 ⇒ unavailable(不用 0 冒充"有包")', () => {
    expect(judgeExtensionArtifact(pickNewestArtifact([]), null, NOW).source).toBe('unavailable')
  })
  it('多枚取 mtime 最新那枚', () => {
    const newest = pickNewestArtifact([
      { name: 'a-v1.0.0.zip', sizeBytes: 10, mtimeMs: 100 },
      { name: 'b-v1.0.2.zip', sizeBytes: 20, mtimeMs: 300 },
      { name: 'c-v1.0.1.zip', sizeBytes: 30, mtimeMs: 200 },
    ])
    expect(newest?.name).toBe('b-v1.0.2.zip')
    expect(parseVersionFromArtifactName('b-v1.0.2.zip')).toBe('1.0.2')
    expect(extensionAssetHref('b v.zip')).toBe('/downloads/extension/b%20v.zip')
  })
})

describe('mergeLiveMeta / liveEntryView —— 底稿与真值只有一条合并规则', () => {
  it('snapshot 与 unavailable 都不许覆盖底稿', () => {
    for (const source of ['snapshot', 'unavailable'] as const) {
      expect(mergeLiveMeta(staticMeta, { platform: 'desktop', source, resolvedAt: NOW })).toBe(
        staticMeta,
      )
    }
  })
  it('live 覆盖版本/日期/安装包,空 assets 不清底稿', () => {
    const merged = mergeLiveMeta(staticMeta, {
      platform: 'desktop',
      source: 'live',
      version: '0.1.80',
      releaseDate: '2026-11-01',
      assets: [],
      resolvedAt: NOW,
    })
    expect(merged.version).toBe('0.1.80')
    expect(merged.assets).toEqual(staticMeta.assets)
  })
  it('live 取不到版本号时保留底稿(不写空也不编)', () => {
    const merged = mergeLiveMeta(staticMeta, {
      platform: 'desktop',
      source: 'live',
      resolvedAt: NOW,
    })
    expect(merged.version).toBe('0.1.76')
  })
  it('非 live 一律回落底稿 href:解析失败不把入口判死', () => {
    expect(
      liveEntryView({ platform: 'ios', source: 'snapshot', resolvedAt: NOW }, '/fallback'),
    ).toEqual({
      href: '/fallback',
      hasLiveAsset: false,
    })
    expect(liveEntryView(null, '/fallback').href).toBe('/fallback')
  })
  it('底稿已有去处 ⇒ 运行期资产不得覆写点击语义(版本号照样取真值)', () => {
    expect(
      liveEntryView(
        {
          platform: 'ios',
          source: 'live',
          version: '9',
          assets: [{ href: 'https://x/ipa', sizeBytes: 1, format: 'iOS IPA (TrollStore)' }],
          resolvedAt: NOW,
        },
        '/download/ios',
      ),
    ).toEqual({ version: '9', href: '/download/ios', hasLiveAsset: true })
  })
  it('底稿为空(该端未接入)⇒ 运行期一有货就点亮,不必等重新构建', () => {
    expect(
      liveEntryView(
        {
          platform: 'wechat-miniapp',
          source: 'live',
          version: '1.2.3',
          assets: [{ href: 'https://x/qr', sizeBytes: 0, format: '微信小程序' }],
          resolvedAt: NOW,
        },
        '',
      ),
    ).toEqual({ version: '1.2.3', href: 'https://x/qr', hasLiveAsset: true })
  })
  it('live 但没资产 ⇒ 落点仍用底稿,且不算"有可点安装包"', () => {
    const view = liveEntryView(
      { platform: 'cli', source: 'live', version: '2.3.1', assets: [], resolvedAt: NOW },
      '/download/cli',
    )
    expect(view).toEqual({ version: '2.3.1', href: '/download/cli', hasLiveAsset: false })
  })
})

describe('toDesktopLiveInfo —— desktop 落形只搬展示三件,不把签名抄成第二个消费面', () => {
  const source = {
    version: '0.1.80',
    releaseDate: '2026-11-01',
    assets: [
      {
        href: 'https://x/a.exe',
        sizeBytes: 10142082,
        format: 'Windows NSIS exe',
        arch: 'x64',
        signature: 'sig-for-updater-only',
      },
    ],
  }
  it('版本/日期/资产按运行期真值落形,signature 不外泄到 DownloadAsset', () => {
    expect(toDesktopLiveInfo(source, NOW)).toEqual({
      platform: 'desktop',
      source: 'live',
      version: '0.1.80',
      releaseDate: '2026-11-01',
      assets: [
        { href: 'https://x/a.exe', sizeBytes: 10142082, format: 'Windows NSIS exe', arch: 'x64' },
      ],
      resolvedAt: NOW,
    })
  })
  it('合并进底稿后,页面版本号来自运行期而非 10-18 的快照', () => {
    const merged = mergeLiveMeta(staticMeta, toDesktopLiveInfo(source, NOW))
    expect(merged.version).toBe('0.1.80')
    expect(merged.releaseDate).toBe('2026-11-01')
  })
})

describe('形状锁(两面各一条,缺一档即翻红)', () => {
  const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf-8')
  it('纯判据文件不得含 node:fs —— 侧栏是 client component,fs 进包即构建错误', () => {
    expect(read('../downloads-live-meta.ts')).not.toMatch(/from ['"]node:fs['"]/)
  })
  it('IO 文件必须真的含 node:fs(扩展端要枚举实物文件)', () => {
    expect(read('../downloads-live.ts')).toMatch(/from ['"]node:fs['"]/)
  })
  it('release 枚举必须分页:单页会被 nightly 顶穿(2026-11-02 实测第一页 100 条里 0 个 desktop-v*)', () => {
    const feed = read('../desktop-feed-live.ts')
    expect(feed).toMatch(/fetchReleasesPaged\(/)
    // 摘掉分页 ⇒ 这条翻红:裸 per_page=100 单页就是今天桌面端躺在旧快照的真因
    expect(feed).not.toMatch(/releases\?per_page=100/)
  })
  it('desktop 落形不得自己再排一份 semver 或自己拼 release 前缀(§0.6 零复算)', () => {
    const io = read('../downloads-live.ts')
    expect(io).not.toMatch(/cmpVer\(/)
    expect(io).not.toMatch(/sortAssets\(/)
    expect(io).not.toMatch(/RELEASE_PREFIX/)
  })
  it('注册表基址:空 env 显式回落 127.0.0.1,不回落 localhost', () => {
    expect(liveIo.localApiBase('')).toBe('http://127.0.0.1:8802')
    expect(liveIo.localApiBase(undefined)).toBe('http://127.0.0.1:8802')
    expect(liveIo.localApiBase('http://127.0.0.1:8802///')).toBe('http://127.0.0.1:8802')
  })
  it('isoDateOf 只认 YYYY-MM-DD 前缀,其余一律 undefined', () => {
    expect(isoDateOf('2026-11-02T01:00:00Z')).toBe('2026-11-02')
    expect(isoDateOf('')).toBeUndefined()
    expect(isoDateOf(null)).toBeUndefined()
    expect(isoDateOf('unknown')).toBeUndefined()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
