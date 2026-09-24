// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 任务进度状态行 —— CLI 端渲染层(薄)。
 *
 * 单一真相源:所有数值(步骤 X/Y、百分比、变更文件数、+x/-y 行)一律由
 * `@ihui/shared/chat` 的 `deriveTaskStatusBar` 推导,端内**不得**自行数步骤 / 算百分比 /
 * 统计增删行。本文件只做三件事:① 攒输入(plan 步骤 + 工具调用) ② 把视图模型格式化成一行
 * ③ 决定何时输出。
 *
 * ============ 重绘方案选型(重要,勿轻易改成原地重绘) ============
 * CLI 聊天 REPL 用 Node `readline`(`repl.ts` createInterface),不是 ink 那类受控渲染宿主。
 * 结论:**采用「状态变化时在输出流里追加一行」,不做原地清行重绘**。原因三条:
 * 1. readline 没有"最后一行归谁"的概念:提示符行 / 用户正在输入的文本 / 流式 markdown 正文
 *    都可能在当前行。`\r\x1b[K` 会擦掉刚输出的正文行或用户输入,属于任务书明令禁止的破坏。
 * 2. 想安全地"只重画状态行、光标不动",必须读 `rl.cursor` / 调 `rl._refreshLine()` 这类
 *    **未公开私有 API**(Node 无兼容性承诺,且 CJK 宽字符列对齐还要自行补偿),风险大于收益。
 * 3. 数据源频率本就低:`plan_updated` / 工具调用起止是离散事件(不是每 token),
 *    加上下面的「相邻同文本去重」,一轮对话通常只落 3~8 行,不构成刷屏。
 *
 * 非 TTY(管道 / CI)下完全不输出状态行,避免把 ANSI chrome 灌进日志。
 * 空闲(derive 返回 null 或"无可说内容")时不输出任何行,也不留空行占位。
 *
 * 图标:遵循 AGENTS.md §4,终端 UI 位不用 emoji。此处只用几何字符 `▰▱`(与既有
 * `tasks.ts` 进度条同一视觉语言)与 `·` 分隔符 + ANSI 颜色表达状态语义。
 */
import chalk from 'chalk';
import type {
  StreamChatOptions,
  InjectionAppliedEvent,
  RetryScheduledEvent,
  SteerEvent,
  BudgetEvent,
} from '@ihui/api-client';
import type { PlanStep, PlanUpdateEvent } from '@ihui/types/ai';
import type { ToolCall } from '@ihui/types/chat';
import {
  deriveTaskStatusBar,
  describeToolCall,
  formatBudgetNote,
  type BudgetNoteKeys,
  type TaskStatusBarViewModel,
  type TaskStatusKind,
  type ToolCallView,
} from '@ihui/shared/chat';
import { t } from '../i18n/index.js';

/**
 * `PlanUpdateEvent['plan']` 的步骤 id 是可选的(后端 v2 起必发,旧事件可能缺),
 * 而 `PlanStep.id` 必填 —— 这里补索引兜底,顺带把 error 标记原样透传。
 */
export function toPlanSteps(plan: PlanUpdateEvent['plan']): PlanStep[] {
  return plan.map((step, idx) => ({
    id: step.id ?? `step-${idx}`,
    step: step.step,
    status: step.status,
    ...(step.toolCallIds ? { toolCallIds: step.toolCallIds } : {}),
    ...(step.startedAt ? { startedAt: step.startedAt } : {}),
    ...(step.endedAt ? { endedAt: step.endedAt } : {}),
    ...(step.durationMs !== undefined ? { durationMs: step.durationMs } : {}),
    ...(step.tokenUsage !== undefined ? { tokenUsage: step.tokenUsage } : {}),
    ...(step.error === true ? { error: true } : {}),
  }));
}

/** cli 侧观测到的一次工具调用(与 api-client ToolCall 契约同形的最小输入) */
export interface ObservedToolCall {
  toolName: string;
  args: Record<string, unknown>;
}

