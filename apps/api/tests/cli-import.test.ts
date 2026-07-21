/**
 * cli-import 单元测试
 *
 * 覆盖:
 * - mapper:inferProviderCode / deduplicateName / normalizeProvider / sanitizeProviderName
 * - parser 6 个(除 cc-switch-sqlite,需 SQLite buffer,留 e2e)
 * - detector:detectSources 返回结构(不依赖真实文件存在)
 */
import { describe, it, expect, vi } from 'vitest'

// 屏蔽 redis-cache 的 ioredis 引入(测试不依赖 Redis)
vi.mock('../src/config/index.js', () => ({
  config: {
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
    REDIS_URL: 'redis://localhost:6379',
  },
}))

import {
  inferProviderCode,
  deduplicateName,
  normalizeProvider,
  sanitizeProviderName,
} from '../src/services/cli-import/mapper.js'
import { parseCcSwitchJson } from '../src/services/cli-import/parsers/cc-switch-json.js'
import { parseCodexPlus } from '../src/services/cli-import/parsers/codex-plus.js'
import { parseClaudeCli } from '../src/services/cli-import/parsers/claude-cli.js'
import { parseCodexCli } from '../src/services/cli-import/parsers/codex-cli.js'
import { parseGeminiCli } from '../src/services/cli-import/parsers/gemini-cli.js'
import { parseHermes } from '../src/services/cli-import/parsers/hermes.js'
import { detectSources, getExpectedPaths } from '../src/services/cli-import/detector.js'

// =============================================================================
// mapper
// =============================================================================

