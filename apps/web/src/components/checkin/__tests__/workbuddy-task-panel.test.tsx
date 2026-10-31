// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import * as React from 'react'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { WorkbuddyTaskPanel } from '../WorkbuddyTaskPanel'

/**
 * 「自动做任务」面板契约测试。
 *
 * 钉死四件事(都是踩过的真实风险):
 * 1. 无 WorkBuddy 账号 ⇒ 自判空,不发任何请求(不外泄空态、不打空 id);
 * 2. 「一键做任务」发的是 `kind='all'` + `dry_run=false`,预演发 `dry_run=true`
 *    —— 顺序由后端 SWEEP_ORDER 单一真源决定,面板不得自行拼六次请求;
 * 3. 结果原样呈现 accepted/claimed/unjudged,不把 unjudged 冒充成功;
 * 4. 巡检态判定**只有一份实现**(`packages/shared/src/utils/workbuddy-sweep-view.ts`):
 *    七档 + `not_running_reason` 四因分档 + 旧服务端兼容推断都在共享判据里,本端只登记
 *    「档位 → i18n 键 / 配色类名」两张表(2026-10-31 收三端各自一抄的实测漂移)。
 */

const fetchAiServiceJson = vi.fn()

vi.mock('@/lib/api', () => ({
  fetchAiServiceJson: (...args: unknown[]) => fetchAiServiceJson(...args),
}))

vi.mock('next-intl', () => ({
  // 带插值参数时把参数拼进 key(如 taskPanelAutoOn(30)),这样「时间/节拍真的传进去了」
  // 也能被断言到,而不是只验 key 出现过。
  useTranslations:
    () =>
    (key: string, values?: Record<string, unknown>): string =>
      values && Object.keys(values).length > 0 ? `${key}(${Object.values(values).join(',')})` : key,
}))

// ui-react 的 log-viewer 也引 lucide 图标 ⇒ 必须 spread 实际模块,只覆盖本组件用到的几个。
vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  const Icon = () => <span data-testid="icon" />
  return {
    ...actual,
    ChevronDown: Icon,
    ListChecks: Icon,
    Loader2: Icon,
    PlayCircle: Icon,
    RefreshCw: Icon,
  }
})

const ACCOUNTS = [
  { id: 7, name: '192****0269', platform: 'workbuddy', enabled: true },
  { id: 9, name: 'trae-acc', platform: 'trae', enabled: true },
]

beforeEach(() => {
  fetchAiServiceJson.mockReset()
})

afterEach(() => {
  cleanup()
})

/** 巡检态基线:未启用(任务门关,由 not_running_reason 点名)。用例按需覆盖单个字段。 */
const SWEEP_OFF = {
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
      // 2026-10-31 契约:enabled 是观测态,未运行的原因由服务端点名;缺这个字段=旧服务端,
      // 判序只保留"总闸拦"一条推断,其余落「状态未知」(不替服务端编原因)。
      not_running_reason: 'tasks_gate_off',
      live_run: false,
      sweep_minutes: 180,
      claim_path_configured: true,
      activity_path_configured: true,
    },
  },
}

/**
 * 按路径分流 mock:面板展开时会先取 scheduler/status,再按用户点击取 tasks / task-run。
 * 不能用「第 0 次调用」断言 —— 那会把巡检态请求误当成业务请求(反过来也一样)。
 */
function routeMock(
  opts: {
    sweep?: { success: boolean; data?: unknown; error?: string }
    run?: { success: boolean; data?: unknown; error?: string }
    list?: { success: boolean; data?: unknown; error?: string }
  } = {},
) {
  fetchAiServiceJson.mockImplementation(async (path: string) => {
    const p = String(path)
    if (p === '/api/checkin/scheduler/status') return opts.sweep ?? SWEEP_OFF
    if (p.endsWith('/task-run')) {
      return (
        opts.run ?? {
          success: true,
          data: {
            ok: true,
            kind: 'all',
            accepted: [],
            claimed: [],
            credit_delta: null,
            energy_delta: null,
            reason: null,
            unjudged: false,
          },
        }
      )
    }
    if (p.endsWith('/tasks')) {
      return (
        opts.list ?? {
          success: true,
          data: { ok: true, kind: 'list', tasks: [], reason: null, unjudged: false },
        }
      )
    }
    throw new Error(`unexpected path: ${p}`)
  })
}

