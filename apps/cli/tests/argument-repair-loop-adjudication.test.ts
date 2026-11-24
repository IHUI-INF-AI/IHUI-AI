// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票「argument-validation 装车后的覆盖面三格缺口」① 的**终局**(2026-10-31 执行):
 * `apps/cli/src/tools/argument-repair-loop.ts` 已整体退役(删除),不再以"等宿主"的生产件
 * 形式留在 `src/` 里。
 *
 * 裁决 = 不接线(继承 2026-10-26/s8-argval 的四条取证;原用例里借用会话本身的 ①③ 两格
 * 已随模块一起退场,结论保留在本头注与 git 历史),依据逐条:
 *   ① 覆盖面不缺口:string 形态入参在到达 enforce 之前已由 `parseNativeToolCalls` →
 *      `parseToolArguments`(`tools/index.ts`)收敛成 `Record`,故会话侧"原值是 string ⇒
 *      一次 JSON.parse"这一支在执行器站点**结构上不可达**;object 位的 stringify 由
 *      `enforceValidateToolArguments` 内的 schema-aware 容错解析接住。
 *   ② 回喂账已发生且在唯一落点:enforce 被拒 ⇒ 拒绝文案带单行路径级违规清单,计数走
 *      `noteEnforceRepairRejection`(按工具名连续窗,`TOOL_ARG_REPAIR_MAX_ATTEMPTS`)。
 *   ③ 两套预算互斥:同一次失败,telemetry 窗第 max+1 次即 `invalid_arguments_exhausted` 硬失败,
 *      而会话侧此时还在出 `reject`/`nudge` 帧 ⇒ 就地接线会让模型面前同时出现两个打脸的计数器。
 *   ④ 会话独有的 `cancelAsk`(每帧先取消挂着的用户 ask)在执行器站点没有对应物理量 ——
 *      拒绝刻意发生在权限/批准弹窗**之前**,此刻无 ask 可 cancel,也没有第二帧的发送通道。
 *   ⑤ 真实宿主 = 上游 `dynamic-workflow/src/engine/scheduler-submit.ts`,本仓现读不存在
 *      (`packages/` 无 dynamic-workflow) ⇒ 它是"等宿主"的移植件,不是执行器的缺失半边。
 *
 * §7 删除三问(留在此处,防"为什么删"随 commit 消息飘走):
 *   ① 承载什么功能? —— repair 帧会话(reject×3 / nudge×1 / exhausted 两条独立预算 + cancelAsk 时序)。
 *   ② 有无等价实现? —— 有:入参校验唯一应用点 `applyToolArgValidation` + `noteEnforceRepairRejection`
 *      连续窗(下方行为锁),string 一支不可达、nudge 无物理量。
 *   ③ 无等价才不可删 —— ② 成立 ⇒ 删除合法。
 *
 * 本文件现在钉的是**退役之后不许复活**:生产树零 import / 模块文件不存在 / 唯一 repair 预算
 * 仍是 telemetry 窗且行为未变。任何人把模块加回来接线,都会在这里先翻红,强制重判并口。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  TOOL_ARG_REPAIR_MAX_ATTEMPTS,
  TOOL_ARG_VALIDATION_ENV,
  enforceRepairStreak,
  resetToolArgShadowTelemetry,
  snapshotToolArgShadow,
} from '../src/tools/argument-validation-telemetry.js';
import {
  clearTools,
  executeToolCall,
  registerTools,
  resetRateLimiter,
  type Tool,
  type ToolContext,
  type ToolSchema,
} from '../src/tools/index.js';

const SRC_ROOT = fileURLToPath(new URL('../src/', import.meta.url));

const FIXTURE_SCHEMA: ToolSchema = {
  name: 'retire_probe_tool',
  description: '',
  parameters: {
    type: 'object',
    properties: { name: { type: 'string', description: '' } },
    required: ['name'],
  },
};

const ctx: ToolContext = { workspacePath: process.cwd() };

function walkTs(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      walkTs(abs, out);
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      out.push(abs);
    }
  }
  return out;
}

function makeTool(schema: ToolSchema): Tool {
  return {
    name: schema.name,
    description: schema.description,
    parameters: schema.parameters.properties,
    required: [...(schema.parameters.required ?? [])],
    dangerLevel: 'read',
    execute: async () => ({ success: true, output: 'fixture-ran' }),
  };
}

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  resetRateLimiter();
  clearTools();
  registerTools([makeTool(FIXTURE_SCHEMA)]);
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

// ==================== 退役锁一:生产树零残留 ====================

