// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 模型选择器"默认区 / 历史模型折叠区"分组逻辑单测(2026-08-29 立)
 *
 * 守的是三条产品红线:
 *   1. 「latest/standard」进默认列表(2026-10-21 起:standard 是仍可调用的正式代次)
 *   2. 图像/视频/语音/OCR 等模态模型照常可选(2026-11-20 机主追加);
 *      只有 embedding / rerank / guard 这类中间件不进聊天选择器
 *   3. **后端字段缺失时不能把模型藏起来** —— 老后端/缓存数据没这两个可选字段时,
 *      一律按"最新对话模型"处理,宁可多显示也不让选择器空掉
 *
 * 后端判定规则的单测在 apps/ai-service/tests/test_model_catalog.py,
 * 前端只测"拿到字段后怎么分",不重复实现判定逻辑。
 */
import { describe, expect, it, vi } from 'vitest'
import * as React from 'react'

import {
  buildCapabilitySegments,
  filterByCapabilities,
  formatContextTokens,
  formatModelDisplayLabel,
  groupByCategory,
  sortByCategoryOrder,
  splitByTier,
  type ModelOption,
} from '@/components/chat/model-tier-utils'
import type { SelectorModel } from '@/lib/models-api'

// ModelCapsSummary 依赖 next-intl;这里用固定中文标签,避免为一条展示行拉起 i18n 运行时
const { capLabels } = vi.hoisted(() => ({
  capLabels: {
    capStream: '流式',
    capTools: '工具',
    capContext: '长上下文',
    capUnknownHint: '尚未实测',
    capFailHint: '实测未通过',
  } as Record<string, string>,
}))
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => capLabels[key] ?? key,
}))

function opt(
  value: string,
  category?: ModelOption['category'],
  tier?: ModelOption['tier'],
  capabilities?: ModelOption['capabilities'],
): ModelOption {
  return { value, label: value, category, tier, capabilities }
}

