// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Git worktree 管理 — 为 subagent 创建隔离工作区,对齐 AGENTS.md 第 12 节
 * "多 Subagent 并行开发强制规则"的分支隔离要求(每个 Subagent 在 subagent/<id> 分支工作)。
 *
 * 做减法:
 *   - 仅封装 git worktree add / list / remove / prune,不维护本地缓存
 *   - 路径默认 .worktrees/<id>(相对 sourcePath),由调用方保证 .gitignore 已忽略
 *   - 遵守 AGENTS.md 第 8 节删除安全规则:removeWorktree 前必须确认 subagent 已结束
 *   - git 操作用 child_process spawnSync,不引入新依赖
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  createWorktree as createWorktreeCoW,
} from '../worktree.js';

export interface WorktreeInfo {
  path: string;
  branch: string;
  parentId: string;
  subagentId: string;
  createdAt: string;
}

const WORKTREE_DIR_ENV = 'IHUI_WORKTREE_DIR';

/**
 * IHUI_WORKTREE_DIR 落点护栏(2026-10-15 立,AGENTS.md §15b:项目产物不外流)。
 *
 * 判据与 `apps/ai-service/app/services/worktree.py` 的 `_assert_worktree_dir_landing`
 * **逐字同源**(单一真相源:两处实现 + 注释互引、判据一字不差;2026-10-15 查证
 * packages/shared/src/utils 无现成 path 校验工具可复用,故按各自语言实现):
 *   ① 项目树内 `.worktrees/` 之下(含 `.worktrees` 本身);
 *   ② 任意盘的 `DevEnv` 根之下(部署环净面根同族,如 `D:\DevEnv\...`;
 *      Windows 盘符不区分大小写,故比较一律小写化)。
 * 其余值(盘根、TEMP、家目录、仓内其他目录、相对路径、含 `..` 的逃逸形)
 * 一律抛错 —— env 指错时的历史形态是在仓外长出一个无人申报的检出,正是
 * `scripts/check-disk-root-hygiene.mjs` H2 维点名的那一类。
 * 默认行为不变:不设 env 时仍落仓内 `.worktrees/`。
 *
 * @param envValue IHUI_WORKTREE_DIR 的当时值(调用方保证非空)
 * @param sourcePath 源仓库路径
 */
export function assertWorktreeDirLanding(envValue: string, sourcePath: string): void {
  const isWin = process.platform === 'win32';
  const key = (p: string): string => {
    // 先解析成绝对归一形:吃掉 .. 逃逸(如 <src>/.worktrees/../../evil)与相对值,
    // 再统一分隔符;Windows 上盘符大小写不敏感 ⇒ 小写化后比较。
    const abs = path.resolve(p).replace(/\\/g, '/');
    return isWin ? abs.toLowerCase() : abs;
  };
  const v = key(envValue);
  const src = key(sourcePath);
  const inRepoWorktrees = v === `${src}/.worktrees` || v.startsWith(`${src}/.worktrees/`);
  const inDevEnv = /^[a-z]:\/devenv(\/|$)/.test(v);
  if (!inRepoWorktrees && !inDevEnv) {
    throw new Error(
      `IHUI_WORKTREE_DIR 必须落在项目 .worktrees/ 或 DevEnv 内(§15b 项目产物不外流):收到 ${envValue}(源仓库 ${sourcePath})`,
    );
  }
}

export function getDefaultWorktreeRoot(sourcePath: string): string {
  const env = process.env[WORKTREE_DIR_ENV];
  if (env) {
    assertWorktreeDirLanding(env, sourcePath);
    return env;
  }
  return path.join(sourcePath, '.worktrees');
}

export function worktreeBranchName(subagentId: string): string {
  return `subagent/${subagentId}`;
}

interface GitResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

function runGit(args: string[], cwd: string): GitResult {
  const r = spawnSync('git', args, {
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd,
    encoding: 'utf-8',
    windowsHide: true,
  });
  return {
    ok: r.status === 0,
    stdout: typeof r.stdout === 'string' ? r.stdout.trim() : '',
    stderr: typeof r.stderr === 'string' ? r.stderr.trim() : '',
  };
}

function ensureGitignoreEntry(sourcePath: string, entry: string): void {
  const gitignorePath = path.join(sourcePath, '.gitignore');
  let content = '';
  if (fs.existsSync(gitignorePath)) {
    content = fs.readFileSync(gitignorePath, 'utf-8');
  }
  if (content.split(/\r?\n/).includes(entry)) return;
  const newline = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
  fs.writeFileSync(gitignorePath, content + newline + entry + '\n', 'utf-8');
}

export function createWorktree(
  parentId: string,
  subagentId: string,
  sourcePath: string,
): WorktreeInfo {
  const root = getDefaultWorktreeRoot(sourcePath);
  if (!fs.existsSync(root)) {
    fs.mkdirSync(root, { recursive: true });
  }
  ensureGitignoreEntry(sourcePath, '.worktrees/');

  const wtPath = path.join(root, subagentId);
  const branch = worktreeBranchName(subagentId);

  if (fs.existsSync(wtPath)) {
    throw new Error(`worktree 路径已存在: ${wtPath}`);
  }

  const head = runGit(['rev-parse', '--abbrev-ref', 'HEAD'], sourcePath);
  const startPoint = head.ok ? head.stdout : 'HEAD';

  const addResult = runGit(
    ['worktree', 'add', '-b', branch, wtPath, startPoint],
    sourcePath,
  );
  if (!addResult.ok) {
    throw new Error(`git worktree add 失败: ${addResult.stderr || addResult.stdout}`);
  }

  return {
    path: wtPath,
    branch,
    parentId,
    subagentId,
    createdAt: new Date().toISOString(),
  };
}

