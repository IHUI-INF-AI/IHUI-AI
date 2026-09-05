// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍​‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { MessageSquare, Search, User } from 'lucide-react-native'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  getTeamMembers,
  getTeamStats,
  type TeamMemberItem,
  type TeamStats,
} from '@ihui/api-client'
import NavBar from '../components/NavBar'
import SearchInput from '../components/SearchInput'
import FloatBox, { type FloatBoxType } from '../components/FloatBox'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { rpx } from '../utils/rpx'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 分页大小(对齐 Uniapp distribution_personnel_list/index.vue pageSize: 10) */
const PAGE_SIZE = 10

type SortTab = 'orders' | 'inviteTime'

/** 后端金额以「分」存储,换算为元并保留两位 */
function fenToYuan(cents: number): string {
  const n = Number.isFinite(cents) ? cents / 100 : 0
  return n.toFixed(2)
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 邀请时间统一格式化:秒级时间戳(对齐 Uniapp createdAt)×1000 / ISO / 已是 YYYY-MM-DD 原样返回 */
function formatInviteDate(input: string | null | undefined): string {
  if (!input) return ''
  const raw = input.trim()
  if (/^\d+$/.test(raw)) {
    const d = new Date(Number(raw) * 1000)
    if (!Number.isNaN(d.getTime())) return toDateStr(d)
  }
  const d = new Date(raw)
  if (!Number.isNaN(d.getTime())) return toDateStr(d)
  return raw
}

/** 邀请时间 → 可比较数值(用于排序,秒级时间戳优先,否则取 Date.getTime) */
function inviteDateValue(input: string | null | undefined): number {
  if (!input) return 0
  const raw = input.trim()
  if (/^\d+$/.test(raw)) return Number(raw)
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? 0 : d.getTime()
}

function MemberAvatar({ uri }: { uri: string | null }) {
  if (uri) {
    return <Image source={{ uri }} style={styles.avatar} resizeMode="cover" />
  }
  return (
    <View style={[styles.avatar, styles.avatarPlaceholder]}>
      <User size={rpx(48)} color={tokens.text.tertiary} />
    </View>
  )
}

export function DistributionPersonnelListScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()

  const [allMembers, setAllMembers] = useState<TeamMemberItem[]>([])
  const [teamTotal, setTeamTotal] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<SortTab>('orders')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [dateFilter, setDateFilter] = useState('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const [floatVisible, setFloatVisible] = useState(false)
  const [floatMessage, setFloatMessage] = useState('')
  const [floatType, setFloatType] = useState<FloatBoxType>('info')
  const showFloat = useCallback((message: string, type: FloatBoxType = 'info') => {
    setFloatMessage(message)
    setFloatType(type)
    setFloatVisible(true)
  }, [])

  const loadStats = useCallback(async () => {
    try {
      const res = await getTeamStats()
      if (res.success && res.data) {
        const stats: TeamStats = res.data
        setTeamTotal(stats.totalMembers)
      }
    } catch {
      // 团队总数非关键,静默失败
    }
  }, [])

  const loadPage = useCallback(
    async (nextPage: number, reset: boolean) => {
      if (reset) setLoading(true)
      else setLoadingMore(true)
      try {
        const res = await getTeamMembers({ page: nextPage, pageSize: PAGE_SIZE })
        if (!res.success) throw new Error('failed')
        const list = res.data?.list ?? []
        setAllMembers((prev) => (reset ? list : [...prev, ...list]))
        const total = res.data?.total
        setHasMore(
          typeof total === 'number' ? nextPage * PAGE_SIZE < total : list.length >= PAGE_SIZE,
        )
        setPage(nextPage)
      } catch {
        showFloat(t('distributionPersonnel.loadFailed'), 'warning')
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [showFloat, t],
  )

  useEffect(() => {
    void loadStats()
    void loadPage(1, true)
  }, [loadStats, loadPage])

  // 客户端筛选 + 排序(对齐 Uniapp updateDisplayList:搜索/日期/排序全在前端 originalTeamList 上做)
  const displayList = useMemo(() => {
    let list = [...allMembers]
    const kw = searchKeyword.trim().toLowerCase()
    if (kw) {
      list = list.filter(
        (m) =>
          (m.nickname ?? '').toLowerCase().includes(kw) ||
          String(m.orderNum ?? '').includes(kw) ||
          String(m.transactionVolume ?? '').includes(kw) ||
          String(m.commission ?? '').includes(kw) ||
          (m.phone ?? '').toLowerCase().includes(kw) ||
          formatInviteDate(m.joinDate).includes(kw),
      )
    }
    if (activeTab === 'inviteTime' && dateFilter.trim()) {
      const df = dateFilter.trim()
      list = list.filter((m) => formatInviteDate(m.joinDate) === df)
    }
    if (activeTab === 'orders') {
      list.sort((a, b) => (b.orderNum ?? 0) - (a.orderNum ?? 0))
    } else {
      list.sort((a, b) => inviteDateValue(b.joinDate) - inviteDateValue(a.joinDate))
    }
    return list
  }, [allMembers, searchKeyword, activeTab, dateFilter])

  // 上拉加载(对齐 Uniapp scrolltolower)
  const onEndReached = useCallback(() => {
    if (!loading && !loadingMore && hasMore) {
      void loadPage(page + 1, false)
    }
  }, [loading, loadingMore, hasMore, page, loadPage])

  const handleContact = (member: TeamMemberItem) => {
    navigation.navigate('DistributionPersonnelDetail', { id: member.id })
  }

  const goBack = () => navigation.goBack()

  const renderMember = (member: TeamMemberItem, index: number) => (
    <View key={member.id} style={styles.card}>
      <View style={styles.rankBadge}>
        <Text style={styles.rankText}>#{index + 1}</Text>
      </View>
      <MemberAvatar uri={member.avatar} />
      <View style={styles.personLeft}>
        <Text style={styles.personName} numberOfLines={1}>
          {member.nickname || '-'}
        </Text>
      </View>
      <View style={styles.personInfo}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>
            {t('distributionPersonnel.fieldTransaction')}：
            <Text style={styles.highlight}>{fenToYuan(member.transactionVolume)}</Text>
          </Text>
          <Text style={styles.infoLabel}>
            {t('distributionPersonnel.fieldCommission')}：
            <Text style={styles.highlight}>{fenToYuan(member.commission)}</Text>
          </Text>
        </View>
        <Text style={styles.infoLabel}>
          {t('distributionPersonnel.fieldOrderNum')}：
          <Text style={styles.highlight}>{member.orderNum}</Text>
        </Text>
        <Text style={styles.infoSub}>
          {t('distributionPersonnel.fieldInviteTime')}：{formatInviteDate(member.joinDate)}
        </Text>
      </View>
      <Pressable
        style={({ pressed }) => [styles.contactBtn, pressed ? styles.pressed : null]}
        onPress={() => handleContact(member)}
        accessibilityRole="button"
        accessibilityLabel={t('distributionPersonnel.contact')}
      >
        <MessageSquare size={rpx(40)} color={tokens.brand.DEFAULT} />
      </Pressable>
    </View>
  )

  return (
    <View style={styles.root}>
      <NavBar
        title={t('distributionPersonnel.listTitle')}
        onBack={goBack}
        rightActions={[
          {
            icon: Search,
            label: t('distributionPersonnel.searchPlaceholder'),
            showLabel: false,
            onPress: () => setShowSearch((v) => !v),
          },
        ]}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        onScroll={({ nativeEvent }) => {
          const { contentOffset, contentSize, layoutMeasurement } = nativeEvent
          if (contentOffset.y + layoutMeasurement.height >= contentSize.height - rpx(40)) {
            onEndReached()
          }
        }}
        scrollEventThrottle={400}
      >
        {showSearch ? (
          <View style={styles.searchWrap}>
            <SearchInput
              value={searchKeyword}
              onChangeText={setSearchKeyword}
              placeholder={t('distributionPersonnel.searchPlaceholder')}
            />
          </View>
        ) : null}

        <Text style={styles.teamTotal}>
          {t('distributionPersonnel.teamTotal')}：
          <Text style={styles.teamTotalNum}>{teamTotal ?? 0}</Text>
        </Text>

        <View style={styles.tabsRow}>
          <Pressable
            style={({ pressed }) => [
              styles.tabBtn,
              activeTab === 'orders' ? styles.tabBtnActive : null,
              pressed ? styles.pressed : null,
            ]}
            onPress={() => setActiveTab('orders')}
            accessibilityRole="button"
            accessibilityLabel={t('distributionPersonnel.tabOrders')}
          >
            <Text
              style={activeTab === 'orders' ? styles.tabTextActive : styles.tabText}
              numberOfLines={1}
            >
              {t('distributionPersonnel.tabOrders')}
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.tabBtn,
              activeTab === 'inviteTime' ? styles.tabBtnActive : null,
              pressed ? styles.pressed : null,
            ]}
            onPress={() => setActiveTab('inviteTime')}
            accessibilityRole="button"
            accessibilityLabel={t('distributionPersonnel.tabInviteTime')}
          >
            <Text
              style={activeTab === 'inviteTime' ? styles.tabTextActive : styles.tabText}
              numberOfLines={1}
            >
              {t('distributionPersonnel.tabInviteTime')}
            </Text>
          </Pressable>
        </View>

        {activeTab === 'inviteTime' ? (
          <TextInput
            style={styles.dateInput}
            value={dateFilter}
            onChangeText={setDateFilter}
            placeholder={t('distributionPersonnel.tabInviteTime')}
            placeholderTextColor={tokens.text.tertiary}
          />
        ) : null}

        {loading && allMembers.length === 0 ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={tokens.brand.DEFAULT} />
          </View>
        ) : displayList.length === 0 ? (
          <View style={styles.centerState}>
            <Text style={styles.emptyText}>{t('distributionPersonnel.empty')}</Text>
          </View>
        ) : (
          displayList.map((m, i) => renderMember(m, i))
        )}

        {loadingMore ? (
          <View style={styles.loadingMore}>
            <ActivityIndicator size="small" color={tokens.brand.DEFAULT} />
            <Text style={styles.loadingMoreText}>{t('userOrder.loading')}</Text>
          </View>
        ) : null}
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
  searchWrap: { marginBottom: rpx(20) },
  teamTotal: {
    color: tokens.text.primary,
    fontSize: rpx(36),
    marginTop: rpx(10),
    marginBottom: rpx(20),
  } as const,
  teamTotalNum: { fontWeight: '700' as const, marginLeft: rpx(10) },
  tabsRow: { flexDirection: 'row', gap: rpx(20), marginBottom: rpx(20) },
  tabBtn: {
    flex: 1,
    height: rpx(70),
    borderRadius: rpx(15),
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.light,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: rpx(20),
  } as const,
  tabBtnActive: { borderColor: tokens.text.primary },
  tabText: { fontSize: rpx(30), color: tokens.text.tertiary, fontWeight: '600' as const } as const,
  tabTextActive: {
    fontSize: rpx(30),
    color: tokens.text.primary,
    fontWeight: '700' as const,
  } as const,
  dateInput: {
    height: rpx(70),
    borderRadius: rpx(15),
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.muted,
    paddingHorizontal: rpx(24),
    fontSize: rpx(28),
    color: tokens.text.primary,
    marginBottom: rpx(20),
  } as const,
  card: {
    borderRadius: rpx(30),
    paddingVertical: rpx(40),
    paddingHorizontal: rpx(30),
    marginBottom: rpx(16),
    backgroundColor: tokens.surface.card,
    borderWidth: 1,
    borderColor: tokens.border.light,
    flexDirection: 'row',
    alignItems: 'flex-start',
    position: 'relative' as const,
  },
  rankBadge: {
    position: 'absolute' as const,
    left: rpx(20),
    top: rpx(14),
    backgroundColor: tokens.brand.DEFAULT,
    borderRadius: rpx(8),
    paddingHorizontal: rpx(10),
    paddingVertical: rpx(2),
    zIndex: 2,
  },
  rankText: { color: tokens.surface.light, fontSize: rpx(22), fontWeight: '700' as const },
  avatar: {
    width: rpx(120),
    height: rpx(120),
    borderRadius: rpx(60),
    borderWidth: 2,
    borderColor: tokens.surface.light,
    marginRight: rpx(24),
  } as const,
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.surface.muted,
  },
  personLeft: { width: rpx(120), marginRight: rpx(24) },
  personName: { marginTop: rpx(12), fontSize: rpx(28), color: tokens.text.primary, textAlign: 'center' },
  personInfo: { flex: 1, gap: rpx(8) },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: rpx(12), flexWrap: 'wrap' as const },
  infoLabel: { fontSize: rpx(28), color: tokens.text.primary },
  infoSub: { fontSize: rpx(26), color: tokens.text.secondary },
  highlight: { color: tokens.warning.DEFAULT, fontWeight: '700' as const, fontSize: rpx(30) },
  contactBtn: {
    position: 'absolute' as const,
    right: rpx(26),
    bottom: rpx(26),
    padding: rpx(8),
  },
  centerState: { paddingVertical: rpx(120), alignItems: 'center' as const },
  emptyText: { fontSize: rpx(28), color: tokens.text.tertiary },
  loadingMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rpx(12),
    paddingVertical: rpx(20),
  },
  loadingMoreText: { fontSize: rpx(26), color: tokens.text.secondary },
  pressed: { opacity: 0.85 },
} as const
