// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 写类工具 × 终端 diff 预览门控的**装车证明**(不是 diff 算法单测)。
//
// 判的是三件事:
//   1) 预览在"捕获基线 / 打快照 / 原子写"之前发生 —— 放弃时磁盘一个字节都不该变;
//   2) 放弃路径必须返回可识别的 errorType(diff_preview_rejected),而不是伪装成成功或
//      落盘后再撤;
//   3) 批准路径确实照原样写入,预览不是只打印不接线的装饰。

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  createEditFileTool,
  createWriteFileTool,
  type EditToolContext,
} from '../src/tools/file-edit.js';
import type { EditPreview } from '../src/tools/diff-preview.js';

describe('写类工具执行前 diff 预览门', () => {
  let workDir: string;
  let origHooksConfig: string | undefined;

  function makeCtx(
    gate: (preview: EditPreview) => boolean | Promise<boolean>,
    seen: EditPreview[] = [],
  ): EditToolContext {
    return {
      workspacePath: workDir,
      diffPreviewGate: async (preview) => {
        seen.push(preview);
        return gate(preview);
      },
    };
  }

  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-diff-gate-'));
    origHooksConfig = process.env.IHUI_HOOKS_CONFIG;
    process.env.IHUI_HOOKS_CONFIG = path.join(workDir, 'no-hooks.json');
  });

  afterEach(() => {
    if (origHooksConfig === undefined) delete process.env.IHUI_HOOKS_CONFIG;
    else process.env.IHUI_HOOKS_CONFIG = origHooksConfig;
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  it('write_file 放弃 ⇒ 文件根本没创建,且 errorType 可识别', async () => {
    const seen: EditPreview[] = [];
    const ctx = makeCtx(() => false, seen);
    const tool = createWriteFileTool(ctx);

    const r = await tool.execute({ path: 'new.txt', content: 'hello\n' }, ctx);

    expect(r.success).toBe(false);
    expect(r.errorType).toBe('diff_preview_rejected');
    expect(fs.existsSync(path.join(workDir, 'new.txt'))).toBe(false);
    expect(seen).toHaveLength(1);
    expect(seen[0]!.kind).toBe('create');
    expect(seen[0]!.diff).toContain('+hello');
    expect(seen[0]!.addedLines).toBeGreaterThan(0);
  });

  it('write_file 批准 ⇒ 正常落盘,内容与预览一致', async () => {
    const seen: EditPreview[] = [];
    const ctx = makeCtx(() => true, seen);
    const tool = createWriteFileTool(ctx);

    const r = await tool.execute({ path: 'new.txt', content: 'hello\n' }, ctx);

    expect(r.success).toBe(true);
    expect(fs.readFileSync(path.join(workDir, 'new.txt'), 'utf-8')).toBe('hello\n');
    expect(seen).toHaveLength(1);
  });

  it('edit_file 放弃 ⇒ 原文件内容与 mtime 都不变(零写入)', async () => {
    const seen: EditPreview[] = [];
    // 预置写与待测编辑必须共用同一个 ctx:read-before-write 状态挂在该 ctx 的 map 上,
    // 换 ctx 会退化成 file_not_read,测不到 diff 门。
    let gateAnswer = true;
    const ctx: EditToolContext = {
      workspacePath: workDir,
      diffPreviewGate: async (preview) => {
        seen.push(preview);
        return gateAnswer;
      },
    };
    await createWriteFileTool(ctx).execute({ path: 'a.txt', content: 'alpha\nbeta\n' }, ctx);
    seen.length = 0;
    gateAnswer = false;
    const abs = path.join(workDir, 'a.txt');
    const before = fs.readFileSync(abs, 'utf-8');
    const beforeStat = fs.statSync(abs);

    const r = await createEditFileTool(ctx).execute(
      { path: 'a.txt', search: 'beta', replace: 'BETA' },
      ctx,
    );

    expect(r.success).toBe(false);
    expect(r.errorType).toBe('diff_preview_rejected');
    expect(fs.readFileSync(abs, 'utf-8')).toBe(before);
    expect(fs.statSync(abs).mtimeMs).toBe(beforeStat.mtimeMs);
    expect(seen[0]!.kind).toBe('modify');
    expect(seen[0]!.diff).toContain('-beta');
    expect(seen[0]!.diff).toContain('+BETA');
  });

  it('edit_file 批准 ⇒ 真正替换', async () => {
    const ctx = makeCtx(() => true);
    await createWriteFileTool(ctx).execute({ path: 'a.txt', content: 'alpha\nbeta\n' }, ctx);

    const r = await createEditFileTool(ctx).execute(
      { path: 'a.txt', search: 'beta', replace: 'BETA' },
      ctx,
    );

    expect(r.success).toBe(true);
    expect(fs.readFileSync(path.join(workDir, 'a.txt'), 'utf-8')).toBe('alpha\nBETA\n');
  });

  it('未注入门控 ⇒ 保持旧行为(直接写入,不弹预览)', async () => {
    const ctx: EditToolContext = { workspacePath: workDir };
    const r = await createWriteFileTool(ctx).execute({ path: 'plain.txt', content: 'x' }, ctx);

    expect(r.success).toBe(true);
    expect(fs.readFileSync(path.join(workDir, 'plain.txt'), 'utf-8')).toBe('x');
  });

  it('预览不可用(search 未命中)⇒ 不拦截,交给原工具报 OLD_STRING_NOT_FOUND', async () => {
    let gateCalls = 0;
    const ctx: EditToolContext = {
      workspacePath: workDir,
      diffPreviewGate: () => {
        gateCalls += 1;
        return false;
      },
    };
    // 预置写入也走同一 ctx(diff 门对 create+applyable 会放行?不会:这里 gate 返回 false,
    // 所以预置写入必须绕开门。改用无门的独立工具写,再让同一 ctx 读取?read 状态在 ctx 上,
    // 只能用同一个 ctx 写。故此处先放行一次。
    const setupTool = createWriteFileTool(ctx);
    const originalGate = ctx.diffPreviewGate;
    ctx.diffPreviewGate = () => true;
    await setupTool.execute({ path: 'a.txt', content: 'alpha\n' }, ctx);
    ctx.diffPreviewGate = originalGate;
    const r = await createEditFileTool(ctx).execute(
      { path: 'a.txt', search: 'not-present-anywhere', replace: 'x' },
      ctx,
    );

    expect(gateCalls).toBe(0);
    expect(r.success).toBe(false);
    expect(String(r.errorType)).toContain('OLD_STRING_NOT_FOUND');
  });
});
