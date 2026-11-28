// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Skills over MCP（SEP-2640，beta）客户端。
 *
 * 三件事必须同时成立，缺一件就不是这个扩展：
 *   1. 只在 server 同时声明 `resources` 与 `extensions["io.modelcontextprotocol/skills"]` 后才调用
 *      `skills/list` / `skills/get`；
 *   2. 文件内容只走 `resources/read`，并且按 manifest 的 SHA-256 + 字节数验真；
 *   3. 读取 SKILL.md 不等于激活技能 —— 激活必须走宿主自己的批准路径。本模块把 `skill_load`
 *      注册为 `approval: 'ask'`，`skill_list` 只返回元数据、不取文件。
 *
 * 不做的事：不在连接/列举/批准前预取任何文件；不把 `resources/read` 的普通结果当技能；
 * 不把 dynamic manifest 伪装成可校验内容。
 */

import { createHash } from 'node:crypto';
import { isRecord } from '../util/json.js';
import type { Tool, ToolResult } from './index.js';

export interface McpSkillsCapability {
  /** server 声明了 `resources/directory/read`；未声明时客户端 MUST NOT 调用。 */
  directoryRead: boolean;
}

export interface McpSkillResource {
  uri: string;
  digest: string;
  size: number;
}

export interface McpSkillFrontmatter extends Record<string, unknown> {
  name: string;
  description: string;
}

export interface McpSkillEntry {
  uri: string;
  frontmatter: McpSkillFrontmatter;
  resources: McpSkillResource[] | 'dynamic';
}

export interface McpSkillsPage {
  skills: McpSkillEntry[];
  nextCursor?: string;
  ttlMs?: number;
  cacheScope?: string;
}

export interface McpSkillFile {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
  /** 解码后的原始字节数（text 按 UTF-8，blob 按 base64）。 */
  bytes: number;
  /** manifest 验真通过；dynamic 技能永远 false（规范明确它不提供内容完整性）。 */
  verified: boolean;
}

export interface McpSkillDirectoryEntry {
  uri: string;
  name?: string;
  mimeType?: string;
}

export class McpSkillProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'McpSkillProtocolError';
  }
}

export class McpSkillIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'McpSkillIntegrityError';
  }
}

const SKILLS_EXTENSION = 'io.modelcontextprotocol/skills';
const SKILL_FILE = 'SKILL.md';
const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;
const MAX_LIST_PAGES = 10;

/**
 * 从 `server/discover` 的 capabilities 里读扩展声明。
 * 返回 null 表示“不是 Skills server”；返回对象表示“是”，`directoryRead` 缺省 false。
 */
export function parseMcpSkillsCapability(
  capabilities: Record<string, unknown> | undefined,
): McpSkillsCapability | null {
  if (!isRecord(capabilities) || !isRecord(capabilities.resources)) return null;
  const extensions = capabilities.extensions;
  if (!isRecord(extensions)) return null;
  const descriptor = extensions[SKILLS_EXTENSION];
  if (!isRecord(descriptor)) return null;
  return { directoryRead: descriptor.directoryRead === true };
}

function skillRoot(uri: string): string {
  if (!uri.endsWith(`/${SKILL_FILE}`)) {
    throw new McpSkillProtocolError(`技能 URI 必须以 /${SKILL_FILE} 结尾: ${uri}`);
  }
  const root = uri.slice(0, -`/${SKILL_FILE}`.length);
  if (!root) throw new McpSkillProtocolError(`技能 URI 缺少目录: ${uri}`);
  const name = root.slice(root.lastIndexOf('/') + 1);
  if (!name) throw new McpSkillProtocolError(`技能目录名为空: ${uri}`);
  return root;
}

