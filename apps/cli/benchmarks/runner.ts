// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * IHUI-AI Bench Runner — 轻量级类 SWE-bench / HumanEval 自动化评测流水线（最小可用版本）
 *
 * 用法：
 *   1) CI/离线冒烟（不调用 LLM，使用 tasks.json 内置 mockAnswer 桩答案）：
 *        cd apps/cli && pnpm bench           # 即 `tsx benchmarks/runner.ts`
 *        IHUI_BENCH_MOCK=1 pnpm bench
 *   2) 真实评测（通过本仓库 CLI 的 headless agent 能力生成代码）：
 *        cd apps/cli && IHUI_BENCH_MOCK=0 pnpm bench
 *      —— runner 会调用 `ihui agent "<prompt>" --json --allow-dangerous -w <workspace>`
 *         （见 src/index.ts 顶层命令与 src/commands/agent.ts 的 headless NDJSON 输出）。
 *         需要本机已配置 ~/.ihui/settings.json 或 IHUI_API_URL/IHUI_API_KEY。
 *   3) 自定义 agent 适配层（供 vitest 或外部编排注入）：
 *        import { runBenchmark, extractCodeBlock } from './runner.ts';
 *        await runBenchmark({ runAgent: async (p) => myLLM(p), outPath: '/tmp/r.json' });
 *
 * 结果：写入 benchmarks/results/latest.json；stdout 打印 pass-rate 摘要。
 * 验证依赖：python+pytest、node(>=20.6，--experimental-strip-types)、sh（POSIX shell，Windows 下经 Git Bash）。
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 本文件所在目录（benchmarks/），兼容 tsx / vitest(vite define) / node ESM。 */
const HERE = dirname(fileURLToPath(import.meta.url));

// ==================== Types ====================

export interface BenchTask {
  id: string;
  language: 'python' | 'typescript' | 'shell';
  style: 'generation' | 'fix';
  prompt: string;
  /** 预置到工作区的文件（测试模板、有 bug 的源文件等），路径 -> 内容 */
  files: Record<string, string>;
  /** 在工作区根目录执行的验证命令；exit 0 视为通过 */
  verifyCmd: string;
  /** agent 应产出/修改的目标文件（相对工作区根） */
  targetFile: string;
  /** mock 模式下的桩答案（完整文件内容） */
  mockAnswer: string;
}

export interface TasksFile {
  tasks: BenchTask[];
}

export interface TaskResult {
  id: string;
  language: string;
  style: string;
  passed: boolean;
  exitCode: number | null;
  /** 验证命令输出尾部（截断），便于排错 */
  outputTail: string;
  error?: string;
}

export interface BenchSummary {
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  mode: 'mock' | 'cli';
  results: TaskResult[];
}

export type RunAgentFn = (prompt: string, task: BenchTask) => Promise<string>;

// ==================== Prompt & answer extraction ====================

/** 组装发给 agent 的固定 prompt（要求只回一个代码块，便于确定性抽取）。 */
export function buildPrompt(task: BenchTask): string {
  const fileTree = Object.keys(task.files).sort().join(', ');
  return [
    `You are a coding benchmark agent. Produce the final content of the single file \`${task.targetFile}\`.`,
    `Language: ${task.language}. Mode: ${task.style === 'fix' ? 'fix the existing buggy file' : 'write from scratch'}.`,
    `Workspace already contains these files (do NOT modify tests): ${fileTree}.`,
    `Validation command (must exit 0): ${task.verifyCmd}`,
    '',
    'Task:',
    task.prompt,
    '',
    'Respond with EXACTLY ONE fenced code block containing the full final content of',
    `\`${task.targetFile}\` and nothing else outside it.`,
  ].join('\n');
}

/**
 * 从 agent 自由文本中抽取代码：优先取最后一个 ```fenced``` 块的内容；
 * 无围栏时把整段文本当作文件内容。
 */
