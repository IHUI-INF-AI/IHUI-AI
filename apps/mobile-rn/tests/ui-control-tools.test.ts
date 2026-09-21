// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RN 端 agentTools 预筛测试(2026-09-21)。
 *
 * 这是整个 RN 操控桥的总闸:llm.py 的 tool loop 只在请求带非空 agentTools 时进入。
 * 名字写错一个字母 = 模型拿不到工具;把 web_ui_* 漏进来 = 端侧只会回 TARGET_NOT_CONNECTED。
 */
import { describe, it, expect } from 'vitest'
import {
  API_CONTROL_TOOLS,
  MOBILE_UI_CONTROL_TOOLS,
  uiControlToolsFor,
} from '../src/lib/ui-control-tools'

describe('MOBILE_UI_CONTROL_TOOLS 与 ai-service 注册面一致', () => {
  it('恰好七个动作,且全部 mobile_ui_ 前缀', () => {
    expect(MOBILE_UI_CONTROL_TOOLS).toHaveLength(7)
    for (const name of MOBILE_UI_CONTROL_TOOLS) expect(name.startsWith('mobile_ui_')).toBe(true)
  })

  it('含 click/fill/submit:无 DOM 端靠控件注册表承接,不是把能力砍掉', () => {
    for (const verb of ['mobile_ui_click', 'mobile_ui_fill', 'mobile_ui_submit']) {
      expect(MOBILE_UI_CONTROL_TOOLS).toContain(verb)
    }
  })

  it('绝不混入 web_ui_* / taro_ui_*(api 按 category 一对一择端,带错族名等于操控别的设备)', () => {
    for (const name of uiControlToolsFor('打开钱包页并列出所有用户')) {
      expect(name.startsWith('web_ui_')).toBe(false)
      expect(name.startsWith('taro_ui_')).toBe(false)
    }
  })
})

describe('uiControlToolsFor', () => {
  it('普通问答不带任何工具(保首字延迟)', () => {
    expect(uiControlToolsFor('帮我写一封请假邮件')).toEqual([])
    expect(uiControlToolsFor('')).toEqual([])
  })

  it('界面意图 → 整族四工具一起带(动作类依赖 describe 返回的命令 id,不能只给一半)', () => {
    expect(uiControlToolsFor('打开钱包页面')).toEqual([...MOBILE_UI_CONTROL_TOOLS])
  })

  it('后端意图 → search + call 成对(只给 search 模型搜到了却调不动)', () => {
    expect(uiControlToolsFor('列出所有订单')).toEqual([...API_CONTROL_TOOLS])
  })

  it('两类同时命中 → 两组都在且不重复', () => {
    const got = uiControlToolsFor('打开钱包页,再查一下后端接口')
    expect(got).toHaveLength(MOBILE_UI_CONTROL_TOOLS.length + API_CONTROL_TOOLS.length)
    expect(new Set(got).size).toBe(got.length)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
