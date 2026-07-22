/**
 * hermes parser 综合测试 — 全参数深度覆盖
 *
 * 覆盖维度:
 *   1. 基本 YAML 解析(空输入/非 YAML/缺字段)
 *   2. custom_providers 数组(空/非数组/正常)
 *   3. default_provider + is_active 双重决定 isCurrent
 *   4. snake_case + camelCase 双字段名
 *   5. apiFormat 规范化(anthropic/responses/gemini/openai_chat/缺失/大小写)
 *   6. 字段提取(baseUrl/apiKey/model)
 *   7. meta 字段(category/websiteUrl/icon/iconColor/models)
 *   8. sourceId fallback (p.id → hermes::idx)
 *   9. name fallback (p.name → sourceId)
 *  10. providerCode 推断
 *  11. 单 provider 失败不影响其他
 *  12. sourceAppType 固定 hermes
 */
import { describe, it, expect } from 'vitest'

import type { ParserInput } from '../../src/services/cli-import/parsers/types.js'
import { parseHermes } from '../../src/services/cli-import/parsers/hermes.js'

function makeText(text: string): ParserInput {
  return { text, sourcePath: 'test' }
}

describe('hermes parser — 基本 YAML 解析', () => {
  it('空输入抛异常', () => {
    expect(() => parseHermes(makeText(''))).toThrow()
  })

  it('纯空白输入抛异常', () => {
    expect(() => parseHermes(makeText('  \n  '))).toThrow()
  })

  it('非 YAML 输入抛异常', () => {
    // YAML 解析器对部分非 YAML 内容会容错,这里用一个明显不合法的 YAML
    expect(() => parseHermes(makeText(':\n  : invalid: yaml: structure:'))).toThrow()
  })

  it('空对象(custom_providers 缺失) → warning', () => {
    const res = parseHermes(makeText('default_provider: openai\n'))
    expect(res.providers).toHaveLength(0)
    expect(res.globalWarnings.some((w) => w.includes('custom_providers'))).toBe(true)
  })

  it('custom_providers 为空数组 → warning', () => {
    const res = parseHermes(makeText('custom_providers: []\n'))
    expect(res.providers).toHaveLength(0)
    expect(res.globalWarnings.some((w) => w.includes('custom_providers'))).toBe(true)
  })

  it('custom_providers 为非数组(string) → warning', () => {
    const res = parseHermes(makeText('custom_providers: "not-array"\n'))
    expect(res.providers).toHaveLength(0)
    expect(res.globalWarnings.some((w) => w.includes('custom_providers'))).toBe(true)
  })

  it('YAML 解析为 null → warning(解析为空)', () => {
    const res = parseHermes(makeText('~\n')) // ~ 是 YAML 的 null
    expect(res.providers).toHaveLength(0)
    expect(res.globalWarnings.some((w) => w.includes('解析为空'))).toBe(true)
  })
})

describe('hermes parser — custom_providers 多 provider 提取', () => {
  it('单个 provider 解析', () => {
    const yaml = `
custom_providers:
  - name: OpenAI
    api_base_url: https://api.openai.com/v1
    api_key: sk-xxx
    model: gpt-5
    api_format: openai_chat
`
    const res = parseHermes(makeText(yaml))
    expect(res.providers).toHaveLength(1)
    expect(res.providers[0].name).toBe('OpenAI')
    expect(res.providers[0].baseUrl).toBe('https://api.openai.com/v1')
    expect(res.providers[0].apiKey).toBe('sk-xxx')
    expect(res.providers[0].modelIdForTest).toBe('gpt-5')
  })

  it('多个 provider 同时解析', () => {
    const yaml = `
custom_providers:
  - name: OpenAI
    api_base_url: https://api.openai.com/v1
    api_key: k1
  - name: Anthropic
    api_base_url: https://api.anthropic.com
    api_key: k2
  - name: DeepSeek
    api_base_url: https://api.deepseek.com
    api_key: k3
`
    const res = parseHermes(makeText(yaml))
    expect(res.providers).toHaveLength(3)
    const names = res.providers.map((p) => p.name).sort()
    expect(names).toEqual(['Anthropic', 'DeepSeek', 'OpenAI'])
  })
})

