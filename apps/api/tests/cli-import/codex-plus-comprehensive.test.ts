/**
 * codex++ (codex-plus) parser 综合测试 — 全参数深度覆盖
 *
 * 覆盖维度:
 *   1. 基本 JSON 解析(空输入/非 JSON/缺字段)
 *   2. profiles 数组(空/非数组/正常)
 *   3. relayMode 4 种值(official/mixedApi/pureApi/aggregate)
 *   4. protocol → apiFormat 映射(responses/chatCompletions/缺失)
 *   5. 非激活 profile apiKey 缺失 warning
 *   6. isCurrent 由 isActive 或 activeProfileId 决定
 *   7. sourceVersion = appVersion 透传
 *   8. 多字段提取(baseUrl/apiKey/model)
 *   9. name fallback (p.name → p.id → 'unnamed')
 *  10. providerCode 推断
 *  11. 单 profile 失败不影响其他
 *  12. meta 字段(category/websiteUrl/contextWindow/relayMode/protocol/models)
 */
import { describe, it, expect } from 'vitest'

import type { ParserInput } from '../../src/services/cli-import/parsers/types.js'
import { parseCodexPlus } from '../../src/services/cli-import/parsers/codex-plus.js'

function makeText(text: string): ParserInput {
  return { text, sourcePath: 'test' }
}

function makeSettings(obj: Record<string, unknown>): string {
  return JSON.stringify(obj)
}

describe('codex++ parser — 基本 JSON 解析', () => {
  it('空输入抛异常', () => {
    expect(() => parseCodexPlus(makeText(''))).toThrow()
  })

  it('纯空白输入抛异常', () => {
    expect(() => parseCodexPlus(makeText('  \n  '))).toThrow()
  })

  it('非 JSON 输入抛异常', () => {
    expect(() => parseCodexPlus(makeText('{invalid'))).toThrow()
  })

  it('profiles 缺失 → warning + sourceVersion 透传', () => {
    const res = parseCodexPlus(makeText(makeSettings({ appVersion: '1.2.3' })))
    expect(res.providers).toHaveLength(0)
    expect(res.globalWarnings.some((w) => w.includes('profiles'))).toBe(true)
    expect(res.sourceVersion).toBe('1.2.3')
  })

  it('profiles 为非数组 → warning', () => {
    const res = parseCodexPlus(makeText(makeSettings({ profiles: 'not-array' })))
    expect(res.providers).toHaveLength(0)
    expect(res.globalWarnings.some((w) => w.includes('profiles'))).toBe(true)
  })

  it('profiles 为空数组 → warning', () => {
    const res = parseCodexPlus(makeText(makeSettings({ profiles: [] })))
    expect(res.providers).toHaveLength(0)
    expect(res.globalWarnings.some((w) => w.includes('空数组'))).toBe(true)
  })
})

describe('codex++ parser — profiles 多 profile 提取', () => {
  it('单个 profile 解析', () => {
    const res = parseCodexPlus(
      makeText(
        makeSettings({
          profiles: [
            {
              id: 'p1',
              name: 'OpenAI',
              apiBaseUrl: 'https://api.openai.com/v1',
              apiKey: 'sk-xxx',
              model: 'gpt-5',
              isActive: true,
            },
          ],
        }),
      ),
    )
    expect(res.providers).toHaveLength(1)
    expect(res.providers[0].name).toBe('OpenAI')
    expect(res.providers[0].baseUrl).toBe('https://api.openai.com/v1')
    expect(res.providers[0].apiKey).toBe('sk-xxx')
    expect(res.providers[0].modelIdForTest).toBe('gpt-5')
  })

  it('多个 profile 同时解析', () => {
    const res = parseCodexPlus(
      makeText(
        makeSettings({
          profiles: [
            { id: 'p1', name: 'OpenAI', apiBaseUrl: 'https://api.openai.com/v1', apiKey: 'k1' },
            { id: 'p2', name: 'Anthropic', apiBaseUrl: 'https://api.anthropic.com', apiKey: 'k2' },
            { id: 'p3', name: 'DeepSeek', apiBaseUrl: 'https://api.deepseek.com', apiKey: 'k3' },
          ],
        }),
      ),
    )
    expect(res.providers).toHaveLength(3)
    const names = res.providers.map((p) => p.name).sort()
    expect(names).toEqual(['Anthropic', 'DeepSeek', 'OpenAI'])
  })
})

