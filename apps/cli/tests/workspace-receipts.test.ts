// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * workspace-receipts.ts 行为钉子:幂等 / 防漂移 / 过期三重语义。
 * 临时目录隔离,不碰真实 ~/.ihui。
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { beforeEach, afterEach, describe, expect, it } from 'vitest';

import {
  commandInputHash,
  ensureReceipt,
  registerReceipt,
  recordResult,
  findReceipt,
  purgeExpired,
  loadReceipts,
  DEFAULT_RECEIPT_TTL_MS,
} from '../src/acp/workspace-receipts.js';

let tmpRoot: string;
let storeDir: string;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-receipts-'));
  storeDir = path.join(tmpRoot, 'store');
  fs.mkdirSync(storeDir, { recursive: true });
  process.env.IHUI_CLI_WS_RECEIPTS_DIR = storeDir;
});

afterEach(() => {
  delete process.env.IHUI_CLI_WS_RECEIPTS_DIR;
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

const ARGS = {
  principalId: 'user-1',
  requestId: 'req-1',
  operation: 'update' as const,
  workspaceId: 'ws-A',
  payload: { name: 'demo', tags: ['x', 'y'] },
};

describe('commandInputHash(稳定指纹)', () => {
  it('同语义入参 → 同指纹', () => {
    const a = commandInputHash({ operation: 'update', workspaceId: 'ws', payload: { a: 1, b: 2 } });
    const b = commandInputHash({ operation: 'update', workspaceId: 'ws', payload: { b: 2, a: 1 } });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('键序无关(剔 undefined);内容变则指纹变', () => {
    const a = commandInputHash({ operation: 'create', workspaceId: 'w', payload: { x: 1, z: undefined } });
    const b = commandInputHash({ operation: 'create', workspaceId: 'w', payload: { x: 1 } });
    expect(a).toBe(b); // undefined 被剔
    const c = commandInputHash({ operation: 'create', workspaceId: 'w', payload: { x: 2 } });
    expect(c).not.toBe(b);
  });
});

describe('ensureReceipt 三重语义', () => {
  it('首次 → execute', () => {
    expect(ensureReceipt(ARGS)).toMatchObject({ kind: 'execute' });
  });

  it('登记后同入参重放 → idempotent(幂等返回缓存)', () => {
    registerReceipt({ ...ARGS, ttlMs: DEFAULT_RECEIPT_TTL_MS, now: 0 });
    recordResult('user-1', 'req-1', '{"ok":true}', 10);
    const d = ensureReceipt({ ...ARGS, now: 100 });
    expect(d.kind).toBe('idempotent');
    if (d.kind === 'idempotent') {
      expect(d.receipt.resultJson).toBe('{"ok":true}');
    }
  });

  it('同 request_id 换内容 → conflict(防偷换)', () => {
    registerReceipt({ ...ARGS, ttlMs: DEFAULT_RECEIPT_TTL_MS, now: 0 });
    const d = ensureReceipt({
      ...ARGS,
      payload: { name: 'EVIL', tags: ['x', 'y'] }, // 内容变了
      now: 100,
    });
    expect(d.kind).toBe('conflict');
  });

  it('operation/workspaceId 变 → 也算 conflict(inputHash 变)', () => {
    registerReceipt({ ...ARGS, ttlMs: DEFAULT_RECEIPT_TTL_MS, now: 0 });
    expect(ensureReceipt({ ...ARGS, operation: 'delete', now: 100 }).kind).toBe('conflict');
    expect(ensureReceipt({ ...ARGS, workspaceId: 'ws-B', now: 100 }).kind).toBe('conflict');
  });

  it('过期 → expired(旧回执失效,允许重跑)', () => {
    registerReceipt({ ...ARGS, ttlMs: 1000, now: 0 });
    const d = ensureReceipt({ ...ARGS, now: 5000 });
    expect(d.kind).toBe('expired');
  });
});

describe('registerReceipt / recordResult / findReceipt', () => {
  it('register 后可按主键查到', () => {
    registerReceipt({ ...ARGS, now: 0 });
    const r = findReceipt('user-1', 'req-1');
    expect(r).toBeDefined();
    expect(r?.operation).toBe('update');
    expect(r?.workspaceId).toBe('ws-A');
    // now=0 + 默认 TTL 24h
    expect(r?.expiresAt).toBe((r?.createdAt ?? 0) + DEFAULT_RECEIPT_TTL_MS);
  });

  it('expiresAt = createdAt + ttl', () => {
    registerReceipt({ ...ARGS, now: 1000, ttlMs: 5000 });
    const r = findReceipt('user-1', 'req-1');
    expect(r?.createdAt).toBe(1000);
    expect(r?.expiresAt).toBe(6000);
  });

  it('recordResult 写入 resultJson 并刷 updatedAt', () => {
    registerReceipt({ ...ARGS, now: 0 });
    const updated = recordResult('user-1', 'req-1', '{"done":1}', 500);
    expect(updated?.resultJson).toBe('{"done":1}');
    expect(updated?.updatedAt).toBe(500);
  });

  it('recordResult 找不到主键 → undefined', () => {
    expect(recordResult('ghost', 'nope', '{}', 0)).toBeUndefined();
  });

  it('同主键重复 register → 覆盖(单写者语义)', () => {
    registerReceipt({ ...ARGS, now: 0 });
    registerReceipt({ ...ARGS, now: 9999 });
    expect(findReceipt('user-1', 'req-1')?.createdAt).toBe(9999);
    expect(loadReceipts()).toHaveLength(1);
  });

  it('不同主键 → 各自独立回执', () => {
    registerReceipt({ ...ARGS, now: 0 });
    registerReceipt({ ...ARGS, requestId: 'req-2', now: 0 });
    registerReceipt({ ...ARGS, principalId: 'user-2', now: 0 });
    expect(loadReceipts()).toHaveLength(3);
  });
});

describe('purgeExpired', () => {
  it('只清过期,不动有效回执', () => {
    registerReceipt({ ...ARGS, requestId: 'r-old', ttlMs: 1000, now: 0 }); // 过期
    registerReceipt({ ...ARGS, requestId: 'r-new', ttlMs: 99999, now: 0 }); // 有效
    const reclaimed = purgeExpired(5000);
    expect(reclaimed).toBe(1);
    expect(findReceipt('user-1', 'r-old')).toBeUndefined();
    expect(findReceipt('user-1', 'r-new')).toBeDefined();
  });

  it('无过期 → 返回 0,不动任何回执', () => {
    registerReceipt({ ...ARGS, ttlMs: 99999, now: 0 });
    expect(purgeExpired(1000)).toBe(0);
    expect(loadReceipts()).toHaveLength(1);
  });
});

describe('持久化与隔离', () => {
  it('回执跨 loadReceipts 调用持久(写盘生效)', () => {
    registerReceipt({ ...ARGS, now: 0 });
    // 重新 load(模拟新进程读同一文件)
    expect(findReceipt('user-1', 'req-1')).toBeDefined();
    expect(fs.existsSync(path.join(storeDir, 'command-receipts.json'))).toBe(true);
  });

  it('空/损坏存储 → 回落空态不抛', () => {
    expect(loadReceipts()).toEqual([]);
    // 写个坏 JSON
    fs.writeFileSync(path.join(storeDir, 'command-receipts.json'), '{broken', 'utf8');
    expect(loadReceipts()).toEqual([]);
    expect(findReceipt('user-1', 'req-1')).toBeUndefined();
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
