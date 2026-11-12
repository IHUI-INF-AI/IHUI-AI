// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 受限工具集 profile(code-mode)。
 *
 * 钉四件事:
 *   ① **拼错的模式名必须报错**,不静默回落全量(否则最危险的默认值给了以为自己被限制的人);
 *   ② read-only 真的挡住写/执行;
 *   ③ no-shell 真的挡住执行类;
 *   ④ blocked 列表要返回(上层能回答"为什么某工具不见了")。
 */
import { describe, expect, it } from 'vitest';

import {
  CODE_MODES,
  CodeModeError,
  applyCodeMode,
  describeCodeMode,
  isToolAllowed,
  resolveCodeMode,
} from '../src/tools/code-mode.js';
import type { Tool } from '../src/tools/index.js';

const mk = (name: string): Tool => ({ name, description: name, parameters: {}, execute: async () => ({ success: true, output: '' }) }) as unknown as Tool;

const TOOLS = [
  mk('read_file'),
  mk('grep'),
  mk('write_file'),
  mk('edit_file'),
  mk('run_command'),
  mk('bash'),
  mk('get_diagnostics'),
  mk('git'),
];

describe('resolveCodeMode', () => {
  it('缺省 ⇒ full', () => {
    expect(resolveCodeMode(undefined).id).toBe('full');
    expect(resolveCodeMode(null).id).toBe('full');
    expect(resolveCodeMode('').id).toBe('full');
  });

  it('合法名可解析', () => {
    for (const id of ['read-only', 'no-shell', 'review', 'full'] as const) {
      expect(resolveCodeMode(id).id).toBe(id);
    }
  });

  it('拼错必须抛错,不得静默回退全量', () => {
    for (const bad of ['readonly', 'read_only', 'READ-ONLY', 'nonsense']) {
      expect(() => resolveCodeMode(bad)).toThrow(CodeModeError);
    }
  });
});

describe('applyCodeMode 裁剪', () => {
  it('full 不裁剪', () => {
    const r = applyCodeMode(TOOLS, 'full');
    expect(r.allowed).toHaveLength(TOOLS.length);
    expect(r.blocked).toHaveLength(0);
  });

  it('read-only 挡住写与执行', () => {
    const r = applyCodeMode(TOOLS, 'read-only');
    const names = r.allowed.map((t) => t.name);
    expect(names).toContain('read_file');
    expect(names).toContain('grep');
    expect(names).not.toContain('write_file');
    expect(names).not.toContain('edit_file');
    expect(names).not.toContain('run_command');
    expect(names).not.toContain('bash');
  });

  it('no-shell 挡住执行类但放行写', () => {
    const r = applyCodeMode(TOOLS, 'no-shell');
    const names = r.allowed.map((t) => t.name);
    expect(names).toContain('write_file');
    expect(names).not.toContain('run_command');
    expect(names).not.toContain('bash');
    expect(names).not.toContain('git');
  });

  it('review 与 read-only 都不含写/执行', () => {
    for (const mode of ['review', 'read-only'] as const) {
      const names = applyCodeMode(TOOLS, mode).allowed.map((t) => t.name);
      expect(names).not.toContain('write_file');
      expect(names).not.toContain('run_command');
    }
  });

  it('blocked 必须返回(能回答"为什么某工具不见了")', () => {
    const r = applyCodeMode(TOOLS, 'read-only');
    expect(r.blocked.length).toBeGreaterThan(0);
    expect(r.blocked).toContain('write_file');
  });

  it('allowed + blocked 恰好等于全集(不丢不重)', () => {
    for (const mode of ['read-only', 'no-shell', 'review', 'full'] as const) {
      const r = applyCodeMode(TOOLS, mode);
      expect(r.allowed.length + r.blocked.length).toBe(TOOLS.length);
      const union = new Set([...r.allowed.map((t) => t.name), ...r.blocked]);
      expect(union.size).toBe(TOOLS.length);
    }
  });

  it('拼错模式时 applyCodeMode 也抛错(不返回半裁剪结果)', () => {
    expect(() => applyCodeMode(TOOLS, 'typo')).toThrow(CodeModeError);
  });
});

describe('isToolAllowed', () => {
  it('白名单模式:未列出的工具一律不可用(失效方向=少给能力)', () => {
    const spec = CODE_MODES['read-only'];
    expect(isToolAllowed(spec, 'read_file')).toBe(true);
    // 新工具（未来加的）默认不可用
    expect(isToolAllowed(spec, 'brand_new_tool_2027')).toBe(false);
  });

  it('full:未知工具也放行', () => {
    expect(isToolAllowed(CODE_MODES.full, 'brand_new_tool_2027')).toBe(true);
  });

  it('no-shell:执行类被排除,其它放行', () => {
    const spec = CODE_MODES['no-shell'];
    expect(isToolAllowed(spec, 'run_command')).toBe(false);
    expect(isToolAllowed(spec, 'bash')).toBe(false);
    expect(isToolAllowed(spec, 'write_file')).toBe(true);
  });
});

describe('describeCodeMode', () => {
  it('full 说不限制', () => {
    expect(describeCodeMode(CODE_MODES.full)).toContain('不限制');
  });

  it('白名单模式报出允许数量', () => {
    const s = describeCodeMode(CODE_MODES['read-only']);
    expect(s).toContain('read-only');
    expect(s).toMatch(/\d+ 个工具可用/);
  });
});
