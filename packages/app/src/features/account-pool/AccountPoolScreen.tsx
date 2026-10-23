// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { CalendarCheck, Plus, Trash2 } from 'lucide-react-native'
import type { TFunction } from '../../types'
import { BackChevron } from '../../components/BackChevron'
import { TextField } from '../../components/TextField'
import { getTokens } from '../../theme/tokens'
import { createAccountPoolStyles } from './account-pool-styles'

/** 号池可选平台:与 apps/api 的 RELAY_PROVIDERS 同集(codearts 无每日签到引擎,如实列出) */
export const ACCOUNT_POOL_PROVIDERS = ['trae', 'workbuddy', 'qoder', 'codearts'] as const

export interface AccountPoolRow {
  id: string
  providerCode: string
  uid: string
  name: string
  isEnabled: boolean
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
 *  同时是门 39 V2 要求的同名共享源 —— apps/mobile-rn 那侧的号池屏按"有 import 必须有
 *  同名共享屏"这一档过门,摘掉本文件会把那道新屏的提交顶红。 */
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
  colorScheme = 'light',
}: AccountPoolScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createAccountPoolStyles(tk), [tk])
  const canSave = draft.name.trim() !== '' && draft.token.trim() !== '' && !submitting

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('accountPool.title')}</Text>
        <Text style={styles.subtitle}>{t('accountPool.subtitle')}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <ActivityIndicator color={tk.brand.DEFAULT ?? tk.text.secondary} />
        ) : rows.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('accountPool.empty')}</Text>
            <Text style={styles.muted}>{t('accountPool.emptyHint')}</Text>
          </View>
        ) : (
          rows.map((row) => (
            <View key={row.id} style={styles.card}>
              <View style={styles.rowHead}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {row.name}
                </Text>
                <View style={styles.badges}>
                  <Text style={styles.badge}>{row.providerCode}</Text>
                  <Text style={[styles.badge, row.isEnabled ? styles.badgeOn : null]}>
                    {row.isEnabled ? t('accountPool.enabled') : t('accountPool.disabled')}
                  </Text>
                  {row.checkinPending ? (
                    <Text style={[styles.badge, styles.badgePending]}>
                      {t('accountPool.syncPending')}
                    </Text>
                  ) : null}
                </View>
              </View>
              <Text style={styles.muted} numberOfLines={1}>
                {t('accountPool.uid')}: {row.uid}
              </Text>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.action}
                  disabled={busyId === row.id}
                  onPress={() => onCheckin(row)}
                >
                  <CalendarCheck size={14} color={tk.text.primary} />
                  <Text style={styles.actionText}>{t('accountPool.checkin')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.action}
                  disabled={busyId === row.id}
                  onPress={() => onToggle(row)}
                >
                  <Text style={styles.actionText}>
                    {row.isEnabled ? t('accountPool.disable') : t('accountPool.enable')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.action} onPress={() => onDelete(row)}>
                  <Trash2 size={14} color={tk.text.secondary} />
                  <Text style={styles.actionText}>{t('accountPool.delete')}</Text>
                </TouchableOpacity>
              </View>
            </View>
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
                  style={[styles.chipText, draft.providerCode === p ? styles.chipTextOn : null]}
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
