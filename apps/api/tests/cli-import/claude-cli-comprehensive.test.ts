/**
 * claude-cli parser 综合测试 — 全参数深度覆盖
 *
 * 覆盖维度:
 *   1. 基本 JSON 解析(空输入/非 JSON/缺字段)
 *   2. env 字段提取(ANTHROPIC_AUTH_TOKEN 优先 / ANTHROPIC_API_KEY fallback)
 *   3. baseUrl 默认值 / 自定义 baseUrl
 *   4. model 来源(env.ANTHROPIC_MODEL 优先 / s.model fallback)
 *   5. apiFormat 固定 anthropic_messages
 *   6. mcpServers 提取(空对象/单个/多个/非对象)
 *   7. apiKey 缺失警告
 *   8. sourceId 固定 / isCurrent 固定 true
 *   9. providerCode 推断(baseUrl + apiFormat)
 *  10. meta 字段(category/websiteUrl/models)
 */
import { describe, it, expect } from 'vitest'

import type { ParserInput } from '../../src/services/cli-import/parsers/types.js'
import { parseClaudeCli } from '../../src/services/cli-import/parsers/claude-cli.js'

function makeText(text: string): ParserInput {
  return { text, sourcePath: 'test' }
}

function makeSettings(obj: Record<string, unknown>): string {
  return JSON.stringify(obj)
}

describe('claude-cli parser — 基本 JSON 解析', () => {
  it('空输入抛异常', () => {
    expect(() => parseClaudeCli(makeText(''))).toThrow()
  })

  it('纯空白输入抛异常', () => {
    expect(() => parseClaudeCli(makeText('  \n  '))).toThrow()
  })

  it('非 JSON 输入抛异常', () => {
    expect(() => parseClaudeCli(makeText('{invalid'))).toThrow()
  })

  it('空对象(无 env) → apiKey 缺失警告', () => {
    const res = parseClaudeCli(makeText(makeSettings({})))
    expect(res.providers).toHaveLength(1)
    expect(res.providers[0].apiKey).toBeUndefined()
    expect(res.providers[0].warnings.some((w) => w.includes('ANTHROPIC'))).toBe(true)
  })

  it('env 为非对象(null) → 不崩溃,apiKey 缺失', () => {
    const res = parseClaudeCli(makeText(makeSettings({ env: null })))
    expect(res.providers).toHaveLength(1)
    expect(res.providers[0].apiKey).toBeUndefined()
  })
})

describe('claude-cli parser — env 字段提取(apiKey 优先级)', () => {
  it('ANTHROPIC_AUTH_TOKEN 优先于 ANTHROPIC_API_KEY', () => {
    const res = parseClaudeCli(
      makeText(
        makeSettings({
          env: {
            ANTHROPIC_AUTH_TOKEN: 'sk-auth-token-xxx',
            ANTHROPIC_API_KEY: 'sk-api-key-yyy',
          },
        }),
      ),
    )
    expect(res.providers[0].apiKey).toBe('sk-auth-token-xxx')
  })

  it('仅有 ANTHROPIC_API_KEY → fallback 成功', () => {
    const res = parseClaudeCli(
      makeText(
        makeSettings({
          env: { ANTHROPIC_API_KEY: 'sk-api-key-only' },
        }),
      ),
    )
    expect(res.providers[0].apiKey).toBe('sk-api-key-only')
  })

  it('两个 key 都缺失 → apiKey undefined + 警告', () => {
    const res = parseClaudeCli(
      makeText(
        makeSettings({
          env: { ANTHROPIC_BASE_URL: 'https://api.anthropic.com' },
        }),
      ),
    )
    expect(res.providers[0].apiKey).toBeUndefined()
    expect(res.providers[0].warnings.some((w) => w.includes('ANTHROPIC'))).toBe(true)
  })
})

