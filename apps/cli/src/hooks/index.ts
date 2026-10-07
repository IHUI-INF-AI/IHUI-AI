// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Pre/Post Tool Hooks — 用户自定义工具调用钩子。
 *
 * 灵感来源:参考行业 Agent 框架的 hooks 系统(pre/post tool call 可阻断 + sessionStart/sessionEnd 生命周期)。
 * 简化策略(做减法):
 *   - 多源加载 hooks.json:<cwd>/.{ihui,claude,cursor} → ~/.{ihui,claude,cursor}(高→低,深合并)
 *   - 每个 hook 二选一:command(本地 shell)或 webhook(HTTP POST 通知外部服务)
 *   - preToolCall:钩子失败时阻断工具调用(blockOnError 默认 true)
 *   - postToolCall:钩子失败时返回 blockResult(blockOnError 默认 false,仅通知)
 *   - sessionStart:会话启动时执行,失败阻断会话启动(blockOnError 默认 true)
 *   - sessionEnd:会话结束时执行,失败不阻塞退出(始终 swallow)
 *   - 钩子通过环境变量接收上下文(IHUI_TOOL / IHUI_TOOL_INPUT / IHUI_TOOL_OUTPUT / IHUI_WORKSPACE / IHUI_SESSION_ID)
 *   - matchTool 支持正则匹配工具名,省略则匹配所有工具
 *
 * 配置示例 (~/.ihui/hooks.json):
 * {
 *   "preToolCall": [
 *     { "name": "block-rm-rf", "command": "echo 'blocked' && exit 1", "matchTool": "bash", "blockOnError": true }
 *   ],
 *   "postToolCall": [
 *     { "name": "notify-feishu", "webhook": "https://open.feishu.cn/open-apis/bot/v2/hook/xxx",
 *       "body": "{\"event\":\"{{event}}\",\"tool\":\"{{toolName}}\"}", "blockOnError": false }
 *   ],
 *   "sessionStart": [
 *     { "name": "load-ctx", "command": "cat ~/.ihui/context.md" }
 *   ],
 *   "sessionEnd": [
 *     { "name": "notify", "command": "echo 'session ended' >> ~/.ihui/sessions.log" }
 *   ]
 * }
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
// 规范化器唯一实现(见下方摘要口径处的说明)
import { canonicalizeArgs } from '../stream-tool-ledger.js';
import { tryParseJson, isRecord } from '../util/json.js';
import { gateHook } from './trust.js';
import { buildFilteredEnv, DEFAULT_BLOCKED_ENV_VARS } from '../sandbox/index.js';
import { redactCrashText } from '@ihui/shared/utils/redact';
// 回传通道进的是模型上下文 ⇒ 钩子文本里冒充宿主的保留标签必须中和。
// 唯一出口住 ../utils/prompt-boundary.js(只调用,不修改那个文件,守门 129 的机制清单)。
import { neutralizeBoundaries } from '../utils/prompt-boundary.js';

export interface HookEntry {
  name: string;
  /** 本地 shell 命令(与 webhook 二选一) */
  command?: string;
  /** HTTP webhook URL(与 command 二选一,POST 通知外部服务) */
  webhook?: string;
  /** webhook 请求方法(默认 POST) */
  method?: 'POST' | 'PUT' | 'GET';
  /** webhook 请求头 */
  headers?: Record<string, string>;
  /** webhook 请求 body 模板(支持 {{event}} {{workspacePath}} {{sessionId}} {{toolName}} {{toolArgs}}) */
  body?: string;
  matchTool?: string;
  blockOnError?: boolean;
  /** 超时毫秒(command 与 webhook 共用,默认 10000) */
  timeout?: number;
  /** 来源标记,由 loadHooksConfig 按配置文件落点盖章:
   *  - `'project'` = 工作区里带的配置(clone 下来的仓库可写)→ command 形态必须过目录信任门
   *  - `'user'`    = 用户主目录下的配置 → 行为与接线前完全一致
   *  未盖章(`undefined`)按 `'project'` 处理:来源不明不能变成免检通道。 */
  source?: 'project' | 'user';
  /** 来源配置所在目录(绝对路径)。目录信任判定按**它**而不是 process.cwd() ——
   *  IHUI_HOOKS_CONFIG 可以把配置指到任意目录,按 cwd 判会把陌生目录的钩子
   *  算成"已信任目录里长出来的"。 */
  sourceFolder?: string;
}

export type HookEvent =
  | 'preToolCall'
  | 'postToolCall'
  | 'sessionStart'
  | 'sessionEnd'
  | 'userPromptSubmit'
  | 'preCompact'
  | 'postCompact'
  | 'notification'
  | 'stop'
  | 'stopFailure'
  | 'postToolUseFailure'
  | 'permissionDenied'
  // G-916424:PermissionRequest 应答面 —— 确认窗弹出前派发,钩子可产出 deny/allow/ask/
  // modify 四形状应答(与 permissionDenied 不同:那只是事后通知,本事件是事前裁决输入)。
  | 'permissionRequest'
  | 'subagentStart'
  | 'subagentStop'
  // P2-4 agent-lifecycle Turn 级事件(4 种):
  // - turnStart:每次 LLM 调用 + 工具循环开始(每轮触发,粒度细于 sessionStart)
  // - turnEnd:每轮成功结束(无论是否调用工具)
  // - turnError:本轮出错(单轮失败,不等于 agent 终止)
  // - turnComplete:agent 完成所有轮次(成功或失败都触发,与 stop 配对)
  | 'turnStart'
  | 'turnEnd'
  | 'turnError'
  | 'turnComplete';

export interface HooksConfig {
  preToolCall?: HookEntry[];
  postToolCall?: HookEntry[];
  sessionStart?: HookEntry[];
  sessionEnd?: HookEntry[];
  userPromptSubmit?: HookEntry[];
  preCompact?: HookEntry[];
  postCompact?: HookEntry[];
  notification?: HookEntry[];
  stop?: HookEntry[];
  stopFailure?: HookEntry[];
  postToolUseFailure?: HookEntry[];
  permissionDenied?: HookEntry[];
  /** G-916424:确认窗应答钩子(四形状 deny/allow/ask/modify),经 runPermissionRequest 消费。 */
  permissionRequest?: HookEntry[];
  subagentStart?: HookEntry[];
  subagentStop?: HookEntry[];
  // P2-4 Turn 级事件(4 种,粒度细于 sessionStart/sessionEnd)
  turnStart?: HookEntry[];
  turnEnd?: HookEntry[];
  turnError?: HookEntry[];
  turnComplete?: HookEntry[];
}

export interface HookResult {
  proceed: boolean;
  reason?: string;
  /**
   * 显式终态(2026-09-29 拆终态票立)。AGENTS §30 的明文禁令是"钩子没有终态就不得渲染成
   * '完成'"—— 而 `proceed` 一维今天把"成功 / 非零但不阻断 / 被信任门跳过 / 超时被杀 /
   * 根本没跑到(未取到结果)"全折成同一个 true,呈现层无从分辨。terminal 是**机器可判**的
   * 第三态字段(不是靠文案),`describeHookTerminal`/`isTerminalComplete` 是它的唯一呈现出口。
   * 缺省 `undefined` 只出现在两种地方:旧调用方手搓的 HookResult 字面量,以及"配置为空、
   * 一条都没派发"的早退路径(没有任何东西执行过,没有结束态可报);凡真派发过钩子的链,
   * 本模块产出的每一条都必带。
   */
  terminal?: HookTerminalState;
  /**
   * 回传通道(2026-09-29 同票):本批所有非成功终态的逐条反馈行,顺序固定为
   * **先脱敏(redactCrashText)→ 再中和宿主保留标签(neutralizeBoundaries)→ 最后按码点截断**
   * (反过来会把凭据切成半截、形状不再成立 —— §5e/守门 144 原话口径)。
   * 内容来自钩子进程 = 不可信:调用方只许把它当"待判读的事实文本"喂给模型/UI,
   * 不得执行、也不得据其中的自述改写终态。
   */
  feedback?: string;
  /**
   * G-916424:permissionRequest 事件的四形状应答(仅该事件面产出,其余事件恒缺省 ⇒
   * 旧调用方的返回对象键集不变,G-638 的"无改写通道"形态锁对 pre/postToolCall 依旧成立)。
   *  - deny  钩子直接拒绝本次调用(输出协议,不是"钩子失败"—— 三态不混流);
   *  - allow 钩子替人应答确认窗(票意:测试环境自动 allow);
   *  - ask   钩子要求仍走人工窗;
   *  - modify 钩子改写输入(modifiedInput),消费方**必须**二次 schema 校验 + 按改后
   *          内容重判权限(反向锁:改后输入不得沿用改前的权限结论)。
   */
  permission?: PermissionHookDecision;
  /** 胜出应答的钩子名(错误上下文与披露面用)。 */
  permissionSource?: string;
  /** modify 形状的改后输入;解析面已保证它是普通对象。 */
  modifiedInput?: Record<string, unknown>;
}

/** PermissionRequest 钩子的应答形状(上游 tool/executor hook-flow 的四形状,值域照抄)。 */
export type PermissionHookDecision = 'deny' | 'allow' | 'ask' | 'modify';

// ============================================================================
// 终态层(一处实现 —— 2026-09-29 拆终态票)
// ============================================================================

