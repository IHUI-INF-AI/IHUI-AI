// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { describe, expect, it } from 'vitest'
import type { Agent } from '@ihui/database'
import { mapCozeBotConfig, toCozePublicCapabilities } from '../../lib/coze-bot-config.js'

const basePayload = {
  bot_id: '7535001979559919616',
  name: '测试 Bot',
  description: '真实上游描述',
  icon_url: 'https://example.com/icon.png',
  create_time: 1760000000,
  update_time: 1760000100,
  version: '1.2.3.4',
  prompt_info: {
    prompt: '你是测试助手',
    prompt_mode: 'prefix',
    prefix_prompt_info: { prefix_prompt: '固定前缀', dynamic_prompt: '动态部分' },
  },
  onboarding_info: {
    Prologue: '你好，我是测试助手',
    SuggestedQuestions: ['问题一', '问题二'],
    OnboardingMode: 1,
  },
  bot_mode: 1,
  plugin_info_list: [
    {
      plugin_id: 'p1',
      name: '搜索插件',
      description: '联网搜索',
      icon_url: 'https://example.com/p.png',
      api_info_list: [{ api_id: 'a1', name: 'search', description: '搜索' }],
    },
  ],
  model_info: {
    model_id: 'm1',
    model_name: '豆包·1.5·Pro·32k',
    temperature: 0.8,
    top_p: 0.95,
    top_k: 50,
    max_tokens: 4096,
    context_round: 10,
    response_format: 'markdown',
    presence_penalty: 0.1,
    frequency_penalty: 0.2,
    api_mode: 'chat_api',
    cache_type: 'open',
    parameters: { thinking_type: 'enabled' },
  },
  folder_id: 'f1',
  owner_user_id: 'u1',
  knowledge: { knowledge_infos: [{ id: 'k1', name: '知识库一' }] },
  variables: [
    {
      enable: true,
      channel: 'custom',
      keyword: 'city',
      description: '城市',
      default_value: '长春',
      prompt_enable: true,
    },
  ],
  media_config: { is_voice_call_closed: true },
  voice_info_list: [{ voice_id: 'v1', language_code: 'zh' }],
  shortcut_commands: [
    {
      id: 's1',
      name: '查天气',
      command: 'weather',
      description: '查询天气',
      query_template: '{{city}}天气',
      icon_url: 'https://example.com/s.png',
      components: [{ name: 'city', type: 'text' }],
      tool: { name: 'weather', type: 'plugin' },
    },
  ],
  workflow_info_list: [
    { id: 'w1', name: '工作流一', description: '流程', icon_url: 'https://example.com/w.png' },
  ],
  background_image_info: {
    web_background_image: { image_url: 'https://example.com/bg.png', theme_color: '#fff' },
    mobile_background_image: { image_url: 'https://example.com/mbg.png' },
  },
  default_user_input_type: 'text',
  suggest_reply_info: { reply_mode: 'enable', customized_prompt: '推荐问题' },
  unknown_future_field: { nested: true },
}

