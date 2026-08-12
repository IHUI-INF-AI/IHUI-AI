/**
 * Security CLI — 安全审计命令,对标 Web 端 /security-audit 安全审计功能。
 *
 * 对接后端 apps/api/src/routes(均 JWT Bearer 鉴权):
 *  - GET /api/security/audit           → { list: SecurityLog[], total, page, pageSize }(用户级)
 *  - GET /api/security/anomalies       → { total, list: AnomalyEvent[] }(admin 级,异常事件扫描)
 *  - GET /api/security/threat-dashboard → ThreatStats(admin 级,威胁监控仪表盘)
 *
 * 类型契约:SecurityLog 来自 @ihui/database;AnomalyEvent / ThreatStats 本地定义,
 * 与 apps/api/src/services/anomaly-detector.ts + apps/api/src/plugins/threat-detector.ts 对齐。
 * 实现模板复用 memory.ts 的 resolveBaseUrl / resolveApiKeyAsync / apiRequest / extractData / handleError。
 *
 * 用法:
 *   ihui security audit [--page <n>] [--page-size <n>] [--json]
 *   ihui security scan [--path <ip>] [--limit <n>] [--offset <n>] [--min-score <n>] [--json]
 *   ihui security report [--json]
 */

import type { Command } from 'commander';
import chalk from 'chalk';

import { createApiRequest, extractData, handleError, printJson, resolveApiKeyAsync, resolveBaseUrl } from './http-utils.js';

const API_PREFIX = '/api/security';
const DEFAULT_TIMEOUT_MS = 30_000;
const apiRequest = createApiRequest(API_PREFIX, DEFAULT_TIMEOUT_MS);
const ACTION_TRUNCATE_LEN = 60;

// === 请求 / 响应类型(本地定义,与后端 anomaly-detector.ts / threat-detector.ts 对齐) ===

/** 安全审计日志条目(对应 security_logs 表,$inferSelect)。 */
interface SecurityLogEntry {
  id: string;
  userId: string;
  action: string;
  ip: string | null;
  userAgent: string | null;
  metadata: unknown;
  createdAt: string;
}

interface AuditListData {
  list: SecurityLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}

type AnomalyRecommendation = 'allow' | 'monitor' | 'challenge' | 'block';

interface AnomalyDimension {
  name: string;
  score: number;
  weight: number;
}

interface AnomalyEvent {
  timestamp: number;
  ip: string;
  userId?: string;
  url: string;
  score: number;
  recommendation: AnomalyRecommendation;
  dimensions: AnomalyDimension[];
}

interface AnomalyListData {
  total: number;
  list: AnomalyEvent[];
}

interface WatchedIp {
  ip: string;
  score: number;
  reasons: string[];
}

interface RecentBlock {
  ip: string;
  score: number;
  duration: string;
  timestamp: number;
}

interface ThreatStats {
  totalChecks: number;
  totalAutoBlocks: number;
  totalWarnings: number;
  watchedIps: WatchedIp[];
  recentBlocks: RecentBlock[];
}

// === CLI options 类型 ===

interface AuditOptions {
  page?: string;
  pageSize?: string;
  json?: boolean;
}

interface ScanOptions {
  path?: string;
  limit?: string;
  offset?: string;
  minScore?: string;
  json?: boolean;
}

interface ReportOptions {
  json?: boolean;
}

// === 类型守卫 ===

function isSecurityLogEntry(v: unknown): v is SecurityLogEntry {
  return (
    typeof v === 'object' &&
    v !== null &&
    'id' in v &&
    typeof (v as { id: unknown }).id === 'string' &&
    'userId' in v &&
    typeof (v as { userId: unknown }).userId === 'string' &&
    'action' in v &&
    typeof (v as { action: unknown }).action === 'string' &&
    'createdAt' in v
  );
}

function isAuditListData(v: unknown): v is AuditListData {
  return (
    typeof v === 'object' &&
    v !== null &&
    'list' in v &&
    Array.isArray((v as { list: unknown }).list) &&
    'total' in v
  );
}

function isAnomalyEvent(v: unknown): v is AnomalyEvent {
  return (
    typeof v === 'object' &&
    v !== null &&
    'ip' in v &&
    typeof (v as { ip: unknown }).ip === 'string' &&
    'score' in v &&
    typeof (v as { score: unknown }).score === 'number' &&
    'recommendation' in v
  );
}

