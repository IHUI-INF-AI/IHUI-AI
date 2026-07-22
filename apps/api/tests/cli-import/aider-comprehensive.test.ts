/**
 * Aider parser 综合测试 — 全参数深度覆盖
 *
 * 覆盖维度:
 *   1. 双 provider(OpenAI + Anthropic)组合
 *   2. isCurrent 由 model 前缀决定(claude-* → anthropic,gpt-* → openai)
 *   3. 单 provider(只有 openai 或只有 anthropic)
 *   4. YAML 格式变体(引号/无引号/单引号/双引号/数字/布尔)
 *   5. 默认 baseUrl(无 openai-api-base 时 fallback)
 *   6. 空值/异常/边界
 *   7. meta + name 验证
 *   8. 跨平台不搞混
 */
import { describe, it, expect } from 'vitest'

import type { ParserInput } from '../../src/services/cli-import/parsers/types.js'
import { parseAider } from '../../src/services/cli-import/parsers/aider.js'

function makeText(text: string): ParserInput {
  return { text, sourcePath: 'test' }
}

describe('aider parser — 双 provider 组合', () => {
  it('OpenAI + Anthropic 双 provider + model=claude-* → anthropic isCurrent', async () => {
    const res = await parseAider(makeText([
      'model: claude-3-opus',
      'openai-api-key: sk-openai',
      'openai-api-base: https://api.openai.com/v1',
      'anthropic-api-key: sk-ant-xxx',
      'anthropic-api-base: https://api.anthropic.com',
    ].join('\n')))
    expect(res.providers).toHaveLength(2)
    const openai = res.providers.find((p) => p.sourceId === 'aider::openai')
    const anthropic = res.providers.find((p) => p.sourceId === 'aider::anthropic')
    expect(openai?.apiFormat).toBe('openai_chat')
    expect(anthropic?.apiFormat).toBe('anthropic_messages')
    expect(anthropic?.isCurrent).toBe(true)
    expect(openai?.isCurrent).toBe(false)
  })

  it('双 provider + model=gpt-* → openai isCurrent', async () => {
    const res = await parseAider(makeText([
      'model: gpt-4',
      'openai-api-key: sk-a',
      'openai-api-base: https://api.openai.com/v1',
      'anthropic-api-key: sk-b',
      'anthropic-api-base: https://api.anthropic.com',
    ].join('\n')))
    const openai = res.providers.find((p) => p.sourceId === 'aider::openai')
    const anthropic = res.providers.find((p) => p.sourceId === 'aider::anthropic')
    expect(openai?.isCurrent).toBe(true)
    expect(anthropic?.isCurrent).toBe(false)
  })

  it('双 provider + 无 model → openai isCurrent(默认)', async () => {
    // model 未设置时 targetId='aider::openai',走 findIndex 找不到时 idx=-1 → Math.max(0, -1)=0
    const res = await parseAider(makeText([
      'openai-api-key: sk-a',
      'openai-api-base: https://api.openai.com/v1',
      'anthropic-api-key: sk-b',
      'anthropic-api-base: https://api.anthropic.com',
    ].join('\n')))
    expect(res.providers).toHaveLength(2)
    // model 未设 → defaultModel undefined → targetId='aider::openai'
    const openai = res.providers.find((p) => p.sourceId === 'aider::openai')
    expect(openai?.isCurrent).toBe(true)
  })

  it('双 provider + model=其他(gemini-*) → openai isCurrent(兜底)', async () => {
    // model=gemini-1.5-pro 不匹配 claude-* → targetId='aider::openai'
    const res = await parseAider(makeText([
      'model: gemini-1.5-pro',
      'openai-api-key: sk-a',
      'openai-api-base: https://api.openai.com/v1',
      'anthropic-api-key: sk-b',
      'anthropic-api-base: https://api.anthropic.com',
    ].join('\n')))
    const openai = res.providers.find((p) => p.sourceId === 'aider::openai')
    expect(openai?.isCurrent).toBe(true)
  })

  it('双 provider + model=claude-3-haiku(短名) → anthropic isCurrent', async () => {
    const res = await parseAider(makeText([
      'model: claude-3-haiku',
      'openai-api-key: sk-a',
      'anthropic-api-key: sk-b',
    ].join('\n')))
    const anthropic = res.providers.find((p) => p.sourceId === 'aider::anthropic')
    expect(anthropic?.isCurrent).toBe(true)
  })

  it('双 provider 顺序固定(openai 先,anthropic 后)', async () => {
    const res = await parseAider(makeText([
      'openai-api-key: sk-a',
      'anthropic-api-key: sk-b',
    ].join('\n')))
    expect(res.providers[0]!.sourceId).toBe('aider::openai')
    expect(res.providers[1]!.sourceId).toBe('aider::anthropic')
  })

  it('双 provider + model=gpt-4o → openai modelIdForTest=gpt-4o', async () => {
    const res = await parseAider(makeText([
      'model: gpt-4o',
      'openai-api-key: sk-a',
      'openai-api-base: https://api.openai.com/v1',
      'anthropic-api-key: sk-b',
      'anthropic-api-base: https://api.anthropic.com',
    ].join('\n')))
    const openai = res.providers.find((p) => p.sourceId === 'aider::openai')
    expect(openai?.modelIdForTest).toBe('gpt-4o')
  })

  it('双 provider + model=claude-* → anthropic modelIdForTest=claude-*', async () => {
    const res = await parseAider(makeText([
      'model: claude-3-sonnet',
      'openai-api-key: sk-a',
      'anthropic-api-key: sk-b',
    ].join('\n')))
    const anthropic = res.providers.find((p) => p.sourceId === 'aider::anthropic')
    expect(anthropic?.modelIdForTest).toBe('claude-3-sonnet')
  })

  it('双 provider + model=gpt-* → openai modelIdForTest=gpt-*, anthropic undefined', async () => {
    const res = await parseAider(makeText([
      'model: gpt-4',
      'openai-api-key: sk-a',
      'anthropic-api-key: sk-b',
    ].join('\n')))
    const openai = res.providers.find((p) => p.sourceId === 'aider::openai')
    const anthropic = res.providers.find((p) => p.sourceId === 'aider::anthropic')
    expect(openai?.modelIdForTest).toBe('gpt-4')
    expect(anthropic?.modelIdForTest).toBeUndefined()
  })

  it('双 provider + model 不匹配任何前缀 → 两边 modelIdForTest undefined', async () => {
    const res = await parseAider(makeText([
      'model: custom-model',
      'openai-api-key: sk-a',
      'anthropic-api-key: sk-b',
    ].join('\n')))
    const openai = res.providers.find((p) => p.sourceId === 'aider::openai')
    const anthropic = res.providers.find((p) => p.sourceId === 'aider::anthropic')
    expect(openai?.modelIdForTest).toBeUndefined()
    expect(anthropic?.modelIdForTest).toBeUndefined()
  })
})

