// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DNS 侧**域名裁决**(goal-b49 复现腿,对侧 WorkBuddy 的 tsbx DNS hook 那一引擎)。
 *
 * 分工照对侧,不越界:本文件只做"这个名字/这次派生能不能出去"的裁决,
 * **不实现 TCP**、不起代理进程 —— 连接级判定属于代理层(见交付报告"未竟"段,
 * 已声明的载体是 `IHUI_EGRESS_PROXY_URL`,由 `env-inject.ts` 落成子进程 env)。
 * 一层只做一件事:两处都判必然打架(取证 W1 §2 第 17 行的原话)。
 *
 * 可注入面(超越轴:对方要真驱动才能验,这里 CI 里直接断言):
 *  - 取词 `tokenize`(默认适配器复用 `tools/command-policy/tokenizer.ts` 的唯一分词器,
 *    不再抄一份引号/分段处理 —— §0.6);
 *  - 解析 `resolver`(生产适配器待接 `node:dns`,测试注入 fake;**裁决全程零网络**)。
 *
 * 失效方向(§0.3):解析器没接线 / 抛错 / 返回 null / 枚举到 0 条地址 ⇒ **unjudged 并点名**,
 * 绝不把"判不了"记成"放行";也绝不用空结果冒充"没有内网地址"。
 * 留痕纪律:解析得到的地址**不进** judgement、不进 env、不进台账 —— 解析出的内网地址本身
 * 就是侦察结果(同 `tools/fetch-url-egress.ts` 的 message-hygiene 判据)。
 */

import { isPrivateOrReservedIp, parseIpAddress } from '@ihui/shared/utils/ssrf-guard';

import type { ArgToken, TokenizeResult } from '../../tools/command-policy/tokenizer.js';
import { tokenizeCommand } from '../../tools/command-policy/tokenizer.js';

import {
  judgeEgressTarget,
  normalizeEgressHost,
  type EgressJudgement,
  type EgressPolicy,
} from './policy.js';

/** 同步解析器:返回地址列表;拿不准返回 null(不抛 —— 抛也照样落 unjudged)。 */
export type DomainResolver = (host: string) => readonly string[] | null;

/** 取词注入面:命令行 → 带"是否含变量展开"标记的参数序列。 */
export type CommandLineTokenizer = (commandLine: string) => readonly ArgToken[];

export type TargetOrigin = 'url' | 'ip-literal' | 'dynamic';

export interface ExtractedTarget {
  readonly raw: string;
  readonly origin: TargetOrigin;
}

/** 默认分词:取所有分段的 argv(含重定向目标之外的普通参数)。 */
export const defaultCommandLineTokenizer: CommandLineTokenizer = (commandLine) => {
  const result: TokenizeResult = tokenizeCommand(commandLine);
  const out: ArgToken[] = [];
  for (const segment of result.segments) out.push(...segment.argv);
  return out;
};

/**
 * 只认两种形态(刻意保守,免得把 `10:30`、`a/b.c` 这类参数误判成出口目标):
 *  1. 带 scheme 的 http(s) URL(含 `--url=…` / `--proxy=http://…` 的 `=` 右值)——
 *     取 `new URL().hostname`,**天然不含 userinfo / path / query**(凭据与查询串进台账即事故);
 *  2. 裸 IP 字面量(纯四段数字 / 含冒号的 IPv6 形态)。
 * 3. 另:变量化参数里出现 `://` ⇒ 记一枚 `dynamic`(值不可静态确定 ⇒ 交裁决层落 unjudged,
 *    与 command-policy 求值器把"命令名是变量"钉在 unknown 是同一口径)。
 */
