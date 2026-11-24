// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * feed v2 发布侧结构判据。
 *
 * 这里锁的是“坏 feed 不能上线”，不是重复客户端逻辑：
 * 版本字段必须与 update_v2.rs 的 `[0-9A-Za-z.-]{1,64}` 同形；
 * payload 上限必须与客户端 MAX_ZIP_BYTES=300MB 对齐，否则线上会出现
 * “feed 校验通过、客户端永远拒收”的假绿。
 */
import { describe, expect, it } from 'vitest'

import { isValidDesktopFeedV2 } from '../src/config/desktop-feed-v2-validation'

const SHA = 'a'.repeat(64)

type V2Feed = {
  schema: number
  version: string
  channel: string
  rollout: { percent: number }
  minSupported: string | null
  revoked: string[]
  rollbackTo: string | null
  notes: string
  payload: {
    url: string
    size: number
    sha256: string
    signature: string
    format: 'zip'
    platform: string
    minLauncher: string
  }
}

function validFeed(): V2Feed {
  return {
    schema: 2,
    version: '0.1.94',
    channel: 'stable',
    rollout: { percent: 5 },
    minSupported: '0.1.90',
    revoked: ['0.1.91'],
    rollbackTo: null,
    notes: 'test',
    payload: {
      url: 'https://example.com/ihui-0.1.94.zip',
      size: 10 * 1024 * 1024,
      sha256: SHA,
      signature: 'untrusted comment: signature\nRWS...',
      format: 'zip',
      platform: 'windows-x86_64',
      minLauncher: '0.1.0',
    },
  }
}

describe('isValidDesktopFeedV2', () => {
  it('合法 feed 放行', () => {
    expect(isValidDesktopFeedV2(validFeed())).toBe(true)
  })

  it('minSupported / rollbackTo / revoked / minLauncher 必须是合法版本号', () => {
    for (const mutate of [
      (f: ReturnType<typeof validFeed>) => (f.minSupported = 'latest'),
      (f: ReturnType<typeof validFeed>) => (f.rollbackTo = '../0.1.92'),
      (f: ReturnType<typeof validFeed>) => (f.revoked = ['0.1.91', 'bad/version']),
      (f: ReturnType<typeof validFeed>) => (f.payload.minLauncher = '*'),
    ]) {
      const feed = validFeed()
      mutate(feed)
      expect(isValidDesktopFeedV2(feed)).toBe(false)
    }
  })

  it('payload size 与客户端 300MB 上限对齐', () => {
    const atLimit = validFeed()
    atLimit.payload.size = 300 * 1024 * 1024
    expect(isValidDesktopFeedV2(atLimit)).toBe(true)

    const overLimit = validFeed()
    overLimit.payload.size = 300 * 1024 * 1024 + 1
    expect(isValidDesktopFeedV2(overLimit)).toBe(false)
  })

  it('url 必须 https、sha256 必须 64 位、签名不能为空', () => {
    for (const url of [
      'http://example.com/a.zip',
      'https://user:pass@example.com/a.zip',
      'https:///a.zip',
      'https://example.com/a.zip#frag',
    ]) {
      const feed = validFeed()
      feed.payload.url = url
      expect(isValidDesktopFeedV2(feed)).toBe(false)
    }

    const badSha = validFeed()
    badSha.payload.sha256 = 'abc'
    expect(isValidDesktopFeedV2(badSha)).toBe(false)

    const badSig = validFeed()
    badSig.payload.signature = '   '
    expect(isValidDesktopFeedV2(badSig)).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
