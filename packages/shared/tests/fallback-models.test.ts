// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 兜底模型表的死档守卫。
 *
 * 为什么值得写死:这张表只在 /llm/models 拉取失败时被用户看到,平时不参与主链路,
 * 所以任何死档写回来都不会被日常测试发现,只会在"断网/401 的新用户首帧"上炸。
 * 2026-11-27 的线上事实是 ihui/Auto-Model 指向已弃用的 ihui_relay 上游,新装用户
 * 首帧直接报"provider API key 未配置"。本文件把三条判定钉住:
 *   1. 表里不许出现已死前缀(ihui/、stepfun/);
 *   2. 兜底首档必须是服务端能解析的 `auto` 哨兵,而不是任何厂商 id;
 *   3. 表被误删空时,pickFallbackModelId() 仍返回可发送的 `auto`。
 */
import { describe, it, expect } from 'vitest'
import {
  AUTO_MODEL_ID,
  DEAD_FALLBACK_PREFIXES,
  FALLBACK_MODELS,
  isDeadFallbackModelId,
  pickFallbackModelId,
} from '../src/constants/fallback-models'

describe('兜底表不含死档', () => {
  it('每一档的 value 都不命中已死前缀', () => {
    for (const m of FALLBACK_MODELS) {
      expect(isDeadFallbackModelId(m.value), `${m.value} 命中了死档前缀`).toBe(false)
    }
  })

  it('ihui/Auto-Model 与 stepfun 两档都被判死(含大小写混写)', () => {
    expect(isDeadFallbackModelId('ihui/Auto-Model')).toBe(true)
    expect(isDeadFallbackModelId('IHUI/gpt-5.6')).toBe(true)
    expect(isDeadFallbackModelId('stepfun/step-3.7-flash')).toBe(true)
    expect(isDeadFallbackModelId('auto')).toBe(false)
    expect(isDeadFallbackModelId('')).toBe(false)
    expect(isDeadFallbackModelId(null)).toBe(false)
  })

  it('死档前缀清单只允许这两种,新增必须先过审', () => {
    expect([...DEAD_FALLBACK_PREFIXES]).toEqual(['ihui/', 'stepfun/'])
  })
})

describe('兜底默认档恒可发送', () => {
  it('表非空,首档是 auto 哨兵', () => {
    expect(FALLBACK_MODELS.length).toBeGreaterThan(0)
    expect(FALLBACK_MODELS[0]?.value).toBe(AUTO_MODEL_ID)
    expect(AUTO_MODEL_ID).toBe('auto')
  })

  it('pickFallbackModelId() 恒等于 auto(空表也回落 auto)', () => {
    expect(pickFallbackModelId()).toBe('auto')
  })

  it('value 唯一且非空,标签与厂商齐全', () => {
    const values = FALLBACK_MODELS.map((m) => m.value)
    expect(new Set(values).size).toBe(values.length)
    for (const m of FALLBACK_MODELS) {
      expect(m.value.trim()).not.toBe('')
      expect(m.label.trim()).not.toBe('')
      expect(m.vendor.trim()).not.toBe('')
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
