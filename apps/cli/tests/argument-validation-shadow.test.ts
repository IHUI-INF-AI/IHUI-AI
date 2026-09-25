// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// A31 第①步「影子校验」单测:只记账、不拦截 —— 钉四件事 + 一条 enforce 现状。
//
// ① 默认 off ⇒ 校验器一次都不被调用(用计数器恒为 0 证明,而不是用"看起来没红"证明);
// ② shadow 档 ⇒ 校验器被调用,但返回值与"根本没有这段代码"时逐字相同,且 args 引用未被改写;
// ③ 校验器自身抛异常(坏描述)⇒ 绝不影响工具执行,只多一条可数的账;
// ④ 遥测里不含任何入参值(把敏感串放进 args,snapshot 序列化后必须查不到它);
// ⑤ enforce 未实现:按 shadow 记账后原样执行,既不拒绝也不改参(第②③步才谈拦截)。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_TOOL_ARG_VALIDATION_MODE,
  ENFORCE_NOT_IMPLEMENTED_NOTICE,
  TOOL_ARG_VALIDATION_ENV,
  TOOL_ARG_VALIDATION_MODES,
  resolveToolArgValidationMode,
  shadowValidateToolArguments,
  snapshotToolArgShadow,
  totalToolArgShadowRuns,
  resetToolArgShadowTelemetry,
} from '../src/tools/argument-validation-telemetry.js';
import {
  clearTools,
  executeToolCall,
  registerTools,
  resetRateLimiter,
  type Tool,
  type ToolContext,
} from '../src/tools/index.js';

const SECRET = 'sk-LIVE-DO-NOT-LEAK-9f3c2b';

let executedArgs: unknown[] = [];
let executedIdentity: unknown[] = [];

function makeTool(overrides: Partial<Tool> = {}): Tool {
  return {
    name: 'shadow_demo',
    description: 'demo tool',
    parameters: { path: { type: 'string', description: 'file path' } },
    required: ['path'],
    dangerLevel: 'read',
    async execute(args: Record<string, unknown>): Promise<{ success: boolean; output: string; error?: string }> {
      executedArgs.push({ ...args });
      executedIdentity.push(args);
      return { success: true, output: `ok:${String(args['path'] ?? '')}` };
    },
    ...overrides,
  };
}

const ctx: ToolContext = { workspacePath: process.cwd() };
const call = (args: Record<string, unknown>) => ({ name: 'shadow_demo', arguments: args });

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  executedArgs = [];
  executedIdentity = [];
  resetRateLimiter();
  clearTools();
  registerTools([makeTool()]);
  resetToolArgShadowTelemetry();
  delete process.env[TOOL_ARG_VALIDATION_ENV];
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  delete process.env[TOOL_ARG_VALIDATION_ENV];
  resetToolArgShadowTelemetry();
  warnSpy.mockRestore();
});

describe('档位解析', () => {
  it('默认档是 off,且档位清单含 off/shadow/enforce 三档', () => {
    expect(DEFAULT_TOOL_ARG_VALIDATION_MODE).toBe('off');
    expect([...TOOL_ARG_VALIDATION_MODES]).toEqual(['off', 'shadow', 'enforce']);
    expect(resolveToolArgValidationMode({})).toBe('off');
  });

  it('非法取值不静默吞:报一行后退回默认档', () => {
    expect(resolveToolArgValidationMode({ [TOOL_ARG_VALIDATION_ENV]: 'shdow' })).toBe('off');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0]?.[0])).toMatch(/shdow/);
    expect(snapshotToolArgShadow().unknownModeValues).toEqual(['shdow']);
  });
});

describe('①默认 off ⇒ 校验器一次都不被调用', () => {
  it('计数器为 0,且执行链路与从前一致', async () => {
    const r = await executeToolCall(call({ path: 'a.txt' }), ctx);
    expect(r).toEqual({ success: true, output: 'ok:a.txt' });
    expect(totalToolArgShadowRuns()).toBe(0);
    expect(snapshotToolArgShadow().totalShadowRuns).toBe(0);
    expect(snapshotToolArgShadow().tools).toEqual([]);
  });

  it('直接调影子入口同样零副作用(off 档)', () => {
    const tool = makeTool();
    shadowValidateToolArguments(tool, { nope: 1 });
    expect(totalToolArgShadowRuns()).toBe(0);
  });
});

