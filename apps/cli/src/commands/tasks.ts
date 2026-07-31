/**
 * /tasks 持久化任务列表 — 全局 ~/.ihui/tasks.json + 按 workspacePath 分组。
 *
 * 设计目标(对标 codex/claude-code/mimo code 的任务管理):
 *   - 全局持久化:跨会话/跨终端保留任务清单
 *   - 项目隔离:按 workspacePath 分组,切换工作区只看本工作区任务
 *   - 紧凑进度条:启动 banner 显示一行 "✓ 2/5 ▰▰▱▱▱"
 *   - 子命令:add/list/show/done/undone/remove/clear/help
 *
 * 与 todo-write 工具的区别:
 *   - todo-write:Agent 内部调用,工作区本地 .ihui/todos.json,全量替换语义
 *   - /tasks:用户主动管理,全局 ~/.ihui/tasks.json,单条增删改语义
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import chalk from 'chalk';

// === 类型 ===

export type TaskStatus = 'pending' | 'in_progress' | 'completed';
export type TaskPriority = 'high' | 'medium' | 'low';

export interface TaskItem {
  /** 唯一 ID(自增整数字符串) */
  id: string;
  /** 任务内容 */
  content: string;
  /** 状态 */
  status: TaskStatus;
  /** 优先级 */
  priority: TaskPriority;
  /** 创建时间 ISO */
  createdAt: string;
  /** 完成时间 ISO(可选) */
  completedAt?: string;
  /** 备注(可选) */
  note?: string;
}

export interface WorkspaceTasks {
  /** workspace 绝对路径 */
  workspacePath: string;
  /** workspace 名称(basename) */
  workspaceName: string;
  /** 该 workspace 下的任务列表 */
  tasks: TaskItem[];
}

interface TasksStore {
  /** schema 版本,便于后续迁移 */
  version: 1;
  /** 按 workspacePath 索引的任务字典 */
  workspaces: Record<string, WorkspaceTasks>;
  /** 全局自增 ID 计数器 */
  nextId: number;
}

// === 存储路径 ===

function getHomeDir(): string {
  return process.env.HOME || process.env.USERPROFILE || os.homedir();
}

/** 全局任务存储路径:~/.ihui/tasks.json */
export function getTasksPath(): string {
  return path.join(getHomeDir(), '.ihui', 'tasks.json');
}

// === 加载/保存 ===

const EMPTY_STORE: TasksStore = { version: 1, workspaces: {}, nextId: 1 };

function loadStore(): TasksStore {
  const p = getTasksPath();
  try {
    if (!fs.existsSync(p)) return { ...EMPTY_STORE };
    const raw = fs.readFileSync(p, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<TasksStore>;
    if (!parsed || typeof parsed !== 'object') return { ...EMPTY_STORE };
    return {
      version: 1,
      workspaces: parsed.workspaces && typeof parsed.workspaces === 'object' ? parsed.workspaces : {},
      nextId: Number.isFinite(parsed.nextId) && (parsed.nextId ?? 0) > 0 ? parsed.nextId! : 1,
    };
  } catch {
    return { ...EMPTY_STORE };
  }
}

function saveStore(store: TasksStore): void {
  const p = getTasksPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(store, null, 2) + '\n', 'utf-8');
}

/** 获取(或创建)指定 workspace 的任务容器 */
function getOrCreateWorkspace(store: TasksStore, workspacePath: string): WorkspaceTasks {
  if (!store.workspaces[workspacePath]) {
    store.workspaces[workspacePath] = {
      workspacePath,
      workspaceName: path.basename(workspacePath),
      tasks: [],
    };
  }
  return store.workspaces[workspacePath]!;
}

// === 公开 API ===

/** 读取指定 workspace 的所有任务(按状态 + 优先级排序) */
export function listTasks(workspacePath: string): TaskItem[] {
  const store = loadStore();
  const ws = store.workspaces[workspacePath];
  if (!ws) return [];
  return sortTasks(ws.tasks);
}