describe('codex++ parser — relayMode 4 种值', () => {
  it('relayMode=official → meta.relayMode=official', () => {
    const res = parseCodexPlus(
      makeText(
        makeSettings({
          relayMode: 'official',
          profiles: [{ id: 'p1', name: 'P1', apiKey: 'k' }],
        }),
      ),
    )
    expect(res.providers[0].meta.relayMode).toBe('official')
  })

  it('relayMode=mixedApi', () => {
    const res = parseCodexPlus(
      makeText(
        makeSettings({
          relayMode: 'mixedApi',
          profiles: [{ id: 'p1', name: 'P1', apiKey: 'k' }],
        }),
      ),
    )
    expect(res.providers[0].meta.relayMode).toBe('mixedApi')
  })

  it('relayMode=pureApi', () => {
    const res = parseCodexPlus(
      makeText(
        makeSettings({
          relayMode: 'pureApi',
          profiles: [{ id: 'p1', name: 'P1', apiKey: 'k' }],
        }),
      ),
    )
    expect(res.providers[0].meta.relayMode).toBe('pureApi')
  })

  it('relayMode=aggregate', () => {
    const res = parseCodexPlus(
      makeText(
        makeSettings({
          relayMode: 'aggregate',
          profiles: [{ id: 'p1', name: 'P1', apiKey: 'k' }],
        }),
      ),
    )
    expect(res.providers[0].meta.relayMode).toBe('aggregate')
  })

  it('relayMode 缺失 → meta.relayMode undefined', () => {
    const res = parseCodexPlus(
      makeText(
        makeSettings({
          profiles: [{ id: 'p1', name: 'P1', apiKey: 'k' }],
        }),
      ),
    )
    expect(res.providers[0].meta.relayMode).toBeUndefined()
  })
})

describe('codex++ parser — protocol → apiFormat 映射', () => {
  it('protocol=responses → openai_responses', () => {
    const res = parseCodexPlus(
      makeText(
        makeSettings({
          protocol: 'responses',
          profiles: [{ id: 'p1', name: 'P1', apiKey: 'k' }],
        }),
      ),
    )
    expect(res.providers[0].apiFormat).toBe('openai_responses')
  })

  it('protocol=chatCompletions → openai_chat', () => {
    const res = parseCodexPlus(
      makeText(
        makeSettings({
          protocol: 'chatCompletions',
          profiles: [{ id: 'p1', name: 'P1', apiKey: 'k' }],
        }),
      ),
    )
    expect(res.providers[0].apiFormat).toBe('openai_chat')
  })

  it('protocol 缺失 → 默认 openai_chat', () => {
    const res = parseCodexPlus(
      makeText(
        makeSettings({
          profiles: [{ id: 'p1', name: 'P1', apiKey: 'k' }],
        }),
      ),
    )
    expect(res.providers[0].apiFormat).toBe('openai_chat')
  })

  it('protocol 未知值 → 默认 openai_chat', () => {
    const res = parseCodexPlus(
      makeText(
        makeSettings({
          protocol: 'unknown',
          profiles: [{ id: 'p1', name: 'P1', apiKey: 'k' }],
        }),
      ),
    )
    expect(res.providers[0].apiFormat).toBe('openai_chat')
  })

  it('meta.protocol 字段同步保存', () => {
    const res = parseCodexPlus(
      makeText(
        makeSettings({
          protocol: 'responses',
          profiles: [{ id: 'p1', name: 'P1', apiKey: 'k' }],
        }),
      ),
    )
    expect(res.providers[0].meta.protocol).toBe('responses')
  })
})

describe('codex++ parser — 非激活 profile apiKey 缺失 warning', () => {
  it('apiKey=null → apiKey undefined + warning(skip_serializing 模拟)', () => {
    const res = parseCodexPlus(
      makeText(
        makeSettings({
          profiles: [{ id: 'p1', name: 'P1', apiKey: null }],
        }),
      ),
    )
    expect(res.providers[0].apiKey).toBeUndefined()
    expect(res.providers[0].warnings.some((w) => w.includes('apiKey'))).toBe(true)
  })

  it('apiKey 缺失字段 → warning', () => {
    const res = parseCodexPlus(
      makeText(
        makeSettings({
          profiles: [{ id: 'p1', name: 'P1' }],
        }),
      ),
    )
    expect(res.providers[0].apiKey).toBeUndefined()
    expect(res.providers[0].warnings.some((w) => w.includes('apiKey'))).toBe(true)
  })

  it('apiKey 正常 → 无 warning', () => {
    const res = parseCodexPlus(
      makeText(
        makeSettings({
          profiles: [{ id: 'p1', name: 'P1', apiKey: 'sk-xxx' }],
        }),
      ),
    )
    expect(res.providers[0].warnings.some((w) => w.includes('apiKey'))).toBe(false)
  })
})

