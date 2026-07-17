/**
 * Subagent 任务分解工具 — 让 Agent 能派生子 agent 执行独立子任务。
 *
 * 灵感来源:grok-build 的 leader/worker agent 模式(leader 派生 worker,独立 context)。
 * 做减法:复用 setupAgentTools + runToolLoop,全局变量跟踪嵌套深度(单用户场景足够)。
 *
 * 使用场景:
 *   - 复杂任务分解("先搜代码再改再测"可拆成独立子任务)
 *   - context 隔离(避免主 context 被子任务的长输出污染)
 *   - 并行探索(派生多个子 agent 分头搜索不同模块)
 *
 * 扩展能力(对齐 AGENTS.md 第 12 节 subagent git 隔离规则):
 *   - isolation='worktree':为 subagent 创建 git worktree 隔离工作区(subagent/<id> 分支)
 *   - resumeFrom=<id>:从 ~/.ihui/subagents/<id>.json 恢复上次 subagent 的 transcript/model
 *   - capabilityMode:4 档能力模式(read-only/read-write/execute/all),优先级高于 persona.allowedTools
 *   - SubagentStart/SubagentStop hook 埋点(与 hooks/index.ts 协同)
 */

import { setBaseUrl, setTokenProvider } from '@ihui/api-client';
import { setupAgentTools, runToolLoop } from '../commands/agent.js';
import type { Tool, ToolResult } from './index.js';
import { listTools, clearTools, registerTools } from './index.js';
import { runHook } from '../hooks/index.js';
import {
  newSubagentId,
  saveSubagentState,
  loadSubagentState,
  type SubagentState,
} from '../subagents/state-store.js';
import { createWorktree, createWorktreeWithFallback, removeWorktree } from '../subagents/worktree.js';
import { PERSONAS_CONTRACTS, type JSONSchema } from '../personas/index.js';
import type { SubagentPersona, CapabilityMode, IsolationMode } from '@ihui/types';
import { resolveEffectiveOverrides } from '../subagents/precedence.js';
import type {
  PersonaMap,
  RoleMap,
  EffectiveRuntimeConfig,
} from '../subagents/types.js';

export type { SubagentPersona, CapabilityMode, IsolationMode };

const MAX_SUBAGENT_DEPTH = 3;
const SUBAGENT_MAX_ITERATIONS = 10;

let subagentDepth = 0;

export interface PersonaConfig {
  allowedTools?: string[];
  blockedTools?: string[];
  systemPrompt: string;
  maxIterations?: number;
  input_schema?: JSONSchema;
  output_schema?: JSONSchema;
}

