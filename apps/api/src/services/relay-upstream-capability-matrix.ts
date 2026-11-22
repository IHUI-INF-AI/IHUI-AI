// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 上游能力矩阵(2026-11-18 立)。
 *
 * 立因:qoder / trae / workbuddy 三条线各自有 10~20 个协议级能力,散在不同文件里;
 * 每次"我们到底有没有这一格"都要翻代码,也无法一眼看出"哪一格是复刻、哪一格不可复现"。
 * 本层把三家放在**一张表**里,每条能力都指到真实实现位置(文件 + 函数名),
 * 状态只有三档:`implemented`(本仓自算/自解析) / `derived`(从协议常量派生) / `unreproducible`(需对方私钥或私有算法,本仓不伪造)。
 *
 * 纪律:
 *   · 每条必须带 evidence(文件:符号),指不到就删掉这条,不许"大概有";
 *   · 不列出任何凭据值、端点密钥、也不列"怎么绕过"——本层只做能力盘点;
 *   · 与对照程序的差集结论单列在 `gapNote`,写清"对方典型能力 / 本仓落点"。
 */

export type CapabilityState = 'implemented' | 'derived' | 'unreproducible'

export interface UpstreamCapability {
  id: string
  label: string
  state: CapabilityState
  /** 实现位置:相对仓库根的路径 + 符号名 */
  evidence: string
  /** 不可复现时写清为什么、走哪条替代通路 */
  note?: string
}

export interface ProviderCapabilityRow {
  providerCode: 'qoder' | 'trae' | 'workbuddy'
  label: string
  realms: string[]
  capabilities: UpstreamCapability[]
}

export const UPSTREAM_CAPABILITY_MATRIX: readonly ProviderCapabilityRow[] = [
  {
    providerCode: 'qoder',
    label: 'Qoder CN',
    realms: ['cn'],
    capabilities: [
      { id: 'device-token-refresh', label: '设备票刷新(/api/v1/deviceToken/refresh)', state: 'implemented', evidence: 'apps/api/src/services/upstream-adapters/qoder-adapter.ts:PATH_REFRESH' },
      { id: 'quota-usage', label: '配额查询(/api/v2/quota/usage, Bearer + Cosy-* 头)', state: 'implemented', evidence: 'apps/api/src/services/upstream-adapters/qoder-adapter.ts:PATH_QUOTA' },
      { id: 'cosy-header-family', label: 'Cosy 设备头族(6 个头)', state: 'implemented', evidence: 'apps/api/src/services/upstream-adapters/qoder-adapter.ts:COSY_HEADERS' },
      { id: 'cosy-request-signature', label: 'Cosy 请求签名头', state: 'unreproducible', evidence: 'apps/api/src/services/relay-cosy-capability.ts:describeCosyCapability', note: '算法在客户端内嵌 HMAC/wasm;本仓不伪造,由本机客户端桥接承担(已实证)' },
      { id: 'client-bridge', label: '本机 CLI 桥接(签名由客户端完成)', state: 'implemented', evidence: 'apps/api/src/services/upstream-adapters/qoder-cli-bridge.ts:preflightQoderBridge' },
      { id: 'device-identity', label: '稳定设备身份派生(machineid/machinetoken/sessionid)', state: 'implemented', evidence: 'apps/api/src/services/relay-device-identity.ts:deriveDeviceIdentity' },
      { id: 'pat-onboarding', label: 'PAT 引导与生效判据', state: 'implemented', evidence: 'apps/api/src/services/relay-pat-onboarding.ts:planPatOnboarding' },
    ],
  },
  {
    providerCode: 'trae',
    label: 'TRAE CN',
    realms: ['cn'],
    capabilities: [
      { id: 'exchange-token', label: '刷新票换访问票(/trae/api/v3/oauth/ExchangeToken)', state: 'implemented', evidence: 'apps/api/src/services/upstream-adapters/trae-protocol.ts:buildExchangeTokenBody' },
      { id: 'exchange-token-combos', label: '换票请求头组合族', state: 'derived', evidence: 'apps/api/src/services/upstream-adapters/trae-protocol.ts:TRAE_EXCHANGE_TOKEN_COMBOS' },
      { id: 'login-check', label: '登录态探测(CheckLogin)', state: 'implemented', evidence: 'apps/api/src/services/upstream-adapters/trae-protocol.ts:TRAE_CHECK_LOGIN_URL' },
      { id: 'sse-event-family', label: 'SSE 事件族解析与流式迭代', state: 'implemented', evidence: 'apps/api/src/services/upstream-adapters/trae-protocol.ts:splitSseBlocks' },
      { id: 'biz-session-id', label: '业务会话 ID 派生(账号+模型)', state: 'implemented', evidence: 'apps/api/src/services/upstream-adapters/trae-protocol.ts:deriveBizSessionId' },
      { id: 'reasoning-effort', label: '思考档位归一', state: 'implemented', evidence: 'apps/api/src/services/upstream-adapters/trae-protocol.ts:resolveReasoningEffortLevel' },
      { id: 'custom-model', label: '自定义模型描述构建', state: 'implemented', evidence: 'apps/api/src/services/upstream-adapters/trae-protocol.ts:buildTraeCustomModel' },
      { id: 'usage-map', label: '用量映射(含企业侧 usage)', state: 'implemented', evidence: 'apps/api/src/services/upstream-adapters/trae-protocol.ts:extractEntUsage' },
      { id: 'failure-classify', label: '上游失败分类(鉴权/网络/配额)', state: 'implemented', evidence: 'apps/api/src/services/upstream-adapters/trae-adapter.ts:classifyUpstreamFailure' },
      { id: 'device-proof-p256', label: '设备证明签名族(P-256)', state: 'derived', evidence: 'apps/api/src/services/upstream-adapters/trae-protocol.ts:P256_ORDER', note: '本仓已持有曲线阶常量与换票链路;是否签出与具体上游校验口径有关,不在本层断言' },
    ],
  },
  {
    providerCode: 'workbuddy',
    label: 'WorkBuddy',
    realms: ['cn', 'global'],
    capabilities: [
      { id: 'dual-realm', label: '双区解析与基址(cn/global)', state: 'implemented', evidence: 'apps/api/src/services/upstream-adapters/workbuddy-protocol.ts:chatBaseUrl' },
      { id: 'stable-id', label: '稳定机器/会话 ID 派生(含部署盐)', state: 'implemented', evidence: 'apps/api/src/services/upstream-adapters/workbuddy-protocol.ts:deriveStableId' },
      { id: 'request-id', label: '会话请求 ID 派生', state: 'implemented', evidence: 'apps/api/src/services/upstream-adapters/workbuddy-protocol.ts:deriveConversationRequestId' },
      { id: 'login-state', label: '登录态解析(cookie + login state)', state: 'implemented', evidence: 'apps/api/src/services/upstream-adapters/workbuddy-protocol.ts:parseLoginState' },
      { id: 'refresh-dual-endpoint', label: '刷新票双端点兜底', state: 'implemented', evidence: 'apps/api/src/services/upstream-adapters/workbuddy-protocol.ts:REFRESH_ENDPOINT_PATHS' },
      { id: 'header-family', label: 'chat/refresh/health 三族请求头', state: 'implemented', evidence: 'apps/api/src/services/upstream-adapters/workbuddy-protocol.ts:buildChatHeaders' },
      { id: 'billing-resource', label: '计费资源包与账户解析', state: 'implemented', evidence: 'apps/api/src/services/upstream-adapters/workbuddy-protocol.ts:RESOURCE_SUMMARY_PATH' },
      { id: 'billing-path-candidates', label: '计费端点候选族', state: 'derived', evidence: 'apps/api/src/services/upstream-adapters/workbuddy-protocol.ts:billingPathCandidates' },
    ],
  },
]

