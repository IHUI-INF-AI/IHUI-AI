// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Subagent 任务分解工具 — 让 Agent 能派生子 agent 执行独立子任务。
 *
 * 灵感来源:参考行业 Agent 框架的 leader/worker agent 模式(leader 派生 worker,独立 context)。
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
import { createAuditedDangerGate } from './danger-gate-audit.js';
// G-816029:子代理被停/异常结束时,级联结算它自己派生的在飞后台任务(孤儿任务的唯一出口)
import { settleTasksOwnedByAgent, type BackgroundCascadeReason } from './background-registry.js';
import { listTools, clearTools, registerTools } from './index.js';
import { runHook } from '../hooks/index.js';
import {
  beginAskUserEscalationBudget,
  endAskUserEscalationBudget,
} from './ask-user.js';
import { injectHostSection } from '../utils/prompt-injection-registry.js';
import {
  newSubagentId,
  saveSubagentState,
  loadSubagentState,
  type SubagentState,
} from '../subagents/state-store.js';
import { createWorktree, createWorktreeWithFallback, removeWorktree } from '../subagents/worktree.js';
// Worktree 并行隔离层:可选注入,提供后 worktree 隔离走统一的 WorktreeManager(agent-wt-* 分支)
import { type WorktreeManager } from './worktree.js';
import { PERSONAS_CONTRACTS, type JSONSchema } from '../personas/index.js';
// G-426 拍板第三件套「超阈值自动后台化」:转后台落档用的中间态词汇,只引用唯一声明处
import { SUBAGENT_STATUS_DETACHED_IDLE } from '../subagents/types.js';
import type { SubagentPersona, CapabilityMode, IsolationMode } from '@ihui/types';
import { resolveEffectiveOverrides } from '../subagents/precedence.js';
import type {
  PersonaMap,
  RoleMap,
  EffectiveRuntimeConfig,
} from '../subagents/types.js';
import type { HunkTracker } from '../checkpoints/hunk-tracker.js';

export type { SubagentPersona, CapabilityMode, IsolationMode };

const MAX_SUBAGENT_DEPTH = 3;
const SUBAGENT_MAX_ITERATIONS = 10;

/**
 * `dispatch_subagent` 的墙钟预算档。
 *
 * 为什么不直接用默认档(30 分钟)、也不用"不可打断"豁免:
 * 子代理内跑的是**整条 agent loop**(最多 10 轮 × 每轮 1 次采样 + N 枚工具调用),
 * 而 loop 里的每一枚工具调用已经各自被 `executeWithinExecBudget` 收口了 —— 外层再套一个
 * 30 分钟,就会把"10 个正常慢调用叠起来"的合法子代理判成超时(把现有能跑通的功能改红);
 * 但完全不给上限又等于放行本票要消灭的那个形态:provider 挂起时 `runToolLoop` 里的采样
 * 拿不到取消信号(外层父信号目前尚未接进 `setupAgentTools`,见 tools/index.ts 的 ctx.signal 注释)。
 * 所以取封顶档 60 分钟:显著高于"10 轮 × 单枚工具默认档"的合理规模,同时保证一定结算。
 */
const SUBAGENT_EXEC_BUDGET_MS = 60 * 60_000;

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
  // G-816027 fail-closed:mode 是"给了值但不在声明集合内"的未声明枚举 ⇒ 收口到**最窄**档
  // (read-only),不再原样返回未过滤的 tools。旧写法 `if (!whitelist) return tools` 的
  // 实际后果是"没人认识的 capabilityMode 拿到了 'all'"—— 档位名读起来最窄、给到的权限
  // 最宽,而 typecheck / lint / 其余门全都不会红(能力档只在这一处生效)。
  // 刻意不抛:抛会把整枚 dispatch 打成异常结果,而"降档 + 大声一行"既守住最小权限,
  // 又让模型这一轮仍能只读地干活(诊断出口必须响,不许静默降档)。
  if (!whitelist) {
    try {
      process.stderr.write(
        `[subagent] 未声明的 capabilityMode "${String(mode).slice(0, 80)}" ⇒ 按最窄档 read-only 收口(不再默认给全集工具)\n`,
      );
    } catch {
      /* 诊断出口自身抛错不得把收口带崩 */
    }
    return tools.filter((t) => READ_ONLY_TOOLS.includes(t.name));
  }
  return tools.filter((t) => {
    if (mode === 'execute' && t.name.startsWith('git_')) return true;
    return whitelist.includes(t.name);
  });
}