/** 取命中某后缀的全部调用(排除巡检态请求)。 */
function callsTo(suffix: string) {
  return fetchAiServiceJson.mock.calls.filter((c) => String(c[0]).endsWith(suffix))
}

describe('WorkbuddyTaskPanel', () => {
  it('无 WorkBuddy 账号时自判空且零请求', () => {
    render(<WorkbuddyTaskPanel accounts={[ACCOUNTS[1]!]} />)
    expect(screen.getByText('taskPanelNoAccount')).toBeTruthy()
    expect(fetchAiServiceJson).not.toHaveBeenCalled()
  })

  it('一键做任务发 kind=all + dry_run=false', async () => {
    routeMock({
      run: {
        success: true,
        data: {
          ok: true,
          kind: 'all',
          accepted: ['first_chat'],
          claimed: [],
          credit_delta: 0,
          reason: null,
          unjudged: false,
        },
      },
    })
    render(<WorkbuddyTaskPanel accounts={ACCOUNTS} />)

    fireEvent.click(screen.getByText('taskPanelTitle'))
    fireEvent.click(screen.getByText('taskPanelRun'))

    await waitFor(() => expect(callsTo('/task-run')).toHaveLength(1))
    const [path, init] = callsTo('/task-run')[0] as [string, RequestInit]
    expect(path).toBe('/api/checkin/accounts/7/task-run')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ kind: 'all', dry_run: false })
    await waitFor(() => expect(screen.getByText('taskPanelResult')).toBeTruthy())
  })

  it('预演发 dry_run=true,且不触发列表刷新', async () => {
    routeMock({
      run: {
        success: true,
        data: {
          ok: true,
          kind: 'all',
          accepted: [],
          claimed: [],
          credit_delta: null,
          reason: 'dry-run',
          unjudged: false,
        },
      },
    })
    render(<WorkbuddyTaskPanel accounts={ACCOUNTS} />)

    fireEvent.click(screen.getByText('taskPanelTitle'))
    fireEvent.click(screen.getByText('taskPanelDryRun'))

    await waitFor(() => expect(callsTo('/task-run')).toHaveLength(1))
    const [path, init] = callsTo('/task-run')[0] as [string, RequestInit]
    expect(path).toBe('/api/checkin/accounts/7/task-run')
    expect(JSON.parse(String(init.body))).toEqual({ kind: 'all', dry_run: true })
    // 预演不刷新列表:mutation 后刷新的理由是「服务端真实态变了」,dry-run 没有变。
    expect(callsTo('/tasks')).toHaveLength(0)
  })

  it('读取任务渲染真机行字段(任务码/状态),不伪造进度', async () => {
    routeMock({
      list: {
        success: true,
        data: {
          ok: true,
          kind: 'list',
          tasks: [
            {
              task_code: 'first_chat',
              title: '首次对话',
              status: 'available',
              progress: null,
              target: null,
              reward_credit: null,
            },
          ],
          reason: null,
          unjudged: false,
        },
      },
    })
    render(<WorkbuddyTaskPanel accounts={ACCOUNTS} />)

    fireEvent.click(screen.getByText('taskPanelTitle'))
    fireEvent.click(screen.getByText('taskPanelList'))

    await waitFor(() => expect(screen.getByText('首次对话')).toBeTruthy())
    expect(screen.getByText('first_chat')).toBeTruthy()
    expect(screen.getByText('available')).toBeTruthy()
    expect(screen.queryByText('0/0')).toBeNull() // 上游不给 progress 就不显示
  })

  // ===== 自动巡检态(2026-10-31):此前这条 job 对前端完全不可见 =====

  it('两门都开且 live_run ⇒ tone=on 并显示节拍与下次时间', async () => {
    routeMock({
      sweep: {
        success: true,
        data: {
          enabled: true,
          started: true,
          next_run: null,
          next_run_qoder: null,
          next_run_wb_tasks: '2026-10-31T21:30:00+08:00',
          wb_tasks: {
            enabled: true,
            tasks_enabled: true,
            cron_enabled: true,
            live_run: true,
            sweep_minutes: 30,
            claim_path_configured: true,
            activity_path_configured: true,
          },
        },
      },
    })
    render(<WorkbuddyTaskPanel accounts={ACCOUNTS} />)
    fireEvent.click(screen.getByText('taskPanelTitle'))

    const box = await screen.findByTestId('wb-task-sweep-status')
    expect(box.getAttribute('data-tone')).toBe('on')
    expect(box.textContent).toContain('taskPanelAutoOn')
    expect(box.textContent).toContain('taskPanelAutoNext')
    // 时间按 ISO 前 16 位呈现(不走 toLocaleString,避免 SSR/CSR 时区抖动)
    expect(box.textContent).toContain('2026-10-31 21:30')
  })

  it('按了任务门但总闸关 ⇒ tone=cron-blocked 且说的是 cronBlocked,不冒充已启用', async () => {
    routeMock({
      sweep: {
        success: true,
        data: {
          enabled: false,
          started: true,
          next_run: null,
          next_run_qoder: null,
          next_run_wb_tasks: null,
          wb_tasks: {
            enabled: false,
            tasks_enabled: true,
            cron_enabled: false,
            not_running_reason: 'cron_gate_off',
            live_run: true,
            sweep_minutes: 30,
            claim_path_configured: true,
            activity_path_configured: true,
          },
        },
      },
    })
    render(<WorkbuddyTaskPanel accounts={ACCOUNTS} />)
    fireEvent.click(screen.getByText('taskPanelTitle'))

    const box = await screen.findByTestId('wb-task-sweep-status')
    expect(box.getAttribute('data-tone')).toBe('cron-blocked')
    expect(box.textContent).toContain('taskPanelAutoCronBlocked')
  })

  it('向后兼容锁:旧服务端不给 not_running_reason,两门原值仍认出总闸拦', async () => {
    routeMock({
      sweep: {
        success: true,
        data: {
          enabled: false,
          started: true,
          next_run: null,
          next_run_qoder: null,
          next_run_wb_tasks: null,
          wb_tasks: {
            enabled: false,
            tasks_enabled: true,
            cron_enabled: false,
            live_run: true,
            sweep_minutes: 30,
            claim_path_configured: true,
            activity_path_configured: true,
          },
        },
      },
    })
    render(<WorkbuddyTaskPanel accounts={ACCOUNTS} />)
    fireEvent.click(screen.getByText('taskPanelTitle'))

    const box = await screen.findByTestId('wb-task-sweep-status')
    expect(box.getAttribute('data-tone')).toBe('cron-blocked')
    expect(box.textContent).toContain('taskPanelAutoCronBlocked')
  })

  it('两门意图都开但观测态为假(reason=scheduler_not_started)⇒ 新档 not-registered,不说"已启用"', async () => {
    routeMock({
      sweep: {
        success: true,
        data: {
          enabled: false,
          started: false,
          next_run: null,
          next_run_qoder: null,
          next_run_wb_tasks: null,
          wb_tasks: {
            enabled: false,
            tasks_enabled: true,
            cron_enabled: true,
            not_running_reason: 'scheduler_not_started',
            live_run: true,
            sweep_minutes: 30,
            claim_path_configured: true,
            activity_path_configured: true,
          },
        },
      },
    })
    render(<WorkbuddyTaskPanel accounts={ACCOUNTS} />)
    fireEvent.click(screen.getByText('taskPanelTitle'))

    const box = await screen.findByTestId('wb-task-sweep-status')
    expect(box.getAttribute('data-tone')).toBe('not-registered')
    // 出路文案(改完 .env 必须重启 ai-service);既不许冒充已启用,也不许冒充"未启用"
    expect(box.textContent).toContain('taskPanelAutoNotStarted')
    expect(box.textContent).not.toContain('taskPanelAutoOn')
    expect(box.textContent).not.toContain('taskPanelAutoOff')
  })

  it('job_not_registered ⇒ 同一档 not-registered(出路同为重启)', async () => {
    routeMock({
      sweep: {
        success: true,
        data: {
          enabled: false,
          started: true,
          next_run: null,
          next_run_qoder: null,
          next_run_wb_tasks: null,
          wb_tasks: {
            enabled: false,
            tasks_enabled: true,
            cron_enabled: true,
            not_running_reason: 'job_not_registered',
            live_run: true,
            sweep_minutes: 30,
            claim_path_configured: true,
            activity_path_configured: true,
          },
        },
      },
    })
    render(<WorkbuddyTaskPanel accounts={ACCOUNTS} />)
    fireEvent.click(screen.getByText('taskPanelTitle'))

    const box = await screen.findByTestId('wb-task-sweep-status')
    expect(box.getAttribute('data-tone')).toBe('not-registered')
  })

  it('已启用但 live_run=false ⇒ tone=dry 且明说是演练模式(不再与 cron-blocked 共用一个档)', async () => {
    routeMock({
      sweep: {
        success: true,
        data: {
          enabled: true,
          started: true,
          next_run: null,
          next_run_qoder: null,
          next_run_wb_tasks: null,
          wb_tasks: {
            enabled: true,
            tasks_enabled: true,
            cron_enabled: true,
            live_run: false,
            sweep_minutes: 60,
            claim_path_configured: true,
            activity_path_configured: true,
          },
        },
      },
    })
    render(<WorkbuddyTaskPanel accounts={ACCOUNTS} />)
    fireEvent.click(screen.getByText('taskPanelTitle'))

    const box = await screen.findByTestId('wb-task-sweep-status')
    expect(box.getAttribute('data-tone')).toBe('dry')
    expect(box.textContent).toContain('taskPanelAutoDry')
  })

  it('任务门没开(reason=tasks_gate_off)⇒ tone=tasks-off 并写明怎么开', async () => {
    routeMock()
    render(<WorkbuddyTaskPanel accounts={ACCOUNTS} />)
    fireEvent.click(screen.getByText('taskPanelTitle'))

    const box = await screen.findByTestId('wb-task-sweep-status')
    expect(box.getAttribute('data-tone')).toBe('tasks-off')
    expect(box.textContent).toContain('taskPanelAutoOff')
  })

  it('展开后请求未回 ⇒ tone=loading(独立于 unknown,不冒充"服务端没给")', async () => {
    // 让 scheduler/status 永不返回:面板必须停在 loading 档,而不是先亮一个 unknown
    routeMock({ sweep: { success: true, data: SWEEP_OFF } })
    fetchAiServiceJson.mockImplementation(async (path: string) => {
      if (path === '/api/checkin/scheduler/status') return new Promise(() => {})
      return { success: true, data: {} }
    })
    render(<WorkbuddyTaskPanel accounts={ACCOUNTS} />)
    fireEvent.click(screen.getByText('taskPanelTitle'))

    const box = await screen.findByTestId('wb-task-sweep-status')
    expect(box.getAttribute('data-tone')).toBe('loading')
    expect(box.textContent).toContain('taskPanelAutoLoading')
  })

  it('enabled=true 即已启用:两门意图即便都为假也不影响(观测态优先,不读意图做结论)', async () => {
    routeMock({
      sweep: {
        success: true,
        data: {
          enabled: true,
          started: true,
          next_run: null,
          next_run_qoder: null,
          next_run_wb_tasks: '2026-10-31T21:30:00+08:00',
          wb_tasks: {
            enabled: true,
            tasks_enabled: false,
            cron_enabled: false,
            not_running_reason: null,
            live_run: true,
            sweep_minutes: 30,
            claim_path_configured: true,
            activity_path_configured: true,
          },
        },
      },
    })
    render(<WorkbuddyTaskPanel accounts={ACCOUNTS} />)
    fireEvent.click(screen.getByText('taskPanelTitle'))

    const box = await screen.findByTestId('wb-task-sweep-status')
    expect(box.getAttribute('data-tone')).toBe('on')
    expect(box.textContent).toContain('taskPanelAutoOn')
  })

  it('状态取不到 ⇒ tone=unknown(绝不写成未启用),详情用统一连接符「 · 」追加', async () => {
    routeMock({ sweep: { success: false, error: 'backend offline' } })
    render(<WorkbuddyTaskPanel accounts={ACCOUNTS} />)
    fireEvent.click(screen.getByText('taskPanelTitle'))

    const box = await screen.findByTestId('wb-task-sweep-status')
    expect(box.getAttribute('data-tone')).toBe('unknown')
    expect(box.textContent).toContain('taskPanelAutoUnknown')
    // 曾经的漂移点:web 用 ': '、另两端用 ' · ' ⇒ 现在三端同源于共享判据
    expect(box.textContent).toContain('taskPanelAutoUnknown · backend offline')
  })

  it('服务端版本较旧不返回 wb_tasks ⇒ 也按状态未知,不当作未启用', async () => {
    routeMock({
      sweep: {
        success: true,
        data: {
          enabled: true,
          started: true,
          next_run: null,
          next_run_qoder: null,
        },
      },
    })
    render(<WorkbuddyTaskPanel accounts={ACCOUNTS} />)
    fireEvent.click(screen.getByText('taskPanelTitle'))

    const box = await screen.findByTestId('wb-task-sweep-status')
    expect(box.getAttribute('data-tone')).toBe('unknown')
  })

  it('上报/领奖路径未配置时明说「只上报不领奖」', async () => {
    routeMock({
      sweep: {
        success: true,
        data: {
          enabled: true,
          started: true,
          next_run: null,
          next_run_qoder: null,
          next_run_wb_tasks: null,
          wb_tasks: {
            enabled: true,
            tasks_enabled: true,
            cron_enabled: true,
            live_run: true,
            sweep_minutes: 30,
            claim_path_configured: false,
            activity_path_configured: true,
          },
        },
      },
    })
    render(<WorkbuddyTaskPanel accounts={ACCOUNTS} />)
    fireEvent.click(screen.getByText('taskPanelTitle'))

    const box = await screen.findByTestId('wb-task-sweep-status')
    expect(box.textContent).toContain('taskPanelAutoPaths')
  })

  it('有上一轮摘要 ⇒ 显示时间/族数/新增/领奖', async () => {
    routeMock({
      sweep: {
        success: true,
        data: {
          enabled: true,
          started: true,
          next_run: null,
          next_run_qoder: null,
          next_run_wb_tasks: null,
          wb_tasks: {
            enabled: true,
            tasks_enabled: true,
            cron_enabled: true,
            live_run: true,
            sweep_minutes: 30,
            claim_path_configured: true,
            activity_path_configured: true,
            last_sweep: {
              at: '2026-10-31T20:00:00+08:00',
              finished_at: '2026-10-31T20:03:00+08:00',
              dry_run: false,
              accounts: 1,
              families: 6,
              accepted: 5,
              claimed: 2,
              unjudged: 0,
              errors: 0,
              skipped_cooldown: 0,
              note: null,
            },
          },
        },
      },
    })
    render(<WorkbuddyTaskPanel accounts={ACCOUNTS} />)
    fireEvent.click(screen.getByText('taskPanelTitle'))

    const box = await screen.findByTestId('wb-task-sweep-status')
    expect(box.textContent).toContain('taskPanelAutoLast')
    expect(box.textContent).toContain('2026-10-31 20:00')
    // 插值参数真的传进翻译函数(族数/新增/领奖),顺序 = 调用时给的顺序
    expect(box.textContent).toContain('taskPanelAutoLastStats(6,5,2)')
  })

  it('上一轮没跑完 ⇒ note 原因原样呈现,不粉饰成成功', async () => {
    routeMock({
      sweep: {
        success: true,
        data: {
          enabled: false,
          started: true,
          next_run: null,
          next_run_qoder: null,
          next_run_wb_tasks: null,
          wb_tasks: {
            enabled: false,
            tasks_enabled: true,
            cron_enabled: false,
            live_run: true,
            sweep_minutes: 30,
            claim_path_configured: true,
            activity_path_configured: true,
            last_sweep: {
              at: '2026-10-31T20:00:00+08:00',
              finished_at: '2026-10-31T20:00:01+08:00',
              dry_run: false,
              accounts: 0,
              families: 0,
              accepted: 0,
              claimed: 0,
              unjudged: 0,
              errors: 0,
              skipped_cooldown: 0,
              note: '出站限流暂停',
            },
          },
        },
      },
    })
    render(<WorkbuddyTaskPanel accounts={ACCOUNTS} />)
    fireEvent.click(screen.getByText('taskPanelTitle'))

    const box = await screen.findByTestId('wb-task-sweep-status')
    expect(box.textContent).toContain('出站限流暂停')
  })

  it('本进程还没跑过 ⇒ 说尚未巡检,不显示假战果', async () => {
    routeMock({
      sweep: {
        success: true,
        data: {
          enabled: true,
          started: true,
          next_run: null,
          next_run_qoder: null,
          next_run_wb_tasks: null,
          wb_tasks: {
            enabled: true,
            tasks_enabled: true,
            cron_enabled: true,
            live_run: true,
            sweep_minutes: 30,
            claim_path_configured: true,
            activity_path_configured: true,
            last_sweep: null,
          },
        },
      },
    })
    render(<WorkbuddyTaskPanel accounts={ACCOUNTS} />)
    fireEvent.click(screen.getByText('taskPanelTitle'))

    const box = await screen.findByTestId('wb-task-sweep-status')
    expect(box.textContent).toContain('taskPanelAutoLastNever')
  })
})

