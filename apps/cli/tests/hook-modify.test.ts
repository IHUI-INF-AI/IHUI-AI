// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-916424:PermissionRequest 钩子四形状应答(deny/allow/ask/modify)+ 改后权限重判。
 *
 * 上游实测 tool/executor/hook-flow.ts:83-122 + permission-flow.ts:248-266 的能力对齐:
 * 钩子不再只能"拦"(blocked),还能"答"确认窗。全部用例驱动生产入口 executeToolCall
 * (批准闸旁路在 tools/index.ts),钩子链走真派生子进程(runPermissionRequest → dispatchHookEntry)。
 *
 * 票面四断言:
 *  ① hook 返回 modifiedInput ⇒ 工具按改后输入执行;
 *  ② 改后输入 schema 失败 ⇒ 不执行且错误带 hook 上下文(钩子名 + 违规清单);
 *  ③ 改后输入触发须确认 ⇒ 回确认窗,不得沿用改前 allow(反向锁);
 *  ④ 待判格如实登记:上游 permission-input-recheck.ts:71-83 对"重判得 ask 但非
 *     project-rule"静默放行;我方落地是"重判后仍须批 ⇒ 一律回人工窗(或无渠道则拒)",
 *     禁止抄静默 —— ③ 就是这一格的反向锁证明。
 * 另附 deny 协议 / allow 自动应答 / 失败不混流 / 多钩子保守合并四格支撑。
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  clearTools,
  executeToolCall,
  registerTools,
  resetRateLimiter,
  type Tool,
  type ToolContext,
} from '../src/tools/index.js';
import { resetPermissionLeaseForTests } from '../src/tools/permission-lease.js';

// ROOT = 仓库根(tests 在 apps/cli/tests 下),临时面统一落 §15/§26 批准的 .ihui-agent/tmp
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const TMP = fs.mkdtempSync(path.join(ROOT, '.ihui-agent', 'tmp', 'hook-modify-'));
const CONFIG = path.join(TMP, 'hooks.json');

let origConfig: string | undefined;
let origTrust: string | undefined;

beforeAll(() => {
  origConfig = process.env.IHUI_HOOKS_CONFIG;
  origTrust = process.env.IHUI_TRUST_WORKSPACE;
  process.env.IHUI_HOOKS_CONFIG = CONFIG;
  // 非交互出口声明信任(与 hooks-rewrite-permission-recheck/hook-terminal-states 同一姿势)
  process.env.IHUI_TRUST_WORKSPACE = '1';
});

afterAll(() => {
  if (origConfig === undefined) delete process.env.IHUI_HOOKS_CONFIG;
  else process.env.IHUI_HOOKS_CONFIG = origConfig;
  if (origTrust === undefined) delete process.env.IHUI_TRUST_WORKSPACE;
  else process.env.IHUI_TRUST_WORKSPACE = origTrust;
  fs.rmSync(TMP, { recursive: true, force: true });
});

beforeEach(() => {
  clearTools();
  resetRateLimiter();
  resetPermissionLeaseForTests();
});

function writeHookConfig(entries: Array<Record<string, unknown>>): void {
  fs.writeFileSync(CONFIG, JSON.stringify({ permissionRequest: entries }), 'utf-8');
}

/** 原文抄 hook-rewrite-permission-recheck.test.ts 的 nodeEval 姿势(Windows 下去内层双引号) */
const nodeEval = (code: string): string => `"${process.execPath}" -e "${code.replace(/"/g, '')}"`;

/** 带真实 schema 的危险工具:required=command,执行体回显收到的参数(捕获面) */
function makeDangerousTool(name: string): { tool: Tool; executed: unknown[] } {
  const executed: unknown[] = [];
  const tool: Tool = {
    name,
    description: `fixture ${name}`,
    parameters: { command: { type: 'string', description: 'cmd' } },
    required: ['command'],
    dangerLevel: 'dangerous',
    execute: (async (args: Record<string, unknown>) => {
      executed.push(args);
      return { success: true, output: `ran:${JSON.stringify(args)}` };
    }) as Tool['execute'],
  };
  return { tool, executed };
}

function makeCtx(confirm: (args: Record<string, unknown>) => Promise<boolean>): ToolContext {
  const seen: Record<string, unknown>[] = [];
  const confirmSpy = async (_tool: Tool, args: Record<string, unknown>) => {
    seen.push(args);
    return confirm(args);
  };
  return { workspacePath: '.', confirmDangerous: confirmSpy, __seen: seen } as unknown as ToolContext;
}

function seenArgsOf(ctx: ToolContext): Record<string, unknown>[] {
  return (ctx as unknown as { __seen: Record<string, unknown>[] }).__seen;
}

