// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Agent 工具系统 — Tool 接口定义与工具注册器。
 *
 * 灵感来源:参考行业 Agent 框架的 tools crate 设计,融合 codex/opencode 的工具实现。
 * 简化策略(做减法):
 *   - 用 prompt engineering 让 LLM 输出结构化 tool_call 块(不依赖后端 function calling 支持)
 *   - Tool 接口最小化:name/description/parameters schema/execute
 *   - 工具注册器统一管理,支持动态注册(MCP 工具后并入)
 *   - 执行结果统一格式化(tool_result)回传给 LLM
 *   - 危险操作(dangerLevel='dangerous')执行前需用户确认
 *
 * 工具调用格式(LLM 输出):
 * ```tool_call
 * {"name":"read_file","arguments":{"path":"src/index.ts"}}
 * ```
 */

import { redactSecrets } from '../redact.js';
import { checkFolderTrust, type FolderTrustMap } from '../sandbox/index.js';
import { checkPermission, type PermissionRules } from './permissions.js';
import { shadowValidateToolArguments } from './argument-validation-telemetry.js';
import { noteDangerousApproval } from './danger-gate.js';
import { BROWSER_TOOLS } from './browser.js';
import { BROWSER_PAGE_TOOLS } from './browser-page.js';
import {
  InMemoryRegistry,
  CompoundResolver,
  wrapTool,
  ToolNotFoundError,
  type ToolRegistry,
} from './hub/index.js';
import { projectToolInputSchema, type ToolContractMount } from '@ihui/types';

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  enum?: string[];
  items?: ToolParameter;
  properties?: Record<string, ToolParameter>;
  required?: string[];
}

export interface ToolSchema {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameter>;
    required: string[];
  };
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
  /** P1-4 错误类型分级,供调用方/LLM 判断是否需要重试 */
  errorType?: string;
  /**
   * 该结果不是 handler 自己产出的,而是**执行链边界**在"墙钟到点"或"外层取消"时代为结算的。
   *
   * 两个用途,缺一不可:
   * 1. `executeWithRetry` 见到它**立即停止自动重试** —— 一次预算再叠一次重试等于两倍墙钟,
   *    而超时被判成"可重试"是本票要消灭的挂死形态的延长线(`timeout` 在 `isRetryableErrorType` 里是可重试档)。
   * 2. 回灌给模型的错误里因此带着"副作用不确定"的语义:本票只能让**调用方**脱身,
   *    不合作的 handler 仍在后台继续跑完(强杀子进程树属另一票 A8E-1 的范围,不在本票)。
   */
  abortedByExecBudget?: 'budget' | 'cancelled';
}

/**
 * 一等工具面。
 *
 * `ToolContractMount`(packages/types/src/tool-contract.ts,A13 第一阶段)带一个**可选** `contract`,
 * 本票只让 Tool 承接契约类型,**不改任何缺省行为**:`dangerLevel` 的缺省语义仍是"按只读处理",
 * 四个既有消费者(clawdbot/permission-guard、routes/agent-runtime、ai-service/agent_engine、
 * 本端 commands/agent)一律未动。翻缺省("未声明即按最危险处理")是行为变更 —— 用户侧表现为
 * "昨天能跑今天全要批准",必须单独一票逐点复核后再做。
 *
 * 第二阶段的输入(2026-09-25 立项时实测,数字会随仓库推进漂移,**复测为准**:
 * `node scripts/check-tool-contract-declared.mjs --flip-audit`):
 *   - 契约缺席的工具字面量:102 个 —— 若把判定源整体换成 `mayWriteWorkspace`,这 102 个全部按不可信处置;
 *   - 其中**连 dangerLevel 都没写**的:16 个 —— 今天靠"缺省按只读"放行,翻缺省后立刻变成要批准。
 *   所以补档顺序应是:先给 16 个显式 dangerLevel/contract,再谈翻缺省。
 */
export interface Tool extends ToolContractMount {
  name: string;
  description: string;
  parameters: Record<string, ToolParameter>;
  required: string[];
  /** 危险级别:read(只读,默认)/ write(写入)/ dangerous(危险,需用户确认) */
  dangerLevel?: 'read' | 'write' | 'dangerous';
  /**
   * 单次执行的墙钟预算声明(缺省 = 用 `TOOL_EXEC_BUDGET_DEFAULT_MS`)。
   * 唯一解释器是 `resolveToolExecBudgetMs()`,唯一应用点是 `executeWithinExecBudget()`。
   * 结构性不可打断用 `notInterruptible` 形态,**必须带 reason**,且不得改用 `*-exempt:` 注释
   * (那条通道属守门 108 的"到期豁免账",蹭它就是给一道没有寿命的豁免开后门)。
   */
  execBudget?: ToolExecBudget;
  execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}

