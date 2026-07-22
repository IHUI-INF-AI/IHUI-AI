/**
 * cc-switch JSON parser 综合测试 — 全参数深度覆盖
 *
 * 覆盖维度:
 *   1. 基本 JSON 解析(schemaVersion + providers 数组)
 *   2. settingsConfig 字段提取(apiBaseUrl/baseUrl/apiKey/model/modelId/apiFormat)
 *   3. apiFormat 规范化(anthropic/responses/gemini/openai_chat)
 *   4. appType 校验(VALID_APP_TYPES 7 个值 + 非法值)
 *   5. deduplicateName(多 appType 加后缀)
 *   6. providerCode 推断
 *   7. 空值/异常/边界
 *   8. sourceVersion / sourceSchemaVersion 传递
 *   9. 跨 parser 不搞混(cc-switch-json ≠ sqlite)
 */
import { describe, it, expect } from 'vitest'

import type { ParserInput } from '../../src/services/cli-import/parsers/types.js'
import { parseCcSwitchJson } from '../../src/services/cli-import/parsers/cc-switch-json.js'

function makeText(text: string): ParserInput {
  return { text, sourcePath: 'test' }
}

function makeCcSwitch(obj: Record<string, unknown>): string {
  return JSON.stringify(obj)
}

describe('cc-switch-json parser — 基本 JSON 解析', () => {
  it('空输入抛异常', () => {
    expect(() => parseCcSwitchJson(makeText(''))).toThrow()
  })

  it('纯空白输入抛异常', () => {
    expect(() => parseCcSwitchJson(makeText('   \n  '))).toThrow()
  })

  it('非 JSON 输入抛异常', () => {
    expect(() => parseCcSwitchJson(makeText('{invalid'))).toThrow()
  })

  it('空对象(无 providers) → warning', () => {
    const res = parseCcSwitchJson(makeText('{}'))
    expect(res.providers).toHaveLength(0)
    expect(res.globalWarnings[0]).toContain('providers')
  })

  it('providers 为非数组 → warning', () => {
    const res = parseCcSwitchJson(makeText(makeCcSwitch({ providers: 'not array' })))
    expect(res.providers).toHaveLength(0)
    expect(res.globalWarnings[0]).toContain('providers')
  })

  it('providers 为空数组 → 0 provider', () => {
    const res = parseCcSwitchJson(makeText(makeCcSwitch({ providers: [] })))
    expect(res.providers).toHaveLength(0)
    expect(res.globalWarnings).toHaveLength(0)
  })

  it('schemaVersion + version 字段透传', () => {
    const res = parseCcSwitchJson(makeText(makeCcSwitch({
      schemaVersion: 15,
      version: 'v3.2.1',
      providers: [],
    })))
    expect(res.sourceSchemaVersion).toBe(15)
    expect(res.sourceVersion).toBe('v3.2.1')
  })
})

