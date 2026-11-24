// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池模型积分倍率回归锁(2026-11-23)。
 *
 * 线上现象:新用户/管理员的选择器里,83 个号池模型全部显示「免费」。
 * 根因:withPoolModels 写死 `pointsMultiplier: m.pointsMultiplier ?? 0`,
 * 而上游补缺行与旧服务端都不下发该字段 ⇒ 一律 0 ⇒ 免费。
 * 本测钉住:缺省时按模型 id 推断,只有真正 zero_cost 的模型才允许 0。
 */

import { describe, expect, it } from 'vitest'

import { resolvePoolPointsMeta } from '../model-selector'

describe('resolvePoolPointsMeta(号池倍率展示)', () => {
  it('旧服务端缺省倍率时按 id 推断,展示值与扣分同数', () => {
    // 经济档 tier=1 → 1x
    expect(resolvePoolPointsMeta({ id: 'glm-5.3', provider: 'workbuddy' }).pointsMultiplier).toBe(1)
    // 标准档 tier=3 → 3x
    expect(
      resolvePoolPointsMeta({ id: 'deepseek-v4-pro', provider: 'workbuddy' }).pointsMultiplier,
    ).toBe(3)
    // 轻量思考档落经济档 tier=1 → 1x(共享规则 economy 显式列举 hunyuan-2.0-thinking)
    expect(
      resolvePoolPointsMeta({ id: 'hunyuan-2.0-thinking', provider: 'workbuddy' }).pointsMultiplier,
    ).toBe(1)
  })

  it('web 兜底与共享规则源口径一致(2026-11-23 收敛)', () => {
    // gpt-5.4 属高级档 10x,不再被 gpt-5 子串抬到 30x
    expect(resolvePoolPointsMeta({ id: 'gpt-5.4', provider: 'workbuddy' }).pointsMultiplier).toBe(
      10,
    )
    // 低成本 thinking 模型落标准档 3x,不再按 thinking 判旗舰
    expect(
      resolvePoolPointsMeta({ id: 'thinkingmachines/inkling', provider: 'workbuddy' })
        .pointsMultiplier,
    ).toBe(3)
    // opencode_zen 是上游 zero_cost,免费判定排在付费关键词之前 → 0x
    expect(
      resolvePoolPointsMeta({ id: 'opencode_zen/gpt-5', provider: 'opencode_zen' })
        .pointsMultiplier,
    ).toBe(0)
    // ihui 显式映射走共享 ihuiModelMap → 30x
    expect(
      resolvePoolPointsMeta({ id: 'ihui/glm-5.3', provider: 'ihui_relay' }).pointsMultiplier,
    ).toBe(30)
  })

  it('后端下发 DB 值时优先,不再映射成展示小数', () => {
    expect(
      resolvePoolPointsMeta({
        id: 'glm-5.3',
        provider: 'workbuddy',
        pointsMultiplier: 30,
      }).pointsMultiplier,
    ).toBe(30)
  })

  it('裸名 auto 不会被 openrouter/auto 的子串规则误判为免费', () => {
    const meta = resolvePoolPointsMeta({ id: 'auto', provider: 'workbuddy' })
    expect(meta.pointsMultiplier).toBe(1)
  })

  it('真正 zero_cost 的模型仍显示免费', () => {
    expect(
      resolvePoolPointsMeta({ id: 'ollama/llama3', provider: 'ollama' }).pointsMultiplier,
    ).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
