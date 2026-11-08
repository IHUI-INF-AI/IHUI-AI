// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * P1 证据缺口补齐:此前只改了源码、没有夹具的 CLI 条目。
 *
 * 逐条口径:
 *   - F-069 读侧:行为级 —— `manifest.name` 是源仓可控串,`readPluginManifest` 必须在
 *     路径派生之前 fail-closed(旧码只判"非空字符串",返回 `..`)。
 *   - F-047 / F-062 / F-087 / F-003:结构锁。四条判的都是"某个接线点存在与否"
 *     (capability allow 项 / ws error+maxPayload / LSP exit 监听可注销 / 杀树接线),
 *     行为级要拉起真实 ws 超限帧、真实 language server 与孙进程,成本与收益不匹配;
 *     结构锁在旧码上同样必红(判据就是旧码缺的那一行),足以证明必要性。
 *   - F-097 行为级:中央 preToolCall 闸由 executeToolCall 统一派发,不依赖工具体自觉。
 *     钩子执行器本身被 mock(外部边界),断言的是"执行入口有没有接线"。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28

import { readPluginManifest } from '../src/plugins/installer.js';
import {
  clearTools,
  executeToolCall,
  registerTools,
  resetRateLimiter,
  type Tool,
  type ToolSchema,
} from '../src/tools/index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../..');

function readSrc(rel: string): string {
  return fs.readFileSync(path.resolve(HERE, rel), 'utf-8');
}

// ==================== F-069 读侧:manifest.name 必须在路径派生之前被拒 ====================

describe('F-069 manifest.name 是源仓可控串:读清单即拒,不等到拼路径', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkScratch('f069-manifest-');
  });

  afterEach(() => {
    rmScratch(dir);
  });

  it.each(['..', '../victim', 'a/b', 'C:\\Windows\\evil'])('非法 name %s ⇒ 读清单就抛错(不返回可拼路径的名字)', (name) => {
    fs.writeFileSync(path.join(dir, 'plugin.json'), JSON.stringify({ name, version: '1.0.0' }), 'utf-8');
    expect(() => readPluginManifest(dir)).toThrow(/非法字符/);
  });

  it('合法 name 原样返回(不误伤正常插件)', () => {
    fs.writeFileSync(path.join(dir, 'plugin.json'), JSON.stringify({ name: 'good-plugin' }), 'utf-8');
    expect(readPluginManifest(dir)).toEqual({ name: 'good-plugin', version: undefined });
  });
});

// ==================== F-047 capability 允许项 ====================

describe('F-047 take_pending_tray_actions 必须进 capability(否则托盘动作永不送达)', () => {
  it('capabilities/default.json 的 allow 清单含 allow-take-pending-tray-actions', () => {
    const capability = JSON.parse(readSrc('../../desktop/src-tauri/capabilities/default.json')) as {
      permissions?: string[];
    };
    expect(capability.permissions ?? []).toContain('allow-take-pending-tray-actions');
  });

  it('该命令本身在 Tauri 命令清单里登记(allow 项不是指向虚空)', () => {
    expect(readSrc('../../desktop/src-tauri/src/lib.rs')).toContain('take_pending_tray_actions');
  });
});

// ==================== F-062 WS 连接必须有 error 监听 + 帧上限 ====================

