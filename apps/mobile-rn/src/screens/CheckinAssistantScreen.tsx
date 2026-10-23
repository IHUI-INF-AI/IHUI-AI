// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { CalendarCheck, Plus, Trash2 } from 'lucide-react-native'
import { fetchApi } from '@ihui/api-client'
import { rnRadius } from '@ihui/design-tokens'
import { TextField } from '@ihui/rn-app'
import { tokens } from '../theme/active-tokens'
import { NavBar } from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { appAlert } from '../components/BottomPops'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const PLATFORMS = ['trae', 'workbuddy', 'qoder', 'minimax'] as const

interface CheckinAccount {
  id: number
  name: string
  platform: string
  enabled: boolean
  device_map?: Record<string, unknown>
  last_record?: { ok: boolean; credits?: number | null } | null
}

/**
 * 移动端签到助手 + 个人号池(2026-10-23 立)。
 * 与 Web `/checkin`、`/account-pool` 共用后端(/api/checkin/*、/api/account-pool),
 * 数据天然互通;device_map.pool_account_id 存在 = 已进入当前用户的个人号池。
 */
export default function CheckinAssistantScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [list, setList] = useState<CheckinAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]>('trae')
  const [name, setName] = useState('')
  const [jwt, setJwt] = useState('')
  const [refreshToken, setRefreshToken] = useState('')

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await fetchApi<{ accounts: CheckinAccount[] }>('/api/checkin/accounts')
      if (res.success) setList(res.data?.accounts ?? [])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const stats = useMemo(() => {
    const synced = list.filter((a) => Boolean(a.device_map?.pool_account_id)).length
    return { total: list.length, synced, enabled: list.filter((a) => a.enabled).length }
  }, [list])

  const checkin = async (acc: CheckinAccount) => {
    setBusyId(acc.id)
    try {
      const res = await fetchApi(`/api/checkin/accounts/${acc.id}/checkin`, { method: 'POST' })
      if (!res.success) appAlert(t('checkinAssistant.actionFailed'), res.error)
      else void load(true)
    } finally {
      setBusyId(null)
    }
  }

  const toggle = async (acc: CheckinAccount) => {
    setBusyId(acc.id)
    try {
      const res = await fetchApi(`/api/checkin/accounts/${acc.id}/enabled`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !acc.enabled }),
      })
      if (!res.success) appAlert(t('checkinAssistant.actionFailed'), res.error)
      else void load(true)
    } finally {
      setBusyId(null)
    }
  }

  const remove = (acc: CheckinAccount) => {
    appAlert(
      t('checkinAssistant.delete'),
      t('checkinAssistant.deleteConfirm', { name: acc.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('checkinAssistant.delete'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const res = await fetchApi(`/api/checkin/accounts/${acc.id}`, { method: 'DELETE' })
              if (!res.success) appAlert(t('checkinAssistant.actionFailed'), res.error)
              else void load(true)
            })()
          },
        },
      ],
    )
  }

  const submit = async () => {
    if (!name.trim() || !jwt.trim()) return
    setAdding(true)
    try {
      const res = await fetchApi('/api/checkin/accounts', {
        method: 'POST',
        body: JSON.stringify({
          platform,
          name: name.trim(),
          jwt: jwt.trim(),
          device_map: refreshToken.trim() ? { refresh_token: refreshToken.trim() } : {},
        }),
      })
      if (!res.success) {
        appAlert(t('checkinAssistant.actionFailed'), res.error)
        return
      }
      setName('')
      setJwt('')
      setRefreshToken('')
      void load(true)
    } finally {
      setAdding(false)
    }
  }

  return (
    <View style={styles.container}>
      <NavChrome>
        <NavBar title={t('checkinAssistant.title')} onBack={() => navigation.goBack()} />
      </NavChrome>
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />
        }
      >
        <View style={styles.card}>
          <Text style={styles.summary}>
            {t('checkinAssistant.summary', {
              total: stats.total,
              enabled: stats.enabled,
              synced: stats.synced,
            })}
          </Text>
          <Text style={styles.muted}>{t('checkinAssistant.subtitle')}</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={tokens.brand.DEFAULT ?? tokens.text.secondary} />
        ) : list.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('checkinAssistant.empty')}</Text>
            <Text style={styles.muted}>{t('checkinAssistant.emptyHint')}</Text>
          </View>
        ) : (
          list.map((acc) => (
            <View key={acc.id} style={styles.card}>
              <View style={styles.rowHead}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {acc.name}
                </Text>
                <View style={styles.badges}>
                  <Text style={styles.badge}>{acc.platform}</Text>
                  <Text style={[styles.badge, acc.enabled ? styles.badgeOn : styles.badgeOff]}>
                    {acc.enabled ? t('checkinAssistant.enabled') : t('checkinAssistant.disabled')}
                  </Text>
                  {acc.device_map?.pool_account_id ? (
                    <Text style={[styles.badge, styles.badgePool]}>
                      {t('checkinAssistant.poolSynced')}
                    </Text>
                  ) : null}
                </View>
              </View>
              {acc.last_record ? (
                <Text style={styles.muted}>
                  {acc.last_record.ok
                    ? t('checkinAssistant.lastOk', { credits: acc.last_record.credits ?? 0 })
                    : t('checkinAssistant.lastFailed')}
                </Text>
              ) : null}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.action}
                  disabled={busyId === acc.id}
                  onPress={() => void checkin(acc)}
                >
                  <CalendarCheck size={14} color={tokens.text.primary} />
                  <Text style={styles.actionText}>{t('checkinAssistant.checkin')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.action}
                  disabled={busyId === acc.id}
                  onPress={() => void toggle(acc)}
                >
                  <Text style={styles.actionText}>
                    {acc.enabled ? t('checkinAssistant.disable') : t('checkinAssistant.enable')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.action} onPress={() => remove(acc)}>
                  <Trash2 size={14} color={tokens.text.secondary} />
                  <Text style={styles.actionText}>{t('checkinAssistant.delete')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        <View style={styles.card}>
          <View style={styles.rowHead}>
            <Plus size={16} color={tokens.text.secondary} />
            <Text style={styles.cardTitle}>{t('checkinAssistant.addTitle')}</Text>
          </View>
          <View style={styles.chips}>
            {PLATFORMS.map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.chip, platform === p && styles.chipOn]}
                onPress={() => setPlatform(p)}
              >
                <Text style={[styles.chipText, platform === p && styles.chipOnText]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextField
            colorScheme={resolvedTheme}
            value={name}
            onChangeText={setName}
            placeholder={t('checkinAssistant.namePlaceholder')}
            style={styles.input}
          />
          <Text style={styles.label}>{t('checkinAssistant.tokenLabel')}</Text>
          <TextField
            colorScheme={resolvedTheme}
            value={jwt}
            onChangeText={setJwt}
            placeholder={t('checkinAssistant.tokenPlaceholder')}
            style={styles.input}
          />
          <Text style={styles.label}>{t('checkinAssistant.refreshTokenLabel')}</Text>
          <TextField
            colorScheme={resolvedTheme}
            value={refreshToken}
            onChangeText={setRefreshToken}
            placeholder={t('checkinAssistant.optional')}
            style={styles.input}
          />
          <TouchableOpacity
            style={[styles.submit, (!name.trim() || !jwt.trim() || adding) && styles.submitOff]}
            disabled={!name.trim() || !jwt.trim() || adding}
            onPress={() => void submit()}
          >
            <Text style={styles.submitText}>
              {adding ? t('checkinAssistant.adding') : t('checkinAssistant.add')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg },
  body: { padding: 16, gap: 12, paddingBottom: 40 },
  card: {
    backgroundColor: tokens.surface.card,
    borderRadius: rnRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.border.light,
    padding: 14,
    gap: 8,
  },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: tokens.text.primary, flexShrink: 1 },
  summary: { fontSize: 14, fontWeight: '600', color: tokens.text.primary },
  muted: { fontSize: 12, color: tokens.text.secondary, lineHeight: 18 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: {
    fontSize: 11,
    color: tokens.text.secondary,
    backgroundColor: tokens.surface.muted,
    borderRadius: rnRadius.md,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeOn: { color: tokens.brand.DEFAULT ?? tokens.text.primary },
  badgeOff: { color: tokens.text.secondary },
  badgePool: { color: tokens.text.primary },
  actions: { flexDirection: 'row', gap: 8, marginTop: 2 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: rnRadius.md,
    backgroundColor: tokens.surface.muted,
  },
  actionText: { fontSize: 12, color: tokens.text.primary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: rnRadius.md,
    backgroundColor: tokens.surface.muted,
  },
  chipOn: { backgroundColor: tokens.brand.cta },
  chipText: { fontSize: 12, color: tokens.text.secondary },
  chipOnText: { color: tokens.brand.ctaForeground ?? tokens.surface.bg },
  input: { marginTop: 2 },
  label: { fontSize: 12, color: tokens.text.secondary, marginTop: 4 },
  submit: {
    marginTop: 8,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: rnRadius.md,
    backgroundColor: tokens.brand.cta,
  },
  submitOff: { opacity: 0.5 },
  submitText: { fontSize: 14, fontWeight: '600', color: tokens.brand.ctaForeground },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
