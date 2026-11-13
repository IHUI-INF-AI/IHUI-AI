// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:watermarked

import { describe, expect, it } from 'vitest'

import { buildHrMonthlyPayrollTemplate } from '../hr-payroll-workflow.js'

/**
 * 补偿声明结构单测(HR-6 第 3 期)。
 *
 * 只验模板侧的声明是否正确;补偿的**执行**语义(倒序、单条失败不阻断、
 * 参数从输出取值)在 ai-task-executor 的契约测试里验证。
 */

describe('HR 模板的补偿声明', () => {
  it('只有算薪步声明了补偿(其它步骤无可撤回的写入)', () => {
    const tpl = buildHrMonthlyPayrollTemplate({ periodMonth: '2026-11' })
    const withComp = tpl.steps
      .map((s, i) => ({ i, comp: s.compensate }))
      .filter((x) => !!x.comp)
    expect(withComp).toHaveLength(1)
    expect(withComp[0]?.i).toBe(3) // 第 4 步 = 算薪
  })

  it('补偿指向 /hr-payroll/revert 且带正确的 periodMonth', () => {
    const tpl = buildHrMonthlyPayrollTemplate({ periodMonth: '2026-11' })
    const comp = tpl.steps[3]?.compensate
    expect(comp?.method).toBe('POST')
    expect(comp?.path).toBe('/hr-payroll/revert')
    expect(comp?.params?.['periodMonth']).toBe('2026-11')
  })

  it('日结/月结/查询步不声明补偿(它们是幂等 upsert,重跑即修正)', () => {
    const tpl = buildHrMonthlyPayrollTemplate({ periodMonth: '2026-11' })
    expect(tpl.steps[0]?.compensate).toBeUndefined()
    expect(tpl.steps[1]?.compensate).toBeUndefined()
    expect(tpl.steps[2]?.compensate).toBeUndefined()
    expect(tpl.steps[4]?.compensate).toBeUndefined()
  })

  it('重试与补偿并存:算薪步两者都有', () => {
    const tpl = buildHrMonthlyPayrollTemplate({ periodMonth: '2026-11' })
    expect(tpl.steps[3]?.retry?.maxAttempts).toBe(2)
    expect(tpl.steps[3]?.compensate).toBeTruthy()
  })
})