describe('hermes parser — default_provider + is_active 双重决定 isCurrent', () => {
  it('is_active=true → isCurrent=true', () => {
    const yaml = `
custom_providers:
  - name: OpenAI
    api_base_url: https://api.openai.com
    is_active: true
`
    const res = parseHermes(makeText(yaml))
    expect(res.providers[0].isCurrent).toBe(true)
  })

  it('is_active=false → isCurrent=false', () => {
    const yaml = `
custom_providers:
  - name: OpenAI
    api_base_url: https://api.openai.com
    is_active: false
`
    const res = parseHermes(makeText(yaml))
    expect(res.providers[0].isCurrent).toBe(false)
  })

  it('is_active 缺失 + default_provider 匹配 name → isCurrent=true', () => {
    const yaml = `
default_provider: OpenAI
custom_providers:
  - name: OpenAI
    api_base_url: https://api.openai.com
  - name: Anthropic
    api_base_url: https://api.anthropic.com
`
    const res = parseHermes(makeText(yaml))
    expect(res.providers.find((p) => p.name === 'OpenAI')?.isCurrent).toBe(true)
    expect(res.providers.find((p) => p.name === 'Anthropic')?.isCurrent).toBe(false)
  })

  it('is_active 缺失 + default_provider 匹配 sourceId → isCurrent=true', () => {
    const yaml = `
default_provider: my-id
custom_providers:
  - id: my-id
    name: OpenAI
    api_base_url: https://api.openai.com
`
    const res = parseHermes(makeText(yaml))
    expect(res.providers[0].isCurrent).toBe(true)
  })

  it('is_active=true 优先于 default_provider 不匹配', () => {
    const yaml = `
default_provider: Anthropic
custom_providers:
  - name: OpenAI
    api_base_url: https://api.openai.com
    is_active: true
`
    const res = parseHermes(makeText(yaml))
    expect(res.providers[0].isCurrent).toBe(true)
  })

  it('is_active 缺失 + default_provider 缺失 → isCurrent=false', () => {
    const yaml = `
custom_providers:
  - name: OpenAI
    api_base_url: https://api.openai.com
`
    const res = parseHermes(makeText(yaml))
    expect(res.providers[0].isCurrent).toBe(false)
  })

  it('is_active 缺失 + default_provider 不匹配任何 → 全 false', () => {
    const yaml = `
default_provider: nonexistent
custom_providers:
  - name: OpenAI
    api_base_url: https://api.openai.com
`
    const res = parseHermes(makeText(yaml))
    expect(res.providers[0].isCurrent).toBe(false)
  })
})

describe('hermes parser — snake_case + camelCase 双字段名', () => {
  it('camelCase 字段名(apiBaseUrl/apiKey/apiFormat/isActive) 也能解析', () => {
    const yaml = `
custom_providers:
  - name: OpenAI
    apiBaseUrl: https://api.openai.com
    apiKey: sk-xxx
    apiFormat: openai_chat
    isActive: true
`
    const res = parseHermes(makeText(yaml))
    expect(res.providers[0].baseUrl).toBe('https://api.openai.com')
    expect(res.providers[0].apiKey).toBe('sk-xxx')
    expect(res.providers[0].apiFormat).toBe('openai_chat')
    expect(res.providers[0].isCurrent).toBe(true)
  })

  it('defaultProvider camelCase 也能识别', () => {
    const yaml = `
defaultProvider: OpenAI
custom_providers:
  - name: OpenAI
    api_base_url: https://api.openai.com
`
    const res = parseHermes(makeText(yaml))
    expect(res.providers[0].isCurrent).toBe(true)
  })

  it('customProviders camelCase 也能识别', () => {
    const yaml = `
customProviders:
  - name: OpenAI
    api_base_url: https://api.openai.com
`
    const res = parseHermes(makeText(yaml))
    expect(res.providers).toHaveLength(1)
  })

  it('meta 字段 camelCase(websiteUrl/iconColor) 也能解析', () => {
    const yaml = `
custom_providers:
  - name: OpenAI
    api_base_url: https://api.openai.com
    websiteUrl: https://openai.com
    iconColor: '#FF0000'
`
    const res = parseHermes(makeText(yaml))
    expect(res.providers[0].meta.websiteUrl).toBe('https://openai.com')
    expect(res.providers[0].meta.iconColor).toBe('#FF0000')
  })
})

