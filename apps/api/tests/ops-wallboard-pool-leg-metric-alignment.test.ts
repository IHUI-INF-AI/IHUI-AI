// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 号池可观测三档 · 面板交叉补齐的防回潮源锁(2026-10-25)。
// 纯静态断言,不连库不发网络请求(姿势照 gate8-deadcall-cleanup.test.ts)。
//
// 背景:`ihui_llm_active_sessions` 是 ai-service 侧的进程内存死 gauge(生产零调用),
// 2026-10-23 已从指标层摘除,两张生成盘改指 `sum(ihui_llm_pool_leg_in_cooldown)`。
// 墙板(/admin/monitor/wallboard)是第三处消费点,当时漏改 ⇒ 一直查一个不存在的
// 指标,把"没量到"画成"会话为零"。本测试钉住三件事:
// 1. 指标层不再定义/发射死 gauge,且新指标族 `ihui_llm_pool_leg_in_cooldown` 在位;
// 2. API 聚合端点与 web 墙板都不再引用 `aiActiveSessions`/死指标名;
// 3. 生成盘继续指新指标(改名回退或 QQ 互漂都会当场红)。
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const read = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

/** 剥 // 行注释与 /* *\/ 块注释:修账注释允许引用旧指标名说明历史,不参与判据。 */
const stripComments = (s: string): string =>
  s.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

const apiRoute = stripComments(read('../src/routes/admin-ops-wallboard.ts'))
const wallboardPage = stripComments(read('../../web/app/(main)/admin/monitor/wallboard/page.tsx'))
const generatedPanels = read(
  '../../web/app/(main)/admin/monitor/panels/dashboard-config.generated.ts',
)
const aiMetrics = stripComments(read('../../ai-service/app/middleware/llm_metrics.py'))

describe('死 gauge ihui_llm_active_sessions 全链清零', () => {
  it('指标层不再定义它', () => {
    expect(aiMetrics).not.toContain("'ihui_llm_active_sessions'")
    expect(aiMetrics).not.toContain('"ihui_llm_active_sessions"')
  })

  it('API 墙板聚合不再查询它,也不再把值塞进响应', () => {
    expect(apiRoute).not.toContain('ihui_llm_active_sessions')
    expect(apiRoute).not.toContain('aiActiveSessions')
  })

  it('web 墙板不再读取该字段', () => {
    expect(wallboardPage).not.toContain('aiActiveSessions')
  })
})

describe('新指标族与面板指向同源', () => {
  it('ai-service 仍在发射每腿冷却 gauge', () => {
    expect(aiMetrics).toContain("'ihui_llm_pool_leg_in_cooldown'")
  })

  it('生成盘查询表达式指向新指标(不是死 gauge)', () => {
    expect(generatedPanels).toContain('sum(ihui_llm_pool_leg_in_cooldown)')
    expect(generatedPanels).not.toContain('ihui_llm_active_sessions')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