/**
 * 子代理结束时要不要级联结算它的后台任务(G-816029)—— 判据唯一出口。
 *
 * 单独成函数的理由不是整洁:走完整条 `dispatch_subagent` 才能验这一格,那种测试会断在
 * 第一处无关依赖上(API / 工具注册 / hooks),证不了判据本身。
 *
 * 三档结论:
 *  - `subagent_cancelled`:父级取消信号已落(`aborted`)或子代理落 `cancelled` 终态。
 *  - `subagent_terminal` :子代理**没正常完成**就结束了(failed)—— task_id 只在它自己的
 *    context 里,父级拿不到,不清就是孤儿。
 *  - `undefined`:正常完成 ⇒ **不动**在飞任务(长跑任务是用户的,不是孤儿)。
 */
export function resolveSubagentCascadeReason(input: {
  stopReason: 'completed' | 'failed' | 'cancelled';
  aborted?: boolean;
}): BackgroundCascadeReason | undefined {
  if (input.aborted === true || input.stopReason === 'cancelled') return 'subagent_cancelled';
  if (input.stopReason === 'completed') return undefined;
  return 'subagent_terminal';
}

/**
 * G-426 拍板第三件套「超阈值自动后台化 detachParent」的判据唯一出口(纯函数)。
 *
 * 与 resolveSubagentCascadeReason 同一条立论:走完整条 dispatch_subagent 才能验这一格,
 * 那种测试会断在第一处无关依赖上,证不了判据本身 —— 所以判据单独成函数,接线另测。
 *
 * 入参是子代理自己的活动台账:exec-budget 到点时,`距最后一次真实推进的毫秒数`(idleMs)
 * 与名义预算(budgetMs)比较 ——
 *  - `idleMs < budgetMs` ⇒ 到点只可能是**绝对上限**(预算×3)触发,子代理仍在推进 ⇒
 *    `'detach'`:不杀,解除父级取消联动转后台,loop 继续跑到自然终态;
 *  - `idleMs >= budgetMs` ⇒ 空闲窗整段耗尽,真正卡死 ⇒ `'abort'`:照旧中止
 *    (前台照旧拿到带 idleMs/recoverable 的 timeout 结果 —— "无活动的照旧超时")。
 * 边界取等号归 abort:整段预算内没有任何推进 = 判据口径下的卡死,不是"慢"。
 */
export type SubagentTimeoutAction = 'detach' | 'abort';

