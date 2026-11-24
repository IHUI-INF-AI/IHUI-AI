// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Worktree 拆分公共核(goal-b49 Z16):常量、git 直调、命名、出声腿与管理条目类型。
 * 判据与措辞逐字节来自原 tools/worktree.ts(拆分零行为变更);公开出口仍是 tools/worktree.ts。
 */

import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execGit } from './git-shared.js';

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

/**
 * 执行 git 命令(统一走 `git-shared.ts#execGit`:resolveGitBinary 解析 + git-runner 分档预算
 * (本地 90s / 网络族 120s)+ 10MiB 输出帽 + env 白名单投影 + killSignal)。
 *
 * 失败分档一律经 stderr 透出,不得落成"空输出的失败":
 *  - 超时/输出超限 ⇒ `[git-capped] timeout|output-too-large ...`(且 stdout 已作废,不返回半截内容);
 *  - git 根本没跑起来(ENOENT/EACCES)⇒ `[git-spawn-error] git 不可用(CODE) ...`。
 * status 仍是三态语义(0 / 1 / 其它);被杀或没跑起来记 -1(与旧行为一致)。
 */
export function runGit(args: string[], cwd: string, opts?: { timeoutMs?: number }): GitResult {
  const r = execGit(args, cwd, opts?.timeoutMs === undefined ? {} : { timeoutMs: opts.timeoutMs });
  return {
    ok: r.exitCode === 0,
    // 被超时/超输出封顶杀、或 git 根本没跑起来 ⇒ exitCode=null ⇒ 与旧行为一致记 -1
    status: typeof r.exitCode === 'number' ? r.exitCode : -1,
    stdout: r.stdout.trim(),
    // 封顶档/派生失败档的诊断行(`[git-capped]` / `[git-spawn-error]`)已在 stderr 里 ⇒ 调用方可见
    stderr: r.stderr.trim(),
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
