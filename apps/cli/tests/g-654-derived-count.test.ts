// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-654① —— 「运行计数不得是第二份真相」。
 *
 * 立因:`SubagentWorkerPool` 旧写法是 `private activeCount = 0` 自己 ++/--(8 处增删点),
 * 而它自己文件里就写着「若不在此补清理,activeCount 永久占位 → drainQueue 条件永远少一格」——
 * 那只手漏一次就泄一格,多减一次就成负数(负数让 `< maxWorkers` 反而多放行)。
 * 现计数由**应计入的集合之和**派生(`workers` 在册 + `reservedStarts` 已占位尚未登记),
 * 并保证「算出来的值与上次相同 ⇒ 不发事件/不重复通知」。
 *
 * 本套件的重心是**对拍**,不是"新函数能用":
 *  - `LegacyActiveCount` 按旧代码那 4 条增删规则逐点复刻(`++` 在决定启动那一拍、
 *    `--` 在早退/exit/error 三处、shutdown 归零),每个状态转换同时读旧值与新值;
 *    **表里逐值相等 = 行为等价的全部凭据**(测试跑绿本身不等价,§22c 同理)。
 *  - 分叉行只允许是"旧值已经是负数"的那两档,并且必须点名 —— 负数是旧计数器的错,不是新计数的错。
 *  - 并发上界不许坏:`activeCount < maxWorkers` 取工判据与饿死守卫(下限恒 ≥ 1)逐档保住。
 *  - 发射次数只等于**值发生变化**的次数(交接那一拍两集合之和不变 ⇒ 一声不出)。
 *
 * 全程注入 `forkImpl` 假 proc,不派生真实子进程;每个用例都以 `shutdown()` 收尾,
 * 不把池生命周期计数(`notePoolCreated`/`notePoolClosed`)欠给并发总量遥测。
 */
import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import {
  SubagentWorkerPool,
  SUBAGENT_IDLE_TIMEOUT_ENV,
  defaultWorkerPoolConfig,
  type WorkerPoolDeps,
} from '../src/subagents/worker-pool.js';
import type { SubagentSpawnRequest } from '@ihui/types';

/** 旧计数器那四只手的逐点复刻(方法名对着旧代码的行,不是随手起的)。 */
class LegacyActiveCount {
  value = 0;
  /** 旧 drainQueue:`this.activeCount++`(决定启动的那一拍占一格) */
  launch(): void {
    this.value += 1;
  }
  /** 旧 startWorker 早退两处(worktree 缺源路径 / worktree 创建失败):`this.activeCount--` */
  abandonLaunch(): void {
    this.value -= 1;
  }
  /** 旧 handleWorkerExit 与 proc.on('error'):`this.activeCount--` */
  settle(): void {
    this.value -= 1;
  }
  /** 旧 shutdown 收尾:`this.activeCount = 0` */
  shutdownReset(): void {
    this.value = 0;
  }
}

/**
 * 对拍表(旧值 vs 派生值)。`divergence` 非空 = 这一档**允许**不等,且必须写明为什么。
 * 汇总用例把整张表打到 stdout ⇒ 交付报告里的对拍结论有原始读数可查,不靠叙述。
 */
interface Row {
  step: string;
  legacy: number;
  derived: number;
  equal: boolean;
  divergence: string | null;
}
const table: Row[] = [];

/** 假子进程:kill 行为可注入(优雅退 / 抛错 / 装死),exit 事件可手动重复发(迟到结算的载体)。 */
class FakeProc extends EventEmitter {
  exitCode: number | null = null;
  signalCode: NodeJS.Signals | null = null;
  killed = 0;
  exitEvents = 0;
  constructor(
    readonly pid: number,
    private readonly mode: 'graceful' | 'throw' | 'silent' = 'graceful',
  ) {
    super();
  }
  send(): boolean {
    return true;
  }
  kill(): boolean {
    this.killed += 1;
    if (this.mode === 'throw') {
      throw Object.assign(new Error('kill EPERM'), { code: 'EPERM' });
    }
    if (this.mode === 'silent') return true;
    queueMicrotask(() => this.emitExit(0));
    return true;
  }
  /** 手动发 exit(可重复 —— 旧写法每发一次就多减一格,派生值一格都不多减) */
  emitExit(code: number | null = 0, signal: NodeJS.Signals | null = null): void {
    this.exitEvents += 1;
    this.exitCode = code;
    this.emit('exit', code, signal);
  }
}

