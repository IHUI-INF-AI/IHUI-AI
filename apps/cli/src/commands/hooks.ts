/**
 * ihui hooks 子命令 — 列出已配置的 pre/post tool hooks。
 */

import type { Command } from 'commander';
import chalk from 'chalk';
import { loadHooks, getHooksPath } from '../hooks/index.js';

export function registerHooksCommand(program: Command): void {
  const hooksCmd = program.command('hooks').description('查看已配置的 tool hooks');

  hooksCmd
    .command('list')
    .description('列出 preToolCall / postToolCall 钩子')
    .action(() => {
      const config = loadHooks();
      const configPath = getHooksPath();
      const pre = config.preToolCall ?? [];
      const post = config.postToolCall ?? [];

      if (pre.length === 0 && post.length === 0) {
        console.info(chalk.dim('\n无已配置的 hooks'));
        console.info(chalk.dim(`  配置文件: ${configPath}`));
        console.info(chalk.dim('  示例:'));
        console.info(chalk.dim('  {'));
        console.info(chalk.dim('    "preToolCall": ['));
        console.info(chalk.dim('      { "name": "block-rm", "command": "exit 1", "matchTool": "bash" }'));
        console.info(chalk.dim('    ]'));
        console.info(chalk.dim('  }'));
        console.info('');
        return;
      }

      console.info(chalk.cyan(`\nHooks 配置 (${configPath}):`));

      if (pre.length > 0) {
        console.info(chalk.cyan('\n  preToolCall:'));
        for (const h of pre) {
          const match = h.matchTool ? chalk.dim(` (match: ${h.matchTool})`) : '';
          const block = h.blockOnError !== false ? chalk.yellow(' [阻断]') : '';
          console.info(`    ${chalk.bold(h.name)}${match}${block}`);
          console.info(`      ${chalk.dim(h.command)}`);
        }
      }

      if (post.length > 0) {
        console.info(chalk.cyan('\n  postToolCall:'));
        for (const h of post) {
          const match = h.matchTool ? chalk.dim(` (match: ${h.matchTool})`) : '';
          console.info(`    ${chalk.bold(h.name)}${match}`);
          console.info(`      ${chalk.dim(h.command)}`);
        }
      }
      console.info('');
    });
}
