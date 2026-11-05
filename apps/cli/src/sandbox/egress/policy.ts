// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 子进程网络出口的**声明式规则表**(goal-b49 复现腿,对照程序 = 本机 WorkBuddy 5.9.3)。
 *
 * 立因(取证 `docs/benchmark-evidence/2026-11/qoder-trae-workbuddy-rea-20261105/W1-workbuddy-main.md`
 * §2 第 17 行 / §3 第③行):对方自带双引擎出口管控 —— DNS 侧按**域名**裁决、连接由独立 TCP
 * 代理按 `deny_ips` 裁决(`network_policy={enabled,default:"allow",deny_ips,deny_domains}`)。
 * 本仓此前只有 `tools/fetch-url-egress.ts`(单个工具的字面量出口守卫,头注写明 "NO DNS preflight"),
 * 而 `sandbox/index.ts` 内 `network|egress|proxy|dns` 现读 **0 命中** ⇒ 智能体经 Bash/终端派生的
 * 子进程网络流量无人管。本文件补"规则表 + 按名裁决"那一半;TCP 连接判定刻意不做
 * (分工照对侧:一层只做一件事,两处都判必然打架)。
 *
 * 单一真相源(§0.6,本仓记过最多次的失败型):
 *  - 通配语义**不抄第二份**:`*` 单层 / `**` 递归一律 import `../glob-pattern.ts`(folder_trust
 *    与 file-access-policy 共用那把尺)。域名按"标签逆序拼成路径"喂给它 ——
 *    域名后缀匹配 ≡ 逆序标签路径前缀匹配,于是 `*.example.com` 只吃一层、
 *    `**.example.com` 吃任意深,与既有 glob 逐字节同义(语义由用例 ③ 钉住)。
 *  - 内网网段**不抄第二份**:`isPrivateOrReservedIp` / `parseIpAddress` 来自
 *    `@ihui/shared/utils/ssrf-guard`(名单真源 `ip-literal.ts` 的 `DENIED_CIDRS`)。
 *  - 内网域名族**不抄第二份**:由既有 `DENIED_HOST_NAMES` / `DENIED_HOST_SUFFIXES` **派生**。
 *
 * 失效方向(§0.3 / §0.10):缺输入 ⇒ `unjudged` **并点名**,绝不用空表冒充"本仓没有出口限制";
 * 取值认不出 ⇒ 落更严一侧并进 `warnings`(不静默放宽)。
 */

import { isPrivateOrReservedIp, parseIpAddress } from '@ihui/shared/utils/ssrf-guard';

import { globMatches } from '../glob-pattern.js';

export type EgressDecision = 'allow' | 'deny' | 'unjudged';

/** 命中层:`input`=输入本身不可判,`rule`=域名规则表,`ip-literal`=内网网段,`default`=兜底档,`dns`=地址证据。 */
export type EgressLayer = 'input' | 'rule' | 'ip-literal' | 'default' | 'dns';

/** enforce = 派生点据此拒绝拉起子进程;advisory = 出声 + 留痕但不拦(默认档,免得一刀切死既有工作流)。 */
export type EgressEnforcement = 'enforce' | 'advisory';

export interface EgressRule {
  /** 稳定 ASCII 身份:留痕与告警按它点名,不按文案判流程。 */
  readonly id: string;
  /** 作者形态的域名模式:`example.com` / `*.example.com` / `**.example.com`(也接受 IP 字面量)。 */
  readonly domain: string;
  readonly effect: 'allow' | 'deny';
  readonly enforcement: EgressEnforcement;
  /** 为什么立这条(ASCII:这串要进子进程 env 与 jsonl 台账,不走中文以免撞 §19 硬编码门)。 */
  readonly why: string;
}

export interface EgressPolicy {
  readonly rules: readonly EgressRule[];
  /** 规则表未命中时的档位。 */
  readonly defaultDecision: 'allow' | 'deny';
  /** true = allow 档还要向 DNS 要地址证据(见 dns-adjudicator.ts;取不到解析器 ⇒ unjudged)。 */
  readonly addressProof: boolean;
  /** `ip-literal` / `default` 这两层的档位;逐条更严由 `rule.enforcement` 表达。 */
  readonly enforcement: EgressEnforcement;
  /** 规则表出处(排障要能回答"这套限制是从哪来的")。 */
  readonly source: string;
}

export interface EgressJudgement {
  readonly target: string;
  readonly decision: EgressDecision;
  readonly layer: EgressLayer;
  readonly ruleId: string | null;
  /** ASCII 机器码,调用方按它分流,不按文案。 */
  readonly reason: string;
  /** 非 allow 时的下一步出路;allow ⇒ null。 */
  readonly hint: string | null;
  readonly enforcement: EgressEnforcement;
}

/** 域名 → 逆序标签路径(`api.internal.example.com` → `com/example/internal/api`)。 */
export function domainLabelPath(host: string): string {
  return host.split('.').reverse().join('/');
}

/** 作者形态模式 → 逆序标签路径;与 `domainLabelPath` 同一把尺,保证 `*`/`**` 语义不越层。 */
export function domainPatternLabelPath(pattern: string): string {
  return domainLabelPath(pattern.trim().toLowerCase());
}

/**
 * 主机名归一:小写、去端口(仅 host:port 形态)、去 IPv6 方括号与 zone id、去尾点。
 * 与 `tools/fetch-url-egress.ts` 的 `normalizeHostname` 同一口径(那一处刻意没导出)。
 * **留痕只存这个形态** —— 不含 path/query/userinfo,凭据与查询串结构上进不了台账。
 */
