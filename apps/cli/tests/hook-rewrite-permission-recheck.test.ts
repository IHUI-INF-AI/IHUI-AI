// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-638:钩子改写参数后必须重过权限判定 —— 钉"钩子对 tool input 无改写通道"这一安全不变量。
 *
 * 票面:hook 对 tool input 的改写不得绕过已批准的授权面。落点 hooks 执行→权限链。
 *
 * 现读生产链的顺序(以 run_command 为准,tools/builtins.ts):
 *   ① gateCommandExecution(原 command) → ② ctx.confirmDangerous(原 args)=授权面
 *   → ③ runPreToolCall(只消费 proceed/reason) → ④ 用**原 command** 执行。
 * HookResult 只有 proceed/reason/terminal/feedback 四个承载字段 —— 钩子进程收到的是
 * IHUI_TOOL_INPUT 的 JSON **值拷贝**,它的 stdout/stderr 只进 feedback/reason 通道,
 * 没有任何字段能把"改写后的 input"送回执行链。因此"改写绕过授权"在结构上不存在。
 *
 * 本文件把这一不变量钉死(走真派生子进程的生产链,姿势同 hook-terminal-states.test.ts):
 *   ① 形态锁:HookResult 的键集 ⊆ 白名单,且不含任何改写语义键 —— 未来谁给 HookResult
 *     加 updatedInput/patchedArgs 之类字段,这条立刻红,提醒他必须同步实现"改写 ⇒ 权限链
 *     重跑"(授权面批准的是原 args,换了 input 就得重新批准);
 *   ② 输出只进 feedback:钩子主动输出"改写后的 input"JSON,断言它只能作为不可信文本进
 *     feedback,返回值上没有任何字段承载该结构;
 *   ③ 阻断路径同形:非零退出的 reason 同样只是成形文本,无 input 承载;
 *   ④ runHook 通用分发同锁。
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runPreToolCall, runHook } from '../src/hooks/index.js';

// ROOT = 仓库根(tests 在 apps/cli/tests 下),临时面统一落 §15/§26 批准的 .ihui-agent/tmp
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const TMP = fs.mkdtempSync(path.join(ROOT, '.ihui-agent', 'tmp', 'hook-rewrite-perm-'));
const CONFIG = path.join(TMP, 'hooks.json');

/** HookResult 的合法承载字段白名单(与 src/hooks/index.ts 的接口同源,此处是运行时投影) */
const HOOK_RESULT_ALLOWED_KEYS = new Set(['proceed', 'reason', 'terminal', 'feedback']);
/** 改写语义键的禁止形态:命中任何一个都意味着出现了"把 input 送回执行链"的通道 */
const REWRITE_KEY_RE = /(input|args|rewrite|patch|replace|updated)/i;

let origConfig: string | undefined;
let origTrust: string | undefined;

beforeAll(() => {
  origConfig = process.env.IHUI_HOOKS_CONFIG;
  origTrust = process.env.IHUI_TRUST_WORKSPACE;
  process.env.IHUI_HOOKS_CONFIG = CONFIG;
  // 非交互出口声明信任(与 hooks-lifecycle/hook-terminal-states 同一姿势);
  // 信任门自身的判定另有 tests/hooks-trust-gate.test.ts,本文件不重复它。
  process.env.IHUI_TRUST_WORKSPACE = '1';
});

afterAll(() => {
  if (origConfig === undefined) delete process.env.IHUI_HOOKS_CONFIG;
  else process.env.IHUI_HOOKS_CONFIG = origConfig;
  if (origTrust === undefined) delete process.env.IHUI_TRUST_WORKSPACE;
  else process.env.IHUI_TRUST_WORKSPACE = origTrust;
  fs.rmSync(TMP, { recursive: true, force: true });
});

function writeHookConfig(event: string, entries: Array<Record<string, unknown>>): void {
  fs.writeFileSync(CONFIG, JSON.stringify({ [event]: entries }), 'utf-8');
}

/** 原文抄 hook-terminal-states.test.ts 的 nodeEval 姿势(Windows 下去内层双引号) */
const nodeEval = (code: string): string => `"${process.execPath}" -e "${code.replace(/"/g, '')}"`;

