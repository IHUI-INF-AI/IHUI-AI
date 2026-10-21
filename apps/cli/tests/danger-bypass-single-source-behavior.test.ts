// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票:「`--allow-dangerous` 确认旁路仍在调用方」的**行为面**验收(单一真相源)。
 *
 * 文本面棘轮(`danger-gate-wiring.test.ts`)判的是"源码里不再有就地旁路";本文件判的是
 * **跑起来之后放行发生在哪一层**。判据一律是副作用 —— tool handler 真跑没跑、跑了几次、
 * 副作用文件落没落地,返回值只作辅助:只断言 `success === false` 会放过"先执行再回拒绝"
 * 这一型(与 `tool-permission-contract-consumed.test.ts` 同一条纪律)。
 *
 * 三条会话级语义各占一格,但都只能经唯一策略出口(`createDangerGate` /
 * `createAuditedDangerGate`)表达,调用方不得自己判断:
 *  - REPL : 无 flag + prompt(生产上由 inquirer 提供)⇒ 答 true 执行一次,答 false 零次;
 *  - Agent: `--allow-dangerous` ⇒ 执行一次,且 prompt 一次都不被调用(flag 由闸门判);
 *  - ACP  : 无 flag + 无 prompt(无人可问)⇒ 零执行,拒绝归因 `no-prompt`。
 * 另加一格:披露字段 `ctx.allowDangerous = true` 而没有回调 ⇒ **仍然零执行** ——
 * 影子字段不参与判定,这是"旁路判定只有一个点"的行为面证据。
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import type * as ApiClient from '@ihui/api-client';
import type * as AuditModule from '../src/audit.js';

// 审计摄入出口打桩成"未登录"(hasToken 为 null ⇒ 上报层静默跳过):
// 否则开发机上一份已登录的 ~/.ihui/settings.json 会让单测真发一次网络请求。
vi.mock('@ihui/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClient>();
  return { ...actual, getToken: () => null };
});
// 审计日志落 ~/.ihui/audit.jsonl:单测不写用户家目录。
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
import { createAuditedDangerGate } from '../src/tools/danger-gate-audit.js';
import { resetPermissionLeaseForTests } from '../src/tools/permission-lease.js';

const WORKSPACE = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-danger-bypass-'));
/** 副作用台账:handler 每真跑一次追加一行;文件不存在 = 一次都没跑 */
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

const ctxWithout = (overrides: Partial<ToolContext> = {}): ToolContext => ({
  workspacePath: WORKSPACE,
  ...overrides,
});

beforeAll(() => {
  // 零 hook 前提显式钉住:命中开发机上真实 hooks 配置会让"无 flag 即拒"这一格依赖环境。
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

describe('未给旁路 ⇒ 不执行且返回拒绝(副作用零发生)', () => {
  it('无 flag、无确认回调:handler 一次都不跑,拒绝归因 dangerous-gate/no-confirmation-channel', async () => {
    const tool = registerDangerousTool('bypass_probe_none');
    const r = await executeToolCall(
      { name: tool.name, arguments: { command: 'rm -rf probe-never-run' } },
      ctxWithout(),
    );
    // 副作用没发生才是判据;拒绝结果只证明"有人拦",不证明"没做"。
    expect(tool.execute).not.toHaveBeenCalled();
    expect(sideEffects()).toEqual([]);
    expect(r.success).toBe(false);
    expect(r.errorType).toBe('permission_denied');
    expect(r.denial?.gate).toBe('dangerous-gate');
    expect(r.denial?.decider).toBe('no-confirmation-channel');
  });

  it('只有披露字段 ctx.allowDangerous=true(无回调)⇒ 仍零执行:旁路不从 ctx 读', async () => {
    const tool = registerDangerousTool('bypass_probe_shadow_field');
    const r = await executeToolCall(
      { name: tool.name, arguments: {} },
      ctxWithout({ allowDangerous: true }),
    );
    expect(tool.execute).not.toHaveBeenCalled();
    expect(sideEffects()).toEqual([]);
    expect(r.success).toBe(false);
  });

  it('ACP 语义:无 flag + 无 prompt(经带审计包装器构造)⇒ 零执行,决策落 denied/no-prompt', async () => {
    const tool = registerDangerousTool('bypass_probe_acp');
    const decisions: DangerGateDecision[] = [];
    const gate = createAuditedDangerGate({
      allowDangerous: false,
      silent: true,
      onDecision: (d) => decisions.push(d),
    });
    const r = await executeToolCall(
      { name: tool.name, arguments: {} },
      ctxWithout({ confirmDangerous: gate }),
    );
    expect(tool.execute).not.toHaveBeenCalled();
    expect(sideEffects()).toEqual([]);
    expect(r.success).toBe(false);
    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.route).toBe('denied');
    expect(decisions[0]?.cause).toBe('no-prompt');
  });
});

describe('给了旁路 ⇒ 执行且只执行一次(副作用恰好一次)', () => {
  it('Agent 语义:--allow-dangerous 经唯一出口 ⇒ handler 恰好一次,副作用落地一行', async () => {
    const tool = registerDangerousTool('bypass_probe_flag');
    const r = await executeToolCall(
      { name: tool.name, arguments: {} },
      ctxWithout({
        allowDangerous: true,
        confirmDangerous: createDangerGate({ allowDangerous: true, silent: true }),
      }),
    );
    expect(tool.execute).toHaveBeenCalledTimes(1);
    expect(sideEffects()).toEqual(['bypass_probe_flag']);
    expect(r.success).toBe(true);
  });

  it('flag 与 prompt 并存时由闸门定档:prompt 一次都不被调用,handler 仍只跑一次', async () => {
    const tool = registerDangerousTool('bypass_probe_flag_wins');
    const prompt = vi.fn(async () => true);
    const r = await executeToolCall(
      { name: tool.name, arguments: {} },
      ctxWithout({
        allowDangerous: true,
        confirmDangerous: createDangerGate({ allowDangerous: true, silent: true, prompt }),
      }),
    );
    expect(prompt).not.toHaveBeenCalled();
    expect(tool.execute).toHaveBeenCalledTimes(1);
    expect(sideEffects()).toEqual(['bypass_probe_flag_wins']);
    expect(r.success).toBe(true);
  });

  it('REPL 语义:无 flag + prompt 答 true ⇒ 执行一次(真人批准路不被旁路收口破坏)', async () => {
    const tool = registerDangerousTool('bypass_probe_prompt_yes');
    const decisions: DangerGateDecision[] = [];
    const r = await executeToolCall(
      { name: tool.name, arguments: {} },
      ctxWithout({
        confirmDangerous: createDangerGate({
          allowDangerous: false,
          silent: true,
          prompt: async () => true,
          onDecision: (d) => decisions.push(d),
        }),
      }),
    );
    expect(tool.execute).toHaveBeenCalledTimes(1);
    expect(sideEffects()).toEqual(['bypass_probe_prompt_yes']);
    expect(r.success).toBe(true);
    expect(decisions[0]?.route).toBe('approved');
  });

  it('REPL 语义:无 flag + prompt 答 false ⇒ 零执行(否决不等于静默放行)', async () => {
    const tool = registerDangerousTool('bypass_probe_prompt_no');
    const r = await executeToolCall(
      { name: tool.name, arguments: {} },
      ctxWithout({
        confirmDangerous: createDangerGate({ allowDangerous: false, silent: true, prompt: async () => false }),
      }),
    );
    expect(tool.execute).not.toHaveBeenCalled();
    expect(sideEffects()).toEqual([]);
    expect(r.success).toBe(false);
    expect(r.denial?.decider).toBe('user-declined');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
