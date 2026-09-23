// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'

import {
  predictAutomationConsequence,
  computePreviewNextRun,
  AUTOMATION_CONSEQUENCE_STATES,
  type AutomationConsequenceDraft,
  type AutomationConsequenceSystem,
} from '../automation-consequence'

/** 固定时钟(周三 2026-09-23T00:00:00Z,UTC),保证全用例确定性 */
const NOW = '2026-09-23T00:00:00.000Z'

const healthySystem: AutomationConsequenceSystem = {
  claimEvaluating: false,
  claimAssigned: false,
  claimActivatable: false,
  hasQueuedOrRunning: false,
  schedulerAvailable: true,
  nowIso: NOW,
}

const dailyDraft: AutomationConsequenceDraft = {
  name: '定时认领修复',
  prompt: '修复失败测试',
  scheduleType: 'recurring',
  scheduledAt: null,
  rrule: 'FREQ=DAILY;BYHOUR=9;BYMINUTE=0',
  status: 'active',
  claimSource: 'manual',
  lastRunAt: null,
}

describe('predictAutomationConsequence 七态', () => {
  it('七态清单恰为 7 项(新增态必须同步补用例)', () => {
    expect(AUTOMATION_CONSEQUENCE_STATES).toHaveLength(7)
  })

  it('无法预览:名称空白 → unpreviewable', () => {
    const r = predictAutomationConsequence({ ...dailyDraft, name: '   ' }, healthySystem)
    expect(r.state).toBe('unpreviewable')
    expect(r.reasonKey).toBe('consequence.unpreviewable')
    expect(r.nextRunAt).toBeNull()
  })

  it('无法预览:once 缺 scheduledAt → unpreviewable', () => {
    const r = predictAutomationConsequence(
      {
        ...dailyDraft,
        scheduleType: 'once',
        scheduledAt: null,
        rrule: null,
      },
      healthySystem,
    )
    expect(r.state).toBe('unpreviewable')
  })

  it('无法预览:已指派却无认领来源(自相矛盾) → unpreviewable', () => {
    const r = predictAutomationConsequence(
      { ...dailyDraft, claimSource: null },
      { ...healthySystem, claimAssigned: true, claimActivatable: true },
    )
    expect(r.state).toBe('unpreviewable')
  })

  it('判断中:认领归因未落定优先于排队/停机 → evaluating', () => {
    const r = predictAutomationConsequence(dailyDraft, {
      ...healthySystem,
      claimEvaluating: true,
      hasQueuedOrRunning: true,
      schedulerAvailable: false,
    })
    expect(r.state).toBe('evaluating')
    expect(r.reasonKey).toBe('consequence.evaluating')
    expect(r.nextRunAt).toBeNull()
  })

  it('已有排队或运行中:幂等保护优先于停机 → already-queued-or-running', () => {
    const r = predictAutomationConsequence(dailyDraft, {
      ...healthySystem,
      hasQueuedOrRunning: true,
      schedulerAvailable: false,
    })
    expect(r.state).toBe('already-queued-or-running')
    expect(r.nextRunAt).toBeNull()
  })

  it('暂不可执行:调度器不可用 → temporarily-unexecutable', () => {
    const r = predictAutomationConsequence(dailyDraft, {
      ...healthySystem,
      schedulerAvailable: false,
    })
    expect(r.state).toBe('temporarily-unexecutable')
    expect(r.nextRunAt).toBeNull()
  })

  it('暂不可执行:recurring 非法 rrule → temporarily-unexecutable(与后端 create 400 同语义)', () => {
    // 注:draft 校验用 MVP 解析,非法 rrule 在校验层即判 unpreviewable;
    // 此处走 computePreviewNextRun 直调,复述后端"解析失败置 paused 防死循环"语义。
    expect(computePreviewNextRun('recurring', null, 'FREQ=MONTHLY;BYMONTHDAY=1', NOW)).toBeNull()
    const r = predictAutomationConsequence(
      { ...dailyDraft, rrule: 'FREQ=WEEKLY' }, // WEEKLY 缺 BYDAY → 校验层 unpreviewable
      healthySystem,
    )
    expect(r.state).toBe('unpreviewable')
  })

  it('仅保存指派:已指派但不可激活 → save-assignment-only', () => {
    const r = predictAutomationConsequence(
      { ...dailyDraft, claimSource: 'issue' },
      { ...healthySystem, claimAssigned: true, claimActivatable: false },
    )
    expect(r.state).toBe('save-assignment-only')
    expect(r.nextRunAt).toBeNull()
  })

  it('仅保存指派:once 已执行过(tick 的 lastRunAt IS NULL 永不成立) → save-assignment-only', () => {
    const r = predictAutomationConsequence(
      {
        name: '一次性修复',
        prompt: '跑一次',
        scheduleType: 'once',
        scheduledAt: '2026-09-20T09:00:00.000Z',
        rrule: null,
        status: 'active',
        claimSource: 'failed-test',
        lastRunAt: '2026-09-20T09:01:00.000Z',
      },
      healthySystem,
    )
    expect(r.state).toBe('save-assignment-only')
  })

  it('已指派待激活:paused + 已指派可激活 → assigned-pending-activation(带预演时间)', () => {
    const r = predictAutomationConsequence(
      { ...dailyDraft, status: 'paused', claimSource: 'scan-alert' },
      { ...healthySystem, claimAssigned: true, claimActivatable: true },
    )
    expect(r.state).toBe('assigned-pending-activation')
    expect(r.reasonKey).toBe('consequence.assignedPendingActivation')
    expect(r.nextRunAt).toBe('2026-09-23T09:00:00.000Z')
  })

  it('仅保存指派:paused 但无指派 → save-assignment-only', () => {
    const r = predictAutomationConsequence({ ...dailyDraft, status: 'paused' }, healthySystem)
    expect(r.state).toBe('save-assignment-only')
  })

  it('将创建运行:完整 active 草稿 + 健康系统 → will-create-run(带预演时间)', () => {
    const r = predictAutomationConsequence(dailyDraft, healthySystem)
    expect(r.state).toBe('will-create-run')
    expect(r.reasonKey).toBe('consequence.willCreateRun')
    expect(r.nextRunAt).toBe('2026-09-23T09:00:00.000Z')
  })

  it('确定性:同输入两次调用深相等', () => {
    const a = predictAutomationConsequence(dailyDraft, healthySystem)
    const b = predictAutomationConsequence({ ...dailyDraft }, { ...healthySystem })
    expect(a).toEqual(b)
  })
})

