/**
 * `ihui checkpoint` 子命令 — 检查点管理。
 *
 * 用法:
 *   ihui checkpoint snapshot <file...> [--reason <r>] [--session <id>]
 *   ihui checkpoint list [--session <id>]
 *   ihui checkpoint restore <id> [--session <id>]
 *   ihui checkpoint diff [id] [--session <id>]
 *   ihui checkpoint delete <id> [--session <id>]
 */

import type { Command } from 'commander';
import chalk from 'chalk';
import * as crypto from 'node:crypto';
import { CheckpointManager } from '../checkpoints/index.js';
import { HunkCheckpointManager, type HunkRange } from '../checkpoints/hunks.js';

interface CheckpointOpts {
  session?: string;
  reason?: string;
}

interface HunkCheckpointOpts {
  session?: string;
  reason?: string;
  ranges?: string;
  idx?: string;
  all?: boolean;
}

function parseHunkRanges(rangesStr: string): HunkRange[] {
  const parts = rangesStr.split(',').map((s) => s.trim()).filter(Boolean);
  const ranges: HunkRange[] = [];
  for (const p of parts) {
    const m = /^(\d+)-(\d+)$/.exec(p);
    if (!m) throw new Error(`非法 hunk 范围: "${p}",应为 start-end 格式(如 2-5)`);
    const start = Number(m[1]!);
    const end = Number(m[2]!);
    if (start < 1 || end < start) {
      throw new Error(`非法 hunk 范围: "${p}",start>=1 且 end>=start`);
    }
    ranges.push({ start, end });
  }
  if (ranges.length === 0) throw new Error('至少需要一个 hunk 范围');
  return ranges;
}

