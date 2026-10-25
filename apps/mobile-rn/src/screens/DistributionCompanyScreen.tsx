// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Building2, Coins, RefreshCw, Users } from 'lucide-react-native'
import { fetchApi } from '@ihui/api-client'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { tokens } from '../theme/active-tokens'
import { NavBar } from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

/**
 * 分销企业中心 —— 对齐 web /distribution/company。
 * 契约实读自 apps/api/src/routes/finance.ts:167-173 与 db/commission-queries.ts:277-297:
 *   GET /finance/commission/summary → { totalAmount, totalToken, commissionDay }
 *   (近 commissionDay 天、status=1 的 commission_flows 聚合;后端不返回明细分项,故本屏只做汇总)
 *   GET /finance/distribution/subordinates → listSubordinates(userId, page, limit)
 */
interface CommissionSummary {
  totalAmount: number
  totalToken: number
  commissionDay: number
}

interface SubordinateRow {
  userId?: string
  nickname?: string
  count?: number
  [key: string]: unknown
}

type Nav = NativeStackNavigationProp<RootStackParamList>

export default function DistributionCompanyScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<Nav>()
  const [summary, setSummary] = useState<CommissionSummary | null>(null)
  const [subs, setSubs] = useState<SubordinateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    try {
      const [sumRes, subRes] = await Promise.all([
        fetchApi<CommissionSummary>('/api/finance/commission/summary'),
        fetchApi<{ list?: SubordinateRow[] } | SubordinateRow[]>(
          '/api/finance/distribution/subordinates?page=1&limit=20',
        ),
      ])
      setSummary(sumRes.success ? sumRes.data : null)
      const payload = subRes.success ? subRes.data : null
      const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.list)
          ? payload.list
          : []
      setSubs(subRes.success ? list : [])
      if (!sumRes.success) setFailed(true)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const styles = makeStyles()

  return (
    <View style={styles.container}>
      <NavChrome>
        <NavBar
          title={t('distributionCompany.title')}
          onBack={() => navigation.goBack()}
          rightActions={[
            {
              icon: RefreshCw,
              label: t('distributionCompany.refresh'),
              onPress: () => void load(),
            },
          ]}
        />
      </NavChrome>

      <ScrollView contentContainerStyle={styles.body}>
        {loading && !summary ? (
          <Text style={styles.centerText}>{t('common.loading')}</Text>
        ) : failed && !summary ? (
          <Text style={styles.errorText}>{t('distributionCompany.loadFailed')}</Text>
        ) : summary ? (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Coins size={16} color={tokens.text.secondary} />
              <Text style={styles.cardTitle}>{t('distributionCompany.windowTitle')}</Text>
            </View>
            <Text style={styles.windowHint}>
              {t('distributionCompany.lastDays', { n: summary.commissionDay })}
            </Text>
            <View style={styles.statRow}>
              <View style={styles.statCell}>
                <Text style={styles.statValue}>{summary.totalAmount}</Text>
                <Text style={styles.statLabel}>{t('distributionCompany.totalAmount')}</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statValue}>{summary.totalToken}</Text>
                <Text style={styles.statLabel}>{t('distributionCompany.totalToken')}</Text>
              </View>
            </View>
          </View>
        ) : (
          <Text style={styles.centerText}>{t('distributionCompany.empty')}</Text>
        )}

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Users size={16} color={tokens.text.secondary} />
            <Text style={styles.cardTitle}>{t('distributionCompany.subordinates')}</Text>
          </View>
          {subs.length === 0 ? (
            <Text style={styles.muted}>
              {loading ? t('common.loading') : t('distributionCompany.subordinatesEmpty')}
            </Text>
          ) : (
            subs.map((s, i) => (
              <View key={`${s.userId ?? i}`} style={styles.row}>
                <Building2 size={14} color={tokens.text.tertiary} />
                <Text style={styles.rowText} numberOfLines={1}>
                  {s.nickname ?? t('distributionCompany.anonymousUser')}
                </Text>
                {typeof s.count === 'number' ? (
                  <Text style={styles.rowCount}>{s.count}</Text>
                ) : null}
              </View>
            ))
          )}
        </View>

        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => navigation.navigate('Distribution')}
          activeOpacity={0.7}
        >
          <Text style={styles.linkText}>{t('distributionCompany.openDistribution')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => navigation.navigate('Withdraw')}
          activeOpacity={0.7}
        >
          <Text style={styles.linkText}>{t('distributionCompany.openWithdraw')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

function makeStyles() {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tokens.surface.bg },
    body: { padding: rnSpacing.md, gap: rnSpacing.md, paddingBottom: rnSpacing['3xl'] },
    card: {
      padding: rnSpacing.lg,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tokens.border.light,
      backgroundColor: tokens.surface.card,
      gap: rnSpacing.sm,
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    cardTitle: { fontSize: rnType.title.size, fontWeight: '600', color: tokens.text.primary },
    windowHint: { fontSize: 13, color: tokens.text.secondary },
    statRow: { flexDirection: 'row', gap: rnSpacing.md, marginTop: 6 },
    statCell: { flex: 1, gap: 2 },
    statValue: { fontSize: rnType.display.size, fontWeight: '700', color: tokens.brand.DEFAULT },
    statLabel: { fontSize: rnType.label.size, color: tokens.text.tertiary },
    muted: { fontSize: 13, color: tokens.text.secondary },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      paddingVertical: 10,
    },
    rowText: { flex: 1, fontSize: rnType.body.size, color: tokens.text.primary },
    rowCount: { fontSize: 13, color: tokens.text.secondary, fontWeight: '600' },
    linkRow: {
      paddingVertical: 14,
      paddingHorizontal: rnSpacing.lg,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tokens.border.light,
      backgroundColor: tokens.surface.card,
    },
    linkText: { fontSize: rnType.strong.size, color: tokens.text.primary },
    centerText: {
      textAlign: 'center',
      paddingVertical: rnSpacing['3xl'],
      fontSize: rnType.body.size,
      color: tokens.text.secondary,
    },
    errorText: {
      paddingVertical: rnSpacing.lg,
      fontSize: rnType.body.size,
      color: tokens.danger.DEFAULT,
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
