// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * MCP (Model Context Protocol) 服务器配置管理
 * 配置存储在 ~/.ihui/mcp.json
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { tryParseJson, isRecord } from '../util/json.js';
import { findRepoRoot } from '../skills/index.js';

export type MCPTransport = 'stdio' | 'http' | 'sse';

export interface MCPAuth {
  type: 'none' | 'bearer' | 'oauth';
  token?: string;
}

/**
 * OAuth provider 元数据(当 auth.type === 'oauth' 时必填)。
 * 描述如何与 OAuth 授权服务器交互,对应 mcp-oauth.ts 的 OAuthConfig。
 */
export interface McpOAuthConfig {
  /** 授权页 endpoint,如 https://github.com/login/oauth/authorize */
  authorizationEndpoint: string;
  /** 换 token endpoint,如 https://github.com/login/oauth/access_token */
  tokenEndpoint: string;
  /** OAuth client_id(注册 OAuth App 时获得) */
  clientId: string;
  /** OAuth client_secret(机密,从环境变量读取;可选,PKCE 流程不需要) */
  clientSecret?: string;
  /** 本地回调 URL,如 http://localhost:8765/callback(端口必须与 redirectUri 一致) */
  redirectUri: string;
  /** 申请的 scope 列表,如 ['repo', 'read:user'] */
  scope: string[];
}

export type McpStdioFraming = 'ndjson' | 'content-length';

export interface McpServer {
  name: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  /**
   * stdio 帧格式。缺省 `ndjson`（本仓原有服务器）。
   * 官方 MCP stdio（含 REA）用 `content-length`。
   */
  framing?: McpStdioFraming;
  /**
   * 单次 RPC(tools/call 等)的超时毫秒数,缺省 10_000。
   * 重计算型 server(如 REA 的 Ghidra 反编译)需要放宽。
   */
  requestTimeoutMs?: number;
  /** 仅运行时：相对 command/args 相对这个目录解析。不写入 mcp.json。 */
  cwd?: string;
  transport?: MCPTransport;
  url?: string;
  headers?: Record<string, string>;
  api_key?: string;
  auth?: MCPAuth;
  /** OAuth provider 元数据(仅当 auth.type === 'oauth' 时生效) */
  oauth?: McpOAuthConfig;
}

export interface McpConfig {
  servers: McpServer[];
}

/**
 * Claude Desktop / Cursor 等外部生态的 mcp.json 格式:
 *   { "mcpServers": { "<name>": { "command", "args", "env" } | { "url", "headers" } } }
 * IHUI 原生格式为 { "servers": [ { "name", ... } ] }。多源扫描会读取 .claude/.cursor 下的
 * 外部格式文件,因此加载时需要先归一化(normalizeMcpInput),避免两种静默互不可见。
 */
export interface ExternalMcpServersFile {
  mcpServers?: Record<string, Omit<McpServer, 'name'>>;
}

/**
 * 把任意 JSON 值归一化为 McpConfig:
 * - `{ servers: [...] }`(IHUI 原生)→ 原样返回(浅拷贝 servers 数组)
 * - `{ mcpServers: { name: {...} } }`(Claude/Cursor 外部格式)→ 转为原生数组格式,
 *   map key 即 server.name,transport 缺省推断:有 command → 'stdio',有 url → 'http'
 * - 其他/非法输入 → { servers: [] }
 */
export function normalizeMcpInput(parsed: unknown): McpConfig {
  if (!isRecord(parsed)) return { servers: [] };
  if (Array.isArray(parsed.servers)) {
    return { servers: parsed.servers.filter(isRecord) as unknown as McpServer[] };
  }
  if (isRecord(parsed.mcpServers)) {
    const servers: McpServer[] = [];
    for (const [name, raw] of Object.entries(parsed.mcpServers)) {
      if (!isRecord(raw)) continue;
      const srv: McpServer = { name, ...(raw as Omit<McpServer, 'name'>) };
      if (!srv.transport) srv.transport = srv.command ? 'stdio' : srv.url ? 'http' : undefined;
      servers.push(srv);
    }
    return { servers };
  }
  return { servers: [] };
}

