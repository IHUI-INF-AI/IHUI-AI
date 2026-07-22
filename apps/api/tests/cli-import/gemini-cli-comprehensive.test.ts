/**
 * gemini-cli parser 综合测试 — 全参数深度覆盖
 *
 * 覆盖维度:
 *   1. 基本 .env 解析(空输入/纯注释/无有效行)
 *   2. .env 行格式(KEY=VALUE/引号/注释/空行/=缺失)
 *   3. GEMINI_API_KEY / GOOGLE_API_KEY 别名优先级
 *   4. Vertex AI 模式切换(GOOGLE_GENAI_USE_VERTEXAI=true)
 *   5. baseUrl 计算(Vertex vs 非 Vertex)
 *   6. GOOGLE_CLOUD_LOCATION 自定义(默认 us-central1)
 *   7. settings.json model 提取
 *   8. settings.json 解析失败不阻断
 *   9. apiFormat 固定 gemini_native
 *  10. isCurrent 固定 true
 *  11. 警告(Vertex 缺 project / 非 Vertex 缺 apiKey)
 *  12. providerCode 推断
 *  13. meta 字段(category/websiteUrl/models)
 *  14. sourceId / sourceAppType 固定字段
 */
import { describe, it, expect } from 'vitest'

import type { ParserInput } from '../../src/services/cli-import/parsers/types.js'
import { parseGeminiCli } from '../../src/services/cli-import/parsers/gemini-cli.js'

function makeInput(envText: string, settingsJsonText?: string): ParserInput {
  const input: ParserInput = { text: envText, sourcePath: 'test' }
  if (settingsJsonText !== undefined) {
    input.extra = { settingsJsonText }
  }
  return input
}

describe('gemini-cli parser — 基本 .env 解析', () => {
  it('空输入抛异常', () => {
    expect(() => parseGeminiCli(makeInput(''))).toThrow()
  })

  it('纯空白输入抛异常', () => {
    expect(() => parseGeminiCli(makeInput('  \n  '))).toThrow()
  })

  it('纯注释行 → apiKey 缺失警告(但返回 1 provider)', () => {
    const res = parseGeminiCli(makeInput('# comment\n# another'))
    expect(res.providers).toHaveLength(1)
    expect(res.providers[0].apiKey).toBeUndefined()
  })

  it('无有效 KEY=VALUE 行 → 警告', () => {
    const res = parseGeminiCli(makeInput('just text without equals'))
    expect(res.providers).toHaveLength(1)
    expect(res.providers[0].apiKey).toBeUndefined()
  })
})

describe('gemini-cli parser — .env 行格式', () => {
  it('GEMINI_API_KEY=sk-xxx → 直接读取', () => {
    const res = parseGeminiCli(makeInput('GEMINI_API_KEY=sk-xxx'))
    expect(res.providers[0].apiKey).toBe('sk-xxx')
  })

  it('KEY="value" → 去双引号', () => {
    const res = parseGeminiCli(makeInput('GEMINI_API_KEY="sk-quoted"'))
    expect(res.providers[0].apiKey).toBe('sk-quoted')
  })

  it("KEY='value' → 去单引号", () => {
    const res = parseGeminiCli(makeInput("GEMINI_API_KEY='sk-single'"))
    expect(res.providers[0].apiKey).toBe('sk-single')
  })

  it('注释行 # 开头被忽略', () => {
    const res = parseGeminiCli(makeInput('# GEMINI_API_KEY=sk-ignored\nGEMINI_API_KEY=sk-real'))
    expect(res.providers[0].apiKey).toBe('sk-real')
  })

  it('空行被忽略', () => {
    const res = parseGeminiCli(makeInput('\n\nGEMINI_API_KEY=sk-real\n\n'))
    expect(res.providers[0].apiKey).toBe('sk-real')
  })

  it('行内无 = → 被忽略(eq <= 0)', () => {
    const res = parseGeminiCli(makeInput('NOEQUALS\nGEMINI_API_KEY=sk-real'))
    expect(res.providers[0].apiKey).toBe('sk-real')
  })

  it('= 在首位 → 被忽略(eq === 0)', () => {
    const res = parseGeminiCli(makeInput('=value\nGEMINI_API_KEY=sk-real'))
    expect(res.providers[0].apiKey).toBe('sk-real')
  })

  it('VALUE 含 = → 正确切分(eq 为第一个)', () => {
    const res = parseGeminiCli(makeInput('GEMINI_API_KEY=sk-secret=with=equals'))
    expect(res.providers[0].apiKey).toBe('sk-secret=with=equals')
  })

  it('CRLF 行尾正常解析', () => {
    const res = parseGeminiCli(makeInput('GEMINI_API_KEY=sk-crlf\r\nGOOGLE_API_KEY=sk-other\r\n'))
    expect(res.providers[0].apiKey).toBe('sk-crlf')
  })

  it('KEY 前后空格被 trim', () => {
    const res = parseGeminiCli(makeInput('  GEMINI_API_KEY  =sk-real'))
    expect(res.providers[0].apiKey).toBe('sk-real')
  })

  it('VALUE 后空格被 trim', () => {
    const res = parseGeminiCli(makeInput('GEMINI_API_KEY=sk-real   '))
    expect(res.providers[0].apiKey).toBe('sk-real')
  })
})

