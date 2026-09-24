// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// D78 连接器授权卡(G-107) —— 对话流内渲染件。
//
// **数据面纪律(与 D72 worktree-card / D75 side-task-lifecycle-card 同)**:本卡**不取数**,
// 不发起任何授权请求;连接器状态与动作回调全部由调用方注入(`onAction`)。
// 复用既有 connectors 体系(`@ihui/api-client/endpoints/connectors`,语雀/飞书/企微/钉钉)
// 与 `permission-mode-popover` / `tool-approval-dialog` 同族的确认按钮交互,
// **不新建授权流** —— 本卡只是把"授权决策"渲染到消息流内。
//
// 五态:未连接(disconnected) / 连接中(connecting) / 已连接(connected) /
//       需重连(reconnect) / 已拒绝(declined)。
//
// 三条硬要求在这里落地:
//   1. **负向出口恒在**:凡需要用户授权决策的三态(disconnected/connecting/reconnect),
//      「暂不」按钮**始终**渲染,不得只给"允许/连接"一条路;
//   2. **拒绝不阻断对话流**:点「暂不」只触发 `onAction('decline')` 并把卡切到
//      declined 提示态,**不抛错、不卸载消息流、不影响本轮其他内容** —— 拒绝只作用于
//      该连接器的动作;
//   3. **插值文案全部走词表**:`chat.connectorAuth.*`,`{connectorName}` 由调用方传入。

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'

/** 连接器授权卡五态(穷尽,组件内不得有 default 分支) */
export const CONNECTOR_AUTH_STATES = [
  'disconnected',
  'connecting',
  'connected',
  'reconnect',
  'declined',
] as const

export type ConnectorAuthState = (typeof CONNECTOR_AUTH_STATES)[number]

/** 用户可触发的动作;数据面在调用方,本卡只负责上报意图 */
export type ConnectorAuthAction = 'connect' | 'reconnect' | 'decline' | 'moreInfo'

export interface ConnectorAuthCardProps {
  /** 连接器展示名(如「飞书」),用于标题/重连动作的 {connectorName} 插值 */
  connectorName: string
  /** 授权五态;由宿主依据 connectors 体系(ConnectorEntry.configured/enabled/last_error)映射 */
  state: ConnectorAuthState
  /** 动作回调。授权通道在调用方(复用既有 connectors/审批通道),本卡不发起请求 */
  onAction?: (action: ConnectorAuthAction) => void
  className?: string
  'data-testid'?: string
}

/** 需要用户做授权决策的三态 —— 「暂不」负向出口必须出现在这些状态 */
const DECISION_STATES: ReadonlySet<ConnectorAuthState> = new Set([
  'disconnected',
  'connecting',
  'reconnect',
])

export function ConnectorAuthCard({
  connectorName,
  state,
  onAction,
  className,
  'data-testid': testId = 'connector-auth-card',
}: ConnectorAuthCardProps) {
  const t = useTranslations('chat.connectorAuth')

  const needsDecision = DECISION_STATES.has(state)

  return (
    <div
      role="group"
      className={cn('flex flex-col gap-1.5 rounded-md bg-muted/30 p-3', className)}
      data-testid={testId}
      data-connector-auth-state={state}
      data-connector-name={connectorName}
      data-connector-auth-decline-available={needsDecision ? 'true' : 'false'}
    >
      {/* 标题:未连/重连两态展示「连接到 {connectorName}」;已连/已拒绝走各自标签 */}
      <div className="flex flex-wrap items-center gap-2">
        {state === 'connected' ? (
          <span
            className="text-xs font-medium text-emerald-600 dark:text-emerald-500"
            data-connector-auth-label="connected"
          >
            {t('connected')}
          </span>
        ) : state === 'declined' ? (
          <span
            className="text-xs font-medium text-muted-foreground"
            data-connector-auth-label="declined"
          >
            {t('declined', { connectorName })}
          </span>
        ) : (
          <span className="text-xs font-medium" data-connector-auth-label="title">
            {t('title', { connectorName })}
          </span>
        )}
        {state === 'connecting' ? (
          <span
            className="text-[11px] text-muted-foreground"
            data-connector-auth-label="connecting"
          >
            {t('connecting')}
          </span>
        ) : null}
      </div>

      {onAction && needsDecision ? (
        <div className="flex flex-wrap items-center gap-1">
          {state === 'disconnected' ? (
            <button
              type="button"
              onClick={() => onAction?.('connect')}
              data-action="connect"
              className="rounded-sm bg-muted/50 px-1.5 py-0.5 text-[11px] text-foreground transition-colors hover:bg-muted"
            >
              {t('connect')}
            </button>
          ) : null}
          {state === 'reconnect' ? (
            <button
              type="button"
              onClick={() => onAction?.('reconnect')}
              data-action="reconnect"
              className="rounded-sm bg-muted/50 px-1.5 py-0.5 text-[11px] text-foreground transition-colors hover:bg-muted"
            >
              {t('reconnect', { connectorName })}
            </button>
          ) : null}
          {/* 负向出口:三态恒在,拒绝只影响该连接器动作,不阻断本轮对话 */}
          <button
            type="button"
            onClick={() => onAction?.('decline')}
            data-action="decline"
            className="rounded-sm px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {t('decline')}
          </button>
        </div>
      ) : null}

      {/* 更多信息:五态均可展开连接器详情(宿主接线到既有连接器配置页/面板) */}
      {onAction ? (
        <button
          type="button"
          onClick={() => onAction?.('moreInfo')}
          data-action="moreInfo"
          className="self-start rounded-sm px-0 text-[11px] text-muted-foreground/70 underline-offset-2 transition-colors hover:text-foreground hover:underline"
        >
          {t('moreInfo')}
        </button>
      ) : null}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
