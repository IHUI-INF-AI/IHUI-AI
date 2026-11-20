// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * hrToolsFor 条件携带判据(2026-11-21 立)。
 *
 * 病灶背景:财务/教育/文件/视频四族都已条件携带,人事六枚 hr_* 一枚没进 agentTools,
 * 真机实测模型答复"我没有找到这个人事工具"。本测试钉三件事:
 * ① 人事意图命中 ⇒ 带对应用工具;
 * ② 普通问答返回 [](否则打字机流式退化成整段回显);
 * ③ 返回的工具名与 ai-service mcp_server 注册名逐字相等(拼错即静默失效)。
 */
import { describe, expect, it } from 'vitest'
import { HR_MANAGE_TOOLS, HR_SELF_TOOLS, HR_TOOLS, hrToolsFor } from '../tool-config'

describe('hrToolsFor — 人事意图条件携带(web 发送链)', () => {
  it.each(['我的工资条在哪看', '查我的考勤记录', '我的请假还剩几天'])(
    '自助面意图 ⇒ 四枚 hr_my_* 随行:%s',
    (text) => {
      const got = hrToolsFor(text)
      for (const t of HR_SELF_TOOLS) expect(got).toContain(t)
    },
  )

  it.each(['帮我算一下这个月工资', '把 2026-11 的薪资结算做出来', '社保基数配置齐不齐'])(
    '算薪/配置意图 ⇒ 自助面 + 管理面全带:%s',
    (text) => {
      const got = hrToolsFor(text)
      for (const t of HR_TOOLS) expect(got).toContain(t)
    },
  )

  it('显式点名工具名 ⇒ 命中(便于验收脚本与口头指令)', () => {
    expect(hrToolsFor('调用 hr_insurance_readiness 体检')).toContain('hr_insurance_readiness')
    expect(hrToolsFor('用 hr_payroll_calc 算薪')).toContain('hr_payroll_calc')
  })

  it.each(['今天天气怎么样', '工资这个词的英文怎么说', '帮我写一份周报大纲', ''])(
    '反例:非人事动作句不带工具(保住打字机流式):%s',
    (text) => {
      expect(hrToolsFor(text)).toEqual([])
    },
  )

  it('返回的工具名全部是 ai-service 在册工具名(与 hr_tools._TOOLS 逐字对账)', () => {
    // 与 apps/ai-service/app/tools/hr_tools.py 的 __all__ 清单同源;改注册先改这里
    const registered = new Set([
      'hr_my_payroll',
      'hr_my_payroll_periods',
      'hr_my_attendance',
      'hr_my_leaves',
      'hr_payroll_calc',
      'hr_insurance_readiness',
    ])
    for (const t of HR_TOOLS) expect(registered.has(t), `未在册:${t}`).toBe(true)
    for (const text of ['算工资', '工资条', '社保基数']) {
      for (const t of hrToolsFor(text)) expect(registered.has(t), `未在册:${t}`).toBe(true)
    }
  })

  it('管理面与自助面不混成一个数组(权限面不同,后端按名字判)', () => {
    expect(HR_MANAGE_TOOLS).toEqual(['hr_payroll_calc', 'hr_insurance_readiness'])
    expect(HR_TOOLS.length).toBe(HR_SELF_TOOLS.length + HR_MANAGE_TOOLS.length)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
