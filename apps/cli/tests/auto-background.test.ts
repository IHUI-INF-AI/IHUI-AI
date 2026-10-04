// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-896416 超时自动转后台(auto_on_timeout)测试。
 *
 * 上游参考(ZCode v3.14.3, commit 29628c9):
 *  - tool/handlers/bash.ts:178-184  eligibleForAutoBackground && backgroundLifecyclePort
 *    ⇒ runBashWithBackgroundLifecycle(request, { mode: "auto_on_timeout" }) —— 到点是
 *    分叉点不是终点:先回"已转后台",进程不死,由注册表接管。
 *  - tool/handlers/bash-background-policy.ts:3-9  isBashAutoBackgroundEligible:
 *    非显式后台、非空、首 token ≠ 'sleep'。
 * 验收(票面):
 *  ① 超时 ⇒ 返回消息含 bg id 且 getTaskOutput(bg) 可读到后续输出;
 *  ② 反向锁:sleep 类不收编(到点照杀),非收编命令保持同步原路径;
 *  ③ 转后台后的超时杀必须留 timedOut 档,而不是 user/model(G-816026 兼容)。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as os from 'node:os';

import { run_command, isAutoBackgroundEligible, clampForegroundTimeout } from '../src/tools/builtins.js';
import { registerTask, getTaskOutput, waitForTask, clearAllTasks } from '../src/tools/background-registry.js';
import type { ToolContext } from '../src/tools/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));

function makeCtx(): ToolContext {
  return {
    workspacePath: os.tmpdir(),
    confirmDangerous: async () => true,
  } as unknown as ToolContext;
}

describe('G-896416 可收编判据(isAutoBackgroundEligible)', () => {
  it('普通非空命令 ⇒ 可收编', () => {
    expect(isAutoBackgroundEligible('ping -n 2 127.0.0.1')).toBe(true);
    expect(isAutoBackgroundEligible('node -e "setTimeout(()=>{},1)"')).toBe(true);
  });

  it('sleep 开头 ⇒ 不可收编(上游 bash-background-policy.ts:3-9 同判据;大小写/空白不放大漏判)', () => {
    expect(isAutoBackgroundEligible('sleep 30')).toBe(false);
    expect(isAutoBackgroundEligible('  sleep   30  ')).toBe(false);
    expect(isAutoBackgroundEligible('SLEEP 5')).toBe(false);
  });

  it('空串/纯空白 ⇒ 不可收编', () => {
    expect(isAutoBackgroundEligible('')).toBe(false);
    expect(isAutoBackgroundEligible('   ')).toBe(false);
  });
});

describe('G-896416 前台超时钳制(clampForegroundTimeout)', () => {
  it('缺省/非法值回 30s 默认(与历史行为同值)', () => {
    expect(clampForegroundTimeout(undefined)).toBe(30_000);
    expect(clampForegroundTimeout('abc')).toBe(30_000);
    expect(clampForegroundTimeout(Number.NaN)).toBe(30_000);
  });

  it('0/负数回默认,不得把 race 变成"还没跑就转后台"', () => {
    expect(clampForegroundTimeout(0)).toBe(30_000);
    expect(clampForegroundTimeout(-5)).toBe(30_000);
  });

  it('越界钳到 [1000, 600000],非整数取整', () => {
    expect(clampForegroundTimeout(500)).toBe(1_000);
    expect(clampForegroundTimeout(999_999)).toBe(600_000);
    expect(clampForegroundTimeout(1500.7)).toBe(1_501);
  });
});

