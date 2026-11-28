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
  benchmark?: string;
  generatedAt?: string;
  mode: 'mock' | 'cli';
  /** 本次驱动基准的真实模型 id(single-shot 模式必填) */
  model?: string | null;
  /** true = 单发直答(模型只回完整文件,不跑工具循环) */
  singleShot?: boolean;
  results: TaskResult[];
}

export type RunAgentFn = (prompt: string, task: BenchTask, workspace: string) => Promise<string>;

// ==================== Prompt & answer extraction ====================

/** 组装发给 agent 的 prompt：按 agent 的天然工作方式下指令 —— 在工作区落盘 + 跑校验命令。
 * 2026-11-27:不再要求"只回一个代码块";实测那会把对话式模型带偏(直接拒答/回一段解释),
 * 产物改为从磁盘取(pickSolution),文本代码块只作兜底。 */
export function buildPrompt(task: BenchTask): string {
  const fileTree = Object.keys(task.files).sort().join(', ');
  return [
    `You are an autonomous coding agent working inside a task workspace.`,
    `Language: ${task.language}. Mode: ${task.style === 'fix' ? 'fix the existing buggy file' : 'write from scratch'}.`,
    '',
    'Task:',
    task.prompt,
    '',
    `The workspace contains: ${fileTree}. Do not modify test files.`,
    `Write the final code into \`${task.targetFile}\` with your file tools, then run the validation command until it exits 0:`,
    task.verifyCmd,
    '',
    'Reply with a one-line summary when the validation command passes.',
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
  while ((m = re.exec(text)) !== null) {
    const group = m[1];
    if (group === undefined) throw new Error('extractCodeBlock: 正则捕获组缺失');
    last = group;
  }
  if (last !== null) return last.replace(/\r\n/g, '\n');
  return text.replace(/\r\n/g, '\n');
}

/** 评分判定：验证命令 exit 0 即 passed。 */
export function scoreTask(exitCode: number | null): boolean {
  return exitCode === 0;
}

/**
 * 取最终答案：优先用 agent 真正落在工作区的产物（agent 形态的本体），
 * 只有在"文件不存在 / fix 任务原样没动"时才退回从自由文本抽代码块。
 * 2026-11-27:此前只认文本代码块,agent 一旦走工具改文件就会被判成"无输出"。
 */
export function pickSolution(ws: string, task: BenchTask, answer: string): string {
  const target = join(ws, task.targetFile);
  if (existsSync(target)) {
    const onDisk = readFileSync(target, 'utf8');
    const seeded = task.files[task.targetFile];
    if (task.style === 'fix') {
      if (seeded === undefined || onDisk !== seeded) return onDisk;
    } else if (onDisk.trim().length > 0) {
      return onDisk;
    }
  }
  return extractCodeBlock(answer);
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
    const git = spawnSync('where.exe', ['git'], {
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      windowsHide: true,
    });
    for (const line of (git.stdout ?? '').split(/\r?\n/)) {
      const m = /^(.*?)[\\/]cmd[\\/]git\.exe$/i.exec(line.trim());
      if (m) {
        const installRoot = m[1];
        if (installRoot === undefined) throw new Error('resolveShell: git 路径捕获组缺失');
        const b = join(installRoot, 'bin', 'bash.exe');
        if (existsSync(b)) return b;
      }
    }
    return 'sh';
  }
  return 'sh';
}

/** 无需 POSIX shell 的验证命令（纯 node/python 调用），Windows 下直接执行，避免 WSL bash 桩干扰。 */
const NO_SHELL_RE = /^\s*(node|python|python3|py)(\s|$)/i;