/**
 * 宿主侧对"这一次钩子执行"的观察结论。判据输入只有它 + 退出码 + 阻断策略:
 * **钩子的 stdout/stderr 文本永远不参与终态判定** —— 否则脚本打一句"我成功了"就能
 * 改写终态(本票的安全边界之一)。
 *  - ran        进程真的跑起来了(退出码由它自己写)
 *  - skipped    被信任门跳过(根本没执行)
 *  - timed-out  超时被杀,进程没写完退出码
 *  - no-result  没跑到 / 拿不到结果(spawn 失败、条目无载体、响应解析不出来)
 *  - cancelled  被父级取消信号打断(G-424,2026-10-07 拍板"抄上游")—— 取消与
 *               超时/失败不再同形;精确档落在下方事件层的 'Cancelled'
 */
export type HookExecOutcome = 'ran' | 'skipped' | 'timed-out' | 'no-result' | 'cancelled';

interface HookExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  outcome: HookExecOutcome;
}

/**
 * 钩子终态的封闭值域。现读改动前的实现,今天账面上"能被区分"的形态是 6 种
 * (外部只暴露 2 种:proceed true/false),这一张表把它们逐一分开:
 *  - succeeded            执行且退出 0
 *  - blocked              非零退出 ∧ blockOnError ⇒ 工具调用/会话被阻断
 *  - non_blocking_error   非零退出 ∧ ¬blockOnError ⇒ "跑了但坏了,不拦主流程"
 *  - skipped              被信任门跳过 ⇒ 既不是成功也不是失败,是"没人替陌生目录批"
 *  - timed_out            超时被杀 ⇒ "没跑完"不是"跑失败了"
 *  - result_unknown       没跑到 / 结果拿不到 ⇒ §30 点名的 `hook_non_blocking_error`
 *      同族缺陷的那一格:改动前它被折进 proceed=true(渲染成完成)。该态**必须被喊出来**
 *      (stderr warnOnce + feedback 行),失效方向是"多要一次说明",绝不是"多放一次"。
 */
export const HOOK_TERMINAL_STATES = [
  'succeeded',
  'blocked',
  'non_blocking_error',
  'skipped',
  'timed_out',
  'result_unknown',
] as const;

export type HookTerminalState = (typeof HOOK_TERMINAL_STATES)[number];

/**
 * 呈现出口:终态 → 稳定 ASCII 机器码(不新增语言包键 —— 本票禁改语言包,五语言需求见交付报告;
 * 复用既有键放不下这一族新语义)。"判出来"依赖的是这个**值**本身,文案只是它的可读投影。
 * result_unknown 的码刻意带 `-not-complete` 后缀:任何直接上屏这条码的表面,
 * 都不可能把它读成"完成"。
 */
const HOOK_TERMINAL_DESCRIPTIONS: Readonly<Record<HookTerminalState, string>> = {
  succeeded: 'hook-state:succeeded',
  blocked: 'hook-state:blocked-tool-call',
  non_blocking_error: 'hook-state:non-blocking-error',
  skipped: 'hook-state:skipped-by-trust-gate',
  timed_out: 'hook-state:timed-out',
  result_unknown: 'hook-state:result-unknown-not-complete',
};

export function describeHookTerminal(state: HookTerminalState): string {
  return HOOK_TERMINAL_DESCRIPTIONS[state];
}

/**
 * "算不算完成"的唯一判据 —— 只有 succeeded 是完成态。blocked/non_blocking_error/skipped/
 * timed_out/result_unknown 都**不得**被渲染成"完成"(§30)。呈现面必须走这里,不得各写
 * `=== 'succeeded'` 的第二份判断。
 */
export function isTerminalComplete(state: HookTerminalState): boolean {
  return state === 'succeeded';
}

/**
 * 终态分类的**唯一**实现:调用方(与测试)都只经生产链(runHook/runPreToolCall/…)间接使用,
 * 测试里不得再抄一份判定 —— 变异对照测的是测试自己。
 */
export function classifyHookTerminal(
  outcome: HookExecOutcome,
  exitCode: number,
  blockOnError: boolean,
): HookTerminalState {
  if (outcome === 'skipped') return 'skipped';
  // cancelled(G-424):被打断的钩子没有可引用的完成结果。冻结的 6 态值域不扩
  // (tests/hook-terminal-states.test.ts 把 HOOK_TERMINAL_STATES 钉在 6),投影到
  // result_unknown —— §30 的禁令是"不得渲染成完成",cancelled 天然满足;精确档
  // 由事件层 HookRunOutcome='Cancelled' 承载,两层各有其职。
  if (outcome === 'cancelled') return 'result_unknown';
  if (outcome === 'no-result') return 'result_unknown';
  if (exitCode === 0) return 'succeeded';
  if (outcome === 'timed-out') return 'timed_out';
  return blockOnError ? 'blocked' : 'non_blocking_error';
}

/** 多条目批次聚合时取"最该被看见"的那一态(严重度序,一处实现)。 */
const TERMINAL_SEVERITY: Readonly<Record<HookTerminalState, number>> = {
  succeeded: 0,
  skipped: 1,
  timed_out: 2,
  non_blocking_error: 3,
  blocked: 4,
  result_unknown: 5,
};

function worseTerminal(a: HookTerminalState, b: HookTerminalState): HookTerminalState {
  return TERMINAL_SEVERITY[b] > TERMINAL_SEVERITY[a] ? b : a;
}

// ============================================================================
// 钩子运行事件层(G-424,2026-10-07 拍板"抄上游")
// 上游 hooks/runner-helpers.ts:78 分 TimedOut/Cancelled/Failed/Blocked,
// runner.ts:186-232 每个钩子必发 started + 一个终态事件,runner.ts:334-379
// 用 linkAbortSignal 把父 signal 接进超时。我方对应物(本段一处实现):
//   - 事件:onHookRunEvent 订阅;dispatchHookEntry(见 runHookEntry 之后)是唯一
//     派发收口,保证"每条**派发的**钩子恰好一对 started/terminal"(成功也不例外;
//     被取消而不再派发的余下条目不发 —— 它们从未执行)。
//   - 终态枚举:HookRunOutcome = 上游四档 + Succeeded + 我方 Skipped/Unknown 两档
//     (信任门跳过与"没跑到"必须有诚实档位,否则不变量在全部路径上不成立)。
//   - 取消:linkAbortSignal 把父 signal 与该条钩子的超时并进同一个 AbortController;
//     取消的钩子落 'Cancelled',不再与超时/失败同形,且取消后余下条目不再派发。
// 与 2026-09-29 终态层(HookTerminalState,冻结 6 态)的分界:那一层管"呈现侧完成
// 判定",本层管"机器可读的逐条事件流";cancelled 在旧层投影为 result_unknown
// (§30:不得渲染成完成),精确档只在本层。
// ============================================================================

/** 上游四档(TimedOut/Cancelled/Failed/Blocked)+ Succeeded,另加我方 Skipped/Unknown 两档(见上注)。 */
export const HOOK_RUN_OUTCOMES = [
  'Succeeded',
  'TimedOut',
  'Cancelled',
  'Failed',
  'Blocked',
  'Skipped',
  'Unknown',
] as const;

export type HookRunOutcome = (typeof HOOK_RUN_OUTCOMES)[number];

/** 一次钩子派发的 started 事件:执行前发,只报身份不报结果。 */
export interface HookRunStartedEvent {
  type: 'started';
  /** 所属钩子事件名(preToolCall/turnStart/…) */
  hookEvent: string;
  /** 钩子名(hooks.json 的 name) */
  hook: string;
}

/** 一次钩子派发的终态事件:outcome 是机器可判档位,exitCode 是执行面原始观察。 */
export interface HookRunTerminalEvent {
  type: 'terminal';
  hookEvent: string;
  hook: string;
  outcome: HookRunOutcome;
  exitCode: number;
}

export type HookRunEvent = HookRunStartedEvent | HookRunTerminalEvent;
export type HookRunListener = (event: HookRunEvent) => void;

const hookRunListeners = new Set<HookRunListener>();

/**
 * 订阅钩子运行事件流(started/terminal 成对)。返回退订函数。
 * 监听器抛错只吞不传导 —— 事件面是观察者不是判定者,它的故障不得改写钩子终态。
 */
export function onHookRunEvent(listener: HookRunListener): () => void {
  hookRunListeners.add(listener);
  return () => {
    hookRunListeners.delete(listener);
  };
}

function emitHookRunEvent(event: HookRunEvent): void {
  for (const listener of hookRunListeners) {
    try {
      listener(event);
    } catch {
      // 吞掉:见 onHookRunEvent 注
    }
  }
}

/** 终态事件 outcome 的唯一判据(与 classifyHookTerminal 同一输入;Cancelled 是事件层精确档)。 */
function runOutcomeOfExec(r: HookExecResult, blockOnError: boolean): HookRunOutcome {
  if (r.outcome === 'cancelled') return 'Cancelled';
  switch (classifyHookTerminal(r.outcome, r.exitCode, blockOnError)) {
    case 'succeeded':
      return 'Succeeded';
    case 'timed_out':
      return 'TimedOut';
    case 'blocked':
      return 'Blocked';
    case 'non_blocking_error':
      return 'Failed';
    case 'skipped':
      return 'Skipped';
    case 'result_unknown':
      return 'Unknown';
  }
}

/**
 * 上游 runner.ts:334-379 的 linkAbortSignal:把**父级取消信号**与**终止时限**并进同一个
 * AbortController —— 父级取消与到时谁先到都走同一个 signal,执行面据此打断/分类。
 *  - 父级已取消:立即返回已 abort 的 signal(不起定时器);
 *  - 父级后取消:以父级原因 abort,并清掉时限定时器;
 *  - 到时先到:以超时原因 abort(我方调用面把它当兜底,见 HOOK_ABORT_BACKSTOP_MS);
 *  - 正常结束:调用方**必须** dispose()(清定时器 + 摘父级监听,不泄漏不挂进程)。
 */
