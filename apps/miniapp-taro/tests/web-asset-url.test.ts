// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 小程序侧静态素材 URL 解析锁：Taro `<Image src="/agents/...">` 会被当成包内文件，
 * 必须补 Web 站点底座；绝对 URL / 本地临时文件原样透传。
 */
import { describe, expect, it } from 'vitest'
import {
  resolveWebAssetUrl,
  resolveAvatarUrl,
  DEFAULT_AGENT_AVATAR,
} from '../src/utils/web-asset-url'

describe('resolveWebAssetUrl (miniapp)', () => {
  it('站内相对路径补域，且不误补 /api', () => {
    const url = resolveWebAssetUrl('/agents/coze/example.webp')
    expect(url).toMatch(/^https?:\/\/.+\/agents\/coze\/example\.webp$/)
    expect(url).not.toContain('/api/agents/')
  })

  it('绝对 URL / data / 本地临时文件原样透传', () => {
    expect(resolveWebAssetUrl('https://cdn.example.com/a.webp')).toBe(
      'https://cdn.example.com/a.webp',
    )
    expect(resolveWebAssetUrl('data:image/png;base64,AA')).toBe('data:image/png;base64,AA')
    expect(resolveWebAssetUrl('wxfile://tmp_abc.jpg')).toBe('wxfile://tmp_abc.jpg')
  })

  it('空值返回 undefined', () => {
    expect(resolveWebAssetUrl('')).toBeUndefined()
    expect(resolveWebAssetUrl('   ')).toBeUndefined()
    expect(resolveWebAssetUrl(null)).toBeUndefined()
  })
})

describe('resolveAvatarUrl (miniapp)', () => {
  it('后端下发的站内相对路径补站点底座', () => {
    const url = resolveAvatarUrl('/agents/coze/example.webp')
    expect(url).toMatch(/^https?:\/\/.+\/agents\/coze\/example\.webp$/)
  })

  it('http/https 绝对 URL 原样透传', () => {
    expect(resolveAvatarUrl('https://cdn.example.com/a.webp')).toBe(
      'https://cdn.example.com/a.webp',
    )
    expect(resolveAvatarUrl('http://img.example.com/b.jpg')).toBe('http://img.example.com/b.jpg')
  })

  it('空值/非字符串回本地占位图', () => {
    expect(resolveAvatarUrl('')).toBe(DEFAULT_AGENT_AVATAR)
    expect(resolveAvatarUrl('   ')).toBe(DEFAULT_AGENT_AVATAR)
    expect(resolveAvatarUrl(null)).toBe(DEFAULT_AGENT_AVATAR)
    expect(resolveAvatarUrl(undefined)).toBe(DEFAULT_AGENT_AVATAR)
    expect(resolveAvatarUrl(123)).toBe(DEFAULT_AGENT_AVATAR)
  })

  it('本端静态前缀原样透传,不拼站点底座', () => {
    expect(resolveAvatarUrl('/pkg-ai/assets/default-agent.png')).toBe(
      '/pkg-ai/assets/default-agent.png',
    )
    expect(resolveAvatarUrl('/static/logo.png')).toBe('/static/logo.png')
  })

  it('可传自定义 fallback', () => {
    expect(resolveAvatarUrl(null, '/custom/fallback.png')).toBe('/custom/fallback.png')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