export interface TaskStatusLineOptions {
  /** 输出流(默认 process.stdout);注入便于单测 */
  write?: (text: string) => void;
  /** 是否允许输出(默认:stdout 为 TTY) */
  enabled?: () => boolean;
  /** 可用列宽(默认 process.stdout.columns),用于截断防换行 */
  columns?: () => number;
}

export interface TaskStatusLine {
  /**
   * 与 api-client `streamChat` 的 `onPlanUpdate?: (event: PlanUpdateEvent) => void` **同签名**,
   * 可直接作为回调传入。REPL 当前拿不到该事件(见 repl.ts 接线处注释),但入口先就位。
   */
  handlePlanUpdate(event: PlanUpdateEvent): void;
  /** 直接注入步骤数组(cli 现有通道:todo_write 清单)。只更新输入,输出由调用方 refresh() */
  setSteps(steps: readonly PlanStep[]): void;
  /** 端侧"此刻在做什么"(如 调用 read_file);null 表示交回 derive 用步骤标题兜底。只更新输入 */
  setCurrentActivity(label: string | null): void;
  /** 工具调用发起(记录 args,供 derive 折叠文件变更)。只更新输入 */
  recordToolCall(call: ObservedToolCall): void;
  /** 工具调用结束(回填 status/result,决定 +x/-y 是否可信)+ 刷新输出 */
  recordToolResult(toolName: string, success: boolean, output: string): void;
  /** 一轮 agent 开始:重置到"流式中" */
  beginTurn(): void;
  /** 一轮 agent 结束:落到终态并刷新最后一行 */
  endTurn(kind?: TaskStatusKind): void;
  /** 当前帧视图模型(测试 / 上层需要时用) */
  viewModel(): TaskStatusBarViewModel | null;
  /** 打印一行流水式交代(注入来源 / 上游重试),不并入可重绘的状态行 */
  noteLine(text: string): void;
  /** 按当前输入刷新输出(相邻同文本自动去重,无内容不输出) */
  refresh(): void;
  /** 丢弃累计状态(如 /clear),不影响下一次 beginTurn */
  reset(): void;
}

const BAR_WIDTH = 10;
const SEPARATOR = ' · ';
/** chalk 的 SGR 序列:计算可视宽度前剔除,不占列 */
const ANSI_SEQUENCE_RE = /\u001b\[[0-9;]*m/g;
/** 宽字符(CJK / 全角 / 假名 / Hangul):终端按 2 列渲染 */
const WIDE_CHAR_RE = /[\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE6F\uFF00-\uFF60\uFFE0-\uFFE6]/;

/** 视图模型 → 一行文本(纯函数,不依赖实例状态,便于单测) */
export function formatTaskStatusLine(vm: TaskStatusBarViewModel): string {
  const parts: string[] = [];
  const title = vm.headline.trim();
  if (title) parts.push(kindColor(vm.kind)(`● ${title}`));
  else parts.push(kindColor(vm.kind)(kindLabel(vm.kind)));

  if (vm.stepTotal > 0) {
    parts.push(`${stepsLabel(vm.stepCurrent, vm.stepTotal)} ${bar(vm.percent)}`);
  }
  if (vm.changedFiles > 0) {
    const stat = [`+${vm.addedLines}`, `-${vm.removedLines}`];
    const line = filesChangedLabel(vm.changedFiles) + (vm.linesKnown ? ` ${stat.join(' ')}` : '');
    parts.push(addedRemovedColor(line, vm));
  }
  return parts.join(SEPARATOR);
}

function bar(percent: number): string {
  const filled = Math.max(0, Math.min(BAR_WIDTH, Math.round((percent / 100) * BAR_WIDTH)));
  return chalk.cyan('▰'.repeat(filled) + '▱'.repeat(BAR_WIDTH - filled)) + ` ${percent}%`;
}

function kindColor(kind: TaskStatusKind): (s: string) => string {
  switch (kind) {
    case 'running':
      return chalk.cyan;
    case 'completed':
      return chalk.green;
    case 'failed':
      return chalk.red;
    case 'interrupted':
      return chalk.yellow;
    default:
      return chalk.dim;
  }
}

function addedRemovedColor(text: string, vm: TaskStatusBarViewModel): string {
  if (!vm.linesKnown) return chalk.dim(text);
  return text.replace(/\+(\d+) -(\d+)/, (_all, plus: string, minus: string) =>
    `${chalk.green(`+${plus}`)} ${chalk.red(`-${minus}`)}`,
  );
}

/**
 * 文案取词:优先走 cli 的 `t()`。
 * 实测 `src/i18n/index.ts` 的 MESSAGES_DIR 固定指向 `packages/i18n/messages/cli`,
 * 而 `taskStatus` 键在 `messages/shared/*`(cli 读不到),且 cli 语言包禁止在本任务内扩充;
 * 故 t() 未命中(返回键名本身)时回落到与 shared 逐字对齐的最小中文。
 * 将来 cli 语言包补上 taskStatus.* 后,这里无需改动即自动跟随翻译。
 */
function label(key: string, fallback: string, params?: Record<string, string | number>): string {
  const fullKey = `taskStatus.${key}`;
  const hit = t(fullKey, params);
  if (hit !== fullKey) return hit;
  return interpolate(fallback, params);
}

function interpolate(text: string, params?: Record<string, string | number>): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (_all, name: string) => String(params[name] ?? `{${name}}`));
}

