// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * B4-05 更新后的优雅自重启。
 *
 * 对照 WorkBuddy 的更新链路：安装完成不立刻砍进程，而是把「待重启」记在协调器里，
 * 等当前在飞任务清空后再拉新进程，旧进程最后退出。
 *
 * 三条硬约束：
 *   1. 有在飞任务 ⇒ `wait`，不抢跑、不丢任务；
 *   2. 更新交接被拒 / 未判定 (`UpdateHandoffPlan.action !== 'apply'`) ⇒ 不重启；
 *   3. 同一版本同一原因只排一次；重启进程 spawn 失败 ⇒ 不退出旧进程，保留待重启态。
 *
 * 防重启风暴：`IHUI_RESTART_ATTEMPT` 由新进程继承，超过 `MAX_RESTART_ATTEMPTS` 拒绝再拉。
 */

import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';

import type { UpdateHandoffPlan } from '../updater.js';

export const RESTART_ENV = {
  fromPid: 'IHUI_RESTARTED_FROM_PID',
  attempt: 'IHUI_RESTART_ATTEMPT',
  reason: 'IHUI_RESTART_REASON',
} as const;

export const MAX_RESTART_ATTEMPTS = 2;

export type RestartReason = 'update-applied' | 'manual' | 'config-change';

export interface PendingRestart {
  readonly reason: RestartReason;
  readonly version: string | null;
  readonly requestedAt: number;
}

export type RestartDecision =
  | { readonly action: 'none'; readonly reason: 'no-pending' }
  | { readonly action: 'wait'; readonly reason: 'active-tasks'; readonly activeTasks: number }
  | { readonly action: 'refused'; readonly reason: 'attempt-budget-exhausted' }
  | { readonly action: 'restart'; readonly reason: 'idle' };

export interface RestartDeps {
  readonly execPath?: string;
  readonly argv?: readonly string[];
  readonly env?: NodeJS.ProcessEnv;
  readonly spawn?: (command: string, args: readonly string[], options: SpawnOptions) => unknown;
  readonly exit?: (code: number) => void;
  /** 旧进程退出前的最后一句话；实现必须先于 exit，且不得阻断重启。 */
  readonly beforeExit?: () => void;
}

export interface RestartAttemptResult {
  readonly action: 'spawned' | 'waiting' | 'none' | 'refused' | 'failed';
  readonly detail: string;
}