/** validateMcpConfig 结果 */
export interface McpValidationResult {
  valid: McpServer[];
  /** 每条形如 `server "<name>": <原因>` 的校验错误 */
  errors: string[];
}

/**
 * MCP server 配置 schema 校验(stdio/http/sse 三种 transport 的必填约束):
 * - name:非空字符串
 * - transport='stdio'(或缺省):必须有非空 command;args 若存在必须是字符串数组;env 必须是字符串 map
 * - transport='http'|'sse':必须有非空 url
 * - auth.type='oauth':oauth 元数据必填字段(authorizationEndpoint/tokenEndpoint/clientId/redirectUri/scope)
 * 不抛错,返回 { valid, errors },由调用方决定提示方式。
 */
export function validateMcpConfig(config: unknown): McpValidationResult {
  const result: McpValidationResult = { valid: [], errors: [] };
  const norm = normalizeMcpInput(config);
  for (const s of norm.servers) {
    const err = (msg: string) => result.errors.push(`server "${s.name ?? '(unnamed)'}": ${msg}`);
    if (typeof s.name !== 'string' || !s.name.trim()) {
      err('name 必须是非空字符串');
      continue;
    }
    const transport = s.transport ?? 'stdio';
    if (transport === 'stdio') {
      if (typeof s.command !== 'string' || !s.command.trim()) {
        err("transport='stdio' 要求非空 command");
        continue;
      }
      if (s.args !== undefined && (!Array.isArray(s.args) || s.args.some((a) => typeof a !== 'string'))) {
        err('args 必须是字符串数组');
        continue;
      }
      if (
        s.env !== undefined &&
        (!isRecord(s.env) || Object.values(s.env).some((v) => typeof v !== 'string'))
      ) {
        err('env 必须是字符串键值 map');
        continue;
      }
      if (s.framing !== undefined && s.framing !== 'ndjson' && s.framing !== 'content-length') {
        err("framing 只能是 'ndjson' 或 'content-length'");
        continue;
      }
    } else {
      if (typeof s.url !== 'string' || !s.url.trim()) {
        err(`transport='${transport}' 要求非空 url`);
        continue;
      }
    }
    if (
      s.requestTimeoutMs !== undefined &&
      (!Number.isSafeInteger(s.requestTimeoutMs) || s.requestTimeoutMs <= 0)
    ) {
      err('requestTimeoutMs 必须是正整数毫秒');
      continue;
    }
    if (s.auth?.type === 'oauth') {
      const o = s.oauth;
      if (
        !o ||
        typeof o.authorizationEndpoint !== 'string' ||
        typeof o.tokenEndpoint !== 'string' ||
        typeof o.clientId !== 'string' ||
        typeof o.redirectUri !== 'string' ||
        !Array.isArray(o.scope)
      ) {
        err("auth.type='oauth' 要求 oauth 元数据含 authorizationEndpoint/tokenEndpoint/clientId/redirectUri/scope");
        continue;
      }
    }
    result.valid.push(s);
  }
  return result;
}

/** 多源扫描目录(每个根源下的高→低顺序):.ihui → .claude → .cursor */
const MCP_SOURCE_DIRS = ['.ihui', '.claude', '.cursor'];

/**
 * 扫描根源(高→低):cwd → 仓库根(从 cwd 向上找 .git,与 skills 加载器同源)→ home。
 * 仓库代理运行时传的是 workspacePath(仓库根),而 `ihui mcp list` 等在任意子目录执行时
 * cwd 是子目录;不向上找仓库根的话,项目级 <repo-root>/.ihui/mcp.json 在子目录静默不可见。
 * 根源去重:cwd 即仓库根(或 home)时只扫一层,避免同一文件重复合并。
 */