describe('gemini-cli parser — GEMINI_API_KEY / GOOGLE_API_KEY 别名优先级', () => {
  it('GEMINI_API_KEY 优先于 GOOGLE_API_KEY', () => {
    const res = parseGeminiCli(
      makeInput('GEMINI_API_KEY=sk-gemini\nGOOGLE_API_KEY=sk-google'),
    )
    expect(res.providers[0].apiKey).toBe('sk-gemini')
  })

  it('仅有 GOOGLE_API_KEY → fallback 成功', () => {
    const res = parseGeminiCli(makeInput('GOOGLE_API_KEY=sk-google'))
    expect(res.providers[0].apiKey).toBe('sk-google')
  })

  it('两个 key 都缺失 → apiKey undefined + 警告', () => {
    const res = parseGeminiCli(makeInput('GOOGLE_GENAI_USE_VERTEXAI=false'))
    expect(res.providers[0].apiKey).toBeUndefined()
    expect(res.providers[0].warnings.some((w) => w.includes('GEMINI_API_KEY'))).toBe(true)
  })
})

describe('gemini-cli parser — Vertex AI 模式切换', () => {
  it('GOOGLE_GENAI_USE_VERTEXAI=true → useVertex=true', () => {
    const res = parseGeminiCli(
      makeInput('GOOGLE_GENAI_USE_VERTEXAI=true\nGOOGLE_CLOUD_PROJECT=my-project'),
    )
    expect(res.providers[0].baseUrl).toContain('aiplatform.googleapis.com')
  })

  it('GOOGLE_GENAI_USE_VERTEXAI=false → useVertex=false(走 generativelanguage)', () => {
    const res = parseGeminiCli(makeInput('GOOGLE_GENAI_USE_VERTEXAI=false\nGEMINI_API_KEY=sk'))
    expect(res.providers[0].baseUrl).toBe('https://generativelanguage.googleapis.com')
  })

  it('GOOGLE_GENAI_USE_VERTEXAI 缺失 → 默认 false(走 generativelanguage)', () => {
    const res = parseGeminiCli(makeInput('GEMINI_API_KEY=sk-xxx'))
    expect(res.providers[0].baseUrl).toBe('https://generativelanguage.googleapis.com')
  })

  it('GOOGLE_GENAI_USE_VERTEXAI=TRUE 大写 → 不匹配(只匹配小写 true)', () => {
    const res = parseGeminiCli(
      makeInput('GOOGLE_GENAI_USE_VERTEXAI=TRUE\nGEMINI_API_KEY=sk-xxx'),
    )
    // 严格 === 'true',大写不匹配 → useVertex=false
    expect(res.providers[0].baseUrl).toBe('https://generativelanguage.googleapis.com')
  })

  it('GOOGLE_GENAI_USE_VERTEXAI=1 → 不匹配(非 true 字符串)', () => {
    const res = parseGeminiCli(makeInput('GOOGLE_GENAI_USE_VERTEXAI=1\nGEMINI_API_KEY=sk'))
    expect(res.providers[0].baseUrl).toBe('https://generativelanguage.googleapis.com')
  })
})

