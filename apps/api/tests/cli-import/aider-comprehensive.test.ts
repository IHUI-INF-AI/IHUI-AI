/**
 * aider parser 全参数综合测试
 *
 * 重点验证 aider 的特殊逻辑:
 *   - YAML 简单行解析(不引入 js-yaml)
 *   - 双 provider(OpenAI + Anthropic)共存
 *   - isCurrent 由 model 前缀决定(claude-* → anthropic,gpt-* → openai)
 *   - 默认 baseUrl 缺失时使用内置 fallback
 *
 * 覆盖:
 *   1. 双 provider 共存场景
 *   2. 单 provider(只有 OpenAI / 只有 Anthropic)
 *   3. 默认 baseUrl fallback(openai-api-base / anthropic-api-base 缺失)
 *   4. isCurrent 由 model 前缀决定
 *   5. model 与现有 provider 不匹配场景
 *   6. YAML 格式变体(单引号 / 双引号 / 无引号 / 注释 / 空行)
 *   7. providerCode 推断
 *   8. 字段读取 + sanitizeProviderName
 *   9. 异常输入(空 / 纯注释 / 非 YAML)
 *  10. 跨字段边界(冒号后空格 / 值含冒号)
 */
import { describe, it, expect } from 'vitest'

import type { ParserInput } from '../../src/services/cli-import/parsers/types.js'
import { parseAider } from '../../src/services/cli-import/parsers/aider.js'

function makeText(text: string): ParserInput {
  return { text, sourcePath: '.aider.conf.yml' }
}

