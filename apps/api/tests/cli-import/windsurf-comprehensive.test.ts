/**
 * Windsurf parser 综合测试 — 全参数深度覆盖
 *
 * 覆盖维度:
 *   1. apiFormat 推断(URL 优先 + model 兜底)
 *   2. providerCode 推断(model 前缀优先 + baseUrl 兜底)
 *   3. 各厂商 URL 完整覆盖
 *   4. model 前缀覆盖(9 个主流厂商)
 *   5. 空值/异常/边界
 *   6. JSON 格式变体
 *   7. meta + name + isCurrent 验证
 *   8. 跨平台不搞混(Windsurf ≠ Cursor ≠ Cline)
 */
import { describe, it, expect } from 'vitest'

import type { ParserInput } from '../../src/services/cli-import/parsers/types.js'
import { parseWindsurf } from '../../src/services/cli-import/parsers/windsurf.js'

function makeText(text: string): ParserInput {
  return { text, sourcePath: 'test' }
}

function makeWindsurfJson(opts: Record<string, unknown>): string {
  return JSON.stringify(opts)
}

describe('windsurf parser — apiFormat URL 优先推断', () => {
  it('api.openai.com → openai_chat', async () => {
    const res = await parseWindsurf(makeText(makeWindsurfJson({
      'windsurf.ai.apiKey': 'sk-xxx',
      'windsurf.ai.baseUrl': 'https://api.openai.com/v1',
    })))
    expect(res.providers[0]!.apiFormat).toBe('openai_chat')
  })

  it('api.anthropic.com → anthropic_messages', async () => {
    const res = await parseWindsurf(makeText(makeWindsurfJson({
      'windsurf.ai.apiKey': 'sk-ant-xxx',
      'windsurf.ai.baseUrl': 'https://api.anthropic.com',
    })))
    expect(res.providers[0]!.apiFormat).toBe('anthropic_messages')
  })

  it('googleapis.com → gemini_native', async () => {
    const res = await parseWindsurf(makeText(makeWindsurfJson({
      'windsurf.ai.apiKey': 'AIza-xxx',
      'windsurf.ai.baseUrl': 'https://generativelanguage.googleapis.com/v1beta',
    })))
    expect(res.providers[0]!.apiFormat).toBe('gemini_native')
  })

  it('api.deepseek.com → openai_chat(默认)', async () => {
    const res = await parseWindsurf(makeText(makeWindsurfJson({
      'windsurf.ai.apiKey': 'sk-xxx',
      'windsurf.ai.baseUrl': 'https://api.deepseek.com',
    })))
    expect(res.providers[0]!.apiFormat).toBe('openai_chat')
  })

  it('githubcopilot URL → openai_chat', async () => {
    const res = await parseWindsurf(makeText(makeWindsurfJson({
      'windsurf.ai.apiKey': 'ghu-xxx',
      'windsurf.ai.baseUrl': 'https://api.githubcopilot.com',
    })))
    expect(res.providers[0]!.apiFormat).toBe('openai_chat')
  })

  it('未知 URL → 默认 openai_chat', async () => {
    const res = await parseWindsurf(makeText(makeWindsurfJson({
      'windsurf.ai.apiKey': 'sk-xxx',
      'windsurf.ai.baseUrl': 'https://api.custom.com/v1',
    })))
    expect(res.providers[0]!.apiFormat).toBe('openai_chat')
  })

  it('URL 大小写不敏感', async () => {
    const res = await parseWindsurf(makeText(makeWindsurfJson({
      'windsurf.ai.apiKey': 'AIza-xxx',
      'windsurf.ai.baseUrl': 'HTTPS://GenerativeLanguage.googleapis.com',
    })))
    expect(res.providers[0]!.apiFormat).toBe('gemini_native')
  })
})

describe('windsurf parser — apiFormat model 兜底', () => {
  it('未知 URL + model=claude- → anthropic_messages', async () => {
    const res = await parseWindsurf(makeText(makeWindsurfJson({
      'windsurf.ai.apiKey': 'sk-xxx',
      'windsurf.ai.baseUrl': 'https://proxy.example.com',
      'windsurf.ai.model': 'claude-3-sonnet',
    })))
    expect(res.providers[0]!.apiFormat).toBe('anthropic_messages')
  })

  it('未知 URL + model=gemini- → gemini_native', async () => {
    const res = await parseWindsurf(makeText(makeWindsurfJson({
      'windsurf.ai.apiKey': 'sk-xxx',
      'windsurf.ai.baseUrl': 'https://proxy.example.com',
      'windsurf.ai.model': 'gemini-1.5-flash',
    })))
    expect(res.providers[0]!.apiFormat).toBe('gemini_native')
  })

  it('URL 优先于 model(anthropic.com + gpt-4 → anthropic_messages)', async () => {
    const res = await parseWindsurf(makeText(makeWindsurfJson({
      'windsurf.ai.apiKey': 'sk-xxx',
      'windsurf.ai.baseUrl': 'https://api.anthropic.com',
      'windsurf.ai.model': 'gpt-4',
    })))
    expect(res.providers[0]!.apiFormat).toBe('anthropic_messages')
  })
})

