// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * B4-07 双引擎之一：DNS 入口 hook。
 *
 * 对照 WorkBuddy 的 `network_policy` 双引擎：DNS 侧按**域名**裁决，连接侧由 LocalProxy
 * 按 host:port 裁决。本文件只做前者：在 `dns.lookup` / `dns.resolve` 及其 promises 形态
 * 真正解析之前问一次 `checkEgress`，拒绝时返回 `EHOSTUNREACH`，不让解析器把域名变成 IP。
 *
 * 失效方向：`open` 档直接 no-op；认不出的 mode 由 `checkEgress` fail-closed。
 */

import dns from 'node:dns';
import type { NetworkEgressPolicy } from '@ihui/types';

import { checkEgress } from '../../subagents/egress-guard.js';

const DNS_REFUSAL_CODE = 'EHOSTUNREACH';

function bracketHost(host: string): string {
  return host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
}

function judgeHostname(hostname: string, policy: NetworkEgressPolicy) {
  return checkEgress(policy, `https://${bracketHost(String(hostname || ''))}`);
}

function refusalError(hostname: string, reason: string): Error {
  const err = new Error(`egress denied: ${hostname} (${reason})`) as Error & {
    code?: string;
  };
  err.code = DNS_REFUSAL_CODE;
  return err;
}

function callbackOf(args: unknown[]): ((err: Error) => void) | null {
  for (let i = args.length - 1; i >= 0; i -= 1) {
    if (typeof args[i] === 'function') return args[i] as (err: Error) => void;
  }
  return null;
}

/**
 * 安装 DNS hook。返回 uninstall；只有当前函数仍是本层 patch 时才恢复，
 * 避免把别的模块后装的 hook 一并拆掉。
 */
export function installDnsEgressHook(policy: NetworkEgressPolicy): () => void {
  if (policy.mode === 'open') return () => {};

  const originalLookup = dns.lookup;
  const originalResolve = dns.resolve;
  const originalPromisesLookup = dns.promises.lookup;
  const originalPromisesResolve = dns.promises.resolve;

  const patchedLookup = function (...args: unknown[]) {
    const hostname = String(args[0] ?? '');
    const verdict = judgeHostname(hostname, policy);
    if (!verdict.allowed) {
      const cb = callbackOf(args);
      const err = refusalError(hostname, verdict.reason);
      if (cb) queueMicrotask(() => cb(err));
      return undefined;
    }
    return (originalLookup as unknown as (...a: unknown[]) => unknown).apply(dns, args);
  } as unknown as typeof dns.lookup;

  const patchedResolve = function (...args: unknown[]) {
    const hostname = String(args[0] ?? '');
    const verdict = judgeHostname(hostname, policy);
    if (!verdict.allowed) {
      const cb = callbackOf(args);
      const err = refusalError(hostname, verdict.reason);
      if (cb) queueMicrotask(() => cb(err));
      return undefined;
    }
    return (originalResolve as unknown as (...a: unknown[]) => unknown).apply(dns, args);
  } as unknown as typeof dns.resolve;

  const patchedPromisesLookup = async function (...args: unknown[]) {
    const hostname = String(args[0] ?? '');
    const verdict = judgeHostname(hostname, policy);
    if (!verdict.allowed) throw refusalError(hostname, verdict.reason);
    return (originalPromisesLookup as unknown as (...a: unknown[]) => unknown).apply(
      dns.promises,
      args,
    );
  } as unknown as typeof dns.promises.lookup;

  const patchedPromisesResolve = async function (...args: unknown[]) {
    const hostname = String(args[0] ?? '');
    const verdict = judgeHostname(hostname, policy);
    if (!verdict.allowed) throw refusalError(hostname, verdict.reason);
    return (originalPromisesResolve as unknown as (...a: unknown[]) => unknown).apply(
      dns.promises,
      args,
    );
  } as unknown as typeof dns.promises.resolve;

  dns.lookup = patchedLookup;
  dns.resolve = patchedResolve;
  dns.promises.lookup = patchedPromisesLookup;
  dns.promises.resolve = patchedPromisesResolve;

  return () => {
    if (dns.lookup === patchedLookup) dns.lookup = originalLookup;
    if (dns.resolve === patchedResolve) dns.resolve = originalResolve;
    if (dns.promises.lookup === patchedPromisesLookup) {
      dns.promises.lookup = originalPromisesLookup;
    }
    if (dns.promises.resolve === patchedPromisesResolve) {
      dns.promises.resolve = originalPromisesResolve;
    }
  };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
