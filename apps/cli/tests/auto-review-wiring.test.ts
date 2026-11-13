// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * 自动复审的**真实回灌链路**端到端测试。
 *
 * 为什么需要这一层:goal-run / auto-review-run 各自被单测穷尽了,但中间那段
 * `reviewDue(shouldReview) → 真跑诊断(tsc+eslint) → reviewAgainstBaseline`
 * → 回传 `review` 字段 的**接线**此前零覆盖。这正是 auto-review 的全部意义:
 * 判据说该审了 ⇒ 真跑诊断 ⇒ 只报新增 ⇒ 回到回合结果。
 * 不钉它,"接真实诊断"就只是源码里一行没人验证的 if。
 *
 * 三条结论都要可区分(否则上层无法决定处置):
 *   · 没触发/没开启 ⇒ review 字段缺失(缺失 = 没跑,绝不伪装成"通过");
 *   · 触发且开启 + 首次无基线 ⇒ 全算存量,regressed=false,不误报;
 *   · 触发且开启 + 有基线 + 出现新错误 ⇒ 只报新增,regressed=true。
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ApiClient from '@ihui/api-client';

// ---- 隔离:复审基线落盘必须进临时目录,绝不污染真实工作区 ----
let dir = '';

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-review-wiring-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

type StreamChatOpts = {
  model: string;
  messages: unknown[];
  onDelta: (delta: string) => void;
  onError?: (err: string) => void;
  onDone?: () => void;
};

const { streamChatMock } = vi.hoisted(() => ({
  streamChatMock: vi.fn<(opts: StreamChatOpts) => Promise<void>>(),
}));

vi.mock('@ihui/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClient>();
  return {
    ...actual,
    streamChat: streamChatMock,
    setBaseUrl: vi.fn(),
    setTokenProvider: vi.fn(),
  };
});

vi.mock('../src/audit.js', () => ({ auditLog: vi.fn() }));

/** 受控的诊断输出:测试注入,替代真实 tsc/eslint 子进程(避免 CI 起进程不稳)。 */
const { tscMock, eslintMock } = vi.hoisted(() => ({
  tscMock: vi.fn<() => Diagnostic[]>(),
  eslintMock: vi.fn<() => Diagnostic[]>(),
}));

vi.mock('../src/tools/diagnostics.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, runTsc: tscMock, runEslint: eslintMock };
});

import type { Diagnostic } from '../src/tools/diagnostics.js';
import { runToolLoop } from '../src/commands/agent.js';
import { registerTools, clearTools, type Tool } from '../src/tools/index.js';
import { loadBaseline } from '../src/tools/auto-review-run.js';
import type { ReviewPolicy } from '../src/tools/auto-review.js';

/** 每次成功的写都触发(every-write)—— 让"该不该审"的事实确定,不依赖 batched 攒数。 */
const everyWritePolicy: ReviewPolicy = {
  enabled: true,
  trigger: 'every-write',
  batchSize: 1,
  minIntervalMs: 0,
  writeTools: ['edit_file'],
};

/** 一个命中 writeTools 的成功写工具:它的成功会让 shouldReview 判"该审了"。 */
const writeTool: Tool = {
  name: 'edit_file',
  description: 'mock write tool',
  parameters: {},
  required: [],
  execute: async () => ({ success: true, output: 'ok' }),
};

function setStream(responses: string[]): void {
  for (const text of responses) {
    streamChatMock.mockImplementationOnce(async (opts: StreamChatOpts) => {
      opts.onDelta(text);
    });
  }
}

const diag = (file: string, msg: string, rule = 'TS2322') => ({
  file: path.join(dir, file),
  line: 1,
  column: 1,
  severity: 'error' as const,
  message: msg,
  ruleId: rule,
});

