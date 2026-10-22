// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * write_file / edit_file 的「读后写」校验(G1,对齐上游 write.ts / edit.ts)。
 *
 * 三条判据分开测,缺一条都会让另一条的实现被删掉时毫无信号:
 *   - 读到再写 ⇒ 通过;
 *   - 未读直接写 ⇒ 拒绝(file_not_read),磁盘原样;
 *   - 读后被外部改 ⇒ 拒绝(file_stale_read),不覆盖外部内容。
 * 外加两条语义锁:本工具自己写过的文件免重读(内容由写入确定)、新建文件不要求先读。
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createWriteFileTool, createEditFileTool } from '../src/tools/file-edit.js';
import { read_file } from '../src/tools/builtins.js';
import type { ToolContext } from '../src/tools/index.js';

describe('write_file / edit_file 读后写校验', () => {
  let workDir: string;
  let ctx: ToolContext;
  let origHooksConfig: string | undefined;
  let writeTool: ReturnType<typeof createWriteFileTool>;
  let editTool: ReturnType<typeof createEditFileTool>;

  const abs = (name: string): string => path.join(workDir, name);
  const readDisk = (name: string): string => fs.readFileSync(abs(name), 'utf-8');

  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-read-before-write-'));
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

  it('未读直接覆盖已存在文件 ⇒ 拒绝(file_not_read),磁盘不动', async () => {
    fs.writeFileSync(abs('a.txt'), 'disk content', 'utf-8');
    const r = await writeTool.execute({ path: 'a.txt', content: 'agent content' }, ctx);
    expect(r.success).toBe(false);
    expect(r.errorType).toBe('file_not_read');
    expect(r.error).toContain('FILE_NOT_READ');
    expect(readDisk('a.txt')).toBe('disk content');
  });

  it('先 read_file 再写 ⇒ 通过', async () => {
    fs.writeFileSync(abs('b.txt'), 'v1', 'utf-8');
    const read = await read_file.execute({ path: 'b.txt' }, ctx);
    expect(read.success).toBe(true);
    const r = await writeTool.execute({ path: 'b.txt', content: 'v2' }, ctx);
    expect(r.success).toBe(true);
    expect(readDisk('b.txt')).toBe('v2');
  });

  it('读后被外部改动 ⇒ 拒绝(file_stale_read),不覆盖外部内容', async () => {
    fs.writeFileSync(abs('c.txt'), 'v1', 'utf-8');
    await read_file.execute({ path: 'c.txt' }, ctx);
    // 外部改写:内容长度不同 ⇒ size 维必然判 stale(mtime 精度差异不参与判定)
    fs.writeFileSync(abs('c.txt'), 'externally changed with longer content', 'utf-8');
    const r = await writeTool.execute({ path: 'c.txt', content: 'agent' }, ctx);
    expect(r.success).toBe(false);
    expect(r.errorType).toBe('file_stale_read');
    expect(r.error).toContain('FILE_STALE_READ');
    expect(readDisk('c.txt')).toBe('externally changed with longer content');
  });

  it('本工具自己写过的文件可连续覆盖/编辑(内容由写入确定,无需重读)', async () => {
    expect((await writeTool.execute({ path: 'd.txt', content: 'one' }, ctx)).success).toBe(true);
    expect((await writeTool.execute({ path: 'd.txt', content: 'two' }, ctx)).success).toBe(true);
    const e = await editTool.execute({ path: 'd.txt', search: 'two', replace: 'three' }, ctx);
    expect(e.success).toBe(true);
    expect(readDisk('d.txt')).toBe('three');
  });

  it('新建文件不要求先读', async () => {
    const r = await writeTool.execute({ path: 'new/deep.txt', content: 'hello' }, ctx);
    expect(r.success).toBe(true);
    expect(readDisk('new/deep.txt')).toBe('hello');
  });

  it('读取空文件后可以写入(空文件读取也必须登记已读状态,否则该文件永远写不进去)', async () => {
    fs.writeFileSync(abs('empty.txt'), '', 'utf-8');
    const read = await read_file.execute({ path: 'empty.txt' }, ctx);
    expect(read.success).toBe(true);
    const r = await writeTool.execute({ path: 'empty.txt', content: 'first content' }, ctx);
    expect(r.success).toBe(true);
    expect(readDisk('empty.txt')).toBe('first content');
  });

  it('edit_file 对未读的已存在文件同样拒绝', async () => {
    fs.writeFileSync(abs('e.txt'), 'alpha', 'utf-8');
    const r = await editTool.execute({ path: 'e.txt', search: 'alpha', replace: 'beta' }, ctx);
    expect(r.success).toBe(false);
    expect(r.errorType).toBe('file_not_read');
    expect(readDisk('e.txt')).toBe('alpha');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
