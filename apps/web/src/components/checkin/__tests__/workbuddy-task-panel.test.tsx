// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import * as React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { WorkbuddyTaskPanel } from '../WorkbuddyTaskPanel'

/**
 * 「自动做任务」面板契约测试。
 *
 * 钉死三件事(都是踩过的真实风险):
 * 1. 无 WorkBuddy 账号 ⇒ 自判空,不发任何请求(不外泄空态、不打空 id);
 * 2. 「一键做任务」发的是 `kind='all'` + `dry_run=false`,预演发 `dry_run=true`
 *    —— 顺序由后端 SWEEP_ORDER 单一真源决定,面板不得自行拼六次请求;
 * 3. 结果原样呈现 accepted/claimed/unjudged,不把 unjudged 冒充成功。
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
      values && Object.keys(values).length > 0
        ? `${key}(${Object.values(values).join(',')})`
        : key,
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

/** 巡检态基线:未启用(默认安全态)。用例按需覆盖单个字段。 */
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

  it('按了任务门但总闸关 ⇒ tone=warn 且说的是 cronBlocked,不冒充已启用', async () => {
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
    expect(box.getAttribute('data-tone')).toBe('warn')
    expect(box.textContent).toContain('taskPanelAutoCronBlocked')
  })

  it('已启用但 live_run=false ⇒ tone=warn 且明说是演练模式', async () => {
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
    expect(box.getAttribute('data-tone')).toBe('warn')
    expect(box.textContent).toContain('taskPanelAutoDry')
  })

  it('任务门没开 ⇒ tone=off 并写明怎么开', async () => {
    routeMock()
    render(<WorkbuddyTaskPanel accounts={ACCOUNTS} />)
    fireEvent.click(screen.getByText('taskPanelTitle'))

    const box = await screen.findByTestId('wb-task-sweep-status')
    expect(box.getAttribute('data-tone')).toBe('off')
    expect(box.textContent).toContain('taskPanelAutoOff')
  })

  it('状态取不到 ⇒ tone=unknown(绝不写成未启用)', async () => {
    routeMock({ sweep: { success: false, error: 'backend offline' } })
    render(<WorkbuddyTaskPanel accounts={ACCOUNTS} />)
    fireEvent.click(screen.getByText('taskPanelTitle'))

    const box = await screen.findByTestId('wb-task-sweep-status')
    expect(box.getAttribute('data-tone')).toBe('unknown')
    expect(box.textContent).toContain('taskPanelAutoUnknown')
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
