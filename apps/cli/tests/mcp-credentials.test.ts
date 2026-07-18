/**
 * MCP 凭证持久化测试 — 覆盖 load/save/get/set/delete + 边界场景。
 *
 * 覆盖点:
 *   1. loadMcpCredentials 在文件不存在时返回 {}
 *   2. saveMcpCredentials + loadMcpCredentials 往返一致
 *   3. getCredential / setCredential / deleteCredential 行为
 *   4. JSON 解析失败回退空对象(降级,不抛错)
 *   5. 文件权限 0600(POSIX 才能真正验证,Windows 验证不抛错)
 *   6. isExpired 在不同 expiresAt / skewMs 下的行为
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  loadMcpCredentials,
  saveMcpCredentials,
  getCredential,
  setCredential,
  deleteCredential,
  isExpired,
  getCredentialsPath,
  type McpCredentials,
} from '../src/tools/mcp-credentials.js';

describe('mcp-credentials 凭证持久化', () => {
  let tmpHome: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'ihui-creds-test-'));
    originalEnv = { ...process.env };
    // 用临时 HOME 隔离测试(不污染真实 ~/.ihui)
    process.env.IHUI_HOME = tmpHome;
  });

  afterEach(async () => {
    process.env = originalEnv;
    await fs.rm(tmpHome, { recursive: true, force: true });
  });

  it('loadMcpCredentials 在文件不存在时返回 {}', async () => {
    const creds = await loadMcpCredentials();
    expect(creds).toEqual({});
  });

  it('saveMcpCredentials + loadMcpCredentials 往返一致', async () => {
    const input: McpCredentials = {
      'https://mcp.example.com': {
        accessToken: 'token-abc',
        refreshToken: 'refresh-def',
        expiresAt: Date.now() + 3600_000,
        scope: ['read', 'write'],
        obtainedAt: Date.now(),
      },
    };
    await saveMcpCredentials(input);
    const loaded = await loadMcpCredentials();
    expect(loaded).toEqual(input);
  });

  it('getCredential 返回指定 server 的凭证', async () => {
    const url = 'https://mcp.example.com';
    await setCredential(url, {
      accessToken: 'tok',
      obtainedAt: 1000,
    });
    const cred = await getCredential(url);
    expect(cred).toBeDefined();
    expect(cred!.accessToken).toBe('tok');
    expect(cred!.obtainedAt).toBe(1000);
  });

  it('getCredential 不存在时返回 undefined', async () => {
    const cred = await getCredential('https://not-exist.example.com');
    expect(cred).toBeUndefined();
  });

  it('setCredential 合并写入,不影响其他 server', async () => {
    await setCredential('https://a.example.com', { accessToken: 'a', obtainedAt: 1 });
    await setCredential('https://b.example.com', { accessToken: 'b', obtainedAt: 2 });
    const all = await loadMcpCredentials();
    expect(Object.keys(all).sort()).toEqual([
      'https://a.example.com',
      'https://b.example.com',
    ]);
    expect(all['https://a.example.com'].accessToken).toBe('a');
    expect(all['https://b.example.com'].accessToken).toBe('b');
  });

  it('setCredential 覆盖同 server 的旧凭证', async () => {
    const url = 'https://mcp.example.com';
    await setCredential(url, { accessToken: 'old', obtainedAt: 1 });
    await setCredential(url, { accessToken: 'new', obtainedAt: 2 });
    const cred = await getCredential(url);
    expect(cred!.accessToken).toBe('new');
    expect(cred!.obtainedAt).toBe(2);
  });

  it('deleteCredential 删除成功返回 true', async () => {
    const url = 'https://mcp.example.com';
    await setCredential(url, { accessToken: 'tok', obtainedAt: 1 });
    const deleted = await deleteCredential(url);
    expect(deleted).toBe(true);
    const cred = await getCredential(url);
    expect(cred).toBeUndefined();
  });

  it('deleteCredential 不存在时返回 false', async () => {
    const deleted = await deleteCredential('https://not-exist.example.com');
    expect(deleted).toBe(false);
  });

  it('JSON 解析失败回退空对象(降级,不抛错)', async () => {
    const p = getCredentialsPath();
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, '{not valid json', 'utf-8');
    const creds = await loadMcpCredentials();
    expect(creds).toEqual({});
  });

  it('文件内容为非对象(JSON 数组)时回退空对象', async () => {
    const p = getCredentialsPath();
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, '["not", "an", "object"]', 'utf-8');
    const creds = await loadMcpCredentials();
    expect(creds).toEqual({});
  });

  it('文件内容为 null 时回退空对象', async () => {
    const p = getCredentialsPath();
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, 'null', 'utf-8');
    const creds = await loadMcpCredentials();
    expect(creds).toEqual({});
  });

  it('saveMcpCredentials 设置文件权限 0600(POSIX)或不抛错(Windows)', async () => {
    await saveMcpCredentials({ 'https://x.example.com': { accessToken: 't', obtainedAt: 1 } });
    const p = getCredentialsPath();
    const stat = await fs.stat(p);
    // POSIX:0o600 = 0o100600 (文件类型 + 权限)
    // Windows:chmod 只影响 owner 位,这里只验证文件已创建且可读
    expect(stat.isFile()).toBe(true);
    if (process.platform !== 'win32') {
      // POSIX 验证权限位(低 9 位应为 0o600 = rw-------)
      expect(stat.mode & 0o777).toBe(0o600);
    }
  });

  it('saveMcpCredentials 自动创建父目录', async () => {
    // 设置 IHUI_HOME 为不存在的嵌套目录,验证 saveMcpCredentials 自动创建父目录
    process.env.IHUI_HOME = path.join(tmpHome, 'nested', 'ihui-home');
    const p = getCredentialsPath();
    // 父目录不存在
    await expect(fs.access(path.dirname(p))).rejects.toThrow();
    await saveMcpCredentials({ 'https://x.example.com': { accessToken: 't', obtainedAt: 1 } });
    // 文件已创建
    const stat = await fs.stat(p);
    expect(stat.isFile()).toBe(true);
  });
});

describe('isExpired 过期判断', () => {
  it('无 expiresAt 视为永不过期', async () => {
    const cred = { obtainedAt: 1000 };
    expect(await isExpired(cred)).toBe(false);
  });

  it('expiresAt 在未来 → 未过期', async () => {
    const cred = { obtainedAt: 1000, expiresAt: Date.now() + 3600_000 };
    expect(await isExpired(cred)).toBe(false);
  });

  it('expiresAt 已过 → 已过期', async () => {
    const cred = { obtainedAt: 1000, expiresAt: Date.now() - 1000 };
    expect(await isExpired(cred)).toBe(true);
  });

  it('距离 expiresAt 不足 skewMs → 视为已过期(提前刷新)', async () => {
    const now = Date.now();
    const cred = { obtainedAt: now, expiresAt: now + 30_000 }; // 30s 后过期
    // skewMs=60_000:now + 60_000 >= expiresAt(now + 30_000) → true
    expect(await isExpired(cred, 60_000)).toBe(true);
  });

  it('skewMs=0 时,只有真正过期才返回 true', async () => {
    const now = Date.now();
    const cred = { obtainedAt: now, expiresAt: now + 1000 }; // 1s 后过期
    expect(await isExpired(cred, 0)).toBe(false);
  });
});
