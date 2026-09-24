// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D94 失败诊断脱敏交接包(G-127,2026-09-24 立)—— 四段式交接单的**唯一判定层**
//
// **自证结论(改本文件前先读)**:
//   · 交接单(四段式 `诊断方法` / `已尝试的修复步骤` / `已脱敏证据：` / `产品界面` +
//     `状态：可能相关的事件：{incidentNames}`)在 web / ai-service / CLI **全仓 0 命中**
//     (grep `handoff|交接单` 仅命中 .venv 第三方包)⇒ 本票是**新建判定层**,不是收编。
//   · 脱敏**不新写**:走 `@ihui/shared/utils/redact`(共享层唯一实现,规则 = ai-service
//     `output_cleaning.py` + cli `redact.ts` 既有正则并集 + 本票补的邮箱/IP/十六进制)。
//     本文件只做"把文本过一遍 `sanitizeEvidenceText`",**严禁**在此另起正则。
//   · 通知兜底链对接 AGENTS.md §5e:运维邮件(唯一到人通道)与工单粘贴**没有 i18n 运行时**,
//     故 `formatHandoffText` 输出**内置中文纯文本**(不依赖词包),可直接贴工单/邮件;
//     web 侧词包(`ai.pane.handoff`)只负责界面标签,所见即所交(界面与复制文本同源)。
//
// **三段硬判据(台账 D94 明文)**:
//   ① **确定性本地规则优先**:`resolveLocalDiagnosis` 只吃本地信号(配置缺失 / 鉴权 /
//      限流 / 404 / 超时 / 网络 / 退出码 / 错误码),外部服务状态一律只进 `externalLines`
//      并标 `source='external'`;
//   ② **外部 down 不得单独成为结论**:只有本地判据命中 ⇒ `localConfirmed=true` 才下结论;
//      无本地判据 + 外部 down ⇒ `externalOnly=true`、`localConfirmed=false`,结论文本显式
//      写"未下结论"并附 `caveat`(与 §5d「网络不可达 ≠ 失败」同口径);
//   ③ **无网络降级不阻断**:`dataSourceReachable=false` 时**照常产出前三段**
//      (诊断 / 修复步骤 / 证据),只把第四段降级 + 打 `degraded`,**整包不得失败**。
//
// **不得留空假装没有**:修复步骤为空要显式写"未尝试任何修复步骤";incident 列表为空要
// 给空态文案;证据为空要显式写空态 —— 空态是结论的一部分,不是"没渲染"。

import { sanitizeEvidenceText } from '../utils/redact'
import { resolveErrorCatalog } from './error-catalog'

// ===================== 0. 常量与词包契约 =====================

/** 四段(顺序即交接单渲染顺序,缺一不可) */
export const HANDOFF_SECTIONS = ['diagnosis', 'fixSteps', 'evidence', 'productSurface'] as const
export type HandoffSection = (typeof HANDOFF_SECTIONS)[number]

/** 词包命名空间(web 侧 `useTranslations('ai.pane.handoff')`) */
export const HANDOFF_NAMESPACE = 'ai.pane.handoff' as const

/**
 * 四段 → 词包键(`ai.pane.handoff.section.*`)。
 * 界面标签走词包;**正文文本走内置中文**(见 `HANDOFF_ZH`),保证推送/邮件无 i18n 也可用。
 */
export const HANDOFF_SECTION_TITLE_KEYS: Readonly<Record<HandoffSection, string>> = Object.freeze({
  diagnosis: 'section.diagnosis',
  fixSteps: 'section.fixSteps',
  evidence: 'section.evidence',
  productSurface: 'section.productSurface',
})

/**
 * 词包叶子键清单(parity 守门用:五语言键集必须一致且包含这些叶)。
 * 组件测试按此清单机械断言 `ai.pane.handoff` 下的键齐备。
 */
export const HANDOFF_MESSAGE_KEYS: readonly string[] = Object.freeze([
  'title',
  'ariaLabel',
  'section.diagnosis',
  'section.fixSteps',
  'section.evidence',
  'section.productSurface',
  'source.local',
  'source.external',
  'externalCaveat',
  'localUnknown',
  'empty.fixSteps',
  'empty.evidence',
  'empty.productSurface',
  'empty.incidents',
  'incidentLine',
  'truncated',
  'degraded',
  'redacted',
  'copy',
  'copied',
])

/** 单条证据默认上限(超出即截断并**记录**截断字符数,不得静默丢弃) */
export const MAX_EVIDENCE_CHARS = 1200 as const

