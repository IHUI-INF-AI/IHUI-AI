// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 8 档事件派发点 · 第三笔接线(2026-10-31):instructionsLoaded 与 teammateIdle 两档
 * 从"载荷契约齐、无人派发"变成**真派发**;cwdChanged / setup / elicitation 三档的裁决
 * 也在本册留机器可查的证据。判四格:
 *
 *  ① instructionsLoaded —— 全仓唯一 AGENTS.md 装载链(agent.ts 的 readAgentsMd,CLI 直连与
 *     REPL 都经 setupAgentTools 走到它)。**装载成功**才派发一次,载荷 = 工作区 + 指令文件路径;
 *     文件不存在 / 读不动 / 内容空或纯空白 ⇒ **一条都不派**("没发生的事不许报成事件")。
 *  ② teammateIdle —— worker-pool 的空闲转后台跃迁。两条入口(无活动计时器、绝对上限到点)
 *     共用 detachToBackground,而派发**恰好一次**:第二次进入被幂等闸挡在派发之前。
 *     载荷只带标识,不带任务正文(断言键集就这两个)。
 *  ③ 信任清单路径单源(AGENTS §0.6)—— 取值实现全仓只剩 trust.ts 一份,configChange 载荷
 *     引用它而不是自己再拼一次。
 *  ④ cwdChanged 的结构性裁决 —— 本仓 CLI 单进程、从不切工作目录(`process.chdir` 在
 *     apps/cli/src 零命中),故该档**没有事件源**;本册把这条事实钉成判据,免得下一笔
 *     为了"把枚举用满"硬造一个定时器出来。
 *
 * 运行链全走 spy(不真跑钩子进程、不真起子进程):本册判的是**派发**,执行面见
 * hook-async-rewake / hooks-trust-* 各册。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const runHookSpy = vi.hoisted(() =>
  vi.fn<(event: string, ctx: Record<string, unknown>) => Promise<{ proceed: boolean }>>(
    async () => ({ proceed: true }),
  ),
);

vi.mock('../src/hooks/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/hooks/index.js')>();
  return { ...actual, runHook: runHookSpy };
});

// fork 换成 EventEmitter:转后台判据靠计时器,不靠真子进程
const fakes = vi.hoisted(() => ({ procs: [] as ChildProcess[] }));

vi.mock('node:child_process', async (importOriginal) => {
  // 保留其余真实导出:agent.ts 的模块图里还有别的子进程调用等待真实实现
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    fork: (): ChildProcess => {
      const proc = new EventEmitter() as EventEmitter & Partial<ChildProcess>;
      proc.pid = 424_300 + fakes.procs.length;
      proc.send = vi.fn(() => true);
      proc.kill = vi.fn(() => true);
      proc.stdout = new EventEmitter();
      proc.stderr = new EventEmitter();
      const full = proc as unknown as ChildProcess;
      fakes.procs.push(full);
      return full;
    },
  };
});

import { readAgentsMd } from '../src/commands/agent.js';
import {
  SubagentWorkerPool,
  defaultWorkerPoolConfig,
  SUBAGENT_IDLE_TIMEOUT_ENV,
} from '../src/subagents/worker-pool.js';
import { TRUSTED_FOLDERS_PATH } from '../src/hooks/trust.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const cliSrc = path.join(here, '../src');

/** 按事件名筛本次派发(同一测试里两种事件都会经过同一个 spy) */
function callsOf(event: string): Array<Record<string, unknown>> {
  return runHookSpy.mock.calls.filter((c) => c[0] === event).map((c) => c[1]);
}

/** 在临时工作区里造一个 AGENTS.md(内容按入参;空串 = 真创建一个空文件) */
function makeWorkspace(label: string, agentsMd?: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `ihui-instr-${label}-`));
  if (agentsMd !== undefined) fs.writeFileSync(path.join(dir, 'AGENTS.md'), agentsMd, 'utf-8');
  return dir;
}

const tmpDirs: string[] = [];
function trackedWorkspace(label: string, agentsMd?: string): string {
  const dir = makeWorkspace(label, agentsMd);
  tmpDirs.push(dir);
  return dir;
}

// 派发计数必须逐用例从零起算:spy 跨用例累积会让"恰好一次"的断言变成"恰好这次新来一次"
beforeEach(() => {
  runHookSpy.mockClear();
});

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

// ───────────────────────── ① instructionsLoaded ─────────────────────────