describe('cli-import/mapper', () => {
  describe('inferProviderCode', () => {
    it('按 baseUrl 域名匹配 common providers', () => {
      expect(inferProviderCode('https://api.anthropic.com', 'anthropic_messages')).toBe('anthropic')
      expect(inferProviderCode('https://api.openai.com/v1', 'openai_chat')).toBe('openai')
      expect(inferProviderCode('https://generativelanguage.googleapis.com', 'gemini_native')).toBe(
        'google',
      )
      expect(inferProviderCode('https://api.deepseek.com', 'openai_chat')).toBe('deepseek')
      expect(inferProviderCode('https://api.moonshot.cn/v1', 'openai_chat')).toBe('moonshot')
      expect(inferProviderCode('https://open.bigmodel.cn/api/paas/v4', 'openai_chat')).toBe('zhipu')
      expect(
        inferProviderCode('https://dashscope.aliyuncs.com/compatible-mode/v1', 'openai_chat'),
      ).toBe('alibaba')
      expect(
        inferProviderCode('https://aip.baidubce.com/rpc/2.0/ai_custom/v1', 'openai_chat'),
      ).toBe('baidu')
      expect(inferProviderCode('https://ark.cn-beijing.volces.com/api/v3', 'openai_chat')).toBe(
        'bytedance',
      )
    })

    it('localhost / 127.0.0.1 → local', () => {
      expect(inferProviderCode('http://127.0.0.1:11434/v1', 'openai_chat')).toBe('local')
      expect(inferProviderCode('http://localhost:8080', 'openai_chat')).toBe('local')
    })

    it('模型名兜底:baseUrl 未知但 model 前缀命中', () => {
      expect(inferProviderCode('https://example.com', 'openai_chat', 'claude-sonnet-4')).toBe(
        'anthropic',
      )
      expect(inferProviderCode('https://example.com', 'openai_chat', 'gpt-4o')).toBe('openai')
      expect(inferProviderCode('https://example.com', 'openai_chat', 'gemini-2.0-flash')).toBe(
        'google',
      )
      expect(inferProviderCode('https://example.com', 'openai_chat', 'glm-4-plus')).toBe('zhipu')
    })

    it('全部不匹配 → custom', () => {
      expect(inferProviderCode('https://unknown.example.com', 'openai_chat', 'unknown-model')).toBe(
        'custom',
      )
    })
  })

  describe('deduplicateName', () => {
    it('multi app_type 加后缀', () => {
      expect(deduplicateName('OpenAI', 'claude')).toBe('OpenAI (claude)')
      expect(deduplicateName('OpenAI', 'codex')).toBe('OpenAI (codex)')
      expect(deduplicateName('OpenAI', 'gemini')).toBe('OpenAI (gemini)')
      expect(deduplicateName('OpenAI', 'hermes')).toBe('OpenAI (hermes)')
    })

    it('其他 app_type 不加后缀', () => {
      expect(deduplicateName('OpenAI', 'claude-desktop')).toBe('OpenAI')
      expect(deduplicateName('OpenAI', 'opencode')).toBe('OpenAI')
    })

    it('无 app_type 不加后缀', () => {
      expect(deduplicateName('OpenAI', undefined)).toBe('OpenAI')
    })
  })

  describe('normalizeProvider', () => {
    it('baseUrl 为空 → 加 warning', () => {
      const p = normalizeProvider({
        sourceId: 'x',
        name: 'X',
        providerCode: 'custom',
        baseUrl: '',
        apiKey: 'k',
        apiFormat: 'openai_chat',
        isCurrent: false,
        warnings: [],
      })
      expect(p.warnings).toContain('baseUrl 为空,需手动补全')
    })

    it('apiKey 为空 → 加 warning', () => {
      const p = normalizeProvider({
        sourceId: 'x',
        name: 'X',
        providerCode: 'custom',
        baseUrl: 'https://x.com',
        apiKey: undefined,
        apiFormat: 'openai_chat',
        isCurrent: false,
        warnings: [],
      })
      expect(p.warnings).toContain('apiKey 为空,需手动补全')
    })

    it('apiFormat 非法 → fallback openai_chat', () => {
      const p = normalizeProvider({
        sourceId: 'x',
        name: 'X',
        providerCode: 'custom',
        baseUrl: 'https://x.com',
        apiKey: 'k',
        apiFormat: 'invalid_format' as never,
        isCurrent: false,
        warnings: [],
      })
      expect(p.apiFormat).toBe('openai_chat')
    })
  })

  describe('sanitizeProviderName', () => {
    it('HTML 转义 + slice 100', () => {
      expect(sanitizeProviderName('<script>')).toBe('&lt;script&gt;')
      expect(sanitizeProviderName('"quoted"')).toBe('&quot;quoted&quot;')
      expect(sanitizeProviderName(`it's`)).toBe(`it&#39;s`)
      const long = 'a'.repeat(150)
      expect(sanitizeProviderName(long).length).toBe(100)
    })

    it('trim 空白', () => {
      expect(sanitizeProviderName('  OpenAI  ')).toBe('OpenAI')
    })
  })
})

// =============================================================================
// cc-switch-json parser
// =============================================================================

