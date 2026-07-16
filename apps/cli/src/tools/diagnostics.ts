/**
 * 诊断工具 — 让 Agent 获取 TypeScript 类型错误和 ESLint 诊断。
 *
 * 灵感来源:cli 的 LSP diagnostic 查询 + cargo clippy 集成。
 * 做减法:直接 spawnSync 调项目自带的 tsc/eslint,解析输出,零依赖。
 */

import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import type { Tool, ToolResult } from './index.js';
import { runPreToolCall, runPostToolCall } from '../hooks/index.js';

interface Diagnostic {
  file: string;
  line: number;
  column: number;
  severity: 'error' | 'warning';
  message: string;
  ruleId?: string;
}

function runTsc(cwd: string): Diagnostic[] {
  const result = spawnSync('npx', ['tsc', '--noEmit', '--pretty', 'false'], {
    cwd,
    encoding: 'utf-8',
    timeout: 60_000,
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
  });
  const stdout = (result.stdout as string) ?? '';
  const diags: Diagnostic[] = [];
  const re = /^(.+?)\((\d+),(\d+)\): (error|warning) (TS\d+): (.+)$/;
  for (const line of stdout.split('\n')) {
    const m = re.exec(line.trim());
    if (m) {
      diags.push({
        file: path.relative(cwd, m[1]!),
        line: Number(m[2]!),
        column: Number(m[3]!),
        severity: m[4] as 'error' | 'warning',
        ruleId: m[5]!,
        message: m[6]!,
      });
    }
  }
  return diags;
}

function runEslint(cwd: string, targetPath?: string): Diagnostic[] {
  const args = ['eslint', '--format', 'json', targetPath || '.'];
  const result = spawnSync('npx', args, {
    cwd,
    encoding: 'utf-8',
    timeout: 60_000,
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
  });
  const stdout = (result.stdout as string) ?? '';
  try {
    const data = JSON.parse(stdout) as Array<{
      filePath: string;
      messages: Array<{
        ruleId?: string;
        message: string;
        line: number;
        column: number;
        severity: number;
      }>;
    }>;
    const diags: Diagnostic[] = [];
    for (const file of data) {
      for (const m of file.messages) {
        diags.push({
          file: path.relative(cwd, file.filePath),
          line: m.line,
          column: m.column,
          severity: m.severity === 2 ? 'error' : 'warning',
          message: m.message,
          ruleId: m.ruleId,
        });
      }
    }
    return diags;
  } catch {
    return [];
  }
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
    const preResult = runPreToolCall('get_diagnostics', { linter, path: targetPath });
    if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };

    const diags: Diagnostic[] = [];
    if (linter === 'tsc' || linter === 'auto') diags.push(...runTsc(ctx.workspacePath));
    if (linter === 'eslint' || linter === 'auto') diags.push(...runEslint(ctx.workspacePath, targetPath));

    runPostToolCall('get_diagnostics', { count: diags.length });

    const errors = diags.filter((d) => d.severity === 'error');
    const warnings = diags.filter((d) => d.severity === 'warning');

    if (diags.length === 0) return { success: true, output: '无诊断(0 错误, 0 警告)' };

    const lines: string[] = [`总计: ${errors.length} 错误, ${warnings.length} 警告`];
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
