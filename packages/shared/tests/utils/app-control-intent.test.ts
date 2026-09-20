// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「操控本站」意图探测测试(2026-09-21 立)。
 *
 * 这个函数是聊天主链的唯一闸门:`llm.py` 只在请求带 agentTools 时才进 tool loop,
 * 而各端为保打字机流式刻意"普通问答不带工具"。所以**假阳性**(普通问答被判成操控)
 * 会让每次问答白烧一轮工具上下文,**假阴性**(明显在要求操作却没判出)会让端侧桥
 * 变成死代码。两类都要有用例钉住,故本文件正负样本同等重要。
 */
import { describe, it, expect } from 'vitest'
import {
  detectAppControlIntent,
  createAppControlToolSelector,
  lastUserContent,
} from '../../src/utils/app-control-intent'

describe('detectAppControlIntent - ui 信号', () => {
  const uiSamples = [
    '打开充值页面',
    '帮我跳转到设置页',
    '切换到 dark 模式',
    '切到智能体列表',
    '进入我的订单',
    '回到首页',
    '导航到 /developer/console',
    '带我到积分中心',
    '点击保存按钮',
    '点一下那个提交',
    '按下回车键',
    '按一下关闭',
    '把金额填写成 100',
    '填入标题',
    '填一下用户名',
    '把数量填成 5',
    '这个输入框里写 hello',
    '表单里有哪些字段',
    '下拉框选第二个',
    '提交表单',
    '保存表单',
    '这个页面显示了什么',
    '读一下当前页面',
    '页面上有几个按钮',
    '页面显示的内容是什么',
    '这个程序可操控吗',
    '你能操作本站吗',
    '操控我们的后台',
    '操作这个页面',
    '操作我们自己的程序',
    '新建会话',
    '打开命令面板',
    '收起侧边栏',
    '把面板关掉',
  ]

  for (const content of uiSamples) {
    it(`ui=true: ${content}`, () => {
      expect(detectAppControlIntent(content).ui).toBe(true)
    })
  }
})

describe('detectAppControlIntent - api 信号', () => {
  const apiSamples = [
    '列出所有用户',
    '查一下所有订单',
    '系统里有多少个智能体',
    '统计一下今日消息数',
    '调用充值接口',
    '后端有哪些端点',
    '服务端接口清单',
    '把用户列表给我',
    '订单列表拉一下',
    '后台数据看看',
    'API 有哪些能力',
    'api 的登录端点是什么',
    '帮我调用一次',
  ]

  for (const content of apiSamples) {
    it(`api=true: ${content}`, () => {
      expect(detectAppControlIntent(content).api).toBe(true)
    })
  }

  it('api 关键词大小写不敏感', () => {
    expect(detectAppControlIntent('API 能做什么').api).toBe(true)
    expect(detectAppControlIntent('Api endpoint 列一下').api).toBe(true)
  })
})

describe('detectAppControlIntent - 负样本(不得误判)', () => {
  const negatives: Array<[string, keyof ReturnType<typeof detectAppControlIntent>]> = [
    ['帮我写一封请假邮件', 'ui'],
    ['解释一下量子纠缠', 'ui'],
    ['这段代码有什么 bug', 'ui'],
    ['翻译成英文:你好世界', 'ui'],
    ['今天天气怎么样', 'ui'],
    ['推荐几本科幻小说', 'ui'],
    ['什么是微服务架构', 'ui'],
    ['帮我起个公司名字', 'ui'],
    ['总结这篇文档', 'ui'],
    ['python 怎么读文件', 'ui'],
    ['帮我写一封请假邮件', 'api'],
    ['解释一下量子纠缠', 'api'],
    ['这段代码有什么 bug', 'api'],
    ['推荐几本科幻小说', 'api'],
    ['什么是微服务架构', 'api'],
  ]

  for (const [content, field] of negatives) {
    it(`${field}=false: ${content}`, () => {
      expect(detectAppControlIntent(content)[field]).toBe(false)
    })
  }

  it('空串与纯空白都不触发任何信号', () => {
    expect(detectAppControlIntent('')).toEqual({ ui: false, api: false })
    expect(detectAppControlIntent('   ')).toEqual({ ui: false, api: false })
  })

  it('ui 与 api 可同时命中(如"调用充值接口并填好金额")', () => {
    const got = detectAppControlIntent('打开充值页,把金额填成 100,然后调用接口')
    expect(got).toEqual({ ui: true, api: true })
  })
})

describe('createAppControlToolSelector - 端族名注入', () => {
  const selector = createAppControlToolSelector({
    ui: ['taro_ui_describe', 'taro_ui_navigate'],
    api: ['api_endpoints_search', 'api_endpoint_call'],
  })

  it('未命中返回空数组(调用方据此完全不传 agentTools)', () => {
    expect(selector('帮我写一封请假邮件')).toEqual([])
    expect(selector('')).toEqual([])
  })

  it('命中 ui 只带本端 ui 族,不混入 api 族', () => {
    expect(selector('打开充值页')).toEqual(['taro_ui_describe', 'taro_ui_navigate'])
  })

  it('命中 api 只带入口工具,不混入 ui 族', () => {
    expect(selector('列出所有用户')).toEqual(['api_endpoints_search', 'api_endpoint_call'])
  })

  it('两类同时命中时两组都在,且不产生重复项', () => {
    const got = selector('打开页面并调用接口')
    expect(got).toHaveLength(4)
    expect(new Set(got).size).toBe(4)
  })

  it('同一 selector 复用不残留上一次结果', () => {
    expect(selector('打开页面')).toHaveLength(2)
    expect(selector('今天天气')).toHaveLength(0)
  })
})

describe('lastUserContent', () => {
  it('取最后一条 user 消息,忽略其后的 assistant 回复', () => {
    expect(
      lastUserContent([
        { role: 'user', content: '第一句' },
        { role: 'assistant', content: '回复' },
        { role: 'user', content: '打开设置页' },
        { role: 'assistant', content: '好的' },
      ]),
    ).toBe('打开设置页')
  })

  it('空数组返回空串', () => {
    expect(lastUserContent([])).toBe('')
  })

  it('无 user 消息返回空串', () => {
    expect(lastUserContent([{ role: 'assistant', content: 'hi' }])).toBe('')
  })

  it('content 非字符串(多模态数组)时返回空串而不是崩', () => {
    expect(lastUserContent([{ role: 'user', content: [{ type: 'text' }] }])).toBe('')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
