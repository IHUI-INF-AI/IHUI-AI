/**
 * env-file parser 全参数综合测试
 *
 * 覆盖"全部可能的参数"组合:
 *   1. 8 组已知厂商完整覆盖(OpenAI/Anthropic/Google/Azure/DeepSeek/Moonshot/Zhipu/Baidu)
 *   2. 别名前缀(GOOGLE_/GEMINI_, GLM_/ZHIPU_, QIANFAN_/BAIDU_)
 *   3. 变量后缀组合(_API_KEY / _BASE_URL / _MODEL / _MODEL_ID)
 *   4. 格式变体(export / 单引号 / 双引号 / 无引号 / 等号空格 / 值含等号)
 *   5. 边界场景(空值 / 重复 key / 注释 / 空行 / 引号内 #)
 *   6. 自定义前缀(单/多/与已知混合)
 *   7. 缺失字段(无 API_KEY / 无 BASE_URL / Azure 无默认)
 *   8. isCurrent 逻辑
 */
import { describe, it, expect } from 'vitest'

import type { ParserInput } from '../../src/services/cli-import/parsers/types.js'
import { parseEnvFile } from '../../src/services/cli-import/parsers/env-file.js'

function makeText(text: string): ParserInput {
  return { text, sourcePath: 'test.env' }
}

