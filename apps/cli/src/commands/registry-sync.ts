/**
 * ihui registry sync — 触发上游资源同步(MCP/Skill/Plugin)。
 *
 * 用法:
 *   ihui registry sync [--type <mcp|skill|plugin>] [--source <github|npm|mcp_marketplace|custom>] [--force]
 *
 * 网络失败时输出错误但不退出非零(降级处理,与 SkillSyncClient 一致)。
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { RegistryClient } from '../lib/registry-client.js';
import { resolveEffectiveConfig } from './settings.js';
import type { RegistrySourceType, RegistryUpstreamSource } from '@ihui/types';

interface SyncOpts {
  type?: RegistrySourceType;
  source?: RegistryUpstreamSource;
  force?: boolean;
}

export function syncCommand(): Command {
  const cmd = new Command('sync');
  cmd
    .description('触发上游资源同步(MCP/Skill/Plugin),需管理员权限')
    .option('--type <type>', '资源类型: mcp|skill|plugin')
    .option('--source <source>', '上游源: github|npm|mcp_marketplace|custom')
    .option('--force', '强制全量同步(忽略 payload_hash 跳过)')
    .action(async (options: SyncOpts) => {
      const cfg = resolveEffectiveConfig({});
      const client = new RegistryClient(cfg.apiUrl, cfg.apiKey || undefined);

      console.info(chalk.cyan('\n触发上游资源同步...'));
      if (options.type) console.info(chalk.dim(`  类型: ${options.type}`));
      if (options.source) console.info(chalk.dim(`  上游: ${options.source}`));
      if (options.force) console.info(chalk.dim('  强制: 是'));

      const result = await client.sync(options.type, options.source, options.force);
      if (!result) {
        console.info(chalk.yellow('⚠ 无法连接到 registry 服务,同步失败(降级退出)。'));
        console.info(chalk.dim(`  API: ${cfg.apiUrl}`));
        console.info('');
        return;
      }

      console.info(chalk.green(`✓ ${result.message}`));
      console.info(chalk.dim(`  jobId: ${result.jobId ?? '-'}`));
      console.info('  统计:');
      console.info(`    synced:  ${result.stats.synced}`);
      console.info(`    failed:  ${result.stats.failed}`);
      console.info(`    skipped: ${result.stats.skipped}`);
      console.info(`    耗时:    ${result.stats.durationMs}ms`);
      console.info('');
    });
  return cmd;
}