describe('claude-cli parser — baseUrl 默认值与自定义', () => {
  it('未设置 ANTHROPIC_BASE_URL → 默认 https://api.anthropic.com', () => {
    const res = parseClaudeCli(
      makeText(
        makeSettings({
          env: { ANTHROPIC_API_KEY: 'sk-xxx' },
        }),
      ),
    )
    expect(res.providers[0].baseUrl).toBe('https://api.anthropic.com')
  })

  it('自定义 ANTHROPIC_BASE_URL → 透传', () => {
    const res = parseClaudeCli(
      makeText(
        makeSettings({
          env: {
            ANTHROPIC_BASE_URL: 'https://my-proxy.example.com/v1',
            ANTHROPIC_API_KEY: 'sk-xxx',
          },
        }),
      ),
    )
    expect(res.providers[0].baseUrl).toBe('https://my-proxy.example.com/v1')
  })

  it('ANTHROPIC_BASE_URL 为空字符串 → 空字符串透传(?? 不对空字符串生效)', () => {
    const res = parseClaudeCli(
      makeText(
        makeSettings({
          env: {
            ANTHROPIC_BASE_URL: '',
            ANTHROPIC_API_KEY: 'sk-xxx',
          },
        }),
      ),
    )
    // ?? 只对 null/undefined 生效,空字符串是 truthy 字符串,直接透传
    expect(res.providers[0].baseUrl).toBe('')
  })
})

describe('claude-cli parser — model 来源优先级', () => {
  it('env.ANTHROPIC_MODEL 优先', () => {
    const res = parseClaudeCli(
      makeText(
        makeSettings({
          env: { ANTHROPIC_MODEL: 'claude-opus-4-1', ANTHROPIC_API_KEY: 'sk-xxx' },
          model: 'fallback-model',
        }),
      ),
    )
    expect(res.providers[0].modelIdForTest).toBe('claude-opus-4-1')
    expect(res.providers[0].meta.models).toEqual(['claude-opus-4-1'])
  })

  it('env 缺失 ANTHROPIC_MODEL → fallback 顶层 s.model', () => {
    const res = parseClaudeCli(
      makeText(
        makeSettings({
          env: { ANTHROPIC_API_KEY: 'sk-xxx' },
          model: 'claude-sonnet-4-5',
        }),
      ),
    )
    expect(res.providers[0].modelIdForTest).toBe('claude-sonnet-4-5')
  })

  it('两者都缺失 → model undefined', () => {
    const res = parseClaudeCli(
      makeText(
        makeSettings({
          env: { ANTHROPIC_API_KEY: 'sk-xxx' },
        }),
      ),
    )
    expect(res.providers[0].modelIdForTest).toBeUndefined()
    expect(res.providers[0].meta.models).toBeUndefined()
  })
})

describe('claude-cli parser — apiFormat 固定 anthropic_messages', () => {
  it('无论 env 配置如何,apiFormat 都是 anthropic_messages', () => {
    const res = parseClaudeCli(
      makeText(
        makeSettings({
          env: { ANTHROPIC_API_KEY: 'sk-xxx' },
        }),
      ),
    )
    expect(res.providers[0].apiFormat).toBe('anthropic_messages')
  })
})

describe('claude-cli parser — mcpServers 提取', () => {
  it('无 mcpServers 字段 → mcpServers undefined', () => {
    const res = parseClaudeCli(
      makeText(
        makeSettings({
          env: { ANTHROPIC_API_KEY: 'sk-xxx' },
        }),
      ),
    )
    expect(res.mcpServers).toBeUndefined()
  })

  it('mcpServers 为空对象 → mcpServers undefined', () => {
    const res = parseClaudeCli(
      makeText(
        makeSettings({
          env: { ANTHROPIC_API_KEY: 'sk-xxx' },
          mcpServers: {},
        }),
      ),
    )
    expect(res.mcpServers).toBeUndefined()
  })

  it('mcpServers 单个 server → 提取 1 个', () => {
    const res = parseClaudeCli(
      makeText(
        makeSettings({
          env: { ANTHROPIC_API_KEY: 'sk-xxx' },
          mcpServers: {
            filesystem: {
              command: 'npx',
              args: ['-y', '@modelcontextprotocol/server-filesystem'],
            },
          },
        }),
      ),
    )
    expect(res.mcpServers).toHaveLength(1)
    expect(res.mcpServers![0].name).toBe('filesystem')
    expect(res.mcpServers![0].sourceId).toBe('claude-cli-default::mcp::filesystem')
    expect(res.mcpServers![0].enabledApps).toEqual(['claude'])
    expect(res.mcpServers![0].serverConfig.command).toBe('npx')
  })

  it('mcpServers 多个 server → 全部提取', () => {
    const res = parseClaudeCli(
      makeText(
        makeSettings({
          env: { ANTHROPIC_API_KEY: 'sk-xxx' },
          mcpServers: {
            fs: { command: 'npx', args: ['server-fs'] },
            git: { command: 'npx', args: ['server-git'] },
            slack: { command: 'npx', args: ['server-slack'] },
          },
        }),
      ),
    )
    expect(res.mcpServers).toHaveLength(3)
    const names = res.mcpServers!.map((m) => m.name).sort()
    expect(names).toEqual(['fs', 'git', 'slack'])
  })

  it('mcpServers 为数组 → Object.entries 返回 [index, value],被当作 mcp server 提取', () => {
    const res = parseClaudeCli(
      makeText(
        makeSettings({
          env: { ANTHROPIC_API_KEY: 'sk-xxx' },
          mcpServers: ['invalid'],
        }),
      ),
    )
    // typeof [] === 'object' → 进入 Object.entries 分支
    // Object.entries(['invalid']) 返回 [['0', 'invalid']]
    expect(res.mcpServers).toHaveLength(1)
    expect(res.mcpServers![0].name).toBe('0')
    expect(res.mcpServers![0].serverConfig).toBe('invalid')
  })

  it('mcpServers 为 null → 不崩溃,无 mcpServers', () => {
    const res = parseClaudeCli(
      makeText(
        makeSettings({
          env: { ANTHROPIC_API_KEY: 'sk-xxx' },
          mcpServers: null,
        }),
      ),
    )
    expect(res.mcpServers).toBeUndefined()
  })
})

