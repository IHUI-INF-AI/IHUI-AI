/**
 * ihui registry upgrade — 升级已安装的 registry 资源(订阅自动 pull 升级)。
 *
 * 用法:
 *   ihui registry upgrade [--all] [--type <mcp|skill|plugin>]
 *
 * 默认(订阅自动 pull 升级):
 *   1. 读取本地安装清单 ~/.ihui/registry-installs.json
 *   2. 拉取 registry 最新版本,对比本地版本
 *   3. 本地版本落后 → 自动调用 install 拉取新版本,并更新清单
 *   4. 输出升级报告
 *
 * --all:同时触发服务端批量升级(POST /api/registry/upgrade-all,管理员)。
 */

import { Command } from 'commander';
import chalk from 'chalk';
import {
  RegistryClient,
  loadInstalls,
  recordInstall,
  getInstallsManifestPath,
} from '../lib/registry-client.js';
import { resolveEffectiveConfig } from './settings.js';
import { compareVersions } from '../updater.js';
import type { RegistrySourceType } from '@ihui/types';

interface UpgradeOpts {
  all?: boolean;
  type?: RegistrySourceType;
}

export function upgradeCommand(): Command {
  const cmd = new Command('upgrade');
  cmd
    .description('升级已安装的 registry 资源(对比本地清单与 registry 最新版本,自动 pull)')
    .option('--all', '同时触发服务端批量升级(管理员)')
    .option('--type <type>', '仅升级指定类型: mcp|skill|plugin')
    .action(async (options: UpgradeOpts) => {
      const cfg = resolveEffectiveConfig({});
      const client = new RegistryClient(cfg.apiUrl, cfg.apiKey || undefined);

      const installs = loadInstalls();
      const filtered = options.type
        ? installs.filter((i) => i.sourceType === options.type)
        : installs;

      console.info(chalk.cyan('\n检查已安装资源的版本更新...'));
      console.info(chalk.dim(`  本地清单: ${getInstallsManifestPath()}`));
      console.info(
        chalk.dim(
          `  已安装: ${installs.length} 个${options.type ? `,过滤 type=${options.type} 后 ${filtered.length} 个` : ''}`,
        ),
      );

      let upgraded = 0;
      let skipped = 0;
      let failed = 0;
      const errors: string[] = [];

      if (filtered.length > 0) {
        // 按类型拉取 registry 最新版本,构建 sourceId → latest version 映射
        const latestMap = new Map<string, string>();
        const types: RegistrySourceType[] = options.type
          ? [options.type]
          : ['mcp', 'skill', 'plugin'];
        for (const t of types) {
          const res = await client.list({ sourceType: t, pageSize: 100 });
          if (res) {
            for (const it of res.items) {
              if (it.version) latestMap.set(`${t}:${it.sourceId}`, it.version);
            }
          }
        }

        for (const inst of filtered) {
          const key = `${inst.sourceType}:${inst.sourceId}`;
          const latest = latestMap.get(key);
          if (!latest) {
            skipped++;
            console.info(chalk.dim(`  ⊘ ${key}:registry 中未找到,跳过`));
            continue;
          }
          // 已安装版本为 'latest' 视为始终最新
          if (inst.version === 'latest') {
            skipped++;
            console.info(chalk.dim(`  ⊘ ${key}:已安装 latest,跳过`));
            continue;
          }
          const cmp = compareVersions(inst.version, latest);
          if (cmp >= 0) {
            skipped++;
            console.info(chalk.dim(`  ⊘ ${key}:已是最新 (${inst.version})`));
            continue;
          }
          // 有新版本 → 自动 pull 升级
          console.info(chalk.cyan(`  ↑ ${key}: ${inst.version} → ${latest}`));
          const result = await client.install(inst.sourceType, inst.sourceId, latest);
          if (result && result.success && result.installed) {
            upgraded++;
            recordInstall({
              sourceType: inst.sourceType,
              sourceId: inst.sourceId,
              version: result.version ?? latest,
              installedAt: new Date().toISOString(),
            });
            console.info(chalk.green(`    ✓ ${result.message}`));
          } else {
            failed++;
            const msg = result?.message ?? '安装失败';
            errors.push(`${key}: ${msg}`);
            console.info(chalk.red(`    ✗ ${msg}`));
          }
        }

        console.info('');
        console.info(chalk.cyan('本地升级报告(自动 pull):'));
        console.info(`  升级: ${chalk.green(`${upgraded} 个`)}`);
        console.info(`  跳过: ${chalk.dim(`${skipped} 个`)}`);
        console.info(`  失败: ${chalk.red(`${failed} 个`)}`);
        if (errors.length > 0) {
          for (const e of errors) console.info(chalk.dim(`    - ${e}`));
        }
      } else {
        console.info(chalk.dim('  无已安装资源,跳过本地升级。'));
        console.info(chalk.dim('  提示:运行 `ihui registry install <name>` 安装资源。'));
      }

      // --all:同时触发服务端批量升级
      if (options.all) {
        console.info(chalk.cyan('\n触发服务端批量升级(POST /api/registry/upgrade-all)...'));
        const resp = await client.upgradeAll(options.type);
        if (!resp) {
          console.info(chalk.yellow('⚠ 服务端批量升级失败:无法连接或无权限(需管理员)。'));
        } else {
          console.info(
            chalk.green(`✓ ${resp.upgraded} 升级, ${resp.skipped} 跳过, ${resp.failed} 失败`),
          );
          for (const d of resp.details) {
            const icon = d.status === 'upgraded' ? '✓' : d.status === 'failed' ? '✗' : '⊘';
            console.info(chalk.dim(`  ${icon} ${d.sourceId}: ${d.message}`));
          }
        }
      }
      console.info('');
    });
  return cmd;
}
