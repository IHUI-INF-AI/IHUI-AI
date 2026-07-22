/**
 * windsurf parser 全参数综合测试
 *
 * 覆盖(与 cursor 对齐,但用 windsurf.ai.* 前缀):
 *   1. URL/协议不搞混(8 大厂商 + GitHub Copilot + 未知)
 *   2. model 前缀与 baseUrl 冲突时的协议推断
 *   3. 必填字段校验
 *   4. providerCode 推断
 *   5. 字段读取(name / apiKey / model / meta / sourceId / isCurrent)
 *   6. 异常输入
 *   7. 大小写不敏感 + 跨平台隔离
 */
import { describe, it, expect } from 'vitest'

import type { ParserInput } from '../../src/services/cli-import/parsers/types.js'
import { parseWindsurf } from '../../src/services/cli-import/parsers/windsurf.js'

function makeText(text: string): ParserInput {
  return { text, sourcePath: 'windsurf-settings.json' }
}

function makeSettings(obj: Record<string, unknown>): ParserInput {
  return makeText(JSON.stringify(obj))
}

describe('windsurf parser 全参数综合测试', () => {
  // ===========================================================================
  // 1. URL/协议不搞混
  // ===========================================================================
  describe('URL/协议不搞混', () => {
    it('api.openai.com → openai_chat', async () => {
      const res = await parseWindsurf(
        makeSettings({
          'windsurf.ai.apiKey': 'sk-xxx',
          'windsurf.ai.baseUrl': 'https://api.openai.com/v1',
        }),
      )
      expect(res.providers[0]!.apiFormat).toBe('openai_chat')
      expect(res.providers[0]!.providerCode).toBe('openai')
    })

    it('api.anthropic.com → anthropic_messages', async () => {
      const res = await parseWindsurf(
        makeSettings({
          'windsurf.ai.apiKey': 'sk-ant-xxx',
          'windsurf.ai.baseUrl': 'https://api.anthropic.com',
        }),
      )
      expect(res.providers[0]!.apiFormat).toBe('anthropic_messages')
      expect(res.providers[0]!.providerCode).toBe('anthropic')
    })

    it('googleapis.com → gemini_native', async () => {
      const res = await parseWindsurf(
        makeSettings({
          'windsurf.ai.apiKey': 'AIza-xxx',
          'windsurf.ai.baseUrl': 'https://generativelanguage.googleapis.com/v1beta',
        }),
      )
      expect(res.providers[0]!.apiFormat).toBe('gemini_native')
      expect(res.providers[0]!.providerCode).toBe('google')
    })

    it('api.deepseek.com → openai_chat + providerCode=deepseek', async () => {
      const res = await parseWindsurf(
        makeSettings({
          'windsurf.ai.apiKey': 'sk-xxx',
          'windsurf.ai.baseUrl': 'https://api.deepseek.com',
          'windsurf.ai.model': 'deepseek-coder',
        }),
      )
      expect(res.providers[0]!.apiFormat).toBe('openai_chat')
      expect(res.providers[0]!.providerCode).toBe('deepseek')
    })

    it('api.moonshot.cn → openai_chat + providerCode=moonshot', async () => {
      const res = await parseWindsurf(
        makeSettings({
          'windsurf.ai.apiKey': 'sk-xxx',
          'windsurf.ai.baseUrl': 'https://api.moonshot.cn/v1',
        }),
      )
      expect(res.providers[0]!.apiFormat).toBe('openai_chat')
      expect(res.providers[0]!.providerCode).toBe('moonshot')
    })

    it('api.githubcopilot.com → openai_chat', async () => {
      const res = await parseWindsurf(
        makeSettings({
          'windsurf.ai.apiKey': 'ghu-xxx',
          'windsurf.ai.baseUrl': 'https://api.githubcopilot.com',
        }),
      )
      expect(res.providers[0]!.apiFormat).toBe('openai_chat')
    })

    it('未知 URL → openai_chat (default) + providerCode=custom', async () => {
      const res = await parseWindsurf(
        makeSettings({
          'windsurf.ai.apiKey': 'sk-xxx',
          'windsurf.ai.baseUrl': 'https://api.unknown.com/v1',
        }),
      )
      expect(res.providers[0]!.apiFormat).toBe('openai_chat')
      expect(res.providers[0]!.providerCode).toBe('custom')
    })
  })

  // ===========================================================================
  // 2. model 前缀与 baseUrl 冲突
  // ===========================================================================
  describe('model 前缀与 baseUrl 冲突(2026-07-22 修正后)', () => {
    it('model=claude-* + openai.com → apiFormat=openai_chat (URL 优先) + providerCode=anthropic (model 优先)', async () => {
      // 修正后:apiFormat 由 URL 决定(接入点协议),providerCode 由 model 决定(实际模型归属)
      const res = await parseWindsurf(
        makeSettings({
          'windsurf.ai.apiKey': 'sk-xxx',
          'windsurf.ai.baseUrl': 'https://api.openai.com/v1',
          'windsurf.ai.model': 'claude-3-opus',
        }),
      )
      expect(res.providers[0]!.apiFormat).toBe('openai_chat')
      expect(res.providers[0]!.providerCode).toBe('anthropic')
    })

    it('model=gemini-* + openai.com → apiFormat=openai_chat (URL 优先) + providerCode=google (model 优先)', async () => {
      const res = await parseWindsurf(
        makeSettings({
          'windsurf.ai.apiKey': 'sk-xxx',
          'windsurf.ai.baseUrl': 'https://api.openai.com/v1',
          'windsurf.ai.model': 'gemini-1.5-pro',
        }),
      )
      expect(res.providers[0]!.apiFormat).toBe('openai_chat')
      expect(res.providers[0]!.providerCode).toBe('google')
    })

    it('无 model + anthropic.com → anthropic_messages', async () => {
      const res = await parseWindsurf(
        makeSettings({
          'windsurf.ai.apiKey': 'sk-xxx',
          'windsurf.ai.baseUrl': 'https://api.anthropic.com',
        }),
      )
      expect(res.providers[0]!.apiFormat).toBe('anthropic_messages')
    })
  })

  // ===========================================================================
  // 3. 必填字段校验
  // ===========================================================================
  describe('必填字段校验', () => {
    it('无 apiKey → providers 空 + warning', async () => {
      const res = await parseWindsurf(
        makeSettings({
          'windsurf.ai.baseUrl': 'https://api.openai.com/v1',
        }),
      )
      expect(res.providers).toHaveLength(0)
      expect(res.globalWarnings.length).toBeGreaterThan(0)
      expect(res.globalWarnings[0]).toContain('windsurf.ai.apiKey')
    })

    it('无 baseUrl → providers 空 + warning(Windsurf 无默认端点)', async () => {
      const res = await parseWindsurf(
        makeSettings({
          'windsurf.ai.apiKey': 'sk-xxx',
        }),
      )
      expect(res.providers).toHaveLength(0)
      expect(res.globalWarnings.length).toBeGreaterThan(0)
      expect(res.globalWarnings[0]).toContain('windsurf.ai.baseUrl')
    })

    it('空对象 → providers 空 + warning', async () => {
      const res = await parseWindsurf(makeSettings({}))
      expect(res.providers).toHaveLength(0)
      expect(res.globalWarnings.length).toBeGreaterThan(0)
    })

    it('apiKey 空字符串 → 视为无 apiKey', async () => {
      const res = await parseWindsurf(
        makeSettings({
          'windsurf.ai.apiKey': '',
          'windsurf.ai.baseUrl': 'https://api.openai.com/v1',
        }),
      )
      expect(res.providers).toHaveLength(0)
      expect(res.globalWarnings.length).toBeGreaterThan(0)
    })
  })

  // ===========================================================================
  // 4. providerCode 推断
  // ===========================================================================
  describe('providerCode 推断', () => {
    it('api.openai.com → openai', async () => {
      const res = await parseWindsurf(
        makeSettings({
          'windsurf.ai.apiKey': 'sk-xxx',
          'windsurf.ai.baseUrl': 'https://api.openai.com/v1',
        }),
      )
      expect(res.providers[0]!.providerCode).toBe('openai')
    })

    it('api.anthropic.com → anthropic', async () => {
      const res = await parseWindsurf(
        makeSettings({
          'windsurf.ai.apiKey': 'sk-xxx',
          'windsurf.ai.baseUrl': 'https://api.anthropic.com',
        }),
      )
      expect(res.providers[0]!.providerCode).toBe('anthropic')
    })

    it('127.0.0.1 → local', async () => {
      const res = await parseWindsurf(
        makeSettings({
          'windsurf.ai.apiKey': 'sk-xxx',
          'windsurf.ai.baseUrl': 'http://127.0.0.1:8080/v1',
        }),
      )
      expect(res.providers[0]!.providerCode).toBe('local')
    })

    it('api.siliconflow.cn → siliconflow', async () => {
      const res = await parseWindsurf(
        makeSettings({
          'windsurf.ai.apiKey': 'sk-xxx',
          'windsurf.ai.baseUrl': 'https://api.siliconflow.cn/v1',
        }),
      )
      expect(res.providers[0]!.providerCode).toBe('siliconflow')
    })
  })

  // ===========================================================================
  // 5. 字段读取正确性
  // ===========================================================================
  describe('字段读取正确性', () => {
    it('apiKey + model + baseUrl 全字段正确读取', async () => {
      const res = await parseWindsurf(
        makeSettings({
          'windsurf.ai.apiKey': 'sk-test-67890',
          'windsurf.ai.baseUrl': 'https://api.deepseek.com',
          'windsurf.ai.model': 'deepseek-coder',
        }),
      )
      const p = res.providers[0]!
      expect(p.apiKey).toBe('sk-test-67890')
      expect(p.baseUrl).toBe('https://api.deepseek.com')
      expect(p.modelIdForTest).toBe('deepseek-coder')
      expect(p.meta?.models).toEqual(['deepseek-coder'])
    })

    it('meta.category + meta.websiteUrl + sourceId 是 Windsurf 专属', async () => {
      const res = await parseWindsurf(
        makeSettings({
          'windsurf.ai.apiKey': 'sk-xxx',
          'windsurf.ai.baseUrl': 'https://api.openai.com/v1',
        }),
      )
      const p = res.providers[0]!
      expect(p.meta?.category).toBe('Windsurf')
      expect(p.meta?.websiteUrl).toBe('https://codeium.com')
      expect(p.sourceId).toBe('windsurf-default')
    })

    it('isCurrent 总是 true', async () => {
      const res = await parseWindsurf(
        makeSettings({
          'windsurf.ai.apiKey': 'sk-xxx',
          'windsurf.ai.baseUrl': 'https://api.openai.com/v1',
        }),
      )
      expect(res.providers[0]!.isCurrent).toBe(true)
    })

    it('无 model → meta.models 不存在', async () => {
      const res = await parseWindsurf(
        makeSettings({
          'windsurf.ai.apiKey': 'sk-xxx',
          'windsurf.ai.baseUrl': 'https://api.openai.com/v1',
        }),
      )
      expect(res.providers[0]!.meta?.models).toBeUndefined()
      expect(res.providers[0]!.modelIdForTest).toBeUndefined()
    })
  })

  // ===========================================================================
  // 6. 异常输入
  // ===========================================================================
  describe('异常输入', () => {
    it('非 JSON → 抛异常', async () => {
      await expect(parseWindsurf(makeText('not json'))).rejects.toThrow()
    })

    it('空字符串 → 抛异常', async () => {
      await expect(parseWindsurf(makeText(''))).rejects.toThrow()
    })

    it('只有空格 → 抛异常', async () => {
      await expect(parseWindsurf(makeText('  \n\t  '))).rejects.toThrow()
    })

    it('JSON 解析错误信息含 Windsurf 标识', async () => {
      try {
        await parseWindsurf(makeText('{invalid'))
        expect.fail('应抛异常')
      } catch (err) {
        expect((err as Error).message).toContain('Windsurf')
      }
    })
  })

  // ===========================================================================
  // 7. 跨平台隔离
  // ===========================================================================
  describe('跨平台隔离', () => {
    it('cursor 前缀字段被 windsurf parser 忽略', async () => {
      const res = await parseWindsurf(
        makeSettings({
          'cursor.ai.apiKey': 'sk-xxx',
          'cursor.ai.baseUrl': 'https://api.openai.com/v1',
        }),
      )
      // windsurf parser 只读 windsurf.ai.*,cursor 字段被忽略 → 无 apiKey
      expect(res.providers).toHaveLength(0)
      expect(res.globalWarnings.length).toBeGreaterThan(0)
    })

    it('其他无关字段被忽略,只读 windsurf.ai.*', async () => {
      const res = await parseWindsurf(
        makeSettings({
          'windsurf.ai.apiKey': 'sk-real',
          'windsurf.ai.baseUrl': 'https://api.openai.com/v1',
          'cursor.ai.apiKey': 'ignored',
          'editor.fontSize': 14,
        }),
      )
      expect(res.providers).toHaveLength(1)
      expect(res.providers[0]!.apiKey).toBe('sk-real')
    })
  })
})