describe('codex++ parser — isCurrent 由 isActive 或 activeProfileId 决定', () => {
  it('isActive=true → isCurrent=true', () => {
    const res = parseCodexPlus(
      makeText(
        makeSettings({
          profiles: [{ id: 'p1', name: 'P1', isActive: true }],
        }),
      ),
    )
    expect(res.providers[0].isCurrent).toBe(true)
  })

  it('isActive=false → isCurrent=false', () => {
    const res = parseCodexPlus(
      makeText(
        makeSettings({
          profiles: [{ id: 'p1', name: 'P1', isActive: false }],
        }),
      ),
    )
    expect(res.providers[0].isCurrent).toBe(false)
  })

  it('isActive 缺失 + activeProfileId 匹配 → isCurrent=true', () => {
    const res = parseCodexPlus(
      makeText(
        makeSettings({
          activeProfileId: 'p2',
          profiles: [
            { id: 'p1', name: 'P1' },
            { id: 'p2', name: 'P2' },
          ],
        }),
      ),
    )
    expect(res.providers.find((p) => p.sourceId === 'p2')?.isCurrent).toBe(true)
    expect(res.providers.find((p) => p.sourceId === 'p1')?.isCurrent).toBe(false)
  })

  it('isActive=true 与 activeProfileId 匹配共存时,两者都 isCurrent=true(OR 关系)', () => {
    const res = parseCodexPlus(
      makeText(
        makeSettings({
          activeProfileId: 'p2',
          profiles: [
            { id: 'p1', name: 'P1', isActive: true },
            { id: 'p2', name: 'P2' },
          ],
        }),
      ),
    )
    // parser 第 119 行: p.isActive === true || settings.activeProfileId === p.id
    // p1: isActive=true → true
    // p2: activeProfileId='p2' 匹配 → true
    expect(res.providers.find((p) => p.sourceId === 'p1')?.isCurrent).toBe(true)
    expect(res.providers.find((p) => p.sourceId === 'p2')?.isCurrent).toBe(true)
  })

  it('isActive 缺失 + activeProfileId 不匹配任何 profile → 全 false', () => {
    const res = parseCodexPlus(
      makeText(
        makeSettings({
          activeProfileId: 'nonexistent',
          profiles: [{ id: 'p1', name: 'P1' }],
        }),
      ),
    )
    expect(res.providers[0].isCurrent).toBe(false)
  })

  it('activeProfileId 和 isActive 都缺失 → 全 false', () => {
    const res = parseCodexPlus(
      makeText(
        makeSettings({
          profiles: [{ id: 'p1', name: 'P1' }],
        }),
      ),
    )
    expect(res.providers[0].isCurrent).toBe(false)
  })
})

describe('codex++ parser — sourceVersion = appVersion 透传', () => {
  it('appVersion 存在 → sourceVersion 透传', () => {
    const res = parseCodexPlus(
      makeText(
        makeSettings({
          appVersion: '2.0.1',
          profiles: [{ id: 'p1', name: 'P1' }],
        }),
      ),
    )
    expect(res.sourceVersion).toBe('2.0.1')
  })

  it('appVersion 缺失 → sourceVersion undefined', () => {
    const res = parseCodexPlus(
      makeText(
        makeSettings({
          profiles: [{ id: 'p1', name: 'P1' }],
        }),
      ),
    )
    expect(res.sourceVersion).toBeUndefined()
  })
})

describe('codex++ parser — name fallback', () => {
  it('name 缺失 → fallback 到 id', () => {
    const res = parseCodexPlus(
      makeText(
        makeSettings({
          profiles: [{ id: 'my-id', apiBaseUrl: 'https://api.x.com' }],
        }),
      ),
    )
    expect(res.providers[0].name).toBe('my-id')
  })

  it('name 和 id 都缺失 → fallback 到 unnamed', () => {
    const res = parseCodexPlus(
      makeText(
        makeSettings({
          profiles: [{ apiBaseUrl: 'https://api.x.com' }],
        }),
      ),
    )
    expect(res.providers[0].name).toBe('unnamed')
  })

  it('name 含 HTML → 被清洗', () => {
    const res = parseCodexPlus(
      makeText(
        makeSettings({
          profiles: [{ id: 'p1', name: '<script>alert(1)</script>', apiKey: 'k' }],
        }),
      ),
    )
    expect(res.providers[0].name).not.toContain('<script>')
    expect(res.providers[0].name).toContain('&lt;script&gt;')
  })
})