describe('windsurf parser — providerCode 推断(model 前缀优先)', () => {
  it('model=claude-3-opus → providerCode=anthropic', async () => {
    const res = await parseWindsurf(makeText(makeWindsurfJson({
      'windsurf.ai.apiKey': 'sk-xxx',
      'windsurf.ai.baseUrl': 'https://api.openai.com/v1',
      'windsurf.ai.model': 'claude-3-opus',
    })))
    expect(res.providers[0]!.providerCode).toBe('anthropic')
  })

  it('model=deepseek-coder → providerCode=deepseek', async () => {
    const res = await parseWindsurf(makeText(makeWindsurfJson({
      'windsurf.ai.apiKey': 'sk-xxx',
      'windsurf.ai.baseUrl': 'https://api.deepseek.com',
      'windsurf.ai.model': 'deepseek-coder',
    })))
    expect(res.providers[0]!.providerCode).toBe('deepseek')
  })

  it('model=glm-4 → providerCode=zhipu', async () => {
    const res = await parseWindsurf(makeText(makeWindsurfJson({
      'windsurf.ai.apiKey': 'sk-xxx',
      'windsurf.ai.baseUrl': 'https://open.bigmodel.cn/api/paas/v4',
      'windsurf.ai.model': 'glm-4',
    })))
    expect(res.providers[0]!.providerCode).toBe('zhipu')
  })

  it('model=qwen-max → providerCode=alibaba', async () => {
    const res = await parseWindsurf(makeText(makeWindsurfJson({
      'windsurf.ai.apiKey': 'sk-xxx',
      'windsurf.ai.baseUrl': 'https://dashscope.aliyuncs.com/v1',
      'windsurf.ai.model': 'qwen-max',
    })))
    expect(res.providers[0]!.providerCode).toBe('alibaba')
  })

  it('model=ernie-4.0 → providerCode=baidu', async () => {
    const res = await parseWindsurf(makeText(makeWindsurfJson({
      'windsurf.ai.apiKey': 'sk-xxx',
      'windsurf.ai.baseUrl': 'https://qianfan.baidubce.com/v2',
      'windsurf.ai.model': 'ernie-4.0',
    })))
    expect(res.providers[0]!.providerCode).toBe('baidu')
  })

  it('model=doubao-pro → providerCode=bytedance', async () => {
    const res = await parseWindsurf(makeText(makeWindsurfJson({
      'windsurf.ai.apiKey': 'sk-xxx',
      'windsurf.ai.baseUrl': 'https://ark.cn-beijing.volces.com/api/v3',
      'windsurf.ai.model': 'doubao-pro',
    })))
    expect(res.providers[0]!.providerCode).toBe('bytedance')
  })

  it('无 model + api.moonshot.cn URL → providerCode=moonshot', async () => {
    const res = await parseWindsurf(makeText(makeWindsurfJson({
      'windsurf.ai.apiKey': 'sk-xxx',
      'windsurf.ai.baseUrl': 'https://api.moonshot.cn/v1',
    })))
    expect(res.providers[0]!.providerCode).toBe('moonshot')
  })

  it('无 model + api.openai.com → providerCode=openai', async () => {
    const res = await parseWindsurf(makeText(makeWindsurfJson({
      'windsurf.ai.apiKey': 'sk-xxx',
      'windsurf.ai.baseUrl': 'https://api.openai.com/v1',
    })))
    expect(res.providers[0]!.providerCode).toBe('openai')
  })

  it('localhost URL → providerCode=local', async () => {
    const res = await parseWindsurf(makeText(makeWindsurfJson({
      'windsurf.ai.apiKey': 'sk-xxx',
      'windsurf.ai.baseUrl': 'http://localhost:8080/v1',
    })))
    expect(res.providers[0]!.providerCode).toBe('local')
  })

  it('openrouter URL → providerCode=openrouter', async () => {
    const res = await parseWindsurf(makeText(makeWindsurfJson({
      'windsurf.ai.apiKey': 'sk-or-xxx',
      'windsurf.ai.baseUrl': 'https://openrouter.ai/api/v1',
    })))
    expect(res.providers[0]!.providerCode).toBe('openrouter')
  })

  it('groq URL → providerCode=groq', async () => {
    const res = await parseWindsurf(makeText(makeWindsurfJson({
      'windsurf.ai.apiKey': 'gsk-xxx',
      'windsurf.ai.baseUrl': 'https://api.groq.com/openai/v1',
    })))
    expect(res.providers[0]!.providerCode).toBe('groq')
  })
})

