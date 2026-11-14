// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-097:工具钩子必须由统一执行入口(executeToolCall)全局派发,而不是靠各工具体自觉
 * 调用 runPreToolCall/runPostToolCall。
 *
 * 本册用**真实钩子链**(临时 hooks.json + 真派生子进程写 marker)钉四格:
 *  ① 读取类 / 子代理 / MCP 这类体内完全没有钩子调用的工具,pre 与 post 各恰好一次;
 *  ② 体内已显式 opt-in 的工具,不会因为中央派发而触发两次(一次且仅一次);
 *  ③ run_command 在 hooks.json 里的历史名字 "bash" 仍能命中(matchTool 语义不被改名破坏);
 *  ④ pre 钩子阻断 ⇒ 工具不执行、post 一条都不发(拒绝语义与现状一致)。
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  clearTools,
  executeToolCall,
  registerTools,
  resetRateLimiter,
  type Tool,
  type ToolSchema,
} from '../src/tools/index.js';
import { runPostToolCall, runPreToolCall } from '../src/hooks/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const TMP = fs.mkdtempSync(path.join(ROOT, '.ihui-agent', 'tmp', 'f097-hook-dispatch-'));
const CONFIG = path.join(TMP, 'hooks.json');
const PRE_MARKER = path.join(TMP, 'pre.log');
const POST_MARKER = path.join(TMP, 'post.log');

let origConfig: string | undefined;
let origTrust: string | undefined;

/** 与 hook-rewrite-permission-recheck 同一姿势:Windows 下去内层双引号。 */
const nodeEval = (code: string): string => `"${process.execPath}" -e "${code.replace(/"/g, '')}"`;

function markerCommand(marker: string): string {
  const target = marker.replace(/\\/g, '/');
  return nodeEval(`require('fs').appendFileSync('${target}', 'hit\\n')`);
}

function writeHooks(config: Record<string, unknown>): void {
  fs.writeFileSync(CONFIG, JSON.stringify(config), 'utf-8');
}

function hookLines(marker: string): number {
  if (!fs.existsSync(marker)) return 0;
  return fs
    .readFileSync(marker, 'utf-8')
    .split('\n')
    .filter((line) => line.length > 0).length;
}

function resetMarkers(): void {
  fs.rmSync(PRE_MARKER, { force: true });
  fs.rmSync(POST_MARKER, { force: true });
}

function makeTool(name: string, execute: Tool['execute']): Tool {
  const schema: ToolSchema = {
    name,
    description: '',
    parameters: { type: 'object', properties: {}, required: [] },
  };
  return {
    name,
    description: '',
    parameters: schema.parameters.properties,
    dangerLevel: 'read',
    execute,
  };
}

beforeAll(() => {
  origConfig = process.env.IHUI_HOOKS_CONFIG;
  origTrust = process.env.IHUI_TRUST_WORKSPACE;
  process.env.IHUI_HOOKS_CONFIG = CONFIG;
  // 非交互出口声明信任(信任门自身另有用例,本册不重复)。
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
  resetMarkers();
});

describe('F-097 中央派发覆盖', () => {
  it('① 读取类 / 子代理 / MCP 工具体内零钩子调用 ⇒ pre/post 各恰好一次', async () => {
    writeHooks({
      preToolCall: [{ name: 'f097-pre', command: markerCommand(PRE_MARKER) }],
      postToolCall: [{ name: 'f097-post', command: markerCommand(POST_MARKER) }],
    });
    const names = ['read_file', 'dispatch_subagent', 'mcp__demo__read'];
    for (const name of names) {
      registerTools([makeTool(name, async () => ({ success: true, output: `${name}-body` }))]);
    }
    for (const name of names) {
      const r = await executeToolCall({ name, arguments: {} }, { workspacePath: TMP });
      expect(r.success).toBe(true);
    }
    expect(hookLines(PRE_MARKER)).toBe(3);
    expect(hookLines(POST_MARKER)).toBe(3);
  });

  it('② 工具体内已 opt-in ⇒ 不因中央派发而双触发', async () => {
    writeHooks({
      preToolCall: [{ name: 'f097-pre', command: markerCommand(PRE_MARKER) }],
      postToolCall: [{ name: 'f097-post', command: markerCommand(POST_MARKER) }],
    });
    let executed = 0;
    registerTools([
      makeTool('optin_probe', async () => {
        executed += 1;
        // 旧写法:工具体自己接线。中央派发存在时,这两次调用必须被折成"已派发"。
        await runPreToolCall('optin_probe', { probe: 1 });
        await runPostToolCall('optin_probe', { summaryOnly: true });
        return { success: true, output: 'optin-body' };
      }),
    ]);
    const r = await executeToolCall({ name: 'optin_probe', arguments: {} }, { workspacePath: TMP });
    expect(r.success).toBe(true);
    expect(executed).toBe(1);
    expect(hookLines(PRE_MARKER)).toBe(1);
    expect(hookLines(POST_MARKER)).toBe(1);
  });

  it('③ run_command 的历史钩子名 "bash" 仍命中 matchTool', async () => {
    writeHooks({
      preToolCall: [{ name: 'f097-bash', command: markerCommand(PRE_MARKER), matchTool: 'bash' }],
    });
    registerTools([makeTool('run_command', async () => ({ success: true, output: 'fake-run' }))]);
    const r = await executeToolCall(
      { name: 'run_command', arguments: { command: 'echo probe' } },
      { workspacePath: TMP },
    );
    expect(r.success).toBe(true);
    expect(hookLines(PRE_MARKER)).toBe(1);
  });

  it('④ pre 阻断 ⇒ 工具不执行,post 一条都不发', async () => {
    writeHooks({
      preToolCall: [
        { name: 'f097-deny', command: nodeEval('process.exit(1)'), matchTool: 'blocked_probe' },
      ],
      postToolCall: [{ name: 'f097-post', command: markerCommand(POST_MARKER) }],
    });
    let executed = 0;
    registerTools([
      makeTool('blocked_probe', async () => {
        executed += 1;
        return { success: true, output: 'should-not-run' };
      }),
    ]);
    const r = await executeToolCall({ name: 'blocked_probe', arguments: {} }, { workspacePath: TMP });
    expect(r.success).toBe(false);
    expect(r.errorType).toBe('permission_denied');
    expect(executed).toBe(0);
    expect(hookLines(POST_MARKER)).toBe(0);
  });
});
