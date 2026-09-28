// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

// A36 第③步「enforce」单测:schema-aware 容错解析 + 有界 repair 回喂 + 单行违规清单。
//
// 钉的事(与 argument-validation-shadow.test.ts 互补,那边管"合法路径不被波及",这边管"违规路径必须被拦"):
// ① normalizeToolArguments 的三条判序:
//    a. 原值先过校验 ⇒ 绝不 re-parse(引用不变;`string|null` 位的 "42" 不得被 parse 成数字);
//    b. 只有 object/array 位实得 string 才做一次 JSON.parse,形状不符视同 parse 失败;
//    c. parse 后再校验一次,不过即维持原判(报原树错误、交回原参数)。
// ② executor 边界 enforce 档:违规 ⇒ 拒绝且 error 里带**单行**违规清单;
//    连续违规封顶 TOOL_ARG_REPAIR_MAX_ATTEMPTS 次回喂,超限硬失败并保留最后一次清单;
//    判定通过即清零连续窗(换写法/中途修好都不背旧账)。
// ③ 默认 off 与 shadow 档的行为与改前逐字一致(shadow 只记账:参数不改、不拒、enforce 账为 0)。
// ④ 校验器抛异常 ⇒ enforce fail-open 放行并计数(坏描述不得砖化执行)。
// ⑤ 遥测快照不落任何入参值(enforce 的账同样只记计数;拒绝文案里回灌模型的 actual 属对话面,
//    由测试**分别**断言两件事:文案里有、快照里没有)。
//
// 变异对照(判序①a/②的"有牙"证明,不靠改源码):
//   - 同一输入先喂 `validateToolArguments` 必须判不过、再喂 `normalizeToolArguments` 必须判过
//     —— 若容错层退化成直通(或被删掉),`pass-normalized` 那组断言必红;
//   - string 位的 "42" 若被误 parse,`normalizedFields` 与引用恒等断言必红。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  TOOL_ARG_REPAIR_MAX_ATTEMPTS,
  TOOL_ARG_VALIDATION_ENV,
  enforceRepairStreak,
  enforceValidateToolArguments,
  noteEnforceRepairRejection,
  resetToolArgShadowTelemetry,
  snapshotToolArgShadow,
  totalToolArgShadowRuns,
} from '../src/tools/argument-validation-telemetry.js';
import {
  formatValidationErrorsLine,
  normalizeToolArguments,
  validateToolArguments,
  type ValidationError,
} from '../src/tools/argument-validator.js';
import {
  clearTools,
  executeToolCall,
  registerTools,
  resetRateLimiter,
  type Tool,
  type ToolContext,
  type ToolSchema,
} from '../src/tools/index.js';

const SECRET = 'sk-LIVE-DO-NOT-LEAK-9f3c2b';

// ==================== 夹具 ====================

/**
 * 一个"模型常犯"的形状:
 *   - payload: object(必填,properties.a: number,required ['a'])
 *   - tags:    array(items string)
 *   - note:    string(union 里 string 分支的代表:`string|null` 传 "42" 不许被动)
 *   - mode:    string enum(fast/slow,enum_mismatch 的 actual 是用户原值 ⇒ 隐私对照用)
 */
function demoSchema(): ToolSchema {
  return {
    name: 'enforce_demo',
    description: 'demo',
    parameters: {
      type: 'object',
      properties: {
        payload: {
          type: 'object',
          description: 'payload',
          properties: { a: { type: 'number', description: 'a' } },
          required: ['a'],
        },
        tags: { type: 'array', description: 'tags', items: { type: 'string' } },
        note: { type: 'string', description: 'string | null 语义位的可选字符串' },
        mode: { type: 'string', description: 'mode', enum: ['fast', 'slow'] },
      },
      required: ['payload'],
    },
  };
}

function makeTool(overrides: Partial<Tool> = {}): Tool {
  return {
    name: 'enforce_demo',
    description: 'demo',
    parameters: demoSchema().parameters.properties,
    required: ['payload'],
    dangerLevel: 'read',
    async execute(args: Record<string, unknown>) {
      executedIdentity.push(args);
      executedCopies.push({ ...args });
      return { success: true, output: 'ran' };
    },
    ...overrides,
  };
}