export function extractEgressTargets(
  commandLine: string,
  tokenize: CommandLineTokenizer = defaultCommandLineTokenizer,
): ExtractedTarget[] {
  const out: ExtractedTarget[] = [];
  const seen = new Set<string>();
  const push = (raw: string, origin: TargetOrigin): void => {
    const key = `${origin}::${raw}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ raw, origin });
  };

  for (const token of tokenize(commandLine ?? '')) {
    const value = token.value;
    if (!value) continue;
    if (token.expanded) {
      if (looksLikeNetworkArgument(value)) push('<dynamic-arg>', 'dynamic');
      continue;
    }
    for (const candidate of candidatesOf(value)) {
      const host = hostOfUrl(candidate);
      if (host !== null) {
        push(host, 'url');
        continue;
      }
      if (looksLikeIpLiteral(candidate)) push(candidate, 'ip-literal');
    }
  }
  return out;
}

/**
 * "这个被变量化的参数像不像网络目的地"——刻意只认三种线索:带 scheme、名字里独立成段的
 * url/uri、显式的 proxy 赋值。认不出就不是网络目标,不该给它造 unjudged 噪声;
 * 认得出但值取不到 ⇒ 交裁决层落 `target-unexpandable`(与 command-policy 求值器
 * 把"命令名是变量"钉在 unknown 同一口径:不知道 ≠ 可以)。
 */
export function looksLikeNetworkArgument(value: string): boolean {
  if (value.includes('://') || /\bhttps?:/i.test(value)) return true;
  return (/(^|[^a-z])(url|uri|proxy)([^a-z]|$)/i.test(value));
}

/** `--url=https://x/y` 这类形态:`=` 右值也要看一眼;其余原样。 */function candidatesOf(value: string): string[] {
  const eq = value.indexOf('=');
  if (eq > 0 && eq < value.length - 1) return [value, value.slice(eq + 1)];
  return [value];
}

function hostOfUrl(candidate: string): string | null {
  if (!/^https?:\/\//i.test(candidate)) return null;
  try {
    const host = new URL(candidate).hostname;
    return host === '' ? null : host;
  } catch {
    // URL 解析不出来:仍然交裁决层点名(unjudged),不在这里把它当"没有目标"。
    return null;
  }
}

function looksLikeIpLiteral(candidate: string): boolean {
  const host = normalizeEgressHost(candidate);
  if (host === '') return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(':') && /^[0-9a-f]+(:[0-9a-f]*)+$/.test(host);
}

export interface DnsAdjudicationOptions {
  readonly policy: EgressPolicy | null | undefined;
  /** 未接线的生产默认就是 undefined ⇒ 需要地址证据时落 unjudged(不是 allow)。 */
  readonly resolver?: DomainResolver | null;
  readonly tokenize?: CommandLineTokenizer;
}

function unjudged(
  target: string,
  layer: EgressJudgement['layer'],
  reason: string,
  hint: string,
  enforcement: EgressJudgement['enforcement'],
): EgressJudgement {
  return { target, decision: 'unjudged', layer, ruleId: null, reason, hint, enforcement };
}

function withLayer(base: EgressJudgement, reason: string, hint: string, layer: EgressJudgement['layer'] = 'dns'): EgressJudgement {
  return unjudged(base.target, layer, reason, hint, base.enforcement);
}

/**
 * 单目标裁决(纯函数,零网络)。
 *
 * 判序:`policy.judgeEgressTarget`(名字 + 网段)先行;只有它给出 **allow** 且策略
 * 显式要求地址证据(`addressProof`)时,才向注入的解析器要地址。这样默认档不会
 * 因为"解析器没接"就刷屏,也不会因为"解析器没接"就冒绿。
 */
export function adjudicateDomain(rawTarget: string, opts: DnsAdjudicationOptions): EgressJudgement {
  const base = judgeEgressTarget(rawTarget, opts.policy);
  if (base.decision !== 'allow') return base;
  if (opts.policy?.addressProof !== true) return base;
  if (base.layer === 'ip-literal') return base; // 公网字面量无需再解析

  const resolver = opts.resolver ?? null;
  if (resolver === null) {
    return withLayer(
      base,
      'dns-resolver-unwired',
      'wire a DomainResolver adapter (node:dns) into buildEgressEnvExit, or set IHUI_EGRESS_ADDRESS_PROOF=0 to drop the address-proof requirement',
    );
  }

  let addresses: readonly string[] | null = null;
  try {
    addresses = resolver(base.target);
  } catch {
    // 解析器抛错:只报"抛了",不回显异常原文(异常里常带解析结果/凭据形态)。
    return withLayer(base, 'dns-resolver-threw', 'inspect the DomainResolver adapter; a throwing resolver is a guardrail failure, not an allow');
  }
  if (addresses === null) {
    return withLayer(base, 'dns-lookup-failed', 'retry or replace the DNS adapter; a failed lookup must not be recorded as allowed');
  }
  if (addresses.length === 0) {
    return withLayer(
      base,
      'dns-no-answer',
      'the resolver returned 0 addresses; enumerating 0 is never "no internal address" (AGENTS 0.3)',
    );
  }
  // 只判不存:命中内网 ⇒ deny,但 judgement 里不落下任何地址。
  for (const addr of addresses) {
    if (parseIpAddress(addr) === null) {
      return withLayer(base, 'dns-answer-unparseable', 'the resolver returned a non-address value; treat it as guardrail failure and inspect the adapter');
    }
    if (isPrivateOrReservedIp(addr)) {
      return {
        ...base,
        decision: 'deny',
        layer: 'dns',
        reason: 'resolved-internal-range',
        ruleId: 'builtin:ip-literal',
        enforcement: base.enforcement,
        hint: 'this name resolves into an internal range; reach it by an explicitly allowed name (IHUI_EGRESS_ALLOW_DOMAINS) or route the call through the declared egress proxy',
      };
    }
  }
  return { ...base, reason: 'resolved-public' };
}

/**
 * 一批目标(派生点的实际用法):先取词,再逐条裁决,按 host 去重(留痕逐条,同一 host 不重复记账)。
 * `dynamic` 那型不经规则表 —— 它的目的地根本没取到,规则表在不在都判不出。
 */
export function adjudicateEgressTargets(
  commandLine: string,
  opts: DnsAdjudicationOptions,
): EgressJudgement[] {
  const enforcement = opts.policy?.enforcement === 'enforce' ? 'enforce' : 'advisory';
  const rows: EgressJudgement[] = [];
  const seen = new Set<string>();
  for (const t of extractEgressTargets(commandLine, opts.tokenize)) {
    if (seen.has(t.raw)) continue;
    seen.add(t.raw);
    if (t.origin === 'dynamic') {
      rows.push(
        unjudged(
          t.raw,
          'input',
          'target-unexpandable',
          'the argument contains a variable/command substitution, so its destination is not statically known; adjudicate at request time (fetch_url) instead of at spawn time',
          enforcement,
        ),
      );
      continue;
    }
    rows.push(adjudicateDomain(t.raw, opts));
  }
  return rows;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