describe('gemini-cli parser — baseUrl 计算(Vertex vs 非 Vertex)', () => {
  it('非 Vertex 模式 → https://generativelanguage.googleapis.com', () => {
    const res = parseGeminiCli(makeInput('GEMINI_API_KEY=sk-xxx'))
    expect(res.providers[0].baseUrl).toBe('https://generativelanguage.googleapis.com')
  })

  it('Vertex 模式默认 location → https://us-central1-aiplatform.googleapis.com', () => {
    const res = parseGeminiCli(
      makeInput('GOOGLE_GENAI_USE_VERTEXAI=true\nGOOGLE_CLOUD_PROJECT=proj'),
    )
    expect(res.providers[0].baseUrl).toBe('https://us-central1-aiplatform.googleapis.com')
  })

  it('Vertex 模式自定义 location → https://${location}-aiplatform.googleapis.com', () => {
    const res = parseGeminiCli(
      makeInput(
        'GOOGLE_GENAI_USE_VERTEXAI=true\nGOOGLE_CLOUD_PROJECT=proj\nGOOGLE_CLOUD_LOCATION=europe-west4',
      ),
    )
    expect(res.providers[0].baseUrl).toBe('https://europe-west4-aiplatform.googleapis.com')
  })

  it('Vertex 模式 location 缺失 → fallback us-central1', () => {
    const res = parseGeminiCli(
      makeInput('GOOGLE_GENAI_USE_VERTEXAI=true\nGOOGLE_CLOUD_PROJECT=proj'),
    )
    // location 缺失 → ?? 'us-central1'
    expect(res.providers[0].baseUrl).toBe('https://us-central1-aiplatform.googleapis.com')
  })

  it('Vertex 模式 location 空字符串 → 空字符串透传(?? 不对空字符串生效)', () => {
    const res = parseGeminiCli(
      makeInput(
        'GOOGLE_GENAI_USE_VERTEXAI=true\nGOOGLE_CLOUD_PROJECT=proj\nGOOGLE_CLOUD_LOCATION=',
      ),
    )
    // ?? 只对 null/undefined 生效,空字符串是 truthy 字符串,直接透传
    // baseUrl = `https://-aiplatform.googleapis.com`(location 是空)
    expect(res.providers[0].baseUrl).toBe('https://-aiplatform.googleapis.com')
  })
})

describe('gemini-cli parser — settings.json model 提取', () => {
  it('settings.json 提供 model → 透传到 modelIdForTest', () => {
    const res = parseGeminiCli(
      makeInput('GEMINI_API_KEY=sk-xxx', JSON.stringify({ model: 'gemini-2.0-flash' })),
    )
    expect(res.providers[0].modelIdForTest).toBe('gemini-2.0-flash')
    expect(res.providers[0].meta.models).toEqual(['gemini-2.0-flash'])
  })

  it('settings.json model 缺失 → modelIdForTest undefined', () => {
    const res = parseGeminiCli(makeInput('GEMINI_API_KEY=sk-xxx', JSON.stringify({})))
    expect(res.providers[0].modelIdForTest).toBeUndefined()
    expect(res.providers[0].meta.models).toBeUndefined()
  })

  it('settings.json 缺失 → modelIdForTest undefined', () => {
    const res = parseGeminiCli(makeInput('GEMINI_API_KEY=sk-xxx'))
    expect(res.providers[0].modelIdForTest).toBeUndefined()
  })

  it('settings.json 解析失败(非 JSON) → 不阻断,model undefined', () => {
    const res = parseGeminiCli(makeInput('GEMINI_API_KEY=sk-xxx', '{invalid'))
    expect(res.providers).toHaveLength(1)
    expect(res.providers[0].apiKey).toBe('sk-xxx')
    expect(res.providers[0].modelIdForTest).toBeUndefined()
  })

  it('settings.json 为空字符串 → 当作未提供', () => {
    const res = parseGeminiCli(makeInput('GEMINI_API_KEY=sk-xxx', '   '))
    expect(res.providers[0].modelIdForTest).toBeUndefined()
  })

  it('settings.json selectedAuthType 透传(不阻断,虽然 parser 未使用)', () => {
    const res = parseGeminiCli(
      makeInput(
        'GEMINI_API_KEY=sk-xxx',
        JSON.stringify({ model: 'gemini-2.0-flash', selectedAuthType: 'GEMINI_API_KEY' }),
      ),
    )
    expect(res.providers[0].modelIdForTest).toBe('gemini-2.0-flash')
  })
})

describe('gemini-cli parser — apiFormat 固定 gemini_native', () => {
  it('无论 env 配置如何,apiFormat 都是 gemini_native', () => {
    const res = parseGeminiCli(makeInput('GEMINI_API_KEY=sk-xxx'))
    expect(res.providers[0].apiFormat).toBe('gemini_native')
  })

  it('Vertex 模式下 apiFormat 仍是 gemini_native', () => {
    const res = parseGeminiCli(
      makeInput('GOOGLE_GENAI_USE_VERTEXAI=true\nGOOGLE_CLOUD_PROJECT=proj'),
    )
    expect(res.providers[0].apiFormat).toBe('gemini_native')
  })
})

