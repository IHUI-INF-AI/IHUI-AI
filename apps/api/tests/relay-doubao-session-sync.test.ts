// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.CREDENTIALS_ENCRYPTION_KEY ??= 'test-credentials-encryption-key-32-bytes!'
})

import { __test__ } from '../scripts/relay-doubao-session-sync.js'

describe('豆包整包 cookie 指纹(2026-11-26 回灌腿)', () => {
  it('空包指纹为空,绝不冒 same-bundle', () => {
    expect(__test__.doubaoBundleFingerprint([])).toBe('')
    expect(__test__.doubaoBundleFingerprint(null)).toBe('')
  })

  it('行序变化不算换票;name/key 两种形状归一', () => {
    const a = [
      { name: 'sessionid', host: '.doubao.com', value: 'v1' },
      { key: 'uid_tt', host: '.bytedance.com', value: 'v2' },
    ]
    const b = [
      { key: 'uid_tt', host: '.bytedance.com', value: 'v2' },
      { name: 'sessionid', host: '.doubao.com', value: 'v1' },
    ]
    expect(__test__.doubaoBundleFingerprint(a)).toBe(__test__.doubaoBundleFingerprint(b))
  })

  it('任一票值变化 = 换票,指纹必须变', () => {
    const a = [{ name: 'sessionid', host: '.doubao.com', value: 'v1' }]
    const b = [{ name: 'sessionid', host: '.doubao.com', value: 'v2' }]
    expect(__test__.doubaoBundleFingerprint(a)).not.toBe(__test__.doubaoBundleFingerprint(b))
  })

  it('落库腿只认 doubao + stdin', () => {
    expect(__test__.parseArgs(['--stdin']).error).toBeNull()
    expect(__test__.parseArgs(['--stdin', '--provider=doubao']).error).toBeNull()
    expect(__test__.parseArgs(['--stdin', '--provider=loomy']).error).toMatch(/doubao/)
    expect(__test__.parseArgs([]).error).toMatch(/stdin/)
  })
})
