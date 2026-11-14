// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * skill-evolution.ts 行为钉子(对标 Qoder skill_evolution_suggestions 语义)。
 * 全部用临时目录隔离存储(IHUI_CLI_SKILL_EVOLUTION_DIR),不碰真实 ~/.ihui。
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { beforeEach, afterEach, describe, expect, it } from 'vitest';

import {
  skillContentHash,
  canTransition,
  transition,
  IllegalTransitionError,
  isHashInvalidated,
  propose,
  advance,
  dismiss,
  reconcile,
  expirePending,
  activeSuggestions,
  compact,
  loadStore,
  type SuggestionStatus,
} from '../src/acp/skill-evolution.js';

let tmpRoot: string;
let skillDir: string;
let storeDir: string;

/** 造一个最小技能目录:SKILL.md + 一个可变文件。 */
function makeSkill(files: Record<string, string>): void {
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(skillDir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
  }
}

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-evolution-'));
  skillDir = path.join(tmpRoot, 'skill');
  storeDir = path.join(tmpRoot, 'store');
  fs.mkdirSync(skillDir, { recursive: true });
  fs.mkdirSync(storeDir, { recursive: true });
  process.env.IHUI_CLI_SKILL_EVOLUTION_DIR = storeDir;
  // compact 硬删会自动立碑,必须隔离墓碑目录,否则污染真实 ~/.ihui/tombstones.json
  process.env.IHUI_CLI_TOMBSTONES_DIR = path.join(tmpRoot, 'tombs');
  makeSkill({ 'SKILL.md': '# demo skill\n', 'lib/util.js': 'export const x = 1;\n' });
});

