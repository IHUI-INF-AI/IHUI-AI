// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 按工作区本地索引开关 — 判据测试(2026-11-04 立)。
 * 覆盖:默认 off 不建 / 显式 off 不建 / 非法值回落 off / workspace 只索引本工作区 /
 * 越界路径被拒 / 符号链接不跟随 / 文件数超限拒绝 / 字节数超限拒绝 / 清除无残留 /
 * 产物不在工作区内。全部用临时目录 + 临时 cacheRoot,不碰真实 HOME。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
  buildWorkspaceIndex,
  clearWorkspaceIndex,
  getWorkspaceIndexDir,
  isInsideWorkspace,
  MAX_INDEX_BYTES,
  MAX_INDEX_FILES,
  resolveWorkspaceIndexMode,
  resolveWorkspacePath,
  WorkspaceIndexLimitError,
  WorkspaceIndexScopeError,
} from '../src/codegraph/workspace-index';

let sandbox: string;
let workspace: string;
let outside: string;
let cacheRoot: string;

function write(rel: string, content = 'export const x = 1\n') {
  const abs = path.join(workspace, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf-8');
  return abs;
}

beforeEach(() => {
  sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-ws-index-'));
  workspace = path.join(sandbox, 'workspace');
  outside = path.join(sandbox, 'outside');
  cacheRoot = path.join(sandbox, 'cache');
  fs.mkdirSync(workspace, { recursive: true });
  fs.mkdirSync(outside, { recursive: true });
  fs.writeFileSync(path.join(outside, 'other.ts'), 'export const o = 1\n', 'utf-8');
});

afterEach(() => {
  fs.rmSync(sandbox, { recursive: true, force: true });
});

describe('开关判定', () => {
  it('未设置 ⇒ 默认 off,且不创建索引目录', async () => {
    const decision = resolveWorkspaceIndexMode(undefined);
    expect(decision.mode).toBe('off');
    expect(decision.reason).toContain('默认 off');
    const result = await buildWorkspaceIndex({ workspaceRoot: workspace, mode: 'off', cacheRoot });
    expect(result.built).toBe(false);
    expect(result.indexPath).toBeNull();
    expect(fs.existsSync(getWorkspaceIndexDir(workspace, cacheRoot))).toBe(false);
  });

  it('显式 off ⇒ 不建索引', async () => {
    expect(resolveWorkspaceIndexMode('off').mode).toBe('off');
    const result = await buildWorkspaceIndex({ workspaceRoot: workspace, mode: 'off', cacheRoot });
    expect(result).toMatchObject({ built: false, mode: 'off', files: 0, bytes: 0 });
  });

  it('非法取值 ⇒ 回落 off 并把原因写进结论', () => {
    const decision = resolveWorkspaceIndexMode('all');
    expect(decision.mode).toBe('off');
    expect(decision.reason).toContain('回落到 off');
    expect(decision.requested).toBe('all');
  });
});

describe('workspace 模式范围', () => {
  it('只索引本工作区文件,不读同级的其他目录', async () => {
    write('src/a.ts');
    write('src/nested/b.ts');
    write('README.md', '# doc\n');
    write('.env.ts', 'secret\n');
    const result = await buildWorkspaceIndex({ workspaceRoot: workspace, mode: 'workspace', cacheRoot });
    expect(result.built).toBe(true);
    expect(result.files).toBe(2);
    const raw = fs.readFileSync(result.indexPath as string, 'utf-8');
    expect(raw).not.toContain('other.ts');
    expect(raw).not.toContain('..');
    expect(raw).not.toContain(outside.replace(/\\/g, '/'));
    expect(raw).toContain('src/a.ts');
    expect(raw).toContain('src/nested/b.ts');
  });

  it('索引产物落在工作区之外(不进 git)', async () => {
    write('src/a.ts');
    const result = await buildWorkspaceIndex({ workspaceRoot: workspace, mode: 'workspace', cacheRoot });
    expect(isInsideWorkspace(workspace, result.indexPath as string)).toBe(false);
    expect(fs.readdirSync(workspace).filter((n) => n === '.ihui')).toEqual([]);
  });

  it('父目录路径越界被拒(WorkspaceIndexScopeError)', async () => {
    expect(() => resolveWorkspacePath(workspace, '../outside/other.ts')).toThrow(WorkspaceIndexScopeError);
    expect(isInsideWorkspace(workspace, '../outside')).toBe(false);
    // 同前缀但不同目录的兄弟目录也不能被当成"在工作区内"
    expect(isInsideWorkspace(workspace, '../workspace-evil/x.ts')).toBe(false);
    // 内部子目录正常放行
    expect(isInsideWorkspace(workspace, 'src/nested')).toBe(true);
    await expect(
      buildWorkspaceIndex({ workspaceRoot: workspace, mode: 'workspace', subdir: '../outside', cacheRoot }),
    ).rejects.toBeInstanceOf(WorkspaceIndexScopeError);
  });

  it('指向工作区外的符号链接不被跟随', async () => {
    write('src/a.ts');
    const linkPath = path.join(workspace, 'linked');
    try {
      fs.symlinkSync(outside, linkPath, 'junction');
    } catch {
      return; // 无权限建链接的环境跳过(不掩盖其它断言)
    }
    const result = await buildWorkspaceIndex({ workspaceRoot: workspace, mode: 'workspace', cacheRoot });
    const raw = fs.readFileSync(result.indexPath as string, 'utf-8');
    expect(result.files).toBe(1);
    expect(raw).not.toContain('other.ts');
    expect(raw).not.toContain('linked/');
  });
});

describe('硬阈值', () => {
  it('文件数超限 ⇒ 拒绝建索引并带实际值与上限', async () => {
    for (let i = 0; i < 5; i += 1) write(`src/f${i}.ts`);
    const err = await buildWorkspaceIndex({
      workspaceRoot: workspace,
      mode: 'workspace',
      cacheRoot,
      fileLimit: 3,
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(WorkspaceIndexLimitError);
    expect((err as WorkspaceIndexLimitError).dimension).toBe('files');
    expect((err as WorkspaceIndexLimitError).actual).toBe(5);
    expect((err as WorkspaceIndexLimitError).limit).toBe(3);
    expect((err as WorkspaceIndexLimitError).message).toContain('拒绝建索引');
    expect(fs.existsSync(getWorkspaceIndexDir(workspace, cacheRoot))).toBe(false);
  });

  it('字节数超限 ⇒ 拒绝建索引,不落半份索引', async () => {
    write('src/big.ts', 'x'.repeat(2048));
    const err = await buildWorkspaceIndex({
      workspaceRoot: workspace,
      mode: 'workspace',
      cacheRoot,
      byteLimit: 1024,
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(WorkspaceIndexLimitError);
    expect((err as WorkspaceIndexLimitError).dimension).toBe('bytes');
    expect((err as WorkspaceIndexLimitError).message).toContain('拒绝建索引');
    expect(fs.existsSync(getWorkspaceIndexDir(workspace, cacheRoot))).toBe(false);
  });

  it('默认阈值是硬编码上限(文件数与字节数都非 0)', () => {
    expect(MAX_INDEX_FILES).toBeGreaterThan(0);
    expect(MAX_INDEX_BYTES).toBeGreaterThan(0);
    expect(MAX_INDEX_BYTES).toBeLessThanOrEqual(256 * 1024 * 1024);
  });
});

describe('一键清除', () => {
  it('清除后目录不存在,重复清除幂等', async () => {
    write('src/a.ts');
    const result = await buildWorkspaceIndex({ workspaceRoot: workspace, mode: 'workspace', cacheRoot });
    expect(fs.existsSync(result.indexPath as string)).toBe(true);
    const cleared = clearWorkspaceIndex(workspace, cacheRoot);
    expect(cleared.removed).toBe(true);
    expect(fs.existsSync(getWorkspaceIndexDir(workspace, cacheRoot))).toBe(false);
    expect(fs.readdirSync(workspace).every((n) => n !== '.ihui')).toBe(true);
    expect(clearWorkspaceIndex(workspace, cacheRoot).removed).toBe(false);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