describe('mapCozeBotConfig', () => {
  it('maps every BotInfo field into structured columns', () => {
    const mapped = mapCozeBotConfig(basePayload, 'get_bot_config')
    const p = mapped.patch

    expect(p.botId).toBe('7535001979559919616')
    expect(p.botName).toBe('测试 Bot')
    expect(p.cozeDescription).toBe('真实上游描述')
    expect(p.cozeIconUrl).toBe('https://example.com/icon.png')
    expect(p.cozeConfigVersion).toBe('1.2.3.4')
    expect(p.agentVersion).toBe('1.2.3.4')
    expect(p.agentPrompt).toBe('你是测试助手')
    expect(p.agentPromptMode).toBe('prefix')
    expect(p.agentPrefixPrompt).toEqual({ prefix_prompt: '固定前缀', dynamic_prompt: '动态部分' })
    expect(p.cozePrologue).toBe('你好，我是测试助手')
    expect(p.suggestedQuestions).toBe(JSON.stringify(['问题一', '问题二']))
    expect(p.agentTemperature).toBe('0.800')
    expect(p.cozeTopP).toBe('0.950')
    expect(p.cozeTopK).toBe(50)
    expect(p.agentMaxTokens).toBe(4096)
    expect(p.cozeContextRound).toBe(10)
    expect(p.cozeResponseFormat).toBe('markdown')
    expect(p.cozePresencePenalty).toBe('0.100')
    expect(p.cozeFrequencyPenalty).toBe('0.200')
    expect(p.cozeModelId).toBe('m1')
    expect(p.cozeModelName).toBe('豆包·1.5·Pro·32k')
    expect(p.cozeModelParameters).toEqual({
      thinking_type: 'enabled',
      api_mode: 'chat_api',
      cache_type: 'open',
    })
    expect(p.cozeBotMode).toBe(1)
    expect(p.cozeDefaultUserInputType).toBe('text')
    expect(p.cozePlugins).toEqual(basePayload.plugin_info_list)
    expect(p.cozeWorkflows).toEqual(basePayload.workflow_info_list)
    expect(p.cozeKnowledge).toEqual([{ id: 'k1', name: '知识库一' }])
    expect(p.cozeShortcutCommands).toEqual(basePayload.shortcut_commands)
    expect(p.cozeVoices).toEqual(basePayload.voice_info_list)
    expect(p.cozeMediaConfig).toEqual({ is_voice_call_closed: true })
    expect(p.cozeBackgroundImage).toEqual(basePayload.background_image_info)
    expect(p.cozeSuggestReply).toEqual(basePayload.suggest_reply_info)
    expect(p.cozeFolderId).toBe('f1')
    expect(p.cozeOwnerUserId).toBe('u1')
    expect(p.cozeCreateTime).toBe(1760000000)
    expect(p.cozeUpdateTime).toBe(1760000100)
    expect(p.cozeVariablesRaw).toEqual(basePayload.variables)
    expect(p.agentVariables).toBe(JSON.stringify(basePayload.variables))
    expect(p.cozeConfigRaw).toEqual(basePayload)
    expect(p.cozeConfigStatus).toBe('synced')
    expect(p.cozeConfigSource).toBe('get_bot_config')
    expect(p.cozeConfigError).toBeNull()
    expect(p.agentModel).toBeUndefined()
    expect(p.avatar).toBeUndefined()
    expect(p.cover).toBeUndefined()
    expect(mapped.hash).toHaveLength(64)
  })

  it('keeps explicit empty upstream arrays as empty, not null', () => {
    const mapped = mapCozeBotConfig(
      { bot_id: 'b', name: 'n', plugin_info_list: [], workflow_info_list: [], knowledge: {} },
      'get_bot_config',
    )
    expect(mapped.patch.cozePlugins).toEqual([])
    expect(mapped.patch.cozeWorkflows).toEqual([])
    expect(mapped.patch.cozeKnowledge).toEqual([])
    expect(mapped.patch.cozeShortcutCommands).toEqual([])
    expect(mapped.patch.cozeVoices).toEqual([])
  })

  it('supports snake_case onboarding as well as PascalCase', () => {
    const mapped = mapCozeBotConfig(
      {
        onboarding_info: { prologue: 'snake 开场白', suggested_questions: ['A'] },
      },
      'get_bot_config',
    )
    expect(mapped.patch.cozePrologue).toBe('snake 开场白')
    expect(mapped.patch.suggestedQuestions).toBe(JSON.stringify(['A']))
  })

  it('produces a stable hash for object key order changes', () => {
    const a = mapCozeBotConfig({ bot_id: 'b', name: 'n', model_info: { temperature: 0.8, top_p: 0.9 } }, 'get_bot_config')
    const b = mapCozeBotConfig({ model_info: { top_p: 0.9, temperature: 0.8 }, name: 'n', bot_id: 'b' }, 'get_bot_config')
    expect(a.hash).toBe(b.hash)
  })
})

describe('toCozePublicCapabilities', () => {
  const agent = {
    cozePrologue: '你好',
    cozeOnboarding: { suggested_questions: ['问题一'] },
    cozePlugins: [
      {
        name: '搜索插件',
        description: '联网搜索',
        icon_url: 'https://example.com/p.png',
        api_info_list: [{ name: 'search', description: '搜索' }],
      },
    ],
    cozeWorkflows: [{ name: '工作流一', description: '流程' }],
    cozeKnowledge: [{ name: '知识库一' }],
    cozeShortcutCommands: [{ name: '查天气', command: 'weather', description: '查询天气' }],
    cozeDefaultUserInputType: 'text',
    cozeBotMode: 1,
    cozeMediaConfig: { is_voice_call_closed: true },
    agentPrompt: '不应公开的提示词',
    agentTemperature: '0.800',
  } as unknown as Partial<Agent>

  it('only exposes safe capability fields and hides prompt/model internals', () => {
    const publicCap = toCozePublicCapabilities(agent)
    expect(publicCap).not.toBeNull()
    expect(publicCap).toMatchObject({
      prologue: '你好',
      suggestedQuestions: ['问题一'],
      defaultUserInputType: 'text',
      botMode: 1,
      voiceCallClosed: true,
    })
    expect(publicCap?.plugins[0]?.tools).toEqual([{ name: 'search', description: '搜索' }])
    expect(JSON.stringify(publicCap)).not.toContain('不应公开的提示词')
    expect(JSON.stringify(publicCap)).not.toContain('0.800')
  })

  it('returns null for a legacy agent with no capability fields', () => {
    expect(toCozePublicCapabilities({} as Partial<Agent>)).toBeNull()
  })
})
