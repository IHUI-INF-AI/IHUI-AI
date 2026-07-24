/**
 * ihui registry worker-stats — 查看 Worker 运行时指标(管理员)。
 *
 * 用法:
 *   ihui registry worker-stats
 *
 * 网络失败时输出错误但不退出非零(降级处理,与 registry-logs 一致)。
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { resolveEffectiveConfig } from './settings.js';
import type { RegistryWorkerStats } from '@ihui/types';

const FETCH_TIMEOUT_MS = 15_000;

export function workerStatsCommand(): Command {
  const cmd = new Command('worker-stats');
  cmd
    .description('查看 Worker 运行时指标(已处理/失败/最近处理时间)')
    .action(async () => {
      const cfg = resolveEffectiveConfig({});
      const headers: Record<string, string> = cfg.apiKey
        ? { Authorization: `Bearer ${cfg.apiKey}` }
        : {};

      let stats: RegistryWorkerStats | null = null;
      try {
        const res = await fetch(
          `${cfg.apiUrl}/api/registry/worker-stats`,
          {
            headers,
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          },
        );
        if (res.ok) {
          const json = (await res.json()) as { data?: RegistryWorkerStats };
          stats = json.data ?? null;
        }
      } catch {
        stats = null;
      }

      if (!stats) {
        console.info(chalk.yellow('⚠ 无法连接到 registry 服务(或无管理员权限)。'));
        console.info(chalk.dim(`  API: ${cfg.apiUrl}`));
        console.info('');
        return;
      }

      console.info(chalk.cyan('\n⚙️  Worker 运行时指标:'));
      console.info(`  ${chalk.bold('已处理任务')}: ${chalk.green(stats.processed)} 次`);
      console.info(
        `  ${chalk.bold('失败任务')}: ${stats.failed > 0 ? chalk.red(stats.failed) : chalk.green(stats.failed)} 次`,
      );
      console.info(
        `  ${chalk.bold('最近处理')}: ${stats.lastProcessedAt ? new Date(stats.lastProcessedAt).toLocaleString() : chalk.gray('从未')}`,
      );

      // 成功率计算
      const total = stats.processed + stats.failed;
      if (total > 0) {
        const successRate = ((stats.processed / total) * 100).toFixed(1);
        const rate =
          parseFloat(successRate) >= 95
            ? chalk.green
            : parseFloat(successRate) >= 80
              ? chalk.yellow
              : chalk.red;
        console.info(
          `  ${chalk.bold('成功率')}: ${rate(`${successRate}%`)} (${stats.processed}/${total})`,
        );
      }
      console.info('');
    });
  return cmd;
}
