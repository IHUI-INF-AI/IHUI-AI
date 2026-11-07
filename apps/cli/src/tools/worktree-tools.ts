// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话级工具 enter_worktree(goal-b49 Z16 自 tools/worktree.ts 逐字拆出,零行为变更)。
 */

import type { Tool } from './index.js';
import { uuid8 } from './worktree-core.js';
import { createIsolatedWorktree, fireWorktreeHook, sessionScope } from './worktree-isolated.js';
// WorktreeManager 现驻入口档 worktree.js(Z16:两条删除腿被装车锁逐字钉在入口,类不搬);
// 环引用仅取 live binding,`new WorktreeManager` 发生在 execute 运行时,模块初始化期不触碰
import { WorktreeManager } from './worktree.js';

/**
 * 进入隔离 worktree(会话级)。
 *
 * 与子代理共用 `createIsolatedWorktree`:同一个 `.worktrees/<name>` + `agent-wt-<uuid8>` 分支形态,
 * 同一套失败半径。返回值里给出隔离区绝对路径 —— 后续读写使用该路径下的绝对路径
 * (本工具的装配点在命令层,会话 cwd 不在此处改写;不写"已切换工作目录"这种做不到的承诺)。
 */
export const enterWorktreeTool: Tool = {
  name: 'enter_worktree',
  description:
    '在当前仓库创建并进入一个隔离的 git worktree(目录 .worktrees/<name>,分支 agent-wt-<uuid8>)。参数:name(可选,隔离区名;省略自动生成),startPoint(可选,基线提交,默认当前 HEAD)。返回隔离区绝对路径:后续读写请使用该路径下的绝对路径;结束时用 exit_worktree 回收。',
  dangerLevel: 'write',
  parameters: {
    name: {
      type: 'string',
      description: '隔离区名(同时作为 .worktrees/<name> 目录名);省略则自动生成',
    },
    startPoint: {
      type: 'string',
      description: '基线提交/分支(默认当前 HEAD)',
    },
  },
  required: [],
  // 新增工具必须带契约(守门 111 TC1:「新增即拦」;存量工具走各文件 HEAD 锚点)。
  contract: {
    shape: {
      input: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '隔离区名(省略自动生成)' },
          startPoint: { type: 'string', description: '基线提交(默认 HEAD)' },
        },
        required: [],
      },
      visibleToProvider: true,
    },
    permission: {
      permissionKey: 'enter_worktree',
      reason: '在 .worktrees/<name> 下创建 git worktree 与 agent-wt-* 隔离分支;只新增不改既有工作树,同名冲突直接报错',
      riskLevel: 'write',
      effectScope: 'repository',
      requiresApproval: false,
      // 只新增隔离目录与分支,不删改任何既有内容 ⇒ 不需要确认(显式决定,不是"漏声明")
      confirmation: { mode: 'none', reason: '只新增隔离目录与分支;同名冲突直接报错,不覆盖' },
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
      return { success: false, output: '', error: '缺少工作区路径,无法创建隔离 worktree' };
    }
    const rawName = typeof args.name === 'string' ? args.name.trim() : '';
    const name = rawName !== '' ? rawName : `session-${uuid8()}`;
    const startPoint = typeof args.startPoint === 'string' && args.startPoint.trim() !== ''
      ? args.startPoint.trim()
      : undefined;

    const scope = sessionScope(sourcePath);
    if (scope.has(name)) {
      return {
        success: false,
        output: '',
        error: `本会话已进入隔离区 ${name}:先 exit_worktree 回收,或换一个 name`,
      };
    }

    try {
      const wt = await createIsolatedWorktree({
        sourcePath,
        agentId: name,
        startPoint,
        manager: new WorktreeManager(sourcePath),
      });
      scope.set(name, wt);
      fireWorktreeHook('worktreeCreate', {
        workspacePath: sourcePath,
        worktreeName: name,
        worktreePath: wt.path,
        worktreeBranch: wt.branch,
      });
      return {
        success: true,
        output: [
          `已创建隔离 worktree:${name}`,
          `路径: ${wt.path}`,
          `分支: ${wt.branch}`,
          '后续读写请使用上述路径下的绝对路径;结束时调用 exit_worktree 回收(默认拒绝删除未合并或有未提交改动的检出)',
        ].join('\n'),
      };
    } catch (err) {
      return {
        success: false,
        output: '',
        error: `worktree 创建失败: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
