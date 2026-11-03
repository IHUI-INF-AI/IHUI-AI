// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// WorkBuddy 巡检态判据(唯一真相源)用例。
// 钉住的是判序本身:四档原因 + 两态未判定 + 旧服务端兼容推断,一格都不许含糊。

import { describe, expect, it } from 'vitest'
import {
  WB_SWEEP_DETAIL_SEPARATOR,
  WB_SWEEP_NOT_RUNNING_REASONS,
  WB_SWEEP_TONES,
  composeWbSweepText,
  deriveWbSweepView,
  formatWbIsoMinute,
  joinWbSweepParts,
  type WbSweepMessageKey,
  type WbSweepStatusSnapshot,
  type WbSweepTasksSnapshot,
} from '../workbuddy-sweep-view.js'

/** 巡检态基线:两门都开、真跑、路径齐 —— 用例按需覆盖单个字段。 */
const TASKS: WbSweepTasksSnapshot = {
  enabled: true,
  tasks_enabled: true,
  cron_enabled: true,
  live_run: true,
  sweep_minutes: 30,
  claim_path_configured: true,
  activity_path_configured: true,
}

function statusOf(
  wbTasks?: Partial<WbSweepTasksSnapshot> | null,
  next = '2026-10-31T21:30:00+08:00',
) {
  const status: WbSweepStatusSnapshot = { next_run_wb_tasks: next }
  if (wbTasks !== null) status.wb_tasks = { ...TASKS, ...wbTasks }
  return status
}

/** 翻译桩:把参数拼进返回值,顺带钉住"节拍真的传进去了"。 */
const t = (key: string, params?: Record<string, string | number>): string =>
  params && Object.keys(params).length > 0 ? `${key}(${Object.values(params).join(',')})` : key

const KEYS: Record<WbSweepMessageKey, string> = {
  loading: 'kLoading',
  on: 'kOn',
  dry: 'kDry',
  'cron-blocked': 'kCron',
  'tasks-off': 'kTasksOff',
  'not-registered': 'kNotStarted',
  unknown: 'kUnknown',
}

describe('判序①:取到之前 = loading(不是"未启用"、也不是"状态未知")', () => {
  it('sweep === undefined ⇒ loading,零附加字段', () => {
    expect(deriveWbSweepView(undefined, null)).toEqual({
      tone: 'loading',
      messageKey: 'loading',
      minutes: null,
      next: null,
      pathsMissing: false,
      detail: null,
    })
  })
})

describe('判序②:服务端没给这份视图 ⇒ unknown,绝不降级成"未启用"', () => {
  it('没有 wb_tasks ⇒ unknown,并把原始错误用统一连接符挂在 detail 上', () => {
    const view = deriveWbSweepView({ next_run_wb_tasks: null }, 'HTTP 502')
    expect(view.tone).toBe('unknown')
    expect(view.detail).toBe('HTTP 502')
    expect(composeWbSweepText(view, KEYS, t)).toBe(`kUnknown${WB_SWEEP_DETAIL_SEPARATOR}HTTP 502`)
  })

  it('整份响应为 null(旧行为)同样落 unknown', () => {
    expect(deriveWbSweepView(null, null).tone).toBe('unknown')
  })

  it('无错误详情时不追加连接符(不写出" · "开头的半句话)', () => {
    expect(composeWbSweepText(deriveWbSweepView(null, null), KEYS, t)).toBe('kUnknown')
  })
})

describe('判序③:enabled 是观测态,两门意图再奇怪也不参与判定', () => {
  it('enabled=true 且 live_run ⇒ on(即使两门意图全为假:以进程实测为准)', () => {
    const view = deriveWbSweepView(statusOf({ tasks_enabled: false, cron_enabled: false }), null)
    expect(view.tone).toBe('on')
    expect(view.minutes).toBe(30)
    expect(view.next).toBe('2026-10-31 21:30')
    expect(composeWbSweepText(view, KEYS, t)).toBe('kOn(30)')
  })

  it('enabled=true 且 live_run=false ⇒ dry,并保留下次时间', () => {
    const view = deriveWbSweepView(statusOf({ live_run: false }), null)
    expect(view.tone).toBe('dry')
    expect(view.next).toBe('2026-10-31 21:30')
    // dry 档文案不吃节拍参数(免得各端长成 key(30) 这种无意义形态)
    expect(composeWbSweepText(view, KEYS, t)).toBe('kDry')
  })

  it('enabled=true 时 not_running_reason 被忽略(契约:该档恒 null)', () => {
    expect(deriveWbSweepView(statusOf({ not_running_reason: 'cron_gate_off' }), null).tone).toBe(
      'on',
    )
  })

  it('路径缺一 ⇒ pathsMissing=true 逐档透传(含未运行档)', () => {
    expect(
      deriveWbSweepView(statusOf({ activity_path_configured: false }), null).pathsMissing,
    ).toBe(true)
    expect(
      deriveWbSweepView(
        statusOf({
          enabled: false,
          not_running_reason: 'tasks_gate_off',
          claim_path_configured: false,
        }),
        null,
      ).pathsMissing,
    ).toBe(true)
  })
})

