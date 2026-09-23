// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
import { t } from '../i18n/index.js';

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
    throw new Error(t('cliWorkflows.contextBadJson', { message: (err as Error).message }));
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
    console.info(chalk.dim(t('cliWorkflows.noWorkflows')));
    return;
  }

  console.info(chalk.cyan(t('cliWorkflows.listHeader')));
  for (const w of list) {
    console.info(
      t('cliWorkflows.listRow', { id: chalk.cyan(w.id), name: chalk.bold(w.name), triggerType: w.triggerType, isActive: colorActive(w.isActive), length: w.steps.length }),
    );
  }
  console.info(chalk.dim(t('cliWorkflows.paginationFooter', { total: total, page: page, pageSize: pageSize })));
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

  console.info(chalk.cyan(t('cliWorkflows.detailHeader')));
  console.info(`  ID:         ${chalk.cyan(w.id)}`);
  console.info(t('cliWorkflows.detailName', { name: chalk.bold(w.name) }));
  console.info(t('cliWorkflows.detailDescription', { description: w.description || chalk.dim('(无)') }));
  console.info(t('cliWorkflows.detailTrigger', { triggerType: w.triggerType }));
  console.info(t('cliWorkflows.detailActive', { isActive: colorActive(w.isActive) }));
  console.info(t('cliWorkflows.detailSteps', { length: w.steps.length }));
  console.info(t('cliWorkflows.detailCreator', { creator: w.createdBy || chalk.dim(t('cliWorkflows.unknownValue')) }));
  console.info(t('cliWorkflows.detailCreatedAt', { createdAt: formatTime(w.createdAt) }));
  console.info(t('cliWorkflows.detailUpdatedAt', { updatedAt: formatTime(w.updatedAt) }));

  if (w.steps.length > 0) {
    console.info(chalk.cyan(t('cliWorkflows.stepsOverview')));
    w.steps.forEach((step, idx) => {
      const s = (step ?? {}) as Record<string, unknown>;
      const type = asTaskType(s.type);
      const name = asString(s.name) || t('cliWorkflows.stepLabel', { step: idx + 1 });
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
    chalk.green(t('cliWorkflows.triggered')) +
      t('cliWorkflows.instanceTasks', { id: chalk.cyan(instance.id), status: colorInstanceStatus(instance.status), length: tasks.length }),
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
    console.info(chalk.dim(t('cliWorkflows.noInstances')));
    return;
  }

  console.info(chalk.cyan(t('cliWorkflows.instanceListHeader')));
  for (const inst of list) {
    console.info(
      t('cliWorkflows.instanceListRow', { id: chalk.cyan(inst.id), workflowId: inst.workflowId, status: colorInstanceStatus(inst.status), startedAt: formatTime(inst.startedAt), completedAt: formatTime(inst.completedAt) }),
    );
  }
  console.info(chalk.dim(t('cliWorkflows.paginationFooter', { total: total, page: filter.page, pageSize: filter.pageSize })));
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

  console.info(chalk.cyan(t('cliWorkflows.instanceDetailHeader')));
  console.info(t('cliWorkflows.instanceDetailId', { id: chalk.cyan(inst.id) }));
  console.info(t('cliWorkflows.instanceDetailWorkflow', { workflowId: inst.workflowId }));
  if (inst.projectId) console.info(t('cliWorkflows.instanceDetailProject', { projectId: inst.projectId }));
  console.info(t('cliWorkflows.instanceDetailStatus', { status: colorInstanceStatus(inst.status) }));
  console.info(t('cliWorkflows.instanceDetailStarted', { startedAt: formatTime(inst.startedAt) }));
  console.info(t('cliWorkflows.instanceDetailCompleted', { completedAt: formatTime(inst.completedAt) }));
  console.info(t('cliWorkflows.instanceDetailCreatedAt', { createdAt: formatTime(inst.createdAt) }));
  if (inst.error) console.info(t('cliWorkflows.instanceDetailError', { error: chalk.red(inst.error) }));

  if (tasks.length > 0) {
    console.info(chalk.cyan(t('cliWorkflows.tasksHeader', { length: tasks.length })));
    for (const t of tasks) {
      console.info(
        `  [${t.stepIndex}] ${t.name} (${t.type}) [${colorTaskStatus(t.status)}]`,
      );
    }
  } else {
    console.info(chalk.dim(t('cliWorkflows.noTasks')));
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
  console.info(chalk.green(t('cliWorkflows.instanceCancelled', { id: chalk.cyan(inst.id), status: colorInstanceStatus(inst.status) })));
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
    .description(t('cliWorkflows.cmdDesc'));

  // ---------- list ----------
  wfCmd
    .command('list')
    .description(t('cliWorkflows.listDesc'))
    .option('--page <n>', t('cliWorkflows.pageDesc'))
    .option('--page-size <n>', t('cliWorkflows.pageSizeDesc'))
    .option('--json', t('cliWorkflows.jsonDesc'))
    .action(async (opts: ListOptions) => {
      try {
        const { apiUrl: cliApiUrl, apiKey: cliApiKey } = program.opts() as {
          apiUrl?: string;
          apiKey?: string;
        };
        const baseUrl = resolveBaseUrl(cliApiUrl);
        const apiKey = await resolveApiKeyAsync(cliApiKey, baseUrl);
        if (!apiKey) {
          console.error(chalk.red(t('cliWorkflows.notLoggedIn')));
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
    .description(t('cliWorkflows.showDesc'))
    .option('--json', t('cliWorkflows.jsonDesc'))
    .action(async (id: string, opts: ShowOptions) => {
      try {
        const { apiUrl: cliApiUrl, apiKey: cliApiKey } = program.opts() as {
          apiUrl?: string;
          apiKey?: string;
        };
        const baseUrl = resolveBaseUrl(cliApiUrl);
        const apiKey = await resolveApiKeyAsync(cliApiKey, baseUrl);
        if (!apiKey) {
          console.error(chalk.red(t('cliWorkflows.notLoggedIn')));
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
    .description(t('cliWorkflows.triggerDesc'))
    .option('--project <id>', t('cliWorkflows.projectIdDesc'))
    .option('--context <json>', t('cliWorkflows.contextDesc'))
    .option('--json', t('cliWorkflows.jsonDesc'))
    .action(async (id: string, opts: RunOptions) => {
      try {
        const { apiUrl: cliApiUrl, apiKey: cliApiKey } = program.opts() as {
          apiUrl?: string;
          apiKey?: string;
        };
        const baseUrl = resolveBaseUrl(cliApiUrl);
        const apiKey = await resolveApiKeyAsync(cliApiKey, baseUrl);
        if (!apiKey) {
          console.error(chalk.red(t('cliWorkflows.notLoggedIn')));
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
    .description(t('cliWorkflows.instancesDesc'))
    .option('--workflow-id <id>', t('cliWorkflows.filterWorkflowDesc'))
    .option('--status <s>', t('cliWorkflows.filterStatusDesc'))
    .option('--page <n>', t('cliWorkflows.pageDesc'))
    .option('--page-size <n>', t('cliWorkflows.pageSizeDesc'))
    .option('--json', t('cliWorkflows.jsonDesc'))
    .action(async (opts: InstancesOptions) => {
      try {
        const { apiUrl: cliApiUrl, apiKey: cliApiKey } = program.opts() as {
          apiUrl?: string;
          apiKey?: string;
        };
        const baseUrl = resolveBaseUrl(cliApiUrl);
        const apiKey = await resolveApiKeyAsync(cliApiKey, baseUrl);
        if (!apiKey) {
          console.error(chalk.red(t('cliWorkflows.notLoggedIn')));
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
    .description(t('cliWorkflows.instanceShowDesc'))
    .option('--json', t('cliWorkflows.jsonDesc'))
    .action(async (id: string, opts: ShowOptions) => {
      try {
        const { apiUrl: cliApiUrl, apiKey: cliApiKey } = program.opts() as {
          apiUrl?: string;
          apiKey?: string;
        };
        const baseUrl = resolveBaseUrl(cliApiUrl);
        const apiKey = await resolveApiKeyAsync(cliApiKey, baseUrl);
        if (!apiKey) {
          console.error(chalk.red(t('cliWorkflows.notLoggedIn')));
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
    .description(t('cliWorkflows.cancelDesc'))
    .option('--json', t('cliWorkflows.jsonDesc'))
    .action(async (id: string, opts: CancelOptions) => {
      try {
        const { apiUrl: cliApiUrl, apiKey: cliApiKey } = program.opts() as {
          apiUrl?: string;
          apiKey?: string;
        };
        const baseUrl = resolveBaseUrl(cliApiUrl);
        const apiKey = await resolveApiKeyAsync(cliApiKey, baseUrl);
        if (!apiKey) {
          console.error(chalk.red(t('cliWorkflows.notLoggedIn')));
          process.exitCode = 1;
          return;
        }
        await cancelInstance(baseUrl, id, Boolean(opts.json), apiKey);
      } catch (err) {
        handleError('workflows cancel', err);
      }
    });
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