export interface LinkedAbortSignal {
  signal: AbortSignal;
  dispose(): void;
}

const HOOK_ABORT_TIMEOUT_REASON = 'hook-timeout';

export function linkAbortSignal(parent: AbortSignal | undefined, timeoutMs: number): LinkedAbortSignal {
  const controller = new AbortController();
  if (parent?.aborted) {
    controller.abort(parent.reason);
    return { signal: controller.signal, dispose() {} };
  }
  const timer = setTimeout(() => controller.abort(new Error(HOOK_ABORT_TIMEOUT_REASON)), timeoutMs);
  const onParentAbort = () => {
    clearTimeout(timer);
    controller.abort(parent?.reason);
  };
  const onSettled = () => {
    clearTimeout(timer);
    parent?.removeEventListener('abort', onParentAbort);
  };
  controller.signal.addEventListener('abort', onSettled, { once: true });
  parent?.addEventListener('abort', onParentAbort, { once: true });
  return {
    signal: controller.signal,
    dispose() {
      clearTimeout(timer);
      parent?.removeEventListener('abort', onParentAbort);
    },
  };
}

/**
 * link 定时器的兜底余量。派发面把 `entry.timeout + 本余量` 传给 linkAbortSignal:
 * spawnSync 自带的原生 timeout 仍是主杀机制(到时给 ETIMEDOUT ⇒ timed-out),
 * link 的到时只在原生机制没能收场时兜底 —— 两个计时器同值会在边界上竞速,
 * 把"纯超时"误报成"取消",余量消掉这条竞态。
 */
const HOOK_ABORT_BACKSTOP_MS = 250;

export interface SessionHookContext {
  workspacePath: string;
  sessionId?: string;
}

export interface HookContext {
  workspacePath?: string;
  sessionId?: string;
  toolName?: string;
  toolArgs?: unknown;
  toolResult?: unknown;
  prompt?: string;
  error?: string;
  reason?: string;
  subagentId?: string;
  subagentType?: string;
  compactedTokensBefore?: number;
  compactedTokensAfter?: number;
  notificationText?: string;
  // P2-4 Turn 级事件字段
  /** 当前 turn 序号(1-based) */
  turnNumber?: number;
  /** 最大 turn 数(对应 maxIterations) */
  maxTurns?: number;
  /** agent 最终完成的轮次总数(turnComplete 事件用) */
  totalTurns?: number;
  /** agent 停止原因(turnComplete 事件用,与 AgentStopReason 对齐) */
  stopReason?: string;
}

/**
 * webhook body 模板变量替换:将 {{var}} 替换为 vars[var]。
 * 未定义变量替换为空字符串。无变量时原样返回。
 */
export function buildWebhookBody(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    return Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key] ?? '') : '';
  });
}

/** HooksConfig 的全部事件键 —— 合并与来源盖章两处共用一份清单
 *  (两处各抄一份时,新增事件只改一处就会静默漏掉另一处)。 */
const HOOK_EVENT_KEYS: Array<keyof HooksConfig> = [
  'preToolCall', 'postToolCall', 'sessionStart', 'sessionEnd',
  'userPromptSubmit', 'preCompact', 'postCompact', 'notification',
  'stop', 'stopFailure', 'postToolUseFailure', 'permissionDenied',
  'permissionRequest',
  'subagentStart', 'subagentStop',
  // P2-4 Turn 级事件
  'turnStart', 'turnEnd', 'turnError', 'turnComplete',
];

/**
 * 深合并两个 HooksConfig:b 的标量/数组与 a 合并。
 * 数组字段(preToolCall 等)拼接为 [...a, ...b](a 在前);仅一边存在则保留该边。
 */
export function deepMergeHooks(a: HooksConfig, b: HooksConfig): HooksConfig {
  const result: HooksConfig = {};
  const keys: Array<keyof HooksConfig> = HOOK_EVENT_KEYS;
  for (const k of keys) {
    const av = a[k];
    const bv = b[k];
    if (av && bv) {
      result[k] = [...av, ...bv];
    } else if (av) {
      result[k] = [...av];
    } else if (bv) {
      result[k] = [...bv];
    }
  }
  return result;
}

/** 多源扫描目录(高→低):workspace 三级 → home 三级 */
const CONFIG_SOURCE_DIRS = ['.ihui', '.claude', '.cursor'];

function listHooksConfigPaths(cwd: string): string[] {
  const home = os.homedir();
  const paths: string[] = [];
  for (const d of CONFIG_SOURCE_DIRS) paths.push(path.join(cwd, d, 'hooks.json'));
  for (const d of CONFIG_SOURCE_DIRS) paths.push(path.join(home, d, 'hooks.json'));
  return paths;
}

/**
 * 配置文件归属的"目录" —— 目录信任判定要以它为粒度,而不是以 hooks.json 所在目录:
 * `<repo>/.ihui/hooks.json` 的归属目录是 `<repo>`(用户要信任的是这个仓库,
 * 而不是它的 `.ihui` 子目录)。约定目录名不在 CONFIG_SOURCE_DIRS 里时,取其自身父目录。
 */
export function owningFolderOfConfig(configFile: string): string {
  const dir = path.dirname(path.resolve(configFile));
  return CONFIG_SOURCE_DIRS.includes(path.basename(dir)) ? path.dirname(dir) : dir;
}

function isSameOrUnder(candidate: string, root: string): boolean {
  return candidate === root || candidate.startsWith(root + path.sep);
}

/**
 * 按配置文件落点判定来源:
 * - 归属目录落在工作区内 → `'project'`(clone 下来的仓库自带的配置走这一支)
 * - 落在用户主目录下 → `'user'`(用户自己写的,不算外来代码)
 * - 两处都不落(单源模式指到别处 / 判不出来)→ `'project'`
 *   最后一支是**刻意的保守**:默认放行等于把"来源不明"当免检通道。
 */
export function classifyHooksSource(configFile: string, cwd: string): 'project' | 'user' {
  const owning = owningFolderOfConfig(configFile);
  if (isSameOrUnder(owning, path.resolve(cwd))) return 'project';
  if (isSameOrUnder(owning, path.resolve(os.homedir()))) return 'user';
  return 'project';
}

/** 给一份从磁盘读到的配置逐条盖来源戳(必须在合并**之前**做,合并后无法区分谁带来的) */
function stampConfigSource(
  config: HooksConfig,
  source: 'project' | 'user',
  sourceFolder: string,
): HooksConfig {
  const stamped: HooksConfig = {};
  for (const key of HOOK_EVENT_KEYS) {
    const entries = config[key];
    if (!entries) continue;
    // 已带 source 的条目不覆盖:允许调用方(或再上一层生成器)显式声明来源
    stamped[key] = entries.map((e) => ({
      ...e,
      source: e.source ?? source,
      sourceFolder: e.sourceFolder ?? sourceFolder,
    })) as never;
  }
  return stamped;
}

/** 一份磁盘配置 + 它解析出来的**原树**(束摘要必须喂原树,不能喂合并/加工后的派生态) */
interface HooksSourceBundle {
  configFile: string;
  config: HooksConfig;
  raw: Record<string, unknown>;
}

function readHooksConfigBundle(p: string): HooksSourceBundle | null {
  if (!fs.existsSync(p)) return null;
  try {
    const parsed = tryParseJson(fs.readFileSync(p, 'utf-8'));
    // 损坏文件返回 null,由调用方继续下一源(与旧行为一致)
    if (!isRecord(parsed)) return null;
    return { configFile: p, config: parsed as unknown as HooksConfig, raw: parsed };
  } catch {
    return null;
  }
}

function readHooksConfigFile(p: string): HooksConfig | null {
  return readHooksConfigBundle(p)?.config ?? null;
}

/** 剥掉派发侧盖上的派生字段,只留磁盘上那份声明(信任记录与门内比对必须用同一个口径) */
function stripDispatchStamps(entry: HookEntry): Record<string, unknown> {
  const all = entry as unknown as Record<string, unknown>;
  const { source: _s, sourceFolder: _f, ...raw } = all;
  void _s;
  void _f;
  return raw;
}

/**
 * 内容摘要的两个口径(A20)。放在配置层而不是信任层,有两个理由:
 *   ① 摘要取的是"配置长什么样",这本来就是 loadHooksConfig 的知识;trust.ts 只认
 *      不透明字符串(它连 HooksConfig 的类型都不该引,否则信任层要反过来懂配置格式)。
 *   ② 实测过的工程约束:`tests/hooks-trust-command.test.ts` 用 vi.mock 整模块替换
 *      trust.js(只给出它认识的那几个导出)。摘要函数住在 trust.js 时,任何走
 *      commands/hooks.ts → index.ts → trust.js 的调用都会撞上 "No export is defined on
 *      the mock" —— 既有测试一字未改就红。住在配置层则与被替换的模块无关。
 *
 * 规范化器只认一份实现(AGENTS「两处算同一 key 必须共用一份实现」):
 * `apps/cli/src/stream-tool-ledger.ts` 的 canonicalizeArgs(递归按 key 排序),
 * 消除"同一对象两种 JSON 串"造成的指纹分裂 —— 也就是"改了键序/缩进就误判过期"那一类。
 */

/** 摘要前缀带形态版本 + 算法名:改了"取哪些字段/怎么编码"必须 +1,否则新旧两套字节共用同一份登记表 */
const DIGEST_PREFIX = `v1-sha256-`