/**
 * 判据同源锁(2026-10-31):同一套判定曾在 web/RN/小程序各写一份并实测漂移(tone 档位、
 * 未知态连接符、ISO 截断重复)。三端源文件里再长出字面判定 = 本条必红,而不是等下一次漂移。
 */
describe('巡检态判据只有一份实现', () => {
  const HERE = dirname(fileURLToPath(import.meta.url))
  const SHARED_REL = join('packages', 'shared', 'src', 'utils', 'workbuddy-sweep-view.ts')
  /** 从用例文件逐级上溯到仓根(不硬编码 ../ 层数:挪目录只会红在这里,不会静默扫错文件)。 */
  const ROOT = (() => {
    let dir = HERE
    while (dir !== dirname(dir) && !existsSync(join(dir, SHARED_REL))) dir = dirname(dir)
    if (dir === dirname(dir)) throw new Error(`找不到仓根(${SHARED_REL} 不可达)`)
    return dir
  })()

  const ENDS: Array<[string, string]> = [
    ['web', join(HERE, '..', 'WorkbuddyTaskPanel.tsx')],
    ['mobile-rn', join(ROOT, 'apps/mobile-rn/src/components/WorkbuddyTaskSection.tsx')],
    [
      'miniapp-taro',
      join(ROOT, 'apps/miniapp-taro/src/pkg-user/checkin-assistant/WorkbuddyTaskSection.tsx'),
    ],
  ]

  it('三端都从共享判据取结论,且都不再自带字面判定', () => {
    for (const [name, file] of ENDS) {
      const src = readFileSync(file, 'utf8')
      expect(src, `${name} 必须 import 共享判据`).toMatch(
        /from '@ihui\/shared\/utils\/workbuddy-sweep-view'/,
      )
      // 曾经的三份判据的三种字面形:两门与 / !wt.enabled 分支 / 手搓 ISO 截断
      expect(src, `${name} 不得再抄两门字面判据`).not.toMatch(
        /wt\.tasks_enabled\s*&&\s*!?wt\.cron_enabled/,
      )
      expect(src, `${name} 不得再抄 enabled 分支判定`).not.toMatch(/if \(!?wt\.enabled\)/)
      expect(src, `${name} 不得再手搓 ISO 截断`).not.toMatch(/\.slice\(0,\s*16\)\.replace\('T'/)
      expect(src, `${name} 不得把未知态详情各端自拼连接符`).not.toMatch(
        /taskAutoUnknown\)'?\s*[:·]/,
      )
    }
  })

  it('共享判据里那段判定确实存在(摘掉它 ⇒ 三端同时失去结论)', () => {
    const shared = readFileSync(join(ROOT, SHARED_REL), 'utf8')
    expect(shared).toMatch(/export function deriveWbSweepView/)
    expect(shared).toMatch(/case 'scheduler_not_started'/)
    expect(shared).toMatch(/case 'job_not_registered'/)
    expect(shared).toMatch(/if \(wt\.enabled\)/)
    // 旧服务端兼容推断也只在共享判据里有一处
    expect(shared).toMatch(/wt\.tasks_enabled === true && wt\.cron_enabled === false/)
  })

  it('本端两张映射表七档穷举(少一档 = 那一档没文案或没配色)', () => {
    const src = readFileSync(join(HERE, '..', 'WorkbuddyTaskPanel.tsx'), 'utf8')
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
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
