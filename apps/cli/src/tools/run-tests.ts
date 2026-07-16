/**
 * 测试运行工具 — 让 Agent 能自主运行测试套件并获取结构化结果。
 *
 * 灵感来源:grok-build 的 TDD 能力(test runner 集成)。
 * 策略:
 *   - 自动检测测试框架:package.json scripts.test 中 jest/vitest/vitest-node
 *   - 执行 `npm test -- --json --reporter=json`(jest)或 `--reporter=json`(vitest)
 *   - 解析 JSON 输出返回结构化 {passed, failed, skipped, failures: [{name, message}]}
 *   - dangerLevel='dangerous'(可能执行任意代码,需确认)
 *   - 失败回退到原始 stdout(非 JSON 模式)
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Tool, ToolResult } from './index.js';
import { runPreToolCall, runPostToolCall } from '../hooks/index.js';

interface TestSummary {
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  failures: Array<{ name: string; message: string }>;
}

function detectTestFramework(workspacePath: string): 'jest' | 'vitest' | 'unknown' {
  try {
    const pkgPath = path.join(workspacePath, 'package.json');
    if (!fs.existsSync(pkgPath)) return 'unknown';
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { scripts?: Record<string, string> };
    const testScript = pkg.scripts?.test ?? '';
    if (testScript.includes('vitest')) return 'vitest';
    if (testScript.includes('jest')) return 'jest';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

function parseJestJson(stdout: string): TestSummary | null {
  // jest --json 输出是一整个 JSON 对象(可能前面有日志行)
  const jsonStart = stdout.indexOf('{');
  const jsonEnd = stdout.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) return null;
  try {
    const raw = stdout.slice(jsonStart, jsonEnd + 1);
    const data = JSON.parse(raw) as {
      numPassedTests?: number;
      numFailedTests?: number;
      numPendingTests?: number;
      numTotalTests?: number;
      testResults?: Array<{
        testResults?: Array<{ fullName?: string; status?: string; failureMessages?: string[] }>;
      }>;
    };
    const failures: Array<{ name: string; message: string }> = [];
    for (const fileResult of data.testResults ?? []) {
      for (const t of fileResult.testResults ?? []) {
        if (t.status === 'failed') {
          const msg = (t.failureMessages ?? []).join('\n').slice(0, 500) || '(无错误信息)';
          failures.push({ name: t.fullName ?? '(unknown)', message: msg });
        }
      }
    }
    return {
      passed: data.numPassedTests ?? 0,
      failed: data.numFailedTests ?? 0,
      skipped: data.numPendingTests ?? 0,
      total: data.numTotalTests ?? 0,
      failures,
    };
  } catch {
    return null;
  }
}

function parseVitestJson(stdout: string): TestSummary | null {
  // vitest --reporter=json 输出 JSON,字段:total/failed/passed/skipped + testResults
  const jsonStart = stdout.indexOf('{');
  const jsonEnd = stdout.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) return null;
  try {
    const raw = stdout.slice(jsonStart, jsonEnd + 1);
    const data = JSON.parse(raw) as {
      numTotalTests?: number;
      numFailedTests?: number;
      numPassedTests?: number;
      numPendingTests?: number;
      testResults?: Array<{
        name?: string;
        assertionResults?: Array<{ fullName?: string; status?: string; errors?: Array<{ message?: string }> }>;
      }>;
    };
    const failures: Array<{ name: string; message: string }> = [];
    for (const fileResult of data.testResults ?? []) {
      for (const a of fileResult.assertionResults ?? []) {
        if (a.status === 'failed') {
          const msg = (a.errors ?? []).map((e) => e.message ?? '').join('\n').slice(0, 500) || '(无错误信息)';
          failures.push({ name: a.fullName ?? fileResult.name ?? '(unknown)', message: msg });
        }
      }
    }
    return {
      passed: data.numPassedTests ?? 0,
      failed: data.numFailedTests ?? 0,
      skipped: data.numPendingTests ?? 0,
      total: data.numTotalTests ?? 0,
      failures,
    };
  } catch {
    return null;
  }
}

export const run_tests: Tool = {
  name: 'run_tests',
  description: '运行项目测试套件并返回结构化结果。参数:filter(字符串,测试文件名过滤,可选)。',
  dangerLevel: 'dangerous',
  parameters: {
    filter: { type: 'string', description: '测试文件名过滤(传给 jest -t 或 vitest 过滤)' },
  },
  required: [],
  execute(args, ctx): ToolResult {
    const filter = args.filter as string | undefined;
    const framework = detectTestFramework(ctx.workspacePath);

    const preResult = runPreToolCall('run_tests', { framework, filter });
    if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };

    const cmdArgs: string[] = ['test', '--'];
    if (framework === 'jest') {
      cmdArgs.push('--json', '--silent');
      if (filter) cmdArgs.push('-t', filter);
    } else if (framework === 'vitest') {
      cmdArgs.push('--reporter=json', '--run');
      if (filter) cmdArgs.push(filter);
    } else {
      cmdArgs.push('--json');
      if (filter) cmdArgs.push(filter);
    }

    const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', cmdArgs, {
      cwd: ctx.workspacePath,
      encoding: 'utf-8',
      timeout: 120_000,
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
    });

    const stdout = result.stdout ?? '';
    const stderr = result.stderr ?? '';
    const exitCode = result.status;

    runPostToolCall('run_tests', { exitCode, framework });

    const summary = framework === 'vitest'
      ? parseVitestJson(stdout)
      : parseJestJson(stdout);

    if (summary) {
      const lines: string[] = [
        `框架: ${framework}`,
        `总计: ${summary.total} | 通过: ${summary.passed} | 失败: ${summary.failed} | 跳过: ${summary.skipped}`,
      ];
      if (summary.failures.length > 0) {
        lines.push('', `失败用例 (${summary.failures.length}):`);
        for (const f of summary.failures.slice(0, 20)) {
          lines.push(`  ✗ ${f.name}`);
          lines.push(`    ${f.message.split('\n')[0]}`);
        }
        if (summary.failures.length > 20) {
          lines.push(`  ...(还有 ${summary.failures.length - 20} 个失败)`);
        }
      }
      return {
        success: summary.failed === 0,
        output: lines.join('\n'),
        error: summary.failed > 0 ? `${summary.failed} 个测试失败` : undefined,
      };
    }

    // JSON 解析失败,回退到原始输出
    const parts: string[] = [`框架: ${framework}(JSON 解析失败,显示原始输出)`];
    if (stdout.trim()) parts.push(stdout.trimEnd().slice(0, 5000));
    if (stderr.trim()) parts.push(`[stderr] ${stderr.trimEnd().slice(0, 2000)}`);
    return {
      success: exitCode === 0,
      output: parts.join('\n\n') || '(无输出)',
      error: exitCode !== 0 ? `npm 退出码 ${exitCode}` : undefined,
    };
  },
};

export const TEST_TOOLS: Tool[] = [run_tests];