describe('windsurf parser — 空值与异常边界', () => {
  it('空字符串输入抛异常', async () => {
    await expect(parseWindsurf(makeText(''))).rejects.toThrow()
  })

  it('纯空白输入抛异常', async () => {
    await expect(parseWindsurf(makeText('  \n  '))).rejects.toThrow()
  })

  it('非 JSON 输入抛异常', async () => {
    await expect(parseWindsurf(makeText('{invalid'))).rejects.toThrow()
  })

  it('空对象 → warning(无 apiKey)', async () => {
    const res = await parseWindsurf(makeText('{}'))
    expect(res.providers).toHaveLength(0)
    expect(res.globalWarnings[0]).toContain('windsurf.ai.apiKey')
  })

  it('有 apiKey 无 baseUrl → warning(无默认端点)', async () => {
    const res = await parseWindsurf(makeText(makeWindsurfJson({
      'windsurf.ai.apiKey': 'sk-xxx',
    })))
    expect(res.providers).toHaveLength(0)
    expect(res.globalWarnings[0]).toContain('windsurf.ai.baseUrl')
  })

  it('apiKey 为空字符串 → warning', async () => {
    const res = await parseWindsurf(makeText(makeWindsurfJson({
      'windsurf.ai.apiKey': '',
      'windsurf.ai.baseUrl': 'https://api.openai.com/v1',
    })))
    expect(res.providers).toHaveLength(0)
  })

  it('apiKey 为 null → warning', async () => {
    const res = await parseWindsurf(makeText(makeWindsurfJson({
      'windsurf.ai.apiKey': null,
      'windsurf.ai.baseUrl': 'https://api.openai.com/v1',
    })))
    expect(res.providers).toHaveLength(0)
  })

  it('apiKey 为数字 → warning', async () => {
    const res = await parseWindsurf(makeText(makeWindsurfJson({
      'windsurf.ai.apiKey': 12345,
      'windsurf.ai.baseUrl': 'https://api.openai.com/v1',
    })))
    expect(res.providers).toHaveLength(0)
  })

  it('baseUrl 为空字符串 → warning', async () => {
    const res = await parseWindsurf(makeText(makeWindsurfJson({
      'windsurf.ai.apiKey': 'sk-xxx',
      'windsurf.ai.baseUrl': '',
    })))
    expect(res.providers).toHaveLength(0)
    expect(res.globalWarnings[0]).toContain('windsurf.ai.baseUrl')
  })
})

describe('windsurf parser — JSON 格式变体', () => {
  it('嵌套 JSON 不读取(windsurf.ai.* 必须扁平)', async () => {
    const res = await parseWindsurf(makeText(makeWindsurfJson({
      windsurf: { ai: { apiKey: 'sk-xxx', baseUrl: 'https://api.openai.com/v1' } },
    })))
    expect(res.providers).toHaveLength(0)
  })

  it('其他 VSCode 字段不影响提取', async () => {
    const res = await parseWindsurf(makeText(makeWindsurfJson({
      'editor.fontSize': 14,
      'workbench.colorTheme': 'dark',
      'windsurf.ai.apiKey': 'sk-xxx',
      'windsurf.ai.baseUrl': 'https://api.openai.com/v1',
      'windsurf.ai.model': 'gpt-4o',
    })))
    expect(res.providers).toHaveLength(1)
    expect(res.providers[0]!.modelIdForTest).toBe('gpt-4o')
  })

  it('model 为 null → modelIdForTest undefined', async () => {
    const res = await parseWindsurf(makeText(makeWindsurfJson({
      'windsurf.ai.apiKey': 'sk-xxx',
      'windsurf.ai.baseUrl': 'https://api.openai.com/v1',
      'windsurf.ai.model': null,
    })))
    expect(res.providers[0]!.modelIdForTest).toBeUndefined()
  })

  it('model 为空字符串 → modelIdForTest undefined', async () => {
    const res = await parseWindsurf(makeText(makeWindsurfJson({
      'windsurf.ai.apiKey': 'sk-xxx',
      'windsurf.ai.baseUrl': 'https://api.openai.com/v1',
      'windsurf.ai.model': '',
    })))
    expect(res.providers[0]!.modelIdForTest).toBeUndefined()
  })

  it('model 为数字 → modelIdForTest undefined', async () => {
    const res = await parseWindsurf(makeText(makeWindsurfJson({
      'windsurf.ai.apiKey': 'sk-xxx',
      'windsurf.ai.baseUrl': 'https://api.openai.com/v1',
      'windsurf.ai.model': 99,
    })))
    expect(res.providers[0]!.modelIdForTest).toBeUndefined()
  })
})

