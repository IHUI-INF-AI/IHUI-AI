// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * read_file 的 file_unchanged 短路测试(吸收 G-937971)。
 *
 * 钉住六件事:
 *  ① 同一 ctx 内文件未变 ⇒ 第二次读回 "Wasted call" stub,不重发正文;
 *  ② 外部改写(mtime+size 都变) ⇒ 缓存失效,重新读到新内容;
 *  ③ **同尺寸改写**但 mtime 变了 ⇒ 仍判 stale(size 单判会漏,mtime 是主判据);
 *  ④ 状态按 ctx 隔离(WeakMap 挂 ctx):换一个 ctx 首读照常回内容;
 *  ⑤ 行数闸截断的 partial 视图**永不短路** —— 模型没见过全貌,stub 会替它担保没看过的字节;
 *  ⑥ offset/limit 的 range view 是独立 cacheKey:与整读互不干扰,同参二读也短路。
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { read_file } from '../src/tools/builtins.js';
import { FILE_UNCHANGED_STUB } from '../src/tools/read-file-state.js';
import type { ToolContext } from '../src/tools/index.js';

describe('read_file file_unchanged 短路', () => {
  let workDir: string;
  let ctx: ToolContext;

  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-read-unchanged-'));
    ctx = { workspacePath: workDir };
  });

  afterEach(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  it('① 同 ctx 重复读未改文件 ⇒ 第二次回 Wasted call stub,且比正文短', async () => {
    // 正文刻意造 20 行:stub 只有一句话,超短文件(3 行)的渲染正文会比 stub 还短,
    // "短路省上下文"的收益断言必须有可比的量纲。
    fs.writeFileSync(
      path.join(workDir, 'a.txt'),
      Array.from({ length: 20 }, (_, i) => `line-${i + 1}-with-some-content-to-make-it-longer`).join('\n'),
    );
    const first = await read_file.execute({ path: 'a.txt' }, ctx);
    expect(first.success).toBe(true);
    expect(first.output).toContain('line-20');

    const second = await read_file.execute({ path: 'a.txt' }, ctx);
    expect(second.success).toBe(true);
    expect(second.output).toBe(FILE_UNCHANGED_STUB);
    expect(second.output.length).toBeLessThan(first.output.length);
  });

  it('② 外部改写(mtime/size 都变) ⇒ 缓存失效,重新读到新内容', async () => {
    const abs = path.join(workDir, 'b.txt');
    fs.writeFileSync(abs, 'v1');
    await read_file.execute({ path: 'b.txt' }, ctx);

    fs.writeFileSync(abs, 'v2-much-longer-content');
    const past = new Date(Date.now() - 60_000);
    fs.utimesSync(abs, past, past);

    const second = await read_file.execute({ path: 'b.txt' }, ctx);
    expect(second.success).toBe(true);
    expect(second.output).not.toBe(FILE_UNCHANGED_STUB);
    expect(second.output).toContain('v2-much-longer-content');
  });

  it('③ 同尺寸改写 + mtime 变了 ⇒ 仍判 stale(比 size 兜底更严的主判据)', async () => {
    const abs = path.join(workDir, 'c.txt');
    fs.writeFileSync(abs, 'AAAA');
    await read_file.execute({ path: 'c.txt' }, ctx);

    fs.writeFileSync(abs, 'BBBB');
    const past = new Date(Date.now() - 120_000);
    fs.utimesSync(abs, past, past);

    const second = await read_file.execute({ path: 'c.txt' }, ctx);
    expect(second.output).not.toBe(FILE_UNCHANGED_STUB);
    expect(second.output).toContain('BBBB');
  });

  it('④ 状态按 ctx 隔离:新 ctx 首读照常回内容', async () => {
    fs.writeFileSync(path.join(workDir, 'd.txt'), 'hello');
    const otherCtx: ToolContext = { workspacePath: workDir };
    await read_file.execute({ path: 'd.txt' }, ctx);
    const fromOther = await read_file.execute({ path: 'd.txt' }, otherCtx);
    expect(fromOther.output).toContain('hello');
  });

  it('⑤ 行数闸截断的视图(partial)永不短路:600 行文件重读仍回正文', async () => {
    const abs = path.join(workDir, 'big.txt');
    fs.writeFileSync(abs, Array.from({ length: 600 }, (_, i) => `line-${i + 1}`).join('\n'));
    const first = await read_file.execute({ path: 'big.txt' }, ctx);
    expect(first.success).toBe(true);
    expect(first.output).toContain('仅显示前 500 行');

    const second = await read_file.execute({ path: 'big.txt' }, ctx);
    expect(second.output).not.toBe(FILE_UNCHANGED_STUB);
    expect(second.output).toContain('仅显示前 500 行');
  });

  it('⑥ range view 独立 cacheKey:整读后指定窗口照常回内容,同参二读才短路', async () => {
    fs.writeFileSync(path.join(workDir, 'e.txt'), 'l1\nl2\nl3');
    await read_file.execute({ path: 'e.txt' }, ctx);

    const range = await read_file.execute({ path: 'e.txt', offset: 2, limit: 1 }, ctx);
    expect(range.success).toBe(true);
    expect(range.output).toContain('l2');

    const rangeAgain = await read_file.execute({ path: 'e.txt', offset: 2, limit: 1 }, ctx);
    expect(rangeAgain.output).toBe(FILE_UNCHANGED_STUB);

    // 整读路径的缓存不受 range 读影响
    const whole = await read_file.execute({ path: 'e.txt' }, ctx);
    expect(whole.output).toBe(FILE_UNCHANGED_STUB);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
