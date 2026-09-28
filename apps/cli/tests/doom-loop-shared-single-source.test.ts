// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * V3#54 共享层单源行为锁 —— doom-loop / stuck 判据上提到
 * packages/shared/src/agent/doom-loop-detector.ts(CLI 经适配器透传)后钉三件事:
 *   ① 票面策略数字经 CLI 入口透传不变(10/3/0/2/3/3/120/sha256);
 *   ② 换策略决策与失败连击跟踪的行为(首轮反思+跳过,连续第 2 轮报警终止;
 *      同工具连败 3 次触发换策略并自动清零);
 *   ③ 声明的每个动作都真可产出(名单不是死表 —— 守门 120 同族要求)。
 * 跨语言等值不在此判(那是 scripts/check-doom-loop-parity.mjs 的职责)。
 */
import { describe, expect, it } from 'vitest'
import {
  createFailureStreakTracker,
  planDoomAlertResponse,
  DoomLoopSignatureDetector,
  DOOM_ALERT_ROUNDS_TO_TERMINATE,
  DOOM_LOOP_COOLDOWN_MS,
  DOOM_LOOP_HASH_ALGORITHM,
  DOOM_LOOP_REPEAT_THRESHOLD,
  DOOM_LOOP_STATES,
  DOOM_LOOP_STRATEGY_ACTIONS,
  DOOM_LOOP_WINDOW_SIZE,
  ERROR_SIGNATURE_MAX_LEN,
  FAILURE_STREAK_STRATEGY_THRESHOLD,
  STUCK_CONSECUTIVE_THRESHOLD,
} from '../src/doom-loop-detector.js'

describe('V3#54 共享层策略数字经 CLI 入口透传', () => {
  it('票面值:窗口 10 / 重复 3 / 冷却 0 / 报警 2 轮终止 / stuck 3 / 失败连击 3 / 签名 120', () => {
    expect(DOOM_LOOP_WINDOW_SIZE).toBe(10)
    expect(DOOM_LOOP_REPEAT_THRESHOLD).toBe(3)
    expect(DOOM_LOOP_COOLDOWN_MS).toBe(0)
    expect(DOOM_ALERT_ROUNDS_TO_TERMINATE).toBe(2)
    expect(STUCK_CONSECUTIVE_THRESHOLD).toBe(3)
    expect(FAILURE_STREAK_STRATEGY_THRESHOLD).toBe(3)
    expect(ERROR_SIGNATURE_MAX_LEN).toBe(120)
    expect(DOOM_LOOP_HASH_ALGORITHM).toBe('sha256')
    expect(DOOM_LOOP_STATES).toEqual(['observing', 'reflecting', 'terminating'])
    expect(DOOM_LOOP_STRATEGY_ACTIONS).toEqual([
      'inject_reflection',
      'skip_tool_execution',
      'terminate_loop',
    ])
  })
})

describe('planDoomAlertResponse 决策(与 Python plan_doom_alert_response 同形)', () => {
  it('0 轮无动作;1 轮反思+跳过;达到终止轮数即终止', () => {
    expect(planDoomAlertResponse(0)).toEqual({ actions: [], state: 'observing' })
    expect(planDoomAlertResponse(1)).toEqual({
      actions: ['inject_reflection', 'skip_tool_execution'],
      state: 'reflecting',
    })
    expect(planDoomAlertResponse(DOOM_ALERT_ROUNDS_TO_TERMINATE)).toEqual({
      actions: ['terminate_loop'],
      state: 'terminating',
    })
    expect(planDoomAlertResponse(9).actions).toEqual(['terminate_loop'])
  })

  it('每个声明动作都真能被产出(阳性对照:动作清单不是死表)', () => {
    const reachable = new Set<string>()
    for (let rounds = 0; rounds <= 5; rounds++) {
      for (const action of planDoomAlertResponse(rounds).actions) reachable.add(action)
    }
    for (const action of DOOM_LOOP_STRATEGY_ACTIONS) {
      expect(reachable.has(action), `动作 ${action} 无任何轮数可产出`).toBe(true)
    }
  })
})

describe('createFailureStreakTracker(票面:failure-streak ≥3 换策略)', () => {
  it('第 3 次连败触发并自动清零;成功即时重置;按工具名隔离', () => {
    const tracker = createFailureStreakTracker()
    expect(tracker.record('run_command', false)).toEqual({ streak: 1, changeStrategy: false })
    expect(tracker.record('run_command', false)).toEqual({ streak: 2, changeStrategy: false })
    expect(tracker.record('run_command', false)).toEqual({
      streak: FAILURE_STREAK_STRATEGY_THRESHOLD,
      changeStrategy: true,
    })
    expect(tracker.record('run_command', false)).toEqual({ streak: 1, changeStrategy: false })
    tracker.record('file_edit', false)
    expect(tracker.record('file_edit', true)).toEqual({ streak: 0, changeStrategy: false })
    expect(tracker.record('file_edit', false)).toEqual({ streak: 1, changeStrategy: false })
  })
})

describe('DoomLoopSignatureDetector(原 agent.ts 本地类,现委托共享层)', () => {
  it('连续 3 轮相同 tool_call 模式(参数键序不同也算相同)判死循环', () => {
    const det = new DoomLoopSignatureDetector()
    det.recordToolCalls([{ name: 'read', arguments: { path: 'a', offset: 0 } }])
    det.recordToolCalls([{ name: 'read', arguments: { offset: 0, path: 'a' } }])
    expect(det.isDoomLoop()).toBe(false)
    det.recordToolCalls([{ name: 'read', arguments: { path: 'a', offset: 0 } }])
    expect(det.isDoomLoop()).toBe(true)
  })

  it('连续 3 次相同错误签名(数字差异被归一)判死循环;end_turn reset 后重新计数', () => {
    const det = new DoomLoopSignatureDetector()
    det.recordError('connection reset at hop 1')
    det.recordError('connection reset at hop 2')
    expect(det.isDoomLoop()).toBe(false)
    det.recordError('connection reset at hop 3')
    expect(det.isDoomLoop()).toBe(true)
    det.reset()
    det.recordError('connection reset at hop 4')
    expect(det.isDoomLoop()).toBe(false)
  })
})
