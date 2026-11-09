// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 诊断工具 — 让 Agent 获取 TypeScript 类型错误和 ESLint 诊断。
 *
 * 灵感来源:参考行业 Agent 框架的 LSP diagnostic 查询 + cargo clippy 集成设计。
 * 做减法:直接 spawnSync 调项目自带的 tsc/eslint,解析输出,零依赖。
 */

import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import type { Tool, ToolResult } from './index.js';
import { runPreToolCall, runPostToolCall } from '../hooks/index.js';
import { tryParseJson, isRecord, isJsonArray } from '../util/json.js';

interface Diagnostic {
  file: string;
  line: number;
  column: number;
  severity: 'error' | 'warning';
  message: string;
  ruleId?: string;
}

export type LintRun = { diags: Diagnostic[]; unmeasured: string | null };

/** 检查程序没启动、被信号打断，或退出了却没给出可读报告时，不能当成没有问题。 */
export function judgeLintSpawn(input: {
  kind: 'tsc' | 'eslint';
  cwd: string;
  errorMessage: string | null;
  signal: string | null;
  status: number | null;
  stdout: string;
}): LintRun {
  if (input.errorMessage) return { diags: [], unmeasured: input.errorMessage };
  if (input.signal) return { diags: [], unmeasured: `signal ${input.signal}` };
  if (input.status === null) return { diags: [], unmeasured: 'status-unmeasured' };
  if (input.kind === 'tsc') {
    const diags: Diagnostic[] = [];
    const re = /^(.+?)\((\d+),(\d+)\): (error|warning) (TS\d+): (.+)$/;
    for (const line of input.stdout.split('\n')) {
      const matched = re.exec(line.trim());
      if (!matched) continue;
      diags.push({
        file: path.relative(input.cwd, matched[1]!),
        line: Number(matched[2]!),
        column: Number(matched[3]!),
        severity: matched[4] as 'error' | 'warning',
        ruleId: matched[5]!,
        message: matched[6]!,
      });
    }
    if (diags.length === 0 && input.status !== 0) {
      return { diags: [], unmeasured: `tsc exit ${input.status}` };
    }
    return { diags, unmeasured: null };
  }
  const data = tryParseJson(input.stdout);
  if (!isJsonArray(data)) {
    return { diags: [], unmeasured: `eslint output was not a diagnostic list (exit ${input.status})` };
  }
  const diags: Diagnostic[] = [];
  for (const file of data) {
    if (!isRecord(file)) continue;
    for (const message of isJsonArray(file.messages) ? file.messages : []) {
      if (!isRecord(message)) continue;
      diags.push({
        file: path.relative(input.cwd, typeof file.filePath === 'string' ? file.filePath : String(file.filePath ?? '')),
        line: typeof message.line === 'number' ? message.line : 0,
        column: typeof message.column === 'number' ? message.column : 0,
        severity: message.severity === 2 ? 'error' : 'warning',
        message: typeof message.message === 'string' ? message.message : '',
        ruleId: typeof message.ruleId === 'string' ? message.ruleId : undefined,
      });
    }
  }
  return { diags, unmeasured: null };
}

