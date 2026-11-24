// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * financeToolsFor 条件携带判据(RP-46/RP-47)—— 与 eduToolsFor 同族纪律:
 * ① 命中词面 ⇒ 带 ai_* 工具;② 平台动词 ⇒ 内置浏览器执行面(browser_*)随计划进对话;
 * ③ 普通问答一律返回 [] —— 带工具就等于把打字机流式换成整段回显(2026-08-29 修复的回归面)。
 */
import { describe, expect, it } from 'vitest'
import {
  FINANCE_BROWSER_SURFACE_TOOLS,
  FINANCE_DATA_TOOLS,
  financeToolsFor,
} from '../tool-config'

describe('financeToolsFor — 财务意图条件携带(web 发送链)', () => {
  it.each([
    '帮我把2026-11的账一键代账',
    '生成这个月的记账凭证',
    '科目余额表出来了吗',
  ])('代账动词命中 ⇒ ai_bookkeeping + 数据腿:%s', (text) => {
    const got = financeToolsFor(text)
    expect(got).toContain('ai_bookkeeping')
    for (const t of FINANCE_DATA_TOOLS) expect(got).toContain(t)
  })

  it.each(['这个月报税帮我弄', '增值税申报怎么做', '自然人与个税申报表差异', '登录电子税务局'])('报税/平台动词命中 ⇒ ai_tax_filing:%s', (text) => {
    expect(financeToolsFor(text)).toContain('ai_tax_filing')
  })

  it('平台动词 ⇒ browser_* 执行面整套随行(缺腿=计划无人执行)', () => {
    const got = financeToolsFor('把电子税务局的发票底账取回来')
    for (const t of FINANCE_BROWSER_SURFACE_TOOLS) {
      expect(got, `browser 腿缺 ${t}`).toContain(t)
    }
  })

  it('社保/医保增减员 ⇒ 双 ai_* 都带上(计划器按 targets 分流)', () => {
    const got = financeToolsFor('社保单位增减员申报办好')
    expect(got).toContain('ai_bookkeeping')
    expect(got).toContain('ai_tax_filing')
  })

  it.each([
    '今天天气怎么样',
    '帮我写一份产品周报的文档大纲',
    '增值税的原理是什么',
    '',
  ])('反例:非动作句不带工具(保住打字机流式):%s', (text) => {
    expect(financeToolsFor(text)).toEqual([])
  })

  it('返回的名字全部是后端在册工具名(拼错=模型永远看不见,静默失效族)', () => {
    // 与 ai-service mcp_server 注册名逐字对账的字面清单(改注册先改这里,由本测试拦)
    const known = new Set([
      'ai_bookkeeping',
      'ai_tax_filing',
      'parse_document',
      'document_tables',
      ...FINANCE_BROWSER_SURFACE_TOOLS,
    ])
    const probes = [
      '一键代账 电子税务局',
      '把发票底账取回来',
      '增值税申报提交',
      '社保增减员',
    ]
    for (const p of probes) {
      for (const t of financeToolsFor(p)) {
        expect(known.has(t), `未在册工具名:${t}`).toBe(true)
      }
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