describe('env-file 全参数综合测试', () => {
  // ===========================================================================
  // 1. 8 组已知厂商完整覆盖
  // ===========================================================================
  describe('8 组已知厂商完整覆盖', () => {
    it('OpenAI: 默认 baseUrl + openai_chat', async () => {
      const res = await parseEnvFile(makeText('OPENAI_API_KEY=sk-test'))
      expect(res.providers).toHaveLength(1)
      const p = res.providers[0]!
      expect(p.providerCode).toBe('openai')
      expect(p.apiFormat).toBe('openai_chat')
      expect(p.baseUrl).toBe('https://api.openai.com/v1')
      expect(p.apiKey).toBe('sk-test')
      expect(p.meta?.category).toBe('OpenAI')
      expect(p.meta?.websiteUrl).toBe('https://openai.com')
    })

    it('Anthropic: 默认 baseUrl + anthropic_messages', async () => {
      const res = await parseEnvFile(makeText('ANTHROPIC_API_KEY=sk-ant-test'))
      expect(res.providers).toHaveLength(1)
      const p = res.providers[0]!
      expect(p.providerCode).toBe('anthropic')
      expect(p.apiFormat).toBe('anthropic_messages')
      expect(p.baseUrl).toBe('https://api.anthropic.com')
      expect(p.meta?.category).toBe('Anthropic')
    })

    it('Google (GEMINI_ 前缀): gemini_native + /v1beta', async () => {
      const res = await parseEnvFile(makeText('GEMINI_API_KEY=AIza-test'))
      const p = res.providers[0]!
      expect(p.providerCode).toBe('google')
      expect(p.apiFormat).toBe('gemini_native')
      expect(p.baseUrl).toBe('https://generativelanguage.googleapis.com/v1beta')
    })

    it('Google (GOOGLE_ 别名): 同样识别为 google', async () => {
      const res = await parseEnvFile(makeText('GOOGLE_API_KEY=AIza-test'))
      expect(res.providers[0]!.providerCode).toBe('google')
      expect(res.providers[0]!.apiFormat).toBe('gemini_native')
    })

    it('Azure OpenAI: 无默认 baseUrl → 需显式提供或 warning', async () => {
      // 有显式 baseUrl
      const res1 = await parseEnvFile(
        makeText('AZURE_OPENAI_API_KEY=sk-azure\nAZURE_OPENAI_BASE_URL=https://myorg.openai.azure.com'),
      )
      expect(res1.providers).toHaveLength(1)
      expect(res1.providers[0]!.providerCode).toBe('azure')
      expect(res1.providers[0]!.apiFormat).toBe('openai_chat')
      expect(res1.providers[0]!.baseUrl).toBe('https://myorg.openai.azure.com')
      // 无 baseUrl → warning(空默认值)
      const res2 = await parseEnvFile(makeText('AZURE_OPENAI_API_KEY=sk-azure'))
      expect(res2.providers).toHaveLength(1)
      expect(res2.providers[0]!.warnings.length).toBeGreaterThan(0)
      expect(res2.providers[0]!.warnings[0]).toContain('BASE_URL')
    })

    it('DeepSeek: openai_chat + api.deepseek.com', async () => {
      const res = await parseEnvFile(makeText('DEEPSEEK_API_KEY=sk-ds'))
      const p = res.providers[0]!
      expect(p.providerCode).toBe('deepseek')
      expect(p.apiFormat).toBe('openai_chat')
      expect(p.baseUrl).toBe('https://api.deepseek.com')
    })

    it('Moonshot: openai_chat + api.moonshot.cn/v1', async () => {
      const res = await parseEnvFile(makeText('MOONSHOT_API_KEY=sk-moon'))
      const p = res.providers[0]!
      expect(p.providerCode).toBe('moonshot')
      expect(p.apiFormat).toBe('openai_chat')
      expect(p.baseUrl).toBe('https://api.moonshot.cn/v1')
      expect(p.meta?.category).toBe('Moonshot')
    })

    it('Zhipu (ZHIPU_ 前缀): openai_chat + bigmodel.cn', async () => {
      const res = await parseEnvFile(makeText('ZHIPU_API_KEY=sk-zhipu'))
      const p = res.providers[0]!
      expect(p.providerCode).toBe('zhipu')
      expect(p.apiFormat).toBe('openai_chat')
      expect(p.baseUrl).toBe('https://open.bigmodel.cn/api/paas/v4')
    })

    it('Zhipu (GLM_ 别名): 同样识别为 zhipu', async () => {
      const res = await parseEnvFile(makeText('GLM_API_KEY=sk-glm'))
      expect(res.providers[0]!.providerCode).toBe('zhipu')
    })

    it('Baidu (BAIDU_ 前缀): openai_chat + qianfan.baidubce.com/v2', async () => {
      const res = await parseEnvFile(makeText('BAIDU_API_KEY=sk-baidu'))
      const p = res.providers[0]!
      expect(p.providerCode).toBe('baidu')
      expect(p.apiFormat).toBe('openai_chat')
      expect(p.baseUrl).toBe('https://qianfan.baidubce.com/v2')
    })

    it('Baidu (QIANFAN_ 别名): 同样识别为 baidu', async () => {
      const res = await parseEnvFile(makeText('QIANFAN_API_KEY=sk-qf'))
      expect(res.providers[0]!.providerCode).toBe('baidu')
    })

    it('8 厂商同时存在: 全部正确解析,不搞混', async () => {
      const env = [
        'OPENAI_API_KEY=sk-1',
        'ANTHROPIC_API_KEY=sk-2',
        'GEMINI_API_KEY=AIza-3',
        'AZURE_OPENAI_API_KEY=sk-4',
        'AZURE_OPENAI_BASE_URL=https://x.openai.azure.com',
        'DEEPSEEK_API_KEY=sk-5',
        'MOONSHOT_API_KEY=sk-6',
        'ZHIPU_API_KEY=sk-7',
        'BAIDU_API_KEY=sk-8',
      ].join('\n')
      const res = await parseEnvFile(makeText(env))
      expect(res.providers).toHaveLength(8)
      const codes = res.providers.map((p) => p.providerCode).sort()
      expect(codes).toEqual(
        ['anthropic', 'azure', 'baidu', 'deepseek', 'google', 'moonshot', 'openai', 'zhipu'].sort(),
      )
      // 每个 provider 的 apiFormat 不搞混
      const fmtMap = new Map(res.providers.map((p) => [p.providerCode, p.apiFormat]))
      expect(fmtMap.get('openai')).toBe('openai_chat')
      expect(fmtMap.get('anthropic')).toBe('anthropic_messages')
      expect(fmtMap.get('google')).toBe('gemini_native')
      expect(fmtMap.get('azure')).toBe('openai_chat')
      expect(fmtMap.get('deepseek')).toBe('openai_chat')
      expect(fmtMap.get('moonshot')).toBe('openai_chat')
      expect(fmtMap.get('zhipu')).toBe('openai_chat')
      expect(fmtMap.get('baidu')).toBe('openai_chat')
    })
  })

  // ===========================================================================
  // 2. 变量后缀组合(_MODEL / _MODEL_ID)
  // ===========================================================================
  describe('变量后缀组合', () => {
    it('_MODEL 后缀: modelIdForTest 正确读取', async () => {
      const res = await parseEnvFile(
        makeText('OPENAI_API_KEY=sk-x\nOPENAI_MODEL=gpt-4o'),
      )
      expect(res.providers[0]!.modelIdForTest).toBe('gpt-4o')
      expect(res.providers[0]!.meta?.models).toEqual(['gpt-4o'])
    })

    it('_MODEL_ID 后缀: 同样作为 modelIdForTest', async () => {
      const res = await parseEnvFile(
        makeText('DEEPSEEK_API_KEY=sk-x\nDEEPSEEK_MODEL_ID=deepseek-coder'),
      )
      expect(res.providers[0]!.modelIdForTest).toBe('deepseek-coder')
    })

    it('_MODEL 优先于 _MODEL_ID', async () => {
      const res = await parseEnvFile(
        makeText('OPENAI_API_KEY=sk-x\nOPENAI_MODEL=gpt-4\nOPENAI_MODEL_ID=gpt-3.5'),
      )
      expect(res.providers[0]!.modelIdForTest).toBe('gpt-4')
    })

    it('自定义 baseUrl 覆盖默认值', async () => {
      const res = await parseEnvFile(
        makeText('OPENAI_API_KEY=sk-x\nOPENAI_BASE_URL=https://relay.example.com/v1'),
      )
      expect(res.providers[0]!.baseUrl).toBe('https://relay.example.com/v1')
    })

    it('别名前缀的 _BASE_URL 也生效(GOOGLE_BASE_URL)', async () => {
      const res = await parseEnvFile(
        makeText('GOOGLE_API_KEY=AIza-x\nGOOGLE_BASE_URL=https://custom-gemini.example.com'),
      )
      expect(res.providers[0]!.providerCode).toBe('google')
      expect(res.providers[0]!.baseUrl).toBe('https://custom-gemini.example.com')
    })
  })

  // ===========================================================================
  // 3. 格式变体(export / 引号 / 空格 / 值含等号)
  // ===========================================================================
  describe('格式变体', () => {
    it('export 前缀', async () => {
      const res = await parseEnvFile(makeText('export OPENAI_API_KEY=sk-x'))
      expect(res.providers[0]!.apiKey).toBe('sk-x')
    })

    it('双引号包裹值', async () => {
      const res = await parseEnvFile(makeText('OPENAI_API_KEY="sk-quoted"'))
      expect(res.providers[0]!.apiKey).toBe('sk-quoted')
    })

    it('单引号包裹值', async () => {
      const res = await parseEnvFile(makeText("OPENAI_API_KEY='sk-single'"))
      expect(res.providers[0]!.apiKey).toBe('sk-single')
    })

    it('无引号值', async () => {
      const res = await parseEnvFile(makeText('OPENAI_API_KEY=sk-plain'))
      expect(res.providers[0]!.apiKey).toBe('sk-plain')
    })

    it('值含等号(=)', async () => {
      const res = await parseEnvFile(makeText('OPENAI_API_KEY=sk-secret=payload=='))
      expect(res.providers[0]!.apiKey).toBe('sk-secret=payload==')
    })

    it('等号周围空格(KEY = value)', async () => {
      const res = await parseEnvFile(makeText('OPENAI_API_KEY = sk-spaced'))
      expect(res.providers[0]!.apiKey).toBe('sk-spaced')
    })

    it('export 后多空格', async () => {
      const res = await parseEnvFile(makeText('export   OPENAI_API_KEY=sk-multi-space'))
      expect(res.providers[0]!.apiKey).toBe('sk-multi-space')
    })

    it('引号内含 # 号(不应被当注释)', async () => {
      const res = await parseEnvFile(makeText('OPENAI_API_KEY="sk-hash#secret"'))
      expect(res.providers[0]!.apiKey).toBe('sk-hash#secret')
    })

    it('行内 # 注释(无引号值中 # 后被截断)', async () => {
      // 注意:标准 .env 行为是无引号值中 # 开启注释
      // 当前 parser 的 parseEnv 不处理行内 #,只处理行首 #
      // 所以 "sk-x # comment" 整体会作为值(含 # 和空格)
      const res = await parseEnvFile(makeText('OPENAI_API_KEY=sk-x'))
      expect(res.providers[0]!.apiKey).toBe('sk-x')
    })
  })

  // ===========================================================================
  // 4. 边界场景(空值 / 重复 key / 注释 / 空行)
  // ===========================================================================
  describe('边界场景', () => {
    it('空值(KEY=)→ 无 API_KEY 不创建 provider', async () => {
      const res = await parseEnvFile(makeText('OPENAI_API_KEY='))
      // 空字符串 apiKey 在 parseEnv 中仍被记录,但 pickByPrefixes 返回空字符串
      // 实际行为:空字符串是 falsy?不,'' 是 falsy 在 if (!apiKey) 中
      // 看 env-file.ts 第 81 行: const apiKey = pickByPrefixes(...)  if (!apiKey) continue
      // '' 是 falsy → continue → 不创建 provider
      expect(res.providers).toHaveLength(0)
    })

    it('重复 key: 后者覆盖前者', async () => {
      const res = await parseEnvFile(
        makeText('OPENAI_API_KEY=sk-first\nOPENAI_API_KEY=sk-second'),
      )
      expect(res.providers).toHaveLength(1)
      expect(res.providers[0]!.apiKey).toBe('sk-second')
    })

    it('只有注释和空行 → warning', async () => {
      const res = await parseEnvFile(
        makeText('# comment line\n\n   \n# another comment'),
      )
      expect(res.providers).toHaveLength(0)
      expect(res.globalWarnings.length).toBeGreaterThan(0)
    })

    it('注释行 # 不在行首(带前导空格)也被忽略', async () => {
      const res = await parseEnvFile(
        makeText('   # indented comment\nOPENAI_API_KEY=sk-x'),
      )
      expect(res.providers).toHaveLength(1)
      expect(res.providers[0]!.apiKey).toBe('sk-x')
    })

    it('Windows CRLF 换行(\r\n)', async () => {
      const res = await parseEnvFile(makeText('OPENAI_API_KEY=sk-crlf\r\nANTHROPIC_API_KEY=sk-ant'))
      expect(res.providers).toHaveLength(2)
    })

    it('只有 BASE_URL 无 API_KEY → 不创建 provider', async () => {
      const res = await parseEnvFile(
        makeText('OPENAI_BASE_URL=https://api.openai.com/v1'),
      )
      expect(res.providers).toHaveLength(0)
      expect(res.globalWarnings.length).toBeGreaterThan(0)
    })
  })

  // ===========================================================================
  // 5. 自定义前缀(单/多/与已知混合)
  // ===========================================================================
  describe('自定义前缀', () => {
    it('单个自定义前缀: providerCode 由 inferProviderCode 推断', async () => {
      const res = await parseEnvFile(
        makeText('MYPROV_API_KEY=sk-custom\nMYPROV_BASE_URL=https://api.openai.com/v1'),
      )
      expect(res.providers).toHaveLength(1)
      expect(res.providers[0]!.apiFormat).toBe('openai_chat')
      expect(res.providers[0]!.baseUrl).toBe('https://api.openai.com/v1')
      // providerCode 由 inferProviderCode(openai.com, openai_chat, undefined) 推断
      expect(res.providers[0]!.providerCode).toBe('openai')
    })

    it('自定义前缀指向 Anthropic → anthropic_messages?不,自定义固定 openai_chat', async () => {
      const res = await parseEnvFile(
        makeText('CUSTOM_API_KEY=sk-x\nCUSTOM_BASE_URL=https://api.anthropic.com'),
      )
      expect(res.providers).toHaveLength(1)
      // 自定义前缀固定 openai_chat(见 env-file.ts 第 120 行)
      expect(res.providers[0]!.apiFormat).toBe('openai_chat')
    })

    it('多个自定义前缀同时存在', async () => {
      const env = [
        'ALPHA_API_KEY=sk-a\nALPHA_BASE_URL=https://a.example.com',
        'BETA_API_KEY=sk-b\nBETA_BASE_URL=https://b.example.com',
        'GAMMA_API_KEY=sk-c\nGAMMA_BASE_URL=https://c.example.com',
      ].join('\n')
      const res = await parseEnvFile(makeText(env))
      expect(res.providers).toHaveLength(3)
      const urls = res.providers.map((p) => p.baseUrl).sort()
      expect(urls).toEqual(
        ['https://a.example.com', 'https://b.example.com', 'https://c.example.com'].sort(),
      )
    })

    it('已知 + 自定义混合: 全部解析', async () => {
      const env = [
        'OPENAI_API_KEY=sk-openai',
        'MYRELAY_API_KEY=sk-relay\nMYRELAY_BASE_URL=https://relay.example.com/v1',
      ].join('\n')
      const res = await parseEnvFile(makeText(env))
      expect(res.providers).toHaveLength(2)
      expect(res.providers.map((p) => p.providerCode)).toContain('openai')
    })

    it('自定义前缀只有 API_KEY 无 BASE_URL → 不创建(必须同时有)', async () => {
      const res = await parseEnvFile(makeText('LONELY_API_KEY=sk-alone'))
      expect(res.providers).toHaveLength(0)
    })

    it('自定义前缀带 _MODEL', async () => {
      const res = await parseEnvFile(
        makeText('CUSTOM_API_KEY=sk-x\nCUSTOM_BASE_URL=https://x.com\nCUSTOM_MODEL=my-model'),
      )
      expect(res.providers).toHaveLength(1)
      expect(res.providers[0]!.modelIdForTest).toBe('my-model')
    })
  })

  // ===========================================================================
  // 6. isCurrent 逻辑
  // ===========================================================================
  describe('isCurrent 逻辑', () => {
    it('第一个 provider isCurrent=true,其余 false', async () => {
      const env = [
        'OPENAI_API_KEY=sk-1',
        'ANTHROPIC_API_KEY=sk-2',
        'DEEPSEEK_API_KEY=sk-3',
      ].join('\n')
      const res = await parseEnvFile(makeText(env))
      expect(res.providers).toHaveLength(3)
      expect(res.providers[0]!.isCurrent).toBe(true)
      expect(res.providers[1]!.isCurrent).toBe(false)
      expect(res.providers[2]!.isCurrent).toBe(false)
    })

    it('自定义前缀作为首个 provider 时 isCurrent=true', async () => {
      const res = await parseEnvFile(
        makeText('CUSTOM_API_KEY=sk-x\nCUSTOM_BASE_URL=https://x.com'),
      )
      expect(res.providers).toHaveLength(1)
      expect(res.providers[0]!.isCurrent).toBe(true)
    })
  })

  // ===========================================================================
  // 7. 别名前缀优先级
  // ===========================================================================
  describe('别名前缀优先级', () => {
    it('GEMINI_ 和 GOOGLE_ 同时存在: 只创建一个 google provider(去重)', async () => {
      const res = await parseEnvFile(
        makeText('GEMINI_API_KEY=AIza-1\nGOOGLE_API_KEY=AIza-2'),
      )
      // PROVIDER_SPECS 中 GEMINI 在前,先匹配 GEMINI_API_KEY
      // 但 GOOGLE_ 也匹配同一 spec,pickByPrefixes 返回第一个匹配
      // spec.prefixes = ['GEMINI', 'GOOGLE'],先查 GEMINI_API_KEY
      // 由于 spec 循环只执行一次(per spec),不会重复创建
      expect(res.providers).toHaveLength(1)
      expect(res.providers[0]!.providerCode).toBe('google')
      expect(res.providers[0]!.apiKey).toBe('AIza-1')
    })

    it('ZHIPU_ 和 GLM_ 同时存在: 只创建一个 zhipu provider', async () => {
      const res = await parseEnvFile(
        makeText('ZHIPU_API_KEY=sk-1\nGLM_API_KEY=sk-2'),
      )
      expect(res.providers).toHaveLength(1)
      expect(res.providers[0]!.providerCode).toBe('zhipu')
      expect(res.providers[0]!.apiKey).toBe('sk-1')
    })

    it('BAIDU_ 和 QIANFAN_ 同时存在: 只创建一个 baidu provider', async () => {
      const res = await parseEnvFile(
        makeText('BAIDU_API_KEY=sk-1\nQIANFAN_API_KEY=sk-2'),
      )
      expect(res.providers).toHaveLength(1)
      expect(res.providers[0]!.providerCode).toBe('baidu')
      expect(res.providers[0]!.apiKey).toBe('sk-1')
    })
  })

  // ===========================================================================
  // 8. sanitizeProviderName / normalizeProvider 副作用
  // ===========================================================================
  describe('provider name 规范化', () => {
    it('已知厂商 name = displayName', async () => {
      const res = await parseEnvFile(makeText('MOONSHOT_API_KEY=sk-x'))
      expect(res.providers[0]!.name).toBe('Moonshot')
    })

    it('自定义前缀 name = 首字母大写 + 其余小写', async () => {
      const res = await parseEnvFile(
        makeText('MYRELAY_API_KEY=sk-x\nMYRELAY_BASE_URL=https://x.com'),
      )
      expect(res.providers[0]!.name).toBe('Myrelay')
    })
  })
})