function runTsc(cwd: string): LintRun {
  const result = spawnSync('npx', ['tsc', '--noEmit', '--pretty', 'false'], {
    cwd,
    encoding: 'utf-8',
    timeout: 60_000,
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return judgeLintSpawn({
    kind: 'tsc',
    cwd,
    errorMessage: result.error ? result.error.message : null,
    signal: result.signal,
    status: result.status,
    stdout: (result.stdout as string) ?? '',
  });
}

function runEslint(cwd: string, targetPath?: string): LintRun {
  const args = ['eslint', '--format', 'json', targetPath || '.'];
  const result = spawnSync('npx', args, {
    cwd,
    encoding: 'utf-8',
    timeout: 60_000,
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return judgeLintSpawn({
    kind: 'eslint',
    cwd,
    errorMessage: result.error ? result.error.message : null,
    signal: result.signal,
    status: result.status,
    stdout: (result.stdout as string) ?? '',
  });
}

export const get_diagnostics: Tool = {
  name: 'get_diagnostics',
  description: '获取 TypeScript 类型错误和 ESLint 诊断。参数:path(限定路径,可选),linter(tsc|eslint|auto,默认 auto 两个都跑)。',
  dangerLevel: 'read',
  parameters: {
    path: { type: 'string', description: '限定检查路径(可选,仅 eslint 生效)' },
    linter: { type: 'string', description: 'tsc | eslint | auto(默认 auto)' },
  },
  required: [],
  async execute(args, ctx): Promise<ToolResult> {
    const targetPath = args.path as string | undefined;
    const linter = (args.linter as string) || 'auto';
    const preResult = await runPreToolCall('get_diagnostics', { linter, path: targetPath }, ctx.signal);
    if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };

    const runs: LintRun[] = [];
    if (linter === 'tsc' || linter === 'auto') runs.push(runTsc(ctx.workspacePath));
    if (linter === 'eslint' || linter === 'auto') runs.push(runEslint(ctx.workspacePath, targetPath));
    const diags = runs.flatMap((run) => run.diags);
    const unmeasured = runs.flatMap((run) => (run.unmeasured ? [run.unmeasured] : []));

    await runPostToolCall('get_diagnostics', { count: diags.length }, ctx.signal);

    const errors = diags.filter((d) => d.severity === 'error');
    const warnings = diags.filter((d) => d.severity === 'warning');

    if (unmeasured.length > 0 && diags.length === 0) {
      return {
        success: false,
        output: '',
        error: `诊断没有跑完,不能把它说成没有问题 (${unmeasured.join('; ')})`,
      };
    }

    if (diags.length === 0) return { success: true, output: '无诊断(0 错误, 0 警告)' };

    const lines: string[] = [`总计: ${errors.length} 错误, ${warnings.length} 警告`];
    if (unmeasured.length > 0) lines.push(`诊断没有跑完,下面只是已经读到的: ${unmeasured.join('; ')}`);
    for (const d of diags.slice(0, 50)) {
      const icon = d.severity === 'error' ? '✗' : '⚠';
      const rule = d.ruleId ? ` [${d.ruleId}]` : '';
      lines.push(`  ${icon} ${d.file}:${d.line}:${d.column}${rule} ${d.message}`);
    }
    if (diags.length > 50) lines.push(`  ...(还有 ${diags.length - 50} 条)`);
    return {
      success: errors.length === 0,
      output: lines.join('\n'),
      error: errors.length > 0 ? `${errors.length} 个错误` : undefined,
    };
  },
};

export const DIAGNOSTIC_TOOLS: Tool[] = [get_diagnostics];

export type LogPackPlan = {
  disposition: 'pack' | 'unjudged' | 'refused';
  reason: 'pack' | 'empty' | 'age-unmeasured' | 'now-unmeasured' | 'files-unmeasured' | 'name-invalid' | 'mtime-unmeasured' | 'clock-ahead';
  include: string[] | null;
};

const LOG_PACK_NAME = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9_./-]+$/;
const LOG_PACK_FUTURE_MS = 5 * 60 * 1000;

/**
 * 日志包只收已量到修改时间、且落在天数窗里的文件。
 * 天数或时刻没量到，就不把目录里的全部文件都打进去。本函数不读盘、不打包。
 */
export function planLogPack(input: {
  maxAgeDays: unknown;
  now: unknown;
  files: unknown;
}): LogPackPlan {
  const none = (reason: LogPackPlan['reason'], disposition: LogPackPlan['disposition'] = 'unjudged'): LogPackPlan => ({
    disposition,
    reason,
    include: null,
  });
  if (typeof input.maxAgeDays !== 'number' || !Number.isInteger(input.maxAgeDays) || input.maxAgeDays < 1) {
    return none('age-unmeasured');
  }
  if (typeof input.now !== 'number' || !Number.isFinite(input.now)) return none('now-unmeasured');
  if (!Array.isArray(input.files)) return none('files-unmeasured');
  if (input.files.length === 0) return { disposition: 'pack', reason: 'empty', include: [] };
  const cutoff = input.now - input.maxAgeDays * 24 * 60 * 60 * 1000;
  const include: string[] = [];
  for (const value of input.files) {
    if (value === null || typeof value !== 'object') return none('name-invalid', 'refused');
    const row = value as Record<string, unknown>;
    if (typeof row.name !== 'string' || !LOG_PACK_NAME.test(row.name)) return none('name-invalid', 'refused');
    if (typeof row.mtimeMs !== 'number' || !Number.isFinite(row.mtimeMs)) return none('mtime-unmeasured');
    if (row.mtimeMs > input.now + LOG_PACK_FUTURE_MS) return none('clock-ahead');
    if (row.mtimeMs >= cutoff) include.push(row.name);
  }
  return { disposition: 'pack', reason: 'pack', include };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
