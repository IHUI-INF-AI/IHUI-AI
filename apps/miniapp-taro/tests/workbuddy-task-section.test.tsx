// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「自动做任务」区块(WorkBuddy 任务中心六族)小程序端验收。
 *
 * 端不一致是本票的起点:web 端 WorkbuddyTaskPanel 早已有这块,小程序签到助手页没有。
 * 本文件量四件事:
 *  ① 无 workbuddy 账号 ⇒ 整块不挂载、零请求(api.get / api.post 都不许被打);
 *  ② 一键做任务的请求体必须 `{kind:'all', dry_run:false}`,预演必须 dry_run:true;
 *  ③ 巡检态判定**只有一份实现**(packages/shared/src/utils/workbuddy-sweep-view.ts):
 *     本端只把档位翻译成自己的 i18n 键;三端各自长回一份本地判定 = 本票要根治的病。
 *  ④ 装车证明:区块真的挂在签到助手页的渲染树里(摘掉渲染点本条必红)。
 *
 * 取证边界(如实):本仓小程序端无 DOM 测试环境(无 @testing-library / react-test-renderer),
 * 所以这里证的是**静态渲染输出**(renderToStaticMarkup)、**请求出口**(直接调导出的
 * loadTasks/run 函数)与**源码结构**;不是"真机点过按钮"。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tarojs/components', () => {
  const make = (tag: string) => {
    const Comp = (props: Record<string, unknown>) => createElement(tag, props)
    Comp.displayName = `TaroStub_${tag}`
    return Comp
  }
  return { View: make('div'), Text: make('span') }
})

// 请求层整层替身:计数即"有没有打请求"的唯一证据。
vi.mock('@/api', () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
}))

import * as api from '@/api'
import type { CheckinSchedulerStatusResponse } from '@ihui/types'
import {
  WorkbuddyTaskSection,
  deriveSweepView,
  loadWorkbuddyTasks,
  runWorkbuddyTasks,
  workbuddyTaskRunBody,
} from '@/pkg-user/checkin-assistant/WorkbuddyTaskSection'

const HERE = dirname(fileURLToPath(import.meta.url))
const SECTION_SOURCE = join(HERE, '../src/pkg-user/checkin-assistant/WorkbuddyTaskSection.tsx')
const PAGE_SOURCE = join(HERE, '../src/pkg-user/checkin-assistant/index.tsx')

function translate(key: string, params?: Record<string, string | number>): string {
  return params ? `«${key}»(${JSON.stringify(params)})` : `«${key}»`
}

const getMock = api.get as unknown as ReturnType<typeof vi.fn>
const postMock = api.post as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  getMock.mockReset()
  postMock.mockReset()
})

describe('小程序端「自动做任务」:只对有 workbuddy 账号的用户出现', () => {
  it('① 无 workbuddy 账号 ⇒ 整块不渲染,且零请求', () => {
    const html = renderToStaticMarkup(
      createElement(WorkbuddyTaskSection, {
        accounts: [
          { id: 1, name: 'trae-1', platform: 'trae' },
          { id: 2, name: 'qoder-1', platform: 'qoder' },
          { id: 3, name: '无平台', platform: null },
        ],
        t: translate,
      }),
    )
    expect(html).toBe('')
    expect(getMock).toHaveBeenCalledTimes(0)
    expect(postMock).toHaveBeenCalledTimes(0)
  })

  it('①-反向对照:有 workbuddy 账号 ⇒ 标题挂出来(证明不是永远返回空)', () => {
    const html = renderToStaticMarkup(
      createElement(WorkbuddyTaskSection, {
        accounts: [{ id: 9, name: 'wb-1', platform: 'workbuddy' }],
        t: translate,
      }),
    )
    expect(html).toContain('data-testid="wb-task-section"')
    expect(html).toContain('«checkinAssistant.taskTitle»')
    // 折叠态不拉巡检态:展开才请求(与 web 端"点开才查"同口径)
    expect(getMock).toHaveBeenCalledTimes(0)
  })

  it('② 一键做任务:body 恒为 kind=all,dry_run 随动作切换', async () => {
    postMock.mockResolvedValue({
      ok: true,
      kind: 'run',
      accepted: [],
      claimed: [],
      credit_delta: 0,
      reason: null,
      unjudged: false,
    })

    expect(workbuddyTaskRunBody(false)).toEqual({ kind: 'all', dry_run: false })
    expect(workbuddyTaskRunBody(true)).toEqual({ kind: 'all', dry_run: true })

    await runWorkbuddyTasks(7, false)
    expect(postMock).toHaveBeenLastCalledWith('/checkin/accounts/7/task-run', {
      kind: 'all',
      dry_run: false,
    })

    await runWorkbuddyTasks(7, true)
    expect(postMock).toHaveBeenLastCalledWith('/checkin/accounts/7/task-run', {
      kind: 'all',
      dry_run: true,
    })
    expect(postMock).toHaveBeenCalledTimes(2)
  })

  it('②-附带:读取任务是只读 GET,且账号 id 过了 encodeURIComponent', async () => {
    getMock.mockResolvedValue({ ok: true, kind: 'list', tasks: [], reason: null, unjudged: false })
    await loadWorkbuddyTasks(42)
    expect(getMock).toHaveBeenCalledWith('/checkin/accounts/42/tasks')
  })
})

