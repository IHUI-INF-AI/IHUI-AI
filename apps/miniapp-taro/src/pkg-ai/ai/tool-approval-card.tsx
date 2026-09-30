// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * ToolApprovalCard — 小程序端「页内确认卡」(D136 本端落地位,2026-10-01 立)。
 *
 * 对标关系(逐档抄自 web `apps/web/src/components/ai/tool-approval-dialog.tsx`):
 *  - 三档授权 once / session / always = web 的 SCOPE_OPTIONS,取词用**同一把共享键**
 *    (`editor.toolApproval.scopeOnce|scopeSession|scopeAlways`),默认 once 最小特权;
 *    本端**不得只做两档** —— 少一档就是替用户缩小授权语义,与台账里"渲染位是否存在须在
 *    接的那一票里当场证"同一条纪律;
 *  - 拒绝不带 scope(web 用 `decision==='approve' ? {scope} : {}` 表达,本端固化成
 *    `buildRejectPayload`);
 *  - 审批不能被"关闭"绕过(web 的 Modal onClose 是空函数),本端连关闭键都不给:
 *    手机上没有"划走就当没发生"这条路,决策只有批准 / 拒绝两种出口。
 *
 * 为什么是页内卡而不是 Taro.showModal:系统模态只能给两个按钮 + 一段文本,承载不了
 * 三档作用域与参数预览,而且它浮在页面之上、关掉后什么都不剩 —— 台账要求的正是
 * "落到该端既有的审批面(页内确认卡)"。
 *
 * 已处理记录 `records` 由**页级 state** 传进来渲染在卡外(与 RN 那一版同一教训:
 * 记录只住在浮层里,关掉浮层就什么都没留下,用户仍然不知道发生过一次授权决策)。
 * 拒绝/未生效后的人工放行出口(§30)也住在记录行上,不随卡片消失。
 */
import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import LineIcon from '@/components/LineIcon'
import type { ToolApprovalScope } from '@ihui/types'
import {
  DEFAULT_APPROVAL_SCOPE,
  buildApprovePayload,
  buildRejectPayload,
  offersManualOverride,
  resolveApprovalTexts,
  resolveApprovalTierLabels,
  resolveDangerLevelText,
  summarizeApprovalRecord,
  type ApprovalRecord,
  type ApprovalRequestView,
  type TranslateWithFallback,
} from './tool-approval-text'
import './tool-approval-card.css'

/** 上送给页层的决策载荷(页层只负责经 api-client 送出,不再判档)。 */
export type ApprovalDecisionPayload = ReturnType<typeof buildApprovePayload>

export interface ToolApprovalCardProps {
  /** 当前展示中的审批请求;null = 没有(此时只渲染已处理记录,不占位) */
  request: ApprovalRequestView | null
  /** 排队待决策的条数(不含当前这条) */
  queueCount: number
  /** 本轮已处理的记录(页级持有,关卡不丢) */
  records: readonly ApprovalRecord[]
  /** 正在送出决策(按钮禁用,防重复提交) */
  sending: boolean
  /** 端内取词函数(useTt 的 tt) */
  tt: TranslateWithFallback
  /** 决策出口(批准/拒绝/人工放行都走这里,载荷已带齐档位) */
  onDecision: (payload: ApprovalDecisionPayload) => void
}