function stepsLabel(current: number, total: number): string {
  return label('steps', '步骤 {current}/{total}', { current, total });
}

function filesChangedLabel(n: number): string {
  return label('filesChanged', '{n} 个文件已修改', { n });
}

function activityToolLabel(tool: string): string {
  return label('activityTool', '调用 {tool}', { tool });
}

/**
 * 把工具功能名 i18n 键解析为本地化文案。
 * nameKey 命中 → 直接取 `taskStatus.{nameKey}`(shared 已合并进 cli,键可达);
 * nameKey 为 null(插件 / MCP 动态名)→ 回落 `调用 {code}`,这是"取不到映射才回落原码名"
 * 的唯一入口(AGENTS.md §5:CLI 输出禁出现英文码名,但无映射的动态名允许原样呈现)。
 */
function toolNameText(view: ToolCallView): string {
  if (!view.nameKey) return activityToolLabel(view.codeName);
  const hit = t(`taskStatus.${view.nameKey}`);
  return hit === `taskStatus.${view.nameKey}` ? view.codeName : hit;
}

/** 结果度量文本:写类文件用 "+18 -4";读/检索类用 "128 行" / "5 个结果" / "3 个文件";无度量为空串 */
function metricText(view: ToolCallView): string {
  if (view.writesFile) {
    if (view.added < 0 && view.removed < 0) return '';
    return `${label('addedCount', '+{n}', { n: Math.max(0, view.added) })} ${label(
      'removedCount',
      '-{n}',
      { n: Math.max(0, view.removed) },
    )}`;
  }
  if (view.metricValue === null) return '';
  const unitKey =
    view.metricKind === 'lines'
      ? 'unitLines'
      : view.metricKind === 'files'
        ? 'unitFiles'
        : view.metricKind === 'results'
          ? 'unitResults'
          : '';
  if (!unitKey) return '';
  const fallback =
    view.metricKind === 'lines' ? '{n} 行' : view.metricKind === 'files' ? '{n} 个文件' : '{n} 个结果';
  return label(unitKey, fallback, { n: view.metricValue });
}

/** CLI 一次工具调用的活动行三段(功能名 / 对象 / 度量),纯函数便于单测。*/
export interface ToolActivityLineParts {
  title: string;
  subject: string;
  metric: string;
}