describe('巡检态七档:判定在共享判据,本端只做翻译(2026-10-31 契约)', () => {
  const base = {
    enabled: true,
    started: true,
    next_run: null,
    next_run_qoder: null,
  }

  /**
   * `not_running_reason` 尚未进 `packages/types`(后端席并行落),故这里按冻结契约喂字段
   * 并集中做一次断言式转换 —— types 面补齐后这一处 cast 可整块删掉(不在端上散落)。
   */
  const sweepOf = (
    wbTasks?: Record<string, unknown>,
    next = '2026-10-31T12:34:56.000Z',
  ): CheckinSchedulerStatusResponse =>
    ({
      ...base,
      next_run_wb_tasks: next,
      ...(wbTasks
        ? {
            wb_tasks: {
              enabled: true,
              tasks_enabled: true,
              cron_enabled: true,
              live_run: true,
              sweep_minutes: 30,
              claim_path_configured: true,
              activity_path_configured: true,
              last_sweep: null,
              ...wbTasks,
            },
          }
        : {}),
    }) as unknown as CheckinSchedulerStatusResponse

  it('enabled=true ⇒ on(观测态说了算,两门意图再关也不影响这一档)', () => {
    const view = deriveSweepView(
      sweepOf({ enabled: true, tasks_enabled: false, cron_enabled: false }),
      null,
      translate,
    )
    expect(view.tone).toBe('on')
    expect(view.text).toBe('«checkinAssistant.taskAutoOn»({"minutes":30})')
    // ISO 前 16 位截断,不走 toLocaleString(截断实现也在共享判据里)
    expect(view.next).toBe('2026-10-31 12:34')
  })

  it('enabled=true 但是演练模式 ⇒ dry,不得说"已启用"', () => {
    const view = deriveSweepView(sweepOf({ live_run: false }), null, translate)
    expect(view.tone).toBe('dry')
    expect(view.text).toBe('«checkinAssistant.taskAutoDry»')
  })

  it('enabled=false 且 reason=scheduler_not_started ⇒ 新档 not-registered(出路=重启 ai-service)', () => {
    const view = deriveSweepView(
      sweepOf({ enabled: false, not_running_reason: 'scheduler_not_started' }),
      null,
      translate,
    )
    expect(view.tone).toBe('not-registered')
    expect(view.text).toBe('«checkinAssistant.taskAutoNotStarted»')
    // 绝不冒充"已启用",也不冒充"未启用"(那是另一种结论)
    expect(view.text).not.toContain('taskAutoOn')
    expect(view.text).not.toContain('taskAutoOff')
  })

  it('reason=job_not_registered ⇒ 同落 not-registered(两条出路相同)', () => {
    expect(
      deriveSweepView(
        sweepOf({ enabled: false, not_running_reason: 'job_not_registered' }),
        null,
        translate,
      ).tone,
    ).toBe('not-registered')
  })

  it('reason=tasks_gate_off ⇒ tasks-off(未启用,仅手动)', () => {
    const view = deriveSweepView(
      sweepOf({ enabled: false, tasks_enabled: false, not_running_reason: 'tasks_gate_off' }),
      null,
      translate,
    )
    expect(view.tone).toBe('tasks-off')
    expect(view.text).toBe('«checkinAssistant.taskAutoOff»')
  })

  it('reason=cron_gate_off ⇒ cron-blocked 且点名总闸', () => {
    const view = deriveSweepView(
      sweepOf({ enabled: false, cron_enabled: false, not_running_reason: 'cron_gate_off' }),
      null,
      translate,
    )
    expect(view.tone).toBe('cron-blocked')
    expect(view.text).toBe('«checkinAssistant.taskAutoCronBlocked»')
  })

  it('旧服务端(无 not_running_reason)+ 任务门开、总闸关 ⇒ 仍判 cron-blocked(向后兼容锁)', () => {
    const view = deriveSweepView(
      sweepOf({ enabled: false, tasks_enabled: true, cron_enabled: false }),
      null,
      translate,
    )
    expect(view.tone).toBe('cron-blocked')
    expect(view.text).toBe('«checkinAssistant.taskAutoCronBlocked»')
  })

  it('旧服务端(无 not_running_reason)+ 其余组合 ⇒ unknown,不替服务端编原因', () => {
    const view = deriveSweepView(
      sweepOf({ enabled: false, tasks_enabled: false, cron_enabled: true }),
      null,
      translate,
    )
    expect(view.tone).toBe('unknown')
    expect(view.text).toBe('«checkinAssistant.taskAutoUnknown»')
  })

  it('取不到状态(旧服务端/请求失败)⇒ unknown,绝不写成未启用;详情用统一连接符追加', () => {
    const view = deriveSweepView(
      { ...base } as unknown as CheckinSchedulerStatusResponse,
      'HTTP 404',
      translate,
    )
    expect(view.tone).toBe('unknown')
    expect(view.text).toContain('«checkinAssistant.taskAutoUnknown»')
    expect(view.text).toContain('HTTP 404')
    expect(view.text).toBe('«checkinAssistant.taskAutoUnknown» · HTTP 404')
    expect(view.text).not.toBe('«checkinAssistant.taskAutoOff»')
  })

  it('还没取到 ⇒ loading 档(独立于 unknown,不再混成一格)', () => {
    const view = deriveSweepView(undefined, null, translate)
    expect(view.tone).toBe('loading')
    expect(view.text).toBe('«checkinAssistant.taskAutoLoading»')
  })

  it('路径未配置 ⇒ 单独提示"只上报不领奖"', () => {
    expect(
      deriveSweepView(sweepOf({ claim_path_configured: false }), null, translate).pathsMissing,
    ).toBe(true)
  })
})

