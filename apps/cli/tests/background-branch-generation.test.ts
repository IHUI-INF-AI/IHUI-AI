// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-816001 后台条目分支代戳 + 唤醒播报面比对;G-816002 × 分支代(重臂剥继承、重盖新章)。
 *
 * G-816001 验收(台账行原文要点):
 *  ① 旧代通知不得进队列,但必须落一条 `stale_branch_dropped` 审计行
 *     (静默丢弃 = 下一次没人知道丢过什么)—— 计数与 stderr 行两样都要;
 *  ② 重臂后同 id 的新代通知必须放行(否则把"该送达的"也一起拦死)。
 *
 * 机制(G-632 分支代计数器为真源):条目在 register 时刻盖 `branchGeneration` 章
 * (`registerTask` / `registerFailedTask` 两处构造体字面量,同一盖章口径,绝无继承路径);
 * `notifySettled` 的**播报入队面**(emitNotice 一支 = lost)按 `isBranchGenerationCurrent`
 * 比对,不等 ⇒ 不入队 + 审计行 + 计数。拦截只管播报:结算面(lost 落档)、claim、
 * 等待者投递各走各的既有门(G-654② 的 identity 代际门管投递面 —— 两条轴各判各的)。
 *
 * G-816002 与本块的分工:`background-registry.test.ts` 的 G-816002 分域块已钉死
 * "重臂 = 整枚新对象,结算面从 false 起步、身份面逐字不回头改写、非重臂重挂载整块不动";
 * 本块只补分支代那一半 —— 重臂时新登记的代戳 = 当下代(W6-68"交 register 重盖章"),
 * 以及"同一活对象重复 notifySettled"时新代戳也一字不动。
 *
 * lost 形的构造:hasObservableOutcome 三条载体(内容/退出码/终止原因)全空 ⇒ 判 lost
 * (`close(null, null)` 型)。只有 lost 支 emitNotice=true —— settled 支的"通知"载体是
 * 等待者投递,不经播报出口,所以播报面的拦截与放行断言必须走 lost 形。
 *
 * 台账隔离照 background-registry.test.ts 的既有姿势(§26 唯一落点 + `IHUI_HOME` 出口):
 * 本块每一步登记都会写台账,不许落到真实 `~/.ihui`。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28
import {
  registerTask,
  registerFailedTask,
  getTask,
  clearAllTasks,
  getRemovalGuardStats,
  __test__,
} from '../src/tools/background-registry.js';
import type { BackgroundTask, BackgroundTaskSnapshot } from '../src/tools/background-registry.js';
import {
  bumpBranchGeneration,
  currentBranchGeneration,
  __resetBranchGenerationForTest,
} from '../src/commands/branch-generation.js';

/**
 * close(null, null) 的 lost 形:无输出、无退出码、status=exited(非 killed/error)
 * ⇒ 可观察性判不过 ⇒ 判 lost ⇒ emitNotice=true,走播报入队面(分支代门所在)。
 */
function settleLostShaped(live: BackgroundTask): void {
  live.status = 'exited';
  live.exitedAt = new Date().toISOString();
  // exitCode 保持构造体缺省(undefined):typeof undefined !== 'number' ⇒ 第三条载体也不亮
}

/** settled 形:有可观察结局 ⇒ settled 支 —— 通知载体是等待者投递,不经播报出口。 */
function settleSettledShaped(live: BackgroundTask): void {
  live.status = 'exited';
  live.exitedAt = new Date().toISOString();
  live.exitCode = 0;
  live.stdoutBuf = 'done';
  live.totalStdoutChars = 4;
}

/** stderr 捕获(审计行断言用):patch 期间吞掉写入,restore 必须在 finally 里调。 */
function captureStderr(): { lines: string[]; restore: () => void } {
  const lines: string[] = [];
  const original = process.stderr.write;
  process.stderr.write = ((chunk: string | Uint8Array): boolean => {
    lines.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8'));
    return true;
  }) as typeof process.stderr.write;
  return { lines, restore: () => { process.stderr.write = original; } };
}

