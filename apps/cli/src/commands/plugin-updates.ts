// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-22 autoUpdate 的 CLI 出口 —— `plugin-updates`。
 *
 * 只读命令:两条子动作(`--check-updates` / `--plan-update`)**默认零副作用**:
 * 不写 registry、不移动目录、不覆盖副本、不提供 `--apply`(那条腿要接
 * `safe-commit` 五步法与 `git-lock`,归后续票;见交付报告给出的函数签名)。
 *
 * 用法(直执行形态,与 `src/min-version-probe.ts` 同一档惯例):
 *   pnpm --filter ihui-cli exec tsx src/commands/plugin-updates.ts --check-updates [--json]
 *   pnpm --filter ihui-cli exec tsx src/commands/plugin-updates.ts --plan-update [--json]
 *     [--marketplace <本地检出根>]… [--name <插件名>]… [--plugins-root <装机根>]
 *
 * 退出码(与门 277 同一组语义:0 绿 / 1 有确定结论的坏消息 / 2 未判定,不拿 0 冒充"没坏"):
 *   0 = 没有未判定项,且没有 refused
 *   1 = 有 refused(本地脏 / 验不过 / 跳代)或存在 available 且计划未落
 *   2 = 有 unjudged(输入取不到)—— 这一档**永不**被读成"已是最新"
 */
import type { Command } from 'commander';
import { isDirectRunMain } from '../util/main-module.js';
import { checkUpdates, planUpdate, type CheckUpdatesReport, type UpdatePlanReport } from '../plugins/update-plan.js';
import { explicitMarketplaces, loadRegisteredMarketplaces, type RegisteredMarketplacesOutcome } from '../plugins/marketplace.js';

export interface PluginUpdatesCliResult {
  exitCode: 0 | 1 | 2;
  checks?: CheckUpdatesReport;
  plan?: UpdatePlanReport;
}

/** `--marketplace` 可重复;一个都没给时回落到只读的登记台账(不存在 ⇒ 全部候选 unjudged) */
export function resolveMarketplaces(roots: readonly string[]): RegisteredMarketplacesOutcome {
  return roots.length > 0 ? explicitMarketplaces(roots) : loadRegisteredMarketplaces();
}

/**
 * 结论档位 → 退出码。
 * 未判定永远顶过一切(§0.3:枚举到 0 条记录也是"没有输入",不是"一切正常");
 * 其次 refused(确定的坏消息),再次 available(有更新但未落 —— 本档没有 --apply,所以它不是绿)。
 */
export function exitCodeOf(plan: UpdatePlanReport | null, checks: CheckUpdatesReport | null): 0 | 1 | 2 {
  if (checks && checks.verdict === 'unjudged') return 2;
  if (plan && (plan.status === 'unjudged' || plan.preVerdict === 'unjudged' || plan.counts.unjudged > 0)) return 2;
  if (plan && plan.counts.refused > 0) return 1;
  if (checks && checks.counts.available > 0) return 1;
  return 0;
}

function renderChecks(r: CheckUpdatesReport): string {
  const lines = r.checks.map((c) => {
    const where = c.marketplace ? ` ← ${c.marketplace}` : '';
    if (c.state === 'unjudged') {
      return `  [unjudged ] ${c.name}${where} reason=${c.reason} 缺输入=${c.missingInputs.join(',')}`;
    }
    return `  [${c.state.padEnd(9)}] ${c.name}${where} ${c.currentSha?.slice(0, 12)}… → ${c.remoteSha?.slice(0, 12)}… (${c.ref})`;
  });
  if (r.reason) lines.push(`  (整面未判定:${r.reason})`);
  return [
    `[plugin-updates] 结论=${r.verdict} 面=装机(只读) up-to-date=${r.counts.upToDate} available=${r.counts.available} unjudged=${r.counts.unjudged}`,
    ...lines,
  ].join('\n');
}

function renderPlan(p: UpdatePlanReport): string {
  const lines = p.entries.map((e) => {
    const head = `  [${e.status.padEnd(8)}] ${e.name}`;
    const route = e.from && e.to ? ` ${e.from.commit.slice(0, 12)}… → ${e.to.commit.slice(0, 12)}…(${e.to.files} 个文件)` : '';
    const bad = e.missingInputs.length > 0 ? ` 缺输入/红线=${e.missingInputs.join(',')}` : '';
    const drift: string[] = [];
    if (e.localDrift) {
      drift.push(
        `      本地漂移:mismatch=${e.localDrift.mismatch.map((m) => m.path).join(',') || '-'}` +
          ` missing=${e.localDrift.missing.join(',') || '-'} unlisted=${e.localDrift.unlisted.join(',') || '-'}`,
      );
    }
    if (e.stagedDrift) {
      drift.push(
        `      新副本漂移:mismatch=${e.stagedDrift.mismatch.map((m) => m.path).join(',') || '-'}` +
          ` missing=${e.stagedDrift.missing.join(',') || '-'} unlisted=${e.stagedDrift.unlisted.join(',') || '-'}`,
      );
    }
    return [`${head}${route}${bad}${e.reason ? ` reason=${e.reason}` : ''}`, ...drift].join('\n');
  });
  return [
    `[plugin-updates] 计划=${p.status} planned=${p.counts.planned} no-op=${p.counts.noop} refused=${p.counts.refused} unjudged=${p.counts.unjudged}`,
    ...lines,
    ...(p.reason ? [`  (${p.reason})`] : []),
    '  注:本命令只出计划,不写 registry、不动装机目录(--apply 归后续票)。',
  ].join('\n');
}