describe('gemini-cli parser — isCurrent 固定 true', () => {
  it('isCurrent 固定为 true(单一 provider 总是激活)', () => {
    const res = parseGeminiCli(makeInput('GEMINI_API_KEY=sk-xxx'))
    expect(res.providers[0].isCurrent).toBe(true)
  })

  it('Vertex 模式下 isCurrent 也是 true', () => {
    const res = parseGeminiCli(
      makeInput('GOOGLE_GENAI_USE_VERTEXAI=true\nGOOGLE_CLOUD_PROJECT=proj'),
    )
    expect(res.providers[0].isCurrent).toBe(true)
  })
})

describe('gemini-cli parser — 警告触发条件', () => {
  it('Vertex 模式 + 缺 GOOGLE_CLOUD_PROJECT → 警告', () => {
    const res = parseGeminiCli(makeInput('GOOGLE_GENAI_USE_VERTEXAI=true'))
    expect(res.providers[0].warnings.some((w) => w.includes('GOOGLE_CLOUD_PROJECT'))).toBe(true)
  })

  it('Vertex 模式 + 有 GOOGLE_CLOUD_PROJECT → 无 project 警告', () => {
    const res = parseGeminiCli(
      makeInput('GOOGLE_GENAI_USE_VERTEXAI=true\nGOOGLE_CLOUD_PROJECT=proj'),
    )
    expect(res.providers[0].warnings.some((w) => w.includes('GOOGLE_CLOUD_PROJECT'))).toBe(false)
  })

  it('非 Vertex 模式 + 缺 apiKey → 警告', () => {
    const res = parseGeminiCli(makeInput('GOOGLE_GENAI_USE_VERTEXAI=false'))
    expect(res.providers[0].warnings.some((w) => w.includes('GEMINI_API_KEY'))).toBe(true)
  })

  it('非 Vertex 模式 + 有 apiKey → 无 apiKey 警告', () => {
    const res = parseGeminiCli(makeInput('GEMINI_API_KEY=sk-xxx'))
    expect(res.providers[0].warnings.some((w) => w.includes('GEMINI_API_KEY'))).toBe(false)
  })

  it('Vertex 模式 + 缺 apiKey → 不触发 apiKey 警告(Vertex 用 ADC,不需要 apiKey)', () => {
    const res = parseGeminiCli(
      makeInput('GOOGLE_GENAI_USE_VERTEXAI=true\nGOOGLE_CLOUD_PROJECT=proj'),
    )
    expect(res.providers[0].warnings.some((w) => w.includes('GEMINI_API_KEY'))).toBe(false)
  })

  it('有 warnings → globalWarnings 也有提示', () => {
    // 纯注释行 → apiKey 缺失 → warnings → globalWarnings
    const res = parseGeminiCli(makeInput('# only comment'))
    expect(res.globalWarnings.length).toBeGreaterThan(0)
    expect(res.globalWarnings[0]).toContain('Gemini CLI')
  })

  it('无 warnings → globalWarnings 为空', () => {
    const res = parseGeminiCli(makeInput('GEMINI_API_KEY=sk-xxx'))
    expect(res.globalWarnings).toHaveLength(0)
  })
})

describe('gemini-cli parser — providerCode 推断', () => {
  it('非 Vertex 模式 → google(googleapis.com 域名)', () => {
    const res = parseGeminiCli(makeInput('GEMINI_API_KEY=sk-xxx'))
    expect(res.providers[0].providerCode).toBe('google')
  })

  it('Vertex 模式 → google(googleapis.com 域名)', () => {
    const res = parseGeminiCli(
      makeInput('GOOGLE_GENAI_USE_VERTEXAI=true\nGOOGLE_CLOUD_PROJECT=proj'),
    )
    expect(res.providers[0].providerCode).toBe('google')
  })

  it('model=gemini-xxx → google(model 优先)', () => {
    const res = parseGeminiCli(
      makeInput('GEMINI_API_KEY=sk-xxx', JSON.stringify({ model: 'gemini-2.0-flash' })),
    )
    expect(res.providers[0].providerCode).toBe('google')
  })
})

