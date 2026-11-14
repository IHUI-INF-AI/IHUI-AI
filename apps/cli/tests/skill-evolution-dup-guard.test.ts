// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked.

/**
 * 提议 id 唯一性守卫回归测试(钉死永久阴影漏洞)。
 *
 * 漏洞背景:propose 曾直接 push,允许同 id 重复 append。id 是 store 唯一键,
 * advance/apply/forceEvolve 都按 id 取「第一条」;重复 append 会让新记录被旧
 * 记录永久遮蔽(propose→forceEvolve→再 propose 同 id,新 pending 落数组尾、
 * .find 永远命中首条 evolved ⇒ 永久阴影、无法推进)。修法:同 id 已在 store
 * ⇒ 抛 DuplicateSuggestionError。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { beforeEach, afterEach, describe, expect, it } from 'vitest';

import {
  propose,
  forceEvolve,
  activeSuggestions,
  loadStore,
  DuplicateSuggestionError,
} from '../src/acp/skill-evolution.js';

let tmpRoot: string;
let skillDir: string;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dup-propose-'));
  skillDir = path.join(tmpRoot, 'skill');
  fs.mkdirSync(path.join(skillDir, 'store'), { recursive: true });
  process.env.IHUI_CLI_SKILL_EVOLUTION_DIR = path.join(tmpRoot, 'store');
  process.env.IHUI_CLI_TOMBSTONES_DIR = path.join(tmpRoot, 'tombs');
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# demo\n', 'utf8');
});

afterEach(() => {
  delete process.env.IHUI_CLI_SKILL_EVOLUTION_DIR;
  delete process.env.IHUI_CLI_TOMBSTONES_DIR;
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('propose id 唯一性守卫', () => {
  it('同 id 已在 store(终态 evolved)⇒ 再 propose 抛 DuplicateSuggestionError', () => {
    const base = { skillId: 'demo', skillDir } as const;
    propose({ ...base, id: 'sug-X', intent: 'first', proposedChange: 'a' });
    forceEvolve('demo', 'sug-X');
    expect(loadStore('demo').suggestions.find((s) => s.id === 'sug-X')?.status).toBe('evolved');

    // 未 compact、无墓碑,再 propose 同 id ⇒ 必须显式拒绝,不能静默 append
    expect(() => propose({ ...base, id: 'sug-X', intent: 'second', proposedChange: 'b' })).toThrow(
      DuplicateSuggestionError,
    );
    // store 内仍只有一条,无永久阴影
    expect(loadStore('demo').suggestions.filter((s) => s.id === 'sug-X')).toHaveLength(1);
  });

  it('同 id 处于活跃态(pending)⇒ 再 propose 同样拒绝', () => {
    const base = { skillId: 'demo', skillDir } as const;
    propose({ ...base, id: 'sug-Y', intent: 'first', proposedChange: 'a' });
    expect(() => propose({ ...base, id: 'sug-Y', intent: 'again', proposedChange: 'b' })).toThrow(
      DuplicateSuggestionError,
    );
    expect(loadStore('demo').suggestions.filter((s) => s.id === 'sug-Y')).toHaveLength(1);
  });

  it('不同 id 可正常并存;拒绝后原提议仍可推进', () => {
    const base = { skillId: 'demo', skillDir } as const;
    propose({ ...base, id: 'sug-A', intent: 'a', proposedChange: 'a' });
    expect(() => propose({ ...base, id: 'sug-A', intent: 'dup', proposedChange: 'dup' })).toThrow(
      DuplicateSuggestionError,
    );
    propose({ ...base, id: 'sug-B', intent: 'b', proposedChange: 'b' });
    expect(loadStore('demo').suggestions.map((s) => s.id)).toEqual(['sug-A', 'sug-B']);
    // 原 A 不受拒绝影响,仍可推进到 evolved
    forceEvolve('demo', 'sug-A');
    expect(loadStore('demo').suggestions.find((s) => s.id === 'sug-A')?.status).toBe('evolved');
    expect(activeSuggestions('demo').map((s) => s.id)).toEqual(['sug-B']);
  });
});
