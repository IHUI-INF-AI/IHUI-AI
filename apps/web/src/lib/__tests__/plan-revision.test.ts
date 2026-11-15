// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import { buildPlanRevisionPrompt } from '../plan-revision'

/**
 * 计划评审打回指令:空反馈有兜底、非空带原文,且两条分支都明确要求先别执行。
 */
describe('buildPlanRevisionPrompt', () => {
  it('空反馈:返回兜底指令,仍要求先不要执行', () => {
    const prompt = buildPlanRevisionPrompt('')
    expect(prompt).toContain('请重新规划当前任务')
    expect(prompt).toContain('在更新计划前不要开始执行')
    expect(prompt).not.toContain('请根据以下修改意见')
  })

  it('纯空白:与空串同形', () => {
    expect(buildPlanRevisionPrompt('  \n\t  ')).toBe(buildPlanRevisionPrompt(''))
  })

  it('非空反馈:带原文并去除首尾空白', () => {
    const prompt = buildPlanRevisionPrompt('  第 2 步先补测试  ')
    expect(prompt).toContain('请根据以下修改意见更新当前计划')
    expect(prompt).toContain('第 2 步先补测试')
    expect(prompt).toContain('先不要开始执行')
    expect(prompt).not.toContain('  第 2 步先补测试')
  })

  it('多行反馈:正文原样保留', () => {
    const prompt = buildPlanRevisionPrompt('第一行\n第二行')
    expect(prompt).toContain('第一行\n第二行')
  })
})
