// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, type TextStyle } from 'react-native'
import { Ban, GitBranch, Network, Play, Users } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ErrorState } from '../../components/ScreenStates'

const NS = 'subagentDetailPage'

type BadgeTone = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused'

/** 与 web STATUS_BADGE 同档(apps/web/app/(main)/subagents/detail/SubagentDetailClient.tsx:25-32) */
const STATUS_TONE: Record<string, BadgeTone> = {
  pending: 'pending',
  running: 'running',
  completed: 'completed',
  failed: 'failed',
  cancelled: 'cancelled',
  paused: 'paused',
}

export interface SubagentDetailHeaderView {
  id: string
  goal: string
  status: string
  /** 状态文案由薄壳按 status 取(dispatchStatus.* 同域键) */
  statusText: string
  /** 空串 = 该派单无 agentRole,web 条件渲染不出现(SubagentDetailClient.tsx:210) */
  roleText: string
  /** 空串 = 无 priority(client.tsx:216) */
  priorityText: string
  createdAtText: string
  canResume: boolean
  canCancel: boolean
}

export interface SubagentQuotaBarView {
  key: string
  label: string
  used: number
  total: number
  /** web QuotaBar 尾部单位(ms / '' / 次,client.tsx:265/271/277),薄壳注入 */
  unit: string
}

export interface SubagentDagNodeView {
  id: string
  task: string
}

export interface SubagentDagEdgeView {
  from: string
  to: string
  condition: string
}

export interface SubagentMessageView {
  id: string
  fromAgent: string
  toAgent: string
  content: string
  /** 消息类型文案(messageType),薄壳按字典取,未知原样回退 */
  typeText: string
  timeText: string
}

export interface SubagentDetailScreenProps {
  t: TFunction
  colorScheme: AppThemeMode
  onBack: () => void
  /** 非空即未登录门(web useAuthGate 同口径,client.tsx:97) */
  loginRequiredText: string
  /** 缺 id 参数(client.tsx:133-135 的前置分支) */
  missingId: boolean
  loading: boolean
  error: string | null
  onRetry: () => void
  /** null = 不在活跃列表(client.tsx:196-199 的空态) */
  header: SubagentDetailHeaderView | null
  actionPending: boolean
  onResume: () => void
  onCancel: () => void
  dagLoading: boolean
  dagNodes: SubagentDagNodeView[]
  dagEdges: SubagentDagEdgeView[]
  quotasLoading: boolean
  quotaBars: SubagentQuotaBarView[]
  quotaExceeded: boolean
  messagesLoading: boolean
  messages: SubagentMessageView[]
}

/**
 * 子智能体派单详情共享屏 —— 承载 web /subagents/detail。
 *
 * 数据来源:GET /api/subagents/active(取 header,与 web 同法,client.tsx:99-104/122)、
 * GET /api/subagents/:id/dag、/quotas、/messages(endpoints/subagents-detail.ts),
 * 动作 POST /api/subagents/:id/cancel|resume。
 *
 * 与 web 的口径差(如实登记):
 * 1. web 的「DAG 可视化」是 SVG 拓扑画布(DagGraph),RN 落为「节点 + 出边」列表 ——
 *    数据同源(dag.nodes/dag.edges),不伪造画布,也不隐藏节点/边。
 * 2. web 的配额条宽度动画在 RN 用百分比 View 宽度直出(同 pct 阈值 90/70 换色)。
 * 3. web 整页无 i18n(硬编码中文),RN 五语文案取自同域既有键(dispatchStatus /
 *    dispatchDialog / subagent / swarmTopology),值逐字未改写。
 * 平台无关:取数 / 轮询 / 登录态 / 格式化全由薄壳注入,本文件只管渲染与三态。
 */
