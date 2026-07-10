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

export function getMcpConfigPath(): string {
  return path.join(os.homedir(), '.ihui', 'mcp.json');
}

export function loadMcpConfig(): McpConfig {
  const configPath = getMcpConfigPath();
  if (!fs.existsSync(configPath)) return { servers: [] };
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8')) as McpConfig;
  } catch {
    return { servers: [] };
  }
}

export function saveMcpConfig(config: McpConfig): void {
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