describe('parser/cc-switch-json', () => {
  it('解析包含 2 个 provider 的合法 JSON', () => {
    const json = JSON.stringify({
      schemaVersion: 15,
      version: 'v3.17.0',
      providers: [
        {
          id: 'p1',
          appType: 'claude',
          name: 'Anthropic',
          settingsConfig: {
            apiBaseUrl: 'https://api.anthropic.com',
            apiKey: 'sk-ant-xxx',
            model: 'claude-sonnet-4-5',
            apiFormat: 'anthropic_messages',
          },
          isCurrent: true,
          category: 'Claude',
          websiteUrl: 'https://anthropic.com',
        },
        {
          id: 'p2',
          appType: 'codex',
          name: 'OpenAI',
          settingsConfig: {
            apiBaseUrl: 'https://api.openai.com/v1',
            apiKey: 'sk-xxx',
            model: 'gpt-5',
            apiFormat: 'openai_chat',
          },
          isCurrent: false,
        },
      ],
    })
    const result = parseCcSwitchJson({ text: json, sourcePath: 'config.json' })
    expect(result.providers).toHaveLength(2)
    expect(result.sourceVersion).toBe('v3.17.0')
    expect(result.sourceSchemaVersion).toBe(15)

    const p1 = result.providers[0]!
    expect(p1.sourceId).toBe('p1')
    expect(p1.sourceAppType).toBe('claude')
    expect(p1.name).toBe('Anthropic (claude)')
    expect(p1.providerCode).toBe('anthropic')
    expect(p1.baseUrl).toBe('https://api.anthropic.com')
    expect(p1.apiKey).toBe('sk-ant-xxx')
    expect(p1.apiFormat).toBe('anthropic_messages')
    expect(p1.isCurrent).toBe(true)

    const p2 = result.providers[1]!
    expect(p2.sourceAppType).toBe('codex')
    expect(p2.name).toBe('OpenAI (codex)')
    expect(p2.providerCode).toBe('openai')
    expect(p2.isCurrent).toBe(false)
  })

  it('空 providers 数组 → 返回空列表,无 warning', () => {
    const result = parseCcSwitchJson({
      text: '{"schemaVersion":15,"providers":[]}',
      sourcePath: 'x.json',
    })
    expect(result.providers).toEqual([])
    expect(result.globalWarnings).toEqual([])
  })

  it('providers 字段缺失 → 返回空 + warning', () => {
    const result = parseCcSwitchJson({
      text: '{"schemaVersion":15}',
      sourcePath: 'x.json',
    })
    expect(result.providers).toEqual([])
    expect(result.globalWarnings[0]).toMatch(/未找到 providers/)
  })

  it('JSON 解析失败 → throw', () => {
    expect(() => parseCcSwitchJson({ text: '{invalid', sourcePath: 'x.json' })).toThrow(/解析失败/)
  })

  it('settingsConfig 缺失字段 → provider 仍生成,baseUrl 为空 + warning', () => {
    const json = JSON.stringify({
      providers: [{ id: 'p1', appType: 'claude', name: 'Empty' }],
    })
    const result = parseCcSwitchJson({ text: json, sourcePath: 'x.json' })
    expect(result.providers).toHaveLength(1)
    expect(result.providers[0]!.baseUrl).toBe('')
    expect(result.providers[0]!.warnings.length).toBeGreaterThan(0)
  })
})

// =============================================================================
// codex++ parser
// =============================================================================

describe('parser/codex-plus', () => {
  it('解析 profiles,标记 skip_serializing 的 apiKey 缺失', () => {
    const json = JSON.stringify({
      appVersion: 'v1.2.39',
      activeProfileId: 'prof-1',
      relayMode: 'pureApi',
      protocol: 'chatCompletions',
      profiles: [
        {
          id: 'prof-1',
          name: 'Active',
          apiBaseUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-active',
          model: 'gpt-5',
          isActive: true,
        },
        {
          id: 'prof-2',
          name: 'Inactive',
          apiBaseUrl: 'https://api.other.com/v1',
          apiKey: null,
          model: 'other-model',
          isActive: false,
        },
      ],
    })
    const result = parseCodexPlus({ text: json, sourcePath: 'settings.json' })
    expect(result.providers).toHaveLength(2)
    expect(result.sourceVersion).toBe('v1.2.39')

    const p1 = result.providers[0]!
    expect(p1.sourceId).toBe('prof-1')
    expect(p1.apiKey).toBe('sk-active')
    expect(p1.isCurrent).toBe(true)
    expect(p1.apiFormat).toBe('openai_chat') // chatCompletions
    expect(p1.meta?.relayMode).toBe('pureApi')

    const p2 = result.providers[1]!
    expect(p2.apiKey).toBeUndefined()
    expect(p2.warnings).toContain('apiKey 缺失(可能是 codex++ skip_serializing 导致)')
    expect(p2.isCurrent).toBe(false)
  })
})

// =============================================================================
// claude-cli parser
// =============================================================================

