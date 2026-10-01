// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-712「schema 缺席 ⇒ 硬失败,绝不静默降级为无校验」的判据测试。
//
// 本票的全部价值只有一句话:**参数面解析不到时,结论必须是 SchemaMissing,而不是"通过"**。
// 所以每条正向用例都配一条反向对照(正常工具照旧被验、有毒描述照旧归 validatorThrew),
// 证明我把"没判"和"判过"分开了,而不是把功能改坏了。
//
// 全部用**构造夹具**,不读真实注册表与审计日志 —— 那是机器状态,拿它当断言输入会得到
// 一台"在别人机器上红、在我机器上绿"的尺子(与 argument-validation-replay 单测同一条理由)。
//
// 用例名一律含 `SchemaMissing`,票面验收命令是 `vitest run -t "SchemaMissing"`。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SCHEMA_MISSING_CODE,
  SchemaResolutionError,
  isSchemaMissingError,
  resolveSchemaOrThrow,
} from '../src/tools/argument-validator.js';
import {
  TOOL_ARG_VALIDATION_ENV,
  enforceValidateToolArguments,
  resetToolArgShadowTelemetry,
  shadowValidateToolArguments,
  snapshotToolArgShadow,
  totalToolArgShadowRuns,
} from '../src/tools/argument-validation-telemetry.js';
import { replayArgumentDeviations, type ReplayRecord } from '../src/tools/argument-validation-replay.js';
import {
  clearTools,
  executeToolCall,
  registerTools,
  resetRateLimiter,
  type Tool,
  type ToolContext,
} from '../src/tools/index.js';

const executedArgs: unknown[] = [];
const executedIdentity: unknown[] = [];

/** 描述面**完好**的工具:所有对照用例都从它出发,证明"缺席"这一档没有波及正常路径。 */
function okTool(over: Partial<Tool> = {}): Tool {
  return {
    name: 'g712_demo',
    description: 'demo tool',
    parameters: { path: { type: 'string', description: 'file path' } },
    required: ['path'],
    dangerLevel: 'read',
    async execute(args: Record<string, unknown>) {
      executedArgs.push({ ...args });
      executedIdentity.push(args);
      return { success: true, output: `ok:${String(args['path'] ?? '')}` };
    },
    ...over,
  };
}

/**
 * 参数面缺席的夹具。**必须写成对象字面量而不是 `{...okTool(), parameters: undefined}`** ——
 * 展开会保留 key 值为 undefined,而"key 在、值是 undefined"与"根本没写这一族"在
 * `resolveSchemaOrThrow` 里是同一判据(undefined ⇒ parameters-not-declared),
 * 但为了不把"展开语义"混进被测语义,这里显式造一份没写 parameters 的工具。
 */
function toolWithoutParameters(): Tool {
  return {
    name: 'g712_no_params',
    description: 'x',
    required: ['path'],
    dangerLevel: 'read',
    async execute(args: Record<string, unknown>) {
      executedArgs.push({ ...args });
      executedIdentity.push(args);
      return { success: true, output: 'ran' };
    },
  } as unknown as Tool;
}

/** 描述有毒:取 `parameters` 即抛。它与"缺席"是两档,由 validatorThrew 兜着。 */
function poisonedTool(name = 'g712_poison'): Tool {
  return {
    name,
    description: 'x',
    get parameters(): never {
      throw new Error('poisoned schema');
    },
    required: ['path'],
    async execute() {
      return { success: true, output: 'ran' };
    },
  } as unknown as Tool;
}

const ctx: ToolContext = { workspacePath: process.cwd() };
const call = (name: string, args: Record<string, unknown>) => ({ name, arguments: args });
const registryOf = (t: Tool) => (name: string) => (name === t.name ? t : undefined);

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  executedArgs.length = 0;
  executedIdentity.length = 0;
  resetRateLimiter();
  clearTools();
  resetToolArgShadowTelemetry();
  delete process.env[TOOL_ARG_VALIDATION_ENV];
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  delete process.env[TOOL_ARG_VALIDATION_ENV];
  resetToolArgShadowTelemetry();
  warnSpy.mockRestore();
});

// ==================== ① 解析出口本身 ====================