describe('① instructionsLoaded:装载成功才派发,且恰好一次', () => {
  it('AGENTS.md 有内容 ⇒ 派发一次,载荷带工作区与指令文件绝对路径', () => {
    const ws = trackedWorkspace('ok', '# 指令\n遵守仓库规矩\n');
    const content = readAgentsMd(ws);

    // 返回值必须逐字与改动前一致(真装载面零变化)
    expect(content).toBe('# 指令\n遵守仓库规矩\n');
    const calls = callsOf('instructionsLoaded');
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      workspacePath: ws,
      instructionsPath: path.join(ws, 'AGENTS.md'),
    });
  });

  it('文件不存在 ⇒ 不派发(没装载过的指令不许报成已装载)', () => {
    const ws = trackedWorkspace('absent');
    expect(readAgentsMd(ws)).toBeUndefined();
    expect(callsOf('instructionsLoaded')).toHaveLength(0);
  });

  it('空文件 / 纯空白 ⇒ 不派发', () => {
    const empty = trackedWorkspace('empty', '');
    const blank = trackedWorkspace('blank', '  \n\t\r\n');
    expect(readAgentsMd(empty)).toBe('');
    expect(readAgentsMd(blank)).toBe('  \n\t\r\n');
    expect(callsOf('instructionsLoaded')).toHaveLength(0);
  });

  it('读不动(同名目录)⇒ 不派发,返回 undefined,且不抛穿调用方', () => {
    const ws = trackedWorkspace('unreadable');
    fs.mkdirSync(path.join(ws, 'AGENTS.md'));
    expect(readAgentsMd(ws)).toBeUndefined();
    expect(callsOf('instructionsLoaded')).toHaveLength(0);
  });
});

// ───────────────────────── ② teammateIdle ─────────────────────────

function lastProc(): ChildProcess {
  const p = fakes.procs[fakes.procs.length - 1];
  if (!p) throw new Error('fork mock 未收到 fork 调用');
  return p;
}

function heartbeat(proc: ChildProcess): void {
  proc.emit('message', { type: 'heartbeat', rss: 50_000_000 });
}

/** 真实任务活动:stdout NDJSON,与 worker-entry 的 message_delta 同形(会重排空闲窗) */
function taskOutput(proc: ChildProcess, text: string): void {
  proc.stdout?.emit('data', Buffer.from(JSON.stringify({ type: 'message_delta', message: text }) + '\n'));
}

describe('② teammateIdle:跃迁成功派发一次,两条入口合计仍是一次', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    delete process.env[SUBAGENT_IDLE_TIMEOUT_ENV];
    fakes.procs.length = 0;
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    vi.useRealTimers();
    delete process.env[SUBAGENT_IDLE_TIMEOUT_ENV];
  });

  it('无活动超阈转后台 ⇒ 恰好一次,载荷只带子代理标识(无正文/无凭据)', async () => {
    const pool = new SubagentWorkerPool(
      defaultWorkerPoolConfig({ maxWorkers: 1, taskTimeoutSeconds: 3600 }),
    );
    const spawnP = pool.spawn({ persona: 'coder', task: '挂住等超时' });
    const proc = lastProc();
    taskOutput(proc, '开工');
    heartbeat(proc);

    // 150s > 默认空闲窗 120s:此后只剩心跳,没有任何任务事件
    for (let i = 0; i < 15; i++) {
      await vi.advanceTimersByTimeAsync(10_000);
      heartbeat(proc);
    }

    const calls = callsOf('teammateIdle');
    expect(calls).toHaveLength(1);
    const id = pool.activeSubagentIds()[0]!;
    expect(calls[0]).toEqual({ subagentId: id, teammateId: id });
    // 键集锁:载荷里多一个任务正文/提示词字段就会在这里翻红
    expect(Object.keys(calls[0]!).sort()).toEqual(['subagentId', 'teammateId']);

    proc.emit('exit', 0, null);
    await spawnP;
  });

  it('转后台之后继续跑(心跳不断、计时器继续轮询)⇒ 不重复派发', async () => {
    const pool = new SubagentWorkerPool(
      defaultWorkerPoolConfig({ maxWorkers: 1, taskTimeoutSeconds: 3600 }),
    );
    const spawnP = pool.spawn({ persona: 'coder', task: '转后台后长期在跑' });
    const proc = lastProc();
    taskOutput(proc, '开工');

    // 先走空闲档:130s 无任务事件(心跳照发,证明进程还活着)
    for (let i = 0; i < 13; i++) {
      await vi.advanceTimersByTimeAsync(10_000);
      heartbeat(proc);
    }
    expect(callsOf('teammateIdle')).toHaveLength(1);

    // 转后台后又跑了 300s:5s 轮询仍在调 checkIdleTimeout,幂等闸(而不是调用方自觉)
    // 保证这一段期间一条都不再派
    for (let i = 0; i < 30; i++) {
      await vi.advanceTimersByTimeAsync(10_000);
      heartbeat(proc);
    }
    expect(callsOf('teammateIdle')).toHaveLength(1);

    proc.emit('exit', 0, null);
    await spawnP;
  });

  it('绝对上限档先到(始终有活动)⇒ 同一次跃迁也只派发一次', async () => {
    const pool = new SubagentWorkerPool(
      defaultWorkerPoolConfig({ maxWorkers: 1, taskTimeoutSeconds: 60 }),
    );
    const spawnP = pool.spawn({ persona: 'coder', task: '一直有活动直到总上限' });
    const proc = lastProc();

    // 每 10s 都有任务事件(空闲窗一直重排),因此只可能被 60s × 3 = 180s 的总上限收口
    for (let i = 0; i < 20; i++) {
      await vi.advanceTimersByTimeAsync(10_000);
      heartbeat(proc);
      taskOutput(proc, `tick${i}`);
    }
    // 再推一段:幂等闸保证不再有第二次
    for (let i = 0; i < 10; i++) {
      await vi.advanceTimersByTimeAsync(10_000);
      heartbeat(proc);
    }

    expect(callsOf('teammateIdle')).toHaveLength(1);
    expect(pool.getLifecycleStatus(pool.activeSubagentIds()[0]!)).toBe('detached_idle');

    proc.emit('exit', 0, null);
    await spawnP;
  });
});