describe('windsurf parser — meta + name 验证', () => {
  it('meta.category = Windsurf', async () => {
    const res = await parseWindsurf(makeText(makeWindsurfJson({
      'windsurf.ai.apiKey': 'sk-xxx',
      'windsurf.ai.baseUrl': 'https://api.openai.com/v1',
    })))
    expect(res.providers[0]!.meta.category).toBe('Windsurf')
  })

  it('meta.websiteUrl = https://codeium.com', async () => {
    const res = await parseWindsurf(makeText(makeWindsurfJson({
      'windsurf.ai.apiKey': 'sk-xxx',
      'windsurf.ai.baseUrl': 'https://api.openai.com/v1',
    })))
    expect(res.providers[0]!.meta.websiteUrl).toBe('https://codeium.com')
  })

  it('有 model 时 meta.models = [model]', async () => {
    const res = await parseWindsurf(makeText(makeWindsurfJson({
      'windsurf.ai.apiKey': 'sk-xxx',
      'windsurf.ai.baseUrl': 'https://api.anthropic.com',
      'windsurf.ai.model': 'claude-3-opus',
    })))
    expect(res.providers[0]!.meta.models).toEqual(['claude-3-opus'])
  })

  it('sourceId = windsurf-default', async () => {
    const res = await parseWindsurf(makeText(makeWindsurfJson({
      'windsurf.ai.apiKey': 'sk-xxx',
      'windsurf.ai.baseUrl': 'https://api.openai.com/v1',
    })))
    expect(res.providers[0]!.sourceId).toBe('windsurf-default')
  })

  it('isCurrent = true', async () => {
    const res = await parseWindsurf(makeText(makeWindsurfJson({
      'windsurf.ai.apiKey': 'sk-xxx',
      'windsurf.ai.baseUrl': 'https://api.openai.com/v1',
    })))
    expect(res.providers[0]!.isCurrent).toBe(true)
  })

  it('name = Windsurf(XSS 清洗后)', async () => {
    const res = await parseWindsurf(makeText(makeWindsurfJson({
      'windsurf.ai.apiKey': 'sk-xxx',
      'windsurf.ai.baseUrl': 'https://api.openai.com/v1',
    })))
    expect(res.providers[0]!.name).toBe('Windsurf')
  })
})

describe('windsurf parser — 跨平台不搞混', () => {
  it('不读取 cursor.ai.* 字段', async () => {
    const res = await parseWindsurf(makeText(makeWindsurfJson({
      'cursor.ai.apiKey': 'sk-xxx',
      'cursor.ai.baseUrl': 'https://api.openai.com/v1',
    })))
    expect(res.providers).toHaveLength(0)
  })

  it('不读取 cline.* 字段', async () => {
    const res = await parseWindsurf(makeText(makeWindsurfJson({
      'cline.apiKey': 'sk-xxx',
      'cline.openAiBaseUrl': 'https://api.openai.com/v1',
    })))
    expect(res.providers).toHaveLength(0)
  })

  it('同时含 cursor + windsurf 字段,只解析 windsurf', async () => {
    const res = await parseWindsurf(makeText(makeWindsurfJson({
      'cursor.ai.apiKey': 'sk-cursor',
      'cursor.ai.baseUrl': 'https://api.openai.com/v1',
      'windsurf.ai.apiKey': 'sk-windsurf',
      'windsurf.ai.baseUrl': 'https://api.anthropic.com',
    })))
    expect(res.providers).toHaveLength(1)
    expect(res.providers[0]!.apiKey).toBe('sk-windsurf')
    expect(res.providers[0]!.apiFormat).toBe('anthropic_messages')
  })
})
