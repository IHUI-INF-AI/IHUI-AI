// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 管理端直播频道提交体:阶段(UI 语义) → isLive/isPublished,绝不回传 status。
// 阴性对照:把实现改回 `{ ...form }` ⇒ 会带 status:'upcoming' 字符串 ⇒ 下列不变量立即转红。

import { describe, it, expect } from 'vitest'
import { EMPTY, liveStage, liveToForm, toChannelPayload } from '../helpers'
import type { Live } from '../types'

const row = (p: Partial<Live>): Live => ({
  id: 'c1',
  title: 't',
  lecturerName: null,
  startTime: '2026-11-05T10:00:00.000Z',
  status: 1,
  isLive: false,
  isPublished: false,
  coverImage: null,
  ...p,
})

describe('管理端直播频道 status 语义', () => {
  it('阶段 → 语义键:ongoing → isLive=true,isPublished=true', () => {
    const body = toChannelPayload({ ...EMPTY, status: 'ongoing' })
    expect(body).toMatchObject({ isLive: true, isPublished: true })
  })

  it('阶段 → 语义键:ended → isLive=false,isPublished=true', () => {
    const body = toChannelPayload({ ...EMPTY, status: 'ended' })
    expect(body).toMatchObject({ isLive: false, isPublished: true })
  })

  it('阶段 → 语义键:upcoming → isLive=false,isPublished=false', () => {
    const body = toChannelPayload({ ...EMPTY, status: 'upcoming' })
    expect(body).toMatchObject({ isLive: false, isPublished: false })
  })

  it('绝不回传字符串 status;空 startTime 落 null', () => {
    for (const status of ['upcoming', 'ongoing', 'ended'] as const) {
      const body = toChannelPayload({ ...EMPTY, status, startTime: '' })
      expect(JSON.stringify(body)).not.toContain('"status"')
      expect(body.startTime).toBeNull()
    }
  })

  it('列表行只有启用位 status(1),阶段由 isLive/isPublished 派生', () => {
    expect(liveStage(row({ isLive: true, isPublished: true }))).toBe('ongoing')
    expect(liveStage(row({ isLive: false, isPublished: true }))).toBe('ended')
    expect(liveStage(row({ isLive: false, isPublished: false }))).toBe('upcoming')
    expect(liveToForm(row({ isLive: true, isPublished: true })).status).toBe('ongoing')
  })

  it('阴性对照:旧实现 { ...form } 必带字符串 status', () => {
    const naive = { ...EMPTY, status: 'upcoming' }
    expect(JSON.stringify(naive)).toContain('"status":"upcoming"')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