// ==================== 工具执行墙钟预算与取消下发 ====================
//
// 立票理由(实测,不是设想):本文件的 `executeToolCall` 在改前对 `tool.execute` 的 await
// **既无墙钟上限也无取消通道**,而 `tools/subagent.ts` 的 `dispatch_subagent` 在里面嵌套跑
// 一整条 agent loop ⇒ provider 一挂就是这一枚工具调用永久挂起,且 Ctrl-C 到不了。
// 探针读数见交付报告(同一探针在改后由"未结算"翻成"预算内结算")。

/** 默认档 30 分钟。取值依据:本仓工具**自身**最长的一档限是后台任务等待 600s(`tools/background-registry.ts`)
 *  与 DAP stopped 事件 300s(`tools/debug.ts`),默认档必须显著高于所有自限档 —— 否则本票会把"工具自己
 *  还在正常工作"判成超时,即"把现有正常工具改红"。30 min = 现有最长自限 × 3。
 *  需要更长的工具**显式声明** `execBudget`,不得为消红去抬这一档。 */
export const TOOL_EXEC_BUDGET_DEFAULT_MS = 30 * 60_000;

/** 硬封顶 60 分钟:任何来源(默认档 / 工具声明 / 环境变量覆盖)都不得越过。
 *  这一行是"模型侧或工具侧覆盖越过后端上限"的唯一收口点,删掉它 = 本票失效。 */
export const TOOL_EXEC_BUDGET_MAX_MS = 60 * 60_000;

/** 结算宽限:到点后先 abort,再给 handler 这么多时间自己收尾;仍不 settle 就**停止等待**并代为结算。
 *  语义是"到点之后额外留给清理的时间",不是"把超时推迟"。 */
export const TOOL_EXEC_BUDGET_SETTLE_GRACE_MS = 5_000;

/** 逃生舱:总开关(仅应急)。设 off/0/false 时整条预算不生效,行为逐路径回到改前。 */
const EXEC_BUDGET_DISABLE_ENV = 'IHUI_TOOL_EXEC_BUDGET';
/** 观察档:覆盖默认值,用于逐档量"哪些工具会撞上新上限"(仍受 MAX 封顶)。 */
const EXEC_BUDGET_DEFAULT_ENV = 'IHUI_TOOL_EXEC_BUDGET_MS';

/** 显式预算档(毫秒)。 */
export interface ToolExecBudgetMs {
  readonly ms: number;
}

/** 结构性声明:该工具**不该被墙钟打断**,且理由写进数据而不是注释(注释会被编辑掉,数据不会)。 */
export interface ToolExecBudgetNotInterruptible {
  readonly notInterruptible: true;
  readonly reason: string;
}

export type ToolExecBudget = ToolExecBudgetMs | ToolExecBudgetNotInterruptible;

