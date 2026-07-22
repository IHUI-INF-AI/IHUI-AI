/**
 * 网络出站白名单检查(P1-5,worker-entry 入口拦截)。
 *
 * 对齐 ai-service/app/services/network_guard.py 的 check() 逻辑。
 * 应用层软检查:monkey-patch globalThis.fetch,拦截每次出站请求。
 * 完整网络隔离需 OS 沙箱(Linux network namespace / Windows WFP),本模块不提供。
 *
 * 接入方式(worker-entry.ts):
 *   const uninstall = installEgressGuard(policy);
 *   try { await runAgent(...); } finally { uninstall(); }
 */

import type { NetworkEgressPolicy } from '@ihui/types';

/** 检查 URL 是否允许访问(对齐 ai-service NetworkEgressPolicy.check) */
export function checkEgress(
  policy: NetworkEgressPolicy,
  url: string,
): { allowed: boolean; reason: string } {
  if (policy.mode === 'open') return { allowed: true, reason: 'open mode' };

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { allowed: false, reason: '无法解析 URL' };
  }
  const host = (parsed.hostname || '').toLowerCase();
  if (!host) return { allowed: false, reason: '无法解析 hostname' };

  // localhost 检查
  if (isLocalhost(host)) {
    if (policy.allowLocalhost ?? true) return { allowed: true, reason: 'localhost allowed' };
    return { allowed: false, reason: 'localhost blocked by policy' };
  }

  // IP 地址检查(allowlist 模式下 IP 默认拒绝,除非显式在白名单)
  if (isIp(host)) {
    if (policy.mode === 'allowlist') {
      return { allowed: false, reason: `IP ${host} not in allowlist (IPs blocked by default)` };
    }
    // blocklist:IP 在黑名单则拒绝,否则允许
    const matched = matchDomains(host, policy.domains ?? []);
    return { allowed: !matched, reason: `IP ${host}` };
  }

  // 域名匹配
  if (policy.mode === 'allowlist') {
    if (matchDomains(host, policy.domains ?? [])) {
      return { allowed: true, reason: `${host} matches allowlist` };
    }
    return { allowed: false, reason: `${host} not in allowlist` };
  }
  // blocklist
  if (matchDomains(host, policy.domains ?? [])) {
    return { allowed: false, reason: `${host} matches blocklist` };
  }
  return { allowed: true, reason: `${host} not in blocklist` };
}

/** 检查 host 是否匹配域名列表(支持通配符 *.example.com,对齐 Python fnmatch) */
function matchDomains(host: string, domains: string[]): boolean {
  for (const raw of domains) {
    const domain = raw.toLowerCase();
    if (domain.startsWith('*')) {
      // 通配符:*.example.com 匹配 sub.example.com(及多级子域)
      const suffix = domain.slice(1); // .example.com
      if (host.endsWith(suffix) || host === domain.slice(2)) return true;
    } else if (host === domain) {
      return true;
    } else if (globMatch(host, domain)) {
      return true;
    }
  }
  return false;
}

/** 简单 glob 匹配(对齐 Python fnmatch,支持 * 和 ?) */
function globMatch(str: string, pattern: string): boolean {
  let re = '^';
  for (const ch of pattern) {
    if (ch === '*') re += '.*';
    else if (ch === '?') re += '.';
    else re += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  re += '$';
  return new RegExp(re, 'i').test(str);
}

function isLocalhost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0';
}

function isIp(host: string): boolean {
  // IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    return host.split('.').every((p) => {
      const n = parseInt(p, 10);
      return n >= 0 && n <= 255;
    });
  }
  // IPv6(含 :,URL.hostname 已去方括号)
  return host.includes(':');
}

/** 从 fetch input 提取 URL 字符串 */
function extractUrl(input: string | URL | Request): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/**
 * 安装网络出站拦截器(monkey-patch globalThis.fetch)。
 *
 * open 模式直接返回 no-op。其他模式拦截每次 fetch,非白名单请求 reject。
 *
 * @returns uninstall 函数,调用后恢复原 fetch
 */
export function installEgressGuard(policy: NetworkEgressPolicy): () => void {
  if (policy.mode === 'open') return () => {};

  const originalFetch: typeof fetch = globalThis.fetch.bind(globalThis);
  const guardedFetch: typeof fetch = (input, init) => {
    const url = extractUrl(input);
    const { allowed, reason } = checkEgress(policy, url);
    if (!allowed) {
      return Promise.reject(new Error(`[egress-guard] 出站被拒绝: ${url} (${reason})`));
    }
    return originalFetch(input, init);
  };
  globalThis.fetch = guardedFetch;

  return () => {
    globalThis.fetch = originalFetch;
  };
}