/** 读取指定 workspace 的任务统计 {total, pending, in_progress, completed} */
export function getTaskStats(workspacePath: string): {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
} {
  const tasks = listTasks(workspacePath);
  return {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === 'pending').length,
    in_progress: tasks.filter((t) => t.status === 'in_progress').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
  };
}

/** 添加任务,返回新任务(含分配的 ID) */
export function addTask(
  workspacePath: string,
  content: string,
  priority: TaskPriority = 'medium',
): TaskItem {
  if (!content.trim()) throw new Error('任务内容不能为空');
  const store = loadStore();
  const ws = getOrCreateWorkspace(store, workspacePath);
  const task: TaskItem = {
    id: String(store.nextId++),
    content: content.trim(),
    status: 'pending',
    priority,
    createdAt: new Date().toISOString(),
  };
  ws.tasks.push(task);
  saveStore(store);
  return task;
}

/** 标记任务完成(id 不存在返回 null) */
export function markDone(workspacePath: string, id: string): TaskItem | null {
  const store = loadStore();
  const ws = store.workspaces[workspacePath];
  if (!ws) return null;
  const task = ws.tasks.find((t) => t.id === id);
  if (!task) return null;
  task.status = 'completed';
  task.completedAt = new Date().toISOString();
  saveStore(store);
  return task;
}

/** 标记任务未完成(撤销 done) */
export function markUndone(workspacePath: string, id: string): TaskItem | null {
  const store = loadStore();
  const ws = store.workspaces[workspacePath];
  if (!ws) return null;
  const task = ws.tasks.find((t) => t.id === id);
  if (!task) return null;
  task.status = 'pending';
  delete task.completedAt;
  saveStore(store);
  return task;
}

/** 删除任务 */
export function removeTask(workspacePath: string, id: string): TaskItem | null {
  const store = loadStore();
  const ws = store.workspaces[workspacePath];
  if (!ws) return null;
  const idx = ws.tasks.findIndex((t) => t.id === id);
  if (idx < 0) return null;
  const [removed] = ws.tasks.splice(idx, 1);
  saveStore(store);
  return removed ?? null;
}

/** 清空指定 workspace 的所有任务 */
export function clearTasks(workspacePath: string): number {
  const store = loadStore();
  const ws = store.workspaces[workspacePath];
  if (!ws || ws.tasks.length === 0) return 0;
  const count = ws.tasks.length;
  ws.tasks = [];
  saveStore(store);
  return count;
}

/** 查看单个任务详情 */
export function showTask(workspacePath: string, id: string): TaskItem | null {
  const store = loadStore();
  const ws = store.workspaces[workspacePath];
  if (!ws) return null;
  return ws.tasks.find((t) => t.id === id) ?? null;
}

// === 排序 ===

