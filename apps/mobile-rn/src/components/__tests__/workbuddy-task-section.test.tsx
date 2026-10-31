// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * App(RN)端「自动做任务」区块契约测试(2026-10-31 立,补端不一致)。
 *
 * 钉五件事(与 Web `workbuddy-task-panel.test.tsx` 同一组判据):
 *  ① 无 workbuddy 账号 ⇒ 整块不渲染且零请求(不打空 id);
 *  ② 「一键做任务」发 kind='all' + dry_run=false,预演发 dry_run=true(顺序由后端 SWEEP_ORDER 定,
 *     本端不得自行拆请求);
 *  ③ 巡检态判定**只有一份实现**(packages/shared/src/utils/workbuddy-sweep-view.ts):本端只把
 *     档位翻成 i18n 键。七档(on/dry/cron-blocked/tasks-off/not-registered + loading/unknown)
 *     各自文案不互相冒充;`enabled` 是观测态,不是"两门与";旧服务端缺 not_running_reason 时
 *     只保留"总闸拦"这一条推断,其余落「状态未知」;
 *  ④ 上一轮回执按 ISO 前 16 位截断,note 原样追加;
 *  ⑤ unjudged=true 不冒充成功:reason 原样呈现。
 *
 * 取证边界:本机没有 8802 服务、RN 界面也不能在 vitest 里真机渲染 ⇒ 本文件证的是 jsdom 下的
 * 渲染输出与真实请求形参,不是「真机已渲染」。React DOM 会丢弃 testID 这类未知属性,
 * 故断言走文本与请求体,不走 testID。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchApiMock = vi.fn()

vi.mock('@ihui/api-client', () => ({
  fetchApi: (...args: unknown[]) => fetchApiMock(...args),
}))

vi.mock('../../i18n', () => {
  // 带插值参数时把参数拼进 key:这样「时间真的截断成 ISO 前 16 位并传进去了」也可断言。
  const t = (key: string, params?: Record<string, string | number>): string =>
    params && Object.keys(params).length > 0 ? `${key}(${Object.values(params).join(',')})` : key
  return { useI18n: () => ({ t, locale: 'zh-CN', setLocale: async () => {} }) }
})

import { WorkbuddyTaskSection, deriveSweepView } from '../WorkbuddyTaskSection'
import type { CheckinSchedulerStatusResponse } from '@ihui/types'

/**
 * `not_running_reason` 尚未进 `packages/types`(后端席并行落)。用例按冻结契约喂这个字段,
 * 集中做一次断言式转换;types 面补齐后这一处 cast 可整块删掉(不在用例里散落)。
 */
const asStatus = (v: unknown): CheckinSchedulerStatusResponse =>
  v as unknown as CheckinSchedulerStatusResponse

const ACCOUNT_WB = { id: 7, name: 'wb-acc', platform: 'workbuddy' }
const ACCOUNT_TRAE = { id: 9, name: 'trae-acc', platform: 'trae' }

const translate = (key: string, params?: Record<string, string | number>): string =>
  params && Object.keys(params).length > 0 ? `${key}(${Object.values(params).join(',')})` : key

/** 本端源文件(判据同源锁按源码结构判,和小程序端同一条纪律)。 */
const SECTION_SOURCE = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'WorkbuddyTaskSection.tsx',
)

/** wb_tasks 公共字段基线(用例只覆盖判定相关的那几个)。 */
const SWEEP_BASE = {
  tasks_enabled: true,
  cron_enabled: true,
  live_run: true,
  sweep_minutes: 180,
  claim_path_configured: true,
  activity_path_configured: true,
  last_sweep: null,
}

/** 巡检态基线:未启用(默认安全态),用例按需覆盖单个字段。 */
const sweepOf = (over: Record<string, unknown> = {}, top: Record<string, unknown> = {}) => ({
  success: true,
  data: {
    enabled: false,
    started: false,
    next_run: null,
    next_run_qoder: null,
    next_run_probe: null,
    next_run_wb_tasks: null,
    wb_tasks: {
      enabled: false,
      tasks_enabled: false,
      cron_enabled: true,
      live_run: false,
      sweep_minutes: 180,
      claim_path_configured: true,
      activity_path_configured: true,
      last_sweep: null,
      ...over,
    },
    ...top,
  },
})

