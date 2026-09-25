// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 出站事实(egress facts)的共享闭集形状。
 *
 * 为什么存在:AGENTS §5b 连着记过三次同一型排查 —— "git 网络时通时不通"、"钩子进程不继承 shell env"、
 * "服务身份与交互账户的 safe.directory 互不相通"、"没配仓库级持久代理所以 post-commit worker 直连撞墙"。
 * 它们最后都靠人肉 `git config --local` / `env | grep proxy` 现读才搞清,因为**没有任何一次网络调用
 * 把"我这趟实际用了哪份代理/CA 配置"作为返回值事实带回来**。本文件把那份事实钉成一个闭集类型:
 * 出口事实挂在**响应对象**上,而不是挂在日志里。
 *
 * 凭据卫生(AGENTS 守门 67 口径):本结构的每个字段都是**事实**,不是凭据。
 *   - 只允许出现"环境变量的**名字**"(PROXY_URL / HTTPS_PROXY / NO_PROXY …),永远不允许其**取值**;
 *   - 只允许目标 **hostname**,不允许 userinfo、端口、路径、query(那些能拼出账号或内部路径);
 *   - 不允许完整 URL —— `createEgressFacts` 按白名单逐字段拷贝,结构上带不进第四个字段。
 * 新增字段前自问:把它打进日志/返回体,会不会让某个 token 有机会顺着它出来?会 ⇒ 不要加。
 */

/** 代理配置的来源。*/
export const EGRESS_PROXY_SOURCES = ['app-env-var', 'none', 'undetermined'] as const
export type EgressProxySource = (typeof EGRESS_PROXY_SOURCES)[number]

/** 本仓实测唯一在用的代理配置变量名(名字是事实,值不是)。*/
export const EGRESS_PROXY_CONFIG_VARS = ['PROXY_URL'] as const
export type EgressProxyConfigVar = (typeof EGRESS_PROXY_CONFIG_VARS)[number]

/** 走代理的域名白名单是哪一份表在生效 —— 配了 PROXY_URL 但表没覆盖该域名,与"根本没配代理"是两回事。*/
export const EGRESS_PROXY_TABLE_ORIGINS = [
  'env-override',
  'builtin-default',
  'not-evaluated',
  'undetermined',
] as const
export type EgressProxyTableOrigin = (typeof EGRESS_PROXY_TABLE_ORIGINS)[number]

/**
 * 这一趟请求真正把连接交给谁了。
 * `no-explicit-dispatcher` 只说"调用方没有显式给出 dispatcher",**不**断言"env 里的代理一定没生效" ——
 * 全局 fetch 是否吃 `*_proxy` 取决于 Node 版本与 NODE_USE_ENV_PROXY,本仓未逐版本实测过,
 * 所以不在这里写一个可能为假的事实(宁可少一档)。
 */
export const EGRESS_PROXY_APPLIED_VIA = ['proxy-agent', 'no-explicit-dispatcher'] as const
export type EgressProxyAppliedVia = (typeof EGRESS_PROXY_APPLIED_VIA)[number]

/** 进程环境里存在的通用代理变量名(逐个名字,值一律不外带)。*/
export const EGRESS_ENV_PROXY_VAR_NAMES = [
  'HTTP_PROXY',
  'http_proxy',
  'HTTPS_PROXY',
  'https_proxy',
  'ALL_PROXY',
  'all_proxy',
] as const
export type EgressEnvProxyVarName = (typeof EGRESS_ENV_PROXY_VAR_NAMES)[number]

/** NO_PROXY 的变量名(存在哪一个也是事实:大小写两档在部分客户端语义不同)。*/
export const EGRESS_NO_PROXY_VAR_NAMES = ['NO_PROXY', 'no_proxy'] as const
export type EgressNoProxyVarName = (typeof EGRESS_NO_PROXY_VAR_NAMES)[number]

/** 自定义 CA 从哪来 —— 排查"TLS 握手在代理后失败"时,这一档与代理档同样必答。*/
export const EGRESS_CA_STATES = [
  'node-extra-ca-certs',
  'node-tls-ca-certs',
  'none',
  'undetermined',
] as const
export type EgressCaState = (typeof EGRESS_CA_STATES)[number]

