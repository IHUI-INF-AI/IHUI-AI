// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 真实消费方:Skill 执行入口按模型能力画像选档。
 *
 * 三态闭环:full / reduced(功能降级但不报错)/ 拒绝(稳定 errorType + 原因原文)。
 * 另钉住 frontmatter `tiers` 的 inline JSON 解析与序列化往返(技能声明可落地到文件)。
 */
import { afterEach, describe, expect, it } from 'vitest';
import type { SkillCapabilityTiers } from '@ihui/types';
import { parseSkillDefinition, type Skill } from '../src/skills/index.js';
import { serializeSkillsFrontmatter } from '../src/skills/frontmatter.js';
import { setSkillCatalog } from '../src/skills/session.js';
import {
  MODEL_PROFILES_ENV,
  loadModelProfiles,
} from '../src/skills/model-capabilities.js';
import { SKILL_MODEL_PROFILE_MISSING, SKILL_MODEL_PROFILE_UNKNOWN, SKILL_TOOLS } from '../src/tools/skill-tool.js';

const tool = SKILL_TOOLS[0]!;

const tiers: SkillCapabilityTiers = {
  hard: { toolCalling: true },
  full: { requires: { vision: true, minContextWindow: 64_000 } },
  reduced: {
    requires: { minContextWindow: 16_000 },
    disabledFeatures: ['vision-caption'],
  },
};

function mkSkill(name: string, frontmatter: Skill['frontmatter'] = {}): Skill {
  return {
    name,
    source: `/abs/${name}.md`,
    description: `${name} desc`,
    body: `${name.toUpperCase()}-BODY`,
    priority: 0,
    frontmatter,
  };
}

afterEach(() => {
  setSkillCatalog([]);
  delete process.env[MODEL_PROFILES_ENV];
});

describe('Skill 执行入口的选档三态', () => {
  it('模型能力足够 → full,正文头部上报 tier 与 reason', async () => {
    setSkillCatalog([mkSkill('vision-skill', { tiers })]);
    const res = await tool.execute({ name: 'vision-skill', model: 'gpt-4o' }, {} as never);
    expect(res.success).toBe(true);
    expect(res.output).toContain('tier: full');
    expect(res.output).toContain('tier-reason:');
    expect(res.output).toContain('gpt-4o');
    expect(res.output).toContain('VISION-SKILL-BODY');
  });

  it('模型能力不足 → reduced(成功返回,带禁用功能清单)', async () => {
    setSkillCatalog([mkSkill('vision-skill', { tiers })]);
    const res = await tool.execute({ name: 'vision-skill', model: 'qwen3-coder' }, {} as never);
    expect(res.success).toBe(true);
    expect(res.output).toContain('tier: reduced');
    expect(res.output).toContain('degraded-features: vision-caption');
  });

  it('toolCalling=false 且技能硬性依赖工具 → 拒绝并给原因原文(反向例①)', async () => {
    process.env[MODEL_PROFILES_ENV] = JSON.stringify([
      {
        modelId: 'no-tools-model',
        contextWindow: 128_000,
        toolCalling: false,
        vision: true,
        structuredOutput: false,
        maxParallel: 1,
      },
    ]);
    setSkillCatalog([mkSkill('vision-skill', { tiers })]);
    const res = await tool.execute({ name: 'vision-skill', model: 'no-tools-model' }, {} as never);
    expect(res.success).toBe(false);
    expect(res.errorType).toBe('skill_capability_rejected');
    expect(res.error).toContain('no-tools-model');
    expect(res.error).toContain('toolCalling');
    expect(res.error).toContain('硬性能力要求未满足');
  });

  it('带 tiers 但未提供 model → 明确拒绝(不静默按 full 执行)', async () => {
    setSkillCatalog([mkSkill('vision-skill', { tiers })]);
    const res = await tool.execute({ name: 'vision-skill' }, {} as never);
    expect(res.success).toBe(false);
    expect(res.errorType).toBe(SKILL_MODEL_PROFILE_MISSING);
    expect(res.error).toContain('declares capability tiers');
  });

  it('model 画像未登记 → 明确拒绝,并提示配置入口', async () => {
    setSkillCatalog([mkSkill('vision-skill', { tiers })]);
    const res = await tool.execute({ name: 'vision-skill', model: 'unknown-model' }, {} as never);
    expect(res.success).toBe(false);
    expect(res.errorType).toBe(SKILL_MODEL_PROFILE_UNKNOWN);
    expect(res.error).toContain('unknown-model');
    expect(res.error).toContain(MODEL_PROFILES_ENV);
  });

  it('未声明 tiers 的既有技能行为不变(无 tier 行)', async () => {
    setSkillCatalog([mkSkill('plain-skill')]);
    const res = await tool.execute({ name: 'plain-skill', model: 'gpt-4o' }, {} as never);
    expect(res.success).toBe(true);
    expect(res.output).not.toContain('tier: ');
    expect(res.output).toContain('PLAIN-SKILL-BODY');
  });
});

describe('frontmatter tiers 声明(文件形态)', () => {
  it('inline JSON 声明可被解析进 frontmatter.tiers', () => {
    const content = [
      '---',
      'name: vision-skill',
      `tiers: ${JSON.stringify(tiers)}`,
      '---',
      'BODY',
    ].join('\n');
    const def = parseSkillDefinition(content, '/abs/vision-skill.md');
    expect(def.frontmatter.tiers).toEqual(tiers);
  });

  it('序列化 → 再解析 往返等值(幂等写不丢档位)', () => {
    const front = serializeSkillsFrontmatter({ name: 'vision-skill', tiers });
    const content = `---\n${front}\n---\nBODY`;
    const def = parseSkillDefinition(content, '/abs/vision-skill.md');
    expect(def.frontmatter.tiers).toEqual(tiers);
    expect(serializeSkillsFrontmatter(def.frontmatter)).toBe(front);
  });

  it('环境变量画像可覆盖内置项,非法条目逐条报错', () => {
    process.env[MODEL_PROFILES_ENV] = JSON.stringify([
      {
        modelId: 'gpt-4o',
        contextWindow: 8_000,
        toolCalling: true,
        vision: false,
        structuredOutput: false,
        maxParallel: 2,
      },
      { modelId: 'broken', contextWindow: 'nope' },
    ]);
    const { profiles, errors } = loadModelProfiles();
    expect(profiles.get('gpt-4o')!.contextWindow).toBe(8_000);
    expect(errors.join('|')).toContain('broken');
    expect(errors.join('|')).toContain('contextWindow');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
