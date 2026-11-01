// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票 4706(②)· hub 分支入参校验覆盖面的**行为锁**(2026-11-01 立)。
 *
 * 现读事实:`executeToolCallInner` 的 `hubEnabled && hubResolver` 分支曾在"拿到 Tool 对象
 * 之前"整体跳过影子/enforce 校验(源码注释自标"本票不扩面");2026-10-15 补线后走
 * `getTool(call.name)` → `applyToolArgValidation(hubTool, call)`(与本地路径共用唯一校验出口)。
 * 但接线本身一直没有测试钉住 —— 本文件补的就是这一格(§0.9:判据要在真跑它的那一刻才成立)。
 *
 * 五格逐条:
 *   A enforce+hub:本地可解析工具的非法入参 ⇒ 拒绝在 dispatch **之前**(探针 execute 零调用),
 *     且 repair 账(`noteEnforceRepairRejection`)在 hub 路径同样进窗 —— 2026-10-15 注记声称的
 *     "② 已接线(noteEnforceRepairRejection)"由此钉成可复跑的凭证。
 *   B enforce+hub:合法入参照常经 hub 执行(接线没把 hub 路径改红)。
 *   C shadow+hub:非法入参不拦截,但影子计数器进账(覆盖面读数在 hub 分支同样有料)。
 *   D remote-only 残余(如实登记不假判绿):remote 句柄拿不到 Tool 对象 ⇒ 校验**结构上跑不到**,
 *     调用照常派发、args 原样送达,计数器不冒充"已校验"(与 G-712"推不出 schema 不得兜空表
 *     冒充已校验"同纪律;按形状猜转换会造出假拒绝,比不校验更坏)。
 *   E 形状锁:hub 分支体内 `applyToolArgValidation(hubTool…)` 必须排在 `resolver.dispatch(`
 *     之前 —— 谁把校验挪回 dispatch 之后(即恢复"早退路径不校验"那一型),这里先翻红。
 *
 * 隔离:零网络、零磁盘副作用(探针只记内存);enforce 首启 announce 用 console.warn 桩吃掉。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  TOOL_ARG_VALIDATION_ENV,
  enforceRepairStreak,
  resetToolArgShadowTelemetry,
  snapshotToolArgShadow,
} from '../src/tools/argument-validation-telemetry.js';
import {
  clearTools,
  disableToolHub,
  enableToolHub,
  executeToolCall,
  registerTools,
  resetRateLimiter,
  setHubRemoteRegistry,
  type Tool,
  type ToolContext,
} from '../src/tools/index.js';
import { InMemoryRegistry, type ToolHandle, type ToolDescription } from '../src/tools/hub/index.js';

const INDEX_TS = fileURLToPath(new URL('../src/tools/index.ts', import.meta.url));

const ctx: ToolContext = { workspacePath: process.cwd() };

/** 被调用一次就在 seen 里留一枚入参 —— "零调用"由此可断言(副作用没发生)。 */
function makeProbe(name: string, seen: Record<string, unknown>[]): Tool {
  return {
    name,
    description: '',
    parameters: { name: { type: 'string', description: '' } },
    required: ['name'],
    dangerLevel: 'read',
    execute: async (args) => {
      seen.push(args as Record<string, unknown>);
      return { success: true, output: 'probe-ran' };
    },
  };
}

/** remote 侧最小句柄:自述 'read'(降档走 MCP 只读白名单同形),不碰本地 Tool 对象。 */
function makeRemoteHandle(name: string, sink: Record<string, unknown>[]): ToolHandle {
  return {
    id: name,
    describe(): ToolDescription {
      return { id: name, description: `remote ${name}`, dangerLevel: 'read' };
    },
    async execute(_ctx, args) {
      sink.push(args as Record<string, unknown>);
      return { success: true, output: `remote-ran ${name}` };
    },
  };
}

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  resetRateLimiter();
  clearTools();
  resetToolArgShadowTelemetry();
  delete process.env[TOOL_ARG_VALIDATION_ENV];
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  disableToolHub();
  setHubRemoteRegistry(new InMemoryRegistry());
  delete process.env[TOOL_ARG_VALIDATION_ENV];
  resetToolArgShadowTelemetry();
  warnSpy.mockRestore();
});