/** 单条声明摘要的聚合前缀:与整束摘要分域,使两者**不可能**产出同一个值(不靠注释提醒) */
const DECL_DIGEST_PREFIX = 'ihui-hook-decl-v1'

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * 「束」摘要 —— 覆盖的是**面**,不是取值:有哪几份来源文件、每个事件下有哪些钩子名字、
 * 以及事件数组之外的根级字段。单条钩子把命令改掉不该让整个目录掉信任(见
 * computeHookContentDigests 的两级说明),但"凭空多出一条钩子"必须让整批重确认 ——
 * 用户当初批准的是那份清单,清单变长不在授权范围内。
 */
export function digestOfHooksBundle(surface: unknown): string {
  return DIGEST_PREFIX + sha256(canonicalizeArgs(surface ?? {}));
}

/**
 * 单条钩子声明的摘要 —— 覆盖这条声明的**全部取值**。
 * `kind` 前缀让 command 形态与 webhook 形态不在同一命名空间比较:把一条 command 原地
 * 换成 webhook(或反之)是最需要重新确认的一次改动,而两者共用字段可能一字未动。
 * kind 由声明自身推出(webhook 有值即 webhook),不依赖任何外部登记。
 */
export function digestOfHookDeclaration(entry: unknown): string {
  const rec = (entry ?? {}) as Record<string, unknown>;
  const kind = typeof rec.webhook === 'string' && rec.webhook.length > 0 ? 'webhook' : 'command';
  const material = `${DECL_DIGEST_PREFIX}\u0000${kind}\u0000${canonicalizeArgs(entry ?? {})}`;
  return DIGEST_PREFIX + sha256(material);
}

/**
 * 算出「该目录下会派发的钩子」的内容摘要(束 + 逐条)。
 * `ihui hooks trust` 批准时与派发门判定时**都必须**走这一个函数 —— 两处各算一遍
 * (一侧喂磁盘原树、一侧喂合并结果)必然不同形,表现为永不收敛的 stale。
 *
 * 两级各管一类(缺任一级都会退化):
 *   - 束摘要管"清单与根级面":来源文件增删 / 某事件下多出一个钩子名字 / 根级字段变化
 *     → 整批掉信任,因为用户批的是那份清单。
 *   - 单条摘要管"这一条的取值":改一条命令 / URL / 匹配器 / 超时
 *     → **只有那一条**掉信任,其余照跑。只有束级时改一条会把全部钩子打回重批,
 *     用户被骚扰到无脑点"是",信任就退化成噪音。
 *
 * 单条摘要的登记表键 = 钩子 `name`,与既有的 `~/.ihui/disabled-hooks`(也按名字逐条管)
 * 同一身份口径:"这个目录里叫 X 的那条钩子"就是用户批准时看到的东西。代价如实登记:
 * 两个事件下各有一条同名钩子时,摘要表只留**先读到的**那条 —— 不会因此漏判,
 * 因为两条同名钩子的"面"(事件 × 名字身份)本来就不同,增删任一条都会先动束摘要。
 *
 * 只统计**工作区那一层**的配置文件(<dir>/.{ihui,claude,cursor}/hooks.json),
 * 不并入用户主目录的配置 —— 家目录配置派发时本就不查门(source==='user' 短路),
 * 把它并进摘要会让"改一条用户自己的全局钩子"把每个项目的信任一起打回重批。
 */
export function computeHookContentDigests(
  cwd: string = process.cwd(),
): { bundleDigest: string; declarations: Record<string, string> } {
  const paths: string[] = [];
  if (process.env.IHUI_HOOKS_CONFIG) paths.push(process.env.IHUI_HOOKS_CONFIG);
  else for (const d of CONFIG_SOURCE_DIRS) paths.push(path.join(cwd, d, 'hooks.json'));
  const sources: string[] = [];
  const surface: string[] = [];
  const roots: Array<Record<string, unknown>> = [];
  const declarations: Record<string, string> = {};
  for (const p of paths) {
    const bundle = readHooksConfigBundle(p);
    if (!bundle) continue;
    // 来源名取相对 cwd 的那一段(<.ihui|...>/hooks.json)或绝对路径本身(单源模式)——
    // 不含盘符前缀,所以"仓库搬家"不会因为路径字符串变化而额外掉信任(搬家本来就要重批目录)。
    const rel = path.relative(cwd, p);
    sources.push(rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? rel.split(path.sep).join('/') : p);
    // 事件数组之外的键(若有人往根上塞了 version/timeout 之类)整体计入束摘要
    const root: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(bundle.raw)) {
      if (!(HOOK_EVENT_KEYS as string[]).includes(k)) root[k] = v;
    }
    roots.push(root);
    for (const event of HOOK_EVENT_KEYS) {
      for (const entry of bundle.config[event] ?? []) {
        surface.push(`${event}:${entry.name}`);
        if (declarations[entry.name] === undefined) {
          declarations[entry.name] = digestOfHookDeclaration(stripDispatchStamps(entry));
        }
      }
    }
  }
  // 数组顺序 = 优先级顺序(高→低),与 loadHooksConfig 的读取方向一致 ⇒ 同一份磁盘内容
  // 在任何一次调用里算出的束摘要都相同(不存在"键序 / 读序"造成的假 stale)。
  const bundleDigest = digestOfHooksBundle({
    sources,
    surface: surface.slice().sort(),
    roots,
  });
  return { bundleDigest, declarations };
}

export function getHooksPath(): string {
  if (process.env.IHUI_HOOKS_CONFIG) return process.env.IHUI_HOOKS_CONFIG;
  return path.join(os.homedir(), '.ihui', 'hooks.json');
}

/**
 * 多源加载 hooks.json,按优先级深合并(高优先级覆盖低优先级)。
 * IHUI_HOOKS_CONFIG 环境变量设置时退化为单源(向后兼容)。
 * 每条钩子都会被盖上 `source` / `sourceFolder`(派发时判目录信任要用)。
 */
export function loadHooksConfig(cwd: string = process.cwd()): HooksConfig {
  if (process.env.IHUI_HOOKS_CONFIG) {
    const p = process.env.IHUI_HOOKS_CONFIG;
    const parsed = readHooksConfigFile(p);
    if (!parsed) return {};
    return stampConfigSource(parsed, classifyHooksSource(p, cwd), owningFolderOfConfig(p));
  }
  const paths = listHooksConfigPaths(cwd);
  let acc: HooksConfig = {};
  for (const p of [...paths].reverse()) {
    const parsed = readHooksConfigFile(p);
    if (parsed) {
      acc = deepMergeHooks(acc, stampConfigSource(parsed, classifyHooksSource(p, cwd), owningFolderOfConfig(p)));
    }
  }
  return acc;
}

export function loadHooks(): HooksConfig {
  return loadHooksConfig();
}

function matchesTool(entry: HookEntry, toolName: string): boolean {
  if (!entry.matchTool) return true;
  try {
    return new RegExp(entry.matchTool).test(toolName);
  } catch {
    return entry.matchTool === toolName;
  }
}

type WebhookResult =
  | { kind: 'response'; status: number; body: string }
  | { kind: 'error'; error: 'timeout' | 'network'; message: string };

/** 子进程脚本:用原生 fetch 发起 webhook,AbortController 控制超时,结果以 JSON 写到 stdout。
 *  通过 IHUI_WEBHOOK_CFG 环境变量传入配置,避免命令行转义。 */
const WEBHOOK_SCRIPT = `
const cfg = JSON.parse(process.env.IHUI_WEBHOOK_CFG || '{}');
const ctrl = new AbortController();
const timer = setTimeout(() => ctrl.abort(), cfg.timeout);
fetch(cfg.url, {
  method: cfg.method,
  headers: cfg.headers,
  body: cfg.body,
  signal: ctrl.signal,
}).then(async (r) => {
  const t = await r.text().catch(() => '');
  process.stdout.write(JSON.stringify({ kind: 'response', status: r.status, body: String(t).slice(0, 500) }));
}).catch((e) => {
  const name = (e && e.name) || '';
  const code = (e && e.code) || '';
  const isTimeout = name === 'TimeoutError' || name === 'AbortError' || code === 'ABORT_ERR';
  process.stdout.write(JSON.stringify({ kind: 'error', error: isTimeout ? 'timeout' : 'network', message: String((e && e.message) || e) }));
}).finally(() => clearTimeout(timer));
`;

function extractWebhookVars(env: Record<string, string>): Record<string, string> {
  return {
    event: env.IHUI_HOOK_TYPE ?? '',
    workspacePath: env.IHUI_WORKSPACE ?? '',
    sessionId: env.IHUI_SESSION_ID ?? '',
    toolName: env.IHUI_TOOL ?? '',
    toolArgs: env.IHUI_TOOL_INPUT ?? env.IHUI_TOOL_OUTPUT ?? '',
    prompt: env.IHUI_PROMPT ?? '',
    error: env.IHUI_ERROR ?? '',
    reason: env.IHUI_REASON ?? '',
    subagentId: env.IHUI_SUBAGENT_ID ?? '',
    subagentType: env.IHUI_SUBAGENT_TYPE ?? '',
    compactedTokensBefore: env.IHUI_COMPACTED_TOKENS_BEFORE ?? '',
    compactedTokensAfter: env.IHUI_COMPACTED_TOKENS_AFTER ?? '',
    notificationText: env.IHUI_NOTIFICATION_TEXT ?? '',
  };
}