describe('codex++ parser — providerCode 推断', () => {
  it('apiBaseUrl=openai.com → openai', () => {
    const res = parseCodexPlus(
      makeText(
        makeSettings({
          profiles: [{ id: 'p1', name: 'P1', apiBaseUrl: 'https://api.openai.com/v1' }],
        }),
      ),
    )
    expect(res.providers[0].providerCode).toBe('openai')
  })

  it('apiBaseUrl=anthropic.com → anthropic', () => {
    const res = parseCodexPlus(
      makeText(
        makeSettings({
          profiles: [{ id: 'p1', name: 'P1', apiBaseUrl: 'https://api.anthropic.com' }],
        }),
      ),
    )
    expect(res.providers[0].providerCode).toBe('anthropic')
  })

  it('apiBaseUrl=deepseek.com → deepseek', () => {
    const res = parseCodexPlus(
      makeText(
        makeSettings({
          profiles: [{ id: 'p1', name: 'P1', apiBaseUrl: 'https://api.deepseek.com' }],
        }),
      ),
    )
    expect(res.providers[0].providerCode).toBe('deepseek')
  })

  it('model=gemini-xxx 优先 → google', () => {
    const res = parseCodexPlus(
      makeText(
        makeSettings({
          profiles: [{ id: 'p1', name: 'P1', apiBaseUrl: 'https://api.example.com', model: 'gemini-2.0-flash' }],
        }),
      ),
    )
    expect(res.providers[0].providerCode).toBe('google')
  })

  it('model=gpt-xxx 优先 → openai', () => {
    const res = parseCodexPlus(
      makeText(
        makeSettings({
          profiles: [{ id: 'p1', name: 'P1', apiBaseUrl: 'https://api.example.com', model: 'gpt-5' }],
        }),
      ),
    )
    expect(res.providers[0].providerCode).toBe('openai')
  })

  it('未知 baseUrl + 未知 model → custom', () => {
    const res = parseCodexPlus(
      makeText(
        makeSettings({
          profiles: [{ id: 'p1', name: 'P1', apiBaseUrl: 'https://api.unknown.com' }],
        }),
      ),
    )
    expect(res.providers[0].providerCode).toBe('custom')
  })
})

describe('codex++ parser — meta 字段验证', () => {
  it('meta.category 透传', () => {
    const res = parseCodexPlus(
      makeText(
        makeSettings({
          profiles: [{ id: 'p1', name: 'P1', category: 'Official' }],
        }),
      ),
    )
    expect(res.providers[0].meta.category).toBe('Official')
  })

  it('meta.websiteUrl 透传', () => {
    const res = parseCodexPlus(
      makeText(
        makeSettings({
          profiles: [{ id: 'p1', name: 'P1', websiteUrl: 'https://openai.com' }],
        }),
      ),
    )
    expect(res.providers[0].meta.websiteUrl).toBe('https://openai.com')
  })

  it('meta.contextWindow 透传', () => {
    const res = parseCodexPlus(
      makeText(
        makeSettings({
          profiles: [{ id: 'p1', name: 'P1', contextWindow: '128k' }],
        }),
      ),
    )
    expect(res.providers[0].meta.contextWindow).toBe('128k')
  })

  it('meta.models 与 model 同步', () => {
    const res = parseCodexPlus(
      makeText(
        makeSettings({
          profiles: [{ id: 'p1', name: 'P1', model: 'gpt-5' }],
        }),
      ),
    )
    expect(res.providers[0].meta.models).toEqual(['gpt-5'])
  })

  it('model 缺失 → meta.models undefined', () => {
    const res = parseCodexPlus(
      makeText(
        makeSettings({
          profiles: [{ id: 'p1', name: 'P1' }],
        }),
      ),
    )
    expect(res.providers[0].meta.models).toBeUndefined()
    expect(res.providers[0].modelIdForTest).toBeUndefined()
  })
})

describe('codex++ parser — sourceId / sourceAppType', () => {
  it('sourceId = profile.id', () => {
    const res = parseCodexPlus(
      makeText(
        makeSettings({
          profiles: [{ id: 'profile-xxx', name: 'P1' }],
        }),
      ),
    )
    expect(res.providers[0].sourceId).toBe('profile-xxx')
  })

  it('sourceAppType 固定为 codex', () => {
    const res = parseCodexPlus(
      makeText(
        makeSettings({
          profiles: [{ id: 'p1', name: 'P1' }],
        }),
      ),
    )
    expect(res.providers[0].sourceAppType).toBe('codex')
  })
})

