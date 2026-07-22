/**
 * Skill 跨端同步 — 对接 api /api/skills/sync,实现 cli ↔ api skill 同步。
 *
 * 灵感来源:对标 Hermes Agent Skills Hub 的跨端共享能力。
 * 简化策略(做减法):
 *   - push:把本地加载的 skills 推到 api 持久化
 *   - pull:从 api 拉取 skills 到本地(内存,可选写盘)
 *   - list:只拉 skill 名+描述列表(省带宽)
 *   - 网络失败时降级为空,不抛错
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { SkillSyncRequest, SkillSyncResponse, SkillFrontmatter } from '@ihui/types';
import { loadSkills } from './index.js';

export interface SkillSyncClientOptions {
  /** api 基础 URL(默认 http://127.0.0.1:3001) */
  apiBaseUrl?: string;
  /** 用户认证 token(Bearer) */
  authToken?: string;
}

/**
 * 从任意常见响应壳中提取 SkillSyncResponse。
 * 兼容:bare SkillSyncResponse(含 action/skills)/ { code, message, data: SkillSyncResponse } / { data: { skills: [...] } }。
 */
function extractSkillSyncResponse(data: unknown): SkillSyncResponse | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  // bare SkillSyncResponse(含 action + skills)
  if (typeof obj.action === 'string' && Array.isArray(obj.skills)) {
    return obj as unknown as SkillSyncResponse;
  }
  // { code, message, data } 统一响应壳
  if (obj.data !== undefined) {
    return extractSkillSyncResponse(obj.data);
  }
  // 兜底:api 简化返回(含 skills 数组但无 action)
  if (Array.isArray(obj.skills)) {
    return {
      action: 'pull',
      skills: obj.skills as SkillSyncResponse['skills'],
      count: typeof obj.count === 'number' ? obj.count : (obj.skills as unknown[]).length,
      syncedAt: typeof obj.syncedAt === 'string' ? obj.syncedAt : new Date().toISOString(),
    };
  }
  return null;
}

/**
 * SkillSyncClient — 对接 api /api/skills/sync,实现跨端 skill 同步。
 *
 * 网络失败/非 2xx/解析错全部降级(返回 null),不抛错,不影响主流程。
 *
 * 用法:
 *   const client = new SkillSyncClient({ apiBaseUrl: 'http://127.0.0.1:3001', authToken: 'xxx' });
 *   const pushed = await client.push(cwd, userId, ['commit-helper']);
 *   const pulled = await client.pull(userId);
 *   const listed = await client.list(userId);
 */
export class SkillSyncClient {
  constructor(private options: SkillSyncClientOptions = {}) {}

  private get baseUrl(): string {
    return (this.options.apiBaseUrl ?? 'http://127.0.0.1:3001').replace(/\/$/, '');
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (this.options.authToken) {
      headers.Authorization = `Bearer ${this.options.authToken}`;
    }
    return headers;
  }