function sortTasks(tasks: TaskItem[]): TaskItem[] {
  const statusOrder: Record<TaskStatus, number> = { in_progress: 0, pending: 1, completed: 2 };
  const priorityOrder: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };
  return [...tasks].sort((a, b) => {
    const s = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
    if (s !== 0) return s;
    const p = (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99);
    if (p !== 0) return p;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

// === 渲染 ===

const STATUS_ICON: Record<TaskStatus, string> = {
  pending: '⏳',
  in_progress: '🚧',
  completed: '✅',
};

const PRIORITY_ICON: Record<TaskPriority, string> = {
  high: '🔴',
  medium: '🟡',
  low: '🟢',
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: '待办',
  in_progress: '进行中',
  completed: '已完成',
};

/**
 * 渲染紧凑一行进度条(供 banner 使用):
 *   "✓ 2/5 ▰▰▱▱▱ 40%"
 * 无任务时返回空字符串(让 banner 不显示这行)
 */
export function renderCompactProgress(workspacePath: string): string {
  const stats = getTaskStats(workspacePath);
  if (stats.total === 0) return '';
  const total = stats.total;
  const done = stats.completed;
  const pct = Math.round((done / total) * 100);
  // 进度条总宽度 10 格
  const barWidth = 10;
  const filled = Math.min(barWidth, Math.round((done / total) * barWidth));
  const empty = barWidth - filled;
  const bar = '▰'.repeat(filled) + '▱'.repeat(empty);
  const doneStr = chalk.green(String(done));
  const totalStr = chalk.bold(String(total));
  const pctStr = pct >= 100 ? chalk.green(`${pct}%`) : chalk.yellow(`${pct}%`);
  return `📋 任务 ${doneStr}/${totalStr} ${chalk.cyan(bar)} ${pctStr}`;
}

/** 渲染完整任务列表(供 /tasks list 使用) */
export function renderTaskList(workspacePath: string): string {
  const tasks = listTasks(workspacePath);
  const wsName = path.basename(workspacePath);
  if (tasks.length === 0) {
    return chalk.dim(`\n📋 工作区 [${wsName}] 暂无任务\n  ↳ /tasks add <内容> 添加第一条任务\n`);
  }
  const stats = getTaskStats(workspacePath);
  const lines: string[] = [];
  lines.push(chalk.cyan(`\n╭─ 任务列表 · [${wsName}] · ${stats.total} 项(待办 ${stats.pending} · 进行中 ${stats.in_progress} · 完成 ${stats.completed})`));
  lines.push(chalk.cyan('│'));
  let lastStatus: TaskStatus | null = null;
  for (const t of tasks) {
    if (lastStatus !== null && lastStatus !== t.status) {
      lines.push(chalk.cyan('│'));
    }
    lastStatus = t.status;
    const sIcon = STATUS_ICON[t.status];
    const pIcon = PRIORITY_ICON[t.priority];
    const idStr = chalk.dim(`#${t.id.padStart(3, ' ')}`);
    const content = t.status === 'completed'
      ? chalk.dim.strikethrough(t.content)
      : t.content;
    lines.push(`│  ${sIcon} ${pIcon} ${idStr} ${content}`);
    if (t.note) lines.push(`│       ${chalk.dim('↳ ' + t.note)}`);
  }
  lines.push(chalk.cyan('│'));
  lines.push(chalk.cyan('╰─ /tasks add <内容> · /tasks done <id> · /tasks remove <id>'));
  lines.push('');
  return lines.join('\n');
}

/** 渲染单个任务详情 */
export function renderTaskDetail(task: TaskItem): string {
  const lines: string[] = [];
  lines.push(chalk.cyan(`\n╭─ 任务 #${task.id}`));
  lines.push(`│  ${chalk.dim('状态:')} ${STATUS_ICON[task.status]} ${STATUS_LABEL[task.status]}`);
  lines.push(`│  ${chalk.dim('优先级:')} ${PRIORITY_ICON[task.priority]} ${task.priority}`);
  lines.push(`│  ${chalk.dim('内容:')} ${task.content}`);
  if (task.note) lines.push(`│  ${chalk.dim('备注:')} ${task.note}`);
  lines.push(`│  ${chalk.dim('创建:')} ${new Date(task.createdAt).toLocaleString('zh-CN', { hour12: false })}`);
  if (task.completedAt) {
    lines.push(`│  ${chalk.dim('完成:')} ${new Date(task.completedAt).toLocaleString('zh-CN', { hour12: false })}`);
  }
  lines.push(chalk.cyan('╰─'));
  lines.push('');
  return lines.join('\n');
}

/** 渲染 /tasks 帮助 */
export function renderTasksHelp(): string {
  const lines: string[] = [
    chalk.cyan('\n╭─ /tasks 用法'),
    chalk.cyan('│'),
    '│  /tasks                    显示任务列表(同 /tasks list)',
    '│  /tasks list               显示任务列表',
    `│  /tasks add <内容>          添加任务(${chalk.dim('可选 --high/--medium/--low 优先级,默认 medium')})`,
    '│  /tasks show <id>          查看任务详情',
    `│  /tasks done <id>          标记任务完成 ${chalk.green('✓')}`,
    '│  /tasks undone <id>        撤销完成状态',
    '│  /tasks remove <id>        删除任务',
    '│  /tasks clear              清空所有任务',
    '│  /tasks help               显示本帮助',
    chalk.cyan('│'),
    chalk.cyan('╰─ 任务持久化到 ~/.ihui/tasks.json,按工作区隔离'),
    '',
  ];
  return lines.join('\n');
}

// === 命令分发 ===

/**
 * /tasks 命令入口,返回要打印的字符串(空字符串表示无输出)。
 *
 * 用法:
 *   /tasks                  → 列表
 *   /tasks list             → 列表
 *   /tasks add <内容> [...]  → 添加(--high/--medium/--low 指定优先级)
 *   /tasks show <id>
 *   /tasks done <id>
 *   /tasks undone <id>
 *   /tasks remove <id>
 *   /tasks clear
 *   /tasks help
 */
export function handleTasksCommand(input: string, workspacePath: string): string {
  const parts = input.trim().split(/\s+/);
  const sub = parts[0] ?? 'list';

  switch (sub) {
    case '':
    case 'list':
      return renderTaskList(workspacePath);

    case 'add': {
      const rest = parts.slice(1);
      let priority: TaskPriority = 'medium';
      const filtered: string[] = [];
      for (const tok of rest) {
        if (tok === '--high' || tok === '-h') priority = 'high';
        else if (tok === '--medium' || tok === '-m') priority = 'medium';
        else if (tok === '--low' || tok === '-l') priority = 'low';
        else filtered.push(tok);
      }
      const content = filtered.join(' ').trim();
      if (!content) {
        return chalk.yellow('用法: /tasks add <任务内容> [--high|--medium|--low]');
      }
      const task = addTask(workspacePath, content, priority);
      const priIcon = PRIORITY_ICON[task.priority];
      return chalk.green(`✓ 已添加任务 ${priIcon} #${task.id}: ${task.content}`);
    }

    case 'show': {
      const id = parts[1];
      if (!id) return chalk.yellow('用法: /tasks show <id>');
      const task = showTask(workspacePath, id);
      if (!task) return chalk.yellow(`未找到任务 #${id}`);
      return renderTaskDetail(task);
    }

    case 'done': {
      const id = parts[1];
      if (!id) return chalk.yellow('用法: /tasks done <id>');
      const task = markDone(workspacePath, id);
      if (!task) return chalk.yellow(`未找到任务 #${id}`);
      return chalk.green(`✓ 任务 #${id} 已完成: ${task.content}`);
    }

    case 'undone': {
      const id = parts[1];
      if (!id) return chalk.yellow('用法: /tasks undone <id>');
      const task = markUndone(workspacePath, id);
      if (!task) return chalk.yellow(`未找到任务 #${id}`);
      return chalk.green(`✓ 任务 #${id} 已撤销完成: ${task.content}`);
    }

    case 'remove':
    case 'rm':
    case 'delete': {
      const id = parts[1];
      if (!id) return chalk.yellow('用法: /tasks remove <id>');
      const task = removeTask(workspacePath, id);
      if (!task) return chalk.yellow(`未找到任务 #${id}`);
      return chalk.green(`✓ 已删除任务 #${id}: ${task.content}`);
    }

    case 'clear': {
      const count = clearTasks(workspacePath);
      if (count === 0) return chalk.dim('当前工作区无任务可清空');
      return chalk.green(`✓ 已清空 ${count} 个任务`);
    }

    case 'help':
    case '?':
      return renderTasksHelp();

    default:
      return chalk.yellow(`未知子命令: ${sub}\n${renderTasksHelp()}`);
  }
}