describe('parser/claude-cli', () => {
  it('解析 env 字段,优先 AUTH_TOKEN', () => {
    const json = JSON.stringify({
      env: {
        ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
        ANTHROPIC_AUTH_TOKEN: 'sk-ant-auth',
        ANTHROPIC_API_KEY: 'sk-ant-key',
        ANTHROPIC_MODEL: 'claude-sonnet-4-5',
      },
      model: 'claude-sonnet-4-5',
      mcpServers: {
        fs: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem'] },
      },
    })
    const result = parseClaudeCli({ text: json, sourcePath: 'settings.json' })
    expect(result.providers).toHaveLength(1)
    const p = result.providers[0]!
    expect(p.apiKey).toBe('sk-ant-auth')
    expect(p.apiFormat).toBe('anthropic_messages')
    expect(p.providerCode).toBe('anthropic')
    expect(p.isCurrent).toBe(true)
    expect(result.mcpServers).toBeDefined()
    expect(result.mcpServers).toHaveLength(1)
    expect(result.mcpServers![0]!.name).toBe('fs')
    expect(result.mcpServers![0]!.enabledApps).toEqual(['claude'])
  })

  it('apiKey 缺失 → warning,不阻断', () => {
    const json = JSON.stringify({
      env: { ANTHROPIC_BASE_URL: 'https://api.anthropic.com' },
    })
    const result = parseClaudeCli({ text: json, sourcePath: 's.json' })
    expect(result.providers[0]!.apiKey).toBeUndefined()
    expect(result.providers[0]!.warnings.length).toBeGreaterThan(0)
  })
})

// =============================================================================
// codex-cli parser
// =============================================================================

describe('parser/codex-cli', () => {
  it('解析 config.toml + auth.json', () => {
    const toml = `
model = "gpt-5"
model_provider = "openai"

[model_providers.openai]
name = "OpenAI"
base_url = "https://api.openai.com/v1"
wire_api = "responses"
env_key = "OPENAI_API_KEY"

[model_providers.custom]
name = "Custom"
base_url = "https://api.example.com/v1"
wire_api = "chat"
env_key = "CUSTOM_API_KEY"
`
    const authJson = JSON.stringify({
      OPENAI_API_KEY: 'sk-openai',
      CUSTOM_API_KEY: 'sk-custom',
    })
    const result = parseCodexCli({
      text: toml,
      sourcePath: 'config.toml',
      extra: { authJsonText: authJson },
    })
    expect(result.providers).toHaveLength(2)

    const p1 = result.providers.find((p) => p.sourceId === 'codex-cli::openai')!
    expect(p1.baseUrl).toBe('https://api.openai.com/v1')
    expect(p1.apiKey).toBe('sk-openai')
    expect(p1.apiFormat).toBe('openai_responses')
    expect(p1.isCurrent).toBe(true)

    const p2 = result.providers.find((p) => p.sourceId === 'codex-cli::custom')!
    expect(p2.apiKey).toBe('sk-custom')
    expect(p2.apiFormat).toBe('openai_chat')
    expect(p2.isCurrent).toBe(false)
  })

  it('无 auth.json → 所有 apiKey 空 + global warning', () => {
    const toml = `
[model_providers.openai]
name = "OpenAI"
base_url = "https://api.openai.com/v1"
`
    const result = parseCodexCli({ text: toml, sourcePath: 'config.toml' })
    expect(result.providers).toHaveLength(1)
    expect(result.providers[0]!.apiKey).toBeUndefined()
    expect(result.globalWarnings.some((w) => w.includes('auth.json'))).toBe(true)
  })
})

// =============================================================================
// gemini-cli parser
// =============================================================================

