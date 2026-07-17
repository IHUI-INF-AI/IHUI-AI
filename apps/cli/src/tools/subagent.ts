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
import { listTools, clearTools, registerTools } from './index.js';

const MAX_SUBAGENT_DEPTH = 3;
const SUBAGENT_MAX_ITERATIONS = 10;

let subagentDepth = 0;

export type SubagentPersona = 'researcher' | 'coder' | 'reviewer' | 'planner' | 'general';

export interface PersonaConfig {
  allowedTools?: string[];
  blockedTools?: string[];
  systemPrompt: string;
  maxIterations?: number;
}

export const PERSONAS: Record<SubagentPersona, PersonaConfig> = {
  researcher: {
    allowedTools: ['read_file', 'list_dir', 'grep', 'glob', 'codegraph', 'goto_definition', 'find_references', 'fetch_url', 'web_search', 'get_diagnostics', 'run_tests'],
    blockedTools: ['write_file', 'edit_file', 'delete_file', 'git_commit', 'git_add', 'run_command'],
    systemPrompt: '你是 researcher 角色,专注信息收集与分析。只读不写,可使用搜索/读取/代码智能/网络抓取/诊断工具。任务完成后给出结构化调研报告,不要执行任何修改操作。',
    maxIterations: 8,
  },
  coder: {
    blockedTools: ['git_commit', 'run_command'],
    systemPrompt: '你是 coder 角色,专注代码实现。优先使用 write_file/edit_file/file-edit 工具,完成后用 get_diagnostics 验证。不执行 git commit 和危险 shell 命令。',
    maxIterations: 15,
  },
  reviewer: {
    allowedTools: ['read_file', 'list_dir', 'grep', 'glob', 'codegraph', 'goto_definition', 'find_references', 'get_diagnostics'],
    blockedTools: ['write_file', 'edit_file', 'delete_file', 'git_commit', 'git_add', 'run_command'],
    systemPrompt: '你是 reviewer 角色,专注代码审查。只读,给出结构化审查报告:问题严重度(P0/P1/P2)+ 文件:行 + 修复建议。不修改任何代码。',
    maxIterations: 6,
  },
  planner: {
    allowedTools: ['read_file', 'list_dir', 'grep', 'glob', 'codegraph', 'goto_definition', 'find_references'],
    blockedTools: ['write_file', 'edit_file', 'delete_file', 'git_commit', 'git_add', 'run_command', 'run_tests'],
    systemPrompt: '你是 planner 角色,专注任务规划与拆解。只读,输出结构化计划:任务列表 + 依赖关系 + 预估难度 + 验收标准。不执行任何实际改动。',
    maxIterations: 5,
  },
  general: {
    systemPrompt: '你是通用 subagent,可使用所有允许的工具完成任务。',
  },
};

export function applyPersona(tools: Tool[], persona: SubagentPersona): Tool[] {
  const config = PERSONAS[persona];
  let result = tools;
  if (config.allowedTools) {
    result = result.filter((t) => config.allowedTools!.includes(t.name));
  }
  if (config.blockedTools) {
    result = result.filter((t) => !config.blockedTools!.includes(t.name));
  }
  return result;
}

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
    description: '派生子 agent 执行独立子任务(有独立 context,适合并行/隔离任务)。嵌套深度不超过 3 层。参数:task(任务描述,应清晰、独立、可验证),persona(角色预设:researcher/coder/reviewer/planner/general,自动配置工具白名单和 system prompt,默认 general),tools(额外工具白名单,与 persona 叠加过滤,可选),maxIterations(最大迭代数,可选,默认按 persona 或 10)。',
    dangerLevel: 'read',
    parameters: {
      task: { type: 'string', description: '子任务描述(应清晰、独立、可验证)' },
      persona: {
        type: 'string',
        enum: ['researcher', 'coder', 'reviewer', 'planner', 'general'],
        description: '子代理角色预设,自动配置工具白名单和 system prompt',
      },
      tools: {
        type: 'array',
        items: { type: 'string', description: '允许的工具名' },
        description: '允许子 agent 使用的工具名白名单(与 persona 叠加,可选,默认全部)',
      },
      maxIterations: {
        type: 'number',
        description: '最大迭代数(可选,默认按 persona 配置或 10)',
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

      const persona = (args.persona as SubagentPersona) ?? 'general';
      const personaConfig = PERSONAS[persona];
      const userMaxIterations = args.maxIterations as number | undefined;
      const userTools = args.tools as string[] | undefined;

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

        const savedTools = listTools();
        let filteredTools = applyPersona(savedTools, persona);
        if (userTools && userTools.length > 0) {
          filteredTools = filteredTools.filter((t) => userTools.includes(t.name));
        }
        const registryChanged = filteredTools.length !== savedTools.length;
        if (registryChanged) {
          clearTools();
          registerTools(filteredTools);
        }

        try {
          const finalSystemPrompt = personaConfig.systemPrompt + '\n\n' + systemPrompt;
          const effectiveMaxIterations =
            userMaxIterations ?? personaConfig.maxIterations ?? SUBAGENT_MAX_ITERATIONS;

          const messages = [
            { role: 'system' as const, content: finalSystemPrompt },
            { role: 'user' as const, content: task },
          ];

          const result = await runToolLoop({
            modelId: parentOpts.modelId,
            messages,
            ctx,
            maxIterations: effectiveMaxIterations,
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
        } finally {
          if (registryChanged) {
            clearTools();
            registerTools(savedTools);
          }
        }
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