// ───────────────────── ③ 信任清单路径单源(§0.6) ─────────────────────

describe('③ 信任清单路径:取值实现全仓一份,configChange 载荷引用它', () => {
  it('导出值与被写的那份清单逐字相同', () => {
    expect(TRUSTED_FOLDERS_PATH).toBe(path.join(os.homedir(), '.ihui', 'trusted-folders'));
  });

  it('全仓 cli 源码里"拼出该路径"的赋值只出现一次(trust.ts)', () => {
    const builder = /=\s*join\(homedir\(\),\s*'\.ihui',\s*'trusted-folders'\)/;
    const hits: string[] = [];
    const walk = (dir: string): void => {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) walk(p);
        else if (ent.name.endsWith('.ts')) {
          for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
            if (builder.test(line)) hits.push(path.relative(cliSrc, p).replace(/\\/g, '/'));
          }
        }
      }
    };
    walk(cliSrc);
    expect(hits).toEqual(['hooks/trust.ts']);
  });

  it('configChange 派发口引用该导出,不再自带一份路径示值', () => {
    const src = fs.readFileSync(path.join(cliSrc, 'commands/hooks.ts'), 'utf-8');
    expect(src).toContain('configPath: TRUSTED_FOLDERS_PATH');
    expect(src).toContain('TRUSTED_FOLDERS_PATH,');
    expect(src).not.toContain('TRUST_LEDGER_PATH_FOR_PAYLOAD');
  });

  it('trust.ts 读写面的默认落点仍是这一个常量(4 处 ?? 回落未变)', () => {
    const src = fs.readFileSync(path.join(cliSrc, 'hooks/trust.ts'), 'utf-8');
    const fallbacks = src.split('?? TRUSTED_FOLDERS_PATH').length - 1;
    expect(fallbacks).toBe(4);
  });
});

// ─────────────── ④ cwdChanged 等档的结构性裁决(反向取证) ───────────────

describe('④ 未接档的裁决:证据钉在源码面上', () => {
  it("cwdChanged 无事件源:apps/cli/src 全树 process.chdir 零命中", () => {
    const hits: string[] = [];
    const walk = (dir: string): void => {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) walk(p);
        else if (ent.name.endsWith('.ts')) {
          const text = fs.readFileSync(p, 'utf-8');
          if (text.includes('process.chdir')) hits.push(path.relative(cliSrc, p).replace(/\\/g, '/'));
        }
      }
    };
    walk(cliSrc);
    expect(hits).toEqual([]);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