let executedIdentity: Record<string, unknown>[] = [];
let executedCopies: Record<string, unknown>[] = [];

const ctx: ToolContext = { workspacePath: process.cwd() };
const call = (args: Record<string, unknown>) => ({ name: 'enforce_demo', arguments: args });

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  executedIdentity = [];
  executedCopies = [];
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

// ==================== ① normalizeToolArguments 判序 ====================

describe('① normalizeToolArguments(容错解析的三条判序)', () => {
  it('①a 原值即过 ⇒ 不 re-parse、引用不变、normalizedFields 为空', () => {
    const args = { payload: { a: 1 }, note: '42' };
    const out = normalizeToolArguments(args, demoSchema());
    expect(out.result.valid).toBe(true);
    expect(out.normalizedFields).toEqual([]);
    // 引用恒等:合法参数在 enforce 的通过路径上**逐字不动**(string 位的 "42" 也没被碰)
    expect(out.args).toBe(args);
  });

  it('①a 变异对照:string 位的 "42" 即使"可 parse"也不得被 parse(只在 fail 路径上验证)', () => {
    // 故意让另一处违规(payload 是 stringify 的对象),使容错解析整趟被触发;
    // note 位的 '"42"'(JSON.parse 会给出数字 42)必须原样保持字符串。
    const args = { payload: '{"a":1}', note: '"42"' };
    const out = normalizeToolArguments(args, demoSchema());
    expect(out.result.valid).toBe(true);
    expect(out.normalizedFields).toEqual(['payload']);
    const repaired = out.args as Record<string, unknown>;
    expect(repaired.note).toBe('"42"'); // 不是 42、不是 '42' —— 原字符串逐字保留
    expect(repaired.payload).toEqual({ a: 1 });
  });

  it('①b object 位收到 stringify JSON ⇒ 一次 parse 复验通过,路径点名 payload', () => {
    const raw = validateToolArguments({ payload: '{"a":1}' }, demoSchema());
    // 阳性对照:没有容错层时这一发**必被拒**(证明后面的 pass 断言不是恒真)
    expect(raw.valid).toBe(false);
    expect(raw.errors[0]).toMatchObject({ field: 'payload', reason: 'type_mismatch' });

    const out = normalizeToolArguments({ payload: '{"a":1}' }, demoSchema());
    expect(out.result.valid).toBe(true);
    expect(out.normalizedFields).toEqual(['payload']);
    expect((out.args as { payload: unknown }).payload).toEqual({ a: 1 });
  });

  it('①b 嵌套:外层与内层各解一次,路径带完整点号/下标', () => {
    const schema: ToolSchema = {
      name: 'nested',
      description: 'x',
      parameters: {
        type: 'object',
        properties: {
          config: {
            type: 'object',
            description: 'c',
            properties: {
              filters: { type: 'array', description: 'f', items: { type: 'string' } },
            },
            required: [],
          },
        },
        required: ['config'],
      },
    };
    const out = normalizeToolArguments({ config: '{"filters":"[\\"x\\"]"}' }, schema);
    expect(out.result.valid).toBe(true);
    expect(out.normalizedFields).toEqual(['config', 'config.filters']);
    expect((out.args as { config: { filters: unknown } }).config.filters).toEqual(['x']);
  });

  it('①b 形状不符视同 parse 失败:array 位 parse 出数字 ⇒ 维持原判、参数原样', () => {
    const args = { payload: { a: 1 }, tags: '"42"' };
    const out = normalizeToolArguments(args, demoSchema());
    expect(out.result.valid).toBe(false);
    expect(out.normalizedFields).toEqual([]);
    expect(out.args).toBe(args);
    expect(out.result.errors.some((e) => e.field === 'tags' && e.reason === 'type_mismatch')).toBe(true);
  });

  it('①b parse 抛异常视同失败:坏 JSON ⇒ 维持原判', () => {
    const args = { payload: '{"a":' };
    const out = normalizeToolArguments(args, demoSchema());
    expect(out.result.valid).toBe(false);
    expect(out.args).toBe(args);
    expect(out.normalizedFields).toEqual([]);
  });

  it('①c parse 成功但复验不过 ⇒ 维持原判(报原树错误,不交回归一树)', () => {
    // payload 能解开,但解开后缺 required 'a' ⇒ 第二趟仍不过 ⇒ 整个容错作废
    const args = { payload: '{"b":2}' };
    const first = validateToolArguments(args, demoSchema());
    const out = normalizeToolArguments(args, demoSchema());
    expect(out.result.valid).toBe(false);
    expect(out.result.errors).toEqual(first.errors); // 原判逐字
    expect(out.args).toBe(args); // 交回的是原参数,不是 parse 树
    expect(out.normalizedFields).toEqual([]); // 复验不过的 parse 不点名
  });

  it('根参数整体 stringify ⇒ 同样只解一次,路径点名 (root)', () => {
    const out = normalizeToolArguments('{"payload":{"a":1}}', demoSchema());
    expect(out.result.valid).toBe(true);
    expect(out.normalizedFields).toEqual(['(root)']);
    expect(out.args).toEqual({ payload: { a: 1 } });
  });
});