describe('判序④:enabled=false 按 not_running_reason 分四档', () => {
  it('tasks_gate_off ⇒ tasks-off', () => {
    expect(
      deriveWbSweepView(statusOf({ enabled: false, not_running_reason: 'tasks_gate_off' }), null)
        .tone,
    ).toBe('tasks-off')
  })

  it('cron_gate_off ⇒ cron-blocked', () => {
    expect(
      deriveWbSweepView(
        statusOf({ enabled: false, not_running_reason: 'cron_gate_off', cron_enabled: false }),
        null,
      ).tone,
    ).toBe('cron-blocked')
  })

  it('scheduler_not_started ⇒ not-registered(配置已开却没跑起来)', () => {
    const view = deriveWbSweepView(
      statusOf({ enabled: false, not_running_reason: 'scheduler_not_started' }),
      null,
    )
    expect(view.tone).toBe('not-registered')
    expect(view.next).toBeNull() // 没在跑就不报"下次时间"
    expect(composeWbSweepText(view, KEYS, t)).toBe('kNotStarted')
  })

  it('job_not_registered ⇒ not-registered(与上一条同出路:重启 ai-service)', () => {
    expect(
      deriveWbSweepView(
        statusOf({ enabled: false, not_running_reason: 'job_not_registered' }),
        null,
      ).tone,
    ).toBe('not-registered')
  })

  it('WB_SWEEP_NOT_RUNNING_REASONS 与判据 switch 同集(新增原因忘了接线即红)', () => {
    for (const reason of WB_SWEEP_NOT_RUNNING_REASONS) {
      const view = deriveWbSweepView(statusOf({ enabled: false, not_running_reason: reason }), null)
      // 四个已知原因都不许落 unknown —— 落 unknown 的唯一合法来源是"没给/不认识"
      expect(view.tone).not.toBe('unknown')
    }
  })
})

describe('向后兼容:旧服务端不给 not_running_reason', () => {
  it('字段缺失 + tasks_enabled ∧ ¬cron_enabled ⇒ cron-blocked(唯一保留的旧推断)', () => {
    const view = deriveWbSweepView(
      statusOf({ enabled: false, tasks_enabled: true, cron_enabled: false }),
      null,
    )
    expect(view.tone).toBe('cron-blocked')
    expect(view.messageKey).toBe('cron-blocked')
  })

  it('字段缺失 + 任务门本身没开 ⇒ unknown(不替服务端编原因)', () => {
    expect(
      deriveWbSweepView(
        statusOf({ enabled: false, tasks_enabled: false, cron_enabled: true }),
        null,
      ).tone,
    ).toBe('unknown')
  })

  it('字段缺失 + 两门都开(enabled 却为假,自相矛盾)⇒ unknown', () => {
    expect(
      deriveWbSweepView(statusOf({ enabled: false, tasks_enabled: true, cron_enabled: true }), null)
        .tone,
    ).toBe('unknown')
  })

  it('reason 为不认识的新值 ⇒ unknown,而不是静默落某一档', () => {
    expect(
      deriveWbSweepView(
        statusOf({ enabled: false, not_running_reason: 'brand_new_reason' as never }),
        null,
      ).tone,
    ).toBe('unknown')
  })
})

describe('时间与拼接的唯一实现', () => {
  it('formatWbIsoMinute:截到分钟并把 T 换成空格;非字符串/空串 ⇒ null', () => {
    expect(formatWbIsoMinute('2026-10-31T21:30:00+08:00')).toBe('2026-10-31 21:30')
    expect(formatWbIsoMinute(null)).toBeNull()
    expect(formatWbIsoMinute(undefined)).toBeNull()
    expect(formatWbIsoMinute('')).toBeNull()
  })

  it('joinWbSweepParts:空段/undefined 段一律不进结果(三端上一轮回执用同一连接符)', () => {
    expect(joinWbSweepParts(['a', null, undefined, '', 'b'])).toBe('a · b')
    expect(joinWbSweepParts([])).toBe('')
  })

  it('next 取的是顶层 next_run_wb_tasks(不是 last_sweep.at)', () => {
    expect(deriveWbSweepView(statusOf({}, '2026-11-01T08:05:00Z'), null).next).toBe(
      '2026-11-01 08:05',
    )
  })
})

describe('档位封闭集(端内映射表必须逐档覆盖,少一档就是某档没颜色)', () => {
  it('恰好七档:五结论 + loading/unknown 两态', () => {
    expect([...WB_SWEEP_TONES].sort()).toEqual(
      ['cron-blocked', 'dry', 'loading', 'not-registered', 'on', 'tasks-off', 'unknown'].sort(),
    )
  })

  it('composeWbSweepText 对七档都能取到键(映射表漏档 ⇒ 产出 undefined,当场点名)', () => {
    for (const tone of WB_SWEEP_TONES) {
      const view = deriveWbSweepView(
        tone === 'loading'
          ? undefined
          : {
              next_run_wb_tasks: null,
              wb_tasks:
                tone === 'unknown'
                  ? undefined
                  : { ...TASKS, ...(toneViewPatch(tone) as Partial<WbSweepTasksSnapshot>) },
            },
        null,
      )
      expect(view.tone).toBe(tone)
      expect(composeWbSweepText(view, KEYS, t)).not.toContain('undefined')
    }
  })
})

/** 把档位反推成能产出它的输入(测试自证七档都可达,不是只测函数存在)。 */
function toneViewPatch(tone: (typeof WB_SWEEP_TONES)[number]): Record<string, unknown> {
  switch (tone) {
    case 'on':
      return { enabled: true, live_run: true }
    case 'dry':
      return { enabled: true, live_run: false }
    case 'cron-blocked':
      return { enabled: false, not_running_reason: 'cron_gate_off' }
    case 'tasks-off':
      return { enabled: false, not_running_reason: 'tasks_gate_off' }
    case 'not-registered':
      return { enabled: false, not_running_reason: 'job_not_registered' }
    default:
      return {}
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
