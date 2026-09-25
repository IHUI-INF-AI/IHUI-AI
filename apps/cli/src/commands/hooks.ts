// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ihui hooks 子命令 — Hook 管理命令(Wave 3 W3-4 升级)。
 *
 * 子命令:
 *   ihui hooks list              — 列出全部 hooks(手动配置 + 自动发现)+ 已信任目录
 *   ihui hooks enable <name>     — 启用自动发现的 hook
 *   ihui hooks disable <name>    — 禁用自动发现的 hook
 *   ihui hooks trust [path]      — 信任一个目录**当时那份**钩子内容,让它自带的 project 钩子可执行
 *   ihui hooks untrust <path>    — 取消信任
 *
 * 为什么必须有 trust / untrust:项目钩子派发前过信任门
 * (`src/hooks/index.ts` 的 `hookTrustSkipReason` → `trust.ts` 的 `gateHook`),
 * 而 default-deny 之下用户唯一的出路本来是手写 `~/.ihui/trusted-folders` ——
 * 那不是一个可用出口。门与出口必须同时存在,否则这道门只会把人推向
 * `IHUI_TRUST_WORKSPACE=1`(它信任的是整个工作区,粒度比单个目录粗)。
 *
 * 为什么 trust 要带内容摘要(A20):只记"这个目录批过"时,批准一次就永久有效 ——
 * 之后往它的 hooks.json 里塞任何命令都不再问一次。所以 `ihui hooks trust` 落的是
 * "目录 + 当时那份内容的摘要",`hooks list` 也据此报出"内容是否已变"。
 * 门里那句"请重新执行 ihui hooks trust"必须是**真能解掉**的状态:目录已在名单里而
 * 内容变了时,这一句会把记录刷新成当前内容,而不是回一句"已在名单里"什么都不做
 * (那是第二条死出口,与上一轮的"文案指向不存在的子命令"同型)。
 *
 * 与 hooks-auto 子命令的关系:
 *   - hooks list/enable/disable:轻量管理(基于 hooks.json + discovery.ts 状态)
 *   - hooks-auto list/run/watch:完整执行(沙箱执行 + 热重载,基于 hooks-auto.ts)
 *
 * 2026-07-22 升级:集成 discovery.ts,新增 enable/disable 子命令 + 自动发现 hooks 列表。
 */
import type { Command } from 'commander';
import chalk from 'chalk';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { loadHooks, getHooksPath, computeHookContentDigests } from '../hooks/index.js';
import {
  listDiscoveredHooks,
  enableHook,
  disableHook,
  getHooksDirs,
  type DiscoveredHook,
} from '../hooks/discovery.js';
import {
  trustFolder,
  untrustFolder,
  isFolderTrusted,
  listTrustedFolders,
  normalizeFolderPath,
  gateHook,
} from '../hooks/trust.js';
import { t } from '../i18n/index.js';

/** 类型显示颜色映射 */
const TYPE_COLORS: Record<DiscoveredHook['type'], (s: string) => string> = {
  pre_tool: chalk.cyan,
  post_tool: chalk.blue,
  pre_session: chalk.magenta,
  post_session: chalk.magenta,
  on_error: chalk.red,
  unknown: chalk.gray,
};

/**
 * 「这条信任对应哪份内容 / 内容是否已变」—— 展示侧不另立判据,逐条走 gateHook。
 * 与派发时同一把尺子:列表里说"一致"的条目,派发时一定放行;说不一致的,派发时一定拦。
 * (两处各写一遍比对逻辑 = 一份"列表看着没事、跑起来被拦"的分叉,正是本仓反复登记的那一类。)
 */
