// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-654② —— 「删除要带身份守卫」。
 *
 * 立因:`background-registry.ts` 旧写法凭 key 盲删/盲投(`tasks.delete(t.id)`、
 * `settleListeners.delete(...)`、`loops.delete(id)`),而 `id` 是**可复用的键**
 * (本文件 `notified` 字段的注释自己登记过"pruneCompleted() 之后同 id 复用是真路径")——
 * 于是上一轮迟到的终态能清掉同一 key 上新一代的登记,表现为"新任务的等待者永远收不到终态"。
 *
 * 现:每一次登记带一枚世代身份(`identity`),删除与投递一律**身份匹配才动**,
 * 并且**没有"不带身份就盲删"的默认档** —— 无身份 = 拒绝 + 计数(`getRemovalGuardStats()`)。
 *
 * 用例全部成对(§22c:判据必须能问出颜色,去掉任一条红的必须是不同的用例):
 *  - 正例:身份匹配 ⇒ 真删除(条目出表、该代等待者被以 `gone` 回答,不吊死);
 *  - 反例:旧一轮的身份 ⇒ 拒绝删除,新登记原样存活;
 *  - 正例:本代终态照常投递;
 *  - 反例:迟到世代对象带着**同一个 key** 来投终态 ⇒ 不改新条目状态、不投别人家的快照、
 *    不摘新登记的桶,计数 +1,而新登记的等待者随后仍被正常回答(存活证据);
 *  - 反向锁:拒绝就是**没删**(状态、监听器、计数三者一起判,不许只判"没抛错")。
 *
 * 台账隔离照 `background-ledger.test.ts` 的既有做法(§26 唯一落点 + `IHUI_HOME` 出口),
 * 本套件的注册动作会写台账,不许落到真实 `~/.ihui`。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as path from 'node:path';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28
import {
  __test__,
  clearAllLoops,
  clearAllTasks,
  getRemovalGuardStats,
  getTask,
  listTasks,
  listLoops,
  registerFailedTask,
  registerTask,
  removeLoop,
  removeTask,
  startLoop,
  stopLoop,
  waitForTask,
} from '../src/tools/background-registry.js';
import type { BackgroundTask } from '../src/tools/background-registry.js';

/** 注册表对 process 只做四件事(stdout?.on / stderr?.on / on('error') / on('close'))⇒ EventEmitter 全覆盖。 */
function fakeChild(): ChildProcess {
  return new EventEmitter() as unknown as ChildProcess;
}

/** 上一轮迟到的终态在测试里的载体:**同一个 key**,世代号是旧的那一枚(键复用后的旧对象)。 */
function previousGenerationOf(task: BackgroundTask, patch: Partial<BackgroundTask> = {}): BackgroundTask {
  return { ...task, identity: 'gen_previous_run', ...patch };
}

let scratch: string | null = null;
let previousHome: string | undefined;

beforeEach(() => {
  scratch = mkScratch('g654-id-');
  previousHome = process.env.IHUI_HOME;
  process.env.IHUI_HOME = path.join(scratch, 'home');
  clearAllTasks();
  clearAllLoops();
});

afterEach(() => {
  clearAllTasks();
  clearAllLoops();
  if (previousHome === undefined) delete process.env.IHUI_HOME;
  else process.env.IHUI_HOME = previousHome;
  if (scratch) rmScratch(scratch);
  scratch = null;
});

