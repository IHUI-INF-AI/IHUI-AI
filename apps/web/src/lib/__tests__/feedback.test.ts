import { describe, it, expect } from 'vitest'
import { TYPE_ICON, TYPE_BADGE, STATUS_BADGE, PRIORITY_BADGE, api } from '../feedback'
import { Bug, Lightbulb, Wrench, HelpCircle } from 'lucide-react'

describe('feedback constants', () => {
  it('TYPE_ICON 映射正确', () => {
    expect(TYPE_ICON.bug).toBe(Bug)
    expect(TYPE_ICON.feature).toBe(Lightbulb)
    expect(TYPE_ICON.improvement).toBe(Wrench)
    expect(TYPE_ICON.other).toBe(HelpCircle)
  })

  it('TYPE_BADGE 4 个类型齐全', () => {
    expect(Object.keys(TYPE_BADGE).sort()).toEqual(['bug', 'feature', 'improvement', 'other'])
  })

  it('STATUS_BADGE 4 个状态齐全', () => {
    expect(Object.keys(STATUS_BADGE).sort()).toEqual(['closed', 'pending', 'resolved', 'reviewing'])
  })

  it('PRIORITY_BADGE 3 个优先级齐全', () => {
    expect(Object.keys(PRIORITY_BADGE).sort()).toEqual(['high', 'low', 'medium'])
  })

  it('所有 badge 字符串非空', () => {
    for (const v of Object.values(TYPE_BADGE)) expect(v.length).toBeGreaterThan(0)
    for (const v of Object.values(STATUS_BADGE)) expect(v.length).toBeGreaterThan(0)
    for (const v of Object.values(PRIORITY_BADGE)) expect(v.length).toBeGreaterThan(0)
  })
})

describe('api helper', () => {
  it('成功时返回 data', async () => {
    const originalFetch = global.fetch
    global.fetch = (() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ code: 0, message: 'ok', data: { v: 1 } }),
      } as unknown as Response)) as unknown as typeof fetch
    try {
      const data = await api('/test')
      expect(data).toEqual({ v: 1 })
    } finally {
      global.fetch = originalFetch
    }
  })

  it('失败时抛错', async () => {
    const originalFetch = global.fetch
    global.fetch = (() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ code: 1, message: '失败', data: null }),
      } as unknown as Response)) as unknown as typeof fetch
    try {
      await expect(api('/test')).rejects.toThrow('失败')
    } finally {
      global.fetch = originalFetch
    }
  })
})