function parsePositiveIntMs(raw: string | undefined): number | undefined {
  if (raw === undefined || raw.trim() === '') return undefined;
  const n = Number(raw.trim());
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * 预算解析的**唯一出口**。三段优先级:
 *   ① 结构性声明 notInterruptible ⇒ `undefined`(连定时器都不建)
 *   ② 工具显式声明 `ms` ⇒ 该值
 *   ③ 否则 环境变量覆盖档 ?? 默认档
 * 最后**一律**过 `Math.min(…, TOOL_EXEC_BUDGET_MAX_MS)` 封顶。
 *
 * 刻意不读模型传的参数(`args.timeout_ms` 一类):那等于把"这次执行多久"交给被调用方决定,
 * 而本票要收的是"宿主说了算"。已有自带 timeout 参数的工具(run_command / spawn_parallel)
 * 由其 handler 内部解释,不在本函数覆盖面内。
 *
 * `0` 与非法值一律退回默认档 —— 这不是宽容,是把"0 被压成 1ms 立刻超时"这一型写死在门外。
 */
export function resolveToolExecBudgetMs(
  tool: Pick<Tool, 'name' | 'execBudget'>,
  env: NodeJS.ProcessEnv = process.env,
): number | undefined {
  const declared = tool.execBudget;
  if (declared && 'notInterruptible' in declared) return undefined;
  if (/^(?:off|0|false)$/i.test((env[EXEC_BUDGET_DISABLE_ENV] ?? '').trim())) return undefined;
  const envDefault = parsePositiveIntMs(env[EXEC_BUDGET_DEFAULT_ENV]);
  const base = declared ? declared.ms : (envDefault ?? TOOL_EXEC_BUDGET_DEFAULT_MS);
  const safe = Number.isFinite(base) && base > 0 ? base : (envDefault ?? TOOL_EXEC_BUDGET_DEFAULT_MS);
  return Math.min(safe, TOOL_EXEC_BUDGET_MAX_MS);
}

const NOOP_UNLINK = (): void => undefined;

/**
 * 父 → 子单向 link,并**返回真正解绑的闭包**。
 *
 * 三条都不可省:
 * - 父已 aborted ⇒ 立刻 abort 子再返回(否则子控制器永远等不到这次取消);
 * - 返回值必须 `removeEventListener` ⇒ 否则每枚工具调用在长会话的父 signal 上留一个永不释放的监听器;
 * - 透传 `parent.reason` ⇒ 取消原因不得在链路中途被换成无意义的 Error。
 */
export function linkAbortSignal(
  parent: AbortSignal | undefined,
  child: AbortController,
): () => void {
  if (!parent) return NOOP_UNLINK;
  if (parent.aborted) {
    child.abort(parent.reason);
    return NOOP_UNLINK;
  }
  const relay = (): void => child.abort(parent.reason);
  parent.addEventListener('abort', relay, { once: true });
  return () => parent.removeEventListener('abort', relay);
}

/**
 * 到点/取消时代为结算的失败结果。
 *
 * 文案刻意用 ASCII:这两条是**新增**的运行时字面量,守门 70(硬编码中文基线棘轮)按
 * "该文件在 HEAD 自身的命中数"给额度,新写一行中文界面文案就是凭空+1 红(实测本文件
 * 38 > 基线 33 就是这两条买来的)。正解本是走 `t()` + 语言包,但 cli 的语言包不在本票
 * 文件清单内(§11 的"只允许以下文件");而这两串的消费方是**模型**不是终端用户界面,
 * 走英文零信息损失。将来要给用户看,再连 i18n 一起做,不得反过来把中文塞回来消红。
 */
function execBudgetResult(
  toolName: string,
  kind: 'budget' | 'cancelled',
  budgetMs: number | undefined,
): ToolResult {
  if (kind === 'budget') {
    const limitLabel = budgetMs === undefined ? 'not-configured' : `${budgetMs}ms`;
    return {
      success: false,
      output: '',
      error:
        `Tool ${toolName} exceeded its wall-clock execution budget (${limitLabel}) and was aborted. ` +
        `Side effects MAY already have happened - abort only releases the caller, the handler may still be ` +
        `running in background. Verify on-disk / remote state before retrying.`,
      errorType: 'timeout',
      abortedByExecBudget: 'budget',
    };
  }
  return {
    success: false,
    output: '',
    error:
      `Tool ${toolName} was cancelled by the outer scope (user interrupt or parent task stopped). ` +
      `Side effects are indeterminate - do NOT assume nothing happened.`,
    errorType: 'cancelled',
    abortedByExecBudget: 'cancelled',
  };
}

/**
 * 工具执行的**唯一**墙钟/取消应用点。
 *
 * @param tool 只需 name + execBudget(hub 路径拿不到本地 Tool 对象,按默认档走)
 * @param ctx  工具上下文,`ctx.signal` 是外层取消的来源
 * @param run  真正的执行体;收到的 signal 是"父取消 ∪ 预算到点"的合成信号,可能为 undefined
 *
 * 覆盖面如实登记:只包 handler 本身。`confirmDangerous` 的等待发生在 `executeToolCall` 里、
 * 本函数之外 ⇒ 用户思考时间不计入预算(这是对的,否则"用户还没点确认"会被系统判成工具超时)。
 */
export async function executeWithinExecBudget(
  tool: Pick<Tool, 'name' | 'execBudget'>,
  ctx: ToolContext,
  run: (signal: AbortSignal | undefined) => Promise<ToolResult>,
): Promise<ToolResult> {
  const parentSignal = ctx.signal;
  if (parentSignal?.aborted) {
    // 提前拒绝:取消已经发生 ⇒ 一次 handler 都不该调
    return execBudgetResult(tool.name, 'cancelled', undefined);
  }
  const budgetMs = resolveToolExecBudgetMs(tool);
  if (budgetMs === undefined && !parentSignal) {
    // 零回归路径:结构性豁免且无外层信号 ⇒ 与改前逐字同形(不建 controller、不建 timer)
    return run(undefined);
  }

  const controller = new AbortController();
  const unlinkParent = linkAbortSignal(parentSignal, controller);
  let budgetTimer: NodeJS.Timeout | undefined;
  let graceTimer: NodeJS.Timeout | undefined;
  let trigger: 'budget' | 'cancelled' | undefined;

  try {
    return await new Promise<ToolResult>((resolve, reject) => {
      let settled = false;
      const settle = (r: ToolResult): void => {
        if (settled) return;
        settled = true;
        resolve(r);
      };
      // handler **自己抛的错原样冒泡**(不代偿成 ToolResult):`executeToolCall` 的 hub 分支靠
      // `err instanceof ToolNotFoundError` 决定要不要回落到本地注册表,把它包成结果会让那条
      // fallback 静默失效;而 `executeWithRetry` 的 catch 已经在做同样的转换,这里不需要重复。
      const settleReject = (err: unknown): void => {
        if (settled) return;
        settled = true;
        reject(err);
      };
      // 一次故障只产出一条结论:trigger 与 settled 是同一件事的两道闸(前者定性质,后者防双结算)
      const enterGrace = (kind: 'budget' | 'cancelled'): void => {
        if (trigger) return;
        trigger = kind;
        controller.abort(new Error(`ihui:exec-${kind}:${tool.name}`));
        graceTimer = setTimeout(
          () => settle(execBudgetResult(tool.name, kind, budgetMs)),
          TOOL_EXEC_BUDGET_SETTLE_GRACE_MS,
        );
      };
      if (budgetMs !== undefined) budgetTimer = setTimeout(() => enterGrace('budget'), budgetMs);
      // 父取消经 linkAbortSignal 到达本 controller;预算到点也会 abort 本 controller,
      // 但那时 trigger 已被置为 'budget',所以不会二次产出一条"已取消"(归因分叉是这条的坏状态)。
      controller.signal.addEventListener('abort', () => enterGrace('cancelled'), { once: true });
      // 用 async IIFE 包一层:handler **同步抛错**也必须走同一条结算路径,否则 timer 与
      // 父 signal 上的监听器都留在那儿(本函数是 async,同步抛错会直接冒泡,finally 拿不到机会)。
      void (async () => run(controller.signal))().then(settle, settleReject);
    });
  } finally {
    if (budgetTimer) clearTimeout(budgetTimer);
    if (graceTimer) clearTimeout(graceTimer);
    unlinkParent();
  }
}


export interface ToolContext {
  workspacePath: string;
  /** 危险操作确认回调,返回 true 表示允许执行。未提供时 dangerous 操作直接拒绝。 */
  confirmDangerous?: (tool: Tool, args: Record<string, unknown>) => Promise<boolean>;
  /**
   * 会话级危险旁路披露字段(--allow-dangerous;2026-09-25 L7905 收口)。
   *
   * 此前旁路事实只活在调用方构造的 confirmDangerous 闭包里,工具层结构上不可见。
   * 现由调用方随 ctx 传入(setupAgentTools 的 allowDangerous),工具层可据此追溯
   * 「本次危险放行时会话级 flag 是否在位」(executeToolCall 获准后记入
   * danger-gate.ts 的 noteDangerousApproval 披露计数)。
   *
   * 影子式扩展(刻意不改确认语义):放行决策仍 100% 由 confirmDangerous 决定,
   * 本字段**不参与任何判定** —— 为 true 但未提供 confirmDangerous 的 dangerous
   * 工具依旧拒绝(fail-closed 不变)。未传(undefined)时行为与引入前逐字节等价。
   */
  allowDangerous?: boolean;
  /** 沙盒配置(命令白名单 + env 过滤),由 setupAgentTools 从 settings.json 注入 */
  sandbox?: {
    /** 三态:null = 禁止一切命令,undefined / [] = 不检查(与 SandboxOptions 同口径) */
    commandAllowlist?: string[] | null;
    blockedEnvVars?: string[];
    allowedPaths?: string[];
  };
  /** 路径信任映射(可选,用于 write/edit/delete 工具的额外路径检查) */
  folderTrust?: FolderTrustMap;
  /** P0-7 Permission rules:白名单/黑名单控制(--tools/--disallowed-tools CLI flag 注入) */
  permissions?: PermissionRules;
  /**
   * 外层取消信号(Ctrl-C / 父任务停止),由 `executeWithinExecBudget()` 读取并**继续下发**给
   * handler 与被 link 出来的子 controller。
   *
   * 为什么不是可选形参了还留 `?`:`commands/agent.ts` 构造 ctx 的那一处(以及 hub 适配器、
   * server/agent-core 等 4 处构造点)不在本票文件清单内,收紧成必填会在别人的文件上产红。
   * 所以本票装的是"接收端 + 下发端"两段,父级注入那一行由主会话补;在补上之前,
   * **墙钟预算仍然生效**(它不依赖父信号),即挂死已被收口,只有"取消能走多深"这一半待接线。
   * 该缺口由守门 `scripts/check-tool-exec-budget.mjs` 的 S2 按 HEAD 棘轮点名,不会静默。
   */
  signal?: AbortSignal;
}

const registry = new Map<string, Tool>();

// ==================== P1-5 Computer Hub 集成(feature flag 默认关闭)====================
// Hub 模式启用时,CompoundResolver 调度 local-shadows-remote;关闭时完全等同原 Map 路径(零回归)。

/** Hub 本地注册表(现有 Tool wrap 后注册到这里) */
const hubLocalRegistry = new InMemoryRegistry();
/** Hub 远程注册表(MCP 工具接入时填充,通过 setHubRemoteRegistry 设置) */
let hubRemoteRegistry: ToolRegistry | undefined;
/** Hub 组合解析器(启用时构造,禁用时置 undefined) */
let hubResolver: CompoundResolver | undefined;
/** Hub 是否启用(由 settings.toolHub.enabled 决定,默认 false) */
let hubEnabled = false;

/** 启用 hub 模式:把现有 registry 中所有工具 wrap 注册到 hubLocalRegistry,构造 CompoundResolver */
export function enableToolHub(): void {
  hubEnabled = true;
  hubLocalRegistry.clear();
  for (const tool of registry.values()) {
    hubLocalRegistry.register(wrapTool(tool));
  }
  hubResolver = new CompoundResolver(hubLocalRegistry, hubRemoteRegistry);
}

/** 禁用 hub 模式:回到原 Map 路径 */
export function disableToolHub(): void {
  hubEnabled = false;
  hubResolver = undefined;
}

/** 设置 hub remote registry(MCP 工具接入时调用;若 hub 已启用,同步重建 resolver) */
export function setHubRemoteRegistry(remote: ToolRegistry): void {
  hubRemoteRegistry = remote;
  if (hubResolver) {
    hubResolver = new CompoundResolver(hubLocalRegistry, hubRemoteRegistry);
  }
}

/** 查询 hub 是否启用 */
export function isToolHubEnabled(): boolean {
  return hubEnabled;
}

function registerTool(tool: Tool): void {
  registry.set(tool.name, tool);
}

export function registerTools(tools: Tool[]): void {
  for (const t of tools) {
    registerTool(t);
    // 如果 hub 已启用,同步注册到 hub local registry(后续 MCP 工具接入时也走这条路径)
    if (hubEnabled) {
      hubLocalRegistry.register(wrapTool(t));
    }
  }
}

/** 注册浏览器自动化工具(幂等,重复调用仅覆盖同名工具) */
export function registerBrowserTools(): void {
  registerTools(BROWSER_TOOLS);
  // 句柄族动词与选择器族同属 browser 工具面，在这里并入一次，
  // 免得每个调用点（repl / acp / headless）各自记得加一遍 —— 漏一处就是造好没装车。
  registerTools(BROWSER_PAGE_TOOLS);
}

export function getTool(name: string): Tool | undefined {
  return registry.get(name);
}

export function listTools(): Tool[] {
  return Array.from(registry.values());
}

export function clearTools(): void {
  registry.clear();
}

export function buildSystemPrompt(tools: Tool[], extraContext?: string, planFirst?: boolean): string {
  const toolDescriptions = tools
    .map((t) => {
      const params = Object.entries(t.parameters)
        .map(([name, p]) => {
          const req = t.required.includes(name) ? ' (必填)' : '';
          const enumStr = p.enum ? ` 可选值: ${p.enum.join('|')}` : '';
          return `    - ${name}: ${p.type}${req} — ${p.description}${enumStr}`;
        })
        .join('\n');
      return `### ${t.name}\n${t.description}\n参数:\n${params}`;
    })
    .join('\n\n');

  const contextSection = extraContext
    ? `\n\n## 项目上下文\n\n${extraContext}\n`
    : '';

  const planSection = planFirst
    ? `\n\n## 任务规划(必须先规划后执行)

在执行任何工具调用前,你必须先输出一个任务规划块:

\`\`\`plan
1. <步骤1描述>
2. <步骤2描述>
3. <步骤N描述>
\`\`\`

规划完成后再逐步执行工具调用。每完成一步,简要说明进度并继续下一步。若规划需调整,先输出新的 plan 块再继续。`
    : '';

  return `你是一个强大的编码助手。你可以使用以下工具来完成任务。
${contextSection}${planSection}

## 可用工具

${toolDescriptions}

## 工具调用格式

当需要使用工具时,在回复中输出以下格式的代码块:

\`\`\`tool_call
{"name":"工具名","arguments":{"参数名":"参数值"}}
\`\`\`

可以连续调用多个工具(每个占一个代码块)。工具执行后,结果会以 user 消息形式返回,你可以继续处理。

当任务完成或无需工具时,正常回复即可(不包含 tool_call 块)。

## 注意事项

- 优先使用工具获取信息,不要猜测文件内容
- 文件路径相对于工作区根目录
- 一次只调用必要的工具,避免冗余操作
- 修改/创建文件必须使用 edit_file / write_file 工具,禁止通过 run_command 执行内嵌脚本(如 node -e / sed -i)改文件——跨 shell 引号转义极易失败且错误不易察觉
- 声称完成前,用 read_file 复核关键改动确实落盘`;
}

export interface ParsedToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

const TOOL_CALL_REGEX = /```tool_call\s*\n([\s\S]*?)```/g;

export function parseToolCalls(text: string): ParsedToolCall[] {
  const calls: ParsedToolCall[] = [];
  let match: RegExpExecArray | null;
  while ((match = TOOL_CALL_REGEX.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]!.trim());
      if (parsed && typeof parsed.name === 'string' && typeof parsed.arguments === 'object') {
        calls.push({ name: parsed.name, arguments: parsed.arguments ?? {} });
      }
    } catch {
      // 忽略解析失败的块
    }
  }
  TOOL_CALL_REGEX.lastIndex = 0;
  return calls;
}

