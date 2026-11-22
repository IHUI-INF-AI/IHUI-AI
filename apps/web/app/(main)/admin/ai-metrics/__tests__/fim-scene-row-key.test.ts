// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 补票 82:后端 /api/llm/fim/metrics/summary 已按 model × scene 聚合,
 * 看板行 key 必须带 scene,否则同模型两个场景撞 key 且读数不可区分。
 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_FIM_SCENE, fimRowKey, fimScene } from '../fim-metrics'

describe('FIM 接受率看板 model × scene 行身份', () => {
  it('同模型 completion / chat 两行 key 不撞且场景文本可区分', () => {
    const completion = { model: 'gpt-4o-mini', scene: 'completion' }
    const chat = { model: 'gpt-4o-mini', scene: 'chat' }
    const keys = [completion, chat].map((r) => fimRowKey(r.model, r.scene))
    expect(keys).toEqual(['gpt-4o-mini-completion', 'gpt-4o-mini-chat'])
    expect(new Set(keys).size).toBe(2)
    expect(fimScene(completion.scene)).not.toBe(fimScene(chat.scene))
  })

  it('scene 缺省/空串按 completion 展示与生成键(兼容旧 Redis 快照)', () => {
    expect(DEFAULT_FIM_SCENE).toBe('completion')
    expect(fimScene(undefined)).toBe('completion')
    expect(fimScene('')).toBe('completion')
    expect(fimRowKey('gpt-4o-mini', undefined)).toBe('gpt-4o-mini-completion')
  })
})