function listMcpConfigPaths(cwd: string): string[] {
  const resolvedCwd = path.resolve(cwd);
  const roots = [resolvedCwd, findRepoRoot(resolvedCwd), path.resolve(os.homedir())];
  const uniqueRoots = roots.filter((r, i) => roots.indexOf(r) === i);
  const paths: string[] = [];
  for (const root of uniqueRoots) {
    for (const d of MCP_SOURCE_DIRS) paths.push(path.join(root, d, 'mcp.json'));
  }
  return paths;
}

/** 实际存在、会参与本次合并的 mcp.json 源文件清单(优先级 高→低)。 */
export function listMcpConfigSources(cwd: string = process.cwd()): string[] {
  return listMcpConfigPaths(cwd).filter((p) => fs.existsSync(p));
}

/**
 * 深合并两个 McpConfig:servers 按 name 合并(b 覆盖 a 的同名 server),其余保持。
 * a 的独有 server 保留,b 的同名 server 覆盖 a,b 的独有 server 追加。
 */
export function deepMergeMcpConfig(a: McpConfig, b: McpConfig): McpConfig {
  const byName = new Map<string, McpServer>();
  for (const s of a.servers ?? []) byName.set(s.name, s);
  for (const s of b.servers ?? []) byName.set(s.name, s);
  return { servers: Array.from(byName.values()) };
}

export function getMcpConfigPath(): string {
  return path.join(os.homedir(), '.ihui', 'mcp.json');
}

/**
 * 多源加载 mcp.json,按优先级深合并(高优先级覆盖低优先级同名 server)。
 * 扫描顺序(高→低):<cwd>/.{ihui,claude,cursor} → <repo-root>/.{ihui,claude,cursor} → ~/.{ihui,claude,cursor}。
 * 每个文件先经 normalizeMcpInput 归一化,兼容 IHUI 原生 {servers:[]} 与
 * Claude/Cursor 外部 {mcpServers:{}} 两种格式。
 */
export function loadMcpConfig(cwd: string = process.cwd()): McpConfig {
  const paths = listMcpConfigPaths(cwd);
  let acc: McpConfig = { servers: [] };
  for (const p of [...paths].reverse()) {
    if (!fs.existsSync(p)) continue;
    try {
      const parsed = tryParseJson(fs.readFileSync(p, 'utf-8'));
      // 数组/标量不是合法 McpConfig,防止误合并损坏配置(normalizeMcpInput 内部已过滤)
      acc = deepMergeMcpConfig(acc, normalizeMcpInput(parsed));
    } catch {
      // 读文件失败忽略,继续下一源
    }
  }
  return acc;
}

function saveMcpConfig(config: McpConfig): void {
  const configPath = getMcpConfigPath();
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

export interface AddMcpServerOptions {
  transport?: MCPTransport;
  url?: string;
  headers?: Record<string, string>;
  api_key?: string;
  auth?: MCPAuth;
  oauth?: McpOAuthConfig;
  env?: Record<string, string>;
}

export function addMcpServer(
  name: string,
  command: string | undefined,
  args?: string[],
  options?: AddMcpServerOptions,
): McpServer {
  const config = loadMcpConfig();
  config.servers = config.servers.filter((s) => s.name !== name);
  const server: McpServer = { name, command, args, transport: options?.transport ?? 'stdio' };
  if (options?.env) server.env = options.env;
  if (options?.url) server.url = options.url;
  if (options?.headers) server.headers = options.headers;
  if (options?.api_key) server.api_key = options.api_key;
  if (options?.auth) server.auth = options.auth;
  if (options?.oauth) server.oauth = options.oauth;
  config.servers.push(server);
  saveMcpConfig(config);
  return server;
}

export function removeMcpServer(name: string): boolean {
  const config = loadMcpConfig();
  const before = config.servers.length;
  config.servers = config.servers.filter((s) => s.name !== name);
  if (config.servers.length < before) {
    saveMcpConfig(config);
    return true;
  }
  return false;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