/** 全字段快照(结算面 + 身份面,含新代戳):票面③"一个字段都不许变"按这个问。 */
function wholeFace(t: BackgroundTask): Record<string, unknown> {
  return {
    id: t.id,
    identity: t.identity,
    command: t.command,
    startedAt: t.startedAt,
    status: t.status,
    exitCode: t.exitCode,
    exitedAt: t.exitedAt,
    timedOut: t.timedOut,
    stopInitiator: t.stopInitiator ?? null,
    notified: t.notified,
    branchGeneration: t.branchGeneration,
    stdoutBuf: t.stdoutBuf,
    stderrBuf: t.stderrBuf,
    stdoutHead: t.stdoutHead,
    stderrHead: t.stderrHead,
    totalStdoutChars: t.totalStdoutChars,
    totalStderrChars: t.totalStderrChars,
    truncated: t.truncated,
    droppedStdoutBytes: t.droppedStdoutBytes,
    droppedStderrBytes: t.droppedStderrBytes,
    process: t.process,
    worktreePath: t.worktreePath,
    worktreeSourcePath: t.worktreeSourcePath,
  };
}

describe('G-816001 后台条目分支代戳 + 唤醒播报面比对', () => {
  let scratch: string | null = null;
  let previousHome: string | undefined;

  beforeEach(() => {
    const dir: string = mkScratch('g816001-'); // §26 唯一落点(夹具模块无类型声明,按 string 取用)
    scratch = dir;
    previousHome = process.env.IHUI_HOME;
    process.env.IHUI_HOME = path.join(dir, 'home');
    clearAllTasks();
    __resetBranchGenerationForTest();
    __test__.setTerminalNoticeSink(null);
  });

  afterEach(() => {
    __test__.setTerminalNoticeSink(null);
    clearAllTasks();
    __resetBranchGenerationForTest();
    if (previousHome === undefined) delete process.env.IHUI_HOME;
    else process.env.IHUI_HOME = previousHome;
    if (scratch) rmScratch(scratch);
    scratch = null;
  });

  it('注册时刻盖章:两种登记的代戳都 = 当下分支代;重臂后新登记是新代戳,旧条目代戳逐字不动', () => {
    expect(currentBranchGeneration()).toBe(0);
    const firstId = registerTask(null, 'bg-gen 上一世');
    const first = getTask(firstId)!;
    expect(first.branchGeneration).toBe(0);

    bumpBranchGeneration('test-fork'); // 重臂(分支装配/切换成功)
    const runningId = registerTask(null, 'bg-gen 新一世(在跑)');
    const failedId = registerFailedTask('bg-gen 新一世(生下来即终态)', 'sandbox denied');
    const running = getTask(runningId)!;
    const failed = getTask(failedId)!;

    // 盖章只来自注册时刻:两条登记路径同一口径,不存在继承旧代戳的入口
    expect(running.branchGeneration).toBe(1);
    expect(failed.branchGeneration).toBe(1);
    expect(running.branchGeneration).not.toBe(first.branchGeneration);
    // 反向半边:新登记不回头改写上一世的代戳(身份面逐字不动的既有判据,代戳一并纳入)
    expect(first.branchGeneration).toBe(0);
    // 重臂复位那一半(G-816002① 的字面要求,此处一并钉住)
    expect(running.notified).toBe(false);
    expect(failed.notified).toBe(false);
  });

  it('旧代条目的终态唤醒不进播报队列:审计行 + 计数必须落,结算面与 claim 照常走', () => {
    const id = registerTask(null, 'bg-gen 旧代的唤醒');
    const live = getTask(id)!;
    expect(live.branchGeneration).toBe(0);
    bumpBranchGeneration('test-fork');

    settleLostShaped(live);
    const notices: string[] = [];
    __test__.setTerminalNoticeSink((n) => notices.push(n));
    const captured = captureStderr();
    const droppedBefore = getRemovalGuardStats().staleBranchDropped;
    try {
      __test__.notifySettled(live);
    } finally {
      captured.restore();
    }

    expect(notices).toEqual([]); // ← 验收①:旧代通知不得进队列
    expect(getRemovalGuardStats().staleBranchDropped - droppedBefore).toBe(1);
    const audit = captured.lines.join('');
    expect(audit).toContain('stale_branch_dropped'); // ← 验收①:不许静默丢
    expect(audit).toContain(id); // 审计行必须能对上丢的是哪一条
    // 拦截只管播报面:lost 照落、claim 照消耗(结算各走各的既有门)
    expect(live.status).toBe('lost');
    expect(live.notified).toBe(true);
  });

  it('重臂后同 id 重盖章的条目,其终态唤醒必须放行(拦截不得把该送达的也拦死)', () => {
    const id = registerTask(null, 'bg-gen 重臂后放行');
    const live = getTask(id)!;
    bumpBranchGeneration('test-fork');
    // W6-68:重臂时剥掉继承的代戳、交 register 重盖章 —— 我方 register 构造体就是那一行,
    // 测试面直译 = 把代戳重盖成当下代(key 换代没有公开入口,见 G-816002 分域块头论证)。
    live.branchGeneration = currentBranchGeneration();

    settleLostShaped(live);
    const notices: string[] = [];
    __test__.setTerminalNoticeSink((n) => notices.push(n));
    const captured = captureStderr();
    const droppedBefore = getRemovalGuardStats().staleBranchDropped;
    try {
      __test__.notifySettled(live);
    } finally {
      captured.restore();
    }

    expect(notices.length).toBe(1); // ← 验收②:该送达的必须送达
    expect(getRemovalGuardStats().staleBranchDropped - droppedBefore).toBe(0);
    expect(captured.lines.join('')).not.toContain('stale_branch_dropped');
    expect(live.status).toBe('lost');
  });

  it('fork 后新登记的条目在新代正常播报(注册时刻盖章的整链)', () => {
    registerTask(null, 'bg-gen 旧世代');
    bumpBranchGeneration('test-fork');
    const freshId = registerTask(null, 'bg-gen 新世代');
    const fresh = getTask(freshId)!;
    expect(fresh.branchGeneration).toBe(currentBranchGeneration());

    settleLostShaped(fresh);
    const notices: string[] = [];
    __test__.setTerminalNoticeSink((n) => notices.push(n));
    __test__.notifySettled(fresh);

    expect(notices.length).toBe(1);
    expect(fresh.status).toBe('lost');
  });

  it('分支代门只拦播报入队:旧代条目的 settled 支照常向等待者投递快照', () => {
    const id = registerTask(null, 'bg-gen 等待者不受代门影响');
    const live = getTask(id)!;
    bumpBranchGeneration('test-fork');

    settleSettledShaped(live);
    const received: Array<BackgroundTaskSnapshot | null> = [];
    __test__.addSettleListener(id, (snap) => received.push(snap));
    const notices: string[] = [];
    __test__.setTerminalNoticeSink((n) => notices.push(n));
    const droppedBefore = getRemovalGuardStats().staleBranchDropped;

    __test__.notifySettled(live);

    expect(received.length).toBe(1); // 投递面不查分支代:与 G-654② 的 identity 门各管一轴
    expect(received[0]!.status).toBe('exited');
    expect(received[0]!.id).toBe(id);
    expect(notices).toEqual([]); // settled 支本来就不播报(不是被代门拦的)
    expect(getRemovalGuardStats().staleBranchDropped - droppedBefore).toBe(0);
    expect(live.notified).toBe(true); // claim 由投递支消耗
  });
});