describe('hermes parser — apiFormat 规范化', () => {
  it('api_format=openai_chat → openai_chat', () => {
    const yaml = `
custom_providers:
  - name: P1
    api_base_url: https://api.openai.com
    api_format: openai_chat
`
    const res = parseHermes(makeText(yaml))
    expect(res.providers[0].apiFormat).toBe('openai_chat')
  })

  it('api_format=anthropic → anthropic_messages', () => {
    const yaml = `
custom_providers:
  - name: P1
    api_base_url: https://api.anthropic.com
    api_format: anthropic
`
    const res = parseHermes(makeText(yaml))
    expect(res.providers[0].apiFormat).toBe('anthropic_messages')
  })

  it('api_format=anthropic_messages → anthropic_messages', () => {
    const yaml = `
custom_providers:
  - name: P1
    api_base_url: https://api.anthropic.com
    api_format: anthropic_messages
`
    const res = parseHermes(makeText(yaml))
    expect(res.providers[0].apiFormat).toBe('anthropic_messages')
  })

  it('api_format=responses → openai_responses', () => {
    const yaml = `
custom_providers:
  - name: P1
    api_base_url: https://api.openai.com
    api_format: responses
`
    const res = parseHermes(makeText(yaml))
    expect(res.providers[0].apiFormat).toBe('openai_responses')
  })

  it('api_format=openai_responses → openai_responses', () => {
    const yaml = `
custom_providers:
  - name: P1
    api_base_url: https://api.openai.com
    api_format: openai_responses
`
    const res = parseHermes(makeText(yaml))
    expect(res.providers[0].apiFormat).toBe('openai_responses')
  })

  it('api_format=gemini → gemini_native', () => {
    const yaml = `
custom_providers:
  - name: P1
    api_base_url: https://generativelanguage.googleapis.com
    api_format: gemini
`
    const res = parseHermes(makeText(yaml))
    expect(res.providers[0].apiFormat).toBe('gemini_native')
  })

  it('api_format=gemini_native → gemini_native', () => {
    const yaml = `
custom_providers:
  - name: P1
    api_base_url: https://generativelanguage.googleapis.com
    api_format: gemini_native
`
    const res = parseHermes(makeText(yaml))
    expect(res.providers[0].apiFormat).toBe('gemini_native')
  })

  it('api_format 大小写不敏感(Anthropic) → anthropic_messages', () => {
    const yaml = `
custom_providers:
  - name: P1
    api_base_url: https://api.anthropic.com
    api_format: Anthropic
`
    const res = parseHermes(makeText(yaml))
    expect(res.providers[0].apiFormat).toBe('anthropic_messages')
  })

  it('api_format 缺失 → 默认 openai_chat', () => {
    const yaml = `
custom_providers:
  - name: P1
    api_base_url: https://api.openai.com
`
    const res = parseHermes(makeText(yaml))
    expect(res.providers[0].apiFormat).toBe('openai_chat')
  })

  it('api_format 未知值 → 默认 openai_chat', () => {
    const yaml = `
custom_providers:
  - name: P1
    api_base_url: https://api.openai.com
    api_format: unknown_format
`
    const res = parseHermes(makeText(yaml))
    expect(res.providers[0].apiFormat).toBe('openai_chat')
  })
})

describe('hermes parser — 字段提取(baseUrl/apiKey/model)', () => {
  it('api_base_url 缺失 → baseUrl 空字符串 + normalizeProvider 加警告', () => {
    const yaml = `
custom_providers:
  - name: P1
    api_key: sk-xxx
`
    const res = parseHermes(makeText(yaml))
    expect(res.providers[0].baseUrl).toBe('')
    expect(res.providers[0].warnings.some((w) => w.includes('baseUrl'))).toBe(true)
  })

  it('api_key 缺失 → apiKey undefined + normalizeProvider 加警告', () => {
    const yaml = `
custom_providers:
  - name: P1
    api_base_url: https://api.openai.com
`
    const res = parseHermes(makeText(yaml))
    expect(res.providers[0].apiKey).toBeUndefined()
    expect(res.providers[0].warnings.some((w) => w.includes('apiKey'))).toBe(true)
  })

  it('model 缺失 → modelIdForTest undefined + meta.models undefined', () => {
    const yaml = `
custom_providers:
  - name: P1
    api_base_url: https://api.openai.com
`
    const res = parseHermes(makeText(yaml))
    expect(res.providers[0].modelIdForTest).toBeUndefined()
    expect(res.providers[0].meta.models).toBeUndefined()
  })

  it('model 存在 → modelIdForTest + meta.models 同步', () => {
    const yaml = `
custom_providers:
  - name: P1
    api_base_url: https://api.openai.com
    model: gpt-5
`
    const res = parseHermes(makeText(yaml))
    expect(res.providers[0].modelIdForTest).toBe('gpt-5')
    expect(res.providers[0].meta.models).toEqual(['gpt-5'])
  })
})