export function describeToolActivityLine(input: {
  toolName: string;
  args?: Record<string, unknown> | null;
  result?: unknown;
  status?: string;
}): ToolActivityLineParts {
  const view = describeToolCall(input);
  return { title: toolNameText(view), subject: view.subject, metric: metricText(view) };
}

function kindLabel(kind: TaskStatusKind): string {
  switch (kind) {
    case 'running':
      return label('activityRunning', '执行中');
    case 'completed':
      return '已完成';
    case 'failed':
      return '失败';
    case 'interrupted':
      return '已中断';
    default:
      return label('idle', '空闲');
  }
}

/** 单个码位占几列(宽字符 2 列,其余 1 列) */
function charWidth(char: string): number {
  return WIDE_CHAR_RE.test(char) ? 2 : 1;
}

/** 去掉 ANSI 序列后的可视宽度(CJK 记 2 列,用于截断防换行) */
function visibleWidth(text: string): number {
  const plain = text.replace(ANSI_SEQUENCE_RE, '');
  let width = 0;
  for (const char of plain) {
    width += charWidth(char);
  }
  return width;
}

/** 按可视宽度截断,并保证 ANSI 转义序列不被从中间切断 */
function truncate(text: string, maxWidth: number): string {
  if (visibleWidth(text) <= maxWidth) return text;
  let out = '';
  let width = 0;
  let i = 0;
  while (i < text.length) {
    if (text[i] === '\u001b') {
      const end = text.indexOf('m', i);
      if (end === -1) break;
      out += text.slice(i, end + 1);
      i = end + 1;
      continue;
    }
    const char = text[i] ?? '';
    const w = charWidth(char);
    if (width + w > maxWidth - 1) break;
    out += char;
    width += w;
    i += char.length;
  }
  return `${out}…`;
}

export function createTaskStatusLine(opts: TaskStatusLineOptions = {}): TaskStatusLine {
  const write = opts.write ?? ((text: string) => process.stdout.write(text));
  const isOn = opts.enabled ?? (() => process.stdout.isTTY === true);
  const columnsOf = opts.columns ?? (() => process.stdout.columns ?? 80);

  let steps: PlanStep[] = [];
  let toolCalls: ToolCall[] = [];
  let currentTaskLabel: string | null = null;
  let streaming = false;
  let overviewStatus: TaskStatusKind | undefined;
  let lastText: string | null = null;

  const snapshot = (): TaskStatusBarViewModel | null =>
    deriveTaskStatusBar({
      planSteps: steps,
      toolCalls,
      isStreaming: streaming,
      ...(currentTaskLabel ? { currentTaskLabel } : {}),
      ...(overviewStatus ? { overviewStatus } : {}),
    });

  const api: TaskStatusLine = {
    handlePlanUpdate(event) {
      steps = toPlanSteps(event.plan);
      api.refresh();
    },
    setSteps(next) {
      steps = [...next];
    },
    setCurrentActivity(labelText) {
      currentTaskLabel = labelText;
    },
    recordToolCall(call) {
      toolCalls.push({
        id: `cli-${toolCalls.length + 1}`,
        toolName: call.toolName,
        args: call.args,
        status: 'running',
      });
    },
    recordToolResult(toolName, success, output) {
      // 与 repl 的工具卡片同步:回填最近一个同名且未落终态的调用
      for (let i = toolCalls.length - 1; i >= 0; i--) {
        const call = toolCalls[i];
        if (!call || call.toolName !== toolName || call.status !== 'running') continue;
        toolCalls[i] = {
          ...call,
          status: success ? 'success' : 'error',
          result: output,
          ...(success ? {} : { error: output.slice(0, 200) }),
        };
        break;
      }
      currentTaskLabel = null;
      api.refresh();
    },
    beginTurn() {
      steps = [];
      toolCalls = [];
      currentTaskLabel = null;
      overviewStatus = undefined;
      streaming = true;
      lastText = null;
    },
    endTurn(kind) {
      streaming = false;
      currentTaskLabel = null;
      if (kind && kind !== 'idle' && kind !== 'running') overviewStatus = kind;
      api.refresh();
    },
    viewModel() {
      return snapshot();
    },
    noteLine(text) {
      if (!isOn()) return;
      const one = truncate(text.replace(/\s+/gu, ' ').trim(), Math.max(20, columnsOf() - 1));
      if (!one) return;
      write(`${one}\n`);
    },
    refresh() {
      if (!isOn()) return;
      const vm = snapshot();
      // 空闲(derive 返回 null)→ 不打印任何行,也不打空行占位
      if (!vm) return;
      // 流式刚开始、既无步骤也无文件变更又不知在做什么 —— 没话可说,继续静默
      if (!vm.hasDetail && !vm.headline.trim()) return;
      const text = truncate(formatTaskStatusLine(vm), Math.max(20, columnsOf() - 1));
      if (text === lastText) return;
      lastText = text;
      write(`${text}\n`);
    },
    reset() {
      steps = [];
      toolCalls = [];
      currentTaskLabel = null;
      streaming = false;
      overviewStatus = undefined;
      lastText = null;
    },
  };

  return api;
}

