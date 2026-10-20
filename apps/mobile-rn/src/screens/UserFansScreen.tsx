// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { UserCheck, UserPlus, Users } from 'lucide-react-native'
import { fetchApi } from '@ihui/api-client'
import { rnRadius } from '@ihui/design-tokens'
import { tokens } from '../theme/active-tokens'
import { NavBar } from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { appAlert } from '../components/BottomPops'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const PAGE_SIZE = 20
// 后端 paginationOnlyQuery 的 pageSize 上限为 100(web 侧传 200 会被 400 拒绝),此处取上限。
const FOLLOWING_PAGE_SIZE = 100

/**
 * 我的粉丝 —— 对齐 web `/user/fans`。
 *
 * 端点按 apps/api/src/routes/social.ts 现读:
 *  - GET  /api/follows/followers?page&pageSize ⇒ { list, total, page, pageSize }
 *  - GET  /api/follows/following?pageSize=100  ⇒ { list: { userId, ... }[] }
 *  - POST /api/follows/:userId                 ⇒ 201 { followed, isMutual }
 * 列表实列(followers 的 select)只有 id/userId/nickname/avatar/createdAt,
 * 没有 bio —— web 侧接口声明的 bio 是假字段,本屏不渲染。
 */
interface FanRow {
  id: string
  userId: string
  nickname: string | null
  avatar: string | null
  createdAt: string | null
}

