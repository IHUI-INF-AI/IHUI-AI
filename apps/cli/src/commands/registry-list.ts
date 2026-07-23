/**
 * ihui registry list — 列出 registry 资源(MCP/Skill/Plugin)。
 *
 * 用法:
 *   ihui registry list [--sort <latest|hot|best>] [--type <mcp|skill|plugin>] [--q <搜索词>] [--page <页码>]
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { RegistryClient } from '../lib/registry-client.js';
import { resolveEffectiveConfig } from './settings.js';
import type { RegistrySortKey, RegistrySourceType } from '@ihui/types';

interface ListOpts {
  sort?: RegistrySortKey;
  type?: RegistrySourceType;
  q?: string;
  page?: string;
}

export function listCommand(): Command {
  const cmd = new Command('list');
  cmd
    .description('列出 registry 资源(MCP/Skill/Plugin)')
    .option('--sort <key>', '排序: latest|hot|best', 'latest')
    .option('--type <type>', '资源类型: mcp|skill|plugin')
    .option('--q <keyword>', '模糊搜索(name/description/tags)')
    .option('--page <n>', '页码(默认 1)', '1')
    .action(async (options: ListOpts) => {
      const cfg = resolveEffectiveConfig({});
      const client = new RegistryClient(cfg.apiUrl, cfg.apiKey || undefined);

      const page = parseInt(options.page ?? '1', 10);
      const result = await client.list({
        sort: options.sort,
        sourceType: options.type,
        q: options.q,
        page: Number.isFinite(page) && page > 0 ? page : 1,
        pageSize: 30,
      });

      if (!result) {
        console.info(chalk.yellow('⚠ 无法连接到 registry 服务。'));
        console.info(chalk.dim(`  API: ${cfg.apiUrl}`));
        console.info('');
        return;
      }

      if (result.items.length === 0) {
        console.info(chalk.dim('未找到匹配的资源。'));
        return;
      }

      console.info(chalk.cyan(`\n📦 Registry 资源(第 ${result.page} 页,共 ${result.total} 条):`));
      const rows = result.items.map((it) => ({
        NAME: it.name,
        TYPE: it.sourceType,
        SOURCE: it.source,
        VERSION: it.version ?? '-',
        INSTALLS: it.installCount,
        HEAT: it.heatScore,
        QUALITY: it.qualityScore,
      }));
      console.table(rows);
      console.info(chalk.dim(`  已安装: ${result.installedIds.length} 个`));
      console.info('');
    });
  return cmd;
}