describe('aider parser 全参数综合测试', () => {
  // ===========================================================================
  // 1. 双 provider 共存场景
  // ===========================================================================
  describe('双 provider 共存', () => {
    it('OpenAI + Anthropic 双 provider 完整配置', async () => {
      const res = await parseAider(
        makeText(
          [
            'model: claude-3-opus',
            'openai-api-key: sk-openai',
            'openai-api-base: https://api.openai.com/v1',
            'anthropic-api-key: sk-ant-xxx',
            'anthropic-api-base: https://api.anthropic.com',
          ].join('\n'),
        ),
      )
      expect(res.providers).toHaveLength(2)
      const openai = res.providers.find((p) => p.sourceId === 'aider::openai')
      const anthropic = res.providers.find((p) => p.sourceId === 'aider::anthropic')
      expect(openai).toBeDefined()
      expect(anthropic).toBeDefined()
      expect(openai!.apiFormat).toBe('openai_chat')
      expect(anthropic!.apiFormat).toBe('anthropic_messages')
    })

    it('model=claude-* → anthropic isCurrent=true, openai isCurrent=false', async () => {
      const res = await parseAider(
        makeText(
          [
            'model: claude-3-opus',
            'openai-api-key: sk-openai',
            'anthropic-api-key: sk-ant-xxx',
          ].join('\n'),
        ),
      )
      const openai = res.providers.find((p) => p.sourceId === 'aider::openai')
      const anthropic = res.providers.find((p) => p.sourceId === 'aider::anthropic')
      expect(anthropic!.isCurrent).toBe(true)
      expect(openai!.isCurrent).toBe(false)
    })

    it('model=gpt-* → openai isCurrent=true, anthropic isCurrent=false', async () => {
      const res = await parseAider(
        makeText(
          [
            'model: gpt-4',
            'openai-api-key: sk-openai',
            'anthropic-api-key: sk-ant-xxx',
          ].join('\n'),
        ),
      )
      const openai = res.providers.find((p) => p.sourceId === 'aider::openai')
      const anthropic = res.providers.find((p) => p.sourceId === 'aider::anthropic')
      expect(openai!.isCurrent).toBe(true)
      expect(anthropic!.isCurrent).toBe(false)
    })

    it('model=其他(非 claude/gpt) → 默认 openai isCurrent', async () => {
      const res = await parseAider(
        makeText(
          [
            'model: deepseek-coder',
            'openai-api-key: sk-openai',
            'anthropic-api-key: sk-ant-xxx',
          ].join('\n'),
        ),
      )
      // defaultModel 非 claude- 前缀,targetId='aider::openai',openai isCurrent
      const openai = res.providers.find((p) => p.sourceId === 'aider::openai')
      expect(openai!.isCurrent).toBe(true)
    })

    it('model=空 → 默认 openai isCurrent(因 targetId 找不到 → fallback idx=0)', async () => {
      const res = await parseAider(
        makeText(
          ['model: ', 'openai-api-key: sk-openai', 'anthropic-api-key: sk-ant-xxx'].join('\n'),
        ),
      )
      // parseYamlSimple: 'model:' 后值空 → cfg.model = ''
      // defaultModel = '' 非 claude- 前缀 → targetId='aider::openai'
      const openai = res.providers.find((p) => p.sourceId === 'aider::openai')
      expect(openai!.isCurrent).toBe(true)
    })
  })

  // ===========================================================================
  // 2. 单 provider
  // ===========================================================================
  describe('单 provider', () => {
    it('只有 OpenAI key → 单 provider + isCurrent=true', async () => {
      const res = await parseAider(makeText('model: gpt-4\nopenai-api-key: sk-xxx'))
      expect(res.providers).toHaveLength(1)
      expect(res.providers[0]!.sourceId).toBe('aider::openai')
      expect(res.providers[0]!.apiFormat).toBe('openai_chat')
      expect(res.providers[0]!.isCurrent).toBe(true)
    })

    it('只有 Anthropic key → 单 provider + isCurrent=true(因 targetId=anthropic 找到)', async () => {
      const res = await parseAider(
        makeText('model: claude-3\nanthropic-api-key: sk-ant-xxx'),
      )
      expect(res.providers).toHaveLength(1)
      expect(res.providers[0]!.sourceId).toBe('aider::anthropic')
      expect(res.providers[0]!.apiFormat).toBe('anthropic_messages')
      // model=claude- → targetId=anthropic,找到 → isCurrent=true
      expect(res.providers[0]!.isCurrent).toBe(true)
    })

    it('只有 Anthropic key + model=gpt-* → 单 provider 但 isCurrent=true(因 idx=0)', async () => {
      const res = await parseAider(makeText('model: gpt-4\nanthropic-api-key: sk-ant-xxx'))
      expect(res.providers).toHaveLength(1)
      // model=gpt- → targetId='aider::openai' → findIndex=-1 → idx=Math.max(0,-1)=0
      // providers[0] 是 anthropic → isCurrent=true
      expect(res.providers[0]!.sourceId).toBe('aider::anthropic')
      expect(res.providers[0]!.isCurrent).toBe(true)
    })
  })

  // ===========================================================================
  // 3. 默认 baseUrl fallback
  // ===========================================================================
  describe('默认 baseUrl fallback', () => {
    it('openai-api-base 缺失 → 默认 https://api.openai.com/v1', async () => {
      const res = await parseAider(makeText('model: gpt-4\nopenai-api-key: sk-xxx'))
      expect(res.providers[0]!.baseUrl).toBe('https://api.openai.com/v1')
    })

    it('anthropic-api-base 缺失 → 默认 https://api.anthropic.com', async () => {
      const res = await parseAider(makeText('model: claude-3\nanthropic-api-key: sk-ant-xxx'))
      expect(res.providers[0]!.baseUrl).toBe('https://api.anthropic.com')
    })

    it('双 provider 都无 baseUrl → 都用默认值', async () => {
      const res = await parseAider(
        makeText('model: gpt-4\nopenai-api-key: sk-a\nanthropic-api-key: sk-b'),
      )
      const openai = res.providers.find((p) => p.sourceId === 'aider::openai')
      const anthropic = res.providers.find((p) => p.sourceId === 'aider::anthropic')
      expect(openai!.baseUrl).toBe('https://api.openai.com/v1')
      expect(anthropic!.baseUrl).toBe('https://api.anthropic.com')
    })

    it('显式 baseUrl 覆盖默认值', async () => {
      const res = await parseAider(
        makeText(
          [
            'model: gpt-4',
            'openai-api-key: sk-xxx',
            'openai-api-base: https://custom.openai-proxy.com/v1',
          ].join('\n'),
        ),
      )
      expect(res.providers[0]!.baseUrl).toBe('https://custom.openai-proxy.com/v1')
    })
  })

  // ===========================================================================
  // 4. isCurrent 由 model 前缀决定
  // ===========================================================================
  describe('isCurrent 逻辑深度验证', () => {
    it('model=claude-3-opus 双 provider → anthropic isCurrent', async () => {
      const res = await parseAider(
        makeText(
          [
            'model: claude-3-opus',
            'openai-api-key: sk-a',
            'anthropic-api-key: sk-b',
          ].join('\n'),
        ),
      )
      const openai = res.providers.find((p) => p.sourceId === 'aider::openai')
      const anthropic = res.providers.find((p) => p.sourceId === 'aider::anthropic')
      expect(anthropic!.isCurrent).toBe(true)
      expect(openai!.isCurrent).toBe(false)
    })

    it('model=claude-3-7-sonnet 前缀匹配 → anthropic isCurrent', async () => {
      const res = await parseAider(
        makeText(
          [
            'model: claude-3-7-sonnet-20250219',
            'openai-api-key: sk-a',
            'anthropic-api-key: sk-b',
          ].join('\n'),
        ),
      )
      const anthropic = res.providers.find((p) => p.sourceId === 'aider::anthropic')
      expect(anthropic!.isCurrent).toBe(true)
    })

    it('双 provider 同时 isCurrent=false → 然后由 targetId 设置一个 true', async () => {
      // 先 push 时 isCurrent=false,后续根据 targetId 设置 true
      const res = await parseAider(
        makeText(
          [
            'model: gpt-4o',
            'openai-api-key: sk-a',
            'anthropic-api-key: sk-b',
          ].join('\n'),
        ),
      )
      // model=gpt- → targetId='aider::openai' → openai isCurrent=true
      const openai = res.providers.find((p) => p.sourceId === 'aider::openai')
      const anthropic = res.providers.find((p) => p.sourceId === 'aider::anthropic')
      expect(openai!.isCurrent).toBe(true)
      expect(anthropic!.isCurrent).toBe(false)
    })
  })

  // ===========================================================================
  // 5. model 与现有 provider 不匹配场景
  // ===========================================================================
  describe('model 与 provider 不匹配', () => {
    it('model=claude-* 但只有 openai-api-key → openai provider 创建,model 不进 meta', async () => {
      const res = await parseAider(
        makeText('model: claude-3-opus\nopenai-api-key: sk-xxx'),
      )
      expect(res.providers).toHaveLength(1)
      // defaultModel='claude-3-opus' 非 'gpt-' 前缀 → model=undefined → meta.models 不存在
      expect(res.providers[0]!.modelIdForTest).toBeUndefined()
      expect(res.providers[0]!.meta?.models).toBeUndefined()
    })

    it('model=gpt-* 但只有 anthropic-api-key → anthropic provider 创建,model 不进 meta', async () => {
      const res = await parseAider(
        makeText('model: gpt-4\nanthropic-api-key: sk-ant-xxx'),
      )
      expect(res.providers).toHaveLength(1)
      // defaultModel='gpt-4' 非 'claude-' 前缀 → anthropic model=undefined
      expect(res.providers[0]!.modelIdForTest).toBeUndefined()
      expect(res.providers[0]!.meta?.models).toBeUndefined()
    })
  })

  // ===========================================================================
  // 6. YAML 格式变体
  // ===========================================================================
  describe('YAML 格式变体', () => {
    it('单引号值', async () => {
      const res = await parseAider(makeText("openai-api-key: 'sk-single-quote'"))
      expect(res.providers[0]!.apiKey).toBe('sk-single-quote')
    })

    it('双引号值', async () => {
      const res = await parseAider(makeText('openai-api-key: "sk-double-quote"'))
      expect(res.providers[0]!.apiKey).toBe('sk-double-quote')
    })

    it('无引号值', async () => {
      const res = await parseAider(makeText('openai-api-key: sk-no-quote'))
      expect(res.providers[0]!.apiKey).toBe('sk-no-quote')
    })

    it('注释行被忽略', async () => {
      const res = await parseAider(
        makeText(
          [
            '# This is a comment',
            'model: gpt-4',
            '# Another comment',
            'openai-api-key: sk-xxx',
          ].join('\n'),
        ),
      )
      expect(res.providers).toHaveLength(1)
      expect(res.providers[0]!.apiKey).toBe('sk-xxx')
    })

    it('空行被忽略', async () => {
      const res = await parseAider(
        makeText(
          ['model: gpt-4', '', '   ', 'openai-api-key: sk-xxx', ''].join('\n'),
        ),
      )
      expect(res.providers).toHaveLength(1)
    })

    it('CRLF 换行兼容', async () => {
      const res = await parseAider(
        makeText('model: gpt-4\r\nopenai-api-key: sk-xxx\r\n'),
      )
      expect(res.providers).toHaveLength(1)
      expect(res.providers[0]!.apiKey).toBe('sk-xxx')
    })

    it('值含等号', async () => {
      // aider config YAML,值可以含等号
      const res = await parseAider(makeText('openai-api-key: sk-xxx=signature'))
      expect(res.providers[0]!.apiKey).toBe('sk-xxx=signature')
    })
  })

  // ===========================================================================
  // 7. providerCode 推断
  // ===========================================================================
  describe('providerCode 推断', () => {
    it('openai.com → openai', async () => {
      const res = await parseAider(
        makeText('model: gpt-4\nopenai-api-key: sk-xxx\nopenai-api-base: https://api.openai.com/v1'),
      )
      expect(res.providers[0]!.providerCode).toBe('openai')
    })

    it('anthropic.com → anthropic', async () => {
      const res = await parseAider(
        makeText('model: claude-3\nanthropic-api-key: sk-ant-xxx\nanthropic-api-base: https://api.anthropic.com'),
      )
      expect(res.providers[0]!.providerCode).toBe('anthropic')
    })

    it('自定义 baseUrl + 无 model 前缀 → custom', async () => {
      const res = await parseAider(
        makeText('model: my-model\nopenai-api-key: sk-xxx\nopenai-api-base: https://api.custom.com/v1'),
      )
      expect(res.providers[0]!.providerCode).toBe('custom')
    })

    it('model=gpt-* 兜底为 openai(即使 baseUrl 未知)', async () => {
      const res = await parseAider(
        makeText('model: gpt-4o\nopenai-api-key: sk-xxx\nopenai-api-base: https://api.unknown.com'),
      )
      // URL 不匹配,model 兜底 gpt- → openai
      expect(res.providers[0]!.providerCode).toBe('openai')
    })

    it('model=claude-* 兜底为 anthropic(即使 baseUrl 未知)', async () => {
      const res = await parseAider(
        makeText('model: claude-3\nanthropic-api-key: sk-ant-xxx\nanthropic-api-base: https://api.unknown.com'),
      )
      expect(res.providers[0]!.providerCode).toBe('anthropic')
    })
  })

  // ===========================================================================
  // 8. 字段读取 + sanitizeProviderName
  // ===========================================================================
  describe('字段读取正确性', () => {
    it('meta.category + meta.websiteUrl 是 Aider 专属', async () => {
      const res = await parseAider(makeText('model: gpt-4\nopenai-api-key: sk-xxx'))
      expect(res.providers[0]!.meta?.category).toBe('Aider')
      expect(res.providers[0]!.meta?.websiteUrl).toBe('https://aider.chat')
    })

    it('model 进入 meta.models 数组(当前 provider 匹配时)', async () => {
      const res = await parseAider(
        makeText('model: gpt-4\nopenai-api-key: sk-xxx\nopenai-api-base: https://api.openai.com/v1'),
      )
      expect(res.providers[0]!.meta?.models).toEqual(['gpt-4'])
      expect(res.providers[0]!.modelIdForTest).toBe('gpt-4')
    })

    it('sourceId 用 aider::openai / aider::anthropic 格式', async () => {
      const res = await parseAider(
        makeText(
          [
            'model: gpt-4',
            'openai-api-key: sk-a',
            'anthropic-api-key: sk-b',
          ].join('\n'),
        ),
      )
      const ids = res.providers.map((p) => p.sourceId).sort()
      expect(ids).toEqual(['aider::anthropic', 'aider::openai'])
    })

    it('sanitizeProviderName 应用到 name(HTML 转义)', async () => {
      // 普通 name 不需要转义,但应被 sanitizeProviderName 处理
      const res = await parseAider(makeText('openai-api-key: sk-xxx'))
      expect(res.providers[0]!.name).toBe('Aider OpenAI')
    })

    it('无 key → providers 空 + warning 含 aider 标识', async () => {
      const res = await parseAider(makeText('model: gpt-4'))
      expect(res.providers).toHaveLength(0)
      expect(res.globalWarnings.length).toBeGreaterThan(0)
      expect(res.globalWarnings[0]).toContain('aider')
    })
  })

  // ===========================================================================
  // 9. 异常输入
  // ===========================================================================
  describe('异常输入', () => {
    it('空字符串 → 抛异常', async () => {
      await expect(parseAider(makeText(''))).rejects.toThrow()
    })

    it('只有空格 → 抛异常', async () => {
      await expect(parseAider(makeText('  \n\t  '))).rejects.toThrow()
    })

    it('纯注释文件 → providers 空 + warning(无 key)', async () => {
      const res = await parseAider(
        makeText('# only comments\n# another comment\n# yet another'),
      )
      expect(res.providers).toHaveLength(0)
      expect(res.globalWarnings.length).toBeGreaterThan(0)
    })

    it('纯空行文件 → 抛异常(text.trim() 拦截)', async () => {
      // aider.ts L42: if (!text.trim()) throw new Error('aider parser 输入为空')
      // 纯空行 trim 后为空字符串 → 抛异常(与"纯注释文件"行为不同,因注释被 parseYamlSimple 内部过滤,
      // 但空行在 trim 阶段就被拦下)
      await expect(parseAider(makeText('\n\n\n'))).rejects.toThrow('aider parser 输入为空')
    })
  })

  // ===========================================================================
  // 10. 跨字段边界(冒号后空格 / 值含冒号)
  // ===========================================================================
  describe('YAML 边界场景', () => {
    it('冒号后多空格被 trim', async () => {
      const res = await parseAider(makeText('openai-api-key:    sk-multi-space'))
      expect(res.providers[0]!.apiKey).toBe('sk-multi-space')
    })

    it('冒号后无空格 → 仍能解析(trim)', async () => {
      // parseYamlSimple 用 indexOf(':') 然后 slice(colon+1)
      const res = await parseAider(makeText('openai-api-key:sk-xxx'))
      expect(res.providers[0]!.apiKey).toBe('sk-xxx')
    })

    it('值含冒号(如 URL)', async () => {
      const res = await parseAider(
        makeText('openai-api-key: sk-xxx\nopenai-api-base: https://api.openai.com:8080/v1'),
      )
      // parseYamlSimple 用第一个冒号切分,值保留后续冒号
      expect(res.providers[0]!.baseUrl).toBe('https://api.openai.com:8080/v1')
    })

    it('key 前有缩进被 trim', async () => {
      const res = await parseAider(makeText('  openai-api-key: sk-indented'))
      expect(res.providers[0]!.apiKey).toBe('sk-indented')
    })

    it('行尾有空格被 trim', async () => {
      const res = await parseAider(makeText('openai-api-key: sk-trailing   '))
      expect(res.providers[0]!.apiKey).toBe('sk-trailing')
    })
  })
})