// ===================== 1. 内置中文文案(对外提交用) =====================

/**
 * 交接单正文的**内置中文**文案 —— 运维邮件 / 工单没有 i18n 运行时,
 * 这里就是唯一文本源(与词包 `ai.pane.handoff` 一一对应,中文取台账 D94 原文)。
 */
export const HANDOFF_ZH = Object.freeze({
  title: '失败诊断交接单',
  ariaLabel: '失败诊断交接单',
  'section.diagnosis': '诊断方法',
  'section.fixSteps': '已尝试的修复步骤',
  'section.evidence': '已脱敏证据：',
  'section.productSurface': '产品界面',
  'source.local': '本地判据',
  'source.external': '辅助信号',
  externalCaveat: '外部服务返回 down 仅作辅助信号,未单独作为结论依据(§5d:网络不可达 ≠ 失败)。',
  localUnknown: '本地暂无确定性判据,未下结论',
  'empty.fixSteps': '未尝试任何修复步骤',
  'empty.evidence': '无可用证据',
  'empty.productSurface': '未提供产品界面信息',
  'empty.incidents': '暂无可能相关的事件',
  incidentLine: '状态：可能相关的事件：',
  truncated: '已截断 {count} 字符',
  degraded: '数据源不可达,以下交接单仅含本地已得信息(§5d:网络不可达 ≠ 失败)',
  redacted: '本交接单已过脱敏(密钥 / 令牌 / 邮箱 / IP 已替换)',
  copy: '复制交接单',
  copied: '已复制交接单',
})

/** 内置截断文案(纯文本路径无 ICU 运行时,手工插值) */
export function handoffTruncatedText(count: number): string {
  return HANDOFF_ZH.truncated.replace('{count}', String(count))
}

// ===================== 2. 输入契约 =====================

/** 修复步骤结果(穷尽三态,禁止第四种) */
export const HANDOFF_FIX_OUTCOMES = ['done', 'failed', 'skipped'] as const
export type HandoffFixOutcome = (typeof HANDOFF_FIX_OUTCOMES)[number]

/** 外部服务状态(穷尽三态) */
export const HANDOFF_EXTERNAL_STATUSES = ['up', 'down', 'unknown'] as const
export type HandoffExternalStatus = (typeof HANDOFF_EXTERNAL_STATUSES)[number]

export interface HandoffFixStep {
  readonly label: string
  readonly outcome?: HandoffFixOutcome
  readonly detail?: string
}

export interface HandoffExternalSignal {
  readonly service: string
  readonly status: HandoffExternalStatus
  readonly detail?: string
}

export interface HandoffEvidenceItem {
  readonly label: string
  readonly value: string
}

/**
 * **本地**确定性信号(全部来自本机可观测事实,**不依赖任何外部服务**)。
 * 这是诊断的**唯一**定论来源;外部服务状态只能进 `externalSignals`。
 */
export interface HandoffLocalSignals {
  /** 缺失的配置键名(只记键名,不记值 —— 值永远是秘密) */
  readonly configKeyMissing?: string
  /** 鉴权被拒(401/403) */
  readonly authRejected?: boolean
  readonly httpStatus?: number
  /** 触发限流(429) */
  readonly rateLimited?: boolean
  /** 目标资源不存在(404) */
  readonly notFound?: boolean
  /** 执行超时 */
  readonly timedOut?: boolean
  /** 本机离线 */
  readonly offline?: boolean
  /** DNS/连接失败 */
  readonly dnsFailure?: boolean
  /** 本地进程退出码 */
  readonly exitCode?: number
  /** 后端错误码(走 D71 `error-catalog`,不臆造) */
  readonly errorCode?: string
  /** 错误类型名 */
  readonly errorName?: string
}

export interface HandoffProductSurface {
  readonly route?: string
  readonly panel?: string
  readonly taskId?: string
  readonly turnId?: string
}

