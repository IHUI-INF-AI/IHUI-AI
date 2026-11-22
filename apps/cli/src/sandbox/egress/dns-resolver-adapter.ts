// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 真 DNS 解析适配器(goal-b49 Z3 腿②,补 B6 §4.2 留下的缺口:引擎此前只吃注入的同步 resolver,
 * 生产面 `addressProof` 打开后所有默认放行域名都落 `dns-resolver-unwired`)。
 *
 * 形态(按 B6 原话的解锁设计落):`node:dns/promises` 的**异步**解析 + TTL 缓存 +
 * **同步快照**读取。同步派生面(`runSandboxed` 走 spawnSync,事件循环整段被占住)结构上
 * 拿不到异步结果,所以:
 *  - 快照未命中 ⇒ 返回 null(交裁决层落 unjudged,**不是 allow**,§0.3),同时发射一次异步解析;
 *  - 下一次派生(或 relay 腿的异步面)命中缓存 ⇒ 真判;
 *  - 解析失败缓存一枚失败条目(同样 null,防每请求重打),过期后自动重试。
 *
 * 单一真相源(§0.6):本文件**零裁决逻辑** —— 地址拿到后仍走 `adjudicateDomain` 那把唯一的尺;
 * 内网网段判定住在 `@ihui/shared/utils/ssrf-guard`。地址值不进 judgement/env/台账的纪律
 * 由既有链路保持(dns-adjudicator 头注),这里也不例外。
 * 测试面:`createDnsSnapshotResolver({ lookup })` 注 fake;真 `node:dns/promises` 只在
 * 单例构造时接,用例经 `vi.mock('node:dns/promises')` 离断(禁止真联网)。
 */

import { resolve4, resolve6 } from 'node:dns/promises';

import { EGRESS_ENV } from './policy.js';

/** 解析器抛错/失败 ⇒ null(未判定);空数组是"枚举到 0 条",由裁决层落 dns-no-answer,不在这里折。 */
export type AsyncHostLookup = (host: string) => Promise<readonly string[] | null>;

/** 生产解析:AAAA 与 A 都问;两族全失败才算 null(一族成功即有可用地址证据)。 */
export const nodeDnsLookup: AsyncHostLookup = async (host) => {
  try {
    const settled = await Promise.allSettled([resolve4(host), resolve6(host)]);
    const values = settled
      .filter((r): r is PromiseFulfilledResult<string[]> => r.status === 'fulfilled')
      .map((r) => r.value);
    if (values.length === 0) return null;
    return values.flat();
  } catch {
    return null;
  }
};

export const DEFAULT_DNS_TTL_MS = 300_000;
const MIN_TTL_MS = 5_000;
const MAX_TTL_MS = 86_400_000;

interface CacheEntry {
  /** 失败条目 = 存空数组:快照读回 null(与"没查过"同一出口),但不再重打分母,过期自清。 */
  readonly addresses: readonly string[];
  readonly expiresAtMs: number;
}

export interface DnsSnapshotResolver {
  /** 同步快照:命中且未过期 ⇒ 地址;冷/失败/过期 ⇒ null(裁决层落 unjudged)。 */
  (host: string): readonly string[] | null;
  /** 发射即弃地预热一批主机名(已缓存未过期者跳过)。 */
  prewarm(hosts: readonly string[]): void;
  /** 观测面:env-inject 出声用,不进裁决。 */
  stats(): { readonly coldMisses: number; readonly pending: number };
}

export interface SnapshotResolverDeps {
  readonly lookup: AsyncHostLookup;
  readonly ttlMs?: number;
  readonly nowMs?: () => number;
}

/** 纯缓存机制(零裁决):判"能不能信"永远交回 `adjudicateDomain`。 */
export function createDnsSnapshotResolver(deps: SnapshotResolverDeps): DnsSnapshotResolver {
  const ttl = clampTtl(deps.ttlMs ?? DEFAULT_DNS_TTL_MS);
  const nowMs = deps.nowMs ?? (() => Date.now());
  const cache = new Map<string, CacheEntry>();
  const pending = new Set<string>();
  let coldMisses = 0;

  const kick = (host: string): void => {
    if (pending.has(host)) return;
    pending.add(host);
    void deps
      .lookup(host)
      .then((addresses) => {
        cache.set(host, {
          addresses: addresses ?? [],
          expiresAtMs: nowMs() + (addresses === null ? Math.min(ttl, 30_000) : ttl),
        });
      })
      .catch(() => {
        cache.set(host, { addresses: [], expiresAtMs: nowMs() + Math.min(ttl, 30_000) });
      })
      .finally(() => pending.delete(host));
  };

  const resolve = ((host: string): readonly string[] | null => {
    const entry = cache.get(host);
    if (entry !== undefined && entry.expiresAtMs > nowMs()) {
      return entry.addresses.length === 0 ? null : entry.addresses;
    }
    if (entry !== undefined) cache.delete(host);
    coldMisses += 1;
    kick(host);
    return null;
  }) as DnsSnapshotResolver;

  resolve.prewarm = (hosts) => {
    for (const host of hosts) {
      const entry = cache.get(host);
      if (entry !== undefined && entry.expiresAtMs > nowMs()) continue;
      if (pending.has(host)) continue;
      coldMisses += 1;
      kick(host);
    }
  };
  resolve.stats = () => ({ coldMisses, pending: pending.size });
  return resolve;
}

function clampTtl(raw: number): number {
  if (!Number.isFinite(raw)) return DEFAULT_DNS_TTL_MS;
  return Math.min(MAX_TTL_MS, Math.max(MIN_TTL_MS, Math.floor(raw)));
}

/** env 秒数档;认不出 ⇒ 默认 300s(快照短一些只会更早重问,失效方向不落更宽)。 */
export function ttlMsFromEnv(env: Record<string, string | undefined>): number {
  const raw = env[EGRESS_ENV.dnsTtl]?.trim();
  if (raw === undefined || raw === '') return DEFAULT_DNS_TTL_MS;
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds <= 0) return DEFAULT_DNS_TTL_MS;
  return clampTtl(seconds * 1000);
}

let singleton: DnsSnapshotResolver | null = null;

/** 进程内单例:派生点(buildEgressEnvExit)默认档取它;测试自构 `createDnsSnapshotResolver`。 */
export function getEgressDnsSnapshotResolver(
  env: Record<string, string | undefined> = process.env,
): DnsSnapshotResolver {
  if (singleton === null) {
    singleton = createDnsSnapshotResolver({ lookup: nodeDnsLookup, ttlMs: ttlMsFromEnv(env) });
  }
  return singleton;
}

/** 仅供测试重置单例(接线锁用,生产不调)。 */
export function resetEgressDnsSnapshotResolverForTests(): void {
  singleton = null;
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
