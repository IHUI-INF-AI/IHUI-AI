/**
 * ihui registry install — 安装 registry 资源(按 name 查找)。
 *
 * 用法:
 *   ihui registry install <name> [--type <mcp|skill|plugin>] [--version <版本>]
 *
 * 流程:先 list 模糊查找匹配 name 的条目 → 调用 install → 写入本地安装清单
 * (清单供 upgrade 子命令实现"订阅自动 pull 升级")。
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { RegistryClient, recordInstall } from '../lib/registry-client.js';
import { resolveEffectiveConfig } from './settings.js';
import type { RegistrySourceType } from '@ihui/types';

interface InstallOpts {
  type?: RegistrySourceType;
  version?: string;
}

export function installCommand(): Command {
  const cmd = new Command('install');
  cmd
    .description('安装 registry 资源(按 name 查找)')
    .argument('<name>', '资源名称(模糊匹配 name/sourceId)')
    .option('--type <type>', '资源类型: mcp|skill|plugin')
    .option('--version <ver>', '指定版本(默认 latest)')
    .action(async (name: string, options: InstallOpts) => {
      const cfg = resolveEffectiveConfig({});
      const client = new RegistryClient(cfg.apiUrl, cfg.apiKey || undefined);

      const list = await client.list({ q: name, sourceType: options.type, pageSize: 50 });
      if (!list) {
        console.info(chalk.yellow('⚠ 无法连接到 registry 服务。'));
        console.info(chalk.dim(`  API: ${cfg.apiUrl}`));
        console.info('');
        return;
      }

      // 精确匹配 name 优先,否则取第一个搜索结果
      const exact = list.items.find((i) => i.name === name);
      const item = exact ?? list.items[0];
      if (!item) {
        console.info(
          chalk.red(`✗ 未找到匹配 "${name}" 的资源${options.type ? ` (type=${options.type})` : ''}`),
        );
        return;
      }

      console.info(chalk.cyan(`\n安装 ${item.name} (${item.sourceType})...`));
      console.info(chalk.dim(`  sourceId: ${item.sourceId}`));
      console.info(chalk.dim(`  最新版本: ${item.version ?? 'latest'}`));
      if (options.version) console.info(chalk.dim(`  指定版本: ${options.version}`));

      const result = await client.install(item.sourceType, item.sourceId, options.version);
      if (!result) {
        console.info(chalk.yellow('⚠ 安装失败:无法连接到 registry 服务。'));
        console.info('');
        return;
      }
      if (!result.success || !result.installed) {
        console.info(chalk.red(`✗ 安装失败: ${result.message}`));
        return;
      }

      // 写入本地安装清单(供 upgrade 子命令对比版本)
      recordInstall({
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        version: result.version ?? options.version ?? item.version ?? 'latest',
        installedAt: new Date().toISOString(),
      });

      console.info(chalk.green(`✓ ${result.message}`));
      console.info(chalk.dim(`  已安装版本: ${result.version ?? '-'}`));
      console.info('');
    });
  return cmd;
}