const RUN_OK = {
  success: true,
  data: {
    ok: true,
    kind: 'all',
    accepted: ['activity', 'growth'],
    claimed: ['lottery'],
    credit_delta: 12,
    energy_delta: 3,
    reason: null,
    unjudged: false,
  },
}

/** 按路径分流 mock:展开会先取 scheduler/status,再按点击取 tasks / task-run。 */
function routeMock(
  opts: {
    sweep?: unknown
    run?: unknown
    list?: unknown
  } = {},
) {
  fetchApiMock.mockImplementation(async (path: string) => {
    if (path === '/api/checkin/scheduler/status') return opts.sweep ?? sweepOf()
    if (path.endsWith('/task-run')) return opts.run ?? RUN_OK
    if (path.endsWith('/tasks')) {
      return (
        opts.list ?? {
          success: true,
          data: { ok: true, kind: 'list', tasks: [], reason: null, unjudged: false },
        }
      )
    }
    throw new Error(`unexpected path: ${path}`)
  })
}

const bodyText = () => document.body.textContent ?? ''

async function openSection() {
  fireEvent.click(screen.getByLabelText('checkinAssistant.taskTitle'))
  await waitFor(() => expect(fetchApiMock).toHaveBeenCalled())
}

beforeEach(() => {
  fetchApiMock.mockReset()
})