describe('auto-review 真实回灌链路', () => {
  beforeEach(() => {
    clearTools();
    registerTools([writeTool]);
    streamChatMock.mockReset();
    tscMock.mockReset();
    eslintMock.mockReset();
  });

  it('reviewDue=true 但 reviewExecute=false ⇒ 真跑诊断,review 字段缺失(没跑≠通过)', async () => {
    setStream(['```tool_call\n{"name":"edit_file","arguments":{}}\n```', '完成。']);
    tscMock.mockReturnValue([diag('a.ts', 'boom')]);
    eslintMock.mockReturnValue([]);

    const r = await runToolLoop({
      modelId: 'test',
      messages: [{ role: 'user', content: 'do' }],
      ctx: { workspacePath: dir },
      maxIterations: 3,
      reviewPolicy: everyWritePolicy,
      // reviewExecute 不传 = 默认 false
    });

    expect(r.reviewDue).toBe(true); // 判据说该审了
    expect(r.review).toBeUndefined(); // 但没开启执行 ⇒ 没跑 ⇒ 不带 review
    expect(tscMock).not.toHaveBeenCalled(); // 诊断没起
  });

  it('触发 + 开启 + 首次无基线 ⇒ 全算存量,regressed=false,不误报', async () => {
    setStream(['```tool_call\n{"name":"edit_file","arguments":{}}\n```', '完成。']);
    tscMock.mockReturnValue([diag('a.ts', 'boom')]);
    eslintMock.mockReturnValue([]);

    const r = await runToolLoop({
      modelId: 'test',
      messages: [{ role: 'user', content: 'do' }],
      ctx: { workspacePath: dir },
      maxIterations: 3,
      reviewPolicy: everyWritePolicy,
      reviewExecute: true,
    });

    expect(r.reviewDue).toBe(true);
    expect(r.review).toBeDefined();
    expect(r.review!.hadBaseline).toBe(false); // 首次无基线
    expect(r.review!.regressed).toBe(false); // 不误报
    expect(r.review!.introducedCount).toBe(0);
    expect(r.review!.preexistingCount).toBe(1); // 那 1 条算存量
    expect(r.review!.total).toBe(1);
    // 首次跑落盘基线,供下次比对
    expect(loadBaseline(dir)).toHaveLength(1);
  });

  it('触发 + 开启 + 有基线 + 出现新错误 ⇒ 只报新增,regressed=true', async () => {
    // 先落盘一个已知基线(只含 a.ts 老错误)—— 不经 runToolLoop,避免消费掉本次诊断 mock
    const { saveBaseline, toIssues } = await import('../src/tools/auto-review-run.js');
    saveBaseline(dir, toIssues([diag('a.ts', 'old error')], dir));

    setStream(['```tool_call\n{"name":"edit_file","arguments":{}}\n```', '完成。']);
    // 本次:a.ts 老错误(存量)+ b.ts 新错误(新增)
    tscMock.mockReturnValue([diag('a.ts', 'old error'), diag('b.ts', 'brand new error', 'TS2345')]);
    eslintMock.mockReturnValue([]);

    const r = await runToolLoop({
      modelId: 'test',
      messages: [{ role: 'user', content: 'do' }],
      ctx: { workspacePath: dir },
      maxIterations: 3,
      reviewPolicy: everyWritePolicy,
      reviewExecute: true,
    });

    expect(r.review).toBeDefined();
    expect(r.review!.regressed).toBe(true); // 有新增
    expect(r.review!.introducedCount).toBe(1); // 只报那一条新错误
    expect(r.review!.preexistingCount).toBe(1); // 老错误不算
  });

  it('诊断子进程自身抛错 ⇒ 不影响回合结果(review 缺失,不伪装通过)', async () => {
    setStream(['```tool_call\n{"name":"edit_file","arguments":{}}\n```', '完成。']);
    tscMock.mockImplementation(() => {
      throw new Error('npx boom');
    });
    eslintMock.mockReturnValue([]);

    const r = await runToolLoop({
      modelId: 'test',
      messages: [{ role: 'user', content: 'do' }],
      ctx: { workspacePath: dir },
      maxIterations: 3,
      reviewPolicy: everyWritePolicy,
      reviewExecute: true,
    });

    // 复审是观测面,不是执行面 —— 诊断失败只降级 review,不炸回合
    expect(r.reviewDue).toBe(true);
    expect(r.review).toBeUndefined(); // 失败 ⇒ 没结论 ⇒ 缺失,不伪装成"通过"
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
