// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G5 编译式知识引擎 CLI — `ihui wiki compile|status`(2026-10-30 立项)。
 *
 * 对接后端 apps/ai-service(基址唯一出口 resolveCloudRunBase():
 * env AI_SERVICE_URL 优先,默认 http://localhost:8803):
 *  - POST /api/knowledge/compile  body {project_id, dry_run, workspace_path}
 *      → data {cards, wiki_files, rejected:[{reason}], source_hash}
 *  - GET  /api/knowledge/cards?project_id=&workspace_path=
 *      → data {cards:[有效卡], total}
 *
 * workspace_path 固定取 process.cwd()(CLI 在项目目录内运行,落点即当前工作区);
 * --project 缺省用当前目录名作项目 id。鉴权复用 ai-service JWT(Bearer 登录 token)。
 *
 * 用法:
 *   ihui wiki compile [--project <id>] [--dry-run] [--json]
 *   ihui wiki status [--project <id>] [--json]
 */

import type { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'node:path';
import { createApiRequest, extractData, handleError, printJson, resolveApiKeyAsync } from './http-utils.js';
import { missingTokenHint } from './token-manager.js';
import { resolveCloudRunBase } from '../cloud-run.js';
import { t } from '../i18n/index.js';

const DEFAULT_TIMEOUT_MS = 60_000;

const apiRequest = createApiRequest('', DEFAULT_TIMEOUT_MS);

interface CompileOptions {
  project?: string;
  dryRun?: boolean;
  json?: boolean;
}

interface StatusOptions {
  project?: string;
  json?: boolean;
}

interface CompileData {
  cards?: number;
  wiki_files?: number;
  rejected?: Array<{ reason?: string }>;
  source_hash?: string;
}

interface CardsData {
  cards?: unknown[];
  total?: number;
}

/** --project 缺省:当前目录名作项目 id(与后端 slug 规则兼容)。 */
function resolveProjectId(explicit: string | undefined): string {
  return explicit && explicit.trim() ? explicit.trim() : path.basename(process.cwd());
}

function readGlobalApiKey(program: Command): string | undefined {
  const opts = program.opts() as { apiKey?: string };
  return typeof opts.apiKey === 'string' && opts.apiKey ? opts.apiKey : undefined;
}

function reportNoToken(baseUrl: string): void {
  console.error(chalk.red(missingTokenHint(baseUrl)));
  process.exitCode = 1;
}

// ==================== wiki compile ====================

async function compileWiki(baseUrl: string, projectId: string, dryRun: boolean, asJson: boolean, apiKey?: string): Promise<void> {
  const resp = await apiRequest(baseUrl, '/api/knowledge/compile', {
    method: 'POST',
    body: { project_id: projectId, dry_run: dryRun, workspace_path: process.cwd() },
    apiKey,
  });
  if (asJson) {
    printJson(resp);
    return;
  }
  const data = extractData(resp) as CompileData;
  const cards = typeof data.cards === 'number' ? data.cards : 0;
  const wikiFiles = typeof data.wiki_files === 'number' ? data.wiki_files : 0;
  const rejected = Array.isArray(data.rejected) ? data.rejected : [];
  if (dryRun) {
    console.info(chalk.green(t('cliWiki.dryRunDone', { cards, rejected: rejected.length })));
  } else {
    console.info(chalk.green(t('cliWiki.compileDone', { cards, wikiFiles, rejected: rejected.length })));
  }
  if (rejected.length > 0) {
    console.info(chalk.dim(t('cliWiki.rejectedTitle')));
    for (const item of rejected) {
      console.info(chalk.dim(`  - ${item?.reason ?? ''}`));
    }
  }
}

// ==================== wiki status ====================

async function wikiStatus(baseUrl: string, projectId: string, asJson: boolean, apiKey?: string): Promise<void> {
  const qs = `?project_id=${encodeURIComponent(projectId)}&workspace_path=${encodeURIComponent(process.cwd())}`;
  const resp = await apiRequest(baseUrl, `/api/knowledge/cards${qs}`, { apiKey });
  if (asJson) {
    printJson(resp);
    return;
  }
  const data = extractData(resp) as CardsData;
  const cards = Array.isArray(data.cards) ? data.cards : [];
  const total = typeof data.total === 'number' ? data.total : cards.length;
  if (cards.length === 0) {
    console.info(chalk.dim(t('cliWiki.statusEmpty')));
    return;
  }
  console.info(chalk.bold(t('cliWiki.statusTitle', { total })));
  for (const raw of cards) {
    const c = raw as { kind?: string; statement?: string };
    console.info(`[${chalk.cyan(String(c.kind ?? 'fact'))}] ${String(c.statement ?? '')}`);
  }
}

// ==================== 命令注册 ====================

export function registerWikiCommand(program: Command): void {
  const wikiCmd = program.command('wiki').description(t('cliWiki.description'));

  wikiCmd
    .command('compile')
    .description(t('cliWiki.compileDescription'))
    .option('--project <id>', t('cliWiki.projectOption'))
    .option('--dry-run', t('cliWiki.dryRunOption'))
    .option('--json', t('cliWiki.jsonOption'))
    .action(async (opts: CompileOptions) => {
      try {
        const baseUrl = resolveCloudRunBase();
        const apiKey = await resolveApiKeyAsync(readGlobalApiKey(program), baseUrl);
        if (!apiKey) {
          reportNoToken(baseUrl);
          return;
        }
        await compileWiki(baseUrl, resolveProjectId(opts.project), Boolean(opts.dryRun), Boolean(opts.json), apiKey);
      } catch (err) {
        handleError('wiki compile', err);
      }
    });

  wikiCmd
    .command('status')
    .description(t('cliWiki.statusDescription'))
    .option('--project <id>', t('cliWiki.projectOption'))
    .option('--json', t('cliWiki.jsonOption'))
    .action(async (opts: StatusOptions) => {
      try {
        const baseUrl = resolveCloudRunBase();
        const apiKey = await resolveApiKeyAsync(readGlobalApiKey(program), baseUrl);
        if (!apiKey) {
          reportNoToken(baseUrl);
          return;
        }
        await wikiStatus(baseUrl, resolveProjectId(opts.project), Boolean(opts.json), apiKey);
      } catch (err) {
        handleError('wiki status', err);
      }
    });
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