const PLAN_BLOCK_REGEX = /```plan\s*\n([\s\S]*?)```/;

/** 从 LLM 输出中解析 plan 块,返回 plan 内容(无 ```plan 包裹),不存在返回 null。 */
export function parsePlanBlock(text: string): string | null {
  const m = PLAN_BLOCK_REGEX.exec(text);
  return m ? m[1]!.trim() : null;
}

export function formatToolResult(call: ParsedToolCall, result: ToolResult): string {
  const status = result.success ? '✓' : '✗';
  const errorPart = result.error ? `\n错误: ${result.error}` : '';
  const safeOutput = redactSecrets(result.output);
  return `[工具结果 ${status}] ${call.name}\n${safeOutput}${errorPart}`;
}

export async function executeToolCall(
  call: ParsedToolCall,
  ctx: ToolContext,
): Promise<ToolResult> {
  // P1-5 Computer Hub 集成:flag 启用时优先走 CompoundResolver.dispatch(local-shadows-remote)
  // ToolNotFoundError 时 fallback 到原 getTool 路径(零回归保障);其他错误转 ToolResult 返回。
  // 横切关注点(permission / rate limit / retry)在 hub 未启用或 fallback 时仍由原路径处理。
  if (hubEnabled && hubResolver) {
    const resolver = hubResolver;
    try {
      // hub 路径同样收进唯一出口:这一支拿不到本地 Tool 对象(可能是 MCP 远端工具),
      // 所以按**默认档**约束 —— 特性开关不得成为绕过墙钟预算的第二条执行路径。
      return await executeWithinExecBudget({ name: call.name }, ctx, (signal) =>
        resolver.dispatch(call.name, call.arguments, signal ? { ...ctx, signal } : ctx),
      );
    } catch (err) {
      if (!(err instanceof ToolNotFoundError)) {
        return {
          success: false,
          output: '',
          error: err instanceof Error ? err.message : String(err),
        };
      }
      // ToolNotFoundError: fallback 到原 getTool + 执行路径
    }
  }
  const tool = getTool(call.name);
  if (!tool) {
    return { success: false, output: '', error: `未知工具: ${call.name}`, errorType: 'not_found' };
  }
  // A31 第①步「影子校验」(默认 off ⇒ 这一行等价于不存在):跑校验、只进遥测计数器,
  // 不改 call.arguments、不改返回值、不拦调用。刻意放在**批准弹窗之前** —— 弹窗与
  // "批准 = 执行"的同一引用传递链路(上一票实测出的语义)在此完全不受影响。
  // 已知覆盖面缺口:hubEnabled 分支在 getTool 之前就 return 了,那里拿不到 Tool 对象,本票不扩面。
  shadowValidateToolArguments(tool, call.arguments);
  // P0-7 Permission rules:白名单/黑名单拦截(在 rate limit 之前,避免被限流工具仍消耗配额)
  if (ctx.permissions) {
    const perm = checkPermission(call.name, ctx.permissions);
    if (!perm.allowed) {
      return {
        success: false,
        output: '',
        error: perm.reason ?? `工具 ${call.name} 被权限规则拒绝`,
        errorType: 'permission_denied',
      };
    }
  }
  // P1-4 Rate limiting:同一工具 10 秒内最多 5 次,超限返回 error
  const rateLimit = checkRateLimit(call.name);
  if (!rateLimit.allowed) {
    return { success: false, output: '', error: rateLimit.reason, errorType: 'rate_limited' };
  }
  if (tool.dangerLevel === 'dangerous') {
    const allowed = ctx.confirmDangerous ? await ctx.confirmDangerous(tool, call.arguments) : false;
    // 披露面(L7905 收口):只记账不改判定 —— 放行路径(会话级 flag / 回调自批)可追溯
    if (allowed) noteDangerousApproval(ctx.allowDangerous === true, tool.name);
    if (!allowed) {
      return {
        success: false,
        output: '',
        error: `危险操作被拒绝(需用户确认): ${call.name}`,
      };
    }
  }
  // P1-5 Error recovery:read 工具失败自动重试 1 次 + 100ms 退避;write/dangerous 不重试(避免副作用)
  return executeWithRetry(tool, call.arguments, ctx);
}

