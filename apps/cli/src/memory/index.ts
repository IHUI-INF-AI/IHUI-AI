/**
 * Memory 持久记忆 — 全局 + 项目双层 MEMORY.md + 关键词搜索。
 *
 * 灵感来源:参考行业 Agent 框架的 memory crate 设计(实验性,默认关闭)。
 * 简化策略(做减法):
 *   - 双层存储:~/.ihui/memory/MEMORY.md(全局)+ ~/.ihui/memory/<project-slug>-<hash8>/MEMORY.md(项目)
 *   - 项目 slug 取 path.basename,hash8 取绝对路径 SHA256 前 8 位(避免重名项目混淆)
 *   - 关键词搜索:简单 substring 匹配(不实现语义搜索,保持零依赖)
 *   - 注入 system prompt:加载两层 memory 合并注入(全局先,项目后)
 *   - /memory on|off|show|add <text>|clear 控制开关
 *
 * 存储格式(MEMORY.md):
 *   # Memory
 *
 *   ## <分类>(可选,如 "用户偏好"/"项目约定"/"历史决策")
 *
 *   - <条目1>
 *   - <条目2>
 *
 *   ## <另一分类>
 *
 *   - <条目3>
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
// 跨端统一记忆契约(P0-3):MemoryEntry/MemoryScope 由 @ihui/types 维护。
// 注意:本地 MemoryEntry(文件系统层,raw/text/source/category)与统一 MemoryEntry
// (跨端层,id/scope/type/...)结构不同,故 alias 为 UnifiedMemoryEntry 避免冲突。
import type { MemoryEntry as UnifiedMemoryEntry, MemoryScope } from '@ihui/types';

const MEMORY_DIR = '.ihui';
const MEMORY_FILE = 'MEMORY.md';
const ENABLE_FLAG_FILE = '.memory-enabled';

export interface MemoryEntry {
  /** 原始行文本(含 - 前缀) */
  raw: string;
  /** 去掉 - 前缀的纯文本 */
  text: string;
  /** 来源(global | project) */
  source: 'global' | 'project';
  /** 所属分类(从 ## 标题提取,缺省 "未分类") */
  category: string;
}

export interface MemoryStore {
  /** 全局 memory 文件路径 */
  globalPath: string;
  /** 项目 memory 文件路径 */
  projectPath: string;
  /** 是否启用 */
  enabled: boolean;
}

/**
 * 获取项目 memory 目录名(basename-hash8 格式)。
 */
export function getProjectMemoryDir(projectPath: string): string {
  const abs = path.resolve(projectPath);
  const base = path.basename(abs);
  const hash = crypto.createHash('sha256').update(abs).digest('hex').slice(0, 8);
  return `${base}-${hash}`;
}

/**
 * 获取 MemoryStore。
 * 默认 enabled=true,可通过在 ~/.ihui/memory/.memory-enabled 写入 "false" 关闭。
 */
export function getMemoryStore(projectPath: string): MemoryStore {
  const home = os.homedir();
  const baseMemoryDir = path.join(home, MEMORY_DIR, 'memory');
  const projectDir = path.join(baseMemoryDir, getProjectMemoryDir(projectPath));
  const globalPath = path.join(baseMemoryDir, MEMORY_FILE);
  const projectFilePath = path.join(projectDir, MEMORY_FILE);
  const flagFile = path.join(baseMemoryDir, ENABLE_FLAG_FILE);

  let enabled = true;
  try {
    if (fs.existsSync(flagFile)) {
      const content = fs.readFileSync(flagFile, 'utf-8').trim();
      enabled = content !== 'false';
    }
  } catch {
    // 读取失败保持默认
  }

  return { globalPath, projectPath: projectFilePath, enabled };
}

/**
 * 启用/禁用 memory。
 */
export function setMemoryEnabled(enabled: boolean): void {
  const home = os.homedir();
  const baseMemoryDir = path.join(home, MEMORY_DIR, 'memory');
  const flagFile = path.join(baseMemoryDir, ENABLE_FLAG_FILE);
  if (!fs.existsSync(baseMemoryDir)) {
    fs.mkdirSync(baseMemoryDir, { recursive: true });
  }
  fs.writeFileSync(flagFile, enabled ? 'true' : 'false', 'utf-8');
}

