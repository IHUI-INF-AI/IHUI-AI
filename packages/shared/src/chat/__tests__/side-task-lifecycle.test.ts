// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D75 侧边任务生命周期判定层单元测试(G-102,2026-09-24 立):
 * - 四态逐态派发 + 穷尽性(switch 无 default);
 * - **显式声明**「临时任务关闭后消失」四态恒在(创建时就告知,不等清理后);
 * - 过期判定 + 批量清理(返回「来自已清理的 {标题}」的键与插值);
 * - 并行运行位置两种 + 文件变更计数(0 走明确空态,不显示「0」);
 * - 关闭前确认弹层判据(有产物/子进程必须确认,纯已完成不打扰);
 * - 纯函数证明:冻结输入后调用不抛(⇒ 本判定层不可能篡改 /side 队列数据,
 *   W27 预备消息优先规则(`message-input.tsx` 流结束 effect)不受影响)。
 */
import { describe, expect, it } from 'vitest'

import {
  DEFAULT_SIDE_TASK_TTL_MS,
  SIDE_TASK_ACTIONS,
  SIDE_TASK_EPHEMERAL_NOTICE_KEY,
  SIDE_TASK_LIFECYCLE_STATES,
  SIDE_TASK_RUN_LOCATIONS,
  SIDE_TASK_TONES,
  collectExpiredSideTasks,
  formatChangedFilesCount,
  isSideTaskExpired,
  isSideTaskRunLocation,
  isSideTaskState,
  needsCloseConfirm,
  runningLocationKey,
  sideTaskAriaKey,
  sideTaskStateKey,
  sideTaskView,
  type SideTask,
  type SideTaskState,
} from '../side-task-lifecycle'

const T0 = 1_800_000_000_000

const task = (
  state: SideTaskState,
  extra: Partial<Omit<SideTask, 'state'>> = {},
): SideTask => ({
  id: `task-${state}`,
  title: `标题-${state}`,
  state,
  createdAt: T0,
  location: 'sameFolder',
  ...extra,
})

const viewOf = (state: SideTaskState, extra: Partial<Omit<SideTask, 'state'>> = {}) => {
  const view = sideTaskView(task(state, extra))
  if (!view) throw new Error(`no view for ${state}`)
  return view
}

describe('D75 side-task-lifecycle / 四态与穷尽性', () => {
  it('四态恰为台账所列 4 项(顺序即生命周期顺序)', () => {
    expect(SIDE_TASK_LIFECYCLE_STATES).toEqual(['running', 'completed', 'expired', 'cleaned'])
    expect(SIDE_TASK_LIFECYCLE_STATES.length).toBe(4)
  })

  it('isSideTaskState 认四态、拒未知值(不编造状态)', () => {
    for (const state of SIDE_TASK_LIFECYCLE_STATES) expect(isSideTaskState(state)).toBe(true)
    expect(isSideTaskState('pending')).toBe(false)
    expect(isSideTaskState('')).toBe(false)
  })

  it('四态**逐态**都有视图(switch 无 default 的穷尽性落到每一态)', () => {
    for (const state of SIDE_TASK_LIFECYCLE_STATES) {
      const view = sideTaskView(task(state))
      expect(view, state).not.toBeNull()
      expect(view?.state, state).toBe(state)
    }
  })

  it('tone 取值恒在四档语义色内', () => {
    const tones = SIDE_TASK_LIFECYCLE_STATES.map((state) => viewOf(state).tone)
    for (const tone of tones) expect([...SIDE_TASK_TONES]).toContain(tone)
    expect(new Set(tones).size).toBeGreaterThan(1)
  })

  it('无 task(undefined / null)→ null,不崩', () => {
    expect(sideTaskView(undefined)).toBeNull()
    expect(sideTaskView(null)).toBeNull()
  })

  it('titleKey / ariaKey 逐态落在自己的命名slot', () => {
    for (const state of SIDE_TASK_LIFECYCLE_STATES) {
      expect(viewOf(state).titleKey).toBe(sideTaskStateKey(state))
      expect(viewOf(state).titleKey).toBe(`state.${state}`)
      expect(viewOf(state).ariaKey).toBe(sideTaskAriaKey(state))
    }
  })

  it('hintKey:expired / cleaned 非空,running / completed 不画蛇添足', () => {
    expect(viewOf('running').hintKey).toBeNull()
    expect(viewOf('completed').hintKey).toBeNull()
    expect(viewOf('expired').hintKey).toBe('hint.expired')
    expect(viewOf('cleaned').hintKey).toBe('hint.cleaned')
  })

  it('terminal:四态里**只有 cleaned** 是终态(completed 仍可能被清理)', () => {
    expect(viewOf('cleaned').terminal).toBe(true)
    for (const state of ['running', 'completed', 'expired'] as const) {
      expect(viewOf(state).terminal, state).toBe(false)
    }
  })
})