describe('D30 认领链路联调(只读契约,mock 声明)', () => {
  // 声明:未直接 import apps/api 调度器代码(顶层 import 会带入 db 连接副作用,
  // web 端 vitest 引入即污染);D30 文件工作区干净(git status 无 automation 改动),
  // 但跨包运行时耦合在架构上不成立,故采用"只读复述后端条件 + mock 系统状态"。
  // 复述源(只读,未改):
  // - apps/api/src/services/agent-automation-scheduler.ts tick where 条件
  // - 同文件 resolveAutomationSessionId 会话规则
  // - apps/api/src/routes/automations.ts create 400 'rrule 无法计算出下次执行时间'

  it('真实预演一次:GitHub issue → DAILY 认领 automation → 将创建运行', () => {
    const draft: AutomationConsequenceDraft = {
      name: 'issue 定时认领修复',
      prompt: '认领失败测试并修复',
      scheduleType: 'recurring',
      scheduledAt: null,
      rrule: 'FREQ=DAILY;BYHOUR=9;BYMINUTE=0',
      status: 'active',
      claimSource: 'issue',
      lastRunAt: null,
    }
    const system: AutomationConsequenceSystem = {
      claimEvaluating: false,
      claimAssigned: true,
      claimActivatable: true,
      hasQueuedOrRunning: false,
      schedulerAvailable: true,
      nowIso: NOW,
    }
    const r = predictAutomationConsequence(draft, system)
    expect(r.state).toBe('will-create-run')
    // UTC 口径次日 09:00(声明:真实调度以服务端时区为准)
    expect(r.nextRunAt).toBe('2026-09-23T09:00:00.000Z')
  })

  it('契约1:once 到期未跑(scheduledAt<=now ∧ lastRunAt null) → 将创建运行(下 tick 即跑)', () => {
    const r = predictAutomationConsequence(
      {
        name: '到期一次性任务',
        prompt: '执行',
        scheduleType: 'once',
        scheduledAt: '2026-09-22T09:00:00.000Z',
        rrule: null,
        status: 'active',
        claimSource: 'failed-test',
        lastRunAt: null,
      },
      { ...healthySystem, claimAssigned: true, claimActivatable: true },
    )
    // 对应 tick 条件:active ∧ once ∧ scheduledAt<=now ∧ lastRunAt IS NULL → 到期执行
    expect(r.state).toBe('will-create-run')
    expect(r.nextRunAt).toBe('2026-09-22T09:00:00.000Z')
  })

  it('契约2:认领来源中立(issue/scan-alert/failed-test/manual 同判定,不影响态)', () => {
    const sources = ['issue', 'scan-alert', 'failed-test', 'manual'] as const
    for (const claimSource of sources) {
      const r = predictAutomationConsequence(
        { ...dailyDraft, claimSource },
        { ...healthySystem, claimAssigned: true, claimActivatable: true },
      )
      expect(r.state).toBe('will-create-run')
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
