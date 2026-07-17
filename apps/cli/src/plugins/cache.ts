/**
 * Plugins Marketplace Git URL 缓存 — 避免重复 git clone 远程仓库。
 *
 * 设计:
 *   - 每个 URL 对应 ~/.ihui/marketplace-cache/<sha1(url)>/ 目录
 *   - 缓存 TTL 默认 5 分钟,过期后尝试刷新,失败则降级复用过期缓存
 *   - 无网络容错:clone 失败时若存在过期缓存,降级返回(不抛错)
 *   - 测试钩子:IHUI_MOCK_GIT_CLONE_SRC(模拟 clone 成功)/ IHUI_GIT_BIN(自定义 git 二进制路径)
 *
 * 缓存目录布局:
 *   ~/.ihui/marketplace-cache/
 *     <sha1(url-A)>/    ← 完整 git 仓库(浅克隆)
 *     <sha1(url-B)>/
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { getMarketplaceCacheDir } from './paths.js';

/** 缓存条目元信息(供调试与诊断) */
export interface CacheEntry {
  url: string;
  localPath: string;
  cachedAt: number;
  ttlMs: number;
}

/** 默认 TTL:5 分钟 */
const DEFAULT_TTL_MS = 5 * 60 * 1000;

/** 测试用:模拟 clone 来源目录(设置后跳过真实 git 调用,直接复制该目录) */
const MOCK_CLONE_SRC_ENV = 'IHUI_MOCK_GIT_CLONE_SRC';

/** 测试用:自定义 git 二进制路径(默认 'git'),指向不存在路径可模拟无网络 */
const GIT_BIN_ENV = 'IHUI_GIT_BIN';

/**
 * 计算 URL 对应的缓存路径 — sha1(url) 哈希作为目录名,避免特殊字符。
 * 返回绝对路径,不保证目录存在。
 */
export function getCachePath(url: string): string {
  const hash = crypto.createHash('sha1').update(url).digest('hex');
  return path.join(getMarketplaceCacheDir(), hash);
}

/** 递归复制目录(内部工具,供 mock clone 与降级使用) */
function copyDirRecursive(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(s, d);
    } else if (entry.isSymbolicLink()) {
      const target = fs.readlinkSync(s);
      const resolved = path.isAbsolute(target) ? target : path.resolve(path.dirname(s), target);
      if (fs.statSync(resolved).isDirectory()) {
        copyDirRecursive(resolved, d);
      } else {
        fs.copyFileSync(resolved, d);
      }
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

/** 执行 git clone(或测试 mock)到 target 目录 */
function performClone(url: string, target: string, ref?: string, sha?: string): void {
  const mockSrc = process.env[MOCK_CLONE_SRC_ENV];
  if (mockSrc) {
    // 测试钩子:复制指定目录作为 clone 结果
    copyDirRecursive(mockSrc, target);
    return;
  }
  const gitBin = process.env[GIT_BIN_ENV] || 'git';
  const args = ['clone', '--depth', '1'];
  if (ref) args.push('--branch', ref);
  args.push(url, target);
  execFileSync(gitBin, args, { stdio: 'pipe' });
  if (sha) {
    // 拉取指定 commit 并 checkout(SHA pin)
    execFileSync(gitBin, ['-C', target, 'fetch', '--depth=1', 'origin', sha], { stdio: 'pipe' });
    execFileSync(gitBin, ['-C', target, 'checkout', sha], { stdio: 'pipe' });
  }
}

/**
 * 获取或创建 Git URL 的本地缓存目录。
 *
 * 流程:
 *   1. 缓存命中(存在且未过期)→ 直接返回,fromCache=true
 *   2. 缓存过期 → 尝试刷新(clone 到临时目录后替换);失败则降级复用过期缓存
 *   3. 无缓存 → 必须 clone;失败抛错(无降级路径)
 *
 * @param url Git 仓库 URL
 * @param opts.ref 分支/tag 名(浅克隆)
 * @param opts.sha 指定 commit SHA(pin 到具体提交)
 * @param opts.ttlMs 缓存 TTL(默认 5 分钟)
 */
export async function getOrCloneGitCache(
  url: string,
  opts?: { ref?: string; sha?: string; ttlMs?: number },
): Promise<{ localPath: string; fromCache: boolean }> {
  const localPath = getCachePath(url);
  const ttl = opts?.ttlMs ?? DEFAULT_TTL_MS;

  if (fs.existsSync(localPath)) {
    const stat = fs.statSync(localPath);
    const ageMs = Date.now() - stat.mtimeMs;
    if (ageMs < ttl) {
      // 缓存命中
      return { localPath, fromCache: true };
    }
    // 缓存过期:尝试刷新
    const tmpPath = `${localPath}.tmp.${process.pid}.${Date.now()}`;
    try {
      fs.rmSync(tmpPath, { recursive: true, force: true });
      performClone(url, tmpPath, opts?.ref, opts?.sha);
      // 刷新成功:替换旧缓存
      fs.rmSync(localPath, { recursive: true, force: true });
      fs.renameSync(tmpPath, localPath);
      // 更新 mtime 标记刷新时刻
      const now = new Date();
      fs.utimesSync(localPath, now, now);
      return { localPath, fromCache: false };
    } catch {
      // 离线降级:复用过期缓存,不抛错
      fs.rmSync(tmpPath, { recursive: true, force: true });
      return { localPath, fromCache: true };
    }
  }

  // 无缓存:必须 clone
  fs.mkdirSync(getMarketplaceCacheDir(), { recursive: true });
  performClone(url, localPath, opts?.ref, opts?.sha);
  const now = new Date();
  fs.utimesSync(localPath, now, now);
  return { localPath, fromCache: false };
}

/**
 * 清空整个 marketplace 缓存目录下的所有条目(不删除缓存根目录本身)。
 * 用于强制刷新或磁盘清理。
 */
export function clearMarketplaceCache(): void {
  const dir = getMarketplaceCacheDir();
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) {
    const p = path.join(dir, entry);
    fs.rmSync(p, { recursive: true, force: true });
  }
}