describe('cc-switch-json parser — settingsConfig 字段提取', () => {
  it('settingsConfig.apiBaseUrl + apiKey + model 正常提取', () => {
    const res = parseCcSwitchJson(makeText(makeCcSwitch({
      providers: [{
        id: 'p1',
        name: 'OpenAI',
        settingsConfig: {
          apiBaseUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-xxx',
          model: 'gpt-4o',
        },
      }],
    })))
    expect(res.providers).toHaveLength(1)
    expect(res.providers[0]!.baseUrl).toBe('https://api.openai.com/v1')
    expect(res.providers[0]!.apiKey).toBe('sk-xxx')
    expect(res.providers[0]!.modelIdForTest).toBe('gpt-4o')
  })

  it('baseUrl 字段也支持(apiBaseUrl 优先)', () => {
    const res = parseCcSwitchJson(makeText(makeCcSwitch({
      providers: [{
        id: 'p1',
        name: 'OpenAI',
        settingsConfig: {
          apiBaseUrl: 'https://api1.openai.com/v1',
          baseUrl: 'https://api2.openai.com/v1',
          apiKey: 'sk-xxx',
        },
      }],
    })))
    expect(res.providers[0]!.baseUrl).toBe('https://api1.openai.com/v1')
  })

  it('仅 baseUrl 字段(无 apiBaseUrl)', () => {
    const res = parseCcSwitchJson(makeText(makeCcSwitch({
      providers: [{
        id: 'p1',
        name: 'OpenAI',
        settingsConfig: {
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-xxx',
        },
      }],
    })))
    expect(res.providers[0]!.baseUrl).toBe('https://api.openai.com/v1')
  })

  it('modelId 字段也支持(model 优先)', () => {
    const res = parseCcSwitchJson(makeText(makeCcSwitch({
      providers: [{
        id: 'p1',
        name: 'OpenAI',
        settingsConfig: {
          apiKey: 'sk-xxx',
          model: 'gpt-4o',
          modelId: 'gpt-4-turbo',
        },
      }],
    })))
    expect(res.providers[0]!.modelIdForTest).toBe('gpt-4o')
  })

  it('无 settingsConfig → warning(仅元信息)', () => {
    const res = parseCcSwitchJson(makeText(makeCcSwitch({
      providers: [{
        id: 'p1',
        name: 'Empty',
      }],
    })))
    expect(res.providers).toHaveLength(1)
    expect(res.providers[0]!.baseUrl).toBe('')
    // normalizeProvider 会把空 baseUrl 标 warning
    expect(res.providers[0]!.warnings.length).toBeGreaterThan(0)
  })

  it('provider.id 作为 sourceId', () => {
    const res = parseCcSwitchJson(makeText(makeCcSwitch({
      providers: [{
        id: 'custom-id-123',
        name: 'OpenAI',
        settingsConfig: { apiKey: 'sk-xxx', apiBaseUrl: 'https://api.openai.com/v1' },
      }],
    })))
    expect(res.providers[0]!.sourceId).toBe('custom-id-123')
  })

  it('provider.name 缺失时用 id 作为 name', () => {
    const res = parseCcSwitchJson(makeText(makeCcSwitch({
      providers: [{
        id: 'fallback-id',
        settingsConfig: { apiKey: 'sk-xxx', apiBaseUrl: 'https://api.openai.com/v1' },
      }],
    })))
    expect(res.providers[0]!.name).toBe('fallback-id')
  })

  it('name + id 都缺失 → unnamed', () => {
    const res = parseCcSwitchJson(makeText(makeCcSwitch({
      providers: [{
        settingsConfig: { apiKey: 'sk-xxx', apiBaseUrl: 'https://api.openai.com/v1' },
      }],
    })))
    expect(res.providers[0]!.name).toBe('unnamed')
  })
})