  private async post(body: SkillSyncRequest): Promise<SkillSyncResponse | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/skills/sync`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as unknown;
      return extractSkillSyncResponse(data);
    } catch {
      return null;
    }
  }

  /**
   * 推送本地 skills 到 api。
   * @param cwd 本地工作目录(用于 loadSkills)
   * @param userId 用户 ID
   * @param skillNames 可选,只推指定 skill(缺省推全部)
   */
  async push(
    cwd: string,
    userId: string,
    skillNames?: string[],
  ): Promise<SkillSyncResponse | null> {
    const localSkills = loadSkills({ cwd });
    const filtered =
      skillNames && skillNames.length > 0
        ? localSkills.filter((s) => skillNames.includes(s.name))
        : localSkills;
    const skills = filtered.map((s) => ({
      name: s.name,
      description: s.description,
      content: s.body,
      ...(s.frontmatter ? { frontmatter: s.frontmatter } : {}),
    }));
    return this.post({ userId, action: 'push', skills });
  }

  /**
   * 从 api 拉取 skills。
   * @param userId 用户 ID
   * @param skillNames 可选,只拉指定 skill(缺省拉全部)
   */
  async pull(userId: string, skillNames?: string[]): Promise<SkillSyncResponse | null> {
    const body: SkillSyncRequest = { userId, action: 'pull' };
    if (skillNames && skillNames.length > 0) body.skillNames = skillNames;
    return this.post(body);
  }

  /**
   * 列出 api 上的 skill 名+描述(不拉 content,省带宽)。
   * @param userId 用户 ID
   */
  async list(userId: string): Promise<SkillSyncResponse | null> {
    return this.post({ userId, action: 'list' });
  }
}

/**
 * 把 SkillFrontmatter 序列化为简单 YAML frontmatter 文本(不含 --- 分隔符)。
 * 不引入 yaml 库:数组用 inline [a, b, c],对象用嵌套块,布尔用 true/false,字符串用原值。
 */
function serializeFrontmatter(fm: SkillFrontmatter): string {
  const lines: string[] = [];
  const push = (key: string, value: string): void => {
    lines.push(`${key}: ${value}`);
  };

  if (fm.name) push('name', fm.name);
  if (fm.description) push('description', fm.description);
  if (fm.allowedTools && fm.allowedTools.length > 0) {
    push('allowed-tools', `[${fm.allowedTools.join(', ')}]`);
  }
  if (fm.tools && fm.tools.length > 0) {
    push('tools', `[${fm.tools.join(', ')}]`);
  }
  if (fm.model) push('model', fm.model);
  if (fm.tags && fm.tags.length > 0) {
    push('tags', `[${fm.tags.join(', ')}]`);
  }
  if (fm.version) push('version', fm.version);
  if (fm.license) push('license', fm.license);
  if (fm.source) push('source', fm.source);
  if (fm.relatedSkills && fm.relatedSkills.length > 0) {
    push('related-skills', `[${fm.relatedSkills.join(', ')}]`);
  }
  if (fm.progressiveDisclosure !== undefined) {
    push('progressive-disclosure', fm.progressiveDisclosure ? 'true' : 'false');
  }
  if (fm.autoGeneratedAt) push('auto-generated-at', fm.autoGeneratedAt);
  if (fm.autoGeneratedFromTask) push('auto-generated-from-task', fm.autoGeneratedFromTask);
  if (fm.prerequisites) {
    const { commands, env } = fm.prerequisites;
    const hasCommands = commands && commands.length > 0;
    const hasEnv = env && env.length > 0;
    if (hasCommands || hasEnv) {
      lines.push('prerequisites:');
      if (hasCommands) lines.push(`  commands: [${commands!.join(', ')}]`);
      if (hasEnv) lines.push(`  env: [${env!.join(', ')}]`);
    }
  }
  return lines.join('\n');
}

/**
 * 把 api 拉取的 skills 写入本地文件系统(可选,用于 pull 后持久化)。
 * @param skills api 返回的 skill 列表
 * @param targetDir 写入目录(默认 ~/.ihui/skills/pulled/)
 */
export async function writePulledSkillsToLocal(
  skills: SkillSyncResponse['skills'],
  targetDir?: string,
): Promise<{ written: number; path: string }> {
  const dir = targetDir ?? path.join(os.homedir(), '.ihui', 'skills', 'pulled');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  let written = 0;
  for (const s of skills) {
    if (!s.name) continue;
    const safeName = s.name.replace(/[<>:"/\\|?*]/g, '_');
    const filePath = path.join(dir, `${safeName}.md`);
    const parts: string[] = [];
    // 把 api 返回的 source 合并进 frontmatter(若 frontmatter 未自带 source)
    const fm = s.frontmatter;
    const mergedFm: SkillFrontmatter | undefined = fm
      ? s.source && !fm.source
        ? { ...fm, source: s.source }
        : fm
      : s.source
        ? { source: s.source }
        : undefined;
    if (mergedFm && Object.keys(mergedFm).length > 0) {
      const fmText = serializeFrontmatter(mergedFm);
      if (fmText.length > 0) {
        parts.push('---', fmText, '---', '');
      }
    }
    parts.push(s.content);
    try {
      fs.writeFileSync(filePath, parts.join('\n'), 'utf-8');
      written++;
    } catch {
      // 单个文件写入失败跳过,不阻塞其余
    }
  }
  return { written, path: dir };
}