describe('结构纪律与装车证明', () => {
  it('③ 判据同源锁:本端不得再长回一份本地判定', () => {
    const src = readFileSync(SECTION_SOURCE, 'utf8')
    // 判据必须从共享出口取(摘掉 import ⇒ 下面几条"不该出现"会变成假绿)
    expect(src).toMatch(/from '@ihui\/shared\/utils\/workbuddy-sweep-view'/)
    expect(src).toMatch(/deriveWbSweepView\(/)
    // 本地判定三型:两门字面判据 / 档位字面量集合 / 手搓 ISO 截断 ⇒ 一律不得出现在本端
    expect(src).not.toMatch(/wt\.tasks_enabled\s*&&\s*!?wt\.cron_enabled/)
    expect(src).not.toMatch(/export type SweepTone = 'on/)
    expect(src).not.toMatch(/slice\(0,\s*16\)\.replace\('T'/)
    // 时间口径:ISO 截断在共享判据里,本端只调用
    expect(src).toMatch(/formatWbIsoMinute\(/)
    expect(src).not.toMatch(/\.toLocaleString\s*\(/)
    // 判据确实只有一份实现:共享文件里那段判定在,且本端没有任何 enabled 分支
    const sharedSource = readFileSync(
      join(HERE, '../../../packages/shared/src/utils/workbuddy-sweep-view.ts'),
      'utf8',
    )
    expect(sharedSource).toMatch(/if \(wt\.enabled\)/)
    expect(sharedSource).toMatch(/wt\.tasks_enabled === true && wt\.cron_enabled === false/)
    // 零请求的结构保证:挂载判据必须是 platform==='workbuddy'
    expect(src).toMatch(/platform\s*\?\?\s*''\)\s*===\s*'workbuddy'/)
  })

  it('③-跨端同源:web/RN 两端也不得长回本地判定', () => {
    for (const rel of [
      '../../web/src/components/checkin/WorkbuddyTaskPanel.tsx',
      '../../mobile-rn/src/components/WorkbuddyTaskSection.tsx',
    ]) {
      const src = readFileSync(join(HERE, rel), 'utf8')
      expect(src).toMatch(/from '@ihui\/shared\/utils\/workbuddy-sweep-view'/)
      expect(src).not.toMatch(/wt\.tasks_enabled\s*&&\s*!?wt\.cron_enabled/)
      expect(src).not.toMatch(/slice\(0,\s*16\)\.replace\('T'/)
    }
  })

  it('④ 装车:签到助手页真的挂载本区块(摘掉渲染点本条必红)', () => {
    const page = readFileSync(PAGE_SOURCE, 'utf8')
    expect(page).toMatch(/import\s+WorkbuddyTaskSection\s+from\s+'\.\/WorkbuddyTaskSection'/)
    expect(page).toMatch(/<WorkbuddyTaskSection\s+accounts=\{list\}\s+t=\{t\}\s*\/>/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
