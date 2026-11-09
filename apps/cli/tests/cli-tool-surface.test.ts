// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest';
import { buildSystemPrompt, type Tool } from '../src/tools/index.js';
import { shouldDeferTool } from '../src/tools/defer-policy.js';
import {
  buildToolSurface,
  renderStablePrefix,
  renderToolSchema,
} from '../src/tools/tool-surface.js';
import { createToolSearchTool, searchTools } from '../src/tools/tool-search.js';

function makeTool(overrides: Partial<Tool> & Pick<Tool, 'name' | 'description'>): Tool {
  return {
    parameters: {},
    required: [],
    execute: async () => ({ success: true, output: 'ok' }),
    ...overrides,
  };
}

const READ_FILE = makeTool({
  name: 'read_file',
  description: '读取文件内容',
  parameters: { path: { type: 'string', description: '相对路径' } },
  required: ['path'],
  dangerLevel: 'read',
});

const BROWSER_NAVIGATE = makeTool({
  name: 'browser_navigate',
  description: '打开网页并返回页面快照',
  parameters: { target_url: { type: 'string', description: '目标地址' } },
  required: ['target_url'],
  dangerLevel: 'read',
});

const BROWSER_CLICK = makeTool({
  name: 'browser_page_click',
  description: '点击页面上的按钮',
  parameters: { selector_text: { type: 'string', description: '按钮文本' } },
  required: ['selector_text'],
  dangerLevel: 'write',
});

const GIT_SAFE_STATUS = makeTool({
  name: 'git_status',
  description: '查看工作区状态',
  dangerLevel: 'read',
});

const DEBUG_LAUNCH = makeTool({
  name: 'debug_launch',
  description: '启动调试会话',
  parameters: { program_path: { type: 'string', description: '可执行文件' } },
  dangerLevel: 'dangerous',
});

const GH_PULL = makeTool({
  name: 'gh_create_pull',
  description: '在 GitHub 上创建 PR',
  parameters: { head_branch: { type: 'string', description: '源分支' } },
  dangerLevel: 'write',
});

describe('延迟策略 defer-policy', () => {
  it('危险级工具永不默认延迟', () => {
    expect(shouldDeferTool('debug_launch', DEBUG_LAUNCH)).toBe(false);
  });

  it('高频核心工具保持常驻', () => {
    expect(shouldDeferTool('read_file', READ_FILE)).toBe(false);
    expect(shouldDeferTool('git_status', GIT_SAFE_STATUS)).toBe(false);
  });

  it('低频族按前缀命中,已揭示后回到常驻', () => {
    expect(shouldDeferTool('gh_create_pull', GH_PULL)).toBe(true);
    expect(shouldDeferTool('browser_navigate', BROWSER_NAVIGATE)).toBe(true);
    expect(shouldDeferTool('browser_navigate', BROWSER_NAVIGATE, new Set(['browser_navigate']))).toBe(false);
  });

  it('deferLoading=false 的工具强制常驻', () => {
    expect(shouldDeferTool('gh_create_pull', { ...GH_PULL, deferLoading: false })).toBe(false);
  });
});

describe('工具面切分 tool-surface', () => {
  it('catalogueText 只有名字与一句话描述,不含参数 schema', () => {
    const surface = buildToolSurface([READ_FILE, BROWSER_NAVIGATE, BROWSER_CLICK], {});
    expect(surface.deferred.map((t) => t.name)).toEqual(['browser_navigate', 'browser_page_click']);
    expect(surface.catalogueText).toContain('browser_navigate');
    expect(surface.catalogueText).toContain('browser_page_click');
    expect(surface.catalogueText).not.toContain('参数:');
    expect(surface.catalogueText).not.toContain('target_url');
    expect(surface.catalogueText).not.toContain('selector_text');
  });

  it('revealed 命中的工具回到 promptTools', () => {
    const surface = buildToolSurface([READ_FILE, BROWSER_NAVIGATE], {
      revealed: new Set(['browser_navigate']),
    });
    expect(surface.deferred).toHaveLength(0);
    expect(surface.promptTools.map((t) => t.name)).toContain('browser_navigate');
  });

  it('tool_search 自身不可延迟', () => {
    const search = createToolSearchTool({ revealed: new Set<string>(), tools: () => [] });
    const surface = buildToolSurface([search]);
    expect(surface.deferred).toHaveLength(0);
    expect(surface.promptTools.map((t) => t.name)).toEqual(['tool_search']);
  });
});

