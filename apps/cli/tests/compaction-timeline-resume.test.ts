// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-816014 装配测试:resume 必经点(resolveSession)收敛悬挂压缩时间线。
 *
 * 测试穿过真实入口 apps/cli/src/index.ts 的 resolveSession(--continue / --resume
 * 的公共漏斗),账本落在被 USERPROFILE + HOME 双钉的 scratch 目录(同目录=主会话 store),
 * 收敛时刻用假时钟钉死 ⇒ 追加终态的 atMs 断言值写死,不写"有变化"。
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28
import { CliUsageError, resolveSession, settleCliEntryFailure, runAgentAndExit } from '../src/index.js';
import { getCompactionTimelineLedgerPath } from '../src/compaction-timeline-resume.js';
import type * as SessionModule from '../src/commands/session.js';
import { createSession, saveSession } from '../src/commands/session.js';

/**
 * I 组需要把 createSession 换成"可计数/可阻断"的包装(验校验顺序),默认仍逐字透传到真实实现,
 * 因此本文件其余用例的建会话行为完全不变。
 */
const sessionCtl = vi.hoisted(() => ({ blockCreate: false, createCalls: 0 }));

vi.mock('../src/commands/session.js', async (importOriginal) => {
  const actual = await importOriginal<typeof SessionModule>();
  return {
    ...actual,
    createSession: ((...args: Parameters<typeof actual.createSession>) => {
      sessionCtl.createCalls += 1;
      if (sessionCtl.blockCreate) {
        // 阻断档只用于验"校验前不许建会话";返回值形状够过下游即可,不会真跑到 runAgent
        return { id: 'blocked-session', history: [] } as unknown as ReturnType<
          typeof actual.createSession
        >;
      }
      return actual.createSession(...args);
    }) as typeof actual.createSession,
  };
});

/** 假时钟钉死值(2024-10-04T00:00:00Z):追加终态的 atMs 断言写死成它。 */
const PINNED_NOW_MS = 1728000000000;

interface LedgerRecord {
  timelineId: string;
  kind: string;
  atMs: number;
}

let scratch: string | null = null;
let prevUserProfile: string | undefined;
let prevHome: string | undefined;

beforeEach(() => {
  scratch = mkScratch('compaction-timeline-resume');
  prevUserProfile = process.env.USERPROFILE;
  prevHome = process.env.HOME;
  // getSessionsDir() 走 os.homedir():Windows 读 USERPROFILE,POSIX 读 HOME —— 只钉前者
  // 在 Linux runner 上等于没隔离,账本会落进 /home/runner/.ihui/sessions 与别的测试文件
  // 共用(--continue 于是取到别人用真实时钟建的会话)。两个都要钉。
  process.env.USERPROFILE = scratch;
  process.env.HOME = scratch;
  vi.useFakeTimers();
  vi.setSystemTime(PINNED_NOW_MS);
});

