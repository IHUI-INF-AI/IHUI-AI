// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-125:postToolCall 必须拿到**真实输出**(脱敏 + 截断),后台任务必须在**完成时**派发。
 *
 * 钉四格:
 *  ① 中央派发载荷带工具真实输出,而不是摘要对象;
 *  ② 真实输出里的凭据进钩子环境变量前已脱敏;
 *  ③ 超长输出按码点截断且留可见标记(不静默变短);
 *  ④ 编辑类工具载荷仍带 path(内置安全扫描腿 F-038 依赖它),后台工具在启动点不派发、
 *     完成回调里再派发真实 stdout(推迟契约 + 结构锁)。
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
import {
  HOOK_TOOL_PAYLOAD_MAX_CHARS,
  markPostToolCallDeferred,
  runDeferredPostToolCall,
  runWithToolHookScope,
  shouldDispatchCentralPostHook,
} from '../src/hooks/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const TMP = fs.mkdtempSync(path.join(ROOT, '.ihui-agent', 'tmp', 'f125-post-output-'));
const CONFIG = path.join(TMP, 'hooks.json');
const OUT_FILE = path.join(TMP, 'tool-output.json');

let origConfig: string | undefined;
let origTrust: string | undefined;

const nodeEval = (code: string): string => `"${process.execPath}" -e "${code.replace(/"/g, '')}"`;

function captureCommand(): string {
  const target = OUT_FILE.replace(/\\/g, '/');
  return nodeEval(
    `require('fs').writeFileSync('${target}', process.env.IHUI_TOOL_OUTPUT || '')`,
  );
}

function writePostHook(matchTool?: string): void {
  fs.writeFileSync(
    CONFIG,
    JSON.stringify({
      postToolCall: [
        { name: 'f125-capture', command: captureCommand(), ...(matchTool ? { matchTool } : {}) },
      ],
    }),
    'utf-8',
  );
}

function readPayload(): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(OUT_FILE, 'utf-8')) as Record<string, unknown>;
}

function makeTool(name: string, output: string | (() => string)): Tool {
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
    execute: async () => ({
      success: true,
      output: typeof output === 'function' ? output() : output,
    }),
  };
}

beforeAll(() => {
  origConfig = process.env.IHUI_HOOKS_CONFIG;
  origTrust = process.env.IHUI_TRUST_WORKSPACE;
  process.env.IHUI_HOOKS_CONFIG = CONFIG;
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
  fs.rmSync(OUT_FILE, { force: true });
  writePostHook();
});

describe('F-125 post 载荷是真实输出', () => {
  it('① 中央派发拿到工具真实输出(而非摘要对象)', async () => {
    registerTools([makeTool('read_probe', 'REAL-CONTENT-42')]);
    const r = await executeToolCall({ name: 'read_probe', arguments: {} }, { workspacePath: TMP });
    expect(r.success).toBe(true);
    const payload = readPayload();
    expect(payload.success).toBe(true);
    expect(payload.output).toBe('REAL-CONTENT-42');
  });

  it('② 真实输出中的凭据在进钩子前已脱敏', async () => {
    const secret = 'sk-ant-abcdefghijklmnopqrstuvwxyz123456';
    registerTools([makeTool('secret_probe', `token=${secret}`)]);
    await executeToolCall({ name: 'secret_probe', arguments: {} }, { workspacePath: TMP });
    const output = String(readPayload().output);
    expect(output).not.toContain(secret);
    expect(output).toContain('REDACTED');
  });

  it('③ 超长输出截断并留可见标记', async () => {
    const long = `${'x'.repeat(HOOK_TOOL_PAYLOAD_MAX_CHARS + 500)}-TAIL`;
    registerTools([makeTool('long_probe', long)]);
    await executeToolCall({ name: 'long_probe', arguments: {} }, { workspacePath: TMP });
    const output = String(readPayload().output);
    expect(output.length).toBeLessThan(long.length);
    expect(output).toContain('[已截断');
    expect(output.includes('-TAIL')).toBe(false);
  });

  it('④ 编辑类工具载荷仍带 path(安全扫描腿可定位文件)', async () => {
    // 文件名不以凭据形态出现即可;安全扫描腿只会读文件,不阻断本用例的断言。
    registerTools([makeTool('write_file', '已写入 demo.txt')]);
    await executeToolCall(
      { name: 'write_file', arguments: { path: path.join(TMP, 'demo.txt'), content: 'hello' } },
      { workspacePath: TMP },
    );
    const payload = readPayload();
    // 钩子环境变量侧会对用户路径脱敏(可能变成 ~/...),但文件名必须仍在,扫描腿才定位得到。
    expect(String(payload.path)).toContain('demo.txt');
    expect(payload.output).toBe('已写入 demo.txt');
  });
});

describe('F-125 后台任务的派发时机', () => {
  it('⑤ 声明推迟后中央不在启动点派发;完成回调带真实输出派发一次', async () => {
    const centralWouldDispatch = await runWithToolHookScope(async () => {
      markPostToolCallDeferred();
      return shouldDispatchCentralPostHook();
    });
    expect(centralWouldDispatch).toBe(false);
    expect(fs.existsSync(OUT_FILE)).toBe(false);

    await runDeferredPostToolCall('bash', {
      background: true,
      taskId: 'bg_1',
      success: true,
      exitCode: 0,
      output: 'BG-REAL-STDOUT',
    });
    const payload = readPayload();
    expect(payload.output).toBe('BG-REAL-STDOUT');
    expect(payload.background).toBe(true);
  });

  it('⑥ 结构锁:builtins 在 handle.result 完成回调里派发,启动点不再直发', () => {
    const src = fs.readFileSync(path.join(ROOT, 'apps/cli/src/tools/builtins.ts'), 'utf-8');
    expect(src).toContain('markPostToolCallDeferred()');
    expect(src).toContain("runDeferredPostToolCall('bash', backgroundPostPayload(result, taskId))");
    expect(src).not.toContain("runPostToolCall('bash'");
  });
});