export default function UserFansScreen() {
  const { t, locale } = useI18n()
  const navigation = useNavigation<NavigationProp>()

  const [rows, setRows] = useState<FanRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [failed, setFailed] = useState(false)
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set())
  const [pendingId, setPendingId] = useState<string | null>(null)

  const fmtDate = useCallback(
    (iso: string | null) => {
      if (!iso) return '—'
      const d = new Date(iso)
      if (Number.isNaN(d.getTime())) return '—'
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d)
    },
    [locale],
  )

  const loadFollowing = useCallback(async () => {
    try {
      const res = await fetchApi<{ list: { userId: string }[] }>(
        `/api/follows/following?page=1&pageSize=${FOLLOWING_PAGE_SIZE}`,
      )
      if (res.success) setFollowedIds(new Set((res.data?.list ?? []).map((u) => u.userId)))
    } catch {
      // 关注状态只影响按钮形态,取不到时不阻断粉丝列表
    }
  }, [])

  const loadFans = useCallback(
    async (targetPage: number, append: boolean) => {
      if (append) setLoadingMore(true)
      else setLoading(true)
      setFailed(false)
      try {
        const res = await fetchApi<{ list: FanRow[]; total: number }>(
          `/api/follows/followers?page=${targetPage}&pageSize=${PAGE_SIZE}`,
        )
        if (!res.success) throw new Error(res.error)
        const list = res.data?.list ?? []
        setRows((prev) => (append ? [...prev, ...list] : list))
        setTotal(res.data?.total ?? 0)
      } catch {
        if (!append) {
          setRows([])
          setTotal(0)
        }
        setFailed(true)
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [],
  )

  useEffect(() => {
    void loadFollowing()
  }, [loadFollowing])

  useEffect(() => {
    void loadFans(1, false)
  }, [loadFans])

  const onFollowBack = async (userId: string) => {
    setPendingId(userId)
    try {
      const res = await fetchApi(`/api/follows/${userId}`, { method: 'POST' })
      if (!res.success) {
        appAlert(t('common.error'), res.error || t('userFans.actionFailed'))
        return
      }
      setFollowedIds((prev) => new Set(prev).add(userId))
      appAlert(t('common.hint'), t('userFans.followSuccess'))
    } catch {
      appAlert(t('common.error'), t('userFans.actionFailed'))
    } finally {
      setPendingId(null)
    }
  }

  const loadMore = async () => {
    if (loadingMore || rows.length >= total) return
    const next = page + 1
    await loadFans(next, true)
    setPage(next)
  }

  const styles = makeStyles()

  return (
    <View style={styles.container}>
      <NavChrome>
        <NavBar title={t('userFans.title')} onBack={() => navigation.goBack()} />
      </NavChrome>

      <ScrollView contentContainerStyle={styles.body}>
        {loading ? (
          <ActivityIndicator style={styles.stateBox} color={tokens.text.tertiary} />
        ) : failed ? (
          <View style={styles.stateBox}>
            <Text style={styles.errorText}>{t('userFans.loadFailed')}</Text>
            <TouchableOpacity onPress={() => void loadFans(1, false)} activeOpacity={0.7}>
              <Text style={styles.retry}>{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.stateBox}>
            <Users size={28} color={tokens.text.tertiary} />
            <Text style={styles.muted}>{t('userFans.empty')}</Text>
          </View>
        ) : (
          <>
            <Text style={styles.total}>{t('userFans.total', { total })}</Text>
            {rows.map((fan) => {
              const followed = followedIds.has(fan.userId)
              return (
                <View key={fan.id} style={styles.row}>
                  {fan.avatar ? (
                    <Image source={{ uri: fan.avatar }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback]}>
                      <Text style={styles.avatarText}>
                        {(fan.nickname ?? t('userFans.anonymous')).slice(0, 1)}
                      </Text>
                    </View>
                  )}
                  <View style={styles.rowMain}>
                    <Text style={styles.nickname} numberOfLines={1}>
                      {fan.nickname ?? t('userFans.anonymous')}
                    </Text>
                    <Text style={styles.muted}>
                      {t('userFans.followedAt')} {fmtDate(fan.createdAt)}
                    </Text>
                  </View>
                  {followed ? (
                    <View style={styles.followedTag}>
                      <UserCheck size={13} color={tokens.success.DEFAULT} />
                      <Text style={styles.followedText}>{t('userFans.followed')}</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.followBtn, pendingId === fan.userId && styles.btnDisabled]}
                      onPress={() => void onFollowBack(fan.userId)}
                      disabled={pendingId !== null}
                      activeOpacity={0.7}
                    >
                      <UserPlus size={13} color={tokens.brand.ctaForeground} />
                      <Text style={styles.followBtnText}>{t('userFans.follow')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )
            })}
            {rows.length < total ? (
              <TouchableOpacity
                style={styles.moreBtn}
                onPress={() => void loadMore()}
                disabled={loadingMore}
                activeOpacity={0.7}
              >
                <Text style={styles.moreText}>
                  {loadingMore
                    ? t('common.loading')
                    : t('userFans.loadMore', { loaded: rows.length, total })}
                </Text>
              </TouchableOpacity>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  )
}

function makeStyles() {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tokens.surface.bg },
    body: { padding: 12, gap: 8, paddingBottom: 32 },
    stateBox: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 48 },
    errorText: { fontSize: 13, color: tokens.danger.DEFAULT },
    retry: { fontSize: 13, fontWeight: '600', color: tokens.text.primary },
    muted: { fontSize: 12, color: tokens.text.secondary },
    total: { fontSize: 12, color: tokens.text.tertiary, paddingHorizontal: 4 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 12,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tokens.border.light,
      backgroundColor: tokens.surface.light,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: rnRadius['2xl'],
      backgroundColor: tokens.surface.muted,
      overflow: 'hidden',
    },
    avatarFallback: { alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 18, fontWeight: '600', color: tokens.text.secondary },
    rowMain: { flex: 1, gap: 3 },
    nickname: { fontSize: 14, fontWeight: '600', color: tokens.text.primary },
    followedTag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4 },
    followedText: { fontSize: 12, fontWeight: '600', color: tokens.success.DEFAULT },
    followBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      height: 32,
      paddingHorizontal: 12,
      borderRadius: rnRadius.sm,
      backgroundColor: tokens.brand.cta,
    },
    btnDisabled: { opacity: 0.5 },
    followBtnText: { fontSize: 12, fontWeight: '600', color: tokens.brand.ctaForeground },
    moreBtn: {
      height: 40,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tokens.border.medium,
      alignItems: 'center',
      justifyContent: 'center',
    },
    moreText: { fontSize: 13, color: tokens.text.primary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
