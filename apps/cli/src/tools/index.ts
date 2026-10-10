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
import { observeShadowToolCall } from '../skills/allowed-tools-shadow.js';
import { checkPermission, checkRulesWithLease, type PermissionRules } from './permissions.js';
import { activePermissionLease } from './permission-lease.js';
import {
  enforceValidateToolArguments,
  noteEnforceRepairRejection,
  resolveToolArgValidationMode,
  shadowValidateToolArguments,
} from './argument-validation-telemetry.js';
import { formatValidationErrorsLine, resolveSchemaOrThrow, validateToolArguments } from './argument-validator.js';
// G-916424:确认窗的 permissionRequest 钩子应答出口(deny/allow/ask/modify 四形状)。
import { runPermissionRequest } from '../hooks/index.js';
import { noteDangerousApproval } from './danger-gate.js';
import { recordApprovedInvocation } from './permission-lease.js';
import { leaseWorkspaceIdOf } from '../utils/permission-lease-flag.js';
// G-710:失败码判定的唯一出口(守门 162 OUTLET_REQUIREMENTS)—— 结构化码先决,文本只兜底且计数。
import { classifyFailureText, RETRYABLE_FAILURE_CODES, ToolError, type FailureCode } from './failure-classification.js';
// G-710:ToolError 由工具主模块递出,handler 与消费侧共享同一个构造函数(守门 162 出口契约)。
export { ToolError };
import {
  auditToolDenial,
  buildToolDenial,
  denialErrorSuffix,
  type ToolCallDenial,
} from '../utils/tool-denial.js';
import { injectHostSection } from '../utils/prompt-injection-registry.js';
import { BROWSER_TOOLS } from './browser.js';
import { BROWSER_PAGE_TOOLS } from './browser-page.js';
import {
  InMemoryRegistry,
  CompoundResolver,
  wrapTool,
  ToolNotFoundError,
  type ToolRegistry,
} from './hub/index.js';
import {
  projectToolInputSchema,
  buildToolResultTruncationRecord,
  type ToolContractMount,
  type ToolResultBudgetContract,
  type ToolResultTruncationFacts,
  type ToolResultTruncationRecord,
} from '@ihui/types';

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  enum?: string[];
  items?: ToolParameter;
  properties?: Record<string, ToolParameter>;
  required?: string[];
  /**
   * 闭合声明(b76-14 G-998176):`false` = 该层只收已声明键(未声明键判 unknown_field);
   * 子 schema 形 = 未声明键按值类型判。**递归语义**:每一层各自声明,嵌套层由
   * argument-validator 的 checkObject 逐层执行 —— 闭集不再只是顶层那一格。
   */
  additionalProperties?: boolean | ToolParameter;
}

export interface ToolSchema {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameter>;
    required: string[];
    /** 顶层闭合声明(G-937978 起收编;嵌套层在 ToolParameter 各自声明) */
    additionalProperties?: boolean;
  };
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
  /** P1-4 错误类型分级,供调用方/LLM 判断是否需要重试 */
  errorType?: string;
  /**
   * 「无活动空闲超时」的结构化 context(G-426,只由执行器边界在 budget 代结算时产出):
   * 上游 subagent/runner 的 reportActivity 语义 —— 墙钟改成"每次活动重排"后,错误必须
   * 自己说明白"为什么还是被杀了":距最后一次活动多久(idleMs)、总共跑了多久(totalMs)、
   * 绝对上限是多少(absoluteCapMs),以及调用方能不能恢复/该不该自动重试。
   * 缺席 = 这条结果不是"空闲超时"代结算,不得由渲染侧从散文里猜。
   */
  timeoutContext?: ToolExecTimeoutContext;
  /**
   * 「为什么被拒」的结构化答复(可诊断化收口票):**只在拒绝路径携带**。
   * 三条闸(权限规则 / 危险工具无确认出口 / 租约摘要漂移)在这里可被测试与上层直接断言
   * (`denial.gate` × `denial.decider`),不依赖任何人读中文短句。参数只落指纹+键名。
   * 本字段不改变任何判定 —— fail-closed 语义与引入前逐字相同。
   */
  denial?: ToolCallDenial;
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
  /**
   * 沙箱一层自己说得出的终态(投影见 `failure-classification.ts::mapTerminalState`)。
   * 与 `abortedByExecBudget` **不是同一格**:那一枚是"执行链边界代结算",这一枚是
   * "沙箱结果自己带着 timedOut"。缺席 = 该结果没有可证的中止,不得由渲染侧猜。
   */
  terminalState?: 'timed_out';
  /** 副作用不确定的盖章:与 `terminalState` 成对出现,单独一枚不产出(`mapTerminalState` 是唯一种它的出口)。 */
  interrupted?: true;
  /**
   * handler 的**自述事实**(G-720):这次读取/输出相对源内容截到哪了、按哪档策略。
   * 只有两枚字节数与策略,没有 `truncated` 结论位 —— 结论不由被截的那一方宣布。
   * 本字段在结果离开执行器边界时**被移除**(见 `normalizeToolResultTruncation`),
   * 所以下游没有读到它的机会,也就没有"半条账被当成结论读"的形态。
   */
  truncationFacts?: ToolResultTruncationFacts;
  /**
   * 「被截断」的类型化账目(G-720),**只由执行器边界产出**:
   * `executeWithinExecBudget` 把 handler 事实推导成它,`applyToolResultBudget` 产出/归并自己施加的裁剪。
   * 缺席 = 这条结果没有可证的截断;不得由渲染侧从散文里猜(与 `terminalState`/`interrupted` 同一条纪律)。
   * 三条口径见 `packages/types/src/tool-contract.ts` 的 `ToolResultTruncationRecord`。
   */
  truncation?: ToolResultTruncationRecord;
  /**
   * 「给人看的」有界投影(G-816039 三投影拆分)。三投影各自有界且互不代替:
   * 给模型的 = `output`(字节语义一字不动);落库账目 = `truncation`(四数);
   * 给人看的 = 本字段 —— **只在结果被预算裁剪时产出**(未裁剪时三投影本就同文,不造重复载荷)。
   * 它保存被 `output` 裁掉的那一段(受自身上限 `TOOL_RESULT_DISPLAY_LIMIT_BYTES` 管),
   * 超限置 `truncated` 并按上限截断 —— 全文不得借 display 之名整块进 metadata。
   * display 不是 output 的替代品:把喂模型的换成 display 正是上游注释点名要避免的方向。
   */
  display?: ToolResultDisplay;
}

/** display 投影的自身上限(对齐上游 result-display 的"独立于 provider content 单独限长"):200 KiB。 */
export const TOOL_RESULT_DISPLAY_LIMIT_BYTES = 200 * 1024;

