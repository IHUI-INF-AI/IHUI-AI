/**
 * Skills 平面加载 — 四级目录扫描 + flat *.md → slash command。
 *
 * 灵感来源:grok-build 的 skills 加载机制(四级目录兼容 .grok/.agents/.claude/.cursor)。
 * 简化策略(做减法):
 *   - 只扫描 flat *.md 文件(不递归子目录),文件名(去扩展名)→ slash 命令名
 *   - 四级目录优先级:CWD > repo root > user home(高→低,前者覆盖后者同名 skill)
 *   - skills 内容注入 system prompt 的"项目上下文"段,让 LLM 按指令执行
 *   - 不实现 skill 嵌套引用/变量替换/条件加载(保持最小化)
 *
 * 目录结构(按优先级从高到低):
 *   <cwd>/.ihui/skills/*.md          — 项目本地(最高优先级)
 *   <cwd>/.agents/skills/*.md        — 通用 agent 社区
 *   <cwd>/.claude/skills/*.md        — Claude Code 兼容
 *   <cwd>/.cursor/skills/*.md        — Cursor 兼容
 *   <repo-root>/.ihui/skills/*.md    — 仓库根(从 cwd 向上找到 .git 止)
 *   ~/.ihui/skills/*.md              — 用户全局(最低优先级)
 *
 * Skill 文件格式:
 *   ---metadata(可选)---
 *   description: <一句话描述>
 *   ---
 *   <skill 内容,注入 system prompt>
 *
 * 加载后:
 *   - skill 名(文件名 stem)注册为 slash 命令(/skill <name> 展示内容)
 *   - 所有 skill 内容合并注入 system prompt(按优先级去重)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export interface Skill {
  /** skill 名(文件名 stem,如 "review-code") */
  name: string;
  /** 来源路径(绝对路径) */
  source: string;
  /** 描述(从 frontmatter 提取,缺省为首行注释) */
  description: string;
  /** skill 正文(去掉 frontmatter 后的内容) */
  body: string;
  /** 优先级序号(0 最高) */
  priority: number;
}

/** 四级扫描目录(按优先级从高到低) */
const SKILL_DIRS = [
  '.ihui/skills',
  '.agents/skills',
  '.claude/skills',
  '.cursor/skills',
];

/** 用户全局目录优先级最低 */
const USER_SKILL_DIR = '.ihui/skills';

export interface LoadSkillsOptions {
  /** 当前工作目录 */
  cwd: string;
  /** 仓库根目录(可选,缺省从 cwd 向上找 .git) */
  repoRoot?: string;
}

/**
 * 从 cwd 向上查找仓库根(含 .git 目录)。
 * 找不到则返回 cwd 本身。
 */
export function findRepoRoot(cwd: string): string {
  let current = path.resolve(cwd);
  for (let i = 0; i < 20; i++) {
    if (fs.existsSync(path.join(current, '.git'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return path.resolve(cwd);
}

/**
 * 解析 skill 文件内容,提取 frontmatter description 和 body。
 * 无 frontmatter 时 description 取首行非空文本(截断 80 字符)。
 */
function parseSkillContent(content: string): { description: string; body: string } {
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (frontmatterMatch) {
    const front = frontmatterMatch[1]!;
    const body = frontmatterMatch[2]!.trim();
    const descMatch = front.match(/^description:\s*(.+)$/m);
    return {
      description: descMatch ? descMatch[1]!.trim() : body.slice(0, 80),
      body,
    };
  }
  const trimmed = content.trim();
  const firstLine = trimmed.split('\n').find((l) => l.trim().length > 0) ?? '';
  return {
    description: firstLine.slice(0, 80),
    body: trimmed,
  };
}

/**
 * 扫描单个目录下的 flat *.md 文件,返回 Skill 数组。
 * 不递归子目录,只处理文件(非目录)。
 */
function scanDir(dir: string, priority: number): Skill[] {
  if (!fs.existsSync(dir)) return [];
  const skills: Skill[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.md')) continue;
    const name = entry.name.slice(0, -3);
    if (!name || name.startsWith('_')) continue;
    const fullPath = path.join(dir, entry.name);
    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const parsed = parseSkillContent(content);
      skills.push({
        name,
        source: fullPath,
        description: parsed.description,
        body: parsed.body,
        priority,
      });
    } catch {
      // 读取失败跳过
    }
  }
  return skills;
}

/**
 * 加载所有 skills,按优先级去重(同名 skill 高优先级覆盖低优先级)。
 *
 * 扫描顺序(优先级从高到低):
 *   0-3: <cwd>/.{ihui,agents,claude,cursor}/skills
 *   4-7: <repoRoot>/.{ihui,agents,claude,cursor}/skills(若 repoRoot !== cwd)
 *   8:   ~/.ihui/skills
 */
export function loadSkills(opts: LoadSkillsOptions): Skill[] {
  const cwd = path.resolve(opts.cwd);
  const repoRoot = opts.repoRoot ?? findRepoRoot(cwd);
  const home = os.homedir();

  const scanLocations: Array<{ dir: string; priority: number }> = [];

  let priority = 0;
  for (const sub of SKILL_DIRS) {
    scanLocations.push({ dir: path.join(cwd, sub), priority });
    priority++;
  }
  if (repoRoot !== cwd) {
    for (const sub of SKILL_DIRS) {
      scanLocations.push({ dir: path.join(repoRoot, sub), priority });
      priority++;
    }
  }
  scanLocations.push({ dir: path.join(home, USER_SKILL_DIR), priority });

  const all: Skill[] = [];
  for (const loc of scanLocations) {
    all.push(...scanDir(loc.dir, loc.priority));
  }

  // 按优先级去重(低 priority 值 = 高优先级,覆盖高 priority 值)
  const byName = new Map<string, Skill>();
  for (const s of all) {
    const existing = byName.get(s.name);
    if (!existing || s.priority < existing.priority) {
      byName.set(s.name, s);
    }
  }

  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * 把 skills 合并为 system prompt 注入段。
 * 每个 skill 用 ## 标题 + body 格式化。
 */
export function formatSkillsForPrompt(skills: Skill[]): string {
  if (skills.length === 0) return '';
  const parts: string[] = [`## Skills(${skills.length} 个)`];
  for (const s of skills) {
    parts.push(`### /skill ${s.name}\n${s.body}`);
  }
  return parts.join('\n\n');
}

/**
 * 按 name 查找单个 skill。
 */
export function findSkill(skills: Skill[], name: string): Skill | undefined {
  return skills.find((s) => s.name === name);
}