describe('②shadow 档:被调用,但返回值与不加这段代码时逐字相同', () => {
  it('同一输入在 off 与 shadow 下结果深相等,且 args 引用一路到底未被改写', async () => {
    process.env[TOOL_ARG_VALIDATION_ENV] = 'off';
    const offResult = await executeToolCall(call({ path: 'b.txt' }), ctx);
    const offSnapshot = totalToolArgShadowRuns();

    resetRateLimiter();
    resetToolArgShadowTelemetry();
    process.env[TOOL_ARG_VALIDATION_ENV] = 'shadow';
    const args = { path: 'b.txt' };
    const shadowResult = await executeToolCall({ name: 'shadow_demo', arguments: args }, ctx);

    expect(shadowResult).toEqual(offResult);
    expect(JSON.stringify(shadowResult)).toBe(JSON.stringify(offResult));
    expect(offSnapshot).toBe(0);
    // shadow 确实跑了校验器(计数器是唯一可见证据)
    expect(totalToolArgShadowRuns()).toBe(1);
    // "批准 = 执行"的同一引用语义未动:execute 拿到的就是传进来的那个对象
    executedIdentity.length = 0;
    await executeToolCall({ name: 'shadow_demo', arguments: args }, ctx);
    expect(executedIdentity[0]).toBe(args);
    expect(args).toEqual({ path: 'b.txt' });
  });

  it('缺必填字段 → 记账但不拒绝', async () => {
    process.env[TOOL_ARG_VALIDATION_ENV] = 'shadow';
    const r = await executeToolCall(call({ notPath: 'x' }), ctx);
    expect(r.success).toBe(true);
    const snap = snapshotToolArgShadow();
    const bucket = snap.tools.find((t) => t.tool === 'shadow_demo');
    expect(bucket?.shadowRuns).toBe(1);
    expect(bucket?.invalidRuns).toBe(1);
    // 只有 missing_required 一条:校验器对"多打一个未知字段"刻意不报错(见 argument-validator.ts 第 3 步)
    expect(bucket?.errorCount).toBe(1);
    expect(bucket?.firstErrorField).toBe('path');
    expect(bucket?.byReason['missing_required']).toBe(1);
  });

  it('required 缺失的工具按"无法判定"计,不当作准确度证据', async () => {
    clearTools();
    registerTools([makeTool({ required: undefined as unknown as string[] })]);
    process.env[TOOL_ARG_VALIDATION_ENV] = 'shadow';
    await executeToolCall(call({ path: 'c.txt' }), ctx);
    const bucket = snapshotToolArgShadow().tools[0];
    expect(bucket.undeterminedRequired).toBe(1);
  });
});

describe('③校验器抛异常绝不影响工具执行', () => {
  it('parameters 取值即抛 → validatorThrew 记 1,调用照旧成功', async () => {
    const boom = {
      name: 'shadow_demo',
      description: 'x',
      get parameters(): Record<string, never> {
        throw new Error('poisoned schema');
      },
      required: [],
      async execute(args: Record<string, unknown>) {
        executedArgs.push({ ...args });
        return { success: true, output: `ok:${String(args['path'] ?? '')}` };
      },
    } as unknown as Tool;
    clearTools();
    registerTools([boom]);
    process.env[TOOL_ARG_VALIDATION_ENV] = 'shadow';
    const r = await executeToolCall(call({ path: 'd.txt' }), ctx);
    expect(r).toEqual({ success: true, output: 'ok:d.txt' });
    expect(snapshotToolArgShadow().tools[0]?.validatorThrew).toBe(1);
  });
});

describe('④遥测不含任何入参值', () => {
  it('敏感串进了 args,但 snapshot 序列化后查不到它', async () => {
    clearTools();
    registerTools([makeTool({ parameters: { path: { type: 'string', description: 'p', enum: ['a', 'b'] } } })]);
    process.env[TOOL_ARG_VALIDATION_ENV] = 'shadow';
    await executeToolCall(call({ path: SECRET }), ctx);
    const dumped = JSON.stringify(snapshotToolArgShadow());
    expect(dumped).not.toContain(SECRET);
    // 但账确实记下来了(否则"没泄露"只是因为"什么都没记")
    expect(dumped).toContain('shadow_demo');
    expect(dumped).toContain('enum_mismatch');
    const bucket = snapshotToolArgShadow().tools[0];
    expect(bucket.firstErrorField).toBe('path');
  });
});

describe('⑤enforce:未实现,只报一行,不拒绝不改参', () => {
  it('enforce 档下执行结果与 off 完全一致', async () => {
    process.env[TOOL_ARG_VALIDATION_ENV] = 'off';
    const baseline = await executeToolCall(call({ path: 'e.txt' }), ctx);

    resetRateLimiter();
    resetToolArgShadowTelemetry();
    process.env[TOOL_ARG_VALIDATION_ENV] = 'enforce';
    const args = { path: 'e.txt' };
    const enforceResult = await executeToolCall({ name: 'shadow_demo', arguments: args }, ctx);

    expect(enforceResult).toEqual(baseline);
    expect(totalToolArgShadowRuns()).toBe(0); // 影子计数器也不动:enforce 的账要单独立
    expect(snapshotToolArgShadow().enforceRequested).toBe(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0]?.[0])).toContain(ENFORCE_NOT_IMPLEMENTED_NOTICE.slice(0, 24));
    expect(args).toEqual({ path: 'e.txt' });
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
