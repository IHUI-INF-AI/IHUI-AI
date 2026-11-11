// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * relay-pool-model-health 单测(2026-11-11):号池模型级健康状态机。
 * 纯内存模块,零 mock:覆盖 2 连击才 down、成功清除、TTL 过期 fail-open、归一函数。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  isModelDown,
  normalizePoolUpstreamModelId,
  recordModelNotFound,
  recordModelSuccess,
  resetPoolModelHealthForTest,
} from '../src/services/relay-pool-model-health.js'

beforeEach(() => {
  resetPoolModelHealthForTest()
})

describe('normalizePoolUpstreamModelId(交集与状态键共用的归一判据)', () => {
  it('剥本平台前缀 + 小写 + trim', () => {
    expect(normalizePoolUpstreamModelId('trae', 'trae/GLM-4')).toBe('glm-4')
    expect(normalizePoolUpstreamModelId('trae', '  Doubao-Seed-2.1-Turbo  ')).toBe(
      'doubao-seed-2.1-turbo',
    )
  })

  it('裸名原样归一;他平台前缀不是前缀,保留', () => {
    expect(normalizePoolUpstreamModelId('trae', 'glm-4')).toBe('glm-4')
    expect(normalizePoolUpstreamModelId('trae', 'qoder/kmodel')).toBe('qoder/kmodel')
  })

  it('按 `/` 边界判定,不做字符串截断', () => {
    expect(normalizePoolUpstreamModelId('trae', 'traeX/Foo')).toBe('traex/foo')
  })
})

describe('recordModelNotFound / isModelDown 状态机', () => {
  it('单次 404 不 down,连续 2 次才 down(防抖动误杀)', () => {
    recordModelNotFound('trae', 'glm-4')
    expect(isModelDown('trae', 'glm-4')).toBe(false)
    recordModelNotFound('trae', 'glm-4')
    expect(isModelDown('trae', 'glm-4')).toBe(true)
  })

  it('前缀形态与裸名同键:两种上报混打也计入连击', () => {
    recordModelNotFound('trae', 'trae/GLM-4')
    recordModelNotFound('trae', 'glm-4')
    expect(isModelDown('trae', 'trae/glm-4')).toBe(true)
  })

  it('调用成功清除结论,且连击计数一并作废', () => {
    recordModelNotFound('trae', 'glm-4')
    recordModelNotFound('trae', 'glm-4')
    expect(isModelDown('trae', 'glm-4')).toBe(true)
    recordModelSuccess('trae', 'trae/GLM-4')
    expect(isModelDown('trae', 'glm-4')).toBe(false)
    // 计数已清零:再来一次 404 不该直接 down
    recordModelNotFound('trae', 'glm-4')
    expect(isModelDown('trae', 'glm-4')).toBe(false)
  })

  it('键含平台:同名模型跨平台互不干扰', () => {
    recordModelNotFound('trae', 'glm-4')
    recordModelNotFound('trae', 'glm-4')
    expect(isModelDown('workbuddy', 'glm-4')).toBe(false)
  })

  it('down 结论 TTL 过期视为无结论(fail-open)', () => {
    vi.useFakeTimers()
    try {
      recordModelNotFound('trae', 'glm-4')
      recordModelNotFound('trae', 'glm-4')
      expect(isModelDown('trae', 'glm-4')).toBe(true)
      // TTL = 10min 清单缓存 x 2 轮 = 20min:差 1ms 仍 down,到点即失效
      vi.advanceTimersByTime(20 * 60 * 1000 - 1)
      expect(isModelDown('trae', 'glm-4')).toBe(true)
      vi.advanceTimersByTime(1)
      expect(isModelDown('trae', 'glm-4')).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})

afterEach(() => {
  vi.useRealTimers()
})
