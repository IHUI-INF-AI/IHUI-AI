/**
 * Plan CLI — 本地 plan 文档管理(对标 ihui init AGENTS.md 模板模式)。
 *
 * plan 文档存放在 <workspace>/.ihui/plans/<name>.md,文件名即 plan 名称。
 * 纯本地文件操作,不调 API,不需要 token。
 *
 * 用法:
 *   ihui plan init [name] [--force]
 *   ihui plan list
 *   ihui plan show <name>
 *   ihui plan delete <name> [--force]
 */

import type { Command } from 'commander';
import chalk from 'chalk';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  statSync,
} from 'node:fs';
import { join, dirname } from 'node:path';

const PLANS_RELATIVE_DIR = '.ihui/plans';

interface InitOptions {
  force?: boolean;
}

interface DeleteOptions {
  force?: boolean;
}

interface PlanEntry {
  name: string;
  size: number;
  mtime: Date;
}

// ==================== 路径工具 ====================

function getPlansDir(workspace: string): string {
  return join(workspace, PLANS_RELATIVE_DIR);
}

function planFilePath(workspace: string, name: string): string {
  return join(getPlansDir(workspace), `${name}.md`);
}

/** 时间戳(文件名安全):YYYYMMDD-HHMMSS */
function fileTimestamp(): string {
  const d = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/** 校验 plan 名称:防路径遍历,去掉 .md 后缀(用户可能传入 foo.md)。 */
function sanitizePlanName(name: string): string {
  if (!name) throw new Error('plan 名称不能为空');
  if (name.includes('/') || name.includes('\\') || name.includes('..') || name.includes('\0')) {
    throw new Error(`plan 名称不合法(不能含路径分隔符或 ..): ${name}`);
  }
  return name.endsWith('.md') ? name.slice(0, -3) : name;
}

function generatePlanTemplate(name: string): string {
  return `# Plan: ${name}

## 目标
<一句话描述>

## 范围
- [ ] 任务 1
- [ ] 任务 2

## 约束
- 

## 验证标准
- 

## 风险
- 
`;
}

/** 友好错误输出(不触发 crash handler)。 */
function handleError(scope: string, err: unknown): void {
  const e = err as Error & { status?: number };
  const status = typeof e.status === 'number' ? ` [${e.status}]` : '';
  console.error(chalk.red(`✗ ${scope}${status}: ${e.message || err}`));
  process.exitCode = 1;
}

// ==================== init ====================

function initPlan(workspace: string, name: string | undefined, force: boolean): void {
  const stem = sanitizePlanName(name ?? `untitled-${fileTimestamp()}`);
  const filePath = planFilePath(workspace, stem);
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  if (existsSync(filePath) && !force) {
    console.error(chalk.red(`✗ plan 已存在: ${stem}(使用 --force 覆盖)`));
    process.exitCode = 1;
    return;
  }

  writeFileSync(filePath, generatePlanTemplate(stem), 'utf-8');
  console.info(chalk.green(`✓ 已创建 plan: ${filePath}`));
}

// ==================== list ====================

function listPlans(workspace: string): void {
  const plansDir = getPlansDir(workspace);
  if (!existsSync(plansDir)) {
    console.info(chalk.dim('暂无 plan(在 .ihui/plans/ 创建)'));
    return;
  }

  const entries = readdirSync(plansDir)
    .filter((f) => f.endsWith('.md'))
    .map((f): PlanEntry | null => {
      const full = join(plansDir, f);
      try {
        const st = statSync(full);
        return { name: f.slice(0, -3), size: st.size, mtime: st.mtime };
      } catch {
        return null;
      }
    })
    .filter((e): e is PlanEntry => e !== null)
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  if (entries.length === 0) {
    console.info(chalk.dim('暂无 plan(在 .ihui/plans/ 创建)'));
    return;
  }

  const timeFmt = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  console.info(chalk.cyan('\nPlans:'));
  for (const e of entries) {
    const time = timeFmt.format(e.mtime);
    console.info(`  [${chalk.cyan(e.name)}] ${e.size}B  ${chalk.dim(time)}`);
  }
  console.info(chalk.dim(`\n共 ${entries.length} 个 plan`));
}

// ==================== show ====================

function showPlan(workspace: string, name: string): void {
  const stem = sanitizePlanName(name);
  const filePath = planFilePath(workspace, stem);
  if (!existsSync(filePath)) {
    console.error(chalk.red(`✗ 未找到 plan: ${stem}`));
    process.exitCode = 1;
    return;
  }
  const content = readFileSync(filePath, 'utf-8');
  console.info(content);
}

// ==================== delete ====================

function deletePlan(workspace: string, name: string, force: boolean): void {
  const stem = sanitizePlanName(name);
  const filePath = planFilePath(workspace, stem);
  if (!existsSync(filePath)) {
    console.error(chalk.red(`✗ 未找到 plan: ${stem}`));
    process.exitCode = 1;
    return;
  }
  if (!force) {
    console.error(chalk.red(`✗ 删除 plan 需要 --force 确认: ${stem}`));
    process.exitCode = 1;
    return;
  }
  unlinkSync(filePath);
  console.info(chalk.green(`✓ 已删除 plan: ${stem}`));
}

// ==================== 命令注册 ====================

/**
 * 在根 program 上注册 `plan` 命令组。
 * 纯本地文件操作,plan 文档存放在 <workspace>/.ihui/plans/<name>.md。
 */
export function registerPlanCommand(program: Command): void {
  const planCmd = program
    .command('plan')
    .description('Plan 文档管理 (本地 .ihui/plans/*.md)');

  planCmd
    .command('init [name]')
    .description('在当前工作区 .ihui/plans/<name>.md 生成 plan 模板')
    .option('--force', '覆盖已存在的 plan 文件')
    .action((name: string | undefined, opts: InitOptions) => {
      try {
        initPlan(process.cwd(), name, Boolean(opts.force));
      } catch (err) {
        handleError('plan init', err);
      }
    });

  planCmd
    .command('list')
    .description('列出当前工作区所有 plan')
    .action(() => {
      try {
        listPlans(process.cwd());
      } catch (err) {
        handleError('plan list', err);
      }
    });

  planCmd
    .command('show <name>')
    .description('显示指定 plan 内容')
    .action((name: string) => {
      try {
        showPlan(process.cwd(), name);
      } catch (err) {
        handleError('plan show', err);
      }
    });

  planCmd
    .command('delete <name>')
    .description('删除 plan 文件(需 --force 确认)')
    .option('--force', '确认删除')
    .action((name: string, opts: DeleteOptions) => {
      try {
        deletePlan(process.cwd(), name, Boolean(opts.force));
      } catch (err) {
        handleError('plan delete', err);
      }
    });
}