describe('cc-switch-json parser — apiFormat 规范化', () => {
  it('apiFormat="anthropic" → anthropic_messages', () => {
    const res = parseCcSwitchJson(makeText(makeCcSwitch({
      providers: [{
        id: 'p1', name: 'Anthropic',
        settingsConfig: { apiFormat: 'anthropic', apiBaseUrl: 'https://api.anthropic.com', apiKey: 'sk-xxx' },
      }],
    })))
    expect(res.providers[0]!.apiFormat).toBe('anthropic_messages')
  })

  it('apiFormat="anthropic_messages" → anthropic_messages', () => {
    const res = parseCcSwitchJson(makeText(makeCcSwitch({
      providers: [{
        id: 'p1', name: 'Anthropic',
        settingsConfig: { apiFormat: 'anthropic_messages', apiBaseUrl: 'https://api.anthropic.com', apiKey: 'sk-xxx' },
      }],
    })))
    expect(res.providers[0]!.apiFormat).toBe('anthropic_messages')
  })

  it('apiFormat="responses" → openai_responses', () => {
    const res = parseCcSwitchJson(makeText(makeCcSwitch({
      providers: [{
        id: 'p1', name: 'Codex',
        settingsConfig: { apiFormat: 'responses', apiBaseUrl: 'https://api.openai.com/v1', apiKey: 'sk-xxx' },
      }],
    })))
    expect(res.providers[0]!.apiFormat).toBe('openai_responses')
  })

  it('apiFormat="openai_responses" → openai_responses', () => {
    const res = parseCcSwitchJson(makeText(makeCcSwitch({
      providers: [{
        id: 'p1', name: 'Codex',
        settingsConfig: { apiFormat: 'openai_responses', apiBaseUrl: 'https://api.openai.com/v1', apiKey: 'sk-xxx' },
      }],
    })))
    expect(res.providers[0]!.apiFormat).toBe('openai_responses')
  })

  it('apiFormat="gemini" → gemini_native', () => {
    const res = parseCcSwitchJson(makeText(makeCcSwitch({
      providers: [{
        id: 'p1', name: 'Gemini',
        settingsConfig: { apiFormat: 'gemini', apiBaseUrl: 'https://generativelanguage.googleapis.com', apiKey: 'AIza-xxx' },
      }],
    })))
    expect(res.providers[0]!.apiFormat).toBe('gemini_native')
  })

  it('apiFormat="gemini_native" → gemini_native', () => {
    const res = parseCcSwitchJson(makeText(makeCcSwitch({
      providers: [{
        id: 'p1', name: 'Gemini',
        settingsConfig: { apiFormat: 'gemini_native', apiBaseUrl: 'https://generativelanguage.googleapis.com', apiKey: 'AIza-xxx' },
      }],
    })))
    expect(res.providers[0]!.apiFormat).toBe('gemini_native')
  })

  it('apiFormat 大写不敏感(ANTHROPIC → anthropic_messages)', () => {
    const res = parseCcSwitchJson(makeText(makeCcSwitch({
      providers: [{
        id: 'p1', name: 'Anthropic',
        settingsConfig: { apiFormat: 'ANTHROPIC', apiBaseUrl: 'https://api.anthropic.com', apiKey: 'sk-xxx' },
      }],
    })))
    expect(res.providers[0]!.apiFormat).toBe('anthropic_messages')
  })

  it('apiFormat 缺失 → openai_chat(默认)', () => {
    const res = parseCcSwitchJson(makeText(makeCcSwitch({
      providers: [{
        id: 'p1', name: 'OpenAI',
        settingsConfig: { apiBaseUrl: 'https://api.openai.com/v1', apiKey: 'sk-xxx' },
      }],
    })))
    expect(res.providers[0]!.apiFormat).toBe('openai_chat')
  })

  it('apiFormat=未知值 → openai_chat(默认)', () => {
    const res = parseCcSwitchJson(makeText(makeCcSwitch({
      providers: [{
        id: 'p1', name: 'Unknown',
        settingsConfig: { apiFormat: 'some_unknown_format', apiBaseUrl: 'https://api.openai.com/v1', apiKey: 'sk-xxx' },
      }],
    })))
    expect(res.providers[0]!.apiFormat).toBe('openai_chat')
  })
})

describe('cc-switch-json parser — appType 校验', () => {
  const validAppTypes = ['claude', 'claude-desktop', 'codex', 'gemini', 'opencode', 'openclaw', 'hermes']

  for (const appType of validAppTypes) {
    it(`appType="${appType}" 有效 → sourceAppType 透传`, () => {
      const res = parseCcSwitchJson(makeText(makeCcSwitch({
        providers: [{
          id: 'p1', name: 'X', appType,
          settingsConfig: { apiBaseUrl: 'https://api.openai.com/v1', apiKey: 'sk-xxx' },
        }],
      })))
      expect(res.providers[0]!.sourceAppType).toBe(appType)
    })
  }

  it('appType=非法值 → sourceAppType undefined', () => {
    const res = parseCcSwitchJson(makeText(makeCcSwitch({
      providers: [{
        id: 'p1', name: 'X', appType: 'invalid-type',
        settingsConfig: { apiBaseUrl: 'https://api.openai.com/v1', apiKey: 'sk-xxx' },
      }],
    })))
    expect(res.providers[0]!.sourceAppType).toBeUndefined()
  })

  it('appType 缺失 → sourceAppType undefined', () => {
    const res = parseCcSwitchJson(makeText(makeCcSwitch({
      providers: [{
        id: 'p1', name: 'X',
        settingsConfig: { apiBaseUrl: 'https://api.openai.com/v1', apiKey: 'sk-xxx' },
      }],
    })))
    expect(res.providers[0]!.sourceAppType).toBeUndefined()
  })
})

