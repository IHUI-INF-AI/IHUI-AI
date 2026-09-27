// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Skills 平面加载 — 四级目录扫描 + 两种形态 → slash command。
 *
 * 灵感来源:参考行业 Agent 框架的 skills 加载机制(四级目录兼容 .ihui/.agents/.claude/.cursor)。
 * 简化策略(做减法):
 *   - 收两种形态:平铺 `<root>/<name>.md`,以及目录包 `<root>/<name>/SKILL.md`(**只下钻一层**)
 *   - 四级目录优先级:CWD > repo root > user home(高→低,前者覆盖后者同名 skill)
 *   - skills 内容注入 system prompt 的"项目上下文"段,让 LLM 按指令执行
 *   - 不实现 skill 嵌套引用/变量替换/条件加载(保持最小化)
 *
 * 为什么必须有目录包形态(2026-09-27 补):`.agents/skills`、`.claude/skills`、`~/.ihui/skills`
 * 这三个我们自己声明的根,外部技能包实际就按 `<name>/SKILL.md` 落地;旧实现第一行
 * `if (!entry.isFile()) continue` 把目录整个跳过,于是"装了技能但列表里 0 个"且没有任何解释。
 *
 * 目录结构(按优先级从高到低;每根下「平铺 .md」与「目录包 <名>/SKILL.md」两种形态都收):
 *   <cwd>/.ihui/skills/*.md          — 项目本地(最高优先级)
 *   <cwd>/.agents/skills/*.md        — 通用 agent 社区
 *   <cwd>/.claude/skills/*.md        — Claude Code 兼容
 *   <cwd>/.cursor/skills/*.md        — Cursor 兼容
 *   <repo-root>/.ihui/skills/*.md    — 仓库根(从 cwd 向上找到 .git 止)
 *   ~/.ihui/skills/*.md              — 用户全局(最低优先级)
 *
 * Skill 文件格式(参考行业 Agent 框架的 Skills frontmatter 规范):
 *   ---
 *   name: <skill 名>(可选,覆盖文件名 stem)
 *   description: <一句话描述>(可选)
 *   allowed-tools: [tool-a, tool-b](可选,工具白名单)
 *   tools: [tool-c](可选,等价于 allowed-tools,行业兼容字段)
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
import { buildSkillPromptSection } from '../utils/prompt-boundary.js';
import { recordInjectionInjected, recordInjectionSkipped } from '../utils/prompt-injection-registry.js';
import * as os from 'node:os';
import type { SkillFrontmatter, SkillPrerequisites, SkillSource } from '@ihui/types';

/**
 * Skill frontmatter 元信息由 `@ihui/types` 统一维护(P0-2 对齐 packages/types 契约),
 * 此处 re-export 供现有消费方(../tests/skills.test.ts 等)按原路径 import。
 */
export type { SkillFrontmatter, SkillPrerequisites, SkillSource };

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

/** 按 multiple 候选 key(kebab/camel)解析单值字段,返回首个命中 */
function parseFrontmatterFieldAny(front: string, keys: string[]): string | undefined {
  for (const key of keys) {
    const v = parseFrontmatterField(front, key);
    if (v) return v;
  }
  return undefined;
}

/** 按 multiple 候选 key(kebab/camel)解析数组字段,返回首个命中且非空 */
function parseFrontmatterArrayAny(front: string, keys: string[]): string[] | undefined {
  for (const key of keys) {
    const v = parseFrontmatterArray(front, key);
    if (v && v.length > 0) return v;
  }
  return undefined;
}