/**
 * 供 repl 复用的"此刻在做什么"文案 —— 活动行语言:功能名 · 对象 · 度量。
 * 经共享层 describeToolCall 取真实功能名,禁止直显英文码名(仅无映射的动态名回落)。
 * args 缺省时(只有码名)只显示功能名,不硬凑对象。
 */
export function toolActivityLabel(
  toolName: string,
  args?: Record<string, unknown> | null,
): string {
  const { title, subject, metric } = describeToolActivityLine({ toolName, args });
  return [title, subject, metric].filter((part) => part !== '').join(' · ');
}

/**
 * 编译期签名对齐证明:把状态行的 handlePlanUpdate 适配成 api-client
 * `streamChat` 的 `onPlanUpdate` 回调类型。agent.ts 一旦在 RunToolLoopOptions 上透传该回调,
 * REPL 侧直接 `onPlanUpdate: asPlanUpdateSink(state.statusLine)` 即可,无需再改本文件。
 */
/**
 * D34 上下文注入交代(kind → cli 取词键)。
 * kind 才是取词键,**禁止**把后端 `collapsed` 中文当界面文本 —— 它只在未知 kind /
 * auto_context 未给段数时兜底(与 web / 小程序 / RN 同一条纪律)。
 */
const INJECTION_SOURCE_KEYS: Record<string, string> = {
  developer_instructions: 'cli.injectionSrcDeveloper',
  workspace_memory: 'cli.injectionSrcWorkspace',
  repo_wiki: 'cli.injectionSrcRepoWiki',
};

export function injectionNoteText(event: InjectionAppliedEvent): string {
  let label: string;
  if (event.kind === 'auto_context' && typeof event.count === 'number') {
    label = t('cli.injectionSrcAutoContext', { count: event.count });
  } else {
    const sourceKey = INJECTION_SOURCE_KEYS[event.kind];
    label = sourceKey ? t(sourceKey) : event.collapsed;
  }
  return t('cli.injectionApplied', { sources: label });
}

/** D39 重试交代:retryInMs=0 是"换 key 立即重试",措辞不得写"0 秒后继续"这种假精确 */
/**
 * G-153(WorkBuddy 一手对标):权限档必须交代**后果**,只报档名等于让用户盲选。
 * 未知档返回空串(调用方据此不打印) —— 不给一个回显键名的假说明。
 */
const PERM_NOTE_KEYS: Record<string, string> = {
  default: 'cli.permNoteDefault',
  plan: 'cli.permNotePlan',
  acceptEdits: 'cli.permNoteAcceptEdits',
  bypassPermissions: 'cli.permNoteBypass',
  manual: 'cli.permNoteManual',
};