/** 对照程序的典型能力面,以及本仓落点(证明差集) */
export const GAP_NOTE = {
  typicalOpenSourceGateway: [
    'OpenAI 兼容层(chat/completions + SSE)',
    '账号池轮转与失败重试',
    '额度/积分统计与签到',
    '单文件 dashboard(出口卡片 + 指标卡 + 账号表 + 请求流水)',
  ],
  ourLanding: {
    'OpenAI 兼容层(chat/completions + SSE)': 'apps/api/src/routes/ai-vendors/proxy-llm.ts + apps/api/src/services/relay-upstream-adapters.ts',
    '账号池轮转与失败重试': 'apps/api/src/services/relay-account-pool-service.ts + 调度器 worker',
    '额度/积分统计与签到': 'apps/api/src/services/relay-account-pool-checkin-sync.ts + relay-welfare-claim',
    '单文件 dashboard(出口卡片 + 指标卡 + 账号表 + 请求流水)': 'apps/web admin 面 + relay-logs 13 维筛选 + CSV 导出',
  },
  verdict:
    '对照程序的四类典型能力本仓全部具备且维度更多;三家上游的协议级能力逐条列于矩阵,唯一 unreproducible 项是 Qoder 请求签名(不伪造,由客户端桥接承担)',
} as const

export function describeUpstreamCapabilityMatrix(): {
  providers: ProviderCapabilityRow[]
  totals: { providers: number; capabilities: number; implemented: number; derived: number; unreproducible: number }
  gap: typeof GAP_NOTE
} {
  const all = UPSTREAM_CAPABILITY_MATRIX.flatMap((p) => p.capabilities)
  return {
    providers: [...UPSTREAM_CAPABILITY_MATRIX],
    totals: {
      providers: UPSTREAM_CAPABILITY_MATRIX.length,
      capabilities: all.length,
      implemented: all.filter((c) => c.state === 'implemented').length,
      derived: all.filter((c) => c.state === 'derived').length,
      unreproducible: all.filter((c) => c.state === 'unreproducible').length,
    },
    gap: GAP_NOTE,
  }
}

export const __test__ = { UPSTREAM_CAPABILITY_MATRIX, GAP_NOTE }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
