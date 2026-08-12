/**
 * Workflows CLI — 工作流管理与执行,对标 Web 端 /workflows 3 页功能(列表/详情/实例)。
 *
 * 用法:
 *   ihui workflows list [--page <n>] [--page-size <n>] [--json]
 *   ihui workflows show <id> [--json]
 *   ihui workflows run <id> [--project <id>] [--context <json>] [--json]
 *   ihui workflows instances [--workflow-id <id>] [--status <s>] [--page <n>] [--page-size <n>] [--json]
 *   ihui workflows instance <id> [--json]
 *   ihui workflows cancel <id> [--json]
 *
 * 对接后端 apps/api/src/routes/workflows.ts,prefix /api/workflows,所有端点需 JWT Bearer token。
 */

import type { Command } from 'commander';
import chalk from 'chalk';

import { createApiRequest, extractData, handleError, printJson, resolveApiKeyAsync, resolveBaseUrl } from './http-utils.js';

const API_PREFIX = '/api/workflows';
const DEFAULT_TIMEOUT_MS = 30_000;
const apiRequest = createApiRequest(API_PREFIX, DEFAULT_TIMEOUT_MS);

// ==================== 类型定义 ====================

/** 触发类型 */
const TRIGGER_TYPES = ['manual', 'schedule', 'event', 'webhook'] as const;
type TriggerType = (typeof TRIGGER_TYPES)[number];

/** 实例状态 */
const INSTANCE_STATUSES = [
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
  'timeout',
] as const;
type InstanceStatus = (typeof INSTANCE_STATUSES)[number];

/** 任务类型 */
const TASK_TYPES = ['action', 'loop', 'condition', 'delay', 'parallel'] as const;
type TaskType = (typeof TASK_TYPES)[number];

/** 任务状态 */
const TASK_STATUSES = ['pending', 'running', 'completed', 'failed'] as const;
type TaskStatus = (typeof TASK_STATUSES)[number];

