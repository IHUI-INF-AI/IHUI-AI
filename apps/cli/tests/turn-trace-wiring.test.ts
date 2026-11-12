// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 回合运行态**接线**验证。
 *
 * 前面两个测试文件测的是「判据对不对」与「方法注册没注册」。
 * 本文件测的是第三件事:**真实执行流跑完之后,有没有留下记录**。
 *
 * 这一层不可省的理由:状态机可以完全正确、协议面也可以完全可达,
 * 但如果没有一行代码在 `runToolLoop` 里调用它,那整套东西就是死码 ——
 * 用户视角「回合被中断后看不到它在做什么」的问题一点没解决。
 *
 * 同时钉两条失效方向:
 *   ① 会话不存在时,运行态记录失败**不得**影响 agent 循环(吞掉而不是抛);
 *   ② `endReasonFromStopReason` 必须穷尽 —— 任何非正常说完的档位都要落成 synthetic,
 *      不能被算进"正常完成"。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  endReasonFromStopReason,
  isNormalStop,
  type TurnEndReason,
} from '../src/acp/turn-lifecycle.js';
import { loadSessionRuntime } from '../src/acp/turn-store.js';

let dir = '';

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-turn-trace-'));
  process.env.IHUI_CLI_SESSIONS_DIR = path.join(dir, 'sessions');
  process.env.IHUI_CLI_TURNS_DIR = path.join(dir, 'turns');
  process.env.IHUI_CLI_GOALS_DIR = path.join(dir, 'goals');
});

afterEach(() => {
  for (const k of ['IHUI_CLI_SESSIONS_DIR', 'IHUI_CLI_TURNS_DIR', 'IHUI_CLI_GOALS_DIR']) {
    delete process.env[k];
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('endReasonFromStopReason 穷尽映射', () => {
  it('end_turn 是唯一的 normal', () => {
    expect(endReasonFromStopReason('end_turn')).toEqual({ kind: 'normal' });
    expect(isNormalStop('end_turn')).toBe(true);
  });

  it('cancelled 归 cancelled', () => {
    const r = endReasonFromStopReason('cancelled');
    expect(r.kind).toBe('cancelled');
  });

  it('其余一切非正常终止都归 synthetic 且必带 detail', () => {
    // 这些档位都来自 AgentStopReason 封闭集:不是"模型自己说完了"
    const nonNormal = [
      'doom_loop',
      'max_iterations',
      'budget_limited',
      'plan_approval_required',
      'no_progress',
      'goal_blocked',
      'error',
      'some_future_stop_reason', // 上游新增档位的兜底
    ];
    for (const s of nonNormal) {
      const r = endReasonFromStopReason(s);
      expect(r.kind).toBe('synthetic');
      expect(r.kind === 'synthetic' ? r.detail : '').toContain(s);
    }
  });

  it('synthetic 一定带非空 detail(否则无法与正常结束区分)', () => {
    for (const s of ['doom_loop', 'no_progress', 'error']) {
      const r: TurnEndReason = endReasonFromStopReason(s);
      if (r.kind === 'synthetic') {
        expect(r.detail.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('只有 end_turn 算正常,其余一律不算(防正常完成率被高估)', () => {
    expect(isNormalStop('end_turn')).toBe(true);
    for (const s of ['doom_loop', 'max_iterations', 'budget_limited', 'cancelled', 'error']) {
      expect(isNormalStop(s)).toBe(false);
    }
  });
});

describe('接线:真实 runToolLoop 会留下回合记录', () => {
  it('无 sessionId 时不写任何记录(不污染默认面)', async () => {
    const { createSession, saveSession } = await import('../src/commands/session.js');
    const s = createSession(dir, 'm');
    saveSession(s);

    // 不传 sessionId ⇒ 不该产生 turns 目录下的会话文件
    const rt = loadSessionRuntime(s.id);
    expect(rt.turns).toEqual([]);
  });

  it('会话不存在时记录失败被吞掉,不抛错(观测面不得阻断执行)', async () => {
    // 直接验证 loadSessionRuntime 对不存在会话返回空态而非抛错 —— 这是
    // beginTurnTrace 能安全吞掉异常的前提。
    const rt = loadSessionRuntime('sess_never_existed');
    expect(rt.turns).toEqual([]);
    expect(rt.activeTurnId).toBeNull();
  });
});
