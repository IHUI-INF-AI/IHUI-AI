/**
 * 5 个独立解析器测试 — env-file / cursor / windsurf / cline / aider
 * 验证 URL / 协议 / providerCode 不搞混
 */
import { describe, it, expect } from 'vitest'

import type { ParserInput } from '../../src/services/cli-import/parsers/types.js'
import { parseEnvFile } from '../../src/services/cli-import/parsers/env-file.js'
import { parseCursor } from '../../src/services/cli-import/parsers/cursor.js'
import { parseWindsurf } from '../../src/services/cli-import/parsers/windsurf.js'
import { parseCline } from '../../src/services/cli-import/parsers/cline.js'
import { parseAider } from '../../src/services/cli-import/parsers/aider.js'

function makeText(text: string): ParserInput {
  return { text, sourcePath: 'test' }
}

describe('env-file parser', () => {
  it('OpenAI → openai_chat + api.openai.com/v1', async () => {
    const res = await parseEnvFile(makeText('OPENAI_API_KEY=sk-xxx'))
    expect(res.providers).toHaveLength(1)
    expect(res.providers[0]!.apiFormat).toBe('openai_chat')
    expect(res.providers[0]!.providerCode).toBe('openai')
    expect(res.providers[0]!.baseUrl).toBe('https://api.openai.com/v1')
  })
  it('Anthropic → anthropic_messages + api.anthropic.com', async () => {
    const res = await parseEnvFile(makeText('ANTHROPIC_API_KEY=sk-ant-xxx'))
    expect(res.providers[0]!.apiFormat).toBe('anthropic_messages')
    expect(res.providers[0]!.providerCode).toBe('anthropic')
    expect(res.providers[0]!.baseUrl).toBe('https://api.anthropic.com')
  })
  it('Google → gemini_native + /v1beta 路径', async () => {
    const res = await parseEnvFile(makeText('GEMINI_API_KEY=AIza-xxx'))
    expect(res.providers[0]!.apiFormat).toBe('gemini_native')
    expect(res.providers[0]!.providerCode).toBe('google')
    expect(res.providers[0]!.baseUrl).toContain('/v1beta')
  })
  it('GOOGLE_ 前缀别名也识别为 google', async () => {
    const res = await parseEnvFile(makeText('GOOGLE_API_KEY=AIza-xxx'))
    expect(res.providers[0]!.providerCode).toBe('google')
  })
  it('DeepSeek → openai_chat + api.deepseek.com', async () => {
    const res = await parseEnvFile(makeText('DEEPSEEK_API_KEY=sk-xxx'))
    expect(res.providers[0]!.providerCode).toBe('deepseek')
    expect(res.providers[0]!.baseUrl).toBe('https://api.deepseek.com')
  })
  it('Zhipu/GLM 别名合并', async () => {
    const res = await parseEnvFile(makeText('GLM_API_KEY=xxx'))
    expect(res.providers[0]!.providerCode).toBe('zhipu')
  })
  it('多 provider 同时解析', async () => {
    const res = await parseEnvFile(makeText('OPENAI_API_KEY=sk-a\nANTHROPIC_API_KEY=sk-b\nGEMINI_API_KEY=AIza-c'))
    expect(res.providers).toHaveLength(3)
  })
  it('自定义前缀(MY_API_KEY + MY_BASE_URL)', async () => {
    const res = await parseEnvFile(makeText('MY_API_KEY=sk-xxx\nMY_BASE_URL=https://api.custom.com/v1'))
    expect(res.providers).toHaveLength(1)
    expect(res.providers[0]!.baseUrl).toBe('https://api.custom.com/v1')
  })
  it('export 和引号格式', async () => {
    const res = await parseEnvFile(makeText('export OPENAI_API_KEY="sk-xxx"'))
    expect(res.providers).toHaveLength(1)
    expect(res.providers[0]!.apiKey).toBe('sk-xxx')
  })
  it('无 API_KEY → warning', async () => {
    const res = await parseEnvFile(makeText('# just a comment\nSOME_VAR=xxx'))
    expect(res.providers).toHaveLength(0)
    expect(res.globalWarnings.length).toBeGreaterThan(0)
  })
  it('空输入抛异常', async () => {
    await expect(parseEnvFile(makeText(''))).rejects.toThrow()
  })
})

