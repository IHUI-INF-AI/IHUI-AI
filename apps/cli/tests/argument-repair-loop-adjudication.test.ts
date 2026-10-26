// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票「argument-validation 装车后的覆盖面三格缺口」① 的**代裁取证**用例(2026-10-26/s8-argval)。
 *
 * 裁决结论 = B 案(不在 `tools/index.ts` 的 enforce 站点接 `createArgumentRepairSession`)。
 * 本用例不测 repair-loop 本身的行为(那边已由 `argument-repair.test.ts` 钉死),只钉**裁决的四条事实**:
 *   ① 覆盖面没丢:string 形态的入参在**到达 enforce 之前**已由 `parseNativeToolCalls` →
 *      `parseToolArguments` 收敛成 `Record`,故 repair-loop 的"原值是 string ⇒ 一次 JSON.parse"
 *      一支在执行器站点结构上不可达 ⇒ 就地接线救不回票面要的那条腿;
 *   ② 回喂账已发生且在**唯一**落点:enforce 被拒 ⇒ 拒绝文案带单行路径级违规清单,
 *      计数走 `noteEnforceRepairRejection`(按工具名连续窗),`enforceRepairStreak` 与快照同增;
 *   ③ 两套预算互斥(接线即矛盾):同一次失败,telemetry 窗已判 `exhausted`(第 4 次起硬失败),
 *      会话侧却还在出 `reject`/`nudge` 帧 ⇒ 模型面前会同时收到两个互相打脸的预算;
 *   ④ 接线探测器(形状锁):执行器正文不含 `createArgumentRepairSession` / `argument-repair-loop`
 *      的任何 import 或调用 ⇒ 一旦有人接而未摘旧账,本用例当场翻红,强制"再判一次并口";
 *      正向对照 = 同一把尺子在 repair-loop 自己的文件里**必须**命中(证明探测器不是恒真)。
 *
 * 纪律:反向对照全部用测试内替身(本地 schema、本地 session、直接调 telemetry 出口),
 * **没有为迁就测试改动任何生产源码**。
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import {
  NUDGE_ATTEMPTS,
  REPAIR_ATTEMPTS,
  createArgumentRepairSession,
  normalizeSubmit,
} from '../src/tools/argument-repair-loop.js';
import {
  TOOL_ARG_REPAIR_MAX_ATTEMPTS,
  TOOL_ARG_VALIDATION_ENV,
  enforceRepairStreak,
  enforceValidateToolArguments,
  noteEnforceRepairRejection,
  resetToolArgShadowTelemetry,
  snapshotToolArgShadow,
} from '../src/tools/argument-validation-telemetry.js';
import { validateToolArguments } from '../src/tools/argument-validator.js';
import {
  clearTools,
  executeToolCall,
  parseNativeToolCalls,
  registerTools,
  resetRateLimiter,
  type Tool,
  type ToolContext,
  type ToolSchema,
} from '../src/tools/index.js';

/** 与 `argument-repair.test.ts` 同形状的最小夹具(object 位必填 name)。 */
const FIXTURE_SCHEMA: ToolSchema = {
  name: 'fixture_tool',
  description: '',
  parameters: {
    type: 'object',
    properties: { name: { type: 'string', description: '' } },
    required: ['name'],
  },
};

/** object 位夹具:用于证明 enforce 判定面自己就带一次 schema-aware 容错(不需要会话二次 parse)。 */
const OBJECT_SCHEMA: ToolSchema = {
  name: 'fixture_object_tool',
  description: '',
  parameters: {
    type: 'object',
    properties: {
      payload: {
        type: 'object',
        description: '',
        properties: { a: { type: 'number', description: '' } },
        required: ['a'],
      },
    },
    required: ['payload'],
  },
};

const ctx: ToolContext = { workspacePath: process.cwd() };

function makeTool(schema: ToolSchema): Tool {
  return {
    name: schema.name,
    description: schema.description,
    parameters: schema.parameters.properties,
    required: [...(schema.parameters.required ?? [])],
    dangerLevel: 'read',
    async execute() {
      return { success: true, output: 'fixture-ran' };
    },
  };
}