describe('G-654② remove(id, identity):身份匹配才删', () => {
  it('正例:身份匹配 ⇒ 真删除(条目出表,列表为空)', () => {
    const id = registerFailedTask('命令 A', '沙盒拒绝');
    const identity = getTask(id)!.identity;
    expect(identity).toMatch(/^gen_/);
    expect(removeTask(id, identity)).toEqual({ removed: true, id });
    expect(getTask(id)).toBeNull();
    expect(listTasks().map((t) => t.id)).not.toContain(id);
  });

  it('反例:不带身份 ⇒ 拒绝删除并计数(不得保留"盲删"默认档)', () => {
    const id = registerFailedTask('命令 B', '沙盒拒绝');
    const before = getRemovalGuardStats().missingIdentity;
    expect(removeTask(id)).toEqual({ removed: false, reason: 'missing-identity', id });
    expect(getRemovalGuardStats().missingIdentity - before).toBe(1);
    // 反向锁:拒绝 = **什么都没动**,不是"删了但没报告"
    expect(getTask(id)).not.toBeNull();
    expect(listTasks()).toHaveLength(1);
    // 空串也不算是身份(不给"传个假值就放行"的口子)
    expect(removeTask(id, '')).toMatchObject({ removed: false, reason: 'missing-identity' });
    expect(getTask(id)).not.toBeNull();
  });

  it('反例:上一轮的身份删不掉新一代的登记(identity-mismatch ⇒ 条目原样存活)', () => {
    const oldId = registerFailedTask('上一轮', '沙盒拒绝');
    const oldIdentity = getTask(oldId)!.identity;
    expect(removeTask(oldId, oldIdentity)).toEqual({ removed: true, id: oldId });

    const freshId = registerTask(fakeChild(), '新一轮');
    const before = getRemovalGuardStats().identityMismatch;
    expect(removeTask(freshId, oldIdentity)).toEqual({
      removed: false,
      reason: 'identity-mismatch',
      id: freshId,
    });
    expect(getRemovalGuardStats().identityMismatch - before).toBe(1);
    expect(getTask(freshId)).not.toBeNull(); // 新登记没被旧一代的身份清掉
    expect(getTask(freshId)!.status).toBe('running');
  });

  it('not-found 与拒绝档可分辨(不许把"没删成"统一塌成一种)', () => {
    expect(removeTask('bg_never_exists', 'gen_whatever')).toEqual({
      removed: false,
      reason: 'not-found',
      id: 'bg_never_exists',
    });
    const id = registerFailedTask('命令 C', '沙盒拒绝');
    expect(removeTask(id, getTask(id)!.identity)).toEqual({ removed: true, id });
    // 删过之后再删一次:同一 key 已无登记 ⇒ not-found,不是 identity-mismatch
    expect(removeTask(id, 'gen_previous_run').reason).toBe('not-found');
  });

  it('删除必须回答该代等待者(gone 一档),留一个没人回答的等待就是 Promise 泄漏', async () => {
    const id = registerTask(fakeChild(), '有等待者的登记');
    const identity = getTask(id)!.identity;
    const pending = waitForTask(id, 10_000);
    expect(removeTask(id, identity)).toEqual({ removed: true, id });
    const result = await pending;
    expect(result.state).toBe('gone');
    expect(result.snapshot).toBeNull();
  });

  it('删除只作用于本代:别的登记的等待者不受牵连,随后照常收到自己的终态', async () => {
    const doomedId = registerTask(fakeChild(), '将被按身份删除');
    const otherChild = fakeChild();
    const otherId = registerTask(otherChild, '别的登记');
    const seen: Array<string | null> = [];
    __test__.addSettleListener(otherId, (snap) => seen.push(snap?.status ?? 'null'));

    removeTask(doomedId, getTask(doomedId)!.identity);
    otherChild.emit('close', 0, null);
    expect(seen).toEqual(['exited']); // 别的 key 上的那一桶没被牵连摘掉
    expect(getTask(otherId)!.status).toBe('exited');
  });
});