// ==================== P1-4 Rate limiting(滑动窗口计数)====================

export interface RateLimitOptions {
  windowMs?: number;
  maxCalls?: number;
}

const DEFAULT_RATE_LIMIT_WINDOW_MS = 10_000;
const DEFAULT_RATE_LIMIT_MAX_CALLS = 5;
const toolCallTimestamps = new Map<string, number[]>();
let globalRateLimitOpts: RateLimitOptions = {};

/**
 * 检查工具调用频率是否超限(滑动窗口算法)。
 *
 * 默认:同一工具 10 秒内最多 5 次。超限返回 { allowed: false, reason },executeToolCall 会以此拒绝执行。
 * 滑动窗口比固定窗口更公平 — 不会因为跨越窗口边界而突然允许突发流量。
 */
export function checkRateLimit(toolName: string, opts: RateLimitOptions = {}): { allowed: boolean; reason?: string } {
  const windowMs = opts.windowMs ?? globalRateLimitOpts.windowMs ?? DEFAULT_RATE_LIMIT_WINDOW_MS;
  const maxCalls = opts.maxCalls ?? globalRateLimitOpts.maxCalls ?? DEFAULT_RATE_LIMIT_MAX_CALLS;
  const now = Date.now();
  const timestamps = toolCallTimestamps.get(toolName) ?? [];
  const recent = timestamps.filter((t) => now - t < windowMs);
  if (recent.length >= maxCalls) {
    const oldest = recent[0]!;
    const waitMs = windowMs - (now - oldest);
    return {
      allowed: false,
      reason: `工具 ${toolName} 触发限流:${windowMs / 1000} 秒内已调用 ${recent.length} 次(上限 ${maxCalls}),请 ${Math.max(waitMs, 1)}ms 后再试`,
    };
  }
  recent.push(now);
  toolCallTimestamps.set(toolName, recent);
  return { allowed: true };
}

