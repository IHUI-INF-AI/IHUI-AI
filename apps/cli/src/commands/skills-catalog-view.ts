// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `/skills` 的唯一展示出口(goal-b49 W4 装车票,2026-11-05)。
 *
 * 这一格治的是「造好没装车」(AGENTS §0.9):技能目录缓存 `readSkillCatalog` 早已落地,
 * 但现读消费方数为 **0** —— 列清单那两条路径(REPL `/skills`、CLI `skills list`)各自直调
 * `loadSkills`,每次都全量扫盘,缓存无人读。本文件是那**一个**消费点:
 *   ① 首屏读缓存(命中就不再扫盘,判序全在 `../skills/catalog-cache-store.js` 那一侧);
 *   ② 命中与失效两个读数都出声 —— 命中报条数与年龄,失效报名义(`unjudged` / `rescan` /
 *      `dirty by probe`)与 schema 点名的失效因;本文件零复算判据(§0.6),
 *      store 的 `onNotice` 行原样透到展示面,一条都不咽;
 *   ③ scope 自描述四字段(`projectDir` / `repoRoot` / `userHomeDir` / `includeUserHome`)
 *      上展示面:换机错位时人看得见**哪个字段**对不上,而不是"清单变了"一句糊过去;
 *   ④ 取不到 / 抛错 ⇒ 只报"未判定"并**不**打印"暂无 skills"(§0.3:空与未判定分档,
 *      缺席不是一种判定)。
 *
 * 展示面文案一律走既有 `cliEntry.skills*` 语言键,不新增键、不新增环境变量、不新增硬编码中文。
 */
import chalk from 'chalk';
import type { Command } from 'commander';
import type { CatalogCacheScope } from '@ihui/shared/skills/catalog-cache-schema';
import { t } from '../i18n/index.js';
import {
  readSkillCatalog,
  skillCatalogScopeOf,
  type SkillCatalogEntry,
  type SkillCatalogOutcome,
  type SkillCatalogState,
} from '../skills/catalog-cache-store.js';

export interface SkillsCatalogViewOptions {
  /** 工作区根(REPL 取 `state.opts.workspacePath`,CLI 取 `process.cwd()`)。 */
  readonly cwd: string;
  readonly repoRoot?: string;
  readonly includeUserHome?: boolean;
  /** 展示行出口(缺省 `console.info`;测试注入以量"有没有出声")。 */
  readonly onLine?: (line: string) => void;
}

/** 一次展示的结构化结论 —— 供调用方与用例判读,不承担渲染。 */
export interface SkillsCatalogView {
  readonly count: number;
  readonly state: SkillCatalogState;
  /** `none` = 本轮什么都没读到(读侧抛错 ⇒ 未判定),不得与 `cache`/`scan` 并成一格。 */
  readonly loadedFrom: SkillCatalogOutcome['loadedFrom'] | 'none';
  readonly scope: CatalogCacheScope;
  readonly entries: readonly SkillCatalogEntry[];
  /** store 三态判定的原样读数(命中数 / 失效因 / 回写结果),展示面已逐条出声。 */
  readonly readouts: readonly string[];
}

/** scope 的四字段具名读数(唯一书写处;缺一个字段就等于退回外部程序那种位置编码)。 */
function scopeReadout(scope: CatalogCacheScope): string {
  return (
    `scope: projectDir=${scope.projectDir} | repoRoot=${scope.repoRoot}` +
    ` | userHomeDir=${scope.userHomeDir} | includeUserHome=${String(scope.includeUserHome)}`
  );
}

/** 目录落点提示(仅"确实为空"这一支才给,ASCII 路径形态,不是语言键)。 */
const SKILL_DIR_HINTS: readonly string[] = [
  '  <cwd>/.ihui/skills/   <cwd>/.agents/skills/   <cwd>/.claude/skills/   <cwd>/.cursor/skills/',
  '  <repo-root>/.ihui/skills/ ...   ~/.ihui/skills/',
];