// ==================== 单行违规清单 ====================

describe('formatValidationErrorsLine', () => {
  it('多条违规压成一行,不含换行', () => {
    const errors: ValidationError[] = [
      { field: 'payload', reason: 'missing_required', expected: 'object', actual: 'undefined' },
      { field: 'todos[0].summary', reason: 'type_mismatch', expected: 'string', actual: 'number' },
    ];
    const line = formatValidationErrorsLine(errors);
    expect(line).not.toMatch(/[\r\n]/);
    expect(line).toContain('payload=missing_required(expected=object; got=undefined)');
    expect(line).toContain('todos[0].summary=type_mismatch(expected=string; got=number)');
  });

  it('actual 里的换行/制表被折平,超长段被截断', () => {
    const line = formatValidationErrorsLine([
      {
        field: 'note',
        reason: 'enum_mismatch',
        expected: 'enum(a|b)',
        actual: `x\ty\n${'z'.repeat(200)}`,
      },
    ]);
    expect(line).not.toMatch(/[\r\n\t]/);
    expect(line.length).toBeLessThan(400);
  });

  it('超过 12 条折叠为 (+N more)', () => {
    const errors: ValidationError[] = Array.from({ length: 15 }, (_, i) => ({
      field: `f${i}`,
      reason: 'type_mismatch' as const,
      expected: 'string',
      actual: 'object',
    }));
    const line = formatValidationErrorsLine(errors);
    expect(line).toContain('(+3 more)');
    expect(line).not.toContain('f14=');
  });
});

// ==================== ② executor 边界:拒绝 + 有界 repair ====================

