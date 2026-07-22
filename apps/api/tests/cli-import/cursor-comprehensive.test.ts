/**
 * Cursor parser 综合测试 — 全参数深度覆盖
 *
 * 覆盖维度:
 *   1. apiFormat 推断(URL 优先 + model 兜底)
 *   2. providerCode 推断(model 前缀优先 + baseUrl 兜底)
 *   3. 各厂商 URL 完整覆盖(OpenAI / Anthropic / Google / DeepSeek / Moonshot / Zhipu / Alibaba / Baidu / ByteDance)
 *   4. model 前缀覆盖(gpt-/claude-/gemini-/deepseek-/kimi-/glm-/qwen-/ernie-/doubao-)
 *   5. 空值/异常/边界
 *   6. JSON 格式变体(嵌套/数组/数字值/null/undefined)
 *   7. name 规范化 + meta.models 同步
 *   8. 跨平台不搞混(Cursor ≠ Windsurf ≠ Cline)
 */
import { describe, it, expect } from 'vitest'

import type { ParserInput } from '../../src/services/cli-import/parsers/types.js'
import { parseCursor } from '../../src/services/cli-import/parsers/cursor.js'

function makeText(text: string): ParserInput {
  return { text, sourcePath: 'test' }
}

function makeCursorJson(opts: Record<string, unknown>): string {
  return JSON.stringify(opts)
}

describe('cursor parser — apiFormat URL 优先推断', () => {
  it('api.openai.com → openai_chat', async () => {
    const res = await parseCursor(makeText(makeCursorJson({
      'cursor.ai.apiKey': 'sk-xxx',
      'cursor.ai.baseUrl': 'https://api.openai.com/v1',
    })))
    expect(res.providers[0]!.apiFormat).toBe('openai_chat')
  })

  it('api.anthropic.com → anthropic_messages', async () => {
    const res = await parseCursor(makeText(makeCursorJson({
      'cursor.ai.apiKey': 'sk-ant-xxx',
      'cursor.ai.baseUrl': 'https://api.anthropic.com',
    })))
    expect(res.providers[0]!.apiFormat).toBe('anthropic_messages')
  })

  it('googleapis.com → gemini_native', async () => {
    const res = await parseCursor(makeText(makeCursorJson({
      'cursor.ai.apiKey': 'AIza-xxx',
      'cursor.ai.baseUrl': 'https://generativelanguage.googleapis.com/v1beta',
    })))
    expect(res.providers[0]!.apiFormat).toBe('gemini_native')
  })

  it('generativelanguage 包含识别(google)', async () => {
    const res = await parseCursor(makeText(makeCursorJson({
      'cursor.ai.apiKey': 'AIza-xxx',
      'cursor.ai.baseUrl': 'https://generativelanguage.googleapis.com',
    })))
    expect(res.providers[0]!.apiFormat).toBe('gemini_native')
  })

  it('githubcopilot URL → openai_chat', async () => {
    const res = await parseCursor(makeText(makeCursorJson({
      'cursor.ai.apiKey': 'ghu-xxx',
      'cursor.ai.baseUrl': 'https://api.githubcopilot.com',
    })))
    expect(res.providers[0]!.apiFormat).toBe('openai_chat')
  })

  it('未知 URL → 默认 openai_chat', async () => {
    const res = await parseCursor(makeText(makeCursorJson({
      'cursor.ai.apiKey': 'sk-xxx',
      'cursor.ai.baseUrl': 'https://api.custom.com/v1',
    })))
    expect(res.providers[0]!.apiFormat).toBe('openai_chat')
  })

  it('URL 大小写不敏感(API.ANTHROPIC.COM → anthropic_messages)', async () => {
    const res = await parseCursor(makeText(makeCursorJson({
      'cursor.ai.apiKey': 'sk-ant-xxx',
      'cursor.ai.baseUrl': 'https://API.Anthropic.Com',
    })))
    expect(res.providers[0]!.apiFormat).toBe('anthropic_messages')
  })
})