describe('① 退役锁:生产树不再有 repair 会话(零 import、零文件)', () => {
  it('src/**/*.ts 不再出现 argument-repair-loop / createArgumentRepairSession(同一个尺子正反对照)', () => {
    const files = walkTs(SRC_ROOT).map((file) => ({ file, text: readFileSync(file, 'utf-8') }));
    // 扫描面非空(否则下面的 toEqual([]) 是恒真)
    expect(files.length).toBeGreaterThan(50);

    const hits = files
      .filter(
        (f) => f.text.includes('argument-repair-loop') || f.text.includes('createArgumentRepairSession'),
      )
      .map((f) => f.file);
    expect(hits).toEqual([]);

    // 正向对照:同一把尺子在唯一应用点上必须命中"仍在用的 repair 窗" ⇒ 上面的空集不是尺子坏了
    const executor = files.find((f) => f.file.endsWith(path.join('tools', 'index.ts')));
    expect(executor).toBeDefined();
    expect(executor!.text).toContain('noteEnforceRepairRejection');
    expect(executor!.text).toContain('applyToolArgValidation');
  });

  it('src/tools/argument-repair-loop.ts 文件不存在(不再有"坐着没人 import"的等宿主件)', () => {
    expect(existsSync(path.join(SRC_ROOT, 'tools', 'argument-repair-loop.ts'))).toBe(false);
  });
});

// ==================== 退役锁二:唯一 repair 窗的行为未变 ====================

describe('② 留存实现:telemetry 连续窗是唯一的修复预算(行为锁)', () => {
  it('常量单源仍是 3;第 max 次前是 invalid_arguments(带 n/max 与违规清单),第 max+1 次才硬失败', async () => {
    process.env[TOOL_ARG_VALIDATION_ENV] = 'enforce';
    expect(TOOL_ARG_REPAIR_MAX_ATTEMPTS).toBe(3);

    for (let attempt = 1; attempt <= TOOL_ARG_REPAIR_MAX_ATTEMPTS; attempt++) {
      const r = await executeToolCall({ name: FIXTURE_SCHEMA.name, arguments: { other: attempt } }, ctx);
      expect(r.success).toBe(false);
      expect(r.errorType).toBe('invalid_arguments');
      expect(r.error).toContain(`(${attempt}/${TOOL_ARG_REPAIR_MAX_ATTEMPTS})`);
      expect(r.error).toContain('name=missing_required(expected=string; got=undefined)');
      expect(r.error).not.toMatch(/[\r\n]/);
    }
    expect(enforceRepairStreak(FIXTURE_SCHEMA.name)).toBe(TOOL_ARG_REPAIR_MAX_ATTEMPTS);

    const exhausted = await executeToolCall(
      { name: FIXTURE_SCHEMA.name, arguments: { other: 'x' } },
      ctx,
    );
    expect(exhausted.success).toBe(false);
    expect(exhausted.errorType).toBe('invalid_arguments_exhausted');
    expect(exhausted.error).toContain('exceeds the 3-attempt repair window');
    expect(exhausted.error).toContain('last violations ->');
    expect(exhausted.error).toContain('name=missing_required');
    expect(enforceRepairStreak(FIXTURE_SCHEMA.name)).toBe(TOOL_ARG_REPAIR_MAX_ATTEMPTS + 1);
    expect(snapshotToolArgShadow().enforce.repairRejections).toBe(TOOL_ARG_REPAIR_MAX_ATTEMPTS + 1);
    expect(snapshotToolArgShadow().enforce.repairExhausted).toBe(1);
  });

  it('一次判定通过即清零连续窗(会话级单调预算没有这条语义 —— 退役后不丢这格)', async () => {
    process.env[TOOL_ARG_VALIDATION_ENV] = 'enforce';

    for (let i = 0; i < 2; i++) {
      await executeToolCall({ name: FIXTURE_SCHEMA.name, arguments: { other: i } }, ctx);
    }
    expect(enforceRepairStreak(FIXTURE_SCHEMA.name)).toBe(2);

    const ok = await executeToolCall({ name: FIXTURE_SCHEMA.name, arguments: { name: 'recovered' } }, ctx);
    expect(ok.success).toBe(true);
    expect(enforceRepairStreak(FIXTURE_SCHEMA.name)).toBe(0);

    const again = await executeToolCall({ name: FIXTURE_SCHEMA.name, arguments: { other: 'again' } }, ctx);
    expect(again.errorType).toBe('invalid_arguments');
    expect(again.error).toContain('(1/3)');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
