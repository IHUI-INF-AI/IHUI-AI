// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
 * 每个 entry 含 accessToken / refreshToken / expiresAt / scope / obtainedAt / generation。
 * generation 是"换代计数器"(跨进程单飞刷新的 CAS 锚点),缺省视为 0。
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
  /**
   * 代次(单飞刷新的 CAS 锚点,2026-09-28 票A 引入)。
   * 语义:每次**换发凭据**单调 +1 —— setCredential(交互授权/兼容写)与
   * commitCredentialCas(锁内刷新提交)都会推进它,旧条目缺省视为 0。
   * 刷新单飞在取锁**前**观察它、锁内**再**读它:值变了 ⇒ 别的进程已经换代,
   * 绝不再发第二次 refresh_token 请求(reuse-detection 会撤销整个 token family),
   * 直接复用 winner 落库的结果。它不是时间戳,也不承载任何凭据内容。
   */
  generation?: number;
}

export interface McpCredentials {
  [serverUrl: string]: McpCredentialEntry;
}

/** 读取指定 server 的凭证与其代次(不存在 ⇒ entry=undefined, generation=0) */
export async function getCredentialWithGeneration(
  serverUrl: string,
): Promise<{ entry: McpCredentialEntry | undefined; generation: number }> {
  const all = await loadMcpCredentials();
  const entry = all[serverUrl];
  const raw = entry?.generation;
  // 非有限数/负数 ⇒ 按 0(缺省档),绝不让损坏的代次把 CAS 变成"永远不等"
  const generation = typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 0;
  return { entry, generation };
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

/**
 * 设置单个 server 的凭证(合并写入,不影响其他 server)。
 * 代次推进(票A):调用方未显式携带 generation 时,一律在当前值上 +1 ——
 * 交互授权完成、兼容路径覆写都必须让并发刷新观察得到"换代了",
 * 否则单飞的锁内复核看不见变化,会继续用旧 refresh_token 发第二次请求。
 */
export async function setCredential(
  serverUrl: string,
  cred: McpCredentialEntry,
): Promise<void> {
  const all = await loadMcpCredentials();
  const prev = all[serverUrl];
  const prevGen =
    typeof prev?.generation === 'number' && Number.isFinite(prev.generation) && prev.generation >= 0
      ? Math.floor(prev.generation)
      : 0;
  all[serverUrl] = { ...cred, generation: cred.generation ?? prevGen + 1 };
  await saveMcpCredentials(all);
}

/**
 * 代次 CAS 提交(票A 唯一合法的程序化写入口):
 * 当前 generation 仍等于 expectedGeneration 才写入,并把代次推进 1;
 * 不等 ⇒ **不落盘**,原样带回当前 entry 供调用方复用(winner 的结果优先)。
 * 文件级读-改-写非原子,原子性由调用侧的跨进程单飞锁
 * (mcp-oauth.ts 的 mcp-refresh.lock)保证;锁被抢占等极端并发下,
 * expectedGeneration 这道判据是最后一道"不把别人的结果覆盖掉"的闸。
 */
export async function commitCredentialCas(
  serverUrl: string,
  cred: McpCredentialEntry,
  expectedGeneration: number,
): Promise<{ committed: boolean; generation: number; current: McpCredentialEntry | undefined }> {
  const all = await loadMcpCredentials();
  const current = all[serverUrl];
  const raw = current?.generation;
  const curGen = typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 0;
  if (curGen !== expectedGeneration) {
    return { committed: false, generation: curGen, current };
  }
  const nextGen = curGen + 1;
  all[serverUrl] = { ...cred, generation: nextGen };
  await saveMcpCredentials(all);
  return { committed: true, generation: nextGen, current: all[serverUrl] };
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