describe('cursor parser — apiFormat model 兜底(URL 未知时)', () => {
  it('未知 URL + model=claude-3-opus → anthropic_messages', async () => {
    const res = await parseCursor(makeText(makeCursorJson({
      'cursor.ai.apiKey': 'sk-xxx',
      'cursor.ai.baseUrl': 'https://proxy.example.com/v1',
      'cursor.ai.model': 'claude-3-opus',
    })))
    expect(res.providers[0]!.apiFormat).toBe('anthropic_messages')
  })

  it('未知 URL + model=gemini-1.5-pro → gemini_native', async () => {
    const res = await parseCursor(makeText(makeCursorJson({
      'cursor.ai.apiKey': 'sk-xxx',
      'cursor.ai.baseUrl': 'https://proxy.example.com/v1',
      'cursor.ai.model': 'gemini-1.5-pro',
    })))
    expect(res.providers[0]!.apiFormat).toBe('gemini_native')
  })

  it('未知 URL + model=gpt-4o → openai_chat', async () => {
    const res = await parseCursor(makeText(makeCursorJson({
      'cursor.ai.apiKey': 'sk-xxx',
      'cursor.ai.baseUrl': 'https://proxy.example.com/v1',
      'cursor.ai.model': 'gpt-4o',
    })))
    expect(res.providers[0]!.apiFormat).toBe('openai_chat')
  })

  it('URL 优先于 model(api.openai.com + claude-3 → openai_chat)', async () => {
    // 接入点决定协议:用户用 OpenAI 兼容代理调 Claude
    const res = await parseCursor(makeText(makeCursorJson({
      'cursor.ai.apiKey': 'sk-xxx',
      'cursor.ai.baseUrl': 'https://api.openai.com/v1',
      'cursor.ai.model': 'claude-3-opus',
    })))
    expect(res.providers[0]!.apiFormat).toBe('openai_chat')
  })
})