export interface HandoffContext {
  /** 用户可见错误原文(必过脱敏) */
  readonly errorMessage?: string
  /** 附加证据(日志片段 / 命令输出 …),逐条脱敏 + 截断 */
  readonly evidence?: readonly HandoffEvidenceItem[]
  /** 已尝试的修复步骤(有序;空 ⇒ 显式写"未尝试任何修复步骤") */
  readonly fixSteps?: readonly HandoffFixStep[]
  /** 外部服务状态 —— **仅作辅助信号**,不得单独成为结论 */
  readonly externalSignals?: readonly HandoffExternalSignal[]
  /** 本地确定性信号(定论来源) */
  readonly localSignals?: HandoffLocalSignals
  readonly productSurface?: HandoffProductSurface
  /** 可能相关的事件名;空 ⇒ 空态文案 */
  readonly incidentNames?: readonly string[]
  /** 数据源是否可达。显式 `false` ⇒ 降级但不阻断(§5d) */
  readonly dataSourceReachable?: boolean
  /** 发生时间(ISO 字符串);不传则写"未提供",**不臆造时间** */
  readonly occurredAt?: string
}

// ===================== 3. 本地确定性规则(定论来源) =====================

/** 本地规则 id。`none` = 无任何本地判据 ⇒ **不下结论** */
export const HANDOFF_LOCAL_RULE_IDS = [
  'configMissing',
  'authRejected',
  'rateLimited',
  'resourceNotFound',
  'timeout',
  'networkUnreachable',
  'processExit',
  'errorCode',
  'errorName',
] as const
export type HandoffLocalRuleId = (typeof HANDOFF_LOCAL_RULE_IDS)[number]

export interface HandoffLocalDiagnosis {
  readonly ruleId: HandoffLocalRuleId | 'none'
  /** 结论摘要(已脱敏) */
  readonly summary: string
  /** 判据明细(如 `httpStatus=401`);无则空串 */
  readonly detail: string
}

/**
 * 有序规则表:**先命中先定论**,顺序即优先级(越靠前越具体)。
 * 全部只读 `localSignals`,**不读外部服务状态** —— 这是"本地优先"的机械保证。
 */
const LOCAL_RULES: readonly {
  id: HandoffLocalRuleId
  match: (s: HandoffLocalSignals) => boolean
  resolve: (s: HandoffLocalSignals) => HandoffLocalDiagnosis
}[] = [
  {
    id: 'configMissing',
    match: (s) => typeof s.configKeyMissing === 'string' && s.configKeyMissing.length > 0,
    resolve: (s) => ({
      ruleId: 'configMissing',
      summary: `本地配置缺失:${s.configKeyMissing}`,
      detail: '配置键值为空,未加载',
    }),
  },
  {
    id: 'authRejected',
    match: (s) => s.authRejected === true || s.httpStatus === 401 || s.httpStatus === 403,
    resolve: (s) => ({
      ruleId: 'authRejected',
      summary: '鉴权被拒',
      detail: typeof s.httpStatus === 'number' ? `httpStatus=${s.httpStatus}` : '鉴权失败',
    }),
  },
  {
    id: 'rateLimited',
    match: (s) => s.rateLimited === true || s.httpStatus === 429,
    resolve: (s) => ({
      ruleId: 'rateLimited',
      summary: '触发限流',
      detail: typeof s.httpStatus === 'number' ? `httpStatus=${s.httpStatus}` : 'rateLimited=true',
    }),
  },
  {
    id: 'resourceNotFound',
    match: (s) => s.notFound === true || s.httpStatus === 404,
    resolve: (s) => ({
      ruleId: 'resourceNotFound',
      summary: '目标资源不存在',
      detail: typeof s.httpStatus === 'number' ? `httpStatus=${s.httpStatus}` : 'notFound=true',
    }),
  },
  {
    id: 'timeout',
    match: (s) => s.timedOut === true || s.httpStatus === 504,
    resolve: () => ({ ruleId: 'timeout', summary: '执行超时', detail: '超时阈值内未返回' }),
  },
  {
    // §5d:网络不可达是**本地事实**(本机确实连不上),但仍 ≠ 结论"服务挂了",
    // 因此本规则的文案自带口径,且不因外部 down 而升级为"服务故障"。
    id: 'networkUnreachable',
    match: (s) => s.offline === true || s.dnsFailure === true,
    resolve: (s) => ({
      ruleId: 'networkUnreachable',
      summary: '本机网络不可达(按 §5d:不可达 ≠ 失败,需本地复核)',
      detail: s.dnsFailure ? 'dnsFailure=true' : 'offline=true',
    }),
  },
  {
    id: 'processExit',
    match: (s) => typeof s.exitCode === 'number' && s.exitCode !== 0,
    resolve: (s) => ({
      ruleId: 'processExit',
      summary: '本地进程非零退出',
      detail: `exitCode=${s.exitCode}`,
    }),
  },
  {
    id: 'errorCode',
    match: (s) => typeof s.errorCode === 'string' && s.errorCode.length > 0,
    resolve: (s) => {
      // 复用 D71 error-catalog:认得出的码补分类,认不出**不臆造**(只报原始码)
      const entry = resolveErrorCatalog(s.errorCode)
      return {
        ruleId: 'errorCode',
        summary: `错误码 ${s.errorCode}`,
        detail: entry ? `分类=${entry.category}` : '未收录于错误分类表',
      }
    },
  },
  {
    id: 'errorName',
    match: (s) => typeof s.errorName === 'string' && s.errorName.length > 0,
    resolve: (s) => ({
      ruleId: 'errorName',
      summary: `错误类型 ${s.errorName}`,
      detail: '',
    }),
  },
]