describe('aider parser — 单 provider', () => {
  it('只有 OpenAI key → 单 provider + isCurrent', async () => {
    const res = await parseAider(makeText('model: gpt-4\nopenai-api-key: sk-xxx'))
    expect(res.providers).toHaveLength(1)
    expect(res.providers[0]!.apiFormat).toBe('openai_chat')
    expect(res.providers[0]!.isCurrent).toBe(true)
    expect(res.providers[0]!.sourceId).toBe('aider::openai')
  })

  it('只有 Anthropic key → 单 provider + isCurrent', async () => {
    const res = await parseAider(makeText('model: claude-3-opus\nanthropic-api-key: sk-ant-xxx'))
    expect(res.providers).toHaveLength(1)
    expect(res.providers[0]!.apiFormat).toBe('anthropic_messages')
    expect(res.providers[0]!.isCurrent).toBe(true)
    expect(res.providers[0]!.sourceId).toBe('aider::anthropic')
  })

  it('只有 OpenAI key + model=claude-* → 仍 openai isCurrent(无 anthropic 可选)', async () => {
    const res = await parseAider(makeText('model: claude-3-opus\nopenai-api-key: sk-xxx'))
    expect(res.providers).toHaveLength(1)
    expect(res.providers[0]!.sourceId).toBe('aider::openai')
    // targetId='aider::anthropic' 找不到 → idx=0 → openai isCurrent
    expect(res.providers[0]!.isCurrent).toBe(true)
  })

  it('只有 Anthropic key + model=gpt-* → 仍 anthropic isCurrent', async () => {
    const res = await parseAider(makeText('model: gpt-4\nanthropic-api-key: sk-ant-xxx'))
    expect(res.providers).toHaveLength(1)
    expect(res.providers[0]!.sourceId).toBe('aider::anthropic')
    expect(res.providers[0]!.isCurrent).toBe(true)
  })
})