/** 相对引用按 SKILL.md 所在目录解析；绝对 URI 原样返回，越界路径拒绝。 */
export function resolveMcpSkillUri(entry: McpSkillEntry, reference: string): string {
  const trimmed = reference.trim();
  if (!trimmed) throw new McpSkillProtocolError('技能文件引用不能为空');
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
    const root = skillRoot(entry.uri);
    if (trimmed !== entry.uri && !trimmed.startsWith(`${root}/`)) {
      throw new McpSkillProtocolError(`技能文件引用越出根目录: ${reference}`);
    }
    return trimmed;
  }
  if (trimmed.startsWith('/')) {
    throw new McpSkillProtocolError(`技能文件引用不能是绝对路径: ${reference}`);
  }
  const root = skillRoot(entry.uri);
  const schemeEnd = root.indexOf('://');
  const prefix = root.slice(0, schemeEnd + 3);
  const rootSegments = root.slice(prefix.length).split('/').filter(Boolean);
  if (rootSegments.length === 0) throw new McpSkillProtocolError(`技能 URI 缺少目录: ${entry.uri}`);

  const segments = [...rootSegments];
  for (const part of trimmed.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      // 不能越过 authority：skill://code-review 再往上就没有技能根了。
      if (segments.length <= 1) {
        throw new McpSkillProtocolError(`技能文件引用越出根目录: ${reference}`);
      }
      segments.pop();
      continue;
    }
    segments.push(part);
  }
  const resolved = `${prefix}${segments.join('/')}`;
  if (resolved !== root && !resolved.startsWith(`${root}/`)) {
    throw new McpSkillProtocolError(`技能文件引用越出根目录: ${reference}`);
  }
  if (resolved === root) throw new McpSkillProtocolError(`技能文件引用指向目录而不是文件: ${reference}`);
  return resolved;
}

function parseSkillResource(raw: unknown, root: string): McpSkillResource {
  if (!isRecord(raw)) throw new McpSkillProtocolError('manifest 条目必须是对象');
  if (typeof raw.uri !== 'string' || !raw.uri.trim()) {
    throw new McpSkillProtocolError('manifest 条目缺少 uri');
  }
  if (raw.uri !== root && !raw.uri.startsWith(`${root}/`)) {
    throw new McpSkillProtocolError(`manifest 文件越出技能根目录: ${raw.uri}`);
  }
  if (typeof raw.digest !== 'string' || !DIGEST_RE.test(raw.digest)) {
    throw new McpSkillProtocolError(`manifest 文件 digest 不是 sha256:<64 位小写 hex>: ${raw.uri}`);
  }
  if (!Number.isInteger(raw.size) || (raw.size as number) < 0) {
    throw new McpSkillProtocolError(`manifest 文件 size 必须是非负整数: ${raw.uri}`);
  }
  return { uri: raw.uri, digest: raw.digest, size: raw.size as number };
}

/** 解析并校验一个技能条目（列表和 get 共用）。 */
export function parseMcpSkillEntry(raw: unknown): McpSkillEntry {
  if (!isRecord(raw)) throw new McpSkillProtocolError('技能条目必须是对象');
  if (typeof raw.uri !== 'string' || !raw.uri.trim()) {
    throw new McpSkillProtocolError('技能条目缺少 uri');
  }
  const root = skillRoot(raw.uri);
  const name = root.slice(root.lastIndexOf('/') + 1);
  if (!isRecord(raw.frontmatter)) throw new McpSkillProtocolError(`技能 ${raw.uri} 缺少 frontmatter`);
  if (typeof raw.frontmatter.name !== 'string' || !raw.frontmatter.name.trim()) {
    throw new McpSkillProtocolError(`技能 ${raw.uri} 的 frontmatter.name 必须是非空字符串`);
  }
  if (raw.frontmatter.name !== name) {
    throw new McpSkillProtocolError(
      `技能 ${raw.uri} 的目录名 ${name} 与 frontmatter.name ${raw.frontmatter.name} 不一致`,
    );
  }
  if (typeof raw.frontmatter.description !== 'string' || !raw.frontmatter.description.trim()) {
    throw new McpSkillProtocolError(`技能 ${raw.uri} 的 frontmatter.description 必须是非空字符串`);
  }

  let resources: McpSkillResource[] | 'dynamic';
  if (raw.resources === 'dynamic') {
    resources = 'dynamic';
  } else {
    if (!Array.isArray(raw.resources) || raw.resources.length === 0) {
      throw new McpSkillProtocolError(`技能 ${raw.uri} 的 resources 必须是非空 manifest 或 "dynamic"`);
    }
    resources = raw.resources.map((r) => parseSkillResource(r, root));
    const seen = new Set<string>();
    for (const r of resources) {
      if (seen.has(r.uri)) throw new McpSkillProtocolError(`技能 ${raw.uri} 的 manifest 有重复 uri: ${r.uri}`);
      seen.add(r.uri);
    }
    if (!seen.has(raw.uri)) {
      throw new McpSkillProtocolError(`技能 ${raw.uri} 的 manifest 必须包含 SKILL.md 本身`);
    }
  }

  return {
    uri: raw.uri,
    frontmatter: {
      ...raw.frontmatter,
      name: raw.frontmatter.name,
      description: raw.frontmatter.description,
    },
    resources,
  };
}

