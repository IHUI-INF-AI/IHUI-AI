// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Worktree 拆分公共核(goal-b49 Z16):常量、git 直调、命名、出声腿与管理条目类型。
 * 判据与措辞逐字节来自原 tools/worktree.ts(拆分零行为变更);公开出口仍是 tools/worktree.ts。
 */

import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

/** agent 专属 worktree 分支前缀(唯一分支名 agent-wt-<uuid8>) */
export const AGENT_BRANCH_PREFIX = 'agent-wt-';

/** 默认隔离目录名(相对 sourcePath) */
export const DEFAULT_WORKTREE_DIR = '.worktrees';

/** diff 输出最大长度(超过截断,避免撑爆主 agent context) */
export const MAX_DIFF_LENGTH = 4000;

export interface GitResult {
  ok: boolean;
  /** 退出码(killed/未跑起来为 -1)。`merge-base --is-ancestor` 靠 0/1/其它 三态分辨"并入/未并入/判不出" */
  status: number;
  stdout: string;
  stderr: string;
}

/** 执行 git 命令(spawnSync 直调,非 shell,Windows 兼容) */
export function runGit(args: string[], cwd: string): GitResult {
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  const r = spawnSync('git', args, {
    cwd,
    encoding: 'utf-8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return {
    ok: r.status === 0,
    status: typeof r.status === 'number' ? r.status : -1,
    stdout: typeof r.stdout === 'string' ? r.stdout.trim() : '',
    stderr: typeof r.stderr === 'string' ? r.stderr.trim() : '',
  };
}

/** 生成 8 位 uuid 随机段(去掉连字符取前 8 位,并发冲突概率可忽略) */
export function uuid8(): string {
  return randomUUID().replace(/-/g, '').slice(0, 8);
}

/** 生成唯一的 agent worktree 分支名:agent-wt-<uuid8> */
export function agentBranchName(): string {
  return AGENT_BRANCH_PREFIX + uuid8();
}

/** 默认 worktree 根目录:.worktrees(相对 sourcePath) */
export function getDefaultWorktreeRoot(sourcePath: string): string {
  return path.join(sourcePath, DEFAULT_WORKTREE_DIR);
}

/**
 * 删除出口的统一出声腿(goal-b49 W5):容器性拒 / advisory 命中都先落 stderr,
 * 保证"即便上层 catch 吞掉抛错,这一声仍然响"(§0.9/§0.10 —— 不得把判拒洗成静默)。
 * 报名通道不可用不改判据结论。
 */
export function emitWorktreeVoice(line: string): void {
  try {
    process.stderr.write(`${line}\n`);
  } catch {
    // 报名通道不可用不改判据结论
  }
}

/** 单个 agent worktree 条目(list 返回) */
export interface WorktreeEntry {
  /** agent 标识(即隔离目录名) */
  agentId: string;
  /** worktree 绝对路径 */
  path: string;
  /** 分支名(agent-wt-<uuid8>) */
  branch: string;
  /** 目录是否真实存在(false = 孤儿 worktree,目录已被外部删除) */
  dirExists: boolean;
}

/** create 返回的创建结果 */
export interface WorktreeCreateResult {
  agentId: string;
  path: string;
  branch: string;
  createdAt: string;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