export function resolveSubagentTimeoutAction(input: {
  idleMs: number;
  budgetMs: number;
}): SubagentTimeoutAction {
  return input.idleMs < input.budgetMs ? 'detach' : 'abort';
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
  /** HunkTracker(可选,透传给子 agent 的 file-edit 工具,启用 hunk 级冲突检测 + 改动归属追踪) */
  hunkTracker?: HunkTracker;
  /**
   * WorktreeManager(可选)— Git Worktree 并行隔离层。
   * 提供后 isolation='worktree' 时优先走 WorktreeManager 创建隔离工作区
   * (目录 .worktrees/<agent-id>,分支 agent-wt-<uuid8>,并发不冲突),
   * 任务完成后自动输出 worktree diff 供主 agent 审阅合并;未提供时走原有逻辑,零回归。
   */
  worktreeManager?: WorktreeManager;
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
    // 见 SUBAGENT_EXEC_BUDGET_MS 的推导:整条子 loop 一档,取封顶值而不是默认值
    execBudget: { ms: SUBAGENT_EXEC_BUDGET_MS },
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
    async execute(args, outerCtx): Promise<ToolResult> {
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
      // WorktreeManager 注入标记:走 manager 创建/清理,并在完成后输出 diff 供主 agent 合并
      let usedWorktreeManager = false;
      let worktreeBranch: string | undefined;
      if (isolation === 'worktree') {
        if (resumedState?.worktreePath && resumedState.worktreePath.length > 0) {
          effectiveWorkspace = resumedState.worktreePath;
        } else if (parentOpts.worktreeManager) {
          // 路径 A(可选注入):WorktreeManager 统一隔离层(.worktrees/<id> 目录 + agent-wt-<uuid8> 分支)
          try {
            const wt = parentOpts.worktreeManager.create(subagentId);
            effectiveWorkspace = wt.path;
            worktreeBranch = wt.branch;
            worktreeCreated = true;
            usedWorktreeManager = true;
          } catch (err) {
            return {
              success: false,
              output: '',
              error: `worktree 创建失败: ${err instanceof Error ? err.message : String(err)}`,
            };
          }
        } else {
          // 路径 B(原有逻辑):feature flag 关闭(默认)走原 git worktree add;启用时走 CoW 快路径+ fallback
          try {
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
      // Per-ask escalation budget window: one dispatch_subagent task = one ask
      // (upstream workflow "ask"). Nested dispatches (depth > 1) belong to the
      // same top-level ask and keep its window; concurrent siblings share it
      // (begin is a no-op while a window is already open). The 4th ask inside
      // the window is refused as a plain result, not an error — see ask-user.ts.
      beginAskUserEscalationBudget();
      let stopReason: 'completed' | 'failed' | 'cancelled' = 'completed';
      let stopError: string | undefined;
      // G-426:exec-budget 到点且仍在推进 ⇒ 转后台(置位见下方 onOuterAbort);
      // 外层 finally 的级联判据与完成通知都要读它,所以声明必须在这一层(跨过内层 try)。
      let detachedToBackground = false;
      try {
        setBaseUrl(parentOpts.apiUrl);
        if (parentOpts.apiKey) {
          setTokenProvider({ getToken: () => parentOpts.apiKey ?? null });
        }

        const { systemPrompt, ctx } = await setupAgentTools({
          workspacePath: effectiveWorkspace,
          silent: true,
          // 会话级旁路事实随子 ctx 下发,工具层披露可追溯(L7905 收口;与下方 gate 的 flag 继承同源)
          allowDangerous: parentOpts.allowDangerous,
          // 策略收口到唯一出口:子代理内无人可问 ⇒ 无 prompt,继承父进程 flag;未开即 denied(fail-closed,与旧行为逐路径等价)
          // 86H:子代理里的危险放行同样要进链,归属记父会话 id(parentId)——
          // 否则"父没批、子代理自己放行"这一型在审计面上完全不可见。
          confirmDangerous: createAuditedDangerGate({
            allowDangerous: parentOpts.allowDangerous,
            silent: true,
            auditSessionId: parentId,
          }),
          hunkTracker: parentOpts.hunkTracker,
          agentId: subagentId,
          subagentParent: {
            modelId,
            apiUrl: parentOpts.apiUrl,
            apiKey: parentOpts.apiKey,
            allowDangerous: parentOpts.allowDangerous,
            hunkTracker: parentOpts.hunkTracker,
          },
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
          // 人格段是**以宿主名义进子代理 system prompt** 的段:上一手只把主代理的注入面收了口,
          // 子代理这侧仍是裸拼 ⇒ 同一型提示两侧不同源(本仓最高频的漂移形态)。
          const personaSection = injectHostSection('subagent_persona', personaConfig.systemPrompt, {
            kind: 'host_directive',
          });
          const finalSystemPrompt = personaSection + '\n\n' + systemPrompt;
          const effectiveMaxIterations =
            userMaxIterations ?? personaConfig.maxIterations ?? SUBAGENT_MAX_ITERATIONS;

          const messages = [
            { role: 'system' as const, content: finalSystemPrompt },
            { role: 'user' as const, content: task },
          ];

          // G-426 无活动空闲超时:子 loop 的每一段真实推进(流式输出块/工具调用开始/工具结果)
          // 都回报给外层执行窗,把 `executeWithinExecBudget` 的预算定时器重排回完整预算 ——
          // 仍在推进的慢子代理不再被墙钟杀,真正卡死的才会超时(错误带 idleMs/recoverable);
          // outerCtx.reportExecActivity 缺席(无预算窗)时三个钩子全为 no-op,与改前逐字等价。
          // (钩子定义在 runToolLoop 块外,注释留块外:守门 123 的 S1e 对该块有 800 字符窗口。)
          //
          // G-426 拍板第三件套「超阈值自动后台化 detachParent」:子 loop 的取消通道收进自持的
          // loopAbort,外层 signal 只经 onOuterAbort 转发。exec-budget 到点(reason 前缀
          // `ihui:exec-budget:`,唯一生成处在 tools/index.ts enterGrace;若前缀漂移则按父取消
          // 处理,行为退回改前的"到点即杀",fail-safe)且活动台账显示仍在推进 ⇒ 判据出口判
          // 'detach':解绑外层监听(此后前台取消再无通道能到达 loopAbort —— 前台取消不再杀它)、
          // 状态落 detached_idle、loop 继续跑到自然终态(状态库/subagentStop hook 回收,
          // 前台已由预算窗代结算出 recoverable 的 timeout 结果);真无活动或父级真取消 ⇒ 照旧
          // 中止,与改前逐字同形。
          const loopAbort = new AbortController();
          let lastSubagentActivityAt = Date.now();
          const touchSubagentActivity = (): void => {
            lastSubagentActivityAt = Date.now();
            outerCtx.reportExecActivity?.();
          };
          const onOuterAbort = (): void => {
            const reason: unknown = outerCtx.signal?.reason;
            const budgetFired =
              reason instanceof Error && reason.message.startsWith('ihui:exec-budget:');
            const action = budgetFired
              ? resolveSubagentTimeoutAction({
                  idleMs: Date.now() - lastSubagentActivityAt,
                  budgetMs: SUBAGENT_EXEC_BUDGET_MS,
                })
              : 'abort';
            if (action === 'detach') {
              detachedToBackground = true;
              outerCtx.signal?.removeEventListener('abort', onOuterAbort);
              const runningState = loadSubagentState(subagentId);
              if (runningState) {
                runningState.status = SUBAGENT_STATUS_DETACHED_IDLE;
                saveSubagentState(runningState);
              }
              process.stderr.write(
                `[subagent ${subagentId}] exec budget exhausted while still progressing; detached to background` +
                  ` (foreground cancel no longer kills it; final state lands in the subagent state store)\n`,
              );
              return;
            }
            loopAbort.abort(reason instanceof Error ? reason : new Error('ihui:subagent-cancelled'));
          };
          if (outerCtx.signal) {
            // 已在窗内被 abort(如预算到点早于本段执行)⇒ abort 事件不会再派发,必须当场
            // 走一遍同一判据,否则取消永远到不了子 loop(旧直传 signal 的写法没有这个洞)。
            if (outerCtx.signal.aborted) onOuterAbort();
            else outerCtx.signal.addEventListener('abort', onOuterAbort, { once: true });
          }
          const result = await runToolLoop({
            modelId,
            messages,
            ctx,
            maxIterations: effectiveMaxIterations,
            // 取消下发:父取消/exec-budget 到点经 onOuterAbort 转发进自持 loopAbort(见上),
            // `runToolLoop` 把它同时喂给采样调用 ⇒ provider 挂起时这一枚子 loop 不再无限等。
            // 无外层 signal 时传 undefined,与改前逐字等价(signal 本就是可选形参)。
            signal: outerCtx.signal ? loopAbort.signal : undefined,
            onDelta: touchSubagentActivity,
            onToolCall: touchSubagentActivity,
            onToolResult: touchSubagentActivity,
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

          // WorktreeManager 隔离:任务完成后输出 worktree diff,供主 agent 审阅合并
          let diffSection = '';
          if (usedWorktreeManager && parentOpts.worktreeManager) {
            try {
              const wtDiff = parentOpts.worktreeManager.diff(subagentId);
              if (wtDiff.trim().length > 0) {
                diffSection = `\n\n[worktree diff — 分支 ${worktreeBranch ?? 'agent-wt-*'},供主 agent 审阅合并]\n${wtDiff}`;
              }
            } catch {
              // diff 失败不阻塞子 agent 结果返回
            }
          }

          return {
            success: result.stopReason !== 'error',
            output: `[子 agent 完成 — ${result.iterations} 轮, stopReason: ${result.stopReason}]\n${summary}${diffSection}`,
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
        // Close the budget window only when the whole top-level ask (including
        // nested dispatches) has settled, so a concurrent sibling keeps it open.
        if (subagentDepth === 0) endAskUserEscalationBudget();

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

        // G-426:转后台子代理的自然终态必须出声回收 —— 前台早在预算到点时拿到了
        // recoverable 的 timeout 结果,这里的是"后来跑完了"的唯一通知面(状态库已落
        // 真终态,resumeFrom=<id> 可续;ASCII 文案,守门 70 棘轮不新增中文行)。
        if (detachedToBackground) {
          process.stderr.write(
            `[subagent ${subagentId}] detached subagent settled: stopReason=${stopReason}` +
              ` (foreground already returned a recoverable timeout; final state persisted under id ${subagentId})\n`,
          );
        }

        // G-816029:子代理**没有正常完成**时,它自己派生的在飞后台任务由宿主级联结算。
        // 为什么必须在这里做:子代理与父级 context 隔离,`run_command background` 拿到的
        // task_id 只写在子代理自己的 transcript 里 ⇒ 父级既不知道有这些任务、也没有别的
        // 入口去停它们;不结算就是注册表里没人认领的孤儿(上游同族机制是
        // `cancelRunningRuntimeBackgroundTasks`)。正常完成一律不动 —— 把级联写成无条件
        // 清账,等于杀掉用户让子代理起的长跑构建/服务(反向用例见
        // `apps/cli/tests/subagent-cascade-background.test.ts`)。
        // G-426:exec-budget 到点会 abort 外层合成 signal,但转后台(detachedToBackground)
        // 的子代理并没有被取消 —— 外层 signal 的 aborted 对它只是"前台已放手",不得当作
        // 取消归因,否则自然完成的转后台子代理会被误清账(与"正常完成一律不动"同一条)。
        const cascadeReason = resolveSubagentCascadeReason({
          stopReason,
          aborted: outerCtx.signal?.aborted === true && !detachedToBackground,
        });
        if (cascadeReason) {
          try {
            const report = await settleTasksOwnedByAgent(subagentId, cascadeReason);
            // "发了信号但没等到终态"必须喊出来:未确认不等于已结束(与 killTask 三态同口径)
            if (report.unknown.length > 0) {
              process.stderr.write(
                `[subagent] 级联结算(${cascadeReason})有 ${report.unknown.length}/${report.inFlightAtEntry} 枚未确认终态: ${report.unknown.join(', ')} —— 未确认不等于已结束\n`,
              );
            }
          } catch (err) {
            // 结算失败不得把子代理的收尾整块带崩(worktree 清理与状态落库还在后面),但必须响
            process.stderr.write(
              `[subagent] 级联结算其后台任务失败(${cascadeReason}): ${err instanceof Error ? err.message : String(err)}\n`,
            );
          }
        }

        if (worktreeCreated && isolation === 'worktree') {
          if (stopReason === 'completed' && !keepWorktree) {
            try {
              if (usedWorktreeManager && parentOpts.worktreeManager) {
                // WorktreeManager 路径:remove 并清理 agent-wt-* 分支
                parentOpts.worktreeManager.remove(subagentId, { force: true, deleteBranch: true });
              } else {
                removeWorktree(effectiveWorkspace, { sourcePath: parentOpts.workspacePath, force: true });
              }
            } catch {
              // worktree 清理失败不阻塞主流程,保留供后续手动清理(cleanupStale 兜底)
            }
          }
        }
      }
    },
  };
}

// ───────────────────────────── spawn_parallel 工具 ─────────────────────────────
// 扩展:让 Agent 能并行 fork N 个子进程跑子 agent(真并行,非单进程 async)。
// 与 dispatch_subagent(单进程 async executor)互补:需要 OS 级真并行时用 spawn_parallel。

import { spawnParallel as spawnParallelTopology, type Topology } from '../commands/subagent-collab.js';
// 并发档位单一出口:模型填入值的钳制与默认值都只写在那里
import { resolveMaxConcurrency, MAX_CONCURRENCY, MIN_CONCURRENCY } from '../subagents/concurrency-budget.js';
import type { SubagentSpawnRequest, SubagentSpawnResponse } from '@ihui/types';

/**
 * 创建 spawn_parallel 工具 — 让 Agent 能并行 fork N 个子进程跑子 agent。
 *
 * dangerLevel: 'dangerous'(fork 子进程,消耗系统资源)。
 *
 * 与 dispatch_subagent 区别:
 *   - dispatch_subagent:单进程 async executor(共享事件循环,非真并行)
 *   - spawn_parallel:fork 子进程(OS 级真并行,独立 V8 isolate + 事件循环)
 *
 * 参数:
 *   - requests: SubagentSpawnRequest[](每个含 persona/task/model/isolation/maxIterations/timeoutSeconds)
 *   - topology: 协作拓扑(star/mesh/chain/hierarchical,默认 star)
 *   - maxWorkers: 最大并发(未传按 CPU 推导,传入钳到 [MIN, MAX],见 subagents/concurrency-budget.ts)
 */
export function createSpawnParallelTool(parentOpts: SubagentParentOptions): Tool {
  return {
    name: 'spawn_parallel',
    description:
      '并行 fork N 个子进程跑子 agent(真并行,OS 级独立进程,非单进程 async)。适合需要真正并行的多子任务场景。每个请求含 persona(角色)/task(任务)/model(模型)/isolation(none/worktree)/maxIterations/timeoutSeconds。可选 topology(star/mesh/chain/hierarchical)和 maxWorkers(并发上限)。',
    dangerLevel: 'dangerous',
    parameters: {
      requests: {
        type: 'array',
        description: '子 agent spawn 请求数组',
        items: {
          type: 'object',
          description: '子 agent spawn 请求',
          properties: {
            persona: {
              type: 'string',
              enum: ['researcher', 'coder', 'reviewer', 'planner', 'general'],
              description: '子代理角色预设',
            },
            task: { type: 'string', description: '任务描述' },
            model: { type: 'string', description: '模型覆盖(可选)' },
            isolation: {
              type: 'string',
              enum: ['none', 'worktree'],
              description: '隔离模式(默认 none)',
            },
            maxIterations: { type: 'number', description: '最大迭代数(可选)' },
            timeoutSeconds: {
              type: 'number',
              // 净增 0 行的中文文案(守门 70 棘轮):一行写完,语义细节见 worker-pool 头注 G-426 条
              description: '无活动超时秒数(可选,默认 300;每次任务活动重排,总上限 3 倍,真正卡死才触发)',
            },
          },
          required: ['persona', 'task'],
        },
      },
      topology: {
        type: 'string',
        enum: ['star', 'mesh', 'chain', 'hierarchical'],
        description: '协作拓扑(默认 star)',
      },
      maxWorkers: {
        type: 'number',
        description: `最大并发 worker 数(未传按 CPU 推导;传入会被钳到 ${MIN_CONCURRENCY} 至 ${MAX_CONCURRENCY})`,
      },
    },
    required: ['requests'],
    async execute(args): Promise<ToolResult> {
      const requests = args.requests as SubagentSpawnRequest[] | undefined;
      if (!requests || !Array.isArray(requests) || requests.length === 0) {
        return { success: false, output: '', error: '缺少 requests 参数(非空数组)' };
      }

      const topology = (args.topology as Topology) ?? 'star';
      // 模型自填值不信任:钳制在唯一出口里做(旧写法 `(args.maxWorkers as number) ?? 4` 上下限都不管)
      const maxWorkers = resolveMaxConcurrency(
        typeof args.maxWorkers === 'number' ? args.maxWorkers : undefined,
      );

      // 注入默认 workspacePath 和 model(子 agent 默认在主 agent 工作区跑,用主 agent 模型)
      const reqsWithWorkspace: SubagentSpawnRequest[] = requests.map((r) => ({
        ...r,
        workspacePath: r.workspacePath ?? parentOpts.workspacePath,
        model: r.model ?? parentOpts.modelId,
      }));

      try {
        const results: SubagentSpawnResponse[] = await spawnParallelTopology(reqsWithWorkspace, {
          topology,
          maxWorkers,
        });

        const summary = results
          .map(
            (r, i) =>
              `[${i + 1}] ${r.subagentId} (PID ${r.pid}) — ${r.status}${r.error ? ` ERROR: ${r.error}` : ''}`,
          )
          .join('\n');

        const allCompleted = results.every((r) => r.status === 'completed');
        return {
          success: allCompleted,
          output: `并行 spawn ${results.length} 个子 agent(topology=${topology}):\n${summary}`,
          error: allCompleted
            ? undefined
            : `${results.filter((r) => r.status !== 'completed').length} 个子 agent 失败`,
        };
      } catch (err) {
        return {
          success: false,
          output: '',
          error: `spawn_parallel 失败: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    },
  };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