describe('cursor parser — providerCode 推断(model 前缀优先)', () => {
  it('model=claude-3-opus → providerCode=anthropic(即使 URL=openai)', async () => {
    const res = await parseCursor(makeText(makeCursorJson({
      'cursor.ai.apiKey': 'sk-xxx',
      'cursor.ai.baseUrl': 'https://api.openai.com/v1',
      'cursor.ai.model': 'claude-3-opus',
    })))
    expect(res.providers[0]!.providerCode).toBe('anthropic')
  })

  it('model=gemini-1.5-pro → providerCode=google', async () => {
    const res = await parseCursor(makeText(makeCursorJson({
      'cursor.ai.apiKey': 'sk-xxx',
      'cursor.ai.baseUrl': 'https://proxy.example.com',
      'cursor.ai.model': 'gemini-1.5-pro',
    })))
    expect(res.providers[0]!.providerCode).toBe('google')
  })

  it('model=deepseek-coder → providerCode=deepseek(即使 URL=openai)', async () => {
    const res = await parseCursor(makeText(makeCursorJson({
      'cursor.ai.apiKey': 'sk-xxx',
      'cursor.ai.baseUrl': 'https://api.openai.com/v1',
      'cursor.ai.model': 'deepseek-coder',
    })))
    expect(res.providers[0]!.providerCode).toBe('deepseek')
  })

  it('model=glm-4.5 → providerCode=zhipu', async () => {
    const res = await parseCursor(makeText(makeCursorJson({
      'cursor.ai.apiKey': 'sk-xxx',
      'cursor.ai.baseUrl': 'https://open.bigmodel.cn/api/paas/v4',
      'cursor.ai.model': 'glm-4.5',
    })))
    expect(res.providers[0]!.providerCode).toBe('zhipu')
  })

  it('model=qwen-max → providerCode=alibaba', async () => {
    const res = await parseCursor(makeText(makeCursorJson({
      'cursor.ai.apiKey': 'sk-xxx',
      'cursor.ai.baseUrl': 'https://dashscope.aliyuncs.com/v1',
      'cursor.ai.model': 'qwen-max',
    })))
    expect(res.providers[0]!.providerCode).toBe('alibaba')
  })

  it('model=ernie-4.0 → providerCode=baidu', async () => {
    const res = await parseCursor(makeText(makeCursorJson({
      'cursor.ai.apiKey': 'sk-xxx',
      'cursor.ai.baseUrl': 'https://qianfan.baidubce.com/v2',
      'cursor.ai.model': 'ernie-4.0',
    })))
    expect(res.providers[0]!.providerCode).toBe('baidu')
  })

  it('model=doubao-pro → providerCode=bytedance', async () => {
    const res = await parseCursor(makeText(makeCursorJson({
      'cursor.ai.apiKey': 'sk-xxx',
      'cursor.ai.baseUrl': 'https://ark.cn-beijing.volces.com/api/v3',
      'cursor.ai.model': 'doubao-pro',
    })))
    expect(res.providers[0]!.providerCode).toBe('bytedance')
  })

  it('model=kimi-k1 → providerCode=moonshot', async () => {
    const res = await parseCursor(makeText(makeCursorJson({
      'cursor.ai.apiKey': 'sk-xxx',
      'cursor.ai.baseUrl': 'https://api.moonshot.cn/v1',
      'cursor.ai.model': 'kimi-k1',
    })))
    expect(res.providers[0]!.providerCode).toBe('moonshot')
  })

  it('无 model + api.deepseek.com URL → providerCode=deepseek', async () => {
    const res = await parseCursor(makeText(makeCursorJson({
      'cursor.ai.apiKey': 'sk-xxx',
      'cursor.ai.baseUrl': 'https://api.deepseek.com',
    })))
    expect(res.providers[0]!.providerCode).toBe('deepseek')
  })

  it('无 model + 未知 URL → providerCode=custom', async () => {
    const res = await parseCursor(makeText(makeCursorJson({
      'cursor.ai.apiKey': 'sk-xxx',
      'cursor.ai.baseUrl': 'https://api.unknown-vendor.com/v1',
    })))
    expect(res.providers[0]!.providerCode).toBe('custom')
  })

  it('localhost URL → providerCode=local', async () => {
    const res = await parseCursor(makeText(makeCursorJson({
      'cursor.ai.apiKey': 'sk-xxx',
      'cursor.ai.baseUrl': 'http://127.0.0.1:11434/v1',
    })))
    expect(res.providers[0]!.providerCode).toBe('local')
  })
})

describe('cursor parser — 空值与异常边界', () => {
  it('空字符串输入抛异常', async () => {
    await expect(parseCursor(makeText(''))).rejects.toThrow()
  })

  it('纯空格输入抛异常', async () => {
    await expect(parseCursor(makeText('   \n  \t '))).rejects.toThrow()
  })

  it('非 JSON 输入抛异常', async () => {
    await expect(parseCursor(makeText('not json {'))).rejects.toThrow()
  })

  it('JSON 数字抛异常(解析后无字段)', async () => {
    // 数字 123 是合法 JSON,但 cursor.ai.apiKey 取不到 → warning
    const res = await parseCursor(makeText('123'))
    expect(res.providers).toHaveLength(0)
    expect(res.globalWarnings.length).toBeGreaterThan(0)
  })

  it('JSON 数组抛异常或 warning', async () => {
    // 数组是合法 JSON,但 settings[key] 取不到 → warning
    const res = await parseCursor(makeText('[]'))
    expect(res.providers).toHaveLength(0)
  })

  it('空对象 → warning(无 apiKey)', async () => {
    const res = await parseCursor(makeText('{}'))
    expect(res.providers).toHaveLength(0)
    expect(res.globalWarnings.length).toBeGreaterThan(0)
    expect(res.globalWarnings[0]).toContain('cursor.ai.apiKey')
  })

  it('有 apiKey 无 baseUrl → warning(无默认端点)', async () => {
    const res = await parseCursor(makeText(makeCursorJson({
      'cursor.ai.apiKey': 'sk-xxx',
    })))
    expect(res.providers).toHaveLength(0)
    expect(res.globalWarnings[0]).toContain('cursor.ai.baseUrl')
  })

  it('apiKey 为空字符串 → warning', async () => {
    const res = await parseCursor(makeText(makeCursorJson({
      'cursor.ai.apiKey': '',
      'cursor.ai.baseUrl': 'https://api.openai.com/v1',
    })))
    expect(res.providers).toHaveLength(0)
    expect(res.globalWarnings.length).toBeGreaterThan(0)
  })

  it('apiKey 为 null → warning', async () => {
    const res = await parseCursor(makeText(makeCursorJson({
      'cursor.ai.apiKey': null,
      'cursor.ai.baseUrl': 'https://api.openai.com/v1',
    })))
    expect(res.providers).toHaveLength(0)
  })

  it('apiKey 为数字 → warning(str() 只接受字符串)', async () => {
    const res = await parseCursor(makeText(makeCursorJson({
      'cursor.ai.apiKey': 12345,
      'cursor.ai.baseUrl': 'https://api.openai.com/v1',
    })))
    expect(res.providers).toHaveLength(0)
  })

  it('baseUrl 为空字符串 → warning', async () => {
    const res = await parseCursor(makeText(makeCursorJson({
      'cursor.ai.apiKey': 'sk-xxx',
      'cursor.ai.baseUrl': '',
    })))
    expect(res.providers).toHaveLength(0)
    expect(res.globalWarnings[0]).toContain('cursor.ai.baseUrl')
  })
})

