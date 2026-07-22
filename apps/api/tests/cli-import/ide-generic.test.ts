/**
 * IDE Generic Parser 测试 — 验证 13 个平台的 URL/协议/参数不搞混
 */
import { describe, it, expect } from 'vitest'

import type { ParserInput } from '../../src/services/cli-import/parsers/types.js'
import {
  parseTrae, parseTraeWork, parseQoder, parseQoderWork,
  parseCodexDesktop, parseClaudeCodeDesktop,
  parseGithubCopilot, parseAmazonQ, parseContinue, parseTabnine, parseCody, parseZed,
  parseAntigravity,
} from '../../src/services/cli-import/parsers/ide-generic.js'

function makeInput(json: Record<string, unknown>): ParserInput {
  return { text: JSON.stringify(json), sourcePath: 'settings.json' }
}

describe('ide-generic parsers — URL/协议/providerCode 不搞混', () => {
  describe('Google Antigravity → gemini_native + google', () => {
    it('默认 baseUrl 为 Google Gemini API', async () => {
      const res = await parseAntigravity(makeInput({ 'antigravity.apiKey': 'AIza-xxx' }))
      expect(res.providers).toHaveLength(1)
      expect(res.providers[0]!.apiFormat).toBe('gemini_native')
      expect(res.providers[0]!.providerCode).toBe('google')
      expect(res.providers[0]!.baseUrl).toContain('generativelanguage.googleapis.com')
    })
    it('支持嵌套 JSON', async () => {
      const res = await parseAntigravity(makeInput({ antigravity: { apiKey: 'AIza-xxx', model: 'gemini-3-pro' } }))
      expect(res.providers).toHaveLength(1)
      expect(res.providers[0]!.apiFormat).toBe('gemini_native')
      expect(res.providers[0]!.modelIdForTest).toBe('gemini-3-pro')
    })
  })

  describe('Claude Code Desktop → anthropic_messages + anthropic', () => {
    it('默认 baseUrl 为 Anthropic API', async () => {
      const res = await parseClaudeCodeDesktop(makeInput({ 'claude.apiKey': 'sk-ant-xxx' }))
      expect(res.providers[0]!.apiFormat).toBe('anthropic_messages')
      expect(res.providers[0]!.providerCode).toBe('anthropic')
      expect(res.providers[0]!.baseUrl).toBe('https://api.anthropic.com')
    })
  })

  describe('Codex Desktop → openai_chat + openai', () => {
    it('默认 baseUrl 为 OpenAI API', async () => {
      const res = await parseCodexDesktop(makeInput({ 'codex.apiKey': 'sk-xxx' }))
      expect(res.providers[0]!.apiFormat).toBe('openai_chat')
      expect(res.providers[0]!.providerCode).toBe('openai')
      expect(res.providers[0]!.baseUrl).toBe('https://api.openai.com/v1')
    })
  })

  describe('GitHub Copilot → openai_chat + api.githubcopilot.com', () => {
    it('默认 baseUrl 为 Copilot API', async () => {
      const res = await parseGithubCopilot(makeInput({ 'github.copilot.apiKey': 'ghu-xxx' }))
      expect(res.providers[0]!.apiFormat).toBe('openai_chat')
      expect(res.providers[0]!.baseUrl).toBe('https://api.githubcopilot.com')
    })
  })

  describe('IDE 类(trae/qoder/zed 等)无默认 baseUrl → 缺失时 warning', () => {
    it('Trae: 只有 apiKey 没有 baseUrl → warning', async () => {
      const res = await parseTrae(makeInput({ 'trae.ai.apiKey': 'sk-xxx' }))
      expect(res.providers).toHaveLength(0)
      expect(res.globalWarnings.length).toBeGreaterThan(0)
    })
    it('Trae: 有 apiKey + baseUrl → 正常解析', async () => {
      const res = await parseTrae(makeInput({ 'trae.ai.apiKey': 'sk-xxx', 'trae.ai.baseUrl': 'https://api.deepseek.com/v1' }))
      expect(res.providers).toHaveLength(1)
      expect(res.providers[0]!.baseUrl).toBe('https://api.deepseek.com/v1')
      expect(res.providers[0]!.apiFormat).toBe('openai_chat')
    })
    it('Qoder: 无 apiKey → warning', async () => {
      const res = await parseQoder(makeInput({ 'qoder.ai.baseUrl': 'https://api.openai.com/v1' }))
      expect(res.providers).toHaveLength(0)
      expect(res.globalWarnings.length).toBeGreaterThan(0)
    })
    it('Zed: 有完整配置 → 正常解析', async () => {
      const res = await parseZed(makeInput({ 'zed.apiKey': 'sk-xxx', 'zed.baseUrl': 'https://api.openai.com/v1' }))
      expect(res.providers).toHaveLength(1)
    })
    it('Continue: 嵌套 JSON', async () => {
      const res = await parseContinue(makeInput({ continue: { apiKey: 'sk-xxx', baseUrl: 'https://api.openai.com/v1' } }))
      expect(res.providers).toHaveLength(1)
    })
    it('Tabnine: 无 baseUrl → warning', async () => {
      const res = await parseTabnine(makeInput({ 'tabnine.apiKey': 'sk-xxx' }))
      expect(res.providers).toHaveLength(0)
    })
    it('Cody: 无 baseUrl → warning', async () => {
      const res = await parseCody(makeInput({ 'cody.apiKey': 'sk-xxx' }))
      expect(res.providers).toHaveLength(0)
    })
    it('Amazon Q: 无 baseUrl → warning', async () => {
      const res = await parseAmazonQ(makeInput({ 'amazon.q.apiKey': 'aws-xxx' }))
      expect(res.providers).toHaveLength(0)
    })
  })

  describe('跨平台不搞混验证', () => {
    it('Antigravity 不应该解析为 openai_chat', async () => {
      const res = await parseAntigravity(makeInput({ 'antigravity.apiKey': 'AIza-xxx' }))
      expect(res.providers[0]!.apiFormat).not.toBe('openai_chat')
      expect(res.providers[0]!.apiFormat).not.toBe('anthropic_messages')
    })
    it('Claude Code Desktop 不应该解析为 gemini_native', async () => {
      const res = await parseClaudeCodeDesktop(makeInput({ 'claude.apiKey': 'sk-ant-xxx' }))
      expect(res.providers[0]!.apiFormat).not.toBe('gemini_native')
      expect(res.providers[0]!.apiFormat).not.toBe('openai_chat')
    })
    it('Codex Desktop 不应该解析为 anthropic_messages', async () => {
      const res = await parseCodexDesktop(makeInput({ 'codex.apiKey': 'sk-xxx' }))
      expect(res.providers[0]!.apiFormat).not.toBe('anthropic_messages')
      expect(res.providers[0]!.apiFormat).not.toBe('gemini_native')
    })
    it('Trae Work 与 Trae key 前缀不混', async () => {
      const resTrae = await parseTrae(makeInput({ 'trae.ai.apiKey': 'sk-trae', 'trae.ai.baseUrl': 'https://api.openai.com/v1' }))
      const resTraeWork = await parseTraeWork(makeInput({ 'trae.work.ai.apiKey': 'sk-trae-work', 'trae.work.ai.baseUrl': 'https://api.openai.com/v1' }))
      expect(resTrae.providers[0]!.apiKey).toBe('sk-trae')
      expect(resTraeWork.providers[0]!.apiKey).toBe('sk-trae-work')
    })
    it('Qoder Work 与 Qoder key 前缀不混', async () => {
      const resQoder = await parseQoder(makeInput({ 'qoder.ai.apiKey': 'sk-qoder', 'qoder.ai.baseUrl': 'https://api.openai.com/v1' }))
      const resQoderWork = await parseQoderWork(makeInput({ 'qoder.work.ai.apiKey': 'sk-qoder-work', 'qoder.work.ai.baseUrl': 'https://api.openai.com/v1' }))
      expect(resQoder.providers[0]!.apiKey).toBe('sk-qoder')
      expect(resQoderWork.providers[0]!.apiKey).toBe('sk-qoder-work')
    })
    it('空输入抛异常', async () => {
      await expect(parseAntigravity({ text: '', sourcePath: '' })).rejects.toThrow()
    })
    it('非 JSON 抛异常', async () => {
      await expect(parseTrae({ text: 'not json', sourcePath: '' })).rejects.toThrow()
    })
  })
})
