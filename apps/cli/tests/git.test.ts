/**
 * Git 工具集测试 — git_status / git_diff / git_log / git_add / git_commit
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { GIT_TOOLS } from '../src/tools/git.js';
import type { ToolContext } from '../src/tools/index.js';

const gitStatus = GIT_TOOLS.find((t) => t.name === 'git_status')!;
const gitDiff = GIT_TOOLS.find((t) => t.name === 'git_diff')!;
const gitLog = GIT_TOOLS.find((t) => t.name === 'git_log')!;
const gitAdd = GIT_TOOLS.find((t) => t.name === 'git_add')!;
const gitCommit = GIT_TOOLS.find((t) => t.name === 'git_commit')!;

function gitInit(repoDir: string): void {
  spawnSync('git', ['init'], { cwd: repoDir, encoding: 'utf-8' });
  spawnSync('git', ['config', 'user.email', 'test@ihui.local'], { cwd: repoDir, encoding: 'utf-8' });
  spawnSync('git', ['config', 'user.name', 'Test'], { cwd: repoDir, encoding: 'utf-8' });
  spawnSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: repoDir, encoding: 'utf-8' });
}

describe('GIT_TOOLS 注册', () => {
  it('注册 5 个 git 工具', () => {
    expect(GIT_TOOLS).toHaveLength(5);
    const names = GIT_TOOLS.map((t) => t.name).sort();
    expect(names).toEqual(['git_add', 'git_commit', 'git_diff', 'git_log', 'git_status']);
  });

  it('git_add 危险级别 write,git_commit dangerous,读工具无 dangerLevel', () => {
    expect(gitAdd.dangerLevel).toBe('write');
    expect(gitCommit.dangerLevel).toBe('dangerous');
    expect(gitStatus.dangerLevel).toBeUndefined();
    expect(gitDiff.dangerLevel).toBeUndefined();
    expect(gitLog.dangerLevel).toBeUndefined();
  });
});

describe('git 工具(临时仓库)', () => {
  let repoDir: string;
  let ctx: ToolContext;
  let origHooksConfig: string | undefined;

  beforeEach(() => {
    repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-git-'));
    gitInit(repoDir);
    ctx = { workspacePath: repoDir };
    // 隔离 hooks:指向不存在的配置文件,确保 runPreToolCall 返回 proceed=true
    origHooksConfig = process.env.IHUI_HOOKS_CONFIG;
    process.env.IHUI_HOOKS_CONFIG = path.join(repoDir, 'no-hooks.json');
  });

  afterEach(() => {
    if (origHooksConfig === undefined) {
      delete process.env.IHUI_HOOKS_CONFIG;
    } else {
      process.env.IHUI_HOOKS_CONFIG = origHooksConfig;
    }
    fs.rmSync(repoDir, { recursive: true, force: true });
  });

  it('git_status 空仓库返回成功', async () => {
    const r = await gitStatus.execute({}, ctx);
    expect(r.success).toBe(true);
  });

  it('git_status --porcelain 显示未跟踪文件(?? 前缀)', async () => {
    fs.writeFileSync(path.join(repoDir, 'a.txt'), 'a', 'utf-8');
    const r = await gitStatus.execute({ porcelain: true }, ctx);
    expect(r.success).toBe(true);
    expect(r.output).toContain('??');
    expect(r.output).toContain('a.txt');
  });

  it('git_diff 无改动返回成功', async () => {
    const r = await gitDiff.execute({}, ctx);
    expect(r.success).toBe(true);
  });

  it('git_log 无提交时返回非零退出码', async () => {
    const r = await gitLog.execute({ oneline: true }, ctx);
    expect(r.success).toBe(false);
    expect(r.error).toContain('git 退出码');
  });

  it('git_add 缺少 files 参数返回错误', async () => {
    const r = await gitAdd.execute({}, ctx);
    expect(r.success).toBe(false);
    expect(r.error).toContain('files');
  });

  it('git_add 空数组返回错误', async () => {
    const r = await gitAdd.execute({ files: [] }, ctx);
    expect(r.success).toBe(false);
    expect(r.error).toContain('files');
  });

  it('git_add 成功暂存文件(porcelain 显示 A 前缀)', async () => {
    fs.writeFileSync(path.join(repoDir, 'b.txt'), 'b', 'utf-8');
    const r = await gitAdd.execute({ files: ['b.txt'] }, ctx);
    expect(r.success).toBe(true);
    const status = await gitStatus.execute({ porcelain: true }, ctx);
    expect(status.output.trim()).toMatch(/^A\s+b\.txt/);
  });

  it('git_commit 缺少 message 返回错误', async () => {
    const r = await gitCommit.execute({}, ctx);
    expect(r.success).toBe(false);
    expect(r.error).toContain('message');
  });

  it('git_add + git_commit 完整提交流程', async () => {
    fs.writeFileSync(path.join(repoDir, 'c.txt'), 'c', 'utf-8');
    await gitAdd.execute({ files: ['c.txt'] }, ctx);
    const r = await gitCommit.execute({ message: 'feat: add c' }, ctx);
    expect(r.success).toBe(true);
    const log = await gitLog.execute({ oneline: true }, ctx);
    expect(log.success).toBe(true);
    expect(log.output).toContain('feat: add c');
  });

  it('git_commit --amend 修改上次提交(不增加提交数)', async () => {
    fs.writeFileSync(path.join(repoDir, 'd.txt'), 'd', 'utf-8');
    await gitAdd.execute({ files: ['d.txt'] }, ctx);
    await gitCommit.execute({ message: 'first' }, ctx);
    const r = await gitCommit.execute({ message: 'first', amend: true }, ctx);
    expect(r.success).toBe(true);
    const log = await gitLog.execute({ oneline: true, count: 5 }, ctx);
    expect(log.output).toContain('first');
    const commits = log.output.split('\n').filter((l) => l.trim());
    expect(commits).toHaveLength(1);
  });

  it('git_log count 参数限制提交数', async () => {
    for (let i = 0; i < 3; i++) {
      fs.writeFileSync(path.join(repoDir, `f${i}.txt`), String(i), 'utf-8');
      await gitAdd.execute({ files: [`f${i}.txt`] }, ctx);
      await gitCommit.execute({ message: `commit ${i}` }, ctx);
    }
    const log = await gitLog.execute({ oneline: true, count: 2 }, ctx);
    expect(log.success).toBe(true);
    const lines = log.output.split('\n').filter((l) => l.trim());
    expect(lines).toHaveLength(2);
  });

  it('git_log path 参数仅显示影响该路径的提交', async () => {
    fs.writeFileSync(path.join(repoDir, 'x.txt'), 'x', 'utf-8');
    await gitAdd.execute({ files: ['x.txt'] }, ctx);
    await gitCommit.execute({ message: 'add x' }, ctx);
    fs.writeFileSync(path.join(repoDir, 'y.txt'), 'y', 'utf-8');
    await gitAdd.execute({ files: ['y.txt'] }, ctx);
    await gitCommit.execute({ message: 'add y' }, ctx);
    const log = await gitLog.execute({ oneline: true, path: 'x.txt' }, ctx);
    expect(log.success).toBe(true);
    expect(log.output).toContain('add x');
    expect(log.output).not.toContain('add y');
  });

  it('git_diff --staged 显示已暂存差异', async () => {
    fs.writeFileSync(path.join(repoDir, 'z.txt'), 'z', 'utf-8');
    await gitAdd.execute({ files: ['z.txt'] }, ctx);
    const r = await gitDiff.execute({ staged: true }, ctx);
    expect(r.success).toBe(true);
    expect(r.output).toContain('z.txt');
  });
});