describe('cc-switch-json parser — deduplicateName(多 appType 加后缀)', () => {
  it('appType=claude → name 加 "(claude)" 后缀', () => {
    const res = parseCcSwitchJson(makeText(makeCcSwitch({
      providers: [{
        id: 'p1', name: 'OpenAI', appType: 'claude',
        settingsConfig: { apiBaseUrl: 'https://api.openai.com/v1', apiKey: 'sk-xxx' },
      }],
    })))
    expect(res.providers[0]!.name).toBe('OpenAI (claude)')
  })

  it('appType=codex → name 加 "(codex)" 后缀', () => {
    const res = parseCcSwitchJson(makeText(makeCcSwitch({
      providers: [{
        id: 'p1', name: 'OpenAI', appType: 'codex',
        settingsConfig: { apiBaseUrl: 'https://api.openai.com/v1', apiKey: 'sk-xxx' },
      }],
    })))
    expect(res.providers[0]!.name).toBe('OpenAI (codex)')
  })

  it('appType=gemini → name 加 "(gemini)" 后缀', () => {
    const res = parseCcSwitchJson(makeText(makeCcSwitch({
      providers: [{
        id: 'p1', name: 'OpenAI', appType: 'gemini',
        settingsConfig: { apiBaseUrl: 'https://api.openai.com/v1', apiKey: 'sk-xxx' },
      }],
    })))
    expect(res.providers[0]!.name).toBe('OpenAI (gemini)')
  })

  it('appType=hermes → name 加 "(hermes)" 后缀', () => {
    const res = parseCcSwitchJson(makeText(makeCcSwitch({
      providers: [{
        id: 'p1', name: 'OpenAI', appType: 'hermes',
        settingsConfig: { apiBaseUrl: 'https://api.openai.com/v1', apiKey: 'sk-xxx' },
      }],
    })))
    expect(res.providers[0]!.name).toBe('OpenAI (hermes)')
  })

  it('appType=opencode → 不加后缀(非 multiAppTypes)', () => {
    // opencode 不在 multiAppTypes: ['claude', 'codex', 'gemini', 'hermes']
    const res = parseCcSwitchJson(makeText(makeCcSwitch({
      providers: [{
        id: 'p1', name: 'OpenAI', appType: 'opencode',
        settingsConfig: { apiBaseUrl: 'https://api.openai.com/v1', apiKey: 'sk-xxx' },
      }],
    })))
    expect(res.providers[0]!.name).toBe('OpenAI')
  })

  it('appType=openclaw → 不加后缀(非 multiAppTypes)', () => {
    const res = parseCcSwitchJson(makeText(makeCcSwitch({
      providers: [{
        id: 'p1', name: 'OpenAI', appType: 'openclaw',
        settingsConfig: { apiBaseUrl: 'https://api.openai.com/v1', apiKey: 'sk-xxx' },
      }],
    })))
    expect(res.providers[0]!.name).toBe('OpenAI')
  })

  it('appType=claude-desktop → 不加后缀(非 multiAppTypes)', () => {
    const res = parseCcSwitchJson(makeText(makeCcSwitch({
      providers: [{
        id: 'p1', name: 'OpenAI', appType: 'claude-desktop',
        settingsConfig: { apiBaseUrl: 'https://api.openai.com/v1', apiKey: 'sk-xxx' },
      }],
    })))
    expect(res.providers[0]!.name).toBe('OpenAI')
  })

  it('无 appType → 不加后缀', () => {
    const res = parseCcSwitchJson(makeText(makeCcSwitch({
      providers: [{
        id: 'p1', name: 'OpenAI',
        settingsConfig: { apiBaseUrl: 'https://api.openai.com/v1', apiKey: 'sk-xxx' },
      }],
    })))
    expect(res.providers[0]!.name).toBe('OpenAI')
  })
})