afterEach(() => {
  vi.useRealTimers();
  if (prevUserProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = prevUserProfile;
  if (prevHome === undefined) delete process.env.HOME;
  else process.env.HOME = prevHome;
  if (scratch) {
    rmScratch(scratch);
    scratch = null;
  }
});

function writeSessionFixture(): string {
  const session = createSession(path.join(scratch!, 'ws'), 'test-model');
  session.history = [{ role: 'user', content: 'hello before crash' }];
  saveSession(session);
  return session.id;
}

function writeLedger(sessionId: string, records: unknown[]): void {
  fs.writeFileSync(
    getCompactionTimelineLedgerPath(sessionId),
    JSON.stringify(records, null, 2),
    'utf-8',
  );
}

function readLedger(sessionId: string): LedgerRecord[] {
  return JSON.parse(fs.readFileSync(getCompactionTimelineLedgerPath(sessionId), 'utf-8'));
}

/** 夹具:两条悬挂(一条无 boundary、一条带 boundary)+ 一条已终态组,append-only 原始账面。 */
const HANGING_LEDGER: LedgerRecord[] = [
  { timelineId: 'tl_dead_midway', kind: 'started', atMs: 1000 },
  { timelineId: 'tl_dead_midway', kind: 'retrying', atMs: 2000 },
  { timelineId: 'tl_boundary_only', kind: 'started', atMs: 3000 },
  { timelineId: 'tl_boundary_only', kind: 'boundary', atMs: 4000 },
  { timelineId: 'tl_done_before_kill', kind: 'started', atMs: 5000 },
  { timelineId: 'tl_done_before_kill', kind: 'completed', atMs: 6000 },
];

describe('G-816014 resume 必经点收敛悬挂压缩时间线', () => {
  it('--resume:悬挂组收敛(无 boundary→interrupted / 有 boundary→completed),已终态组一条不动', () => {
    const id = writeSessionFixture();
    writeLedger(id, HANGING_LEDGER);

    const resolved = resolveSession({ resume: id });

    expect(resolved.sessionId).toBe(id);
    expect(resolved.history).toEqual([{ role: 'user', content: 'hello before crash' }]);

    // 断言值写死:原 6 条一字不动在前,追加的 2 条终态在后,atMs = 假时钟钉死值。
    expect(readLedger(id)).toEqual([
      { timelineId: 'tl_dead_midway', kind: 'started', atMs: 1000 },
      { timelineId: 'tl_dead_midway', kind: 'retrying', atMs: 2000 },
      { timelineId: 'tl_boundary_only', kind: 'started', atMs: 3000 },
      { timelineId: 'tl_boundary_only', kind: 'boundary', atMs: 4000 },
      { timelineId: 'tl_done_before_kill', kind: 'started', atMs: 5000 },
      { timelineId: 'tl_done_before_kill', kind: 'completed', atMs: 6000 },
      { timelineId: 'tl_dead_midway', kind: 'interrupted', atMs: PINNED_NOW_MS },
      { timelineId: 'tl_boundary_only', kind: 'completed', atMs: PINNED_NOW_MS },
    ]);
  });

  it('--continue:同一漏斗,同收敛语义', () => {
    const id = writeSessionFixture();
    writeLedger(id, HANGING_LEDGER);

    const resolved = resolveSession({ continue: true });

    expect(resolved.sessionId).toBe(id);
    expect(readLedger(id)).toEqual([
      ...HANGING_LEDGER,
      { timelineId: 'tl_dead_midway', kind: 'interrupted', atMs: PINNED_NOW_MS },
      { timelineId: 'tl_boundary_only', kind: 'completed', atMs: PINNED_NOW_MS },
    ]);
  });

  it('无账本的会话 resume = no-op:不代建账本文件', () => {
    const id = writeSessionFixture();

    const resolved = resolveSession({ resume: id });

    expect(resolved.sessionId).toBe(id);
    expect(fs.existsSync(getCompactionTimelineLedgerPath(id))).toBe(false);
  });

  it('账本损坏(条目 kind 越界)⇒ resume 必须响:resolveSession 抛错,不装成功', () => {
    const id = writeSessionFixture();
    writeLedger(id, [{ timelineId: 'tl_x', kind: 'bogus', atMs: 1 }]);

    expect(() => resolveSession({ resume: id })).toThrow(/malformed/);
    // 保守口径:失败时账本原样,未被半写。
    expect(readLedger(id)).toEqual([{ timelineId: 'tl_x', kind: 'bogus', atMs: 1 }]);
  });

  it('账本损坏(非法 JSON)⇒ 同上,异常沿调用点向上冒', () => {
    const id = writeSessionFixture();
    fs.writeFileSync(getCompactionTimelineLedgerPath(id), '{not json', 'utf-8');

    expect(() => resolveSession({ resume: id })).toThrow();
  });

  it('账本损坏(非数组)⇒ 同上', () => {
    const id = writeSessionFixture();
    fs.writeFileSync(getCompactionTimelineLedgerPath(id), '42', 'utf-8');

    expect(() => resolveSession({ resume: id })).toThrow(/not an array/);
  });
});

/**
 * H 顶层契约两格(与压缩账本无关,但复用同一份"真实入口 + 损坏账本"夹具):
 *
 * H1 结构化输出时 stdout 是数据通道(--json / --output-format json|markdown|yaml / 非 TTY)。
 *    恢复提示若走 console.info,会有一行人类文案插进 NDJSON 流 —— 消费方对整段 stdout 做
 *    JSON.parse 即失败,而 --json 的用户恰恰是脚本。
 * H2 顶层 async action 抛错必须落 exitCode=1。commander 的 parse() 不 await action 的
 *    Promise,拒绝变成 unhandledRejection,而 crash-handler 对 unhandledRejection 只记日志、
 *    不动 exitCode ⇒ `ihui --resume <账本损坏>` 这类失败以 0 退出,CI 读成成功。
 */
describe('H 顶层入口契约:结构化输出不污染 stdout / 失败退出码非 0', () => {
  let prevExitCode: number | string | undefined;

  beforeEach(() => {
    prevExitCode = process.exitCode;
  });

  afterEach(() => {
    // process.exitCode 是原型上的访问器,delete 会抛 TypeError;直接复位为 0(成功)
    process.exitCode =
      typeof prevExitCode === 'number' || typeof prevExitCode === 'string' ? prevExitCode : 0;
    vi.restoreAllMocks();
  });

  it('H1 结构化模式:恢复提示改道 stderr,stdout 一行都不许有', () => {
    const id = writeSessionFixture();
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const resolved = resolveSession({ resume: id }, true);

    expect(resolved.sessionId).toBe(id);
    expect(infoSpy).not.toHaveBeenCalled();
    // 只钉"恢复提示在 stderr":进程内可能有与本次断言无关的告警噪声,不按总次数判
    expect(errorSpy.mock.calls.some((c) => String(c[0]).includes(id))).toBe(true);
  });

  it('H2 文本模式维持原样:提示仍走 stdout(不得为了 --json 误伤交互用户)', () => {
    const id = writeSessionFixture();
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    resolveSession({ resume: id });

    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls.some((c) => String(c[0]).includes(id))).toBe(false);
  });

  it('H3 action 抛错(真实损坏账本)⇒ exitCode=1,且错误上屏而非静默', async () => {
    const id = writeSessionFixture();
    fs.writeFileSync(getCompactionTimelineLedgerPath(id), '{not json', 'utf-8');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    process.exitCode = 0;

    await settleCliEntryFailure(async () => {
      resolveSession({ resume: id }, true);
    });

    expect(process.exitCode).toBe(1);
    // 恢复提示发生在收敛之前 → 账本损坏时只有失败汇总这一条 stderr
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});

/**
 * I `--goal-criteria` 是纯旗标校验(读文件 + 校验结构),必须在**任何副作用之前**完成。
 *
 * 修前它被作为 runAgent 的参数表达式求值:那时 `createSession` 已写会话文件、权限租约已授、
 * 云运行已发出;`process.exit(2)` 又跳过 finally 里的租约撤销/云会话收尾,于是一次纯参数
 * 错误会留下半启动的现场。I1 用可阻断的 createSession 计数验顺序:修前 createCalls==1(红),
 * 修后 ==0。
 */
describe('I --goal-criteria 校验先于副作用', () => {
  it('I1 指标文件不存在 ⇒ exit 2,且一个会话都不许建', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw Object.assign(new Error('process.exit'), { exitCode: Number(code ?? 0) });
    }) as typeof process.exit);
    sessionCtl.blockCreate = true;
    sessionCtl.createCalls = 0;

    await expect(
      (async (): Promise<unknown> => {
        try {
          await runAgentAndExit(
            '任务',
            { goalCriteria: path.join(scratch as string, 'missing-criteria.json') } as unknown as Parameters<
              typeof runAgentAndExit
            >[1],
            false,
          );
          return null;
        } catch (e) {
          return e;
        }
      })().then((e) => {
        // 顺序判据先落:修前是"先建会话(1)后才校验",这里必须为 0
        expect(sessionCtl.createCalls).toBe(0);
        expect(e).toMatchObject({ exitCode: 2 });
      }),
    ).resolves.toBeUndefined();

    expect(sessionCtl.createCalls).toBe(0);
    expect(errSpy).toHaveBeenCalled();
    sessionCtl.blockCreate = false;
  });
});