function isAnomalyListData(v: unknown): v is AnomalyListData {
  return (
    typeof v === 'object' &&
    v !== null &&
    'list' in v &&
    Array.isArray((v as { list: unknown }).list) &&
    'total' in v
  );
}

function isThreatStats(v: unknown): v is ThreatStats {
  return (
    typeof v === 'object' &&
    v !== null &&
    'totalChecks' in v &&
    typeof (v as { totalChecks: unknown }).totalChecks === 'number' &&
    'totalAutoBlocks' in v &&
    typeof (v as { totalAutoBlocks: unknown }).totalAutoBlocks === 'number'
  );
}

// === 参数校验 ===

function parsePositiveInt(v: string | undefined, fallback: number, max: number, label: string): number {
  if (v === undefined) return fallback;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`无效的 ${label} "${v}",必须为正整数`);
  }
  return Math.min(n, max);
}

function parseNonNegativeInt(v: string | undefined, fallback: number, label: string): number {
  if (v === undefined) return fallback;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`无效的 ${label} "${v}",必须为非负整数`);
  }
  return n;
}

function parseScore(v: string | undefined, label: string): number | undefined {
  if (v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    throw new Error(`无效的 ${label} "${v}",合法范围 0-100`);
  }
  return n;
}

// === 格式化工具 ===

const dateFmt = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

function formatTimestamp(ts: number | string): string {
  const d = typeof ts === 'number' ? new Date(ts) : new Date(ts);
  return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d);
}

/** 推荐等级 → 颜色标签。 */
function recommendationLabel(r: AnomalyRecommendation): string {
  switch (r) {
    case 'allow':
      return chalk.green('allow');
    case 'monitor':
      return chalk.yellow('monitor');
    case 'challenge':
      return chalk.magenta('challenge');
    case 'block':
      return chalk.red('block');
    default:
      return String(r);
  }
}

// ==================== audit ====================

async function auditSecurity(
  baseUrl: string,
  page: number,
  pageSize: number,
  asJson: boolean,
  apiKey?: string,
): Promise<void> {
  const path = `/audit?page=${page}&pageSize=${pageSize}`;
  const resp = await apiRequest(baseUrl, path, { apiKey });

  if (asJson) {
    printJson(resp);
    return;
  }

  const data = extractData(resp);
  if (!isAuditListData(data)) {
    console.error(chalk.red('✗ 响应格式异常,缺少 list 字段'));
    process.exitCode = 1;
    return;
  }

  const list = data.list.filter(isSecurityLogEntry);
  const total = typeof data.total === 'number' ? data.total : list.length;

  if (list.length === 0) {
    console.info(chalk.dim('(暂无安全审计日志)'));
    return;
  }

  console.info('');
  for (const e of list) {
    const action = (e.action ?? '').slice(0, ACTION_TRUNCATE_LEN);
    const ip = e.ip ?? '-';
    console.info(
      `[${chalk.cyan(e.id.slice(0, 8))}] ${chalk.bold(action)} ${chalk.dim('ip=' + ip)} ${chalk.dim(formatTimestamp(e.createdAt))}`,
    );
  }
  console.info(chalk.dim(`\n共 ${total} 条审计日志(第 ${page} 页,每页 ${pageSize} 条)`));
}

// ==================== scan ====================

async function scanSecurity(
  baseUrl: string,
  opts: ScanOptions,
  asJson: boolean,
  apiKey?: string,
): Promise<void> {
  const limit = parsePositiveInt(opts.limit, 50, 200, 'limit');
  const offset = parseNonNegativeInt(opts.offset, 0, 'offset');
  const minScore = parseScore(opts.minScore, 'min-score');

  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  if (minScore !== undefined) params.set('minScore', String(minScore));
  // --path 映射到 anomalies 端点的 ip 过滤器(扫描目标 IP)
  if (opts.path) params.set('ip', opts.path);

  const path = `/anomalies?${params.toString()}`;
  const resp = await apiRequest(baseUrl, path, { apiKey });

  if (asJson) {
    printJson(resp);
    return;
  }

  const data = extractData(resp);
  if (!isAnomalyListData(data)) {
    console.error(chalk.red('✗ 响应格式异常,缺少 list 字段'));
    process.exitCode = 1;
    return;
  }

  const list = data.list.filter(isAnomalyEvent);
  const total = typeof data.total === 'number' ? data.total : list.length;

  if (list.length === 0) {
    console.info(chalk.dim('(未扫描到异常事件)'));
    return;
  }

  console.info('');
  for (const e of list) {
    const dims = e.dimensions?.map((d) => `${d.name}:${d.score}`).join(' ') ?? '';
    console.info(
      `[${recommendationLabel(e.recommendation)}] ${chalk.bold('score=' + e.score)} ${chalk.dim('ip=' + e.ip)} ${chalk.dim(e.url)} ${chalk.dim(formatTimestamp(e.timestamp))}`,
    );
    if (dims) console.info(chalk.dim(`    维度: ${dims}`));
  }
  console.info(chalk.dim(`\n共 ${total} 条异常事件${opts.path ? `(过滤 ip=${opts.path})` : ''}`));
}