describe('D75 显式声明 / 临时任务关闭后消失', () => {
  it('四态**恒**给出同一条显式声明(不得只在"已清理"后才显示)', () => {
    for (const state of SIDE_TASK_LIFECYCLE_STATES) {
      const view = viewOf(state)
      expect(view.ephemeralNoticeKey, state).toBe('ephemeralNotice')
      expect(view.ephemeralNoticeKey.length, state).toBeGreaterThan(0)
    }
  })

  it('创建时(running)就有声明 —— 与 cleaned 同源同键,不依赖清理发生过', () => {
    expect(viewOf('running').ephemeralNoticeKey).toBe(SIDE_TASK_EPHEMERAL_NOTICE_KEY)
    expect(viewOf('cleaned').ephemeralNoticeKey).toBe(viewOf('running').ephemeralNoticeKey)
  })

  it('显式声明占独立文案位:不与状态标题 / 提示 / 位置键共用', () => {
    const keys = new Set<string>()
    for (const state of SIDE_TASK_LIFECYCLE_STATES) {
      const view = viewOf(state)
      keys.add(view.ephemeralNoticeKey)
      keys.add(view.titleKey)
      keys.add(view.locationKey)
      if (view.hintKey) keys.add(view.hintKey)
    }
    expect(keys.has('ephemeralNotice')).toBe(true)
    expect(keys.has('state.cleaned')).toBe(true)
    expect(keys.size).toBeGreaterThan(4)
  })
})

describe('D75 过期判定与批量清理', () => {
  it('默认保留窗口内不判过期(边界:inclusive 不成立,刚好到期不算过期)', () => {
    expect(isSideTaskExpired(task('completed'), T0 + DEFAULT_SIDE_TASK_TTL_MS)).toBe(false)
    expect(isSideTaskExpired(task('completed'), T0 + 1)).toBe(false)
  })

  it('超出默认窗口 ⇒ 过期(createdAt + TTL 之外 1ms 即算)', () => {
    expect(isSideTaskExpired(task('completed'), T0 + DEFAULT_SIDE_TASK_TTL_MS + 1)).toBe(true)
  })

  it('显式 expiresAt 优先于默认窗口早到期 / 晚到期都算', () => {
    // 早于默认窗口即过期
    expect(
      isSideTaskExpired(task('completed', { expiresAt: T0 + 60_000 }), T0 + 60_001),
    ).toBe(true)
    // 显式延后则默认窗口外仍不算过期
    expect(
      isSideTaskExpired(
        task('completed', { expiresAt: T0 + DEFAULT_SIDE_TASK_TTL_MS * 2 }),
        T0 + DEFAULT_SIDE_TASK_TTL_MS + 1,
      ),
    ).toBe(false)
  })

  it('expired 态恒判过期(不得出现"已标记过期却判定未过期"的两套真相)', () => {
    expect(isSideTaskExpired(task('expired'), T0)).toBe(true)
  })

  it('cleaned 态恒判过期;running 在窗口内不判过期', () => {
    expect(isSideTaskExpired(task('cleaned'), T0)).toBe(true)
    expect(isSideTaskExpired(task('running'), T0 + DEFAULT_SIDE_TASK_TTL_MS + 1)).toBe(false)
  })

  it('时钟不可信(now 非有限数)时不判过期,避免误清理', () => {
    expect(isSideTaskExpired(task('completed'), Number.NaN)).toBe(false)
    expect(isSideTaskExpired(task('completed'), Number.POSITIVE_INFINITY)).toBe(false)
  })

  it('批量清理:混合列表只收「过期且可收」的项(running / cleaned / 未过期不收)', () => {
    const tasks: SideTask[] = [
      task('running', { id: 'r1', title: '跑着的' }),
      task('completed', { id: 'c-fresh', title: '刚完成的' }),
      task('completed', { id: 'c-old', title: '过期的完成件', createdAt: T0 - DEFAULT_SIDE_TASK_TTL_MS * 2 }),
      task('expired', { id: 'e1', title: '已标过期' }),
      task('cleaned', { id: 'cl1', title: '已清理的' }),
    ]
    const entries = collectExpiredSideTasks(tasks, T0)
    expect(entries.map((e) => e.id)).toEqual(['c-old', 'e1'])
  })

  it('清理项带「来自已清理的 {标题}」的键与插值(原标题一个字不掉)', () => {
    const entries = collectExpiredSideTasks(
      [task('expired', { id: 'e1', title: '重构 parser' })],
      T0,
    )
    expect(entries).toHaveLength(1)
    expect(entries[0]?.labelKey).toBe('cleanedFrom')
    expect(entries[0]?.values).toEqual({ title: '重构 parser' })
    expect(entries[0]?.title).toBe('重构 parser')
  })

  it('批量清理由是幂等:同一输入反复调用结果一致,cleaned 不重复上报', () => {
    const tasks: SideTask[] = [
      task('cleaned', { id: 'cl1', title: '已清理的' }),
      task('expired', { id: 'e1', title: '已过期' }),
    ]
    const first = collectExpiredSideTasks(tasks, T0)
    const second = collectExpiredSideTasks(tasks, T0)
    expect(second).toEqual(first)
    expect(first.map((e) => e.id)).toEqual(['e1'])
  })

  it('清理**不改输入**:输入顺序 / 长度 / 内容全程不变', () => {
    const tasks: SideTask[] = [
      task('expired', { id: 'e1', title: 'A' }),
      task('running', { id: 'r1', title: 'B' }),
      task('cleaned', { id: 'c1', title: 'C' }),
    ]
    const snapshot = JSON.stringify(tasks)
    void collectExpiredSideTasks(tasks, T0)
    expect(tasks).toHaveLength(3)
    expect(JSON.stringify(tasks)).toBe(snapshot)
  })

  it('空输入 / 空数组 → 空数组,不崩', () => {
    expect(collectExpiredSideTasks([], T0)).toEqual([])
  })
})