/** 工作流定义 */
interface Workflow {
  id: string;
  name: string;
  description?: string;
  triggerType: TriggerType;
  triggerConfig?: unknown;
  steps: unknown[];
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** 工作流实例(一次执行) */
interface WorkflowInstance {
  id: string;
  workflowId: string;
  projectId?: string;
  status: InstanceStatus;
  context?: unknown;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  createdAt: string;
}

/** 工作流任务(实例内的一个步骤执行) */
interface WorkflowTask {
  id: string;
  instanceId: string;
  stepIndex: number;
  name: string;
  type: TaskType;
  input?: unknown;
  status: TaskStatus;
  result?: unknown;
  error?: string;
  createdAt: string;
}

// ==================== 辅助函数(复用 capabilities.ts 模式) ====================

// ==================== 类型守卫(零 any) ====================

function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function asStringOrUndef(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function asNumber(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function asBool(v: unknown): boolean {
  return v === true;
}

function asTriggerType(v: unknown): TriggerType {
  const s = asString(v);
  return (TRIGGER_TYPES as readonly string[]).includes(s) ? (s as TriggerType) : 'manual';
}

function asInstanceStatus(v: unknown): InstanceStatus {
  const s = asString(v);
  return (INSTANCE_STATUSES as readonly string[]).includes(s)
    ? (s as InstanceStatus)
    : 'pending';
}

function asTaskType(v: unknown): TaskType {
  const s = asString(v);
  return (TASK_TYPES as readonly string[]).includes(s) ? (s as TaskType) : 'action';
}

function asTaskStatus(v: unknown): TaskStatus {
  const s = asString(v);
  return (TASK_STATUSES as readonly string[]).includes(s) ? (s as TaskStatus) : 'pending';
}

/** 将 unknown 安全断言为 Workflow */
function asWorkflow(v: unknown): Workflow {
  const o = (v ?? {}) as Record<string, unknown>;
  return {
    id: asString(o.id),
    name: asString(o.name),
    description: asStringOrUndef(o.description),
    triggerType: asTriggerType(o.triggerType),
    triggerConfig: o.triggerConfig,
    steps: asArray(o.steps),
    isActive: asBool(o.isActive),
    createdBy: asString(o.createdBy),
    createdAt: asString(o.createdAt),
    updatedAt: asString(o.updatedAt),
  };
}

/** 将 unknown 安全断言为 WorkflowInstance */
function asInstance(v: unknown): WorkflowInstance {
  const o = (v ?? {}) as Record<string, unknown>;
  return {
    id: asString(o.id),
    workflowId: asString(o.workflowId),
    projectId: asStringOrUndef(o.projectId),
    status: asInstanceStatus(o.status),
    context: o.context,
    startedAt: asStringOrUndef(o.startedAt),
    completedAt: asStringOrUndef(o.completedAt),
    error: asStringOrUndef(o.error),
    createdAt: asString(o.createdAt),
  };
}

/** 将 unknown 安全断言为 WorkflowTask */
function asTask(v: unknown): WorkflowTask {
  const o = (v ?? {}) as Record<string, unknown>;
  return {
    id: asString(o.id),
    instanceId: asString(o.instanceId),
    stepIndex: asNumber(o.stepIndex),
    name: asString(o.name),
    type: asTaskType(o.type),
    input: o.input,
    status: asTaskStatus(o.status),
    result: o.result,
    error: asStringOrUndef(o.error),
    createdAt: asString(o.createdAt),
  };
}

// ==================== 格式化辅助 ====================

/** 实例状态着色:running=yellow / completed=green / failed=red / cancelled=dim / pending=cyan / timeout=magenta */
function colorInstanceStatus(status: InstanceStatus | string): string {
  switch (status) {
    case 'running':
      return chalk.yellow(status);
    case 'completed':
      return chalk.green(status);
    case 'failed':
      return chalk.red(status);
    case 'cancelled':
      return chalk.dim(status);
    case 'pending':
      return chalk.cyan(status);
    case 'timeout':
      return chalk.magenta(status);
    default:
      return chalk.dim(String(status));
  }
}

/** 任务状态着色 */
function colorTaskStatus(status: TaskStatus | string): string {
  switch (status) {
    case 'running':
      return chalk.yellow(status);
    case 'completed':
      return chalk.green(status);
    case 'failed':
      return chalk.red(status);
    case 'pending':
      return chalk.cyan(status);
    default:
      return chalk.dim(String(status));
  }
}

/** 激活状态着色 */
function colorActive(isActive: boolean): string {
  return isActive ? chalk.green('active') : chalk.dim('inactive');
}

/** ISO 时间格式化为本地可读时间(YYYY-MM-DD HH:mm) */
function formatTime(iso?: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

/** 解析 --context JSON 字符串 */
function parseContext(raw: string | undefined): unknown {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`--context 不是有效的 JSON: ${(err as Error).message}`);
  }
}

// ==================== 子命令实现 ====================

/** ihui workflows list — 列出工作流(分页) */
async function listWorkflows(
  baseUrl: string,
  page: number,
  pageSize: number,
  asJson: boolean,
  apiKey?: string,
): Promise<void> {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  const resp = await apiRequest(baseUrl, `?${params.toString()}`, { apiKey });

  if (asJson) {
    printJson(resp);
    return;
  }

  const data = extractData(resp) as {
    list?: unknown[];
    total?: number;
    page?: number;
    pageSize?: number;
  };
  const list = asArray(data?.list).map(asWorkflow);
  const total = asNumber(data?.total, list.length);

  if (list.length === 0) {
    console.info(chalk.dim('(暂无工作流)'));
    return;
  }

  console.info(chalk.cyan('\n=== 工作流列表 ==='));
  for (const w of list) {
    console.info(
      `  [${chalk.cyan(w.id)}] ${chalk.bold(w.name)} [${w.triggerType}] [${colorActive(w.isActive)}] [${w.steps.length} 步]`,
    );
  }
  console.info(chalk.dim(`\n共 ${total} 条 (第 ${page} 页,每页 ${pageSize} 条)`));
}

/** ihui workflows show <id> — 查看工作流详情 */
async function showWorkflow(
  baseUrl: string,
  id: string,
  asJson: boolean,
  apiKey?: string,
): Promise<void> {
  const resp = await apiRequest(baseUrl, `/${encodeURIComponent(id)}`, { apiKey });

  if (asJson) {
    printJson(resp);
    return;
  }

  const data = extractData(resp) as { workflow?: unknown };
  const w = asWorkflow(data?.workflow);

  console.info(chalk.cyan('\n=== 工作流详情 ==='));
  console.info(`  ID:         ${chalk.cyan(w.id)}`);
  console.info(`  名称:       ${chalk.bold(w.name)}`);
  console.info(`  描述:       ${w.description || chalk.dim('(无)')}`);
  console.info(`  触发类型:   ${w.triggerType}`);
  console.info(`  激活状态:   ${colorActive(w.isActive)}`);
  console.info(`  步骤数:     ${w.steps.length}`);
  console.info(`  创建者:     ${w.createdBy || chalk.dim('(未知)')}`);
  console.info(`  创建时间:   ${formatTime(w.createdAt)}`);
  console.info(`  更新时间:   ${formatTime(w.updatedAt)}`);

  if (w.steps.length > 0) {
    console.info(chalk.cyan('\n步骤概览:'));
    w.steps.forEach((step, idx) => {
      const s = (step ?? {}) as Record<string, unknown>;
      const type = asTaskType(s.type);
      const name = asString(s.name) || `(步骤 ${idx + 1})`;
      console.info(`  [${idx}] ${name} (${type})`);
    });
  }
}

/** ihui workflows run <id> — 触发工作流,创建 instance + 派发任务 */
async function runWorkflow(
  baseUrl: string,
  id: string,
  projectId: string | undefined,
  context: unknown,
  asJson: boolean,
  apiKey?: string,
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (projectId) body.projectId = projectId;
  if (context !== undefined) body.context = context;

  const resp = await apiRequest(baseUrl, `/${encodeURIComponent(id)}/trigger`, {
    method: 'POST',
    body,
    apiKey,
  });

  if (asJson) {
    printJson(resp);
    return;
  }

  const data = extractData(resp) as { instance?: unknown; tasks?: unknown[] };
  const instance = asInstance(data?.instance);
  const tasks = asArray(data?.tasks).map(asTask);

  console.info(
    chalk.green('✓ 已触发工作流') +
      ` [instance=${chalk.cyan(instance.id)} status=${colorInstanceStatus(instance.status)}] 共 ${tasks.length} 个任务`,
  );
}

/** ihui workflows instances — 列出实例(可按工作流/状态筛选) */
async function listInstances(
  baseUrl: string,
  filter: { workflowId?: string; status?: string; page: number; pageSize: number },
  asJson: boolean,
  apiKey?: string,
): Promise<void> {
  const params = new URLSearchParams();
  params.set('page', String(filter.page));
  params.set('pageSize', String(filter.pageSize));
  if (filter.workflowId) params.set('workflowId', filter.workflowId);
  if (filter.status) params.set('status', filter.status);

  const resp = await apiRequest(baseUrl, `/instances?${params.toString()}`, { apiKey });

  if (asJson) {
    printJson(resp);
    return;
  }

  const data = extractData(resp) as {
    list?: unknown[];
    total?: number;
    page?: number;
    pageSize?: number;
  };
  const list = asArray(data?.list).map(asInstance);
  const total = asNumber(data?.total, list.length);

  if (list.length === 0) {
    console.info(chalk.dim('(暂无实例)'));
    return;
  }

  console.info(chalk.cyan('\n=== 实例列表 ==='));
  for (const inst of list) {
    console.info(
      `  [${chalk.cyan(inst.id)}] wf=${inst.workflowId} [${colorInstanceStatus(inst.status)}] 开始=${formatTime(inst.startedAt)} 完成=${formatTime(inst.completedAt)}`,
    );
  }
  console.info(chalk.dim(`\n共 ${total} 条 (第 ${filter.page} 页,每页 ${filter.pageSize} 条)`));
}

/** ihui workflows instance <id> — 查看实例详情(含 tasks) */
async function showInstance(
  baseUrl: string,
  id: string,
  asJson: boolean,
  apiKey?: string,
): Promise<void> {
  const resp = await apiRequest(baseUrl, `/instances/${encodeURIComponent(id)}`, { apiKey });

  if (asJson) {
    printJson(resp);
    return;
  }

  const data = extractData(resp) as { instance?: unknown; tasks?: unknown[] };
  const inst = asInstance(data?.instance);
  const tasks = asArray(data?.tasks).map(asTask);

  console.info(chalk.cyan('\n=== 实例详情 ==='));
  console.info(`  实例 ID:    ${chalk.cyan(inst.id)}`);
  console.info(`  工作流 ID:  ${inst.workflowId}`);
  if (inst.projectId) console.info(`  项目 ID:    ${inst.projectId}`);
  console.info(`  状态:       ${colorInstanceStatus(inst.status)}`);
  console.info(`  开始时间:   ${formatTime(inst.startedAt)}`);
  console.info(`  完成时间:   ${formatTime(inst.completedAt)}`);
  console.info(`  创建时间:   ${formatTime(inst.createdAt)}`);
  if (inst.error) console.info(`  错误:       ${chalk.red(inst.error)}`);

  if (tasks.length > 0) {
    console.info(chalk.cyan(`\n任务 (${tasks.length} 个):`));
    for (const t of tasks) {
      console.info(
        `  [${t.stepIndex}] ${t.name} (${t.type}) [${colorTaskStatus(t.status)}]`,
      );
    }
  } else {
    console.info(chalk.dim('\n(无任务)'));
  }
}

/** ihui workflows cancel <id> — 取消运行中实例 */
async function cancelInstance(
  baseUrl: string,
  id: string,
  asJson: boolean,
  apiKey?: string,
): Promise<void> {
  const resp = await apiRequest(baseUrl, `/instances/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    apiKey,
  });

  if (asJson) {
    printJson(resp);
    return;
  }

  const data = extractData(resp) as { instance?: unknown };
  const inst = asInstance(data?.instance);
  console.info(chalk.green(`✓ 已取消实例 id=${chalk.cyan(inst.id)} (status=${colorInstanceStatus(inst.status)})`));
}

// ==================== 命令注册 ====================

interface ListOptions {
  page?: string;
  pageSize?: string;
  json?: boolean;
}

interface ShowOptions {
  json?: boolean;
}

interface RunOptions {
  project?: string;
  context?: string;
  json?: boolean;
}

interface InstancesOptions {
  workflowId?: string;
  status?: string;
  page?: string;
  pageSize?: string;
  json?: boolean;
}

interface CancelOptions {
  json?: boolean;
}

/** 解析分页参数,非法值回退到默认 */
function parsePagination(pageStr?: string, pageSizeStr?: string): { page: number; pageSize: number } {
  const page = pageStr ? parseInt(pageStr, 10) : 1;
  const pageSize = pageSizeStr ? parseInt(pageSizeStr, 10) : 20;
  return {
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 20,
  };
}

/**
 * 在根 program 上注册 `workflows` 命令组,对标 Web 端 /workflows 3 页功能。
 * 使用全局 `--api-url` / `--api-key` 或 settings.json 配置。
 */
export function registerWorkflowsCommand(program: Command): void {
  const wfCmd = program
    .command('workflows')
    .description('工作流管理与执行 (对标 Web 端 /workflows)');

  // ---------- list ----------
  wfCmd
    .command('list')
    .description('列出工作流(分页)')
    .option('--page <n>', '页码(默认 1)')
    .option('--page-size <n>', '每页数量(默认 20)')
    .option('--json', '以 JSON 格式输出')
    .action(async (opts: ListOptions) => {
      try {
        const { apiUrl: cliApiUrl, apiKey: cliApiKey } = program.opts() as {
          apiUrl?: string;
          apiKey?: string;
        };
        const baseUrl = resolveBaseUrl(cliApiUrl);
        const apiKey = await resolveApiKeyAsync(cliApiKey, baseUrl);
        if (!apiKey) {
          console.error(chalk.red('✗ 未登录或 token 已失效,请运行: ihui login'));
          process.exitCode = 1;
          return;
        }
        const { page, pageSize } = parsePagination(opts.page, opts.pageSize);
        await listWorkflows(baseUrl, page, pageSize, Boolean(opts.json), apiKey);
      } catch (err) {
        handleError('workflows list', err);
      }
    });

  // ---------- show ----------
  wfCmd
    .command('show <id>')
    .description('查看工作流详情')
    .option('--json', '以 JSON 格式输出')
    .action(async (id: string, opts: ShowOptions) => {
      try {
        const { apiUrl: cliApiUrl, apiKey: cliApiKey } = program.opts() as {
          apiUrl?: string;
          apiKey?: string;
        };
        const baseUrl = resolveBaseUrl(cliApiUrl);
        const apiKey = await resolveApiKeyAsync(cliApiKey, baseUrl);
        if (!apiKey) {
          console.error(chalk.red('✗ 未登录或 token 已失效,请运行: ihui login'));
          process.exitCode = 1;
          return;
        }
        await showWorkflow(baseUrl, id, Boolean(opts.json), apiKey);
      } catch (err) {
        handleError('workflows show', err);
      }
    });

  // ---------- run ----------
  wfCmd
    .command('run <id>')
    .description('触发工作流,创建 instance + 派发任务')
    .option('--project <id>', '关联项目 ID')
    .option('--context <json>', '触发上下文(JSON 字符串)')
    .option('--json', '以 JSON 格式输出')
    .action(async (id: string, opts: RunOptions) => {
      try {
        const { apiUrl: cliApiUrl, apiKey: cliApiKey } = program.opts() as {
          apiUrl?: string;
          apiKey?: string;
        };
        const baseUrl = resolveBaseUrl(cliApiUrl);
        const apiKey = await resolveApiKeyAsync(cliApiKey, baseUrl);
        if (!apiKey) {
          console.error(chalk.red('✗ 未登录或 token 已失效,请运行: ihui login'));
          process.exitCode = 1;
          return;
        }
        const context = parseContext(opts.context);
        await runWorkflow(baseUrl, id, opts.project, context, Boolean(opts.json), apiKey);
      } catch (err) {
        handleError('workflows run', err);
      }
    });

  // ---------- instances ----------
  wfCmd
    .command('instances')
    .description('列出实例(可按工作流/状态筛选)')
    .option('--workflow-id <id>', '按工作流 ID 筛选')
    .option('--status <s>', '按状态筛选(pending/running/completed/failed/cancelled/timeout)')
    .option('--page <n>', '页码(默认 1)')
    .option('--page-size <n>', '每页数量(默认 20)')
    .option('--json', '以 JSON 格式输出')
    .action(async (opts: InstancesOptions) => {
      try {
        const { apiUrl: cliApiUrl, apiKey: cliApiKey } = program.opts() as {
          apiUrl?: string;
          apiKey?: string;
        };
        const baseUrl = resolveBaseUrl(cliApiUrl);
        const apiKey = await resolveApiKeyAsync(cliApiKey, baseUrl);
        if (!apiKey) {
          console.error(chalk.red('✗ 未登录或 token 已失效,请运行: ihui login'));
          process.exitCode = 1;
          return;
        }
        const { page, pageSize } = parsePagination(opts.page, opts.pageSize);
        await listInstances(
          baseUrl,
          {
            workflowId: opts.workflowId,
            status: opts.status,
            page,
            pageSize,
          },
          Boolean(opts.json),
          apiKey,
        );
      } catch (err) {
        handleError('workflows instances', err);
      }
    });

  // ---------- instance ----------
  wfCmd
    .command('instance <id>')
    .description('查看实例详情(含 tasks)')
    .option('--json', '以 JSON 格式输出')
    .action(async (id: string, opts: ShowOptions) => {
      try {
        const { apiUrl: cliApiUrl, apiKey: cliApiKey } = program.opts() as {
          apiUrl?: string;
          apiKey?: string;
        };
        const baseUrl = resolveBaseUrl(cliApiUrl);
        const apiKey = await resolveApiKeyAsync(cliApiKey, baseUrl);
        if (!apiKey) {
          console.error(chalk.red('✗ 未登录或 token 已失效,请运行: ihui login'));
          process.exitCode = 1;
          return;
        }
        await showInstance(baseUrl, id, Boolean(opts.json), apiKey);
      } catch (err) {
        handleError('workflows instance', err);
      }
    });

  // ---------- cancel ----------
  wfCmd
    .command('cancel <id>')
    .description('取消运行中实例')
    .option('--json', '以 JSON 格式输出')
    .action(async (id: string, opts: CancelOptions) => {
      try {
        const { apiUrl: cliApiUrl, apiKey: cliApiKey } = program.opts() as {
          apiUrl?: string;
          apiKey?: string;
        };
        const baseUrl = resolveBaseUrl(cliApiUrl);
        const apiKey = await resolveApiKeyAsync(cliApiKey, baseUrl);
        if (!apiKey) {
          console.error(chalk.red('✗ 未登录或 token 已失效,请运行: ihui login'));
          process.exitCode = 1;
          return;
        }
        await cancelInstance(baseUrl, id, Boolean(opts.json), apiKey);
      } catch (err) {
        handleError('workflows cancel', err);
      }
    });
}