export function extractCodeBlock(text: string): string {
  const re = /```[^\n]*\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  let last: string | null = null;
  while ((m = re.exec(text)) !== null) last = m[1];
  if (last !== null) return last.replace(/\r\n/g, '\n');
  return text.replace(/\r\n/g, '\n');
}

/** 评分判定：验证命令 exit 0 即 passed。 */
export function scoreTask(exitCode: number | null): boolean {
  return exitCode === 0;
}

// ==================== Workspace & verification ====================

export function setupWorkspace(task: BenchTask, root: string): string {
  const ws = join(root, task.id);
  mkdirSync(ws, { recursive: true });
  for (const [rel, content] of Object.entries(task.files)) {
    const abs = join(ws, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content, 'utf8');
  }
  return ws;
}

export function writeSolution(ws: string, task: BenchTask, code: string): void {
  const abs = join(ws, task.targetFile);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, code.endsWith('\n') ? code : code + '\n', 'utf8');
}

/** 解析 POSIX shell：优先 Git Bash，兜底 sh；显式排除 Windows 的 WSL 转发桩 bash.exe。 */
export function resolveShell(): string {
  if (process.env.IHUI_BENCH_SHELL) return process.env.IHUI_BENCH_SHELL;
  if (process.platform === 'win32') {
    const candidates = [
      'C:\\Program Files\\Git\\bin\\bash.exe',
      'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
      join(process.env.PROGRAMFILES ?? 'C:\\Program Files', 'Git', 'bin', 'bash.exe'),
    ];
    for (const c of candidates) {
      if (existsSync(c)) return c;
    }
    // PATH 上的 git 反推 Git 安装目录（.../Git/cmd/git.exe -> .../Git/bin/bash.exe）
    const git = spawnSync('where.exe', ['git'], { encoding: 'utf8' });
    for (const line of (git.stdout ?? '').split(/\r?\n/)) {
      const m = /^(.*?)[\\/]cmd[\\/]git\.exe$/i.exec(line.trim());
      if (m) {
        const b = join(m[1], 'bin', 'bash.exe');
        if (existsSync(b)) return b;
      }
    }
    return 'sh';
  }
  return 'sh';
}

/** 无需 POSIX shell 的验证命令（纯 node/python 调用），Windows 下直接执行，避免 WSL bash 桩干扰。 */
const NO_SHELL_RE = /^\s*(node|python|python3|py)(\s|$)/i;

export function verifyTask(ws: string, task: BenchTask): { exitCode: number | null; outputTail: string; error?: string } {
  const env: Record<string, string | undefined> = {
    ...process.env,
    PYTHONDONTWRITEBYTECODE: '1',
    CI: '1',
    LANG: 'C.UTF-8',
    LC_ALL: 'C.UTF-8',
  };
  let cmd: string;
  let args: string[];
  if (process.platform === 'win32' && NO_SHELL_RE.test(task.verifyCmd)) {
    // Windows：node/python 验证命令直接经 cmd.exe 执行，避开 WSL bash 桩与 shell 引号差异
    cmd = process.env.ComSpec ?? 'cmd.exe';
    args = ['/d', '/s', '/c', task.verifyCmd];
  } else {
    if (process.platform === 'win32') {
      // 防止 Git Bash 参数路径转换；把 Git\bin 前置，屏蔽 WSL 转发桩目录中的 bash/sh
      env.MSYS_NO_PATHCONV = '1';
      env.MSYS2_ARG_CONV_EXCL = '*';
      delete env.PATH_LOCAL;
      const gitBin = dirname(resolveShell());
      env.Path = [gitBin, env.Path ?? ''].join(';');
    }
    cmd = resolveShell();
    args = ['-c', task.verifyCmd];
  }
  const r = spawnSync(cmd, args, {
    cwd: ws,
    encoding: 'utf8',
    timeout: 120_000,
    env,
  });
  if (r.error) {
    return { exitCode: null, outputTail: '', error: String(r.error.message ?? r.error) };
  }
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  return { exitCode: r.status, outputTail: out.slice(-800) };
}

// ==================== Agent adapters ====================

/** 默认 mock 适配器：直接返回任务内置桩答案，CI 无网络可跑通。 */
export function makeMockAgent(): RunAgentFn {
  return async (_prompt: string, task: BenchTask) => task.mockAnswer;
}

/**
 * CLI headless 适配器：调用本仓库 `ihui agent` 命令。
 * 通过 IHUI_BENCH_CLI 可覆盖入口（默认走 tsx 直跑 src/index.ts，无需先 build）。
 */
export function makeCliAgent(): RunAgentFn {
  const here = dirname(fileURLToPath(import.meta.url));
  const cliRoot = resolve(here, '..');
  const entry = process.env.IHUI_BENCH_CLI || '';
  return async (prompt: string) => {
    let cmd: string;
    let args: string[];
    if (entry) {
      cmd = entry;
      args = ['agent', prompt, '--json', '--allow-dangerous', '--no-setup', '-w', cliRoot];
    } else {
      cmd = process.execPath;
      args = [
        resolve(cliRoot, 'node_modules/.bin/tsx'),
        resolve(cliRoot, 'src/index.ts'),
        'agent', prompt, '--json', '--allow-dangerous', '--no-setup', '-w', cliRoot,
      ];
    }
    const r = spawnSync(cmd, args, { cwd: cliRoot, encoding: 'utf8', timeout: 600_000, maxBuffer: 32 * 1024 * 1024 });
    if (r.error) throw new Error(`CLI agent spawn failed: ${r.error.message}`);
    // NDJSON 事件流：拼接所有 assistant 文本片段作为原始回答
    const chunks: string[] = [];
    for (const line of (r.stdout ?? '').split(/\r?\n/)) {
      const t = line.trim();
      if (!t.startsWith('{')) continue;
      try {
        const ev = JSON.parse(t) as Record<string, unknown>;
        const c = ev.content ?? ev.text ?? ev.delta;
        if (typeof c === 'string' && (ev.type === 'assistant' || ev.role === 'assistant' || ev.type === 'message')) chunks.push(c);
      } catch { /* 忽略非 JSON 行 */ }
    }
    const answer = chunks.join('');
    if (!answer && r.status !== 0) {
      throw new Error(`CLI agent produced no output (exit ${r.status}): ${(r.stderr ?? '').slice(0, 400)}`);
    }
    return answer || (r.stdout ?? '');
  };
}

// ==================== Orchestration ====================

export interface RunOptions {
  runAgent?: RunAgentFn;
  tasks?: BenchTask[];
  outPath?: string;
  workRoot?: string;
  keepWorkspace?: boolean;
}

export async function runBenchmark(opts: RunOptions = {}): Promise<BenchSummary> {
  const tasks: BenchTask[] = opts.tasks ?? JSON.parse(readFileSync(join(HERE, 'tasks.json'), 'utf8')).tasks;
  const useMock = opts.runAgent ? false : (process.env.IHUI_BENCH_MOCK !== '0');
  const runAgent = opts.runAgent ?? (useMock ? makeMockAgent() : makeCliAgent());
  const outPath = opts.outPath ?? join(HERE, 'results', 'latest.json');

  const root = opts.workRoot ?? mkdtempSync(join(tmpdir(), 'ihui-bench-'));
  const results: TaskResult[] = [];

  for (const task of tasks) {
    const ws = setupWorkspace(task, root);
    try {
      const raw = await runAgent(buildPrompt(task), task);
      const code = extractCodeBlock(raw);
      writeSolution(ws, task, code);
      const v = verifyTask(ws, task);
      results.push({
        id: task.id,
        language: task.language,
        style: task.style,
        passed: scoreTask(v.exitCode),
        exitCode: v.exitCode,
        outputTail: v.outputTail,
        error: v.error,
      });
    } catch (err) {
      results.push({
        id: task.id,
        language: task.language,
        style: task.style,
        passed: false,
        exitCode: null,
        outputTail: '',
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      if (!opts.keepWorkspace) rmSync(ws, { recursive: true, force: true });
    }
  }

  const passed = results.filter((r) => r.passed).length;
  const summary: BenchSummary = {
    total: results.length,
    passed,
    failed: results.length - passed,
    passRate: results.length ? passed / results.length : 0,
    mode: useMock ? 'mock' : 'cli',
    results,
  };

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(summary, null, 2), 'utf8');
  return summary;
}

function printSummary(s: BenchSummary, outPath: string): void {
  console.log(`\n=== IHUI Bench (${s.mode}) ===`);
  for (const r of s.results) {
    console.log(`${r.passed ? 'PASS' : 'FAIL'}  ${r.id}  [${r.language}/${r.style}]${r.error ? `  err=${r.error}` : ''}`);
  }
  console.log(`pass-rate: ${s.passed}/${s.total} (${(s.passRate * 100).toFixed(1)}%)`);
  console.log(`results -> ${outPath}`);
}

// 直接执行（tsx benchmarks/runner.ts）时才跑主流程；被 import（如 vitest）时无副作用。
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const outPath = join(HERE, 'results', 'latest.json');
  runBenchmark({ outPath })
    .then((s) => {
      printSummary(s, outPath);
      process.exit(s.failed === 0 ? 0 : 1);
    })
    .catch((err) => {
      console.error(err);
      process.exit(2);
    });
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
