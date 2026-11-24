// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Trae 客户端同源模型清单解析单测(2026-11-25 立)。
 *
 * 覆盖点:
 * 1. chat_v3 全量桶优先,不混入 builder 的残影子集
 * 2. name 优先、model_id 兜底;同 id 去重
 * 3. 智能体内部工具名(refactor 前缀 / code-review 前缀)被剔除
 * 4. 坏 JSON / 非对象 / 空清单 ⇒ null(不伪造空清单)
 */
import { describe, it, expect } from 'vitest'
import { extractTraeClientModelsFromMapText } from '../src/services/upstream-adapters/trae-client-models.js'

describe('extractTraeClientModelsFromMapText', () => {
  it('chat_v3 优先:取全量桶,不与 builder 混', () => {
    const text = JSON.stringify({
      builder: [{ name: 'only-in-builder' }],
      chat_v3: [{ name: 'glm-5.3' }, { name: 'kimi-k3' }, { name: 'mimo-v2.6-pro' }],
    })
    expect(extractTraeClientModelsFromMapText(text)).toEqual([
      'glm-5.3',
      'kimi-k3',
      'mimo-v2.6-pro',
    ])
  })

  it('name 优先 / model_id 兜底 / 同 id 去重', () => {
    const text = JSON.stringify({
      chat_v3: [
        { name: 'a', model_id: 'ignored' },
        { model_id: 'b' },
        { name: 'a' },
        { name: '', model_id: 'c' },
      ],
    })
    expect(extractTraeClientModelsFromMapText(text)).toEqual(['a', 'b', 'c'])
  })

  it('剔除智能体内部工具名,保留自定义模型的原样 key', () => {
    const text = JSON.stringify({
      chat_v3: [
        { name: 'refactor_scoper' },
        { name: 'code-review-judge' },
        { name: 'custom_openai_compatible//glm-5.3-flash' },
        { name: 'qwen4-max' },
      ],
    })
    expect(extractTraeClientModelsFromMapText(text)).toEqual([
      'custom_openai_compatible//glm-5.3-flash',
      'qwen4-max',
    ])
  })

  it('坏形状 ⇒ null(不冒充空清单)', () => {
    expect(extractTraeClientModelsFromMapText('not json')).toBeNull()
    expect(extractTraeClientModelsFromMapText('[]')).toBeNull()
    expect(extractTraeClientModelsFromMapText('{}')).toBeNull()
    expect(extractTraeClientModelsFromMapText(JSON.stringify({ chat_v3: [] }))).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