describe('aider parser — 默认 baseUrl fallback', () => {
  it('OpenAI 无 openai-api-base → 默认 https://api.openai.com/v1', async () => {
    const res = await parseAider(makeText('openai-api-key: sk-xxx'))
    expect(res.providers[0]!.baseUrl).toBe('https://api.openai.com/v1')
  })

  it('Anthropic 无 anthropic-api-base → 默认 https://api.anthropic.com', async () => {
    const res = await parseAider(makeText('anthropic-api-key: sk-ant-xxx'))
    expect(res.providers[0]!.baseUrl).toBe('https://api.anthropic.com')
  })

  it('自定义 openai-api-base → 覆盖默认', async () => {
    const res = await parseAider(makeText([
      'openai-api-key: sk-xxx',
      'openai-api-base: https://api.deepseek.com',
    ].join('\n')))
    expect(res.providers[0]!.baseUrl).toBe('https://api.deepseek.com')
  })

  it('自定义 anthropic-api-base → 覆盖默认', async () => {
    const res = await parseAider(makeText([
      'anthropic-api-key: sk-ant-xxx',
      'anthropic-api-base: https://custom.anthropic.proxy.com',
    ].join('\n')))
    expect(res.providers[0]!.baseUrl).toBe('https://custom.anthropic.proxy.com')
  })
})

describe('aider parser — YAML 格式变体', () => {
  it('双引号包裹 key', async () => {
    const res = await parseAider(makeText('openai-api-key: "sk-quoted"'))
    expect(res.providers[0]!.apiKey).toBe('sk-quoted')
  })

  it('单引号包裹 key', async () => {
    const res = await parseAider(makeText("openai-api-key: 'sk-quoted'"))
    expect(res.providers[0]!.apiKey).toBe('sk-quoted')
  })

  it('无引号 key', async () => {
    const res = await parseAider(makeText('openai-api-key: sk-plain'))
    expect(res.providers[0]!.apiKey).toBe('sk-plain')
  })

  it('值含空格(无引号)', async () => {
    const res = await parseAider(makeText('openai-api-key: sk with spaces'))
    // parseYamlSimple 按 ':' 分割,trim 后值含空格
    expect(res.providers[0]!.apiKey).toBe('sk with spaces')
  })

  it('值含等号', async () => {
    const res = await parseAider(makeText('openai-api-key: sk=equals'))
    expect(res.providers[0]!.apiKey).toBe('sk=equals')
  })

  it('值含冒号(只按第一个冒号分割)', async () => {
    const res = await parseAider(makeText('openai-api-key: sk:with:colons'))
    expect(res.providers[0]!.apiKey).toBe('sk:with:colons')
  })

  it('注释行被忽略', async () => {
    const res = await parseAider(makeText([
      '# This is a comment',
      'openai-api-key: sk-xxx',
      '// double slash comment not ignored',
    ].join('\n')))
    expect(res.providers).toHaveLength(1)
    expect(res.providers[0]!.apiKey).toBe('sk-xxx')
  })

  it('CRLF 换行兼容', async () => {
    const res = await parseAider(makeText('openai-api-key: sk-crlf\r\nopenai-api-base: https://api.openai.com/v1'))
    expect(res.providers[0]!.apiKey).toBe('sk-crlf')
  })

  it('行首缩进被 trim', async () => {
    const res = await parseAider(makeText('   openai-api-key: sk-indented'))
    expect(res.providers[0]!.apiKey).toBe('sk-indented')
  })

  it('行尾空格被 trim', async () => {
    const res = await parseAider(makeText('openai-api-key: sk-trail   '))
    expect(res.providers[0]!.apiKey).toBe('sk-trail')
  })

  it('空行被忽略', async () => {
    const res = await parseAider(makeText([
      '',
      'openai-api-key: sk-xxx',
      '',
      '',
      'openai-api-base: https://api.openai.com/v1',
      '',
    ].join('\n')))
    expect(res.providers).toHaveLength(1)
  })

  it('model 字段也支持引号', async () => {
    const res = await parseAider(makeText([
      'model: "claude-3-opus"',
      'openai-api-key: sk-a',
      'anthropic-api-key: sk-b',
    ].join('\n')))
    const anthropic = res.providers.find((p) => p.sourceId === 'aider::anthropic')
    expect(anthropic?.isCurrent).toBe(true)
  })
})