/**
 * 「无活动空闲超时」的错误 context(G-426)。三枚数字 + 两枚标记,全部由执行器边界在
 * 触发那一刻测算后写死进结果(不是渲染侧现算 —— 那会迟到):
 *   - `idleMs`:距最后一次 `reportExecActivity` 的毫秒数;从未报告过 ⇒ 全程时长(与旧墙钟同语义)。
 *   - `totalMs`:从执行开始到触发瞬间的总时长。
 *   - `absoluteCapMs`:绝对上限 = budget × `TOOL_EXEC_BUDGET_ABSOLUTE_FACTOR`(防无限续命的兜底)。
 *   - `recoverable: true`:调用方已脱身、系统完好,可以继续(例如收窄任务重新派发)。
 *   - `retryable: false`:**自动**重试等于把同一次挂死再跑一遍(与 `abortedByExecBudget`
 *     阻断 executeWithRetry 重试的既有纪律同一条理由,见上文字段注)。
 */
export interface ToolExecTimeoutContext {
  idleMs: number;
  totalMs: number;
  absoluteCapMs: number;
  recoverable: boolean;
  retryable: boolean;
}

/**
 * display 投影的形状(G-816039):`text` 是有界的人读视图;三枚数字与 `truncated` 结论位
 * 与上游 tool-part-metadata 存的 serialization 四数(truncated/originalBytes/returnedBytes/
 * budgetStrategy)同形 —— 一次裁剪的两本账(`truncation` 管模型侧、本记录管 display 侧)各自成立。
 */