describe('F-062 WS 单连接:error 必须有人接,帧必须有上限', () => {
  const src = readSrc('../src/server/ws-bridge.ts');

  it("连接上注册了 ws.on('error')(旧码只有 message/close,error 直冲 uncaughtException)", () => {
    expect(src).toMatch(/ws\.on\('error'/);
  });

  it('WsServer 显式设 maxPayload(默认 100MiB 单帧可白吃进程内存)', () => {
    expect(src).toMatch(/maxPayload:\s*WS_MAX_PAYLOAD_BYTES/);
    expect(src).toMatch(/WS_MAX_PAYLOAD_BYTES\s*=\s*4\s*\*\s*1024\s*\*\s*1024/);
  });
});

// ==================== F-087 LSP exit 监听可注销 + 回收走杀树 ====================

describe('F-087 LSP 重启不叠加 exit 监听、失败/释放走进程树回收', () => {
  const src = readSrc('../src/tools/lsp.ts');

  it('exit 监听是一次性的且挂前先注销上一份(旧码每重启永久 +1)', () => {
    expect(src).toMatch(/process\.once\('exit',\s*this\.exitHandler\)/);
    expect(src).toMatch(/unregisterExitHandler\(\)/);
  });

  it('回收走 killProcessTreeSync(旧码只 child.kill,孙进程留下)', () => {
    expect(src).toMatch(/killProcessTreeSync\(this\.child\)/);
  });
});

// ==================== F-003 进程树回收接线 ====================

describe('F-003 杀进程树接线:终端降级路径与后台任务都要团灭', () => {
  it('terminal.ts 的降级 shell kill 走 killProcessTree(child)', () => {
    expect(readSrc('../src/tools/terminal.ts')).toMatch(/killProcessTree\(child\)/);
  });

  it('background-registry.ts 的 killTask 在 win32 用 taskkill /T /F(旧码只 kill 直系)', () => {
    const src = readSrc('../src/tools/background-registry.ts');
    expect(src).toMatch(/taskkill'?,\s*\['\/pid'?/);
    expect(src).toMatch(/'\/T'?,\s*'\/F'?/);
  });
});

// ==================== F-097 中央钩子派发 ====================

const hookSpies = vi.hoisted(() => ({
  runPreToolCall: vi.fn(async (..._args: unknown[]) => ({
    proceed: false,
    terminal: 'blocked' as const,
    feedback: '',
    reason: 'central-pre-blocked',
  })),
  runPostToolCall: vi.fn(async (..._args: unknown[]) => ({
    proceed: true,
    terminal: 'succeeded' as const,
    feedback: '',
  })),
}));

vi.mock('../src/hooks/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/hooks/index.js')>();
  return {
    ...actual,
    runPreToolCall: hookSpies.runPreToolCall,
    runPostToolCall: hookSpies.runPostToolCall,
    shouldDispatchCentralPostHook: () => true,
  };
});

const F097_SCHEMA: ToolSchema = {
  name: 'f097_probe_tool',
  description: '',
  parameters: { type: 'object', properties: { a: { type: 'string', description: '' } } },
};

const f097Tool: Tool = {
  name: F097_SCHEMA.name,
  description: '',
  parameters: F097_SCHEMA.parameters.properties,
  required: [],
  dangerLevel: 'read',
  // 工具体内**不**调用任何钩子:旧码正是靠这份"自觉"漏掉 read/list/grep/subagent/MCP。
  execute: async () => ({ success: true, output: 'fixture-ran' }),
};

describe('F-097 中央 preToolCall 闸:任意注册工具都过一遍,不靠工具体自觉', () => {
  beforeEach(() => {
    clearTools();
    resetRateLimiter();
    registerTools([f097Tool]);
    hookSpies.runPreToolCall.mockClear();
    hookSpies.runPostToolCall.mockClear();
  });

  it('preToolCall 返回阻断 ⇒ 工具不执行,结果被改写成 permission_denied', async () => {
    const result = await executeToolCall(
      { name: F097_SCHEMA.name, arguments: { a: '1' } },
      { workspacePath: process.cwd() },
    );
    expect(result.success).toBe(false);
    expect(result.errorType).toBe('permission_denied');
    expect(result.output).toBe('');
    expect(hookSpies.runPreToolCall).toHaveBeenCalledTimes(1);
    expect(hookSpies.runPreToolCall.mock.calls[0]?.[0]).toBe(F097_SCHEMA.name);
  });

  it('工具体内没派发 postToolCall ⇒ 中央补发一次(旧码该工具完全不进钩子链)', async () => {
    hookSpies.runPreToolCall.mockResolvedValueOnce({
      proceed: true,
      terminal: 'succeeded',
      feedback: '',
    });
    const result = await executeToolCall(
      { name: F097_SCHEMA.name, arguments: { a: '1' } },
      { workspacePath: process.cwd() },
    );
    expect(result.success).toBe(true);
    expect(result.output).toBe('fixture-ran');
    expect(hookSpies.runPostToolCall).toHaveBeenCalledTimes(1);
    expect(hookSpies.runPostToolCall.mock.calls[0]).toEqual([
      F097_SCHEMA.name,
      { success: true, output: 'fixture-ran', error: undefined },
      undefined,
    ]);
  });
});