const makeFixtureTool = () => makeTool(FIXTURE_SCHEMA);

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  resetRateLimiter();
  clearTools();
  registerTools([makeFixtureTool()]);
  resetToolArgShadowTelemetry();
  delete process.env[TOOL_ARG_VALIDATION_ENV];
  // enforce 首次启用会 announce 一次,测试面不需要看
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  delete process.env[TOOL_ARG_VALIDATION_ENV];
  resetToolArgShadowTelemetry();
  warnSpy.mockRestore();
});

// ==================== ① string 一支在 enforce 站点不可达 ====================

describe('① 覆盖面核对:入参在到达 enforce 之前已是 Record', () => {
  it('OpenAI 形态的 JSON 字符串 arguments ⇒ 解析面已收敛成对象(repair-loop 夹具① 那一支不可达)', () => {
    const raw = '{"name":"alpha"}';
    const calls = parseNativeToolCalls({
      role: 'assistant',
      tool_calls: [{ function: { name: 'fixture_tool', arguments: raw } }],
    });
    expect(calls).toHaveLength(1);
    expect(typeof calls[0]!.arguments).toBe('object');
    expect(calls[0]!.arguments).toEqual({ name: 'alpha' });

    // 反向对照(测试内替身):同一枚原串直接喂会话侧,parse 那一支确实是**真能力**
    // ⇒ 结论不是"那半边是废码",而是"这一族已被上游解析层接住,执行器站点收不到 string"。
    const viaSession = normalizeSubmit(raw, FIXTURE_SCHEMA);
    expect(viaSession.reparsed).toBe(true);
    expect(viaSession.valid).toBe(true);
  });

  it('非对象的可 parse 串在执行器站点被折成 {}(与 repair-loop 报的路径不同形,但都到不了 enforce)', () => {
    const calls = parseNativeToolCalls({
      tool_calls: [{ function: { name: 'fixture_tool', arguments: '42' } }],
    });
    expect(calls[0]!.arguments).toEqual({});
    // 会话侧走的是另一套判序(原值不过 ⇒ 报 (root));这正是"两份归一判律"的分歧面
    const viaSession = normalizeSubmit('42', FIXTURE_SCHEMA);
    expect(viaSession.violations[0]!.field).toBe('(root)');
  });

  it('enforce 判定面自带一次 schema-aware 容错 ⇒ object 位的 stringify 无需会话二次 parse', () => {
    // 变异对照:没有容错那一半时这一发必被拒(阳性对照 = 同一把尺子的裸校验)
    expect(validateToolArguments({ payload: '{"a":1}' }, OBJECT_SCHEMA).valid).toBe(false);
    const d = enforceValidateToolArguments(makeTool(OBJECT_SCHEMA), { payload: '{"a":1}' });
    expect(d.status).toBe('pass-normalized');
    expect((d.args as { payload: unknown }).payload).toEqual({ a: 1 });
  });
});

// ==================== ② 回喂账的唯一落点 ====================

describe('② enforce 被拒时记账真的发生(且只有一处)', () => {
  it('拒绝在执行之前 + 文案带单行违规清单 + 连续窗计数与快照同增', async () => {
    process.env[TOOL_ARG_VALIDATION_ENV] = 'enforce';
    const r = await executeToolCall({ name: 'fixture_tool', arguments: { other: 1 } }, ctx);
    expect(r.success).toBe(false);
    expect(r.errorType).toBe('invalid_arguments');
    expect(r.error).toContain('(1/3)');
    expect(r.error).toContain('name=missing_required(expected=string; got=undefined)');
    expect(r.error).not.toMatch(/[\r\n]/);
    expect(enforceRepairStreak('fixture_tool')).toBe(1);
    expect(snapshotToolArgShadow().enforce.repairRejections).toBe(1);

    // 第二次违规:窗走到 2 —— 记账仍是同一处(若接了会话,这里会出现两套数)
    const again = await executeToolCall({ name: 'fixture_tool', arguments: { other: 2 } }, ctx);
    expect(again.error).toContain('(2/3)');
    expect(enforceRepairStreak('fixture_tool')).toBe(2);
  });
});

