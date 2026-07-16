/**
 * Skills 平面加载测试
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { loadSkills, formatSkillsForPrompt, findSkill, findRepoRoot, type Skill } from '../src/skills/index.js';

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
});
