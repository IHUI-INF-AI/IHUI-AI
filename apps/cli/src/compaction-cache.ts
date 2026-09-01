// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Compaction 缓存 — CLI 端 70% 预压缩摘要缓存(代差能力 A 的 CLI 同构实现)。
 *
 * 与 API 端 apps/api/src/utils/semantic-summary.ts 同构:LRU 200 条 Map + djb2 hash,
 * 70% 占用 fire-and-forget 预生成摘要缓存,88% 真压缩命中缓存跳过阻塞式 LLM 摘要。
 *
 * 与 API 版的差异:CLI 无 FastifyRequest,LLM 摘要通过 summarize 回调注入
 * (由 agent.ts 传 compaction-v2 的 sampler 路径,保证缓存产物与实时生成一致)。
 */

import { type ChatMessage } from './context.js';

/** 与 compaction-v2 的 DEFAULT_KEEP_RECENT 一致(toCompress = 非 system 除最近 6 条外) */
const KEEP_RECENT = 6;
/** 缓存容量(FIFO 淘汰),与 API 版一致 */
const CACHE_MAX = 200;

/** 进程内 LRU(FIFO)缓存:key = sessionId|djb2 → 摘要正文 */
const cache = new Map<string, string>();

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
}

/** 测试专用:清空缓存 */
export function __clearCompactionCacheForTests(): void {
  cache.clear();
}