describe('RN 自动做任务区块', () => {
  it('① 无 workbuddy 账号 ⇒ 不渲染且零请求', () => {
    routeMock()
    const { container } = render(<WorkbuddyTaskSection accounts={[ACCOUNT_TRAE]} />)
    expect(container.firstChild).toBeNull()
    expect(fetchApiMock).not.toHaveBeenCalled()
  })

  it('② 一键做任务发 kind=all + dry_run=false;预演发 dry_run=true', async () => {
    routeMock()
    render(<WorkbuddyTaskSection accounts={[ACCOUNT_WB]} />)
    // 折叠态不取巡检态(零请求),这也保证「展开才请求」这条口径。
    expect(fetchApiMock).not.toHaveBeenCalled()

    await openSection()
    fireEvent.click(screen.getByText('checkinAssistant.taskRun'))

    await waitFor(() => {
      const call = fetchApiMock.mock.calls.find((c) => String(c[0]).endsWith('/task-run'))
      expect(call).toBeTruthy()
      expect(call?.[0]).toBe('/api/checkin/accounts/7/task-run')
      expect(JSON.parse(String((call?.[1] as { body: string }).body))).toEqual({
        kind: 'all',
        dry_run: false,
      })
    })

    fetchApiMock.mockClear()
    routeMock()
    fireEvent.click(screen.getByText('checkinAssistant.taskDryRun'))
    await waitFor(() => {
      const call = fetchApiMock.mock.calls.find((c) => String(c[0]).endsWith('/task-run'))
      expect(JSON.parse(String((call?.[1] as { body: string }).body))).toEqual({
        kind: 'all',
        dry_run: true,
      })
    })
  })

  it('③ 巡检态-on:enabled(观测态)为真且真实写入 ⇒ 已启用,并带下次时间(ISO 前 16 位)', async () => {
    const sweep = {
      enabled: true,
      started: true,
      next_run: null,
      next_run_qoder: null,
      next_run_wb_tasks: '2026-10-31T09:00:00+08:00',
      wb_tasks: {
        enabled: true,
        // 观测态优先:两门意图即便全关(旧数据/异常回执),只要进程里真注册了就报已启用
        tasks_enabled: false,
        cron_enabled: false,
        not_running_reason: null,
        live_run: true,
        sweep_minutes: 30,
        claim_path_configured: true,
        activity_path_configured: true,
        last_sweep: null,
      },
    }
    expect(deriveSweepView(sweep, null, translate)).toMatchObject({
      tone: 'on',
      next: '2026-10-31 09:00',
    })

    routeMock({ sweep: { success: true, data: sweep } })
    render(<WorkbuddyTaskSection accounts={[ACCOUNT_WB]} />)
    await openSection()
    await waitFor(() => expect(bodyText()).toContain('checkinAssistant.taskAutoOn(30)'))
    expect(bodyText()).toContain('checkinAssistant.taskAutoNext(2026-10-31 09:00)')
  })

  it('③ 巡检态-dry:enabled 但演练模式 ⇒ 明说不会真实领奖', async () => {
    routeMock({ sweep: sweepOf({ enabled: true, tasks_enabled: true, live_run: false }) })
    render(<WorkbuddyTaskSection accounts={[ACCOUNT_WB]} />)
    await openSection()
    await waitFor(() => expect(bodyText()).toContain('checkinAssistant.taskAutoDry'))
    expect(bodyText()).not.toContain('checkinAssistant.taskAutoOn')
  })

  it('③ 巡检态-cron-blocked:reason=cron_gate_off ⇒ 说被总闸拦,不说未启用', async () => {
    routeMock({
      sweep: sweepOf({
        enabled: false,
        tasks_enabled: true,
        cron_enabled: false,
        not_running_reason: 'cron_gate_off',
      }),
    })
    render(<WorkbuddyTaskSection accounts={[ACCOUNT_WB]} />)
    await openSection()
    await waitFor(() => expect(bodyText()).toContain('checkinAssistant.taskAutoCronBlocked'))
    expect(bodyText()).not.toContain('checkinAssistant.taskAutoOff')
  })

  it('③ 向后兼容锁:旧服务端不给 not_running_reason,两门原值仍能认出总闸拦', async () => {
    const legacy = {
      enabled: true,
      started: true,
      next_run: null,
      next_run_qoder: null,
      next_run_wb_tasks: null,
      wb_tasks: {
        ...SWEEP_BASE,
        enabled: false,
        tasks_enabled: true,
        cron_enabled: false,
      },
    }
    expect(deriveSweepView(asStatus(legacy), null, translate).tone).toBe('cron-blocked')
  })

  it('③ 巡检态-not-registered:reason=scheduler_not_started ⇒ 新档,绝不显示"已启用"', async () => {
    const notStarted = {
      enabled: true,
      started: false,
      next_run: null,
      next_run_qoder: null,
      next_run_wb_tasks: null,
      wb_tasks: {
        ...SWEEP_BASE,
        enabled: false,
        tasks_enabled: true,
        cron_enabled: true,
        not_running_reason: 'scheduler_not_started',
      },
    }
    const view = deriveSweepView(asStatus(notStarted), null, translate)
    expect(view.tone).toBe('not-registered')
    expect(view.text).toBe('checkinAssistant.taskAutoNotStarted')
    expect(view.text).not.toContain('taskAutoOn')

    routeMock({
      sweep: sweepOf({
        enabled: false,
        tasks_enabled: true,
        cron_enabled: true,
        not_running_reason: 'scheduler_not_started',
      }),
    })
    render(<WorkbuddyTaskSection accounts={[ACCOUNT_WB]} />)
    await openSection()
    await waitFor(() => expect(bodyText()).toContain('checkinAssistant.taskAutoNotStarted'))
    expect(bodyText()).not.toContain('checkinAssistant.taskAutoOn')
  })

  it('③ 巡检态-tasks-off:reason=tasks_gate_off ⇒ 未启用(仅手动)', async () => {
    routeMock({
      sweep: sweepOf({
        enabled: false,
        tasks_enabled: false,
        not_running_reason: 'tasks_gate_off',
      }),
    })
    render(<WorkbuddyTaskSection accounts={[ACCOUNT_WB]} />)
    await openSection()
    await waitFor(() => expect(bodyText()).toContain('checkinAssistant.taskAutoOff'))
  })

  it('③ 巡检态-unknown:服务端没给 wb_tasks ⇒ 状态未知,绝不写成未启用', async () => {
    routeMock({
      sweep: {
        success: true,
        data: { enabled: false, started: false, next_run: null, next_run_qoder: null },
      },
    })
    render(<WorkbuddyTaskSection accounts={[ACCOUNT_WB]} />)
    await openSection()
    await waitFor(() => expect(bodyText()).toContain('checkinAssistant.taskAutoUnknown'))
    expect(bodyText()).not.toContain('checkinAssistant.taskAutoOff')
  })

  it('③ 巡检态-loading:还没取到 ⇒ 独立档位,不冒充 unknown/on', () => {
    expect(deriveSweepView(undefined, null, translate).tone).toBe('loading')
  })

  it('③ 连接符同源:未判定档把详情用「 · 」追加(web/小程序同一长相)', () => {
    expect(deriveSweepView(null, 'HTTP 502', translate).text).toBe(
      'checkinAssistant.taskAutoUnknown · HTTP 502',
    )
  })

  it('③ 判据同源锁:本端源文件不得留任何字面判定,判定必须来自 shared 唯一实现', () => {
    const src = readFileSync(SECTION_SOURCE, 'utf8')
    expect(src).toMatch(/from '@ihui\/shared\/utils\/workbuddy-sweep-view'/)
    expect(src).toMatch(/deriveWbSweepView\(/)
    // 三型本地复算一律不得回归(它们就是曾经漂移出三份的那段判据)
    expect(src).not.toMatch(/wt\.tasks_enabled\s*&&\s*!?wt\.cron_enabled/)
    expect(src).not.toMatch(/if \(!wt\.enabled\)/)
    expect(src).not.toMatch(/slice\(0,\s*16\)\.replace\('T'/)
    // 七档映射表必须穷举(少一档 = 那一档没文案/没上色);键形允许带引号或不带(含 - 的必须带)
    for (const tone of [
      'loading',
      'on',
      'dry',
      'cron-blocked',
      'tasks-off',
      'not-registered',
      'unknown',
    ]) {
      expect(src.includes(`'${tone}':`) || src.includes(`${tone}:`), `缺档位映射: ${tone}`).toBe(
        true,
      )
    }
    // 反证:摘掉共享 import 的那一行,本端结构上就判不出档位(不存在第二份真相)
    expect(src).not.toMatch(/export function deriveWbSweepView/)
  })

  it('③b 上一轮回执:ISO 截到分钟,note 非空原样追加', async () => {
    routeMock({
      sweep: sweepOf({
        enabled: true,
        tasks_enabled: true,
        live_run: true,
        sweep_minutes: 60,
        last_sweep: {
          at: '2026-10-31T08:05:12+08:00',
          finished_at: '2026-10-31T08:07:00+08:00',
          dry_run: false,
          accounts: 1,
          families: 4,
          accepted: 2,
          claimed: 1,
          unjudged: 0,
          errors: 0,
          skipped_cooldown: 0,
          note: '出站暂停:本轮提前结束',
        },
      }),
    })
    render(<WorkbuddyTaskSection accounts={[ACCOUNT_WB]} />)
    await openSection()
    await waitFor(() =>
      expect(bodyText()).toContain('checkinAssistant.taskAutoLast(2026-10-31 08:05)'),
    )
    expect(bodyText()).toContain('checkinAssistant.taskAutoLastStats(4,2,1)')
    expect(bodyText()).toContain('出站暂停:本轮提前结束')
  })

  it('③c 本进程没跑过 ⇒ 尚未巡检(不是失败)', async () => {
    routeMock()
    render(<WorkbuddyTaskSection accounts={[ACCOUNT_WB]} />)
    await openSection()
    await waitFor(() => expect(bodyText()).toContain('checkinAssistant.taskAutoLastNever'))
  })

  it('④ unjudged=true ⇒ reason 原样呈现,不冒充成功', async () => {
    routeMock({
      run: {
        success: true,
        data: {
          ok: true,
          kind: 'all',
          accepted: [],
          claimed: [],
          credit_delta: null,
          energy_delta: null,
          reason: 'upstream 500: body unparsable',
          unjudged: true,
        },
      },
    })
    render(<WorkbuddyTaskSection accounts={[ACCOUNT_WB]} />)
    await openSection()
    fireEvent.click(screen.getByText('checkinAssistant.taskRun'))

    await waitFor(() => expect(bodyText()).toContain('checkinAssistant.taskResult'))
    expect(bodyText()).toContain('unjudged=true')
    expect(bodyText()).toContain('upstream 500: body unparsable')
    expect(bodyText()).toContain('checkinAssistant.taskUnjudged')
  })

  it('⑤ 结果区原样展示 accepted / claimed / credit_delta', async () => {
    routeMock()
    render(<WorkbuddyTaskSection accounts={[ACCOUNT_WB]} />)
    await openSection()
    fireEvent.click(screen.getByText('checkinAssistant.taskRun'))

    await waitFor(() => expect(bodyText()).toContain('accepted=2'))
    expect(bodyText()).toContain('claimed=1')
    expect(bodyText()).toContain('credits=12')
    expect(bodyText()).toContain('+activity, growth')
    expect(bodyText()).toContain('✓ lottery')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
