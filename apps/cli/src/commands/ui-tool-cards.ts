/**
 * REPL 工具卡片渲染辅助 — 对标 Claude Code 的工具过程可视化。
 *
 * 职责(纯函数,零依赖,仅 chalk):
 *   - formatToolResultForCard:工具结果卡片显示(截断策略 + 提示)
 *   - colorizeDiffText:unified diff 行级红绿着色
 *   - renderTodoChecklist:todo 勾选列表卡片(/todo 与 todo_write 常驻渲染共用)
 *   - renderPlanStepsCard:结构化计划步骤卡片(PlanStep 视图)
 */
import chalk from 'chalk';
import type { TodoItem } from '../tools/todo-write.js';
import type { PlanStep } from '../plan/structured.js';
import type { ChatMessage } from './session.js';

/** 单次工具调用完整记录(/tool 命令回看用) */
export interface ToolCallRecord {
  /** 调用序号(会话内递增) */
  index: number;
  name: string;
  argsJson: string;
  output: string;
  success: boolean;
  durationMs: number;
}

/** 工具输出卡片默认显示行数(超过则截断并提示 /tool) */
const CARD_MAX_LINES = 4;
/** 单行超长兜底截断(防一行超长输出撑爆终端) */
const CARD_MAX_LINE_CHARS = 240;

/** 疑似 unified diff(用于结果着色判定) */
export function looksLikeDiff(text: string): boolean {
  return /^\+\+\+ |^--- a\//m.test(text) || /^@@ -\d+/m.test(text);
}

/** unified diff 行级着色:+ 绿 / - 红 / @@ 青 / 头部 dim(非 diff 文本原样返回) */
export function colorizeDiffText(text: string): string {
  if (!looksLikeDiff(text)) return text;
  return text
    .split('\n')
    .map((line) => {
      if (line.startsWith('@@')) return chalk.cyan(line);
      if (line.startsWith('+++ ') || line.startsWith('--- a/')) return chalk.dim(line);
      if (line.startsWith('+')) return chalk.green(line);
      if (line.startsWith('-')) return chalk.red(line);
      return line;
    })
    .join('\n');
}

/** 单行超长截断(保留尾部省略号) */
function clampLine(line: string, max = CARD_MAX_LINE_CHARS): string {
  return line.length > max ? `${line.slice(0, max)}…` : line;
}

/**
 * 工具结果卡片显示格式:
 *   - 多行输出只显示前 CARD_MAX_LINES 行 + 「(+N 行 — /tool 查看)」提示
 *   - 疑似 diff 时对显示部分做红绿着色
 */
export function formatToolResultForCard(output: string): { text: string; truncated: boolean; totalLines: number } {
  const lines = output.split('\n');
  const totalLines = lines.length;
  if (totalLines <= CARD_MAX_LINES) {
    return { text: colorizeDiffText(output), truncated: false, totalLines };
  }
  const shown = lines.slice(0, CARD_MAX_LINES).map((l) => clampLine(l)).join('\n');
  return {
    text: `${colorizeDiffText(shown)}\n${chalk.dim(`  │  …(+${totalLines - CARD_MAX_LINES} 行 — /tool 查看完整输出)`)}`,
    truncated: true,
    totalLines,
  };
}

const TODO_STATUS_ICONS: Record<TodoItem['status'], string> = {
  pending: chalk.dim('○'),
  in_progress: chalk.yellow('◐'),
  completed: chalk.green('●'),
};

const TODO_PRIORITY_COLORS: Record<TodoItem['priority'], (s: string) => string> = {
  high: chalk.red,
  medium: chalk.yellow,
  low: chalk.green,
};

/** todo 勾选列表卡片(与 /todo show 同一渲染,单一事实源) */
export function renderTodoChecklist(todos: TodoItem[]): string[] {
  if (todos.length === 0) return [];
  const inProgress = todos.filter((t) => t.status === 'in_progress').length;
  const completed = todos.filter((t) => t.status === 'completed').length;
  const pending = todos.length - inProgress - completed;
  const out: string[] = [
    chalk.cyan(`\n╭─ Todo 清单 · ${todos.length} 项`),
    chalk.dim(`│  ${pending} pending · ${inProgress} 进行 · ${completed} 完成`),
    chalk.cyan('│'),
  ];
  for (const t of todos) {
    const icon = TODO_STATUS_ICONS[t.status] ?? chalk.dim('○');
    const pri = TODO_PRIORITY_COLORS[t.priority]?.(`[${t.priority}]`) ?? chalk.dim(`[${t.priority}]`);
    out.push(`│  ${icon} ${pri} ${chalk.bold(`#${t.id}`)} ${t.content}`);
  }
  out.push(chalk.cyan('╰─'));
  out.push('');
  return out;
}

const PLAN_STATUS_ICONS: Record<PlanStep['status'], string> = {
  pending: chalk.dim('○'),
  in_progress: chalk.yellow('◐'),
  completed: chalk.green('●'),
};

/** 结构化计划步骤卡片(plan-<sessionId>.json → 可视化) */
export function renderPlanStepsCard(steps: PlanStep[]): string[] {
  if (steps.length === 0) return [];
  const completed = steps.filter((s) => s.status === 'completed').length;
  const out: string[] = [
    chalk.cyan(`╭─ 计划步骤 · ${steps.length} 步`),
  ];
  for (const s of steps) {
    const icon = PLAN_STATUS_ICONS[s.status] ?? chalk.dim('○');
    const file = s.file ? chalk.cyan(` ${s.file}`) : '';
    out.push(`│  ${icon} ${chalk.dim(`[${s.action}]`)} ${s.title}${file}`);
  }
  out.push(chalk.cyan(`╰─ ${completed}/${steps.length} 完成`));
  return out;
}

/** 快照预览:取最后一条 user 消息前 60 字符(无 user 消息时的降级标签) */
function snapshotPreview(snapshot: ChatMessage[]): string {
  for (let i = snapshot.length - 1; i >= 0; i--) {
    const m = snapshot[i];
    if (m && m.role === 'user') {
      const text = m.content.replace(/\s+/g, ' ').trim();
      return text.length > 60 ? `${text.slice(0, 60)}…` : text || '(空消息)';
    }
  }
  return '(无 user 消息)';
}

/**
 * W12 /rewind 可视化选择:rewindStack → 候选列表(最近优先)。
 * steps 语义与 rewindHistory 一致:1 = 恢复最近一次快照。
 */
export function buildRewindChoices(stack: ChatMessage[][]): Array<{ steps: number; label: string }> {
  const out: Array<{ steps: number; label: string }> = [];
  for (let i = stack.length - 1; i >= 0; i--) {
    const snapshot = stack[i];
    if (!snapshot) continue;
    out.push({
      steps: stack.length - i,
      label: `${stack.length - i} 步前 · ${chalk.dim(snapshotPreview(snapshot))}`,
    });
  }
  return out;
}