export function listWorktrees(sourcePath: string): WorktreeInfo[] {
  const r = runGit(['worktree', 'list', '--porcelain'], sourcePath);
  if (!r.ok) return [];
  const out: WorktreeInfo[] = [];
  let curPath = '';
  let curBranch = '';
  for (const line of r.stdout.split(/\r?\n/)) {
    if (line.startsWith('worktree ')) {
      curPath = line.slice('worktree '.length).trim();
    } else if (line.startsWith('branch ')) {
      curBranch = line.slice('branch '.length).trim();
    } else if (line === '' && curPath && curBranch.startsWith('subagent/')) {
      const subagentId = curBranch.slice('subagent/'.length);
      out.push({
        path: curPath,
        branch: curBranch,
        parentId: '',
        subagentId,
        createdAt: '',
      });
      curPath = '';
      curBranch = '';
    }
  }
  if (curPath && curBranch.startsWith('subagent/')) {
    const subagentId = curBranch.slice('subagent/'.length);
    out.push({
      path: curPath,
      branch: curBranch,
      parentId: '',
      subagentId,
      createdAt: '',
    });
  }
  return out;
}

export interface RemoveWorktreeOptions {
  sourcePath: string;
  force?: boolean;
}

export function removeWorktree(
  wtPath: string,
  opts: RemoveWorktreeOptions,
): boolean {
  if (!fs.existsSync(wtPath)) return false;
  const args = ['worktree', 'remove', wtPath];
  if (opts.force) args.push('--force');
  const r = runGit(args, opts.sourcePath);
  if (!r.ok) {
    const rm = spawnSync('rm', ['-rf', wtPath], {
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    if (rm.error || rm.status !== 0) {
      throw new Error(`worktree 删除失败: ${r.stderr || r.stdout}`);
    }
  }
  return true;
}

export function pruneWorktrees(sourcePath: string): number {
  const before = listWorktrees(sourcePath);
  const r = runGit(['worktree', 'prune'], sourcePath);
  if (!r.ok) return 0;
  const after = listWorktrees(sourcePath);
  return Math.max(0, before.length - after.length);
}

/**
 * 创建 worktree(快路径优先,失败 fallback 到原 git worktree add)。
 *
 * 策略(P1-8 Fast Worktree CoW 集成):
 *   - useFastPath=false(默认):直接调原 createWorktree(git worktree add -b),零回归
 *   - useFastPath=true:先尝试 CoW 复制 + git checkout -b 建分支,失败则清理半成品目录后
 *     fallback 到原 createWorktree,保证最终一致
 *
 * CoW 路径与原路径语义对齐:都生成 subagent/<id> 分支、相同的 destination 路径、
 * 相同的 .gitignore 注入。区别仅在于 .git 是独立拷贝(非 linked worktree),
 * 因此不会被 git worktree list 列出,但 removeWorktree 会 fallback 到 rm -rf 清理。
 *
 * @param parentId 父会话 ID
 * @param subagentId subagent ID
 * @param sourcePath 源仓库路径
 * @param useFastPath 是否启用 CoW 快路径(feature flag,默认 false)
 * @returns WorktreeInfo + usedFastPath 标记 + cowKind(仅快路径成功时有值)
 */
export async function createWorktreeWithFallback(
  parentId: string,
  subagentId: string,
  sourcePath: string,
  useFastPath: boolean = false,
): Promise<WorktreeInfo & { usedFastPath: boolean; cowKind?: string }> {
  if (useFastPath) {
    const root = getDefaultWorktreeRoot(sourcePath);
    if (!fs.existsSync(root)) {
      fs.mkdirSync(root, { recursive: true });
    }
    ensureGitignoreEntry(sourcePath, '.worktrees/');
    const destination = path.join(root, subagentId);
    const branch = worktreeBranchName(subagentId);

    // 路径已存在时跳过 CoW(交给原函数抛出统一的“路径已存在”错误)
    if (!fs.existsSync(destination)) {
      try {
        // CoW 复制源工作树(含 .git),preserveWorkingTree=false 会 reset --hard
        const result = await createWorktreeCoW({
          source: sourcePath,
          destination,
          preserveWorkingTree: false,
        });

        // CoW 复制后 HEAD 与源一致,需创建 subagent/<id> 分支(等价 git worktree add -b)
        const checkout = runGit(['checkout', '-b', branch], destination);
        if (!checkout.ok) {
          throw new Error(
            `git checkout -b ${branch} 失败: ${checkout.stderr || checkout.stdout}`,
          );
        }

        return {
          path: result.destination,
          branch,
          parentId,
          subagentId,
          createdAt: new Date().toISOString(),
          usedFastPath: true,
          cowKind: result.cowKind,
        };
      } catch {
        // CoW 失败 → 清理半成品目录后 fallback 到原 git worktree add
        try {
          if (fs.existsSync(destination)) {
            fs.rmSync(destination, { recursive: true, force: true });
          }
        } catch {
          // 清理失败忽略,原 git worktree add 会因路径存在抛错
        }
      }
    }
  }

  // 原有逻辑:git worktree add -b <branch> <path> <startPoint>
  const wt = createWorktree(parentId, subagentId, sourcePath);
  return { ...wt, usedFastPath: false };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
