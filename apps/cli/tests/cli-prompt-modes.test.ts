// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest';
import type { Tool } from '../src/tools/index.js';
import {
  INTERACTION_MODES,
  WELCOME_MODES,
  parseInteractionMode,
  parseWelcomeMode,
  resolveModeProfile,
  type InteractionMode,
  type WelcomeMode,
} from '../src/prompts/mode-matrix.js';
import { PROMPT_FRAGMENTS, getPromptFragment, renderFragments } from '../src/prompts/fragments.js';
import { composeSystemPrompt, filterToolsByPolicy } from '../src/prompts/compose.js';

function makeTool(overrides: Partial<Tool> & Pick<Tool, 'name' | 'description'>): Tool {
  return {
    parameters: {},
    required: [],
    execute: async () => ({ success: true, output: 'ok' }),
    ...overrides,
  };
}

const READ = makeTool({ name: 'read_file', description: '读取文件', dangerLevel: 'read' });
const WRITE = makeTool({ name: 'write_file', description: '写入文件', dangerLevel: 'write' });
const DANGEROUS = makeTool({ name: 'run_command', description: '执行命令', dangerLevel: 'dangerous' });
const DEFERRED = makeTool({
  name: 'browser_navigate',
  description: '打开网页',
  parameters: { target_url: { type: 'string', description: '地址' } },
  dangerLevel: 'read',
});

describe('模式矩阵 mode-matrix', () => {
  it('5 × 3 组合全部可解析', () => {
    for (const welcome of WELCOME_MODES) {
      for (const interaction of INTERACTION_MODES) {
        const profile = resolveModeProfile(welcome, interaction);
        expect(profile.fragmentIds.length).toBeGreaterThan(0);
        expect(profile.fragmentIds.every((id) => Boolean(getPromptFragment(id)))).toBe(true);
      }
    }
  });

  it('quick 工具面清空且不注入计划段', () => {
    const profile = resolveModeProfile('code', 'quick');
    expect(profile.toolPolicy.mode).toBe('none');
    expect(profile.planFirst).toBe(false);
  });

  it('ask 为只读', () => {
    const profile = resolveModeProfile('code', 'ask');
    expect(profile.toolPolicy.mode).toBe('read-only');
    expect(profile.planFirst).toBe(false);
  });

  it('plan 为只读 + 强制规划', () => {
    const profile = resolveModeProfile('work', 'plan');
    expect(profile.toolPolicy.mode).toBe('plan');
    expect(profile.planFirst).toBe(true);
  });

  it('craft / expert 为全量工具', () => {
    expect(resolveModeProfile('design', 'craft').toolPolicy.mode).toBe('all');
    expect(resolveModeProfile('design', 'expert').toolPolicy.mode).toBe('all');
  });

  it('非法 / 未知组合 fail-closed 抛错', () => {
    expect(() => resolveModeProfile('nope', 'craft')).toThrow(/welcome/i);
    expect(() => resolveModeProfile('code', 'nope')).toThrow(/interaction/i);
    expect(() => resolveModeProfile('', '')).toThrow();
    expect(() => parseWelcomeMode('robot')).toThrow();
    expect(() => parseInteractionMode('turbo')).toThrow();
  });

  it('parse 对未设置值返回 undefined', () => {
    expect(parseWelcomeMode(undefined)).toBeUndefined();
    expect(parseInteractionMode('')).toBeUndefined();
    expect(parseWelcomeMode('design')).toBe('design');
    expect(parseInteractionMode('expert')).toBe('expert');
  });
});

describe('提示片段 fragments', () => {
  it('每段 id 唯一且正文非空', () => {
    const ids = new Set<string>();
    for (const fragment of PROMPT_FRAGMENTS) {
      expect(fragment.id.trim()).not.toBe('');
      expect(ids.has(fragment.id)).toBe(false);
      ids.add(fragment.id);
      expect(fragment.title.trim()).not.toBe('');
      expect(fragment.body.trim().length).toBeGreaterThan(0);
    }
    expect(PROMPT_FRAGMENTS.length).toBeGreaterThanOrEqual(4);
    expect(PROMPT_FRAGMENTS.length).toBeLessThanOrEqual(6);
  });

  it('未知片段 id 抛错', () => {
    expect(() => getPromptFragment('fragment_missing')).toThrow(/未知提示片段/);
  });

  it('renderFragments 按顺序拼接', () => {
    const text = renderFragments(['fragment_tool_discipline', 'fragment_interaction_style']);
    expect(text).toContain('## 工具使用纪律');
    expect(text).toContain('## 交互风格');
  });
});

describe('composeSystemPrompt', () => {
  const allTools = [READ, WRITE, DANGEROUS, DEFERRED];

  it('quick 清空工具面(提示里没有任何工具 schema)', () => {
    const prompt = composeSystemPrompt({ welcome: 'code', interaction: 'quick', tools: allTools });
    expect(prompt).not.toContain('### read_file');
    expect(prompt).not.toContain('### write_file');
    expect(prompt).not.toContain('### run_command');
    expect(prompt).not.toContain('## 延迟工具目录(按需检索)');
    // 片段仍然注入(quick 只保留交互风格)。
    expect(prompt).toContain('## 交互风格');
    expect(prompt).not.toContain('## 任务推进');
  });

  it('ask 只剩 read 级工具', () => {
    const prompt = composeSystemPrompt({ welcome: 'code', interaction: 'ask', tools: allTools });
    expect(prompt).toContain('### read_file');
    expect(prompt).not.toContain('### write_file');
    expect(prompt).not.toContain('### run_command');
  });

  it('plan 注入规划段', () => {
    const prompt = composeSystemPrompt({ welcome: 'work', interaction: 'plan', tools: allTools });
    expect(prompt).toContain('## 任务推进');
    expect(prompt.toLowerCase()).toContain('plan');
  });

  it('filterToolsByPolicy 与矩阵语义一致', () => {
    expect(filterToolsByPolicy(allTools, { mode: 'all' })).toHaveLength(4);
    expect(filterToolsByPolicy(allTools, { mode: 'read-only' }).map((t) => t.name)).toEqual([
      'read_file',
      'browser_navigate',
    ]);
    expect(filterToolsByPolicy(allTools, { mode: 'none' })).toHaveLength(0);
    expect(
      filterToolsByPolicy(allTools, { mode: 'read-only', extraAllowed: ['write_file'] }).map((t) => t.name),
    ).toContain('write_file');
  });

  it('延迟工具只在目录出现,revealed 后回到常驻', () => {
    const prompt = composeSystemPrompt({ welcome: 'code', interaction: 'craft', tools: allTools });
    expect(prompt).not.toContain('### browser_navigate');
    expect(prompt).toContain('- browser_navigate —');
    const revealedPrompt = composeSystemPrompt({
      welcome: 'code',
      interaction: 'craft',
      tools: allTools,
      revealed: new Set(['browser_navigate']),
    });
    expect(revealedPrompt).toContain('### browser_navigate');
  });

  it('5 × 3 组合都能装配出非空 prompt', () => {
    const welcomes: WelcomeMode[] = [...WELCOME_MODES];
    const interactions: InteractionMode[] = [...INTERACTION_MODES];
    for (const welcome of welcomes) {
      for (const interaction of interactions) {
        const prompt = composeSystemPrompt({ welcome, interaction, tools: allTools });
        expect(prompt.length).toBeGreaterThan(100);
      }
    }
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