/** 重置限流器状态(主要用于测试) */
export function resetRateLimiter(): void {
  toolCallTimestamps.clear();
}

/** 配置全局限流参数(可选,用于灵活调整窗口大小和最大次数) */
export function setGlobalRateLimitOpts(opts: RateLimitOptions): void {
  globalRateLimitOpts = opts;
}

// ==================== P1-5 Error recovery(读工具自动重试)====================

const READ_TOOL_RETRY_DELAY_MS = 100;
const READ_TOOL_MAX_RETRIES = 1;

/**
 * 执行工具,对 dangerLevel='read' 的幂等读工具失败时自动重试。
 *
 * 策略:
 *   - read 工具:失败后等待 100ms 重试 1 次(应对瞬时网络/文件系统抖动)
 *   - write/dangerous 工具:不重试(避免重复写入/删除等副作用)
 *   - 抛异常和返回 success=false 都视为失败
 */
export async function executeWithRetry(
  tool: Tool,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const maxRetries = tool.dangerLevel === 'read' ? READ_TOOL_MAX_RETRIES : 0;
  let lastResult: ToolResult = { success: false, output: '', error: '未执行' };
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await executeWithinExecBudget(tool, ctx, (signal) =>
        tool.execute(args, signal ? { ...ctx, signal } : ctx),
      );
      if (result.success) return result;
      lastResult = result;
      // 墙钟/取消代偿的失败**不进重试**:errorType 'timeout' 在 `isRetryableErrorType` 里是
      // 可重试档,照旧走一遍等于把一次挂死延长成两倍预算 —— 那正是本票要收口的形态。
      if (result.abortedByExecBudget) break;
    } catch (err) {
      lastResult = {
        success: false,
        output: '',
        error: err instanceof Error ? err.message : String(err),
      };
    }
    // P1-4 仅对可重试错误类型进行重试,避免对 permission/unknown 等无效重试
    if (attempt < maxRetries) {
      const errorType = lastResult.errorType ?? classifyError(lastResult.error);
      if (!isRetryableErrorType(errorType)) break;
      await new Promise((resolve) => setTimeout(resolve, READ_TOOL_RETRY_DELAY_MS));
    }
  }
  // P1-4 错误分级:优先保留工具显式标记,其次启发式分类
  if (lastResult.errorType === undefined) {
    lastResult = { ...lastResult, errorType: classifyError(lastResult.error) };
  }
  return lastResult;
}

