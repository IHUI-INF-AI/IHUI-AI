/**
 * MCP (Model Context Protocol) 服务器配置管理
 * 配置存储在 ~/.ihui/mcp.json
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export type MCPTransport = 'stdio' | 'http' | 'sse';

export interface MCPAuth {
  type: 'none' | 'bearer' | 'oauth';
  token?: string;
}

export interface McpServer {
  name: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  transport?: MCPTransport;
  url?: string;
  headers?: Record<string, string>;
  api_key?: string;
  auth?: MCPAuth;
}

export interface McpConfig {
  servers: McpServer[];
}

/** 多源扫描目录(高→低):workspace 三级 → home 三级 */
const MCP_SOURCE_DIRS = ['.ihui', '.claude', '.cursor'];

function listMcpConfigPaths(cwd: string): string[] {
  const home = os.homedir();
  const paths: string[] = [];
  for (const d of MCP_SOURCE_DIRS) paths.push(path.join(cwd, d, 'mcp.json'));
  for (const d of MCP_SOURCE_DIRS) paths.push(path.join(home, d, 'mcp.json'));
  return paths;
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
 * 扫描顺序(高→低):<cwd>/.{ihui,claude,cursor} → ~/.{ihui,claude,cursor}。
 */
export function loadMcpConfig(): McpConfig {
  const paths = listMcpConfigPaths(process.cwd());
  let acc: McpConfig = { servers: [] };
  for (const p of [...paths].reverse()) {
    if (!fs.existsSync(p)) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(p, 'utf-8')) as McpConfig;
      if (parsed && typeof parsed === 'object') {
        acc = deepMergeMcpConfig(acc, parsed);
      }
    } catch {
      // 损坏文件忽略,继续下一源
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
