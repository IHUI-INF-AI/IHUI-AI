// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { describe, expect, it } from 'vitest'

import {
  HISTORY_STATUS_FILTERS,
  normalizeHistoryStatusFilter,
} from '../history-helpers'

describe('发布历史状态筛选', () => {
  it('只接受目录里定义的状态，大小写和空白都归一', () => {
    expect(normalizeHistoryStatusFilter(' draft ')).toBe('draft')
    expect(normalizeHistoryStatusFilter('SCHEDULED')).toBe('scheduled')
    expect(normalizeHistoryStatusFilter('FAILED')).toBe('failed')
  })

  it('未知状态/空值回退 all，不打空列表', () => {
    expect(normalizeHistoryStatusFilter('whatever')).toBe('all')
    expect(normalizeHistoryStatusFilter('')).toBe('all')
    expect(normalizeHistoryStatusFilter(null)).toBe('all')
  })

  it('允许集合覆盖 StatusCards 与 TaskCard 的全部状态', () => {
    expect(HISTORY_STATUS_FILTERS).toEqual([
      'all',
      'draft',
      'scheduled',
      'running',
      'success',
      'partial',
      'failed',
      'skipped',
      'cancelled',
    ])
  })
})
