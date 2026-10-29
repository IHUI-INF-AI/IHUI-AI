// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 流错误的**呈现层**(对标 Qoder 借鉴清单第 10 项的 web 落地)。
 *
 * 分工(§0.6:判据与文案各住一处)
 * - 判据住 `@ihui/shared/chat/stream-error-disposition`:errorCode → 动作档 + 能不能重试;
 * - 标题/具体建议沿用 `ai.pane.errorCatalog`(139 码的既有表,本层一个码都不重写);
 * - 动作按钮与发送准入五态的文案住新开的 `streamErrors`(见下方"为什么必须静态发射")。
 * - 本文件只做**拼装**:把"哪个键"变成"哪句话"。
 *
 * ## 为什么键必须逐条静态写出来(而不是 `t(\`action.${x}\`)` 拼)
 * `check-declared-policy-has-consumer` 的 C6 维按**静态发射点**反查五语言词表 ——
 * `t(\`action.${x}\`)` 这种动态拼键只计"报数不判红",于是新键会被判成"有译文却零生产者"。
 * 所以 `useStreamErrorLabels()` 里 15 个键**逐条**写成 `t('action.retry')` 这样的静态调用;
 * 这一条同时挡住了"在组件里再写一份 switch"的诱惑 —— 调用方只按 `action` 查表。
 */

'use client'

import { useTranslations } from 'next-intl'
import {
  ADMISSION_PHASES,
  STREAM_ERROR_ACTIONS,
  resolveStreamErrorDisposition,
  type AdmissionPhase,
  type StreamErrorAction,
  type StreamErrorDisposition,
} from '@ihui/shared/chat'

/** 词包命名空间(与 `ai.pane.errorCatalog` 并列、互相独立)。 */
export const STREAM_ERRORS_NS = 'streamErrors' as const

/** 目录表命名空间(既有;本层只读不写)。 */
export const ERROR_CATALOG_NS = 'ai.pane.errorCatalog' as const

/**
 * 已解析的文案集。纯函数只吃它,不碰 hook —— 单测直接把桩塞进来即可钉判据。
 */
export interface StreamErrorLabelSet {
  /** 9 档动作的按钮文案 */
  readonly actions: Readonly<Record<StreamErrorAction, string>>
  /** 5 态发送准入的呈现文案 */
  readonly admission: Readonly<Record<AdmissionPhase, string>>
  /** 「下一步」标签(动作按钮前的引导词) */
  readonly nextStepLabel: string
  /** 目录表取词(标题 / 具体建议);缺键返回空串,由 `buildStreamErrorView` 决定是否呈现 */
  readonly catalog: (key: string) => string
}

/**
 * 端内取词器。**15 个键逐条静态发射**是 C6 的接线形态(见文件头注),改这里必须保持静态。
 */
export function useStreamErrorLabels(): StreamErrorLabelSet {
  const t = useTranslations(STREAM_ERRORS_NS)
  const catalog = useTranslations(ERROR_CATALOG_NS)

  const actions: Record<StreamErrorAction, string> = {
    retry: t('action.retry'),
    waitAndRetry: t('action.waitAndRetry'),
    switchModel: t('action.switchModel'),
    checkQuota: t('action.checkQuota'),
    contactAdmin: t('action.contactAdmin'),
    relogin: t('action.relogin'),
    upgradeApp: t('action.upgradeApp'),
    trimContext: t('action.trimContext'),
    none: t('action.none'),
  }
  const admission: Record<AdmissionPhase, string> = {
    tentative: t('admission.tentative'),
    admitted: t('admission.admitted'),
    queued: t('admission.queued'),
    rejected: t('admission.rejected'),
    unconfirmed: t('admission.unconfirmed'),
  }
  return {
    actions,
    admission,
    nextStepLabel: t('nextStepLabel'),
    catalog: (key) => catalog(key as never),
  }
}

/** 动作文案(档位闭集由共享层给出;本表按档取词)。 */
export function actionText(action: StreamErrorAction, labels: StreamErrorLabelSet): string {
  return labels.actions[action]
}

/** 准入态文案。 */
export function admissionPhaseText(phase: AdmissionPhase, labels: StreamErrorLabelSet): string {
  return labels.admission[phase]
}

/**
 * 一条流错误的可见视图。`detail` / `actionLabel` 为 `null` 表示**该档不给**:
 * 目录表里没有具体建议的码不给空串(空串会渲染成一个空行),`none` 动作不给按钮
 * (给了等于承诺一个做不到的出路)。
 */
export interface StreamErrorView {
  /** 错误码原样(排障用;渲染方决定是否展示) */
  readonly code: string | undefined
  readonly title: string
  readonly detail: string | null
  readonly actionLabel: string | null
  readonly action: StreamErrorAction | null
  /** `null` = 未判定(码未收录)。**不得**读成 `false` —— 那是在说"不能重试" */
  readonly retryable: boolean | null
}

/**
 * 拼装可见视图(纯函数,无 React 依赖 ⇒ 单测直接钉)。
 *
 * @param input.errorCode      后端产出的命名错误码(原样,不归一)
 * @param input.fallbackTitle  码未收录时沿用调用方既有的标题(既有 `formatSSEError` 产物)
 * @param input.fallbackMessage 同上,兜底正文
 */
export function buildStreamErrorView(input: {
  errorCode?: string | null
  fallbackTitle: string
  fallbackMessage: string
  labels: StreamErrorLabelSet
}): StreamErrorView {
  const disposition: StreamErrorDisposition | null = resolveStreamErrorDisposition(input.errorCode)
  if (!disposition) {
    // 未收录 ⇒ 保持既有行为(零兜底:不编造标题,也不替用户判定可否重试)
    return {
      code: input.errorCode ?? undefined,
      title: input.fallbackTitle,
      detail: input.fallbackMessage || null,
      actionLabel: null,
      action: null,
      retryable: null,
    }
  }
  return {
    code: disposition.code,
    title: input.labels.catalog(disposition.titleKey),
    detail: disposition.detailKey ? input.labels.catalog(disposition.detailKey) : null,
    actionLabel: disposition.action === 'none' ? null : input.labels.actions[disposition.action],
    action: disposition.action,
    retryable: disposition.retryable,
  }
}

/** 词表自证:两个常量表的成员数必须与共享层闭集一致(改档时这里先红)。 */
export function assertLabelCoverage(labels: StreamErrorLabelSet): string[] {
  const missing: string[] = []
  for (const a of STREAM_ERROR_ACTIONS) if (!labels.actions[a]?.trim()) missing.push(`action.${a}`)
  for (const p of ADMISSION_PHASES) if (!labels.admission[p]?.trim()) missing.push(`admission.${p}`)
  if (!labels.nextStepLabel?.trim()) missing.push('nextStepLabel')
  return missing
}

export const __test__ = {
  STREAM_ERRORS_NS,
  ERROR_CATALOG_NS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