/**
 * 读取 memory 文件,解析为 MemoryEntry 数组。
 * 解析规则:每行以 "- " 开头视为条目,最近的 "## " 标题作为分类。
 */
function parseMemoryFile(filePath: string, source: 'global' | 'project'): MemoryEntry[] {
  if (!fs.existsSync(filePath)) return [];
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return [];
  }
  const entries: MemoryEntry[] = [];
  let currentCategory = '未分类';
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('## ')) {
      currentCategory = trimmed.slice(3).trim() || '未分类';
      continue;
    }
    if (trimmed.startsWith('- ')) {
      const text = trimmed.slice(2).trim();
      if (text) {
        entries.push({ raw: trimmed, text, source, category: currentCategory });
      }
    }
  }
  return entries;
}

/**
 * 加载所有 memory 条目(全局 + 项目,全局在前)。
 */
export function loadMemory(projectPath: string): MemoryEntry[] {
  const store = getMemoryStore(projectPath);
  if (!store.enabled) return [];
  const global = parseMemoryFile(store.globalPath, 'global');
  const project = parseMemoryFile(store.projectPath, 'project');
  return [...global, ...project];
}

/**
 * 关键词搜索 memory 条目(简单 substring 匹配,不区分大小写)。
 */
export function searchMemory(entries: MemoryEntry[], query: string): MemoryEntry[] {
  const q = query.toLowerCase();
  return entries.filter((e) => e.text.toLowerCase().includes(q));
}

/**
 * 添加 memory 条目到指定文件(全局或项目)。
 * 自动创建文件和目录,条目追加到末尾(无分类段则加到"## 通用"下)。
 */
export function addMemoryEntry(
  filePath: string,
  text: string,
  category = '通用',
): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  let content = '';
  if (fs.existsSync(filePath)) {
    content = fs.readFileSync(filePath, 'utf-8');
  } else {
    content = `# Memory\n\n`;
  }

  // 查找分类段
  const sectionHeader = `## ${category}`;
  if (content.includes(sectionHeader)) {
    // 在该段末尾追加
    const lines = content.split('\n');
    let insertIdx = lines.length;
    let foundSection = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]!.trim() === sectionHeader) {
        foundSection = true;
        continue;
      }
      if (foundSection && lines[i]!.trim().startsWith('## ')) {
        insertIdx = i;
        break;
      }
      if (foundSection) {
        insertIdx = i + 1;
      }
    }
    // 跳过段尾空行
    while (insertIdx > 0 && lines[insertIdx - 1]!.trim() === '') {
      insertIdx--;
    }
    lines.splice(insertIdx, 0, `- ${text}`);
    content = lines.join('\n');
  } else {
    // 新建分类段
    if (!content.endsWith('\n\n')) {
      content += content.endsWith('\n') ? '\n' : '\n\n';
    }
    content += `${sectionHeader}\n\n- ${text}\n`;
  }

  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * 清空指定 memory 文件(全局或项目)。
 */
export function clearMemory(filePath: string): void {
  if (fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, `# Memory\n\n`, 'utf-8');
  }
}

/**
 * 把 memory 条目格式化为 system prompt 注入段。
 */
export function formatMemoryForPrompt(entries: MemoryEntry[]): string {
  if (entries.length === 0) return '';
  const lines: string[] = ['## Memory(跨会话记忆)'];
  // 按来源分组
  const global = entries.filter((e) => e.source === 'global');
  const project = entries.filter((e) => e.source === 'project');
  if (global.length > 0) {
    lines.push(`### 全局记忆(${global.length} 条)`);
    for (const e of global) {
      lines.push(`- [${e.category}] ${e.text}`);
    }
  }
  if (project.length > 0) {
    lines.push(`### 项目记忆(${project.length} 条)`);
    for (const e of project) {
      lines.push(`- [${e.category}] ${e.text}`);
    }
  }
  return lines.join('\n');
}

