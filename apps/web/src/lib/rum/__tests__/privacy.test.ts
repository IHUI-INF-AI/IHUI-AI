// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import {
  getCoarsePlatform,
  redactTelemetryText,
  sanitizeApiPath,
  sanitizeRumProps,
} from '../privacy'

describe('redactTelemetryText', () => {
  it('删除 Windows 本地路径与邮箱', () => {
    const output = redactTelemetryText('failed at C:\\Users\\张三\\secret.txt for a@b.com')
    expect(output).not.toContain('张三')
    expect(output).not.toContain('secret.txt')
    expect(output).not.toContain('a@b.com')
    expect(output).toContain('<path>')
    expect(output).toContain('<email>')
  })

  it('删除 POSIX home 路径中的用户名', () => {
    const output = redactTelemetryText('open /home/张三/workspace/app.ts failed')
    expect(output).not.toContain('张三')
    expect(output).not.toContain('workspace')
    expect(output).toContain('<path>')
  })

  it('删除 file:// URL', () => {
    const output = redactTelemetryText('read file:///Users/张三/secret.txt')
    expect(output).not.toContain('张三')
    expect(output).not.toContain('secret.txt')
  })

  it('兜底删除无盘符的绝对路径 token', () => {
    const output = redactTelemetryText('load /srv/客户A/src/index.ts')
    expect(output).not.toContain('客户A')
    expect(output).toContain('<path>')
  })

  it('超长文本截断到 200 字符', () => {
    const output = redactTelemetryText('x'.repeat(400))
    expect(output.length).toBe(200)
  })

  it('非字符串输入返回空串', () => {
    expect(redactTelemetryText(undefined)).toBe('')
    expect(redactTelemetryText(123)).toBe('')
  })
})

describe('sanitizeRumProps', () => {
  it('白名单外字段（workspace/UA/屏幕/时区/语言）全部丢弃', () => {
    const props = sanitizeRumProps({
      app_start_ms: 120.4,
      platform: 'windows',
      workspace: '客户A项目',
      workspaceName: '客户A',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      screenWidth: 2560,
      timezone: 'Asia/Shanghai',
      language: 'zh-CN',
    })
    expect(props).toEqual({ app_start_ms: 120, platform: 'windows' })
  })

  it('非法平台值归一为 other，错误摘要被脱敏', () => {
    const props = sanitizeRumProps({
      platform: 'Mozilla/5.0',
      error_type: 'unhandledrejection',
      message: 'boom C:\\Users\\张三\\secret.txt a@b.com',
    })
    expect(props.platform).toBe('other')
    expect(props.error_type).toBe('unhandledrejection')
    expect(String(props.message)).not.toContain('张三')
    expect(String(props.message)).not.toContain('a@b.com')
  })

  it('数值字段拒绝负数/非有限/超上限值', () => {
    const props = sanitizeRumProps({
      app_start_ms: -1,
      first_token_ms: Number.NaN,
      stream_ms: 2_000,
      count: 86_400_001,
    })
    expect(props.app_start_ms).toBeUndefined()
    expect(props.first_token_ms).toBeUndefined()
    expect(props.count).toBeUndefined()
    expect(props.stream_ms).toBe(2_000)
  })
})

describe('sanitizeApiPath', () => {
  it('删除 query/hash 并把 UUID 归一为 :id', () => {
    const output = sanitizeApiPath(
      '/api/v1/sessions/123e4567-e89b-12d3-a456-426614174000/messages?token=secret#x',
    )
    expect(output).toBe('/api/v1/sessions/:id/messages')
    expect(output).not.toContain('secret')
    expect(output).not.toContain('123e4567')
  })

  it('非绝对路径归一为 <unknown>', () => {
    expect(sanitizeApiPath('api/v1/foo')).toBe('<unknown>')
    expect(sanitizeApiPath(undefined)).toBe('<unknown>')
  })

  it('长数字段归一为 :id', () => {
    expect(sanitizeApiPath('/api/v1/users/1234567890')).toBe('/api/v1/users/:id')
  })
})

describe('getCoarsePlatform', () => {
  it('从 UA 只返回粗粒度大类，绝不返回 UA 原文', () => {
    const platform = getCoarsePlatform({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
    } as unknown as Navigator)
    expect(platform).toBe('windows')
    expect(String(platform)).not.toContain('Mozilla')
  })

  it('userAgentData.platform 优先，并映射为枚举', () => {
    const platform = getCoarsePlatform({
      userAgent: 'Mozilla/5.0',
      userAgentData: { platform: 'macOS' },
    } as unknown as Navigator)
    expect(platform).toBe('macos')
  })

  it('无法识别时归一为 other', () => {
    expect(getCoarsePlatform({ userAgent: 'curl/8.0' } as unknown as Navigator)).toBe('other')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