describe('splitByTier — 选择器只留可选模型(2026-11-20 取消历史区/放开模态模型)', () => {
  it('latest + 对话类进默认区', () => {
    const { primary, archived } = splitByTier([
      opt('gpt-5.6', 'chat', 'latest'),
      opt('gemini-3.7-flash', 'vision', 'latest'),
    ])
    expect(primary.map((m) => m.value)).toEqual(['gpt-5.6', 'gemini-3.7-flash'])
    expect(archived).toHaveLength(0)
  })

  it('standard 对话类保留,legacy 直接消失(不再折叠进历史区)', () => {
    const { primary, archived } = splitByTier([
      opt('glm-5.2', 'chat', 'standard'),
      opt('gpt-4o', 'vision', 'legacy'),
      opt('bge-m3', 'embedding', 'standard'),
    ])
    expect(primary.map((m) => m.value)).toEqual(['glm-5.2'])
    // legacy 与检索类中间件都不再出现在任何分区
    expect(archived).toHaveLength(0)
  })

  it('图像/视频/语音/OCR 等模态模型照常展示(2026-11-20 机主追加)', () => {
    const { primary, archived } = splitByTier([
      opt('flux-1-schnell', 'image', 'latest'),
      opt('veo-3', 'video', 'latest'),
      opt('step-tts-mini', 'tts', 'latest'),
      opt('whisper-large-v3', 'asr', 'latest'),
      opt('paddle-ocr-v4', 'ocr', 'latest'),
    ])
    expect(primary.map((m) => m.value)).toEqual([
      'flux-1-schnell',
      'veo-3',
      'step-tts-mini',
      'whisper-large-v3',
      'paddle-ocr-v4',
    ])
    expect(archived).toHaveLength(0)
  })

  it('检索/审核类中间件不展示(选了也产不出可读回复)', () => {
    const { primary, archived } = splitByTier([
      opt('bge-m3', 'embedding', 'latest'),
      opt('bge-reranker-v2', 'rerank', 'latest'),
      opt('shield-guard', 'guard', 'latest'),
    ])
    expect(primary).toHaveLength(0)
    expect(archived).toHaveLength(0)
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
    const { primary, archived } = splitByTier([
      opt(
        'weird',
        'not-a-category' as ModelOption['category'],
        'future-tier' as ModelOption['tier'],
      ),
    ])
    // 未知 category 归一化为 chat,未知 tier 归一化为 latest → 保留
    expect(primary).toHaveLength(1)
    expect(archived).toHaveLength(0)
  })

  it('后端判为 minor-behind(上一代)的模型不进默认列表', () => {
    const { primary } = splitByTier([
      {
        ...opt('agnes-image-2.1-flash', 'image', 'standard'),
        classifyReason: 'minor-behind (agnes-image 2.1 < 2.5)',
      },
      {
        ...opt('agnes-image-2.5-flash', 'image', 'standard'),
        classifyReason: 'unclassified-default (provider=agnes)',
      },
    ])
    // 上一代被摘掉,当前代 standard 保留 —— 不一刀切藏掉能调通的模型
    expect(primary.map((m) => m.value)).toEqual(['agnes-image-2.5-flash'])
  })

  it('classifyReason 缺失或非 minor-behind 时一律保留(不误藏)', () => {
    const { primary } = splitByTier([
      { ...opt('no-reason', 'chat', 'standard') },
      { ...opt('variant', 'chat', 'standard'), classifyReason: 'pricing-or-snapshot-variant' },
      { ...opt('older', 'chat', 'legacy'), classifyReason: 'older-generation (x 3 < 4)' },
    ])
    expect(primary.map((m) => m.value)).toEqual(['no-reason', 'variant'])
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

describe('sortByCategoryOrder — 平台组内按用途排序(2026-11-21 用户定档)', () => {
  it('组间按 MODEL_CATEGORY_META.order:对话 → 视觉 → 语音 → 图像 → 视频 → OCR', () => {
    const sorted = sortByCategoryOrder([
      opt('flux-image', 'image', 'latest'),
      opt('veo-video', 'video', 'latest'),
      opt('whisper', 'asr', 'latest'),
      opt('chat-b', 'chat', 'latest'),
      opt('vision-a', 'vision', 'latest'),
      opt('tts-a', 'tts', 'latest'),
      opt('paddle-ocr', 'ocr', 'latest'),
    ])
    expect(sorted.map((m) => m.value)).toEqual([
      'chat-b',
      'vision-a',
      'tts-a',
      'whisper',
      'flux-image',
      'veo-video',
      'paddle-ocr',
    ])
  })

  it('同用途内:代次 latest 在前,再按名称升序', () => {
    const sorted = sortByCategoryOrder([
      opt('zebra-legacy', 'chat', 'legacy'),
      opt('apple-latest', 'chat', 'latest'),
      opt('mango-standard', 'chat', 'standard'),
      opt('banana-latest', 'chat', 'latest'),
    ])
    expect(sorted.map((m) => m.value)).toEqual([
      'apple-latest',
      'banana-latest',
      'mango-standard',
      'zebra-legacy',
    ])
  })

  it('category 缺失按对话处理,未知枚举同样回落对话而不是排到末尾', () => {
    const sorted = sortByCategoryOrder([
      opt('flux', 'image', 'latest'),
      opt('no-category'),
      opt('weird', 'nope' as ModelOption['category'], 'latest'),
    ])
    expect(sorted.map((m) => m.value)).toEqual(['no-category', 'weird', 'flux'])
  })

  it('不改传入数组(调用方 useMemo 里的原件不能被就地重排)', () => {
    const input = [opt('flux', 'image', 'latest'), opt('chat', 'chat', 'latest')]
    const before = input.map((m) => m.value)
    sortByCategoryOrder(input)
    expect(input.map((m) => m.value)).toEqual(before)
  })

  it('名称比较忽略大小写(2026-11-21 用户报「大小写没区分好」)', () => {
    const sorted = sortByCategoryOrder([
      { ...opt('b', 'chat', 'latest'), label: 'zeta' },
      { ...opt('a', 'chat', 'latest'), label: 'Alpha' },
      { ...opt('c', 'chat', 'latest'), label: 'beta' },
    ])
    // 忽略大小写后 alpha < beta < zeta;不能因为大写/小写把顺序打乱
    expect(sorted.map((m) => m.label)).toEqual(['Alpha', 'beta', 'zeta'])
  })

  it('数字按数值序(V4.1 在 V4.10 之前),不按字典序', () => {
    const sorted = sortByCategoryOrder([
      { ...opt('a', 'chat', 'latest'), label: 'GLM V4.10' },
      { ...opt('b', 'chat', 'latest'), label: 'GLM V4.1' },
    ])
    expect(sorted.map((m) => m.label)).toEqual(['GLM V4.1', 'GLM V4.10'])
  })
})

describe('formatModelDisplayLabel — 统一模型名大小写形态(2026-11-21 立)', () => {
  it('裸代码形名称整理成人类可读词形,品牌缩写保持大写', () => {
    expect(formatModelDisplayLabel('deepseek-v4.1-flash', 'deepseek-v4.1-flash')).toBe(
      'DeepSeek V4.1 Flash',
    )
    expect(formatModelDisplayLabel('gpt-5.4-mini', 'gpt-5.4-mini')).toBe('GPT 5.4 Mini')
    expect(formatModelDisplayLabel('glm-5.3', 'glm-5.3')).toBe('GLM 5.3')
  })

  it('已有人工展示名(带大写或中文)一律原样保留,不改品牌写法', () => {
    expect(formatModelDisplayLabel('DeepSeek-V4.1-Flash', 'x')).toBe('DeepSeek-V4.1-Flash')
    expect(formatModelDisplayLabel('Agnes 图像 2.5 Flash (文生图,默认档)', 'x')).toBe(
      'Agnes 图像 2.5 Flash (文生图,默认档)',
    )
    expect(formatModelDisplayLabel('GPT-6.2 Astra Pro', 'x')).toBe('GPT-6.2 Astra Pro')
  })

  it('name 缺失时退回整理 id;都为空时返回空串而不是崩', () => {
    expect(formatModelDisplayLabel(undefined, 'qwen3.8-max')).toBe('Qwen3.8 Max')
    // 带上游命名空间的 id 只留最后一段,不能把 zai-org 当模型名一起拼进去
    expect(formatModelDisplayLabel(undefined, '@cf/zai-org/glm-4.7-flash')).toBe('GLM 4.7 Flash')
    expect(formatModelDisplayLabel('', '')).toBe('')
  })
})

describe('filterByCapabilities — 历史区能力过滤(2026-09-19 D23 立)', () => {
  it('required 空集 = 不过滤,原样返回', () => {
    const list = [opt('a', 'chat', 'legacy'), opt('b', 'embedding', 'legacy')]
    expect(filterByCapabilities(list, [])).toBe(list)
  })

  it('capabilities 缺失(老后端/降级数据)= 未知,激活过滤也不误藏', () => {
    const list = [opt('old-backend', 'chat', 'legacy')]
    expect(filterByCapabilities(list, ['vision'])).toHaveLength(1)
  })

  it('单键过滤:仅 capabilities[key] === true 保留,键缺失按 false', () => {
    const list = [
      opt('vision-model', 'vision', 'legacy', { vision: true }),
      opt('text-model', 'chat', 'legacy', { vision: false }),
      opt('half-model', 'chat', 'legacy', {}),
    ]
    expect(filterByCapabilities(list, ['vision']).map((m) => m.value)).toEqual(['vision-model'])
  })

  it('多键 AND:全部激活能力满足才保留', () => {
    const list = [
      opt('both', 'chat', 'legacy', { vision: true, fim: true }),
      opt('only-vision', 'chat', 'legacy', { vision: true, fim: false }),
    ]
    expect(filterByCapabilities(list, ['vision', 'fim']).map((m) => m.value)).toEqual(['both'])
  })

  it('非布尔值按 false 处理而非崩溃', () => {
    const list = [opt('weird', 'chat', 'legacy', { vision: 'yes' as unknown as true })]
    expect(filterByCapabilities(list, ['vision'])).toHaveLength(0)
  })
})

describe('实测能力 caps_verified(2026-11-11 立)', () => {
  const labels = { stream: '流式', tools: '工具', context: '长上下文' }

  function apiModel(over: Partial<SelectorModel>): SelectorModel {
    return { id: 'demo/model', name: 'Demo', ...over } as SelectorModel
  }

  it('buildOptionsFromApi 原样透传 caps_verified,缺失为 undefined', async () => {
    const { buildOptionsFromApi } = await import('@/components/chat/model-selector')
    const caps = { stream: true, tools: false, context: { ok: true, tokens: 16000 } }
    const options = buildOptionsFromApi([
      apiModel({ id: 'with-caps', caps_verified: caps }),
      apiModel({ id: 'no-caps' }),
    ])
    expect(options[0]?.capsVerified).toEqual(caps)
    expect(options[1]?.capsVerified).toBeUndefined()
  }, 60_000)

  it('tokens 以 1000 取整换算(16000 → 16K)', () => {
    expect(formatContextTokens(16000)).toBe('16K')
    expect(formatContextTokens(32000)).toBe('32K')
    expect(formatContextTokens(32400)).toBe('32K')
  })

  it('capsVerified 完全缺失时三段都是问号', () => {
    const segments = buildCapabilitySegments({}, labels)
    expect(segments.map((s) => s.text)).toEqual(['流式?', '工具?', '长上下文?'])
    expect(segments.map((s) => s.state)).toEqual(['unknown', 'unknown', 'unknown'])
  })

  it('通过/失败/未知逐段判定,长上下文通过时带测试规模', () => {
    const segments = buildCapabilitySegments(
      { capsVerified: { stream: true, tools: false, context: { ok: true, tokens: 16000 } } },
      labels,
    )
    expect(segments.map((s) => s.text)).toEqual(['流式✓', '工具✗', '长上下文16K'])
    expect(segments.map((s) => s.state)).toEqual(['ok', 'fail', 'ok'])
  })

  it('未验证模型(verified=false)仍渲染完整能力行', async () => {
    const { ModelCapsSummary } = await import('@/components/chat/model-selector')
    const { render } = await import('@testing-library/react')
    const { container } = render(
      React.createElement(ModelCapsSummary, {
        opt: {
          value: 'unverified',
          label: 'unverified',
          verified: false,
          capsVerified: { stream: true, tools: null, context: { ok: false, tokens: 16000 } },
        } satisfies ModelOption,
      }),
    )
    expect(container.textContent).toContain('流式✓')
    expect(container.textContent).toContain('工具?')
    expect(container.textContent).toContain('长上下文✗')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
