// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * TodoWrite / TodoRead 工具 — 让 Agent 管理并回读任务清单(对齐 自研 IDE 的 TodoWrite)。
 *
 * 灵感来源:参考行业 Agent 框架的 todo_list 工具 + 自研 IDE 的 TodoWrite。
 * 简化策略(做减法):
 *   - todo_write 仅支持全量替换 todos 数组(对齐 自研 IDE 的语义)
 *   - todo_read 只读回读当前清单(对齐上游 todo.ts 的 TodoReadTool,不改任何状态)
 *   - 持久化到 ./.ihui/todos.json(工作区本地,跨会话恢复)
 *   - 不引入外部库,fs + JSON 即可
 *
 * 调用格式:
 *   { "todos": [
 *     { "id": "t1", "content": "...", "status": "pending|in_progress|completed", "priority": "high|medium|low" }
 *   ]}
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Tool, ToolResult, ToolContext } from './index.js';
import { tryParseJson, isRecord, isJsonArray } from '../util/json.js';

export interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'high' | 'medium' | 'low';
  summary?: string;
}

interface TodoWriteArgs {
  todos: TodoItem[];
  merge?: boolean;
}

const STATUS_ICONS: Record<TodoItem['status'], string> = {
  pending: '⏳',
  in_progress: '🚧',
  completed: '✅',
};

const PRIORITY_ICONS: Record<TodoItem['priority'], string> = {
  high: '🔴',
  medium: '🟡',
  low: '🟢',
};

/** 获取 todos.json 持久化路径(工作区 .ihui 目录) */
function getTodosPath(ctx: ToolContext): string {
  return path.join(ctx.workspacePath, '.ihui', 'todos.json');
}

/** 读取当前 todos(文件不存在返回空数组) */
function loadTodos(ctx: ToolContext): TodoItem[] {
  const p = getTodosPath(ctx);
  try {
    if (!fs.existsSync(p)) return [];
    const raw = fs.readFileSync(p, 'utf-8');
    const parsed = tryParseJson(raw);
    if (!isRecord(parsed) || !isJsonArray(parsed.todos)) return [];
    return parsed.todos as unknown as TodoItem[];
  } catch {
    return [];
  }
}

/** 保存 todos(自动创建 .ihui 目录) */
function saveTodos(ctx: ToolContext, todos: TodoItem[]): void {
  const p = getTodosPath(ctx);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify({ todos, updatedAt: new Date().toISOString() }, null, 2), 'utf-8');
}

/** 校验单个 todo 项(失败返回错误字符串,成功返回 undefined) */
function validateTodo(item: unknown, index: number): string | undefined {
  if (!item || typeof item !== 'object') return `todos[${index}] 必须是对象`;
  const t = item as Record<string, unknown>;
  if (typeof t.id !== 'string' || t.id.length === 0) return `todos[${index}].id 必须为非空字符串`;
  if (typeof t.content !== 'string' || t.content.length === 0) return `todos[${index}].content 必须为非空字符串`;
  const status = t.status as string;
  if (!['pending', 'in_progress', 'completed'].includes(status)) {
    return `todos[${index}].status 必须为 pending|in_progress|completed,实际: ${status}`;
  }
  const priority = t.priority as string;
  if (!['high', 'medium', 'low'].includes(priority)) {
    return `todos[${index}].priority 必须为 high|medium|low,实际: ${priority}`;
  }
  return undefined;
}

/** 合并 todos(以新列表为基准,merge=true 时保留旧列表中未在新列表出现的 id) */
function mergeTodos(oldTodos: TodoItem[], newTodos: TodoItem[]): TodoItem[] {
  const newIds = new Set(newTodos.map((t) => t.id));
  const preserved = oldTodos.filter((t) => !newIds.has(t.id));
  return [...newTodos, ...preserved];
}

/** 渲染 todos 为用户可见文本 */
function renderTodos(todos: TodoItem[]): string {
  if (todos.length === 0) return '(无 todo)';
  const byStatus: Record<string, TodoItem[]> = { in_progress: [], pending: [], completed: [] };
  for (const t of todos) (byStatus[t.status] ?? []).push(t);
  const lines: string[] = [];
  const order: (keyof typeof byStatus)[] = ['in_progress', 'pending', 'completed'];
  const labels: Record<string, string> = { in_progress: '进行中', pending: '待办', completed: '已完成' };
  for (const status of order) {
    const list = byStatus[status]!;
    if (list.length === 0) continue;
    lines.push(`${STATUS_ICONS[status as TodoItem['status']]} ${labels[status]} (${list.length}):`);
    for (const t of list) {
      const pri = PRIORITY_ICONS[t.priority];
      const summary = t.summary ? ` — ${t.summary}` : '';
      lines.push(`  ${pri} [${t.id}] ${t.content}${summary}`);
    }
  }
  return lines.join('\n');
}

