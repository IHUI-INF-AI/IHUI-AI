// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍​‌​‌​​​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍‌‌​​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍‌​‌​​​​‍‍​‌​​​​​‌‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌‌​⁠

/**
 * BUG-0010:CLI 会话状态裸写非原子。
 *
 * 用真实 `saveSession` 做大状态文件写者(数千条 message ≈ 数百 KB),另一个 worker 线程高频
 * `readFileSync`,统计"非空但不是任一完整快照"(JSON 解析失败 / 结构缺字段)的 torn 读数。
 * 裸 `writeFileSync` 的改前读数由同一探针实测记录在提交说明;本文件钉住改后 = 0,并钉住
 * rename 失败分支:目标保持旧内容、不残留 tmp、抛可识别 AtomicReplaceFailedError(绝不静默)。
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { AtomicReplaceFailedError, writeFileAtomicSync } from '../src/util/atomic-write.js';
import { getSessionStatePath, saveSession } from '../src/sessions/state-store.js';
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28

const HERE = path.dirname(fileURLToPath(import.meta.url));

const MESSAGE_COUNT = 3000;

const READER_SOURCE = String.raw`
const fs = require('node:fs');
const { parentPort, workerData } = require('node:worker_threads');
const { file, durationMs, messageCount } = workerData;
const deadline = Date.now() + durationMs;
const tick = new Int32Array(new SharedArrayBuffer(4));
let reads = 0;
let emptyReads = 0;
let torn = 0;
let complete = 0;
while (Date.now() < deadline) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  reads += 1;
  if (raw.length === 0) {
    emptyReads += 1;
    continue;
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.id === 'string' && Array.isArray(parsed.messages) && parsed.messages.length === messageCount) {
      complete += 1;
    } else {
      torn += 1;
    }
  } catch {
    torn += 1;
  }
  // 读句柄释放后再让写者继续:与真实读者同形(每次读完即关)。
  // 15ms 间隔 ≈ 60 次/秒的高频读,又不至于"永远有句柄打开"把 Windows rename 压成必失败
  // (那不是半截读,是句柄争用;Python 侧同一现象同样靠有界重试,见 atomic_io.py)。
  Atomics.wait(tick, 0, 0, 15);
}
parentPort.postMessage({ reads, emptyReads, torn, complete });
`;

let CWD = '';
let prevStateDir: string | undefined;
let prevPrune: string | undefined;

beforeAll(() => {
  CWD = mkScratch('session-state-atomic-write-');
  prevStateDir = process.env.IHUI_SESSION_STATE_DIR;
  prevPrune = process.env.IHUI_SESSION_PRUNE_DISABLED;
  process.env.IHUI_SESSION_STATE_DIR = CWD;
  process.env.IHUI_SESSION_PRUNE_DISABLED = '1';
});

afterAll(() => {
  if (prevStateDir === undefined) delete process.env.IHUI_SESSION_STATE_DIR;
  else process.env.IHUI_SESSION_STATE_DIR = prevStateDir;
  if (prevPrune === undefined) delete process.env.IHUI_SESSION_PRUNE_DISABLED;
  else process.env.IHUI_SESSION_PRUNE_DISABLED = prevPrune;
  try {
    rmScratch(CWD);
  } catch (err) {
    console.warn(`[session-state-atomic-write] 夹具目录清理失败(忽略,不影响判定): ${String(err)}`);
  }
});

function makeBigState(id: string): any {
  return {
    id,
    sessionId: id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    status: 'running',
    messages: Array.from({ length: MESSAGE_COUNT }, (_, i) => ({
      role: 'user',
      content: `row-${i}-` + 'x'.repeat(120),
    })),
  };
}

function runReader(file: string, durationMs: number): Promise<{
  reads: number;
  emptyReads: number;
  torn: number;
  complete: number;
}> {
  const workerFile = path.join(CWD, 'half-read-reader.cjs');
  fs.writeFileSync(workerFile, READER_SOURCE);
  const worker = new Worker(workerFile, {
    workerData: { file, durationMs, messageCount: MESSAGE_COUNT },
  });
  return new Promise((resolve, reject) => {
    worker.once('message', (msg) => resolve(msg));
    worker.once('error', reject);
  });
}

describe('BUG-0010 会话状态原子写', () => {
  it('半截读探针:并发读写期间 torn=0、空读=0', async () => {
    const id = 'probe-session';
    const state = makeBigState(id);
    saveSession(state);
    const target = getSessionStatePath(id);

    const reading = runReader(target, 4000);
    for (let i = 0; i < 100; i++) {
      state.messages[i % MESSAGE_COUNT].content = `seq-${i}-` + 'y'.repeat(120);
      state.updatedAt = new Date(Date.UTC(2026, 0, 1, 0, 0, 0, i)).toISOString();
      saveSession(state);
    }

    const result = await reading;
    expect(result.reads).toBeGreaterThan(0);
    expect(result.complete).toBeGreaterThan(0);
    expect(result.torn).toBe(0);
    expect(result.emptyReads).toBe(0);
    expect(JSON.parse(fs.readFileSync(target, 'utf-8')).messages[0].content).toBe(
      'seq-0-' + 'y'.repeat(120),
    );
  });

  it('rename 被 EPERM 打穿:目标保持旧内容、无半截 tmp、抛可识别错误', () => {
    const f = path.join(CWD, 'rename-fail.json');
    fs.writeFileSync(f, 'OLD', 'utf-8');
    let caught: unknown = null;
    try {
      writeFileAtomicSync(f, 'NEW', {
        backoffMs: [],
        sleep: () => {},
        rename: () => {
          const e = new Error('EPERM: operation not permitted, rename') as NodeJS.ErrnoException;
          e.code = 'EPERM';
          throw e;
        },
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AtomicReplaceFailedError);
    expect((caught as AtomicReplaceFailedError).code).toBe('atomic_replace_failed');
    expect((caught as AtomicReplaceFailedError).attempts).toBe(1);
    expect(fs.readFileSync(f, 'utf-8')).toBe('OLD');
    expect(fs.readdirSync(CWD).filter((n) => n.includes('.rename-fail.json.tmp-'))).toEqual([]);
  });

  it('EPERM 有界重试:前两次失败、第三次 succeeds,且不留 tmp', () => {
    const f = path.join(CWD, 'rename-retry.json');
    fs.writeFileSync(f, 'OLD', 'utf-8');
    let attempts = 0;
    writeFileAtomicSync(f, 'NEW', {
      backoffMs: [0, 0, 0],
      sleep: () => {},
      rename: (tmp, abs) => {
        attempts += 1;
        if (attempts < 3) {
          const e = new Error('EPERM: operation not permitted, rename') as NodeJS.ErrnoException;
          e.code = 'EPERM';
          throw e;
        }
        fs.renameSync(tmp, abs);
      },
    });
    expect(attempts).toBe(3);
    expect(fs.readFileSync(f, 'utf-8')).toBe('NEW');
    expect(fs.readdirSync(CWD).filter((n) => n.includes('.rename-retry.json.tmp-'))).toEqual([]);
  });

  it('会话/检查点状态写点不再裸用 fs.writeFileSync', () => {
    const fixed = [
      'src/sessions/state-store.ts',
      'src/subagents/state-store.ts',
      'src/commands/session.ts',
      'src/checkpoints/index.ts',
      // hunks.ts 的 writeLines 写的是被恢复的工作区文件,不是状态,故不在此列
      'src/compaction-timeline-resume.ts',
    ];
    for (const rel of fixed) {
      const src = fs.readFileSync(path.join(HERE, '..', rel), 'utf-8');
      expect(src, `${rel} 仍存在裸 fs.writeFileSync`).not.toMatch(/fs\.writeFileSync\(/);
    }
  });
});