function attemptsFromEnv(env: NodeJS.ProcessEnv): number {
  const raw = env[RESTART_ENV.attempt];
  const parsed = raw === undefined ? 0 : Number(raw);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

/**
 * 更新交接计划 → 是否允许排重启。只有 `apply` 是放行档；
 * `refused` / `unjudged` 一律不排（校验没做完就替换，比不重启更危险）。
 */
export function restartEligibleFromUpdate(
  plan: UpdateHandoffPlan,
): { eligible: boolean; reason: string } {
  if (plan.action === 'apply' && plan.disposition === 'apply') {
    return { eligible: true, reason: 'update-handoff-applied' };
  }
  return {
    eligible: false,
    reason: `update-handoff-${plan.disposition}-${plan.reason}`,
  };
}

/**
 * spawn 的失败是异步事件（ENOENT/EPERM 不会同步抛），必须等到 `spawn` 事件才敢退出旧进程。
 * 测试桩返回无事件对象时视为已拉起（仅注入用，生产路径一定返回 ChildProcess）。
 */
function waitForSpawn(child: unknown): Promise<{ ok: boolean; detail: string }> {
  if (!child || typeof (child as ChildProcess).once !== 'function') {
    return Promise.resolve({ ok: true, detail: 'spawn-synthetic' });
  }
  const cp = child as ChildProcess;
  return new Promise((resolve) => {
    cp.once('spawn', () => resolve({ ok: true, detail: 'spawn' }));
    cp.once('error', (err) =>
      resolve({ ok: false, detail: err instanceof Error ? err.message : String(err) }),
    );
  });
}

export class RestartCoordinator {
  private pending: PendingRestart | null = null;

  /** 排一次重启；同原因同版本重复调用幂等。返回是否新排入。 */
  request(reason: RestartReason, version: string | null = null, now = Date.now()): boolean {
    if (this.pending) {
      if (this.pending.reason === reason && this.pending.version === version) return false;
      return false;
    }
    this.pending = { reason, version, requestedAt: now };
    return true;
  }

  /** 更新交接计划入口：不 eligible 时返回 false 且不改状态。 */
  requestAfterUpdate(plan: UpdateHandoffPlan, version: string | null = null, now = Date.now()): boolean {
    const verdict = restartEligibleFromUpdate(plan);
    if (!verdict.eligible) return false;
    return this.request('update-applied', version, now);
  }

  peek(): PendingRestart | null {
    return this.pending ? { ...this.pending } : null;
  }

  /**
   * 判当前能否重启。纯函数式读取，不清状态；`begin` 才清。
   */
  decide(activeTasks: number, env: NodeJS.ProcessEnv = process.env): RestartDecision {
    if (!this.pending) return { action: 'none', reason: 'no-pending' };
    if (activeTasks > 0) {
      return { action: 'wait', reason: 'active-tasks', activeTasks };
    }
    if (attemptsFromEnv(env) >= MAX_RESTART_ATTEMPTS) {
      return { action: 'refused', reason: 'attempt-budget-exhausted' };
    }
    return { action: 'restart', reason: 'idle' };
  }

  /**
   * 真正拉起新进程。只有 `spawn` 事件到达才 `exit(0)`；同步抛错或异步 `error`
   * 都保留待重启态，旧进程继续服务，下一次任务清空后可再试。
   */
  async begin(activeTasks: number, deps: RestartDeps = {}): Promise<RestartAttemptResult> {
    const decision = this.decide(activeTasks, deps.env ?? process.env);
    if (decision.action === 'none') return { action: 'none', detail: 'no-pending' };
    if (decision.action === 'wait') {
      return { action: 'waiting', detail: `active-tasks=${decision.activeTasks}` };
    }
    if (decision.action === 'refused') {
      return { action: 'refused', detail: 'attempt-budget-exhausted' };
    }

    const spawnFn = deps.spawn ?? spawn;
    const env = deps.env ?? process.env;
    const execPath = deps.execPath ?? process.execPath;
    const argv = deps.argv ?? process.argv.slice(1);
    const attempt = attemptsFromEnv(env) + 1;
    const pending = this.pending;

    let child: unknown;
    try {
      child = spawnFn(execPath, [...argv], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
        env: {
          ...env,
          [RESTART_ENV.fromPid]: String(process.pid),
          [RESTART_ENV.attempt]: String(attempt),
          [RESTART_ENV.reason]: pending?.reason ?? 'manual',
        },
      });
    } catch (err) {
      return {
        action: 'failed',
        detail: err instanceof Error ? err.message : String(err),
      };
    }

    const spawned = await waitForSpawn(child);
    if (!spawned.ok) {
      return { action: 'failed', detail: spawned.detail };
    }

    this.pending = null;
    try {
      deps.beforeExit?.();
    } catch {
      // 汇报失败不得阻断重启：旧进程继续退出，新进程已确认 spawn。
    }
    const exit = deps.exit ?? ((code: number) => process.exit(code));
    exit(0);
    return { action: 'spawned', detail: `attempt=${attempt}` };
  }
}

/** 新进程启动时消费重启标记：读完即删，防止同一标记被二次解释。 */
export function consumeRestartMarker(
  env: NodeJS.ProcessEnv = process.env,
): PendingRestart | null {
  const fromPid = env[RESTART_ENV.fromPid];
  const reason = env[RESTART_ENV.reason];
  if (!fromPid || !reason) return null;
  const pending: PendingRestart = {
    reason: reason as RestartReason,
    version: null,
    requestedAt: Date.now(),
  };
  delete env[RESTART_ENV.fromPid];
  delete env[RESTART_ENV.reason];
  return pending;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
