// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildPrompt,
  extractCodeBlock,
  runBenchmark,
  scoreTask,
  setupWorkspace,
  type BenchTask,
  type TasksFile,
} from './runner.ts';

const tasksPath = join(dirname(fileURLToPath(import.meta.url)), 'tasks.json');
const tasksFile = JSON.parse(readFileSync(tasksPath, 'utf8')) as TasksFile;

// ---- 构造两个离线可验证的合成任务（node 即可跑，不依赖 python/shell）----

const passTask: BenchTask = {
  id: 'synth-pass',
  language: 'typescript',
  style: 'generation',
  prompt: 'Export `add(a,b)` returning a+b.',
  files: {},
  verifyCmd: 'node --experimental-strip-types check.mjs',
  targetFile: 'solution.ts',
  mockAnswer: 'export function add(a: number, b: number): number { return a + b; }\n',
};

// 验证脚本以文件形式提供，避免 shell 引号在 Windows/Git-Bash 下的差异
passTask.files = { 'check.mjs': "import { add } from './solution.ts';\nif (add(1, 2) !== 3) process.exit(1);\nconsole.log('OK');\n" };

const failTask: BenchTask = {
  ...passTask,
  id: 'synth-fail',
  mockAnswer: 'export function add(a: number, b: number): number { return a - b; }\n',
};

describe('benchmarks/tasks.json 结构', () => {
  it('包含 8-10 题且覆盖 python/typescript/shell，含 fix 风格题目', () => {
    expect(tasksFile.tasks.length).toBeGreaterThanOrEqual(8);
    expect(tasksFile.tasks.length).toBeLessThanOrEqual(10);
    const langs = new Set(tasksFile.tasks.map((t) => t.language));
    expect(langs.has('python')).toBe(true);
    expect(langs.has('typescript')).toBe(true);
    expect(langs.has('shell')).toBe(true);
    expect(tasksFile.tasks.filter((t) => t.style === 'fix').length).toBeGreaterThanOrEqual(2);
  });

  it('每题字段完整：prompt/verifyCmd/targetFile/mockAnswer 非空，files 为对象', () => {
    for (const t of tasksFile.tasks) {
      expect(t.id).toBeTruthy();
      expect(t.prompt.length).toBeGreaterThan(10);
      expect(t.verifyCmd).toBeTruthy();
      expect(t.targetFile).toBeTruthy();
      expect(t.mockAnswer.length).toBeGreaterThan(0);
      expect(typeof t.files).toBe('object');
    }
  });
});

describe('runner 纯函数', () => {
  it('scoreTask 仅 exit 0 判为 passed', () => {
    expect(scoreTask(0)).toBe(true);
    expect(scoreTask(1)).toBe(false);
    expect(scoreTask(127)).toBe(false);
    expect(scoreTask(null)).toBe(false);
  });

  it('extractCodeBlock 优先取最后一个围栏代码块并去除 CRLF', () => {
    const text = '前言\n```ts\nconst a = 1;\r\n```\n中间\n```python\nprint(2)\n```\n后记';
    expect(extractCodeBlock(text)).toBe('print(2)\n');
  });

  it('extractCodeBlock 无围栏时返回全文', () => {
    expect(extractCodeBlock('plain code\nline2')).toBe('plain code\nline2');
  });

  it('buildPrompt 包含目标文件、验证命令与任务描述', () => {
    const p = buildPrompt(passTask);
    expect(p).toContain(passTask.targetFile);
    expect(p).toContain(passTask.verifyCmd);
    expect(p).toContain(passTask.prompt);
  });

  it('setupWorkspace 预置模板文件', () => {
    const root = mkdtempSync(join(tmpdir(), 'ihui-bench-test-'));
    try {
      const task: BenchTask = { ...passTask, files: { 'a/b.txt': 'hello' } };
      const ws = setupWorkspace(task, root);
      expect(readFileSync(join(ws, 'a', 'b.txt'), 'utf8')).toBe('hello');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('runBenchmark 评分逻辑（mock agent，离线）', () => {
  let outPath: string;
  let workRoot: string;

  beforeAll(() => {
    workRoot = mkdtempSync(join(tmpdir(), 'ihui-bench-run-'));
    outPath = join(workRoot, 'results', 'latest.json');
  });

  afterAll(() => {
    rmSync(workRoot, { recursive: true, force: true });
  });

  it('正确答案 PASS、错误答案 FAIL，结果写入 latest.json', async () => {
    const summary = await runBenchmark({
      tasks: [passTask, failTask],
      outPath,
      workRoot,
    });

    expect(summary.total).toBe(2);
    expect(summary.passed).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.passRate).toBeCloseTo(0.5);

    const byId = Object.fromEntries(summary.results.map((r) => [r.id, r]));
    expect(byId['synth-pass'].passed).toBe(true);
    expect(byId['synth-pass'].exitCode).toBe(0);
    expect(byId['synth-fail'].passed).toBe(false);
    expect(byId['synth-fail'].exitCode).not.toBe(0);

    expect(existsSync(outPath)).toBe(true);
    const written = JSON.parse(readFileSync(outPath, 'utf8'));
    expect(written.total).toBe(2);
    expect(written.results.length).toBe(2);
  }, 60_000);

  it('agent 抛错时该题记为 FAIL 且不中断整体流程', async () => {
    const summary = await runBenchmark({
      tasks: [failTask],
      runAgent: async () => {
        throw new Error('boom');
      },
      outPath: join(workRoot, 'err.json'),
      workRoot,
    });
    expect(summary.results[0].passed).toBe(false);
    expect(summary.results[0].error).toContain('boom');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