describe('cursor parser', () => {
  it('无 baseUrl → warning(Cursor 无默认端点)', async () => {
    const res = await parseCursor(makeText(JSON.stringify({ 'cursor.ai.apiKey': 'sk-xxx' })))
    expect(res.providers).toHaveLength(0)
    expect(res.globalWarnings.length).toBeGreaterThan(0)
  })
  it('有 baseUrl + apiKey → 正常解析', async () => {
    const res = await parseCursor(makeText(JSON.stringify({
      'cursor.ai.apiKey': 'sk-xxx',
      'cursor.ai.baseUrl': 'https://api.openai.com/v1',
      'cursor.ai.model': 'gpt-4o',
    })))
    expect(res.providers).toHaveLength(1)
    expect(res.providers[0]!.apiFormat).toBe('openai_chat')
    expect(res.providers[0]!.modelIdForTest).toBe('gpt-4o')
  })
  it('Anthropic URL → anthropic_messages', async () => {
    const res = await parseCursor(makeText(JSON.stringify({
      'cursor.ai.apiKey': 'sk-ant-xxx',
      'cursor.ai.baseUrl': 'https://api.anthropic.com',
    })))
    expect(res.providers[0]!.apiFormat).toBe('anthropic_messages')
  })
  it('非 JSON 抛异常', async () => {
    await expect(parseCursor(makeText('not json'))).rejects.toThrow()
  })
})

describe('windsurf parser', () => {
  it('无 baseUrl → warning(Windsurf 无默认端点)', async () => {
    const res = await parseWindsurf(makeText(JSON.stringify({ 'windsurf.ai.apiKey': 'sk-xxx' })))
    expect(res.providers).toHaveLength(0)
    expect(res.globalWarnings.length).toBeGreaterThan(0)
  })
  it('有完整配置 → 正常解析', async () => {
    const res = await parseWindsurf(makeText(JSON.stringify({
      'windsurf.ai.apiKey': 'sk-xxx',
      'windsurf.ai.baseUrl': 'https://api.deepseek.com',
      'windsurf.ai.model': 'deepseek-coder',
    })))
    expect(res.providers).toHaveLength(1)
    expect(res.providers[0]!.apiFormat).toBe('openai_chat')
  })
})

describe('cline parser', () => {
  it('apiProvider=anthropic → anthropic_messages', async () => {
    const res = await parseCline(makeText(JSON.stringify({
      'cline.apiProvider': 'anthropic',
      'cline.apiKey': 'sk-ant-xxx',
      'cline.openAiBaseUrl': 'https://api.anthropic.com',
      'cline.openAiModelId': 'claude-3-opus',
    })))
    expect(res.providers[0]!.apiFormat).toBe('anthropic_messages')
  })
  it('apiProvider=gemini → gemini_native', async () => {
    const res = await parseCline(makeText(JSON.stringify({
      'cline.apiProvider': 'gemini',
      'cline.apiKey': 'AIza-xxx',
      'cline.openAiBaseUrl': 'https://generativelanguage.googleapis.com/v1beta',
    })))
    expect(res.providers[0]!.apiFormat).toBe('gemini_native')
  })
  it('无 baseUrl → warning', async () => {
    const res = await parseCline(makeText(JSON.stringify({
      'cline.apiProvider': 'openai',
      'cline.apiKey': 'sk-xxx',
    })))
    expect(res.providers).toHaveLength(0)
    expect(res.globalWarnings.length).toBeGreaterThan(0)
  })
})

describe('aider parser', () => {
  it('OpenAI + Anthropic 双 provider', async () => {
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
    // model=claude-3-opus → anthropic isCurrent
    expect(anthropic?.isCurrent).toBe(true)
    expect(openai?.isCurrent).toBe(false)
  })
  it('只有 OpenAI key → 单 provider', async () => {
    const res = await parseAider(makeText('model: gpt-4\nopenai-api-key: sk-xxx'))
    expect(res.providers).toHaveLength(1)
    expect(res.providers[0]!.apiFormat).toBe('openai_chat')
    expect(res.providers[0]!.isCurrent).toBe(true)
  })
  it('无 key → warning', async () => {
    const res = await parseAider(makeText('model: gpt-4'))
    expect(res.providers).toHaveLength(0)
    expect(res.globalWarnings.length).toBeGreaterThan(0)
  })
  it('model=gpt-4 → OpenAI isCurrent', async () => {
    const res = await parseAider(makeText([
      'model: gpt-4',
      'openai-api-key: sk-a',
      'openai-api-base: https://api.openai.com/v1',
      'anthropic-api-key: sk-b',
      'anthropic-api-base: https://api.anthropic.com',
    ].join('\n')))
    const openai = res.providers.find((p) => p.sourceId === 'aider::openai')
    expect(openai?.isCurrent).toBe(true)
  })
  it('YAML 引号格式', async () => {
    const res = await parseAider(makeText('openai-api-key: "sk-quoted"\nopenai-api-base: "https://api.openai.com/v1"'))
    expect(res.providers[0]!.apiKey).toBe('sk-quoted')
  })
})
