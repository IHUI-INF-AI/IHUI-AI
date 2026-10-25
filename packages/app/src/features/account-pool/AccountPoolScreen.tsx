// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { Plus, Wallet } from 'lucide-react-native'
import { getTokens } from '../../theme/tokens'
import type { TFunction } from '../../types'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ScreenSkeleton } from '../../components/ScreenStates'
import { TextField } from '../../components/TextField'
import { createAccountPoolStyles } from './account-pool-styles'
import { AccountPoolRowCard } from './account-pool-row'

/** 号池可选平台:与 apps/api 的 RELAY_PROVIDERS 同集(codearts 无每日签到引擎,如实列出) */
export const ACCOUNT_POOL_PROVIDERS = ['trae', 'workbuddy', 'qoder', 'codearts'] as const

export interface AccountPoolRow {
  id: string
  providerCode: string
  uid: string
  name: string
  isEnabled: boolean
  /** 号池巡检定级(healthy / degraded / down / unknown);down = 票已不被上游接受 */
  healthStatus: string
  /** 该号在 relay 转发侧被使用的累计次数 */
  totalCalls: number
  /** 号池 → 签到助手同步挂起(断链待补推) */
  checkinPending: boolean
}

export interface AccountPoolDraft {
  providerCode: string
  name: string
  token: string
  refreshToken: string
}

/** 注入式跨端屏:平台侧(导航 / API / 确认弹窗)由 wrapper 提供,本屏只管渲染与回调。
 *  本文件同时是门 39 V2 要求的同名共享屏(RN 端号池屏按"有 @ihui/rn-app import 必须有
 *  同名共享屏"这一档过门)。 */
export interface AccountPoolScreenProps {
  t: TFunction
  rows: AccountPoolRow[]
  loading: boolean
  refreshing: boolean
  /** 正在操作的账号 id;启停 / 签到 / 删除共用一把忙碌锁 */
  busyId: string | null
  submitting: boolean
  draft: AccountPoolDraft
  onDraftChange: (patch: Partial<AccountPoolDraft>) => void
  onSave: () => void
  onCheckin: (row: AccountPoolRow) => void
  onToggle: (row: AccountPoolRow) => void
  onDelete: (row: AccountPoolRow) => void
  onRefresh: () => void
  onBack: () => void
  /** 空态里的「回签到助手」入口;未给则不渲染(平台未必有该路由) */
  onBackToCheckin?: () => void
  colorScheme?: 'light' | 'dark'
}

export function AccountPoolScreen({
  t,
  rows,
  loading,
  refreshing,
  busyId,
  submitting,
  draft,
  onDraftChange,
  onSave,
  onCheckin,
  onToggle,
  onDelete,
  onRefresh,
  onBack,
  onBackToCheckin,
  colorScheme = 'light',
}: AccountPoolScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createAccountPoolStyles(tk), [tk])
  const canSave = draft.name.trim() !== '' && draft.token.trim() !== '' && !submitting
  const enabledCount = rows.filter((r) => r.isEnabled).length

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('accountPool.title')}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.card}>
          <View style={styles.rowHead}>
            <Wallet size={16} color={tk.text.secondary} />
            <Text style={styles.summary}>
              {t('accountPool.summary', { total: rows.length, enabled: enabledCount })}
            </Text>
          </View>
          <Text style={styles.muted}>{t('accountPool.subtitle')}</Text>
        </View>

        {loading ? (
          <ScreenSkeleton variant="list" count={4} colorScheme={colorScheme} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={t('accountPool.empty')}
            desc={t('accountPool.emptyHint')}
            actionLabel={onBackToCheckin ? t('accountPool.backToCheckin') : undefined}
            onAction={onBackToCheckin}
            colorScheme={colorScheme}
          />
        ) : (
          rows.map((row) => (
            <AccountPoolRowCard
              key={row.id}
              row={row}
              t={t}
              styles={styles}
              tk={tk}
              busy={busyId === row.id}
              onCheckin={onCheckin}
              onToggle={onToggle}
              onDelete={onDelete}
            />
          ))
        )}

        <View style={styles.card}>
          <View style={styles.rowHead}>
            <Plus size={16} color={tk.text.secondary} />
            <Text style={styles.cardTitle}>{t('accountPool.addTitle')}</Text>
          </View>
          <View style={styles.chips}>
            {ACCOUNT_POOL_PROVIDERS.map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.chip, draft.providerCode === p && styles.chipOn]}
                onPress={() => onDraftChange({ providerCode: p })}
              >
                <Text
                  style={[styles.chipText, draft.providerCode === p ? styles.chipOnText : null]}
                >
                  {p}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextField
            colorScheme={colorScheme}
            value={draft.name}
            onChangeText={(v) => onDraftChange({ name: v })}
            placeholder={t('accountPool.namePlaceholder')}
          />
          <Text style={styles.label}>{t('accountPool.token')}</Text>
          <TextField
            colorScheme={colorScheme}
            value={draft.token}
            onChangeText={(v) => onDraftChange({ token: v })}
            multiline
            numberOfLines={3}
            style={styles.tokenInput}
          />
          <Text style={styles.label}>
            {t('accountPool.refreshToken')}（{t('accountPool.optional')}）
          </Text>
          <TextField
            colorScheme={colorScheme}
            value={draft.refreshToken}
            onChangeText={(v) => onDraftChange({ refreshToken: v })}
            multiline
            numberOfLines={2}
            style={styles.tokenInput}
          />
          <TouchableOpacity
            style={[styles.submit, !canSave && styles.submitOff]}
            disabled={!canSave}
            onPress={onSave}
          >
            <Text style={styles.submitText}>
              {submitting ? t('accountPool.adding') : t('accountPool.save')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
