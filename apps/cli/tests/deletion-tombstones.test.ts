// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * deletion-tombstones.ts 行为钉子:立碑 / 迟到写守卫 / 清碑复活 / 批量查碑。
 * 临时目录隔离,不碰真实 ~/.ihui。
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { beforeEach, afterEach, describe, expect, it } from 'vitest';

import {
  markDeleted,
  isDeleted,
  assertNotDeleted,
  removeTombstone,
  filterDeleted,
  loadTombstones,
  DeletedResourceError,
} from '../src/acp/deletion-tombstones.js';

let tmpRoot: string;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tombstones-'));
  process.env.IHUI_CLI_TOMBSTONES_DIR = tmpRoot;
});

afterEach(() => {
  delete process.env.IHUI_CLI_TOMBSTONES_DIR;
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

const K = { scope: 'skill-evolution', type: 'suggestion', id: 's1' };

describe('markDeleted / isDeleted(立碑查碑)', () => {
  it('立碑后 isDeleted 为 true', () => {
    markDeleted(K);
    expect(isDeleted(K)).toBe(true);
    expect(loadTombstones()).toHaveLength(1);
  });

  it('未立碑 → isDeleted false', () => {
    expect(isDeleted(K)).toBe(false);
  });

  it('重复立同一碑 → 幂等,不重复', () => {
    markDeleted(K, 1000);
    markDeleted(K, 2000);
    expect(loadTombstones()).toHaveLength(1);
    expect(loadTombstones()[0]?.deletedAt).toBe(1000); // 首次时刻保留
  });

  it('不同 id / type / scope 各自独立', () => {
    markDeleted(K);
    markDeleted({ ...K, id: 's2' });
    markDeleted({ ...K, type: 'chain' });
    markDeleted({ ...K, scope: 'inbox' });
    expect(loadTombstones()).toHaveLength(4);
    expect(isDeleted({ ...K, id: 's3' })).toBe(false);
  });

  it('墓碑只存身份,不存正文(最小标记)', () => {
    markDeleted(K);
    const t = loadTombstones()[0];
    expect(Object.keys(t).sort()).toEqual(['deletedAt', 'id', 'scope', 'type']);
    expect(t).not.toHaveProperty('body');
    expect(t).not.toHaveProperty('content');
  });
});

describe('assertNotDeleted(迟到写守卫)', () => {
  it('未删 → 放行不抛', () => {
    expect(() => assertNotDeleted(K)).not.toThrow();
  });

  it('已删 → 抛 DeletedResourceError(对标 RAISE ABORT)', () => {
    markDeleted(K);
    expect(() => assertNotDeleted(K)).toThrow(DeletedResourceError);
    try {
      assertNotDeleted(K);
    } catch (e) {
      expect(e).toBeInstanceOf(DeletedResourceError);
      expect((e as DeletedResourceError).key).toEqual(K);
      expect((e as Error).message).toContain('s1');
    }
  });

  it('挡住复活竞态:删除后旧回调再写同一 id 被拒', () => {
    markDeleted(K);
    // 模拟一个迟到的写:先守卫再落盘(标准用法)
    const lateWrite = () => {
      assertNotDeleted(K); // 守卫
      return 'written';
    };
    expect(lateWrite).toThrow(DeletedResourceError);
  });
});

describe('removeTombstone(清碑复活)', () => {
  it('清碑后 isDeleted 变 false,可重建', () => {
    markDeleted(K);
    expect(removeTombstone(K)).toBe(true);
    expect(isDeleted(K)).toBe(false);
    expect(() => assertNotDeleted(K)).not.toThrow();
  });

  it('无墓碑时清碑 → false', () => {
    expect(removeTombstone(K)).toBe(false);
  });

  it('复活必须显式清碑:不清碑则重建写仍被拒', () => {
    markDeleted(K);
    // 不调 removeTombstone 直接尝试重建写 → 被拒
    expect(() => assertNotDeleted(K)).toThrow(DeletedResourceError);
    // 显式复活 → 清碑 → 重建写放行
    removeTombstone(K);
    expect(() => assertNotDeleted(K)).not.toThrow();
  });
});

describe('filterDeleted(批量查碑)', () => {
  it('返回已删的 key 子集', () => {
    markDeleted({ scope: 'a', type: 't', id: '1' });
    markDeleted({ scope: 'a', type: 't', id: '3' });
    const keys = [
      { scope: 'a', type: 't', id: '1' },
      { scope: 'a', type: 't', id: '2' },
      { scope: 'a', type: 't', id: '3' },
    ];
    const deleted = filterDeleted(keys);
    expect(deleted).toEqual([
      { scope: 'a', type: 't', id: '1' },
      { scope: 'a', type: 't', id: '3' },
    ]);
  });

  it('全未删 → 空数组', () => {
    expect(filterDeleted([K])).toEqual([]);
  });
});

describe('持久化与隔离', () => {
  it('跨 load 持久(写盘生效)', () => {
    markDeleted(K);
    expect(isDeleted(K)).toBe(true); // 重新读同一文件
    expect(fs.existsSync(path.join(tmpRoot, 'tombstones.json'))).toBe(true);
  });

  it('空/损坏存储 → 回落空态不抛', () => {
    expect(loadTombstones()).toEqual([]);
    fs.writeFileSync(path.join(tmpRoot, 'tombstones.json'), '{broken', 'utf8');
    expect(loadTombstones()).toEqual([]);
    expect(isDeleted(K)).toBe(false);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