describe('① SchemaMissing 解析出口:推不出必须抛,不得兜空表', () => {
  it('SchemaMissing: parameters 整块没写 ⇒ 抛 code=SchemaMissing(reason=parameters-not-declared)', () => {
    const tool = toolWithoutParameters();
    let caught: unknown;
    try {
      resolveSchemaOrThrow(tool);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(SchemaResolutionError);
    expect((caught as SchemaResolutionError).code).toBe(SCHEMA_MISSING_CODE);
    expect((caught as SchemaResolutionError).code).toBe('SchemaMissing');
    expect((caught as SchemaResolutionError).reason).toBe('parameters-not-declared');
    // 缺席发生在哪个工具身上必须能报出来(只带名字,不带任何入参值)
    expect((caught as SchemaResolutionError).tool).toBe('g712_no_params');
  });

  it('SchemaMissing: parameters 是 null / 数组 / 字符串 ⇒ parameters-not-a-property-table', () => {
    for (const bad of [null, [], 'nope', 42]) {
      const t = okTool({ name: `g712_bad_${typeof bad}` });
      (t as unknown as { parameters: unknown }).parameters = bad;
      let code = 'resolved';
      let reason = '';
      try {
        resolveSchemaOrThrow(t);
      } catch (e) {
        code = isSchemaMissingError(e) ? e.code : 'other';
        reason = isSchemaMissingError(e) ? e.reason : '';
      }
      expect(code).toBe('SchemaMissing');
      expect(reason).toBe('parameters-not-a-property-table');
    }
  });

  it('SchemaMissing 反向对照:描述完好的工具照旧解析成功且属性表逐字带出(证明没把功能改坏)', () => {
    const schema = resolveSchemaOrThrow(okTool());
    expect(schema.name).toBe('g712_demo');
    expect(Object.keys(schema.parameters.properties)).toEqual(['path']);
    expect(schema.parameters.required).toEqual(['path']);
  });

  it('SchemaMissing 反向对照:如实声明零参数(parameters:{})的工具**不**被判缺席', () => {
    // 这一条是尺子不喊错的边界:HEAD 现读有 8 个内建工具如实写着 parameters: {}
    // (browser_close / list_background_tasks / memory_dream / git_stash_list 等)。
    // 静态上分不出"这工具确实不收参数"与"参数面丢了",把它判成缺席就是一台会喊错的门 ——
    // 代价不是账面数字,是下一个人去给没坏的描述"补参数"。
    expect(() => resolveSchemaOrThrow(okTool({ parameters: {}, required: [] }))).not.toThrow();
  });

  it('SchemaMissing 分档:描述有毒(取值即抛)抛的是原异常,不冒充缺席', () => {
    let caught: unknown;
    try {
      resolveSchemaOrThrow(poisonedTool());
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain('poisoned schema');
    expect(isSchemaMissingError(caught)).toBe(false);
  });

  it('SchemaMissing 按码认账:instanceof 失效时(structured/code)仍然算同一档', () => {
    // 跨模块热重载或台账 JSON 回读会让 instanceof 假负;只靠它就是"认不出 ⇒ 当别的异常"
    // ⇒ 未判定档静默归零(正是本票要消灭的形态)。
    expect(isSchemaMissingError({ code: SCHEMA_MISSING_CODE, tool: 'x', reason: 'parameters-not-declared' })).toBe(true);
    expect(isSchemaMissingError({ code: 'SomethingElse' })).toBe(false);
    expect(isSchemaMissingError(new Error('plain'))).toBe(false);
    expect(isSchemaMissingError(null)).toBe(false);
  });
});

// ==================== ② 影子台账:未判定档而不是通过 ====================

describe('② 影子台账 SchemaMissing 计一档,绝不计进通过', () => {
  it('SchemaMissing(shadow): parameters 缺席 ⇒ schemaMissing=1 且 shadowRuns/invalidRuns 都是 0', async () => {
    process.env[TOOL_ARG_VALIDATION_ENV] = 'shadow';
    registerTools([toolWithoutParameters()]);
    const r = await executeToolCall(call('g712_no_params', { path: 'a.txt' }), ctx);
    // 未判定 ≠ 拦下来:调用照旧成功(默认路径行为不变的影子档一半)
    expect(r.success).toBe(true);

    const bucket = snapshotToolArgShadow().tools.find((t) => t.tool === 'g712_no_params');
    expect(bucket?.schemaMissing).toBe(1);
    // 这三条是本票的核心:缺席**不得**长得像"校验跑过了"或"校验通过了"
    expect(bucket?.shadowRuns).toBe(0);
    expect(bucket?.invalidRuns).toBe(0);
    expect(bucket?.errorCount).toBe(0);
    expect(bucket?.validatorThrew).toBe(0);
    // 但它必须"进过影子路径"可见 —— 否则下一个人会把 0 读成"影子没跑"
    expect(totalToolArgShadowRuns()).toBe(1);
    expect(snapshotToolArgShadow().totalToolsWithErrors).toBe(1);
  });

  it('SchemaMissing 反向对照(shadow):完好工具照旧计 shadowRuns/invalidRuns,schemaMissing 恒 0', async () => {
    process.env[TOOL_ARG_VALIDATION_ENV] = 'shadow';
    registerTools([okTool()]);
    await executeToolCall(call('g712_demo', { notPath: 'x' }), ctx);
    const bucket = snapshotToolArgShadow().tools.find((t) => t.tool === 'g712_demo');
    expect(bucket?.schemaMissing).toBe(0);
    expect(bucket?.shadowRuns).toBe(1);
    expect(bucket?.invalidRuns).toBe(1);
    expect(bucket?.firstErrorField).toBe('path');
  });

  it('SchemaMissing 分档(shadow):有毒描述仍归 validatorThrew,两档不得合并', async () => {
    process.env[TOOL_ARG_VALIDATION_ENV] = 'shadow';
    registerTools([poisonedTool()]);
    const r = await executeToolCall(call('g712_poison', { path: 'x' }), ctx);
    expect(r.success).toBe(true);
    const bucket = snapshotToolArgShadow().tools.find((t) => t.tool === 'g712_poison');
    expect(bucket?.validatorThrew).toBe(1);
    expect(bucket?.schemaMissing).toBe(0);
    // 与改前逐字相同:有毒那一型仍算一次 shadowRuns 进入(只是没判出结果)
    expect(bucket?.shadowRuns).toBe(1);
  });

  it('SchemaMissing 默认档(off):缺席工具也一次都不进校验分支,所有计数为 0', async () => {
    // 本票不改今天的默认行为:off 档下这段代码等价于不存在。
    registerTools([toolWithoutParameters()]);
    const r = await executeToolCall(call('g712_no_params', { path: 'a.txt' }), ctx);
    expect(r).toEqual({ success: true, output: 'ran' });
    const snap = snapshotToolArgShadow();
    expect(snap.tools).toEqual([]);
    expect(totalToolArgShadowRuns()).toBe(0);
    expect(snap.enforce.runs).toBe(0);
    expect(snap.enforce.schemaMissing).toBe(0);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

// ==================== ③ enforce:未判定沿用 fail-open,执行行为一字未变 ====================

describe('③ enforce 决策 SchemaMissing 走未判定档', () => {
  it('SchemaMissing(enforce 单元): status=undetermined、args 引用原样、schemaMissing=1 而 passedPlain=0', () => {
    const args = { path: 'a.txt' };
    const d = enforceValidateToolArguments(toolWithoutParameters(), args);
    expect(d.status).toBe('undetermined');
    expect(d.args).toBe(args);
    expect(d.errors).toEqual([]);
    expect(d.normalizedFields).toEqual([]);
    const e = snapshotToolArgShadow().enforce;
    expect(e.schemaMissing).toBe(1);
    expect(e.passedPlain).toBe(0);
    expect(e.passedNormalized).toBe(0);
    expect(e.rejected).toBe(0);
    expect(e.validatorThrew).toBe(0);
    expect(e.runs).toBe(1);
  });

  it('SchemaMissing(enforce 执行链):同一条调用在 off 与 enforce 下结果逐字相同、handler 收到同一引用', async () => {
    const tool = toolWithoutParameters();
    process.env[TOOL_ARG_VALIDATION_ENV] = 'off';
    registerTools([tool]);
    const offArgs = { path: 'b.txt' };
    const offResult = await executeToolCall(call('g712_no_params', offArgs), ctx);
    expect(offResult).toEqual({ success: true, output: 'ran' });

    resetRateLimiter();
    clearTools();
    registerTools([tool]);
    resetToolArgShadowTelemetry();
    executedArgs.length = 0;
    executedIdentity.length = 0;
    process.env[TOOL_ARG_VALIDATION_ENV] = 'enforce';
    const args = { path: 'b.txt' };
    const onResult = await executeToolCall(call('g712_no_params', args), ctx);

    // 行为一字未变的装车证明:返回值深相等 + 逐字节相等 + 参数引用一路到底没被替换
    expect(onResult).toEqual(offResult);
    expect(JSON.stringify(onResult)).toBe(JSON.stringify(offResult));
    expect(executedIdentity[0]).toBe(args);
    expect(args).toEqual({ path: 'b.txt' });
    // 而这唯一新增的可见差异只在账上:未判定档,不是"通过"
    expect(snapshotToolArgShadow().enforce.schemaMissing).toBe(1);
    expect(snapshotToolArgShadow().enforce.passedPlain).toBe(0);
  });

  it('SchemaMissing 反向对照(enforce):完好工具照旧 pass,违规照旧 reject', async () => {
    registerTools([okTool()]);
    process.env[TOOL_ARG_VALIDATION_ENV] = 'enforce';
    const good = await executeToolCall(call('g712_demo', { path: 'c.txt' }), ctx);
    expect(good).toEqual({ success: true, output: 'ok:c.txt' });
    expect(snapshotToolArgShadow().enforce.passedPlain).toBe(1);
    expect(snapshotToolArgShadow().enforce.schemaMissing).toBe(0);

    const bad = await executeToolCall(call('g712_demo', {}), ctx);
    expect(bad.success).toBe(false);
    expect(bad.errorType).toBe('invalid_arguments');
  });

  it('SchemaMissing 分档(enforce):有毒描述仍计 validatorThrew,不并进缺席档', () => {
    const d = enforceValidateToolArguments(poisonedTool(), { path: 'x' });
    expect(d.status).toBe('undetermined');
    const e = snapshotToolArgShadow().enforce;
    expect(e.validatorThrew).toBe(1);
    expect(e.schemaMissing).toBe(0);
  });
});

// ==================== ④ 离线台账 ====================

describe('④ 离线回放 SchemaMissing 单列一档并点名工具', () => {
  it('SchemaMissing(replay): 缺席记录计 schemaMissing,不进 valid,也不进 toolsCovered,但逐条报名', () => {
    const recs: ReplayRecord[] = [{ tool: 'g712_no_params', input: { path: 'a' }, timestamp: '2026-09-29T00:00:00.000Z' }];
    const out = replayArgumentDeviations(recs, registryOf(toolWithoutParameters()));
    expect(out.totals.schemaMissing).toBe(1);
    expect(out.totals.valid).toBe(0);
    expect(out.totals.invalid).toBe(0);
    expect(out.totals.validatorThrew).toBe(0);
    expect(out.totals.matched).toBe(1);
    expect(out.schemaMissingTools).toEqual(['g712_no_params']);
    // "被回放过"这句对它不成立:校验器一次都没跑
    expect(out.toolsCovered).toEqual([]);
    expect(out.rows).toEqual([]);
  });

  it('SchemaMissing 反向对照(replay):完好工具照旧进 valid/toolsCovered,schemaMissing 恒 0', () => {
    const recs: ReplayRecord[] = [{ tool: 'g712_demo', input: { path: 'a' } }];
    const out = replayArgumentDeviations(recs, registryOf(okTool()));
    expect(out.totals.valid).toBe(1);
    expect(out.totals.schemaMissing).toBe(0);
    expect(out.schemaMissingTools).toEqual([]);
    expect(out.toolsCovered).toEqual(['g712_demo']);
  });

  it('SchemaMissing 分档(replay):有毒描述仍归 validatorThrew 且照旧算被覆盖过', () => {
    const out = replayArgumentDeviations([{ tool: 'g712_poison', input: {} }], registryOf(poisonedTool()));
    expect(out.totals.validatorThrew).toBe(1);
    expect(out.totals.schemaMissing).toBe(0);
    expect(out.toolsCovered).toEqual(['g712_poison']);
  });

  it('SchemaMissing 影子入口直调同样计一档(shadowValidateToolArguments 不经执行链)', () => {
    process.env[TOOL_ARG_VALIDATION_ENV] = 'shadow';
    shadowValidateToolArguments(toolWithoutParameters(), { path: 'x' });
    const bucket = snapshotToolArgShadow().tools[0];
    expect(bucket.tool).toBe('g712_no_params');
    expect(bucket.schemaMissing).toBe(1);
    expect(bucket.shadowRuns).toBe(0);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