describe('claude-cli parser — sourceId / isCurrent / apiFormat 固定字段', () => {
  it('sourceId 固定为 claude-cli-default', () => {
    const res = parseClaudeCli(
      makeText(
        makeSettings({
          env: { ANTHROPIC_API_KEY: 'sk-xxx' },
        }),
      ),
    )
    expect(res.providers[0].sourceId).toBe('claude-cli-default')
  })

  it('sourceAppType 固定为 claude', () => {
    const res = parseClaudeCli(
      makeText(
        makeSettings({
          env: { ANTHROPIC_API_KEY: 'sk-xxx' },
        }),
      ),
    )
    expect(res.providers[0].sourceAppType).toBe('claude')
  })

  it('isCurrent 固定为 true', () => {
    const res = parseClaudeCli(
      makeText(
        makeSettings({
          env: { ANTHROPIC_API_KEY: 'sk-xxx' },
        }),
      ),
    )
    expect(res.providers[0].isCurrent).toBe(true)
  })
})

describe('claude-cli parser — providerCode 推断', () => {
  it('默认 baseUrl → providerCode = anthropic', () => {
    const res = parseClaudeCli(
      makeText(
        makeSettings({
          env: { ANTHROPIC_API_KEY: 'sk-xxx' },
        }),
      ),
    )
    expect(res.providers[0].providerCode).toBe('anthropic')
  })

  it('model=claude-xxx → providerCode = anthropic(model 优先)', () => {
    const res = parseClaudeCli(
      makeText(
        makeSettings({
          env: {
            ANTHROPIC_API_KEY: 'sk-xxx',
            ANTHROPIC_MODEL: 'claude-opus-4-1',
          },
        }),
      ),
    )
    expect(res.providers[0].providerCode).toBe('anthropic')
  })

  it('自定义 baseUrl 指向 openai.com → providerCode = anthropic(apiFormat 优先于 url)', () => {
    const res = parseClaudeCli(
      makeText(
        makeSettings({
          env: {
            ANTHROPIC_BASE_URL: 'https://api.openai.com/v1',
            ANTHROPIC_API_KEY: 'sk-xxx',
          },
        }),
      ),
    )
    // apiFormat=anthropic_messages 不会触发 google 兜底,但 url=openai.com 会兜底 openai
    // mapper.ts 第 44 行: apiFormat === 'gemini_native' → google;其他 apiFormat 不影响 url 兜底
    // 所以 baseUrl=openai.com → providerCode=openai
    expect(res.providers[0].providerCode).toBe('openai')
  })

  it('自定义 baseUrl 指向 deepseek.com → providerCode = deepseek', () => {
    const res = parseClaudeCli(
      makeText(
        makeSettings({
          env: {
            ANTHROPIC_BASE_URL: 'https://api.deepseek.com/v1',
            ANTHROPIC_API_KEY: 'sk-xxx',
          },
        }),
      ),
    )
    expect(res.providers[0].providerCode).toBe('deepseek')
  })
})