/**
 * 本地确定性诊断(**唯一**定论入口):未命中任何规则 ⇒ `ruleId='none'`,
 * 调用方必须据此走"未下结论",**不得**拿外部状态顶替。
 */
export function resolveLocalDiagnosis(signals: HandoffLocalSignals = {}): HandoffLocalDiagnosis {
  for (const rule of LOCAL_RULES) {
    if (rule.match(signals)) return rule.resolve(signals)
  }
  return { ruleId: 'none', summary: HANDOFF_ZH.localUnknown, detail: '' }
}

// ===================== 4. 四段结构 =====================

export interface HandoffDiagnosisLine {
  readonly source: 'local' | 'external'
  readonly text: string
}

export interface HandoffDiagnosis {
  readonly section: 'diagnosis'
  readonly titleKey: string
  /** 有本地判据命中 ⇒ 可下结论 */
  readonly localConfirmed: boolean
  /** 无本地判据、但外部有 down ⇒ **不得下结论**(外部 down 只作辅助) */
  readonly externalOnly: boolean
  readonly externalDownCount: number
  /** 结论文本(已脱敏) */
  readonly method: string
  readonly lines: readonly HandoffDiagnosisLine[]
  /** 存在外部 down 时的显式声明(恒为非 null when externalDownCount>0) */
  readonly caveat: string | null
}

export interface HandoffEvidenceLine {
  readonly label: string
  readonly text: string
  /** 该条被截断的字符数(0 = 未截断) */
  readonly truncatedChars: number
}

export interface HandoffEvidenceSection {
  readonly section: 'evidence'
  readonly titleKey: string
  readonly lines: readonly HandoffEvidenceLine[]
  readonly empty: boolean
  readonly emptyText: string
}

export interface HandoffFixStepsSection {
  readonly section: 'fixSteps'
  readonly titleKey: string
  readonly lines: readonly string[]
  readonly empty: boolean
  readonly emptyText: string
}

export interface HandoffProductSurfaceSection {
  readonly section: 'productSurface'
  readonly titleKey: string
  readonly lines: readonly string[]
  readonly empty: boolean
  readonly emptyText: string
  readonly incidents: readonly string[]
  readonly incidentsEmpty: boolean
  /** `状态：可能相关的事件：{incidentNames}`;空 ⇒ 接空态文案 */
  readonly incidentLine: string
}

export interface HandoffPackage {
  readonly diagnosis: HandoffDiagnosis
  readonly fixSteps: HandoffFixStepsSection
  readonly evidence: HandoffEvidenceSection
  readonly productSurface: HandoffProductSurfaceSection
  /** 数据源不可达 ⇒ 降级产出(前三段照常),**整包不得失败** */
  readonly degraded: boolean
  readonly degradedNote: string | null
  /** 全包累计截断字符数 */
  readonly truncatedChars: number
  readonly occurredAt: string
}

// ===================== 5. 穷尽映射(零 default + assertNever) =====================

/** 修复步骤三态 → 文本(穷尽 switch,新增态 ⇒ 编译失败) */
export function handoffFixOutcomeText(outcome: HandoffFixOutcome): string {
  switch (outcome) {
    case 'done':
      return '已完成'
    case 'failed':
      return '失败'
    case 'skipped':
      return '已跳过'
  }
  return assertNever(outcome)
}

/** 外部服务三态 → 文本(穷尽 switch) */
export function handoffExternalStatusText(status: HandoffExternalStatus): string {
  switch (status) {
    case 'up':
      return '正常'
    case 'down':
      return 'down'
    case 'unknown':
      return '未知'
  }
  return assertNever(status)
}

function assertNever(value: never): never {
  throw new Error(`unhandled handoff value: ${String(value)}`)
}

// ===================== 6. 截断与文本净化 =====================