// ==================== P1-4 Error classification ====================

export type ErrorType =
  | 'rate_limited'
  | 'timeout'
  | 'permission'
  | 'not_found'
  | 'network'
  | 'unknown';

/** 根据错误文本启发式分类错误类型(大小写不敏感)。 */
export function classifyError(error?: string | null): ErrorType {
  const e = (error ?? '').toLowerCase();
  if (
    e.includes('rate limit') ||
    e.includes('限流') ||
    e.includes('too many requests') ||
    e.includes('429')
  )
    return 'rate_limited';
  if (
    e.includes('timeout') ||
    e.includes('timed out') ||
    e.includes('超时') ||
    e.includes('etimedout')
  )
    return 'timeout';
  if (
    e.includes('permission denied') ||
    e.includes('access forbidden') ||
    e.includes('权限不足') ||
    e.includes('操作被拒绝') ||
    e.includes('eacces') ||
    e.includes('eperm')
  )
    return 'permission';
  if (
    e.includes('not found') ||
    e.includes('enoent') ||
    e.includes('不存在') ||
    e.includes('no such file')
  )
    return 'not_found';
  if (
    e.includes('network error') ||
    e.includes('econnreset') ||
    e.includes('econnrefused') ||
    e.includes('fetch failed') ||
    e.includes('连接被拒绝') ||
    e.includes('enotfound') ||
    e.includes('epipe')
  )
    return 'network';
  return 'unknown';
}

/** 判断错误类型是否可重试(network/timeout/rate_limited)。 */
export function isRetryableErrorType(errorType: string | undefined): boolean {
  return errorType === 'network' || errorType === 'timeout' || errorType === 'rate_limited';
}

/** 判断错误类型是否为致命错误(仅 permission)。 */
export function isFatalErrorType(errorType: string | undefined): boolean {
  return errorType === 'permission';
}

/**
 * 检查路径是否允许写操作。
 * 返回 { allowed: boolean, reason?: string }
 */
export function checkPathWritePermission(
  filePath: string,
  ctx: ToolContext,
): { allowed: boolean; reason?: string } {
  if (!ctx.folderTrust) return { allowed: true };
  const level = checkFolderTrust(filePath, ctx.folderTrust);
  if (level === 'forbidden') {
    return { allowed: false, reason: `路径 ${filePath} 被 folder_trust 标记为 forbidden,禁止修改` };
  }
  if (level === 'read-only') {
    return { allowed: false, reason: `路径 ${filePath} 被 folder_trust 标记为 read-only,禁止修改` };
  }
  return { allowed: true };
}