describe('cursor parser — JSON 格式与字段变体', () => {
  it('嵌套 JSON 对象不读取(cursor.ai.* 必须扁平)', async () => {
    const res = await parseCursor(makeText(makeCursorJson({
      cursor: {
        ai: { apiKey: 'sk-xxx', baseUrl: 'https://api.openai.com/v1' },
      },
    })))
    expect(res.providers).toHaveLength(0)
  })

  it('其他无关字段不影响 cursor.ai.* 提取', async () => {
    const res = await parseCursor(makeText(makeCursorJson({
      'editor.fontSize': 14,
      'workbench.colorTheme': 'dark',
      'cursor.ai.apiKey': 'sk-xxx',
      'cursor.ai.baseUrl': 'https://api.openai.com/v1',
      'cursor.ai.model': 'gpt-4o',
    })))
    expect(res.providers).toHaveLength(1)
    expect(res.providers[0]!.modelIdForTest).toBe('gpt-4o')
  })

  it('无 model 字段时 modelIdForTest 为 undefined', async () => {
    const res = await parseCursor(makeText(makeCursorJson({
      'cursor.ai.apiKey': 'sk-xxx',
      'cursor.ai.baseUrl': 'https://api.openai.com/v1',
    })))
    expect(res.providers[0]!.modelIdForTest).toBeUndefined()
  })

  it('model 为空字符串 → modelIdForTest undefined', async () => {
    const res = await parseCursor(makeText(makeCursorJson({
      'cursor.ai.apiKey': 'sk-xxx',
      'cursor.ai.baseUrl': 'https://api.openai.com/v1',
      'cursor.ai.model': '',
    })))
    expect(res.providers[0]!.modelIdForTest).toBeUndefined()
  })

  it('model 为 null → modelIdForTest undefined', async () => {
    const res = await parseCursor(makeText(makeCursorJson({
      'cursor.ai.apiKey': 'sk-xxx',
      'cursor.ai.baseUrl': 'https://api.openai.com/v1',
      'cursor.ai.model': null,
    })))
    expect(res.providers[0]!.modelIdForTest).toBeUndefined()
  })

  it('model 为数字 → modelIdForTest undefined(str() 拒绝)', async () => {
    const res = await parseCursor(makeText(makeCursorJson({
      'cursor.ai.apiKey': 'sk-xxx',
      'cursor.ai.baseUrl': 'https://api.openai.com/v1',
      'cursor.ai.model': 12345,
    })))
    expect(res.providers[0]!.modelIdForTest).toBeUndefined()
  })
})

