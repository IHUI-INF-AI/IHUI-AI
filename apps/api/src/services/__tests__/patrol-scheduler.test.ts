// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * patrol-scheduler 纯函数单测(2026-09-17 立,#40)。
 * 不连 DB,不 mock 网络——只测 prompt 构建/判定解析/告警消息。
 */
import { describe, it, expect } from 'vitest'
import {
  buildPatrolPrompt,
  parsePatrolVerdict,
  buildPatrolAlertMessage,
  PATROL_TYPE_FOCUS,
} from '../patrol-scheduler'

describe('buildPatrolPrompt', () => {
  it('包含标记协议与类型重点', () => {
    const prompt = buildPatrolPrompt({ patrolType: 'ci', target: null, prompt: null })
    expect(prompt).toContain('[PATROL:OK]')
    expect(prompt).toContain('[PATROL:ISSUE]')
    expect(prompt).toContain(PATROL_TYPE_FOCUS.ci)
  })

  it('包含 target 与附加指令(非空 trim 后才注入)', () => {
    const prompt = buildPatrolPrompt({
      patrolType: 'deadlink',
      target: '  https://aizhs.top  ',
      prompt: ' 重点检查文档页 ',
    })
    expect(prompt).toContain('https://aizhs.top')
    expect(prompt).toContain('重点检查文档页')
  })

  it('空白 target/prompt 不注入对应行', () => {
    const prompt = buildPatrolPrompt({ patrolType: 'custom', target: '   ', prompt: '' })
    expect(prompt).not.toContain('巡检目标:')
    expect(prompt).not.toContain('附加巡检指令:')
  })

  it('未知类型回退 custom 重点', () => {
    const prompt = buildPatrolPrompt({
      patrolType: 'unknown' as 'custom',
      target: null,
      prompt: null,
    })
    expect(prompt).toContain(PATROL_TYPE_FOCUS.custom)
  })
})

describe('parsePatrolVerdict', () => {
  it('summary 含 ISSUE 标记 → issue,diagnosis 为标记后文本', () => {
    const v = parsePatrolVerdict('[PATROL:ISSUE]\n诊断:测试失败 x=3。', '')
    expect(v.status).toBe('issue')
    expect(v.diagnosis).toBe('诊断:测试失败 x=3。')
  })

  it('summary 含 OK 标记 → ok,diagnosis 为标记后文本', () => {
    const v = parsePatrolVerdict('[PATROL:OK]\n检查了 3 个页面,无死链。', '')
    expect(v.status).toBe('ok')
    expect(v.diagnosis).toBe('检查了 3 个页面,无死链。')
  })

  it('summary 无标记时回退 contentTail', () => {
    const v = parsePatrolVerdict(null, '过程输出…\n[PATROL:ISSUE]\n发现 404')
    expect(v.status).toBe('issue')
    expect(v.diagnosis).toBe('发现 404')
  })

  it('两边都无标记 → unknown', () => {
    const v = parsePatrolVerdict('一切正常', '没有标记')
    expect(v.status).toBe('unknown')
    expect(v.diagnosis).toBe('')
  })

  it('空输入 → unknown', () => {
    expect(parsePatrolVerdict(null, '').status).toBe('unknown')
    expect(parsePatrolVerdict(null, '').diagnosis).toBe('')
  })

  it('标记后无诊断文本 → diagnosis 为空串', () => {
    const v = parsePatrolVerdict('[PATROL:ISSUE]', '')
    expect(v.status).toBe('issue')
    expect(v.diagnosis).toBe('')
  })

  it('diagnosis 超长截断到 4000', () => {
    const long = 'x'.repeat(5000)
    const v = parsePatrolVerdict(`[PATROL:OK]\n${long}`, '')
    expect(v.status).toBe('ok')
    expect(v.diagnosis.length).toBe(4000)
  })
})

describe('buildPatrolAlertMessage', () => {
  it('包含任务名/类型/诊断与授权引导', () => {
    const msg = buildPatrolAlertMessage('每日 CI 巡检', 'ci', '诊断:构建失败。修复:重跑 job')
    expect(msg).toContain('每日 CI 巡检')
    expect(msg).toContain('ci')
    expect(msg).toContain('诊断:构建失败。修复:重跑 job')
    expect(msg).toContain('执行修复')
  })

  it('空诊断回退提示文案', () => {
    const msg = buildPatrolAlertMessage('t', 'log', '   ')
    expect(msg).toContain('未输出详细诊断')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
