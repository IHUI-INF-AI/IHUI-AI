// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * skill-evolution-apply.ts 行为钉子:baseline 守卫 / 原子写 / 路径逃逸 / 闭环推进。
 * 临时目录隔离,不碰真实 ~/.ihui。
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { beforeEach, afterEach, describe, expect, it } from 'vitest';

import { propose, loadStore } from '../src/acp/skill-evolution.js';
import { applySuggestion } from '../src/acp/skill-evolution-apply.js';

let tmpRoot: string;
let skillDir: string;
let storeDir: string;

function makeSkill(files: Record<string, string>): void {
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(skillDir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
  }
}

function base() {
  return { skillId: 'demo', skillDir } as const;
}

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-apply-'));
  skillDir = path.join(tmpRoot, 'skill');
  storeDir = path.join(tmpRoot, 'store');
  fs.mkdirSync(skillDir, { recursive: true });
  fs.mkdirSync(storeDir, { recursive: true });
  process.env.IHUI_CLI_SKILL_EVOLUTION_DIR = storeDir;
  // applySuggestion 会读墓碑守卫(isDeleted);隔离目录防真实 ~/.ihui 同 id 墓碑误判 TOMBSTONED
  process.env.IHUI_CLI_TOMBSTONES_DIR = path.join(tmpRoot, 'tombs');
  makeSkill({ 'SKILL.md': '# demo\n', 'lib/util.js': 'export const x = 1;\n' });
});

afterEach(() => {
  delete process.env.IHUI_CLI_SKILL_EVOLUTION_DIR;
  delete process.env.IHUI_CLI_TOMBSTONES_DIR;
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('applySuggestion(执行链)', () => {
  it('正常应用:写入目标文件 + 提议推进到 evolved', () => {
    propose({ ...base(), id: 's1', intent: '重写 SKILL.md', proposedChange: '# demo EVOLVED\n' });
    const out = applySuggestion({
      skillId: 'demo',
      skillDir,
      targetPath: 'SKILL.md',
      suggestionId: 's1',
    });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.suggestionId).toBe('s1');
      expect(out.writtenPath.endsWith('SKILL.md')).toBe(true);
    }
    expect(fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8')).toBe('# demo EVOLVED\n');
    expect(loadStore('demo').suggestions.find((s) => s.id === 's1')?.status).toBe('evolved');
  });

  it('覆盖前默认留 .bak(可回滚)', () => {
    propose({ ...base(), id: 's1', intent: 'x', proposedChange: '# new\n' });
    const out = applySuggestion({
      skillId: 'demo',
      skillDir,
      targetPath: 'SKILL.md',
      suggestionId: 's1',
    });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.backupPath).toBeDefined();
    expect(fs.readFileSync(path.join(skillDir, 'SKILL.md.bak'), 'utf8')).toBe('# demo\n');
  });

  it('baseline 漂移 → 拒绝(BASELINE_DRIFT),不写坏技能', () => {
    const { suggestion } = propose({
      ...base(),
      id: 's1',
      intent: 'x',
      proposedChange: '# evil\n',
    });
    // 提议生效前技能被外部改动
    makeSkill({ 'SKILL.md': '# demo DRIFTED\n' });
    const out = applySuggestion({
      skillId: 'demo',
      skillDir,
      targetPath: 'SKILL.md',
      suggestionId: suggestion.id,
    });
    expect(out).toMatchObject({ ok: false, code: 'BASELINE_DRIFT' });
    // 技能未被污染(仍是漂移后的内容,不是提议内容)
    expect(fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8')).toBe('# demo DRIFTED\n');
  });

  it('路径逃逸(../)→ 拒绝,不写技能目录外', () => {
    propose({ ...base(), id: 's1', intent: 'x', proposedChange: 'pwned\n' });
    const outside = path.join(tmpRoot, 'OUTSIDE.md');
    const out = applySuggestion({
      skillId: 'demo',
      skillDir,
      targetPath: '../OUTSIDE.md',
      suggestionId: 's1',
    });
    expect(out.ok).toBe(false);
    expect(fs.existsSync(outside)).toBe(false);
  });

  it('提议不存在 → NO_SUGGESTION', () => {
    const out = applySuggestion({
      skillId: 'demo',
      skillDir,
      targetPath: 'SKILL.md',
      suggestionId: 'nope',
    });
    expect(out).toMatchObject({ ok: false, code: 'NO_SUGGESTION' });
  });

  it('已终态(evolved)提议不可重复应用 → 被守卫拒绝', () => {
    propose({ ...base(), id: 's1', intent: 'x', proposedChange: '# v2\n' });
    applySuggestion({ skillId: 'demo', skillDir, targetPath: 'SKILL.md', suggestionId: 's1' });
    // 再应用一次:s1 已 evolved,且技能已在首次应用后改变
    // → 先命中 baseline 漂移守卫(技能内容 ≠ 提议 baseline),被拒绝,不二次写
    const out = applySuggestion({
      skillId: 'demo',
      skillDir,
      targetPath: 'SKILL.md',
      suggestionId: 's1',
    });
    expect(out.ok).toBe(false);
    // 文件仍是首次应用的内容,未被二次污染
    expect(fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8')).toBe('# v2\n');
  });

  it('makeBackup=false 不留 .bak', () => {
    propose({ ...base(), id: 's1', intent: 'x', proposedChange: '# new\n' });
    const out = applySuggestion({
      skillId: 'demo',
      skillDir,
      targetPath: 'SKILL.md',
      suggestionId: 's1',
      makeBackup: false,
    });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.backupPath).toBeUndefined();
    expect(fs.existsSync(path.join(skillDir, 'SKILL.md.bak'))).toBe(false);
  });

  it('可写新文件(目标原本不存在,无 .bak)', () => {
    propose({ ...base(), id: 's1', intent: '新增文件', proposedChange: 'brand new\n' });
    const out = applySuggestion({
      skillId: 'demo',
      skillDir,
      targetPath: 'docs/new.md',
      suggestionId: 's1',
    });
    expect(out.ok).toBe(true);
    expect(fs.readFileSync(path.join(skillDir, 'docs', 'new.md'), 'utf8')).toBe('brand new\n');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
