/**
 * Skills 平面加载 — 四级目录扫描 + flat *.md → slash command。
 *
 * 灵感来源:cli 的 skills 加载机制(四级目录兼容 .grok/.agents/.claude/.cursor)。
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
 * Skill 文件格式(对齐 cli Skills frontmatter 规范):
 *   ---
 *   name: <skill 名>(可选,覆盖文件名 stem)
 *   description: <一句话描述>(可选)
 *   allowed-tools: [tool-a, tool-b](可选,工具白名单)
 *   tools: [tool-c](可选,等价于 allowed-tools,cli 兼容字段)
 *   model: <模型名>(可选)
 *   tags: [coding, review](可选,分类标签)
 *   ---
 *   <skill 内容,注入 system prompt>
 *
 * 加载后:
 *   - skill 名(frontmatter.name 或文件名 stem)注册为 slash 命令(/skill <name> 展示内容)
 *   - 所有 skill 内容合并注入 system prompt(按优先级去重)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

/** Skill frontmatter 元信息(对齐 cli Skills 规范) */
export interface SkillFrontmatter {
  /** skill 名(覆盖文件名 stem,缺省回退到文件名) */
  name?: string;
  /** 一句话描述 */
  description?: string;
  /** 工具白名单(可选,对应 frontmatter 的 allowed-tools) */
  allowedTools?: string[];
  /** 工具白名单(cli 兼容字段,等价于 allowedTools,对应 frontmatter 的 tools) */
  tools?: string[];
  /** 指定模型(可选) */
  model?: string;
  /** 分类标签(可选) */
  tags?: string[];
}

/** 解析后的 skill 定义(原始结构,含路径与 frontmatter) */
export interface SkillDefinition {
  /** 文件绝对路径 */
  filePath: string;
  /** 文件所在目录 */
  sourceDir: string;
  /** frontmatter 元信息(无 frontmatter 块时为空对象) */
  frontmatter: SkillFrontmatter;
  /** skill 正文(去掉 frontmatter 后的内容) */
  content: string;
  /** 是否存在 frontmatter 块(即使块内无字段也为 true) */
  hasFrontmatter: boolean;
}

export interface Skill {
  /** skill 名(frontmatter.name 或文件名 stem) */
  name: string;
  /** 来源路径(绝对路径) */
  source: string;
  /** 描述(从 frontmatter 提取,缺省为首行注释或正文截断) */
  description: string;
  /** skill 正文(去掉 frontmatter 后的内容) */
  body: string;
  /** 优先级序号(0 最高) */
  priority: number;
  /** frontmatter 元信息(无 frontmatter 块时为 undefined) */
  frontmatter?: SkillFrontmatter;
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

/** 从 frontmatter 文本中解析单值字段(支持引号包裹) */
function parseFrontmatterField(front: string, key: string): string | undefined {
  const re = new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm');
  const m = front.match(re);
  if (!m) return undefined;
  return m[1]!.replace(/^["']|["']$/g, '').trim();
}

/** 从 frontmatter 文本中解析数组字段(支持 inline [a,b,c] 和 block `- a\n- b`) */
function parseFrontmatterArray(front: string, key: string): string[] | undefined {
  const inlineRe = new RegExp(`^${key}:\\s*\\[([^\\]]*)\\]\\s*$`, 'm');
  const inlineMatch = front.match(inlineRe);
  if (inlineMatch) {
    return inlineMatch[1]!
      .split(',')
      .map((s) => s.trim().replace(/^["']|["']$/g, ''))
      .filter((s) => s.length > 0);
  }
  const blockRe = new RegExp(`^${key}:\\s*$\\n((?:[ \\t]*-\\s+.+\\n?)+)`, 'm');
  const blockMatch = front.match(blockRe);
  if (blockMatch) {
    return blockMatch[1]!
      .split('\n')
      .map((l) => l.match(/^[ \t]*-\s+(.+?)\s*$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => m[1]!.replace(/^["']|["']$/g, '').trim());
  }
  return undefined;
}

/** 解析 frontmatter 文本块为 SkillFrontmatter 对象(无法识别的内容跳过,不抛错) */
function parseFrontmatter(front: string): SkillFrontmatter {
  const fm: SkillFrontmatter = {};
  const name = parseFrontmatterField(front, 'name');
  if (name) fm.name = name;
  const description = parseFrontmatterField(front, 'description');
  if (description) fm.description = description;
  const allowedTools = parseFrontmatterArray(front, 'allowed-tools');
  if (allowedTools) fm.allowedTools = allowedTools;
  const tools = parseFrontmatterArray(front, 'tools');
  if (tools) fm.tools = tools;
  const model = parseFrontmatterField(front, 'model');
  if (model) fm.model = model;
  const tags = parseFrontmatterArray(front, 'tags');
  if (tags) fm.tags = tags;
  return fm;
}

/**
 * 解析 skill 文件内容为 SkillDefinition(含 frontmatter + 正文 + 路径信息)。
 * 无 frontmatter 块时 hasFrontmatter=false,frontmatter={},content=原文 trimmed。
 * frontmatter 解析失败(无法识别字段)时降级为空 frontmatter,不抛错。
 * 正则中 \n? 容忍空 frontmatter 块(---\n---\nbody)。
 */
export function parseSkillDefinition(content: string, filePath: string): SkillDefinition {
  const sourceDir = path.dirname(filePath);
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n?---\s*\n([\s\S]*)$/);
  if (frontmatterMatch) {
    const front = frontmatterMatch[1]!;
    const body = frontmatterMatch[2]!.trim();
    let frontmatter: SkillFrontmatter;
    try {
      frontmatter = parseFrontmatter(front);
    } catch {
      frontmatter = {};
    }
    return { filePath, sourceDir, frontmatter, content: body, hasFrontmatter: true };
  }
  return {
    filePath,
    sourceDir,
    frontmatter: {},
    content: content.trim(),
    hasFrontmatter: false,
  };
}

/**
 * 获取 skill 的有效工具白名单(合并 allowedTools 和 tools 字段并去重)。
 * 用于消费方读取合并后的工具列表,实现 allowed-tools 与 tools 的向后兼容。
 */
export function getAllowedTools(fm: SkillFrontmatter | undefined): string[] {
  if (!fm) return [];
  const set = new Set<string>();
  for (const t of fm.allowedTools ?? []) set.add(t);
  for (const t of fm.tools ?? []) set.add(t);
  return Array.from(set);
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
    const fileStem = entry.name.slice(0, -3);
    if (!fileStem || fileStem.startsWith('_')) continue;
    const fullPath = path.join(dir, entry.name);
    try {
      const raw = fs.readFileSync(fullPath, 'utf-8');
      const def = parseSkillDefinition(raw, fullPath);
      const fm = def.frontmatter;
      const name = fm.name ?? fileStem;
      let description: string;
      if (fm.description) {
        description = fm.description;
      } else if (def.hasFrontmatter) {
        description = def.content.slice(0, 80);
      } else {
        const firstLine = def.content.split('\n').find((l) => l.trim().length > 0) ?? '';
        description = firstLine.slice(0, 80);
      }
      const skill: Skill = {
        name,
        source: fullPath,
        description,
        body: def.content,
        priority,
      };
      if (def.hasFrontmatter) {
        skill.frontmatter = fm;
      }
      skills.push(skill);
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