export const PERSONAS: Record<SubagentPersona, PersonaConfig> = {
  researcher: {
    allowedTools: ['read_file', 'list_dir', 'grep', 'glob', 'codegraph', 'goto_definition', 'find_references', 'fetch_url', 'web_search', 'get_diagnostics', 'run_tests'],
    blockedTools: ['write_file', 'edit_file', 'delete_file', 'git_commit', 'git_add', 'run_command'],
    systemPrompt: '你是 researcher 角色,专注信息收集与分析。只读不写,可使用搜索/读取/代码智能/网络抓取/诊断工具。任务完成后给出结构化调研报告,不要执行任何修改操作。',
    maxIterations: 8,
    input_schema: PERSONAS_CONTRACTS.researcher!.input_schema,
    output_schema: PERSONAS_CONTRACTS.researcher!.output_schema,
  },
  coder: {
    blockedTools: ['git_commit', 'run_command'],
    systemPrompt: '你是 coder 角色,专注代码实现。优先使用 write_file/edit_file/file-edit 工具,完成后用 get_diagnostics 验证。不执行 git commit 和危险 shell 命令。',
    maxIterations: 15,
    input_schema: PERSONAS_CONTRACTS.coder!.input_schema,
    output_schema: PERSONAS_CONTRACTS.coder!.output_schema,
  },
  reviewer: {
    allowedTools: ['read_file', 'list_dir', 'grep', 'glob', 'codegraph', 'goto_definition', 'find_references', 'get_diagnostics'],
    blockedTools: ['write_file', 'edit_file', 'delete_file', 'git_commit', 'git_add', 'run_command'],
    systemPrompt: '你是 reviewer 角色,专注代码审查。只读,给出结构化审查报告:问题严重度(P0/P1/P2)+ 文件:行 + 修复建议。不修改任何代码。',
    maxIterations: 6,
    input_schema: PERSONAS_CONTRACTS.reviewer!.input_schema,
    output_schema: PERSONAS_CONTRACTS.reviewer!.output_schema,
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

/**
 * 把现有 PERSONAS 适配为 precedence 模块所需的 PersonaMap 格式(兜底用)。
 * 现有 PersonaConfig 不含 model / instructions / defaultIsolation,这些字段留 undefined,
 * 让 precedence 链在 role / explicit 层未给出值时自然回落到 parent 层(即 parentOpts.modelId 等)。
 */
const PERSONAS_AS_PERSONA_MAP: PersonaMap = Object.fromEntries(
  Object.keys(PERSONAS).map((name) => [name, { name }]),
);

/**
 * 默认 role map:5 个内置 subagent_type 各对应一个 SubagentRole,
 * 让 precedence 链在用户未传 capabilityMode 时能从 role 层兜底(如 researcher → read-only)。
 * 用户可通过 SubagentParentOptions.customRoles 完全覆盖此映射。
 */
const DEFAULT_ROLES: RoleMap = {
  researcher: { name: 'researcher', defaultCapabilityMode: 'read-only' },
  coder: { name: 'coder', defaultCapabilityMode: 'read-write' },
  reviewer: { name: 'reviewer', defaultCapabilityMode: 'read-only' },
  planner: { name: 'planner', defaultCapabilityMode: 'read-only' },
  general: { name: 'general', defaultCapabilityMode: 'all' },
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

const READ_ONLY_TOOLS = [
  'read_file', 'list_dir', 'grep', 'glob',
  'codegraph', 'goto_definition', 'find_references',
  'fetch_url', 'web_search', 'get_diagnostics',
];

export const CAPABILITY_WHITELISTS: Record<Exclude<CapabilityMode, 'all'>, string[]> = {
  'read-only': READ_ONLY_TOOLS,
  'read-write': [...READ_ONLY_TOOLS, 'edit_file', 'write_file', 'apply_patch', 'file_edit', 'delete_file'],
  'execute': [...READ_ONLY_TOOLS, 'edit_file', 'write_file', 'apply_patch', 'file_edit', 'delete_file', 'run_command', 'run_tests'],
};

export function applyCapabilityMode(tools: Tool[], mode: CapabilityMode | undefined): Tool[] {
  if (!mode || mode === 'all') return tools;
  const whitelist = CAPABILITY_WHITELISTS[mode];
  if (!whitelist) return tools;
  return tools.filter((t) => {
    if (mode === 'execute' && t.name.startsWith('git_')) return true;
    return whitelist.includes(t.name);
  });
}

export interface SubagentParentOptions {
  modelId: string;
  apiUrl: string;
  apiKey?: string;
  workspacePath: string;
  allowDangerous?: boolean;
  sessionId?: string;
  isolation?: IsolationMode;
  resumeFrom?: string;
  capabilityMode?: CapabilityMode;
  keepWorktree?: boolean;
  /** 是否启用 worktree CoW 快路径(对应 settings.worktreeFastPath.enabled,默认 false 走原 git worktree add) */
  worktreeFastPathEnabled?: boolean;
  /** 启用 precedence 链(默认 false,渐进式启用)。关闭时走原有逻辑,零回归。 */
  precedenceEnabled?: boolean;
  /** 自定义 role map(覆盖默认 DEFAULT_ROLES,仅在 precedenceEnabled=true 时生效) */
  customRoles?: RoleMap;
  /** 自定义 persona map(覆盖默认 PERSONAS_AS_PERSONA_MAP,仅在 precedenceEnabled=true 时生效) */
  customPersonas?: PersonaMap;
}

export function createSubagentTool(parentOpts: SubagentParentOptions): Tool {
  return {
    name: 'dispatch_subagent',
    description: '派生子 agent 执行独立子任务(有独立 context,适合并行/隔离任务)。嵌套深度不超过 3 层。参数:task(任务描述,应清晰、独立、可验证),persona(角色预设:researcher/coder/reviewer/planner/general,自动配置工具白名单和 system prompt,默认 general),tools(额外工具白名单,与 persona 叠加过滤,可选),maxIterations(最大迭代数,可选,默认按 persona 或 10)。扩展参数:isolation(none/worktree,启用 git worktree 隔离工作区),resumeFrom(subagent id,从持久化状态恢复 transcript 继续),capabilityMode(read-only/read-write/execute/all,覆盖 persona 工具白名单),keepWorktree(成功后是否保留 worktree,默认 false)。',
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
      isolation: {
        type: 'string',
        enum: ['none', 'worktree'],
        description: '隔离模式:none=同工作区,worktree=git worktree 隔离(subagent/<id> 分支)',
      },
      resumeFrom: {
        type: 'string',
        description: '从持久化 subagent 状态恢复(传入上次 subagent 的 id)',
      },
      capabilityMode: {
        type: 'string',
        enum: ['read-only', 'read-write', 'execute', 'all'],
        description: '能力模式,覆盖 persona 工具白名单。read-only=只读,read-write=读写,execute=读写+命令,all=全部',
      },
      keepWorktree: {
        type: 'boolean',
        description: 'worktree 隔离模式下,subagent 成功完成后是否保留 worktree(默认 false,自动清理)',
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

      let isolation = (args.isolation as IsolationMode | undefined) ?? parentOpts.isolation ?? 'none';
      const resumeFrom = (args.resumeFrom as string | undefined) ?? parentOpts.resumeFrom;
      let capabilityMode = (args.capabilityMode as CapabilityMode | undefined) ?? parentOpts.capabilityMode;
      const keepWorktree = (args.keepWorktree as boolean | undefined) ?? parentOpts.keepWorktree ?? false;
      const parentId = parentOpts.sessionId ?? process.env.IHUI_SESSION_ID ?? 'cli';

      // P1-2 Subagent precedence:feature flag 默认关闭,关闭时走原有逻辑(零回归);
      // 开启时按 4 层短路链(explicit > role > persona > parent)解析 model / capabilityMode / isolation。
      let modelId = parentOpts.modelId;
      if (parentOpts.precedenceEnabled === true) {
        const roleMap = parentOpts.customRoles ?? DEFAULT_ROLES;
        const personaMap = parentOpts.customPersonas ?? PERSONAS_AS_PERSONA_MAP;
        const effective: EffectiveRuntimeConfig = resolveEffectiveOverrides(
          {
            model: args.model as string | undefined,
            persona: args.persona as string | undefined,
            capabilityMode: args.capabilityMode as CapabilityMode | undefined,
            isolation: args.isolation as IsolationMode | undefined,
          },
          roleMap[persona],
          personaMap,
          parentOpts.workspacePath,
          persona,
        );
        // 只在 effective 给出值时覆盖(保留 undefined=回落到 parent 层的语义);
        // isolation 例外:effective 总有值(默认 'none'),但 'subprocess' 在现有代码中
        // 等同 'none'(不创建 worktree),用 cast 收窄到 @ihui/types 的 IsolationMode 联合。
        if (effective.model !== undefined) modelId = effective.model;
        if (effective.capabilityMode !== undefined) capabilityMode = effective.capabilityMode;
        isolation = effective.isolation as IsolationMode;
      }

      const subagentId = resumeFrom ?? newSubagentId();

      let resumedState: SubagentState | null = null;
      if (resumeFrom) {
        resumedState = loadSubagentState(resumeFrom);
        if (!resumedState) {
          return {
            success: false,
            output: '',
            error: `resumeFrom 失败:未找到 subagent 状态 ${resumeFrom}`,
          };
        }
      }

      let effectiveWorkspace = parentOpts.workspacePath;
      let worktreeCreated = false;
      if (isolation === 'worktree') {
        if (resumedState?.worktreePath && resumedState.worktreePath.length > 0) {
          effectiveWorkspace = resumedState.worktreePath;
        } else {
          try {
            // feature flag 关闭(默认):走原 git worktree add(零回归);启用时走 CoW 快路径+ fallback
            const useFastPath = parentOpts.worktreeFastPathEnabled === true;
            const wt = useFastPath
              ? await createWorktreeWithFallback(parentId, subagentId, parentOpts.workspacePath, true)
              : createWorktree(parentId, subagentId, parentOpts.workspacePath);
            effectiveWorkspace = wt.path;
            worktreeCreated = true;
          } catch (err) {
            return {
              success: false,
              output: '',
              error: `worktree 创建失败: ${err instanceof Error ? err.message : String(err)}`,
            };
          }
        }
      }

      const state: SubagentState = {
        id: subagentId,
        parentId,
        persona,
        capabilityMode: capabilityMode ?? 'all',
        isolation,
        worktreePath: isolation === 'worktree' ? effectiveWorkspace : undefined,
        transcript: resumedState?.transcript ?? [],
        toolState: resumedState?.toolState,
        model: resumedState?.model ?? modelId,
        status: 'running',
        startedAt: resumedState?.startedAt ?? new Date().toISOString(),
      };
      saveSubagentState(state);

      runHook('subagentStart', {
        workspacePath: effectiveWorkspace,
        sessionId: parentId,
        subagentId,
        subagentType: persona,
        toolArgs: { task, isolation, capabilityMode, resumeFrom },
      });

      subagentDepth++;
      let stopReason: 'completed' | 'failed' | 'cancelled' = 'completed';
      let stopError: string | undefined;
      try {
        setBaseUrl(parentOpts.apiUrl);
        if (parentOpts.apiKey) {
          setTokenProvider({ getToken: () => parentOpts.apiKey ?? null });
        }

        const { systemPrompt, ctx } = await setupAgentTools({
          workspacePath: effectiveWorkspace,
          silent: true,
          confirmDangerous: async () => parentOpts.allowDangerous === true,
        });

        const savedTools = listTools();
        let filteredTools: Tool[];
        if (capabilityMode) {
          filteredTools = applyCapabilityMode(savedTools, capabilityMode);
        } else {
          filteredTools = applyPersona(savedTools, persona);
        }
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
            modelId,
            messages,
            ctx,
            maxIterations: effectiveMaxIterations,
          });

          const text = result.assistantText.trim();
          if (!text) {
            stopReason = 'failed';
            stopError = `子 agent 未返回内容(stopReason: ${result.stopReason}, ${result.iterations} 轮)`;
            return {
              success: false,
              output: '',
              error: stopError,
            };
          }

          if (result.stopReason === 'error' || result.stopReason === 'budget_limited') {
            stopReason = 'failed';
            stopError = `stopReason: ${result.stopReason}`;
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
        stopReason = 'failed';
        stopError = err instanceof Error ? err.message : String(err);
        return {
          success: false,
          output: '',
          error: `子 agent 执行失败: ${stopError}`,
        };
      } finally {
        subagentDepth--;

        const endedAt = new Date().toISOString();
        const finalState = loadSubagentState(subagentId);
        if (finalState) {
          finalState.status = stopReason;
          finalState.endedAt = endedAt;
          if (stopError) finalState.error = stopError;
          saveSubagentState(finalState);
        }

        runHook('subagentStop', {
          workspacePath: effectiveWorkspace,
          sessionId: parentId,
          subagentId,
          subagentType: persona,
          reason: stopReason,
          error: stopError,
        });

        if (worktreeCreated && isolation === 'worktree') {
          if (stopReason === 'completed' && !keepWorktree) {
            try {
              removeWorktree(effectiveWorkspace, { sourcePath: parentOpts.workspacePath, force: true });
            } catch {
              // worktree 清理失败不阻塞主流程,保留供后续手动清理
            }
          }
        }
      }
    },
  };
}