export interface ToolResultDisplay {
  text: string;
  /** display 自身被截断的结论位(只置 true,不写 false 噪音 —— 与 `truncation.truncated` 同一口径) */
  truncated?: true;
  originalBytes: number;
  returnedBytes: number;
  budgetStrategy: 'truncate';
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
  /**
   * 注册归属(2026-09-28 拍板,治"MCP 同名互相静默顶掉"):
   * 内建省略即视为 `'builtin'`,MCP 工具写成 `mcp:<serverName>`。
   * 注册表按它判冲突 —— 跨归属同名一律拒绝后到者并报名,同归属重连刷新允许覆盖
   * (否则 MCP 重连会留下一条指向已死连接的旧工具,那比原来的静默顶掉更糟)。
   */
  registrationOwner?: string;
  /**
   * 工具改名前的旧名(改名安全:allow/deny 需**新旧两名并查**)。
   *
   * 立因:MCP 工具从裸名 `web_search` 改为两轴名 `mcp__<server>__web_search` 后,
   * 用户升级前保存的 `--disallowed-tools web_search` 记的是**旧名** —— 权限判定若只查
   * 新名,那条黑名单会**静默失效并放行**(与上游 "改名时新旧两名并查 allow/deny" 同型)。
   * 内建工具无改名历史,省略。
   */
  nameAliases?: string[];
  /**
   * 逐工具 strict 声明位(G-464:provider 约束解码**资格**,不是命令)。
   * 语义对齐上游 contracts/tools/contract.ts:174-180:声明了也只是"有资格走 provider 的
   * 结构化/约束解码";是否真带 strict 下发由 adapter 按 provider/model 决定,strict 面
   * 表达不了的关键字(值约束一类)由消费方折进 description 后剥离。
   * 唯一消费方:`toolsToProviderSchema()`(与本位**同笔**引入 —— 有声明零消费者是守门 121
   * 禁的型)。收窄位置:全局资格开关 `useNativeTools`(commands/agent)之上的**逐工具**收窄,
   * 全局没开原生 tools 时本位无效果;开了也只影响显式声明的这一枚。
   * 缺省(省略)= 现状逐字不变。
   */
  strictSchema?: boolean;
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

/**
 * 绝对上限倍数(G-426):预算改成"每次活动重排"后,必须留一个**从开始计时的总上限**兜底,
 * 否则一个持续 reportActivity 的死循环能无限续命。取预算 3 倍而不是独立常量:各工具的
 * 声明档差异极大(默认 30min / 子代理 60min / 测试毫秒档),相对倍数让"多长的执行算滥用"
 * 与该工具自己声明的合理时长同比例缩放 —— 3 = 名义预算之外再给两整段同额推进余量,
 * 足以容纳合法的慢长任务,又把无限续命封死在 3 × budget。
 */
export const TOOL_EXEC_BUDGET_ABSOLUTE_FACTOR = 3;

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
  timeoutFacts?: { idleMs: number; totalMs: number; absoluteCapMs: number },
): ToolResult {
  if (kind === 'budget') {
    const limitLabel = budgetMs === undefined ? 'not-configured' : `${budgetMs}ms`;
    // G-426:idle/total 只在触发那一刻测算(调用方传入),让错误自己说明"杀的是空闲不是墙钟进度"。
    const idleLabel = timeoutFacts
      ? ` No activity for the last ${timeoutFacts.idleMs}ms (total ${timeoutFacts.totalMs}ms, absolute cap ${timeoutFacts.absoluteCapMs}ms).`
      : '';
    return {
      success: false,
      output: '',
      error:
        `Tool ${toolName} exceeded its execution budget (${limitLabel}) and was aborted.` +
        `${idleLabel} Side effects MAY already have happened - abort only releases the caller, ` +
        `the handler may still be running in background. Verify on-disk / remote state before retrying.`,
      errorType: 'timeout',
      abortedByExecBudget: 'budget',
      ...(timeoutFacts
        ? {
            timeoutContext: {
              idleMs: timeoutFacts.idleMs,
              totalMs: timeoutFacts.totalMs,
              absoluteCapMs: timeoutFacts.absoluteCapMs,
              recoverable: true,
              retryable: false,
            },
          }
        : {}),
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
 * 「被截断」账目的**唯一推导点**(G-720):把 handler 自述的 `truncationFacts` 换成结论字段
 * `truncation`,并把事实字段摘干净(结果离开本边界后不该再带着半条账)。
 *
 * 为什么推导住在这里而不是让 handler 自己写 `truncated`:那枚布尔是**结论**,而结论只能由
 * 两条字节数的大小关系得出 —— 由被截的那一方宣布,谎报与漏报在账面同形且无从复核。
 *
 * 三条不变量(各有测试钉住):
 *  1. 没有 `truncationFacts` ⇒ **返回同一对象引用**(零回归;既有"逐字节原样返回"的承诺不被动);
 *  2. 事实算不出这笔账(字节数非法 / 自相矛盾 / 策略不在值域)⇒ 只摘掉事实字段,**不产任何断言**;
 *  3. 算得出 ⇒ `truncated` 仅当 `returnedBytes < originalBytes` 时为 `true`,未截时该键**整块缺席**
 *     (绝不写 `false` 噪音)。
 */
export function normalizeToolResultTruncation(result: ToolResult): ToolResult {
  if (result.truncationFacts === undefined) return result;
  const stripped: ToolResult = { ...result };
  delete stripped.truncationFacts;
  const record = buildToolResultTruncationRecord(result.truncationFacts);
  return record ? { ...stripped, truncation: record } : stripped;
}

/**
 * 工具执行的**唯一**墙钟/取消应用点。
 *
 * @param tool 只需 name + execBudget(hub 路径拿不到本地 Tool 对象,按默认档走)
 * @param ctx  工具上下文,`ctx.signal` 是外层取消的来源
 * @param run  真正的执行体;收到的 signal 是"父取消 ∪ 预算到点"的合成信号,可能为 undefined;
 *        第二形参 `reportActivity` 是本执行窗的活动上报口(G-426),非空时调用即把空闲窗
 *        重排回完整 budget(没有工具调用它时行为与旧墙钟逐字同形)
 *
 * 覆盖面如实登记:只包 handler 本身。`confirmDangerous` 的等待发生在 `executeToolCall` 里、
 * 本函数之外 ⇒ 用户思考时间不计入预算(这是对的,否则"用户还没点确认"会被系统判成工具超时)。
 *
 * G-426 语义(对齐上游 subagent/runner 的 reportActivity):预算定时器从"单次墙钟"改为
 * "每次活动重排" —— 仍在推进的慢 handler(典型:子代理 loop)不再被杀,真正卡死的才会超时;
 * 另设**从开始计时的绝对上限** budget × TOOL_EXEC_BUDGET_ABSOLUTE_FACTOR 兜底,防无限续命。
 * 从未上报活动的执行与改前完全同形(单次 setTimeout 到点即杀)。
 */
export async function executeWithinExecBudget(
  tool: Pick<Tool, 'name' | 'execBudget'>,
  ctx: ToolContext,
  run: (signal: AbortSignal | undefined, reportActivity?: () => void) => Promise<ToolResult>,
): Promise<ToolResult> {
  const parentSignal = ctx.signal;
  if (parentSignal?.aborted) {
    // 提前拒绝:取消已经发生 ⇒ 一次 handler 都不该调
    return execBudgetResult(tool.name, 'cancelled', undefined);
  }
  const budgetMs = resolveToolExecBudgetMs(tool);
  if (budgetMs === undefined && !parentSignal) {
    // 零回归路径:结构性豁免且无外层信号 ⇒ 与改前逐字同形(不建 controller、不建 timer)。
    // 截断账目仍要推导 —— 但 normalize 在无事实时返回**同一对象引用**,所以"原样返回"没有被削弱。
    return normalizeToolResultTruncation(await run(undefined));
  }

  const controller = new AbortController();
  const unlinkParent = linkAbortSignal(parentSignal, controller);
  let budgetTimer: NodeJS.Timeout | undefined;
  let absoluteTimer: NodeJS.Timeout | undefined;
  let graceTimer: NodeJS.Timeout | undefined;
  let trigger: 'budget' | 'cancelled' | undefined;
  // G-426:活动基线。undefined = 从未上报活动 ⇒ 触发时 idleMs 退化为全程时长(旧墙钟语义)。
  let lastActivityAt: number | undefined;
  const startedAt = Date.now();

  try {
    return await new Promise<ToolResult>((resolve, reject) => {
      let settled = false;
      const settle = (r: ToolResult): void => {
        if (settled) return;
        settled = true;
        // 结算口 = 截断账目的推导口(G-720):handler 事实与边界代偿结果都只从这里出去,
        // 所以"离开本边界的结果一律不带半条账"这一条只有一个落点,不必在每条分支各写一遍。
        resolve(normalizeToolResultTruncation(r));
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
        // G-426:idle/total 在触发瞬间定格,随宽限后的代结算结果一起出去
        const at = Date.now();
        const timeoutFacts =
          kind === 'budget' && budgetMs !== undefined
            ? {
                idleMs: lastActivityAt === undefined ? at - startedAt : at - lastActivityAt,
                totalMs: at - startedAt,
                absoluteCapMs: budgetMs * TOOL_EXEC_BUDGET_ABSOLUTE_FACTOR,
              }
            : undefined;
        controller.abort(new Error(`ihui:exec-${kind}:${tool.name}`));
        graceTimer = setTimeout(
          () => settle(execBudgetResult(tool.name, kind, budgetMs, timeoutFacts)),
          TOOL_EXEC_BUDGET_SETTLE_GRACE_MS,
        );
      };
      // G-426:活动上报口 —— 每次真实推进(工具调用进度/流式输出)都把空闲窗重排回完整 budget。
      // trigger/settle 已落定后的一律忽略:宽限期与结算后不存在"续命"。
      const reportActivity =
        budgetMs === undefined
          ? undefined
          : (): void => {
              if (trigger !== undefined || settled) return;
              lastActivityAt = Date.now();
              if (budgetTimer !== undefined) clearTimeout(budgetTimer);
              budgetTimer = setTimeout(() => enterGrace('budget'), budgetMs);
            };
      if (budgetMs !== undefined) {
        budgetTimer = setTimeout(() => enterGrace('budget'), budgetMs);
        // 绝对上限:从开始计时,不随活动重排 —— 持续活动的执行最多活 budget × FACTOR。
        absoluteTimer = setTimeout(
          () => enterGrace('budget'),
          budgetMs * TOOL_EXEC_BUDGET_ABSOLUTE_FACTOR,
        );
      }
      // 父取消经 linkAbortSignal 到达本 controller;预算到点也会 abort 本 controller,
      // 但那时 trigger 已被置为 'budget',所以不会二次产出一条"已取消"(归因分叉是这条的坏状态)。
      controller.signal.addEventListener('abort', () => enterGrace('cancelled'), { once: true });
      // 用 async IIFE 包一层:handler **同步抛错**也必须走同一条结算路径,否则 timer 与
      // 父 signal 上的监听器都留在那儿(本函数是 async,同步抛错会直接冒泡,finally 拿不到机会)。
      void (async () => run(controller.signal, reportActivity))().then(settle, settleReject);
    });
  } finally {
    if (budgetTimer) clearTimeout(budgetTimer);
    if (absoluteTimer) clearTimeout(absoluteTimer);
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
  /**
   * 本执行窗的活动上报口(G-426,由 `executeWithinExecBudget` 注入):长跑 handler(典型:
   * 子代理 loop)每有一段真实推进 —— 工具调用开始/结束、流式输出块 —— 就调用一次,
   * 把"无活动空闲超时"的定时器重排回完整预算。仍在推进的慢子代理不再被墙钟杀,
   * 真正卡死的才会超时;从未调用 ⇒ 行为与旧墙钟逐字同形。
   * 缺席(undefined)= 当前执行窗没有可重排的定时器(结构性豁免 / 无预算),调用方
   * 用可选链调用即可,不得假设它总在。
   */
  reportExecActivity?: () => void;
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

/**
 * 跨归属的同名注册被拒的清单(每条形如 "工具名冲突 …")。
 * 状态面/自检可取用;不做"只 warn 完事"—— 静默覆盖的表现不是报错,而是**结果悄悄来自另一台服务器**。
 */
const registrationConflicts: string[] = [];

function ownerOf(tool: Tool): string {
  return tool.registrationOwner ?? 'builtin';
}

function registerTool(tool: Tool): void {
  const existing = registry.get(tool.name);
  const owner = ownerOf(tool);
  if (existing && ownerOf(existing) !== owner) {
    const line =
      `工具名冲突:'${tool.name}' 已由 ${ownerOf(existing)} 注册 ⇒ 拒收 ${owner} 的同名工具` +
      `(保留先到者。**不做静默覆盖** —— 覆盖会让调用悄悄跑到另一台服务器,` +
      `而 --disallowed-tools 也没法按服务器表达)。请给其中一台的工具改名,或移除重复配置。`;
    registrationConflicts.push(line);
    console.error(`[tools] ${line}`);
    return;
  }
  // 同归属 = 同一台服务器重连后刷新:必须允许覆盖,否则旧对象会一直挂在表上
  registry.set(tool.name, tool);
}

/** 已登记的注册冲突(只读副本)。 */
export function getToolRegistrationConflicts(): string[] {
  return [...registrationConflicts];
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

/**
 * 强制规划段的正文(宿主指令原文)。单独成常量,是为了让下面的 `injectHostSection` 调用
 * 与 id **落在同一行** —— 守门 128 的 R1 按行配对判"这一行真走了出口"。
 */
const PLAN_FIRST_DIRECTIVE = `## 任务规划(必须先规划后执行)

在执行任何工具调用前,你必须先输出一个任务规划块:

\`\`\`plan
1. <步骤1描述>
2. <步骤2描述>
3. <步骤N描述>
\`\`\`

规划完成后再逐步执行工具调用。每完成一步,简要说明进度并继续下一步。若规划需调整,先输出新的 plan 块再继续。`;

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

  // 强制规划段是**宿主自己下的指令**(区别于同函数里被转述的 extraContext),
  // 但它同样进模型消息 ⇒ 必须走登记出口(host_directive 档 = 过 neutralizeBoundaries)。
  // planFirst 未开启时**一律不记账**:那是"本轮没到档位"而不是"降级",
  // 记成 skipped 会让可见行每轮多一行假噪声(上一票刚回退过同一型)。
  // 出口调用与 id 必须**同一行**:守门 128 的 R1 按行配对判"这一行真走了出口",
  // 把出口写在上一行、id 孤零零占一行 = 登记了没人生产(字符串内的 `${}` 调用同样不算)。
  const planFirstDirective = planFirst
    ? injectHostSection('directive_plan_first', PLAN_FIRST_DIRECTIVE, { kind: 'host_directive' })
    : '';
  const planSection = planFirstDirective ? `\n\n${planFirstDirective}` : '';

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

// ==================== ToolResultBudgetContract 消费(H-5,2026-09-26)====================
//
// packages/types/src/tool-contract.ts 第三节的 resultBudget 此前全仓零消费者(scripts 的
// CONTRACT_GROUPS 只做声明校验)。唯一合理消费点是本文件的 executor 边界 —— executeToolCall
// 本地路径收口处,即 handler 产出与"回灌模型上下文"之间。语义严格按契约字段注释执行:
//   - inlineLimitBytes:内联展示阈值,超过即按 policy 处置(policy='inline' = 声明方接受大结果完整内联);
//   - providerVisibleLimitBytes:回灌模型上下文的硬上限,**独立于内联展示** —— 任何 policy 下
//     最终内容都不得越过;声明不自洽(preview.bytes 更大)时硬上限赢;
//   - preview:裁剪预览形状,bytes 与 lines 是两个同时生效的上限,from 定保留侧;
//   - 'artifact' 档本仓暂无 artifact 存储承接设施,降级为 truncate 预览并在标注注明 fallback
//     (不臆造 artifact 语义,也不静默放行超限内容;存储设施落地属后续票)。
// 契约缺席(contract?.resultBudget 为 undefined)⇒ 逐字节原样返回:ToolContractMount 的可选挂载
// 是 A13 第一阶段的刻意设计(翻缺省属行为变更,须单独一票),本票只消费显式声明,不触碰
// 无契约工具的既有行为。
// 标注文案用 ASCII:消费方是模型而非终端用户界面,且本文件受守门 70 的硬编码中文基线棘轮约束
// (同款理由见上方 execBudgetResult 注释)。

/** 按 UTF-8 字节上限裁剪,from 定保留侧;切破的多字节序列由 Buffer.toString 归为 U+FFFD。 */
function clipByBytes(text: string, maxBytes: number, from: 'head' | 'tail'): string {
  const buf = Buffer.from(text, 'utf8');
  if (buf.length <= maxBytes) return text;
  const clipped =
    from === 'head' ? buf.subarray(0, maxBytes) : buf.subarray(buf.length - maxBytes);
  return clipped.toString('utf8');
}

/** 按 preview 形状裁剪:行数与字节数两个上限同时生效(取交集),from 决定保留头还是尾。 */
function clipByPreview(output: string, preview: ToolResultBudgetContract['preview']): string {
  const lines = output.split('\n');
  let kept = lines;
  if (kept.length > preview.lines) {
    kept =
      preview.from === 'head'
        ? kept.slice(0, preview.lines)
        : kept.slice(kept.length - preview.lines);
  }
  let text = kept.join('\n');
  if (Buffer.byteLength(text, 'utf8') > preview.bytes) {
    text = clipByBytes(text, preview.bytes, preview.from);
  }
  return text;
}

/**
 * 按一份 `ToolResultBudgetContract` 处置单条工具结果(纯函数)。
 *
 * 两道闸:
 *   ① output 超过 `inlineLimitBytes` 且 policy 非 'inline' ⇒ 按 preview 裁剪('artifact' 降级同型);
 *   ② 最终内容仍超过 `providerVisibleLimitBytes` ⇒ 再按 preview 形状裁到硬上限内。
 * 裁剪发生时在 output **头部**拼标注 —— 让模型第一眼就知道看到的是部分视图,不会把截断内容
 * 当成完整事实。error 字段不裁(契约字段均围绕 output 语义,不臆造 error 的预算语义)。
 */
export function applyToolResultBudget(
  result: ToolResult,
  budget: ToolResultBudgetContract,
): ToolResult {
  const original = result.output;
  if (original === '') return result;
  const totalBytes = Buffer.byteLength(original, 'utf8');

  let text = original;
  let policyNote: string = budget.policy;
  let truncated = false;

  if (totalBytes > budget.inlineLimitBytes && budget.policy !== 'inline') {
    text = clipByPreview(original, budget.preview);
    truncated = true;
    if (budget.policy === 'artifact') {
      policyNote = 'artifact (no artifact storage wired; truncate fallback)';
    }
  }

  if (Buffer.byteLength(text, 'utf8') > budget.providerVisibleLimitBytes) {
    text = clipByBytes(
      text,
      Math.min(budget.preview.bytes, budget.providerVisibleLimitBytes),
      budget.preview.from,
    );
    truncated = true;
  }

  if (!truncated) return result;
  const keptBytes = Buffer.byteLength(text, 'utf8');
  const note =
    `[tool-result-budget] output truncated: original ${totalBytes} bytes, showing ${keptBytes} bytes ` +
    `(policy: ${policyNote}, preview from ${budget.preview.from}). ` +
    `This is a partial view, not the complete tool output.`;
  // G-720:同一次裁剪的两个量落成可判字段。散文注记**原样保留** —— 它对模型仍是第一眼的事实,
  // 且 `tool-result-budget-contract-wiring.test.ts` 把它当契约钉着(动它属改别人的验收面)。
  // 记的是**实际施加**的策略:本仓 artifact 存储未接线 ⇒ 声明 artifact 时运行期降级为裁剪,
  // 那一笔就记 'truncate'(记 artifact 等于声称产出了一个并不存在的文件)。
  // 若 handler 侧已有一笔账(read_file 字节闸就是),两枚源字节取较大者归并 —— 本次的 output 尺寸
  // 不得把"文件本来多大"改小;回传字节取本次裁剪后的值。一次结果只留一枚可判事实。
  const account = buildToolResultTruncationRecord({
    originalBytes: Math.max(result.truncation?.originalBytes ?? totalBytes, totalBytes),
    returnedBytes: keptBytes,
    budgetStrategy: 'truncate',
  });
  // G-816039:display 投影的唯一生产点。保存的是**被 output 裁掉的那一段**(受自身上限管,
  // 不吃 resultBudget),`output` 的拼装一字未动 —— 给模型的字节语义与引入前逐字节同形。
  const displayText = clipByBytes(original, TOOL_RESULT_DISPLAY_LIMIT_BYTES, 'head');
  const displayReturned = Buffer.byteLength(displayText, 'utf8');
  const display: ToolResultDisplay = {
    text: displayText,
    originalBytes: totalBytes,
    returnedBytes: displayReturned,
    budgetStrategy: 'truncate',
    ...(displayReturned < totalBytes ? { truncated: true as const } : {}),
  };
  const next: ToolResult = { ...result, output: `${note}\n${text}`, display };
  return account ? { ...next, truncation: account } : next;
}

/**
 * executor 边界的**唯一**预算应用点(H-5 接线位):契约在位才消费,缺席逐字节原样返回。
 * 唯一调用点 = `executeToolCall` 本地路径收口;hub 分支拿不到本地 Tool 对象,与
 * `shadowValidateToolArguments` 的已知覆盖面缺口同型,本票不扩面。
 */
export function withToolResultBudget(tool: Tool, result: ToolResult): ToolResult {
  const budget = tool.contract?.resultBudget;
  return budget ? applyToolResultBudget(result, budget) : result;
}

// ==================== 批准闸:要不要问人(唯一实现)====================
//
// 立票理由(2026-09-28,实测):
//  ① `packages/types/src/tool-contract.ts:202` 声明了 `alwaysAsk?: boolean`,但 apps/ 与
//     packages/ 的 src 面**零消费者**(只有 dist 产物里有它)—— 那张"无论多宽松都必须问"的
//     支票一直是空的,而账面读起来像已实现(§22c"造好没装车"同族)。
//  ② 第三方 MCP 工具的批准判定是**单轴**:`mcpToolToTool` 从不写 dangerLevel,
//     而本文件的确认分支只认 `dangerLevel === 'dangerous'`(HEAD 面那行原文:
//     `if (tool.dangerLevel === 'dangerous' || leaseContentDrifted)`,见本票 diff 的删除列)
//     ⇒ 每一个 MCP 工具都走"免批"。

/** 契约上是否**显式**标了 `alwaysAsk: true`(只认字面量 true;缺席/false 一律不算)。 */
function isAlwaysAskDeclared(tool: Tool): boolean {
  return tool.contract?.permission.alwaysAsk === true;
}

/**
 * 免批两轴是否**同时成立**(轴 A 只读 ∧ 轴 B 不碰外部世界)。
 *
 * 两轴各自为假就是不同的事:前者"只读但出网"、后者"不出网但会写",任一成立都必须问。
 * 整对缺席 ⇒ 本判据不适用(返回 false 表示"没有免批资格可谈"),内建工具行为逐字不变。
 */
function hasApprovalExemption(tool: Tool): boolean {
  const axes = tool.approvalExemption;
  if (!axes) return false;
  return axes.readonlyAxis === true && axes.closedWorldAxis === true;
}

/** 该工具是否**声明过**免批两轴(声明过却没同时成立 = 要问;没声明 = 本条不参与判定)。 */
function declaresApprovalExemption(tool: Tool): boolean {
  return tool.approvalExemption !== undefined;
}

/**
 * 批准闸"必须问人"的**唯一实现**(2026-09-28 起,四条判据,任一成立即问):
 *
 *  ① `dangerLevel === 'dangerous'` —— 既有档,语义一字未动;
 *  ② 租约槽位摘要漂移(`leaseContentDrifted`)—— 既有档,语义一字未动;
 *  ③ 契约上**显式** `alwaysAsk: true`(此前零消费者 ⇒ 本票把它接上)。
 *     **只对显式标记生效**:未标记的工具不会因本条新增"要批准",任何缺省语义
 *     (`dangerLevel ?? 'write'`、"契约缺席按只读"等)都未被触碰;
 *  ④ 第三方工具声明了免批两轴(`approvalExemption`)而两轴没同时成立。
 *     两轴是契约上的**两个独立字段**(`ApprovalExemptionAxes`),不是一个布尔、
 *     也不是 `dangerLevel === 'read'` 一档冒充两件事。
 *
 * 静态拒绝优先(规格 = `tool-contract.ts:200` 那句"绝不覆盖拒绝分支"):本函数**只**在
 * `executeToolCall` 里权限规则已经放行之后才被调用,规则 deny 那条路径在此之前就 return,
 * 所以"被 deny 的调用因 alwaysAsk 变成问一次再放行"在结构上不可能发生(由测试②钉住)。
 */
export function requiresUserConfirmation(tool: Tool, leaseContentDrifted = false): boolean {
  if (tool.dangerLevel === 'dangerous') return true;
  if (leaseContentDrifted) return true;
  if (isAlwaysAskDeclared(tool)) return true;
  if (declaresApprovalExemption(tool) && !hasApprovalExemption(tool)) return true;
  return false;
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
      // G-426:活动上报口随 ctx 下发,长跑远端工具同样能重排空闲窗(与本地分支同一语义)。
      return await executeWithinExecBudget({ name: call.name }, ctx, (signal, reportActivity) =>
        resolver.dispatch(call.name, call.arguments, {
          ...ctx,
          ...(signal ? { signal } : {}),
          ...(reportActivity ? { reportExecActivity: reportActivity } : {}),
        }),
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
  // A31 第①步「影子校验」/ A36 第③步「enforce」。默认 shadow(L22150 装车):校验器
  // 真跑、只记账;显式 off ⇒ 整个分支等价于不存在(行为与改前逐字相同)。
  //   shadow:跑校验、只进遥测计数器,不改 call.arguments、不改返回值、不拦调用;
  //   enforce:先过 schema-aware 容错解析(原值即过则一次都不 re-parse),违规即拒 ——
  //     错误里带**单行**违规清单供模型修复;拒绝发生在权限/批准弹窗与限流**之前**
  //     (一条参数就不合法的调用没有可批准的事,也不该消耗限流配额);
  //     容错解析通过时**只有**这一档会替换 call.arguments(归一树,原键全保留)。
  // 与 doom-loop 检测共存:repair 不是执行器内的第二次自动重试 —— 拒绝直接 return
  // (不经 executeWithRetry;`isRetryableErrorType` 也不认 invalid_arguments*),
  // 模型是否再投由下一轮决定;而按工具名计的**连续**拒绝窗把回喂封顶在
  // TOOL_ARG_REPAIR_MAX_ATTEMPTS 次,超限硬失败并保留最后一次违规清单 ⇒ 换写法也顶得出。
  // 已知覆盖面缺口:hubEnabled 分支在 getTool 之前就 return 了,那里拿不到 Tool 对象,
  // 影子与 enforce 都不生效,本票不扩面。
  // 拒绝文案用 ASCII(守门 70 的硬编码中文基线棘轮同样约束本文件,见上方预算标注注记)。
  const toolArgMode = resolveToolArgValidationMode();
  if (toolArgMode === 'enforce') {
    const decision = enforceValidateToolArguments(tool, call.arguments);
    if (decision.status === 'reject') {
      const repair = noteEnforceRepairRejection(tool.name);
      const violations = formatValidationErrorsLine(decision.errors);
      return {
        success: false,
        output: '',
        error: repair.exhausted
          ? `arg_validation_exhausted: rejection #${repair.attempt} exceeds the ${repair.max}-attempt repair window; do not re-issue this call without new information. last violations -> ${violations}`
          : `arg_validation_failed (${repair.attempt}/${repair.max}): fix these fields and retry. violations -> ${violations}`,
        errorType: repair.exhausted ? 'invalid_arguments_exhausted' : 'invalid_arguments',
      };
    }
    if (decision.status === 'pass-normalized') {
      call.arguments = decision.args;
    }
    // pass / undetermined(校验器抛异常,fail-open 已记 validatorThrew)→ 原路径继续。
  } else {
    // 刻意放在**批准弹窗之前** —— 弹窗与"批准 = 执行"的同一引用传递链路(上一票实测出的
    // 语义)在此完全不受影响。
    shadowValidateToolArguments(tool, call.arguments);
  }
  // P0-7 Permission rules:白名单/黑名单拦截(在 rate limit 之前,避免被限流工具仍消耗配额)
  // 权限租约(默认关闭):`activePermissionLease()` 为 null 时走的仍是改造前那一份
  // `checkPermission` 调用,行为逐字不变;有租约时也**只**可能把 rules 里的 'ask'
  // 放宽成放行 —— 'deny'(黑名单/不在白名单)与下方 `dangerous` 确认闸都不受影响。
  let leaseContentDrifted = false;
  if (ctx.permissions) {
    const lease = activePermissionLease();
    // `dangerLevel ?? 'write'`:该参数只被用来拒绝"把 dangerous 放宽",undefined 在本函数的
    // 既有语义里等同非危险(下方确认闸判的是 `=== 'dangerous'`),取 write 档是保守写法。
    const perm = lease
      ? checkRulesWithLease(
          call.name,
          ctx.permissions,
          tool.dangerLevel ?? 'write',
          lease,
          JSON.stringify(call.arguments ?? null),
          tool.nameAliases,
        )
      : checkPermission(call.name, ctx.permissions, tool.nameAliases);
    if (!perm.allowed) {
      // 可诊断化收口:原错误串逐字保留(既有回归以 `toContain` 断言它),其后追加 ASCII 出路行;
      // 三问(哪道闸/出路/参数摘要)以结构化字段在返回体可断言。判定本身一个字节都没动。
      const denial = buildToolDenial({
        gate: 'permission-rule',
        decider: 'rule-deny',
        tool: call.name,
        args: call.arguments,
      });
      auditToolDenial(denial);
      const ruleMsg = perm.reason ?? `工具 ${call.name} 被权限规则拒绝`;
      return {
        success: false,
        output: '',
        error: `${ruleMsg}\n${denialErrorSuffix(denial)}`,
        errorType: 'permission_denied',
        denial,
      };
    }
    // 执行点必须把内容喂进判定,并且**必须消费漂移结论**:
    // `checkRulesWithLease` 在摘要不符时返回 `allowed:true + requiresApproval:true`,
    // 而本函数原先只看 `!perm.allowed` ⇒ 整套槽位指纹在运行时是死代码(造好没装车)。
    leaseContentDrifted = 'approvalState' in perm && perm.approvalState === 'content-drifted';
  }
  // P1-4 Rate limiting:同一工具 10 秒内最多 5 次,超限返回 error
  const rateLimit = checkRateLimit(call.name);
  if (!rateLimit.allowed) {
    return { success: false, output: '', error: rateLimit.reason, errorType: 'rate_limited' };
  }
  // 批准闸:四条"必须问"的判据集中在 `requiresUserConfirmation()` 一处(唯一实现,不在这里再抄一遍)。
  // 走到这一行时权限规则**已经放行**(上面 deny 已 return),所以 alwaysAsk 结构上
  // 不可能把一次静态拒绝变成"问一次再放行" —— 那条规格写在 tool-contract.ts:200。
  //
  // G-916424 批准闸旁路:确认窗先交 permissionRequest 钩子应答(四形状 deny/allow/ask/modify)。
  // 无 permissionRequest 钩子 / 钩子失败 / 应答残缺 ⇒ permission 缺省,下方每一格与改前逐字同形。
  let hookApproved = false;
  if (requiresUserConfirmation(tool, leaseContentDrifted)) {
    const hookRes = await runPermissionRequest(tool.name, call.arguments);
    if (!hookRes.proceed) {
      // 仅当用户显式配了 blockOnError 且钩子链失败才走到这:与 preToolCall 阻断同向。
      // 失败不猜成任何应答形状(三态不混流),审计面不伪造 denial 行。
      return {
        success: false,
        output: '',
        error: `permissionRequest 钩子执行失败，本次调用被阻断: ${hookRes.reason ?? '未取到结果'}`,
        errorType: 'permission_denied',
      };
    }
    if (hookRes.permission === 'deny') {
      // deny 是输出协议(钩子明确说"不"),与钩子失败严格分流;tool-denial 的 decider
      // 闭集没有"钩子拒绝"这一档(该文件不在本票射程),故不伪造审计行,事实进错误串。
      return {
        success: false,
        output: '',
        error: `钩子 "${hookRes.permissionSource ?? '-'}" 拒绝了本次调用${hookRes.reason ? `: ${hookRes.reason}` : ''}`,
        errorType: 'permission_denied',
      };
    }
    if (hookRes.permission === 'modify' && hookRes.modifiedInput !== undefined) {
      const modified = hookRes.modifiedInput;
      // ① 二次 schema 校验(上游 :423-428 同型):失败 ⇒ 不执行,错误带 hook 上下文
      //   (钩子名 + 违规清单),模型看到的是"钩子改坏了"而不是裸 schema error。
      let recheck: ReturnType<typeof validateToolArguments> | undefined;
      try {
        recheck = validateToolArguments(modified, resolveSchemaOrThrow(tool));
      } catch {
        // schema 缺席/畸形:与首过 shadow 校验的 fail-open 同向(不因钩子改写引入第二套
        // 缺席语义),原路径继续 —— 语义是"无从校验",不是"校验通过"。
        recheck = undefined;
      }
      if (recheck && !recheck.valid) {
        return {
          success: false,
          output: '',
          error: `钩子 "${hookRes.permissionSource ?? '-'}" 改写后的输入未通过参数校验，本次调用不执行。violations -> ${formatValidationErrorsLine(recheck.errors)}`,
          errorType: 'invalid_arguments',
        };
      }
      // ② 改后必须按改后内容重判权限(上游 permission-flow.ts:249 原话"修改后的输入不能沿用
      //    修改前的权限结果")。规则面用改后内容重跑;租约槽位摘要按 invocationContent 绑定 ⇒
      //    改后内容与旧批准摘要不符自动落 content-drifted —— 反向锁在我方的结构落点。
      let driftedAfterModify = false;
      if (ctx.permissions) {
        const lease = activePermissionLease();
        const perm2 = lease
          ? checkRulesWithLease(
              call.name,
              ctx.permissions,
              tool.dangerLevel ?? 'write',
              lease,
              JSON.stringify(modified ?? null),
              tool.nameAliases,
            )
          : checkPermission(call.name, ctx.permissions, tool.nameAliases);
        if (!perm2.allowed) {
          // 规则拒绝是真实"说不":gate/decider 与首过同形,审计行如实可记。
          const denial = buildToolDenial({
            gate: 'permission-rule',
            decider: 'rule-deny',
            tool: call.name,
            args: modified,
          });
          auditToolDenial(denial);
          const ruleMsg = perm2.reason ?? `工具 ${call.name} 被权限规则拒绝`;
          return {
            success: false,
            output: '',
            error: `${ruleMsg}\n${denialErrorSuffix(denial)}`,
            errorType: 'permission_denied',
            denial,
          };
        }
        driftedAfterModify = 'approvalState' in perm2 && perm2.approvalState === 'content-drifted';
      }
      // ③ 待判格④(上游 permission-input-recheck.ts:71-83 对"重判得 ask 但非 project-rule"
      //    选择不回问/静默放行,其注释未声明是否故意):我方**禁止抄这一格的静默** ——
      //    重判后是否仍须人批,一律以 requiresUserConfirmation(工具契约 + 改后漂移面)为准:
      //    须批 ⇒ 回人工确认窗(人在窗里看到的就是改后输入),无确认渠道 ⇒ 拒,两个方向都不静默。
      call.arguments = recheck && recheck.coercedFields.length > 0 ? recheck.coerced : { ...modified };
      leaseContentDrifted = driftedAfterModify;
      // modify ≠ allow(反向锁):改写不改授权,是否还要窗由下方用改后状态重判决定。
    } else if (hookRes.permission === 'allow') {
      // 钩子替人应答确认窗(票意:"测试环境自动 allow")。放行仍走下方披露记账路径,可追溯。
      hookApproved = true;
    }
    // 'ask' / 无应答 ⇒ 落回原人工窗(下方,逐字不变)。
  }
  if (requiresUserConfirmation(tool, leaseContentDrifted)) {
    const allowed = hookApproved || (ctx.confirmDangerous ? await ctx.confirmDangerous(tool, call.arguments) : false);
    // 披露面(L7905 收口):只记账不改判定 —— 放行路径(会话级 flag / 回调自批)可追溯
    if (allowed) {
      noteDangerousApproval(ctx.allowDangerous === true, tool.name);
      // 批准这一刻的内容就是"人被问过并同意的那件事" —— 把它登记进租约的槽位指纹,
      // 之后同工具换内容旧批准自动失效(`content-drifted`)。档位未开 / 无生效租约 ⇒
      // 该出口内部自行拒收并给原因,**不抛、不改判定**,所以既有 `--permission-lease`
      // 使用者行为零变化(绑定要在授予时显式开 `digestTrackOnApproval`)。
      recordApprovedInvocation({
        toolName: tool.name,
        invocationContent: JSON.stringify(call.arguments ?? null),
        dangerLevel: tool.dangerLevel ?? 'write',
        workspaceId: leaseWorkspaceIdOf(ctx.workspacePath),
      });
    }
    if (!allowed) {
      const denial = buildToolDenial({
        // 两道闸同时命中时报更特异的一态:漂移是"批准过、内容变了"的单列待再审态,
        // 不得被读成"从未批准"(文案与 `gate` 字段同形,回归各钉一条)。
        gate: leaseContentDrifted ? 'lease-digest-drift' : 'dangerous-gate',
        // 层面边界(如实登记):工具层只看"有没有回调";danger-gate 内部"回调在但无
        // prompt"(no-prompt 成因)在这一层呈现为 user-declined,归因属调用方另计。
        decider: ctx.confirmDangerous ? 'user-declined' : 'no-confirmation-channel',
        tool: call.name,
        args: call.arguments,
      });
      auditToolDenial(denial);
      // 原中文错误串逐字保留(`lease-drift-executor-wiring` 以 toContain('摘要漂移') 断言),
      // 其后追加 ASCII 出路行;无确认出口时**仍然必须拒** —— 本票只改怎么说,不改是否放。
      return {
        success: false,
        output: '',
        error:
          (leaseContentDrifted
            ? `工具 ${call.name} 的本次参数与租约批准过的内容不符(摘要漂移)，旧批准失效，需重新确认`
            : `危险操作被拒绝(需用户确认): ${call.name}`) + `\n${denialErrorSuffix(denial)}`,
        errorType: 'permission_denied',
        denial,
      };
    }
  }
  // G-427 第①步(机主 2026-10-10 拍板「先影子记账一周再开真门控」):allowed-tools 的影子记账点。
  // 位置刻意在**所有既有闸门放行之后、真正执行之前** —— 记的是"这一趟真会跑"。已被权限规则 /
  // 限流 / 确认窗拒掉的调用不记:白名单真生效时它们同样被拒,记两遍等于把一件事算两次。
  // 返回值必须丢弃 —— 它不是任何判定的输入,拿它分支就是 enforce(本票明令禁止)。
  // 永不抛、永不改 args、不改返回值;hub 分支拿不到本地 Tool 对象,与上方
  // shadowValidateToolArguments 的已知覆盖面缺口同型,本票不扩面。
  observeShadowToolCall(tool.name);
  // P1-5 Error recovery:read 工具失败自动重试 1 次 + 100ms 退避;write/dangerous 不重试(避免副作用)
  const executed = await executeWithRetry(tool, call.arguments, ctx);
  // H-5:ToolResultBudgetContract 在 executor 边界消费 —— handler 产出回灌模型之前按声明预算
  // 裁剪/标注。契约缺席 ⇒ 原样返回(零行为变更);hub 分支拿不到本地 Tool 对象,与上方
  // shadowValidateToolArguments 的已知覆盖面缺口同型,本票不扩面。
  return withToolResultBudget(tool, executed);
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
      // G-426:活动上报口随 ctx 注入 —— handler 经 `ctx.reportExecActivity?.()` 报告真实推进,
      // 把本执行窗的空闲定时器重排回完整预算(长跑子代理不再被墙钟误杀)。
      const result = await executeWithinExecBudget(tool, ctx, (signal, reportActivity) =>
        tool.execute(args, {
          ...ctx,
          ...(signal ? { signal } : {}),
          ...(reportActivity ? { reportExecActivity: reportActivity } : {}),
        }),
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
        // G-710:抛出方给码(ToolError)⇒ 码直进 errorType,文本档只在该码缺席时兜底(下方 ?? 链)。
        ...(err instanceof ToolError ? { errorType: err.code } : {}),
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

/**
 * 错误分级词表(G-710 收口后与 `failure-classification.ts` 的失败码闭集对齐):
 * 六档既有档逐字保留;新增档(cancelled/driver/context_limit/client_error/parse)只来自
 * 抛出方显式给码(`ToolError`),文本兜底不会产出它们。
 */
export type ErrorType = FailureCode;

/**
 * G-710:classifyError 降级为**只在无码时兜底**的文本档 —— 判据字面量全部搬进
 * `failure-classification.ts` 的数据表(逐字未变),且每一次兜底使用都按站点计数报名
 * (站点 'tools/classifyError',台账见 `getFailureFallbackStats`)。
 * 有码路径不经本函数:handler 抛 `ToolError` ⇒ 码直进 errorType(见 executeWithRetry),
 * handler 自报 errorType ⇒ `??` 短路同样不经本函数。
 */
export function classifyError(error?: string | null): ErrorType {
  return classifyFailureText(error, 'tools/classifyError').code;
}

/** 判断错误类型是否可重试(network/timeout/rate_limited)—— 口径逐字未变,改读闭集(G-710)。 */
export function isRetryableErrorType(errorType: string | undefined): boolean {
  return errorType !== undefined && RETRYABLE_FAILURE_CODES.has(errorType as FailureCode);
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
    /**
     * G-464:仅 `Tool.strictSchema === true` 的工具产出 —— 资格在本面(OpenAI 兼容)可表达
     * ⇒ 命令化落点。未声明的工具不产这个键,线上形态与引入前逐字节同形。
     */
    strict?: boolean;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required: string[];
    };
  };
}

// ==================== 逐工具 strict 资格位 → 严格解码面改造(G-464,与声明位同笔)====================

/** strict 结构化解码不解释、只能折进 description 的值约束关键字(provider 拒不认识的关键字,留着会被整单拒)。 */
const STRICT_INEXPRESSIBLE_KEYS: readonly string[] = [
  'minimum',
  'maximum',
  'minLength',
  'maxLength',
  'pattern',
];

function isStrictRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** 把一条"线上表达不了"的事实折进该节点 description —— 信息不丢,只是改走散文通道。 */
function foldStrictNote(node: Record<string, unknown>, note: string): void {
  const base = typeof node.description === 'string' && node.description !== '' ? `${node.description} ` : '';
  node.description = `${base}(strict-schema 折入: ${note})`;
}

/**
 * 把一份已投影的 parameters **就地**改造成 strict 解码面可接受的形态(三件事,其余逐键不动):
 *   ① 值约束关键字(`STRICT_INEXPRESSIBLE_KEYS`)剥离,原样折进本节点 description;
 *   ② 每个 object 层收成 `additionalProperties: false`(strict 面要求显式闭集;true/子 schema 形无法表达);
 *   ③ 未列于 required 的属性并入 required(strict 面要求全属性 required),"可省略"语义折进该属性 description。
 * 只被 `strictSchema === true` 的工具走到;缺省路径一次都不进,现状逐字不变。
 */
function conditionSchemaForStrict(node: unknown, path: string): void {
  if (!isStrictRecord(node)) return;
  for (const key of STRICT_INEXPRESSIBLE_KEYS) {
    if (key in node) {
      foldStrictNote(node, `${key}=${JSON.stringify(node[key])}`);
      delete node[key];
    }
  }
  if (isStrictRecord(node.items)) conditionSchemaForStrict(node.items, `${path}.items`);
  if (node.type === 'object' && isStrictRecord(node.properties)) {
    const props = node.properties;
    for (const [name, child] of Object.entries(props)) {
      conditionSchemaForStrict(child, `${path}.properties.${name}`);
    }
    const required = new Set(
      Array.isArray(node.required)
        ? node.required.filter((r): r is string => typeof r === 'string')
        : [],
    );
    for (const [name, child] of Object.entries(props)) {
      if (!required.has(name) && isStrictRecord(child)) {
        required.add(name);
        foldStrictNote(child, '本参数可省略(strict 面要求全属性 required,以本声明为准)');
      }
    }
    node.required = [...required];
    const ap = node.additionalProperties;
    if (ap !== false) {
      if (ap !== undefined) {
        foldStrictNote(node, `additionalProperties=${JSON.stringify(ap)} 无法表达,已收为 false`);
      }
      node.additionalProperties = false;
    }
  }
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
 *
 * 逐工具 strict 分叉(G-464):`strictSchema === true` 的工具先经 `conditionSchemaForStrict`
 * 改造成严格解码面形态,再落 `function.strict = true`(资格 → 命令的唯一落点);其余工具
 * 与该分支引入前逐字同形。全局资格(`useNativeTools`,commands/agent)不开时本函数根本不会被调,
 * 本位在其之上只做逐工具收窄。
 */
export function toolsToProviderSchema(tools: Tool[]): ProviderToolSchema[] {
  return tools.map((tool) => {
    const entry: ProviderToolSchema = {
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: projectToolInputSchema(tool.parameters, tool.required),
      },
    };
    if (tool.strictSchema === true) {
      conditionSchemaForStrict(entry.function.parameters, '$');
      entry.function.strict = true;
    }
    return entry;
  });
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