// ==================== LSP Tools(Wave 1 P0:对标 OpenCode 开箱即用 LSP)====================
import { registerLspTools } from './lsp.js';
export { registerLspTools };
registerLspTools();

// ==================== 四层记忆 + Dream 梦境工具(2026-07-22 新增,对标 OpenClaw Mem)====================
import { registerMemoryTools } from './memory.js';
export { registerMemoryTools };
registerMemoryTools();

// ==================== Git 工作流深化工具(Wave 8,2026-07-22 新增,对标 OpenClaw/OpenCode)====================
// 高级 Git 工具(branch/merge/rebase/stash/conflict/tag/remote)+ GitHub PR 工具(PR/Issue/Release)
// 通过 git.ts 的 GIT_TOOLS 统一注册到 agent.ts,GIT_ADVANCED_TOOLS/GITHUB_PR_TOOLS 在此 re-export 供按需导入
// ==================== 原生 Function Calling(OpenAI / Anthropic 兼容)====================

/** OpenAI 兼容的 provider 工具 schema 条目 */
export interface ProviderToolSchema {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required: string[];
    };
  };
}

/**
 * 把 Tool[] 转为 OpenAI 兼容的 tools schema 数组,用于原生 function calling 下发。
 * 输出为深拷贝 — 修改 schema 不会影响原 Tool 定义。
 *
 * 模型可见面自本票起**只由投影器产出**(`@ihui/types/schema-projection`)。原先这里有一份手写的
 * `toJsonProperty` 递归转换 —— 它与校验面(argument-validator 读的同一份 `parameters`)各写一遍,
 * 正是"发给 provider 的参数形态"与"我们自己校验用的规则"能分叉的成因。删掉后只剩一条出口。
 *
 * 等价性取证(2026-09-25,替换前跑的 A/B,两侧同瞬间吃真 Tool 对象):
 * `apps/cli/node_modules/.bin/tsx .ihui-agent/tmp/a13-baseline/ab-equality.mts`
 * → 覆盖 158 个真工具对象(含 factory 产出的多实例),**158/158 线字节相同 + 属性名集合相同 +
 * required 集合相同**,归一化账本零动作。数字会随仓库推进漂移,复测请按上面命令跑。
 */
export function toolsToProviderSchema(tools: Tool[]): ProviderToolSchema[] {
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: projectToolInputSchema(t.parameters, t.required),
    },
  }));
}

/** 解析 arguments 字段:JSON 字符串 / 对象 / 非法值 → {} */
function parseToolArguments(raw: unknown): Record<string, unknown> {
  if (raw === null || raw === undefined) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  return {};
}

/**
 * 按原生 content 结构解析工具调用,支持 4 种形态:
 *   1. OpenAI 消息形态 { role:'assistant', tool_calls: [...] }(arguments 为 JSON 字符串或对象)
 *   2. 裸 tool_calls 数组容器 { tool_calls: [...] }
 *   3. Anthropic content block 数组([{type:'tool_use', name, input}, ...])
 *   4. 纯文本 / null → 返回 [](非法条目安全跳过)
 */
export function parseNativeToolCalls(content: unknown): ParsedToolCall[] {
  const calls: ParsedToolCall[] = [];
  if (content === null || content === undefined) return calls;
  // 形态 3:Anthropic content block 数组
  if (Array.isArray(content)) {
    for (const block of content) {
      if (!block || typeof block !== 'object') continue;
      const b = block as Record<string, unknown>;
      if (b.type === 'tool_use' && typeof b.name === 'string') {
        calls.push({ name: b.name, arguments: parseToolArguments(b.input) });
      }
    }
    return calls;
  }
  if (typeof content !== 'object') return calls;
  const obj = content as Record<string, unknown>;
  if (!Array.isArray(obj.tool_calls)) return calls;
  // 形态 1/2:OpenAI tool_calls(裸容器或完整消息)
  for (const entry of obj.tool_calls) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const fn = (e.function ?? e) as Record<string, unknown> | undefined;
    if (!fn || typeof fn !== 'object') continue;
    const name = fn.name;
    if (typeof name !== 'string' || name.length === 0) continue;
    calls.push({ name, arguments: parseToolArguments(fn.arguments) });
  }
  return calls;
}

/**
 * 提取工具调用:原生 content 结构解析优先,解析不到降级走 parseToolCalls 正则
 * (兼容无 function calling 能力的模型 prompt 模式)。
 */
export function extractToolCalls(content: unknown, text: string): ParsedToolCall[] {
  const native = parseNativeToolCalls(content);
  if (native.length > 0) return native;
  return parseToolCalls(text);
}

export { GIT_ADVANCED_TOOLS } from './git-advanced.js';
export { GITHUB_PR_TOOLS } from './github-pr.js';
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