function runWebhookSync(entry: HookEntry, env: Record<string, string>, signal?: AbortSignal): HookExecResult {
  const timeout = entry.timeout ?? 10_000;
  const cfg = {
    url: entry.webhook,
    method: entry.method ?? 'POST',
    headers: entry.headers ?? {},
    body: entry.body ? buildWebhookBody(entry.body, extractWebhookVars(env)) : undefined,
    timeout,
  };
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  // G-424:signal 由派发面经 linkAbortSignal 合成(父级取消 ∪ 兜底时限)。
  const result = spawnSync(process.execPath, ['-e', WEBHOOK_SCRIPT], {
    env: { ...buildFilteredEnv(DEFAULT_BLOCKED_ENV_VARS), ...env, IHUI_WEBHOOK_CFG: JSON.stringify(cfg) },
    encoding: 'utf-8',
    timeout: timeout + 3000,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    signal,
  });
  if (result.error && spawnErrorCode(result.error) !== 'ETIMEDOUT') {
    // 父级取消杀掉承载进程(ABORT_ERR):取消 ≠ 失败,不能折成 no-result(那会把
    // "没跑到"与"被取消"重新折回同形)。同线程阻塞期信号进不来,这一支只接
    // "取消先于派发 / 取消落在收尾边界"两格;mid-run 打断是 spawnSync 的物理限制。
    if (spawnErrorCode(result.error) === 'ABORT_ERR' && signal?.aborted) {
      return { exitCode: 124, stdout: '', stderr: 'webhook 被父级取消信号打断', outcome: 'cancelled' };
    }
    // 承载进程自己没起来 ⇒ "根本没跑到",不是"钩子失败"。旧写法把它折成 exit 1(与脚本
    // 主动非零退出同形),终态层落地后它是 result_unknown。ETIMEDOUT(超时杀)归下一支。
    return { exitCode: 1, stdout: '', stderr: `webhook 执行失败: ${result.error.message}`, outcome: 'no-result' };
  }
  if (result.status === null) {
    return { exitCode: 1, stdout: '', stderr: 'webhook 超时', outcome: 'timed-out' };
  }
  const out = typeof result.stdout === 'string' ? result.stdout.trim() : '';
  const parsed = tryParseJson(out);
  if (!isRecord(parsed)) {
    return { exitCode: 1, stdout: '', stderr: 'webhook 响应解析失败', outcome: 'no-result' };
  }
  const res = parsed as unknown as WebhookResult;
  if (res.kind === 'response') {
    if (res.status >= 200 && res.status < 300) {
      return { exitCode: 0, stdout: `webhook ${res.status}`, stderr: '', outcome: 'ran' };
    }
    return { exitCode: 1, stdout: '', stderr: `webhook 返回 ${res.status}`, outcome: 'ran' };
  }
  if (res.error === 'timeout') {
    return { exitCode: 1, stdout: '', stderr: 'webhook 超时', outcome: 'timed-out' };
  }
  return { exitCode: 1, stdout: '', stderr: res.message || 'webhook 网络错误', outcome: 'ran' };
}

/** IHUI_TRUST_WORKSPACE 放行只提示一次,免得每条钩子刷一行 */
let workspaceTrustWarned = false;
/** 已提示过的被跳过钩子(按 来源+名字 去重:同一钩子每次工具调用都跑,不能每次都刷) */
const announcedSkips = new Set<string>();

/** 提示走 stderr:不得占用钩子的 stdout/stderr 通道,那两条是钩子结果本身 */
function warnOnce(line: string): void {
  try {
    process.stderr.write(`${line}\n`);
  } catch {
    // 提示写不出去也不影响派发判定
  }
}

/**
 * 派发前的信任判定 —— 只挂在 runHookEntry 这一个执行收口点上。
 *
 * 为什么必须有:配置可以从**工作区**里加载(`loadHooksConfig` 读 `<cwd>/.{ihui,claude,cursor}/
 * hooks.json`),而 command 形态是经 shell 派生的子进程,默认会继承整个进程环境 ——
 * 若既没有信任门、环境又未过滤,clone 一个陌生仓库并在里面跑 CLI,仓库自带的命令就会带着全部 API key 执行。
 * trust.ts 里这道门早就写好了,只是从来没有被调用(第一轮修的正是这一格);
 * 环境侧由 `buildFilteredEnv(DEFAULT_BLOCKED_ENV_VARS)` 兜第二层(2026-09-28),两层各管一种误配。
 *
 * 第二轮补的是**另一半**:门只问"这个目录在不在清单里",所以一旦某个目录被信任过,
 * 之后往它的 hooks.json 里塞任何命令都不再问一次。这里因此把"现在这份内容"的两个摘要
 * (整束 + 本条声明)一起交给门,由它对着批准时登记的摘要比 —— 见 trust.ts 的第 4 道判据。
 * 摘要在这里现算而不是在 loadHooksConfig 里盖戳:同一份 loadHooksConfig 的输出对象会被
 * deepMergeHooks 逐条 `{...e}` 复制,给每个字段配一份"必须原样穿过合并"的派生值等于多一条
 * 会漂移的路径;而磁盘原树是稳定的单一真相。
 *
 * @returns 跳过原因文案;null = 允许执行
 */
export function hookTrustSkipReason(entry: HookEntry, trustFileText?: string): string | null {
  // 用户主目录里的配置:行为与接线前完全一致(不查门)
  if (entry.source === 'user') return null;
  // 未盖章的条目按 project 处理 —— "来源不明"不构成免检通道。
  // 判定用来源目录而不是 process.cwd():IHUI_HOOKS_CONFIG 可以把配置指到任意目录。
  const folder = entry.sourceFolder ?? process.cwd();
  const { bundleDigest, declarations } = computeHookContentDigests(folder);
  const gate = gateHook(
    {
      name: entry.name,
      bundleDigest,
      // 本条声明不在磁盘束里(程序内自造的钩子)时不传单条摘要 → 门只比束摘要。
      hookName: declarations[entry.name] === undefined ? undefined : entry.name,
      declarationDigest: declarations[entry.name],
    },
    folder,
    trustFileText,
  );
  if (gate.allowed) return null;
  // IHUI_TRUST_WORKSPACE=1 = 非交互场景(CI / 脚本 / 无 TTY)的显式出口。
  // **只免"目录信任"**:免到内容这一层就等于本票没修(一个环境变量把"新塞进来的命令"
  // 也一起放行)。也不免 disabled-hooks:后者是用户逐条关掉的开关,
  // 一个环境变量不该把它复活。
  if (gate.reason === 'folder-not-trusted' && process.env.IHUI_TRUST_WORKSPACE === '1') {
    if (!workspaceTrustWarned) {
      workspaceTrustWarned = true;
      warnOnce(`⚠ IHUI_TRUST_WORKSPACE=1 已生效:本项目会话内的项目钩子一律按"已信任"执行(首个来源目录 ${folder})`);
    }
    return null;
  }
  return gate.detail ?? `hook "${entry.name}" 未通过信任门控`;
}

/**
 * spawnSync 失败对象的 errno。@types 把它标成裸 `Error`(code 挂在真实对象上,
 * Node 运行时类型是 `ErrnoException`)—— 用精确交叉类型读,不开 `any`。
 * 本机实测(2026-09-29):Windows shell 形态超时会给出 `error.code === 'ETIMEDOUT'`
 * 且 `status === null`,若只按"有 error 就没跑起来"判,超时会被折成 result_unknown。
 */
function spawnErrorCode(err: Error | undefined): string | undefined {
  return (err as (Error & { code?: string }) | undefined)?.code;
}

