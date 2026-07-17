/**
 * Skills 平面加载测试
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  loadSkills,
  formatSkillsForPrompt,
  findSkill,
  findRepoRoot,
  parseSkillDefinition,
  getAllowedTools,
  type Skill,
  type SkillFrontmatter,
  type SkillDefinition,
} from '../src/skills/index.js';

describe('Skills 平面加载', () => {
  let tmpDir: string;
  let tmpHome: string;
  let origHome: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-skills-test-'));
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-skills-home-'));
    // Windows 下 os.homedir() 优先 USERPROFILE,Unix 用 HOME,两者都设
    origHome = process.env.HOME ?? '';
    process.env.HOME = tmpHome;
    process.env.USERPROFILE = tmpHome;
    // 初始化 git 仓库以支持 findRepoRoot
    fs.mkdirSync(path.join(tmpDir, '.git'), { recursive: true });
  });

  afterEach(() => {
    process.env.HOME = origHome;
    delete process.env.USERPROFILE;
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  function writeSkill(dir: string, name: string, content: string): void {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${name}.md`), content, 'utf-8');
  }

  it('空目录返回空数组', () => {
    const skills = loadSkills({ cwd: tmpDir });
    expect(skills).toEqual([]);
  });

  it('加载 .ihui/skills/*.md', () => {
    writeSkill(path.join(tmpDir, '.ihui', 'skills'), 'review-code', '# Review\n检查代码质量');
    const skills = loadSkills({ cwd: tmpDir });
    expect(skills).toHaveLength(1);
    expect(skills[0]!.name).toBe('review-code');
    expect(skills[0]!.body).toContain('检查代码质量');
  });

  it('加载 .claude/skills/*.md(Claude Code 兼容)', () => {
    writeSkill(path.join(tmpDir, '.claude', 'skills'), 'my-claude-skill', 'Claude skill');
    const skills = loadSkills({ cwd: tmpDir });
    expect(skills).toHaveLength(1);
    expect(skills[0]!.name).toBe('my-claude-skill');
  });

  it('加载 .cursor/skills/*.md(Cursor 兼容)', () => {
    writeSkill(path.join(tmpDir, '.cursor', 'skills'), 'my-cursor-skill', 'Cursor skill');
    const skills = loadSkills({ cwd: tmpDir });
    expect(skills).toHaveLength(1);
    expect(skills[0]!.name).toBe('my-cursor-skill');
  });

  it('加载 .agents/skills/*.md', () => {
    writeSkill(path.join(tmpDir, '.agents', 'skills'), 'my-agent-skill', 'Agent skill');
    const skills = loadSkills({ cwd: tmpDir });
    expect(skills).toHaveLength(1);
    expect(skills[0]!.name).toBe('my-agent-skill');
  });

  it('加载 ~/.ihui/skills/*.md(用户全局)', () => {
    writeSkill(path.join(tmpHome, '.ihui', 'skills'), 'global-skill', 'Global skill');
    const skills = loadSkills({ cwd: tmpDir });
    expect(skills).toHaveLength(1);
    expect(skills[0]!.name).toBe('global-skill');
  });

  it('优先级:CWD .ihui 覆盖 ~/.ihui 同名 skill', () => {
    writeSkill(path.join(tmpDir, '.ihui', 'skills'), 'shared', 'Local version');
    writeSkill(path.join(tmpHome, '.ihui', 'skills'), 'shared', 'Global version');
    const skills = loadSkills({ cwd: tmpDir });
    expect(skills).toHaveLength(1);
    expect(skills[0]!.body).toBe('Local version');
  });

  it('优先级:CWD .ihui 覆盖 CWD .claude 同名 skill', () => {
    writeSkill(path.join(tmpDir, '.ihui', 'skills'), 'shared', 'IHUI version');
    writeSkill(path.join(tmpDir, '.claude', 'skills'), 'shared', 'Claude version');
    const skills = loadSkills({ cwd: tmpDir });
    expect(skills).toHaveLength(1);
    expect(skills[0]!.body).toBe('IHUI version');
  });

  it('解析 frontmatter description', () => {
    const content = `---
description: 一句话描述
---
正文内容`;
    writeSkill(path.join(tmpDir, '.ihui', 'skills'), 'with-meta', content);
    const skills = loadSkills({ cwd: tmpDir });
    expect(skills[0]!.description).toBe('一句话描述');
    expect(skills[0]!.body).toBe('正文内容');
  });

  it('无 frontmatter 时 description 取首行', () => {
    writeSkill(path.join(tmpDir, '.ihui', 'skills'), 'no-meta', '第一行内容\n第二行');
    const skills = loadSkills({ cwd: tmpDir });
    expect(skills[0]!.description).toBe('第一行内容');
    expect(skills[0]!.body).toBe('第一行内容\n第二行');
  });

  it('忽略下划线开头的文件', () => {
    writeSkill(path.join(tmpDir, '.ihui', 'skills'), '_internal', 'internal');
    writeSkill(path.join(tmpDir, '.ihui', 'skills'), 'public', 'public');
    const skills = loadSkills({ cwd: tmpDir });
    expect(skills).toHaveLength(1);
    expect(skills[0]!.name).toBe('public');
  });

  it('忽略非 .md 文件', () => {
    fs.mkdirSync(path.join(tmpDir, '.ihui', 'skills'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.ihui', 'skills', 'readme.txt'), 'text');
    fs.writeFileSync(path.join(tmpDir, '.ihui', 'skills', 'valid.md'), 'valid');
    const skills = loadSkills({ cwd: tmpDir });
    expect(skills).toHaveLength(1);
    expect(skills[0]!.name).toBe('valid');
  });

  it('按 name 字母排序', () => {
    writeSkill(path.join(tmpDir, '.ihui', 'skills'), 'zebra', 'z');
    writeSkill(path.join(tmpDir, '.ihui', 'skills'), 'apple', 'a');
    writeSkill(path.join(tmpDir, '.ihui', 'skills'), 'mango', 'm');
    const skills = loadSkills({ cwd: tmpDir });
    expect(skills.map((s) => s.name)).toEqual(['apple', 'mango', 'zebra']);
  });

  it('formatSkillsForPrompt 返回空字符串当无 skills', () => {
    expect(formatSkillsForPrompt([])).toBe('');
  });

  it('formatSkillsForPrompt 包含 skill 名和内容', () => {
    const skills: Skill[] = [
      { name: 'review', source: '/path', description: 'desc', body: 'Review body', priority: 0 },
    ];
    const result = formatSkillsForPrompt(skills);
    expect(result).toContain('review');
    expect(result).toContain('Review body');
  });

  it('findSkill 按 name 查找', () => {
    const skills: Skill[] = [
      { name: 'a', source: '', description: '', body: '', priority: 0 },
      { name: 'b', source: '', description: '', body: '', priority: 0 },
    ];
    expect(findSkill(skills, 'a')?.name).toBe('a');
    expect(findSkill(skills, 'c')).toBeUndefined();
  });

  it('findRepoRoot 找到含 .git 的目录', () => {
    const sub = path.join(tmpDir, 'sub', 'deep');
    fs.mkdirSync(sub, { recursive: true });
    expect(findRepoRoot(sub)).toBe(tmpDir);
  });

  it('findRepoRoot 无 .git 时返回 cwd', () => {
    const noGit = fs.mkdtempSync(path.join(os.tmpdir(), 'no-git-'));
    try {
      const sub = path.join(noGit, 'sub');
      fs.mkdirSync(sub, { recursive: true });
      expect(findRepoRoot(sub)).toBe(path.resolve(sub));
    } finally {
      fs.rmSync(noGit, { recursive: true, force: true });
    }
  });

  it('repoRoot 不同时同时扫描 cwd 和 repoRoot', () => {
    // tmpDir 是 repoRoot(含 .git)
    const cwd = path.join(tmpDir, 'packages', 'cli');
    fs.mkdirSync(cwd, { recursive: true });
    // 在 repoRoot 放 skill
    writeSkill(path.join(tmpDir, '.ihui', 'skills'), 'repo-skill', 'repo');
    // 在 cwd 放 skill
    writeSkill(path.join(cwd, '.ihui', 'skills'), 'cwd-skill', 'cwd');
    const skills = loadSkills({ cwd });
    const names = skills.map((s) => s.name).sort();
    expect(names).toContain('repo-skill');
    expect(names).toContain('cwd-skill');
  });

  // ===== frontmatter 补全测试(对齐 grok-build Skills 规范)=====

  it('frontmatter 完整解析(name+description+allowed-tools+tools+model+tags 全字段)', () => {
    const content = `---
name: full-skill
description: 完整字段测试
allowed-tools:
  - tool-a
  - tool-b
tools: ["tool-c", "tool-d"]
model: gpt-5
tags: [coding, review]
---
正文内容`;
    writeSkill(path.join(tmpDir, '.ihui', 'skills'), 'file-name', content);
    const skills = loadSkills({ cwd: tmpDir });
    expect(skills).toHaveLength(1);
    const s = skills[0]!;
    expect(s.name).toBe('full-skill');
    expect(s.description).toBe('完整字段测试');
    expect(s.body).toBe('正文内容');
    expect(s.frontmatter).toBeDefined();
    expect(s.frontmatter!.name).toBe('full-skill');
    expect(s.frontmatter!.description).toBe('完整字段测试');
    expect(s.frontmatter!.allowedTools).toEqual(['tool-a', 'tool-b']);
    expect(s.frontmatter!.tools).toEqual(['tool-c', 'tool-d']);
    expect(s.frontmatter!.model).toBe('gpt-5');
    expect(s.frontmatter!.tags).toEqual(['coding', 'review']);
  });

  it('缺 name 字段时降级用 filename stem', () => {
    const content = `---
description: 有描述但无 name
---
正文`;
    writeSkill(path.join(tmpDir, '.ihui', 'skills'), 'fallback-name', content);
    const skills = loadSkills({ cwd: tmpDir });
    expect(skills[0]!.name).toBe('fallback-name');
    expect(skills[0]!.frontmatter?.name).toBeUndefined();
    expect(skills[0]!.frontmatter?.description).toBe('有描述但无 name');
  });

  it('frontmatter name 覆盖 filename stem', () => {
    const content = `---
name: custom-name
description: 自定义名
---
正文`;
    writeSkill(path.join(tmpDir, '.ihui', 'skills'), 'file-name', content);
    const skills = loadSkills({ cwd: tmpDir });
    expect(skills).toHaveLength(1);
    expect(skills[0]!.name).toBe('custom-name');
    expect(skills[0]!.source).toContain('file-name.md');
  });

  it('allowed-tools 与 tools 字段合并(向后兼容,去重)', () => {
    const content = `---
name: merge-test
allowed-tools: [tool-a, tool-b]
tools: [tool-b, tool-c]
---
正文`;
    writeSkill(path.join(tmpDir, '.ihui', 'skills'), 'merge-test', content);
    const skills = loadSkills({ cwd: tmpDir });
    const merged = getAllowedTools(skills[0]!.frontmatter);
    expect(merged.sort()).toEqual(['tool-a', 'tool-b', 'tool-c']);
  });

  it('getAllowedTools 对 undefined frontmatter 返回空数组', () => {
    expect(getAllowedTools(undefined)).toEqual([]);
  });

  it('getAllowedTools 仅 tools 字段(向后兼容)', () => {
    const fm: SkillFrontmatter = { tools: ['x', 'y'] };
    expect(getAllowedTools(fm)).toEqual(['x', 'y']);
  });

  it('空 frontmatter 块正常加载', () => {
    const content = `---
---
正文内容`;
    writeSkill(path.join(tmpDir, '.ihui', 'skills'), 'empty-meta', content);
    const skills = loadSkills({ cwd: tmpDir });
    expect(skills).toHaveLength(1);
    expect(skills[0]!.name).toBe('empty-meta');
    expect(skills[0]!.body).toBe('正文内容');
    expect(skills[0]!.frontmatter).toEqual({});
  });

  it('无 frontmatter 块时 frontmatter 字段为 undefined', () => {
    writeSkill(path.join(tmpDir, '.ihui', 'skills'), 'no-meta', 'plain content');
    const skills = loadSkills({ cwd: tmpDir });
    expect(skills[0]!.frontmatter).toBeUndefined();
  });

  it('frontmatter 含无法识别字段时不报错(降级处理)', () => {
    const content = `---
unknown-field: value
broken: [unclosed bracket
|||garbage|||
name: valid-name
---
正文内容`;
    writeSkill(path.join(tmpDir, '.ihui', 'skills'), 'malformed', content);
    const skills = loadSkills({ cwd: tmpDir });
    expect(skills).toHaveLength(1);
    expect(skills[0]!.name).toBe('valid-name');
    expect(skills[0]!.body).toBe('正文内容');
    expect(skills[0]!.frontmatter?.name).toBe('valid-name');
  });

  it('frontmatter 未闭合时整体作为正文(无 frontmatter)', () => {
    const content = `---
name: unclosed
description: 没有闭合的 frontmatter
正文内容`;
    writeSkill(path.join(tmpDir, '.ihui', 'skills'), 'unclosed', content);
    const skills = loadSkills({ cwd: tmpDir });
    expect(skills).toHaveLength(1);
    expect(skills[0]!.name).toBe('unclosed');
    expect(skills[0]!.frontmatter).toBeUndefined();
  });

  it('frontmatter 数组支持引号和块格式', () => {
    const content = `---
name: array-test
allowed-tools:
  - "tool-a"
  - 'tool-b'
tags:
  - coding
  - testing
---
正文`;
    writeSkill(path.join(tmpDir, '.ihui', 'skills'), 'array-test', content);
    const skills = loadSkills({ cwd: tmpDir });
    expect(skills[0]!.frontmatter!.allowedTools).toEqual(['tool-a', 'tool-b']);
    expect(skills[0]!.frontmatter!.tags).toEqual(['coding', 'testing']);
  });

  it('frontmatter model 字段解析', () => {
    const content = `---
name: model-test
model: claude-opus-4
---
正文`;
    writeSkill(path.join(tmpDir, '.ihui', 'skills'), 'model-test', content);
    const skills = loadSkills({ cwd: tmpDir });
    expect(skills[0]!.frontmatter!.model).toBe('claude-opus-4');
  });

  it('只有 frontmatter 没有 body', () => {
    const content = `---
name: no-body
description: 只有元信息
---
`;
    writeSkill(path.join(tmpDir, '.ihui', 'skills'), 'no-body', content);
    const skills = loadSkills({ cwd: tmpDir });
    expect(skills).toHaveLength(1);
    expect(skills[0]!.name).toBe('no-body');
    expect(skills[0]!.description).toBe('只有元信息');
    expect(skills[0]!.body).toBe('');
  });

  it('多级目录扫描 + frontmatter name 优先级去重', () => {
    // 本地 file.md frontmatter name = shared
    // 全局 other.md frontmatter name = shared
    // 两者解析后 name 都是 shared,高优先级(本地)覆盖全局
    const localContent = `---
name: shared
description: local version
---
local body`;
    const globalContent = `---
name: shared
description: global version
---
global body`;
    writeSkill(path.join(tmpDir, '.ihui', 'skills'), 'file', localContent);
    writeSkill(path.join(tmpHome, '.ihui', 'skills'), 'other', globalContent);
    const skills = loadSkills({ cwd: tmpDir });
    expect(skills).toHaveLength(1);
    expect(skills[0]!.description).toBe('local version');
    expect(skills[0]!.body).toBe('local body');
  });

  it('parseSkillDefinition 返回完整 SkillDefinition 结构', () => {
    const content = `---
name: parsed
description: 测试 parseSkillDefinition
---
body content`;
    const def = parseSkillDefinition(content, '/abs/path/parsed.md');
    const expected: SkillDefinition = {
      filePath: '/abs/path/parsed.md',
      sourceDir: '/abs/path',
      frontmatter: { name: 'parsed', description: '测试 parseSkillDefinition' },
      content: 'body content',
      hasFrontmatter: true,
    };
    expect(def).toEqual(expected);
  });

  it('parseSkillDefinition 无 frontmatter 时 hasFrontmatter=false', () => {
    const def = parseSkillDefinition('plain content', '/x/y.md');
    expect(def.hasFrontmatter).toBe(false);
    expect(def.frontmatter).toEqual({});
    expect(def.content).toBe('plain content');
    expect(def.sourceDir).toBe('/x');
  });

  it('frontmatter 无 description 字段时降级用 body 截断', () => {
    const content = `---
name: empty-desc
---
body line 1`;
    writeSkill(path.join(tmpDir, '.ihui', 'skills'), 'empty-desc', content);
    const skills = loadSkills({ cwd: tmpDir });
    expect(skills[0]!.description).toBe('body line 1');
  });
});
