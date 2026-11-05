// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * env → 生效出口策略的**取值装配**(与判据本体分家:`policy.ts` 只留规则形状与裁决,
 * 这里只把运行环境的开关折成一份 EgressPolicy,零判定复算 —— 分工同
 * `sandbox/permission-axis-runtime.ts`(判定本体在契约层,本层只做取值装配)。
 *
 * 纪律:
 *  - 内置表**永远在场**(空表不等于"本仓没有出口限制",§0.3):行来自 `./builtin-rules.ts`,
 *    那张表派生自 ssrf-guard 的既有名单,不抄第二份。
 *  - 机主点名的 deny 行天生 enforce;`IHUI_EGRESS_ENFORCE=1` 把 ip-literal / default 两层
 *    一起升档。认不出的取值一律落**更严一侧** + warning(§0.10:失效方向是多要一次定向说明,
 *    不是多放一次行)。
 *  - 零 IO / 零网络:env 由调用方显式交进来(默认 `process.env` 只是便利,测试一律注入)。
 */

import { BUILTIN_EGRESS_POLICY, BUILTIN_EGRESS_RULES } from './builtin-rules.js';
import { EGRESS_ENV, type EgressEnforcement, type EgressPolicy, type EgressRule } from './policy.js';

export interface ResolvedEgressPolicy {
  readonly policy: EgressPolicy;
  /** 非空 = 有取值被拒或被更严结算;消费点必须出声(空数组 = 全部按预期解析)。 */
  readonly warnings: readonly string[];
}

function parseList(raw: string | undefined, key: string, warnings: string[]): string[] {
  if (raw === undefined || raw.trim() === '') return [];
  const items: string[] = [];
  let malformed = 0;
  for (const part of raw.split(',')) {
    const value = part.trim().toLowerCase();
    if (value === '') malformed += 1;
    else items.push(value);
  }
  if (malformed > 0) warnings.push(`egress: ${key} has ${malformed} empty entr${malformed === 1 ? 'y' : 'ies'}; skipped`);
  return items;
}

/**
 * env → 生效出口策略(纯函数,零 IO)。
 *
 * 叠加规则:内置表永远在场;机主点名的 deny 行天生 enforce;
 * `IHUI_EGRESS_ENFORCE=1` 把 ip-literal / default 两层一起升 enforce。
 */
export function resolveEgressPolicy(env: Record<string, string | undefined> = process.env): ResolvedEgressPolicy {
  const warnings: string[] = [];

  let defaultDecision: 'allow' | 'deny' = BUILTIN_EGRESS_POLICY.defaultDecision;
  const rawDefault = env[EGRESS_ENV.default]?.trim().toLowerCase();
  if (rawDefault !== undefined && rawDefault !== '') {
    if (rawDefault === 'allow' || rawDefault === 'deny') defaultDecision = rawDefault;
    else {
      defaultDecision = 'deny';
      warnings.push(`egress: unknown ${EGRESS_ENV.default}=${JSON.stringify(rawDefault)}; using "deny" (strictest)`);
    }
  }

  const declared: EgressRule[] = [];
  for (const effect of ['deny', 'allow'] as const) {
    const key = effect === 'deny' ? EGRESS_ENV.denyDomains : EGRESS_ENV.allowDomains;
    for (const domain of parseList(env[key], key, warnings)) {
      declared.push({
        id: `env:${key}:${domain}`,
        domain,
        effect,
        enforcement: 'enforce',
        why: `declared by operator via ${key}`,
      });
    }
  }
  // 显式声明行排在内置行**之前**:裁决按声明序取首个命中,内置的 .internal/.local 族
  // 若排在前面会把"机主点名放行某个内网名"这条例外吃掉(同 file-access-policy 的例外族)。
  const rules: readonly EgressRule[] = [...declared, ...BUILTIN_EGRESS_RULES];

  let addressProof = BUILTIN_EGRESS_POLICY.addressProof;
  const rawProof = env[EGRESS_ENV.addressProof]?.trim();
  if (rawProof !== undefined && rawProof !== '') {
    if (rawProof === '1' || rawProof === '0') addressProof = rawProof === '1';
    else {
      addressProof = true;
      warnings.push(`egress: unknown ${EGRESS_ENV.addressProof}=${JSON.stringify(rawProof)}; requiring address proof (strictest)`);
    }
  }

  let enforcement: EgressEnforcement = BUILTIN_EGRESS_POLICY.enforcement;
  const rawEnforce = env[EGRESS_ENV.enforce]?.trim();
  if (rawEnforce === '0' || rawEnforce === '1') enforcement = rawEnforce === '1' ? 'enforce' : 'advisory';
  else if (rawEnforce !== undefined && rawEnforce !== '') {
    enforcement = 'enforce';
    warnings.push(`egress: unknown ${EGRESS_ENV.enforce}=${JSON.stringify(rawEnforce)}; using "enforce" (strictest)`);
  }

  return { policy: { rules, defaultDecision, addressProof, enforcement, source: 'builtin+env' }, warnings };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
