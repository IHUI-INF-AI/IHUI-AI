/**
 * Subagent 任务分解工具 — 让 Agent 能派生子 agent 执行独立子任务。
 *
 * 灵感来源:cli 的 leader/worker agent 模式(leader 派生 worker,独立 context)。
 * 做减法:复用 setupAgentTools + runToolLoop,全局变量跟踪嵌套深度(单用户场景足够)。
 *
 * 使用场景:
 *   - 复杂任务分解("先搜代码再改再测"可拆成独立子任务)
 *   - context 隔离(避免主 context 被子任务的长输出污染)
 *   - 并行探索(派生多个子 agent 分头搜索不同模块)
 */

import { setBaseUrl, setTokenProvider } from '@ihui/api-client';
import { setupAgentTools, runToolLoop } from '../commands/agent.js';
import type { Tool, ToolResult } from './index.js';

const MAX_SUBAGENT_DEPTH = 3;
const SUBAGENT_MAX_ITERATIONS = 10;

let subagentDepth = 0;

export interface SubagentParentOptions {
  modelId: string;
  apiUrl: string;
  apiKey?: string;
  workspacePath: string;
  allowDangerous?: boolean;
}

export function createSubagentTool(parentOpts: SubagentParentOptions): Tool {
  return {
    name: 'dispatch_subagent',
    description: '派生子 agent 执行独立子任务(有独立 context,适合并行/隔离任务)。子 agent 有完整的工具集,但最多 10 轮迭代。嵌套深度不超过 3 层。参数:task(任务描述,应清晰、独立、可验证),tools(允许子 agent 使用的工具名白名单,可选,默认全部)。',
    dangerLevel: 'read',
    parameters: {
      task: { type: 'string', description: '子任务描述(应清晰、独立、可验证)' },
      tools: {
        type: 'array',
        items: { type: 'string', description: '允许的工具名' },
        description: '允许子 agent 使用的工具名白名单(可选,默认全部)',
      },
    },
    required: ['task'],
    async execute(args): Promise<ToolResult> {
      const task = args.task as string;
      if (!task) return { success: false, output: '', error: '缺少 task 参数' };

      if (subagentDepth >= MAX_SUBAGENT_DEPTH) {
        return {
          success: false,
          output: '',
          error: `子 agent 嵌套深度超过 ${MAX_SUBAGENT_DEPTH} 层,已拒绝(防止递归失控)`,
        };
      }

      subagentDepth++;
      try {
        setBaseUrl(parentOpts.apiUrl);
        if (parentOpts.apiKey) {
          setTokenProvider({ getToken: () => parentOpts.apiKey ?? null });
        }

        const { systemPrompt, ctx } = await setupAgentTools({
          workspacePath: parentOpts.workspacePath,
          silent: true,
          confirmDangerous: async () => parentOpts.allowDangerous === true,
        });

        const messages = [
          { role: 'system' as const, content: systemPrompt },
          { role: 'user' as const, content: task },
        ];

        const result = await runToolLoop({
          modelId: parentOpts.modelId,
          messages,
          ctx,
          maxIterations: SUBAGENT_MAX_ITERATIONS,
        });

        const text = result.assistantText.trim();
        if (!text) {
          return {
            success: false,
            output: '',
            error: `子 agent 未返回内容(stopReason: ${result.stopReason}, ${result.iterations} 轮)`,
          };
        }

        const summary = text.length > 2000 ? text.slice(0, 2000) + '\n...(子 agent 输出超过 2000 字符,已截断)' : text;
        return {
          success: result.stopReason !== 'error',
          output: `[子 agent 完成 — ${result.iterations} 轮, stopReason: ${result.stopReason}]\n${summary}`,
        };
      } catch (err) {
        return {
          success: false,
          output: '',
          error: `子 agent 执行失败: ${err instanceof Error ? err.message : String(err)}`,
        };
      } finally {
        subagentDepth--;
      }
    },
  };
}
