// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 本仓自带的出口规则表 —— **派生件**,不是第二份名单(§0.6)。
 *
 * 行从 ssrf-guard 的既有名单来:
 *  - `DENIED_HOST_NAMES`(localhost / ip6-localhost / ip6-loopback / metadata);
 *  - `DENIED_HOST_SUFFIXES`(.local / .internal / .internaldomain / .localhost)。
 * 那两个常量的真源在 `packages/shared/src/utils/ssrf-guard.ts`;这里只把它们**折成规则形状**
 * (id / why / 档位),不复制内容 —— 名单加了新条目,这张表自动跟着长,不需要有人记得。
 *
 * 根层单列形态(`local` 与 `**.local` 两行)是既有 glob 语义要求的:`com/example/**`
 * 不吃 `com/example` 本身(与 `file-access-policy.ts` 的"根层单列族"同一处理)。
 * 不补这一形,裸 `localhost` / 裸 `local` 就会从尺子上漏过去。
 *
 * 档位:内置行全部 **advisory**(出声 + 留痕,不拦),升 enforce 由 `IHUI_EGRESS_ENFORCE=1`
 * 或机主显式点名的 `IHUI_EGRESS_DENY_DOMAINS` 决定 —— 默认一刀切会把"本地 curl 自己的
 * dev server"这类既有工作流堵死(§12e:与本次内容无关的恒红只会逼人跳门)。
 */

import { DENIED_HOST_NAMES, DENIED_HOST_SUFFIXES } from '@ihui/shared/utils/ssrf-guard';

import type { EgressPolicy, EgressRule } from './policy.js';

function denyRule(id: string, domain: string, why: string): EgressRule {
  return { id, domain, effect: 'deny', enforcement: 'advisory', why };
}

function internalDomainRules(): EgressRule[] {
  const rows: EgressRule[] = [];
  for (const name of DENIED_HOST_NAMES) {
    rows.push(denyRule(`builtin:host:${name}`, name, 'denied host name (ssrf-guard DENIED_HOST_NAMES)'));
  }
  for (const suffix of DENIED_HOST_SUFFIXES) {
    const tld = suffix.replace(/^\./, '');
    rows.push(denyRule(`builtin:suffix:${tld}`, tld, `internal host suffix ${suffix} (ssrf-guard DENIED_HOST_SUFFIXES)`));
    rows.push(denyRule(`builtin:suffix:${tld}/**`, `**.${tld}`, `subdomains under ${suffix}`));
  }
  return rows;
}

/** 零配置即生效的内置行(advisory)。 */
export const BUILTIN_EGRESS_RULES: readonly EgressRule[] = internalDomainRules();

/** 内置兜底策略:默认放行(名字与网段都没点名时不编造限制),不开地址证据,advisory 档。 */
export const BUILTIN_EGRESS_POLICY: EgressPolicy = {
  rules: BUILTIN_EGRESS_RULES,
  defaultDecision: 'allow',
  addressProof: false,
  enforcement: 'advisory',
  source: 'builtin',
};
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
