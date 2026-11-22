// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Compaction 缓存 — CLI 端 70% 预压缩摘要缓存(代差能力 A 的 CLI 同构实现)。
 *
 * 与 API 端 apps/api/src/utils/semantic-summary.ts 同构:LRU 200 条 Map,
 * 70% 占用 fire-and-forget 预生成摘要缓存,88% 真压缩命中缓存跳过阻塞式 LLM 摘要。
 *
 * 与 API 版的差异:CLI 无 FastifyRequest,LLM 摘要通过 summarize 回调注入
 * (由 agent.ts 传 compaction-v2 的 sampler 路径,保证缓存产物与实时生成一致)。
 *
 * F-090 修复:key 此前为 `sessionId|djb2(文本)`,模型与缓存版本均未入键 ⇒ 会话中途
 * 切换模型会把旧模型的摘要注入新模型上下文。现将「缓存版本 + 模型标识」纳入 key,
 * 内容哈希也从 32 位 djb2 换成 128 位 sha256 前缀(降低碰撞串味概率)。
 */

import { createHash } from 'node:crypto';
import { type ChatMessage } from './context.js';
// P3-11 同构收敛:此前本地 const 6 二次写死,改引共享包单源(与 compaction-v2 一致)。
import { DEFAULT_KEEP_RECENT } from '@ihui/context-compaction';

/** toCompress = 非 system 除最近 DEFAULT_KEEP_RECENT(单源,当前 6)条外 */
const KEEP_RECENT = DEFAULT_KEEP_RECENT;
/** 缓存容量(FIFO 淘汰),与 API 版一致 */
const CACHE_MAX = 200;

/**
 * F-090:缓存键格式版本。摘要 prompt / 摘要格式变更时递增,旧条目自然不命中,
 * 避免新旧格式的摘要互相复用。
 */
const CACHE_KEY_VERSION = '2';

/** 未显式传模型时的占位标识(仅兜底旧调用面,agent.ts/REPL 均显式传当前压缩模型) */
const UNKNOWN_MODEL = 'unknown-model';

/** 进程内 LRU(FIFO)缓存:key = 版本|模型|sessionId|内容哈希 → 摘要正文 */
const cache = new Map<string, string>();

/** 128 位内容哈希(sha256 前 32 个十六进制字符)—— 取代 32 位 djb2,降低碰撞概率 */
function hash128(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 32);
}

/** toCompress 序列化文本:非 system 消息除最近 6 条外(与 API 版 buildToCompressText 同构) */
function buildToCompressText(messages: ChatMessage[]): string {
  const nonSystem = messages.filter((m) => m.role !== 'system');
  if (nonSystem.length <= KEEP_RECENT) return '';
  const toCompress = nonSystem.slice(0, nonSystem.length - KEEP_RECENT);
  return toCompress.map((m) => `${m.role}: ${m.content}`).join('\n\n');
}

/**
 * 缓存 key:版本|模型|sessionId|内容哈希。
 * model 为生成该摘要所用模型标识(F-090:不同模型的摘要绝不互相复用)。
 */
export function getCompactionCacheKey(
  messages: ChatMessage[],
  sessionId: string,
  model?: string,
): string {
  return buildCacheKey(sessionId, model, buildToCompressText(messages));
}

/** 统一 key 拼装:prime / 查 / 回写三处必须同源,否则永远不命中 */
function buildCacheKey(sessionId: string, model: string | undefined, toCompressText: string): string {
  return `${CACHE_KEY_VERSION}|${model || UNKNOWN_MODEL}|${sessionId}|${hash128(toCompressText)}`;
}

/** 查缓存:命中返回摘要正文,未命中/null(toCompress 为空或消息不足) */
export function getCachedCompactionSummary(
  sessionId: string,
  messages: ChatMessage[],
  model?: string,
): string | null {
  if (buildToCompressText(messages) === '') return null;
  return cache.get(getCompactionCacheKey(messages, sessionId, model)) ?? null;
}

/**
 * 预生成摘要缓存:fire-and-forget,不 await,内部吞掉一切异常(预压缩失败绝不影响主链路)。
 * summarize 回调由调用方注入(复用 compaction-v2 的 sampler 路径,保证缓存产物与实时生成一致)。
 */
export function primeCompactionSummary(
  sessionId: string,
  messages: ChatMessage[],
  summarize: (text: string) => Promise<string | null>,
  model?: string,
): void {
  const toCompressText = buildToCompressText(messages);
  if (toCompressText === '') return;
  const key = buildCacheKey(sessionId, model, toCompressText);
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

/** 压缩成功后回写缓存(供同会话同模型下次复用) */
export function writeCompactionSummaryCache(
  sessionId: string,
  messages: ChatMessage[],
  summary: string,
  model?: string,
): void {
  const toCompressText = buildToCompressText(messages);
  if (toCompressText === '' || !summary || summary.trim().length === 0) return;
  writeCache(buildCacheKey(sessionId, model, toCompressText), summary);
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
