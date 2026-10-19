// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 票 L5669① —— 两级渐进披露(目录进提示、正文按名拉、超预算降级)+ 技能前置门 428。
//
// 成对口径:渐进披露技能"目录在、正文不在",eager 兄弟"正文照旧进";前置门"满足放行、
// 缺失回稳定码 428",缺一边都不算判据生效。
import { describe, it, expect, afterEach } from 'vitest';
import { formatSkillsForPrompt, type Skill } from '../src/skills/index.js';
import {
  checkSkillPrerequisites,
  findSessionSkill,
  isSkillLoaded,
  resetLoadedSkills,
  setSkillCatalog,
} from '../src/skills/session.js';
import { SKILL_TOOLS, SKILL_PRECONDITION_ERROR_TYPE } from '../src/tools/skill-tool.js';

function mkSkill(name: string, body: string, extra: Partial<Skill> = {}): Skill {
  return { name, source: `/abs/${name}.md`, description: `${name} desc`, body, priority: 0, ...extra };
}

describe('两级渐进披露:目录进提示,正文按名拉', () => {
  afterEach(() => setSkillCatalog([]));

  it('progressiveDisclosure:true ⇒ 正文不进提示,目录(名+描述+路径)在', () => {
    const prompt = formatSkillsForPrompt([
      mkSkill('lazy', 'LAZY-BODY-TEXT', { frontmatter: { progressiveDisclosure: true } }),
    ]);
    expect(prompt).toContain('lazy');
    expect(prompt).toContain('lazy desc');
    expect(prompt).toContain('path: /abs/lazy.md');
    expect(prompt).toContain('Skill tool');
    expect(prompt).not.toContain('LAZY-BODY-TEXT');
  });

  it('eager 兄弟的正文照旧直接注入(零回归)', () => {
    const prompt = formatSkillsForPrompt([
      mkSkill('lazy', 'LAZY-BODY', { frontmatter: { progressiveDisclosure: true } }),
      mkSkill('eager', 'EAGER-BODY-TEXT'),
    ]);
    expect(prompt).toContain('EAGER-BODY-TEXT');
    expect(prompt).not.toContain('LAZY-BODY');
    expect(prompt).toContain('lazy');
  });

  it('未标旗的既有技能行为逐字不变(正文进段)', () => {
    const prompt = formatSkillsForPrompt([mkSkill('legacy', 'LEGACY-BODY-TEXT')]);
    expect(prompt).toContain('LEGACY-BODY-TEXT');
  });

  it('目录超预算降级为仅名字+路径(丢描述)', () => {
    const many = Array.from({ length: 60 }, (_, i) =>
      mkSkill(`lazy-${i}`, `BODY-${i}`, {
        description: 'x'.repeat(200),
        frontmatter: { progressiveDisclosure: true },
      }),
    );
    const prompt = formatSkillsForPrompt(many);
    // 降级档:描述被丢掉,只剩 名字 + path
    expect(prompt).not.toContain('x'.repeat(200));
    expect(prompt).toContain('path: /abs/lazy-0.md');
    expect(prompt).toContain('lazy-0');
  });
});

describe('前置门 428:未满足前置条件回稳定码,满足则放行', () => {
  afterEach(() => setSkillCatalog([]));

  const tool = SKILL_TOOLS[0]!;

  it('未知技能 ⇒ skill_not_found,并列出目录', async () => {
    setSkillCatalog([mkSkill('known', 'body')]);
    const res = await tool.execute({ name: 'nope' }, {} as never);
    expect(res.success).toBe(false);
    expect(res.errorType).toBe('skill_not_found');
    expect(res.error).toContain('known');
  });

  it('前置环境变量缺失 ⇒ 428 稳定码 + errorType', async () => {
    setSkillCatalog([
      mkSkill('need-env', 'NEED-ENV-BODY', {
        frontmatter: { prerequisites: { env: ['IHUI_NO_SUCH_VAR_428_TEST'] } },
      }),
    ]);
    const res = await tool.execute({ name: 'need-env' }, {} as never);
    expect(res.success).toBe(false);
    expect(res.errorType).toBe(SKILL_PRECONDITION_ERROR_TYPE);
    expect(res.error).toContain('[428 Precondition Required]');
    expect(res.error).toContain('IHUI_NO_SUCH_VAR_428_TEST');
    expect(isSkillLoaded('need-env')).toBe(false);
  });

  it('前置满足 ⇒ 放行并标记已加载,幂等返回', async () => {
    setSkillCatalog([mkSkill('ready', 'READY-BODY-TEXT')]);
    const first = await tool.execute({ name: 'ready' }, {} as never);
    expect(first.success).toBe(true);
    expect(first.output).toContain('READY-BODY-TEXT');
    expect(isSkillLoaded('ready')).toBe(true);
    const second = await tool.execute({ name: 'ready' }, {} as never);
    expect(second.success).toBe(true);
    expect(second.output).toContain('READY-BODY-TEXT');
  });

  it('compaction 重置已加载标记 ⇒ 须重新过门', () => {
    setSkillCatalog([mkSkill('r', 'b')]);
    expect(findSessionSkill('r')?.name).toBe('r');
    resetLoadedSkills();
    expect(isSkillLoaded('r')).toBe(false);
  });

  it('checkSkillPrerequisites:命令与环境变量缺失分别点名(可注入探测)', () => {
    const skill = mkSkill('p', 'b', {
      frontmatter: { prerequisites: { commands: ['missing-cli'], env: ['MISSING_ENV'] } },
    });
    const missing = checkSkillPrerequisites(
      skill,
      { MISSING_ENV: '' },
      { exists: () => false },
    );
    expect(missing.commands).toEqual(['missing-cli']);
    expect(missing.env).toEqual(['MISSING_ENV']);
  });

  it('checkSkillPrerequisites:命令在位 + 环境非空 ⇒ 无缺失', () => {
    const skill = mkSkill('p', 'b', {
      frontmatter: { prerequisites: { commands: ['curl'], env: ['HAS_ENV'] } },
    });
    const missing = checkSkillPrerequisites(
      skill,
      { HAS_ENV: 'v', PATH: '/usr/bin' },
      { exists: () => true },
    );
    expect(missing.commands).toEqual([]);
    expect(missing.env).toEqual([]);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
