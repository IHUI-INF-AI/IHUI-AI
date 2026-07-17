/**
 * 文件编辑工具集测试 — write_file / edit_file / delete_file
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  createWriteFileTool,
  createEditFileTool,
  createDeleteFileTool,
  createFileEditTools,
} from '../src/tools/file-edit.js';
import type { ToolContext } from '../src/tools/index.js';

describe('createFileEditTools 注册', () => {
  it('返回 3 个工具:write_file / edit_file / delete_file', () => {
    const tools = createFileEditTools({ workspacePath: '.' });
    expect(tools).toHaveLength(3);
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(['delete_file', 'edit_file', 'write_file']);
  });

  it('危险级别:write/edit 为 write,delete 为 dangerous', () => {
    const tools = createFileEditTools({ workspacePath: '.' });
    expect(tools.find((t) => t.name === 'write_file')!.dangerLevel).toBe('write');
    expect(tools.find((t) => t.name === 'edit_file')!.dangerLevel).toBe('write');
    expect(tools.find((t) => t.name === 'delete_file')!.dangerLevel).toBe('dangerous');
  });
});

describe('文件编辑工具(临时工作区)', () => {
  let workDir: string;
  let ctx: ToolContext;
  let origHooksConfig: string | undefined;
  let writeTool: ReturnType<typeof createWriteFileTool>;
  let editTool: ReturnType<typeof createEditFileTool>;
  let deleteTool: ReturnType<typeof createDeleteFileTool>;

  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-fileedit-'));
    ctx = { workspacePath: workDir };
    origHooksConfig = process.env.IHUI_HOOKS_CONFIG;
    process.env.IHUI_HOOKS_CONFIG = path.join(workDir, 'no-hooks.json');
    writeTool = createWriteFileTool(ctx);
    editTool = createEditFileTool(ctx);
    deleteTool = createDeleteFileTool(ctx);
  });

  afterEach(() => {
    if (origHooksConfig === undefined) delete process.env.IHUI_HOOKS_CONFIG;
    else process.env.IHUI_HOOKS_CONFIG = origHooksConfig;
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  describe('write_file', () => {
    it('缺少 path 返回错误', async () => {
      const r = await writeTool.execute({ content: 'x' }, ctx);
      expect(r.success).toBe(false);
      expect(r.error).toContain('path');
    });

    it('创建新文件并报告行数/字节数', async () => {
      const r = await writeTool.execute({ path: 'a.txt', content: 'hello\nworld' }, ctx);
      expect(r.success).toBe(true);
      expect(fs.readFileSync(path.join(workDir, 'a.txt'), 'utf-8')).toBe('hello\nworld');
      expect(r.output).toContain('a.txt');
      expect(r.output).toContain('2 行');
    });

    it('覆盖已存在文件并附带 unified diff', async () => {
      await writeTool.execute({ path: 'b.txt', content: 'line1\nline2' }, ctx);
      const r = await writeTool.execute({ path: 'b.txt', content: 'line1\nchanged' }, ctx);
      expect(r.success).toBe(true);
      expect(r.output).toContain('-line2');
      expect(r.output).toContain('+changed');
      expect(fs.readFileSync(path.join(workDir, 'b.txt'), 'utf-8')).toBe('line1\nchanged');
    });

    it('自动创建父目录(嵌套路径)', async () => {
      const r = await writeTool.execute({ path: 'sub/deep/c.txt', content: 'nested' }, ctx);
      expect(r.success).toBe(true);
      expect(fs.readFileSync(path.join(workDir, 'sub', 'deep', 'c.txt'), 'utf-8')).toBe('nested');
    });
  });

  describe('edit_file', () => {
    it('文件不存在返回错误', async () => {
      const r = await editTool.execute({ path: 'no.txt', search: 'a', replace: 'b' }, ctx);
      expect(r.success).toBe(false);
      expect(r.error).toContain('文件不存在');
    });

    it('缺少 search/replace/patch 参数返回错误', async () => {
      await writeTool.execute({ path: 'e.txt', content: 'foo' }, ctx);
      const r = await editTool.execute({ path: 'e.txt' }, ctx);
      expect(r.success).toBe(false);
      expect(r.error).toContain('search+replace');
    });

    it('search+replace 精确替换', async () => {
      await writeTool.execute({ path: 'f.txt', content: 'alpha\nbeta\ngamma' }, ctx);
      const r = await editTool.execute({ path: 'f.txt', search: 'beta', replace: 'BETA' }, ctx);
      expect(r.success).toBe(true);
      expect(fs.readFileSync(path.join(workDir, 'f.txt'), 'utf-8')).toBe('alpha\nBETA\ngamma');
    });

    it('patch 参数支持多个 SEARCH/REPLACE 块', async () => {
      await writeTool.execute({ path: 'g.txt', content: 'one\ntwo\nthree' }, ctx);
      const patch = `<<<<<<< SEARCH
one
=======
ONE
>>>>>>> REPLACE
<<<<<<< SEARCH
three
=======
THREE
>>>>>>> REPLACE`;
      const r = await editTool.execute({ path: 'g.txt', patch }, ctx);
      expect(r.success).toBe(true);
      expect(fs.readFileSync(path.join(workDir, 'g.txt'), 'utf-8')).toBe('ONE\ntwo\nTHREE');
    });

    it('SEARCH 块未匹配返回错误(含 4 级模糊匹配提示)', async () => {
      await writeTool.execute({ path: 'h.txt', content: 'hello' }, ctx);
      const r = await editTool.execute({ path: 'h.txt', search: 'nope', replace: 'x' }, ctx);
      expect(r.success).toBe(false);
      expect(r.error).toContain('未找到匹配');
    });

    it('行尾空白差异触发 rstrip 模糊匹配', async () => {
      await writeTool.execute({ path: 'i.txt', content: 'line1   \nline2\n' }, ctx);
      const r = await editTool.execute(
        { path: 'i.txt', search: 'line1\nline2', replace: 'L1\nL2' },
        ctx,
      );
      expect(r.success).toBe(true);
      expect(r.output).toContain('模糊匹配');
      expect(fs.readFileSync(path.join(workDir, 'i.txt'), 'utf-8')).toBe('L1\nL2\n');
    });
  });

  describe('delete_file', () => {
    it('文件不存在返回错误', async () => {
      const r = await deleteTool.execute({ path: 'no.txt' }, ctx);
      expect(r.success).toBe(false);
      expect(r.error).toContain('文件不存在');
    });

    it('删除目录返回错误', async () => {
      fs.mkdirSync(path.join(workDir, 'adir'));
      const r = await deleteTool.execute({ path: 'adir' }, ctx);
      expect(r.success).toBe(false);
      expect(r.error).toContain('目录');
    });

    it('成功删除文件', async () => {
      await writeTool.execute({ path: 'j.txt', content: 'bye' }, ctx);
      const r = await deleteTool.execute({ path: 'j.txt' }, ctx);
      expect(r.success).toBe(true);
      expect(fs.existsSync(path.join(workDir, 'j.txt'))).toBe(false);
    });
  });

  describe('folder_trust 路径信任', () => {
    it('read-only 路径禁止 write_file', async () => {
      const roCtx: ToolContext = {
        workspacePath: workDir,
        folderTrust: { 'locked.txt': 'read-only' },
      };
      const w = createWriteFileTool(roCtx);
      const r = await w.execute({ path: 'locked.txt', content: 'x' }, roCtx);
      expect(r.success).toBe(false);
      expect(r.error).toContain('read-only');
    });

    it('forbidden 路径禁止 delete_file', async () => {
      await writeTool.execute({ path: 'secret.txt', content: 's' }, ctx);
      const fCtx: ToolContext = {
        workspacePath: workDir,
        folderTrust: { 'secret.txt': 'forbidden' },
      };
      const d = createDeleteFileTool(fCtx);
      const r = await d.execute({ path: 'secret.txt' }, fCtx);
      expect(r.success).toBe(false);
      expect(r.error).toContain('forbidden');
    });
  });
});