describe('② enforce 档 executor 边界', () => {
  beforeEach(() => {
    process.env[TOOL_ARG_VALIDATION_ENV] = 'enforce';
  });

  it('stringify 的 object 参数 ⇒ 归一后放行,handler 收到解析好的对象', async () => {
    const c = call({ payload: '{"a":1}' });
    const r = await executeToolCall(c, ctx);
    expect(r).toEqual({ success: true, output: 'ran' });
    // 变异对照:没有容错那一半时这一发必被拒(判序①b 的阳性对照在执行链上重跑一遍)
    expect(validateToolArguments({ payload: '{"a":1}' }, demoSchema()).valid).toBe(false);
    // 归一树替换只发生在 enforce+pass-normalized:call.arguments 被换成解析后的树
    expect(c.arguments.payload).toEqual({ a: 1 });
    expect(executedIdentity[0]).toBe(c.arguments);
    expect(executedIdentity[0]?.payload).toEqual({ a: 1 });
    const snap = snapshotToolArgShadow().enforce;
    expect(snap.passedNormalized).toBe(1);
    expect(snap.runs).toBe(1);
  });

  it('合法参数 ⇒ 引用与返回值逐字不动(pass 支不替换 arguments)', async () => {
    const args = { payload: { a: 1 }, note: '42' };
    const r = await executeToolCall({ name: 'enforce_demo', arguments: args }, ctx);
    expect(r).toEqual({ success: true, output: 'ran' });
    expect(executedIdentity[0]).toBe(args);
    expect(args).toEqual({ payload: { a: 1 }, note: '42' }); // "42" 仍是字符串
    expect(snapshotToolArgShadow().enforce.passedPlain).toBe(1);
  });

  it('违规 ⇒ 拒绝在执行/批准之前,错误是单行且带违规清单', async () => {
    const r = await executeToolCall(call({ notPayload: 1 }), ctx);
    expect(r.success).toBe(false);
    expect(r.errorType).toBe('invalid_arguments');
    expect(r.error).toMatch(/^arg_validation_failed \(1\/3\):/);
    expect(r.error).toContain('payload=missing_required(expected=object; got=undefined)');
    expect(r.error).not.toMatch(/[\r\n]/); // 单行:能安全进 tool_result 的 error 字段
    expect(executedIdentity).toHaveLength(0); // handler 一次都没被调
  });

  it('连续违规封顶:第 4 次起硬失败,清单仍在;中途通过即清零连续窗', async () => {
    const bad = () => call({ notPayload: 1 });
    for (let i = 1; i <= TOOL_ARG_REPAIR_MAX_ATTEMPTS; i++) {
      const r = await executeToolCall(bad(), ctx);
      expect(r.errorType).toBe('invalid_arguments');
      expect(r.error).toContain(`(${i}/${TOOL_ARG_REPAIR_MAX_ATTEMPTS})`);
    }
    // 第 4 次:预算耗尽 ⇒ 硬失败档,仍保留最后一次违规清单
    const exhausted = await executeToolCall(bad(), ctx);
    expect(exhausted.success).toBe(false);
    expect(exhausted.errorType).toBe('invalid_arguments_exhausted');
    expect(exhausted.error).toContain('arg_validation_exhausted: rejection #4');
    expect(exhausted.error).toContain('violations -> arg_validation_failed:');
    // 第 5 次仍是硬失败(不会因新一轮回到回喂档)
    const fifth = await executeToolCall(bad(), ctx);
    expect(fifth.errorType).toBe('invalid_arguments_exhausted');
    expect(snapshotToolArgShadow().enforce.repairExhausted).toBe(2);
    expect(enforceRepairStreak('enforce_demo')).toBe(5);

    // 一次通过判定清零连续窗:下一次违规回到 attempt 1
    const ok = await executeToolCall(call({ payload: { a: 2 } }), ctx);
    expect(ok.success).toBe(true);
    expect(enforceRepairStreak('enforce_demo')).toBe(0);
    const again = await executeToolCall(bad(), ctx);
    expect(again.errorType).toBe('invalid_arguments');
    expect(again.error).toContain('(1/3)');
  });

  it('repair 窗按工具名计:A 工具的账不会把 B 工具钉硬', async () => {
    registerTools([
      makeTool({
        name: 'other_tool',
        required: ['missing'],
        parameters: { missing: { type: 'string', description: 'm' } },
      }),
    ]);
    for (let i = 0; i < TOOL_ARG_REPAIR_MAX_ATTEMPTS + 1; i++) {
      const r = await executeToolCall({ name: 'other_tool', arguments: {} }, ctx);
      if (i < TOOL_ARG_REPAIR_MAX_ATTEMPTS) expect(r.errorType).toBe('invalid_arguments');
      else expect(r.errorType).toBe('invalid_arguments_exhausted');
    }
    // enforce_demo 自己的窗没被连带撑爆:仍然在回喂档
    const r = await executeToolCall({ name: 'enforce_demo', arguments: { nope: 1 } }, ctx);
    expect(r.errorType).toBe('invalid_arguments');
    expect(r.error).toContain('(1/3)');
  });

  it('④ 校验器抛异常(坏描述)⇒ fail-open 放行并计 validatorThrew', async () => {
    clearTools();
    const boom = {
      name: 'enforce_demo',
      description: 'x',
      get parameters(): never {
        throw new Error('poisoned schema');
      },
      required: ['payload'],
      async execute() {
        return { success: true, output: 'ran' };
      },
    } as unknown as Tool;
    registerTools([boom]);
    const r = await executeToolCall(call({ payload: 'not-json' }), ctx);
    expect(r).toEqual({ success: true, output: 'ran' });
    expect(snapshotToolArgShadow().enforce.validatorThrew).toBe(1);
  });

  it('⑤ enforce 的遥测快照不落任何入参值;拒绝文案(对话面)则可含原值', async () => {
    const r = await executeToolCall(call({ payload: { a: 1 }, mode: SECRET }), ctx);
    expect(r.success).toBe(false); // enum_mismatch 被拒
    expect(r.error).toContain(SECRET); // 回灌模型的是模型自报值,修复要靠它
    const dumped = JSON.stringify(snapshotToolArgShadow());
    expect(dumped).not.toContain(SECRET); // 计数器/快照面逐字节不含
    // 但账确实记下来了(否则"没泄露"只是因为"什么都没记"):enforce 计数器按名聚合,
    // 描述面只有拒绝计数与 attempt,没有字段值。
    expect(dumped).toContain('"rejected":1');
    expect(dumped).toContain('"repairRejections":1');
    expect(snapshotToolArgShadow().enforce.rejected).toBe(1);
  });

  it('noteEnforceRepairRejection 的 attempt/exhausted 边界(单元)', () => {
    const a = noteEnforceRepairRejection('unit_tool');
    expect(a).toEqual({ attempt: 1, max: TOOL_ARG_REPAIR_MAX_ATTEMPTS, exhausted: false });
    noteEnforceRepairRejection('unit_tool');
    noteEnforceRepairRejection('unit_tool');
    const d = noteEnforceRepairRejection('unit_tool');
    expect(d).toEqual({ attempt: 4, max: 3, exhausted: true });
  });

  it('enforceValidateToolArguments:undetermined 时 errors 为空且 args 原样(单元)', () => {
    // 直接写对象字面量:makeTool 的 `{...overrides}` 展开会**当场调用** getter,
    // getter 里的异常会在夹具构造点炸出而不是走 undetermined 分支 —— 那是测别的层。
    const poison: Tool = {
      name: 'poison_tool',
      description: 'x',
      get parameters(): never {
        throw new Error('poison');
      },
      required: ['payload'],
      async execute() {
        return { success: true, output: 'ran' };
      },
    };
    const args = { payload: 1 };
    const d = enforceValidateToolArguments(poison, args);
    expect(d.status).toBe('undetermined');
    expect(d.errors).toEqual([]);
    expect(d.args).toBe(args);
  });
});