// === 跨端统一记忆同步(P0-3):UnifiedMemoryClient 对接 api /api/memory 路由 ===
// 平台独占:CLI 专用,不引入新依赖(用 Node 18+ 内置 fetch)。
// 文件系统(现有 MEMORY.md)优先,api 持久化兜底;网络失败时降级为纯文件模式,不抛错。
export type { MemoryEntry as UnifiedMemoryEntry, MemoryScope } from '@ihui/types';

/**
 * 从任意常见响应壳中提取 entries 数组。
 * 兼容:bare array / { entries: [...] } / { data: { entries: [...] } } / { data: [...] }。
 */
function extractMemoryEntries(data: unknown): UnifiedMemoryEntry[] {
  if (Array.isArray(data)) return data as UnifiedMemoryEntry[];
  if (!data || typeof data !== 'object') return [];
  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj.entries)) return obj.entries as UnifiedMemoryEntry[];
  if (obj.data !== undefined) return extractMemoryEntries(obj.data);
  return [];
}

/**
 * 从任意常见响应壳中提取单条 entry。
 * 兼容:bare entry(含 id) / { entry: {...} } / { data: {...} }。
 */
function extractMemoryEntry(data: unknown): UnifiedMemoryEntry | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  if (typeof obj.id === 'string') return obj as unknown as UnifiedMemoryEntry;
  if (obj.entry !== undefined) return extractMemoryEntry(obj.entry);
  if (obj.data !== undefined) return extractMemoryEntry(obj.data);
  return null;
}

/**
 * UnifiedMemoryClient — 对接 api /api/memory 路由,实现跨端记忆同步。
 *
 * 文件系统(现有 MEMORY.md)优先,api 持久化兜底。
 * 网络失败时降级为纯文件模式,不抛错,不影响主流程。
 *
 * 用法:
 *   const client = new UnifiedMemoryClient('http://127.0.0.1:8801');
 *   const entries = await client.getEntries(userId, 'session', sessionId);
 *   const entry = await client.addEntry(userId, { scope, type, category, text, source });
 */
export class UnifiedMemoryClient {
  constructor(private apiBaseUrl: string = 'http://127.0.0.1:8801') {}

  /**
   * 拉取指定用户/作用域的记忆条目。
   * 失败(网络/非 2xx/解析错)返回 [],不抛错。
   */
  async getEntries(
    userId: string,
    scope: MemoryScope = 'session',
    sessionId?: string,
  ): Promise<UnifiedMemoryEntry[]> {
    const params = new URLSearchParams({ userId, scope });
    if (sessionId) params.set('sessionId', sessionId);
    try {
      const res = await fetch(`${this.apiBaseUrl}/api/memory?${params.toString()}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return [];
      const data = (await res.json()) as unknown;
      return extractMemoryEntries(data);
    } catch {
      return [];
    }
  }

  /**
   * 新增一条记忆条目(api 负责生成 id/createdAt/updatedAt)。
   * 失败(网络/非 2xx/解析错)返回 null,不抛错。
   */
  async addEntry(
    userId: string,
    entry: Omit<UnifiedMemoryEntry, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<UnifiedMemoryEntry | null> {
    try {
      const res = await fetch(`${this.apiBaseUrl}/api/memory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ userId, entry }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as unknown;
      return extractMemoryEntry(data);
    } catch {
      return null;
    }
  }
}

// === 跨 session 记忆升级(P1-4):hybrid search + chunker + embedding ===
// 平台独占:CLI 专用,不影响 API / Web / 其他端。
export * from './chunker.js';
export * from './embedding.js';
export * from './hybrid-search.js';
// === W2-1 四层记忆 + Dream 梦境 + 向量语义(平台独占:仅 cli)===
// short-term(当前 session)/ long-term(跨 session 持久化)/ soul(用户偏好价值观)/
// dream(梦境周期沉淀 short-term → long-term)/ vector-search(embedding 语义检索)
export * from './short-term.js';
export * from './long-term.js';
export * from './soul.js';
export * from './dream.js';
export * from './vector-search.js';