/** 按 multiple 候选 key 解析布尔字段(true/yes→true,false/no→false),未命中返回 undefined */
function parseFrontmatterBool(front: string, keys: string[]): boolean | undefined {
  for (const key of keys) {
    const re = new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm');
    const m = front.match(re);
    if (m) {
      const v = m[1]!.trim().toLowerCase().replace(/^["']|["']$/g, '');
      if (v === 'true' || v === 'yes') return true;
      if (v === 'false' || v === 'no') return false;
    }
  }
  return undefined;
}

/** SkillSource 合法值(builtin/user/auto/hub),用于校验 frontmatter source 字段 */
const SKILL_SOURCE_VALUES: ReadonlySet<string> = new Set(['builtin', 'user', 'auto', 'hub']);

/** 把 inline 数组字面量 "a, b, c" 拆为 string[](去引号/trim/滤空) */
function splitArrayLiteral(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim().replace(/^["']|["']$/g, ''))
    .filter((s) => s.length > 0);
}

/** 把 block 数组文本("  - a\n  - b")拆为 string[](去引号/trim/滤空) */
function parseBlockArray(raw: string): string[] {
  return raw
    .split('\n')
    .map((l) => l.match(/^[ \t]*-\s+(.+?)\s*$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => m[1]!.replace(/^["']|["']$/g, '').trim());
}

/**
 * 解析 prerequisites 对象(支持嵌套块 + inline 两种写法)。
 *
 * 嵌套块(inline 数组):
 *   prerequisites:
 *     commands: [curl, jq]
 *     env: [GITHUB_TOKEN]
 *
 * 嵌套块(block 数组):
 *   prerequisites:
 *     commands:
 *       - curl
 *       - jq
 *
 * inline(尽力解析):
 *   prerequisites: {commands: [curl], env: [TOKEN]}
 *
 * 解析失败或无内容时返回 undefined,不抛错。
 */
function parsePrerequisites(front: string): SkillPrerequisites | undefined {
  // inline: prerequisites: {commands: [curl], env: [TOKEN]}
  const inlineRe = /^prerequisites:\s*\{([^}]*)\}\s*$/m;
  const inlineMatch = front.match(inlineRe);
  if (inlineMatch) {
    const inner = inlineMatch[1]!;
    const result: SkillPrerequisites = {};
    const cmds = inner.match(/commands:\s*\[([^\]]*)\]/);
    if (cmds) result.commands = splitArrayLiteral(cmds[1]!);
    const envs = inner.match(/env:\s*\[([^\]]*)\]/);
    if (envs) result.env = splitArrayLiteral(envs[1]!);
    return result.commands || result.env ? result : undefined;
  }

  // 嵌套块:prerequisites:\n  commands: ...\n  env: ...
  const blockRe = /^prerequisites:\s*\n((?:[ \t]+\S[^\n]*\n?)+)/m;
  const blockMatch = front.match(blockRe);
  if (!blockMatch) return undefined;
  const block = blockMatch[1]!;
  const result: SkillPrerequisites = {};

  // commands:inline [a,b] 或 block 数组
  const cmdInline = block.match(/^[ \t]+commands:\s*\[([^\]]*)\]\s*$/m);
  if (cmdInline) {
    result.commands = splitArrayLiteral(cmdInline[1]!);
  } else {
    const cmdBlock = block.match(/^[ \t]+commands:\s*\n((?:[ \t]+-\s+.+\n?)+)/m);
    if (cmdBlock) result.commands = parseBlockArray(cmdBlock[1]!);
  }

  // env:inline 或 block 数组
  const envInline = block.match(/^[ \t]+env:\s*\[([^\]]*)\]\s*$/m);
  if (envInline) {
    result.env = splitArrayLiteral(envInline[1]!);
  } else {
    const envBlock = block.match(/^[ \t]+env:\s*\n((?:[ \t]+-\s+.+\n?)+)/m);
    if (envBlock) result.env = parseBlockArray(envBlock[1]!);
  }

  return result.commands || result.env ? result : undefined;
}

/**
 * 解析 frontmatter 文本块为 SkillFrontmatter 对象(无法识别的内容跳过,不抛错)。
 * 向后兼容:无新字段的旧 skill 文件仍能正常解析。
 */
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

  // P0-2 新字段(对齐 packages/types SkillFrontmatter 契约)
  const version = parseFrontmatterField(front, 'version');
  if (version) fm.version = version;
  const license = parseFrontmatterField(front, 'license');
  if (license) fm.license = license;
  const sourceRaw = parseFrontmatterField(front, 'source');
  if (sourceRaw && SKILL_SOURCE_VALUES.has(sourceRaw)) {
    fm.source = sourceRaw as SkillSource;
  }
  const relatedSkills = parseFrontmatterArrayAny(front, ['related-skills', 'relatedSkills']);
  if (relatedSkills) fm.relatedSkills = relatedSkills;
  const progressiveDisclosure = parseFrontmatterBool(front, ['progressive-disclosure', 'progressiveDisclosure']);
  if (progressiveDisclosure !== undefined) fm.progressiveDisclosure = progressiveDisclosure;
  const prerequisites = parsePrerequisites(front);
  if (prerequisites) fm.prerequisites = prerequisites;
  const autoGeneratedAt = parseFrontmatterFieldAny(front, ['auto-generated-at', 'autoGeneratedAt']);
  if (autoGeneratedAt) fm.autoGeneratedAt = autoGeneratedAt;
  const autoGeneratedFromTask = parseFrontmatterFieldAny(front, [
    'auto-generated-from-task',
    'autoGeneratedFromTask',
  ]);
  if (autoGeneratedFromTask) fm.autoGeneratedFromTask = autoGeneratedFromTask;
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
 * 读取一份技能文件并归一成 Skill。取不到/解析失败 ⇒ 返回 null,由调用方跳过。
 * `fallbackName` 是 frontmatter 没有 name 时用的名字(平铺文件用文件名,目录形态用目录名)。
 */
function readSkillFile(
  fullPath: string,
  fallbackName: string,
  priority: number,
): Skill | null {
  try {
    const raw = fs.readFileSync(fullPath, 'utf-8');
    const def = parseSkillDefinition(raw, fullPath);
    const fm = def.frontmatter;
    const name = fm.name ?? fallbackName;
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
    return skill;
  } catch {
    // 读取失败跳过
    return null;
  }
}

/** 去重键:技能**文件的真实路径**(不是 name)。 */
function realKey(file: string): string {
  try {
    return fs.realpathSync(file);
  } catch {
    // 取不到 realpath(权限/竞态)时退回规范化绝对路径 —— 宁可少去重,也不能把两份不同技能并成一份。
    return path.resolve(file);
  }
}

/**
 * 扫描单个目录下的技能,返回 Skill 数组。两种形态都收:
 *   ① 平铺 `<dir>/<name>.md`                      —— 本仓历史形态
 *   ② 目录包 `<dir>/<name>/SKILL.md`(只下一层) —— 社区/行业 Agent 技能包的实际落地形态
 *
 * 病灶(第三十七批):旧实现第一行就是 `if (!entry.isFile()) continue`,于是整个目录被跳过,
 * 而 `.agents/skills`、`.claude/skills`、`~/.ihui/skills` 这三个我们自己声明的扫描根,
 * 外部技能包一律按 `<name>/SKILL.md` 落地(本机的第三方技能集就是这个形态)。
 * 症状是"装了技能但 /skills 里 0 个",且**没有任何一句解释** —— 与本仓最高频的失效型同族:
 * 判据/功能失效的表现永远是安静,而不是报错。
 *
 * 两条刻意的设计:
 *  - 按**文件真实路径**去重,不按 name:同名两份是两份不同的技能(上游同口径),
 *    按 name 去重会静默吞掉后来那一份;realpath 同时兜住"目录被软链进来"的重复命中。
 *  - 只下钻一层、且只认 `SKILL.md` 这一个文件名:再深就是别人的资源目录
 *    (`references/`、`scripts/`、`assets/`),把它们当技能读会污染提示词。
 */
function scanDir(dir: string, priority: number): Skill[] {
  if (!fs.existsSync(dir)) return [];
  const skills: Skill[] = [];
  const seen = new Set<string>();
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const push = (file: string, fallbackName: string): void => {
    const key = realKey(file);
    if (seen.has(key)) return;
    const skill = readSkillFile(file, fallbackName, priority);
    if (!skill) return;
    seen.add(key);
    skills.push(skill);
  };
  // 排序保证同一目录内的遍历顺序稳定(否则 readdirSync 的顺序会让"同一文件被两个形态命中"
  // 时保留哪一份变成随机的)
  for (const entry of [...entries].sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (entry.isFile()) {
      if (!entry.name.endsWith('.md')) continue;
      const fileStem = entry.name.slice(0, -3);
      if (!fileStem || fileStem.startsWith('_')) continue;
      push(path.join(dir, entry.name), fileStem);
      continue;
    }
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('_')) continue;
    push(path.join(dir, entry.name, 'SKILL.md'), entry.name);
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
 *
 * 委托给 `buildSkillPromptSection`(提示词边界唯一出口):技能正文来自第三方目录,
 * 原样拼接等于把"别人的文本"放进指令位而不设预算;清洗、单条/总量预算、
 * 以及"被省略必须留下可读计数"都在那一处实现,本函数不再自带第二份逻辑。
 */
export function formatSkillsForPrompt(skills: Skill[]): string {
  if (skills.length === 0) return recordInjectionSkipped('skill_list', '未发现任何技能');
  const built = buildSkillPromptSection(skills.map((s) => ({ name: s.name, body: s.body })));
  const text = built.included === 0
    ? recordInjectionSkipped('skill_list', `${skills.length} 个技能正文全为空`)
    : recordInjectionInjected('skill_list', built.text);
  return text;
}

/**
 * 按 name 查找单个 skill。
 */
export function findSkill(skills: Skill[], name: string): Skill | undefined {
  return skills.find((s) => s.name === name);
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
