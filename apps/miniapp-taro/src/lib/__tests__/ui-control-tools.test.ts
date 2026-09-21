// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 小程序端 agentTools 预筛测试(2026-09-21)。
 *
 * 这条链路是整个小程序操控桥的**总闸**:llm.py 的 tool loop 只在请求带非空 agentTools 时进入。
 * 名字写错一个字母 = 模型拿不到工具;把 web_ui_* 漏进来 = 端侧只会回 TARGET_NOT_CONNECTED。
 * 所以族名清单必须被断言钉死,而不是"看起来对"。
 */
import { describe, it, expect } from 'vitest'
import {
  API_CONTROL_TOOLS,
  TARO_UI_CONTROL_TOOLS,
  resolveAgentTools,
  uiControlToolsFor,
} from '../ui-control-tools'

describe('TARO_UI_CONTROL_TOOLS 与 ai-service 注册面一致', () => {
  it('恰好七个动作,且全部 taro_ui_ 前缀', () => {
    expect(TARO_UI_CONTROL_TOOLS).toHaveLength(7)
    for (const name of TARO_UI_CONTROL_TOOLS) expect(name.startsWith('taro_ui_')).toBe(true)
  })

  it('含 click/fill/submit:小程序无同源 DOM,这三动词由控件注册表承接而非砍掉', () => {
    for (const verb of ['taro_ui_click', 'taro_ui_fill', 'taro_ui_submit']) {
      expect(TARO_UI_CONTROL_TOOLS).toContain(verb)
    }
  })

  it('绝不混入 web_ui_* / mobile_ui_*(发给本端只会换来 TARGET_NOT_CONNECTED)', () => {
    for (const name of uiControlToolsFor('打开设置页并列出所有用户')) {
      expect(name.startsWith('web_ui_')).toBe(false)
      expect(name.startsWith('mobile_ui_')).toBe(false)
    }
  })
})

describe('uiControlToolsFor', () => {
  it('普通问答不带任何工具(保首字延迟)', () => {
    expect(uiControlToolsFor('帮我写一封请假邮件')).toEqual([])
    expect(uiControlToolsFor('')).toEqual([])
  })

  it('界面意图 → 整族四工具一起带(动作类工具依赖 describe 的返回形状,不能只给一半)', () => {
    expect(uiControlToolsFor('打开充值页面')).toEqual([...TARO_UI_CONTROL_TOOLS])
  })

  it('后端意图 → search + call 成对(只给 search 模型搜到了却调不动)', () => {
    expect(uiControlToolsFor('列出所有用户')).toEqual([...API_CONTROL_TOOLS])
  })

  it('两类同时命中 → 两组都在且不重复', () => {
    const got = uiControlToolsFor('打开充值页,把金额填成 100,再查一下后端接口')
    expect(got).toHaveLength(TARO_UI_CONTROL_TOOLS.length + API_CONTROL_TOOLS.length)
    expect(new Set(got).size).toBe(got.length)
  })
})

describe('resolveAgentTools - chatStream 请求体的最终取值', () => {
  const userMsg = (content: string) => [{ role: 'user' as const, content }]

  it('普通问答返回 undefined(不能传 [],那样 body 里会多出空数组)', () => {
    expect(resolveAgentTools(undefined, userMsg('帮我写一封请假邮件'))).toBeUndefined()
    expect(resolveAgentTools(undefined, [])).toBeUndefined()
  })

  it('界面意图返回本端四工具', () => {
    expect(resolveAgentTools(undefined, userMsg('打开充值页面'))).toEqual([
      ...TARO_UI_CONTROL_TOOLS,
    ])
  })

  it('只看最后一条 user 消息,不受更早的操控语句带偏', () => {
    const msgs = [
      { role: 'user' as const, content: '打开设置页' },
      { role: 'assistant' as const, content: '已打开' },
      { role: 'user' as const, content: '谢谢' },
    ]
    expect(resolveAgentTools(undefined, msgs)).toBeUndefined()
  })

  it('调用方显式传入一律优先,不被预筛覆盖', () => {
    expect(resolveAgentTools(['my_tool'], userMsg('打开设置页'))).toEqual(['my_tool'])
    // 显式传 [](调用方主动要求"不要工具")同样必须被尊重
    expect(resolveAgentTools([], userMsg('打开设置页'))).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
