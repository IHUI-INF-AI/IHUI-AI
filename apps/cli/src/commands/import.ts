/**
 * ihui import 子命令 — 从本地 CLI 配置文件导入供应商到 IHUI 账号。
 *
 * 用法:
 *   ihui import sources                         列出支持的导入来源
 *   ihui import parse <source> <file>           解析本地文件并预览
 *   ihui import commit <source> <file>          解析 + 落库(默认 skip 策略)
 *   ihui import commit <source> <file> --strategy overwrite
 *   ihui import history                         查询导入历史(最近 50 条)
 *
 * 设计:
 * - 通过 @ihui/api-client 的 fetchApi 调用后端 /api/user/cli-import/* 接口
 * - 解析在服务端完成(避免 CLI 端引入 sql.js / smol-toml 等重依赖)
 * - apiKey 等敏感字段仅在服务端处理,CLI 端只显示脱敏后的 preview
 */

import type { Command } from 'commander';
import chalk from 'chalk';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fetchApi } from '@ihui/api-client';

const VALID_SOURCES = ['cc-switch', 'codex++', 'claude-cli', 'codex-cli', 'gemini-cli', 'hermes', 'env-file', 'cursor', 'windsurf', 'cline', 'aider', 'trae', 'trae-work', 'qoder', 'qoder-work', 'codex-desktop', 'claude-code-desktop', 'github-copilot', 'amazon-q', 'continue', 'tabnine', 'cody', 'zed', 'antigravity'] as const;
type Source = (typeof VALID_SOURCES)[number];

const STRATEGIES = ['overwrite', 'skip', 'clone'] as const;
type Strategy = (typeof STRATEGIES)[number];

interface SourceInfo {
  source: string;
  description: string;
}

interface ImportedProvider {
  sourceId: string;
  name: string;
  providerCode: string;
  baseUrl: string;
  apiFormat: string;
  warnings: string[];
  isCurrent: boolean;
}

interface ImportPreview {
  previewId: string;
  source: string;
  sourcePath: string;
  sourceVersion?: string;
  providers: ImportedProvider[];
  globalWarnings: string[];
}

interface CommitResult {
  importId: string;
  imported: number;
  skipped: number;
  failed: number;
  failedDetails: Array<{ sourceId: string; reason: string }>;
  configIds: number[];
}