// ==================== report ====================

async function reportSecurity(
  baseUrl: string,
  asJson: boolean,
  apiKey?: string,
): Promise<void> {
  const resp = await apiRequest(baseUrl, '/threat-dashboard', { apiKey });

  if (asJson) {
    printJson(resp);
    return;
  }

  const data = extractData(resp);
  if (!isThreatStats(data)) {
    console.error(chalk.red('✗ 响应格式异常,缺少 totalChecks 字段'));
    process.exitCode = 1;
    return;
  }

  console.info('');
  console.info(chalk.bold('威胁监控仪表盘'));
  console.info(
    `  检测次数: ${chalk.cyan(data.totalChecks)}  自动封禁: ${chalk.red(data.totalAutoBlocks)}  告警: ${chalk.yellow(data.totalWarnings)}`,
  );

  const watched = Array.isArray(data.watchedIps) ? data.watchedIps : [];
  const blocks = Array.isArray(data.recentBlocks) ? data.recentBlocks : [];

  if (watched.length > 0) {
    console.info(chalk.yellow(`\n监控中 IP(${watched.length}):`));
    for (const w of watched) {
      const reasons = (w.reasons ?? []).join(',');
      console.info(`  ${chalk.bold(w.ip)} score=${w.score} ${chalk.dim(reasons)}`);
    }
  }

  if (blocks.length > 0) {
    console.info(chalk.red(`\n最近封禁(${blocks.length}):`));
    for (const b of blocks) {
      console.info(
        `  ${chalk.bold(b.ip)} score=${b.score} ${chalk.dim(b.duration)} ${chalk.dim(formatTimestamp(b.timestamp))}`,
      );
    }
  }

  if (watched.length === 0 && blocks.length === 0) {
    console.info(chalk.dim('\n(无监控中 IP 与最近封禁记录)'));
  }
}

// ==================== 命令注册 ====================

/**
 * 在根 program 上注册 `security` 命令组。
 * 使用全局 `--api-url` / `--api-key` 或 settings.json 解析后端地址。
 */
export function registerSecurityCommand(program: Command): void {
  const secCmd = program
    .command('security')
    .description('安全审计 (对标 Web 端 /security-audit)');

  secCmd
    .command('audit')
    .description('安全审计日志报告 (用户级)')
    .option('--page <n>', '页码(默认 1)', '1')
    .option('--page-size <n>', '每页数量(默认 20)', '20')
    .option('--json', '以 JSON 格式输出完整响应')
    .action(async (opts: AuditOptions) => {
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
        const page = parsePositiveInt(opts.page, 1, 10000, 'page');
        const pageSize = parsePositiveInt(opts.pageSize, 20, 100, 'page-size');
        await auditSecurity(baseUrl, page, pageSize, Boolean(opts.json), apiKey);
      } catch (err) {
        handleError('security audit', err);
      }
    });

  secCmd
    .command('scan')
    .description('扫描异常事件 (admin 级,支持按 IP 过滤)')
    .option('--path <ip>', '扫描目标 IP(过滤异常事件)')
    .option('--limit <n>', '最大返回条数(默认 50,上限 200)', '50')
    .option('--offset <n>', '偏移量(默认 0)')
    .option('--min-score <n>', '最低风险评分过滤(0-100)')
    .option('--json', '以 JSON 格式输出完整响应')
    .action(async (opts: ScanOptions) => {
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
        await scanSecurity(baseUrl, opts, Boolean(opts.json), apiKey);
      } catch (err) {
        handleError('security scan', err);
      }
    });

  secCmd
    .command('report')
    .description('威胁监控仪表盘历史报告 (admin 级)')
    .option('--json', '以 JSON 格式输出完整响应')
    .action(async (opts: ReportOptions) => {
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
        await reportSecurity(baseUrl, Boolean(opts.json), apiKey);
      } catch (err) {
        handleError('security report', err);
      }
    });
}