describe('D75 「来自已清理的 {标题}」渲染位', () => {
  it('cleanedFrom 仅 cleaned 非空(带原标题与插值),其余态一律 null', () => {
    const cleaned = viewOf('cleaned', { title: '重构 parser' })
    expect(cleaned.cleanedFrom).toEqual({ key: 'cleanedFrom', title: '重构 parser', values: { title: '重构 parser' } })
    for (const state of ['running', 'completed', 'expired'] as const) {
      expect(viewOf(state, { title: 'X' }).cleanedFrom, state).toBeNull()
    }
  })

  it('cleaned 与 expired **不同形**(tone / 提示 / cleanedFrom 三处都不同)', () => {
    const expired = viewOf('expired')
    const cleaned = viewOf('cleaned')
    expect(expired.tone).not.toBe(cleaned.tone)
    expect(expired.hintKey).not.toBe(cleaned.hintKey)
    expect(expired.cleanedFrom).toBeNull()
    expect(cleaned.cleanedFrom).not.toBeNull()
  })
})

describe('D75 关闭前确认弹层判据', () => {
  it('纯已完成态(completed 且无产物无子进程)⇒ **不打扰**', () => {
    const done = task('completed', { unsavedArtifacts: 0, runningChildProcesses: 0 })
    expect(needsCloseConfirm(done)).toBe(false)
  })

  it('已完成但有未落盘产物 ⇒ 必须确认', () => {
    expect(needsCloseConfirm(task('completed', { unsavedArtifacts: 2 }))).toBe(true)
  })

  it('已完成但有在跑子进程 ⇒ 必须确认', () => {
    expect(needsCloseConfirm(task('completed', { runningChildProcesses: 1 }))).toBe(true)
  })

  it('运行中 ⇒ 必须确认(关闭运行中的临时任务不可逆)', () => {
    expect(needsCloseConfirm(task('running'))).toBe(true)
  })

  it('已清理 ⇒ 不打扰(已没东西可确认)', () => {
    expect(needsCloseConfirm(task('cleaned', { unsavedArtifacts: 3 }))).toBe(false)
  })

  it('负数 / 非数计数视为 0 ⇒ 不打扰(脏数据不得把用户拦住)', () => {
    expect(
      needsCloseConfirm(task('completed', { unsavedArtifacts: -1, runningChildProcesses: NaN })),
    ).toBe(false)
  })

  it('无 task(null / undefined)⇒ 不确认', () => {
    expect(needsCloseConfirm(null)).toBe(false)
    expect(needsCloseConfirm(undefined)).toBe(false)
  })

  it('view.needsCloseConfirm 与 needsCloseConfirm 四态逐态一致(单一真相源)', () => {
    for (const state of SIDE_TASK_LIFECYCLE_STATES) {
      for (const extra of [{}, { unsavedArtifacts: 1 }, { runningChildProcesses: 1 }]) {
        const t = task(state, extra)
        expect(viewOf(state, extra).needsCloseConfirm, `${state} ${JSON.stringify(extra)}`).toBe(
          needsCloseConfirm(t),
        )
      }
    }
  })
})

