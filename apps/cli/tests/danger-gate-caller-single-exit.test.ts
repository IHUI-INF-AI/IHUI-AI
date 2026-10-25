// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票:「`--allow-dangerous` 确认旁路仍在调用方」的**单出口**验收。
 *
 * 判据分两面:
 *  - 行为面:flag 只由 `createDangerGate` 判一次。flag=true ⇒ 自动放行且 prompt 一次都不被
 *    调用(调用方没有第二次判定);flag=false + prompt ⇒ 询问;flag=false + 无 prompt
 *    (headless / ACP)⇒ 拒绝,并在返回体上点名 `dangerous-gate` / `no-confirmation-channel`。
 *  - 源码面:调用方文件(`commands/agent.ts`、`server/agent-core.ts`)不得再出现
 *    「自己判 allowDangerous 后直接放行」的形态 —— 与 `danger-gate-wiring.test.ts` 的棘轮
 *    互补(那边以 HEAD 为锚点防回潮,这边读工作树钉当前装车形态)。
 *
 * 三个会话档的既有语义(REPL 问人 / Agent flag 自动 / ACP 无人可问即拒)一律不变:
 * 本文件不引入新的放行路径,只钉住"策略住在唯一出口"。
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import type * as ApiClient from '@ihui/api-client';
import type * as AuditModule from '../src/audit.js';

// 审计摄入出口打桩成"未登录"(hasToken 为 null ⇒ 上报层静默跳过),不真发网络;
// 审计日志也不写用户家目录。
vi.mock('@ihui/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClient>();
  return { ...actual, getToken: () => null };
});
vi.mock('../src/audit.js', async (importOriginal) => {
  const actual = await importOriginal<typeof AuditModule>();
  return { ...actual, auditLog: vi.fn() };
});

import {
  clearTools,
  executeToolCall,
  registerTools,
  resetRateLimiter,
  type Tool,
  type ToolContext,
} from '../src/tools/index.js';
import { createDangerGate, type DangerGateDecision } from '../src/tools/danger-gate.js';
import { resetPermissionLeaseForTests } from '../src/tools/permission-lease.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '..', 'src');

const WORKSPACE = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-single-exit-'));
/** 副作用台账:handler 每真跑一次追加一行;不存在 = 一次都没跑 */
const MARKER = path.join(WORKSPACE, 'executed.log');

function sideEffects(): string[] {
  if (!fs.existsSync(MARKER)) return [];
  return fs.readFileSync(MARKER, 'utf-8').split('\n').filter((line) => line.length > 0);
}

function registerDangerousTool(name: string): Tool {
  const tool: Tool = {
    name,
    description: `dangerous fixture ${name}`,
    parameters: {},
    required: [],
    dangerLevel: 'dangerous',
    execute: vi.fn(async () => {
      fs.appendFileSync(MARKER, `${name}\n`, 'utf-8');
      return { success: true, output: 'executed' };
    }),
  };
  registerTools([tool]);
  return tool;
}

const ctxWith = (overrides: Partial<ToolContext> = {}): ToolContext => ({
  workspacePath: WORKSPACE,
  ...overrides,
});

beforeAll(() => {
  vi.stubEnv('IHUI_HOOKS_CONFIG', path.join(WORKSPACE, 'no-such-hooks.json'));
  vi.stubEnv('IHUI_AUDIT', '0');
});

afterAll(() => {
  vi.unstubAllEnvs();
  fs.rmSync(WORKSPACE, { recursive: true, force: true });
});