describe('aider parser — 空值与异常边界', () => {
  it('空字符串输入抛异常', async () => {
    await expect(parseAider(makeText(''))).rejects.toThrow()
  })

  it('纯空白输入抛异常', async () => {
    await expect(parseAider(makeText('  \n  \t  '))).rejects.toThrow()
  })

  it('无任何 key → warning', async () => {
    const res = await parseAider(makeText('model: gpt-4'))
    expect(res.providers).toHaveLength(0)
    expect(res.globalWarnings.length).toBeGreaterThan(0)
    expect(res.globalWarnings[0]).toContain('openai-api-key')
    expect(res.globalWarnings[0]).toContain('anthropic-api-key')
  })

  it('只有 model 无 key → warning', async () => {
    const res = await parseAider(makeText('model: claude-3-opus'))
    expect(res.providers).toHaveLength(0)
  })

  it('只有注释 → warning', async () => {
    const res = await parseAider(makeText('# just a comment\n# another'))
    expect(res.providers).toHaveLength(0)
    expect(res.globalWarnings.length).toBeGreaterThan(0)
  })

  it('openai-api-key 为空字符串 → 不创建 openai provider', async () => {
    const res = await parseAider(makeText('openai-api-key:\nanthropic-api-key: sk-ant-xxx'))
    expect(res.providers).toHaveLength(1)
    expect(res.providers[0]!.sourceId).toBe('aider::anthropic')
  })

  it('openai-api-key 后无值 → 不创建 provider', async () => {
    // parseYamlSimple 在 colon<=0 时跳过,但 'openai-api-key:' colon>0 value=''
    // 结果 cfg['openai-api-key']='' → falsy → 不创建
    const res = await parseAider(makeText('openai-api-key:'))
    expect(res.providers).toHaveLength(0)
  })

  it('无效 YAML 行(无冒号)被忽略', async () => {
    const res = await parseAider(makeText([
      'invalid line without colon',
      'openai-api-key: sk-xxx',
    ].join('\n')))
    expect(res.providers).toHaveLength(1)
  })

  it('只有冒号的行被忽略', async () => {
    const res = await parseAider(makeText([
      ':',
      'openai-api-key: sk-xxx',
    ].join('\n')))
    expect(res.providers).toHaveLength(1)
  })
})

describe('aider parser — providerCode 推断', () => {
  it('OpenAI provider + api.openai.com → providerCode=openai', async () => {
    const res = await parseAider(makeText('openai-api-key: sk-xxx'))
    expect(res.providers[0]!.providerCode).toBe('openai')
  })

  it('OpenAI provider + api.deepseek.com URL → providerCode=deepseek', async () => {
    const res = await parseAider(makeText([
      'openai-api-key: sk-xxx',
      'openai-api-base: https://api.deepseek.com',
    ].join('\n')))
    expect(res.providers[0]!.providerCode).toBe('deepseek')
  })

  it('OpenAI provider + model=gpt-4o + openai URL → providerCode=openai', async () => {
    const res = await parseAider(makeText([
      'model: gpt-4o',
      'openai-api-key: sk-xxx',
    ].join('\n')))
    expect(res.providers[0]!.providerCode).toBe('openai')
  })

  it('Anthropic provider → providerCode=anthropic', async () => {
    const res = await parseAider(makeText('anthropic-api-key: sk-ant-xxx'))
    expect(res.providers[0]!.providerCode).toBe('anthropic')
  })

  it('Anthropic provider + 自定义 URL → providerCode=anthropic(URL 含 anthropic.com)', async () => {
    const res = await parseAider(makeText([
      'anthropic-api-key: sk-ant-xxx',
      'anthropic-api-base: https://proxy.anthropic.com/v1',
    ].join('\n')))
    expect(res.providers[0]!.providerCode).toBe('anthropic')
  })

  it('OpenAI provider + 未知 URL + 无 model → providerCode=custom', async () => {
    const res = await parseAider(makeText([
      'openai-api-key: sk-xxx',
      'openai-api-base: https://api.unknown.com',
    ].join('\n')))
    expect(res.providers[0]!.providerCode).toBe('custom')
  })
})

