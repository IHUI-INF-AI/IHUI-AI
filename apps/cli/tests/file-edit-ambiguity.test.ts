// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * edit_file 命中三态处置测试(吸收 G-937970)。
 * not_found(OLD_STRING_NOT_FOUND)/ ambiguous(AMBIGUOUS_REPLACE,文案带命中数)/
 * strategy(模糊兜底,弱级告警)+ countOccurrences 逐字计数 + $& 按字面写入 +
 * 空 replace 删串吞行尾换行。
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createWriteFileTool, createEditFileTool, countOccurrences } from '../src/tools/file-edit.js';
import type { ToolContext } from '../src/tools/index.js';

describe('countOccurrences 逐字计数', () => {
  it('非重叠计数:相邻命中按 needle 长度推进', () => {
    expect(countOccurrences('aXbXc', 'X')).toBe(2);
    expect(countOccurrences('aaaa', 'aa')).toBe(2);
    expect(countOccurrences('hello', 'world')).toBe(0);
  });

  it('空 needle 返回 0(indexOf("") 恒命中会让计数循环原地打转)', () => {
    expect(countOccurrences('anything', '')).toBe(0);
  });
});

describe('edit_file 命中三态(临时工作区)', () => {
  let workDir: string;
  let ctx: ToolContext;
  let origHooksConfig: string | undefined;
  let writeTool: ReturnType<typeof createWriteFileTool>;
  let editTool: ReturnType<typeof createEditFileTool>;

  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-edit-ambiguity-'));
    ctx = { workspacePath: workDir };
    origHooksConfig = process.env.IHUI_HOOKS_CONFIG;
    process.env.IHUI_HOOKS_CONFIG = path.join(workDir, 'no-hooks.json');
    writeTool = createWriteFileTool(ctx);
    editTool = createEditFileTool(ctx);
  });

  afterEach(() => {
    if (origHooksConfig === undefined) delete process.env.IHUI_HOOKS_CONFIG;
    else process.env.IHUI_HOOKS_CONFIG = origHooksConfig;
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  it('多态:2 处命中 ⇒ AMBIGUOUS_REPLACE 硬错且文案含命中数,文件原样不动', async () => {
    await writeTool.execute({ path: 'amb.txt', content: 'foo bar\nfoo bar\nbaz' }, ctx);
    const r = await editTool.execute({ path: 'amb.txt', search: 'foo bar', replace: 'QUX' }, ctx);
    expect(r.success).toBe(false);
    expect(r.errorType).toBe('AMBIGUOUS_REPLACE');
    expect(r.error).toContain('Found 2 matches');
    expect(r.error).toContain('replace_all');
    expect(fs.readFileSync(path.join(workDir, 'amb.txt'), 'utf-8')).toBe('foo bar\nfoo bar\nbaz');
  });

  it('多态:replace_all=true 替换全部逐字命中', async () => {
    await writeTool.execute({ path: 'all.txt', content: 'x\nx\ny' }, ctx);
    const r = await editTool.execute(
      { path: 'all.txt', search: 'x', replace: 'z', replace_all: true },
      ctx,
    );
    expect(r.success).toBe(true);
    expect(r.output).toContain('2 处替换');
    expect(fs.readFileSync(path.join(workDir, 'all.txt'), 'utf-8')).toBe('z\nz\ny');
  });

  it('单态:唯一命中照常替换(replace_all 缺省不触发歧义)', async () => {
    await writeTool.execute({ path: 'one.txt', content: 'alpha\nbeta\ngamma' }, ctx);
    const r = await editTool.execute({ path: 'one.txt', search: 'beta', replace: 'BETA' }, ctx);
    expect(r.success).toBe(true);
    expect(fs.readFileSync(path.join(workDir, 'one.txt'), 'utf-8')).toBe('alpha\nBETA\ngamma');
  });

  it('无态:0 命中且模糊匹配失败 ⇒ OLD_STRING_NOT_FOUND', async () => {
    await writeTool.execute({ path: 'nf.txt', content: 'hello' }, ctx);
    const r = await editTool.execute({ path: 'nf.txt', search: 'nope', replace: 'x' }, ctx);
    expect(r.success).toBe(false);
    expect(r.errorType).toBe('OLD_STRING_NOT_FOUND');
    expect(r.error).toContain('未找到匹配');
  });

  it('strategy 态:逐字零命中但模糊匹配命中 ⇒ 照旧告警并替换(既有行为不回退)', async () => {
    await writeTool.execute({ path: 'fz.txt', content: 'line1   \nline2\n' }, ctx);
    const r = await editTool.execute(
      { path: 'fz.txt', search: 'line1\nline2', replace: 'L1\nL2' },
      ctx,
    );
    expect(r.success).toBe(true);
    expect(r.output).toContain('模糊匹配');
    expect(fs.readFileSync(path.join(workDir, 'fz.txt'), 'utf-8')).toBe('L1\nL2\n');
  });

  it('$&/$$/&` 特殊 token 按字面写入(函数形式 replacement)', async () => {
    await writeTool.execute({ path: 'dollar.txt', content: 'alpha' }, ctx);
    const r = await editTool.execute(
      { path: 'dollar.txt', search: 'alpha', replace: '[$&] [$$] [$`] [$1]' },
      ctx,
    );
    expect(r.success).toBe(true);
    expect(fs.readFileSync(path.join(workDir, 'dollar.txt'), 'utf-8')).toBe('[$&] [$$] [$`] [$1]');
  });

  it('空 replace 删串:优先吞掉行尾换行,不留空行', async () => {
    await writeTool.execute({ path: 'del.txt', content: 'alpha\nbeta\ngamma' }, ctx);
    const r = await editTool.execute({ path: 'del.txt', search: 'beta', replace: '' }, ctx);
    expect(r.success).toBe(true);
    expect(fs.readFileSync(path.join(workDir, 'del.txt'), 'utf-8')).toBe('alpha\ngamma');
  });

  it('空 replace 删串:目标不在行尾时不越界吞字符', async () => {
    await writeTool.execute({ path: 'mid.txt', content: 'alphabeta' }, ctx);
    const r = await editTool.execute({ path: 'mid.txt', search: 'beta', replace: '' }, ctx);
    expect(r.success).toBe(true);
    expect(fs.readFileSync(path.join(workDir, 'mid.txt'), 'utf-8')).toBe('alpha');
  });

  it('缺文件错误带 did-you-mean(同词干)', async () => {
    await writeTool.execute({ path: 'real.ts', content: 'x' }, ctx);
    const r = await editTool.execute({ path: 'real.ts.bak', search: 'a', replace: 'b' }, ctx);
    expect(r.success).toBe(false);
    expect(r.error).toContain('文件不存在');
    expect(r.error).toContain('Did you mean real.ts?');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