describe('parser/gemini-cli', () => {
  it('解析 .env + settings.json,GEMINI_API_KEY 模式', () => {
    const env = `# Gemini CLI
GEMINI_API_KEY=AIzaSyXXX
GOOGLE_GENAI_USE_VERTEXAI=false
`
    const settingsJson = JSON.stringify({ model: 'gemini-2.0-flash' })
    const result = parseGeminiCli({
      text: env,
      sourcePath: '.env',
      extra: { settingsJsonText: settingsJson },
    })
    expect(result.providers).toHaveLength(1)
    const p = result.providers[0]!
    expect(p.apiKey).toBe('AIzaSyXXX')
    expect(p.apiFormat).toBe('gemini_native')
    expect(p.providerCode).toBe('google')
    expect(p.modelIdForTest).toBe('gemini-2.0-flash')
    expect(p.isCurrent).toBe(true)
  })

  it('Vertex AI 模式 → baseUrl 指向 aiplatform', () => {
    const env = `GOOGLE_GENAI_USE_VERTEXAI=true
GOOGLE_CLOUD_PROJECT=my-proj
GOOGLE_CLOUD_LOCATION=us-central1
`
    const result = parseGeminiCli({ text: env, sourcePath: '.env' })
    expect(result.providers[0]!.baseUrl).toBe('https://us-central1-aiplatform.googleapis.com')
    expect(result.providers[0]!.apiKey).toBeUndefined()
  })

  it('.env 中带引号 → 去引号', () => {
    const env = `GEMINI_API_KEY="AIzaSyYYY"`
    const result = parseGeminiCli({ text: env, sourcePath: '.env' })
    expect(result.providers[0]!.apiKey).toBe('AIzaSyYYY')
  })
})

// =============================================================================
// hermes parser
// =============================================================================

describe('parser/hermes', () => {
  it('解析 YAML 多 provider', () => {
    const yaml = `
default_provider: openai
custom_providers:
  - id: h1
    name: OpenAI
    api_base_url: https://api.openai.com/v1
    api_key: sk-openai
    model: gpt-4o
    api_format: openai_chat
    is_active: true
  - id: h2
    name: Anthropic
    api_base_url: https://api.anthropic.com
    api_key: sk-ant
    model: claude-sonnet-4-5
    api_format: anthropic_messages
    is_active: false
`
    const result = parseHermes({ text: yaml, sourcePath: 'config.yaml' })
    expect(result.providers).toHaveLength(2)
    const p1 = result.providers.find((p) => p.sourceId === 'h1')!
    expect(p1.isCurrent).toBe(true)
    expect(p1.providerCode).toBe('openai')
    const p2 = result.providers.find((p) => p.sourceId === 'h2')!
    expect(p2.isCurrent).toBe(false)
    expect(p2.providerCode).toBe('anthropic')
    expect(p2.apiFormat).toBe('anthropic_messages')
  })

  it('空 custom_providers → warning', () => {
    const result = parseHermes({ text: 'custom_providers: []', sourcePath: 'c.yaml' })
    expect(result.providers).toEqual([])
    expect(result.globalWarnings[0]).toMatch(/custom_providers/)
  })
})

// =============================================================================
// detector
// =============================================================================

describe('detector', () => {
  it('detectSources 返回所有已知来源', () => {
    const sources = detectSources()
    // 至少覆盖 cc-switch / codex++ / claude-cli / codex-cli / gemini-cli / hermes
    const sourceTypes = new Set(sources.map((s) => s.source))
    expect(sourceTypes.has('cc-switch')).toBe(true)
    expect(sourceTypes.has('codex++')).toBe(true)
    expect(sourceTypes.has('claude-cli')).toBe(true)
    expect(sourceTypes.has('codex-cli')).toBe(true)
    expect(sourceTypes.has('gemini-cli')).toBe(true)
    expect(sourceTypes.has('hermes')).toBe(true)
  })

  it('getExpectedPaths 每个 source 至少返回 1 条', () => {
    expect(getExpectedPaths('cc-switch').length).toBeGreaterThan(0)
    expect(getExpectedPaths('hermes').length).toBeGreaterThan(0)
  })

  it('每条 DetectedSource 必含 path 与 exists boolean', () => {
    for (const d of detectSources()) {
      expect(typeof d.path).toBe('string')
      expect(typeof d.exists).toBe('boolean')
    }
  })
})
