/**
 * /subagent-parallel 命令 — CLI 入口,并行 spawn N 个子 agent(fork 子进程真并行)。
 *
 * 用法:
 *   ihui subagent-parallel --persona coder --task "重构 X" --persona reviewer --task "审查 Y"
 *   ihui subagent-parallel --persona coder --task "..." --persona reviewer --task "..." --topology chain
 *   ihui subagent-parallel --persona coder --task "..." --isolation worktree --max-workers 8
 *
 * 支持:
 *   - 多组 --persona --task 对(按出现顺序配对)
 *   - --topology: star(默认,主 agent 中转)/ mesh(直接并行)/ chain(串行 handoff)/ hierarchical(按角色组长)
 *   - --isolation: none(默认,共享工作区)/ worktree(git worktree 隔离)
 *   - --max-workers: 并发上限(默认 4)
 *   - --model: 模型覆盖
 *   - --max-iterations: 每个子 agent 最大迭代数
 *   - --timeout: 单任务超时秒数(默认 300)
 *   - --json: JSON 格式输出(便于管道处理)
 */

import { Command, type OptionValues } from 'commander';
import chalk from 'chalk';
import { spawnParallel, type Topology } from './subagent-collab.js';
import type { SubagentSpawnRequest, SubagentPersona, IsolationMode } from '@ihui/types';

/** 把 --persona / --task 收集的数组配对为 SubagentSpawnRequest[] */
function zipPersonaTask(
  personas: string[],
  tasks: string[],
  defaults: {
    model?: string;
    isolation?: IsolationMode;
    maxIterations?: number;
    timeoutSeconds?: number;
  },
): SubagentSpawnRequest[] {
  if (personas.length === 0) {
    throw new Error('至少需要一组 --persona --task');
  }
  if (personas.length !== tasks.length) {
    throw new Error(
      `--persona(${personas.length}个)与 --task(${tasks.length}个)数量不匹配,必须成对出现`,
    );
  }
  const validPersonas: SubagentPersona[] = ['researcher', 'coder', 'reviewer', 'planner', 'general'];
  return personas.map((p, i) => {
    if (!validPersonas.includes(p as SubagentPersona)) {
      throw new Error(`无效 persona: ${p}(可选: ${validPersonas.join('/')})`);
    }
    return {
      persona: p as SubagentPersona,
      task: tasks[i]!,
      model: defaults.model,
      isolation: defaults.isolation ?? 'none',
      maxIterations: defaults.maxIterations,
      timeoutSeconds: defaults.timeoutSeconds,
    } satisfies SubagentSpawnRequest;
  });
}

export function registerSubagentParallelCommand(program: Command): void {
  program
    .command('subagent-parallel')
    .description('并行 spawn N 个子 agent(fork 子进程真并行,支持 star/mesh/chain/hierarchical 拓扑)')
    .option('-p, --persona <persona...>', '子 agent 角色(researcher/coder/reviewer/planner/general,可多次传)')
    .option('-t, --task <task...>', '任务描述(与 --persona 成对出现,可多次传)')
    .option('--topology <t>', '协作拓扑: star(默认) | mesh | chain | hierarchical', 'star')
    .option('--isolation <m>', '隔离模式: none(默认) | worktree(git worktree 隔离)', 'none')
    .option('--model <m>', '模型覆盖(默认用 settings.json 配置)')
    .option('--max-iterations <n>', '每个子 agent 最大迭代数', (v: string) => parseInt(v, 10))
    .option('--timeout <s>', '单任务超时秒数(默认 300)', (v: string) => parseInt(v, 10))
    .option('--max-workers <n>', '最大并发 worker 数(默认 4)', (v: string) => parseInt(v, 10))
    .option('--json', 'JSON 格式输出(便于管道处理)')
    .action(async (opts: OptionValues) => {
      const topology = (opts.topology ?? 'star') as Topology;
      const validTopologies: Topology[] = ['star', 'mesh', 'chain', 'hierarchical'];
      if (!validTopologies.includes(topology)) {
        console.error(chalk.red(`无效 topology: ${topology}(可选: ${validTopologies.join('/')})`));
        process.exit(1);
      }

      const isolation = (opts.isolation ?? 'none') as IsolationMode;
      if (isolation !== 'none' && isolation !== 'worktree') {
        console.error(chalk.red(`无效 isolation: ${isolation}(可选: none/worktree)`));
        process.exit(1);
      }

      let reqs: SubagentSpawnRequest[];
      try {
        reqs = zipPersonaTask(
          (opts.persona as string[] | undefined) ?? [],
          (opts.task as string[] | undefined) ?? [],
          {
            model: typeof opts.model === 'string' ? opts.model : undefined,
            isolation,
            maxIterations: typeof opts.maxIterations === 'number' ? opts.maxIterations : undefined,
            timeoutSeconds: typeof opts.timeout === 'number' ? opts.timeout : undefined,
          },
        );
      } catch (e) {
        console.error(chalk.red(e instanceof Error ? e.message : String(e)));
        process.exit(1);
        return; // unreachable,TS 不知道 process.exit 的返回类型是 never
      }

      const maxWorkers = typeof opts.maxWorkers === 'number' ? opts.maxWorkers : 4;
      const jsonOutput = opts.json === true || !process.stdout.isTTY;

      if (!jsonOutput) {
        console.info(chalk.cyan(`\n🚀 并行 spawn ${reqs.length} 个子 agent(topology=${topology}, maxWorkers=${maxWorkers})`));
        for (const r of reqs) {
          console.info(chalk.dim(`  · [${r.persona}] ${r.task.slice(0, 80)}`));
        }
        console.info('');
      }

      try {
        const results = await spawnParallel(reqs, { topology, maxWorkers });

        if (jsonOutput) {
          console.info(JSON.stringify(results, null, 2));
        } else {
          const icon = (s: string) => s === 'completed' ? chalk.green('✓') : chalk.red('✗');
          for (const r of results) {
            const status = r.status === 'completed' ? 'completed' : 'failed';
            console.info(`  ${icon(status)} [PID ${r.pid}] ${r.subagentId} — ${chalk.bold(status)} (${r.durationMs ?? 0}ms)`);
            if (r.output) {
              const preview = r.output.slice(0, 500);
              console.info(chalk.dim(`    ${preview}${r.output.length > 500 ? '...(截断)' : ''}`));
            }
            if (r.error) {
              console.info(chalk.red(`    error: ${r.error}`));
            }
            console.info('');
          }

          const succeeded = results.filter((r) => r.status === 'completed').length;
          const failed = results.length - succeeded;
          if (failed > 0) {
            console.info(chalk.yellow(`⚠ ${succeeded} 成功, ${failed} 失败`));
            process.exitCode = 1;
          } else {
            console.info(chalk.green(`✨ 全部完成(${succeeded}/${results.length})`));
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (jsonOutput) {
          console.info(JSON.stringify({ error: msg }));
        } else {
          console.error(chalk.red(`\n❌ spawnParallel 失败: ${msg}`));
        }
        process.exitCode = 1;
      }
    });
}