interface HistoryItem {
  id: string;
  source: string;
  sourcePath: string;
  importedCount: number;
  skippedCount: number;
  failedCount: number;
  status: string;
  importedAt: string;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

/** 上传文件到 /cli-import/parse-file */
async function parseFile(
  source: Source,
  filePath: string,
): Promise<ImportPreview | null> {
  const abs = path.resolve(filePath);
  let buffer: Buffer;
  try {
    buffer = await readFile(abs);
  } catch (err) {
    console.error(chalk.red(`读取文件失败: ${(err as Error).message}`));
    return null;
  }
  const fd = new FormData();
  fd.append('source', source);
  const blob = new Blob([buffer]);
  fd.append('file', blob, path.basename(abs));

  // codex-cli 自动读 auth.json
  if (source === 'codex-cli') {
    const authPath = path.join(path.dirname(abs), 'auth.json');
    try {
      const authBuf = await readFile(authPath);
      fd.append('authJson', authBuf.toString('utf8'));
    } catch {
      /* auth.json optional */
    }
  }
  // gemini-cli 自动读 settings.json
  if (source === 'gemini-cli' && path.basename(abs) === '.env') {
    const settingsPath = path.join(path.dirname(abs), 'settings.json');
    try {
      const sBuf = await readFile(settingsPath);
      fd.append('settingsJson', sBuf.toString('utf8'));
    } catch {
      /* optional */
    }
  }

  const res = await fetchApi<{ preview: ImportPreview }>('/api/user/cli-import/parse-file', {
    method: 'POST',
    body: fd,
  });
  if (!res.success) {
    console.error(chalk.red(`解析失败: ${res.error}`));
    return null;
  }
  return res.data.preview;
}

function printPreview(preview: ImportPreview): void {
  console.info(chalk.cyan(`\n解析预览(${preview.source})`));
  console.info(chalk.dim(`  文件: ${preview.sourcePath}`));
  if (preview.sourceVersion) {
    console.info(chalk.dim(`  版本: ${preview.sourceVersion}`));
  }
  if (preview.globalWarnings.length > 0) {
    console.info(chalk.yellow(`  全局警告:`));
    for (const w of preview.globalWarnings) {
      console.info(chalk.yellow(`    - ${w}`));
    }
  }
  console.info(chalk.cyan(`\n  共 ${preview.providers.length} 个供应商:`));
  for (const p of preview.providers) {
    const current = p.isCurrent ? chalk.green(' [current]') : '';
    const warn = p.warnings.length > 0 ? chalk.yellow(` ⚠ ${p.warnings.join('; ')}`) : '';
    console.info(`    ${chalk.bold(p.name)}${current} ${chalk.dim(`(${p.providerCode})`)}${warn}`);
    console.info(chalk.dim(`      baseUrl: ${p.baseUrl || '—'}`));
    console.info(chalk.dim(`      apiFormat: ${p.apiFormat}`));
  }
  console.info('');
}

export function registerImportCommand(program: Command): void {
  const importCmd = program
    .command('import')
    .description('CLI 配置导入(cc-switch / codex++ / Claude / Codex / Gemini / Hermes)');

  importCmd
    .command('sources')
    .description('列出支持的导入来源')
    .action(async () => {
      const res = await fetchApi<{ sources: SourceInfo[] }>('/api/user/cli-import/sources');
      if (!res.success) {
        console.error(chalk.red(res.error));
        return;
      }
      console.info(chalk.cyan('\n支持的导入来源:'));
      for (const s of res.data.sources) {
        console.info(`  ${chalk.bold(s.source)} ${chalk.dim(`- ${s.description}`)}`);
      }
      console.info('');
    });

  importCmd
    .command('parse <source> <file>')
    .description('解析本地文件并预览(不落库)')
    .action(async (source: string, file: string) => {
      if (!VALID_SOURCES.includes(source as Source)) {
        console.error(chalk.red(`无效 source: ${source}`));
        console.error(chalk.dim(`  有效值: ${VALID_SOURCES.join(', ')}`));
        return;
      }
      const preview = await parseFile(source as Source, file);
      if (preview) printPreview(preview);
    });

  importCmd
    .command('commit <source> <file>')
    .description('解析 + 落库(默认 skip 策略)')
    .option('-s, --strategy <strategy>', '冲突策略: overwrite | skip | clone', 'skip')
    .action(async (source: string, file: string, opts: { strategy: string }) => {
      if (!VALID_SOURCES.includes(source as Source)) {
        console.error(chalk.red(`无效 source: ${source}`));
        return;
      }
      if (!STRATEGIES.includes(opts.strategy as Strategy)) {
        console.error(chalk.red(`无效 strategy: ${opts.strategy}`));
        console.error(chalk.dim(`  有效值: ${STRATEGIES.join(', ')}`));
        return;
      }
      const preview = await parseFile(source as Source, file);
      if (!preview) return;
      printPreview(preview);

      const commitRes = await fetchApi<CommitResult>('/api/user/cli-import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          previewId: preview.previewId,
          selectedProviderIds: [],
          conflictStrategy: opts.strategy,
        }),
      });
      if (!commitRes.success) {
        console.error(chalk.red(`导入失败: ${commitRes.error}`));
        return;
      }
      const r = commitRes.data;
      console.info(chalk.green(`\n导入完成:`));
      console.info(`  成功: ${chalk.bold(r.imported)}`);
      console.info(`  跳过: ${chalk.bold(r.skipped)}`);
      console.info(`  失败: ${chalk.bold(r.failed)}`);
      if (r.failedDetails.length > 0) {
        console.info(chalk.yellow('\n  失败详情:'));
        for (const f of r.failedDetails) {
          console.info(`    ${f.sourceId}: ${f.reason}`);
        }
      }
      console.info(chalk.dim(`\n  importId: ${r.importId}`));
      console.info('');
    });

  importCmd
    .command('history')
    .description('查询导入历史(最近 50 条)')
    .action(async () => {
      const res = await fetchApi<{ list: HistoryItem[]; total: number }>('/api/user/cli-import/history');
      if (!res.success) {
        console.error(chalk.red(res.error));
        return;
      }
      if (res.data.list.length === 0) {
        console.info(chalk.dim('\n暂无导入记录'));
        console.info('');
        return;
      }
      console.info(chalk.cyan('\n导入历史:'));
      for (const h of res.data.list) {
        const statusColor =
          h.status === 'success'
            ? chalk.green
            : h.status === 'partial'
              ? chalk.yellow
              : chalk.red;
        console.info(`  ${chalk.bold(h.source)} ${statusColor(`[${h.status}]`)} ${chalk.dim(formatTime(h.importedAt))}`);
        console.info(chalk.dim(`    ${h.sourcePath}`));
        console.info(chalk.dim(`    成功 ${h.importedCount} · 跳过 ${h.skippedCount} · 失败 ${h.failedCount}`));
      }
      console.info('');
    });
}