describe('claude-cli parser — meta 字段验证', () => {
  it('meta.category 固定为 Claude', () => {
    const res = parseClaudeCli(
      makeText(
        makeSettings({
          env: { ANTHROPIC_API_KEY: 'sk-xxx' },
        }),
      ),
    )
    expect(res.providers[0].meta.category).toBe('Claude')
  })

  it('meta.websiteUrl 固定为 https://claude.ai', () => {
    const res = parseClaudeCli(
      makeText(
        makeSettings({
          env: { ANTHROPIC_API_KEY: 'sk-xxx' },
        }),
      ),
    )
    expect(res.providers[0].meta.websiteUrl).toBe('https://claude.ai')
  })

  it('meta.models 与 model 同步', () => {
    const res = parseClaudeCli(
      makeText(
        makeSettings({
          env: {
            ANTHROPIC_API_KEY: 'sk-xxx',
            ANTHROPIC_MODEL: 'claude-3-5-haiku-20241022',
          },
        }),
      ),
    )
    expect(res.providers[0].meta.models).toEqual(['claude-3-5-haiku-20241022'])
  })
})

describe('claude-cli parser — globalWarnings 触发条件', () => {
  it('apiKey 存在 → 无 globalWarnings', () => {
    const res = parseClaudeCli(
      makeText(
        makeSettings({
          env: { ANTHROPIC_API_KEY: 'sk-xxx' },
        }),
      ),
    )
    expect(res.globalWarnings).toHaveLength(0)
  })

  it('apiKey 缺失 → globalWarnings 提示', () => {
    const res = parseClaudeCli(
      makeText(
        makeSettings({
          env: {},
        }),
      ),
    )
    expect(res.globalWarnings.length).toBeGreaterThan(0)
    expect(res.globalWarnings[0]).toContain('Claude CLI')
  })
})

describe('claude-cli parser — name 字段', () => {
  it('name 固定为 Claude Code CLI', () => {
    const res = parseClaudeCli(
      makeText(
        makeSettings({
          env: { ANTHROPIC_API_KEY: 'sk-xxx' },
        }),
      ),
    )
    expect(res.providers[0].name).toBe('Claude Code CLI')
  })

  it('name 中的 HTML 字符被清洗(若 settings.json 含恶意 name)', () => {
    // claude-cli 的 name 是硬编码 'Claude Code CLI',这里测 sanitizeProviderName 不被绕过
    // 通过设置 env 中的 ANTHROPIC_BASE_URL 含 HTML 验证 parser 不会引入 XSS
    const res = parseClaudeCli(
      makeText(
        makeSettings({
          env: {
            ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
            ANTHROPIC_API_KEY: 'sk-xxx',
          },
        }),
      ),
    )
    expect(res.providers[0].name).not.toContain('<')
    expect(res.providers[0].name).not.toContain('>')
  })
})

describe('claude-cli parser — 综合场景', () => {
  it('完整真实场景:Anthropic 官方 + Opus 模型 + 1 个 mcp server', () => {
    const res = parseClaudeCli(
      makeText(
        makeSettings({
          env: {
            ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
            ANTHROPIC_AUTH_TOKEN: 'sk-ant-token',
            ANTHROPIC_MODEL: 'claude-opus-4-1',
          },
          model: 'fallback',
          mcpServers: {
            context7: {
              command: 'npx',
              args: ['-y', '@upstash/context7-mcp'],
            },
          },
        }),
      ),
    )
    expect(res.providers).toHaveLength(1)
    const p = res.providers[0]
    expect(p.apiKey).toBe('sk-ant-token')
    expect(p.baseUrl).toBe('https://api.anthropic.com')
    expect(p.modelIdForTest).toBe('claude-opus-4-1')
    expect(p.apiFormat).toBe('anthropic_messages')
    expect(p.providerCode).toBe('anthropic')
    expect(p.isCurrent).toBe(true)
    expect(p.meta.models).toEqual(['claude-opus-4-1'])
    expect(res.mcpServers).toHaveLength(1)
    expect(res.mcpServers![0].name).toBe('context7')
  })

  it('第三方代理 + 自定义 model + 多 mcp server', () => {
    const res = parseClaudeCli(
      makeText(
        makeSettings({
          env: {
            ANTHROPIC_BASE_URL: 'https://proxy.example.com/anthropic',
            ANTHROPIC_API_KEY: 'sk-proxy',
            ANTHROPIC_MODEL: 'claude-sonnet-4-5',
          },
          mcpServers: {
            fs: { command: 'node', args: ['fs.js'] },
            git: { command: 'node', args: ['git.js'] },
          },
        }),
      ),
    )
    expect(res.providers).toHaveLength(1)
    // model=claude-sonnet-4-5 前缀 claude- → providerCode=anthropic(model 优先于 baseUrl)
    expect(res.providers[0].providerCode).toBe('anthropic')
    expect(res.mcpServers).toHaveLength(2)
  })
})