describe('D75 并行运行位置与文件变更计数', () => {
  it('两种位置各有一键(同文件夹 / 同环境)', () => {
    expect(SIDE_TASK_RUN_LOCATIONS).toEqual(['sameFolder', 'sameEnvironment'])
    expect(runningLocationKey('sameFolder')).toBe('location.sameFolder')
    expect(runningLocationKey('sameEnvironment')).toBe('location.sameEnvironment')
    expect(isSideTaskRunLocation('sameFolder')).toBe(true)
    expect(isSideTaskRunLocation('sameWorkspace')).toBe(false)
  })

  it('view.locationKey 与 location 字段同源(判定层与渲染件不得各记一套)', () => {
    for (const location of SIDE_TASK_RUN_LOCATIONS) {
      const view = viewOf('running', { location })
      expect(view.location).toBe(location)
      expect(view.locationKey).toBe(runningLocationKey(location))
    }
  })

  it('n = 0 ⇒ 明确空态文案:values 不插 count,不得显示「0」了事', () => {
    const zero = formatChangedFilesCount(0)
    expect(zero).toEqual({ count: 0, empty: true, key: 'files.empty', values: undefined })
  })

  it('缺省 / 负数 / NaN / 小数 ⇒ 一律归 0 走空态;正整数向下取整', () => {
    for (const dirty of [undefined, -3, Number.NaN, 0.4]) {
      const r = formatChangedFilesCount(dirty)
      expect(r.empty, String(dirty)).toBe(true)
      expect(r.count, String(dirty)).toBe(0)
    }
    expect(formatChangedFilesCount(2.9)).toEqual({
      count: 2,
      empty: false,
      key: 'files.changedCount',
      values: { count: '2' },
    })
  })

  it('n > 0 ⇒ 计数键 + 插值,空态标记翻 false', () => {
    const three = formatChangedFilesCount(3)
    expect(three).toEqual({
      count: 3,
      empty: false,
      key: 'files.changedCount',
      values: { count: '3' },
    })
  })

  it('view.files 走同一入口(changedFiles 缺省 ⇒ 空态)', () => {
    expect(viewOf('completed').files.empty).toBe(true)
    expect(viewOf('completed', { changedFiles: 12 }).files.values).toEqual({ count: '12' })
    expect(viewOf('completed', { changedFiles: 12 }).files.count).toBe(12)
  })
})

describe('D75 判定层不触碰 /side 队列(W27 预备消息优先规则保持)', () => {
  it('不导出任何入队 / 发送能力 ⇒ 无法改变预备消息优先出队的分支', () => {
    // W27 规则(`apps/web/src/components/chat/message-input.tsx` 流结束 effect):
    //   pendingMessages.length > 0 → sendPendingMessage();
    //   else if (sideQueue.length > 0) → answerCurrentSideQuestion()。
    // 本判定层只提供视图与清理清单,动作族里**没有** send / enqueue / answer 类动作。
    expect(SIDE_TASK_ACTIONS).toEqual(['close', 'confirmClose', 'cancelClose', 'cleanup'])
    for (const forbidden of ['send', 'enqueue', 'answer', 'dequeue']) {
      expect(SIDE_TASK_ACTIONS).not.toContain(forbidden)
    }
  })

  it('冻结输入后全部导出函数照常工作(纯函数 ⇒ 不可能篡改队列数据)', () => {
    const frozenTask = Object.freeze(task('expired', { title: '冻结件', changedFiles: 3 }))
    const frozenList = Object.freeze([frozenTask])
    expect(() => sideTaskView(frozenTask)).not.toThrow()
    expect(() => isSideTaskExpired(frozenTask, T0)).not.toThrow()
    expect(() => needsCloseConfirm(frozenTask)).not.toThrow()
    expect(() => collectExpiredSideTasks(frozenList, T0)).not.toThrow()
    expect(collectExpiredSideTasks(frozenList, T0).map((e) => e.title)).toEqual(['冻结件'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