/** 值旗标的取法(`--flag value` 与 `--flag=value` 两形都认;认不出的旗标不静默忽略) */
function collectValueFlags(argv: readonly string[], name: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]!;
    if (a === `--${name}` && i + 1 < argv.length) out.push(argv[i + 1]!);
    else if (a.startsWith(`--${name}=`)) out.push(a.slice(name.length + 3));
  }
  return out;
}

/**
 * CLI 主体(纯 argv 进、结论出,不碰 process.exit:被 import 时零副作用 —— AGENTS §22d)。
 */
export async function runPluginUpdatesCli(argv: readonly string[]): Promise<PluginUpdatesCliResult> {
  if (argv.includes('--help') || argv.length === 0) {
    console.log(
      [
        '用法: ihui plugin-updates --check-updates [--json] [--marketplace <根>]… [--name <插件>]… [--plugins-root <装机根>]',
        '      ihui plugin-updates --plan-update   [--json] …(同上)',
        '只读:不写 registry、不动装机目录;取源只走 git(形状白名单同 cache.ts 的咽喉点)。',
        '退出码: 0 全绿 / 1 有 refused 或有可用更新未落 / 2 有未判定(缺输入)',
      ].join('\n'),
    );
    return { exitCode: 2 };
  }

  const json = argv.includes('--json');
  const marketplaces = resolveMarketplaces(collectValueFlags(argv, 'marketplace'));
  const names = collectValueFlags(argv, 'name');
  const pluginsRoot = collectValueFlags(argv, 'plugins-root')[0];
  const opts = { marketplaces, ...(names.length > 0 ? { names } : {}), ...(pluginsRoot ? { pluginsRoot } : {}) };

  const doCheck = argv.includes('--check-updates');
  const doPlan = argv.includes('--plan-update');
  if (!doCheck && !doPlan) {
    console.error('[plugin-updates] 既没给 --check-updates 也没给 --plan-update ⇒ 不判定(不静默挑一条)');
    return { exitCode: 2 };
  }

  let checks: CheckUpdatesReport | null = null;
  let plan: UpdatePlanReport | null = null;

  if (doCheck) {
    checks = await checkUpdates(opts);
    if (json) console.log(JSON.stringify(checks, null, 2));
    else console.log(renderChecks(checks));
  }
  if (doPlan) {
    plan = await planUpdate(opts);
    if (json) console.log(JSON.stringify(plan, null, 2));
    else console.log(renderPlan(plan));
  }

  return { exitCode: exitCodeOf(plan, checks), ...(checks ? { checks } : {}), ...(plan ? { plan } : {}) };
}

/**
 * 供根 program 注册(主席接线用,一行:`registerPluginUpdatesCommand(program)`)。
 * 刻意与"直执行形态"共用同一个 `runPluginUpdatesCli`,不各写一遍 argv 解析(§0.6)。
 */
export function registerPluginUpdatesCommand(program: Command): void {
  program
    .command('plugin-updates')
    .description('插件更新判定与计划(对标对照程序的 autoUpdate;只读,验不过就不落,本地脏就停)')
    .option('--check-updates', '判已登记市场里每个插件有没有新版本(up-to-date/available/unjudged)')
    .option('--plan-update', '出安全更新计划(不落地):直接后继 + 逐文件完整性 + 本地脏让路')
    .option('--marketplace <root>', '显式指定一枚已登记市场的本地检出根(可重复)')
    .option('--name <plugin>', '只判这一枚插件(可重复)')
    .option('--plugins-root <dir>', '覆盖装机根(默认 ~/.ihui/installed-plugins)')
    .option('--json', '机器可读结论')
    .action(async (opts: Record<string, unknown>) => {
      const argv: string[] = [];
      if (opts['checkUpdates']) argv.push('--check-updates');
      if (opts['planUpdate']) argv.push('--plan-update');
      if (opts['json']) argv.push('--json');
      for (const v of [opts['marketplace']].flat()) if (typeof v === 'string') argv.push('--marketplace', v);
      for (const v of [opts['name']].flat()) if (typeof v === 'string') argv.push('--name', v);
      if (typeof opts['pluginsRoot'] === 'string') argv.push('--plugins-root', opts['pluginsRoot']);
      const r = await runPluginUpdatesCli(argv);
      process.exitCode = r.exitCode;
    });
}

if (isDirectRunMain(import.meta.url)) {
  const r = await runPluginUpdatesCli(process.argv.slice(2));
  process.exitCode = r.exitCode;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
