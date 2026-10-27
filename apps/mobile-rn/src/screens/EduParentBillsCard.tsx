// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 一个孩子的账单卡(家长视角聚合的一个分组)。
 *
 * 金额与到期日全部来自账目出口 `loadEnrollmentLedger`(经 `aggregateParentBills` 只做加法),
 * 本卡不做任何减法;账目未就绪的期写"—",取数失败写原因,不拿 0 冒充"没欠费"。
 * 布局走 `EduParentUi.createParentStyles` 的共享读数行(守门 241)。
 */
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '@ihui/rn-app'
import { rnSpacing, rnType } from '@ihui/design-tokens'
import { createParentStyles, type ParentT } from './EduParentUi'
import type { ParentBillGroup } from '../lib/edu-parent-bills'

interface Props {
  t: ParentT
  colorScheme: AppThemeMode
  group: ParentBillGroup
  fmtDate: (iso: string | null) => string
  onPress: () => void
}

export function EduParentBillsCard({ t, colorScheme, group, fmtDate, onPress }: Props) {
  const tk = getTokens(colorScheme)
  const styles = createParentStyles(tk)
  const own = createOwnStyles(tk)
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.row}>
        <Text style={styles.strong} numberOfLines={1}>
          {group.name}
        </Text>
        <Text
          style={[
            styles.strongValue,
            { color: group.arrears > 0 ? tk.danger.DEFAULT : tk.text.tertiary },
          ]}
        >
          {group.failed
            ? t('common.loadFailed')
            : group.ledgerPendingCount > 0
              ? '—'
              : `¥${group.arrears}`}
        </Text>
      </View>

      {group.failed ? (
        <Text style={styles.subNote}>{group.failed}</Text>
      ) : group.termCount === 0 ? (
        <Text style={styles.subNote}>{t('common.empty')}</Text>
      ) : (
        group.bills.map((bill) => (
          <View key={bill.enrollmentId} style={own.termBlock}>
            <View style={styles.row}>
              <Text style={own.termTitle} numberOfLines={1}>
                {`${bill.className} · ${bill.termName}`}
              </Text>
              <Text style={styles.rowValue}>{`¥${bill.totalFee}`}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{t('eduChildBills.paid')}</Text>
              <Text style={styles.rowValue}>
                {bill.ledger ? `¥${bill.ledger.paidAmount}` : '—'}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{t('eduChildBills.arrears')}</Text>
              <Text
                style={[
                  styles.rowValue,
                  bill.ledger && bill.ledger.arrears > 0 ? { color: tk.danger.DEFAULT } : null,
                ]}
              >
                {bill.ledger ? `¥${bill.ledger.arrears}` : '—'}
              </Text>
            </View>
            {bill.ledger?.nextDueDate ? (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{t('eduChildBills.nextDue')}</Text>
                <Text style={styles.rowValue}>{fmtDate(bill.ledger.nextDueDate)}</Text>
              </View>
            ) : null}
          </View>
        ))
      )}
    </Pressable>
  )
}

function createOwnStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    termBlock: { paddingTop: rnSpacing.sm, gap: rnSpacing.xs },
    termTitle: { flexShrink: 1, fontSize: rnType.label.size, color: tk.text.secondary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