export function registerCheckpointCommand(program: Command): void {
  const cpCmd = program
    .command('checkpoint')
    .description('检查点系统 — 工作区文件快照与回滚');

  cpCmd
    .command('snapshot <files...>')
    .description('为指定文件创建检查点快照')
    .option('-r, --reason <reason>', '快照原因', 'manual')
    .option('-s, --session <id>', '会话 ID')
    .action(async (files: string[], opts: CheckpointOpts) => {
      const rootOpts = program.opts();
      const ws: string = rootOpts.workspace ?? process.cwd();
      const sessionId = opts.session ?? `cli_${crypto.randomBytes(4).toString('hex')}`;
      const mgr = new CheckpointManager({ sessionId, workspacePath: ws });
      const meta = await mgr.snapshot(files, opts.reason ?? 'manual');
      console.info(chalk.green(`✓ 检查点已创建: ${meta.id}`));
      console.info(chalk.dim(`  会话: ${meta.sessionId}  原因: ${meta.reason}  文件: ${Object.keys(meta.files).length} 个`));
    });

  cpCmd
    .command('list')
    .description('列出当前会话的所有检查点')
    .option('-s, --session <id>', '会话 ID')
    .action((opts: CheckpointOpts) => {
      const rootOpts = program.opts();
      const ws: string = rootOpts.workspace ?? process.cwd();
      const sessionId = opts.session ?? 'cli_default';
      const mgr = new CheckpointManager({ sessionId, workspacePath: ws });
      const list = mgr.list();
      if (list.length === 0) {
        console.info(chalk.dim('暂无检查点'));
        return;
      }
      console.info(chalk.cyan(`\n检查点列表 (会话: ${sessionId}):`));
      for (const m of list) {
        const time = new Date(m.createdAt).toLocaleString();
        const fileCount = Object.keys(m.files).length;
        console.info(`  ${chalk.bold(m.id)}  ${chalk.dim(time)}  ${m.reason}  ${fileCount} 文件`);
      }
      console.info('');
    });

  cpCmd
    .command('restore <id>')
    .description('回滚到指定检查点')
    .option('-s, --session <id>', '会话 ID')
    .action(async (id: string, opts: CheckpointOpts) => {
      const rootOpts = program.opts();
      const ws: string = rootOpts.workspace ?? process.cwd();
      const sessionId = opts.session ?? 'cli_default';
      const mgr = new CheckpointManager({ sessionId, workspacePath: ws });
      const result = await mgr.restore(id);
      console.info(chalk.green(`✓ 已回滚到检查点: ${id}`));
      console.info(chalk.dim(`  恢复: ${result.restored.length} 个文件`));
      result.restored.forEach((f) => console.info(`    ${chalk.green('+')} ${f}`));
      if (result.removed.length > 0) {
        console.info(chalk.dim(`  移除(新建文件): ${result.removed.length} 个`));
        result.removed.forEach((f) => console.info(`    ${chalk.red('-')} ${f}`));
      }
    });

  cpCmd
    .command('diff [id]')
    .description('比较工作区与检查点(默认最近的检查点)')
    .option('-s, --session <id>', '会话 ID')
    .action((id: string | undefined, opts: CheckpointOpts) => {
      const rootOpts = program.opts();
      const ws: string = rootOpts.workspace ?? process.cwd();
      const sessionId = opts.session ?? 'cli_default';
      const mgr = new CheckpointManager({ sessionId, workspacePath: ws });
      const entries = mgr.diff(id);
      if (entries.length === 0) {
        console.info(chalk.dim('无差异'));
        return;
      }
      console.info(chalk.cyan('\n差异:'));
      for (const e of entries) {
        const icon = e.status === 'modified' ? chalk.yellow('M') : e.status === 'added' ? chalk.green('+') : chalk.red('-');
        console.info(`  ${icon} ${e.path}`);
      }
      console.info('');
    });

  cpCmd
    .command('delete <id>')
    .description('删除指定检查点')
    .option('-s, --session <id>', '会话 ID')
    .action((id: string, opts: CheckpointOpts) => {
      const rootOpts = program.opts();
      const ws: string = rootOpts.workspace ?? process.cwd();
      const sessionId = opts.session ?? 'cli_default';
      const mgr = new CheckpointManager({ sessionId, workspacePath: ws });
      if (mgr.delete(id)) {
        console.info(chalk.green(`✓ 已删除检查点: ${id}`));
      } else {
        console.info(chalk.red(`未找到检查点: ${id}`));
        process.exit(1);
      }
    });

  // ==================== Hunk 级 Checkpoints ====================

  cpCmd
    .command('hunk-snapshot <file>')
    .description('为指定文件的指定行范围创建 hunk 快照(--ranges 1-3,5-7 格式)')
    .option('-r, --reason <reason>', '快照原因', 'manual')
    .option('--ranges <ranges>', 'hunk 范围列表,格式 "start-end,start-end"', '1-1')
    .option('-s, --session <id>', '会话 ID')
    .action((file: string, opts: HunkCheckpointOpts) => {
      const rootOpts = program.opts();
      const ws: string = rootOpts.workspace ?? process.cwd();
      const sessionId = opts.session ?? `cli_${crypto.randomBytes(4).toString('hex')}`;
      let ranges: HunkRange[];
      try {
        ranges = parseHunkRanges(opts.ranges ?? '1-1');
      } catch (e) {
        console.info(chalk.red((e as Error).message));
        process.exit(1);
      }
      const mgr = new HunkCheckpointManager({ sessionId, workspacePath: ws });
      const meta = mgr.snapshotHunks(file, ranges, opts.reason ?? 'manual');
      console.info(chalk.green(`✓ Hunk 检查点已创建: ${meta.id}`));
      console.info(chalk.dim(`  会话: ${meta.sessionId}  文件: ${meta.file}  hunks: ${meta.hunks.length} 个`));
      meta.hunks.forEach((h, i) => {
        console.info(chalk.dim(`    [${i}] 行 ${h.range.start}-${h.range.end} (${h.originalLines.length} 行)`));
      });
    });

  cpCmd
    .command('hunk-list')
    .description('列出当前会话的所有 hunk 检查点')
    .option('-s, --session <id>', '会话 ID')
    .action((opts: HunkCheckpointOpts) => {
      const rootOpts = program.opts();
      const ws: string = rootOpts.workspace ?? process.cwd();
      const sessionId = opts.session ?? 'cli_default';
      const mgr = new HunkCheckpointManager({ sessionId, workspacePath: ws });
      const list = mgr.list();
      if (list.length === 0) {
        console.info(chalk.dim('暂无 hunk 检查点'));
        return;
      }
      console.info(chalk.cyan(`\nHunk 检查点列表 (会话: ${sessionId}):`));
      for (const m of list) {
        const time = new Date(m.createdAt).toLocaleString();
        console.info(`  ${chalk.bold(m.id)}  ${chalk.dim(time)}  ${m.reason}`);
        console.info(chalk.dim(`    文件: ${m.file}  hunks: ${m.hunks.length} 个`));
      }
      console.info('');
    });

  cpCmd
    .command('hunk-restore <id>')
    .description('回滚 hunk 检查点(--idx 指定单个 hunk,--all 回滚全部)')
    .option('--idx <n>', 'hunk 索引(0-based)')
    .option('--all', '回滚所有 hunks')
    .option('-s, --session <id>', '会话 ID')
    .action((id: string, opts: HunkCheckpointOpts) => {
      const rootOpts = program.opts();
      const ws: string = rootOpts.workspace ?? process.cwd();
      const sessionId = opts.session ?? 'cli_default';
      const mgr = new HunkCheckpointManager({ sessionId, workspacePath: ws });
      if (opts.all) {
        const result = mgr.restoreAll(id);
        if (result.hunksRestored === 0 && result.reason) {
          console.info(chalk.red(result.reason));
          process.exit(1);
        }
        console.info(chalk.green(`✓ 已回滚 ${result.hunksRestored} 个 hunks,影响 ${result.linesAffected} 行`));
      } else if (opts.idx !== undefined) {
        const idx = Number(opts.idx);
        if (!Number.isFinite(idx) || idx < 0) {
          console.info(chalk.red('非法 --idx 值'));
          process.exit(1);
        }
        const result = mgr.restoreHunk(id, idx);
        if (!result.restored) {
          console.info(chalk.red(result.reason ?? '回滚失败'));
          process.exit(1);
        }
        console.info(chalk.green(`✓ 已回滚 hunk[${idx}],影响 ${result.linesAffected} 行`));
      } else {
        console.info(chalk.red('请指定 --idx <n> 或 --all'));
        process.exit(1);
      }
    });

  cpCmd
    .command('hunk-diff <id>')
    .description('查看 hunk 检查点与当前文件的差异')
    .option('-s, --session <id>', '会话 ID')
    .action((id: string, opts: HunkCheckpointOpts) => {
      const rootOpts = program.opts();
      const ws: string = rootOpts.workspace ?? process.cwd();
      const sessionId = opts.session ?? 'cli_default';
      const mgr = new HunkCheckpointManager({ sessionId, workspacePath: ws });
      const diff = mgr.diffHunks(id);
      if (diff.length === 0) {
        console.info(chalk.dim('检查点不存在或无 hunks'));
        return;
      }
      console.info(chalk.cyan('\nHunk 差异:'));
      for (const d of diff) {
        const icon = d.status === 'modified' ? chalk.yellow('M') : d.status === 'gone' ? chalk.red('-') : chalk.dim('=');
        console.info(`  ${icon} [${d.hunkIdx}] 行 ${d.range.start}-${d.range.end}  ${d.status}`);
      }
      console.info('');
    });

  cpCmd
    .command('hunk-delete <id>')
    .description('删除 hunk 检查点')
    .option('-s, --session <id>', '会话 ID')
    .action((id: string, opts: HunkCheckpointOpts) => {
      const rootOpts = program.opts();
      const ws: string = rootOpts.workspace ?? process.cwd();
      const sessionId = opts.session ?? 'cli_default';
      const mgr = new HunkCheckpointManager({ sessionId, workspacePath: ws });
      if (mgr.delete(id)) {
        console.info(chalk.green(`✓ 已删除 hunk 检查点: ${id}`));
      } else {
        console.info(chalk.red(`未找到 hunk 检查点: ${id}`));
        process.exit(1);
      }
    });
}
