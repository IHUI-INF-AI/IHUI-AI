// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话级工具 exit_worktree 与工具族登记(goal-b49 Z16 自 tools/worktree.ts 逐字拆出,零行为变更)。
 */

import type { Tool } from './index.js';
import {
  fireWorktreeHook,
  judgeWorktreeBranchMerged,
  judgeWorktreeStatus,
  removeIsolatedWorktree,
  sessionScope,
} from './worktree-isolated.js';
// WorktreeManager 现驻入口档 worktree.js(Z16 留腿原因见 worktree-tools.ts 同注)
import { WorktreeManager } from './worktree.js';
import { enterWorktreeTool } from './worktree-tools.js';

/**
 * 回收会话级隔离 worktree。
 *
 * 安全判据(CLI 层自证,不依赖调用方自觉):
 *   - 分支未并入源仓库 HEAD / 并入状态判不出 ⇒ 默认拒删;
 *   - 隔离区有未提交改动 / 改动状态判不出 ⇒ 默认拒删;
 *   - 确认无价值时用 force=true 越过上述两档(输出里如实标注 forced);
 *   - 删除走 `removeIsolatedWorktree`(既有删除出口 + 既有 prune),不在这里复制 §12h 判据文本。
 */
export const exitWorktreeTool: Tool = {
  name: 'exit_worktree',
  description:
    '回收本会话的隔离 git worktree 并摘掉 git 注册表条目(prune)。默认拒绝删除「分支未并入当前 HEAD」或「隔离区有未提交改动」的检出;确认改动无价值后可用 force=true 强制。参数:name(可选,隔离区名,默认本会话进入的那一个),force(可选,默认 false)。',
  dangerLevel: 'dangerous',
  parameters: {
    name: {
      type: 'string',
      description: '要回收的隔离区名;省略则回收本会话进入的那一个',
    },
    force: {
      type: 'boolean',
      description: '越过「未合并 / 有未提交改动」两条拒删判据(默认 false)',
    },
  },
  required: [],
  // 删除类工具:危险档 + 交互确认(与 delete_file 同档),默认仍先过未合并/未提交两条拒删判据。
  contract: {
    shape: {
      input: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '隔离区名(默认本会话进入的那一个)' },
          force: { type: 'boolean', description: '越过未合并/未提交拒删判据' },
        },
        required: [],
      },
      visibleToProvider: true,
    },
    permission: {
      permissionKey: 'exit_worktree',
      reason: '回收隔离 worktree 目录与 agent-wt-* 分支(默认拒删未合并或有未提交改动的检出)',
      riskLevel: 'dangerous',
      effectScope: 'repository',
      requiresApproval: true,
      confirmation: { mode: 'interactive' },
    },
    resultBudget: {
      inlineLimitBytes: 8_000,
      providerVisibleLimitBytes: 8_000,
      policy: 'truncate',
      preview: { bytes: 2_000, lines: 40, from: 'head' },
    },
  },
  async execute(args, ctx) {
    const sourcePath = ctx.workspacePath;
    if (!sourcePath) {
      return { success: false, output: '', error: '缺少工作区路径,无法回收隔离 worktree' };
    }
    const force = args.force === true;
    const manager = new WorktreeManager(sourcePath);
    const scope = sessionScope(sourcePath);
    const requested = typeof args.name === 'string' ? args.name.trim() : '';

    let name = requested;
    if (name === '') {
      if (scope.size === 0) {
        return {
          success: false,
          output: '',
          error: '本会话没有登记过的隔离 worktree:请显式传 name(可先 git worktree list 查看)',
        };
      }
      if (scope.size > 1) {
        return {
          success: false,
          output: '',
          error: `本会话有 ${scope.size} 个隔离 worktree(${[...scope.keys()].join(', ')}):请用 name 指定要回收的那一个`,
        };
      }
      name = [...scope.keys()][0]!;
    }

    const registered = scope.get(name);
    const listed = manager.findByAgent(name);
    const wtPath = listed?.path ?? registered?.path;
    const branch = listed?.branch ?? registered?.branch;
    if (!wtPath || !branch) {
      return {
        success: false,
        output: '',
        error: `未找到隔离 worktree:${name}(可先 git worktree list 核对名字)`,
      };
    }

    const merged = judgeWorktreeBranchMerged(sourcePath, branch);
    const status = judgeWorktreeStatus(wtPath);
    if (!force) {
      if (merged === 'unmerged') {
        return {
          success: false,
          output: '',
          error: `分支 ${branch} 未并入当前 HEAD:先合并该分支;确认改动无价值后再传 force=true(会连带删除分支)`,
        };
      }
      if (merged === 'unknown') {
        return {
          success: false,
          output: '',
          error: `未能判定分支 ${branch} 是否已并入 HEAD(merge-base 异常):不静默删;人工确认后传 force=true`,
        };
      }
      if (status === 'dirty') {
        return {
          success: false,
          output: '',
          error: `隔离区有未提交改动(${wtPath}):先提交或导出;确认可弃后再传 force=true`,
        };
      }
      if (status === 'unknown') {
        return {
          success: false,
          output: '',
          error: `未能判定隔离区改动状态(git status 异常,${wtPath}):不静默删;人工确认后传 force=true`,
        };
      }
    }

    try {
      // 安全判据在本层;`git worktree remove --force` 只解决"目录非空/被占用"这一档
      const result = removeIsolatedWorktree({
        sourcePath,
        agentId: name,
        path: wtPath,
        viaManager: true,
        manager,
        force: true,
      });
      if (!result.removed) {
        return {
          success: false,
          output: '',
          error: `worktree 目录未被移除(${wtPath}):注册表条目与目录状态不一致,请人工核对后重试`,
        };
      }
      scope.delete(name);
      fireWorktreeHook('worktreeRemove', {
        workspacePath: sourcePath,
        worktreeName: name,
        worktreePath: wtPath,
        worktreeBranch: branch,
        worktreeForced: force,
      });
      return {
        success: true,
        output: [
          `已回收隔离 worktree:${name}`,
          `路径: ${wtPath}`,
          `分支: ${branch}(已删除)`,
          ...(force ? ['注意:本次走了 force 档(越过未合并/未提交改动判据)'] : []),
        ].join('\n'),
      };
    } catch (err) {
      return {
        success: false,
        output: '',
        error: `worktree 回收失败: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

/** 会话级 worktree 工具族(注册进 setupAgentTools 的 registerTools 链)。 */
export const WORKTREE_TOOLS: Tool[] = [enterWorktreeTool, exitWorktreeTool];
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
