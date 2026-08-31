// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 模型选择器"默认区 / 历史模型折叠区"分组逻辑单测(2026-08-29 立)
 *
 * 守的是三条产品红线:
 *   1. 只有「latest + 对话类(chat/vision)」进默认列表
 *   2. 非对话专用模型(嵌入/语音/图像…)即使 tier=latest 也必须折叠(聊天场景调不通)
 *   3. **后端字段缺失时不能把模型藏起来** —— 老后端/缓存数据没这两个可选字段时,
 *      一律按"最新对话模型"处理,宁可多显示也不让选择器空掉
 *
 * 后端判定规则的单测在 apps/ai-service/tests/test_model_catalog.py,
 * 前端只测"拿到字段后怎么分",不重复实现判定逻辑。
 */
import { describe, expect, it } from 'vitest'

import { groupByCategory, splitByTier, type ModelOption } from '@/components/chat/model-tier-utils'

function opt(
  value: string,
  category?: ModelOption['category'],
  tier?: ModelOption['tier'],
): ModelOption {
  return { value, label: value, category, tier }
}

describe('splitByTier — 默认区 vs 历史模型折叠区', () => {
  it('latest + 对话类进默认区', () => {
    const { primary, archived } = splitByTier([
      opt('gpt-5.6', 'chat', 'latest'),
      opt('gemini-3.7-flash', 'vision', 'latest'),
    ])
    expect(primary.map((m) => m.value)).toEqual(['gpt-5.6', 'gemini-3.7-flash'])
    expect(archived).toHaveLength(0)
  })

  it('standard / legacy 一律折叠', () => {
    const { primary, archived } = splitByTier([
      opt('glm-5.2', 'chat', 'standard'),
      opt('gpt-4o', 'vision', 'legacy'),
    ])
    expect(primary).toHaveLength(0)
    expect(archived.map((m) => m.value)).toEqual(['glm-5.2', 'gpt-4o'])
  })

  it('非对话专用模型即使 latest 也必须折叠', () => {
    const { primary, archived } = splitByTier([
      opt('bge-m3', 'embedding', 'latest'),
      opt('step-tts-mini', 'tts', 'latest'),
      opt('flux-1-schnell', 'image', 'latest'),
    ])
    expect(primary).toHaveLength(0)
    expect(archived).toHaveLength(3)
  })

  it('字段缺失时按最新对话模型处理(不误藏)', () => {
    const { primary, archived } = splitByTier([
      opt('legacy-backend-model'),
      opt('partial-model', 'chat'),
    ])
    expect(primary.map((m) => m.value)).toEqual(['legacy-backend-model', 'partial-model'])
    expect(archived).toHaveLength(0)
  })

  it('未知枚举值按兜底处理而非崩溃', () => {
    const { primary } = splitByTier([
      opt(
        'weird',
        'not-a-category' as ModelOption['category'],
        'future-tier' as ModelOption['tier'],
      ),
    ])
    // 未知 category 归一化为 chat,未知 tier 归一化为 latest → 进默认区
    expect(primary).toHaveLength(1)
  })
})

describe('groupByCategory — 历史模型区按用途分组', () => {
  it('分组顺序按 MODEL_CATEGORY_META.order(chat 在前,专业用途在后)', () => {
    const groups = groupByCategory([
      opt('bge-m3', 'embedding', 'legacy'),
      opt('old-chat', 'chat', 'standard'),
      opt('flux', 'image', 'legacy'),
      opt('whisper', 'asr', 'legacy'),
    ])
    expect(groups.map(([cat]) => cat)).toEqual(['chat', 'embedding', 'asr', 'image'])
  })

  it('组内 standard 排在 legacy 前面,再按名称排序', () => {
    const groups = groupByCategory([
      opt('zebra', 'chat', 'legacy'),
      opt('apple', 'chat', 'legacy'),
      opt('mango', 'chat', 'standard'),
    ])
    const [, items] = groups[0]
    expect(items.map((m) => m.value)).toEqual(['mango', 'apple', 'zebra'])
  })

  it('空输入返回空分组', () => {
    expect(groupByCategory([])).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
