// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * diff-preview 纯模块测试 —— 预览不得写盘,所有断言只读临时目录。
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  buildEditPreview,
  renderEditPreview,
  summarizeEditPreview,
  type BuildEditPreviewInput,
  type EditPreview,
} from '../src/tools/diff-preview.js';

let workDir: string;

beforeEach(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-diff-preview-'));
});

afterEach(() => {
  fs.rmSync(workDir, { recursive: true, force: true });
});

/** 在临时工作区写文件(测试准备,不是被测模块的写入行为) */
function writeFixture(rel: string, content: string): string {
  const abs = path.join(workDir, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf-8');
  return abs;
}

/** 断言预览非 null 的便捷包装 */
function preview(
  toolName: string,
  args: Record<string, unknown>,
  overrides: Partial<BuildEditPreviewInput> = {},
): EditPreview {
  const result = buildEditPreview({ toolName, args, workspacePath: workDir, ...overrides });
  expect(result).not.toBeNull();
  return result as EditPreview;
}

describe('buildEditPreview — write_file', () => {
  it('目标不存在 → create,统计新增行数', () => {
    const p = preview('write_file', { path: 'src/new.ts', content: 'a\nb\n' });
    expect(p.kind).toBe('create');
    expect(p.oldText).toBe('');
    expect(p.newText).toBe('a\nb\n');
    expect(p.filePath).toBe('src/new.ts');
    expect(p.addedLines).toBe(2);
    expect(p.removedLines).toBe(0);
    expect(p.diff).toContain('--- a/src/new.ts');
    expect(p.diff).toContain('+++ b/src/new.ts');
    expect(p.diff).toContain('@@ -1,0 +1,2 @@');
    expect(p.applicable).toBe(true);
    expect(p.truncated).toBe(false);
  });

  it('已有文件内容不同 → modify,统计增删行数', () => {
    writeFixture('mod.ts', 'a\nb\nc\n');
    const p = preview('write_file', { path: 'mod.ts', content: 'a\nB\nc\n' });
    expect(p.kind).toBe('modify');
    expect(p.oldText).toBe('a\nb\nc\n');
    expect(p.newText).toBe('a\nB\nc\n');
    expect(p.addedLines).toBe(1);
    expect(p.removedLines).toBe(1);
    expect(p.diff).toContain('-b');
    expect(p.diff).toContain('+B');
  });

  it('内容完全相同 → unchanged,无 diff', () => {
    writeFixture('same.ts', 'keep\n');
    const p = preview('write_file', { path: 'same.ts', content: 'keep\n' });
    expect(p.kind).toBe('unchanged');
    expect(p.diff).toBe('');
    expect(p.addedLines).toBe(0);
    expect(p.removedLines).toBe(0);
  });

  it('绝对路径 → absPath 原样、filePath 相对工作区且正斜杠', () => {
    const abs = path.join(workDir, 'nested', 'abs.ts');
    const p = preview('write_file', { path: abs, content: 'x\n' });
    expect(p.absPath).toBe(abs);
    expect(p.filePath).toBe('nested/abs.ts');
  });
});

describe('buildEditPreview — edit_file', () => {
  it('单处逐字命中 → 按 SEARCH/REPLACE 替换', () => {
    writeFixture('one.ts', 'a\nb\nc\n');
    const p = preview('edit_file', { path: 'one.ts', search: 'b', replace: 'B' });
    expect(p.kind).toBe('modify');
    expect(p.newText).toBe('a\nB\nc\n');
    expect(p.addedLines).toBe(1);
    expect(p.removedLines).toBe(1);
    expect(p.reason).toBeUndefined();
  });

  it('replace_all → 多命中全部替换', () => {
    writeFixture('all.ts', 'x\nx\n');
    const p = preview('edit_file', { path: 'all.ts', search: 'x', replace: 'y', replace_all: true });
    expect(p.kind).toBe('modify');
    expect(p.newText).toBe('y\ny\n');
    expect(p.addedLines).toBe(2);
    expect(p.removedLines).toBe(2);
  });

  it('多命中未开 replace_all → unavailable(AMBIGUOUS)', () => {
    writeFixture('amb.ts', 'x\nx\n');
    const p = preview('edit_file', { path: 'amb.ts', search: 'x', replace: 'y' });
    expect(p.kind).toBe('unavailable');
    expect(p.applicable).toBe(false);
    expect(p.reason).toContain('AMBIGUOUS');
    expect(p.diff).toBe('');
  });

  it('逐字与模糊都找不到 → unavailable(OLD_STRING_NOT_FOUND)', () => {
    writeFixture('nf.ts', 'a\nb\n');
    const p = preview('edit_file', { path: 'nf.ts', search: 'zzz', replace: 'Y' });
    expect(p.kind).toBe('unavailable');
    expect(p.reason).toContain('OLD_STRING_NOT_FOUND');
    expect(p.applicable).toBe(false);
  });

  it('逐字未中但模糊命中 → 预览按模糊位置替换并标注 reason', () => {
    writeFixture('fuzzy.ts', 'function foo() {   \n  return 1;\n}\n');
    const p = preview('edit_file', {
      path: 'fuzzy.ts',
      search: 'function foo() {\n  return 1;\n}',
      replace: 'function foo() {\n  return 2;\n}',
    });
    expect(p.kind).toBe('modify');
    expect(p.newText).toContain('return 2;');
    expect(p.reason).toContain('模糊');
  });

  it('目标文件不存在 → unavailable', () => {
    const p = preview('edit_file', { path: 'missing.ts', search: 'a', replace: 'b' });
    expect(p.kind).toBe('unavailable');
    expect(p.reason).toContain('文件不存在');
  });

  it('patch 多块 → 多 hunk diff(>=2 个 @@)', () => {
    const lines = [
      'FIRST_LINE',
      ...Array.from({ length: 18 }, (_, i) => `filler ${i + 1}`),
      'LAST_LINE',
    ].join('\n');
    writeFixture('many.ts', `${lines}\n`);
    const patch = [
      '<<<<<<< SEARCH',
      'FIRST_LINE',
      '=======',
      'first changed',
      '>>>>>>> REPLACE',
      '<<<<<<< SEARCH',
      'LAST_LINE',
      '=======',
      'last changed',
      '>>>>>>> REPLACE',
    ].join('\n');
    const p = preview('edit_file', { path: 'many.ts', patch });
    const hunkHeaders = p.diff.split('\n').filter((line) => line.startsWith('@@ '));
    expect(hunkHeaders.length).toBeGreaterThanOrEqual(2);
  });
});

describe('buildEditPreview — 非编辑工具', () => {
  it('read_file / run_command 返回 null', () => {
    expect(buildEditPreview({ toolName: 'read_file', args: { path: 'a.ts' }, workspacePath: workDir })).toBeNull();
    expect(buildEditPreview({ toolName: 'run_command', args: { command: 'ls' }, workspacePath: workDir })).toBeNull();
  });
});

describe('截断 / 渲染 / 摘要 / 零写入', () => {
  it('maxDiffLines=5 时截断且保留头部与首 hunk', () => {
    const lines = Array.from({ length: 20 }, (_, i) => `L${i + 1}`).join('\n');
    writeFixture('trunc.ts', `${lines}\n`);
    const p = preview('edit_file', { path: 'trunc.ts', search: 'L10', replace: 'L10 changed' }, { maxDiffLines: 5 });
    expect(p.truncated).toBe(true);
    expect(p.diff.startsWith('--- a/trunc.ts')).toBe(true);
    expect(p.diff).toContain('@@ ');
    expect(p.reason).toContain('截断');
    expect(p.diff.split('\n').filter((line) => line !== '').length).toBeLessThanOrEqual(7);
  });

  it('renderEditPreview color:false 输出纯文本 diff,color:true 含 ANSI', () => {
    writeFixture('render.ts', 'old\n');
    const p = preview('write_file', { path: 'render.ts', content: 'new\n' });
    const plain = renderEditPreview(p, { color: false });
    expect(plain).toContain('--- a/render.ts');
    expect(plain).toContain('+++ b/render.ts');
    expect(plain).toContain('-old');
    expect(plain).toContain('+new');
    expect(plain).not.toContain('\u001b');
    expect(plain.endsWith('\n')).toBe(true);

    const colored = renderEditPreview(p, { color: true });
    expect(colored).toContain('\u001b[');
    expect(colored.endsWith('\n')).toBe(true);
  });

  it('summarizeEditPreview 含 +N -M', () => {
    writeFixture('sum.ts', 'old\n');
    const p = preview('write_file', { path: 'sum.ts', content: 'new\n' });
    const summary = summarizeEditPreview(p);
    expect(summary).toContain('+1 -1');
    expect(summary).toContain('✏️');
  });

  it('预览零写入:内容与 mtime 不变', () => {
    const abs = writeFixture('zero.ts', 'keep\n');
    const beforeContent = fs.readFileSync(abs, 'utf-8');
    const beforeMtime = fs.statSync(abs).mtimeMs;
    const p = preview('write_file', { path: 'zero.ts', content: 'changed\n' });
    expect(p.kind).toBe('modify');
    expect(fs.readFileSync(abs, 'utf-8')).toBe(beforeContent);
    expect(fs.statSync(abs).mtimeMs).toBe(beforeMtime);
  });
});