describe('codex++ parser — 单 profile 失败不影响其他', () => {
  it('中间 profile 抛错 → 其他 profile 仍正常解析', () => {
    const res = parseCodexPlus(
      makeText(
        makeSettings({
          profiles: [
            { id: 'p1', name: 'P1', apiKey: 'k1' },
            null, // 故意放 null 触发 p?.id 失败
            { id: 'p3', name: 'P3', apiKey: 'k3' },
          ],
        }),
      ),
    )
    // null profile 走 catch 分支,加 globalWarning
    expect(res.globalWarnings.length).toBeGreaterThan(0)
    // p1 和 p3 仍存在
    expect(res.providers.find((p) => p.sourceId === 'p1')).toBeDefined()
    expect(res.providers.find((p) => p.sourceId === 'p3')).toBeDefined()
  })
})

describe('codex++ parser — normalizeProvider 联动', () => {
  it('apiBaseUrl 缺失 → normalizeProvider 加 baseUrl 警告', () => {
    const res = parseCodexPlus(
      makeText(
        makeSettings({
          profiles: [{ id: 'p1', name: 'P1', apiKey: 'k' }],
        }),
      ),
    )
    expect(res.providers[0].baseUrl).toBe('')
    expect(res.providers[0].warnings.some((w) => w.includes('baseUrl'))).toBe(true)
  })

  it('apiKey 缺失 → normalizeProvider 加 apiKey 警告', () => {
    const res = parseCodexPlus(
      makeText(
        makeSettings({
          profiles: [{ id: 'p1', name: 'P1', apiBaseUrl: 'https://api.x.com' }],
        }),
      ),
    )
    expect(res.providers[0].warnings.some((w) => w.includes('apiKey'))).toBe(true)
  })
})

describe('codex++ parser — 综合场景', () => {
  it('完整真实场景:多 profile + relayMode + protocol + activeProfileId', () => {
    const res = parseCodexPlus(
      makeText(
        makeSettings({
          appVersion: '3.0.0',
          relayMode: 'mixedApi',
          protocol: 'responses',
          activeProfileId: 'p2',
          profiles: [
            {
              id: 'p1',
              name: 'OpenAI',
              apiBaseUrl: 'https://api.openai.com/v1',
              apiKey: 'sk-openai',
              model: 'gpt-5',
              category: 'Official',
              websiteUrl: 'https://openai.com',
              contextWindow: '128k',
            },
            {
              id: 'p2',
              name: 'DeepSeek',
              apiBaseUrl: 'https://api.deepseek.com',
              apiKey: 'sk-deep',
              model: 'deepseek-coder',
              category: 'ThirdParty',
              websiteUrl: 'https://deepseek.com',
              contextWindow: '64k',
            },
          ],
        }),
      ),
    )
    expect(res.providers).toHaveLength(2)
    expect(res.sourceVersion).toBe('3.0.0')

    const p1 = res.providers.find((p) => p.sourceId === 'p1')!
    const p2 = res.providers.find((p) => p.sourceId === 'p2')!
    expect(p1.isCurrent).toBe(false)
    expect(p2.isCurrent).toBe(true)

    expect(p1.apiFormat).toBe('openai_responses') // protocol=responses
    expect(p2.apiFormat).toBe('openai_responses')
    expect(p1.meta.relayMode).toBe('mixedApi')
    expect(p2.meta.relayMode).toBe('mixedApi')
    expect(p1.meta.protocol).toBe('responses')
    expect(p2.meta.protocol).toBe('responses')
    expect(p1.meta.models).toEqual(['gpt-5'])
    expect(p2.meta.models).toEqual(['deepseek-coder'])
    expect(p1.providerCode).toBe('openai')
    expect(p2.providerCode).toBe('deepseek')
  })

  it('skip_serializing 场景:激活 profile 有 apiKey,非激活 profile apiKey=null', () => {
    const res = parseCodexPlus(
      makeText(
        makeSettings({
          activeProfileId: 'active',
          profiles: [
            { id: 'active', name: 'Active', apiKey: 'sk-active', apiBaseUrl: 'https://api.x.com' },
            { id: 'inactive', name: 'Inactive', apiKey: null, apiBaseUrl: 'https://api.y.com' },
          ],
        }),
      ),
    )
    expect(res.providers).toHaveLength(2)
    const active = res.providers.find((p) => p.sourceId === 'active')!
    const inactive = res.providers.find((p) => p.sourceId === 'inactive')!
    expect(active.apiKey).toBe('sk-active')
    expect(active.warnings.some((w) => w.includes('apiKey'))).toBe(false)
    expect(inactive.apiKey).toBeUndefined()
    expect(inactive.warnings.some((w) => w.includes('apiKey'))).toBe(true)
    expect(active.isCurrent).toBe(true)
    expect(inactive.isCurrent).toBe(false)
  })
})
