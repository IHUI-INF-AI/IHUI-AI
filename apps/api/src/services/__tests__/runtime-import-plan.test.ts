// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import { planRuntimeImport } from '../runtime-import-plan.js'

const SESSION = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

describe('运行时导入落库规划', () => {
  it('技能去重，自动化暂停，cron 不写入 rrule，能力声明不生成连接器', () => {
    const plan = planRuntimeImport(
      {
        skills: [
          { name: '审查', prompt: '按清单审查', apiKey: 'SUPERSECRETVALUE99' },
          { name: '审查', prompt: '第二份' },
        ],
        automations: [
          { name: '夜跑', trigger: '0 2 * * *', prompt: '汇总昨日' },
          { name: '只有时刻', trigger: '0 1 * * *' },
          { name: '整点', trigger: 'FREQ=DAILY;BYHOUR=9;BYMINUTE=0', prompt: '写日报' },
        ],
        memory: [{ text: '用户偏好中文' }],
        capabilities: [{ name: 'repo-read', description: '只读仓库', env: { TOKEN: 'x' } }],
      },
      SESSION,
    )

    expect(plan.skills).toEqual([
      {
        name: '审查',
        prompt: '按清单审查',
        category: 'custom',
        scenario: 'custom',
        enabled: true,
      },
    ])
    expect(plan.skipped).toContainEqual({ dimension: 'skills', index: 1, reason: 'duplicate_name' })
    expect(plan.automations.map((row) => row.status)).toEqual(['paused', 'paused'])
    expect(plan.automations.every((row) => row.terminalReason === 'manual_pause')).toBe(true)
    expect(
      plan.automations.every((row) => row.nextRunAt === null && row.scheduledAt === null),
    ).toBe(true)
    expect(plan.automations[0]).toMatchObject({
      name: '夜跑',
      prompt: '汇总昨日',
      scheduleType: 'once',
      rrule: null,
      conversationId: SESSION,
    })
    expect(plan.automations[1]).toMatchObject({
      name: '整点',
      scheduleType: 'recurring',
      rrule: 'FREQ=DAILY;BYHOUR=9;BYMINUTE=0',
    })
    expect(plan.memory).toEqual([
      {
        sessionId: SESSION,
        content: '用户偏好中文',
        metadata: { importedVia: 'conversation-import' },
      },
    ])
    expect(plan.skipped).toContainEqual({
      dimension: 'automations',
      index: 1,
      reason: 'missing_prompt',
    })
    expect(plan.skipped).toContainEqual({
      dimension: 'automations',
      index: 0,
      reason: 'schedule_unmapped',
    })
    expect(plan.skipped).toContainEqual({
      dimension: 'capabilities',
      index: 0,
      reason: 'declaration_only',
    })
    expect(JSON.stringify(plan)).not.toContain('SUPERSECRETVALUE99')
    expect(JSON.stringify(plan)).not.toContain('0 2 * * *')
  })

  it('没有会话时记忆不落库，技能仍可落', () => {
    const plan = planRuntimeImport(
      {
        skills: [{ name: '审查', prompt: '按清单审查' }],
        memory: [{ text: '用户偏好中文' }],
      },
      null,
    )
    expect(plan.skills).toHaveLength(1)
    expect(plan.memory).toEqual([])
    expect(plan.skipped).toEqual([
      { dimension: 'memory', index: null, reason: 'needs_conversation' },
    ])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