describe('hermes parser — meta 字段验证', () => {
  it('meta.category 透传', () => {
    const yaml = `
custom_providers:
  - name: P1
    api_base_url: https://api.openai.com
    category: Official
`
    const res = parseHermes(makeText(yaml))
    expect(res.providers[0].meta.category).toBe('Official')
  })

  it('meta.websiteUrl 透传', () => {
    const yaml = `
custom_providers:
  - name: P1
    api_base_url: https://api.openai.com
    website_url: https://openai.com
`
    const res = parseHermes(makeText(yaml))
    expect(res.providers[0].meta.websiteUrl).toBe('https://openai.com')
  })

  it('meta.icon 透传', () => {
    const yaml = `
custom_providers:
  - name: P1
    api_base_url: https://api.openai.com
    icon: openai
`
    const res = parseHermes(makeText(yaml))
    expect(res.providers[0].meta.icon).toBe('openai')
  })

  it('meta.iconColor 透传', () => {
    const yaml = `
custom_providers:
  - name: P1
    api_base_url: https://api.openai.com
    icon_color: '#10A37F'
`
    const res = parseHermes(makeText(yaml))
    expect(res.providers[0].meta.iconColor).toBe('#10A37F')
  })
})

describe('hermes parser — sourceId fallback', () => {
  it('有 id → sourceId = p.id', () => {
    const yaml = `
custom_providers:
  - id: my-id
    name: P1
    api_base_url: https://api.openai.com
`
    const res = parseHermes(makeText(yaml))
    expect(res.providers[0].sourceId).toBe('my-id')
  })

  it('无 id → sourceId = hermes::${idx}', () => {
    const yaml = `
custom_providers:
  - name: First
    api_base_url: https://api.first.com
  - name: Second
    api_base_url: https://api.second.com
`
    const res = parseHermes(makeText(yaml))
    expect(res.providers[0].sourceId).toBe('hermes::0')
    expect(res.providers[1].sourceId).toBe('hermes::1')
  })
})

describe('hermes parser — name fallback', () => {
  it('name 缺失 → fallback 到 sourceId', () => {
    const yaml = `
custom_providers:
  - id: explicit-id
    api_base_url: https://api.openai.com
`
    const res = parseHermes(makeText(yaml))
    expect(res.providers[0].name).toBe('explicit-id')
  })

  it('name 缺失 + id 缺失 → fallback 到 hermes::idx', () => {
    const yaml = `
custom_providers:
  - api_base_url: https://api.openai.com
`
    const res = parseHermes(makeText(yaml))
    expect(res.providers[0].name).toBe('hermes::0')
  })

  it('name 含 HTML → 被清洗', () => {
    const yaml = `
custom_providers:
  - name: '<script>alert(1)</script>'
    api_base_url: https://api.openai.com
`
    const res = parseHermes(makeText(yaml))
    expect(res.providers[0].name).not.toContain('<script>')
    expect(res.providers[0].name).toContain('&lt;script&gt;')
  })
})

describe('hermes parser — providerCode 推断', () => {
  it('api_base_url=openai.com → openai', () => {
    const yaml = `
custom_providers:
  - name: P1
    api_base_url: https://api.openai.com/v1
`
    const res = parseHermes(makeText(yaml))
    expect(res.providers[0].providerCode).toBe('openai')
  })

  it('api_base_url=anthropic.com → anthropic', () => {
    const yaml = `
custom_providers:
  - name: P1
    api_base_url: https://api.anthropic.com
`
    const res = parseHermes(makeText(yaml))
    expect(res.providers[0].providerCode).toBe('anthropic')
  })

  it('api_base_url=deepseek.com → deepseek', () => {
    const yaml = `
custom_providers:
  - name: P1
    api_base_url: https://api.deepseek.com
`
    const res = parseHermes(makeText(yaml))
    expect(res.providers[0].providerCode).toBe('deepseek')
  })

  it('api_base_url=googleapis.com → google', () => {
    const yaml = `
custom_providers:
  - name: P1
    api_base_url: https://generativelanguage.googleapis.com
`
    const res = parseHermes(makeText(yaml))
    expect(res.providers[0].providerCode).toBe('google')
  })

  it('api_format=gemini_native → google(apiFormat 兜底)', () => {
    const yaml = `
custom_providers:
  - name: P1
    api_base_url: https://api.unknown.com
    api_format: gemini
`
    const res = parseHermes(makeText(yaml))
    expect(res.providers[0].providerCode).toBe('google')
  })

  it('model=gemini-xxx 优先于 baseUrl → google', () => {
    const yaml = `
custom_providers:
  - name: P1
    api_base_url: https://api.unknown.com
    model: gemini-2.0-flash
`
    const res = parseHermes(makeText(yaml))
    expect(res.providers[0].providerCode).toBe('google')
  })

  it('未知 baseUrl + 未知 model → custom', () => {
    const yaml = `
custom_providers:
  - name: P1
    api_base_url: https://api.unknown.com
`
    const res = parseHermes(makeText(yaml))
    expect(res.providers[0].providerCode).toBe('custom')
  })
})

