// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * MCP 工具同名冲突对账(2026-09-28 拍板:**只加冲突检测,不改工具名**)。
 *
 * 病灶:`registerTool` 原来是 `registry.set(name, tool)` —— 两台 MCP 服务器都暴露
 * `web_search` 时,后注册者把先注册者**静默顶掉**:调用悄悄跑到另一台机器上,
 * 而 `--disallowed-tools` 也没法按服务器表达(它记的是裸名)。
 * 症状不是报错,是"结果莫名其妙",属最难归因那一型。
 *
 * 三例分别钉:跨归属必须拒收并点名双方 / 同归属重连刷新**必须**仍允许(否则修一个
 * 静默覆盖,换来一个"旧连接对象永驻",更糟)/ 内建与 MCP 相撞同样拒。
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

import { registerTools, getTool, getToolRegistrationConflicts } from '../src/tools/index.js';
import type { Tool } from '../src/tools/index.js';

function fakeTool(name: string, owner: string | undefined, marker: string): Tool {
  return {
    name,
    description: `fake ${marker}`,
    parameters: {},
    required: [],
    registrationOwner: owner,
    async execute(): Promise<{ success: boolean; output: string }> {
      return { success: true, output: marker };
    },
  } as Tool;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('同名工具注册', () => {
  it('两台 MCP 服务器同名 ⇒ 后到者被拒、保留先到者、冲突里点名双方', () => {
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    const name = `zz_collide_mcp_${Date.now()}`;

    registerTools([fakeTool(name, 'mcp:alpha', 'alpha-v1')]);
    registerTools([fakeTool(name, 'mcp:beta', 'beta-v1')]);

    expect(getTool(name)?.description).toBe('fake alpha-v1');
    const conflicts = getToolRegistrationConflicts().join('\n');
    expect(conflicts).toContain(name);
    expect(conflicts).toContain('mcp:alpha');
    expect(conflicts).toContain('mcp:beta');
    // 必须当场喊出来:只塞进清单不发声,等于下一个没人会去读的登记表
    expect(warn).toHaveBeenCalled();
  });

  it('同一台服务器重连后刷新 ⇒ 必须允许覆盖(不能把修复变成"旧对象永驻")', () => {
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    const name = `zz_refresh_mcp_${Date.now()}`;

    registerTools([fakeTool(name, 'mcp:gamma', 'gamma-old')]);
    const before = getToolRegistrationConflicts().length;
    registerTools([fakeTool(name, 'mcp:gamma', 'gamma-new')]);

    expect(getTool(name)?.description).toBe('fake gamma-new');
    // 清单是进程级累计的(它是诊断台账,不是本用例的私有状态)⇒ 判"本名字零新增",不判"清单为空"
    expect(getToolRegistrationConflicts()).toHaveLength(before);
    expect(getToolRegistrationConflicts().join('\n')).not.toContain(name);
    expect(warn).not.toHaveBeenCalled();
  });

  it('内建与 MCP 同名 ⇒ 同样拒收,并把内建一侧标成 builtin 而不是空名', () => {
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    const name = `zz_collide_builtin_${Date.now()}`;

    registerTools([fakeTool(name, undefined, 'builtin-owner')]);
    registerTools([fakeTool(name, 'mcp:delta', 'delta-v1')]);

    expect(getTool(name)?.description).toBe('fake builtin-owner');
    const conflicts = getToolRegistrationConflicts().join('\n');
    expect(conflicts).toContain('由 builtin 注册');
    expect(conflicts).toContain('mcp:delta');
    expect(warn).toHaveBeenCalled();
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