describe('gemini-cli parser — meta 字段验证', () => {
  it('meta.category 固定为 Google', () => {
    const res = parseGeminiCli(makeInput('GEMINI_API_KEY=sk-xxx'))
    expect(res.providers[0].meta.category).toBe('Google')
  })

  it('meta.websiteUrl 固定为 https://ai.google.dev', () => {
    const res = parseGeminiCli(makeInput('GEMINI_API_KEY=sk-xxx'))
    expect(res.providers[0].meta.websiteUrl).toBe('https://ai.google.dev')
  })

  it('meta.models 与 model 同步', () => {
    const res = parseGeminiCli(
      makeInput('GEMINI_API_KEY=sk-xxx', JSON.stringify({ model: 'gemini-2.5-pro' })),
    )
    expect(res.providers[0].meta.models).toEqual(['gemini-2.5-pro'])
  })

  it('model 缺失 → meta.models undefined', () => {
    const res = parseGeminiCli(makeInput('GEMINI_API_KEY=sk-xxx'))
    expect(res.providers[0].meta.models).toBeUndefined()
  })
})

describe('gemini-cli parser — sourceId / sourceAppType / name', () => {
  it('sourceId 固定为 gemini-cli-default', () => {
    const res = parseGeminiCli(makeInput('GEMINI_API_KEY=sk-xxx'))
    expect(res.providers[0].sourceId).toBe('gemini-cli-default')
  })

  it('sourceAppType 固定为 gemini', () => {
    const res = parseGeminiCli(makeInput('GEMINI_API_KEY=sk-xxx'))
    expect(res.providers[0].sourceAppType).toBe('gemini')
  })

  it('name 固定为 Gemini CLI', () => {
    const res = parseGeminiCli(makeInput('GEMINI_API_KEY=sk-xxx'))
    expect(res.providers[0].name).toBe('Gemini CLI')
  })
})

describe('gemini-cli parser — 综合场景', () => {
  it('完整真实场景:Vertex AI 模式 + 自定义 location + project', () => {
    const res = parseGeminiCli(
      makeInput(
        'GOOGLE_GENAI_USE_VERTEXAI=true\nGOOGLE_CLOUD_PROJECT=my-gcp-project\nGOOGLE_CLOUD_LOCATION=asia-northeast1\n',
        JSON.stringify({ model: 'gemini-2.5-pro', selectedAuthType: 'VERTEX_AI' }),
      ),
    )
    expect(res.providers).toHaveLength(1)
    const p = res.providers[0]
    expect(p.apiKey).toBeUndefined() // Vertex 模式不依赖 apiKey
    expect(p.baseUrl).toBe('https://asia-northeast1-aiplatform.googleapis.com')
    expect(p.modelIdForTest).toBe('gemini-2.5-pro')
    expect(p.apiFormat).toBe('gemini_native')
    expect(p.providerCode).toBe('google')
    expect(p.isCurrent).toBe(true)
    expect(p.meta.models).toEqual(['gemini-2.5-pro'])
    expect(p.warnings.some((w) => w.includes('GOOGLE_CLOUD_PROJECT'))).toBe(false)
    expect(p.warnings.some((w) => w.includes('GEMINI_API_KEY'))).toBe(false)
  })

  it('完整真实场景:非 Vertex + API Key', () => {
    const res = parseGeminiCli(
      makeInput(
        'GEMINI_API_KEY=AIzaSk-xxx\nGOOGLE_GENAI_USE_VERTEXAI=false\n',
        JSON.stringify({ model: 'gemini-2.0-flash' }),
      ),
    )
    expect(res.providers).toHaveLength(1)
    const p = res.providers[0]
    expect(p.apiKey).toBe('AIzaSk-xxx')
    expect(p.baseUrl).toBe('https://generativelanguage.googleapis.com')
    expect(p.modelIdForTest).toBe('gemini-2.0-flash')
    expect(p.apiFormat).toBe('gemini_native')
    expect(p.providerCode).toBe('google')
    expect(p.isCurrent).toBe(true)
    expect(p.warnings).toHaveLength(0)
  })

  it('GOOGLE_API_KEY 替代 GEMINI_API_KEY', () => {
    const res = parseGeminiCli(
      makeInput('GOOGLE_API_KEY=sk-google-only', JSON.stringify({ model: 'gemini-1.5-pro' })),
    )
    expect(res.providers[0].apiKey).toBe('sk-google-only')
    expect(res.providers[0].warnings.some((w) => w.includes('GEMINI_API_KEY'))).toBe(false)
  })
})
