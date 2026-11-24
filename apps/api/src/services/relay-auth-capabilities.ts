// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池自助授权的**能力声明表**（唯一真相源，AGENTS §0.6）。
 *
 * 2026-11-17 立。对标程序：qoder2api 系开源网关（shuishuipingan/qoder2api-hub 为代表），
 * 它们的「+ 添加账号 (OAuth)」是一枚硬编码在 UI 后面的单边实现；本表把这件事拆成三层，
 * 目的是**超越**而不是复刻：
 *   ① provider × kind 的支持面是**数据**，不是 if-else —— 新接一家只改这张表；
 *   ② `verified` 一档把「上游端点是否本机实证过」写进类型：未实证 ⇒ 当场拒发起并给可执行出路，
 *      绝不建一枚 pending 会话让用户白扫（AGENTS §0.3「没判不许写成判过」的授权面版本）；
 *   ③ 出口 env `IHUI_RELAY_AUTH_DEVICE_FLOWS_JSON` 允许机主/运维**不改代码**接入任意 RFC 8628
 *      上游（企业自建 IdP 也算），这一格对照程序没有。
 *
 * 判据取用面：`effectiveCapabilities()` / `authCapabilityFor()` 是本仓唯一出口，
 * 任何调用方（service / route / CLI）**不得**再抄一份 provider 白名单。
 */
import { AUTH_SESSION_KINDS, type AuthSessionKind } from '@ihui/database'

/** 票据形态映射器标识：决定授权成功后如何组装 ImportAccountInput（映射实现住 service） */
export const AUTH_MAPPERS = ['oauth_token_pair', 'qoder_pat', 'bearer_key'] as const
export type AuthMapper = (typeof AUTH_MAPPERS)[number]

export interface AuthCapability {
  providerCode: string
  kind: AuthSessionKind
  mapper: AuthMapper
  /** 上游端点是否已在本机实证。false ⇒ 一律拒发起，note 必须给出路（不得空着） */
  verified: boolean
  /** RFC 8628 device flow：POST 取 device_code 的端点 */
  authorizationEndpoint?: string
  /** RFC 8628 device flow：POST 轮询换票的端点 */
  tokenEndpoint?: string
  /** OAuth client_id（公开客户端；device flow 无 secret 是标准形态） */
  clientId?: string
  scope?: string
  /** PAT / Key 的人工生成入口（给人看的 URL，不是程序要打的端点） */
  issuanceUrl?: string
  /** 人话说明：为什么是这一档、下一步做什么 */
  note: string
}

/**
 * 内置声明（本机实证的写 verified:true，其余如实 false）。
 *
 * 逐条依据（均为本仓一手取证，不是推断）：
 * - qoder / pat：`scripts/qoder-sdk-chat-probe.mjs` 实证「SDK 鉴权只接受 PAT；device token 会被
 *   exchangePersonalToken 拒为 access_token_invalid」，PAT 入口 = qoder.com.cn/account/integrations。
 *   ⇒ 自助面只有 PAT 一条腿可实证。
 * - qoder / device_flow：**未实证**。号池现有票（dt-/drt-）全部来自本机 auth.v1.dat 提取
 *   （`checkin_qoder.py` 契约 + 桌面端 checkin_capture.rs），仓内没有任何一条设备授权端点取证。
 * - 其余 provider：同理，只有「本机提取」与「JSON / tokens 导入」两条已实证通道。
 */
export const BUILTIN_AUTH_CAPABILITIES: readonly AuthCapability[] = [
  {
    providerCode: 'qoder',
    kind: 'pat',
    mapper: 'qoder_pat',
    verified: true,
    issuanceUrl: 'https://qoder.com.cn/account/integrations',
    note: 'Qoder 官方 SDK 只认 PAT（本仓 scripts/qoder-sdk-chat-probe.mjs 实证）；在官方集成页生成后粘贴即入池，入池默认停用、待运营确认通路后启用',
  },
  {
    providerCode: 'qoder',
    kind: 'device_flow',
    mapper: 'oauth_token_pair',
    verified: false,
    note: 'Qoder 设备授权端点本机零取证（现有票全部来自 auth.v1.dat 提取）；要开这一格先按 AGENTS §0.12 逆向-取证补实证，不得凭空拨端点',
  },
]

/** env 追加档的解析形状（少字段 = 整条丢弃，不做「半个 capability」） */
interface EnvCapabilityInput {
  providerCode?: unknown
  kind?: unknown
  mapper?: unknown
  authorizationEndpoint?: unknown
  tokenEndpoint?: unknown
  clientId?: unknown
  scope?: unknown
  issuanceUrl?: unknown
  note?: unknown
}

const KIND_SET: ReadonlySet<string> = new Set<string>(AUTH_SESSION_KINDS)
const MAPPER_SET: ReadonlySet<string> = new Set<string>(AUTH_MAPPERS)

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