function describeTrustedFolderContent(folder: string): { summary: string; details: string[] } {
  const digests = computeHookContentDigests(folder);
  const names = Object.keys(digests.declarations);
  if (names.length === 0) {
    return { summary: '当前无项目钩子声明可比对(新增声明后需重新取信)', details: [] };
  }
  const details: string[] = [];
  let same = 0;
  for (const name of names) {
    const g = gateHook(
      {
        name,
        bundleDigest: digests.bundleDigest,
        hookName: name,
        declarationDigest: digests.declarations[name],
      },
      folder,
    );
    if (g.allowed) same += 1;
    else details.push(`      ✗ ${name}:${g.detail ?? '内容未确认'}`);
  }
  return {
    summary:
      details.length === 0
        ? `${names.length} 条声明与批准时那份一致 · 束摘要 ${digests.bundleDigest.slice(-12)}`
        : `${same}/${names.length} 条一致 · 束摘要 ${digests.bundleDigest.slice(-12)}`,
    details,
  };
}

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

      // === 3. 已信任的目录(trust gate 的白名单)===
      // 门是 default-deny 的,所以"当前目录在不在名单里"必须能在 list 里看到,
      // 否则用户只能靠"钩子怎么没跑"反推。比较口径与门内 isFolderTrusted 同源。
      const trusted = listTrustedFolders();
      const cwd = resolve(process.cwd());
      const cwdKey = normalizeFolderPath(cwd);
      console.info(chalk.cyan(`\n${t('cli.hooks.trustedHeader')}`));
      if (trusted.length === 0) {
        console.info(chalk.dim(t('cli.hooks.trustedNone')));
      } else {
        for (const folder of trusted) {
          const isCurrent = normalizeFolderPath(folder) === cwdKey;
          console.info(
            `  ${isCurrent ? chalk.green('●') : ' '} ${folder}${isCurrent ? chalk.dim(t('cli.hooks.currentDirMark')) : ''}`,
          );
          // A20:名单只说"批过这个目录"是不够的,还得说得出"批的是哪份、现在还是不是那份"
          const content = describeTrustedFolderContent(folder);
          console.info(chalk.dim(`    ${content.summary}`));
          for (const line of content.details) console.info(chalk.yellow(line));
        }
      }
      if (!isFolderTrusted(cwd)) {
        console.info(chalk.dim(t('cli.hooks.currentDirUntrusted', { path: cwd })));
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

  // ihui hooks trust [path] — 信任一个目录(让它的 project 钩子可派发)
  hooksCmd
    .command('trust [path]')
    .description(t('cli.hooks.trustDesc'))
    .action((rawPath?: string) => {
      const target = resolve(rawPath ?? process.cwd());
      if (!existsSync(target)) {
        console.info(chalk.red(t('cli.hooks.trustErrNotDir', { path: target })));
        return;
      }
      // 批准的是「这个目录 + 它此刻这份内容」。摘要算法只有一处实现:
      // index.ts 的 computeHookContentDigests —— 派发门判定时调的是同一个函数,
      // 两侧各写一遍必然漂移(那会以假 stale 的形态出现,或更糟:以假放行出现)。
      const digests = computeHookContentDigests(target);
      // 只比束摘要(hookName 不传):判"这个目录现在这份配置,是不是当初批的那份"
      const probe = gateHook({ name: '<directory>', bundleDigest: digests.bundleDigest }, target);
      if (isFolderTrusted(target) && probe.allowed) {
        console.info(chalk.dim(t('cli.hooks.trustAlready', { path: target })));
        return;
      }
      if (!trustFolder(target, digests)) {
        console.info(chalk.red(t('cli.hooks.trustWriteFailed', { path: target })));
        return;
      }
      console.info(chalk.green(t('cli.hooks.trustOk', { path: target })));
      // 把"批准的是哪一份"打在屏幕上:内容再变就会被门拦下,而这里那串短值是当时唯一
      // 留存的凭据(完整摘要在 ~/.ihui/trusted-folders 里)。
      console.info(
        chalk.dim(
          `  已登记内容摘要 ${digests.bundleDigest.slice(-12)} · ${Object.keys(digests.declarations).length} 条钩子声明`,
        ),
      );
      if (!probe.allowed && isFolderTrusted(target)) {
        console.info(chalk.yellow('  （该目录原先已在名单里,已把批准刷新为当前这份内容）'));
      }
      console.info(chalk.yellow(t('cli.hooks.trustWarning')));
    });

  // ihui hooks untrust <path> — 取消信任
  hooksCmd
    .command('untrust <path>')
    .description(t('cli.hooks.untrustDesc'))
    .action((rawPath: string) => {
      const target = resolve(rawPath);
      if (!untrustFolder(target)) {
        console.info(chalk.dim(t('cli.hooks.untrustNotListed', { path: target })));
        return;
      }
      console.info(chalk.green(t('cli.hooks.untrustOk', { path: target })));
    });
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