function resultRecord(raw: unknown): Record<string, unknown> {
  if (!isRecord(raw)) throw new McpSkillProtocolError('skills 响应必须是对象');
  return raw;
}

function readCompleteResult(raw: unknown, method: string): Record<string, unknown> {
  const result = resultRecord(raw);
  if (result.resultType !== 'complete') {
    throw new McpSkillProtocolError(`${method} 必须返回 resultType:"complete"`);
  }
  return result;
}

/** 列举技能；跟随 nextCursor，最多 10 页（防服务端死循环）。 */
export async function listMcpSkills(
  rpc: (method: string, params: Record<string, unknown>) => Promise<unknown>,
): Promise<McpSkillsPage> {
  const skills: McpSkillEntry[] = [];
  const seenUris = new Set<string>();
  const seenCursors = new Set<string>();
  let cursor: string | undefined;
  let ttlMs: number | undefined;
  let cacheScope: string | undefined;

  for (let page = 0; page < MAX_LIST_PAGES; page += 1) {
    const raw = await rpc('skills/list', cursor === undefined ? {} : { cursor });
    const result = readCompleteResult(raw, 'skills/list');
    if (!Array.isArray(result.skills)) {
      throw new McpSkillProtocolError('skills/list 的 skills 必须是数组');
    }
    if (typeof result.ttlMs === 'number' && Number.isFinite(result.ttlMs)) ttlMs = result.ttlMs;
    if (typeof result.cacheScope === 'string') cacheScope = result.cacheScope;
    for (const item of result.skills) {
      const entry = parseMcpSkillEntry(item);
      if (seenUris.has(entry.uri)) {
        throw new McpSkillProtocolError(`skills/list 返回重复技能 uri: ${entry.uri}`);
      }
      seenUris.add(entry.uri);
      skills.push(entry);
    }
    if (typeof result.nextCursor !== 'string' || !result.nextCursor) break;
    if (seenCursors.has(result.nextCursor)) {
      throw new McpSkillProtocolError(`skills/list 的 nextCursor 形成环: ${result.nextCursor}`);
    }
    seenCursors.add(result.nextCursor);
    cursor = result.nextCursor;
  }

  return {
    skills,
    ...(ttlMs !== undefined ? { ttlMs } : {}),
    ...(cacheScope !== undefined ? { cacheScope } : {}),
  };
}

/** 按 URI 取单个技能；用于“未出现在列表里但用户/其它技能给了 URI”的路线。 */
export async function getMcpSkill(
  rpc: (method: string, params: Record<string, unknown>) => Promise<unknown>,
  uri: string,
): Promise<McpSkillEntry> {
  const raw = await rpc('skills/get', { uri });
  const result = readCompleteResult(raw, 'skills/get');
  if (!result.skill) throw new McpSkillProtocolError('skills/get 缺少 result.skill');
  const entry = parseMcpSkillEntry(result.skill);
  if (entry.uri !== uri) {
    throw new McpSkillProtocolError(`skills/get 返回的技能 uri ${entry.uri} 与请求 ${uri} 不一致`);
  }
  return entry;
}

function decodeContent(uri: string, raw: unknown): { text?: string; blob?: string; bytes: number } {
  if (!isRecord(raw)) throw new McpSkillProtocolError(`资源 ${uri} 的内容必须是对象`);
  if (typeof raw.text === 'string') {
    return { text: raw.text, bytes: Buffer.byteLength(raw.text, 'utf8') };
  }
  if (typeof raw.blob === 'string') {
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(raw.blob) || raw.blob.length % 4 !== 0) {
      throw new McpSkillProtocolError(`资源 ${uri} 的 blob 不是合法 base64`);
    }
    const buffer = Buffer.from(raw.blob, 'base64');
    return { blob: raw.blob, bytes: buffer.byteLength };
  }
  throw new McpSkillProtocolError(`资源 ${uri} 既没有 text 也没有 blob`);
}