export function permissionModeNote(mode: string): string {
  const key = PERM_NOTE_KEYS[mode];
  return key ? t(key) : '';
}

/**
 * #11 引用溯源的终端一行。source/label 都是**内容**不是界面 chrome,故原样列出;
 * 界面措辞(前缀"参考来源:")仍出自 cli.citationSources 词表,不写死中文。
 */
export function citationNoteText(items: readonly { source: string; label: string }[]): string {
  return t('cli.citationSources', {
    sources: items.map((x) => `${x.label}(${x.source})`).join(' · '),
  });
}

/**
 * D106 引导交代(steer):用户中途注入的引导文本被 ai-service 写入 messages 后,
 * 后端下发 steer SSE 帧,终端一行交代"引导已生效"(对齐 web 端消息 badge 语义)。
 * 纪律:
 *  - 空文本 / 纯空白 → 返回空串,调用方据此不打印(与 citationNoteText 空列表不打印同型);
 *  - phase 仅 'injected' 一种,未知 phase 不渲染(防御后端扩展新 phase 时终端误报);
 *  - timestamp/messageId 按类型承接但单行交代不渲染(web 用 messageId 挂 badge,cli 无此位);
 *  - 措辞走 cli.steerApplied 词表(五语言),引导文本 {text} 是内容不是界面 chrome,原样内插。
 */
export function steerNoteText(event: SteerEvent): string {
  const { phase, text } = event;
  if (phase !== 'injected') return '';
  const trimmed = text.trim();
  if (!trimmed) return '';
  return t('cli.steerApplied', { text: trimmed });
}

export function retryNoteText(event: RetryScheduledEvent): string {
  return event.retryInMs > 0
    ? t('cli.retryScheduled', {
        attempt: event.attempt,
        max: event.maxRetries,
        seconds: Math.round(event.retryInMs / 1000),
      })
    : t('cli.retryScheduledNow', { attempt: event.attempt, max: event.maxRetries });
}

/**
 * 额度分档告警(budget)的终端一行。网关 checkTokenBudget 在流首下发:
 * 80%≤用量<95% 为 warning、95%≤用量<100% 为 critical(≥100% 走 429 BUDGET_EXHAUSTED,
 * 不进本函数)。措辞出自 cli.budget* 词表(五语言)。
 *
 * 装配规则(哪些字段缺就不说、分隔符、token 计数用共享层 K/M 单位)在
 * `@ihui/shared/chat` 的 `formatBudgetNote` —— 本端只给键名与取词函数,不复写规则(AGENTS §3)。
 */
const CLI_BUDGET_KEYS: BudgetNoteKeys = {
  note: 'cli.budgetNote',
  warningTitle: 'cli.budgetWarningTitle',
  criticalTitle: 'cli.budgetCriticalTitle',
  usedTokens: 'cli.budgetUsedTokens',
  resetTomorrow: 'cli.budgetResetTomorrow',
  tier: 'cli.budgetTier',
};

export function budgetNoteText(event: BudgetEvent): string {
  return formatBudgetNote(event, t, CLI_BUDGET_KEYS);
}

export function asPlanUpdateSink(
  line: TaskStatusLine,
): NonNullable<StreamChatOptions['onPlanUpdate']> {
  return (event) => line.handlePlanUpdate(event);
}

/**
 * cli 现有步骤通道:`todo_write` 清单 → PlanStep[]。
 * 状态三态与 PlanStepStatus 前三种取值同名,直接收窄复用。
 */
export function planStepsFromTodos(
  todos: readonly { id: string; content: string; status: 'pending' | 'in_progress' | 'completed' }[],
): PlanStep[] {
  return todos.map((todo) => ({ id: todo.id, step: todo.content, status: todo.status }));
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
