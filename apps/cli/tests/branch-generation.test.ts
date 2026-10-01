// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-632 分支代际计数器 — 宿主定向测试(node --test 直跑,类型剥离加载被测模块)
//
// 被测真判据(src/commands/branch-generation.ts,零依赖):
//   · 分支装配出口 bumpBranchGeneration:代数 +1、计数 +1、事件流水留痕(reason 可对账)
//   · 异步解算启动 captureBranchGeneration:捕获当下代数
//   · 落地前比对 isBranchGenerationCurrent:代数不等 ⇒ 必须作废
//   · 作废可观测:recordSupersededBranchResult 返回非空日志行(含新旧代数)+
//     superseded 计数 + 事件流水含 superseded 条目 —— 不许静默丢
//
// 装配出口的接线(/fork、/branch、/sessions resume 的 bump 与 repl 落地口的比对)
// 由 tsc 类型面 + repl.ts 源码钉死;本文件钉的是计数器本身的全部分支语义。

import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import {
  __resetBranchGenerationForTest,
  branchGenerationStats,
  bumpBranchGeneration,
  captureBranchGeneration,
  currentBranchGeneration,
  isBranchGenerationCurrent,
  recentBranchGenerationEvents,
  recordSupersededBranchResult,
} from '../src/commands/branch-generation.ts';

describe('G-632 分支代际计数器', () => {
  beforeEach(() => {
    __resetBranchGenerationForTest();
  });

  it('初始化态:代数为 0,事件流水为空,各计数归零', () => {
    assert.equal(currentBranchGeneration(), 0);
    const stats = branchGenerationStats();
    assert.deepEqual(stats, { generation: 0, bumps: 0, captures: 0, superseded: 0 });
    assert.equal(recentBranchGenerationEvents().length, 0);
  });

  it('分支装配出口 bump:代数 +1、bumps 计数 +1、事件流水留痕(reason 可对账)', () => {
    assert.equal(bumpBranchGeneration('fork'), 1);
    assert.equal(bumpBranchGeneration('branch'), 2);
    assert.equal(currentBranchGeneration(), 2);
    const stats = branchGenerationStats();
    assert.equal(stats.generation, 2);
    assert.equal(stats.bumps, 2);

    const events = recentBranchGenerationEvents();
    assert.equal(events.length, 2);
    assert.equal(events[0]!.kind, 'bump');
    assert.equal(events[0]!.generation, 1);
    assert.equal(events[0]!.reason, 'fork');
    assert.equal(events[1]!.kind, 'bump');
    assert.equal(events[1]!.generation, 2);
    assert.equal(events[1]!.reason, 'branch');
  });

  it('解算启动 capture:捕获当下代数;无切换 ⇒ current 为真(结果正常落地)', () => {
    bumpBranchGeneration('fork');
    const token = captureBranchGeneration();
    assert.equal(token, 1);
    assert.equal(isBranchGenerationCurrent(token), true);
    // capture 只记观测计数,不推进代数
    const stats = branchGenerationStats();
    assert.equal(stats.generation, 1);
    assert.equal(stats.captures, 1);
    assert.equal(stats.bumps, 1);
  });

  it('解算在飞期间分支被切换(/fork)⇒ 代数不等,current 为假,结果必须作废', () => {
    const token = captureBranchGeneration();
    assert.equal(token, 0);
    assert.equal(isBranchGenerationCurrent(token), true);

    // 在飞窗口内用户装配了新分支
    bumpBranchGeneration('fork');
    assert.equal(isBranchGenerationCurrent(token), false);

    // 再切一次(如 /branch)依旧不等 —— 单调递增,任何装配都使旧令牌过期
    bumpBranchGeneration('branch');
    assert.equal(isBranchGenerationCurrent(token), false);
  });

  it('作废可观测:日志行非空且含新旧代数,superseded 计数 +1,事件流水含 superseded 条目', () => {
    const token = captureBranchGeneration();
    bumpBranchGeneration('sessions-resume');

    const note = recordSupersededBranchResult(token, { sessionId: 'sess_x' });
    assert.ok(note.length > 0, '作废必须产出日志行,不许静默丢');
    assert.ok(note.includes('0'), `日志行须含陈旧代数: ${note}`);
    assert.ok(note.includes('1'), `日志行须含当前代数: ${note}`);
    assert.ok(note.includes('sess_x'), `日志行须可对账到会话: ${note}`);

    const stats = branchGenerationStats();
    assert.equal(stats.superseded, 1);

    const events = recentBranchGenerationEvents();
    const supersededEvents = events.filter((e) => e.kind === 'superseded');
    assert.equal(supersededEvents.length, 1);
    assert.equal(supersededEvents[0]!.staleGeneration, 0);
    assert.equal(supersededEvents[0]!.generation, 1);
    assert.equal(supersededEvents[0]!.sessionId, 'sess_x');
  });

  it('多次作废累计:两次切换 + 两次旧轮落地 ⇒ superseded = 2(逐条可观测)', () => {
    const first = captureBranchGeneration();
    bumpBranchGeneration('fork');
    const second = captureBranchGeneration();
    bumpBranchGeneration('branch');

    const note1 = recordSupersededBranchResult(first);
    const note2 = recordSupersededBranchResult(second);
    assert.ok(note1.length > 0 && note2.length > 0);

    const stats = branchGenerationStats();
    assert.equal(stats.superseded, 2);
    assert.equal(stats.generation, 2);

    const supersededEvents = recentBranchGenerationEvents().filter((e) => e.kind === 'superseded');
    assert.deepEqual(supersededEvents.map((e) => e.staleGeneration), [0, 1]);
  });

  it('无 detail 的作废也成立(sessionId 缺省不进事件)', () => {
    const token = captureBranchGeneration();
    bumpBranchGeneration('fork');
    const note = recordSupersededBranchResult(token);
    assert.ok(note.length > 0);
    const supersededEvent = recentBranchGenerationEvents().find((e) => e.kind === 'superseded');
    assert.ok(supersededEvent);
    assert.equal('sessionId' in supersededEvent, false);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
