// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍​‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Image, ScrollView, Text, View } from 'react-native'
import { User } from 'lucide-react-native'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getTeamMemberDetail, type TeamMemberDetail } from '@ihui/api-client'
import NavBar from '../components/NavBar'
import FloatBox, { type FloatBoxType } from '../components/FloatBox'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { rpx } from '../utils/rpx'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>
type DetailRouteProp = RouteProp<RootStackParamList, 'DistributionPersonnelDetail'>

/** 后端金额以「分」存储,换算为元并保留两位 */
function fenToYuan(cents: number): string {
  const n = Number.isFinite(cents) ? cents / 100 : 0
  return n.toFixed(2)
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 邀请时间格式化(对齐 Uniapp detail.vue formatDate:秒级时间戳×1000 / ISO / 原样返回) */
function formatInviteDate(input: string | null | undefined): string {
  if (!input) return '-'
  const raw = input.trim()
  if (/^\d+$/.test(raw)) {
    const d = new Date(Number(raw) * 1000)
    if (!Number.isNaN(d.getTime())) return toDateStr(d)
  }
  const d = new Date(raw)
  if (!Number.isNaN(d.getTime())) return toDateStr(d)
  return raw
}

export function DistributionPersonnelDetailScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute<DetailRouteProp>()
  const id = route.params?.id ?? ''

  const [detail, setDetail] = useState<TeamMemberDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [floatVisible, setFloatVisible] = useState(false)
  const [floatMessage, setFloatMessage] = useState('')
  const [floatType, setFloatType] = useState<FloatBoxType>('info')
  const showFloat = useCallback((message: string, type: FloatBoxType = 'info') => {
    setFloatMessage(message)
    setFloatType(type)
    setFloatVisible(true)
  }, [])

  useEffect(() => {
    if (!id) {
      showFloat(t('distributionPersonnel.paramError'), 'warning')
      navigation.goBack()
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const res = await getTeamMemberDetail(id)
        if (cancelled) return
        if (!res.success) throw new Error('failed')
        if (!res.data) {
          setNotFound(true)
        } else {
          setDetail(res.data)
        }
      } catch {
        if (!cancelled) showFloat(t('distributionPersonnel.loadFailed'), 'warning')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, navigation, showFloat, t])

  const goBack = () => navigation.goBack()

  return (
    <View style={styles.root}>
      <NavBar title={t('distributionPersonnel.detailTitle')} onBack={goBack} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={tokens.brand.DEFAULT} />
          </View>
        ) : notFound || !detail ? (
          <View style={styles.centerState}>
            <Text style={styles.emptyText}>{t('distributionPersonnel.empty')}</Text>
          </View>
        ) : (
          <View style={styles.detailCard}>
            <View style={styles.avatarWrap}>
              {detail.avatar ? (
                <Image source={{ uri: detail.avatar }} style={styles.avatar} resizeMode="cover" />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <User size={rpx(72)} color={tokens.text.tertiary} />
                </View>
              )}
            </View>
            <Text style={styles.nickname}>{detail.nickname || '-'}</Text>

            <View style={styles.row}>
              <Text style={styles.rowLabel}>{t('distributionPersonnel.fieldPhone')}</Text>
              <Text style={styles.rowValue}>{detail.phone || '-'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{t('distributionPersonnel.fieldTransaction')}</Text>
              <Text style={[styles.rowValue, styles.highlight]}>
                ¥{fenToYuan(detail.transactionVolume)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{t('distributionPersonnel.fieldCommission')}</Text>
              <Text style={[styles.rowValue, styles.highlight]}>
                ¥{fenToYuan(detail.commission)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{t('distributionPersonnel.fieldOrderNum')}</Text>
              <Text style={[styles.rowValue, styles.highlight]}>{detail.orderNum}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{t('distributionPersonnel.fieldInviteTime')}</Text>
              <Text style={styles.rowValue}>{formatInviteDate(detail.joinedAt)}</Text>
            </View>
          </View>
        )}
      </ScrollView>
      <FloatBox
        visible={floatVisible}
        type={floatType}
        message={floatMessage}
        onHide={() => setFloatVisible(false)}
      />
    </View>
  )
}

const styles = {
  root: { flex: 1, backgroundColor: tokens.surface.light },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: rpx(40), paddingTop: rpx(40), paddingBottom: rpx(40) },
  centerState: { paddingVertical: rpx(160), alignItems: 'center' as const },
  emptyText: { fontSize: rpx(28), color: tokens.text.tertiary },
  detailCard: {
    borderRadius: rpx(30),
    padding: rpx(40),
    backgroundColor: tokens.surface.card,
    borderWidth: 1,
    borderColor: tokens.border.light,
    alignItems: 'center' as const,
  },
  avatarWrap: { alignItems: 'center' as const, marginBottom: rpx(20) },
  avatar: {
    width: rpx(180),
    height: rpx(180),
    borderRadius: rpx(90),
    borderWidth: 3,
    borderColor: tokens.surface.light,
  } as const,
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.surface.muted,
  },
  nickname: { fontSize: rpx(40), fontWeight: '700' as const, color: tokens.text.primary, marginBottom: rpx(30) },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingVertical: rpx(20),
  } as const,
  rowLabel: { fontSize: rpx(30), color: tokens.text.secondary },
  rowValue: { fontSize: rpx(30), color: tokens.text.primary, fontWeight: '600' as const },
  highlight: { color: tokens.warning.DEFAULT, fontWeight: '700' as const, fontSize: rpx(32) },
} as const