describe('稳定前缀 buildSystemPrompt', () => {
  it('仅延迟项变化时,前缀字节一致', () => {
    const common: Tool[] = [READ_FILE, GIT_SAFE_STATUS];
    const promptA = buildSystemPrompt(common, 'ctx');
    const promptB = buildSystemPrompt([...common, GH_PULL], 'ctx');
    const prefix = renderStablePrefix();
    expect(promptA.startsWith(prefix)).toBe(true);
    expect(promptB.startsWith(prefix)).toBe(true);
    // 稳定前缀之后、`## 可用工具` 之前(上下文段)也应逐字一致。
    const headA = promptA.slice(0, promptA.indexOf('## 可用工具'));
    const headB = promptB.slice(0, promptB.indexOf('## 可用工具'));
    expect(headA).toBe(headB);
  });

  it('延迟工具的完整参数行不出现在 prompt,只出现在目录', () => {
    const prompt = buildSystemPrompt([READ_FILE, BROWSER_NAVIGATE], 'ctx');
    expect(prompt).toContain('## 可用工具');
    expect(prompt).toContain('### read_file');
    expect(prompt).not.toContain('### browser_navigate');
    expect(prompt).not.toContain('target_url: string');
    expect(prompt).toContain('## 延迟工具目录(按需检索)');
    expect(prompt).toContain('- browser_navigate —');
    expect(prompt).toContain('tool_search');
  });

  it('revealed 工具在下一份 prompt 中恢复完整 schema', () => {
    const prompt = buildSystemPrompt([READ_FILE, BROWSER_NAVIGATE], 'ctx', false, {
      revealed: new Set(['browser_navigate']),
    });
    expect(prompt).toContain('### browser_navigate');
    expect(prompt).toContain('target_url: string');
    expect(prompt).not.toContain('## 延迟工具目录(按需检索)');
  });
});

describe('tool_search', () => {
  const catalogue = [READ_FILE, BROWSER_NAVIGATE, BROWSER_CLICK, GIT_SAFE_STATUS];

  it('按 description 子串命中', () => {
    const hits = searchTools(catalogue, ['点击页面'], [], 5);
    expect(hits.map((h) => h.tool.name)).toEqual(['browser_page_click']);
  });

  it('tool_names 精确命中优先', () => {
    const hits = searchTools(catalogue, ['读取'], ['read_file'], 5);
    expect(hits[0]?.tool.name).toBe('read_file');
  });

  it('top_k 截断结果', () => {
    const hits = searchTools(catalogue, ['工具', '页面', '文件', '状态'], [], 2);
    expect(hits).toHaveLength(2);
  });

  it('空结果列出可检索的延迟工具名', async () => {
    const search = createToolSearchTool({
      revealed: new Set<string>(),
      tools: () => [READ_FILE, BROWSER_NAVIGATE, GH_PULL, DEBUG_LAUNCH],
    });
    const result = await search.execute({ queries: ['完全不存在的词xyz'] }, { workspacePath: '.' });
    expect(result.success).toBe(true);
    expect(result.output).toContain('未命中任何工具');
    expect(result.output).toContain('browser_navigate');
    expect(result.output).toContain('gh_create_pull');
    // 危险工具不在可检索延迟名单里(它本来就常驻)。
    expect(result.output).not.toContain('debug_launch');
  });

  it('命中后返回完整 schema 并写入 revealed', async () => {
    const revealed = new Set<string>();
    const search = createToolSearchTool({ revealed, tools: () => catalogue });
    const result = await search.execute({ queries: ['点击页面'] }, { workspacePath: '.' });
    expect(result.success).toBe(true);
    expect(result.output).toContain('### browser_page_click');
    expect(result.output).toContain('selector_text: string');
    expect(revealed.has('browser_page_click')).toBe(true);
    expect(revealed.has('read_file')).toBe(false);
  });

  it('未提供检索条件时列出延迟工具', async () => {
    const search = createToolSearchTool({ revealed: new Set<string>(), tools: () => [READ_FILE, GH_PULL] });
    const result = await search.execute({}, { workspacePath: '.' });
    expect(result.output).toContain('未提供检索条件');
    expect(result.output).toContain('gh_create_pull');
  });

  it('renderToolSchema 与 buildSystemPrompt 渲染同形', () => {
    expect(renderToolSchema(READ_FILE)).toContain('### read_file');
    expect(renderToolSchema(READ_FILE)).toContain('path: string (必填)');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