function runHookEntry(
  entry: HookEntry,
  env: Record<string, string>,
  signal?: AbortSignal,
): HookExecResult {
  // 两种形态过**同一道**门:判据只写一份。webhook 的外泄面不比 command 小 ——
  // IHUI_TOOL_INPUT / IHUI_TOOL_OUTPUT 会被原样 POST 到配置里的外部 URL
  // (见 extractWebhookVars 的 toolArgs),等价于"把工具输入输出发给外人"。
  // 上一版只在 command 分支查门,所以 clone 陌生仓库 + 仓库自带 webhook 钩子
  // 仍然会在无人知晓的情况下把会话内容送到外部地址。
  //
  // 先短路"两者皆空"的条目:它没有任何外部副作用,不值得为它查门。但它也不再算
  // "成功"—— 没有任何东西被执行过却回报 exit 0,正是本票要拆的"没跑到被折成完成"
  // 的一格;exitCode 保持 0(不阻断的行为逐字不变),outcome 如实给 no-result。
  if (!entry.webhook && !entry.command) {
    return {
      exitCode: 0,
      stdout: '',
      stderr: '钩子条目没有 command/webhook 载体(什么都没执行)',
      outcome: 'no-result',
    };
  }
  // 取消先于一切外部副作用(信任门/子进程):父级已取消就不再派发(G-424 拍板
  // "取消打断")。exitCode 0 ⇒ 不会触发 blockOnError 的阻断语义;精确档由事件层报。
  if (signal?.aborted) {
    return {
      exitCode: 0,
      stdout: '',
      stderr: '父级取消信号已到,钩子未执行',
      outcome: 'cancelled',
    };
  }
  const skipReason = hookTrustSkipReason(entry);
  if (skipReason) {
    // 跳过 ≠ 失败:exitCode 必须给 0。返回非 0 会让 blockOnError 的钩子反过来
    // 阻断工具调用,用户看到的是"我的工具坏了",而不是真实原因"这个目录没被信任"。
    // (拆终态前这一格在外部与"成功"完全同形 —— 现在它是 skipped,可被机器判出。)
    const key = `${entry.source ?? 'unstamped'}::${entry.name}`;
    if (!announcedSkips.has(key)) {
      announcedSkips.add(key);
      warnOnce(`⚠ 已跳过钩子 "${entry.name}":${skipReason}`);
    }
    return { exitCode: 0, stdout: '', stderr: skipReason, outcome: 'skipped' };
  }
  if (entry.webhook) {
    return runWebhookSync(entry, env, signal);
  }
  const result = spawnSync(entry.command!, {
    shell: true,
    encoding: 'utf-8',
    timeout: entry.timeout ?? 10_000,
    env: { ...buildFilteredEnv(DEFAULT_BLOCKED_ENV_VARS), ...env },
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    // G-424:父级取消 ∪ 兜底时限合成信号(linkAbortSignal);原生 timeout 仍是主杀机制。
    signal,
  });
  if (result.error && spawnErrorCode(result.error) !== 'ETIMEDOUT') {
    // 父级取消(ABORT_ERR)≠ 启动失败:不能折成 no-result。status 必为 null
    // (进程被杀,没写退出码),与下一支的"没写完退出码"同一观察面。
    if (spawnErrorCode(result.error) === 'ABORT_ERR' && signal?.aborted) {
      return {
        exitCode: 124,
        stdout: typeof result.stdout === 'string' ? result.stdout.trim() : '',
        stderr: '钩子被父级取消信号打断',
        outcome: 'cancelled',
      };
    }
    // spawn 层面就没起来(ENOENT/EPERM 这类)⇒ 钩子脚本从未执行,"未取到结果"。
    // 旧写法折成 exit 1,与"脚本跑了并失败"同形。ETIMEDOUT 不在这支:那是"跑起来了
    // 但被超时杀掉"(本机实测 Windows shell 形态三件套:error.code=ETIMEDOUT + signal
    // SIGTERM + status=null),归下一支的 timed-out。
    return {
      exitCode: 1,
      stdout: '',
      stderr: `钩子子进程启动失败: ${result.error.message}`,
      outcome: 'no-result',
    };
  }
  // status === null ⇒ 进程在写下退出码之前被杀。实测(2026-09-29 本机):Windows shell 形态
  // 超时会同时给 error.code==='ETIMEDOUT' + signal SIGTERM + status null,旧判据只认
  // signal==='SIGTERM' 且把 error 分支让位给"失败",换杀法/换平台就退回假形;
  // 按"没写完退出码"判更准,且 124 的既有映射逐字保留。
  if (result.status === null) {
    // 取消优先于超时(取消先落在收尾边界时,父级原因才是"为什么没写完退出码"的答案;
    // 事件层据此报 'Cancelled' 而不是 'TimedOut' —— 拍板点名的同形拆分就在这一格)。
    if (signal?.aborted) {
      return {
        exitCode: 124,
        stdout: typeof result.stdout === 'string' ? result.stdout.trim() : '',
        stderr: typeof result.stderr === 'string' && result.stderr.trim() !== ''
          ? result.stderr.trim()
          : '钩子在写下退出码前被父级取消信号打断',
        outcome: 'cancelled',
      };
    }
    return {
      exitCode: 124,
      stdout: typeof result.stdout === 'string' ? result.stdout.trim() : '',
      stderr: typeof result.stderr === 'string' ? result.stderr.trim() : '',
      outcome: 'timed-out',
    };
  }
  return {
    exitCode: result.status,
    stdout: typeof result.stdout === 'string' ? result.stdout.trim() : '',
    stderr: typeof result.stderr === 'string' ? result.stderr.trim() : '',
    outcome: 'ran',
  };
}

/** dispatchHookEntry 的产出:执行观察 + 旧终态层投影 + 事件层精确档。 */
interface DispatchedHook {
  result: HookExecResult;
  /** 旧终态层(cancelled 投影为 result_unknown)—— 呈现侧完成判定继续走这一层 */
  state: HookTerminalState;
  /** 事件层精确档(cancelled → 'Cancelled') */
  outcome: HookRunOutcome;
}

/**
 * 单条钩子的**派发收口**(G-424):started 事件 → 执行 → 终态分类 → terminal 事件。
 * 全部 run* 入口(pre/postToolCall、sessionStart/End、runHook)都只经这一个函数派发,
 * "每条派发的钩子恰好一对 started/terminal"由结构保证,不靠各调用点自觉。
 *
 * parentSignal 非空时经 linkAbortSignal 并入本条时限(父级取消 ∪ 兜底时限),用毕立即
 * dispose;原生 timeout 仍是主杀机制,link 到时只兜底(HOOK_ABORT_BACKSTOP_MS)。
 * matchTool 过滤掉的条目**不算派发**:不执行也不发事件 —— 事件流计的就是真跑过的钩子。
 */
function dispatchHookEntry(
  hookEvent: string,
  entry: HookEntry,
  env: Record<string, string>,
  blockOnError: boolean,
  parentSignal?: AbortSignal,
): DispatchedHook {
  emitHookRunEvent({ type: 'started', hookEvent, hook: entry.name });
  const link =
    parentSignal === undefined
      ? undefined
      : linkAbortSignal(parentSignal, (entry.timeout ?? 10_000) + HOOK_ABORT_BACKSTOP_MS);
  let result: HookExecResult;
  try {
    result = runHookEntry(entry, env, link?.signal);
  } finally {
    link?.dispose();
  }
  const state = classifyHookTerminal(result.outcome, result.exitCode, blockOnError);
  const outcome = runOutcomeOfExec(result, blockOnError);
  emitHookRunEvent({
    type: 'terminal',
    hookEvent,
    hook: entry.name,
    outcome,
    exitCode: result.exitCode,
  });
  return { result, state, outcome };
}

/** 钩子文本(阻断 reason 与回传 feedback 共用的**唯一**上限常量,上一票立的原样保留)。 */
export const HOOK_REASON_MAX_CHARS = 4000

/**
 * 钩子文本进任何外部面(TUI / 模型上下文 / 日志)前的**唯一**成形出口:
 * 脱敏(redactCrashText)→ 中和宿主保留标签(neutralizeBoundaries)→ 按码点截断
 * (HOOK_REASON_MAX_CHARS,超长留 `[已截断 N 个码点]`)。
 * 顺序固定不可翻转:先截后盖会把凭据切成半截、形状不再成立(§5e/守门 144 原话);
 * 截断必须留痕 —— 静默变短等于伪造完整性(AGENTS §30)。
 * 阻断 reason 与回传 feedback **共用这一个函数与这一个上限常量**,不得各写一份。
 */
function redactThenClip(raw: string): string {
  const redacted = neutralizeBoundaries(redactCrashText(raw));
  const cps = Array.from(redacted);
  return cps.length <= HOOK_REASON_MAX_CHARS
    ? redacted
    : `${cps.slice(0, HOOK_REASON_MAX_CHARS).join('')}…[已截断 ${cps.length - HOOK_REASON_MAX_CHARS} 个码点]`;
}

/**
 * 钩子阻断理由的**唯一**成形出口。
 *
 * 钩子的 stdout/stderr 是用户脚本产生的、我们控制不了的文本,而 `reason` 会同时进 TUI 与模型
 * 上下文(并随对话历史长期落库)。脚本里一句 `curl -H "Authorization: Bearer $TOKEN"` 失败,
 * 原文就把凭据送进了会话 —— 上面 `buildFilteredEnv` 只管住了**环境**侧(钩子进程看不到我们的
 * key),管不住**输出**侧这一路。
 *
 * 脱敏唯一出口 = `redactCrashText`(packages/shared/src/utils/redact.ts,端内不得再建第二套,
 * 守门 144 的 V3 判「声明处 ≤ 1」);截断唯一实现 = `redactThenClip`(与回传通道共用)。
 */
export function hookBlockReason(
  label: string,
  r: { exitCode: number; stdout: string; stderr: string },
): string {
  return `${label}: ${redactThenClip(r.stderr || r.stdout || `exit ${r.exitCode}`)}`;
}

/** feedback 行的稳定前缀与"来源不可信"标注(机器码,不依赖语言包)。 */
export const HOOK_FEEDBACK_LINE_PREFIX = 'hook-feedback v1';
export const HOOK_FEEDBACK_UNTRUSTED_ORIGIN = 'untrusted-hook-output';

export interface HookFeedbackInput {
  /** 所属事件名(内部枚举,但仍按外部文本处理) */
  event: string;
  /** 该条钩子的终态 —— 回传给模型/上层做决策的就是它,不靠正文自述 */
  state: HookTerminalState;
  hookName?: string;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  /** 无执行结果可引用时的替代正文(如 runHook 外层异常) */
  note?: string;
}

/**
 * 回传通道的唯一出口:把一条钩子执行成形为一行**可进模型上下文**的反馈。
 * 三条硬约束都在实现里,不在调用方的自觉里:
 *  ① 内容必过唯一脱敏出口(redactThenClip 内的 redactCrashText);
 *  ② 长度上限 = 同一个 HOOK_REASON_MAX_CHARS、同一份截断实现(截掉的码点数可见);
 *  ③ 来源标注为不可信 + 保留标签已中和(钩子 stdout 是注入面)。
 * 顺序 ①脱敏 → 中和 → ②截断 由 redactThenClip 一处保证。
 */
export function buildHookFeedback(input: HookFeedbackInput): string {
  const res = { stdout: input.stdout ?? '', stderr: input.stderr ?? '', exitCode: input.exitCode ?? -1 };
  const raw = input.note ?? (res.stderr || res.stdout || `exit ${res.exitCode}`);
  const hook = input.hookName === undefined ? '-' : redactThenClip(input.hookName);
  return (
    `${HOOK_FEEDBACK_LINE_PREFIX} | hook=${hook} | event=${redactThenClip(input.event)}` +
    ` | state=${input.state} | origin=${HOOK_FEEDBACK_UNTRUSTED_ORIGIN}` +
    ` | exit=${res.exitCode} | body=${redactThenClip(raw)}`
  );
}