/**
 * 解析 `IHUI_RELAY_AUTH_DEVICE_FLOWS_JSON`（数组或 `{flows:[...]}` 皆可）。
 *
 * 失效方向刻意是「整条丢弃 + 点名」而不是「宽松收下」：一条端点写错的 device flow
 * 比没有这条更危险 —— 用户会扫一个永远等不到回调的码。
 * 返回 `{flows, rejected}`，rejected 必须由调用方打印（静默丢弃 = 本仓记过无数次的「安静」型失效）。
 */
export function parseEnvCapabilities(raw: string | undefined | null): {
  flows: AuthCapability[]
  rejected: Array<{ index: number; reason: string }>
} {
  const text = (raw ?? '').trim()
  if (!text) return { flows: [], rejected: [] }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    return {
      flows: [],
      rejected: [
        { index: -1, reason: `JSON 解析失败：${e instanceof Error ? e.message : String(e)}` },
      ],
    }
  }
  const list: EnvCapabilityInput[] = Array.isArray(parsed)
    ? (parsed as EnvCapabilityInput[])
    : Array.isArray((parsed as { flows?: unknown }).flows)
      ? ((parsed as { flows: EnvCapabilityInput[] }).flows ?? [])
      : []
  const flows: AuthCapability[] = []
  const rejected: Array<{ index: number; reason: string }> = []
  list.forEach((item, index) => {
    const providerCode = str(item?.providerCode)
    const kind = str(item?.kind)
    const mapper = str(item?.mapper)
    const authorizationEndpoint = str(item?.authorizationEndpoint)
    const tokenEndpoint = str(item?.tokenEndpoint)
    const clientId = str(item?.clientId)
    if (!providerCode) {
      rejected.push({ index, reason: '缺 providerCode' })
      return
    }
    if (!kind || !KIND_SET.has(kind)) {
      rejected.push({ index, reason: `kind 不在档位表内：${kind ?? '空'}` })
      return
    }
    if (!mapper || !MAPPER_SET.has(mapper)) {
      rejected.push({ index, reason: `mapper 不在映射器表内：${mapper ?? '空'}` })
      return
    }
    if (kind === 'device_flow') {
      if (!/^https:\/\//.test(authorizationEndpoint ?? '')) {
        rejected.push({ index, reason: 'device_flow 必须有 https authorizationEndpoint' })
        return
      }
      if (!/^https:\/\//.test(tokenEndpoint ?? '')) {
        rejected.push({ index, reason: 'device_flow 必须有 https tokenEndpoint' })
        return
      }
      if (!clientId) {
        rejected.push({ index, reason: 'device_flow 必须有 clientId' })
        return
      }
    }
    if (kind === 'pat' && !str(item?.issuanceUrl)) {
      rejected.push({
        index,
        reason: 'pat 必须给 issuanceUrl（人工生成入口），否则用户不知道去哪拿票',
      })
      return
    }
    flows.push({
      providerCode,
      kind: kind as AuthSessionKind,
      mapper: mapper as AuthMapper,
      // 能进 env 的条目 = 机主/运维自己声明已实证；内置未实证档仍为 false
      verified: true,
      authorizationEndpoint: authorizationEndpoint ?? undefined,
      tokenEndpoint: tokenEndpoint ?? undefined,
      clientId: clientId ?? undefined,
      scope: str(item?.scope) ?? undefined,
      issuanceUrl: str(item?.issuanceUrl) ?? undefined,
      note: str(item?.note) ?? '运维经 IHUI_RELAY_AUTH_DEVICE_FLOWS_JSON 声明接入（视为已实证）',
    })
  })
  return { flows, rejected }
}

const capKey = (c: { providerCode: string; kind: string }): string => `${c.providerCode}::${c.kind}`

/**
 * 生效声明表 = 内置 + env 覆盖（同 provider+kind 以 env 为准）。
 * 每次调用现算（不缓存）：env 在进程生命周期内可变（部署腿切换），缓存必腐烂。
 */
export function effectiveCapabilities(
  builtin: readonly AuthCapability[] = BUILTIN_AUTH_CAPABILITIES,
  envJson: string | undefined | null = process.env.IHUI_RELAY_AUTH_DEVICE_FLOWS_JSON,
): AuthCapability[] {
  const { flows } = parseEnvCapabilities(envJson)
  const map = new Map<string, AuthCapability>()
  for (const c of builtin) map.set(capKey(c), c)
  for (const c of flows) map.set(capKey(c), c)
  return [...map.values()]
}

/** provider（可选 kind）查表；查不到 = 该 provider 无自助授权面 */
export function authCapabilityFor(
  providerCode: string,
  kind?: AuthSessionKind,
): AuthCapability | null {
  const all = effectiveCapabilities()
  const hits = all.filter((c) => c.providerCode === providerCode && (!kind || c.kind === kind))
  if (hits.length === 0) return null
  // 指定 kind 时唯一；未指定时优先已实证的那一档（避免把用户的操作引到一条死路上）
  if (kind) return hits[0] ?? null
  return hits.find((c) => c.verified) ?? hits[0] ?? null
}

export const __test__ = {
  capKey,
  KIND_SET,
  MAPPER_SET,
  BUILTIN_AUTH_CAPABILITIES,
  AUTH_MAPPERS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