/**
 * 把目录前置进 env 对象里的 PATH —— **写回已有的那一种拼写**,不新增第二种。
 *
 * 为什么需要这个出口(G-1105300 站点接线):Windows 环境块里 PATH 族的拼写**不止一种**。本机实测:
 * 从 Git Bash / 已登录会话继承的宿主给出 `PATH`,而**由注册表组合出来的登录环境块**
 * (计划任务 / Explorer 派生 / `Start-Process -UseNewEnvironment`)给出 `Path`,且该块内没有 `SYSTEMROOT`
 * —— 后者正是"在这种宿主里直接起 node 会当场 abort(`ncrypto::CSPRNG(nullptr, 0)`)"的原因。
 * 旧写法无条件 `env.Path = ...`,在 `PATH` 拼写的宿主上会让同一个对象里并存 `PATH`(未加目录)与
 * `Path`(加了目录)两份;Node 给 CreateProcess 拼环境块时按大小写不敏感去重,**留下的是继承来的那份**,
 * 于是"前置 Git\\bin 以屏蔽 WSL bash 桩"整句静默失效(实测子进程 `gitVisible:false`)。
 * 与 `scripts/lib/normalize-path-env.mjs`(把**已经**双拼的对象收口成一种)是两个不同操作:
 * 那条是"收口",这条是"不产生第二份";工具层无法被端内 import(根 node_modules 解析不到 workspace 链接),
 * 所以这里只维持"至多一种拼写"这一条不变量,不重做取值裁决。
 */
export function prependPathEntry(
  env: Record<string, string | undefined>,
  dir: string,
  delimiter = ';',
): Record<string, string | undefined> {
  const key = Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH';
  const current = env[key];
  env[key] = current ? [dir, current].join(delimiter) : dir;
  return env;
}

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
      prependPathEntry(env, dirname(resolveShell()));
    }
    cmd = resolveShell();
    args = ['-c', task.verifyCmd];
  }
  const r = spawnSync(cmd, args, {
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: ws,
    encoding: 'utf8',
    timeout: 120_000,
    env,
    windowsHide: true,
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
 * 单发直答适配器(2026-11-28):给"只会聊天、不会调工具"的上游模型用。
 * 把任务文件全文塞进一次请求,要求模型只回 JSON(files[].path/content);
 * 回答直接落盘,不走 CLI agent 的多轮工具循环。
 * 适用:号池里的 IDE-agent 上游(trae/qoder 等)会注入自己的 2 万 token 提示
 * 并接管工具,客户端 tools 被丢弃 —— 这种链路只适合单发改文件。
 */
export function makeSingleShotAgent(): RunAgentFn {
  const baseUrl = (process.env.IHUI_BENCH_BASE_URL ?? 'http://127.0.0.1:8813/v1').replace(/\/$/, '')
  const model = process.env.IHUI_BENCH_MODEL ?? 'Doubao-Seed-2.1-Turbo'
  const keyFile = resolve(HERE, '..', '.ihui-agent', 'tmp', 'relay-credential.txt')
  const apiKey = process.env.IHUI_BENCH_API_KEY ?? (existsSync(keyFile) ? readFileSync(keyFile, 'utf8').trim() : '')
  return async (_prompt: string, task: BenchTask, workspace: string) => {
    const fileBlock = Object.entries(task.files)
      .map(([p, c]) => `--- FILE: ${p} ---\n${c}`)
      .join('\n\n')
    const userPrompt = [
      `任务:${task.prompt}`,
      `目标文件:${task.targetFile}`,
      '以下是工作区现有文件全文:',
      fileBlock,
      '',
      '只输出一个 JSON 对象,不要解释、不要 markdown 围栏之外的其他文字:',
      '{"files":[{"path":"' + task.targetFile + '","content":"完整文件内容"}]}',
      '如果只需改一个文件,就只给这一个。content 必须是可直接写盘的完整文件。',
    ].join('\n')
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: '你是代码修复助手,只输出合法 JSON,不调用任何工具。' },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 4096,
      }),
      signal: AbortSignal.timeout(Number(process.env.IHUI_BENCH_TIMEOUT_MS ?? 180_000)),
    })
    const text = await resp.text()
    if (!resp.ok) throw new Error(`single-shot upstream ${resp.status}: ${text.slice(0, 300)}`)
    type ChatCompletion = { choices?: Array<{ message?: { content?: string } }> }
    let parsed: ChatCompletion
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new Error(`single-shot non-JSON response: ${text.slice(0, 300)}`)
    }
    const answer: string = parsed.choices?.[0]?.message?.content ?? ''
    // 回答里抓 JSON(模型常套 ```json 围栏或在前后加一句话)
    const candidates: string[] = []
    const fence = answer.match(/```(?:json)?\s*([\s\S]*?)```/i)
    if (fence) candidates.push(fence[1])
    const brace = answer.match(/\{[\s\S]*\}/)
    if (brace) candidates.push(brace[0])
    for (const c of candidates) {
      try {
        const obj = JSON.parse(c.trim())
        const files = Array.isArray(obj.files) ? obj.files : []
        for (const f of files) {
          if (!f?.path || typeof f.content !== 'string') continue
          const abs = resolve(workspace, f.path)
          if (!abs.startsWith(resolve(workspace))) continue
          mkdirSync(dirname(abs), { recursive: true })
          writeFileSync(abs, f.content.endsWith('\n') ? f.content : f.content + '\n', 'utf8')
        }
        if (files.length > 0) return answer
      } catch {
        /* 试下一个候选 */
      }
    }
    return answer
  }
}