/** 批次累积的 feedback 行 → HookResult.feedback(没有非成功态时保持 undefined,旧形状不变)。 */
function joinHookFeedback(lines: string[]): string | undefined {
  return lines.length === 0 ? undefined : lines.join('\n');
}

/** 单条执行结果 → 该条的 feedback 行(event 由调用方传,与阻断标签同源)。 */
function feedbackForEntry(
  event: string,
  entry: HookEntry,
  state: HookTerminalState,
  r: HookExecResult,
): string {
  return buildHookFeedback({
    event,
    hookName: entry.name,
    state,
    exitCode: r.exitCode,
    stdout: r.stdout,
    stderr: r.stderr,
  });
}

export function runPreToolCall(toolName: string, input: unknown, signal?: AbortSignal): HookResult {
  const config = loadHooks();
  const hooks = config.preToolCall ?? [];
  const feedbackLines: string[] = [];
  let worst: HookTerminalState = 'succeeded';
  for (const entry of hooks) {
    if (!matchesTool(entry, toolName)) continue;
    const blockOnError = entry.blockOnError ?? true;
    const { result: r, state } = dispatchHookEntry(
      'preToolCall',
      entry,
      {
        IHUI_HOOK_TYPE: 'preToolCall',
        IHUI_TOOL: toolName,
        IHUI_TOOL_INPUT: JSON.stringify(input ?? {}),
      },
      blockOnError,
      signal,
    );
    if (state !== 'succeeded') {
      worst = worseTerminal(worst, state);
      feedbackLines.push(feedbackForEntry('preToolCall', entry, state, r));
    }
    // 阻断条件逐字保持改动前的 `blockOnError && exitCode !== 0`(proceed 语义零变化);
    // 拆的只是"被阻断之外,剩下几种结束法不得再共用一个 proceed=true"。
    if (blockOnError && r.exitCode !== 0) {
      return {
        proceed: false,
        terminal: state,
        reason: hookBlockReason(`钩子 "${entry.name}" 阻断`, r),
        feedback: joinHookFeedback(feedbackLines),
      };
    }
    // 取消打断(G-424):父级已取消,余下条目不再派发 —— 不再等每条的完整超时。
    if (signal?.aborted) break;
  }
  return { proceed: true, terminal: worst, feedback: joinHookFeedback(feedbackLines) };
}

// ============================================================================
// PermissionRequest 应答面(G-916424):确认窗弹出前钩子可产出 deny/allow/ask/modify。
// ============================================================================

/**
 * 四形状应答的合并严重度。上游只钉了 deny>ask>allow(output.ts:145-152);
 * modify 插在 ask 与 allow 之间:它要过"改后重判"(可能仍回人工窗),比
 * "无条件放行"保守、比"交给人"激进 —— 多钩子分歧时取最保守者。
 */
const PERMISSION_DECISION_SEVERITY: Readonly<Record<PermissionHookDecision, number>> = {
  deny: 4,
  ask: 3,
  modify: 2,
  allow: 1,
};

/** 应答解析产出:ok=识别到合法应答;error=残缺应答的原因(按"无应答"处理前先喊出来)。 */
type ParsedPermissionAnswer =
  | { ok: true; decision: PermissionHookDecision; reason?: string; modifiedInput?: Record<string, unknown> }
  | { ok: false; error?: string };

/**
 * 应答协议的**唯一**解析出口:钩子 stdout = JSON,形如
 *   {"decision":"deny"} / {"decision":"allow"} / {"decision":"ask"}
 *   {"decision":"modify","modifiedInput":{...}}
 * deny 是输出协议(与上游 hooks/output.ts 同名能力对齐),不是退出码语义:
 * 非零退出/超时/没跑到**永远**不产生应答(三态不混流 —— 失败折成 deny 会把
 * "钩子坏了"变成"钩子说不",折成 allow 则更糟)。
 */
function parsePermissionAnswer(stdout: string): ParsedPermissionAnswer {
  const parsed = tryParseJson(stdout);
  if (!isRecord(parsed)) {
    return { ok: false, error: 'stdout 不是 JSON 对象,permissionRequest 应答不可解析,按无应答处理' };
  }
  const decision = parsed.decision;
  if (decision !== 'deny' && decision !== 'allow' && decision !== 'ask' && decision !== 'modify') {
    return { ok: false, error: 'decision 不在 deny/allow/ask/modify 闭集内,按无应答处理' };
  }
  if (decision === 'modify') {
    const modified = parsed.modifiedInput;
    if (!isRecord(modified)) {
      // 残缺的 modify 不能猜成 allow/deny:改写意图无处承载,按无应答处理并留痕。
      return { ok: false, error: 'decision=modify 但 modifiedInput 不是对象,按无应答处理' };
    }
    return { ok: true, decision, ...(typeof parsed.reason === 'string' ? { reason: parsed.reason } : {}), modifiedInput: modified };
  }
  return { ok: true, decision, ...(typeof parsed.reason === 'string' ? { reason: parsed.reason } : {}) };
}

/**
 * 确认窗的钩子应答出口(G-916424):派发 permissionRequest 事件,解析四形状应答,
 * 多钩子分歧按 PERMISSION_DECISION_SEVERITY 取最保守者。
 *
 * 与 runPreToolCall 的关键差异:
 *  - blockOnError **默认 false**(失败/超时只进 terminal/feedback 遥测,不阻断主流程,
 *    也不产生任何应答 —— 调用方落回人工窗;三态不混流);
 *  - 应答只从**成功退出**(state=succeeded)的 stdout JSON 解析;其余一律不产生应答。
 */
export interface RunPermissionRequestOptions {
  signal?: AbortSignal;
}

export function runPermissionRequest(
  toolName: string,
  input: unknown,
  options?: RunPermissionRequestOptions,
): HookResult {
  const signal = options?.signal;
  try {
    const config = loadHooks();
    const hooks = config.permissionRequest ?? [];
    const env = buildHookEnv('permissionRequest', { toolName, toolArgs: input });
    const feedbackLines: string[] = [];
    let worst: HookTerminalState = 'succeeded';
    let best:
      | { decision: PermissionHookDecision; reason?: string; modifiedInput?: Record<string, unknown>; source: string }
      | undefined;
    for (const entry of hooks) {
      if (!matchesTool(entry, toolName)) continue;
      const blockOnError = entry.blockOnError ?? false;
      const { result: r, state } = dispatchHookEntry('permissionRequest', entry, env, blockOnError, signal);
      if (state !== 'succeeded') {
        worst = worseTerminal(worst, state);
        feedbackLines.push(feedbackForEntry('permissionRequest', entry, state, r));
      }
      if (blockOnError && r.exitCode !== 0) {
        return {
          proceed: false,
          terminal: state,
          reason: hookBlockReason(`permissionRequest 钩子 "${entry.name}" 阻断`, r),
          feedback: joinHookFeedback(feedbackLines),
        };
      }
      if (state === 'succeeded' && r.exitCode === 0 && r.stdout !== '') {
        const parsed = parsePermissionAnswer(r.stdout);
        if (parsed.ok) {
          if (!best || PERMISSION_DECISION_SEVERITY[parsed.decision] > PERMISSION_DECISION_SEVERITY[best.decision]) {
            best = {
              decision: parsed.decision,
              // 钩子文本进错误/模型上下文前过唯一成形出口(脱敏→中和→截断),与阻断 reason 同规。
              ...(parsed.reason !== undefined ? { reason: redactThenClip(parsed.reason) } : {}),
              ...(parsed.modifiedInput !== undefined ? { modifiedInput: parsed.modifiedInput } : {}),
              source: entry.name,
            };
          }
        } else if (parsed.error) {
          // 残缺应答不静默丢弃(§30 精神):喊在 feedback 上,但不折叠成任何形状的应答。
          feedbackLines.push(
            buildHookFeedback({ event: 'permissionRequest', hookName: entry.name, state: 'succeeded', note: parsed.error }),
          );
        }
      }
      if (signal?.aborted) break;
    }
    return {
      proceed: true,
      terminal: worst,
      feedback: joinHookFeedback(feedbackLines),
      ...(best
        ? {
            permission: best.decision,
            permissionSource: best.source,
            ...(best.reason !== undefined ? { reason: best.reason } : {}),
            ...(best.modifiedInput !== undefined ? { modifiedInput: best.modifiedInput } : {}),
          }
        : {}),
    };
  } catch (err) {
    // 与 runHook 同一收口姿势:proceed 语义不因执行链故障多拦一次,但终态必须落
    // result_unknown 并被喊出来 —— 无应答 ⇒ 调用方落回人工窗,绝不折成 deny/allow。
    const note = err instanceof Error ? err.message : String(err);
    const fb = buildHookFeedback({ event: 'permissionRequest', state: 'result_unknown', note });
    warnOnce(`⚠ runPermissionRequest 在执行链中断,未取到最终结果(${describeHookTerminal('result_unknown')}):${fb}`);
    return { proceed: true, terminal: 'result_unknown', feedback: fb };
  }
}