describe('cc-switch-json parser — providerCode 推断', () => {
  it('baseUrl=api.openai.com + model=gpt-4 → providerCode=openai', () => {
    const res = parseCcSwitchJson(makeText(makeCcSwitch({
      providers: [{
        id: 'p1', name: 'OpenAI',
        settingsConfig: { apiBaseUrl: 'https://api.openai.com/v1', apiKey: 'sk-xxx', model: 'gpt-4' },
      }],
    })))
    expect(res.providers[0]!.providerCode).toBe('openai')
  })

  it('baseUrl=api.anthropic.com + model=claude-3 → providerCode=anthropic', () => {
    const res = parseCcSwitchJson(makeText(makeCcSwitch({
      providers: [{
        id: 'p1', name: 'Anthropic',
        settingsConfig: { apiBaseUrl: 'https://api.anthropic.com', apiKey: 'sk-ant-xxx', model: 'claude-3-opus' },
      }],
    })))
    expect(res.providers[0]!.providerCode).toBe('anthropic')
  })

  it('baseUrl=googleapis + model=gemini- → providerCode=google', () => {
    const res = parseCcSwitchJson(makeText(makeCcSwitch({
      providers: [{
        id: 'p1', name: 'Google',
        settingsConfig: { apiBaseUrl: 'https://generativelanguage.googleapis.com', apiKey: 'AIza-xxx', model: 'gemini-1.5-pro' },
      }],
    })))
    expect(res.providers[0]!.providerCode).toBe('google')
  })

  it('model=deepseek-coder 优先于 baseUrl → providerCode=deepseek', () => {
    const res = parseCcSwitchJson(makeText(makeCcSwitch({
      providers: [{
        id: 'p1', name: 'DeepSeek',
        settingsConfig: { apiBaseUrl: 'https://api.openai.com/v1', apiKey: 'sk-xxx', model: 'deepseek-coder' },
      }],
    })))
    expect(res.providers[0]!.providerCode).toBe('deepseek')
  })

  it('无 model + baseUrl=api.deepseek.com → providerCode=deepseek', () => {
    const res = parseCcSwitchJson(makeText(makeCcSwitch({
      providers: [{
        id: 'p1', name: 'DeepSeek',
        settingsConfig: { apiBaseUrl: 'https://api.deepseek.com', apiKey: 'sk-xxx' },
      }],
    })))
    expect(res.providers[0]!.providerCode).toBe('deepseek')
  })
})

