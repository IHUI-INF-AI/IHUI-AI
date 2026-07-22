/**
 * cline parser 全参数综合测试
 *
 * 重点验证 cline 的特殊逻辑:**apiProvider 决定 apiFormat(不是 baseUrl)**
 *
 * 覆盖:
 *   1. pickApiFormat(apiProvider) 全分支
 *   2. apiProvider vs baseUrl 冲突场景(apiProvider 优先)
 *   3. 必填字段校验
 *   4. providerCode 推断(基于 baseUrl,因 cline 用 baseUrl 推断)
 *   5. 字段读取正确性
 *   6. 异常输入
 *   7. 跨平台隔离
 */
import { describe, it, expect } from 'vitest'

import type { ParserInput } from '../../src/services/cli-import/parsers/types.js'
import { parseCline } from '../../src/services/cli-import/parsers/cline.js'

function makeText(text: string): ParserInput {
  return { text, sourcePath: 'cline-settings.json' }
}

function makeSettings(obj: Record<string, unknown>): ParserInput {
  return makeText(JSON.stringify(obj))
}

describe('cline parser 全参数综合测试', () => {
  // ===========================================================================
  // 1. pickApiFormat(apiProvider) 全分支
  // ===========================================================================
  describe('pickApiFormat(apiProvider) 全分支', () => {
    it('apiProvider=anthropic → anthropic_messages', async () => {
      const res = await parseCline(
        makeSettings({
          'cline.apiProvider': 'anthropic',
          'cline.apiKey': 'sk-ant-xxx',
          'cline.openAiBaseUrl': 'https://api.anthropic.com',
        }),
      )
      expect(res.providers[0]!.apiFormat).toBe('anthropic_messages')
    })

    it('apiProvider=gemini → gemini_native', async () => {
      const res = await parseCline(
        makeSettings({
          'cline.apiProvider': 'gemini',
          'cline.apiKey': 'AIza-xxx',
          'cline.openAiBaseUrl': 'https://generativelanguage.googleapis.com/v1beta',
        }),
      )
      expect(res.providers[0]!.apiFormat).toBe('gemini_native')
    })

    it('apiProvider=google → gemini_native (google 别名)', async () => {
      const res = await parseCline(
        makeSettings({
          'cline.apiProvider': 'google',
          'cline.apiKey': 'AIza-xxx',
          'cline.openAiBaseUrl': 'https://generativelanguage.googleapis.com/v1beta',
        }),
      )
      expect(res.providers[0]!.apiFormat).toBe('gemini_native')
    })

    it('apiProvider=openai → openai_chat', async () => {
      const res = await parseCline(
        makeSettings({
          'cline.apiProvider': 'openai',
          'cline.apiKey': 'sk-xxx',
          'cline.openAiBaseUrl': 'https://api.openai.com/v1',
        }),
      )
      expect(res.providers[0]!.apiFormat).toBe('openai_chat')
    })

    it('apiProvider=未知值 → openai_chat (default fallback)', async () => {
      const res = await parseCline(
        makeSettings({
          'cline.apiProvider': 'unknown-vendor',
          'cline.apiKey': 'sk-xxx',
          'cline.openAiBaseUrl': 'https://api.unknown.com/v1',
        }),
      )
      expect(res.providers[0]!.apiFormat).toBe('openai_chat')
    })

    it('apiProvider=空 → openai_chat (default fallback)', async () => {
      const res = await parseCline(
        makeSettings({
          'cline.apiProvider': '',
          'cline.apiKey': 'sk-xxx',
          'cline.openAiBaseUrl': 'https://api.openai.com/v1',
        }),
      )
      expect(res.providers[0]!.apiFormat).toBe('openai_chat')
    })

    it('apiProvider=大写 ANTHROPIC → anthropic_messages (toLowerCase 处理)', async () => {
      const res = await parseCline(
        makeSettings({
          'cline.apiProvider': 'ANTHROPIC',
          'cline.apiKey': 'sk-xxx',
          'cline.openAiBaseUrl': 'https://api.anthropic.com',
        }),
      )
      expect(res.providers[0]!.apiFormat).toBe('anthropic_messages')
    })

    it('apiProvider=GEMINI 大写 → gemini_native', async () => {
      const res = await parseCline(
        makeSettings({
          'cline.apiProvider': 'GEMINI',
          'cline.apiKey': 'sk-xxx',
          'cline.openAiBaseUrl': 'https://generativelanguage.googleapis.com/v1beta',
        }),
      )
      expect(res.providers[0]!.apiFormat).toBe('gemini_native')
    })

    it('无 apiProvider → openai_chat (default)', async () => {
      const res = await parseCline(
        makeSettings({
          'cline.apiKey': 'sk-xxx',
          'cline.openAiBaseUrl': 'https://api.openai.com/v1',
        }),
      )
      expect(res.providers[0]!.apiFormat).toBe('openai_chat')
    })
  })

  // ===========================================================================
  // 2. apiProvider vs baseUrl 冲突场景(apiProvider 优先)
  //   注意:与 cursor/windsurf 不同,cline 的 apiFormat 完全由 apiProvider 决定
  // ===========================================================================
  describe('apiProvider vs baseUrl 冲突(2026-07-22 修正后:apiProvider 主导 providerCode)', () => {
    it('apiProvider=anthropic 但 baseUrl=api.openai.com → apiFormat=anthropic_messages + providerCode=anthropic (一致)', async () => {
      // 修正前:providerCode=openai(baseUrl 推断),与 apiFormat=anthropic_messages 不一致
      // 修正后:providerCode=anthropic(apiProvider 主导),与 apiFormat 一致
      const res = await parseCline(
        makeSettings({
          'cline.apiProvider': 'anthropic',
          'cline.apiKey': 'sk-xxx',
          'cline.openAiBaseUrl': 'https://api.openai.com/v1',
        }),
      )
      expect(res.providers[0]!.apiFormat).toBe('anthropic_messages')
      expect(res.providers[0]!.providerCode).toBe('anthropic')
    })

    it('apiProvider=openai 但 baseUrl=api.anthropic.com → 仍 openai_chat + providerCode=anthropic (baseUrl 推断)', async () => {
      // apiProvider=openai 不主导 providerCode(因 openai 兼容多家),用 baseUrl 推断
      const res = await parseCline(
        makeSettings({
          'cline.apiProvider': 'openai',
          'cline.apiKey': 'sk-xxx',
          'cline.openAiBaseUrl': 'https://api.anthropic.com',
        }),
      )
      expect(res.providers[0]!.apiFormat).toBe('openai_chat')
      // apiProvider=openai → 走 inferProviderCode(baseUrl, apiFormat, model)
      // baseUrl=anthropic.com → providerCode=anthropic
      expect(res.providers[0]!.providerCode).toBe('anthropic')
    })

    it('apiProvider=gemini 但 baseUrl=api.openai.com → 仍 gemini_native + providerCode=google (apiProvider 主导)', async () => {
      const res = await parseCline(
        makeSettings({
          'cline.apiProvider': 'gemini',
          'cline.apiKey': 'sk-xxx',
          'cline.openAiBaseUrl': 'https://api.openai.com/v1',
        }),
      )
      expect(res.providers[0]!.apiFormat).toBe('gemini_native')
      // 修正后:apiProvider=gemini → providerCode=google(apiProvider 主导)
      expect(res.providers[0]!.providerCode).toBe('google')
    })

    it('apiProvider=anthropic 但 baseUrl=googleapis.com → 仍 anthropic_messages + providerCode=anthropic (apiProvider 主导)', async () => {
      // 修正前:providerCode=google(baseUrl 推断),与 apiFormat=anthropic_messages 不一致
      // 修正后:providerCode=anthropic(apiProvider 主导),与 apiFormat 一致
      const res = await parseCline(
        makeSettings({
          'cline.apiProvider': 'anthropic',
          'cline.apiKey': 'sk-xxx',
          'cline.openAiBaseUrl': 'https://generativelanguage.googleapis.com/v1beta',
        }),
      )
      expect(res.providers[0]!.apiFormat).toBe('anthropic_messages')
      expect(res.providers[0]!.providerCode).toBe('anthropic')
    })
  })

  // ===========================================================================
  // 3. 必填字段校验
  // ===========================================================================
  describe('必填字段校验', () => {
    it('无 apiKey → providers 空 + warning', async () => {
      const res = await parseCline(
        makeSettings({
          'cline.apiProvider': 'openai',
          'cline.openAiBaseUrl': 'https://api.openai.com/v1',
        }),
      )
      expect(res.providers).toHaveLength(0)
      expect(res.globalWarnings.length).toBeGreaterThan(0)
      expect(res.globalWarnings[0]).toContain('cline.apiKey')
    })

    it('无 baseUrl → providers 空 + warning', async () => {
      const res = await parseCline(
        makeSettings({
          'cline.apiProvider': 'openai',
          'cline.apiKey': 'sk-xxx',
        }),
      )
      expect(res.providers).toHaveLength(0)
      expect(res.globalWarnings.length).toBeGreaterThan(0)
      expect(res.globalWarnings[0]).toContain('cline.openAiBaseUrl')
    })

    it('空对象 → providers 空 + warning(无 apiKey)', async () => {
      const res = await parseCline(makeSettings({}))
      expect(res.providers).toHaveLength(0)
      expect(res.globalWarnings.length).toBeGreaterThan(0)
    })

    it('apiKey 空字符串 → 视为无 apiKey', async () => {
      const res = await parseCline(
        makeSettings({
          'cline.apiProvider': 'openai',
          'cline.apiKey': '',
          'cline.openAiBaseUrl': 'https://api.openai.com/v1',
        }),
      )
      expect(res.providers).toHaveLength(0)
      expect(res.globalWarnings.length).toBeGreaterThan(0)
    })

    it('baseUrl 空字符串 → 视为无 baseUrl', async () => {
      const res = await parseCline(
        makeSettings({
          'cline.apiProvider': 'openai',
          'cline.apiKey': 'sk-xxx',
          'cline.openAiBaseUrl': '',
        }),
      )
      expect(res.providers).toHaveLength(0)
      expect(res.globalWarnings.length).toBeGreaterThan(0)
    })
  })

  // ===========================================================================
  // 4. providerCode 推断(基于 baseUrl)
  // ===========================================================================
  describe('providerCode 推断', () => {
    it('api.openai.com → openai', async () => {
      const res = await parseCline(
        makeSettings({
          'cline.apiProvider': 'openai',
          'cline.apiKey': 'sk-xxx',
          'cline.openAiBaseUrl': 'https://api.openai.com/v1',
        }),
      )
      expect(res.providers[0]!.providerCode).toBe('openai')
    })

    it('api.anthropic.com → anthropic', async () => {
      const res = await parseCline(
        makeSettings({
          'cline.apiProvider': 'anthropic',
          'cline.apiKey': 'sk-xxx',
          'cline.openAiBaseUrl': 'https://api.anthropic.com',
        }),
      )
      expect(res.providers[0]!.providerCode).toBe('anthropic')
    })

    it('googleapis.com → google', async () => {
      const res = await parseCline(
        makeSettings({
          'cline.apiProvider': 'gemini',
          'cline.apiKey': 'sk-xxx',
          'cline.openAiBaseUrl': 'https://generativelanguage.googleapis.com/v1beta',
        }),
      )
      expect(res.providers[0]!.providerCode).toBe('google')
    })

    it('api.deepseek.com → deepseek', async () => {
      const res = await parseCline(
        makeSettings({
          'cline.apiProvider': 'openai',
          'cline.apiKey': 'sk-xxx',
          'cline.openAiBaseUrl': 'https://api.deepseek.com',
        }),
      )
      expect(res.providers[0]!.providerCode).toBe('deepseek')
    })
  })

  // ===========================================================================
  // 5. 字段读取正确性
  // ===========================================================================
  describe('字段读取正确性', () => {
    it('apiKey + model + baseUrl 全字段正确读取', async () => {
      const res = await parseCline(
        makeSettings({
          'cline.apiProvider': 'openai',
          'cline.apiKey': 'sk-cline-12345',
          'cline.openAiBaseUrl': 'https://api.openai.com/v1',
          'cline.openAiModelId': 'gpt-4-turbo',
        }),
      )
      const p = res.providers[0]!
      expect(p.apiKey).toBe('sk-cline-12345')
      expect(p.baseUrl).toBe('https://api.openai.com/v1')
      expect(p.modelIdForTest).toBe('gpt-4-turbo')
      expect(p.meta?.models).toEqual(['gpt-4-turbo'])
    })

    it('meta.category + meta.websiteUrl + sourceId 是 Cline 专属', async () => {
      const res = await parseCline(
        makeSettings({
          'cline.apiProvider': 'openai',
          'cline.apiKey': 'sk-xxx',
          'cline.openAiBaseUrl': 'https://api.openai.com/v1',
        }),
      )
      const p = res.providers[0]!
      expect(p.meta?.category).toBe('Cline')
      expect(p.meta?.websiteUrl).toBe('https://cline.bot')
      expect(p.sourceId).toBe('cline-default')
    })

    it('isCurrent 总是 true', async () => {
      const res = await parseCline(
        makeSettings({
          'cline.apiProvider': 'openai',
          'cline.apiKey': 'sk-xxx',
          'cline.openAiBaseUrl': 'https://api.openai.com/v1',
        }),
      )
      expect(res.providers[0]!.isCurrent).toBe(true)
    })

    it('无 model → meta.models 不存在', async () => {
      const res = await parseCline(
        makeSettings({
          'cline.apiProvider': 'openai',
          'cline.apiKey': 'sk-xxx',
          'cline.openAiBaseUrl': 'https://api.openai.com/v1',
        }),
      )
      expect(res.providers[0]!.meta?.models).toBeUndefined()
      expect(res.providers[0]!.modelIdForTest).toBeUndefined()
    })

    it('normalizeProvider 不加 warnings(字段完整时)', async () => {
      const res = await parseCline(
        makeSettings({
          'cline.apiProvider': 'openai',
          'cline.apiKey': 'sk-xxx',
          'cline.openAiBaseUrl': 'https://api.openai.com/v1',
        }),
      )
      expect(res.providers[0]!.warnings).toEqual([])
    })
  })

  // ===========================================================================
  // 6. 异常输入
  // ===========================================================================
  describe('异常输入', () => {
    it('非 JSON → 抛异常', async () => {
      await expect(parseCline(makeText('not json'))).rejects.toThrow()
    })

    it('空字符串 → 抛异常', async () => {
      await expect(parseCline(makeText(''))).rejects.toThrow()
    })

    it('只有空格 → 抛异常', async () => {
      await expect(parseCline(makeText('  \n\t  '))).rejects.toThrow()
    })

    it('JSON 解析错误信息含 Cline 标识', async () => {
      try {
        await parseCline(makeText('{invalid'))
        expect.fail('应抛异常')
      } catch (err) {
        expect((err as Error).message).toContain('Cline')
      }
    })
  })

  // ===========================================================================
  // 7. 跨平台隔离
  // ===========================================================================
  describe('跨平台隔离', () => {
    it('cursor 前缀字段被 cline parser 忽略', async () => {
      const res = await parseCline(
        makeSettings({
          'cursor.ai.apiKey': 'sk-xxx',
          'cursor.ai.baseUrl': 'https://api.openai.com/v1',
        }),
      )
      expect(res.providers).toHaveLength(0)
      expect(res.globalWarnings.length).toBeGreaterThan(0)
    })

    it('其他无关字段被忽略,只读 cline.* 字段', async () => {
      const res = await parseCline(
        makeSettings({
          'cline.apiProvider': 'openai',
          'cline.apiKey': 'sk-real',
          'cline.openAiBaseUrl': 'https://api.openai.com/v1',
          'cursor.ai.apiKey': 'ignored',
          'editor.fontSize': 14,
        }),
      )
      expect(res.providers).toHaveLength(1)
      expect(res.providers[0]!.apiKey).toBe('sk-real')
    })
  })
})
