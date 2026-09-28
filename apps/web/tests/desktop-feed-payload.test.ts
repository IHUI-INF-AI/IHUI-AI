// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

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

// 现状快照(desktop-v0.1.49,2026-09-27 生成)的逐字节输出基准;
// 每次发版自动同步 desktop-feed.generated.ts 后,本基准随快照一起翻页。
const LOCKED_WIN_URL =
  'https://gitee.com/JLSLSSZWHYXGS_0/IHUI-AI/releases/download/desktop-v0.1.49/AI_0.1.49_x64-setup.exe'
const LOCKED_WIN_SIG =
  'dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkKUlVRSTI3R2lmdWJYdGZMVnFSd3FVd3ZHYzRYcFFNTitGUEQySWFZbTM1YmU1UTRWUW5VUlhYdGlqQ3ZlNEYrNTdmTDFBbGNjZllQdVZRL09HTGNzZFVwYWFiUTJJS3h6QXdrPQp0cnVzdGVkIGNvbW1lbnQ6IHRpbWVzdGFtcDoxNzkwNTA2MDM4CWZpbGU65pm65rGHQUlfMC4xLjQ5X3g2NC1zZXR1cC5leGUKZ08zbmpqdi9wNVdIVzVXUFMxSVZzcWZLQy9HTlZjdXN5ODd4S1IzdmNaaFd4UlNoWW40cXgyMWQxbDRGQ2pNejhCQTFvdk1DemllK3BTSm9oUlNUQXc9PQo='

describe('buildDesktopFeedPayload — 现状快照(四平台 updaterPlatforms)', () => {
  const payload = buildDesktopFeedPayload(DESKTOP_FEED) as DesktopFeedPayload

  it('windows-x86_64 与改造前逐字节一致(version/url/signature 三口)', () => {
    expect(payload).not.toBeNull()
    expect(payload.version).toBe('0.1.49')
    expect(payload.platforms['windows-x86_64']).toEqual({
      url: LOCKED_WIN_URL,
      signature: LOCKED_WIN_SIG,
    })
  })

  it('notes / pub_date 与旧 route 模板逐字节一致', () => {
    expect(payload.notes).toBe(
      '智汇AI 桌面端 0.1.49:极速薄壳(3MB)、首启不白屏、线上部署自动热刷新、断网兜底、自动更新。',
    )
    expect(payload.pub_date).toBe(new Date('2026-09-27T00:00:00Z').toISOString())
  })

  it('mac/linux 键存在、指向 GitHub 直链、签名非空、dmg 不出现', () => {
    for (const key of ['linux-x86_64', 'darwin-x86_64', 'darwin-aarch64']) {
      const entry = payload.platforms[key]
      expect(entry, `缺平台键 ${key}`).toBeTruthy()
      expect(new URL(entry.url).hostname).toBe('github.com')
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