describe('cc-switch-json parser — isCurrent + meta 验证', () => {
  it('isCurrent=true 透传', () => {
    const res = parseCcSwitchJson(makeText(makeCcSwitch({
      providers: [{
        id: 'p1', name: 'X', isCurrent: true,
        settingsConfig: { apiBaseUrl: 'https://api.openai.com/v1', apiKey: 'sk-xxx' },
      }],
    })))
    expect(res.providers[0]!.isCurrent).toBe(true)
  })

  it('isCurrent=false 透传', () => {
    const res = parseCcSwitchJson(makeText(makeCcSwitch({
      providers: [{
        id: 'p1', name: 'X', isCurrent: false,
        settingsConfig: { apiBaseUrl: 'https://api.openai.com/v1', apiKey: 'sk-xxx' },
      }],
    })))
    expect(res.providers[0]!.isCurrent).toBe(false)
  })

  it('isCurrent 缺失 → false', () => {
    const res = parseCcSwitchJson(makeText(makeCcSwitch({
      providers: [{
        id: 'p1', name: 'X',
        settingsConfig: { apiBaseUrl: 'https://api.openai.com/v1', apiKey: 'sk-xxx' },
      }],
    })))
    expect(res.providers[0]!.isCurrent).toBe(false)
  })

  it('meta 从 provider 顶层字段读取', () => {
    const res = parseCcSwitchJson(makeText(makeCcSwitch({
      providers: [{
        id: 'p1', name: 'X',
        category: 'Official', websiteUrl: 'https://openai.com', icon: 'openai', iconColor: '#10a37f',
        settingsConfig: { apiBaseUrl: 'https://api.openai.com/v1', apiKey: 'sk-xxx' },
      }],
    })))
    expect(res.providers[0]!.meta.category).toBe('Official')
    expect(res.providers[0]!.meta.websiteUrl).toBe('https://openai.com')
    expect(res.providers[0]!.meta.icon).toBe('openai')
    expect(res.providers[0]!.meta.iconColor).toBe('#10a37f')
  })

  it('meta 从 settingsConfig 兜底(provider 顶层缺失时)', () => {
    const res = parseCcSwitchJson(makeText(makeCcSwitch({
      providers: [{
        id: 'p1', name: 'X',
        settingsConfig: {
          apiBaseUrl: 'https://api.openai.com/v1', apiKey: 'sk-xxx',
          category: 'FromSettings', websiteUrl: 'https://from-settings.com',
        },
      }],
    })))
    expect(res.providers[0]!.meta.category).toBe('FromSettings')
    expect(res.providers[0]!.meta.websiteUrl).toBe('https://from-settings.com')
  })

  it('provider 顶层优先于 settingsConfig', () => {
    const res = parseCcSwitchJson(makeText(makeCcSwitch({
      providers: [{
        id: 'p1', name: 'X',
        category: 'FromProvider',
        settingsConfig: {
          apiBaseUrl: 'https://api.openai.com/v1', apiKey: 'sk-xxx',
          category: 'FromSettings',
        },
      }],
    })))
    expect(res.providers[0]!.meta.category).toBe('FromProvider')
  })

  it('有 model 时 meta.models=[model]', () => {
    const res = parseCcSwitchJson(makeText(makeCcSwitch({
      providers: [{
        id: 'p1', name: 'X',
        settingsConfig: { apiBaseUrl: 'https://api.openai.com/v1', apiKey: 'sk-xxx', model: 'gpt-4o' },
      }],
    })))
    expect(res.providers[0]!.meta.models).toEqual(['gpt-4o'])
  })

  it('无 model 时 meta.models=undefined', () => {
    const res = parseCcSwitchJson(makeText(makeCcSwitch({
      providers: [{
        id: 'p1', name: 'X',
        settingsConfig: { apiBaseUrl: 'https://api.openai.com/v1', apiKey: 'sk-xxx' },
      }],
    })))
    expect(res.providers[0]!.meta.models).toBeUndefined()
  })
})

describe('cc-switch-json parser — 多 provider + XSS 清洗', () => {
  it('多 provider 同时解析', () => {
    const res = parseCcSwitchJson(makeText(makeCcSwitch({
      providers: [
        { id: 'p1', name: 'OpenAI', settingsConfig: { apiBaseUrl: 'https://api.openai.com/v1', apiKey: 'sk-a' } },
        { id: 'p2', name: 'Anthropic', settingsConfig: { apiBaseUrl: 'https://api.anthropic.com', apiKey: 'sk-b' } },
        { id: 'p3', name: 'Google', settingsConfig: { apiBaseUrl: 'https://generativelanguage.googleapis.com', apiKey: 'AIza-c' } },
      ],
    })))
    expect(res.providers).toHaveLength(3)
  })

  it('name 含 HTML 标签被清洗', () => {
    const res = parseCcSwitchJson(makeText(makeCcSwitch({
      providers: [{
        id: 'p1', name: '<script>alert(1)</script>',
        settingsConfig: { apiBaseUrl: 'https://api.openai.com/v1', apiKey: 'sk-xxx' },
      }],
    })))
    expect(res.providers[0]!.name).not.toContain('<script>')
    expect(res.providers[0]!.name).toContain('&lt;script&gt;')
  })

  it('单个 provider 解析失败不影响其他 provider', () => {
    // p=null 触发 try/catch(null.settingsConfig 抛 TypeError)
    const res = parseCcSwitchJson(makeText(makeCcSwitch({
      providers: [
        { id: 'p1', name: 'OK', settingsConfig: { apiBaseUrl: 'https://api.openai.com/v1', apiKey: 'sk-xxx' } },
        null as unknown as Record<string, unknown>,
      ],
    })))
    // 第一个成功,第二个失败 → warnings
    expect(res.providers.length).toBeGreaterThanOrEqual(1)
    expect(res.globalWarnings.length).toBeGreaterThan(0)
  })
})
