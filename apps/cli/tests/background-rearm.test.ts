// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-272 重臂复位:按面分域(结算面重置 / 身份面逐字保留 / 新生面换代)。
 *
 * 票面上游锚点 `apps/zcode-cli/packages/core/src/tool/executor/background-task-registry.ts:56-116`
 * (外部参照,不在本仓):同一 id 在**终态**条目上重开时只重置结算面
 * `notified/completedAt/error/exitCode/resultText/pid/stopInitiator`,身份面
 * `agentId/parentToolCallId/turnId/description/startedAt` 保留。我方没有
 * `parentToolCallId/turnId`,身份面的等价载体 = `ownerAgentId` + `command` + `startedAt`
 * + 登记期定死的 worktree 归属;分域表本身只在源文件 `BACKGROUND_TASK_REARM_FACE` 一处
 * (§0.6 单一真相源,本文件只 import 不复制)。
 *
 * 三条必需用例(票面验收)与两型失败的对应:
 *  ① 终态条目重臂后 `notified=false` 且身份面逐字不变 —— 复位不能复错人;
 *  ② 同 id 新任务重臂后能再投递一次通知(模拟旧 claim 已消费)—— 两型失败
 *    「恢复 run 的通知被旧 claim 吞掉」与「同 id 复用的新任务永不投递」;
 *  ③ 负控:非终态条目的重臂不得清结算面(防把"每次挂载都清一遍"当默认)。
 * 另两条:拒绝档族(id-mismatch / generation-not-renewed / not-live)与 fail-closed
 * (身份面缺失不清空、未知扩展键不静默丢)。
 *
 * 台账隔离照同族测试的既有姿势(§26 唯一落点 + `IHUI_HOME` 出口):每一步登记都会
 * 写台账,不许落到真实 `~/.ihui`。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28
import {
  BACKGROUND_TASK_REARM_FACE,
  rearmBackgroundTask,
  registerTask,
  getTask,
  listTasks,
  clearAllTasks,
  __test__,
} from '../src/tools/background-registry.js';
import type { BackgroundTask } from '../src/tools/background-registry.js';

/** 假子进程:注册表对 process 只做 stdout?.on / stderr?.on / on('error') / on('close')。 */
function fakeChild(): ChildProcess {
  return new EventEmitter() as unknown as ChildProcess;
}

const FACE_KEYS = Object.keys(BACKGROUND_TASK_REARM_FACE) as Array<keyof BackgroundTask>;

/** 结算面逐字段回读 —— "一个字段都不许变"只能这样问,判"没抛错"问不出颜色。 */
function settlementFace(task: BackgroundTask): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of FACE_KEYS) {
    if (BACKGROUND_TASK_REARM_FACE[key] === 'reset') out[key] = task[key];
  }
  return out;
}

/**
 * 新一世条目。身份面**故意写成冒名值**:若实现从 incoming 取身份面,用例①的逐字断言必红。
 * 结算面同样故意写脏:实现必须无视它们、按构造初值重置。
 */
function incomingOf(base: BackgroundTask, overrides: Partial<BackgroundTask> = {}): BackgroundTask {
  return {
    ...base,
    identity: 'gen_next_life',
    process: fakeChild(),
    status: 'running',
    exitedAt: undefined,
    exitCode: undefined,
    stdoutBuf: '',
    stderrBuf: '',
    stdoutHead: '',
    stderrHead: '',
    totalStdoutChars: 0,
    totalStderrChars: 0,
    truncated: false,
    droppedStdoutBytes: 0,
    droppedStderrBytes: 0,
    timedOut: false,
    stopInitiator: undefined,
    settledBy: undefined,
    notified: false,
    command: 'g272 冒名命令',
    startedAt: '1999-01-01T00:00:00.000Z',
    ownerAgentId: 'agent-impostor',
    worktreePath: '/impostor/wt',
    worktreeSourcePath: '/impostor/src',
    ...overrides,
  };
}