interface Harness {
  pool: SubagentWorkerPool;
  legacy: LegacyActiveCount;
  procs: FakeProc[];
  events: Array<{ next: number; prev: number }>;
  off: () => void;
}

function makeHarness(
  maxWorkers: number,
  deps: Partial<WorkerPoolDeps> = {},
  procMode: 'graceful' | 'throw' | 'silent' = 'graceful',
): Harness {
  const procs: FakeProc[] = [];
  const legacy = new LegacyActiveCount();
  const pool = new SubagentWorkerPool(
    defaultWorkerPoolConfig({ maxWorkers, taskTimeoutSeconds: 60, heartbeatTimeoutSeconds: 60 }),
    {
      forkImpl: () => {
        const proc = new FakeProc(7000 + procs.length, procMode);
        procs.push(proc);
        return proc as unknown as ChildProcess;
      },
      killExitBudgetMs: 20,
      ...deps,
    },
  );
  const events: Array<{ next: number; prev: number }> = [];
  const off = pool.onActiveCountChange((next, prev) => {
    events.push({ next, prev });
  });
  return { pool, legacy, procs, events, off };
}

const REQ = { persona: 'coder', task: '派生计数夹具', workspacePath: '.' } as unknown as SubagentSpawnRequest;
/** 无 workspacePath + 无 config.workspaceSourcePath + isolation=worktree ⇒ 走 startWorker 早退路径 */
const REQ_WORKTREE_EARLY = { persona: 'coder', task: '早退夹具', isolation: 'worktree' } as unknown as SubagentSpawnRequest;

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

/** 分叉白名单:只有这三档允许旧值 ≠ 派生值(且旧值必须是负数 = 旧计数器自己减错了)。 */
const ALLOWED_DIVERGENCE = [
  '重复 exit(迟到的第二次结算)⇒ 旧计数器多减一格',
  'shutdown 之后迟到的 exit ⇒ 旧计数器被减成负数',
  '残留条目收口后的迟到 exit ⇒ 旧计数器多减一格',
];

/** 读一行对拍:同批状态下旧值与新值必须同数;分叉档逐条点名并判死旧值为负。 */
function checkRow(step: string, h: Harness, divergence: string | null = null): void {
  const legacy = h.legacy.value;
  const derived = h.pool.activeWorkerCount();
  table.push({ step, legacy, derived, equal: legacy === derived, divergence });
  if (divergence !== null) {
    expect(ALLOWED_DIVERGENCE, `${step}:分叉档不在白名单里`).toContain(divergence);
    expect(legacy, `${step}:分叉档的旧值必须是负数(旧计数器减过头),got ${legacy}`).toBeLessThan(0);
    expect(derived, `${step}:派生值必须钉在 0`).toBe(0);
    return;
  }
  expect(derived, `${step}: 旧值 ${legacy} ≠ 派生值 ${derived}`).toBe(legacy);
}

