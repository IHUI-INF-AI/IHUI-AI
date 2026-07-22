/**
 * cursor parser 全参数综合测试
 *
 * 覆盖:
 *   1. URL/协议不搞混(8 大厂商 + GitHub Copilot + 未知)
 *   2. model 前缀与 baseUrl 冲突时的协议推断
 *   3. 必填字段校验(无 apiKey / 无 baseUrl / 空对象)
 *   4. providerCode 推断(基于 baseUrl + model)
 *   5. 字段读取(name / apiKey / model / meta / sourceId / isCurrent)
 *   6. 异常输入(非 JSON / 空字符串)
 *   7. 大小写不敏感
 */
import { describe, it, expect } from 'vitest'

import type { ParserInput } from '../../src/services/cli-import/parsers/types.js'
import { parseCursor } from '../../src/services/cli-import/parsers/cursor.js'

function makeText(text: string): ParserInput {
  return { text, sourcePath: 'cursor-settings.json' }
}

function makeSettings(obj: Record<string, unknown>): ParserInput {
  return makeText(JSON.stringify(obj))
}

describe('cursor parser 全参数综合测试', () => {
  // ===========================================================================
  // 1. URL/协议不搞混(8 大厂商 + GitHub Copilot + 未知)
  // ===========================================================================
  describe('URL/协议不搞混', () => {
    it('api.openai.com → openai_chat', async () => {
      const res = await parseCursor(
        makeSettings({
          'cursor.ai.apiKey': 'sk-xxx',
          'cursor.ai.baseUrl': 'https://api.openai.com/v1',
        }),
      )
      expect(res.providers[0]!.apiFormat).toBe('openai_chat')
      expect(res.providers[0]!.providerCode).toBe('openai')
    })

    it('api.anthropic.com → anthropic_messages', async () => {
      const res = await parseCursor(
        makeSettings({
          'cursor.ai.apiKey': 'sk-ant-xxx',
          'cursor.ai.baseUrl': 'https://api.anthropic.com',
        }),
      )
      expect(res.providers[0]!.apiFormat).toBe('anthropic_messages')
      expect(res.providers[0]!.providerCode).toBe('anthropic')
    })

    it('googleapis.com → gemini_native + providerCode=google', async () => {
      const res = await parseCursor(
        makeSettings({
          'cursor.ai.apiKey': 'AIza-xxx',
          'cursor.ai.baseUrl': 'https://generativelanguage.googleapis.com/v1beta',
        }),
      )
      expect(res.providers[0]!.apiFormat).toBe('gemini_native')
      expect(res.providers[0]!.providerCode).toBe('google')
    })

    it('generativelanguage 别名 → gemini_native', async () => {
      const res = await parseCursor(
        makeSettings({
          'cursor.ai.apiKey': 'AIza-xxx',
          'cursor.ai.baseUrl': 'https://generativelanguage.googleapis.com',
        }),
      )
      expect(res.providers[0]!.apiFormat).toBe('gemini_native')
    })

    it('api.deepseek.com → openai_chat (default fallback)', async () => {
      const res = await parseCursor(
        makeSettings({
          'cursor.ai.apiKey': 'sk-xxx',
          'cursor.ai.baseUrl': 'https://api.deepseek.com',
        }),
      )
      expect(res.providers[0]!.apiFormat).toBe('openai_chat')
      expect(res.providers[0]!.providerCode).toBe('deepseek')
    })

    it('api.moonshot.cn → openai_chat + providerCode=moonshot', async () => {
      const res = await parseCursor(
        makeSettings({
          'cursor.ai.apiKey': 'sk-xxx',
          'cursor.ai.baseUrl': 'https://api.moonshot.cn/v1',
        }),
      )
      expect(res.providers[0]!.apiFormat).toBe('openai_chat')
      expect(res.providers[0]!.providerCode).toBe('moonshot')
    })

    it('api.bigmodel.cn → openai_chat + providerCode=zhipu', async () => {
      const res = await parseCursor(
        makeSettings({
          'cursor.ai.apiKey': 'xxx',
          'cursor.ai.baseUrl': 'https://open.bigmodel.cn/api/paas/v4',
        }),
      )
      expect(res.providers[0]!.apiFormat).toBe('openai_chat')
      expect(res.providers[0]!.providerCode).toBe('zhipu')
    })

    it('api.githubcopilot.com → openai_chat', async () => {
      const res = await parseCursor(
        makeSettings({
          'cursor.ai.apiKey': 'ghu-xxx',
          'cursor.ai.baseUrl': 'https://api.githubcopilot.com',
        }),
      )
      expect(res.providers[0]!.apiFormat).toBe('openai_chat')
    })

    it('未知 URL (api.unknown.com) → openai_chat (default fallback) + providerCode=custom', async () => {
      const res = await parseCursor(
        makeSettings({
          'cursor.ai.apiKey': 'sk-xxx',
          'cursor.ai.baseUrl': 'https://api.unknown.com/v1',
        }),
      )
      expect(res.providers[0]!.apiFormat).toBe('openai_chat')
      expect(res.providers[0]!.providerCode).toBe('custom')
    })
  })

  // ===========================================================================
  // 2. model 前缀与 baseUrl 冲突时的协议推断
  // ===========================================================================
  describe('model 前缀与 baseUrl 冲突(2026-07-22 修正后)', () => {
    it('model=claude-* + openai.com → apiFormat=openai_chat (URL 优先) + providerCode=anthropic (model 优先)', async () => {
      // 修正后设计:apiFormat 由 URL 决定(接入点协议),providerCode 由 model 决定(实际模型归属)
      // 用户用 OpenAI 兼容代理调 Claude:apiFormat=openai_chat(用 OpenAI 协议),providerCode=anthropic(实际是 Claude)
      const res = await parseCursor(
        makeSettings({
          'cursor.ai.apiKey': 'sk-xxx',
          'cursor.ai.baseUrl': 'https://api.openai.com/v1',
          'cursor.ai.model': 'claude-3-opus',
        }),
      )
      expect(res.providers[0]!.apiFormat).toBe('openai_chat')
      expect(res.providers[0]!.providerCode).toBe('anthropic')
    })

    it('model=gemini-* + openai.com → apiFormat=openai_chat (URL 优先) + providerCode=google (model 优先)', async () => {
      const res = await parseCursor(
        makeSettings({
          'cursor.ai.apiKey': 'sk-xxx',
          'cursor.ai.baseUrl': 'https://api.openai.com/v1',
          'cursor.ai.model': 'gemini-1.5-pro',
        }),
      )
      expect(res.providers[0]!.apiFormat).toBe('openai_chat')
      expect(res.providers[0]!.providerCode).toBe('google')
    })

    it('model=gpt-* + anthropic.com → anthropic_messages (URL 优先)', async () => {
      const res = await parseCursor(
        makeSettings({
          'cursor.ai.apiKey': 'sk-xxx',
          'cursor.ai.baseUrl': 'https://api.anthropic.com',
          'cursor.ai.model': 'gpt-4',
        }),
      )
      // URL 命中 anthropic.com → anthropic_messages(接入点决定协议)
      expect(res.providers[0]!.apiFormat).toBe('anthropic_messages')
      // model=gpt- 优先 → providerCode=openai(但用户用 Anthropic 接入点调 GPT,model 反映实际模型)
      expect(res.providers[0]!.providerCode).toBe('openai')
    })

    it('无 model + anthropic.com → anthropic_messages (URL 判定)', async () => {
      const res = await parseCursor(
        makeSettings({
          'cursor.ai.apiKey': 'sk-xxx',
          'cursor.ai.baseUrl': 'https://api.anthropic.com',
        }),
      )
      expect(res.providers[0]!.apiFormat).toBe('anthropic_messages')
    })

    it('model=deepseek-* + openai.com → apiFormat=openai_chat (URL 优先) + providerCode=deepseek (model 优先)', async () => {
      // 修正前:providerCode=openai(URL 优先,model 兜底走不到)
      // 修正后:providerCode=deepseek(model 优先,反映实际模型归属)
      const res = await parseCursor(
        makeSettings({
          'cursor.ai.apiKey': 'sk-xxx',
          'cursor.ai.baseUrl': 'https://api.openai.com/v1',
          'cursor.ai.model': 'deepseek-coder',
        }),
      )
      expect(res.providers[0]!.apiFormat).toBe('openai_chat')
      expect(res.providers[0]!.providerCode).toBe('deepseek')
    })
  })

  // ===========================================================================
  // 3. 必填字段校验
  // ===========================================================================
  describe('必填字段校验', () => {
    it('无 apiKey → providers 空 + warning', async () => {
      const res = await parseCursor(
        makeSettings({
          'cursor.ai.baseUrl': 'https://api.openai.com/v1',
        }),
      )
      expect(res.providers).toHaveLength(0)
      expect(res.globalWarnings.length).toBeGreaterThan(0)
      expect(res.globalWarnings[0]).toContain('cursor.ai.apiKey')
    })

    it('无 baseUrl → providers 空 + warning(Cursor 无默认端点)', async () => {
      const res = await parseCursor(
        makeSettings({
          'cursor.ai.apiKey': 'sk-xxx',
        }),
      )
      expect(res.providers).toHaveLength(0)
      expect(res.globalWarnings.length).toBeGreaterThan(0)
      expect(res.globalWarnings[0]).toContain('cursor.ai.baseUrl')
    })

    it('空对象 → providers 空 + warning(无 apiKey)', async () => {
      const res = await parseCursor(makeSettings({}))
      expect(res.providers).toHaveLength(0)
      expect(res.globalWarnings.length).toBeGreaterThan(0)
    })

    it('apiKey 空字符串 → 视为无 apiKey(str() 过滤空串)', async () => {
      const res = await parseCursor(
        makeSettings({
          'cursor.ai.apiKey': '',
          'cursor.ai.baseUrl': 'https://api.openai.com/v1',
        }),
      )
      expect(res.providers).toHaveLength(0)
      expect(res.globalWarnings.length).toBeGreaterThan(0)
    })

    it('baseUrl 空字符串 → 视为无 baseUrl', async () => {
      const res = await parseCursor(
        makeSettings({
          'cursor.ai.apiKey': 'sk-xxx',
          'cursor.ai.baseUrl': '',
        }),
      )
      expect(res.providers).toHaveLength(0)
      expect(res.globalWarnings.length).toBeGreaterThan(0)
    })
  })

  // ===========================================================================
  // 4. providerCode 推断(基于 baseUrl + model)
  // ===========================================================================
  describe('providerCode 推断', () => {
    it('api.openai.com → openai', async () => {
      const res = await parseCursor(
        makeSettings({
          'cursor.ai.apiKey': 'sk-xxx',
          'cursor.ai.baseUrl': 'https://api.openai.com/v1',
        }),
      )
      expect(res.providers[0]!.providerCode).toBe('openai')
    })

    it('api.deepseek.com → deepseek', async () => {
      const res = await parseCursor(
        makeSettings({
          'cursor.ai.apiKey': 'sk-xxx',
          'cursor.ai.baseUrl': 'https://api.deepseek.com',
        }),
      )
      expect(res.providers[0]!.providerCode).toBe('deepseek')
    })

    it('api.moonshot.cn → moonshot', async () => {
      const res = await parseCursor(
        makeSettings({
          'cursor.ai.apiKey': 'sk-xxx',
          'cursor.ai.baseUrl': 'https://api.moonshot.cn/v1',
        }),
      )
      expect(res.providers[0]!.providerCode).toBe('moonshot')
    })

    it('localhost → local', async () => {
      const res = await parseCursor(
        makeSettings({
          'cursor.ai.apiKey': 'sk-xxx',
          'cursor.ai.baseUrl': 'http://127.0.0.1:8080/v1',
        }),
      )
      expect(res.providers[0]!.providerCode).toBe('local')
    })
  })

  // ===========================================================================
  // 5. 字段读取正确性
  // ===========================================================================
  describe('字段读取正确性', () => {
    it('apiKey + model + baseUrl 全字段正确读取', async () => {
      const res = await parseCursor(
        makeSettings({
          'cursor.ai.apiKey': 'sk-test-12345',
          'cursor.ai.baseUrl': 'https://api.openai.com/v1',
          'cursor.ai.model': 'gpt-4o-mini',
        }),
      )
      const p = res.providers[0]!
      expect(p.apiKey).toBe('sk-test-12345')
      expect(p.baseUrl).toBe('https://api.openai.com/v1')
      expect(p.modelIdForTest).toBe('gpt-4o-mini')
      expect(p.meta?.models).toEqual(['gpt-4o-mini'])
    })

    it('meta.category + meta.websiteUrl + sourceId', async () => {
      const res = await parseCursor(
        makeSettings({
          'cursor.ai.apiKey': 'sk-xxx',
          'cursor.ai.baseUrl': 'https://api.openai.com/v1',
        }),
      )
      const p = res.providers[0]!
      expect(p.meta?.category).toBe('Cursor')
      expect(p.meta?.websiteUrl).toBe('https://cursor.sh')
      expect(p.sourceId).toBe('cursor-default')
    })

    it('isCurrent 总是 true', async () => {
      const res = await parseCursor(
        makeSettings({
          'cursor.ai.apiKey': 'sk-xxx',
          'cursor.ai.baseUrl': 'https://api.openai.com/v1',
        }),
      )
      expect(res.providers[0]!.isCurrent).toBe(true)
    })

    it('无 model → meta.models 不存在', async () => {
      const res = await parseCursor(
        makeSettings({
          'cursor.ai.apiKey': 'sk-xxx',
          'cursor.ai.baseUrl': 'https://api.openai.com/v1',
        }),
      )
      expect(res.providers[0]!.meta?.models).toBeUndefined()
      expect(res.providers[0]!.modelIdForTest).toBeUndefined()
    })

    it('normalizeProvider 不加 warnings(baseUrl 和 apiKey 都有)', async () => {
      const res = await parseCursor(
        makeSettings({
          'cursor.ai.apiKey': 'sk-xxx',
          'cursor.ai.baseUrl': 'https://api.openai.com/v1',
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
      await expect(parseCursor(makeText('not json'))).rejects.toThrow()
    })

    it('空字符串 → 抛异常', async () => {
      await expect(parseCursor(makeText(''))).rejects.toThrow()
    })

    it('只有空格 → 抛异常', async () => {
      await expect(parseCursor(makeText('   \n  \t  '))).rejects.toThrow()
    })

    it('JSON 解析错误信息含 Cursor 标识', async () => {
      try {
        await parseCursor(makeText('{invalid'))
        expect.fail('应抛异常')
      } catch (err) {
        expect((err as Error).message).toContain('Cursor')
      }
    })
  })

  // ===========================================================================
  // 7. 大小写不敏感
  // ===========================================================================
  describe('大小写不敏感', () => {
    it('API.OPENAI.COM 大写 URL → openai_chat', async () => {
      const res = await parseCursor(
        makeSettings({
          'cursor.ai.apiKey': 'sk-xxx',
          'cursor.ai.baseUrl': 'HTTPS://API.OPENAI.COM/v1',
        }),
      )
      // inferApiFormat 用 toLowerCase()
      expect(res.providers[0]!.apiFormat).toBe('openai_chat')
    })

    it('Api.Anthropic.Com 混合大小写 → anthropic_messages', async () => {
      const res = await parseCursor(
        makeSettings({
          'cursor.ai.apiKey': 'sk-xxx',
          'cursor.ai.baseUrl': 'https://Api.Anthropic.Com',
        }),
      )
      expect(res.providers[0]!.apiFormat).toBe('anthropic_messages')
    })
  })

  // ===========================================================================
  // 8. 跨平台不搞混(与 windsurf/cline 等)
  // ===========================================================================
  describe('跨平台隔离', () => {
    it('windsurf 前缀字段被 cursor parser 忽略 → 无 apiKey warning', async () => {
      const res = await parseCursor(
        makeSettings({
          'windsurf.ai.apiKey': 'sk-xxx',
          'windsurf.ai.baseUrl': 'https://api.openai.com/v1',
        }),
      )
      // cursor parser 只读 cursor.ai.* 字段,windsurf 字段被忽略 → 无 apiKey
      expect(res.providers).toHaveLength(0)
      expect(res.globalWarnings.length).toBeGreaterThan(0)
    })

    it('其他字段(非 cursor.ai.* prefix)被忽略', async () => {
      const res = await parseCursor(
        makeSettings({
          'cursor.ai.apiKey': 'sk-xxx',
          'cursor.ai.baseUrl': 'https://api.openai.com/v1',
          // 干扰字段
          'editor.fontSize': 14,
          'workbench.colorTheme': 'Dark+',
          'random.apiKey': 'should-be-ignored',
        }),
      )
      expect(res.providers).toHaveLength(1)
      expect(res.providers[0]!.apiKey).toBe('sk-xxx')
    })
  })
})