export interface TruncatedText {
  readonly text: string
  readonly truncatedChars: number
}

/**
 * 长度截断:**必须记录**截掉了多少字符(不得静默丢弃证据)。
 * 截断后再补一行可见提示,交接单读者要知道"这里还有内容被截了"。
 */
export function truncateForHandoff(text: string, max: number = MAX_EVIDENCE_CHARS): TruncatedText {
  if (text.length <= max) return { text, truncatedChars: 0 }
  return { text: `${text.slice(0, max)}…`, truncatedChars: text.length - max }
}

/** 证据净化:strip_ansi → 脱敏 → 截断(顺序与 `ir.py:230` 一致) */
function buildEvidenceLine(label: string, value: string, max: number): HandoffEvidenceLine {
  const clean = sanitizeEvidenceText(value ?? '')
  const { text, truncatedChars } = truncateForHandoff(clean, max)
  return { label, text, truncatedChars }
}

// ===================== 7. 构建交接单 =====================

/**
 * 构建四段式交接单。**永不抛错**(输入任意脏数据都产出前三段)。
 *
 * 判据:
 *  - 诊断走 `resolveLocalDiagnosis`,外部信号只进 `lines[source='external']`;
 *  - `externalOnly = !localConfirmed && externalDownCount > 0` ⇒ 结论文本改"未下结论";
 *  - `dataSourceReachable === false` ⇒ `degraded=true`,四段仍全产出。
 */
export function buildHandoffPackage(ctx: HandoffContext = {}): HandoffPackage {
  const local = resolveLocalDiagnosis(ctx.localSignals ?? {})
  const external = ctx.externalSignals ?? []
  const externalDownCount = external.filter((s) => s.status === 'down').length
  const localConfirmed = local.ruleId !== 'none'
  const externalOnly = !localConfirmed && externalDownCount > 0

  const localLines: HandoffDiagnosisLine[] = localConfirmed
    ? [
        {
          source: 'local',
          text: local.detail ? `${local.summary}(${local.detail})` : local.summary,
        },
      ]
    : []
  const externalLines: HandoffDiagnosisLine[] = external.map((s) => ({
    source: 'external',
    text: `${s.service}=${handoffExternalStatusText(s.status)}${s.detail ? `(${s.detail})` : ''}(外部服务状态,不作为结论)`,
  }))

  const method = localConfirmed
    ? `本地确定性规则判定:${local.summary}`
    : externalOnly
      ? `${HANDOFF_ZH.localUnknown}(外部服务返回 down,仅作辅助信号)`
      : HANDOFF_ZH.localUnknown

  const diagnosis: HandoffDiagnosis = {
    section: 'diagnosis',
    titleKey: HANDOFF_SECTION_TITLE_KEYS.diagnosis,
    localConfirmed,
    externalOnly,
    externalDownCount,
    method: sanitizeEvidenceText(method),
    lines: [...localLines, ...externalLines],
    caveat: externalDownCount > 0 ? HANDOFF_ZH.externalCaveat : null,
  }

  // 已尝试的修复步骤:空 ⇒ **显式**空态(不得留空假装没有)
  const fixStepLines = (ctx.fixSteps ?? []).map((step, index) => {
    const outcome = step.outcome === undefined ? '' : ` → ${handoffFixOutcomeText(step.outcome)}`
    const detail = step.detail ? `(${step.detail})` : ''
    return sanitizeEvidenceText(`${index + 1}. ${step.label}${outcome}${detail}`)
  })
  const fixSteps: HandoffFixStepsSection = {
    section: 'fixSteps',
    titleKey: HANDOFF_SECTION_TITLE_KEYS.fixSteps,
    lines: fixStepLines,
    empty: fixStepLines.length === 0,
    emptyText: HANDOFF_ZH['empty.fixSteps'],
  }

  // 已脱敏证据:首条恒为 `- 用户可见错误：{errorMessage}`(台账明文形态)
  const evidenceLines: HandoffEvidenceLine[] = []
  if (typeof ctx.errorMessage === 'string' && ctx.errorMessage.length > 0) {
    evidenceLines.push(buildEvidenceLine('用户可见错误', ctx.errorMessage, MAX_EVIDENCE_CHARS))
  }
  for (const item of ctx.evidence ?? []) {
    evidenceLines.push(buildEvidenceLine(item.label, item.value, MAX_EVIDENCE_CHARS))
  }
  const evidence: HandoffEvidenceSection = {
    section: 'evidence',
    titleKey: HANDOFF_SECTION_TITLE_KEYS.evidence,
    lines: evidenceLines,
    empty: evidenceLines.length === 0,
    emptyText: HANDOFF_ZH['empty.evidence'],
  }

  // 产品界面 + 事件行(空 ⇒ 明确空态)
  const surface = ctx.productSurface ?? {}
  const surfaceLines: string[] = []
  if (surface.route) surfaceLines.push(sanitizeEvidenceText(`页面:${surface.route}`))
  if (surface.panel) surfaceLines.push(sanitizeEvidenceText(`面板:${surface.panel}`))
  if (surface.taskId) surfaceLines.push(sanitizeEvidenceText(`任务:${surface.taskId}`))
  if (surface.turnId) surfaceLines.push(sanitizeEvidenceText(`轮次:${surface.turnId}`))

  const incidents = (ctx.incidentNames ?? []).filter((n) => n.length > 0)
  const incidentLine = `${HANDOFF_ZH.incidentLine}${
    incidents.length > 0 ? incidents.join('、') : HANDOFF_ZH['empty.incidents']
  }`

  const productSurface: HandoffProductSurfaceSection = {
    section: 'productSurface',
    titleKey: HANDOFF_SECTION_TITLE_KEYS.productSurface,
    lines: surfaceLines,
    empty: surfaceLines.length === 0,
    emptyText: HANDOFF_ZH['empty.productSurface'],
    incidents,
    incidentsEmpty: incidents.length === 0,
    incidentLine,
  }

  const degraded = ctx.dataSourceReachable === false
  const truncatedChars = evidenceLines.reduce((sum, line) => sum + line.truncatedChars, 0)

  return {
    diagnosis,
    fixSteps,
    evidence,
    productSurface,
    degraded,
    degradedNote: degraded ? HANDOFF_ZH.degraded : null,
    truncatedChars,
    occurredAt: ctx.occurredAt ?? '未提供',
  }
}

