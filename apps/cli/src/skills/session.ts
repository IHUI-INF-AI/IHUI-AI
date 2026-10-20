// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 技能会话态 + 前置依赖校验(L5669①:两级渐进披露 + 技能前置门 428)。
 *
 * 模块级会话态:每次 `setupAgentTools` 装配时由 {@link setSkillCatalog} 重置,
 * 因此同一进程内并发的多条 run 共享一份目录,但"已成功加载"集合随装配清零;
 * compaction 抹掉正文后由 {@link resetLoadedSkills} 单独清已加载标记,目录不动。
 *
 * 前置依赖(frontmatter `prerequisites.commands` / `prerequisites.env`)在此首次接上
 * 消费方:此前解析后零消费者。命令按 PATH × PATHEXT 在位探测(不派生 `--version` 探活,
 * 避免真派生污染测试;存在性 = 可用,与 plugins/git-runner 的在位探测同口径)。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Skill } from './index.js';

/** 进程内目录快照(setupAgentTools 装配时整体替换)。 */
let catalog: Skill[] = [];
/** 本会话已成功通过前置门并加载过的技能名(小写归一)。 */
const loaded = new Set<string>();

const normalizeName = (name: string): string => name.trim().toLowerCase();

/** 装配新会话:替换目录快照并清空已加载集合。 */
export function setSkillCatalog(skills: readonly Skill[]): void {
  catalog = skills.map((s) => ({ ...s }));
  loaded.clear();
}

/** 目录只读投影(供 Skill 工具列名 / not_found 回应)。 */
export function listSessionSkills(): readonly Skill[] {
  return catalog;
}

/** 按名(大小写不敏感)在目录里查找技能。 */
export function findSessionSkill(name: string): Skill | undefined {
  const wanted = normalizeName(name);
  return catalog.find((s) => normalizeName(s.name) === wanted);
}

/** 标记技能已在本会话成功加载(前置门通过之后调用)。 */
export function markSkillLoaded(name: string): void {
  loaded.add(normalizeName(name));
}

/** 本会话是否已成功加载该技能(大小写不敏感)。 */
export function isSkillLoaded(name: string): boolean {
  return loaded.has(normalizeName(name));
}

/**
 * compaction 钩子:正文被摘要抹掉后清已加载标记 —— 模型必须重新调 Skill 工具
 * 过一次前置门、重新拿到正文;目录快照保留(名字/描述仍在 system prompt 里)。
 */
export function resetLoadedSkills(): void {
  loaded.clear();
}

/** 前置依赖探测出口(测试可注入假文件系统,不碰真实 PATH)。 */
export interface PrerequisiteProbe {
  exists(p: string): boolean;
}

const defaultProbe: PrerequisiteProbe = {
  exists(p: string): boolean {
    try {
      return fs.existsSync(p);
    } catch {
      return false;
    }
  },
};

export interface MissingPrerequisites {
  /** 缺失的命令名(按声明顺序)。 */
  commands: string[];
  /** 缺失/为空的环境变量名(按声明顺序)。 */
  env: string[];
}

/** 逐 PATH 目录 × PATHEXT 探测命令是否在位;不派生、不跑 `--version`。 */
function commandOnPath(
  bin: string,
  env: NodeJS.ProcessEnv,
  probe: PrerequisiteProbe,
): boolean {
  const isWin = process.platform === 'win32';
  const pathVar = env.PATH ?? env.Path ?? env.path ?? '';
  const exts = isWin
    ? (env.PATHEXT ?? '.EXE;.CMD;.BAT')
        .split(';')
        .map((e) => e.trim())
        .filter(Boolean)
    : [''];
  for (const dir of pathVar.split(path.delimiter)) {
    if (!dir) continue;
    for (const ext of exts) {
      const cand = path.join(dir, isWin ? `${bin}${ext.toLowerCase()}` : bin);
      if (probe.exists(cand)) return true;
    }
  }
  return false;
}

/**
 * 校验技能声明的前置依赖;返回两类缺失项(都为空 = 前置条件满足)。
 * env 判定:变量存在且 trim 后非空才算满足(空串与未设置同形)。
 */
export function checkSkillPrerequisites(
  skill: Skill,
  env: NodeJS.ProcessEnv = process.env,
  probe: PrerequisiteProbe = defaultProbe,
): MissingPrerequisites {
  const missing: MissingPrerequisites = { commands: [], env: [] };
  const pre = skill.frontmatter?.prerequisites;
  for (const bin of pre?.commands ?? []) {
    const name = bin.trim();
    if (name && !commandOnPath(name, env, probe)) missing.commands.push(name);
  }
  for (const key of pre?.env ?? []) {
    const name = key.trim();
    const value = env[name];
    if (name && (typeof value !== 'string' || value.trim() === '')) {
      missing.env.push(name);
    }
  }
  return missing;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
