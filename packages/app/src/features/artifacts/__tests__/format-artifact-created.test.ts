// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { describe, expect, it, vi } from 'vitest'

import { formatArtifactCreated } from '../ArtifactsScreen'

const t = (key: string, opts?: { n?: number }) => `${key}:${opts?.n ?? ''}`

describe('XUI-030 formatArtifactCreated:小时档除数', () => {
  it('2 小时前 ⇒ hoursAgo:2(旧实现按天取整恒为 0)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-08T12:00:00Z'))
    try {
      expect(formatArtifactCreated('2026-11-08T10:00:00Z', t)).toBe('artifacts.hoursAgo:2')
    } finally {
      vi.useRealTimers()
    }
  })

  it('分钟档与天档不受影响(阴性对照)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-08T12:00:00Z'))
    try {
      expect(formatArtifactCreated('2026-11-08T11:30:00Z', t)).toBe('artifacts.minutesAgo:30')
      expect(formatArtifactCreated('2026-11-06T12:00:00Z', t)).toBe('artifacts.daysAgo:2')
    } finally {
      vi.useRealTimers()
    }
  })
})
