// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-027 回归:.gitignore 为 UTF-16/GBK 时增删 worktree 曾把用户既有忽略规则覆盖成乱码。
 *
 * 判据:用户 .gitignore 的字节在调用前后必须逐字节相等(非 UTF-8 时一个字节都不许动),
 * 同时隔离目录仍要被忽略 —— 修法把忽略规则写进 .git/info/exclude,不改用户文件。
 * UTF-8 的 .gitignore 行为不变:原地追加且只追加一次。
 * 全部落在 os.tmpdir() 的临时仓,不碰工作树。
 */

import { afterEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DEFAULT_WORKTREE_DIR } from '../src/tools/worktree-core.js';
import { createAgentWorktree, ensureWorktreeGitignore } from '../src/tools/worktree-state.js';

const ENTRY = DEFAULT_WORKTREE_DIR + '/';
const tmpDirs: string[] = [];

function git(cwd: string, args: string[]): string {
  const r = spawnSync('git', args, { cwd, encoding: 'utf-8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} 失败: ${r.stderr || r.stdout}`);
  return (r.stdout ?? '').trim();
}

function makeRepo(): string {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-f027-'));
  tmpDirs.push(repo);
  git(repo, ['init']);
  git(repo, ['config', 'user.email', 'test@ihui.local']);
  git(repo, ['config', 'user.name', 'Test']);
  git(repo, ['config', 'commit.gpgsign', 'false']);
  fs.writeFileSync(path.join(repo, 'README.md'), 'base\n', 'utf-8');
  git(repo, ['add', 'README.md']);
  git(repo, ['commit', '-m', 'init']);
  return repo;
}

/** 隔离目录下新增的副本若未被忽略,status 会露出 `?? .worktrees/` */
function isWorktreesIgnored(repo: string): boolean {
  return git(repo, ['status', '--porcelain', '--', DEFAULT_WORKTREE_DIR]) === '';
}

function excludePath(repo: string): string {
  return path.join(repo, '.git', 'info', 'exclude');
}

afterEach(() => {
  while (tmpDirs.length > 0) {
    const dir = tmpDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('F-027 非 UTF-8 的 .gitignore 不被回写', () => {
  it('UTF-16LE(带 BOM)增 worktree 后原文逐字节不变,隔离目录仍被忽略', () => {
    const repo = makeRepo();
    const gitignore = path.join(repo, '.gitignore');
    const original = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('*.log\r\n/built/\r\n', 'utf16le')]);
    fs.writeFileSync(gitignore, original);

    createAgentWorktree(repo, path.join(repo, DEFAULT_WORKTREE_DIR), 'agent-utf16');

    expect(fs.readFileSync(gitignore).equals(original)).toBe(true);
    expect(fs.readFileSync(excludePath(repo), 'utf-8')).toContain(ENTRY);
    expect(isWorktreesIgnored(repo)).toBe(true);
  });

  it('GBK 增 worktree 后原文逐字节不变,隔离目录仍被忽略', () => {
    const repo = makeRepo();
    const gitignore = path.join(repo, '.gitignore');
    // "构建/\n*.tmp\n" 的 GBK 字节:含孤立高位字节,按 utf-8 回读/回写必成乱码
    const original = Buffer.from([0xb9, 0xb9, 0xbd, 0xa8, 0x2f, 0x0a, 0x2a, 0x2e, 0x74, 0x6d, 0x70, 0x0a]);
    fs.writeFileSync(gitignore, original);

    createAgentWorktree(repo, path.join(repo, DEFAULT_WORKTREE_DIR), 'agent-gbk');

    expect(fs.readFileSync(gitignore).equals(original)).toBe(true);
    expect(isWorktreesIgnored(repo)).toBe(true);
  });

  it('GBK 重复调用也不动原文,exclude 里只留一条隔离规则', () => {
    const repo = makeRepo();
    const gitignore = path.join(repo, '.gitignore');
    const original = Buffer.from([0xb9, 0xb9, 0xbd, 0xa8, 0x2f, 0x0a]);
    fs.writeFileSync(gitignore, original);

    ensureWorktreeGitignore(repo);
    ensureWorktreeGitignore(repo);

    expect(fs.readFileSync(gitignore).equals(original)).toBe(true);
    const lines = fs.readFileSync(excludePath(repo), 'utf-8').split(/\r?\n/).filter((line) => line === ENTRY);
    expect(lines).toHaveLength(1);
  });
});

describe('F-027 UTF-8 的 .gitignore 行为不变', () => {
  it('正常 UTF-8 文件仍原地追加,且只追加一次', () => {
    const repo = makeRepo();
    const gitignore = path.join(repo, '.gitignore');
    fs.writeFileSync(gitignore, '*.log\n', 'utf-8');

    ensureWorktreeGitignore(repo);
    expect(fs.readFileSync(gitignore, 'utf-8')).toBe('*.log\n' + ENTRY + '\n');

    ensureWorktreeGitignore(repo);
    expect(fs.readFileSync(gitignore, 'utf-8')).toBe('*.log\n' + ENTRY + '\n');
  });

  it('末尾无换行的 UTF-8 文件先补换行再追加,且不改走 exclude', () => {
    const repo = makeRepo();
    const gitignore = path.join(repo, '.gitignore');
    fs.writeFileSync(gitignore, '*.log', 'utf-8');

    ensureWorktreeGitignore(repo);

    expect(fs.readFileSync(gitignore, 'utf-8')).toBe('*.log\n' + ENTRY + '\n');
    expect(fs.readFileSync(excludePath(repo), 'utf-8')).not.toContain(ENTRY);
  });

  it('增 worktree 后既有规则原样保留,只多出隔离条目', () => {
    const repo = makeRepo();
    const gitignore = path.join(repo, '.gitignore');
    fs.writeFileSync(gitignore, '/dist\n*.log\n', 'utf-8');

    createAgentWorktree(repo, path.join(repo, DEFAULT_WORKTREE_DIR), 'agent-utf8');

    expect(fs.readFileSync(gitignore, 'utf-8')).toBe('/dist\n*.log\n' + ENTRY + '\n');
    expect(isWorktreesIgnored(repo)).toBe(true);
  });

  it('已含隔离条目时不改字节(幂等)', () => {
    const repo = makeRepo();
    const gitignore = path.join(repo, '.gitignore');
    const original = Buffer.from('/dist\n' + ENTRY + '\n', 'utf-8');
    fs.writeFileSync(gitignore, original);

    ensureWorktreeGitignore(repo);

    expect(fs.readFileSync(gitignore).equals(original)).toBe(true);
  });
});
