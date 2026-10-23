// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { Text, TouchableOpacity, View } from 'react-native'
import { CalendarCheck, Trash2 } from 'lucide-react-native'
import type { AppThemeTokens } from '../../theme/tokens'
import type { TFunction } from '../../types'
import { type createAccountPoolStyles } from './account-pool-styles'
import type { AccountPoolRow } from './AccountPoolScreen'

type Styles = ReturnType<typeof createAccountPoolStyles>

export interface AccountPoolRowProps {
  row: AccountPoolRow
  t: TFunction
  styles: Styles
  tk: AppThemeTokens
  /** 该行是否有请求在飞(启停/签到共用一把锁,避免连点) */
  busy: boolean
  onCheckin: (row: AccountPoolRow) => void
  onToggle: (row: AccountPoolRow) => void
  onDelete: (row: AccountPoolRow) => void
}

/** 号池单行卡片:平台/启停/待同步徽章 + 账号标识 + 调用次数 + 三个动作 */
export function AccountPoolRowCard({
  row,
  t,
  styles,
  tk,
  busy,
  onCheckin,
  onToggle,
  onDelete,
}: AccountPoolRowProps) {
  return (
    <View style={styles.card}>
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
            <Text style={[styles.badge, styles.badgePending]}>{t('accountPool.syncPending')}</Text>
          ) : null}
        </View>
      </View>
      <Text style={styles.muted} numberOfLines={1}>
        {t('accountPool.uid')}: {row.uid}
      </Text>
      <Text style={styles.muted}>
        {t('accountPool.calls')}: {row.totalCalls}
      </Text>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.action} disabled={busy} onPress={() => onCheckin(row)}>
          <CalendarCheck size={14} color={tk.text.primary} />
          <Text style={styles.actionText}>{t('accountPool.checkin')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.action} disabled={busy} onPress={() => onToggle(row)}>
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
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