describe('cursor parser — meta + name + isCurrent 验证', () => {
  it('meta.category = Cursor', async () => {
    const res = await parseCursor(makeText(makeCursorJson({
      'cursor.ai.apiKey': 'sk-xxx',
      'cursor.ai.baseUrl': 'https://api.openai.com/v1',
    })))
    expect(res.providers[0]!.meta.category).toBe('Cursor')
  })

  it('meta.websiteUrl = https://cursor.sh', async () => {
    const res = await parseCursor(makeText(makeCursorJson({
      'cursor.ai.apiKey': 'sk-xxx',
      'cursor.ai.baseUrl': 'https://api.openai.com/v1',
    })))
    expect(res.providers[0]!.meta.websiteUrl).toBe('https://cursor.sh')
  })

  it('有 model 时 meta.models 包含该 model', async () => {
    const res = await parseCursor(makeText(makeCursorJson({
      'cursor.ai.apiKey': 'sk-xxx',
      'cursor.ai.baseUrl': 'https://api.openai.com/v1',
      'cursor.ai.model': 'gpt-4o',
    })))
    expect(res.providers[0]!.meta.models).toEqual(['gpt-4o'])
  })

  it('无 model 时 meta.models undefined', async () => {
    const res = await parseCursor(makeText(makeCursorJson({
      'cursor.ai.apiKey': 'sk-xxx',
      'cursor.ai.baseUrl': 'https://api.openai.com/v1',
    })))
    expect(res.providers[0]!.meta.models).toBeUndefined()
  })

  it('sourceId = cursor-default', async () => {
    const res = await parseCursor(makeText(makeCursorJson({
      'cursor.ai.apiKey': 'sk-xxx',
      'cursor.ai.baseUrl': 'https://api.openai.com/v1',
    })))
    expect(res.providers[0]!.sourceId).toBe('cursor-default')
  })

  it('isCurrent = true(单 provider 默认当前)', async () => {
    const res = await parseCursor(makeText(makeCursorJson({
      'cursor.ai.apiKey': 'sk-xxx',
      'cursor.ai.baseUrl': 'https://api.openai.com/v1',
    })))
    expect(res.providers[0]!.isCurrent).toBe(true)
  })

  it('name 不含 HTML 标签(XSS 清洗)', async () => {
    const res = await parseCursor(makeText(makeCursorJson({
      'cursor.ai.apiKey': 'sk-xxx',
      'cursor.ai.baseUrl': 'https://api.openai.com/v1',
    })))
    expect(res.providers[0]!.name).toBe('Cursor')
    expect(res.providers[0]!.name).not.toContain('<')
  })

  it('globalWarnings 默认为空数组(成功时)', async () => {
    const res = await parseCursor(makeText(makeCursorJson({
      'cursor.ai.apiKey': 'sk-xxx',
      'cursor.ai.baseUrl': 'https://api.openai.com/v1',
    })))
    expect(res.globalWarnings).toEqual([])
  })
})

describe('cursor parser — 跨平台不搞混', () => {
  it('不读取 windsurf.ai.* 字段', async () => {
    const res = await parseCursor(makeText(makeCursorJson({
      'windsurf.ai.apiKey': 'sk-xxx',
      'windsurf.ai.baseUrl': 'https://api.openai.com/v1',
    })))
    expect(res.providers).toHaveLength(0)
  })

  it('不读取 cline.* 字段', async () => {
    const res = await parseCursor(makeText(makeCursorJson({
      'cline.apiKey': 'sk-xxx',
      'cline.openAiBaseUrl': 'https://api.openai.com/v1',
    })))
    expect(res.providers).toHaveLength(0)
  })

  it('同时含 cursor + windsurf 字段,只解析 cursor', async () => {
    const res = await parseCursor(makeText(makeCursorJson({
      'cursor.ai.apiKey': 'sk-cursor',
      'cursor.ai.baseUrl': 'https://api.openai.com/v1',
      'windsurf.ai.apiKey': 'sk-windsurf',
      'windsurf.ai.baseUrl': 'https://api.anthropic.com',
    })))
    expect(res.providers).toHaveLength(1)
    expect(res.providers[0]!.apiKey).toBe('sk-cursor')
    expect(res.providers[0]!.apiFormat).toBe('openai_chat')
  })
})