export function SubagentDetailScreen({
  t,
  colorScheme,
  onBack,
  loginRequiredText,
  missingId,
  loading,
  error,
  onRetry,
  header,
  actionPending,
  onResume,
  onCancel,
  dagLoading,
  dagNodes,
  dagEdges,
  quotasLoading,
  quotaBars,
  quotaExceeded,
  messagesLoading,
  messages,
}: SubagentDetailScreenProps) {
  const tk = getTokens(colorScheme)
  const { styles, badgeTone } = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <View style={styles.titleBox}>
          <View style={styles.titleRow}>
            <Network size={18} color={tk.brand.DEFAULT} />
            <Text style={styles.title}>{t(`${NS}.title`)}</Text>
          </View>
          <Text style={styles.muted}>{t(`${NS}.backToList`)}</Text>
        </View>
      </View>

      {missingId ? (
        <EmptyState title={t(`${NS}.missingId`)} colorScheme={colorScheme} />
      ) : loginRequiredText ? (
        <Text style={styles.loginHint}>{loginRequiredText}</Text>
      ) : loading ? (
        <View style={styles.centerBlock}>
          <GitBranch size={22} color={tk.text.tertiary} />
          <Text style={styles.muted}>{t(`${NS}.loading`)}</Text>
        </View>
      ) : error ? (
        <ErrorState
          message={error}
          retryLabel={t(`${NS}.retry`)}
          onRetry={onRetry}
          colorScheme={colorScheme}
        />
      ) : !header ? (
        <EmptyState title={t(`${NS}.notFound`)} colorScheme={colorScheme} />
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.cardTitleBox}>
                <Text style={styles.goal} numberOfLines={2}>
                  {header.goal}
                </Text>
                <Text style={styles.muted}>{`ID: ${header.id}`}</Text>
              </View>
              <View style={styles.actions}>
                {header.canResume ? (
                  <TouchableOpacity
                    style={[styles.actionBtn, actionPending && styles.actionBtnDisabled]}
                    onPress={onResume}
                    disabled={actionPending}
                  >
                    <Play size={12} color={tk.text.primary} />
                    <Text style={styles.actionText}>{t(`${NS}.resume`)}</Text>
                  </TouchableOpacity>
                ) : null}
                {header.canCancel ? (
                  <TouchableOpacity
                    style={[styles.actionBtn, actionPending && styles.actionBtnDisabled]}
                    onPress={onCancel}
                    disabled={actionPending}
                  >
                    <Ban size={12} color={tk.danger.DEFAULT} />
                    <Text style={[styles.actionText, styles.actionTextDanger]}>
                      {t(`${NS}.cancel`)}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            <View style={styles.fieldGrid}>
              <View style={styles.fieldItem}>
                <Text style={styles.fieldLabel}>{t(`${NS}.statusLabel`)}</Text>
                <Text
                  style={[
                    styles.badge,
                    badgeTone[STATUS_TONE[header.status] ?? 'pending'],
                  ]}
                >
                  {header.statusText}
                </Text>
              </View>
              {header.roleText ? (
                <View style={styles.fieldItem}>
                  <Text style={styles.fieldLabel}>{t(`${NS}.roleLabel`)}</Text>
                  <Text style={styles.fieldValue}>{header.roleText}</Text>
                </View>
              ) : null}
              {header.priorityText ? (
                <View style={styles.fieldItem}>
                  <Text style={styles.fieldLabel}>{t(`${NS}.priorityLabel`)}</Text>
                  <Text style={styles.fieldValue}>{header.priorityText}</Text>
                </View>
              ) : null}
              <View style={styles.fieldItem}>
                <Text style={styles.fieldLabel}>{t(`${NS}.createdAtLabel`)}</Text>
                <Text style={styles.fieldValue}>{header.createdAtText}</Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHead}>
              <GitBranch size={14} color={tk.text.secondary} />
              <Text style={styles.sectionTitle}>{t(`${NS}.dagTitle`)}</Text>
            </View>
            {dagLoading ? (
              <Text style={styles.muted}>{t(`${NS}.loading`)}</Text>
            ) : dagNodes.length === 0 ? (
              <Text style={styles.muted}>{t(`${NS}.noQuotaData`)}</Text>
            ) : (
              <View style={styles.dagBox}>
                {dagNodes.map((n) => (
                  <View key={n.id} style={styles.dagNode}>
                    <Text style={styles.dagNodeId} numberOfLines={1}>
                      {n.id}
                    </Text>
                    <Text style={styles.dagNodeTask} numberOfLines={2}>
                      {n.task}
                    </Text>
                  </View>
                ))}
                {dagEdges.map((e) => (
                  <Text key={`${e.from}->${e.to}`} style={styles.dagEdge} numberOfLines={1}>
                    {`${e.from} → ${e.to}${e.condition ? ` (${e.condition})` : ''}`}
                  </Text>
                ))}
              </View>
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHead}>
              <GitBranch size={14} color={tk.text.secondary} />
              <Text style={styles.sectionTitle}>{t(`${NS}.quotasTitle`)}</Text>
            </View>
            {quotasLoading ? (
              <Text style={styles.muted}>{t(`${NS}.loading`)}</Text>
            ) : quotaBars.length === 0 ? (
              <Text style={styles.muted}>{t(`${NS}.noQuotaData`)}</Text>
            ) : (
              <View style={styles.quotaBox}>
                {quotaBars.map((q) => {
                  const pct = q.total > 0 ? Math.min(100, (q.used / q.total) * 100) : 0
                  return (
                    <View key={q.key} style={styles.quotaRow}>
                      <View style={styles.quotaHead}>
                        <Text style={styles.fieldLabel}>{q.label}</Text>
                        <Text style={styles.quotaValue}>
                          {`${q.used.toLocaleString()} / ${q.total.toLocaleString()} ${q.unit}`}
                        </Text>
                      </View>
                      <View style={styles.quotaTrack}>
                        <View
                          style={[
                            styles.quotaFill,
                            { width: `${pct}%` },
                            pct >= 90 ? styles.quotaFillDanger : null,
                            pct >= 70 && pct < 90 ? styles.quotaFillWarn : null,
                          ]}
                        />
                      </View>
                    </View>
                  )
                })}
                {quotaExceeded ? (
                  <Text style={styles.exceeded}>{t(`${NS}.quotaExceeded`)}</Text>
                ) : null}
              </View>
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHead}>
              <Users size={14} color={tk.text.secondary} />
              <Text style={styles.sectionTitle}>{t(`${NS}.messagesTitle`)}</Text>
            </View>
            {messagesLoading ? (
              <Text style={styles.muted}>{t(`${NS}.loading`)}</Text>
            ) : messages.length === 0 ? (
              <Text style={styles.muted}>{t(`${NS}.emptyMessages`)}</Text>
            ) : (
              <View style={styles.msgBox}>
                {messages.map((m) => (
                  <View key={m.id} style={styles.msgRow}>
                    <View style={styles.msgHead}>
                      <Text style={styles.msgRoute} numberOfLines={1}>
                        {`${m.fromAgent} → ${m.toAgent}`}
                      </Text>
                      <Text style={styles.msgType}>{m.typeText}</Text>
                    </View>
                    <Text style={styles.msgContent}>{m.content}</Text>
                    <Text style={styles.muted}>{m.timeText}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg, paddingHorizontal: rnSpacing.md },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.md,
      marginTop: rnSpacing.md,
    },
    titleBox: { flex: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    title: { fontSize: 22, fontWeight: '600', color: tk.text.primary },
    muted: { marginTop: 2, fontSize: rnType.label.size, color: tk.text.secondary },
    loginHint: { marginTop: rnSpacing.xl, fontSize: rnType.body.size, color: tk.text.secondary },
    centerBlock: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['2xl'],
    },
    scroll: { flex: 1, marginTop: rnSpacing.md },
    scrollContent: { gap: rnSpacing.md, paddingBottom: rnSpacing['3xl'] },
    card: {
      gap: rnSpacing.sm,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: rnSpacing.sm },
    cardTitleBox: { flex: 1 },
    goal: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    actions: { flexDirection: 'row', gap: rnSpacing.sm },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    actionBtnDisabled: { opacity: 0.5 },
    actionText: { fontSize: rnType.caption.size, color: tk.text.primary },
    actionTextDanger: { color: tk.danger.DEFAULT },
    fieldGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.lg },
    fieldItem: { minWidth: 96, gap: 2 },
    fieldLabel: { fontSize: rnType.caption.size, color: tk.text.secondary },
    fieldValue: { fontSize: rnType.label.size, color: tk.text.primary },
    badge: {
      alignSelf: 'flex-start',
      marginTop: 2,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 2,
      borderRadius: rnRadius.sm,
      fontSize: rnType.caption.size,
      fontWeight: '500',
    },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      marginBottom: rnSpacing.xs,
    },
    sectionTitle: { fontSize: rnType.label.size, fontWeight: '600', color: tk.text.primary },
    dagBox: { gap: rnSpacing.xs },
    dagNode: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
      gap: 2,
    },
    dagNodeId: { fontSize: rnType.caption.size, fontWeight: '600', color: tk.brandAccent.deep },
    dagNodeTask: { fontSize: rnType.caption.size, color: tk.text.primary },
    dagEdge: { fontSize: rnType.caption.size, color: tk.text.secondary },
    quotaBox: { gap: rnSpacing.md },
    quotaRow: { gap: 4 },
    quotaHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    quotaValue: { fontSize: rnType.caption.size, color: tk.text.primary },
    quotaTrack: {
      height: 8,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.muted,
      overflow: 'hidden',
    },
    quotaFill: { height: 8, backgroundColor: tk.success.DEFAULT },
    quotaFillWarn: { backgroundColor: tk.warning.DEFAULT },
    quotaFillDanger: { backgroundColor: tk.danger.DEFAULT },
    exceeded: { fontSize: rnType.caption.size, fontWeight: '600', color: tk.danger.DEFAULT },
    msgBox: { gap: rnSpacing.sm },
    msgRow: {
      gap: 2,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    msgHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    msgRoute: { flex: 1, fontSize: rnType.caption.size, fontWeight: '600', color: tk.text.primary },
    msgType: { fontSize: rnType.caption.size, color: tk.text.secondary },
    msgContent: { fontSize: rnType.label.size, color: tk.text.primary },
  })

  const badgeTone: Record<BadgeTone, TextStyle> = {
    pending: { backgroundColor: tk.warning.amberLight, color: tk.warning.amberText },
    running: { backgroundColor: tk.brandAccent.light, color: tk.brandAccent.deep },
    completed: { backgroundColor: tk.success.lightest, color: tk.success.deepText },
    failed: { backgroundColor: tk.danger.light, color: tk.danger.DEFAULT },
    cancelled: { backgroundColor: tk.surface.muted, color: tk.text.secondary },
    paused: { backgroundColor: tk.warning.amberLight, color: tk.warning.amberText },
  }

  return { styles, badgeTone }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
