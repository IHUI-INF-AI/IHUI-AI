// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// RP-46(2026-11-12 立):财务部板块「一键发起」就地落点回归锁。
//
// 缺口:板块页自带 PlanStepsCard 进度看板,发送链建会话后若把 URL 换成 `/chat`,
// 刚出现的 plan 步骤看板被连根拔掉,用户再也看不到过程(实测缺陷1)。
//
// 钉三件事(与 frame-watermark 接线自证同一姿势 —— 读源码断言,不复制实现):
//   ① 落点解析唯一实现:`resolveDeeplinkTarget` 是模块内唯一函数,三处 router.replace 共用
//      (复制三份必然漂移,§0.6 单一真相源)。
//   ② `stayOnPage === true` 保留当前 pathname、只写 conversationId 进 query(不换页)。
//   ③ 板块页调用点必须真传 `{ stayOnPage: true }`(只测纯函数证不出"事实上有人就地发起")。
// ④ 另钉 chatDeeplinkPath 对板块页路径恒回 /chat 的既有契约(缺陷1的根因,反向锁回归)。

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { chatDeeplinkPath } from '@ihui/shared/ui/chat-workbench-shell-spec'

const here = dirname(fileURLToPath(import.meta.url))

function readSrc(...rel: string[]): string {
  return readFileSync(join(here, ...rel), 'utf8')
}

const FINANCE_PAGE = readSrc('..', '..', '..', '..', 'app', '(main)', 'finance-ai', 'page.tsx')
const SEND_MESSAGE = readSrc('..', 'send-message.ts')

describe('RP-46 财务部板块就地发起落点回归锁', () => {
  it('① 落点解析唯一实现:resolveDeeplinkTarget 定义一次,三处 router.replace 全走它', () => {
    const defCount = SEND_MESSAGE.split('function resolveDeeplinkTarget(').length - 1
    expect(defCount, 'resolveDeeplinkTarget 必须只定义一次(复制即漂移)').toBe(1)

    const replaceCount = SEND_MESSAGE.split('router.replace(').length - 1
    const wiredCount = SEND_MESSAGE.split('router.replace(resolveDeeplinkTarget(').length - 1
    expect(replaceCount, '三处 router.replace').toBe(3)
    expect(wiredCount, '三处 router.replace 必须全部经 resolveDeeplinkTarget,不得旁路').toBe(
      replaceCount,
    )
  })

  it('② stayOnPage===true 保留当前 pathname,不交给 chatDeeplinkPath 换页', () => {
    // 落点函数体:stayOnPage 真分支取 window.location.pathname,假分支才走 chatDeeplinkPath
    const fn = SEND_MESSAGE.slice(
      SEND_MESSAGE.indexOf('function resolveDeeplinkTarget('),
      SEND_MESSAGE.indexOf('function resolveDeeplinkTarget(') + 500,
    )
    // 2026-11-21:实现被 prettier 折成三行三目(stayOnPage 判据 / pathname 分支 / chatDeeplinkPath
    // 分支各占一行),原字面单行断言因此误红。改成允许空白/换行的正则,断言意图一字不变:
    // 真分支取 window.location.pathname,假分支才走 chatDeeplinkPath 换页。
    expect(fn).toMatch(
      /opts\?\.stayOnPage === true\s*\?\s*window\.location\.pathname\s*:\s*chatDeeplinkPath\(/,
    )
    expect(fn).toContain("sp.set('conversationId', conversationId)")
  })

  it('③ 板块页发起真传 { stayOnPage: true }(只测纯函数证不出事实上有人就地发起)', () => {
    expect(FINANCE_PAGE).toContain('stayOnPage: true')
    // 且经 sendMessage 落地,不是死配置
    expect(FINANCE_PAGE).toMatch(/sendMessage\(\s*[\w$]+,\s*\{\s*stayOnPage:\s*true\s*\}/)
  })

  it('④ 根因契约:chatDeeplinkPath 对财务板块页恒回 /chat(证明 stayOnPage 是必要的)', () => {
    // 板块页不在工作台前缀内 ⇒ 缺省行为必然跳 /chat;stayOnPage 正是为绕开这条换页。
    // 现役侧边栏财务入口 = /finance-ai;旧 URL /admin/finance-ai 仍可达(A 方案不删页),
    // 两枚板块 href 都受同一根因约束 —— 缺省都会被拽回 /chat。
    expect(chatDeeplinkPath('/finance-ai')).toBe('/chat')
    expect(chatDeeplinkPath('/admin/finance-ai')).toBe('/chat')
    expect(chatDeeplinkPath('/chat/workbench')).toBe('/chat/workbench')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
