// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 站点 updater feed 共享拼装器(desktop-feed-payload.ts)的行为判据。
 * /desktop-feed.json 与 /api/desktop-feed 两条 route 只是它的薄壳,
 * 判据集中于此:① updaterPlatforms 直通且 windows 键逐字节锁定;
 * ② 旧快照(无该字段)回落与改造前 route 完全一致的 windows 派生;
 * ③ 空映射 + 无 windows 资产 → null(route 侧保持历史 404 形态)。
 */
import { describe, expect, it } from 'vitest'

import { DESKTOP_FEED } from '@/config/desktop-feed.generated'
import { buildDesktopFeedPayload, type DesktopFeedPayload } from '@/config/desktop-feed-payload'
import type { DesktopFeed } from '@/config/desktop-feed.generated'

// 逐字节基准改为**从产物推导**(2026-11-19):此前是手抄 0.1.77 的 url/签名/notes,
// 每次发版只翻产物不翻这里 ⇒ 三条锁必红(2026-09-28 已实测过一次)。现在基准取
// desktop-feed.generated.ts 的 updaterPlatforms,再由断言把"格式"钉死
// (文件名/标签/notes 模板/releaseDate 口径),这样翻页不再需要人工抄，
// 而模板一旦变样照样红。
const WIN_ENTRY = DESKTOP_FEED.updaterPlatforms?.['windows-x86_64']
const LOCKED_WIN_URL = WIN_ENTRY?.url ?? ''
const LOCKED_WIN_SIG = WIN_ENTRY?.signature ?? ''

describe('buildDesktopFeedPayload — 现状快照(四平台 updaterPlatforms)', () => {
  const payload = buildDesktopFeedPayload(DESKTOP_FEED) as DesktopFeedPayload

  it('windows-x86_64 与改造前逐字节一致(version/url/signature 三口)', () => {
    expect(payload).not.toBeNull()
    expect(payload.version).toBe(DESKTOP_FEED.version)
    expect(payload.platforms['windows-x86_64']).toEqual({
      url: LOCKED_WIN_URL,
      signature: LOCKED_WIN_SIG,
    })
    // 模板锁:直链必须来自 desktop-v<version> 标签的 AI_<version>_x64-setup.exe
    expect(LOCKED_WIN_URL).toBe(
      `https://github.com/IHUI-INF-AI/IHUI-AI/releases/download/desktop-v${DESKTOP_FEED.version}/AI_${DESKTOP_FEED.version}_x64-setup.exe`,
    )
    expect(LOCKED_WIN_SIG.length).toBeGreaterThan(0)
  })

  it('notes / pub_date 与旧 route 模板逐字节一致', () => {
    expect(payload.notes).toBe(
      `智汇AI 桌面端 ${DESKTOP_FEED.version}:极速薄壳(3MB)、首启不白屏、线上部署自动热刷新、断网兜底、自动更新。`,
    )
    expect(payload.pub_date).toBe(new Date(`${DESKTOP_FEED.releaseDate}T00:00:00Z`).toISOString())
  })

  it('mac/linux 键存在、host 在白名单(gitee/github 均可,2026-10-12 起 Gitee 已补齐)、签名非空、dmg 不出现', () => {
    for (const key of ['linux-x86_64', 'darwin-x86_64', 'darwin-aarch64']) {
      const entry = payload.platforms[key]
      expect(entry, `缺平台键 ${key}`).toBeTruthy()
      expect(['github.com', 'gitee.com']).toContain(new URL(entry.url).hostname)
      expect(entry.signature.length).toBeGreaterThan(0)
      expect(entry.url).not.toMatch(/\.dmg$/)
    }
    expect(payload.platforms['darwin-x86_64'].url).toMatch(/\.app\.tar\.gz$/)
  })
})

describe('buildDesktopFeedPayload — 旧快照回落(无 updaterPlatforms 字段)', () => {
  const legacyFeed = {
    ...DESKTOP_FEED,
    updaterPlatforms: undefined,
  } as DesktopFeed

  it('回落到与改造前 route 相同的 windows 单键派生(逐字节)', () => {
    const payload = buildDesktopFeedPayload(legacyFeed) as DesktopFeedPayload
    expect(Object.keys(payload.platforms)).toEqual(['windows-x86_64'])
    expect(payload.platforms['windows-x86_64']).toEqual({
      url: LOCKED_WIN_URL,
      signature: LOCKED_WIN_SIG,
    })
  })

  it('updaterPlatforms 为空对象时同样走回落;彻底无 windows 资产则返回 null(404 形态)', () => {
    const empty = { ...DESKTOP_FEED, updaterPlatforms: {} } as DesktopFeed
    expect(Object.keys((buildDesktopFeedPayload(empty) as DesktopFeedPayload).platforms)).toEqual([
      'windows-x86_64',
    ])
    const noWin = {
      ...DESKTOP_FEED,
      updaterPlatforms: {},
      assets: DESKTOP_FEED.assets.filter((a) => !/Windows/i.test(a.format)),
    } as DesktopFeed
    expect(buildDesktopFeedPayload(noWin)).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