export const todo_write: Tool = {
  name: 'todo_write',
  description: '管理任务清单。参数:todos(数组,每项含 id/content/status[pending|in_progress|completed]/priority[high|medium|low])。可选 merge(默认 false,全量替换;true 时保留旧列表中未在新列表出现的 id)。用于跟踪多步任务的进度,提升可观测性。',
  dangerLevel: 'write',
  parameters: {
    todos: {
      type: 'array',
      description: '任务数组',
      items: {
        type: 'object',
        description: '单个任务',
        properties: {
          id: { type: 'string', description: '唯一 ID(如 t1, fix-auth)' },
          content: { type: 'string', description: '任务描述' },
          status: {
            type: 'string',
            description: 'pending(待办)/ in_progress(进行中)/ completed(已完成)',
            enum: ['pending', 'in_progress', 'completed'],
          },
          priority: {
            type: 'string',
            description: 'high(高)/ medium(中)/ low(低)',
            enum: ['high', 'medium', 'low'],
          },
          summary: { type: 'string', description: '完成后的简短总结(可选)' },
        },
        required: ['id', 'content', 'status', 'priority'],
      },
    },
    merge: { type: 'boolean', description: '是否合并模式(默认 false,全量替换)' },
  },
  required: ['todos'],
  async execute(args, ctx): Promise<ToolResult> {
    const opts = args as unknown as TodoWriteArgs;
    if (!Array.isArray(opts.todos)) {
      return { success: false, output: '', error: 'todos 参数必须是数组' };
    }
    // 校验所有 todo
    for (let i = 0; i < opts.todos.length; i++) {
      const err = validateTodo(opts.todos[i], i);
      if (err) return { success: false, output: '', error: err };
    }
    let finalTodos: TodoItem[];
    if (opts.merge) {
      const oldTodos = loadTodos(ctx);
      finalTodos = mergeTodos(oldTodos, opts.todos);
    } else {
      finalTodos = opts.todos;
    }
    // 排序:in_progress > pending > completed;同 status 内按 priority 降序
    const statusOrder: Record<string, number> = { in_progress: 0, pending: 1, completed: 2 };
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    finalTodos.sort((a, b) => {
      const s = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
      if (s !== 0) return s;
      return (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99);
    });
    saveTodos(ctx, finalTodos);
    return {
      success: true,
      output: `已保存 ${finalTodos.length} 个 todo:\n${renderTodos(finalTodos)}`,
    };
  },
};

/**
 * TodoRead 工具 — 只读回读当前任务清单(对齐上游 todo.ts:25-47 的 TodoRead)。
 *
 * 与 todo_write 的差别只在"不写":模型在多轮之间想知道"现在还剩哪些没做"时,
 * 不必再发一次 todo_write 全量覆盖来换回显 —— 那次覆盖是个写操作,会被权限档
 * / 模式档拦下,而且会无谓地刷新 updatedAt。
 */
export const todo_read: Tool = {
  name: 'todo_read',
  description: '读取当前任务清单(只读,不修改)。无参数。返回按 in_progress > pending > completed 排序的清单,含每项 id/content/status/priority/summary。',
  dangerLevel: 'read',
  parameters: {},
  required: [],
  // 新增工具必须带契约(守门 TC1:「新增即拦」;存量工具走各文件 HEAD 锚点,这里不替它们补)。
  // 量纲 = UTF-8 字节;24K 字符 × 3(CJK 保守档,见 result-envelope/budgets.ts)≈ 72K 字节。
  contract: {
    shape: { input: { type: 'object', properties: {}, required: [] }, visibleToProvider: true },
    permission: {
      permissionKey: 'todo_read',
      reason: '只读回读工作区 .ihui/todos.json,不产生任何写入',
      riskLevel: 'read',
      effectScope: 'workspace',
      requiresApproval: false,
    },
    resultBudget: {
      inlineLimitBytes: 72_000,
      providerVisibleLimitBytes: 72_000,
      policy: 'truncate',
      preview: { bytes: 3_600, lines: 40, from: 'head' },
    },
  },
  async execute(_args, ctx): Promise<ToolResult> {
    const todos = loadTodos(ctx);
    if (todos.length === 0) return { success: true, output: '(无 todo)' };
    return { success: true, output: `当前 ${todos.length} 个 todo:\n${renderTodos(todos)}` };
  },
};

/** 读取当前 todo 清单(供 /todo slash 命令使用) */
export function readTodoList(ctx: ToolContext): TodoItem[] {
  return loadTodos(ctx);
}

/** 全量写出 todo 清单(供计划-执行闭环同步勾选使用,与 todo_write 工具同存储) */
export function writeTodoList(ctx: ToolContext, todos: TodoItem[]): void {
  saveTodos(ctx, todos);
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
