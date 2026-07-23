/**
 * 网络出站白名单检查(P1-5,worker-entry 入口拦截)。
 *
 * 对齐 ai-service/app/services/network_guard.py 的 check() 逻辑。
 * 应用层软检查:monkey-patch http/https 模块 + globalThis.fetch,拦截每次出站请求。
 * 完整网络隔离需 OS 沙箱(Linux network namespace / Windows WFP),本模块不提供。
 *
 * 接入方式(worker-entry.ts):
 *   const uninstall = installEgressGuard(policy);
 *   try { await runAgent(...); } finally { uninstall(); }
 */

import * as http from 'http';
import * as https from 'https';
import type { NetworkEgressPolicy } from '@ihui/types';

const LOG_PREFIX = '[egress-guard]';

function warn(msg: string): void {
  console.warn(`${LOG_PREFIX} ${msg}`);
}

/** 检查 URL 是否允许访问(对齐 ai-service NetworkEgressPolicy.check) */
export function checkEgress(
  policy: NetworkEgressPolicy,
  url: string,
): { allowed: boolean; reason: string } {
  if (policy.mode === 'open') return { allowed: true, reason: 'open mode' };

  // P1 修复:未知 mode FAIL-CLOSED(对齐 Python 端)
  if (policy.mode !== 'allowlist' && policy.mode !== 'blocklist') {
    return { allowed: false, reason: `unknown mode: ${policy.mode}` };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { allowed: false, reason: '无法解析 URL' };
  }

  // P1 修复:非 http/https 协议拒绝(对齐 Python 端)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { allowed: false, reason: `non-http protocol: ${parsed.protocol}` };
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

/**
 * 检查 host 是否匹配域名列表(支持通配符 *.example.com)。
 *
 * P2 修复:`*.example.com` 只匹配子域名(sub.example.com),不匹配裸域 example.com。
 * P2 修复:IP 地址跳过通配符匹配(避免 `*.0.0.1` 匹配 `127.0.0.1`)。
 */
function matchDomains(host: string, domains: string[]): boolean {
  const hostIsIp = isIp(host);
  for (const raw of domains) {
    const domain = raw.toLowerCase();
    if (domain.startsWith('*')) {
      // IP 不匹配通配符(避免 `*.0.0.1` 匹配 `127.0.0.1`)
      if (hostIsIp) continue;
      // 通配符:*.example.com 匹配 sub.example.com(及多级子域),不匹配裸域 example.com
      const suffix = domain.slice(1); // .example.com
      if (host.endsWith(suffix) && host.length > suffix.length) return true;
    } else if (host === domain) {
      return true;
    } else if (!hostIsIp && globMatch(host, domain)) {
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

/**
 * 检查是否是 localhost / loopback 地址(对齐 Python 端 _is_localhost)。
 *
 * P2 修复:扩展到 IPv4 127/8 整段 + IPv6 loopback 全形式。
 */
function isLocalhost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === 'localhost') return true;
  // IPv4 127/8 整段(loopback 网段,不只 127.0.0.1)
  if (h.startsWith('127.')) return true;
  // IPv6 loopback 各种形式
  if (
    h === '::1' ||
    h === '0:0:0:0:0:0:0:1' ||
    h === '::ffff:127.0.0.1' ||
    h === '0:0:0:0:0:0:ffff:7f00:1'
  ) {
    return true;
  }
  // 0.0.0.0(监听所有接口,视为本地)
  if (h === '0.0.0.0') return true;
  return false;
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
function extractFetchUrl(input: string | URL | Request): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/**
 * 从 http.request/get 参数提取 URL。
 *
 * Node http.request 支持两种调用形式:
 *   1. (url: string | URL, options?, callback?)
 *   2. (options: RequestOptions, callback?)
 *
 * options 中可能包含 protocol/hostname/port/path。
 */
function extractHttpUrl(
  args: any[],
  defaultProtocol: string,
): string {
  const input = args[0];
  const options = typeof input === 'string' || input instanceof URL ? args[1] : input;

  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;

  // input 是 options 对象
  const protocol = options?.protocol || defaultProtocol;
  const hostname = options?.hostname || options?.host || 'localhost';
  const port = options?.port ? `:${options.port}` : '';
  const path = options?.path || '/';
  return `${protocol}//${hostname}${port}${path}`;
}

/**
 * 包装单个 HTTP 方法(http.request / http.get / https.request / https.get)。
 *
 * 解析 URL → checkEgress → 通过则调原始函数,不通过则抛 Error。
 */
function wrapHttpMethod(
  original: Function,
  policy: NetworkEgressPolicy,
  defaultProtocol: string,
): (url: any, options?: any, callback?: any) => any {
  return (...args: any[]) => {
    const url = extractHttpUrl(args, defaultProtocol);
    const { allowed, reason } = checkEgress(policy, url);
    if (!allowed) {
      throw new Error(`${LOG_PREFIX} blocked: ${url} (${reason})`);
    }
    return original(...args);
  };
}

let _installed = false;

/**
 * 安装网络出站拦截器。
 *
 * monkey-patch http.request/http.get/https.request/https.get + globalThis.fetch,
 * 覆盖所有 Node.js HTTP 客户端(axios/node-fetch/原生 http 全部拦截)。
 *
 * open 模式直接返回 no-op。其他模式拦截每次出站请求,非白名单请求抛 Error。
 *
 * @returns uninstall 函数,调用后恢复原始函数
 */
export function installEgressGuard(policy: NetworkEgressPolicy): () => void {
  if (policy.mode === 'open') return () => {};

  // 保存原始引用
  const origHttpRequest = http.request;
  const origHttpGet = http.get;
  const origHttpsRequest = https.request;
  const origHttpsGet = https.get;

  const guardedHttpRequest = wrapHttpMethod(origHttpRequest, policy, 'http:');
  const guardedHttpGet = wrapHttpMethod(origHttpGet, policy, 'http:');
  const guardedHttpsRequest = wrapHttpMethod(origHttpsRequest, policy, 'https:');
  const guardedHttpsGet = wrapHttpMethod(origHttpsGet, policy, 'https:');

  // 每个 patch 独立 try-catch,失败不影响其他 patch
  try {
    (http as any).request = guardedHttpRequest;
  } catch (e) {
    warn(`patch http.request failed: ${(e as Error).message}`);
  }
  try {
    (http as any).get = guardedHttpGet;
  } catch (e) {
    warn(`patch http.get failed: ${(e as Error).message}`);
  }
  try {
    (https as any).request = guardedHttpsRequest;
  } catch (e) {
    warn(`patch https.request failed: ${(e as Error).message}`);
  }
  try {
    (https as any).get = guardedHttpsGet;
  } catch (e) {
    warn(`patch https.get failed: ${(e as Error).message}`);
  }

  // fetch patch(防御性:可能被其他模块 patch 或不存在)
  let originalFetch: typeof fetch | null = null;
  let guardedFetch: typeof fetch | null = null;
  try {
    if (typeof globalThis.fetch === 'function') {
      originalFetch = globalThis.fetch.bind(globalThis);
      guardedFetch = (input, init) => {
        const url = extractFetchUrl(input);
        const { allowed, reason } = checkEgress(policy, url);
        if (!allowed) {
          return Promise.reject(new Error(`${LOG_PREFIX} 出站被拒绝: ${url} (${reason})`));
        }
        return originalFetch!(input, init);
      };
      globalThis.fetch = guardedFetch;
    } else {
      warn('globalThis.fetch is not a function, skip fetch patch');
    }
  } catch (e) {
    warn(`patch fetch failed: ${(e as Error).message}`);
  }

  _installed = true;

  return () => {
    // uninstall 守卫:只恢复自己设置的 patch,避免覆盖其他模块的 patch
    try {
      if ((http as any).request === guardedHttpRequest) (http as any).request = origHttpRequest;
    } catch (e) {
      warn(`uninstall http.request failed: ${(e as Error).message}`);
    }
    try {
      if ((http as any).get === guardedHttpGet) (http as any).get = origHttpGet;
    } catch (e) {
      warn(`uninstall http.get failed: ${(e as Error).message}`);
    }
    try {
      if ((https as any).request === guardedHttpsRequest) (https as any).request = origHttpsRequest;
    } catch (e) {
      warn(`uninstall https.request failed: ${(e as Error).message}`);
    }
    try {
      if ((https as any).get === guardedHttpsGet) (https as any).get = origHttpsGet;
    } catch (e) {
      warn(`uninstall https.get failed: ${(e as Error).message}`);
    }
    try {
      if (guardedFetch !== null && globalThis.fetch === guardedFetch) {
        globalThis.fetch = originalFetch!;
      }
    } catch (e) {
      warn(`uninstall fetch failed: ${(e as Error).message}`);
    }
    _installed = false;
  };
}

/** 查询当前是否已安装 egress guard */
export function isEgressGuardInstalled(): boolean {
  return _installed;
}