describe('G-816002 × 分支代:重臂剥继承、非重臂重挂载一字不动', () => {
  let scratch: string | null = null;
  let previousHome: string | undefined;

  beforeEach(() => {
    const dir: string = mkScratch('g816002bg-'); // §26 唯一落点;台账隔离走 IHUI_HOME 出口
    scratch = dir;
    previousHome = process.env.IHUI_HOME;
    process.env.IHUI_HOME = path.join(dir, 'home');
    clearAllTasks();
    __resetBranchGenerationForTest();
    __test__.setTerminalNoticeSink(null);
  });

  afterEach(() => {
    __test__.setTerminalNoticeSink(null);
    clearAllTasks();
    __resetBranchGenerationForTest();
    if (previousHome === undefined) delete process.env.IHUI_HOME;
    else process.env.IHUI_HOME = previousHome;
    if (scratch) rmScratch(scratch);
    scratch = null;
  });

  it('同一活对象重复 notifySettled(幂等门):结算面与身份面(含代戳)逐字段不变', () => {
    const id = registerTask(null, 'bg-gen 幂等重挂载');
    const live = getTask(id)!;
    settleSettledShaped(live);
    __test__.addSettleListener(id, () => undefined); // 有当场接得住的等待者 ⇒ 首发真消耗 claim
    __test__.notifySettled(live);
    expect(live.notified).toBe(true);

    const before = wholeFace(live);
    __test__.notifySettled(live); // 同 blob 二次重挂载 ⇒ 幂等门 haltedAt=idempotency 整块早退
    expect(wholeFace(live)).toEqual(before); // ← 票面③:一个字段都不许变(含新代戳 branchGeneration)
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
