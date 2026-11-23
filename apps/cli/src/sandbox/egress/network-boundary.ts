// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * B4-07 双引擎装配：DNS hook（按名裁决）+ 常驻 TCP LocalProxy（按 host:port 裁决）。
 *
 * 装配顺序必须是「先起代理、后开 DNS hook」：代理自身连上游时也会走 DNS，
 * 若 hook 先装而代理还没就绪，会多一次误判；两者共用 `checkEgress`，判据不分叉。
 *
 * env 接线：`HTTP_PROXY` / `HTTPS_PROXY` / `ALL_PROXY` 指向本机代理，
 * 让 curl / git / 语言包管理器这些不读 Node monkey-patch 的子进程也走同一条边界。
 * `NO_PROXY` 只放行显式配置的本机代理自身，避免代理回环。
 */

import type { NetworkEgressPolicy } from '@ihui/types';

import { installDnsEgressHook } from './dns-hook.js';
import { startEgressLocalProxy, type LocalProxyHandle } from './local-proxy.js';

export const NETWORK_BOUNDARY_PROXY_ENV = {
  http: 'HTTP_PROXY',
  https: 'HTTPS_PROXY',
  all: 'ALL_PROXY',
  no: 'NO_PROXY',
} as const;

export interface NetworkBoundaryHandle {
  readonly proxyUrl: string | null;
  uninstall(): Promise<void>;
}

function openBoundary(): NetworkBoundaryHandle {
  return {
    proxyUrl: null,
    uninstall: async () => {},
  };
}

/**
 * 按策略装配双引擎。`open` 档不启动代理、不装 hook，零行为变化。
 */
export async function installNetworkBoundary(
  policy: NetworkEgressPolicy | undefined | null,
): Promise<NetworkBoundaryHandle> {
  if (!policy || policy.mode === 'open') return openBoundary();

  let proxy: LocalProxyHandle;
  try {
    proxy = await startEgressLocalProxy({ policy });
  } catch (err) {
    throw new Error(`B4-07 本地出口代理启动失败: ${(err as Error).message}`);
  }

  const uninstallDns = installDnsEgressHook(policy);
  const previous = {
    http: process.env[NETWORK_BOUNDARY_PROXY_ENV.http],
    https: process.env[NETWORK_BOUNDARY_PROXY_ENV.https],
    all: process.env[NETWORK_BOUNDARY_PROXY_ENV.all],
    no: process.env[NETWORK_BOUNDARY_PROXY_ENV.no],
  };

  process.env[NETWORK_BOUNDARY_PROXY_ENV.http] = proxy.url;
  process.env[NETWORK_BOUNDARY_PROXY_ENV.https] = proxy.url;
  process.env[NETWORK_BOUNDARY_PROXY_ENV.all] = proxy.url;
  process.env[NETWORK_BOUNDARY_PROXY_ENV.no] = `${proxy.host},localhost,${previous.no ?? ''}`;

  return {
    proxyUrl: proxy.url,
    uninstall: async () => {
      uninstallDns();
      if (previous.http === undefined) delete process.env[NETWORK_BOUNDARY_PROXY_ENV.http];
      else process.env[NETWORK_BOUNDARY_PROXY_ENV.http] = previous.http;
      if (previous.https === undefined) delete process.env[NETWORK_BOUNDARY_PROXY_ENV.https];
      else process.env[NETWORK_BOUNDARY_PROXY_ENV.https] = previous.https;
      if (previous.all === undefined) delete process.env[NETWORK_BOUNDARY_PROXY_ENV.all];
      else process.env[NETWORK_BOUNDARY_PROXY_ENV.all] = previous.all;
      if (previous.no === undefined) delete process.env[NETWORK_BOUNDARY_PROXY_ENV.no];
      else process.env[NETWORK_BOUNDARY_PROXY_ENV.no] = previous.no;
      await proxy.close();
    },
  };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