export function normalizeEgressHost(raw: string): string {
  const trimmed = String(raw ?? '').trim().toLowerCase();
  const withoutBrackets = trimmed.startsWith('[') && trimmed.endsWith(']') ? trimmed.slice(1, -1) : trimmed;
  const zone = withoutBrackets.indexOf('%');
  const bare = zone >= 0 ? withoutBrackets.slice(0, zone) : withoutBrackets;
  const withoutPort = stripPort(bare);
  return withoutPort.endsWith('.') ? withoutPort.slice(0, -1) : withoutPort;
}

/** 只在"单冒号 + 纯数字尾段"这一种形态剥端口;IPv6 字面量的多冒号原样留给 parseIpAddress。 */
function stripPort(host: string): string {
  const last = host.lastIndexOf(':');
  if (last <= 0) return host;
  const colonCount = host.split(':').length - 1;
  return colonCount === 1 && /^\d{1,5}$/.test(host.slice(last + 1)) ? host.slice(0, last) : host;
}

/** 出口策略的取值开关(env 键名唯一源;装配见 `./policy-source.ts`)。 */

export const EGRESS_ENV = {
  default: 'IHUI_EGRESS_DEFAULT',
  denyDomains: 'IHUI_EGRESS_DENY_DOMAINS',
  allowDomains: 'IHUI_EGRESS_ALLOW_DOMAINS',
  addressProof: 'IHUI_EGRESS_ADDRESS_PROOF',
  enforce: 'IHUI_EGRESS_ENFORCE',
  proxyUrl: 'IHUI_EGRESS_PROXY_URL',
  ledger: 'IHUI_EGRESS_AUDIT_LOG',
} as const;


function judgement(
  target: string,
  decision: EgressDecision,
  layer: EgressLayer,
  reason: string,
  ruleId: string | null,
  hint: string | null,
  enforcement: EgressEnforcement,
): EgressJudgement {
  return { target, decision, layer, ruleId, reason, hint, enforcement };
}

/** 规则表匹配:按声明序取**首个**模式命中(`*` 单层 / `**` 递归,语义即 glob-pattern.ts)。 */
export function matchEgressRule(host: string, rules: readonly EgressRule[]): EgressRule | null {
  const labelPath = domainLabelPath(host);
  for (const rule of rules) {
    if (globMatches(domainPatternLabelPath(rule.domain), labelPath)) return rule;
  }
  return null;
}

/**
 * 按名裁决(零网络动作)。判序每一步只往更保守方向走:
 *  1. 目标取不到 ⇒ unjudged `target-missing`(不拿"没目标"冒充"允许");
 *  2. 规则表取不到 / 形状坏 / 一条都没有 ⇒ unjudged `policy-unavailable` 并点名下一步;
 *  3. 规则表首个命中(域名规则与 IP 字面量规则同尺)⇒ 由它定论,档位取**本条**的;
 *  4. 没被点名且是 IP 字面量 ⇒ `isPrivateOrReservedIp`(网段真源 = DENIED_CIDRS),档位取策略档;
 *  5. 都没说上 ⇒ `defaultDecision`。
 * "护栏自身取不到输入"永远只落在 1/2 两档,不会伪装成 3/4/5。
 */
export function judgeEgressTarget(rawTarget: string, policy: EgressPolicy | null | undefined): EgressJudgement {
  const host = normalizeEgressHost(rawTarget);
  if (host === '') {
    return judgement(
      '<empty-target>',
      'unjudged',
      'input',
      'target-missing',
      null,
      'pass an http(s) URL or an IP literal; judgeEgressTarget with an empty target is never a pass',
      'advisory',
    );
  }
  const rules = policy?.rules;
  if (!Array.isArray(rules) || rules.length === 0) {
    return judgement(
      host,
      'unjudged',
      'input',
      'policy-unavailable',
      null,
      `read the egress rule table (built-in table plus ${EGRESS_ENV.denyDomains}/${EGRESS_ENV.allowDomains}); an empty table is never "no egress limit"`,
      'advisory',
    );
  }
  const policyEnforcement: EgressEnforcement = policy!.enforcement === 'enforce' ? 'enforce' : 'advisory';

  const rule = matchEgressRule(host, rules);
  if (rule !== null) {
    if (rule.effect === 'allow') {
      return judgement(host, 'allow', 'rule', 'rule-allow', rule.id, null, rule.enforcement);
    }
    return judgement(
      host,
      'deny',
      'rule',
      'rule-deny',
      rule.id,
      `${rule.why} - allow it explicitly via ${EGRESS_ENV.allowDomains}, or keep it advisory with ${EGRESS_ENV.enforce}=0`,
      rule.enforcement,
    );
  }

  if (parseIpAddress(host) !== null) {
    if (isPrivateOrReservedIp(host)) {
      return judgement(
        host,
        'deny',
        'ip-literal',
        'internal-range',
        'builtin:ip-literal',
        `target a public address, or name this literal in ${EGRESS_ENV.allowDomains}; range checks never override a named allow rule (declaration order)`,
        policyEnforcement,
      );
    }
    return judgement(host, 'allow', 'ip-literal', 'public-literal', null, null, policyEnforcement);
  }

  return policy!.defaultDecision === 'deny'
    ? judgement(
        host,
        'deny',
        'default',
        'default-deny',
        null,
        `add an allow rule via ${EGRESS_ENV.allowDomains} if this destination is meant to be reachable`,
        policyEnforcement,
      )
    : judgement(host, 'allow', 'default', 'default-allow', null, null, policyEnforcement);
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