describe('G-654② 迟到终态不得清掉同一 key 的新登记', () => {
  it('反例:旧一代对象带着同一个 key 来投终态 ⇒ 不改新条目、不投递、不摘桶', () => {
    const child = fakeChild();
    const id = registerTask(child, '键相同,世代已换');
    const live = getTask(id)!;
    const deliveries: Array<string | null> = [];
    __test__.addSettleListener(id, (snap) => deliveries.push(snap?.status ?? 'null'));

    const before = getRemovalGuardStats().staleTerminalRejected;
    // 上一轮迟到的终态(killed + 一个别人家的退出码)
    __test__.notifySettled(previousGenerationOf(live, { status: 'killed', exitCode: 9, notified: false }));
    expect(getRemovalGuardStats().staleTerminalRejected - before).toBe(1);
    // 反向锁:三条"没动"一起判 —— 只判"没抛错"问不出颜色
    expect(deliveries).toEqual([]);
    expect(live.status).toBe('running');
    expect(live.exitCode).toBeUndefined();
    expect(live.notified).toBe(false);
    expect(getTask(id)).toBe(live);
  });

  it('正例:同一条链上,本代终态照常投递 ⇒ 证明上一发是被拒而不是流程坏了', async () => {
    const child = fakeChild();
    const id = registerTask(child, '本代终态仍要能落地');
    const live = getTask(id)!;
    const deliveries: Array<string | null> = [];
    __test__.addSettleListener(id, (snap) => deliveries.push(snap?.status ?? 'null'));

    __test__.notifySettled(previousGenerationOf(live, { status: 'killed' })); // 迟到的一发:被拒
    expect(deliveries).toEqual([]);

    child.emit('close', 0, null); // 本代真终态
    expect(deliveries).toEqual(['exited']); // 桶还在,等待者被正常回答 ⇒ 新登记存活
    const again = await waitForTask(id, 1000);
    expect(again.state).toBe('settled');
    expect(again.snapshot!.status).toBe('exited');
  });

  it('迟到的那一发不得消耗本代的 claim(位仍是 false,真终态还能投)', () => {
    const child = fakeChild();
    const id = registerTask(child, 'claim 不被迟到世代吃掉');
    const live = getTask(id)!;
    let hits = 0;
    __test__.addSettleListener(id, () => {
      hits += 1;
    });
    __test__.notifySettled(previousGenerationOf(live, { status: 'error', notified: true }));
    expect(live.notified).toBe(false); // 迟到对象自己带位,不许写到本代头上
    child.emit('error', new Error('本代 error'));
    expect(hits).toBe(1);
  });

  it('登记在表的条目世代身份唯一:两次登记的 identity 必不相同', () => {
    const a = registerTask(fakeChild(), '登记 A');
    const b = registerTask(fakeChild(), '登记 B');
    expect(getTask(a)!.identity).not.toBe(getTask(b)!.identity);
    expect(getTask(a)!.id).toBe(a);
  });
});

describe('G-654② 循环任务同一条守卫', () => {
  it('startLoop 交出身份;身份不符 ⇒ 停不掉(旧一轮停不掉新一轮的定时器)', () => {
    const r = startLoop({ command: 'echo x', interval: '5s', spawn: () => 'bg_mock' });
    if ('error' in r) throw new Error(`夹具:startLoop 失败 ${r.error}`);
    expect(r.identity).toMatch(/^gen_/);
    expect(stopLoop(r.id, 'gen_not_mine')).toBe(false);
    expect(loopIds()).toEqual([r.id]); // 拒绝 = 真没停(定时器还在表上)
    expect(stopLoop(r.id, r.identity)).toBe(true);
    expect(loopIds()).toEqual([]);
  });

  it('removeLoop 无身份 ⇒ 拒绝并计数;既有 stopLoop(id) 调用点仍可用(取当下在任那一代)', () => {
    const r = startLoop({ command: 'echo y', interval: '5s', spawn: () => 'bg_mock' });
    if ('error' in r) throw new Error(`夹具:startLoop 失败 ${r.error}`);
    const before = getRemovalGuardStats().missingIdentity;
    expect(removeLoop(r.id)).toMatchObject({ removed: false, reason: 'missing-identity' });
    expect(getRemovalGuardStats().missingIdentity - before).toBe(1);
    expect(loopIds()).toEqual([r.id]);
    // 如实登记本票的口径边界:`commands/repl.ts` 的 `/loop stop` 是禁改文件里的既有调用点,
    // 它不带身份 —— 这一支走的是"读当下在任那一代再去守卫删"(删不到它没看见的世代),
    // 而不是凭 key 盲删。严格档请用 removeLoop(id, identity)。
    expect(stopLoop(r.id)).toBe(true);
    expect(loopIds()).toEqual([]);
    expect(stopLoop('loop_nonexistent')).toBe(false); // 既有契约不破
  });
});

function loopIds(): string[] {
  // 只经公开出口问"还在不在",不碰内部 Map
  return listLoops().map((l) => l.id);
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