describe('票 4706② · hub 分支与本地路径共用唯一校验出口', () => {
  it('A enforce+hub:非法入参在 dispatch 前被拒,探针零执行,repair 窗在 hub 路径进账', async () => {
    const seen: Record<string, unknown>[] = [];
    registerTools([makeProbe('hub_enforce_probe', seen)]);
    enableToolHub();
    process.env[TOOL_ARG_VALIDATION_ENV] = 'enforce';

    const r = await executeToolCall({ name: 'hub_enforce_probe', arguments: { other: 1 } }, ctx);

    expect(r.success).toBe(false);
    expect(r.errorType).toBe('invalid_arguments');
    expect(r.error).toContain('violations ->');
    // 副作用没发生:一条非法调用不得派发
    expect(seen).toEqual([]);
    // 2026-10-15 注记声称的记账接线:hub 路径的拒绝同样走 noteEnforceRepairRejection
    expect(enforceRepairStreak('hub_enforce_probe')).toBe(1);
    expect(snapshotToolArgShadow().enforce.repairRejections).toBe(1);
  });

  it('B enforce+hub:合法入参照常经 hub 派发(接线没把正常调用改红)', async () => {
    const seen: Record<string, unknown>[] = [];
    registerTools([makeProbe('hub_enforce_ok', seen)]);
    enableToolHub();
    process.env[TOOL_ARG_VALIDATION_ENV] = 'enforce';

    const r = await executeToolCall(
      { name: 'hub_enforce_ok', arguments: { name: 'ok' } },
      ctx,
    );

    expect(r.success).toBe(true);
    expect(seen).toEqual([{ name: 'ok' }]);
    expect(enforceRepairStreak('hub_enforce_ok')).toBe(0);
  });

  it('C shadow(默认档)+hub:不拦截,但影子计数器在 hub 分支进账', async () => {
    const seen: Record<string, unknown>[] = [];
    registerTools([makeProbe('hub_shadow_probe', seen)]);
    enableToolHub();
    // 不设 env ⇒ 默认 shadow

    const r = await executeToolCall({ name: 'hub_shadow_probe', arguments: { nope: true } }, ctx);

    expect(r.success).toBe(true);
    expect(seen).toHaveLength(1);
    const bucket = snapshotToolArgShadow().tools.find((t) => t.tool === 'hub_shadow_probe');
    expect(bucket?.shadowRuns).toBe(1);
    expect(bucket?.invalidRuns).toBe(1);
  });

  it('D remote-only 残余(如实登记):拿不到 Tool ⇒ 校验不跑、不假拒、不冒充已校验', async () => {
    const remoteSink: Record<string, unknown>[] = [];
    const remote = new InMemoryRegistry();
    remote.register(makeRemoteHandle('hub_remote_read', remoteSink));
    // 本地不注册同名工具 ⇒ getTool 返回 undefined,即票面"拿不到 Tool 对象"的那一格
    enableToolHub();
    setHubRemoteRegistry(remote);
    process.env[TOOL_ARG_VALIDATION_ENV] = 'enforce';

    const r = await executeToolCall(
      { name: 'hub_remote_read', arguments: { anything: [1, 2] } },
      ctx,
    );

    // 维持"不校验"的既定口径:既不假拒,也没有任何校验进账
    expect(r.success).toBe(true);
    expect(r.errorType).toBeUndefined();
    expect(remoteSink).toEqual([{ anything: [1, 2] }]);
    const snap = snapshotToolArgShadow();
    expect(snap.enforce.runs).toBe(0);
    expect(snap.tools.find((t) => t.tool === 'hub_remote_read')).toBeUndefined();
  });

  it('E 形状锁:hub 分支体内校验必须排在 dispatch 之前(防"早退不校验"回潮)', () => {
    const src = readFileSync(INDEX_TS, 'utf-8');
    const branchStart = src.indexOf('if (hubEnabled && hubResolver) {');
    const dispatch = src.indexOf('resolver.dispatch(', branchStart);
    const validation = src.indexOf('applyToolArgValidation(hubTool, call)', branchStart);
    expect(branchStart).toBeGreaterThan(-1);
    expect(dispatch).toBeGreaterThan(-1);
    expect(validation).toBeGreaterThan(-1);
    expect(validation).toBeLessThan(dispatch);
    // 且必须共用同一个唯一出口:定义恰好一枚、hub 分支体内调用恰好一枚
    // (不锁全文件出现次数 —— 那是脆计数,他席合法新增调用点会把本锁变恒红,§12e)
    expect(src.match(/function applyToolArgValidation/g)?.length).toBe(1);
    expect(
      src.slice(branchStart, dispatch).match(/applyToolArgValidation\(/g)?.length,
    ).toBe(1);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