describe('aider parser — meta + name 验证', () => {
  it('OpenAI provider meta.category = Aider', async () => {
    const res = await parseAider(makeText('openai-api-key: sk-xxx'))
    expect(res.providers[0]!.meta.category).toBe('Aider')
  })

  it('Anthropic provider meta.category = Aider', async () => {
    const res = await parseAider(makeText('anthropic-api-key: sk-ant-xxx'))
    expect(res.providers[0]!.meta.category).toBe('Aider')
  })

  it('meta.websiteUrl = https://aider.chat', async () => {
    const res = await parseAider(makeText('openai-api-key: sk-xxx'))
    expect(res.providers[0]!.meta.websiteUrl).toBe('https://aider.chat')
  })

  it('有 model 时 meta.models = [model]', async () => {
    const res = await parseAider(makeText([
      'model: gpt-4o',
      'openai-api-key: sk-xxx',
    ].join('\n')))
    expect(res.providers[0]!.meta.models).toEqual(['gpt-4o'])
  })

  it('无 model 时 meta.models undefined', async () => {
    const res = await parseAider(makeText('openai-api-key: sk-xxx'))
    expect(res.providers[0]!.meta.models).toBeUndefined()
  })

  it('OpenAI provider name = Aider OpenAI', async () => {
    const res = await parseAider(makeText('openai-api-key: sk-xxx'))
    expect(res.providers[0]!.name).toBe('Aider OpenAI')
  })

  it('Anthropic provider name = Aider Anthropic', async () => {
    const res = await parseAider(makeText('anthropic-api-key: sk-ant-xxx'))
    expect(res.providers[0]!.name).toBe('Aider Anthropic')
  })

  it('name 不含 HTML 标签(XSS 清洗)', async () => {
    const res = await parseAider(makeText('openai-api-key: sk-xxx'))
    expect(res.providers[0]!.name).not.toContain('<')
    expect(res.providers[0]!.name).not.toContain('>')
  })

  it('globalWarnings 成功时为空数组', async () => {
    const res = await parseAider(makeText('openai-api-key: sk-xxx'))
    expect(res.globalWarnings).toEqual([])
  })
})

describe('aider parser — 跨平台不搞混', () => {
  it('不读取 cursor.ai.* 字段(YAML 不含 JSON dotted key)', async () => {
    const res = await parseAider(makeText('cursor.ai.apiKey: sk-xxx'))
    // YAML 解析:cfg['cursor.ai.apiKey']='sk-xxx' → 不是 openai-api-key → 不创建
    expect(res.providers).toHaveLength(0)
  })

  it('YAML 格式与 JSON 格式不同(aider 不解析 JSON)', async () => {
    const jsonStr = JSON.stringify({ 'openai-api-key': 'sk-xxx' })
    const res = await parseAider(makeText(jsonStr))
    // JSON 字符串 '{"openai-api-key":"sk-xxx"}' 在 parseYamlSimple 里被当成单行
    // 第一行: '{"openai-api-key":"sk-xxx"}' trim 后含 ':' → key='{"openai-api-key"' value='"sk-xxx"}'
    // 不匹配 'openai-api-key' → 0 providers
    expect(res.providers).toHaveLength(0)
  })

  it('aider 双 provider sourceId 不同(aider::openai ≠ aider::anthropic)', async () => {
    const res = await parseAider(makeText([
      'openai-api-key: sk-a',
      'anthropic-api-key: sk-b',
    ].join('\n')))
    const ids = res.providers.map((p) => p.sourceId)
    expect(ids).toContain('aider::openai')
    expect(ids).toContain('aider::anthropic')
    expect(new Set(ids).size).toBe(2)
  })
})