/**
 * 策略为什么**没**让这趟走代理。这是"被出口策略判掉"与"网络错"分野的**事实面**;
 * 错误码面见 `EgressPolicyError`(只有真的存在策略拦截的出口才使用它)。
 */
export const EGRESS_POLICY_DECLINE_REASONS = [
  'url-unparseable',
  'proxy-unconfigured',
  'internal-host',
  'domain-not-in-table',
] as const
export type EgressPolicyDeclineReason = (typeof EGRESS_POLICY_DECLINE_REASONS)[number]

/** 一趟出站请求实际生效的传输配置(事实,非凭据)。*/
export interface EgressFacts {
  /** 目标 hostname(小写,不含端口/路径/userinfo);URL 解析不出来时为 null。*/
  readonly targetHostname: string | null
  /** 目标 URL 是否可解析(不可解析本身要让下游看得见,否则会被误读成"没走代理")。*/
  readonly urlParseable: boolean
  /** 这一趟是否真的经由代理出口。*/
  readonly proxied: boolean
  /** 代理配置从哪来。*/
  readonly proxySource: EgressProxySource
  /** 生效的代理配置变量名(未配置为 null)。*/
  readonly proxyConfigVar: EgressProxyConfigVar | null
  /** 生效的是哪一份域名白名单表。*/
  readonly proxyDomainTable: EgressProxyTableOrigin
  /** 实际把连接交给了谁。*/
  readonly proxyAppliedVia: EgressProxyAppliedVia
  /** 环境里存在的通用代理变量名(空数组 = 一个都没有)。*/
  readonly envProxyVars: readonly EgressEnvProxyVarName[]
  /** 目标是否命中 NO_PROXY。*/
  readonly noProxyMatched: boolean
  /** NO_PROXY 取自哪个变量名(未设置为 null)。*/
  readonly noProxyVar: EgressNoProxyVarName | null
  /** 自定义 CA 状态。*/
  readonly customCa: EgressCaState
  /** 未走代理时,策略判掉它的原因;走了代理为 null。*/
  readonly policyDeclined: EgressPolicyDeclineReason | null
}

/** `EgressFacts` 的全部字段名 —— 唯一出口按它逐字段拷贝,白名单外一律丢弃。*/
export const EGRESS_FACT_FIELDS = [
  'targetHostname',
  'urlParseable',
  'proxied',
  'proxySource',
  'proxyConfigVar',
  'proxyDomainTable',
  'proxyAppliedVia',
  'envProxyVars',
  'noProxyMatched',
  'noProxyVar',
  'customCa',
  'policyDeclined',
] as const satisfies readonly (keyof EgressFacts)[]

/**
 * 事实装配的**唯一出口**:只把白名单字段抄进一个新对象,其余一律丢。
 *
 * 为什么要有这一步(而不是各处直接拼对象字面量):本结构的合法性和"它绝不带凭据"是同一件事。
 * 手搓字面量在第三个调用方就会顺手加个 `url` 或 `proxyUrl` 进来 —— 那正是守门 67 拦的形态。
 * 走这个出口,多余字段静默丢弃(而不是抛),于是"带不带凭据"不再取决于调用方自觉。
 */
export function createEgressFacts(input: EgressFacts): EgressFacts {
  const out: Record<string, unknown> = {}
  for (const field of EGRESS_FACT_FIELDS) out[field] = input[field]
  return Object.freeze(out) as unknown as EgressFacts
}

/**
 * ── 本票**未做**的一半:错误码分流(登记,不是已装车)────────────────────────────
 * "被出口策略拦下"与"网络/上游错误"应当是两个可判别的码 —— 前者重试无用,后者重试可能有用。
 * 现状:本仓 TS 侧没有任何一条出口在传输前**拒绝**请求 —— `apps/api/src/utils/proxy-dispatcher.ts`
 * 的白名单只做"走不走代理"的选择,从不拒发;唯一的 throw 在同一调用链上结构上不可达。
 * 于是"两个错误码"会是一台永远不响的机器:写出来只会让人以为这条缝已被看守,所以这里
 * **不放**空壳错误类与永远产不出的码。当前能回答"为什么没走代理"的是事实面 `policyDeclined`。
 * 真正接上策略闸(出站 allowlist 强制)的那张票,应同时补码 + 正反用例,并在此处收回本段。
 */

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
