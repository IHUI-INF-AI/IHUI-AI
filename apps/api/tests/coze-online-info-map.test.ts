// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
// 判据不复制(§22c):下面所有断言用的都是生产映射源本身
import { mapCozeOnlineInfo, type CozeOnlineInfoData } from '../src/lib/coze-online-info.js'

/**
 * 2026-10-20 真跑 api.coze.cn `GET /v1/bot/get_online_info`(bot 7530528655878078473)取回的
 * data 原样节选(键序与取值按实测;长文本裁到能表达形状即可)。
 */
const LIVE_DATA: CozeOnlineInfoData = {
  bot_id: '7530528655878078473',
  name: '[图]书籍推荐知识卡-智汇AI',
  description: '我能为您生成您想要的书籍推荐师知识卡片',
  icon_url:
    'https://p3-flow-imagex-sign.byteimg.com/ocean-cloud-tos/FileBizType.BIZ_BOT_ICON/x.png~tplv-a9rns2rl98-image-qvalue.jpeg?rk3s=bbd3e7ed&x-expires=1795092869&x-signature=abc%3D',
  create_time: 1753777650,
  update_time: 1758001958,
  version: '1758001958004',
  prompt_info: { prompt: '# 角色\n你是一名专业的书籍推荐师知识卡片生成助手。', prompt_mode: 'normal' },
  model_info: {
    model_id: '1749615103',
    model_name: '豆包·1.6·自动深度思考',
    temperature: 0.8,
    top_p: 1,
    frequency_penalty: 0,
    context_round: 3,
    max_tokens: 4096,
    cache_type: 'closed',
  },
  variables: [],
}

const NEVER_WRITE = ['avatar', 'agentModel', 'agentTemperature'] as const

describe('mapCozeOnlineInfo —— 真实载荷档', () => {
  it('把 prompt_info.prompt / version / model_info.max_tokens / variables 折成可落库的差量', () => {
    expect(mapCozeOnlineInfo(LIVE_DATA)).toEqual({
      agentPrompt: '# 角色\n你是一名专业的书籍推荐师知识卡片生成助手。',
      agentVersion: '1758001958004',
      agentMaxTokens: 4096,
      agentVariables: '[]',
    })
  })

  it('绝不产出 avatar / agentModel / agentTemperature(过期签名地址、不可路由的展示名、被取整的浮点)', () => {
    const patch = mapCozeOnlineInfo(LIVE_DATA)
    for (const k of NEVER_WRITE) {
      expect(patch).not.toHaveProperty(k)
    }
  })
})

describe('mapCozeOnlineInfo —— 空转与退化档', () => {
  it('code=0 而 data 为空对象(与 4015/4200 同形)⇒ 返回空差量,调用方据此不写库', () => {
    expect(mapCozeOnlineInfo({})).toEqual({})
    expect(mapCozeOnlineInfo(undefined)).toEqual({})
  })

  it('prompt_info 是裸字符串时仍取到文案(不因为形状不是对象就丢)', () => {
    expect(mapCozeOnlineInfo({ prompt_info: '直接一段提示词' })).toEqual({ agentPrompt: '直接一段提示词' })
  })

  it('全空白文案不算有值', () => {
    expect(mapCozeOnlineInfo({ prompt_info: { prompt: '   ' } })).toEqual({})
  })

  it('version 超出列宽(varchar 32)⇒ 弃,不让一次刷新把整条 update 打成 500', () => {
    const long = 'v'.repeat(33)
    expect(mapCozeOnlineInfo({ version: long })).toEqual({})
    expect(mapCozeOnlineInfo({ version: 'v'.repeat(32) })).toEqual({ agentVersion: 'v'.repeat(32) })
  })

  it('max_tokens 非整数 / 非正 / 超 int4 ⇒ 弃', () => {
    expect(mapCozeOnlineInfo({ model_info: { max_tokens: 4096.5 } })).toEqual({})
    expect(mapCozeOnlineInfo({ model_info: { max_tokens: 0 } })).toEqual({})
    expect(mapCozeOnlineInfo({ model_info: { max_tokens: 2147483648 } })).toEqual({})
  })

  it('model_info 是字符串形态(旧代码声明的形状)⇒ 不从中造 max_tokens', () => {
    expect(mapCozeOnlineInfo({ model_info: 'gpt-x' })).toEqual({})
  })

  it('variables 非数组 ⇒ 不写,不把它伪造成空数组盖掉本地值', () => {
    expect(mapCozeOnlineInfo({ variables: { k: 'v' } as unknown as unknown[] })).toEqual({})
    expect(mapCozeOnlineInfo({ variables: [] })).toEqual({ agentVariables: '[]' })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