// ==================== ③ 默认档与 shadow 档不被波及 ====================

describe('③ 默认档/shadow 档行为与改前逐字一致', () => {
  it('默认(未设 env)⇒ 违规参数照旧执行,enforce 与 shadow 两条账都是 0', async () => {
    const r = await executeToolCall(call({ notPayload: 1 }), ctx);
    expect(r).toEqual({ success: true, output: 'ran' });
    expect(totalToolArgShadowRuns()).toBe(0);
    const snap = snapshotToolArgShadow();
    expect(snap.enforce.runs).toBe(0);
    expect(snap.enforceRequested).toBe(0);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('shadow 档只记账:stringify 的 object 参数**不被归一**,handler 收到原字符串', async () => {
    process.env[TOOL_ARG_VALIDATION_ENV] = 'shadow';
    const args = { payload: '{"a":1}' };
    const r = await executeToolCall({ name: 'enforce_demo', arguments: args }, ctx);
    expect(r).toEqual({ success: true, output: 'ran' });
    expect(executedIdentity[0]).toBe(args);
    expect(executedCopies[0]).toEqual({ payload: '{"a":1}' }); // 原样字符串:shadow 不归一
    expect(snapshotToolArgShadow().enforce.runs).toBe(0);
    expect(totalToolArgShadowRuns()).toBe(1);
  });

  it('off 档 ⇒ enforce 判定一次都不跑(env 显式 off)', async () => {
    process.env[TOOL_ARG_VALIDATION_ENV] = 'off';
    const r = await executeToolCall(call({ notPayload: 1 }), ctx);
    expect(r.success).toBe(true);
    expect(snapshotToolArgShadow().enforce.runs).toBe(0);
  });
});