// ==================== ③ 两套预算互斥(接线即矛盾) ====================

describe('③ 反证:同一次失败,telemetry 窗与会话双预算给出不同裁决', () => {
  it('窗已 exhausted(第 max+1 次)时,会话侧仍在出 reject/nudge 帧', async () => {
    const toolName = FIXTURE_SCHEMA.name;
    let window = { attempt: 0, max: TOOL_ARG_REPAIR_MAX_ATTEMPTS, exhausted: false };
    for (let i = 0; i < TOOL_ARG_REPAIR_MAX_ATTEMPTS + 1; i++) {
      window = noteEnforceRepairRejection(toolName);
    }
    expect(window.exhausted).toBe(true);
    expect(window.attempt).toBe(TOOL_ARG_REPAIR_MAX_ATTEMPTS + 1);
    expect(enforceRepairStreak(toolName)).toBe(TOOL_ARG_REPAIR_MAX_ATTEMPTS + 1);

    // 同一时刻、同一次失败的会话侧判定:预算尚未耗尽 ⇒ 若两套并存,执行器会一边硬失败一边许诺重试
    const session = createArgumentRepairSession(toolName, { schema: FIXTURE_SCHEMA });
    const outcome = await session.submit({ other: 1 });
    expect(outcome.kind).toBe('reject');
    if (outcome.kind === 'reject') {
      expect(outcome.repairsRemaining).toBe(REPAIR_ATTEMPTS - 1);
      expect(outcome.nudgesRemaining).toBe(NUDGE_ATTEMPTS);
    }
    expect(enforceRepairStreak(toolName)).toBe(TOOL_ARG_REPAIR_MAX_ATTEMPTS + 1); // 会话不写这笔账
  });

  it('会话侧走到 nudge 帧时,telemetry 窗早已封顶(两条预算的终态时刻不同形)', async () => {
    const toolName = 'nudge_pair_tool';
    const session = createArgumentRepairSession(toolName, { schema: FIXTURE_SCHEMA });
    let lastKind = 'accepted';
    for (let i = 0; i < REPAIR_ATTEMPTS + 1; i++) {
      lastKind = (await session.submit({ other: i })).kind;
    }
    expect(lastKind).toBe('nudge'); // 会话侧:repair 耗尽后还有一帧提醒
    const window = noteEnforceRepairRejection(toolName); // 执行器侧:第一次就该是 attempt 1
    expect(window.attempt).toBe(1);
    expect(window.exhausted).toBe(false);
    // 反过来推到窗封顶 ⇒ 会话侧已经无预算可给(第 5 次起会话只能 exhausted,而窗此时才第 1 次)
    for (let i = 0; i < TOOL_ARG_REPAIR_MAX_ATTEMPTS; i++) noteEnforceRepairRejection(toolName);
    expect((await session.submit({ other: 'x' })).kind).toBe('exhausted');
  });
});

// ==================== ④ 接线探测器(形状锁) ====================

describe('④ 探测器:执行器未 import repair 会话;旧账仍在位', () => {
  // 读**生产正文**而不是编译产物;探测器自身文件不参与判定(它必然含这两个标识符)。
  const executorSource = async () =>
    (await import('node:fs')).readFileSync(new URL('../src/tools/index.ts', import.meta.url), 'utf8');

  it('tools/index.ts 不含 createArgumentRepairSession / argument-repair-loop ⇒ ① 维持未接线', async () => {
    const src = await executorSource();
    expect(src).not.toContain('createArgumentRepairSession');
    expect(src).not.toContain('argument-repair-loop');
    // 同一段正文必须仍调用唯一的账(探测器不是"因为文件空了所以绿")
    expect(src).toContain('noteEnforceRepairRejection');
    expect(src).toContain('applyToolArgValidation');
  });

  it('正向对照:同一把尺子在 repair-loop 文件里必须命中 ⇒ 上一条的 not.toContain 不是恒真', async () => {
    const { readFileSync } = await import('node:fs');
    const own = readFileSync(new URL('../src/tools/argument-repair-loop.ts', import.meta.url), 'utf8');
    expect(own).toContain('export function createArgumentRepairSession');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
