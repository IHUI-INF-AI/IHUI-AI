/**
 * MCP 凭证持久化 — ~/.ihui/mcp-credentials.json
 *
 * 策略(做减法):
 *   - 文件不存在时返回空对象 {},不抛错
 *   - JSON 解析失败回退到空对象(降级,不阻塞)
 *   - 写入时设置权限 0600(仅当前用户可读写)
 *   - Windows 兼容:fs.chmod 仅设置 owner 权限,POSIX 才有 group/other
 *
 * 数据结构:McpCredentials 按 serverUrl 为 key 索引,
 * 每个 entry 含 accessToken / refreshToken / expiresAt / scope / obtainedAt。
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

const CREDENTIALS_FILENAME = 'mcp-credentials.json';

/** 凭证文件路径解析:优先 IHUI_HOME,回退 ~/.ihui */
export function getCredentialsPath(): string {
  const ihuiHome = process.env.IHUI_HOME || path.join(os.homedir(), '.ihui');
  return path.join(ihuiHome, CREDENTIALS_FILENAME);
}

export interface McpCredentialEntry {
  accessToken?: string;
  refreshToken?: string;
  /** 过期时间(ms epoch) */
  expiresAt?: number;
  scope?: string[];
  /** 获取时间(ms epoch) */
  obtainedAt: number;
}

export interface McpCredentials {
  [serverUrl: string]: McpCredentialEntry;
}

/**
 * 加载所有 MCP 凭证。
 * - 文件不存在 → 返回 {}
 * - JSON 解析失败 → 返回 {}(降级,不抛错)
 * - 文件权限错误 → 返回 {}(不阻塞调用方)
 */
export async function loadMcpCredentials(): Promise<McpCredentials> {
  const p = getCredentialsPath();
  try {
    const raw = await fs.readFile(p, 'utf-8');
    const parsed = JSON.parse(raw) as McpCredentials;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return {};
    // JSON 解析失败或权限错误 → 降级空对象
    if (err instanceof SyntaxError) return {};
    // 其他错误(权限等)也降级,不阻塞调用方
    return {};
  }
}

/**
 * 保存全部凭证到磁盘。
 * - 自动创建父目录
 * - 写入后设置权限 0600(Windows 仅影响 owner 位,等价于仅当前用户可读写)
 */
export async function saveMcpCredentials(creds: McpCredentials): Promise<void> {
  const p = getCredentialsPath();
  const dir = path.dirname(p);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(p, JSON.stringify(creds, null, 2), 'utf-8');
  try {
    // 0o600 = rw------- (仅 owner 可读写)
    // Windows 上 chmod 只影响 owner 位,group/other 位被忽略
    await fs.chmod(p, 0o600);
  } catch {
    // Windows / 某些文件系统不支持 chmod,忽略错误(文件已写入)
  }
}

/** 获取单个 server 的凭证,不存在返回 undefined */
export async function getCredential(
  serverUrl: string,
): Promise<McpCredentialEntry | undefined> {
  const all = await loadMcpCredentials();
  return all[serverUrl];
}

/** 设置单个 server 的凭证(合并写入,不影响其他 server) */
export async function setCredential(
  serverUrl: string,
  cred: McpCredentialEntry,
): Promise<void> {
  const all = await loadMcpCredentials();
  all[serverUrl] = cred;
  await saveMcpCredentials(all);
}

/** 删除单个 server 的凭证,不存在返回 false,删除成功返回 true */
export async function deleteCredential(serverUrl: string): Promise<boolean> {
  const all = await loadMcpCredentials();
  if (!(serverUrl in all)) return false;
  delete all[serverUrl];
  await saveMcpCredentials(all);
  return true;
}

/**
 * 判断凭证是否已过期。
 * - 无 expiresAt 视为永不过期(返回 false)
 * - 距离 expiresAt 不足 skewMs 视为已过期(默认 60s 提前刷新,避免请求途中失效)
 */
export async function isExpired(
  cred: McpCredentialEntry,
  skewMs = 60_000,
): Promise<boolean> {
  if (!cred.expiresAt) return false;
  return Date.now() + skewMs >= cred.expiresAt;
}
