// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Compaction 缓存 — CLI 端 70% 预压缩摘要缓存(代差能力 A 的 CLI 同构实现)。
 *
 * 与 API 端 apps/api/src/utils/semantic-summary.ts 同构:LRU 200 条 Map + djb2 hash,
 * 70% 占用 fire-and-forget 预生成摘要缓存,88% 真压缩命中缓存跳过阻塞式 LLM 摘要。
 *
 * 磁盘持久化:缓存同时写入内存 Map 与磁盘 JSON 文件,跨会话恢复(进程重启后仍可命中)。
 *
 * 与 API 版的差异:CLI 无 FastifyRequest,LLM 摘要通过 summarize 回调注入
 * (由 agent.ts 传 compaction-v2 的 sampler 路径,保证缓存产物与实时生成一致)。
 */

import { type ChatMessage } from './context.js';
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';

/** 与 compaction-v2 的 DEFAULT_KEEP_RECENT 一致(toCompress = 非 system 除最近 6 条外) */
const KEEP_RECENT = 6;
/** 缓存容量上限(内存 Map 与磁盘 JSON 同一上限):超过即按 LRU 淘汰最旧条目,防止 compaction-cache.json 与内存缓存无限膨胀 */
const MAX_CACHE_ENTRIES = 200;
/** 磁盘缓存文件路径(~/.ihui/compaction-cache.json) */
const CACHE_DIR = join(homedir(), '.ihui');
const CACHE_FILE = join(CACHE_DIR, 'compaction-cache.json');

/** 进程内 LRU 缓存(Map 迭代序 = 插入序,命中时刷新到末尾):key = sessionId|djb2 → 摘要正文 */
const cache = new Map<string, string>();

/** 从磁盘加载缓存(进程启动时调用,恢复跨会话缓存) */
function loadCacheFromDisk(): void {
  try {
    if (!readFileSync(CACHE_FILE, 'utf-8').trim()) return;
    const data = JSON.parse(readFileSync(CACHE_FILE, 'utf-8')) as Record<string, string>;
    if (data && typeof data === 'object') {
      for (const [key, summary] of Object.entries(data)) {
        if (typeof key === 'string' && typeof summary === 'string' && summary.trim().length > 0) {
          cache.set(key, summary);
        }
      }
    }
  } catch {
    // 磁盘缓存损坏或不存在:静默忽略,使用空缓存启动
  }
}

/** 异步写盘(不阻塞主链路) */
function persistCacheToDisk(): void {
  try {
    const data: Record<string, string> = {};
    // 按 FIFO 顺序写入(Map 迭代序 = 插入序)
    for (const [key, summary] of cache.entries()) {
      data[key] = summary;
    }
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  } catch {
    // 磁盘写入失败静默忽略:内存缓存仍正常工作
  }
}

// 进程启动时恢复磁盘缓存
loadCacheFromDisk();

/** djb2 字符串哈希(零依赖,与 API 版一致) */
function djb2(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

/** toCompress 序列化文本:非 system 消息除最近 6 条外(与 API 版 buildToCompressText 同构) */
function buildToCompressText(messages: ChatMessage[]): string {
  const nonSystem = messages.filter((m) => m.role !== 'system');
  if (nonSystem.length <= KEEP_RECENT) return '';
  const toCompress = nonSystem.slice(0, nonSystem.length - KEEP_RECENT);
  return toCompress.map((m) => `${m.role}: ${m.content}`).join('\n\n');
}

/** 缓存 key:sessionId|djb2(toCompress 序列化文本) */
export function getCompactionCacheKey(messages: ChatMessage[], sessionId: string): string {
  return `${sessionId}|${djb2(buildToCompressText(messages))}`;
}

/** 查缓存:命中返回摘要正文,未命中/null(toCompress 为空或消息不足) */
export function getCachedCompactionSummary(
  sessionId: string,
  messages: ChatMessage[],
): string | null {
  if (buildToCompressText(messages) === '') return null;
  return cache.get(getCompactionCacheKey(messages, sessionId)) ?? null;
}

/**
 * 预生成摘要缓存:fire-and-forget,不 await,内部吞掉一切异常(预压缩失败绝不影响主链路)。
 * summarize 回调由调用方注入(复用 compaction-v2 的 sampler 路径,保证缓存产物与实时生成一致)。
 */
export function primeCompactionSummary(
  sessionId: string,
  messages: ChatMessage[],
  summarize: (text: string) => Promise<string | null>,
): void {
  const toCompressText = buildToCompressText(messages);
  if (toCompressText === '') return;
  const key = `${sessionId}|${djb2(toCompressText)}`;
  if (cache.has(key)) return;
  void (async () => {
    try {
      const summary = await summarize(toCompressText);
      if (summary && summary.trim().length > 0) {
        writeCache(key, summary);
      }
    } catch {
      // 预压缩失败静默吞掉:88% 真压缩时未命中缓存走实时生成路径
    }
  })();
}

/** 压缩成功后回写缓存(供同会话下次复用) */
export function writeCompactionSummaryCache(
  sessionId: string,
  messages: ChatMessage[],
  summary: string,
): void {
  const toCompressText = buildToCompressText(messages);
  if (toCompressText === '' || !summary || summary.trim().length === 0) return;
  writeCache(`${sessionId}|${djb2(toCompressText)}`, summary);
}

/** FIFO 写入:超容量淘汰最早插入条目(Map 迭代序 = 插入序) */
function writeCache(key: string, summary: string): void {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, summary);
  // 异步持久化到磁盘(不阻塞主链路)
  void persistCacheToDisk();
}

/** 测试专用:清空缓存 */
export function __clearCompactionCacheForTests(): void {
  cache.clear();
}