beforeEach(() => {
  clearTools();
  resetRateLimiter();
  resetPermissionLeaseForTests();
  fs.rmSync(MARKER, { force: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('① flag=true:唯一出口自动放行,调用方不做二次判定', () => {
  it('prompt 一次都不被调用;handler 恰好执行一次;决策路由只有 flag', async () => {
    const tool = registerDangerousTool('single_exit_flag');
    const prompt = vi.fn(async () => true);
    const decisions: DangerGateDecision[] = [];
    const result = await executeToolCall(
      { name: tool.name, arguments: { command: 'echo probe' } },
      ctxWith({
        allowDangerous: true,
        confirmDangerous: createDangerGate({
          allowDangerous: true,
          silent: true,
          prompt,
          onDecision: (d) => decisions.push(d),
        }),
      }),
    );
    expect(result.success).toBe(true);
    expect(tool.execute).toHaveBeenCalledTimes(1);
    expect(sideEffects()).toEqual(['single_exit_flag']);
    // 旁路判定只发生一次(prompt 是"若调用方也判一次"会留下的可观察痕迹)
    expect(prompt).not.toHaveBeenCalled();
    expect(decisions.map((d) => d.route)).toEqual(['flag']);
  });
});

describe('② flag=false + prompt:该问就问', () => {
  it('prompt 答 true ⇒ 询问一次、执行一次,路由 approved', async () => {
    const tool = registerDangerousTool('single_exit_prompt_yes');
    const prompt = vi.fn(async () => true);
    const decisions: DangerGateDecision[] = [];
    const result = await executeToolCall(
      { name: tool.name, arguments: {} },
      ctxWith({
        allowDangerous: false,
        confirmDangerous: createDangerGate({
          allowDangerous: false,
          silent: true,
          prompt,
          onDecision: (d) => decisions.push(d),
        }),
      }),
    );
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(tool.execute).toHaveBeenCalledTimes(1);
    expect(sideEffects()).toEqual(['single_exit_prompt_yes']);
    expect(result.success).toBe(true);
    expect(decisions.map((d) => d.route)).toEqual(['approved']);
  });

  it('prompt 答 false ⇒ 询问一次、零执行,路由 denied/prompt-declined', async () => {
    const tool = registerDangerousTool('single_exit_prompt_no');
    const prompt = vi.fn(async () => false);
    const decisions: DangerGateDecision[] = [];
    const result = await executeToolCall(
      { name: tool.name, arguments: {} },
      ctxWith({
        allowDangerous: false,
        confirmDangerous: createDangerGate({
          allowDangerous: false,
          silent: true,
          prompt,
          onDecision: (d) => decisions.push(d),
        }),
      }),
    );
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(tool.execute).not.toHaveBeenCalled();
    expect(sideEffects()).toEqual([]);
    expect(result.success).toBe(false);
    expect(decisions[0]?.route).toBe('denied');
    expect(decisions[0]?.cause).toBe('prompt-declined');
    expect(result.denial?.decider).toBe('user-declined');
  });
});

describe('③ flag=false + 无 prompt(headless / ACP):拒绝并带明确原因', () => {
  it('未开 flag 且无人可问 ⇒ 零执行,闸内归因 denied/no-prompt,拒绝头语点名 dangerous-gate', async () => {
    const tool = registerDangerousTool('single_exit_headless');
    const decisions: DangerGateDecision[] = [];
    const result = await executeToolCall(
      { name: tool.name, arguments: {} },
      ctxWith({
        allowDangerous: false,
        confirmDangerous: createDangerGate({
          allowDangerous: false,
          silent: true,
          onDecision: (d) => decisions.push(d),
        }),
      }),
    );
    expect(tool.execute).not.toHaveBeenCalled();
    expect(sideEffects()).toEqual([]);
    expect(result.success).toBe(false);
    expect(result.errorType).toBe('permission_denied');
    expect(decisions[0]?.route).toBe('denied');
    expect(decisions[0]?.cause).toBe('no-prompt');
    expect(result.denial?.gate).toBe('dangerous-gate');
    // 明确原因由唯一出口给出(no-prompt = 无人可问、flag 又没开),而不是"被某人拒了"
    expect(result.error).toContain('危险操作被拒绝');
    expect(result.error).toContain('gate=dangerous-gate');
  });
});

/**
 * 形态①:调用方 `if (…allowDangerous…) … return true` 短路放行;
 * 形态②:不带 if 的表达式直返(旧 agent-core / subagent 的写法)。
 * 两种都算"调用方自行判 flag 的旁路"。
 */
const FORM_IF = /\bif\s*\([^()]*\ballowDangerous\b[^()]*\)[\s\S]{0,200}?\breturn\s+true\b/g;
const FORM_EXPR = /(?:=>|\breturn\b(?![\w$]))[^\n;{]{0,80}?\ballowDangerous\b/g;

function countInlineFlagDecisions(text: string): number {
  let n = 0;
  for (const re of [FORM_IF, FORM_EXPR]) n += Array.from(text.matchAll(re)).length;
  return n;
}

const readSrc = (rel: string): string => fs.readFileSync(path.join(srcRoot, rel), 'utf-8');

describe('④ 反向锁:调用方不得自己判 flag 放行', () => {
  it('commands/agent.ts:就地放行分支为 0,且经 buildAgentDangerGate 装车唯一出口', () => {
    const src = readSrc('commands/agent.ts');
    expect(countInlineFlagDecisions(src)).toBe(0);
    expect(src).toMatch(/confirmDangerous:\s*buildAgentDangerGate\(\s*\{/);
    // 包装器只把 flag 作为入参交给唯一出口,自己不做判定
    expect(src).toMatch(
      /createAuditedDangerGate\(\{[\s\S]{0,120}?allowDangerous:\s*opts\.allowDangerous,/
    );
    expect(src).not.toMatch(/confirmDangerous:\s*(?:async\s*)?\([^)]*\)\s*=>\s*[^\n]*allowDangerous/);
  });

  it('server/agent-core.ts:就地放行分支为 0,且唯一出口不带 prompt(headless fail-closed)', () => {
    const src = readSrc('server/agent-core.ts');
    expect(countInlineFlagDecisions(src)).toBe(0);
    expect(src).toMatch(/confirmDangerous:\s*createAuditedDangerGate\(\s*\{/);
    expect(src).not.toMatch(/confirmDangerous:\s*(?:async\s*)?\([^)]*\)\s*=>\s*[^\n]*allowDangerous/);
    // 无 prompt 通道:flag 未开时只能 denied(与 ③ 的行为面互为印证)
    const gateBlock = src.slice(src.indexOf('confirmDangerous: createAuditedDangerGate'));
    expect(gateBlock.slice(0, 260)).not.toMatch(/\bprompt\s*:/);
  });

  it('danger-gate.ts 是唯一判 flag 的地方(两处短路都在出口内)', () => {
    const src = readSrc('tools/danger-gate.ts');
    expect(src).toMatch(/if\s*\(\s*opts\.allowDangerous\s*===\s*true\s*&&\s*!mandated\s*\)/);
    expect(src).toMatch(/if\s*\(\s*mandated\s*&&\s*opts\.allowDangerous\s*===\s*true\s*\)/);
  });

  it('阳性对照:两种旁路写法都必须被同一把尺子抓到(判据有牙)', () => {
    expect(
      countInlineFlagDecisions(
        'async (tool, args) => {\n  if (this.opts.allowDangerous) return true;\n  return false;\n}'
      )
    ).toBeGreaterThanOrEqual(1);
    expect(
      countInlineFlagDecisions("register({ confirmDangerous: async () => opts.allowDangerous })")
    ).toBeGreaterThanOrEqual(1);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