/**
 * 读清单并打印(唯一出口)。返回结构化结论,便于上层把"命中/失效"再往别处透。
 * 本函数不判新鲜度、不比签名、不算 scope —— 那些都在 store 与 `@ihui/shared/skills/catalog-cache-schema`。
 */
export function showSkillsCatalog(opts: SkillsCatalogViewOptions): SkillsCatalogView {
  const emit = opts.onLine ?? ((line: string): void => console.info(line));
  const readouts: string[] = [];
  const say = (line: string): void => {
    readouts.push(line);
    emit(chalk.dim(line));
  };
  const scope = skillCatalogScopeOf({
    cwd: opts.cwd,
    repoRoot: opts.repoRoot,
    includeUserHome: opts.includeUserHome,
  });
  const view = (
    state: SkillCatalogState,
    loadedFrom: SkillsCatalogView['loadedFrom'],
    entries: readonly SkillCatalogEntry[],
  ): SkillsCatalogView => ({ count: entries.length, state, loadedFrom, scope, entries, readouts });

  let outcome: SkillCatalogOutcome;
  try {
    outcome = readSkillCatalog({
      cwd: opts.cwd,
      repoRoot: opts.repoRoot,
      includeUserHome: opts.includeUserHome,
      // store 的三态日志只在这一处落地到展示面;咽掉它就是"失效的表现永远是安静"
      onNotice: say,
    });
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    say(`[skill-catalog] unjudged: catalog read threw (${reason}) — no list is printed, absence is not a judgement`);
    return view('unjudged', 'none', []);
  }

  emit(chalk.cyan(t('cliEntry.skillsLoaded', { count: outcome.entries.length })));
  emit(chalk.dim(scopeReadout(scope)));

  if (outcome.entries.length === 0) {
    // 到这一支只有两种来源:缓存命中的稳定空态(带具名件),或本轮真扫过盘且扫到 0 条。
    // 抛错/取不到在上面的 catch 臂就返回了,不会把"没判出来"印成"没有技能"。
    emit(chalk.dim(t('cliEntry.skillsEmpty')));
    for (const hint of SKILL_DIR_HINTS) emit(chalk.dim(hint));
  } else {
    for (const entry of outcome.entries) {
      const version = entry.version ? chalk.dim(` v${entry.version}`) : '';
      emit(`  ${chalk.bold(entry.name)}${version} — ${chalk.dim(entry.description)}`);
      emit(chalk.dim(t('cliEntry.skillsSourceLine', { source: entry.source })));
    }
    emit(`${chalk.dim('/skill <name>')} ${chalk.dim(t('cliEntry.skillShowDesc'))}`);
  }
  return view(outcome.state, outcome.loadedFrom, outcome.entries);
}

export interface SkillsListCommandDeps {
  /** 工作区根解析;缺省 `process.cwd()`(与 REPL 的 `state.opts.workspacePath` 同义,用例注入夹具目录)。 */
  readonly resolveCwd?: () => string;
}

/**
 * `ihui skills list` 的注册口(goal-b49 X3,2026-11-05):命令层只负责"把子命令挂上去",
 * 展示与缓存判据全部留在 `showSkillsCatalog` 那一份 —— 与 REPL `/skills` 同一出口(§0.6)。
 * 清单的格式化与缓存只有这一份,命令侧不得再手搓条目行或另读一次盘。
 */
export function registerSkillsListCommand(
  parent: Command,
  deps: SkillsListCommandDeps = {},
): void {
  const resolveCwd = deps.resolveCwd ?? ((): string => process.cwd());
  parent
    .command('list')
    .description(t('cliEntry.skillsListDesc'))
    .action(() => {
      showSkillsCatalog({ cwd: resolveCwd() });
    });
}

export const __test__ = { scopeReadout, SKILL_DIR_HINTS };
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