describe('G-916424 permissionRequest 四形状应答 + 改后权限重判', () => {
  it('① hook 返回 modifiedInput ⇒ 确认窗与工具都看到改后输入', async () => {
    writeHookConfig([
      {
        name: 'g916-modify-ok',
        command: nodeEval(
          `process.stdout.write(JSON.stringify({decision:'modify',modifiedInput:{command:'modified-cmd'}}))`,
        ),
        matchTool: 'g916_modify_ok',
      },
    ]);
    const { tool, executed } = makeDangerousTool('g916_modify_ok');
    registerTools([tool]);
    const ctx = makeCtx(() => Promise.resolve(true));
    const r = await executeToolCall({ name: 'g916_modify_ok', arguments: { command: 'original-cmd' } }, ctx);
    // 确认窗里被问的是改后输入(人在窗里看到的就是钩子改完的样子)
    expect(seenArgsOf(ctx)).toEqual([{ command: 'modified-cmd' }]);
    // 工具按改后输入执行
    expect(executed).toEqual([{ command: 'modified-cmd' }]);
    expect(r.success).toBe(true);
    expect(r.output).toContain('modified-cmd');
    expect(r.output).not.toContain('original-cmd');
  });

  it('② 改后输入 schema 失败 ⇒ 不执行,错误带钩子名与违规清单,不进确认窗', async () => {
    writeHookConfig([
      {
        name: 'g916-schema-break',
        command: nodeEval(
          `process.stdout.write(JSON.stringify({decision:'modify',modifiedInput:{wrong:'x'}}))`,
        ),
        matchTool: 'g916_schema_break',
      },
    ]);
    const { tool, executed } = makeDangerousTool('g916_schema_break');
    registerTools([tool]);
    const ctx = makeCtx(() => Promise.resolve(true));
    const r = await executeToolCall(
      { name: 'g916_schema_break', arguments: { command: 'original-cmd' } },
      ctx,
    );
    // 不执行:窗不弹、handler 不跑
    expect(seenArgsOf(ctx)).toEqual([]);
    expect(executed).toEqual([]);
    expect(r.success).toBe(false);
    expect(r.errorType).toBe('invalid_arguments');
    // 错误带 hook 上下文:钩子名 + violations(不是裸 schema error)
    expect(r.error).toContain('g916-schema-break');
    expect(r.error).toContain('violations');
    expect(r.error).toContain('command');
  });

  it('③ 反向锁:allow + modify 并存 ⇒ 取 modify,回确认窗,不沿用改前 allow', async () => {
    writeHookConfig([
      {
        name: 'g916-allow-first',
        command: nodeEval(`process.stdout.write(JSON.stringify({decision:'allow'}))`),
        matchTool: 'g916_reverse_lock',
      },
      {
        name: 'g916-modify-second',
        command: nodeEval(
          `process.stdout.write(JSON.stringify({decision:'modify',modifiedInput:{command:'evil-cmd'}}))`,
        ),
        matchTool: 'g916_reverse_lock',
      },
    ]);
    const { tool, executed } = makeDangerousTool('g916_reverse_lock');
    registerTools([tool]);
    // 人在窗里拒绝 ⇒ 整体被拒:若 allow 被沿用,窗根本不会弹
    const ctx = makeCtx(() => Promise.resolve(false));
    const r = await executeToolCall({ name: 'g916_reverse_lock', arguments: { command: 'original-cmd' } }, ctx);
    // 回确认窗(且窗里是改后输入)—— 这就是"不得沿用改前 allow"的机器可判证据
    expect(seenArgsOf(ctx)).toEqual([{ command: 'evil-cmd' }]);
    expect(r.success).toBe(false);
    expect(r.errorType).toBe('permission_denied');
    expect(r.error).toContain('危险操作被拒绝');
    expect(executed).toEqual([]);
  });

  it('③ 补:待判格④如实登记 —— 重判后仍须批 ⇒ 无静默放行,无渠道则拒', async () => {
    // 上游 permission-input-recheck.ts:71-83 对"重判得 ask"静默放行;我方无确认渠道 ⇒ 拒。
    writeHookConfig([
      {
        name: 'g916-modify-ask',
        command: nodeEval(
          `process.stdout.write(JSON.stringify({decision:'modify',modifiedInput:{command:'ask-cmd'}}))`,
        ),
        matchTool: 'g916_no_channel',
      },
    ]);
    const { tool, executed } = makeDangerousTool('g916_no_channel');
    registerTools([tool]);
    // 无 confirmDangerous 渠道(无头)⇒ 必须拒,不得静默放行
    const r = await executeToolCall(
      { name: 'g916_no_channel', arguments: { command: 'original-cmd' } },
      { workspacePath: '.' } as ToolContext,
    );
    expect(r.success).toBe(false);
    expect(r.errorType).toBe('permission_denied');
    expect(r.error).toContain('危险操作被拒绝');
    expect(executed).toEqual([]);
  });

  it('deny 协议:钩子明确说不 ⇒ 直接拒,reason 随错误串,窗不弹', async () => {
    writeHookConfig([
      {
        name: 'g916-deny',
        command: nodeEval(
          `process.stdout.write(JSON.stringify({decision:'deny',reason:'env is prod'}))`,
        ),
        matchTool: 'g916_deny_tool',
      },
    ]);
    const { tool, executed } = makeDangerousTool('g916_deny_tool');
    registerTools([tool]);
    const ctx = makeCtx(() => Promise.resolve(true));
    const r = await executeToolCall({ name: 'g916_deny_tool', arguments: { command: 'c' } }, ctx);
    expect(seenArgsOf(ctx)).toEqual([]);
    expect(executed).toEqual([]);
    expect(r.success).toBe(false);
    expect(r.errorType).toBe('permission_denied');
    expect(r.error).toContain('g916-deny');
    expect(r.error).toContain('env is prod');
  });

  it('allow 自动应答:钩子替人放行 ⇒ 窗不弹,按原输入执行(票意:测试环境自动 allow)', async () => {
    writeHookConfig([
      {
        name: 'g916-allow-auto',
        command: nodeEval(`process.stdout.write(JSON.stringify({decision:'allow'}))`),
        matchTool: 'g916_allow_tool',
      },
    ]);
    const { tool, executed } = makeDangerousTool('g916_allow_tool');
    registerTools([tool]);
    const ctx = makeCtx(() => {
      throw new Error('确认窗不应被弹出(hook allow 已替人应答)');
    });
    const r = await executeToolCall({ name: 'g916_allow_tool', arguments: { command: 'plain-cmd' } }, ctx);
    expect(seenArgsOf(ctx)).toEqual([]);
    expect(r.success).toBe(true);
    expect(executed).toEqual([{ command: 'plain-cmd' }]);
  });

  it('三态不混流:钩子非零退出(blockOnError 缺省 false)⇒ 无应答,落回人工窗', async () => {
    writeHookConfig([
      {
        name: 'g916-crash',
        command: nodeEval(`process.exit(2)`),
        matchTool: 'g916_crash_tool',
      },
    ]);
    const { tool, executed } = makeDangerousTool('g916_crash_tool');
    registerTools([tool]);
    // 失败既不折成 deny(拦死)也不折成 allow(放行)⇒ 回人工窗,人说了算
    const ctx = makeCtx(() => Promise.resolve(true));
    const r = await executeToolCall({ name: 'g916_crash_tool', arguments: { command: 'c' } }, ctx);
    expect(seenArgsOf(ctx).length).toBe(1);
    expect(r.success).toBe(true);
    expect(executed).toEqual([{ command: 'c' }]);
  });

  it('多钩子合并取最保守:allow + deny 并存 ⇒ deny 赢', async () => {
    writeHookConfig([
      {
        name: 'g916-merge-allow',
        command: nodeEval(`process.stdout.write(JSON.stringify({decision:'allow'}))`),
        matchTool: 'g916_merge_tool',
      },
      {
        name: 'g916-merge-deny',
        command: nodeEval(`process.stdout.write(JSON.stringify({decision:'deny',reason:'merge says no'}))`),
        matchTool: 'g916_merge_tool',
      },
    ]);
    const { tool, executed } = makeDangerousTool('g916_merge_tool');
    registerTools([tool]);
    const ctx = makeCtx(() => Promise.resolve(true));
    const r = await executeToolCall({ name: 'g916_merge_tool', arguments: { command: 'c' } }, ctx);
    expect(seenArgsOf(ctx)).toEqual([]);
    expect(r.success).toBe(false);
    expect(r.error).toContain('merge says no');
    expect(executed).toEqual([]);
  });

  it('无 permissionRequest 钩子 ⇒ 批准闸与改前逐字同形(人工窗照旧)', async () => {
    writeHookConfig([]);
    const { tool, executed } = makeDangerousTool('g916_no_hooks');
    registerTools([tool]);
    const ctx = makeCtx(() => Promise.resolve(true));
    const r = await executeToolCall({ name: 'g916_no_hooks', arguments: { command: 'c' } }, ctx);
    expect(seenArgsOf(ctx)).toEqual([{ command: 'c' }]);
    expect(r.success).toBe(true);
    expect(executed).toEqual([{ command: 'c' }]);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
