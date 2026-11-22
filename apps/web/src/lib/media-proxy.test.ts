// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import { toMediaDownloadUrl, toMediaImageUrl, toMediaStreamUrl } from './media-proxy'

/**
 * 媒体直链同源代理化助手的三支边界。
 *
 * 这组断言存在的理由:CSP 已把 `img-src` 收窄到 `'self' data: blob:` + 7 个白名单域名、
 * `media-src` 收窄到 `'self' blob:`。助手一旦漏改写,浏览器当场拦掉(图裂/播放失败),
 * 而这类失效在组件级测试里看不见 —— 组件断言只验 `src` 等于"某个字符串"。
 */

describe('toMediaImageUrl', () => {
  it('空值与非法类型返回空串', () => {
    expect(toMediaImageUrl(undefined)).toBe('')
    expect(toMediaImageUrl(null)).toBe('')
    expect(toMediaImageUrl('')).toBe('')
    expect(toMediaImageUrl('   ')).toBe('')
  })

  it('白名单外任意公网直链走同源代理且完整编码', () => {
    const src = 'https://cdn.example.com/a/b.png?x=1&y=2#frag'
    expect(toMediaImageUrl(src)).toBe(`/api/media/image?url=${encodeURIComponent(src)}`)
  })

  it('白名单域名(含 aizhs.top 子域)直连,不改写', () => {
    for (const host of [
      'aizhs.top',
      'www.aizhs.top',
      'api.dicebear.com',
      'lh3.googleusercontent.com',
      'avatars.githubusercontent.com',
      'platform-lookaside.fbsx.com',
      'api.qrserver.com',
      'test-for-dp.oss-cn-guangzhou.aliyuncs.com',
    ]) {
      const src = `https://${host}/img/x.png`
      expect(toMediaImageUrl(src)).toBe(src)
    }
  })

  it('形似白名单的伪造域名不得直连(后缀匹配必须以点号起)', () => {
    for (const host of ['evil-aizhs.top', 'aizhs.top.evil.com', 'notaizhs.top']) {
      const src = `https://${host}/x.png`
      expect(toMediaImageUrl(src)).toBe(`/api/media/image?url=${encodeURIComponent(src)}`)
    }
  })

  it('协议相对 //host/path 补成 https 后走代理(否则被 CSP 拦成图裂)', () => {
    expect(toMediaImageUrl('//cdn.example.com/a.png')).toBe(
      `/api/media/image?url=${encodeURIComponent('https://cdn.example.com/a.png')}`,
    )
    // 白名单域名的协议相对形态同样补 scheme 后直连
    expect(toMediaImageUrl('//aizhs.top/a.png')).toBe('https://aizhs.top/a.png')
  })

  it('首尾空白被修剪,大写 scheme 照常识别', () => {
    expect(toMediaImageUrl('  https://cdn.example.com/a.png  ')).toBe(
      `/api/media/image?url=${encodeURIComponent('https://cdn.example.com/a.png')}`,
    )
    expect(toMediaImageUrl('HTTPS://cdn.example.com/a.png')).toBe(
      `/api/media/image?url=${encodeURIComponent('HTTPS://cdn.example.com/a.png')}`,
    )
  })

  it('同源相对路径与 blob: 原样返回', () => {
    expect(toMediaImageUrl('/uploads/a.png')).toBe('/uploads/a.png')
    expect(toMediaImageUrl('remote-images/a.png')).toBe('remote-images/a.png')
    expect(toMediaImageUrl('blob:https://x/0b1c')).toBe('blob:https://x/0b1c')
  })

  it('data: 只放行图片子类型,非图片一律丢弃', () => {
    expect(toMediaImageUrl('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA')
    expect(toMediaImageUrl('data:text/html;base64,PHN2Zz4=')).toBe('')
    expect(toMediaImageUrl('data:video/mp4;base64,AAAA')).toBe('')
  })

  it('危险 scheme 与伪装形态一律丢弃', () => {
    expect(toMediaImageUrl('javascript:alert(1)')).toBe('')
    expect(toMediaImageUrl('JaVaScRiPt:alert(1)')).toBe('')
    expect(toMediaImageUrl('java\nscript:alert(1)')).toBe('')
    expect(toMediaImageUrl('vbscript:msgbox(1)')).toBe('')
    expect(toMediaImageUrl('file:///C:/secret.png')).toBe('')
  })
})

describe('toMediaStreamUrl', () => {
  it('外部直链走 stream 代理(media-src 无 https 通配,白名单域名也必须代理)', () => {
    const src = 'https://cdn.example.com/v.mp4'
    expect(toMediaStreamUrl(src)).toBe(`/api/media/stream?url=${encodeURIComponent(src)}`)
    expect(toMediaStreamUrl('https://aizhs.top/v.mp4')).toBe(
      `/api/media/stream?url=${encodeURIComponent('https://aizhs.top/v.mp4')}`,
    )
  })

  it('协议相对与首尾空白同图片支', () => {
    expect(toMediaStreamUrl('//cdn.example.com/v.mp4')).toBe(
      `/api/media/stream?url=${encodeURIComponent('https://cdn.example.com/v.mp4')}`,
    )
    expect(toMediaStreamUrl('  https://cdn.example.com/v.mp4 ')).toBe(
      `/api/media/stream?url=${encodeURIComponent('https://cdn.example.com/v.mp4')}`,
    )
  })

  it('blob: / 同源相对路径原样,data: 只放行音视频', () => {
    expect(toMediaStreamUrl('blob:https://x/abc')).toBe('blob:https://x/abc')
    expect(toMediaStreamUrl('/uploads/v.mp4')).toBe('/uploads/v.mp4')
    expect(toMediaStreamUrl('data:audio/mpeg;base64,AAAA')).toBe('data:audio/mpeg;base64,AAAA')
    expect(toMediaStreamUrl('data:video/mp4;base64,AAAA')).toBe('data:video/mp4;base64,AAAA')
    expect(toMediaStreamUrl('data:image/png;base64,AAAA')).toBe('')
  })

  it('危险 scheme 一律丢弃', () => {
    expect(toMediaStreamUrl('javascript:alert(1)')).toBe('')
    expect(toMediaStreamUrl('file:///C:/v.mp4')).toBe('')
  })
})

describe('toMediaDownloadUrl', () => {
  it('外部直链走 download 代理', () => {
    const src = 'https://cdn.example.com/a.mp4'
    expect(toMediaDownloadUrl(src)).toBe(`/api/media/download?url=${encodeURIComponent(src)}`)
  })

  it('协议相对先补 scheme 再代理', () => {
    expect(toMediaDownloadUrl('//cdn.example.com/a.mp4')).toBe(
      `/api/media/download?url=${encodeURIComponent('https://cdn.example.com/a.mp4')}`,
    )
  })

  it('javascript: 不得出现在 href 面(可点脚本 URI)', () => {
    expect(toMediaDownloadUrl('javascript:alert(document.cookie)')).toBe('')
    expect(toMediaDownloadUrl('  javascript:alert(1)  ')).toBe('')
    expect(toMediaDownloadUrl('java\tscript:alert(1)')).toBe('')
  })

  it('blob: 与相对路径原样(下载 fetch 需要)', () => {
    expect(toMediaDownloadUrl('blob:https://x/abc')).toBe('blob:https://x/abc')
    expect(toMediaDownloadUrl('/api/artifacts/f/abc')).toBe('/api/artifacts/f/abc')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
