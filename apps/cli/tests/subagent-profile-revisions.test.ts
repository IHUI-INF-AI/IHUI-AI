// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * subagent-profile-revisions.ts 行为钉子:不可变版本链 / 幂等复用 / 锁版执行。
 * 临时目录隔离,不碰真实 ~/.ihui。
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { beforeEach, afterEach, describe, expect, it } from 'vitest';

import {
  commitRevision,
  loadChain,
  latestRevision,
  revisionAt,
  revisionById,
  withLockedRevision,
} from '../src/acp/subagent-profile-revisions.js';

let tmpRoot: string;
let storeDir: string;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'profile-rev-'));
  storeDir = path.join(tmpRoot, 'store');
  fs.mkdirSync(storeDir, { recursive: true });
  process.env.IHUI_CLI_PROFILE_REVISIONS_DIR = storeDir;
});

afterEach(() => {
  delete process.env.IHUI_CLI_PROFILE_REVISIONS_DIR;
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

const CFG = { role: 'researcher', allowedTools: ['read_file', 'grep'], maxTurns: 10 };

describe('commitRevision(建版 + 幂等)', () => {
  it('首次提交 → revision 1, created=true', () => {
    const r = commitRevision({ chainId: 'p1', snapshot: CFG });
    expect(r.created).toBe(true);
    expect(r.revision.revision).toBe(1);
    expect(r.revision.revisionId).toBe('p1@r1');
  });

  it('快照未变再提交 → created=false,复用同一版(不刷版本号)', () => {
    commitRevision({ chainId: 'p1', snapshot: CFG, now: 1000 });
    const again = commitRevision({ chainId: 'p1', snapshot: CFG, now: 2000 });
    expect(again.created).toBe(false);
    expect(again.revision.revision).toBe(1);
    expect(latestRevision('p1')?.revision).toBe(1);
  });

  it('快照变了 → 新版,revision 单调递增', () => {
    commitRevision({ chainId: 'p1', snapshot: CFG, now: 1000 });
    const changed = commitRevision(
      { chainId: 'p1', snapshot: { ...CFG, maxTurns: 20 }, now: 2000 },
    );
    expect(changed.created).toBe(true);
    expect(changed.revision.revision).toBe(2);
    expect(latestRevision('p1')?.revision).toBe(2);
    expect(revisionAt('p1', 1)?.snapshotJson).toContain('"maxTurns":10');
    expect(revisionAt('p1', 2)?.snapshotJson).toContain('"maxTurns":20');
  });

  it('已写入的 revision 永不修改(不可变)', () => {
    commitRevision({ chainId: 'p1', snapshot: { v: 1 }, now: 1000 });
    const r1Before = revisionAt('p1', 1);
    commitRevision({ chainId: 'p1', snapshot: { v: 2 }, now: 2000 });
    const r1After = revisionAt('p1', 1);
    expect(r1After).toEqual(r1Before); // 旧版原封不动
  });

  it('键序无关:同语义对象 → 同 snapshotJson(幂等)', () => {
    commitRevision({ chainId: 'p1', snapshot: { a: 1, b: 2 }, now: 1000 });
    const again = commitRevision({ chainId: 'p1', snapshot: { b: 2, a: 1 }, now: 2000 });
    expect(again.created).toBe(false);
  });

  it('不同 chainId 各自独立链', () => {
    commitRevision({ chainId: 'p1', snapshot: CFG, now: 1000 });
    commitRevision({ chainId: 'p2', snapshot: CFG, now: 1000 });
    expect(loadChain('p1').revisions).toHaveLength(1);
    expect(loadChain('p2').revisions).toHaveLength(1);
    expect(revisionById('p2@r1')?.chainId).toBe('p2');
  });
});

describe('latestRevision / revisionAt / revisionById', () => {
  it('空链 → latest undefined', () => {
    expect(latestRevision('empty')).toBeUndefined();
  });

  it('revisionAt 取指定版本,越界 → undefined', () => {
    commitRevision({ chainId: 'p1', snapshot: { v: 1 }, now: 1000 });
    commitRevision({ chainId: 'p1', snapshot: { v: 2 }, now: 2000 });
    expect(revisionAt('p1', 1)?.snapshotJson).toContain('"v":1');
    expect(revisionAt('p1', 99)).toBeUndefined();
  });

  it('revisionById 跨链精确取,解析错 → undefined', () => {
    commitRevision({ chainId: 'p1', snapshot: { v: 1 }, now: 1000 });
    expect(revisionById('p1@r1')?.revision).toBe(1);
    expect(revisionById('p1@r99')).toBeUndefined(); // 版本不存在
    expect(revisionById('ghost@r1')).toBeUndefined(); // 链不存在
    expect(revisionById('no-at-sign')).toBeUndefined(); // 无 @r 分隔
    expect(revisionById('p1@r0')).toBeUndefined(); // revision 必须 > 0
  });
});

describe('withLockedRevision(锁版执行)', () => {
  it('fn 收到的是锁定版快照(从 snapshotJson 反序列化)', () => {
    const out = withLockedRevision({
      chainId: 'p1',
      snapshot: CFG,
      fn: (config, revisionId) => {
        const c = config as typeof CFG;
        return { role: c.role, revisionId, tools: c.allowedTools.length };
      },
    });
    expect(out.revisionId).toBe('p1@r1');
    expect(out.revision).toBe(1);
    expect(out.result.role).toBe('researcher');
    expect(out.result.tools).toBe(2);
  });

  it('锁版后配置即使"被改",历史执行仍指向当时那版', () => {
    const run1 = withLockedRevision({
      chainId: 'p1', snapshot: { v: 1 },
      fn: (_c, rid) => rid,
    });
    // 配置被改(模拟 profile 演进)
    const run2 = withLockedRevision({
      chainId: 'p1', snapshot: { v: 2 },
      fn: (_c, rid) => rid,
    });
    expect(run1.revisionId).toBe('p1@r1');
    expect(run2.revisionId).toBe('p1@r2');
    // 旧版仍可精确回放
    expect(revisionById(run1.revisionId)?.snapshotJson).toContain('"v":1');
  });

  it('幂等快照 → 连续两次锁版用同一 revisionId(无版本噪声)', () => {
    const a = withLockedRevision({ chainId: 'p1', snapshot: CFG, fn: (_c, rid) => rid });
    const b = withLockedRevision({ chainId: 'p1', snapshot: CFG, fn: (_c, rid) => rid });
    expect(a.revisionId).toBe(b.revisionId);
    expect(a.revision).toBe(1);
    expect(b.revision).toBe(1);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