function sha256(buffer: Buffer): string {
  return `sha256:${createHash('sha256').update(buffer).digest('hex')}`;
}

/**
 * 读取一个技能文件并按 manifest 验真。
 *
 * 这是内容边界，不是激活边界：调用方（`skill_load` 工具）必须在用户批准后才走到这里。
 * dynamic 技能没有 digest，按规范不伪装成“已验证”。
 */
export async function readMcpSkillFile(
  rpc: (method: string, params: Record<string, unknown>) => Promise<unknown>,
  entry: McpSkillEntry,
  uri: string,
): Promise<McpSkillFile> {
  const manifest =
    entry.resources === 'dynamic' ? undefined : entry.resources.find((r) => r.uri === uri);
  if (entry.resources !== 'dynamic' && !manifest) {
    throw new McpSkillIntegrityError(`文件不在技能 manifest 内: ${uri}`);
  }

  const raw = await rpc('resources/read', { uri });
  const result = resultRecord(raw);
  if (!Array.isArray(result.contents)) {
    throw new McpSkillProtocolError('resources/read 的 contents 必须是数组');
  }
  const content = result.contents.find((c) => isRecord(c) && c.uri === uri);
  if (!isRecord(content)) throw new McpSkillProtocolError(`resources/read 未返回 ${uri}`);
  const decoded = decodeContent(uri, content);
  const buffer =
    decoded.text !== undefined
      ? Buffer.from(decoded.text, 'utf8')
      : Buffer.from(decoded.blob ?? '', 'base64');

  if (manifest) {
    if (decoded.bytes !== manifest.size) {
      throw new McpSkillIntegrityError(
        `技能文件大小不符: ${uri} manifest=${manifest.size} 实际=${decoded.bytes}`,
      );
    }
    if (sha256(buffer) !== manifest.digest) {
      throw new McpSkillIntegrityError(`技能文件 SHA-256 不符: ${uri}`);
    }
  }

  return {
    uri,
    ...(typeof content.mimeType === 'string' ? { mimeType: content.mimeType } : {}),
    ...(decoded.text !== undefined ? { text: decoded.text } : {}),
    ...(decoded.blob !== undefined ? { blob: decoded.blob } : {}),
    bytes: decoded.bytes,
    verified: manifest !== undefined,
  };
}

/**
 * 读目录元数据。仅当 server 声明 `directoryRead:true` 时可调用；否则在这里直接拒绝，
 * 不把一次“服务端不支持”的 -32602 折成空目录。
 */