/** 断言一个 HookResult 上不存在任何改写承载通道 */
function assertNoRewriteChannel(res: Record<string, unknown>): void {
  for (const key of Object.keys(res)) {
    expect(HOOK_RESULT_ALLOWED_KEYS.has(key), `HookResult 出现白名单外的键: ${key}`).toBe(true);
    expect(REWRITE_KEY_RE.test(key), `HookResult 出现改写语义键: ${key}`).toBe(false);
    // 白名单四字段全部是原始类型:任何对象/数组值都意味着结构化通道被打开
    expect(typeof res[key] === 'string' || typeof res[key] === 'boolean' || res[key] === undefined, `键 ${key} 携带非原始值(结构化通道?)`).toBe(true);
  }
}

describe('G-638 钩子改写通道不存在(安全不变量)', () => {
  it('① 形态锁:runPreToolCall 的返回键集 ⊆ 白名单,无改写语义键', () => {
    writeHookConfig('preToolCall', [
      { name: 'g638-exit0', command: 'cmd /c exit 0', matchTool: 'bash', blockOnError: true },
    ]);
    const originalArgs = { command: 'echo hi', cwd: TMP };
    const res = runPreToolCall('bash', originalArgs) as unknown as Record<string, unknown>;
    assertNoRewriteChannel(res);
    // 原参数对象不被调用改变(钩子链对 input 只读)
    expect(originalArgs).toEqual({ command: 'echo hi', cwd: TMP });
  });

  it('② 钩子输出"改写后的 input"JSON ⇒ 只进 feedback,无字段承载,proceed 不被改写', () => {
    // 钩子把收到的 IHUI_TOOL_INPUT 换成 pwned 版并写到 stdout —— 若存在回写通道,
    // 执行链就会拿到 command:'pwned'
    const code = `const got=JSON.parse(process.env.IHUI_TOOL_INPUT);process.stdout.write(JSON.stringify({command:'pwned-'+got.command}))`;
    writeHookConfig('preToolCall', [
      { name: 'g638-rewrite-attempt', command: nodeEval(code), matchTool: 'bash', blockOnError: true },
    ]);
    const res = runPreToolCall('bash', { command: 'echo hi' }) as unknown as Record<string, unknown>;
    assertNoRewriteChannel(res);
    // 钩子正常退出(0)⇒ proceed 语义不被它的输出文本影响
    expect(res.proceed).toBe(true);
    // 成功态下钩子 stdout 被整体丢弃:整个返回值上连 'pwned' 字样都不存在 ——
    // 改写意图无处承载(阻断/非阻断路径的承载出口见 ③:那是不可信文本通道,不是 input)
    expect(JSON.stringify(res)).not.toContain('pwned');
  });

  it('③ 阻断路径同形:非零退出的 reason 是成形文本,无 input 承载', () => {
    const code = `process.stdout.write(JSON.stringify({command:'pwned'}));process.exit(3)`;
    writeHookConfig('preToolCall', [
      { name: 'g638-block-attempt', command: nodeEval(code), matchTool: 'bash', blockOnError: true },
    ]);
    const res = runPreToolCall('bash', { command: 'echo hi' }) as unknown as Record<string, unknown>;
    assertNoRewriteChannel(res);
    expect(res.proceed).toBe(false);
    expect(typeof res.reason).toBe('string');
    // reason 只承载阻断事实,不携带结构化改写
    expect((res.reason as string).includes('g638-block-attempt')).toBe(true);
  });

  it('④ runHook 通用分发的 HookResult 同锁', () => {
    const code = `process.stdout.write(JSON.stringify({toolArgs:{command:'pwned'}}))`;
    writeHookConfig('postToolCall', [
      { name: 'g638-generic-attempt', command: nodeEval(code), blockOnError: false },
    ]);
    const res = runHook('postToolCall', {
      toolName: 'bash',
      toolArgs: { command: 'echo hi' },
      toolResult: 'ok',
    }) as unknown as Record<string, unknown>;
    assertNoRewriteChannel(res);
    expect(res.proceed).toBe(true);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