/**
 * J T6/T7/T8:矛盾/非法参数必须共用**同一段**入口校验,且早于任何副作用(建会话即副作用代理)。
 * 修前这三种组合都是"静默择一"或悄悄回落 text:脚本拿到与预期不符的结果,退出码仍是 0。
 */
describe('J 入口参数互斥校验(T6/T7/T8)', () => {
  async function runInvalid(opts: Record<string, unknown>): Promise<unknown> {
    sessionCtl.blockCreate = true;
    sessionCtl.createCalls = 0;
    try {
      await runAgentAndExit(
        '任务',
        opts as unknown as Parameters<typeof runAgentAndExit>[1],
        false,
      );
      return null;
    } catch (e) {
      return e;
    }
  }

  it('T6 --continue 与 --resume 同给 ⇒ exitCode 2 且 0 会话', async () => {
    const err = await runInvalid({ continue: true, resume: 'sess-abc' });
    expect(err).toBeInstanceOf(CliUsageError);
    expect((err as CliUsageError).exitCode).toBe(2);
    expect((err as Error).message).toContain('--continue 与 --resume 互斥');
    expect(sessionCtl.createCalls).toBe(0);
    sessionCtl.blockCreate = false;
  });

  it('T7 --json 与 --output-format text 冲突 ⇒ exitCode 2 且 0 会话', async () => {
    const err = await runInvalid({ json: true, outputFormat: 'text' });
    expect(err).toBeInstanceOf(CliUsageError);
    expect((err as CliUsageError).exitCode).toBe(2);
    expect((err as Error).message).toContain('--json 与 --output-format text 冲突');
    expect(sessionCtl.createCalls).toBe(0);
    sessionCtl.blockCreate = false;
  });

  it('T8 非法 --output-format ⇒ exitCode 2,文案列出合法枚举,0 会话', async () => {
    const err = await runInvalid({ outputFormat: 'xml' });
    expect(err).toBeInstanceOf(CliUsageError);
    expect((err as CliUsageError).exitCode).toBe(2);
    expect((err as Error).message).toContain('text | json | markdown | yaml');
    expect(sessionCtl.createCalls).toBe(0);
    sessionCtl.blockCreate = false;
  });

  it('T6-T8 的退出码经 settleCliEntryFailure 落为 2(不是 0/1)', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await settleCliEntryFailure(() => Promise.reject(new CliUsageError('参数冲突')));
    expect(process.exitCode).toBe(2);
    // 纯参数错误打一行可读文案、不打栈(该文件有重试与其他用例噪声,只断言"存在正确那一行")
    const usageLines = errSpy.mock.calls.filter((c) => String(c[0]).includes('参数冲突'));
    expect(usageLines.length).toBeGreaterThan(0);
    expect(String(usageLines[0]![0])).not.toContain('    at ');
  });
});