describe('G-654① 派生计数与旧计数器逐状态对拍', () => {
  it('启动 / 排队 / 结算补位:每档旧值 == 派生值,且上界恒不破', async () => {
    const h = makeHarness(2);
    checkRow('空池起点', h);
    expect(h.events).toEqual([]); // 构造之后没人动过 ⇒ 一声不出

    const p1 = h.pool.spawn(REQ);
    h.legacy.launch();
    const p2 = h.pool.spawn(REQ);
    h.legacy.launch();
    const p3 = h.pool.spawn(REQ); // 第三格进队列(不占并发)
    checkRow('起 2 + 队列 1(maxWorkers=2)', h);
    expect(h.procs).toHaveLength(2);
    expect(h.pool.activeWorkerCount()).toBe(2);

    // 结算一格 ⇒ drainQueue 同步补位(旧: -- 之后 drain 再 ++;新: 出集合之后占位再入集合)
    const beforeStarts = h.procs.length;
    h.legacy.settle();
    h.procs[0].emitExit(0);
    if (h.procs.length > beforeStarts) h.legacy.launch();
    await tick();
    checkRow('结算 1 ⇒ 队列补位(交接那一拍两集合之和不变)', h);
    expect(h.procs).toHaveLength(3);
    expect(h.pool.activeWorkerCount()).toBe(2);

    await h.pool.shutdown();
    h.legacy.settle();
    h.legacy.settle();
    h.legacy.shutdownReset();
    await Promise.all([p1, p2, p3]);
    checkRow('shutdown 收口(两轮 kill 全部拿到 exit 证据)', h);
    h.off();
  });

  it('setMaxWorkers 抬高与压低:非抢占语义下逐值对拍,取工判据照旧', async () => {
    const h = makeHarness(1);
    const p1 = h.pool.spawn(REQ);
    h.legacy.launch();
    const p2 = h.pool.spawn(REQ);
    const p3 = h.pool.spawn(REQ);
    checkRow('maxWorkers=1:起 1 排队 2', h);
    expect(h.procs).toHaveLength(1);

    // 抬高:1 → 3,两条等待项必须**立刻**被同一格判据放行(唤醒与判据都是既有那一条)
    expect(h.pool.setMaxWorkers(3)).toBe(3);
    h.legacy.launch();
    h.legacy.launch();
    checkRow('setMaxWorkers 抬高(1→3)⇒ 队列两项立即启动', h);
    expect(h.procs).toHaveLength(3);

    // 压低:非抢占 —— 只拦后续启动,已在跑的三个一个都不动
    expect(h.pool.setMaxWorkers(1)).toBe(1);
    checkRow('setMaxWorkers 压低(3→1)非抢占:在跑的不动', h);
    expect(h.procs.map((p) => p.killed)).toEqual([0, 0, 0]);
    const p4 = h.pool.spawn(REQ);
    checkRow('压低之后新任务只排队(旧值新值同样不动)', h);
    expect(h.procs).toHaveLength(3);

    await h.pool.shutdown();
    h.legacy.settle();
    h.legacy.settle();
    h.legacy.settle();
    h.legacy.shutdownReset();
    await Promise.all([p1, p2, p3, p4]);
    checkRow('shutdown 收口', h);
    h.off();
  });

  it('钳制下限恒 ≥ 1:取工判据不会被降到 0(饿死守卫照旧保住)', async () => {
    const h = makeHarness(2);
    // MIN_CONCURRENCY=1 这一格是"activeCount < maxWorkers 永不成立 ⇒ 整池饿死"的守卫,
    // 派生计数换的是**读数口径**,不是那条下限:0/负数/NaN 一律折回 1。
    expect(h.pool.setMaxWorkers(0)).toBeGreaterThanOrEqual(1);
    expect(h.pool.setMaxWorkers(-7)).toBeGreaterThanOrEqual(1);
    expect(h.pool.setMaxWorkers(Number.NaN)).toBeGreaterThanOrEqual(1);
    checkRow('非法档位折回下限(派生值为 0 而上界仍 ≥ 1)', h);
    await h.pool.shutdown();
    h.legacy.shutdownReset();
    h.off();
  });

  it('worktree 早退:占位必须归还(旧 ++/-- 与新 add/delete 同值)', async () => {
    const h = makeHarness(2);
    const p = h.pool.spawn(REQ_WORKTREE_EARLY);
    h.legacy.launch();
    h.legacy.abandonLaunch();
    await expect(p).resolves.toMatchObject({ status: 'failed' });
    await tick();
    checkRow('worktree 早退(进程从未起过 ⇒ 一格都不许占)', h);
    expect(h.procs).toHaveLength(0);
    expect(h.pool.activeWorkerCount()).toBe(0);
    // 早退不许吃掉后续容量:再来一发正常任务必须起得来
    const p2 = h.pool.spawn(REQ);
    h.legacy.launch();
    checkRow('早退之后容量未被占住(旧计数器泄一格就少一格的地方)', h);
    expect(h.procs).toHaveLength(1);
    await h.pool.shutdown();
    h.legacy.settle();
    h.legacy.shutdownReset();
    await Promise.all([p, p2]);
    h.off();
  });

  it("proc 'error' 收口(spawn 失败无 exit 事件):减一格与旧值同", async () => {
    const h = makeHarness(1);
    const p = h.pool.spawn(REQ);
    h.legacy.launch();
    checkRow('error 之前(占着一格)', h);
    h.procs[0].emit('error', new Error('spawn ENOENT'));
    h.legacy.settle();
    await expect(p).resolves.toMatchObject({ status: 'failed' });
    await tick();
    checkRow('error 收口(旧 :773 那条补清理的路径,派生值同样归零)', h);
    expect(h.pool.activeWorkerCount()).toBe(0);
    expect(h.pool.activeSubagentIds()).toEqual([]);
    await h.pool.shutdown();
    h.legacy.shutdownReset();
    await p;
    h.off();
  });

  it('kill 抛错 ⇒ residual 残留:未确认回收的条目仍计入,与旧值同', async () => {
    const h = makeHarness(2, {}, 'throw');
    const p = h.pool.spawn(REQ);
    h.legacy.launch();
    await tick();
    checkRow('residual 之前(在跑)', h);
    await h.pool.shutdown();
    h.legacy.shutdownReset();
    const resp = await p;
    checkRow('shutdown 对残留进程发信号失败 ⇒ 记 residualPid,条目随 workers.clear 出集合(旧:归零)', h);
    expect(resp.status).toBe('failed');
    expect(resp.error).toContain('residualPid=');
    expect(h.pool.getResidualKills()).toHaveLength(1);
    expect(h.pool.activeWorkerCount()).toBe(0);
    // 残留之后再来一发迟到的 exit:OS 若真退了才由 exit 事件收口,计数不许再往下走
    h.procs[0].emitExit(1, 'SIGKILL');
    h.legacy.settle();
    await tick();
    checkRow('残留 + 迟到 exit ⇒ 旧值变负,派生值钉在 0', h, '残留条目收口后的迟到 exit ⇒ 旧计数器多减一格');
    h.off();
  });

  it('重复 exit(迟到的第二次结算):值未变 ⇒ 一声不出,旧计数器却多减一格', async () => {
    const h = makeHarness(1);
    const p = h.pool.spawn(REQ);
    h.legacy.launch();
    expect(h.events).toEqual([{ next: 1, prev: 0 }]); // 起一格:恰一发(交接那一拍没出声)

    h.procs[0].emitExit(0);
    h.legacy.settle();
    await tick();
    checkRow('第一次结算(1→0,恰第二发)', h);
    expect(h.events).toHaveLength(2);

    // 同一批状态上再发一次 exit(旧写法靠"resolver 已被消费"挡住通知,却挡不住 --)
    h.procs[0].emitExit(0);
    h.legacy.settle();
    await tick();
    checkRow('重复 exit(迟到的第二次结算)⇒ 旧计数器多减一格', h, '重复 exit(迟到的第二次结算)⇒ 旧计数器多减一格');
    expect(h.events, '派生值没变 ⇒ 不得再多发一声').toHaveLength(2);
    await h.pool.shutdown();
    h.legacy.shutdownReset();
    await p;
    expect(h.events).toHaveLength(2);
    h.off();
  });

  it('shutdown 之后迟到的 exit:旧值被减成负数,派生值钉在 0', async () => {
    const h = makeHarness(1);
    const p = h.pool.spawn(REQ);
    h.legacy.launch();
    await h.pool.shutdown(); // graceful:kill ⇒ exit(0) 在预算内到,handleWorkerExit 先收口
    h.legacy.settle();
    h.legacy.shutdownReset();
    checkRow('shutdown 收口(旧值归零 / 派生值随集合归零)', h);
    // 迟到的再一发 exit(宿主补发 / 假 proc 重放):旧写法照减不误 ⇒ 负数
    h.procs[0].emitExit(0);
    h.legacy.settle();
    await tick();
    checkRow('shutdown 之后迟到的 exit ⇒ 旧计数器被减成负数', h, 'shutdown 之后迟到的 exit ⇒ 旧计数器被减成负数');
    expect(h.pool.activeWorkerCount()).toBe(0);
    await p;
    h.off();
  });

  it('发射次数 == 值变化次数(成对:同值零发 / 变一次恰一发 / 撤销后不再收)', async () => {
    const h = makeHarness(1);
    expect(h.events).toEqual([]);
    const p1 = h.pool.spawn(REQ);
    h.legacy.launch();
    expect(h.events).toEqual([{ next: 1, prev: 0 }]);
    const p2 = h.pool.spawn(REQ); // 只进队列:值没变 ⇒ 一声不出
    expect(h.events).toHaveLength(1);

    // 重复的无害调用面:同值上再来一次清理,不许产生第二声
    h.procs[0].emitExit(0);
    h.legacy.settle();
    await tick();
    expect(h.events.map((e) => [e.next, e.prev])).toEqual([[1, 0], [0, 1], [1, 0]]);
    h.procs[0].emitExit(0);
    h.legacy.settle();
    await tick();
    expect(h.events, '同一值上重复结算 ⇒ 不重复通知').toHaveLength(3);

    // 撤销之后不再收到(观测面不得只增不减)
    h.off();
    const p3 = h.pool.spawn(REQ);
    await tick();
    expect(h.events).toHaveLength(3);
    await h.pool.shutdown();
    await Promise.all([p1, p2, p3]);
  });

  it('转后台(detached_idle)仍占一格:与旧计数器同值(转后台 ≠ 让出并发)', async () => {
    process.env[SUBAGENT_IDLE_TIMEOUT_ENV] = '1000';
    const h = makeHarness(1);
    vi.useFakeTimers();
    try {
      const p = h.pool.spawn(REQ);
      h.legacy.launch();
      await vi.advanceTimersByTimeAsync(5_100); // 第一跳 5s 的轮询:无活动超阈 ⇒ 转后台
      const id = h.pool.activeSubagentIds()[0];
      expect(id).toBeDefined();
      expect(h.pool.getLifecycleStatus(id)).toBe('detached_idle');
      await expect(p).resolves.toMatchObject({ status: 'running' });
      checkRow('转后台后进程仍活着 ⇒ 旧值新值都还占着这一格', h);
      expect(h.pool.activeSubagentIds()).toHaveLength(1);
      // 上界不许因为"转后台"被读成空位:再派一发必须还在队列里
      const p2 = h.pool.spawn(REQ);
      checkRow('转后台不释放并发格(旧写法同样不减)', h);
      expect(h.procs).toHaveLength(1);
      void p2;
    } finally {
      vi.useRealTimers();
      delete process.env[SUBAGENT_IDLE_TIMEOUT_ENV];
    }
    await h.pool.shutdown();
    h.legacy.settle();
    h.legacy.shutdownReset();
    checkRow('转后台条目随 shutdown 收口(集合清空 ⇒ 派生值归零)', h);
    h.off();
  });

  it('对拍表汇总:除点名的三档分叉外逐行等值,分叉行旧值必为负', () => {
    const rows = table.filter((r) => !r.equal);
    // 汇总表打到 stdout ⇒ 交付报告引的是实测读数,不是叙述
    console.info(`[G-654① 对拍表] ${JSON.stringify(table)}`);
    expect(table.length).toBeGreaterThanOrEqual(15);
    expect(rows.map((r) => r.divergence).sort()).toEqual([...ALLOWED_DIVERGENCE].sort());
    for (const r of rows) {
      expect(r.divergence, `${r.step} 分叉却没写明为什么`).not.toBeNull();
      expect(r.legacy).toBeLessThan(0);
      expect(r.derived).toBe(0);
    }
    expect(table.filter((r) => r.equal).length).toBe(table.length - rows.length);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
