// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 测试运行工具 — 让 Agent 能自主运行测试套件并获取结构化结果。
 *
 * 灵感来源:参考行业 Agent 框架的 TDD 能力(test runner 集成)。
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
import { tryParseJson, isRecord, isJsonArray } from '../util/json.js';

interface TestSummary {
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  failures: Array<{ name: string; message: string }>;
}

function toCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * 2026-11-08 P0(F-001):Windows 上 Node ≥20.12 对 `.cmd`/`.bat` 直接 spawnSync 恒返回
 * EINVAL(CVE-2024-27980 后的显式拒绝,必须显式要求 shell)。这里**不启用 shell**
 * —— 否则用户可控的 filter 会被 cmd.exe 二次解释,把一个 EINVAL 换成命令注入。
 * 改为用当前 node 直接执行 npm-cli.js(standard Node/npm 安装布局),保持无 shell 执行。
 * 找不到 npm 入口时抛明确错误,而不是把 EINVAL/postInstall 失败当成测试失败。
 */
export function resolveNpmSpawn(extraArgs: string[]): { command: string; args: string[] } {
  if (process.platform !== 'win32') return { command: 'npm', args: extraArgs };
  const nodeDir = path.dirname(process.execPath);
  const candidates: string[] = [];
  const execPathHint = process.env.npm_execpath;
  if (execPathHint && /npm-cli\.js$/i.test(execPathHint)) candidates.push(execPathHint);
  candidates.push(
    path.join(nodeDir, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    path.join(nodeDir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  );
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return { command: process.execPath, args: [candidate, ...extraArgs] };
    }
  }
  throw new Error('未找到 npm-cli.js(已检查 Node 安装目录与 npm_execpath),无法在 Windows 上安全执行 npm test');
}

function detectTestFramework(workspacePath: string): 'jest' | 'vitest' | 'unknown' {
  try {
    const pkgPath = path.join(workspacePath, 'package.json');
    if (!fs.existsSync(pkgPath)) return 'unknown';
    const parsed = tryParseJson(fs.readFileSync(pkgPath, 'utf-8'));
    if (!isRecord(parsed)) return 'unknown';
    const testScript = isRecord(parsed.scripts) && typeof parsed.scripts.test === 'string' ? parsed.scripts.test : '';
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
    const data = tryParseJson(raw);
    if (!isRecord(data)) return null;
    const failures: Array<{ name: string; message: string }> = [];
    for (const fileResult of isJsonArray(data.testResults) ? data.testResults : []) {
      if (!isRecord(fileResult)) continue;
      for (const t of isJsonArray(fileResult.testResults) ? fileResult.testResults : []) {
        if (!isRecord(t)) continue;
        if (t.status === 'failed') {
          const msg = (isJsonArray(t.failureMessages) ? t.failureMessages : []).join('\n').slice(0, 500) || '(无错误信息)';
          failures.push({ name: typeof t.fullName === 'string' ? t.fullName : '(unknown)', message: msg });
        }
      }
    }
    return {
      passed: toCount(data.numPassedTests),
      failed: toCount(data.numFailedTests),
      skipped: toCount(data.numPendingTests),
      total: toCount(data.numTotalTests),
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
    const data = tryParseJson(raw);
    if (!isRecord(data)) return null;
    const failures: Array<{ name: string; message: string }> = [];
    for (const fileResult of isJsonArray(data.testResults) ? data.testResults : []) {
      if (!isRecord(fileResult)) continue;
      for (const a of isJsonArray(fileResult.assertionResults) ? fileResult.assertionResults : []) {
        if (!isRecord(a)) continue;
        if (a.status === 'failed') {
          const msg = (isJsonArray(a.errors) ? a.errors : [])
            .map((e) => (isRecord(e) && typeof e.message === 'string' ? e.message : ''))
            .join('\n')
            .slice(0, 500) || '(无错误信息)';
          failures.push({
            name: typeof a.fullName === 'string' ? a.fullName : typeof fileResult.name === 'string' ? fileResult.name : '(unknown)',
            message: msg,
          });
        }
      }
    }
    return {
      passed: toCount(data.numPassedTests),
      failed: toCount(data.numFailedTests),
      skipped: toCount(data.numPendingTests),
      total: toCount(data.numTotalTests),
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
  async execute(args, ctx): Promise<ToolResult> {
    const filter = args.filter as string | undefined;
    const framework = detectTestFramework(ctx.workspacePath);

    const preResult = await runPreToolCall('run_tests', { framework, filter }, ctx.signal);
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

    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    // 2026-11-08 P0(F-001):Windows 的 npm.cmd 直呼会被 Node 拒绝(EINVAL),见 resolveNpmSpawn。
    let spawnPlan: { command: string; args: string[] };
    try {
      spawnPlan = resolveNpmSpawn(cmdArgs);
    } catch (err) {
      return {
        success: false,
        output: '',
        error: `无法启动 npm test:${err instanceof Error ? err.message : String(err)}`,
      };
    }
    const result = spawnSync(spawnPlan.command, spawnPlan.args, {
      cwd: ctx.workspacePath,
      encoding: 'utf-8',
      timeout: 120_000,
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const stdout = result.stdout ?? '';
    const stderr = result.stderr ?? '';
    const exitCode = result.status;

    await runPostToolCall('run_tests', { exitCode, framework }, ctx.signal);

    // 启动失败(result.error)与"测试真的失败"必须区分:旧代码把 status=null 折成
    // `npm 退出码 null`,让环境故障伪装成业务结论。
    if (result.error) {
      const detail = stderr.trim() ? `\n[stderr] ${stderr.trimEnd().slice(0, 2000)}` : '';
      return {
        success: false,
        output: `框架: ${framework}(未能启动 npm test)${detail}`,
        error: `启动 npm test 失败:${result.error.message}`,
      };
    }

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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
