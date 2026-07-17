/**
 * HunkTracker 测试 — Agent/External attribution + 多 subagent 冲突检测
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HunkTracker } from '../src/checkpoints/hunk-tracker.js';

describe('HunkTracker', () => {
  let nowMs: number;
  let realDateNow: () => number;

  beforeEach(() => {
    realDateNow = Date.now;
    nowMs = 1_000_000;
    Date.now = () => nowMs;
  });

  afterEach(() => {
    Date.now = realDateNow;
  });

  function tick(ms: number): void {
    nowMs += ms;
  }

  describe('recordAgentChange / recordExternalChange', () => {
    it('记录 agent 改动', () => {
      const t = new HunkTracker();
      t.recordAgentChange('a.ts', 10, 20, 'agent-1', 'hello');
      const hist = t.getHistory('a.ts');
      expect(hist).toHaveLength(1);
      const h = hist[0]!;
      expect(h.source).toBe('agent');
      expect(h.agentId).toBe('agent-1');
      expect(h.startLine).toBe(10);
      expect(h.endLine).toBe(20);
      expect(h.content).toBe('hello');
      expect(h.id).toMatch(/^hunk_/);
    });

    it('记录 external 改动', () => {
      const t = new HunkTracker();
      t.recordExternalChange('a.ts', 5, 8, 'user edit');
      const hist = t.getHistory('a.ts');
      expect(hist).toHaveLength(1);
      expect(hist[0]!.source).toBe('external');
      expect(hist[0]!.agentId).toBeUndefined();
      expect(hist[0]!.content).toBe('user edit');
    });

    it('content 超过 200 字符时截断', () => {
      const t = new HunkTracker();
      const long = 'x'.repeat(500);
      t.recordAgentChange('a.ts', 1, 1, 'a', long);
      const h = t.getHistory('a.ts')[0]!;
      expect(h.content).toHaveLength(200);
      expect(h.content).toBe('x'.repeat(200));
    });

    it('非法行范围抛错', () => {
      const t = new HunkTracker();
      expect(() => t.recordAgentChange('a.ts', 0, 1, 'a')).toThrow('非法');
      expect(() => t.recordAgentChange('a.ts', 5, 3, 'a')).toThrow('非法');
      expect(() => t.recordExternalChange('a.ts', -1, 0)).toThrow('非法');
    });

    it('不同文件独立存储', () => {
      const t = new HunkTracker();
      t.recordAgentChange('a.ts', 1, 5, 'a');
      t.recordAgentChange('b.ts', 10, 15, 'a');
      expect(t.getHistory('a.ts')).toHaveLength(1);
      expect(t.getHistory('b.ts')).toHaveLength(1);
      expect(t.getHistory('c.ts')).toEqual([]);
    });
  });

  describe('detectConflict', () => {
    it('同一 agent 改同一区域不报冲突', () => {
      const t = new HunkTracker();
      t.recordAgentChange('a.ts', 10, 20, 'agent-1');
      const conflicts = t.detectConflict('a.ts', 12, 18, 'agent-1');
      expect(conflicts).toEqual([]);
    });

    it('不同 agent 改同一区域报冲突', () => {
      const t = new HunkTracker();
      t.recordAgentChange('a.ts', 10, 20, 'agent-1');
      const conflicts = t.detectConflict('a.ts', 12, 18, 'agent-2');
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]!.agentId).toBe('agent-1');
    });

    it('Agent 改 External 改过的区域报冲突', () => {
      const t = new HunkTracker();
      t.recordExternalChange('a.ts', 10, 20, 'user input');
      const conflicts = t.detectConflict('a.ts', 12, 18, 'agent-1');
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]!.source).toBe('external');
    });

    it('行不重叠不报冲突', () => {
      const t = new HunkTracker();
      t.recordAgentChange('a.ts', 10, 20, 'agent-1');
      expect(t.detectConflict('a.ts', 21, 30, 'agent-2')).toEqual([]);
      expect(t.detectConflict('a.ts', 1, 9, 'agent-2')).toEqual([]);
    });

    it('边界重叠判定 (s1 <= e2 && s2 <= e1)', () => {
      const t = new HunkTracker();
      t.recordAgentChange('a.ts', 10, 20, 'agent-1');
      expect(t.detectConflict('a.ts', 20, 25, 'agent-2')).toHaveLength(1);
      expect(t.detectConflict('a.ts', 5, 10, 'agent-2')).toHaveLength(1);
      expect(t.detectConflict('a.ts', 21, 30, 'agent-2')).toEqual([]);
    });

    it('无历史时返回空', () => {
      const t = new HunkTracker();
      expect(t.detectConflict('a.ts', 1, 10, 'agent-1')).toEqual([]);
    });

    it('返回多个冲突 hunk', () => {
      const t = new HunkTracker();
      t.recordAgentChange('a.ts', 10, 20, 'agent-1');
      tick(10);
      t.recordExternalChange('a.ts', 15, 25);
      tick(10);
      t.recordAgentChange('a.ts', 12, 18, 'agent-3');
      const conflicts = t.detectConflict('a.ts', 14, 16, 'agent-2');
      expect(conflicts).toHaveLength(3);
    });
  });

  describe('冷却合并', () => {
    it('同一 agent cooldownMs 内重叠区域合并', () => {
      const t = new HunkTracker({ cooldownMs: 5000 });
      t.recordAgentChange('a.ts', 10, 20, 'agent-1');
      tick(1000);
      t.recordAgentChange('a.ts', 18, 25, 'agent-1');
      const hist = t.getHistory('a.ts');
      expect(hist).toHaveLength(1);
      expect(hist[0]!.startLine).toBe(10);
      expect(hist[0]!.endLine).toBe(25);
      expect(hist[0]!.timestamp).toBe(nowMs);
    });

    it('同一 agent cooldownMs 内相邻区域合并', () => {
      const t = new HunkTracker({ cooldownMs: 5000 });
      t.recordAgentChange('a.ts', 10, 20, 'agent-1');
      tick(1000);
      t.recordAgentChange('a.ts', 21, 30, 'agent-1');
      const hist = t.getHistory('a.ts');
      expect(hist).toHaveLength(1);
      expect(hist[0]!.startLine).toBe(10);
      expect(hist[0]!.endLine).toBe(30);
    });

    it('同一 agent cooldownMs 内不重叠不相邻不合并', () => {
      const t = new HunkTracker({ cooldownMs: 5000 });
      t.recordAgentChange('a.ts', 10, 20, 'agent-1');
      tick(1000);
      t.recordAgentChange('a.ts', 50, 60, 'agent-1');
      const hist = t.getHistory('a.ts');
      expect(hist).toHaveLength(2);
    });

    it('cooldownMs 超时后不合并', () => {
      const t = new HunkTracker({ cooldownMs: 5000 });
      t.recordAgentChange('a.ts', 10, 20, 'agent-1');
      tick(6000);
      t.recordAgentChange('a.ts', 15, 18, 'agent-1');
      const hist = t.getHistory('a.ts');
      expect(hist).toHaveLength(2);
    });

    it('不同 agent 不合并', () => {
      const t = new HunkTracker({ cooldownMs: 5000 });
      t.recordAgentChange('a.ts', 10, 20, 'agent-1');
      tick(1000);
      t.recordAgentChange('a.ts', 15, 18, 'agent-2');
      const hist = t.getHistory('a.ts');
      expect(hist).toHaveLength(2);
    });

    it('External 改动不触发合并', () => {
      const t = new HunkTracker({ cooldownMs: 5000 });
      t.recordExternalChange('a.ts', 10, 20);
      tick(1000);
      t.recordExternalChange('a.ts', 15, 25);
      const hist = t.getHistory('a.ts');
      expect(hist).toHaveLength(2);
    });

    it('合并最新的 hunk(倒序查找)', () => {
      const t = new HunkTracker({ cooldownMs: 5000 });
      t.recordAgentChange('a.ts', 1, 5, 'agent-1');
      tick(1000);
      t.recordAgentChange('a.ts', 50, 60, 'agent-1');
      tick(1000);
      t.recordAgentChange('a.ts', 55, 65, 'agent-1');
      const hist = t.getHistory('a.ts');
      expect(hist).toHaveLength(2);
      expect(hist[1]!.startLine).toBe(50);
      expect(hist[1]!.endLine).toBe(65);
    });
  });

  describe('getStats', () => {
    it('空时全为 0', () => {
      const t = new HunkTracker();
      expect(t.getStats()).toEqual({
        totalHunks: 0,
        agentHunks: 0,
        externalHunks: 0,
        conflictFiles: 0,
      });
    });

    it('统计 agent / external 数量', () => {
      const t = new HunkTracker();
      t.recordAgentChange('a.ts', 1, 5, 'agent-1');
      t.recordAgentChange('a.ts', 10, 15, 'agent-2');
      t.recordExternalChange('b.ts', 1, 5);
      const stats = t.getStats();
      expect(stats.totalHunks).toBe(3);
      expect(stats.agentHunks).toBe(2);
      expect(stats.externalHunks).toBe(1);
    });

    it('conflictFiles 计数有冲突的文件', () => {
      const t = new HunkTracker();
      t.recordAgentChange('a.ts', 10, 20, 'agent-1');
      tick(10);
      t.recordAgentChange('a.ts', 15, 25, 'agent-2');
      tick(10);
      t.recordAgentChange('b.ts', 1, 5, 'agent-1');
      tick(10);
      t.recordAgentChange('b.ts', 50, 60, 'agent-2');
      tick(10);
      t.recordAgentChange('c.ts', 1, 5, 'agent-1');
      const stats = t.getStats();
      expect(stats.conflictFiles).toBe(1);
    });

    it('同一 agent 重叠不计入 conflictFiles', () => {
      const t = new HunkTracker();
      t.recordAgentChange('a.ts', 10, 20, 'agent-1');
      tick(10);
      t.recordAgentChange('a.ts', 15, 25, 'agent-1');
      const stats = t.getStats();
      expect(stats.conflictFiles).toBe(0);
    });

    it('Agent 与 External 重叠计入 conflictFiles', () => {
      const t = new HunkTracker();
      t.recordAgentChange('a.ts', 10, 20, 'agent-1');
      tick(10);
      t.recordExternalChange('a.ts', 15, 25);
      const stats = t.getStats();
      expect(stats.conflictFiles).toBe(1);
    });
  });

  describe('历史上限清理', () => {
    it('超过 maxHistoryPerFile 时丢弃最旧的', () => {
      const t = new HunkTracker({ maxHistoryPerFile: 3, cooldownMs: 0 });
      t.recordAgentChange('a.ts', 1, 1, 'a');
      tick(100);
      t.recordAgentChange('a.ts', 2, 2, 'a');
      tick(100);
      t.recordAgentChange('a.ts', 3, 3, 'a');
      tick(100);
      t.recordAgentChange('a.ts', 4, 4, 'a');
      tick(100);
      t.recordAgentChange('a.ts', 5, 5, 'a');
      const hist = t.getHistory('a.ts');
      expect(hist).toHaveLength(3);
      expect(hist[0]!.startLine).toBe(3);
      expect(hist[2]!.startLine).toBe(5);
    });

    it('其他文件不受影响', () => {
      const t = new HunkTracker({ maxHistoryPerFile: 2, cooldownMs: 0 });
      t.recordAgentChange('a.ts', 1, 1, 'a');
      tick(100);
      t.recordAgentChange('a.ts', 2, 2, 'a');
      tick(100);
      t.recordAgentChange('a.ts', 3, 3, 'a');
      tick(100);
      t.recordAgentChange('b.ts', 1, 1, 'a');
      expect(t.getHistory('a.ts')).toHaveLength(2);
      expect(t.getHistory('b.ts')).toHaveLength(1);
    });
  });

  describe('clear', () => {
    it('clear(filePath) 只清该文件', () => {
      const t = new HunkTracker();
      t.recordAgentChange('a.ts', 1, 1, 'a');
      t.recordAgentChange('b.ts', 1, 1, 'a');
      t.clear('a.ts');
      expect(t.getHistory('a.ts')).toEqual([]);
      expect(t.getHistory('b.ts')).toHaveLength(1);
    });

    it('clear() 全部清空', () => {
      const t = new HunkTracker();
      t.recordAgentChange('a.ts', 1, 1, 'a');
      t.recordAgentChange('b.ts', 1, 1, 'a');
      t.clear();
      expect(t.getHistory('a.ts')).toEqual([]);
      expect(t.getHistory('b.ts')).toEqual([]);
      expect(t.getStats().totalHunks).toBe(0);
    });
  });

  describe('集成场景', () => {
    it('多 subagent 并行冲突检测(AGENTS.md §12)', () => {
      const t = new HunkTracker();
      t.recordAgentChange('apps/api/src/auth.ts', 10, 30, 'subagent-A');
      t.recordAgentChange('apps/web/src/components/Header.tsx', 5, 20, 'subagent-B');

      expect(t.detectConflict('apps/api/src/auth.ts', 15, 25, 'subagent-A')).toEqual([]);
      expect(t.detectConflict('apps/api/src/auth.ts', 15, 25, 'subagent-B')).toHaveLength(1);
      expect(t.detectConflict('apps/web/src/components/Header.tsx', 10, 15, 'subagent-A')).toHaveLength(1);
      expect(t.detectConflict('apps/cli/src/index.ts', 1, 10, 'subagent-C')).toEqual([]);
    });

    it('用户在 agent 改过的区域手动改触发冲突', () => {
      const t = new HunkTracker();
      t.recordAgentChange('a.ts', 10, 20, 'agent-1');
      t.recordExternalChange('a.ts', 12, 18, 'user hot-fix');
      const conflicts = t.detectConflict('a.ts', 10, 20, 'agent-1');
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]!.source).toBe('external');
    });
  });
});
