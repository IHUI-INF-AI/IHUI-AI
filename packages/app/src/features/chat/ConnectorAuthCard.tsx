// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D78 连接器授权卡(G-107)—— 对话流内渲染件,RN/共享屏层实现。
//
// **与 web 端同源**:本卡的五态 / 四动词 / 决策态集合与
// `apps/web/src/components/ai/connector-auth-card.tsx` **逐字对齐**,由
// `packages/app/tests/connector-auth-card.test.tsx` 解析两侧源码做集合对账钉死
// (两端语义必须同源,不得各写一套)。**禁止**在本文件新增第五动词或第六态而不走同一条对账。
//
// **数据面纪律(与 web 端同)**:本卡不取数、不发起任何授权请求;连接器状态由宿主
// (依据 connectors 体系 ConnectorEntry.configured/enabled/last_error 映射)注入,
// 动作意图经 `onAction` 上报。授权通道复用既有 connectors/审批通道,本卡只是把
// "授权决策"渲染到消息流内。
//
// 三条硬要求(与 web 端同形):
//   1. **负向出口恒在**:凡需要用户授权决策的三态(disconnected/connecting/reconnect),
//      「暂不」始终渲染,不得只给"允许/连接"一条路;
//   2. **拒绝不阻断对话流**:点「暂不」只触发 `onAction('decline')`,宿主把卡切到
//      declined 提示态即可 —— 不抛错、不卸载消息流,拒绝只作用于该连接器的动作;
//   3. **插值文案全走词表**:`chat.connectorAuth.*`,`{connectorName}` 经 `t` 的 params
//      插值(`@ihui/i18n/loader` 与 next-intl 都认 `{name}` 形态),key 与 web 端五语言逐值同源。

import { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import type { TFunction } from '@ihui/types'
import { rnRadius } from '@ihui/design-tokens'
import { getTokens, type AppThemeTokens, type AppThemeMode } from '../../theme/tokens'

/** 连接器授权卡五态(穷尽,组件内不得有 default 分支)—— 与 web 端 CONNECTOR_AUTH_STATES 逐字同 */
export const CONNECTOR_AUTH_STATES = [
  'disconnected',
  'connecting',
  'connected',
  'reconnect',
  'declined',
] as const

export type ConnectorAuthState = (typeof CONNECTOR_AUTH_STATES)[number]

/** 用户可触发的动作;数据面在宿主,本卡只负责上报意图 —— 与 web 端 ConnectorAuthAction 逐字同 */
export type ConnectorAuthAction = 'connect' | 'reconnect' | 'decline' | 'moreInfo'

/**
 * 需要用户做授权决策的三态 —— 「暂不」负向出口必须出现在这些状态。
 * 与 web 端组件内 `DECISION_STATES = {disconnected, connecting, reconnect}` 同一判据的
 * 唯一共享层出口;宿主与测试都从这里取值,不得再抄第二份集合。
 */
export function isConnectorAuthDecisionState(state: ConnectorAuthState): boolean {
  return state === 'disconnected' || state === 'connecting' || state === 'reconnect'
}

export interface ConnectorAuthCardProps {
  /** 连接器展示名(如「飞书」),用于标题/重连/已拒绝的 {connectorName} 插值 */
  connectorName: string
  /** 授权五态;由宿主依据 connectors 体系映射(与本包其余共享屏同形) */
  state: ConnectorAuthState
  /** 取词通道 —— 与各共享屏的 `t: TFunction` prop 同一类型(@ihui/types 单一来源) */
  t: TFunction
  /** 动作回调。授权通道在宿主(复用既有 connectors/审批通道),本卡不发起请求 */
  onAction?: (action: ConnectorAuthAction) => void
  /**
   * 已解析主题。必填而非 `= 'light'` 默认值(同 `components/BackChevron.tsx`):
   * 带默认值的形参是守门 91 认定的"静默脱主题开关",必填改由 `tsc` 强制,比门更严。
   */
  colorScheme: AppThemeMode
  style?: StyleProp<ViewStyle>
  testID?: string
}

export function ConnectorAuthCard({
  connectorName,
  state,
  t,
  onAction,
  colorScheme,
  style,
  testID = 'connector-auth-card',
}: ConnectorAuthCardProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk, colorScheme === 'dark'), [tk, colorScheme])

  const needsDecision = isConnectorAuthDecisionState(state)

  return (
    <View
      testID={testID}
      // 与 web 端 data-connector-auth-state 同位的测试/E2E 挂载点(RN 无 data-*)。
      // 根容器不设 accessibilityRole:RN 的 role 联合里没有 'group' 档,
      // 语义靠子级按钮各自的 accessibilityRole="button" 成立。
      nativeID={`${testID}--${state}`}
      style={[styles.container, style]}
    >
      {/* 标题:未连/连接中/重连三态展示「连接到 {connectorName}」;已连/已拒绝走各自标签 */}
      <View style={styles.labelRow}>
        {state === 'connected' ? (
          <Text testID={`${testID}-label-connected`} style={styles.connectedLabel}>
            {t('chat.connectorAuth.connected')}
          </Text>
        ) : state === 'declined' ? (
          <Text testID={`${testID}-label-declined`} style={styles.mutedLabel}>
            {t('chat.connectorAuth.declined', { connectorName })}
          </Text>
        ) : (
          <Text testID={`${testID}-label-title`} style={styles.title}>
            {t('chat.connectorAuth.title', { connectorName })}
          </Text>
        )}
        {state === 'connecting' ? (
          <Text testID={`${testID}-label-connecting`} style={styles.smallMutedLabel}>
            {t('chat.connectorAuth.connecting')}
          </Text>
        ) : null}
      </View>

      {onAction && needsDecision ? (
        <View style={styles.actionRow}>
          {state === 'disconnected' ? (
            <Pressable
              accessibilityRole="button"
              testID={`${testID}-action-connect`}
              onPress={() => onAction('connect')}
              style={({ pressed }) => [styles.chip, pressed ? styles.chipPressed : null]}
            >
              <Text style={styles.chipText}>{t('chat.connectorAuth.connect')}</Text>
            </Pressable>
          ) : null}
          {state === 'reconnect' ? (
            <Pressable
              accessibilityRole="button"
              testID={`${testID}-action-reconnect`}
              onPress={() => onAction('reconnect')}
              style={({ pressed }) => [styles.chip, pressed ? styles.chipPressed : null]}
            >
              <Text style={styles.chipText}>
                {t('chat.connectorAuth.reconnect', { connectorName })}
              </Text>
            </Pressable>
          ) : null}
          {/* 负向出口:三态恒在,拒绝只影响该连接器动作,不阻断本轮对话 */}
          <Pressable
            accessibilityRole="button"
            testID={`${testID}-action-decline`}
            onPress={() => onAction('decline')}
            style={({ pressed }) => [styles.flatChip, pressed ? styles.flatChipPressed : null]}
          >
            <Text style={styles.declineText}>{t('chat.connectorAuth.decline')}</Text>
          </Pressable>
        </View>
      ) : null}

      {/* 更多信息:五态均可展开连接器详情(宿主接线到既有连接器配置页/面板) */}
      {onAction ? (
        <Pressable
          accessibilityRole="button"
          testID={`${testID}-action-moreInfo`}
          onPress={() => onAction('moreInfo')}
          style={({ pressed }) => [styles.moreInfo, pressed ? styles.flatChipPressed : null]}
        >
          <Text style={styles.moreInfoText}>{t('chat.connectorAuth.moreInfo')}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

/**
 * 与 web 端类名档的对应(p-3=12 / gap-1.5=6 / gap-2=8 / gap-1=4 / px-1.5 py-0.5=6×2 /
 * text-xs=12 / text-[11px]=11 / rounded-md=rnRadius.md / rounded-sm=rnRadius.sm)。
 * 颜色一律取主题 token,不落新色值:`bg-muted/30`→surface.muted、
 * `bg-muted/50`→border.light(chip 底,深浅两态各自翻转)、`text-muted-foreground`→text.tertiary、
 * `text-emerald-600 / dark:text-emerald-500`→light 取 success.deep、dark 取 success.DEFAULT
 * (同一"绿"语义按主题挑可读档,不是第二色源)。
 */
function createStyles(tk: AppThemeTokens, dark: boolean) {
  return StyleSheet.create({
    container: {
      backgroundColor: tk.surface.muted,
      borderRadius: rnRadius.md,
      padding: 12,
      gap: 6,
    },
    labelRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
    },
    title: {
      fontSize: 12,
      fontWeight: '500',
      color: tk.text.primary,
    },
    connectedLabel: {
      fontSize: 12,
      fontWeight: '500',
      color: dark ? tk.success.DEFAULT : tk.success.deep,
    },
    mutedLabel: {
      fontSize: 12,
      fontWeight: '500',
      color: tk.text.tertiary,
    },
    smallMutedLabel: {
      fontSize: 11,
      color: tk.text.tertiary,
    },
    actionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 4,
    },
    chip: {
      backgroundColor: tk.border.light,
      borderRadius: rnRadius.sm,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    chipPressed: {
      backgroundColor: tk.border.medium,
    },
    chipText: {
      fontSize: 11,
      color: tk.text.primary,
    },
    flatChip: {
      borderRadius: rnRadius.sm,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    flatChipPressed: {
      opacity: 0.7,
    },
    declineText: {
      fontSize: 11,
      color: tk.text.tertiary,
    },
    moreInfo: {
      alignSelf: 'flex-start',
      borderRadius: rnRadius.sm,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    moreInfoText: {
      fontSize: 11,
      color: tk.text.tertiary,
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
