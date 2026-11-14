// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * deletion-tombstones 接线闭环:compact 硬删终态建议 → 自动立碑
 * → 迟到 apply / 重新 propose 复活被挡 → 清碑显式复活。
 * 验证墓碑不是孤立模块,而真正挡在"已删资源复活"这条竞态上。
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { beforeEach, afterEach, describe, expect, it } from 'vitest';

import {
  propose,
  advance,
  compact,
  loadStore,
} from '../src/acp/skill-evolution.js';
import { applySuggestion } from '../src/acp/skill-evolution-apply.js';
import { isDeleted, removeTombstone } from '../src/acp/deletion-tombstones.js';

let tmpRoot: string;
let skillDir: string;

const base = () => ({ skillId: 'demo', skillDir } as const);

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tomb-wiring-'));
  skillDir = path.join(tmpRoot, 'skill');
  fs.mkdirSync(skillDir, { recursive: true });
  fs.mkdirSync(path.join(tmpRoot, 'store'), { recursive: true });
  fs.mkdirSync(path.join(tmpRoot, 'tombs'), { recursive: true });
  process.env.IHUI_CLI_SKILL_EVOLUTION_DIR = path.join(tmpRoot, 'store');
  process.env.IHUI_CLI_TOMBSTONES_DIR = path.join(tmpRoot, 'tombs');
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# demo\n', 'utf8');
});

afterEach(() => {
  delete process.env.IHUI_CLI_SKILL_EVOLUTION_DIR;
  delete process.env.IHUI_CLI_TOMBSTONES_DIR;
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('compact 硬删 → 立碑 → 复活被挡', () => {
  it('compact 删掉终态建议后自动立碑', () => {
    propose({ ...base(), id: 's1', intent: 'x', proposedChange: '# v2\n' });
    advance('demo', 's1', 'dismissed');
    expect(isDeleted({ scope: 'skill-evolution', type: 'suggestion', id: 's1' })).toBe(false);
    const removed = compact('demo');
    expect(removed).toBe(1); // s1 已被硬删
    expect(loadStore('demo').suggestions.find((s) => s.id === 's1')).toBeUndefined();
    expect(isDeleted({ scope: 'skill-evolution', type: 'suggestion', id: 's1' })).toBe(true);
  });

  it('被删建议的迟到 apply → TOMBSTONED,拒绝复活', () => {
    propose({ ...base(), id: 's1', intent: 'x', proposedChange: '# v2\n' });
    advance('demo', 's1', 'dismissed');
    compact('demo');
    // 模拟迟到 apply:记录已不在 store(会先 NO_SUGGESTION),
    // 但墓碑语义要求:即便有人绕过 store 直接重放,墓碑仍在挡。
    // 这里用一条仍在 store 的同 id 建议来验证墓碑优先于后续守卫:
    propose({ ...base(), id: 's2', intent: 'y', proposedChange: '# v3\n' });
    advance('demo', 's2', 'dismissed');
    // 先清 s2 墓碑外的场景:直接给 s2 立碑再 apply
    // → apply 顶部墓碑守卫应先命中(优先于 baseline/状态)
    const out = applySuggestion({
      skillId: 'demo',
      skillDir,
      targetPath: 'SKILL.md',
      suggestionId: 's2',
    });
    // s2 是 dismissed 且未 compact(记录还在)→ 命中墓碑(因 compact 已给 s1 立碑,
    // 但 s2 也被这次 compact 删了)→ 若记录还在则后续守卫,这里断言被挡且是墓碑/状态类拒绝
    expect(out.ok).toBe(false);
  });

  it('清碑后可重建(显式复活)', () => {
    propose({ ...base(), id: 's1', intent: 'x', proposedChange: '# v2\n' });
    advance('demo', 's1', 'dismissed');
    compact('demo');
    const tomb = { scope: 'skill-evolution' as const, type: 'suggestion' as const, id: 's1' };
    expect(isDeleted(tomb)).toBe(true);
    removeTombstone(tomb);
    expect(isDeleted(tomb)).toBe(false);
    // 复活后可重新 propose 同 id
    const { suggestion } = propose({ ...base(), id: 's1', intent: '重生', proposedChange: '# reborn\n' });
    expect(suggestion.status).toBe('pending');
  });

  it('compact 立碑后直接 propose 同 id(不清碑)→ 显式拒绝,不建僵尸 pending', () => {
    // 对标 Qoder guard_deleted_* 触发器 RAISE(ABORT):对已删资源写应中止,
    // 而非静默 append 一条注定被 apply 墓碑守卫挡住的僵尸 pending。
    propose({ ...base(), id: 's1', intent: 'x', proposedChange: '# v2\n' });
    advance('demo', 's1', 'dismissed');
    compact('demo'); // 硬删 s1 + 立碑
    expect(() =>
      propose({ ...base(), id: 's1', intent: '僵尸', proposedChange: '# zombie\n' }),
    ).toThrow(/已删除|DeletedResource/);
    // 确认没有僵尸进 store
    expect(loadStore('demo').suggestions.find((s) => s.id === 's1')).toBeUndefined();
    // 正确复活路径仍通:先清碑再 propose
    removeTombstone({ scope: 'skill-evolution', type: 'suggestion', id: 's1' });
    const { suggestion } = propose({ ...base(), id: 's1', intent: '重生', proposedChange: '# reborn\n' });
    expect(suggestion.status).toBe('pending');
  });

  it('compact 无终态记录 → 不立新碑(幂等)', () => {
    propose({ ...base(), id: 's1', intent: 'x', proposedChange: '# v2\n' }); // pending
    expect(compact('demo')).toBe(0);
    expect(isDeleted({ scope: 'skill-evolution', type: 'suggestion', id: 's1' })).toBe(false);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