export async function listMcpSkillDirectory(
  rpc: (method: string, params: Record<string, unknown>) => Promise<unknown>,
  uri: string,
  capability: McpSkillsCapability,
): Promise<{ resources: McpSkillDirectoryEntry[]; nextCursor?: string }> {
  if (!capability.directoryRead) {
    throw new McpSkillProtocolError(
      'server 未声明 skills.directoryRead:true，客户端不得调用 resources/directory/read',
    );
  }
  const resources: McpSkillDirectoryEntry[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | undefined;
  let nextCursor: string | undefined;

  for (let page = 0; page < MAX_LIST_PAGES; page += 1) {
    const raw = await rpc('resources/directory/read', {
      uri,
      ...(cursor === undefined ? {} : { cursor }),
    });
    const result = readCompleteResult(raw, 'resources/directory/read');
    if (!Array.isArray(result.resources)) {
      throw new McpSkillProtocolError('resources/directory/read 的 resources 必须是数组');
    }
    for (const item of result.resources) {
      if (!isRecord(item) || typeof item.uri !== 'string' || !item.uri) {
        throw new McpSkillProtocolError('目录条目缺少 uri');
      }
      resources.push({
        uri: item.uri,
        ...(typeof item.name === 'string' ? { name: item.name } : {}),
        ...(typeof item.mimeType === 'string' ? { mimeType: item.mimeType } : {}),
      });
    }
    nextCursor = typeof result.nextCursor === 'string' && result.nextCursor ? result.nextCursor : undefined;
    if (!nextCursor) break;
    if (seenCursors.has(nextCursor)) {
      throw new McpSkillProtocolError(`resources/directory/read 的 nextCursor 形成环: ${nextCursor}`);
    }
    seenCursors.add(nextCursor);
    cursor = nextCursor;
  }
  return { resources, ...(nextCursor ? { nextCursor } : {}) };
}

export interface McpSkillToolHost {
  serverName: string;
  capability: McpSkillsCapability;
  rpc: (method: string, params: Record<string, unknown>) => Promise<unknown>;
  /** 列表元数据缓存，缺省 5 分钟；内容永远不预取。 */
  cacheTtlMs?: number;
}

function formatSkillList(serverName: string, skills: McpSkillEntry[]): string {
  if (skills.length === 0) return `MCP server "${serverName}" 没有发布技能。`;
  const lines = [`MCP server "${serverName}" 发布 ${skills.length} 个技能（仅元数据，未读取文件）：`];
  for (const skill of skills) {
    const files =
      skill.resources === 'dynamic' ? 'dynamic' : `${skill.resources.length} 个文件`;
    lines.push(`- ${skill.frontmatter.name} — ${skill.frontmatter.description}`);
    lines.push(`  uri: ${skill.uri}`);
    lines.push(`  manifest: ${files}`);
  }
  lines.push('用 skill_load 读取某个技能的 SKILL.md；读取动作需要用户批准。');
  return lines.join('\n');
}

/**
 * Skills over MCP 的两枚宿主工具名。集中一处生成，A13 等价性测试与运行时工厂共用，
 * 避免门面/运行面各写一份模板。
 */
export type McpSkillToolKind = 'list' | 'load';

export function mcpSkillToolName(serverName: string, kind: McpSkillToolKind): string {
  return `mcp__${serverName}__skill_${kind}`;
}

/**
 * 把 Skills over MCP 接成两枚工具：
 *
 * - `mcp__<server>__skill_list`：只读元数据，不传文件内容；`directory` 参数仅在
 *   server 声明 directoryRead 时可用。
 * - `mcp__<server>__skill_load`：读 SKILL.md/指定支持文件，注册为 `approval:'ask'`。
 *   这是“激活窗口”的宿主入口；直接调 `resources/read` 不会走到这里。
 */
export function createMcpSkillTools(host: McpSkillToolHost): Tool[] {
  let cache: { entries: McpSkillEntry[]; expiresAt: number } | undefined;

  async function ensureEntries(): Promise<McpSkillEntry[]> {
    if (cache && cache.expiresAt > Date.now()) return cache.entries;
    const page = await listMcpSkills(host.rpc);
    const ttl = Math.max(0, host.cacheTtlMs ?? page.ttlMs ?? 300_000);
    cache = { entries: page.skills, expiresAt: Date.now() + ttl };
    return cache.entries;
  }

  async function findEntry(skill: string): Promise<McpSkillEntry> {
    const entries = await ensureEntries();
    const exact = entries.find((e) => e.uri === skill);
    if (exact) return exact;
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(skill)) {
      const fetched = await getMcpSkill(host.rpc, skill);
      cache = cache
        ? { ...cache, entries: [...cache.entries.filter((e) => e.uri !== fetched.uri), fetched] }
        : { entries: [fetched], expiresAt: Date.now() + (host.cacheTtlMs ?? 300_000) };
      return fetched;
    }
    const byName = entries.filter((e) => e.frontmatter.name === skill);
    if (byName.length === 1) return byName[0]!;
    if (byName.length > 1) {
      throw new McpSkillProtocolError(
        `技能名 "${skill}" 在同一 server 下不唯一，请改用 SKILL.md 的 uri`,
      );
    }
    throw new McpSkillProtocolError(`server "${host.serverName}" 没有技能 "${skill}"`);
  }

  function errorResult(err: unknown): ToolResult {
    const errorType =
      err instanceof McpSkillIntegrityError
        ? 'mcp_skill_integrity'
        : err instanceof McpSkillProtocolError
          ? 'mcp_skill_protocol'
          : 'mcp_skill_error';
    return {
      success: false,
      output: '',
      error: err instanceof Error ? err.message : String(err),
      errorType,
    };
  }

  const listTool: Tool = {
    name: mcpSkillToolName(host.serverName, 'list'),
    nameAliases: ['mcp_skill_list'],
    registrationOwner: `mcp:${host.serverName}`,
    dangerLevel: 'read',
    description:
      `列出 MCP server "${host.serverName}" 发布的技能元数据（名称/描述/URI/文件清单）。` +
      '不读取任何文件内容；directory 参数仅在 server 声明 directoryRead 时可用。',
    parameters: {
      directory: {
        type: 'string',
        description: '可选。要列出的技能目录 URI（相对或绝对）；仅 directoryRead server 支持。',
      },
    },
    required: [],
    async execute(args): Promise<ToolResult> {
      try {
        const directory = typeof args.directory === 'string' ? args.directory.trim() : '';
        if (directory) {
          const result = await listMcpSkillDirectory(host.rpc, directory, host.capability);
          const lines = result.resources.map(
            (r) => `- ${r.uri}${r.mimeType ? ` (${r.mimeType})` : ''}`,
          );
          return {
            success: true,
            output: [
              `MCP server "${host.serverName}" 目录 ${directory}（${result.resources.length} 项）：`,
              ...lines,
            ].join('\n'),
          };
        }
        return { success: true, output: formatSkillList(host.serverName, await ensureEntries()) };
      } catch (err) {
        return errorResult(err);
      }
    },
  };

  const loadTool: Tool = {
    name: mcpSkillToolName(host.serverName, 'load'),
    nameAliases: ['mcp_skill_load'],
    registrationOwner: `mcp:${host.serverName}`,
    dangerLevel: 'read',
    // 规范要求激活走宿主的技能加载路径并取得用户批准；这是结构位置，不是文案提示。
    registration: { approval: 'ask' },
    description:
      `加载 MCP server "${host.serverName}" 的技能：读取 SKILL.md，可选读取 manifest 内指定的支持文件。` +
      '每个文件按 manifest 的 SHA-256 与字节数验真；dynamic 技能不做内容绑定并会明确标注。',
    parameters: {
      skill: {
        type: 'string',
        description: '技能的 SKILL.md URI，或 frontmatter.name。',
      },
      files: {
        type: 'array',
        description: '可选。要一并读取的支持文件，相对技能根目录或绝对 URI；不传只读 SKILL.md。',
        items: { type: 'string', description: '支持文件的相对路径或绝对 URI。' },
      },
    },
    required: ['skill'],
    async execute(args): Promise<ToolResult> {
      try {
        const skill = typeof args.skill === 'string' ? args.skill.trim() : '';
        if (!skill) return { success: false, output: '', error: 'skill 不能为空', errorType: 'mcp_skill_protocol' };
        const entry = await findEntry(skill);
        const references = Array.isArray(args.files)
          ? args.files.filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
          : [];
        const uris = [
          entry.uri,
          ...references.map((f) => resolveMcpSkillUri(entry, f)),
        ];
        const uniqueUris = [...new Set(uris)];
        const files = [];
        for (const uri of uniqueUris) files.push(await readMcpSkillFile(host.rpc, entry, uri));

        const blocks = [
          `MCP Skill: ${entry.frontmatter.name} (${entry.uri})`,
          `server: ${host.serverName}`,
          `description: ${entry.frontmatter.description}`,
        ];
        for (const file of files) {
          blocks.push('', `## ${file.uri}`, `mime: ${file.mimeType ?? 'unknown'} · bytes: ${file.bytes} · verified: ${file.verified}`);
          if (file.text !== undefined) {
            blocks.push(file.text);
          } else {
            blocks.push(`[binary content omitted: ${file.mimeType ?? 'application/octet-stream'}]`);
          }
        }
        if (entry.resources === 'dynamic') {
          blocks.push('', '注意：该技能是 dynamic manifest，文件内容没有 digest/size 可绑定，未做完整性验证。');
        }
        return { success: true, output: blocks.join('\n') };
      } catch (err) {
        return errorResult(err);
      }
    },
  };

  return [listTool, loadTool];
}