/**
 * CLI headless 适配器：调用本仓库 `ihui agent` 命令。
 * 通过 IHUI_BENCH_CLI 可覆盖入口（默认走 tsx 直跑 src/index.ts，无需先 build）。
 */
export function makeCliAgent(): RunAgentFn {
  const here = dirname(fileURLToPath(import.meta.url));
  const cliRoot = resolve(here, '..');
  const entry = process.env.IHUI_BENCH_CLI || '';
  return async (prompt: string, _task: BenchTask, workspace: string) => {
    let cmd: string;
    let args: string[];
    if (entry) {
      cmd = entry;
      args = ['agent', prompt, '--json', '--allow-dangerous', '--no-setup', '-w', workspace];
    } else {
      cmd = process.execPath;
      // 2026-11-27:改走 tsx 的 JS 入口(cli.mjs) —— `node .bin/tsx` 在 Windows 上会
      // 把 POSIX sh 包装脚本当 JS 解析,直接 SyntaxError,bench 在 win 上永远跑不起来。
      args = [
        resolve(cliRoot, 'node_modules/tsx/dist/cli.mjs'),
        resolve(cliRoot, 'src/index.ts'),
        'agent', prompt, '--json', '--allow-dangerous', '--no-setup', '-w', workspace,
      ];
    }
    const r = spawnSync(cmd, args, {
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
      // 2026-11-27:工作目录必须落到任务工作区,否则 agent 会把整个 CLI 仓库当上下文,
      // 既看不到测试文件也不会把产物写进被测目录(此前 8 例 0 分的直接原因之一)。
      cwd: workspace,
      encoding: 'utf8',
      timeout: 600_000,
      maxBuffer: 32 * 1024 * 1024,
      windowsHide: true,
    });
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
  const runAgent =
    opts.runAgent ??
    (useMock
      ? makeMockAgent()
      : process.env.IHUI_BENCH_MODE === 'single-shot'
        ? makeSingleShotAgent()
        : makeCliAgent());
  const outPath = opts.outPath ?? join(HERE, 'results', 'latest.json');

  const root = opts.workRoot ?? mkdtempSync(join(tmpdir(), 'ihui-bench-'));
  const results: TaskResult[] = [];
  // 2026-11-27:免费档上游按分钟限流,连跑必然撞 RateLimitError。任务之间留间隔,
  // 由 IHUI_BENCH_DELAY_MS 控制(默认 0,CI 里保持快跑)。
  const delayMs = Number(process.env.IHUI_BENCH_DELAY_MS ?? 0);

  for (const [index, task] of tasks.entries()) {
    if (index > 0 && delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    console.log(`[bench] (${index + 1}/${tasks.length}) start ${task.id}`);
    const ws = setupWorkspace(task, root);
    try {
      const raw = await runAgent(buildPrompt(task), task, ws);
      const code = pickSolution(ws, task, raw);
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
    benchmark: 'IHUI-8',
    generatedAt: new Date().toISOString(),
    mode: useMock ? 'mock' : 'cli',
    model: useMock ? undefined : (process.env.IHUI_BENCH_MODEL ?? null),
    singleShot: !useMock && process.env.IHUI_BENCH_MODE === 'single-shot',
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
  const outPath = process.env.IHUI_BENCH_OUT
    ? resolve(process.env.IHUI_BENCH_OUT)
    : join(HERE, 'results', 'latest.json');  runBenchmark({ outPath })
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
