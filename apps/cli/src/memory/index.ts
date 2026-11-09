// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
import {
  assertSafeFetchUrl,
  type SelfHostedTrust,
} from '@ihui/shared/utils/ssrf-guard';
// G-924(2026-10-21):记忆读写改走 @ihui/api-client 端点(令牌 / CSRF / 超时 / 包络校验统一托管),
// 不再端内裸 fetch 直连后端。SSRF 信任(127.0.0.1 自托管)仍由本类在调用前守门。
import { listMemories, createMemory } from '@ihui/api-client/endpoints/memory';

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
function parseMemoryContent(content: string, source: 'global' | 'project'): MemoryEntry[] {
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

function parseMemoryFile(filePath: string, source: 'global' | 'project'): MemoryEntry[] {
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return [];
    throw new Error('memory 读不到,不能把它说成没有条目');
  }
  return parseMemoryContent(content, source);
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
export type MemoryWriteLease = { sessionId: unknown; at: unknown; byteCap?: unknown };

export function addMemoryEntry(
  filePath: string,
  text: string,
  category = '通用',
  lease?: MemoryWriteLease,
): MemoryRotationPlan | undefined {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  let content = '';
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') content = `# Memory\n\n`;
    else throw new Error('memory 读不到,不能把它覆盖成新条目');
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

  if (lease) return commitMemoryFile(filePath, content, lease);
  fs.writeFileSync(filePath, content, 'utf-8');
  return undefined;
}

/**
 * 清空指定 memory 文件(全局或项目)。
 */
export function clearMemory(filePath: string, lease?: MemoryWriteLease): MemoryRotationPlan | undefined {
  try {
    if (!fs.statSync(filePath).isFile()) {
      throw new Error('memory 读不到,不能把它说成已经清空');
    }
  } catch (err) {
    if (err instanceof Error && err.message === 'memory 读不到,不能把它说成已经清空') {
      if (!lease) throw err;
      return {
        disposition: 'unjudged',
        reason: 'bytes-unmeasured',
        bakName: '',
        at: null,
        previousBytes: null,
      };
    }
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return undefined;
    if (!lease) throw new Error('memory 读不到,不能把它说成已经清空');
    return {
      disposition: 'unjudged',
      reason: 'bytes-unmeasured',
      bakName: '',
      at: null,
      previousBytes: null,
    };
  }
  const next = `# Memory\n\n`;
  if (lease) return commitMemoryFile(filePath, next, lease);
  fs.writeFileSync(filePath, next, 'utf-8');
  return undefined;
}

type MemoryOccasion = 'session-start' | 'identity-recall';

const MEMORY_OCCASION_ALIASES: Readonly<Record<string, MemoryOccasion>> = {
  'session-start': 'session-start',
  'session start': 'session-start',
  'identity-recall': 'identity-recall',
  'identity recall': 'identity-recall',
};

export type MemoryOccasionPlan = {
  disposition: 'admitted' | 'refused' | 'unjudged';
  reason:
    | 'declared'
    | 'occasion-mismatch'
    | 'timing-absent'
    | 'timing-unrecognized'
    | 'occasion-unrecognized'
    | 'text-unreadable';
  body: string;
};

function normalizeMemoryOccasion(value: string): MemoryOccasion | null {
  return MEMORY_OCCASION_ALIASES[value.trim().toLowerCase()] ?? null;
}

/**
 * 人格/记忆件只在自己声明的时机进入提示。
 * 没写 read_when 的件不当成「随时可读」。
 * 声明里出现不认识的时机,整份不注入。
 */
export function selectMemoryForOccasion(input: { text: unknown; occasion: unknown }): MemoryOccasionPlan {
  const blank = (
    reason: MemoryOccasionPlan['reason'],
    disposition: MemoryOccasionPlan['disposition'] = 'unjudged',
  ): MemoryOccasionPlan => ({ disposition, reason, body: '' });
  if (typeof input.occasion !== 'string' || normalizeMemoryOccasion(input.occasion) === null) {
    return blank('occasion-unrecognized');
  }
  const occasion = normalizeMemoryOccasion(input.occasion)!;
  if (typeof input.text !== 'string') return blank('text-unreadable');
  const text = input.text.replace(/^\uFEFF/, '');
  const open = text.startsWith('---\r\n') ? 5 : text.startsWith('---\n') ? 4 : 0;
  if (open === 0) return blank('timing-absent');
  const end = text.indexOf('\n---', open);
  if (end < 0) return blank('text-unreadable');
  const front = text.slice(open, end);
  const body = text.slice(end + 4).replace(/^\r?\n/, '');
  const line = front.split(/\r?\n/).find((row) => /^read_when\s*:/.test(row));
  if (!line) return blank('timing-absent');
  const raw = line.replace(/^read_when\s*:\s*/, '').trim().replace(/^["']|["']$/g, '');
  if (raw.length === 0) return blank('timing-absent');
  const mapped: MemoryOccasion[] = [];
  for (const token of raw.split('/')) {
    const known = normalizeMemoryOccasion(token);
    if (!known) return blank('timing-unrecognized');
    mapped.push(known);
  }
  if (mapped.includes(occasion)) return { disposition: 'admitted', reason: 'declared', body };
  return blank('occasion-mismatch', 'refused');
}

export function promptMemoryForOccasion(input: { occasion: unknown; documents: unknown }): {
  text: string;
  reasons: string[];
  entryCount: number;
  entries: MemoryEntry[];
} {
  if (!Array.isArray(input.documents)) {
    return { text: '', reasons: ['documents-unmeasured'], entryCount: 0, entries: [] };
  }
  const entries: MemoryEntry[] = [];
  const reasons: string[] = [];
  for (const item of input.documents) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      reasons.push('text-unreadable');
      continue;
    }
    const row = item as { source?: unknown; text?: unknown };
    const source = row.source === 'global' || row.source === 'project' ? row.source : null;
    if (!source) {
      reasons.push('text-unreadable');
      continue;
    }
    const plan = selectMemoryForOccasion({ text: row.text, occasion: input.occasion });
    if (plan.disposition !== 'admitted') {
      reasons.push(plan.reason);
      continue;
    }
    entries.push(...parseMemoryContent(plan.body, source));
  }
  return { text: formatMemoryForPrompt(entries), reasons, entryCount: entries.length, entries };
}

export function loadMemoryForPrompt(projectPath: string, occasion: unknown): {
  text: string;
  reasons: string[];
  entryCount: number;
  entries: MemoryEntry[];
} {
  const store = getMemoryStore(projectPath);
  if (!store.enabled) return { text: '', reasons: ['disabled'], entryCount: 0, entries: [] };
  const documents: { source: 'global' | 'project'; text: string | null }[] = [];
  for (const [source, filePath] of [
    ['global', store.globalPath],
    ['project', store.projectPath],
  ] as const) {
    try {
      documents.push({ source, text: fs.readFileSync(filePath, 'utf-8') });
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT' || code === 'ENOTDIR') continue;
      documents.push({ source, text: null });
    }
  }
  return promptMemoryForOccasion({ occasion, documents });
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
  constructor(
    private apiBaseUrl: string = 'http://127.0.0.1:8801',
    private trust?: SelfHostedTrust,
  ) {}

  /**
   * 拉取指定用户/作用域的记忆条目。
   * 失败(网络/非 2xx/解析错/SSRF 不信任)返回 [],不抛错。
   */
  async getEntries(
    userId: string,
    scope: MemoryScope = 'session',
    sessionId?: string,
  ): Promise<UnifiedMemoryEntry[]> {
    const params = new URLSearchParams({ userId, scope });
    if (sessionId) params.set('sessionId', sessionId);
    try {
      const url = `${this.apiBaseUrl}/api/memory?${params.toString()}`;
      // ssrf-trust-source: settings.apiUrl(调用方传入的 SelfHostedTrust;本类不自行声明)
      const verdict = await assertSafeFetchUrl(url, { selfHosted: this.trust });
      if (!verdict.safe) return [];
      const res = await listMemories({ apiBaseUrl: this.apiBaseUrl, userId, scope, sessionId });
      if (!res.success) return [];
      return res.data;
    } catch {
      return [];
    }
  }

  /**
   * 新增一条记忆条目(api 负责生成 id/createdAt/updatedAt)。
   * 失败(网络/非 2xx/解析错/SSRF 不信任)返回 null,不抛错。
   */
  async addEntry(
    userId: string,
    entry: Omit<UnifiedMemoryEntry, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<UnifiedMemoryEntry | null> {
    try {
      const url = `${this.apiBaseUrl}/api/memory`;
      const verdict = await assertSafeFetchUrl(url, { selfHosted: this.trust });
      if (!verdict.safe) return null;
      const res = await createMemory({ apiBaseUrl: this.apiBaseUrl, userId, entry });
      if (!res.success) return null;
      return res.data;
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

export type MemoryRotationPlan = {
  disposition: 'rotate' | 'unjudged' | 'refused';
  reason:
    | 'rotate'
    | 'session-invalid'
    | 'bytes-unmeasured'
    | 'bytes-invalid'
    | 'cap-unmeasured'
    | 'over-cap'
    | 'clock-unmeasured';
  bakName: string;
  at: string | null;
  previousBytes: number | null;
};

const MEMORY_SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

function memoryByteCountOk(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * 会话记忆留上一版时，时刻和两边字节数都必须是调用方已经量到的。
 * 缺时钟不改用当前时间，缺字节数不写成 0。超过调用方给出的上限就不轮转。
 * 本函数不写盘。
 */
export function planMemoryRotation(input: {
  sessionId: unknown;
  previousBytes: unknown;
  nextBytes: unknown;
  byteCap: unknown;
  at: unknown;
}): MemoryRotationPlan {
  const blank = (
    reason: MemoryRotationPlan['reason'],
    disposition: MemoryRotationPlan['disposition'],
  ): MemoryRotationPlan => ({
    disposition,
    reason,
    bakName: '',
    at: null,
    previousBytes: null,
  });
  if (typeof input.sessionId !== 'string' || !MEMORY_SESSION_ID.test(input.sessionId)) {
    return blank('session-invalid', 'refused');
  }
  if (
    input.previousBytes === null ||
    input.previousBytes === undefined ||
    input.nextBytes === null ||
    input.nextBytes === undefined
  ) {
    return blank('bytes-unmeasured', 'unjudged');
  }
  if (!memoryByteCountOk(input.previousBytes) || !memoryByteCountOk(input.nextBytes)) {
    return blank('bytes-invalid', 'unjudged');
  }
  if (input.byteCap === null || input.byteCap === undefined) return blank('cap-unmeasured', 'unjudged');
  if (!memoryByteCountOk(input.byteCap) || input.byteCap < 1) return blank('bytes-invalid', 'unjudged');
  if (input.previousBytes > input.byteCap || input.nextBytes > input.byteCap) {
    return blank('over-cap', 'refused');
  }
  if (typeof input.at !== 'string' || input.at.trim() === '' || Number.isNaN(Date.parse(input.at))) {
    return blank('clock-unmeasured', 'unjudged');
  }
  return {
    disposition: 'rotate',
    reason: 'rotate',
    bakName: `${input.sessionId}_memory.md.bak`,
    at: input.at,
    previousBytes: input.previousBytes,
  };
}

const MEMORY_FILE_BYTE_CAP = 256 * 1024;

function commitMemoryFile(filePath: string, content: string, lease: MemoryWriteLease): MemoryRotationPlan {
  let previousBytes: number | null = null;
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) previousBytes = null;
    else {
      const size = stat.size;
      previousBytes = typeof size === 'number' && Number.isInteger(size) && size >= 0 ? size : null;
    }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    previousBytes = code === 'ENOENT' || code === 'ENOTDIR' ? 0 : null;
  }
  const plan = planMemoryRotation({
    sessionId: lease.sessionId,
    previousBytes,
    nextBytes: Buffer.byteLength(content, 'utf8'),
    byteCap: lease.byteCap === undefined ? MEMORY_FILE_BYTE_CAP : lease.byteCap,
    at: lease.at,
  });
  if (plan.disposition !== 'rotate') return plan;
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (previousBytes !== null && previousBytes > 0) {
    fs.copyFileSync(filePath, path.join(dir, plan.bakName));
  }
  fs.writeFileSync(filePath, content, 'utf-8');
  return plan;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
