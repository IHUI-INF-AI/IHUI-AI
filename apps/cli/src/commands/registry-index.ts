/**
 * ihui registry — 资源上游同步中心,管理 MCP/Skill/Plugin 资源。
 *
 * 子命令:
 *   ihui registry sync      触发上游同步(管理员)
 *   ihui registry list      列出资源(支持排序/过滤/搜索)
 *   ihui registry install   安装资源(按 name 查找)
 *   ihui registry upgrade   升级已安装资源(含订阅自动 pull 逻辑)
 *   ihui registry logs      查看同步日志(管理员)
 *   ihui registry webhook   管理 webhook 触发记录(管理员)
 *   ihui registry worker-stats  查看 Worker 运行时指标(管理员)
 *
 * 命令注册入口:主 agent 在 apps/cli/src/index.ts 中调用
 *   program.addCommand(registryCommand());
 * 即可接入(不修改现有命令)。
 */

import { Command } from 'commander';
import { syncCommand } from './registry-sync.js';
import { listCommand } from './registry-list.js';
import { installCommand } from './registry-install.js';
import { upgradeCommand } from './registry-upgrade.js';
import { logsCommand } from './registry-logs.js';
import { webhookCommand } from './registry-webhook.js';
import { workerStatsCommand } from './registry-worker-stats.js';

export function registryCommand(): Command {
  const cmd = new Command('registry').description(
    '资源上游同步中心 - MCP/Skill/Plugin 资源管理',
  );
  cmd.addCommand(syncCommand());
  cmd.addCommand(listCommand());
  cmd.addCommand(installCommand());
  cmd.addCommand(upgradeCommand());
  cmd.addCommand(logsCommand());
  cmd.addCommand(webhookCommand());
  cmd.addCommand(workerStatsCommand());
  return cmd;
}