describe('G-896416 killTask 的 deadline 持有者档(timedOut:true)', () => {
  const sleeper = () => spawn(process.execPath, ['-e', 'setTimeout(() => {}, 20000)'], {
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  beforeEach(() => clearAllTasks());
  afterEach(() => clearAllTasks());

  it('预算杀 ⇒ killed + timedOut=true + stopInitiator=null(不是 user/model)', async () => {
    const id = registerTask(sleeper(), 'adopted-budget-kill');
    const r = await killTaskTimedOut(id);
    expect(r.killed).toBe(true);
    const out = getTaskOutput(id);
    expect(out!.status).toBe('killed');
    expect(out!.timedOut).toBe(true);
    expect(out!.stopInitiator ?? null).toBeNull();
  }, 15_000);

  it('同一形态的模型手停 ⇒ timedOut=false(两轴互斥:发起方档不吃掉超时档,反之亦然)', async () => {
    const id = registerTask(sleeper(), 'adopted-model-kill');
    const { killTask } = await import('../src/tools/background-registry.js');
    await killTask(id, 'model');
    const out = getTaskOutput(id);
    expect(out!.stopInitiator).toBe('model');
    expect(out!.timedOut).toBe(false);
  }, 15_000);
});

async function killTaskTimedOut(id: string) {
  const { killTask } = await import('../src/tools/background-registry.js');
  return killTask(id, undefined, { timedOut: true });
}

describe('G-896416 run_command 超时自动转后台(e2e)', () => {
  beforeEach(() => clearAllTasks());
  afterEach(() => clearAllTasks());

  it('验收①:超时 ⇒ 返回消息含 bg id,且后台可读到收编之后的输出', async () => {
    // 首 token 'node' ⇒ 可收编;2.5s 后才写输出,前台窗口 800ms 必超时
    const cmd = `node -e "setTimeout(()=>{console.log('late-output-after-adopt')},2500)"`;
    const result = await run_command.execute({ command: cmd, timeout_ms: 800 }, makeCtx());
    expect(result.success).toBe(true);
    expect(result.output).toContain('已自动转入后台');
    const match = result.output.match(/task_id: (bg_\d+_[a-f0-9]+)/);
    expect(match).not.toBeNull();
    const bgId = match![1];
    // 收编后的输出必须进后台缓冲(票面:getTaskOutput(bg) 可读到后续输出)
    await waitForTask(bgId, 15_000);
    const out = getTaskOutput(bgId);
    expect(out!.status).toBe('exited');
    expect(out!.exitCode).toBe(0);
    expect(out!.stdout).toContain('late-output-after-adopt');
  }, 20_000);

  it('验收②反向锁:sleep 类不收编 —— 任何结果形态都不得出现转后台消息', async () => {
    // Windows 无 sleep ⇒ 同步路径快速失败;Unix 真睡 ⇒ 到点被杀。两形态共同点:
    // 输出里既没有"已自动转入后台"也没有 task_id。
    const result = await run_command.execute({ command: 'sleep 30', timeout_ms: 800 }, makeCtx());
    expect(result.output).not.toContain('已自动转入后台');
    expect(result.output).not.toContain('task_id:');
  }, 15_000);

  it('验收②反向锁:正常结束赶在超时之前 ⇒ 走前台结算,不产生后台任务', async () => {
    const result = await run_command.execute({ command: 'echo fast-foreground-done', timeout_ms: 30_000 }, makeCtx());
    expect(result.output).toContain('fast-foreground-done');
    expect(result.output).not.toContain('已自动转入后台');
    expect(result.output).not.toContain('task_id:');
  }, 15_000);
});

describe('G-896416 源码级反向锁', () => {
  const builtins = readFileSync(join(HERE, '../src/tools/builtins.ts'), 'utf8');
  const sandbox = readFileSync(join(HERE, '../src/sandbox/index.ts'), 'utf8');

  it('run_command 必须保留收编分叉与预算杀,且杀走 deadline 持有者形态(不是 user/model)', () => {
    expect(builtins).toContain('isAutoBackgroundEligible(command)');
    expect(builtins).toContain('killTask(taskId, undefined, { timedOut: true })');
    expect(builtins).toContain('ADOPTED_BACKGROUND_BUDGET_MS');
    expect(builtins).toContain('onDeadline');
  });

  it('sandbox 收编模式:到点先问 onDeadline,不谎报超时不 killTree', () => {
    expect(sandbox).toContain('opts.onDeadline');
    // 收编分支在置位/强杀之前 return —— onDeadline 存在时不得走到 timedOutFlag = true
    const deadlineIdx = sandbox.indexOf('if (opts.onDeadline)');
    const flagIdx = sandbox.indexOf('timedOutFlag = true;');
    expect(deadlineIdx).toBeGreaterThan(-1);
    expect(flagIdx).toBeGreaterThan(-1);
    expect(deadlineIdx).toBeLessThan(flagIdx);
  });

  it('后台任务消息必须向模型声明预算杀会标 timedOut(不许与手停同形)', () => {
    expect(builtins).toContain('不要当作用户/模型手停');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