describe('G-272 重臂复位:结算面 / 身份面 / 新生面分域', () => {
  let scratch: string | null = null;
  let previousHome: string | undefined;

  beforeEach(() => {
    const dir: string = mkScratch('g272-'); // §26 唯一落点(夹具模块无类型声明,按 string 取用)
    scratch = dir;
    previousHome = process.env.IHUI_HOME;
    process.env.IHUI_HOME = path.join(dir, 'home');
    clearAllTasks();
    __test__.setTerminalNoticeSink(null);
  });

  afterEach(() => {
    __test__.setTerminalNoticeSink(null);
    clearAllTasks();
    if (previousHome === undefined) delete process.env.IHUI_HOME;
    else process.env.IHUI_HOME = previousHome;
    if (scratch) rmScratch(scratch);
    scratch = null;
  });

  it('分域表先自证:三档覆盖条目全部字段,且结算面确实包含 claim 位', () => {
    const id = registerTask(null, 'g272 分域表自证');
    const live = getTask(id)!;
    for (const key of Object.keys(live) as Array<keyof BackgroundTask>) {
      expect(FACE_KEYS).toContain(key);
    }
    // 票面①要复位的正是 claim 位;identity 在新生面(必换),身份面绝不包含它
    expect(BACKGROUND_TASK_REARM_FACE.notified).toBe('reset');
    expect(BACKGROUND_TASK_REARM_FACE.identity).toBe('renew');
    expect(BACKGROUND_TASK_REARM_FACE.ownerAgentId).toBe('preserve');
  });

  it('① 终态条目重臂后 notified=false,身份面逐字不变,结算面回到构造初值', () => {
    const firstChild = fakeChild();
    const id = registerTask(firstChild, 'g272 上一世的命令', {
      ownerAgentId: 'agent-A',
    });
    const prev = getTask(id)!;
    // 先让上一世真正"脏"起来 —— 否则后半段的"重置"可以靠本来就没脏过蒙过去
    __test__.addSettleListener(id, () => undefined); // 有当场接得住的等待者,claim 才会被消耗
    firstChild.emit('close', 3, null);
    prev.stdoutBuf = '上一世的输出';
    prev.stdoutHead = '上一世的头';
    prev.totalStdoutChars = 6;
    prev.timedOut = true;
    prev.stopInitiator = 'user';
    // close 后给身份面补 worktree 归属(登记期属性;已终态,不再触发清理)
    prev.worktreePath = '/worktrees/g272';
    prev.worktreeSourcePath = '/repos/g272';
    expect(prev.notified).toBe(true);
    expect(prev.status).toBe('exited');
    expect(prev.exitCode).toBe(3);

    const incoming = incomingOf(prev);
    const outcome = rearmBackgroundTask(prev, incoming);
    expect(outcome.rearmed).toBe(true);
    const next = outcome.task;

    // 票面①:claim 位必须复位(否则新生命永不投递)
    expect(next.notified).toBe(false);
    // 票面②的等价形:身份面逐字保留上一世,绝不采信 incoming 的冒名值
    expect(next.id).toBe(prev.id);
    expect(next.command).toBe('g272 上一世的命令');
    expect(next.startedAt).toBe(prev.startedAt);
    expect(next.ownerAgentId).toBe('agent-A');
    expect(next.worktreePath).toBe('/worktrees/g272');
    expect(next.worktreeSourcePath).toBe('/repos/g272');
    // 新生面:世代号必换、进程句柄与分支代取这一世
    expect(next.identity).toBe('gen_next_life');
    expect(next.identity).not.toBe(prev.identity);
    expect(next.process).toBe(incoming.process);
    expect(next.branchGeneration).toBe(incoming.branchGeneration);
    // 结算面:逐字段构造初值(不是"跟旧值不同"就算数)
    expect(next.status).toBe('running');
    expect(next.exitedAt).toBeUndefined();
    expect(next.exitCode).toBeUndefined();
    expect(next.stdoutBuf).toBe('');
    expect(next.stderrBuf).toBe('');
    expect(next.stdoutHead).toBe('');
    expect(next.stderrHead).toBe('');
    expect(next.totalStdoutChars).toBe(0);
    expect(next.totalStderrChars).toBe(0);
    expect(next.truncated).toBe(false);
    expect(next.droppedStdoutBytes).toBe(0);
    expect(next.droppedStderrBytes).toBe(0);
    expect(next.timedOut).toBe(false);
    expect(next.stopInitiator).toBeUndefined();
    expect(next.settledBy).toBeUndefined();
    // 落地:注册表原位换人,旧条目不再在册(listTasks 仍只有一条,id 不变)
    expect(getTask(id)).toBe(next);
    expect(listTasks().filter((t) => t.id === id)).toHaveLength(1);
    // 反向半边:上一世对象自己的结算面不被重臂回头改写
    expect(prev.status).toBe('exited');
    expect(prev.exitCode).toBe(3);
    expect(prev.notified).toBe(true);
  });

  it('② 同 id 新任务重臂后能再投递一次通知(旧 claim 已消费)', () => {
    const firstChild = fakeChild();
    const id = registerTask(firstChild, 'g272 投递面', { ownerAgentId: 'agent-A' });
    const prev = getTask(id)!;
    let firstNotices = 0;
    __test__.addSettleListener(id, () => {
      firstNotices += 1;
    });
    firstChild.emit('close', 0, null);
    expect(firstNotices).toBe(1);
    expect(prev.notified).toBe(true); // 旧 claim 已被上一世消耗

    // 先证明"旧 claim 确实还在":不重臂就对同一发再通知,必须被幂等档拦下
    let beforeRearm = 0;
    __test__.addSettleListener(id, () => {
      beforeRearm += 1;
    });
    __test__.notifySettled(prev);
    expect(beforeRearm).toBe(0);

    // 重臂:新一世接管同一枚 key
    const outcome = rearmBackgroundTask(prev, incomingOf(prev));
    expect(outcome.rearmed).toBe(true);
    const next = outcome.task;
    expect(getTask(id)).toBe(next);
    expect(next.notified).toBe(false);

    // 新一世的等待者(桶按新世代归置)
    let nextNotices = 0;
    let seenId = '';
    __test__.addSettleListener(id, (snap) => {
      nextNotices += 1;
      seenId = snap?.id ?? '';
    });
    // 模拟新一世跑完(真实路径里由新进程的 close 事件驱动)
    next.status = 'exited';
    next.exitCode = 0;
    next.exitedAt = new Date().toISOString();
    next.stdoutBuf = '新一世的结果';
    next.totalStdoutChars = 6;
    __test__.notifySettled(next);

    expect(nextNotices).toBe(1); // ← 票面两型失败的正控:旧 claim 没吞掉新通知
    expect(seenId).toBe(id);
    expect(next.notified).toBe(true); // claim 由新一世自己消耗
    expect(listTasks().filter((t) => t.id === id)).toHaveLength(1);
  });

  it('③ 负控:非终态条目的重臂不得清结算面,条目原位存活', () => {
    const id = registerTask(fakeChild(), 'g272 还在跑的一世');
    const prev = getTask(id)!;
    // 造一些"看起来可以清"的结算面脏值(在跑的一世可能已经写过其中几格)
    prev.notified = true;
    prev.stopInitiator = 'user';
    prev.stdoutBuf = '跑着,别动';
    prev.totalStdoutChars = 5;
    const before = settlementFace(prev);
    let answered = 0;
    __test__.addSettleListener(id, () => {
      answered += 1;
    });

    const outcome = rearmBackgroundTask(prev, incomingOf(prev));

    expect(outcome.rearmed).toBe(false);
    if (!outcome.rearmed) expect(outcome.reason).toBe('not-terminal');
    expect(outcome.task).toBe(prev);
    expect(getTask(id)).toBe(prev); // 没被换掉、没被摘掉:被拒就是"整块没动"
    expect(settlementFace(prev)).toEqual(before); // ← 票面③的字面要求:一个字段都不许变
    expect(prev.status).toBe('running');
    expect(answered).toBe(0); // 旧桶也没被结掉(没有以 null 回答任何人)
  });

  it('④ 拒绝档族:不同 key / 未换代 / 已不在册 一律不动条目', () => {
    const child = fakeChild();
    const id = registerTask(child, 'g272 拒绝档');
    child.emit('close', 0, null);
    const prev = getTask(id)!;
    const before = settlementFace(prev);

    const wrongKey = rearmBackgroundTask(prev, incomingOf(prev, { id: 'bg_other_key' }));
    expect(wrongKey.rearmed).toBe(false);
    if (!wrongKey.rearmed) expect(wrongKey.reason).toBe('id-mismatch');

    const sameGeneration = rearmBackgroundTask(prev, incomingOf(prev, { identity: prev.identity }));
    expect(sameGeneration.rearmed).toBe(false);
    if (!sameGeneration.rearmed) expect(sameGeneration.reason).toBe('generation-not-renewed');

    const emptyGeneration = rearmBackgroundTask(prev, incomingOf(prev, { identity: '' }));
    expect(emptyGeneration.rearmed).toBe(false);
    if (!emptyGeneration.rearmed) expect(emptyGeneration.reason).toBe('generation-not-renewed');

    const ghost: BackgroundTask = { ...prev, id: 'bg_g272_never_registered' };
    const notLive = rearmBackgroundTask(ghost, incomingOf(ghost));
    expect(notLive.rearmed).toBe(false);
    if (!notLive.rearmed) expect(notLive.reason).toBe('not-live');

    expect(getTask(id)).toBe(prev);
    expect(settlementFace(prev)).toEqual(before);
  });

  it('⑤ fail-closed:身份面缺失时取新世给的值(不清空),未知扩展键保留旧值', () => {
    const child = fakeChild();
    const id = registerTask(child, 'g272 fail-closed');
    child.emit('close', 0, null);
    const prev = getTask(id)!;
    expect(prev.ownerAgentId).toBeUndefined(); // 上一世没有归属
    (prev as unknown as Record<string, unknown>).futureExtendedField = 'legacy-value';

    const incoming = incomingOf(prev, {
      ownerAgentId: 'agent-from-incoming',
      ...({ futureExtendedField: 'incoming-must-not-win' } as Partial<BackgroundTask>),
    });
    const outcome = rearmBackgroundTask(prev, incoming);
    expect(outcome.rearmed).toBe(true);
    const next = outcome.task;

    // 缺失的身份面不清空:取这一世给的值(失效方向恒为"多留一份归属",而不是丢人)
    expect(next.ownerAgentId).toBe('agent-from-incoming');
    // 分域表之外的键:保留旧值,不静默丢
    expect((next as unknown as Record<string, unknown>).futureExtendedField).toBe('legacy-value');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