export function runPostToolCall(toolName: string, output: unknown, signal?: AbortSignal): HookResult {
  const config = loadHooks();
  const hooks = config.postToolCall ?? [];
  const feedbackLines: string[] = [];
  let worst: HookTerminalState = 'succeeded';
  for (const entry of hooks) {
    if (!matchesTool(entry, toolName)) continue;
    const blockOnError = entry.blockOnError ?? false;
    const { result: r, state } = dispatchHookEntry(
      'postToolCall',
      entry,
      {
        IHUI_HOOK_TYPE: 'postToolCall',
        IHUI_TOOL: toolName,
        IHUI_TOOL_OUTPUT: JSON.stringify(output ?? {}),
      },
      blockOnError,
      signal,
    );
    if (state !== 'succeeded') {
      worst = worseTerminal(worst, state);
      feedbackLines.push(feedbackForEntry('postToolCall', entry, state, r));
    }
    if (blockOnError && r.exitCode !== 0) {
      return {
        proceed: false,
        terminal: state,
        reason: hookBlockReason(`postToolCall 钩子 "${entry.name}" 阻断`, r),
        feedback: joinHookFeedback(feedbackLines),
      };
    }
    if (signal?.aborted) break;
  }
  return { proceed: true, terminal: worst, feedback: joinHookFeedback(feedbackLines) };
}

export function runSessionStartHooks(config: HooksConfig | null, ctx: SessionHookContext, signal?: AbortSignal): HookResult {
  if (!config?.sessionStart) return { proceed: true };
  const feedbackLines: string[] = [];
  let worst: HookTerminalState = 'succeeded';
  for (const entry of config.sessionStart) {
    const blockOnError = entry.blockOnError ?? true;
    const { result: r, state } = dispatchHookEntry(
      'sessionStart',
      entry,
      {
        IHUI_HOOK_TYPE: 'sessionStart',
        IHUI_WORKSPACE: ctx.workspacePath,
        IHUI_SESSION_ID: ctx.sessionId ?? '',
      },
      blockOnError,
      signal,
    );
    if (state !== 'succeeded') {
      worst = worseTerminal(worst, state);
      feedbackLines.push(feedbackForEntry('sessionStart', entry, state, r));
    }
    if (blockOnError && r.exitCode !== 0) {
      return {
        proceed: false,
        terminal: state,
        reason: hookBlockReason(`sessionStart 钩子 "${entry.name}" 阻断`, r),
        feedback: joinHookFeedback(feedbackLines),
      };
    }
    if (signal?.aborted) break;
  }
  return { proceed: true, terminal: worst, feedback: joinHookFeedback(feedbackLines) };
}

export function runSessionEndHooks(config: HooksConfig | null, ctx: SessionHookContext, signal?: AbortSignal): void {
  if (!config?.sessionEnd) return;
  for (const entry of config.sessionEnd) {
    try {
      const blockOnError = entry.blockOnError ?? false;
      const { result: r, state } = dispatchHookEntry(
        'sessionEnd',
        entry,
        {
          IHUI_HOOK_TYPE: 'sessionEnd',
          IHUI_WORKSPACE: ctx.workspacePath,
          IHUI_SESSION_ID: ctx.sessionId ?? '',
        },
        blockOnError,
        signal,
      );
      if (state !== 'succeeded') {
        // sessionEnd 今天没有返回面 —— 终态只能喊在 stderr 上,静默吞掉正是 §30 那一型。
        warnOnce(
          `⚠ sessionEnd 钩子 "${entry.name}" 终态=${describeHookTerminal(state)},未被执行成功:` +
            ` ${feedbackForEntry('sessionEnd', entry, state, r)}`,
        );
      }
      if (signal?.aborted) break;
    } catch (err) {
      // sessionEnd 失败不阻塞退出,但"没取到结果"必须落一个明确终态并喊出来。
      const note = err instanceof Error ? err.message : String(err);
      warnOnce(
        `⚠ sessionEnd 钩子 "${entry.name}" 未取到最终结果(hook-state:result-unknown-not-complete,` +
          `这不是"完成"): ${buildHookFeedback({ event: 'sessionEnd', hookName: entry.name, state: 'result_unknown', note })}`,
      );
    }
  }
}

const TOOL_EVENTS: ReadonlySet<HookEvent> = new Set(['preToolCall', 'postToolCall', 'postToolUseFailure']);

function isToolEvent(event: HookEvent): boolean {
  return TOOL_EVENTS.has(event);
}

function defaultBlockOnError(event: HookEvent): boolean {
  return event === 'preToolCall' || event === 'sessionStart';
}

function buildHookEnv(event: HookEvent, ctx: HookContext): Record<string, string> {
  const env: Record<string, string> = { IHUI_HOOK_TYPE: event };
  if (ctx.workspacePath !== undefined) env.IHUI_WORKSPACE = ctx.workspacePath;
  if (ctx.sessionId !== undefined) env.IHUI_SESSION_ID = ctx.sessionId;
  if (ctx.toolName !== undefined) env.IHUI_TOOL = ctx.toolName;
  if (ctx.toolArgs !== undefined) env.IHUI_TOOL_INPUT = JSON.stringify(ctx.toolArgs ?? {});
  if (ctx.toolResult !== undefined) env.IHUI_TOOL_OUTPUT = JSON.stringify(ctx.toolResult ?? {});
  if (ctx.prompt !== undefined) env.IHUI_PROMPT = ctx.prompt;
  if (ctx.error !== undefined) env.IHUI_ERROR = ctx.error;
  if (ctx.reason !== undefined) env.IHUI_REASON = ctx.reason;
  if (ctx.subagentId !== undefined) env.IHUI_SUBAGENT_ID = ctx.subagentId;
  if (ctx.subagentType !== undefined) env.IHUI_SUBAGENT_TYPE = ctx.subagentType;
  if (ctx.compactedTokensBefore !== undefined) env.IHUI_COMPACTED_TOKENS_BEFORE = String(ctx.compactedTokensBefore);
  if (ctx.compactedTokensAfter !== undefined) env.IHUI_COMPACTED_TOKENS_AFTER = String(ctx.compactedTokensAfter);
  if (ctx.notificationText !== undefined) env.IHUI_NOTIFICATION_TEXT = ctx.notificationText;
  // P2-4 Turn 级事件字段
  if (ctx.turnNumber !== undefined) env.IHUI_TURN_NUMBER = String(ctx.turnNumber);
  if (ctx.maxTurns !== undefined) env.IHUI_MAX_TURNS = String(ctx.maxTurns);
  if (ctx.totalTurns !== undefined) env.IHUI_TOTAL_TURNS = String(ctx.totalTurns);
  if (ctx.stopReason !== undefined) env.IHUI_STOP_REASON = ctx.stopReason;
  return env;
}

/**
 * 通用 hook 分发:按事件类型加载对应配置并执行所有匹配的钩子。
 * 钩子失败时按 blockOnError 决定是否阻断(默认 preToolCall/sessionStart 阻断,其余仅通知)。
 * 任何异常均吞掉返回 proceed=true,确保 hook 故障不影响主流程 —— 但"吞掉"不再等于
 * "渲染成完成":外层异常与"条目没载体"都落 result_unknown,并同时喊在 stderr 与
 * feedback 行上(§30"钩子无终态不得渲染成'完成'"的落点)。
 */
/** runHook 的可选面(G-424):父级取消信号从这里进,逐条经 linkAbortSignal 并入时限。 */
export interface RunHookOptions {
  /** 父级取消信号:取消后余下条目不再派发,被打断的钩子落事件层 'Cancelled'。 */
  signal?: AbortSignal;
}

export function runHook(event: HookEvent, ctx: HookContext, options?: RunHookOptions): HookResult {
  const signal = options?.signal;
  try {
    const config = loadHooks();
    const hooks = config[event] ?? [];
    const env = buildHookEnv(event, ctx);
    const feedbackLines: string[] = [];
    let worst: HookTerminalState = 'succeeded';
    for (const entry of hooks) {
      if (isToolEvent(event) && ctx.toolName && !matchesTool(entry, ctx.toolName)) continue;
      const blockOnError = entry.blockOnError ?? defaultBlockOnError(event);
      const { result: r, state } = dispatchHookEntry(event, entry, env, blockOnError, signal);
      if (state !== 'succeeded') {
        worst = worseTerminal(worst, state);
        feedbackLines.push(feedbackForEntry(event, entry, state, r));
      }
      // 阻断条件与改动前逐字同形(blockOnError && 非零退出 ⇒ proceed=false)。
      if (blockOnError && r.exitCode !== 0) {
        return {
          proceed: false,
          terminal: state,
          reason: hookBlockReason(`${event} 钩子 "${entry.name}" 阻断`, r),
          feedback: joinHookFeedback(feedbackLines),
        };
      }
      // 取消打断(G-424):同 runPreToolCall。
      if (signal?.aborted) break;
    }
    return { proceed: true, terminal: worst, feedback: joinHookFeedback(feedbackLines) };
  } catch (err) {
    // 旧写法在这里返回 {proceed:true} 后什么都不留 —— "跑没跑过"整格消失,正是本票的立点。
    // proceed 语义保持 true(不因此多拦一次),但终态必须落 result_unknown 并被喊出来。
    const note = err instanceof Error ? err.message : String(err);
    const fb = buildHookFeedback({ event, state: 'result_unknown', note });
    warnOnce(`⚠ runHook(${event}) 在执行链中断,未取到最终结果(${describeHookTerminal('result_unknown')}):${fb}`);
    return { proceed: true, terminal: 'result_unknown', feedback: fb };
  }
}

// ============================================================================
// Hooks 目录自动发现(Wave 3 W3-4,2026-07-22 立)
// re-export discovery.ts 作为统一入口,供 commands/hooks.ts enable/disable 使用
// 完整沙箱执行见 commands/hooks-auto.ts(registerHooksAutoCommand)
// ============================================================================
export {
  discoverHooks,
  listDiscoveredHooks,
  enableHook,
  disableHook,
  getHooksDirs,
  type DiscoveredHook,
  type DiscoveredHookType,
} from './discovery.js';
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