export default function ToolApprovalCard({
  request,
  queueCount,
  records,
  sending,
  tt,
  onDecision,
}: ToolApprovalCardProps) {
  const texts = resolveApprovalTexts(tt)
  const tiers = resolveApprovalTierLabels(tt)
  // 作用域选择:默认 once(最小特权),新请求进来即重置 —— 上一条的授权范围不得串到下一条
  const [scope, setScope] = useState<ToolApprovalScope>(DEFAULT_APPROVAL_SCOPE)
  useEffect(() => {
    setScope(DEFAULT_APPROVAL_SCOPE)
  }, [request?.approvalId])

  const showCard = request !== null
  const showRecords = records.length > 0
  if (!showCard && !showRecords) return null

  return (
    <View>
      {showCard && request ? (
        <View className="tac-card" data-testid="tool-approval-card">
          <View className="tac-head">
            <LineIcon name="triangle-alert" size={32} color="var(--color-danger)" />
            <Text className="tac-title">{texts.title}</Text>
            {queueCount > 0 ? (
              <Text className="tac-pending">
                {texts.pendingCount.replace('{count}', String(queueCount))}
              </Text>
            ) : null}
          </View>

          <Text className="tac-desc">{texts.description}</Text>

          <View className="tac-tool">
            <Text className="tac-tool-name">{request.toolName}</Text>
            <Text className="tac-danger">{resolveDangerLevelText(request.dangerLevel, tt)}</Text>
          </View>

          <View className="tac-args-block">
            <Text className="tac-args-label">{texts.argsPreview}</Text>
            <Text className="tac-args">{request.argsPreview || '{}'}</Text>
          </View>

          <View className="tac-scope-block">
            <Text className="tac-args-label">{texts.scopeLabel}</Text>
            <View className="tac-scope-row">
              {tiers.map((tier) => (
                <View
                  key={tier.scope}
                  className={scope === tier.scope ? 'tac-scope-btn is-active' : 'tac-scope-btn'}
                  hoverClass="tac-hover"
                  data-testid={`tool-approval-scope-${tier.scope}`}
                  onClick={() => setScope(tier.scope)}
                >
                  <Text>{tier.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <View className="tac-actions">
            <View
              className="tac-reject"
              hoverClass="tac-hover"
              data-testid="tool-approval-reject"
              onClick={() => {
                if (sending) return
                onDecision(buildRejectPayload(request))
              }}
            >
              <LineIcon name="x-error" size={28} color="var(--color-danger)" />
              <Text>{texts.reject}</Text>
            </View>
            <View
              className="tac-approve"
              hoverClass="tac-hover"
              data-testid="tool-approval-approve"
              onClick={() => {
                if (sending) return
                onDecision(buildApprovePayload(request, scope))
              }}
            >
              <LineIcon name="check-success" size={28} color="var(--color-cta-foreground)" />
              <Text>{sending ? texts.statusSending : texts.approve}</Text>
            </View>
          </View>
        </View>
      ) : null}

      {showRecords ? (
        <View className="tac-records" data-testid="tool-approval-records">
          <Text className="tac-records-title">{texts.recordsTitle}</Text>
          {records.map((record) => {
            const summary = summarizeApprovalRecord(record, texts)
            return (
              <View
                key={`${record.approvalId}-${record.overrideCount}`}
                className="tac-record"
                data-testid={`tool-approval-record-${record.approvalId}`}
              >
                <View className="tac-record-main">
                  <Text className="tac-record-tool">{record.toolName}</Text>
                  <Text
                    className={
                      summary.tone === 'ok'
                        ? 'tac-record-text is-ok'
                        : summary.tone === 'danger'
                          ? 'tac-record-text is-danger'
                          : 'tac-record-text is-warn'
                    }
                  >
                    {summary.text}
                  </Text>
                </View>
                {/* §30:被拒/未生效的条目必须留着人工放行口子,且这一行不在卡内 —— 关掉卡还在 */}
                {offersManualOverride(record) ? (
                  <View
                    className="tac-override"
                    hoverClass="tac-hover"
                    data-testid={`tool-approval-override-${record.approvalId}`}
                    onClick={() => {
                      if (sending) return
                      onDecision(buildApprovePayload({ approvalId: record.approvalId }, scope))
                    }}
                  >
                    <Text className="tac-override-label">{texts.manualOverride}</Text>
                    <Text className="tac-override-desc">{texts.manualOverrideDesc}</Text>
                  </View>
                ) : null}
              </View>
            )
          })}
        </View>
      ) : null}
    </View>
  )
}