describe('hermes parser — sourceAppType 固定字段', () => {
  it('sourceAppType 固定为 hermes', () => {
    const yaml = `
custom_providers:
  - name: P1
    api_base_url: https://api.openai.com
`
    const res = parseHermes(makeText(yaml))
    expect(res.providers[0].sourceAppType).toBe('hermes')
  })
})

describe('hermes parser — 单 provider 失败不影响其他', () => {
  it('中间 provider name 为非字符串(数字)→ 该 provider 抛错被 catch,其他仍正常解析', () => {
    // sanitizeProviderName 内部调用 name.replace(...),数字没有 .replace 方法 → 抛 TypeError
    const yaml = `
custom_providers:
  - name: P1
    api_base_url: https://api.first.com
  - name: 12345
    api_base_url: https://api.second.com
  - name: P3
    api_base_url: https://api.third.com
`
    const res = parseHermes(makeText(yaml))
    // 第 2 个 provider name=12345 抛 TypeError → 走 catch 分支 → globalWarnings
    // p1 和 p3 仍正常解析
    expect(res.providers.length).toBe(2)
    expect(res.globalWarnings.length).toBeGreaterThan(0)
    const names = res.providers.map((p) => p.name)
    expect(names).toContain('P1')
    expect(names).toContain('P3')
  })
})

describe('hermes parser — 综合场景', () => {
  it('完整真实场景:多 provider + default_provider + 各 meta 字段', () => {
    const yaml = `
default_provider: openai
custom_providers:
  - id: openai
    name: OpenAI
    api_base_url: https://api.openai.com/v1
    api_key: sk-openai
    model: gpt-5
    api_format: openai_chat
    is_active: true
    category: Official
    website_url: https://openai.com
    icon: openai
    icon_color: '#10A37F'
  - id: anthropic
    name: Anthropic
    api_base_url: https://api.anthropic.com
    api_key: sk-ant
    model: claude-sonnet-4-5
    api_format: anthropic
    category: Official
    website_url: https://anthropic.com
`
    const res = parseHermes(makeText(yaml))
    expect(res.providers).toHaveLength(2)

    const openai = res.providers.find((p) => p.sourceId === 'openai')!
    const anthropic = res.providers.find((p) => p.sourceId === 'anthropic')!

    expect(openai.isCurrent).toBe(true) // is_active=true + default_provider 匹配
    expect(anthropic.isCurrent).toBe(false)

    expect(openai.apiFormat).toBe('openai_chat')
    expect(anthropic.apiFormat).toBe('anthropic_messages')

    expect(openai.providerCode).toBe('openai')
    expect(anthropic.providerCode).toBe('anthropic')

    expect(openai.meta.category).toBe('Official')
    expect(openai.meta.websiteUrl).toBe('https://openai.com')
    expect(openai.meta.icon).toBe('openai')
    expect(openai.meta.iconColor).toBe('#10A37F')
    expect(openai.meta.models).toEqual(['gpt-5'])

    expect(anthropic.meta.models).toEqual(['claude-sonnet-4-5'])
  })

  it('camelCase 字段 + defaultProvider + isActive', () => {
    const yaml = `
defaultProvider: anthropic
customProviders:
  - id: openai
    name: OpenAI
    apiBaseUrl: https://api.openai.com
    apiKey: sk-openai
    isActive: false
  - id: anthropic
    name: Anthropic
    apiBaseUrl: https://api.anthropic.com
    apiKey: sk-ant
    isActive: true
`
    const res = parseHermes(makeText(yaml))
    expect(res.providers).toHaveLength(2)
    const anthropic = res.providers.find((p) => p.sourceId === 'anthropic')!
    expect(anthropic.isCurrent).toBe(true)
    expect(anthropic.apiKey).toBe('sk-ant')
  })
})
