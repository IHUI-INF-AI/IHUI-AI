/**
 * ihui registry logs — 查看资源上游同步日志(MCP/Skill/Plugin)。
 *
 * 用法:
 *   ihui registry logs [--type <mcp|skill|plugin>] [--status <success|fail|skipped|running>] [--page <n>] [--size <n>]
 *
 * 网络失败时输出错误但不退出非零(降级处理,与 registry-list 一致)。
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { resolveEffectiveConfig } from './settings.js';
import type {
  RegistrySyncLog,
  RegistrySyncLogListResponse,
  RegistrySyncStatus,
  RegistrySourceType,
} from '@ihui/types';

const FETCH_TIMEOUT_MS = 15_000;

interface LogsOpts {
  type?: RegistrySourceType;
  status?: RegistrySyncStatus;
  page?: string;
  size?: string;
}

function colorStatus(status: RegistrySyncStatus): string {
  switch (status) {
    case 'success':
      return chalk.green(status);
    case 'fail':
      return chalk.red(status);
    case 'skipped':
      return chalk.yellow(status);
    case 'running':
      return chalk.blue(status);
    default:
      return status;
  }
}

export function logsCommand(): Command {
  const cmd = new Command('logs');
  cmd
    .description('查看资源上游同步日志(success/fail/skipped/running)')
    .option('--type <type>', '资源类型: mcp|skill|plugin')
    .option('--status <status>', '同步状态: success|fail|skipped|running')
    .option('--page <n>', '页码(默认 1)', '1')
    .option('--size <n>', '每页条数(默认 20)', '20')
    .action(async (options: LogsOpts) => {
      const cfg = resolveEffectiveConfig({});
      const headers: Record<string, string> = cfg.apiKey
        ? { Authorization: `Bearer ${cfg.apiKey}` }
        : {};

      const page = parseInt(options.page ?? '1', 10);
      const size = parseInt(options.size ?? '20', 10);
      const safePage = Number.isFinite(page) && page > 0 ? page : 1;
      const safeSize = Number.isFinite(size) && size > 0 ? size : 20;

      const qs = new URLSearchParams();
      if (options.type) qs.set('sourceType', options.type);
      if (options.status) qs.set('status', options.status);
      qs.set('page', String(safePage));
      qs.set('pageSize', String(safeSize));

      let result: RegistrySyncLogListResponse | null = null;
      try {
        const res = await fetch(
          `${cfg.apiUrl}/api/registry/sync-logs?${qs.toString()}`,
          {
            headers,
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          },
        );
        if (res.ok) {
          const json = (await res.json()) as { data?: RegistrySyncLogListResponse };
          result = json.data ?? null;
        }
      } catch {
        result = null;
      }

      if (!result) {
        console.info(chalk.yellow('⚠ 无法连接到 registry 服务。'));
        console.info(chalk.dim(`  API: ${cfg.apiUrl}`));
        console.info('');
        return;
      }

      if (result.logs.length === 0) {
        console.info(chalk.dim('未找到匹配的同步日志。'));
        return;
      }

      console.info(
        chalk.cyan(`\n📋 同步日志(第 ${result.page} 页,共 ${result.total} 条):`),
      );
      const rows = result.logs.map((log: RegistrySyncLog) => ({
        SOURCE_TYPE: log.sourceType,
        SOURCE_NAME: log.sourceName,
        STATUS: colorStatus(log.status),
        NEW_VERSION: log.newVersion ?? '-',
        DURATION_MS: log.durationMs,
        STARTED_AT: log.startedAt,
      }));
      console.table(rows);

      const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
      console.info(
        chalk.dim(`  共 ${result.total} 条,第 ${result.page}/${totalPages} 页(每页 ${result.pageSize} 条)`),
      );
      console.info('');
    });
  return cmd;
}
