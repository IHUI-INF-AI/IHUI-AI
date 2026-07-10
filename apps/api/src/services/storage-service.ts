/**
 * 存储服务（文件上传/下载/签名 URL）。
 * 迁移自旧架构 storage_service.py（FileStorageService，本地文件系统）。
 *
 * 设计：
 * - 本地存储为默认实现（零依赖）
 * - OSS 驱动配置通过 oss-queries 读取，预留扩展点
 * - 上传文件以 file_id 为名存储，支持元数据(sidecar .meta)与缩略图
 */

import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { env } from 'node:process';

const BASE_DIR = env.STORAGE_DIR ?? 'storage';
const UPLOADS_DIR = join(BASE_DIR, 'uploads');
const THUMBNAILS_DIR = join(BASE_DIR, 'thumbnails');
const CACHE_DIR = join(BASE_DIR, 'cache');

/** 确保目录存在（幂等）。 */
function ensureDirs(): void {
  for (const dir of [UPLOADS_DIR, THUMBNAILS_DIR, CACHE_DIR]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
}

export interface SavedFile {
  id: string;
  size: number;
  hash: string;
  path: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface FileInfo {
  id: string;
  size: number;
  createdAt: string;
  modifiedAt: string;
  metadata?: Record<string, unknown>;
}

export interface StorageStats {
  totalFiles: number;
  totalSize: number;
  uploadsDir: string;
  thumbnailsDir: string;
  cacheDir: string;
}

function filePath(fileId: string): string {
  return join(UPLOADS_DIR, fileId);
}

function thumbnailPath(fileId: string): string {
  return join(THUMBNAILS_DIR, `${fileId}.jpg`);
}

function metaPath(fileId: string): string {
  return `${filePath(fileId)}.meta`;
}

/** 生成新 file_id。 */
export function generateFileId(): string {
  return randomUUID();
}

/** 保存文件内容（含可选元数据 sidecar）。 */
export function saveFile(
  content: Buffer,
  fileId: string = generateFileId(),
  metadata?: Record<string, unknown>,
): SavedFile {
  ensureDirs();
  const path = filePath(fileId);
  writeFileSync(path, content);
  const hash = createHash('sha256').update(content).digest('hex');

  if (metadata) {
    writeFileSync(metaPath(fileId), JSON.stringify(metadata));
  }

  return {
    id: fileId,
    size: content.length,
    hash,
    path,
    createdAt: new Date().toISOString(),
    metadata,
  };
}

/** 读取文件内容。不存在返回 null。 */
export function readFile(fileId: string): Buffer | null {
  const path = filePath(fileId);
  if (!existsSync(path)) return null;
  return readFileSync(path);
}

/** 删除文件（含元数据与缩略图）。返回是否删除了主文件。 */
export function deleteFile(fileId: string): boolean {
  const path = filePath(fileId);
  let deleted = false;
  if (existsSync(path)) {
    unlinkSync(path);
    deleted = true;
  }
  const meta = metaPath(fileId);
  if (existsSync(meta)) unlinkSync(meta);
  const thumb = thumbnailPath(fileId);
  if (existsSync(thumb)) unlinkSync(thumb);
  return deleted;
}

/** 获取文件信息（大小、时间、元数据）。不存在返回 null。 */
export function getFileInfo(fileId: string): FileInfo | null {
  const path = filePath(fileId);
  if (!existsSync(path)) return null;
  const stat = statSync(path);
  const info: FileInfo = {
    id: fileId,
    size: stat.size,
    createdAt: stat.birthtime.toISOString(),
    modifiedAt: stat.mtime.toISOString(),
  };
  const meta = metaPath(fileId);
  if (existsSync(meta)) {
    try {
      info.metadata = JSON.parse(readFileSync(meta, 'utf-8'));
    } catch {
      /* 元数据损坏时忽略 */
    }
  }
  return info;
}

/** 列出上传目录下的文件（分页）。 */
export function listFiles(limit = 100, offset = 0): Array<{
  id: string;
  size: number;
  modifiedAt: string;
}> {
  ensureDirs();
  const entries = readdirSync(UPLOADS_DIR)
    .filter((name) => !name.endsWith('.meta'))
    .map((name) => {
      const stat = statSync(join(UPLOADS_DIR, name));
      return { id: name, size: stat.size, modifiedAt: stat.mtime.toISOString() };
    })
    .slice(offset, offset + limit);
  return entries;
}

/** 保存缩略图，返回存储路径。 */
export function saveThumbnail(fileId: string, thumbnail: Buffer): string {
  ensureDirs();
  const path = thumbnailPath(fileId);
  writeFileSync(path, thumbnail);
  return path;
}

/** 读取缩略图。不存在返回 null。 */
export function getThumbnail(fileId: string): Buffer | null {
  const path = thumbnailPath(fileId);
  if (!existsSync(path)) return null;
  return readFileSync(path);
}

/** 存储统计：文件数、总大小。 */
export function getStorageStats(): StorageStats {
  ensureDirs();
  let totalSize = 0;
  let totalFiles = 0;
  for (const name of readdirSync(UPLOADS_DIR)) {
    if (name.endsWith('.meta')) continue;
    const stat = statSync(join(UPLOADS_DIR, name));
    totalSize += stat.size;
    totalFiles++;
  }
  return {
    totalFiles,
    totalSize,
    uploadsDir: resolve(UPLOADS_DIR),
    thumbnailsDir: resolve(THUMBNAILS_DIR),
    cacheDir: resolve(CACHE_DIR),
  };
}

/**
 * 生成签名下载 URL。
 * 本地存储模式下生成带 HMAC 签名的临时 URL（由路由层解析校验）。
 * OSS 模式下应调用对应驱动的 presigned URL 接口（预留扩展）。
 *
 * @param key 文件 ID 或对象 key
 * @param expiresIn 有效期（秒），默认 3600
 */
export function getSignedUrl(key: string, expiresIn = 3600): string {
  const secret = env.JWT_SECRET ?? 'storage-secret';
  const expires = Math.floor(Date.now() / 1000) + expiresIn;
  const payload = `${key}:${expires}`;
  const signature = createHash('sha256')
    .update(`${payload}:${secret}`)
    .digest('hex')
    .slice(0, 32);
  const params = new URLSearchParams({ key, expires: String(expires), sig: signature });
  return `/api/files/signed?${params.toString()}`;
}

/** 校验签名 URL（路由层调用）。 */
export function verifySignedUrl(key: string, expires: number, sig: string): boolean {
  if (expires * 1000 < Date.now()) return false;
  const secret = env.JWT_SECRET ?? 'storage-secret';
  const payload = `${key}:${expires}`;
  const expected = createHash('sha256')
    .update(`${payload}:${secret}`)
    .digest('hex')
    .slice(0, 32);
  return expected === sig;
}

// =============================================================================
// 缓存（文件级，带 TTL sidecar）
// =============================================================================

export function getCache(key: string): Buffer | null {
  const path = join(CACHE_DIR, key);
  if (!existsSync(path)) return null;
  const ttlPath = `${path}.ttl`;
  if (existsSync(ttlPath)) {
    const expiresAt = parseFloat(readFileSync(ttlPath, 'utf-8'));
    if (Date.now() / 1000 > expiresAt) return null;
  }
  return readFileSync(path);
}

export function setCache(key: string, value: Buffer, ttlSeconds = 3600): void {
  ensureDirs();
  const path = join(CACHE_DIR, key);
  writeFileSync(path, value);
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  writeFileSync(`${path}.ttl`, String(expiresAt));
}

/** 清理过期缓存，返回清理数量。 */
export function cleanupCache(): number {
  ensureDirs();
  let cleaned = 0;
  const now = Date.now() / 1000;
  for (const name of readdirSync(CACHE_DIR)) {
    if (!name.endsWith('.ttl')) continue;
    const ttlPath = join(CACHE_DIR, name);
    const expiresAt = parseFloat(readFileSync(ttlPath, 'utf-8'));
    if (now > expiresAt) {
      const dataPath = join(CACHE_DIR, name.replace(/\.ttl$/, ''));
      if (existsSync(dataPath)) unlinkSync(dataPath);
      unlinkSync(ttlPath);
      cleaned++;
    }
  }
  return cleaned;
}