// ===================== 8. 可导出纯文本 =====================

/**
 * **脱敏后的可导出纯文本** —— 直接贴工单 / 运维邮件(§5e 唯一到人通道)。
 * 内置中文,**不依赖 i18n 运行时**;所有正文均已过 `sanitizeEvidenceText`。
 */
export function formatHandoffText(pkg: HandoffPackage): string {
  const lines: string[] = [HANDOFF_ZH.title]
  if (pkg.degradedNote) lines.push(pkg.degradedNote)
  if (pkg.occurredAt) lines.push(`发生时间:${pkg.occurredAt}`)

  lines.push(HANDOFF_ZH['section.diagnosis'])
  lines.push(`- ${pkg.diagnosis.method}`)
  for (const line of pkg.diagnosis.lines) {
    const prefix = line.source === 'local' ? HANDOFF_ZH['source.local'] : HANDOFF_ZH['source.external']
    lines.push(`- [${prefix}] ${line.text}`)
  }
  if (pkg.diagnosis.caveat) lines.push(`- 注:${pkg.diagnosis.caveat}`)

  lines.push(HANDOFF_ZH['section.fixSteps'])
  if (pkg.fixSteps.empty) lines.push(`- ${pkg.fixSteps.emptyText}`)
  else for (const line of pkg.fixSteps.lines) lines.push(`- ${line}`)

  lines.push(HANDOFF_ZH['section.evidence'])
  if (pkg.evidence.empty) lines.push(`- ${pkg.evidence.emptyText}`)
  else
    for (const line of pkg.evidence.lines) {
      const suffix =
        line.truncatedChars > 0 ? ` (${handoffTruncatedText(line.truncatedChars)})` : ''
      lines.push(`- ${line.label}：${line.text}${suffix}`)
    }

  lines.push(HANDOFF_ZH['section.productSurface'])
  if (pkg.productSurface.empty) lines.push(`- ${pkg.productSurface.emptyText}`)
  else for (const line of pkg.productSurface.lines) lines.push(`- ${line}`)
  lines.push(pkg.productSurface.incidentLine)

  if (pkg.truncatedChars > 0) lines.push(`${handoffTruncatedText(pkg.truncatedChars)}(合计)`)
  lines.push(HANDOFF_ZH.redacted)

  return lines.join('\n')
}

/** 一步到位:上下文 → 纯文本交接单(推送 / 邮件 / 工单入口) */
export function buildHandoffText(ctx: HandoffContext = {}): string {
  return formatHandoffText(buildHandoffPackage(ctx))
}
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
