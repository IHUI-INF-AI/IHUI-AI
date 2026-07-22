/**
 * ihui hooks 子命令 — Hook 管理命令(Wave 3 W3-4 升级)。
 *
 * 子命令:
 *   ihui hooks list              — 列出全部 hooks(手动配置 + 自动发现)
 *   ihui hooks enable <name>     — 启用自动发现的 hook
 *   ihui hooks disable <name>    — 禁用自动发现的 hook
 *
 * 与 hooks-auto 子命令的关系:
 *   - hooks list/enable/disable:轻量管理(基于 hooks.json + discovery.ts 状态)
 *   - hooks-auto list/run/watch:完整执行(沙箱执行 + 热重载,基于 hooks-auto.ts)
 *
 * 2026-07-22 升级:集成 discovery.ts,新增 enable/disable 子命令 + 自动发现 hooks 列表。
 */
import type { Command } from 'commander';
import chalk from 'chalk';
import { loadHooks, getHooksPath } from '../hooks/index.js';
import {
  listDiscoveredHooks,
  enableHook,
  disableHook,
  getHooksDirs,
  type DiscoveredHook,
} from '../hooks/discovery.js';

/** 类型显示颜色映射 */
const TYPE_COLORS: Record<DiscoveredHook['type'], (s: string) => string> = {
  pre_tool: chalk.cyan,
  post_tool: chalk.blue,
  pre_session: chalk.magenta,
  post_session: chalk.magenta,
  on_error: chalk.red,
  unknown: chalk.gray,
};

export function registerHooksCommand(program: Command): void {
  const hooksCmd = program.command('hooks').description('查看已配置的 tool hooks');

  // ihui hooks list — 列出全部 hooks(手动配置 + 自动发现)
  hooksCmd
    .command('list')
    .description('列出 preToolCall / postToolCall 钩子 + 自动发现的 hooks')
    .action(() => {
      // === 1. 手动配置的 hooks(hooks.json) ===
      const config = loadHooks();
      const configPath = getHooksPath();
      const pre = config.preToolCall ?? [];
      const post = config.postToolCall ?? [];

      console.info(chalk.cyan(`\nHooks 配置 (${configPath}):`));

      if (pre.length === 0 && post.length === 0) {
        console.info(chalk.dim('  无手动配置的 hooks'));
      }

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

      // === 2. 自动发现的 hooks(discovery.ts) ===
      const discovered = listDiscoveredHooks();
      const dirs = getHooksDirs();
      console.info(chalk.cyan('\n自动发现的 hooks:'));
      console.info(chalk.dim(`  CLI 目录: ${dirs.cli}`));
      console.info(chalk.dim(`  用户目录: ${dirs.user}`));

      if (discovered.length === 0) {
        console.info(chalk.dim('  无自动发现的 hooks'));
        console.info(chalk.dim('  在上述目录放入 .ts/.js/.mjs/.sh 文件即可自动发现'));
      } else {
        console.info('');
        for (const h of discovered) {
          const typeColor = TYPE_COLORS[h.type] ?? chalk.gray;
          const status = h.enabled
            ? chalk.green('✓ 启用')
            : chalk.red('✗ 禁用');
          const source = h.source === 'cli' ? chalk.dim('[cli]') : chalk.dim('[user]');
          console.info(
            `  ${status} ${source} ${chalk.bold(h.name)} ${typeColor(`(${h.type})`)} ${chalk.dim(`p=${h.priority}`)}`,
          );
          console.info(chalk.dim(`    ${h.filePath}`));
        }
      }
      console.info('');
    });

  // ihui hooks enable <name> — 启用自动发现的 hook
  hooksCmd
    .command('enable <name>')
    .description('启用自动发现的 hook(按 name 或 id 匹配)')
    .action((name: string) => {
      const ok = enableHook(name);
      if (ok) {
        console.info(chalk.green(`✓ 已启用 hook: ${name}`));
      } else {
        console.info(chalk.red(`✗ 未找到 hook: ${name}`));
        console.info(chalk.dim('  使用 `ihui hooks list` 查看可用 hooks'));
      }
    });

  // ihui hooks disable <name> — 禁用自动发现的 hook
  hooksCmd
    .command('disable <name>')
    .description('禁用自动发现的 hook(按 name 或 id 匹配)')
    .action((name: string) => {
      const ok = disableHook(name);
      if (ok) {
        console.info(chalk.yellow(`✓ 已禁用 hook: ${name}`));
      } else {
        console.info(chalk.red(`✗ 未找到 hook: ${name}`));
        console.info(chalk.dim('  使用 `ihui hooks list` 查看可用 hooks'));
      }
    });
}