afterEach(() => {
  delete process.env.IHUI_CLI_SKILL_EVOLUTION_DIR;
  delete process.env.IHUI_CLI_TOMBSTONES_DIR;
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

/** base():每次取当前 skillDir(避免顶层 const 捕获 beforeEach 前的 undefined)。 */
function base() {
  return { skillId: 'demo', skillDir } as const;
}

describe('skillContentHash(内容指纹)', () => {
  it('同内容同布局 → 同指纹(确定性)', () => {
    const h1 = skillContentHash(skillDir);
    const h2 = skillContentHash(skillDir);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/); // sha256 hex
  });

  it('改文件内容 → 指纹变', () => {
    const h1 = skillContentHash(skillDir);
    makeSkill({ 'SKILL.md': '# demo skill CHANGED\n' });
    expect(skillContentHash(skillDir)).not.toBe(h1);
  });

  it('增/删文件 → 指纹变', () => {
    const h1 = skillContentHash(skillDir);
    makeSkill({ 'extra.md': 'new\n' });
    expect(skillContentHash(skillDir)).not.toBe(h1);
    const h2 = skillContentHash(skillDir);
    fs.rmSync(path.join(skillDir, 'extra.md'));
    expect(skillContentHash(skillDir)).not.toBe(h2);
  });

  it('忽略 node_modules / package-lock(不参与指纹)', () => {
    const h1 = skillContentHash(skillDir);
    fs.mkdirSync(path.join(skillDir, 'node_modules'), { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'node_modules', 'junk.js'), 'noise', 'utf8');
    fs.writeFileSync(path.join(skillDir, 'package-lock.json'), '{"x":1}', 'utf8');
    expect(skillContentHash(skillDir)).toBe(h1);
  });

  it('空目录 → 仍返回合法 sha256(空集指纹),不抛错', () => {
    const empty = path.join(tmpRoot, 'empty-skill');
    fs.mkdirSync(empty, { recursive: true });
    const h = skillContentHash(empty);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('状态机(七态迁移)', () => {
  it('主链 pending→starting→evolving→evolved 合法', () => {
    expect(canTransition('pending', 'starting')).toBe(true);
    expect(canTransition('starting', 'evolving')).toBe(true);
    expect(canTransition('evolving', 'evolved')).toBe(true);
    expect(transition('pending', 'starting')).toBe('starting');
  });

  it('pending 可旁路 dismissed / expired / hash_invalidated', () => {
    expect(canTransition('pending', 'dismissed')).toBe(true);
    expect(canTransition('pending', 'expired')).toBe(true);
    expect(canTransition('pending', 'hash_invalidated')).toBe(true);
  });

  it('终态(evolved/dismissed/expired/hash_invalidated)不可再迁移', () => {
    const terminals: SuggestionStatus[] = [
      'evolved',
      'dismissed',
      'expired',
      'hash_invalidated',
    ];
    for (const t of terminals) {
      expect(canTransition(t, 'pending')).toBe(false);
      expect(canTransition(t, 'evolving')).toBe(false);
    }
  });

  it('非法迁移抛 IllegalTransitionError(不静默)', () => {
    expect(() => transition('evolved', 'pending')).toThrow(IllegalTransitionError);
    expect(() => transition('expired', 'starting')).toThrow(IllegalTransitionError);
  });
});

describe('propose + advance(登记与流转编排)', () => {
  it('propose 登记 pending 提议,baselineHash = 此刻技能指纹', () => {
    const { suggestion } = propose({
      ...base(),
      id: 's1',
      intent: '给 util.js 增加导出',
      proposedChange: 'export const y = 2;\n',
    });
    expect(suggestion.status).toBe('pending');
    expect(suggestion.baselineHash).toBe(skillContentHash(skillDir));
    expect(suggestion.skillId).toBe('demo');
  });

  it('advance 沿主链推进,evolved 时打 evolvedAt', () => {
    propose({ ...base(), id: 's1', intent: 'x', proposedChange: 'y' });
    advance('demo', 's1', 'starting', 1000);
    advance('demo', 's1', 'evolving', 2000);
    const store = advance('demo', 's1', 'evolved', 3000);
    const s = store.suggestions.find((x) => x.id === 's1');
    expect(s?.status).toBe('evolved');
    expect(s?.evolvedAt).toBe(3000);
  });

  it('advance 非法迁移抛错且不落盘', () => {
    propose({ ...base(), id: 's1', intent: 'x', proposedChange: 'y' });
    expect(() => advance('demo', 's1', 'evolved', 1000)).toThrow(
      IllegalTransitionError,
    );
    // 抛错后状态仍是 pending(没被写坏)
    const s = loadStore('demo').suggestions.find((x) => x.id === 's1');
    expect(s?.status).toBe('pending');
  });

  it('advance 找不到 id → 原样返回,不抛', () => {
    const store = advance('demo', 'nope', 'dismissed');
    expect(store.suggestions).toEqual([]);
  });

  it('dismiss 把 pending 推进到 dismissed 终态', () => {
    propose({ ...base(), id: 's1', intent: 'x', proposedChange: 'y' });
    const store = dismiss('demo', 's1');
    expect(store.suggestions[0]?.status).toBe('dismissed');
  });
});

describe('reconcile(指纹失效自动作废,对标 hash_invalidated)', () => {
  it('技能漂移后 reconcile 把提议标为 hash_invalidated', () => {
    propose({ ...base(), id: 's1', intent: 'x', proposedChange: 'y' });
    // 提议生效前技能被外部改动
    makeSkill({ 'SKILL.md': '# demo skill DRIFTED\n' });
    const { invalidatedIds } = reconcile('demo', skillDir);
    expect(invalidatedIds).toEqual(['s1']);
    const s = loadStore('demo').suggestions.find((x) => x.id === 's1');
    expect(s?.status).toBe('hash_invalidated');
  });

  it('技能未漂移 → reconcile 不作废任何提议', () => {
    propose({ ...base(), id: 's1', intent: 'x', proposedChange: 'y' });
    const { invalidatedIds } = reconcile('demo', skillDir);
    expect(invalidatedIds).toEqual([]);
    expect(loadStore('demo').suggestions[0]?.status).toBe('pending');
  });

  it('已终态(evolved)不受 reconcile 影响', () => {
    propose({ ...base(), id: 's1', intent: 'x', proposedChange: 'y' });
    advance('demo', 's1', 'starting');
    advance('demo', 's1', 'evolving');
    advance('demo', 's1', 'evolved');
    makeSkill({ 'SKILL.md': 'drift\n' });
    const { invalidatedIds } = reconcile('demo', skillDir);
    expect(invalidatedIds).toEqual([]); // evolved 是终态,不重复判
    expect(loadStore('demo').suggestions[0]?.status).toBe('evolved');
  });

  it('isHashInvalidated 纯函数:baseline 不等即失效', () => {
    const s = {
      id: 's1',
      skillId: 'demo',
      baselineHash: 'aaa',
      intent: '',
      proposedChange: '',
      status: 'pending' as const,
      createdAt: 0,
      updatedAt: 0,
    };
    expect(isHashInvalidated(s, 'bbb')).toBe(true);
    expect(isHashInvalidated(s, 'aaa')).toBe(false);
  });
});

describe('expirePending(到期作废,对标 expires_at)', () => {
  it('过期的 pending 标为 expired', () => {
    propose({ ...base(), id: 's1', intent: 'x', proposedChange: 'y', ttlMs: 1000, now: 0 });
    const { expiredIds } = expirePending('demo', 5000);
    expect(expiredIds).toEqual(['s1']);
    expect(loadStore('demo').suggestions[0]?.status).toBe('expired');
  });

  it('未到期不动;已启动(starting)不因挂钟过期', () => {
    propose({ ...base(), id: 's1', intent: 'x', proposedChange: 'y', ttlMs: 1000, now: 0 });
    expect(expirePending('demo', 500).expiredIds).toEqual([]); // 未到期
    advance('demo', 's1', 'starting'); // 先启动
    expect(expirePending('demo', 99999).expiredIds).toEqual([]); // 进化中不打断
    expect(loadStore('demo').suggestions[0]?.status).toBe('starting');
  });
});

describe('activeSuggestions + compact', () => {
  it('active 只返回 pending/starting/evolving', () => {
    propose({ ...base(), id: 'a', intent: 'x', proposedChange: 'y' });
    propose({ ...base(), id: 'b', intent: 'x', proposedChange: 'y' });
    advance('demo', 'b', 'starting');
    dismiss('demo', 'a'); // a → dismissed 终态
    const ids = activeSuggestions('demo').map((s) => s.id);
    expect(ids).toEqual(['b']);
  });

  it('active 带指纹守卫:已漂移的提议不返回', () => {
    propose({ ...base(), id: 'a', intent: 'x', proposedChange: 'y' });
    makeSkill({ 'SKILL.md': 'drift\n' });
    const current = skillContentHash(skillDir);
    expect(activeSuggestions('demo', current)).toEqual([]); // 兜底过滤
  });

  it('compact 只清终态,回收计数正确', () => {
    propose({ ...base(), id: 'a', intent: 'x', proposedChange: 'y' });
    propose({ ...base(), id: 'b', intent: 'x', proposedChange: 'y' });
    advance('demo', 'a', 'starting');
    advance('demo', 'a', 'evolving');
    advance('demo', 'a', 'evolved'); // a 终态
    dismiss('demo', 'b'); // b 终态
    const reclaimed = compact('demo');
    expect(reclaimed).toBe(2); // a + b 都终态,全回收
    expect(loadStore('demo').suggestions).toEqual([]);
  });

  it('compact 无终态 → 返回 0,不动活跃提议', () => {
    propose({ ...base(), id: 'a', intent: 'x', proposedChange: 'y' });
    expect(compact('demo')).toBe(0);
    expect(loadStore('demo').suggestions).toHaveLength(1);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
